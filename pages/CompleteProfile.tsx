
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { AuthError } from '../types';

export const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState(''); 
  const [nickname, setNickname] = useState(''); 
  const [bio, setBio] = useState('');
  const [profileType, setProfileType] = useState<'public' | 'private'>('public');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const email = authService.getCurrentUserEmail();

  useEffect(() => {
    if (!email) {
        navigate('/');
        return;
    }
    
    const user = authService.getCurrentUser();
    if (user && user.profile) {
        // Se o nome vier com o padrão indesejado google_user_, limpamos para o usuário preencher
        if (user.profile.name && !user.profile.name.startsWith('google_user_')) {
            setName(user.profile.name);
        } else {
            setName('');
        }
        
        if (user.profile.nickname && user.profile.nickname !== 'Google User') {
            setNickname(user.profile.nickname);
        } else {
            setNickname('');
        }

        if (user.profile.photoUrl) setImagePreview(user.profile.photoUrl);
    }
  }, [email, navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Garante apenas letras minúsculas, números e caracteres permitidos
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setName(val);
    if (usernameError) setUsernameError('');
  };

  const handleUsernameBlur = async () => {
    if (!name || name.length < 3) return;
    try {
        const isAvailable = await authService.checkUsernameAvailability(name);
        if (!isAvailable) {
            setUsernameError('Nome indisponível');
        } else {
            setUsernameError('');
        }
    } catch (e) {
        console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name) {
        setError('O nome de usuário (@) é obrigatório.');
        return;
    }

    if (name.length < 3) {
        setError('O nome de usuário deve ter no mínimo 3 caracteres.');
        return;
    }

    if (usernameError) return;

    setLoading(true);

    try {
      if (email) {
        let finalPhotoUrl = imagePreview || undefined;

        if (selectedFile) {
            finalPhotoUrl = await postService.uploadMedia(selectedFile, 'avatars');
        }

        await authService.completeProfile(email, {
            name: name.trim(), 
            nickname: nickname.trim() || name, 
            bio: bio.trim(),
            isPrivate: profileType === 'private',
            photoUrl: finalPhotoUrl
        });
        
        setTimeout(() => {
            const pendingRedirect = sessionStorage.getItem('redirect_after_login');
            if (pendingRedirect) {
                sessionStorage.removeItem('redirect_after_login');
                navigate(pendingRedirect);
            } else {
                navigate('/feed');
            }
        }, 1000);
      }
    } catch (err: any) {
      console.error("Submit Error:", err);
      if (err.message === AuthError.NAME_TAKEN || err.message.includes("indisponível")) {
          setUsernameError(AuthError.NAME_TAKEN);
      } else {
          setError(err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter']">
        
        <div className="min-h-full flex flex-col items-center justify-center p-[30px_20px] overflow-x-hidden">
            <div className="w-full max-w-[400px] bg-white/5 backdrop-blur-md rounded-[20px] p-[30px_25px] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 text-center my-auto">
                
                <div className="w-[60px] h-[60px] bg-white/5 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-500 cursor-default shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)] mx-auto relative">
                     <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
                     <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
                </div>

                <h1 className="text-2xl font-extrabold mb-[5px] text-white drop-shadow-[0_0_5px_rgba(0,194,255,0.5)]">
                    Crie sua Identidade
                </h1>
                <p className="text-[15px] text-white/70 mb-[25px]">
                    Personalize seu acesso ao Flux.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col items-center mb-[30px]">
                        <div 
                            onClick={triggerFileInput}
                            className="w-[100px] h-[100px] rounded-full bg-white/10 border-[3px] border-[#00c2ff] mb-[10px] flex items-center justify-center text-4xl text-[#00c2ff] cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(0,194,255,0.5)] overflow-hidden relative"
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <i className="fa-solid fa-user"></i>
                            )}
                        </div>
                        <input 
                            type="file" 
                            id="profile-pic-input" 
                            ref={fileInputRef}
                            accept="image/*" 
                            onChange={handleImageChange}
                            className="hidden"
                        />
                        <span onClick={triggerFileInput} className="text-sm text-[#00c2ff] cursor-pointer">Adicionar Foto</span>
                    </div>

                    <div className="relative mb-5 text-left w-full">
                        <label htmlFor="usernameInput" className="block mb-[5px] text-sm font-semibold text-[#00c2ff]">* @Seu_Arroba (Obrigatório)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                            <input 
                                type="text" 
                                id="usernameInput" 
                                placeholder="exemplo.flux" 
                                required
                                value={name}
                                onChange={handleUsernameChange}
                                onBlur={handleUsernameBlur}
                                className={`w-full p-3 pl-8 bg-white/10 border rounded-[10px] text-white text-base outline-none transition-all focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)] placeholder-gray-400 ${usernameError ? 'border-red-500' : 'border-[#00c2ff]'}`}
                            />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Apenas minúsculas, números, ponto e underline.</p>
                        {usernameError && <span className="text-xs text-red-400 mt-1 block font-bold">{usernameError}</span>}
                    </div>

                    <div className="relative mb-5 text-left w-full">
                        <label htmlFor="nicknameInput" className="block mb-[5px] text-sm font-semibold text-[#00c2ff]">Nome de Exibição (Como você quer ser chamado)</label>
                        <input 
                            type="text" 
                            id="nicknameInput" 
                            placeholder="Seu Nome Real ou Fantasia" 
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full p-3 bg-white/10 border border-[#00c2ff] rounded-[10px] text-white text-base outline-none transition-all focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)] placeholder-gray-400"
                        />
                    </div>

                    <div className="relative mb-5 text-left w-full">
                        <label htmlFor="bioInput" className="block mb-[5px] text-sm font-semibold text-[#00c2ff]">Biografia</label>
                        <textarea 
                            id="bioInput" 
                            placeholder="Conte um pouco sobre você..." 
                            rows={2} 
                            maxLength={150}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full p-3 bg-white/10 border border-[#00c2ff] rounded-[10px] text-white text-base outline-none transition-all focus:bg-[rgba(0,194,255,0.1)] focus:shadow-[0_0_8px_rgba(0,194,255,0.8)] resize-none placeholder-gray-400"
                        ></textarea>
                    </div>

                    <div className="mb-[25px] text-left">
                        <label className="block mb-[5px] text-sm font-semibold text-[#00c2ff]">* Privacidade do Perfil</label>
                        <div className="flex gap-4">
                            <div className="inline-flex items-center cursor-pointer group">
                                <input 
                                    type="radio" 
                                    id="publicProfile" 
                                    name="profileType" 
                                    value="public"
                                    checked={profileType === 'public'}
                                    onChange={() => setProfileType('public')}
                                    className="appearance-none w-[18px] h-[18px] rounded-full border-2 border-[#00c2ff] mr-2 outline-none transition-all relative cursor-pointer checked:bg-[#0c0f14] checked:border-[#00c2ff] after:content-[''] after:hidden checked:after:block after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-2 after:h-2 after:rounded-full after:bg-[#00c2ff]"
                                />
                                <label htmlFor="publicProfile" className="cursor-pointer flex items-center gap-1 text-sm">
                                    <i className="fa-solid fa-globe"></i> Público
                                </label>
                            </div>
                            <div className="inline-flex items-center cursor-pointer group">
                                <input 
                                    type="radio" 
                                    id="privateProfile" 
                                    name="profileType" 
                                    value="private"
                                    checked={profileType === 'private'}
                                    onChange={() => setProfileType('private')}
                                    className="appearance-none w-[18px] h-[18px] rounded-full border-2 border-[#00c2ff] mr-2 outline-none transition-all relative cursor-pointer checked:bg-[#0c0f14] checked:border-[#00c2ff] after:content-[''] after:hidden checked:after:block after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-2 after:h-2 after:rounded-full after:bg-[#00c2ff]"
                                />
                                <label htmlFor="privateProfile" className="cursor-pointer flex items-center gap-1 text-sm">
                                    <i className="fa-solid fa-lock"></i> Privado
                                </label>
                            </div>
                        </div>
                    </div>

                    {error && (
                      <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm font-medium animate-pulse">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i> {error}
                      </div>
                    )}

                    <button 
                        type="submit" 
                        id="completeBtn"
                        disabled={!name || loading || !!usernameError}
                        className="w-full p-[14px] bg-[#00c2ff] border-none rounded-[10px] text-black text-lg font-bold cursor-pointer transition-all shadow-[0_4px_10px_rgba(0,194,255,0.4)] hover:bg-[#0099cc] hover:-translate-y-px hover:shadow-[0_6px_15px_rgba(0,194,255,0.6)] disabled:bg-[rgba(0,194,255,0.4)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                    >
                        {loading ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : 'Finalizar Cadastro'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
};
