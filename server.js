
import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'fs';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dbManager } from './backend/databaseManager.js';
import { storageService } from './backend/services/storageService.js';
import apiRoutes from './backend/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    socket.on('join_user', (email) => socket.join(email));
    socket.on('join_chat', (chatId) => socket.join(chatId));
});

app.set('trust proxy', 1);

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } 
});

// Middlewares Globais
app.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug Middleware: Log de todas as requisições para identificar 404s que retornam HTML
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || req.path.startsWith('/api')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    req.io = io;
    next();
});

// Inicialização do Banco
dbManager.init()
    .then(() => console.log("✅ Database initialized successfully."))
    .catch(err => console.error("❌ DB Init Error:", err));

// Rota de Upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    try {
        const folder = req.body.folder || 'misc';
        const fileUrl = await storageService.uploadFile(req.file, folder);
        res.json({ success: true, files: [{ url: fileUrl }] });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar upload para nuvem' });
    }
});

// Rotas da API
app.use('/api', apiRoutes);
app.get('/ping', (req, res) => res.send('pong'));

// Configuração de Arquivos Estáticos (Frontend)
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

// SPA Catch-all: DEVE vir depois das rotas da API
app.get('*', (req, res) => {
    // Se a requisição for para /api e chegou aqui, é um 404 de API real
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: `Endpoint de API não encontrado: ${req.path}` });
    }
    
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found.');
    }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}. Mode: ${process.env.NODE_ENV || 'development'}`);
});
