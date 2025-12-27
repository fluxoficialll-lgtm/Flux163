
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { Group, GroupLink } from '../types';

export const ManageGroupLinks: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | undefined>(undefined);
  
  // Form States
  const [newLinkName, setNewLinkName] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [links, setLinks] = useState<GroupLink[]>([]);

  useEffect(() => {
    if (id) {
      loadGroupData();
    }
  }, [id]);

  const loadGroupData = () => {
      if (!id) return;
      const foundGroup = groupService.getGroupById(id);
      if (foundGroup) {
          setGroup(foundGroup);
          setLinks(foundGroup.links || []);
      } else {
          // Mock data fallback if not found in storage
          setGroup({
              id: id,
              name: 'Grupo Exemplo',
              description: '...',
              isVip: false
          } as Group);
      }
  };

  const handleCreateLink = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newLinkName.trim() || !id) return;

      const usesLimit = maxUses ? parseInt(maxUses) : undefined;
      
      const link = groupService.addGroupLink(id, newLinkName, usesLimit, expiresAt);
      
      if (link) {
          setLinks(prev => [link, ...prev]);
          // Reset form
          setNewLinkName('');
          setMaxUses('');
          setExpiresAt('');
      } else {
          // Mock update for non-persisted group (if needed for demo)
          const mockLink: GroupLink = {
              id: Date.now().toString(),
              name: newLinkName,
              code: Math.random().toString(36).substring(2, 8).toUpperCase(),
              joins: 0,
              createdAt: Date.now(),
              maxUses: usesLimit,
              expiresAt: expiresAt
          };
          setLinks(prev => [mockLink, ...prev]);
          setNewLinkName('');
          setMaxUses('');
          setExpiresAt('');
      }
  };

  const handleDeleteLink = (linkId: string) => {
      if (window.confirm("Deseja excluir este link? O código deixará de funcionar.")) {
          if (id) groupService.removeGroupLink(id, linkId);
          setLinks(prev => prev.filter(l => l.id !== linkId));
      }
  };

  const handleCopyLink = (code: string) => {
      // Use dynamic origin and correct route structure
      const url = `${window.location.origin}/#/groups?join=${code}`;
      navigator.clipboard.writeText(url);
      alert(`Link copiado para a área de transferência!`);
  };

  const formatDate = (dateString?: string) => {
      if (!dateString) return 'Nunca expira';
      return new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate(`/group-chat/${id}`);
      }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
        <style>{`
            * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
            header {
                display:flex; align-items:center; padding:16px;
                background: #0c0f14; position:fixed; width:100%; top:0; z-index:10;
                border-bottom:1px solid rgba(255,255,255,0.1); height: 65px;
            }
            header .back-btn {
                background:none; border:none; color:#fff; font-size:24px; cursor:pointer; padding-right: 15px;
            }
            header h1 { font-size:20px; font-weight:600; }
            
            main { 
                padding-top: 85px; padding-bottom: 40px; 
                width: 100%; max-width: 600px; margin: 0 auto; 
                padding-left: 20px; padding-right: 20px; 
            }

            .create-card {
                background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;
                border: 1px solid rgba(255,255,255,0.1); margin-bottom: 30px;
            }
            
            .form-row { display: flex; flex-direction: column; gap: 15px; }
            
            .input-group { display: flex; flex-direction: column; }
            .input-group label { font-size: 13px; color: #aaa; margin-bottom: 5px; font-weight: 600; }
            .input-group input {
                background: #111; border: 1px solid #333; border-radius: 8px;
                color: #fff; padding: 12px; outline: none; font-size: 14px; width: 100%;
            }
            .input-group input:focus { border-color: #00c2ff; }
            
            .create-btn {
                background: #00c2ff; color: #000; border: none; border-radius: 8px;
                padding: 12px; font-weight: 700; cursor: pointer; font-size: 16px; margin-top: 10px;
                transition: 0.3s;
            }
            .create-btn:hover { background: #0099cc; }

            .links-list { display: flex; flex-direction: column; gap: 15px; }
            .link-item {
                background: rgba(255,255,255,0.02); border-radius: 12px; padding: 15px;
                border: 1px solid rgba(255,255,255,0.05); position: relative;
            }
            .link-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
            .link-name-container { display: flex; flex-direction: column; }
            .link-name { font-weight: 700; color: #fff; font-size: 16px; }
            .link-details { font-size: 12px; color: #888; margin-top: 2px; }
            .link-stats { font-size: 12px; color: #00ff82; background: rgba(0, 255, 130, 0.1); padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
            
            .link-url-box {
                background: #000; padding: 10px; border-radius: 6px; font-family: monospace;
                color: #aaa; font-size: 13px; display: flex; justify-content: space-between; align-items: center;
                border: 1px dashed #333; margin-bottom: 12px;
                overflow: hidden;
            }
            .link-url-box span {
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
            }
            .actions { display: flex; gap: 10px; }
            .action-btn {
                flex: 1; padding: 8px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 5px;
            }
            .copy-btn { background: rgba(0,194,255,0.1); color: #00c2ff; }
            .delete-btn { background: rgba(255,77,77,0.1); color: #ff4d4d; }

            .empty-state { text-align: center; color: #777; font-size: 14px; padding: 20px; }
        `}</style>

        <header>
            <button onClick={handleBack} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
            <h1>Gerenciar Links</h1>
        </header>

        <main>
            <h2 style={{fontSize: '14px', color: '#00c2ff', textTransform: 'uppercase', marginBottom: '10px', fontWeight: '700'}}>Criar Novo Link</h2>
            <div className="create-card">
                <form onSubmit={handleCreateLink} className="form-row">
                    <div className="input-group">
                        <label>Nome do Link (Identificador)</label>
                        <input 
                            type="text" 
                            placeholder="Ex: Instagram Bio, Campanha Youtube" 
                            value={newLinkName}
                            onChange={(e) => setNewLinkName(e.target.value)}
                            maxLength={30}
                            required
                        />
                    </div>
                    
                    <div style={{display: 'flex', gap: '10px'}}>
                        <div className="input-group" style={{flex: 1}}>
                            <label>Limite de Usos</label>
                            <input 
                                type="number" 
                                placeholder="Ex: 100 (Vazio = ∞)" 
                                value={maxUses}
                                onChange={(e) => setMaxUses(e.target.value)}
                                min="1"
                            />
                        </div>
                        <div className="input-group" style={{flex: 1}}>
                            <label>Expiração (Opcional)</label>
                            <input 
                                type="datetime-local" 
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                style={{colorScheme: 'dark'}}
                            />
                        </div>
                    </div>

                    <button type="submit" className="create-btn">
                        <i className="fa-solid fa-plus"></i> Gerar Link
                    </button>
                </form>
            </div>

            <h2 style={{fontSize: '14px', color: '#00c2ff', textTransform: 'uppercase', marginBottom: '10px', fontWeight: '700'}}>Links Ativos</h2>
            <div className="links-list">
                {links.length > 0 ? (
                    links.map(link => {
                        const limitText = link.maxUses ? ` / ${link.maxUses}` : '';
                        const expiryText = link.expiresAt ? `Expira: ${formatDate(link.expiresAt)}` : null;
                        const fullUrl = `${window.location.origin}/#/groups?join=${link.code}`;

                        return (
                            <div key={link.id} className="link-item">
                                <div className="link-header">
                                    <div className="link-name-container">
                                        <span className="link-name">{link.name}</span>
                                        {expiryText && <span className="link-details"><i className="fa-regular fa-clock"></i> {expiryText}</span>}
                                    </div>
                                    <span className="link-stats">
                                        <i className="fa-solid fa-users"></i> {link.joins}{limitText}
                                    </span>
                                </div>
                                <div className="link-url-box">
                                    <span>{fullUrl}</span>
                                </div>
                                <div className="actions">
                                    <button className="action-btn copy-btn" onClick={() => handleCopyLink(link.code)}>
                                        <i className="fa-regular fa-copy"></i> Copiar
                                    </button>
                                    <button className="action-btn delete-btn" onClick={() => handleDeleteLink(link.id)}>
                                        <i className="fa-solid fa-trash"></i> Excluir
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="empty-state">
                        Nenhum link criado para este grupo.
                    </div>
                )}
            </div>
        </main>
    </div>
  );
};
