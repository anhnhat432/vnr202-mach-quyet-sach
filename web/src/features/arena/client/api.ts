// Browser-side calls to the Live Arena API. Mutations carry the CSRF token issued at sign-in (cookie
// `vnr_csrf`, echoed in `x-csrf-token`) and, where the server requires it, an Idempotency-Key.
export class ArenaApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Array<{ field: string; code: string; message: string }> = [],
  ) {
    super(message);
  }
  detail(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message;
  }
  get offline() {
    return this.status === 0;
  }
}

function csrfToken(): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith("vnr_csrf="));
  return match ? decodeURIComponent(match.slice("vnr_csrf=".length)) : "";
}

let csrfRenewal: Promise<string> | undefined;
function renewCsrfToken(): Promise<string> {
  csrfRenewal ??= request<{ csrfToken: string }>("POST", "/auth/csrf").then((data) => {
    if (!data?.csrfToken || typeof data.csrfToken !== "string") throw new ArenaApiError(503, "csrf_unavailable", "Không khôi phục được phiên làm việc. Hãy thử lại.");
    return data.csrfToken;
  }).finally(() => { csrfRenewal = undefined; });
  return csrfRenewal;
}

export function newKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function request<T>(method: "GET" | "POST", path: string, options: { body?: unknown; key?: string; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const multipart = options.body instanceof FormData;
  if (method === "POST") {
    if (!multipart) headers["content-type"] = "application/json";
    if (path !== "/auth/csrf") headers["x-csrf-token"] = csrfToken() || await renewCsrfToken();
    if (options.key) headers["idempotency-key"] = options.key;
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`/api/v1${path}`, { method, headers, body: method === "POST" ? multipart ? options.body as FormData : JSON.stringify(options.body ?? {}) : undefined, cache: "no-store", signal: options.signal });
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new ArenaApiError(0, "offline", "Không kết nối được máy chủ.");
    }
    let payload: { data?: T; error?: { code: string; message: string; details?: ArenaApiError["details"] } } = {};
    try {
      payload = await response.json();
    } catch {
      /* empty body */
    }
    if (!response.ok || payload.error) {
      // This explicit guard rejection precedes business writes. Never retry a network/unknown outcome.
      if (attempt === 0 && method === "POST" && path !== "/auth/csrf" && response.status === 403 && payload.error?.code === "csrf_failed") {
        headers["x-csrf-token"] = await renewCsrfToken();
        continue;
      }
      throw new ArenaApiError(response.status, payload.error?.code ?? "http_error", payload.error?.message ?? "Đã xảy ra lỗi.", payload.error?.details ?? []);
    }
    return payload.data as T;
  }
  throw new ArenaApiError(403, "csrf_failed", "Yêu cầu không hợp lệ.");
}

export const arenaApi = {
  lobby: () => request<import("./types").Lobby>("GET", "/arena/lobby"),
  start: (publicId: string, game: string, key: string) => request<{ resumed: boolean; projection: import("./types").Projection }>("POST", `/arena/competitions/${publicId}/games/${game}/attempt`, { key }),
  projection: (attemptId: string) => request<import("./types").Projection>("GET", `/arena/attempts/${attemptId}`),
  transfer: (attemptId: string) => request<import("./types").Projection>("POST", `/arena/attempts/${attemptId}/transfer`, { key: newKey("transfer") }),
  content: (attemptId: string, allocationId: string, signal?: AbortSignal) =>
    request<import("./types").QuestionContent>("POST", `/arena/attempts/${attemptId}/interactions/${allocationId}/content`, { signal }),
  openCell: (attemptId: string, cell: number, key: string) =>
    request<{ result: import("./types").CellResult; replayed: boolean; projection: import("./types").Projection }>("POST", `/arena/attempts/${attemptId}/cells/${cell}/open`, { key }),
  answer: (attemptId: string, allocationId: string, optionId: string, key: string) =>
    request<{ result: import("./types").ResolveResult; replayed: boolean; projection: import("./types").Projection }>("POST", `/arena/attempts/${attemptId}/answers`, { key, body: { allocationId, optionId } }),
  heartbeat: (attemptId: string) => request<{ state: string; remainingMs: number }>("POST", `/arena/attempts/${attemptId}/heartbeat`),
  standing: (attemptId: string) => request<import("./types").PlayerStanding>("GET", `/arena/attempts/${attemptId}/standing`),
  review: (attemptId: string) => request<unknown>("GET", `/arena/attempts/${attemptId}/review`),
  leaderboard: (publicId: string, game: string, hinted?: number, settle = false) =>
    request<import("./types").Leaderboard>("GET", `/arena/leaderboards/${publicId}/${game}${hinted === undefined ? "" : `?v=${hinted}${settle ? "&settle=1" : ""}`}`),
};

export type CurrentCompetition = { publicId: string; name: string; kind: "official" | "rehearsal"; state: string; startDeadlineAt: string; standing: import("./types").Standing } | null;
export const currentCompetition = () => request<CurrentCompetition>("GET", "/arena/competitions/current");
