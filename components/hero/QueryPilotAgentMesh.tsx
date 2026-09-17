"use client";

import React, { useRef, useState } from "react";
import gsap from "gsap";
import {
  FileText,
  Database,
  Search,
  GitFork,
  Wrench,
  MessageSquare,
  ArrowRight,
} from "lucide-react";

export interface AgentNode {
  id: string;
  title: string;
  subtitle: string;
  badgeIconType:
    | "planner"
    | "document"
    | "retrieval"
    | "structured-data"
    | "tool"
    | "memory";
  direction: "left" | "right" | "tilt-right";
  shiftAmount?: number;
}

export const DEFAULT_QUERYPILOT_AGENTS: AgentNode[] = [
  {
    id: "planner-agent",
    title: "Planner Agent",
    subtitle:
      "Understands your query and plans the right execution steps.",
    badgeIconType: "planner",
    direction: "left",
    shiftAmount: 56,
  },
  {
    id: "document-ingestion",
    title: "Document Ingestion",
    subtitle:
      "Parse, chunk, and index unstructured documents.",
    badgeIconType: "document",
    direction: "left",
    shiftAmount: 36,
  },
  {
    id: "hybrid-retrieval",
    title: "Hybrid Retrieval",
    subtitle:
      "Vector semantic matching with keyword reranking.",
    badgeIconType: "retrieval",
    direction: "right",
    shiftAmount: 36,
  },
  {
    id: "tool-selection",
    title: "Tool Selection",
    subtitle:
      "Dynamic function routing and API orchestration.",
    badgeIconType: "tool",
    direction: "right",
    shiftAmount: 36,
  },
  {
    id: "conversation-memory",
    title: "Conversation Memory",
    subtitle:
      "Maintains long-term state across your workspace.",
    badgeIconType: "memory",
    direction: "right",
    shiftAmount: 56,
  },
  {
    id: "structured-data",
    title: "Structured Data Querying",
    subtitle:
      "SQL analytics and tabular database query generation.",
    badgeIconType: "structured-data",
    direction: "tilt-right",
  },
];

interface TileProps {
  agent: AgentNode;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick?: (agent: AgentNode) => void;
  className?: string;
}

const QueryPilotTile: React.FC<TileProps> = ({
  agent,
  isHovered,
  onHover,
  onClick,
  className = "",
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);

  const shiftDistance = agent.shiftAmount || 44;

  const handleMouseEnter = () => {
    onHover(agent.id);

    if (cardRef.current) {
      if (agent.direction === "tilt-right") {
        gsap.to(cardRef.current, {
          rotation: 8,
          x: 6,
          y: -8,
          transformOrigin: "bottom right",
          duration: 0.32,
          ease: "power2.out",
        });
      } else if (agent.direction === "right") {
        gsap.to(cardRef.current, {
          x: shiftDistance,
          duration: 0.3,
          ease: "power2.out",
        });
      } else {
        gsap.to(cardRef.current, {
          x: -shiftDistance,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    }

    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 1,
        scale: 1.15,
        duration: 0.3,
        ease: "power2.out",
      });
    }

    if (trailRef.current) {
      gsap.to(trailRef.current, {
        width: shiftDistance,
        opacity: 0.7,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  };

  const handleMouseLeave = () => {
    onHover(null);

    if (cardRef.current) {
      gsap.to(cardRef.current, {
        rotation: 0,
        x: 0,
        y: 0,
        duration: 0.28,
        ease: "power2.inOut",
      });
    }

    if (glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: 0,
        scale: 0.9,
        duration: 0.25,
        ease: "power2.inOut",
      });
    }

    if (trailRef.current) {
      gsap.to(trailRef.current, {
        width: 0,
        opacity: 0,
        duration: 0.25,
        ease: "power2.inOut",
      });
    }
  };

  const renderIcon = () => {
    const iconProps = {
      className: "h-5 w-5 text-slate-700",
      strokeWidth: 1.7,
    };

    switch (agent.badgeIconType) {
      case "document":
        return <FileText {...iconProps} />;

      case "structured-data":
        return <Database {...iconProps} />;

      case "retrieval":
        return <Search {...iconProps} />;

      case "tool":
        return <Wrench {...iconProps} />;

      case "memory":
        return <MessageSquare {...iconProps} />;

      case "planner":
      default:
        return <GitFork {...iconProps} />;
    }
  };

  return (
    <div
      className={`relative select-none ${className}`}
      style={{
        zIndex: isHovered ? 50 : 10,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Soft mint-teal glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute -inset-12 z-0 rounded-full opacity-0"
        style={{
          background: `
            radial-gradient(
              circle at 50% 50%,
              rgba(56, 217, 165, 0.32) 0%,
              rgba(114, 232, 193, 0.22) 26%,
              rgba(184, 248, 221, 0.13) 48%,
              rgba(217, 255, 241, 0.06) 68%,
              rgba(255, 255, 255, 0) 88%
            )
          `,
          filter: "blur(28px)",
        }}
      />

      {/* Green reveal area for cards moving right */}
      {agent.direction === "right" && (
        <div
          ref={trailRef}
          className="
            pointer-events-none
            absolute
            bottom-0
            left-0
            top-0
            z-20
            w-0
            overflow-hidden
            border-y
            border-l
            opacity-0
            backdrop-blur-md
          "
          style={{
            background:
              "linear-gradient(135deg, rgba(114,232,193,0.55) 0%, rgba(56,217,165,0.35) 55%, rgba(184,248,221,0.25) 100%)",
            borderColor: "rgba(114,232,193,0.55)",
            boxShadow:
              "inset 0 0 18px rgba(217,255,241,0.4), 0 4px 20px rgba(56,217,165,0.18)",
          }}
        >
          <div className="h-full w-full bg-gradient-to-r from-white/35 via-transparent to-transparent" />
        </div>
      )}

      {/* Main transparent glass card */}
      <div
        ref={cardRef}
        onClick={() => onClick?.(agent)}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          borderColor: isHovered
            ? "rgba(8, 167, 122, 0.62)"
            : "rgba(15, 23, 42, 0.14)",
          backgroundColor: "rgba(255,255,255,0.06)",
          boxShadow: isHovered
            ? "0 14px 36px rgba(8,167,122,0.11)"
            : "none",
        }}
        className="
          group
          relative
          z-40
          flex
          h-full
          w-full
          cursor-pointer
          flex-col
          justify-between
          rounded-sm
          border
          p-4
          sm:p-5
          transition-[border-color,box-shadow]
          duration-200
        "
      >
        {/* Top row */}
        <div className="mb-3 flex w-full items-center justify-between">
          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              border
              border-slate-300/65
              bg-white/20
              backdrop-blur-sm
              transition-transform
              duration-200
              group-hover:scale-105
            "
          >
            {renderIcon()}
          </div>

          <div
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              border
              border-slate-300/65
              bg-white/25
              text-slate-600
              backdrop-blur-sm
              transition-all
              duration-200
              group-hover:translate-x-0.5
              group-hover:border-[#101820]
              group-hover:bg-[#101820]
              group-hover:text-white
            "
          >
            <ArrowRight
              className="h-3.5 w-3.5"
              strokeWidth={1.8}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex w-full flex-col items-start">
          <h3 className="text-[17px] font-normal tracking-[-0.02em] text-slate-800 sm:text-[18px]">
            {agent.title}
          </h3>

          <p className="mt-1 line-clamp-2 text-[12px] font-normal leading-relaxed text-slate-500 sm:text-[13px]">
            {agent.subtitle}
          </p>
        </div>
      </div>

      {/* Green reveal area for cards moving left */}
      {agent.direction === "left" && (
        <div
          ref={trailRef}
          className="
            pointer-events-none
            absolute
            bottom-0
            right-0
            top-0
            z-20
            w-0
            overflow-hidden
            border-y
            border-r
            opacity-0
            backdrop-blur-md
          "
          style={{
            background:
              "linear-gradient(135deg, rgba(56,217,165,0.42) 0%, rgba(114,232,193,0.35) 55%, rgba(184,248,221,0.24) 100%)",
            borderColor: "rgba(114,232,193,0.55)",
            boxShadow:
              "inset 0 0 18px rgba(217,255,241,0.4), 0 4px 20px rgba(56,217,165,0.18)",
          }}
        >
          <div className="h-full w-full bg-gradient-to-l from-white/35 via-transparent to-transparent" />
        </div>
      )}
    </div>
  );
};

export interface QueryPilotAgentMeshProps {
  agents?: AgentNode[];
  onSelectAgent?: (agent: AgentNode) => void;
  className?: string;
}

export const QueryPilotAgentMesh: React.FC<
  QueryPilotAgentMeshProps
> = ({
  agents = DEFAULT_QUERYPILOT_AGENTS,
  onSelectAgent,
  className = "",
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const plannerAgent =
    agents.find((a) => a.id === "planner-agent") || agents[0];

  const documentIngestion =
    agents.find((a) => a.id === "document-ingestion") || agents[1];

  const hybridRetrieval =
    agents.find((a) => a.id === "hybrid-retrieval") || agents[2];

  const toolSelection =
    agents.find((a) => a.id === "tool-selection") || agents[3];

  const conversationMemory =
    agents.find((a) => a.id === "conversation-memory") || agents[4];

  const structuredData =
    agents.find((a) => a.id === "structured-data") || agents[5];

  return (
    <div
      className={`flex w-full justify-center overflow-visible ${className}`}
    >
      <div
        className="relative shrink-0"
        style={{
          width: "960px",
          height: "540px",
        }}
      >
        {/* ============================================================
            CIRCUIT / GUIDELINE LAYER
            ============================================================ */}

        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <line
            x1="240"
            y1="90"
            x2="710"
            y2="90"
            stroke="rgba(15,23,42,0.10)"
            strokeWidth="1.1"
            strokeDasharray="4 4"
          />

          <line
            x1="204"
            y1="180"
            x2="204"
            y2="540"
            stroke="rgba(15,23,42,0.10)"
            strokeWidth="1.1"
            strokeDasharray="4 4"
          />

          <line
            x1="675"
            y1="180"
            x2="675"
            y2="540"
            stroke="rgba(15,23,42,0.10)"
            strokeWidth="1.1"
            strokeDasharray="4 4"
          />

          <circle
            cx="204"
            cy="180"
            r="2.5"
            fill="rgba(15,23,42,0.18)"
          />

          <circle
            cx="204"
            cy="360"
            r="2.5"
            fill="rgba(15,23,42,0.18)"
          />

          <circle
            cx="675"
            cy="180"
            r="2.5"
            fill="rgba(15,23,42,0.18)"
          />

          <circle
            cx="675"
            cy="360"
            r="2.5"
            fill="rgba(15,23,42,0.18)"
          />
        </svg>

        {/* ============================================================
            TOP LEFT STRUCTURAL SPACE
            ============================================================ */}

        <div
          className="
            absolute
            z-10
            flex
            flex-col
            items-center
            justify-end
            overflow-visible
            border-b
            border-l
            border-slate-300/60
            bg-transparent
            pb-3
          "
          style={{
            left: "168px",
            top: "0px",
            width: "72px",
            height: "180px",
          }}
        >
          <div
            className="border border-slate-300/70 bg-transparent shadow-none"
            style={{
              width: "42px",
              height: "42px",
              marginBottom: "6px",
              transform: "rotate(45deg)",
            }}
          />
        </div>

        {/* ============================================================
            PLANNER AGENT
            ============================================================ */}

        <div
          className="absolute"
          style={{
            left: "240px",
            top: "0px",
            width: "400px",
            height: "180px",
          }}
        >
          <QueryPilotTile
            agent={plannerAgent}
            isHovered={hoveredId === plannerAgent.id}
            onHover={setHoveredId}
            onClick={onSelectAgent}
            className="h-full w-full"
          />
        </div>

        {/* ============================================================
            UPPER LEFT EMPTY STRUCTURE
            ============================================================ */}

        <div
          className="
            absolute
            z-10
            border
            border-slate-300/60
            bg-transparent
          "
          style={{
            left: "0px",
            top: "180px",
            width: "168px",
            height: "180px",
          }}
        />

        {/* ============================================================
            TOOL SELECTION
            ============================================================ */}

        <div
          className="absolute"
          style={{
            left: "0px",
            top: "360px",
            width: "168px",
            height: "180px",
          }}
        >
          <QueryPilotTile
            agent={toolSelection}
            isHovered={hoveredId === toolSelection.id}
            onHover={setHoveredId}
            onClick={onSelectAgent}
            className="h-full w-full"
          />
        </div>

        {/* ============================================================
            LEFT CENTRAL STRUCTURE
            ============================================================ */}

        <div
          className="absolute z-10 flex flex-col"
          style={{
            left: "168px",
            top: "180px",
            width: "72px",
            height: "360px",
          }}
        >
          <div className="relative h-[180px] w-full border border-slate-300/60 bg-transparent">
            <div className="absolute left-2 top-2 h-1.5 w-1.5 rounded-[0.5px] bg-slate-400/50" />
          </div>

          <div className="flex h-[180px] w-full flex-col justify-between border-x border-b border-slate-300/60 bg-transparent">
            <div className="w-full flex-1 bg-transparent" />

            <div className="h-[72px] w-[72px] border-t border-slate-300/60 bg-transparent" />
          </div>
        </div>

        {/* ============================================================
            DOCUMENT INGESTION
            ============================================================ */}

        <div
          className="absolute"
          style={{
            left: "240px",
            top: "180px",
            width: "200px",
            height: "180px",
          }}
        >
          <QueryPilotTile
            agent={documentIngestion}
            isHovered={hoveredId === documentIngestion.id}
            onHover={setHoveredId}
            onClick={onSelectAgent}
            className="h-full w-full"
          />
        </div>

        {/* ============================================================
            HYBRID RETRIEVAL
            ============================================================ */}

        <div
          className="absolute"
          style={{
            left: "440px",
            top: "180px",
            width: "200px",
            height: "180px",
          }}
        >
          <QueryPilotTile
            agent={hybridRetrieval}
            isHovered={hoveredId === hybridRetrieval.id}
            onHover={setHoveredId}
            onClick={onSelectAgent}
            className="h-full w-full"
          />
        </div>

        {/* ============================================================
            CONVERSATION MEMORY
            ============================================================ */}

        <div
          className="absolute"
          style={{
            left: "240px",
            top: "360px",
            width: "400px",
            height: "180px",
          }}
        >
          <QueryPilotTile
            agent={conversationMemory}
            isHovered={hoveredId === conversationMemory.id}
            onHover={setHoveredId}
            onClick={onSelectAgent}
            className="h-full w-full"
          />
        </div>

        {/* ============================================================
            RIGHT CENTRAL STRUCTURE
            ============================================================ */}

        <div
          className="absolute z-10 flex flex-col"
          style={{
            left: "640px",
            top: "180px",
            width: "70px",
            height: "360px",
          }}
        >
          <div className="h-[180px] w-full border border-slate-300/60 bg-transparent" />

          <div className="h-[180px] w-full border border-slate-300/60 bg-transparent" />
        </div>

        {/* ============================================================
            STRUCTURED DATA
            ============================================================ */}

        <div
          className="absolute"
          style={{
            left: "710px",
            top: "180px",
            width: "170px",
            height: "180px",
          }}
        >
          <QueryPilotTile
            agent={structuredData}
            isHovered={hoveredId === structuredData.id}
            onHover={setHoveredId}
            onClick={onSelectAgent}
            className="h-full w-full"
          />
        </div>

        {/* ============================================================
            LOWER RIGHT STRUCTURE
            ============================================================ */}

        <div
          className="
            absolute
            z-10
            border
            border-slate-300/60
            bg-transparent
          "
          style={{
            left: "710px",
            top: "360px",
            width: "170px",
            height: "180px",
          }}
        />

        {/* ============================================================
            BOTTOM RIGHT DIAMOND
            ============================================================ */}

        <div
          className="
            pointer-events-none
            absolute
            z-10
            flex
            flex-col
            items-center
            justify-end
            overflow-visible
            pb-3
          "
          style={{
            left: "880px",
            top: "360px",
            width: "68px",
            height: "180px",
          }}
        >
          <div
            className="border border-slate-300/70 bg-transparent"
            style={{
              width: "42px",
              height: "42px",
              marginBottom: "6px",
              transform: "rotate(45deg)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default QueryPilotAgentMesh;