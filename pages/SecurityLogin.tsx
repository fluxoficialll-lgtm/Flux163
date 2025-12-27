
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { db } from '@/database';
import { SecuritySettings as ISecuritySettings, UserSession } from '../types';

export const SecurityLogin: React.FC = () => {
  const navigate = useNavigate();
  
  const [settings, setSettings] = useState<ISecuritySettings>({
      saveLoginInfo: true
  });

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<UserSession[]>([]);

  useEffect(() => {
      const user = authService.getCurrentUser();
      if (user && user.securitySettings) {
          setSettings(user.securitySettings);
      }
      
      // Load sessions initial
      setSessions(authService.getUserSessions());

      // Subscribe to user changes to update sessions in real-time
      const unsubscribe = db.subscribe('users', () => {
          setSessions(authService.getUserSessions());
      });
      return () => unsubscribe();
  }, []);

  const toggleSetting = (key: keyof ISecuritySettings) => {
      const newSettings = { ...settings, [key]: !settings[key] };
      setSettings(newSettings);
      authService.updateSecuritySettings(newSettings);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessMsg('');
      setLoading(true);

      if (newPassword.length < 6) {
          setError("A nova senha deve ter pelo menos 6 caracteres.");
          setLoading(false);
          return;
      }
      if (newPassword !== confirmPassword) {
          setError("As novas senhas não coincidem.");
          setLoading(false);
          return;
      }

      try {
          await authService.changePassword(currentPassword, newPassword);
          setSuccessMsg("Senha alterada com sucesso!");
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
      } catch (err: any) {
          setError(err.message || "Erro ao alterar senha.");
      } finally {
          setLoading(false);
      }
  };

  const handleRevokeOthers = async () => {
      if(window.confirm("Deseja desconectar todos os outros dispositivos?")) {
          await authService.revokeOtherSessions();
          // Local state update is handled by subscription
      }
  };

  const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
                border: 1px solid rgba(255,255,255,0.05); margin-bottom: 25px;
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
                font-size: 14px; color: #00c2ff; margin-bottom: 10px; text-transform: uppercase; font-weight: 700; padding-left: 5px;
            }

            /* Password Form */
            .password-form { padding: 20px; }
            .input-group { margin-bottom: 15px; }
            .input-group label { display: block; font-size: 13px; color: #aaa; margin-bottom: 5px; }
            .input-group input {
                width: 100%; padding: 12px; background: #111; border: 1px solid #333;
                border-radius: 8px; color: #fff; outline: none; transition: 0.3s;
            }
            .input-group input:focus { border-color: #00c2ff; }
            
            .save-btn {
                width: 100%; padding: 12px; background: #00c2ff; color: #000;
                border: none; border-radius: 8px; font-weight: 700; cursor: pointer;
                transition: 0.3s;
            }
            .save-btn:hover { background: #0099cc; }
            .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }

            .alert-box {
                padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 13px;
            }
            .alert-error { background: rgba(255, 77, 77, 0.1); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.3); }
            .alert-success { background: rgba(0, 255, 130, 0.1); color: #00ff82; border: 1px solid rgba(0, 255, 130, 0.3); }

            /* Login Activity */
            .session-item {
                display: flex; align-items: center; padding: 15px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .session-item:last-child { border-bottom: none; }
            .session-icon { font-size: 24px; color: #aaa; margin-right: 15px; }
            .session-info h4 { font-size: 15px; font-weight: 600; color: #fff; }
            .session-info p { font-size: 12px; color: #888; margin-top: 2px; }
            .active-now { color: #00ff82; font-size: 11px; font-weight: 700; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
            .active-dot { width: 6px; height: 6px; background: #00ff82; border-radius: 50%; }
            
            .revoke-btn {
                background: transparent; color: #ff4d4d; border: 1px solid #ff4d4d;
                padding: 4px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;
                transition: 0.2s;
            }
            .revoke-btn:hover { background: rgba(255, 77, 77, 0.1); }
        `}</style>

        <header>
            <button onClick={handleBack} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
            <h1>Segurança e Login</h1>
        </header>

        <main>
            <div className="section-title">Alterar Senha</div>
            <div className="settings-section">
                <div className="password-form">
                    {error && <div className="alert-box alert-error">{error}</div>}
                    {successMsg && <div className="alert-box alert-success">{successMsg}</div>}
                    
                    <form onSubmit={handleChangePassword}>
                        <div className="input-group">
                            <label>Senha Atual</label>
                            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <label>Nova Senha</label>
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <label>Confirmar Nova Senha</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                        </div>
                        <button type="submit" className="save-btn" disabled={loading}>
                            {loading ? 'Alterando...' : 'Alterar Senha'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="section-title">Preferências</div>
            <div className="settings-section">
                <div className="setting-row">
                    <div>
                        <div className="label-title">Salvar Login</div>
                        <div className="label-desc">Manter dados para login rápido.</div>
                    </div>
                    <label className="switch">
                        <input type="checkbox" checked={settings.saveLoginInfo} onChange={() => toggleSetting('saveLoginInfo')} />
                        <span className="slider"></span>
                    </label>
                </div>
            </div>

            <div className="flex justify-between items-end mb-2 px-1">
                <div className="section-title mb-0">Sessões Ativas</div>
                {sessions.length > 1 && (
                    <button onClick={handleRevokeOthers} className="revoke-btn">
                        Sair de outros dispositivos
                    </button>
                )}
            </div>
            
            <div className="settings-section">
                {sessions.length > 0 ? (
                    sessions.map(session => (
                        <div className="session-item" key={session.id}>
                            <i className={`fa-solid ${session.device.toLowerCase().includes('mobile') ? 'fa-mobile-screen-button' : 'fa-laptop'} session-icon`}></i>
                            <div className="session-info">
                                <h4>{session.device}</h4>
                                <p>{session.location} • {formatDate(session.timestamp)}</p>
                                {session.isActive && (
                                    <div className="active-now">
                                        <div className="active-dot"></div> Ativo agora
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="session-item">
                        <div className="session-info w-full text-center py-4">
                            <p>Nenhuma informação de sessão disponível.</p>
                        </div>
                    </div>
                )}
            </div>
        </main>
    </div>
  );
};