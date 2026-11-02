// Reference model of the Live Arena scoring rules (spec §7, T049). It is deliberately independent
// of the SQL implementation: parity tests replay the same scripted actions through both and compare
// every ledger step. It is also the place to read the rules in one screen.

export type Difficulty = "easy" | "medium" | "hard";
export type Outcome = "correct" | "incorrect" | "timed_out";

export const MINEFIELD = {
  points: { easy: 100, medium: 200, hard: 300 } satisfies Record<Difficulty, number>,
  limitsMs: { easy: 6000, medium: 8000, hard: 10000 } satisfies Record<Difficulty, number>,
  defuseLimitMs: 5000,
  chest: 40,
  bombPenalty: 100,
  maxShields: 2,
  mainQuestions: 10,
  maxScore: 2460,
} as const;

export const RACE = {
  points: { easy: 100, medium: 150, hard: 200 } satisfies Record<Difficulty, number>,
  limitsMs: { easy: 5000, medium: 7000, hard: 9000 } satisfies Record<Difficulty, number>,
  comboBonus: 30,
  comboEvery: 3,
  maxComboAwards: 5,
  mainQuestions: 15,
  maxScore: 2300,
} as const;

export type MinefieldAction =
  | { type: "chest" }
  | { type: "shield" }
  | { type: "double" }
  | { type: "main"; difficulty: Difficulty; outcome: Outcome }
  | { type: "defuse"; outcome: Outcome };

export type MinefieldState = { score: number; shields: number; doubleArmed: boolean; mainAnswered: number; mainCorrect: number; hardCorrect: number };
export type LedgerStep = { score: number; delta: number };

export const initialMinefield = (): MinefieldState => ({ score: 0, shields: 0, doubleArmed: false, mainAnswered: 0, mainCorrect: 0, hardCorrect: 0 });

export function applyMinefield(state: MinefieldState, action: MinefieldAction): MinefieldState {
  const next = { ...state };
  switch (action.type) {
    case "chest":
      next.score += MINEFIELD.chest;
      break;
    case "shield":
      next.shields = Math.min(MINEFIELD.maxShields, next.shields + 1);
      break;
    case "double":
      next.doubleArmed = true;
      break;
    case "main": {
      if (action.outcome === "correct") {
        next.score += MINEFIELD.points[action.difficulty] * (next.doubleArmed ? 2 : 1);
        next.mainCorrect += 1;
        if (action.difficulty === "hard") next.hardCorrect += 1;
      }
      next.doubleArmed = false; // consumed whatever the outcome (MINE-ITEM-001)
      next.mainAnswered += 1;
      break;
    }
    case "defuse":
      if (action.outcome !== "correct") {
        if (next.shields > 0) next.shields -= 1;
        else next.score = Math.max(0, next.score - MINEFIELD.bombPenalty);
      }
      break;
  }
  return next;
}

export type RaceAction = { difficulty: Difficulty; outcome: Outcome };
export type RaceState = { score: number; streak: number; comboAwards: number; mainAnswered: number; mainCorrect: number; hardCorrect: number };
export const initialRace = (): RaceState => ({ score: 0, streak: 0, comboAwards: 0, mainAnswered: 0, mainCorrect: 0, hardCorrect: 0 });

export function applyRace(state: RaceState, action: RaceAction): RaceState {
  const next = { ...state, mainAnswered: state.mainAnswered + 1 };
  if (action.outcome === "correct") {
    next.score += RACE.points[action.difficulty];
    next.streak += 1;
    next.mainCorrect += 1;
    if (action.difficulty === "hard") next.hardCorrect += 1;
    if (next.streak % RACE.comboEvery === 0 && next.comboAwards < RACE.maxComboAwards) {
      next.score += RACE.comboBonus;
      next.comboAwards += 1;
    }
  } else {
    next.streak = 0;
  }
  return next;
}

export type RankInput = { score: number; correct: number; hardCorrect: number; durationMs: number | null };

// Score, then correct count, then hard-correct count, then completion time (unfinished last);
// players equal on every criterion share a rank (1, 2, 2, 4).
export function rankEntries<T extends RankInput>(entries: T[]): Array<T & { rank: number }> {
  const key = (e: RankInput) => [-e.score, -e.correct, -e.hardCorrect, e.durationMs ?? Number.POSITIVE_INFINITY];
  const cmp = (a: RankInput, b: RankInput) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  };
  const sorted = [...entries].sort(cmp);
  return sorted.map((e, i) => ({ ...e, rank: i > 0 && cmp(sorted[i - 1], e) === 0 ? 0 : i + 1 })).reduce<Array<T & { rank: number }>>((acc, e, i) => {
    acc.push({ ...e, rank: e.rank === 0 ? acc[i - 1].rank : e.rank });
    return acc;
  }, []);
}
