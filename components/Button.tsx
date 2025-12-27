
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'google' | 'outline';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className,
  disabled,
  ...props 
}) => {
  const baseStyle = "w-full py-2.5 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30",
    secondary: "bg-gray-800 text-white hover:bg-gray-900",
    google: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    outline: "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50"
  };

  const activeClass = disabled || isLoading ? "opacity-50 cursor-not-allowed" : variants[variant];

  return (
    <button 
      className={`${baseStyle} ${activeClass} ${className || ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : children}
    </button>
  );
};
