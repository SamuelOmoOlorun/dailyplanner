# Product Requirement Document (PRD)

## **1. Executive Summary & Product Vision**
The Daily Planner application is a minimalist, time-blocking focused daily execution app designed to help users plan their days intentionally. By enforcing explicit start and end times for every task, the app turns passive to-do lists into structured daily schedules.

* **Version 1 (MVP):** A fast, frictionless, offline-first mobile and web application centered on minimalist daily task execution, strict time blocking, local notifications, and intelligent task rollover/review workflows.
* **Version 2 (Future):** Expansion into a smart scheduler featuring multi-calendar synchronization (Google, Outlook, Apple Calendar), cloud account backup, cross-device sync, and auto-scheduling assistance.

---

## **2. Target Platforms & Tech Architecture**

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Target Platforms** | Mobile (iOS & Android) & Web | Single cross-platform codebase ensuring seamless experience across desktop and mobile devices. |
| **Core Framework** | React Native with Expo (React Native Web) | Unified TypeScript architecture targeting iOS, Android, and Web efficiently. |
| **Data Architecture** | Offline-First Local Database (WatermelonDB / SQLite) | Zero network dependency for V1, instant load times, and effortless cloud sync migration path for V2. |
| **Notifications** | Local OS Push Notifications (`expo-notifications`) | On-device scheduled reminders that work completely offline. |

---

## **3. Core Features & Functional Requirements**

### **3.1 Task Creation & Time Blocking**
* **Mandatory Time Slots:** Every task must have a defined `startTime` and `endTime`. Tasks cannot exist as floating/unassigned list items.
* **Flexible Granularity:** Users can enter exact minute values (e.g., `09:05 - 09:40`) rather than being restricted to 15/30-minute interval grid snaps.
* **Date & Time Pickers:** Task date inputs provide a calendar dropdown; start/end time inputs provide hour/minute dropdowns with exact-minute selection. Direct entry remains supported.
* **Overnight Tasks:** An end time earlier than the start time automatically ends on the next calendar date. Display the task on both daily timelines as one task with shared metadata/completion and one reminder at the original start minus lead time. Equal start/end times are invalid.
* **Overlap Indicator:** UI provides a visual indicator/alert when a newly created or edited task overlaps with an existing time block on the same day.
* **Task Metadata:** Each task supports Title, Priority (`High`, `Medium`, `Low`), Completion Status (`Completed` / `Pending`), and Reminder Lead Time (e.g., 5, 10, 15 minutes prior).

### **3.2 Notifications & Reminders**
* **Local Push Reminders:** Schedules local OS-level push notifications based on `startTime` minus the user-selected reminder lead time.
* **Offline Execution:** Notifications must trigger reliably without active server/internet connection.

### **3.3 Dual Rollover Workflow (End-of-Day Review)**
* **Automatic Launch Trigger (Morning):**
  * When opening the app on a new calendar date, the app automatically checks for uncompleted tasks from prior dates.
  * Displays a modal prompting the user to either **Migrate to Today** (assigning new time blocks) or **Discard**.
* **Manual Trigger (Evening Review / "Wrap Up Today"):**
  * Dedicated "Wrap Up Today" button/banner accessible in the evening view.
  * Allows users to proactively review, complete, discard, or reschedule pending tasks before the day closes.

---

## **4. Information Architecture & User Workflow**

```
                     ┌───────────────────────────┐
                     │         Launch App        │
                     └─────────────┬─────────────┘
                                   │
                    [ Is it a new calendar day? ]
                      ├── YES ──► [ Automatic Rollover Modal ]
                      │           ├── Migrate Tasks to Today
                      │           └── Discard Unfinished Tasks
                      └── NO
                                   │
                                   ▼
                     ┌───────────────────────────┐
                     │     Daily Timeline View   │
                     └─────────────┬─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  [ Create / Edit ]        [ Active Reminders ]      [ Evening Wrap Up ]
  - Precise Start/End      - Triggered locally       - Manual Task Review
  - Mandatory Placement      at offset minutes       - Clean up end of day
  - Collision Alerts
```

---

## **5. Local Data Schema (V1 SQLite / WatermelonDB)**

```sql
-- Database Schema Definition

CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  priority TEXT CHECK(priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  date TEXT NOT NULL,                  -- ISO Date format: YYYY-MM-DD
  start_time TEXT NOT NULL,            -- 24-hour format: HH:mm
  end_time TEXT NOT NULL,              -- 24-hour format: HH:mm
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_offset_minutes INTEGER DEFAULT 0, -- e.g., 0, 5, 10, 15
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

---

## **6. Version 2 Roadmap (Smart Scheduler & Integrations)**

1. **External Calendar Sync:** Two-way integration with Google Calendar, Apple Calendar, and Microsoft Outlook to overlay external events directly on the daily timeline.
2. **Cloud Sync & User Accounts:** Optional sign-in to back up local data and synchronize state across multiple devices and web browsers.
3. **Smart Auto-Scheduling:** Algorithmic suggestions to automatically find free timeline slots for tasks between calendar events.
4. **Analytics & Insights:** Basic performance tracking (completion rates, planned time vs. actual focus time).

---

## **7. Detailed Step-by-Step Development Execution**

Implementation status: Phases 1 and 2 are implemented. Phases 3–4 remain pending; their checkboxes reflect that they have not been implemented. Physical-device notification validation remains outstanding.

### **Phase 1: Project & Architecture Setup**

- [x] Initialize **React Native (Expo)** project with Web platform configuration.
- [x] Configure **WatermelonDB** or **Expo SQLite** for local offline-first persistence.
- [x] Set up theme configuration (minimalist light & dark mode), with a top-of-app selection button and dropdown for Light, Dark, and System.

### **Phase 2: Core Task & Time Block System**

- [x] **Time Block Input Component:** Flexible start/end time selector allowing precise minute selection.
- [x] **Timeline Daily View:** Vertical timeline UI rendering tasks according to their start and end times.
- [x] **Validation Layer:** Enforce start datetime < end datetime and handle task collision alerts across both dates. An earlier end time means the following day, as requested in the overnight-task update.
- [x] **Notification Handler:** Schedule local device notifications timed with `start_time - reminder_offset`.

### **Phase 3: Dual Rollover Workflow**

- [ ] **App Startup Hook:** Logic that checks `last_opened_date` against current system date. If different, invoke Migration UI for pending past tasks.
- [ ] **"Wrap Up Today" Manual View:** A lightweight review screen where users can clear or re-assign unfinished tasks at night.

### **Phase 4: Polish & Web Cross-Platform Optimization**

- [ ] Keyboard shortcuts for quick creation on Web.
- [ ] Responsive layout adjustments for larger desktop screens vs. mobile devices.
