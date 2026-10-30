import React from 'react';
import type { DiagramProps } from '../types';

export const ChallengesDiagram: React.FC<DiagramProps> = ({ className = '' }) => {
  const gridOriginX = 176;
  const gridOriginY = 116;
  const colDx = 16;
  const colDy = -7;
  const rowDx = 12;
  const rowDy = 6;

  // Exact anchor points
  const DOC_PIN = { x: 114, y: 118 };
  const APEX_JUNCTION = { x: 165, y: 96 };
  const TABLE_PIN = { x: 216, y: 122 };

  return (
    <div className={`relative w-full aspect-[4/3] max-h-[250px] sm:max-h-[280px] flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 320 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[320px] max-h-[230px] overflow-visible"
      >
        <defs>
          <filter id="chalLaserGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodOpacity="0.8" floodColor="#EA580C" />
          </filter>
          <filter id="chalConflictGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodOpacity="0.75" floodColor="#EA580C" />
          </filter>

          <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EA580C" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#EA580C" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#EA580C" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* DOMAIN 1: UNSTRUCTURED DOCUMENT (Left Side) */}
        <g>
          {/* Base Sheet 1 */}
          <path
            d="M 60 84 L 114 60 L 134 94 L 80 118 Z"
            fill="#121214"
            stroke="#27272A"
            strokeWidth="1"
          />

          {/* Active Sheet 2 */}
          <g>
            <path
              d="M 68 96 L 122 72 L 142 106 L 88 130 Z"
              fill="#18181B"
              stroke="#52525B"
              strokeWidth="1.2"
            />
            {/* Unstructured text lines */}
            <line x1="78" y1="98" x2="110" y2="84" stroke="#52525B" strokeWidth="1" />
            <line x1="82" y1="105" x2="130" y2="84" stroke="#71717A" strokeWidth="1" />
            <line x1="86" y1="112" x2="124" y2="96" stroke="#71717A" strokeWidth="1" />

            {/* Target discrepancy token line */}
            <line x1="88" y1="118" x2={DOC_PIN.x} y2={DOC_PIN.y} stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" />
            
            {/* Document Anchor Dot (Exact match to reconciliation path start) */}
            <circle cx={DOC_PIN.x} cy={DOC_PIN.y} r="3" fill="#EA580C" filter="url(#chalConflictGlow)" />
            <circle cx={DOC_PIN.x} cy={DOC_PIN.y} r="5" fill="none" stroke="#FED7AA" strokeWidth="0.8">
              <animate
                attributeName="opacity"
                values="0.3; 1; 0.3"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </g>

        {/* DOMAIN 2: STRUCTURED TABULAR DATA MATRIX (Right Side) */}
        <g>
          {/* Base Plate */}
          <path
            d="M 172 116 L 236 88 L 278 112 L 214 140 Z"
            fill="#121214"
            stroke="#3F3F46"
            strokeWidth="1.2"
          />

          {/* Grid lines inside table */}
          {[1, 2, 3].map((col) => {
            const x1 = gridOriginX + col * colDx;
            const y1 = gridOriginY + col * colDy;
            const x2 = x1 + 3 * rowDx;
            const y2 = y1 + 3 * rowDy;
            return (
              <line
                key={`c-${col}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#27272A"
                strokeWidth="1"
              />
            );
          })}

          {[1, 2].map((row) => {
            const x1 = gridOriginX + row * rowDx;
            const y1 = gridOriginY + row * rowDy;
            const x2 = x1 + 4 * colDx;
            const y2 = y1 + 4 * colDy;
            return (
              <line
                key={`r-${row}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#27272A"
                strokeWidth="1"
              />
            );
          })}

          {/* Conflicting cell in structured matrix */}
          <path
            d="M 204 122 L 220 115 L 232 121 L 216 128 Z"
            fill="#EA580C"
          >
            <animate
              attributeName="opacity"
              values="0.25; 0.25; 0.95; 0.25"
              keyTimes="0; 0.45; 0.65; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </path>
          
          {/* Table Anchor Dot (Exact match to reconciliation path end) */}
          <circle cx={TABLE_PIN.x} cy={TABLE_PIN.y} r="3" fill="#FED7AA" filter="url(#chalConflictGlow)">
            <animate
              attributeName="opacity"
              values="0.3; 0.3; 1; 0.3"
              keyTimes="0; 0.45; 0.65; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={TABLE_PIN.x} cy={TABLE_PIN.y} r="5.5" fill="none" stroke="#EA580C" strokeWidth="0.8">
            <animate
              attributeName="r"
              values="4; 8; 4"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* RECONCILIATION BRIDGE (Exact quadratic curve between DOC_PIN and TABLE_PIN) */}
        <path
          id="reconciliationTrack"
          d={`M ${DOC_PIN.x} ${DOC_PIN.y} Q 165 72 ${TABLE_PIN.x} ${TABLE_PIN.y}`}
          fill="none"
          stroke="#3F3F46"
          strokeWidth="1.2"
        />

        {/* APEX JUNCTION DOT & EVENT PULSES (At exact curve apex x: 165, y: 96) */}
        <circle cx={APEX_JUNCTION.x} cy={APEX_JUNCTION.y} r="2" fill="#71717A" />
        <circle cx={APEX_JUNCTION.x} cy={APEX_JUNCTION.y} r="5" fill="none" stroke="#EA580C" strokeWidth="1.2">
          <animate
            attributeName="r"
            values="4; 24"
            dur="3.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0; 0.85; 0; 0"
            keyTimes="0; 0.48; 0.7; 1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* SIGNAL BEAD TRAVELING ACROSS RECONCILIATION BRIDGE */}
        <circle r="3.4" fill="#FB923C" filter="url(#chalLaserGlow)">
          <animateMotion
            dur="3.2s"
            repeatCount="indefinite"
            path={`M ${DOC_PIN.x} ${DOC_PIN.y} Q 165 72 ${TABLE_PIN.x} ${TABLE_PIN.y}`}
            keyPoints="0; 1"
            keyTimes="0; 1"
            calcMode="spline"
            keySplines="0.45 0 0.2 1"
          />
          <animate
            attributeName="opacity"
            values="0; 1; 1; 0"
            keyTimes="0; 0.15; 0.85; 1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* TRAVELING OPTICAL LASER SCANNER */}
        <g filter="url(#chalLaserGlow)">
          <line x1="0" y1="52" x2="0" y2="168" stroke="url(#laserBeamGrad)" strokeWidth="1.8" />
          <circle cx="0" cy="118" r="3" fill="#EA580C" />
          <circle cx="0" cy="118" r="6" fill="#EA580C" opacity="0.35" />

          {/* Smooth back-and-forth sweep */}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="75,0; 235,0; 75,0"
            keyTimes="0; 0.5; 1"
            dur="3.2s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          />
        </g>

        {/* Technical Schematics Labels with Geist Mono */}
        <text x="64" y="52" fill="#71717A" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">UNSTRUCTURED_DOC</text>
        <text x="136" y="66" fill="#EA580C" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">SCHEMA_MATCH</text>
        <text x="210" y="74" fill="#A1A1AA" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">TABLE_VECTOR</text>
      </svg>
    </div>
  );
};
