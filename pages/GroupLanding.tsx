
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { Group } from '../types';
import { db } from '@/database';

export const GroupLanding: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Status States
  const [isMember, setIsMember] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  
  // Info States - All Real Data
  const [creatorName, setCreatorName] = useState('');
  const [creatorAvatar, setCreatorAvatar] = useState<string | undefined>(undefined);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (id) {
      const foundGroup = groupService.getGroupById(id);
      const currentUserEmail = authService.getCurrentUserEmail();

      if (foundGroup) {
        
        // --- REDIRECT IF ALREADY MEMBER (Bypass Landing) ---
        if (currentUserEmail && foundGroup.members?.includes(currentUserEmail)) {
            navigate(`/group-chat/${id}`, { replace: true });
            return;
        }

        setGroup(foundGroup);
        
        // 1. Check User Status
        if (currentUserEmail) {
            if (foundGroup.members?.includes(currentUserEmail)) {
                setIsMember(true);
            }
            if (foundGroup.pendingMembers?.includes(currentUserEmail)) {
                setRequestSent(true);
            }
            if (foundGroup.bannedUsers?.includes(currentUserEmail)) {
                setIsBanned(true);
            }
        }
        
        // 2. Fetch Real Creator Info
        if (foundGroup.creatorEmail) {
            const creator = db.users.get(foundGroup.creatorEmail);
            if (creator) {
                setCreatorName(creator.profile?.nickname || creator.profile?.name || 'Criador');
                setCreatorAvatar(creator.profile?.photoUrl);
            } else {
                // If creator user is deleted or not found, show email part or generic
                setCreatorName(foundGroup.creatorEmail.split('@')[0] || 'Criador');
            }
        } else {
            setCreatorName('Administrador');
        }

        // 3. Calculate Real Online Members
        if (foundGroup.members && foundGroup.members.length > 0) {
            const allUsersMap = db.users.getAll();
            const allUsers = Object.values(allUsersMap);
            const memberSet = new Set(foundGroup.members);
            const now = Date.now();
            const threshold = 15 * 60 * 1000; // 15 min active threshold

            const count = allUsers.filter(u => 
                memberSet.has(u.email) && 
                u.lastSeen && 
                (now - u.lastSeen < threshold)
            ).length;
            
            setOnlineCount(count); 
        }

      } else {
        setGroup(null);
      }
      setLoading(false);
    }
  }, [id, navigate]);

  const handleJoinAction = () => {
      if (!group || !id) return;
      
      if (isBanned) return;
      if (isMember) {
          navigate(`/group-chat/${id}`);
          return;
      }

      const result = groupService.joinGroup(id);
      
      if (result === 'joined') {
          navigate(`/group-chat/${id}`);
      } else if (result === 'pending') {
          setRequestSent(true);
      } else if (result === 'full') {
          alert('Este grupo atingiu o limite máximo de membros.');
      } else if (result === 'banned') {
          alert('Você foi banido deste grupo.');
      } else {
          alert('Ocorreu um erro ao tentar entrar no grupo.');
      }
  };

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#00c2ff]"></i>
      </div>
  );

  if (!group) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0c0f14] text-white gap-4">
          <i className="fa-solid fa-face-frown-open text-6xl text-gray-700"></i>
          <p className="text-gray-500 font-medium">Grupo não encontrado.</p>
          <button onClick={() => navigate('/groups')} className="text-[#00c2ff] hover:underline">Voltar para Grupos</button>
      </div>
  );

  const isPrivate = group.isPrivate;

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
            flex-grow: 1; display: flex; flex-direction: column; align-items: center;
            width: 100%; padding-top: 120px; padding-bottom: 100px;
        }

        .group-cover-wrapper {
            position: relative; margin-bottom: 20px;
        }
        
        .group-cover-large {
            width: 140px; height: 140px; border-radius: 50%;
            border: 4px solid ${isPrivate ? '#ff5722' : '#00c2ff'};
            object-fit: cover; 
            box-shadow: 0 0 30px ${isPrivate ? 'rgba(255,87,34,0.3)' : 'rgba(0,194,255,0.3)'};
            background: rgba(255,255,255,0.05);
            display: flex; align-items: center; justify-content: center;
            font-size: 50px; color: ${isPrivate ? '#ff5722' : '#00c2ff'};
        }
        .group-cover-large img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }

        .lock-icon {
            position: absolute; bottom: 5px; right: 5px; 
            background: ${isPrivate ? '#ff5722' : '#00c2ff'}; color: #000;
            width: 36px; height: 36px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; border: 3px solid #0c0f14;
        }

        .group-title {
            font-size: 26px; font-weight: 800; text-align: center; margin-bottom: 10px;
            color: #fff; padding: 0 20px; text-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        
        .group-badge {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
            margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1px;
        }
        .badge-public { background: rgba(0,194,255,0.1); color: #00c2ff; border: 1px solid rgba(0,194,255,0.3); }
        .badge-private { background: rgba(255,87,34,0.1); color: #ff5722; border: 1px solid rgba(255,87,34,0.3); }

        .info-box {
            background: rgba(255,255,255,0.03); border-radius: 24px; padding: 25px;
            width: 90%; max-width: 420px; border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 30px; text-align: center;
            backdrop-filter: blur(10px);
        }
        
        .creator-section {
            display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px;
            background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: 50px;
            display: inline-flex; border: 1px solid rgba(255,255,255,0.05);
        }
        .creator-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .creator-placeholder { width: 24px; height: 24px; border-radius: 50%; background: #333; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #888; }
        .creator-text { font-size: 13px; color: #ccc; }
        .creator-text strong { color: #fff; font-weight: 600; }
        
        .description {
            font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.8); margin-bottom: 25px;
            font-weight: 300; white-space: pre-wrap;
        }
        
        .stats-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 15px;
            border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;
        }
        .stat-item { display: flex; flex-direction: column; align-items: center; }
        .stat-val { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .stat-label { font-size: 11px; color: #777; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }

        .join-btn {
            width: 90%; max-width: 350px; padding: 18px; border: none; border-radius: 16px;
            font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.3s;
            display: flex; align-items: center; justify-content: center; gap: 12px;
            box-shadow: 0 4px 30px rgba(0,0,0,0.3); text-transform: uppercase; letter-spacing: 0.5px;
        }
        .btn-public { background: #00c2ff; color: #0c0f14; }
        .btn-public:hover { background: #0099cc; transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,194,255,0.3); }
        
        .btn-private { background: #ff5722; color: #fff; }
        .btn-private:hover { background: #e64a19; transform: translateY(-2px); box-shadow: 0 10px 40px rgba(255,87,34,0.3); }
        
        .btn-disabled { 
            background: rgba(255,255,255,0.1); color: #888; cursor: not-allowed; 
            box-shadow: none; border: 1px solid rgba(255,255,255,0.1);
        }
        .btn-disabled:hover { transform: none; }
        
        .btn-open {
            background: #00ff82; color: #0c0f14;
        }
        .btn-open:hover { background: #00e676; transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,255,130,0.3); }

      `}</style>

      <header>
        <button onClick={() => navigate('/groups')}><i className="fa-solid fa-arrow-left"></i></button>
        
        <div 
            className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <div style={{width:'24px'}}></div>
      </header>

      <main>
        <div className="group-cover-wrapper">
            <div className="group-cover-large">
                {group.coverImage ? (
                    <img src={group.coverImage} alt={group.name} />
                ) : (
                    <i className={`fa-solid ${isPrivate ? 'fa-lock' : 'fa-users'}`}></i>
                )}
            </div>
            <div className="lock-icon">
                <i className={`fa-solid ${isPrivate ? 'fa-lock' : 'fa-globe'}`}></i>
            </div>
        </div>

        <h1 className="group-title">{group.name}</h1>
        
        <div className={`group-badge ${isPrivate ? 'badge-private' : 'badge-public'}`}>
            {isPrivate ? 'Comunidade Fechada' : 'Comunidade Pública'}
        </div>

        <div className="info-box">
            <div className="creator-section">
                {creatorAvatar ? (
                    <img src={creatorAvatar} className="creator-avatar" alt="Admin" />
                ) : (
                    <div className="creator-placeholder"><i className="fa-solid fa-user"></i></div>
                )}
                <span className="creator-text">Admin <strong>{creatorName}</strong></span>
            </div>
            
            <div className="description">
                {group.description || "Este grupo ainda não possui uma descrição."}
            </div>

            <div className="stats-grid">
                <div className="stat-item">
                    <span className="stat-val">{group.members?.length || 0}</span>
                    <span className="stat-label">Membros</span>
                </div>
                <div className="stat-item">
                    <span className="stat-val text-[#00ff82]">{onlineCount}</span>
                    <span className="stat-label">Online Agora</span>
                </div>
            </div>
        </div>

        {isBanned ? (
            <button className="join-btn btn-disabled" disabled>
                <i className="fa-solid fa-ban"></i> Você foi banido
            </button>
        ) : isMember ? (
            <button className="join-btn btn-open" onClick={handleJoinAction}>
                <i className="fa-regular fa-comments"></i> Abrir Conversa
            </button>
        ) : requestSent ? (
            <button className="join-btn btn-disabled" disabled>
                <i className="fa-solid fa-clock"></i> Aguardando Aprovação...
            </button>
        ) : (
            <button 
                className={`join-btn ${isPrivate ? 'btn-private' : 'btn-public'}`}
                onClick={handleJoinAction}
            >
                {isPrivate ? (
                    <>
                        <i className="fa-solid fa-user-plus"></i> Solicitar Entrada
                    </>
                ) : (
                    <>
                        <i className="fa-solid fa-arrow-right-to-bracket"></i> Entrar no Grupo
                    </>
                )}
            </button>
        )}

        {isPrivate && !requestSent && !isMember && !isBanned && (
            <p style={{marginTop:'20px', fontSize:'13px', color:'#666', maxWidth:'300px', textAlign:'center', lineHeight: 1.4}}>
                <i className="fa-solid fa-shield-halved mr-1"></i> Este grupo é moderado. Sua entrada depende da aprovação de um administrador.
            </p>
        )}

      </main>
    </div>
  );
};
