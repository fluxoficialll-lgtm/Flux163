
/**
 * Serviço de E-mail - Frontend
 * Redireciona chamadas para o Backend (/api/send-email)
 */

import { API_BASE } from '../apiConfig';

const BACKEND_URL = `${API_BASE}/api/send-email`;

const sendViaBackend = async (toEmail: string, subject: string, htmlContent: string) => {
    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                to: toEmail,
                subject: subject,
                html: htmlContent
            })
        });

        if (!response.ok) {
            throw new Error(`Falha ao enviar e-mail. Status: ${response.status}`);
        }

    } catch (error: any) {
        console.error("Erro no serviço de e-mail:", error);
        // Não lançamos erro fatal para não travar a UI em dev, mas logamos
        throw new Error("Não foi possível enviar o e-mail. Tente novamente.");
    }
};

export const emailService = {
    /**
     * 1. Envio de código de verificação para criar conta
     */
    sendVerificationCode: async (email: string, code: string, type: 'register' | 'reset' = 'register') => {
        const isReset = type === 'reset';
        const subject = isReset ? "Redefinição de senha" : "Verificação de e-mail";
        
        const title = isReset ? "Redefinição de Senha" : "Bem-vindo ao Flux!";
        const text = isReset 
            ? "Use o código abaixo para redefinir sua senha."
            : "Use o código abaixo para confirmar o seu e-mail.";
        
        const color = isReset ? "#d32f2f" : "#333";
        const bgCode = isReset ? "#fff0f0" : "#f4f4f4";

        const content = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: ${color}">${title}</h2>
                <p>${text}</p>
                <div style="background: ${bgCode}; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; border-radius: 8px; margin: 20px 0;">
                    ${code}
                </div>
                <p style="font-size: 12px; color: #888;">Se você não solicitou este código, ignore este e-mail.</p>
            </div>
        `;
        await sendViaBackend(email, subject, content);
    },

    /**
     * 2. Wrapper para reset de senha (mantido para compatibilidade)
     */
    sendPasswordResetCode: async (email: string, code: string) => {
        return emailService.sendVerificationCode(email, code, 'reset');
    }
};
