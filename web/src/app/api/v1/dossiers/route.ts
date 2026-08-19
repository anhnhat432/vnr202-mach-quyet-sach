import { listPublishedDossiers } from "@/features/content/server/dossier-repository";
import { ok } from "@/lib/api/response";
import { requestIdFrom } from "@/lib/api/request-id";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  return ok(await listPublishedDossiers(), requestId, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
