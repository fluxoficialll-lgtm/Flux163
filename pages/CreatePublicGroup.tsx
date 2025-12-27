
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { postService } from '../services/postService';
import { Group } from '../types';

export const CreatePublicGroup: React.FC = () => {
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    
    try {
        const currentUserId = authService.getCurrentUserId();
        const currentUserEmail = authService.getCurrentUserEmail();
        
        let finalCoverUrl = coverImage;
        if (selectedFile) {
            // DIRETÓRIO PADRONIZADO R2: group_covers
            finalCoverUrl = await postService.uploadMedia(selectedFile, 'group_covers');
        }

        // Fix: Changed members to memberIds and added creatorId
        const newGroup: Group = {
          id: Date.now().toString(),
          name: groupName,
          description: description,
          coverImage: finalCoverUrl,
          isVip: false,
          accessType: 'lifetime',
          lastMessage: "Grupo criado. Bem-vindo!",
          time: "Agora",
          creatorId: currentUserId || '',
          creatorEmail: currentUserEmail || undefined,
          memberIds: currentUserId ? [currentUserId] : [],
          adminIds: currentUserId ? [currentUserId] : []
        };

        await groupService.createGroup(newGroup);
        navigate('/groups');
    } catch (error) {
        console.error("Error creating group:", error);
        alert("Erro ao criar grupo. Tente novamente.");
    } finally {
        setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }

        header {
            display:flex; align-items:center; justify-content:space-between; padding:16px 32px;
            background: #0c0f14; position:fixed; width:100%; z-index:10; border-bottom:1px solid rgba(255,255,255,0.1);
            top: 0; height: 80px;
        }
        header button {
            background:none; border:none; color:#00c2ff; font-size:18px; cursor:pointer; transition:0.3s;
        }
        header button:hover { color:#fff; }

        main { 
            flex-grow:1; display:flex; flex-direction:column; align-items:center; 
            justify-content:flex-start; width:100%; padding-top: 100px; 
            padding-bottom: 40px; 
        }
        
        #creationContainer {
            width:100%; max-width:500px; padding: 0 20px;
            display: flex; flex-direction: column; gap: 20px;
        }
        
        h1 {
            font-size: 24px; text-align: center; margin-bottom: 20px; 
            color: #00c2ff; font-weight: 700;
        }

        /* COVER UPLOAD - ROUND */
        .cover-upload-container {
            display: flex; flex-direction: column; align-items: center; margin-bottom: 10px;
        }
        .cover-preview {
            width: 120px; height: 120px; border-radius: 50%;
            border: 3px solid #00c2ff; background: rgba(255,255,255,0.05);
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; position: relative; cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 0 20px rgba(0,194,255,0.2);
        }
        .cover-preview:hover {
            border-color: #fff; box-shadow: 0 0 25px rgba(0,194,255,0.4);
        }
        .cover-preview img {
            width: 100%; height: 100%; object-fit: cover;
        }
        .cover-icon {
            font-size: 40px; color: rgba(255,255,255,0.3);
        }
        .cover-label {
            margin-top: 10px; font-size: 14px; color: #00c2ff; cursor: pointer; font-weight: 600;
        }

        /* FORM INPUTS */
        .form-group { display: flex; flex-direction: column; }
        .form-group label {
            display: block; margin-bottom: 8px; font-weight: 600; color: #00c2ff; font-size: 14px;
        }
        .form-group input[type="text"],
        .form-group textarea {
            width: 100%; padding: 14px;
            border: 1px solid rgba(0,194,255,0.3); border-radius: 12px;
            background: rgba(255,255,255,0.05); color: #fff; font-size: 16px;
            transition: border-color 0.3s; resize: vertical;
        }
        .form-group input[type="text"]:focus,
        .form-group textarea:focus {
            border-color: #00c2ff; outline: none; box-shadow: 0 0 10px rgba(0,194,255,0.2);
        }
        .form-group textarea { min-height: 120px; }

        /* ACTION BUTTON */
        .action-button {
            width: 100%; padding: 16px 0; border: none; border-radius: 12px;
            background-color: #00c2ff; color: #0c0f14; font-size: 18px; font-weight: 700;
            cursor: pointer; transition: background-color 0.3s, transform 0.3s, box-shadow 0.3s;
            box-shadow: 0 4px 15px rgba(0,194,255,0.4); margin-top: 20px;
            display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .action-button:hover {
            background-color: #fff; box-shadow: 0 6px 20px rgba(0,194,255,0.6);
        }
        .action-button:disabled {
            background-color: #333; color: #888; cursor: not-allowed; box-shadow: none;
        }
      `}</style>

      <header>
        <button onClick={() => navigate('/create-group')}>
            <i className="fa-solid fa-arrow-left"></i>
        </button>

        {/* Standardized Logo */}
        <div 
            className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <button style={{marginLeft:'auto'}} onClick={() => navigate('/messages')}>
            <i className="fa-solid fa-message"></i>
        </button>
      </header>

      <main id="mainContent">
        <div id="creationContainer">
            <h1>Novo Grupo Público</h1>

            <form onSubmit={handleSubmit}>
                
                {/* 1. CAPA DO GRUPO (Redonda) */}
                <div className="cover-upload-container">
                    <label htmlFor="coverPhoto" className="cover-preview">
                        {coverImage ? (
                            <img src={coverImage} alt="Preview" />
                        ) : (
                            <i className="fa-solid fa-camera cover-icon"></i>
                        )}
                    </label>
                    <label htmlFor="coverPhoto" className="cover-label">Alterar Capa</label>
                    <input type="file" id="coverPhoto" accept="image/*" onChange={handleCoverChange} style={{display:'none'}} />
                </div>

                {/* 2. NOME */}
                <div className="form-group">
                    <label htmlFor="groupName">Nome do Grupo</label>
                    <input 
                        type="text" 
                        id="groupName" 
                        value={groupName} 
                        onChange={(e) => setGroupName(e.target.value)} 
                        placeholder="Digite o nome do grupo" 
                        required 
                        maxLength={50} 
                    />
                </div>

                {/* 3. DESCRIÇÃO */}
                <div className="form-group">
                    <label htmlFor="groupDescription">Descrição</label>
                    <textarea 
                        id="groupDescription" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Sobre o que é este grupo?" 
                        maxLength={500}
                    ></textarea>
                </div>

                <button type="submit" className="action-button" disabled={!groupName || isCreating}>
                    {isCreating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Criar Grupo'}
                </button>
            </form>

        </div>
      </main>
    </div>
  );
};
