import type { AhorcadoCategory, AhorcadoPlayerProgress, AhorcadoState, Language } from './types.ts';

interface WordItem {
  word: string;
  hintEn: string;
  hintEs: string;
}

const WORD_BANK: Record<AhorcadoCategory, { en: WordItem[]; es: WordItem[] }> = {
  animals: {
    en: [
      { word: 'CHAMELEON', hintEn: 'Reptile famous for shifting skin colors', hintEs: 'Reptil famoso por cambiar de color' },
      { word: 'FLAMINGO', hintEn: 'Tall pink wading bird balancing on one leg', hintEs: 'Ave rosada que se apoya en una pata' },
      { word: 'ARMADILLO', hintEn: 'Small mammal wearing natural armor plates', hintEs: 'Mamífero pequeño con coraza natural' },
      { word: 'OCTOPUS', hintEn: 'Clever sea creature with eight arms', hintEs: 'Criatura marina inteligente con ocho brazos' },
      { word: 'ALBATROSS', hintEn: 'Ocean bird with the widest wingspan', hintEs: 'Ave oceánica de gran envergadura' },
    ],
    es: [
      { word: 'CAMALEON', hintEn: 'Reptile that changes skin color', hintEs: 'Reptil famoso por cambiar de color' },
      { word: 'FLAMENCO', hintEn: 'Pink wading bird', hintEs: 'Ave zancuda de plumaje rosado' },
      { word: 'GUACAMAYA', hintEn: 'Colorful tropical parrot', hintEs: 'Ave tropical de colores vibrantes' },
      { word: 'MURCIELAGO', hintEn: 'Only flying mammal', hintEs: 'Único mamífero capaz de volar' },
      { word: 'CAPIBARA', hintEn: 'World largest rodent', hintEs: 'El roedor más grande del mundo' },
    ],
  },
  geography: {
    en: [
      { word: 'CARTAGENA', hintEn: 'Historic walled Caribbean port city in Colombia', hintEs: 'Histórica ciudad amurallada del Caribe' },
      { word: 'PATAGONIA', hintEn: 'Wind-swept southern region of South America', hintEs: 'Región austral de Sudamérica' },
      { word: 'ARCHIPELAGO', hintEn: 'Chain or cluster of islands in the sea', hintEs: 'Conjunto o cadena de islas' },
      { word: 'KILIMANJARO', hintEn: 'Highest free-standing volcanic peak in Africa', hintEs: 'La montaña más alta de África' },
      { word: 'MEDITERRANEAN', hintEn: 'Sea bordered by Southern Europe and North Africa', hintEs: 'Mar entre Europa del Sur y África' },
    ],
    es: [
      { word: 'CARTAGENA', hintEn: 'Walled Caribbean city', hintEs: 'Ciudad amurallada del Caribe colombiano' },
      { word: 'CORDILLERA', hintEn: 'Chain of mountains', hintEs: 'Cadena extensa de montañas' },
      { word: 'PATAGONIA', hintEn: 'Southern Andes region', hintEs: 'Región glaciar al sur de América' },
      { word: 'AMAZONAS', hintEn: 'Largest tropical river basin', hintEs: 'Río y selva tropical más caudalosa' },
      { word: 'PENINSULA', hintEn: 'Land surrounded by water on three sides', hintEs: 'Tierra rodeada de agua salvo por un istmo' },
    ],
  },
  science: {
    en: [
      { word: 'GRAVITATION', hintEn: 'Fundamental force keeping planets in orbit', hintEs: 'Fuerza que mantiene los planetas en órbita' },
      { word: 'PHOTOSYNTHESIS', hintEn: 'How plants convert sunlight into chemical energy', hintEs: 'Proceso vegetal que transforma la luz solar' },
      { word: 'TELESCOPE', hintEn: 'Optical instrument for observing distant galaxies', hintEs: 'Instrumento para observar astros lejanos' },
      { word: 'MOLECULE', hintEn: 'Two or more atoms bonded together', hintEs: 'Grupo de átomos enlazados' },
      { word: 'ELECTRON', hintEn: 'Negatively charged subatomic particle', hintEs: 'Partícula subatómica de carga negativa' },
    ],
    es: [
      { word: 'GRAVEDAD', hintEn: 'Attraction between masses', hintEs: 'Fuerza de atracción entre masas' },
      { word: 'TELESCOPIO', hintEn: 'Instrument for observing stars', hintEs: 'Instrumento óptico para observar galaxias' },
      { word: 'MOLECULA', hintEn: 'Group of bonded atoms', hintEs: 'Conjunto estable de átomos unidos' },
      { word: 'ASTRONOMIA', hintEn: 'Study of celestial bodies', hintEs: 'Ciencia que estudia el universo y los astros' },
      { word: 'CATALIZADOR', hintEn: 'Speeds up a chemical reaction', hintEs: 'Sustancia que acelera una reacción química' },
    ],
  },
  cuisine: {
    en: [
      { word: 'EMPANADA', hintEn: 'Golden baked or fried stuffed pastry pocket', hintEs: 'Masa dorada rellena y horneada o frita' },
      { word: 'SAFFRON', hintEn: 'Precious crimson spice harvested from crocus flowers', hintEs: 'Especia dorada muy apreciada en paellas' },
      { word: 'CEVICHE', hintEn: 'Fresh citrus-cured coastal seafood dish', hintEs: 'Plato fresco marinado en jugo de limón' },
      { word: 'ESPRESSO', hintEn: 'Concentrated Italian coffee brewed under pressure', hintEs: 'Café concentrado preparado a alta presión' },
      { word: 'CROISSANT', hintEn: 'Flaky crescent-shaped French butter pastry', hintEs: 'Hojaldre francés en forma de media luna' },
    ],
    es: [
      { word: 'EMPANADA', hintEn: 'Stuffed pastry', hintEs: 'Masa crujiente rellena tradicional' },
      { word: 'PATACON', hintEn: 'Twice-fried smashed green plantain', hintEs: 'Plátano verde aplastado y frito dos veces' },
      { word: 'AREPAS', hintEn: 'Grilled cornmeal patties', hintEs: 'Tortillas tradicionales de maíz molido' },
      { word: 'CHOCOLATE', hintEn: 'Roasted cacao sweet treat', hintEs: 'Delicia elaborada a base de cacao' },
      { word: 'GUACAMOLE', hintEn: 'Mashed avocado dip', hintEs: 'Salsa cremosa preparada con aguacate' },
    ],
  },
  cinema: {
    en: [
      { word: 'STORYBOARD', hintEn: 'Illustrated sequence of panels before filming', hintEs: 'Secuencia ilustrada de escenas antes de rodar' },
      { word: 'PROTAGONIST', hintEn: 'Central leading character of a story', hintEs: 'Personaje principal de una obra' },
      { word: 'SOUNDTRACK', hintEn: 'Musical score accompanying a motion picture', hintEs: 'Música original de una película' },
      { word: 'ANIMATION', hintEn: 'Bringing drawings or models to life frame by frame', hintEs: 'Arte de dar movimiento cuadro a cuadro' },
      { word: 'DIRECTOR', hintEn: 'Creative visionary guiding the film crew and cast', hintEs: 'Responsable creativo de dirigir la película' },
    ],
    es: [
      { word: 'ESCENARIO', hintEn: 'Stage where actors perform', hintEs: 'Espacio donde se desarrolla la escena' },
      { word: 'PROTAGONISTA', hintEn: 'Main character', hintEs: 'Personaje central de la historia' },
      { word: 'FOTOGRAFIA', hintEn: 'Cinematography art', hintEs: 'Arte de capturar la luz en el cine' },
      { word: 'ANIMACION', hintEn: 'Frame-by-frame motion', hintEs: 'Técnica audiovisual cuadro por cuadro' },
      { word: 'GUIONISTA', hintEn: 'Script writer', hintEs: 'Autor que escribe los diálogos y escenas' },
    ],
  },
};

export function createAhorcadoGame(
  playerIds: string[],
  language: Language,
  category: AhorcadoCategory,
  roundNumber = 1
): AhorcadoState {
  const list = WORD_BANK[category][language];
  const item = list[Math.floor(Math.random() * list.length)];
  const word = item.word.toUpperCase();

  const progress: Record<string, AhorcadoPlayerProgress> = {};
  const revealedMask: Record<string, string[]> = {};

  for (const pid of playerIds) {
    progress[pid] = {
      playerId: pid,
      guessedLetters: [],
      wrongCount: 0,
      solved: false,
      eliminated: false,
      score: 0,
      finishedAt: null,
    };
    revealedMask[pid] = Array.from(word).map(() => '');
  }

  return {
    language,
    category,
    hint: language === 'es' ? item.hintEs : item.hintEn,
    wordLength: word.length,
    secretWord: word,
    revealedMask,
    progress,
    maxWrong: 6,
    roundNumber,
    winnerId: null,
    status: 'playing',
    lastActionText: language === 'es' ? '¡Adivina la palabra secreta!' : 'Guess the secret word!',
  };
}

export function guessAhorcadoLetter(
  state: AhorcadoState,
  playerId: string,
  rawLetter: string,
  playerName: string
): AhorcadoState {
  if (state.status !== 'playing') return state;
  const p = state.progress[playerId];
  if (!p || p.solved || p.eliminated) return state;

  const letter = rawLetter
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 1);

  if (!letter || !/^[A-ZÑ]$/.test(letter)) return state;
  if (p.guessedLetters.includes(letter)) return state;

  const guessedLetters = [...p.guessedLetters, letter];
  const isHit = state.secretWord.includes(letter);
  const wrongCount = isHit ? p.wrongCount : p.wrongCount + 1;
  const nextMask = Array.from(state.secretWord).map((ch) =>
    guessedLetters.includes(ch) ? ch : ''
  );

  const solved = nextMask.every((ch) => ch !== '');
  const eliminated = wrongCount >= state.maxWrong;
  const score = p.score + (isHit ? 15 : 0) + (solved ? 100 + (state.maxWrong - wrongCount) * 15 : 0);

  const nextProgress: Record<string, AhorcadoPlayerProgress> = {
    ...state.progress,
    [playerId]: {
      ...p,
      guessedLetters,
      wrongCount,
      solved,
      eliminated,
      score,
      finishedAt: solved || eliminated ? Date.now() : null,
    },
  };

  const nextMasks = { ...state.revealedMask, [playerId]: nextMask };

  // Determine if round ends (someone solved OR all players eliminated)
  const allDone = Object.values(nextProgress).every((pr) => pr.solved || pr.eliminated);
  let winnerId = state.winnerId;
  let status: 'playing' | 'finished' = state.status;
  let lastActionText = isHit
    ? `${playerName} found "${letter}"!`
    : `${playerName} missed "${letter}".`;

  if (solved && !winnerId) {
    winnerId = playerId;
    status = 'finished';
    lastActionText = `${playerName} solved "${state.secretWord}"!`;
  } else if (allDone) {
    status = 'finished';
    lastActionText = `Round complete — word was "${state.secretWord}".`;
  }

  return {
    ...state,
    progress: nextProgress,
    revealedMask: nextMasks,
    winnerId,
    status,
    lastActionText,
  };
}

export function chooseAiAhorcadoLetter(state: AhorcadoState, aiId: string): string | null {
  const p = state.progress[aiId];
  if (!p || p.solved || p.eliminated) return null;
  const freqOrder = 'EAOSRNIDLCTUMPBGVYQHFJZKWX';
  for (const ch of freqOrder) {
    if (!p.guessedLetters.includes(ch)) {
      return ch;
    }
  }
  return null;
}

export function sanitizeAhorcadoForPlayer(state: AhorcadoState, _viewerId: string): AhorcadoState {
  if (state.status === 'finished') return state;
  return {
    ...state,
    secretWord: '', // hidden until solved or finished
  };
}
