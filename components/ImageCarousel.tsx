import React, { useState, useRef } from 'react';

interface ImageCarouselProps {
    images: string[];
    onImageClick?: (url: string) => void;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, onImageClick }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (scrollRef.current) {
            const scrollLeft = scrollRef.current.scrollLeft;
            const width = scrollRef.current.offsetWidth;
            const index = Math.round(scrollLeft / width);
            if (index !== currentIndex) {
                setCurrentIndex(index);
            }
        }
    };

    return (
        <div className="relative w-full mb-2.5 overflow-hidden rounded-xl bg-black aspect-[4/5]">
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10 backdrop-blur-sm">
                {currentIndex + 1}/{images.length}
            </div>
            <div 
                ref={scrollRef}
                className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar w-full h-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={handleScroll}
            >
                {images.map((img, idx) => (
                    <img 
                        key={idx} 
                        src={img} 
                        loading="lazy"
                        alt={`Slide ${idx}`} 
                        className="w-full h-full flex-shrink-0 snap-center object-cover cursor-pointer" 
                        onClick={() => onImageClick && onImageClick(img)}
                    />
                ))}
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-1.5 h-1.5 rounded-full transition-all ${currentIndex === idx ? 'bg-[#00c2ff] scale-125' : 'bg-white/50'}`}
                    ></div>
                ))}
            </div>
        </div>
    );
};