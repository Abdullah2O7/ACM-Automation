# ACM.Automation - read this first

You are helping the QA team automate and run tests for **ACM — نظام الأرشيف والمراسلات** (Archiving & Correspondence Management).
Everything the AI agent and the team need is in this project's files.

- **System under test:** https://test-acm.3segypt.com/
- **Stack:** Playwright + TypeScript + Allure Reports + Docx Bug Reports.
- **Workflow:** Tests can be run from the **Dashboard** (`http://localhost:4400`) started by double-clicking `Start dashboard.cmd` (or `npm run dashboard`); `Setup.cmd` sets up any computer.
- **Test Ingestion:** Test stories are backed by Excel sheets in `docs/test-cases/` (`ACM-01 - ...xlsx` to `ACM-15 - ...xlsx`).

---

## 15 System Modules & Phases

1. **ACM-01 - Login and System Settings** (`tests/pages/acm-01-login-and-system-settings`)
   - Admin sign-in, language switching (Arabic RTL / English LTR), system lookups, role templates, entity identity/logo, IMAP & SMTP setup.
2. **ACM-02 - Entities and Persons** (`tests/pages/acm-02-entities-and-persons`)
   - Internal main entities & sub-entities, registering persons with emails, external entity management, tree search/filter.
3. **ACM-03 - Archive Folders** (`tests/pages/acm-03-archive-folders`)
   - Main archive folders and sub-folders, folder hierarchy and renaming/deletion.
4. **ACM-04 - Archive Templates** (`tests/pages/acm-04-archive-templates`)
   - Archive indexing templates with mandatory and optional fields of all data types (text, number, date, dropdown, boolean).
5. **ACM-05 - Users and Permissions** (`tests/pages/acm-05-users-and-permissions`)
   - Creating system users linked to persons, automatic OTP bypass/disable, role assignment and access boundaries.
6. **ACM-06 - User Login and Onboarding** (`tests/pages/acm-06-user-login-and-onboarding`)
   - First-time password change enforcement, invalid credentials rejection, logout and session expiration.
7. **ACM-07 - Official Correspondence** (`tests/pages/acm-07-official-correspondence`)
   - Registering incoming & outgoing correspondence, auto reference numbering (YYYY/N/I and YYYY/N/O), drafts, attachments, confidentiality flag.
8. **ACM-08 - External Intake and Archiving** (`tests/pages/acm-08-external-intake-and-archiving`)
   - Mail intake into unclassified list, classification and routing to sub-entities, archiving with indexing template validation.
9. **ACM-09 - Access and Visibility Control** (`tests/pages/acm-09-access-and-visibility-control`)
   - Confidentiality rules: mail directed to specific person vs sub-entity vs main entity, admin view boundaries.
10. **ACM-10 - Internal Mail** (`tests/pages/acm-10-internal-mail`)
    - Secure employee-to-employee internal messaging, privacy enforcement, drafts, mail filters.
11. **ACM-11 - Registry External Sending** (`tests/pages/acm-11-registry-external-sending`)
    - Outgoing requests routed through the Registry, external email dispatch with attachments.
12. **ACM-12 - Register Lists and Search** (`tests/pages/acm-12-register-lists-and-search`)
    - Search by subject and body (3-char rule), filter/sort, read/unread counters, spam and trash management.
13. **ACM-13 - Tasks Management** (`tests/pages/acm-13-tasks-management`)
    - Task creation, correspondence linking, lifecycle progression (New -> In Progress -> Completed), rejection, overdue flag, out-of-office delegation.
14. **ACM-14 - Dashboard and Notifications** (`tests/pages/acm-14-dashboard-and-notifications`)
    - Real-time counters verification, quick actions, global search across all modules, in-portal notifications.
15. **ACM-15 - Reports and Audit Log** (`tests/pages/acm-15-reports-and-audit-log`)
    - Incoming/outgoing registers, PDF export, date validation, daily summary email, audit log of all user events.

---

## Safety & Operating Rules

1. **Safety:** Never commit passwords or tokens. `.env` stays on the local computer.
2. **Data Isolation:** Prefix all test-created entities with `auto-test-` or clear them post-test.
3. **Verdicts & Reviews:** Reviewers submit verdicts (`tests/pages/*/review.json`) via the dashboard. Update tests to match confirmed application behavior.
4. **Hand-over Verification:**
   ```bash
   npm run check        # type check + eslint
   npm run test:unit    # verify specs match sheets
   npm run story:check  # check story test coverage
   npx playwright test --list
   ```
