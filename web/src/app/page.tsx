"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { HeroCrowd, MeterGlyph } from "@/features/brand/artwork";
import { METERS } from "@/features/crisis/crisis-scenario";
import { CrisisTeaser } from "@/features/crisis/crisis-teaser";

// Ảnh nền hero — ảnh tư liệu thuộc phạm vi công cộng. Đặt null để quay lại minh hoạ vector.
const HERO_PHOTO: { src: string; credit: string } | null = {
  src: "/hero-badinh-1945.jpg",
  credit: "Ba Đình, 2·9·1945 · Lưu trữ Quốc gia III · phạm vi công cộng",
};

const meterAccent: Record<string, string> = {
  longDan: "var(--command-red)",
  theNuoc: "var(--signal-amber)",
  thucLuc: "var(--evidence-teal)",
};

// Các phân hệ còn lại — cố tình để nhỏ, phụ, dưới cửa vào chính.
const more = [
  {
    href: "/gio-g",
    tag: "Giờ G",
    title: "Cả lớp cùng chơi",
    body: "Chiếu một khoảnh khắc lên màn hình, cả lớp bỏ phiếu trên điện thoại, rồi cùng lật bài.",
  },
  {
    href: "/khoanh-khac",
    tag: "Chơi nhanh",
    title: "15 khoảnh khắc",
    body: "Chạm chọn một quyết định lịch sử, lật bài xem bạn có nghĩ giống lịch sử không.",
  },
  {
    href: "/ho-so",
    tag: "Tư liệu",
    title: "Kho 15 hồ sơ",
    body: "Đào sâu từng quyết sách với bằng chứng có nguồn và sáu chặng phân tích.",
  },
  {
    href: "/mach-nguyen-nhan",
    tag: "Bản đồ",
    title: "Mạch nguyên nhân",
    body: "Quan hệ nhân – quả nối các sự kiện, thay cho một dòng thời gian phẳng.",
  },
] as const;

const chapters = [
  { number: "01", years: "1919–1945", label: "Tìm đường và giành chính quyền", href: "/ho-so#chapter-1" },
  { number: "02", years: "1945–1975", label: "Giữ nước và thống nhất", href: "/ho-so#chapter-2" },
  { number: "03", years: "1975–nay", label: "Đổi mới và phát triển", href: "/ho-so#chapter-3" },
] as const;

export default function Home() {
  const reduceMotion = useReducedMotion();

  const fade = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="cold">
      <section className="cold-hero" aria-labelledby="cold-title">
        {HERO_PHOTO && (
          <figure className="cold-hero__photo" aria-hidden="true">
            <span className="cold-hero__photo-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_PHOTO.src} alt="" />
            </span>
            <figcaption>{HERO_PHOTO.credit}</figcaption>
          </figure>
        )}
        <HeroCrowd className="cold-hero__crowd" />
        {/* Sợi tóc giữ ngàn cân — chỉ một sợi mảnh chạy suốt hero */}
        <svg className="cold-hero__thread" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 30 Q 300 8 600 30 T 1200 30" fill="none" stroke="var(--signal-amber)" strokeWidth="1.5" />
        </svg>
        <div className="cold-hero__grain" aria-hidden="true" />

        <div className="cold-hero__inner">
          <motion.p className="cold-eyebrow" {...fade(0)}>
            Mô phỏng · Mùa đông 1945 – 1946
          </motion.p>

          <motion.h1 id="cold-title" className="cold-title" {...fade(0.08)}>
            Ngàn cân treo sợi tóc
          </motion.h1>

          <motion.p className="cold-hook" {...fade(0.16)}>
            Bạn vừa tuyên bố độc lập. Ba tuần sau — <b>giặc đói, giặc dốt, giặc ngoại xâm</b> ập đến cùng lúc.
            Sáu quyết định. Ba thứ phải giữ. <b>Bạn có giữ được nước không?</b>
          </motion.p>

          <motion.div className="cold-meters" aria-label="Trạng thái đất nước lúc khởi đầu" {...fade(0.24)}>
            {METERS.map((meter, index) => (
              <div
                className="cold-meter"
                key={meter.id}
                style={{ ["--m-accent" as string]: meterAccent[meter.id] }}
                data-low={meter.start <= 30}
              >
                <span className="cold-meter__top">
                  <span className="cold-meter__name">
                    <MeterGlyph id={meter.id} className="meter-glyph" /> {meter.label}
                  </span>
                  <b className="cold-meter__val">{meter.start}</b>
                </span>
                <span className="cold-meter__track">
                  <motion.span
                    className="cold-meter__fill"
                    initial={reduceMotion ? { width: `${meter.start}%` } : { width: 0 }}
                    animate={{ width: `${meter.start}%` }}
                    transition={reduceMotion ? undefined : { duration: 1, delay: 0.5 + index * 0.14, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span className="cold-meter__blurb">{meter.blurb}</span>
              </div>
            ))}
          </motion.div>

          <motion.div className="cold-actions" {...fade(0.32)}>
            <Link className="cold-cta" href="/ngan-can">
              Vào cuộc <span aria-hidden="true">→</span>
            </Link>
            <span className="cold-actions__meta">6 khủng hoảng có thật · cuối cùng đối chiếu quyết sách của Đảng</span>
          </motion.div>
        </div>
      </section>

      <CrisisTeaser />

      <section className="cold-more" aria-label="Các phân hệ khác">
        <p className="cold-more__eyebrow">Chơi xong, muốn đi sâu hơn?</p>
        <div className="cold-more__grid">
          {more.map((item) => (
            <Link className="cold-card" key={item.href} href={item.href}>
              <span className="cold-card__tag">{item.tag}</span>
              <strong>{item.title}</strong>
              <span className="cold-card__body">{item.body}</span>
              <span className="cold-card__go" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="cold-chapters" aria-label="Ba chương lịch sử">
        {chapters.map((chapter) => (
          <Link className="cold-chapter" key={chapter.number} href={chapter.href}>
            <span className="cold-chapter__num">CH.{chapter.number}</span>
            <strong>{chapter.label}</strong>
            <span className="cold-chapter__years">{chapter.years}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
