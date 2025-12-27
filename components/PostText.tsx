
import React, { useState, useEffect, useRef, useMemo } from 'react';

interface PostTextProps {
    text: string;
    onUserClick: (handle: string) => void;
    className?: string;
}

export const PostText: React.FC<PostTextProps> = ({ text, onUserClick, className = "px-4 mb-3" }) => {
    const [lineLimit, setLineLimit] = useState(3);
    const [visibleSentences, setVisibleSentences] = useState(0); 
    const [isCalculating, setIsCalculating] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    const LINE_HEIGHT = 24; 

    const allSentences = useMemo(() => {
        return text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
    }, [text]);

    useEffect(() => {
        if (!containerRef.current || visibleSentences >= allSentences.length) {
            if (visibleSentences >= allSentences.length) setIsCalculating(false);
            return;
        }

        const currentHeight = containerRef.current.scrollHeight;
        const currentLines = Math.round(currentHeight / LINE_HEIGHT);
        
        if (currentLines < lineLimit && visibleSentences < allSentences.length) {
            setVisibleSentences(prev => prev + 1);
        } else {
            setIsCalculating(false);
        }
    }, [visibleSentences, lineLimit, allSentences, text]);

    const formatMentions = (raw: string) => {
        return raw.split(/(@\w+)/g).map((part, i) => 
            part.startsWith('@') ? (
                <span key={i} className="text-[#00c2ff] font-semibold cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); onUserClick(part); }}>{part}</span>
            ) : (
                part
            )
        );
    };

    const handleReadMore = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCalculating(true);
        setLineLimit(prev => prev + 3);
    };

    const handleReadLess = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLineLimit(3);
        setVisibleSentences(0); 
        setIsCalculating(true);
    };

    const isFullyExpanded = visibleSentences >= allSentences.length;
    const showReadMore = !isFullyExpanded && !isCalculating;
    const showReadLess = isFullyExpanded && allSentences.length > 1 && lineLimit > 3;

    return (
        <div className={className}>
            <div 
                ref={containerRef}
                className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words text-gray-200 font-normal overflow-hidden"
            >
                {formatMentions(allSentences.slice(0, visibleSentences).join(''))}
            </div>
            
            {showReadMore && (
                <button 
                    onClick={handleReadMore}
                    className="text-[#00c2ff] font-bold cursor-pointer text-sm hover:underline bg-transparent border-none p-0 mt-1"
                >
                    Ler mais
                </button>
            )}

            {showReadLess && (
                <button 
                    onClick={handleReadLess}
                    className="text-[#00c2ff] font-bold cursor-pointer text-sm hover:underline bg-transparent border-none p-0 mt-1"
                >
                    Ler menos
                </button>
            )}
        </div>
    );
};
