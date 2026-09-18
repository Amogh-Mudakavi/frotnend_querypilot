import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  User,
  ArrowUp,
  Link as LinkIcon,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { DemoWindow } from './primitives/DemoWindow';
import { StatusPill } from './primitives/StatusPill';
import { DemoButton } from './primitives/DemoButton';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  isContextual?: boolean;
  resolvedEntity?: string;
  referencedTurnId?: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'turn-1-user',
    sender: 'user',
    text: 'What is our refund policy?',
  },
  {
    id: 'turn-1-assistant',
    sender: 'assistant',
    text: 'Standard orders are eligible for a full refund within 30 calendar days of delivery. Goods must be returned in their original packaging with the invoice number attached.',
  },
];

const FOLLOW_UPS = [
  {
    label: 'What about damaged items?',
    answer:
      'For damaged items specifically, return shipment is waived. Customers have an extended 45-day window to upload photographic evidence for automated credit.',
    resolvedEntity: 'Scope: refund_policy → damaged_items_clause',
    referencedId: 'turn-1-user',
  },
  {
    label: 'How long does it take?',
    answer:
      'Once verified, "it" (the refund credit for damaged orders) takes 3 to 5 business days to post to the customer\'s original payment method via Stripe.',
    resolvedEntity: 'Pronoun "it" → [refund credit posting latency]',
    referencedId: 'turn-1-assistant',
  },
  {
    label: 'Can customers exchange instead?',
    answer:
      'Yes, instant 1:1 exchanges are permitted for equal-value variants with priority warehouse fulfillment dispatched prior to return receipt.',
    resolvedEntity: 'Scope: exchange_alternative_clause',
    referencedId: 'turn-1-user',
  },
];

export const ConversationMemoryDemo: React.FC<{ className?: string; id?: string }> = ({
  className = '',
  id = 'conversation-memory-demo',
}) => {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState<number>(1); // Default to "How long does it take?"
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [highlightedTurnId, setHighlightedTurnId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');

  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const triggerFollowUp = (index: number) => {
    if (isGenerating) return;
    clearTimers();
    setSelectedQuestionIdx(index);
    setIsGenerating(true);
    const chosen = FOLLOW_UPS[index];

    // Add user question
    const userMsg: Message = {
      id: `turn-${messages.length + 1}-user`,
      sender: 'user',
      text: chosen.label,
    };

    setMessages([...INITIAL_MESSAGES, userMsg]);
    setHighlightedTurnId(chosen.referencedId);

    // Realistic assistant delay with context indicator
    const timer = window.setTimeout(() => {
      const assistantMsg: Message = {
        id: `turn-${messages.length + 2}-assistant`,
        sender: 'assistant',
        text: chosen.answer,
        isContextual: true,
        resolvedEntity: chosen.resolvedEntity,
        referencedTurnId: chosen.referencedId,
      };
      setMessages([...INITIAL_MESSAGES, userMsg, assistantMsg]);
      setIsGenerating(false);
    }, 650);

    timersRef.current.push(timer);
  };

  const handleManualSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualInput.trim() || isGenerating) return;

    const lower = manualInput.toLowerCase();
    const matchedIdx = lower.includes('long') || lower.includes('time') || lower.includes('it')
      ? 1
      : 0;

    triggerFollowUp(matchedIdx);
    setManualInput('');
  };

  const handleReset = () => {
    clearTimers();
    setMessages(INITIAL_MESSAGES);
    setSelectedQuestionIdx(1);
    setHighlightedTurnId(null);
    setIsGenerating(false);
    setManualInput('');
  };

  return (
    <DemoWindow
      id={id}
      title="conversation_memory // entity_resolution"
      badge={messages.length > 2 ? '✓ Turn 2 Connected' : '○ Turn 1 Loaded'}
      badgeVariant={messages.length > 2 ? 'success' : 'default'}
      onReset={messages.length > 2 ? handleReset : undefined}
      className={className}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
        {/* Left Col: Dialogue Thread */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-3">
          {/* Messages Container */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[310px]"
          >
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isReferenced = highlightedTurnId === msg.id;

              return (
                <div
                  key={msg.id}
                  style={{
                    backgroundColor: isReferenced ? '#211D17' : isUser ? '#0D0C0A' : '#15130F',
                    borderColor: isReferenced ? '#D9822B' : '#302C25',
                  }}
                  className={`relative p-3 rounded-[8px] border transition-all text-xs ${
                    isReferenced ? 'ring-1 ring-[#D9822B]/40' : ''
                  }`}
                >
                  {/* Speaker Label & Indicators */}
                  <div
                    style={{ borderBottomColor: '#302C25' }}
                    className="flex items-center justify-between pb-1.5 mb-1.5 border-b"
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      {isUser ? (
                        <User className="w-3 h-3 text-[#A7A29A]" />
                      ) : (
                        <Bot className="w-3 h-3 text-[#D9822B]" />
                      )}
                      <span className={`font-medium ${isUser ? 'text-[#A7A29A]' : 'text-[#F3F0E8]'}`}>
                        {isUser ? 'User Turn' : 'QueryPilot Assistant'}
                      </span>
                    </div>

                    {isReferenced && (
                      <span
                        style={{
                          backgroundColor: '#352314',
                          borderColor: '#5E3918',
                          color: '#E39135',
                        }}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] border flex items-center gap-1"
                      >
                        <LinkIcon className="w-2.5 h-2.5" />
                        Referenced Context
                      </span>
                    )}

                    {msg.isContextual && (
                      <span
                        style={{
                          backgroundColor: '#18251C',
                          borderColor: '#2C4D35',
                          color: '#4FA36A',
                        }}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] border flex items-center gap-1"
                      >
                        <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                        Context Resolved
                      </span>
                    )}
                  </div>

                  {/* Message Content */}
                  <p className="text-[#F3F0E8] font-sans leading-relaxed text-xs">
                    {msg.text}
                  </p>

                  {/* Disambiguation callout */}
                  {msg.resolvedEntity && (
                    <div
                      style={{
                        backgroundColor: '#18251C',
                        borderColor: '#2C4D35',
                      }}
                      className="mt-2.5 p-2 rounded-[6px] border text-[11px] font-mono text-[#4FA36A] flex items-center gap-1.5"
                    >
                      <Check className="w-3 h-3 text-[#4FA36A] shrink-0 stroke-[2.5]" />
                      <span>{msg.resolvedEntity}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {isGenerating && (
              <div
                style={{
                  backgroundColor: '#352314',
                  borderColor: '#5E3918',
                }}
                className="p-2.5 rounded-[8px] border text-xs font-mono text-[#E39135] flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-[#D9822B] animate-ping shrink-0" />
                <span>● Resolving antecedent pronoun &quot;it&quot; against Turn 1...</span>
              </div>
            )}
          </div>

          {/* Bottom Composer Input */}
          <form
            onSubmit={handleManualSend}
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="p-2 rounded-[9px] border flex items-center gap-2"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ask a follow-up (e.g. 'How long does it take?')..."
              style={{ color: '#F3F0E8' }}
              className="flex-1 bg-transparent px-2 text-xs font-sans placeholder-[#6F6A61] focus:outline-none"
            />
            {/* Circular understated send button with orange accent */}
            <button
              type="submit"
              disabled={isGenerating || !manualInput.trim()}
              style={{
                backgroundColor: manualInput.trim() ? '#D9822B' : '#1C1914',
                color: manualInput.trim() ? '#F3F0E8' : '#6F6A61',
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Send message"
            >
              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </form>
        </div>

        {/* Right Col: Questions Component (Cursor Pattern) */}
        <div className="md:col-span-5 flex flex-col gap-3">
          {/* Questions Panel */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3.5 flex flex-col justify-between flex-1"
          >
            <div>
              {/* Header */}
              <div
                style={{ borderBottomColor: '#302C25' }}
                className="flex items-center justify-between pb-2 mb-3 border-b"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-sans text-sm font-semibold text-[#F3F0E8] tracking-tight">
                    Questions
                  </span>
                  <span className="font-mono text-[10px] text-[#6F6A61]">1 of 3</span>
                </div>
                <div className="flex items-center gap-1 text-[#6F6A61]">
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionIdx((prev) => Math.max(0, prev - 1))}
                    className="p-1 rounded hover:bg-[#1C1914] hover:text-[#F3F0E8] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionIdx((prev) => Math.min(FOLLOW_UPS.length - 1, prev + 1))}
                    className="p-1 rounded hover:bg-[#1C1914] hover:text-[#F3F0E8] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Main Question Text */}
              <div className="mb-3">
                <p className="text-xs text-[#A7A29A] font-mono mb-1">Select follow-up query:</p>
                <p className="text-sm font-semibold text-[#F3F0E8] font-sans tracking-tight">
                  {FOLLOW_UPS[selectedQuestionIdx].label}
                </p>
              </div>

              {/* Numbered Options */}
              <div className="space-y-1.5">
                {FOLLOW_UPS.map((item, idx) => {
                  const isSelected = selectedQuestionIdx === idx;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setSelectedQuestionIdx(idx)}
                      style={{
                        backgroundColor: isSelected ? '#352314' : '#0D0C0A',
                        borderColor: isSelected ? '#5E3918' : '#302C25',
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-[7px] border text-left cursor-pointer transition-colors group"
                    >
                      {/* Compact numeric selector */}
                      <span
                        style={{
                          backgroundColor: isSelected ? '#D9822B' : '#1C1914',
                          borderColor: isSelected ? '#B56B1E' : '#302C25',
                          color: isSelected ? '#F3F0E8' : '#A7A29A',
                        }}
                        className="w-5 h-5 rounded-[5px] border flex items-center justify-center font-mono text-[11px] shrink-0 font-medium"
                      >
                        {idx + 1}
                      </span>
                      <span
                        style={{ color: isSelected ? '#F3F0E8' : '#A7A29A' }}
                        className="text-xs font-sans tracking-tight truncate group-hover:text-[#F3F0E8]"
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions: Skip (Ghost) & Continue (Primary Orange) */}
            <div className="pt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleReset}
                style={{ color: '#A7A29A' }}
                className="text-xs font-sans px-3 py-1.5 rounded-[7px] hover:text-[#F3F0E8] hover:bg-[#1C1914] transition-colors cursor-pointer"
              >
                Skip
              </button>

              <DemoButton
                variant="primary"
                size="sm"
                onClick={() => triggerFollowUp(selectedQuestionIdx)}
                loading={isGenerating}
                className="px-4"
              >
                Continue
              </DemoButton>
            </div>
          </div>

          {/* Workspace Memory Inspector */}
          <div
            style={{
              backgroundColor: '#15130F',
              borderColor: '#302C25',
            }}
            className="rounded-[10px] border p-3 font-mono text-[11px] space-y-1 text-[#A7A29A]"
          >
            <div className="flex justify-between">
              <span>Memory buffer:</span>
              <span className="text-[#F3F0E8]">2 turns retained</span>
            </div>
            <div className="flex justify-between">
              <span>Token consumption:</span>
              <span className="text-[#F3F0E8]">420 / 4,096 tokens</span>
            </div>
            <div className="flex justify-between">
              <span>Disambiguation:</span>
              <span className="text-[#4FA36A]">✓ Active (pronoun resolver)</span>
            </div>
          </div>
        </div>
      </div>
    </DemoWindow>
  );
};
