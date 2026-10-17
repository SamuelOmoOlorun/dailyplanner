# Daily Planner development setup

The product specification and execution plan are in [product_requirement_document.md](product_requirement_document.md). Phases 1 and 2 are implemented: Expo/web architecture, SQLite persistence, light/dark themes, task editing, a daily timeline, validation, and reminders. Phases 3–4 remain pending.

## Stack and scope

- React Native with Expo and TypeScript, targeting Android, iOS, and web.
- Expo SDK 57, selected for physical-device Expo Go compatibility during the current SDK transition.
- Expo SQLite, confirmed by the user, for local persistence.
- `expo-notifications` schedules native reminders. A browser adapter provides web reminders while the planner tab remains open, as confirmed by the user.
- V1 includes exactly the task, reminder, timeline, and rollover/review requirements in PRD sections 3–5.
- PRD section 6 remains the V2 roadmap. No V2 features are implemented during setup.

`App.tsx` initializes SQLite and the theme provider. `src/PlannerScreen.tsx` displays the selected day's timeline, task editor, notification permission state, and a top-header appearance dropdown (Light, Dark, System). Tasks and appearance are stored in SQLite and restored on launch. No sample tasks are added. Rollover, evening review, shortcuts, and phase 4 layout polish are not implemented.

`src/storage/` contains the versioned database initialization and parameterized preference access. `src/theme/` contains reusable colors, spacing, and the theme provider. Device appearance is the default until a user chooses an override. `expo-system-ui` enables automatic appearance support in Android builds.

`metro.config.js` prepares WebAssembly assets and Metro response headers for Expo SQLite on web. Expo SDK 57's HTML handler bypasses those Metro headers. Use the exported preview below when validating web SQLite: it supplies isolation headers on both HTML and assets. SQLite web support is experimental. Future web hosting must serve the same COOP/COEP headers over HTTPS (localhost is suitable for development). This setup does not implement offline web caching.

## Development commands

Use `npm.cmd` in Windows PowerShell to avoid local PowerShell restrictions on `npm.ps1`.

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run check:dependencies
npm.cmd run web
```

For the SQLite-compatible web preview, run the following, then open `http://127.0.0.1:8082`. Re-export after code changes; this preview has no hot reload.

```powershell
npm.cmd run export:web
npm.cmd run preview:web
```

The browser database belongs to its origin. Keep using `http://127.0.0.1:8082` for a consistent preview; `localhost` and other ports have separate storage. Browser site-data removal deletes its local database. Offline preference reads/writes are supported after loading; offline page launch is not yet implemented.

## Phase 2 workflow

Use **New task**, enter a title, choose a date from the calendar dropdown, and select exact `HH:mm` start/end times from the hour/minute dropdowns (or type directly). Choose priority and reminder lead time, then save. Tap a timeline block to edit it or change its status to Completed. Navigate days using the arrows or Today. Timeline position and height use the actual minute values; overlapping tasks occupy separate columns. Very short blocks remain small to preserve their time geometry and have full accessible labels.

Confirmed behavior: equal start/end times are invalid. An earlier end time automatically ends tomorrow: `23:00–01:00` appears as `23:00–24:00` on the start date and `00:00–01:00` on the next date. Both segments edit the same task and share completion status; the reminder remains anchored to the original start. A task ending exactly at midnight has no empty next-day segment. No schema migration or duplicate task records are required. Overlaps are checked across both dates and can be saved with **Save with overlap**. A 0-minute offset means a reminder at task start. Reminder times that have passed are skipped. Invalid titles, dates, times, priorities, completion values, and offsets are rejected before database writes.

Use **Enable reminders** to request notification permission. Task saving works even if permission is denied. Future pending tasks are reconciled on launch, edits, completion, app focus, and periodically while running. Changed reminders are replaced and completed-task reminders are cancelled. Reminder errors are visible and can be retried.

Native reminders are scheduled through the operating system without a server. The Android configuration declares `SCHEDULE_EXACT_ALARM`; actual exact delivery also depends on Alarms & reminders access and OS settings. A standalone/development build is needed to verify this app's build-time configuration. No native device notification delivery has been tested on this Windows machine.

On web, timers run in the open tab and invoke the browser notification API. A small service worker provides notification display on browsers that require it; it does not cache the app or schedule wakeups. Browser suspension and device sleep can delay delivery. Triggers over one minute late are skipped to avoid stale alerts. Notification display fingerprints are saved locally to prevent replay. If the browser does not support notifications, the planner remains usable.

## Tests

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:browser
```

The 21 Node tests cover the real SQLite schema/repositories, validation, overlap boundaries, timeline columns, overnight segments/shared state, midnight/year boundaries, theme selection, and reminder reconciliation. Seven Chrome tests cover the calendar/time pickers, appearance dropdown, storage recovery, task creation/editing/completion, overnight daily segments, exact timeline geometry, offline writes, date navigation, permission denial, reminder cancellation/restoration, and desktop/worker notification display paths. Browser notification display is stubbed; these tests do not establish real OS banner delivery. Export the current web build before running browser tests. Playwright starts the local preview if needed; it uses the installed Chrome executable (`CHROME_PATH` can override its location).

For an Android device, install the matching Expo Go app, connect the phone and computer to the same network, run `npm.cmd start`, and scan the displayed QR code with Expo Go. Device installation and notification permissions require interaction on the phone. No device test has been completed during setup.

`npm.cmd run android` opens an attached device or configured emulator if Android tooling is installed. The selected initial test workflow is a physical Android device plus web, so Android Studio, Java, and an emulator are not initial prerequisites. Native development builds may be needed later to validate build-time notification settings and behavior in the app's own binary.

`npm.cmd run ios` requires a macOS machine with Xcode for the simulator. This Windows computer cannot perform local iOS builds. Physical iOS or cloud build setup remains a later task if requested.

XAMPP, PHP, Apache, MySQL, a server backend, API credentials, and an Expo account are not required for the selected Android Expo Go and web starter workflow. Start this project with Expo rather than an Apache localhost directory URL.

## Decisions and validation for later phases

1. **Web reminder validation:** The user requires web reminders and confirmed the planner tab may remain open. Use browser notification support while that tab is running; `expo-notifications` handles native platforms only. Test permission denial, tab suspension, device sleep, and timer throttling. An open tab does not guarantee exact delivery while suspended or asleep. No closed-browser offline notification guarantee is made, and no server dependency is introduced.
2. **Offline web loading:** Local database persistence alone does not make a previously loaded website launch offline. Web application caching and an offline reload check are required during V1 implementation.
3. **Time boundaries:** The user authorized overnight tasks. Earlier end times mean the next day; equal times remain invalid. The stored date is the start date and next-day timeline segments are derived automatically.
4. **Review behavior:** Confirm when the evening view begins, whether discarded tasks are permanently deleted, and whether manual rescheduling may target any future date.
5. **Confirmed reminder and overlap behavior:** Offset `0` means at task start; elapsed trigger times are skipped; overlap warnings allow saving. These were confirmed for phase 2.

Phases 1–2 have been authorized and implemented. Resolve the remaining review behavior before phase 3.

## Reference documentation

- [Expo project setup and Expo Go SDK compatibility](https://docs.expo.dev/get-started/create-a-project/)
- [Expo SDK 57 SQLite, including experimental web support](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [Expo SDK 57 notifications and supported platforms](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- [Browser offline and background lifecycle](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [Browser notification constructor and mobile service-worker display](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification)

See [development_setup.md](development_setup.md) for the machine audit and validation results.
