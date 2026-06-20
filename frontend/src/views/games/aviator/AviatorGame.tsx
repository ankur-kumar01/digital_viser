import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, LogOut } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getToken, gamesAPI, globalConfigAPI } from '../../../api';
import './AviatorGame.css';

const PLANE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 64"><ellipse cx="88" cy="32" rx="3" ry="24" fill="none" stroke="%23ffffff" stroke-width="1.5" opacity="0.5" stroke-dasharray="4 2"/><circle cx="88" cy="32" r="3" fill="%23fcd34d"/><path fill="%23c0171d" d="M22,28 L8,10 L18,10 L28,26 Z"/><path fill="%23e50914" d="M18,32 C22,26 40,24 75,28 C85,29 88,31 88,32 C88,33 85,35 75,36 C40,40 22,38 18,32 Z"/><path fill="%23ffffff" d="M62,27 C66,27 70,29 72,32 L58,32 Z" opacity="0.9"/><path fill="%23e50914" d="M48,26 L25,4 L35,4 L55,26 Z"/><path fill="%239b0c10" d="M48,38 L25,60 L35,60 L55,38 Z"/></svg>`;
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

const getHistoryChipClass = (val: number) => {
  if (val >= 10) return 'ultra';
  if (val >= 2) return 'high';
  return '';
};

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

const maskName = (name: string) => {
  if (!name) return '***';
  const cleanPhone = name.replace(/[\s\-\+\(\)]/g, '');
  const isPhone = /^\d+$/.test(cleanPhone);
  if (isPhone) {
    return '***' + cleanPhone.slice(-4);
  }
  if (name.length <= 2) {
    return name + '***';
  }
  if (name.length <= 4) {
    return name[0] + '***' + name[name.length - 1];
  }
  const first = name.substring(0, 2);
  const last = name.substring(name.length - 2);
  return `${first}***${last}`;
};

export const AviatorGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const mainBalance = typeof user?.balance === 'string' ? parseFloat(user.balance) : (user?.balance || 0);
  const gamingBonus = typeof user?.gaming_bonus_balance === 'string' ? parseFloat(user.gaming_bonus_balance) : (user?.gaming_bonus_balance || 0);
  const userBalance = Math.max(mainBalance, gamingBonus);

  const [betAmount, setBetAmount] = useState('100');
  const [config, setConfig] = useState<any>(null);

  const showChat = config ? config.enable_aviator_chat_simulation !== false : false;
  const showBets = config ? config.enable_aviator_bet_simulation !== false : false;
  
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
  const [showLoseOverlay, setShowLoseOverlay] = useState(false);
  
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
    globalConfigAPI.getConfig().then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    if (config) {
      const chatEnabled = config.enable_aviator_chat_simulation !== false;
      const betsEnabled = config.enable_aviator_bet_simulation !== false;
      if (!betsEnabled && chatEnabled) {
        setActiveTab('chat');
      } else if (betsEnabled) {
        setActiveTab('players');
      }
    }
  }, [config]);

  const [liveBetsTab, setLiveBetsTab] = useState<'all' | 'my' | 'top'>('all');
  const [myBets, setMyBets] = useState<any[]>([]);
  const [topBets, setTopBets] = useState<any[]>([]);

  useEffect(() => {
    if (liveBetsTab === 'my') {
      gamesAPI.getRealMyAviatorBets().then(setMyBets).catch(console.error);
    } else if (liveBetsTab === 'top') {
      gamesAPI.getRealTopAviatorBets().then(setTopBets).catch(console.error);
    }
  }, [liveBetsTab, gameState]);

  // Mobile drawer, toast, and cashout lock states
  const [toast, setToast] = useState<string | null>(null);
  const [isCashoutLoading, setIsCashoutLoading] = useState(false);
  const isCashoutLoadingRef = useRef(false);

  // Tabs & Live Chat states
  const [activeTab, setActiveTab] = useState<'players' | 'chat'>('players');
  const [betTab, setBetTab] = useState<'bet' | 'auto'>('bet');
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
    if (!config || config.enable_aviator_chat_simulation === false) return;
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
    
    gain.gain.setValueAtTime(0.18, now);
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

    const padL = 45;
    const padB = 25;
    const padR = 15;
    const padT = 15;

    const maxTime = Math.max(elapsed, 3.0);
    const maxMult = Math.max(mult * 1.2, 2.5);

    // 1. Radial Sunburst Rays background
    ctx.save();
    const originX = padL;
    const originY = h - padB;
    const rayCount = 18;
    const maxRadius = Math.sqrt(w * w + h * h);
    const angleStep = (Math.PI / 2) / rayCount; // 90 degrees of rays
    
    for (let i = 0; i < rayCount; i++) {
      const startAngle = -i * angleStep;
      const endAngle = -(i + 0.65) * angleStep;
      
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.arc(originX, originY, maxRadius, startAngle, endAngle, true);
      ctx.closePath();
      
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(229, 9, 20, 0.035)'; // Soft red glow
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Dark shadow ray
      }
      ctx.fill();
    }
    ctx.restore();

    // 2. Parallax Twinkling Starfield
    ctx.save();
    const timeVal = elapsed > 0 ? elapsed : (Date.now() % 100000) / 1000;
    const numStars = 30;
    for (let i = 0; i < numStars; i++) {
      const depth = 0.4 + 1.2 * ((i * 17) % 10) / 10;
      const baseX = ((i * 113) % 100) / 100 * w;
      const baseY = ((i * 197) % 100) / 100 * h;
      const size = 0.5 + 1.5 * ((i * 7) % 5) / 5;
      
      const speedX = elapsed > 0 ? 25 * depth : 4 * depth;
      const speedY = elapsed > 0 ? 10 * depth : 1 * depth;
      
      let x = (baseX - timeVal * speedX) % w;
      if (x < 0) x += w;
      let y = (baseY + timeVal * speedY) % h;
      if (y < 0) y += h;
      
      const alpha = (0.2 + 0.6 * (depth - 0.4) / 1.2) * (0.6 + 0.4 * Math.sin(timeVal * 3 + i));
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Y-Axis Dashed Grid Lines & Labels
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    const minM = 1.0;
    const gridCount = 5;
    const step = (maxMult - minM) / gridCount;
    
    for (let i = 0; i <= gridCount; i++) {
      const m = minM + i * step;
      const y = h - padB - ((h - padB - padT) * ((m - 1) / (maxMult - 1)));
      
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '700 10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${m.toFixed(1)}x`, padL - 8, y);
    }
    ctx.restore();

    if (elapsed <= 0 && !didCrash) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }

    // 4. Exhaust Particles Trail
    if (elapsed > 0 && !didCrash) {
      const maxAge = 0.8;
      const particleInterval = 0.04;
      const startT = Math.max(0, elapsed - maxAge);
      
      for (let t = elapsed; t >= startT; t -= particleInterval) {
        const age = elapsed - t;
        const m = Math.exp(0.2 * t);
        const px = padL + ((w - padL - padR) * (t / maxTime));
        const py = h - padB - ((h - padB - padT) * ((m - 1) / (maxMult - 1)));
        const clampedPy = Math.max(padT, Math.min(h - padB, py));
        
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
          color = `rgba(253, 224, 71, ${opacity})`;
        } else if (age < 0.35) {
          color = `rgba(249, 115, 22, ${opacity})`;
        } else if (age < 0.55) {
          color = `rgba(239, 68, 68, ${opacity})`;
        } else {
          color = `rgba(156, 163, 175, ${opacity * 0.4})`;
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Curve Path
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    const steps = 150;
    let tipX = padL, tipY = h - padB;
    for (let i = 1; i <= steps; i++) {
      const t = (elapsed * i) / steps;
      const m = Math.exp(0.2 * t);
      const x = padL + ((w - padL - padR) * (t / maxTime));
      const y = h - padB - ((h - padB - padT) * ((m - 1) / (maxMult - 1)));
      const clampedY = Math.max(padT, Math.min(h - padB, y));
      ctx.lineTo(x, clampedY);
      tipX = x; tipY = clampedY;
    }

    // Stroke with glow
    const lineColor = didCrash ? '#ef4444' : '#e50914';
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // Gradient fill under curve
    ctx.lineTo(tipX, h - padB);
    ctx.lineTo(padL, h - padB);
    ctx.closePath();
    ctx.save();
    const fillGrad = ctx.createLinearGradient(0, padT, 0, h - padB);
    fillGrad.addColorStop(0, didCrash ? 'rgba(239, 68, 68, 0.22)' : 'rgba(229, 9, 20, 0.22)');
    fillGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();

    // 6. Plane or explosion at tip
    if (didCrash) {
      ctx.drawImage(crashImg, tipX - 20, tipY - 20, 40, 40);
    } else {
      // Glow dot at tip
      ctx.save();
      const dotGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 12);
      dotGrad.addColorStop(0, 'rgba(229, 9, 20, 0.4)');
      dotGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      const dx = (w - padL - padR) / maxTime;
      const dm_dt = 0.2 * Math.exp(0.2 * elapsed);
      const dy = - ((h - padB - padT) / (maxMult - 1)) * dm_dt;
      let angle = Math.atan2(dy, dx);
      angle = Math.max(-Math.PI / 3, angle);
      
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(angle);
      ctx.drawImage(planeImg, -18, -11, 36, 23);
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
    if (config && config.enable_aviator_bet_simulation === false) {
      setSimPlayers([]);
      return;
    }
    const count = Math.floor(Math.random() * 9) + 12; // 12 to 20 players
    const players = [];
    
    const shuffledBets = dbBets.length > 0 ? [...dbBets].sort(() => 0.5 - Math.random()) : [];
    
    for (let i = 0; i < count; i++) {
      if (i < shuffledBets.length) {
        players.push({
          id: i,
          name: shuffledBets[i].user_name,
          bet: shuffledBets[i].bet_amount,
          targetMult: shuffledBets[i].target_multiplier || (1.2 + Math.random() * 8.0),
          cashedOut: false,
          winAmount: 0
        });
      } else {
        const botName = BOT_USERNAMES[Math.floor(Math.random() * BOT_USERNAMES.length)];
        players.push({
          id: i,
          name: botName + Math.floor(Math.random() * 100),
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
        setShowLoseOverlay(false);
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
          setShowLoseOverlay(true);
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

    socket.on('aviator_bets_update', (data: any[]) => {
      setSimPlayers(data);
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
      
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const handlePlaceBet = () => {
    if (gameState !== 'WAITING') return showToast('Wait for the next round to bet');
    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) return showToast('Enter a valid bet amount');
    if (bet > userBalance) return showToast('Insufficient balance');

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
    <div className="av-container">
      {/* Header */}
      <div className="av-header">
        <div className="av-header-left">
          <button className="av-exit-btn" onClick={() => onNavigate('games')} title="Exit Game">
            <LogOut size={18} />
          </button>
          <button 
            className="av-audio-btn" 
            onClick={() => setIsMuted(!isMuted)} 
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        <div className="av-logo">
          <div className="av-logo-wings">
            <div></div><div></div><div></div>
          </div>
          Aviator
          <div className="av-logo-wings av-logo-wings-reverse">
            <div></div><div></div><div></div>
          </div>
        </div>
        <div className="av-balance-box">
          ₹{mainBalance.toFixed(2)}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px' }}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        </div>
      </div>

      {/* History Bar */}
      <div className="av-history-wrapper">
        <div className="av-history-bar">
          {crashHistory.map((c, i) => (
            <div key={i} className={`av-history-chip ${getHistoryChipClass(c)}`}>
              {c.toFixed(2)}x
            </div>
          ))}
          {crashHistory.length === 0 && (
            <>
              <div className="av-history-chip">1.45x</div>
              <div className="av-history-chip high">2.36x</div>
              <div className="av-history-chip">1.12x</div>
              <div className="av-history-chip ultra">12.59x</div>
              <div className="av-history-chip">1.08x</div>
              <div className="av-history-chip high">2.01x</div>
              <div className="av-history-chip">1.00x</div>
            </>
          )}
        </div>
        <button className="av-history-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
      </div>

      <div className="av-main-grid">
        {/* Main Game Area */}
        <div className={`av-canvas-wrap ${gameState === 'FLYING' ? 'playing' : ''} ${gameState === 'CRASHED' ? 'crashed' : ''}`}>
          <canvas ref={canvasRef} />
          
          {gameState !== 'WAITING' && (
            <div className={`av-multiplier ${gameState === 'CRASHED' ? 'crashed' : ''}`}>
              {multiplier.toFixed(2)}x
            </div>
          )}

          {gameState === 'CRASHED' && <div className="av-status-badge">FLEW AWAY!</div>}
          
           {gameState === 'WAITING' && (
            <div className="av-waiting-text">
              {timeLeft > 0 ? `Waiting... ${(timeLeft/1000).toFixed(1)}s` : 'Loading...'}
            </div>
          )}

          {/* Win Overlay */}
          {showWinOverlay && (
            <div className="av-win-overlay">
              <div className="av-win-card">
                <div className="av-win-title">CASHED OUT</div>
                <div className="av-win-multiplier">{multiplier.toFixed(2)}x</div>
                <div className="av-win-amount">₹{winAmount.toFixed(2)}</div>
              </div>
            </div>
          )}

          {/* Lose Overlay */}
          {showLoseOverlay && (
            <div className="av-lose-overlay">
              <div className="av-lose-card">
                <div className="av-lose-title">FLEW AWAY</div>
                <div className="av-lose-multiplier">{multiplier.toFixed(2)}x</div>
                <div className="av-lose-amount">₹{parseFloat(betAmount).toFixed(2)} lost</div>
              </div>
            </div>
          )}
        </div>

        {/* Bet Controls */}
        <div className="av-controls-container">
          <div className="av-controls-tabs">
            <button 
              className={`av-control-tab ${betTab === 'bet' ? 'active' : ''}`}
              onClick={() => setBetTab('bet')}
            >
              Bet
            </button>
            <button 
              className={`av-control-tab ${betTab === 'auto' ? 'active' : ''}`}
              onClick={() => setBetTab('auto')}
            >
              Auto
            </button>
          </div>
          
          <div className="av-controls-body">
            <div className="av-bet-section">
              <div className="av-bet-input-row">
                <span>Bet Amount</span>
                <span style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 800, paddingLeft: '6px', fontFamily: 'var(--av-font-montserrat)' }}>₹</span>
                <input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(e.target.value)} 
                  disabled={hasActiveBet || isBetLoading} 
                />
                <div className="av-bet-btn-group">
                  <button className="av-bet-adjust-btn" onClick={() => setBetAmount(Math.max(10, parseFloat(betAmount) - 10).toString())} disabled={hasActiveBet || isBetLoading}>-</button>
                  <button className="av-bet-adjust-btn" onClick={() => setBetAmount((parseFloat(betAmount) + 10).toString())} disabled={hasActiveBet || isBetLoading}>+</button>
                </div>
              </div>
              <div className="av-quick-bets">
                {[10, 50, 100, 500].map(q => (
                  <button key={q} className="av-quick-btn" onClick={() => setBetAmount(q.toString())} disabled={hasActiveBet || isBetLoading}>
                    ₹{q}
                  </button>
                ))}
              </div>
            </div>

            <div className="av-action-btn-wrap">
              {hasActiveBet ? (
                gameState === 'WAITING' ? (
                  <button 
                    className="av-action-btn" 
                    disabled 
                    style={{ background: '#c0171d', color: '#fff', boxShadow: 'none' }}
                  >
                    BET PLACED
                    <span>Waiting...</span>
                  </button>
                ) : (
                  <button 
                    className="av-action-btn cashing-out" 
                    onClick={handleCashout}
                    disabled={isCashoutLoading}
                  >
                    CASHOUT
                    <span>₹{(parseFloat(betAmount) * multiplier).toFixed(2)}</span>
                  </button>
                )
              ) : gameState === 'WAITING' ? (
                <button 
                  className="av-action-btn" 
                  onClick={handlePlaceBet} 
                  disabled={isBetLoading}
                >
                  BET
                  <span>Next Round</span>
                </button>
              ) : (
                <button className="av-action-btn" disabled>
                  WAIT
                  <span>Next Round</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Bets Table */}
        <div className="av-bets-container">
          <div className="av-bets-tabs">
            <button 
              className={`av-bets-tab ${liveBetsTab === 'all' ? 'active' : ''}`}
              onClick={() => setLiveBetsTab('all')}
            >
              All Bets
            </button>
            <button 
              className={`av-bets-tab ${liveBetsTab === 'my' ? 'active' : ''}`}
              onClick={() => setLiveBetsTab('my')}
            >
              My Bets
            </button>
            <button 
              className={`av-bets-tab ${liveBetsTab === 'top' ? 'active' : ''}`}
              onClick={() => setLiveBetsTab('top')}
            >
              Top
            </button>
          </div>
          <table className="av-bets-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>User</th>
                <th style={{ textAlign: 'left' }}>Bet</th>
                <th style={{ textAlign: 'left' }}>Cash Out</th>
                <th style={{ textAlign: 'left' }}>Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {(liveBetsTab === 'all' ? simPlayers : (liveBetsTab === 'my' ? myBets : topBets)).slice(0, 15).map((p, i) => (
                <tr key={i}>
                  <td>
                    <div className="av-user-cell">
                      <div className="av-user-avatar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <span className="av-user-name">{maskName(p.name)}</span>
                    </div>
                  </td>
                  <td>₹{p.bet.toFixed(2)}</td>
                  <td className="av-val-cashout">{p.cashedOut ? `₹${p.winAmount.toFixed(2)}` : '-'}</td>
                  <td className="av-val-mult">
                    {p.cashedOut ? (
                      <span className={`av-mult-chip ${p.targetMult >= 10 ? 'ultra' : p.targetMult >= 2 ? 'high' : ''}`}>
                        {p.targetMult.toFixed(2)}x
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {(liveBetsTab === 'all' ? simPlayers : (liveBetsTab === 'my' ? myBets : topBets)).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No bets recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating native-like Toast Alert */}
      {toast && (
        <div className="av-toast">
          {toast}
        </div>
      )}
    </div>
  );
};
