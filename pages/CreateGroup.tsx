
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export const CreateGroup: React.FC = () => {
  const navigate = useNavigate();

  const handleVipClick = () => {
      // Navigation is now always allowed. Validation happens on the CreateVipGroup page.
      navigate('/create-group/vip');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        /* Estilos globais e resets - Mantidos do original */
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }

        /* HEADER FIXO SÓLIDO */
        header {
            display:flex; align-items:center; justify-content:space-between; padding:16px 32px;
            background: #0c0f14; position:fixed; width:100%; z-index:10; border-bottom:1px solid rgba(255,255,255,0.1);
            top: 0; left: 0; height: 80px;
        }
        header button {
            background:none; border:none; color:#00c2ff; font-size:18px; cursor:pointer; transition:0.3s;
        }
        header button:hover { color:#fff; }

        /* Estilos do MAIN */
        main { 
            flex-grow:1; display:flex; flex-direction:column; align-items:center; 
            justify-content:flex-start; width:100%; padding-top: 120px; 
            padding-bottom: 40px; 
        }
        
        /* Container principal do formulário/seleção */
        #creationContainer {
            width:100%; max-width:600px; padding: 0 20px;
        }
        
        h1.page-title {
            font-size: 28px; text-align: center; margin-bottom: 30px; 
            color: #00c2ff; text-shadow: 0 0 10px rgba(0,194,255,0.3);
        }

        /* CARD DE SELEÇÃO DE TIPO */
        .group-type-card {
            background: rgba(255,255,255,0.05);
            border: 2px solid rgba(0,194,255,0.2);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .group-type-card:hover {
            background: rgba(0,194,255,0.15);
            border-color: #00c2ff;
            box-shadow: 0 6px 20px rgba(0,194,255,0.4);
        }

        .group-type-card h2 {
            font-size: 20px; margin-bottom: 5px; display: flex; align-items: center; gap: 10px;
        }
        .group-type-card p {
            font-size: 14px; color: #aaa; margin-left: 30px; /* Alinhamento visual */
        }
        
        /* Cores dos ícones */
        .public i { color: #00c2ff; }
        .private i { color: #ff5722; } /* Laranja para indicar restrição */
        .vip i { 
            background: -webkit-linear-gradient(145deg, #FFD700, #B8860B); 
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 22px;
        }
      `}</style>

      <header>
        <button onClick={() => navigate('/groups')}>
            <i className="fa-solid fa-arrow-left"></i>
        </button>

        {/* Standardized Logo */}
        <div 
            className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]"
            onClick={() => navigate('/feed')}
        >
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <button style={{marginLeft:'auto'}} onClick={() => navigate('/messages')}>
            <i className="fa-solid fa-message"></i>
        </button>
      </header>

      <main id="mainContent">
        <div id="creationContainer">
            <h1 className="page-title">Criar Novo Grupo</h1>

            <div className="group-type-card public" onClick={() => navigate('/create-group/public')}>
                <h2><i className="fa-solid fa-globe"></i> Grupo Público (Aberto)</h2>
                <p>Qualquer pessoa pode encontrar e entrar no grupo. Ideal para comunidades e interesses gerais.</p>
            </div>

            <div className="group-type-card private" onClick={() => navigate('/create-group/private')}>
                <h2><i className="fa-solid fa-lock"></i> Grupo Privado (Fechado)</h2>
                <p>Visível por todos, mas requer aprovação ou convite para entrar. Ideal para times e família.</p>
            </div>

            <div className="group-type-card vip" onClick={handleVipClick}>
                <h2><i className="fa-solid fa-crown"></i> Grupo VIP (Assinatura)</h2>
                <p>Requer pagamento ou assinatura para ter acesso ao conteúdo exclusivo. (Tag VIP Dourada).</p>
            </div>

        </div>
      </main>
    </div>
  );
};
