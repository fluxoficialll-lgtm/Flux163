
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chatService, ChatMessage } from '../services/chatService';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { db } from '@/database';
import { useModal } from '../components/ModalSystem';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { LazyMedia } from '../components/LazyMedia';

export const Chat: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showConfirm } = useModal();
  const chatId = id || '1';

  // --- ESTADOS ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactHandle, setContactHandle] = useState(''); 
  const [contactAvatar, setContactAvatar] = useState<string | undefined>(undefined);
  const [contactStatus, setContactStatus] = useState('Offline');
  const [isBlocked, setIsBlocked] = useState(false);

  // Pagination
  const [loadingHistory, setLoadingHistory] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Seleção de Mensagens
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Pesquisa
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Gravação de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingInterval = useRef<any>(null);

  // Reprodução de Áudio
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const audioTimeoutRef = useRef<any>(null);

  // Estado para Zoom de Mídia (Foto/Vídeo)
  const [zoomedMedia, setZoomedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);

  // Media Preview State
  const [mediaPreview, setMediaPreview] = useState<{ file: File, url: string, type: 'image' | 'video' | 'file' } | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Refs para UI
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const currentUserEmail = authService.getCurrentUserEmail();

  // --- CARREGAR DADOS INICIAIS ---
  useEffect(() => {
      loadChatData();
      
      // Mark messages as read when entering the chat
      setTimeout(() => {
          chatService.markChatAsRead(chatId);
      }, 500);

  }, [chatId]);

  // --- REAL TIME SUBSCRIPTION ---
  useEffect(() => {
      const unsubscribeChat = db.subscribe('chats', () => {
          loadChatData(true);
      });
      const unsubscribeUser = db.subscribe('users', () => {
          loadChatData(true);
      });
      return () => { unsubscribeChat(); unsubscribeUser(); };
  }, [chatId]);

  const loadChatData = (isSilent = false) => {
      const chatData = chatService.getChat(chatId);
      const allMsgs = chatData.messages;
      
      setIsBlocked(chatData.isBlocked);

      // --- DYNAMIC HEADER RESOLUTION ---
      let targetUser = undefined;
      let displayName = chatData.contactName;
      let displayAvatar = undefined;
      let handle = '';

      if (chatId.includes('_') && chatId.includes('@') && currentUserEmail) {
          const parts = chatId.split('_');
          const otherEmail = parts.find(p => p !== currentUserEmail);
          
          if (otherEmail) {
              const allUsers = db.users.getAll(); 
              const userRecord = allUsers[otherEmail];
              
              if (userRecord) {
                  targetUser = userRecord;
                  displayName = userRecord.profile?.nickname || userRecord.profile?.name || otherEmail;
                  displayAvatar = userRecord.profile?.photoUrl;
                  handle = userRecord.profile?.name || '';
              } else {
                  displayName = otherEmail;
              }
          }
      } else {
          targetUser = authService.getUserByHandle(chatData.contactName);
          if (targetUser) {
              displayName = targetUser.profile?.nickname || targetUser.profile?.name || chatData.contactName;
              displayAvatar = targetUser.profile?.photoUrl;
              handle = targetUser.profile?.name || '';
          }
      }

      setContactName(displayName);
      setContactAvatar(displayAvatar);
      setContactHandle(handle);

      if (targetUser?.lastSeen) {
          const diff = Date.now() - targetUser.lastSeen;
          if (diff < 2 * 60 * 1000) {
              setContactStatus('Online');
          } else {
              const date = new Date(targetUser.lastSeen);
              const hours = date.getHours().toString().padStart(2, '0');
              const minutes = date.getMinutes().toString().padStart(2, '0');
              setContactStatus(`Visto por último às ${hours}:${minutes}`);
          }
      } else {
          setContactStatus('Offline');
      }

      setMessages(allMsgs);
  };

  const loadMoreHistory = async () => {
      if (loadingHistory) return;
      setLoadingHistory(true);
      
      const oldestId = messages[0]?.id;
      await chatService.fetchChatMessages(chatId, 50, oldestId);
      
      setLoadingHistory(false);
  };

  useEffect(() => {
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      if (isRecording) {
          recordingInterval.current = setInterval(() => {
              setRecordingTime(prev => prev + 1);
          }, 1000);
      } else {
          clearInterval(recordingInterval.current);
          setRecordingTime(0);
      }
      return () => clearInterval(recordingInterval.current);
  }, [isRecording]);

  const getCurrentUserInfo = () => {
      const user = authService.getCurrentUser();
      return {
          name: user?.profile?.nickname || user?.profile?.name || 'Você',
          avatar: user?.profile?.photoUrl,
          email: user?.email
      };
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      const userInfo = getCurrentUserInfo();
      const newMessage: ChatMessage = {
          id: Date.now(),
          text: inputText,
          type: 'sent',
          contentType: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent',
          senderEmail: userInfo.email,
          senderAvatar: userInfo.avatar,
          senderName: userInfo.name
      };
      
      chatService.sendMessage(chatId, newMessage);
      setInputText('');
    }
  };

  const handleAttachmentClick = () => {
      fileInputRef.current?.click();
  };

  const handleDocClick = () => {
      docInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isDoc: boolean = false) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      let type: 'image' | 'video' | 'file' = 'file';
      
      if (!isDoc) {
          type = file.type.startsWith('video/') ? 'video' : 'image';
      } else {
          type = 'file';
      }
      
      setMediaPreview({ file, url, type });
      setMediaCaption(''); 
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSendMedia = async () => {
      if (!mediaPreview || isUploading) return;

      setIsUploading(true);
      try {
          // PADRONIZAÇÃO R2: Upload antes de enviar a mensagem
          const mediaUrl = await postService.uploadMedia(mediaPreview.file, 'chats');
          const userInfo = getCurrentUserInfo();
          
          let text = mediaCaption.trim();
          if (!text) {
              if (mediaPreview.type === 'video') text = 'Vídeo';
              else if (mediaPreview.type === 'image') text = 'Foto';
              else text = 'Arquivo';
          }

          const newMessage: ChatMessage = {
              id: Date.now(),
              text: text,
              type: 'sent',
              contentType: mediaPreview.type,
              mediaUrl: mediaUrl,
              fileName: mediaPreview.type === 'file' ? mediaPreview.file.name : undefined,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'sent',
              senderEmail: userInfo.email,
              senderAvatar: userInfo.avatar,
              senderName: userInfo.name
          };

          chatService.sendMessage(chatId, newMessage);
          setMediaPreview(null);
          setMediaCaption('');
      } catch (e) {
          alert("Erro ao enviar mídia.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleAudioAction = () => {
      if (inputText.length > 0) {
          handleSendMessage();
      } else {
          if (isRecording) {
              setIsRecording(false);
              const durationStr = formatTime(recordingTime);
              const userInfo = getCurrentUserInfo();
              
              const newMessage: ChatMessage = {
                  id: Date.now(),
                  text: 'Mensagem de Voz',
                  type: 'sent',
                  contentType: 'audio',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  status: 'sent',
                  duration: durationStr,
                  senderEmail: userInfo.email,
                  senderAvatar: userInfo.avatar,
                  senderName: userInfo.name
              };
              chatService.sendMessage(chatId, newMessage);
          } else {
              setIsRecording(true);
          }
      }
  };

  const cancelRecording = () => {
      setIsRecording(false);
  };

  const toggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      setSelectedIds([]);
      setIsMenuOpen(false);
      setIsSearchOpen(false); 
  };

  const toggleMessageSelection = (id: number) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(selectedIds.filter(sid => sid !== id));
      } else {
          setSelectedIds([...selectedIds, id]);
      }
  };

  const deleteSelectedMessages = async () => {
      if (selectedIds.length === 0) return;

      const confirmed = await showConfirm(
          "Excluir Mensagens",
          `Excluir ${selectedIds.length} mensagens?`,
          "Excluir",
          "Cancelar"
      );

      if (confirmed) {
          chatService.deleteMessages(chatId, selectedIds);
          setIsSelectionMode(false);
          setSelectedIds([]);
      }
  };

  const toggleSearchMode = () => {
      setIsSearchOpen(!isSearchOpen);
      setSearchTerm('');
      setIsMenuOpen(false);
      setIsSelectionMode(false); 
  };

  const filteredMessages = messages.filter(m => 
      m.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClearChat = async () => {
      const confirmed = await showConfirm(
          "Limpar Conversa",
          "Tem certeza que deseja limpar toda a conversa? Isso não pode ser desfeito.",
          "Limpar",
          "Cancelar"
      );

      if (confirmed) {
          chatService.clearChat(chatId);
          setIsMenuOpen(false);
      }
  };

  const toggleBlockUser = async () => {
      const action = isBlocked ? "desbloquear" : "bloquear";
      const confirmed = await showConfirm(
          `${action === 'bloquear' ? 'Bloquear' : 'Desbloquear'} Usuário`,
          `Deseja realmente ${action} este contato?`,
          action === 'bloquear' ? 'Bloquear' : 'Desbloquear',
          "Cancelar"
      );

      if (confirmed) {
          const newStatus = chatService.toggleBlock(chatId);
          setIsBlocked(newStatus);
          setIsMenuOpen(false);
      }
  };

  const handlePlayAudio = (id: number, durationStr?: string) => {
      if (playingAudioId === id) {
          setPlayingAudioId(null);
          if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      } else {
          setPlayingAudioId(id);
          
          let durationMs = 3000; 
          if (durationStr) {
              const parts = durationStr.split(':');
              if (parts.length === 2) {
                  const min = parseInt(parts[0]);
                  const sec = parseInt(parts[1]);
                  durationMs = (min * 60 + sec) * 1000;
              }
          }

          if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
          audioTimeoutRef.current = setTimeout(() => {
              setPlayingAudioId(null);
          }, durationMs);
      }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderStatusIcon = (status: string) => {
      if (status === 'sent') return <i className="fa-solid fa-check" style={{ color: 'rgba(255,255,255,0.6)' }}></i>; 
      if (status === 'delivered') return <i className="fa-solid fa-check-double" style={{ color: 'rgba(255,255,255,0.6)' }}></i>; 
      if (status === 'read') return <i className="fa-solid fa-check-double" style={{ color: '#00c2ff' }}></i>; 
      return null;
  };

  // Safe Navigation Handler
  const navigateToProfile = () => {
      if (contactHandle) {
          navigate(`/user/${contactHandle}`);
      } else {
          if (chatId.includes('@') && chatId.includes('_')) {
             const parts = chatId.split('_');
             const other = parts.find(p => p !== currentUserEmail);
             if (other) {
                 console.warn("User handle not found for profile navigation");
             }
          }
      }
  };

  const renderMessageItem = (index: number, msg: ChatMessage) => {
      const isMe = msg.senderEmail ? msg.senderEmail === currentUserEmail : msg.type === 'sent';

      return (
        <div className={`message-container ${isMe ? 'sent' : 'received'}`} style={{display: 'flex', marginBottom: '8px', alignItems: 'flex-end', justifyContent: isMe ? 'flex-end' : 'flex-start', paddingLeft:'10px', paddingRight:'10px'}}>
            
            {isSelectionMode && (
                <div 
                    className={`select-checkbox ${selectedIds.includes(msg.id) ? 'selected' : ''}`}
                    onClick={() => toggleMessageSelection(msg.id)}
                    style={{
                        marginRight: '10px', width: '20px', height: '20px', borderRadius: '50%',
                        border: '2px solid #555', flexShrink: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: selectedIds.includes(msg.id) ? '#00c2ff' : 'transparent',
                        borderColor: selectedIds.includes(msg.id) ? '#00c2ff' : '#555'
                    }}
                >
                    {selectedIds.includes(msg.id) && <span style={{fontSize:'12px', color:'#000', fontWeight:'bold'}}>✔</span>}
                </div>
            )}

            <div className="message-bubble" onClick={() => isSelectionMode && toggleMessageSelection(msg.id)} style={{
                maxWidth: '320px', padding: '8px 12px', borderRadius: '12px',
                fontSize: '15px', lineHeight: 1.4, position: 'relative', minWidth: '80px',
                backgroundColor: isMe ? '#0088cc' : '#2e3646',
                color: '#fff',
                borderBottomRightRadius: isMe ? '2px' : '12px',
                borderBottomLeftRadius: isMe ? '12px' : '2px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                
                {msg.product && (
                    <div className="msg-product-card" onClick={(e) => { e.stopPropagation(); navigate(`/marketplace/product/${msg.product?.id}`); }}>
                        {msg.product.image ? (
                            <img src={msg.product.image} className="msg-prod-img" alt="Produto" />
                        ) : (
                            <div className="msg-prod-img" style={{display:'flex', alignItems:'center', justifyContent:'center'}}><i className="fa-solid fa-box"></i></div>
                        )}
                        <div className="msg-prod-info">
                            <div className="msg-prod-title">{msg.product.title}</div>
                            <div className="msg-prod-price">R$ {msg.product.price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                            <div className="msg-prod-link">Ver anúncio <i className="fa-solid fa-chevron-right"></i></div>
                        </div>
                    </div>
                )}

                {msg.contentType === 'audio' && (
                    <div className={`audio-player ${playingAudioId === msg.id ? 'playing' : ''}`} style={{display: 'flex', alignItems: 'center', gap: '12px', width: '260px', padding: '10px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px'}}>
                        <div 
                            className={`audio-control ${playingAudioId === msg.id ? 'playing' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handlePlayAudio(msg.id, msg.duration); }}
                            style={{
                                width: '45px', height: '45px', background: playingAudioId === msg.id ? '#00c2ff' : 'rgba(255,255,255,0.2)',
                                color: playingAudioId === msg.id ? '#000' : '#fff',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontSize: '18px', flexShrink: 0
                            }}
                        >
                            <i className={`fa-solid ${playingAudioId === msg.id ? 'fa-pause' : 'fa-play'}`}></i>
                        </div>
                        <div className="audio-info" style={{display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center'}}>
                            <span style={{fontSize:'13px', fontWeight: 'bold'}}>Áudio ({msg.duration})</span>
                            <div className="audio-waveform" style={{height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', width: '100%', marginTop: '6px', position: 'relative', overflow: 'hidden'}}>
                                <div className="audio-progress" style={{height: '100%', background: '#00c2ff', width: playingAudioId === msg.id ? '100%' : '0%', borderRadius: '3px', transition: playingAudioId === msg.id ? 'width 3s linear' : 'width 0.2s linear'}}></div>
                            </div>
                        </div>
                    </div>
                )}

                {(msg.contentType === 'image' || msg.contentType === 'video') && msg.mediaUrl && (
                    <div className="media-content" style={{width: '100%', maxWidth: '320px', borderRadius: '12px', marginBottom: '5px', overflow: 'hidden', background: 'transparent'}}>
                        <LazyMedia 
                            src={msg.mediaUrl} 
                            type={msg.contentType} 
                            onClick={(e) => { if(!isSelectionMode) { e.stopPropagation(); setZoomedMedia({ url: msg.mediaUrl!, type: msg.contentType as 'image' | 'video' }); } }}
                        />
                    </div>
                )}

                {msg.contentType === 'file' && msg.mediaUrl && (
                    <a 
                        href={!isSelectionMode ? msg.mediaUrl : undefined} 
                        download={!isSelectionMode ? (msg.fileName || 'arquivo') : undefined} 
                        className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/10 hover:bg-black/40 transition-colors cursor-pointer no-underline text-white"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => isSelectionMode && e.preventDefault()}
                    >
                        <div className="w-10 h-10 bg-[#00c2ff]/20 rounded-lg flex items-center justify-center flex-shrink-0 text-[#00c2ff]">
                            <i className="fa-solid fa-file-lines text-xl"></i>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-sm truncate">{msg.fileName || 'Arquivo'}</span>
                            <span className="text-xs text-gray-300">Clique para baixar</span>
                        </div>
                    </a>
                )}

                {msg.text && (msg.contentType === 'text' || (msg.text !== 'Foto' && msg.text !== 'Vídeo' && msg.text !== 'Mensagem de Voz' && msg.text !== 'Arquivo')) && (
                    <div className={`message-text ${msg.contentType !== 'text' || msg.product ? 'mt-1' : ''}`} style={{wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: '#fff'}}>
                        {msg.text}
                    </div>
                )}
                
                <div className="message-meta" style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontStyle: 'italic', fontSize: '10px', marginTop: '4px', gap: '4px', opacity: 0.8}}>
                    <span>{msg.timestamp}</span>
                    {isMe && renderStatusIcon(msg.status)}
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="messages-page h-[100dvh] flex flex-col overflow-hidden" style={{ background: 'radial-gradient(circle at top left, #0c0f14, #0a0c10)', color: '#fff', fontFamily: "'Roboto', sans-serif", fontWeight: 500, textShadow: '0 0 3px rgba(0, 194, 255, 0.1)' }}>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      <style>{`
        /* PRODUCT CARD STYLE */
        .msg-product-card {
            display: flex; gap: 10px; background: rgba(0,0,0,0.2); 
            padding: 8px; border-radius: 8px; margin-bottom: 5px;
            align-items: center; border: 1px solid rgba(255,255,255,0.1);
            cursor: pointer;
        }
        .msg-product-card:hover {
            background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.2);
        }
        .msg-prod-img {
            width: 50px; height: 50px; border-radius: 6px; object-fit: cover; background: #333;
        }
        .msg-prod-info {
            display: flex; flex-direction: column; flex-grow: 1; min-width: 0;
        }
        .msg-prod-title {
            font-size: 13px; font-weight: 600; color: #fff;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .msg-prod-price {
            font-size: 12px; font-weight: 700; color: #00ff82;
        }
        .msg-prod-link {
            font-size: 10px; color: #aaa; margin-top: 2px;
        }
      `}</style>
      
      {/* HEADER DINÂMICO */}
      {isSelectionMode ? (
          <header className="selection-mode" style={{
            display:'flex', alignItems:'center', padding:'12px 16px',
            background: '#0a2a38', position:'fixed', width:'100%', zIndex:10, 
            borderBottom:'1px solid rgba(255,255,255,0.1)', top: 0, height: '60px', justifyContent: 'space-between'
          }}>
              <div className="flex items-center">
                  <button className="selection-action" onClick={toggleSelectionMode} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                      <i className="fa-solid fa-xmark"></i>
                  </button>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '10px' }}>
                      {selectedIds.length} selecionada(s)
                  </span>
              </div>
              <button className="selection-action delete-btn" onClick={deleteSelectedMessages} disabled={selectedIds.length === 0} style={{background:'none', border:'none', color:'#ff4d4d', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                  <i className="fa-solid fa-trash"></i>
              </button>
          </header>
      ) : isSearchOpen ? (
          <header className="search-mode" style={{
            display:'flex', alignItems:'center', padding:'12px 16px',
            background: '#15191e', position:'fixed', width:'100%', zIndex:10, 
            borderBottom:'1px solid rgba(255,255,255,0.1)', top: 0, height: '60px'
          }}>
              <button className="back-button" onClick={toggleSearchMode} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                  <i className="fa-solid fa-arrow-left"></i>
              </button>
              <input 
                autoFocus
                type="text" 
                className="header-search-input" 
                placeholder="Pesquisar na conversa..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                    flexGrow: 1, background: 'rgba(255,255,255,0.1)', border: 'none',
                    borderRadius: '20px', padding: '8px 15px', color: '#fff', margin: '0 10px', fontSize: '14px', outline: 'none'
                }}
              />
              <button className="back-button" onClick={() => setSearchTerm('')} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                  <i className="fa-solid fa-xmark"></i>
              </button>
          </header>
      ) : (
          <header style={{
            display:'flex', alignItems:'center', padding:'12px 16px',
            background: '#0c0f14', position:'fixed', width:'100%', zIndex:10, 
            borderBottom:'1px solid rgba(255,255,255,0.1)', top: 0, height: '60px'
          }}>
            <button className="back-button" onClick={() => navigate('/messages')} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                <i className="fa-solid fa-arrow-left"></i>
            </button>
            
            <div className="chat-info" onClick={navigateToProfile} style={{display: 'flex', alignItems: 'center', flexGrow: 1, marginLeft: '10px', cursor: 'pointer'}}>
                <div className="chat-avatar" style={{
                    width: '36px', height: '36px', borderRadius: '50%', 
                    background: '#00c2ff', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '16px', fontWeight: 700, marginRight: '10px', overflow: 'hidden'
                }}>
                    {contactAvatar ? (
                        <img src={contactAvatar} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                    ) : (
                        contactName.charAt(0) || 'C'
                    )}
                </div>
                <div className="chat-details">
                    <h2 style={{fontSize: '16px', color: '#fff', lineHeight: 1.2, fontWeight: 700}}>{contactName}</h2>
                    <p style={{fontSize: '12px', color: '#00c2ff', opacity: 0.8, fontWeight: 500}}>{isBlocked ? 'Bloqueado' : contactStatus}</p>
                </div>
            </div>
            
            <div className="options-container" style={{position: 'relative', marginLeft: '15px'}}>
                <button 
                    id="optionsButton" 
                    ref={buttonRef}
                    className="options-button" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    style={{background:'none', border:'none', color:'#00c2ff', fontSize:'20px', cursor:'pointer', padding: '5px'}}
                >
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>

                <div id="optionsMenu" ref={menuRef} className={`dropdown-menu ${isMenuOpen ? 'active' : ''}`} style={{
                    position: 'absolute', top: '40px', right: 0,
                    background: '#1a1e26', border: '1px solid rgba(0, 194, 255, 0.2)',
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                    width: '200px', zIndex: 20, display: isMenuOpen ? 'block' : 'none', overflow: 'hidden'
                }}>
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                        <button onClick={() => { toggleSearchMode(); }} style={{display: 'flex', alignItems: 'center', padding: '12px 15px', color: '#fff', background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', textAlign: 'left'}}>
                            <i className="fa-solid fa-magnifying-glass" style={{marginRight: '10px', width: '20px', textAlign: 'center'}}></i> Pesquisar
                        </button>
                        <button onClick={() => { toggleSelectionMode(); }} style={{display: 'flex', alignItems: 'center', padding: '12px 15px', color: '#fff', background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', textAlign: 'left'}}>
                            <i className="fa-solid fa-check-double" style={{marginRight: '10px', width: '20px', textAlign: 'center'}}></i> Selecionar
                        </button>
                        <button onClick={() => { toggleBlockUser(); }} style={{display: 'flex', alignItems: 'center', padding: '12px 15px', color: '#fff', background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', textAlign: 'left'}}>
                            <i className="fa-solid fa-ban" style={{marginRight: '10px', width: '20px', textAlign: 'center'}}></i> {isBlocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button onClick={() => { handleClearChat(); }} style={{display: 'flex', alignItems: 'center', padding: '12px 15px', color: '#ff4d4d', background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', textAlign: 'left'}}>
                            <i className="fa-solid fa-trash" style={{marginRight: '10px', width: '20px', textAlign: 'center'}}></i> Limpar conversa
                        </button>
                    </div>
                </div>
            </div>
          </header>
      )}

      {/* ÁREA DE MENSAGENS VIRTUALIZADA */}
      <main style={{flexGrow:1, width:'100%', display: 'flex', flexDirection: 'column', paddingTop: '60px'}}>
        {messages.length === 0 && !searchTerm && !loadingHistory ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50 mt-20 animate-fade-in">
                <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-700 shadow-[0_0_20px_rgba(0,194,255,0.1)]">
                    <i className="fa-regular fa-comments text-4xl text-[#00c2ff]"></i>
                </div>
                <p className="text-lg font-bold text-white mb-1">Chat Limpo</p>
                <p className="text-sm text-gray-400 text-center max-w-xs">
                    Envie uma mensagem para começar a conversa.
                </p>
            </div>
        ) : (
            <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%', paddingBottom: '80px' }}
                data={filteredMessages}
                startReached={loadMoreHistory}
                initialTopMostItemIndex={filteredMessages.length - 1} // Scroll to bottom initially
                followOutput="smooth" // Auto-scroll on new message
                itemContent={(index, msg) => renderMessageItem(index, msg)}
                components={{
                    Header: () => loadingHistory ? <div className="w-full flex justify-center py-2"><i className="fa-solid fa-circle-notch fa-spin text-[#00c2ff]"></i></div> : null,
                    Footer: () => <div style={{ height: '80px' }} /> // Spacer for input area
                }}
            />
        )}
      </main>

      {/* ÁREA DE INPUT OU BLOQUEIO */}
      {isBlocked ? (
          <div className="blocked-footer" style={{
            position: 'fixed', bottom: '0', width: '100%', background: '#1a1a1a',
            padding: '15px', textAlign: 'center', color: '#ff4d4d', fontStyle: 'italic', fontWeight: 'bold',
            borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 15, display: 'flex', justifyContent: 'center'
          }}>
              Você bloqueou este contato.
          </div>
      ) : (
          <div className="chat-input-area" style={{
            position: 'fixed', bottom: '0', width: '100%', background: '#0c0f14',
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
            borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 15, paddingBottom: '20px'
          }}>
            {isRecording ? (
                // UI DE GRAVAÇÃO
                <>
                    <div className="recording-ui" style={{flexGrow: 1, display: 'flex', alignItems: 'center', padding: '0 10px', color: '#ff4d4d'}}>
                        <div className="recording-dot" style={{width: '10px', height: '10px', background: '#ff4d4d', borderRadius: '50%', marginRight: '10px'}}></div>
                        <span>Gravando {formatTime(recordingTime)}</span>
                    </div>
                    <button onClick={cancelRecording} style={{color: '#ff4d4d', fontSize: '14px', fontWeight: 'bold', background:'none', border:'none', cursor:'pointer', marginRight: '10px'}}>
                        Cancelar
                    </button>
                </>
            ) : (
                // UI DE TEXTO NORMAL
                <>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#1a1e26', borderRadius: '24px', padding: '0 5px' }}>
                        <input 
                            type="text" 
                            placeholder="Digite sua mensagem..." 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            disabled={isSelectionMode}
                            style={{
                                flexGrow: 1, padding: '12px 15px', border: 'none', background: 'transparent',
                                color: '#fff', fontSize: '16px', outline: 'none', borderRadius: '24px'
                            }}
                        />
                        <button 
                            className="attachment-button" 
                            title="Arquivos" 
                            disabled={isSelectionMode}
                            onClick={handleDocClick}
                            style={{background:'none', border:'none', color:'#aaa', fontSize:'18px', cursor:'pointer', padding:'8px 10px'}}
                        >
                            <i className="fa-solid fa-paperclip"></i>
                        </button>
                        <button 
                            className="attachment-button" 
                            title="Galeria" 
                            disabled={isSelectionMode}
                            onClick={handleAttachmentClick}
                            style={{background:'none', border:'none', color:'#aaa', fontSize:'18px', cursor:'pointer', padding:'8px 10px 8px 0'}}
                        >
                            <i className="fa-solid fa-camera"></i>
                        </button>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*,video/*" 
                        style={{display:'none'}} 
                        onChange={(e) => handleFileChange(e, false)}
                    />
                    <input 
                        type="file" 
                        ref={docInputRef} 
                        // Specific list for broad document support
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" 
                        style={{display:'none'}} 
                        onChange={(e) => handleFileChange(e, true)}
                    />
                </>
            )}
            
            <button 
                id="sendButton" 
                title={inputText.length > 0 ? "Enviar" : (isRecording ? "Enviar Áudio" : "Gravar")}
                onClick={handleAudioAction}
                disabled={isSelectionMode || isUploading}
                style={{
                    background: inputText.trim() || isRecording ? '#00c2ff' : '#00c2ff', 
                    border:'none', color: '#000', 
                    fontSize:'18px', cursor: 'pointer', 
                    width: '48px', height: '48px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifySelf: 'center',
                    flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}
            >
                {isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${inputText.length > 0 ? 'fa-paper-plane' : (isRecording ? 'fa-paper-plane' : 'fa-microphone')}`}></i>}
            </button>
          </div>
      )}

      {/* MINIMALIST MEDIA PREVIEW OVERLAY (UPDATED) */}
      {mediaPreview && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-sm bg-[#1a1e26] rounded-2xl overflow-hidden shadow-2xl border border-white/10 transform transition-all scale-100 flex flex-col">
                  {/* Media Container */}
                  <div className="relative w-full bg-black flex items-center justify-center aspect-square" style={{ maxHeight: '60vh' }}>
                      {mediaPreview.type === 'video' ? (
                          <video src={mediaPreview.url} controls className="w-full h-full object-contain" />
                      ) : mediaPreview.type === 'image' ? (
                          <img src={mediaPreview.url} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                          // File Preview UI
                          <div className="flex flex-col items-center justify-center p-6 text-gray-300">
                              <i className="fa-solid fa-file-lines text-6xl mb-4 text-[#00c2ff]"></i>
                              <p className="text-center font-semibold break-all px-4">{mediaPreview.file.name}</p>
                              <p className="text-xs text-gray-500 mt-2">{(mediaPreview.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                      )}
                      
                      {/* Close Button on Media */}
                      <button 
                          onClick={() => setMediaPreview(null)}
                          disabled={isUploading}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-sm z-10"
                      >
                          <i className="fa-solid fa-xmark"></i>
                      </button>
                  </div>

                  {/* Input & Action */}
                  <div className="p-3 bg-[#1a1e26] flex gap-2 items-center">
                      <input 
                          type="text" 
                          placeholder="Adicione uma legenda..." 
                          value={mediaCaption}
                          onChange={(e) => setMediaCaption(e.target.value)}
                          disabled={isUploading}
                          className="flex-1 bg-[#0c0f14] text-gray-100 text-sm px-4 py-3 rounded-xl border border-white/5 focus:border-[#00c2ff]/50 outline-none transition-all placeholder-gray-500"
                          autoFocus
                      />
                      <button 
                          onClick={handleSendMedia}
                          disabled={isUploading}
                          className="w-12 h-12 bg-[#00c2ff] rounded-xl text-black flex items-center justify-center text-lg hover:bg-[#00aaff] transition-transform active:scale-95 shadow-lg shadow-blue-500/20"
                      >
                          {isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* LIGHTBOX OVERLAY (VIEW ONLY) */}
      {zoomedMedia && !mediaPreview && (
          <div 
            className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center p-2"
            onClick={() => setZoomedMedia(null)}
          >
              <button 
                className="absolute top-4 right-4 text-white text-4xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center z-50"
                onClick={() => setZoomedMedia(null)}
              >
                  &times;
              </button>
              
              {zoomedMedia.type === 'video' ? (
                  <video 
                    src={zoomedMedia.url} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-full object-contain shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />
              ) : (
                  <img 
                    src={zoomedMedia.url} 
                    alt="Zoom" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()} 
                  />
              )}
          </div>
      )}
    </div>
  );
};
