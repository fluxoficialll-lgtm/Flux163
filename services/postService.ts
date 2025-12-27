
import { Post, Comment, PaginatedResponse } from '../types';
import { API_BASE } from '../apiConfig';
import { db } from '@/database';
import { authService } from './authService';

const API_URL = `${API_BASE}/api/posts`;

const sanitizePost = (post: any): Post => {
    const likedByIds = Array.isArray(post.likedByIds) ? post.likedByIds : [];
    const currentUserId = authService.getCurrentUserId();

    return {
        ...post,
        id: String(post.id),
        text: String(post.text || ""),
        authorId: String(post.authorId || post.author_id || ""),
        username: String(post.username || "Anônimo"),
        likes: Number(post.likes || 0),
        comments: Number(post.comments || 0),
        views: Number(post.views || 0),
        liked: currentUserId ? likedByIds.includes(currentUserId) : !!post.liked
    };
};

export const postService = {
  formatRelativeTime: (ts: number) => {
      const diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 60) return 'Agora';
      if (diff < 3600) return `${Math.floor(diff/60)}m`;
      if (diff < 86400) return `${Math.floor(diff/3600)}h`;
      return new Date(ts).toLocaleDateString();
  },

  getFeedPaginated: async (options: any): Promise<PaginatedResponse<Post>> => {
    try {
        const response = await fetch(`${API_URL}?limit=${options.limit}&cursor=${options.cursor || ''}`);
        const data = await response.json();
        const safePosts = (data.data || []).map(sanitizePost);
        db.posts.saveAll(safePosts);
        return { data: safePosts, nextCursor: data.nextCursor };
    } catch (e) {
        return { data: db.posts.getAll().map(sanitizePost), nextCursor: undefined };
    }
  },

  uploadMedia: async (file: File, folder: string = 'feed'): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      return data.files[0].url;
  },

  addPost: async (post: Post) => {
    const currentUserId = authService.getCurrentUserId();
    if (currentUserId) post.authorId = currentUserId;
    await fetch(`${API_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
    });
    db.posts.add(sanitizePost(post));
  },

  toggleLike: async (postId: string) => {
      const userId = authService.getCurrentUserId();
      if (!userId) return;
      await fetch(`${API_URL}/${postId}/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'like', userId })
      });
      const post = db.posts.findById(postId);
      if (post) {
          post.liked = !post.liked;
          post.likes += post.liked ? 1 : -1;
          db.posts.update(post);
          return sanitizePost(post);
      }
  },

  incrementView: (id: string) => {
      const userId = authService.getCurrentUserId();
      fetch(`${API_URL}/${id}/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'view', userId })
      }).catch(() => {});
  },

  getPostById: (id: string) => {
      const post = db.posts.findById(id);
      return post ? sanitizePost(post) : undefined;
  },

  getUserPosts: (username: string) => {
      return db.posts.getAll().filter(p => p.username === username).map(sanitizePost);
  },

  deletePost: async (id: string) => {
      db.posts.delete(id);
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  },

  addComment: async (postId: string, text: string, username: string, avatar?: string) => {
      const userId = authService.getCurrentUserId();
      if (!userId) return;
      const newComment: Comment = { id: Date.now().toString(), userId, text, username, avatar, timestamp: Date.now() };
      const post = db.posts.findById(postId);
      if (post) {
          post.commentsList = [newComment, ...(post.commentsList || [])];
          post.comments++;
          db.posts.update(post);
      }
      return newComment;
  },

  deleteComment: async (postId: string, commentId: string) => {
      const post = db.posts.findById(postId);
      if (post) {
          post.commentsList = post.commentsList?.filter(c => c.id !== commentId);
          post.comments--;
          db.posts.update(post);
          return true;
      }
      return false;
  },

  // Fix: Added missing incrementShare method
  incrementShare: (postId: string, userEmail?: string) => {
      const userId = authService.getCurrentUserId();
      fetch(`${API_URL}/${postId}/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'share', userId })
      }).catch(() => {});
  },

  // Fix: Added missing addReply method
  addReply: (postId: string, commentId: string, text: string, username: string, avatar?: string): Comment | undefined => {
      const userId = authService.getCurrentUserId();
      if (!userId) return;
      const post = db.posts.findById(postId);
      if (post && post.commentsList) {
          const newReply: Comment = { id: Date.now().toString(), userId, text, username, avatar, timestamp: Date.now(), likes: 0, likedByMe: false };
          const findAndAddReply = (comments: Comment[]): boolean => {
              for (const c of comments) {
                  if (c.id === commentId) {
                      c.replies = [...(c.replies || []), newReply];
                      return true;
                  }
                  if (c.replies && findAndAddReply(c.replies)) return true;
              }
              return false;
          };
          if (findAndAddReply(post.commentsList)) {
              post.comments++;
              db.posts.update(post);
              return newReply;
          }
      }
      return undefined;
  },

  // Fix: Added missing toggleCommentLike method
  toggleCommentLike: (postId: string, commentId: string): boolean => {
      const post = db.posts.findById(postId);
      if (post && post.commentsList) {
          const findAndToggle = (comments: Comment[]): boolean => {
              for (const c of comments) {
                  if (c.id === commentId) {
                      c.likedByMe = !c.likedByMe;
                      c.likes = (c.likes || 0) + (c.likedByMe ? 1 : -1);
                      return true;
                  }
                  if (c.replies && findAndToggle(c.replies)) return true;
              }
              return false;
          };
          if (findAndToggle(post.commentsList)) {
              db.posts.update(post);
              return true;
          }
      }
      return false;
  }
};
