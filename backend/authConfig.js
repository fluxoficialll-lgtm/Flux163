
/**
 * Configurações de Autenticação (Backend)
 * 
 * Modificado para rodar sem travar, mesmo sem variáveis de ambiente configuradas.
 */

export const googleAuthConfig = {
    // Chave Pública (Fallback para string vazia para não quebrar o build)
    clientId: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_NAO_CONFIGURADO",
    
    // Chave Privada
    // Se não estiver definida, usa uma string vazia para permitir que o servidor inicie
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "CLIENT_SECRET_NAO_CONFIGURADO",
    
    redirectUri: process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/auth/callback` : "http://localhost:3000/auth/callback"
};
