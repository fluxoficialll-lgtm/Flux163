
import { API_BASE } from '../apiConfig';
import { User, Group, AffiliateStats } from '../types';
import { authService } from './authService';
import { getCookie } from './metaPixelService';
import { trackingService } from './trackingService'; 

const PROXY_BASE = `${API_BASE}/api/syncpay`;

const safeFetch = async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
    }
    return res.json();
};

const generateValidCpf = (): string => {
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const mod = (dividend: number, divisor: number) => Math.round(dividend - (Math.floor(dividend / divisor) * divisor));
    const n1 = rnd(10); const n2 = rnd(10); const n3 = rnd(10); const n4 = rnd(10); const n5 = rnd(10); const n6 = rnd(10); const n7 = rnd(10); const n8 = rnd(10); const n9 = rnd(10);
    let d1 = n9*2 + n8*3 + n7*4 + n6*5 + n5*6 + n4*7 + n3*8 + n2*9 + n1*10;
    d1 = 11 - (mod(d1, 11)); if (d1 >= 10) d1 = 0;
    let d2 = d1*2 + n9*3 + n8*4 + n7*5 + n6*6 + n5*7 + n4*8 + n3*9 + n2*10 + n1*11;
    d2 = 11 - (mod(d2, 11)); if (d2 >= 10) d2 = 0;
    return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
};

export const syncPayService = {
    authenticate: async (clientId: string, clientSecret: string) => {
        return safeFetch(`${PROXY_BASE}/auth-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, clientSecret })
        });
    },

    createPayment: async (user: User, group: Group) => {
        const groupId = group.id;
        const ownerEmail = group.creatorEmail;
        if (!ownerEmail) throw new Error("Grupo sem dono definido.");

        let userCpf = user.profile?.cpf ? user.profile.cpf.replace(/\D/g, '') : '';
        if (!userCpf || userCpf.length !== 11) userCpf = generateValidCpf();

        let rawName = user.profile?.name || user.profile?.nickname || 'Visitante';
        let cleanName = rawName.replace(/[^a-zA-ZÀ-ÿ ]/g, ' ').trim();
        if (cleanName.indexOf(' ') === -1) cleanName += ' Visitante';
        if (cleanName.length < 5) cleanName = "Cliente Visitante";

        let rawPhone = user.profile?.phone || '';
        const cleanPhone = rawPhone.replace(/\D/g, '');
        const validPhone = (cleanPhone.length >= 10) ? cleanPhone : '11999999999';

        const fbp = getCookie('_fbp');
        const fbc = getCookie('_fbc');
        const testCode = localStorage.getItem('_fb_test_code');
        const utms = trackingService.getStoredParams();
        const tracking = { fbp: fbp || undefined, fbc: fbc || undefined, userAgent: navigator.userAgent };

        const payload = {
            amount: parseFloat(group.price || '0'),
            client: { name: cleanName, email: user.email, cpf: userCpf, phone: validPhone },
            description: `Acesso VIP: ${group.name.substring(0, 30)}`,
            metadata: { groupId, ...tracking, ...utms, test_event_code: testCode || undefined }
        };

        const response = await safeFetch(`${PROXY_BASE}/cash-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, ownerEmail, payload, tracking })
        });
        
        return {
            pixCode: response.pixCode || response.pix_code || response.qrcode || response.emv || "",
            identifier: response.identifier || response.transaction_id || response.id || "",
            qrCodeImage: response.qrCodeImage || response.qr_code_base64 || ""
        };
    },

    checkTransactionStatus: async (transactionId: string, sellerEmail: string, groupId?: string, buyerEmail?: string, tracking?: { fbp?: string, fbc?: string, testEventCode?: string }) => {
        const user = authService.getCurrentUser();
        let credentials = {};
        if (user && user.paymentConfig?.isConnected) {
            credentials = { clientId: user.paymentConfig.clientId, clientSecret: user.paymentConfig.clientSecret };
        }
        return safeFetch(`${PROXY_BASE}/check-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId, sellerEmail, groupId, buyerEmail, tracking, ...credentials })
        });
    },

    getBalance: async (userEmail: string) => {
        const user = authService.getCurrentUser();
        if (!user || !user.paymentConfig || !user.paymentConfig.isConnected) return 0;
        try {
            const response = await safeFetch(`${PROXY_BASE}/balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: user.paymentConfig.clientId, clientSecret: user.paymentConfig.clientSecret })
            });
            return response.balance || 0;
        } catch (e) { return 0; }
    },

    getTransactions: async (userEmail: string) => {
        const user = authService.getCurrentUser();
        if (!user || !user.paymentConfig || !user.paymentConfig.isConnected) return [];
        try {
            return await safeFetch(`${PROXY_BASE}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail, clientId: user.paymentConfig.clientId, clientSecret: user.paymentConfig.clientSecret })
            });
        } catch (e) { return []; }
    },

    // --- AFFILIATE METHODS ---
    getAffiliateStats: async (email: string): Promise<AffiliateStats> => {
        return safeFetch(`${API_BASE}/api/affiliates/stats?email=${encodeURIComponent(email)}`);
    },

    getFees: async () => {
        return { withdrawal_fee: 5.00 };
    },

    requestWithdrawal: async (user: User, amount: number, pixKey: string, pixKeyType: string) => {
        if (!user.paymentConfig || !user.paymentConfig.isConnected) throw new Error("Provedor de pagamento não conectado.");
        
        return safeFetch(`${PROXY_BASE}/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                email: user.email, 
                clientId: user.paymentConfig.clientId, 
                clientSecret: user.paymentConfig.clientSecret, 
                amount: Number(amount), 
                pixKey, 
                pixKeyType 
            })
        });
    }
};
