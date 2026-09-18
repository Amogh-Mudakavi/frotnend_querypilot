import React from 'react';

export type StatusVariant = 'default' | 'success' | 'warning' | 'info' | 'purple' | 'neutral' | 'amber' | 'orange';

export interface StatusPillProps {
  label: string;
  variant?: StatusVariant;
  pulse?: boolean;
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
  className?: string;
  id?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  variant = 'default',
  pulse = false,
  size = 'xs',
  icon,
  className = '',
  id,
}) => {
  // QueryPilot Color Rules:
  // - Orange for active, processing, in-progress
  // - Green ONLY for success, completed, validated
  // - Gray/neutral for waiting, idle, default
  const getStyles = () => {
    switch (variant) {
      case 'success':
        return {
          color: '#4FA36A',
          backgroundColor: '#18251C',
          borderColor: '#2C4D35',
          dot: '#4FA36A',
        };
      case 'warning':
      case 'amber':
      case 'orange':
        return {
          color: '#E39135',
          backgroundColor: '#352314',
          borderColor: '#5E3918',
          dot: '#D9822B',
        };
      case 'neutral':
      case 'default':
      default:
        return {
          color: '#A7A29A',
          backgroundColor: '#1C1914',
          borderColor: '#302C25',
          dot: '#6F6A61',
        };
    }
  };

  const styles = getStyles();

  return (
    <span
      id={id}
      style={{
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
      }}
      className={`inline-flex items-center gap-1.5 font-mono font-medium border rounded-[6px] shrink-0 tracking-tight transition-colors ${
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
          <span
            style={{ backgroundColor: styles.dot }}
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          />
          <span
            style={{ backgroundColor: styles.dot }}
            className="relative inline-flex rounded-full h-1.5 w-1.5"
          />
        </span>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span
          style={{ backgroundColor: styles.dot }}
          className="inline-block rounded-full h-1.5 w-1.5 shrink-0"
        />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
};
