import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { postService } from '../services/postService';
import { notificationService } from '../services/notificationService';
import { chatService } from '../services/chatService';
import { Post } from '../types';
import { db } from '@/database';
import { ImageCarousel } from '../components/ImageCarousel';
import { GroupAttachmentCard } from '../components/GroupAttachmentCard';
import { useModal } from '../components/ModalSystem';
/* Removed duplicate PostHeader import */
import { PostHeader } from '../components/PostHeader';
import { PostText } from '../components/PostText';

const formatNumber = (num: number): string => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
};

export const Feed: React.FC = () => {
  const navigate = useNavigate();
  const { showConfirm } = useModal();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [uiVisible, setUiVisible] = useState(true);
  const [activeLocationFilter, setActiveLocationFilter] = useState<string | null>(null);
  
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 8; 

  const lastScrollY = useRef(0);
  
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const viewedPostsRef = useRef<Set<string>>(new Set());

  const loaderRef = useRef<HTMLDivElement>(null);
  const isAdultContentAllowed = localStorage.getItem('settings_18_plus') === 'true';
  const currentUser = authService.getCurrentUser();
  const currentUserEmail = currentUser?.email;

  useEffect(() => {
    const userEmail = authService.getCurrentUserEmail();
    if (!userEmail) {
      navigate('/');
      return;
    }
    const filter = localStorage.getItem('feed_location_filter');
    setActiveLocationFilter(filter);
    
    loadInitialPosts();
  }, [navigate]);

  useEffect(() => {
      const updateCounts = () => {
          setUnreadNotifs(notificationService.getUnreadCount());
          setUnreadMsgs(chatService.getUnreadCount());
      };
      updateCounts();
      const unsubNotif = db.subscribe('notifications', updateCounts);
      const unsubChat = db.subscribe('chats', updateCounts);
      
      const unsubPosts = db.subscribe('posts', () => {
          const allPostsInDb = db.posts.getAll();
          const allPostsIds = new Set(allPostsInDb.map(p => p.id));
          
          setPosts(currentPosts => {
              const validPosts = currentPosts.filter(p => allPostsIds.has(p.id));
              return validPosts.map(p => {
                  const updated = allPostsInDb.find(dbP => dbP.id === p.id);
                  return updated ? updated : p;
              });
          });
      });

      return () => { unsubNotif(); unsubChat(); unsubPosts(); };
  }, []);

  useEffect(() => {
      const observer = new IntersectionObserver(
          (entries) => {
              entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                      const postId = entry.target.getAttribute('data-post-id');
                      if (postId && !viewedPostsRef.current.has(postId)) {
                          viewedPostsRef.current.add(postId);
                          /* Corrected incrementView call to use only 1 argument as defined in postService */
                          postService.incrementView(postId);
                      }
                  }
              });
          },
          { threshold: 0.5 }
      );

      const postElements = document.querySelectorAll('.feed-post-item');
      postElements.forEach((el) => observer.observe(el));

      return () => observer.disconnect();
  }, [posts]);

  const loadInitialPosts = async () => {
      const localData = db.posts.getCursorPaginated(PAGE_SIZE);
      let localPosts = localData || [];
      if (activeLocationFilter && activeLocationFilter !== 'Global') {
          localPosts = localPosts.filter(p => p.location?.includes(activeLocationFilter));
      }
      localPosts = localPosts.filter(p => p.type !== 'video' || p.isAd);
      if (!isAdultContentAllowed) {
          localPosts = localPosts.filter(p => !p.isAdultContent);
      }

      if (localPosts.length > 0) {
          setPosts(localPosts);
          setNextCursor(localPosts[localPosts.length - 1].timestamp);
      }

      await fetchPosts(undefined, true);
  };

  const fetchPosts = useCallback(async (cursor?: number, reset = false) => {
    if (loading) return;
    if (posts.length === 0) setLoading(true);
    
    try {
        const storedFilter = localStorage.getItem('feed_location_filter');
        const filterForService = storedFilter === 'Global' ? null : storedFilter;
        
        const response = await postService.getFeedPaginated({
            limit: PAGE_SIZE,
            cursor: cursor,
            allowedTypes: ['text', 'photo', 'poll'], 
            locationFilter: filterForService,
            allowAdultContent: isAdultContentAllowed 
        });
        
        let fetchedPosts = response.data || [];
        fetchedPosts = fetchedPosts.filter(p => p.type !== 'video' || p.isAd);

        setPosts(prev => {
            if (reset) {
                return fetchedPosts;
            }
            const existingIds = new Set(prev.map(p => p.id));
            const uniqueNew = fetchedPosts.filter(p => !existingIds.has(p.id));
            return [...prev, ...uniqueNew];
        });

        setNextCursor(response.nextCursor);
        setHasMore(!!response.nextCursor && fetchedPosts.length > 0);

    } catch (error) {
        console.error("Feed fetch error (using cached)", error);
        if (cursor) {
             const moreLocal = db.posts.getCursorPaginated(PAGE_SIZE, cursor);
             if (moreLocal.length > 0) {
                 setPosts(prev => {
                     const existingIds = new Set(prev.map(p => p.id));
                     const uniqueNew = moreLocal.filter(p => !existingIds.has(p.id));
                     return [...prev, ...uniqueNew];
                 });
                 setNextCursor(moreLocal[moreLocal.length - 1].timestamp);
             } else {
                 setHasMore(false);
             }
        }
    } finally {
        setLoading(false);
    }
  }, [isAdultContentAllowed, loading, posts.length]);

  useEffect(() => {
      const observer = new IntersectionObserver(
          (entries) => {
              const target = entries[0];
              if (target.isIntersecting && hasMore && !loading) {
                  fetchPosts(nextCursor);
              }
          },
          { 
              root: scrollContainerRef.current,
              rootMargin: '300px',
              threshold: 0.1 
          }
      );

      if (loaderRef.current) {
          observer.observe(loaderRef.current);
      }

      return () => observer.disconnect();
  }, [hasMore, loading, nextCursor, fetchPosts]);

  const handleContainerScroll = () => {
      if (!scrollContainerRef.current) return;
      const currentScroll = scrollContainerRef.current.scrollTop;
      
      if (currentScroll > lastScrollY.current && currentScroll > 100) {
          setUiVisible(false);
      } else {
          setUiVisible(true);
      }
      lastScrollY.current = currentScroll;
  };

  const handleLike = (id: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id === id) {
        const newLiked = !post.liked;
        return {
          ...post,
          liked: newLiked,
          likes: post.likes + (newLiked ? 1 : -1)
        };
      }
      return post;
    }));
    postService.toggleLike(id);
  };

  const handleDeletePost = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const confirmed = await showConfirm(
          "Excluir Post",
          "Tem certeza que deseja excluir este post permanentemente?",
          "Excluir",
          "Cancelar"
      );

      if (confirmed) {
          await postService.deletePost(id);
          setPosts(prev => prev.filter(p => p.id !== id));
      }
  };

  const handleVote = (postId: string, optionIndex: number) => {
    setPosts(prev => prev.map(post => {
        if (post.id === postId && post.pollOptions && post.votedOptionIndex == null) {
            const newOptions = [...post.pollOptions];
            newOptions[optionIndex].votes += 1;
            return {
                ...post,
                pollOptions: newOptions,
                votedOptionIndex: optionIndex
            };
        }
        return post;
    }));
  };

  const handleUserClick = (username: string) => {
    if (!username) return;
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

  const handleShare = async (post: Post) => {
      const url = `${window.location.origin}/#/post/${post.id}`;
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `Post de ${post.username}`,
                  text: (post.text || '').substring(0, 100),
                  url: url
              });
              postService.incrementShare(post.id, authService.getCurrentUserEmail() || undefined);
          } catch (err) {
              console.error('Share failed:', err);
          }
      } else {
          navigator.clipboard.writeText(url);
          alert('Link copiado para a área de transferência!');
          postService.incrementShare(post.id, authService.getCurrentUserEmail() || undefined);
      }
  };

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const handleOptionSelect = (destination: 'feed' | 'reels' | 'marketplace') => {
      setIsMenuOpen(false);
      if (destination === 'feed') navigate('/create-post');
      else if (destination === 'reels') navigate('/create-reel');
      else navigate('/create-marketplace-item', { state: { type: 'organic' } });
  };

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top_left,_#0c0f14,_#0a0c10)] text-white font-['Inter'] flex flex-col overflow-hidden relative">
      
      <header className="flex items-center justify-between p-[16px_32px] bg-[#0c0f14] w-full z-30 border-b border-white/10 h-[80px] shrink-0 relative">
        <button onClick={() => navigate('/location-filter')} className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white z-30 flex items-center gap-1">
            <i className={`fa-solid ${activeLocationFilter && activeLocationFilter !== 'Global' ? 'fa-location-dot' : 'fa-globe'}`}></i>
            {activeLocationFilter && activeLocationFilter !== 'Global' && (
                <span className="text-[10px] font-bold uppercase">{activeLocationFilter.substring(0,8) + (activeLocationFilter.length>8?'..':'')}</span>
            )}
        </button>
        
        <div className="absolute left-1/2 -translate-x-1/2 w-[60px] h-[60px] bg-white/5 rounded-2xl flex justify-center items-center z-20 cursor-pointer shadow-[0_0_20px_rgba(0,194,255,0.3),inset_0_0_20px_rgba(0,194,255,0.08)]" onClick={() => scrollContainerRef.current?.scrollTo({top: 0, behavior: 'smooth'})}>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] rotate-[25deg]"></div>
             <div className="absolute w-[40px] h-[22px] rounded-[50%] border-[3px] border-[#00c2ff] -rotate-[25deg]"></div>
        </div>

        <button onClick={() => navigate('/marketplace')} className="bg-none border-none text-[#00c2ff] text-lg cursor-pointer hover:text-white z-30">
            <i className="fa-solid fa-cart-shopping"></i>
        </button>
      </header>

      <div className="fixed top-[85px] left-1/2 -translate-x-1/2 z-40 flex items-center p-1 bg-[#1a1e26]/80 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <button className="px-6 py-2 rounded-full bg-[#00c2ff] text-[#0c0f14] text-sm font-bold shadow-[0_0_15px_rgba(0,194,255,0.4)] transition-all">
              Feed
          </button>
          <button className="px-6 py-2 rounded-full text-gray-400 text-sm font-medium hover:text-white transition-all hover:bg-white/5" onClick={() => navigate('/reels')}>
              Reels
          </button>
      </div>

      <main 
        ref={scrollContainerRef}
        onScroll={handleContainerScroll}
        className="flex-grow w-full overflow-y-auto overflow-x-hidden relative pt-[140px]" 
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {activeLocationFilter && activeLocationFilter !== 'Global' && (
            <div className="w-full bg-[#00c2ff1a] text-[#00c2ff] text-center p-2 text-sm font-semibold border-b border-[#00c2ff33] sticky top-0 z-[9] backdrop-blur-sm flex items-center justify-center gap-2">
                <i className="fa-solid fa-location-dot"></i> {activeLocationFilter}
            </div>
        )}

        <div className="w-full max-w-[500px] mx-auto pb-[100px]">
            
            <div className="px-3 pt-2">
                {Array.isArray(posts) && posts.map((post) => {
                    if (!post || !post.id) return null;

                    return (
                        <div 
                            key={post.id} 
                            data-post-id={post.id}
                            className="feed-post-item relative bg-[#1a1e26] border border-white/5 rounded-2xl pb-2 mb-6 shadow-lg overflow-hidden"
                        >
                            <PostHeader 
                                username={post.username} 
                                authorEmail={post.authorEmail}
                                time={postService.formatRelativeTime(post.timestamp)} 
                                location={post.location}
                                isAdult={post.isAdultContent}
                                isAd={post.isAd}
                                onClick={() => handleUserClick(post.username)}
                                isOwner={currentUserEmail ? post.authorEmail === currentUserEmail : false}
                                onDelete={(e) => handleDeletePost(e, post.id)}
                            />

                            <PostText text={post.text || ""} onUserClick={handleUserClick} />

                            {post.type === 'photo' && (
                                <div className="w-full overflow-hidden bg-black mb-0">
                                    {post.images && post.images.length > 1 ? (
                                        <ImageCarousel images={post.images} onImageClick={(url) => setZoomedImage(url)} />
                                    ) : (
                                        post.image && (
                                            <img 
                                                src={post.image} 
                                                loading="lazy"
                                                alt="Post content" 
                                                className="w-full h-auto max-h-[600px] object-contain cursor-pointer" 
                                                onClick={() => setZoomedImage(post.image!)}
                                            />
                                        )
                                    )}
                                </div>
                            )}

                            {post.type === 'video' && post.video && (
                                <div className="w-full overflow-hidden bg-black mb-0">
                                    <video 
                                        src={post.video} 
                                        controls 
                                        className="w-full h-auto max-h-[600px] object-contain" 
                                    />
                                </div>
                            )}

                            {post.isAd && post.ctaLink && (
                                <div className="bg-[#00c2ff]/10 p-3 px-4 flex justify-between items-center mb-0 border-t border-[#00c2ff]/20">
                                    <span className="text-xs text-[#00c2ff] font-bold tracking-wide">PATROCINADO</span>
                                    <button className="bg-[#00c2ff] text-black border-none px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#33d1ff] transition-colors" onClick={() => handleCtaClick(post.ctaLink)}>
                                        {post.ctaText || 'Saiba Mais'} <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                    </button>
                                </div>
                            )}

                            {post.relatedGroupId && (
                                <div className="mt-2 mb-2">
                                    <GroupAttachmentCard groupId={post.relatedGroupId} />
                                </div>
                            )}

                            {post.type === 'poll' && post.pollOptions && (
                                <div className="mx-4 mt-2.5 mb-2.5 p-3 bg-[#00c2ff0d] rounded-xl border border-[#00c2ff22]">
                                    {(() => {
                                        const totalVotes = post.pollOptions!.reduce((acc, curr) => acc + curr.votes, 0);
                                        return post.pollOptions!.map((option, idx) => {
                                            const pct = getPercentage(option.votes, totalVotes);
                                            const isVoted = post.votedOptionIndex === idx;
                                            return (
                                                <div 
                                                    key={idx}
                                                    onClick={() => handleVote(post.id, idx)}
                                                    className={`relative mb-2 p-3 rounded-lg cursor-pointer overflow-hidden font-medium transition-colors ${isVoted ? 'bg-[#00c2ff] text-black font-bold' : 'bg-[#1e2531] hover:bg-[#28303f]'}`}
                                                >
                                                    <div 
                                                        className="absolute top-0 left-0 h-full bg-[#00c2ff] opacity-30 z-0 transition-all duration-500" 
                                                        style={{ width: `${pct}%` }}
                                                    ></div>
                                                    <div className="relative z-10 flex justify-between items-center text-sm">
                                                        <span>{option.text}</span>
                                                        <span>{pct}%</span>
                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                    <div className="text-right text-xs text-gray-500 mt-1">{formatNumber(post.pollOptions?.reduce((a,b)=>a+b.votes,0) || 0)} votos</div>
                                </div>
                            )}

                            <div className="grid grid-cols-4 px-2 py-3 mt-1 border-t border-white/5 gap-1">
                                <button 
                                    onClick={() => handleLike(post.id)}
                                    className={`flex items-center justify-center gap-2 transition-all ${post.liked ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-[#00c2ff]'}`}
                                >
                                    <i className={`${post.liked ? 'fa-solid' : 'fa-regular'} fa-heart text-xl`}></i>
                                    <span className="text-xs font-semibold">{formatNumber(post.likes)}</span>
                                </button>
                                
                                <button 
                                    onClick={() => navigate(`/post/${post.id}`)}
                                    className="flex items-center justify-center gap-2 text-gray-400 hover:text-[#00c2ff] transition-all"
                                >
                                    <i className="fa-regular fa-comment text-xl"></i>
                                    <span className="text-xs font-semibold">{formatNumber(post.comments)}</span>
                                </button>

                                <button 
                                    onClick={() => handleShare(post)}
                                    className="flex items-center justify-center text-gray-400 hover:text-[#00c2ff] transition-all"
                                >
                                    <i className="fa-regular fa-paper-plane text-xl"></i>
                                </button>

                                <div className="flex items-center justify-center gap-2 text-gray-400 transition-all cursor-default opacity-70">
                                    <i className="fa-solid fa-eye text-lg"></i>
                                    <span className="text-xs font-semibold">{formatNumber(post.views)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div ref={loaderRef} className="w-full h-24 flex items-center justify-center py-6">
                {loading ? (
                    <div className="flex justify-center p-5 text-[#00c2ff] text-2xl">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl"></i>
                    </div>
                ) : !hasMore && posts.length > 0 ? (
                    <div className="text-gray-500 text-sm font-medium opacity-60">
                        • Fim do Feed •
                    </div>
                ) : null}
                
                {!loading && posts.length === 0 && (
                    <div className="text-center text-gray-500 mt-10 flex flex-col items-center gap-3">
                        <i className="fa-solid fa-ghost text-4xl opacity-30"></i>
                        <p>Nenhum post encontrado.</p>
                        {activeLocationFilter && activeLocationFilter !== 'Global' && (
                            <button onClick={() => {localStorage.setItem('feed_location_filter', 'Global'); window.location.reload();}} className="text-[#00c2ff] text-sm underline">
                                Ver posts Globais
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>

      {isMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsMenuOpen(false)}></div>}
      
      <div className={`fixed bottom-[180px] right-[27px] flex flex-col gap-4 z-50 items-end transition-all duration-300 ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleOptionSelect('reels')}>
              <span className="text-white font-medium text-sm bg-[#1a1e26] border border-white/10 px-3 py-1.5 rounded-lg shadow-lg group-hover:scale-105 transition-transform">
                  Criar Reel
              </span>
              <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform cursor-pointer">
                  <i className="fa-solid fa-clapperboard text-lg"></i>
              </div>
          </div>

          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleOptionSelect('feed')}>
              <span className="text-white font-medium text-sm bg-[#1a1e26] border border-white/10 px-3 py-1.5 rounded-lg shadow-lg group-hover:scale-105 transition-transform">
                  Novo Post
              </span>
              <div className="w-[50px] h-[50px] rounded-full bg-gradient-to-tr from-[#00c2ff] to-[#007bff] flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform cursor-pointer">
                  <i className="fa-solid fa-pen text-lg"></i>
              </div>
          </div>
      </div>

      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`fixed bottom-[105px] right-[20px] w-[60px] h-[60px] bg-[#00c2ff] border-none rounded-full text-white text-[24px] cursor-pointer shadow-[0_4px_12px_rgba(0,194,255,0.3)] z-50 flex items-center justify-center hover:bg-[#007bff] transition-transform duration-300 ${uiVisible ? 'scale-100' : 'scale-0'} ${isMenuOpen ? 'rotate-45 bg-[#ff4d4d] hover:bg-[#ff3333]' : ''}`}
      >
        <i className="fa-solid fa-plus"></i>
      </button>

      <footer className={`fixed bottom-0 left-0 w-full bg-[#0c0f14] flex justify-around py-3.5 rounded-t-2xl z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] transition-transform duration-300 ${uiVisible ? 'translate-y-0' : 'translate-y-full'}`}>
        <button onClick={() => scrollContainerRef.current?.scrollTo({top: 0, behavior: 'smooth'})} className="text-white text-[22px] p-2">
            <i className="fa-solid fa-newspaper"></i>
        </button>
        <button onClick={() => navigate('/messages')} className="text-[#00c2ff] text-[22px] p-2 relative hover:text-white transition-colors">
            <i className="fa-solid fa-comments"></i>
            {unreadMsgs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
        </button>
        <button onClick={() => navigate('/notifications')} className="text-[#00c2ff] text-[22px] p-2 relative hover:text-white transition-colors">
            <i className="fa-solid fa-bell"></i>
            {unreadNotifs > 0 && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ff4d4d] rounded-full border border-[#0c0f14]"></div>}
        </button>
        <button onClick={() => navigate('/profile')} className="text-[#00c2ff] text-[22px] p-2 hover:text-white transition-colors">
            <i className="fa-solid fa-user"></i>
        </button>
      </footer>

      {zoomedImage && (
          <div 
            className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex items-center justify-center p-2"
            onClick={() => setZoomedImage(null)}
          >
              <button 
                className="absolute top-4 right-4 text-white text-4xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
                onClick={() => setZoomedImage(null)}
              >
                  &times;
              </button>
              <img 
                src={zoomedImage} 
                alt="Zoom" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
              />
          </div>
      )}

    </div>
  );
};