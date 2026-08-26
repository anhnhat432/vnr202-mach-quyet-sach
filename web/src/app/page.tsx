"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { ChapterEmblem, HeroArtwork } from "@/features/brand/artwork";

const MotionLink = motion.create(Link);

const chapterSignals = [
  { number: "01", years: "1919-1945", label: "Tìm đường và giành chính quyền", href: "/ho-so#chapter-1" },
  { number: "02", years: "1945-1975", label: "Giữ nước và thống nhất", href: "/ho-so#chapter-2" },
  { number: "03", years: "1975-nay", label: "Đổi mới và phát triển", href: "/ho-so#chapter-3" },
] as const;

const portals = [
  {
    index: "★ TÂM ĐIỂM",
    href: "/ngan-can",
    title: "Ngàn Cân Treo Sợi Tóc",
    body: "Lèo lái chính quyền cách mạng non trẻ mùa đông 1945–46 qua sáu khủng hoảng có thật. Ba thanh trạng thái, hậu quả dây chuyền — cuối cùng đối chiếu với quyết định thật của Đảng. Bạn có giữ được nước không?",
    action: "Vào cuộc →",
    className: "home-portal__flagship",
  },
  {
    index: "GIỜ G",
    href: "/gio-g",
    title: "Giờ G · cả lớp cùng chơi",
    body: "Chiếu một khoảnh khắc lên màn hình, cả lớp bỏ phiếu trên điện thoại, rồi cùng lật bài so với lịch sử.",
    action: "Vào Giờ G →",
    className: "home-portal__arena",
  },
  {
    index: "01",
    href: "/khoanh-khac",
    title: "Chơi nhanh · 15 khoảnh khắc",
    body: "Chạm chọn một quyết định lịch sử, rồi lật bài xem bạn có nghĩ giống lịch sử không. Nhẹ, nhanh, không cần đăng nhập.",
    action: "Chơi nhanh →",
    className: undefined as string | undefined,
  },
  {
    index: "02",
    href: "/ho-so",
    title: "Kho 15 Hồ sơ",
    body: "Đào sâu từng quyết sách với bằng chứng có nguồn và sáu chặng phân tích.",
    action: "Mở kho hồ sơ →",
    className: undefined,
  },
  {
    index: "03",
    href: "/mach-nguyen-nhan",
    title: "Mạch Nguyên Nhân",
    body: "Bản đồ quan hệ nhân – quả nối các sự kiện, thay cho một dòng thời gian phẳng.",
    action: "Xem quan hệ →",
    className: undefined,
  },
] as const;

export default function Home() {
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <div className="home-shell">
      <section className="home-hero" aria-labelledby="home-title">
        <motion.div className="home-hero__copy" {...fadeUp}>
          <span className="hero-poster-star" aria-hidden="true">★</span>
          <p className="eyebrow">Bộ môn VNR202 · FPT University · trước 1930-nay</p>
          <h1 id="home-title">
            Mạch <span className="home-title-accent">Quyết</span> Sách
          </h1>
          <p className="home-hero__lead">
            Lịch sử là chuỗi quyết định dưới sức ép. Ngồi vào ghế người lãnh đạo mùa đông 1945 — giữ nước qua sáu
            khủng hoảng, hay để ngàn cân đứt?
          </p>
          <div className="home-hero__actions">
            <Link className="command-button" href="/ngan-can">
              Vào cuộc <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href="/ho-so">
              Hoặc mở kho 15 hồ sơ
            </Link>
          </div>
        </motion.div>
        <div className="signal-field" aria-label="Ba chương lịch sử">
          <HeroArtwork className="signal-field__art" />
          {chapterSignals.map((chapter, index) => (
            <MotionLink
              className="signal-node"
              href={chapter.href}
              key={chapter.number}
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduceMotion ? undefined : { duration: 0.45, delay: 0.15 + index * 0.12 }}
            >
              <span className="signal-node__emblem" aria-hidden="true">
                <ChapterEmblem chapter={(index + 1) as 1 | 2 | 3} />
              </span>
              <span className="signal-node__number">CH.{chapter.number}</span>
              <strong>{chapter.label}</strong>
              <span>{chapter.years}</span>
            </MotionLink>
          ))}
        </div>
      </section>

      <section className="mission-strip" aria-labelledby="mission-title">
        <div>
          <p className="eyebrow">Luồng khám phá chính</p>
          <h2 id="mission-title">Từ dữ kiện đến quyết định</h2>
        </div>
        <ol>
          <li><span>01</span>Đọc bối cảnh</li>
          <li><span>02</span>Lọc bằng chứng</li>
          <li><span>03</span>Chọn quyết sách</li>
          <li><span>04</span>Đối chiếu lịch sử</li>
        </ol>
      </section>

      <section className="home-portal" aria-label="Các phân hệ chính">
        {portals.map((portal, index) => (
          <MotionLink
            key={portal.index}
            href={portal.href}
            className={portal.className}
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? undefined : { duration: 0.45, delay: index * 0.1 }}
          >
            <span className="home-portal__index">{portal.index}</span>
            <h2>{portal.title}</h2>
            <p>{portal.body}</p>
            <span className="home-portal__action">{portal.action}</span>
          </MotionLink>
        ))}
      </section>
    </div>
  );
}
