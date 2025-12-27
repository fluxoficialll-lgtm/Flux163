
// Serviço de Criptografia (Client-Side)
// Implementa criptografia AES-GCM robusta utilizando Web Crypto API.
// As chaves são geradas dinamicamente e armazenadas localmente para persistência,
// garantindo que não existam segredos hardcoded no código-fonte.

const KEY_STORAGE_NAME = 'flux_encryption_key_v1';

// Helper para converter Buffer para String Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Helper para converter String Base64 para Buffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

// Gerenciamento de Chave
const getEncryptionKey = async (): Promise<CryptoKey> => {
    let keyData = localStorage.getItem(KEY_STORAGE_NAME);
    
    if (keyData) {
        // Importar chave existente
        const rawKey = base64ToArrayBuffer(keyData);
        return await window.crypto.subtle.importKey(
            "raw",
            rawKey,
            "AES-GCM",
            true,
            ["encrypt", "decrypt"]
        );
    } else {
        // Gerar nova chave
        const key = await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
        
        // Exportar e salvar
        const exported = await window.crypto.subtle.exportKey("raw", key);
        localStorage.setItem(KEY_STORAGE_NAME, arrayBufferToBase64(exported));
        return key;
    }
};

export const cryptoService = {
  
  // Hash unidirecional para senhas (SHA-256)
  hashPassword: async (password: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Criptografa dados usando AES-GCM.
   * Retorna uma string combinada contendo o IV e o conteúdo cifrado.
   */
  encryptData: async (data: string): Promise<string> => {
    try {
        const key = await getEncryptionKey();
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // IV de 12 bytes para AES-GCM
        const encodedData = new TextEncoder().encode(data);

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encodedData
        );

        // Combina IV e Dados Criptografados em uma única string base64 para armazenamento
        const ivBase64 = arrayBufferToBase64(iv.buffer);
        const contentBase64 = arrayBufferToBase64(encryptedBuffer);
        
        return `${ivBase64}:${contentBase64}`;
    } catch (e) {
        console.error("Encryption failed:", e);
        return "";
    }
  },

  /**
   * Descriptografa dados AES-GCM.
   */
  decryptData: async (encryptedString: string): Promise<string> => {
    try {
        if (!encryptedString || !encryptedString.includes(':')) return "";

        const [ivBase64, contentBase64] = encryptedString.split(':');
        const iv = base64ToArrayBuffer(ivBase64);
        const content = base64ToArrayBuffer(contentBase64);
        const key = await getEncryptionKey();

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: new Uint8Array(iv)
            },
            key,
            content
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        console.error("Decrypt Error (Data may be corrupted or key changed):", e);
        return "";
    }
  }
};
