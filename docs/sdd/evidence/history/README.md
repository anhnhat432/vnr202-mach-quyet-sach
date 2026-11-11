# Dấu Ấn Sử Việt — implementation and QA

Date: 2026-11-11 (Asia/Saigon). Scope: user-requested local implementation; no commit, push, merge or deployment.

## A. Delivered experience

Native Next.js route `/kien-thuc`, title “Dấu Ấn Sử Việt – Hành trình qua những mốc son lịch sử”. Six periods and 20 events, distributed 3 / 4 / 3 / 4 / 2 / 4 from 1911 to 2021. Each has a 40–80 word summary, place/people where applicable, three groups of two concise bullets, three or four keywords, recall sentence/date and one unscored question with answer/explanation.

Period filtering and Vietnamese accent-insensitive search combine; year, date label, location, people and keywords are searchable. State is represented by `period`, `q` and `event` query parameters, validated with Zod. Reload and browser Back are supported. Previous/next stays within the filtered results. Native modal dialog provides focus containment, Escape and return focus. Empty/invalid-event and missing/broken-media states are explicit.

Shared navigation includes “Kiến thức”; footer, Arena, quick play and timeline practice link to the page. Detail actions open the actual timeline practice game. No unsupported topic-filter query or pretend filtered game is used. No new progress store, backend, schema, account/session flow, score or leaderboard is introduced.

## B. Files

New:

- `web/src/app/kien-thuc/page.tsx`: server route, metadata, textbook/source disclosure and hero.
- `web/src/app/kien-thuc/history.css`: scoped museum-inspired palette, responsive timeline/dialog, focus and reduced-motion styles.
- `web/src/features/history/data.ts`: 20 event records and per-event source/rights metadata; adding an event does not require UI changes.
- `web/src/features/history/types.ts`: event, institutional source, image and video types.
- `web/src/features/history/textbook.ts`: supplied 2021 edition metadata and 20 visually checked page/scope references, including the WTO date distinction.
- `web/src/features/history/domain.ts`: periods, Zod URL boundary, normalization, filter/sort and URL serialization.
- `web/src/features/history/history-explorer.tsx`: timeline, filters, URL state and event dialog.
- `web/src/features/history/history-quiz.tsx`: unscored recall questions, explanation and retry.
- `web/src/features/history/history-media.tsx`: lazy image, no-image/error fallback, opt-in privacy-enhanced YouTube embed, persistent source link and manual video-failure fallback.
- `web/public/history/*.jpg`: two historical images downloaded from inspected Commons originals.
- `web/tests/unit/history-{domain,content,media}.test.*`: search boundaries, content/source contracts, quiz/media recovery.
- `web/tests/e2e/history.spec.ts`: new-route interactions and existing-game regression smoke on desktop/mobile plus tablet.
- `scripts/capture-history.mjs`: reproducible Chromium visual evidence at 1440/768/390px.
- `docs/sdd/plans/2026-11-11-history-knowledge.md`: bounded scope and K01–K06 traceability.

Modified:

- `web/src/components/site-header.tsx`, `site-footer.tsx`: knowledge entry points.
- `web/src/app/live-arena/page.tsx`, `live-arena/dong-chay-lich-su/page.tsx`, `khoanh-khac/page.tsx`: working study/game links only.
- `web/next.config.ts`: `/kien-thuc` alone permits frames from `https://www.youtube-nocookie.com`; existing global security headers remain intact.

No dependency or lockfile changes. The pre-existing untracked `references/index.html` is preserved verbatim.

## C. Architecture and content provenance

Audit found Next.js 16.3.1 / React 19.2.8 / TypeScript 6.0.3 / Zod 4.4.3, Tailwind 4 with custom CSS and existing Vietnamese Google fonts. Supabase clients/migration exist, but protected identity and official competition functions remain pending; current public content reads use the accepted static-preview ADR. New knowledge is a separate static feature, not an unreviewed update to the 15 governed dossier publication records.

Sources are linked per event, with publisher, checked date and support scope. Institutions include Bảo tàng Hồ Chí Minh, Bảo tàng Lịch sử Quốc gia, Quốc hội, Tư liệu – Văn kiện Đảng, Cổng Thông tin điện tử Chính phủ, ASEAN and WTO. Summaries are paraphrases, not long excerpts. AI assistance is disclosed; source cross-checking does not claim lecturer approval. After the user supplied the 2021 textbook scan, 20 event locators were checked directly on page images and added with explicit support scopes. See [textbook-crosscheck.md](textbook-crosscheck.md) for edition identity, SHA-256, all page references and the WTO source discrepancy.

Media:

- Ba Đình 1945: [Commons record](https://commons.wikimedia.org/wiki/File:Ba_Dinh_Square_September_2nd,_1945.jpg), unknown photographer, Commons public-domain-in-Vietnam statement checked; local original 554,951 bytes.
- Điện Biên Phủ 1954: [Commons record](https://commons.wikimedia.org/wiki/File:Victory_in_Battle_of_Dien_Bien_Phu.jpg), credited to Vietnam People's Army / museum system, Commons public-domain-in-Vietnam statement checked; local original 139,412 bytes. Caption does not assert unverified circumstances of the photograph.
- [VTV24 anniversary broadcast](https://www.youtube.com/watch?v=gA_s6ibM0mw): YouTube oEmbed returned author `VTV24`, author URL `https://www.youtube.com/@vtv24` and iframe HTML on 2026-11-11. Label explicitly identifies a 2024 commemoration, not original 1954 footage. Video loads only after a click; no autoplay. A source link and “Video không phát?” fallback remain available because third-party embed errors are not always observable across origins.

## D. Validation and evidence

K01–K06 map to `history-domain.test.ts`, `history-content.test.ts`, `history-media.test.tsx` and `history.spec.ts`. Contract tests enforce count, chronology, period coverage, summary/bullet/keyword bounds, valid answers and attributable sources. Browser tests cover combined filtering, accent search, reload/Back, native dialog focus/Escape, previous/next, correct/incorrect quiz answers, retry, image failure, missing event, lazy iframe and fallback, game navigation, timeline scoring smoke, quick play, crisis and projector modes. Axe checks serious/critical violations on the new page and open dialog; reduced motion is checked through computed CSS.

Initial issues fixed during implementation: mobile horizontal overflow caused by grid intrinsic sizing; ambiguous screen-reader button names; modal centering after Tailwind preflight reset; caption overlap from decorative seal; lazy-image layout shifts addressed by using each archival image's actual width/height. Iframe errors use an explicit user fallback because browser `error` events alone are insufficient.

Stable-source verification:

| Command | Observed result |
| --- | --- |
| `npm --prefix web run lint` | PASS |
| `npm --prefix web run typecheck` | PASS |
| `npm --prefix web run test` | PASS: 60 tests / 14 files after textbook integration |
| `npm --prefix web run test:e2e -- tests/e2e/history.spec.ts --workers=2` | PASS: 16/16 desktop/mobile cases, including tablet viewport and textbook page references |
| `npm --prefix web run test:e2e -- tests/e2e/history.spec.ts --grep K04 --repeat-each=3 --workers=1` | PASS: 6 media runs (desktop/mobile, 3 each) |
| `npm --prefix web run test:e2e -- --workers=2` | Initial implementation: 22 PASS / 4 baseline FAIL; all 14 then-new cases pass. The subsequent textbook change reran all 16 history cases, not the unrelated failing suite. |
| `npm --prefix web run build` | FAIL: pre-existing Turbopack child-process/CSS worker error at `/page`, reproduced on this workstation |
| `npm --prefix web run build -- --webpack` | PASS: compiled, typechecked and generated all routes, including dynamic `/kien-thuc` |
| `git diff --check` | PASS |

The four baseline E2E failures are `home.spec.ts:6` on both viewports (expects H1 “Mạch Quyết Sách”, current homepage has “Ngàn cân treo sợi tóc”) and `public-evidence.spec.ts:6/8` (expects the replaced cause-map select/button UI). They were reproduced in the earlier repository audit before this addition. These unrelated modules/tests are preserved. The homepage axe step is after its failed assertion, so this report does not claim that old page passed axe. The new page/dialog axe checks did run and passed.

Visual evidence: `desktop.png`, `desktop-timeline.png`, `desktop-detail.png`, corresponding tablet/mobile images, and `visual-check.json`. Layout checks also cover widths 320, 860, 1024 and 1280px.

Final screenshots were regenerated against `next start --port 3002`, not the development overlay. All three viewports returned HTTP 200, with no overflow or browser console/page errors. Production mobile smoke also opened the Điện Biên Phủ dialog, loaded the `youtube-nocookie` iframe on request, verified the route-specific CSP, exercised the manual video fallback and searched `Vo Nguyen Giap` (three matching records). This verifies the player integration and fallback, not guaranteed third-party playback in every region.

## E. Run and manually explore

From the repository root:

```powershell
npm --prefix web ci --ignore-scripts
npm --prefix web run dev
```

Open `http://localhost:3000/kien-thuc`. Select a period, search `dien bien phu` or `Võ Nguyên Giáp`, open an event, answer the recall question, try previous/next and Escape. Reload a filtered URL, use browser Back, and follow “Luyện tập kiến thức”. Test 390px and keyboard-only navigation. For media, open `?event=1954-dien-bien`, click “Tải video tư liệu”, then try its explicit source fallback.

Capture screenshots with a server already running: `node scripts/capture-history.mjs http://127.0.0.1:3000`.

Build workaround on this workstation: `npm --prefix web run build -- --webpack`. To run the resulting production build, use `npm --prefix web run start`.

## F. Limits

- The user-supplied 440-page scan now has 20 event locators checked against page images. Only the stated scope is attributed to each page; this is not a claim of lecturer approval or a complete audit of every page. The original PDF is kept outside the public app. Page 332's WTO date wording is explicitly distinguished from the WTO effective date.
- Only two images have checked reuse records in this addition. Other events deliberately use textual archival treatments; no AI-generated historical photographs.
- One verified anniversary video; original historical footage is not claimed. Playback availability still depends on YouTube/network/region; metadata and fallback behavior were verified, not every minute of the broadcast.
- No official authentication/competition/realtime backend acceptance is claimed. Existing public practice games were exercised without changing their business logic.
- This addition does not repair unrelated baseline dependency advisories, old homepage/cause-map E2E assumptions, or the workstation's default Turbopack failure.
