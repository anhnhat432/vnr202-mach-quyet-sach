"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/quan-tri/cuoc-thi", label: "Tổng quan & Điều hành", badge: "LIVE" },
  { href: "/quan-tri/lop", label: "Danh sách lớp" },
  { href: "/quan-tri/ngan-hang-cau-hoi", label: "Ngân hàng câu hỏi" },
] as const;

export function AdminNavigation() {
  const pathname = usePathname() ?? "";
  if (!pathname || pathname === "/quan-tri/dang-nhap") return null;

  return (
    <header className="acc-topbar">
      <div className="acc-topbar-inner">
        <div className="acc-brand">
          <span className="acc-brand-badge">
            <span className="acc-brand-dot" aria-hidden="true" />
            Admin Control Center
          </span>
          <span className="acc-brand-title">Mạch Quyết Sách · VNR202</span>
        </div>

        <nav aria-label="Quản trị" className="acc-nav-links">
          {ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="acc-nav-link"
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="acc-quick-shortcuts" aria-label="Lối tắt trình chiếu và sảnh thi đấu">
          <Link href="/trinh-chieu" target="_blank" className="acc-shortcut-pill">
            Màn hình trình chiếu ↗
          </Link>
          <Link href="/live-arena/bang-xep-hang" target="_blank" className="acc-shortcut-pill">
            Bảng xếp hạng ↗
          </Link>
          <Link href="/live-arena" target="_blank" className="acc-shortcut-pill">
            Sảnh Live Arena ↗
          </Link>
        </div>
      </div>
    </header>
  );
}
