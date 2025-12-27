import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { marketplaceService } from '../services/marketplaceService';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { MarketplaceItem } from '../types';

const SELECTABLE_CATEGORIES = [
    { id: 'Eletrônicos', icon: 'fa-mobile-screen', label: 'Eletrônicos' },
    { id: 'Moda', icon: 'fa-shirt', label: 'Moda' },
    { id: 'Casa', icon: 'fa-couch', label: 'Casa' },
    { id: 'Automotivo', icon: 'fa-car', label: 'Automotivo' },
    { id: 'Imóveis', icon: 'fa-building', label: 'Imóveis' },
    { id: 'Serviços', icon: 'fa-screwdriver-wrench', label: 'Serviços' },
    { id: 'Infoprodutos', icon: 'fa-graduation-cap', label: 'Infoprodutos' },
    { id: 'Vagas de Emprego', icon: 'fa-briefcase', label: 'Empregos' },
];

export const CreateMarketplaceItem: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { type?: 'paid' | 'organic' } | null;
  const isPaid = state?.type === 'paid';
  
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Eletrônicos');
  const [locationVal, setLocationVal] = useState('');
  const [description, setDescription] = useState('');
  
  // Media State
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [additionalMedia, setAdditionalMedia] = useState<{file: File, url: string, type: 'image' | 'video'}[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedCoverFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setCoverImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      // Fixed: Added explicit type cast to File[] to prevent 'unknown' errors in the map callback
      const fileArray = (Array.from(files) as File[]).slice(0, 5); 
      
      const newEntries = fileArray.map(file => ({
          file: file,
          url: URL.createObjectURL(file),
          type: file.type.startsWith('video/') ? 'video' as const : 'image' as const
      }));
      setAdditionalMedia(prev => [...prev, ...newEntries]);
  };

  const removeGalleryItem = (index: number) => {
      setAdditionalMedia(prev => prev.filter((_, i) => i !== index));
  };

  // Currency Mask
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      value = value.replace(/\D/g, "");
      if (value === "") { setPrice(""); return; }
      const numericValue = parseFloat(value) / 100;
      setPrice(numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !coverImage || isSubmitting) return;

    setIsSubmitting(true);
    try {
        const currentUser = authService.getCurrentUser();
        if (!currentUser) return;

        // PADRONIZAÇÃO R2: Upload antes de criar o item
        let finalCoverUrl = coverImage || '';
        if (selectedCoverFile) {
            finalCoverUrl = await postService.uploadMedia(selectedCoverFile, 'marketplace');
        }

        const uploadedImages: string[] = [];
        let finalVideoUrl: string | undefined = undefined;

        for (const item of additionalMedia) {
            const url = await postService.uploadMedia(item.file, 'marketplace');
            if (item.type === 'video' && !finalVideoUrl) {
                finalVideoUrl = url;
            } else {
                uploadedImages.push(url);
            }
        }

        const rawPrice = price.replace(/\./g, '').replace(',', '.');
        const numericPrice = parseFloat(rawPrice);

        const newItem: MarketplaceItem = {
            id: Date.now().toString(),
            title,
            price: numericPrice,
            category,
            location: locationVal,
            description,
            image: finalCoverUrl, 
            images: uploadedImages, 
            video: finalVideoUrl, 
            sellerId: currentUser.email,
            sellerName: currentUser.profile?.name || 'Usuário',
            sellerAvatar: currentUser.profile?.photoUrl,
            timestamp: Date.now(),
            soldCount: 0 
        };

        await marketplaceService.createItem(newItem);
        navigate('/marketplace');
    } catch (e) {
        alert("Erro ao publicar anúncio.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        header { display:flex; align-items:center; justify-content:space-between; padding:16px; background: #0c0f14; position:fixed; width:100%; top:0; z-index:10; border-bottom:1px solid rgba(255,255,255,0.1); height: 65px; }
        header .back-btn { background:none; border:none; color:#fff; font-size:20px; cursor:pointer; padding-right: 15px; }
        main { padding-top: 85px; padding-bottom: 40px; width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px; flex-grow: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .section-label { font-size: 14px; font-weight: 600; color: #00c2ff; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; margin-bottom: 24px; }
        .main-cover-upload { width: 100%; aspect-ratio: 16/9; background: #1a1e26; border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; transition: 0.3s; }
        .main-cover-upload img { width: 100%; height: 100%; object-fit: cover; }
        .gallery-scroll { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px; }
        .gallery-item { width: 70px; height: 70px; border-radius: 8px; flex-shrink: 0; background: #111; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .gallery-item img, .gallery-item video { width: 100%; height: 100%; object-fit: cover; }
        .remove-media { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #ff4d4d; border: none; width: 18px; height: 18px; border-radius: 50%; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .input-group { margin-bottom: 20px; }
        .input-wrapper input, .input-wrapper textarea, .input-wrapper select { width: 100%; background: #14171d; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px; color: #fff; font-size: 15px; outline: none; transition: 0.3s; }
        .cat-chip { padding: 8px 16px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #aaa; font-size: 13px; white-space: nowrap; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
        .cat-chip.active { background: rgba(0,194,255,0.15); border-color: #00c2ff; color: #00c2ff; font-weight: 600; }
        .submit-btn { width: 100%; padding: 16px; background: #00c2ff; color: #000; border: none; border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,194,255,0.3); transition: 0.3s; }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <header>
        <button onClick={() => navigate('/marketplace')} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
        <h1>Anunciar Produto</h1>
        <div style={{width:'20px'}}></div>
      </header>

      <main>
        <form onSubmit={handleSubmit}>
            <div className="form-section">
                <div className="section-label">Fotos & Vídeo</div>
                <div className="main-cover-upload" onClick={() => coverInputRef.current?.click()}>
                    {coverImage ? <img src={coverImage} alt="Capa" /> : <div className="text-center text-gray-500"><i className="fa-solid fa-camera block text-2xl mb-2"></i>Capa Principal</div>}
                    <input type="file" ref={coverInputRef} hidden accept="image/*" onChange={handleCoverChange} />
                </div>
                <div className="gallery-scroll mt-4">
                    {additionalMedia.map((item, idx) => (
                        <div key={idx} className="gallery-item">
                            {item.type === 'video' ? <video src={item.url} /> : <img src={item.url} />}
                            <button type="button" className="remove-media" onClick={() => removeGalleryItem(idx)}><i className="fa-solid fa-xmark"></i></button>
                        </div>
                    ))}
                    {additionalMedia.length < 5 && <div className="gallery-item flex items-center justify-center cursor-pointer border-dashed" onClick={() => galleryInputRef.current?.click()}><i className="fa-solid fa-plus text-gray-500"></i></div>}
                    <input type="file" ref={galleryInputRef} hidden accept="image/*,video/*" multiple onChange={handleGalleryChange} />
                </div>
            </div>

            <div className="form-section">
                <div className="section-label">Informações</div>
                <div className="input-group"><div className="input-wrapper"><input type="text" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} /></div></div>
                <div className="input-group"><div className="input-wrapper"><input type="text" placeholder="Preço" value={price} onChange={handlePriceChange} /></div></div>
                <div className="input-group"><div className="input-wrapper"><input type="text" placeholder="Cidade" value={locationVal} onChange={(e) => setLocationVal(e.target.value)} /></div></div>
                <div className="input-group"><div className="input-wrapper"><textarea rows={3} placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)}></textarea></div></div>
            </div>

            <button type="submit" className="submit-btn" disabled={!title || !price || !coverImage || isSubmitting}>
                {isSubmitting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Publicar Agora'}
            </button>
        </form>
      </main>
    </div>
  );
};
