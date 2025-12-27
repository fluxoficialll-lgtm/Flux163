
import crypto from 'crypto';
import { dbManager } from '../databaseManager.js'; // Acesso ao DB para lookup interno se necessário

const FB_API_VERSION = 'v19.0';

// Regex para detectar dados inválidos comuns em ambientes de teste/bancos brasileiros
const INVALID_PHONES = [
    /^(\d)\1+$/, // Todos números iguais (ex: 11111111111)
    /11999999999/,
    /00000000000/,
    /123456789/
];

const INVALID_EMAILS = [
    'teste@teste.com',
    'admin@admin.com',
    'user@example.com',
    'usuario@gmail.com'
];

/**
 * Normaliza e gera Hash SHA-256 conforme documentação do Meta.
 * Documentação: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */
const hashData = (data, type = 'default') => {
    if (data === undefined || data === null || data === '') return undefined;
    
    // VERIFICAÇÃO DE SEGURANÇA: Se já for um hash SHA-256 (64 hex chars), não aplica hash novamente.
    if (typeof data === 'string' && /^[a-f0-9]{64}$/i.test(data)) {
        return data.toLowerCase();
    }

    // 1. Normalização Global: Minúsculo e Trim
    let normalized = String(data).trim().toLowerCase();

    if (type === 'email') {
        normalized = normalized.replace(/\s/g, '');
        // Filtro de Qualidade: Ignorar emails de teste óbvios
        if (INVALID_EMAILS.includes(normalized)) return undefined;
    } 
    else if (type === 'phone') {
        normalized = normalized.replace(/\D/g, '');
        
        // Filtro de Qualidade: Ignorar telefones inválidos/repetidos
        if (normalized.length < 7) return undefined;
        if (INVALID_PHONES.some(regex => regex.test(normalized))) return undefined;
        
        if (normalized.startsWith('0')) normalized = normalized.substring(1);
        if (normalized.length >= 10 && normalized.length <= 11) normalized = '55' + normalized;
    } 
    else if (type === 'country' || type === 'state') {
        normalized = normalized.substring(0, 2);
    }
    else if (type === 'zip') {
        normalized = normalized.replace(/\D/g, '');
    }
    else if (type === 'city') {
        normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, '');
    }
    else if (type === 'gender') {
        const first = normalized.charAt(0);
        normalized = (first === 'm' || first === 'f') ? first : '';
    }
    else if (type === 'dob') {
        const nums = normalized.replace(/\D/g, '');
        if (nums.length === 8) {
            const first4 = parseInt(nums.substring(0, 4));
            if (first4 > 1900 && first4 < 2100) {
                normalized = nums;
            } else {
                const d = nums.substring(0, 2);
                const m = nums.substring(2, 4);
                const y = nums.substring(4, 8);
                normalized = `${y}${m}${d}`;
            }
        } else {
            return undefined;
        }
    }

    if (normalized === '') return undefined;
    return crypto.createHash('sha256').update(normalized).digest('hex');
};

export const facebookCapi = {
    /**
     * Helper público para hash (usado nas rotas se necessário)
     */
    hashData,

    /**
     * Sends an event to Meta Conversions API
     * Centralized logic for both Web Hooks and Frontend CAPI calls.
     */
    sendEvent: async ({ pixelId, accessToken, eventName, eventData, userData, eventId, url, testEventCode }) => {
        // Validação Crítica
        if (!pixelId) {
            throw new Error('MISSING_PIXEL_ID');
        }
        if (!accessToken) {
            throw new Error('MISSING_ACCESS_TOKEN');
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);

        // 1. USER DATA (HASHED PII) - Normaliza para array conforme API exige
        const ensureHashArray = (val, type) => {
            if (!val) return undefined;
            
            // Se for array (ex: múltiplos emails ou external_ids)
            if (Array.isArray(val)) {
                const hashedArr = val.map(v => hashData(v, type)).filter(Boolean);
                // Remove duplicatas
                const unique = [...new Set(hashedArr)];
                return unique.length > 0 ? unique : undefined;
            }
            
            const hashed = hashData(val, type);
            return hashed ? [hashed] : undefined;
        };

        const user_data = {
            // Hashed Fields
            em: ensureHashArray(userData.email, 'email'),
            ph: ensureHashArray(userData.phone, 'phone'),
            fn: ensureHashArray(userData.firstName),
            ln: ensureHashArray(userData.lastName),
            ct: ensureHashArray(userData.city, 'city'),
            st: ensureHashArray(userData.state, 'state'),
            zp: ensureHashArray(userData.zip, 'zip'),
            country: ensureHashArray(userData.country, 'country'),
            db: ensureHashArray(userData.dateOfBirth, 'dob'),
            ge: ensureHashArray(userData.gender, 'gender'),
            
            // External ID: Pode receber array (Email e CPF para maximizar match)
            external_id: ensureHashArray(userData.externalId),

            // Unhashed Technical Fields
            client_ip_address: userData.ip || userData.client_ip_address,
            client_user_agent: userData.userAgent || userData.client_user_agent,
            fbp: userData.fbp,
            fbc: userData.fbc, // Click ID
            fb_login_id: userData.fbLoginId,
            subscription_id: userData.subscriptionId,
            lead_id: userData.leadId
        };

        // 2. APP DATA (If applicable)
        const app_data = {
            application_tracking_enabled: true,
            advertiser_tracking_enabled: true,
            application_package_name: process.env.APP_PACKAGE_NAME || "com.fluxplatform.app",
            version: process.env.APP_VERSION || "1.0.0",
            extinfo: userData.extinfo || undefined,
            install_referrer: userData.installReferrer,
            url_schemes: userData.urlSchemes
        };

        // 3. CUSTOM DATA - Clean undefined
        const custom_data = {
            ...eventData,
            // Ensure currency/value format
            currency: eventData.currency ? String(eventData.currency).toUpperCase() : undefined,
            value: eventData.value !== undefined ? Number(eventData.value) : undefined
        };
        
        // Remove undefined keys from objects
        const cleanObj = (obj) => {
            const newObj = {};
            Object.keys(obj).forEach(key => {
                if (obj[key] !== undefined && obj[key] !== null) newObj[key] = obj[key];
            });
            return newObj;
        };

        const cleanedUserData = cleanObj(user_data);

        // --- VALIDATION: STRONG IDENTIFIER CHECK ---
        // Se não tiver identificador forte, o Meta descarta ou atribui mal.
        const strongIds = ['em', 'ph', 'external_id', 'fbp', 'fb_login_id'];
        const hasStrongId = strongIds.some(key => cleanedUserData[key]);

        if (!hasStrongId) {
             console.warn(`[CAPI] Low Match Quality for ${eventName}. Missing strong identifiers (em, ph, fbp, external_id).`);
             // Opcional: Lançar erro se quiser ser estrito
             // throw new Error('INSUFFICIENT_USER_DATA: No strong identifier (em, ph, fbp, external_id)');
        }

        const payload = {
            data: [
                {
                    event_name: eventName,
                    event_time: currentTimestamp,
                    event_source_url: url,
                    event_id: eventId, // Critical for Deduplication
                    action_source: userData.actionSource || "website",
                    user_data: cleanedUserData,
                    custom_data: cleanObj(custom_data),
                    app_data: userData.actionSource === 'app' ? cleanObj(app_data) : undefined,
                    opt_out: false
                }
            ]
        };

        // Debug / Test Event Code (Backend Env or Payload override)
        const activeTestCode = testEventCode || process.env.FACEBOOK_TEST_EVENT_CODE;
        if (activeTestCode) {
            payload.test_event_code = activeTestCode;
        }

        try {
            const fbUrl = `https://graph.facebook.com/${FB_API_VERSION}/${pixelId}/events?access_token=${accessToken}`;
            
            const response = await fetch(fbUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resData = await response.json();

            if (!response.ok) {
                // Log de erro interno antes de jogar
                console.error(`[CAPI Logic Error] Meta API Response: ${JSON.stringify(resData)}`);
                throw new Error(`META_API_ERROR: ${resData.error?.message || 'Unknown error'}`);
            } else {
                // Sucesso (Log é feito no chamador, mas mantemos debug aqui)
                // console.log(`✅ [CAPI Service] Success. Trace ID: ${resData.fb_trace_id}`);
                return resData;
            }
        } catch (error) {
            // Repassa erro para a camada de rota para log de auditoria
            throw error; 
        }
    }
};
