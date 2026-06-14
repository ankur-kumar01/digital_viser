import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

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

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (isBettingPhase) {
            // End betting phase, roll result
            setIsBettingPhase(false);
            const roll = Math.random();
            let result = 'red';
            if (roll > 0.5 && roll < 0.9) result = 'green';
            else if (roll >= 0.9) result = 'violet';
            
            setResultColor(result);
            processResult(result);
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
  }, [isBettingPhase, selectedColor, betAmount]);

  const processResult = (result: string) => {
    setHistory((prev) => [result, ...prev].slice(0, 10));
    if (!selectedColor) return;
    
    if (selectedColor === result) {
      const mult = result === 'violet' ? 3 : 2;
      const win = parseFloat(betAmount) * mult;
      alert(`You Won! Result was ${result.toUpperCase()}. Payout: ${win}`);
    } else {
      alert(`You Lost. Result was ${result.toUpperCase()}.`);
    }
    refreshUser();
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Timer Card */}
          <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
            <div>
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '4px' }}>Period: 20260614001</h3>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{isBettingPhase ? 'Place your bets!' : 'Calculating Result...'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '2rem', fontWeight: 700, color: isBettingPhase ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
              <Clock size={32} /> 00:{timeLeft.toString().padStart(2, '0')}
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
            <div className="glass-card">
              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Bet Amount</label>
                <input 
                  type="number" 
                  className="input-field" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => handleBet('green')}
                  className="btn" 
                  style={{ flex: 1, height: '60px', background: selectedColor === 'green' ? '#10b981' : 'rgba(16, 185, 129, 0.2)', color: selectedColor === 'green' ? '#fff' : '#10b981', border: '1px solid #10b981', fontSize: '1.2rem', fontWeight: 600 }}
                >
                  Join Green (2x)
                </button>
                <button 
                  onClick={() => handleBet('violet')}
                  className="btn" 
                  style={{ flex: 1, height: '60px', background: selectedColor === 'violet' ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)', color: selectedColor === 'violet' ? '#fff' : '#8b5cf6', border: '1px solid #8b5cf6', fontSize: '1.2rem', fontWeight: 600 }}
                >
                  Join Violet (3x)
                </button>
                <button 
                  onClick={() => handleBet('red')}
                  className="btn" 
                  style={{ flex: 1, height: '60px', background: selectedColor === 'red' ? 'var(--accent-danger)' : 'var(--accent-danger-glow)', color: selectedColor === 'red' ? '#fff' : 'var(--accent-danger)', border: '1px solid var(--accent-danger)', fontSize: '1.2rem', fontWeight: 600 }}
                >
                  Join Red (2x)
                </button>
              </div>
              {selectedColor && <p style={{ marginTop: '16px', textAlign: 'center', color: 'var(--accent-primary)' }}>Bet placed on: {selectedColor.toUpperCase()} for {betAmount}</p>}
            </div>
          )}
        </div>

        {/* History Sidebar */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '16px' }}>History</h3>
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
