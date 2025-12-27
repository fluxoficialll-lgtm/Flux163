import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { relationshipService } from '../services/relationshipService';
import { chatService } from '../services/chatService';
import { NotificationItem } from '../types';
import { db } from '@/database';
import { postService } from '../services/postService'; // IMPORT NEEDED

// Extended type to handle display name logic locally without changing global types
interface EnrichedNotificationItem extends NotificationItem {
    displayName?: string;
}

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<EnrichedNotificationItem[]>([]);
  const [filter, setFilter] = useState<string>('all');

  // Notification Badges
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  // Load notifications and enrich with real user data (name/avatar)
  // NOW REACTIVE: Subscribes to DB changes to auto-update when items are deleted/added
  useEffect(() => {
    const userEmail = authService.getCurrentUserEmail();
    if (!userEmail) {
      navigate('/');
      return;
    }
    
    const loadNotifications = () => {
        // Fetch from service
        const rawData = notificationService.getNotifications();
        
        // Enrich data
        const enrichedData = rawData.map(n => {
            const user = authService.getUserByHandle(n.username);
            if (user) {
                return {
                    ...n,
                    // Preserve the handle in 'username' for logic
                    // Add 'displayName' for the UI
                    displayName: user.profile?.nickname || user.profile?.name || n.username,
                    username: n.username, // Explicitly keep the handle
                    avatar: user.profile?.photoUrl || n.avatar
                };
            }
            return {
                ...n,
                displayName: n.username // Fallback
            };
        });

        setNotifications(enrichedData);
    };

    // Initial Load
    loadNotifications();
    // Mark read immediately on view
    notificationService.markAllAsRead();

    // Subscribe to updates (Fixes bug where deleted items remained visible)
    const unsubscribe = db.subscribe('notifications', loadNotifications);
    
    return () => unsubscribe();
  }, [navigate]);

  // Update Badge Counts
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

  const handleFollowToggle = async (id: number, username: string) => {
    const status = relationshipService.isFollowing(username);
    
    if (status === 'following') {
        await relationshipService.unfollowUser(username);
    } else {
        await relationshipService.followUser(username);
    }

    // Optimistic update for the button state
    setNotifications(prev => prev.map(n => {
        if (n.username === username) { 
            return { ...n, isFollowing: status !== 'following' };
        }
        return n;
    }));
  };

  const handlePendingAction = async (action: 'accept' | 'reject', notification: EnrichedNotificationItem) => {
    // OPTIMISTIC UI: Remove from list immediately
    setNotifications(prev => prev.filter(n => n.id !== notification.id));

    try {
        if (notification.subtype === 'friend') {
            // Logic for Private Account Follow Request
            // 'notification.username' here stores the handle of the requester
            if (action === 'accept') {
                await relationshipService.acceptFollowRequest(notification.username);
            } else {
                await relationshipService.rejectFollowRequest(notification.username);
            }
        } else if (notification.subtype === 'group_join') {
            // Logic for group join requests could go here
        }
        
        // Finally remove notification from DB
        notificationService.removeNotification(notification.id);
        
    } catch (error) {
        console.error("Error handling notification action:", error);
        // In a more complex app, we might want to revert the Optimistic UI here
    }
  };

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' || n.type === filter
  );

  return (
    <div className="h-[100dvh] bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
      
      {/* Injecting provided CSS specifically for this page */}
      <style>{`
        /* Botões de filtro */
        #filterButtons {
            display: flex;
            flex-wrap: nowrap;
            gap: 8px;
            position: fixed;
            top: 80px; 
            left: 0;
            width: 100%;
            padding: 10px 16px;
            background: #0c0f14;
            z-index: 10;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        #filterButtons::-webkit-scrollbar { display: none; }
        
        .filter-btn {
            background: rgba(0,194,255,0.1);
            border: 1px solid #00c2ff;
            border-radius: 20px;
            color: #00c2ff;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: 0.3s;
            white-space: nowrap;
        }
        .filter-btn.active, .filter-btn:hover {
            background: #00c2ff;
            color: #000;
            transform: translateY(-1px);
        }

        /* Notification Items */
        .notification-item {
            display: flex;
            align-items: center;
            padding: 12px 0;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            transition: background 0.2s, border-color 0.2s;
            cursor: pointer;
            border-radius: 8px;
        }
        .notification-item:hover { background: rgba(0,194,255,0.05); }

        .notification-sale {
            background: rgba(0, 255, 130, 0.05); 
            border-left: 5px solid #00ff82; 
            padding-left: 7px; 
        }
        .notification-sale:hover { background: rgba(0, 255, 130, 0.1); }

        .notification-pending {
            border-left: 5px solid #ffaa00;
            padding-left: 7px;
        }
        .notification-pending:hover { background: rgba(255,170,0,0.05); }

        .notification-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 12px;
            border: 2px solid #00c2ff; 
        }

        .notification-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }

        .notification-text { font-size: 15px; line-height: 1.4; }
        .notification-time { font-size: 12px; color: #aaa; margin-top: 4px; }

        .notification-action {
            margin-left: 10px;
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .notification-action img {
            width: 60px;
            height: 60px;
            border-radius: 8px;
            object-fit: cover;
            border: 1px solid rgba(255,255,255,0.2);
        }

        .action-button {
            background: #00c2ff;
            color: #000;
            border: none;
            padding: 8px 12px;
            border-radius: 20px;
            cursor: pointer;
            font-weight: 600;
            transition: 0.3s;
            font-size: 12px;
        }
        .action-button:hover { background: #fff; }
        
        .action-button.secondary {
            background: none;
            border: 1px solid #aaa;
            color: #aaa;
        }
        .action-button.secondary:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .action-button.following {
            background: #1a1a1a; color: #00c2ff; border: 1px solid #00c2ff;
        }
        
        .action-button.primary { background: #00ff82; }
        .action-button.primary:hover { background: #ccffdd; }
        
        /* Header modifications */
        h2.page-title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 20px;
            color: #00c2ff;
            border-bottom: 2px solid rgba(0,194,255,0.3);
            padding-bottom: 8px;
        }

        footer button { 
            position: relative; 
            background: none; border: none; 
            padding: 10px; 
            cursor: pointer;
            transition: color 0.3s;
        }
      `}</style>

      {/* HEADER */}
      <header className="flex items-center justify-center p-[16px_32px] bg-[#0c0f14] fixed w-full z-10 border-b border-white/10 top-0 h-[80px]">
        {/* Logo - Matched to Feed Page Style but centered as per new requirements */}
        <div 
            className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer transition-all duration-500 hover:scale-105 shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)] hover:shadow-[0_0_30px_rgba(0,194,255,0.6),inset_0_0_30px_rgba(0,194,255,0.1)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>
      </header>

      {/* FILTER BUTTONS */}
      <div id="filterButtons">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
        <button className={`filter-btn ${filter === 'like' ? 'active' : ''}`} onClick={() => setFilter('like')}>Curtidas</button>
        <button className={`filter-btn ${filter === 'comment' ? 'active' : ''}`} onClick={() => setFilter('comment')}>Comentários</button>
        <button className={`filter-btn ${filter === 'follow' ? 'active' : ''}`} onClick={() => setFilter('follow')}>Seguidores</button>
        <button className={`filter-btn ${filter === 'mention' ? 'active' : ''}`} onClick={() => setFilter('mention')}>Menções</button>
        <button className={`filter-btn ${filter === 'sale' ? 'active' : ''}`} onClick={() => setFilter('sale')}>Venda Realizada</button>
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pendentes</button>
      </div>

      {/* MAIN CONTENT */}
      <main 
        className="flex-grow flex flex-col items-center justify-start w-full mt-5 transition-all overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="w-full max-w-[600px] px-4 pt-[140px] pb-[120px]">
            <h2 className="page-title">Notificações</h2>

            {filteredNotifications.length === 0 ? (
                <div style={{textAlign:'center', color:'#777', marginTop:'50px', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
                    <i className="fa-regular fa-bell-slash text-4xl opacity-50"></i>
                    <span>Nenhuma notificação encontrada.</span>
                </div>
            ) : (
                filteredNotifications.map(notif => {
                    // Determine classes
                    let itemClass = "notification-item";
                    if (notif.type === 'sale') itemClass += " notification-sale";
                    if (notif.type === 'pending') itemClass += " notification-pending";

                    const displayName = notif.displayName || notif.username;

                    // Render content based on type
                    const renderAction = () => {
                        switch(notif.type) {
                            case 'like':
                            case 'comment':
                                return notif.postImage ? (
                                    <div className="notification-action">
                                        <img src={notif.postImage} alt="Post" />
                                    </div>
                                ) : null;
                            case 'follow':
                                return (
                                    <div className="notification-action">
                                        <button 
                                            className={`action-button ${notif.isFollowing ? 'following' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); handleFollowToggle(notif.id, notif.username); }}
                                        >
                                            {notif.isFollowing ? 'Seguindo' : 'Seguir'}
                                        </button>
                                    </div>
                                );
                            case 'sale':
                                return (
                                    <div className="notification-action">
                                        <i className="fa-solid fa-money-bill-wave" style={{color: '#00ff82', fontSize: '30px', marginRight: '10px'}}></i>
                                    </div>
                                );
                            case 'pending':
                                let primaryText = 'Aceitar';
                                let secondaryText = 'Recusar';
                                if (notif.subtype === 'group_join') { primaryText = 'Aprovar'; secondaryText = 'Negar'; }
                                if (notif.subtype === 'group_invite') { primaryText = 'Entrar'; secondaryText = 'Ignorar'; }
                                
                                return (
                                    <div className="notification-action">
                                        <button className="action-button primary" onClick={(e) => { e.stopPropagation(); handlePendingAction('accept', notif); }}>{primaryText}</button>
                                        <button className="action-button secondary" onClick={(e) => { e.stopPropagation(); handlePendingAction('reject', notif); }}>{secondaryText}</button>
                                    </div>
                                );
                            default:
                                return null;
                        }
                    };

                    const renderText = () => {
                        if (notif.type === 'like') return <><b className="font-bold">{displayName}</b> curtiu sua publicação.</>;
                        if (notif.type === 'comment') return <><b className="font-bold">{displayName}</b> {notif.text}</>;
                        if (notif.type === 'follow') return <><b className="font-bold">{displayName}</b> começou a te seguir: {notif.text || ''}</>;
                        if (notif.type === 'mention') return <><b className="font-bold">{displayName}</b> te mencionou em uma publicação.</>;
                        if (notif.type === 'sale') return <><b className="font-bold">{displayName}</b>: {notif.text}</>;
                        if (notif.type === 'pending') return <><b className="font-bold">{displayName}</b>: {notif.text}</>;
                        return <>{notif.text}</>;
                    };

                    return (
                        <div 
                            key={notif.id} 
                            className={itemClass}
                            onClick={() => notif.type !== 'pending' && navigate(`/user/${notif.username.replace('@','')}`)}
                        >
                            <img src={notif.avatar} className="notification-avatar" alt="Avatar" />
                            <div className="notification-content">
                                <p className="notification-text">{renderText()}</p>
                                {/* FIX: Dynamic Time */}
                                <span className="notification-time">{postService.formatRelativeTime(notif.timestamp)}</span>
                            </div>
                            {renderAction()}
                        </div>
                    );
                })
            )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 w-full bg-[#0c0f14] flex justify-around py-3.5 rounded-t-2xl z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.5)]">
        <button onClick={() => navigate('/feed')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all">
            <i className="fa-solid fa-newspaper"></i>
        </button>
        <button onClick={() => navigate('/messages')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all relative">
            <i className="fa-solid fa-comments"></i>
            {unreadMsgs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
        </button>
        <button className="text-white text-[22px] cursor-pointer p-2 transition-all relative">
            <i className="fa-solid fa-bell"></i>
            {unreadNotifs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
        </button>
        <button onClick={() => navigate('/profile')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all">
            <i className="fa-solid fa-user"></i>
        </button>
      </footer>
    </div>
  );
};