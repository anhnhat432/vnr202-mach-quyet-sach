import type { ReactNode } from "react";

import "@/features/admin/ui/admin-control-center.css";
import { AdminNavigation } from "@/features/admin/ui/admin-navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="acc-shell">
      <AdminNavigation />
      {children}
    </div>
  );
}
