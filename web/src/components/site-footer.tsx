import Link from "next/link";
import { SHOW_PUBLIC_STUDY_SECTIONS } from "@/lib/config/public-experience";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          <strong>Bộ môn VNR202</strong>
          <span>FPT University</span>
        </p>
        <nav aria-label="Thông tin học thuật">
          {SHOW_PUBLIC_STUDY_SECTIONS && <Link href="/phong-phuong-phap">Phòng Phương Pháp</Link>}
          <Link href="/nguon-va-ai">Nguồn &amp; AI</Link>
          <Link href="/quan-tri/dang-nhap">Đăng nhập quản trị</Link>
        </nav>
        <p className="site-footer__note">Một trải nghiệm học lịch sử qua dữ kiện, quyết định và hệ quả.</p>
      </div>
    </footer>
  );
}
