
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { AuthError, UserProfile } from '../types';
import { db } from '@/database';

export const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados do Formulário
  const [formData, setFormData] = useState<UserProfile>({
      name: '',
      nickname: '',
      bio: '',
      website: '', 
      isPrivate: false,
      photoUrl: undefined,
      cpf: '',
      phone: ''
  });
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Carregar dados iniciais
  useEffect(() => {
      const user = authService.getCurrentUser();
      if (!user) {
          navigate('/');
          return;
      }

      if (user.profile) {
          setFormData({
              name: user.profile.name || '',
              nickname: user.profile.nickname || '',
              bio: user.profile.bio || '',
              website: user.profile.website || '',
              isPrivate: user.profile.isPrivate || false,
              photoUrl: user.profile.photoUrl,
              cpf: user.profile.cpf || '',
              phone: user.profile.phone || ''
          });
          if (user.profile.photoUrl) {
              setImagePreview(user.profile.photoUrl);
          }
      }
      setFetching(false);
  }, [navigate]);

  // Handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      
      // Validação específica para username
      if (name === 'name') {
          const cleanValue = value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
          setFormData(prev => ({ ...prev, [name]: cleanValue }));
          setUsernameError('');
      } else {
          setFormData(prev => ({ ...prev, [name]: value }));
      }
  };

  const handleTogglePrivacy = () => {
      setFormData(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setUsernameError('');

      if (!formData.name.trim()) {
          setUsernameError('Nome de usuário é obrigatório');
          return;
      }

      setLoading(true);
      const email = authService.getCurrentUserEmail();

      try {
          if (email) {
              let finalPhotoUrl = formData.photoUrl;

              // PADRONIZAÇÃO R2: Se houver novo arquivo, faz o upload para a pasta 'avatars'
              if (selectedFile) {
                  finalPhotoUrl = await postService.uploadMedia(selectedFile, 'avatars');
              }

              const updatedProfile = { ...formData, photoUrl: finalPhotoUrl };

              // 1. Update User Profile (Backend handles deleting old avatar if finalPhotoUrl changed)
              await authService.completeProfile(email, updatedProfile);
              
              // 2. Global Sync: Update avatar in all posts/comments if changed
              if (finalPhotoUrl) {
                  const handle = `@${formData.name}`;
                  const allPosts = db.posts.getAll();
                  
                  allPosts.forEach(post => {
                      let postChanged = false;
                      if (post.username === handle && post.avatar !== finalPhotoUrl) {
                          post.avatar = finalPhotoUrl;
                          postChanged = true;
                      }
                      if (post.commentsList) {
                          post.commentsList.forEach(comment => {
                              if (comment.username === handle && comment.avatar !== finalPhotoUrl) {
                                  comment.avatar = finalPhotoUrl;
                                  postChanged = true;
                              }
                          });
                      }
                      if (postChanged) db.posts.update(post);
                  });
              }

              alert('Perfil atualizado com sucesso!');
              navigate('/profile');
          }
      } catch (err: any) {
          if (err.message === AuthError.NAME_TAKEN) {
              setUsernameError('Este nome de usuário já está em uso.');
          } else {
              setError(err.message || 'Erro ao atualizar perfil.');
          }
      } finally {
          setLoading(false);
      }
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/profile');
      }
  };

  if (fetching) return <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
        
        header {
            display:flex; align-items:center; justify-content:space-between; padding:16px;
            background: #0c0f14; position:fixed; width:100%; top:0; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); height: 65px;
        }
        header .back-btn {
            background:none; border:none; color:#fff; font-size:24px; cursor:pointer; padding-right: 15px;
        }
        header h1 { font-size:20px; font-weight:600; }
        
        main {
            padding-top: 85px; padding-bottom: 40px;
            width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px;
        }

        /* Avatar Section */
        .avatar-section {
            display: flex; flex-direction: column; align-items: center; margin-bottom: 30px;
        }
        .avatar-wrapper {
            position: relative; width: 100px; height: 100px;
            border-radius: 50%; cursor: pointer;
        }
        .avatar-img {
            width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
            border: 3px solid #00c2ff; box-shadow: 0 0 20px rgba(0,194,255,0.3);
        }
        .avatar-placeholder {
            width: 100%; height: 100%; border-radius: 50%; background: #1e2531;
            border: 3px solid #00c2ff; display: flex; align-items: center; justify-content: center;
            font-size: 40px; color: #00c2ff;
        }
        .edit-icon {
            position: absolute; bottom: 0; right: 0;
            background: #00c2ff; color: #000; width: 30px; height: 30px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-size: 14px; border: 2px solid #0c0f14;
        }
        .change-photo-text {
            margin-top: 10px; color: #00c2ff; font-size: 14px; font-weight: 600; cursor: pointer;
        }

        /* Form Sections */
        .section-title {
            font-size: 14px; color: #00c2ff; margin-bottom: 15px; 
            text-transform: uppercase; font-weight: 700; letter-spacing: 1px;
            border-bottom: 1px solid rgba(0,194,255,0.2); padding-bottom: 5px;
        }

        .input-group { margin-bottom: 20px; position: relative; }
        .input-group label {
            display: block; font-size: 13px; color: #aaa; margin-bottom: 8px; font-weight: 500;
        }
        .input-group input, .input-group textarea {
            width: 100%; padding: 14px 15px; background: #1a1e26;
            border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
            color: #fff; font-size: 16px; outline: none; transition: 0.3s;
        }
        .input-group input:focus, .input-group textarea:focus {
            border-color: #00c2ff; box-shadow: 0 0 10px rgba(0,194,255,0.1); background: rgba(255,255,255,0.05);
        }
        .input-group textarea { resize: vertical; min-height: 100px; }
        
        .input-icon {
            position: absolute; top: 42px; right: 15px; color: #555;
        }

        .helper-text { font-size: 12px; color: #666; margin-top: 5px; }
        .error-text { font-size: 12px; color: #ff4d4d; margin-top: 5px; }

        /* Privacy Toggle */
        .toggle-row {
            display: flex; align-items: center; justify-content: space-between;
            padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px;
            margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.05);
        }
        .toggle-info h4 { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 2px; }
        .toggle-info p { font-size: 12px; color: #888; }

        /* Switch */
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #00c2ff; }
        input:checked + .slider:before { transform: translateX(20px); }

        /* Save Button */
        .save-btn {
            width: 100%; padding: 16px; background: #00c2ff; color: #000;
            border: none; border-radius: 12px; font-weight: 800; font-size: 16px;
            cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,194,255,0.3);
            margin-top: 10px;
        }
        .save-btn:hover { background: #0099cc; transform: translateY(-2px); }
        .save-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        /* Alert */
        .alert-box {
            padding: 12px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.3);
            color: #ff4d4d; border-radius: 8px; font-size: 14px; margin-bottom: 20px; text-align: center;
        }
      `}</style>

      <header>
        <button onClick={handleBack} className="back-btn">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Editar Perfil</h1>
        <button onClick={handleSubmit} style={{background:'none', border:'none', color:'#00c2ff', fontSize:'24px', cursor:'pointer'}}>
            <i className="fa-solid fa-check"></i>
        </button>
      </header>

      <main>
        {error && <div className="alert-box">{error}</div>}

        {/* Avatar Upload */}
        <div className="avatar-section">
            <div className="avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
                {imagePreview ? (
                    <img src={imagePreview} alt="Avatar" className="avatar-img" />
                ) : (
                    <div className="avatar-placeholder"><i className="fa-solid fa-user"></i></div>
                )}
                <div className="edit-icon"><i className="fa-solid fa-camera"></i></div>
            </div>
            <span className="change-photo-text" onClick={() => fileInputRef.current?.click()}>Alterar foto de perfil</span>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                hidden 
            />
        </div>

        <form onSubmit={handleSubmit}>
            <div className="section-title">Informações Públicas</div>

            <div className="input-group">
                <label>Apelido (Nome de Exibição)</label>
                <input 
                    type="text" 
                    name="nickname" 
                    value={formData.nickname} 
                    onChange={handleChange} 
                    placeholder="Seu nome ou apelido" 
                    maxLength={30}
                />
            </div>

            <div className="input-group">
                <label>Nome de Usuário (@)</label>
                <input 
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    placeholder="usuario_unico" 
                    required
                />
                {usernameError && <p className="error-text">{usernameError}</p>}
            </div>

            <div className="input-group">
                <label>Biografia</label>
                <textarea 
                    name="bio" 
                    value={formData.bio} 
                    onChange={handleChange} 
                    placeholder="Conte um pouco sobre você..." 
                    maxLength={150}
                ></textarea>
                <p className="helper-text text-right">{formData.bio?.length || 0} / 150</p>
            </div>

            <div className="input-group">
                <label>Site / Link</label>
                <input 
                    type="url" 
                    name="website" 
                    value={formData.website} 
                    onChange={handleChange} 
                    placeholder="https://seu-site.com" 
                />
            </div>

            <div className="section-title">Privacidade</div>
            
            <div className="toggle-row">
                <div className="toggle-info">
                    <h4>Conta Privada</h4>
                    <p>Somente aprovados poderão ver seu conteúdo.</p>
                </div>
                <label className="switch">
                    <input type="checkbox" checked={formData.isPrivate} onChange={handleTogglePrivacy} />
                    <span className="slider"></span>
                </label>
            </div>

            <button type="submit" className="save-btn" disabled={loading}>
                {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Salvar Alterações'}
            </button>
        </form>
      </main>
    </div>
  );
};
