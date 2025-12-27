
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface FaqItem {
    question: string;
    answer: string;
}

export const HelpSupport: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Support Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportMedia, setSupportMedia] = useState<{ file: File, preview: string, type: 'image' | 'video' } | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const faqs: FaqItem[] = [
      {
          question: "Como recupero minha senha?",
          answer: "Na tela de login, clique em 'Esqueceu a senha?'. Você receberá um código de 6 dígitos no seu e-mail cadastrado para criar uma nova senha."
      },
      {
          question: "Como criar um Grupo VIP?",
          answer: "Vá até a aba 'Grupos', clique no botão de criar (+) e selecione a opção 'Grupo VIP'. Você precisará conectar sua conta SyncPay para receber pagamentos."
      },
      {
          question: "Como funciona o pagamento?",
          answer: "Utilizamos o sistema SyncPay para processar pagamentos via PIX de forma segura e instantânea. O acesso ao grupo é liberado automaticamente após a confirmação."
      },
      {
          question: "Como excluir minha conta?",
          answer: "Para excluir sua conta, vá em Configurações > Conta > Excluir Conta. Atenção: esta ação é irreversível e todos os seus dados serão perdidos."
      },
      {
          question: "Posso mudar meu nome de usuário?",
          answer: "Sim, vá em Perfil > Editar Perfil. Você pode alterar seu @usuário (se disponível) e seu apelido de exibição."
      }
  ];

  const toggleFaq = (index: number) => {
      setOpenIndex(openIndex === index ? null : index);
  };

  const handleBack = () => {
      if (window.history.state && window.history.state.idx > 0) {
          navigate(-1);
      } else {
          navigate('/settings');
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          const type = file.type.startsWith('video/') ? 'video' : 'image';
          setSupportMedia({ file, preview: url, type });
      }
  };

  const removeMedia = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSupportMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendSupport = () => {
      if (!supportMessage.trim() && !supportMedia) {
          alert("Por favor, descreva seu problema ou anexe um arquivo.");
          return;
      }
      
      setIsSending(true);
      
      // Envio imediato (mockado mas sem delay artificial para sensação de app real)
      // Em um backend real, isso seria um POST para /api/support
      
      alert("Solicitação enviada! Ticket #"+ Math.floor(Math.random() * 9000 + 1000));
      setSupportMessage('');
      setSupportMedia(null);
      setIsSupportModalOpen(false);
      setIsSending(false);
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

        .search-box {
            display: flex; align-items: center; background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 15px;
            margin-bottom: 30px;
        }
        .search-box i { color: #aaa; margin-right: 10px; }
        .search-box input {
            background: transparent; border: none; color: #fff; width: 100%; outline: none; font-size: 16px;
        }

        .section-title { font-size: 14px; color: #00c2ff; margin-bottom: 15px; text-transform: uppercase; font-weight: 700; }

        .faq-item {
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
            border-radius: 10px; margin-bottom: 10px; overflow: hidden; transition: 0.3s;
        }
        .faq-question {
            padding: 15px; display: flex; justify-content: space-between; align-items: center;
            cursor: pointer; font-weight: 600; font-size: 15px;
        }
        .faq-question i { color: #00c2ff; transition: transform 0.3s; }
        .faq-question.active i { transform: rotate(180deg); }
        
        .faq-answer {
            padding: 0 15px 15px 15px; color: #aaa; font-size: 14px; line-height: 1.5;
            display: none; animation: fadeIn 0.3s;
        }
        .faq-answer.open { display: block; }
        
        @keyframes fadeIn { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }

        .contact-section {
            margin-top: 40px; text-align: center; padding: 30px 20px;
            background: rgba(0,194,255,0.05); border-radius: 16px; border: 1px dashed rgba(0,194,255,0.3);
        }
        .contact-title { font-size: 18px; font-weight: 700; margin-bottom: 5px; }
        .contact-desc { font-size: 14px; color: #aaa; margin-bottom: 20px; }
        
        .contact-btn {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 12px 25px; background: #00c2ff; color: #000;
            border-radius: 30px; font-weight: 700; text-decoration: none;
            transition: 0.3s; cursor: pointer; border: none; font-size: 15px;
        }
        .contact-btn:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,194,255,0.4); }

        /* MODAL STYLES */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); z-index: 100;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(5px); animation: fadeIn 0.3s ease;
        }

        .support-modal {
            background: #1a1e26; width: 90%; max-width: 400px;
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            overflow: hidden; display: flex; flex-direction: column;
            animation: slideUp 0.3s ease;
        }

        .modal-header {
            padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex; justify-content: space-between; align-items: center;
            background: rgba(255,255,255,0.02);
        }
        .modal-title { font-size: 16px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
        .close-modal { background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer; }

        .modal-body { padding: 20px; }

        .input-label { display: block; font-size: 12px; color: #aaa; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .support-textarea {
            width: 100%; background: #0c0f14; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; padding: 12px; color: #fff; font-size: 14px;
            resize: none; outline: none; min-height: 120px; transition: 0.3s;
        }
        .support-textarea:focus { border-color: #00c2ff; background: #000; }

        .upload-box {
            margin-top: 15px; border: 1px dashed rgba(255,255,255,0.2);
            border-radius: 12px; padding: 20px; text-align: center;
            cursor: pointer; transition: 0.2s; position: relative; overflow: hidden;
            background: rgba(255,255,255,0.02);
        }
        .upload-box:hover { border-color: #00c2ff; background: rgba(0,194,255,0.05); }

        .upload-placeholder { color: #666; font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .upload-placeholder i { font-size: 24px; color: #00c2ff; }

        .media-preview-container {
            width: 100%; height: 180px; position: relative;
        }
        .media-preview { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; background: #000; }
        .remove-media {
            position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7);
            color: #fff; border: none; width: 28px; height: 28px; border-radius: 50%;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: 0.2s;
        }
        .remove-media:hover { background: #ff4d4d; }

        .modal-footer {
            padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.05);
            background: rgba(255,255,255,0.02);
        }
        .send-btn {
            width: 100%; background: #00c2ff; color: #000; padding: 14px;
            border-radius: 12px; font-weight: 700; border: none; cursor: pointer;
            font-size: 15px; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .send-btn:hover { background: #0099cc; box-shadow: 0 4px 15px rgba(0,194,255,0.3); }
        .send-btn:disabled { opacity: 0.7; cursor: not-allowed; background: #333; color: #777; box-shadow: none; }

        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <header>
        <button onClick={handleBack} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
        <h1>Ajuda e Suporte</h1>
      </header>

      <main>
        <div className="search-box">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="text" placeholder="Pesquisar dúvidas..." />
        </div>

        <div className="section-title">Perguntas Frequentes</div>
        
        {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
                <div className={`faq-question ${openIndex === index ? 'active' : ''}`} onClick={() => toggleFaq(index)}>
                    {faq.question}
                    <i className="fa-solid fa-chevron-down"></i>
                </div>
                <div className={`faq-answer ${openIndex === index ? 'open' : ''}`}>
                    {faq.answer}
                </div>
            </div>
        ))}

        <div className="contact-section">
            <div className="contact-title">Ainda precisa de ajuda?</div>
            <div className="contact-desc">Nossa equipe está disponível para te ajudar.</div>
            <button className="contact-btn" onClick={() => setIsSupportModalOpen(true)}>
                <i className="fa-solid fa-headset"></i> Falar com Suporte
            </button>
        </div>
      </main>

      {/* SUPPORT MODAL */}
      {isSupportModalOpen && (
          <div className="modal-overlay" onClick={() => !isSending && setIsSupportModalOpen(false)}>
              <div className="support-modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <div className="modal-title"><i className="fa-solid fa-comments text-[#00c2ff]"></i> Falar com Suporte</div>
                      <button className="close-modal" onClick={() => !isSending && setIsSupportModalOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  
                  <div className="modal-body">
                      <div className="input-label">Mensagem</div>
                      <textarea 
                          className="support-textarea" 
                          placeholder="Descreva seu problema, dúvida ou sugestão..."
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          disabled={isSending}
                      ></textarea>

                      <div className="upload-box" onClick={() => !supportMedia && !isSending && fileInputRef.current?.click()}>
                          {supportMedia ? (
                              <div className="media-preview-container">
                                  {supportMedia.type === 'video' ? (
                                      <video src={supportMedia.preview} controls className="media-preview" />
                                  ) : (
                                      <img src={supportMedia.preview} alt="Print" className="media-preview" />
                                  )}
                                  <button className="remove-media" onClick={removeMedia} disabled={isSending}>
                                      <i className="fa-solid fa-trash"></i>
                                  </button>
                              </div>
                          ) : (
                              <div className="upload-placeholder">
                                  <i className="fa-solid fa-cloud-arrow-up"></i>
                                  <span>Adicionar Print, Foto ou Vídeo</span>
                                  <span style={{fontSize:'11px', color:'#555'}}>(Opcional)</span>
                              </div>
                          )}
                          <input 
                              type="file" 
                              ref={fileInputRef} 
                              hidden 
                              accept="image/*,video/*" 
                              onChange={handleFileChange} 
                          />
                      </div>
                  </div>

                  <div className="modal-footer">
                      <button id="sendSupportBtn" className="send-btn" onClick={handleSendSupport} disabled={isSending}>
                          {isSending ? (
                              <><i className="fa-solid fa-circle-notch fa-spin"></i> Enviando...</>
                          ) : (
                              <><i className="fa-solid fa-paper-plane"></i> Enviar Mensagem</>
                          )}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
