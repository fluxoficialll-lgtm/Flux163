
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { chatService } from '../services/chatService'; 
import { authService } from '../services/authService';
import { privacyService } from '../services/privacyService'; 
import { postService } from '../services/postService';
import { db } from '@/database';
import { Group, ChatMessage } from '../types';
import { useModal } from '../components/ModalSystem';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { LazyMedia } from '../components/LazyMedia';

export const GroupChat: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showOptions } = useModal(); 
  const [group, setGroup] = useState<Group | null>(null);
  
  const [isCreator, setIsCreator] = useState(false);
  const [canPost, setCanPost] = useState(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [loadingHistory, setLoadingHistory] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<number[]>([]);

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryTab, setGalleryTab] = useState<'all' | 'image' | 'video'>('all');

  const [cooldown, setCooldown] = useState(0);
  const [maxCooldown, setMaxCooldown] = useState(0); 

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingInterval = useRef<any>(null);

  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
  const audioTimeoutRef = useRef<any>(null);

  const [zoomedMedia, setZoomedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);

  const [mediaPreview, setMediaPreview] = useState<{ file: File, url: string, type: 'image' | 'video' | 'file' } | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [inGracePeriod, setInGracePeriod] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const currentUserEmail = authService.getCurrentUserEmail();

  useEffect(() => {
      if (id) {
          const loadedGroup = groupService.getGroupById(id);

          if (loadedGroup) {
              setGroup(loadedGroup);
              const isOwner = loadedGroup.creatorEmail === currentUserEmail;
              const isAdmin = isOwner || (currentUserEmail && loadedGroup.admins?.includes(currentUserEmail));
              
              setIsCreator(isOwner);

              if (isAdmin) {
                  setCanPost(true);
              } else {
                  setCanPost(!loadedGroup.settings?.onlyAdminsPost);
              }

              if (loadedGroup.isVip) {
                  privacyService.enable();

                  if (!isOwner && currentUserEmail) {
                      const vipStatus = groupService.checkVipStatus(loadedGroup.id, currentUserEmail);
                      
                      if (vipStatus === 'expired' || vipStatus === 'none') {
                          privacyService.disable();
                          navigate(`/vip-group-sales/${loadedGroup.id}`, { replace: true });
                          return;
                      }
                      
                      if (vipStatus === 'grace_period') {
                          setInGracePeriod(true);
                      }
                  }
              }
              
              loadMessages();
              chatService.markChatAsRead(id);

          } else {
              navigate('/groups');
          }
      }

      return () => {
          privacyService.disable();
      };
  }, [id, navigate]);

  const loadMessages = () => {
      if (!id) return;
      const chatData = chatService.getChat(id);
      setMessages(chatData.messages || []);
  };

  useEffect(() => {
      const unsubscribe = db.subscribe('chats', () => {
          loadMessages();
      });
      const unsubscribeGroup = db.subscribe('groups', () => {
          if (id) {
              const updatedGroup = groupService.getGroupById(id);
              if (updatedGroup) {
                  const isOwner = updatedGroup.creatorEmail === currentUserEmail;
                  const isAdmin = isOwner || (currentUserEmail && updatedGroup.admins?.includes(currentUserEmail));
                  if (isAdmin) setCanPost(true);
                  else setCanPost(!updatedGroup.settings?.onlyAdminsPost);
              }
          }
      });

      return () => { unsubscribe(); unsubscribeGroup(); };
  }, [id]);

  const loadMoreHistory = async () => {
      if (!id || loadingHistory) return;
      setLoadingHistory(true);
      
      const oldestId = messages[0]?.id;
      await chatService.fetchChatMessages(id, 50, oldestId);
      setLoadingHistory(false);
  };

  const displayMessages = useMemo(() => {
      if (!searchQuery) return messages;
      return messages.filter(m => m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [messages, searchQuery]);

  useEffect(() => {
      if (group?.settings?.msgSlowMode && !isCreator && currentUserEmail) {
          const interval = group.settings.msgSlowModeInterval || 30;
          const myLastMsg = [...messages].reverse().find(m => m.senderEmail === currentUserEmail);
          
          if (myLastMsg) {
              const now = Date.now();
              const elapsedSeconds = (now - myLastMsg.id) / 1000;
              
              if (elapsedSeconds < interval) {
                  const remaining = Math.ceil(interval - elapsedSeconds);
                  setCooldown(remaining);
                  setMaxCooldown(interval);
              }
          }
      }
  }, [messages, group, isCreator, currentUserEmail]);

  useEffect(() => {
      if (cooldown <= 0) return;
      const timer = setInterval(() => {
          setCooldown(prev => {
              if (prev <= 1) return 0;
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendMessage = () => {
      if (cooldown > 0) return; 
      if (inputText.trim()) {
          const userInfo = authService.getCurrentUser();
          const newMessage: ChatMessage = {
              id: Date.now(),
              senderName: userInfo?.profile?.nickname || userInfo?.profile?.name || 'Você',
              senderAvatar: userInfo?.profile?.photoUrl,
              senderEmail: userInfo?.email,
              text: inputText,
              type: 'sent',
              contentType: 'text',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'sent'
          };
          if (id) chatService.sendMessage(id, newMessage);
          setInputText('');
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isDoc: boolean = false) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      let type: 'image' | 'video' | 'file' = 'file';
      if (!isDoc) { type = file.type.startsWith('video/') ? 'video' : 'image'; } else { type = 'file'; }
      setMediaPreview({ file, url, type });
      setMediaCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleSendMedia = async () => {
      if (!mediaPreview || cooldown > 0 || isUploading) return;

      setIsUploading(true);
      try {
          // PADRONIZAÇÃO R2: Mídias de chat de grupo para group_chats
          const uploadedUrl = await postService.uploadMedia(mediaPreview.file, 'group_chats');
          const userInfo = authService.getCurrentUser();
          
          let text = mediaCaption.trim();
          if (!text) { 
              if (mediaPreview.type === 'video') text = 'Vídeo'; 
              else if (mediaPreview.type === 'image') text = 'Foto'; 
              else text = 'Arquivo'; 
          }

          const newMessage: ChatMessage = {
              id: Date.now(),
              senderName: userInfo?.profile?.nickname || userInfo?.profile?.name || 'Você',
              senderAvatar: userInfo?.profile?.photoUrl,
              senderEmail: userInfo?.email,
              text: text,
              type: 'sent',
              contentType: mediaPreview.type,
              mediaUrl: uploadedUrl,
              fileName: mediaPreview.type === 'file' ? mediaPreview.file.name : undefined,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'sent'
          };
          if (id) chatService.sendMessage(id, newMessage);
          setMediaPreview(null);
          setMediaCaption('');
      } catch (e) {
          alert("Erro ao enviar mídia.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleAudioAction = () => {
      if (cooldown > 0) return;
      if (inputText.length > 0) { handleSendMessage(); } else {
          if (isRecording) {
              setIsRecording(false);
              const userInfo = authService.getCurrentUser();
              const durationStr = formatTime(recordingTime);
              const newMessage: ChatMessage = {
                  id: Date.now(),
                  senderName: userInfo?.profile?.nickname || userInfo?.profile?.name || 'Você',
                  senderAvatar: userInfo?.profile?.photoUrl,
                  senderEmail: userInfo?.email,
                  text: 'Mensagem de Voz',
                  type: 'sent',
                  contentType: 'audio',
                  duration: durationStr,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  status: 'sent'
              };
              if (id) chatService.sendMessage(id, newMessage);
          } else { setIsRecording(true); }
      }
  };

  const formatTime = (seconds: number) => { const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins}:${secs < 10 ? '0' : ''}${secs}`; };

  const handlePlayAudio = (id: number, durationStr?: string) => {
      if (playingAudioId === id) {
          setPlayingAudioId(null);
          if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
      } else {
          setPlayingAudioId(id);
          let durationMs = 3000; 
          if (durationStr) {
              const parts = durationStr.split(':');
              if (parts.length === 2) { const min = parseInt(parts[0]); const sec = parseInt(parts[1]); durationMs = (min * 60 + sec) * 1000; }
          }
          if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
          audioTimeoutRef.current = setTimeout(() => { setPlayingAudioId(null); }, durationMs);
      }
  };

  const renderStatusIcon = (status: string) => {
      if (status === 'sent') return <i className="fa-solid fa-check" style={{ color: 'rgba(255,255,255,0.6)' }}></i>; 
      if (status === 'delivered') return <i className="fa-solid fa-check-double" style={{ color: 'rgba(255,255,255,0.6)' }}></i>; 
      if (status === 'read') return <i className="fa-solid fa-check-double" style={{ color: '#00c2ff' }}></i>; 
      return null;
  };

  const renderMessageItem = (index: number, msg: ChatMessage) => {
      const isMe = msg.senderEmail ? msg.senderEmail === currentUserEmail : msg.type === 'sent';
      const isSelected = selectedMsgIds.includes(msg.id);

      return (
          <div className={`message-container ${isMe ? 'sent' : 'received'} ${isSelected && isSelectionMode ? 'selected' : ''}`} style={{display: 'flex', marginBottom: '8px', alignItems: 'flex-end', justifyContent: isMe ? 'flex-end' : 'flex-start', paddingLeft: '10px', paddingRight: '10px'}}>
              {isSelectionMode && (
                  <div 
                      className={`select-checkbox ${isSelected ? 'selected' : ''}`}
                      onClick={() => { if(selectedMsgIds.includes(msg.id)) setSelectedMsgIds(prev => prev.filter(m => m !== msg.id)); else setSelectedMsgIds(prev => [...prev, msg.id]); }}
                      style={{
                          marginRight: '10px', width: '20px', height: '20px', borderRadius: '50%',
                          border: '2px solid #555', flexShrink: 0, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isSelected ? '#00c2ff' : 'transparent',
                          borderColor: isSelected ? '#00c2ff' : '#555'
                      }}
                  >
                      {isSelected && <span style={{fontSize:'12px', color:'#000', fontWeight:'bold'}}>✔</span>}
                  </div>
              )}

              <div 
                className="message-bubble" 
                style={{
                  maxWidth: '75%', padding: '8px 12px', borderRadius: '12px',
                  fontSize: '15px', lineHeight: 1.4, position: 'relative', minWidth: '80px',
                  backgroundColor: isMe ? '#0088cc' : '#2e3646',
                  color: '#fff',
                  borderBottomRightRadius: isMe ? '2px' : '12px',
                  borderBottomLeftRadius: isMe ? '12px' : '2px',
                  border: isSelected && isSelectionMode ? '2px solid #00c2ff' : '1px solid rgba(255,255,255,0.1)'
              }}>
                  {!isMe && (
                      <div className="sender-name" style={{fontSize: '10px', fontWeight: 700, marginBottom: '2px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '5px'}}>
                          {msg.senderAvatar && <img src={msg.senderAvatar} className="sender-avatar" style={{width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover'}} />}
                          {msg.senderName}
                      </div>
                  )}
                  
                  {msg.contentType === 'audio' && (
                      <div className={`audio-player ${playingAudioId === msg.id ? 'playing' : ''}`} style={{display: 'flex', alignItems: 'center', gap: '8px', width: '260px', padding: '10px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px'}}>
                          <div 
                              className={`audio-control ${playingAudioId === msg.id ? 'playing' : ''}`}
                              onClick={(e) => { e.stopPropagation(); handlePlayAudio(msg.id, msg.duration); }}
                              style={{
                                  width: '45px', height: '45px', borderRadius: '50%', background: playingAudioId === msg.id ? '#00c2ff' : 'rgba(255,255,255,0.2)', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '18px', color: playingAudioId === msg.id ? '#000' : '#fff'
                              }}
                          >
                              <i className={`fa-solid ${playingAudioId === msg.id ? 'fa-pause' : 'fa-play'}`}></i>
                          </div>
                          <div className="audio-info" style={{display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center'}}>
                              <span style={{fontSize:'13px', fontWeight: 'bold'}}>Áudio ({msg.duration})</span>
                              <div className="audio-waveform" style={{height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', width: '100%', marginTop: '6px', position: 'relative', overflow: 'hidden'}}>
                                  <div className="audio-progress" style={{height: '100%', background: '#00c2ff', borderRadius: '3px', width: playingAudioId === msg.id ? '100%' : '0%', transition: playingAudioId === msg.id ? 'width 3s linear' : 'width 0.2s linear'}}></div>
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
                      <div className={`message-text ${msg.contentType !== 'text' ? 'mt-1' : ''}`} style={{wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: '#fff'}}>
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
    <div className={`h-[100dvh] flex flex-col overflow-hidden ${group?.isVip ? 'secure-content' : ''}`} style={{ background: 'radial-gradient(circle at top left, #0c0f14, #0a0c10)', color: '#fff', fontFamily: "'Roboto', sans-serif", fontWeight: 500 }}>
      {/* HEADER */}
      {isSelectionMode ? (
          <header style={{
            display:'flex', alignItems:'center', padding:'12px 16px',
            background: '#0a2a38', position:'fixed', width:'100%', zIndex:20, 
            borderBottom:'1px solid rgba(255,255,255,0.1)', top: 0, height: '60px', justifyContent: 'space-between'
          }}>
              <div className="flex items-center">
                  <button onClick={() => {setIsSelectionMode(false); setSelectedMsgIds([]);}} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                      <i className="fa-solid fa-xmark"></i>
                  </button>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '10px' }}>
                      {selectedMsgIds.length} selecionada(s)
                  </span>
              </div>
              <button onClick={async () => {
                  if (selectedMsgIds.length === 0 || !id) return;
                  const choice = await showOptions(`Excluir ${selectedMsgIds.length} mensagem(ns)?`, [{ label: 'Excluir para mim', value: 'me', icon: 'fa-user' }, { label: 'Excluir para todos', value: 'all', icon: 'fa-users', isDestructive: true }]);
                  if (choice) { chatService.deleteMessages(id, selectedMsgIds, choice); setIsSelectionMode(false); setSelectedMsgIds([]); }
              }} disabled={selectedMsgIds.length === 0} style={{background:'none', border:'none', color:'#ff4d4d', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                  <i className="fa-solid fa-trash"></i>
              </button>
          </header>
      ) : (
          <header style={{
            display:'flex', alignItems:'center', padding:'12px 16px',
            background: '#0c0f14', position:'fixed', width:'100%', zIndex:20, 
            borderBottom:'1px solid rgba(255,255,255,0.1)', top: 0, height: '60px'
          }}>
              <button className="back-button" onClick={() => navigate('/groups')} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'18px', cursor:'pointer', padding: '0 10px'}}>
                  <i className="fa-solid fa-arrow-left"></i>
              </button>
              
              <div className="chat-info" style={{display: 'flex', alignItems: 'center', flexGrow: 1, marginLeft: '10px'}}>
                  <div className="chat-avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1e2531', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #00c2ff', marginRight: '10px', overflow: 'hidden', color: '#00c2ff' }}>
                      {group?.coverImage ? <img src={group.coverImage} alt="Group" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <i className="fa-solid fa-users" style={{fontSize: '16px'}}></i>}
                  </div>
                  <div className="chat-details">
                      <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                          <h2 style={{fontSize: '16px', color: '#fff', lineHeight: 1.2, fontWeight: 700}}>{group?.name || 'Carregando...'}</h2>
                          {group?.isVip && <i className="fa-solid fa-shield-halved text-[#FFD700] text-xs"></i>}
                      </div>
                      <p style={{fontSize: '12px', color: '#00c2ff', opacity: 0.8, fontWeight: 500}}>{messages.length} mensagens {group?.isVip && '• 🔒 Protegido'}</p>
                  </div>
              </div>

              <button 
                  ref={buttonRef}
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  style={{background:'none', border:'none', color:'#00c2ff', fontSize:'20px', cursor:'pointer', padding: '0 5px'}}
              >
                  <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>
              
              {isMenuOpen && (
                  <div className="dropdown-menu" ref={menuRef} style={{ position: 'absolute', top: '40px', right: 0, background: '#1a1e26', border: '1px solid rgba(0, 194, 255, 0.2)', borderRadius: '8px', width: '200px', zIndex: 20 }}>
                      <button onClick={() => {setIsSearchOpen(true); setIsMenuOpen(false);}} style={{display: 'flex', alignItems: 'center', padding: '12px 15px', color: '#fff', background: 'none', border: 'none', width: '100%', textAlign: 'left'}}><i className="fa-solid fa-magnifying-glass mr-2"></i> Pesquisar</button>
                      <button onClick={() => setIsSelectionMode(true)} style={{display: 'flex', alignItems: 'center', padding: '12px 15px', color: '#fff', background: 'none', border: 'none', width: '100%', textAlign: 'left'}}><i className="fa-solid fa-trash mr-2"></i> Excluir Mensagens</button>
                  </div>
              )}
          </header>
      )}

      {inGracePeriod && (
          <div style={{ background: 'linear-gradient(90deg, #b91c1c, #dc2626)', color: '#fff', padding: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 700, position: 'sticky', top: '60px', zIndex: 19 }}>
              <span>⚠️ Acesso expirado!</span>
              <button onClick={() => navigate(`/vip-group-sales/${id}`)} style={{ background: '#fff', color: '#b91c1c', border: 'none', padding: '4px 10px', borderRadius: '4px', marginLeft: '10px' }}>Pagar Agora</button>
          </div>
      )}

      <main style={{flexGrow:1, width:'100%', display: 'flex', flexDirection: 'column', paddingTop: '60px'}}>
          <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%', paddingBottom: '80px' }}
              data={displayMessages}
              startReached={loadMoreHistory}
              initialTopMostItemIndex={displayMessages.length - 1}
              followOutput="smooth"
              itemContent={(index, msg) => renderMessageItem(index, msg)}
              components={{
                  Header: () => loadingHistory ? <div className="w-full flex justify-center py-2"><i className="fa-solid fa-circle-notch fa-spin text-[#00c2ff]"></i></div> : null,
                  Footer: () => <div style={{ height: '80px' }} />
              }}
          />
      </main>

      {canPost ? (
          <div className="chat-input-area" style={{ position: 'fixed', bottom: '0', width: '100%', background: '#0c0f14', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 15, paddingBottom: '20px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#1a1e26', borderRadius: '24px', padding: '0 5px' }}>
                  <input 
                      type="text" 
                      placeholder="Mensagem..." 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      style={{ flexGrow: 1, padding: '12px 15px', border: 'none', background: 'transparent', color: '#fff', fontSize: '16px', outline: 'none' }}
                  />
                  <button onClick={() => docInputRef.current?.click()} style={{background:'none', border:'none', color:'#aaa', fontSize:'18px', cursor:'pointer', padding:'8px 10px'}}><i className="fa-solid fa-paperclip"></i></button>
                  <button onClick={() => fileInputRef.current?.click()} style={{background:'none', border:'none', color:'#aaa', fontSize:'18px', cursor:'pointer', padding:'8px 10px 8px 0'}}><i className="fa-solid fa-camera"></i></button>
              </div>
              <input type="file" ref={fileInputRef} accept="image/*,video/*" style={{display:'none'}} onChange={(e) => handleFileChange(e, false)} />
              <input type="file" ref={docInputRef} accept=".pdf,.doc,.docx" style={{display:'none'}} onChange={(e) => handleFileChange(e, true)} />
              
              <button 
                onClick={handleAudioAction} 
                disabled={cooldown > 0}
                style={{ background: '#00c2ff', border:'none', color: '#000', width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                  <i className={`fa-solid ${inputText.trim() ? 'fa-paper-plane' : (isRecording ? 'fa-paper-plane' : 'fa-microphone')}`}></i>
              </button>
          </div>
      ) : (
          <div style={{ position: 'fixed', bottom: 0, width: '100%', background: '#1a1e26', padding: '15px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>
              <i className="fa-solid fa-lock"></i> Apenas administradores podem postar.
          </div>
      )}

      {mediaPreview && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-[#1a1e26] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
                  <div className="relative w-full bg-black flex items-center justify-center aspect-square" style={{ maxHeight: '60vh' }}>
                      {mediaPreview.type === 'video' ? <video src={mediaPreview.url} controls className="w-full h-full object-contain" /> : mediaPreview.type === 'image' ? <img src={mediaPreview.url} alt="Preview" className="w-full h-full object-contain" /> : <div className="text-white"><i className="fa-solid fa-file-lines text-6xl"></i></div>}
                      <button onClick={() => setMediaPreview(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <div className="p-3 bg-[#1a1e26] flex gap-2 items-center">
                      <input type="text" placeholder="Adicione uma legenda..." value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} className="flex-1 bg-[#0c0f14] text-gray-100 text-sm px-4 py-3 rounded-xl border border-white/5 outline-none" />
                      <button onClick={handleSendMedia} disabled={isUploading} className="w-12 h-12 bg-[#00c2ff] rounded-xl text-black flex items-center justify-center">{isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}</button>
                  </div>
              </div>
          </div>
      )}

      {zoomedMedia && (
          <div className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center p-2" onClick={() => setZoomedMedia(null)}>
              <button className="absolute top-4 right-4 text-white text-4xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center z-50">&times;</button>
              {zoomedMedia.type === 'video' ? <video src={zoomedMedia.url} controls autoPlay className="max-w-full max-h-full object-contain shadow-2xl" /> : <img src={zoomedMedia.url} alt="Zoom" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />}
          </div>
      )}
    </div>
  );
};
