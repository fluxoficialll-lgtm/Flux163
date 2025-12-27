
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketplaceService } from '../services/marketplaceService';
import { adService } from '../services/adService';
import { authService } from '../services/authService';
import { MarketplaceItem, AdCampaign } from '../types';
import { useModal } from '../components/ModalSystem';

// Helper for metrics
const formatMetric = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
};

export const MyStore: React.FC = () => {
  const navigate = useNavigate();
  const { showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<'products' | 'campaigns'>('products');
  const [products, setProducts] = useState<MarketplaceItem[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      const loadData = () => {
          const user = authService.getCurrentUser();
          if (!user) {
              navigate('/');
              return;
          }

          // Load Products
          const allItems = marketplaceService.getItems();
          const myItems = allItems.filter(item => item.sellerId === user.email);
          setProducts(myItems);

          // Load Campaigns
          const myAds = adService.getMyCampaigns();
          setCampaigns(myAds);

          setLoading(false);
      };

      loadData();
  }, [navigate]);

  const handleDeleteProduct = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const confirmed = await showConfirm(
          "Excluir Produto", 
          "Tem certeza que deseja excluir este produto? A ação não pode ser desfeita.", 
          "Excluir", 
          "Cancelar"
      );
      
      if (confirmed) {
          marketplaceService.deleteItem(id);
          setProducts(prev => prev.filter(p => p.id !== id));
      }
  };

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const confirmed = await showConfirm(
          "Encerrar Campanha", 
          "Deseja realmente encerrar esta campanha? O orçamento restante será perdido.",
          "Encerrar",
          "Manter"
      );

      if (confirmed) {
          adService.deleteCampaign(id);
          setCampaigns(prev => prev.filter(c => c.id !== id));
      }
  };

  const formatCurrency = (val: number) => {
      return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
        
        header {
            display:flex; align-items:center; padding:16px;
            background: #0c0f14; position:fixed; width:100%; top:0; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); height: 65px;
        }
        header .back-btn {
            background:none; border:none; color:#fff; font-size:22px; cursor:pointer; padding-right: 15px;
        }
        header h1 { font-size:20px; font-weight:600; }

        main { 
            padding-top: 80px; padding-bottom: 40px; 
            width: 100%; max-width: 600px; margin: 0 auto; 
            padding-left: 20px; padding-right: 20px;
            flex-grow: 1; overflow-y: auto;
        }

        /* TABS */
        .store-tabs {
            display: flex; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 4px;
            margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);
        }
        .tab-btn {
            flex: 1; padding: 12px; border: none; background: transparent; color: #aaa;
            font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: 0.3s;
        }
        .tab-btn.active {
            background: #00c2ff; color: #000; box-shadow: 0 2px 10px rgba(0,194,255,0.3);
        }
        .tab-btn.active-gold {
            background: #FFD700; color: #000; box-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
        }

        /* PRODUCT CARD */
        .store-item {
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px; padding: 12px; margin-bottom: 12px;
            display: flex; gap: 12px; align-items: center;
        }
        .item-thumb {
            width: 70px; height: 70px; border-radius: 8px; object-fit: cover; background: #222;
        }
        .item-info { flex-grow: 1; overflow: hidden; }
        .item-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
        .item-meta { font-size: 12px; color: #aaa; margin-top: 4px; display: flex; align-items: center; gap: 8px; }
        .item-price { font-size: 14px; color: #00ff82; font-weight: 700; margin-top: 4px; }
        
        .item-sales { font-size: 11px; color: #FFD700; background: rgba(255, 215, 0, 0.1); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }

        .item-actions { display: flex; gap: 10px; }
        .action-icon { 
            width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1);
            display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer;
        }
        .action-icon.delete { color: #ff4d4d; background: rgba(255, 77, 77, 0.1); }

        /* CAMPAIGN CARD */
        .campaign-card {
            background: linear-gradient(145deg, rgba(255, 215, 0, 0.05), rgba(0,0,0,0));
            border: 1px solid rgba(255, 215, 0, 0.2);
            border-radius: 12px; padding: 16px; margin-bottom: 15px;
        }
        .camp-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .camp-name { font-weight: 700; font-size: 16px; color: #FFD700; }
        .camp-status { 
            font-size: 10px; text-transform: uppercase; font-weight: 800; 
            padding: 2px 8px; border-radius: 4px; background: #00ff82; color: #000;
        }
        
        .camp-metrics { display: flex; gap: 15px; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
        .metric { display: flex; flex-direction: column; }
        .metric-label { font-size: 10px; color: #aaa; text-transform: uppercase; }
        .metric-val { font-size: 14px; font-weight: 700; color: #fff; }

        .empty-state { text-align: center; padding: 40px 0; color: #555; }
        .empty-state i { font-size: 40px; margin-bottom: 10px; opacity: 0.5; }
        
        .add-btn {
            width: 100%; padding: 15px; border-radius: 12px; font-weight: 700; cursor: pointer;
            border: 1px dashed #333; background: transparent; color: #aaa; margin-top: 10px;
            transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .add-btn:hover { border-color: #00c2ff; color: #00c2ff; background: rgba(0,194,255,0.05); }
        
        /* Disabled look for locked features */
        .add-btn.locked {
            border-color: #444; color: #555; cursor: not-allowed;
        }
        .add-btn.locked:hover {
            border-color: #444; color: #555; background: transparent;
        }
      `}</style>

      <header>
        <button onClick={() => navigate('/marketplace')} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
        <h1>Gerenciar Negócios</h1>
      </header>

      <main>
        <div className="store-tabs">
            <button 
                className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`} 
                onClick={() => setActiveTab('products')}
            >
                Produtos
            </button>
            <button 
                className={`tab-btn ${activeTab === 'campaigns' ? 'active-gold' : ''}`} 
                onClick={() => setActiveTab('campaigns')}
            >
                Campanhas
            </button>
        </div>

        {loading ? (
            <div style={{textAlign:'center', color:'#555', marginTop: '50px'}}>Carregando...</div>
        ) : (
            <>
                {activeTab === 'products' && (
                    <div className="products-list animate-fade-in">
                        {products.length > 0 ? products.map(prod => (
                            <div key={prod.id} className="store-item" onClick={() => navigate(`/marketplace/product/${prod.id}`)}>
                                <img src={prod.image || 'https://via.placeholder.com/100'} className="item-thumb" />
                                <div className="item-info">
                                    <div className="item-title">{prod.title}</div>
                                    <div className="item-meta">
                                        {prod.category}
                                        <span className="item-sales"><i className="fa-solid fa-bag-shopping"></i> {prod.soldCount || 0}</span>
                                    </div>
                                    <div className="item-price">{formatCurrency(prod.price)}</div>
                                </div>
                                <div className="item-actions">
                                    <div className="action-icon delete" onClick={(e) => handleDeleteProduct(prod.id, e)}>
                                        <i className="fa-solid fa-trash"></i>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <i className="fa-solid fa-box-open"></i>
                                <p>Você ainda não publicou produtos.</p>
                            </div>
                        )}
                        
                        <button className="add-btn" onClick={() => navigate('/create-marketplace-item')}>
                            <i className="fa-solid fa-plus"></i> Publicar Novo Produto
                        </button>
                    </div>
                )}

                {activeTab === 'campaigns' && (
                    <div className="campaigns-list animate-fade-in">
                        {campaigns.length > 0 ? campaigns.map(camp => (
                            <div key={camp.id} className="campaign-card">
                                <div className="camp-header">
                                    <div className="camp-name">{camp.name}</div>
                                    <div className="camp-status">{camp.status === 'active' ? 'Ativa' : 'Pendente'}</div>
                                </div>
                                <div style={{fontSize: '13px', color: '#ddd', marginBottom: '5px'}}>
                                    {camp.creative.text.substring(0, 50)}...
                                </div>
                                <div className="camp-metrics">
                                    <div className="metric">
                                        <span className="metric-label">Orçamento</span>
                                        <span className="metric-val">{formatCurrency(camp.budget)}</span>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">Alcance</span>
                                        <span className="metric-val">{formatMetric(camp.stats?.views || 0)}</span>
                                    </div>
                                    <div className="metric">
                                        <span className="metric-label">Cliques</span>
                                        <span className="metric-val">{formatMetric(camp.stats?.clicks || 0)}</span>
                                    </div>
                                </div>
                                <button 
                                    style={{width:'100%', padding:'8px', marginTop:'15px', background:'rgba(255,77,77,0.1)', color:'#ff4d4d', border:'none', borderRadius:'6px', fontWeight:'600', cursor:'pointer'}}
                                    onClick={(e) => handleDeleteCampaign(camp.id!, e)}
                                >
                                    Encerrar Campanha
                                </button>
                            </div>
                        )) : (
                            <div className="empty-state">
                                <i className="fa-solid fa-bullhorn" style={{color: '#555'}}></i>
                                <p>Nenhuma campanha ativa.</p>
                            </div>
                        )}

                        <button 
                            className="add-btn locked" 
                            onClick={() => alert("Função em desenvolvimento. Em breve disponível.")}
                        >
                            <i className="fa-solid fa-lock"></i> Criar Nova Campanha
                        </button>
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};
