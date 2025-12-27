
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketplaceService } from '../services/marketplaceService';
import { authService } from '../services/authService';
import { db } from '@/database';
import { MarketplaceItem } from '../types';

// Helper functions defined outside component to avoid recreation
const getPriceText = (prod: MarketplaceItem) => {
    if (prod.category === 'Vagas de Emprego') return 'Vaga de trabalho';
    
    // Consistent Formatting: R$ 1.234,56
    const formattedPrice = prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (prod.category === 'Serviços') return `A partir de R$ ${formattedPrice}`;
    if (prod.category === 'Infoprodutos') return `R$ ${formattedPrice}`;
    if (prod.isAd && prod.price === 0) return 'Patrocinado';
    return `R$ ${formattedPrice}`;
};

const getButtonText = (prod: MarketplaceItem) => {
    if (prod.ctaText) return prod.ctaText;
    return prod.category === 'Vagas de Emprego' ? 'Candidatar-se' : 'Ver Produto';
};

const CATEGORIES = [
    { id: 'Todos', icon: 'fa-store', label: 'Todos' },
    { id: 'Destaque', icon: 'fa-rocket', label: 'Destaques' },
    { id: 'Infoprodutos', icon: 'fa-graduation-cap', label: 'Infoprodutos' },
    { id: 'Vagas de Emprego', icon: 'fa-briefcase', label: 'Empregos' },
    { id: 'Serviços', icon: 'fa-screwdriver-wrench', label: 'Serviços' },
    { id: 'Imóveis', icon: 'fa-building', label: 'Imóveis' },
    { id: 'Casa', icon: 'fa-couch', label: 'Casa' },
    { id: 'Automotivo', icon: 'fa-car', label: 'Carro' },
    { id: 'Eletrônicos', icon: 'fa-mobile-screen', label: 'Eletrônicos' },
    { id: 'Moda', icon: 'fa-shirt', label: 'Moda' },
];

export const Marketplace: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [allItems, setAllItems] = useState<MarketplaceItem[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);

  // Data Loading
  useEffect(() => {
      const email = authService.getCurrentUserEmail() || undefined;
      setCurrentUserEmail(email);

      const loadItems = () => {
          // Use the intelligent algorithm
          const items = marketplaceService.getRecommendedItems(email);
          setAllItems(items);
      };

      loadItems();
      const unsubscribe = db.subscribe('marketplace', loadItems);
      return () => unsubscribe();
  }, []);

  // Optimization: Derive filtered list efficiently with useMemo
  const filteredProducts = useMemo(() => {
      let result = allItems;

      if (activeCategory !== 'Todos') {
          if (activeCategory === 'Destaque') {
              result = result.filter(p => p.isAd);
          } else {
              result = result.filter(p => p.category === activeCategory);
          }
      }

      if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          result = result.filter(p => 
              p.title.toLowerCase().includes(term) || 
              p.location.toLowerCase().includes(term)
          );
      }
      return result;
  }, [allItems, activeCategory, searchTerm]);

  // Handlers
  const handleProductClick = (item: MarketplaceItem) => {
      // Track interaction to feed the algorithm
      if (currentUserEmail) {
          marketplaceService.trackView(item, currentUserEmail);
      }

      if (item.isAd && item.ctaLink) {
          if (item.ctaLink.startsWith('http')) window.open(item.ctaLink, '_blank');
          else navigate(item.ctaLink);
      } else {
          navigate(`/marketplace/product/${item.id}`);
      }
  };

  const handleOptionSelect = (type: 'paid' | 'organic') => {
      if (type === 'paid') {
          // LOCKED FEATURE
          alert("Função em desenvolvimento. Em breve disponível.");
          return;
      } else {
          setIsMenuOpen(false);
          navigate('/create-marketplace-item', { state: { type: 'organic' } });
      }
  };

  return (
    <div className="h-screen flex flex-col font-['Inter'] overflow-hidden bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white">
      <style>{`
        /* CSS Optimization: Grouped and Cleaned */
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }

        header {
            display:flex; align-items:center; justify-content:space-between;
            padding:16px 32px; background: #0c0f14; position:fixed;
            width:100%; z-index:30; border-bottom:1px solid rgba(255,255,255,0.1);
            height: 80px; top: 0;
        }
        header button {
            background:none; border:none; color:#00c2ff; font-size:22px;
            cursor:pointer; transition:0.3s; padding: 5px;
        }
        header button:hover { color:#fff; transform:scale(1.1); }

        main { 
            flex-grow:1; 
            padding: 100px 20px 100px 20px; 
            display: flex; 
            flex-direction: column; 
            overflow-y: auto; 
            -webkit-overflow-scrolling: touch;
        }

        /* Search Bar */
        .search-bar {
            display:flex; align-items:center; gap:10px; width:100%; max-width:600px;
            margin: 0 auto 15px auto; padding:12px 20px; border-radius: 50px;
            background: rgba(255,255,255,0.08); backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1); transition: 0.3s;
            position: sticky; top: 0; z-index: 25; /* Sticky search */
        }
        .search-bar:focus-within { border-color: #00c2ff; box-shadow: 0 0 15px rgba(0,194,255,0.2); }
        .search-bar input {
            flex:1; background:transparent; border:none; outline:none; color:#fff; font-size:16px;
        }
        .search-bar i { color:#00c2ff; font-size:18px; cursor:pointer; }

        /* Categories */
        .category-scroll-container {
            width: 100%; 
            position: relative; 
            z-index: 20; /* Higher than grid */
            margin-bottom: 20px;
            flex-shrink: 0;
            background: transparent;
        }
        .category-scroll {
            display:flex; gap:12px; overflow-x:auto; scroll-behavior:smooth;
            padding:5px 5px 15px 5px; width:100%;
            flex-wrap: nowrap;
        }
        .category-scroll::-webkit-scrollbar { height:4px; }
        .category-scroll::-webkit-scrollbar-thumb { background:rgba(0,194,255,0.3); border-radius:2px; }
        
        .category-icon {
            flex:0 0 auto; background: rgba(255,255,255,0.05);
            border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:12px 16px;
            text-align:center; color:#aaa; cursor:pointer;
            transition:all 0.3s ease; min-width: 90px;
        }
        .category-icon i { font-size:20px; margin-bottom:6px; display:block; transition: 0.3s; }
        .category-icon span { font-size:11px; font-weight: 500; }
        
        .category-icon:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .category-icon.active { 
            background:#00c2ff; color:#000; border-color: #00c2ff; 
            box-shadow: 0 4px 15px rgba(0,194,255,0.4); transform: translateY(-2px);
        }
        .category-icon.active span { font-weight:800; }

        /* Products Grid */
        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px; 
            width: 100%; 
            max-width: 1200px; 
            margin: 0 auto;
            position: relative; 
            z-index: 1; 
            flex-grow: 1;
            align-content: start; /* Fixes stretching rows when few items */
        }
        
        /* Force 2 columns on mobile for neat square look */
        @media (max-width: 600px) {
            .products-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .product-card {
            background: rgba(20,20,25,0.6); border-radius:16px; padding:10px;
            display:flex; flex-direction:column; transition:0.3s; 
            border: 1px solid rgba(255,255,255,0.05);
            cursor: pointer; position: relative;
            overflow: hidden;
        }
        .product-card.sponsored { border-color: #FFD700; background: rgba(255, 215, 0, 0.05); }
        
        .product-card:hover { 
            background: rgba(30,30,40,0.8); 
            border-color: rgba(0,194,255,0.3); 
            transform:translateY(-2px); 
        }
        
        .product-img-container {
            width:100%; 
            aspect-ratio: 1/1; /* Enforce Square */
            border-radius:12px; overflow: hidden; 
            margin-bottom:10px; background: #000; position: relative;
        }
        .product-card img {
            width:100%; height:100%; object-fit:cover; transition: 0.5s;
        }
        .product-card:hover img { transform: scale(1.05); }
        
        .ad-badge {
            position: absolute; top: 8px; left: 8px; background: #FFD700; color: #000;
            font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; z-index: 5;
        }
        
        .product-info h4 { 
            color:#fff; font-size:14px; margin-bottom:4px; font-weight: 600;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .product-price { color:#00ff82; font-size:13px; font-weight:700; margin-bottom:4px; }
        .product-card.sponsored .product-price { color: #FFD700; }
        
        .product-sales { font-size: 10px; color: #FFD700; margin-bottom: 4px; font-weight: 500; }

        .product-location { color:#888; font-size:11px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .product-actions { margin-top:10px; width:100%; }
        .product-actions button {
            width:100%; border:none; padding:8px; border-radius:8px; cursor:pointer; 
            font-size: 12px; font-weight:700; background:rgba(0,194,255,0.1); color:#00c2ff;
            transition:0.3s;
        }
        .product-card.sponsored .product-actions button { background: #FFD700; color: #000; }
        .product-card:hover .product-actions button { background:#00c2ff; color:#000; }

        /* Footer */
        footer {
            position: fixed; bottom:0; left:0; width:100%; background:rgba(12,15,20,0.95);
            display:flex; justify-content:space-around; padding:14px 0;
            border-top-left-radius:20px; border-top-right-radius:20px;
            z-index:20; backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.05);
        }
        footer button {
            background:none; border:none; color:#00c2ff; font-size:22px;
            cursor:pointer; transition:0.3s; padding:8px; border-radius:10px;
        }
        footer button:hover {
            color:#fff; transform:translateY(-2px); background:rgba(255,255,255,0.1);
        }

        /* FAB Styles */
        #postButton {
            position: fixed; bottom: 110px; right: 20px; width: 56px; height: 56px;
            background: #00c2ff; border: none; border-radius: 50%; color: #fff;
            font-size: 24px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,194,255,0.4);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 35; 
            display: flex; align-items: center; justify-content: center;
        }
        #postButton:hover { transform: scale(1.1); background: #fff; color: #00c2ff; }
        #postButton.active { transform: rotate(45deg); background: #ff4d4d; color: #fff; }
        
        .empty-state {
            width: 100%; text-align: center; color: #555; margin-top: 60px;
            display: flex; flex-direction: column; align-items: center;
        }
        .empty-state i { font-size: 50px; margin-bottom: 20px; opacity: 0.3; }

        /* Menu Overlay */
        .fab-menu-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 30;
            backdrop-filter: blur(3px); animation: fadeIn 0.2s;
        }
        
        .fab-menu {
            position: fixed; bottom: 180px; right: 20px;
            display: flex; flex-direction: column; gap: 12px;
            z-index: 35; align-items: flex-end;
        }
        
        .fab-option {
            background: #1a1e26; border: 1px solid rgba(255,255,255,0.1);
            padding: 12px 20px; border-radius: 12px; color: #fff;
            display: flex; align-items: center; gap: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            cursor: pointer; transition: all 0.2s;
            animation: slideUp 0.3s forwards;
            opacity: 0; transform: translateY(20px);
        }
        .fab-option:hover { transform: translateX(-5px); background: #252a33; border-color: #00c2ff; }
        
        .fab-option:nth-child(1) { animation-delay: 0.05s; }
        .fab-option:nth-child(2) { animation-delay: 0s; }
        
        .fab-option span { font-weight: 600; font-size: 14px; }

        /* Locked Option Style */
        .fab-option.locked {
            opacity: 0.7; border-color: #444; color: #aaa;
        }
        .fab-option.locked:hover {
            transform: none; border-color: #444; background: #1a1e26;
        }
        
        @keyframes slideUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <header>
        {/* Left: Back to Feed */}
        <button onClick={() => navigate('/feed')}>
            <i className="fa-solid fa-arrow-left"></i>
        </button>

        {/* Center: Flux Logo (60px consistent size) */}
        <div 
            className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>
        
        {/* Right: Orders/Store */}
        <button onClick={() => navigate('/my-store')}>
            <i className="fa-solid fa-briefcase"></i>
        </button>
      </header>

      <main>
        {/* Search */}
        <div className="search-bar">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input 
                type="text" 
                placeholder="O que você procura hoje?" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Categories (Wrapper to fix layout bug) */}
        <div className="category-scroll-container">
            <div className="category-scroll">
                {CATEGORIES.map((cat) => (
                    <div 
                        key={cat.id} 
                        className={`category-icon ${activeCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat.id)}
                    >
                        <i className={`fa-solid ${cat.icon}`}></i>
                        <span>{cat.label}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Grid */}
        <div className="products-grid">
            {filteredProducts.length > 0 ? (
                filteredProducts.map((prod) => (
                    <div className={`product-card ${prod.isAd ? 'sponsored' : ''}`} key={prod.id} onClick={() => handleProductClick(prod)}>
                        <div className="product-img-container">
                            {prod.isAd && <div className="ad-badge">Destaque</div>}
                            <img src={prod.image || 'https://via.placeholder.com/300?text=Sem+Imagem'} alt={prod.title} loading="lazy" />
                        </div>
                        <div className="product-info">
                            <h4>{prod.title}</h4>
                            <div className="product-price">{getPriceText(prod)}</div>
                            <div className="product-sales">{prod.soldCount || 0} vendidos</div>
                            <div className="product-location"><i className="fa-solid fa-location-dot"></i> {prod.location}</div>
                        </div>
                        <div className="product-actions">
                            <button onClick={(e) => { e.stopPropagation(); handleProductClick(prod); }}>
                                {getButtonText(prod)}
                            </button>
                        </div>
                    </div>
                ))
            ) : (
                <div className="empty-state">
                    <i className="fa-solid fa-ghost"></i>
                    <p>Nenhum resultado encontrado.</p>
                </div>
            )}
        </div>
      </main>

      <footer>
        <button onClick={() => navigate('/feed')}><i className="fa-solid fa-newspaper"></i></button>
        <button onClick={() => navigate('/messages')}><i className="fa-solid fa-comments"></i></button>
        <button onClick={() => navigate('/notifications')}><i className="fa-solid fa-bell"></i></button>
        <button onClick={() => navigate('/profile')}><i className="fa-solid fa-user"></i></button>
      </footer>

      {/* FAB & Menu */}
      {isMenuOpen && <div className="fab-menu-overlay" onClick={() => setIsMenuOpen(false)}></div>}
      
      {isMenuOpen && (
          <div className="fab-menu">
              <button className="fab-option locked" onClick={() => handleOptionSelect('paid')}>
                  <span>Impulsionar (Ads)</span>
                  <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
                      <i className="fa-solid fa-lock" style={{color: '#aaa', fontSize: '12px'}}></i>
                      <i className="fa-solid fa-rocket" style={{color: '#555'}}></i>
                  </div>
              </button>
              <button className="fab-option" onClick={() => handleOptionSelect('organic')}>
                  <span>Anunciar Grátis</span>
                  <i className="fa-solid fa-tag" style={{color: '#00ff82'}}></i>
              </button>
          </div>
      )}

      <button id="postButton" className={isMenuOpen ? 'active' : ''} onClick={() => setIsMenuOpen(!isMenuOpen)}>
        <i className={`fa-solid ${isMenuOpen ? 'fa-plus' : 'fa-plus'}`}></i>
      </button>
    </div>
  );
};
