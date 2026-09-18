import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  FileText,
  Check,
  Cpu,
  ChevronDown,
  ChevronUp,
  Server,
  Sparkles,
} from 'lucide-react';
import { DemoWindow } from './primitives/DemoWindow';
import { StatusPill } from './primitives/StatusPill';
import { DemoButton } from './primitives/DemoButton';

interface DocumentPreset {
  name: string;
  size: string;
  pages: number;
  expectedChunks: number;
}

const PRESETS: DocumentPreset[] = [
  { name: 'Refund_Policy.pdf', size: '1.4 MB', pages: 12, expectedChunks: 48 },
  { name: 'Vendor_SLA_2024.docx', size: '840 KB', pages: 6, expectedChunks: 26 },
];

type IngestStatus = 'idle' | 'uploading' | 'processing' | 'ready';

interface StageProgress {
  key: string;
  name: string;
  status: 'pending' | 'active' | 'done';
  latency: string;
  meta: string;
}

export const AsyncIngestionDemo: React.FC<{ className?: string; id?: string }> = ({
  className = '',
  id = 'async-ingestion-demo',
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentPreset>(PRESETS[0]);
  const [status, setStatus] = useState<IngestStatus>('idle');
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(-1);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [clientTestInput, setClientTestInput] = useState<string>('');

  const timersRef = useRef<number[]>([]);

  const defaultStages: StageProgress[] = [
    { key: 'val', name: 'File validated', status: 'pending', latency: '34ms', meta: 'SHA-256 integrity OK' },
    { key: 'prs', name: 'Parsed', status: 'pending', latency: '190ms', meta: 'Layout & tables normalized' },
    { key: 'chk', name: 'Chunks created', status: 'pending', latency: '240ms', meta: `${selectedDoc.expectedChunks} chunks (overlap: 64t)` },
    { key: 'emb', name: 'Embeddings generated', status: 'pending', latency: '480ms', meta: 'dim: 1536d (batch: 16)' },
    { key: 'idx', name: 'Indexed', status: 'pending', latency: '85ms', meta: 'HNSW graph updated' },
    { key: 'rdy', name: 'Ready to search', status: 'pending', latency: '12ms', meta: 'Workspace cache refreshed' },
  ];

  const [stages, setStages] = useState<StageProgress[]>(defaultStages);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleStartUpload = () => {
    if (status === 'uploading' || status === 'processing') return;
    clearTimers();
    setStatus('uploading');
    setUploadPercent(0);
    setActiveStageIdx(-1);
    setStages(defaultStages.map((s) => ({ ...s, status: 'pending' })));

    const uploadSteps = [20, 55, 85, 100];
    uploadSteps.forEach((pct, index) => {
      const t = window.setTimeout(() => {
        setUploadPercent(pct);
        if (pct === 100) {
          startPipelineProcessing();
        }
      }, (index + 1) * 140);
      timersRef.current.push(t);
    });
  };

  const startPipelineProcessing = () => {
    setStatus('processing');
    const stageDelays = [200, 700, 1300, 2000, 2600, 3100];

    stageDelays.forEach((delay, idx) => {
      const t = window.setTimeout(() => {
        setActiveStageIdx(idx);
        setStages((prev) =>
          prev.map((stg, i) => {
            if (i < idx) return { ...stg, status: 'done' };
            if (i === idx) return { ...stg, status: 'active' };
            return { ...stg, status: 'pending' };
          })
        );

        if (idx === stageDelays.length - 1) {
          const finishTimer = window.setTimeout(() => {
            setStages((prev) => prev.map((stg) => ({ ...stg, status: 'done' })));
            setStatus('ready');
          }, 500);
          timersRef.current.push(finishTimer);
        }
      }, delay);
      timersRef.current.push(t);
    });
  };

  const handleReset = () => {
    clearTimers();
    setStatus('idle');
    setUploadPercent(0);
    setActiveStageIdx(-1);
    setShowDetails(false);
    setStages(defaultStages.map((s) => ({ ...s, status: 'pending' })));
  };

  const handleSelectDoc = (doc: DocumentPreset) => {
    if (status === 'uploading' || status === 'processing') return;
    clearTimers();
    setSelectedDoc(doc);
    setStatus('idle');
    setUploadPercent(0);
    setActiveStageIdx(-1);
    setStages(
      defaultStages.map((s) => ({
        ...s,
        status: 'pending',
        meta: s.key === 'chk' ? `${doc.expectedChunks} chunks (overlap: 64t)` : s.meta,
      }))
    );
  };

  return (
    <DemoWindow
      id={id}
      title="async_ingestion // background_worker_pool"
      badge={
        status === 'ready'
          ? '✓ Ready to search'
          : status === 'processing'
          ? '● Worker Active'
          : status === 'uploading'
          ? '● Ingesting...'
          : '○ Standby'
      }
      badgeVariant={status === 'ready' ? 'success' : status === 'processing' || status === 'uploading' ? 'orange' : 'default'}
      onReset={status !== 'idle' ? handleReset : undefined}
      className={className}
    >
      {/* Top Document Selection & Upload Action */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center justify-between text-xs text-[#A7A29A]">
          <span className="flex items-center gap-1.5 font-medium text-[#F3F0E8]">
            <Server className="w-3.5 h-3.5 text-[#D9822B]" />
            <span className="tracking-tight">Target Document Ingestion</span>
          </span>
          <span className="font-mono text-[10px] text-[#6F6A61]">
            Non-blocking HTTP 202 daemon
          </span>
        </div>

        {/* Document Selector Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESETS.map((doc) => (
            <button
              key={doc.name}
              type="button"
              onClick={() => handleSelectDoc(doc)}
              disabled={status === 'uploading' || status === 'processing'}
              style={{
                backgroundColor: selectedDoc.name === doc.name ? '#352314' : '#15130F',
                borderColor: selectedDoc.name === doc.name ? '#5E3918' : '#302C25',
              }}
              className="flex items-center justify-between p-2.5 rounded-[8px] border text-left transition-colors cursor-pointer hover:border-[#40392F]"
            >
              <div className="flex items-center gap-2.5 truncate">
                <FileText
                  className={`w-4 h-4 shrink-0 ${
                    selectedDoc.name === doc.name ? 'text-[#D9822B]' : 'text-[#6F6A61]'
                  }`}
                />
                <div className="truncate">
                  <div className="text-xs font-medium text-[#F3F0E8] truncate font-sans">{doc.name}</div>
                  <div className="text-[10px] font-mono text-[#6F6A61]">
                    {doc.size} • {doc.pages} pages
                  </div>
                </div>
              </div>
              <span
                style={{
                  color: selectedDoc.name === doc.name ? '#E39135' : '#6F6A61',
                  backgroundColor: selectedDoc.name === doc.name ? '#211D17' : '#0D0C0A',
                  borderColor: selectedDoc.name === doc.name ? '#5E3918' : '#302C25',
                }}
                className="text-[10px] font-mono px-2 py-0.5 rounded-[6px] border shrink-0"
              >
                {doc.expectedChunks} chunks
              </span>
            </button>
          ))}
        </div>

        {/* Upload Button */}
        <div className="flex items-center gap-2 pt-0.5">
          <DemoButton
            id={`${id}-upload-btn`}
            variant="primary"
            size="sm"
            onClick={handleStartUpload}
            loading={status === 'uploading' || status === 'processing'}
            icon={<UploadCloud className="w-3.5 h-3.5 text-[#F3F0E8]" />}
            className="w-full sm:w-auto"
          >
            {status === 'uploading'
              ? 'Uploading...'
              : status === 'processing'
              ? 'Background worker running...'
              : status === 'ready'
              ? 'Upload document'
              : 'Upload document'}
          </DemoButton>

          {status !== 'idle' && (
            <span className="text-xs font-mono text-[#A7A29A] pl-2 hidden sm:inline-block">
              Job ID: <span className="text-[#F3F0E8]">job_ingest_{selectedDoc.name.slice(0, 6).toLowerCase()}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
        {/* Left Col: Upload & Background Pipeline Stages */}
        <div className="md:col-span-7 space-y-3">
          {/* Upload Progress Card */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5"
          >
            <div className="flex items-center justify-between pb-1.5 text-xs font-mono">
              <span className="text-[#A7A29A] flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-[#D9822B]" />
                <span>Binary Transmission</span>
              </span>
              <span style={{ color: uploadPercent === 100 ? '#4FA36A' : '#E39135' }} className="font-semibold">
                {uploadPercent}%
              </span>
            </div>

            {/* Progress Bar: Orange during upload, Green on 100% completion */}
            <div style={{ backgroundColor: '#0D0C0A' }} className="w-full h-1.5 rounded-full overflow-hidden">
              <motion.div
                style={{ backgroundColor: uploadPercent === 100 ? '#4FA36A' : '#D9822B' }}
                className="h-full rounded-full transition-all duration-150"
                initial={{ width: '0%' }}
                animate={{ width: `${uploadPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1.5 text-[10px] font-mono text-[#6F6A61]">
              <span>Protocol: Chunked multipart/form-data</span>
              <span>{uploadPercent === 100 ? '✓ Payload dispatched' : '○ Awaiting transfer'}</span>
            </div>
          </div>

          {/* Background Worker Pipeline Stages */}
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
                <Cpu className="w-3.5 h-3.5 text-[#D9822B]" />
                Daemon Worker Pipeline
              </span>
              <StatusPill
                label={
                  status === 'ready'
                    ? '✓ Ready to search'
                    : status === 'processing'
                    ? `● Processing (${activeStageIdx + 1}/6)`
                    : status === 'uploading'
                    ? '● Staging file'
                    : '○ Waiting'
                }
                variant={status === 'ready' ? 'success' : status === 'processing' ? 'orange' : 'neutral'}
                pulse={status === 'processing'}
              />
            </div>

            {/* Checklist Design: Pending = ○ Gray, Active = ● Orange, Completed = ✓ Green */}
            <div className="space-y-1.5">
              {stages.map((stg, i) => {
                const isDone = stg.status === 'done';
                const isActive = stg.status === 'active';
                return (
                  <div
                    key={stg.key}
                    style={{
                      backgroundColor: isActive ? '#352314' : isDone ? '#18251C' : 'transparent',
                      borderColor: isActive ? '#5E3918' : isDone ? '#2C4D35' : '#302C25',
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-[7px] text-xs font-mono border transition-colors ${
                      isActive
                        ? 'text-[#F3F0E8]'
                        : isDone
                        ? 'text-[#4FA36A]'
                        : 'text-[#6F6A61] opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0">
                        {isDone ? (
                          <Check className="w-3.5 h-3.5 text-[#4FA36A] stroke-[2.5]" />
                        ) : isActive ? (
                          <span className="w-2 h-2 rounded-full bg-[#D9822B] animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full border border-[#6F6A61] inline-block" />
                        )}
                      </span>
                      <span className="truncate">{stg.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px]">
                      {isDone && <span className="text-[#4FA36A] font-mono">✓ {stg.latency}</span>}
                      {isActive && (
                        <span className="text-[#E39135] font-sans animate-pulse">● executing...</span>
                      )}
                      {!isDone && !isActive && <span className="text-[#6F6A61]">waiting</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Client Thread Proof + Metadata Card */}
        <div className="md:col-span-5 flex flex-col gap-3">
          {/* Non-blocking Proof Box */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5 flex-1 flex flex-col justify-between"
          >
            <div>
              <div
                style={{ borderBottomColor: '#302C25' }}
                className="flex items-center justify-between pb-2 mb-2 border-b"
              >
                <span className="font-mono text-[11px] text-[#F3F0E8] flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-[#D9822B]" />
                  Client Thread Unlocked
                </span>
                <span className="text-[10px] font-mono text-[#4FA36A]">✓ 0ms UI lag</span>
              </div>

              <p className="text-xs text-[#A7A29A] font-sans leading-relaxed mb-3">
                Background ingestion runs asynchronously. Your application interface remains 100% interactive.
              </p>

              {/* Live interactive test input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#6F6A61]">
                  Type here to test UI responsiveness during ingestion:
                </label>
                <input
                  type="text"
                  value={clientTestInput}
                  onChange={(e) => setClientTestInput(e.target.value)}
                  placeholder="UI is completely smooth and responsive..."
                  style={{
                    backgroundColor: '#0D0C0A',
                    borderColor: '#302C25',
                    color: '#F3F0E8',
                  }}
                  className="w-full text-xs font-sans px-3 py-2 rounded-[7px] border placeholder-[#6F6A61] focus:outline-none focus:border-[#D9822B] focus:ring-1 focus:ring-[#D9822B]/30"
                />
              </div>
            </div>

            {/* Toggle Metadata Button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  backgroundColor: '#1C1914',
                  borderColor: '#302C25',
                  color: '#A7A29A',
                }}
                className="w-full flex items-center justify-between text-[11px] font-mono py-1.5 px-3 rounded-[7px] border hover:text-[#F3F0E8] hover:border-[#40392F] cursor-pointer transition-colors"
              >
                <span>Pipeline Specs</span>
                {showDetails ? <ChevronUp className="w-3 h-3 text-[#6F6A61]" /> : <ChevronDown className="w-3 h-3 text-[#6F6A61]" />}
              </button>
            </div>
          </div>

          {/* Expandable Technical Metadata Card */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  backgroundColor: '#15130F',
                  borderColor: '#302C25',
                }}
                className="rounded-[10px] border p-3 overflow-hidden text-xs font-mono space-y-1.5 text-[#A7A29A]"
              >
                <div className="flex justify-between">
                  <span>Task queue:</span>
                  <span className="text-[#F3F0E8]">Redis Streams + Custom Worker</span>
                </div>
                <div className="flex justify-between">
                  <span>Worker concurrency:</span>
                  <span className="text-[#F3F0E8]">8 worker threads</span>
                </div>
                <div className="flex justify-between">
                  <span>Vector index:</span>
                  <span className="text-[#F3F0E8]">HNSW (M=16, ef=64)</span>
                </div>
                <div className="flex justify-between">
                  <span>Chunk boundary:</span>
                  <span className="text-[#F3F0E8]">Semantic layout-aware</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DemoWindow>
  );
};
