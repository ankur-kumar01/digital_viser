import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { gamesAPI } from '../../api';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [50, 100, 200, 500, 1000];

const colorMap: Record<string, { bg: string; glow: string; label: string; mult: string }> = {
  green: { bg: '#22c55e', glow: 'rgba(34,197,94,0.3)', label: 'Green', mult: '2x' },
  violet: { bg: '#8b5cf6', glow: 'rgba(139,92,246,0.3)', label: 'Violet', mult: '3x' },
  red: { bg: '#ef4444', glow: 'rgba(239,68,68,0.3)', label: 'Red', mult: '2x' },
};

export const ColourTradingGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isBettingPhase, setIsBettingPhase] = useState(true);
  const [resultColor, setResultColor] = useState<string | null>(null);
  const [history, setHistory] = useState<{color: string; period: number}[]>([
    { color: 'red', period: 1001 }, { color: 'green', period: 1000 }, { color: 'red', period: 999 },
    { color: 'violet', period: 998 }, { color: 'green', period: 997 }, { color: 'red', period: 996 },
    { color: 'green', period: 995 }, { color: 'red', period: 994 }, { color: 'violet', period: 993 },
    { color: 'green', period: 992 },
  ]);
  const [periodCount, setPeriodCount] = useState(1002);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [winPayout, setWinPayout] = useState(0);
  const [showLoseOverlay, setShowLoseOverlay] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [revealAnimation, setRevealAnimation] = useState(false);

  const selectedColorRef = useRef<string | null>(null);
  const betAmountRef = useRef<string>('100');
  
  useEffect(() => {
    selectedColorRef.current = selectedColor;
    betAmountRef.current = betAmount;
  }, [selectedColor, betAmount]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (isBettingPhase) {
            setIsBettingPhase(false);
            processGameRound();
            return 5;
          } else {
            setIsBettingPhase(true);
            setResultColor(null);
            setSelectedColor(null);
            setRevealAnimation(false);
            setPeriodCount(p => p + 1);
            return 30;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isBettingPhase]);

  const processGameRound = async () => {
    const sColor = selectedColorRef.current;
    const bAmount = betAmountRef.current;
    setIsProcessing(true);
    
    // Reveal animation delay
    await new Promise(r => setTimeout(r, 800));
    setRevealAnimation(true);
    
    if (!sColor) {
      const roll = Math.random();
      let result = 'red';
      if (roll > 0.5 && roll < 0.9) result = 'green';
      else if (roll >= 0.9) result = 'violet';
      setResultColor(result);
      setHistory((prev) => [{ color: result, period: periodCount }, ...prev].slice(0, 15));
      setIsProcessing(false);
      return;
    }

    try {
      const res = await gamesAPI.colourTradingPlay(parseFloat(bAmount), sColor);
      setResultColor(res.result);
      setHistory((prev) => [{ color: res.result, period: periodCount }, ...prev].slice(0, 15));
      
      if (res.won) {
        setWinPayout(res.payout);
        setTimeout(() => setShowWinOverlay(true), 600);
        setTimeout(() => setShowWinOverlay(false), 4000);
      } else {
        setTimeout(() => setShowLoseOverlay(true), 600);
        setTimeout(() => setShowLoseOverlay(false), 2500);
      }
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to process game round');
    }
    setIsProcessing(false);
  };

  const handleBet = (color: string) => {
    if (!isBettingPhase) return;
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');
    setSelectedColor(color);
  };

  const timerPercent = isBettingPhase ? (timeLeft / 30) * 100 : (timeLeft / 5) * 100;
  const timerUrgent = isBettingPhase && timeLeft <= 10;

  return (
    <div className="fade-in" style={{ maxWidth: '100%' }}>
      <style>{`
        @keyframes ctSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(1080deg)} }
        @keyframes ctReveal { 0%{transform:scale(0) rotate(-180deg);opacity:0} 60%{transform:scale(1.2) rotate(10deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes ctPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes ctGlow { 0%,100%{box-shadow:0 0 20px currentColor} 50%{box-shadow:0 0 50px currentColor} }
        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(120px) rotate(720deg);opacity:0} }
        @keyframes winPop { 0%{transform:scale(0) rotate(-10deg);opacity:0} 40%{transform:scale(1.15) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
        @keyframes winShine { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes loseSlide { 0%{transform:translateY(30px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .ct-timer-ring { width:80px;height:80px;border-radius:50%;position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0 }
        .ct-timer-ring svg { position:absolute;inset:0;transform:rotate(-90deg) }
        .ct-color-btn { flex:1;min-width:90px;padding:20px 12px;border-radius:16px;border:2px solid var(--border-card);display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all 0.25s;position:relative;overflow:hidden;background:var(--bg-card) }
        .ct-color-btn::before { content:'';position:absolute;inset:0;opacity:0;transition:opacity 0.25s }
        .ct-color-btn:active { transform:scale(0.95) }
        .ct-color-btn.selected { transform:scale(1.02) }
        .ct-color-dot { width:36px;height:36px;border-radius:50%;transition:all 0.3s }
        .ct-result-orb { width:120px;height:120px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:2rem;font-weight:900;color:#fff }
        .ct-history-strip { display:flex;gap:6px;overflow-x:auto;padding:8px 0;scrollbar-width:none }
        .ct-history-strip::-webkit-scrollbar { display:none }
        .ct-history-dot { width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#fff }
        .ct-bet-input { display:flex;align-items:center;gap:8px;background:var(--bg-tertiary);border:1px solid var(--border-card);border-radius:12px;padding:4px }
        .ct-bet-input input { flex:1;background:transparent;border:none;color:var(--text-primary);font-size:1.3rem;font-weight:800;text-align:center;outline:none;min-width:0 }
        .ct-bet-input button { width:40px;height:40px;border-radius:10px;border:1px solid var(--border-card);background:var(--bg-secondary);color:var(--text-primary);font-size:1.2rem;font-weight:700;cursor:pointer }
        .ct-quick-bets { display:flex;gap:6px;flex-wrap:wrap;margin-top:10px }
        .ct-quick-btn { padding:6px 14px;border-radius:20px;background:var(--bg-tertiary);border:1px solid var(--border-card);color:var(--text-secondary);font-weight:600;font-size:0.8rem;cursor:pointer;transition:all 0.2s }
        .ct-quick-btn:hover,.ct-quick-btn.active { background:var(--accent-primary);color:#fff;border-color:var(--accent-primary) }
        .ct-overlay { position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px) }
        .ct-win-card { text-align:center;animation:winPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;padding:40px 50px;border-radius:24px;background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border:2px solid rgba(34,197,94,0.3);position:relative;overflow:hidden }
        .ct-win-card::before { content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);background-size:200% 100%;animation:winShine 2s linear infinite }
        .ct-lose-card { text-align:center;animation:loseSlide 0.4s ease forwards;padding:30px 40px;border-radius:20px;background:var(--bg-card);border:2px solid #ef4444 }
        .ct-confetti { position:absolute;width:8px;height:8px;border-radius:2px }
        .ct-section { background:var(--bg-card);border:1px solid var(--border-card);border-radius:16px;padding:16px;margin-top:12px }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button onClick={() => onNavigate('games')} style={{ padding: '10px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-card)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Colour Trading</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Predict the colour & win big!</p>
        </div>
      </div>

      {/* History Strip */}
      <div className="ct-history-strip">
        {history.map((h, i) => (
          <div key={i} className="ct-history-dot" style={{ background: colorMap[h.color]?.bg || '#888' }}>
            {h.color[0].toUpperCase()}
          </div>
        ))}
      </div>

      {/* Timer Section */}
      <div className="ct-section" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div className="ct-timer-ring">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle cx="40" cy="40" r="36" fill="none" 
              stroke={timerUrgent ? '#ef4444' : isBettingPhase ? '#22c55e' : '#f59e0b'} 
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 36}`}
              strokeDashoffset={`${2 * Math.PI * 36 * (1 - timerPercent / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <span style={{ 
            fontSize: '1.4rem', fontWeight: 900, color: timerUrgent ? '#ef4444' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
            animation: timerUrgent ? 'timerPulse 0.5s ease infinite' : 'none'
          }}>
            {timeLeft}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Period #{periodCount}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
            {isBettingPhase ? (isProcessing ? 'Processing...' : 'Place Your Bets') : 'Result'}
          </div>
          <div style={{ fontSize: '0.8rem', color: timerUrgent ? '#ef4444' : 'var(--text-muted)', marginTop: '2px' }}>
            {isBettingPhase ? (timerUrgent ? 'Hurry up! Time is running out!' : 'Pick a colour below') : 'Next round starting soon...'}
          </div>
        </div>
      </div>

      {/* Result Display */}
      {!isBettingPhase && resultColor && (
        <div className="ct-section" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>
            Winning Colour
          </div>
          <div className="ct-result-orb" style={{ 
            background: colorMap[resultColor]?.bg,
            boxShadow: `0 0 50px ${colorMap[resultColor]?.glow}, 0 0 100px ${colorMap[resultColor]?.glow}`,
            animation: revealAnimation ? 'ctReveal 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none'
          }}>
            {resultColor.toUpperCase()[0]}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: colorMap[resultColor]?.bg, marginTop: '16px' }}>
            {colorMap[resultColor]?.label}
          </div>
        </div>
      )}

      {/* Colour Selection */}
      {isBettingPhase && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            {(['green', 'violet', 'red'] as const).map(color => (
              <button
                key={color}
                className={`ct-color-btn ${selectedColor === color ? 'selected' : ''}`}
                onClick={() => handleBet(color)}
                style={{
                  background: selectedColor === color ? `${colorMap[color].bg}20` : 'var(--bg-card)',
                  borderColor: selectedColor === color ? colorMap[color].bg : 'var(--border-card)',
                  boxShadow: selectedColor === color ? `0 0 25px ${colorMap[color].glow}` : 'none'
                }}
              >
                <div className="ct-color-dot" style={{ 
                  background: colorMap[color].bg,
                  boxShadow: selectedColor === color ? `0 0 20px ${colorMap[color].bg}` : 'none',
                  animation: selectedColor === color ? 'ctPulse 1s ease infinite' : 'none'
                }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{colorMap[color].label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>{colorMap[color].mult}</span>
              </button>
            ))}
          </div>

          {/* Bet Amount */}
          <div className="ct-section">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 600 }}>
              Bet Amount
            </div>
            <div className="ct-bet-input">
              <button onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) / 2).toString())}>½</button>
              <input 
                type="number" 
                value={betAmount} 
                onChange={(e) => setBetAmount(e.target.value)}
              />
              <button onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())}>2x</button>
            </div>
            <div className="ct-quick-bets">
              {QUICK_BETS.map(q => (
                <button key={q} className={`ct-quick-btn ${betAmount === q.toString() ? 'active' : ''}`} onClick={() => setBetAmount(q.toString())}>
                  ₹{q}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Bet Confirmation */}
          {selectedColor && (
            <div style={{ 
              marginTop: '12px', padding: '14px 20px', borderRadius: '14px', textAlign: 'center', fontWeight: 700,
              background: `${colorMap[selectedColor].bg}15`,
              border: `2px solid ${colorMap[selectedColor].bg}`,
              color: 'var(--text-primary)', fontSize: '0.95rem'
            }}>
              Betting ₹{betAmount} on <span style={{ color: colorMap[selectedColor].bg }}>{colorMap[selectedColor].label}</span>
            </div>
          )}
        </>
      )}

      {/* Balance */}
      <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Balance: <span style={{ color: '#22c55e', fontWeight: 700 }}>₹{parseFloat(user.balance).toFixed(2)}</span>
      </div>

      {/* WIN OVERLAY */}
      {showWinOverlay && (
        <div className="ct-overlay" onClick={() => setShowWinOverlay(false)}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="ct-confetti" style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 40}%`,
              background: ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'][i % 6],
              animation: `confettiFall ${1.5 + Math.random() * 2}s ease ${Math.random() * 0.5}s forwards`,
              position: 'absolute'
            }} />
          ))}
          <div className="ct-win-card">
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎉</div>
            <div style={{ fontSize: '0.9rem', color: '#22c55e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>You Won!</div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
              ₹{winPayout.toFixed(2)}
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              on {selectedColor ? colorMap[selectedColor]?.label : ''}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '20px' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}

      {/* LOSE OVERLAY */}
      {showLoseOverlay && (
        <div className="ct-overlay" onClick={() => setShowLoseOverlay(false)}>
          <div className="ct-lose-card">
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>😔</div>
            <div style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>You Lost</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Result was <span style={{ color: resultColor ? colorMap[resultColor]?.bg : '#fff', fontWeight: 700 }}>{resultColor ? colorMap[resultColor]?.label : ''}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '14px' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
};
