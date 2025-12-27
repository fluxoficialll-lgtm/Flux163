
import { MarketplaceItem, Comment, User } from '../types';
import { db } from '@/database';
import { adService } from './adService';
import { API_BASE } from '../apiConfig';

const API_URL = `${API_BASE}/api/marketplace`;

// --- ALGORITHM CONFIGURATION ---
const WEIGHTS = {
    AD_BOOST: 15000,         
    CATEGORY_AFFINITY: 800,  
    LOCATION_MATCH: 3000,    
    POPULARITY_MULTIPLIER: 50, 
    FRESHNESS_DECAY: 1.2     
};

// Session-based User Profile
interface UserInterestProfile {
    categoryHits: Record<string, number>;
    topLocation: string | null;
    locationHits: Record<string, number>;
}

const userProfiles: Record<string, UserInterestProfile> = {};

const getProfile = (email: string): UserInterestProfile => {
    if (!userProfiles[email]) {
        userProfiles[email] = { categoryHits: {}, topLocation: null, locationHits: {} };
    }
    return userProfiles[email];
};

const calculateScore = (item: MarketplaceItem, email?: string): number => {
    let score = 1000; 
    const now = Date.now();

    if (item.isAd) score += WEIGHTS.AD_BOOST;
    if (item.soldCount) score += (item.soldCount * WEIGHTS.POPULARITY_MULTIPLIER);
    const hoursOld = (now - item.timestamp) / (1000 * 60 * 60);
    score -= (hoursOld * 20); 

    if (email) {
        const profile = getProfile(email);
        const catHits = profile.categoryHits[item.category] || 0;
        score += (catHits * WEIGHTS.CATEGORY_AFFINITY);
        const locHits = profile.locationHits[item.location] || 0;
        if (locHits > 0 || (profile.topLocation && item.location.includes(profile.topLocation))) {
            score += WEIGHTS.LOCATION_MATCH;
        }
    }
    return score;
};

export const marketplaceService = {
  getRecommendedItems: (userEmail?: string): MarketplaceItem[] => {
    // 1. Tenta buscar dados novos (Async mas não await para não travar UI, usa cache primeiro)
    marketplaceService.fetchItems().catch(console.error);

    // 2. Retorna dados do Cache Local (imediato)
    const allItems = db.marketplace.getAll();
    
    // Algorithm
    const scoredItems = allItems.map(item => ({
        item,
        score: calculateScore(item, userEmail)
    }));

    scoredItems.sort((a, b) => b.score - a.score);
    const sortedOrganic = scoredItems.map(x => x.item);

    // Ads
    const activeAds = adService.getAdsForPlacement('marketplace') as MarketplaceItem[];
    
    if (activeAds.length > 0) {
        const finalFeed: MarketplaceItem[] = [];
        sortedOrganic.forEach((item, index) => {
            finalFeed.push(item);
            if ((index + 1) % 5 === 0) {
                const randomAd = activeAds[Math.floor(Math.random() * activeAds.length)];
                if (!finalFeed.find(i => i.id === randomAd.id)) {
                    finalFeed.push(randomAd);
                }
            }
        });
        return finalFeed;
    }

    return sortedOrganic;
  },

  // Busca real no servidor
  fetchItems: async (): Promise<void> => {
      try {
          const response = await fetch(API_URL);
          if (response.ok) {
              const data = await response.json();
              if (data.data) {
                  data.data.forEach((item: MarketplaceItem) => db.marketplace.add(item));
              }
          }
      } catch(e) {
          console.warn("Marketplace offline mode");
      }
  },

  getItems: (): MarketplaceItem[] => {
    return db.marketplace.getAll().sort((a, b) => b.timestamp - a.timestamp);
  },

  getItemById: (id: string): MarketplaceItem | undefined => {
    if (id.startsWith('ad_')) {
        const campaignId = id.replace('ad_', '');
        const allAds = adService.getAdsForPlacement('marketplace') as MarketplaceItem[];
        return allAds.find(i => i.adCampaignId === campaignId);
    }
    return db.marketplace.getAll().find(item => item.id === id);
  },
  
  createItem: async (item: MarketplaceItem) => {
    try {
        const response = await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        
        if (response.ok) {
            db.marketplace.add(item);
        } else {
            throw new Error("Erro no servidor");
        }
    } catch (e) {
        console.error("Failed to create product:", e);
        throw e;
    }
  },
  
  deleteItem: async (id: string) => {
    // 1. Delete Locally
    db.marketplace.delete(id);
    // 2. Delete on Server
    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
    } catch (e) {
        console.error("Failed to delete product on server:", e);
    }
  },

  trackView: (item: MarketplaceItem, userEmail: string) => {
      if (item.isAd && item.adCampaignId) {
          adService.trackMetric(item.adCampaignId, 'click');
      }
      const profile = getProfile(userEmail);
      profile.categoryHits[item.category] = (profile.categoryHits[item.category] || 0) + 1;
      if (item.location) {
          profile.locationHits[item.location] = (profile.locationHits[item.location] || 0) + 1;
          if (!profile.topLocation || profile.locationHits[item.location] > profile.locationHits[profile.topLocation]) {
              profile.topLocation = item.location;
          }
      }
  },

  addComment: (itemId: string, text: string, user: User): Comment | undefined => {
      if (itemId.startsWith('ad_')) return undefined;

      const all = db.marketplace.getAll();
      const itemIndex = all.findIndex(i => i.id === itemId);
      
      if (itemIndex > -1) {
          const item = all[itemIndex];
          // Fix: Added missing userId
          const newComment: Comment = {
              id: Date.now().toString(),
              userId: user.id,
              text: text,
              username: user.profile?.name ? `@${user.profile.name}` : 'Usuário',
              avatar: user.profile?.photoUrl,
              timestamp: Date.now(),
              likes: 0
          };
          item.comments = [...(item.comments || []), newComment];
          db.marketplace.add(item); 
          // Persist to server
          marketplaceService.createItem(item).catch(console.error);
          return newComment;
      }
      return undefined;
  },

  deleteComment: async (itemId: string, commentId: string) => {
      const item = marketplaceService.getItemById(itemId);
      if (item && item.comments) {
          item.comments = item.comments.filter(c => c.id !== commentId);
          db.marketplace.add(item);
          try {
              await fetch(`${API_URL}/${itemId}/comments/${commentId}`, {
                  method: 'DELETE'
              });
          } catch (e) {
              console.error("Failed to delete marketplace comment on server", e);
          }
          return true;
      }
      return false;
  }
};
