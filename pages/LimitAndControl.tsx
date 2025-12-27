
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { Group } from '../types';

export const LimitAndControl: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // --- State ---
  
  // Members Stats & Limits
  const [currentMembers, setCurrentMembers] = useState(0); 
  const [memberLimit, setMemberLimit] = useState<number | ''>(''); 

  // Message Control
  const [onlyAdminsPost, setOnlyAdminsPost] = useState(false);
  const [msgSlowMode, setMsgSlowMode] = useState(false);
  const [msgSlowModeInterval, setMsgSlowModeInterval] = useState('30'); 

  // Entry Control
  const [approveMembers, setApproveMembers] = useState(false);
  const [joinSlowMode, setJoinSlowMode] = useState(false);
  const [joinSlowModeInterval, setJoinSlowModeInterval] = useState('60'); 

  // Content Filter
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');

  // Action Modal State
  const [actionType, setActionType] = useState<'kick' | 'ban' | 'promote' | 'demote' | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  
  // Real User List for Actions
  const [userList, setUserList] = useState<{ id: string, name: string, username: string, role: string }[]>([]);

  useEffect(() => {
      const email = authService.getCurrentUserEmail();
      setCurrentUserEmail(email);

      if (id) {
          const foundGroup = groupService.getGroupById(id);
          if (foundGroup) {
              setGroup(foundGroup);
              
              // Initialize settings from group config
              if (foundGroup.settings) {
                  if(foundGroup.settings.memberLimit) setMemberLimit(foundGroup.settings.memberLimit);
                  if(foundGroup.settings.onlyAdminsPost) setOnlyAdminsPost(foundGroup.settings.onlyAdminsPost);
                  if(foundGroup.settings.msgSlowMode) setMsgSlowMode(foundGroup.settings.msgSlowMode);
                  if(foundGroup.settings.msgSlowModeInterval) setMsgSlowModeInterval(foundGroup.settings.msgSlowModeInterval.toString());
                  if(foundGroup.settings.approveMembers) setApproveMembers(foundGroup.settings.approveMembers);
                  if(foundGroup.settings.joinSlowMode) setJoinSlowMode(foundGroup.settings.joinSlowMode);
                  if(foundGroup.settings.joinSlowModeInterval) setJoinSlowModeInterval(foundGroup.settings.joinSlowModeInterval.toString());
                  if(foundGroup.settings.forbiddenWords) setForbiddenWords(foundGroup.settings.forbiddenWords);
              }

              // Load real members
              const members = groupService.getGroupMembers(id);
              setCurrentMembers(members.length);

              // Populate user list for actions
              const formatted = members.map(u => {
                  const isAdmin = foundGroup.admins?.includes(u.email) || foundGroup.creatorEmail === u.email;
                  return {
                      id: u.email,
                      name: u.profile?.nickname || 'Usuário',
                      username: u.profile?.name ? `@${u.profile.name}` : '@user',
                      role: u.email === foundGroup.creatorEmail ? 'Dono' : (isAdmin ? 'Admin' : 'Membro')
                  };
              });
              setUserList(formatted);
          }
      }
  }, [id]);

  // Reset search when modal opens/closes
  useEffect(() => {
      if (!actionType) {
          setUserSearchTerm('');
      }
  }, [actionType]);

  // --- Handlers ---

  const handleAddWord = (e: React.FormEvent) => {
      e.preventDefault();
      if (newWord.trim() && !forbiddenWords.includes(newWord.trim().toLowerCase())) {
          setForbiddenWords([...forbiddenWords, newWord.trim().toLowerCase()]);
          setNewWord('');
      }
  };

  const removeWord = (wordToRemove: string) => {
      setForbiddenWords(forbiddenWords.filter(w => w !== wordToRemove));
  };

  const handleMemberAction = (userId: string, userName: string) => {
      if (!actionType || !group) return;
      
      // PROTECTION: Cannot affect the owner
      if (userId === group.creatorEmail) {
          alert("Não é possível realizar ações contra o Dono do grupo.");
          return;
      }

      // PROTECTION: Cannot affect self
      if (userId === currentUserEmail) {
          alert("Você não pode realizar esta ação em si mesmo aqui.");
          return;
      }

      const actionMap = {
          'kick': 'expulso',
          'ban': 'banido',
          'promote': 'promovido a Admin',
          'demote': 'rebaixado para Membro'
      };
      
      if (actionType === 'kick') {
          groupService.removeMember(group.id, userId);
          setUserList(prev => prev.filter(u => u.id !== userId));
          setCurrentMembers(prev => prev - 1);
      } else if (actionType === 'ban') {
          groupService.banMember(group.id, userId);
          setUserList(prev => prev.filter(u => u.id !== userId));
          setCurrentMembers(prev => prev - 1);
      } else if (actionType === 'promote') {
          groupService.promoteMember(group.id, userId);
          setUserList(prev => prev.map(u => u.id === userId ? { ...u, role: 'Admin' } : u));
      } else if (actionType === 'demote') {
          groupService.demoteMember(group.id, userId);
          setUserList(prev => prev.map(u => u.id === userId ? { ...u, role: 'Membro' } : u));
      }

      alert(`${userName} foi ${actionMap[actionType]} com sucesso.`);
      setActionType(null);
  };

  const handleSave = () => {
    if (group) {
        const updatedGroup: Group = {
            ...group,
            settings: {
                memberLimit: memberLimit ? Number(memberLimit) : undefined,
                onlyAdminsPost,
                msgSlowMode,
                msgSlowModeInterval: Number(msgSlowModeInterval),
                approveMembers,
                joinSlowMode: !group.isPrivate ? joinSlowMode : false, // Only save true if public
                joinSlowModeInterval: Number(joinSlowModeInterval),
                forbiddenWords
            }
        };
        
        groupService.updateGroup(updatedGroup);
        alert("Configurações salvas com sucesso!");
        navigate(-1);
    }
  };

  // Filter logic
  const filteredUsers = userList.filter(user => 
      user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  return (
    <div className="h-[100dvh] bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        
        header {
            display:flex; align-items:center; padding:16px;
            background: #0c0f14; position:fixed; width:100%; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); top: 0; height: 65px;
        }
        header button {
            background:none; border:none; color:#fff; font-size:24px; cursor:pointer;
            transition:0.3s; padding-right: 15px;
        }
        header h1 { font-size:20px; font-weight:600; }
        
        main {
            padding-top: 90px; padding-bottom: 40px;
            width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px;
            overflow-y: auto; flex-grow: 1; -webkit-overflow-scrolling: touch;
        }

        .section-title {
            font-size: 13px; color: #00c2ff; margin: 25px 0 10px 5px; 
            text-transform: uppercase; font-weight: 700; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;
        }

        .control-card {
            background: rgba(255,255,255,0.03); border-radius: 16px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.05); margin-bottom: 10px;
        }

        .control-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .control-row:last-child { border-bottom: none; }
        
        .control-col {
            display: flex; flex-direction: column; width: 100%; padding: 16px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .label-main { font-size: 16px; font-weight: 500; color: #fff; margin-bottom: 4px; }
        .label-sub { font-size: 13px; color: #888; line-height: 1.3; }

        /* Inputs inside cards */
        .card-input {
            background: #1a1e26; border: 1px solid rgba(255,255,255,0.1);
            color: #fff; padding: 10px; border-radius: 8px; outline: none;
            width: 100%; font-size: 14px; margin-top: 10px;
        }
        .card-input:focus { border-color: #00c2ff; }

        /* Switch Style */
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #00c2ff; }
        input:checked + .slider:before { transform: translateX(20px); }

        /* Actions Grid */
        .actions-grid {
            display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px;
        }
        .action-btn-card {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 15px 5px; text-align: center; cursor: pointer;
            transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .action-btn-card:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
        .action-btn-card i { font-size: 20px; }
        .action-btn-card span { font-size: 12px; font-weight: 600; }
        
        .btn-expel { color: #ff9800; border-color: rgba(255, 152, 0, 0.3); }
        .btn-ban { color: #ff4d4d; border-color: rgba(255, 77, 77, 0.3); }
        .btn-promote { color: #00c2ff; border-color: rgba(0, 194, 255, 0.3); }
        .btn-demote { color: #aaa; border-color: #555; }

        /* Tags / Chips */
        .tags-container {
            display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;
        }
        .tag {
            background: rgba(0,194,255,0.15); color: #00c2ff; padding: 5px 10px;
            border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 6px;
        }
        .tag i { cursor: pointer; font-size: 10px; opacity: 0.7; }
        .tag i:hover { opacity: 1; }

        .save-btn {
            width: 100%; padding: 16px; background: #00c2ff; color: #000; border: none;
            border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer;
            transition: 0.3s; margin-top: 20px; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,194,255,0.3);
        }
        .save-btn:hover { background: #0099cc; transform: translateY(-1px); }

        /* Simple Modal */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 50; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(3px);
        }
        .modal-box {
            background: #1a1e26; width: 90%; max-width: 350px; border-radius: 16px;
            padding: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex; flex-direction: column; max-height: 80vh;
        }
        
        /* Search in Modal */
        .modal-search-wrapper {
            position: relative; margin-bottom: 15px;
        }
        .modal-search-wrapper i {
            position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
            color: #aaa; font-size: 14px;
        }
        .modal-search-input {
            width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px; padding: 10px 10px 10px 35px; color: #fff; outline: none;
            font-size: 14px; transition: 0.3s;
        }
        .modal-search-input:focus { border-color: #00c2ff; background: rgba(255,255,255,0.1); }

        .user-select-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;
        }
        .user-select-item:hover { background: rgba(255,255,255,0.05); }
        .user-detail { display: flex; flex-direction: column; }
        .user-handle { font-size: 12px; color: #aaa; }
        
        .disabled-text { font-size: 12px; color: #666; padding: 16px; text-align: center; }
      `}</style>

      <header>
        <button onClick={() => navigate(-1)} aria-label="Voltar">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Limite e Controle</h1>
      </header>

      <main>
        
        {/* CAPACIDADE E MEMBROS */}
        <div className="section-title"><i className="fa-solid fa-users"></i> Capacidade</div>
        <div className="control-card">
            <div className="control-row">
                <div>
                    <div className="label-main">Contagem Atual</div>
                    <div className="label-sub">Membros ativos no grupo</div>
                </div>
                <div style={{fontWeight:'bold', color:'#00c2ff', fontSize:'18px'}}>{currentMembers}</div>
            </div>
            <div className="control-col">
                <div className="label-main">Limite de Membros</div>
                <div className="label-sub">Deixe em branco para ilimitado</div>
                <input 
                    type="number" 
                    className="card-input" 
                    placeholder="Ex: 5000" 
                    value={memberLimit}
                    onChange={(e) => setMemberLimit(e.target.value ? parseInt(e.target.value) : '')}
                />
            </div>
        </div>

        {/* AÇÕES ADMINISTRATIVAS */}
        <div className="section-title"><i className="fa-solid fa-gavel"></i> Ações Administrativas</div>
        <div className="actions-grid">
            <div className="action-btn-card btn-expel" onClick={() => setActionType('kick')}>
                <i className="fa-solid fa-user-minus"></i>
                <span>Expulsar</span>
            </div>
            <div className="action-btn-card btn-ban" onClick={() => setActionType('ban')}>
                <i className="fa-solid fa-ban"></i>
                <span>Banir</span>
            </div>
            <div className="action-btn-card btn-promote" onClick={() => setActionType('promote')}>
                <i className="fa-solid fa-user-shield"></i>
                <span>Promover</span>
            </div>
            <div className="action-btn-card btn-demote" onClick={() => setActionType('demote')}>
                <i className="fa-solid fa-user"></i>
                <span>Rebaixar</span>
            </div>
        </div>

        {/* CONTROLE DE MENSAGENS */}
        <div className="section-title"><i className="fa-solid fa-comments"></i> Controle de Mensagens</div>
        <div className="control-card">
            <div className="control-row">
                <div>
                    <div className="label-main">Apenas Administradores</div>
                    <div className="label-sub">Membros não podem enviar mensagens</div>
                </div>
                <label className="switch">
                    <input type="checkbox" checked={onlyAdminsPost} onChange={() => setOnlyAdminsPost(!onlyAdminsPost)} />
                    <span className="slider"></span>
                </label>
            </div>

            <div className="control-row">
                <div>
                    <div className="label-main">Modo Lento (Mensagens)</div>
                    <div className="label-sub">Intervalo entre mensagens</div>
                </div>
                <label className="switch">
                    <input type="checkbox" checked={msgSlowMode} onChange={() => setMsgSlowMode(!msgSlowMode)} />
                    <span className="slider"></span>
                </label>
            </div>
            
            {msgSlowMode && (
                <div className="control-col" style={{paddingTop:0, borderBottom: 'none'}}>
                    <div className="label-sub" style={{marginBottom:'5px'}}>Tempo de espera (segundos)</div>
                    <input 
                        type="number" 
                        className="card-input" 
                        value={msgSlowModeInterval}
                        onChange={(e) => setMsgSlowModeInterval(e.target.value)}
                    />
                </div>
            )}
        </div>

        {/* CONTROLE DE ENTRADA */}
        <div className="section-title"><i className="fa-solid fa-door-open"></i> Controle de Entrada</div>
        <div className="control-card">
            <div className="control-row">
                <div>
                    <div className="label-main">Aprovar Novos Membros</div>
                    <div className="label-sub">Admins precisam aceitar solicitações</div>
                </div>
                <label className="switch">
                    <input type="checkbox" checked={approveMembers} onChange={() => setApproveMembers(!approveMembers)} />
                    <span className="slider"></span>
                </label>
            </div>

            <div className="control-row">
                <div>
                    <div className="label-main">Modo Lento (Entrada)</div>
                    <div className="label-sub">Limitar frequência de novos membros</div>
                </div>
                {group?.isPrivate ? (
                    <div style={{fontSize:'12px', color:'#555', fontStyle:'italic'}}>Apenas Grupos Públicos</div>
                ) : (
                    <label className="switch">
                        <input type="checkbox" checked={joinSlowMode} onChange={() => setJoinSlowMode(!joinSlowMode)} />
                        <span className="slider"></span>
                    </label>
                )}
            </div>

            {!group?.isPrivate && joinSlowMode && (
                <div className="control-col" style={{paddingTop:0, borderBottom: 'none'}}>
                    <div className="label-sub" style={{marginBottom:'5px'}}>Permitir 1 pessoa a cada (minutos)</div>
                    <input 
                        type="number" 
                        className="card-input" 
                        value={joinSlowModeInterval}
                        onChange={(e) => setJoinSlowModeInterval(e.target.value)}
                    />
                </div>
            )}
            
            {group?.isPrivate && (
                <div className="disabled-text">
                    Modo lento de entrada disponível apenas para grupos públicos.
                </div>
            )}
        </div>

        {/* FILTRO DE PALAVRAS */}
        <div className="section-title"><i className="fa-solid fa-filter"></i> Palavras Proibidas</div>
        <div className="control-card">
            <div className="control-col">
                <div className="label-main">Filtro de Conteúdo</div>
                <div className="label-sub">Mensagens com estas palavras serão ocultadas</div>
                
                <form onSubmit={handleAddWord} style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                    <input 
                        type="text" 
                        className="card-input" 
                        style={{marginTop:0}}
                        placeholder="Adicionar palavra..." 
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                    />
                    <button type="submit" style={{background: '#00c2ff', border:'none', borderRadius:'8px', padding:'0 15px', color:'#000', fontWeight:'bold'}}>+</button>
                </form>

                <div className="tags-container">
                    {forbiddenWords.map((word, idx) => (
                        <div key={idx} className="tag">
                            {word} <i className="fa-solid fa-xmark" onClick={() => removeWord(word)}></i>
                        </div>
                    ))}
                    {forbiddenWords.length === 0 && <span style={{fontSize:'12px', color:'#555', fontStyle:'italic', marginTop:'5px'}}>Nenhuma palavra filtrada.</span>}
                </div>
            </div>
        </div>

        <button className="save-btn" onClick={handleSave}>
            Salvar Configurações
        </button>

      </main>

      {/* MOCK MODAL FOR ACTIONS */}
      {actionType && (
          <div className="modal-overlay" onClick={() => setActionType(null)}>
              <div className="modal-box" onClick={e => e.stopPropagation()}>
                  <h3 style={{fontSize:'18px', fontWeight:'bold', color:'#fff', marginBottom:'15px', textAlign:'center'}}>
                      Selecione para {actionType === 'kick' ? 'Expulsar' : (actionType === 'ban' ? 'Banir' : (actionType === 'promote' ? 'Promover' : 'Rebaixar'))}
                  </h3>
                  
                  {/* SEARCH INPUT */}
                  <div className="modal-search-wrapper">
                      <i className="fa-solid fa-magnifying-glass"></i>
                      <input 
                          type="text" 
                          className="modal-search-input"
                          placeholder="Pesquisar por @usuário" 
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          autoFocus
                      />
                  </div>

                  <div style={{maxHeight:'200px', overflowY:'auto'}}>
                      {filteredUsers.length > 0 ? filteredUsers.map(user => (
                          <div key={user.id} className="user-select-item" onClick={() => handleMemberAction(user.id, user.name)}>
                              <div className="user-detail">
                                  <span style={{color:'#fff'}}>{user.name}</span>
                                  <span className="user-handle">{user.username}</span>
                              </div>
                              <span style={{fontSize:'12px', color:'#888'}}>{user.role}</span>
                          </div>
                      )) : (
                          <div style={{textAlign:'center', color:'#777', padding:'10px', fontSize:'13px'}}>
                              Nenhum usuário encontrado.
                          </div>
                      )}
                  </div>
                  <button 
                    onClick={() => setActionType(null)}
                    style={{width:'100%', padding:'10px', marginTop:'15px', background:'transparent', border:'1px solid #555', color:'#aaa', borderRadius:'8px', cursor:'pointer'}}
                  >
                      Cancelar
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};
