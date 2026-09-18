import React from 'react';
import { Loader2 } from 'lucide-react';

export interface DemoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'amber';
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const DemoButton: React.FC<DemoButtonProps> = ({
  variant = 'primary',
  size = 'sm',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  style,
  ...props
}) => {
  // QueryPilot Color Language:
  // Primary (Orange): #D9822B background, #F3F0E8 text, hover #E39135, active #C87324
  // Secondary: #1C1914 background, #302C25 border, #F3F0E8 text, hover #211D17 / #40392F
  const getButtonStyles = () => {
    switch (variant) {
      case 'primary':
      case 'amber':
        return {
          backgroundColor: '#D9822B',
          borderColor: '#B56B1E',
          color: '#F3F0E8',
          boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
        };
      case 'secondary':
        return {
          backgroundColor: '#1C1914',
          borderColor: '#302C25',
          color: '#F3F0E8',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: '#302C25',
          color: '#A7A29A',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          color: '#A7A29A',
        };
      default:
        return {};
    }
  };

  const getHoverClasses = () => {
    switch (variant) {
      case 'primary':
      case 'amber':
        return 'hover:bg-[#E39135] active:bg-[#C87324] active:scale-[0.99]';
      case 'secondary':
        return 'hover:bg-[#211D17] hover:border-[#40392F] hover:text-[#F3F0E8] active:bg-[#15130F]';
      case 'outline':
        return 'hover:bg-[#1C1914] hover:text-[#F3F0E8] hover:border-[#40392F]';
      case 'ghost':
        return 'hover:bg-[#1C1914] hover:text-[#F3F0E8]';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'px-2.5 py-1 text-[11px] gap-1.5 rounded-[6px]';
      case 'sm':
        return 'px-3 py-1.5 text-xs gap-2 rounded-[7px]';
      case 'md':
        return 'px-4 py-2 text-sm gap-2.5 rounded-[8px]';
    }
  };

  return (
    <button
      disabled={disabled || loading}
      style={{
        ...getButtonStyles(),
        ...style,
      }}
      className={`relative inline-flex items-center justify-center font-medium font-sans border transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getSizeClasses()} ${getHoverClasses()} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0 flex items-center justify-center">{icon}</span>
      ) : null}
      <span className="truncate tracking-tight">{children}</span>
    </button>
  );
};
