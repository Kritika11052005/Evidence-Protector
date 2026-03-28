'use client'
import React, { useState, useRef } from "react"
import { Gap } from "@/types"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

const GapCard: React.FC<{ gap: Gap; index: number }> = ({ gap, index }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const arrowRef = useRef<HTMLSpanElement>(null)

  // Entrance animation
  useGSAP(() => {
    gsap.fromTo(cardRef.current, 
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, delay: index * 0.08, ease: "power2.out" }
    )
  }, { scope: cardRef })

  // Expand/Collapse animation
  useGSAP(() => {
    if (isExpanded) {
        gsap.to(contentRef.current, { height: 'auto', opacity: 1, duration: 0.4, ease: 'power2.inOut' })
        gsap.to(arrowRef.current, { rotation: 180, duration: 0.3 })
    } else {
        gsap.to(contentRef.current, { height: 0, opacity: 0, duration: 0.3, ease: 'power2.inOut' })
        gsap.to(arrowRef.current, { rotation: 0, duration: 0.3 })
    }
  }, [isExpanded])

  const severityColor = {
    CRITICAL: "#ff4444",
    MEDIUM: "#ff8800",
    LOW: "#ffcc00",
  }[gap.severity]

  const severityBg = {
    CRITICAL: "rgba(255, 68, 68, 0.08)",
    MEDIUM: "rgba(255, 136, 0, 0.08)",
    LOW: "rgba(255, 204, 0, 0.08)",
  }[gap.severity]

  const renderAsciiBar = (score: number) => {
    const filledCount = Math.round(score / 10)
    const emptyCount = 10 - filledCount
    return `[${'█'.repeat(filledCount)}${'░'.repeat(emptyCount)}]`
  }

  return (
    <div
      ref={cardRef}
      className="font-mono text-[11px] border border-[#1a3a1a] group/card hover:border-[#00ff88]/40 transition-all duration-300 flex flex-col h-full"
      style={{ background: '#050505' }}
    >
      {/* Card Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between border-b border-[#1a3a1a]"
        style={{ background: severityBg }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span 
            className="text-[10px] font-black px-2 py-0.5 shrink-0"
            style={{ color: '#000', background: severityColor }}
          >
            {gap.severity}
          </span>
          <span className="text-white font-bold truncate text-[11px]">
            GAP #{gap.gap_number}
          </span>
        </div>
        <span className="text-[9px] text-[#1a6b3a] shrink-0 ml-2">
          {gap.duration_seconds}s
        </span>
      </div>

      {/* Pattern Label */}
      <div className="px-4 py-2 border-b border-[#1a3a1a]/50">
        <span className="text-[10px] text-[#00cc66] uppercase tracking-wider truncate block">
          {gap.pattern}
        </span>
      </div>

      {/* Card Body */}
      <div className="px-4 py-3 flex-1 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[#1a6b3a] text-[10px]">Start</span>
          <span className="text-[#00ff88] text-[10px]">{gap.start_time}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#1a6b3a] text-[10px]">End</span>
          <span className="text-[#00ff88] text-[10px]">{gap.end_time}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#1a6b3a] text-[10px]">Duration</span>
          <span className="text-[#00ff88] text-[10px]">{gap.duration_seconds} seconds</span>
        </div>

        {/* Separator */}
        <div className="border-t border-dashed border-[#1a3a1a]/50 my-1" />

        {/* MITRE ATT&CK */}
        <div className="flex justify-between items-start gap-2">
          <span className="text-[#1a6b3a] text-[10px] shrink-0">MITRE</span>
          <a 
            href={`https://attack.mitre.org/techniques/${gap.mitre_id.split('.')[0]}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00ffcc] hover:underline text-[10px] text-right truncate"
          >
            {gap.mitre_id}
          </a>
        </div>

        {/* Tamper Score */}
        <div className="pt-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[#1a6b3a] text-[10px]">Tamper</span>
            <span className="text-[#00ff88] font-bold text-[10px]">{gap.score}/100</span>
          </div>
          {/* Score bar */}
          <div className="w-full h-1.5 bg-[#0a0a0a] border border-[#1a3a1a] overflow-hidden">
            <div 
              className="h-full transition-all duration-700"
              style={{ 
                width: `${gap.score}%`, 
                background: gap.score > 70 ? '#ff4444' : gap.score > 40 ? '#ff8800' : '#00ff88'
              }} 
            />
          </div>
        </div>
      </div>

      {/* Card Footer - View Context */}
      <div className="px-4 py-2 border-t border-[#1a3a1a] mt-auto">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[#00ff88] hover:text-white transition-colors flex items-center gap-1.5 text-[10px] group w-full"
        >
          [<span className="group-hover:text-white underline">VIEW CONTEXT</span> <span ref={arrowRef} className="inline-block text-[8px]">▼</span>]
        </button>

        <div ref={contentRef} className="overflow-hidden h-0 opacity-0">
          <div className="pt-3 space-y-3">
            {/* Reasons */}
            <div>
              <div className="text-[#1a6b3a] text-[9px] mb-1 uppercase tracking-wider">Reasons</div>
              <div className="text-[#00cc66] text-[10px] italic leading-relaxed">
                {gap.score_reasons.map((reason, i) => (
                  <div key={i} className="flex gap-1">
                    <span className="text-[#1a6b3a] shrink-0">›</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[#1a6b3a] text-[9px] mb-1">— Before Gap —</div>
              <div className="text-[#00cc66] whitespace-pre-wrap text-[9px] leading-relaxed opacity-80 max-h-24 overflow-y-auto pl-2 border-l border-[#1a3a1a]">
                {gap.context_before.map(line => `  ${line}`).join("\n")}
              </div>
            </div>
            <div>
              <div className="text-[#1a6b3a] text-[9px] mb-1">— After Gap —</div>
              <div className="text-[#00cc66] whitespace-pre-wrap text-[9px] leading-relaxed opacity-80 max-h-24 overflow-y-auto pl-2 border-l border-[#1a3a1a]">
                {gap.context_after.map(line => `  ${line}`).join("\n")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GapCard
