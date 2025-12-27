
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<LayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-2 text-sm">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
};
