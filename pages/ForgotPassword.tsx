
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  
  // States
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [verificationSent, setVerificationSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [btnText, setBtnText] = useState('Enviar E-mail');
  const [btnColorClass, setBtnColorClass] = useState('bg-[#00c2ff]'); // Default blue
  
  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Reset button text after error/success momentarily
  const flashButton = (text: string, colorClass: string, duration = 1500) => {
    const originalText = verificationSent ? 'Verificar Código' : 'Enviar E-mail';
    const originalColor = 'bg-[#00c2ff]';
    
    setBtnText(text);
    setBtnColorClass(colorClass);
    
    if (duration > 0) {
        setTimeout(() => {
            setBtnText(originalText);
            setBtnColorClass(originalColor);
        }, duration);
    }
  };

  // Handlers
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationSent) {
        // STAGE 1: Send Email (Type: RESET)
        if (!email) return;
        setLoading(true);
        
        try {
            // Pass 'reset' to send correct template
            await authService.sendVerificationCode(email, 'reset');
            setVerificationSent(true);
            setTimer(30);
            setBtnText('Verificar Código');
            // Focus first code input
            setTimeout(() => codeInputsRef.current[0]?.focus(), 100);
        } catch (err: any) {
            // Show error on button roughly
            flashButton(err.message || 'Erro ao enviar', 'bg-[#ff6b6b]');
        } finally {
            setLoading(false);
        }

    } else {
        // STAGE 2: Verify Code
        const fullCode = code.join('');
        if (fullCode.length < 6) return;
        
        setLoading(true);
        try {
            await authService.verifyCode(email, fullCode, true); // isResetFlow = true
            
            // Success visual
            setBtnText('Verificado!');
            setBtnColorClass('bg-[#10ac84]');
            
            // Navigate
            localStorage.setItem('reset_email', email);
            setTimeout(() => {
                navigate('/reset-password');
            }, 1000);
        } catch (err: any) {
            flashButton('Código Incorreto', 'bg-[#ff6b6b]');
            // Clear code
            setTimeout(() => {
                setCode(['', '', '', '', '', '']);
                codeInputsRef.current[0]?.focus();
            }, 1500);
        } finally {
            setLoading(false);
        }
    }
  };

  const handleResend = async () => {
      if (timer > 0) return;
      try {
          await authService.sendVerificationCode(email, 'reset');
          setTimer(30);
      } catch (error) {
          console.error(error);
      }
  };

  const handleCodeChange = (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;
      
      const newCode = [...code];
      newCode[index] = value.slice(-1);
      setCode(newCode);

      // Auto focus next
      if (value && index < 5) {
          codeInputsRef.current[index + 1]?.focus();
      }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !code[index] && index > 0) {
          codeInputsRef.current[index - 1]?.focus();
      }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
      if (!pasteData) return;

      const newCode = [...code];
      for(let i = 0; i < 6; i++) {
          if (pasteData[i]) newCode[i] = pasteData[i];
      }
      setCode(newCode);
      
      // Focus last filled or last input
      const focusIndex = Math.min(pasteData.length, 5);
      codeInputsRef.current[focusIndex]?.focus();
  };

  const isBtnDisabled = !verificationSent 
    ? !email 
    : code.some(c => c === '') || loading;

  return (
    <div className="h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter']">
        <header className="fixed top-0 left-0 w-full flex justify-start p-4 px-5 z-10">
            <button 
                onClick={() => navigate('/')} 
                className="w-10 h-10 rounded-full bg-white/10 border border-[#00c2ff] text-[#00c2ff] text-lg flex items-center justify-center transition-all hover:bg-[#00c2ff] hover:text-black cursor-pointer"
            >
                <i className="fa-solid fa-arrow-left"></i>
            </button>
        </header>

        <div className="min-h-full flex flex-col items-center justify-center pb-5 pt-[60px]">
            <div className="w-full max-w-[360px] bg-white/5 backdrop-blur-md rounded-[20px] p-[30px_25px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 text-center mx-auto animate-fade-in">
                
                {/* Logo */}
                <div className="w-[60px] h-[60px] bg-white/5 rounded-2xl flex items-center justify-center mb-5 mx-auto relative shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]">
                     <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                     <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
                </div>

                <h1 className="text-[22px] font-extrabold mb-[10px] text-white text-shadow-glow">
                    {verificationSent ? 'Verificação de Código' : 'Recuperação de Senha'}
                </h1>
                
                <p className="text-[15px] text-white/90 mb-[25px] leading-relaxed">
                    {verificationSent 
                        ? <>Enviamos o código para <strong>{email}</strong>. Insira-o abaixo:</>
                        : "Por favor, insira o e-mail da sua conta para enviarmos o código de verificação."
                    }
                </p>

                <form onSubmit={handleEmailSubmit}>
                    <div className="relative mb-5 text-left">
                        <i className="fa-solid fa-envelope absolute left-[15px] top-1/2 -translate-y-1/2 text-[#00c2ff] text-lg"></i>
                        <input 
                            type="email" 
                            placeholder="E-mail" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            readOnly={verificationSent}
                            className="w-full p-[12px_12px_12px_40px] bg-white/10 border border-[#00c2ff] rounded-[10px] text-white text-base outline-none transition-all focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)]"
                        />
                    </div>

                    <div className={`flex justify-center gap-[10px] mb-[30px] overflow-hidden transition-all duration-400 ${verificationSent ? 'opacity-100 h-[45px]' : 'opacity-0 h-0'}`}>
                        {code.map((digit, idx) => (
                            <input 
                                key={idx}
                                ref={el => { codeInputsRef.current[idx] = el }}
                                type="text" 
                                maxLength={1} 
                                inputMode="numeric"
                                value={digit}
                                onChange={(e) => handleCodeChange(idx, e.target.value)}
                                onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                                onPaste={handlePaste}
                                className="w-[45px] h-[45px] text-center text-xl font-semibold bg-white/10 border-2 border-[#00c2ff] rounded-lg text-white outline-none transition-all focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)]"
                            />
                        ))}
                    </div>

                    <button 
                        type="submit" 
                        disabled={isBtnDisabled}
                        className={`w-full p-[14px] border-none rounded-[10px] text-black text-lg font-semibold cursor-pointer transition-all shadow-[0_4px_10px_rgba(0,194,255,0.4)] mb-[15px] hover:-translate-y-px hover:shadow-[0_6px_15px_rgba(0,194,255,0.6)] disabled:bg-[#00c2ff]/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${btnColorClass}`}
                    >
                        {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : btnText}
                    </button>
                </form>

                <button 
                    onClick={handleResend}
                    disabled={timer > 0}
                    className={`bg-none border-none text-[#00c2ff] text-sm cursor-pointer transition-all p-2.5 hover:text-white hover:underline disabled:text-[#00c2ff]/50 disabled:cursor-not-allowed disabled:no-underline ${verificationSent ? 'visible opacity-100' : 'invisible opacity-0'}`}
                >
                    {timer > 0 ? `Reenviar código (${timer}s)` : "Reenviar código"}
                </button>

                <div className="mt-[25px] text-sm">
                    Não conseguiu recuperar? <Link to="/" className="text-[#00c2ff] no-underline transition-colors hover:text-white hover:underline">Voltar para o login</Link>
                </div>
            </div>
        </div>
    </div>
  );
};
