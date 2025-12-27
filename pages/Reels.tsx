import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { reelsService } from '../services/reelsService';
import { postService } from '../services/postService';
import { authService } from '../services/authService';
import { recommendationService } from '../services/recommendationService';
import { notificationService } from '../services/notificationService';
import { chatService } from '../services/chatService';
import { groupService } from '../services/groupService';
import { Post, Comment, Group } from '../types';
import { db } from '@/database';
import { useModal } from '../components/ModalSystem';

const flattenReplies = (replies?: Comment[]): Comment[] => {
    if (!replies || replies.length === 0) return [];
    let acc: Comment[] = [];
    replies.forEach(reply => {
        acc.push(reply);
        if (reply.replies && reply.replies.length > 0) {
            acc = [...acc, ...flattenReplies(reply.replies)];
        }
    });
    return acc;
};

interface ReelCommentNodeProps {
    comment: Comment;
    onReplyClick: (commentId: string, username: string) => void;
    onLike: (commentId: string) => void;
    onDelete: (commentId: string) => void;
    onUserClick: (username: string) => void;
    getDisplayName: (username: string) => string;
    getUserAvatar: (username: string) => string | undefined;
    depth?: number;
    currentUserHandle: string;
}

const ReelCommentNode: React.FC<ReelCommentNodeProps> = ({ 
    comment, 
    onReplyClick, 
    onLike, 
    onDelete,
    onUserClick, 
    getDisplayName, 
    getUserAvatar, 
    depth = 0,
    currentUserHandle
}) => {
    const isLevel0 = depth === 0;
    const isOwner = comment.username === currentUserHandle;

    const allDescendants = useMemo(() => isLevel0 ? flattenReplies(comment.replies) : [], [comment.replies, isLevel0]);
    const totalReplies = allDescendants.length;

    const [visibleCount, setVisibleCount] = useState(0);
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    
    const displayName = getDisplayName(comment.username);
    const avatarUrl = comment.avatar || getUserAvatar(comment.username);
    
    const TEXT_LIMIT = 100;
    const isLongText = comment.text.length > TEXT_LIMIT;
    const displayedText = isLongText && !isTextExpanded 
        ? comment.text.slice(0, TEXT_LIMIT) + '...' 
        : comment.text;

    const handleShowMoreReplies = (e: React.MouseEvent) => {
        e.stopPropagation();
        setVisibleCount(prev => Math.min(prev + 3, totalReplies));
    };

    const handleHideReplies = (e: React.MouseEvent) => {
        e.stopPropagation();
        setVisibleCount(0);
    };
    
    const avatarSize = isLevel0 ? 'w-8 h-8' : 'w-6 h-6';
    const textSize = 'text-[13px]';

    const repliesToRender = isLevel0 
        ? allDescendants.slice(0, visibleCount) 
        : [];

    return (
        <div className={`flex flex-col relative animate-fade-in ${isLevel0 ? 'mb-4' : 'mb-3'}`}>
            <div className="flex gap-3 items-start relative z-10">
                {avatarUrl ? (
                    <img 
                        src={avatarUrl} 
                        className={`${avatarSize} rounded-full object-cover flex-shrink-0 cursor-pointer border border-white/10`} 
                        alt={displayName} 
                        onClick={(e) => { e.stopPropagation(); onUserClick(comment.username); }}
                    />
                ) : (
                    <div 
                        className={`${avatarSize} rounded-full bg-[#333] flex items-center justify-center text-[#aaa] text-xs flex-shrink-0 cursor-pointer border border-white/10`} 
                        onClick={(e) => { e.stopPropagation(); onUserClick(comment.username); }}
                    >
                        <i className="fa-solid fa-user"></i>
                    </div>
                )}
                
                <div className="flex-grow min-w-0">
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="text-[12px] font-bold text-white/90 cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); onUserClick(comment.username); }}>
                                {displayName}
                            </div>
                            {isOwner && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
                                    className="text-gray-600 hover:text-red-500 transition-colors p-1"
                                >
                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                </button>
                            )}
                        </div>
                        <div className={`${textSize} leading-snug text-white/90 whitespace-pre-wrap break-words font-light`}>
                            {displayedText}
                            {isLongText && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsTextExpanded(!isTextExpanded); }}
                                    className="text-gray-400 text-xs ml-1 hover:text-white bg-transparent border-none cursor-pointer font-semibold"
                                >
                                    {isTextExpanded ? 'ler menos' : 'ler mais'}
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400 font-medium items-center">
                        <span className="opacity-70">{postService.formatRelativeTime(comment.timestamp)}</span>
                        <button 
                            className="bg-transparent border-none text-gray-400 p-0 cursor-pointer hover:text-white font-semibold" 
                            onClick={(e) => { e.stopPropagation(); onReplyClick(comment.id, comment.username); }}
                        >
                            Responder
                        </button>
                        <button 
                            className={`bg-transparent border-none p-0 cursor-pointer flex items-center gap-1 transition-colors hover:text-white ml-auto ${comment.likedByMe ? 'text-[#ff4d4d]' : 'text-gray-500'}`} 
                            onClick={(e) => { e.stopPropagation(); onLike(comment.id); }}
                        >
                            {comment.likedByMe ? <i className="fa-solid fa-heart"></i> : <i className="fa-regular fa-heart"></i>}
                            {comment.likes && comment.likes > 0 && <span>{comment.likes}</span>}
                        </button>
                    </div>
                </div>
            </div>
            
            {isLevel0 && totalReplies > 0 && (
                <div className="relative pl-[44px] mt-2">
                    
                    {repliesToRender.map(reply => (
                        <ReelCommentNode 
                            key={reply.id} 
                            comment={reply} 
                            onReplyClick={onReplyClick} 
                            onLike={onLike} 
                            onDelete={onDelete}
                            onUserClick={onUserClick}
                            getDisplayName={getDisplayName}
                            getUserAvatar={getUserAvatar}
                            depth={1} 
                            currentUserHandle={currentUserHandle}
                        />
                    ))}

                    {visibleCount < totalReplies ? (
                        <button 
                            className="flex items-center gap-3 mt-1 mb-2 group bg-transparent border-none p-0 cursor-pointer w-full"
                            onClick={handleShowMoreReplies}
                        >
                            <div className="w-8 h-[1px] bg-gray-600 group-hover:bg-gray-400 transition-colors"></div>
                            <span className="text-[11px] font-semibold text-gray-500 group-hover:text-gray-300 transition-colors flex items-center gap-1">
                                {visibleCount === 0 ? `Ver ${totalReplies} respostas` : `Ler mais`}
                                <i className="fa-solid fa-chevron-down text-[9px]"></i>
                            </span>
                        </button>
                    ) : (
                        visibleCount > 0 && (
                            <button 
                                onClick={handleHideReplies}
                                className="flex items-center gap-3 mt-1 mb-2 group bg-transparent border-none p-0 cursor-pointer"
                            >
                                <div className="w-8 h-[1px] bg-gray-600"></div>
                                <span className="text-[11px] font-semibold text-gray-500 group-hover:text-gray-300">
                                    Ocultar
                                    <i className="fa-solid fa-chevron-up text-[9px] ml-1"></i>
                                </span>
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

const ReelItem: React.FC<{
    reel: Post;
    isActive: boolean;
    onLike: () => void;
    onComment: () => void;
    onShare: () => void;
    onDelete: () => void; 
    onUserClick: () => void;
    getDisplayName: (name: string) => string;
    getUserAvatar: (name: string) => string | undefined;
    expanded: boolean;
    toggleReadMore: (e: React.MouseEvent) => void;
    reportWatchTime: (id: string) => void;
    onCtaClick: (link?: string) => void;
    onGroupClick: (groupId: string, group: Group) => void;
    isOwner: boolean; 
}> = ({ reel, isActive, onLike, onComment, onShare, onDelete, onUserClick, getDisplayName, getUserAvatar, expanded, toggleReadMore, reportWatchTime, onCtaClick, onGroupClick, isOwner }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [linkedGroup, setLinkedGroup] = useState<Group | null>(null);
    
    const getVideoSrc = (src?: string) => {
        if (!src) return '';
        if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) return src;
        return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
    };

    const videoSrc = getVideoSrc(reel.video);

    useEffect(() => {
        if (reel.relatedGroupId) {
            const g = groupService.getGroupById(reel.relatedGroupId);
            setLinkedGroup(g || null);
        } else {
            setLinkedGroup(null);
        }
    }, [reel.relatedGroupId]);

    useEffect(() => {
        let isMounted = true;
        if (isActive) {
            if (videoRef.current && !hasError && videoSrc) {
                const playPromise = videoRef.current.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            if (isMounted) {
                                setIsPlaying(true);
                                reportWatchTime(reel.id);
                            }
                        })
                        .catch((error) => {
                            if (!isMounted) return;
                            if (error.name === 'NotAllowedError') {
                                setIsPlaying(false);
                                if (videoRef.current) {
                                    videoRef.current.muted = true;
                                    setIsMuted(true);
                                    videoRef.current.play().catch(e => {});
                                }
                            } else if (error.name !== 'AbortError') {
                                setIsPlaying(false);
                            }
                        });
                }
            }
        } else {
            if (videoRef.current) {
                videoRef.current.pause();
                if (isMounted) setIsPlaying(false);
                if (!videoRef.current.paused && !Number.isNaN(videoRef.current.duration)) {
                    videoRef.current.currentTime = 0; 
                }
            }
        }
        return () => { isMounted = false; };
    }, [isActive, hasError, videoSrc, reel.id, reportWatchTime]);

    const handleVideoClick = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

    const displayName = getDisplayName(reel.username);
    const avatar = getUserAvatar(reel.username);

    const getGroupBtnStyle = (group: Group) => {
        if (group.isVip) {
            return {
                background: 'linear-gradient(90deg, #FFD700, #B8860B)',
                color: '#000',
                border: 'none',
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                fontWeight: '800'
            };
        }
        return {
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)'
        };
    };

    return (
        <div className="reel">
            {isActive && isBuffering && !hasError && videoSrc && (
                <div className="absolute z-10 flex items-center justify-center pointer-events-none" style={{top:'50%', left:'50%', transform:'translate(-50%, -50%)'}}>
                    <i className="fa-solid fa-circle-notch fa-spin text-4xl text-white/80"></i>
                </div>
            )}

            {!isPlaying && !isBuffering && !hasError && videoSrc && (
                <div className="absolute z-10 pointer-events-none bg-black/30 rounded-full p-4 backdrop-blur-sm" style={{top:'50%', left:'50%', transform:'translate(-50%, -50%)'}}>
                    <i className="fa-solid fa-play text-4xl text-white/90 pl-1"></i>
                </div>
            )}

            {videoSrc && !hasError ? (
                <video
                    ref={videoRef}
                    src={videoSrc}
                    loop
                    muted={isMuted}
                    playsInline
                    webkit-playsinline="true"
                    preload="auto"
                    className="reel-video"
                    onWaiting={() => setIsBuffering(true)}
                    onPlaying={() => setIsBuffering(false)}
                    onLoadedData={() => setIsBuffering(false)}
                    onError={(e) => {
                        if (videoSrc) {
                            setHasError(true);
                            setIsBuffering(false);
                        }
                    }}
                    onClick={handleVideoClick}
                />
            ) : reel.image ? (
                <img src={reel.image} alt="Reel Content" className="reel-video object-cover" />
            ) : (
                <div className="video-error">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <p>Conteúdo indisponível</p>
                    <button onClick={() => { setHasError(false); setIsBuffering(true); }} className="retry-btn">
                        <i className="fa-solid fa-rotate-right"></i> Recarregar
                    </button>
                </div>
            )}

            <div className="reel-actions">
                <button onClick={onLike}>
                    <i className={`fa-solid fa-heart ${reel.liked ? 'liked-heart' : ''}`}></i>
                    <span>{reel.likes}</span>
                </button>
                <button onClick={onComment}>
                    <i className="fa-solid fa-comment-dots"></i>
                    <span>{reel.comments}</span>
                </button>
                <button onClick={onShare}>
                    <i className="fa-solid fa-share"></i>
                </button>
                {isOwner && (
                    <button onClick={onDelete} style={{color: '#ff4d4d'}}>
                        <i className="fa-solid fa-trash"></i>
                    </button>
                )}
                <button onClick={toggleMute}>
                    <i className={`fa-solid ${isMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                </button>
            </div>

            <div className="reel-desc-overlay">
                {linkedGroup && (
                    <button 
                        className="reel-group-btn" 
                        onClick={() => onGroupClick(linkedGroup.id, linkedGroup)}
                        style={getGroupBtnStyle(linkedGroup)}
                    >
                        <i className={`fa-solid ${linkedGroup.isVip ? 'fa-crown' : 'fa-users'}`} style={{color: linkedGroup.isVip ? '#000' : 'inherit'}}></i>
                        <span style={{maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: linkedGroup.isVip ? 'uppercase' : 'none'}}>
                            {linkedGroup.isVip ? `Desbloquear VIP: ${linkedGroup.name}` : linkedGroup.name}
                        </span>
                        <i className="fa-solid fa-chevron-right" style={{fontSize: '10px'}}></i>
                    </button>
                )}

                <div className="reel-username" onClick={onUserClick}>
                    {avatar ? <img src={avatar} className="reel-user-avatar" /> : <i className="fa-solid fa-circle-user" style={{ fontSize: '30px' }}></i>}
                    {displayName}
                    {reel.isAdultContent && <span className="adult-badge">18+</span>}
                    {reel.isAd && <span className="sponsored-badge">Patrocinado</span>}
                </div>
                {reel.title && <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{reel.title}</div>}
                <div className="reel-title">
                    {expanded ? reel.text : (
                        <>{reel.text.slice(0, 60)}{reel.text.length > 60 && <span className="reel-read-more" onClick={toggleReadMore}>mais</span>}</>
                    )}
                </div>
                
                {reel.isAd && reel.ctaLink && (
                    <button className="reel-cta-btn" onClick={() => onCtaClick(reel.ctaLink)}>
                        {reel.ctaText || 'Saiba Mais'} <i className="fa-solid fa-arrow-right"></i>
                    </button>
                )}

                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-play"></i> {reel.views} visualizações
                </div>
            </div>
        </div>
    );
};

export const Reels: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navState = location.state as { authorHandle?: string } | null;
  const { showConfirm } = useModal();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [reels, setReels] = useState<Post[]>([]);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [expandedReels, setExpandedReels] = useState<Set<string>>(new Set());

  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activeReelId, setActiveReelId] = useState<string | null>(null);
  const [currentComments, setCurrentComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  
  const [replyingTo, setReplyingTo] = useState<{ id: string, username: string } | null>(null);

  const viewedReels = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<number>(0); 
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(undefined);
  const currentUser = authService.getCurrentUser();
  const currentUserHandle = currentUser?.profile?.name ? `@${currentUser.profile.name}` : "";

  useEffect(() => {
    const userEmail = authService.getCurrentUserEmail();
    setCurrentUserEmail(userEmail || undefined);
    
    const loadReels = async () => {
        const allowAdult = localStorage.getItem('settings_18_plus') === 'true';
        let videoPosts: Post[] = [];

        // Verifica se estamos em um contexto de perfil isolado
        if (navState?.authorHandle) {
            videoPosts = reelsService.getReelsByAuthor(navState.authorHandle, allowAdult);
        } else {
            // Feed recomendado/global padrão
            videoPosts = reelsService.getReels(userEmail || undefined, allowAdult);
            
            // Se um ID foi passado e não está no feed recomendado, buscamos especificamente ele
            if (id && !videoPosts.find(r => r.id === id)) {
                const specificReel = postService.getPostById(id);
                if (specificReel && specificReel.type === 'video') {
                    // Injetamos no início para foco imediato
                    videoPosts = [specificReel, ...videoPosts];
                }
            }
        }
        
        setReels(videoPosts);
    };

    loadReels();
    const unsubscribe = db.subscribe('posts', loadReels);
    return () => unsubscribe();
  }, [id, navState]);

  // Efeito para scroll automático quando um Reel específico é aberto
  useEffect(() => {
    if (id && reels.length > 0) {
        const index = reels.findIndex(r => r.id === id);
        if (index !== -1) {
            setTimeout(() => {
                const element = containerRef.current?.querySelector(`[data-index="${index}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'auto' });
                    setActiveReelIndex(index);
                }
            }, 100);
        }
    }
  }, [id, reels]);

  const reportWatchTime = (reelId: string) => {
      const userEmail = authService.getCurrentUserEmail();
      if (!reelId || !startTimeRef.current || !userEmail) return;

      const duration = (Date.now() - startTimeRef.current) / 1000; 
      const reel = reels.find(r => r.id === reelId);
      if (reel) {
          recommendationService.recordInteraction(userEmail, reel, 'view_time', duration);
      }
      startTimeRef.current = Date.now();
  };

  useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const index = Number(entry.target.getAttribute('data-index'));
                  setActiveReelIndex(index);
                  
                  const reel = reels[index];
                  if (reel && !viewedReels.current.has(reel.id)) {
                      viewedReels.current.add(reel.id);
                      const email = authService.getCurrentUserEmail();
                      // Fix for reported error on line 534: Expected 1 arguments, but got 2.
                      reelsService.incrementView(reel.id);
                  }
                  
                  startTimeRef.current = Date.now();
              }
          });
      }, { threshold: 0.6 });

      const elements = container.querySelectorAll('.reel-container-wrapper');
      elements.forEach(el => observer.observe(el));

      return () => observer.disconnect();
  }, [reels]);

  const toggleReadMore = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(expandedReels);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedReels(newSet);
  };

  const handleLike = async (id: string) => {
    const updatedPost = await reelsService.toggleLike(id);
    if (updatedPost) {
        setReels(prev => prev.map(p => p.id === id ? updatedPost : p));
        const userEmail = authService.getCurrentUserEmail();
        if(userEmail) recommendationService.recordInteraction(userEmail, updatedPost, 'like');
    }
  };

  const handleDeleteReel = async (id: string) => {
      const confirmed = await showConfirm(
          "Excluir Reel",
          "Tem certeza que deseja excluir este reel? A ação não pode ser desfeita.",
          "Excluir",
          "Cancelar"
      );

      if (confirmed) {
          await postService.deletePost(id);
          setReels(prev => prev.filter(r => r.id !== id));
      }
  };

  const handleCommentClick = (id: string) => {
    const post = postService.getPostById(id);
    if (post) {
        setActiveReelId(id);
        setCurrentComments(post.commentsList || []);
        setIsCommentModalOpen(true);
    }
  };

  const handleReplyClick = (commentId: string, username: string) => {
      setReplyingTo({ id: commentId, username });
      inputRef.current?.focus();
  };

  const cancelReply = () => {
      setReplyingTo(null);
  };

  const handleSendComment = async () => {
      if (!activeReelId || !commentText.trim()) return;
      
      const currentUser = authService.getCurrentUser();
      const username = currentUser?.profile?.name ? `@${currentUser.profile.name}` : 'Você';
      const userAvatar = currentUser?.profile?.photoUrl;

      if (replyingTo) {
          const savedReply = postService.addReply(activeReelId, replyingTo.id, commentText.trim(), username, userAvatar);
          if (savedReply) {
              const updateComments = (list: Comment[]): Comment[] => {
                  return list.map(c => {
                      if (c.id === replyingTo.id) {
                          return { ...c, replies: [...(c.replies || []), savedReply] };
                      }
                      if (c.replies) {
                          return { ...c, replies: updateComments(c.replies) };
                      }
                      return c;
                  });
              };
              setCurrentComments(prev => updateComments(prev));
              setReels(prev => prev.map(r => r.id === activeReelId ? { ...r, comments: r.comments + 1 } : r));
          }
          setReplyingTo(null);
      } else {
          const newComment = await postService.addComment(activeReelId, commentText.trim(), username, userAvatar);
          if (newComment) {
              setCurrentComments(prev => [newComment, ...prev]);
              setReels(prev => prev.map(r => r.id === activeReelId ? { ...r, comments: r.comments + 1 } : r));
              const post = reels.find(r => r.id === activeReelId);
              if(post && currentUser?.email) recommendationService.recordInteraction(currentUser.email, post, 'comment');
          }
      }
      setCommentText('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeReelId) return;
    if (await showConfirm("Excluir comentário", "Deseja excluir este comentário?", "Excluir", "Cancelar")) {
        const success = await postService.deleteComment(activeReelId, commentId);
        if (success) {
            const updateList = (list: Comment[]): Comment[] => {
                return list.filter(c => {
                    if (c.id === commentId) return false;
                    if (c.replies) c.replies = updateList(c.replies);
                    return true;
                });
            };
            setCurrentComments(prev => updateList(prev));
            setReels(prev => prev.map(r => r.id === activeReelId ? { ...r, comments: Math.max(0, r.comments - 1) } : r));
        }
    }
  };

  const handleCommentLike = (commentId: string) => {
      if (!activeReelId) return;
      const success = postService.toggleCommentLike(activeReelId, commentId);
      if (success) {
          const toggle = (list: Comment[]): Comment[] => {
              return list.map(c => {
                  if (c.id === commentId) {
                      const newLiked = !c.likedByMe;
                      return { ...c, likedByMe: newLiked, likes: (c.likes || 0) + (newLiked ? 1 : -1) };
                  }
                  if (c.replies) return { ...c, replies: toggle(c.replies) };
                  return c;
              });
          };
          setCurrentComments(prev => toggle(prev));
      }
  };

  const handleUserClick = (username: string) => {
      const cleanName = username.startsWith('@') ? username.substring(1) : username;
      navigate(`/user/${cleanName}`);
  };

  const handleCtaClick = (link?: string) => {
      if (!link) return;
      if (link.startsWith('http')) {
          window.open(link, '_blank');
      } else {
          navigate(link);
      }
  };

  const handleGroupClick = (groupId: string, group: Group) => {
      if (group.isVip) {
          navigate(`/vip-group-sales/${groupId}`);
      } else {
          navigate(`/group-landing/${groupId}`);
      }
  };

  const closeCommentModal = () => {
      setIsCommentModalOpen(false);
      setActiveReelId(null);
      setCommentText('');
      setReplyingTo(null);
  };

  const getDisplayName = (usernameOrHandle: string) => {
      const user = authService.getUserByHandle(usernameOrHandle);
      return user?.profile?.nickname || user?.profile?.name || usernameOrHandle;
  };

  const getUserAvatar = (usernameOrHandle: string) => {
      const user = authService.getUserByHandle(usernameOrHandle);
      return user?.profile?.photoUrl;
  }

  const handleShare = async (reel: Post) => {
      const url = `${window.location.origin}/#/post/${reel.id}`;
      if (navigator.share) {
          try {
              await navigator.share({ title: 'Confira este Reel!', url: url });
              postService.incrementShare(reel.id, authService.getCurrentUserEmail() || undefined);
          } catch (err) {
              console.error('Share failed:', err);
          }
      } else {
          navigator.clipboard.writeText(url);
          alert("Link copiado!");
          postService.incrementShare(reel.id, authService.getCurrentUserEmail() || undefined);
      }
  };

  return (
    <div className="reels-page">
      <style>{`
        .reels-page { position: relative; background: #000; height: 100dvh; width: 100%; overflow: hidden; font-family: 'Inter', sans-serif; color: white; overscroll-behavior: none; }
        .view-buttons-container { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 20; display: flex; gap: 15px; background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(10px); padding: 5px 15px; border-radius: 20px; }
        .view-btn { background: none; border: none; color: rgba(255, 255, 255, 0.6); font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.3s; }
        .view-btn.active { color: #fff; text-shadow: 0 0 10px rgba(255, 255, 255, 0.5); border-bottom: 2px solid #fff; }
        #searchIcon { position: fixed; top: 25px; right: 20px; z-index: 20; font-size: 22px; cursor: pointer; filter: drop-shadow(0 0 5px rgba(0,0,0,0.5)); }
        #reelsContent { height: 100%; width: 100%; overflow-y: scroll; scroll-snap-type: y mandatory; scroll-behavior: smooth; overscroll-behavior: none; }
        #reelsContent::-webkit-scrollbar { display: none; }
        .reel-container-wrapper { height: 100%; width: 100%; scroll-snap-align: start; scroll-snap-stop: always; position: relative; }
        .reel { width: 100%; height: 100%; position: relative; background: #111; display: flex; justify-content: center; align-items: center; }
        .reel-video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .reel-actions { position: absolute; right: 15px; bottom: 120px; display: flex; flex-direction: column; gap: 20px; z-index: 10; align-items: center; }
        .reel-actions button { background: none; border: none; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 28px; cursor: pointer; text-shadow: 0 2px 5px rgba(0,0,0,0.5); }
        .reel-actions span { font-size: 12px; font-weight: 600; }
        .liked-heart { color: #ff4d4d; animation: pop 0.3s ease; }
        .reel-desc-overlay { position: absolute; bottom: 0; left: 0; width: 100%; padding: 20px; padding-bottom: 40px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); display: flex; flex-direction: column; gap: 8px; z-index: 5; pointer-events: none; }
        .reel-desc-overlay > * { pointer-events: auto; }
        .reel-username { font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .reel-user-avatar { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #fff; object-fit: cover; }
        .adult-badge { background: #ff4d4d; font-size: 10px; padding: 2px 6px; border-radius: 4px; }
        .sponsored-badge { background: rgba(255,255,255,0.2); font-size: 10px; padding: 2px 6px; border-radius: 4px; }
        .reel-title { font-size: 14px; line-height: 1.4; max-width: 85%; }
        .reel-read-more { color: #aaa; font-weight: 600; cursor: pointer; margin-left: 5px; }
        .reel-cta-btn { background: rgba(0, 194, 255, 0.2); border: 1px solid #00c2ff; color: #fff; font-size: 10px; font-weight: 700; padding: 6px; border-radius: 4px; width: fit-content; cursor: pointer; margin-top: 5px; backdrop-filter: blur(5px); }
        .reel-group-btn { display: flex; align-items: center; gap: 8px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; color: #fff; width: fit-content; cursor: pointer; margin-bottom: 5px; transition: all 0.2s; }
        .reel-group-btn:hover { transform: scale(1.05); }
        .comments-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 40; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
        .comments-modal-overlay.open { opacity: 1; pointer-events: auto; }
        .comments-sheet { position: fixed; bottom: 0; left: 0; width: 100%; height: 70vh; background: #1a1e26; border-top-left-radius: 20px; border-top-right-radius: 20px; z-index: 50; transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; }
        .comments-sheet.open { transform: translateY(0); }
        .sheet-header { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
        .sheet-header h3 { font-size: 16px; font-weight: 700; margin: 0; }
        .comments-list { flex-grow: 1; overflow-y: auto; padding: 15px; }
        .comment-input-wrapper { padding: 10px 15px; background: #252a33; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; }
        .input-row { display: flex; gap: 10px; }
        .input-row input { flex-grow: 1; background: #111; border: 1px solid #333; border-radius: 20px; padding: 10px 15px; color: #fff; outline: none; }
        .input-row input:focus { border-color: #00c2ff; }
        .send-comment-btn { background: #00c2ff; color: #000; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .reply-context { display: flex; justify-content: space-between; align-items: center; background: #111; padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; color: #ccc; border-left: 3px solid #00c2ff; }
        .video-error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #aaa; }
        .retry-btn { margin-top: 10px; padding: 8px 16px; background: #333; border: 1px solid #555; color: #fff; border-radius: 8px; cursor: pointer; }
        @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
      `}</style>
      
      <div className="view-buttons-container">
          <button className="view-btn" onClick={() => navigate('/feed')}>Feed</button>
          <button className="view-btn active" onClick={() => {}}>Reels</button>
      </div>

      <div id="searchIcon" onClick={() => navigate('/reels-search')}>
        <i className="fa-solid fa-magnifying-glass"></i>
      </div>

      <div id="reelsContent" ref={containerRef}>
        {reels.length === 0 ? (
            <div className="flex items-center justify-center h-full flex-col gap-4">
                <i className="fa-solid fa-video-slash text-4xl text-gray-600"></i>
                <p className="text-gray-500">Nenhum Reel disponível.</p>
                <button onClick={() => navigate('/create-reel')} className="px-4 py-2 bg-[#00c2ff] text-black rounded-lg font-bold shadow-[0_4px_10px_rgba(0,194,255,0.3)]">
                    Criar Reel Agora
                </button>
            </div>
        ) : (
            reels.map((reel, index) => (
                <div key={reel.id} className="reel-container-wrapper" data-index={index}>
                    <ReelItem 
                        reel={reel}
                        isActive={index === activeReelIndex}
                        onLike={() => handleLike(reel.id)}
                        onComment={() => handleCommentClick(reel.id)}
                        onShare={() => handleShare(reel)}
                        onDelete={() => handleDeleteReel(reel.id)}
                        isOwner={reel.username === `@${authService.getCurrentUser()?.profile?.name}`}
                        onUserClick={() => handleUserClick(reel.username)}
                        getDisplayName={getDisplayName}
                        getUserAvatar={getUserAvatar}
                        expanded={expandedReels.has(reel.id)}
                        toggleReadMore={(e) => toggleReadMore(reel.id, e)}
                        reportWatchTime={reportWatchTime}
                        onCtaClick={handleCtaClick}
                        onGroupClick={handleGroupClick}
                    />
                </div>
            ))
        )}
      </div>

      <div className={`comments-modal-overlay ${isCommentModalOpen ? 'open' : ''}`} onClick={closeCommentModal}></div>
      <div className={`comments-sheet ${isCommentModalOpen ? 'open' : ''}`}>
          <div className="sheet-header">
              <h3>Comentários ({currentComments.length})</h3>
              <button className="close-sheet-btn" style={{background:'none', border:'none', color:'#fff', fontSize:'20px'}} onClick={closeCommentModal}>&times;</button>
          </div>
          <div className="comments-list">
              {currentComments.length > 0 ? (
                  currentComments.map(c => (
                      <ReelCommentNode 
                          key={c.id} 
                          comment={c} 
                          onReplyClick={handleReplyClick} 
                          onLike={handleCommentLike} 
                          onDelete={handleDeleteComment}
                          onUserClick={handleUserClick}
                          getDisplayName={getDisplayName}
                          getUserAvatar={getUserAvatar}
                          depth={0} 
                          currentUserHandle={currentUserHandle}
                      />
                  ))
              ) : (
                  <div style={{textAlign:'center', color:'#666', marginTop:'40px'}}>Seja o primeiro a comentar!</div>
              )}
          </div>
          <div className="comment-input-wrapper">
              {replyingTo && (
                  <div className="reply-context">
                      <span>Respondendo a <strong>@{replyingTo.username}</strong></span>
                      <i className="fa-solid fa-xmark cursor-pointer" onClick={cancelReply}></i>
                  </div>
              )}
              <div className="input-row">
                  <input 
                    ref={inputRef}
                    id="reelCommentInput" 
                    type="text" 
                    placeholder={replyingTo ? `Responda @${replyingTo.username}...` : "Adicione um comentário..."}
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment()} 
                  />
                  <button className="send-comment-btn" onClick={handleSendComment}><i className="fa-solid fa-paper-plane"></i></button>
              </div>
          </div>
      </div>
    </div>
  );
};