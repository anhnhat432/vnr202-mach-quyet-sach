// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deriveProviderPassword } from "@/features/auth/domain/provider-password";
import { signInAdmin, signInStudent, SIGN_IN_LIMITS } from "@/features/auth/server/sign-in";
import { resetPasswordToDefault, revokeSessions, setAccountStatus, updateDisplayName } from "@/features/roster/server/admin-accounts";
import { applyRosterImport, createRosterPreview } from "@/features/roster/server/roster-service";
import { ApiError } from "@/lib/api/errors";
import { anonClient, cleanupClass, clientWithToken, env, serviceClient, stack, utf8 } from "./stack";

const admin = serviceClient();
const CLASS = `IT-${Date.now().toString(36)}`;
const adminEmail = `admin-${crypto.randomUUID()}@test.invalid`;
const adminPassword = `Adm-${crypto.randomUUID()}`;
let adminId = "";
const deps = { admin, env };

const csv = (lines: string[]) => utf8(["MSSV,Họ và tên", ...lines].join("\n"));
const studentIds = { a: "00123", b: "HE000124", c: "HE000125", dup1: "HE000126", dup2: "HE000127" };
const profileOf = async (studentId: string) => (await admin.from("profiles").select("*").eq("student_id", studentId).single()).data!;
const signIn = (studentId: string, password: string, ip = "10.0.0.1") =>
  signInStudent({ admin, auth: anonClient(), env }, { studentId, password, ip, device: "vitest" });

beforeAll(async () => {
  await cleanupClass(admin, CLASS);
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true, app_metadata: { role: "admin" } });
  if (error || !data.user) throw error;
  adminId = data.user.id;
  await admin.from("profiles").insert({ id: adminId, role: "admin", full_name: "Quản trị thử", display_name: "Quản trị" });
});

afterAll(async () => {
  await cleanupClass(admin, CLASS);
  if (adminId) await admin.auth.admin.deleteUser(adminId);
});

describe("roster import against real Auth and Postgres", () => {
  let importId = "";

  it("previews without creating any account (LA-AC-018)", async () => {
    const preview = await createRosterPreview(deps, {
      actorId: adminId,
      classCode: CLASS,
      className: "Lớp thử",
      fileName: "lop.csv",
      bytes: csv([
        `${studentIds.a},Nguyễn Văn An`,
        `${studentIds.b},Trần Thị Bình`,
        `${studentIds.c},Ngô Viết An`,
        `${studentIds.dup1},Lê Hoa`,
        `${studentIds.dup1},Lê Hoa Khác`,
        `${studentIds.dup2},`,
      ]),
    });
    importId = preview.importId;
    expect(preview.validCount).toBe(3);
    expect(preview.errorCount).toBe(3);
    expect(preview.rows.find((r) => r.studentId === studentIds.a)?.studentId).toBe("00123");
    const { count } = await admin.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student").in("student_id", Object.values(studentIds));
    expect(count).toBe(0);
  });

  it("applies valid rows, keeps leading zeros, uses random internal email and never stores a password", async () => {
    const result = await applyRosterImport(deps, { actorId: adminId, importId, confirmedWarningRows: [], displayNameOverrides: {} });
    expect(result.created).toBe(3);
    const a = await profileOf(studentIds.a);
    expect(a.student_id).toBe("00123");
    expect(a.must_change_password).toBe(false);
    expect(a.display_name).toBe("An N.V.");
    expect(a.display_name_suffix).toBeNull();
    const c = await profileOf(studentIds.c);
    expect([c.display_name, c.display_name_suffix]).toEqual(["An N.V.", 2]); // LA-LB-012
    const { data: identity } = await admin.from("student_auth_identities").select("internal_email").eq("profile_id", a.id).single();
    expect(identity!.internal_email).toMatch(/^[0-9a-f-]{36}@auth\.invalid$/);
    expect(identity!.internal_email).not.toContain("00123");
    const rows = await admin.from("roster_import_rows").select("*").eq("import_id", importId);
    expect(JSON.stringify(rows.data)).not.toMatch(/password/i);
  });

  it("rejects applying the same import twice (409 import_not_ready)", async () => {
    await expect(applyRosterImport(deps, { actorId: adminId, importId, confirmedWarningRows: [], displayNameOverrides: {} })).rejects.toMatchObject({ status: 409, code: "import_not_ready" });
  });

  it("flags existing MSSV in a later preview and leaves them untouched (LA-ACC-010)", async () => {
    const preview = await createRosterPreview(deps, { actorId: adminId, classCode: CLASS, className: "Lớp thử", fileName: "lop2.csv", bytes: csv([`${studentIds.a},Tên Khác`]) });
    expect(preview.rows[0].issues).toContain("already_exists");
    expect((await profileOf(studentIds.a)).full_name).toBe("Nguyễn Văn An");
  });

  it("compensates the whole batch when the provider fails mid-way (AC-AUTH-002)", async () => {
    const preview = await createRosterPreview(deps, {
      actorId: adminId,
      classCode: CLASS,
      className: "Lớp thử",
      fileName: "lop3.csv",
      bytes: csv(["HE900001,Một Hai", "HE900002,Ba Bốn", "HE900003,Năm Sáu"]),
    });
    let calls = 0;
    const flaky = {
      ...deps,
      createAuthUser: async (attributes: { email: string; password: string }) => {
        calls += 1;
        if (calls === 3) throw new Error("provider down");
        const { data, error } = await admin.auth.admin.createUser({ ...attributes, email_confirm: true, app_metadata: { role: "student" } });
        if (error || !data.user) throw error;
        return { id: data.user.id };
      },
    };
    await expect(applyRosterImport(flaky, { actorId: adminId, importId: preview.importId, confirmedWarningRows: [], displayNameOverrides: {} })).rejects.toMatchObject({ status: 503, code: "roster_apply_failed" });
    const { count } = await admin.from("profiles").select("*", { count: "exact", head: true }).in("student_id", ["HE900001", "HE900002", "HE900003"]);
    expect(count).toBe(0);
    const { data: imp } = await admin.from("roster_imports").select("status").eq("id", preview.importId).single();
    expect(imp!.status).toBe("compensated");
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const leaked = users.users.filter((u) => u.email?.endsWith("@auth.invalid") && !u.email.includes("test.invalid")).length;
    const { count: identities } = await admin.from("student_auth_identities").select("*", { count: "exact", head: true });
    expect(leaked).toBe(identities); // every remaining internal Auth user has a profile identity
  });

  it("requires explicit confirmation for numeric-cell warnings", async () => {
    // CSV cells are text, so use the preview builder's warning via a stored warning row.
    const preview = await createRosterPreview(deps, { actorId: adminId, classCode: CLASS, className: "Lớp thử", fileName: "lop4.csv", bytes: csv(["HE910001,Cảnh Báo"]) });
    await admin.from("roster_import_rows").update({ row_status: "warning", issues: ["numeric_cell"] }).eq("import_id", preview.importId);
    const none = await applyRosterImport(deps, { actorId: adminId, importId: preview.importId, confirmedWarningRows: [], displayNameOverrides: {} });
    expect(none.created).toBe(0);
    const again = await createRosterPreview(deps, { actorId: adminId, classCode: CLASS, className: "Lớp thử", fileName: "lop5.csv", bytes: csv(["HE910001,Cảnh Báo"]) });
    await admin.from("roster_import_rows").update({ row_status: "warning", issues: ["numeric_cell"] }).eq("import_id", again.importId);
    const confirmed = await applyRosterImport(deps, { actorId: adminId, importId: again.importId, confirmedWarningRows: [2], displayNameOverrides: { "2": "Cảnh B." } });
    expect(confirmed.created).toBe(1);
    expect((await profileOf("HE910001")).display_name).toBe("Cảnh B.");
  });
});

describe("student sign-in against real Auth (LA-ACC-003..009, LA-AC-019)", () => {
  it("signs in with MSSV and the default password, with no password-change step", async () => {
    const result = await signIn(studentIds.a, "1");
    expect(result).toMatchObject({ ok: true, role: "student", displayName: "An N.V." });
  });

  it("normalizes MSSV input (trim, case)", async () => {
    expect((await signIn(`  ${studentIds.b.toLowerCase()} `, "1")).ok).toBe(true);
  });

  it("fails generically for wrong password, unknown MSSV and the numeric-looking MSSV with lost zeros", async () => {
    expect(await signIn(studentIds.a, "2")).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(await signIn("HE404404", "1")).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(await signIn("123", "1")).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("does not let the public Auth endpoint accept the raw default password (derivation LA-ACC-005)", async () => {
    const { data: a } = await admin.from("profiles").select("id").eq("student_id", studentIds.a).single();
    const { data: identity } = await admin.from("student_auth_identities").select("internal_email").eq("profile_id", a!.id).single();
    const direct = await anonClient().auth.signInWithPassword({ email: identity!.internal_email, password: "1" });
    expect(direct.error).not.toBeNull();
    const derived = await anonClient().auth.signInWithPassword({ email: identity!.internal_email, password: deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, studentIds.a, "1") });
    expect(derived.error).toBeNull();
  });

  it("rate-limits repeated failures per MSSV, then refuses even the right password (LA-ACC-008)", async () => {
    for (let i = 0; i < SIGN_IN_LIMITS.studentFailures.limit; i += 1) await signIn(studentIds.c, "bad", `10.1.0.${i}`);
    expect(await signIn(studentIds.c, "1", "10.1.9.9")).toEqual({ ok: false, reason: "rate_limited" });
    expect((await signIn(studentIds.a, "1", "10.1.9.9")).ok).toBe(true); // other MSSV on the same IP unaffected
  });

  it("records hashed sign-in events without raw MSSV or IP (LA-ACC-009)", async () => {
    const { data } = await admin.from("auth_events").select("*").order("id", { ascending: false }).limit(20);
    expect(data!.some((e) => e.event === "sign_in_success")).toBe(true);
    expect(data!.some((e) => e.event === "sign_in_failure")).toBe(true);
    const text = JSON.stringify(data);
    expect(text).not.toContain(studentIds.a);
    expect(text).not.toContain("10.1.0.");
    expect(data!.every((e) => e.student_id_hash === null || /^[0-9a-f]{64}$/.test(e.student_id_hash))).toBe(true);
  });
});

describe("admin sign-in and account actions", () => {
  it("accepts a real admin and rejects a student on the admin path", async () => {
    expect((await signInAdmin({ admin, auth: anonClient(), env }, { email: adminEmail, password: adminPassword, ip: "10.2.0.1", device: "vitest" })).ok).toBe(true);
    const { data: a } = await admin.from("profiles").select("id").eq("student_id", studentIds.a).single();
    const { data: identity } = await admin.from("student_auth_identities").select("internal_email").eq("profile_id", a!.id).single();
    const viaAdminPath = await signInAdmin({ admin, auth: anonClient(), env }, { email: identity!.internal_email, password: deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, studentIds.a, "1"), ip: "10.2.0.2", device: "vitest" });
    expect(viaAdminPath).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("revokes sessions: the old access token stops working immediately (T033)", async () => {
    const client = anonClient();
    const first = await signInStudent({ admin, auth: client, env }, { studentId: studentIds.b, password: "1", ip: "10.3.0.1", device: "d1" });
    expect(first.ok).toBe(true);
    const token = (await client.auth.getSession()).data.session!.access_token;
    expect((await anonClient().auth.getUser(token)).error).toBeNull();
    const profile = await profileOf(studentIds.b);
    const revoked = await revokeSessions(deps, { actorId: adminId, profileId: profile.id, reason: "kiểm thử thu hồi" });
    expect(revoked.revokedSessions).toBeGreaterThanOrEqual(1);
    expect((await anonClient().auth.getUser(token)).error).not.toBeNull();
  });

  it("resets the password to the default and revokes old sessions (T033)", async () => {
    const profile = await profileOf(studentIds.b);
    await admin.auth.admin.updateUserById(profile.id, { password: "tam-thoi-khong-phai-mac-dinh-123" });
    expect((await signIn(studentIds.b, "1", "10.4.0.1")).ok).toBe(false);
    await resetPasswordToDefault(deps, { actorId: adminId, profileId: profile.id, reason: "quên mật khẩu" });
    expect((await signIn(studentIds.b, "1", "10.4.0.2")).ok).toBe(true);
  });

  it("locks and unlocks an account; a locked account cannot sign in (account_disabled)", async () => {
    const profile = await profileOf(studentIds.a);
    await setAccountStatus(deps, { actorId: adminId, profileId: profile.id, reason: "sự cố", status: "locked" });
    expect(await signIn(studentIds.a, "1", "10.5.0.1")).toEqual({ ok: false, reason: "account_disabled" });
    await setAccountStatus(deps, { actorId: adminId, profileId: profile.id, reason: "xử lý xong", status: "active" });
    expect((await signIn(studentIds.a, "1", "10.5.0.2")).ok).toBe(true);
  });

  it("edits the display name with audit and keeps duplicates distinct (LA-PRV-003)", async () => {
    const profile = await profileOf(studentIds.b);
    const result = await updateDisplayName(deps, { actorId: adminId, profileId: profile.id, reason: "đổi theo yêu cầu", displayName: "An N.V." });
    expect(result.displayNameSuffix).toBeGreaterThanOrEqual(3);
    await expect(updateDisplayName(deps, { actorId: adminId, profileId: profile.id, reason: "x", displayName: "" })).rejects.toBeInstanceOf(ApiError);
    const { data: audit } = await admin.from("audit_logs").select("*").eq("action", "account.update_display_name").eq("target_id", profile.id);
    expect(audit!.length).toBe(1);
    expect(JSON.stringify(audit)).not.toMatch(/password/i);
  });

  it("writes an audit trail for preview, apply, reset, revoke and lock", async () => {
    const { data } = await admin.from("audit_logs").select("action").eq("actor_profile_id", adminId);
    const actions = new Set(data!.map((r) => r.action));
    for (const action of ["roster.preview", "roster.apply", "roster.apply_compensated", "account.revoke_sessions", "account.password_reset_to_default", "account.set_status"]) {
      expect(actions.has(action), action).toBe(true);
    }
  });
});

describe("RLS with real JWTs through PostgREST (ACCESS-002/003, security-spec §5)", () => {
  async function tokenFor(studentId: string) {
    const client = anonClient();
    const result = await signInStudent({ admin, auth: client, env }, { studentId, password: "1", ip: "10.6.0.1", device: "rls" });
    expect(result.ok).toBe(true);
    return (await client.auth.getSession()).data.session!.access_token;
  }

  it("student A reads only own profile, never other students, identities or audit", async () => {
    const aToken = await tokenFor(studentIds.a);
    const asA = clientWithToken(aToken);
    const own = await asA.from("profiles").select("student_id, full_name");
    expect(own.data).toEqual([{ student_id: "00123", full_name: "Nguyễn Văn An" }]);
    expect((await asA.from("profiles").select("id").eq("student_id", studentIds.b)).data).toEqual([]);
    expect((await asA.from("student_auth_identities").select("*")).error).not.toBeNull();
    expect((await asA.from("audit_logs").select("*")).data).toEqual([]);
    expect((await asA.from("roster_imports").select("*")).data).toEqual([]);
  });

  it("student cannot write profiles, audit logs or call server-only functions", async () => {
    const asA = clientWithToken(await tokenFor(studentIds.a));
    const profile = await profileOf(studentIds.a);
    expect((await asA.from("profiles").update({ display_name: "Hacker" }).eq("id", profile.id)).error).not.toBeNull();
    expect((await asA.from("audit_logs").insert({ action: "x", target_type: "y" })).error).not.toBeNull();
    expect((await asA.rpc("revoke_user_sessions", { p_user_id: profile.id })).error).not.toBeNull();
    expect((await asA.rpc("consume_rate_limit", { p_key_hash: "a".repeat(64), p_limit: 1, p_window_seconds: 60 })).error).not.toBeNull();
    expect((await profileOf(studentIds.a)).display_name).toBe("An N.V.");
  });

  it("anonymous requests read nothing from identity tables", async () => {
    const anon = anonClient();
    expect((await anon.from("profiles").select("id")).error).not.toBeNull();
    expect((await anon.from("student_auth_identities").select("*")).error).not.toBeNull();
  });

  it("a student whose user_metadata claims admin is still a student", async () => {
    const profile = await profileOf(studentIds.c);
    await admin.auth.admin.updateUserById(profile.id, { user_metadata: { role: "admin" }, password: deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, studentIds.c, "1") });
    await admin.rpc("revoke_user_sessions", { p_user_id: profile.id });
    const client = anonClient();
    const { data } = await client.auth.signInWithPassword({ email: (await admin.from("student_auth_identities").select("internal_email").eq("profile_id", profile.id).single()).data!.internal_email, password: deriveProviderPassword(env.AUTH_PASSWORD_PEPPER, studentIds.c, "1") });
    const asForged = clientWithToken(data.session!.access_token);
    expect((await asForged.from("profiles").select("id")).data).toHaveLength(1);
  });

  it("an admin JWT can read the roster but not write it directly", async () => {
    const client = anonClient();
    const { data } = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    const asAdmin = clientWithToken(data.session!.access_token);
    expect(((await asAdmin.from("profiles").select("id")).data ?? []).length).toBeGreaterThanOrEqual(4);
    expect((await asAdmin.from("profiles").update({ display_name: "X" }).eq("student_id", studentIds.a)).error).not.toBeNull();
    expect((await asAdmin.from("student_auth_identities").select("*")).error).not.toBeNull();
  });

  it("signs in with the service role key only server-side: the anon key cannot call admin Auth APIs", async () => {
    const response = await fetch(`${stack.url}/auth/v1/admin/users`, { headers: { apikey: stack.anonKey, Authorization: `Bearer ${stack.anonKey}` } });
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
