import React from 'react';
import type { DiagramProps } from '../types';

export const TalkToBuilderDiagram: React.FC<DiagramProps> = ({ className = '' }) => {
  // Exact coordinate anchor points
  const CLIENT_OUT = { x: 100, y: 110 };
  const CLIENT_IN = { x: 100, y: 126 };
  const BUILDER_IN = { x: 222, y: 86 };
  const BUILDER_OUT = { x: 222, y: 100 };

  const FORWARD_PATH = `M ${CLIENT_OUT.x} ${CLIENT_OUT.y} Q 160 62 ${BUILDER_IN.x} ${BUILDER_IN.y}`;
  const RETURN_PATH = `M ${BUILDER_OUT.x} ${BUILDER_OUT.y} Q 160 144 ${CLIENT_IN.x} ${CLIENT_IN.y}`;

  return (
    <div className={`relative w-full aspect-[4/3] max-h-[250px] sm:max-h-[280px] flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 320 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[320px] max-h-[230px] overflow-visible"
      >
        <defs>
          <filter id="talkGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodOpacity="0.8" floodColor="#EA580C" />
          </filter>
        </defs>

        {/* CLIENT NODE (Left Isometric Terminal) */}
        <g>
          {/* Base pedestal */}
          <path
            d="M 68 144 L 100 128 L 124 140 L 92 156 Z"
            fill="#121214"
            stroke="#3F3F46"
            strokeWidth="1.2"
          />
          <path
            d="M 68 144 L 92 156 L 92 170 L 68 158 Z"
            fill="#18181B"
            stroke="#3F3F46"
            strokeWidth="1.1"
          />
          <path
            d="M 92 156 L 124 140 L 124 154 L 92 170 Z"
            fill="#1C1C1F"
            stroke="#3F3F46"
            strokeWidth="1.1"
          />

          {/* Terminal Display Screen */}
          <path
            d="M 76 136 L 100 122 L 100 100 L 76 114 Z"
            fill="#18181B"
            stroke="#52525B"
            strokeWidth="1.2"
          />
          {/* Screen text lines */}
          <line x1="82" y1="124" x2="96" y2="116" stroke="#EA580C" strokeWidth="1.2" />
          <line x1="82" y1="130" x2="92" y2="124" stroke="#A1A1AA" strokeWidth="1">
            <animate
              attributeName="stroke"
              values="#A1A1AA; #EA580C; #A1A1AA"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </line>

          {/* Outgoing Query Socket Dot (Exact start of FORWARD_PATH) */}
          <circle cx={CLIENT_OUT.x} cy={CLIENT_OUT.y} r="2.8" fill="#FB923C" filter="url(#talkGlow)" />

          {/* Incoming Response Reception Dot (Exact end of RETURN_PATH) */}
          <circle cx={CLIENT_IN.x} cy={CLIENT_IN.y} r="2.8" fill="#EA580C" filter="url(#talkGlow)" />
        </g>

        {/* BUILDER NODE (Right Isometric Terminal with Antenna Beacon) */}
        <g>
          {/* Base pedestal */}
          <path
            d="M 194 144 L 226 128 L 250 140 L 218 156 Z"
            fill="#121214"
            stroke="#EA580C"
            strokeWidth="1.2"
          />
          <path
            d="M 194 144 L 218 156 L 218 170 L 194 158 Z"
            fill="#18181B"
            stroke="#3F3F46"
            strokeWidth="1.1"
          />
          <path
            d="M 218 156 L 250 140 L 250 154 L 218 170 Z"
            fill="#1C1C1F"
            stroke="#3F3F46"
            strokeWidth="1.1"
          />

          {/* Builder Antenna Mast */}
          <line x1={BUILDER_IN.x} y1="134" x2={BUILDER_IN.x} y2={BUILDER_IN.y} stroke="#EA580C" strokeWidth="1.6" />
          
          {/* Return Response Emission Socket Dot (Exact start of RETURN_PATH) */}
          <circle cx={BUILDER_OUT.x} cy={BUILDER_OUT.y} r="2.5" fill="#EA580C" />

          {/* Beacon Tip Dot (Exact end of FORWARD_PATH) */}
          <circle cx={BUILDER_IN.x} cy={BUILDER_IN.y} r="4" fill="#EA580C" filter="url(#talkGlow)" />
          <circle cx={BUILDER_IN.x} cy={BUILDER_IN.y} r="2" fill="#FED7AA" />

          {/* Radiating Beacon Broadcast Waves centered exactly at BUILDER_IN */}
          <circle cx={BUILDER_IN.x} cy={BUILDER_IN.y} r="4" fill="none" stroke="#EA580C" strokeWidth="1.2">
            <animate
              attributeName="r"
              values="4; 34"
              dur="3.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0; 0.9; 0; 0"
              keyTimes="0; 0.45; 0.7; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>

          <circle cx={BUILDER_IN.x} cy={BUILDER_IN.y} r="4" fill="none" stroke="#FB923C" strokeWidth="0.8">
            <animate
              attributeName="r"
              values="4; 48"
              dur="3.2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0; 0.7; 0; 0"
              keyTimes="0; 0.5; 0.8; 1"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* BIDIRECTIONAL DIALOGUE VECTORS */}
        {/* Forward Query Arc (Client -> Builder) */}
        <path
          d={FORWARD_PATH}
          fill="none"
          stroke="#EA580C"
          strokeWidth="1.2"
        />

        {/* Return Response Arc (Builder -> Client) */}
        <path
          d={RETURN_PATH}
          fill="none"
          stroke="#3F3F46"
          strokeWidth="1.2"
        />

        {/* FORWARD USER QUERY PARTICLE (100% SVG spec-compliant timeline) */}
        <circle r="3.4" fill="#FB923C" filter="url(#talkGlow)">
          <animateMotion
            dur="3.2s"
            repeatCount="indefinite"
            path={FORWARD_PATH}
            keyPoints="0; 1; 1"
            keyTimes="0; 0.45; 1"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0 0 1 1"
          />
          <animate
            attributeName="opacity"
            values="0; 1; 1; 0; 0"
            keyTimes="0; 0.08; 0.40; 0.45; 1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* RETURN BUILDER RESPONSE PARTICLE (100% SVG spec-compliant timeline) */}
        <circle r="3.4" fill="#EA580C" filter="url(#talkGlow)">
          <animateMotion
            dur="3.2s"
            repeatCount="indefinite"
            path={RETURN_PATH}
            keyPoints="0; 0; 1; 1"
            keyTimes="0; 0.50; 0.95; 1"
            calcMode="spline"
            keySplines="0 0 1 1; 0.4 0 0.2 1; 0 0 1 1"
          />
          <animate
            attributeName="opacity"
            values="0; 0; 1; 1; 0"
            keyTimes="0; 0.48; 0.56; 0.92; 1"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Monospace Technical Labels with Geist Mono */}
        <text x="64" y="80" fill="#71717A" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">USER_QUERY</text>
        <text x="136" y="60" fill="#EA580C" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">2-WAY SYNC</text>
        <text x="210" y="68" fill="#A1A1AA" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">BUILDER_ONLINE</text>
      </svg>
    </div>
  );
};
