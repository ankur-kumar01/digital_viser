import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../../../api';
import './AviatorGame.css';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [5, 10, 20, 50, 100, 200, 500];
const CONFETTI_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const AviatorGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  
  // Game State
  const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [timeLeft, setTimeLeft] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashHistory, setCrashHistory] = useState<number[]>([]);
  
  // Local Player State
  const [hasActiveBet, setHasActiveBet] = useState(false);
  const [isBetLoading, setIsBetLoading] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  
  // Auto Cashout State
  const [autoCashout, setAutoCashout] = useState(false);
  const [autoCashoutMult, setAutoCashoutMult] = useState('2.0');
  
  // Simulated Players State
  const [simPlayers, setSimPlayers] = useState<any[]>([]);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const startTimeRef = useRef<number>(0);
  const gameStateRef = useRef<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const crashPointRef = useRef<number>(1.0);
  const multiplierRef = useRef<number>(1.0);
  
  const hasActiveBetRef = useRef(false);
  const cashoutSuccessRef = useRef(false);
  const autoCashoutRef = useRef(false);
  const autoCashoutMultRef = useRef(2.0);

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

    // 1. Nebulae / Glowing Dust Clouds for depth
    if (elapsed > 0) {
      const nebulae = [
        { x: w * 0.3, y: h * 0.4, r: 120, color: 'rgba(99, 102, 241, 0.04)' }, // Indigo glow
        { x: w * 0.7, y: h * 0.3, r: 150, color: 'rgba(236, 72, 153, 0.03)' }  // Pink glow
      ];
      nebulae.forEach(n => {
        const scrollX = (n.x - elapsed * 8) % (w + n.r * 2);
        const drawX = scrollX < -n.r ? scrollX + w + n.r * 2 : scrollX;
        const grad = ctx.createRadialGradient(drawX, n.y, 0, drawX, n.y, n.r);
        grad.addColorStop(0, n.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(drawX, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 2. Parallax Twinkling Starfield
    if (elapsed > 0) {
      const numStars = 40;
      for (let i = 0; i < numStars; i++) {
        const depth = 0.4 + 1.2 * ((i * 17) % 10) / 10; // 0.4 to 1.6
        const baseX = ((i * 113) % 100) / 100 * w;
        const baseY = ((i * 197) % 100) / 100 * h;
        const size = 0.5 + 1.5 * ((i * 7) % 5) / 5; // 0.5 to 2.0 px
        
        const speedX = 30 * depth;
        const speedY = 15 * depth;
        
        let x = (baseX - elapsed * speedX) % w;
        if (x < 0) x += w;
        let y = (baseY + elapsed * speedY) % h;
        if (y < 0) y += h;
        
        const alpha = (0.2 + 0.6 * (depth - 0.4) / 1.2) * (0.7 + 0.3 * Math.sin(elapsed * 5 + i));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Scrolling Grid Lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSpeed = 25; // pixels per second
    const offsetX = (elapsed * gridSpeed) % (w / 10);
    const offsetY = (elapsed * gridSpeed * 0.5) % (h / 6);
    
    for (let i = -1; i <= 6; i++) {
      const y = (h * i / 6) + (elapsed > 0 ? offsetY : 0);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 11; i++) {
      const x = (w * i / 10) - (elapsed > 0 ? offsetX : 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    const pad = 30;
    if (elapsed <= 0 && !didCrash) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }

    const maxTime = Math.max(elapsed, 3);
    const maxMult = Math.max(mult * 1.2, 2.5);

    // 4. Exhaust Particles Trail (spawned along the past flight path)
    if (elapsed > 0 && !didCrash) {
      const maxAge = 0.8;
      const particleInterval = 0.04;
      const startT = Math.max(0, elapsed - maxAge);
      
      for (let t = elapsed; t >= startT; t -= particleInterval) {
        const age = elapsed - t;
        const m = Math.exp(0.2 * t);
        const px = pad + ((w - pad * 2) * (t / maxTime));
        const py = h - pad - ((h - pad * 2) * ((m - 1) / (maxMult - 1)));
        const clampedPy = Math.max(8, Math.min(h - pad, py));
        
        const jitterX = Math.sin(t * 80) * 3 * (age / maxAge);
        const jitterY = Math.cos(t * 100) * 3 * (age / maxAge);
        const driftX = -age * 50 + jitterX;
        const driftY = age * 15 + jitterY;
        
        const drawX = px + driftX;
        const drawY = clampedPy + driftY;
        
        const size = Math.max(1, (2 + age * 10) * (didCrash ? 0 : 1));
        const opacity = 0.8 * (1 - age / maxAge);
        
        let color;
        if (age < 0.15) {
          color = `rgba(253, 224, 71, ${opacity})`; // yellow flame
        } else if (age < 0.35) {
          color = `rgba(249, 115, 22, ${opacity})`; // orange flame
        } else if (age < 0.55) {
          color = `rgba(239, 68, 68, ${opacity})`; // red glow
        } else {
          color = `rgba(156, 163, 175, ${opacity * 0.4})`; // grey smoke
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Curve Path
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

    // 6. Plane or explosion at tip
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

  useEffect(() => {
    hasActiveBetRef.current = hasActiveBet;
  }, [hasActiveBet]);

  useEffect(() => {
    cashoutSuccessRef.current = cashoutSuccess;
  }, [cashoutSuccess]);

  useEffect(() => {
    autoCashoutRef.current = autoCashout;
  }, [autoCashout]);

  useEffect(() => {
    autoCashoutMultRef.current = parseFloat(autoCashoutMult) || 2.0;
  }, [autoCashoutMult]);

  // Generate simulated players
  const generateSimulatedPlayers = () => {
    const names = ['Rahul88', 'Priya_M', 'AmanK', 'Raj_007', 'NehaS', 'Vikas12', 'Simran_X', 'AmitB'];
    const count = Math.floor(Math.random() * 4) + 4; // 4 to 7 players
    const players = [];
    for (let i = 0; i < count; i++) {
      players.push({
        id: i,
        name: names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100),
        bet: QUICK_BETS[Math.floor(Math.random() * QUICK_BETS.length)],
        targetMult: 1.2 + Math.random() * 8.0, // random cashout target
        cashedOut: false,
        winAmount: 0
      });
    }
    setSimPlayers(players);
  };

  // Socket Connection
  useEffect(() => {
    const token = getToken();
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
    if (!socketUrl) socketUrl = isLocalhost ? 'http://localhost:5000' : window.location.origin;
    
    const socket = io(socketUrl, {
      auth: { token }
    });
    
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socket.on('aviator_state', (data) => {
      setGameState(data.state);
      gameStateRef.current = data.state;

      if (data.state === 'WAITING') {
        setTimeLeft(data.timeLeft || 8000);
        setMultiplier(1.0);
        multiplierRef.current = 1.0;
        setHasActiveBet(false);
        setCashoutSuccess(false);
        setShowWinOverlay(false);
        generateSimulatedPlayers();
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        drawFlightPath(0, 1.0, false);
      } 
      else if (data.state === 'FLYING') {
        startTimeRef.current = data.startTime;
        startFlightAnimation();
      } 
      else if (data.state === 'CRASHED') {
        crashPointRef.current = data.crashPoint;
        setMultiplier(data.crashPoint);
        multiplierRef.current = data.crashPoint;
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        
        // Calculate the actual elapsed time for the exact crash point to draw accurately
        const finalElapsed = Math.log(data.crashPoint) / 0.2;
        drawFlightPath(finalElapsed, data.crashPoint, true);
        
        setCrashHistory(prev => [parseFloat(data.crashPoint.toFixed(2)), ...prev].slice(0, 12));
        
        if (hasActiveBetRef.current && !cashoutSuccessRef.current) {
          setHasActiveBet(false); // Lost
        }
        refreshUser();
      }
    });

    socket.on('aviator_timer', (data) => {
      setTimeLeft(data.timeLeft);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const startFlightAnimation = () => {
    const animate = () => {
      if (gameStateRef.current !== 'FLYING') return;
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const currentMult = Math.exp(0.2 * elapsed);
      
      setMultiplier(currentMult);
      multiplierRef.current = currentMult;
      drawFlightPath(elapsed, currentMult, false);
      
      // Auto cashout logic
      if (autoCashoutRef.current && hasActiveBetRef.current && !cashoutSuccessRef.current) {
        if (currentMult >= autoCashoutMultRef.current) {
          handleCashout();
        }
      }

      // Simulate player cashouts
      setSimPlayers(prev => {
        let changed = false;
        const next = prev.map(p => {
          if (!p.cashedOut && currentMult >= p.targetMult) {
            changed = true;
            return { ...p, cashedOut: true, winAmount: p.bet * currentMult };
          }
          return p;
        });
        return changed ? next : prev;
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const handlePlaceBet = () => {
    if (gameState !== 'WAITING') return alert('Wait for the next round to bet');
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');

    setIsBetLoading(true);
    socketRef.current?.emit('aviator_bet', { amount: bet }, (res: any) => {
      setIsBetLoading(false);
      if (res.error) return alert(res.error);
      setHasActiveBet(true);
      refreshUser();
    });
  };

  const handleCashout = () => {
    if (gameStateRef.current !== 'FLYING' || !hasActiveBetRef.current) return;
    
    socketRef.current?.emit('aviator_cashout', {}, (res: any) => {
      if (res.error) return alert(res.error);
      
      setHasActiveBet(false);
      setCashoutSuccess(true);
      setWinAmount(res.winAmount);
      setShowWinOverlay(true);
      refreshUser();

      
      setTimeout(() => setShowWinOverlay(false), 3800);
    });
  };

  const getTensionClass = () => {
    if (gameState === 'CRASHED') return 'crashed';
    if (cashoutSuccess) return 'won';
    if (gameState === 'FLYING') {
      if (multiplier >= 5) return 'tension-high';
      if (multiplier >= 2) return 'tension-med';
      return 'tension-low flying';
    }
    return '';
  };

  const multClass = getTensionClass();

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
      <div className="av-main-grid">
        {/* Main Game Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Game Canvas */}
          <div className={`av-canvas-wrap ${gameState === 'FLYING' ? 'playing' : ''} ${gameState === 'CRASHED' ? 'crashed' : ''}`}>
            <canvas ref={canvasRef} />
            
            <div className={`av-multiplier ${multClass}`}>
              {multiplier.toFixed(2)}x
            </div>

            {gameState === 'CRASHED' && <div className="av-crash-flash" />}
            {gameState === 'CRASHED' && <div className="av-status-badge crash">FLEW AWAY</div>}
            {cashoutSuccess && <div className="av-status-badge cashout">CASHED OUT!</div>}
            
            {gameState === 'WAITING' && (
              <div className="av-waiting-text">
                {timeLeft > 0 ? `Next round in ${(timeLeft/1000).toFixed(1)}s` : 'Starting...'}
              </div>
            )}
          </div>

          {/* Bet Controls */}
          <div className="av-controls">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="av-controls-label" style={{ margin: 0 }}>Bet Amount</div>
              
              {/* Auto Cashout Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: autoCashout ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>AUTO</span>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoCashout} onChange={(e) => setAutoCashout(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }} disabled={hasActiveBet} />
                </label>
                {autoCashout && (
                  <input 
                    type="number" 
                    value={autoCashoutMult} 
                    onChange={(e) => setAutoCashoutMult(e.target.value)} 
                    style={{ width: '50px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                    step="0.1"
                    min="1.01"
                    disabled={hasActiveBet}
                  />
                )}
              </div>
            </div>

            <div className="av-bet-input-wrap">
              <button className="av-step-btn" onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) / 2).toString())} disabled={hasActiveBet || isBetLoading}>½</button>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={hasActiveBet || isBetLoading} />
              <button className="av-step-btn" onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())} disabled={hasActiveBet || isBetLoading}>2×</button>
            </div>
            <div className="av-quick-bets">
              {QUICK_BETS.map(q => (
                <button key={q} className={`av-quick-btn ${betAmount === q.toString() ? 'active' : ''}`} onClick={() => setBetAmount(q.toString())} disabled={hasActiveBet || isBetLoading}>
                  ₹{q}
                </button>
              ))}
            </div>

            {/* Action Button */}
            {gameState === 'WAITING' ? (
              <button 
                className="av-action-btn av-action-bet" 
                onClick={handlePlaceBet} 
                disabled={isBetLoading || hasActiveBet}
                style={{ background: hasActiveBet ? '#4b5563' : undefined, boxShadow: hasActiveBet ? 'none' : undefined }}
              >
                {hasActiveBet ? 'Waiting for Next Round...' : isBetLoading ? 'Placing Bet...' : `Place Bet — ₹${betAmount}`}
              </button>
            ) : hasActiveBet ? (
              <button className="av-action-btn av-action-cashout" onClick={handleCashout}>
                CASHOUT ₹{(parseFloat(betAmount) * multiplier).toFixed(2)}
              </button>
            ) : (
              <button className="av-action-btn" disabled style={{ background: '#374151', color: '#9ca3af' }}>
                Waiting for Next Round
              </button>
            )}
          </div>
        </div>

        {/* Live Multiplayer Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-card)', padding: '16px', borderRadius: '20px', border: '1px solid var(--border-card)', minHeight: '300px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Live Players ({simPlayers.length})</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '400px' }}>
            {/* Player Row Template */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: cashoutSuccess ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-tertiary)', borderRadius: '12px', border: cashoutSuccess ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                  {user?.name?.substring(0, 2).toUpperCase() || 'YOU'}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: cashoutSuccess ? '#22c55e' : 'var(--text-primary)' }}>You</div>
              </div>
              {hasActiveBet && !cashoutSuccess && (
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>₹{betAmount}</div>
              )}
              {cashoutSuccess && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 700 }}>{((winAmount || parseFloat(betAmount)*multiplier) / parseFloat(betAmount)).toFixed(2)}x</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22c55e' }}>₹{winAmount.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* Simulated Players */}
            {simPlayers.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: p.cashedOut ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)', borderRadius: '12px', transition: 'all 0.3s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: p.cashedOut ? '#22c55e' : 'var(--text-secondary)' }}>{p.name}</div>
                </div>
                {!p.cashedOut && (
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>₹{p.bet}</div>
                )}
                {p.cashedOut && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                     <div style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 700 }}>{p.targetMult.toFixed(2)}x</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#22c55e' }}>₹{p.winAmount.toFixed(2)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="av-balance">
        Balance: <span>₹{parseFloat(user.balance).toFixed(2)}</span>
      </div>

      {/* Win Overlay */}
      {showWinOverlay && (
        <div className="av-win-overlay" onClick={() => setShowWinOverlay(false)}>
          {Array.from({ length: 45 }).map((_, i) => {
            const left = ((i * 17) % 100);
            const delay = ((i * 7) % 10) / 10;
            const duration = 1.5 + ((i * 13) % 15) / 10;
            const angle = (i * 45) % 360;
            return (
              <div 
                key={i} 
                className="av-confetti" 
                style={{
                  left: `${left}%`, 
                  top: `-20px`,
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  animation: `av-confetti-fall ${duration}s ease ${delay}s forwards`,
                  position: 'absolute', 
                  transform: `rotate(${angle}deg)`
                }} 
              />
            );
          })}
          <div className="av-win-card win-popup-glamorous">
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
