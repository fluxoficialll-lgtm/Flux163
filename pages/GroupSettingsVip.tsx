
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { Group } from '../types';
import { db } from '@/database';

export const GroupSettingsVip: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  
  // Form States
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  
  // VIP Config States
  const [vipPhoto, setVipPhoto] = useState<string | undefined>(undefined);
  const [vipText, setVipText] = useState('');
  const [vipButtonText, setVipButtonText] = useState('');
  const [vipPrice, setVipPrice] = useState('');
  const [manualUsername, setManualUsername] = useState('');

  useEffect(() => {
      if (id) {
          const foundGroup = groupService.getGroupById(id);
          if (foundGroup) {
              setGroup(foundGroup);
              setGroupName(foundGroup.name);
              setDescription(foundGroup.description);
              setCoverImage(foundGroup.coverImage);
              
              if (foundGroup.vipDoor) {
                  setVipText(foundGroup.vipDoor.text || '');
                  setVipButtonText(foundGroup.vipDoor.buttonText || ''); 
                  if (foundGroup.vipDoor.mediaItems && foundGroup.vipDoor.mediaItems.length > 0) {
                      setVipPhoto(foundGroup.vipDoor.mediaItems[0].url);
                  } else if (foundGroup.vipDoor.media) {
                      setVipPhoto(foundGroup.vipDoor.media);
                  }
              }
              setVipPrice(foundGroup.price || '');
          } else {
              setGroup({
                  id: id,
                  name: 'Grupo VIP Mock',
                  description: 'Acesso exclusivo.',
                  isVip: true,
                  time: '',
                  lastMessage: '',
                  creatorEmail: authService.getCurrentUserEmail() || undefined
              });
              setGroupName('Grupo VIP Mock');
              setDescription('Acesso exclusivo.');
          }
      }
  }, [id]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVipPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setVipPhoto(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveVipPhoto = () => {
      if(group) {
          const currentMedia = group.vipDoor?.mediaItems || [];
          const newMedia = vipPhoto ? [{url: vipPhoto, type: 'image' as const}, ...currentMedia.slice(1)] : currentMedia;
          
          const updatedGroup = {
              ...group,
              vipDoor: { ...group.vipDoor, mediaItems: newMedia },
              // Safety: Explicitly preserve Pixel fields
              pixelId: group.pixelId,
              pixelToken: group.pixelToken
          };
          groupService.updateGroup(updatedGroup);
          setGroup(updatedGroup);
          alert('Foto VIP salva!');
      }
  };

  const saveVipText = () => {
      if(group) {
          const updatedGroup = {
              ...group,
              vipDoor: { ...group.vipDoor, text: vipText },
              pixelId: group.pixelId,
              pixelToken: group.pixelToken
          };
          groupService.updateGroup(updatedGroup);
          setGroup(updatedGroup);
          alert('Copyright salvo!');
      }
  };

  const saveVipButtonText = () => {
      if(group) {
          const updatedGroup = {
              ...group,
              vipDoor: { ...group.vipDoor, buttonText: vipButtonText },
              pixelId: group.pixelId,
              pixelToken: group.pixelToken
          };
          groupService.updateGroup(updatedGroup);
          setGroup(updatedGroup);
          alert('Texto do botão salvo!');
      }
  };

  const saveVipPrice = () => {
      if(group) {
          const numericPrice = parseFloat(vipPrice.replace(',', '.'));
          if (isNaN(numericPrice) || numericPrice < 6) {
              alert("⚠️ O preço mínimo para um grupo VIP é R$ 6,00.");
              return;
          }

          const updatedGroup = { 
              ...group, 
              price: vipPrice,
              pixelId: group.pixelId,
              pixelToken: group.pixelToken
          };
          groupService.updateGroup(updatedGroup);
          setGroup(updatedGroup);
          alert('Preço salvo!');
      }
  };

  const handleManualRelease = async () => {
      if(!manualUsername.trim() || !group) return;
      const cleanHandle = manualUsername.replace('@', '').toLowerCase();
      const user = await authService.fetchUserByHandle(cleanHandle);
      
      if (user) {
          db.vipAccess.grant({
              userId: user.email,
              groupId: group.id,
              status: 'active',
              purchaseDate: Date.now(),
              transactionId: `manual_${Date.now()}_admin`
          });
          groupService.approveMember(group.id, user.email);
          alert(`Acesso VIP liberado manualmente para @${cleanHandle}`);
          setManualUsername('');
      } else {
          alert(`Usuário @${cleanHandle} não encontrado.`);
      }
  };

  // Global Save - Updated with Persistence Safeguard
  const handleGlobalSave = () => {
      if (group) {
          const updatedGroup: Group = {
              ...group, // Base Spread
              name: groupName,
              description: description,
              coverImage: coverImage,
              // SECURITY: Explicitly ensure sensitive pixel data isn't lost if UI logic fails
              pixelId: group.pixelId,
              pixelToken: group.pixelToken
          };
          groupService.updateGroup(updatedGroup);
          alert("Todas as alterações foram salvas!");
          navigate(`/group-chat/${id}`);
      }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
        <style>{`
            * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
            header {
                display:flex; align-items:center; justify-content:space-between; padding:16px;
                background: #0c0f14; position:fixed; width:100%; top:0; z-index:10;
                border-bottom:1px solid rgba(255,255,255,0.1); height: 65px;
            }
            header .nav-btn {
                background:none; border:none; color:#fff; font-size:20px; cursor:pointer; padding: 5px;
            }

            main { padding-top: 85px; padding-bottom: 40px; width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px; }
            
            .section-title { font-size: 14px; color: #FFD700; margin-bottom: 10px; text-transform: uppercase; font-weight: 700; margin-top: 30px; }
            
            /* Cover Upload */
            .cover-container { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
            .cover-preview {
                width: 100px; height: 100px; border-radius: 50%; border: 3px solid #FFD700;
                background: #1e2531; overflow: hidden; position: relative; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
            }
            .cover-preview img { width: 100%; height: 100%; object-fit: cover; }
            .camera-overlay {
                position: absolute; bottom: 0; width: 100%; background: rgba(0,0,0,0.6);
                text-align: center; padding: 5px 0; color: #fff; font-size: 14px;
            }
            .change-cover-btn {
                margin-top: 10px; color: #FFD700; background: none; border: none; font-size: 14px; cursor: pointer;
            }

            /* Inputs */
            .input-group { margin-bottom: 15px; }
            .input-group label { display: block; font-size: 14px; color: #aaa; margin-bottom: 5px; }
            .input-group input, .input-group textarea {
                width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; color: #fff; padding: 12px; font-size: 16px; outline: none; transition: 0.3s;
            }
            .input-group input:focus, .input-group textarea:focus { border-color: #FFD700; }
            .read-only-field {
                padding: 12px; color: #FFD700; font-weight: bold; background: rgba(255,215,0,0.1); border-radius: 8px;
            }

            /* VIP Settings Card */
            .vip-card {
                background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.2);
                border-radius: 12px; padding: 20px; margin-bottom: 20px;
            }
            .vip-sub-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }
            
            .vip-photo-box {
                display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 20px;
            }
            .vip-photo-preview {
                width: 100%; height: 200px; background: #000; border-radius: 8px; overflow: hidden;
                display: flex; align-items: center; justify-content: center; border: 1px dashed #FFD700;
            }
            .vip-photo-preview img { width: 100%; height: 100%; object-fit: cover; }
            
            .small-btn {
                padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none;
                background: #1e2531; color: #fff; border: 1px solid #555; transition: 0.3s;
            }
            .small-btn:hover { background: #28303f; }
            .small-btn.primary { background: #FFD700; color: #000; border-color: #FFD700; }
            .small-btn.primary:hover { background: #e6c200; }

            /* Action Buttons (Navigation style) */
            .nav-action-btn {
                width: 100%; display: flex; align-items: center; justify-content: space-between;
                padding: 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; color: #fff; cursor: pointer; margin-bottom: 10px; transition: 0.3s;
            }
            .nav-action-btn:hover { background: rgba(255,255,255,0.1); border-color: #FFD700; }
            .nav-action-btn .left-icon { width: 30px; text-align: center; color: #FFD700; font-size: 18px; margin-right: 10px; }
            .nav-action-btn span { font-size: 16px; font-weight: 500; }
            
            /* Manual Release */
            .manual-release-box {
                display: flex; gap: 10px; margin-top: 10px;
            }
            .manual-release-box input { flex-grow: 1; margin-bottom: 0; }
            
            /* Footer Buttons */
            .save-btn {
                width: 100%; padding: 15px; background: #FFD700; color: #000; border: none;
                border-radius: 10px; font-weight: bold; font-size: 16px; cursor: pointer;
                margin-top: 20px; margin-bottom: 10px; transition: 0.3s;
            }
            .save-btn:hover { background: #e6c200; }
            
            .secondary-btn {
                width: 100%; padding: 15px; background: transparent; color: #fff; border: 1px solid #333;
                border-radius: 10px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.3s;
            }
            .secondary-btn:hover { background: rgba(255,255,255,0.05); border-color: #555; }
        `}</style>

        <header>
            <button onClick={() => navigate(`/group-chat/${id}`)} className="nav-btn"><i className="fa-solid fa-xmark"></i></button>
            
            {/* Standardized Logo */}
            <div 
                className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
                onClick={() => navigate('/feed')}
            >
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
            </div>

            <div style={{width: '30px'}}></div> {/* Spacer */}
        </header>

        <main>
            {/* Informações Básicas */}
            <div className="section-title">Informações básicas</div>
            
            <div className="cover-container">
                <div className="cover-preview" onClick={() => document.getElementById('coverUpload')?.click()}>
                    {coverImage ? (
                        <img src={coverImage} alt="Cover" />
                    ) : (
                        <i className="fa-solid fa-crown" style={{fontSize: '40px', color: '#555'}}></i>
                    )}
                    <div className="camera-overlay"><i className="fa-solid fa-camera"></i></div>
                </div>
                <button className="change-cover-btn" onClick={() => document.getElementById('coverUpload')?.click()}>
                    Alterar capa do grupo
                </button>
                <input type="file" id="coverUpload" hidden accept="image/*" onChange={handleCoverChange} />
            </div>

            <div className="input-group">
                <label>Nome do grupo</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>

            <div className="input-group">
                <label>Descrição do grupo</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
            </div>

            <div className="input-group">
                <label>Tipo de grupo</label>
                <div className="read-only-field">Grupo VIP</div>
            </div>

            {/* Configurações VIP */}
            <div className="section-title">Configurações VIP</div>
            <div className="vip-card">
                <div className="vip-sub-title">Editar</div>
                
                <label style={{display:'block', fontSize:'14px', color:'#aaa', marginBottom:'5px'}}>Foto VIP</label>
                <div className="vip-photo-box">
                    <div className="vip-photo-preview">
                        {vipPhoto ? <img src={vipPhoto} alt="VIP" /> : <span style={{color:'#555'}}>Sem foto</span>}
                    </div>
                    <div style={{display:'flex', gap:'10px', width: '100%'}}>
                        <button className="small-btn" style={{flex:1}} onClick={() => document.getElementById('vipPhotoInput')?.click()}>Escolher foto</button>
                        <button className="small-btn primary" style={{flex:1}} onClick={saveVipPhoto}>Salvar foto</button>
                    </div>
                    <input type="file" id="vipPhotoInput" hidden accept="image/*" onChange={handleVipPhotoChange} />
                </div>

                <div className="input-group">
                    <label>Copyright (Texto de Venda)</label>
                    <textarea rows={4} value={vipText} onChange={(e) => setVipText(e.target.value)} placeholder="Texto persuasivo para a porta do grupo..."></textarea>
                    <button className="small-btn primary" style={{marginTop:'5px', width:'100%'}} onClick={saveVipText}>Salvar Copyright</button>
                </div>

                <div className="input-group">
                    <label>Texto do Botão (Opcional)</label>
                    <input type="text" value={vipButtonText} onChange={(e) => setVipButtonText(e.target.value)} placeholder="Ex: Assinar" maxLength={20} />
                    <button className="small-btn primary" style={{marginTop:'5px', width:'100%'}} onClick={saveVipButtonText}>Salvar Botão</button>
                </div>

                <div className="input-group">
                    <label>Preço</label>
                    <input type="text" value={vipPrice} onChange={(e) => setVipPrice(e.target.value)} placeholder="Ex: 49.90" />
                    <button className="small-btn primary" style={{marginTop:'5px', width:'100%'}} onClick={saveVipPrice}>Salvar Preço</button>
                </div>

                <button className="nav-action-btn" style={{background: '#1e2531', borderColor: '#FFD700', justifyContent: 'center'}} onClick={() => navigate(`/vip-sales-history/${id}`)}>
                    <i className="fa-solid fa-chart-line" style={{color:'#FFD700', marginRight: '10px'}}></i>
                    <span>Histórico básico de vendas</span>
                </button>

                <div className="vip-sub-title" style={{marginTop:'20px'}}>Liberar acesso manual</div>
                <label style={{fontSize:'13px', color:'#aaa'}}>Digite o @usuário para liberar</label>
                <div className="manual-release-box">
                    <input type="text" placeholder="@usuário" value={manualUsername} onChange={(e) => setManualUsername(e.target.value)} />
                    <button className="small-btn primary" onClick={handleManualRelease}>Liberar</button>
                </div>
            </div>

            {/* Controle e Moderação */}
            <div className="section-title">Controle e moderação</div>
            
            <button className="nav-action-btn" onClick={() => navigate(`/group-limits/${id}`)}>
                <div style={{display:'flex', alignItems:'center'}}>
                    <div className="left-icon"><i className="fa-solid fa-sliders"></i></div>
                    <span>Limite e controle</span>
                </div>
                <i className="fa-solid fa-chevron-right" style={{color:'#555', fontSize:'14px'}}></i>
            </button>

            {/* Ferramentas Avançadas */}
            <div className="section-title">Ferramentas avançadas</div>

            <button className="nav-action-btn" onClick={() => navigate('/group-links/' + id)}>
                <div style={{display:'flex', alignItems:'center'}}>
                    <div className="left-icon"><i className="fa-solid fa-link"></i></div>
                    <span>Gerenciar Links</span>
                </div>
                <i className="fa-solid fa-chevron-right" style={{color:'#555', fontSize:'14px'}}></i>
            </button>

            {/* Ações */}
            <button className="save-btn" onClick={handleGlobalSave}>
                Salvar Alterações
            </button>
            
            <button className="secondary-btn" onClick={() => navigate(`/group-chat/${id}`)}>
                Sair
            </button>

        </main>
    </div>
  );
};
