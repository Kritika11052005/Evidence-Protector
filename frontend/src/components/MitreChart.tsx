'use client'
import React from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  TooltipItem,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { Gap } from "@/types"

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

interface MitreChartProps {
  gaps: Gap[]
}

const MitreChart: React.FC<MitreChartProps> = ({ gaps }) => {
  // Group gaps by mitre_id and count occurrences
  const techniqueMap = new Map<string, { count: number; pattern: string }>()
  gaps.forEach(g => {
    const existing = techniqueMap.get(g.mitre_id)
    if (existing) {
      existing.count++
    } else {
      techniqueMap.set(g.mitre_id, { count: 1, pattern: g.pattern })
    }
  })

  const entries = Array.from(techniqueMap.entries()).slice(0, 8)
  const labels = entries.map(([id]) => id)
  const counts = entries.map(([, info]) => info.count)
  const patterns = entries.map(([, info]) => info.pattern)
  const maxCount = Math.max(...counts, 1)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'HITS',
        data: counts,
        backgroundColor: counts.map(c => {
          const ratio = c / maxCount
          if (ratio >= 0.8) return 'rgba(255, 68, 68, 0.8)'
          if (ratio >= 0.5) return 'rgba(255, 136, 0, 0.8)'
          return 'rgba(0, 255, 204, 0.7)'
        }),
        borderColor: counts.map(c => {
          const ratio = c / maxCount
          if (ratio >= 0.8) return '#ff4444'
          if (ratio >= 0.5) return '#ff8800'
          return '#00ffcc'
        }),
        borderWidth: 1,
        borderRadius: 3,
        hoverBackgroundColor: '#00ff88',
        barThickness: 18,
      },
    ],
  }

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#000',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        borderColor: '#1a3a1a',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (items: TooltipItem<"bar">[]) => {
            const idx = items[0].dataIndex
            return labels[idx]
          },
          label: (context: TooltipItem<"bar">) => {
            const pattern = patterns[context.dataIndex]
            const rawValue = context.raw as number
            return [
              ` ${rawValue} hit${rawValue > 1 ? 's' : ''}`,
              ` ${pattern}`
            ]
          }
        }
      },
    },
    scales: {
      x: {
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
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#00ffcc',
          font: { family: 'JetBrains Mono', size: 10, weight: 'bold' as const },
        },
      },
    },
    animation: {
      duration: 1500,
      easing: 'easeOutQuart' as const,
    },
  }

  const uniqueTechniques = new Set(gaps.map(g => g.mitre_id)).size

  return (
    <div className="flex flex-col h-full">
      {/* Chart */}
      <div className="flex-1 min-h-[200px]">
        <Bar data={chartData} options={options} />
      </div>

      {/* Tactic Summary */}
      <div className="mt-4 pt-4 border-t border-dashed border-[#1a3a1a] text-[11px]">
        <div className="flex justify-between text-[#1a6b3a] mb-2">
          <span>TACTIC</span>
          <span className="text-[#ff8800] font-bold">Defense Evasion</span>
        </div>
        <div className="flex justify-between text-[#1a6b3a]">
          <span>UNIQUE_TECHNIQUES</span>
          <span className="text-[#00ff88] font-bold">{uniqueTechniques}</span>
        </div>
      </div>
    </div>
  )
}

export default MitreChart
