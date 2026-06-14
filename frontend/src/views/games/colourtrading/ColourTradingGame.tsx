import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { gamesAPI } from '../../../api';
import './ColourTradingGame.css';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [50, 100, 200, 500, 1000];
const CONFETTI_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const colorMap: Record<string, { bg: string; glow: string; label: string; mult: string }> = {
  green: { bg: '#22c55e', glow: 'rgba(34,197,94,0.35)', label: 'Green', mult: '2×' },
  violet: { bg: '#8b5cf6', glow: 'rgba(139,92,246,0.35)', label: 'Violet', mult: '3×' },
  red: { bg: '#ef4444', glow: 'rgba(239,68,68,0.35)', label: 'Red', mult: '2×' },
};

export const ColourTradingGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isBettingPhase, setIsBettingPhase] = useState(true);
  const [resultColor, setResultColor] = useState<string | null>(null);
  const [history, setHistory] = useState<{ color: string; period: number }[]>([
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
  const [revealReady, setRevealReady] = useState(false);

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
            setRevealReady(false);
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

    await new Promise(r => setTimeout(r, 900));
    setRevealReady(true);

    if (!sColor) {
      const roll = Math.random();
      let result = 'red';
      if (roll > 0.5 && roll < 0.9) result = 'green';
      else if (roll >= 0.9) result = 'violet';
      setResultColor(result);
      setHistory(prev => [{ color: result, period: periodCount }, ...prev].slice(0, 15));
      setIsProcessing(false);
      return;
    }

    try {
      const res = await gamesAPI.colourTradingPlay(parseFloat(bAmount), sColor);
      setResultColor(res.result);
      setHistory(prev => [{ color: res.result, period: periodCount }, ...prev].slice(0, 15));

      if (res.won) {
        setWinPayout(res.payout);
        setTimeout(() => setShowWinOverlay(true), 700);
        setTimeout(() => setShowWinOverlay(false), 4200);
      } else {
        setTimeout(() => setShowLoseOverlay(true), 700);
        setTimeout(() => setShowLoseOverlay(false), 2800);
      }
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to process game round');
    }
    setIsProcessing(false);
  };

  const handleBet = (color: string) => {
    if (!isBettingPhase || selectedColor !== null) return;
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');
    setSelectedColor(color);
  };

  const timerPercent = isBettingPhase ? (timeLeft / 30) * 100 : (timeLeft / 5) * 100;
  const timerUrgent = isBettingPhase && timeLeft <= 10;
  const ringStroke = timerUrgent ? '#ef4444' : isBettingPhase ? '#22c55e' : '#f59e0b';
  const circumference = 2 * Math.PI * 32;

  return (
    <div className="ct-container fade-in">
      {/* Header */}
      <div className="ct-header">
        <button onClick={() => onNavigate('games')} className="ct-back-btn">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="ct-title">Colour Trading</h2>
          <p className="ct-subtitle">Predict the colour & win big!</p>
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

      {/* Timer */}
      <div className="ct-timer-section">
        <div className={`ct-timer-ring ${timerUrgent ? 'urgent' : ''}`}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="32" fill="none" stroke="var(--border-card)" strokeWidth="4.5" />
            <circle cx="36" cy="36" r="32" fill="none"
              stroke={ringStroke} strokeWidth="4.5" strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - timerPercent / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <span className={`ct-timer-number ${timerUrgent ? 'urgent' : ''}`} style={{ color: timerUrgent ? '#ef4444' : 'var(--text-primary)' }}>
            {timeLeft}
          </span>
        </div>
        <div className="ct-timer-info">
          <div className="ct-timer-period">Period #{periodCount}</div>
          <div className="ct-timer-status">
            {isBettingPhase ? (isProcessing ? 'Processing...' : 'Place Your Bets') : 'Result'}
          </div>
          <div className={`ct-timer-hint ${timerUrgent ? 'urgent' : ''}`}>
            {isBettingPhase ? (timerUrgent ? '⚡ Hurry! Time running out!' : 'Pick a colour below') : 'Next round starting soon...'}
          </div>
        </div>
      </div>

      {/* Result Display */}
      {!isBettingPhase && resultColor && (
        <div className="ct-result-section">
          <div className="ct-result-label">Winning Colour</div>
          <div
            className={`ct-result-orb ${revealReady ? 'reveal' : ''}`}
            style={{
              background: colorMap[resultColor]?.bg,
              boxShadow: `0 0 40px ${colorMap[resultColor]?.glow}, 0 0 80px ${colorMap[resultColor]?.glow}`,
            }}
          >
            {resultColor.toUpperCase()[0]}
          </div>
          <div className="ct-result-name" style={{ color: colorMap[resultColor]?.bg }}>
            {colorMap[resultColor]?.label}
          </div>
        </div>
      )}

      {/* Colour Selection */}
      {isBettingPhase && (
        <>
          <div className="ct-color-buttons">
            {(['green', 'violet', 'red'] as const).map(color => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  className={`ct-color-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleBet(color)}
                  style={{
                    background: isSelected ? `${colorMap[color].bg}18` : undefined,
                    borderColor: isSelected ? colorMap[color].bg : undefined,
                    boxShadow: isSelected ? `0 0 20px ${colorMap[color].glow}, inset 0 0 20px ${colorMap[color].bg}10` : undefined,
                    opacity: selectedColor !== null && !isSelected ? 0.5 : 1,
                    cursor: selectedColor !== null ? 'not-allowed' : 'pointer'
                  }}
                  disabled={selectedColor !== null}
                >
                  <div
                    className={`ct-color-orb ${isSelected ? 'pulse' : ''}`}
                    style={{
                      background: colorMap[color].bg,
                      boxShadow: isSelected ? `0 0 20px ${colorMap[color].bg}` : `0 2px 8px ${colorMap[color].glow}`,
                    }}
                  />
                  <span className="ct-color-label">{colorMap[color].label}</span>
                  <span className="ct-color-mult">{colorMap[color].mult}</span>
                </button>
              );
            })}
          </div>

          {/* Bet Amount */}
          <div className="ct-bet-section">
            <div className="ct-bet-label">Bet Amount</div>
            <div className="ct-bet-input-wrap">
              <button className="ct-bet-step-btn" onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) / 2).toString())} disabled={selectedColor !== null} style={{ opacity: selectedColor !== null ? 0.5 : 1, cursor: selectedColor !== null ? 'not-allowed' : 'pointer' }}>½</button>
              <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} disabled={selectedColor !== null} />
              <button className="ct-bet-step-btn" onClick={() => setBetAmount((parseFloat(betAmount) * 2).toString())} disabled={selectedColor !== null} style={{ opacity: selectedColor !== null ? 0.5 : 1, cursor: selectedColor !== null ? 'not-allowed' : 'pointer' }}>2×</button>
            </div>
            <div className="ct-quick-bets">
              {QUICK_BETS.map(q => (
                <button key={q} className={`ct-quick-btn ${betAmount === q.toString() ? 'active' : ''}`} onClick={() => setBetAmount(q.toString())} disabled={selectedColor !== null} style={{ opacity: selectedColor !== null ? 0.5 : 1, cursor: selectedColor !== null ? 'not-allowed' : 'pointer' }}>
                  ₹{q}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Confirmation */}
          {selectedColor && (
            <div className="ct-bet-confirm" style={{
              background: `${colorMap[selectedColor].bg}12`,
              border: `2px solid ${colorMap[selectedColor].bg}`,
            }}>
              Betting ₹{betAmount} on <span style={{ color: colorMap[selectedColor].bg, fontWeight: 800 }}>{colorMap[selectedColor].label}</span>
            </div>
          )}
        </>
      )}

      {/* Balance */}
      <div className="ct-balance">
        Balance: <span>₹{parseFloat(user.balance).toFixed(2)}</span>
      </div>

      {/* Win Overlay */}
      {showWinOverlay && (
        <div className="ct-overlay" onClick={() => setShowWinOverlay(false)}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="ct-confetti" style={{
              left: `${Math.random() * 100}%`, top: `${Math.random() * 40}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `ct-confetti-fall ${1.5 + Math.random() * 2}s ease ${Math.random() * 0.5}s forwards`,
              position: 'absolute', transform: `rotate(${Math.random() * 360}deg)`,
            }} />
          ))}
          <div className="ct-win-card">
            <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🎉</div>
            <div style={{ fontSize: '0.9rem', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '10px' }}>You Won!</div>
            <div style={{ fontSize: '3.2rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, fontFamily: "'SF Mono','Fira Code',Monaco,monospace" }}>
              ₹{winPayout.toFixed(2)}
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
              on {selectedColor ? colorMap[selectedColor]?.label : ''}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '24px' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}

      {/* Lose Overlay */}
      {showLoseOverlay && (
        <div className="ct-overlay" onClick={() => setShowLoseOverlay(false)}>
          <div className="ct-lose-card">
            <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>😔</div>
            <div style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 700, marginBottom: '6px' }}>You Lost</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Result was <span style={{ color: resultColor ? colorMap[resultColor]?.bg : '#fff', fontWeight: 800 }}>{resultColor ? colorMap[resultColor]?.label : ''}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
};
