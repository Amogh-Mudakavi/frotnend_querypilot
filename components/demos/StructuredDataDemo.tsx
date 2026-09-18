import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Table as TableIcon,
  Code2,
  FileSpreadsheet,
  Check,
  Lock,
  Database,
  Sparkles,
} from 'lucide-react';
import { DemoWindow } from './primitives/DemoWindow';
import { StatusPill } from './primitives/StatusPill';
import { DemoButton } from './primitives/DemoButton';

interface QueryScenario {
  id: string;
  nlQuery: string;
  sql: string;
  resultRows: { col1: string; col2: string; col3?: string }[];
  resultHeaders: string[];
  finalAnswer: string;
}

const SCENARIOS: QueryScenario[] = [
  {
    id: 'refunded_orders',
    nlQuery: 'How many refunded orders were there last month?',
    sql: `-- Safe read-only execution (PRAGMA query_only = ON)
SELECT 
  COUNT(*) AS total_refunded_orders,
  PRINTF('$%.2f', SUM(amount)) AS total_refunded_amount
FROM orders
WHERE status = 'refunded'
  AND order_date >= DATE('now', '-1 month');`,
    resultHeaders: ['total_refunded_orders', 'total_refunded_amount'],
    resultRows: [{ col1: '1,248', col2: '$148,320.00' }],
    finalAnswer:
      'Query executed safely: 1,248 refunded orders were recorded last month, totaling $148,320.00 in refund disbursements.',
  },
  {
    id: 'avg_amount_damaged',
    nlQuery: 'What is the average refund amount for damaged orders?',
    sql: `-- Safe read-only execution (PRAGMA query_only = ON)
SELECT 
  COUNT(*) AS damaged_count,
  PRINTF('$%.2f', AVG(amount)) AS avg_refund_amount
FROM orders
WHERE status = 'refunded'
  AND reason = 'damaged_in_transit';`,
    resultHeaders: ['damaged_count', 'avg_refund_amount'],
    resultRows: [{ col1: '342', col2: '$134.12' }],
    finalAnswer:
      'Across 342 damaged order refunds, the average claim amount was $134.12 per order.',
  },
];

const PREVIEW_ROWS = [
  { id: 'ORD-9412', customer: 'Acme Corp', status: 'refunded', amount: '$240.00', date: '2024-08-12' },
  { id: 'ORD-9413', customer: 'Vertex Inc', status: 'delivered', amount: '$1,120.00', date: '2024-08-14' },
  { id: 'ORD-9414', customer: 'Nova Labs', status: 'refunded', amount: '$89.50', date: '2024-08-15' },
  { id: 'ORD-9415', customer: 'Zephyr AI', status: 'processing', amount: '$450.00', date: '2024-08-18' },
];

type PipelineStep = 'idle' | 'inspecting' | 'sql_gen' | 'executing' | 'completed';

export const StructuredDataDemo: React.FC<{ className?: string; id?: string }> = ({
  className = '',
  id = 'structured-data-demo',
}) => {
  const [selectedScenario, setSelectedScenario] = useState<QueryScenario>(SCENARIOS[0]);
  const [step, setStep] = useState<PipelineStep>('idle');
  const [typedSql, setTypedSql] = useState<string>('');
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleRunQuery = () => {
    if (step !== 'idle' && step !== 'completed') return;
    clearTimers();
    setStep('inspecting');
    setTypedSql('');

    // Stage 1: Inspecting schema
    const t1 = window.setTimeout(() => {
      setStep('sql_gen');
      setTypedSql(selectedScenario.sql);

      // Stage 2: Execute query in SQLite
      const t2 = window.setTimeout(() => {
        setStep('executing');

        // Stage 3: Completed
        const t3 = window.setTimeout(() => {
          setStep('completed');
        }, 550);
        timersRef.current.push(t3);
      }, 700);
      timersRef.current.push(t2);
    }, 500);
    timersRef.current.push(t1);
  };

  const handleSelectScenario = (sc: QueryScenario) => {
    clearTimers();
    setSelectedScenario(sc);
    setStep('idle');
    setTypedSql('');
  };

  const handleReset = () => {
    clearTimers();
    setStep('idle');
    setTypedSql('');
  };

  return (
    <DemoWindow
      id={id}
      title="structured_pipeline // sqlite_virtual_vfs"
      badge={
        step === 'completed'
          ? '✓ SQL Query Complete'
          : step === 'executing'
          ? '● Running SQLite query'
          : step === 'sql_gen'
          ? '● Generating Read-Only SQL'
          : step === 'inspecting'
          ? '● Inspecting Schema'
          : '○ Ready'
      }
      badgeVariant={step === 'completed' ? 'success' : step !== 'idle' ? 'orange' : 'default'}
      onReset={step !== 'idle' ? handleReset : undefined}
      className={className}
    >
      {/* Top Query Selector & Action */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center justify-between text-xs text-[#A7A29A]">
          <span className="flex items-center gap-1.5 font-medium text-[#F3F0E8]">
            <Database className="w-3.5 h-3.5 text-[#D9822B]" />
            <span className="tracking-tight">Natural Language to In-Memory SQL</span>
          </span>
          <span className="font-mono text-[10px] text-[#6F6A61]">
            PRAGMA query_only = ON
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
            <span>{selectedScenario.nlQuery}</span>
            <span className="font-mono text-[10px] text-[#6F6A61] hidden sm:inline-block">
              orders.xlsx
            </span>
          </div>

          <DemoButton
            id={`${id}-run-btn`}
            variant="primary"
            size="sm"
            onClick={handleRunQuery}
            loading={step !== 'idle' && step !== 'completed'}
            icon={<Sparkles className="w-3.5 h-3.5 text-[#F3F0E8]" />}
            className="w-full sm:w-auto shrink-0"
          >
            {step === 'inspecting'
              ? 'Inspecting...'
              : step === 'sql_gen'
              ? 'Generating SQL...'
              : step === 'executing'
              ? 'Executing query...'
              : step === 'completed'
              ? 'Re-execute'
              : 'Run query'}
          </DemoButton>
        </div>

        {/* Scenario Switcher Chips */}
        <div className="flex items-center gap-2 pt-0.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-mono text-[#6F6A61] shrink-0">Sample query:</span>
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleSelectScenario(sc)}
              disabled={step !== 'idle' && step !== 'completed'}
              style={{
                backgroundColor: selectedScenario.id === sc.id ? '#352314' : '#15130F',
                borderColor: selectedScenario.id === sc.id ? '#5E3918' : '#302C25',
                color: selectedScenario.id === sc.id ? '#F3F0E8' : '#A7A29A',
              }}
              className="text-[11px] font-mono px-2.5 py-1 rounded-[6px] border transition-colors cursor-pointer shrink-0 truncate max-w-[210px] sm:max-w-none hover:text-[#F3F0E8] hover:border-[#40392F]"
            >
              {sc.id === 'refunded_orders' ? 'Total refunded orders' : 'Avg damaged claim amount'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Data Preview & Generated SQL */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
        {/* Left Col: Uploaded Spreadsheet & Result Table */}
        <div className="md:col-span-6 space-y-3">
          {/* Table Preview Container */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5 overflow-x-auto"
          >
            <div
              style={{ borderBottomColor: '#302C25' }}
              className="flex items-center justify-between pb-2 mb-2 border-b"
            >
              <span className="font-mono text-[11px] text-[#F3F0E8] flex items-center gap-1.5 font-medium">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#D9822B]" />
                Virtual Table: orders (SQLite)
              </span>
              <span className="text-[10px] font-mono text-[#6F6A61]">4 rows sampled</span>
            </div>

            {/* Render sample data */}
            <table className="w-full text-left font-mono text-[11px] text-[#A7A29A]">
              <thead>
                <tr style={{ borderBottomColor: '#302C25' }} className="border-b text-[#6F6A61]">
                  <th className="py-1 px-1.5 font-normal">order_id</th>
                  <th className="py-1 px-1.5 font-normal">status</th>
                  <th className="py-1 px-1.5 font-normal">amount</th>
                  <th className="py-1 px-1.5 font-normal">date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#302C25]">
                {PREVIEW_ROWS.map((row) => (
                  <tr key={row.id} className="hover:bg-[#1C1914]">
                    <td className="py-1 px-1.5 text-[#F3F0E8]">{row.id}</td>
                    <td className="py-1 px-1.5">
                      <span
                        style={{
                          backgroundColor: row.status === 'refunded' ? '#352314' : '#1C1914',
                          borderColor: row.status === 'refunded' ? '#5E3918' : '#302C25',
                          color: row.status === 'refunded' ? '#E39135' : '#A7A29A',
                        }}
                        className="px-1.5 py-0.5 rounded-[4px] border text-[10px]"
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-1 px-1.5">{row.amount}</td>
                    <td className="py-1 px-1.5 text-[#6F6A61]">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Aggregated Query Result Table */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5"
          >
            <div
              style={{ borderBottomColor: '#302C25' }}
              className="flex items-center justify-between pb-2 mb-2 border-b"
            >
              <span className="font-mono text-[11px] text-[#F3F0E8] flex items-center gap-1.5 font-medium">
                <TableIcon className="w-3.5 h-3.5 text-[#D9822B]" />
                Aggregated SQLite Output
              </span>
              <StatusPill
                label={step === 'completed' ? '✓ Executed (1.4ms)' : '○ Awaiting SQL Run'}
                variant={step === 'completed' ? 'success' : 'neutral'}
              />
            </div>

            {step === 'completed' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr style={{ borderBottomColor: '#2C4D35' }} className="border-b text-[#6F6A61] text-[10px]">
                      {selectedScenario.resultHeaders.map((hdr) => (
                        <th key={hdr} className="py-1 px-2 font-normal">
                          {hdr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScenario.resultRows.map((row, i) => (
                      <tr key={i} style={{ backgroundColor: '#18251C' }} className="text-[#4FA36A] font-semibold">
                        <td className="py-1.5 px-2">{row.col1}</td>
                        <td className="py-1.5 px-2">{row.col2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-3 text-xs font-mono text-[#6F6A61]">
                Click &quot;Run query&quot; to execute SQL against the in-memory engine.
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Generated Read-Only SQL & Synthesized Answer */}
        <div className="md:col-span-6 flex flex-col gap-3">
          {/* SQL Editor Frame */}
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
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#F3F0E8] font-medium">
                  <Code2 className="w-3.5 h-3.5 text-[#D9822B]" />
                  <span>Compiled Read-Only SQL</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-[#4FA36A]">
                  <Lock className="w-2.5 h-2.5" />
                  <span>✓ Read-Only Sandbox</span>
                </div>
              </div>

              {/* Code Display: predominantly off-white/gray, subtle orange keyword highlight */}
              <div
                style={{
                  backgroundColor: '#0D0C0A',
                  borderColor: '#302C25',
                }}
                className="rounded-[7px] border p-2.5 font-mono text-xs text-[#A7A29A] h-[130px] overflow-y-auto leading-relaxed"
              >
                {step !== 'idle' ? (
                  <pre className="text-[11px] text-[#F3F0E8] whitespace-pre-wrap">
                    {typedSql || selectedScenario.sql}
                  </pre>
                ) : (
                  <div className="text-[#6F6A61] h-full flex items-center justify-center text-center">
                    SQL statement generates upon execution...
                  </div>
                )}
              </div>
            </div>

            {/* Sandbox Notice */}
            <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[#6F6A61]">
              <span>Dialect: SQLite 3.44</span>
              <span>Transactions: Read-Only Isolated</span>
            </div>
          </div>

          {/* Natural Language Synthesized Answer: Green only when completed */}
          <AnimatePresence>
            {step === 'completed' ? (
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
                  <span className="flex items-center gap-1 font-medium">
                    <Check className="w-3.5 h-3.5 text-[#4FA36A] stroke-[2.5]" />
                    ✓ Synthesized Natural Language Result
                  </span>
                  <span className="text-[#A7A29A]">Safe execution</span>
                </div>
                <p className="text-xs text-[#F3F0E8] font-sans leading-relaxed">
                  {selectedScenario.finalAnswer}
                </p>
              </motion.div>
            ) : (
              <div
                style={{
                  borderColor: '#302C25',
                  color: '#6F6A61',
                  backgroundColor: '#15130F',
                }}
                className="rounded-[10px] border border-dashed p-3 text-center text-xs font-mono"
              >
                Execute query to synthesize structured metrics into answer.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DemoWindow>
  );
};
