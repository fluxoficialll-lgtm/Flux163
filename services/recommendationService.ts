
import { db } from '@/database';
import { Post } from '../types';
import { groupService } from './groupService'; // Import group logic

// --- Configurações do Algoritmo "Smart Discovery" (Calibrado v3 - Precision Tuning) ---
const WEIGHTS = {
    AUTHOR_AFFINITY: 800,    
    VIRAL_BOOST: 20,         
    FRESHNESS_DECAY: 2.5,    
    WATCH_TIME_WEIGHT: 150,  
    SKIP_PENALTY: 200,       
    
    // --- VIP SALES ENGINE (Balanced for Precision) ---
    // Base reduzida para não ofuscar amigos, mas alta o suficiente para ser relevante
    VIP_CONTENT_BOOST: 3000,      
    
    // Se o usuário está online AGORA, a chance de venda é alta
    HOT_LEAD_BONUS: 10000,        
    
    // A regra de ouro: Se eu sigo, eu vejo. (Peso massivo)
    INTEREST_CLUSTER_MATCH: 25000,
    
    SOCIAL_PROOF_BOOST: 100,       
    
    // O "Empurrão" para furar a bolha de desconhecidos (apenas se for bom/novo)
    DISCOVERY_BONUS: 15000,

    // 1. Limiter de Frequência (Penalidade Alta)
    FREQUENCY_PENALTY: 50000 
};

// Cache de Sessão para Afinidades
let sessionAffinityCache: Record<string, number> = {}; 

// Cache de Sessão para Impressões (Visualizações nesta sessão)
let sessionPostImpressions: Record<string, number> = {};

export const recommendationService = {
    
    isAnalysisEnabled: (email: string) => true,
    setAnalysisEnabled: (email: string, enabled: boolean) => {},

    /**
     * Registra que um post foi visualizado/exibido na sessão atual.
     */
    trackImpression: (postId: string) => {
        sessionPostImpressions[postId] = (sessionPostImpressions[postId] || 0) + 1;
    },

    /**
     * REGISTRA INTERAÇÃO
     */
    recordInteraction: (userEmail: string, post: Post, type: 'view_time' | 'like' | 'comment' | 'share', value?: number) => {
        const authorKey = `author:${post.username}`;
        if (!sessionAffinityCache[authorKey]) sessionAffinityCache[authorKey] = 0;

        let scoreBoost = 0;

        switch (type) {
            case 'view_time':
                if (value) {
                    if (value < 1.5) scoreBoost -= WEIGHTS.SKIP_PENALTY;
                    else if (value > 5) scoreBoost += (value * WEIGHTS.WATCH_TIME_WEIGHT * 2);
                    else scoreBoost += (value * WEIGHTS.WATCH_TIME_WEIGHT);
                }
                break;
            case 'like': scoreBoost += 500; break;
            case 'comment': scoreBoost += 1000; break;
            case 'share': scoreBoost += 2000; break;
        }

        sessionAffinityCache[authorKey] += scoreBoost;
    },

    /**
     * CÁLCULO DE SCORE (Precision Delivery Logic)
     */
    scorePost: (post: Post, userEmail: string): number => {
        let score = 1000; 
        const now = Date.now();

        // 1. Métricas de Qualidade do Criativo
        const engagementScore = (post.likes * 10) + (post.comments * 20) + (post.views * 1);
        const hasTraction = engagementScore > 50; // O post já provou que é bom?

        // Fator Idade do Post (Horas)
        const ageInHours = Math.max(0, (now - post.timestamp) / (1000 * 60 * 60));

        // --- LÓGICA DE RELACIONAMENTO (O Filtro Principal) ---
        const user = db.users.get(userEmail);
        const creatorHandle = post.username.replace('@', '').toLowerCase();
        const relationships = db.relationships.getAll();
        
        // Fix: Changed followerEmail to followerId and used user email for comparison if possible
        const isFollower = relationships.some(r => 
            (r.followerId === user?.id || r.followingUsername === userEmail) && 
            r.followingUsername === creatorHandle && 
            r.status === 'accepted'
        );

        // Se segue, garante o topo.
        if (isFollower) {
            score += WEIGHTS.INTEREST_CLUSTER_MATCH;
        }

        // --- LÓGICA VIP & VENDAS ---
        if (post.relatedGroupId) {
            const group = db.groups.findById(post.relatedGroupId);
            
            if (group && group.isVip && user) {
                let vipBoost = WEIGHTS.VIP_CONTENT_BOOST;

                // A. Hot Lead (Comprador Ativo)
                const lastSeen = user.lastSeen || 0;
                const minutesSinceActive = (now - lastSeen) / (1000 * 60); 
                
                if (minutesSinceActive < 5) { // Janela de oportunidade curta (5min)
                    score += WEIGHTS.HOT_LEAD_BONUS; 
                }

                // B. Lógica de Descoberta (Para quem NÃO segue)
                if (!isFollower) {
                    if (ageInHours < 12) {
                        // "Fresh Test": Post novo ganha chance de aparecer
                        vipBoost += (WEIGHTS.DISCOVERY_BONUS * 0.4);
                    } 
                    else if (hasTraction) {
                        // "Viral Hit": Post provado ganha alcance máximo
                        vipBoost += WEIGHTS.DISCOVERY_BONUS;
                    } 
                    else {
                        // "Dead Ad": Velho e ruim. Penalidade severa para não poluir.
                        vipBoost = 0; 
                        score -= 5000; 
                    }
                }

                // Prova Social
                const memberCount = group.memberIds?.length || 0;
                if (memberCount > 10) score += (memberCount * WEIGHTS.SOCIAL_PROOF_BOOST);

                score += vipBoost;
            }
        }

        // 2. Fator Afinidade Pessoal (Sessão atual)
        const authorKey = `author:${post.username}`;
        const affinity = sessionAffinityCache[authorKey] || 0;
        if (affinity !== 0) score += (affinity * 1.0); 

        // 3. Fator Viralidade (Global)
        score += Math.log(engagementScore + 1) * 100 * WEIGHTS.VIRAL_BOOST;

        // 4. Fator Novidade (Decaimento)
        const freshnessPenalty = Math.pow(ageInHours + 1, WEIGHTS.FRESHNESS_DECAY);
        score = score / freshnessPenalty;

        // 5. Anti-Fadiga (Não mostrar repetidamente se não houver interesse)
        // Fix: Changed viewedBy to viewedByIds
        if (post.viewedByIds && post.viewedByIds.includes(userEmail)) {
            // Penalidade mais severa para anúncios repetidos
            const isAd = post.isAd || (post.relatedGroupId && db.groups.findById(post.relatedGroupId)?.isVip);
            score = score * (isAd ? 0.5 : 0.3);
        }

        // 6. Limiter de Frequência (Sessão Atual)
        const sessionViews = sessionPostImpressions[post.id] || 0;
        if (sessionViews >= 3) {
            score -= WEIGHTS.FREQUENCY_PENALTY; // Força rotatividade
        }

        return score;
    },

    /**
     * FEED DE REELS
     */
    getRecommendedReels: (reels: Post[], userEmail: string): Post[] => {
        if (!userEmail) return reels.sort(() => 0.5 - Math.random());

        // Calcular scores iniciais
        let scoredReels = reels.map(reel => ({
            reel, 
            score: recommendationService.scorePost(reel, userEmail),
            isGlobalViral: (reel.views > 1000) 
        }));

        // Ordenar por score descendente
        scoredReels.sort((a, b) => b.score - a.score);

        const viralInjectionPool = scoredReels.filter(i => i.isGlobalViral).sort(() => 0.5 - Math.random());
        const finalFeed: Post[] = [];
        let viralPoolIndex = 0;
        let consecutiveVipCount = 0;

        // Construir feed com lógica Anti-Saturação
        // Usamos uma cópia da lista classificada para processar
        let queue = [...scoredReels];

        while (queue.length > 0) {
            let selectedIndex = 0;
            let currentItem = queue[selectedIndex];
            let isVip = !!(currentItem.reel.relatedGroupId && db.groups.findById(currentItem.reel.relatedGroupId)?.isVip);

            // 2. Penalidade por Saturação Global
            if (isVip && consecutiveVipCount >= 2) {
                // Aplica redução progressiva de boost (20% por extra)
                // Ex: 3º VIP seguido = score * 0.8
                const penaltyFactor = 1 - (0.2 * (consecutiveVipCount - 1)); 
                const effectiveScore = currentItem.score * Math.max(0.1, penaltyFactor);

                // Verificar se o próximo item (não-VIP) tem score maior que o VIP penalizado
                // Procura o primeiro não-VIP na fila
                const nextNonVipIndex = queue.findIndex(item => {
                    const itemIsVip = item.reel.relatedGroupId && db.groups.findById(item.reel.relatedGroupId)?.isVip;
                    return !itemIsVip;
                });

                if (nextNonVipIndex !== -1) {
                    const contender = queue[nextNonVipIndex];
                    if (contender.score > effectiveScore) {
                        // Swap: O não-VIP venceu devido à penalidade de saturação
                        selectedIndex = nextNonVipIndex;
                        currentItem = contender;
                        isVip = false; // Trocamos para um não-VIP
                    }
                }
            }

            // Adicionar ao feed final
            finalFeed.push(currentItem.reel);
            
            // Remover da fila
            queue.splice(selectedIndex, 1);

            // Atualizar contadores
            if (isVip) {
                consecutiveVipCount++;
            } else {
                consecutiveVipCount = 0;
            }

            // Injeção de Viralidade (Mantida da lógica original)
            // A cada 3 posts adicionados, tenta injetar um viral
            if (finalFeed.length % 3 === 0 && viralPoolIndex < viralInjectionPool.length) {
                const viralPick = viralInjectionPool[viralPoolIndex].reel;
                // Verificar se já não está no feed
                if (!finalFeed.includes(viralPick)) {
                    // Remover da fila principal para não duplicar depois
                    const qIndex = queue.findIndex(q => q.reel.id === viralPick.id);
                    if (qIndex !== -1) queue.splice(qIndex, 1);
                    
                    finalFeed.push(viralPick);
                    // Reset vip count se o viral não for VIP (assumindo viral orgânico)
                    const viralIsVip = viralPick.relatedGroupId && db.groups.findById(viralPick.relatedGroupId)?.isVip;
                    if (viralIsVip) consecutiveVipCount++;
                    else consecutiveVipCount = 0;
                }
                viralPoolIndex++;
            }
        }

        return [...new Set(finalFeed)];
    },

    /**
     * FEED PRINCIPAL
     */
    getRecommendedFeed: (posts: Post[], userEmail: string): Post[] => {
        if (!userEmail) return posts.sort((a, b) => b.timestamp - a.timestamp);

        const scoredPosts = posts.map(post => ({
            post,
            score: recommendationService.scorePost(post, userEmail)
        }));

        scoredPosts.sort((a, b) => b.score - a.score);
        return scoredPosts.map(p => p.post);
    },

    analyzeMessage: (email: string, message: string) => {}
};
