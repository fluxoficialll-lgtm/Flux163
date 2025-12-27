import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reelsService } from '../services/reelsService';
import { authService } from '../services/authService';
import { Post } from '../types';

type CategoryFilter = 'relevant' | 'recent' | 'watched' | 'unwatched' | 'liked';

export const ReelsSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('relevant');
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const email = authService.getCurrentUserEmail();
    if(email) setCurrentUserEmail(email);
  }, []);

  // Use Effect with Debounce for Search
  useEffect(() => {
    setLoading(true);
    
    const timeoutId = setTimeout(() => {
        // Use the new Intelligent Search Algorithm from Service
        const searchResults = reelsService.searchReels(
            searchTerm, 
            activeCategory, 
            currentUserEmail
        );
        
        setResults(searchResults);
        setLoading(false);
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeCategory, currentUserEmail]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        /* Header Search */
        header {
            display: flex; flex-direction: column; gap: 10px; padding: 16px 20px;
            background: #0c0f14; position: fixed; width: 100%; z-index: 20;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1); top: 0;
        }
        .top-row {
            display: flex; align-items: center; gap: 15px; width: 100%;
        }
        header button.back-btn {
            background: none; border: none; color: #00c2ff; font-size: 20px; cursor: pointer;
        }
        .search-input-wrapper {
            flex-grow: 1; position: relative;
        }
        .search-input-wrapper i {
            position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #aaa;
        }
        .search-input-wrapper input {
            width: 100%; padding: 10px 12px 10px 40px; background: #1a1e26;
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
            color: #fff; font-size: 14px; outline: none; transition: 0.3s;
        }
        .search-input-wrapper input:focus {
            border-color: #00c2ff; box-shadow: 0 0 10px rgba(0, 194, 255, 0.2);
        }

        /* Filters Bar */
        .filters-row {
            display: flex; gap: 8px; overflow-x: auto; width: 100%; padding-bottom: 5px;
            scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .filters-row::-webkit-scrollbar { display: none; }
        
        .filter-chip {
            padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
            color: #aaa; white-space: nowrap; cursor: pointer; transition: 0.3s;
            display: flex; align-items: center; gap: 5px;
        }
        .filter-chip:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .filter-chip.active {
            background: #00c2ff; color: #000; border-color: #00c2ff; box-shadow: 0 0 10px rgba(0, 194, 255, 0.3);
        }

        /* Grid Layout */
        main {
            padding-top: 120px; padding-bottom: 20px; width: 100%;
        }
        .reels-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr); /* 2 Colunas tipo TikTok */
            gap: 8px;
            padding: 0 8px;
        }
        
        .reel-card {
            position: relative;
            width: 100%;
            aspect-ratio: 9/16; /* Formato Vertical */
            background: #1a1e26;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .reel-card video {
            width: 100%; height: 100%; object-fit: cover;
        }
        
        .card-overlay {
            position: absolute; bottom: 0; left: 0; width: 100%;
            background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
            padding: 10px;
            display: flex; flex-direction: column; justify-content: flex-end;
        }
        
        .overlay-stats {
            display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; color: #ddd;
        }
        .reel-desc-snippet {
            font-size: 12px; color: #fff; margin-bottom: 4px; font-weight: 500;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .play-icon-center {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 30px; color: rgba(255, 255, 255, 0.8); opacity: 0.7;
        }
        
        .watched-badge {
            position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6);
            padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #aaa;
            display: flex; align-items: center; gap: 3px;
        }
      `}</style>

      <header>
        <div className="top-row">
            <button className="back-btn" onClick={() => navigate('/reels')}><i className="fa-solid fa-arrow-left"></i></button>
            <div className="search-input-wrapper">
                <i className={`fa-solid ${loading ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'}`}></i>
                <input 
                    type="text" 
                    placeholder="Buscar vídeos..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
        </div>
        
        <div className="filters-row">
            <button 
                className={`filter-chip ${activeCategory === 'relevant' ? 'active' : ''}`}
                onClick={() => setActiveCategory('relevant')}
            >
                <i className="fa-solid fa-fire"></i> Relevantes
            </button>
            <button 
                className={`filter-chip ${activeCategory === 'recent' ? 'active' : ''}`}
                onClick={() => setActiveCategory('recent')}
            >
                <i className="fa-regular fa-clock"></i> Recentes
            </button>
            <button 
                className={`filter-chip ${activeCategory === 'watched' ? 'active' : ''}`}
                onClick={() => setActiveCategory('watched')}
            >
                <i className="fa-regular fa-eye"></i> Assistidos
            </button>
            <button 
                className={`filter-chip ${activeCategory === 'unwatched' ? 'active' : ''}`}
                onClick={() => setActiveCategory('unwatched')}
            >
                <i className="fa-regular fa-eye-slash"></i> Não Assistidos
            </button>
            <button 
                className={`filter-chip ${activeCategory === 'liked' ? 'active' : ''}`}
                onClick={() => setActiveCategory('liked')}
            >
                <i className="fa-solid fa-heart"></i> Curtidos
            </button>
        </div>
      </header>

      <main>
        {loading && results.length === 0 ? (
             <div className="flex justify-center items-center h-40">
                 <div className="text-[#00c2ff]">Buscando...</div>
             </div>
        ) : (
            <>
                <div className="reels-grid">
                    {results.map(reel => {
                        const isWatched = currentUserEmail && reel.viewedBy?.includes(currentUserEmail);
                        
                        return (
                            <div key={reel.id} className="reel-card" onClick={() => navigate(`/reels/${reel.id}`)}>
                                <video src={reel.video} muted playsInline loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                                
                                {isWatched && (
                                    <div className="watched-badge">
                                        <i className="fa-solid fa-check"></i> Visto
                                    </div>
                                )}

                                <div className="play-icon-center"><i className="fa-regular fa-circle-play"></i></div>
                                
                                <div className="card-overlay">
                                    <div className="reel-desc-snippet">{reel.title || reel.text}</div>
                                    <div className="overlay-stats">
                                        <span><i className="fa-regular fa-eye"></i> {reel.views}</span>
                                        <span><i className="fa-solid fa-heart" style={{color: reel.liked ? '#ff4d4d' : 'inherit'}}></i> {reel.likes}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {results.length === 0 && !loading && (
                    <div className="text-center text-gray-500 mt-10 p-5">
                        <i className="fa-solid fa-video-slash text-4xl mb-3 opacity-50"></i>
                        <p>{searchTerm ? 'Nenhum vídeo encontrado para sua busca.' : 'Nenhum vídeo encontrado nesta categoria.'}</p>
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};