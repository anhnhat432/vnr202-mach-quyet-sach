import type { Metadata } from "next";

import { RaceGame } from "@/features/arena/ui/race-game";

export const metadata: Metadata = { title: "Đường Đua Lịch Sử" };

export default function RacePage() {
  return <RaceGame />;
}
