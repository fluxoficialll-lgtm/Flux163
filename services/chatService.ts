
import { db } from '@/database';
import { ChatMessage, ChatData } from '../types';
import { authService } from './authService';
import { API_BASE } from '../apiConfig';

const API_URL = `${API_BASE}/api/chats`;

// Fix: Exporting types needed by other files
export type { ChatMessage, ChatData };

export const chatService = {
    getAllChats: () => db.chats.getAll(),

    syncChats: async () => {
        const email = authService.getCurrentUserEmail();
        if (!email) return;
        const res = await fetch(`${API_URL}/sync?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        data.chats?.forEach((c: any) => db.chats.set(c));
    },

    getPrivateChatId: (id1: string, id2: string) => [id1, id2].sort().join('_'),

    getChat: (id: string): ChatData => {
        let chat = db.chats.get(id);
        if (!chat) {
            chat = { id, contactName: 'Chat', isBlocked: false, messages: [] };
            db.chats.set(chat);
        }
        return chat;
    },

    fetchChatMessages: async (chatId: string, limit: number = 50, beforeId?: number) => {
        const res = await fetch(`${API_URL}/${chatId}?limit=${limit}&before=${beforeId || ''}`);
        const data = await res.json();
        if (data.data) {
            const chat = db.chats.get(chatId) || { id: chatId, contactName: 'Chat', isBlocked: false, messages: [] };
            chat.messages = [...(chat.messages || []), ...data.data].sort((a, b) => a.id - b.id);
            db.chats.set(chat);
        }
    },

    sendMessage: async (chatId: string, message: ChatMessage) => {
        const userId = authService.getCurrentUserId();
        if (userId) message.senderId = userId;
        
        const chat = db.chats.get(chatId);
        if (chat) {
            chat.messages.push(message);
            db.chats.set(chat);
        }

        await fetch(`${API_URL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message })
        });
    },

    getUnreadCount: () => {
        const userId = authService.getCurrentUserId();
        return Object.values(db.chats.getAll()).reduce((acc, chat) => 
            acc + chat.messages.filter(m => m.senderId !== userId && m.status !== 'read').length, 0
        );
    },

    getGroupUnreadCount: (groupId: string) => {
        const chat = db.chats.get(groupId);
        const userId = authService.getCurrentUserId();
        return chat?.messages.filter(m => m.senderId !== userId && m.status !== 'read').length || 0;
    },

    markChatAsRead: (chatId: string) => {
        const chat = db.chats.get(chatId);
        const userId = authService.getCurrentUserId();
        if (chat) {
            chat.messages.forEach(m => { if(m.senderId !== userId) m.status = 'read'; });
            db.chats.set(chat);
        }
    },

    // Fix: Added missing toggleBlock method
    toggleBlock: (chatId: string): boolean => {
        const chat = db.chats.get(chatId);
        if (chat) {
            chat.isBlocked = !chat.isBlocked;
            db.chats.set(chat);
            return chat.isBlocked;
        }
        return false;
    },

    // Fix: Added missing deleteMessages method
    deleteMessages: (chatId: string, messageIds: number[], target: 'me' | 'all' = 'me') => {
        const chat = db.chats.get(chatId);
        if (chat) {
            chat.messages = chat.messages.filter(m => !messageIds.includes(m.id));
            db.chats.set(chat);
        }
    },

    // Fix: Added missing clearChat method
    clearChat: (chatId: string) => {
        const chat = db.chats.get(chatId);
        if (chat) {
            chat.messages = [];
            db.chats.set(chat);
        }
    },

    // Fix: Added missing markAllAsRead method
    markAllAsRead: () => {
        const userId = authService.getCurrentUserId();
        const allChats = db.chats.getAll();
        Object.values(allChats).forEach(chat => {
            chat.messages.forEach(m => { if(m.senderId !== userId) m.status = 'read'; });
            db.chats.set(chat);
        });
    },

    // Fix: Added missing hasBlockingRelationship method
    hasBlockingRelationship: (userId1: string, userId2: string): boolean => {
        const chatId = chatService.getPrivateChatId(userId1, userId2);
        const chat = db.chats.get(chatId);
        return chat?.isBlocked || false;
    },

    // Fix: Added missing toggleBlockByContactName method
    toggleBlockByContactName: (name: string): boolean => {
        const cleanName = name.replace('@', '').toLowerCase();
        const allChats = db.chats.getAll();
        const chat = Object.values(allChats).find(c => c.contactName.toLowerCase() === cleanName);
        if (chat) {
            chat.isBlocked = !chat.isBlocked;
            db.chats.set(chat);
            return chat.isBlocked;
        }
        return false;
    },

    // Fix: Added missing getBlockedIdentifiers method
    getBlockedIdentifiers: (userEmail: string): Set<string> => {
        const allChats = db.chats.getAll();
        const blocked = new Set<string>();
        Object.values(allChats).forEach(chat => {
            if (chat.isBlocked) {
                blocked.add(chat.contactName);
            }
        });
        return blocked;
    }
};
