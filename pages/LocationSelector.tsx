
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface DetectedLocation {
    city: string;
    region: string; // Estado
    country_name: string;
    ip: string;
}

export const LocationSelector: React.FC = () => {
  const navigate = useNavigate();
  
  // Auto Detection States
  const [isLoadingIP, setIsLoadingIP] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const clearFilter = () => {
      // Explicitly set to 'Global' or remove item. 
      // Removing allows default fallback, but setting 'Global' is explicit.
      localStorage.setItem('feed_location_filter', 'Global');
      navigate('/feed');
  };

  // --- LÓGICA DE DETECÇÃO DE IP ROBUSTA ---
  const detectLocation = async () => {
      setIsLoadingIP(true);
      setErrorMsg('');
      setDetectedLocation(null);

      try {
          let data;
          
          // 1. Tenta API Principal (ipapi.co)
          try {
              const response = await fetch('https://ipapi.co/json/');
              if (!response.ok) throw new Error('Network response was not ok');
              data = await response.json();
              if (data.error) throw new Error('API Error');
          } catch (e) {
              console.warn("ipapi.co falhou ou bloqueado, tentando fallback ipwho.is...");
              
              // 2. Tenta API Fallback (ipwho.is) - Ótima para evitar erros de CORS/AdBlock
              const response = await fetch('https://ipwho.is/');
              if (!response.ok) throw new Error('Backup API failed');
              const fallbackData = await response.json();
              
              if (!fallbackData.success) throw new Error('GeoIP lookup failed');

              // Normaliza para o formato padrão
              data = {
                  city: fallbackData.city,
                  region: fallbackData.region,
                  country_name: fallbackData.country,
                  ip: fallbackData.ip
              };
          }

          if (!data || !data.country_name) {
              throw new Error("Dados de localização incompletos.");
          }

          setDetectedLocation({
              city: data.city,
              region: data.region, 
              country_name: data.country_name,
              ip: data.ip
          });

      } catch (error) {
          console.error("Erro na detecção:", error);
          setErrorMsg("Não foi possível detectar sua localização automaticamente.");
      } finally {
          setIsLoadingIP(false);
      }
  };

  const selectDetectedLevel = (level: 'city' | 'region' | 'country') => {
      if (!detectedLocation) return;

      let filterValue = '';
      
      switch (level) {
          case 'city':
              filterValue = detectedLocation.city;
              break;
          case 'region':
              filterValue = detectedLocation.region;
              break;
          case 'country':
              filterValue = detectedLocation.country_name;
              break;
      }

      localStorage.setItem('feed_location_filter', filterValue);
      navigate('/feed');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        
        header {
            display:flex; align-items:center; padding:16px 32px;
            background: #0c0f14; position:fixed; width:100%; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); top: 0; height: 65px;
        }
        header button {
            background:none; border:none; color:#fff; font-size:22px; cursor:pointer;
            transition:0.3s; padding-right: 15px;
        }
        header h1 { font-size:18px; font-weight:600; color: #00c2ff; }
        
        main {
            padding-top: 90px; padding-bottom: 40px;
            width: 100%; max-width: 500px; margin: 0 auto; padding-left: 20px; padding-right: 20px;
            display: flex; flex-direction: column; gap: 25px;
        }

        .location-card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 24px;
            display: flex; flex-direction: column; gap: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        h2 { font-size: 16px; color: #fff; margin-bottom: 5px; font-weight: 600; }
        p.desc { font-size: 13px; color: #aaa; margin-bottom: 10px; line-height: 1.4; }

        .auto-location-btn {
            background: rgba(0, 194, 255, 0.1);
            border: 1px solid #00c2ff;
            color: #00c2ff;
            padding: 14px;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 10px;
            transition: 0.3s;
        }
        .auto-location-btn:hover { background: rgba(0, 194, 255, 0.2); }
        
        /* DETECTED OPTIONS */
        .detected-options-grid {
            display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 10px;
            animation: fadeIn 0.5s ease;
        }
        
        .level-btn {
            background: #1a1e26; border: 1px solid rgba(255,255,255,0.1);
            padding: 15px; border-radius: 12px; text-align: left;
            cursor: pointer; transition: 0.3s; display: flex; align-items: center;
            justify-content: space-between;
        }
        .level-btn:hover { border-color: #00c2ff; background: rgba(0,194,255,0.05); }
        
        .level-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .level-value { font-size: 16px; font-weight: 700; color: #fff; }
        .level-icon { font-size: 18px; color: #00c2ff; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .clear-btn {
            background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.1);
            padding: 16px; border-radius: 12px; font-weight: 700;
            font-size: 15px; cursor: pointer; transition: 0.3s; text-align: center;
            display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .clear-btn:hover { border-color: #00c2ff; color: #00c2ff; background: rgba(0,194,255,0.05); }
      `}</style>

      <header>
        <button onClick={() => navigate('/feed')} aria-label="Voltar">
            <i className="fa-solid fa-xmark"></i>
        </button>
        <h1>Explorar por Localização</h1>
      </header>

      <main>
        {/* Auto Location */}
        <div className="location-card">
            <div>
                <h2><i className="fa-solid fa-satellite-dish" style={{color:'#00c2ff', marginRight:'8px'}}></i> Detecção Automática</h2>
                <p className="desc">Identifique seu IP e escolha o nível de alcance que deseja ver.</p>
            </div>
            
            {!detectedLocation ? (
                <>
                    <button className="auto-location-btn" onClick={detectLocation} disabled={isLoadingIP}>
                        {isLoadingIP ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-location-crosshairs"></i>}
                        {isLoadingIP ? 'Detectando...' : 'Detectar Minha Localização'}
                    </button>
                    {errorMsg && <p style={{color:'#ff4d4d', fontSize:'12px', marginTop:'10px', textAlign:'center'}}>{errorMsg}</p>}
                </>
            ) : (
                <div className="detected-options-grid">
                    <p style={{fontSize:'14px', color:'#00ff82', marginBottom:'5px', textAlign:'center'}}>
                        <i className="fa-solid fa-check-circle"></i> Localização Identificada!
                    </p>
                    
                    {/* Opção 1: Município */}
                    <div className="level-btn" onClick={() => selectDetectedLevel('city')}>
                        <div>
                            <div className="level-label">Município</div>
                            <div className="level-value">Ver só {detectedLocation.city}</div>
                        </div>
                        <i className="fa-solid fa-city level-icon"></i>
                    </div>

                    {/* Opção 2: Estado */}
                    <div className="level-btn" onClick={() => selectDetectedLevel('region')}>
                        <div>
                            <div className="level-label">Estado / Região</div>
                            <div className="level-value">Ver todo {detectedLocation.region}</div>
                        </div>
                        <i className="fa-solid fa-map level-icon"></i>
                    </div>

                    {/* Opção 3: País */}
                    <div className="level-btn" onClick={() => selectDetectedLevel('country')}>
                        <div>
                            <div className="level-label">País</div>
                            <div className="level-value">Ver {detectedLocation.country_name} inteiro</div>
                        </div>
                        <i className="fa-solid fa-globe level-icon"></i>
                    </div>

                    <button 
                        onClick={() => setDetectedLocation(null)} 
                        style={{background:'none', border:'none', color:'#aaa', fontSize:'12px', marginTop:'10px', cursor:'pointer'}}
                    >
                        Detectar novamente
                    </button>
                </div>
            )}
        </div>

        <button className="clear-btn" onClick={clearFilter}>
            <i className="fa-solid fa-earth-americas"></i> Modo Global (Ver Tudo)
        </button>

      </main>
    </div>
  );
};
