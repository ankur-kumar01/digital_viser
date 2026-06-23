import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { spinAPI } from '../api';
import { Gift, Clock, Zap, Star, RotateCcw } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface SpinSegment {
  id: number;
  label: string;
  prize_type: string;
  prize_amount: number;
  probability: number;
  bg_color: string;
  text_color: string;
  emoji: string;
}

interface SpinStatus {
  can_spin: boolean;
  next_spin_at: string | null;
  seconds_remaining: number;
  current_streak: number;
  total_spins: number;
  gaming_bonus_balance: number;
  total_deposits: number;
  spin_history: any[];
}

interface Props {
  onBonusAwarded?: (newBalance: number) => void;
  isFullPage?: boolean;
}

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    if (seconds <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  return {
    remaining,
    display: `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  };
}

// Premium color palette for equal segments
const SEGMENT_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#2980b9',
  '#27ae60', '#c0392b', '#8e44ad', '#16a085',
];

export const SpinWheel: React.FC<Props> = ({ onBonusAwarded, isFullPage = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [segments, setSegments] = useState<SpinSegment[]>([]);
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wheelSize, setWheelSize] = useState(320);
  const animFrameRef = useRef<number>();
  const rotationRef = useRef(0);
  const lastTickAngleRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTickSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  const countdown = useCountdown(status?.seconds_remaining || 0);

  const fetchData = useCallback(async () => {
    try {
      const [segs, stat] = await Promise.all([
        spinAPI.getSegments(),
        spinAPI.getStatus()
      ]);
      setSegments(segs);
      setStatus(stat);
    } catch (err) {
      console.error('Failed to fetch spin data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Responsive wheel sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const maxSize = isFullPage ? 400 : 340;
        const newSize = Math.min(maxSize, containerWidth - 40);
        setWheelSize(Math.max(220, newSize));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isFullPage]);

  // Draw Wheel on Canvas — EQUAL sector sizes
  const drawWheel = useCallback((segs: SpinSegment[], currentRotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas || segs.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = wheelSize;
    const center = SIZE / 2;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Equal angle for each segment
    const sliceAngle = (Math.PI * 2) / segs.length;
    let startAngle = currentRotation - Math.PI / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Outer glow ring
    ctx.save();
    ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(center, center, center - 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    // Draw segments
    segs.forEach((seg, i) => {
      const endAngle = startAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;
      const segColor = SEGMENT_COLORS[i % SEGMENT_COLORS.length];

      // Segment fill with gradient
      const grd = ctx.createLinearGradient(
        center + Math.cos(midAngle) * center * 0.3,
        center + Math.sin(midAngle) * center * 0.3,
        center + Math.cos(midAngle) * center,
        center + Math.sin(midAngle) * center
      );
      grd.addColorStop(0, segColor);
      grd.addColorStop(1, adjustColor(segColor, -25));

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, center - 8, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = grd;
      ctx.fill();

      // Segment border
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Notch dots on outer edge
      const notchAngle = startAngle;
      const notchR = center - 14;
      ctx.beginPath();
      ctx.arc(
        center + Math.cos(notchAngle) * notchR,
        center + Math.sin(notchAngle) * notchR,
        3, 0, Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();

      // Label text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(midAngle);
      ctx.textAlign = 'center';

      // Emoji
      const emojiSize = Math.max(14, Math.min(20, SIZE / 18));
      ctx.font = `${emojiSize}px serif`;
      ctx.fillText(seg.emoji, center * 0.62, -4);

      // Prize text
      const textSize = Math.max(9, Math.min(13, SIZE / 28));
      ctx.font = `bold ${textSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      const shortLabel = seg.prize_type === 'try_again' ? 'Try Again' : `₹${seg.prize_amount}`;
      ctx.fillText(shortLabel, center * 0.62, textSize + 2);

      ctx.restore();
      startAngle = endAngle;
    });

    // Inner ring
    ctx.beginPath();
    ctx.arc(center, center, center - 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center cap - gradient
    const capR = Math.max(22, SIZE / 10);
    const capGrad = ctx.createRadialGradient(center, center, 0, center, center, capR);
    capGrad.addColorStop(0, '#fbbf24');
    capGrad.addColorStop(0.6, '#f59e0b');
    capGrad.addColorStop(1, '#d97706');
    ctx.beginPath();
    ctx.arc(center, center, capR, 0, Math.PI * 2);
    ctx.fillStyle = capGrad;
    ctx.shadowColor = 'rgba(245,158,11,0.5)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center icon
    const iconSize = Math.max(16, capR * 0.8);
    ctx.font = `${iconSize}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🎡', center, center + iconSize * 0.3);
  }, [wheelSize]);

  useEffect(() => {
    drawWheel(segments, rotation);
  }, [segments, rotation, drawWheel]);

  const handleSpin = async () => {
    if (isSpinning || !status?.can_spin) return;

    setIsSpinning(true);
    setShowResult(false);
    setResult(null);

    try {
      const res = await spinAPI.claim();

      // Find the winning segment index
      const winSegIndex = segments.findIndex(s => s.id === res.segment.id);

      // EQUAL sector sizes
      const sliceAngle = (Math.PI * 2) / segments.length;
      const winStart = winSegIndex * sliceAngle;
      const winMid = winStart + sliceAngle / 2;

      // The pointer is at top (−π/2). Target rotation so winMid lands at top.
      const extraSpins = Math.PI * 2 * (4 + Math.floor(Math.random() * 3));
      const targetRotation = extraSpins + (Math.PI * 2 - winMid) - Math.PI / 2;

      // Animate
      const startRotation = rotationRef.current;
      const startTime = performance.now();
      const duration = 4500;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out quartic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = startRotation + (targetRotation - startRotation) * eased;
        rotationRef.current = current;
        setRotation(current);
        drawWheel(segments, current);

        // Play tick sound every ~0.4 radians
        if (current - lastTickAngleRef.current > 0.4) {
          playTickSound();
          lastTickAngleRef.current = current;
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          setIsSpinning(false);
          setResult(res);
          setShowResult(true);
          if (onBonusAwarded && res.new_gaming_bonus_balance !== undefined) {
            onBonusAwarded(res.new_gaming_bonus_balance);
          }
          fetchData();
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    } catch (err: any) {
      setIsSpinning(false);
      alert(err.message || 'Failed to spin. Please try again.');
    }
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <LoadingSpinner message="Loading fortune wheel options..." />
    );
  }

  const streakDay = status?.current_streak || 0;
  const nextStreakBonus = streakDay > 0 ? 7 - (streakDay % 7) : 7;

  return (
    <>
      <style>{`
        @keyframes sw-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes sw-pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(245,158,11,0); }
        }
        @keyframes sw-sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes sw-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .sw-page-card {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          border-radius: 24px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          box-shadow: 0 8px 40px rgba(0,0,0,0.08);
          overflow: hidden;
          position: relative;
        }

        .sw-page-card-header {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%);
          padding: 28px 24px 20px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .sw-page-card-header::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 30% 50%, rgba(245,158,11,0.12) 0%, transparent 60%),
                      radial-gradient(circle at 70% 40%, rgba(59,130,246,0.10) 0%, transparent 50%);
          pointer-events: none;
        }

        .sw-page-card-header h3 {
          margin: 0 0 4px;
          font-size: 1.6rem;
          font-weight: 800;
          color: #fff;
          text-shadow: 0 2px 12px rgba(245,158,11,0.3);
          position: relative;
          z-index: 1;
        }
        .sw-page-card-header p {
          margin: 0;
          font-size: 0.85rem;
          color: rgba(255,255,255,0.6);
          position: relative;
          z-index: 1;
        }

        .sw-page-card-body {
          padding: 28px 24px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        /* Streak Bar */
        .sw-streak-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
          background: rgba(245, 158, 11, 0.06);
          padding: 10px 20px;
          border-radius: 50px;
          border: 1px solid rgba(245,158,11,0.18);
          flex-wrap: wrap;
          width: 100%;
        }
        .sw-streak-info {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .sw-streak-dots {
          display: flex;
          gap: 5px;
        }
        .sw-streak-dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.2s;
        }

        /* Wheel Wrapper */
        .sw-wheel-area {
          position: relative;
          display: flex;
          justify-content: center;
          width: 100%;
        }
        .sw-wheel-wrapper {
          position: relative;
          width: fit-content;
        }
        .sw-canvas-el {
          display: block;
          border-radius: 50%;
          position: relative;
          z-index: 5;
        }

        /* Outer ring frame */
        .sw-outer-ring {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #f59e0b 100%);
          z-index: 0;
          box-shadow: 0 0 30px rgba(245,158,11,0.3), inset 0 0 10px rgba(0,0,0,0.2);
        }
        .sw-outer-ring-inner {
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          background: var(--bg-secondary);
          z-index: 1;
        }

        /* Pointer */
        .sw-pointer {
          position: absolute;
          top: -22px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          animation: sw-float 2s ease-in-out infinite;
        }
        .sw-pointer-triangle {
          width: 0;
          height: 0;
          border-left: 16px solid transparent;
          border-right: 16px solid transparent;
          border-top: 34px solid #f59e0b;
          filter: drop-shadow(0 4px 10px rgba(245,158,11,0.7));
        }
        .sw-pointer-inner {
          position: absolute;
          top: -38px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 9px solid transparent;
          border-right: 9px solid transparent;
          border-top: 18px solid #fff;
        }

        /* Bonus Balance */
        .sw-bonus-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.03) 100%);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 50px;
          padding: 8px 20px;
        }

        /* Spin button */
        .sw-spin-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          color: #fff !important;
          border: none !important;
          border-radius: 50px !important;
          padding: 14px 48px !important;
          font-size: 1.15rem !important;
          font-weight: 800 !important;
          cursor: pointer;
          letter-spacing: 0.03em;
          box-shadow: 0 6px 24px rgba(16,185,129,0.35);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          max-width: 300px;
          justify-content: center;
        }
        .sw-spin-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(16,185,129,0.5);
        }
        .sw-spin-btn:active:not(:disabled) {
          transform: translateY(1px) scale(0.98);
          box-shadow: 0 3px 12px rgba(16, 185, 129, 0.4);
        }
        .sw-spin-btn:disabled {
          background: var(--bg-tertiary) !important;
          color: var(--text-muted) !important;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Countdown Box */
        .sw-countdown-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          background: rgba(107,114,128,0.08);
          border: 1px solid var(--border-card);
          border-radius: 16px;
          padding: 14px 28px;
          width: 100%;
          max-width: 300px;
        }

        /* History pills */
        .sw-history-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }

        /* Mobile Responsive */
        @media (max-width: 576px) {
          .sw-page-card {
            border-radius: 18px;
          }
          .sw-page-card-header {
            padding: 22px 16px 16px;
          }
          .sw-page-card-header h3 {
            font-size: 1.3rem;
          }
          .sw-page-card-header p {
            font-size: 0.78rem;
          }
          .sw-page-card-body {
            padding: 20px 16px 28px;
            gap: 18px;
          }
          .sw-streak-bar {
            flex-direction: column;
            border-radius: 16px;
            padding: 10px;
            gap: 8px;
          }
          .sw-streak-info {
            font-size: 0.82rem;
            text-align: center;
          }
          .sw-streak-dots {
            gap: 3px;
            justify-content: center;
          }
          .sw-streak-dot {
            width: 22px;
            height: 22px;
            font-size: 9px;
          }
          .sw-bonus-pill {
            padding: 6px 14px;
            width: 100%;
            justify-content: center;
          }
          .sw-bonus-pill span {
            font-size: 0.82rem !important;
          }
          .sw-spin-btn {
            padding: 12px 32px !important;
            font-size: 1rem !important;
            max-width: 100%;
          }
          .sw-countdown-box {
            padding: 10px 16px;
            max-width: 100%;
          }
        }
      `}</style>

      <div ref={containerRef} className="sw-page-card">
        {/* Card Header */}
        <div className="sw-page-card-header">
          {/* Sparkles */}
          <div style={{ position: 'absolute', top: '15%', left: '12%', width: '4px', height: '4px', background: '#fbbf24', borderRadius: '50%', animation: 'sw-sparkle 3s infinite', boxShadow: '0 0 8px #fbbf24' }} />
          <div style={{ position: 'absolute', top: '25%', right: '14%', width: '5px', height: '5px', background: '#3b82f6', borderRadius: '50%', animation: 'sw-sparkle 4s infinite 1s', boxShadow: '0 0 8px #3b82f6' }} />
          <div style={{ position: 'absolute', bottom: '20%', left: '22%', width: '3px', height: '3px', background: '#fff', borderRadius: '50%', animation: 'sw-sparkle 2.5s infinite 0.5s' }} />

          <h3>🎡 Fortune Wheel</h3>
          <p>Spin once daily to win free gaming bonuses!</p>
        </div>

        {/* Card Body */}
        <div className="sw-page-card-body">

          {/* Streak bar */}
          {streakDay > 0 && (
            <div className="sw-streak-bar">
              <Zap size={18} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.8))' }} />
              <span className="sw-streak-info">
                <strong style={{ color: '#f59e0b' }}>{streakDay}-Day Streak</strong>
                {nextStreakBonus <= 3 && (
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}> — 🔥 {nextStreakBonus} more for 2x!</span>
                )}
              </span>
              <div className="sw-streak-dots">
                {Array.from({ length: 7 }, (_, i) => {
                  const isEarned = i < (streakDay % 7 || (streakDay > 0 && streakDay % 7 === 0 ? 7 : 0));
                  return (
                    <div key={i} className="sw-streak-dot" style={{
                      background: isEarned ? '#f59e0b' : 'rgba(245, 158, 11, 0.05)',
                      border: isEarned ? 'none' : '1px solid rgba(245,158,11,0.35)',
                      boxShadow: isEarned ? '0 0 10px rgba(245,158,11,0.8), inset 0 2px 4px rgba(255,255,255,0.4)' : 'none',
                    }}>
                      {i === 6 ? '⭐' : (isEarned ? '✓' : '')}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wheel */}
          <div className="sw-wheel-area">
            <div className="sw-wheel-wrapper" style={{ width: wheelSize, height: wheelSize }}>

              {/* Outer ring */}
              <div className="sw-outer-ring" />
              <div className="sw-outer-ring-inner" />

              {/* Pointer */}
              <div className="sw-pointer">
                <div className="sw-pointer-triangle" />
                <div className="sw-pointer-inner" />
              </div>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                width={wheelSize}
                height={wheelSize}
                className="sw-canvas-el"
                style={{ width: wheelSize, height: wheelSize }}
              />
            </div>
          </div>

          {/* Gaming Bonus Balance */}
          <div className="sw-bonus-pill">
            <Star size={16} color="#f59e0b" />
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Gaming Bonus:</span>
            <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '1.05rem' }}>
              ₹{parseFloat(String(status?.gaming_bonus_balance || 0)).toFixed(2)}
            </span>
          </div>

          {/* Spin Button / Deposit Lock / Countdown */}
          {status && status.total_deposits < 100 ? (
            <div style={{
              width: '100%', padding: '16px 20px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
              border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem' }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ef4444' }}>
                Deposit ₹100 or more to spin
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Your deposits: ₹{parseFloat(String(status.total_deposits)).toFixed(2)}
              </div>
            </div>
          ) : status?.can_spin ? (
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className="sw-spin-btn"
            >
              {isSpinning ? (
                <><RotateCcw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Spinning...</>
              ) : (
                <>🎡 SPIN NOW!</>
              )}
            </button>
          ) : (
            <div className="sw-countdown-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Clock size={14} /> Next Spin Available In:
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', fontFamily: 'monospace', color: '#f59e0b' }}>
                {countdown.display}
              </div>
            </div>
          )}

          {/* Recent history pills */}
          {status?.spin_history && status.spin_history.length > 0 && (
            <div className="sw-history-row">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '22px' }}>Recent:</span>
              {status.spin_history.slice(0, 4).map((h: any, i: number) => (
                <span key={i} style={{
                  background: h.prize_type === 'try_again' ? 'rgba(107,114,128,0.15)' : 'rgba(34,197,94,0.12)',
                  color: h.prize_type === 'try_again' ? 'var(--text-muted)' : 'var(--accent-secondary)',
                  border: `1px solid ${h.prize_type === 'try_again' ? 'rgba(107,114,128,0.25)' : 'rgba(34,197,94,0.25)'}`,
                  borderRadius: '20px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600
                }}>
                  {h.emoji} {h.prize_type === 'try_again' ? 'Try Again' : `₹${h.prize_amount}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Result Modal using React Portal */}
      {showResult && result && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%', maxWidth: '400px', padding: '40px 32px',
            textAlign: 'center',
            background: result.segment.prize_type === 'try_again'
              ? 'var(--bg-secondary)'
              : 'var(--bg-primary)',
            border: result.segment.prize_type === 'try_again'
              ? '1px solid var(--border-glass)'
              : '1px solid rgba(59,130,246,0.4)',
            boxShadow: result.segment.prize_type === 'try_again'
              ? '0 8px 32px rgba(0,0,0,0.3)'
              : '0 8px 32px rgba(59,130,246,0.3)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px', lineHeight: 1 }}>
              {result.segment.emoji}
            </div>

            {result.segment.prize_type === 'try_again' ? (
              <>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Better Luck Tomorrow!
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  You landed on <strong>Try Again</strong>. Come back tomorrow for another spin!
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px', color: '#ef4444' }}>
                  {result.is_streak_bonus ? '🔥 STREAK BONUS! 🔥' : '🎉 You Won!'}
                </h2>
                <div style={{
                  fontSize: '3rem', fontWeight: 900, color: '#ef4444',
                  textShadow: '0 0 20px rgba(239,68,68,0.8)', marginBottom: '8px'
                }}>
                  +₹{parseFloat(result.segment.prize_amount).toFixed(2)}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>
                  Added to your <strong>Gaming Bonus Wallet</strong>
                </p>
                {result.is_streak_bonus && (
                  <p style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    ✨ 7-Day Streak = 2× Bonus Applied!
                  </p>
                )}
                <p style={{ color: 'rgba(245,158,11,0.7)', fontSize: '0.8rem', marginBottom: '24px' }}>
                  Day {result.streak_day} streak 🔥
                </p>
              </>
            )}

            <button
              onClick={() => setShowResult(false)}
              style={{
                background: result.segment.prize_type === 'try_again' ? 'var(--bg-tertiary)' : '#3b82f6',
                color: result.segment.prize_type === 'try_again' ? 'var(--text-primary)' : '#fff',
                border: result.segment.prize_type === 'try_again' ? '1px solid var(--border-glass)' : 'none',
                borderRadius: '50px',
                padding: '12px 32px', fontSize: '1rem', fontWeight: 600,
                cursor: 'pointer', width: '100%'
              }}
            >
              {result.segment.prize_type === 'try_again' ? 'OK, See You Tomorrow!' : 'Play Now! 🎮'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

// Helper: darken/lighten a hex color
function adjustColor(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
