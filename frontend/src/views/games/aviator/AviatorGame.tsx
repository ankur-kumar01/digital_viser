import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { gamesAPI } from '../../../api';
import './AviatorGame.css';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [50, 100, 200, 500, 1000];
const CONFETTI_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const AviatorGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBetLoading, setIsBetLoading] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [crashHistory, setCrashHistory] = useState<number[]>([2.14, 1.31, 4.72, 1.08, 2.56, 1.95, 8.33, 1.44, 3.01, 1.67]);

  const multiplierRef = useRef(1.0);
  const animationRef = useRef<number>();
  const isPlayingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(0);

  useEffect(() => {
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, []);

  // Resize canvas to match display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  const drawFlightPath = useCallback((elapsed: number, mult: number, didCrash: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);
    const w = W / dpr;
    const h = H / dpr;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, h * i / 6); ctx.lineTo(w, h * i / 6); ctx.stroke();
    }
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(w * i / 10, 0); ctx.lineTo(w * i / 10, h); ctx.stroke();
    }

    const pad = 30;
    if (elapsed <= 0 && !didCrash) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }

    const maxTime = Math.max(elapsed, 3);
    const maxMult = Math.max(mult * 1.2, 2.5);

    // Curve path
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    const steps = 150;
    let tipX = pad, tipY = h - pad;
    for (let i = 1; i <= steps; i++) {
      const t = (elapsed * i) / steps;
      const m = Math.exp(0.2 * t);
      const x = pad + ((w - pad * 2) * (t / maxTime));
      const y = h - pad - ((h - pad * 2) * ((m - 1) / (maxMult - 1)));
      const clampedY = Math.max(8, Math.min(h - pad, y));
      ctx.lineTo(x, clampedY);
      tipX = x; tipY = clampedY;
    }

    // Stroke with glow
    const lineColor = didCrash ? '#ef4444' : '#22c55e';
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Gradient fill under curve
    ctx.lineTo(tipX, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, didCrash ? 'rgba(239,68,68,0.20)' : 'rgba(34,197,94,0.20)');
    fillGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Plane or explosion at tip
    ctx.font = `${didCrash ? 28 : 24}px serif`;
    if (didCrash) {
      ctx.fillText('💥', tipX - 14, tipY - 6);
    } else {
      // Glow dot at tip
      const dotGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 14);
      dotGrad.addColorStop(0, 'rgba(34,197,94,0.8)');
      dotGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = dotGrad;
      ctx.fillRect(tipX - 14, tipY - 14, 28, 28);
      ctx.fillText('✈️', tipX - 12, tipY - 10);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  const startGame = async () => {
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');

    setIsBetLoading(true);
    try {
      await gamesAPI.aviatorBet(bet);
      refreshUser();
    } catch (err: any) {
      setIsBetLoading(false);
      return alert(err.message || 'Failed to place bet');
    }
    setIsBetLoading(false);

    setIsPlaying(true); setCrashed(false); setCashoutSuccess(false);
    setShowWinOverlay(false); setMultiplier(1.0);
    multiplierRef.current = 1.0; isPlayingRef.current = true;

    const crashPoint = 1.0 + Math.random() * 2.0 + (Math.random() > 0.8 ? Math.random() * 5.0 : 0);
    crashPointRef.current = crashPoint;
    startTimeRef.current = Date.now();

    const animate = () => {
      if (!isPlayingRef.current) return;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentMult = Math.exp(0.2 * elapsed);
      
      if (currentMult >= crashPoint) {
        setCrashed(true); setIsPlaying(false); isPlayingRef.current = false;
        setMultiplier(crashPoint);
        setCrashHistory(prev => [parseFloat(crashPoint.toFixed(2)), ...prev].slice(0, 12));
        drawFlightPath(elapsed, crashPoint, true);
        refreshUser();
        return;
      }

      setMultiplier(currentMult);
      multiplierRef.current = currentMult;
      drawFlightPath(elapsed, currentMult, false);
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const handleCashout = async () => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false; setIsPlaying(false);
    const win = parseFloat(betAmount) * multiplierRef.current;
    
    try {
      await gamesAPI.aviatorCashout(win);
      setWinAmount(win); setCashoutSuccess(true); setShowWinOverlay(true);
      setCrashHistory(prev => [parseFloat(multiplierRef.current.toFixed(2)), ...prev].slice(0, 12));
      refreshUser();
      setTimeout(() => setShowWinOverlay(false), 3800);
    } catch (err: any) {
      alert(err.message || 'Failed to process cashout');
    }
  };

  const getMultColor = () => {
    if (crashed) return '#ef4444';
    if (cashoutSuccess) return '#22c55e';
    if (multiplier >= 5) return '#f59e0b';
    if (multiplier >= 3) return '#22c55e';
    if (multiplier >= 2) return '#06b6d4';
    return '#3b82f6';
  };

  const multClass = crashed ? 'crashed' : cashoutSuccess ? 'won' : isPlaying ? 'flying' : '';

  return (
    <div className="av-container fade-in">
      {/* Header */}
      <div className="av-header">
        <button onClick={() => onNavigate('games')} className="av-back-btn">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="av-title">Aviator</h2>
          <p className="av-subtitle">Fly high, cash out before crash!</p>
        </div>
      </div>

      {/* Crash History */}
      <div className="av-history-bar">
        {crashHistory.map((c, i) => (
          <div key={i} className={`av-history-chip ${c >= 2 ? 'win' : 'lose'}`}>
            {c.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* Game Canvas */}
      <div className={`av-canvas-wrap ${isPlaying ? 'playing' : ''}`}>
        <canvas ref={canvasRef} />
        
        <div className={`av-multiplier ${multClass}`} style={{ color: getMultColor() }}>
          {multiplier.toFixed(2)}x
        </div>

        {crashed && <div className="av-crash-flash" />}
        {crashed && <div className="av-status-badge crash">FLEW AWAY</div>}
        {cashoutSuccess && <div className="av-status-badge cashout">CASHED OUT!</div>}
        {!isPlaying && !crashed && !cashoutSuccess && (
          <div className="av-waiting-text">Place a bet to start the flight</div>
        )}
      </div>

      {/* Bet Controls */}
      <div className="av-controls">
        <div className="av-controls-label">Bet Amount</div>
        <div className="av-bet-input-wrap">
          <button className="av-step-btn" onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) / 2).toString())} disabled={isPlaying || isBetLoading}>½</button>
          <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={isPlaying || isBetLoading} />
          <button className="av-step-btn" onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())} disabled={isPlaying || isBetLoading}>2×</button>
        </div>
        <div className="av-quick-bets">
          {QUICK_BETS.map(q => (
            <button key={q} className={`av-quick-btn ${betAmount === q.toString() ? 'active' : ''}`} onClick={() => setBetAmount(q.toString())} disabled={isPlaying || isBetLoading}>
              ₹{q}
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      {!isPlaying ? (
        <button className="av-action-btn av-action-bet" onClick={startGame} disabled={isBetLoading}>
          {isBetLoading ? 'Placing Bet...' : `Place Bet — ₹${betAmount}`}
        </button>
      ) : (
        <button className="av-action-btn av-action-cashout" onClick={handleCashout}>
          CASHOUT ₹{(parseFloat(betAmount) * multiplier).toFixed(2)}
        </button>
      )}

      {/* Balance */}
      <div className="av-balance">
        Balance: <span>₹{parseFloat(user.balance).toFixed(2)}</span>
      </div>

      {/* Win Overlay */}
      {showWinOverlay && (
        <div className="av-win-overlay" onClick={() => setShowWinOverlay(false)}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="av-confetti" style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 40}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `av-confetti-fall ${1.5 + Math.random() * 2}s ease ${Math.random() * 0.5}s forwards`,
              position: 'absolute', transform: `rotate(${Math.random() * 360}deg)`
            }} />
          ))}
          <div className="av-win-card">
            <div className="av-win-emoji">🎉</div>
            <div className="av-win-label">You Won!</div>
            <div className="av-win-amount">₹{winAmount.toFixed(2)}</div>
            <div className="av-win-detail">at {multiplierRef.current.toFixed(2)}x multiplier</div>
            <div className="av-win-dismiss">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
};
