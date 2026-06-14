import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';
import { gamesAPI } from '../../api';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

export const ColourTradingGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isBettingPhase, setIsBettingPhase] = useState(true);
  const [resultColor, setResultColor] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(['red', 'green', 'red', 'violet', 'green']);
  
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
            // End betting phase, roll result
            setIsBettingPhase(false);
            processGameRound();
            return 5; // 5 seconds to show result
          } else {
            // Restart betting phase
            setIsBettingPhase(true);
            setResultColor(null);
            setSelectedColor(null);
            return 30; // 30 seconds betting
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isBettingPhase]); // Removed selectedColor/betAmount from deps so timer doesn't reset

  const processGameRound = async () => {
    const sColor = selectedColorRef.current;
    const bAmount = betAmountRef.current;
    
    if (!sColor) {
      // If no bet placed, just simulate a random result to show the game is active
      const roll = Math.random();
      let result = 'red';
      if (roll > 0.5 && roll < 0.9) result = 'green';
      else if (roll >= 0.9) result = 'violet';
      setResultColor(result);
      setHistory((prev) => [result, ...prev].slice(0, 10));
      return;
    }

    try {
      const res = await gamesAPI.colourTradingPlay(parseFloat(bAmount), sColor);
      setResultColor(res.result);
      setHistory((prev) => [res.result, ...prev].slice(0, 10));
      
      if (res.won) {
        alert(`You Won! Result was ${res.result.toUpperCase()}. Payout: ${res.payout}`);
      } else {
        alert(`You Lost. Result was ${res.result.toUpperCase()}.`);
      }
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to process game round');
    }
  };

  const handleBet = (color: string) => {
    if (!isBettingPhase) return alert('Betting is closed!');
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');
    
    setSelectedColor(color);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => onNavigate('games')} className="btn" style={{ padding: '8px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Colour Trading</h2>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Timer Card */}
          <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)', border: '1px solid var(--accent-primary-glow)', gap: '16px' }}>
            <div>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Period: 20260614001</h3>
              <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>{isBettingPhase ? 'Place your bets!' : 'Calculating Result...'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '2.5rem', fontWeight: 800, color: isBettingPhase ? (timeLeft <= 10 ? 'var(--accent-danger)' : 'var(--accent-primary)') : 'var(--text-muted)', textShadow: isBettingPhase && timeLeft <= 10 ? '0 0 15px var(--accent-danger)' : 'none', transition: 'color 0.3s' }}>
              <Clock size={36} className={isBettingPhase && timeLeft <= 10 ? "animate-pulse" : ""} /> 
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>00:{timeLeft.toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Result Area (when not betting) */}
          {!isBettingPhase && resultColor && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
              <h2 style={{ marginBottom: '20px' }}>Result:</h2>
              <div style={{ 
                width: '100px', height: '100px', borderRadius: '50%', margin: '0 auto',
                background: resultColor === 'red' ? 'var(--accent-danger)' : resultColor === 'green' ? 'var(--accent-success)' : '#8b5cf6',
                boxShadow: `0 0 40px ${resultColor === 'red' ? 'var(--accent-danger)' : resultColor === 'green' ? 'var(--accent-success)' : '#8b5cf6'}`
              }}></div>
            </div>
          )}

          {/* Betting Actions */}
          {isBettingPhase && (
            <div className="glass-card" style={{ background: 'var(--bg-card)' }}>
              <div style={{ marginBottom: '24px' }}>
                <label className="input-label">Bet Amount (₹)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={betAmount} 
                    onChange={(e) => setBetAmount(e.target.value)}
                    style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px' }}>
                <button 
                  onClick={() => handleBet('green')}
                  className="btn" 
                  style={{ height: '70px', background: selectedColor === 'green' ? '#10b981' : 'rgba(16, 185, 129, 0.1)', color: selectedColor === 'green' ? '#fff' : '#10b981', border: '2px solid #10b981', fontSize: '1.1rem', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: 'var(--radius-md)' }}
                >
                  <span>Green</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>1:2</span>
                </button>
                <button 
                  onClick={() => handleBet('violet')}
                  className="btn" 
                  style={{ height: '70px', background: selectedColor === 'violet' ? '#8b5cf6' : 'rgba(139, 92, 246, 0.1)', color: selectedColor === 'violet' ? '#fff' : '#8b5cf6', border: '2px solid #8b5cf6', fontSize: '1.1rem', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: 'var(--radius-md)' }}
                >
                  <span>Violet</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>1:3</span>
                </button>
                <button 
                  onClick={() => handleBet('red')}
                  className="btn" 
                  style={{ height: '70px', background: selectedColor === 'red' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)', color: selectedColor === 'red' ? '#fff' : '#ef4444', border: '2px solid #ef4444', fontSize: '1.1rem', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', borderRadius: 'var(--radius-md)' }}
                >
                  <span>Red</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>1:2</span>
                </button>
              </div>
              {selectedColor && <p style={{ marginTop: '20px', textAlign: 'center', color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Bet placed on <span style={{ color: selectedColor === 'red' ? '#ef4444' : selectedColor === 'green' ? '#10b981' : '#8b5cf6', textTransform: 'uppercase' }}>{selectedColor}</span> for ₹{betAmount}</p>}
            </div>
          )}
        </div>

        {/* History Sidebar */}
        <div className="glass-card" style={{ flex: '1 1 300px', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--accent-primary)" /> Recent Results
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((color, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>#{20260614000 - i}</span>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: color === 'red' ? 'var(--accent-danger)' : color === 'green' ? 'var(--accent-success)' : '#8b5cf6' }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
