
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { Group } from '../types';

export const GroupSettingsPublic: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  
  // Form States
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);

  useEffect(() => {
      if (id) {
          const foundGroup = groupService.getGroupById(id);
          if (foundGroup) {
              setGroup(foundGroup);
              setGroupName(foundGroup.name);
              setDescription(foundGroup.description);
              setCoverImage(foundGroup.coverImage);
          } else {
              // Fallback mock
              setGroup({
                  id: id,
                  name: 'Grupo Exemplo',
                  description: 'Descrição do grupo...',
                  isVip: false,
                  time: '',
                  lastMessage: '',
                  creatorEmail: authService.getCurrentUserEmail() || undefined
              });
              setGroupName('Grupo Exemplo');
              setDescription('Descrição do grupo...');
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

  const handleSave = () => {
      if (group) {
          const updatedGroup: Group = {
              ...group,
              name: groupName,
              description: description,
              coverImage: coverImage
          };
          groupService.updateGroup(updatedGroup);
          alert("Alterações salvas com sucesso!");
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
            
            .section-title { font-size: 14px; color: #00c2ff; margin-bottom: 10px; text-transform: uppercase; font-weight: 700; margin-top: 30px; }
            
            /* Cover Upload */
            .cover-container { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
            .cover-preview {
                width: 100px; height: 100px; border-radius: 50%; border: 3px solid #00c2ff;
                background: #1e2531; overflow: hidden; position: relative; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
            }
            .cover-preview img { width: 100%; height: 100%; object-fit: cover; }
            .camera-overlay {
                position: absolute; bottom: 0; width: 100%; background: rgba(0,0,0,0.6);
                text-align: center; padding: 5px 0; color: #fff; font-size: 14px;
            }
            .change-cover-btn {
                margin-top: 10px; color: #00c2ff; background: none; border: none; font-size: 14px; cursor: pointer;
            }

            /* Inputs */
            .input-group { margin-bottom: 15px; }
            .input-group label { display: block; font-size: 14px; color: #aaa; margin-bottom: 5px; }
            .input-group input, .input-group textarea {
                width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; color: #fff; padding: 12px; font-size: 16px; outline: none; transition: 0.3s;
            }
            .input-group input:focus, .input-group textarea:focus { border-color: #00c2ff; }
            .read-only-field {
                padding: 12px; color: #00c2ff; font-weight: bold; background: rgba(0,194,255,0.1); border-radius: 8px;
            }

            /* Action Buttons (Navigation style) */
            .nav-action-btn {
                width: 100%; display: flex; align-items: center; justify-content: space-between;
                padding: 15px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px; color: #fff; cursor: pointer; margin-bottom: 10px; transition: 0.3s;
            }
            .nav-action-btn:hover { background: rgba(255,255,255,0.1); border-color: #00c2ff; }
            .nav-action-btn .left-icon { width: 30px; text-align: center; color: #00c2ff; font-size: 18px; margin-right: 10px; }
            .nav-action-btn span { font-size: 16px; font-weight: 500; }
            
            /* Footer Buttons */
            .save-btn {
                width: 100%; padding: 15px; background: #00c2ff; color: #000; border: none;
                border-radius: 10px; font-weight: bold; font-size: 16px; cursor: pointer;
                margin-top: 20px; margin-bottom: 10px; transition: 0.3s;
            }
            .save-btn:hover { background: #0099cc; }
            
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
                        <i className="fa-solid fa-users" style={{fontSize: '40px', color: '#555'}}></i>
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
                <div className="read-only-field">Grupo Público</div>
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
            <button className="save-btn" onClick={handleSave}>
                Salvar Alterações
            </button>
            
            <button className="secondary-btn" onClick={() => navigate(`/group-chat/${id}`)}>
                Cancelar
            </button>

        </main>
    </div>
  );
};
