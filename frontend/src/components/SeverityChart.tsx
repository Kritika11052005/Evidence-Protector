'use client'
import React from "react"
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  TooltipItem
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

interface SeverityChartProps {
  critical: number
  medium: number
  low: number
  avgTamperScore: number
}

const SeverityChart: React.FC<SeverityChartProps> = ({ critical, medium, low, avgTamperScore }) => {
  const total = critical + medium + low

  const chartData = {
    labels: ['CRITICAL', 'MEDIUM', 'LOW'],
    datasets: [
      {
        data: [critical, medium, low],
        backgroundColor: [
          'rgba(255, 68, 68, 0.85)',
          'rgba(255, 136, 0, 0.85)',
          'rgba(255, 204, 0, 0.85)',
        ],
        borderColor: [
          '#ff4444',
          '#ff8800',
          '#ffcc00',
        ],
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 8,
        spacing: 3,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          color: '#1a6b3a',
          font: { family: 'JetBrains Mono', size: 10 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#000',
        titleFont: { family: 'JetBrains Mono', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 12 },
        borderColor: '#1a3a1a',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context: TooltipItem<"doughnut">) => {
            const rawVal = context.raw as number
            const pct = total > 0 ? Math.round((rawVal / total) * 100) : 0
            return ` ${context.label}: ${rawVal} (${pct}%)`
          }
        }
      },
    },
    animation: {
      animateRotate: true,
      duration: 1500,
      easing: 'easeOutQuart' as const,
    },
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chart */}
      <div className="flex-1 flex items-center justify-center min-h-[200px] relative">
        <Doughnut data={chartData} options={options} />
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: '36px' }}>
          <span className="text-2xl font-black text-[#00ff88]">{total}</span>
          <span className="text-[9px] text-[#1a6b3a] uppercase tracking-widest">TOTAL</span>
        </div>
      </div>

      {/* Avg Tamper Score */}
      <div className="mt-4 pt-4 border-t border-dashed border-[#1a3a1a]">
        <div className="flex justify-between text-[11px] mb-2">
          <span className="text-[#1a6b3a] font-bold">AVG_TAMPER_SCORE</span>
          <span className={`font-bold ${avgTamperScore > 70 ? 'text-[#ff4444]' : avgTamperScore > 40 ? 'text-[#ff8800]' : 'text-[#00ff88]'}`}>
            {avgTamperScore}/100
          </span>
        </div>
        <div className="w-full h-3 bg-[#0a0a0a] border border-[#1a3a1a] overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-out"
            style={{
              width: `${avgTamperScore}%`,
              background: avgTamperScore > 70 ? '#ff4444' : avgTamperScore > 40 ? '#ff8800' : '#00ff88'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default SeverityChart
