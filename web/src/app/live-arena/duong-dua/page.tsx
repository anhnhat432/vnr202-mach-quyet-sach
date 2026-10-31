import type { Metadata } from "next";

import { RaceGame } from "@/features/arena/ui/race-game";
import { redirectPendingStudent } from "@/features/auth/server/name-setup";

export const metadata: Metadata = { title: "Đường Đua Lịch Sử" };

export default async function RacePage() {
  await redirectPendingStudent();
  return <RaceGame />;
}
