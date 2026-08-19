# Phase 0 Figma Make Evidence

Date: 2026-08-19  
Method: Hybrid SDD+ADD; Full Core contracts and Standard/Light Shell verification  
Status: Figma Make prototype accepted as a generated UI deliverable; Figma Design handoff gate remains open

## Artifacts

- Figma Make Version 5: `https://www.figma.com/make/W6ZmtodyEVSDKQEdWyAqMk/VNR202---Mach-Quyet-Sach`
- Public preview: `https://app-y6pd3ntbcf4x53i4bgi56zuqt6g3rb4smwdqsgzuu645jcpljz4e.makeproxy-c.figma.site`
- Figma Design/handoff candidate: `https://www.figma.com/design/sazgk1wXpc6X80BuqOSAV9`

The Make editor and public preview were marked as deliverable/handoff artifacts after Version 5.

## Validation Evidence

### L1 - Automated

- Figma Make reported a clean build and zero TypeScript errors for Version 5.
- `// @ts-nocheck` was removed from the generated prototype according to the Make build report.
- No local package build was run because the generated Make source is hosted inside Figma rather than this workspace.

### L2 - Spec Compliance

- PASS: boot sequence identifies `Bộ môn VNR202 · FPT University` and uses `trước 1930-nay` scope.
- PASS: Game 1 shows `01/15`, five questions per chapter, six-minute timer, keyboard controls and working tap-select/tap-swap interaction.
- PASS: a confirmed Game 1 answer changed the demo state from `0/#23` to `80/#22`, and the Game 1 leaderboard row immediately rendered `80/#22`.
- PASS: demo login restores Game 2 at scenario `3/6`, stage `2/4`, `340` points, rank `#12`, and `6:22`; Arena, gameplay, Passport and Game 2 leaderboard render the same attempt state.
- PASS: public leaderboards and projector content show full names but no class or student ID.
- PASS: Cause Map desktop exposes six lanes, including `Bài học`; selecting two nodes displays a typed relationship, explanation and source. The Figma iPhone preview defaults to Slice cards.
- PASS: Dossier 06 evidence room contains four cards, requires three selections and exposes the cards as semantic checkboxes.
- PASS: `Phòng Phương Pháp` has its own route and is linked from the homepage/navigation and public footer.
- PASS: Evidence Matrix cells are semantic buttons; Enter opens the matching source drawer. Unverified source headers are labeled as sample data requiring lecturer verification.
- PASS: both games use a desktop task-plus-right-rail composition; Game 2 resume opens directly at the saved stage.

### L3 - Constitution and Safety

- PASS for prototype privacy: no student ID or class appears in public leaderboard/projector views.
- PASS for academic disclosure: only approved course/textbook sources are presented as verified; other prototype sources display `Dữ liệu mẫu - cần giảng viên xác minh`.
- LIMITATION: Make state is a UI simulation. It is not evidence of server-authoritative attempts, timers, scoring, one-attempt enforcement, RLS or realtime convergence; those remain implementation work in later phases.

### L4 - Acceptance

- Demonstrated in the public preview: anonymous Arena view, demo login, Passport resume, Game 1 answer/score/rank update, Game 2 resume, two separate leaderboards, Cause Map desktop/mobile behavior, Dossier 06 evidence selection, Method Room, Evidence Matrix keyboard activation and footer navigation.
- Projector Escape-key exit is verified.
- Projector pointer exit uses a Version 5 `pointerdown` escape hatch. The QA browser viewport was 1528x682 while the exit control is positioned near y=999 for the dedicated projector composition, so a physical click could not be exercised at the required 1920x1080 target. A final classroom/projector rehearsal at 1920x1080 is still required.

## Open Phase 0 Gate

Do not close `T000`-`T006` yet. The Make prototype is polished and behaviorally representative, but the separate Figma Design file has not been verified to contain:

1. all ten required pages;
2. variables, typography, grids and projector safe area;
3. reusable component variants and states;
4. prototype/motion and reduced-motion documentation;
5. final handoff notes mapping tokens and components to code.

The next Phase 0 action is to complete or verify that Design-file structure, then run the formal `T006` handoff audit.
