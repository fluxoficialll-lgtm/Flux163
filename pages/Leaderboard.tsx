
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { relationshipService } from '../services/relationshipService';
import { User } from '../types';

interface RankedUser extends User {
    followerCount: number;
}

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [rankedUsers, setRankedUsers] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        // Use API Service Call (Scalable)
        const ranked = await relationshipService.getTopCreators();
        setRankedUsers(ranked);
        setLoading(false);
    };

    loadData();
  }, []);

  const handleUserClick = (username: string) => {
      if (!username) return;
      navigate(`/user/${username}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-x-hidden">
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter',sans-serif; }
        
        header {
            display:flex; align-items:center; padding:16px;
            background: #0c0f14; position:fixed; width:100%; z-index:10;
            border-bottom:1px solid rgba(255,255,255,0.1); top: 0; height: 65px;
        }
        header button {
            background:none; border:none; color:#fff; font-size:22px; cursor:pointer;
            transition:0.3s; padding-right: 15px;
        }
        header h1 { font-size:20px; font-weight:700; color: #FFD700; text-transform: uppercase; letter-spacing: 1px; }
        
        main {
            padding-top: 80px; padding-bottom: 40px;
            width: 100%; max-width: 600px; margin: 0 auto; padding-left: 20px; padding-right: 20px;
        }

        .top-three-container {
            display: flex; justify-content: center; align-items: flex-end; margin-bottom: 40px; gap: 15px;
        }

        .podium-item {
            display: flex; flex-direction: column; align-items: center; cursor: pointer;
            transition: transform 0.3s;
        }
        .podium-item:hover { transform: translateY(-5px); }

        .podium-avatar-wrapper {
            position: relative; margin-bottom: 10px;
        }
        
        .podium-avatar {
            border-radius: 50%; object-fit: cover; background: #333;
        }
        
        .crown-icon {
            position: absolute; top: -25px; left: 50%; transform: translateX(-50%);
            font-size: 24px; filter: drop-shadow(0 0 5px rgba(0,0,0,0.8));
        }

        .rank-badge {
            position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
            width: 24px; height: 24px; border-radius: 50%; color: #000; font-weight: 800; font-size: 14px;
            display: flex; align-items: center; justify-content: center; border: 2px solid #0c0f14;
        }

        /* 1st Place */
        .first-place .podium-avatar { width: 100px; height: 100px; border: 4px solid #FFD700; box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); }
        .first-place .crown-icon { color: #FFD700; font-size: 32px; }
        .first-place .rank-badge { background: #FFD700; }
        .first-place .podium-name { color: #FFD700; font-size: 18px; font-weight: 700; }
        
        /* 2nd Place */
        .second-place .podium-avatar { width: 80px; height: 80px; border: 3px solid #C0C0C0; box-shadow: 0 0 15px rgba(192, 192, 192, 0.3); }
        .second-place .crown-icon { color: #C0C0C0; }
        .second-place .rank-badge { background: #C0C0C0; }
        .second-place .podium-name { color: #C0C0C0; font-size: 15px; font-weight: 600; }

        /* 3rd Place */
        .third-place .podium-avatar { width: 80px; height: 80px; border: 3px solid #CD7F32; box-shadow: 0 0 15px rgba(205, 127, 50, 0.3); }
        .third-place .crown-icon { color: #CD7F32; }
        .third-place .rank-badge { background: #CD7F32; }
        .third-place .podium-name { color: #CD7F32; font-size: 15px; font-weight: 600; }

        .podium-count { font-size: 12px; color: #aaa; margin-top: 2px; }

        /* Standard List */
        .rank-list { display: flex; flex-direction: column; gap: 10px; }
        .rank-item {
            display: flex; align-items: center; padding: 15px; background: rgba(255,255,255,0.03);
            border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;
            transition: background 0.2s;
        }
        .rank-item:hover { background: rgba(255,255,255,0.08); }
        
        .rank-number {
            font-size: 16px; font-weight: 700; color: #555; width: 30px; text-align: center; margin-right: 10px;
        }
        
        .list-avatar {
            width: 45px; height: 45px; border-radius: 50%; object-fit: cover; margin-right: 15px; border: 1px solid #333;
        }
        
        .list-info { flex-grow: 1; display: flex; flex-direction: column; }
        .list-name { font-weight: 600; font-size: 15px; color: #fff; }
        .list-username { font-size: 12px; color: #888; }
        
        .list-count {
            font-weight: 700; font-size: 14px; color: #fff; background: rgba(0,194,255,0.1);
            padding: 4px 10px; border-radius: 20px; color: #00c2ff;
        }

        .empty-state {
            text-align: center; color: #555; margin-top: 50px;
        }
      `}</style>

      <header>
        <button onClick={() => navigate('/profile')} aria-label="Voltar">
            <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h1>Top Criadores</h1>
      </header>

      <main>
        {loading ? (
            <div className="text-center text-gray-500 mt-10">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-[#FFD700]"></i>
                <p>Carregando ranking...</p>
            </div>
        ) : (
            <>
                {rankedUsers.length >= 3 && (
                    <div className="top-three-container">
                        {/* 2nd Place */}
                        <div className="podium-item second-place" onClick={() => handleUserClick(rankedUsers[1].profile?.name || '')}>
                            <div className="podium-avatar-wrapper">
                                <i className="fa-solid fa-crown crown-icon"></i>
                                <img src={rankedUsers[1].profile?.photoUrl || 'https://via.placeholder.com/150'} className="podium-avatar" alt="2nd" />
                                <div className="rank-badge">2</div>
                            </div>
                            <div className="podium-name">{rankedUsers[1].profile?.nickname || rankedUsers[1].profile?.name}</div>
                            <div className="podium-count">{rankedUsers[1].followerCount} seguidores</div>
                        </div>

                        {/* 1st Place */}
                        <div className="podium-item first-place" onClick={() => handleUserClick(rankedUsers[0].profile?.name || '')}>
                            <div className="podium-avatar-wrapper">
                                <i className="fa-solid fa-crown crown-icon"></i>
                                <img src={rankedUsers[0].profile?.photoUrl || 'https://via.placeholder.com/150'} className="podium-avatar" alt="1st" />
                                <div className="rank-badge">1</div>
                            </div>
                            <div className="podium-name">{rankedUsers[0].profile?.nickname || rankedUsers[0].profile?.name}</div>
                            <div className="podium-count">{rankedUsers[0].followerCount} seguidores</div>
                        </div>

                        {/* 3rd Place */}
                        <div className="podium-item third-place" onClick={() => handleUserClick(rankedUsers[2].profile?.name || '')}>
                            <div className="podium-avatar-wrapper">
                                <i className="fa-solid fa-crown crown-icon"></i>
                                <img src={rankedUsers[2].profile?.photoUrl || 'https://via.placeholder.com/150'} className="podium-avatar" alt="3rd" />
                                <div className="rank-badge">3</div>
                            </div>
                            <div className="podium-name">{rankedUsers[2].profile?.nickname || rankedUsers[2].profile?.name}</div>
                            <div className="podium-count">{rankedUsers[2].followerCount} seguidores</div>
                        </div>
                    </div>
                )}

                <div className="rank-list">
                    {rankedUsers.slice(rankedUsers.length >= 3 ? 3 : 0).map((user, index) => {
                        const realIndex = rankedUsers.length >= 3 ? index + 4 : index + 1;
                        return (
                            <div key={user.email} className="rank-item" onClick={() => handleUserClick(user.profile?.name || '')}>
                                <div className="rank-number">#{realIndex}</div>
                                <img 
                                    src={user.profile?.photoUrl || 'https://via.placeholder.com/150'} 
                                    className="list-avatar" 
                                    alt="avatar" 
                                />
                                <div className="list-info">
                                    <span className="list-name">{user.profile?.nickname || user.profile?.name}</span>
                                    <span className="list-username">@{user.profile?.name}</span>
                                </div>
                                <div className="list-count">
                                    {user.followerCount} seg
                                </div>
                            </div>
                        );
                    })}
                </div>

                {rankedUsers.length === 0 && (
                    <div className="empty-state">
                        <i className="fa-solid fa-trophy text-4xl mb-2 opacity-30"></i>
                        <p>Nenhum usuário no ranking ainda.</p>
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};
