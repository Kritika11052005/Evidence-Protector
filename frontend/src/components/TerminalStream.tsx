'use client'
import React, { useEffect, useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

interface TerminalStreamProps {
  lines: string[]
  streaming: boolean
  onComplete?: () => void
}

const TerminalStream: React.FC<TerminalStreamProps> = ({ lines, streaming }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const linesContainerRef = useRef<HTMLDivElement>(null)

  // Height animation on mount
  useGSAP(() => {
    gsap.fromTo(terminalRef.current, 
      { height: 0, opacity: 0 },
      { height: "auto", opacity: 1, duration: 0.4, ease: "power2.out" }
    )
  }, [])

  // Auto-scroll and line entry animation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }

    // Animate the latest line
    if (linesContainerRef.current && lines.length > 0) {
        const lastLine = linesContainerRef.current.lastElementChild
        if (lastLine) {
            gsap.fromTo(lastLine,
                { x: -10, opacity: 0 },
                { x: 0, opacity: 1, duration: 0.15 }
            )
        }
    }

    // Border flash on CRITICAL
    const lastLineContent = lines[lines.length - 1]
    if (lastLineContent?.includes('[CRITICAL]')) {
        gsap.fromTo(terminalRef.current,
            { borderColor: "#ff4444" },
            { borderColor: "#1a3a1a", duration: 0.8 }
        )
    }
  }, [lines])

  // Completion border animation
  useGSAP(() => {
    if (!streaming && lines.length > 0) {
      gsap.to(terminalRef.current, {
        borderColor: "#00ff88",
        duration: 0.5,
      })
    }
  }, [streaming])

  const getLineClass = (line: string) => {
    if (line.includes('[CRITICAL]')) return 'text-[#ff4444]'
    if (line.includes('[MEDIUM]')) return 'text-[#ff8800]'
    if (line.includes('[LOW]')) return 'text-[#ffcc00]'
    if (line.includes('GAP #')) return 'text-white'
    if (line.includes('═══') || line.includes('───')) return 'text-[#1a6b3a]'
    if (line.includes('Pattern :') || line.includes('MITRE')) return 'text-[#00ffcc]'
    if (line.includes('Tamper Score')) return 'text-[#00ff88] font-bold'
    return 'text-[#00ff88]'
  }

  return (
    <div className="relative z-10 px-0 max-w-6xl mx-auto mb-16">
      <div 
        ref={terminalRef}
        className="bg-black overflow-hidden rounded-lg border-2 border-[#1a3a1a] shadow-2xl transition-colors duration-500"
      >
        {/* Header Bar */}
        <div className="bg-black border-b border-[#1a3a1a] px-4 py-2 flex justify-between items-center text-[11px] font-mono uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="text-[#00ff88]">[ EVIDENCE PROTECTOR v1.0 ]</span>
            <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full bg-[#00ff88] ${streaming ? "animate-pulse shadow-[0_0_5px_#00ff88]" : ""}`} />
                <span className="text-[#00ff88] opacity-80">[ LIVE SESSION ]</span>
            </div>
          </div>
          <div className="text-[#00ff88]">
            STATUS: <span className={streaming ? "animate-pulse" : ""}>{streaming ? "ANALYZING..." : "COMPLETE"}</span>
          </div>
        </div>
        
        {/* Terminal Body */}
        <div 
          ref={scrollRef}
          className="p-6 h-[400px] overflow-y-auto font-mono text-[13px] leading-relaxed bg-black scrollbar-custom"
        >
          <div ref={linesContainerRef}>
            {lines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap ${getLineClass(line)}`}>
                {line}
              </div>
            ))}
          </div>
          {streaming && (
            <span className="inline-block w-2.5 h-4 bg-[#00ff88] animate-pulse align-middle ml-1" />
          )}
        </div>
      </div>
    </div>
  )
}

export default TerminalStream

