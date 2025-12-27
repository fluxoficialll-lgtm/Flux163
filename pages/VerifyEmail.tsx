
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

export const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const email = authService.getCurrentUserEmail();

  useEffect(() => {
    if (!email) {
      navigate('/register');
      return;
    }
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [email, navigate]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    
    setLoading(true);
    setError('');

    try {
      if (email) {
        await authService.verifyCode(email, fullCode);
        
        // CHECK FOR PENDING REDIRECT (Deep Linking Flow)
        const savedRedirect = sessionStorage.getItem('post_auth_redirect');
        
        if (savedRedirect) {
            // Keep redirect stored for CompleteProfile or jump straight there if profile minimal needed is met
            // Usually we want them to complete profile first, then redirect.
            // But for high friction sales, sometimes jumping straight is better.
            // Let's stick to standard flow: Verify -> Complete Profile -> (Then Complete Profile checks redirect)
            
            // However, VerifyEmail typically navigates to CompleteProfile.
            // Let's ensure CompleteProfile handles the final redirect.
            navigate('/complete-profile');
        } else {
            navigate('/complete-profile');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !email) return;
    setCanResend(false);
    setTimer(30);
    setError('');
    try {
        await authService.sendVerificationCode(email);
        const interval = setInterval(() => {
            setTimer(prev => {
              if (prev <= 1) {
                setCanResend(true);
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
    } catch (err: any) {
        setError(err.message);
        setCanResend(true);
    }
  };

  const isFilled = code.every(c => c !== '');

  return (
    <div className="h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter']">
      
      <header className="fixed top-0 left-0 w-full flex justify-start p-[16px_20px] z-10">
        <button 
            onClick={() => navigate('/register')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 border border-[#00c2ff] text-[#00c2ff] text-lg cursor-pointer transition-all hover:bg-[#00c2ff] hover:text-black"
        >
            <i className="fa-solid fa-arrow-left"></i>
        </button>
      </header>

      <div className="min-h-full flex flex-col items-center justify-center p-5 pt-[80px] pb-5 overflow-x-hidden">
        <div className="w-full max-w-[360px] bg-white/5 backdrop-blur-md rounded-[20px] p-[30px_25px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 text-center">
            
            <div className="w-[60px] h-[60px] bg-white/5 rounded-2xl flex items-center justify-center mb-5 mx-auto cursor-default shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)] relative transition-all">
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                 <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
            </div>

            <h1 className="text-[22px] font-extrabold mb-[10px] text-white drop-shadow-[0_0_5px_rgba(0,194,255,0.5)]">
                Verificação de E-mail
            </h1>
            <p className="text-[15px] text-white/90 mb-[25px] leading-[1.4]">
                Enviamos um código de 6 dígitos para o seu e-mail cadastrado. Por favor, insira-o abaixo para concluir o registro.
            </p>

            <form onSubmit={handleVerify}>
                <div className="flex justify-center gap-[10px] mb-[30px]">
                    {code.map((digit, index) => (
                        <input 
                            key={index}
                            ref={el => { inputsRef.current[index] = el }}
                            type="text" 
                            maxLength={1}
                            inputMode="numeric"
                            pattern="[0-9]"
                            value={digit}
                            onChange={(e) => handleInput(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-[45px] h-[45px] text-center text-xl font-semibold bg-white/10 border-2 border-[#00c2ff] rounded-lg text-white outline-none transition-all focus:bg-white/10 focus:shadow-[0_0_8px_rgba(0,194,255,0.8)]"
                            required
                        />
                    ))}
                </div>

                {error && (
                    <div className="mb-4 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm font-medium">
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={!isFilled || loading}
                    className="w-full p-[14px] bg-[#00c2ff] border-none rounded-[10px] text-black text-lg font-semibold cursor-pointer transition-all shadow-[0_4px_10px_rgba(0,194,255,0.4)] hover:bg-[#0099cc] hover:-translate-y-[1px] hover:shadow-[0_6px_15px_rgba(0,194,255,0.6)] disabled:bg-[rgba(0,194,255,0.4)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none mb-[15px]"
                >
                    {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Verificar Código'}
                </button>
            </form>

            <button 
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="bg-none border-none text-[#00c2ff] text-sm cursor-pointer transition-colors p-2.5 hover:text-white hover:underline disabled:text-white/50 disabled:cursor-not-allowed disabled:no-underline"
            >
                {canResend ? 'Reenviar código' : `Reenviar código (${timer}s)`}
            </button>

            <div className="mt-[25px] text-sm">
                Não recebeu? Verifique o spam ou <Link to="/register" className="text-[#00c2ff] no-underline hover:text-white hover:underline transition-colors">Voltar para o cadastro</Link>
            </div>
        </div>
      </div>
    </div>
  );
};
