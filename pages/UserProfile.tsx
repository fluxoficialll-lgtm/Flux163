import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { chatService } from '../services/chatService';
import { relationshipService } from '../services/relationshipService';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { notificationService } from '../services/notificationService';
import { marketplaceService } from '../services/marketplaceService';
import { groupService } from '../services/groupService';
import { Post, MarketplaceItem, Group, User } from '../types';
import { db } from '@/database';
import { ImageCarousel } from '../components/ImageCarousel';
import { GroupAttachmentCard } from '../components/GroupAttachmentCard';
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

export const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const [activeTab, setActiveTab] = useState<'posts' | 'fotos' | 'reels' | 'products'>('posts');
  
  // Profile Logic States
  const [userData, setUserData] = useState<any>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userProducts, setUserProducts] = useState<MarketplaceItem[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isMe, setIsMe] = useState(false);
  const [targetUserEmail, setTargetUserEmail] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(true);
  
  // Relationship States
  const [relationStatus, setRelationStatus] = useState<'none'|'following'|'requested'>('none');
  
  // Blocking & Menu States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Report Modal States
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportImages, setReportImages] = useState<string[]>([]);
  const reportFileInputRef = useRef<HTMLInputElement>(null);

  // Notification Badges
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  // Check for Tab in navigation state
  useEffect(() => {
      if (location.state && (location.state as any).activeTab) {
          setActiveTab((location.state as any).activeTab);
      }
  }, [location.state]);

  // Load User Data Logic
  useEffect(() => {
      setIsLoading(true);
      setUserData(null);

      const loadProfile = async () => {
          const currentUsername = username ? (username.startsWith('@') ? username : `@${username}`) : "@usuario";
          const cleanHandle = currentUsername.replace('@', '').toLowerCase();

          // Fallback email from state (if user changed handle, old contents pass this email)
          const fallbackEmail = (location.state as any)?.emailFallback;

          const currentUser = authService.getCurrentUser();
          const targetUser = await authService.fetchUserByHandle(cleanHandle, fallbackEmail);
          
          let isSelf = false;
          if (currentUser && currentUser.profile?.name === cleanHandle) {
              isSelf = true;
          }

          if (targetUser) {
              setTargetUserEmail(targetUser.email);
              
              if (currentUser?.email) {
                  const blockedStatus = chatService.hasBlockingRelationship(currentUser.email, targetUser.email) || 
                                        chatService.hasBlockingRelationship(currentUser.email, cleanHandle);
                  setIsBlocked(blockedStatus);
              }

              const followers = relationshipService.getFollowers(targetUser.profile?.name || '');
              const following = relationshipService.getFollowing(targetUser.email);
              
              // Use user email for posts if handle mismatch
              const userHandleForPosts = `@${targetUser.profile?.name}`;
              const posts = postService.getUserPosts(userHandleForPosts);
              setUserPosts(posts.sort((a, b) => b.timestamp - a.timestamp));

              const products = marketplaceService.getItems().filter(i => i.sellerId === targetUser.email);
              setUserProducts(products.sort((a, b) => b.timestamp - a.timestamp));

              const profileData = {
                  username: `@${targetUser.profile?.name}`,
                  nickname: targetUser.profile?.nickname || targetUser.profile?.name,
                  avatar: targetUser.profile?.photoUrl,
                  bio: targetUser.profile?.bio || "Sem biografia.",
                  website: targetUser.profile?.website || undefined,
                  stats: { 
                      posts: posts.length, 
                      followers: followers.length, 
                      following: following.length 
                  }
              };

              setUserData(profileData);
              setIsPrivate(targetUser.profile?.isPrivate || false);
              setIsMe(isSelf);

              const status = relationshipService.isFollowing(profileData.username);
              setRelationStatus(status);
          } else {
              setUserData(null);
          }
          
          setIsLoading(false);
      };

      loadProfile();
      
      const unsubUsers = db.subscribe('users', () => {
          loadProfile(); 
      });
      const unsubRel = db.subscribe('relationships', () => loadProfile());
      const unsubPosts = db.subscribe('posts', () => loadProfile());
      const unsubChats = db.subscribe('chats', () => loadProfile());

      return () => { unsubUsers(); unsubRel(); unsubPosts(); unsubChats(); };

  }, [username, location.state]);

  // Notification Badges Effect
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

  // Click Outside Handler
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
              menuButtonRef.current && !menuButtonRef.current.contains(event.target as Node)) {
              setIsMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) return (
      <div className="min-h-screen bg-[#0c0f14] text-white flex flex-col items-center justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#00c2ff]"></i>
      </div>
  );

  if (!userData) return (
      <div className="min-h-screen bg-[#0c0f14] flex flex-col items-center justify-center text-white">
          <i className="fa-solid fa-user-slash text-4xl mb-4 text-gray-600"></i>
          <p>Usuário não encontrado.</p>
          <button onClick={() => navigate('/feed')} className="mt-4 text-[#00c2ff]">Voltar ao Feed</button>
      </div>
  );

  const isFollowing = relationStatus === 'following';
  const followRequestSent = relationStatus === 'requested';
  
  const isContentVisible = (!isPrivate || isFollowing || isMe) && !isBlocked;
  const canMessage = (!isPrivate || isFollowing) && !isBlocked;

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/feed');
      }
  };

  const handleLike = (id: string) => {
    setUserPosts(prev => prev.map(post => {
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

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const handleVote = (postId: string, optionIndex: number) => {
    setUserPosts(prev => prev.map(post => {
        if (post.id === postId && post.pollOptions && post.votedOptionIndex == null) {
            const newOptions = [...post.pollOptions];
            newOptions[optionIndex].votes += 1;
            return {
                ...post,
                pollOptions: newOptions,
                votedOptionIndex: optionIndex
            };
        }
        return post;
    }));
  };

  const handleFollowClick = async () => {
    if (isFollowing || followRequestSent) {
        const action = followRequestSent ? 'cancelar solicitação para' : 'deixar de seguir';
        if (window.confirm(`Tem certeza que deseja ${action} ${userData.username}?`)) {
            await relationshipService.unfollowUser(userData.username);
            setRelationStatus('none');
        }
    } else {
        const newStatus = await relationshipService.followUser(userData.username);
        setRelationStatus(newStatus);
    }
  };

  const handleMessageClick = () => {
      const currentUserEmail = authService.getCurrentUserEmail();
      if (currentUserEmail && targetUserEmail) {
          const chatId = chatService.getPrivateChatId(currentUserEmail, targetUserEmail);
          navigate(`/chat/${chatId}`);
      }
  };

  const toggleBlockUser = () => {
      const action = isBlocked ? "desbloquear" : "bloquear";
      const confirmMessage = isBlocked 
        ? `Deseja desbloquear ${userData.username}?`
        : `Deseja bloquear ${userData.username}?`;

      if (window.confirm(confirmMessage)) {
          const newStatus = chatService.toggleBlockByContactName(userData.username);
          setIsBlocked(newStatus);
          setIsMenuOpen(false);
          
          if (newStatus) {
              relationshipService.unfollowUser(userData.username);
              setRelationStatus('none');
              alert(`${userData.username} foi bloqueado.`);
          } else {
              alert(`${userData.username} foi desbloqueado.`);
          }
      }
  };

  const handleCopyLink = () => {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
          alert('Link copiado!');
      });
      setIsMenuOpen(false);
  };

  const handleReport = () => {
      setIsMenuOpen(false);
      setIsReportModalOpen(true);
  };

  const handleReportSubmit = () => {
      if (!reportReason.trim()) {
          alert('Por favor, descreva o motivo da denúncia.');
          return;
      }
      alert('Denúncia enviada com sucesso! Nossa equipe analisará o caso.');
      setIsReportModalOpen(false);
      setReportReason('');
      setReportImages([]);
  };

  const handleShare = async (post: Post) => {
      const url = `${window.location.origin}/#/post/${post.id}`;
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `Post de ${post.username}`,
                  text: post.text.substring(0, 100),
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

  const formatPrice = (val: number) => {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleUserClick = (username: string) => {
    const cleanName = username.startsWith('@') ? username.substring(1) : username;
    navigate(`/user/${cleanName}`);
  };

  const textPosts = userPosts.filter(p => p.type === 'text' || p.type === 'poll');
  const photoPosts = userPosts.filter(p => p.type === 'photo');
  const reelPosts = userPosts.filter(p => p.type === 'video');

  return (
    <div className="profile-page h-[100dvh] bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
        
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
            
            .profile-dropdown {
                position: absolute; top: 40px; right: 0; background: #1a1e26;
                border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
                width: 150px; display: none; flex-direction: column; overflow: hidden;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            }
            .profile-dropdown.active { display: flex; }
            .profile-dropdown button {
                padding: 10px; text-align: left; font-size: 13px; color: #fff;
                border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px;
            }
            .profile-dropdown button:last-child { border-bottom: none; }
            .profile-dropdown button.danger { color: #ff4d4d; }
            .profile-dropdown button:hover { background: rgba(255,255,255,0.05); }

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
            .profile-placeholder {
                width: 100px; height: 100px; border-radius: 50%;
                background: #1e2531; display: flex; align-items: center; justify-content: center;
                font-size: 40px; color: #00c2ff; border: 4px solid #00c2ff;
                margin-bottom: 15px; box-shadow: 0 0 25px rgba(0,194,255,0.3);
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
                border: none; cursor: pointer; transition: 0.2s;
            }
            #followButton { background: #00c2ff; color: #0c0f14; box-shadow: 0 4px 15px rgba(0,194,255,0.3); }
            #followButton:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,194,255,0.4); }
            #followButton.is-following { background: transparent; border: 1px solid #aaa; color: #fff; box-shadow: none; }
            #followButton.request-sent { background: rgba(255,255,255,0.1); color: #aaa; cursor: default; box-shadow: none; }
            #messageButton { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
            #messageButton:hover { background: rgba(255,255,255,0.2); }

            .status-message-container {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                height: 200px; color: #aaa; text-align: center; padding: 20px;
                background: rgba(255,255,255,0.02); border-radius: 16px; margin-top: 20px;
            }
            .status-message-container i { font-size: 40px; margin-bottom: 15px; opacity: 0.5; }
            .status-message-container h2 { font-size: 18px; color: #fff; margin-bottom: 5px; }
            
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

            .reel-grid {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
            }
            .reel-item { position: relative; aspect-ratio: 9/16; cursor: pointer; background: #000; }
            .reel-thumbnail { width: 100%; height: 100%; object-fit: cover; }
            .reel-icon {
                position: absolute; bottom: 5px; left: 5px; color: #fff; font-size: 12px;
                display: flex; align-items: center; gap: 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            }

            .no-content { text-align: center; color: #666; padding: 30px 0; font-size: 14px; }

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

            .report-modal-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center;
            }
            .report-modal {
                background: #1a1e26; width: 90%; max-width: 350px; border-radius: 12px; padding: 20px;
                border: 1px solid #ff4d4d;
            }
            .report-title { color: #ff4d4d; font-weight: 700; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
            .report-desc { width: 100%; background: #0c0f14; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 8px; margin-bottom: 10px; min-height: 80px; }
            .report-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .btn-cancel { background: transparent; border: 1px solid #555; color: #aaa; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
            .btn-submit { background: #ff4d4d; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; }
        `}</style>

        <header>
            <button onClick={handleBack} className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
            
            <div 
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
                onClick={() => navigate('/feed')}
            >
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
            </div>
            
            <div style={{position: 'relative'}}>
                <button 
                    ref={menuButtonRef}
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white transition-colors"
                >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div ref={menuRef} className={`profile-dropdown ${isMenuOpen ? 'active' : ''}`}>
                    <button onClick={handleCopyLink}>
                        <i className="fa-solid fa-link"></i> Copiar Link
                    </button>
                    {!isMe && (
                        <>
                            <button onClick={handleReport}>
                                <i className="fa-solid fa-flag"></i> Denunciar
                            </button>
                            <button className="danger" onClick={toggleBlockUser}>
                                <i className="fa-solid fa-ban"></i> {isBlocked ? 'Desbloquear' : 'Bloquear'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>

        <main className="flex-grow w-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div style={{width:'100%', maxWidth:'600px', margin:'0 auto', paddingTop: '10px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            {isBlocked ? (
                <section style={{width: '90%'}}>
                    <div className="status-message-container blocked">
                        <i className="fa-solid fa-ban"></i>
                        <h2>Usuário Indisponível</h2>
                        <p>As informações deste perfil não estão disponíveis para você.</p>
                        <button 
                            onClick={toggleBlockUser}
                            style={{marginTop: '20px', background: 'transparent', border: '1px solid #ff4d4d', color: '#ff4d4d', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer'}}
                        >
                            Gerenciar Bloqueio
                        </button>
                    </div>
                </section>
            ) : (
                <>
                    <div className="profile-card-box">
                        {userData.avatar ? (
                            <img src={userData.avatar} className="profile-avatar" alt="Avatar" />
                        ) : (
                            <div className="profile-placeholder">
                                <i className="fa-solid fa-user"></i>
                            </div>
                        )}
                        <span className="profile-nickname">{userData.nickname}</span>
                        <span className="profile-handle">{userData.username}</span>
                        
                        {(isContentVisible) && (
                            <div className="profile-stats-container">
                                <div className="stat-box"><span className="stat-value">{userData.stats.posts}</span><span className="stat-label">Posts</span></div>
                                <div className="stat-box"><span className="stat-value">{userData.stats.followers}</span><span className="stat-label">Seguidores</span></div>
                                <div className="stat-box"><span className="stat-value">{userData.stats.following}</span><span className="stat-label">Seguindo</span></div>
                            </div>
                        )}

                        {(isContentVisible) && (
                            <p className="profile-bio">
                                {userData.bio}
                            </p>
                        )}

                        {(isContentVisible && userData.website) && (
                            <a 
                                href={userData.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="profile-link"
                            >
                                <i className="fa-solid fa-link"></i> {userData.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                        )}

                        {!isMe && (
                            <div className="profile-actions">
                                <button 
                                    id="followButton" 
                                    className={isFollowing ? 'is-following' : (followRequestSent ? 'request-sent' : '')}
                                    onClick={handleFollowClick}
                                >
                                    {isFollowing ? 'Seguindo' : (followRequestSent ? 'Solicitado' : 'Seguir')}
                                </button>
                                
                                {canMessage && (
                                    <button id="messageButton" onClick={handleMessageClick}>Mensagem</button>
                                )}
                            </div>
                        )}
                        
                        {isMe && (
                            <div className="profile-actions">
                                <button onClick={() => navigate('/edit-profile')} style={{background: '#1e2531', color: '#fff', border:'1px solid #555'}}>Editar Perfil</button>
                            </div>
                        )}
                    </div>

                    {isContentVisible && (
                        <div style={{width: '100%'}}>
                            <nav className="tab-nav">
                                <button className={activeTab === 'posts' ? 'active' : ''} onClick={() => setActiveTab('posts')}>Posts</button>
                                
                                {userProducts.length > 0 && (
                                    <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>Produtos</button>
                                )}

                                <button className={activeTab === 'fotos' ? 'active' : ''} onClick={() => setActiveTab('fotos')}>Fotos</button>
                                <button className={activeTab === 'reels' ? 'active' : ''} onClick={() => setActiveTab('reels')}>Reels</button>
                            </nav>

                            <section style={{width: '100%', marginTop: '10px'}}>
                                {activeTab === 'posts' && (
                                    <div className="post-list">
                                        {textPosts.length > 0 ? textPosts.map(post => (
                                            <div key={post.id} className="relative bg-white/5 backdrop-blur-md rounded-2xl pt-4 pb-2 mb-5 shadow-lg border border-white/5 overflow-hidden text-left">
                                                <PostHeader 
                                                    username={post.username} 
                                                    authorEmail={post.authorEmail}
                                                    time={postService.formatRelativeTime(post.timestamp)} 
                                                    location={post.location}
                                                    isAdult={post.isAdultContent}
                                                    isAd={post.isAd}
                                                    onClick={() => {}}
                                                    isOwner={isMe}
                                                    onDelete={() => {}}
                                                />
                                                
                                                <PostText text={post.text || ""} onUserClick={handleUserClick} />
                                                
                                                {post.relatedGroupId && (
                                                    <GroupAttachmentCard groupId={post.relatedGroupId} />
                                                )}

                                                {post.type === 'poll' && post.pollOptions && (
                                                    <div className="mx-4 mt-2.5 mb-2.5 p-2.5 bg-[#00c2ff0d] rounded-lg">
                                                        {post.pollOptions.map((option, idx) => {
                                                            const totalVotes = post.pollOptions!.reduce((acc, curr) => acc + curr.votes, 0);
                                                            const pct = getPercentage(option.votes, totalVotes);
                                                            const isVoted = post.votedOptionIndex === idx;
                                                            return (
                                                                <div 
                                                                    key={idx}
                                                                    onClick={() => handleVote(post.id, idx)}
                                                                    className={`relative mb-2 p-2.5 rounded-lg cursor-pointer overflow-hidden font-medium transition-colors ${isVoted ? 'bg-[#00c2ff] text-black font-bold' : 'bg-[#1e2531] hover:bg-[#28303f]'}`}
                                                                >
                                                                    <div 
                                                                        className="absolute top-0 left-0 h-full bg-[#00c2ff] opacity-30 z-0 transition-[width] duration-500 ease-out" 
                                                                        style={{ width: `${pct}%` }}
                                                                    ></div>
                                                                    <div className="relative z-10 flex justify-between items-center text-sm">
                                                                        <span>{option.text}</span>
                                                                        <span>{pct}%</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-4 px-2 py-3 mt-2 border-t border-white/5 gap-1">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleLike(post.id); }}
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
                                        )) : <div className="no-content">Nenhum post ainda.</div>}
                                    </div>
                                )}

                                {activeTab === 'products' && (
                                    <div className="products-grid">
                                        {userProducts.length > 0 ? userProducts.map(product => (
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
                                        )) : <div className="no-content">Nenhum produto publicado.</div>}
                                    </div>
                                )}

                                {activeTab === 'fotos' && (
                                    <div className="post-list">
                                        {photoPosts.length > 0 ? photoPosts.map(post => (
                                            <div key={post.id} className="relative bg-white/5 backdrop-blur-md rounded-2xl pt-4 pb-2 mb-5 shadow-lg border border-white/5 overflow-hidden text-left" onClick={() => navigate(`/post/${post.id}`)}>
                                                <PostHeader 
                                                    username={post.username} 
                                                    authorEmail={post.authorEmail}
                                                    time={postService.formatRelativeTime(post.timestamp)} 
                                                    location={post.location}
                                                    isAdult={post.isAdultContent}
                                                    isAd={post.isAd}
                                                    onClick={() => {}}
                                                    isOwner={isMe}
                                                    onDelete={() => {}}
                                                />
                                                
                                                <PostText text={post.text || ""} onUserClick={handleUserClick} />
                                                
                                                <div className="w-full overflow-hidden bg-black mb-0">
                                                    {post.images && post.images.length > 1 ? (
                                                        <ImageCarousel images={post.images} />
                                                    ) : (
                                                        <img src={post.image || (post.images ? post.images[0] : '')} alt="Post" className="w-full h-auto max-h-[600px] object-contain" />
                                                    )}
                                                </div>

                                                {post.relatedGroupId && (
                                                    <GroupAttachmentCard groupId={post.relatedGroupId} />
                                                )}
                                                
                                                <div className="grid grid-cols-4 px-2 py-3 mt-2 border-t border-white/5 gap-1">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleLike(post.id); }}
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
                                        )) : <div className="no-content">Nenhuma foto ainda.</div>}
                                    </div>
                                )}

                                {activeTab === 'reels' && (
                                    <div className="reel-grid">
                                        {reelPosts.length > 0 ? reelPosts.map(post => (
                                            <div key={post.id} className="reel-item" onClick={() => navigate(`/reels/${post.id}`, { state: { authorHandle: post.username } })}>
                                                <video src={post.video} className="reel-thumbnail" muted preload="metadata" />
                                                <div className="reel-icon"><i className="fa-solid fa-play"></i> {post.views}</div>
                                            </div>
                                        )) : <div className="no-content">Nenhum reel ainda.</div>}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                    
                    {!isContentVisible && (
                        <div className="status-message-container">
                            <i className="fa-solid fa-lock"></i>
                            <h2>Conta Privada</h2>
                            <p>Siga esta conta para ver suas fotos, vídeos e produtos.</p>
                        </div>
                    )}
                </>
            )}
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
            <button onClick={() => navigate('/profile')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all"><i className="fa-solid fa-user"></i></button>
        </footer>

        {isReportModalOpen && (
            <div className="report-modal-overlay" onClick={() => setIsReportModalOpen(false)}>
                <div className="report-modal" onClick={e => e.stopPropagation()}>
                    <div className="report-title">
                        <i className="fa-solid fa-triangle-exclamation"></i> Denunciar Perfil
                    </div>
                    
                    <textarea 
                        className="report-desc"
                        placeholder="Descreva o motivo da denúncia..."
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                    ></textarea>

                    <div className="report-actions">
                        <button className="btn-cancel" onClick={() => setIsReportModalOpen(false)}>Cancelar</button>
                        <button className="btn-submit" onClick={handleReportSubmit}>Enviar Denúncia</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};