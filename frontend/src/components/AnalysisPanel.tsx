'use client'
import React, { useState, useRef } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"

interface AnalysisPanelProps {
  onRun: (mode: "demo" | "upload", threshold: number, file: File | null) => void
  isAnalyzing: boolean
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ onRun, isAnalyzing }) => {
  const [mode, setMode] = useState<"demo" | "upload">("demo")
  const [threshold, setThreshold] = useState(60)
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  
  const demoCardRef = useRef<HTMLDivElement>(null)
  const uploadCardRef = useRef<HTMLDivElement>(null)
  const runBtnRef = useRef<HTMLButtonElement>(null)

  // Demo/Upload selection animation
  const handleModeSelect = (newMode: "demo" | "upload") => {
    setMode(newMode)
    const target = newMode === "demo" ? demoCardRef.current : uploadCardRef.current
    gsap.fromTo(target, 
        { backgroundColor: "#001a0d", borderColor: "#00ff88" },
        { backgroundColor: "#000000", borderColor: "#00ff88", duration: 0.6 }
    )
  }

  // Button pulse animation
  useGSAP(() => {
    if (!isAnalyzing) {
        gsap.to(runBtnRef.current, {
            boxShadow: "0 0 20px #00ff88",
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
        })
    } else {
        gsap.killTweensOf(runBtnRef.current)
    }
  }, [isAnalyzing])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      handleModeSelect("upload")
    }
  }

  return (
    <div className="relative z-10 max-w-6xl mx-auto mb-20 font-mono">
      <div className="grid grid-cols-2 gap-16 mb-24">
        {/* Demo Card */}
        <div
          ref={demoCardRef}
          onClick={() => handleModeSelect("demo")}
          className={`cursor-pointer p-10 border-2 transition-all group ${
            mode === "demo" ? "border-[#00ff88]" : "border-[#1a3a1a]"
          } bg-black text-[#00ff88] overflow-hidden`}
        >
          <h3 className="text-xl font-bold mb-4">┌ USE DEMO LOG ┐</h3>
          <p className="text-sm opacity-60 mb-6 tracking-tighter">FILE: HDFS_2k.log</p>
          <ul className="text-[11px] space-y-2 opacity-40 group-hover:opacity-80 transition-opacity">
            <li> {">"} LOAD_REDUNDANT_HADOOP_DATA</li>
            <li> {">"} 2000_LINES_VALIDATED</li>
            <li> {">"} STATUS: READY</li>
          </ul>
        </div>

        {/* Upload Card */}
        <div
          ref={uploadCardRef}
          onClick={() => {
              handleModeSelect("upload")
              document.getElementById('fileInput')?.click()
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`cursor-pointer p-10 border-2 ${
            isDragOver || mode === "upload" ? "border-solid border-[#00ff88]" : "border-dashed border-[#1a3a1a]"
          } bg-black text-[#00ff88] transition-all overflow-hidden`}
        >
          <h3 className="text-xl font-bold mb-4">┌ UPLOAD YOUR LOG ┐</h3>
          <p className="text-sm opacity-80 mb-6 truncate italic">
            {file ? `> FILE LOADED: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : "> DROP LOG FILE HERE OR CLICK TO BROWSE"}
          </p>
          <input
            type="file"
            id="fileInput"
            className="hidden"
            onChange={handleFileChange}
            accept=".log,.txt"
            aria-label="Upload log file"
          />
          <div className="text-[11px] opacity-40 flex justify-between">
            <span>ACCEPTED: .LOG .TXT</span>
            <span>MAX SIZE: 50MB</span>
          </div>
        </div>
      </div>

      {/* Threshold Slider */}
      <div className="border border-[#1a3a1a] p-12 mb-16 bg-black">
        <div className="flex justify-between items-center mb-8">
          <label className="text-sm text-[#00ff88] uppercase tracking-widest italic">
             Gap Threshold: <span className="text-white bg-[#1a3a1a] px-4 py-1">{threshold} SECONDS</span>
          </label>
        </div>
        <input
          type="range"
          min="10"
          max="600"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value))}
          className="w-full h-1.5 bg-[#0a0a0a] rounded-none appearance-none cursor-pointer accent-[#00ff88] border border-[#1a3a1a]"
          aria-label="Gap threshold in seconds"
        />
        <div className="flex justify-between text-[12px] text-[#1a6b3a] mt-4 font-mono">
          <span>010S</span>
          <span>600S</span>
        </div>
      </div>

      <button
        ref={runBtnRef}
        onClick={() => onRun(mode, threshold, file)}
        onMouseEnter={() => !isAnalyzing && gsap.to(runBtnRef.current, { scale: 1.02, duration: 0.15 })}
        onMouseLeave={() => !isAnalyzing && gsap.to(runBtnRef.current, { scale: 1, duration: 0.15 })}
        disabled={isAnalyzing}
        className={`w-full font-bold text-xl py-6 transition-all mt-8 ${
          isAnalyzing ? "bg-[#0a0a0a] text-[#1a6b3a] cursor-not-allowed" : "bg-[#00ff88] text-black"
        }`}
      >
        {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
                [ ANALYZING... ] <span className="w-3 h-5 bg-[#1a6b3a] animate-pulse" />
            </span>
        ) : "[ RUN ANALYSIS ]"}
      </button>
    </div>



  )
}

export default AnalysisPanel

