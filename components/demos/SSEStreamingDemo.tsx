import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  ArrowUp,
  FileCheck,
  Terminal,
  Check,
} from 'lucide-react';
import { DemoWindow } from './primitives/DemoWindow';
import { StatusPill } from './primitives/StatusPill';
import { DemoButton } from './primitives/DemoButton';

interface SSEEventLog {
  id: string;
  type: 'connecting' | 'search' | 'delta' | 'complete';
  text: string;
  timestamp: string;
}

const STREAMING_TOKENS = [
  'According',
  ' to',
  ' the',
  ' workspace',
  ' refund',
  ' policy',
  ' (v2.4),',
  ' eligible',
  ' orders',
  ' may',
  ' be',
  ' returned',
  ' within',
  ' 30',
  ' calendar',
  ' days',
  ' of',
  ' confirmed',
  ' carrier',
  ' delivery.',
  '\n\n',
  '1.',
  ' Condition:',
  ' Items',
  ' must',
  ' remain',
  ' in',
  ' pristine',
  ' condition',
  ' with',
  ' factory',
  ' packaging.',
  '\n',
  '2.',
  ' Damaged',
  ' Goods:',
  ' Return',
  ' shipping',
  ' is',
  ' fully',
  ' waived;',
  ' photographic',
  ' verification',
  ' triggers',
  ' expedited',
  ' refund',
  ' within',
  ' 48',
  ' hours.',
  '\n',
  '3.',
  ' Payout',
  ' Method:',
  ' Credits',
  ' are',
  ' posted',
  ' directly',
  ' to',
  ' original',
  ' card',
  ' via',
  ' Stripe',
  ' within',
  ' 3-5',
  ' business',
  ' days.',
];

const SOURCES = [
  { id: '1', title: 'refund_policy_v2.pdf', page: 'p. 4, § 2.1', relevance: '99.2%' },
  { id: '2', title: 'returns_sop_warehouse.md', page: 'lines 84-112', relevance: '96.8%' },
];

type StreamPhase = 'idle' | 'connecting' | 'searching' | 'streaming' | 'completed';

export const SSEStreamingDemo: React.FC<{ className?: string; id?: string }> = ({
  className = '',
  id = 'sse-streaming-demo',
}) => {
  const [phase, setPhase] = useState<StreamPhase>('idle');
  const [streamedText, setStreamedText] = useState<string>('');
  const [events, setEvents] = useState<SSEEventLog[]>([]);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const eventsContainerRef = useRef<HTMLDivElement | null>(null);

  const clearAllTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const addEvent = (type: SSEEventLog['type'], text: string) => {
    const now = new Date();
    const timeStr = `${now.getSeconds()}.${String(now.getMilliseconds()).padStart(3, '0')}s`;
    setEvents((prev) => [
      ...prev.slice(-14),
      { id: `${Date.now()}-${Math.random()}`, type, text, timestamp: timeStr },
    ]);
  };

  const handleStartStreaming = () => {
    if (phase !== 'idle' && phase !== 'completed') return;
    clearAllTimers();
    setStreamedText('');
    setEvents([]);
    setTokenCount(0);
    setElapsedMs(0);
    setPhase('connecting');

    const start = Date.now();
    setStartTime(start);

    // Initial SSE connection event
    addEvent('connecting', 'GET /api/v1/query/stream HTTP/2');
    addEvent('connecting', 'EventStream: text/event-stream; charset=utf-8');

    // Stage 1: Connecting (250ms)
    timerRef.current = window.setTimeout(() => {
      setPhase('searching');
      addEvent('search', 'event: lifecycle_search | status: "HNSW_vector_probe"');

      // Stage 2: Streaming start (600ms)
      timerRef.current = window.setTimeout(() => {
        setPhase('streaming');
        addEvent('delta', 'event: connection_open | buffer: 64kb');

        let tokenIndex = 0;
        intervalRef.current = window.setInterval(() => {
          if (tokenIndex < STREAMING_TOKENS.length) {
            const nextTok = STREAMING_TOKENS[tokenIndex];
            setStreamedText((prev) => prev + nextTok);
            setTokenCount((prev) => prev + 1);
            setElapsedMs(Date.now() - start);

            if (tokenIndex % 7 === 0) {
              addEvent('delta', `event: answer_delta | bytes: ${nextTok.length + 12}`);
            }

            tokenIndex++;
          } else {
            // Done
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPhase('completed');
            setElapsedMs(Date.now() - start);
            addEvent('complete', 'event: complete | status: 200 OK');
          }
        }, 32); // 32ms per token = ~31 tokens/sec
      }, 350);
    }, 250);
  };

  const handleReset = () => {
    clearAllTimers();
    setPhase('idle');
    setStreamedText('');
    setEvents([]);
    setTokenCount(0);
    setElapsedMs(0);
  };

  // Auto-scroll the SSE Event monitor to bottom
  useEffect(() => {
    if (eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
  }, [events]);

  const tokensPerSec = elapsedMs > 0 ? ((tokenCount / elapsedMs) * 1000).toFixed(1) : '31.2';

  return (
    <DemoWindow
      id={id}
      title="sse_stream // chunked_transfer_http2"
      badge={
        phase === 'completed'
          ? '✓ Stream complete'
          : phase === 'streaming'
          ? `● Streaming (${tokenCount} tokens)`
          : phase === 'searching'
          ? '● Probing embeddings'
          : phase === 'connecting'
          ? '● Negotiating HTTP/2'
          : '○ Ready'
      }
      badgeVariant={phase === 'completed' ? 'success' : phase !== 'idle' ? 'orange' : 'default'}
      onReset={phase !== 'idle' ? handleReset : undefined}
      className={className}
    >
      {/* Top Query Trigger Box */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center justify-between text-xs text-[#A7A29A]">
          <span className="flex items-center gap-1.5 font-medium text-[#F3F0E8]">
            <Zap className="w-3.5 h-3.5 text-[#D9822B]" />
            <span className="tracking-tight">Server-Sent Events Prompt</span>
          </span>
          <span className="font-mono text-[10px] text-[#6F6A61]">
            Chunked text/event-stream
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-[8px] border text-xs sm:text-sm font-sans text-[#F3F0E8]"
          >
            <span>What are the exact return timeline and conditions for refunds?</span>
            <span className="font-mono text-[10px] text-[#6F6A61] hidden sm:inline-block">
              GET /v1/stream
            </span>
          </div>

          <DemoButton
            id={`${id}-send-btn`}
            variant="primary"
            size="sm"
            onClick={handleStartStreaming}
            loading={phase === 'connecting' || phase === 'searching' || phase === 'streaming'}
            icon={<ArrowUp className="w-3.5 h-3.5 text-[#F3F0E8] stroke-[2.5]" />}
            className="w-full sm:w-auto shrink-0"
          >
            {phase === 'streaming'
              ? 'Streaming...'
              : phase === 'completed'
              ? 'Re-stream'
              : 'Send'}
          </DemoButton>
        </div>
      </div>

      {/* Main Streaming Display */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
        {/* Left Col: Streamed Output Window */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-3">
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5 flex-1 flex flex-col justify-between min-h-[220px]"
          >
            <div>
              <div
                style={{ borderBottomColor: '#302C25' }}
                className="flex items-center justify-between pb-2 mb-2.5 border-b"
              >
                <span className="font-mono text-[11px] text-[#F3F0E8] flex items-center gap-1.5 font-medium">
                  <Terminal className="w-3 h-3 text-[#D9822B]" />
                  Live Token Output
                </span>
                <StatusPill
                  label={
                    phase === 'completed'
                      ? '✓ Stream complete'
                      : phase === 'streaming'
                      ? '● Emitting chunks'
                      : phase === 'searching'
                      ? '● Vector probe'
                      : '○ Standby'
                  }
                  variant={phase === 'completed' ? 'success' : phase !== 'idle' ? 'orange' : 'neutral'}
                  pulse={phase === 'streaming'}
                />
              </div>

              {/* Text Render with Cursor: Content remains off-white, cursor is orange */}
              <div className="text-xs sm:text-sm font-sans text-[#F3F0E8] leading-relaxed whitespace-pre-line">
                {streamedText ? (
                  <span>{streamedText}</span>
                ) : (
                  <span className="text-[#6F6A61] font-mono text-xs">
                    Click &quot;Send&quot; to initiate chunked HTTP/2 event streaming...
                  </span>
                )}
                {phase === 'streaming' && (
                  <span className="inline-block w-1.5 h-3.5 bg-[#D9822B] ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            </div>

            {/* Performance Stats Footer */}
            <div
              style={{
                borderTopColor: '#302C25',
                color: '#A7A29A',
              }}
              className="pt-2 mt-3 border-t flex items-center justify-between text-[11px] font-mono"
            >
              <div className="flex items-center gap-3">
                <span>
                  Tokens: <strong className="text-[#F3F0E8]">{tokenCount}</strong>
                </span>
                <span>
                  Throughput: <strong className="text-[#E39135]">{tokensPerSec} t/s</strong>
                </span>
              </div>
              <div>
                TTFT: <strong className={phase === 'completed' ? 'text-[#4FA36A]' : 'text-[#F3F0E8]'}>{phase === 'completed' ? '✓ 320ms' : '320ms'}</strong>
              </div>
            </div>
          </div>

          {/* Source Attribution Cards: Green check on completion */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {SOURCES.map((src) => (
              <div
                key={src.id}
                style={{
                  backgroundColor: phase === 'completed' ? '#18251C' : '#15130F',
                  borderColor: phase === 'completed' ? '#2C4D35' : '#302C25',
                }}
                className="p-2 rounded-[8px] border flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {phase === 'completed' ? (
                    <Check className="w-3.5 h-3.5 text-[#4FA36A] stroke-[2.5]" />
                  ) : (
                    <FileCheck className="w-3.5 h-3.5 text-[#6F6A61]" />
                  )}
                  <span
                    style={{ color: phase === 'completed' ? '#F3F0E8' : '#A7A29A' }}
                    className="truncate text-[11px]"
                  >
                    {src.title}
                  </span>
                </div>
                <span
                  style={{ color: phase === 'completed' ? '#4FA36A' : '#6F6A61' }}
                  className="text-[10px] shrink-0 font-medium"
                >
                  {phase === 'completed' ? `✓ ${src.relevance}` : src.relevance}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Raw SSE Event Stream Monitor */}
        <div className="md:col-span-5 flex flex-col gap-3">
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
                  <Zap className="w-3.5 h-3.5 text-[#D9822B]" />
                  SSE Event Frames
                </span>
                <span className="text-[10px] font-mono text-[#6F6A61]">
                  {events.length} frames
                </span>
              </div>

              {/* Event Log Window */}
              <div
                ref={eventsContainerRef}
                style={{
                  backgroundColor: '#0D0C0A',
                  borderColor: '#302C25',
                }}
                className="rounded-[7px] border p-2 font-mono text-[10px] h-[190px] overflow-y-auto space-y-1"
              >
                {events.length === 0 ? (
                  <div className="text-[#6F6A61] h-full flex items-center justify-center text-center">
                    Awaiting SSE stream trigger...
                  </div>
                ) : (
                  events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-1.5 leading-tight">
                      <span className="text-[#6F6A61] shrink-0">[{ev.timestamp}]</span>
                      <span
                        style={{
                          color:
                            ev.type === 'complete'
                              ? '#4FA36A'
                              : ev.type === 'delta'
                              ? '#E39135'
                              : '#A7A29A',
                        }}
                        className="truncate"
                      >
                        {ev.type === 'complete' ? `✓ ${ev.text}` : ev.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Protocol Badge */}
            <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[#6F6A61]">
              <span>Connection: Keep-Alive</span>
              <span>Wire: gzip / HTTP2</span>
            </div>
          </div>

          {/* Compact Architecture Spec */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3 font-mono text-[11px] space-y-1 text-[#A7A29A]"
          >
            <div className="flex justify-between">
              <span>Backpressure:</span>
              <span className="text-[#F3F0E8]">Client ACK windowing</span>
            </div>
            <div className="flex justify-between">
              <span>Frame multiplexing:</span>
              <span className="text-[#F3F0E8]">RFC 7540 Stream ID 3</span>
            </div>
          </div>
        </div>
      </div>
    </DemoWindow>
  );
};
