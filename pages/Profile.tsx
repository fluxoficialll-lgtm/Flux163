import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { relationshipService } from '../services/relationshipService';
import { notificationService } from '../services/notificationService';
import { chatService } from '../services/chatService';
import { marketplaceService } from '../services/marketplaceService';
import { groupService } from '../services/groupService';
import { Post, User, MarketplaceItem, Group } from '../types';
import { db } from '@/database';
import { ImageCarousel } from '../components/ImageCarousel';
import { GroupAttachmentCard } from '../components/GroupAttachmentCard';
import { useModal } from '../components/ModalSystem';
import { PostHeader } from '../components/PostHeader';
import { PostText } from '../components/PostText';

// --- Helper: Format Numbers ---
const formatNumber = (num: number): string => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
};

interface SimpleUserList {
    name: string;
    username: string;
    avatar?: string;
}

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState('posts');
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myProducts, setMyProducts] = useState<MarketplaceItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  
  // Followers/Following States
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const [followListData, setFollowListData] = useState<SimpleUserList[]>([]);

  // Notification Badges
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  // Check for Tab in navigation state
  useEffect(() => {
      if (location.state && (location.state as any).activeTab) {
          setActiveTab((location.state as any).activeTab);
      }
  }, [location.state]);

  const loadProfileData = () => {
      const userEmail = authService.getCurrentUserEmail();
      if (!userEmail) return;

      const currentUser = authService.getCurrentUser();
      setUser(currentUser);

      const username = currentUser?.profile?.name ? `@${currentUser.profile.name}` : "@usuario";
      
      const storedPosts = postService.getUserPosts(username) || [];
      setMyPosts(storedPosts.sort((a, b) => b.timestamp - a.timestamp));

      const storedProducts = marketplaceService.getItems().filter(i => i.sellerId === userEmail) || [];
      setMyProducts(storedProducts.sort((a, b) => b.timestamp - a.timestamp));

      if (currentUser && currentUser.profile && currentUser.profile.name) {
          const followers = relationshipService.getFollowers(currentUser.profile.name);
          setFollowersCount(followers.length);
      }
      if (currentUser && currentUser.email) {
          const following = relationshipService.getFollowing(currentUser.email);
          setFollowingCount(following.length);
      }
  };

  useEffect(() => {
    const userEmail = authService.getCurrentUserEmail();
    if (!userEmail) {
      navigate('/');
      return;
    }
    
    loadProfileData();

    const unsubscribe = db.subscribe('posts', () => {
        loadProfileData();
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
      const updateCounts = () => {
          setUnreadNotifs(notificationService.getUnreadCount());
          setUnreadMsgs(chatService.getUnreadCount());
      };
      updateCounts();
      const unsubNotif = db.subscribe('notifications', updateCounts);
      const unsubChat = db.subscribe('chats', updateCounts);
      
      return () => { unsubNotif(); unsubChat(); };
  }, []);

  const deletePost = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm(
        "Excluir Post", 
        "Tem certeza que deseja excluir este post permanentemente?",
        "Excluir",
        "Cancelar"
    );

    if (confirmed) {
        await postService.deletePost(postId);
    }
  };

  const handleLike = (id: string) => {
    setMyPosts(prev => prev.map(post => {
      if (post.id === id) {
        const newLiked = !post.liked;
        return {
          ...post,
          liked: newLiked,
          likes: post.likes + (newLiked ? 1 : -1)
        };
      }
      return post;
    }));
    postService.toggleLike(id);
  };

  const handleShowFollowList = (type: 'followers' | 'following') => {
      if (!user) return;
      
      let list: SimpleUserList[] = [];
      if (type === 'followers' && user.profile?.name) {
          list = relationshipService.getFollowers(user.profile.name);
      } else if (type === 'following' && user.email) {
          list = relationshipService.getFollowing(user.email);
      }
      
      setFollowListData(list);
      setFollowListType(type);
  };

  const closeFollowList = () => {
      setFollowListType(null);
      setFollowListData([]);
  };

  const navigateToUserProfile = (username: string) => {
      closeFollowList();
      const clean = username.replace('@', '');
      navigate(`/user/${clean}`);
  };

  const formatPrice = (val: number) => {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleShare = async (post: Post) => {
      const url = `${window.location.origin}/#/post/${post.id}`;
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `Post de ${post.username}`,
                  text: (post.text || '').substring(0, 100),
                  url: url
              });
          } catch (err) {
              console.error('Share failed:', err);
          }
      } else {
          navigator.clipboard.writeText(url);
          alert('Link copiado para a área de transferência!');
      }
  };

  const handleUserClick = (username: string) => {
    const cleanName = username.startsWith('@') ? username.substring(1) : username;
    navigate(`/user/${cleanName}`);
  };

  // Display Name Logic
  const username = user?.profile?.name ? `@${user.profile.name}` : "@usuario";
  const nickname = user?.profile?.nickname || user?.profile?.name; 
  const displayBio = user?.profile?.bio || "Sem biografia definida.";
  const displayAvatar = user?.profile?.photoUrl;
  const displayWebsite = user?.profile?.website;

  const textPosts = Array.isArray(myPosts) ? myPosts.filter(p => p.type === 'text' || p.type === 'poll') : [];
  const photoPosts = Array.isArray(myPosts) ? myPosts.filter(p => p.type === 'photo' && (p.image || (p.images && p.images.length > 0))) : [];
  const reelPosts = Array.isArray(myPosts) ? myPosts.filter(p => p.type === 'video') : [];

  return (
    <div className="profile-page h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
      
      <style>{`
        header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px; background: #0c0f14; position: fixed;
            width: 100%; top: 0; z-index: 50; border-bottom: 1px solid rgba(255,255,255,0.1);
            height: 65px;
        }
        header button {
            background: none; border: none; color: #00c2ff; font-size: 20px; cursor: pointer; padding: 5px;
        }

        main {
            flex-grow: 1; overflow-y: auto; padding-top: 80px; padding-bottom: 100px;
        }

        .profile-card-box {
            background: rgba(30, 35, 45, 0.6);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 30px 20px;
            width: 90%;
            max-width: 400px;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 0 auto 20px auto;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            position: relative;
            overflow: hidden;
        }

        .profile-avatar {
            width: 100px; height: 100px; border-radius: 50%; object-fit: cover;
            border: 4px solid #00c2ff; margin-bottom: 15px; 
            box-shadow: 0 0 25px rgba(0,194,255,0.3);
            z-index: 2;
            background: #1e2531;
        }
        .profile-avatar-placeholder {
            width: 100px; height: 100px; border-radius: 50%;
            border: 4px solid #00c2ff; margin-bottom: 15px;
            background: #1e2531; display: flex; align-items: center; justify-content: center;
            font-size: 40px; color: #00c2ff; box-shadow: 0 0 25px rgba(0,194,255,0.3);
        }
        
        .profile-nickname { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 2px; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
        .profile-handle { font-size: 14px; color: #00c2ff; margin-bottom: 15px; font-weight: 500; }
        
        .profile-stats-container {
            display: flex; justify-content: space-around; width: 100%;
            margin: 20px 0; border-top: 1px solid rgba(255,255,255,0.1);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding: 15px 0;
        }
        .stat-box { display: flex; flex-direction: column; align-items: center; cursor: pointer; flex: 1; }
        .stat-value { font-size: 18px; font-weight: 800; color: #fff; }
        .stat-label { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
        
        .profile-bio { 
            font-size: 14px; color: #e0e0e0; text-align: center; line-height: 1.5; 
            margin-bottom: 15px; max-width: 90%;
        }
        .profile-link { 
            font-size: 13px; color: #00c2ff; text-decoration: none; 
            display: flex; align-items: center; gap: 5px; 
            background: rgba(0,194,255,0.1); padding: 5px 12px; border-radius: 20px;
        }
        
        .profile-actions { display: flex; gap: 10px; width: 100%; justify-content: center; margin-top: 10px; }
        .profile-actions button {
            flex: 1; max-width: 140px; padding: 12px; border-radius: 12px; font-weight: 700; font-size: 14px;
            border: none; cursor: pointer; transition: 0.2s; background: #1e2531; color: #fff; border: 1px solid #555;
        }
        .profile-actions button:hover { background: #28303f; }

        .tab-nav {
            display: flex; border-bottom: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 15px; background: #0c0f14;
        }
        .tab-nav button {
            flex: 1; padding: 15px 0; background: none; border: none; color: #aaa;
            font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent;
        }
        .tab-nav button.active { color: #fff; border-bottom: 2px solid #00c2ff; }

        .post-list { padding: 0 10px; display: flex; flex-direction: column; gap: 15px; }
        
        .products-grid {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 10px;
        }
        .product-card {
            background: #1a1e26; border-radius: 8px; overflow: hidden; cursor: pointer;
        }
        .product-img-container img { width: 100%; aspect-ratio: 1; object-fit: cover; }
        .product-info { padding: 10px; }
        .product-info h4 { font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .product-price { color: #00ff82; font-size: 12px; font-weight: 700; }
        .product-location { font-size: 10px; color: #888; }
        .product-actions { display: none; }

        .gallery-grid {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
        }
        .gallery-item { position: relative; aspect-ratio: 9/16; cursor: pointer; background: #000; }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        .reel-icon {
            position: absolute; bottom: 5px; left: 5px; color: #fff; font-size: 12px;
            display: flex; align-items: center; gap: 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        }

        .no-content { text-align: center; color: #666; padding: 30px 0; font-size: 14px; width: 100%; }

        footer {
            position: fixed; bottom: 0; left: 0; width: 100%; background: #0c0f14;
            display: flex; justify-content: space-around; padding: 14px 0;
            border-top-left-radius: 20px; border-top-right-radius: 20px;
            z-index: 40; box-shadow: 0 -2px 10px rgba(0,0,0,0.5);
        }
        footer button {
            background: none; border: none; color: #00c2ff; font-size: 22px; cursor: pointer;
            padding: 8px; transition: 0.3s;
        }
        footer button:hover { color: #fff; transform: translateY(-2px); }
        footer button.active {
             color: #fff;
             background: rgba(0,194,255,0.1);
        }

        .follow-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center;
        }
        .follow-modal {
            background: #1a1e26; width: 90%; max-width: 350px; border-radius: 12px;
            height: 70vh; display: flex; flex-direction: column; overflow: hidden;
        }
        .follow-header {
            padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;
        }
        .follow-header h3 { font-size: 16px; font-weight: 600; margin: 0; color: #fff; }
        .close-modal-btn { background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; }
        .follow-list { flex-grow: 1; overflow-y: auto; }
        .follow-item {
            display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;
        }
        .follow-item:hover { background: rgba(255,255,255,0.05); }
        .f-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 12px; background: #333; display: flex; align-items: center; justify-content: center; color: #555; }
        .f-info { display: flex; flex-direction: column; }
        .f-name { font-size: 14px; font-weight: 600; color: #fff; }
        .f-username { font-size: 12px; color: #888; }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-[#0c0f14] w-full z-30 border-b border-white/10 h-[80px] shrink-0 relative">
        <button onClick={() => navigate('/rank')} className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white transition-colors"><i className="fa-solid fa-trophy"></i></button>
        
        <div 
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <button className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white transition-colors" style={{marginLeft:'auto'}} onClick={() => navigate('/settings')}>
            <i className="fa-solid fa-gear"></i>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full overflow-y-auto">
        <div style={{width:'100%', maxWidth:'600px', margin:'0 auto', paddingTop:'10px', paddingBottom: '100px'}}>
            
            <div className="profile-card-box">
                {displayAvatar ? (
                    <img src={displayAvatar} className="profile-avatar" alt="Avatar do Usuário" />
                ) : (
                    <div className="profile-avatar-placeholder">
                        <i className="fa-solid fa-user"></i>
                    </div>
                )}
                
                <h1 className="profile-nickname">{nickname}</h1>
                <p className="profile-handle">{username}</p>
                
                <div className="profile-stats-container">
                    <div className="stat-box">
                        <span className="stat-value">{myPosts.length}</span> <span className="stat-label">Posts</span>
                    </div>
                    <div className="stat-box" onClick={() => handleShowFollowList('followers')}>
                        <span className="stat-value">{followersCount}</span>
                        <span className="stat-label">Seguidores</span>
                    </div>
                    <div className="stat-box" onClick={() => handleShowFollowList('following')}>
                        <span className="stat-value">{followingCount}</span>
                        <span className="stat-label">Seguindo</span>
                    </div>
                </div>

                <p className="profile-bio">
                    {displayBio}
                </p>

                {displayWebsite && (
                    <a 
                        href={displayWebsite} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="profile-link"
                    >
                        <i className="fa-solid fa-link"></i> {displayWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                )}
                
                <div className="profile-actions">
                    <button id="editProfileBtn" onClick={() => navigate('/edit-profile')}>
                        <i className="fa-solid fa-pen"></i> Editar Perfil
                    </button>
                    <button id="shareProfileBtn" onClick={() => alert('Compartilhar o perfil do usuário')}>
                        <i className="fa-solid fa-share-nodes"></i> Compartilhar
                    </button>
                </div>
            </div>

            <div className="profile-tabs-container">
                <nav className="tab-nav">
                    <button 
                        className={activeTab === 'posts' ? 'active' : ''} 
                        onClick={() => setActiveTab('posts')}
                    >
                        <i className="fa-solid fa-list-ul"></i> Posts
                    </button>
                    
                    {myProducts.length > 0 && (
                        <button 
                            className={activeTab === 'products' ? 'active' : ''} 
                            onClick={() => setActiveTab('products')}
                        >
                            <i className="fa-solid fa-store"></i> Produtos
                        </button>
                    )}

                    <button 
                        className={activeTab === 'fotos' ? 'active' : ''} 
                        onClick={() => setActiveTab('fotos')}
                    >
                        <i className="fa-solid fa-camera"></i> Fotos
                    </button>
                    <button 
                        className={activeTab === 'reels' ? 'active' : ''} 
                        onClick={() => setActiveTab('reels')}
                    >
                        <i className="fa-solid fa-video"></i> Reels
                    </button>
                </nav>

                <div className="tab-content">
                    {activeTab === 'posts' && (
                        <div className="post-list animate-fade-in">
                            {textPosts.length > 0 ? textPosts.map(post => {
                                if (!post) return null;
                                return (
                                    <div key={post.id} className="relative bg-[#1a1e26] border border-white/5 rounded-2xl pb-2 mb-5 shadow-lg overflow-hidden text-left">
                                        <PostHeader 
                                            username={post.username} 
                                            time={postService.formatRelativeTime(post.timestamp)} 
                                            location={post.location}
                                            isAdult={post.isAdultContent}
                                            isAd={post.isAd}
                                            onClick={() => {}}
                                            isOwner={true}
                                            onDelete={(e) => deletePost(post.id, e)}
                                        />

                                        <PostText text={post.text || ""} onUserClick={handleUserClick} />
                                        
                                        {post.relatedGroupId && (
                                            <GroupAttachmentCard groupId={post.relatedGroupId} />
                                        )}

                                        <div className="grid grid-cols-4 px-2 py-3 mt-2 border-t border-white/5 gap-1">
                                            <button 
                                                onClick={() => handleLike(post.id)}
                                                className={`flex items-center justify-center gap-1.5 transition-all ${post.liked ? 'text-red-500' : 'text-gray-400 hover:text-[#00c2ff]'}`}
                                            >
                                                <i className={`${post.liked ? 'fa-solid' : 'fa-regular'} fa-heart text-lg`}></i>
                                                <span className="text-xs font-semibold">{formatNumber(post.likes)}</span>
                                            </button>
                                            
                                            <button 
                                                onClick={() => navigate(`/post/${post.id}`)}
                                                className="flex items-center justify-center gap-1.5 text-gray-400 hover:text-[#00c2ff] transition-all"
                                            >
                                                <i className="fa-regular fa-comment text-lg"></i>
                                                <span className="text-xs font-semibold">{formatNumber(post.comments)}</span>
                                            </button>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                                                className="flex items-center justify-center text-gray-400 hover:text-[#00c2ff] transition-all"
                                            >
                                                <i className="fa-regular fa-paper-plane text-lg"></i>
                                            </button>

                                            <div className="flex items-center justify-center gap-1.5 text-gray-400 transition-all cursor-default">
                                                <i className="fa-solid fa-eye text-lg"></i>
                                                <span className="text-xs font-semibold">{formatNumber(post.views)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="no-content">Você ainda não tem posts de texto.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'products' && (
                        <div className="products-grid animate-fade-in">
                            {myProducts.length > 0 ? myProducts.map(product => (
                                <div key={product.id} className="product-card" onClick={() => navigate(`/marketplace/product/${product.id}`)}>
                                    <div className="product-img-container">
                                        <img src={product.image || 'https://via.placeholder.com/150?text=Produto'} alt={product.title} />
                                    </div>
                                    <div className="product-info">
                                        <h4>{product.title}</h4>
                                        <div className="product-price">{formatPrice(product.price)}</div>
                                        <div className="product-location"><i className="fa-solid fa-location-dot"></i> {product.location}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="no-content" style={{gridColumn: '1/-1'}}>
                                    <p>Nenhum produto à venda.</p>
                                    <button onClick={() => navigate('/create-marketplace-item')} style={{marginTop:'10px', color:'#00c2ff', textDecoration:'underline'}}>Anunciar Agora</button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'fotos' && (
                         <div className="post-list animate-fade-in">
                             {photoPosts.length > 0 ? photoPosts.map(post => {
                                 if (!post) return null;
                                 const hasCarousel = post.images && post.images.length > 1;

                                 return (
                                     <div key={post.id} className="relative bg-[#1a1e26] border border-white/5 rounded-2xl pb-2 mb-5 shadow-lg border border-white/5 overflow-hidden text-left">
                                         <PostHeader 
                                            username={post.username} 
                                            time={postService.formatRelativeTime(post.timestamp)} 
                                            location={post.location}
                                            isAdult={post.isAdultContent}
                                            isAd={post.isAd}
                                            onClick={() => {}}
                                            isOwner={true}
                                            onDelete={(e) => deletePost(post.id, e)}
                                        />

                                         <PostText text={post.text || ""} onUserClick={handleUserClick} />

                                         <div className="w-full overflow-hidden bg-black mb-0">
                                             {hasCarousel ? (
                                                 <ImageCarousel images={post.images!} />
                                             ) : (
                                                 <div className="w-full h-auto max-h-[600px]" onClick={() => navigate(`/post/${post.id}`)}>
                                                     <img src={post.image || post.images?.[0]} alt="Post" className="w-full h-full object-contain" />
                                                 </div>
                                             )}
                                         </div>

                                         {post.relatedGroupId && (
                                             <GroupAttachmentCard groupId={post.relatedGroupId} />
                                         )}

                                         <div className="grid grid-cols-4 px-2 py-3 mt-2 border-t border-white/5 gap-1">
                                            <button 
                                                onClick={() => handleLike(post.id)}
                                                className={`flex items-center justify-center gap-1.5 transition-all ${post.liked ? 'text-red-500' : 'text-gray-400 hover:text-[#00c2ff]'}`}
                                            >
                                                <i className={`${post.liked ? 'fa-solid' : 'fa-regular'} fa-heart text-lg`}></i>
                                                <span className="text-xs font-semibold">{formatNumber(post.likes)}</span>
                                            </button>
                                            
                                            <button 
                                                onClick={() => navigate(`/post/${post.id}`)}
                                                className="flex items-center justify-center gap-1.5 text-gray-400 hover:text-[#00c2ff] transition-all"
                                            >
                                                <i className="fa-regular fa-comment text-lg"></i>
                                                <span className="text-xs font-semibold">{formatNumber(post.comments)}</span>
                                            </button>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                                                className="flex items-center justify-center text-gray-400 hover:text-[#00c2ff] transition-all"
                                            >
                                                <i className="fa-regular fa-paper-plane text-lg"></i>
                                            </button>

                                            <div className="flex items-center justify-center gap-1.5 text-gray-400 transition-all cursor-default">
                                                <i className="fa-solid fa-eye text-lg"></i>
                                                <span className="text-xs font-semibold">{formatNumber(post.views)}</span>
                                            </div>
                                         </div>
                                     </div>
                                 );
                             }) : (
                                 <div className="no-content">Você ainda não tem fotos.</div>
                             )}
                         </div>
                    )}

                    {activeTab === 'reels' && (
                        <div className="gallery-grid animate-fade-in">
                            {reelPosts.length > 0 ? reelPosts.map(post => {
                                if (!post) return null;
                                const handleDeleteReel = (e: React.MouseEvent) => deletePost(post.id, e);

                                return (
                                    <div key={post.id} className="gallery-item reel-item relative" onClick={() => navigate(`/reels/${post.id}`, { state: { authorHandle: post.username } })}>
                                        <video src={post.video} className="reel-thumbnail" muted preload="metadata" />
                                        <div className="reel-icon"><i className="fa-solid fa-video"></i> {post.views}</div>
                                        <button 
                                            onClick={handleDeleteReel} 
                                            style={{position:'absolute', top: '2px', right: '2px', fontSize: '14px', background:'rgba(0,0,0,0.5)', borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifySelf:'center', border: 'none', color: '#ff4d4d', cursor: 'pointer', zIndex: 10}}
                                        >
                                             <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div className="no-content" style={{gridColumn: '1/-1'}}>Você ainda não tem reels.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </main>

      <footer className="bg-[#0c0f14] flex justify-around py-3.5 rounded-t-2xl z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.5)] shrink-0">
        <button onClick={() => navigate('/feed')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all"><i className="fa-solid fa-newspaper"></i></button>
        <button onClick={() => navigate('/messages')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all relative">
            <i className="fa-solid fa-comments"></i>
            {unreadMsgs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
        </button>
        <button onClick={() => navigate('/notifications')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all relative">
            <i className="fa-solid fa-bell"></i>
            {unreadNotifs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
        </button>
        <button onClick={() => navigate('/profile')} className="text-white text-[22px] cursor-pointer p-2 transition-all"><i className="fa-solid fa-user"></i></button>
      </footer>

      {/* FOLLOW LIST MODAL */}
      {followListType && (
          <div className="follow-modal-overlay" onClick={closeFollowList}>
              <div className="follow-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="follow-header">
                      <h3>{followListType === 'followers' ? 'Seguidores' : 'Seguindo'}</h3>
                      <button className="close-modal-btn" onClick={closeFollowList}>
                          <i className="fa-solid fa-xmark"></i>
                      </button>
                  </div>
                  <div className="follow-list">
                      {followListData.length > 0 ? (
                          followListData.map((u, idx) => (
                              <div key={idx} className="follow-item" onClick={() => navigateToUserProfile(u.username)}>
                                  {u.avatar ? (
                                      <img src={u.avatar} className="f-avatar" alt={u.name} />
                                  ) : (
                                      <div className="f-avatar"><i className="fa-solid fa-user"></i></div>
                                  )}
                                  <div className="f-info">
                                      <span className="f-name">{u.name}</span>
                                      <span className="f-username">@{u.username}</span>
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="p-5 text-center text-gray-500">Nenhum usuário encontrado.</div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};