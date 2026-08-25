// Original SVG artwork — safe to ship (no third-party imagery, no rights notes needed).
// These are decorative illustrations, not factual maps. Swap in licensed photos later
// via the `.photo-slot` figure if desired.

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

/** Small line emblem per chapter (1, 2, 3). */
export function ChapterEmblem({ chapter, className }: { chapter: 1 | 2 | 3; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" fill="currentColor" stroke="currentColor">
      {emblems[chapter]}
    </svg>
  );
}
