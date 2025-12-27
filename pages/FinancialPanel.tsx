
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { syncPayService } from '../services/syncPayService';
import { trackingService } from '../services/trackingService';
import { AffiliateStats, ReferredSeller, AffiliateSale } from '../types';

export const FinancialPanel: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('Disponível');
  const [isConnected, setIsConnected] = useState(false);
  const [revenue, setRevenue] = useState(0); 
  const [walletBalance, setWalletBalance] = useState(0); 
  const [displayedRevenue, setDisplayedRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // Affiliate State
  const [affiliateStats, setAffiliateStats] = useState<AffiliateStats | null>(null);
  const [showSellers, setShowSellers] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);

  // Affiliate Link Generator State
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [utmSource, setUtmSource] = useState('facebook');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // Breakdown values for main card
  const [ownSalesValue, setOwnSalesValue] = useState(0);
  const [affiliateValue, setAffiliateValue] = useState(0);

  // Marketing Settings State
  const [pixelId, setPixelId] = useState('');
  const [pixelToken, setPixelToken] = useState('');
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);

  // Withdrawal States
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('CPF');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccessId, setWithdrawSuccessId] = useState('');

  const filters = ['Disponível', 'Hoje', 'Ontem', '7d', '30d', '180d'];

  useEffect(() => {
      const loadData = async () => {
          const user = authService.getCurrentUser();
          if (user) {
              setIsConnected(!!user.paymentConfig?.isConnected);
              
              // Load marketing config
              if (user.marketingConfig) {
                  setPixelId(user.marketingConfig.pixelId || '');
                  setPixelToken(user.marketingConfig.pixelToken || '');
              }

              if (user.paymentConfig?.isConnected) {
                  try {
                      const balance = await syncPayService.getBalance(user.email);
                      setWalletBalance(balance);

                      const transactions = await syncPayService.getTransactions(user.email);
                      setAllTransactions(transactions);

                      const affStats = await syncPayService.getAffiliateStats(user.email);
                      setAffiliateStats(affStats);

                  } catch (e) {
                      console.error("Erro ao buscar dados financeiros", e);
                  }
              }
          }
          setLoading(false);
      };
      loadData();
  }, []);

  useEffect(() => {
      calculateRevenue();
  }, [selectedFilter, allTransactions, walletBalance, affiliateStats]);

  useEffect(() => {
      let start = displayedRevenue;
      const end = revenue;
      if (start === end) return;
      const duration = 1000;
      const startTime = performance.now();
      const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 4);
          const currentVal = start + (end - start) * ease;
          setDisplayedRevenue(currentVal);
          if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
  }, [revenue]);

  const calculateRevenue = () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const oneDay = 24 * 60 * 60 * 1000;

      const getFilterTimestamp = (filter: string) => {
          switch(filter) {
              case 'Hoje': return startOfDay;
              case 'Ontem': return startOfDay - oneDay;
              case '7d': return now.getTime() - (7 * oneDay);
              case '30d': return now.getTime() - (30 * oneDay);
              case '180d': return now.getTime() - (180 * oneDay);
              default: return 0;
          }
      };

      const ts = getFilterTimestamp(selectedFilter);

      const filteredOwn = allTransactions.filter(tx => {
          const status = (tx.status || '').toLowerCase();
          const isPaid = ['paid', 'completed', 'approved', 'settled'].includes(status);
          if (!isPaid) return false;
          const txDate = new Date(tx.created_at || tx.createdAt || 0).getTime();
          if (selectedFilter === 'Ontem') {
              return txDate >= ts && txDate < startOfDay;
          }
          return txDate >= ts;
      });

      const ownTotal = filteredOwn.reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);

      const affCommissions = affiliateStats?.recentSales.filter(sale => {
          const sDate = sale.timestamp;
          if (selectedFilter === 'Ontem') {
              return sDate >= ts && sDate < startOfDay;
          }
          return sDate >= ts;
      }).reduce((acc, curr) => acc + curr.commission, 0) || 0;

      if (selectedFilter === 'Disponível') {
          setRevenue(walletBalance);
          setAffiliateValue(affiliateStats?.totalEarned || 0);
          setOwnSalesValue(Math.max(0, walletBalance - (affiliateStats?.totalEarned || 0)));
      } else {
          setRevenue(ownTotal + affCommissions);
          setOwnSalesValue(ownTotal);
          setAffiliateValue(affCommissions);
      }
  };

  const handleSaveMarketing = async () => {
      const user = authService.getCurrentUser();
      if (!user) return;
      
      setIsSavingMarketing(true);
      try {
          await authService.completeProfile(user.email, {
              ...user.profile!,
              // @ts-ignore - Temporary until types updated
              marketingConfig: { pixelId, pixelToken }
          } as any);
          alert("Configurações de marketing salvas!");
      } catch (e) {
          alert("Erro ao salvar.");
      } finally {
          setIsSavingMarketing(false);
      }
  };

  const handleGenerateRecruitmentLink = () => {
      const email = authService.getCurrentUserEmail();
      if (!email) return;

      const normalizedEmail = email.toLowerCase().trim();
      // O link base para recrutamento é a raiz do site (Login/Register)
      const baseUrl = `${window.location.origin}/`;
      
      const params = {
          ref: normalizedEmail,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign || 'recrutamento_vendedores'
      };

      const finalLink = trackingService.generateTrackingLink(baseUrl, params);
      setGeneratedLink(finalLink);
  };

  const handleCopyGeneratedLink = () => {
      if (!generatedLink) return;
      navigator.clipboard.writeText(generatedLink).then(() => {
          alert("Link de recrutamento copiado!");
          setIsTrackingModalOpen(false);
      });
  };

  const handleCopyAffiliateLink = () => {
      const email = authService.getCurrentUserEmail();
      if (!email) return;
      const normalizedEmail = email.toLowerCase().trim();
      const link = `${window.location.origin}/?ref=${encodeURIComponent(normalizedEmail)}`;
      navigator.clipboard.writeText(link).then(() => {
          setIsCopyingLink(true);
          setTimeout(() => setIsCopyingLink(false), 2000);
      });
  };

  const refreshData = async () => {
      setLoading(true);
      const user = authService.getCurrentUser();
      if (user && user.paymentConfig?.isConnected) {
          try {
              const balance = await syncPayService.getBalance(user.email);
              setWalletBalance(balance);
              const transactions = await syncPayService.getTransactions(user.email);
              setAllTransactions(transactions);
              const affStats = await syncPayService.getAffiliateStats(user.email);
              setAffiliateStats(affStats);
          } catch (e) {}
      }
      setLoading(false);
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) navigate(-1);
      else navigate('/settings');
  };

  const openWithdrawModal = () => {
      if (!isConnected) {
          navigate('/financial/providers');
          return;
      }
      setWithdrawError('');
      setWithdrawSuccessId('');
      setWithdrawAmount('');
      setIsWithdrawModalOpen(true);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setWithdrawError('');
      const amount = parseFloat(withdrawAmount.replace(/\./g, '').replace(',', '.'));
      if (isNaN(amount) || amount < 5) {
          setWithdrawError("O valor mínimo para saque é R$ 5,00.");
          return;
      }
      if (amount > walletBalance) {
          setWithdrawError("Saldo insuficiente.");
          return;
      }
      if (!pixKey.trim()) {
          setWithdrawError("Informe sua chave PIX.");
          return;
      }
      if (!window.confirm(`Confirmar saque de R$ ${amount.toFixed(2)} para a chave ${pixKey}?`)) return;

      setIsWithdrawing(true);
      try {
          const user = authService.getCurrentUser();
          if (!user) throw new Error("Usuário não identificado");
          const response = await syncPayService.requestWithdrawal(user, amount, pixKey, pixKeyType);
          setWithdrawSuccessId(response.transactionId || 'wd_success');
          setIsWithdrawing(false);
          setTimeout(() => refreshData(), 1500);
      } catch (err: any) {
          setWithdrawError(err.message || "Falha no processamento.");
          setIsWithdrawing(false);
      }
  };

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-y-auto overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        header {
            display:flex; align-items:center; justify-content:space-between; padding:16px;
            background: #0c0f14; position:fixed; width:100%; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); top: 0; height: 65px;
        }
        header button { background:none; border:none; color:#fff; font-size:24px; cursor:pointer; padding-right: 15px; }
        header h1 { font-size:20px; font-weight:600; }
        main { padding-top: 80px; padding-bottom: 40px; width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px; }
        
        .flux-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); position: relative; }
        .refresh-btn { position: absolute; top: 20px; right: 20px; background: rgba(0,194,255,0.1); color: #00c2ff; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; }
        
        .balance-label { font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .balance-amount { font-size: 42px; font-weight: 800; color: #00c2ff; margin-bottom: 10px; text-shadow: 0 0 15px rgba(0, 194, 255, 0.3); display: flex; align-items: baseline; gap: 5px; }
        .balance-amount span { font-size: 20px; font-weight: 600; color: #fff; }

        .breakdown { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
        .breakdown-item { display: flex; justify-content: space-between; font-size: 13px; color: #ccc; }
        .breakdown-item span:first-child { display: flex; align-items: center; gap: 6px; }
        .dot-sep { width: 4px; height: 4px; border-radius: 50%; background: #555; }

        .filter-container { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; scrollbar-width: none; }
        .filter-chip { padding: 8px 16px; border-radius: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.3s; white-space: nowrap; }
        .filter-chip.active { background: rgba(0, 194, 255, 0.15); border-color: #00c2ff; color: #00c2ff; }
        
        .withdraw-btn { width: 100%; padding: 14px; background: #00ff82; color: #0c0f14; font-size: 16px; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .connect-btn { width: 100%; padding: 14px; background: #00c2ff; color: #0c0f14; font-size: 16px; font-weight: 700; border: none; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
        
        .status-indicator { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: rgba(255, 77, 77, 0.1); color: #ff4d4d; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
        .status-indicator.connected { background: rgba(0, 255, 130, 0.1); color: #00ff82; }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .affiliate-card { border: 1px solid #FFD700; background: rgba(255, 215, 0, 0.05); display: flex; flex-direction: column; gap: 12px; }
        .affiliate-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .affiliate-card-header h3 { font-size: 14px; color: #FFD700; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .copy-link-btn { background: #FFD700; color: #000; border: none; border-radius: 12px; padding: 16px; font-weight: 800; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.3s; box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2); }
        .copy-link-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(255, 215, 0, 0.3); }
        
        .tracking-gen-btn { background: transparent; border: 1px dashed #FFD700; color: #FFD700; border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; transition: 0.3s; margin-top: 5px; }
        .tracking-gen-btn:hover { background: rgba(255, 215, 0, 0.1); border-style: solid; }

        .referred-sellers-btn { background: transparent; border: 1px solid rgba(255, 215, 0, 0.3); color: #FFD700; border-radius: 12px; padding: 12px; font-weight: 600; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; transition: 0.3s; }
        .referred-sellers-btn:hover { background: rgba(255, 215, 0, 0.1); }

        .marketing-section { margin-top: 15px; border-top: 1px solid rgba(255, 215, 0, 0.2); padding-top: 15px; }
        .marketing-section label { display: block; font-size: 11px; color: #aaa; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
        .marketing-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255, 215, 0, 0.3); padding: 10px; border-radius: 8px; color: #fff; font-size: 13px; margin-bottom: 12px; outline: none; }
        .marketing-input:focus { border-color: #FFD700; }
        .save-marketing-btn { width: 100%; background: rgba(255, 215, 0, 0.1); border: 1px solid #FFD700; color: #FFD700; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; }

        .list-container { max-height: 250px; overflow-y: auto; padding-right: 5px; margin-top: 10px; animation: fadeIn 0.3s; }
        .list-container::-webkit-scrollbar { width: 4px; }
        .list-container::-webkit-scrollbar-thumb { background: rgba(255, 215, 0, 0.2); border-radius: 2px; }

        .seller-list-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,215,0,0.1); }
        .seller-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .seller-avatar { width: 32px; height: 32px; border-radius: 50%; background: #333; object-fit: cover; flex-shrink: 0; }
        .seller-info-text { flex: 1; min-width: 0; }
        .seller-name { font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .metric-label { font-size: 10px; color: #aaa; }

        /* Modal Generico */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); }
        .modal-content { background: #1a1e26; border-radius: 24px; padding: 30px; width: 90%; max-width: 400px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.6); position: relative; }
        
        .modal-header { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 20px; text-align: center; }
        .modal-input-group { margin-bottom: 15px; }
        .modal-input-group label { display: block; font-size: 12px; color: #aaa; margin-bottom: 5px; font-weight: 600; text-transform: uppercase; }
        .modal-input-group select, .modal-input-group input { width: 100%; padding: 12px; background: #0c0f14; border: 1px solid #333; color: #fff; border-radius: 10px; outline: none; font-size: 14px; }
        .modal-input-group input:focus { border-color: #FFD700; }
        
        .gen-btn { width: 100%; padding: 14px; background: #FFD700; color: #000; font-weight: 800; border-radius: 12px; border: none; cursor: pointer; margin-top: 10px; transition: 0.3s; }
        .gen-btn:hover { transform: translateY(-2px); }
        
        .link-result-box { margin-top: 15px; background: #000; padding: 12px; border-radius: 10px; word-break: break-all; font-family: monospace; font-size: 11px; color: #00ff82; border: 1px dashed #333; max-height: 100px; overflow-y: auto; }
        .copy-gen-btn { width: 100%; padding: 12px; background: #00ff82; color: #000; font-weight: 800; border-radius: 12px; border: none; cursor: pointer; margin-top: 10px; }
        
        .close-modal-x { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header>
        <button onClick={handleBack} aria-label="Voltar"><i className="fa-solid fa-arrow-left"></i></button>
        <h1>Painel Financeiro</h1>
        <div style={{width: '24px'}}></div>
      </header>

      <main>
        {/* CARD 1: SALDO */}
        <div className="flux-card">
            <button className="refresh-btn" onClick={refreshData} disabled={loading}><i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i></button>
            <div className="balance-label"><i className="fa-solid fa-chart-line mr-2"></i> {selectedFilter === 'Disponível' ? 'Saldo Total' : `Faturamento (${selectedFilter})`}</div>
            <div className="balance-amount"><span>R$</span> {displayedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            
            <div className="breakdown">
                <div className="breakdown-item">
                    <span><div className="dot-sep" style={{background:'#00c2ff'}}></div> R$ {ownSalesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span>Vendas próprias</span>
                </div>
                <div className="breakdown-item">
                    <span><div className="dot-sep" style={{background:'#FFD700'}}></div> R$ {affiliateValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span>Comissões de afiliados</span>
                </div>
            </div>

            <div className="filter-container">
                {filters.map(f => (
                    <button key={f} className={`filter-chip ${selectedFilter === f ? 'active' : ''}`} onClick={() => setSelectedFilter(f)}>{f}</button>
                ))}
            </div>
            <button className="withdraw-btn" onClick={openWithdrawModal}><i className="fa-solid fa-money-bill-transfer"></i> Solicitar Saque</button>
        </div>

        {/* CARD 2: AFILIADOS */}
        {isConnected && (
            <div className="flux-card affiliate-card">
                <div className="affiliate-card-header">
                    <h3><i className="fa-solid fa-users-rays mr-2"></i> Programa de Afiliados</h3>
                    <div className="bg-[#FFD700] text-black px-2 py-0.5 rounded text-[10px] font-bold">MASTER</div>
                </div>

                <button className="copy-link-btn" onClick={handleCopyAffiliateLink}>
                    <i className={`fa-solid ${isCopyingLink ? 'fa-check' : 'fa-link'}`}></i>
                    {isCopyingLink ? 'Link Copiado!' : 'Link de Recrutamento Direto'}
                </button>

                <button className="tracking-gen-btn" onClick={() => setIsTrackingModalOpen(true)}>
                    <i className="fa-solid fa-bullseye"></i> Gerar Link Rastreável (UTM)
                </button>

                <div className="marketing-section">
                    <label><i className="fa-solid fa-rocket mr-1"></i> Configurações de Marketing</label>
                    <input 
                        type="text" 
                        placeholder="Meta Pixel ID (Ex: 123456789)" 
                        className="marketing-input"
                        value={pixelId}
                        onChange={(e) => setPixelId(e.target.value)}
                    />
                    <input 
                        type="text" 
                        placeholder="Token de Acesso CAPI (EAAB...)" 
                        className="marketing-input"
                        value={pixelToken}
                        onChange={(e) => setPixelToken(e.target.value)}
                    />
                    <button 
                        className="save-marketing-btn" 
                        onClick={handleSaveMarketing}
                        disabled={isSavingMarketing}
                    >
                        {isSavingMarketing ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
                    </button>
                    <p style={{fontSize: '9px', color: '#888', marginTop: '8px', fontStyle: 'italic'}}>
                        * Use estas chaves para rastrear o recrutamento de novos vendedores (PageView, Lead e Registro).
                    </p>
                </div>

                <button className="referred-sellers-btn" style={{marginTop: '10px'}} onClick={() => setShowSellers(!showSellers)}>
                    <i className={`fa-solid ${showSellers ? 'fa-chevron-up' : 'fa-users'}`}></i>
                    Vendedores Indicados ({affiliateStats?.referredSellers.length || 0})
                </button>

                {showSellers && (
                    <div className="list-container">
                        {affiliateStats?.referredSellers.length ? affiliateStats.referredSellers.map((seller, idx) => (
                            <div key={idx} className="seller-list-item">
                                <div className="seller-info">
                                    {seller.avatar ? <img src={seller.avatar} className="seller-avatar" alt="Avatar" /> : <div className="seller-avatar flex items-center justify-center text-[10px]"><i className="fa-solid fa-user"></i></div>}
                                    <div className="seller-info-text">
                                        <div className="seller-name">
                                            @{seller.username}
                                        </div>
                                        <div style={{fontSize: '10px', color: '#aaa'}}>{seller.salesCount} vendas realizadas</div>
                                    </div>
                                </div>
                                <div style={{textAlign: 'right'}}>
                                    <div style={{fontSize:'12px', color: seller.totalGenerated > 0 ? '#00ff82' : '#555', fontWeight:'700'}}>R$ {seller.totalGenerated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                    <div className="metric-label">comissão gerada</div>
                                </div>
                            </div>
                        )) : <p className="empty-msg text-center py-4 text-gray-500 text-sm italic">Nenhum vendedor indicado ainda.</p>}
                    </div>
                )}
            </div>
        )}

        <div className="flux-card">
            <div className="provider-title" style={{fontSize:'16px', fontWeight:700, marginBottom:'15px'}}><i className="fa-solid fa-plug text-[#00c2ff] mr-2"></i> Gateway de Pagamento</div>
            <div className={`status-indicator ${isConnected ? 'connected' : ''}`}><div className="dot"></div>{isConnected ? 'SyncPay Conectado' : 'Desconectado'}</div>
            <button className="connect-btn" onClick={() => navigate('/financial/providers')}>{isConnected ? 'Gerenciar Conexão' : 'Conectar SyncPay'}</button>
        </div>
      </main>

      {/* MODAL GERADOR DE LINK RASTREAVEL */}
      {isTrackingModalOpen && (
          <div className="modal-overlay" onClick={() => setIsTrackingModalOpen(false)}>
              <div className="modal-content animate-pop-in" onClick={e => e.stopPropagation()}>
                  <button className="close-modal-x" onClick={() => setIsTrackingModalOpen(false)}>&times;</button>
                  <h3 className="modal-header">
                      <i className="fa-solid fa-link text-[#FFD700] mr-2"></i> Gerar Link de Afiliado
                  </h3>
                  
                  <div className="modal-input-group">
                      <label>Origem (Source)</label>
                      <select value={utmSource} onChange={e => setUtmSource(e.target.value)}>
                          <option value="facebook">Facebook Ads</option>
                          <option value="instagram">Instagram Bio</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">YouTube</option>
                          <option value="email">Email Marketing</option>
                          <option value="whatsapp">WhatsApp</option>
                      </select>
                  </div>
                  
                  <div className="modal-input-group">
                      <label>Mídia (Medium)</label>
                      <select value={utmMedium} onChange={e => setUtmMedium(e.target.value)}>
                          <option value="cpc">CPC (Pago)</option>
                          <option value="organic">Orgânico</option>
                          <option value="social">Social</option>
                          <option value="referral">Referência</option>
                      </select>
                  </div>

                  <div className="modal-input-group">
                      <label>Nome da Campanha (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: lancamento_junho" 
                        value={utmCampaign} 
                        onChange={e => setUtmCampaign(e.target.value)} 
                      />
                  </div>

                  <button className="gen-btn" onClick={handleGenerateRecruitmentLink}>GERAR LINK</button>

                  {generatedLink && (
                      <div className="animate-fade-in">
                          <div className="link-result-box">{generatedLink}</div>
                          <button className="copy-gen-btn" onClick={handleCopyGeneratedLink}>
                              <i className="fa-solid fa-copy mr-2"></i> COPIAR LINK
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* MODAL DE SAQUE */}
      {isWithdrawModalOpen && (
          <div className="modal-overlay" onClick={() => setIsWithdrawModalOpen(false)}>
              <div className="modal-content animate-pop-in" onClick={e => e.stopPropagation()}>
                  <h3 style={{fontSize:'18px', fontWeight:700, marginBottom:'15px'}}>Solicitar Saque</h3>
                  <div className="flex flex-col gap-3">
                      <input 
                        type="text" 
                        placeholder="Valor (R$)" 
                        className="p-3 bg-black/20 border border-white/10 rounded-lg text-white"
                        value={withdrawAmount}
                        onChange={e => setWithdrawAmount(e.target.value)}
                      />
                      <input 
                        type="text" 
                        placeholder="Chave PIX" 
                        className="p-3 bg-black/20 border border-white/10 rounded-lg text-white"
                        value={pixKey}
                        onChange={e => setPixKey(e.target.value)}
                      />
                      <button className="withdraw-btn" onClick={handleWithdrawSubmit} disabled={isWithdrawing}>
                          {isWithdrawing ? 'Processando...' : 'Confirmar Saque'}
                      </button>
                      {withdrawError && <p className="text-red-400 text-xs text-center">{withdrawError}</p>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
