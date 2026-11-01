import type { Metadata } from "next";

import { MinefieldGame } from "@/features/arena/ui/minefield-game";
import { redirectPendingStudent } from "@/features/auth/server/name-setup";

export const metadata: Metadata = { title: "Bãi Mìn Tri Thức" };

export default async function MinefieldPage() {
  await redirectPendingStudent();
  return <MinefieldGame />;
}
