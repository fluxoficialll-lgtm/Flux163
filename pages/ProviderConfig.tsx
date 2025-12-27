
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { syncPayService } from '../services/syncPayService';
import { PaymentProviderConfig } from '../types';

interface ProviderData {
    id: string;
    name: string;
    icon: string;
    fields: { key: string; label: string; type: string; placeholder: string }[];
    isPrimary?: boolean;
    status: 'active' | 'coming_soon';
    methods: { type: 'pix' | 'card'; label: string }[];
}

export const ProviderConfig: React.FC = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>('syncpay');
  const [isLoading, setIsLoading] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  
  // Feedback States
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | null, message: string, details?: string }>({ type: null, message: '' });
  
  // Form State
  const [providerInputs, setProviderInputs] = useState<Record<string, string>>({});

  const providers: ProviderData[] = [
      {
          id: 'syncpay',
          name: 'SyncPay (Oficial)',
          icon: 'fa-bolt',
          isPrimary: true,
          status: 'active',
          methods: [
              { type: 'pix', label: 'PIX' }
          ],
          fields: [
              { key: 'clientId', label: 'Chave Pública (Client ID)', type: 'text', placeholder: 'Cole sua Chave Pública aqui' },
              { key: 'clientSecret', label: 'Chave Privada (Client Secret)', type: 'password', placeholder: 'Cole sua Chave Privada aqui' }
          ]
      },
      {
          id: 'picpay',
          name: 'PicPay',
          icon: 'fa-qrcode',
          status: 'active',
          methods: [
              { type: 'pix', label: 'PIX' },
              { type: 'card', label: 'Cartão' }
          ],
          fields: [
              { key: 'token', label: 'Token de Acesso', type: 'text', placeholder: 'Insira seu token do PicPay' },
              { key: 'sellerToken', label: 'Token de Vendedor', type: 'password', placeholder: 'Insira seu token de vendedor' }
          ]
      },
      {
          id: 'paypal',
          name: 'PayPal',
          icon: 'fa-brands fa-paypal',
          status: 'active',
          methods: [
              { type: 'pix', label: 'PIX' },
              { type: 'card', label: 'Cartão' }
          ],
          fields: [
              { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Seu Client ID do PayPal' },
              { key: 'clientSecret', label: 'Secret Key', type: 'password', placeholder: 'Sua Secret Key do PayPal' }
          ]
      },
      {
          id: 'mercadopago',
          name: 'Mercado Pago',
          icon: 'fa-hand-holding-dollar',
          status: 'coming_soon',
          methods: [
              { type: 'pix', label: 'PIX' },
              { type: 'card', label: 'Cartão' }
          ],
          fields: [] 
      }
  ];

  // Load existing config
  useEffect(() => {
      const user = authService.getCurrentUser();
      if (user) {
          const connected = new Set<string>();
          if (user.paymentConfig && user.paymentConfig.isConnected) {
              connected.add(user.paymentConfig.providerId);
          }
          if (user.paymentConfigs) {
              Object.values(user.paymentConfigs).forEach(conf => {
                  if (conf.isConnected) connected.add(conf.providerId);
              });
          }
          setConnectedProviders(connected);
      }
  }, []);
  
  const handleInputChange = (providerId: string, fieldKey: string, value: string) => {
      setProviderInputs(prev => ({
          ...prev,
          [`${providerId}_${fieldKey}`]: value
      }));
      if (feedback.type === 'error') setFeedback({ type: null, message: '' });
  };

  const handleSave = async (providerId: string, providerName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setFeedback({ type: null, message: '' });

    try {
        let config: PaymentProviderConfig;

        if (providerId === 'syncpay') {
            const clientId = providerInputs['syncpay_clientId'];
            const clientSecret = providerInputs['syncpay_clientSecret'];
            if (!clientId || !clientSecret) throw new Error("Preencha a Chave Pública e a Chave Privada.");
            await syncPayService.authenticate(clientId, clientSecret);
            config = { providerId: 'syncpay', clientId, clientSecret, isConnected: true };
        } else {
            // PicPay / PayPal generic mock simulation for saving credentials
            // In real app, you'd call specific services here
            config = { 
                providerId, 
                isConnected: true,
                clientId: providerInputs[`${providerId}_clientId`] || providerInputs[`${providerId}_token`],
                clientSecret: providerInputs[`${providerId}_clientSecret`] || providerInputs[`${providerId}_sellerToken`]
            };
        }

        await authService.updatePaymentConfig(config);
        setConnectedProviders(prev => new Set(prev).add(providerId));
        setFeedback({ type: 'success', message: `Conectado a ${providerName}!` });

        setTimeout(() => {
            setFeedback({ type: null, message: '' });
        }, 3000);

    } catch (err: any) {
        setFeedback({ 
            type: 'error', 
            message: err.message || "Falha na conexão. Verifique suas chaves.",
            details: err.details 
        });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDisconnect = async (providerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm(`Deseja desconectar do ${providerId}? Seus grupos VIP vinculados deixarão de aceitar pagamentos através deste provedor.`)) return;
      
      setIsLoading(true);
      try {
          const config: PaymentProviderConfig = {
              providerId: providerId,
              isConnected: false
          };
          await authService.updatePaymentConfig(config);
          setConnectedProviders(prev => {
              const next = new Set(prev);
              next.delete(providerId);
              return next;
          });
          setFeedback({ type: null, message: '' });
      } catch (e) {
          alert("Erro ao desconectar.");
      } finally {
          setIsLoading(false);
      }
  };

  const toggleProvider = (id: string) => {
      setExpanded(prev => prev === id ? null : id);
      setFeedback({ type: null, message: '' }); 
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/financial');
      }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        
        header {
            display:flex; align-items:center; justify-content:space-between; padding:16px;
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
        
        .provider-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            margin-bottom: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            overflow: hidden;
            transition: all 0.3s ease;
        }
        
        .provider-card.primary {
            border: 1px solid #00c2ff;
            background: rgba(0, 194, 255, 0.05);
        }
        
        .provider-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 20px;
            cursor: pointer;
            background: rgba(255,255,255,0.02);
            transition: background 0.3s;
        }
        .provider-header:hover {
            background: rgba(255,255,255,0.05);
        }

        .provider-info {
            display: flex; align-items: center; gap: 15px;
        }
        
        .provider-icon {
            width: 40px; height: 40px; border-radius: 8px;
            background: rgba(0, 194, 255, 0.1); color: #00c2ff;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
        }
        
        .provider-name {
            font-size: 16px; font-weight: 700; color: #fff;
            text-transform: uppercase; letter-spacing: 0.5px;
            display: flex; flex-direction: column;
        }

        .method-indicators {
            display: flex; gap: 10px; margin-top: 6px;
        }
        .method-item {
            display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa;
        }
        .method-dot {
            width: 6px; height: 6px; border-radius: 50%; background: #00ff82; box-shadow: 0 0 5px #00ff82;
        }

        .arrow-icon {
            color: #00c2ff;
            transition: transform 0.3s ease;
            font-size: 18px;
        }
        .arrow-icon.expanded {
            transform: rotate(180deg);
        }
        
        .provider-body {
            padding: 0 20px 20px 20px;
            border-top: 1px solid rgba(255,255,255,0.05);
            animation: slideDown 0.3s ease-out;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .input-group { margin-top: 15px; }
        .input-group label {
            display: block; font-size: 13px; color: #aaa; margin-bottom: 8px; font-weight: 500;
        }
        
        input[type="text"], input[type="password"] {
            width: 100%; padding: 12px 15px; 
            background: #111; 
            border: 1px solid #333;
            border-radius: 8px; 
            color: #fff; 
            outline: none; 
            transition: 0.3s;
            font-size: 15px;
        }
        input:focus { 
            border-color: #00c2ff; 
            box-shadow: 0 0 8px rgba(0, 194, 255, 0.2);
            background: #151515;
        }
        
        .save-btn {
            width: 100%; padding: 12px; 
            background: #00c2ff; 
            color: #000;
            border: none; 
            border-radius: 8px; 
            font-weight: 700; 
            font-size: 16px;
            cursor: pointer;
            transition: 0.3s;
            margin-top: 20px;
            box-shadow: 0 4px 10px rgba(0, 194, 255, 0.3);
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .save-btn:hover { 
            background: #0099cc; 
            box-shadow: 0 6px 15px rgba(0, 194, 255, 0.5);
        }
        .save-btn:disabled {
            opacity: 0.7; cursor: not-allowed;
        }
        .save-btn.success {
            background: #00ff82; color: #000; cursor: default;
        }

        .disconnect-btn {
            width: 100%; padding: 12px;
            background: rgba(255,77,77,0.1); color: #ff4d4d;
            border: 1px solid #ff4d4d; border-radius: 8px;
            font-weight: 700; cursor: pointer; transition: 0.3s;
            margin-top: 15px;
        }
        .disconnect-btn:hover { background: rgba(255,77,77,0.2); }

        .badge-soon {
            background: rgba(255,255,255,0.1);
            color: #aaa;
            font-size: 10px;
            padding: 3px 8px;
            border-radius: 12px;
            font-weight: 600;
            border: 1px solid rgba(255,255,255,0.2);
            margin-top: 5px;
            align-self: flex-start;
        }
        
        .coming-soon-body {
            text-align: center;
            padding: 20px 0;
            color: #888;
            font-size: 14px;
        }

        .feedback-msg {
            margin-top: 15px; padding: 12px; border-radius: 8px; font-size: 13px; text-align: left; font-weight: 500;
            display: flex; flex-direction: column; gap: 4px; animation: fadeIn 0.3s;
        }
        .feedback-msg.error {
            background: rgba(255, 77, 77, 0.1); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.3);
        }
        .feedback-msg.success {
            background: rgba(0, 255, 130, 0.1); color: #00ff82; border: 1px solid rgba(0, 255, 130, 0.3); text-align: center;
        }
        .feedback-msg.warning {
            background: rgba(255, 170, 0, 0.1); color: #ffaa00; border: 1px solid rgba(255, 170, 0, 0.3);
        }
        .feedback-details {
            font-size: 11px; opacity: 0.8; margin-top: 4px; font-family: monospace; white-space: pre-wrap;
            background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; word-break: break-all;
        }
      `}</style>

      <header>
        <button onClick={handleBack} aria-label="Voltar">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Configuração de Pagamento</h1>
        <div style={{width: '24px'}}></div>
      </header>

      <main>
        <p style={{fontSize:'13px', color:'#aaa', marginBottom:'20px', textAlign:'center'}}>
            Gerencie sua conexão com o provedor de pagamento.
        </p>

        {providers.map((provider) => {
            const isExpanded = expanded === provider.id;
            const isSoon = provider.status === 'coming_soon';
            const isConnected = connectedProviders.has(provider.id);

            return (
                <div key={provider.id} className={`provider-card ${provider.isPrimary ? 'primary' : ''}`} style={{ opacity: isSoon ? 0.8 : 1 }}>
                    <div className="provider-header" onClick={() => toggleProvider(provider.id)}>
                        <div className="provider-info">
                            <div className="provider-icon" style={{ filter: isSoon ? 'grayscale(100%)' : 'none' }}>
                                <i className={`fa-solid ${provider.icon}`}></i>
                            </div>
                            <div className="provider-name">
                                {provider.name}
                                <div className="method-indicators">
                                    {provider.methods.map((m, i) => (
                                        <div className="method-item" key={i}>
                                            <div className="method-dot"></div>
                                            {m.label}
                                        </div>
                                    ))}
                                </div>
                                {isSoon && <span className="badge-soon">Em Breve</span>}
                            </div>
                        </div>
                        <i className={`fa-solid fa-chevron-down arrow-icon ${isExpanded ? 'expanded' : ''}`}></i>
                    </div>
                    
                    {isExpanded && (
                        <div className="provider-body">
                            {isSoon ? (
                                <div className="coming-soon-body">
                                    <i className="fa-solid fa-person-digging" style={{fontSize: '24px', marginBottom: '10px', display: 'block'}}></i>
                                    Integração em desenvolvimento. <br/>
                                    Disponível nas próximas atualizações.
                                </div>
                            ) : (
                                <>
                                    {isConnected ? (
                                        <div style={{textAlign:'center', padding:'10px'}}>
                                            <div className="feedback-msg success" style={{justifyContent:'center', marginBottom:'15px'}}>
                                                <i className="fa-solid fa-circle-check"></i> {provider.name} Conectado
                                            </div>
                                            <p style={{fontSize:'13px', color:'#aaa', marginBottom:'10px'}}>
                                                Sua conta está configurada para receber pagamentos.
                                            </p>
                                            <button className="disconnect-btn" onClick={(e) => handleDisconnect(provider.id, e)} disabled={isLoading}>
                                                {isLoading ? '...' : 'Desconectar Provedor'}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {provider.fields.map((field, idx) => (
                                                <div className="input-group" key={idx}>
                                                    <label>{field.label}</label>
                                                    <input 
                                                        type={field.type} 
                                                        placeholder={field.placeholder} 
                                                        value={providerInputs[`${provider.id}_${field.key}`] || ''}
                                                        onChange={(e) => handleInputChange(provider.id, field.key, e.target.value)}
                                                    />
                                                </div>
                                            ))}
                                            
                                            <button 
                                                className={`save-btn ${feedback.type === 'success' ? 'success' : ''}`}
                                                onClick={(e) => handleSave(provider.id, provider.name, e)} 
                                                disabled={isLoading || feedback.type === 'success'}
                                            >
                                                {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 
                                                 (feedback.type === 'success' ? <i className="fa-solid fa-check"></i> : <i className="fa-solid fa-plug"></i>)
                                                } 
                                                {isLoading ? ' Verificando...' : (feedback.type === 'success' ? ' Conectado!' : ' Conectar Conta')}
                                            </button>

                                            {feedback.type && (
                                                <div className={`feedback-msg ${feedback.type}`}>
                                                    <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : (feedback.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check')}`}></i>
                                                        <strong>{feedback.message}</strong>
                                                    </div>
                                                    {feedback.details && <div className="feedback-details">{feedback.details}</div>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            );
        })}
      </main>
    </div>
  );
};
