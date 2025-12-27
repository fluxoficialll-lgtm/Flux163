
import { Relationship, User } from '../types';
import { authService } from './authService';
import { db } from '@/database';
import { API_BASE } from '../apiConfig';

const API_URL = `${API_BASE}/api/relationships`;

export const relationshipService = {
  followUser: async (targetHandle: string): Promise<'following' | 'requested'> => {
    const currentId = authService.getCurrentUserId();
    const targetUser = authService.getUserByHandle(targetHandle);
    if (!currentId || !targetUser) throw new Error("Context error");

    const rel: Relationship = { followerId: currentId, followingId: targetUser.id, followingUsername: targetHandle, status: 'accepted' };
    await fetch(`${API_URL}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rel)
    });
    db.relationships.add(rel);
    return 'following';
  },

  unfollowUser: async (targetHandle: string) => {
    const currentId = authService.getCurrentUserId();
    const targetUser = authService.getUserByHandle(targetHandle);
    if (!currentId || !targetUser) return;
    await fetch(`${API_URL}/unfollow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: currentId, followingId: targetUser.id })
    });
    db.relationships.remove(currentId, targetUser.id);
  },

  isFollowing: (targetHandle: string): 'none' | 'following' | 'requested' => {
    const currentId = authService.getCurrentUserId();
    const targetUser = authService.getUserByHandle(targetHandle);
    if (!currentId || !targetUser) return 'none';
    const rel = db.relationships.getAll().find(r => r.followerId === currentId && r.followingId === targetUser.id);
    return rel ? (rel.status === 'accepted' ? 'following' : 'requested') : 'none';
  },

  getFollowers: (username: string) => {
    const targetUser = authService.getUserByHandle(username);
    if (!targetUser) return [];
    const rels = db.relationships.getAll().filter(r => r.followingId === targetUser.id && r.status === 'accepted');
    const allUsers = db.users.getAll();
    return rels.map(r => {
        const u = allUsers[r.followerId];
        return { name: u?.profile?.nickname || u?.profile?.name || 'User', username: u?.profile?.name || 'user', avatar: u?.profile?.photoUrl };
    });
  },

  getFollowing: (userId: string) => {
    const rels = db.relationships.getAll().filter(r => r.followerId === userId && r.status === 'accepted');
    const allUsers = db.users.getAll();
    return rels.map(r => {
        const u = allUsers[r.followingId];
        return { name: u?.profile?.nickname || u?.profile?.name || 'User', username: u?.profile?.name || 'user', avatar: u?.profile?.photoUrl };
    });
  },

  getMutualFriends: async () => {
      const userId = authService.getCurrentUserId();
      if (!userId) return [];
      const following = db.relationships.getAll().filter(r => r.followerId === userId && r.status === 'accepted');
      const followers = db.relationships.getAll().filter(r => r.followingId === userId && r.status === 'accepted');
      const mutualIds = following.filter(f => followers.some(fol => fol.followerId === f.followingId)).map(f => f.followingId);
      const allUsers = db.users.getAll();
      return mutualIds.map(id => {
          const u = allUsers[id];
          return { id, name: u?.profile?.nickname || u?.profile?.name || '', username: u?.profile?.name || '', avatar: u?.profile?.photoUrl || '' };
      });
  },

  getTopCreators: async () => {
      const res = await fetch(`${API_BASE}/api/rankings/top`);
      const data = await res.json();
      return data.data || [];
  },

  // Fix: Added missing acceptFollowRequest method
  acceptFollowRequest: async (targetHandle: string) => {
      const currentId = authService.getCurrentUserId();
      const targetUser = authService.getUserByHandle(targetHandle);
      if (!currentId || !targetUser) return;
      const rel = db.relationships.getAll().find(r => r.followerId === targetUser.id && r.followingId === currentId);
      if (rel) {
          rel.status = 'accepted';
          db.relationships.add(rel);
      }
  },

  // Fix: Added missing rejectFollowRequest method
  rejectFollowRequest: async (targetHandle: string) => {
      const currentId = authService.getCurrentUserId();
      const targetUser = authService.getUserByHandle(targetHandle);
      if (!currentId || !targetUser) return;
      db.relationships.remove(targetUser.id, currentId);
  }
};
