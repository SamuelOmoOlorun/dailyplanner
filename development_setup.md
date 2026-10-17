# Development preparation record

Prepared on 2026-10-17. This record does not change the PRD or authorize product development.

## Original specification

- File: `product_requirement_document.md`
- SHA-256 before preparation: `D4901F8CF8E8CAA3BC8D1B510C2E3C15EBDF3E34DB66048D8CC80022AAC339A2`
- All PRD requirements remain in place, including the V2 roadmap.

## Machine audit

| Item | Observed state |
| --- | --- |
| Operating system | Windows; PowerShell shell |
| Node.js | v24.7.0 |
| npm | 11.5.1 |
| Git | 2.53.0.windows.1 |
| Android SDK / Android Studio | Not detected in standard locations or PATH |
| Java / adb / emulator | Not detected on PATH |
| PHP / Composer | Installed, but not needed by the PRD stack |
| Existing app / Git repository | Neither existed at initial inspection |
| Initial testing selection | Physical Android device and web |

## Confirmed setup decisions

- Use Expo SQLite for local persistence.
- Test with a physical Android device and web.
- Web reminders are required; the user confirmed the planner tab may remain open. A browser-specific implementation will be necessary during development. Suspended tabs and sleeping devices cannot guarantee precise timer delivery.

## Preparation boundary

Only dependency configuration, an environment placeholder, development commands, and setup documentation belong to this stage. No product screens, SQL schema initialization, task logic, notifications scheduling, authentication, synchronization, calendar integration, or analytics have been implemented.

## Validation

| Check | Result |
| --- | --- |
| npm dependency installation | Passed; reproducible versions captured in `package-lock.json` |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run check:dependencies` | Passed: dependencies are up to date for SDK 57 |
| `npm.cmd run export:web -- --max-workers 2` | Passed |
| Android and iOS export with Hermes bytecode | Both passed; this is bundling, not a native application build or device test |
| Expo development HTTP server | Returned HTTP 200; its HTML response bypasses custom Metro isolation headers |
| Exported preview HTML and JavaScript | Both returned HTTP 200; JavaScript MIME type correct |
| Exported preview isolation | HTML returned COOP `same-origin` and COEP `require-corp` |
| PRD integrity | Original SHA-256 unchanged after preparation |

Windows sandbox restrictions initially prevented Expo from launching DevTools and Hermes. Repeating the affected checks with approved execution permissions succeeded.

The default Expo server remains useful for UI development. Use `npm.cmd run export:web` followed by `npm.cmd run preview:web` for browser SQLite validation with isolation headers. The preview is local development infrastructure, not a product backend. No actual SQLite operations were tested because database implementation belongs to the next stage.

## Dependency audit

`npm audit --json --offline=false` reported 22 affected package entries: 7 moderate and 15 high, with no critical findings. These include propagated findings through Expo, React Native, and Metro; they do not represent 22 independent vulnerabilities in application code.

Underlying advisories include `braces` (GHSA-vfj7-8cjw-p6xm), `node-forge` (GHSA-86w9-cpqp-85rv), and `uuid` (GHSA-w5hq-g745-h8pq). The audit's proposed complete remediation includes major downgrades to Expo 44 / React Native 0.72, which conflict with this SDK 57 setup. Compatible upstream fixes remain to be reviewed before release. No forced downgrade or dependency overrides were applied.

Physical-device testing and iOS validation remain outstanding. Browser reminder behavior still requires implementation and validation; setup checks cannot establish product readiness.

## Phase 1 implementation — 2026-10-17

The user supplied the four-phase execution plan and authorized phase 1. The plan was appended to PRD section 7 while existing sections 1–6 were preserved. Only phase 1 is marked complete; later phases remain pending.

- Initialized the PRD SQLite schema through a transactional version-1 migration using `PRAGMA user_version`. Initialization preserves existing data and rejects newer schema versions.
- Added parameterized preference reads/upserts and a SQLite-backed light/dark/system theme provider.
- Added a minimalist appearance preview and storage initialization error/retry state. No tasks, notification scheduling, or review behavior were added.
- Enabled automatic native appearance and installed the Expo-compatible `expo-system-ui` package.
- Seven Node tests passed against real SQLite/theme logic. Two Chrome integration tests passed, including reload persistence, offline writes, system appearance changes, and recovery after a simulated storage-load failure.
- TypeScript, Expo dependency compatibility, and web/Android/iOS bundle exports passed. Browser integration verifies actual Expo SQLite WebAssembly execution with cross-origin isolation. Native bundle exports do not replace physical-device tests.

The original checksum above records the pre-implementation PRD. It is expected to change now that the execution plan has been appended. Initial setup notes above are historical; this section records the current implementation.

## Phase 2 implementation — 2026-10-17

- Implemented task creation/editing in SQLite, including title, date, priority, completion status, precise start/end times, and reminder lead time. Existing phase 1 data and schema are preserved.
- Added a vertical daily timeline with actual minute-based position/height, date navigation, separate columns for overlapping tasks, and completed-task styling.
- Enforced nonblank titles, real calendar dates, valid `HH:mm` values, and start before end on the same day. Collision checking excludes the edited task and treats touching time boundaries as non-overlapping.
- Confirmed by the user: overlaps may be saved after a visible warning; 0 minutes means a reminder at task start. Past trigger times are skipped.
- Implemented reminder reconciliation for pending tasks across dates, native notification scheduling/cancellation, permission requests, and visible retryable errors. Android exact-alarm permission is declared; app-specific native permissions and delivery still require device testing.
- Added the open-tab browser reminder adapter with local delivery fingerprints, stale/completed-task checks, and a service-worker notification-display fallback. The worker does not cache pages or schedule closed-tab wakeups.
- Passed 17 Node tests and all 6 Chrome integration tests. Browser checks use actual Expo SQLite persistence; notification display boundaries are stubbed to avoid real OS alerts. Tests cover exact-minute geometry, metadata persistence, offline writes, overlap warnings, completion, date navigation, permission denial, scheduling/cancellation, and restoration after reload.
- TypeScript, the web export, and Android/iOS Hermes bundle exports passed. Native bundle validation does not establish physical-device notification delivery.

Phases 3 and 4 remain pending. No rollover review, evening wrap-up, keyboard shortcuts, accounts, calendar sync, scheduling assistance, or analytics were added.

## Date/time pickers, overnight tasks, and header appearance — 2026-10-17

At the user's request, added calendar date selection and hour/minute time dropdowns to the task editor, retaining exact-minute direct entry. Moved Light/Dark/System selection into a top-header dropdown, preserving the saved preference.

An earlier end time now means the following calendar day; equal start/end times remain invalid. One stored task is projected into two daily timeline segments, with shared edits/completion and a single reminder at the original start minus its lead time. Existing task records and the SQLite schema are unchanged. A midnight end produces no zero-length continuation. Collision checks include the previous day's continuing tasks and the following day's tasks.

Validation passed: 21 Node tests, all 7 Chrome tests, TypeScript, web export, and Android/iOS bundle exports. Browser coverage exercises actual calendar/month navigation, exact hour/minute selection, overnight clipping, cross-day collision warnings, shared completion, and reload persistence. Native physical-device validation remains outstanding. The refreshed preview responds at `http://127.0.0.1:8082`.
