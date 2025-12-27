import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className, ...props }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${props.disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} ${className || ''}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500 mt-1 block">{error}</span>}
    </div>
  );
};