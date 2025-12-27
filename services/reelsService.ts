
import { Post, Comment } from '../types';
import { db } from '@/database';
import { recommendationService } from './recommendationService';
import { postService } from './postService';
import { chatService } from './chatService';
import { authService } from './authService';
import { adService } from './adService';

export const reelsService = {
  getReels: (userEmail?: string, allowAdultContent: boolean = false): Post[] => {
    const allPosts = db.posts.getAll();
    let videos = allPosts.filter(p => p.type === 'video');

    if (!allowAdultContent) {
        videos = videos.filter(p => !p.isAdultContent);
    }

    if (userEmail) {
        // Fix: Added missing getBlockedIdentifiers check
        const blockedIds = chatService.getBlockedIdentifiers(userEmail);
        if (blockedIds.size > 0) {
            videos = videos.filter(p => {
                const handle = p.username.replace('@', '');
                return !blockedIds.has(p.username) && !blockedIds.has(handle);
            });
        }
    }

    let sortedVideos: Post[] = [];
    if (userEmail && videos.length > 0) {
        sortedVideos = recommendationService.getRecommendedReels(videos, userEmail);
    } else {
        sortedVideos = videos.sort((a, b) => b.timestamp - a.timestamp);
    }

    const activeAds = adService.getAdsForPlacement('reels') as Post[];
    if (activeAds.length > 0) {
        const injectedReels: Post[] = [];
        sortedVideos.forEach((reel, index) => {
            injectedReels.push(reel);
            if ((index + 1) % 4 === 0) {
                const randomAd = activeAds[Math.floor(Math.random() * activeAds.length)];
                if(!injectedReels.find(p => p.id === randomAd.id)) {
                    injectedReels.push(randomAd);
                }
            }
        });
        return injectedReels;
    }

    return sortedVideos;
  },

  getReelsByAuthor: (authorHandle: string, allowAdultContent: boolean = false): Post[] => {
    const allPosts = db.posts.getAll();
    // Filtra exclusivamente por vídeos do autor específico
    let videos = allPosts.filter(p => p.type === 'video' && p.username === authorHandle);

    if (!allowAdultContent) {
        videos = videos.filter(p => !p.isAdultContent);
    }

    // Ordena por data (mais recentes primeiro) para manter a ordem do perfil
    return videos.sort((a, b) => b.timestamp - a.timestamp);
  },

  searchReels: (query: string, category: 'relevant' | 'recent' | 'watched' | 'unwatched' | 'liked', userEmail?: string): Post[] => {
      const allPosts = db.posts.getAll();
      let videos = allPosts.filter(p => p.type === 'video');

      const term = query.toLowerCase().trim();

      videos = videos.filter(reel => {
          if (userEmail) {
              // Fix: Added missing getBlockedIdentifiers check
              const blockedIds = chatService.getBlockedIdentifiers(userEmail);
              const handle = reel.username.replace('@', '');
              if (blockedIds.has(reel.username) || blockedIds.has(handle)) return false;
          }

          if (category === 'watched') {
              if (!userEmail) return false;
              // Fix: Changed viewedBy to viewedByIds
              if (!reel.viewedByIds || !reel.viewedByIds.includes(userEmail)) return false;
          }
          if (category === 'unwatched') {
              // Fix: Changed viewedBy to viewedByIds
              if (userEmail && reel.viewedByIds && reel.viewedByIds.includes(userEmail)) return false;
          }
          if (category === 'liked') {
              // Fix: Changed likedBy to likedByIds
              if (!reel.liked && (!reel.likedByIds || (userEmail && !reel.likedByIds.includes(userEmail)))) return false;
          }

          if (term) {
              const textMatch = reel.text?.toLowerCase().includes(term);
              const titleMatch = reel.title?.toLowerCase().includes(term);
              const userMatch = reel.username?.toLowerCase().includes(term);
              return textMatch || titleMatch || userMatch;
          }

          return true;
      });

      if (category === 'relevant') {
          const scored = videos.map(reel => {
              let score = 0;

              if (term) {
                  const title = reel.title?.toLowerCase() || '';
                  const text = reel.text?.toLowerCase() || '';
                  const user = reel.username?.toLowerCase() || '';

                  if (title === term) score += 200; 
                  else if (title.includes(term)) score += 100; 
                  else if (user.includes(term)) score += 80; 
                  else if (text.includes(term)) score += 40; 
              } else {
                  score += 100;
              }

              const behavioralScore = userEmail ? recommendationService.scorePost(reel, userEmail) : 0;
              const totalScore = (score * 50) + behavioralScore;

              return { reel, totalScore };
          });

          scored.sort((a, b) => b.totalScore - a.totalScore);
          return scored.map(s => s.reel);
      } 
      
      return videos.sort((a, b) => b.timestamp - a.timestamp);
  },

  /**
   * Upload de vídeo com organização automática
   */
  uploadVideo: async (file: File): Promise<string> => {
      // Contexto específico para Reels
      return postService.uploadMedia(file, 'reels');
  },

  addReel: (reel: Post) => {
    const newReel = { ...reel, type: 'video' as const };
    const allPosts = db.posts.getAll();
    const isDuplicate = allPosts.some(existing => {
        if (existing.type === 'video' && existing.video && existing.video === newReel.video) {
            return true;
        }
        return false;
    });

    if (isDuplicate) return;
    postService.addPost(newReel);
  },

  toggleLike: async (reelId: string): Promise<Post | undefined> => {
    // Reels are technically posts, delegating to postService ensures 
    // local DB update AND server interaction are correctly handled.
    return await postService.toggleLike(reelId);
  },

  incrementView: (reelId: string) => {
    // Fix: incrementView expects only 1 arg
    postService.incrementView(reelId);
    recommendationService.trackImpression(reelId);
  },

  getReelById: (id: string): Post | undefined => {
    if (id.startsWith('ad_')) {
        return postService.getPostById(id);
    }
    const reels = reelsService.getReels();
    return reels.find(r => r.id === id);
  }
};
