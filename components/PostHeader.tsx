
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface PostHeaderProps {
    username: string;
    time: string;
    location?: string;
    isAdult?: boolean;
    isAd?: boolean;
    onClick: () => void;
    isOwner: boolean;
    onDelete: (e: React.MouseEvent) => void;
    authorEmail?: string; // Optional email for stable resolution
}

export const PostHeader: React.FC<PostHeaderProps> = ({ 
    username, 
    time, 
    location, 
    isAdult, 
    isAd, 
    onClick, 
    isOwner, 
    onDelete,
    authorEmail
}) => {
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState(username || "Usuário");
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        if (!username) return;
        const fetchUserData = async () => {
            const user = await authService.fetchUserByHandle(username, authorEmail);
            if (user) {
                setDisplayName(user.profile?.nickname || user.profile?.name || username);
                setAvatarUrl(user.profile?.photoUrl);
            }
        };
        fetchUserData();
    }, [username, authorEmail]);

    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const cleanHandle = username.replace('@', '').toLowerCase();
        // URLs visíveis não mudam, mas passamos authorEmail no state como fallback silencioso
        navigate(`/user/${cleanHandle}`, { state: { emailFallback: authorEmail } });
    };

    return (
        <div className="flex items-center justify-between mb-3 relative px-4 pt-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={handleProfileClick}>
                {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} loading="lazy" className="w-10 h-10 rounded-full border border-white/10 object-cover bg-[#1e2531]" />
                ) : (
                    <div className="w-10 h-10 rounded-full border border-white/10 bg-[#1e2531] flex items-center justify-center text-[#00c2ff]">
                        <i className="fa-solid fa-user"></i>
                    </div>
                )}
                <div className="flex flex-col">
                    <span className="font-semibold text-base hover:text-[#00c2ff] transition-colors flex items-center gap-2 text-white">
                        {displayName}
                        {isAdult && <span className="bg-[#ff4d4d] text-white text-[9px] font-bold px-1.5 rounded ml-1.5">18+</span>}
                        {isAd && <span className="bg-white/15 text-gray-300 text-[9px] font-semibold px-1.5 rounded ml-1.5 border border-white/10">Patrocinado</span>}
                    </span>
                    <div className="flex flex-col">
                        <span className="text-xs text-[#aaa]">{isAd ? 'Publicidade' : time}</span>
                        {location && (
                            <span className="text-[11px] text-[#00c2ff] flex items-center gap-1 mt-0.5">
                                <i className="fa-solid fa-location-dot text-[9px]"></i> {location}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {isOwner && (
                <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="text-gray-400 p-2 hover:text-white transition-colors">
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
                            <div className="absolute right-0 top-8 bg-[#1a1e26] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden w-32" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => { onDelete(e); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-red-400 hover:bg-white/5 text-sm font-semibold flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-trash-can"></i> Excluir
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
