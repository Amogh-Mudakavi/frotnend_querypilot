import React from 'react';
import { motion } from 'motion/react';
import type { DiagramProps } from '../types';

export const ArchitectureDiagram: React.FC<DiagramProps> = ({ className = '' }) => {
  // Exact coordinates for 100% geometric alignment
  const EXTRACT_PIN = { x: 92, y: 116 };
  const CORE_SOCKET = { x: 160, y: 144 };
  const CITATION_PIN = { x: 238, y: 104 };

  return (
    <div className={`relative w-full aspect-[4/3] max-h-[250px] sm:max-h-[280px] flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 320 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-w-[320px] max-h-[230px] overflow-visible"
      >
        <defs>
          <filter id="archOrangeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodOpacity="0.8" floodColor="#EA580C" />
          </filter>
          <filter id="archCoreGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodOpacity="0.85" floodColor="#EA580C" />
          </filter>
        </defs>

        {/* PRECISE CONVEYOR TRACKS (Exact start and end coordinates) */}
        <line
          x1={EXTRACT_PIN.x}
          y1={EXTRACT_PIN.y}
          x2={CORE_SOCKET.x}
          y2={CORE_SOCKET.y}
          stroke="#3F3F46"
          strokeWidth="1.2"
        />
        <line
          x1={CORE_SOCKET.x}
          y1={CORE_SOCKET.y}
          x2={CITATION_PIN.x}
          y2={CITATION_PIN.y}
          stroke="#3F3F46"
          strokeWidth="1.2"
        />

        {/* STAGE 1: INGESTION DOCUMENT STACK */}
        {/* Layer 3 (Back) */}
        <path
          d="M 54 84 L 88 68 L 112 80 L 78 96 Z"
          fill="#121214"
          stroke="#27272A"
          strokeWidth="1"
          opacity="0.6"
        />

        {/* Layer 2 (Middle) */}
        <path
          d="M 62 96 L 96 80 L 120 92 L 86 108 Z"
          fill="#18181B"
          stroke="#3F3F46"
          strokeWidth="1"
        />
        <line x1="74" y1="96" x2="94" y2="88" stroke="#52525B" strokeWidth="1" />
        <line x1="78" y1="102" x2="104" y2="92" stroke="#52525B" strokeWidth="1" />

        {/* Layer 1 (Front Active Document) */}
        <g>
          <path
            d="M 70 108 L 104 92 L 128 104 L 94 120 Z"
            fill="#1F1F23"
            stroke="#EA580C"
            strokeWidth="1.3"
          />
          {/* Active text lines */}
          <line x1="82" y1="108" x2="104" y2="100" stroke="#EA580C" strokeWidth="1.4" />
          <line x1="86" y1="114" x2="116" y2="103" stroke="#A1A1AA" strokeWidth="1" />
          
          {/* Exact Extraction Marker Pin Dot (At EXTRACT_PIN) */}
          <circle cx={EXTRACT_PIN.x} cy={EXTRACT_PIN.y} r="3" fill="#EA580C" filter="url(#archOrangeGlow)" />
          <circle cx={EXTRACT_PIN.x} cy={EXTRACT_PIN.y} r="5.5" fill="none" stroke="#EA580C" strokeWidth="0.8" opacity="0.6" />
        </g>

        {/* STAGE 2: TRAVELING INGESTION TOKENS */}
        {/* Particle 1: Travels from EXTRACT_PIN directly into CORE_SOCKET */}
        <g>
          <circle r="3.2" fill="#FB923C" filter="url(#archOrangeGlow)">
            <animateMotion
              dur="2.4s"
              repeatCount="indefinite"
              path={`M ${EXTRACT_PIN.x} ${EXTRACT_PIN.y} L ${CORE_SOCKET.x} ${CORE_SOCKET.y}`}
              keyPoints="0; 1"
              keyTimes="0; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
            <animate
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.12; 0.88; 1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Particle 2: Staggered second token */}
        <g>
          <circle r="2.4" fill="#EA580C" filter="url(#archOrangeGlow)">
            <animateMotion
              begin="1.2s"
              dur="2.4s"
              repeatCount="indefinite"
              path={`M ${EXTRACT_PIN.x} ${EXTRACT_PIN.y} L ${CORE_SOCKET.x} ${CORE_SOCKET.y}`}
              keyPoints="0; 1"
              keyTimes="0; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
            <animate
              begin="1.2s"
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.12; 0.88; 1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* STAGE 3: CENTRAL REASONING CORE */}
        <g>
          {/* Top Face */}
          <path
            d="M 160 120 L 186 132 L 160 144 L 134 132 Z"
            fill="rgba(234, 88, 12, 0.25)"
            stroke="#EA580C"
            strokeWidth="1.4"
          />
          {/* Left Face */}
          <path
            d="M 134 132 L 160 144 L 160 172 L 134 160 Z"
            fill="#18181B"
            stroke="#EA580C"
            strokeWidth="1.4"
          />
          {/* Right Face */}
          <path
            d="M 160 144 L 186 132 L 186 160 L 160 172 Z"
            fill="#27272A"
            stroke="#EA580C"
            strokeWidth="1.4"
          />

          {/* Internal matrix lines */}
          <line x1="147" y1="138" x2="147" y2="166" stroke="#EA580C" strokeWidth="0.8" opacity="0.4" />
          <line x1="173" y1="138" x2="173" y2="166" stroke="#EA580C" strokeWidth="0.8" opacity="0.4" />

          {/* Central Socket Dot (At CORE_SOCKET) */}
          <circle cx={CORE_SOCKET.x} cy={CORE_SOCKET.y} r="3.5" fill="#FED7AA" filter="url(#archOrangeGlow)">
            <animate
              attributeName="r"
              values="3.2; 4.4; 3.2"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Radar shockwave emitted from the core socket */}
          <circle cx={CORE_SOCKET.x} cy={CORE_SOCKET.y} r="8" fill="none" stroke="#EA580C" strokeWidth="1.2">
            <animate
              attributeName="r"
              values="4; 28"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9; 0"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
          <circle cx={CORE_SOCKET.x} cy={CORE_SOCKET.y} r="8" fill="none" stroke="#FB923C" strokeWidth="0.8">
            <animate
              begin="0.6s"
              attributeName="r"
              values="4; 34"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <animate
              begin="0.6s"
              attributeName="opacity"
              values="0.7; 0"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* STAGE 4: SYNTHESIS OUTPUT STREAM */}
        {/* Output Token 1: Travels from CORE_SOCKET to CITATION_PIN */}
        <g>
          <circle r="3.2" fill="#FB923C" filter="url(#archOrangeGlow)">
            <animateMotion
              begin="0.8s"
              dur="2.4s"
              repeatCount="indefinite"
              path={`M ${CORE_SOCKET.x} ${CORE_SOCKET.y} L ${CITATION_PIN.x} ${CITATION_PIN.y}`}
              keyPoints="0; 1"
              keyTimes="0; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
            <animate
              begin="0.8s"
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.12; 0.88; 1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Output Token 2 */}
        <g>
          <circle r="2.4" fill="#EA580C" filter="url(#archOrangeGlow)">
            <animateMotion
              begin="2.0s"
              dur="2.4s"
              repeatCount="indefinite"
              path={`M ${CORE_SOCKET.x} ${CORE_SOCKET.y} L ${CITATION_PIN.x} ${CITATION_PIN.y}`}
              keyPoints="0; 1"
              keyTimes="0; 1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            />
            <animate
              begin="2.0s"
              attributeName="opacity"
              values="0; 1; 1; 0"
              keyTimes="0; 0.12; 0.88; 1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* STAGE 5: GROUNDED ANSWER OUTPUT PLANE */}
        <g>
          {/* Card Base */}
          <path
            d="M 214 96 L 248 80 L 272 92 L 238 108 Z"
            fill="#18181B"
            stroke="#52525B"
            strokeWidth="1.2"
          />
          {/* Answer Card Top Glow Face */}
          <path
            d="M 214 96 L 248 80 L 272 92 L 238 108 Z"
            fill="rgba(234, 88, 12, 0.15)"
            stroke="#EA580C"
            strokeWidth="1.2"
          />
          {/* Grounded Citation Lines */}
          <line x1="226" y1="96" x2="252" y2="86" stroke="#EA580C" strokeWidth="1.2" />
          <line x1="230" y1="102" x2="260" y2="90" stroke="#EDEDED" strokeWidth="1" />
          <line x1="234" y1="106" x2="256" y2="98" stroke="#71717A" strokeWidth="0.8" />

          {/* Citation Pin Dot (At CITATION_PIN) */}
          <circle cx={CITATION_PIN.x} cy={CITATION_PIN.y} r="3" fill="#EA580C" filter="url(#archOrangeGlow)" />
          <circle cx={CITATION_PIN.x} cy={CITATION_PIN.y} r="5.5" fill="none" stroke="#EA580C" strokeWidth="0.8">
            <animate
              attributeName="r"
              values="4; 10; 4"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8; 0; 0.8"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Monospace Architectural Annotations with Geist Mono */}
        <text x="56" y="60" fill="#71717A" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">01. INGEST_DOC</text>
        <text x="134" y="98" fill="#EA580C" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">02. SYNTHESIS_CORE</text>
        <text x="216" y="68" fill="#A1A1AA" fontSize="7" fontFamily="var(--font-geist-mono), 'Geist Mono', monospace" letterSpacing="0.1em">03. GROUNDED_ANS</text>
      </svg>
    </div>
  );
};
