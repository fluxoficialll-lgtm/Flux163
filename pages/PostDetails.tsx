
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postService } from '../services/postService';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';
import { notificationService } from '../services/notificationService';
import { chatService } from '../services/chatService';
import { Post, Comment, User, Group } from '../types';
import { db } from '@/database';
import { ImageCarousel } from '../components/ImageCarousel';
import { GroupAttachmentCard } from '../components/GroupAttachmentCard';
import { useModal } from '../components/ModalSystem';
// Added missing import for PostHeader
import { PostHeader } from '../components/PostHeader';
import { PostText } from '../components/PostText';

// --- Helper: Format Numbers ---
const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
};

// Helper: Flatten recursive replies into a single list
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

interface CommentNodeProps {
    comment: Comment;
    onReplyClick: (commentId: string, username: string) => void;
    onLike: (id: string) => void;
    onDelete: (id: string) => void;
    onUserClick: (username: string) => void;
    getDisplayName: (username: string) => string;
    getUserAvatar: (username: string) => string | undefined;
    depth?: number;
    currentUserHandle: string;
}

const CommentNode: React.FC<CommentNodeProps> = ({ 
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

    // Calculate all descendants for Level 0
    const allDescendants = useMemo(() => isLevel0 ? flattenReplies(comment.replies) : [], [comment.replies, isLevel0]);
    const totalReplies = allDescendants.length;

    // Pagination State (Only applies to Root Level)
    const [visibleCount, setVisibleCount] = useState(0); 
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    
    const displayName = getDisplayName(comment.username);
    const avatarUrl = comment.avatar || getUserAvatar(comment.username);

    // Text Truncation Logic
    const TEXT_LIMIT = 120;
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
        <div className={`flex flex-col relative animate-fade-in ${isLevel0 ? 'mb-4' : 'mb-2'}`}>
            
            {/* COMMENT CONTENT */}
            <div className="flex gap-3 items-start relative z-10">
                <div className="flex-shrink-0 cursor-pointer pt-0.5" onClick={() => onUserClick(comment.username)}>
                    {avatarUrl ? (
                        <img 
                            src={avatarUrl} 
                            className={`${avatarSize} rounded-full object-cover border border-white/10`} 
                            alt={displayName} 
                        />
                    ) : (
                        <div className={`${avatarSize} rounded-full bg-[#1e2531] flex items-center justify-center text-[#00c2ff] border border-white/10`}>
                            <i className={`fa-solid fa-user ${isLevel0 ? 'text-[12px]' : 'text-[10px]'}`}></i>
                        </div>
                    )}
                </div>
                
                <div className="flex-grow min-w-0">
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span 
                                className={`font-bold text-gray-200 cursor-pointer hover:underline text-[12px]`}
                                onClick={() => onUserClick(comment.username)}
                            >
                                {displayName}
                            </span>
                            {isOwner && (
                                <button 
                                    onClick={() => onDelete(comment.id)}
                                    className="text-gray-600 hover:text-red-500 transition-colors p-1"
                                    title="Excluir comentário"
                                >
                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                </button>
                            )}
                        </div>
                        
                        <p className={`${textSize} text-gray-200 leading-snug whitespace-pre-wrap break-words font-light`}>
                            {displayedText}
                            {isLongText && (
                                <button 
                                    onClick={() => setIsTextExpanded(!isTextExpanded)} 
                                    className="text-gray-400 text-xs font-semibold ml-1 hover:text-white bg-transparent border-none cursor-pointer"
                                >
                                    {isTextExpanded ? 'Ler menos' : 'Ler mais'}
                                </button>
                            )}
                        </p>
                    </div>
                    
                    {/* Actions Bar */}
                    <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-[11px] text-gray-500">{postService.formatRelativeTime(comment.timestamp)}</span>
                        <button 
                            className="text-[11px] font-semibold text-gray-500 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0"
                            onClick={(e) => { e.stopPropagation(); onReplyClick(comment.id, comment.username); }}
                        >
                            Responder
                        </button>

                        <button 
                            className={`text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer bg-transparent border-none p-0 ml-auto ${comment.likedByMe ? 'text-[#ff4d4d]' : 'text-gray-500 hover:text-white'}`}
                            onClick={() => onLike(comment.id)}
                        >
                            {comment.likedByMe ? <i className="fa-solid fa-heart"></i> : <i className="fa-regular fa-heart"></i>}
                            {comment.likes && comment.likes > 0 && <span>{comment.likes}</span>}
                        </button>
                    </div>
                </div>
            </div>

            {/* REPLIES AREA - FLAT LIST CONTROLLED BY ROOT */}
            {isLevel0 && totalReplies > 0 && (
                <div className="relative pl-[44px] mt-2">
                    
                    {/* Render Children */}
                    {repliesToRender.map(reply => (
                        <CommentNode 
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
                    
                    {/* Expand/Collapse Buttons */}
                    {visibleCount < totalReplies ? (
                        <button 
                            onClick={handleShowMoreReplies}
                            className="flex items-center gap-3 mt-1 mb-2 group bg-transparent border-none p-0 cursor-pointer w-full"
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

export const PostDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showConfirm } = useModal();
  const [post, setPost] = useState<Post | null>(null);
  
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<{ id: string, username: string } | null>(null);
  
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionList, setMentionList] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUser = authService.getCurrentUser();
  const currentUserHandle = currentUser?.profile?.name ? `@${currentUser.profile.name}` : "";
  const username = currentUserHandle || "Você";
  const userAvatar = currentUser?.profile?.photoUrl;

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    if (id) {
      const foundPost = postService.getPostById(id);
      if (foundPost) {
        setPost(foundPost);
        setIsLiked(foundPost.liked);
        setLikeCount(foundPost.likes);
        setComments(foundPost.commentsList || []);
      } else {
        alert("Post não encontrado");
        navigate('/feed');
      }
    }
    setAllUsers(authService.getAllUsers());
  }, [id, navigate]);

  useEffect(() => {
      const updateCounts = () => {
          setUnreadNotifs(notificationService.getUnreadCount());
          setUnreadMsgs(chatService.getUnreadCount());
      };
      updateCounts();
      const unsubNotif = db.subscribe('notifications', updateCounts);
      const unsubChat = db.subscribe('chats', updateCounts);
      return () => { unsubNotif(); unsubChat(); };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setNewComment(val);

      const cursor = e.target.selectionStart || 0;
      const textBeforeCursor = val.slice(0, cursor);
      const match = textBeforeCursor.match(/@(\w*)$/);
      
      if (match) {
          const query = match[1].toLowerCase();
          setMentionQuery(query);
          const filtered = allUsers.filter(u => {
              const handle = u.profile?.name?.toLowerCase() || '';
              const name = u.profile?.nickname?.toLowerCase() || '';
              return handle.includes(query) || name.includes(query);
          });
          setMentionList(filtered.slice(0, 5)); 
      } else {
          setMentionQuery(null);
      }
  };

  const insertMention = (user: User) => {
      const handle = user.profile?.name || 'user';
      const cursor = inputRef.current?.selectionStart || 0;
      const text = newComment;
      
      const start = text.lastIndexOf('@', cursor - 1);
      if (start === -1) return;

      const prefix = text.slice(0, start);
      const suffix = text.slice(cursor);
      
      const inserted = `${prefix}@${handle} ${suffix}`;
      
      setNewComment(inserted);
      setMentionQuery(null);
      
      setTimeout(() => {
          if(inputRef.current) {
              inputRef.current.focus();
              const newPos = start + handle.length + 2;
              inputRef.current.setSelectionRange(newPos, newPos);
          }
      }, 0);
  };

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
    } else {
        navigate('/feed');
    }
  };

  const handleLike = async () => {
    if (post) {
        const updatedPost = await postService.toggleLike(post.id);
        if (updatedPost) {
            setPost(updatedPost);
            setIsLiked(updatedPost.liked);
            setLikeCount(updatedPost.likes);
        }
    }
  };

  const handleReplyClick = (commentId: string, username: string) => {
      setReplyingTo({ id: commentId, username });
      inputRef.current?.focus();
  };

  const cancelReply = () => {
      setReplyingTo(null);
  };

  const handleSend = async () => {
      if (!newComment.trim() || !post) return;

      if (replyingTo) {
          const savedReply = postService.addReply(post.id, replyingTo.id, newComment.trim(), username, userAvatar);
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
              setComments(prev => updateComments(prev));
          }
          setReplyingTo(null); 
      } else {
          const savedComment = await postService.addComment(post.id, newComment.trim(), username, userAvatar) as Comment | undefined;
          if (savedComment) {
              setComments(prev => [savedComment, ...prev]);
          }
      }
      
      setNewComment('');
      setMentionQuery(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    if (await showConfirm("Excluir comentário", "Deseja excluir este comentário permanentemente?", "Excluir", "Cancelar")) {
        const success = await postService.deleteComment(post.id, commentId);
        if (success) {
            const updateList = (list: Comment[]): Comment[] => {
                return list.filter(c => {
                    if (c.id === commentId) return false;
                    if (c.replies) c.replies = updateList(c.replies);
                    return true;
                });
            };
            setComments(prev => updateList(prev));
        }
    }
  };

  const handleShare = async () => {
      if(!post) return;
      const url = `${window.location.origin}/#/post/${post.id}`;
      if (navigator.share) {
          try {
              await navigator.share({
                  title: `Post de ${post.username}`,
                  text: post.text.substring(0, 100),
                  url: url
              });
          } catch (err) {
              console.error('Share failed:', err);
          }
      } else {
          navigator.clipboard.writeText(url);
          alert('Link copiado para a área de transferência!');
      }
  };

  const handleCommentLike = (commentId: string) => {
      if (!post) return;
      const success = postService.toggleCommentLike(post.id, commentId);
      if (success) {
          const toggle = (list: Comment[]): Comment[] => {
              return list.map(c => {
                  if (c.id === commentId) {
                      const newLiked = !c.likedByMe;
                      return { ...c, likedByMe: newLiked, likes: (c.likes || 0) + (newLiked ? 1 : -1) };
                  }
                  if (c.replies) {
                      return { ...c, replies: toggle(c.replies) };
                  }
                  return c;
              });
          };
          setComments(prev => toggle(prev));
      }
  };

  const handleUserClick = (username: string) => {
      const cleanName = username.startsWith('@') ? username.substring(1) : username;
      navigate(`/user/${cleanName}`);
  };

  const handleVote = (optionIndex: number) => {
    if (!post || !post.pollOptions || post.votedOptionIndex != null) return;
    const newOptions = [...post.pollOptions];
    newOptions[optionIndex].votes += 1;
    const updatedPost = {
        ...post,
        pollOptions: newOptions,
        votedOptionIndex: optionIndex
    };
    setPost(updatedPost);
  };

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const getDisplayName = (usernameOrHandle: string) => {
      const user = authService.getUserByHandle(usernameOrHandle);
      return user?.profile?.nickname || user?.profile?.name || usernameOrHandle;
  };

  const getUserAvatar = (usernameOrHandle: string) => {
      const user = authService.getUserByHandle(usernameOrHandle);
      return user?.profile?.photoUrl;
  };

  if (!post) return <div className="min-h-screen bg-[#0c0f14] text-white flex items-center justify-center">Carregando...</div>;

  return (
    <div className="post-details-page min-h-[100dvh] flex flex-col font-['Inter'] overflow-hidden" style={{ background: 'radial-gradient(circle at top left, #0c0f14, #0a0c10)', color: '#fff' }}>
      
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#0c0f14] fixed w-full top-0 z-50 border-b border-white/10 h-[65px]">
        <button onClick={handleBack} className="bg-none border-none text-[#00c2ff] text-xl cursor-pointer p-1.5"><i className="fa-solid fa-arrow-left"></i></button>
        <span className="text-lg font-semibold text-white">Post</span>
        <button style={{visibility:'hidden'}}><i className="fa-solid fa-ellipsis-v"></i></button>
      </header>

      <main className="pt-[80px] pb-[130px] w-full max-w-[600px] mx-auto flex-grow overflow-y-auto flex flex-col">
          <div className="bg-[#1a1e26] rounded-xl border border-white/5 mx-2.5 mb-2.5 overflow-hidden">
            {/* Added Comment: Fix for reported error on line 485 by using PostHeader which is now imported */}
            <PostHeader 
                username={post.username} 
                time={postService.formatRelativeTime(post.timestamp)} 
                location={post.location}
                isAdult={post.isAdultContent}
                isAd={post.isAd}
                onClick={() => handleUserClick(post.username)}
                isOwner={post.username === currentUserHandle}
                onDelete={() => {}} // Not needed in view
            />
            
            <PostText text={post.text} onUserClick={handleUserClick} className="px-4 pb-4" />
            
            {post.type === 'photo' && (
                <div className="w-full bg-black flex items-center justify-center overflow-hidden">
                    {post.images && post.images.length > 1 ? (
                        <ImageCarousel images={post.images} />
                    ) : (
                        post.image && (
                            <img src={post.image} className="max-w-full max-h-[600px] object-contain block" alt="Content" />
                        )
                    )}
                </div>
            )}

            {post.type === 'video' && post.video && (
                 <div className="w-full bg-black flex items-center justify-center overflow-hidden">
                    <video src={post.video} controls className="max-w-full max-h-[600px] object-contain block" />
                 </div>
            )}

            {post.relatedGroupId && (
                <GroupAttachmentCard groupId={post.relatedGroupId} />
            )}

            {post.type === 'poll' && post.pollOptions && (
                <div className="mx-4 mb-4 p-2.5 bg-[rgba(0,194,255,0.05)] rounded-lg">
                    {(() => {
                        const totalVotes = post.pollOptions!.reduce((acc, curr) => acc + curr.votes, 0);
                        return post.pollOptions!.map((option, idx) => {
                            const pct = getPercentage(option.votes, totalVotes);
                            const isVoted = post.votedOptionIndex === idx;
                            return (
                                <div 
                                    key={idx}
                                    onClick={() => handleVote(idx)}
                                    className={`relative mb-2 p-2.5 rounded-lg cursor-pointer overflow-hidden font-medium transition-colors ${isVoted ? 'bg-[#00c2ff] text-black font-extrabold' : 'bg-[#1e2531] hover:bg-[#28303f]'}`}
                                >
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-[#00c2ff] opacity-30 z-0 transition-[width] duration-500 ease-out" 
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
                </div>
            )}
            
            <div className="grid grid-cols-4 px-2 py-3 mt-2 border-t border-white/5 gap-1">
                <button onClick={handleLike} className={`flex items-center justify-center gap-1.5 transition-all ${isLiked ? 'text-red-500' : 'text-gray-400 hover:text-[#00c2ff]'}`}>
                    <i className={`${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-lg`}></i>
                    <span className="text-xs font-semibold">{formatNumber(likeCount)}</span>
                </button>
                <div className="flex items-center justify-center gap-1.5 text-gray-400 cursor-default">
                    <i className="fa-regular fa-comment text-lg"></i>
                    <span className="text-xs font-semibold">{formatNumber(comments.length)}</span>
                </div>
                <button onClick={handleShare} className="flex items-center justify-center text-gray-400 hover:text-[#00c2ff] transition-all">
                    <i className="fa-regular fa-paper-plane text-lg"></i>
                </button>
                <div className="flex items-center justify-center gap-1.5 text-gray-400 transition-all cursor-default">
                    <i className="fa-solid fa-eye text-lg"></i>
                    <span className="text-xs font-semibold">{formatNumber(post.views)}</span>
                </div>
            </div>
          </div>

          <div className="bg-[#0c0f14] p-4 flex-grow border-t border-white/5">
            <h2 className="text-xs font-bold mb-4 text-gray-500 uppercase tracking-widest pl-1">
                {comments.length} Comentários
            </h2>
            <div className="space-y-1 pb-4">
              {comments.length > 0 ? comments.map(comment => (
                  <CommentNode 
                      key={comment.id}
                      comment={comment}
                      onReplyClick={handleReplyClick} 
                      onLike={handleCommentLike}
                      onDelete={handleDeleteComment}
                      onUserClick={handleUserClick}
                      getDisplayName={getDisplayName}
                      getUserAvatar={getUserAvatar}
                      depth={0} 
                      currentUserHandle={currentUserHandle}
                  />
              )) : (
                  <div className="text-gray-600 text-sm text-center py-10 italic">
                      Seja o primeiro a comentar.
                  </div>
              )}
            </div>
          </div>
      </main>

      {/* Main Comment Input */}
      <div className="fixed bottom-0 left-0 w-full z-[60] bg-[#1a1e26] border-t border-white/10 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex flex-col">
            
            {/* Reply Context Bar */}
            {replyingTo && (
                <div className="flex items-center justify-between px-4 py-2 bg-[#252a33] border-b border-white/5 text-xs text-gray-300">
                    <span>Respondendo a <strong className="text-[#00c2ff]">@{replyingTo.username}</strong></span>
                    <button onClick={cancelReply} className="text-gray-400 hover:text-white">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}

            {mentionQuery !== null && mentionList.length > 0 && (
                <div className="absolute bottom-full left-0 w-full bg-[#1a1e26] border-t border-white/10 max-h-[200px] overflow-y-auto z-[70]">
                    {mentionList.map(u => (
                        <div key={u.email} className="flex items-center p-3 cursor-pointer hover:bg-[#00c2ff]/10 border-b border-white/5" onClick={() => insertMention(u)}>
                            {u.profile?.photoUrl ? <img src={u.profile.photoUrl} className="w-8 h-8 rounded-full mr-2.5 object-cover" /> : <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center mr-2.5"><i className="fa-solid fa-user text-xs"></i></div>}
                            <div className="flex flex-col">
                                <span className="text-[13px] font-semibold text-white">{u.profile?.nickname || u.profile?.name}</span>
                                <span className="text-[11px] text-[#aaa]">@{u.profile?.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2.5 w-full max-w-[600px] mx-auto items-center p-2.5 px-4">
              {userAvatar ? <img src={userAvatar} className="w-8 h-8 rounded-full border border-white/20" /> : <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center text-[#555]"><i className="fa-solid fa-user text-xs"></i></div>}
              <input 
                ref={inputRef}
                type="text" 
                placeholder={replyingTo ? `Responda @${replyingTo.username}...` : "Adicione um comentário..."}
                value={newComment}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-grow bg-[#0c0f14] border border-white/20 rounded-full px-4 py-2.5 text-white outline-none text-sm focus:border-[#00c2ff] transition-colors"
              />
              <button 
                onClick={handleSend} 
                disabled={!newComment.trim()}
                className="bg-[#00c2ff] border-none w-10 h-10 rounded-full flex items-center justify-center text-black cursor-pointer transition-transform active:scale-90 disabled:opacity-50"
              >
                  <i className="fa-solid fa-paper-plane text-sm"></i>
              </button>
            </div>
      </div>

    </div>
  );
};
