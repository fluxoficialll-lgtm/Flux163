
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from 'crypto';
import path from 'path';

/**
 * Cloudflare R2 Storage Service
 * Gerencia a organização por pastas e limpeza de arquivos.
 */

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

export const storageService = {
    /**
     * Faz upload de um arquivo para o Cloudflare R2 organizado por pastas
     * @param {Object} file Objeto do arquivo vindo do Multer
     * @param {string} folder Pasta de destino (prefixo)
     * @returns {Promise<string>} URL pública do arquivo
     */
    async uploadFile(file, folder = 'misc') {
        if (!file || !file.buffer) return null;

        const fileExtension = path.extname(file.originalname);
        const fileName = `${crypto.randomUUID()}${fileExtension}`;
        
        // Organização por prefixo (Pastas virtuais)
        const cleanFolder = folder.replace(/\/$/, '');
        const key = `${cleanFolder}/${fileName}`;
        
        const bucketName = process.env.R2_BUCKET_NAME;
        const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

        const params = {
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        try {
            await r2Client.send(new PutObjectCommand(params));
            
            if (publicUrl) {
                return `${publicUrl}/${key}`;
            }
            
            return `https://${bucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
        } catch (error) {
            console.error("❌ [R2 Upload Error]:", error);
            throw new Error("Falha ao fazer upload para a nuvem.");
        }
    },

    /**
     * Remove um arquivo do bucket a partir de sua URL
     * @param {string} fileUrl URL completa do arquivo
     */
    async deleteFile(fileUrl) {
        if (!fileUrl || typeof fileUrl !== 'string') return;
        
        try {
            const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
            const bucketName = process.env.R2_BUCKET_NAME;
            let key = '';

            // Extrai a Key (caminho/arquivo.ext) da URL
            if (publicUrl && fileUrl.includes(publicUrl)) {
                key = fileUrl.split(`${publicUrl}/`)[1];
            } else {
                // Fallback para extração genérica via split por endpoint do R2
                const parts = fileUrl.split('.com/');
                if (parts.length > 1) key = parts[1];
            }

            if (!key) return;

            console.log(`🗑️ Removendo do storage: ${key}`);

            await r2Client.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key
            }));
        } catch (error) {
            console.error("❌ [R2 Delete Error]:", error.message);
            // Não travamos o processo principal se a exclusão do arquivo falhar
        }
    }
};
