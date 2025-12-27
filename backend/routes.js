
import express from 'express';
import axios from 'axios';
import { dbManager } from './databaseManager.js';
import { facebookCapi } from './services/facebookCapi.js'; 
import { storageService } from './services/storageService.js';
import { googleAuthConfig } from './authConfig.js';

const router = express.Router();

const API_KEY = process.env.API_KEY;

// Auth Routes
router.get('/auth/config', (req, res) => {
    res.json({ clientId: googleAuthConfig.clientId });
});

router.post('/auth/register', async (req, res) => {
    try {
        const user = req.body;
        // Sanitização básica para o campo de referência
        if (user.referredById === "") user.referredById = null;
        
        const userId = await dbManager.users.create(user);
        res.json({ success: true, user: { ...user, id: userId } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await dbManager.users.findByEmail(email);
        if (user && user.password === password) {
            res.json({ user, token: 'session_' + Date.now() });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/google', async (req, res) => {
    try {
        const { googleToken, referredBy } = req.body;
        
        // Em um cenário real, decodificaríamos o JWT do Google.
        // Aqui simulamos um email fixo baseado no token ou timestamp se o token for mock.
        const suffix = googleToken && googleToken.length > 20 ? 'user' : Date.now().toString().slice(-4);
        const email = `google_user_${suffix}@gmail.com`;
        
        let user = await dbManager.users.findByEmail(email);
        let isNew = false;

        if (!user) {
            isNew = true;
            // Geramos um handle amigável em vez de apenas números
            const defaultHandle = `usuario_${suffix}`;
            
            const newUser = {
                email,
                isVerified: true,
                isProfileCompleted: false,
                referredById: (referredBy === "" || !referredBy) ? null : referredBy,
                profile: { 
                    name: defaultHandle, 
                    nickname: 'Usuário Flux', 
                    isPrivate: false,
                    photoUrl: '' 
                }
            };
            const id = await dbManager.users.create(newUser);
            user = { ...newUser, id };
        }
        res.json({ user, token: 'g_session_' + Date.now(), isNew });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users/sync', async (req, res) => {
    try {
        const users = await dbManager.users.getAll();
        res.json({ users });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/users/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        const users = await dbManager.users.getAll();
        const filtered = users.filter(u => 
            u.profile?.name?.toLowerCase().includes(q.toLowerCase()) || 
            u.profile?.nickname?.toLowerCase().includes(q.toLowerCase())
        );
        res.json(filtered);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/users/update', async (req, res) => {
    try {
        const { email, updates } = req.body;
        if (!email) return res.status(400).json({ error: "Email é obrigatório" });
        
        const user = await dbManager.users.findByEmail(email);
        if (user) {
            // Garantimos que updates.profile não sobrescreva outros dados sensíveis
            const updated = { ...user, ...updates };
            const success = await dbManager.users.update(updated);
            if (!success) throw new Error("Falha ao persistir no banco");
            res.json({ user: updated });
        } else {
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
    } catch (e) { 
        console.error("Update Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

// Posts
router.get('/posts', async (req, res) => {
    try {
        const { limit, cursor } = req.query;
        const data = await dbManager.posts.list(Number(limit) || 50, cursor);
        res.json({ data, nextCursor: data.length > 0 ? data[data.length-1].timestamp : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/posts/create', async (req, res) => {
    try {
        const post = req.body;
        if (!post.authorId || post.authorId === "") {
            return res.status(400).json({ error: "authorId é obrigatório e deve ser um UUID válido" });
        }
        await dbManager.posts.create(post);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/posts/:id/interact', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, type } = req.body;
        if (!userId || userId === "") return res.status(400).json({ error: "userId inválido" });
        await dbManager.interactions.record(id, userId, type);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Groups
router.get('/groups', async (req, res) => {
    try {
        const data = await dbManager.groups.list();
        res.json({ data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/groups/create', async (req, res) => {
    try {
        await dbManager.groups.create(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/groups/:id', async (req, res) => {
    try {
        const group = await dbManager.groups.getById(req.params.id);
        if (group) res.json({ group });
        else res.status(404).json({ error: 'Not found' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marketplace
router.get('/marketplace', async (req, res) => {
    try {
        const res_db = await dbManager.query('SELECT * FROM marketplace ORDER BY created_at DESC');
        const items = res_db.rows.map(r => ({ ...JSON.parse(r.data), sellerId: r.seller_id }));
        res.json({ data: items });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/marketplace/create', async (req, res) => {
    try {
        await dbManager.marketplace.create(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rankings
router.get('/rankings/top', async (req, res) => {
    try {
        const data = await dbManager.relationships.getTopCreators();
        res.json({ data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/relationships/follow', async (req, res) => {
    try {
        await dbManager.relationships.create(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/relationships/unfollow', async (req, res) => {
    try {
        const { followerId, followingId } = req.body;
        await dbManager.relationships.delete(followerId, followingId);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Standard stubs
router.post('/upload', (req, res) => res.json({ files: [{ url: 'mock_url' }] }));
router.post('/moderation/analyze', (req, res) => res.json({ isAdult: false }));
router.post('/device/register', (req, res) => res.json({ success: true }));
router.post('/send-email', (req, res) => res.json({ success: true }));

export default router;
