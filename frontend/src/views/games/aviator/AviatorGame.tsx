import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getToken, gamesAPI } from '../../../api';
import './AviatorGame.css';

const PLANE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="%23ef4444" d="M10,32 Q20,20 40,24 L60,28 Q62,29 62,32 Q62,35 60,36 L40,40 Q20,44 10,32 Z"/><path fill="%23b91c1c" d="M25,26 L15,10 L25,10 L35,25 Z M25,38 L15,54 L25,54 L35,39 Z"/><path fill="%23fca5a5" d="M55,30 L60,32 L55,34 Z"/><circle cx="50" cy="32" r="4" fill="%2360a5fa"/></svg>`;
const CRASH_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="%23f97316" d="M32,5 L38,20 L55,15 L45,30 L60,40 L45,45 L50,60 L38,50 L32,60 L26,50 L14,60 L19,45 L4,40 L19,30 L9,15 L26,20 Z"/><path fill="%23fef08a" d="M32,20 L35,28 L45,25 L38,32 L48,40 L38,38 L40,48 L32,40 L24,48 L26,38 L16,40 L26,32 L19,25 L29,28 Z"/></svg>`;

const planeImg = new Image();
planeImg.src = PLANE_SVG;
const crashImg = new Image();
crashImg.src = CRASH_SVG;

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_BETS = [5, 10, 20, 50, 100, 200, 500];
const CONFETTI_COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const BOT_USERNAMES = [
  'AviatorKing', 'Sanjay_99', 'RocketGirl', 'MaxBet_Pro', 'LuckyPriya', 
  'Challenger', 'FlightPro', 'WinSeeker', 'StormRider', 'HyperFlyer', 
  'RedLine', 'RiskTaker77', 'Amit_Aviator', 'Anya_Singh', 'GamerBoy9',
  'Rahul_Kumar', 'Priya_Sharma', 'Sunil_Rider', 'Vijay_143', 'Karan_Bet',
  'Riya_Roy', 'Deepak_Flyer', 'Sachin_King', 'Arjun_999', 'Anjali_Fly',
  'Rohan_Pro', 'Aditya_Aviator', 'Sneha_Jet', 'Vikram_Risk', 'Pooja_Lucky'
];

const LOBBY_CHAT_PHRASES = [
  "bhai log, is baar flying high jayega 🚀",
  "next round pakka 3x paar!",
  "is baar toh 500 rs laga raha hu 💸",
  "auto cashout 2.0x pe set kar diya",
  "chalo shuru karte hai!",
  "kya lagta hai dosto, is baar kitna jayega?",
  "ready for takeoff! 🚀",
  "let's go 5x this round",
  "bhai log taiyaar ho jao badhiya profit ke liye!",
  "pichla round jaldi crash hua, ab lamba chalega",
  "chalo sab log ready ho jao",
  "mere pass balance kam hai, is baar safe khelunga",
  "bhai koi trick batao winning ki?",
  "kuch toh bada hone wala hai",
  "putting 200 ₹ this time",
  "last round was quick, hope this one stays longer",
  "sab all in mat karna dosto",
  "kya mast chal raha hai game"
];

const FLIGHT_CHAT_PHRASES = [
  "bhai hold karo hold karo! ✈️",
  "2x hogya, jaldi niklo sab!",
  "arre wah! 4x paar ho gaya 📈",
  "fly high baby, to the moon! 🚀",
  "bhai kaun kaun abhi tak hold kar raha hai?",
  "cashed out! safe khelna zaroori hai bhai",
  "ye plane toh rukne ka naam nahi le raha!",
  "looking good! keep flying ✈️",
  "cashout guys! 2x is good",
  "OMG 4x already!! 📈",
  "holding tight...",
  "bhai ye toh 10x jayega lagta hai",
  "arre yaar, mai nikal gaya, abhi tak fly kar raha hai!",
  "o bhai sahab! kya run hai",
  "chalo chalo profit book karo!",
  "kya baat hai, maza aa gaya!",
  "mera target 5x hai, ruko thoda",
  "nikal lo sab log, crash hone wala hai",
  "ab rocket ban gaya plane!",
  "who is still in?"
];

const CRASH_LOW_PHRASES = [
  "kya yaar, ye toh shuru hote hi khatam ho gaya 😭",
  "dhoka ho gaya bhai!",
  "1.1x pe crash? bahut bekaar",
  "kismat hi kharab hai aaj toh",
  "kya bekaar start tha yaar",
  "loot gaye sab ke sab!",
  "oof, terrible crash",
  "why so early??",
  "ouch! 1.1x is brutal",
  "flew away instantly 😭",
  "aree yaar, screen click hi nahi hui time pe",
  "paise doob gaye is baar",
  "yeh kya mazaak hai bhaaya",
  "chota nuksan hogya, agle round me dekhnge",
  "mood kharab kar diya is round ne",
  "koi baat nahi, recovery karenge",
  "scary start",
  "lag gaye lode 😭"
];

const CRASH_MED_PHRASES = [
  "bach gaye, 2.2x pe cashout kiya 🎯",
  "phew! thoda profit toh mila",
  "ek second late ho gaya varna 3x milta!",
  "auto cashout ne bacha liya aaj",
  "thik hai, agle round me cover karenge",
  "decent run tha, par aur hold kar sakta tha",
  "phew, cashed out at 2.1x",
  "not bad, got a decent profit",
  "saved by auto cashout",
  "fair enough, next round",
  "chalo profit toh hua kam se kam",
  "3x pe nikala mai toh, badiya tha",
  "bhai thoda aur wait kar leta toh maza aata",
  "loss se toh bache kam se kam",
  "dheere dheere balance badh raha hai",
  "nice run, sabne profit banaya na?",
  "mera 2.5x check karo!",
  "kuch toh mila boss"
];

const CRASH_HIGH_PHRASES = [
  "baap re! 15x chala gaya 🚀",
  "kya khatarnak run tha bhai!",
  "kis kis ne bada payout uthaya?",
  "maza aa gaya is round me!",
  "thoda aur hold karta toh nikal jati lottery 😂",
  "gazab run tha yaar, historical!",
  "WOW! 15x is huge!!",
  "what an insane run 🚀",
  "amazing round!",
  "should have held longer",
  "meri toh kismat chamak gayi aaj 💎",
  "bhai 10x pe auto cashout hit ho gaya!",
  "kya mast jack pot laga hai!",
  "is baar sab ameer ban gaye",
  "chappar faad ke paisa mila!",
  "that was legendary!",
  "kash mai thoda aur rukta",
  "sach me maza aa gaya, super hit run!"
];

const getUserColor = (username: string) => {
  if (username === 'You' || username === 'System') return 'var(--accent-primary)';
  const colors = [
    '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', 
    '#f43f5e', '#06b6d4', '#14b8a6', '#a855f7', '#fb923c'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

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
  const [dbChats, setDbChats] = useState<any[]>([]);
  const [dbBets, setDbBets] = useState<any[]>([]);

  useEffect(() => {
    gamesAPI.getAviatorChats().then(setDbChats).catch(console.error);
    gamesAPI.getAviatorBets().then(setDbBets).catch(console.error);
  }, []);

  // Mobile drawer, toast, and cashout lock states
  const [toast, setToast] = useState<string | null>(null);
  const [isCashoutLoading, setIsCashoutLoading] = useState(false);
  const isCashoutLoadingRef = useRef(false);

  // Tabs & Live Chat states
  const [activeTab, setActiveTab] = useState<'players' | 'chat'>('players');
  const [userMessage, setUserMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>(() => {
    const initial = [];
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const msgTime = new Date(now.getTime() - i * 60000);
      const timeStr = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const botUser = BOT_USERNAMES[i % BOT_USERNAMES.length];
      
      let text = '';
      if (i === 4) text = "Welcome to Aviator Live Chat! ✈️ Please keep it friendly.";
      else if (i === 3) text = "last round was crazy, did anyone hold till 10x?";
      else if (i === 2) text = "cashed out too early last time, playing safe now.";
      else if (i === 1) text = "let's go guys!";
      else text = "Next round looks promising!";
      
      initial.push({
        id: `init-${i}`,
        username: i === 4 ? 'System' : botUser,
        text,
        time: timeStr,
        type: i === 4 ? 'system' : 'bot'
      });
    }
    return initial;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatTimeoutsRef = useRef<any[]>([]);
  const commentedMilestonesRef = useRef<Record<number, boolean>>({});

  const clearChatTimeouts = () => {
    chatTimeoutsRef.current.forEach(t => clearTimeout(t));
    chatTimeoutsRef.current = [];
  };

  const addSimulatedChatMessage = useCallback((phraseType: 'WAITING' | 'FLYING' | 'CRASH_LOW' | 'CRASH_MED' | 'CRASH_HIGH') => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Use DB data if available, fallback to hardcoded
    let text = '';
    let botUser = '';
    
    const dbPhrases = dbChats.filter(c => c.message_type === phraseType);
    if (dbPhrases.length > 0) {
      const randomChat = dbPhrases[Math.floor(Math.random() * dbPhrases.length)];
      text = randomChat.message_text;
      botUser = randomChat.user_name;
    } else {
      botUser = BOT_USERNAMES[Math.floor(Math.random() * BOT_USERNAMES.length)];
      let phrases: string[] = [];
      if (phraseType === 'WAITING') phrases = LOBBY_CHAT_PHRASES;
      else if (phraseType === 'FLYING') phrases = FLIGHT_CHAT_PHRASES;
      else if (phraseType === 'CRASH_LOW') phrases = CRASH_LOW_PHRASES;
      else if (phraseType === 'CRASH_MED') phrases = CRASH_MED_PHRASES;
      else if (phraseType === 'CRASH_HIGH') phrases = CRASH_HIGH_PHRASES;
      text = phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    setChatMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        username: botUser,
        text,
        time: timeStr,
        type: 'bot'
      }
    ].slice(-50));
  }, [dbChats]);

  const scheduleFlyingComments = useCallback(() => {
    if (gameStateRef.current !== 'FLYING') return;
    const delay = 1500 + Math.random() * 2000; // 1.5s to 3.5s
    const t = setTimeout(() => {
      if (gameStateRef.current === 'FLYING') {
        addSimulatedChatMessage('FLYING');
        scheduleFlyingComments();
      }
    }, delay);
    chatTimeoutsRef.current.push(t);
  }, [addSimulatedChatMessage]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userMessage.trim()) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newUserMsg = {
      id: Math.random().toString(36).substring(2, 9),
      username: user?.name || 'You',
      text: userMessage.trim(),
      time: timeStr,
      type: 'user'
    };
    
    setChatMessages(prev => [...prev, newUserMsg].slice(-50));
    setUserMessage('');
    
    // Auto bot response chance
    if (Math.random() < 0.6) {
      const replyDelay = 1000 + Math.random() * 1500;
      const t = setTimeout(() => {
        const botUser = BOT_USERNAMES[Math.floor(Math.random() * BOT_USERNAMES.length)];
        const botReplies = [
          `sahi baat hai bhai!`,
          `agree with that! 👍`,
          `is baar sath me jeetenge dosto`,
          `haahaha bilkul sahi bola!`,
          `nice! 👍`,
          `full support hai bhai ko`,
          `kya lagta hai next round fly karega?`,
          `yes bro! absolutely!`,
          `good luck sabko 🤞`,
          `dekhte hai is baar kya hota hai`
        ];
        const text = botReplies[Math.floor(Math.random() * botReplies.length)];
        
        setChatMessages(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            username: botUser,
            text,
            time: timeStr,
            type: 'bot'
          }
        ].slice(-50));
      }, replyDelay);
      chatTimeoutsRef.current.push(t);
    }
  };

  // Scroll chat messages to bottom on updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(prev => prev === msg ? null : prev);
    }, 3000);
  }, []);

  // Audio state & synthesized Web Audio API sound effects
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('av_muted') === 'true';
  });
  const isMutedRef = useRef(isMuted);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineOscRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playCashoutSound = () => {
    if (isMutedRef.current) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (major chord arpeggio)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.20, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  };

  const playCrashSound = () => {
    if (isMutedRef.current) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    
    // Low rumble oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(8, now + 0.65);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);

    // Filtered noise for explosion hissing
    const bufferSize = ctx.sampleRate * 0.85;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(20, now + 0.85);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + 0.85);
  };

  const startEngineSound = () => {
    if (isMutedRef.current) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    stopEngineSound();
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(65, now); // deep engine hum
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    
    engineOscRef.current = osc;
    engineGainRef.current = gain;
  };

  const updateEnginePitch = (mult: number) => {
    if (isMutedRef.current || !engineOscRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const targetFreq = Math.min(270, 65 + (mult - 1) * 30);
    engineOscRef.current.frequency.setTargetAtTime(targetFreq, now, 0.15);
  };

  const stopEngineSound = () => {
    const osc = engineOscRef.current;
    const gain = engineGainRef.current;
    const ctx = audioCtxRef.current;
    
    if (osc && gain && ctx) {
      const now = ctx.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
            gain.disconnect();
          } catch (e) {}
        }, 180);
      } catch (e) {}
    }
    
    engineOscRef.current = null;
    engineGainRef.current = null;
  };

  const playTickSound = () => {
    if (isMutedRef.current) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.06);
  };

  useEffect(() => {
    isMutedRef.current = isMuted;
    localStorage.setItem('av_muted', isMuted ? 'true' : 'false');
    if (isMuted) {
      stopEngineSound();
    } else if (gameState === 'FLYING') {
      startEngineSound();
    }
  }, [isMuted, gameState]);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const startTimeRef = useRef<number>(0);
  const gameStateRef = useRef<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const crashPointRef = useRef<number>(1.0);
  const multiplierRef = useRef<number>(1.0);
  
  const hasActiveBetRef = useRef(false);
  const cashoutSuccessRef = useRef(false);
  const autoCashoutRef = useRef(false);
  const autoCashoutMultRef = useRef(2.0);
  const serverTimeOffsetRef = useRef<number>(0);

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

    // 3. Dynamic Grid Lines & Axis
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    
    const pad = 30;
    const maxTime = Math.max(elapsed, 3);
    const maxMult = Math.max(mult * 1.2, 2.5);

    // Draw X-axis (Time)
    const timeSteps = Math.ceil(maxTime / 5) * 5; 
    const timeInterval = timeSteps / 5;
    for (let i = 0; i <= 5; i++) {
      const t = i * timeInterval;
      if (t === 0) continue;
      const x = pad + ((w - pad * 2) * (t / maxTime));
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h - pad); ctx.stroke();
      ctx.fillText(`${t}s`, x - 8, h - pad + 15);
    }

    // Draw Y-axis (Multiplier)
    const multSteps = Math.ceil(maxMult);
    const multInterval = Math.max(1, Math.floor(multSteps / 4));
    for (let i = 1; i <= Math.ceil(maxMult / multInterval); i++) {
      const m = 1 + i * multInterval;
      if (m > maxMult) continue;
      const y = h - pad - ((h - pad * 2) * ((m - 1) / (maxMult - 1)));
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillText(`${m}x`, pad - 25, y + 4);
    }

    if (elapsed <= 0 && !didCrash) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }

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
    if (didCrash) {
      ctx.drawImage(crashImg, tipX - 20, tipY - 20, 40, 40);
    } else {
      // Glow dot at tip
      const dotGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 14);
      dotGrad.addColorStop(0, 'rgba(34,197,94,0.4)');
      dotGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = dotGrad;
      ctx.fillRect(tipX - 14, tipY - 14, 28, 28);
      
      const dx = (w - pad * 2) / maxTime;
      const dm_dt = 0.2 * Math.exp(0.2 * elapsed);
      const dy = - ((h - pad * 2) / (maxMult - 1)) * dm_dt;
      let angle = Math.atan2(dy, dx);
      angle = Math.max(-Math.PI / 3, angle);
      
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(angle);
      ctx.drawImage(planeImg, -16, -16, 32, 32);
      ctx.restore();
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
    const count = Math.floor(Math.random() * 5) + 4; // 4 to 8 players
    const players = [];
    
    // Use DB bets if available
    if (dbBets.length > 0) {
      const shuffledBets = [...dbBets].sort(() => 0.5 - Math.random());
      const selectedBets = shuffledBets.slice(0, count);
      for (let i = 0; i < selectedBets.length; i++) {
        players.push({
          id: i,
          name: selectedBets[i].user_name,
          bet: selectedBets[i].bet_amount,
          targetMult: selectedBets[i].target_multiplier,
          cashedOut: false,
          winAmount: 0
        });
      }
    } else {
      const names = ['Rahul88', 'Priya_M', 'AmanK', 'Raj_007', 'NehaS', 'Vikas12', 'Simran_X', 'AmitB'];
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
      if (data.serverTime) {
        serverTimeOffsetRef.current = data.serverTime - Date.now();
      }
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
        stopEngineSound();

        // Lobby chat comments triggers (schedule multiple comments to look active)
        clearChatTimeouts();
        const t1 = setTimeout(() => addSimulatedChatMessage('WAITING'), 800 + Math.random() * 800);
        const t2 = setTimeout(() => addSimulatedChatMessage('WAITING'), 2200 + Math.random() * 1200);
        const t3 = setTimeout(() => addSimulatedChatMessage('WAITING'), 4200 + Math.random() * 1200);
        const t4 = setTimeout(() => {
          if (gameStateRef.current === 'WAITING' && Math.random() < 0.8) {
            addSimulatedChatMessage('WAITING');
          }
        }, 6200 + Math.random() * 1000);
        chatTimeoutsRef.current.push(t1, t2, t3, t4);
      } 
      else if (data.state === 'FLYING') {
        startTimeRef.current = data.startTime;
        startFlightAnimation();
        startEngineSound();
        
        // Start a cycle of simulated flying comments
        clearChatTimeouts();
        scheduleFlyingComments();
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
        
        stopEngineSound();
        playCrashSound();
        
        refreshUser();

        // Crash Chat comments triggers based on multiplier (schedule 3 comments to look active)
        clearChatTimeouts();
        const crashType = data.crashPoint < 1.5 ? 'CRASH_LOW' : data.crashPoint < 5.0 ? 'CRASH_MED' : 'CRASH_HIGH';
        const tc1 = setTimeout(() => addSimulatedChatMessage(crashType), 200 + Math.random() * 300);
        const tc2 = setTimeout(() => addSimulatedChatMessage(crashType), 900 + Math.random() * 500);
        const tc3 = setTimeout(() => {
          if (gameStateRef.current === 'CRASHED' && Math.random() < 0.75) {
            addSimulatedChatMessage(crashType);
          }
        }, 1800 + Math.random() * 600);
        chatTimeoutsRef.current.push(tc1, tc2, tc3);
      }
    });

    socket.on('aviator_timer', (data) => {
      setTimeLeft(data.timeLeft);
      if (gameStateRef.current === 'WAITING' && data.timeLeft > 0) {
        playTickSound();
      }
    });

    return () => {
      socket.disconnect();
      stopEngineSound();
      clearChatTimeouts();
    };
  }, []);

  const startFlightAnimation = () => {
    commentedMilestonesRef.current = {};
    const animate = () => {
      if (gameStateRef.current !== 'FLYING') return;
      
      const adjustedNow = Date.now() + serverTimeOffsetRef.current;
      const elapsed = Math.max(0, (adjustedNow - startTimeRef.current) / 1000);
      const currentMult = Math.exp(0.2 * elapsed);
      
      setMultiplier(currentMult);
      multiplierRef.current = currentMult;
      drawFlightPath(elapsed, currentMult, false);
      updateEnginePitch(currentMult);

      // Flying chat triggers are handled dynamically by scheduleFlyingComments
      
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
    if (gameState !== 'WAITING') return showToast('Wait for the next round to bet');
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return showToast('Enter a valid bet amount');
    if (bet > parseFloat(user.balance)) return showToast('Insufficient balance');

    setIsBetLoading(true);
    socketRef.current?.emit('aviator_bet', { amount: bet }, (res: any) => {
      setIsBetLoading(false);
      if (res.error) return showToast(res.error);
      setHasActiveBet(true);
      refreshUser();
    });
  };

  const handleCashout = () => {
    if (gameStateRef.current !== 'FLYING' || !hasActiveBetRef.current || isCashoutLoadingRef.current) return;
    
    isCashoutLoadingRef.current = true;
    setIsCashoutLoading(true);
    
    socketRef.current?.emit('aviator_cashout', {}, (res: any) => {
      isCashoutLoadingRef.current = false;
      setIsCashoutLoading(false);
      
      if (res.error) return showToast(res.error);
      
      setHasActiveBet(false);
      setCashoutSuccess(true);
      setWinAmount(res.winAmount);
      setShowWinOverlay(true);
      refreshUser();
      
      playCashoutSound();
      stopEngineSound();
      
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
      <div className="av-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => onNavigate('games')} className="av-back-btn">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="av-title">Aviator</h2>
            <p className="av-subtitle">Fly high, cash out before crash!</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mute/Unmute audio button */}
          <button className="av-audio-btn" onClick={() => setIsMuted(prev => !prev)}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Live Players Badge Button for Mobile Drawer */}
          <button className="av-live-badge-btn" onClick={() => {
            setActiveTab('players');
            sidebarRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}>
            <span className="av-live-dot" />
            <span>Live: {simPlayers.length}</span>
          </button>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%' }}>
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
              <button 
                className="av-action-btn av-action-cashout" 
                onClick={handleCashout}
                disabled={isCashoutLoading}
              >
                {isCashoutLoading ? 'Cashing out...' : `CASHOUT ₹${(parseFloat(betAmount) * multiplier).toFixed(2)}`}
              </button>
            ) : (
              <button className="av-action-btn" disabled style={{ background: '#374151', color: '#9ca3af' }}>
                Waiting for Next Round
              </button>
            )}
          </div>

          {/* Live Multiplayer Sidebar (visible below bet controls) */}
          <div ref={sidebarRef} className="av-sidebar">
            <div className="av-tabs-header">
              <button 
                className={`av-tab-btn ${activeTab === 'players' ? 'active' : ''}`}
                onClick={() => setActiveTab('players')}
              >
                👥 Players ({simPlayers.length + 1})
              </button>
              <button 
                className={`av-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                💬 Chat
              </button>
            </div>

            {activeTab === 'players' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '380px' }}>
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
            ) : (
              <div className="av-chat-container">
                <div className="av-chat-messages" ref={chatEndRef}>
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`av-chat-msg-row ${msg.type}`}>
                      <div className="av-chat-msg-meta">
                        <span className="av-chat-username" style={{ color: getUserColor(msg.username) }}>
                          {msg.username}
                          {msg.type === 'user' && <span className="av-chat-tag-you">YOU</span>}
                          {msg.type === 'system' && <span className="av-chat-tag-system">SYSTEM</span>}
                        </span>
                        <span className="av-chat-time">{msg.time}</span>
                      </div>
                      <div className="av-chat-text">{msg.text}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                
                <form onSubmit={handleSendMessage} className="av-chat-input-form">
                  <input 
                    type="text" 
                    placeholder="Chat with players..." 
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    maxLength={80}
                  />
                  <button type="submit" disabled={!userMessage.trim()}>Send</button>
                </form>
              </div>
            )}
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


      {/* Floating native-like Toast Alert */}
      {toast && (
        <div className="av-toast">
          {toast}
        </div>
      )}
    </div>
  );
};
