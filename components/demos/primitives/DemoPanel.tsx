import React from 'react';

export interface DemoPanelProps {
  title?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const DemoPanel: React.FC<DemoPanelProps> = ({
  title,
  badge,
  actions,
  children,
  className = '',
  id,
}) => {
  return (
    <div
      id={id}
      style={{
        backgroundColor: '#15130F',
        borderColor: '#302C25',
      }}
      className={`rounded-[10px] border p-3 sm:p-3.5 text-[#F3F0E8] ${className}`}
    >
      {(title || badge || actions) && (
        <div
          style={{ borderBottomColor: '#302C25' }}
          className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b"
        >
          <div className="flex items-center gap-2">
            {title && (
              <span className="text-xs font-medium text-[#F3F0E8] tracking-tight font-sans">
                {title}
              </span>
            )}
            {badge}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
