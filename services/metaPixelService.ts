
import { authService } from "./authService";
import { API_BASE } from "../apiConfig";
import { Capacitor } from '@capacitor/core';
import { trackingService } from './trackingService'; 

declare global {
    interface Window {
        fbq: any;
        _fbq: any;
    }
}

const initializedPixels = new Set<string>();

export const getCookie = (name: string): string | undefined => {
    try {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        if (match) return match[2];
    } catch (e) { return undefined; }
    return undefined;
};

const setCookie = (name: string, value: string, days: number) => {
    try {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + "; path=/";
    } catch (e) {
        console.warn("Failed to set cookie", e);
    }
};

const getOrGenerateGuestId = (): string => {
    const STORAGE_KEY = '_flux_anon_id';
    let guestId = localStorage.getItem(STORAGE_KEY);
    if (!guestId) {
        guestId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEY, guestId);
    }
    return guestId;
};

/**
 * Lógica de Deduplicação (Disparo Único)
 * Garante que o mesmo evento para o mesmo contexto não dispare múltiplas vezes.
 */
const checkAndMarkAffiliateEvent = (eventName: string, ref: string): boolean => {
    let stableId = localStorage.getItem('_flux_dedup_id');
    if (!stableId) {
        stableId = Math.random().toString(36).substring(2) + Date.now().toString();
        localStorage.setItem('_flux_dedup_id', stableId);
    }
    
    // Chave única baseada no evento, na referência do afiliado e no ID estável do browser
    const storageKey = `flux_aff_evt_${eventName}_${ref}_${stableId}`;
    
    if (localStorage.getItem(storageKey)) {
        return false; // Já disparou
    }
    
    localStorage.setItem(storageKey, Date.now().toString());
    return true;
};

const generateUniqueEventId = (eventName: string, contentId?: string): string => {
    const suffix = contentId ? `_${contentId}` : '';
    return `${eventName}${suffix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const enrichEventData = (eventData: any) => {
    const utms = trackingService.getStoredParams();
    return {
        ...eventData,
        ...utms 
    };
};

const getUserAdvancedData = (overrideData?: { email?: string, name?: string, phone?: string }): any => {
    const user = authService.getCurrentUser();
    const payload: any = {};
    const isApp = Capacitor.isNativePlatform();

    payload.actionSource = isApp ? "app" : "website";
    payload.anonId = getOrGenerateGuestId();

    let sourceEmail = overrideData?.email || user?.email || localStorage.getItem('guest_email_capture') || undefined;
    
    if (sourceEmail) {
        payload.email = sourceEmail.trim().toLowerCase();
        payload.externalId = [payload.email];
    }

    const fbp = getCookie('_fbp');
    if (fbp) payload.fbp = fbp;
    
    return payload;
};

export const metaPixelService = {
    init: (pixelId: string) => {
        if (!pixelId || initializedPixels.has(pixelId)) return;

        if (!window.fbq) {
            (function(f:any,b:any,e:any,v:any,n?:any,t?:any,s?:any)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)})(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
        }

        window.fbq('init', pixelId);
        initializedPixels.add(pixelId);
    },

    trackPageView: (pixelId: string) => {
        if (!pixelId) return;
        metaPixelService.init(pixelId);
        const eventId = generateUniqueEventId('PageView');
        if (typeof window.fbq === 'function') {
            window.fbq('track', 'PageView', enrichEventData({}), { eventID: eventId });
        }
    },

    /**
     * Rastreio de Acesso via Link de Recrutamento (Afiliado)
     * Implementa disparo único para PageView de Afiliado.
     */
    trackRecruitmentAccess: async (ref: string) => {
        if (!ref) return;

        // VERIFICAÇÃO DE DISPARO ÚNICO
        if (!checkAndMarkAffiliateEvent('RecruitmentPageView', ref)) {
            console.log(`[Pixel Afiliado] Disparo ignorado (já registrado para ${ref})`);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/tracking/pixel-info?ref=${encodeURIComponent(ref)}`);
            if (response.ok) {
                const { pixelId } = await response.json();
                if (pixelId) {
                    console.log(`🎯 [Pixel Afiliado] Iniciando rastreio ÚNICO para ref: ${ref}`);
                    metaPixelService.trackPageView(pixelId);
                }
            }
        } catch (e) {
            console.warn("Pixel info fetch failed for ref:", ref);
        }
    },

    trackLead: (pixelId: string, userData?: { email: string }, groupId: string = 'general') => {
        if (!pixelId) return;
        const eventId = generateUniqueEventId('Lead');
        
        fetch(`${API_BASE}/api/tracking/capi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pixelId,
                eventName: 'Lead',
                eventId,
                eventData: enrichEventData({ content_ids: [groupId], content_type: 'product_group' }),
                userData: getUserAdvancedData(userData),
                url: window.location.href
            })
        }).catch(() => {});
    },

    trackViewContent: (pixelId: string, data: { content_ids: string[], content_type: string, value?: number, currency?: string, content_name?: string }, userDataOverride?: { email?: string }) => {
        if (!pixelId) return;
        const eventId = generateUniqueEventId('ViewContent', data.content_ids[0]);

        fetch(`${API_BASE}/api/tracking/capi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pixelId,
                eventName: 'ViewContent',
                eventId,
                eventData: enrichEventData(data),
                userData: getUserAdvancedData(userDataOverride),
                url: window.location.href
            })
        }).catch(() => {});
    },

    trackInitiateCheckout: (pixelId: string, data: { content_ids: string[], content_type: string, value: number, currency: string, content_name?: string, num_items?: number, contents?: any[] }, userDataOverride?: { email?: string }) => {
        if (!pixelId) return;
        const eventId = generateUniqueEventId('InitiateCheckout', data.content_ids[0]);

        fetch(`${API_BASE}/api/tracking/capi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pixelId,
                eventName: 'InitiateCheckout',
                eventId,
                eventData: enrichEventData(data),
                userData: getUserAdvancedData(userDataOverride),
                url: window.location.href
            })
        }).catch(() => {});
    }
};
