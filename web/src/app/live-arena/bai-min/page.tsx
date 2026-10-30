import type { Metadata } from "next";

import { MinefieldGame } from "@/features/arena/ui/minefield-game";

export const metadata: Metadata = { title: "Bãi Mìn Tri Thức" };

export default function MinefieldPage() {
  return <MinefieldGame />;
}
