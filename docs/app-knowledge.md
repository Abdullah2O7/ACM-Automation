# ACM Application Knowledge

Key technical and domain knowledge about **ACM — نظام الأرشيف والمراسلات** (`https://test-acm.3segypt.com/`).

---

## 1. Architecture & Frontend
- **SPA Framework:** Modern React/Vite application rendered into `<div id="root"></div>`.
- **Direction & Language:** Default language is Arabic (`ar`) with Right-to-Left (`rtl`) layout.
- **Language Switch:** Controlled via UI; stores `acm.lang` in `localStorage` (`ar` / `en`).
- **Theme:** Supports dark/light mode via `acm.theme` in `localStorage`.

## 2. Authentication & Security
- Standard web session / token-based authentication.
- Newly created users have OTP disabled by default when created by the admin.
- "Must change password" flag triggers forced password reset upon first login.
- Inactive / deactivated users are immediately blocked from logging in.

## 3. Data Entities
- **Hierarchy:** Main Entity (e.g., "النادي الأهلي") -> Sub-entities (e.g., "إدارة الكرة", "إدارة العضويات", "الإدارة المالية") -> Persons with unique emails.
- **External Entities:** Dedicated entity type for external parties (e.g., "الاتحاد المصري لكرة القدم").
- **Auto Reference Number Formats:**
  - Incoming Correspondence: `YYYY/N/I` (e.g. `2026/1/I`)
  - Outgoing Correspondence: `YYYY/N/O` (e.g. `2026/1/O`)
  - Archive References: `YYYY/N/A` (e.g. `2026/1/A`)

## 4. Archive & Indexing Templates
- Archive Folders: Nested hierarchies with live document count badges.
- Indexing Templates: Can be bound to specific archive folders.
- Index Fields: Supports Text, Number, Date, List (dropdown), and Boolean (نعم/لا) with mandatory and optional enforcement.

## 5. Test Data Lifecycle
- All runtime test data should be prefixed with `auto-test-`.
- Clean up test records after test suite completion to maintain pristine system state.
