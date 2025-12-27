
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { relationshipService } from '../services/relationshipService';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { User } from '../types';
import { db } from '@/database';

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Force update to reflect changes in UI
  const [_, setTick] = useState(0);

  // Search Logic via API
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
        if (searchTerm.trim().length > 0) {
            setLoading(true);
            try {
                // API Call instead of local filter
                const results = await authService.searchUsers(searchTerm);
                setFilteredUsers(results);
            } catch (error) {
                console.error("Search error", error);
            } finally {
                setLoading(false);
            }
        } else {
            // Show recent users or empty state if search is empty
            // Ideally fetches "Suggested Users" from API
            setFilteredUsers([]);
        }
    }, 300); // Debounce 300ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleAction = async (user: User) => {
      const username = user.profile?.name;
      if (!username) return;

      const status = relationshipService.isFollowing(username);
      
      if (status === 'none') {
          await relationshipService.followUser(username);
      } else {
          if (window.confirm(`Deixar de seguir @${username}?`)) {
              await relationshipService.unfollowUser(username);
          }
      }
      setTick(prev => prev + 1); 
  };

  const handleProfileClick = (username: string) => {
      const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
      navigate(`/user/${cleanUsername}`);
  };

  const handleMessageClick = (user: User) => {
      const currentUserEmail = authService.getCurrentUserEmail();
      if (currentUserEmail && user.email) {
          const chatId = chatService.getPrivateChatId(currentUserEmail, user.email);
          navigate(`/chat/${chatId}`);
      }
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/messages');
      }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        header {
            display: flex; align-items: center; gap: 15px; padding: 16px 20px;
            background: #0c0f14; position: fixed; width: 100%; z-index: 10;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1); top: 0; height: 70px;
        }
        header button {
            background: none; border: none; color: #00c2ff; font-size: 20px; cursor: pointer;
        }
        header h1 { font-size: 18px; font-weight: 600; color: #fff; }

        main { padding-top: 80px; width: 100%; max-width: 600px; margin: 0 auto; padding-bottom: 20px; }

        .search-container {
            padding: 0 20px 20px 20px;
        }
        .search-input-wrapper {
            position: relative;
        }
        .search-input-wrapper i {
            position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #aaa;
        }
        .search-input-wrapper input {
            width: 100%; padding: 12px 12px 12px 45px; background: #1a1e26;
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
            color: #fff; font-size: 16px; outline: none; transition: 0.3s;
        }
        .search-input-wrapper input:focus {
            border-color: #00c2ff; box-shadow: 0 0 10px rgba(0, 194, 255, 0.2);
        }

        .global-badge {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            margin-top: 8px; font-size: 11px; color: #00ff82; text-transform: uppercase; letter-spacing: 1px;
        }

        .user-list { display: flex; flex-direction: column; }
        .user-item {
            display: flex; align-items: center; padding: 15px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            cursor: pointer;
            transition: background 0.2s;
        }
        .user-item:hover { background: rgba(255,255,255,0.05); }

        .user-avatar {
            width: 50px; height: 50px; border-radius: 50%; margin-right: 15px;
            background: #333; display: flex; align-items: center; justify-content: center;
            object-fit: cover; border: 1px solid #444; color: #888; font-size: 20px;
        }
        .user-info { flex-grow: 1; }
        .user-name { font-weight: 600; font-size: 15px; color: #fff; display: block; text-transform: capitalize; }
        .user-username { font-size: 13px; color: #888; }

        .action-buttons { display: flex; gap: 10px; align-items: center; }

        .action-btn {
            padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 600;
            border: none; cursor: pointer; transition: 0.2s; min-width: 80px;
        }
        .btn-follow {
            background: #00c2ff; color: #000;
        }
        .btn-follow:hover { background: #0099cc; }
        
        .btn-requested {
            background: transparent; border: 1px solid #aaa; color: #aaa;
        }
        .btn-following {
            background: transparent; border: 1px solid #00c2ff; color: #00c2ff;
        }

        .msg-btn {
            width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.1);
            display: flex; align-items: center; justify-content: center; color: #fff;
            border: none; cursor: pointer; transition: 0.2s;
        }
        .msg-btn:hover { background: rgba(0,194,255,0.2); color: #00c2ff; }
      `}</style>

      <header>
        <button onClick={handleBack}><i className="fa-solid fa-arrow-left"></i></button>
        <h1>Encontrar Pessoas</h1>
      </header>

      <main>
        <div className="search-container">
            <div className="search-input-wrapper">
                <i className={`fa-solid ${loading ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'}`}></i>
                <input 
                    type="text" 
                    placeholder="Pesquisar por nome ou @..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="global-badge">
                <i className="fa-solid fa-globe"></i> Pesquisa Global
            </div>
        </div>

        <div className="user-list">
            {filteredUsers.map(user => {
                const username = user.profile?.name || 'unknown';
                const status = relationshipService.isFollowing(username);
                const isPrivate = user.profile?.isPrivate || false;
                
                const currentUserEmail = authService.getCurrentUserEmail();
                const isMe = user.email === currentUserEmail;

                // Regra: Pode mandar mensagem SE (Público) OU (Privado E Seguindo) E NÃO for o próprio usuário
                const canMessage = (!isPrivate || status === 'following') && !isMe;

                let btnText = 'Seguir';
                let btnClass = 'action-btn btn-follow';

                if (status === 'requested') {
                    btnText = 'Solicitado';
                    btnClass = 'action-btn btn-requested';
                } else if (status === 'following') {
                    btnText = 'Seguindo';
                    btnClass = 'action-btn btn-following';
                }

                return (
                    <div key={user.email} className="user-item" onClick={() => handleProfileClick(username)}>
                        {user.profile?.photoUrl ? (
                            <img src={user.profile.photoUrl} className="user-avatar" alt={username} />
                        ) : (
                            <div className="user-avatar"><i className="fa-solid fa-user"></i></div>
                        )}
                        <div className="user-info">
                            {/* Display name preference: Nickname > Name */}
                            <span className="user-name">{user.profile?.nickname || user.profile?.name}</span>
                            <span className="user-username">@{username}</span>
                        </div>
                        <div className="action-buttons">
                            {canMessage && (
                                <button 
                                    className="msg-btn" 
                                    onClick={(e) => { e.stopPropagation(); handleMessageClick(user); }}
                                >
                                    <i className="fa-solid fa-comment"></i>
                                </button>
                            )}
                            {!isMe && (
                                <button 
                                    className={btnClass} 
                                    onClick={(e) => { e.stopPropagation(); handleAction(user); }}
                                >
                                    {btnText}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {filteredUsers.length === 0 && !loading && (
                <div style={{textAlign:'center', color:'#777', padding:'30px'}}>
                    {searchTerm ? 'Nenhum usuário encontrado.' : 'Digite para pesquisar em toda a rede.'}
                </div>
            )}
        </div>
      </main>
    </div>
  );
};
