
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { metaPixelService } from '../services/metaPixelService';
import { Group, VipMediaItem } from '../types';

export const EditGroup: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  // Form States
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | undefined>(undefined);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<'BRL' | 'USD' | 'EUR' | 'BTC'>('BRL');
  const [accessType, setAccessType] = useState<'lifetime' | 'temporary'>('lifetime');
  const [expirationDate, setExpirationDate] = useState('');
  const [originalGroup, setOriginalGroup] = useState<Group | null>(null);
  
  // Advanced Marketing
  const [pixelId, setPixelId] = useState('');
  const [pixelToken, setPixelToken] = useState('');
  const [marketingStatus, setMarketingStatus] = useState<'active' | 'inactive'>('inactive');
  const [isTestingPixel, setIsTestingPixel] = useState(false);

  // Modal States
  const [isVipDoorModalOpen, setIsVipDoorModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  
  // Vip Door Settings (Now Array)
  const [vipDoorMediaItems, setVipDoorMediaItems] = useState<VipMediaItem[]>([]);
  const [vipDoorText, setVipDoorText] = useState('');
  const [vipButtonText, setVipButtonText] = useState(''); // Custom button text

  useEffect(() => {
      if (!id) {
          navigate('/groups');
          return;
      }
      const group = groupService.getGroupById(id);
      if (!group) {
          alert("Grupo não encontrado.");
          navigate('/groups');
          return;
      }

      setOriginalGroup(group);
      setGroupName(group.name);
      setDescription(group.description);
      setCoverImage(group.coverImage);
      setPixelId(group.pixelId || '');
      setPixelToken(group.pixelToken || '');
      
      // Update status based on initial load
      if (group.pixelId) setMarketingStatus('active');
      
      // Format numeric price back to comma string if needed for initial display
      if (group.price) {
          const numeric = parseFloat(group.price);
          if (!isNaN(numeric)) {
              setPrice(numeric.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
          } else {
              setPrice(group.price);
          }
      }
      
      setCurrency(group.currency || 'BRL');
      setAccessType(group.accessType || 'lifetime');
      setExpirationDate(group.expirationDate || '');
      
      if (group.vipDoor) {
          setVipDoorText(group.vipDoor.text || '');
          setVipButtonText(group.vipDoor.buttonText || '');
          if (group.vipDoor.mediaItems) {
              setVipDoorMediaItems(group.vipDoor.mediaItems);
          } else if (group.vipDoor.media) {
              // Legacy compatibility
              setVipDoorMediaItems([{ 
                  url: group.vipDoor.media, 
                  type: group.vipDoor.mediaType || 'image' 
              }]);
          }
      }
  }, [id, navigate]);

  // Update status when inputs change
  useEffect(() => {
      if (pixelId.length > 5) {
          setMarketingStatus('active');
      } else {
          setMarketingStatus('inactive');
      }
  }, [pixelId, pixelToken]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleVipDoorMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files) as File[];
    
    if (vipDoorMediaItems.length + fileArray.length > 10) {
        alert("Você pode selecionar no máximo 10 mídias (fotos ou vídeos).");
        return;
    }

    const promises = fileArray.map(file => {
        return new Promise<VipMediaItem>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                resolve({
                    url: ev.target?.result as string,
                    type: file.type.startsWith('video/') ? 'video' : 'image'
                });
            };
            reader.readAsDataURL(file);
        });
    });

    Promise.all(promises).then(newItems => {
        setVipDoorMediaItems(prev => [...prev, ...newItems]);
    });
  };

  const removeMediaItem = (index: number) => {
      setVipDoorMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAccessTypeChange = (type: 'lifetime' | 'temporary') => {
    setAccessType(type);
    if (type === 'temporary') {
      setIsDateModalOpen(true);
    } else {
      setExpirationDate('');
    }
  };

  const saveExpirationDate = () => {
    const dateInput = document.getElementById('expirationDate') as HTMLInputElement;
    if (dateInput && dateInput.value) {
      setExpirationDate(dateInput.value);
      setIsDateModalOpen(false);
      setAccessType('temporary');
    } else {
      alert('Por favor, selecione uma data.');
    }
  };

  // Currency Mask
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      value = value.replace(/\D/g, "");
      if (value === "") { setPrice(""); return; }
      const numericValue = parseFloat(value) / 100;
      setPrice(numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleTestPixel = () => {
      if (!pixelId) {
          alert("Insira um Pixel ID primeiro.");
          return;
      }
      setIsTestingPixel(true);
      
      // Parse price logic (Same as submit to verify correctness)
      const rawPrice = price.replace(/\./g, '').replace(',', '.');
      const numericPrice = parseFloat(rawPrice) || 0.00;

      // Simulate Pixel Fire with REAL form data
      try {
          metaPixelService.trackViewContent(pixelId, {
              content_ids: [originalGroup?.id || 'unknown_id'],
              content_type: 'product_group',
              content_name: groupName || 'Grupo Teste', // Sends real group name
              value: numericPrice, // Sends real price typed
              currency: currency // Sends real currency
          });
          
          setTimeout(() => {
              setIsTestingPixel(false);
              alert(`✅ Evento 'ViewContent' enviado!\n\nDados testados:\nValor: ${numericPrice}\nMoeda: ${currency}\nID: ${originalGroup?.id}\n\nSe aparecer no Gerenciador de Eventos, o Checkout também funcionará.`);
          }, 1000);
      } catch (e) {
          setIsTestingPixel(false);
          alert("Erro ao disparar pixel. Verifique se bloqueadores de anúncio estão desativados.");
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalGroup) return;

    const rawPrice = price.replace(/\./g, '').replace(',', '.');
    const numericPrice = parseFloat(rawPrice);

    // Enforce Minimum Price for VIP Groups
    if (originalGroup.isVip) {
        if (isNaN(numericPrice) || numericPrice < 6) {
            alert("⚠️ O preço mínimo para um grupo VIP é R$ 6,00.");
            return;
        }
    }

    if (accessType === 'temporary' && !expirationDate) {
        alert("🚨 Por favor, defina a data de expiração para o acesso temporário.");
        setIsDateModalOpen(true);
        return;
    }

    const updatedGroup: Group = {
      ...originalGroup,
      name: groupName,
      description: description,
      coverImage: coverImage,
      price: numericPrice.toString(), // Save as float string
      currency: currency,
      accessType: accessType,
      expirationDate: expirationDate,
      vipDoor: {
        mediaItems: vipDoorMediaItems,
        text: vipDoorText,
        buttonText: vipButtonText
      },
      pixelId: pixelId || undefined,
      pixelToken: pixelToken || undefined
    };

    groupService.updateGroup(updatedGroup);
    
    alert("Grupo atualizado com sucesso!");
    navigate('/groups');
  };

  const getCurrencySymbol = () => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'BTC': return '₿';
      default: return 'R$';
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

        main { flex-grow:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:100%; padding-top: 100px; padding-bottom: 20px; }

        #groupCreationForm {
            width:100%; max-width:500px; padding:0 20px;
            display: flex; flex-direction: column; gap: 20px;
        }
        .form-group { display: flex; flex-direction: column; }
        .form-group label { font-size: 14px; color: #00c2ff; margin-bottom: 8px; font-weight: 600; }
        .form-group input, .form-group textarea {
            background: #1e2531; border: 1px solid rgba(0,194,255,0.3); border-radius: 8px;
            color: #fff; padding: 12px; font-size: 16px; transition: border-color 0.3s;
        }
        .form-group input:focus, .form-group textarea:focus {
            border-color: #00c2ff; outline: none; box-shadow: 0 0 5px rgba(0,194,255,0.5);
        }
        .form-group textarea { resize: vertical; min-height: 100px; }

        #coverPreview {
            width: 100%; aspect-ratio: 1 / 1; background: #1e2531;
            border: 2px dashed rgba(0,194,255,0.5); border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            color: #00c2ff; font-size: 16px; cursor: pointer; transition: background 0.3s;
            position: relative; overflow: hidden;
        }
        #coverPreview:hover { background: #28303f; }
        #coverPreview img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }

        .common-button {
            background: #00c2ff; border: none; border-radius: 8px; color: #000;
            padding: 12px 20px; font-size: 18px; font-weight: 700; cursor: pointer;
            transition: background 0.3s, transform 0.1s; display: flex; align-items: center;
            justify-content: center; gap: 8px; box-shadow: 0 4px 8px rgba(0,194,255,0.3);
        }
        .common-button:hover { background: #0099cc; }
        .common-button:active { transform: scale(0.99); }

        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center;
            z-index: 100; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s;
        }
        .modal-overlay.open { opacity: 1; visibility: visible; }
        .modal-content {
            background: #0c0f14; padding: 20px; border-radius: 16px; width: 90%; max-width: 400px;
            transform: translateY(20px); transition: transform 0.3s ease-out;
            box-shadow: 0 8px 25px rgba(0,194,255,0.4);
        }
        .modal-overlay.open .modal-content { transform: translateY(0); }
        .modal-content h3 {
            margin-bottom: 20px; color: #00c2ff; font-size: 20px;
            border-bottom: 1px solid rgba(0,194,255,0.2); padding-bottom: 10px; text-align: center;
        }
        .modal-option { 
            background: #1e2531; color: #fff; padding: 15px; margin-bottom: 10px;
            border-radius: 10px; cursor: pointer; transition: background 0.2s;
            font-size: 16px; font-weight: 500; display: flex; flex-direction: column; 
            gap: 10px; align-items: flex-start; 
        }
        .modal-option label { font-size: 14px; color: #00c2ff; font-weight: 600; }
        .modal-option textarea {
            width: 100%; background: #0c0f14; border: 1px solid rgba(0,194,255,0.3);
            border-radius: 6px; color: #fff; padding: 8px; font-size: 14px; resize: vertical; min-height: 80px;
        }
        .modal-option input {
            width: 100%; background: #0c0f14; border: 1px solid rgba(0,194,255,0.3);
            border-radius: 6px; color: #fff; padding: 8px; font-size: 14px; outline: none;
        }
        
        .media-preview-gallery {
            display: flex; gap: 10px; overflow-x: auto; width: 100%; padding-bottom: 5px;
        }
        .media-preview-item {
            flex: 0 0 100px; height: 125px; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
        }
        .media-preview-item img, .media-preview-item video {
            width: 100%; height: 100%; object-fit: cover;
        }
        .remove-media-btn {
            position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #ff4d4d;
            border: none; border-radius: 50%; width: 20px; height: 20px; display: flex;
            align-items: center; justify-content: center; cursor: pointer; font-size: 12px;
        }
        
        #media-upload-trigger {
            width: 100%; padding: 20px; background: #0c0f14;
            border: 1px dashed rgba(0,194,255,0.5); border-radius: 8px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #00c2ff; font-size: 14px; cursor: pointer;
        }

        .modal-buttons { margin-top: 20px; text-align: right; }
        .modal-buttons .common-button { width: 100%; font-size: 16px; padding: 10px; }

        .price-group {
            display: flex; flex-direction: column; gap: 10px; padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
        }
        .price-group label { font-size: 16px; color: #00c2ff; font-weight: 600; }
        .price-input-container {
            display: flex; align-items: center; background: #1e2531;
            border: 1px solid rgba(0,194,255,0.3); border-radius: 8px; overflow: hidden; margin-bottom: 20px; 
        }
        .price-input-container span {
            padding: 12px; background: #28303f; color: #aaa; font-size: 16px; font-weight: 700;
            min-width: 50px; text-align: center;
        }
        .price-input-container input {
            flex-grow: 1; border: none; background: none; padding: 12px; text-align: right;
            color: #fff; font-weight: 700; 
        }
        .radio-group-container { display: flex; gap: 10px; margin-bottom: 15px; }
        .custom-radio {
            flex: 1; display: flex; align-items: center; justify-content: center;
            padding: 10px 15px; background: #1e2531; border: 1px solid rgba(0,194,255,0.3);
            border-radius: 8px; color: #fff; cursor: pointer; transition: background 0.3s;
            font-size: 14px; font-weight: 600;
        }
        .custom-radio.selected { background: #00c2ff; color: #000; }
        .custom-radio i { margin-right: 8px; }

        /* CURRENCY SELECTOR */
        .currency-selector {
            display: flex; gap: 8px; margin-bottom: 15px;
        }
        .currency-option {
            flex: 1;
            padding: 10px 5px;
            background: #1e2531;
            border: 1px solid rgba(0,194,255,0.3);
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            text-align: center;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }
        .currency-option.selected {
            background: #00c2ff;
            color: #000;
            border-color: #00c2ff;
        }
        .currency-option:hover {
            background: rgba(0,194,255,0.2);
        }

        .date-modal input[type="date"] {
            background: #1e2531; border: 1px solid rgba(0,194,255,0.3);
            border-radius: 8px; color: #fff; padding: 12px; font-size: 16px; width: 100%;
        }
        
        .code-textarea {
            width: 100%; min-height: 150px; background: #111; color: #00ff82;
            font-family: monospace; font-size: 13px; padding: 12px;
            border: 1px solid #333; border-radius: 8px; outline: none;
        }
        .code-textarea:focus { border-color: #00c2ff; }

        /* Marketing Status Badge */
        .marketing-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 10px;
        }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            font-size: 11px; font-weight: 700; padding: 4px 10px;
            border-radius: 12px; text-transform: uppercase;
        }
        .status-badge.active { background: rgba(0, 255, 130, 0.1); color: #00ff82; border: 1px solid #00ff82; }
        .status-badge.inactive { background: rgba(255, 255, 255, 0.1); color: #aaa; border: 1px solid #555; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .test-btn {
            background: transparent; border: 1px solid #00c2ff; color: #00c2ff;
            font-size: 12px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
            margin-top: 10px; display: inline-flex; align-items: center; gap: 5px;
        }
        .test-btn:hover { background: rgba(0,194,255,0.1); }
      `}</style>

      <header>
        <button onClick={() => navigate('/groups')}><i className="fa-solid fa-xmark"></i></button>
        
        {/* Standardized Logo */}
        <div 
            className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>
      </header>

      <main>
        <h1 style={{color: '#00c2ff', marginBottom: '20px'}}>Editar Grupo</h1>
        <form id="groupCreationForm" onSubmit={handleSubmit}>
            
            <div className="form-group">
                <label htmlFor="groupName">Nome do Grupo</label>
                <input 
                    type="text" 
                    id="groupName" 
                    value={groupName} 
                    onChange={(e) => setGroupName(e.target.value)} 
                    placeholder="Ex: Comunidade Flux Pro" 
                    required 
                />
            </div>

            <div className="form-group">
                <label>Capa do Grupo (1:1 Quadrada)</label>
                <div id="coverPreview" onClick={() => document.getElementById('coverImageInput')?.click()}>
                    {coverImage ? (
                        <img src={coverImage} alt="Cover" />
                    ) : (
                        <>
                            <i className="fa-solid fa-image" style={{fontSize: '30px', marginRight: '10px'}}></i>
                            <span>Selecionar Capa</span>
                        </>
                    )}
                </div>
                <input type="file" id="coverImageInput" accept="image/*" style={{display: 'none'}} onChange={handleCoverChange} />
            </div>
            
            <div className="form-group">
                <label htmlFor="groupDescription">Descrição do Grupo</label>
                <textarea 
                    id="groupDescription" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Breve descrição do que os membros encontrarão."
                ></textarea>
            </div>
            
            <button type="button" className="common-button" onClick={() => setIsVipDoorModalOpen(true)}>
                <i className="fa-solid fa-gear"></i> Editar Porta do VIP
            </button>
            
            <div className="price-group">
                <label>Tipo de Acesso</label>
                <div className="radio-group-container">
                    <div 
                        className={`custom-radio ${accessType === 'lifetime' ? 'selected' : ''}`}
                        onClick={() => handleAccessTypeChange('lifetime')}
                    >
                        <i className="fa-solid fa-infinity"></i> Vitalício
                    </div>
                    
                    <div 
                        className={`custom-radio ${accessType === 'temporary' ? 'selected' : ''}`}
                        onClick={() => handleAccessTypeChange('temporary')}
                    >
                        <i className="fa-solid fa-clock"></i> Temporário
                    </div>
                </div>

                <label>Moeda</label>
                <div className="currency-selector">
                    <div className={`currency-option ${currency === 'BRL' ? 'selected' : ''}`} onClick={() => setCurrency('BRL')}>
                        R$
                    </div>
                    <div className={`currency-option ${currency === 'USD' ? 'selected' : ''}`} onClick={() => setCurrency('USD')}>
                        <i className="fa-solid fa-dollar-sign"></i>
                    </div>
                    <div className={`currency-option ${currency === 'EUR' ? 'selected' : ''}`} onClick={() => setCurrency('EUR')}>
                        <i className="fa-solid fa-euro-sign"></i>
                    </div>
                    <div className={`currency-option ${currency === 'BTC' ? 'selected' : ''}`} onClick={() => setCurrency('BTC')}>
                        <i className="fa-brands fa-bitcoin"></i>
                    </div>
                </div>

                <label>Preço de Acesso Mensal</label>
                <div className="price-input-container">
                    <span>{getCurrencySymbol()}</span>
                    <input 
                        type="text" 
                        value={price} 
                        onChange={handlePriceChange} 
                        placeholder="0,00" 
                        required 
                    />
                </div>
            </div>

            {/* Advanced Marketing (Edit) */}
            <div className="price-group">
                <div className="marketing-header">
                    <h3 style={{fontSize: '14px', color: '#FFD700', fontWeight: '700', textTransform: 'uppercase', marginBottom: 0}}>
                        <i className="fa-solid fa-rocket"></i> Marketing Avançado
                    </h3>
                    <div className={`status-badge ${marketingStatus}`}>
                        <div className="status-dot"></div>
                        {marketingStatus === 'active' ? 'Conectado' : 'Não Configurado'}
                    </div>
                </div>
                
                <div className="form-group" style={{marginBottom: '15px'}}>
                    <label htmlFor="pixelId">Meta Pixel ID (Opcional)</label>
                    <input 
                        type="text" 
                        id="pixelId" 
                        value={pixelId} 
                        onChange={(e) => setPixelId(e.target.value)} 
                        placeholder="Ex: 123456789012345" 
                    />
                </div>

                <div className="form-group" style={{marginBottom: '5px'}}>
                    <label htmlFor="pixelToken">Token de Acesso (API)</label>
                    <input 
                        type="text" 
                        id="pixelToken" 
                        value={pixelToken} 
                        onChange={(e) => setPixelToken(e.target.value)} 
                        placeholder="Cole seu token CAPI..." 
                    />
                </div>

                {marketingStatus === 'active' && (
                    <button type="button" className="test-btn" onClick={handleTestPixel} disabled={isTestingPixel}>
                        {isTestingPixel ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-vial"></i>}
                        Testar Disparo (ViewContent/Value)
                    </button>
                )}
            </div>

            <button type="submit" className="common-button" style={{marginTop: '20px'}}>
                <i className="fa-solid fa-save"></i> Salvar Alterações
            </button>
        </form>
      </main>

      {/* VIP DOOR MODAL */}
      <div 
        className={`modal-overlay ${isVipDoorModalOpen ? 'open' : ''}`} 
        onClick={() => setIsVipDoorModalOpen(false)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Configurações da Porta do VIP</h3>
            
            <div className="modal-option">
                <label>Galeria da Porta (Máx 10 fotos/vídeos)</label>
                
                {vipDoorMediaItems.length > 0 && (
                    <div className="media-preview-gallery">
                        {vipDoorMediaItems.map((item, idx) => (
                            <div key={idx} className="media-preview-item">
                                {item.type === 'video' ? (
                                    <video src={item.url} />
                                ) : (
                                    <img src={item.url} alt={`Media ${idx}`} />
                                )}
                                <button className="remove-media-btn" onClick={() => removeMediaItem(idx)}>
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div id="media-upload-trigger" onClick={() => document.getElementById('vipDoorMediaInput')?.click()}>
                    <i className="fa-solid fa-photo-film" style={{fontSize: '24px', marginBottom: '5px'}}></i>
                    <span>{vipDoorMediaItems.length}/10 - Adicionar Mídia</span>
                </div>
                <input type="file" id="vipDoorMediaInput" accept="image/*,video/*" multiple style={{display: 'none'}} onChange={handleVipDoorMediaChange} />
            </div>

            <div className="modal-option">
                <label>Texto de Boas-Vindas</label>
                <textarea 
                    value={vipDoorText}
                    onChange={(e) => setVipDoorText(e.target.value)}
                    placeholder="Mensagem que aparecerá na porta do seu Grupo VIP."
                ></textarea>
            </div>

            <div className="modal-option">
                <label>Texto do Botão (Opcional)</label>
                <input 
                    type="text" 
                    value={vipButtonText} 
                    onChange={(e) => setVipButtonText(e.target.value)} 
                    placeholder="Ex: Assinar (Padrão: COMPRAR AGORA)" 
                    maxLength={20}
                />
            </div>

            <div className="modal-buttons">
                <button className="common-button" onClick={() => setIsVipDoorModalOpen(false)}>
                    <i className="fa-solid fa-check"></i> Concluído
                </button>
            </div>
        </div>
      </div>

      {/* EXPIRATION DATE MODAL */}
      <div 
        className={`modal-overlay ${isDateModalOpen ? 'open' : ''}`} 
        onClick={() => setIsDateModalOpen(false)}
      >
        <div className="modal-content date-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Data de Expiração</h3>
            
            <div className="form-group">
                <label htmlFor="expirationDate">O acesso expira em:</label>
                <input 
                    type="date" 
                    id="expirationDate" 
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required 
                />
            </div>
            
            <div className="modal-buttons">
                <button className="common-button" onClick={saveExpirationDate}>
                    <i className="fa-solid fa-calendar-check"></i> Definir Data
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};