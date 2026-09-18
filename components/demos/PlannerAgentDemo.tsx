import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Database,
  FileText,
  MessageSquare,
  Binary,
  Layers,
  Check,
  Cpu,
  CornerDownRight,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { DemoWindow } from './primitives/DemoWindow';
import { StatusPill } from './primitives/StatusPill';
import { DemoButton } from './primitives/DemoButton';

interface QueryPreset {
  id: string;
  query: string;
  entities: string[];
  sources: { docs: boolean; structured: boolean; conv: boolean; meta: boolean };
  answer: string;
}

const PRESETS: QueryPreset[] = [
  {
    id: 'refunds',
    query: 'How many damaged orders were refunded last month?',
    entities: ['status = "damaged"', 'action = "refunded"', 'range = "last_month"'],
    sources: { docs: true, structured: true, conv: false, meta: true },
    answer:
      '318 damaged order refunds were validated and executed last month totaling $42,650.00 across 2 carriers (FedEx, DHL). Policy verification confirms all met the 48-hour photo criteria.',
  },
  {
    id: 'vendors',
    query: 'Which vendors had delivery SLA exceptions in Q3?',
    entities: ['domain = "vendor_sla"', 'threshold = "> 98.5%"', 'quarter = "Q3_2024"'],
    sources: { docs: true, structured: true, conv: false, meta: true },
    answer:
      'Apex Logistics (96.2%) and Pacific Cargo (97.1%) breached their 98.5% on-time delivery threshold. Contract penalty terms were matched against vendor_agreements.pdf.',
  },
];

type PlanState = 'idle' | 'running' | 'completed';

export const PlannerAgentDemo: React.FC<{ className?: string; id?: string }> = ({
  className = '',
  id = 'planner-agent-demo',
}) => {
  const [selectedPreset, setSelectedPreset] = useState<QueryPreset>(PRESETS[0]);
  const [customInput, setCustomInput] = useState<string>(PRESETS[0].query);
  const [planState, setPlanState] = useState<PlanState>('idle');
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1);
  const [graphStep, setGraphStep] = useState<number>(0);
  const timersRef = useRef<number[]>([]);

  const stages = [
    { label: 'Understand request', detail: 'Semantic intent & temporal bounds' },
    { label: 'Resolve entities', detail: selectedPreset.entities.join(' • ') },
    { label: 'Select resources', detail: 'Targeted retrieval filter applied' },
    { label: 'Build execution plan', detail: 'Docs + SQLite join graph' },
    { label: 'Validate evidence', detail: 'Attribution score > 0.96' },
  ];

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const handleRunQuery = () => {
    if (planState === 'running') return;
    clearAllTimers();
    setPlanState('running');
    setCurrentStageIndex(0);
    setGraphStep(1);

    const schedule = [
      { delay: 450, stage: 1, graph: 1 },
      { delay: 1000, stage: 2, graph: 2 },
      { delay: 1600, stage: 3, graph: 3 },
      { delay: 2200, stage: 4, graph: 4 },
      { delay: 2800, stage: 5, graph: 5, done: true },
    ];

    schedule.forEach((item) => {
      const timer = window.setTimeout(() => {
        setCurrentStageIndex(item.stage);
        setGraphStep(item.graph);
        if (item.done) {
          setPlanState('completed');
        }
      }, item.delay);
      timersRef.current.push(timer);
    });
  };

  const handleReset = () => {
    clearAllTimers();
    setPlanState('idle');
    setCurrentStageIndex(-1);
    setGraphStep(0);
  };

  const handleSelectPreset = (preset: QueryPreset) => {
    clearAllTimers();
    setSelectedPreset(preset);
    setCustomInput(preset.query);
    setPlanState('idle');
    setCurrentStageIndex(-1);
    setGraphStep(0);
  };

  return (
    <DemoWindow
      id={id}
      title="planner_agent // execution_planner"
      badge={planState === 'completed' ? '✓ Plan Complete' : planState === 'running' ? '● Planning...' : '○ Ready'}
      badgeVariant={planState === 'completed' ? 'success' : planState === 'running' ? 'orange' : 'default'}
      onReset={planState !== 'idle' ? handleReset : undefined}
      className={className}
    >
      {/* Top Query Input Box */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center justify-between text-xs text-[#A7A29A]">
          <label htmlFor={`${id}-query-input`} className="flex items-center gap-1.5 font-medium text-[#F3F0E8]">
            <Cpu className="w-3.5 h-3.5 text-[#D9822B]" />
            <span className="tracking-tight">Autonomous Planner Prompt</span>
          </label>
          <div className="flex items-center gap-1.5">
            <div
              style={{
                backgroundColor: '#1C1914',
                borderColor: '#302C25',
              }}
              className="hidden sm:flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-[6px] border text-[#A7A29A]"
            >
              <span className="text-[#D9822B] font-medium">Plan</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#6F6A61]" />
            </div>
            <span className="font-mono text-[10px] text-[#6F6A61]">
              {planState === 'idle' ? 'Deterministic execution' : 'Targeted resolution'}
            </span>
          </div>
        </div>

        <div className="relative flex flex-col sm:flex-row gap-2">
          <input
            id={`${id}-query-input`}
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            disabled={planState === 'running'}
            placeholder="Ask a technical or multi-source question..."
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
              color: '#F3F0E8',
            }}
            className="w-full text-xs sm:text-sm font-sans px-3.5 py-2.5 rounded-[8px] border placeholder-[#6F6A61] focus:outline-none focus:border-[#D9822B] focus:ring-1 focus:ring-[#D9822B]/30 transition-colors disabled:opacity-60"
          />
          <DemoButton
            id={`${id}-run-btn`}
            variant="primary"
            size="sm"
            onClick={handleRunQuery}
            loading={planState === 'running'}
            icon={<Sparkles className="w-3.5 h-3.5 text-[#F3F0E8]" />}
            className="shrink-0"
          >
            {planState === 'running' ? 'Planning...' : 'Run query'}
          </DemoButton>
        </div>

        {/* Query Presets Chips */}
        <div className="flex items-center gap-2 pt-0.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-mono text-[#6F6A61] shrink-0">Sample:</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p)}
              disabled={planState === 'running'}
              style={{
                backgroundColor: selectedPreset.id === p.id ? '#352314' : '#15130F',
                borderColor: selectedPreset.id === p.id ? '#5E3918' : '#302C25',
                color: selectedPreset.id === p.id ? '#F3F0E8' : '#A7A29A',
              }}
              className="text-[11px] font-mono px-2.5 py-1 rounded-[6px] border transition-colors cursor-pointer shrink-0 truncate max-w-[200px] sm:max-w-none hover:text-[#F3F0E8] hover:border-[#40392F]"
            >
              {p.id === 'refunds' ? 'Damaged orders refunded' : 'Vendor SLA exceptions'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Stage Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
        {/* Left Col: Sequential Stages + Resource Selection */}
        <div className="md:col-span-6 space-y-3">
          {/* Planning Stages Container */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5"
          >
            <div
              style={{ borderBottomColor: '#302C25' }}
              className="flex items-center justify-between pb-2 mb-2.5 border-b"
            >
              <span className="font-mono text-[11px] text-[#F3F0E8] flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-[#D9822B]" />
                Planning Pipeline
              </span>
              <StatusPill
                label={
                  planState === 'completed'
                    ? '✓ Plan complete'
                    : planState === 'running'
                    ? `● Stage ${Math.min(currentStageIndex + 1, 5)}/5`
                    : '○ Waiting'
                }
                variant={planState === 'completed' ? 'success' : planState === 'running' ? 'orange' : 'neutral'}
                pulse={planState === 'running'}
              />
            </div>

            {/* Checklist Design: Pending = ○ Gray, Active = ● Orange, Completed = ✓ Green */}
            <div className="space-y-1.5">
              {stages.map((stage, idx) => {
                const isCompleted = planState === 'completed' || currentStageIndex > idx;
                const isActive = planState === 'running' && currentStageIndex === idx;
                return (
                  <div
                    key={stage.label}
                    style={{
                      backgroundColor: isActive ? '#352314' : isCompleted ? '#18251C' : 'transparent',
                      borderColor: isActive ? '#5E3918' : isCompleted ? '#2C4D35' : '#302C25',
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-[7px] text-xs font-mono border transition-all duration-150 ${
                      isActive
                        ? 'text-[#F3F0E8]'
                        : isCompleted
                        ? 'text-[#4FA36A]'
                        : 'text-[#6F6A61] opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[10px]">
                        {isCompleted ? (
                          <Check className="w-3.5 h-3.5 text-[#4FA36A] stroke-[2.5]" />
                        ) : isActive ? (
                          <span className="w-2 h-2 rounded-full bg-[#D9822B] animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full border border-[#6F6A61] inline-block" />
                        )}
                      </span>
                      <span className="truncate">{stage.label}</span>
                    </div>
                    {isCompleted && (
                      <span className="text-[10px] text-[#4FA36A] shrink-0 font-mono">✓ done</span>
                    )}
                    {isActive && (
                      <span className="text-[10px] text-[#E39135] shrink-0 font-mono animate-pulse">● processing...</span>
                    )}
                    {!isCompleted && !isActive && (
                      <span className="text-[10px] text-[#6F6A61] shrink-0 font-mono">waiting</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Targeted Source Decision Table */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5"
          >
            <div
              style={{ borderBottomColor: '#302C25' }}
              className="flex items-center justify-between pb-2 mb-2.5 border-b text-[11px] font-mono text-[#F3F0E8]"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Database className="w-3.5 h-3.5 text-[#D9822B]" />
                Targeted Source Routing
              </span>
              <span className="text-[10px] text-[#6F6A61]">Zero blind searching</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div
                style={{
                  backgroundColor: planState === 'completed' && selectedPreset.sources.docs ? '#18251C' : planState === 'running' && selectedPreset.sources.docs ? '#352314' : '#15130F',
                  borderColor: planState === 'completed' && selectedPreset.sources.docs ? '#2C4D35' : planState === 'running' && selectedPreset.sources.docs ? '#5E3918' : '#302C25',
                  color: planState === 'completed' && selectedPreset.sources.docs ? '#4FA36A' : planState === 'running' && selectedPreset.sources.docs ? '#E39135' : '#6F6A61',
                }}
                className="p-2 rounded-[7px] border flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3" />
                  <span>Documents</span>
                </span>
                <span>{planState === 'completed' && selectedPreset.sources.docs ? '✓ match' : planState === 'running' ? '● match' : '—'}</span>
              </div>

              <div
                style={{
                  backgroundColor: planState === 'completed' && selectedPreset.sources.structured ? '#18251C' : planState === 'running' && selectedPreset.sources.structured ? '#352314' : '#15130F',
                  borderColor: planState === 'completed' && selectedPreset.sources.structured ? '#2C4D35' : planState === 'running' && selectedPreset.sources.structured ? '#5E3918' : '#302C25',
                  color: planState === 'completed' && selectedPreset.sources.structured ? '#4FA36A' : planState === 'running' && selectedPreset.sources.structured ? '#E39135' : '#6F6A61',
                }}
                className="p-2 rounded-[7px] border flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Binary className="w-3 h-3" />
                  <span>SQLite</span>
                </span>
                <span>{planState === 'completed' && selectedPreset.sources.structured ? '✓ match' : planState === 'running' ? '● match' : '—'}</span>
              </div>

              <div
                style={{
                  backgroundColor: '#15130F',
                  borderColor: '#302C25',
                  color: '#6F6A61',
                }}
                className="p-2 rounded-[7px] border flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" />
                  <span>Conversation</span>
                </span>
                <span>— omit</span>
              </div>

              <div
                style={{
                  backgroundColor: planState === 'completed' && selectedPreset.sources.meta ? '#18251C' : planState === 'running' && selectedPreset.sources.meta ? '#352314' : '#15130F',
                  borderColor: planState === 'completed' && selectedPreset.sources.meta ? '#2C4D35' : planState === 'running' && selectedPreset.sources.meta ? '#5E3918' : '#302C25',
                  color: planState === 'completed' && selectedPreset.sources.meta ? '#4FA36A' : planState === 'running' && selectedPreset.sources.meta ? '#E39135' : '#6F6A61',
                }}
                className="p-2 rounded-[7px] border flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Metadata</span>
                </span>
                <span>{planState === 'completed' && selectedPreset.sources.meta ? '✓ match' : planState === 'running' ? '● match' : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Visual Execution Graph + Answer Preview */}
        <div className="md:col-span-6 flex flex-col gap-3">
          {/* Visual Execution Graph */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5 flex-1 flex flex-col justify-between"
          >
            <div
              style={{ borderBottomColor: '#302C25' }}
              className="flex items-center justify-between pb-2 mb-2 border-b"
            >
              <span className="font-mono text-[11px] text-[#F3F0E8] flex items-center gap-1.5 font-medium">
                <CornerDownRight className="w-3.5 h-3.5 text-[#D9822B]" />
                Execution Graph
              </span>
              <span className="font-mono text-[10px] text-[#6F6A61]">
                {graphStep >= 5 ? '✓ synthesized' : graphStep > 0 ? '● constructing...' : '○ standby'}
              </span>
            </div>

            {/* Visual Node Diagram */}
            <div className="py-2 px-1 flex flex-col items-center justify-center font-mono text-[11px]">
              {/* Level 1: User Request */}
              <div
                style={{
                  backgroundColor: graphStep >= 1 ? '#1C1914' : '#15130F',
                  borderColor: graphStep >= 1 ? '#40392F' : '#302C25',
                  color: graphStep >= 1 ? '#F3F0E8' : '#6F6A61',
                }}
                className="px-3 py-1 rounded-[6px] border text-center transition-all"
              >
                User Request
              </div>

              <div style={{ backgroundColor: '#40392F' }} className="h-2.5 w-px my-0.5" />

              {/* Level 2: Planner */}
              <div
                style={{
                  backgroundColor: graphStep >= 2 ? '#352314' : '#15130F',
                  borderColor: graphStep >= 2 ? '#5E3918' : '#302C25',
                  color: graphStep >= 2 ? '#F3F0E8' : '#6F6A61',
                }}
                className="px-4 py-1.5 rounded-[7px] border font-medium tracking-tight text-center transition-all"
              >
                {graphStep > 2 ? '✓ Planner Agent' : graphStep === 2 ? '● Planner Agent' : '○ Planner Agent'}
              </div>

              {/* Level 3: Divergence into matched sources */}
              <div className="w-full flex justify-between items-center px-4 my-1 text-[#6F6A61]">
                <span className="text-xs">↙</span>
                <span className="text-xs">↓</span>
                <span className="text-xs">↘</span>
              </div>

              <div className="w-full grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div
                  style={{
                    backgroundColor: graphStep >= 4 ? '#18251C' : graphStep === 3 ? '#352314' : '#15130F',
                    borderColor: graphStep >= 4 ? '#2C4D35' : graphStep === 3 ? '#5E3918' : '#302C25',
                    color: graphStep >= 4 ? '#4FA36A' : graphStep === 3 ? '#E39135' : '#6F6A61',
                  }}
                  className="py-1 px-1 rounded-[6px] border transition-all"
                >
                  {graphStep >= 4 ? '✓ Docs' : 'Docs'}
                </div>
                <div
                  style={{
                    backgroundColor: graphStep >= 4 ? '#18251C' : graphStep === 3 ? '#352314' : '#15130F',
                    borderColor: graphStep >= 4 ? '#2C4D35' : graphStep === 3 ? '#5E3918' : '#302C25',
                    color: graphStep >= 4 ? '#4FA36A' : graphStep === 3 ? '#E39135' : '#6F6A61',
                  }}
                  className="py-1 px-1 rounded-[6px] border transition-all"
                >
                  {graphStep >= 4 ? '✓ SQLite' : 'SQLite'}
                </div>
                <div
                  style={{
                    backgroundColor: graphStep >= 4 ? '#18251C' : graphStep === 3 ? '#352314' : '#15130F',
                    borderColor: graphStep >= 4 ? '#2C4D35' : graphStep === 3 ? '#5E3918' : '#302C25',
                    color: graphStep >= 4 ? '#4FA36A' : graphStep === 3 ? '#E39135' : '#6F6A61',
                  }}
                  className="py-1 px-1 rounded-[6px] border transition-all"
                >
                  {graphStep >= 4 ? '✓ Metadata' : 'Metadata'}
                </div>
              </div>

              {/* Level 4: Convergence into Evidence */}
              <div className="w-full flex justify-between items-center px-4 my-1 text-[#6F6A61]">
                <span className="text-xs">↘</span>
                <span className="text-xs">|</span>
                <span className="text-xs">↙</span>
              </div>

              <div
                style={{
                  backgroundColor: graphStep >= 5 ? '#18251C' : graphStep === 4 ? '#352314' : '#15130F',
                  borderColor: graphStep >= 5 ? '#2C4D35' : graphStep === 4 ? '#5E3918' : '#302C25',
                  color: graphStep >= 5 ? '#4FA36A' : graphStep === 4 ? '#E39135' : '#6F6A61',
                }}
                className="px-3 py-1 rounded-[6px] border text-center transition-all"
              >
                {graphStep >= 5 ? '✓ Validated Evidence' : graphStep === 4 ? '● Validating Evidence...' : '○ Validated Evidence'}
              </div>

              <div style={{ backgroundColor: '#40392F' }} className="h-2.5 w-px my-0.5" />

              {/* Level 5: Final Answer */}
              <div
                style={{
                  backgroundColor: graphStep >= 5 ? '#18251C' : '#15130F',
                  borderColor: graphStep >= 5 ? '#2C4D35' : '#302C25',
                  color: graphStep >= 5 ? '#4FA36A' : '#6F6A61',
                }}
                className="px-4 py-1.5 rounded-[7px] border text-center font-medium transition-all"
              >
                {graphStep >= 5 ? '✓ Synthesized Answer' : '○ Synthesized Answer'}
              </div>
            </div>
          </div>

          {/* Answer Preview Box - Success Green Only when Completed */}
          <AnimatePresence>
            {planState === 'completed' ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                style={{
                  backgroundColor: '#18251C',
                  borderColor: '#2C4D35',
                }}
                className="rounded-[10px] border p-3.5"
              >
                <div
                  style={{ borderBottomColor: '#2C4D35' }}
                  className="flex items-center justify-between pb-1.5 mb-2 border-b text-[10px] font-mono text-[#4FA36A]"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-[#4FA36A] stroke-[2.5]" />
                    <span>✓ Plan validated & completed</span>
                  </span>
                  <span className="text-[#A7A29A]">Attribution: 0.99</span>
                </div>
                <p className="text-xs text-[#F3F0E8] font-sans leading-relaxed">
                  {selectedPreset.answer}
                </p>
              </motion.div>
            ) : (
              <div
                style={{
                  borderColor: '#302C25',
                  color: '#6F6A61',
                  backgroundColor: '#15130F',
                }}
                className="rounded-[10px] border border-dashed p-3.5 text-center text-xs font-mono"
              >
                Click &quot;Run query&quot; to observe autonomous plan construction.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DemoWindow>
  );
};
