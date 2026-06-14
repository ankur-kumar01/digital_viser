import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Rocket } from 'lucide-react';
import { gamesAPI } from '../../api';

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

    try {
      await gamesAPI.aviatorBet(bet);
      refreshUser(); // Update balance immediately after bet
    } catch (err: any) {
      return alert(err.message || 'Failed to place bet');
    }

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
        // Process Loss (deduct bet already done initially)
        refreshUser();
        return;
      }

      setMultiplier(currentMult);
      multiplierRef.current = currentMult;
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
      alert(`Aviator Win! Net Amount: ${(win - parseFloat(betAmount)).toFixed(2)}`);
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'Failed to process cashout');
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => onNavigate('games')} className="btn" style={{ padding: '8px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Aviator Simulator</h2>
      </div>

      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '350px', justifyContent: 'center', position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at top, #1a1a2e 0%, #0f0f1a 80%, #05050a 100%)', border: '1px solid var(--border-glass)', boxShadow: '0 10px 40px rgba(0,0,0,0.5) inset' }}>
        
        {/* Starry Background Effect */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px', animation: isPlaying ? 'slideDown 2s linear infinite' : 'none' }}></div>
        <style>{`
          @keyframes slideDown { from { background-position: 0 0; } to { background-position: -30px 30px; } }
          @keyframes pulseScale { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        `}</style>

        {/* Game Canvas / Display */}
        <div style={{ position: 'absolute', top: '50px', fontSize: '5rem', fontWeight: 900, fontFamily: 'monospace', color: crashed ? 'var(--accent-danger)' : cashoutSuccess ? 'var(--accent-success)' : 'var(--accent-primary)', textShadow: crashed ? '0 0 30px var(--accent-danger)' : cashoutSuccess ? '0 0 30px var(--accent-success)' : '0 0 40px var(--accent-primary)', zIndex: 10, animation: isPlaying && !crashed ? 'pulseScale 1s ease-in-out infinite' : 'none' }}>
          {multiplier.toFixed(2)}x
        </div>
        
        {/* Rocket Animation */}
        <div style={{ 
          transform: `translateY(${crashed ? '150px' : isPlaying ? '-40px' : '0px'}) translateX(${crashed ? '100px' : isPlaying ? '40px' : '0px'}) rotate(${crashed ? '75deg' : isPlaying ? '15deg' : '0deg'}) scale(${crashed ? 0.8 : 1.2})`, 
          transition: crashed ? 'all 0.6s cubic-bezier(0.5, 0, 1, 0.5)' : isPlaying ? 'all 2s ease-out' : 'all 0.5s ease', 
          position: 'absolute',
          filter: crashed ? 'grayscale(100%) brightness(0.5)' : 'drop-shadow(0 0 20px var(--accent-primary))'
        }}>
          <Rocket size={80} color={crashed ? '#ef4444' : '#3b82f6'} style={{ transform: 'rotate(45deg)' }} />
        </div>

        {crashed && <div style={{ position: 'absolute', bottom: '60px', color: '#fff', background: 'var(--accent-danger)', padding: '8px 24px', borderRadius: '30px', fontWeight: 800, fontSize: '1.2rem', zIndex: 10, letterSpacing: '2px', boxShadow: '0 0 20px var(--accent-danger)' }}>FLEW AWAY</div>}
        {cashoutSuccess && <div style={{ position: 'absolute', bottom: '60px', color: '#000', background: 'var(--accent-success)', padding: '8px 24px', borderRadius: '30px', fontWeight: 800, fontSize: '1.2rem', zIndex: 10, letterSpacing: '1px', boxShadow: '0 0 20px var(--accent-success)' }}>CASHOUT SUCCESS!</div>}
      </div>

      <div className="glass-card" style={{ marginTop: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-card)' }}>
        <div style={{ flex: '1 1 250px' }}>
          <label className="input-label">Bet Amount (₹)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) - 10).toString())} className="btn" style={{ width: '46px', height: '46px', background: 'var(--bg-tertiary)' }} disabled={isPlaying}>-</button>
            <input 
              type="number" 
              className="input-field" 
              value={betAmount} 
              onChange={(e) => setBetAmount(e.target.value)} 
              disabled={isPlaying}
              style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}
            />
            <button onClick={() => setBetAmount((parseFloat(betAmount) + 10).toString())} className="btn" style={{ width: '46px', height: '46px', background: 'var(--bg-tertiary)' }} disabled={isPlaying}>+</button>
          </div>
        </div>
        <div style={{ flex: '1 1 250px', display: 'flex', alignItems: 'flex-end' }}>
          {!isPlaying ? (
            <button className="btn" onClick={startGame} style={{ width: '100%', height: '54px', fontSize: '1.2rem', background: 'var(--accent-primary)', color: '#fff', fontWeight: 800, letterSpacing: '1px', boxShadow: '0 0 20px var(--accent-primary-glow)' }}>
              PLACE BET
            </button>
          ) : (
            <button className="btn" onClick={handleCashout} style={{ width: '100%', height: '54px', fontSize: '1.2rem', background: '#f59e0b', color: '#000', border: 'none', fontWeight: 800, letterSpacing: '1px', boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)' }}>
              CASHOUT (₹{(parseFloat(betAmount) * multiplier).toFixed(2)})
            </button>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        *Note: This is a frontend simulation. Real Aviator logic requires a dedicated backend tick engine.
      </div>
    </div>
  );
};
