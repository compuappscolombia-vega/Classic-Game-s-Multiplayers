import type { DailyMissionDef, DailyMissionSlot, GameType } from './types.ts';

export const MISSION_CATALOG: DailyMissionDef[] = [
  {
    id: 'win_domino_2',
    titleEn: 'Win 2 matches of Dominó',
    titleEs: 'Gana 2 partidas de Dominó',
    game: 'domino',
    kind: 'win',
    target: 2,
    rewardElo: 30,
  },
  {
    id: 'play_ahorcado_3',
    titleEn: 'Play 3 games of Ahorcado',
    titleEs: 'Juega 3 partidas de Ahorcado',
    game: 'ahorcado',
    kind: 'play',
    target: 3,
    rewardElo: 25,
  },
  {
    id: 'win_ajedrez_1',
    titleEn: 'Win 1 match of Ajedrez',
    titleEs: 'Gana 1 partida de Ajedrez',
    game: 'ajedrez',
    kind: 'win',
    target: 1,
    rewardElo: 35,
  },
  {
    id: 'play_parques_2',
    titleEn: 'Play 2 matches of Parqués',
    titleEs: 'Juega 2 partidas de Parqués',
    game: 'parques',
    kind: 'play',
    target: 2,
    rewardElo: 25,
  },
  {
    id: 'win_bingo_1',
    titleEn: 'Call a winning Bingo 75',
    titleEs: 'Gana 1 partida de Bingo 75',
    game: 'bingo',
    kind: 'win',
    target: 1,
    rewardElo: 30,
  },
  {
    id: 'play_any_3',
    titleEn: 'Complete 3 salon matches',
    titleEs: 'Completa 3 partidas en el salón',
    game: 'any',
    kind: 'play',
    target: 3,
    rewardElo: 20,
  },
];

export function getTodayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDailyMissionsForDate(dateKey: string): [DailyMissionDef, DailyMissionDef, DailyMissionDef] {
  // Deterministic daily rotation guaranteeing Dominó + Ahorcado + rotating 3rd slot
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const slot1 = MISSION_CATALOG[0]; // 'Win 2 matches of Dominó'
  const slot2 = MISSION_CATALOG[1]; // 'Play 3 games of Ahorcado'
  const rotatingPool = MISSION_CATALOG.slice(2);
  const slot3 = rotatingPool[hash % rotatingPool.length];
  return [slot1, slot2, slot3];
}

export function applyMatchToMissions(
  slots: DailyMissionSlot[],
  game: GameType,
  outcome: 'win' | 'loss' | 'draw'
): DailyMissionSlot[] {
  return slots.map((slot) => {
    const matchesGame = slot.def.game === 'any' || slot.def.game === game;
    if (!matchesGame) return slot;
    const qualifies = slot.def.kind === 'play' || (slot.def.kind === 'win' && outcome === 'win');
    if (!qualifies) return slot;
    const nextProgress = Math.min(slot.def.target, slot.progress + 1);
    return { ...slot, progress: nextProgress };
  });
}
