import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Rocket } from 'lucide-react';
import { authAPI } from '../../api';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

export const AviatorGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [isPlaying, setIsPlaying] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [cashoutSuccess, setCashoutSuccess] = useState(false);
  const [winAmount, setWinAmount] = useState(0);

  const multiplierRef = useRef(1.0);
  const animationRef = useRef<number>();
  const isPlayingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const startGame = async () => {
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');

    // Deduct bet (Simulated frontend-only deduction for now, in a real app this hits backend immediately)
    // For this simulation, we'll only hit backend to add/subtract at the end of the round.
    
    setIsPlaying(true);
    setCrashed(false);
    setCashoutSuccess(false);
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    isPlayingRef.current = true;

    // Generate crash point (Server should do this, but simulated here)
    // Random between 1.00 and 3.00 mostly, sometimes higher
    const crashPoint = 1.0 + Math.random() * 2.0 + (Math.random() > 0.8 ? Math.random() * 5.0 : 0);

    let startTime = Date.now();
    const animate = () => {
      if (!isPlayingRef.current) return;
      
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      
      // Multiplier curve: m(t) = e^(0.06 * t)
      const currentMult = Math.exp(0.2 * elapsed);
      
      if (currentMult >= crashPoint) {
        // Crash
        setCrashed(true);
        setIsPlaying(false);
        isPlayingRef.current = false;
        setMultiplier(crashPoint);
        // Process Loss (deduct bet)
        processResult(-bet, 'Aviator Loss');
        return;
      }

      setMultiplier(currentMult);
      multiplierRef.current = currentMult;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const handleCashout = () => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    const win = parseFloat(betAmount) * multiplierRef.current;
    setWinAmount(win);
    setCashoutSuccess(true);
    processResult(win - parseFloat(betAmount), 'Aviator Win');
  };

  const processResult = async (netAmount: number, description: string) => {
    // We don't have a direct game endpoint yet, so we will simulate it by doing nothing 
    // or we can add a dedicated endpoint if we want real balance changes.
    // Since we don't have a user-facing adjust balance, we'll just log it to console for now
    // until we implement a real backend game engine.
    console.log(`Game Result: ${description}. Net: ${netAmount}`);
    alert(`${description}. Net Amount: ${netAmount.toFixed(2)}`);
    refreshUser();
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => onNavigate('games')} className="btn" style={{ padding: '8px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aviator Simulation</h2>
      </div>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '300px', justifyContent: 'center', position: 'relative', overflow: 'hidden', background: '#0a0a0f' }}>
        
        {/* Game Canvas / Display */}
        <div style={{ position: 'absolute', top: '40px', fontSize: '4rem', fontWeight: 900, fontFamily: 'monospace', color: crashed ? 'var(--accent-danger)' : cashoutSuccess ? 'var(--accent-success)' : 'var(--accent-primary)', textShadow: '0 0 20px rgba(0,0,0,0.5)', zIndex: 10 }}>
          {multiplier.toFixed(2)}x
        </div>
        
        <div style={{ transform: `translateY(${crashed ? '100px' : '-20px'}) translateX(${crashed ? '100px' : '20px'}) rotate(${crashed ? '45deg' : '0deg'})`, transition: crashed ? 'all 0.5s ease-in' : 'none', position: 'absolute' }}>
          <Rocket size={64} color={crashed ? 'var(--accent-danger)' : 'var(--accent-primary)'} />
        </div>

        {crashed && <div style={{ position: 'absolute', top: '120px', color: 'var(--accent-danger)', fontWeight: 700, fontSize: '1.5rem', zIndex: 10 }}>FLEW AWAY!</div>}
        {cashoutSuccess && <div style={{ position: 'absolute', top: '120px', color: 'var(--accent-success)', fontWeight: 700, fontSize: '1.5rem', zIndex: 10 }}>YOU WON {winAmount.toFixed(2)}!</div>}
      </div>

      <div className="glass-card" style={{ marginTop: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="input-label">Bet Amount</label>
          <input 
            type="number" 
            className="input-field" 
            value={betAmount} 
            onChange={(e) => setBetAmount(e.target.value)} 
            disabled={isPlaying}
          />
        </div>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'flex-end' }}>
          {!isPlaying ? (
            <button className="btn btn-primary" onClick={startGame} style={{ width: '100%', height: '46px', fontSize: '1.1rem' }}>
              BET
            </button>
          ) : (
            <button className="btn" onClick={handleCashout} style={{ width: '100%', height: '46px', fontSize: '1.1rem', background: 'var(--accent-warning)', color: '#000', border: 'none', fontWeight: 700 }}>
              CASHOUT ({(parseFloat(betAmount) * multiplier).toFixed(2)})
            </button>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        *Note: This is a frontend simulation. A real Aviator game requires a dedicated backend websocket engine to process bets securely and calculate provably fair multipliers.
      </div>
    </div>
  );
};
