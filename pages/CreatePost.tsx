
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { postService } from '../services/postService';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { contentSafetyService } from '../services/contentSafetyService';
import { adService } from '../services/adService';
import { Post, Group } from '../types';

interface MediaPreview {
  file: File;
  url: string;
  type: 'image';
}

const LOCATIONS: any = {
    "Brasil": {
        "Ceará": ["Fortaleza", "Eusébio", "Aquiraz", "Sobral"],
        "São Paulo": ["São Paulo", "Campinas", "Santos", "Guarulhos"],
        "Rio de Janeiro": ["Rio de Janeiro", "Niterói", "Cabo Frio"],
        "Minas Gerais": ["Belo Horizonte", "Uberlândia", "Ouro Preto"]
    },
    "Estados Unidos": {
        "California": ["Los Angeles", "San Francisco", "San Diego"],
        "New York": ["New York City", "Buffalo"],
        "Florida": ["Miami", "Orlando"]
    },
    "Portugal": {
        "Lisboa": ["Lisboa", "Sintra", "Cascais"],
        "Porto": ["Porto", "Vila Nova de Gaia"]
    }
};

export const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { isAd?: boolean } | null;
  const isAd = locationState?.isAd || false;

  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaPreview[]>([]);
  const [isPublishDisabled, setIsPublishDisabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Ad Specific
  const [adBudget, setAdBudget] = useState('');
  const [adLink, setAdLink] = useState('');

  // Configs
  const [isAdultContent, setIsAdultContent] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [targetCountry, setTargetCountry] = useState('');
  const [targetState, setTargetState] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [displayLocation, setDisplayLocation] = useState('Global');

  // Groups
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  // Auto-Sales
  const [autoSalesEnabled, setAutoSalesEnabled] = useState(true);

  const user = authService.getCurrentUser();
  const username = user?.profile?.name ? `@${user.profile.name}` : "@usuario";
  const avatarUrl = user?.profile?.photoUrl;

  useEffect(() => {
    const textLength = text.trim().length;
    const hasMedia = mediaFiles.length > 0;
    const adValid = isAd ? (adBudget && parseFloat(adBudget) >= 10) : true;
    
    let groupValid = true;
    if (selectedGroup && (selectedGroup as any).status === 'inactive') {
        groupValid = false;
    }

    setIsPublishDisabled(!(textLength > 0 || hasMedia || (selectedGroup && groupValid)) || !adValid || isProcessing);
  }, [text, mediaFiles, isProcessing, adBudget, isAd, selectedGroup]);

  useEffect(() => {
      const email = authService.getCurrentUserEmail();
      if(email) {
          const allGroups = groupService.getGroupsSync();
          const ownedGroups = allGroups.filter(g => g.creatorEmail === email);
          setMyGroups(ownedGroups);
      }
  }, []);

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      if (files.length + mediaFiles.length > 5) {
          alert("Limite de 5 arquivos.");
          return;
      }
      const newPreviews: MediaPreview[] = files.map(file => ({
          file: file,
          url: URL.createObjectURL(file),
          type: 'image'
      }));
      setMediaFiles(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveMedia = (index: number) => {
      setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePublishClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPublishDisabled) return;
    setIsProcessing(true);

    setTimeout(async () => {
        try {
            const uploadPromises = mediaFiles.map(m => postService.uploadMedia(m.file));
            const uploadedRaw = await Promise.all(uploadPromises);
            const uploadedUrls = uploadedRaw.filter(u => u !== "");

            const analysis = await contentSafetyService.analyzeContent(text, uploadedUrls.map(u => ({ url: u })));
            let finalAdultStatus = isAdultContent;
            if (analysis.isAdult) finalAdultStatus = true;

            const mainMediaUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : undefined;

            // Fix: Added missing authorId
            const newPost: Post = {
              id: Date.now().toString(),
              type: uploadedUrls.length > 0 ? 'photo' : 'text',
              authorId: user?.id || '',
              username: username,
              avatar: avatarUrl,
              text: text,
              image: mainMediaUrl,
              images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
              video: undefined,
              time: "Agora",
              timestamp: Date.now(),
              isPublic: true,
              isAdultContent: finalAdultStatus,
              isAd: isAd,
              views: 0,
              likes: 0,
              comments: 0,
              liked: false,
              location: displayLocation === 'Global' ? undefined : displayLocation,
              relatedGroupId: selectedGroup?.id
            };

            await postService.addPost(newPost);
            
            if (selectedGroup?.isVip && autoSalesEnabled) {
                // Fix: Added missing ownerId to AdCampaign object
                await adService.createCampaign({
                    id: Date.now().toString(),
                    ownerId: user?.id || '',
                    name: `Auto-Boost: ${selectedGroup.name}`,
                    ownerEmail: user?.email || '',
                    scheduleType: 'continuous',
                    budget: 0,
                    pricingModel: 'commission',
                    trafficObjective: 'conversions',
                    creative: { text: text, mediaUrl: mainMediaUrl, mediaType: 'image' },
                    campaignObjective: 'group_joins',
                    destinationType: 'group',
                    targetGroupId: selectedGroup.id,
                    optimizationGoal: 'group_joins',
                    placements: ['feed', 'reels', 'marketplace'],
                    ctaButton: 'Entrar',
                    status: 'active',
                    timestamp: Date.now()
                });
            }
            
            navigate('/feed');
        } catch (error: any) {
            console.error("Erro ao publicar:", error);
            alert("Erro ao publicar.");
        } finally {
            setIsProcessing(false);
        }
    }, 50);
  };

  // Location Helpers
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTargetCountry(e.target.value); setTargetState(''); setTargetCity('');
  };
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTargetState(e.target.value); setTargetCity('');
  };
  const saveLocation = () => {
      let loc = 'Global';
      if (targetCity) loc = `${targetCity}, ${targetState}`; 
      else if (targetState) loc = `${targetState}, Brasil`;
      else if (targetCountry) loc = targetCountry === 'Brasil' ? 'Global' : targetCountry;
      setDisplayLocation(loc);
      setIsLocationModalOpen(false);
  };
  const countries = Object.keys(LOCATIONS);
  const states = targetCountry ? Object.keys(LOCATIONS[targetCountry] || {}) : [];
  const cities = (targetCountry && targetState) ? LOCATIONS[targetCountry][targetState] || [] : [];

  return (
    <div className="h-screen flex flex-col bg-[#0c0f14] text-white font-['Inter'] overflow-hidden">
      <style>{`
        header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); height: 60px; z-index: 50; background: #0c0f14; }
        header button { background: none; border: none; font-size: 16px; color: #fff; cursor: pointer; }
        header .publish-btn { background: #00c2ff; color: #000; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; opacity: 1; transition: opacity 0.3s; }
        header .publish-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #333; color: #777; }
        
        main { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        
        .input-area { display: flex; gap: 12px; }
        .user-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #333; flex-shrink: 0; }
        .text-field { flex: 1; background: transparent; border: none; color: #fff; font-size: 16px; resize: none; min-height: 100px; outline: none; padding-top: 8px; }
        .text-field::placeholder { color: #555; }

        .media-scroll { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px; }
        .media-item { width: 100px; height: 120px; border-radius: 8px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0; }
        .media-item img { width: 100%; height: 100%; object-fit: cover; }
        .remove-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: #fff; border: none; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; }

        .toolbar { display: flex; gap: 15px; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 0; align-items: center; }
        .tool-btn { background: none; border: none; color: #00c2ff; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; transition: background 0.2s; }
        .tool-btn:hover { background: rgba(0,194,255,0.1); }

        .settings-list { display: flex; flex-direction: column; gap: 2px; }
        .setting-item { display: flex; align-items: center; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
        .setting-left { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 15px; font-weight: 500; }
        .setting-icon { color: #888; width: 20px; text-align: center; }
        .setting-value { color: #00c2ff; font-size: 14px; margin-right: 10px; font-weight: 600; }
        .chevron { color: #555; font-size: 12px; }

        .ad-box { background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.2); border-radius: 10px; padding: 15px; margin-bottom: 10px; }
        .ad-input { width: 100%; background: #000; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 6px; margin-top: 5px; outline: none; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .modal { background: #1a1e26; width: 90%; max-width: 350px; border-radius: 16px; padding: 20px; border: 1px solid #333; }
        .modal select { width: 100%; background: #0c0f14; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 8px; margin-bottom: 10px; outline: none; }
        .modal-actions { display: flex; gap: 10px; margin-top: 15px; }
        .modal-btn { flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; }
        .save-btn { background: #00c2ff; color: #000; }
        .cancel-btn { background: transparent; border: 1px solid #555; color: #aaa; }
        
        .group-list { max-height: 200px; overflow-y: auto; }
        .group-item { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; display: flex; align-items: center; gap: 10px; }
        .group-item:hover { background: rgba(255,255,255,0.05); }
      `}</style>

      <header>
        <button onClick={() => navigate('/feed')}>Cancelar</button>
        <span style={{fontWeight: 700, fontSize: '16px'}}>Novo Post</span>
        <button 
            id="publishbtn" 
            className="publish-btn" 
            disabled={isPublishDisabled} 
            onClick={handlePublishClick}
        >
            {isProcessing ? '...' : (isAd ? 'Pagar' : 'Publicar')}
        </button>
      </header>

      <main>
        {isAd && (
            <div className="ad-box">
                <div style={{color: '#FFD700', fontSize:'12px', fontWeight:'700', marginBottom:'5px'}}>MODO ANÚNCIO ATIVO</div>
                <input type="number" className="ad-input" placeholder="Orçamento (Min R$ 10,00)" value={adBudget} onChange={e => setAdBudget(e.target.value)} />
                <input type="text" className="ad-input" placeholder="Link do Botão (https://...)" value={adLink} onChange={e => setAdLink(e.target.value)} />
            </div>
        )}

        <div className="input-area">
            {avatarUrl ? (
                <img src={avatarUrl} className="user-avatar" alt="Avatar" />
            ) : (
                <div className="user-avatar" style={{background:'#333', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <i className="fa-solid fa-user text-gray-500"></i>
                </div>
            )}
            <textarea 
                className="text-field" 
                placeholder="No que você está pensando?" 
                value={text} 
                onChange={e => setText(e.target.value)}
            ></textarea>
        </div>

        {mediaFiles.length > 0 && (
            <div className="media-scroll">
                {mediaFiles.map((m, idx) => (
                    <div key={idx} className="media-item">
                        <img src={m.url} alt="Preview" />
                        <button className="remove-btn" onClick={() => handleRemoveMedia(idx)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className="toolbar">
            <button className="tool-btn" onClick={() => document.getElementById('mediaInput')?.click()}>
                <i className="fa-regular fa-image"></i>
            </button>
            <button className="tool-btn" onClick={() => navigate('/create-poll')}>
                <i className="fa-solid fa-square-poll-horizontal"></i>
            </button>
            <input type="file" id="mediaInput" hidden multiple accept="image/*" onChange={handleMediaChange} />
        </div>

        <div className="settings-list">
            <div className="setting-item" onClick={() => setIsLocationModalOpen(true)}>
                <div className="setting-left">
                    <i className="fa-solid fa-location-dot setting-icon"></i>
                    <span>Localização</span>
                </div>
                <div style={{display:'flex', alignItems:'center'}}>
                    <span className="setting-value">{displayLocation}</span>
                    <i className="fa-solid fa-chevron-right chevron"></i>
                </div>
            </div>

            <div className="setting-item" onClick={() => setIsGroupModalOpen(true)}>
                <div className="setting-left">
                    <i className="fa-solid fa-users setting-icon"></i>
                    <span>Anexar Grupo</span>
                </div>
                <div style={{display:'flex', alignItems:'center'}}>
                    <span className="setting-value" style={{color: selectedGroup ? '#00ff82' : '#555'}}>
                        {selectedGroup ? selectedGroup.name.substring(0, 15) + '...' : 'Nenhum'}
                    </span>
                    {selectedGroup && <i className="fa-solid fa-xmark" style={{marginLeft:'5px', color:'#ff4d4d'}} onClick={(e) => { e.stopPropagation(); setSelectedGroup(null); }}></i>}
                    {!selectedGroup && <i className="fa-solid fa-chevron-right chevron"></i>}
                </div>
            </div>
        </div>
      </main>

      {/* Location Modal */}
      {isLocationModalOpen && (
          <div className="modal-overlay" onClick={() => setIsLocationModalOpen(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                  <h3 style={{color:'#fff', marginBottom:'15px', textAlign:'center'}}>Alcance do Post</h3>
                  <select value={targetCountry} onChange={handleCountryChange}>
                      <option value="">Global (Todos)</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {targetCountry && (
                      <select value={targetState} onChange={handleStateChange}>
                          <option value="">Todo o País</option>
                          {states.map((s: string) => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
                  {targetState && (
                      <select value={targetCity} onChange={e => setTargetCity(e.target.value)}>
                          <option value="">Todo o Estado</option>
                          {cities.map((c: string) => <option key={c} value={c}>{c}</option>)}
                      </select>
                  )}
                  <div className="modal-actions">
                      <button className="modal-btn cancel-btn" onClick={() => { setDisplayLocation('Global'); setIsLocationModalOpen(false); }}>Resetar</button>
                      <button className="modal-btn save-btn" onClick={saveLocation}>Aplicar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && (
          <div className="modal-overlay" onClick={() => setIsGroupModalOpen(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                  <h3 style={{color:'#fff', marginBottom:'15px', textAlign:'center'}}>Selecionar Grupo</h3>
                  <div className="group-list">
                      {myGroups.length > 0 ? myGroups.map(g => (
                          <div key={g.id} className="group-item" onClick={() => { setSelectedGroup(g); setIsGroupModalOpen(false); }}>
                              <i className={`fa-solid ${g.isVip ? 'fa-crown text-[#FFD700]' : 'fa-users text-[#ccc]'}`}></i>
                              <span style={{color: '#fff', fontSize: '14px'}}>{g.name}</span>
                          </div>
                      )) : <div style={{textAlign:'center', color:'#555'}}>Nenhum grupo encontrado.</div>}
                  </div>
                  <div className="modal-actions">
                      <button className="modal-btn cancel-btn" onClick={() => setIsGroupModalOpen(false)}>Fechar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
