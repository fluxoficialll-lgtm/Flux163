
import { API_BASE } from '../apiConfig';
import { authService } from './authService';

export const contentSafetyService = {
    /**
     * Analisa o texto e a mídia para determinar se é +18 usando a API real.
     */
    analyzeContent: async (text: string, mediaFiles: any[]): Promise<{ isAdult: boolean; reason?: string }> => {
        try {
            // Pega a URL da primeira mídia se existir (para análise visual)
            const mediaUrl = mediaFiles && mediaFiles.length > 0 ? mediaFiles[0].url : undefined;
            const userEmail = authService.getCurrentUserEmail();

            const response = await fetch(`${API_BASE}/api/moderation/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text,
                    mediaUrl,
                    userEmail // Send user identity for Strike System
                })
            });

            if (!response.ok) {
                console.warn("Moderation API failed, failing open.");
                return { isAdult: false };
            }

            const result = await response.json();
            return { 
                isAdult: result.isAdult, 
                reason: result.reason 
            };

        } catch (error) {
            console.error("Error analyzing content:", error);
            // Em caso de erro de rede, não bloqueia o usuário (Fail Open)
            return { isAdult: false };
        }
    }
};
