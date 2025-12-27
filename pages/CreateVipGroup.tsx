
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { Group, VipMediaItem } from '../types';

export const CreateVipGroup: React.FC = () => {
  const navigate = useNavigate();
  
  // Form States
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  
  // VIP Door States
  const [vipMediaItems, setVipMediaItems] = useState<{file?: File, url: string, type: 'image' | 'video'}[]>([]);
  const [vipDoorText, setVipDoorText] = useState('');
  const [vipButtonText, setVipButtonText] = useState(''); 

  // Price & Access States
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'BRL' | 'USD' | 'EUR' | 'BTC'>('BRL');
  const [accessType, setAccessType] = useState<'lifetime' | 'temporary'>('lifetime');
  
  // Recurrence State
  const [billingCycleDays, setBillingCycleDays] = useState<string>('30'); 
  
  // Advanced Marketing
  const [pixelId, setPixelId] = useState('');
  const [pixelToken, setPixelToken] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
      const user = authService.getCurrentUser();
      const connected = !!user?.paymentConfig?.isConnected;
      setHasProvider(connected);
  }, []);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedCoverFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVipMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files) as File[];
    
    if (vipMediaItems.length + fileArray.length > 10) {
        alert("Máximo de 10 itens na galeria.");
        return;
    }

    const newEntries = fileArray.map(file => ({
        file: file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' as const : 'image' as const
    }));

    setVipMediaItems(prev => [...prev, ...newEntries]);
  };

  const removeMediaItem = (index: number) => {
      setVipMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAccessTypeChange = (type: 'lifetime' | 'temporary') => {
    setAccessType(type);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      value = value.replace(/\D/g, "");
      if (value === "") { setPrice(""); return; }
      const numericValue = parseFloat(value) / 100;
      setPrice(numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    const rawPrice = price.replace(/\./g, '').replace(',', '.');
    const numericPrice = parseFloat(rawPrice);

    if (isNaN(numericPrice) || numericPrice < 6.00) {
        alert("⚠️ O preço mínimo para criar um grupo VIP é R$ 6,00.");
        return;
    }

    const days = parseInt(billingCycleDays);
    if (accessType === 'temporary' && (isNaN(days) || days < 1)) {
        alert("🚨 Defina um intervalo de dias válido.");
        return;
    }

    setIsCreating(true);
    try {
        const currentUserId = authService.getCurrentUserId();
        const currentUserEmail = authService.getCurrentUserEmail();

        // PADRONIZAÇÃO R2: Capas/Avatares vão para 'avatars'
        let finalCoverUrl = coverImage;
        if (selectedCoverFile) {
            finalCoverUrl = await postService.uploadMedia(selectedCoverFile, 'avatars');
        }

        // PADRONIZAÇÃO R2: Mídias da Porta VIP vão para 'vips_doors'
        const uploadedVipMedia: VipMediaItem[] = await Promise.all(
            vipMediaItems.map(async (item) => {
                if (item.file) {
                    const url = await postService.uploadMedia(item.file, 'vips_doors');
                    return { url, type: item.type };
                }
                return { url: item.url, type: item.type };
            })
        );

        // Fix: Changed members to memberIds and added creatorId
        const newGroup: Group = {
          id: Date.now().toString(),
          name: groupName,
          description: description,
          coverImage: finalCoverUrl,
          isVip: true,
          price: numericPrice.toString(),
          currency: currency,
          accessType: accessType,
          expirationDate: accessType === 'temporary' ? days.toString() : undefined,
          vipDoor: {
            mediaItems: uploadedVipMedia,
            text: vipDoorText || "Bem-vindo ao VIP!",
            buttonText: vipButtonText
          },
          lastMessage: hasProvider ? "Grupo criado. Configure os conteúdos." : "Grupo INATIVO. Conecte um provedor.",
          time: "Agora",
          creatorId: currentUserId || '',
          creatorEmail: currentUserEmail || undefined,
          memberIds: currentUserId ? [currentUserId] : [],
          adminIds: currentUserId ? [currentUserId] : [],
          status: hasProvider ? 'active' : 'inactive',
          pixelId: pixelId || undefined,
          pixelToken: pixelToken || undefined
        };

        await groupService.createGroup(newGroup);
        navigate('/groups');
    } catch (e) {
        alert("Erro ao criar grupo VIP.");
    } finally {
        setIsCreating(false);
    }
  };

  const getCurrencySymbol = () => {
    switch (currency) {
      case 'USD': return '$'; case 'EUR': return '€'; case 'BTC': return '₿'; default: return 'R$';
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
        main { flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:100%; padding-top: 100px; padding-bottom: 100px; }
        #groupCreationForm { width:100%; max-width:500px; padding:0 20px; display: flex; flex-direction: column; gap: 20px; }
        h1 { font-size: 24px; text-align: center; margin-bottom: 20px; background: -webkit-linear-gradient(145deg, #FFD700, #B8860B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 700; }
        .cover-upload-container { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }
        .cover-preview { width: 120px; height: 120px; border-radius: 50%; border: 3px solid #FFD700; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 0 20px rgba(255, 215, 0, 0.2); }
        .cover-preview:hover { border-color: #fff; box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); }
        .cover-preview img { width: 100%; height: 100%; object-fit: cover; }
        .cover-icon { font-size: 40px; color: rgba(255,255,255,0.3); }
        .cover-label { margin-top: 10px; font-size: 14px; color: #FFD700; cursor: pointer; font-weight: 600; }
        .form-group { display: flex; flex-direction: column; }
        .form-group label { font-size: 14px; color: #FFD700; margin-bottom: 8px; font-weight: 600; }
        .form-group input, .form-group textarea { background: #1e2531; border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 8px; color: #fff; padding: 12px; font-size: 16px; transition: border-color 0.3s; }
        .form-group input:focus, .form-group textarea:focus { border-color: #FFD700; outline: none; box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
        .form-group textarea { resize: vertical; min-height: 100px; }
        .vip-door-section { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 10px; }
        .section-title { font-size: 16px; color: #FFD700; font-weight: 700; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
        .media-upload-area { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; }
        .media-preview-item { width: 80px; height: 100px; flex-shrink: 0; border-radius: 8px; overflow: hidden; position: relative; border: 1px solid rgba(255, 215, 0, 0.3); background: #000; }
        .media-preview-item img, .media-preview-item video { width: 100%; height: 100%; object-fit: cover; }
        .remove-media-btn { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #ff4d4d; border: none; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
        .add-media-btn { width: 80px; height: 100px; flex-shrink: 0; border-radius: 8px; border: 1px dashed #FFD700; background: rgba(255, 215, 0, 0.05); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFD700; cursor: pointer; gap: 5px; }
        .add-media-btn:hover { background: rgba(255, 215, 0, 0.1); }
        .add-media-btn span { font-size: 10px; font-weight: 600; text-align: center; }
        .common-button { background: #FFD700; border: none; border-radius: 8px; color: #000; padding: 16px 20px; font-size: 18px; font-weight: 700; cursor: pointer; transition: background 0.3s, transform 0.1s; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 8px rgba(255, 215, 0, 0.3); margin-top: 20px; }
        .common-button:hover { background: #e6c200; }
        .common-button:active { transform: scale(0.99); }
        .common-button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .price-group { display: flex; flex-direction: column; gap: 10px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); }
        .price-group label { font-size: 14px; color: #FFD700; font-weight: 600; }
        .price-input-container { display: flex; align-items: center; background: #1e2531; border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 8px; overflow: hidden; margin-bottom: 5px; }
        .price-input-container span { padding: 12px; background: #28303f; color: #aaa; font-size: 16px; font-weight: 700; min-width: 50px; text-align: center; }
        .price-input-container input { flex-grow: 1; border: none; background: none; padding: 12px; text-align: right; color: #fff; font-weight: 700; }
        .radio-group-container { display: flex; gap: 10px; margin-bottom: 15px; }
        .custom-radio { flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px 15px; background: #1e2531; border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 8px; color: #fff; cursor: pointer; transition: background 0.3s; font-size: 14px; font-weight: 600; flex-direction: column; gap: 4px; }
        .custom-radio.selected { background: #FFD700; color: #000; border-color: #FFD700; }
        .currency-selector { display: flex; gap: 8px; margin-bottom: 15px; }
        .currency-option { flex: 1; padding: 10px 5px; background: #1e2531; border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 8px; color: #fff; cursor: pointer; text-align: center; font-size: 14px; font-weight: 600; transition: all 0.3s; display: flex; align-items: center; justify-content: center; }
        .currency-option.selected { background: #FFD700; color: #000; border-color: #FFD700; }
        .cycle-box { background: rgba(255, 215, 0, 0.05); border: 1px dashed rgba(255, 215, 0, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px; }
      `}</style>

      <header>
        <button onClick={() => navigate('/create-group')}><i className="fa-solid fa-xmark"></i></button>
        <div className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]" onClick={() => navigate('/feed')}>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>
      </header>

      <main>
        <form id="groupCreationForm" onSubmit={handleSubmit}>
            <h1>Novo Grupo VIP</h1>
            
            {!hasProvider && (
                <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: '#fef08a' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{marginRight:'8px'}}></i>
                    Conecte um provedor para ativar as vendas.
                </div>
            )}

            <div className="cover-upload-container">
                <label htmlFor="coverImageInput" className="cover-preview">
                    {coverImage ? <img src={coverImage} alt="Cover" /> : <i className="fa-solid fa-crown cover-icon"></i>}
                </label>
                <label htmlFor="coverImageInput" className="cover-label">Capa Principal</label>
                <input type="file" id="coverImageInput" accept="image/*" style={{display: 'none'}} onChange={handleCoverChange} />
            </div>

            <div className="form-group">
                <label htmlFor="groupName">Nome do Grupo</label>
                <input type="text" id="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Comunidade Flux Pro" required />
            </div>
            
            <div className="form-group">
                <label htmlFor="groupDescription">Descrição</label>
                <textarea id="groupDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Sobre o que é este grupo?"></textarea>
            </div>

            <div className="vip-door-section">
                <div className="section-title"><i className="fa-solid fa-door-open"></i> Galeria da Porta VIP</div>
                <div className="media-upload-area">
                    {vipMediaItems.map((item, idx) => (
                        <div key={idx} className="media-preview-item">
                            {item.type === 'video' ? <video src={item.url} /> : <img src={item.url} alt={`Preview ${idx}`} />}
                            <button type="button" className="remove-media-btn" onClick={() => removeMediaItem(idx)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                    ))}
                    <label htmlFor="vipMediaInput" className="add-media-btn">
                        <i className="fa-solid fa-plus"></i>
                        <span>Adicionar</span>
                    </label>
                    <input type="file" id="vipMediaInput" accept="image/*,video/*" multiple style={{display:'none'}} onChange={handleVipMediaChange} />
                </div>

                <div className="form-group">
                    <label htmlFor="vipCopyright">Texto de Venda</label>
                    <textarea id="vipCopyright" value={vipDoorText} onChange={(e) => setVipDoorText(e.target.value)} placeholder="Copy persuasiva..."></textarea>
                </div>

                <div className="form-group">
                    <label htmlFor="vipButtonText">Texto do Botão (Opcional)</label>
                    <input 
                        type="text" 
                        id="vipButtonText" 
                        value={vipButtonText} 
                        onChange={(e) => setVipButtonText(e.target.value)} 
                        placeholder="Ex: Assinar (Padrão: COMPRAR AGORA)" 
                        maxLength={20}
                    />
                </div>
            </div>
            
            <div className="price-group">
                <label>Venda e Acesso</label>
                <div className="radio-group-container">
                    <div className={`custom-radio ${accessType === 'lifetime' ? 'selected' : ''}`} onClick={() => setAccessType('lifetime')}>Vitalício</div>
                    <div className={`custom-radio ${accessType === 'temporary' ? 'selected' : ''}`} onClick={() => setAccessType('temporary')}>Periódico</div>
                </div>

                <div className="price-input-container">
                    <span>{getCurrencySymbol()}</span>
                    <input type="text" value={price} onChange={handlePriceChange} placeholder="0,00" required />
                </div>
            </div>

            {/* Advanced Marketing (Pixel & Token) */}
            <div className="vip-door-section">
                <div className="section-title"><i className="fa-solid fa-rocket"></i> Marketing Avançado</div>
                
                <div className="form-group" style={{marginBottom: '15px'}}>
                    <label htmlFor="pixelId">Meta Pixel ID (Opcional)</label>
                    <input 
                        type="text" 
                        id="pixelId" 
                        value={pixelId} 
                        onChange={(e) => setPixelId(e.target.value)} 
                        placeholder="Ex: 123456789012345" 
                    />
                    <p style={{fontSize:'11px', color:'#aaa', marginTop:'4px'}}>Rastreie PageView e InitiateCheckout automaticamente.</p>
                </div>

                <div className="form-group" style={{marginBottom: '15px'}}>
                    <label htmlFor="pixelToken">Token de Acesso (API de Conversões)</label>
                    <input 
                        type="text" 
                        id="pixelToken" 
                        value={pixelToken} 
                        onChange={(e) => setPixelToken(e.target.value)} 
                        placeholder="Cole seu token de acesso aqui (EAA...)" 
                    />
                    <p style={{fontSize:'11px', color:'#aaa', marginTop:'4px'}}>Utilizado para eventos server-side (CAPI).</p>
                </div>
            </div>

            <button type="submit" className="common-button" disabled={isCreating}>
                {isCreating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : "Criar Grupo"}
            </button>
        </form>
      </main>
    </div>
  );
};
