
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marketplaceService } from '../services/marketplaceService';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
// Import postService to provide formatRelativeTime functionality
import { postService } from '../services/postService';
import { MarketplaceItem, Comment, ChatMessage } from '../types';
import { db } from '@/database';
import { ImageCarousel } from '../components/ImageCarousel';
import { GroupAttachmentCard } from '../components/GroupAttachmentCard';
import { useModal } from '../components/ModalSystem';

// --- Media Gallery Component ---
const MediaGallery: React.FC<{ mediaItems: { type: 'image' | 'video', url: string }[], onMediaClick?: (media: { type: 'image' | 'video', url: string }) => void }> = ({ mediaItems, onMediaClick }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollLeft = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            setCurrentIndex(index);
        }
    };

    if (mediaItems.length === 0) {
        return (
            <div className="w-full aspect-square bg-gray-800 flex items-center justify-center text-gray-600">
                <i className="fa-solid fa-image text-6xl"></i>
            </div>
        );
    }

    return (
        <div className="relative w-full bg-black aspect-square max-h-[60vh] flex flex-col">
            {/* Counter */}
            <div className="absolute top-4 right-4 bg-black/60 text-white text-xs px-3 py-1 rounded-full z-10 backdrop-blur-md font-bold">
                {currentIndex + 1} / {mediaItems.length}
            </div>

            {/* Scroll Container */}
            <div 
                ref={scrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar w-full h-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={handleScroll}
            >
                {mediaItems.map((item, idx) => (
                    <div 
                        key={idx} 
                        className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center bg-black relative cursor-pointer"
                        onClick={() => {
                            if (onMediaClick) onMediaClick(item);
                        }}
                    >
                        {item.type === 'video' ? (
                            <video 
                                src={item.url} 
                                controls 
                                className="max-w-full max-h-full object-contain" 
                                style={{width: '100%', height: '100%'}}
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            />
                        ) : (
                            <img 
                                src={item.url} 
                                alt={`Product view ${idx + 1}`} 
                                className="max-w-full max-h-full object-contain" 
                            />
                        )}
                        {/* Expand Button Overlay for clarity */}
                        <button 
                            className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded-full pointer-events-none"
                        >
                            <i className="fa-solid fa-expand text-xs"></i>
                        </button>
                    </div>
                ))}
            </div>

            {/* Dots */}
            {mediaItems.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {mediaItems.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`w-2 h-2 rounded-full transition-all shadow-sm ${currentIndex === idx ? 'bg-[#00c2ff] scale-125' : 'bg-white/50'}`}
                        ></div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ProductDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showConfirm } = useModal();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSeller, setIsSeller] = useState(false);
  
  // Comments State
  const [questions, setQuestions] = useState<Comment[]>([]);
  const [newQuestion, setNewQuestion] = useState('');

  // Zoom State
  const [zoomedMedia, setZoomedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  
  const currentUser = authService.getCurrentUser();
  const currentUserHandle = currentUser?.profile?.name ? `@${currentUser.profile.name}` : "";

  useEffect(() => {
    if (id) {
      const foundItem = marketplaceService.getItemById(id);
      if (foundItem) {
        setItem(foundItem);
        setQuestions(foundItem.comments || []);
        
        if (currentUser && currentUser.email === foundItem.sellerId) {
            setIsSeller(true);
        }
      }
    }
    setLoading(false);
  }, [id]);

  const handleChat = (e: React.MouseEvent) => {
      e.stopPropagation(); 
      
      if (!currentUser) {
          alert("Faça login para contatar o vendedor.");
          return;
      }
      if (!item) {
          alert("Erro ao carregar produto.");
          return;
      }
      if (isSeller) {
          alert("Este produto é seu.");
          return;
      }

      try {
          // Criar ou recuperar chat privado
          const chatId = chatService.getPrivateChatId(currentUser.email, item.sellerId);
          
          // Envia uma mensagem com o contexto do produto (Sempre, para manter contexto atual)
          const contextMsg: ChatMessage = {
              id: Date.now(),
              text: `Olá! Tenho interesse neste produto.`,
              type: 'sent',
              contentType: 'text',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'sent',
              senderEmail: currentUser.email,
              senderAvatar: currentUser.profile?.photoUrl,
              senderName: currentUser.profile?.name || 'Comprador',
              product: {
                  id: item.id,
                  title: item.title,
                  price: item.price,
                  image: item.image
              }
          };
          
          chatService.sendMessage(chatId, contextMsg);
          navigate(`/chat/${chatId}`);
          
      } catch (err) {
          console.error(err);
          alert("Erro ao iniciar conversa.");
      }
  };

  const handleSendQuestion = () => {
      if (!newQuestion.trim() || !item) return;
      
      if (!currentUser) {
          alert("Faça login para perguntar.");
          return;
      }

      const comment = marketplaceService.addComment(item.id, newQuestion, currentUser);
      if (comment) {
          setQuestions(prev => [...prev, comment]);
          setNewQuestion('');
      }
  };

  const handleDeleteQuestion = async (commentId: string) => {
      if (!item) return;
      if (await showConfirm("Excluir pergunta", "Deseja excluir sua pergunta?", "Excluir", "Cancelar")) {
          const success = await marketplaceService.deleteComment(item.id, commentId);
          if (success) {
              setQuestions(prev => prev.filter(q => q.id !== commentId));
          }
      }
  };

  const getPriceDisplay = () => {
      if (!item) return '';
      if (item.category === 'Vagas de Emprego') return 'A combinar';
      return `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const handleDelete = async () => {
      const confirmed = await showConfirm(
          "Excluir Anúncio",
          "Tem certeza que deseja excluir este anúncio permanentemente?",
          "Excluir",
          "Cancelar"
      );

      if (confirmed) {
          if (id) marketplaceService.deleteItem(id);
          navigate('/marketplace');
      }
  };

  const navigateToStore = () => {
      if (!item) return;
      navigate(`/user/${item.sellerName}`, { state: { activeTab: 'products' } });
  };

  // Prepare Media Items for Gallery
  const mediaItems = useMemo(() => {
      if (!item) return [];
      const media: { type: 'image' | 'video', url: string }[] = [];
      
      // Prioritize Video
      if (item.video) media.push({ type: 'video', url: item.video });
      
      // Main Image
      if (item.image) media.push({ type: 'image', url: item.image });
      
      // Gallery Images
      if (item.images) {
          item.images.forEach(img => media.push({ type: 'image', url: img }));
      }
      
      // Remove duplicates if main image is also in gallery
      const unique = media.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
      
      return unique;
  }, [item]);

  if (loading) return <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center text-white">Carregando...</div>;
  
  if (!item) return (
      <div className="min-h-screen bg-[#0c0f14] flex flex-col items-center justify-center text-white">
          <i className="fa-solid fa-box-open text-4xl mb-4 text-gray-600"></i>
          <p>Produto não encontrado.</p>
          <button onClick={() => navigate('/marketplace')} className="mt-4 text-[#00c2ff]">Voltar ao Marketplace</button>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#0c0f14] text-white font-['Inter'] flex flex-col relative pb-[90px]">
      <style>{`
        /* Reset & Layout */
        .product-container { padding: 0; position: relative; z-index: 10; width: 100%; max-width: 600px; margin: 0 auto; }
        
        /* Header Overlay for Back Button */
        .header-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 70px;
            z-index: 20; pointer-events: none;
            background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
        }
        .back-btn {
            position: absolute; top: 15px; left: 15px; z-index: 30; pointer-events: auto;
            width: 40px; height: 40px; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            color: #fff; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
            transition: 0.2s;
        }
        .back-btn:hover { background: #00c2ff; color: #000; border-color: #00c2ff; }

        /* Content Wrapper */
        .details-wrapper {
            background: #0c0f14;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            margin-top: -20px; /* Slight overlap */
            position: relative;
            z-index: 5;
            padding: 25px 20px;
            box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
        }

        .product-title { font-size: 22px; font-weight: 700; line-height: 1.3; margin-bottom: 10px; color: #fff; }
        .product-price { font-size: 26px; font-weight: 800; color: #00ff82; margin-bottom: 15px; letter-spacing: -0.5px; }
        
        .badges-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .badge-item { 
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            padding: 6px 12px; border-radius: 8px; font-size: 12px; color: #ccc;
            display: flex; align-items: center; gap: 6px;
        }
        .badge-item i { color: #00c2ff; }

        /* Seller Card */
        .seller-card {
            background: rgba(20,20,25,0.6); border: 1px solid rgba(255,255,255,0.05);
            border-radius: 16px; padding: 15px; margin-bottom: 25px;
            display: flex; align-items: center; justify-content: space-between;
            cursor: pointer; transition: 0.2s;
        }
        .seller-card:hover { background: rgba(255,255,255,0.05); }
        .seller-left { display: flex; align-items: center; gap: 12px; }
        .seller-avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #00c2ff; }
        .seller-info h4 { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
        .seller-info p { font-size: 12px; color: #888; }
        .store-icon { color: #00c2ff; opacity: 0.5; }

        /* Description */
        .desc-section { margin-bottom: 30px; }
        .section-header { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .desc-text { color: #ccc; font-size: 15px; line-height: 1.6; white-space: pre-wrap; font-weight: 300; }

        /* Q&A */
        .qa-section { margin-bottom: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; }
        .qa-input-box { display: flex; gap: 10px; margin-bottom: 20px; }
        .qa-input {
            flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 12px 15px; color: #fff; outline: none; font-size: 14px;
        }
        .qa-input:focus { border-color: #00c2ff; }
        .qa-send-btn {
            background: #00c2ff; border: none; border-radius: 12px; width: 48px; cursor: pointer;
            color: #000; display: flex; align-items: center; justify-content: center; font-size: 18px;
        }

        .question-item { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .q-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .q-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; background: #333; }
        .q-user { font-size: 13px; font-weight: 600; color: #fff; }
        .q-time { font-size: 11px; color: #666; margin-left: auto; }
        .q-text { font-size: 14px; color: #ddd; margin-left: 34px; line-height: 1.4; position: relative; }
        .q-delete-btn { position: absolute; right: 0; top: 0; color: #555; cursor: pointer; padding: 5px; }
        .q-delete-btn:hover { color: #ff4d4d; }

        /* Bottom Bar */
        .bottom-bar {
            position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(12,15,20,0.95);
            backdrop-filter: blur(10px); padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1);
            display: flex; gap: 12px; align-items: center; z-index: 50;
            box-shadow: 0 -5px 20px rgba(0,0,0,0.5);
        }
        .action-btn {
            flex: 1; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 15px;
            border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
            transition: 0.2s;
        }
        .btn-primary { background: #00c2ff; color: #000; box-shadow: 0 4px 15px rgba(0,194,255,0.3); }
        .btn-primary:hover { background: #fff; }
        .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; max-width: 60px; font-size: 20px; }
        .btn-danger { background: rgba(255,77,77,0.1); color: #ff4d4d; border: 1px solid rgba(255,77,77,0.3); }
      `}</style>

      {/* Header Overlay */}
      <div className="header-overlay">
          <div className="back-btn" onClick={() => navigate('/marketplace')}>
              <i className="fa-solid fa-arrow-left"></i>
          </div>
      </div>

      <div className="product-container">
          {/* Media Carousel */}
          <MediaGallery 
            mediaItems={mediaItems} 
            onMediaClick={(m) => setZoomedMedia(m)} 
          />

          {/* Details Wrapper */}
          <div className="details-wrapper">
              <h1 className="product-title">{item.title}</h1>
              <div className="product-price">{getPriceDisplay()}</div>
              
              <div className="badges-row">
                  <div className="badge-item"><i className="fa-solid fa-location-dot"></i> {item.location}</div>
                  <div className="badge-item"><i className="fa-solid fa-tag"></i> {item.category}</div>
                  <div className="badge-item"><i className="fa-solid fa-clock"></i> {new Date(item.timestamp).toLocaleDateString()}</div>
              </div>

              <div className="seller-card" onClick={navigateToStore}>
                  <div className="seller-left">
                      {item.sellerAvatar ? (
                          <img src={item.sellerAvatar} className="seller-avatar" alt="Seller" />
                      ) : (
                          <div className="seller-avatar bg-gray-700 flex items-center justify-center text-xs"><i className="fa-solid fa-user"></i></div>
                      )}
                      <div className="seller-info">
                          <h4>{item.sellerName}</h4>
                          <p>Ver perfil completo</p>
                      </div>
                  </div>
                  <i className="fa-solid fa-chevron-right store-icon"></i>
              </div>

              <div className="desc-section">
                  <h3 className="section-header"><i className="fa-solid fa-align-left text-[#00c2ff]"></i> Detalhes</h3>
                  <p className="desc-text">{item.description || "Sem descrição fornecida pelo vendedor."}</p>
              </div>

              {/* Q&A Section */}
              <div className="qa-section">
                  <h3 className="section-header"><i className="fa-regular fa-comments text-[#00c2ff]"></i> Perguntas ({questions.length})</h3>
                  
                  {!isSeller && (
                      <div className="qa-input-box">
                          <input 
                              type="text" 
                              className="qa-input" 
                              placeholder="Escreva sua dúvida..." 
                              value={newQuestion}
                              onChange={(e) => setNewQuestion(e.target.value)}
                          />
                          <button className="qa-send-btn" onClick={handleSendQuestion}>
                              <i className="fa-solid fa-paper-plane"></i>
                          </button>
                      </div>
                  )}

                  <div className="questions-list">
                      {questions.length > 0 ? (
                          questions.map((q, idx) => (
                              <div key={idx} className="question-item">
                                  <div className="q-header">
                                      {q.avatar ? (
                                          <img src={q.avatar} className="q-avatar" alt="User" />
                                      ) : (
                                          <div className="q-avatar flex items-center justify-center bg-gray-700 text-[10px]"><i className="fa-solid fa-user"></i></div>
                                      )}
                                      <span className="q-user">{q.username}</span>
                                      <span className="q-time">{postService.formatRelativeTime(q.timestamp)}</span>
                                  </div>
                                  <div className="q-text">
                                      {q.text}
                                      {q.username === currentUserHandle && (
                                          <button 
                                              className="q-delete-btn bg-transparent border-none"
                                              onClick={() => handleDeleteQuestion(q.id)}
                                          >
                                              <i className="fa-solid fa-trash-can"></i>
                                          </button>
                                      )}
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="text-gray-500 text-sm italic py-2">
                              Nenhuma pergunta feita ainda.
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="bottom-bar">
          {isSeller ? (
              <button className="action-btn btn-danger" onClick={handleDelete}>
                  <i className="fa-solid fa-trash"></i> Excluir Anúncio
              </button>
          ) : (
              <>
                <button className="action-btn btn-secondary" onClick={() => { alert('Adicionado aos favoritos!'); }}>
                    <i className="fa-regular fa-heart"></i>
                </button>
                <button className="action-btn btn-primary" onClick={handleChat}>
                    <i className="fa-brands fa-whatsapp"></i> Conversar / Negociar
                </button>
              </>
          )}
      </div>

      {/* LIGHTBOX OVERLAY */}
      {zoomedMedia && (
          <div 
            className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center p-2"
            onClick={() => setZoomedMedia(null)}
          >
              <button 
                className="absolute top-4 right-4 text-white text-4xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center z-50"
                onClick={() => setZoomedMedia(null)}
              >
                  &times;
              </button>
              
              {zoomedMedia.type === 'video' ? (
                  <video 
                    src={zoomedMedia.url} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-full object-contain shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  />
              ) : (
                  <img 
                    src={zoomedMedia.url} 
                    alt="Zoom" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()} 
                  />
              )}
          </div>
      )}
    </div>
  );
};
