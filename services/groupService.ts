
import { Group, User, GroupLink } from '../types';
import { db } from '@/database';
import { authService } from './authService';
import { API_BASE } from '../apiConfig';

const API_URL = `${API_BASE}/api/groups`;

export const groupService = {
    fetchGroups: async (): Promise<Group[]> => {
        try {
            const response = await fetch(API_URL);
            if (response.ok) {
                const data = await response.json();
                db.groups.saveAll(data.data || []);
            }
        } catch (e) { }
        return db.groups.getAll();
    },

    getGroupsSync: (): Group[] => db.groups.getAll(),

    getGroupsPaginated: (offset: number, limit: number) => {
        const currentId = authService.getCurrentUserId();
        const myGroups = db.groups.getAll().filter(g => g.memberIds?.includes(currentId || ''));
        return { groups: myGroups.slice(offset, offset + limit), hasMore: offset + limit < myGroups.length };
    },

    getAllGroupsForRanking: async () => {
        const res = await fetch(`${API_URL}`);
        const data = await res.json();
        return data.data || [];
    },

    getGroupById: (id: string) => db.groups.findById(id),

    fetchGroupById: async (id: string) => {
        const res = await fetch(`${API_URL}/${id}`);
        const data = await res.json();
        return data.group;
    },

    createGroup: async (group: Group) => {
        const userId = authService.getCurrentUserId();
        if (userId) group.creatorId = userId;
        await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(group)
        });
        db.groups.add(group);
    },

    updateGroup: async (group: Group) => {
        db.groups.update(group);
        await fetch(`${API_URL}/${group.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(group)
        });
    },

    deleteGroup: async (id: string) => {
        db.groups.delete(id);
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    },

    // Fix: Enhanced joinGroup to return more detailed statuses
    joinGroup: (groupId: string): 'joined' | 'pending' | 'full' | 'banned' | 'error' => {
        const userId = authService.getCurrentUserId();
        const group = db.groups.findById(groupId);
        if (!userId || !group) return 'error';
        
        if (group.memberIds?.includes(userId)) return 'joined';
        if (group.bannedUserIds?.includes(userId)) return 'banned';
        
        if (group.settings?.memberLimit && (group.memberIds?.length || 0) >= group.settings.memberLimit) {
            return 'full';
        }

        if (group.isPrivate || group.settings?.approveMembers) {
            group.pendingMemberIds = [...(group.pendingMemberIds || []), userId];
            groupService.updateGroup(group);
            return 'pending';
        }

        group.memberIds = [...(group.memberIds || []), userId];
        groupService.updateGroup(group);
        return 'joined';
    },

    // Fix: Updated checkVipStatus to include expired and grace_period logic
    checkVipStatus: (groupId: string, userId: string): 'active' | 'none' | 'expired' | 'grace_period' => {
        const access = db.vipAccess.get(userId, groupId);
        if (!access) return 'none';
        if (access.status === 'active') {
            if (access.expiresAt && Date.now() > access.expiresAt) {
                // If within 24h of expiry, call it grace period for UI
                if (Date.now() - access.expiresAt < 24 * 60 * 60 * 1000) return 'grace_period';
                return 'expired';
            }
            return 'active';
        }
        return 'none';
    },

    getGroupMembers: (groupId: string) => {
        const group = db.groups.findById(groupId);
        if (!group) return [];
        return Object.values(db.users.getAll()).filter(u => group.memberIds?.includes(u.id));
    },

    getPendingMembers: (groupId: string) => {
        const group = db.groups.findById(groupId);
        if (!group) return [];
        return Object.values(db.users.getAll()).filter(u => group.pendingMemberIds?.includes(u.id));
    },

    // Fix: Updated addGroupLink with more params
    addGroupLink: (groupId: string, name: string, maxUses?: number, expiresAt?: string) => {
        const group = db.groups.findById(groupId);
        if (!group) return null;
        const link: GroupLink = { 
            id: Date.now().toString(), 
            name, 
            code: Math.random().toString(36).substr(2, 6).toUpperCase(), 
            joins: 0, 
            createdAt: Date.now(),
            maxUses,
            expiresAt
        };
        group.links = [link, ...(group.links || [])];
        groupService.updateGroup(group);
        return link;
    },

    // Fix: Added missing removeGroupLink method
    removeGroupLink: (groupId: string, linkId: string) => {
        const group = db.groups.findById(groupId);
        if (group && group.links) {
            group.links = group.links.filter(l => l.id !== linkId);
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing removeMember method
    removeMember: (groupId: string, userId: string) => {
        const group = db.groups.findById(groupId);
        if (group) {
            group.memberIds = group.memberIds?.filter(id => id !== userId);
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing banMember method
    banMember: (groupId: string, userId: string) => {
        const group = db.groups.findById(groupId);
        if (group) {
            group.memberIds = group.memberIds?.filter(id => id !== userId);
            group.bannedUserIds = [...(group.bannedUserIds || []), userId];
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing promoteMember method
    promoteMember: (groupId: string, userId: string) => {
        const group = db.groups.findById(groupId);
        if (group) {
            group.adminIds = [...(group.adminIds || []), userId];
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing demoteMember method
    demoteMember: (groupId: string, userId: string) => {
        const group = db.groups.findById(groupId);
        if (group) {
            group.adminIds = group.adminIds?.filter(id => id !== userId);
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing approveMember method
    approveMember: (groupId: string, userId: string) => {
        const group = db.groups.findById(groupId);
        if (group) {
            group.pendingMemberIds = group.pendingMemberIds?.filter(id => id !== userId);
            group.memberIds = [...(group.memberIds || []), userId];
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing rejectMember method
    rejectMember: (groupId: string, userId: string) => {
        const group = db.groups.findById(groupId);
        if (group) {
            group.pendingMemberIds = group.pendingMemberIds?.filter(id => id !== userId);
            groupService.updateGroup(group);
        }
    },

    // Fix: Added missing leaveGroup method
    leaveGroup: async (groupId: string) => {
        const userId = authService.getCurrentUserId();
        if (userId) {
            groupService.removeMember(groupId, userId);
        }
    },

    // Fix: Added missing joinGroupByLinkCode method
    joinGroupByLinkCode: (code: string): { success: boolean; message: string; groupId?: string } => {
        const allGroups = db.groups.getAll();
        for (const g of allGroups) {
            const link = g.links?.find(l => l.code === code);
            if (link) {
                if (link.maxUses && link.joins >= link.maxUses) return { success: false, message: "Este link atingiu o limite de usos." };
                if (link.expiresAt && Date.now() > new Date(link.expiresAt).getTime()) return { success: false, message: "Este link expirou." };
                
                const res = groupService.joinGroup(g.id);
                if (res === 'joined') {
                    link.joins++;
                    groupService.updateGroup(g);
                    return { success: true, message: "Você entrou no grupo!", groupId: g.id };
                }
                return { success: false, message: "Erro ao entrar no grupo." };
            }
        }
        return { success: false, message: "Código inválido." };
    }
};
