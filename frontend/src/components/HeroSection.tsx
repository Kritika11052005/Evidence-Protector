'use client'
import React, { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import RadarScanner from "@/components/RadarScanner"

const HeroSection: React.FC = () => {
  const container = useRef<HTMLDivElement>(null)
  const [typedText, setTypedText] = useState("")
  const fullText = "[ DELL DAY IDEATHON — EVIDENCE_PROTECTOR_v1.0 ]"

  // Typewriter effect for badge
  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      setTypedText(fullText.slice(0, i))
      i++
      if (i > fullText.length) clearInterval(timer)
    }, 40)
    return () => clearInterval(timer)
  }, [])

  // Heading & Stat animations
  useGSAP(() => {
    const tl = gsap.timeline()

    tl.from(".hero-word", {
      y: 40,
      opacity: 0,
      duration: 0.8,
      stagger: 0.08,
      ease: "power3.out",
      delay: 0.2
    })
    .from(".subtext", {
      opacity: 0,
      y: 10,
      duration: 1,
      ease: "sine.out"
    }, "-=0.4")
    .from(".stat-pill", {
      scale: 0.8,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: "back.out(1.7)"
    }, "-=0.6")
  }, { scope: container })

  return (
    <section ref={container} className="relative z-10 w-full pt-24 pb-16 px-0 max-w-6xl mx-auto font-mono">
      <div className="flex flex-row items-center justify-between gap-8 md:gap-16 w-full">
        {/* Left Side: Text Content */}
        <div className="flex flex-col items-start gap-6 flex-1 min-w-0 text-left">
          <div className="text-[#00ff88] text-[13px] bg-black border border-[#1a6b3a] px-3 py-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-pulse shadow-[0_0_5px_#00ff88]" />
            <span>{typedText}</span>
            <span className="w-2 h-4 bg-[#00ff88] animate-pulse" />
          </div>
          
          <h1 className="text-6xl lg:text-8xl font-bold text-white leading-[0.9] tracking-tighter uppercase overflow-hidden">
            {"Evidence Protector".split(" ").map((word, i) => (
              <span key={i} className="hero-word inline-block mr-4">
                {word}
              </span>
            ))}
          </h1>

          <p className="subtext text-lg lg:text-xl text-[#00cc66] max-w-2xl mt-2 leading-relaxed opacity-80 backdrop-blur-sm">
             &gt; LOG_INTEGRITY_MONITOR_INITIALIZED... <br/>
             &gt; SCANNING FOR ANOMALOUS TIME GAPS... <br/>
             &gt; STANDBY FOR FORENSIC-GRADE REPORTING.
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            <div className="stat-pill border border-[#1a6b3a] px-4 py-2 bg-black text-[11px] text-[#00ff88] flex items-center gap-2 hover:bg-[#001a0d] transition-colors cursor-default">
              [ STATUS: OPTIMIZED ]
            </div>
            <div className="stat-pill border border-[#1a6b3a] px-4 py-2 bg-black text-[11px] text-[#00ff88] flex items-center gap-2 hover:bg-[#001a0d] transition-colors cursor-default">
              [ MITRE ATT&CK: MAPPED ]
            </div>
            <div className="stat-pill border border-[#1a6b3a] px-4 py-2 bg-black text-[11px] text-[#00ff88] flex items-center gap-2 hover:bg-[#001a0d] transition-colors cursor-default">
              [ LATENCY: 1.2MS ]
            </div>
          </div>
        </div>

        {/* Right Side: Radar Scanner */}
        <div className="flex-shrink-0 flex items-center justify-center mix-blend-screen opacity-[0.85] pointer-events-none origin-right scale-[0.6] sm:scale-[0.8] lg:scale-100 xl:scale-110">
           <RadarScanner />
        </div>
      </div>
    </section>
  )
}

export default HeroSection

