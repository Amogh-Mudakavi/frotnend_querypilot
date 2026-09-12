import { Sparkles, Check, Play } from "lucide-react"

/** Top-left pipeline chat card. */
export function PipelineCard() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
      <div className="flex items-center gap-2 border-b border-[#EEF0F3] px-4 py-2.5">
        <span className="text-[12px] font-semibold text-[#687184]">#</span>
        <span className="text-[12.5px] font-semibold tracking-tight text-[#111318]">pipeline</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-[#111318]">Marcus</span>
            <span className="text-[10.5px] text-[#9AA1AF]">10:24</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#3B404B]">
            <span className="font-medium text-[#7D64FF]">@QueryPilot</span> what deals should I focus on today?
          </p>
        </div>
        <div className="rounded-xl bg-[#FBFBFC] p-3 ring-1 ring-[#EEF0F3]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#7D64FF]" aria-hidden />
            <span className="text-[11.5px] font-semibold text-[#111318]">QueryPilot</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-[#687184]">
            <span className="font-medium text-[#111318]">GreenLeaf</span> — verbal yes, no quote out.
            <br />
            <span className="font-medium text-[#111318]">Ramp</span> — stalled in Legal 5d.
          </p>
        </div>
      </div>
    </div>
  )
}

const TOOL_CALLS = ["search-call-recordings-by-metadata", "get-call-recording", "create-task"]

/** Bottom-left dark terminal / command card. */
export function TerminalCard() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-[#23252B] bg-[#121316]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <span className="ml-1 text-[11px] font-medium text-white/40">querypilot — agent</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 py-3 font-mono">
        <p className="text-[11.5px] leading-relaxed text-white/70">
          <span className="text-white/35">{"> "}</span>
          Find yesterday&apos;s demo call and create the right follow-up task.
        </p>
        <div className="space-y-1.5">
          {TOOL_CALLS.map((tool) => (
            <div key={tool} className="flex items-center gap-2 text-[11px] text-white/55">
              <Check className="h-3 w-3 flex-shrink-0 text-[#8B79FF]" aria-hidden />
              <span className="truncate">{tool}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-2">
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-[#8B79FF]" aria-hidden />
          <span className="text-[11px] text-white/70">
            <span className="font-semibold text-white/90">QueryPilot</span> — Follow-up task created.
          </span>
        </div>
      </div>
    </div>
  )
}


/** Right-side call / video intelligence card. */
export function CallIntelligenceCard() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
      <div className="flex items-center justify-between border-b border-[#EEF0F3] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F1EEFF]">
            <Play className="h-2.5 w-2.5 fill-[#7D64FF] text-[#7D64FF]" aria-hidden />
          </span>
          <span className="text-[12.5px] font-semibold tracking-tight text-[#111318]">Product Demo w/ GreenLeaf</span>
        </div>
        <span className="rounded-full bg-[#FBE9EC] px-2 py-0.5 text-[10px] font-medium text-[#B23A4B]">REC</span>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          src="/flower.mp4"
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
        <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm">
          <Play className="h-4 w-4 translate-x-[1px] fill-[#111318] text-[#111318]" aria-hidden />
        </span>
      </div>

      <div className="flex-shrink-0 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-medium text-[#9AA1AF]">
          <span>10:17</span>
          <span>28:14</span>
        </div>
        <div className="relative h-1 w-full rounded-full bg-[#EEF0F3]">
          <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-[#7D64FF]" />
          <span className="absolute left-[38%] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7D64FF] ring-2 ring-white" />
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11.5px]">
          <span className="font-medium text-[#111318]">Meeting</span>
          <span className="text-[#9AA1AF]">Transcript</span>
          <span className="text-[#9AA1AF]">Speakers</span>
        </div>
      </div>
    </div>
  )
}
