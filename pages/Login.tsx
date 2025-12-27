
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { trackingService } from '../services/trackingService';
import { API_BASE } from '../apiConfig';

declare const google: any;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [googleAuthProcessing, setGoogleAuthProcessing] = useState(false);
  const [error, setError] = useState('');
  
  // Email/Password State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  const buttonRendered = React.useRef(false);

  // Affiliate Detection
  useEffect(() => {
      // Prioritize capture immediately on land
      trackingService.captureUrlParams();
      
      const params = new URLSearchParams(location.search);
      const ref = params.get('ref');
      if (ref) {
          console.log(`🎯 [Login] Referral capturado: ${ref}`);
      }
  }, [location]);

  // 1. Check Session
  useEffect(() => {
      const checkSession = () => {
          try {
              const user = authService.getCurrentUser();
              if (user) {
                  handleRedirect(user);
                  return true;
              }
          } catch (e) {
              console.error("[Auth] Session check failed", e);
          }
          return false;
      };

      if (!checkSession()) {
          setLoading(false);
      }
  }, [navigate]);

  const handleRedirect = (user: any, isNewUser: boolean = false) => {
      setGoogleAuthProcessing(false);
      
      if (isNewUser || (user && !user.isProfileCompleted)) {
          navigate('/complete-profile', { replace: true });
          return;
      }

      const state = location.state as any;
      const pendingRedirect = state?.from?.pathname || sessionStorage.getItem('redirect_after_login');
      
      if (pendingRedirect && pendingRedirect !== '/' && !pendingRedirect.includes('login')) {
          sessionStorage.removeItem('redirect_after_login');
          navigate(pendingRedirect, { replace: true });
      } else {
          navigate('/feed', { replace: true });
      }
  };

  const handleCredentialResponse = useCallback(async (response: any) => {
      setGoogleAuthProcessing(true);
      setError('');

      try {
          if (!response || !response.credential) {
              throw new Error("Login falhou. Nenhuma credencial recebida.");
          }
          
          // CRITICAL: Refresh URL capture right before login to catch any missed params
          trackingService.captureUrlParams();
          const referredBy = trackingService.getAffiliateRef() || undefined;
          
          const result = await authService.loginWithGoogle(response.credential, referredBy);
          
          if (result && result.user) {
              const isNew = result.nextStep === '/complete-profile' || !result.user.isProfileCompleted;
              handleRedirect(result.user, isNew);
          } else {
              throw new Error("Dados de usuário inválidos.");
          }
      } catch (err: any) {
          console.error("[GoogleAuth]", err);
          setError(err.message || 'Falha ao autenticar.');
          setGoogleAuthProcessing(false);
      }
  }, [navigate, location]);

  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return;
      
      setLoading(true);
      setError('');
      
      try {
          const result = await authService.login(email, password);
          if (result && result.user) {
              const isNew = result.nextStep === '/complete-profile' || !result.user.isProfileCompleted;
              handleRedirect(result.user, isNew);
          }
      } catch (err: any) {
          setError(err.message || 'Falha no login.');
          setLoading(false);
      }
  };

  // 2. Initialize Google Button (Robust)
  useEffect(() => {
      let isMounted = true;
      let intervalId: any;

      if (buttonRendered.current) return;

      const initializeGoogle = async () => {
          let clientId = "";

          // Prioridade 1: Vite Import Meta (Moderno)
          try {
              // @ts-ignore
              if (import.meta.env.VITE_GOOGLE_CLIENT_ID) {
                  // @ts-ignore
                  clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
              }
          } catch (e) {}

          // Prioridade 2: Process Env (Compatibilidade/Injeção)
          if (!clientId) {
              try {
                  // @ts-ignore
                  if (typeof process !== 'undefined' && process.env && process.env.GOOGLE_CLIENT_ID) {
                      // @ts-ignore
                      clientId = process.env.GOOGLE_CLIENT_ID;
                  }
              } catch (e) {}
          }

          // Prioridade 3: Fetch Backend (Fallback)
          if (!clientId || clientId.length < 10) {
              try {
                  const res = await fetch(`${API_BASE}/api/auth/config`);
                  if (res.ok) {
                      const contentType = res.headers.get("content-type");
                      if (contentType && contentType.indexOf("application/json") !== -1) {
                          const data = await res.json();
                          if (data.clientId) clientId = data.clientId;
                      } else {
                          console.warn("API config endpoint returned non-JSON content. Possible server route mismatch.");
                      }
                  }
              } catch (err) {
                  console.warn("Config fetch failed, unable to get ClientID from API");
              }
          }

          if (!isMounted) return;

          // Validação Final: Se não tiver Client ID, mostra form de email
          if (!clientId || clientId.length < 5 || clientId.includes("NAO_CONFIGURADO")) {
              console.warn("Google Client ID missing. Defaulting to Email Login.");
              setShowEmailForm(true); // Auto-show email form if Google unavailable
              setLoading(false);
              return; 
          }

          // Aguarda script do Google carregar
          let attempts = 0;
          intervalId = setInterval(() => {
              if (!isMounted) {
                  clearInterval(intervalId);
                  return;
              }

              const btnDiv = document.getElementById('googleButtonDiv');
              attempts++;
              
              if (typeof google !== 'undefined' && google.accounts && btnDiv) {
                  clearInterval(intervalId);
                  try {
                      google.accounts.id.initialize({
                          client_id: clientId,
                          callback: handleCredentialResponse,
                          auto_select: false,
                          cancel_on_tap_outside: false
                      });
                      
                      google.accounts.id.renderButton(btnDiv, {
                          theme: 'filled_black',
                          size: 'large',
                          type: 'standard', // Keeps functionality
                          shape: 'rectangular', // Better for filling container
                          text: 'signin_with',
                          width: '400', // Forces max width to cover custom button
                          logo_alignment: 'left'
                      });
                      buttonRendered.current = true;
                      // Ensure loader is gone once button renders
                      setLoading(false);
                  } catch (e) {
                      console.error("Google init error:", e);
                      setShowEmailForm(true); // Fallback
                      setLoading(false);
                  }
              } else if (attempts > 50) { 
                  clearInterval(intervalId);
                  setShowEmailForm(true); // Fallback on timeout
                  setLoading(false);
              }
          }, 100);
      };

      initializeGoogle();

      return () => {
          isMounted = false;
          if (intervalId) clearInterval(intervalId);
      };
  }, [handleCredentialResponse]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-white font-['Inter'] relative overflow-hidden">
      
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-[400px] mx-4 bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-2xl relative z-10 flex flex-col items-center">
        
        <div className="mb-8 w-[80px] h-[80px] bg-white/5 rounded-2xl flex items-center justify-center relative border border-white/10 shadow-[0_0_30px_rgba(0,194,255,0.2)]">
             <div className="absolute w-[50px] h-[28px] rounded-[50%] border-[4px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[50px] h-[28px] rounded-[50%] border-[4px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-3 text-white">Flux</h1>
        <p className="text-gray-400 text-sm text-center mb-8 leading-relaxed">
            Sua plataforma de conexão e conteúdo.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm text-center w-full">
              <i className="fa-solid fa-circle-exclamation mr-2"></i>
              {error}
          </div>
        )}

        {/* Google Button Container (Custom Clean UI + Invisible Overlay) */}
        <div className={`w-full relative min-h-[50px] mb-6 ${showEmailForm ? 'hidden' : ''}`}>
            {/* 1. Custom Visual Button (Always Clean) */}
            <div className="w-full h-[50px] bg-white text-gray-700 border border-gray-300 rounded-lg font-bold flex items-center justify-center gap-3 transition-colors shadow-sm pointer-events-none">
                <i className="fa-brands fa-google text-lg"></i>
                <span className="text-sm">Entrar com Google</span>
            </div>

            {/* 2. Functional Google Button (Invisible Overlay) */}
            <div 
                id="googleButtonDiv" 
                className="absolute inset-0 z-10 opacity-0 overflow-hidden cursor-pointer"
                style={{ display: (loading || googleAuthProcessing) ? 'none' : 'block' }}
            ></div>
            
            {/* 3. Loading State Overlay */}
            {(loading || googleAuthProcessing) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500 text-sm bg-[#050505] z-20 rounded-lg border border-white/10">
                    <i className="fa-solid fa-circle-notch fa-spin text-[#00c2ff] text-xl"></i>
                </div>
            )}
        </div>

        {/* Email Login Form */}
        {showEmailForm && (
            <form onSubmit={handleEmailLogin} className="w-full animate-fade-in">
                <div className="mb-4">
                    <input 
                        type="email" 
                        placeholder="E-mail" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-[#00c2ff] transition-colors"
                        required
                    />
                </div>
                <div className="mb-6">
                    <input 
                        type="password" 
                        placeholder="Senha" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white outline-none focus:border-[#00c2ff] transition-colors"
                        required
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-[#00c2ff] text-black font-bold rounded-lg hover:bg-[#00aaff] transition-colors disabled:opacity-50"
                >
                    {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Entrar'}
                </button>
            </form>
        )}

        {/* Toggle between methods */}
        <div className="mt-6 flex flex-col gap-2 items-center text-sm w-full">
            <button 
                onClick={() => setShowEmailForm(!showEmailForm)}
                className="text-gray-400 hover:text-white transition-colors"
            >
                {showEmailForm ? 'Entrar com Google' : 'Entrar com E-mail e Senha'}
            </button>
            
            <div className="w-full h-[1px] bg-white/5 my-2"></div>

            <div className="flex gap-4">
                <Link to="/register" className="text-[#00c2ff] hover:underline">Criar conta</Link>
                <span className="text-gray-600">|</span>
                <Link to="/forgot-password" text-gray-400 hover:text-white>Esqueci a senha</Link>
            </div>
        </div>

      </div>
    </div>
  );
};
