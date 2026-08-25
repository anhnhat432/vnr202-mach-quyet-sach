"use client";

import Link from "next/link";
import { useState } from "react";

const navigation = [
  { href: "/khoanh-khac", label: "Chơi ngay", desc: "Chạm chọn một quyết định lịch sử — vui, nhẹ, không cần đăng nhập" },
  { href: "/gio-g", label: "Giờ G", desc: "Chế độ dẫn cả lớp cùng chơi trên máy chiếu" },
  { href: "/ho-so", label: "Hồ sơ", desc: "15 tình huống lịch sử để bạn ra quyết định" },
  { href: "/mach-nguyen-nhan", label: "Mạch nguyên nhân", desc: "Bản đồ quan hệ nhân – quả giữa các sự kiện" },
  { href: "/ma-tran-bang-chung", label: "Bằng chứng", desc: "Luận điểm nào được nguồn nào xác minh" },
  { href: "/phong-phuong-phap", label: "Phương pháp", desc: "Cách đọc và cách dùng trang này" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand-lockup" href="/" aria-label="VNR202 Mạch Quyết Sách - Trang chủ">
          <span className="brand-lockup__code">VNR202</span>
          <span className="brand-lockup__name">Mạch Quyết Sách</span>
        </Link>
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? "Đóng" : "Menu"}</span>
          <span className="sr-only">Điều hướng chính</span>
        </button>
        <nav id="primary-navigation" className="primary-nav" data-open={open} aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} title={item.desc} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link className="arena-link" href="/live-arena" onClick={() => setOpen(false)}>
            Live Arena <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
