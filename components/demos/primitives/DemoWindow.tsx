import React from 'react';
import { Terminal, RefreshCw } from 'lucide-react';

export interface DemoWindowProps {
  title: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'info' | 'amber' | 'orange';
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const DemoWindow: React.FC<DemoWindowProps> = ({
  title,
  badge,
  badgeVariant = 'default',
  onReset,
  children,
  className = '',
  id,
}) => {
  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case 'success':
        return {
          color: '#4FA36A',
          backgroundColor: '#18251C',
          borderColor: '#2C4D35',
        };
      case 'warning':
      case 'amber':
      case 'orange':
        return {
          color: '#E39135',
          backgroundColor: '#352314',
          borderColor: '#5E3918',
        };
      default:
        return {
          color: '#A7A29A',
          backgroundColor: '#1C1914',
          borderColor: '#302C25',
        };
    }
  };

  const badgeStyles = getBadgeStyle();

  return (
    <div
      id={id}
      style={{
        backgroundColor: '#0D0C0A',
        borderColor: '#302C25',
      }}
      className={`relative w-full rounded-[14px] border shadow-2xl shadow-black/90 overflow-hidden flex flex-col transition-colors ${className}`}
    >
      {/* Window Header */}
      <div
        style={{
          backgroundColor: '#15130F',
          borderBottomColor: '#302C25',
        }}
        className="flex items-center justify-between px-3.5 py-2.5 border-b select-none"
      >
        <div className="flex items-center gap-2.5">
          {/* Native Mac style subtle window controls */}
          <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <span className="w-2.5 h-2.5 rounded-full bg-[#302C25] inline-block border border-[#40392F]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#302C25] inline-block border border-[#40392F]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#302C25] inline-block border border-[#40392F]" />
          </div>

          <span className="text-[#40392F] text-xs">|</span>

          {/* Title with Terminal glyph */}
          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#F3F0E8] tracking-tight">
            <Terminal className="w-3.5 h-3.5 text-[#D9822B]" />
            <span>{title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {badge && (
            <span
              style={{
                color: badgeStyles.color,
                backgroundColor: badgeStyles.backgroundColor,
                borderColor: badgeStyles.borderColor,
              }}
              className="text-[10px] font-mono px-2 py-0.5 rounded-[5px] border font-medium"
            >
              {badge}
            </span>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Reset simulation"
              style={{
                backgroundColor: '#1C1914',
                borderColor: '#302C25',
                color: '#A7A29A',
              }}
              className="p-1 rounded-[5px] border hover:text-[#F3F0E8] hover:border-[#40392F] hover:bg-[#211D17] transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Window Body Canvas */}
      <div
        style={{
          backgroundColor: '#0D0C0A',
        }}
        className="p-3.5 sm:p-4 flex-1 flex flex-col"
      >
        {children}
      </div>
    </div>
  );
};
