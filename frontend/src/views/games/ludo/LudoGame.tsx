import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Volume2, VolumeX, Sparkles, Play, Dices, Users, Plus, Star, RefreshCw, Trophy } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { getToken, gamesAPI, globalConfigAPI, ludoAPI } from '../../../api';
import './LudoGame.css';

interface Props {
  user: any;
  refreshUser: () => void;
  onNavigate: (view: string) => void;
}

const QUICK_WAGERS = [10, 50, 100, 200, 500, 1000, 2000];

// Standard Ludo coordinate mappings (15x15 Grid: row 0-14, col 0-14)
const hostBasePos = [{ r: 2, c: 2 }, { r: 2, c: 3 }, { r: 3, c: 2 }, { r: 3, c: 3 }];
const challengerBasePos = [{ r: 11, c: 11 }, { r: 12, c: 11 }, { r: 11, c: 12 }, { r: 12, c: 12 }];

const trackCells = [
  { r: 6, c: 1 },  // 1 (Host Start, Safe)
  { r: 6, c: 2 },  // 2
  { r: 6, c: 3 },  // 3
  { r: 6, c: 4 },  // 4
  { r: 6, c: 5 },  // 5
  { r: 5, c: 6 },  // 6
  { r: 4, c: 6 },  // 7
  { r: 3, c: 6 },  // 8
  { r: 2, c: 6 },  // 9 (Safe)
  { r: 1, c: 6 },  // 10
  { r: 0, c: 6 },  // 11
  { r: 0, c: 7 },  // 12
  { r: 0, c: 8 },  // 13
  { r: 1, c: 8 },  // 14 (Safe)
  { r: 2, c: 8 },  // 15
  { r: 3, c: 8 },  // 16
  { r: 4, c: 8 },  // 17
  { r: 5, c: 8 },  // 18
  { r: 6, c: 9 },  // 19
  { r: 6, c: 10 }, // 20
  { r: 6, c: 11 }, // 21
  { r: 6, c: 12 }, // 22 (Safe)
  { r: 6, c: 13 }, // 23
  { r: 6, c: 14 }, // 24
  { r: 7, c: 14 }, // 25
  { r: 8, c: 14 }, // 26
  { r: 8, c: 13 }, // 27 (Challenger Start, Safe)
  { r: 8, c: 12 }, // 28
  { r: 8, c: 11 }, // 29
  { r: 8, c: 10 }, // 30
  { r: 8, c: 9 },  // 31
  { r: 9, c: 8 },  // 32
  { r: 10, c: 8 }, // 33
  { r: 11, c: 8 }, // 34
  { r: 12, c: 8 }, // 35 (Safe)
  { r: 13, c: 8 }, // 36
  { r: 14, c: 8 }, // 37
  { r: 14, c: 7 }, // 38
  { r: 14, c: 6 }, // 39
  { r: 13, c: 6 }, // 40 (Safe)
  { r: 12, c: 6 }, // 41
  { r: 11, c: 6 }, // 42
  { r: 10, c: 6 }, // 43
  { r: 9, c: 6 },  // 44
  { r: 8, c: 5 },  // 45
  { r: 8, c: 4 },  // 46
  { r: 8, c: 3 },  // 47
  { r: 8, c: 2 },  // 48 (Safe)
  { r: 8, c: 1 },  // 49
  { r: 8, c: 0 },  // 50
  { r: 7, c: 0 },  // 51
  { r: 6, c: 0 }   // 52
];

const maskName = (name: any) => {
  if (!name) return '***';
  const nameStr = String(name);
  const cleanPhone = nameStr.replace(/[\s\-\+\(\)]/g, '');
  const isPhone = /^\d+$/.test(cleanPhone);
  if (isPhone) {
    return '***' + cleanPhone.slice(-4);
  }
  if (nameStr.length <= 2) {
    return nameStr + '***';
  }
  if (nameStr.length <= 4) {
    return nameStr[0] + '***' + nameStr[nameStr.length - 1];
  }
  const first = nameStr.substring(0, 2);
  const last = nameStr.substring(nameStr.length - 2);
  return `${first}***${last}`;
};

export const LudoGame: React.FC<Props> = ({ user, refreshUser, onNavigate }) => {
  const mainBalance = typeof user?.balance === 'string' ? parseFloat(user.balance) : (user?.balance || 0);
  const gamingBonus = typeof user?.gaming_bonus_balance === 'string' ? parseFloat(user.gaming_bonus_balance) : (user?.gaming_bonus_balance || 0);
  const userBalance = Math.max(mainBalance, gamingBonus);

  // Sound persisted state toggle
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('av_muted') === 'true';
    } catch (e) {
      return false;
    }
  });

  const socketRef = useRef<Socket | null>(null);

  // Ludo Game State variables
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any | null>(null);
  const [wagerInput, setWagerInput] = useState('100');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [recentBets, setRecentBets] = useState<any[]>([]);
  const [myBets, setMyBets] = useState<any[]>([]);
  const [topBets, setTopBets] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'all' | 'my' | 'top'>('all');
  
  // Direct Automated Matchmaking states
  const [isMatching, setIsMatching] = useState(false);
  const [matchingTimeLeft, setMatchingTimeLeft] = useState<number>(30);
  const [matchingWager, setMatchingWager] = useState(100);
  const [matchingRoomId, setMatchingRoomId] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Tournament states
  const [gameMode, setGameMode] = useState<'quick' | 'tournament'>('quick');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [myTournaments, setMyTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  const [tournamentStandings, setTournamentStandings] = useState<any[]>([]);
  const [myTournamentStats, setMyTournamentStats] = useState<any | null>(null);
  const [tJoinLoading, setTJoinLoading] = useState(false);
  const [tLoading, setTLoading] = useState(false);

  // Game animations & alerts
  const [diceRolling, setDiceRolling] = useState(false);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [showLoseOverlay, setShowLoseOverlay] = useState(false);
  const [winPayout, setWinPayout] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(15);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Identify host status in current room
  const isHostUser = currentRoom ? currentRoom.hostId === user?.id : false;
  const isPlayerTurn = currentRoom 
    ? (currentRoom.boardState.turn === 'host' && isHostUser) || (currentRoom.boardState.turn === 'challenger' && !isHostUser)
    : false;

  // Sync turn timers
  useEffect(() => {
    if (!currentRoom || currentRoom.boardState.phase === 'game_over') return;
    
    const interval = setInterval(() => {
      const start = currentRoom.boardState.turnStartTime || Date.now();
      const elapsed = Date.now() - start;
      const rem = Math.max(0, Math.ceil((15000 - elapsed) / 1000));
      setTurnTimeLeft(rem);
    }, 200);

    return () => clearInterval(interval);
  }, [currentRoom]);

  // Sync mute to localstorage
  useEffect(() => {
    try {
      localStorage.setItem('av_muted', isMuted ? 'true' : 'false');
    } catch (e) {
      console.warn('localStorage access blocked:', e);
    }
  }, [isMuted]);

  // Fetch tournaments
  useEffect(() => {
    if (gameMode !== 'tournament' || currentRoom) return;
    fetchTournaments();
    fetchMyTournaments();
  }, [gameMode, currentRoom]);

  const fetchTournaments = async () => {
    setTLoading(true);
    try {
      const t = await ludoAPI.getTournaments();
      setTournaments(t);
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
    } finally {
      setTLoading(false);
    }
  };

  const fetchMyTournaments = async () => {
    try {
      const t = await ludoAPI.getMyTournaments();
      setMyTournaments(t);
    } catch (err) {
      console.error('Failed to fetch my tournaments:', err);
    }
  };

  const handleJoinTournament = async (tournamentId: number) => {
    setTJoinLoading(true);
    try {
      const result = await ludoAPI.joinTournament(tournamentId);
      if (result.success) {
        refreshUser();
        fetchTournaments();
        fetchMyTournaments();
        showToast('Joined tournament! Select a match wager to play.');
        setSelectedTournament(tournamentId);
      }
    } catch (err: any) {
      alert(err?.error || 'Failed to join tournament');
    } finally {
      setTJoinLoading(false);
    }
  };

  const viewTournamentStandings = async (t: any) => {
    try {
      const data: any = await ludoAPI.getTournamentStandings(t.id);
      setTournamentStandings(data.standings || []);
    } catch (err) {
      console.error('Failed to fetch standings:', err);
    }
  };

  // Load Ludo Bets tables
  const loadBetsHistory = () => {
    if (historyTab === 'all') {
      gamesAPI.getRealRecentLudoBets().then(setRecentBets).catch(console.error);
    } else if (historyTab === 'my') {
      gamesAPI.getRealMyLudoBets().then(setMyBets).catch(console.error);
    } else if (historyTab === 'top') {
      gamesAPI.getRealTopLudoBets().then(setTopBets).catch(console.error);
    }
  };

  useEffect(() => {
    loadBetsHistory();
  }, [historyTab, currentRoom]);

  // Web Audio Synthesized effects
  const playBeepSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const playRollSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
    } catch (e) {}
  };

  const playMoveSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  const playCaptureSound = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
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
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major chord
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
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
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.52);
    } catch (e) {}
  };

  // Socket Connection and Event Bindings
  useEffect(() => {
    const token = getToken();
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let socketUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
    if (!socketUrl) socketUrl = isLocalhost ? 'http://localhost:5000' : window.location.origin;

    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('ludo:get_rooms');
      socket.emit('ludo:get_active_game', (res: any) => {
        if (res && res.success && res.room) {
          setCurrentRoom(res.room);
          showToast('Resuming active Ludo match...');
        }
      });
    });

    socket.on('ludo:rooms_list', (data: any[]) => {
      setRooms(data || []);
    });

    socket.on('ludo:game_start', (roomData: any) => {
      setCurrentRoom(roomData);
      setIsCreatingRoom(false);
      setIsMatching(false);
      setMatchingRoomId(null);
      refreshUser();
      showToast('Game Started! Match ID: #' + roomData.id);
    });

    socket.on('ludo:dice_rolled', (data: { roll: number; boardState: any; roomId: number }) => {
      playRollSound();
      setDiceRolling(true);
      setTimeout(() => {
        setDiceRolling(false);
        setCurrentRoom(prev => prev ? { ...prev, boardState: data.boardState } : null);
      }, 700);
    });

    socket.on('ludo:board_updated', (data: { boardState: any; roomId: number }) => {
      playMoveSound();
      setCurrentRoom(prev => prev ? { ...prev, boardState: data.boardState } : null);
    });

    socket.on('ludo:turn_passed', (data: { boardState: any; reason: string }) => {
      setCurrentRoom(prev => prev ? { ...prev, boardState: data.boardState } : null);
    });

    socket.on('ludo:join_room_notify', (data: { roomId: number }) => {
      // Track room for disconnect handling
    });

    socket.on('ludo:game_over', (data: { winnerId: number; winPayout: number; roomId: number }) => {
      const isWinner = data.winnerId === user?.id;
      setWinPayout(data.winPayout);
      if (isWinner) {
        setShowWinOverlay(true);
        playWinSound();
        setTimeout(() => setShowWinOverlay(false), 6000);
      } else {
        setShowLoseOverlay(true);
        playLoseSound();
        setTimeout(() => setShowLoseOverlay(false), 5000);
      }
      setCurrentRoom(null);
      refreshUser();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Matchmaking Timer Countdown effect
  useEffect(() => {
    if (!isMatching) return;

    const interval = setInterval(() => {
      setMatchingTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleMatchmakingTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isMatching, matchingRoomId, matchingWager]);

  const handleMatchmakingTimeout = () => {
    setIsMatching(false);
    
    // Cancel search room we created on server
    if (matchingRoomId !== null) {
      socketRef.current?.emit('ludo:cancel_room', { roomId: matchingRoomId }, (res: any) => {
        setMatchingRoomId(null);
        
        // Launch bot match
        showToast('Match found! Starting game...');
        socketRef.current?.emit('ludo:play_bot', { entryFee: matchingWager, tournamentId: selectedTournament }, (botRes: any) => {
          if (botRes.error) {
            showToast(botRes.error);
          }
          refreshUser();
        });
      });
    } else {
      showToast('Match found! Starting game...');
      socketRef.current?.emit('ludo:play_bot', { entryFee: matchingWager, tournamentId: selectedTournament }, (botRes: any) => {
        if (botRes.error) {
          showToast(botRes.error);
        }
        refreshUser();
      });
    }
  };

  // Actions
  const handleFindMatch = (overrideFee?: number, overrideTournamentId?: number) => {
    const fee = overrideFee !== undefined ? overrideFee : parseFloat(wagerInput);
    const tId = overrideTournamentId !== undefined ? overrideTournamentId : selectedTournament;

    if (!tId) {
      if (isNaN(fee) || fee < 10 || fee > 5000) {
        return showToast('Wager fee must be between ₹10 and ₹5000');
      }
      if (fee > userBalance) {
        return showToast('Insufficient balance to wager ₹' + fee.toFixed(2));
      }
    }

    setIsMatching(true);
    setMatchingTimeLeft(10);
    setMatchingWager(fee);
    setMatchingRoomId(null);

    // Ensure we set selectedTournament in state so matchmaking timeout uses it
    if (tId) setSelectedTournament(tId);

    socketRef.current?.emit('ludo:find_match', { entryFee: fee, tournamentId: tId }, (res: any) => {
      if (res.error) {
        setIsMatching(false);
        showToast(res.error);
      } else {
        if (res.action === 'created') {
          // We are host, waiting in the pool
          setMatchingRoomId(res.room.id);
        }
      }
    });
  };

  const handleCancelMatchmaking = () => {
    setIsMatching(false);
    if (matchingRoomId !== null) {
      socketRef.current?.emit('ludo:cancel_room', { roomId: matchingRoomId }, (res: any) => {
        if (res.error) {
          console.error(res.error);
        }
        setMatchingRoomId(null);
        refreshUser();
      });
    }
  };

  const handlePlayBot = (overrideFee?: number, overrideTournamentId?: number) => {
    const fee = overrideFee !== undefined ? overrideFee : parseFloat(wagerInput);
    const tId = overrideTournamentId !== undefined ? overrideTournamentId : selectedTournament;

    if (!tId) {
      if (isNaN(fee) || fee < 10 || fee > 5000) {
        return alert('Wager fee must be between ₹10 and ₹5000');
      }
      if (fee > userBalance) {
        return alert('Insufficient balance to play wager ₹' + fee.toFixed(2));
      }
    }
    setIsCreatingRoom(true);
    socketRef.current?.emit('ludo:play_bot', { entryFee: fee, tournamentId: tId }, (res: any) => {
      if (res.error) {
        setIsCreatingRoom(false);
        alert(res.error);
      }
    });
  };

  const handleCancelRoom = () => {
    if (!currentRoom) return;
    socketRef.current?.emit('ludo:cancel_room', { roomId: currentRoom.id }, (res: any) => {
      if (res.error) {
        showToast(res.error);
      } else {
        setCurrentRoom(null);
        refreshUser();
      }
    });
  };

  const handleRollDice = () => {
    if (!isPlayerTurn || currentRoom.boardState.phase !== 'roll' || diceRolling) return;
    socketRef.current?.emit('ludo:roll_dice', { roomId: currentRoom.id }, (res: any) => {
      if (res.error && !res.error.includes('Waiting for piece move')) {
        showToast(res.error);
      }
    });
  };

  const handleMovePiece = (pieceIndex: number) => {
    if (!isPlayerTurn || currentRoom.boardState.phase !== 'move') return;
    socketRef.current?.emit('ludo:move_piece', { roomId: currentRoom.id, pieceIndex }, (res: any) => {
      if (res.error && !res.error.includes('Waiting for dice roll')) {
        showToast(res.error);
      }
    });
  };

  const handleExitGame = () => {
    if (isMatching) {
      handleCancelMatchmaking();
    }
    if (currentRoom && currentRoom.boardState.status === 'waiting') {
      handleCancelRoom();
      onNavigate('games');
      return;
    }
    if (currentRoom && currentRoom.boardState.phase !== 'game_over') {
      setShowExitConfirm(true);
      return;
    }
    onNavigate('games');
  };

  const confirmExitGame = () => {
    if (currentRoom && currentRoom.boardState.phase !== 'game_over') {
      socketRef.current?.emit('ludo:forfeit', { roomId: currentRoom.id });
    }
    setShowExitConfirm(false);
    onNavigate('games');
  };

  const cancelExitGame = () => {
    setShowExitConfirm(false);
  };

  // Check if a piece can move
  const isValidPieceMove = (isHost: boolean, position: number, dice: number) => {
    if (position === 0) {
      return dice === 6;
    }
    return position + dice <= 58;
  };

  const hasAnyValidMove = () => {
    if (!currentRoom) return false;
    const pieces = isHostUser ? currentRoom.boardState.hostPieces : currentRoom.boardState.challengerPieces;
    for (let i = 0; i < 4; i++) {
      if (isValidPieceMove(isHostUser, pieces[i], currentRoom.boardState.dice)) {
        return true;
      }
    }
    return false;
  };

  const renderDiceRingClass = () => {
    if (!currentRoom || !isPlayerTurn || currentRoom.boardState.phase !== 'move' || diceRolling) return '';
    return hasAnyValidMove() ? 'ring-valid-move' : 'ring-invalid-move';
  };

  // Helper coordinates mapping for board pawn renders
  const getPieceCoords = (isHost: boolean, pieceIndex: number, position: number) => {
    if (position === 0) {
      return isHost ? hostBasePos[pieceIndex] : challengerBasePos[pieceIndex];
    }
    if (position === 58) {
      return isHost ? { r: 7, c: 6 } : { r: 7, c: 8 };
    }
    if (position >= 53 && position <= 57) {
      const step = position - 52;
      return isHost ? { r: 7, c: step } : { r: 7, c: 14 - step };
    }
    const trackIdx = isHost ? (position - 1) : (position - 1 + 26) % 52;
    return trackCells[trackIdx];
  };

  // Construct board cell elements dynamically
  const renderBoardCells = () => {
    const cells = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Host Base container
        if (r < 6 && c < 6) {
          if (r === 0 && c === 0) {
            cells.push(
              <div key="host-base" className="ludo-base green-base" style={{ gridRow: '1 / 7', gridColumn: '1 / 7' }}>
                <div className="base-inner-panel"></div>
              </div>
            );
          }
          if (hostBasePos.some(pos => pos.r === r && pos.c === c)) {
            cells.push(
               <div key={`slot-${r}-${c}`} style={{ gridRow: `${r + 1}`, gridColumn: `${c + 1}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div className="slot green-slot" />
               </div>
            );
          }
          continue;
        }

        // Blue Base (top-right)
        if (r < 6 && c > 8) {
          if (r === 0 && c === 9) {
            cells.push(
              <div key="tr-base" className="ludo-base blue-base" style={{ gridRow: '1 / 7', gridColumn: '10 / 16' }}>
                <div className="base-inner-panel"></div>
              </div>
            );
          }
          const blueBasePos = [{ r: 2, c: 11 }, { r: 2, c: 12 }, { r: 3, c: 11 }, { r: 3, c: 12 }];
          if (blueBasePos.some(pos => pos.r === r && pos.c === c)) {
            cells.push(
               <div key={`slot-${r}-${c}`} style={{ gridRow: `${r + 1}`, gridColumn: `${c + 1}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div className="slot blue-slot" />
               </div>
            );
          }
          continue;
        }

        // Red Base (bottom-left)
        if (r > 8 && c < 6) {
          if (r === 9 && c === 0) {
            cells.push(
              <div key="bl-base" className="ludo-base red-base" style={{ gridRow: '10 / 16', gridColumn: '1 / 7' }}>
                <div className="base-inner-panel"></div>
              </div>
            );
          }
          const redBasePos = [{ r: 11, c: 2 }, { r: 11, c: 3 }, { r: 12, c: 2 }, { r: 12, c: 3 }];
          if (redBasePos.some(pos => pos.r === r && pos.c === c)) {
            cells.push(
               <div key={`slot-${r}-${c}`} style={{ gridRow: `${r + 1}`, gridColumn: `${c + 1}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div className="slot red-slot" />
               </div>
            );
          }
          continue;
        }

        // Challenger Base container
        if (r > 8 && c > 8) {
          if (r === 9 && c === 9) {
            cells.push(
              <div key="challenger-base" className="ludo-base yellow-base" style={{ gridRow: '10 / 16', gridColumn: '10 / 16' }}>
                <div className="base-inner-panel"></div>
              </div>
            );
          }
          if (challengerBasePos.some(pos => pos.r === r && pos.c === c)) {
            cells.push(
               <div key={`slot-${r}-${c}`} style={{ gridRow: `${r + 1}`, gridColumn: `${c + 1}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div className="slot yellow-slot" />
               </div>
            );
          }
          continue;
        }

        // Center Home Area (Triangles)
        if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
          if (r === 6 && c === 6) {
            cells.push(
              <div key="home-center" className="ludo-home-center" style={{ gridRow: '7 / 10', gridColumn: '7 / 10' }}>
                <svg viewBox="0 0 100 100" className="home-center-svg">
                  {/* Left Triangle (Host/Green Home) */}
                  <polygon points="0,0 50,50 0,100" fill="#4caf50" />
                  {/* Right Triangle (Challenger/Yellow Home) */}
                  <polygon points="100,0 50,50 100,100" fill="#ffeb3b" />
                  {/* Top Triangle (Blue) */}
                  <polygon points="0,0 50,50 100,0" fill="#2196f3" />
                  {/* Bottom Triangle (Red) */}
                  <polygon points="0,100 50,50 100,100" fill="#f44336" />
                  
                  {/* Inner divider lines */}
                  <line x1="0" y1="0" x2="100" y2="100" stroke="#1d2026" strokeWidth="2" />
                  <line x1="0" y1="100" x2="100" y2="0" stroke="#1d2026" strokeWidth="2" />
                </svg>
              </div>
            );
          }
          continue;
        }

        // Individual cell styling checks
        let cellClass = 'ludo-cell';
        let isSafe = false;
        let cellLabel = '';

        const trackCellIdx = trackCells.findIndex(tc => tc.r === r && tc.c === c);
        if (trackCellIdx !== -1) {
          const cellNumber = trackCellIdx + 1;
          const safeIndices = [1, 9, 14, 22, 27, 35, 40, 48];
          if (safeIndices.includes(cellNumber)) {
            isSafe = true;
            cellClass += ' cell-safe';
          }
          if (cellNumber === 1) {
            cellClass += ' cell-host-start';
            cellLabel = '➜';
          } else if (cellNumber === 27) {
            cellClass += ' cell-challenger-start';
            cellLabel = '➜';
          }
        } else {
          // Home stretches
          if (r === 7 && c >= 1 && c <= 5) {
            cellClass += ' cell-host-stretch';
          } else if (r === 7 && c >= 9 && c <= 13) {
            cellClass += ' cell-challenger-stretch';
          } else if (c === 7 && r >= 1 && r <= 5) {
            cellClass += ' cell-top-stretch';
          } else if (c === 7 && r >= 9 && r <= 13) {
            cellClass += ' cell-bottom-stretch';
          }
        }

        cells.push(
          <div 
            key={`cell-${r}-${c}`} 
            className={cellClass}
            style={{ gridRow: `${r + 1}`, gridColumn: `${c + 1}` }}
          >
            {isSafe && <Star size={14} className="safe-star-icon" fill="currentColor" />}
            {cellLabel && <span className="cell-arrow-label">{cellLabel}</span>}
          </div>
        );
      }
    }
    return cells;
  };

  // Group multiple pieces occupying the exact same coordinate slots
  const renderPieces = () => {
    if (!currentRoom) return null;

    const hostPieces = currentRoom.boardState.hostPieces || [0, 0, 0, 0];
    const challengerPieces = currentRoom.boardState.challengerPieces || [0, 0, 0, 0];
    const piecesList: any[] = [];

    hostPieces.forEach((pos: number, idx: number) => {
      const coords = getPieceCoords(true, idx, pos);
      piecesList.push({
        isHost: true,
        index: idx,
        position: pos,
        r: coords.r,
        c: coords.c,
        id: `host-${idx}`
      });
    });

    challengerPieces.forEach((pos: number, idx: number) => {
      const coords = getPieceCoords(false, idx, pos);
      piecesList.push({
        isHost: false,
        index: idx,
        position: pos,
        r: coords.r,
        c: coords.c,
        id: `challenger-${idx}`
      });
    });

    // Grouping by "r-c" coordinate string
    const coordGroups: Record<string, typeof piecesList> = {};
    piecesList.forEach(p => {
      const key = `${p.r}-${p.c}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push(p);
    });

    return Object.entries(coordGroups).map(([key, group]) => {
      const count = group.length;
      return group.map((piece, groupIdx) => {
        let scale = 0.78;
        let dx = 0;
        let dy = 0;

        if (count > 1) {
          scale = 0.52;
          if (count === 2) {
            dx = groupIdx === 0 ? -18 : 18;
            dy = 0;
          } else if (count === 3) {
            dx = groupIdx === 0 ? -18 : (groupIdx === 1 ? 18 : 0);
            dy = groupIdx === 2 ? 18 : -18;
          } else {
            dx = groupIdx % 2 === 0 ? -18 : 18;
            dy = groupIdx < 2 ? -18 : 18;
          }
        }

        // Movement viability validation check
        const canMoveThisPiece = isPlayerTurn && 
                                 currentRoom.boardState.phase === 'move' && 
                                 piece.isHost === isHostUser && 
                                 isValidPieceMove(piece.isHost, piece.position, currentRoom.boardState.dice);

        return (
          <button
            key={piece.id}
            className={`ludo-piece ${piece.isHost ? 'host' : 'challenger'} ${canMoveThisPiece ? 'playable pulse' : ''}`}
            style={{
              top: `${(piece.r / 15) * 100}%`,
              left: `${(piece.c / 15) * 100}%`,
              width: `${100 / 15}%`,
              height: `${100 / 15}%`,
              transform: `translate(${dx}%, ${dy}%) scale(${scale})`,
              zIndex: canMoveThisPiece ? 20 : 10
            }}
            onClick={() => {
              if (canMoveThisPiece) {
                handleMovePiece(piece.index);
              }
            }}
            disabled={!canMoveThisPiece}
          >
            <div className="piece-3d-wrapper">
              <div className="piece-head" />
              <div className="piece-body" />
              <div className="piece-base" />
            </div>
          </button>
        );
      });
    });
  };

  return (
    <div className="ludo-container fade-in">
      {/* Header Bar */}
      <div className="ludo-header">
        <div className="ludo-header-left">
          <button 
            className="ludo-audio-btn" 
            onClick={() => setIsMuted(prev => !prev)} 
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        <div className="ludo-logo">
          <div className="ludo-logo-wings">
            <div></div><div></div><div></div>
          </div>
          <span>Ludo Clash</span>
          <div className="ludo-logo-wings ludo-logo-wings-reverse">
            <div></div><div></div><div></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="ludo-balance-box">
            ₹{(userBalance || 0).toFixed(2)}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '6px' }}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <button className="ludo-exit-btn" onClick={handleExitGame} title="Exit Game">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Floating Notifications */}
      {toastMessage && (
        <div className="ludo-toast-overlay">
          <div className="ludo-toast-card animate-bounce">{toastMessage}</div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="ludo-exit-overlay">
          <div className="ludo-exit-modal fade-in">
            <h3>Are you sure?</h3>
            <p>Leaving an active Ludo match will forfeit your wager and you will instantly lose!</p>
            <div className="exit-modal-actions">
              <button className="lobby-secondary-btn" onClick={cancelExitGame}>Resume Game</button>
              <button className="cancel-matchmaker-btn" onClick={confirmExitGame}>Forfeit & Exit</button>
            </div>
          </div>
        </div>
      )}

      {/* Lobby panel / Matchmaking */}
      {!currentRoom ? (
        <div className="ludo-lobby">
          <div className="lobby-hero-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <img src="/images/games/ludo-banner.png" alt="Ludo Clash" className="ludo-banner-img" />
            <div style={{ padding: '20px' }}>
              <h2 className="lobby-title">Multiplayer Betting Ludo</h2>
              <p className="lobby-desc">Wager entry coins, defeat opponents in standard turn clashes, and win the payout pool minus a 5% commission!</p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="ludo-mode-toggle">
            <button className={`mode-btn ${gameMode === 'quick' ? 'active' : ''}`} onClick={() => setGameMode('quick')}>
              <Dices size={16} /> Quick Match
            </button>
            <button className={`mode-btn ${gameMode === 'tournament' ? 'active' : ''}`} onClick={() => setGameMode('tournament')}>
              <Trophy size={16} /> Tournaments
            </button>
          </div>

          {gameMode === 'tournament' ? (
            /* Tournament Lobby */
            <div className="tournament-lobby">
              {/* My Tournaments */}
              {myTournaments.length > 0 && (
                <div className="my-tournaments-section">
                  <h3 className="panel-subtitle">My Tournaments</h3>
                  {myTournaments.map((t: any) => (
                    <div key={t.tournament_id || t.id} className="tournament-card my-tournament-card">
                      <div className="tournament-card-header">
                        <Trophy size={18} />
                        <strong>{t.name}</strong>
                        <span className={`t-status-badge ${t.status}`}>{t.status}</span>
                      </div>
                      <div className="tournament-card-stats">
                        <span>Score: <b>{t.total_score}</b></span>
                        <span>Matches: <b>{t.matches_played}/{t.num_matches}</b></span>
                        <span>Rank: <b>{t.rank ? `#${t.rank}` : '-'}</b></span>
                      </div>
                      {t.status === 'active' && (
                        <div className="tournament-card-footer" style={{ marginTop: '10px' }}>
                          <button 
                            className="lobby-primary-btn" 
                            style={{ width: '100%' }}
                            onClick={() => {
                              setSelectedTournament(t.tournament_id || t.id);
                              setGameMode('quick');
                              handleFindMatch(0, t.tournament_id || t.id);
                            }}
                          >
                            Play Match
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Available Tournaments */}
              <h3 className="panel-subtitle">Available Tournaments</h3>
              {tLoading ? (
                <div className="loading-text">Loading tournaments...</div>
              ) : tournaments.length === 0 ? (
                <div className="empty-state">No tournaments available. Check back later!</div>
              ) : (
                <div className="tournaments-grid">
                  {tournaments.map((t: any) => {
                    const joined = myTournaments.some((mt: any) => (mt.tournament_id || mt.id) === t.id);
                    return (
                      <div key={t.id} className="tournament-card">
                        <div className="tournament-card-header">
                          <Trophy size={20} className="trophy-icon" />
                          <strong>{t.name}</strong>
                          <span className={`t-status-badge ${t.status}`}>{t.status}</span>
                        </div>
                        <p className="tournament-desc">{t.description}</p>
                        <div className="tournament-card-stats">
                          <span>Fee: <b>₹{parseFloat(t.entry_fee).toFixed(0)}</b></span>
                          <span>Prize: <b>₹{parseFloat(t.prize_pool).toFixed(0)}</b></span>
                          <span>Players: <b>{t.participant_count ?? 0}/{t.max_participants}</b></span>
                          <span>Matches: <b>{t.num_matches}</b></span>
                        </div>
                        <div className="tournament-card-footer">
                          {(t.status === 'upcoming' || t.status === 'active') && (
                            <button
                              className={`lobby-primary-btn ${joined ? 'joined-btn' : ''}`}
                              onClick={() => handleJoinTournament(t.id)}
                              disabled={tJoinLoading || joined || (t.participant_count || 0) >= t.max_participants}
                              style={{ flex: 1 }}
                            >
                              {joined ? 'Joined' : 'Join Tournament'}
                            </button>
                          )}
                          {t.status === 'active' && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {t.participant_count > 0 ? `${t.participant_count} players competing` : 'Active'}
                            </div>
                          )}
                          {t.status === 'active' && (
                            <button className="lobby-secondary-btn" onClick={() => viewTournamentStandings(t)} style={{ flex: 1 }}>
                              Leaderboard
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isMatching ? (
            /* Matchmaking Overlay Panel */
            <div className="wager-creation-section matchmaking-panel text-center">
              <div className="matchmaking-radar-container">
                <div className="radar-circle animate-ping" />
                <div className="radar-core">
                  <Users size={32} className="text-blue-400" />
                </div>
              </div>
              <h3 className="panel-subtitle mt-4">Finding Active Opponent...</h3>
              <p className="matching-timer-label">Time Remaining: <span className="timer-seconds">{matchingTimeLeft}s</span></p>
              
              {selectedTournament ? (
                <div className="matching-details-card tournament-matching-card" style={{ background: 'var(--bg-accent)', padding: '12px', borderRadius: '8px', margin: '15px 0' }}>
                  <span className="text-secondary font-semibold"><Trophy size={14} style={{ display: 'inline', marginRight: '4px' }} /> Tournament Match</span>
                </div>
              ) : (
                <div className="matching-details-card">
                  <span className="text-secondary font-semibold">Wager Pool:</span>
                  <span className="matching-wager-value">₹{matchingWager.toFixed(0)}</span>
                </div>
              )}

              <p className="matching-hint text-muted">
                {selectedTournament ? 'Looking for other tournament participants...' : 'Looking for players matching your entry fee...'}
              </p>
              <button className="cancel-matchmaker-btn" onClick={handleCancelMatchmaking}>
                Cancel Matchmaking
              </button>
            </div>
          ) : (
            /* Wager Input Selection */
            <div className="wager-creation-section">
              <h3 className="panel-subtitle">Select Match Wager</h3>
              {selectedTournament && (
                <div className="tournament-match-badge" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Trophy size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Playing in tournament match
                  </div>
                  <button style={{ color: '#ff6b6b', background: 'transparent', border: 'none', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setSelectedTournament(null)}>
                    Clear
                  </button>
                </div>
              )}
              <div className="wager-amount-selector">
                <span className="wager-label">Wager Amount (₹)</span>
                <div className="wager-input-wrap">
                  <button className="wager-step-btn" onClick={() => setWagerInput(Math.max(10, parseFloat(wagerInput) - 10).toString())}>-</button>
                  <input 
                    type="number" 
                    value={wagerInput}
                    onChange={(e) => setWagerInput(e.target.value)} 
                    min="10" 
                    max="5000"
                  />
                  <button className="wager-step-btn" onClick={() => setWagerInput(Math.min(5000, parseFloat(wagerInput) + 10).toString())}>+</button>
                </div>
              </div>
              
              <div className="quick-wagers-grid">
                {QUICK_WAGERS.map(w => (
                  <button 
                    key={w} 
                    type="button"
                    className={`quick-wager-btn ${wagerInput === w.toString() ? 'active' : ''}`}
                    onClick={() => setWagerInput(w.toString())}
                  >
                    ₹{w}
                  </button>
                ))}
              </div>

              <div className="lobby-actions-row" style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                  className="lobby-primary-btn create-btn"
                  onClick={handleFindMatch}
                  disabled={isCreatingRoom || parseFloat(wagerInput) > userBalance}
                  style={{ width: '100%', maxWidth: '300px' }}
                >
                  <Dices size={18} style={{ marginRight: '6px' }} />
                  FIND MATCH
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Gameplay board arena */
        <div className="ludo-arena">
          <div className="arena-header">
            <div className="arena-wager-info">
              <span className="entry-tag">Wager: ₹{currentRoom.entryFee}</span>
              <span className="pool-tag">Win Pool: ₹{(currentRoom.entryFee * 2 * 0.95).toFixed(0)}</span>
            </div>
            
            {currentRoom.boardState.status === 'waiting' ? (
              <div className="waiting-room-controls flex flex-col items-center mt-2">
                <div className="loader-dots my-2">Waiting for opponent to connect...</div>
                <button className="cancel-room-btn" onClick={handleCancelRoom}>
                  Cancel Room & Refund
                </button>
              </div>
            ) : null}
          </div>

          {currentRoom.boardState.status !== 'waiting' && (
            <div className="players-vs-panel">
              <div className={`player-card host-card ${currentRoom.boardState.turn === 'host' ? 'active-turn' : ''}`}>
                <div className="player-avatar-circle">
                  <Users size={14} />
                </div>
                <div className="player-info-col">
                  <span className="p-name" title={maskName(currentRoom.hostName)}>{maskName(currentRoom.hostName)}</span>
                  <span className="p-score">Score: {currentRoom.boardState.hostPieces.reduce((a:number,b:number)=>a+(b===58?100:b),0)}</span>
                </div>
                <div className="player-indicator green-indicator" />
                {currentRoom.boardState.turn === 'host' && (
                  <span className="turn-timer">{turnTimeLeft}s</span>
                )}
              </div>

              <div className="vs-badge">VS</div>

              <div className={`player-card challenger-card ${currentRoom.boardState.turn === 'challenger' ? 'active-turn' : ''}`}>
                <div className="player-indicator yellow-indicator" />
                <div className="player-info-col">
                  <span className="p-name" title={maskName(currentRoom.challengerName)}>{maskName(currentRoom.challengerName)}</span>
                  <span className="p-score">Score: {currentRoom.boardState.challengerPieces.reduce((a:number,b:number)=>a+(b===58?100:b),0)}</span>
                </div>
                <div className="player-avatar-circle">
                  <Users size={14} />
                </div>
                {currentRoom.boardState.turn === 'challenger' && (
                  <span className="turn-timer">{turnTimeLeft}s</span>
                )}
              </div>
            </div>
          )}

          {/* Core Ludo Board */}
          <div className="ludo-board-frame">
            <div className="ludo-board-grid">
              {renderBoardCells()}
              {renderPieces()}
            </div>
          </div>

          {/* Interactive Dice controls */}
          {currentRoom.boardState.status !== 'waiting' && (
            <div className="dice-controls-panel">
              <div className="roll-action-layout">
                {isPlayerTurn && currentRoom.boardState.phase === 'roll' ? (
                  <button 
                    className="giant-roll-btn animate-bounce"
                    onClick={handleRollDice}
                    disabled={diceRolling}
                  >
                    <Dices size={20} style={{ marginRight: '6px' }} />
                    ROLL DICE
                  </button>
                ) : (
                  <div className="waiting-turn-note">
                    {isPlayerTurn ? 'Select a pawn to move' : "Waiting for opponent's turn..."}
                  </div>
                )}

                {/* 3D Dice Display Box */}
                <div className={`dice-cube-container ${diceRolling ? 'rolling' : ''} ${renderDiceRingClass()}`}>
                  <div className={`dice-cube face-${currentRoom.boardState.dice}`}>
                    {currentRoom.boardState.dice > 0 ? (
                      <div className="dice-face">
                        {Array.from({ length: currentRoom.boardState.dice }).map((_, i) => (
                          <div key={i} className="dice-dot" />
                        ))}
                      </div>
                    ) : (
                      <div className="dice-face empty-face">
                        <Dices size={24} className="opacity-40" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bets statistics lists */}
      <div className="ludo-history-section">
        <div className="history-tabs-bar">
          <button 
            className={`hist-tab-btn ${historyTab === 'all' ? 'active' : ''}`}
            onClick={() => setHistoryTab('all')}
          >
            All Bets
          </button>
          <button 
            className={`hist-tab-btn ${historyTab === 'my' ? 'active' : ''}`}
            onClick={() => setHistoryTab('my')}
          >
            My Bets
          </button>
          <button 
            className={`hist-tab-btn ${historyTab === 'top' ? 'active' : ''}`}
            onClick={() => setHistoryTab('top')}
          >
            Top Wins
          </button>
        </div>

        <div className="history-table-container">
          <table className="ludo-bets-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>User / Opponent</th>
                <th style={{ textAlign: 'left' }}>Bet Entry</th>
                <th style={{ textAlign: 'left' }}>Payout</th>
                <th style={{ textAlign: 'left' }}>Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const list = historyTab === 'all' ? recentBets : (historyTab === 'my' ? myBets : topBets);
                const safeList = Array.isArray(list) ? list : [];
                const displayLimit = 10;
                
                return safeList.slice(0, displayLimit).map((b, i) => {
                  if (!b) return null;
                  const bBet = typeof b.bet === 'number' ? b.bet : (parseFloat(b.bet) || 0);
                  const bWin = typeof b.winAmount === 'number' ? b.winAmount : (parseFloat(b.winAmount) || 0);
                  const bMult = typeof b.targetMult === 'number' ? b.targetMult : (parseFloat(b.targetMult) || 0);
                  
                  return (
                    <tr key={i}>
                      <td>
                        <div className="ludo-user-cell">
                          <div className="ludo-user-avatar">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                          <span className="ludo-user-name">{maskName(b.name)}</span>
                        </div>
                      </td>
                      <td>₹{bBet.toFixed(2)}</td>
                      <td className="ludo-val-payout">{b.cashedOut ? `₹${bWin.toFixed(2)}` : '-'}</td>
                      <td className="ludo-val-mult">
                        {b.cashedOut ? (
                          <span className={`ludo-mult-chip ${bMult >= 1.9 ? 'winner' : ''}`}>
                            {bMult.toFixed(2)}x
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                });
              })()}
              {(historyTab === 'all' ? recentBets : (historyTab === 'my' ? myBets : topBets)).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    No Ludo bets recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Win overlay */}
      {showWinOverlay && (
        <div className="ludo-overlay animate-fade-in" onClick={() => setShowWinOverlay(false)}>
          <div className="ludo-win-card animate-scale-up">
            <div className="celebrate-emoji">🏆</div>
            <div className="win-title">Victory!</div>
            <div className="win-subtitle">You won the Ludo wager match!</div>
            <div className="win-coins">₹{winPayout.toFixed(2)}</div>
            <div className="close-tip">Click anywhere to close</div>
          </div>
        </div>
      )}

      {/* Lose overlay */}
      {showLoseOverlay && (
        <div className="ludo-overlay animate-fade-in" onClick={() => setShowLoseOverlay(false)}>
          <div className="ludo-lose-card animate-scale-up">
            <div className="lose-emoji">😔</div>
            <div className="lose-title">Defeat</div>
            <div className="lose-subtitle">Your opponent won the match.</div>
            <div className="close-tip">Click anywhere to close</div>
          </div>
        </div>
      )}

      {/* Tournament Standings Modal */}
      {tournamentStandings.length > 0 && !selectedTournament && (
        <div className="ludo-overlay animate-fade-in" onClick={() => setTournamentStandings([])}>
          <div className="t-standings-modal animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="t-standings-header">
              <h3>Tournament Standings</h3>
              <button className="t-close-btn" onClick={() => setTournamentStandings([])}>✕</button>
            </div>
            <div className="t-standings-body">
              {tournamentStandings.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No participants yet</p>
              ) : (
                <table className="t-standings-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Score</th>
                      <th>Matches</th>
                      <th>Prize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentStandings.map((p: any, i: number) => (
                      <tr key={p.id || i} className={p.user_id === user?.id ? 'highlight-row' : ''}>
                        <td>{i + 1}</td>
                        <td>{p.user_name || `User #${p.user_id}`}</td>
                        <td><strong>{p.total_score}</strong></td>
                        <td>{p.matches_played}</td>
                        <td>{parseFloat(p.prize_amount || '0') > 0 ? `₹${parseFloat(p.prize_amount).toFixed(2)}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
