
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { NotificationSettings as INotificationSettings } from '../types';

export const NotificationSettings: React.FC = () => {
  const navigate = useNavigate();
  
  const defaultSettings: INotificationSettings = {
      pauseAll: false,
      likes: true,
      comments: true,
      followers: true,
      mentions: true,
      messages: true,
      groups: true,
      marketplace: true,
      emailUpdates: true,
      emailDigest: true
  };

  const [settings, setSettings] = useState<INotificationSettings>(defaultSettings);

  useEffect(() => {
      const user = authService.getCurrentUser();
      if (user && user.notificationSettings) {
          // Merge with default to ensure new fields are present
          setSettings({ ...defaultSettings, ...user.notificationSettings });
      }
  }, []);

  const toggleSetting = (key: keyof INotificationSettings) => {
      const newSettings = { ...settings, [key]: !settings[key] };
      setSettings(newSettings);
      authService.updateNotificationSettings(newSettings);
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/settings');
      }
  };

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden">
        <style>{`
            * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
            header {
                display:flex; align-items:center; padding:16px;
                background: #0c0f14; position:fixed; width:100%; top:0; z-index:10;
                border-bottom:1px solid rgba(255,255,255,0.1); height: 65px;
            }
            header .back-btn {
                background:none; border:none; color:#fff; font-size:24px; cursor:pointer; padding-right: 15px;
            }
            header h1 { font-size:20px; font-weight:600; }
            
            main { 
                padding-top: 85px; padding-bottom: 40px; width: 100%; max-width: 600px; 
                margin: 0 auto; padding-left: 20px; padding-right: 20px;
                overflow-y: auto; flex-grow: 1; -webkit-overflow-scrolling: touch;
            }
            
            .settings-section {
                background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden;
                border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;
            }
            
            .setting-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .setting-row:last-child { border-bottom: none; }
            
            .label-title { font-size: 16px; font-weight: 500; color: #fff; }
            .label-desc { font-size: 13px; color: #888; margin-top: 2px; }
            
            /* Switch */
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 24px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: #00c2ff; }
            input:checked + .slider:before { transform: translateX(20px); }
            
            .section-title {
                font-size: 13px; color: #00c2ff; margin-bottom: 10px; text-transform: uppercase; font-weight: 700; margin-top: 25px; padding-left: 5px;
            }
            .section-title:first-of-type { margin-top: 10px; }

            .info-text {
                font-size: 12px; color: #666; padding: 0 5px; margin-top: -10px; margin-bottom: 20px;
            }
        `}</style>

        <header>
            <button onClick={handleBack} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
            <h1>Notificações</h1>
        </header>

        <main>
            <div className="settings-section">
                <div className="setting-row">
                    <div>
                        <div className="label-title">Pausar Tudo</div>
                        <div className="label-desc">Desativar temporariamente todos os alertas push.</div>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.pauseAll} onChange={() => toggleSetting('pauseAll')} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section-title">Social e Feed</div>
            <div className="settings-section" style={{opacity: settings.pauseAll ? 0.5 : 1, pointerEvents: settings.pauseAll ? 'none' : 'auto'}}>
                <div className="setting-row">
                    <div className="label-title">Curtidas</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.likes} onChange={() => toggleSetting('likes')} />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <div className="label-title">Comentários</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.comments} onChange={() => toggleSetting('comments')} />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <div className="label-title">Novos Seguidores</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.followers} onChange={() => toggleSetting('followers')} />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <div className="label-title">Menções (@)</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.mentions} onChange={() => toggleSetting('mentions')} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section-title">Comunicação</div>
            <div className="settings-section" style={{opacity: settings.pauseAll ? 0.5 : 1, pointerEvents: settings.pauseAll ? 'none' : 'auto'}}>
                <div className="setting-row">
                    <div className="label-title">Mensagens Diretas</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.messages} onChange={() => toggleSetting('messages')} />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <div className="label-title">Grupos e Convites</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.groups} onChange={() => toggleSetting('groups')} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section-title">Negócios</div>
            <div className="settings-section" style={{opacity: settings.pauseAll ? 0.5 : 1, pointerEvents: settings.pauseAll ? 'none' : 'auto'}}>
                <div className="setting-row">
                    <div className="label-title">Marketplace e Vendas</div>
                    <div className="label-desc">Alertas de vendas, perguntas e ofertas.</div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.marketplace} onChange={() => toggleSetting('marketplace')} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="section-title">Preferências de E-mail</div>
            <div className="settings-section">
                <div className="setting-row">
                    <div>
                        <div className="label-title">Novidades e Dicas</div>
                        <div className="label-desc">Notícias sobre o Flux e dicas de uso.</div>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.emailUpdates} onChange={() => toggleSetting('emailUpdates')} />
                        <span className="slider"></span>
                    </label>
                </div>
                <div className="setting-row">
                    <div>
                        <div className="label-title">Resumo de Atividades</div>
                        <div className="label-desc">E-mail com o que você perdeu.</div>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.emailDigest} onChange={() => toggleSetting('emailDigest')} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>
            <p className="info-text">
                * E-mails importantes de segurança, recuperação de senha e confirmação de compras não podem ser desativados.
            </p>
        </main>
    </div>
  );
};
