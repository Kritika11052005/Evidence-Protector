'use client'
import React, { useRef } from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface HeatmapGridProps {
  data: Record<string, number>
}

const HeatmapGrid: React.FC<HeatmapGridProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Hourly data (00 - 23)
  const labels = Array.from({ length: 24 }).map((_, i) => `${i.toString().padStart(2, '0')}:00`)
  const hourlyCounts = Array.from({ length: 24 }).map((_, i) => data[i.toString()] || 0)
  
  const maxCount = Math.max(...hourlyCounts)
  const peakHourIndex = hourlyCounts.indexOf(maxCount)
  const isCriticalPeak = maxCount >= 3

  const chartData = {
    labels,
    datasets: [
      {
        label: 'GAPS_DETECTED',
        data: hourlyCounts,
        backgroundColor: (context: { raw: number }) => {
            const val = context.raw
            if (val >= 3) return 'rgba(255, 68, 68, 0.8)' // Critical
            if (val >= 2) return 'rgba(255, 136, 0, 0.8)' // Warning
            return 'rgba(0, 255, 136, 0.6)' // Normal
        },
        borderColor: (context: { raw: number }) => {
            const val = context.raw
            if (val >= 3) return '#ff4444'
            if (val >= 2) return '#ff8800'
            return '#00ff88'
        },
        borderWidth: 1,
        hoverBackgroundColor: '#00ff88',
        borderRadius: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#000',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 12 },
        borderColor: '#1a3a1a',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
            label: (context: { raw: number, label: string }) => ` ${context.raw} ANOMALIES AT ${context.label}`
        }
      },
    },
    scales: {
      x: {
        grid: {
          color: '#0a1a0a',
          display: true,
        },
        ticks: {
          color: '#1a6b3a',
          font: { family: 'JetBrains Mono', size: 9 },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#0a1a0a',
          display: true,
        },
        ticks: {
          color: '#1a6b3a',
          font: { family: 'JetBrains Mono', size: 9 },
          stepSize: 1,
        },
      },
    },
    animation: {
        duration: 2000,
        easing: 'easeOutQuart' as const
    }
  }

  return (
    <div ref={containerRef} className="relative z-10 px-0 max-w-6xl mx-auto font-mono">
      <div className="text-[#1a6b3a] text-[10px] mb-2 flex justify-between items-end">
        <span>┌ HOURLY_TAMPER_DISTRIBUTION ┐</span>
        <span className="opacity-40 italic">SCALE: LINEAR // UNIT: ANOMALIES</span>
      </div>
      
      <div className="h-64 bg-black border border-[#1a3a1a] p-6 relative overflow-hidden group">
        {/* Background Grid Decoration */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#00ff88 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <Bar data={chartData} options={options} />
      </div>

      <div className="flex justify-between items-center mt-4">
        <div className="text-[10px] text-[#1a6b3a] space-x-4">
            <span>[ LEGEND ]</span>
            <span className="text-[#00ff88]">■ LOW</span>
            <span className="text-[#ff8800]">■ MED</span>
            <span className="text-[#ff4444]">■ HIGH</span>
        </div>
        
        {maxCount > 0 && (
            <div className="text-[12px] tracking-tight uppercase">
                <span className="text-[#1a6b3a]">DETECTED PEAK: </span>
                <span className={isCriticalPeak ? "text-[#ff4444]" : "text-[#ff8800]"}>
                    {peakHourIndex.toString().padStart(2, '0')}:00h (N={maxCount})
                </span>
            </div>
        )}
      </div>
    </div>
  )
}

export default HeatmapGrid


