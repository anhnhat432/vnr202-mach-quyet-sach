import { z } from "zod";

// Request contracts for the Live Arena API. Every body is strict: a client cannot smuggle in a
// score, a correctness flag, a time, an item state or a profile id (LA-ANTI-003). The profile always
// comes from the verified Supabase Auth session, never from the request.
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, "Idempotency-Key không hợp lệ.");
export const uuidParam = z.guid();
export const gameParam = z.enum(["minefield", "race"]);
export const cellIndexParam = z.coerce.number().int().min(0).max(19);

export const answerBody = z.object({ allocationId: z.guid(), optionId: z.string().regex(/^[a-z0-9]{1,8}$/) }).strict();
export const emptyBody = z.object({}).strict();

export const createCompetitionBody = z
  .object({
    name: z.string().trim().min(3).max(120),
    kind: z.enum(["official", "rehearsal"]),
    opensAt: z.iso.datetime({ offset: true }),
    startDeadlineAt: z.iso.datetime({ offset: true }),
    latencyAllowanceMs: z.number().int().min(0).max(1500).optional(),
    lockWaitLimitMs: z.number().int().min(100).max(10000).optional(),
    reconcileGraceMs: z.number().int().min(50).max(2000).optional(),
    minefieldDurationMs: z.number().int().min(10000).max(900000).optional(),
    raceDurationMs: z.number().int().min(10000).max(900000).optional(),
    offsets: z
      .object({
        cellFlipMs: z.number().int().min(0).max(600).optional(),
        raceFirstMs: z.number().int().min(0).max(1000).optional(),
        raceNextMs: z.number().int().min(800).max(1000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const competitionTransitionBody = z.object({ target: z.enum(["scheduled", "open", "start_closed", "settling", "archived"]) }).strict();

// Incident actions on one attempt (LA-ADMIN-003). None can change a score, a clock, a rank or create an attempt.
export const attemptIncidentBody = z
  .object({
    action: z.enum(["note", "void_attempt", "revoke_sessions", "lock_account", "unlock_account"]),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

export const disclosedConfirmationBody = z
  .object({ questionVersionIds: z.array(z.guid()).min(1).max(200), reason: z.string().trim().min(3).max(300) })
  .strict();
