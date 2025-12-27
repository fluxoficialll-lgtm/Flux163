
export interface TrackingParams {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    ref?: string; // Affiliate handle
    ref_id?: string; // Affiliate ID
    [key: string]: string | undefined;
}

const STORAGE_KEY = 'flux_attribution_data';

export const trackingService = {
    captureUrlParams: () => {
        const params = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search);
        const tracking: any = {};
        params.forEach((val, key) => { tracking[key] = val; });
        if (Object.keys(tracking).length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: tracking, ts: Date.now() }));
        }
    },
    getStoredParams: (): TrackingParams => {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw).params : {};
    },
    getAffiliateRefId: () => {
        const params = trackingService.getStoredParams();
        return params.ref_id || params.ref; // Try ID first
    },
    // Fix: Added missing getAffiliateRef method
    getAffiliateRef: () => {
        const params = trackingService.getStoredParams();
        return params.ref;
    },
    generateTrackingLink: (base: string, params: TrackingParams) => {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => v && query.set(k, v));
        return `${base}${base.includes('?') ? '&' : '?'}${query.toString()}`;
    },
    clear: () => localStorage.removeItem(STORAGE_KEY),
    hardReset: () => localStorage.removeItem(STORAGE_KEY)
};
