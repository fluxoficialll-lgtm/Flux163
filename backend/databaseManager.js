
import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    console.error("❌ ERRO CRÍTICO: DATABASE_URL não definida no ambiente.");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 20
});

const query = async (text, params) => {
    try {
        return await pool.query(text, params);
    } catch (error) {
        // Only log serious errors, ignore common "already exists" handled by logic
        if (!error.message.includes('already exists')) {
            console.error(`❌ DB Query Error [${text.substring(0, 100)}...]:`, error.message);
        }
        throw error;
    }
};

/**
 * Helper para validar UUIDs e evitar erro de sintaxe syntax for type uuid: ""
 */
const toUuid = (val) => {
    if (!val || val === "" || val === "undefined" || val === "null") return null;
    return val;
};

/**
 * Robust Column Checker - Idempotent
 */
const ensureColumn = async (table, column, typeDefinition) => {
    try {
        const res = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = $2
        `, [table, column]);
        
        if (res.rows.length === 0) {
            console.log(`🔧 Adding column ${column} to ${table}...`);
            await query(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDefinition}`);
            return true;
        }
    } catch (e) {
        console.error(`Error ensuring column ${column} in ${table}:`, e.message);
    }
    return false;
};

/**
 * Ensure Unique Constraint for ON CONFLICT - Idempotent
 */
const ensureUniqueConstraint = async (table, constraintName, columnsArray) => {
    try {
        // Check if constraint exists first
        const checkRes = await query(`
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = $1 AND constraint_name = $2
        `, [table, constraintName]);

        if (checkRes.rows.length === 0) {
            console.log(`🔧 Creating unique constraint ${constraintName} on ${table}...`);
            const cols = columnsArray.join(', ');
            await query(`
                ALTER TABLE ${table} 
                ADD CONSTRAINT ${constraintName} UNIQUE (${cols})
            `);
            console.log(`✅ Constraint ${constraintName} added to ${table}.`);
        }
    } catch (e) {
        if (!e.message.includes('already exists')) {
            console.error(`Error adding constraint to ${table}:`, e.message);
        }
    }
};

export const dbManager = {
    async init() {
        console.log("🔄 DB: Inicializando Schema...");
        try {
            // Enable UUID support
            await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

            // 1. Users
            await query(`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    email TEXT UNIQUE NOT NULL, 
                    password TEXT, 
                    data JSONB, 
                    referred_by_id UUID,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await ensureColumn('users', 'referred_by_id', 'UUID');

            // 2. Groups
            await query(`
                CREATE TABLE IF NOT EXISTS groups (
                    id TEXT PRIMARY KEY, 
                    creator_id UUID NOT NULL, 
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // 3. Posts
            await query(`
                CREATE TABLE IF NOT EXISTS posts (
                    id TEXT PRIMARY KEY, 
                    author_id UUID NOT NULL, 
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // 4. Interactions
            await query(`
                CREATE TABLE IF NOT EXISTS interactions (
                    id SERIAL PRIMARY KEY,
                    post_id TEXT NOT NULL,
                    user_id UUID NOT NULL,
                    type TEXT NOT NULL, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await ensureUniqueConstraint('interactions', 'interactions_post_user_type_unique', ['post_id', 'user_id', 'type']);

            // 5. Chats
            await query(`
                CREATE TABLE IF NOT EXISTS chats (
                    id TEXT PRIMARY KEY, 
                    data JSONB, 
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // 6. Marketplace
            await query(`
                CREATE TABLE IF NOT EXISTS marketplace (
                    id TEXT PRIMARY KEY, 
                    seller_id UUID NOT NULL, 
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // 7. Relationships
            await query(`
                CREATE TABLE IF NOT EXISTS relationships (
                    id TEXT PRIMARY KEY, 
                    follower_id UUID NOT NULL, 
                    following_id UUID NOT NULL, 
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            await ensureColumn('relationships', 'status', "TEXT DEFAULT 'accepted'");

            // 8. Notifications
            await query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id SERIAL PRIMARY KEY, 
                    recipient_id UUID NOT NULL, 
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // 9. VIP Access
            await query(`
                CREATE TABLE IF NOT EXISTS vip_access (
                    id TEXT PRIMARY KEY, 
                    user_id UUID NOT NULL, 
                    group_id TEXT NOT NULL, 
                    data JSONB, 
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            // 10. Financial
            await query(`
                CREATE TABLE IF NOT EXISTS financial_transactions (
                    id SERIAL PRIMARY KEY,
                    user_id UUID NOT NULL,
                    type TEXT,
                    amount NUMERIC(10,2),
                    status TEXT,
                    provider_tx_id TEXT,
                    data JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);

            console.log("✅ DB: Estrutura validada.");
        } catch (e) {
            console.error("❌ DB: Falha na inicialização estrutural:", e.message);
        }
    },

    users: {
        async findByEmail(email) {
            if (!email) return null;
            const res = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (res.rows.length > 0) {
                const row = res.rows[0];
                let data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                return { ...data, id: row.id, email: row.email, referredById: row.referred_by_id };
            }
            return null;
        },
        async findById(id) {
            const uuid = toUuid(id);
            if (!uuid) return null;
            const res = await query('SELECT * FROM users WHERE id = $1', [uuid]);
            if (res.rows.length > 0) {
                const row = res.rows[0];
                let data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                return { ...data, id: row.id, email: row.email, referredById: row.referred_by_id };
            }
            return null;
        },
        async create(user) {
            const { id, email, password, referredById, ...userData } = user;
            const res = await query(
                `INSERT INTO users (email, password, referred_by_id, data) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id`,
                [email.toLowerCase().trim(), password, toUuid(referredById), JSON.stringify(userData)]
            );
            return res.rows[0].id;
        },
        async update(user) {
            const { id, email, password, referredById, ...userData } = user;
            const uuid = toUuid(id);
            if (!uuid) return false;

            if (password) {
                await query(`UPDATE users SET password = $1, data = $2 WHERE id = $3`, [password, JSON.stringify(userData), uuid]);
            } else {
                await query(`UPDATE users SET data = $1 WHERE id = $2`, [JSON.stringify(userData), uuid]);
            }
            return true;
        },
        async getAll() {
            const res = await query('SELECT * FROM users LIMIT 1000', []);
            return res.rows.map(row => ({
                ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data),
                id: row.id, email: row.email
            }));
        }
    },

    posts: {
        async create(post) {
            const authorUuid = toUuid(post.authorId);
            if (!authorUuid) throw new Error("ID do autor inválido para post");

            await query(`
                INSERT INTO posts (id, author_id, data) 
                VALUES ($1, $2, $3) 
                ON CONFLICT (id) DO UPDATE SET data = $3, author_id = $2
            `, [post.id, authorUuid, JSON.stringify(post)]);
            return true;
        },
        async list(limit = 50, cursor = null) {
            let sql = 'SELECT * FROM posts';
            let params = [limit];
            if (cursor) {
                sql += ' WHERE created_at < $2 ORDER BY created_at DESC LIMIT $1';
                params.push(new Date(Number(cursor)));
            } else {
                sql += ' ORDER BY created_at DESC LIMIT $1';
            }
            const res = await query(sql, params);
            return res.rows.map(r => ({ ...JSON.parse(r.data), authorId: r.author_id }));
        }
    },

    interactions: {
        async record(postId, userId, type) {
            const userUuid = toUuid(userId);
            if (!userUuid) return; 

            await query(`
                INSERT INTO interactions (post_id, user_id, type) 
                VALUES ($1, $2, $3) 
                ON CONFLICT (post_id, user_id, type) DO NOTHING
            `, [postId, userUuid, type]);
        }
    },

    relationships: {
        async create(rel) {
            const f1 = toUuid(rel.followerId);
            const f2 = toUuid(rel.followingId);
            if (!f1 || !f2) return;

            const id = `${rel.followerId}_${rel.followingId}`;
            await query(`
                INSERT INTO relationships (id, follower_id, following_id, status, data) 
                VALUES ($1, $2, $3, $4, $5) 
                ON CONFLICT (id) DO UPDATE SET status = $4, data = $5
            `, [id, f1, f2, rel.status || 'accepted', JSON.stringify(rel)]);
        },
        async getTopCreators() {
            const sql = `
                SELECT u.id, u.data, COUNT(r.id) as follower_count
                FROM users u
                LEFT JOIN relationships r ON u.id = r.following_id AND r.status = 'accepted'
                GROUP BY u.id
                ORDER BY follower_count DESC
                LIMIT 50
            `;
            const res = await query(sql);
            return res.rows.map(row => ({
                ...(typeof row.data === 'string' ? JSON.parse(row.data) : row.data),
                id: row.id,
                followerCount: parseInt(row.follower_count)
            }));
        }
    },

    query
};
