import type { ReactNode } from "react";
import { AdminNavigation } from "@/features/admin/ui/admin-navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <><AdminNavigation />{children}</>;
}
