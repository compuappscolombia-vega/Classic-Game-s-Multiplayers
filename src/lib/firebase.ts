import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  updateDoc,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { getDailyMissionsForDate, MISSION_CATALOG } from '../shared/missions.ts';
import type { DailyMissionSlot, GameMode, GameType, Language } from '../shared/types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;
export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  provider: 'google' | 'apple';
  elo: number;
  totalWins: number;
  totalGames: number;
  winStreak: number;
  dominoWins: number;
  parquesWins: number;
  ahorcadoWins: number;
  bingoWins: number;
  ajedrezWins: number;
  voiceEnabled: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  language: Language;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  elo: number;
  totalWins: number;
  totalGames: number;
  winStreak: number;
  favoriteGame: GameType;
}

export interface MatchHistoryRecord {
  id: string;
  uid: string;
  game: GameType;
  mode: GameMode;
  outcome: 'win' | 'loss' | 'draw';
  score: number;
  eloDelta: number;
  createdAtMs: number;
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signInWithApple(): Promise<User> {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

function inferFavoriteGame(profile: UserProfile): GameType {
  const counts: [GameType, number][] = [
    ['domino', profile.dominoWins],
    ['parques', profile.parquesWins],
    ['ahorcado', profile.ahorcadoWins],
    ['bingo', profile.bingoWins],
    ['ajedrez', profile.ajedrezWins],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

export async function ensureAndLoadUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');
  const lbRef = doc(db, 'leaderboard', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
  }

  const providerId = user.providerData?.[0]?.providerId || 'google.com';
  const provider: 'google' | 'apple' = providerId.includes('apple') ? 'apple' : 'google';
  const cleanName = (user.displayName || user.email?.split('@')[0] || 'Player').trim().slice(0, 40) || 'Player';
  const cleanPhoto = (user.photoURL || '').slice(0, 500);

  if (snap.exists()) {
    const data = snap.data();
    const profile: UserProfile = {
      uid: user.uid,
      displayName: String(data.displayName || cleanName).slice(0, 40),
      photoURL: String(data.photoURL || cleanPhoto).slice(0, 500),
      provider: data.provider === 'apple' ? 'apple' : 'google',
      elo: Number(data.elo ?? 1000),
      totalWins: Number(data.totalWins ?? 0),
      totalGames: Number(data.totalGames ?? 0),
      winStreak: Number(data.winStreak ?? 0),
      dominoWins: Number(data.dominoWins ?? 0),
      parquesWins: Number(data.parquesWins ?? 0),
      ahorcadoWins: Number(data.ahorcadoWins ?? 0),
      bingoWins: Number(data.bingoWins ?? 0),
      ajedrezWins: Number(data.ajedrezWins ?? 0),
      voiceEnabled: Boolean(data.voiceEnabled ?? true),
      soundEnabled: Boolean(data.soundEnabled ?? true),
      musicEnabled: Boolean(data.musicEnabled ?? true),
      language: data.language === 'es' ? 'es' : 'en',
    };

    try {
      const lbSnap = await getDoc(lbRef);
      if (!lbSnap.exists()) {
        await setDoc(lbRef, {
          uid: user.uid,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          elo: profile.elo,
          totalWins: profile.totalWins,
          totalGames: profile.totalGames,
          winStreak: profile.winStreak,
          favoriteGame: inferFavoriteGame(profile),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `leaderboard/${user.uid}`);
    }

    return profile;
  }

  const initialProfile: UserProfile = {
    uid: user.uid,
    displayName: cleanName,
    photoURL: cleanPhoto,
    provider,
    elo: 1000,
    totalWins: 0,
    totalGames: 0,
    winStreak: 0,
    dominoWins: 0,
    parquesWins: 0,
    ahorcadoWins: 0,
    bingoWins: 0,
    ajedrezWins: 0,
    voiceEnabled: true,
    soundEnabled: true,
    musicEnabled: true,
    language: 'en',
  };

  try {
    const batch = writeBatch(db);
    batch.set(userRef, {
      ...initialProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(privateRef, {
      uid: user.uid,
      email: (user.email || '').slice(0, 254),
      providerId: providerId.slice(0, 64),
      updatedAt: serverTimestamp(),
    });
    batch.set(lbRef, {
      uid: user.uid,
      displayName: initialProfile.displayName,
      photoURL: initialProfile.photoURL,
      elo: initialProfile.elo,
      totalWins: 0,
      totalGames: 0,
      winStreak: 0,
      favoriteGame: 'domino',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
  }

  return initialProfile;
}

export async function updateUserPreferences(
  uid: string,
  prefs: Partial<Pick<UserProfile, 'displayName' | 'voiceEnabled' | 'soundEnabled' | 'musicEnabled' | 'language'>>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const lbRef = doc(db, 'leaderboard', uid);

  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (prefs.displayName !== undefined) {
    payload.displayName = prefs.displayName.trim().slice(0, 40) || 'Player';
  }
  if (prefs.voiceEnabled !== undefined) payload.voiceEnabled = prefs.voiceEnabled;
  if (prefs.soundEnabled !== undefined) payload.soundEnabled = prefs.soundEnabled;
  if (prefs.musicEnabled !== undefined) payload.musicEnabled = prefs.musicEnabled;
  if (prefs.language !== undefined) payload.language = prefs.language;

  try {
    await updateDoc(userRef, payload);
    if (prefs.displayName !== undefined) {
      await updateDoc(lbRef, {
        displayName: payload.displayName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function recordMatchOutcome(
  profile: UserProfile,
  params: { game: GameType; mode: GameMode; outcome: 'win' | 'loss' | 'draw'; score: number }
): Promise<UserProfile> {
  const isWin = params.outcome === 'win';
  const eloDelta =
    params.mode === 'online'
      ? isWin
        ? 25
        : params.outcome === 'draw'
        ? 4
        : -15
      : isWin
      ? 10
      : 0;

  const nextElo = Math.min(10000, Math.max(0, profile.elo + eloDelta));
  const nextTotalGames = profile.totalGames + 1;
  const nextTotalWins = profile.totalWins + (isWin ? 1 : 0);
  const nextStreak = isWin ? profile.winStreak + 1 : 0;

  const nextProfile: UserProfile = {
    ...profile,
    elo: nextElo,
    totalGames: nextTotalGames,
    totalWins: nextTotalWins,
    winStreak: nextStreak,
    dominoWins: profile.dominoWins + (isWin && params.game === 'domino' ? 1 : 0),
    parquesWins: profile.parquesWins + (isWin && params.game === 'parques' ? 1 : 0),
    ahorcadoWins: profile.ahorcadoWins + (isWin && params.game === 'ahorcado' ? 1 : 0),
    bingoWins: profile.bingoWins + (isWin && params.game === 'bingo' ? 1 : 0),
    ajedrezWins: profile.ajedrezWins + (isWin && params.game === 'ajedrez' ? 1 : 0),
  };

  const matchId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userRef = doc(db, 'users', profile.uid);
  const lbRef = doc(db, 'leaderboard', profile.uid);
  const matchRef = doc(db, 'users', profile.uid, 'matches', matchId);

  try {
    const batch = writeBatch(db);
    batch.update(userRef, {
      elo: nextProfile.elo,
      totalWins: nextProfile.totalWins,
      totalGames: nextProfile.totalGames,
      winStreak: nextProfile.winStreak,
      dominoWins: nextProfile.dominoWins,
      parquesWins: nextProfile.parquesWins,
      ahorcadoWins: nextProfile.ahorcadoWins,
      bingoWins: nextProfile.bingoWins,
      ajedrezWins: nextProfile.ajedrezWins,
      updatedAt: serverTimestamp(),
    });
    batch.update(lbRef, {
      displayName: nextProfile.displayName,
      photoURL: nextProfile.photoURL,
      elo: nextProfile.elo,
      totalWins: nextProfile.totalWins,
      totalGames: nextProfile.totalGames,
      winStreak: nextProfile.winStreak,
      favoriteGame: inferFavoriteGame(nextProfile),
      updatedAt: serverTimestamp(),
    });
    batch.set(matchRef, {
      id: matchId,
      uid: profile.uid,
      game: params.game,
      mode: params.mode,
      outcome: params.outcome,
      score: Math.min(100000, Math.max(0, Math.round(params.score))),
      eloDelta,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}/matches/${matchId}`);
  }

  return nextProfile;
}

function resolveMissionDef(id: string, fallbackIndex: number, dateKey: string) {
  return (
    MISSION_CATALOG.find((m) => m.id === id) ||
    getDailyMissionsForDate(dateKey)[fallbackIndex]
  );
}

export async function loadOrInitDailyMissions(
  uid: string,
  dateKey: string
): Promise<DailyMissionSlot[]> {
  const missionRef = doc(db, 'users', uid, 'missions', dateKey);
  const defs = getDailyMissionsForDate(dateKey);

  try {
    const snap = await getDoc(missionRef);
    if (snap.exists()) {
      const data = snap.data();
      return [
        {
          def: resolveMissionDef(String(data.m1Id || ''), 0, dateKey),
          progress: Number(data.m1Progress ?? 0),
          claimed: Boolean(data.m1Claimed ?? false),
        },
        {
          def: resolveMissionDef(String(data.m2Id || ''), 1, dateKey),
          progress: Number(data.m2Progress ?? 0),
          claimed: Boolean(data.m2Claimed ?? false),
        },
        {
          def: resolveMissionDef(String(data.m3Id || ''), 2, dateKey),
          progress: Number(data.m3Progress ?? 0),
          claimed: Boolean(data.m3Claimed ?? false),
        },
      ];
    }

    await setDoc(missionRef, {
      dateKey,
      uid,
      m1Id: defs[0].id,
      m1Progress: 0,
      m1Claimed: false,
      m2Id: defs[1].id,
      m2Progress: 0,
      m2Claimed: false,
      m3Id: defs[2].id,
      m3Progress: 0,
      m3Claimed: false,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/missions/${dateKey}`);
  }

  return defs.map((def) => ({ def, progress: 0, claimed: false }));
}

export async function saveDailyMissionsProgress(
  uid: string,
  dateKey: string,
  slots: DailyMissionSlot[]
): Promise<void> {
  if (slots.length < 3) return;
  const missionRef = doc(db, 'users', uid, 'missions', dateKey);
  try {
    await setDoc(missionRef, {
      dateKey,
      uid,
      m1Id: slots[0].def.id,
      m1Progress: Math.min(10, Math.max(0, slots[0].progress)),
      m1Claimed: slots[0].claimed,
      m2Id: slots[1].def.id,
      m2Progress: Math.min(10, Math.max(0, slots[1].progress)),
      m2Claimed: slots[1].claimed,
      m3Id: slots[2].def.id,
      m3Progress: Math.min(10, Math.max(0, slots[2].progress)),
      m3Claimed: slots[2].claimed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/missions/${dateKey}`);
  }
}

export async function claimDailyMissionReward(
  profile: UserProfile,
  dateKey: string,
  slotIndex: number,
  slots: DailyMissionSlot[]
): Promise<{ profile: UserProfile; slots: DailyMissionSlot[] }> {
  const target = slots[slotIndex];
  if (!target || target.claimed || target.progress < target.def.target) {
    return { profile, slots };
  }

  const reward = Math.min(50, Math.max(1, target.def.rewardElo));
  const nextElo = Math.min(10000, profile.elo + reward);
  const nextSlots = slots.map((s, idx) => (idx === slotIndex ? { ...s, claimed: true } : s));

  const userRef = doc(db, 'users', profile.uid);
  const lbRef = doc(db, 'leaderboard', profile.uid);
  const missionRef = doc(db, 'users', profile.uid, 'missions', dateKey);

  try {
    const batch = writeBatch(db);
    batch.update(userRef, {
      elo: nextElo,
      updatedAt: serverTimestamp(),
    });
    batch.update(lbRef, {
      elo: nextElo,
      updatedAt: serverTimestamp(),
    });
    batch.set(missionRef, {
      dateKey,
      uid: profile.uid,
      m1Id: nextSlots[0].def.id,
      m1Progress: Math.min(10, Math.max(0, nextSlots[0].progress)),
      m1Claimed: nextSlots[0].claimed,
      m2Id: nextSlots[1].def.id,
      m2Progress: Math.min(10, Math.max(0, nextSlots[1].progress)),
      m2Claimed: nextSlots[1].claimed,
      m3Id: nextSlots[2].def.id,
      m3Progress: Math.min(10, Math.max(0, nextSlots[2].progress)),
      m3Claimed: nextSlots[2].claimed,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}/missions/${dateKey}`);
  }

  return {
    profile: { ...profile, elo: nextElo },
    slots: nextSlots,
  };
}

export function subscribeToLeaderboard(
  onData: (entries: LeaderboardEntry[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  const lbQuery = query(
    collection(db, 'leaderboard'),
    where('elo', '>=', 0),
    orderBy('elo', 'desc'),
    limit(50)
  );
  return onSnapshot(
    lbQuery,
    (snapshot) => {
      const rows: LeaderboardEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          displayName: String(data.displayName || 'Player'),
          photoURL: String(data.photoURL || ''),
          elo: Number(data.elo ?? 1000),
          totalWins: Number(data.totalWins ?? 0),
          totalGames: Number(data.totalGames ?? 0),
          winStreak: Number(data.winStreak ?? 0),
          favoriteGame: (data.favoriteGame || 'domino') as GameType,
        };
      });
      onData(rows);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'leaderboard');
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped.message : 'Unable to load leaderboard.');
        } else {
          throw wrapped;
        }
      }
    }
  );
}

export function subscribeToMatchHistory(
  uid: string,
  onData: (records: MatchHistoryRecord[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users', uid, 'matches'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: MatchHistoryRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
        return {
          id: String(data.id || d.id),
          uid: String(data.uid || uid),
          game: (data.game || 'domino') as GameType,
          mode: (data.mode || 'ai') as GameMode,
          outcome: (data.outcome || 'win') as 'win' | 'loss' | 'draw',
          score: Number(data.score ?? 0),
          eloDelta: Number(data.eloDelta ?? 0),
          createdAtMs: ts,
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/matches`);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped.message : 'Unable to load match history.');
        } else {
          throw wrapped;
        }
      }
    }
  );
}
