import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { spinAPI } from '../api';
import { Gift, Clock, Zap, Star, RotateCcw } from 'lucide-react';

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
  spin_history: any[];
}

interface Props {
  onBonusAwarded?: (newBalance: number) => void;
}

const WHEEL_SIZE = 300;
const CENTER = WHEEL_SIZE / 2;

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

export const SpinWheel: React.FC<Props> = ({ onBonusAwarded }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [segments, setSegments] = useState<SpinSegment[]>([]);
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

      gain.gain.setValueAtTime(0.1, ctx.currentTime); // very soft
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Ignore audio errors (e.g., policy blocks)
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

  // Draw Wheel on Canvas
  const drawWheel = useCallback((segs: SpinSegment[], currentRotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas || segs.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WHEEL_SIZE * dpr;
    canvas.height = WHEEL_SIZE * dpr;
    ctx.scale(dpr, dpr);

    const total = segs.reduce((s, seg) => s + seg.probability, 0);
    let startAngle = currentRotation - Math.PI / 2;

    ctx.clearRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);

    // Shadow/glow ring
    ctx.save();
    ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, CENTER - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    segs.forEach((seg) => {
      const sliceAngle = (seg.probability / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;
      const midAngle = startAngle + sliceAngle / 2;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.arc(CENTER, CENTER, CENTER - 6, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.bg_color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label text
      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';

      // Emoji
      ctx.font = `${WHEEL_SIZE > 260 ? 16 : 13}px serif`;
      ctx.fillText(seg.emoji, CENTER - 12, 5);

      // Prize text
      ctx.font = `bold ${WHEEL_SIZE > 260 ? 11 : 9}px Inter, sans-serif`;
      ctx.fillStyle = seg.text_color || '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      const shortLabel = seg.prize_type === 'try_again' ? 'Try Again' : `₹${seg.prize_amount}`;
      ctx.fillText(shortLabel, CENTER - 32, 5);

      ctx.restore();
      startAngle = endAngle;
    });

    // Center cap
    const grad = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, 26);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#312e81');
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 26, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center icon
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎡', CENTER, CENTER + 6);
  }, []);

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
      const total = segments.reduce((s, seg) => s + seg.probability, 0);

      // Calculate the exact stop angle for the winning segment
      let cumulative = 0;
      for (let i = 0; i < winSegIndex; i++) {
        cumulative += segments[i].probability;
      }
      const winStart = (cumulative / total) * Math.PI * 2;
      const winMid = winStart + (segments[winSegIndex].probability / total) * Math.PI * 2 / 2;

      // The pointer is at top (−π/2). We need winMid to land at top.
      // Target rotation = 4 full spins + offset so winMid hits −π/2 (top)
      const extraSpins = Math.PI * 2 * (4 + Math.floor(Math.random() * 3));
      const targetRotation = extraSpins + (Math.PI * 2 - winMid) - Math.PI / 2;

      // Animate
      const startRotation = rotationRef.current;
      const startTime = performance.now();
      const duration = 3500;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startRotation + (targetRotation - startRotation) * eased;
        rotationRef.current = current;
        setRotation(current);
        drawWheel(segments, current);

        // Play tick sound every ~0.4 radians (adjustable)
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
          fetchData(); // Refresh status
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
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading spin wheel...
      </div>
    );
  }

  const streakDay = status?.current_streak || 0;
  const nextStreakBonus = streakDay > 0 ? 7 - (streakDay % 7) : 7;

  return (
    <>
      {/* Styles for shiny effects */}
      <style>{`
        @keyframes rotate-rays {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 15px rgba(245,158,11,0.4)) drop-shadow(0 0 30px rgba(59,130,246,0.3)); }
          50% { filter: drop-shadow(0 0 25px rgba(245,158,11,0.6)) drop-shadow(0 0 50px rgba(59,130,246,0.5)); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        <Gift size={28} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }} />
        <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#f59e0b', textShadow: '0 2px 10px rgba(245,158,11,0.2)' }}>
          Daily Spin Wheel
        </h3>
        {status?.can_spin && (
          <span style={{
            background: '#10b981', color: '#fff',
            border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px',
            padding: '4px 12px', fontSize: '0.85rem', fontWeight: 700, animation: 'pulse 2s infinite',
            boxShadow: '0 0 10px rgba(16,185,129,0.4)'
          }}>READY!</span>
        )}
      </div>

      <div className="glass-card" style={{
        padding: '32px 24px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px'
      }}>
        {/* Decorative background sparkles */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: '4px', height: '4px', background: '#fff', borderRadius: '50%', animation: 'sparkle 3s infinite', boxShadow: '0 0 8px #fff' }} />
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: '6px', height: '6px', background: '#f59e0b', borderRadius: '50%', animation: 'sparkle 4s infinite 1s', boxShadow: '0 0 8px #f59e0b' }} />
        <div style={{ position: 'absolute', bottom: '15%', left: '20%', width: '5px', height: '5px', background: '#3b82f6', borderRadius: '50%', animation: 'sparkle 2.5s infinite 0.5s', boxShadow: '0 0 8px #3b82f6' }} />

        {/* Streak bar */}
        {streakDay > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center', background: 'rgba(245, 158, 11, 0.1)', padding: '12px 20px', borderRadius: '50px', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Zap size={20} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.8))' }} />
            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.4)' }}>{streakDay}-Day Streak</strong>
              {nextStreakBonus <= 3 && (
                <span style={{ color: '#3b82f6', fontWeight: 700 }}> — 🔥 {nextStreakBonus} more for 2x Bonus!</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
              {Array.from({ length: 7 }, (_, i) => {
                const isEarned = i < (streakDay % 7 || (streakDay > 0 && streakDay % 7 === 0 ? 7 : 0));
                return (
                  <div key={i} style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: isEarned ? '#f59e0b' : 'rgba(245, 158, 11, 0.05)',
                    border: isEarned ? 'none' : '1px solid rgba(245,158,11,0.4)',
                    boxShadow: isEarned ? '0 0 10px rgba(245,158,11,0.8), inset 0 2px 4px rgba(255,255,255,0.4)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px'
                  }}>
                    {i === 6 ? '⭐' : (isEarned ? '✓' : '')}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Wheel + Pointer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', position: 'relative', zIndex: 5, width: '100%' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: `${WHEEL_SIZE}px`, aspectRatio: '1 / 1' }}>

            {/* Glowing Border Frame */}
            <div style={{
              position: 'absolute', inset: '-8px', borderRadius: '50%',
              background: '#f59e0b',
              zIndex: 0, boxShadow: '0 0 20px rgba(245,158,11,0.3)'
            }} />
            <div style={{
              position: 'absolute', inset: '-4px', borderRadius: '50%',
              background: 'var(--bg-secondary)', zIndex: 1
            }} />

            {/* Pointer */}
            <div style={{
              position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '14px solid transparent',
              borderRight: '14px solid transparent',
              borderTop: '30px solid #f59e0b',
              filter: 'drop-shadow(0 4px 8px rgba(245,158,11,0.8))',
              zIndex: 10
            }}>
              {/* Inner pointer detail */}
              <div style={{
                position: 'absolute', top: '-34px', left: '-8px',
                width: 0, height: 0, borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent', borderTop: '16px solid #fff'
              }} />
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={WHEEL_SIZE}
              height={WHEEL_SIZE}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                position: 'relative',
                zIndex: 5,
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
              }}
            />
          </div>

          {/* Gaming Bonus Balance */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '12px', padding: '8px 16px'
          }}>
            <Star size={16} color="#f59e0b" />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Gaming Bonus Balance:</span>
            <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: '1rem' }}>
              ₹{parseFloat(String(status?.gaming_bonus_balance || 0)).toFixed(2)}
            </span>
          </div>

          {/* Spin Button or Countdown */}
          {status?.can_spin ? (
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              style={{
                background: isSpinning
                  ? 'var(--bg-tertiary)'
                  : '#10b981',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50px',
                padding: '14px 40px',
                fontSize: '1.2rem',
                fontWeight: 700,
                cursor: isSpinning ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                boxShadow: isSpinning ? 'none' : '0 6px 20px rgba(16,185,129,0.4)',
                transition: 'all 0.3s',
                display: 'flex', alignItems: 'center', gap: '10px',
                transform: isSpinning ? 'scale(0.98)' : 'scale(1)',
                marginTop: '10px'
              }}
              onMouseEnter={e => { if (!isSpinning) e.currentTarget.style.transform = 'scale(1.03)' }}
              onMouseLeave={e => { if (!isSpinning) e.currentTarget.style.transform = 'scale(1)' }}
            >
              {isSpinning ? (
                <><RotateCcw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Spinning...</>
              ) : (
                <>🎡 SPIN NOW!</>
              )}
            </button>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              background: 'rgba(107,114,128,0.15)', border: '1px solid rgba(107,114,128,0.3)',
              borderRadius: '16px', padding: '14px 28px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Clock size={14} /> Next Spin Available In:
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', fontFamily: 'monospace', color: '#f59e0b' }}>
                {countdown.display}
              </div>
            </div>
          )}

          {/* Recent history pills */}
          {status?.spin_history && status.spin_history.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recent:</span>
              {status.spin_history.slice(0, 4).map((h: any, i: number) => (
                <span key={i} style={{
                  background: h.prize_type === 'try_again' ? 'rgba(107,114,128,0.2)' : 'rgba(34,197,94,0.15)',
                  color: h.prize_type === 'try_again' ? 'var(--text-muted)' : 'var(--accent-secondary)',
                  border: `1px solid ${h.prize_type === 'try_again' ? 'rgba(107,114,128,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600
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
