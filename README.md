# ACM.Automation

Automated tests for **ACM — نظام الأرشيف والمراسلات** (Archiving & Correspondence Management), written with **Playwright** and **TypeScript**:

- Target Application: `https://test-acm.3segypt.com/`
- Full E2E & Functional Coverage: 15 modules / 82 Gherkin test cases (ACM-01 through ACM-15).
- Test Execution: Interactive Local Web Dashboard (`http://localhost:4400`) + Command-line runners.

---

## 1. Quick Setup (Once)

1. Ensure **Node.js LTS** (22.18 or newer), **Git for Windows**, and **Google Chrome** are installed.
2. In the project folder `C:\Users\elattar\Desktop\ACM-Automation`, double-click **`Setup.cmd`**.
   - It verifies dependencies, installs FFmpeg for video evidence recording, and sets up your `.env`.
   - Fill in your admin credentials (`ADMIN_USERNAME` and `ADMIN_PASSWORD`), save, and close Notepad.

---

## 2. Running Tests via the Dashboard

Double-click **`Start dashboard.cmd`** (or run `npm run dashboard`).
It automatically opens **http://localhost:4400** in your browser.

| On the Dashboard | What it does |
|---|---|
| **All pages** | Overview of all 15 ACM modules with pass rates and quick **Run** buttons |
| **Module in sidebar** | View test cases for that module. Filter by status (Passed, Failed, Blocked), priority (P1, P2, P3, P4), or search text |
| **Run all / Re-run failed / Run selected** | Run the whole page, only failed cases, or ticked cases |
| **Show browser toggle** | Toggle headed mode on/off to watch tests live in Chrome |
| **Your verdict** | Record expected verdicts for cases needing review |
| **Bug report (.docx)** | Download auto-generated Word bug reports with framed screenshots |

---

## 3. The 15 User Stories & Modules

| Story ID | Module Title | Group | Cases | Description |
|---|---|---|:---:|---|
| **ACM-01** | Login and System Settings | System & Admin | 10 | Admin login, language switch (AR/EN), lookups, roles, identity/logo, IMAP/SMTP |
| **ACM-02** | Entities and Persons | Address Book | 5 | Internal entities tree (Al Ahly & sub-entities), persons, external entities |
| **ACM-03** | Archive Folders | Archive | 2 | Main archive folders & sub-folders hierarchy, renaming & deletion |
| **ACM-04** | Archive Templates | Archive | 2 | Indexing templates with mandatory/optional fields of all data types |
| **ACM-05** | Users and Permissions | User Management | 7 | User creation from persons list, OTP disabled by default, role permissions |
| **ACM-06** | User Login and Onboarding | User Management | 3 | Password change enforcement, login rejection, logout & URL protection |
| **ACM-07** | Official Correspondence | Correspondence | 10 | Incoming/outgoing correspondence, auto reference IDs (YYYY/N/I & YYYY/N/O), drafts, attachments, confidentiality |
| **ACM-08** | External Intake and Archiving | Correspondence | 11 | Mail intake to unclassified, classification, template validation, and archiving |
| **ACM-09** | Access and Visibility Control | Security | 5 | Mail privacy: specific person vs sub-entity vs main entity, admin view scope |
| **ACM-10** | Internal Mail | Correspondence | 3 | Private employee-to-employee internal messaging, drafts, filters |
| **ACM-11** | Registry External Sending | Correspondence | 3 | Outgoing requests routed through the Registry, external dispatch |
| **ACM-12** | Register Lists and Search | Correspondence | 5 | 3-char search, filtering, sorting, read/unread counters, spam & trash |
| **ACM-13** | Tasks Management | Tasks | 7 | Task creation, correspondence linking, lifecycle (New/In Progress/Done), rejection, overdue, out of office |
| **ACM-14** | Dashboard and Notifications | Portal | 4 | Real-time counters verification, quick actions, global search, notifications |
| **ACM-15** | Reports and Audit Log | Reports | 5 | Incoming/outgoing registers, PDF export, date validation, daily summary email, audit log |

---

## 4. Terminal Commands

| Command | Action |
|---|---|
| `npm run dashboard` | Launch the local web dashboard (`http://localhost:4400`) |
| `npm run test` | Run all Playwright tests and generate Allure report |
| `npm run test:headed` | Run tests with Chrome visible |
| `npm run test:unit` | Verify specs match test sheets word-for-word |
| `npm run check` | Run TypeScript typecheck and ESLint |
| `npm run story:check` | Check status of all user stories and test readiness |
| `npx playwright test --project=acm-01-login-and-system-settings` | Run a specific story |
| `npm run report:open` | Open Allure test report |
