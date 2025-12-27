
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { reelsService } from '../services/reelsService';
import { groupService } from '../services/groupService';
import { contentSafetyService } from '../services/contentSafetyService';
import { adService } from '../services/adService';
import { Post, Group } from '../types';

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
    }
};

export const CreateReel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { isAd?: boolean } | null;
  const isAd = locationState?.isAd || false;

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState(''); 
  const [isPublishDisabled, setIsPublishDisabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Ad
  const [adBudget, setAdBudget] = useState('');
  const [adLink, setAdLink] = useState('');

  // Configs
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [targetCountry, setTargetCountry] = useState('');
  const [targetState, setTargetState] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [displayLocation, setDisplayLocation] = useState('Global');

  // Groups
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  
  const [autoSalesEnabled, setAutoSalesEnabled] = useState(true);

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    const hasVideo = !!videoFile;
    const hasCaption = caption.trim().length > 0;
    const adValid = isAd ? (adBudget && parseFloat(adBudget) >= 10) : true;

    let groupValid = true;
    if (selectedGroup && (selectedGroup as any).status === 'inactive') groupValid = false;

    setIsPublishDisabled(!(hasVideo && (hasCaption || (selectedGroup && groupValid))) || !adValid || isProcessing);
  }, [videoFile, caption, isProcessing, adBudget, isAd, selectedGroup]);

  useEffect(() => {
      const email = authService.getCurrentUserEmail();
      if(email) {
          const allGroups = groupService.getGroupsSync();
          const ownedGroups = allGroups.filter(g => g.creatorEmail === email);
          setMyGroups(ownedGroups);
      }
  }, []);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePublish = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPublishDisabled || !videoFile) return;
    setIsProcessing(true);

    setTimeout(async () => {
        try {
            const uploadedVideoUrl = await reelsService.uploadVideo(videoFile);
            
            const textToCheck = `${title} ${caption}`;
            const analysis = await contentSafetyService.analyzeContent(textToCheck, [{url: uploadedVideoUrl, type: 'video'}]);
            let finalAdultStatus = false;
            if (analysis.isAdult) finalAdultStatus = true;

            const username = currentUser?.profile?.name ? `@${currentUser.profile.name}` : '@usuario';
            const avatar = currentUser?.profile?.photoUrl;

            // Fix: Added missing authorId
            const newReel: Post = {
                id: Date.now().toString(),
                type: 'video',
                authorId: currentUser?.id || '',
                username: username,
                avatar: avatar,
                title: title, 
                text: caption, 
                video: uploadedVideoUrl,
                time: 'Agora',
                timestamp: Date.now(),
                isPublic: true,
                isAdultContent: finalAdultStatus,
                views: 0,
                likes: 0,
                comments: 0,
                liked: false,
                location: displayLocation === 'Global' ? undefined : displayLocation,
                relatedGroupId: selectedGroup?.id
            };

            await reelsService.addReel(newReel);
            
            if (selectedGroup?.isVip && autoSalesEnabled && !isAd) {
                // Fix: Added missing ownerId to AdCampaign object
                await adService.createCampaign({
                    id: Date.now().toString(),
                    ownerId: currentUser?.id || '',
                    name: `Auto-Boost (Reel): ${selectedGroup.name}`,
                    ownerEmail: currentUser?.email || '',
                    scheduleType: 'continuous',
                    budget: 0,
                    pricingModel: 'commission',
                    trafficObjective: 'conversions',
                    creative: { text: caption || title, mediaUrl: uploadedVideoUrl, mediaType: 'video' },
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

            navigate('/reels'); 
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

        main { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; align-items: center; }

        .video-upload-area {
            width: 180px; aspect-ratio: 9/16; background: #1a1e26; border-radius: 12px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            border: 2px dashed rgba(255,255,255,0.1); cursor: pointer; position: relative; overflow: hidden;
            transition: border-color 0.3s; margin-top: 10px;
        }
        .video-upload-area:hover { border-color: #00c2ff; }
        .video-upload-area video { width: 100%; height: 100%; object-fit: cover; }
        .placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; color: #555; }
        .placeholder i { font-size: 30px; color: #00c2ff; }
        .placeholder span { font-size: 12px; font-weight: 600; }

        .input-group { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 10px; }
        .input-field {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px; padding: 12px 15px; color: #fff; font-size: 14px; outline: none;
            width: 100%; transition: 0.3s;
        }
        .input-field:focus { border-color: #00c2ff; background: rgba(255,255,255,0.08); }
        textarea.input-field { resize: vertical; min-height: 80px; }

        .settings-list { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 2px; }
        .setting-item { display: flex; align-items: center; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
        .setting-left { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 15px; font-weight: 500; }
        .setting-icon { color: #888; width: 20px; text-align: center; }
        .setting-value { color: #00c2ff; font-size: 14px; margin-right: 10px; font-weight: 600; }
        .chevron { color: #555; font-size: 12px; }

        .ad-box { width: 100%; max-width: 400px; background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.2); border-radius: 10px; padding: 15px; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .modal { background: #1a1e26; width: 90%; max-width: 350px; border-radius: 16px; padding: 20px; border: 1px solid #333; }
        .modal select { width: 100%; background: #0c0f14; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 8px; margin-bottom: 10px; outline: none; }
        .modal-actions { display: flex; gap: 10px; margin-top: 15px; }
        .modal-btn { flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; }
        .save-btn { background: #00c2ff; color: #000; }
        .cancel-btn { background: transparent; border: 1px solid #555; color: #aaa; }
        
        .group-list { max-height: 200px; overflow-y: auto; }
        .group-item { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; display: flex; align-items: center; gap: 10px; }
      `}</style>

      <header>
        <button onClick={() => navigate('/reels')}>Cancelar</button>
        <span style={{fontWeight: 700, fontSize: '16px'}}>Novo Reel</span>
        <button 
            className="publish-btn" 
            disabled={isPublishDisabled} 
            onClick={handlePublish}
        >
            {isProcessing ? '...' : (isAd ? 'Pagar' : 'Publicar')}
        </button>
      </header>

      <main>
        {isAd && (
            <div className="ad-box">
                <div style={{color: '#FFD700', fontSize:'12px', fontWeight:'700', marginBottom:'5px'}}>MODO ANÚNCIO</div>
                <input type="number" className="input-field" placeholder="Orçamento (Min R$ 10,00)" value={adBudget} onChange={e => setAdBudget(e.target.value)} style={{borderColor: '#FFD700'}} />
                <input type="text" className="input-field" placeholder="Link do Botão" value={adLink} onChange={e => setAdLink(e.target.value)} style={{marginTop:'10px', borderColor: '#FFD700'}} />
            </div>
        )}

        <div className="video-upload-area" onClick={() => document.getElementById('videoInput')?.click()}>
            {videoPreviewUrl ? (
                <video src={videoPreviewUrl} controls={false} autoPlay muted loop />
            ) : (
                <div className="placeholder">
                    <i className="fa-solid fa-plus"></i>
                    <span>Selecionar Vídeo</span>
                </div>
            )}
            <input type="file" id="videoInput" hidden accept="video/*" onChange={handleVideoChange} />
        </div>

        <div className="input-group">
            <input 
                type="text" 
                className="input-field" 
                placeholder="Título (Opcional)" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                maxLength={50}
            />
            <textarea 
                className="input-field" 
                placeholder="Escreva uma legenda..." 
                value={caption} 
                onChange={e => setCaption(e.target.value)}
                maxLength={2200}
            ></textarea>
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
                  <h3 style={{color:'#fff', marginBottom:'15px', textAlign:'center'}}>Alcance do Reel</h3>
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
