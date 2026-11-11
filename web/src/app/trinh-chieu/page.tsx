import type { Metadata } from "next";

import { ProjectorBoards } from "@/features/arena/ui/live-boards";

export const metadata: Metadata = { title: "Trình chiếu Live Arena" };

export default function ProjectorPage() {
  return <ProjectorBoards />;
}
