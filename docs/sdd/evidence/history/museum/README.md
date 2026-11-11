# Dấu Ấn Sử Việt — interactive museum delivery

## A. Repository audit and boundaries

The existing project uses Next.js 16.3.1 App Router, React 19.2.8, TypeScript 6.0.3, npm/lockfile, Tailwind 4 plus feature CSS, motion/lucide, and the shared Be Vietnam Pro / Saira Condensed fonts. Supabase PostgreSQL migrations and SSR/Auth clients are present. Public dossiers use `/api/v1/dossiers`; practice games run in the browser. Production authenticated competition, reconnect/device transfer, admin and realtime acceptance are not established by this task.

The museum extends the existing native `/kien-thuc` component tree. No new backend, migration, identity flow, score/rank write, competition rule or publication state. The 20-event learning supplement remains separate from the governed 15 decision dossiers. Source cross-checking does not constitute lecturer approval. The unrelated, pre-existing `references/index.html` remains untouched. No commit, push, merge or deploy for this extension.

Three.js 0.187.0 is the only new runtime library, with its TypeScript types. A route-local dynamic import loads it only near the globe viewport. SVG overlays are sufficient for the campaign because the supported data is a schematic and three documented phases, not a georeferenced tactical simulation. No map tile service or API key is needed.

## B. Implementation and files

| File | Role |
|---|---|
| `web/src/features/history/history-globe.tsx` | Real WebGL Earth, land texture generated from local Natural Earth polygons; orbit drag, keyboard rotation, zoom/reset/optional slow rotation; cancelable spherical camera flight, projected focusable markers. |
| `web/src/features/history/museum-world.tsx` | Hero and location/event explorer, lazy boundary, render-error/WebGL fallback, accessible parallel location list. |
| `web/src/features/history/museum-data.ts` | 12 sourced representative places, mappings for 20 events, themes, date intervals, three campaign phases and comparison image metadata. |
| `web/src/features/history/museum-domain.ts` | Coordinate validation, geographic projection, interval-overlap/location/topic filtering. |
| `web/src/features/history/battle-map.tsx` | Three-phase Điện Biên Phủ selector, highlighted reference map, previous/next/overview, legend, sources and limitations. |
| `web/src/features/history/media-theater.tsx` | Original/archive, documentary and dramatization categories; reuses existing photo/opt-in film components. |
| `web/src/features/history/photo-comparison.tsx` | Mouse/touch/keyboard range slider, 50% reset, dated captions, source credits and image-error fallback. |
| `web/src/app/kien-thuc/thu-thach/page.tsx` | Existing HistoryQuiz reused as an unscored challenge, source links, validated return to exact museum event/filter state and onward practice link. |
| `web/src/features/history/domain.ts` | Extends validated shareable URL with optional `from`, `to`, `place`, `topic`; retains old period/search/event semantics. |
| `web/src/features/history/history-explorer.tsx` | Synchronizes globe/list/theater with filters and event navigation; opens map and challenge from details. |
| `web/src/app/kien-thuc/page.tsx`, `history.css` | Native route, cinematic hero/layout, mobile sheet, focus and reduced motion. |
| `web/public/history/{land-110m.json,ba-dinh-2008.jpg,dien-bien-map.png}` | Local checked assets; provenance below. |
| `web/package.json`, `web/package-lock.json` | Three.js runtime/types dependency lock. |
| `web/tests/unit/history-museum.test.ts` | Four new geometry, temporal, URL and geographic content contracts; RED run before implementation, then GREEN. |
| `web/tests/e2e/history-museum.spec.ts` | Nine browser scenarios in two viewports (18 cases), covering M01–M07. |
| `scripts/capture-history-museum.mjs` | Reproducible production screenshots and route/resource/performance measurements. |
| `docs/sdd/plans/2026-11-11-history-museum.md` | Bounded Shell plan and acceptance traceability. |

Static data is separate from rendering. Add an event to `data.ts`, its checked textbook scope to `textbook.ts`, and geography/theme/range to `museum-data.ts`; source/coverage tests catch missing mappings. Adding a new place only requires a valid sourced location entry and event association. Add campaigns or media only after checking the factual scope and reuse rights.

## C. Historical data and source provenance

Coverage: **20 events, six periods, 12 domestic/international representative locations, one three-phase campaign, three historical/site photographs, one documentary video, one 1945/2008 comparison pair**. The campaign reference diagram is counted separately from photographs. Existing per-event references and scan locators remain in `data.ts`, `textbook.ts` and [textbook-crosscheck.md](../textbook-crosscheck.md).

| Resource | Source, scope and reuse |
|---|---|
| Earth land polygons | [Natural Earth 110m land](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson), downloaded 11 November 2026. [Public domain terms](https://www.naturalearthdata.com/about/terms-of-use/). Land surface only; no political boundaries. SHA256 `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`. |
| Ten representative city coordinates | [Natural Earth populated places simple 10m](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places_simple.geojson), downloaded/read and matched by city name. Only the selected coordinate values are shipped. Pác Bó uses a clearly labeled Cao Bằng city proxy; national events use explicitly described representative cities. |
| Điện Biên Phủ and Bến Tre region coordinates | [Wikidata Q604897](https://www.wikidata.org/wiki/Q604897) (21°23′13″ N, 103°00′56″ E) and [Q33366](https://www.wikidata.org/wiki/Q33366) (10°10′ N, 106°30′ E), read 11 November 2026. Representative battle/region positions, not military survey data. |
| Three campaign phases | [Bảo tàng Điện Biên Phủ / Cục Di sản văn hóa](https://baotang.dsvh.gov.vn/vi-VN/Detail/Index/117): 13–17 March, 30 March–30 April, 1–7 May 1954. Cross-check [Tạp chí Quốc phòng toàn dân](https://tapchiqptd.vn/vi/nhung-ngay-ky-niem-lon/mot-so-hoat-dong-cua-bo-chi-huy-chien-dich-dien-bien-phu/5453.html). The museum catalogue contains an unrelated apparent December 1954 typo in its background paragraph; this implementation does not use that statement. |
| Campaign reference map | [Dien Bien Phu map.png](https://commons.wikimedia.org/wiki/File:Dien_Bien_Phu_map.png), Raul654 (2005), CC BY-SA 3.0; visually inspected, unmodified local image 712×1048. Represents initial French dispositions in March 1954, not later territorial control. Website highlight overlay is an adaptation shared under CC BY-SA 3.0. No invented attack arrows or geospatial troop coordinates. SHA256 `ea9078855a69650485b8ccbbc061dbd8dbd1862c04962acb5031c602d9a854f7`. |
| Ba Đình, 13 March 2008 | [Commons original file record](https://commons.wikimedia.org/wiki/File:Hanoi,_Vietnam,_Ba_Dinh_Square.jpg), © Vyacheslav Argenberg, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Verified capture date, creator/license and image; local 1280px Commons thumbnail. SHA256 `24efb8140110f4f50b645fb2ec92674d385c699ddd268f0f20977b5f2e344a14`. |
| Ba Đình, 2 September 1945 | Existing [Commons record](https://commons.wikimedia.org/wiki/File:Ba_Dinh_Square_September_2nd,_1945.jpg), unknown photographer, public-domain claim for Vietnam per record. Same square as 2008 image; different camera angles and structures. UI explicitly avoids a claim of image registration or of the 2008 view being current. Public-domain status is territorial as stated by the source. |
| Documentary | Existing checked VTV24 YouTube item `gA_s6ibM0mw`, used as a retrospective documentary, not presented as wholly original 1954 footage. Player opt-in, no autoplay, external fallback retained. Runtime/thumbnail frame not verified; an attributed archive photograph is explicitly labeled illustration instead. |

No AI archival photographs, film copies or unverified theatrical-film embeds were added. The dramatization category intentionally explains its unavailable collection rather than offering fake play buttons. No additional textbook page claims were inferred from unread scan pages.

## D. Interaction, accessibility and performance

Markers and city buttons share the same selection. Multiple events at one place remain selectable individually; rapid selections replace the current camera flight. Closing details preserves camera/filter state. Browser back/forward revalidates URL state. Period, accent-insensitive keyword search, interval overlap, place and theme filter all affect globe markers, event list and theater; the comparison pair remains a separately captioned room.

All essential controls have keyboard alternatives. Globe can rotate with arrows, zoom with +/− and explicit buttons; location list remains usable without WebGL. Comparison uses a native accessible range input. Dialog uses the existing focus trap/restore/Escape behavior and becomes a bottom sheet on mobile. Reduced-motion removes flight duration and continuous rotation. Local media have attribution and failure paths; YouTube loads only after consent-by-click, with no autoplay. The shared route-only frame CSP is unchanged.

Rendering is on demand; optional rotation/flight stops rendering when offscreen or document-hidden. DPR capped at 1.25 on small screens and 1.75 on desktop. Resize/intersection observers, document/context listeners, pending fetch and animation frame, orbit controls, geometry, materials, texture and renderer are released on unmount. A lost context or unavailable land texture switches to the real location list; retry recreates a renderer.

See [production-check.json](production-check.json) for actual local production samples, WebGL chunk raw/gzip bytes and proof that the practice-game route did not request that chunk. This is a cold local navigation per viewport, without network/CPU throttling, not a field-performance certification. `maxEventDuration` is a sample Event Timing measurement, **not a validated INP**. No old-version production bundle comparison was built; zero Three.js transfer on the existing game is directly checked, not inferred from package size. Device GPU limits and sustained battery impact still require physical-device review.

Final sample: renderer chunk 356,783 bytes raw / 84,439 bytes gzip; game route did not load it, museum did. Desktop LCP 280 ms / CLS 0.0033; mobile viewport LCP 172 ms / CLS 0.0087; maximum observed event duration 104 ms desktop / 48 ms mobile viewport. These local values should not be used as production SLA or real-device INP claims.

Screenshots: [desktop hero](desktop-entry.png), [mobile hero](mobile-entry.png), [desktop globe](desktop-globe.png), [mobile globe](mobile-globe.png), [campaign](desktop-campaign.png), [mobile campaign](mobile-campaign.png), [theater](desktop-theater.png), [comparison](desktop-comparison.png), [mobile comparison](mobile-comparison.png).

## E. Actual checks and limits

- `npm --prefix web run test -- tests/unit/history-museum.test.ts`: RED observed (module absent) before implementation; GREEN after implementation.
- `npm --prefix web run test`: **64/64 PASS**, 15 test files.
- `npm --prefix web run lint`: **PASS**, no remaining warnings.
- `npm --prefix web run typecheck`: **PASS**.
- `npm --prefix web run build -- --webpack`: **PASS**, both `/kien-thuc` and `/kien-thuc/thu-thach` generated successfully. Default Turbopack build was not retested; previous baseline limitation remains in the parent evidence report.
- Full `npm --prefix web run test:e2e -- --workers=2`: **40 PASS / 4 FAIL (44 cases)** at the full regression run. Failures match previously documented baseline cases: desktop/mobile homepage expected H1 “Mạch Quyết Sách” but actual H1 is “Ngàn cân treo sợi tóc”; desktop/mobile cause-map selectors no longer match its existing UI. Those unrelated test/UI files were not changed. Homepage axe is not claimed PASS because its assertion failed before axe ran.
- Later targeted runs exercised mouse/touch comparison, missing/slow terrain, context loss/retry, and camera/event next/back synchronization. Final `npm --prefix web run test:e2e -- tests/e2e/history-museum.spec.ts tests/e2e/history.spec.ts --workers=2`: **34/34 PASS** across desktop/mobile, after the final hero and camera changes.
- Production capture script verifies HTTP 200, no page exceptions, no horizontal overflow at 1440/390 widths, working WebGL and zero Three renderer requests on the practice game. Layout also covered at 768px by existing history tests.
- Axe serious/critical checks pass for museum page and dialog in the executed history suites. This is basic automated coverage, not a full manual WCAG certification or a real iOS/Android GPU test.
- `npm --prefix web audit --json`: **17 reported vulnerabilities** (9 moderate, 7 high, 1 critical) in existing dependency chains such as Next/Vitest/Vite/Zod/eslint; no Three.js advisory reported. The same total was reported before/after Three types installation. No unrelated forced upgrade was applied. One sandbox attempt failed due DNS/temporary-path restrictions; checks were rerun outside sandbox successfully.
- No authenticated student competition, server score, database RLS/load/reconnect/device-transfer/admin/realtime integration run was performed. Public practice/dossier/API regression tests ran; do not extrapolate their results to those unverified Core flows.

Issues fixed during QA: ambiguous label names on wrapped selects, navigation tests acting on the old modal before challenge route completion, cached-image failure fixture, missing TypeScript `this` annotation in WebGL fixture, camera selection not advancing with previous/next, and overly tall non-3D introduction pushing the globe out of the entry viewport. Browser-only sandbox networking required production preview to be launched outside the sandbox for capture.

## F. Run and review

```powershell
npm --prefix web install
npm --prefix web run dev
# Open http://localhost:3000/kien-thuc
```

For production preview:

```powershell
npm --prefix web run build -- --webpack
npm --prefix web run start -- --port 3002
node scripts/capture-history-museum.mjs http://127.0.0.1:3002
```

Manual six-feature route:

1. Drag Earth, use zoom/reset, select Paris/Tours and open an event; repeat quickly to check flight cancellation. Use the location list and “Dùng danh sách thay 3D” to verify fallback.
2. Select a historical period, place/theme and year range; use the year scrubber, search `dien bien phu`, reload and navigate back/forward.
3. Open the Điện Biên Phủ event and “Xem diễn biến trên bản đồ”; visit all three phases and overview, inspect source/legend.
4. Open Rạp ký ức; switch categories, choose the documentary, explicitly load player, test external fallback. Dramatization has no cleared assets yet.
5. Drag the comparison with mouse/touch; focus and press arrow keys/Home/End; reset to 50%, read both dates and credits.
6. From event details choose “Thử thách kiến thức”, answer and read explanation/source, then return to the exact filtered event. Existing general practice remains available onward.

Remaining limits: the only comparison is 1945/2008 with different viewpoints; no verified present-day capture or licensed theatrical-film clip was added. The battle visualization is an attributed reference schematic with phase highlights, not a tactical reenactment or GIS map. Representative coordinates are intentionally not precise heritage-site pins. Additional human academic review, physical mobile/browser testing and production field metrics remain necessary before claiming those acceptance layers complete.
