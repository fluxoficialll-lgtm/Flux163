
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { syncPayService } from '../services/syncPayService';

export const VipSalesHistory: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [sales, setSales] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
      const loadData = async () => {
          const user = authService.getCurrentUser();
          if (!user || !id) {
              setLoading(false);
              return;
          }

          const group = groupService.getGroupById(id);
          if (group) setGroupName(group.name);

          try {
              // 1. Buscar transações reais do SyncPay
              const transactions = await syncPayService.getTransactions(user.email);
              
              // 2. Filtrar para este grupo específico
              // Heurística: Verificar se a descrição contém o nome do grupo (padrão do createPayment)
              // ou se existe um metadado groupId (se suportado futuramente)
              const filtered = transactions.filter(t => {
                  const desc = (t.description || '').toLowerCase();
                  const gName = (group?.name || '').toLowerCase();
                  // Verifica correspondência de nome ou ID se disponível
                  return t.groupId === id || (gName && desc.includes(gName));
              });

              // 3. Ordenar por data (mais recente primeiro)
              filtered.sort((a, b) => {
                  const dateA = new Date(a.created_at || a.createdAt || a.date_created || 0).getTime();
                  const dateB = new Date(b.created_at || b.createdAt || b.date_created || 0).getTime();
                  return dateB - dateA;
              });

              setSales(filtered);

              // 4. Calcular Total Faturado (Apenas Aprovados)
              const total = filtered.reduce((acc, curr) => {
                  const status = (curr.status || '').toLowerCase();
                  if (['paid', 'completed', 'approved', 'settled'].includes(status)) {
                      return acc + (parseFloat(curr.amount) || 0);
                  }
                  return acc;
              }, 0);

              setTotalRevenue(total);

          } catch (e) {
              console.error("Erro ao carregar histórico:", e);
          } finally {
              setLoading(false);
          }
      };

      loadData();
  }, [id]);

  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      try {
          return new Date(dateStr).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', year: '2-digit',
              hour: '2-digit', minute: '2-digit'
          });
      } catch {
          return dateStr;
      }
  };

  const getStatusLabel = (status?: string) => {
      const s = (status || '').toLowerCase();
      if (['paid', 'completed', 'approved', 'settled'].includes(s)) return 'Aprovado';
      if (['pending', 'processing', 'created'].includes(s)) return 'Pendente';
      if (['expired', 'cancelled', 'failed'].includes(s)) return 'Expirado';
      return s || 'Desconhecido';
  };

  const getStatusClass = (status?: string) => {
      const s = (status || '').toLowerCase();
      if (['paid', 'completed', 'approved', 'settled'].includes(s)) return 'approved';
      if (['pending', 'processing', 'created'].includes(s)) return 'pending';
      return 'failed';
  };

  const getPayerName = (sale: any) => {
      if (sale.payer && sale.payer.name) return sale.payer.name;
      if (sale.payer_email) return sale.payer_email.split('@')[0];
      return 'Cliente Desconhecido';
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        
        header {
            display:flex; align-items:center; padding:16px;
            background: #0c0f14; position:fixed; width:100%; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); top: 0; height: 65px;
        }
        header button {
            background:none; border:none; color:#fff; font-size:24px; cursor:pointer;
            transition:0.3s; padding-right: 15px;
        }
        header h1 { font-size:20px; font-weight:600; }
        
        main {
            padding-top: 90px; padding-bottom: 40px;
            width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px;
        }

        .sales-summary {
            background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3);
            border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: center;
        }
        .total-label { font-size: 14px; color: #FFD700; text-transform: uppercase; letter-spacing: 1px; }
        .total-amount { font-size: 32px; font-weight: 800; color: #fff; margin-top: 5px; }

        .sale-item {
            background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px;
            margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .sale-info h3 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: #fff; }
        .sale-info p { font-size: 11px; color: #aaa; }
        
        .sale-value { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
        .amount { font-size: 16px; font-weight: 700; color: #00ff82; }
        
        .status { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(255,255,255,0.1); display: inline-block; margin-top: 4px; font-weight: 600; text-transform: uppercase; }
        .status.pending { color: #ffaa00; background: rgba(255,170,0,0.15); }
        .status.approved { color: #00ff82; background: rgba(0,255,130,0.15); }
        .status.failed { color: #ff4d4d; background: rgba(255,77,77,0.15); }

        .loading-container { text-align: center; color: #777; margin-top: 50px; }
        .empty-state { text-align: center; color: #777; padding: 30px; font-size: 14px; }
      `}</style>

      <header>
        <button onClick={() => navigate(-1)} aria-label="Voltar">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Histórico de Vendas</h1>
      </header>

      <main>
        <div className="sales-summary">
            <div className="total-label">Total Faturado</div>
            <div className="total-amount">
                {loading ? '...' : `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </div>
            <p style={{fontSize: '12px', color: '#aaa', marginTop: '5px'}}>
                Grupo: {groupName || 'Carregando...'}
            </p>
        </div>

        <h3 style={{marginBottom: '15px', color: '#aaa', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700'}}>Últimas Transações</h3>

        {loading ? (
            <div className="loading-container">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                <p>Buscando dados...</p>
            </div>
        ) : sales.length > 0 ? (
            sales.map((sale, idx) => (
                <div key={sale.id || idx} className="sale-item">
                    <div className="sale-info">
                        <h3>{getPayerName(sale)}</h3>
                        <p>{formatDate(sale.created_at || sale.createdAt || sale.date_created)}</p>
                    </div>
                    <div className="sale-value">
                        <div className="amount">
                            R$ {parseFloat(sale.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className={`status ${getStatusClass(sale.status)}`}>
                            {getStatusLabel(sale.status)}
                        </div>
                    </div>
                </div>
            ))
        ) : (
            <div className="empty-state">
                <i className="fa-solid fa-receipt text-4xl mb-3 opacity-30"></i>
                <p>Nenhuma venda registrada para este grupo ainda.</p>
            </div>
        )}
      </main>
    </div>
  );
};
