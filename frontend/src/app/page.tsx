"use client";

import React, { useState } from "react";
import ThreeBackground from "@/components/ThreeBackground";
import HeroSection from "@/components/HeroSection";
import AnalysisPanel from "@/components/AnalysisPanel";
import TerminalStream from "@/components/TerminalStream";
import GapCard from "@/components/GapCard";
import HeatmapGrid from "@/components/HeatmapGrid";
import SeverityChart from "@/components/SeverityChart";
import MitreChart from "@/components/MitreChart";
import { AnalysisResult } from "@/types";

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [activeMode, setActiveMode] = useState<"demo" | "upload">("demo");
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const handleRunAnalysis = async (mode: "demo" | "upload", threshold: number, file: File | null) => {
    setIsAnalyzing(true);
    setStreamLines([]);
    setResults(null);
    setActiveMode(mode);
    setVisibleCount(10); // Reset count on new run

    let filename = "HDFS_2k.log";

    if (mode === "upload" && file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("threshold", threshold.toString());

      try {
        const uploadRes = await fetch("http://localhost:8000/analyze/upload", {
          method: "POST",
          body: formData,
        });
        const data = await uploadRes.json();
        filename = data.metadata.file;
        setUploadedFilename(filename);
      } catch (err) {
        setStreamLines(["[ERROR] Failed to upload file. Ensure backend is running at http://localhost:8000"]);
        setIsAnalyzing(false);
        return;
      }
    }

    // Connect to SSE
    const streamUrl = mode === "demo" 
      ? `http://localhost:8000/stream/demo?threshold=${threshold}`
      : `http://localhost:8000/stream/upload?filename=${filename}&threshold=${threshold}`;

    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      setStreamLines((prev) => [...prev, event.data]);
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsAnalyzing(false);
      // Fetch final results after stream ends
      fetchFinalResults(mode, threshold);
    };
  };

  const fetchFinalResults = async (mode: "demo" | "upload", threshold: number) => {
    const url = mode === "demo" ? "http://localhost:8000/analyze/demo" : "http://localhost:8000/analyze/demo"; // Simplified
    try {
        const body = mode === "demo" ? JSON.stringify({ threshold }) : JSON.stringify({ threshold });
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body
        });
        const data = await res.json();
        setResults(data);
    } catch {
        console.error("Failed to fetch results");
    }
  };

  const downloadFile = (type: "json" | "html") => {
    const filename = activeMode === "demo" ? "HDFS_2k.log" : uploadedFilename;
    window.open(`http://localhost:8000/download/${type}?filename=${filename}&threshold=60`, "_blank");
  };

  return (
    <main className="min-h-screen px-8 sm:px-16 md:px-24">
      <ThreeBackground />
      
      <div className="relative z-10">
        <HeroSection />
        
        <AnalysisPanel onRun={handleRunAnalysis} isAnalyzing={isAnalyzing} />

        {(isAnalyzing || streamLines.length > 0) && (
          <TerminalStream 
            lines={streamLines} 
            streaming={isAnalyzing} 
            onComplete={() => {}} 
          />
        )}

        {results && (
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Stats Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
               <div className="bg-[#050505] border border-[#1a3a1a] p-8 text-center relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff88]" />
                  <div className="text-3xl font-bold text-[#00ff88] mb-1">{results.summary.total_gaps}</div>
                  <div className="text-[10px] text-[#1a6b3a] font-mono uppercase tracking-widest">Gaps_Found</div>
               </div>
               <div className="bg-[#050505] border border-[#1a3a1a] p-8 text-center relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#ff4444]" />
                  <div className="text-3xl font-bold text-[#ff4444] mb-1">{results.summary.critical}</div>
                  <div className="text-[10px] text-[#1a6b3a] font-mono uppercase tracking-widest">Critical_Alerts</div>
               </div>
               <div className="bg-[#050505] border border-[#1a3a1a] p-8 text-center relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#ff8800]" />
                  <div className="text-3xl font-bold text-[#ff8800] mb-1">{results.summary.avg_tamper_score}%</div>
                  <div className="text-[10px] text-[#1a6b3a] font-mono uppercase tracking-widest">Forensic_Confidence</div>
               </div>
               <div className="bg-[#050505] border border-[#1a3a1a] p-8 text-center relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff88] opacity-30" />
                  <div className="text-3xl font-bold text-white mb-1">{results.metadata.lines_processed.toLocaleString()}</div>
                  <div className="text-[10px] text-[#1a6b3a] font-mono uppercase tracking-widest">Lines_Analyzed</div>
               </div>
            </div>

            <div className="space-y-24">
                {/* PRIMARY: Detection Log (Full Width) */}
                <div className="relative">
                    <div className="flex justify-between items-center mb-10 pb-4 border-b border-[#1a3a1a]">
                        <h2 className="text-2xl font-bold text-[#00ff88]">
                           <span className="opacity-50 font-normal mr-2">/01</span> DETECTION_LOG
                        </h2>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => downloadFile("json")}
                                className="text-[10px] font-mono border border-[#1a6b3a] px-4 py-2 hover:bg-[#00ff88] hover:text-black transition-all"
                            >
                                GET_JSON
                            </button>
                            <button 
                                 onClick={() => downloadFile("html")}
                                 className="text-[10px] font-mono border border-[#1a6b3a] px-4 py-2 hover:bg-[#00ff88] hover:text-black transition-all"
                            >
                                GET_HTML_REPORT
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
                       {results.gaps.slice(0, visibleCount).map((gap, i) => (
                            <GapCard key={i} gap={gap} index={i} />
                       ))}
                    </div>

                    {results.gaps.length > visibleCount && (
                      <div className="mt-16 mb-24 flex justify-center">
                        <button 
                          onClick={() => setVisibleCount(prev => prev + 10)}
                          className="px-16 py-5 border-2 border-[#1a3a1a] text-[#00ff88] font-bold hover:bg-[#00ff88] hover:text-black transition-all group relative overflow-hidden"
                        >
                          <span className="relative z-10 font-black tracking-widest text-lg">[ LOAD_NEXT_SEQUENCE_DATA ]</span>
                          <div className="absolute inset-0 bg-[#00ff88] translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                        </button>
                      </div>
                    )}
                </div>

                {/* SECONDARY: Intelligence Dashboard */}
                <div className="border-t border-[#1a3a1a] pt-16 space-y-8">
                    
                    {/* Section Header */}
                    <div className="flex justify-between items-center pb-4 border-b border-[#1a3a1a]">
                        <h2 className="text-2xl font-bold text-[#00ff88]">
                           <span className="opacity-50 font-normal mr-2">/02</span> INTELLIGENCE_DASHBOARD
                        </h2>
                        <span className="text-[10px] text-[#1a6b3a] font-mono tracking-wider">
                           GENERATED: {results.metadata.generated_at}
                        </span>
                    </div>

                    {/* Full-Width Heatmap Card */}
                    <div className="bg-[#050505] border border-[#1a3a1a] p-6 md:p-8 hover:border-[#00ff88]/30 transition-colors duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-2 h-2 bg-[#00ff88]" />
                            <h3 className="text-xs font-bold text-[#00ff88] uppercase tracking-[0.2em]">Temporal_Intelligence</h3>
                        </div>
                        <HeatmapGrid data={results.heatmap} />
                    </div>

                    {/* 3-Column Intelligence Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        {/* Card 1: Severity Breakdown Chart */}
                        <div className="bg-[#050505] border border-[#1a3a1a] p-6 flex flex-col hover:border-[#ff4444]/30 transition-colors duration-300">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#1a3a1a]">
                                <div className="w-2 h-2 bg-[#ff4444]" />
                                <h3 className="text-xs font-bold text-[#ff4444] uppercase tracking-[0.2em]">Severity_Distribution</h3>
                            </div>
                            <SeverityChart
                                critical={results.summary.critical}
                                medium={results.summary.medium}
                                low={results.summary.low}
                                avgTamperScore={results.summary.avg_tamper_score}
                            />
                        </div>

                        {/* Card 2: MITRE ATT&CK Chart */}
                        <div className="bg-[#050505] border border-[#1a3a1a] p-6 flex flex-col hover:border-[#ff8800]/30 transition-colors duration-300">
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#1a3a1a]">
                                <div className="w-2 h-2 bg-[#ff8800]" />
                                <h3 className="text-xs font-bold text-[#ff8800] uppercase tracking-[0.2em]">MITRE_ATT&CK_Map</h3>
                            </div>
                            <MitreChart gaps={results.gaps} />
                        </div>

                        {/* Card 3: Forensic Summary & System Status */}
                        <div className="bg-[#050505] border border-[#1a3a1a] p-6 flex flex-col hover:border-[#00ff88]/30 transition-colors duration-300">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#1a3a1a]">
                                <div className="w-2 h-2 bg-[#00ff88]" />
                                <h3 className="text-xs font-bold text-[#00ff88] uppercase tracking-[0.2em]">Forensic_Summary</h3>
                            </div>

                            {/* Stats table */}
                            <div className="space-y-0 flex-1 text-[11px] font-mono">
                                {[
                                    { label: 'FILE_ANALYZED', value: results.metadata.file },
                                    { label: 'LINES_PROCESSED', value: results.metadata.lines_processed.toLocaleString() },
                                    { label: 'MALFORMED_SKIPPED', value: results.metadata.malformed_skipped.toLocaleString() },
                                    { label: 'THRESHOLD', value: `${results.metadata.threshold_seconds}s` },
                                    { label: 'TOTAL_GAPS', value: results.summary.total_gaps.toString() },
                                    { label: 'LONGEST_GAP', value: `${results.gaps.length > 0 ? Math.max(...results.gaps.map(g => g.duration_seconds)) : 0}s` },
                                    { label: 'SHORTEST_GAP', value: `${results.gaps.length > 0 ? Math.min(...results.gaps.map(g => g.duration_seconds)) : 0}s` },
                                    { label: 'MAX_TAMPER_SCORE', value: `${results.gaps.length > 0 ? Math.max(...results.gaps.map(g => g.score)) : 0}/100` },
                                ].map((row, i) => (
                                    <div key={row.label} className={`flex justify-between items-center py-2.5 px-2 border-b border-[#1a3a1a]/30 ${i % 2 === 0 ? 'bg-[#0a0a0a]/50' : ''}`}>
                                        <span className="text-[#1a6b3a]">{row.label}</span>
                                        <span className="text-[#00ff88] font-bold truncate ml-4 text-right max-w-[55%]">{row.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* System status footer */}
                            <div className="mt-5 pt-4 border-t border-dashed border-[#1a3a1a]">
                                <div className="border border-[#1a3a1a] p-4 text-[10px] text-[#1a6b3a] font-mono leading-relaxed bg-[#020502]">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full inline-block animate-pulse" />
                                        <span className="text-[#00ff88] font-bold">SYSTEM ONLINE</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div>ENCRYPTION: AES_256 | SESSION: SECURE</div>
                                        <div className="text-[#00ff88]">{`> ANALYSIS_COMPLETE`}</div>
                                        <div className="text-[#1a6b3a] italic">{`// ${results.metadata.generated_at}`}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        )}

        <footer className="py-20 text-center text-text-muted text-[10px] font-mono uppercase tracking-[0.2em]">
            Evidence Protector &copy; 2026 // Cryptographic Integrity Verification
        </footer>
      </div>
    </main>
  );
}
