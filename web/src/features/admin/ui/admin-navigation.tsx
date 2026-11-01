"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  { href: "/quan-tri/cuoc-thi", label: "Cuộc thi" },
  { href: "/quan-tri/lop", label: "Danh sách lớp" },
  { href: "/quan-tri/ngan-hang-cau-hoi", label: "Ngân hàng câu hỏi" },
];
export function AdminNavigation() {
  const pathname = usePathname();
  if (pathname === "/quan-tri/dang-nhap") return null;
  return <nav className="admin-navigation" aria-label="Quản trị">{pages.map(page => <Link key={page.href} href={page.href} aria-current={pathname === page.href ? "page" : undefined}>{page.label}</Link>)}</nav>;
}
