// FruitSlasherGame.tsx
import React, { useState, useEffect, useRef } from 'react';
import { gamesAPI } from '../../../api';
import { Heart, Volume2, VolumeX, ShieldAlert, Award, Play, AlertCircle, Coins, LogOut } from 'lucide-react';
import './FruitSlasherGame.css';

interface Props {
  user: any;
  refreshUser: () => Promise<void>;
  onNavigate: (view: string) => void;
}

// Sound Synthesizer Utility using Web Audio API
class GameAudioSynth {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    // AudioContext is initialized on user interaction
  }

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playWhoosh() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playSplat() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      // Noise buffer for splat texture
      const bufferSize = this.ctx.sampleRate * 0.1; // 0.1s
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.1);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      // Add a low-pitched punch sound
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      noise.start(now);
      osc.start(now);

      noise.stop(now + 0.1);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn(e);
    }
  }

  playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.5; // 0.5s
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(20, now + 0.45);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      // Extra bass rumble
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(30, now + 0.3);
      oscGain.gain.setValueAtTime(0.6, now);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.5);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn(e);
    }
  }

  playCashout() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Synthesize a beautiful double-bell arpeggio (C5 then G5)
      const playBell = (freq: number, startTime: number) => {
        if (!this.ctx) return;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, startTime); // harmonic

        gainNode.gain.setValueAtTime(0.0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + 0.4);
        osc2.stop(startTime + 0.4);
      };

      playBell(523.25, now); // C5
      playBell(783.99, now + 0.1); // G5
    } catch (e) {
      console.warn(e);
    }
  }

  playLifeLost() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn(e);
    }
  }

  playTick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch (e) {
      console.warn(e);
    }
  }
}

// Game entity types
interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'watermelon' | 'apple' | 'orange' | 'golden' | 'bomb';
  sliced: boolean;
  sliceAngle: number;
  halfLeftX: number;
  halfLeftY: number;
  halfRightX: number;
  halfRightY: number;
  halfVxLeft: number;
  halfVxRight: number;
  halfVy: number;
  halfRotLeft: number;
  halfRotRight: number;
  rotSpeed: number;
  rotation: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

const FRUIT_TYPES = ['watermelon', 'apple', 'orange', 'golden', 'bomb'] as const;

export const FruitSlasherGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  // Betting parameters
  const [betAmount, setBetAmount] = useState<string>('50');
  const [autoCashout, setAutoCashout] = useState<string>('');
  const [autoCashoutActive, setAutoCashoutActive] = useState<boolean>(false);
  
  // Game states
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'cashed_out' | 'crashed'>('idle');
  const [score, setScore] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [lives, setLives] = useState<number>(3);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [betId, setBetId] = useState<number | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [winPayout, setWinPayout] = useState<number>(0);
  const [finalMultiplier, setFinalMultiplier] = useState<number>(1.0);

  // Audio system ref
  const audioSynthRef = useRef<GameAudioSynth | null>(null);

  // Canvas details
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Game variables references (to keep loops fast and free of stale closure bugs)
  const scoreRef = useRef<number>(0);
  const multRef = useRef<number>(1.0);
  const livesRef = useRef<number>(3);
  const gameStateRef = useRef<'idle' | 'playing' | 'cashed_out' | 'crashed'>('idle');
  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const textEffectsRef = useRef<FloatingText[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const lastSpawnTime = useRef<number>(0);
  const nextSpawnInterval = useRef<number>(2000);
  const fruitIdCounter = useRef<number>(0);

  // Auto cashout value reference
  const autoCashoutValRef = useRef<number | null>(null);
  const serverCrashMultiplierRef = useRef<number | null>(null);

  // Audio context handler
  useEffect(() => {
    audioSynthRef.current = new GameAudioSynth();
  }, []);

  // Update states refs
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (audioSynthRef.current) {
      audioSynthRef.current.enabled = soundEnabled;
    }
  }, [soundEnabled]);

  // Set up auto-cashout numeric ref
  useEffect(() => {
    const val = parseFloat(autoCashout);
    if (autoCashoutActive && !isNaN(val) && val > 1.0) {
      autoCashoutValRef.current = val;
    } else {
      autoCashoutValRef.current = null;
    }
  }, [autoCashout, autoCashoutActive]);

  // Unified balance calculation
  const mainBalance = typeof user?.balance === 'string' ? parseFloat(user.balance) : (user?.balance || 0);
  const gamingBonus = typeof user?.gaming_bonus_balance === 'string' ? parseFloat(user.gaming_bonus_balance) : (user?.gaming_bonus_balance || 0);
  const userBalance = Math.max(mainBalance, gamingBonus);

  // Handle preset betting values
  const handlePreset = (amount: number) => {
    setBetAmount(amount.toString());
  };

  const handleDouble = () => {
    const parsed = parseFloat(betAmount);
    if (!isNaN(parsed)) setBetAmount((parsed * 2).toString());
  };

  const handleHalf = () => {
    const parsed = parseFloat(betAmount);
    if (!isNaN(parsed) && parsed > 10) setBetAmount(Math.max(10, parsed / 2).toString());
  };

  // Start the game round via API
  const handleStartGame = async () => {
    if (gameState === 'playing') return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const parsedAmount = parseFloat(betAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid bet amount.');
      }
      if (parsedAmount > userBalance) {
        throw new Error('Insufficient wallet balance.');
      }

      // 1. Call Backend Play API
      const res = await gamesAPI.fruitSlasherPlay(parsedAmount, 'main');
      
      if (!res.success) {
        throw new Error(res.error || 'Failed to start game.');
      }

      // 2. Clear previous game states
      setBetId(res.betId);
      serverCrashMultiplierRef.current = res.serverCrashMultiplier;
      setScore(0);
      setMultiplier(1.0);
      setLives(3);
      setWinPayout(0);
      
      scoreRef.current = 0;
      multRef.current = 1.0;
      livesRef.current = 3;
      fruitsRef.current = [];
      particlesRef.current = [];
      textEffectsRef.current = [];
      trailRef.current = [];
      
      // Refresh balance in client
      await refreshUser();

      // 3. Launch canvas loop and change game state
      setGameState('playing');
      lastSpawnTime.current = Date.now();
      nextSpawnInterval.current = 1200; // Launch first wave quickly
      
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Cashout API Call
  const triggerCashout = async (claimedMultiplier: number) => {
    if (gameStateRef.current !== 'playing' || !betId) return;
    
    // Set local game state immediately to stop game logic loop actions
    setGameState('cashed_out');
    gameStateRef.current = 'cashed_out';
    
    if (audioSynthRef.current) audioSynthRef.current.playCashout();

    try {
      const res = await gamesAPI.fruitSlasherCashout(betId, claimedMultiplier);

      if (res.success) {
        setWinPayout(res.payout);
        setFinalMultiplier(res.multiplier);
        await refreshUser();
      } else {
        // Handled as crashed if client claimed multiplier exceeded limit
        setGameState('crashed');
        gameStateRef.current = 'crashed';
        setWinPayout(0);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 500);
        if (audioSynthRef.current) audioSynthRef.current.playExplosion();
      }
    } catch (err) {
      console.error('Failed to submit cashout:', err);
      // Fallback: local crash state
      setGameState('crashed');
      gameStateRef.current = 'crashed';
    }
  };

  // Handle Crash API Call (triggered when hitting a bomb or losing all lives)
  const triggerCrash = async (endMultiplier: number) => {
    if (gameStateRef.current !== 'playing' || !betId) return;

    setGameState('crashed');
    gameStateRef.current = 'crashed';
    
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 500);
    
    if (audioSynthRef.current) audioSynthRef.current.playExplosion();

    try {
      await gamesAPI.fruitSlasherCrash(betId, endMultiplier);
      await refreshUser();
    } catch (err) {
      console.error('Failed to register crash:', err);
    }
  };

  // Canvas physics and rendering engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed virtual resolution to make sizing device-independent
    const V_WIDTH = 1280;
    const V_HEIGHT = 720;
    canvas.width = V_WIDTH;
    canvas.height = V_HEIGHT;

    // Helper functions for math
    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      let t = ((px - x1) * dx + (py - y1) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    };

    // Spawning Fruit wave
    const spawnFruitWave = () => {
      // 1 to 3 fruits in a wave
      const count = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < count; i++) {
        const id = fruitIdCounter.current++;
        // Positioned symmetrically along the bottom
        const startX = V_WIDTH * (0.2 + Math.random() * 0.6);
        const startY = V_HEIGHT + 60;
        
        // Launch arc adjustments
        const targetX = V_WIDTH * (0.3 + Math.random() * 0.4);
        const vx = (targetX - startX) / 60; // Travel to mid in ~60 frames
        const vy = -(14 + Math.random() * 6); // Arcs upwards

        // Choose types with weighted distribution
        const r = Math.random();
        let type: Fruit['type'] = 'apple';
        let radius = 32;
        let color = '#ef4444';

        if (r < 0.25) {
          type = 'watermelon';
          radius = 48;
          color = '#22c55e';
        } else if (r < 0.50) {
          type = 'orange';
          radius = 35;
          color = '#f97316';
        } else if (r < 0.75) {
          type = 'apple';
          radius = 34;
          color = '#ef4444';
        } else if (r < 0.90) {
          type = 'bomb';
          radius = 36;
          color = '#3f3f46';
        } else {
          type = 'golden';
          radius = 30;
          color = '#fbbf24';
        }

        fruitsRef.current.push({
          id,
          x: startX,
          y: startY,
          vx,
          vy,
          radius,
          color,
          type,
          sliced: false,
          sliceAngle: 0,
          halfLeftX: 0,
          halfLeftY: 0,
          halfRightX: 0,
          halfRightY: 0,
          halfVxLeft: 0,
          halfVxRight: 0,
          halfVy: 0,
          halfRotLeft: 0,
          halfRotRight: 0,
          rotSpeed: (Math.random() - 0.5) * 0.08,
          rotation: Math.random() * Math.PI * 2
        });
      }

      lastSpawnTime.current = Date.now();
      // Speed up spawn waves slightly as score climbs
      const currentScore = scoreRef.current;
      nextSpawnInterval.current = Math.max(1000, 2500 - currentScore * 45);
    };

    // Draw Vector Fruits
    const drawFruitVector = (c: CanvasRenderingContext2D, f: Fruit) => {
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.rotation);

      if (f.type === 'watermelon') {
        // Outer skin
        c.beginPath();
        c.arc(0, 0, f.radius, 0, Math.PI * 2);
        c.fillStyle = '#15803d';
        c.fill();
        c.strokeStyle = '#22c55e';
        c.lineWidth = 3;
        c.stroke();
        
        // Inner pulp
        c.beginPath();
        c.arc(0, 0, f.radius - 8, 0, Math.PI * 2);
        c.fillStyle = '#ef4444';
        c.fill();

        // Seeds
        c.fillStyle = '#09090b';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          c.save();
          c.rotate(a + 0.1);
          c.beginPath();
          c.ellipse(f.radius / 2.3, 0, 4, 2, 0, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      } else if (f.type === 'apple') {
        // Apple Body shape
        c.beginPath();
        c.arc(-f.radius * 0.2, 0, f.radius * 0.8, 0, Math.PI * 2);
        c.arc(f.radius * 0.2, 0, f.radius * 0.8, 0, Math.PI * 2);
        c.fillStyle = '#dc2626';
        c.fill();
        // Inner detail glow
        c.beginPath();
        c.arc(-f.radius * 0.1, -f.radius * 0.1, f.radius * 0.4, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.2)';
        c.fill();

        // stem
        c.beginPath();
        c.moveTo(0, -f.radius * 0.7);
        c.quadraticCurveTo(f.radius * 0.3, -f.radius * 1.1, f.radius * 0.2, -f.radius * 1.2);
        c.strokeStyle = '#78350f';
        c.lineWidth = 4;
        c.stroke();

        // Leaf
        c.beginPath();
        c.ellipse(f.radius * 0.3, -f.radius * 1.0, 8, 4, -Math.PI / 4, 0, Math.PI * 2);
        c.fillStyle = '#16a34a';
        c.fill();
      } else if (f.type === 'orange') {
        // Orange Outer skin
        c.beginPath();
        c.arc(0, 0, f.radius, 0, Math.PI * 2);
        c.fillStyle = '#ea580c';
        c.fill();

        // Segments divider
        c.beginPath();
        c.arc(0, 0, f.radius - 4, 0, Math.PI * 2);
        c.fillStyle = '#f97316';
        c.fill();
        c.strokeStyle = '#ffedd5';
        c.lineWidth = 1.5;
        c.stroke();

        // Segment lines
        c.strokeStyle = '#ffedd5';
        c.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(i * Math.PI / 4) * (f.radius - 4), Math.sin(i * Math.PI / 4) * (f.radius - 4));
          c.stroke();
        }
      } else if (f.type === 'golden') {
        // Golden Fruit Base (highly shiny/neon)
        const glowGrad = c.createRadialGradient(0, 0, 2, 0, 0, f.radius);
        glowGrad.addColorStop(0, '#fffbeb');
        glowGrad.addColorStop(0.3, '#fef08a');
        glowGrad.addColorStop(1, '#d97706');

        c.beginPath();
        c.arc(0, 0, f.radius, 0, Math.PI * 2);
        c.fillStyle = glowGrad;
        c.fill();
        c.strokeStyle = '#fbbf24';
        c.lineWidth = 4;
        c.stroke();

        // Outer glow
        c.shadowColor = '#fbbf24';
        c.shadowBlur = 15;
        c.beginPath();
        c.arc(0, 0, f.radius - 2, 0, Math.PI * 2);
        c.stroke();
      } else if (f.type === 'bomb') {
        // Dark Bomb sphere
        const metalGrad = c.createRadialGradient(-6, -6, 2, 0, 0, f.radius);
        metalGrad.addColorStop(0, '#71717a');
        metalGrad.addColorStop(0.4, '#27272a');
        metalGrad.addColorStop(1, '#09090b');

        c.beginPath();
        c.arc(0, 0, f.radius, 0, Math.PI * 2);
        c.fillStyle = metalGrad;
        c.fill();
        c.strokeStyle = '#ef4444';
        c.lineWidth = 2.5;
        c.stroke();

        // Lit Fuse
        c.beginPath();
        c.moveTo(0, -f.radius + 3);
        c.quadraticCurveTo(12, -f.radius - 12, 18, -f.radius - 8);
        c.strokeStyle = '#d97706';
        c.lineWidth = 3;
        c.stroke();

        // Fuse spark circles
        c.beginPath();
        c.arc(18, -f.radius - 8, 4, 0, Math.PI * 2);
        c.fillStyle = '#f59e0b';
        c.fill();
        c.shadowColor = '#f59e0b';
        c.shadowBlur = 10;
        c.fill();
      }

      c.restore();
    };

    // Draw Halves of sliced fruit
    const drawFruitHalves = (c: CanvasRenderingContext2D, f: Fruit) => {
      const drawHalf = (leftSide: boolean) => {
        c.save();
        if (leftSide) {
          c.translate(f.halfLeftX, f.halfLeftY);
          c.rotate(f.halfRotLeft);
        } else {
          c.translate(f.halfRightX, f.halfRightY);
          c.rotate(f.halfRotRight);
        }

        // Clip the drawing context to only render half circle
        c.beginPath();
        if (leftSide) {
          // Draw rect covering right side, clip inverse
          c.rect(-f.radius * 2, -f.radius * 2, f.radius * 2, f.radius * 4);
        } else {
          c.rect(0, -f.radius * 2, f.radius * 2, f.radius * 4);
        }
        c.clip();

        // Draw original fruit shape inside clipped area
        const originalX = f.x;
        const originalY = f.y;
        f.x = 0;
        f.y = 0;
        drawFruitVector(c, f);
        f.x = originalX;
        f.y = originalY;

        c.restore();
      };

      drawHalf(true);
      drawHalf(false);
    };

    // The central loop
    const updateGame = () => {
      if (!ctx || !canvas) return;

      // 1. Clear Screen
      ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

      // 2. Draw Gridlines / Cyber vibes background elements
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < V_WIDTH; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, V_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < V_HEIGHT; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(V_WIDTH, y);
        ctx.stroke();
      }

      const isPlaying = gameStateRef.current === 'playing';

      if (isPlaying) {
        // Handle Auto-Spawning Fruit Waves
        const elapsed = Date.now() - lastSpawnTime.current;
        if (elapsed > nextSpawnInterval.current) {
          spawnFruitWave();
        }
      }

      // 3. Update & Draw Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity on juice
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Update & Draw Fruits
      const fruits = fruitsRef.current;
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];

        if (!f.sliced) {
          // Physics movement
          f.x += f.vx;
          f.y += f.vy;
          f.vy += 0.22; // gravity arc
          f.rotation += f.rotSpeed;

          // Check if it fell off-screen
          if (f.y > V_HEIGHT + 80 && f.vy > 0) {
            fruits.splice(i, 1);
            
            // If the player missed a fruit (that is NOT a bomb), they lose a life
            if (isPlaying && f.type !== 'bomb') {
              const currentLives = livesRef.current - 1;
              livesRef.current = currentLives;
              setLives(currentLives);
              if (audioSynthRef.current) audioSynthRef.current.playLifeLost();

              if (currentLives <= 0) {
                // Game Over - crashed
                triggerCrash(multRef.current);
              }
            }
            continue;
          }

          // Draw the fruit
          drawFruitVector(ctx, f);

          // Handle Swipe Collision Checks if slicing is active
          if (isPlaying && isMouseDown.current && trailRef.current.length >= 2) {
            const trail = trailRef.current;
            const p2 = trail[trail.length - 1]; // current point
            const p1 = trail[trail.length - 2]; // previous point

            const d = distToSegment(f.x, f.y, p1.x, p1.y, p2.x, p2.y);
            if (d <= f.radius) {
              // FRUIT SLICED!
              f.sliced = true;
              
              // Split coordinates initial setups
              f.halfLeftX = f.x;
              f.halfLeftY = f.y;
              f.halfRightX = f.x;
              f.halfRightY = f.y;
              f.halfVxLeft = f.vx - 3 - Math.random() * 2;
              f.halfVxRight = f.vx + 3 + Math.random() * 2;
              f.halfVy = f.vy - 1;
              f.halfRotLeft = f.rotation;
              f.halfRotRight = f.rotation;

              if (f.type === 'bomb') {
                // BOMB COLLISION! Game Crashes
                triggerCrash(multRef.current);
                // Create bomb sparks
                for (let k = 0; k < 35; k++) {
                  particles.push({
                    x: f.x,
                    y: f.y,
                    vx: (Math.random() - 0.5) * 16,
                    vy: (Math.random() - 0.5) * 16,
                    radius: Math.random() * 5 + 3,
                    color: k % 2 === 0 ? '#ef4444' : '#fbbf24',
                    alpha: 1.0,
                    decay: 0.02 + Math.random() * 0.02
                  });
                }
              } else {
                // Normal fruit slice
                if (audioSynthRef.current) audioSynthRef.current.playSplat();
                
                // Add Score & Multipliers
                let points = 10;
                let multInc = 0.05;
                let scoreText = '+0.05x';
                let textColor = '#22c55e';

                if (f.type === 'golden') {
                  points = 25;
                  multInc = 0.15;
                  scoreText = '+0.15x GOLD!';
                  textColor = '#fbbf24';
                } else if (f.type === 'watermelon') {
                  points = 15;
                  multInc = 0.08;
                  scoreText = '+0.08x';
                  textColor = '#10b981';
                }

                const newScore = scoreRef.current + points;
                scoreRef.current = newScore;
                setScore(newScore);

                const newMult = parseFloat((multRef.current + multInc).toFixed(2));

                // Check Server Crash Multiplier Limit
                if (serverCrashMultiplierRef.current && newMult >= serverCrashMultiplierRef.current) {
                  triggerCrash(serverCrashMultiplierRef.current);
                  // Spawn explosion particles
                  for (let k = 0; k < 35; k++) {
                    particles.push({
                      x: f.x,
                      y: f.y,
                      vx: (Math.random() - 0.5) * 16,
                      vy: (Math.random() - 0.5) * 16,
                      radius: Math.random() * 5 + 3,
                      color: k % 2 === 0 ? '#ef4444' : '#fbbf24',
                      alpha: 1.0,
                      decay: 0.02 + Math.random() * 0.02
                    });
                  }
                  return;
                }

                multRef.current = newMult;
                setMultiplier(newMult);

                if (audioSynthRef.current) audioSynthRef.current.playTick();

                // Check Auto Cashout
                if (autoCashoutValRef.current && newMult >= autoCashoutValRef.current) {
                  triggerCashout(newMult);
                }

                // Add Floating score text popup
                textEffectsRef.current.push({
                  id: Date.now() + Math.random(),
                  x: f.x,
                  y: f.y - 10,
                  text: scoreText,
                  color: textColor,
                  alpha: 1.0,
                  scale: 1.0
                });

                // Spawn juicy particles
                for (let k = 0; k < 12; k++) {
                  particles.push({
                    x: f.x,
                    y: f.y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10 - 2,
                    radius: Math.random() * 6 + 2,
                    color: f.color,
                    alpha: 1.0,
                    decay: 0.02 + Math.random() * 0.03
                  });
                }
              }
            }
          }
        } else {
          // Half fruit physics
          f.halfLeftX += f.halfVxLeft;
          f.halfRightX += f.halfVxRight;
          f.halfLeftY += f.halfVy;
          f.halfRightY += f.halfVy;

          f.halfVy += 0.28; // accelerated gravity for pieces
          f.halfRotLeft -= 0.08;
          f.halfRotRight += 0.08;

          // Remove if both halves fall off-screen
          if (f.halfLeftY > V_HEIGHT + 60 && f.halfRightY > V_HEIGHT + 60) {
            fruits.splice(i, 1);
            continue;
          }

          // Draw the sliced pieces
          drawFruitHalves(ctx, f);
        }
      }

      // 5. Update & Draw Swipe Trails
      const trail = trailRef.current;
      const now = Date.now();
      
      // Filter out points older than 140ms
      for (let i = trail.length - 1; i >= 0; i--) {
        if (now - trail[i].time > 140) {
          trail.splice(0, i + 1);
          break;
        }
      }

      if (trail.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 12;
        
        // Draw segmented line with fading thickness/alpha
        for (let i = 1; i < trail.length; i++) {
          const ratio = i / trail.length;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          
          ctx.strokeStyle = `rgba(168, 85, 247, ${ratio})`;
          ctx.lineWidth = 10 * ratio;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 6. Draw Floating Texts
      const texts = textEffectsRef.current;
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.y -= 1.8; // Float upwards
        t.alpha -= 0.025; // Fade out
        t.scale += 0.005; // Growth

        if (t.alpha <= 0) {
          texts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.color;
        ctx.font = `italic 800 ${Math.floor(22 * t.scale)}px var(--font-headings)`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }

      // Request next frame
      requestRef.current = requestAnimationFrame(updateGame);
    };

    // Initialize animation loops
    requestRef.current = requestAnimationFrame(updateGame);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState, betId]);

  // Map coordinates to virtual resolution canvas
  const handlePointerMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isMouseDown.current) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Check distance between moves to throttle trails
    let playWhoosh = false;
    if (lastMousePos.current) {
      const dx = x - lastMousePos.current.x;
      const dy = y - lastMousePos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 35) playWhoosh = true; // swipe fast
    }

    if (playWhoosh && audioSynthRef.current) {
      audioSynthRef.current.playWhoosh();
    }

    trailRef.current.push({ x, y, time: Date.now() });
    lastMousePos.current = { x, y };
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    isMouseDown.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    trailRef.current = [{ x, y, time: Date.now() }];
    lastMousePos.current = { x, y };
  };

  const handlePointerUp = () => {
    isMouseDown.current = false;
    lastMousePos.current = null;
  };

  // Mouse controls
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handlePointerDown(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  // Touch controls for mobile support
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  return (
    <div className={`fruitslasher-container ${screenShake ? 'fruitslasher-shake' : ''}`}>
      {/* Game Header details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: 'var(--accent-primary-glow)', borderRadius: 'var(--radius-md)' }}>
            <Coins size={22} color="var(--accent-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Fruit Slasher</h2>
            <p className="fruitslasher-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
              Interactive Arcade Slicing &amp; Crash Betting
            </p>
          </div>
        </div>

        <button 
          className="btn-glass" 
          onClick={() => onNavigate('games')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <LogOut size={16} />
          <span>Exit Game</span>
        </button>
      </div>

      {/* Primary Layout Grid */}
      <div className="fruitslasher-layout">
        
        {/* LEFT COLUMN: GAME CANVAS WRAPPER */}
        <div className="fruitslasher-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className={`fruitslasher-canvas ${gameState === 'crashed' ? 'fruitslasher-slow-mo' : ''}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={handlePointerUp}
          />

          {/* Floating sound toggle */}
          <button 
            className="fruitslasher-audio-btn" 
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* HUD Overlay inside Canvas */}
          {gameState === 'playing' && (
            <div className="fruitslasher-hud">
              <div className="fruitslasher-stats">
                <div className="fruitslasher-hud-card">
                  <span className="fruitslasher-hud-label">Multiplier</span>
                  <span className="fruitslasher-hud-val multiplier">{multiplier.toFixed(2)}x</span>
                </div>
                <div className="fruitslasher-hud-card">
                  <span className="fruitslasher-hud-label">Score</span>
                  <span className="fruitslasher-hud-val" style={{ color: '#fff' }}>{score}</span>
                </div>
              </div>

              <div className="fruitslasher-hearts">
                {[1, 2, 3].map((heart) => (
                  <Heart 
                    key={heart} 
                    size={20} 
                    fill={lives >= heart ? '#ef4444' : 'transparent'} 
                    className={`fruitslasher-heart-icon ${lives < heart ? 'lost' : ''}`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* SCREEN OVERLAYS: Start banner */}
          {gameState === 'idle' && (
            <div className="fruitslasher-overlay">
              <ShieldAlert size={56} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
              <h3 className="fruitslasher-banner-title" style={{ color: 'var(--text-primary)' }}>Fruit Slasher</h3>
              <div className="fruitslasher-instruction-card">
                <p><strong>How to Play:</strong> Select your bet size and click <strong>"START GAME"</strong>.</p>
                <ul>
                  <li>Drag your cursor or swipe your screen to slice flying fruits.</li>
                  <li>Slicing fruits increases your cashout multiplier.</li>
                  <li>Avoid the **Bombs**! If you slice one, you crash instantly.</li>
                  <li>Do not miss! Letting a fruit fall costs 1 of your 3 lives.</li>
                  <li>Click **"CASH OUT"** to secure your winnings before you crash!</li>
                </ul>
              </div>
              <button 
                className="fruitslasher-action-btn start" 
                onClick={handleStartGame} 
                disabled={loading}
                style={{ width: '100%', maxWidth: '280px' }}
              >
                <Play size={20} />
                <span>{loading ? 'Starting...' : 'Start Game'}</span>
              </button>
            </div>
          )}

          {/* SCREEN OVERLAYS: Cashed Out banner */}
          {gameState === 'cashed_out' && (
            <div className="fruitslasher-overlay win">
              <Award size={64} color="#22c55e" style={{ marginBottom: '16px' }} />
              <h3 className="fruitslasher-banner-title">Cashed Out!</h3>
              <p style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '8px' }}>
                You successfully claimed <strong>{finalMultiplier.toFixed(2)}x</strong>
              </p>
              <h4 style={{ color: '#22c55e', fontSize: '2.5rem', fontWeight: 900, margin: '12px 0' }}>
                +{winPayout.toFixed(2)} INR
              </h4>
              <button 
                className="btn btn-primary" 
                onClick={() => setGameState('idle')}
                style={{ width: '100%', maxWidth: '180px', marginTop: '16px' }}
              >
                Play Again
              </button>
            </div>
          )}

          {/* SCREEN OVERLAYS: Crashed / Bomb Hit banner */}
          {gameState === 'crashed' && (
            <div className="fruitslasher-overlay lost">
              <AlertCircle size={64} color="#ef4444" style={{ marginBottom: '16px' }} />
              <h3 className="fruitslasher-banner-title">Crashed!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '8px' }}>
                You hit a bomb or ran out of lives at {multiplier.toFixed(2)}x.
              </p>
              <h4 style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 800, margin: '8px 0' }}>
                0.00 INR
              </h4>
              <button 
                className="btn btn-primary" 
                onClick={() => setGameState('idle')}
                style={{ width: '100%', maxWidth: '180px', marginTop: '16px', backgroundColor: '#ef4444' }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: BET CONTROL PANEL */}
        <div className="fruitslasher-sidebar">
          <div className="fs-controls">
            {/* Static Balance Layout */}
            <div className="fs-balances-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Main Wallet:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{mainBalance.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gaming Bonus:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{gamingBonus.toFixed(2)}</span>
              </div>
            </div>

            {/* Bet Amount Header (Bet Amount + Auto Cashout Toggle) */}
            <div className="fs-bet-header">
              <div className="fs-controls-label">Bet Amount (INR)</div>
              
              {/* Auto Cashout Toggle */}
              <div className="fs-auto-cashout-wrap">
                <span className="fs-auto-label">AUTO</span>
                <label className="fs-switch">
                  <input 
                    type="checkbox" 
                    checked={autoCashoutActive} 
                    onChange={(e) => setAutoCashoutActive(e.target.checked)} 
                    disabled={loading || gameState === 'playing'} 
                  />
                  <span className="fs-switch-slider" />
                </label>
                {autoCashoutActive && (
                  <input 
                    type="number" 
                    value={autoCashout} 
                    placeholder="2.5"
                    onChange={(e) => setAutoCashout(e.target.value)} 
                    className="fs-auto-input"
                    step="0.1"
                    min="1.05"
                    disabled={loading || gameState === 'playing'}
                  />
                )}
              </div>
            </div>

            {/* Bet Input with ½ and 2x */}
            <div className="fs-bet-input-wrap">
              <button 
                className="fs-step-btn" 
                onClick={handleHalf} 
                disabled={loading || gameState === 'playing'}
              >
                ½
              </button>
              <input 
                type="number" 
                value={betAmount} 
                onChange={(e) => setBetAmount(e.target.value)} 
                disabled={loading || gameState === 'playing'} 
                className="fs-bet-input"
              />
              <button 
                className="fs-step-btn" 
                onClick={handleDouble} 
                disabled={loading || gameState === 'playing'}
              >
                2×</button>
            </div>

            {/* Presets Row */}
            <div className="fs-quick-bets">
              {[10, 50, 100, 500].map((amt) => (
                <button 
                  key={amt} 
                  className={`fs-quick-btn ${betAmount === amt.toString() ? 'active' : ''}`} 
                  onClick={() => handlePreset(amt)} 
                  disabled={loading || gameState === 'playing'}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {/* Main Action Button */}
            {gameState !== 'playing' ? (
              <button 
                className="fs-action-btn fs-action-start" 
                onClick={handleStartGame} 
                disabled={loading}
              >
                {loading ? 'Processing...' : `Start Game — ₹${betAmount}`}
              </button>
            ) : (
              <button 
                className="fs-action-btn fs-action-cashout" 
                onClick={() => triggerCashout(multiplier)}
              >
                <span>Cash Out</span>
                <span className="fs-cashout-payout">
                  {(parseFloat(betAmount) * multiplier).toFixed(2)} INR
                </span>
              </button>
            )}

            {/* Error messages */}
            {errorMsg && (
              <div className="fs-error-msg">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Interactive banner tips */}
          <div className="fruitslasher-banner">
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Security Guard:</strong> Swiping coordinates are monitored and validated dynamically. Late cashouts due to connection lag or attempts to alter multipliers will trigger a round failure.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default FruitSlasherGame;
