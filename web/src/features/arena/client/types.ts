// Shapes returned by the Live Arena API (server projections). The client never computes a score,
// a correctness flag or a deadline of its own: it renders these and counts down from `remainingMs`.
export type Game = "minefield" | "race";
export type Difficulty = "easy" | "medium" | "hard";
export type Outcome = "correct" | "incorrect" | "timed_out";

export type BoardCell = { index: number; opened: boolean; kind?: "question" | "bomb" | "double" | "shield" | "chest"; allocationId?: string; difficulty?: Difficulty; outcome?: Outcome | null };

export type Interaction = {
  allocationId: string;
  sequence: number;
  role: "main" | "defuse";
  status: "pending" | "released" | "expired" | "unavailable";
  contentFetched: boolean;
  difficulty?: Difficulty;
  availableInMs?: number;
  remainingMs?: number;
  upcoming?: { allocationId: string; sequence: number; availableInMs: number };
};

export type Projection = {
  attempt: {
    id: string;
    game: Game;
    state: "active" | "completed" | "timed_out" | "voided";
    version: number;
    sessionVersion: number;
    score: number;
    startedAt: string;
    endsAt: string;
    remainingMs: number;
    mainTotal: number;
    mainAnswered: number;
    mainCorrect: number;
    completionDurationMs: number | null;
    shields?: number;
    doubleArmed?: boolean;
    streak?: number;
    comboAwards?: number;
  };
  competition: { publicId: string; kind: "official" | "rehearsal"; state: string; standing: Standing };
  board: BoardCell[] | null;
  interaction: Interaction | null;
  lastEvent: { type: string; pointsDelta: number; scoreAfter: number } | null;
};

export type Standing = "provisional" | "official" | "rehearsal";

export type QuestionContent = {
  allocationId: string;
  sequence: number;
  role: "main" | "defuse";
  questionType: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  remainingMs: number;
  difficulty?: Difficulty;
};

export type ResolveResult = {
  allocationId: string;
  role: "main" | "defuse";
  outcome: Outcome;
  awardedPoints: number;
  comboBonus: number;
  doubleApplied: boolean;
  effect: "none" | "shield_consumed" | "penalty";
  scoreAfter: number;
};

export type CellResult = { cell: number; kind: NonNullable<BoardCell["kind"]>; allocationId?: string; role?: "main" | "defuse"; difficulty?: Difficulty; availableInMs?: number; awardedPoints?: number };

export type Lobby = {
  competition: { publicId: string; name: string; kind: "official" | "rehearsal"; state: string; startDeadlineAt: string } | null;
  games: Array<{ game: Game; durationMs: number; attemptId: string | null; state: Projection["attempt"]["state"] | null; score: number | null }>;
};

export type PlayerStanding = {
  rank: number | null;
  position?: number;
  players?: number;
  score?: number;
  label?: "leading" | "leading_alone" | "tied_first" | "chasing";
  gapToAbove?: number | null;
  gapToTenth?: number | null;
  leadOverSecond?: number | null;
  standing: Standing;
};

export type Leaderboard = {
  game: Game;
  standing: Standing;
  kind: "official" | "rehearsal";
  version: number;
  players: number;
  completed: number;
  entries: Array<{ rank: number; entryId: string; displayName: string; score: number; correctCount: number; hardCorrect: number; progress: number; state: "playing" | "completed" | "timed_out"; completionDurationMs: number | null }>;
};
