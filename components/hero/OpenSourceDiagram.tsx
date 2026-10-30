import React from 'react';
import type { DiagramProps } from '../types';

export const OpenSourceDiagram: React.FC<DiagramProps> = ({ className = '' }) => {
  // Isometric package cube renderer
  const renderCube = (cx: number, cy: number, size: number, fillTop: string, fillSide: string, stroke: string) => {
    const w = size;
    const h = size * 0.58;
    const depth = size * 0.9;
    const top = `M ${cx} ${cy - h} L ${cx + w} ${cy} L ${cx} ${cy + h} L ${cx - w} ${cy} Z`;
    const left = `M ${cx - w} ${cy} L ${cx} ${cy + h} L ${cx} ${cy + h + depth} L ${cx - w} ${cy + depth} Z`;
    const right = `M ${cx} ${cy + h} L ${cx + w} ${cy} L ${cx + w} ${cy + depth} L ${cx} ${cy + h + depth} Z`;

    return (
      <g>
        <path d={top} fill={fillTop} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={left} fill={fillSide} stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
        <path d={right} fill="#18181B" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    );
  };

  // Exact commit coordinates
  const NODES = {
    trunk1: { x: 70, y: 165 },
    diverge: { x: 100, y: 165 },
    feat1: { x: 130, y: 130 },
    featApex: { x: 160, y: 115 },
    feat2: { x: 190, y: 130 },
    merge: { x: 220, y: 165 },
    trunk2: { x: 250, y: 165 },
    trunkMid: { x: 160, y: 165 },
  };

  // Feature branch path passing dead-center through each commit node
  const BRANCH_PATH = `M ${NODES.diverge.x} ${NODES.diverge.y} C 112 165, 120 130, ${NODES.feat1.x} ${NODES.feat1.y} C 140 130, 150 115, ${NODES.featApex.x} ${NODES.featApex.y} C 170 115, 180 130, ${NODES.feat2.x} ${NODES.feat2.y} C 200 130, 208 165, ${NODES.merge.x} ${NODES.merge.y}`;

  return (
    <div className={`relative w-full aspect-[4/3] max-h-[250px] sm:max-h-[280px] flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 320 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[320px] max-h-[230px] overflow-visible"
      >
        <defs>
          <filter id="ossGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodOpacity="0.8" floodColor="#EA580C" />
          </filter>
        </defs>

        {/* GIT BRANCH GRAPH / COMMIT DAG */}
        {/* Main Trunk Line */}
        <line x1="50" y1="165" x2="270" y2="165" stroke="#3F3F46" strokeWidth="1.2" />

        {/* Feature Branch Arc */}
        <path
          d={BRANCH_PATH}
          fill="none"
          stroke="#EA580C"
          strokeWidth="1.4"
        />

        {/* MODULAR REPOSITORY PACKAGES (Exact vertical alignment above nodes) */}
        {/* Module A (Parser Package above x: 100) */}
        <g>
          {renderCube(100, 72, 14, '#27272A', '#1C1C1F', '#3F3F46')}
          <line x1="100" y1="84" x2="100" y2="165" stroke="#27272A" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* Module B (QueryPilot Engine above x: 160) */}
        <g filter="url(#ossGlow)">
          {renderCube(160, 56, 18, 'rgba(234, 88, 12, 0.4)', '#1F1F23', '#EA580C')}
          <line x1="160" y1="72" x2="160" y2="115" stroke="#EA580C" strokeWidth="0.8" opacity="0.5" />
          <circle cx="160" cy="56" r="3" fill="#FED7AA">
            <animate
              attributeName="opacity"
              values="0.4; 1; 0.4"
              dur="2.8s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Module C (Evaluator Package above x: 220) */}
        <g>
          {renderCube(220, 72, 14, '#27272A', '#1C1C1F', '#3F3F46')}
          <line x1="220" y1="84" x2="220" y2="165" stroke="#27272A" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* STATIC COMMIT NODES ALONG MAIN TRUNK */}
        <circle cx={NODES.trunk1.x} cy={NODES.trunk1.y} r="3.5" fill="#18181B" stroke="#71717A" strokeWidth="1.2" />
        <circle cx={NODES.diverge.x} cy={NODES.diverge.y} r="4.2" fill="#EA580C" filter="url(#ossGlow)" />
        <circle cx={NODES.trunkMid.x} cy={NODES.trunkMid.y} r="3.5" fill="#18181B" stroke="#71717A" strokeWidth="1.2" />
        <circle cx={NODES.merge.x} cy={NODES.merge.y} r="4.5" fill="#EA580C" filter="url(#ossGlow)" />
        <circle cx={NODES.trunk2.x} cy={NODES.trunk2.y} r="3.5" fill="#18181B" stroke="#71717A" strokeWidth="1.2" />

        {/* STATIC COMMIT NODES ALONG FEATURE BRANCH (Exact centers on path) */}
        <circle cx={NODES.feat1.x} cy={NODES.feat1.y} r="3.2" fill="#18181B" stroke="#EA580C" strokeWidth="1.4" />
        <circle cx={NODES.featApex.x} cy={NODES.featApex.y} r="4" fill="#EA580C" />
        <circle cx={NODES.feat2.x} cy={NODES.feat2.y} r="3.2" fill="#18181B" stroke="#EA580C" strokeWidth="1.4" />

        {/* CONTINUOUS COMMIT PULSE TRAVELING ALONG FEATURE BRANCH */}
        <circle r="3.5" fill="#FB923C" filter="url(#ossGlow)">
          <animateMotion
            dur="2.8s"
            repeatCount="indefinite"
            path={BRANCH_PATH}
            keyPoints="0; 1"
            keyTimes="0; 1"
            calcMode="spline"
            keySplines="0.4 0 0.2 1"
          />
          <animate
            attributeName="opacity"
            values="0; 1; 1; 0"
            keyTimes="0; 0.12; 0.88; 1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </circle>

        {/* MERGE SHOCKWAVE PULSE AT EXACT MERGE NODE (x: 220, y: 165) */}
        <circle cx={NODES.merge.x} cy={NODES.merge.y} r="4" fill="none" stroke="#EA580C" strokeWidth="1.4">
          <animate
            attributeName="r"
            values="4; 28"
            dur="2.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0; 0; 0.85; 0"
            keyTimes="0; 0.65; 0.8; 1"
            dur="2.8s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Technical Schematics Labels with Geist Mono */}
        <text x="50" y="184" fill="#71717A" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">MAIN_TRUNK</text>
        <text x="130" y="96" fill="#EA580C" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">MERGE_PR #42</text>
        <text x="214" y="184" fill="#A1A1AA" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">TAG: v2.4.0</text>
      </svg>
    </div>
  );
};
