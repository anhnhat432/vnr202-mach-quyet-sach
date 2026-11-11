import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { mapRpcError, rpc } from "@/features/arena/server/arena-service";
import { deriveProviderPassword } from "@/features/auth/domain/provider-password";
import { recordAudit } from "@/features/auth/server/audit";
import { ApiError } from "@/lib/api/errors";
import type { ServerEnv } from "@/lib/config/server-env";

export const FIXTURE_MARKER = "[GIẢ LẬP]";

const DEV87_SPEC: Record<string, Record<string, number>> = {
  minefield_main: { easy: 9, medium: 12, hard: 9 },
  minefield_defuse: { easy: 12 },
  race: { easy: 15, medium: 21, hard: 9 },
};

const CHAPTERS = ["chapter_1", "chapter_2", "chapter_3"] as const;

const REHEARSAL_DISPLAY_NAMES = [
  "An N.V.",
  "Bình T.T.",
  "Chi L.M.",
  "Dũng P.Q.",
  "Em H.T.",
  "Giang V.K.",
  "Hà Đ.T.",
  "Khoa N.M.",
  "Lan P.T.",
  "Minh T.Đ.",
  "Nga L.T.",
  "Phúc H.V.",
  "Quân Đ.H.",
  "Sơn V.T.",
  "Trang N.K.",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SyntheticFixtureQuestion = {
  key: string;
  game: "minefield" | "race";
  pool: "minefield_main" | "minefield_defuse" | "race";
  chapter: (typeof CHAPTERS)[number];
  topic: string;
  type: "single_choice" | "before_after" | "pair_choice" | "defuse_ab";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
  explanation: string;
};

export function generateRehearsalFixtures(seed = 20261030, keyPrefix = "fx"): SyntheticFixtureQuestion[] {
  const rand = mulberry32(seed);
  const out: SyntheticFixtureQuestion[] = [];
  for (const [poolKey, byDifficulty] of Object.entries(DEV87_SPEC)) {
    const pool = poolKey as SyntheticFixtureQuestion["pool"];
    const game = pool === "race" ? "race" : "minefield";
    for (const [diffKey, count] of Object.entries(byDifficulty)) {
      const difficulty = diffKey as SyntheticFixtureQuestion["difficulty"];
      for (let i = 1; i <= count; i += 1) {
        let type: SyntheticFixtureQuestion["type"] = "single_choice";
        if (pool === "minefield_defuse") type = "defuse_ab";
        else if (pool === "race") {
          const roll = i % 3;
          type = roll === 0 ? "before_after" : i % 7 === 0 ? "pair_choice" : "single_choice";
        }
        const optionCount = type === "single_choice" || type === "pair_choice" ? 3 : 2;
        const ids = ["a", "b", "c"].slice(0, optionCount);
        const correct = ids[Math.floor(rand() * ids.length)]!;
        const label = `${pool}-${difficulty}-${String(i).padStart(2, "0")}`;
        out.push({
          key: `${keyPrefix}-${pool.replace("_", "-")}-${difficulty}-${String(i).padStart(3, "0")}`,
          game,
          pool,
          chapter: CHAPTERS[(i - 1) % 3]!,
          topic: `${FIXTURE_MARKER} ${label}`,
          type,
          difficulty,
          prompt: `${FIXTURE_MARKER} Câu ${label}: chọn đáp án ${correct.toUpperCase()}`,
          options: ids.map((id) => ({ id, label: `Đáp án ${id.toUpperCase()}` })),
          correctOptionId: correct,
          explanation: `${FIXTURE_MARKER} Dữ liệu giả lập phục vụ phòng thi thử, tách biệt hoàn toàn với ngân hàng câu hỏi chính thức.`,
        });
      }
    }
  }
  return out;
}

export async function ensureRehearsalFixtures(admin: SupabaseClient): Promise<{ seeded: number; totalFixtures: number }> {
  const { data: existing, error: listErr } = await admin
    .from("questions")
    .select("id, external_key, published_version_id")
    .eq("origin", "fixture");
  if (listErr) throw listErr;

  const existingByKey = new Map((existing ?? []).map((row) => [row.external_key as string, row]));
  const publishedCount = (existing ?? []).filter((row) => row.published_version_id !== null).length;
  if (publishedCount >= 87) {
    return { seeded: 0, totalFixtures: publishedCount };
  }

  const fixtures = generateRehearsalFixtures(20261030, "fx");
  const missing = fixtures.filter((q) => !existingByKey.has(q.key));
  if (missing.length === 0) {
    return { seeded: 0, totalFixtures: existing?.length ?? 0 };
  }

  const { data: insertedQuestions, error: qErr } = await admin
    .from("questions")
    .insert(
      missing.map((q) => ({
        external_key: q.key,
        game_type: q.game,
        pool: q.pool,
        chapter: q.chapter,
        topic: q.topic,
        question_type: q.type,
        option_count: q.options.length,
        difficulty: q.difficulty,
        origin: "fixture",
      })),
    )
    .select("id, external_key");
  if (qErr) throw qErr;

  const idByKey = new Map((insertedQuestions ?? []).map((row) => [row.external_key as string, row.id as string]));
  const { error: vErr } = await admin.from("question_versions").insert(
    missing.map((q) => ({
      question_id: idByKey.get(q.key),
      version: 1,
      status: "published",
      content_public: { prompt: q.prompt, options: q.options },
      content_private: { correctOptionId: q.correctOptionId, explanation: q.explanation },
    })),
  );
  if (vErr) throw vErr;

  return { seeded: missing.length, totalFixtures: publishedCount + missing.length };
}

export type RehearsalAccountItem = {
  id: string;
  studentId: string;
  fullName: string;
  displayName: string;
  status: string;
  updatedAt: string;
};

const PROTECTED_CLASS_DB_REFS = ["gqooookpcuoqkyvjwtpp", "srmdkhcafeeprvizqhvf"];

export function getDatabaseEnvironmentInfo(rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, vercelEnv = process.env.VERCEL_ENV) {
  let host = "unknown";
  let projectRef = "local";
  try {
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      host = parsed.host;
      if (host.endsWith(".supabase.co")) {
        projectRef = host.split(".")[0] ?? host;
      } else if (host.startsWith("127.0.0.1") || host.startsWith("localhost")) {
        projectRef = "local-sandbox";
      } else {
        projectRef = host;
      }
    }
  } catch {
    host = "invalid-url";
  }

  const isProtectedClassDb = PROTECTED_CLASS_DB_REFS.includes(projectRef);
  const isSandboxIsolated = !isProtectedClassDb;
  const previewWriteBlocked = Boolean(vercelEnv === "preview" && isProtectedClassDb);

  return {
    host,
    projectRef,
    isProtectedClassDb,
    isSandboxIsolated,
    previewWriteBlocked,
  };
}

export function assertRehearsalWriteAllowed(rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, vercelEnv = process.env.VERCEL_ENV) {
  const info = getDatabaseEnvironmentInfo(rawUrl, vercelEnv);
  if (info.previewWriteBlocked) {
    throw new ApiError(
      403,
      "preview_shares_class_database",
      `Môi trường Preview hiện đang trỏ tới database lớp học (${info.projectRef}). Mọi thao tác ghi từ Preview bị khóa cứng (fail-closed) để bảo vệ tuyệt đối cuộc thi 02/11 và 39 tài khoản lớp.`,
    );
  }
}

export async function listRehearsalAccounts(admin: SupabaseClient): Promise<RehearsalAccountItem[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, student_id, full_name, display_name, display_name_suffix, status, updated_at, is_rehearsal, class_id")
    .eq("role", "student")
    .eq("is_rehearsal", true)
    .is("class_id", null)
    .order("student_id", { ascending: true });

  if (error) {
    throw new ApiError(
      503,
      "rehearsal_isolation_not_ready",
      "Cơ sở dữ liệu chưa áp dụng migration cách ly phòng thi thử (is_rehearsal). Hệ thống khóa thao tác (fail-closed) để bảo vệ dữ liệu lớp học.",
    );
  }

  return (data ?? [])
    .filter((r) => r.is_rehearsal === true && r.class_id === null)
    .map((r) => ({
      id: String(r.id),
      studentId: String(r.student_id),
      fullName: String(r.full_name),
      displayName: r.display_name_suffix ? `${r.display_name} (${r.display_name_suffix})` : String(r.display_name),
      status: String(r.status),
      updatedAt: String(r.updated_at),
    }));
}

export async function provisionRehearsalAccounts(
  deps: { admin: SupabaseClient; env: ServerEnv },
  params: { actorId: string; count: number; requestId?: string },
): Promise<{ accounts: RehearsalAccountItem[]; createdCount: number; refreshedCount: number }> {
  assertRehearsalWriteAllowed(deps.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!Number.isInteger(params.count) || params.count < 1 || params.count > 30) {
    throw new ApiError(422, "validation_error", "Số lượng tài khoản thử phải từ 1 đến 30.");
  }

  const { data: allProfiles, error: profErr } = await deps.admin
    .from("profiles")
    .select("id, student_id, class_id, is_rehearsal")
    .eq("role", "student");

  if (profErr) {
    throw new ApiError(
      503,
      "rehearsal_isolation_not_ready",
      "Cơ sở dữ liệu chưa có cột cách ly is_rehearsal. Hệ thống từ chối tạo tài khoản thử (fail-closed).",
    );
  }

  // Any profile that is not strictly marked is_rehearsal === true and class_id === null is treated as a protected student ID.
  const protectedStudentIds = new Set(
    (allProfiles ?? [])
      .filter((p) => p.is_rehearsal !== true || p.class_id !== null)
      .map((p) => String(p.student_id ?? "").toUpperCase()),
  );
  const existingRehearsalByCode = new Map(
    (allProfiles ?? [])
      .filter((p) => p.is_rehearsal === true && p.class_id === null && /^THU\d+/i.test(String(p.student_id ?? "")))
      .map((p) => [String(p.student_id ?? "").toUpperCase(), String(p.id)]),
  );

  let createdCount = 0;
  let refreshedCount = 0;
  const targetCodes: string[] = [];
  let seq = 1;
  while (targetCodes.length < params.count && seq <= 999) {
    const candidate = `THU${String(seq).padStart(3, "0")}`;
    seq += 1;
    if (protectedStudentIds.has(candidate)) continue;
    targetCodes.push(candidate);
  }

  for (let i = 0; i < targetCodes.length; i += 1) {
    const studentId = targetCodes[i]!;
    const derivedPassword = deriveProviderPassword(
      deps.env.AUTH_PASSWORD_PEPPER,
      studentId,
      deps.env.ROSTER_DEFAULT_PASSWORD,
    );
    const existingProfileId = existingRehearsalByCode.get(studentId);

    if (existingProfileId) {
      const { error: authErr } = await deps.admin.auth.admin.updateUserById(existingProfileId, {
        password: derivedPassword,
        app_metadata: { role: "student" },
      });
      if (authErr) throw authErr;
      const upd = await deps.admin
        .from("profiles")
        .update({ status: "active", requires_display_name: false, is_rehearsal: true, class_id: null })
        .eq("id", existingProfileId)
        .eq("is_rehearsal", true)
        .select("id, is_rehearsal, class_id")
        .single();
      if (upd.error || upd.data?.is_rehearsal !== true || upd.data?.class_id !== null) {
        throw new ApiError(
          503,
          "rehearsal_isolation_not_ready",
          "Không thể xác nhận cờ cách ly is_rehearsal=true khi cập nhật tài khoản thử. Đã dừng thao tác (fail-closed).",
        );
      }
      refreshedCount += 1;
      continue;
    }

    const internalEmail = `${crypto.randomUUID()}@${deps.env.INTERNAL_AUTH_EMAIL_DOMAIN}`;
    const createdAuth = await deps.admin.auth.admin.createUser({
      email: internalEmail,
      password: derivedPassword,
      email_confirm: true,
      app_metadata: { role: "student" },
    });
    if (createdAuth.error || !createdAuth.data.user) {
      throw createdAuth.error ?? new Error("Failed to create rehearsal auth user");
    }

    const userId = createdAuth.data.user.id;
    const baseDisplay = REHEARSAL_DISPLAY_NAMES[i % REHEARSAL_DISPLAY_NAMES.length]!;
    const suffix = i >= REHEARSAL_DISPLAY_NAMES.length ? Math.floor(i / REHEARSAL_DISPLAY_NAMES.length) + 1 : null;

    const insertProf = await deps.admin
      .from("profiles")
      .insert({
        id: userId,
        role: "student",
        student_id: studentId,
        full_name: `Thí Sinh Thử Nghiệm ${String(i + 1).padStart(2, "0")}`,
        display_name: baseDisplay,
        display_name_suffix: suffix,
        status: "active",
        class_id: null,
        requires_display_name: false,
        is_rehearsal: true,
      })
      .select("id, is_rehearsal, class_id")
      .single();

    if (insertProf.error || insertProf.data?.is_rehearsal !== true || insertProf.data?.class_id !== null) {
      await deps.admin.auth.admin.deleteUser(userId);
      throw new ApiError(
        503,
        "rehearsal_isolation_not_ready",
        "Không thể ghi cờ cách ly is_rehearsal=true cho tài khoản thử. Đã thu hồi tài khoản vừa tạo (fail-closed).",
      );
    }

    const { error: identErr } = await deps.admin
      .from("student_auth_identities")
      .insert({ profile_id: userId, internal_email: internalEmail });
    if (identErr) {
      await deps.admin.auth.admin.deleteUser(userId);
      throw identErr;
    }

    createdCount += 1;
  }

  await recordAudit(deps.admin, {
    actorId: params.actorId,
    action: "rehearsal.accounts_provisioned",
    targetType: "rehearsal",
    targetId: "accounts",
    after: { requestedCount: params.count, createdCount, refreshedCount, studentIds: targetCodes },
    requestId: params.requestId,
  });

  const accounts = await listRehearsalAccounts(deps.admin);
  return { accounts, createdCount, refreshedCount };
}

export async function openOrResetRehearsalRound(
  admin: SupabaseClient,
  actorId: string,
  options: { name?: string; startWindowMinutes?: number; requestId?: string } = {},
) {
  assertRehearsalWriteAllowed();
  const startWindowMinutes = options.startWindowMinutes ?? 180;
  if (!Number.isInteger(startWindowMinutes) || startWindowMinutes < 5 || startWindowMinutes > 1440) {
    throw new ApiError(422, "invalid_start_window", "Thời gian mở nhận lượt thi thử phải từ 5 đến 1440 phút.");
  }

  // Fail closed if the isolation schema is not installed on the database
  const { error: isolationSchemaErr } = await admin.from("profiles").select("is_rehearsal").limit(1);
  if (isolationSchemaErr) {
    throw new ApiError(
      503,
      "rehearsal_isolation_not_ready",
      "Cơ sở dữ liệu chưa áp dụng migration cách ly phòng thi thử. Hệ thống khóa thao tác (fail-closed).",
    );
  }

  // Ensure no official competition is currently open
  const { data: openOfficial, error: checkErr } = await admin
    .from("competitions")
    .select("id, name")
    .eq("kind", "official")
    .eq("state", "open")
    .maybeSingle();
  if (checkErr) throw checkErr;
  if (openOfficial) {
    throw new ApiError(
      409,
      "official_competition_currently_open",
      `Cuộc thi chính thức "${openOfficial.name}" đang mở. Không thể mở hoặc đặt lại phòng thi thử lúc này.`,
    );
  }

  const fixturesInfo = await ensureRehearsalFixtures(admin);
  const rpcRes = await admin.rpc("reset_rehearsal_competition", {
    p_actor: actorId,
    p_name: options.name?.trim() || null,
    p_start_window_minutes: startWindowMinutes,
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === "42883" || rpcRes.error.code === "PGRST202") {
      throw new ApiError(
        503,
        "rehearsal_isolation_not_ready",
        "Hàm cách ly reset_rehearsal_competition chưa được cài đặt trên cơ sở dữ liệu (fail-closed).",
      );
    }
    throw mapRpcError(rpcRes.error);
  }

  return {
    ...(rpcRes.data as Record<string, unknown>),
    fixtures: fixturesInfo,
  };
}

export async function closeActiveRehearsalRound(admin: SupabaseClient, actorId: string) {
  assertRehearsalWriteAllowed();
  const { data: activeRehearsals, error } = await admin
    .from("competitions")
    .select("id, name, state, kind")
    .eq("kind", "rehearsal")
    .in("state", ["open", "start_closed"]);
  if (error) throw error;
  if (!activeRehearsals || activeRehearsals.length === 0) {
    throw new ApiError(404, "not_found", "Hiện không có phòng thi thử nào đang mở.");
  }

  const closed: string[] = [];
  for (const comp of activeRehearsals) {
    if (comp.state === "open") {
      await rpc(admin, "transition_competition_confirmed", {
        p_competition_id: comp.id,
        p_actor: actorId,
        p_target: "start_closed",
        p_expected_attempts: 60,
        p_confirmed: false,
        p_reason: null,
      });
    }
    closed.push(String(comp.id));
  }
  return { closedIds: closed };
}

export async function getRehearsalStudioState(admin: SupabaseClient, actorId: string) {
  const [fixturesRes, accounts, competitions] = await Promise.all([
    admin.from("questions").select("id", { count: "exact", head: true }).eq("origin", "fixture").not("published_version_id", "is", null),
    listRehearsalAccounts(admin),
    rpc<Array<{
      id: string;
      publicId: string;
      name: string;
      kind: "official" | "rehearsal";
      state: string;
      standing: string;
      opensAt: string;
      startDeadlineAt: string;
      finalizedAt: string | null;
      attempts: number;
      active: number;
      completed?: number;
      participants?: number;
    }>>(admin, "arena_admin_competitions", { p_actor: actorId }),
  ]);

  const fixtureCount = fixturesRes.count ?? 0;
  const rehearsalCompetitions = (competitions ?? []).filter((c) => c.kind === "rehearsal");
  const officialOpen = (competitions ?? []).some((c) => c.kind === "official" && c.state === "open");
  const activeRehearsal =
    rehearsalCompetitions.find((c) => c.state === "open") ??
    rehearsalCompetitions.find((c) => c.state === "start_closed" || c.state === "settling") ??
    rehearsalCompetitions[0] ??
    null;

  let leaderboards: { minefield: unknown; race: unknown } | null = null;
  if (activeRehearsal && activeRehearsal.state !== "draft" && activeRehearsal.state !== "scheduled") {
    try {
      const [minefield, race] = await Promise.all([
        rpc(admin, "get_leaderboard", { p_competition_public_id: activeRehearsal.publicId, p_game: "minefield", p_limit: 10 }),
        rpc(admin, "get_leaderboard", { p_competition_public_id: activeRehearsal.publicId, p_game: "race", p_limit: 10 }),
      ]);
      leaderboards = { minefield, race };
    } catch {
      leaderboards = null;
    }
  }

  return {
    fixtureCount,
    fixturesReady: fixtureCount >= 87,
    officialOpen,
    activeRehearsal,
    rehearsalHistory: rehearsalCompetitions.slice(0, 8),
    accounts,
    leaderboards,
    environmentInfo: getDatabaseEnvironmentInfo(),
  };
}
