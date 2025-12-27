
import { z } from 'zod';
import xss from 'xss';

// Helper to sanitize strings
const sanitize = (val) => (typeof val === 'string' ? xss(val) : val);

export const registerSchema = z.object({
    email: z.string().email().transform(sanitize),
    password: z.string().min(6),
    profile: z.object({
        name: z.string().min(2).max(30).regex(/^[a-z0-9_.]+$/, "Username inválido").transform(sanitize),
        nickname: z.string().max(50).optional().transform(sanitize),
        bio: z.string().max(300).optional().transform(sanitize),
        isPrivate: z.boolean().optional(),
        photoUrl: z.string().url().optional().or(z.literal(''))
    })
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

export const postCreateSchema = z.object({
    id: z.string(),
    type: z.enum(['text', 'photo', 'video', 'poll']),
    username: z.string().transform(sanitize),
    text: z.string().max(5000).transform(sanitize),
    image: z.string().optional(),
    video: z.string().optional(),
    isAdultContent: z.boolean().optional(),
    isAd: z.boolean().optional(),
    pollOptions: z.array(z.object({
        text: z.string().transform(sanitize),
        votes: z.number()
    })).optional()
});

export const withdrawalSchema = z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    payload: z.object({
        amount: z.number().positive("O valor deve ser positivo").min(5, "Saque mínimo de R$ 5,00"),
        pix_key: z.string().min(4, "Chave Pix inválida").transform(sanitize),
        pix_key_type: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM', 'EVP']),
        description: z.string().optional().transform(sanitize)
    })
});

// Middleware to use schemas
export const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        return res.status(400).json({ 
            error: "Validation Error", 
            details: err.errors.map(e => e.message) 
        });
    }
};
