import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { gamesAPI } from '../../api';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [50, 100, 200, 500, 1000];

export const AviatorGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [trailDots, setTrailDots] = useState<{x: number; y: number; id: number}[]>([]);
  const [crashHistory, setCrashHistory] = useState<number[]>([2.14, 1.31, 4.72, 1.08, 2.56, 1.95, 8.33, 1.44, 3.01, 1.67]);

  const multiplierRef = useRef(1.0);
  const animationRef = useRef<number>();
  const isPlayingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Canvas-based flight path
  const drawFlightPath = useCallback((elapsed: number, mult: number, didCrash: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, H * i / 5);
      ctx.lineTo(W, H * i / 5);
      ctx.stroke();
    }
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W * i / 8, 0);
      ctx.lineTo(W * i / 8, H);
      ctx.stroke();
    }

    if (elapsed <= 0 && !didCrash) return;

    // Draw curve
    const maxTime = Math.max(elapsed, 3);
    const maxMult = Math.max(mult, 2);
    
    const grad = ctx.createLinearGradient(0, H, W, 0);
    if (didCrash) {
      grad.addColorStop(0, '#ef444480');
      grad.addColorStop(1, '#ef4444');
    } else {
      grad.addColorStop(0, '#22c55e80');
      grad.addColorStop(1, '#22c55e');
    }

    ctx.beginPath();
    ctx.moveTo(40, H - 40);

    const steps = 120;
    for (let i = 1; i <= steps; i++) {
      const t = (elapsed * i) / steps;
      const m = Math.exp(0.2 * t);
      const x = 40 + ((W - 80) * (t / maxTime));
      const y = H - 40 - ((H - 80) * ((m - 1) / (maxMult - 1)));
      ctx.lineTo(x, Math.max(10, y));
    }

    ctx.strokeStyle = didCrash ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 3;
    ctx.shadowColor = didCrash ? '#ef4444' : '#22c55e';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill area under curve
    const lastX = 40 + ((W - 80) * 1);
    ctx.lineTo(lastX, H - 40);
    ctx.lineTo(40, H - 40);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (didCrash) {
      fillGrad.addColorStop(0, 'rgba(239, 68, 68, 0.15)');
      fillGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    } else {
      fillGrad.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
      fillGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    }
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Plane emoji at the tip
    if (!didCrash) {
      const tipX = 40 + ((W - 80) * (elapsed / maxTime));
      const tipM = Math.exp(0.2 * elapsed);
      const tipY = H - 40 - ((H - 80) * ((tipM - 1) / (maxMult - 1)));
      ctx.font = '28px serif';
      ctx.fillText('✈️', tipX - 14, Math.max(24, tipY) - 8);
    } else {
      // Explosion at crash point
      const tipX = 40 + ((W - 80));
      const tipM = crashPointRef.current;
      const tipY = H - 40 - ((H - 80) * ((tipM - 1) / (maxMult - 1)));
      ctx.font = '32px serif';
      ctx.fillText('💥', tipX - 16, Math.max(24, tipY) - 8);
    }
  }, []);

  const startGame = async () => {
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');

    try {
      await gamesAPI.aviatorBet(bet);
      refreshUser();
    } catch (err: any) {
      return alert(err.message || 'Failed to place bet');
    }

    setIsPlaying(true);
    setCrashed(false);
    setCashoutSuccess(false);
    setShowWinOverlay(false);
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    isPlayingRef.current = true;

    const crashPoint = 1.0 + Math.random() * 2.0 + (Math.random() > 0.8 ? Math.random() * 5.0 : 0);
    crashPointRef.current = crashPoint;

    startTimeRef.current = Date.now();
    const animate = () => {
      if (!isPlayingRef.current) return;
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentMult = Math.exp(0.2 * elapsed);
      
      if (currentMult >= crashPoint) {
        setCrashed(true);
        setIsPlaying(false);
        isPlayingRef.current = false;
        setMultiplier(crashPoint);
        setCrashHistory(prev => [parseFloat(crashPoint.toFixed(2)), ...prev].slice(0, 10));
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
    isPlayingRef.current = false;
    setIsPlaying(false);
    
    const win = parseFloat(betAmount) * multiplierRef.current;
    
    try {
      await gamesAPI.aviatorCashout(win);
      setWinAmount(win);
      setCashoutSuccess(true);
      setShowWinOverlay(true);
      setCrashHistory(prev => [parseFloat(multiplierRef.current.toFixed(2)), ...prev].slice(0, 10));
      refreshUser();
      setTimeout(() => setShowWinOverlay(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to process cashout');
    }
  };

  const getMultColor = () => {
    if (crashed) return '#ef4444';
    if (cashoutSuccess) return '#22c55e';
    if (multiplier >= 3) return '#f59e0b';
    if (multiplier >= 2) return '#22c55e';
    return '#3b82f6';
  };

  return (
    <div className="fade-in" style={{ maxWidth: '100%' }}>
      <style>{`
        @keyframes avPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes avShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
        @keyframes avGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(120px) rotate(720deg);opacity:0} }
        @keyframes winPop { 0%{transform:scale(0) rotate(-10deg);opacity:0} 40%{transform:scale(1.15) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes winShine { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes cashoutPulse { 0%{box-shadow:0 0 0 0 rgba(245,158,11,0.6)} 100%{box-shadow:0 0 0 20px rgba(245,158,11,0)} }
        .av-canvas-wrap { position:relative; width:100%; aspect-ratio:16/9; min-height:220px; max-height:380px; background:linear-gradient(180deg,#0d0d1a 0%,#1a1a2e 100%); border-radius:16px; overflow:hidden; border:1px solid var(--border-card) }
        .av-canvas-wrap canvas { width:100%;height:100%;display:block }
        .av-mult { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:clamp(2.5rem,8vw,5rem);font-weight:900;font-family:'SF Mono',Monaco,monospace;z-index:5;letter-spacing:-2px;text-shadow:0 0 40px currentColor }
        .av-status-badge { position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:5;padding:8px 28px;border-radius:40px;font-weight:800;font-size:1rem;letter-spacing:1.5px;text-transform:uppercase }
        .av-history-bar { display:flex;gap:6px;overflow-x:auto;padding:12px 0;scrollbar-width:none }
        .av-history-bar::-webkit-scrollbar { display:none }
        .av-history-chip { flex-shrink:0;padding:6px 12px;border-radius:20px;font-size:0.8rem;font-weight:700;border:1px solid var(--border-card) }
        .av-bet-section { display:flex;gap:12px;flex-wrap:wrap;margin-top:16px }
        .av-bet-card { flex:1 1 100%;background:var(--bg-card);border:1px solid var(--border-card);border-radius:16px;padding:20px }
        .av-quick-bets { display:flex;gap:8px;flex-wrap:wrap;margin-top:12px }
        .av-quick-btn { padding:8px 16px;border-radius:20px;background:var(--bg-tertiary);border:1px solid var(--border-card);color:var(--text-secondary);font-weight:600;font-size:0.85rem;cursor:pointer;transition:all 0.2s }
        .av-quick-btn:hover,.av-quick-btn.active { background:var(--accent-primary);color:#fff;border-color:var(--accent-primary) }
        .av-bet-input { display:flex;align-items:center;gap:8px;background:var(--bg-tertiary);border:1px solid var(--border-card);border-radius:12px;padding:4px }
        .av-bet-input input { flex:1;background:transparent;border:none;color:var(--text-primary);font-size:1.4rem;font-weight:800;text-align:center;outline:none;min-width:0 }
        .av-bet-input button { width:40px;height:40px;border-radius:10px;border:1px solid var(--border-card);background:var(--bg-secondary);color:var(--text-primary);font-size:1.2rem;font-weight:700;cursor:pointer }
        .av-action-btn { width:100%;padding:18px;border:none;border-radius:14px;font-size:1.2rem;font-weight:800;letter-spacing:1px;cursor:pointer;transition:all 0.2s;text-transform:uppercase }
        .av-action-bet { background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 20px rgba(34,197,94,0.4) }
        .av-action-bet:hover { transform:translateY(-2px);box-shadow:0 6px 30px rgba(34,197,94,0.5) }
        .av-action-bet:disabled { opacity:0.5;cursor:not-allowed;transform:none }
        .av-action-cashout { background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;animation:cashoutPulse 1s ease infinite }
        .av-action-cashout:hover { transform:translateY(-2px) }
        .av-win-overlay { position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px) }
        .av-win-card { text-align:center;animation:winPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;padding:40px 50px;border-radius:24px;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border:2px solid rgba(34,197,94,0.3);position:relative;overflow:hidden }
        .av-win-card::before { content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);background-size:200% 100%;animation:winShine 2s linear infinite }
        .av-confetti { position:absolute;width:8px;height:8px;border-radius:2px }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={() => onNavigate('games')} style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-card)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Aviator</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Fly high, cash out before crash!</p>
        </div>
      </div>

      {/* Crash History Bar */}
      <div className="av-history-bar">
        {crashHistory.map((c, i) => (
          <div key={i} className="av-history-chip" style={{ background: c >= 2 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: c >= 2 ? '#22c55e' : '#ef4444' }}>
            {c.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* Game Canvas */}
      <div className="av-canvas-wrap">
        <canvas ref={canvasRef} width={800} height={450} />
        
        {/* Multiplier Display */}
        <div className="av-mult" style={{ 
          color: getMultColor(),
          animation: isPlaying ? 'avPulse 0.8s ease infinite' : crashed ? 'avShake 0.3s ease' : 'none'
        }}>
          {multiplier.toFixed(2)}x
        </div>

        {/* Status Badges */}
        {crashed && (
          <div className="av-status-badge" style={{ background: '#ef4444', color: '#fff', animation: 'avShake 0.4s ease' }}>
            FLEW AWAY!
          </div>
        )}
        {cashoutSuccess && (
          <div className="av-status-badge" style={{ background: '#22c55e', color: '#000' }}>
            CASHED OUT!
          </div>
        )}

        {/* Waiting state */}
        {!isPlaying && !crashed && !cashoutSuccess && (
          <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem', zIndex: 5 }}>
            Place a bet to start
          </div>
        )}
      </div>

      {/* Betting Controls */}
      <div className="av-bet-section">
        <div className="av-bet-card">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 600 }}>
            Bet Amount
          </div>
          <div className="av-bet-input">
            <button onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) / 2).toString())} disabled={isPlaying}>½</button>
            <input 
              type="number" 
              value={betAmount} 
              onChange={(e) => setBetAmount(e.target.value)} 
              disabled={isPlaying}
            />
            <button onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())} disabled={isPlaying}>2x</button>
          </div>
          <div className="av-quick-bets">
            {QUICK_BETS.map(q => (
              <button key={q} className={`av-quick-btn ${betAmount === q.toString() ? 'active' : ''}`} onClick={() => setBetAmount(q.toString())} disabled={isPlaying}>
                ₹{q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div style={{ marginTop: '16px' }}>
        {!isPlaying ? (
          <button className="av-action-btn av-action-bet" onClick={startGame} disabled={crashed && !cashoutSuccess && Date.now() - startTimeRef.current < 2000}>
            Place Bet — ₹{betAmount}
          </button>
        ) : (
          <button className="av-action-btn av-action-cashout" onClick={handleCashout}>
            CASHOUT ₹{(parseFloat(betAmount) * multiplier).toFixed(2)}
          </button>
        )}
      </div>

      {/* Balance Display */}
      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Balance: <span style={{ color: '#22c55e', fontWeight: 700 }}>₹{parseFloat(user.balance).toFixed(2)}</span>
      </div>

      {/* WIN OVERLAY */}
      {showWinOverlay && (
        <div className="av-win-overlay" onClick={() => setShowWinOverlay(false)}>
          {/* Confetti */}
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="av-confetti" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 40}%`,
              background: ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
              animation: `confettiFall ${1.5 + Math.random() * 2}s ease ${Math.random() * 0.5}s forwards`,
              position: 'absolute'
            }} />
          ))}
          <div className="av-win-card">
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎉</div>
            <div style={{ fontSize: '0.9rem', color: '#22c55e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>You Won!</div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              ₹{winAmount.toFixed(2)}
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              at {multiplierRef.current.toFixed(2)}x multiplier
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '20px' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
};
