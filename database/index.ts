
import { User, Post, Group, NotificationItem, Relationship, ChatData, VerificationSession, LockoutState, VipAccess, MarketplaceItem, AdCampaign } from '../types';

// --- Constants ---
const STORAGE_KEY_SESSION = 'app_current_user_email';
const STORAGE_KEY_SESSIONS = 'app_verification_sessions';
const STORAGE_KEY_LOCKOUTS = 'app_lockouts';

type TableName = 'users' | 'posts' | 'groups' | 'chats' | 'notifications' | 'relationships' | 'vip_access' | 'profile' | 'marketplace' | 'ads';
type Listener = () => void;

/**
 * MemoryDB: In-Memory Storage
 * Acts as a volatile cache for data fetched from the PostgreSQL backend.
 * Replaces the previous SQLite/IndexedDB implementation to ensure
 * no stale local data persists across sessions/reloads.
 */
class MemoryDB {
    private tables: Map<string, Map<string, any>>;
    private listeners: Map<string, Set<Listener>>;

    constructor() {
        this.tables = new Map();
        this.listeners = new Map();
        
        const tableNames: TableName[] = ['users', 'posts', 'groups', 'chats', 'notifications', 'relationships', 'vip_access', 'profile', 'marketplace', 'ads'];
        tableNames.forEach(t => this.tables.set(t, new Map()));
    }

    public subscribe(table: TableName | 'all', callback: Listener) {
        if (!this.listeners.has(table)) {
            this.listeners.set(table, new Set());
        }
        this.listeners.get(table)!.add(callback);
        return () => {
            const set = this.listeners.get(table);
            if (set) set.delete(callback);
        };
    }

    private notify(table: string) {
        if (this.listeners.has(table)) {
            this.listeners.get(table)!.forEach(cb => cb());
        }
        if (this.listeners.has('all')) {
            this.listeners.get('all')!.forEach(cb => cb());
        }
    }

    public set(table: TableName, id: string | number, data: any) {
        if (!this.tables.has(table)) this.tables.set(table, new Map());
        this.tables.get(table)!.set(String(id), data);
        this.notify(table);
    }

    public get(table: TableName, id: string | number) {
        return this.tables.get(table)?.get(String(id));
    }

    public getAll<T>(table: TableName): T[] {
        if (!this.tables.has(table)) return [];
        return Array.from(this.tables.get(table)!.values());
    }

    public delete(table: TableName, id: string | number) {
        if (this.tables.get(table)?.delete(String(id))) {
            this.notify(table);
        }
    }

    // Specialized Logic mimics SQL filtering
    public getCursorPaginated<T extends { timestamp: number }>(table: TableName, limit: number, cursor?: number): T[] {
        let items = this.getAll<T>(table);
        // Sort DESC by timestamp
        items.sort((a, b) => b.timestamp - a.timestamp);
        
        if (cursor) {
            items = items.filter(i => i.timestamp < cursor);
        }
        return items.slice(0, limit);
    }
}

const memory = new MemoryDB();

export const db = {
    refresh: async () => { 
        // No-op: In-memory DB doesn't need reload from disk. 
        // Data is refreshed via API calls in services.
    },
    subscribe: (table: TableName | 'all', callback: Listener) => memory.subscribe(table, callback),

    users: {
        getAll: (limit: number = 100) => {
            const users = memory.getAll<User>('users');
            const limited = users.slice(0, limit);
            return limited.reduce((acc, user) => { acc[user.email] = user; return acc; }, {} as Record<string, User>);
        },
        saveAll: (data: Record<string, User>) => { Object.values(data).forEach(u => memory.set('users', u.email, u)); },
        get: (email: string) => memory.get('users', email),
        set: (user: User) => memory.set('users', user.email, user),
        exists: (email: string) => !!memory.get('users', email)
    },
    
    posts: {
        getAll: () => memory.getAll<Post>('posts'),
        getCursorPaginated: (limit: number, cursor?: number) => memory.getCursorPaginated<Post>('posts', limit, cursor),
        saveAll: (data: Post[]) => { data.forEach(p => memory.set('posts', p.id, p)); },
        add: (post: Post) => memory.set('posts', post.id, post),
        update: (post: Post) => memory.set('posts', post.id, post),
        delete: (id: string) => memory.delete('posts', id),
        findById: (id: string) => memory.get('posts', id)
    },

    groups: {
        getAll: () => memory.getAll<Group>('groups'),
        saveAll: (data: Group[]) => { data.forEach(g => memory.set('groups', g.id, g)); },
        add: (group: Group) => memory.set('groups', group.id, group),
        update: (group: Group) => memory.set('groups', group.id, group),
        delete: (id: string) => memory.delete('groups', id),
        findById: (id: string) => memory.get('groups', id)
    },

    chats: {
        getAll: () => {
            const chats = memory.getAll<ChatData>('chats');
            return chats.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, ChatData>);
        },
        saveAll: (data: Record<string, ChatData>) => { Object.values(data).forEach(c => memory.set('chats', c.id, c)); },
        get: (id: string) => memory.get('chats', id),
        set: (chat: ChatData) => memory.set('chats', chat.id, chat)
    },

    notifications: {
        getAll: () => memory.getAll<NotificationItem>('notifications'),
        saveAll: (data: NotificationItem[]) => { data.forEach(n => memory.set('notifications', n.id, n)); },
        add: (item: NotificationItem) => memory.set('notifications', item.id, item),
        delete: (id: number) => memory.delete('notifications', id)
    },

    relationships: {
        getAll: () => memory.getAll<Relationship>('relationships'),
        // Fix: Changed followerEmail to followerId
        saveAll: (data: Relationship[]) => { data.forEach(r => memory.set('relationships', `${r.followerId}_${r.followingUsername}`, r)); },
        // Fix: Changed followerEmail to followerId
        add: (rel: Relationship) => memory.set('relationships', `${rel.followerId}_${rel.followingUsername}`, rel),
        // Fix: Changed followerEmail to followerId
        remove: (followerId: string, followingUsername: string) => memory.delete('relationships', `${followerId}_${followingUsername}`)
    },

    vipAccess: {
        grant: (access: VipAccess) => memory.set('vip_access', `${access.userId}_${access.groupId}`, access),
        check: (userId: string, groupId: string) => {
            const access = memory.get('vip_access', `${userId}_${groupId}`);
            return access?.status === 'active';
        },
        get: (userId: string, groupId: string) => memory.get('vip_access', `${userId}_${groupId}`)
    },

    marketplace: {
        getAll: () => memory.getAll<MarketplaceItem>('marketplace'),
        add: (item: MarketplaceItem) => memory.set('marketplace', item.id, item),
        delete: (id: string) => memory.delete('marketplace', id)
    },

    ads: {
        getAll: () => memory.getAll<AdCampaign>('ads'),
        add: (ad: AdCampaign) => memory.set('ads', ad.id, ad),
        update: (ad: AdCampaign) => memory.set('ads', ad.id, ad),
        delete: (id: string) => memory.delete('ads', id)
    },

    profile: {
        get: (email: string) => memory.get('profile', email),
        update: (email: string, profile: any) => memory.set('profile', email, profile),
        isAnalysisEnabled: (email: string) => memory.get('profile', `${email}_permissions`)?.analysis_enabled,
        setAnalysisEnabled: (email: string, enabled: boolean) => memory.set('profile', `${email}_permissions`, { analysis_enabled: enabled })
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
