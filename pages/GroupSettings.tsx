
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { db } from '@/database';
import { Group, User, GroupLink, VipMediaItem } from '../types';
import { useModal } from '../components/ModalSystem';

export const GroupSettings: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showConfirm, showAlert } = useModal();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // --- SEÇÃO 1: INFO BÁSICA ---
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);

  // --- SEÇÃO 2: ACESSO & LINKS ---
  const [approveMembers, setApproveMembers] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [links, setLinks] = useState<GroupLink[]>([]);
  const [isLinksModalOpen, setIsLinksModalOpen] = useState(false);
  // Form Links
  const [newLinkName, setNewLinkName] = useState('');
  const [maxUses, setMaxUses] = useState('');
  
  // --- SEÇÃO 3: MODERAÇÃO ---
  const [onlyAdminsPost, setOnlyAdminsPost] = useState(false);
  const [msgSlowMode, setMsgSlowMode] = useState(false);
  const [msgSlowModeInterval, setMsgSlowModeInterval] = useState('30');
  const [joinSlowMode, setJoinSlowMode] = useState(false); // Only public
  const [joinSlowModeInterval, setJoinSlowModeInterval] = useState('60');
  const [memberLimit, setMemberLimit] = useState<number | ''>('');
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');

  // --- SEÇÃO 4: MEMBROS ---
  const [members, setMembers] = useState<{ id: string, name: string, role: string, isMe: boolean, avatar?: string }[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // --- SEÇÃO 5: VIP (Se aplicável) ---
  const [vipPrice, setVipPrice] = useState('');
  const [vipCurrency, setVipCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [vipDoorText, setVipDoorText] = useState('');
  const [vipButtonText, setVipButtonText] = useState('');
  const [vipMediaItems, setVipMediaItems] = useState<VipMediaItem[]>([]);
  const [pixelId, setPixelId] = useState('');
  const [pixelToken, setPixelToken] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [isVipDoorModalOpen, setIsVipDoorModalOpen] = useState(false);

  // Accordion State
  const [expandedSection, setExpandedSection] = useState<string | null>('info');

  useEffect(() => {
      const email = authService.getCurrentUserEmail();
      setCurrentUserEmail(email);

      if (id) {
          const loadData = () => {
              const foundGroup = groupService.getGroupById(id);
              if (foundGroup) {
                  setGroup(foundGroup);
                  
                  const owner = foundGroup.creatorEmail === email;
                  const admin = owner || (email && foundGroup.admins?.includes(email)) || false;
                  setIsOwner(owner);
                  setIsAdmin(admin);

                  // 1. Info
                  setGroupName(foundGroup.name);
                  setDescription(foundGroup.description);
                  setCoverImage(foundGroup.coverImage);

                  // 2. Settings (Moderação & Acesso)
                  if (foundGroup.settings) {
                      setApproveMembers(foundGroup.settings.approveMembers || false);
                      setOnlyAdminsPost(foundGroup.settings.onlyAdminsPost || false);
                      setMsgSlowMode(foundGroup.settings.msgSlowMode || false);
                      setMsgSlowModeInterval(foundGroup.settings.msgSlowModeInterval?.toString() || '30');
                      setJoinSlowMode(foundGroup.settings.joinSlowMode || false);
                      setJoinSlowModeInterval(foundGroup.settings.joinSlowModeInterval?.toString() || '60');
                      setMemberLimit(foundGroup.settings.memberLimit || '');
                      setForbiddenWords(foundGroup.settings.forbiddenWords || []);
                  }

                  // 2. Links & Pendings
                  setLinks(foundGroup.links || []);
                  setPendingRequests(groupService.getPendingMembers(id));

                  // 4. Members
                  const rawMembers = groupService.getGroupMembers(id);
                  setMembers(rawMembers.map(u => ({
                      id: u.email,
                      name: u.profile?.nickname || u.profile?.name || 'Usuário',
                      role: u.email === foundGroup.creatorEmail ? 'Dono' : (foundGroup.admins?.includes(u.email) ? 'Admin' : 'Membro'),
                      isMe: u.email === email,
                      avatar: u.profile?.photoUrl
                  })));

                  // 5. VIP
                  if (foundGroup.isVip) {
                      setVipPrice(foundGroup.price ? parseFloat(foundGroup.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                      setVipCurrency((foundGroup.currency as 'BRL' | 'USD') || 'BRL');
                      setVipDoorText(foundGroup.vipDoor?.text || '');
                      setVipButtonText(foundGroup.vipDoor?.buttonText || '');
                      setVipMediaItems(foundGroup.vipDoor?.mediaItems || (foundGroup.vipDoor?.media ? [{url: foundGroup.vipDoor.media, type: 'image'}] : []));
                      setPixelId(foundGroup.pixelId || '');
                      setPixelToken(foundGroup.pixelToken || '');
                  }
              }
              setLoading(false);
          };
          loadData();
      }
  }, [id]);

  const toggleSection = (section: string) => {
      setExpandedSection(expandedSection === section ? null : section);
  };

  const handleSave = async () => {
      if (!group) return;

      const rawPrice = vipPrice.replace(/\./g, '').replace(',', '.');
      
      const updatedGroup: Group = {
          ...group,
          name: groupName,
          description,
          coverImage,
          price: rawPrice,
          currency: vipCurrency,
          pixelId,
          pixelToken,
          vipDoor: group.isVip ? {
              ...group.vipDoor,
              text: vipDoorText,
              buttonText: vipButtonText,
              mediaItems: vipMediaItems
          } : group.vipDoor,
          settings: {
              approveMembers,
              onlyAdminsPost,
              msgSlowMode,
              msgSlowModeInterval: parseInt(msgSlowModeInterval),
              joinSlowMode,
              joinSlowModeInterval: parseInt(joinSlowModeInterval),
              memberLimit: memberLimit === '' ? undefined : Number(memberLimit),
              forbiddenWords
          }
      };

      await groupService.updateGroup(updatedGroup);
      await showAlert('Sucesso', 'Configurações salvas com sucesso!');
  };

  // --- Handlers: Links ---
  const handleCreateLink = () => {
      if (!newLinkName.trim() || !id) return;
      const uses = maxUses ? parseInt(maxUses) : undefined;
      const link = groupService.addGroupLink(id, newLinkName, uses);
      if (link) {
          setLinks(prev => [link, ...prev]);
          setNewLinkName('');
          setMaxUses('');
      }
  };

  const handleDeleteLink = (linkId: string) => {
      if(id) {
          groupService.removeGroupLink(id, linkId);
          setLinks(prev => prev.filter(l => l.id !== linkId));
      }
  };

  const handleCopyLink = (code: string) => {
      const url = `${window.location.origin}/#/groups?join=${code}`;
      navigator.clipboard.writeText(url);
      alert('Link copiado!');
  };

  // --- Handlers: Moderação ---
  const handleAddWord = (e: React.FormEvent) => {
      e.preventDefault();
      if (newWord.trim()) {
          setForbiddenWords([...forbiddenWords, newWord.trim().toLowerCase()]);
          setNewWord('');
      }
  };

  // --- Handlers: Membros ---
  const handleMemberAction = async (memberId: string, action: 'kick' | 'ban' | 'promote' | 'demote') => {
      if (!group) return;
      
      let confirmMsg = '';
      if (action === 'kick') confirmMsg = 'Remover membro?';
      if (action === 'ban') confirmMsg = 'Banir membro permanentemente?';
      if (action === 'promote') confirmMsg = 'Promover a Administrador?';
      if (action === 'demote') confirmMsg = 'Rebaixar para Membro?';

      if (await showConfirm('Ação de Membro', confirmMsg)) {
          if (action === 'kick') groupService.removeMember(group.id, memberId);
          if (action === 'ban') groupService.banMember(group.id, memberId);
          if (action === 'promote') groupService.promoteMember(group.id, memberId);
          if (action === 'demote') groupService.demoteMember(group.id, memberId);
          
          // Refresh local list simply by filtering or mapping (real reload happens via db sub usually)
          if (action === 'kick' || action === 'ban') {
              setMembers(prev => prev.filter(m => m.id !== memberId));
          } else {
              setMembers(prev => prev.map(m => m.id === memberId ? {...m, role: action === 'promote' ? 'Admin' : 'Membro'} : m));
          }
      }
  };

  const handlePendingAction = (userEmail: string, action: 'accept' | 'deny') => {
      if(!id) return;
      if (action === 'accept') groupService.approveMember(id, userEmail);
      else groupService.rejectMember(id, userEmail);
      setPendingRequests(prev => prev.filter(u => u.email !== userEmail));
  };

  // --- Handlers: VIP ---
  const handleVipMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              const url = ev.target?.result as string;
              const type = file.type.startsWith('video/') ? 'video' : 'image';
              setVipMediaItems(prev => [...prev, { url, type }]);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleManualRelease = async () => {
      if (!manualUsername.trim() || !group) return;
      const cleanHandle = manualUsername.replace('@', '').toLowerCase();
      const user = await authService.fetchUserByHandle(cleanHandle);
      if (user) {
          db.vipAccess.grant({
              userId: user.email,
              groupId: group.id,
              status: 'active',
              purchaseDate: Date.now(),
              transactionId: `manual_${Date.now()}`
          });
          groupService.approveMember(group.id, user.email);
          alert(`Acesso liberado para @${cleanHandle}`);
          setManualUsername('');
      } else {
          alert('Usuário não encontrado.');
      }
  };

  // --- Handlers: Danger ---
  const handleLeaveDelete = async (type: 'leave' | 'delete') => {
      if (!group) return;
      const msg = type === 'leave' ? 'Sair do grupo?' : 'EXCLUIR GRUPO PERMANENTEMENTE?';
      if (await showConfirm(type === 'leave' ? 'Sair' : 'Excluir', msg)) {
          if (type === 'leave') await groupService.leaveGroup(group.id);
          else await groupService.deleteGroup(group.id);
          navigate('/groups');
      }
  };

  if (loading || !group) return <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] pb-20">
        <style>{`
            .section-card {
                background: #1a1e26; border: 1px solid rgba(255,255,255,0.05);
                border-radius: 12px; overflow: hidden; margin-bottom: 12px;
            }
            .section-header {
                padding: 16px; display: flex; align-items: center; justify-content: space-between;
                cursor: pointer; background: rgba(255,255,255,0.02);
            }
            .section-header h3 { font-size: 15px; font-weight: 600; color: #fff; margin: 0; display: flex; align-items: center; gap: 10px; }
            .section-body { padding: 16px; border-top: 1px solid rgba(255,255,255,0.05); }
            
            .input-group { margin-bottom: 15px; }
            .input-group label { display: block; font-size: 12px; color: #aaa; margin-bottom: 5px; font-weight: 600; text-transform: uppercase; }
            .input-field {
                width: 100%; background: #0c0f14; border: 1px solid rgba(255,255,255,0.1);
                padding: 12px; border-radius: 8px; color: #fff; outline: none; font-size: 14px;
            }
            .input-field:focus { border-color: #00c2ff; }
            
            .cover-preview {
                width: 100%; aspect-ratio: 21/9; background: #000; border-radius: 8px;
                object-fit: cover; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);
            }
            
            .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .toggle-row:last-child { border-bottom: none; }
            .toggle-info h4 { font-size: 14px; margin: 0; color: #fff; }
            .toggle-info p { font-size: 12px; color: #888; margin: 2px 0 0 0; }
            
            /* Switch */
            .switch { position: relative; display: inline-block; width: 40px; height: 22px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 34px; }
            .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: #00c2ff; }
            input:checked + .slider:before { transform: translateX(18px); }

            .link-item { background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
            .link-info { font-size: 13px; font-weight: 600; }
            .link-code { font-family: monospace; color: #00c2ff; font-size: 12px; }
            
            .member-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .member-avatar { width: 36px; height: 36px; border-radius: 50%; margin-right: 10px; object-fit: cover; background: #333; }
            .member-details { flex: 1; }
            .member-role { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-left: 5px; }
            
            .btn-save {
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; max-width: 500px;
                background: #00c2ff; color: #000; padding: 14px; border-radius: 12px; font-weight: 700;
                border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,194,255,0.3); z-index: 50;
            }
            .danger-btn {
                width: 100%; padding: 12px; background: rgba(255,77,77,0.1); border: 1px solid #ff4d4d;
                color: #ff4d4d; border-radius: 8px; margin-top: 10px; cursor: pointer; font-weight: 600;
            }
        `}</style>

        <header className="flex items-center justify-between p-4 bg-[#0c0f14] sticky top-0 z-40 border-b border-white/10">
            <button onClick={() => navigate(`/group-chat/${id}`)} className="text-[#00c2ff] text-xl"><i className="fa-solid fa-arrow-left"></i></button>
            <h1 className="text-lg font-bold">Configurações</h1>
            <div className="w-6"></div>
        </header>

        <main className="p-4 max-w-[600px] mx-auto">
            
            {/* 1. INFORMAÇÕES */}
            <div className="section-card">
                <div className="section-header" onClick={() => toggleSection('info')}>
                    <h3><i className="fa-solid fa-circle-info text-[#00c2ff]"></i> Informações do Grupo</h3>
                    <i className={`fa-solid fa-chevron-${expandedSection === 'info' ? 'up' : 'down'} text-gray-500`}></i>
                </div>
                {expandedSection === 'info' && (
                    <div className="section-body">
                        {isOwner ? (
                            <>
                                <div className="mb-4 text-center">
                                    <img src={coverImage || 'https://via.placeholder.com/300x100?text=Capa'} className="cover-preview" />
                                    <button onClick={() => document.getElementById('coverInput')?.click()} className="text-[#00c2ff] text-sm underline">Alterar Capa</button>
                                    <input type="file" id="coverInput" hidden accept="image/*" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if(file) {
                                            const r = new FileReader();
                                            r.onload = (ev) => setCoverImage(ev.target?.result as string);
                                            r.readAsDataURL(file);
                                        }
                                    }} />
                                </div>
                                <div className="input-group">
                                    <label>Nome do Grupo</label>
                                    <input type="text" className="input-field" value={groupName} onChange={e => setGroupName(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label>Descrição</label>
                                    <textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)}></textarea>
                                </div>
                                <div className="text-center mt-2">
                                    <span className={`text-xs px-2 py-1 rounded border ${group?.isVip ? 'border-[#FFD700] text-[#FFD700]' : (group?.isPrivate ? 'border-[#ff5722] text-[#ff5722]' : 'border-[#00c2ff] text-[#00c2ff]')}`}>
                                        {group?.isVip ? 'GRUPO VIP' : (group?.isPrivate ? 'GRUPO PRIVADO' : 'GRUPO PÚBLICO')}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-400 text-sm">Apenas o dono pode editar as informações principais.</p>
                        )}
                    </div>
                )}
            </div>

            {/* 2. ACESSO & LINKS */}
            <div className="section-card">
                <div className="section-header" onClick={() => toggleSection('access')}>
                    <h3><i className="fa-solid fa-link text-[#00c2ff]"></i> Acesso & Links</h3>
                    <i className={`fa-solid fa-chevron-${expandedSection === 'access' ? 'up' : 'down'} text-gray-500`}></i>
                </div>
                {expandedSection === 'access' && (
                    <div className="section-body">
                        {isAdmin && (
                            <div className="toggle-row">
                                <div className="toggle-info">
                                    <h4>Aprovar Membros</h4>
                                    <p>Solicitações requerem aprovação</p>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={approveMembers} onChange={() => setApproveMembers(!approveMembers)} />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        )}

                        {pendingRequests.length > 0 && (
                            <div className="mb-4 mt-2">
                                <div className="text-xs font-bold text-[#ffaa00] uppercase mb-2">Solicitações Pendentes ({pendingRequests.length})</div>
                                {pendingRequests.map(u => (
                                    <div key={u.email} className="flex justify-between items-center bg-white/5 p-2 rounded mb-1">
                                        <span className="text-sm">{u.profile?.name}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handlePendingAction(u.email, 'accept')} className="text-[#00ff82]"><i className="fa-solid fa-check"></i></button>
                                            <button onClick={() => handlePendingAction(u.email, 'deny')} className="text-[#ff4d4d]"><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="font-bold text-xs text-gray-400 uppercase">Links de Convite</label>
                                {isAdmin && <button onClick={() => setIsLinksModalOpen(true)} className="text-[#00c2ff] text-xs"><i className="fa-solid fa-plus"></i> Novo</button>}
                            </div>
                            {links.map(link => (
                                <div key={link.id} className="link-item">
                                    <div>
                                        <div className="link-info">{link.name}</div>
                                        <div className="link-code">code: {link.code}</div>
                                    </div>
                                    <div className="flex gap-3">
                                        <i className="fa-regular fa-copy text-gray-400 cursor-pointer" onClick={() => handleCopyLink(link.code)}></i>
                                        {isAdmin && <i className="fa-solid fa-trash text-[#ff4d4d] cursor-pointer" onClick={() => handleDeleteLink(link.id)}></i>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. MODERAÇÃO */}
            <div className="section-card">
                <div className="section-header" onClick={() => toggleSection('mod')}>
                    <h3><i className="fa-solid fa-shield-halved text-[#00c2ff]"></i> Moderação</h3>
                    <i className={`fa-solid fa-chevron-${expandedSection === 'mod' ? 'up' : 'down'} text-gray-500`}></i>
                </div>
                {expandedSection === 'mod' && (
                    <div className="section-body">
                        {isAdmin ? (
                            <>
                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <h4>Apenas Admins Postam</h4>
                                        <p>Silenciar membros</p>
                                    </div>
                                    <label className="switch">
                                        <input type="checkbox" checked={onlyAdminsPost} onChange={() => setOnlyAdminsPost(!onlyAdminsPost)} />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <h4>Modo Lento (Chat)</h4>
                                        <p>Intervalo entre mensagens</p>
                                    </div>
                                    <label className="switch">
                                        <input type="checkbox" checked={msgSlowMode} onChange={() => setMsgSlowMode(!msgSlowMode)} />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                {msgSlowMode && (
                                    <input type="number" className="input-field mb-3" placeholder="Segundos (ex: 30)" value={msgSlowModeInterval} onChange={e => setMsgSlowModeInterval(e.target.value)} />
                                )}
                                
                                {!group?.isPrivate && (
                                    <>
                                        <div className="toggle-row">
                                            <div className="toggle-info">
                                                <h4>Modo Lento (Entrada)</h4>
                                                <p>Limitar frequência de entrada</p>
                                            </div>
                                            <label className="switch">
                                                <input type="checkbox" checked={joinSlowMode} onChange={() => setJoinSlowMode(!joinSlowMode)} />
                                                <span className="slider"></span>
                                            </label>
                                        </div>
                                        {joinSlowMode && (
                                            <input type="number" className="input-field mb-3" placeholder="Minutos (ex: 60)" value={joinSlowModeInterval} onChange={e => setJoinSlowModeInterval(e.target.value)} />
                                        )}
                                    </>
                                )}

                                <div className="input-group mt-3">
                                    <label>Limite de Membros</label>
                                    <input type="number" className="input-field" placeholder="Ilimitado" value={memberLimit} onChange={e => setMemberLimit(e.target.value ? parseInt(e.target.value) : '')} />
                                </div>

                                <div className="input-group">
                                    <label>Palavras Proibidas</label>
                                    <div className="flex gap-2">
                                        <input type="text" className="input-field" placeholder="Adicionar palavra..." value={newWord} onChange={e => setNewWord(e.target.value)} />
                                        <button onClick={handleAddWord} className="bg-[#00c2ff] text-black px-4 rounded-lg font-bold">+</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {forbiddenWords.map(w => (
                                            <span key={w} className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs flex items-center gap-2">
                                                {w} <i className="fa-solid fa-xmark cursor-pointer" onClick={() => setForbiddenWords(prev => prev.filter(x => x !== w))}></i>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-400 text-sm">Apenas administradores podem alterar regras de moderação.</p>
                        )}
                    </div>
                )}
            </div>

            {/* 4. MEMBROS */}
            <div className="section-card">
                <div className="section-header" onClick={() => toggleSection('members')}>
                    <h3><i className="fa-solid fa-users text-[#00c2ff]"></i> Membros ({members.length})</h3>
                    <i className={`fa-solid fa-chevron-${expandedSection === 'members' ? 'up' : 'down'} text-gray-500`}></i>
                </div>
                {expandedSection === 'members' && (
                    <div className="section-body">
                        <input type="text" className="input-field mb-3" placeholder="Buscar membro..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                        <div className="max-h-[300px] overflow-y-auto">
                            {members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase())).map(member => (
                                <div key={member.id} className="member-item">
                                    {member.avatar ? <img src={member.avatar} className="member-avatar" /> : <div className="member-avatar flex items-center justify-center text-xs"><i className="fa-solid fa-user"></i></div>}
                                    <div className="member-details">
                                        <div className="text-sm font-semibold text-white">
                                            {member.name}
                                            {member.role !== 'Membro' && <span className={`member-role ${member.role === 'Dono' ? 'bg-[#FFD700] text-black' : 'bg-[#00c2ff] text-black'}`}>{member.role}</span>}
                                        </div>
                                    </div>
                                    {isAdmin && !member.isMe && member.role !== 'Dono' && (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleMemberAction(member.id, 'promote')} title="Promover" className="text-[#00c2ff]"><i className="fa-solid fa-shield-halved"></i></button>
                                            <button onClick={() => handleMemberAction(member.id, 'kick')} title="Remover" className="text-[#ff9800]"><i className="fa-solid fa-user-minus"></i></button>
                                            <button onClick={() => handleMemberAction(member.id, 'ban')} title="Banir" className="text-[#ff4d4d]"><i className="fa-solid fa-ban"></i></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 5. VIP (Condicional) */}
            {group?.isVip && isOwner && (
                <div className="section-card border-[#FFD700] border-opacity-30">
                    <div className="section-header" onClick={() => toggleSection('vip')}>
                        <h3><i className="fa-solid fa-crown text-[#FFD700]"></i> Monetização VIP</h3>
                        <i className={`fa-solid fa-chevron-${expandedSection === 'vip' ? 'up' : 'down'} text-gray-500`}></i>
                    </div>
                    {expandedSection === 'vip' && (
                        <div className="section-body">
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="input-group">
                                    <label>Preço</label>
                                    <input type="text" className="input-field" value={vipPrice} onChange={e => {
                                        const v = e.target.value.replace(/\D/g, "");
                                        const n = parseFloat(v) / 100;
                                        setVipPrice(n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                                    }} />
                                </div>
                                <div className="input-group">
                                    <label>Moeda</label>
                                    <select className="input-field" value={vipCurrency} onChange={e => setVipCurrency(e.target.value as any)}>
                                        <option value="BRL">BRL (R$)</option>
                                        <option value="USD">USD ($)</option>
                                    </select>
                                </div>
                            </div>

                            <button className="w-full py-3 mb-4 bg-[#1e2531] border border-[#FFD700] text-[#FFD700] rounded-lg font-bold" onClick={() => setIsVipDoorModalOpen(true)}>
                                <i className="fa-solid fa-door-open mr-2"></i> Editar Porta de Entrada
                            </button>

                            <div className="input-group">
                                <label>Pixel Meta (ID)</label>
                                <input type="text" className="input-field" value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="Ex: 123456789" />
                            </div>
                            <div className="input-group">
                                <label>Token API (Conversões)</label>
                                <input type="text" className="input-field" value={pixelToken} onChange={e => setPixelToken(e.target.value)} placeholder="EAA..." />
                            </div>

                            <button className="w-full py-2 bg-[#1e2531] border border-white/10 rounded-lg text-sm mb-4" onClick={() => navigate(`/vip-sales-history/${id}`)}>
                                <i className="fa-solid fa-chart-line mr-2"></i> Ver Histórico de Vendas
                            </button>

                            <div className="input-group border-t border-white/5 pt-3">
                                <label>Liberação Manual (@usuario)</label>
                                <div className="flex gap-2">
                                    <input type="text" className="input-field" placeholder="@usuario" value={manualUsername} onChange={e => setManualUsername(e.target.value)} />
                                    <button onClick={handleManualRelease} className="bg-[#FFD700] text-black px-4 rounded-lg font-bold">OK</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 6. ZONA DE PERIGO */}
            <div className="section-card border-red-500/30">
                <div className="section-header" onClick={() => toggleSection('danger')}>
                    <h3><i className="fa-solid fa-triangle-exclamation text-red-500"></i> Zona de Perigo</h3>
                    <i className={`fa-solid fa-chevron-${expandedSection === 'danger' ? 'up' : 'down'} text-gray-500`}></i>
                </div>
                {expandedSection === 'danger' && (
                    <div className="section-body">
                        <button className="danger-btn text-white" onClick={() => handleLeaveDelete('leave')}>
                            <i className="fa-solid fa-arrow-right-from-bracket mr-2"></i> Sair do Grupo
                        </button>
                        {isOwner && (
                            <button className="danger-btn bg-red-500 text-white border-none" onClick={() => handleLeaveDelete('delete')}>
                                <i className="fa-solid fa-trash mr-2"></i> Excluir Grupo
                            </button>
                        )}
                    </div>
                )}
            </div>

            <button className="btn-save" onClick={handleSave}>Salvar Alterações</button>

            {/* --- MODALS --- */}
            
            {/* Modal Links */}
            {isLinksModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1e26] p-6 rounded-xl w-full max-w-sm border border-white/10">
                        <h3 className="text-lg font-bold mb-4">Novo Link de Convite</h3>
                        <div className="input-group">
                            <label>Nome do Link</label>
                            <input type="text" className="input-field" placeholder="Ex: Instagram Bio" value={newLinkName} onChange={e => setNewLinkName(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>Limite de Usos (Opcional)</label>
                            <input type="number" className="input-field" placeholder="Ex: 100" value={maxUses} onChange={e => setMaxUses(e.target.value)} />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button className="flex-1 py-2 bg-gray-700 rounded-lg" onClick={() => setIsLinksModalOpen(false)}>Cancelar</button>
                            <button className="flex-1 py-2 bg-[#00c2ff] text-black font-bold rounded-lg" onClick={() => { handleCreateLink(); setIsLinksModalOpen(false); }}>Criar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal VIP Door */}
            {isVipDoorModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1e26] p-6 rounded-xl w-full max-w-sm border border-[#FFD700] h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-4 text-[#FFD700]">Configurar Porta VIP</h3>
                        
                        <div className="mb-4">
                            <label className="block text-xs text-gray-400 mb-1">Mídia (Carrossel)</label>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {vipMediaItems.map((m, idx) => (
                                    <div key={idx} className="w-16 h-16 flex-shrink-0 bg-black rounded border border-white/20 relative">
                                        {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-video"></i></div>}
                                        <button className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]" onClick={() => setVipMediaItems(prev => prev.filter((_, i) => i !== idx))}>x</button>
                                    </div>
                                ))}
                                <label className="w-16 h-16 flex-shrink-0 bg-white/5 rounded border border-dashed border-white/20 flex items-center justify-center cursor-pointer">
                                    <i className="fa-solid fa-plus"></i>
                                    <input type="file" hidden multiple accept="image/*,video/*" onChange={handleVipMediaChange} />
                                </label>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Texto de Venda (Copy)</label>
                            <textarea className="input-field" rows={4} value={vipDoorText} onChange={e => setVipDoorText(e.target.value)} placeholder="Convença o usuário a entrar..."></textarea>
                        </div>

                        <div className="input-group">
                            <label>Texto do Botão</label>
                            <input type="text" className="input-field" value={vipButtonText} onChange={e => setVipButtonText(e.target.value)} placeholder="Ex: ASSINAR AGORA" />
                        </div>

                        <button className="w-full py-3 bg-[#FFD700] text-black font-bold rounded-lg mt-4" onClick={() => setIsVipDoorModalOpen(false)}>Concluir</button>
                    </div>
                </div>
            )}

        </main>
    </div>
  );
};
