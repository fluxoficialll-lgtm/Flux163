
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { AuthError } from '../types';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [errors, setErrors] = useState<{email?: string, password?: string, confirm?: string, terms?: string, form?: string}>({});
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);

  // Affiliate Detection
  const [referredBy, setReferredBy] = useState<string | null>(null);

  useEffect(() => {
    // Check for referral in URL
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
        setReferredBy(ref);
        console.log(`🤝 [Afiliado] Registro iniciado via indicação de: ${ref}`);
    }

    const newErrors: any = {};
    if (email && !authService.isValidEmail(email)) newErrors.email = AuthError.INVALID_FORMAT;
    if (password && password.length < 6) newErrors.password = AuthError.PASSWORD_TOO_SHORT;
    if (confirmPassword && password !== confirmPassword) newErrors.confirm = AuthError.PASSWORDS_DONT_MATCH;

    setErrors(newErrors);
    
    const allFilled = email !== '' && password !== '' && confirmPassword !== '' && termsAccepted;
    const hasBlockingErrors = Object.keys(newErrors).length > 0;
    setIsValid(!!allFilled && !hasBlockingErrors);

  }, [email, password, confirmPassword, termsAccepted, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    
    try {
      // Pass referredBy to register flow
      await authService.register(email, password, referredBy || undefined);
      navigate('/verify-email');
    } catch (err: any) {
      setErrors(prev => ({ ...prev, form: err.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter']">
        
        <header className="fixed top-0 left-0 w-full flex justify-start p-[16px_20px] z-10">
            <button 
                onClick={() => navigate('/')}
                className="bg-white/10 border border-[#00c2ff] text-[#00c2ff] text-lg cursor-pointer transition-all w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#00c2ff] hover:text-black"
            >
                <i className="fa-solid fa-arrow-left"></i>
            </button>
        </header>

        <div className="min-h-full flex flex-col items-center justify-center p-5 pb-5 overflow-x-hidden pt-[80px]">
            <div className="w-full max-w-[360px] bg-white/5 backdrop-blur-md rounded-[20px] p-[30px_25px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 text-center flex flex-col items-center animate-fade-in">
                
                <div className="w-[60px] h-[60px] bg-white/5 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-500 cursor-default shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)] relative">
                     <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                     <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
                </div>

                <h1 className="text-[22px] font-extrabold mb-[25px] text-white text-shadow-glow">
                    Criar Nova Conta Flux
                </h1>

                {referredBy && (
                    <div className="mb-4 text-xs bg-[#FFD7001a] border border-[#FFD70033] p-2 rounded-lg text-[#FFD700]">
                        <i className="fa-solid fa-handshake mr-1"></i> Você está sendo indicado por um parceiro Flux.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="w-full">
                    <div className="relative mb-5 text-left w-full group">
                        <i className="fa-solid fa-envelope absolute left-[15px] top-1/2 -translate-y-1/2 text-[#00c2ff] text-lg"></i>
                        <input 
                            type="email" 
                            placeholder="E-mail"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-[12px_12px_12px_40px] bg-white/10 border border-[#00c2ff] rounded-[10px] text-white text-base focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)] outline-none transition-all placeholder-gray-400"
                        />
                        {errors.email && <span className="text-xs text-red-400 mt-1 block ml-1">{errors.email}</span>}
                    </div>

                    <div className="relative mb-5 text-left w-full group">
                        <i className="fa-solid fa-lock absolute left-[15px] top-1/2 -translate-y-1/2 text-[#00c2ff] text-lg"></i>
                        <input 
                            type="password" 
                            placeholder="Senha"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-[12px_12px_12px_40px] bg-white/10 border border-[#00c2ff] rounded-[10px] text-white text-base focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)] outline-none transition-all placeholder-gray-400"
                        />
                        {errors.password && <span className="text-xs text-red-400 mt-1 block ml-1">{errors.password}</span>}
                    </div>

                    <div className="relative mb-5 text-left w-full group">
                        <i className="fa-solid fa-lock absolute left-[15px] top-1/2 -translate-y-1/2 text-[#00c2ff] text-lg"></i>
                        <input 
                            type="password" 
                            placeholder="Confirmar Senha"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-[12px_12px_12px_40px] bg-white/10 border border-[#00c2ff] rounded-[10px] text-white text-base focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)] outline-none transition-all placeholder-gray-400"
                        />
                        {errors.confirm && <span className="text-xs text-red-400 mt-1 block ml-1">{errors.confirm}</span>}
                    </div>

                    <div className="flex items-center mb-5 text-sm text-left w-full">
                        <input 
                            type="checkbox" 
                            id="acceptTerms"
                            required
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="appearance-none w-[18px] h-[18px] min-w-[18px] border-2 border-[#00c2ff] rounded-[4px] mr-[10px] cursor-pointer relative checked:bg-[#00c2ff] transition-colors after:content-['✓'] after:absolute after:text-black after:font-bold after:text-[12px] after:left-[2px] after:top-[-2px] after:hidden checked:after:block"
                        />
                        <label htmlFor="acceptTerms" className="text-gray-300 cursor-pointer leading-tight">
                            Eu aceito os <a href="#" className="text-[#00c2ff] hover:underline">Termos de Uso</a> e a <a href="#" className="text-[#00c2ff] hover:underline">Política de Privacidade</a>.
                        </label>
                    </div>

                    {errors.form && (
                      <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm font-medium">
                        {errors.form}
                      </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={!isValid || loading}
                        className="w-full p-[14px] bg-[#00c2ff] border-none rounded-[10px] text-black text-lg font-semibold cursor-pointer transition-all shadow-[0_4px_10px_rgba(0,194,255,0.4)] hover:bg-[#0099cc] hover:shadow-[0_6px_15px_rgba(0,194,255,0.6)] disabled:bg-[rgba(0,194,255,0.4)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                    >
                        {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Criar Conta'}
                    </button>
                </form>

                <div className="mt-[25px] text-sm text-gray-300">
                    Já tem conta? <Link to="/" className="text-[#00c2ff] no-underline hover:text-white hover:underline transition-colors">Entrar</Link>
                </div>
            </div>
        </div>
    </div>
  );
};
