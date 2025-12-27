
export interface User {
  id: string; // Immutable unique identifier (UUID)
  email: string;
  password?: string; 
  isVerified: boolean;
  isProfileCompleted: boolean;
  profile?: UserProfile;
  googleId?: string;
  paymentConfig?: PaymentProviderConfig; 
  paymentConfigs?: Record<string, PaymentProviderConfig>;
  notificationSettings?: NotificationSettings; 
  securitySettings?: SecuritySettings; 
  marketingConfig?: MarketingConfig;
  lastSeen?: number; 
  sessions?: UserSession[];
  changeHistory?: ChangeHistory;
  referredById?: string; // ID of the affiliate
  
  // Security System
  strikes?: number;
  isBanned?: boolean;
  banReason?: string;
}

export interface MarketingConfig {
    pixelId?: string;
    pixelToken?: string;
}

export interface ReferredSeller {
    id: string;
    name: string;
    username: string;
    avatar?: string;
    salesCount: number;
    totalGenerated: number;
}

export interface AffiliateSale {
    id: string;
    buyerId: string;
    buyerEmail: string;
    amount: number;
    commission: number;
    timestamp: number;
    sellerName: string;
}

export interface AffiliateStats {
    totalEarned: number;
    totalInvoiced: number;
    referredSellers: ReferredSeller[];
    recentSales: AffiliateSale[];
}

export interface UserSession {
    id: string;
    device: string;
    location: string;
    timestamp: number;
    isActive: boolean;
}

export interface ChangeHistory {
    usernameChanges: number[];
    nicknameChanges: number[];
}

export interface NotificationSettings {
    pauseAll: boolean;
    likes: boolean;
    comments: boolean;
    followers: boolean;
    mentions: boolean;
    messages: boolean;
    groups: boolean;
    marketplace: boolean;
    emailUpdates: boolean;
    emailDigest: boolean;
}

export interface SecuritySettings {
    saveLoginInfo: boolean;
}

export interface UserProfile {
  name: string; // unique, lowercase (@username) - MUTABLE Visual
  nickname?: string; // Display Name (Apelido) - Optional
  bio?: string;
  website?: string;
  photoUrl?: string;
  isPrivate: boolean;
  cpf?: string;
  phone?: string;
  marketingConfig?: MarketingConfig;
}

export interface PaymentProviderConfig {
    providerId: string;
    clientId?: string; 
    clientSecret?: string;
    token?: string;
    isConnected: boolean;
    tokenExpiresAt?: number; 
}

export interface VerificationSession {
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface LockoutState {
  attempts: number;
  blockedUntil: number | null;
}

export interface PollOption {
  text: string;
  votes: number;
}

export interface Comment {
  id: string;
  userId: string; // Immutable
  username: string; // Visual
  avatar?: string;
  text: string;
  timestamp: number;
  likes?: number;
  likedByMe?: boolean;
  replies?: Comment[];
}

export interface Post {
  id: string;
  type: 'photo' | 'poll' | 'text' | 'video';
  authorId: string; // Immutable anchor
  username: string; // Visual @handle
  text: string;
  image?: string;
  images?: string[];
  video?: string;
  avatar?: string;
  isPublic: boolean;
  isAdultContent?: boolean;
  time: string; 
  timestamp: number;
  views: number;
  viewedByIds?: string[]; 
  likes: number;
  likedByIds?: string[]; 
  comments: number;
  liked: boolean;
  pollOptions?: PollOption[];
  votedOptionIndex?: number | null;
  commentsList?: Comment[];
  title?: string;
  location?: string;
  relatedGroupId?: string;
  // Ads Fields
  isAd?: boolean;
  adCampaignId?: string;
  ctaText?: string;
  ctaLink?: string;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  price: number;
  category: string;
  location: string;
  description: string;
  image?: string;
  sellerId: string; // Immutable User ID
  sellerName?: string; // @handle for display
  sellerAvatar?: string;
  timestamp: number;
  comments?: Comment[];
  isAd?: boolean;
  adCampaignId?: string;
  ctaText?: string;
  ctaLink?: string;
  soldCount?: number;
  images?: string[];
  video?: string;
}

export interface Story {
    id: string;
    userId: string;
    username: string;
    userAvatar?: string;
    mediaUrl: string;
    type: 'image' | 'video';
    timestamp: number;
    viewed: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    nextCursor?: number;
}

export interface VipMediaItem {
  url: string;
  type: 'image' | 'video';
}

export interface GroupLink {
  id: string;
  name: string;
  code: string;
  joins: number;
  createdAt: number;
  maxUses?: number;
  expiresAt?: string;
}

export interface GroupSettingsConfig {
    memberLimit?: number;
    onlyAdminsPost?: boolean;
    msgSlowMode?: boolean;
    msgSlowModeInterval?: number;
    approveMembers?: boolean;
    joinSlowMode?: boolean;
    joinSlowModeInterval?: number;
    forbiddenWords?: string[];
}

export interface Group {
  id: string;
  name: string;
  description: string;
  coverImage?: string;
  isVip: boolean;
  isPrivate?: boolean;
  price?: string;
  category?: string;
  currency?: 'BRL' | 'USD' | 'EUR' | 'BTC';
  accessType?: 'lifetime' | 'temporary';
  expirationDate?: string;
  vipDoor?: {
    media?: string;
    mediaType?: 'image' | 'video' | null;
    mediaItems?: VipMediaItem[];
    text?: string;
    buttonText?: string;
  };
  lastMessage?: string;
  time?: string;
  creatorId: string; // Immutable
  creatorEmail?: string; // Legacy/Auth
  links?: GroupLink[];
  
  // Membership and Settings
  memberIds?: string[]; // Array of UUIDs
  pendingMemberIds?: string[];
  bannedUserIds?: string[];
  adminIds?: string[];
  settings?: GroupSettingsConfig;
  status?: 'active' | 'inactive';
  
  // Advanced Marketing
  pixelId?: string;
  pixelToken?: string;
}

export interface NotificationItem {
  id: number;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'sale' | 'pending';
  subtype?: 'friend' | 'group_join' | 'group_invite';
  senderId: string; // Immutable
  username: string; // Visual
  time: string;
  timestamp: number;
  avatar: string;
  text?: string;
  postImage?: string;
  isFollowing?: boolean;
  recipientId: string; // Immutable
  recipientEmail: string; // Auth context
  read: boolean;
}

export interface Relationship {
  followerId: string;
  followingId: string;
  followingUsername: string; // Visual anchor for URLs
  status: 'pending' | 'accepted';
}

export interface ChatMessage {
    id: number;
    text: string;
    type: 'sent' | 'received';
    contentType: 'text' | 'audio' | 'image' | 'video' | 'file';
    mediaUrl?: string;
    fileName?: string;
    
    product?: {
        id: string;
        title: string;
        price: number;
        image?: string;
    };

    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
    duration?: string;
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    senderEmail?: string;
}

export interface ChatData {
    id: string | number;
    contactName: string;
    contactId?: string;
    isBlocked: boolean;
    messages: ChatMessage[];
}

export interface VipAccess {
    userId: string; // Immutable UUID
    groupId: string;
    status: 'active' | 'expired';
    purchaseDate: number;
    expiresAt?: number;
    transactionId: string;
}

export interface SyncPayTransaction {
    identifier: string;
    pixCode: string;
    amount: number;
    status: 'pending' | 'paid' | 'expired' | 'completed' | 'withdrawal';
    buyerId: string;
    sellerId: string;
    groupId: string;
    platformFee: number;
    ownerNet: number;
    timestamp: number;
    pixKey?: string;
}

export interface AdStats {
    views: number;
    clicks: number;
    conversions: number;
}

export interface AdCampaign {
    id: string;
    ownerId: string;
    ownerEmail: string;
    name: string;
    scheduleType: 'date' | 'continuous';
    budget: number;
    trafficObjective: string;
    pricingModel?: 'budget' | 'commission';
    creative: {
        text: string;
        mediaUrl?: string;
        mediaType?: 'image' | 'video';
    };
    campaignObjective: string;
    destinationType: string;
    targetUrl?: string;
    targetGroupId?: string;
    optimizationGoal: string;
    placements: ('feed' | 'reels' | 'marketplace')[];
    ctaButton: string;
    status: 'draft' | 'active' | 'paused' | 'ended';
    timestamp: number;
    stats?: AdStats;
}

export enum AuthError {
  USER_NOT_FOUND = "Gmail não existe",
  WRONG_PASSWORD = "Senha incorreta",
  EMAIL_NOT_VERIFIED = "Verifique seu email",
  INVALID_FORMAT = "Formato inválido",
  ALREADY_EXISTS = "Email já cadastrado",
  PASSWORD_TOO_SHORT = "Senha muito curta",
  PASSWORDS_DONT_MATCH = "Senhas não coincidem",
  TERMS_REQUIRED = "Aceite os termos",
  CODE_INVALID = "Código incorreto",
  CODE_EXPIRED = "Código expirado",
  TOO_MANY_ATTEMPTS = "Muitas tentativas. Bloqueado por 24h.",
  NAME_TAKEN = "Nome indisponível",
  NAME_REQUIRED = "Nome obrigatório",
  GENERIC = "Ocorreu um erro",
  ACCOUNT_BANNED = "🚫 CONTA BANIDA: Violação dos Termos"
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  modelName: string;
  supportsSearch: boolean;
  supportsImages: boolean;
}
