
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatService, ChatData } from '../services/chatService';

export const BlockedUsers: React.FC = () => {
  const navigate = useNavigate();
  const [blockedChats, setBlockedChats] = useState<ChatData[]>([]);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = () => {
    const allChatsMap = chatService.getAllChats();
    const allChats = Object.values(allChatsMap);
    const blocked = allChats.filter(chat => chat.isBlocked);
    setBlockedChats(blocked);
  };

  const handleUnblock = (chatId: string | number) => {
    if (window.confirm("Deseja realmente desbloquear este usuário?")) {
      chatService.toggleBlock(chatId.toString());
      // Remove form local state
      setBlockedChats(prev => prev.filter(chat => chat.id.toString() !== chatId.toString()));
    }
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/settings');
      }
  };

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        
        header {
            display:flex; align-items:center; padding:16px 32px;
            background: #0c0f14; position:fixed; width:100%; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); top: 0; height: 65px;
        }
        header button {
            background:none; border:none; color:#fff; font-size:22px; cursor:pointer;
            transition:0.3s; padding-right: 15px;
        }
        header h1 { font-size:18px; font-weight:600; color: #00c2ff; }
        
        main {
            padding-top: 90px; padding-bottom: 40px; width: 100%; max-width: 600px; 
            margin: 0 auto; padding-left: 20px; padding-right: 20px;
            overflow-y: auto; flex-grow: 1; -webkit-overflow-scrolling: touch;
        }

        .blocked-user-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 12px;
            margin-bottom: 10px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .user-avatar {
            width: 40px; height: 40px;
            border-radius: 50%;
            background: #333;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold; color: #888;
            border: 1px solid #555;
        }

        .user-name {
            font-size: 16px;
            font-weight: 500;
            color: #fff;
        }

        .unblock-btn {
            background: transparent;
            border: 1px solid #ff4d4d;
            color: #ff4d4d;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
        }

        .unblock-btn:hover {
            background: #ff4d4d;
            color: #fff;
        }

        .empty-state {
            text-align: center;
            color: #777;
            margin-top: 50px;
            font-size: 14px;
        }
        .empty-state i {
            font-size: 40px;
            margin-bottom: 10px;
            display: block;
            opacity: 0.5;
        }
      `}</style>

      <header>
        <button onClick={handleBack} aria-label="Voltar">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Usuários Bloqueados</h1>
      </header>

      <main>
        {blockedChats.length > 0 ? (
            blockedChats.map(chat => (
                <div key={chat.id} className="blocked-user-item">
                    <div className="user-info">
                        <div className="user-avatar">
                            {chat.contactName.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-name">{chat.contactName}</div>
                    </div>
                    <button 
                        className="unblock-btn"
                        onClick={() => handleUnblock(chat.id)}
                    >
                        Desbloquear
                    </button>
                </div>
            ))
        ) : (
            <div className="empty-state">
                <i className="fa-solid fa-user-shield"></i>
                <p>Você não tem nenhum usuário bloqueado.</p>
            </div>
        )}
      </main>
    </div>
  );
};