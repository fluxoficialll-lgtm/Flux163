
import { User, Post, Group, NotificationItem, Relationship, ChatData, VerificationSession, LockoutState, VipAccess, MarketplaceItem, AdCampaign } from '../types';

// --- Constants ---
const STORAGE_KEY_DB_LEGACY = 'app_sqlite.db'; // Legacy key for migration
const STORAGE_KEY_SESSION = 'app_current_user_email';
const STORAGE_KEY_SESSIONS = 'app_verification_sessions';
const STORAGE_KEY_LOCKOUTS = 'app_lockouts';
const BROADCAST_CHANNEL_NAME = 'flux_realtime_sync';

// IndexedDB Constants
const IDB_NAME = 'FluxPlatformDB';
const IDB_VERSION = 1;
const IDB_STORE = 'snapshots';
const IDB_KEY = 'sqlite_main';

type TableName = 'users' | 'posts' | 'groups' | 'chats' | 'notifications' | 'relationships' | 'vip_access' | 'profile' | 'marketplace' | 'ads';
type Listener = () => void;

// --- Mock Data Seeds (Visual Testing) ---
// Fix: Added missing id for Users
const SEED_USERS: User[] = [
    { 
        id: 'u1',
        email: 'user1@test.com', 
        password: '123', 
        isVerified: true, 
        isProfileCompleted: true, 
        profile: { name: 'alice_wonder', nickname: 'Alice W.', bio: 'Explorando o mundo offline. 🌍', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', isPrivate: false } 
    },
    { 
        id: 'u2',
        email: 'user2@test.com', 
        password: '123', 
        isVerified: true, 
        isProfileCompleted: true, 
        profile: { name: 'bob_builder', nickname: 'Bob O Construtor', bio: 'Criando interfaces incríveis.', photoUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', isPrivate: true } 
    },
    { 
        id: 'u3',
        email: 'admin@test.com', 
        password: '123', 
        isVerified: true, 
        isProfileCompleted: true, 
        profile: { name: 'flux_admin', nickname: 'Flux Official', bio: 'Conta oficial do sistema.', photoUrl: '', isPrivate: false } 
    }
];

// Fix: Added missing authorId for Posts
const SEED_POSTS: Post[] = [
    { id: '1', type: 'text', authorId: 'u1', username: '@alice_wonder', text: 'Bem-vindo ao modo Offline! 🚀\nEste post foi gerado localmente para você testar a interface sem precisar de internet.', time: '2m', timestamp: Date.now(), likes: 42, comments: 5, views: 120, isPublic: true, liked: false, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
    { id: '2', type: 'photo', authorId: 'u2', username: '@bob_builder', text: 'Olha esse layout incrível no modo escuro.', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop', time: '1h', timestamp: Date.now() - 3600000, likes: 128, comments: 12, views: 500, isPublic: true, liked: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
    { id: '3', type: 'poll', authorId: 'u3', username: '@flux_admin', text: 'O que achou da velocidade do app offline?', pollOptions: [{text: 'Incrível', votes: 10}, {text: 'Pode melhorar', votes: 2}], votedOptionIndex: null, time: '3h', timestamp: Date.now() - 10800000, likes: 5, comments: 0, views: 50, isPublic: true, liked: false, avatar: '' },
    { id: '4', type: 'video', authorId: 'u1', username: '@alice_wonder', text: 'Testando reprodução de vídeo no feed.', video: 'https://www.w3schools.com/html/mov_bbb.mp4', time: '5h', timestamp: Date.now() - 18000000, likes: 230, comments: 45, views: 1200, isPublic: true, liked: false, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' }
];

// Fix: Changed members to memberIds
const SEED_GROUPS: Group[] = [
    { id: '101', name: 'Design System', description: 'Discussão sobre UI/UX e Design Systems.', isVip: false, creatorId: 'u3', memberIds: ['u1', 'u2'], lastMessage: 'Novo update disponível', time: '10:00' },
    { id: '102', name: 'Flux VIP Elite', description: 'Conteúdo exclusivo de marketing digital.', isVip: true, price: '29.90', currency: 'BRL', creatorId: 'u3', memberIds: [], coverImage: '', lastMessage: 'Seja bem-vindo!', time: 'Ontem', creatorEmail: 'admin@test.com' }
];

const SEED_ITEMS: MarketplaceItem[] = [
    { id: 'prod1', title: 'iPhone 15 Pro Max', price: 8500, category: 'Eletrônicos', location: 'São Paulo, SP', description: 'Aparelho novo, na caixa, garantia Apple.', sellerId: 'u2', sellerName: '@bob_builder', sellerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', timestamp: Date.now(), image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=1000&auto=format&fit=crop' },
    { id: 'prod2', title: 'Consultoria de Marketing', price: 1500, category: 'Serviços', location: 'Remoto', description: 'Aumento suas vendas em 30 dias.', sellerId: 'u1', sellerName: '@alice_wonder', sellerAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', timestamp: Date.now() - 86400000, image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000&auto=format&fit=crop' }
];

// --- IndexedDB Helper ---
const idbHelper = {
    open: (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(IDB_NAME, IDB_VERSION);
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            request.onsuccess = (event: any) => resolve(event.target.result);
            request.onerror = (event: any) => reject(event.target.error);
        });
    },
    saveSnapshot: async (data: string) => {
        const db = await idbHelper.open();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            const req = store.put(data, IDB_KEY);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    getSnapshot: async (): Promise<string | null> => {
        const db = await idbHelper.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(IDB_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null); // Fail gracefully
        });
    }
};

// --- SQLite Wrapper Class ---
class SQLiteDB {
  private db: any = null;
  private isReady: boolean = false;
  private lastLoadedSnapshot: string | null = null;
  private channel: BroadcastChannel;
  private listeners: Map<string, Set<Listener>> = new Map();

  constructor() {
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    this.init();
    this.setupRealtimeListener();
  }

  // Initialize SQL.js and load/create DB
  private async init() {
    try {
      // @ts-ignore - sql.js is loaded via CDN in index.html
      const SQL = await window.initSqlJs({
        locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });

      await this.loadFromStorage(SQL);
      
      this.isReady = true;
      console.log("SQLite Database Initialized (Offline Ready)");
      
      // Auto-Seed if empty
      this.seedData();

    } catch (err) {
      console.error("Failed to initialize SQLite:", err);
    }
  }

  private setupRealtimeListener() {
      this.channel.onmessage = async (event) => {
          if (event.data.type === 'DB_UPDATE') {
              // Update received from another tab
              await this.reload();
              // Notify listeners for specific table
              if (event.data.table) {
                  this.notifyListeners(event.data.table);
              }
          }
      };
  }

  private async loadFromStorage(SQL: any) {
      let savedDb: string | null = null;

      // 1. Migration Check: Check localStorage first (Legacy)
      try {
          const legacyData = localStorage.getItem(STORAGE_KEY_DB_LEGACY);
          if (legacyData) {
              console.log("Migrating DB from localStorage to IndexedDB...");
              await idbHelper.saveSnapshot(legacyData);
              localStorage.removeItem(STORAGE_KEY_DB_LEGACY); // Clear legacy to free up space
              savedDb = legacyData;
          }
      } catch (e) {
          console.warn("Legacy migration check failed", e);
      }

      // 2. Check IndexedDB
      if (!savedDb) {
          savedDb = await idbHelper.getSnapshot();
      }
      
      if (savedDb === this.lastLoadedSnapshot && this.db) {
          return;
      }

      if (savedDb) {
        const binaryArray = this.base64ToUint8Array(savedDb);
        this.db = new SQL.Database(binaryArray);
        this.lastLoadedSnapshot = savedDb;
      } else {
        this.db = new SQL.Database();
        this.createTables();
        this.save(null); // Initial save
      }
  }

  private seedData() {
      if (!this.db) return;
      
      // Check if users exist
      try {
          const res = this.db.exec("SELECT count(*) FROM users");
          const count = res[0].values[0][0];
          
          if (count === 0) {
              console.log("Seeding Database with Mock Data...");
              
              // Seed Users
              SEED_USERS.forEach(u => this.set('users', 'email', u.email, u));
              
              // Seed Posts
              SEED_POSTS.forEach(p => this.set('posts', 'id', p.id, p, { timestamp: p.timestamp }));
              
              // Seed Groups
              SEED_GROUPS.forEach(g => this.set('groups', 'id', g.id, g));
              
              // Seed Marketplace
              SEED_ITEMS.forEach(i => this.set('marketplace', 'id', i.id, i, { timestamp: i.timestamp }));
              
              console.log("Database Seeded Successfully. Enjoy offline mode!");
          }
      } catch (e) {
          console.error("Seeding failed", e);
      }
  }

  public async reload() {
      if (!this.isReady) return;
      
      // Check if IDB has newer version
      const currentStorage = await idbHelper.getSnapshot();
      if (currentStorage && currentStorage !== this.lastLoadedSnapshot) {
          try {
              // @ts-ignore
              const SQL = await window.initSqlJs({
                locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
              });
              
              const binaryArray = this.base64ToUint8Array(currentStorage);
              this.db = new SQL.Database(binaryArray);
              this.lastLoadedSnapshot = currentStorage;
          } catch (e) {
              console.error("Error reloading DB", e);
          }
      }
  }

  private createTables() {
    // Document Store approach with Indexes
    const schemas = [
      `CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, timestamp INTEGER, data TEXT)`,
      `CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts (timestamp DESC)`,
      `CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, timestamp INTEGER, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS relationships (id TEXT PRIMARY KEY, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS vip_access (id TEXT PRIMARY KEY, user_email TEXT, group_id TEXT, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS user_psych_profile (user_email TEXT PRIMARY KEY, racionalidade INTEGER, impulsividade INTEGER, humor INTEGER, social INTEGER, ambicao INTEGER, last_updated INTEGER)`,
      `CREATE TABLE IF NOT EXISTS user_permissions (user_email TEXT PRIMARY KEY, analysis_enabled INTEGER)`,
      `CREATE TABLE IF NOT EXISTS marketplace (id TEXT PRIMARY KEY, timestamp INTEGER, data TEXT)`,
      `CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY, timestamp INTEGER, data TEXT)`
    ];

    schemas.forEach(sql => this.db.run(sql));
  }

  // Save and Broadcast
  private save(changedTable: TableName | null = null) {
    if (!this.db) return;
    
    // Export logic remains synchronous to ensure state consistency
    const data = this.db.export();
    const base64 = this.uint8ArrayToBase64(data);
    
    if (base64 !== this.lastLoadedSnapshot) {
        this.lastLoadedSnapshot = base64;
        
        // Fire-and-forget save to IndexedDB (Async)
        idbHelper.saveSnapshot(base64).then(() => {
            if (changedTable) {
                this.channel.postMessage({ type: 'DB_UPDATE', table: changedTable });
            }
        }).catch(err => console.error("Failed to save to IDB", err));

        if (changedTable) {
            // Notify local listeners immediately for optimistic UI update
            this.notifyListeners(changedTable);
        }
    }
  }

  // --- Pub/Sub System ---
  public subscribe(table: TableName | 'all', callback: Listener) {
      if (!this.listeners.has(table)) {
          this.listeners.set(table, new Set());
      }
      this.listeners.get(table)!.add(callback);
      
      // Return unsubscribe function
      return () => {
          const set = this.listeners.get(table);
          if (set) set.delete(callback);
      };
  }

  private notifyListeners(table: string) {
      // Notify listeners specific to the table
      if (this.listeners.has(table)) {
          this.listeners.get(table)!.forEach(cb => cb());
      }
      // Notify generic listeners
      if (this.listeners.has('all')) {
          this.listeners.get('all')!.forEach(cb => cb());
      }
  }

  // --- Queries ---

  public exec(sql: string, params: any[] = []) {
    if (!this.isReady || !this.db) return [];
    return this.db.exec(sql, params);
  }

  public getAll<T>(table: string, limit: number = -1): T[] {
    if (!this.isReady || !this.db) return [];
    try {
      const query = limit > 0 ? `SELECT data FROM ${table} LIMIT ?` : `SELECT data FROM ${table}`;
      const params = limit > 0 ? [limit] : [];
      const res = this.db.exec(query, params);
      if (res.length === 0) return [];
      return res[0].values.map((row: any[]) => JSON.parse(row[0]));
    } catch (e) { return []; }
  }

  public getCursorPaginated<T>(table: string, limit: number, cursor?: number): T[] {
      if (!this.isReady || !this.db) return [];
      try {
          let sql = `SELECT data FROM ${table}`;
          let params: any[] = [];
          if (cursor) {
              sql += ` WHERE timestamp < ? ORDER BY timestamp DESC LIMIT ?`;
              params = [cursor, limit];
          } else {
              sql += ` ORDER BY timestamp DESC LIMIT ?`;
              params = [limit];
          }
          const res = this.db.exec(sql, params);
          if (res.length === 0) return [];
          return res[0].values.map((row: any[]) => JSON.parse(row[0]));
      } catch (e) {
          return [];
      }
  }

  public getOne<T>(table: string, keyCol: string, keyVal: string | number): T | undefined {
    if (!this.isReady || !this.db) return undefined;
    try {
      const stmt = this.db.prepare(`SELECT data FROM ${table} WHERE ${keyCol} = :val`);
      const result = stmt.getAsObject({ ':val': keyVal });
      stmt.free();
      if (result && result.data) return JSON.parse(result.data);
      return undefined;
    } catch (e) { return undefined; }
  }

  public set(table: TableName, keyCol: string, keyVal: string | number, data: any, extraCols?: {[key:string]: any}) {
    if (!this.isReady || !this.db) return;
    const json = JSON.stringify(data);
    let cols = `${keyCol}, data`;
    let placeholders = `?, ?`;
    let params = [keyVal, json];
    if (extraCols) {
        for(const [k, v] of Object.entries(extraCols)) {
            cols += `, ${k}`;
            placeholders += `, ?`;
            params.push(v);
        }
    }
    try {
        this.db.run(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`, params);
        this.save(table);
    } catch(e) { console.error(e); }
  }

  public delete(table: TableName, keyCol: string, keyVal: string | number) {
    if (!this.isReady || !this.db) return;
    this.db.run(`DELETE FROM ${table} WHERE ${keyCol} = ?`, [keyVal]);
    this.save(table);
  }

  // Specialized methods
  public getProfile(email: string) {
      if (!this.isReady || !this.db) return null;
      try {
          const stmt = this.db.prepare(`SELECT * FROM user_psych_profile WHERE user_email = :val`);
          const result = stmt.getAsObject({ ':val': email });
          stmt.free();
          return result && result.user_email ? result : null;
      } catch { return null; }
  }

  public saveProfile(email: string, profile: any) {
      if (!this.isReady || !this.db) return;
      this.db.run(`INSERT OR REPLACE INTO user_psych_profile (user_email, racionalidade, impulsividade, humor, social, ambicao, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [email, profile.racionalidade, profile.impulsividade, profile.humor, profile.social, profile.ambicao, Date.now()]);
      this.save(null); 
  }

  public getPermission(email: string): boolean {
      if (!this.isReady || !this.db) return false;
      try {
          const stmt = this.db.prepare(`SELECT analysis_enabled FROM user_permissions WHERE user_email = :val`);
          const result = stmt.getAsObject({ ':val': email });
          stmt.free();
          return result && result.analysis_enabled === 1;
      } catch { return false; }
  }

  public setPermission(email: string, enabled: boolean) {
      if (!this.isReady || !this.db) return;
      this.db.run(`INSERT OR REPLACE INTO user_permissions (user_email, analysis_enabled) VALUES (?, ?)`, [email, enabled ? 1 : 0]);
      this.save(null);
  }

  private uint8ArrayToBase64(u8: Uint8Array): string {
    let binary = '';
    const len = u8.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(u8[i]); }
    return window.btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); }
    return bytes;
  }
}

const sqlite = new SQLiteDB();

export const db = {
  refresh: async () => { await sqlite.reload(); },
  subscribe: (table: TableName | 'all', callback: Listener) => sqlite.subscribe(table, callback),
  
  users: {
    getAll: (limit: number = 100): Record<string, User> => {
      const usersList = sqlite.getAll<User>('users', limit);
      return usersList.reduce((acc, user) => { acc[user.email] = user; return acc; }, {} as Record<string, User>);
    },
    saveAll: (data: Record<string, User>) => { Object.values(data).forEach(user => sqlite.set('users', 'email', user.email, user)); },
    get: (email: string): User | undefined => sqlite.getOne<User>('users', 'email', email),
    set: (user: User) => sqlite.set('users', 'email', user.email, user),
    exists: (email: string): boolean => !!sqlite.getOne('users', 'email', email)
  },
  posts: {
    getAll: (): Post[] => sqlite.getAll<Post>('posts', 100), 
    getCursorPaginated: (limit: number, cursor?: number): Post[] => sqlite.getCursorPaginated<Post>('posts', limit, cursor),
    saveAll: (data: Post[]) => { data.forEach(post => sqlite.set('posts', 'id', post.id, post, { timestamp: post.timestamp })); },
    add: (post: Post) => sqlite.set('posts', 'id', post.id, post, { timestamp: post.timestamp }),
    update: (post: Post) => sqlite.set('posts', 'id', post.id, post, { timestamp: post.timestamp }),
    delete: (id: string) => sqlite.delete('posts', 'id', id),
    findById: (id: string): Post | undefined => sqlite.getOne<Post>('posts', 'id', id)
  },
  groups: {
    getAll: (): Group[] => sqlite.getAll<Group>('groups', 100),
    saveAll: (data: Group[]) => { data.forEach(group => sqlite.set('groups', 'id', group.id, group)); },
    add: (group: Group) => sqlite.set('groups', 'id', group.id, group),
    update: (group: Group) => sqlite.set('groups', 'id', group.id, group),
    delete: (id: string) => sqlite.delete('groups', 'id', id),
    findById: (id: string): Group | undefined => sqlite.getOne<Group>('groups', 'id', id)
  },
  chats: {
    getAll: (): Record<string, ChatData> => {
      const chatsList = sqlite.getAll<ChatData>('chats', 100);
      return chatsList.reduce((acc, chat) => { acc[chat.id] = chat; return acc; }, {} as Record<string, ChatData>);
    },
    saveAll: (data: Record<string, ChatData>) => { Object.values(data).forEach(chat => sqlite.set('chats', 'id', chat.id, chat)); },
    get: (id: string): ChatData | undefined => sqlite.getOne<ChatData>('chats', 'id', id),
    set: (chat: ChatData) => sqlite.set('chats', 'id', chat.id, chat)
  },
  notifications: {
    getAll: (): NotificationItem[] => sqlite.getAll<NotificationItem>('notifications', 50),
    saveAll: (data: NotificationItem[]) => { data.forEach(notif => sqlite.set('notifications', 'id', notif.id, notif, { timestamp: notif.timestamp })); },
    add: (item: NotificationItem) => sqlite.set('notifications', 'id', item.id, item, { timestamp: item.timestamp }),
    delete: (id: number) => sqlite.delete('notifications', 'id', id)
  },
  relationships: {
    getAll: (): Relationship[] => sqlite.getAll<Relationship>('relationships', 1000),
    // Fix: Changed followerEmail to followerId
    saveAll: (data: Relationship[]) => { data.forEach(rel => { const id = `${rel.followerId}_${rel.followingUsername}`; sqlite.set('relationships', 'id', id, rel); }); },
    // Fix: Changed followerEmail to followerId
    add: (rel: Relationship) => { const id = `${rel.followerId}_${rel.followingUsername}`; sqlite.set('relationships', 'id', id, rel); },
    // Fix: Changed followerEmail to followerId
    remove: (followerId: string, followingUsername: string) => { const id = `${followerId}_${followingUsername}`; sqlite.delete('relationships', 'id', id); }
  },
  vipAccess: {
      grant: (access: VipAccess) => { const id = `${access.userId}_${access.groupId}`; sqlite.set('vip_access', 'id', id, access, { user_email: access.userId, group_id: access.groupId }); },
      check: (userId: string, groupId: string): boolean => { const id = `${userId}_${groupId}`; const access = sqlite.getOne<VipAccess>('vip_access', 'id', id); return access?.status === 'active'; }
  },
  marketplace: {
      getAll: (): MarketplaceItem[] => sqlite.getAll<MarketplaceItem>('marketplace', 100),
      add: (item: MarketplaceItem) => sqlite.set('marketplace', 'id', item.id, item, { timestamp: item.timestamp }),
      delete: (id: string) => sqlite.delete('marketplace', 'id', id)
  },
  ads: {
      getAll: (): AdCampaign[] => sqlite.getAll<AdCampaign>('ads', 50),
      add: (ad: AdCampaign) => sqlite.set('ads', 'id', ad.id, ad, { timestamp: ad.timestamp }),
      update: (ad: AdCampaign) => sqlite.set('ads', 'id', ad.id, ad, { timestamp: ad.timestamp }),
      delete: (id: string) => sqlite.delete('ads', 'id', id)
  },
  profile: {
      get: (email: string) => sqlite.getProfile(email),
      update: (email: string, profile: any) => sqlite.saveProfile(email, profile),
      isAnalysisEnabled: (email: string) => sqlite.getPermission(email),
      setAnalysisEnabled: (email: string, enabled: boolean) => sqlite.setPermission(email, enabled)
  },
  auth: {
    currentUserEmail: (): string | null => localStorage.getItem(STORAGE_KEY_SESSION),
    setCurrentUserEmail: (email: string) => localStorage.setItem(STORAGE_KEY_SESSION, email),
    clearSession: () => localStorage.removeItem(STORAGE_KEY_SESSION),
    getSession: (email: string): VerificationSession | null => { try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSIONS) || '{}'); return data[email] || null; } catch { return null; } },
    saveSession: (email: string, session: VerificationSession) => { const data = JSON.parse(localStorage.getItem(STORAGE_KEY_SESSIONS) || '{}'); data[email] = session; localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(data)); },
    getLockout: (email: string): LockoutState => { try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY_LOCKOUTS) || '{}'); return data[email] || { attempts: 0, blockedUntil: null }; } catch { return { attempts: 0, blockedUntil: null }; } },
    saveLockout: (email: string, state: LockoutState) => { const data = JSON.parse(localStorage.getItem(STORAGE_KEY_LOCKOUTS) || '{}'); data[email] = state; localStorage.setItem(STORAGE_KEY_LOCKOUTS, JSON.stringify(data)); }
  }
};
