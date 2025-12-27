
import { Capacitor } from '@capacitor/core';

/**
 * Serviço de Privacidade
 * Gerencia o bloqueio de capturas de tela e gravação.
 * 
 * NOTA: Para funcionar no Android/iOS (APK), é necessário instalar o plugin:
 * npm install @capacitor-community/privacy-screen
 * npx cap sync
 */

export const privacyService = {
    /**
     * Ativa o modo de privacidade (Bloqueia Print/Gravação)
     */
    enable: async () => {
        // Log para debug no navegador
        console.log('🔒 [Privacy] Ativando proteção de tela...');

        if (Capacitor.isNativePlatform()) {
            try {
                // Tenta importar dinamicamente para não quebrar a build web se o plugin não existir
                // @ts-ignore
                const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
                await PrivacyScreen.enable();
            } catch (e) {
                console.warn("[Privacy] Plugin nativo não encontrado ou erro ao ativar.", e);
            }
        }
    },

    /**
     * Desativa o modo de privacidade (Permite Print/Gravação)
     */
    disable: async () => {
        console.log('🔓 [Privacy] Desativando proteção de tela...');

        if (Capacitor.isNativePlatform()) {
            try {
                // @ts-ignore
                const { PrivacyScreen } = await import('@capacitor-community/privacy-screen');
                await PrivacyScreen.disable();
            } catch (e) {
                console.warn("[Privacy] Plugin nativo não encontrado ou erro ao desativar.", e);
            }
        }
    }
};
