
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService } from '../services/groupService';
import { Group } from '../types';

interface GroupAttachmentCardProps {
    groupId: string;
}

export const GroupAttachmentCard: React.FC<GroupAttachmentCardProps> = ({ groupId }) => {
    const navigate = useNavigate();
    const [group, setGroup] = useState<Group | null>(null);

    useEffect(() => {
        const g = groupService.getGroupById(groupId);
        if (g) setGroup(g);
    }, [groupId]);

    if (!group) return null;

    const handleJoinClick = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (group.isVip) {
            navigate(`/vip-group-sales/${group.id}`);
        } else {
            navigate(`/group-landing/${group.id}`);
        }
    };

    const isVip = group.isVip;

    return (
        <>
            <style>{`
                .group-attachment-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: ${isVip ? 'linear-gradient(145deg, rgba(255, 215, 0, 0.05), rgba(0, 0, 0, 0.4))' : 'linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(0, 0, 0, 0.2))'};
                    border: ${isVip ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'};
                    border-radius: 12px;
                    padding: 12px;
                    margin: 10px 16px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    position: relative;
                    overflow: hidden;
                }
                .group-attachment-card:hover {
                    background: ${isVip ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.08)'};
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                }
                .ga-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    overflow: hidden;
                    flex: 1;
                }
                .ga-cover {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    object-fit: cover;
                    flex-shrink: 0;
                    border: ${isVip ? '2px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255,255,255,0.2)'};
                }
                .ga-cover.placeholder {
                    background: #1e2531;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${isVip ? '#FFD700' : '#555'};
                    font-size: 20px;
                }
                .ga-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    gap: 2px;
                }
                .ga-name {
                    font-weight: 700;
                    font-size: 15px;
                    color: #fff;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .ga-type {
                    font-size: 10px;
                    color: ${isVip ? '#FFD700' : '#aaa'};
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .ga-btn {
                    background: ${isVip ? 'linear-gradient(90deg, #FFD700, #FDB931)' : 'linear-gradient(90deg, #00c2ff, #0099ff)'};
                    color: ${isVip ? '#000' : '#fff'};
                    border: none;
                    padding: 8px 18px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    margin-left: 10px;
                    box-shadow: ${isVip ? '0 0 15px rgba(255, 215, 0, 0.2)' : '0 0 15px rgba(0, 194, 255, 0.2)'};
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .ga-btn:hover {
                    transform: scale(1.05);
                    box-shadow: ${isVip ? '0 0 20px rgba(255, 215, 0, 0.4)' : '0 0 20px rgba(0, 194, 255, 0.4)'};
                }
                .ga-btn:active {
                    transform: scale(0.95);
                }
                .shine-effect {
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 50%;
                    height: 100%;
                    background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%);
                    transform: skewX(-25deg);
                    animation: shine 4s infinite;
                    pointer-events: none;
                }
                @keyframes shine {
                    0% { left: -100%; }
                    20% { left: 200%; }
                    100% { left: 200%; }
                }
            `}</style>
            <div className="group-attachment-card" onClick={(e) => e.stopPropagation()}>
                {isVip && <div className="shine-effect"></div>}
                <div className="ga-left">
                    {group.coverImage ? (
                        <img src={group.coverImage} className="ga-cover" alt="Group" />
                    ) : (
                        <div className="ga-cover placeholder">
                            <i className={`fa-solid ${group.isVip ? 'fa-crown' : 'fa-users'}`}></i>
                        </div>
                    )}
                    <div className="ga-info">
                        <div className="ga-name">{group.name}</div>
                        <div className="ga-type">
                            {isVip ? (
                                <><i className="fa-solid fa-lock text-[9px]"></i> ÁREA RESTRITA</>
                            ) : (
                                <><i className="fa-solid fa-user-group text-[9px]"></i> COMUNIDADE ATIVA</>
                            )}
                        </div>
                    </div>
                </div>
                <button className="ga-btn" onClick={handleJoinClick}>
                    ACESSAR
                </button>
            </div>
        </>
    );
};
