
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { authService } from '../services/authService';
import { syncPayService } from '../services/syncPayService';
import { metaPixelService, getCookie } from '../services/metaPixelService';
import { db } from '@/database';
import { Group, VipMediaItem, User } from '../types';
import { API_BASE } from '../apiConfig';
import { QRCodeSVG } from 'qrcode.react';

export const VipGroupSales: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [isPurchaseEnabled, setIsPurchaseEnabled] = useState(false);
  
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [flowState, setFlowState] = useState<'loading' | 'pix' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [pixCode, setPixCode] = useState('');
  const [pixImage, setPixImage] = useState<string | undefined>(undefined);
  const [transactionId, setTransactionId] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const pixTextAreaRef = useRef<HTMLTextAreaElement>(null);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const [zoomedMedia, setZoomedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  
  const pollingInterval = useRef<any>(null);
  const [isRenewal, setIsRenewal] = useState(false);

  // --- EMAIL CAPTURE & PIXEL GATING STATES ---
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [hasCapturedEmail, setHasCapturedEmail] = useState(false);

  // --- PIXEL CONTROL FLAGS ---
  const hasViewContentFired = useRef(false);
  const pageViewFiredRef = useRef(false);

  const getEmailOrNull = () => {
      return authService.getCurrentUserEmail() || localStorage.getItem('guest_email_capture') || undefined;
  };

  // --- DEDUPLICATION SYSTEM ---
  const checkAndMarkEvent = (eventName: string, contextId: string): boolean => {
      let stableId = localStorage.getItem('_flux_dedup_id');
      if (!stableId) {
          stableId = Math.random().toString(36).substring(2) + Date.now().toString();
          localStorage.setItem('_flux_dedup_id', stableId);
      }
      
      const storageKey = `flux_evt_${eventName}_${contextId}_${stableId}`;
      
      if (localStorage.getItem(storageKey)) {
          return false;
      }
      
      localStorage.setItem(storageKey, Date.now().toString());
      return true;
  };

  useEffect(() => {
      const checkPendingClaim = async () => {
          const params = new URLSearchParams(location.search);
          const pendingTxId = params.get('txId');
          const shouldClaim = params.get('claim') === 'true';
          const userEmail = authService.getCurrentUserEmail();

          if (userEmail && id && pendingTxId && shouldClaim) {
              setFlowState('success');
              setIsPixModalOpen(true);
              setTimeout(() => {
                  navigate(`/group-chat/${id}`, { replace: true });
              }, 1000);
          }
      };
      checkPendingClaim();
  }, [location.search, id, navigate]);

  useEffect(() => {
      let emailTimer: any;

      const loadData = async () => {
          if (id) {
              const foundGroup = await groupService.fetchGroupById(id);
              
              try {
                  const freshResponse = await fetch(`${API_BASE}/api/groups/${id}`);
                  if (freshResponse.ok) {
                      const data = await freshResponse.json();
                      if (data.group) {
                          setGroup(data.group);
                          if (typeof data.group.isPaymentActive === 'boolean') {
                              setIsPurchaseEnabled(data.group.isPaymentActive);
                          }
                          groupService.updateGroup(data.group);
                      }
                  } else if (foundGroup) {
                      setGroup(foundGroup);
                  }
              } catch (e) {
                  if (foundGroup) {
                      setGroup(foundGroup);
                  }
              }

              const currentUserEmail = authService.getCurrentUserEmail();
              const guestEmail = localStorage.getItem('guest_email_capture');
              
              const emailAvailable = !!currentUserEmail || !!guestEmail;
              setHasCapturedEmail(emailAvailable);

              if (!emailAvailable) {
                  emailTimer = setTimeout(() => {
                      if (!localStorage.getItem('guest_email_capture') && !authService.getCurrentUserEmail()) {
                          setIsEmailModalOpen(true);
                      }
                  }, 2000);
              }
              
              const currentGroupObj = group || foundGroup;
              
              if (currentGroupObj) {
                  if (currentUserEmail && currentGroupObj.creatorEmail !== currentUserEmail) {
                      const vipStatus = groupService.checkVipStatus(currentGroupObj.id, currentUserEmail);
                      if (vipStatus === 'active') {
                          navigate(`/group-chat/${id}`, { replace: true });
                          return;
                      }
                      if (vipStatus === 'expired' || vipStatus === 'grace_period') {
                          setIsRenewal(true);
                      }
                  }

                  if (currentUserEmail && currentGroupObj.creatorEmail === currentUserEmail) {
                      setIsCreator(true);
                  }
                  
                  if (typeof (currentGroupObj as any).isPaymentActive === 'undefined') {
                       if (currentGroupObj.creatorEmail) {
                          const allUsers = authService.getAllUsers();
                          const creator = allUsers.find(u => u.email === currentGroupObj.creatorEmail);
                          const hasProvider = creator?.paymentConfig?.isConnected;
                          setIsPurchaseEnabled(!!hasProvider);
                      }
                  }
              }
          }
          setLoading(false);
      };
      
      loadData();
      
      return () => {
          stopPolling();
          if (emailTimer) clearTimeout(emailTimer);
      };
  }, [id]);

  // --- TRIGGER PAGE VIEW (Ação 1: Acesso à Página - Disparo Único) ---
  useEffect(() => {
      // Usamos uma Ref para garantir que o React Strict Mode não dispare duas vezes na montagem.
      if (group?.pixelId && group?.id && !pageViewFiredRef.current) {
          if (checkAndMarkEvent('PageView', group.id)) {
              console.log(`[Analytics] 1. Acesso à Página registrado para ${group.id}`);
              
              // REQUISITO: PageView não deve enviar e-mail. É o evento inicial.
              metaPixelService.trackPageView(group.pixelId);
              pageViewFiredRef.current = true;
              
              setTimeout(() => triggerViewContent(), 100);
          }
      }
  }, [group]);

  // --- TRIGGER VIEW CONTENT (Ação 2: Visualização de Conteúdo) ---
  const triggerViewContent = () => {
      if (hasViewContentFired.current) return;

      if (group && group.pixelId && group.id) {
          const currentUserEmail = authService.getCurrentUserEmail();
          const isOwnerUser = currentUserEmail && group.creatorEmail === currentUserEmail;
          
          if (!isOwnerUser) {
              if (checkAndMarkEvent('ViewContent', group.id)) {
                  console.log(`[Analytics] 2. Visualização de Conteúdo registrada para ${group.id}`);
                  
                  hasViewContentFired.current = true;

                  // REQUISITO: Incluir e-mail se disponível (Lead já capturado)
                  const userEmail = getEmailOrNull();

                  metaPixelService.trackViewContent(group.pixelId, {
                      content_ids: [group.id],
                      content_type: 'product_group',
                      content_name: group.name,
                      value: parseFloat(group.price || '0'),
                      currency: group.currency || 'BRL'
                  }, userEmail ? { email: userEmail } : undefined);
              } else {
                  hasViewContentFired.current = true;
              }
          }
      }
  };

  const stopPolling = () => {
      if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
      }
  };
  
  const displayMedia: VipMediaItem[] = [];
  if (group) {
      if (group.coverImage) displayMedia.push({ url: group.coverImage, type: 'image' });
      if (group.vipDoor?.mediaItems && group.vipDoor.mediaItems.length > 0) displayMedia.push(...group.vipDoor.mediaItems);
      else if (group.vipDoor?.media) displayMedia.push({ url: group.vipDoor.media, type: group.vipDoor.mediaType || 'image' });
      if (displayMedia.length === 0) displayMedia.push({ url: 'https://placehold.co/400x500/1e293b/00c2ff?text=VIP', type: 'image' });
  }

  const handleScroll = () => {
      if (snapContainerRef.current) {
          const scrollLeft = snapContainerRef.current.scrollLeft;
          const width = snapContainerRef.current.offsetWidth;
          const index = Math.round(scrollLeft / width);
          if (index !== currentSlide) {
              setCurrentSlide(index);
              
              if (!hasCapturedEmail) {
                  setIsEmailModalOpen(true);
              } else {
                  triggerViewContent();
              }
          }
      }
  };

  const handleMediaClick = (item: VipMediaItem) => {
      if (!hasCapturedEmail) {
          setIsEmailModalOpen(true);
          return;
      }
      
      setZoomedMedia(item);
      triggerViewContent();
  };

  const handlePurchaseClick = () => {
      if (!hasCapturedEmail) {
          setIsEmailModalOpen(true);
          return;
      }

      if (isCreator) return;
      setIsPixModalOpen(true);
      generatePix();
  };

  const handleGuestEmailSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const email = emailInput.trim().toLowerCase();
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
          setEmailError("Por favor, insira um e-mail válido.");
          return;
      }

      localStorage.setItem('guest_email_capture', email);
      setHasCapturedEmail(true);
      
      // --- TRIGGER LEAD (Ação 3) ---
      if (group?.pixelId && group?.id) {
          if (checkAndMarkEvent('Lead', group.id)) {
              console.log(`[Analytics] 3. Lead registrado para ${email}`);
              metaPixelService.trackLead(group.pixelId, {
                  email: email
              }, group.id);
          }
      }
      
      setIsEmailModalOpen(false);
      setEmailError('');
  };

  const handleCopyCheckoutLink = () => {
      navigator.clipboard.writeText(window.location.href).then(() => alert("Link copiado!"));
  };

  const generatePix = async () => {
      let user = authService.getCurrentUser();
      
      if (!user) {
          const guestEmail = localStorage.getItem('guest_email_capture');
          
          if (!guestEmail) {
              setIsEmailModalOpen(true);
              return;
          }
          
          user = {
              email: guestEmail,
              isVerified: false,
              isProfileCompleted: false,
              profile: { name: guestEmail.split('@')[0], nickname: 'Visitante', isPrivate: false }
          } as User;
      }

      if (!group) return;

      setFlowState('loading');
      setErrorMessage('');
      setPixCode('');
      setPixImage(undefined);

      try {
          // --- TRIGGER INITIATE CHECKOUT (Ação 4) ---
          // REQUISITO: Incluir e-mail do usuário no evento InitiateCheckout.
          if (group.pixelId) {
              if (checkAndMarkEvent('InitiateCheckout', group.id)) {
                  console.log(`[Analytics] 4. Início de Checkout registrado para ${user.email}`);
                  metaPixelService.trackInitiateCheckout(group.pixelId, {
                      content_ids: [group.id],
                      content_type: 'product_group',
                      content_name: group.name,
                      value: parseFloat(group.price || '0'),
                      currency: group.currency || 'BRL',
                      num_items: 1,
                      contents: [{ id: group.id, quantity: 1 }]
                  }, { email: user.email }); // Explicitly pass email
              }
          }

          const { pixCode, identifier, qrCodeImage } = await syncPayService.createPayment(user, group);
          
          if (!pixCode) throw new Error("Código PIX vazio.");

          setPixCode(pixCode);
          setTransactionId(identifier);
          setPixImage(qrCodeImage);
          setFlowState('pix');

          startPaymentCheck(identifier, user.email);

      } catch (error: any) {
          setFlowState('error');
          setErrorMessage(error.message || "Erro ao gerar Pix.");
      }
  };

  const startPaymentCheck = (identifier: string, buyerEmail: string) => {
      stopPolling();
      if (!group || !group.creatorEmail) return;
      const sellerEmail = group.creatorEmail;
      const groupId = group.id;
      
      const tracking = {
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
          testEventCode: localStorage.getItem('_fb_test_code') || undefined
      };
      
      pollingInterval.current = setInterval(async () => {
          try {
              // Purchase Event is handled by the backend when status becomes 'paid'.
              // Backend already receives buyerEmail, so it can attach it to the CAPI event.
              const response = await syncPayService.checkTransactionStatus(
                  identifier, 
                  sellerEmail, 
                  groupId, 
                  buyerEmail,
                  tracking
              );
              
              const status = response.status;

              if (status === 'completed' || status === 'paid') {
                  stopPolling();
                  console.log(`[Analytics] 5. Compra Concluída (Confirmada pelo Backend)`);
                  setFlowState('success');
              }
          } catch (e) {
              console.error("Status check error", e);
          }
      }, 3000);
  };

  const handleRedeemClick = () => {
      if (!group) return;
      const userEmail = authService.getCurrentUserEmail() || localStorage.getItem('guest_email_capture');
      
      if (!userEmail) {
          const returnUrl = `/vip-group-sales/${group.id}?txId=${transactionId}&claim=true`;
          sessionStorage.setItem('redirect_after_login', returnUrl);
          navigate('/register'); 
          return;
      }
      
      sessionStorage.removeItem('redirect_after_login');
      setTimeout(() => { navigate(`/group-chat/${group.id}`, { replace: true }); }, 100);
  };

  const copyPixCode = async () => {
    if (!pixCode) return;
    try {
        await navigator.clipboard.writeText(pixCode);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        if (pixTextAreaRef.current) {
            pixTextAreaRef.current.select();
            document.execCommand('copy');
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    }
  };

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'USD': return '$'; case 'EUR': return '€'; case 'BTC': return '₿'; default: return 'R$';
    }
  };

  const formatPrice = (priceStr?: string) => {
      if (!priceStr) return '0,00';
      const num = parseFloat(priceStr);
      return isNaN(num) ? '0,00' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0c0f14] text-white">Carregando...</div>;
  
  if (!group) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0c0f14] text-white p-5 text-center">
          <h2 className="text-xl font-bold text-gray-500 mb-4">Grupo não encontrado</h2>
          <button onClick={() => navigate('/feed')} className="text-[#00c2ff]">Voltar ao Feed</button>
      </div>
  );

  const customCta = group.vipDoor?.buttonText || 'COMPRAR AGORA';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
        {/* CSS styles */}
        <style>{`
            .carousel-wrapper { position: relative; width: 100%; }
            .snap-container { scroll-snap-type: x mandatory; display: flex; gap: 10px; overflow-x: auto; width: 100%; padding-bottom: 20px; scrollbar-width: none; }
            .snap-container::-webkit-scrollbar { display: none; }
            .snap-item { scroll-snap-align: center; flex-shrink: 0; width: 85vw; max-width: 400px; aspect-ratio: 4/5; position: relative; border-radius: 16px; overflow: hidden; border: 1px solid rgba(0, 194, 255, 0.3); background: #000; cursor: pointer; }
            .snap-container > .snap-item:first-child { margin-left: 7.5vw; }
            .snap-container > .snap-item:last-child { margin-right: 7.5vw; }
            .snap-item img, .snap-item video { width: 100%; height: 100%; object-fit: cover; }
            .zoom-hint { position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 50%; color: #fff; font-size: 14px; pointer-events: none; }
            .carousel-dots { display: flex; justify-content: center; gap: 6px; margin-top: -15px; margin-bottom: 15px; }
            .dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.3); transition: all 0.3s; }
            .dot.active { background: #00c2ff; width: 18px; border-radius: 4px; }
            .cta-button { background: linear-gradient(90deg, #00c2ff, #00aaff); color: #0c0f14; font-weight: 700; padding: 1rem 0; border-radius: 12px; font-size: 1.5rem; box-shadow: 0 5px 20px rgba(0, 194, 255, 0.5); width: 90%; margin-top: 10px; border: none; cursor: pointer; }
            .cta-button.disabled { background: #333; color: #777; cursor: not-allowed; box-shadow: none; }
            .cta-button.renewal { background: linear-gradient(90deg, #FFD700, #FFA500); color: #000; }
            .content-section { padding: 16px; max-width: 450px; margin: 0 auto; }
            .copy-box { background: rgba(0, 194, 255, 0.05); border: 1px solid #00c2ff; border-radius: 12px; padding: 20px; margin-top: 20px; max-height: 400px; overflow-y: auto; overflow-x: hidden; word-wrap: break-word; }
            .copy-box::-webkit-scrollbar { width: 6px; }
            .copy-box::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 3px; }
            .copy-box::-webkit-scrollbar-thumb { background: rgba(0, 194, 255, 0.3); border-radius: 3px; }
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.95); display: flex; justify-content: center; align-items: center; z-index: 50; opacity: 0; visibility: hidden; transition: 0.3s; }
            .modal-overlay.open { opacity: 1; visibility: visible; }
            .modal-content { background-color: #0c0f14; padding: 25px; border-radius: 16px; width: 90%; max-width: 380px; box-shadow: 0 0 40px rgba(0, 194, 255, 0.2); border: 1px solid #00c2ff; text-align: center; max-height: 90vh; overflow-y: auto; }
            .pix-textarea { background-color: #1a1f26; color: #fff; padding: 12px; border-radius: 8px; margin: 15px 0; font-family: monospace; font-size: 11px; border: 1px dashed #00c2ff; width: 100%; min-height: 120px; resize: none; }
            .qrcode-wrapper { background: #fff; padding: 10px; border-radius: 12px; margin: 15px auto; display: inline-block; }
            .qrcode-img { width: 200px; height: 200px; object-fit: contain; }
            .gift-container { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; background: linear-gradient(180deg, rgba(255, 215, 0, 0.05) 0%, transparent 100%); border-radius: 20px; border: 1px solid rgba(255, 215, 0, 0.1); }
            .gift-icon-static { font-size: 60px; color: #d4af37; margin-bottom: 25px; }
            .success-title { font-size: 20px; color: #fff; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 3px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; width: 100%; }
            .redeem-btn-sophisticated { background: transparent; border: 1px solid #d4af37; color: #d4af37; font-weight: 600; padding: 14px 30px; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; width: 100%; border-radius: 4px; }
            .redeem-btn-sophisticated:hover { background: #d4af37; color: #000; }
            .error-box { background: rgba(255, 77, 77, 0.1); border: 1px solid #ff4d4d; color: #ff4d4d; padding: 15px; border-radius: 8px; font-size: 14px; margin-bottom: 15px; }
            .error-retry-btn { background: #ff4d4d; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 700; margin-top: 10px; }
            .copy-link-btn { background: rgba(0, 194, 255, 0.1); color: #00c2ff; border: 1px solid #00c2ff; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 15px; display: inline-flex; align-items: center; gap: 8px; transition: 0.3s; }
            .copy-link-btn:hover { background: rgba(0, 194, 255, 0.2); }
            
            /* EMAIL MODAL */
            .email-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(10px); }
            .email-modal-content { width: 100%; max-width: 320px; background: #1a1e26; padding: 30px 20px; border-radius: 20px; border: 1px solid #00c2ff; box-shadow: 0 0 50px rgba(0, 194, 255, 0.2); text-align: center; }
            .email-input { width: 100%; padding: 14px; margin-top: 20px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border: 1px solid #333; color: #fff; border-radius: 10px; font-size: 16px; text-align: center; outline: none; transition: 0.3s; }
            .email-input:focus { border-color: #00c2ff; background: rgba(0,194,255,0.05); }
            .confirm-email-btn { width: 100%; padding: 14px; background: #00c2ff; color: #000; font-weight: 800; font-size: 16px; border-radius: 10px; border: none; cursor: pointer; margin-top: 15px; box-shadow: 0 0 20px rgba(0, 194, 255, 0.4); transition: 0.2s; }
            .confirm-email-btn:hover { transform: scale(1.02); }
        `}</style>

        <header className="flex items-center justify-between p-[16px_32px] bg-[#0c0f14] fixed w-full z-10 border-b border-white/10" style={{top: isCreator ? '30px' : '0', height: '70px'}}>
            <button onClick={() => navigate('/groups')} className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]" onClick={() => navigate('/feed')}>
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
            </div>
            <div style={{width: '24px'}}></div> 
        </header>

        <main style={{paddingTop: isCreator ? '120px' : '90px', paddingBottom: '100px', maxWidth: '600px', margin: '0 auto', width: '100%'}}>
            <div className="text-center mb-6 px-4">
                <h1 className="text-2xl font-bold text-[#00c2ff] mb-1">{group.name}</h1>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 uppercase tracking-widest">
                    <i className="fa-solid fa-lock"></i> Área VIP Exclusiva
                </div>
            </div>

            <div className="carousel-wrapper">
                <div className="snap-container" ref={snapContainerRef} onScroll={handleScroll}>
                    {displayMedia.map((item, index) => (
                        <div 
                            key={index} 
                            className="snap-item" 
                            onClick={() => handleMediaClick(item)}
                        >
                            {item.type === 'video' ? <video src={item.url} controls={false} /> : <img src={item.url} alt={`VIP ${index}`} />}
                            <div className="zoom-hint"><i className="fa-solid fa-expand"></i></div>
                        </div>
                    ))}
                </div>
                {displayMedia.length > 1 && (
                    <div className="carousel-dots">
                        {displayMedia.map((_, idx) => <div key={idx} className={`dot ${currentSlide === idx ? 'active' : ''}`}></div>)}
                    </div>
                )}
            </div>
            
            <section className="content-section">
                <div className="copy-box text-left space-y-4">
                    <p className="text-base text-gray-200 whitespace-pre-wrap leading-relaxed break-words">{group.vipDoor?.text || "Este grupo contém conteúdo exclusivo. Garanta seu acesso agora!"}</p>
                </div>
                {isCreator && (
                    <div style={{display: 'flex', justifyContent: 'center'}}>
                        <button className="copy-link-btn" onClick={handleCopyCheckoutLink}><i className="fa-solid fa-link"></i> Copiar Link de Checkout</button>
                    </div>
                )}
            </section>

            <section className="content-section text-center pb-10"> 
                {isCreator ? (
                    <button className="cta-button" onClick={() => navigate(`/group-chat/${group.id}`)}>Entrar no Grupo (Admin)</button>
                ) : (
                    <button className={`cta-button ${!isPurchaseEnabled ? 'disabled' : ''} ${isRenewal ? 'renewal' : ''}`} onClick={!isPurchaseEnabled ? undefined : handlePurchaseClick} disabled={!isPurchaseEnabled}>
                        {!isPurchaseEnabled ? 'COMPRA INDISPONÍVEL' : (isRenewal ? 'RENOVAR ASSINATURA' : `${customCta} ${getCurrencySymbol(group.currency)} ${formatPrice(group.price)}`)}
                    </button>
                )}
                <p className="text-xs text-gray-500 mt-3"><i className="fa-solid fa-shield-halved"></i> Processado por SyncPay</p>
            </section>
        </main>

        {/* EMAIL CAPTURE MODAL (Gated) */}
        {isEmailModalOpen && (
            <div className="email-modal-overlay">
                <div className="email-modal-content animate-pop-in">
                    <div className="w-12 h-12 bg-[#00c2ff]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#00c2ff]">
                        <i className="fa-solid fa-user-lock text-[#00c2ff] text-xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Identificação</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        Para acessar o checkout seguro e liberar sua vaga, informe seu melhor e-mail.
                    </p>
                    <form onSubmit={handleGuestEmailSubmit}>
                        <input 
                            type="email" 
                            placeholder="seu@email.com" 
                            className="email-input"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            required
                        />
                        {emailError && <p className="text-red-400 text-xs mt-2 text-left">{emailError}</p>}
                        <button type="submit" className="confirm-email-btn">
                            CONCLUIR <i className="fa-solid fa-check ml-2"></i>
                        </button>
                    </form>
                    <p className="text-[10px] text-gray-600 mt-4">
                        Seus dados estão protegidos. Não enviamos spam.
                    </p>
                </div>
            </div>
        )}

        {/* PIX MODAL */}
        <div className={`modal-overlay ${isPixModalOpen ? 'open' : ''}`} onClick={(e) => { if(e.target === e.currentTarget && flowState !== 'success') { setIsPixModalOpen(false); stopPolling(); } }}>
            <div className="modal-content">
                {flowState === 'loading' && (
                    <div className="py-10">
                        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-[#00c2ff]"></i>
                        <p className="mt-4 text-gray-400">Gerando PIX...</p>
                    </div>
                )}
                {flowState === 'error' && (
                    <div className="py-5">
                        <i className="fa-solid fa-triangle-exclamation text-4xl text-red-500 mb-3"></i>
                        <div className="error-box">{errorMessage}</div>
                        <button className="error-retry-btn" onClick={() => generatePix()}>Tentar Novamente</button>
                    </div>
                )}
                {flowState === 'success' && (
                    <div className="gift-container">
                        <i className="fa-solid fa-gift gift-icon-static"></i>
                        <h3 className="success-title">{isRenewal ? 'Renovado' : 'Aprovado'}</h3>
                        <p className="text-sm text-gray-400 mb-6">Acesso liberado!</p>
                        <button className="redeem-btn-sophisticated" onClick={handleRedeemClick}>Resgatar Acesso 🎁</button>
                    </div>
                )}
                {flowState === 'pix' && (
                    <>
                        <h3 className="text-lg font-bold text-[#00c2ff] mb-2">Pagar com Pix</h3>
                        <div className="flex flex-col items-center mb-4">
                            <span className="text-gray-400 text-xs uppercase tracking-wide mb-1">Valor a Pagar</span>
                            <span className="text-2xl font-bold text-white flex items-center gap-1">
                                <span className="text-[#00c2ff]">{getCurrencySymbol(group.currency)}</span>{formatPrice(group.price)}
                            </span>
                        </div>
                        
                        {pixImage ? (
                            <div className="qrcode-wrapper"><img src={pixImage} className="qrcode-img" alt="QR Code" /></div>
                        ) : pixCode ? (
                            <div className="qrcode-wrapper" style={{ background: 'white', padding: '10px', borderRadius: '12px', display: 'inline-block' }}>
                                <QRCodeSVG value={pixCode} size={200} />
                            </div>
                        ) : (
                            <div className="p-4 bg-[#1e2531] rounded-lg mb-4 text-center border border-dashed border-[#00c2ff]/30">
                                <i className="fa-solid fa-triangle-exclamation text-2xl text-yellow-500 mb-2"></i>
                                <p className="text-xs text-[#00c2ff]">Erro ao exibir QR Code visual. Use o código abaixo.</p>
                            </div>
                        )}

                        <p className="text-xs text-gray-300 mb-1 mt-2">Copia e Cola:</p>
                        <textarea ref={pixTextAreaRef} className="pix-textarea" readOnly value={pixCode} onClick={(e) => e.currentTarget.select()} />
                        <button onClick={copyPixCode} className="w-full py-3 mb-4 font-semibold bg-[#00c2ff] text-[#0a0c10] rounded-lg hover:bg-white transition-colors border-none cursor-pointer flex items-center justify-center" style={{ backgroundColor: isCopied ? '#10b981' : '' }}>
                            {isCopied ? <><i className="fa-solid fa-check mr-2"></i> Copiado!</> : <><i className="fa-solid fa-copy mr-2"></i> Copiar Código</>}
                        </button>
                        <div className="flex flex-col items-center justify-center gap-2 text-xs text-gray-500 mt-2">
                            <div className="flex items-center gap-2 animate-pulse"><i className="fa-solid fa-spinner fa-spin"></i> Aguardando confirmação...</div>
                        </div>
                    </>
                )}
            </div>
        </div>

        {zoomedMedia && (
            <div className="fixed inset-0 z-[120] bg-black bg-opacity-95 flex items-center justify-center p-2" onClick={() => setZoomedMedia(null)}>
                <button className="absolute top-4 right-4 text-white text-4xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center z-50" onClick={() => setZoomedMedia(null)}>&times;</button>
                {zoomedMedia.type === 'video' ? <video src={zoomedMedia.url} controls autoPlay className="max-w-full max-h-full object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} /> : <img src={zoomedMedia.url} alt="Zoom" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />}
            </div>
        )}
    </div>
  );
};
