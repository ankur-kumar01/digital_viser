import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getToken, gamesAPI, globalConfigAPI } from '../../../api';
import './ColourTradingGame.css';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [5, 10, 20, 50, 100, 200, 500];
const CONFETTI_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const colorMap: Record<string, { bg: string; glow: string; label: string; mult: string }> = {
  green: { bg: '#22c55e', glow: 'rgba(34,197,94,0.35)', label: 'Green', mult: '2×' },
  violet: { bg: '#8b5cf6', glow: 'rgba(139,92,246,0.35)', label: 'Violet', mult: '4.5×' },
  red: { bg: '#ef4444', glow: 'rgba(239,68,68,0.35)', label: 'Red', mult: '2×' },
};

const numberColors: Record<string, string> = {
  '0': 'linear-gradient(135deg, #ef4444 50%, #8b5cf6 50%)', // Red/Violet
  '5': 'linear-gradient(135deg, #22c55e 50%, #8b5cf6 50%)', // Green/Violet
  '1': '#22c55e', '3': '#22c55e', '7': '#22c55e', '9': '#22c55e', // Green
  '2': '#ef4444', '4': '#ef4444', '6': '#ef4444', '8': '#ef4444'  // Red
};

export const ColourTradingGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const [betAmount, setBetAmount] = useState('100');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isBettingPhase, setIsBettingPhase] = useState(true);
  const [resultColor, setResultColor] = useState<string | null>(null);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  
  const [history, setHistory] = useState<{ color: string; period: number; number?: number }[]>([
    { color: 'red', period: 1001, number: 2 }, { color: 'green', period: 1000, number: 7 }, { color: 'red', period: 999, number: 4 },
    { color: 'violet', period: 998, number: 0 }, { color: 'green', period: 997, number: 1 }, { color: 'red', period: 996, number: 8 },
    { color: 'green', period: 995, number: 5 }, { color: 'red', period: 994, number: 6 }, { color: 'violet', period: 993, number: 0 },
    { color: 'green', period: 992, number: 3 },
  ]);
  
  const [periodCount, setPeriodCount] = useState(0);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [winPayout, setWinPayout] = useState(0);
  const [showLoseOverlay, setShowLoseOverlay] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [revealReady, setRevealReady] = useState(false);

  // New states for interactive panels
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [tempSelection, setTempSelection] = useState<string | null>(null);
  const [multiplierVal, setMultiplierVal] = useState(1);
  const [roadmapExpanded, setRoadmapExpanded] = useState(false);
  const [liveBets, setLiveBets] = useState<any[]>([]);
  const [dbBets, setDbBets] = useState<any[]>([]);
  const [poolTotal, setPoolTotal] = useState(18500);
  const [config, setConfig] = useState<any>(null);

  const showLiveBets = config ? config.enable_colour_trading_bet_simulation !== false : false;

  const rouletteItemsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!isBettingPhase) {
      const items = [];
      for (let i = 0; i < 40; i++) {
        items.push(Math.floor(Math.random() * 10).toString());
      }
      rouletteItemsRef.current = items;
    }
  }, [isBettingPhase]);

  useEffect(() => {
    gamesAPI.getColourTradingBets().then(setDbBets).catch(console.error);
    globalConfigAPI.getConfig().then(setConfig).catch(console.error);
  }, []);

  // Sound persisted state toggle
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('av_muted') === 'true';
  });

  const socketRef = useRef<Socket | null>(null);
  const selectedColorRef = useRef<string | null>(null);
  const betAmountRef = useRef<string>('100');

  useEffect(() => {
    selectedColorRef.current = selectedColor;
    betAmountRef.current = betAmount;
  }, [selectedColor, betAmount]);

  useEffect(() => {
    localStorage.setItem('av_muted', isMuted ? 'true' : 'false');
  }, [isMuted]);

  // Synthesized Web Audio API triggers
  const playBeepSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const playWhooshSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 0.35);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch (e) {}
  };

  const playWinSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C major chord arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.32);
      });
    } catch (e) {}
  };

  const playLoseSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.5);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.52);
    } catch (e) {}
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

    socket.on('ct_state', (data) => {
      setPeriodCount(data.periodNumber || 0);
      setTimeLeft(data.timeLeft);
      setHistory(data.history || []);
      setResultNumber(null);
      
      if (data.state === 'BETTING') {
        setIsBettingPhase(true);
        setIsProcessing(false);
        setResultColor(null);
        setSelectedColor(null);
        setRevealReady(false);
      } else if (data.state === 'PROCESSING') {
        setIsBettingPhase(false);
        setIsProcessing(true);
      }
    });

    socket.on('ct_timer', (data) => {
      setTimeLeft(data.timeLeft);
      if (data.timeLeft <= 0) {
        setIsProcessing(true);
        setIsBettingPhase(false);
      }
    });

    socket.on('ct_result', (data) => {
      setPeriodCount(data.periodNumber);
      setResultColor(data.resultColor);
      setResultNumber(data.resultNumber);
      setHistory(data.history);
      
      setIsProcessing(true);
      setTimeout(() => {
        setRevealReady(true);
        playWhooshSound(); // Play reveal sound
      }, 900);

      // Check user results mapping color/numbers
      const currentSelectedColor = selectedColorRef.current;
      const currentBetAmount = betAmountRef.current;
      
      if (currentSelectedColor) {
        const finalNum = data.resultNumber;
        const select = currentSelectedColor;
        let isWin = false;
        
        if (select === finalNum.toString()) {
          isWin = true;
        } else if (select === 'red' && ([2, 4, 6, 8].includes(finalNum) || finalNum === 0)) {
          isWin = true;
        } else if (select === 'green' && ([1, 3, 7, 9].includes(finalNum) || finalNum === 5)) {
          isWin = true;
        } else if (select === 'violet' && (finalNum === 0 || finalNum === 5)) {
          isWin = true;
        }
        
        if (isWin) {
          let mult = 2;
          if (select === finalNum.toString()) mult = 9;
          else if (select === 'violet') mult = 4.5;
          else if (select === 'red' && finalNum === 0) mult = 1.5;
          else if (select === 'green' && finalNum === 5) mult = 1.5;
          
          const payout = parseFloat(currentBetAmount) * mult;
          setWinPayout(payout);
          
          setTimeout(() => {
            setShowWinOverlay(true);
            playWinSound();
          }, 1600);
          setTimeout(() => setShowWinOverlay(false), 5800);
        } else {
          setTimeout(() => {
            setShowLoseOverlay(true);
            playLoseSound();
          }, 1600);
          setTimeout(() => setShowLoseOverlay(false), 4400);
        }
        refreshUser();
      }
      
      setTimeout(() => setIsProcessing(false), 3000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Timer warning sounds
  useEffect(() => {
    if (isBettingPhase && timeLeft <= 5 && timeLeft > 0) {
      playBeepSound();
    }
  }, [timeLeft, isBettingPhase]);

  // Simulated live multiplayer bets loop
  useEffect(() => {
    if (!isBettingPhase) return;
    if (!config || config.enable_colour_trading_bet_simulation === false) return;
    
    const interval = setInterval(() => {
      let randomName = '';
      let randomChoice = '';
      let randomAmount = 0;

      if (dbBets.length > 0) {
        const randomBet = dbBets[Math.floor(Math.random() * dbBets.length)];
        randomName = randomBet.user_name;
        randomChoice = randomBet.color_choice;
        randomAmount = randomBet.bet_amount;
      } else {
        const names = ['Rahul88', 'Priya_M', 'AmanK', 'Raj_007', 'NehaS', 'Vikas12', 'Simran_X', 'AmitB', 'Vijay_Pro', 'SoniaK'];
        const choices = ['green', 'red', 'violet', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        const amounts = [10, 50, 100, 200, 500, 1000];
        
        randomName = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
        randomChoice = choices[Math.floor(Math.random() * choices.length)];
        randomAmount = amounts[Math.floor(Math.random() * amounts.length)];
      }
      
      setLiveBets(prev => [
        {
          id: Math.random().toString(),
          name: randomName,
          choice: randomChoice,
          amount: randomAmount
        },
        ...prev
      ].slice(0, 5));
      
      setPoolTotal(prev => prev + randomAmount);
    }, 1100 + Math.random() * 900);
    
    return () => clearInterval(interval);
  }, [isBettingPhase, dbBets]);

  // Reset simulated pool on new round starting
  useEffect(() => {
    if (isBettingPhase) {
      setPoolTotal(Math.floor(15000 + Math.random() * 8000));
      setLiveBets([]);
    }
  }, [isBettingPhase]);

  const handleBetClick = (select: string) => {
    if (!isBettingPhase || selectedColor !== null) return;
    setTempSelection(select);
    setMultiplierVal(1);
    setBetSlipOpen(true);
  };

  const handleBetConfirm = () => {
    if (!tempSelection) return;
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return alert('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return alert('Insufficient balance');

    socketRef.current?.emit('ct_bet', { amount: bet, color: tempSelection }, (res: any) => {
      if (res.error) return alert(res.error);
      setSelectedColor(tempSelection);
      setBetSlipOpen(false);
      refreshUser();
      playWhooshSound();
    });
  };

  // Roadmap Statistics Calculation
  const getStats = () => {
    const total = history.length;
    if (total === 0) return { red: 33, green: 33, violet: 34 };
    
    let redCount = 0;
    let greenCount = 0;
    let violetCount = 0;
    
    history.forEach(h => {
      if (h.color === 'red') redCount++;
      else if (h.color === 'green') greenCount++;
      else if (h.color === 'violet') violetCount++;
    });
    
    return {
      red: Math.round((redCount / total) * 100),
      green: Math.round((greenCount / total) * 100),
      violet: Math.round((violetCount / total) * 100)
    };
  };

  const stats = getStats();
  const timerPercent = isBettingPhase ? (timeLeft / 25) * 100 : (timeLeft / 5) * 100;
  const timerUrgent = isBettingPhase && timeLeft <= 5;
  const ringStroke = timerUrgent ? '#ef4444' : isBettingPhase ? '#22c55e' : '#f59e0b';
  const circumference = 2 * Math.PI * 32;

  return (
    <div className="ct-container fade-in">
      {/* Header */}
      <div className="ct-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => onNavigate('games')} className="ct-back-btn">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="ct-title">Colour Trading</h2>
            <p className="ct-subtitle">Predict the color or number & win big!</p>
          </div>
        </div>

        {/* Persisted speaker mute toggle */}
        <button className="ct-audio-btn" onClick={() => setIsMuted(prev => !prev)}>
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Collapsible Trend Roadmap Grid & Stats */}
      <div className="ct-roadmap-panel">
        <button 
          className="ct-roadmap-toggle"
          onClick={() => setRoadmapExpanded(prev => !prev)}
        >
          <span>📊 Real-Time Charts & Trend Roadmap</span>
          <span style={{ fontSize: '0.75rem' }}>{roadmapExpanded ? '▲ Hide' : '▼ View'}</span>
        </button>
        
        {roadmapExpanded && (
          <div className="ct-roadmap-content fade-in">
            {/* Stats bars */}
            <div className="ct-stats-bars">
              <div className="ct-stat-bar-row">
                <span className="ct-stat-bar-label green">Green ({stats.green}%)</span>
                <div className="ct-stat-bar-outer">
                  <div className="ct-stat-bar-inner green" style={{ width: `${stats.green}%` }} />
                </div>
              </div>
              <div className="ct-stat-bar-row">
                <span className="ct-stat-bar-label red">Red ({stats.red}%)</span>
                <div className="ct-stat-bar-outer">
                  <div className="ct-stat-bar-inner red" style={{ width: `${stats.red}%` }} />
                </div>
              </div>
              <div className="ct-stat-bar-row">
                <span className="ct-stat-bar-label violet">Violet ({stats.violet}%)</span>
                <div className="ct-stat-bar-outer">
                  <div className="ct-stat-bar-inner violet" style={{ width: `${stats.violet}%` }} />
                </div>
              </div>
            </div>

            <div className="ct-roadmap-info-text">Baccarat Bead Road (Chronological grid from left to right)</div>
            
            {/* Scrollable grid */}
            <div className="ct-roadmap-grid">
              {[...history].reverse().slice(0, 60).reverse().map((h, i) => (
                <div 
                  key={i} 
                  className="ct-roadmap-dot"
                  style={{ 
                    background: h.number != null ? numberColors[h.number.toString()] : colorMap[h.color]?.bg 
                  }}
                >
                  {h.number != null ? h.number : (h.color ? h.color[0].toUpperCase() : '')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History Strip */}
      <div className="ct-history-strip">
        {history.map((h, i) => (
          <div 
            key={i} 
            className="ct-history-dot" 
            style={{ background: h.number != null ? numberColors[h.number.toString()] : colorMap[h.color]?.bg }}
          >
            {h.number != null ? h.number : (h.color ? h.color[0].toUpperCase() : '')}
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
            {isBettingPhase ? (timerUrgent ? '⚡ Hurry! Time running out!' : 'Pick a color or number') : 'Next round starting soon...'}
          </div>
        </div>
      </div>

      {/* Result Display / Cinematic Roulette Reveal */}
      {!isBettingPhase && (
        <div className="ct-result-section">
          <div className="ct-result-label">
            {!revealReady ? 'Drawing Result...' : 'Winning Result'}
          </div>
          
          <div className="ct-roulette-container">
            <div className={`ct-roulette-strip ${revealReady ? 'stopped' : 'spinning'}`}>
              {rouletteItemsRef.current.map((dummyNum, i) => {
                const isWinningOrb = i === 39;
                
                let renderNum: string | number = dummyNum;
                let renderColor = dummyNum === '0' || dummyNum === '5' ? 'violet' : (parseInt(dummyNum) % 2 === 0 ? 'red' : 'green');
                
                if (isWinningOrb && resultColor && resultNumber !== null) {
                  renderNum = resultNumber;
                  renderColor = resultColor;
                } else if (isWinningOrb && resultColor) {
                  renderNum = resultColor.toUpperCase()[0];
                  renderColor = resultColor;
                }
                
                const showWinningState = revealReady && isWinningOrb;

                return (
                  <div
                    key={i}
                    className={`ct-result-orb ${showWinningState ? 'winner reveal' : ''}`}
                    style={{
                      background: typeof renderNum === 'number' || !isNaN(parseInt(renderNum as string)) ? numberColors[renderNum.toString()] : colorMap[renderColor]?.bg,
                      boxShadow: showWinningState ? `0 0 40px ${colorMap[renderColor]?.glow}, 0 0 80px ${colorMap[renderColor]?.glow}` : 'none',
                      opacity: showWinningState || !revealReady ? 1 : 0.3
                    }}
                  >
                    {renderNum}
                  </div>
                );
              })}
            </div>
            <div className="ct-roulette-cursor"></div>
          </div>
          
          {revealReady && resultColor && (
            <div className="ct-result-name fade-in" style={{ color: colorMap[resultColor]?.bg }}>
              {colorMap[resultColor]?.label} {resultNumber !== null ? `(Number ${resultNumber})` : ''}
            </div>
          )}
        </div>
      )}

      {/* Color Selection */}
      {isBettingPhase && (
        <>
          <div className="ct-color-buttons">
            {(['green', 'violet', 'red'] as const).map(color => {
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  className={`ct-color-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleBetClick(color)}
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

          {/* 0-9 Numbers Betting Grid */}
          <div className="ct-number-section">
            <div className="ct-number-label">Select Number (9x Payout)</div>
            <div className="ct-numbers-grid">
              {NUMBERS.map(num => {
                const isSelected = selectedColor === num;
                return (
                  <button
                    key={num}
                    className={`ct-number-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleBetClick(num)}
                    style={{
                      background: numberColors[num],
                      opacity: selectedColor !== null && !isSelected ? 0.5 : 1,
                      cursor: selectedColor !== null ? 'not-allowed' : 'pointer'
                    }}
                    disabled={selectedColor !== null}
                  >
                    <span className="ct-number-val">{num}</span>
                    <span className="ct-number-odds">9x</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Simulated Multiplayer Live Bets Ticker */}
          {showLiveBets && (
            <div className="ct-live-wagers-panel">
              <div className="ct-live-wagers-header">
                <span>👥 Live Wagers Pool</span>
                <span className="ct-live-pool-total">Total Wagered: ₹{poolTotal.toLocaleString()}</span>
              </div>
              
              <div className="ct-live-wagers-feed">
                {liveBets.map((bet) => (
                  <div key={bet.id} className="ct-live-wager-row fade-in">
                    <span className="ct-wager-user">👤 {bet.name}</span>
                    <span className="ct-wager-choice">
                      placed on{' '}
                      <span 
                        className="ct-wager-choice-badge"
                        style={{ 
                          background: isNaN(parseInt(bet.choice)) ? colorMap[bet.choice]?.bg : numberColors[bet.choice]
                        }}
                      >
                        {isNaN(parseInt(bet.choice)) ? colorMap[bet.choice]?.label : `Number ${bet.choice}`}
                      </span>
                    </span>
                    <span className="ct-wager-amount">₹{bet.amount}</span>
                  </div>
                ))}
                {liveBets.length === 0 && (
                  <div className="ct-wagers-waiting">Waiting for new wagers...</div>
                )}
              </div>
            </div>
          )}

          {/* Bet Confirmation static card */}
          {selectedColor && (
            <div className="ct-bet-confirm" style={{
              background: isNaN(parseInt(selectedColor)) ? `${colorMap[selectedColor].bg}12` : `${numberColors[selectedColor]}12`,
              border: isNaN(parseInt(selectedColor)) ? `2px solid ${colorMap[selectedColor].bg}` : `2px solid ${selectedColor === '0' || selectedColor === '5' ? '#8b5cf6' : numberColors[selectedColor]}`,
            }}>
              Wagered ₹{betAmount} on <span style={{ color: isNaN(parseInt(selectedColor)) ? colorMap[selectedColor].bg : '#fff', fontWeight: 800 }}>{isNaN(parseInt(selectedColor)) ? colorMap[selectedColor].label : `Number ${selectedColor}`}</span>
            </div>
          )}
        </>
      )}

      {/* Balance */}
      <div className="ct-balance">
        Balance: <span>₹{parseFloat(user.balance).toFixed(2)}</span>
      </div>

      {/* Slide-Up Bottom Bet Slip Drawer */}
      {betSlipOpen && tempSelection && (
        <div className="ct-drawer-overlay" onClick={() => setBetSlipOpen(false)}>
          <div className="ct-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ct-drawer-header">
              <div className="ct-drawer-handle" />
              <h3 className="ct-drawer-title">Bet Slip Wager</h3>
              <button className="ct-drawer-close" onClick={() => setBetSlipOpen(false)}>✕</button>
            </div>
            
            <div className="ct-drawer-content">
              <div className="ct-drawer-selection-row">
                <span className="ct-drawer-field-name">Your Selection:</span>
                <span 
                  className="ct-drawer-selection-badge"
                  style={{
                    background: isNaN(parseInt(tempSelection)) ? colorMap[tempSelection]?.bg : numberColors[tempSelection]
                  }}
                >
                  {isNaN(parseInt(tempSelection)) ? colorMap[tempSelection]?.label : `Number ${tempSelection}`}
                </span>
              </div>
              
              <div className="ct-drawer-multiplier-row">
                <span className="ct-drawer-field-name">Quick Multiplier:</span>
                <div className="ct-drawer-multipliers">
                  {[1, 5, 10, 50].map((mult) => (
                    <button 
                      key={mult}
                      type="button"
                      className={`ct-drawer-mult-btn ${multiplierVal === mult ? 'active' : ''}`}
                      onClick={() => {
                        setMultiplierVal(mult);
                        const baseAmt = [5, 10, 20, 50, 100, 200, 500].includes(parseFloat(betAmount) / multiplierVal)
                          ? (parseFloat(betAmount) / multiplierVal).toString()
                          : '10';
                        setBetAmount((parseFloat(baseAmt) * mult).toString());
                      }}
                    >
                      {mult}×
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="ct-bet-section" style={{ background: 'transparent', border: 'none', padding: 0, marginTop: '16px' }}>
                <div className="ct-bet-label" style={{ margin: 0, marginBottom: '8px' }}>Wager Amount (₹)</div>
                <div className="ct-bet-input-wrap">
                  <button className="ct-bet-step-btn" onClick={() => setBetAmount(Math.max(5, parseFloat(betAmount) - 5 * multiplierVal).toString())}>-</button>
                  <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} />
                  <button className="ct-bet-step-btn" onClick={() => setBetAmount((parseFloat(betAmount) + 5 * multiplierVal).toString())}>+</button>
                </div>
                <div className="ct-quick-bets">
                  {QUICK_BETS.map(q => (
                    <button key={q} className={`ct-quick-btn ${betAmount === (q * multiplierVal).toString() ? 'active' : ''}`} onClick={() => setBetAmount((q * multiplierVal).toString())}>
                      ₹{q * multiplierVal}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="ct-drawer-total-row">
                <span>Total Bet Wager:</span>
                <span className="ct-drawer-total-val">₹{parseFloat(betAmount).toFixed(2)}</span>
              </div>
              
              <button 
                className="ct-drawer-confirm-btn"
                onClick={handleBetConfirm}
                disabled={parseFloat(betAmount) <= 0 || parseFloat(betAmount) > parseFloat(user.balance)}
                style={{
                  background: isNaN(parseInt(tempSelection)) ? colorMap[tempSelection]?.bg : (tempSelection === '0' || tempSelection === '5' ? '#8b5cf6' : numberColors[tempSelection])
                }}
              >
                Confirm Bet — ₹{parseFloat(betAmount).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div style={{ 
              fontSize: '4.2rem', 
              fontWeight: 900, 
              lineHeight: 1.1, 
              fontFamily: "'SF Mono','Fira Code',Monaco,monospace",
              background: 'linear-gradient(to bottom, #ffffff 0%, #a7f3d0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 15px rgba(34, 197, 94, 0.5))'
            }}>
              ₹{winPayout.toFixed(2)}
            </div>
            <div style={{ fontSize: '1.1rem', color: '#a7f3d0', marginTop: '10px', fontWeight: 600 }}>
              on {selectedColor ? (isNaN(parseInt(selectedColor)) ? colorMap[selectedColor]?.label : `Number ${selectedColor}`) : ''}
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
              Result was <span style={{ color: resultColor ? colorMap[resultColor]?.bg : '#fff', fontWeight: 800 }}>
                {resultColor ? colorMap[resultColor]?.label : ''} {resultNumber !== null ? `(Number ${resultNumber})` : ''}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
};
