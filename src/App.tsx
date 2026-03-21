import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { nanoid } from 'nanoid';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDoc, 
  writeBatch,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment as firestoreIncrement
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Clock, 
  Wallet, 
  User as UserIcon, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Globe,
  LayoutGrid,
  ListOrdered,
  LogOut
} from 'lucide-react';
import { db, auth, signIn, handleFirestoreError, OperationType } from './firebase';
import { PLAYERS, Player, getSortedPlayers, calculatePlayerScore } from './players';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface Room {
  id: string;
  hostId: string;
  status: 'lobby' | 'auction' | 'results';
  bidTimerDuration: number;
  currentBid: {
    amount: number;
    userId: string;
    userName: string;
    timestamp: number;
  } | null;
  currentPlayerId: string | null;
  phase: string;
  isPaused: boolean;
  timerEnd: number | null;
  createdAt: number;
}

interface User {
  id: string;
  name: string;
  teamName: string;
  purse: number;
  isHost: boolean;
  joinedAt: number;
}

interface RoomPlayer extends Player {
  soldTo: string | null;
  soldPrice: number | null;
  status: 'queued' | 'bidding' | 'sold' | 'unsold';
}

// --- Error Boundary ---

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  state: { hasError: boolean, error: any };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="p-6 rounded-full bg-rose-500/10 text-rose-500">
            <AlertCircle size={64} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Something went wrong</h1>
            <p className="text-slate-400 max-w-md">The application encountered an unexpected error. Please try refreshing the page.</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 max-w-lg overflow-auto">
            <code className="text-xs text-rose-400 font-mono">
              {this.state.error?.message || JSON.stringify(this.state.error)}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
          >
            Refresh App
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<any>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'landing' | 'lobby' | 'auction' | 'results'>('landing');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      // We can't join automatically because we need a name, 
      // but we can pre-fill it if we had a state for it.
      // For now, I'll just store it in a ref or local storage to be used by the LandingPage.
      localStorage.setItem('pendingRoom', roomParam);
    }
  }, []);

  // Auth initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        signIn().catch(err => setError('Failed to sign in anonymously.'));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Room sync
  useEffect(() => {
    if (!room?.id) return;

    const roomRef = doc(db, 'rooms', room.id);
    const usersRef = collection(db, 'rooms', room.id, 'users');
    const playersRef = collection(db, 'rooms', room.id, 'players');

    const unsubRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoom({ id: snapshot.id, ...snapshot.data() } as Room);
      } else {
        setRoom(null);
        setView('landing');
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `rooms/${room.id}`));

    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const usersList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setUsers(usersList.sort((a, b) => a.joinedAt - b.joinedAt));
    });

    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      const playersList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RoomPlayer));
      setPlayers(playersList.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    return () => {
      unsubRoom();
      unsubUsers();
      unsubPlayers();
    };
  }, [room?.id]);

  // View management
  useEffect(() => {
    if (room) {
      setView(room.status);
    } else {
      setView('landing');
    }
  }, [room?.status]);

  const createRoom = async (name: string) => {
    if (!user) return;
    try {
      const roomId = nanoid(6).toUpperCase();
      const roomRef = doc(db, 'rooms', roomId);
      const userRef = doc(db, 'rooms', roomId, 'users', user.uid);

      const newRoom: Room = {
        id: roomId,
        hostId: user.uid,
        status: 'lobby',
        bidTimerDuration: 15,
        currentBid: null,
        currentPlayerId: null,
        phase: 'Initial',
        isPaused: false,
        timerEnd: null,
        createdAt: Date.now()
      };

      const newUser: User = {
        id: user.uid,
        name,
        teamName: `${name}'s XI`,
        purse: 100,
        isHost: true,
        joinedAt: Date.now()
      };

      await setDoc(roomRef, newRoom);
      await setDoc(userRef, newUser);
      localStorage.removeItem('pendingRoom');
      setRoom(newRoom);
    } catch (err) {
      setError('Failed to create room.');
    }
  };

  const joinRoom = async (name: string, roomId: string) => {
    if (!user) return;
    try {
      const roomRef = doc(db, 'rooms', roomId.toUpperCase());
      const roomSnap = await getDoc(roomRef);
      
      if (!roomSnap.exists()) {
        setError('Room not found.');
        return;
      }

      const userRef = doc(db, 'rooms', roomId.toUpperCase(), 'users', user.uid);
      const newUser: User = {
        id: user.uid,
        name,
        teamName: `${name}'s XI`,
        purse: 100,
        isHost: false,
        joinedAt: Date.now()
      };

      await setDoc(userRef, newUser);
      localStorage.removeItem('pendingRoom');
      setRoom({ id: roomSnap.id, ...roomSnap.data() } as Room);
    } catch (err) {
      setError('Failed to join room.');
    }
  };

  const startAuction = async () => {
    if (!room || room.hostId !== user.uid) return;
    try {
      const batch = writeBatch(db);
      const sortedPlayers = getSortedPlayers(PLAYERS);
      
      sortedPlayers.forEach((p, index) => {
        const pRef = doc(db, 'rooms', room.id, 'players', p.id);
        batch.set(pRef, {
          ...p,
          soldTo: null,
          soldPrice: null,
          status: 'queued',
          order: index
        });
      });

      const roomRef = doc(db, 'rooms', room.id);
      batch.update(roomRef, {
        status: 'auction',
        currentPlayerId: sortedPlayers[0].id,
        phase: 'Top Batters',
        timerEnd: Date.now() + room.bidTimerDuration * 1000
      });

      await batch.commit();
    } catch (err) {
      setError('Failed to start auction.');
    }
  };

  const placeBid = async (amount: number) => {
    if (!room || !user) return;
    const currentUser = users.find(u => u.id === user.uid);
    if (!currentUser || currentUser.purse < amount) return;

    try {
      const roomRef = doc(db, 'rooms', room.id);
      await updateDoc(roomRef, {
        currentBid: {
          amount,
          userId: user.uid,
          userName: currentUser.name,
          timestamp: Date.now()
        },
        timerEnd: Date.now() + room.bidTimerDuration * 1000
      });
    } catch (err) {
      console.error('Bid failed', err);
    }
  };

  const nextPlayer = async () => {
    if (!room || room.hostId !== user.uid) return;
    
    const currentPlayer = players.find(p => p.id === room.currentPlayerId);
    if (!currentPlayer) return;

    try {
      const batch = writeBatch(db);
      const roomRef = doc(db, 'rooms', room.id);

      // Handle current player result
      if (room.currentBid) {
        // Sold
        const pRef = doc(db, 'rooms', room.id, 'players', currentPlayer.id);
        batch.update(pRef, {
          status: 'sold',
          soldTo: room.currentBid.userId,
          soldPrice: room.currentBid.amount
        });

        // Update user purse
        const uRef = doc(db, 'rooms', room.id, 'users', room.currentBid.userId);
        batch.update(uRef, {
          purse: firestoreIncrement(-room.currentBid.amount)
        });
      } else {
        // Unsold
        const pRef = doc(db, 'rooms', room.id, 'players', currentPlayer.id);
        batch.update(pRef, { status: 'unsold' });
      }

      // Find next player
      const nextIdx = players.findIndex(p => p.id === room.currentPlayerId) + 1;
      const nextP = players[nextIdx];

      if (nextP) {
        batch.update(roomRef, {
          currentPlayerId: nextP.id,
          currentBid: null,
          timerEnd: Date.now() + room.bidTimerDuration * 1000
        });
      } else {
        // Check for unsold round
        const unsoldPlayers = players.filter(p => p.status === 'unsold');
        if (unsoldPlayers.length > 0 && room.phase !== 'Unsold Round') {
          // Reset unsold players to queued
          unsoldPlayers.forEach(p => {
            const pRef = doc(db, 'rooms', room.id, 'players', p.id);
            batch.update(pRef, { status: 'queued' });
          });
          batch.update(roomRef, {
            phase: 'Unsold Round',
            currentPlayerId: unsoldPlayers[0].id,
            currentBid: null,
            timerEnd: Date.now() + room.bidTimerDuration * 1000
          });
        } else {
          batch.update(roomRef, { status: 'results' });
        }
      }

      await batch.commit();
    } catch (err) {
      console.error('Next player failed', err);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingPage key="landing" onCreate={createRoom} onJoin={joinRoom} error={error} />
        )}
        {view === 'lobby' && room && (
          <LobbyPage 
            key="lobby" 
            room={room} 
            users={users} 
            isHost={room.hostId === user?.uid} 
            onStart={startAuction}
            onUpdateTeam={(name) => updateDoc(doc(db, 'rooms', room.id, 'users', user.uid), { teamName: name })}
          />
        )}
        {view === 'auction' && room && (
          <AuctionPage 
            key="auction"
            room={room}
            users={users}
            players={players}
            currentUser={users.find(u => u.id === user?.uid)}
            isHost={room.hostId === user?.uid}
            onBid={placeBid}
            onNext={nextPlayer}
            onPause={() => updateDoc(doc(db, 'rooms', room.id), { isPaused: !room.isPaused })}
          />
        )}
        {view === 'results' && room && (
          <ResultsPage 
            key="results"
            room={room}
            users={users}
            players={players}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-pages ---

function LandingPage({ onCreate, onJoin, error }: { onCreate: (n: string) => void, onJoin: (n: string, r: string) => void, error: string | null, key?: string }) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('pendingRoom') || '');
  const [mode, setMode] = useState<'initial' | 'create' | 'join'>(() => localStorage.getItem('pendingRoom') ? 'join' : 'initial');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col items-center justify-center min-h-screen p-6"
    >
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex p-4 rounded-3xl bg-emerald-500/10 text-emerald-500 mb-4"
          >
            <Trophy size={48} />
          </motion.div>
          <h1 className="text-5xl font-bold tracking-tighter bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
            IPL AUCTION PRO
          </h1>
          <p className="text-slate-400">Real-time multiplayer strategic bidding</p>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          {mode === 'initial' && (
            <div className="space-y-4">
              <button 
                onClick={() => setMode('create')}
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl transition-all flex items-center justify-between group"
              >
                Create New Room
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => setMode('join')}
                className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-2xl transition-all flex items-center justify-between group"
              >
                Join Existing Room
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {(mode === 'create' || mode === 'join') && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Your Name</label>
                <input 
                  type="text" 
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
              </div>

              {mode === 'join' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Room Code</label>
                  <input 
                    type="text" 
                    placeholder="Enter 6-digit code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all uppercase"
                  />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-400/10 p-3 rounded-xl border border-rose-400/20">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => setMode('initial')}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-2xl transition-all"
                >
                  Back
                </button>
                <button 
                  disabled={!name || (mode === 'join' && !roomCode)}
                  onClick={() => mode === 'create' ? onCreate(name) : onJoin(name, roomCode)}
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all"
                >
                  {mode === 'create' ? 'Create Room' : 'Join Room'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LobbyPage({ room, users, isHost, onStart, onUpdateTeam }: { room: Room, users: User[], isHost: boolean, onStart: () => void, onUpdateTeam: (n: string) => void, key?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto py-12 px-6 space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Waiting for players
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Auction Lobby</h1>
          <p className="text-slate-400">Share the code below to invite your friends</p>
        </div>

        <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Room Code</p>
            <p className="text-2xl font-mono font-bold text-emerald-500 tracking-wider">{room.id}</p>
          </div>
          <button 
            onClick={() => {
              const url = `${window.location.origin}?room=${room.id}`;
              navigator.clipboard.writeText(url);
              alert('Link copied to clipboard!');
            }}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
          >
            <Globe size={16} />
            SHARE LINK
          </button>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(room.id);
              alert('Code copied to clipboard!');
            }}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users size={20} className="text-emerald-500" />
            Players ({users.length})
          </h2>
          <div className="grid gap-3">
            {users.map((u) => (
              <motion.div 
                layout
                key={u.id}
                className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">{u.name} {u.isHost && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded ml-1">HOST</span>}</p>
                    <p className="text-xs text-slate-500">{u.teamName}</p>
                  </div>
                </div>
                {u.id === auth.currentUser?.uid && (
                  <button 
                    onClick={() => {
                      const newName = prompt('Enter team name:', u.teamName);
                      if (newName) onUpdateTeam(newName);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-emerald-500 font-semibold"
                  >
                    Edit Team Name
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock size={18} className="text-emerald-500" />
              Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">Bid Timer</p>
                <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-white/5">
                  <span className="font-mono font-bold text-emerald-500">{room.bidTimerDuration}s</span>
                  {isHost && (
                    <div className="flex gap-1">
                      <button onClick={() => updateDoc(doc(db, 'rooms', room.id), { bidTimerDuration: Math.max(5, room.bidTimerDuration - 5) })} className="p-1 hover:bg-slate-800 rounded">-</button>
                      <button onClick={() => updateDoc(doc(db, 'rooms', room.id), { bidTimerDuration: Math.min(30, room.bidTimerDuration + 5) })} className="p-1 hover:bg-slate-800 rounded">+</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">Starting Purse</p>
                <div className="bg-slate-950 p-3 rounded-xl border border-white/5 flex items-center gap-2">
                  <IndianRupee size={14} className="text-emerald-500" />
                  <span className="font-mono font-bold">100 Cr</span>
                </div>
              </div>
            </div>
          </div>

          {isHost ? (
            <button 
              onClick={onStart}
              disabled={users.length < 1}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Play size={20} fill="currentColor" />
              START AUCTION
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 text-center text-sm text-slate-500 italic">
              Waiting for host to start...
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AuctionPage({ room, users, players, currentUser, isHost, onBid, onNext, onPause }: { 
  room: Room, 
  users: User[], 
  players: RoomPlayer[], 
  currentUser?: User, 
  isHost: boolean, 
  onBid: (a: number) => void, 
  onNext: () => void,
  onPause: () => void,
  key?: string
}) {
  const currentPlayer = useMemo(() => players.find(p => p.id === room.currentPlayerId), [room.currentPlayerId, players]);
  const upcomingPlayers = useMemo(() => players.filter(p => p.status === 'queued' && p.id !== room.currentPlayerId).slice(0, 5), [players, room.currentPlayerId]);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!room.timerEnd || room.isPaused) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((room.timerEnd! - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0 && isHost) {
        // Auto move to next player if no bid or timer expired
        // We add a small delay to prevent race conditions
        setTimeout(onNext, 1000);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => clearInterval(timerRef.current);
  }, [room.timerEnd, room.isPaused, isHost, onNext]);

  const currentBidAmount = room.currentBid?.amount || currentPlayer?.basePrice || 0;
  const nextBidAmount = room.currentBid ? room.currentBid.amount + (currentPlayer?.increment || 0.5) : currentPlayer?.basePrice || 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-white/5 p-4 flex items-center justify-between backdrop-blur-md z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="text-emerald-500" size={24} />
            <span className="font-bold tracking-tight">IPL AUCTION PRO</span>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500 uppercase tracking-widest font-bold text-[10px]">Phase</span>
            <span className="font-semibold text-emerald-500">{room.phase}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isHost && (
            <div className="flex items-center gap-2 mr-4">
              <button onClick={onPause} className="p-2 hover:bg-white/5 rounded-lg transition-all text-slate-400">
                {room.isPaused ? <Play size={20} /> : <Pause size={20} />}
              </button>
              <button onClick={onNext} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-all">
                SKIP PLAYER
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-white/5">
            <Wallet size={18} className="text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-slate-500 uppercase">Your Purse</span>
              <span className="font-mono font-bold leading-none">{currentUser?.purse.toFixed(1)} Cr</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Users & Stats */}
        <aside className="w-72 bg-slate-900/30 border-r border-white/5 overflow-y-auto p-4 space-y-6 hidden lg:block">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} />
              Leaderboard
            </h3>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="bg-slate-900/50 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold truncate w-32">{u.teamName}</span>
                    <span className="text-[10px] text-slate-500">{players.filter(p => p.soldTo === u.id).length}/11 Players</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-500">{u.purse.toFixed(1)} Cr</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Main Auction Area */}
        <section className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <div className="flex-1 flex items-center justify-center p-8">
            <AnimatePresence mode="wait">
              {currentPlayer ? (
                <motion.div 
                  key={currentPlayer.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.1, y: -20 }}
                  className="w-full max-w-2xl bg-slate-900/50 border border-white/10 rounded-[40px] p-10 backdrop-blur-2xl shadow-2xl relative overflow-hidden"
                >
                  {/* Background Decoration */}
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Trophy size={200} />
                  </div>

                  <div className="flex flex-col md:flex-row gap-10 relative z-10">
                    {/* Player Image/Avatar */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-slate-700 shadow-inner overflow-hidden relative group">
                        <UserIcon size={80} />
                        {currentPlayer.overseas && (
                          <div className="absolute top-3 right-3 bg-blue-500 p-1.5 rounded-lg shadow-lg">
                            <Globe size={16} className="text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="px-4 py-1.5 rounded-full bg-slate-800 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {currentPlayer.tier} Tier
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 space-y-6">
                      <div className="space-y-1">
                        <h2 className="text-4xl font-bold tracking-tight">{currentPlayer.name}</h2>
                        <p className="text-emerald-500 font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {currentPlayer.role}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Matches</p>
                          <p className="text-xl font-mono font-bold">{currentPlayer.stats.matches}</p>
                        </div>
                        {currentPlayer.role !== 'Bowler' && (
                          <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Runs</p>
                            <p className="text-xl font-mono font-bold">{currentPlayer.stats.runs}</p>
                          </div>
                        )}
                        {currentPlayer.role !== 'Batter' && (
                          <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Wickets</p>
                            <p className="text-xl font-mono font-bold">{currentPlayer.stats.wickets}</p>
                          </div>
                        )}
                        <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Avg/SR</p>
                          <p className="text-xl font-mono font-bold">{currentPlayer.stats.average}/{currentPlayer.stats.strikeRate || currentPlayer.stats.economy}</p>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-white/5">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Base Price</p>
                          <p className="text-2xl font-mono font-bold">{currentPlayer.basePrice} Cr</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Increment</p>
                          <p className="text-2xl font-mono font-bold text-emerald-500">+{currentPlayer.increment} Cr</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-slate-400 font-medium">Preparing next player...</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Bidding Controls */}
          <div className="bg-slate-900/80 border-t border-white/10 p-8 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
              {/* Timer */}
              <div className="flex flex-col items-center gap-2 min-w-[120px]">
                <div className={cn(
                  "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-colors",
                  timeLeft <= 5 ? "border-rose-500 text-rose-500 animate-pulse" : "border-emerald-500 text-emerald-500"
                )}>
                  <span className="text-3xl font-mono font-bold">{timeLeft}</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Seconds Left</span>
              </div>

              {/* Current Bid Info */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Current Bid</span>
                  {room.currentBid && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold uppercase">
                      Leading: {room.currentBid.userName}
                    </span>
                  )}
                </div>
                <div className="bg-slate-950 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <IndianRupee className="text-emerald-500" size={24} />
                    </div>
                    <span className="text-4xl font-mono font-bold">{currentBidAmount.toFixed(1)} <span className="text-lg text-slate-500">Cr</span></span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Next Bid</p>
                    <p className="text-xl font-mono font-bold text-emerald-500">{nextBidAmount.toFixed(1)} Cr</p>
                  </div>
                </div>
              </div>

              {/* Bid Button */}
              <button 
                disabled={!currentPlayer || (currentUser?.purse || 0) < nextBidAmount || room.currentBid?.userId === currentUser?.id || room.isPaused}
                onClick={() => onBid(nextBidAmount)}
                className="w-full md:w-64 h-20 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-2xl rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                PLACE BID
              </button>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Upcoming & Team */}
        <aside className="w-80 bg-slate-900/30 border-l border-white/5 overflow-y-auto p-4 space-y-8 hidden xl:block">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ListOrdered size={14} />
              Upcoming Players
            </h3>
            <div className="space-y-2">
              {upcomingPlayers.map(p => (
                <div key={p.id} className="bg-slate-900/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                    <UserIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.role} • {p.tier}</p>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{p.basePrice} Cr</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 size={14} />
              Your Team ({players.filter(p => p.soldTo === currentUser?.id).length}/11)
            </h3>
            <div className="space-y-2">
              {players.filter(p => p.soldTo === currentUser?.id).map(p => (
                <div key={p.id} className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-[10px] text-emerald-500/70">{p.role}</p>
                  </div>
                  <span className="font-mono text-xs font-bold">{p.soldPrice} Cr</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 11 - players.filter(p => p.soldTo === currentUser?.id).length) }).map((_, i) => (
                <div key={i} className="h-12 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                  Empty Slot
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ResultsPage({ room, users, players }: { room: Room, users: User[], players: RoomPlayer[], key?: string }) {
  const leaderboard = useMemo(() => {
    return users.map(u => {
      const teamPlayers = players.filter(p => p.soldTo === u.id);
      const isComplete = teamPlayers.length === 11;
      const overseasCount = teamPlayers.filter(p => p.overseas).length;
      const isValid = isComplete && overseasCount <= 4;
      
      const totalScore = isValid ? teamPlayers.reduce((sum, p) => sum + calculatePlayerScore(p), 0) : 0;

      return {
        ...u,
        totalScore,
        isValid,
        playerCount: teamPlayers.length,
        overseasCount,
        teamPlayers
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [users, players]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto py-12 px-6 space-y-12"
    >
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="inline-flex p-6 rounded-[40px] bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 mb-4"
        >
          <Trophy size={64} />
        </motion.div>
        <h1 className="text-6xl font-black tracking-tighter">AUCTION RESULTS</h1>
        <p className="text-slate-400 text-lg">Final standings based on player performance stats</p>
      </div>

      <div className="grid gap-6">
        {leaderboard.map((u, index) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            key={u.id}
            className={cn(
              "bg-slate-900/50 border rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-8 backdrop-blur-xl transition-all",
              index === 0 ? "border-emerald-500/50 shadow-2xl shadow-emerald-500/10 ring-1 ring-emerald-500/20" : "border-white/5"
            )}
          >
            <div className="flex items-center gap-6 flex-1">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black",
                index === 0 ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"
              )}>
                #{index + 1}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">{u.teamName}</h2>
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                  <span>{u.name}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>{u.playerCount}/11 Players</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className={cn(u.overseasCount > 4 ? "text-rose-500" : "text-blue-500")}>
                    {u.overseasCount} Overseas
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-12">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Purse Left</p>
                <p className="text-xl font-mono font-bold">{u.purse.toFixed(1)} Cr</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Points</p>
                <p className={cn(
                  "text-5xl font-black tracking-tighter",
                  index === 0 ? "text-emerald-500" : "text-white"
                )}>
                  {u.isValid ? u.totalScore : 'DQ'}
                </p>
                {!u.isValid && <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">Invalid Squad</p>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-center pt-8">
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center gap-2"
        >
          <RotateCcw size={20} />
          PLAY AGAIN
        </button>
      </div>
    </motion.div>
  );
}
