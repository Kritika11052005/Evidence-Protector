'use client'
import React, { useEffect, useState } from 'react'

const RadarScanner: React.FC = () => {
  const [blips, setBlips] = useState<Array<{ id: number; x: number; y: number; opacity: number; delay: number }>>([])
  const [statusText, setStatusText] = useState('SCANNING...')

  // Generate random blips
  useEffect(() => {
    const generateBlips = () => {
      const newBlips = Array.from({ length: 6 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2
        const radius = 20 + Math.random() * 70 // percentage from center
        return {
          id: i,
          x: 50 + Math.cos(angle) * (radius * 0.45),
          y: 50 + Math.sin(angle) * (radius * 0.45),
          opacity: 0.3 + Math.random() * 0.7,
          delay: Math.random() * 3,
        }
      })
      setBlips(newBlips)
    }
    generateBlips()
    const interval = setInterval(generateBlips, 6000)
    return () => clearInterval(interval)
  }, [])

  // Cycle status text
  useEffect(() => {
    const statuses = [
      'SCANNING_PERIMETER...',
      'ANOMALY_DETECTED',
      'LOG_INTEGRITY_CHECK',
      'DEEP_SCAN_ACTIVE',
      'PATTERN_MATCHING...',
      'THREAT_ASSESSMENT',
    ]
    let i = 0
    const timer = setInterval(() => {
      i = (i + 1) % statuses.length
      setStatusText(statuses[i])
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="radar-container">
      <div className="radar-wrapper">
        {/* Outer glow ring */}
        <div className="radar-outer-glow" />

        {/* Main radar circle */}
        <div className="radar-circle">
          {/* Grid lines - concentric rings */}
          <div className="radar-ring ring-1" />
          <div className="radar-ring ring-2" />
          <div className="radar-ring ring-3" />

          {/* Crosshair lines */}
          <div className="radar-crosshair-h" />
          <div className="radar-crosshair-v" />
          {/* Diagonal crosshairs */}
          <div className="radar-crosshair-d1" />
          <div className="radar-crosshair-d2" />

          {/* Sweep beam */}
          <div className="radar-sweep" />

          {/* Sweep trail / afterglow */}
          <div className="radar-sweep-trail" />

          {/* Center dot */}
          <div className="radar-center-dot" />
          <div className="radar-center-pulse" />

          {/* Blip dots */}
          {blips.map((blip) => (
            <div
              key={blip.id}
              className="radar-blip"
              style={{
                left: `${blip.x}%`,
                top: `${blip.y}%`,
                animationDelay: `${blip.delay}s`,
              }}
            />
          ))}

          {/* Cardinal direction labels */}
          <span className="radar-label radar-label-n">N</span>
          <span className="radar-label radar-label-s">S</span>
          <span className="radar-label radar-label-e">E</span>
          <span className="radar-label radar-label-w">W</span>
        </div>

        {/* HUD overlay text */}
        <div className="radar-hud">
          <div className="radar-hud-top">
            <span className="radar-hud-dot" />
            <span className="radar-hud-text">FORENSIC_RADAR // ACTIVE</span>
          </div>
          <div className="radar-hud-bottom">
            <span className="radar-hud-status">&gt; {statusText}</span>
            <span className="radar-hud-cursor" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .radar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 0 16px 0;
          user-select: none;
        }

        .radar-wrapper {
          position: relative;
          width: 220px;
          height: 220px;
        }

        @media (min-width: 640px) {
          .radar-wrapper {
            width: 260px;
            height: 260px;
          }
        }

        .radar-outer-glow {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 1px solid rgba(0, 255, 136, 0.15);
          box-shadow:
            0 0 30px rgba(0, 255, 136, 0.08),
            inset 0 0 30px rgba(0, 255, 136, 0.03);
          animation: outerPulse 4s ease-in-out infinite;
        }

        @keyframes outerPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        .radar-circle {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px solid rgba(0, 255, 136, 0.4);
          background: radial-gradient(
            circle at center,
            rgba(0, 255, 136, 0.03) 0%,
            rgba(0, 20, 10, 0.6) 50%,
            rgba(0, 0, 0, 0.9) 100%
          );
          overflow: hidden;
        }

        /* Concentric rings */
        .radar-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(0, 255, 136, 0.1);
        }

        .ring-1 {
          width: 75%;
          height: 75%;
          top: 12.5%;
          left: 12.5%;
        }

        .ring-2 {
          width: 50%;
          height: 50%;
          top: 25%;
          left: 25%;
        }

        .ring-3 {
          width: 25%;
          height: 25%;
          top: 37.5%;
          left: 37.5%;
        }

        /* Crosshairs */
        .radar-crosshair-h {
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 1px;
          background: rgba(0, 255, 136, 0.08);
        }

        .radar-crosshair-v {
          position: absolute;
          left: 50%;
          top: 0;
          width: 1px;
          height: 100%;
          background: rgba(0, 255, 136, 0.08);
        }

        .radar-crosshair-d1 {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 141.4%;
          height: 1px;
          background: rgba(0, 255, 136, 0.04);
          transform-origin: 0 0;
          transform: rotate(45deg) translateX(-50%);
        }

        .radar-crosshair-d2 {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 141.4%;
          height: 1px;
          background: rgba(0, 255, 136, 0.04);
          transform-origin: 0 0;
          transform: rotate(-45deg) translateX(-50%);
        }

        /* Rotating sweep beam */
        .radar-sweep {
          position: absolute;
          top: 0;
          left: 50%;
          width: 50%;
          height: 50%;
          transform-origin: bottom left;
          background: linear-gradient(
            to top,
            rgba(0, 255, 136, 0.35) 0%,
            rgba(0, 255, 136, 0) 100%
          );
          animation: sweep 3s linear infinite;
          clip-path: polygon(0% 100%, 100% 0%, 100% 100%);
        }

        /* Sweep afterglow trail */
        .radar-sweep-trail {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: conic-gradient(
            from 0deg at 50% 50%,
            transparent 0deg,
            rgba(0, 255, 136, 0.12) 0deg,
            transparent 60deg,
            transparent 360deg
          );
          animation: sweep 3s linear infinite;
          border-radius: 50%;
        }

        @keyframes sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Center dot */
        .radar-center-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 6px;
          height: 6px;
          background: #00ff88;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          box-shadow: 0 0 8px #00ff88, 0 0 16px rgba(0, 255, 136, 0.4);
        }

        .radar-center-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1px solid rgba(0, 255, 136, 0.3);
          transform: translate(-50%, -50%);
          animation: centerPulse 2s ease-out infinite;
        }

        @keyframes centerPulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }

        /* Blip dots */
        .radar-blip {
          position: absolute;
          width: 5px;
          height: 5px;
          background: #00ff88;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: blipPulse 2.5s ease-in-out infinite;
          box-shadow: 0 0 6px #00ff88, 0 0 12px rgba(0, 255, 136, 0.3);
          z-index: 4;
        }

        @keyframes blipPulse {
          0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          30% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          70% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
        }

        /* Cardinal labels */
        .radar-label {
          position: absolute;
          font-family: 'JetBrains Mono', monospace;
          font-size: 8px;
          color: rgba(0, 255, 136, 0.3);
          letter-spacing: 0.1em;
          z-index: 3;
        }

        .radar-label-n { top: 4px; left: 50%; transform: translateX(-50%); }
        .radar-label-s { bottom: 4px; left: 50%; transform: translateX(-50%); }
        .radar-label-e { right: 6px; top: 50%; transform: translateY(-50%); }
        .radar-label-w { left: 6px; top: 50%; transform: translateY(-50%); }

        /* HUD overlay */
        .radar-hud {
          position: absolute;
          bottom: -32px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: max-content;
        }

        .radar-hud-top {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .radar-hud-dot {
          width: 5px;
          height: 5px;
          background: #00ff88;
          border-radius: 50%;
          animation: blinkDot 1.5s step-end infinite;
        }

        @keyframes blinkDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .radar-hud-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: rgba(0, 255, 136, 0.5);
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .radar-hud-bottom {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .radar-hud-status {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #00ff88;
          letter-spacing: 0.1em;
        }

        .radar-hud-cursor {
          width: 6px;
          height: 12px;
          background: #00ff88;
          animation: blinkDot 0.8s step-end infinite;
        }
      `}</style>
    </div>
  )
}

export default RadarScanner
