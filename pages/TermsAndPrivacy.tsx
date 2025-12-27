
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const TermsAndPrivacy: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

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
            padding-top: 85px; padding-bottom: 40px; width: 100%; max-width: 800px; 
            margin: 0 auto; padding-left: 20px; padding-right: 20px;
            overflow-y: auto; flex-grow: 1; -webkit-overflow-scrolling: touch;
        }

        .tabs {
            display: flex; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 4px;
            margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);
        }
        .tab-btn {
            flex: 1; padding: 12px; border: none; background: transparent; color: #aaa;
            font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 8px; transition: 0.3s;
        }
        .tab-btn.active {
            background: #00c2ff; color: #000; box-shadow: 0 2px 10px rgba(0,194,255,0.3);
        }

        .content-box {
            background: rgba(255,255,255,0.05); border-radius: 12px; padding: 25px;
            border: 1px solid rgba(255,255,255,0.05); line-height: 1.6; color: rgba(255,255,255,0.8);
            font-size: 15px; text-align: justify;
        }
        
        h2 { color: #00c2ff; font-size: 18px; margin-top: 20px; margin-bottom: 10px; font-weight: 700; }
        h2:first-child { margin-top: 0; }
        p { margin-bottom: 15px; }
        ul { list-style-type: disc; padding-left: 20px; margin-bottom: 15px; }
        li { margin-bottom: 8px; }
      `}</style>

      <header>
        <button onClick={handleBack} className="back-btn"><i className="fa-solid fa-arrow-left"></i></button>
        <h1>Termos e Privacidade</h1>
      </header>

      <main>
        <div className="tabs">
            <button className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`} onClick={() => setActiveTab('terms')}>Termos de Uso</button>
            <button className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>Privacidade</button>
        </div>

        <div className="content-box">
            {activeTab === 'terms' ? (
                <>
                    <h2>1. Aceitação dos Termos</h2>
                    <p>Ao acessar e usar o Flux, você aceita e concorda em estar vinculado aos termos e disposições deste acordo. Além disso, ao usar os serviços particulares deste aplicativo, você estará sujeito a quaisquer regras ou diretrizes publicadas aplicáveis a tais serviços.</p>

                    <h2>2. Uso do Serviço</h2>
                    <p>Você concorda em usar o serviço apenas para fins legais e de maneira que não infrinja os direitos de, restrinja ou iniba o uso e o aproveitamento do serviço por qualquer terceiro.</p>
                    <ul>
                        <li>Não é permitido publicar conteúdo ilegal, ofensivo ou pornográfico não autorizado.</li>
                        <li>O desrespeito a outros usuários pode resultar em banimento temporário ou permanente.</li>
                        <li>É proibido o uso de bots ou automação não autorizada.</li>
                    </ul>

                    <h2>3. Grupos e Conteúdo Pago</h2>
                    <p>O Flux oferece a funcionalidade de Grupos VIP e conteúdo pago. A plataforma atua como intermediária tecnológica.</p>
                    <p>Reembolsos devem ser solicitados diretamente ao criador do conteúdo ou através do suporte da plataforma em até 7 dias após a compra, conforme legislação local.</p>

                    <h2>4. Propriedade Intelectual</h2>
                    <p>Todo o conteúdo incluído no aplicativo, como texto, gráficos, logotipos, ícones de botões, imagens, clipes de áudio, downloads digitais e compilações de dados, é propriedade do Flux ou de seus fornecedores de conteúdo.</p>

                    <h2>5. Alterações nos Termos</h2>
                    <p>Reservamo-nos o direito de alterar estes termos a qualquer momento. Recomendamos que você revise esta página periodicamente para quaisquer alterações.</p>
                </>
            ) : (
                <>
                    <h2>1. Coleta de Informações</h2>
                    <p>Coletamos informações quando você se registra em nosso aplicativo, faz login, cria um grupo ou realiza uma compra. As informações coletadas incluem seu nome, e-mail, número de telefone e dados de perfil.</p>

                    <h2>2. Uso das Informações</h2>
                    <p>Qualquer informação que coletamos de você pode ser usada para:</p>
                    <ul>
                        <li>Personalizar sua experiência e responder às suas necessidades individuais.</li>
                        <li>Fornecer conteúdo publicitário personalizado.</li>
                        <li>Melhorar nosso aplicativo e atendimento ao cliente.</li>
                        <li>Processar transações com segurança.</li>
                        <li>Administrar concursos, promoções ou pesquisas.</li>
                    </ul>

                    <h2>3. Proteção de Dados</h2>
                    <p>Implementamos uma variedade de medidas de segurança para manter a segurança de suas informações pessoais. Utilizamos criptografia avançada para proteger informações sensíveis transmitidas online.</p>

                    <h2>4. Divulgação a Terceiros</h2>
                    <p>Nós não vendemos, trocamos ou transferimos suas informações pessoais identificáveis para terceiros. Isso não inclui terceiros de confiança que nos auxiliam na operação do nosso aplicativo (ex: processadores de pagamento como SyncPay), desde que essas partes concordem em manter essas informações confidenciais.</p>

                    <h2>5. Exclusão de Dados</h2>
                    <p>Você tem o direito de solicitar a exclusão de seus dados pessoais a qualquer momento através das configurações do aplicativo ou entrando em contato com nosso suporte.</p>
                </>
            )}
        </div>
      </main>
    </div>
  );
};