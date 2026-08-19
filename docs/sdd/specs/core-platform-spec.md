# Core Platform Specification

Status: Approved
Risk: High
Specification depth: Full
Project: VNR202 - Mach Quyet Sach

## 1. Context and goal

The system provides a public VNR202 educational experience and an authenticated Live Arena for one class. Students play two different games at their own pace during a configured competition window. Each game has an independent attempt and realtime leaderboard. The platform must be academically reliable, fair, recoverable after connection loss, and reusable for sequential competitions.

## 2. Actors and permissions

### Public visitor

- MAY access the public historical experiences without an account.
- MAY view public realtime and finalized leaderboards.
- SHALL NOT access a student's private result details or administrative data.

### Student

- SHALL authenticate before entering Live Arena or Student Passport.
- MAY play each game once per assigned competition.
- MAY resume the same attempt after disconnect or device transfer.
- MAY view their own detailed result and the public leaderboard.
- SHALL NOT create accounts, reset attempt counts, publish questions, modify schedules, or write scores.

### Administrator or lecturer

- MAY import the one-class roster from CSV.
- MAY create temporary student credentials and reset a password to a new temporary password.
- MAY configure, schedule, open, monitor, finalize, and archive sequential competitions.
- MAY manage and review question content.
- MAY view full student IDs and detailed attempt records.

## 3. Scope and assumptions

- The initial product supports one class roster.
- At most one competition is active or accepting new starts at a time.
- Multiple historical competitions and their results are retained.
- Public exploration does not require authentication.
- Student email and institutional SSO are out of scope for the first release.
- A competition includes both approved games and two independent leaderboards.
- The public experience includes 15 decision dossiers, with five dossiers for each of the three main course chapters.
- The introductory chapter is presented as a public methodology room and is not counted among the 15 dossiers.

## 4. Product components covered by this Core spec

- Roster and account provisioning.
- Authentication and session transfer.
- Competition lifecycle and schedule.
- Attempt lifecycle, timing, disconnect recovery, and one-attempt enforcement.
- Balanced randomized question allocation.
- Server-authoritative answer evaluation and normalized scoring.
- Two realtime leaderboards.
- Question governance and immutable competition snapshots.
- Privacy, audit, consistency, and performance requirements.

Public editorial content, Figma composition, detailed animation, and final visual copy are specified separately as Shell.

## 5. State models

### 5.1 Competition state

`Draft -> Scheduled -> Open -> StartClosed -> Settling -> Finalized -> Archived`

- Draft: configuration may change and no student may start.
- Scheduled: opening and start-deadline times are fixed but may still be changed before Open.
- Open: assigned students may create an unused game attempt.
- StartClosed: no new attempt may start; existing attempts may continue.
- Settling: no active attempt can legally continue, and final ranks are being reconciled.
- Finalized: ranks and results are locked.
- Archived: read-only historical record.

### 5.2 Attempt state

`NotStarted -> Active -> Completed`

Alternative transitions:

- `Active -> GracePaused -> Active` while disconnect allowance remains.
- `GracePaused -> DisconnectedRunning` when the 120-second allowance is exhausted.
- `DisconnectedRunning -> Active` when the student reconnects before time expires.
- `Active | GracePaused | DisconnectedRunning -> TimedOut` when playable time expires.

Completed and TimedOut are terminal for that game in that competition.

### 5.3 Question state

`Draft -> Reviewed -> Published`

Only Published content may be copied into an immutable competition question snapshot.

## 6. Business rules

### Accounts and access

- `ACC-001`: The administrator SHALL import the student roster from CSV.
- `ACC-002`: Each student account SHALL be uniquely bound to one student ID.
- `ACC-003`: A student SHALL change the temporary password before accessing protected features.
- `ACC-004`: The system SHALL reject duplicate student IDs in both the uploaded file and persisted roster.
- `ACC-005`: Real roster data and real credentials SHALL NOT be committed to source control.
- `ACCESS-001`: Public historical exploration and public leaderboard viewing SHALL not require authentication.
- `ACCESS-002`: Live Arena, Student Passport, and private results SHALL require student authentication.
- `ACCESS-003`: Roster, competition, question, and detailed-result management SHALL require administrator authorization.
- `ACCESS-004`: A forgotten student password SHALL be reset by an administrator to a new temporary password.

### Class and competition scope

- `SCOPE-001`: The first release SHALL manage one class roster.
- `SCOPE-002`: The system SHALL prevent more than one competition from accepting new starts at the same time.
- `SCOPE-003`: Sequential competitions and their results SHALL be retained.
- `SCOPE-004`: Each competition SHALL have two independent game configurations and two independent leaderboards.
- `SCOPE-005`: The public experience SHALL contain 15 decision dossiers divided evenly across the three main course chapters.
- `SCOPE-006`: The introductory chapter SHALL be represented by a public methodology experience outside the 15-dossier count.
- `EVT-001`: Each competition SHALL have an opening time and a start deadline.
- `EVT-002`: WHEN the start deadline passes, the system SHALL reject creation of a new attempt.
- `EVT-003`: A valid attempt created before the start deadline SHALL receive the full configured playable duration.
- `EVT-004`: The maximum legal end time SHALL equal the start deadline plus game duration plus the 120-second disconnect allowance.
- `EVT-005`: The leaderboard SHALL remain live until all legal attempts finish or reach their maximum legal end time, then finalize.

### Attempts, disconnects, and devices

- `TRY-001`: Each student SHALL receive exactly one attempt per game per competition.
- `TRY-002`: A new competition SHALL create new eligibility for both games without modifying historical results.
- `TRY-003`: A new competition SHALL NOT reset or delete previous results.
- `TRY-004`: Results SHALL be partitioned by competition and game.
- `ATT-001`: A disconnect SHALL NOT create a new attempt.
- `ATT-002`: Current question instance, question progress, score, remaining playable time, and allocated question snapshot SHALL be persisted server-side.
- `ATT-003`: The server SHALL pause playable time for at most 120 cumulative seconds per game attempt while disconnected.
- `ATT-004`: WHEN the cumulative allowance is exhausted, playable time SHALL continue even if the student remains disconnected.
- `ATT-005`: WHEN the student reconnects before a terminal state, the system SHALL resume the same attempt.
- `ATT-006`: Disconnect state SHALL be derived from server-observed heartbeat and session state rather than a client-provided claim.
- `SESSION-001`: A student SHALL have at most one active gameplay session.
- `SESSION-002`: WHEN the student authenticates on a new device during an active attempt, control SHALL transfer to the new session.
- `SESSION-003`: The previous gameplay session SHALL be invalidated immediately after transfer.
- `SESSION-004`: The new session SHALL resume the same attempt without resetting question allocation, score, or time.
- `SESSION-005`: The server SHALL reject answers from an invalid session, a stale attempt version, or an already-answered question instance.

### Game configuration

- `GAME1-001`: The default Dòng Chảy Lịch Sử configuration SHALL contain 15 questions and 6 minutes of playable time.
- `GAME1-002`: The default blueprint SHALL allocate five questions to each course chapter.
- `GAME2-001`: The default Phòng Quyết Sách configuration SHALL contain six scenarios and 9 minutes of playable time.
- `GAME2-002`: The default blueprint SHALL allocate two scenarios to each course chapter.
- `CFG-001`: An administrator MAY change question counts and playable durations before the competition opens.
- `CFG-002`: WHEN the first student starts, the competition's game configuration and question snapshot SHALL become immutable.

### Question allocation and learning feedback

- `ALLOC-001`: Each student SHALL receive a separately randomized question set.
- `ALLOC-002`: Every allocated set SHALL conform to the same chapter, type, difficulty, and total-weight blueprint for that game and competition.
- `ALLOC-003`: The system SHALL randomize answer-option order where the question type permits it.
- `LEARN-001`: WHEN a question or independently scored scenario stage is evaluated, the system SHALL display correctness and an explanation limited to that completed interaction.
- `LEARN-002`: The playable timer SHALL pause for at most 8 seconds while feedback is displayed.
- `LEARN-003`: Feedback-reading time SHALL NOT contribute to the speed score.
- `LEARN-004`: The applicable leaderboard SHALL update after the server commits each scored question or scenario-stage result.
- `LEARN-005`: WHEN 8 seconds elapse or the student continues earlier, the system SHALL advance to the next interaction.

### Question governance

- `CONTENT-001`: Each question SHALL have one of Draft, Reviewed, or Published status.
- `CONTENT-002`: Only Published questions SHALL be allocated.
- `CONTENT-003`: Every question SHALL include chapter, topic, type, difficulty, answer, explanation, and source metadata.
- `CONTENT-004`: AI MAY create or improve a Draft but SHALL NOT mark content Reviewed or Published.
- `CONTENT-005`: An administrator or lecturer SHALL review the academic answer, explanation, and source before publication.
- `CONTENT-006`: A question snapshot already allocated to an active competition SHALL remain unchanged for that competition.

### Scoring and ranking

- `SCORE-001`: Each game SHALL have a maximum normalized score of 1,000 points.
- `SCORE-002`: The server SHALL calculate score from correctness, difficulty weight, and a capped speed component.
- `SCORE-003`: Different allocated sets conforming to the same blueprint SHALL have equivalent maximum base weight.
- `SCORE-004`: WHEN a scored question or scenario-stage result is committed, the server SHALL persist the new score and publish the resulting rank update.
- `SCORE-005`: Ties SHALL be ordered by higher accuracy, then lower active answer time, then earlier completion time.
- `GAME2-SCORE-001`: Phòng Quyết Sách SHALL weight evidence selection at 35%, decision selection at 35%, consequence ordering at 20%, and speed at 10%.
- `GAME2-SCORE-002`: The 35% evidence-analysis component SHALL consist of 10% central-problem identification and 25% evidence selection, so every scenario stage contributes an observable scored result.

### Public leaderboard privacy

- `PRV-001`: A public leaderboard SHALL display the student's full name.
- `PRV-002`: A public leaderboard SHALL NOT display the student ID.
- `PRV-003`: Authorized administrators MAY view full name, student ID, and detailed attempt information.
- `PRV-004`: Duplicate full names SHALL remain separate internal identities without exposing student IDs publicly.

## 7. Game interaction contracts

### 7.1 Dòng Chảy Lịch Sử

Supported interaction families:

- Arrange historical events.
- Match causes to consequences.
- Match people, documents, and periods.
- Identify relevant evidence.
- Evaluate historical statements.

The game SHALL update the player's visual historical flow and leaderboard after each evaluated question.

### 7.2 Phòng Quyết Sách

Each scenario SHALL contain four evaluated stages:

1. Identify the central problem from the briefing.
2. Select relevant evidence.
3. Select the proposed decision or policy response.
4. Arrange the expected consequence chain.

After a scenario, the system SHALL reveal the historical decision, reasons, outcomes, limitations, lessons, and sources.

## 8. API, data, and realtime contract notes

The detailed schema and endpoint names will be locked in an Architecture Decision Record. The implementation SHALL include, at minimum:

- Student, administrator, and session identity.
- Competition configuration and lifecycle.
- Game configuration and immutable competition content snapshot.
- Attempt, allocated item, answer result, timer budget, and terminal result.
- Authoritative leaderboard projection per competition and game.
- Audit records for roster, competition, account-reset, question-publication, and result-affecting administrative actions.

Realtime payloads SHALL carry identifiers and version numbers sufficient for a client to detect stale state and request a full resynchronization. Realtime payloads SHALL NOT contain correct answers or protected student identifiers.

## 9. Error behavior

- Unauthorized or invalid-session operations SHALL return a generic protected-operation error and SHALL NOT disclose authorization internals.
- Duplicate answer submission SHALL return the authoritative existing answer result without awarding points twice.
- A stale attempt or leaderboard version SHALL cause the client to refetch authoritative state.
- A malformed CSV SHALL be rejected with row-level validation feedback before any roster mutation is committed.
- An insufficient Published question pool SHALL block competition opening and identify the missing blueprint categories to the administrator.
- A realtime disconnection SHALL not roll back a committed answer or score.

## 10. Non-functional requirements

- `NFR-RT-001`: The system SHALL support at least 60 concurrent players.
- `NFR-RT-002`: The system SHALL support at least 200 concurrent leaderboard viewers.
- `NFR-RT-003`: Under the approved load target, a committed rank SHALL be visible to connected viewers within 1 second.
- `NFR-RT-004`: A missed realtime message SHALL NOT cause permanent score or ranking divergence.
- `NFR-RT-005`: Server and database state SHALL remain authoritative over client state.
- Protected mutations SHALL be validated and authorized server-side.
- Audit timestamps and schedule comparisons SHALL use a single server-side time standard and display in the configured local timezone.
- Mobile gameplay and projector leaderboards SHALL be fully usable at their target dimensions.

## 11. EARS acceptance criteria

- `AC-AUTH-001`: WHEN an administrator imports a valid roster, THE SYSTEM SHALL create one unique student identity per valid row and report the import result.
- `AC-AUTH-002`: IF a roster contains duplicate or malformed student IDs, THEN THE SYSTEM SHALL reject the affected import atomically and identify the invalid rows.
- `AC-TRY-001`: WHEN a student starts an unused game before the deadline, THE SYSTEM SHALL create exactly one attempt and an immutable balanced allocation.
- `AC-TRY-002`: IF the same student requests a second attempt for the same game and competition, THEN THE SYSTEM SHALL return the existing attempt or terminal result and SHALL NOT create a new attempt.
- `AC-SESSION-001`: WHEN a student transfers to a new device, THE SYSTEM SHALL invalidate the previous gameplay session and resume the same attempt on the new device.
- `AC-DISC-001`: WHEN a server-observed disconnect begins, THE SYSTEM SHALL pause playable time until reconnect or until the cumulative 120-second allowance is exhausted.
- `AC-DISC-002`: IF the allowance is exhausted while disconnected, THEN THE SYSTEM SHALL continue the playable timer and preserve the ability to reconnect before timeout.
- `AC-SCORE-001`: WHEN a valid unanswered item is submitted, THE SYSTEM SHALL evaluate it once, persist the result transactionally, update the normalized score, and publish a versioned leaderboard update.
- `AC-SCORE-002`: IF the same answer is submitted more than once, THEN THE SYSTEM SHALL award points at most once.
- `AC-RT-001`: WHEN a score is committed under the approved load target, THE SYSTEM SHALL show the new rank to connected viewers within 1 second.
- `AC-RT-002`: IF a client misses a realtime event, THEN THE SYSTEM SHALL allow it to retrieve and render the current authoritative leaderboard.
- `AC-CONTENT-001`: IF the Published pool cannot satisfy every allocation category, THEN THE SYSTEM SHALL block competition opening.
- `AC-PRV-001`: WHEN a public viewer opens a leaderboard, THE SYSTEM SHALL show full names and SHALL NOT expose student IDs.
- `AC-FINAL-001`: WHEN every legal attempt is terminal or its maximum legal end time has passed, THE SYSTEM SHALL reconcile, lock, and retain both final leaderboards.

## 12. Edge cases to test

- Duplicate student IDs within one CSV and against the existing roster.
- Blank, malformed, oversized, or wrong-encoding CSV input.
- Two simultaneous start requests for the same student and game.
- Two simultaneous answers for one question instance.
- Answer arriving as the timer reaches zero.
- Multiple brief disconnects that cumulatively reach 120 seconds.
- Device transfer while an answer request is in flight.
- Realtime event delivered out of order or more than once.
- Duplicate full names on the public leaderboard.
- Published question removed after snapshot creation.
- Competition opening with an insufficient question pool.
- Start request exactly at the configured deadline.
- Timezone and daylight-offset display differences.

## 13. Out of scope for the first release

- Multiple class rosters or multiple simultaneously active competitions.
- Institutional SSO.
- Student self-registration.
- Email-based password recovery.
- Payments, chat, social posting, or user-generated public content.
- Client-authoritative offline gameplay.
- Cross-school or global matchmaking.

## 14. Open questions for later specs

- Final editorial wording and source package for each approved Hồ sơ Quyết sách.
- Production domain, environment promotion, retention period, and operational ownership.

## 15. Traceability status

This Approved version records the Core rules and full 15-dossier scope approved in conversation. Implementation SHALL follow the accepted Architecture Decision Record, validation mapping and implementation plans.
