import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Building2,
  FileText,
  Table as TableIcon,
  Check,
  Play,
  Lock,
  EyeOff,
} from 'lucide-react';
import { DemoWindow } from './primitives/DemoWindow';
import { StatusPill } from './primitives/StatusPill';
import { DemoButton } from './primitives/DemoButton';

interface WorkspaceData {
  id: string;
  name: string;
  tenantId: string;
  scopeTag: string;
  docs: { name: string; type: string; size: string }[];
  tables: { name: string; rows: string }[];
  querySample: string;
  queryResult: {
    status: 'success' | 'blocked';
    content: string;
    sourcesCount: number;
  };
}

const WORKSPACES: WorkspaceData[] = [
  {
    id: 'acme_support',
    name: 'Acme Support',
    tenantId: 'ws_acme_489',
    scopeTag: 'scope::tenant_isolated_vfs',
    docs: [
      { name: 'Refund_Policy.pdf', type: 'PDF', size: '1.4 MB' },
      { name: 'Delivery_Issues.pdf', type: 'PDF', size: '890 KB' },
      { name: 'Customer_Tiers.md', type: 'MD', size: '120 KB' },
    ],
    tables: [
      { name: 'support_tickets.sqlite', rows: '14,200 rows' },
      { name: 'order_claims.sqlite', rows: '3,420 rows' },
    ],
    querySample: 'What are our refund rules for damaged deliveries?',
    queryResult: {
      status: 'success',
      content:
        'Sourced from [Refund_Policy.pdf] in ws_acme_489: Full refund issued within 48h upon photographic verification of transit damage. Returns waived.',
      sourcesCount: 2,
    },
  },
  {
    id: 'retail_ops',
    name: 'Retail Operations',
    tenantId: 'ws_retail_902',
    scopeTag: 'scope::tenant_isolated_vfs',
    docs: [
      { name: 'Store_Operations_Guide.pdf', type: 'PDF', size: '2.8 MB' },
      { name: 'POS_Hardware_Manual.docx', type: 'DOCX', size: '1.1 MB' },
      { name: 'Inventory_Audit_Q3.pdf', type: 'PDF', size: '940 KB' },
    ],
    tables: [
      { name: 'store_inventory.sqlite', rows: '48,000 rows' },
      { name: 'supplier_roster.sqlite', rows: '890 rows' },
    ],
    querySample: 'What are our refund rules for damaged deliveries?',
    queryResult: {
      status: 'blocked',
      content:
        'Tenant boundary strictly enforced: ws_retail_902 contains 0 refund policy documents. Cross-tenant access to ws_acme_489 blocked at storage & vector partitions.',
      sourcesCount: 0,
    },
  },
];

export const WorkspaceIsolationDemo: React.FC<{ className?: string; id?: string }> = ({
  className = '',
  id = 'workspace-isolation-demo',
}) => {
  const [selectedWsId, setSelectedWsId] = useState<string>(WORKSPACES[0].id);
  const [isQueryRunning, setIsQueryRunning] = useState<boolean>(false);
  const [hasExecutedQuery, setHasExecutedQuery] = useState<boolean>(false);
  const timersRef = useRef<number[]>([]);

  const activeWs = WORKSPACES.find((w) => w.id === selectedWsId) || WORKSPACES[0];

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const handleSwitchWorkspace = (newId: string) => {
    if (newId === selectedWsId) return;
    clearTimers();
    setSelectedWsId(newId);
    setHasExecutedQuery(false);
    setIsQueryRunning(false);
  };

  const handleRunQuery = () => {
    if (isQueryRunning) return;
    clearTimers();
    setIsQueryRunning(true);
    setHasExecutedQuery(false);

    const timer = window.setTimeout(() => {
      setIsQueryRunning(false);
      setHasExecutedQuery(true);
    }, 550);

    timersRef.current.push(timer);
  };

  const handleReset = () => {
    clearTimers();
    setSelectedWsId(WORKSPACES[0].id);
    setHasExecutedQuery(false);
    setIsQueryRunning(false);
  };

  return (
    <DemoWindow
      id={id}
      title="workspace_isolation // tenant_boundary_enforcer"
      badge={`Tenant: ${activeWs.tenantId}`}
      badgeVariant="default"
      onReset={selectedWsId !== WORKSPACES[0].id || hasExecutedQuery ? handleReset : undefined}
      className={className}
    >
      {/* Top Workspace Selector Tabs */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center justify-between text-xs text-[#A7A29A]">
          <span className="flex items-center gap-1.5 font-medium text-[#F3F0E8]">
            <Shield className="w-3.5 h-3.5 text-[#D9822B]" />
            <span className="tracking-tight">Multi-Tenant Partition Sandbox</span>
          </span>
          <span className="font-mono text-[10px] text-[#6F6A61]">
            Workspace-Scoped Authorization
          </span>
        </div>

        {/* Workspace Switcher Pills: Selected = Orange accented subtle background */}
        <div className="flex items-center gap-2">
          {WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => handleSwitchWorkspace(ws.id)}
              style={{
                backgroundColor: selectedWsId === ws.id ? '#352314' : '#15130F',
                borderColor: selectedWsId === ws.id ? '#5E3918' : '#302C25',
                color: selectedWsId === ws.id ? '#F3F0E8' : '#A7A29A',
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] border text-xs font-sans font-medium transition-colors cursor-pointer hover:border-[#40392F]"
            >
              <Building2
                className={`w-3.5 h-3.5 ${
                  selectedWsId === ws.id ? 'text-[#D9822B]' : 'text-[#6F6A61]'
                }`}
              />
              <span>{ws.name}</span>
              <span
                style={{
                  backgroundColor: selectedWsId === ws.id ? '#211D17' : '#0D0C0A',
                  borderColor: selectedWsId === ws.id ? '#5E3918' : '#302C25',
                  color: selectedWsId === ws.id ? '#E39135' : '#6F6A61',
                }}
                className="text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] border ml-1"
              >
                {ws.tenantId}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Isolated Resources + Cross-Tenant Query Simulator */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
        {/* Left Col: Tenant Virtual Filesystem */}
        <div className="md:col-span-6 space-y-3">
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
                <FileText className="w-3.5 h-3.5 text-[#D9822B]" />
                Partitioned Vector Store
              </span>
              <span className="text-[10px] font-mono text-[#4FA36A]">
                ✓ namespace: {activeWs.tenantId}
              </span>
            </div>

            {/* Document list with green checkmark confirming isolation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeWs.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.12 }}
                className="space-y-1.5"
              >
                {activeWs.docs.map((d) => (
                  <div
                    key={d.name}
                    style={{
                      backgroundColor: '#0D0C0A',
                      borderColor: '#302C25',
                    }}
                    className="flex items-center justify-between p-2 rounded-[7px] border text-xs font-mono text-[#A7A29A]"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Check className="w-3 h-3 text-[#4FA36A] stroke-[2.5]" />
                      <span className="text-[#F3F0E8] truncate">{d.name}</span>
                    </span>
                    <span className="text-[10px] text-[#6F6A61] shrink-0">{d.size}</span>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* SQLite Table Isolation */}
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
                Isolated SQLite Databases
              </span>
              <span className="text-[10px] font-mono text-[#4FA36A]">✓ VFS Sandboxed</span>
            </div>

            <div className="space-y-1.5">
              {activeWs.tables.map((tbl) => (
                <div
                  key={tbl.name}
                  style={{
                    backgroundColor: '#0D0C0A',
                    borderColor: '#302C25',
                  }}
                  className="flex items-center justify-between p-2 rounded-[7px] border text-xs font-mono text-[#A7A29A]"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Check className="w-3 h-3 text-[#4FA36A] stroke-[2.5]" />
                    <span className="text-[#F3F0E8] truncate">{tbl.name}</span>
                  </span>
                  <span className="text-[10px] text-[#A7A29A] shrink-0 font-medium">{tbl.rows}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Cross-Tenant Boundary Query Test */}
        <div className="md:col-span-6 flex flex-col gap-3">
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
                  <Shield className="w-3.5 h-3.5 text-[#D9822B]" />
                  Boundary Leakage Audit
                </span>
                <span className="text-[10px] font-mono text-[#6F6A61]">
                  Query Sandbox
                </span>
              </div>

              <div className="space-y-2 mb-3">
                <label className="text-[11px] font-mono text-[#6F6A61]">
                  Test Query against active partition ({activeWs.tenantId}):
                </label>
                <div
                  style={{
                    backgroundColor: '#0D0C0A',
                    borderColor: '#302C25',
                  }}
                  className="p-2 rounded-[7px] border text-xs text-[#F3F0E8] font-sans"
                >
                  &quot;{activeWs.querySample}&quot;
                </div>
              </div>

              <DemoButton
                variant="primary"
                size="sm"
                onClick={handleRunQuery}
                loading={isQueryRunning}
                icon={<Play className="w-3 h-3 text-[#F3F0E8] fill-current" />}
                className="w-full"
              >
                {isQueryRunning
                  ? 'Verifying partition boundaries...'
                  : `Test query against ${activeWs.name}`}
              </DemoButton>

              {/* Execution Result Box: Green confirmation on successful isolation */}
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  {hasExecutedQuery ? (
                    <motion.div
                      key={activeWs.id + '-executed'}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        backgroundColor: '#18251C',
                        borderColor: '#2C4D35',
                      }}
                      className="p-3 rounded-[8px] border text-xs"
                    >
                      <div
                        style={{
                          borderBottomColor: '#2C4D35',
                          color: '#4FA36A',
                        }}
                        className="flex items-center justify-between pb-1 mb-1.5 border-b font-mono text-[10px]"
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          {activeWs.queryResult.status === 'success' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#4FA36A] stroke-[2.5]" />
                              <span>✓ Valid Tenant Retrieval (2 sources)</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-[#4FA36A]" />
                              <span>✓ Cross-Tenant Access Blocked (0 leaked)</span>
                            </>
                          )}
                        </span>
                        <span>✓ Workspace isolated</span>
                      </div>
                      <p className="text-[#F3F0E8] font-sans leading-relaxed">
                        {activeWs.queryResult.content}
                      </p>
                    </motion.div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: '#0D0C0A',
                        borderColor: '#302C25',
                        color: '#6F6A61',
                      }}
                      className="rounded-[8px] border border-dashed p-3 text-center text-xs font-mono"
                    >
                      Click &quot;Test query&quot; to audit isolation boundaries.
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Workspace Scope Tag */}
            <div
              style={{
                borderTopColor: '#302C25',
                color: '#A7A29A',
              }}
              className="pt-2.5 mt-2 border-t flex items-center justify-between text-[10px] font-mono"
            >
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-[#D9822B]" />
                <span>Execution Scope:</span>
              </span>
              <span className="text-[#F3F0E8]">{activeWs.scopeTag}</span>
            </div>
          </div>
        </div>
      </div>
    </DemoWindow>
  );
};
