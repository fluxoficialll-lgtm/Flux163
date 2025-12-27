import React from 'react';
import { ModelConfig } from './types';

export const MODELS: ModelConfig[] = [
  {
    id: 'flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast, multimodal, and efficient for most tasks.',
    modelName: 'gemini-2.5-flash',
    supportsSearch: true,
    supportsImages: true,
  },
  {
    id: 'pro',
    name: 'Gemini 3 Pro (Preview)',
    description: 'Advanced reasoning and complex problem solving.',
    modelName: 'gemini-3-pro-preview',
    supportsSearch: true, // Only Pro supports search grounding reliably in this config
    supportsImages: true,
  },
];

// Simple SVG Icons components
export const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

export const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
);