export interface PlayerStats {
  matches: number;
  runs?: number;
  wickets?: number;
  average?: number;
  economy?: number;
  strikeRate?: number;
}

export type PlayerRole = 'Batter' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper';
export type PlayerTier = 'Top' | 'Mid' | 'Low';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  overseas: boolean;
  stats: PlayerStats;
  tier: PlayerTier;
  basePrice: number; // in Crores
  increment: number; // in Crores
  image?: string;
  order?: number;
}

export const PLAYERS: Player[] = [
  // Top Batters
  { id: 'p1', name: 'Virat Kohli', role: 'Batter', overseas: false, stats: { matches: 237, runs: 7263, average: 37.25, strikeRate: 130.02 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p2', name: 'Rohit Sharma', role: 'Batter', overseas: false, stats: { matches: 243, runs: 6211, average: 29.58, strikeRate: 130.05 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p3', name: 'MS Dhoni', role: 'Wicketkeeper', overseas: false, stats: { matches: 250, runs: 5082, average: 38.79, strikeRate: 135.92 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p4', name: 'AB de Villiers', role: 'Batter', overseas: true, stats: { matches: 184, runs: 5162, average: 39.71, strikeRate: 151.69 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p5', name: 'Chris Gayle', role: 'Batter', overseas: true, stats: { matches: 142, runs: 4965, average: 39.72, strikeRate: 148.96 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p6', name: 'David Warner', role: 'Batter', overseas: true, stats: { matches: 176, runs: 6397, average: 41.54, strikeRate: 139.92 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p7', name: 'Shikhar Dhawan', role: 'Batter', overseas: false, stats: { matches: 217, runs: 6617, average: 35.39, strikeRate: 127.18 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p8', name: 'Suresh Raina', role: 'Batter', overseas: false, stats: { matches: 205, runs: 5528, average: 32.52, strikeRate: 136.76 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p9', name: 'Kane Williamson', role: 'Batter', overseas: true, stats: { matches: 77, runs: 2101, average: 36.22, strikeRate: 126.03 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p10', name: 'Steve Smith', role: 'Batter', overseas: true, stats: { matches: 103, runs: 2485, average: 34.51, strikeRate: 128.09 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },

  // Mid Batters
  { id: 'p11', name: 'Shubman Gill', role: 'Batter', overseas: false, stats: { matches: 91, runs: 2790, average: 37.7, strikeRate: 134.07 }, tier: 'Mid', basePrice: 1.0, increment: 0.2 },
  { id: 'p12', name: 'Yashasvi Jaiswal', role: 'Batter', overseas: false, stats: { matches: 37, runs: 1172, average: 32.56, strikeRate: 148.73 }, tier: 'Mid', basePrice: 1.0, increment: 0.2 },
  { id: 'p13', name: 'Ruturaj Gaikwad', role: 'Batter', overseas: false, stats: { matches: 52, runs: 1797, average: 39.07, strikeRate: 135.52 }, tier: 'Mid', basePrice: 1.0, increment: 0.2 },
  { id: 'p14', name: 'Faf du Plessis', role: 'Batter', overseas: true, stats: { matches: 130, runs: 4133, average: 36.9, strikeRate: 134.14 }, tier: 'Mid', basePrice: 1.5, increment: 0.25 },
  { id: 'p15', name: 'Jos Buttler', role: 'Wicketkeeper', overseas: true, stats: { matches: 96, runs: 3223, average: 37.92, strikeRate: 148.32 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  
  // Top All-rounders
  { id: 'p16', name: 'Hardik Pandya', role: 'All-Rounder', overseas: false, stats: { matches: 123, runs: 2309, wickets: 53, average: 30.38, economy: 8.81 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p17', name: 'Ravindra Jadeja', role: 'All-Rounder', overseas: false, stats: { matches: 226, runs: 2692, wickets: 152, average: 26.39, economy: 7.6 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p18', name: 'Andre Russell', role: 'All-Rounder', overseas: true, stats: { matches: 112, runs: 2262, wickets: 96, average: 29.0, economy: 9.16 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p19', name: 'Glenn Maxwell', role: 'All-Rounder', overseas: true, stats: { matches: 124, runs: 2719, wickets: 31, average: 25.41, economy: 8.31 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p20', name: 'Ben Stokes', role: 'All-Rounder', overseas: true, stats: { matches: 45, runs: 935, wickets: 28, average: 24.61, economy: 8.56 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },

  // Top Bowlers
  { id: 'p21', name: 'Jasprit Bumrah', role: 'Bowler', overseas: false, stats: { matches: 120, wickets: 145, economy: 7.39, average: 23.3 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p22', name: 'Rashid Khan', role: 'Bowler', overseas: true, stats: { matches: 109, wickets: 139, economy: 6.67, average: 20.76 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p23', name: 'Mohammed Shami', role: 'Bowler', overseas: false, stats: { matches: 110, wickets: 127, economy: 8.44, average: 26.74 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p24', name: 'Trent Boult', role: 'Bowler', overseas: true, stats: { matches: 88, wickets: 105, economy: 8.29, average: 26.54 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  { id: 'p25', name: 'Kagiso Rabada', role: 'Bowler', overseas: true, stats: { matches: 69, wickets: 106, economy: 8.42, average: 20.74 }, tier: 'Top', basePrice: 2.0, increment: 0.5 },
  // Additional Players to reach 120
  ...Array.from({ length: 95 }, (_, i) => {
    const id = `p${i + 26}`;
    const roles: PlayerRole[] = ['Batter', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
    const role = roles[i % 4];
    const tiers: PlayerTier[] = ['Mid', 'Low'];
    const tier = tiers[i % 2];
    const overseas = i % 3 === 0;
    return {
      id,
      name: `Player ${id}`,
      role,
      overseas,
      stats: {
        matches: Math.floor(Math.random() * 100) + 10,
        runs: role === 'Batter' || role === 'Wicketkeeper' || role === 'All-Rounder' ? Math.floor(Math.random() * 3000) : 0,
        wickets: role === 'Bowler' || role === 'All-Rounder' ? Math.floor(Math.random() * 100) : 0,
        average: Math.floor(Math.random() * 40) + 10,
        economy: Math.floor(Math.random() * 5) + 6,
        strikeRate: Math.floor(Math.random() * 60) + 100,
      },
      tier,
      basePrice: tier === 'Mid' ? 1.0 : 0.5,
      increment: tier === 'Mid' ? 0.2 : 0.1,
    };
  })
];

// Helper to sort players by phase
export const getSortedPlayers = (players: Player[]) => {
  const phases = [
    { role: 'Batter', tier: 'Top' },
    { role: 'Batter', tier: 'Mid' },
    { role: 'Batter', tier: 'Low' },
    { role: 'Wicketkeeper', tier: 'Top' },
    { role: 'Wicketkeeper', tier: 'Mid' },
    { role: 'Wicketkeeper', tier: 'Low' },
    { role: 'All-Rounder', tier: 'Top' },
    { role: 'All-Rounder', tier: 'Mid' },
    { role: 'All-Rounder', tier: 'Low' },
    { role: 'Bowler', tier: 'Top' },
    { role: 'Bowler', tier: 'Mid' },
    { role: 'Bowler', tier: 'Low' },
  ];

  let sorted: Player[] = [];
  phases.forEach(phase => {
    const filtered = players.filter(p => p.role === phase.role && p.tier === phase.tier);
    sorted = [...sorted, ...filtered];
  });

  // Add any remaining players
  const remaining = players.filter(p => !sorted.find(s => s.id === p.id));
  return [...sorted, ...remaining];
};

export const calculatePlayerScore = (player: Player) => {
  const { stats, role } = player;
  let score = 0;

  if (role === 'Batter' || role === 'Wicketkeeper') {
    score += (stats.runs || 0) * 0.1;
    score += (stats.average || 0) * 5;
    if ((stats.strikeRate || 0) > 140) score += 50;
  } else if (role === 'Bowler') {
    score += (stats.wickets || 0) * 20;
    if ((stats.economy || 0) < 8) score += 50;
    if ((stats.average || 0) < 25) score += 30;
  } else if (role === 'All-Rounder') {
    score += (stats.runs || 0) * 0.1;
    score += (stats.wickets || 0) * 20;
    if ((stats.economy || 0) < 8.5) score += 30;
    if ((stats.strikeRate || 0) > 135) score += 30;
  }

  return Math.round(score);
};
