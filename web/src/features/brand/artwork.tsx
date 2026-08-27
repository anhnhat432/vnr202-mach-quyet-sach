// Original SVG artwork — safe to ship (no third-party imagery, no rights notes needed).
// These are decorative illustrations, not factual maps. Swap in licensed photos later
// via the `.photo-slot` figure if desired.

import type { ReactNode } from "react";

/**
 * Warm layered hero illustration: strata of history rising toward a guiding star.
 * Evokes "history as layers of decisions" without making any factual claim.
 */
export function HeroArtwork({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 460"
      role="img"
      aria-label="Minh hoạ: các lớp lịch sử vươn lên dưới một ngôi sao dẫn đường"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20303a" />
          <stop offset="1" stopColor="#182126" />
        </linearGradient>
        <radialGradient id="glow" cx="0.72" cy="0.28" r="0.5">
          <stop offset="0" stopColor="rgba(214,146,46,0.45)" />
          <stop offset="1" stopColor="rgba(214,146,46,0)" />
        </radialGradient>
      </defs>
      <rect width="600" height="460" fill="url(#sky)" />
      <rect width="600" height="460" fill="url(#glow)" />

      {/* Guiding star */}
      <g transform="translate(432 116)">
        <circle r="46" fill="rgba(214,146,46,0.16)" />
        <path
          d="M0 -30 L8.8 -9.7 L30.5 -9.3 L13.2 4.2 L19.6 25 L0 12.5 L-19.6 25 L-13.2 4.2 L-30.5 -9.3 L-8.8 -9.7 Z"
          fill="#d6922e"
        />
      </g>

      {/* Fine dotted trajectory arc */}
      <path
        d="M40 300 Q 240 120 470 150"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="2"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />

      {/* Layered strata (three eras) */}
      <path d="M0 330 Q 150 300 320 322 T 600 320 V460 H0 Z" fill="rgba(13,107,102,0.55)" />
      <path d="M0 372 Q 180 348 360 366 T 600 360 V460 H0 Z" fill="rgba(13,107,102,0.75)" />
      <path d="M0 414 Q 160 398 340 410 T 600 406 V460 H0 Z" fill="#0d6b66" />

      {/* Milestone markers along the strata */}
      {[
        [96, 322],
        [300, 360],
        [500, 406],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <line x1={x} y1={y - 26} x2={x} y2={y} stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          <circle cx={x} cy={y - 30} r="6" fill="#f3ebdd" />
        </g>
      ))}
    </svg>
  );
}

const emblems = {
  1: (
    // Star — độc lập
    <path d="M16 3 L19.5 11.4 L28.4 12 L21.6 17.9 L23.9 26.6 L16 21.5 L8.1 26.6 L10.4 17.9 L3.6 12 L12.5 11.4 Z" />
  ),
  2: (
    // Two strokes converging — thống nhất
    <path d="M6 5 L16 20 L26 5 M16 20 L16 28" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  3: (
    // Rising line — đổi mới / phát triển
    <path d="M5 25 L13 17 L18 21 L27 8 M27 8 L20 8 M27 8 L27 15" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  ),
} as const;

// Deterministic integer pseudo-jitter — no floats, so server and client render
// byte-identical SVG coordinates (no hydration mismatch).
function wobble(seed: number, spread: number) {
  const h = (Math.imul(seed + 1, 2654435761) >>> 0) % 1000;
  return Math.round((h / 1000) * spread);
}

function CrowdRow({ count, gap, headR, bodyW, baseY, topY, fill, poles }: {
  count: number;
  gap: number;
  headR: number;
  bodyW: number;
  baseY: number;
  topY: number;
  fill: string;
  poles?: boolean;
}) {
  return (
    <g fill={fill}>
      {Array.from({ length: count }).map((_, i) => {
        const cx = 30 + i * gap + wobble(i + count, gap * 0.4);
        const t = topY + Math.abs(wobble(i * 2 + 1, headR * 1.2));
        return (
          <g key={i}>
            {poles && i % 3 === 1 && (
              <>
                <rect x={cx - 1} y={t - 44} width="2" height={baseY - (t - 44)} fill="rgba(244,236,221,0.45)" />
                <path
                  d={`M${cx} ${t - 54} l3.4 6.9 7.6 .7 -5.7 5 1.7 7.4 -7 -3.9 -7 3.9 1.7 -7.4 -5.7 -5 7.6 -.7 Z`}
                  fill="#d6922e"
                />
              </>
            )}
            <circle cx={cx} cy={t} r={headR} />
            <rect x={cx - bodyW / 2} y={t + headR * 0.85} width={bodyW} height={baseY - (t + headR * 0.85)} rx={bodyW / 2} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Original crowd silhouette for the cold-open hero — "lòng dân" massed under the
 * fragile thread. Purely decorative vector art (no third-party imagery).
 */
export function HeroCrowd({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <CrowdRow count={24} gap={49} headR={7} bodyW={17} baseY={240} topY={96} fill="rgba(13,107,102,0.55)" />
      <CrowdRow count={17} gap={70} headR={10} bodyW={25} baseY={240} topY={132} fill="#0c1418" poles />
    </svg>
  );
}

// Line-glyph cho ba thanh trạng thái — đồng bộ ngôn ngữ với ChapterEmblem,
// thay cho emoji ❤️🏛️⚙️ để giữ tông "đẳng cấp" xuyên suốt.
const gearTeeth: Array<[number, number, number, number]> = [
  [22.8, 16, 25.2, 16],
  [20.8, 20.8, 22.5, 22.5],
  [16, 22.8, 16, 25.2],
  [11.2, 20.8, 9.5, 22.5],
  [9.2, 16, 6.8, 16],
  [11.2, 11.2, 9.5, 9.5],
  [16, 9.2, 16, 6.8],
  [20.8, 11.2, 22.5, 9.5],
];

const meterGlyphs: Record<"longDan" | "theNuoc" | "thucLuc", ReactNode> = {
  // Trái tim — lòng dân
  longDan: (
    <path d="M16 26.2 C 8.6 20.8, 4.6 15.4, 4.6 11.2 C 4.6 8.1, 7 5.9, 9.9 5.9 C 12.5 5.9, 14.7 7.6, 16 9.9 C 17.3 7.6, 19.5 5.9, 22.1 5.9 C 25 5.9, 27.4 8.1, 27.4 11.2 C 27.4 15.4, 23.4 20.8, 16 26.2 Z" />
  ),
  // Đền đài — thế nước, chủ quyền
  theNuoc: (
    <g>
      <path d="M4.5 12 L16 5 L27.5 12" />
      <path d="M6 12.4 H26" />
      <path d="M9.5 14 V23.5 M16 14 V23.5 M22.5 14 V23.5" />
      <path d="M6 24.5 H26" />
    </g>
  ),
  // Bánh răng — thực lực
  thucLuc: (
    <g>
      <circle cx="16" cy="16" r="5.4" />
      <circle cx="16" cy="16" r="1.9" />
      {gearTeeth.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </g>
  ),
};

/** SVG glyph cho một thanh trạng thái (longDan | theNuoc | thucLuc). */
export function MeterGlyph({
  id,
  className,
}: {
  id: "longDan" | "theNuoc" | "thucLuc";
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {meterGlyphs[id]}
    </svg>
  );
}

/** Small line emblem per chapter (1, 2, 3). */
export function ChapterEmblem({ chapter, className }: { chapter: 1 | 2 | 3; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" fill="currentColor" stroke="currentColor">
      {emblems[chapter]}
    </svg>
  );
}
