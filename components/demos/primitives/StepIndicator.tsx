import React from 'react';
import { Check } from 'lucide-react';

export type StepState = 'pending' | 'active' | 'completed' | 'skipped';

export interface StepItem {
  id: string;
  label: string;
  detail?: string;
  state: StepState;
}

export interface StepIndicatorProps {
  steps: StepItem[];
  compact?: boolean;
  className?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  compact = false,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {steps.map((step, idx) => {
        const isCompleted = step.state === 'completed';
        const isActive = step.state === 'active';
        const isPending = step.state === 'pending';

        return (
          <div
            key={step.id || idx}
            style={{
              backgroundColor: isActive ? '#352314' : isCompleted ? '#18251C' : 'transparent',
              borderColor: isActive ? '#5E3918' : isCompleted ? '#2C4D35' : '#302C25',
            }}
            className={`flex items-center justify-between py-1 px-2.5 rounded-[7px] font-mono text-xs border transition-colors duration-150 ${
              isActive
                ? 'text-[#F3F0E8]'
                : isCompleted
                ? 'text-[#4FA36A]'
                : 'text-[#6F6A61] opacity-70'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 flex items-center justify-center w-3.5 h-3.5">
                {isCompleted ? (
                  <Check className="w-3 h-3 text-[#4FA36A] stroke-[2.5]" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[#D9822B] animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full border border-[#6F6A61] inline-block" />
                )}
              </span>
              <span className={`truncate text-xs ${isActive ? 'font-medium text-[#F3F0E8]' : ''}`}>
                {step.label}
              </span>
            </div>

            {step.detail && (
              <span
                style={{
                  color: isActive ? '#E39135' : isCompleted ? '#4FA36A' : '#6F6A61',
                }}
                className="ml-2 text-[10px] shrink-0 font-mono tracking-tight"
              >
                {step.detail}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
