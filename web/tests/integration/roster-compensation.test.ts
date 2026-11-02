// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyRosterImport, createRosterPreview, retryRosterCleanup } from "@/features/roster/server/roster-service";
import { cleanupClass, env, serviceClient, utf8 } from "./stack";

const admin = serviceClient();
const CLASS = `CMP-${Date.now().toString(36)}`;
const adminEmail = `cmp-admin-${crypto.randomUUID()}@test.invalid`;
let adminId = "";
let seq = 0;

const csv = (ids: string[]) => utf8(["MSSV,Họ và tên", ...ids.map((id, i) => `${id},Người Số ${i + 1}`)].join("\n"));
const authUserExists = async (id: string) => Boolean((await admin.auth.admin.getUserById(id)).data?.user);
const profileExists = async (id: string) => ((await admin.from("profiles").select("id", { count: "exact", head: true }).eq("id", id)).count ?? 0) > 0;

async function newImport(count: number) {
  const base = `C${Date.now().toString(36).toUpperCase()}${(seq += 1)}`;
  const ids = Array.from({ length: count }, (_, i) => `${base}X${i}`);
  const preview = await createRosterPreview({ admin, env }, { actorId: adminId, classCode: CLASS, className: "Lớp bù trừ", fileName: "l.csv", bytes: csv(ids) });
  return { importId: preview.importId, studentIds: ids };
}

// Provider that creates real accounts through GoTrue and records their ids.
function recordingCreator() {
  const ids: string[] = [];
  return {
    ids,
    create: async (attributes: { email: string; password: string }) => {
      const { data, error } = await admin.auth.admin.createUser({ ...attributes, email_confirm: true, app_metadata: { role: "student" } });
      if (error || !data.user) throw error;
      ids.push(data.user.id);
      return { id: data.user.id };
    },
  };
}

const failThird = (ids: string[], create: (a: { email: string; password: string }) => Promise<{ id: string }>) => {
  let calls = 0;
  return async (attributes: { email: string; password: string }) => {
    calls += 1;
    if (calls === 3) throw new Error("provider down");
    return create(attributes);
  };
};

beforeAll(async () => {
  await cleanupClass(admin, CLASS);
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: `Adm-${crypto.randomUUID()}`, email_confirm: true, app_metadata: { role: "admin" } });
  if (error || !data.user) throw error;
  adminId = data.user.id;
  await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "Quản trị", display_name: "Quản trị" });
});

afterAll(async () => {
  await cleanupClass(admin, CLASS);
  if (adminId) await admin.auth.admin.deleteUser(adminId);
});

const apply = (importId: string, deps: Parameters<typeof applyRosterImport>[0]) =>
  applyRosterImport(deps, { actorId: adminId, importId, confirmedWarningRows: [], displayNameOverrides: {} });
const importStatus = async (id: string) => (await admin.from("roster_imports").select("status, error_summary").eq("id", id).single()).data!;
const auditActions = async (id: string) => (await admin.from("audit_logs").select("action").eq("target_id", id)).data!.map((r) => r.action);

describe("roster compensation verifies every deletion (AC-AUTH-002)", () => {
  it("reports success only after all accounts are verified gone", async () => {
    const { importId } = await newImport(3);
    const recorder = recordingCreator();
    await expect(apply(importId, { admin, env, createAuthUser: failThird(recorder.ids, recorder.create), compensation: { retryDelayMs: 0 } })).rejects.toMatchObject({ status: 503, code: "roster_apply_failed" });
    expect(recorder.ids).toHaveLength(2);
    for (const id of recorder.ids) expect(await authUserExists(id) || await profileExists(id)).toBe(false);
    expect((await importStatus(importId)).status).toBe("compensated");
    expect(await auditActions(importId)).toContain("roster.apply_compensated");
  });

  it("retries a transient delete failure and still ends compensated", async () => {
    const { importId } = await newImport(3);
    const recorder = recordingCreator();
    const attempts = new Map<string, number>();
    await expect(
      apply(importId, {
        admin,
        env,
        createAuthUser: failThird(recorder.ids, recorder.create),
        compensation: {
          retryDelayMs: 0,
          deleteAuthUser: async (id) => {
            const n = (attempts.get(id) ?? 0) + 1;
            attempts.set(id, n);
            if (n < 3) return { message: "transient" };
            return (await admin.auth.admin.deleteUser(id)).error;
          },
        },
      }),
    ).rejects.toMatchObject({ code: "roster_apply_failed" });
    expect([...attempts.values()]).toEqual([3, 3]);
    for (const id of recorder.ids) expect(await authUserExists(id)).toBe(false);
    expect((await importStatus(importId)).status).toBe("compensated");
  });

  it("does NOT claim cleanup when a deletion keeps failing: status failed, leftovers locked and listed", async () => {
    const { importId } = await newImport(3);
    const recorder = recordingCreator();
    let stuck = "";
    await expect(
      apply(importId, {
        admin,
        env,
        createAuthUser: failThird(recorder.ids, recorder.create),
        compensation: {
          retryDelayMs: 0,
          deleteAuthUser: async (id) => {
            stuck ||= id;
            if (id === stuck) return { message: "auth admin unavailable" };
            return (await admin.auth.admin.deleteUser(id)).error;
          },
        },
      }),
    ).rejects.toMatchObject({ status: 503, code: "roster_cleanup_incomplete" });

    const state = await importStatus(importId);
    expect(state.status).toBe("failed");
    expect(state.error_summary).toMatchObject({ message: "compensation_incomplete", remainingAuthUserIds: [stuck], removedAccounts: 1 });
    const actions = await auditActions(importId);
    expect(actions).toContain("roster.apply_compensation_incomplete");
    expect(actions).not.toContain("roster.apply_compensated");
    expect(await authUserExists(stuck)).toBe(true);
    expect((await admin.from("profiles").select("status").eq("id", stuck).single()).data!.status).toBe("locked");
    const other = recorder.ids.find((id) => id !== stuck)!;
    expect(await authUserExists(other)).toBe(false);

    // The recorded leftover can be cleaned later once Auth is healthy.
    await expect(retryRosterCleanup({ admin, env, compensation: { retryDelayMs: 0 } }, { actorId: adminId, importId })).resolves.toEqual({ removed: 1 });
    expect(await authUserExists(stuck)).toBe(false);
    expect((await importStatus(importId)).status).toBe("compensated");
    expect(await auditActions(importId)).toContain("roster.cleanup_completed");
    await expect(retryRosterCleanup({ admin, env }, { actorId: adminId, importId })).rejects.toMatchObject({ status: 409 });
  });

  it("catches a delete call that reports success but did not delete (verification)", async () => {
    const { importId } = await newImport(3);
    const recorder = recordingCreator();
    await expect(
      apply(importId, {
        admin,
        env,
        createAuthUser: failThird(recorder.ids, recorder.create),
        compensation: { retryDelayMs: 0, deleteAuthUser: async () => null },
      }),
    ).rejects.toMatchObject({ code: "roster_cleanup_incomplete" });
    const state = await importStatus(importId);
    expect(state.status).toBe("failed");
    expect((state.error_summary as { remainingAuthUserIds: string[] }).remainingAuthUserIds.sort()).toEqual([...recorder.ids].sort());
    await retryRosterCleanup({ admin, env, compensation: { retryDelayMs: 0 } }, { actorId: adminId, importId });
    for (const id of recorder.ids) expect(await authUserExists(id)).toBe(false);
  });

  it("removes an account created at the provider whose response was lost (unknown id)", async () => {
    const { importId } = await newImport(2);
    const createdAtProvider: string[] = [];
    let calls = 0;
    await expect(
      apply(importId, {
        admin,
        env,
        createAuthUser: async (attributes) => {
          calls += 1;
          const { data, error } = await admin.auth.admin.createUser({ ...attributes, email_confirm: true, app_metadata: { role: "student" } });
          if (error || !data.user) throw error;
          createdAtProvider.push(data.user.id);
          if (calls === 2) throw new Error("response lost after create"); // provider created it, caller never learns the id
          return { id: data.user.id };
        },
        compensation: { retryDelayMs: 0 },
      }),
    ).rejects.toMatchObject({ code: "roster_apply_failed" });
    expect(createdAtProvider).toHaveLength(2);
    for (const id of createdAtProvider) expect(await authUserExists(id)).toBe(false);
    expect((await importStatus(importId)).status).toBe("compensated");
  });
});
