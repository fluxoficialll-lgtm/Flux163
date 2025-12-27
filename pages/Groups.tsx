import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { chatService } from '../services/chatService';
import { Group } from '../types';
import { db } from '@/database';
import { useModal } from '../components/ModalSystem';
import { trackingService } from '../services/trackingService';

export const Groups: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showAlert, showConfirm, showPrompt } = useModal();
  
  const [uiVisible, setUiVisible] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Tracking Modal State
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingGroup, setTrackingGroup] = useState<Group | null>(null);
  const [utmSource, setUtmSource] = useState('facebook');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  
  // Pagination & Loading States
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10; 
  
  const lastScrollY = useRef(0);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userEmail = authService.getCurrentUserEmail();
    if (!userEmail) {
      navigate('/');
      return;
    }
    setCurrentUserEmail(userEmail);

    loadLocalGroups(0, true);
    syncGroups();

    const params = new URLSearchParams(location.search);
    const joinCode = params.get('join');
    if (joinCode) {
        handleJoinByLink(joinCode);
        navigate('/groups', { replace: true });
    }

    const unsubscribeGroups = db.subscribe('groups', () => {
        const currentCount = groups.length || LIMIT;
        const { groups: refreshed } = groupService.getGroupsPaginated(0, currentCount);
        setGroups(refreshed);
    });
    
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (currentScroll > lastScrollY.current && currentScroll > 80) {
        setUiVisible(false);
      } else {
        setUiVisible(true);
      }
      lastScrollY.current = currentScroll;
    };

    const handleClickOutside = () => setActiveMenuId(null);

    window.addEventListener("scroll", handleScroll);
    document.addEventListener("click", handleClickOutside);

    return () => {
        unsubscribeGroups(); 
        window.removeEventListener("scroll", handleScroll);
        document.removeEventListener("click", handleClickOutside);
    };
  }, [navigate, location.search]);

  const loadLocalGroups = (currentOffset: number, reset: boolean = false) => {
      const { groups: newGroups, hasMore: moreAvailable } = groupService.getGroupsPaginated(currentOffset, LIMIT);
      
      if (reset) {
          setGroups(newGroups);
          setOffset(LIMIT);
      } else {
          setGroups(prev => [...prev, ...newGroups]);
          setOffset(prev => prev + LIMIT);
      }
      
      setHasMore(moreAvailable);
      setLoading(false);
  };

  const syncGroups = async () => {
      await groupService.fetchGroups();
  };

  useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
              loadLocalGroups(offset);
          }
      }, { threshold: 0.5 });

      if (observerRef.current) {
          observer.observe(observerRef.current);
      }

      return () => observer.disconnect();
  }, [hasMore, loading, offset]);

  const handleGroupClick = (group: Group) => {
      const isCreator = group.creatorEmail === currentUserEmail;
      // Fix for reported error on line 120: Property 'members' does not exist on type 'Group'. Did you mean 'memberIds'?
      const isMember = group.memberIds?.includes(currentUserEmail || '');

      if (isCreator || isMember) {
          if (group.isVip && !isCreator && currentUserEmail) {
               const hasAccess = db.vipAccess.check(currentUserEmail, group.id);
               if (!hasAccess) {
                   navigate(`/vip-group-sales/${group.id}`);
                   return;
               }
          }
          navigate(`/group-chat/${group.id}`);
      } else if (group.isVip) {
          navigate(`/vip-group-sales/${group.id}`);
      } else {
          navigate(`/group-landing/${group.id}`);
      }
  };

  const toggleMenu = (e: React.MouseEvent, groupId: string) => {
      e.stopPropagation();
      setActiveMenuId(activeMenuId === groupId ? null : groupId);
  };

  const handleSettingsClick = (group: Group, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveMenuId(null);
      navigate(`/group-settings/${group.id}`);
  };

  const handlePreviewGroup = (groupId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveMenuId(null);
      navigate(`/vip-group-sales/${groupId}`);
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveMenuId(null);
      
      const confirmed = await showConfirm(
          "Excluir Grupo?", 
          "Tem certeza que deseja excluir este grupo permanentemente? Esta ação é irreversível.",
          "Excluir",
          "Cancelar"
      );

      if (confirmed) {
          groupService.deleteGroup(groupId);
          setGroups(prevGroups => prevGroups.filter(g => g.id !== groupId));
      }
  };

  // --- Tracking Logic ---
  const openTrackingModal = (group: Group, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveMenuId(null);
      setTrackingGroup(group);
      setUtmCampaign('');
      setGeneratedLink('');
      setIsTrackingModalOpen(true);
  };

  const generateLink = () => {
      if (!trackingGroup) return;
      
      // Determine base URL: Sales page for VIP, Landing page for regular
      const path = trackingGroup.isVip 
          ? `/vip-group-sales/${trackingGroup.id}` 
          : `/group-landing/${trackingGroup.id}`;
      
      const baseUrl = `${window.location.origin}/#${path}`;
      
      const params = {
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign || 'generic'
      };
      
      const finalLink = trackingService.generateTrackingLink(baseUrl, params);
      setGeneratedLink(finalLink);
  };

  const copyGeneratedLink = () => {
      navigator.clipboard.writeText(generatedLink);
      showAlert("Sucesso", "Link copiado com sucesso!");
      setIsTrackingModalOpen(false);
  };

  const openJoinModal = async () => {
      const code = await showPrompt("Entrar em Grupo", "Cole o link ou código do grupo abaixo:", "Ex: d8a2c1");
      if (code) handleJoinByLink(code);
  };

  const handleJoinByLink = (inputCode: string) => {
      if (!inputCode.trim()) return;
      let code = inputCode;
      if (code.includes('?join=')) code = code.split('?join=')[1];
      else if (code.includes('/')) {
          const parts = code.split('/');
          code = parts[parts.length - 1] || parts[parts.length - 2];
      }

      const result = groupService.joinGroupByLinkCode(code);
      if (result.success) {
          showAlert("Sucesso!", result.message);
          if (result.groupId) navigate(`/group-chat/${result.groupId}`);
          else loadLocalGroups(0, true);
      } else {
          showAlert("Ops!", result.message);
      }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        .group-preview { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.2s; position: relative; }
        .group-preview:hover { background: rgba(0,194,255,0.1); }
        .group-avatar { width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; border: 2px solid #00c2ff; background: rgba(0,194,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; overflow: hidden; }
        .group-avatar i { color: #00c2ff; }
        .group-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .group-info { display: flex; flex-direction: column; flex-grow: 1; min-width: 0; margin-right: 10px; }
        .group-info .groupname { font-weight: 600; font-size: 16px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .group-info .last-message { font-size: 14px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .time-and-tag { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
        .group-time { font-size: 12px; color: #777; margin-top: 2px; }
        .group-tag { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-bottom: 2px; }
        .vip-tag { background: linear-gradient(145deg, #FFD700, #B8860B); color: #000; box-shadow: 0 0 5px rgba(255, 215, 0, 0.6); }
        .vip-tag-inactive { background: #2d3748; color: #a0aec0; border: 1px solid #4a5568; }
        .group-unread-badge { background: #ff4d4d; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 20px; min-width: 20px; text-align: center; margin-top: 4px; }
        .group-menu-btn { position: absolute; right: 5px; top: 5px; background: none; border: none; color: rgba(255,255,255,0.6); padding: 8px; cursor: pointer; z-index: 5; transition: color 0.3s; }
        .group-menu-btn:hover { color: #fff; }
        .group-dropdown { position: absolute; right: 30px; top: 25px; background: #1a1e26; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); z-index: 10; min-width: 160px; overflow: hidden; display: none; }
        .group-dropdown button { display: block; width: 100%; padding: 10px 15px; text-align: left; background: none; border: none; color: #fff; font-size: 14px; cursor: pointer; transition: background 0.2s; }
        .group-dropdown button:hover { background: rgba(0,194,255,0.1); color: #00c2ff; }
        .group-dropdown button.delete-option { color: #ff4d4d; }
        .group-dropdown button.delete-option:hover { background: rgba(255,77,77,0.1); }
        .group-dropdown button i { margin-right: 8px; width: 16px; text-align: center; }
        .join-via-link-btn { width: 100%; padding: 14px; margin-bottom: 20px; background: rgba(0, 194, 255, 0.08); border: 1px dashed #00c2ff; border-radius: 12px; color: #00c2ff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s; font-size: 15px; }
        .join-via-link-btn:hover { background: rgba(0, 194, 255, 0.15); box-shadow: 0 0 15px rgba(0,194,255,0.2); }
        footer button { position: relative; background: none; border: none; padding: 10px; cursor: pointer; transition: color 0.3s; }
        .loading-more { text-align: center; padding: 20px; color: #555; font-size: 13px; }
        
        /* Modal Style */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 50; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .tracking-modal { background: #1a1e26; width: 90%; max-width: 400px; padding: 20px; border-radius: 16px; border: 1px solid #00c2ff; box-shadow: 0 0 30px rgba(0,194,255,0.2); }
        .input-group { margin-bottom: 15px; }
        .input-group label { display: block; font-size: 13px; color: #aaa; margin-bottom: 5px; }
        .input-group input, .input-group select { width: 100%; padding: 10px; background: #0c0f14; border: 1px solid #333; color: #fff; border-radius: 8px; outline: none; }
        .input-group input:focus { border-color: #00c2ff; }
        .gen-btn { width: 100%; padding: 12px; background: #00c2ff; color: #000; font-weight: bold; border-radius: 8px; border: none; cursor: pointer; margin-top: 10px; }
        .result-box { margin-top: 15px; background: #000; padding: 10px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: #00ff82; border: 1px dashed #333; }
        .copy-btn { width: 100%; padding: 10px; background: #00ff82; color: #000; font-weight: bold; border-radius: 8px; border: none; cursor: pointer; margin-top: 10px; }
        .close-btn { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; }
      `}</style>

      <header className="flex items-center justify-between p-[16px_32px] bg-[#0c0f14] fixed w-full z-10 border-b border-white/10 top-0 h-[80px]">
        <button onClick={() => navigate('/top-groups')} aria-label="Rank de Grupos" className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white">
            <i className="fa-solid fa-ranking-star"></i>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]" onClick={() => navigate('/feed')}>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <button style={{marginLeft:'auto'}} onClick={() => navigate('/messages')} aria-label="Mensagens Privadas/Contatos" className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white">
            <i className="fa-solid fa-message"></i>
        </button>
      </header>

      <main className="flex-grow flex flex-col items-start justify-start w-full transition-all pt-[100px] pb-[100px] px-4">
        <button className="join-via-link-btn" onClick={openJoinModal}>
            <i className="fa-solid fa-link"></i> Entrar no Grupo via Link
        </button>

        <div id="groupList" className="w-full">
            {groups.length > 0 ? (
                <>
                    {groups.map(group => {
                        const isCreator = group.creatorEmail === currentUserEmail;
                        const unreadCount = chatService.getGroupUnreadCount(group.id);

                        return (
                            <div key={group.id} className="group-preview" onClick={() => handleGroupClick(group)}>
                                <div className="group-avatar">
                                    {group.coverImage ? <img src={group.coverImage} alt={group.name} /> : <i className={`fa-solid ${group.isVip ? 'fa-crown' : 'fa-users'}`}></i>}
                                </div>
                                <div className="group-info">
                                    <div className="groupname">{group.name}</div>
                                    <div className="last-message">{group.lastMessage}</div>
                                </div>
                                <div className="time-and-tag">
                                    {group.isVip && (
                                        <div className={`group-tag ${group.status === 'inactive' ? 'vip-tag-inactive' : 'vip-tag'}`}>
                                            <i className={`fa-solid ${group.status === 'inactive' ? 'fa-ban' : 'fa-crown'}`}></i> 
                                            {group.status === 'inactive' ? 'Inativo' : 'VIP'}
                                        </div>
                                    )}
                                    <div className="group-time">{group.time}</div>
                                    {unreadCount > 0 && <div className="group-unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>}
                                </div>

                                {isCreator && (
                                    <>
                                        <button className="group-menu-btn" onClick={(e) => toggleMenu(e, group.id)}>
                                            <i className="fa-solid fa-ellipsis-vertical"></i>
                                        </button>
                                        <div className={`group-dropdown ${activeMenuId === group.id ? 'active' : ''}`} onClick={(e) => e.stopPropagation()}>
                                            <button onClick={(e) => handleSettingsClick(group, e)}><i className="fa-solid fa-gear"></i> Configurações</button>
                                            {group.isVip && <button onClick={(e) => handlePreviewGroup(group.id, e)}><i className="fa-solid fa-eye"></i> Preview</button>}
                                            <button onClick={(e) => openTrackingModal(group, e)} style={{color:'#00ff82'}}><i className="fa-solid fa-bullseye"></i> Rastreamento</button>
                                            <button className="delete-option" onClick={(e) => handleDeleteGroup(group.id, e)}><i className="fa-solid fa-trash"></i> Excluir</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                    <div ref={observerRef} className="loading-more">
                        {hasMore && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                        {!hasMore && groups.length > 5 && <span>• Fim dos grupos •</span>}
                    </div>
                </>
            ) : loading ? (
                <div className="text-center mt-10 text-[#00c2ff]"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>
            ) : (
                <div style={{textAlign: 'center', color: '#aaa', marginTop: '30px'}}>
                    <p>Você não participa de nenhum grupo.</p>
                    <p style={{fontSize: '13px', marginTop: '5px'}}>Crie um novo grupo clicando no botão abaixo!</p>
                </div>
            )}
        </div>
      </main>

      {/* TRACKING MODAL */}
      {isTrackingModalOpen && (
          <div className="modal-overlay" onClick={() => setIsTrackingModalOpen(false)}>
              <div className="tracking-modal" onClick={e => e.stopPropagation()}>
                  <h3 style={{color:'#fff', fontSize:'18px', fontWeight:'700', marginBottom:'15px', textAlign:'center'}}>
                      <i className="fa-solid fa-link text-[#00c2ff]"></i> Gerador de Link Rastreável
                  </h3>
                  
                  <div className="input-group">
                      <label>Origem (Source)</label>
                      <select value={utmSource} onChange={e => setUtmSource(e.target.value)}>
                          <option value="facebook">Facebook Ads</option>
                          <option value="instagram">Instagram Bio</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">Youtube</option>
                          <option value="email">Email Marketing</option>
                          <option value="whatsapp">WhatsApp</option>
                      </select>
                  </div>
                  
                  <div className="input-group">
                      <label>Mídia (Medium)</label>
                      <select value={utmMedium} onChange={e => setUtmMedium(e.target.value)}>
                          <option value="cpc">CPC (Pago)</option>
                          <option value="organic">Orgânico</option>
                          <option value="social">Social</option>
                          <option value="referral">Referência</option>
                      </select>
                  </div>

                  <div className="input-group">
                      <label>Nome da Campanha (Opcional)</label>
                      <input type="text" placeholder="ex: natal_2024, lancamento" value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} />
                  </div>

                  <button className="gen-btn" onClick={generateLink}>GERAR LINK</button>

                  {generatedLink && (
                      <>
                          <div className="result-box">{generatedLink}</div>
                          <button className="copy-btn" onClick={copyGeneratedLink}>COPIAR</button>
                      </>
                  )}
              </div>
          </div>
      )}

      <button id="postButton" onClick={() => navigate('/create-group')} aria-label="Criar Novo Grupo" className={`fixed bottom-[105px] right-[20px] w-[60px] h-[60px] bg-[#00c2ff] border-none rounded-full text-white cursor-pointer shadow-[0_4px_12px_rgba(0,194,255,0.3)] z-15 flex items-center justify-center hover:bg-[#007bff] transition-transform duration-300 ${uiVisible ? 'scale-100' : 'scale-0'}`}>
        <div style={{position: 'relative'}}>
            <i className="fa-solid fa-users" style={{fontSize: '22px'}}></i>
            <i className="fa-solid fa-plus" style={{fontSize: '12px', position: 'absolute', top: '-5px', right: '-8px', fontWeight: '900'}}></i>
        </div>
      </button>

      <footer className={`fixed bottom-0 left-0 w-full bg-[#0c0f14] flex justify-around py-3.5 rounded-t-2xl z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.5)] transition-transform duration-300 ${uiVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <button onClick={() => navigate('/feed')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all"><i className="fa-solid fa-newspaper"></i></button>
        <button onClick={() => navigate('/messages')} className="text-white text-[22px] cursor-pointer p-2 transition-all"><i className="fa-solid fa-comments"></i></button>
        <button onClick={() => navigate('/notifications')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all"><i className="fa-solid fa-bell"></i></button>
        <button onClick={() => navigate('/profile')} className="text-[#00c2ff] text-[22px] cursor-pointer p-2 hover:text-white transition-all"><i className="fa-solid fa-user"></i></button>
      </footer>
    </div>
  );
};