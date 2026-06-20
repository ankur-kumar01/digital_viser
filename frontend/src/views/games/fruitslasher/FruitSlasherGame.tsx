import React, { useState, useEffect, useRef } from 'react';
import { Heart, Volume2, VolumeX, Play, LogOut, Sparkles } from 'lucide-react';
import './FruitSlasherGame.css';

interface Props {
  onNavigate: (view: string) => void;
}

class GameAudioSynth {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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
    } catch (e) { console.warn('Audio error:', e); }
  }

  playSplat() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
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
      osc.stop(now + 0.08);
    } catch (e) { console.warn(e); }
  }

  playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
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
    } catch (e) { console.warn(e); }
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
    } catch (e) { console.warn(e); }
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
    } catch (e) { console.warn(e); }
  }
}

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

const HIGH_SCORE_KEY = 'fruit-slasher-highscore';

export const FruitSlasherGame: React.FC<Props> = ({ onNavigate }) => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'crashed'>('idle');
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [highScore, setHighScore] = useState<number>(() => {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });

  const audioSynthRef = useRef<GameAudioSynth | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasAreaRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number | null>(null);

  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const gameStateRef = useRef<'idle' | 'playing' | 'crashed'>('idle');
  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const textEffectsRef = useRef<FloatingText[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const lastSpawnTime = useRef<number>(0);
  const nextSpawnInterval = useRef<number>(2000);
  const fruitIdCounter = useRef<number>(0);

  useEffect(() => {
    audioSynthRef.current = new GameAudioSynth();
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (audioSynthRef.current) audioSynthRef.current.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const resizeCanvas = () => {
      const container = canvasAreaRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const aspect = 16 / 9;

      let displayWidth: number, displayHeight: number;
      if (containerWidth / containerHeight > aspect) {
        displayHeight = containerHeight;
        displayWidth = displayHeight * aspect;
      } else {
        displayWidth = containerWidth;
        displayHeight = displayWidth / aspect;
      }

      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    if (canvasAreaRef.current) observer.observe(canvasAreaRef.current);

    window.addEventListener('orientationchange', resizeCanvas);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', resizeCanvas);
    };
  }, []);

  const saveHighScore = (newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem(HIGH_SCORE_KEY, newScore.toString());
    }
  };

  const handleStartGame = () => {
    if (gameState === 'playing') return;
    setScore(0);
    setLives(3);
    scoreRef.current = 0;
    livesRef.current = 3;
    fruitsRef.current = [];
    particlesRef.current = [];
    textEffectsRef.current = [];
    trailRef.current = [];
    setGameState('playing');
    lastSpawnTime.current = Date.now();
    nextSpawnInterval.current = 1200;
  };

  const triggerCrash = () => {
    if (gameStateRef.current !== 'playing') return;
    setGameState('crashed');
    gameStateRef.current = 'crashed';
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 500);
    if (audioSynthRef.current) audioSynthRef.current.playExplosion();
    saveHighScore(scoreRef.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const V_WIDTH = 1280;
    const V_HEIGHT = 720;
    canvas.width = V_WIDTH;
    canvas.height = V_HEIGHT;

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

    const spawnFruitWave = () => {
      const count = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < count; i++) {
        const id = fruitIdCounter.current++;
        const startX = V_WIDTH * (0.2 + Math.random() * 0.6);
        const startY = V_HEIGHT + 60;
        const targetX = V_WIDTH * (0.3 + Math.random() * 0.4);
        const vx = (targetX - startX) / 60;
        const vy = -(14 + Math.random() * 6);

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
      const currentScore = scoreRef.current;
      nextSpawnInterval.current = Math.max(1000, 2500 - currentScore * 45);
    };

    const drawFruitVector = (c: CanvasRenderingContext2D, f: Fruit) => {
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.rotation);

      if (f.type === 'watermelon') {
        c.beginPath();
        c.arc(0, 0, f.radius, 0, Math.PI * 2);
        c.fillStyle = '#15803d';
        c.fill();
        c.strokeStyle = '#22c55e';
        c.lineWidth = 3;
        c.stroke();
        c.beginPath();
        c.arc(0, 0, f.radius - 8, 0, Math.PI * 2);
        c.fillStyle = '#ef4444';
        c.fill();
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
        c.beginPath();
        c.arc(-f.radius * 0.2, 0, f.radius * 0.8, 0, Math.PI * 2);
        c.arc(f.radius * 0.2, 0, f.radius * 0.8, 0, Math.PI * 2);
        c.fillStyle = '#dc2626';
        c.fill();
        c.beginPath();
        c.arc(-f.radius * 0.1, -f.radius * 0.1, f.radius * 0.4, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.fill();
        c.beginPath();
        c.moveTo(0, -f.radius * 0.7);
        c.quadraticCurveTo(f.radius * 0.3, -f.radius * 1.1, f.radius * 0.2, -f.radius * 1.2);
        c.strokeStyle = '#78350f';
        c.lineWidth = 4;
        c.stroke();
        c.beginPath();
        c.ellipse(f.radius * 0.3, -f.radius * 1.0, 8, 4, -Math.PI / 4, 0, Math.PI * 2);
        c.fillStyle = '#16a34a';
        c.fill();
      } else if (f.type === 'orange') {
        c.beginPath();
        c.arc(0, 0, f.radius, 0, Math.PI * 2);
        c.fillStyle = '#ea580c';
        c.fill();
        c.beginPath();
        c.arc(0, 0, f.radius - 4, 0, Math.PI * 2);
        c.fillStyle = '#f97316';
        c.fill();
        c.strokeStyle = '#ffedd5';
        c.lineWidth = 1.5;
        c.stroke();
        c.strokeStyle = '#ffedd5';
        c.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(i * Math.PI / 4) * (f.radius - 4), Math.sin(i * Math.PI / 4) * (f.radius - 4));
          c.stroke();
        }
      } else if (f.type === 'golden') {
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
        c.shadowColor = '#fbbf24';
        c.shadowBlur = 15;
        c.beginPath();
        c.arc(0, 0, f.radius - 2, 0, Math.PI * 2);
        c.stroke();
      } else if (f.type === 'bomb') {
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
        c.beginPath();
        c.moveTo(0, -f.radius + 3);
        c.quadraticCurveTo(12, -f.radius - 12, 18, -f.radius - 8);
        c.strokeStyle = '#d97706';
        c.lineWidth = 3;
        c.stroke();
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
        c.beginPath();
        if (leftSide) {
          c.rect(-f.radius * 2, -f.radius * 2, f.radius * 2, f.radius * 4);
        } else {
          c.rect(0, -f.radius * 2, f.radius * 2, f.radius * 4);
        }
        c.clip();
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

    const updateGame = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

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
        const elapsed = Date.now() - lastSpawnTime.current;
        if (elapsed > nextSpawnInterval.current) {
          spawnFruitWave();
        }
      }

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
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

      const fruits = fruitsRef.current;
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];

        if (!f.sliced) {
          f.x += f.vx;
          f.y += f.vy;
          f.vy += 0.22;
          f.rotation += f.rotSpeed;

          if (f.y > V_HEIGHT + 80 && f.vy > 0) {
            fruits.splice(i, 1);
            if (isPlaying && f.type !== 'bomb') {
              const currentLives = livesRef.current - 1;
              livesRef.current = currentLives;
              setLives(currentLives);
              if (audioSynthRef.current) audioSynthRef.current.playLifeLost();
              if (currentLives <= 0) {
                triggerCrash();
              }
            }
            continue;
          }

          drawFruitVector(ctx, f);

          if (isPlaying && isMouseDown.current && trailRef.current.length >= 2) {
            const trail = trailRef.current;
            const p2 = trail[trail.length - 1];
            const p1 = trail[trail.length - 2];
            const d = distToSegment(f.x, f.y, p1.x, p1.y, p2.x, p2.y);
            if (d <= f.radius) {
              f.sliced = true;
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
                triggerCrash();
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
                if (audioSynthRef.current) audioSynthRef.current.playSplat();

                let points = 10;
                let scoreText = '+10';
                let textColor = '#22c55e';

                if (f.type === 'golden') {
                  points = 25;
                  scoreText = '+25 GOLD!';
                  textColor = '#fbbf24';
                } else if (f.type === 'watermelon') {
                  points = 15;
                  scoreText = '+15';
                  textColor = '#10b981';
                }

                const newScore = scoreRef.current + points;
                scoreRef.current = newScore;
                setScore(newScore);

                if (audioSynthRef.current) audioSynthRef.current.playTick();

                textEffectsRef.current.push({
                  id: Date.now() + Math.random(),
                  x: f.x,
                  y: f.y - 10,
                  text: scoreText,
                  color: textColor,
                  alpha: 1.0,
                  scale: 1.0
                });

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
          f.halfLeftX += f.halfVxLeft;
          f.halfRightX += f.halfVxRight;
          f.halfLeftY += f.halfVy;
          f.halfRightY += f.halfVy;
          f.halfVy += 0.28;
          f.halfRotLeft -= 0.08;
          f.halfRotRight += 0.08;

          if (f.halfLeftY > V_HEIGHT + 60 && f.halfRightY > V_HEIGHT + 60) {
            fruits.splice(i, 1);
            continue;
          }

          drawFruitHalves(ctx, f);
        }
      }

      const trail = trailRef.current;
      const now = Date.now();
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

      const texts = textEffectsRef.current;
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.y -= 1.8;
        t.alpha -= 0.025;
        t.scale += 0.005;
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

      requestRef.current = requestAnimationFrame(updateGame);
    };

    requestRef.current = requestAnimationFrame(updateGame);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  const handlePointerMove = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !isMouseDown.current) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    let playWhoosh = false;
    if (lastMousePos.current) {
      const dx = x - lastMousePos.current.x;
      const dy = y - lastMousePos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 35) playWhoosh = true;
    }
    if (playWhoosh && audioSynthRef.current) audioSynthRef.current.playWhoosh();
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

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => handlePointerMove(e.clientX, e.clientY);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  return (
    <div className={`fruitslasher-container ${screenShake ? 'fruitslasher-shake' : ''}`}>
      <div className="fruitslasher-canvas-area" ref={canvasAreaRef}>
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

        <button
          className="fruitslasher-exit-btn"
          onClick={() => onNavigate('games')}
          title="Exit Game"
        >
          <LogOut size={18} />
        </button>

        <button
          className="fruitslasher-audio-btn"
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>

        {gameState === 'playing' && (
          <div className="fruitslasher-hud">
            <div className="fruitslasher-stats">
              <div className="fruitslasher-hud-card">
                <span className="fruitslasher-hud-label">Score</span>
                <span className="fruitslasher-hud-val">{score}</span>
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

        {gameState === 'idle' && (
          <div className="fruitslasher-overlay">
            <Sparkles size={56} color="#8B5CF6" style={{ marginBottom: '16px' }} />
            <h3 className="fruitslasher-banner-title">Fruit Slasher</h3>
            <div className="fruitslasher-instruction-card">
              <p><strong>How to Play:</strong> Tap <strong>"PLAY"</strong> to start.</p>
              <ul>
                <li>Swipe your screen or drag your mouse to slice flying fruits.</li>
                <li>Each fruit sliced adds to your score.</li>
                <li>Avoid the <strong>Bombs</strong>! If you slice one, game over!</li>
                <li>Don't miss! Letting a fruit fall costs 1 of your 3 lives.</li>
                <li>Lose all lives and the game ends.</li>
              </ul>
              {highScore > 0 && (
                <p style={{ color: '#fbbf24', fontSize: '0.9rem', marginTop: '8px' }}>
                  Best Score: {highScore}
                </p>
              )}
            </div>
            <button
              className="fruitslasher-action-btn start"
              onClick={handleStartGame}
            >
              <Play size={20} />
              <span>Play</span>
            </button>
          </div>
        )}

        {gameState === 'crashed' && (
          <div className="fruitslasher-overlay lost">
            <Sparkles size={56} color="#ef4444" style={{ marginBottom: '16px' }} />
            <h3 className="fruitslasher-banner-title">Game Over!</h3>
            <div className="fruitslasher-final-score">{score}</div>
            {score >= highScore && score > 0 && (
              <div className="fruitslasher-high-score">
                <span className="fruitslasher-crown">🏆</span> New High Score!
              </div>
            )}
            {highScore > 0 && (
              <div className="fruitslasher-high-score">
                Best: {highScore}
              </div>
            )}
            <button
              className="fruitslasher-action-btn retry"
              onClick={handleStartGame}
            >
              <Play size={20} />
              <span>Play Again</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FruitSlasherGame;
