
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { relationshipService } from '../services/relationshipService';
import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import { db } from '@/database';

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  status: 'online' | string;
  isOnline: boolean;
  unreadCount: number;
}

interface MutualFriend {
    id: number | string;
    name: string;
    username: string;
    avatar: string;
}

export const Messages: React.FC = () => {
  const navigate = useNavigate();
  const [uiVisible, setUiVisible] = useState(true);
  const lastScrollY = useRef(0);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const formatLastSeen = (timestamp?: number) => {
      if (!timestamp) return "Offline";
      const diff = Date.now() - timestamp;
      if (diff < 2 * 60 * 1000) return "online"; 
      
      const date = new Date(timestamp);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `Visto por último às ${hours}:${minutes}`;
  };

  const loadChats = useCallback(() => {
      const currentUserEmail = authService.getCurrentUserEmail();
      if (!currentUserEmail) return;

      const rawChats = chatService.getAllChats();
      
      const formatted: Contact[] = Object.values(rawChats).map(chat => {
          const chatIdStr = chat.id.toString();
          if (!chatIdStr.includes('@')) return null;
          if (!chatIdStr.includes(currentUserEmail)) return null;

          const unreadCount = chat.messages.filter(m => {
              if (m.senderEmail) {
                  return m.senderEmail !== currentUserEmail && m.status !== 'read';
              }
              return m.type === 'received' && m.status !== 'read';
          }).length;
          
          const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : null;
          
          let previewText = '';
          if (lastMsg) {
              const isMe = lastMsg.senderEmail === currentUserEmail;
              const prefix = isMe ? 'Você: ' : '';
              const content = lastMsg.contentType === 'text' ? lastMsg.text : 
                             (lastMsg.contentType === 'image' ? '📷 Foto' : 
                             (lastMsg.contentType === 'video' ? '🎥 Vídeo' : '🎤 Áudio'));
              previewText = prefix + content;
          }

          let displayName = chat.contactName;
          let avatarUrl: string | undefined = undefined;
          let targetUser = undefined;

          if (chatIdStr.includes('_') && chatIdStr.includes('@')) {
              const parts = chatIdStr.split('_');
              const otherEmail = parts.find(p => p !== currentUserEmail);
              
              if (otherEmail) {
                  const allUsers = authService.getAllUsers();
                  const user = allUsers.find(u => u.email === otherEmail) || (authService.getCurrentUser()?.email === otherEmail ? authService.getCurrentUser() : undefined);
                  
                  if (user) {
                      targetUser = user;
                      displayName = user.profile?.nickname || user.profile?.name || otherEmail;
                      avatarUrl = user.profile?.photoUrl;
                  } else {
                      displayName = otherEmail;
                  }
              }
          } else {
              targetUser = authService.getUserByHandle(chat.contactName);
              if (targetUser) {
                  displayName = targetUser.profile?.nickname || targetUser.profile?.name || chat.contactName;
                  avatarUrl = targetUser.profile?.photoUrl;
              }
          }

          const statusText = formatLastSeen(targetUser?.lastSeen);
          const isOnline = statusText === 'online';

          const contact: Contact = {
              id: chat.id.toString(),
              name: displayName,
              avatar: avatarUrl,
              lastMessage: previewText,
              time: lastMsg ? lastMsg.timestamp : '',
              status: statusText,
              isOnline: isOnline,
              unreadCount: unreadCount
          };
          return contact;
      }).filter((c): c is Contact => c !== null && c.lastMessage !== '').sort((a, b) => {
          return b.time.localeCompare(a.time); 
      });

      setContacts(formatted);

  }, []);

  useEffect(() => {
    const userEmail = authService.getCurrentUserEmail();
    if (!userEmail) {
      navigate('/');
      return;
    }

    loadChats();
    const unsubscribeChats = db.subscribe('chats', () => loadChats());
    const unsubscribeUsers = db.subscribe('users', () => loadChats());

    const scrollContainer = mainScrollRef.current;
    const handleScroll = () => {
      if (!scrollContainer) return;
      const currentScroll = scrollContainer.scrollTop;
      
      if (currentScroll > lastScrollY.current && currentScroll > 60) {
        setUiVisible(false);
      } else {
        setUiVisible(true);
      }
      lastScrollY.current = currentScroll;
    };

    if (scrollContainer) {
        scrollContainer.addEventListener("scroll", handleScroll);
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (
            menuRef.current && 
            !menuRef.current.contains(event.target as Node) &&
            buttonRef.current &&
            !buttonRef.current.contains(event.target as Node)
        ) {
            setIsMenuOpen(false);
        }
    };

    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
        unsubscribeChats();
        unsubscribeUsers();
        if (scrollContainer) {
            scrollContainer.removeEventListener("scroll", handleScroll);
        }
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [navigate, loadChats]);

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

  useEffect(() => {
      if (isNewChatOpen) {
          relationshipService.getMutualFriends().then(friends => {
              setMutualFriends(friends);
          });
      }
  }, [isNewChatOpen]);

  const handleContactClick = (id: string) => {
      if (isSelectionMode) {
          toggleSelection(id);
      } else {
          navigate(`/chat/${id}`);
      }
  };

  const toggleSelection = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(prev => prev.filter(item => item !== id));
      } else {
          setSelectedIds(prev => [...prev, id]);
      }
  };

  const startSelectionMode = () => {
      setIsMenuOpen(false);
      setIsSelectionMode(true);
      setSelectedIds([]);
  };

  const cancelSelectionMode = () => {
      setIsSelectionMode(false);
      setSelectedIds([]);
  };

  const handleMarkAllRead = () => {
      chatService.markAllAsRead();
      setIsMenuOpen(false);
  };

  const deleteSelected = () => {
      if (selectedIds.length === 0) return;
      if (window.confirm(`Deseja apagar ${selectedIds.length} conversa(s)?`)) {
          setContacts(prev => prev.filter(c => !selectedIds.includes(c.id)));
          setIsSelectionMode(false);
          setSelectedIds([]);
      }
  };

  const handleStartNewChat = (friendId: string | number) => {
      const currentUserEmail = authService.getCurrentUserEmail();
      const friendEmail = friendId.toString();
      if (currentUserEmail) {
          const chatId = chatService.getPrivateChatId(currentUserEmail, friendEmail);
          setIsNewChatOpen(false);
          navigate(`/chat/${chatId}`);
      }
  };

  const filteredMutuals = mutualFriends.filter(f => 
      f.name.toLowerCase().includes(newChatSearch.toLowerCase()) || 
      f.username.toLowerCase().includes(newChatSearch.toLowerCase())
  );

  return (
    <div className="h-[100dvh] bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <header className={`flex items-center justify-between p-[16px_32px] fixed w-full z-10 border-b border-white/10 top-0 h-[80px] transition-colors duration-300 ${isSelectionMode ? 'bg-[#0f2b38]' : 'bg-[#0c0f14]'}`}>
            
            {isSelectionMode ? (
                <>
                    <button 
                        onClick={cancelSelectionMode}
                        className="bg-none border-none text-white text-lg cursor-pointer hover:text-[#00c2ff]"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                    
                    <span className="text-lg font-bold">{selectedIds.length} selecionada(s)</span>

                    <button 
                        onClick={deleteSelected}
                        disabled={selectedIds.length === 0}
                        className={`bg-none border-none text-lg cursor-pointer transition-colors ${selectedIds.length > 0 ? 'text-[#ff4d4d] hover:text-red-400' : 'text-gray-600'}`}
                    >
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </>
            ) : (
                <>
                    <div className="relative">
                        <button 
                            ref={buttonRef}
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white"
                        >
                            <i className="fa-solid fa-sliders"></i>
                        </button>
                        
                        {isMenuOpen && (
                            <div ref={menuRef} className="absolute top-[60px] left-[20px] bg-[#1a1e26] border border-white/10 rounded-xl shadow-lg z-50 min-w-[220px] overflow-hidden animate-fade-in">
                                <button className="flex items-center w-full p-4 bg-transparent border-none text-white text-sm cursor-pointer transition-colors hover:bg-[#00c2ff1a] hover:text-[#00c2ff] border-b border-white/5 text-left" onClick={startSelectionMode}>
                                    <i className="fa-solid fa-check-double mr-3 w-5 text-center"></i> Selecionar conversas
                                </button>
                                <button className="flex items-center w-full p-4 bg-transparent border-none text-white text-sm cursor-pointer transition-colors hover:bg-[#00c2ff1a] hover:text-[#00c2ff] border-b border-white/5 text-left" onClick={handleMarkAllRead}>
                                    <i className="fa-solid fa-envelope-open-text mr-3 w-5 text-center"></i> Marcar todas como lidas
                                </button>
                                <button className="flex items-center w-full p-4 bg-transparent border-none text-white text-sm cursor-pointer transition-colors hover:bg-[#00c2ff1a] hover:text-[#00c2ff] border-b border-white/5 text-left" onClick={() => { setIsMenuOpen(false); navigate('/blocked-users'); }}>
                                    <i className="fa-solid fa-user-shield mr-3 w-5 text-center"></i> Usuários Bloqueados
                                </button>
                                <button className="flex items-center w-full p-4 bg-transparent border-none text-white text-sm cursor-pointer transition-colors hover:bg-[#00c2ff1a] hover:text-[#00c2ff] text-left" onClick={() => { setIsMenuOpen(false); navigate('/notification-settings'); }}>
                                    <i className="fa-solid fa-bell mr-3 w-5 text-center"></i> Configurar Notificações
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Logo */}
                    <div 
                        className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
                        onClick={() => navigate('/feed')}
                    >
                        <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                        <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
                    </div>

                    {/* Groups Button - REMOVED RED DOT BADGE */}
                    <button 
                        onClick={() => navigate('/groups')}
                        className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white relative p-2"
                    >
                        <i className="fa-solid fa-users"></i>
                    </button>
                </>
            )}
        </header>

        {/* MAIN CONTENT */}
        <main 
            ref={mainScrollRef}
            className="flex-grow flex flex-col items-start justify-start w-full transition-all pt-[80px] pb-[100px] overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            <div className="w-full">
                {contacts.length > 0 ? contacts.map(contact => (
                    <div 
                        key={contact.id} 
                        className={`flex items-center p-3 border-b border-white/5 cursor-pointer transition-colors ${isSelectionMode && selectedIds.includes(contact.id) ? 'bg-[#00c2ff]/10' : 'hover:bg-[#00c2ff]/10'}`}
                        onClick={() => handleContactClick(contact.id)}
                    >
                        {isSelectionMode && (
                            <div className={`w-[22px] h-[22px] rounded-full border-2 mr-[15px] flex items-center justify-center transition-all flex-shrink-0 ${selectedIds.includes(contact.id) ? 'bg-[#00c2ff] border-[#00c2ff]' : 'border-[#555]'}`}>
                                {selectedIds.includes(contact.id) && <i className="fa-solid fa-check text-black text-[12px]"></i>}
                            </div>
                        )}

                        {/* Avatar */}
                        <div className="relative w-[50px] h-[50px] mr-[15px] flex-shrink-0">
                            {contact.avatar ? (
                                <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover border-2 border-[#00c2ff]" />
                            ) : (
                                <div className="w-full h-full rounded-full border-2 border-[#00c2ff] bg-gradient-to-tr from-[#00c2ff] to-[#007bff] flex items-center justify-center text-2xl text-white">
                                    <i className="fa-solid fa-user"></i>
                                </div>
                            )}
                            {contact.isOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00ff82] rounded-full border-2 border-[#0c0f14]"></div>}
                        </div>

                        {/* Info */}
                        <div className="flex flex-col flex-grow min-w-0 mr-2.5">
                            <div className="font-semibold text-base mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                {contact.name}
                            </div>
                            <div className={`text-sm whitespace-nowrap overflow-hidden text-ellipsis ${contact.unreadCount > 0 ? 'text-white font-semibold' : 'text-[#aaa]'}`}>
                                {contact.lastMessage}
                            </div>
                        </div>

                        {/* Time & Badge */}
                        <div className="flex flex-col items-end flex-shrink-0">
                             <div className={`text-xs mt-0.5 ${contact.unreadCount > 0 ? 'text-[#00c2ff] font-bold' : 'text-[#777]'}`}>
                                {contact.time}
                             </div>
                             {contact.unreadCount > 0 && (
                                <div className="bg-[#ff4d4d] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[20px] min-w-[18px] text-center mt-1">{contact.unreadCount}</div>
                             )}
                        </div>
                    </div>
                )) : (
                    <div className="text-center text-gray-500 mt-10">
                        <i className="fa-regular fa-comment-dots text-4xl mb-2"></i>
                        <p>Nenhuma mensagem ainda.</p>
                        <p className="text-xs mt-1">Inicie uma nova conversa no botão abaixo.</p>
                    </div>
                )}
            </div>
        </main>

        {/* FAB */}
        {!isSelectionMode && (
             <button 
                onClick={() => setIsNewChatOpen(true)}
                className={`fixed bottom-[105px] right-[20px] w-[60px] h-[60px] bg-[#00c2ff] border-none rounded-full text-white text-[28px] cursor-pointer shadow-[0_4px_12px_rgba(0,194,255,0.3)] z-10 flex items-center justify-center hover:bg-[#007bff] transition-transform duration-300 ${uiVisible ? 'scale-100' : 'scale-0'}`}
            >
                <i className="fa-solid fa-user-plus"></i>
            </button>
        )}

        {/* FOOTER */}
        <footer className={`fixed bottom-0 left-0 w-full bg-[#0c0f14] flex justify-around py-3.5 rounded-t-2xl z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.5)] transition-transform duration-300 ${uiVisible && !isSelectionMode ? 'translate-y-0' : 'translate-y-full'}`}>
            <button onClick={() => navigate('/feed')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 transition-all hover:text-white">
                <i className="fa-solid fa-newspaper"></i>
            </button>
            <button className="text-white text-[22px] cursor-pointer p-2 transition-all">
                <i className="fa-solid fa-comments"></i>
                {unreadMsgs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
            </button>
            <button onClick={() => navigate('/notifications')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 transition-all hover:text-white relative">
                <i className="fa-solid fa-bell"></i>
                {unreadNotifs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
            </button>
            <button onClick={() => navigate('/profile')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 transition-all hover:text-white">
                <i className="fa-solid fa-user"></i>
            </button>
        </footer>

        {/* NEW CHAT OVERLAY */}
        {isNewChatOpen && (
            <div className="fixed top-0 left-0 w-full h-full bg-[#0c0f14] z-[100] flex flex-col animate-slide-in-up">
                <div className="flex items-center p-4 border-b border-white/10 gap-4">
                    <button className="bg-none border-none text-[#00c2ff] text-xl cursor-pointer" onClick={() => setIsNewChatOpen(false)}>
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="text-lg font-semibold">Nova Conversa</div>
                </div>
                
                <div className="p-4 border-b border-white/5">
                    <input 
                        type="text" 
                        placeholder="Pesquisar contatos (Mútuos)..." 
                        value={newChatSearch}
                        onChange={(e) => setNewChatSearch(e.target.value)}
                        autoFocus
                        className="w-full bg-[#1a1e26] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00c2ff]"
                    />
                </div>

                <button className="flex items-center justify-center gap-2.5 w-[90%] mx-auto my-2.5 p-3 bg-[#00c2ff]/10 border border-[#00c2ff]/30 rounded-lg text-[#00c2ff] font-semibold text-sm cursor-pointer hover:bg-[#00c2ff]/20 transition-all" onClick={() => navigate('/global-search')}>
                    <i className="fa-solid fa-globe"></i> Encontrar novas pessoas
                </button>

                <div className="flex-1 overflow-y-auto py-2.5">
                    {filteredMutuals.length > 0 ? (
                        filteredMutuals.map(friend => (
                            <div key={friend.id} className="flex items-center p-3 px-5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => handleStartNewChat(friend.id)}>
                                {friend.avatar ? (
                                    <img src={friend.avatar} alt={friend.name} className="w-[45px] h-[45px] rounded-full mr-[15px] object-cover bg-[#333]" />
                                ) : (
                                    <div className="w-[45px] h-[45px] rounded-full mr-[15px] bg-[#333] flex items-center justify-center text-[#888]">
                                        <i className="fa-solid fa-user"></i>
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="font-semibold text-[15px] text-white">{friend.name}</span>
                                    <span className="text-[13px] text-[#888]">@{friend.username}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-10 text-[#777]">
                            <p>Nenhum contato mútuo encontrado.</p>
                            <p className="text-xs mt-1">Siga pessoas que te seguem para iniciar uma conversa.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
