# ACM Accepted Differences & Business Notes

This file records accepted behaviors, business quirks, and decisions made by the team for **ACM — نظام الأرشيف والمراسلات**.

---

## Story & Test Case Specific Decisions

1. **TC038 - Confidential Correspondence Badge (ACM-07)**
   - *Observation / Note:* The record displays a lock badge (`lock`), but access controls/permission checks may not strictly block all users unless configured in user permissions.
   - *Rule:* Verify that the confidential icon/lock appears for confidential records.

2. **TC040 - Sending Email to Entity Without Email Address (ACM-07)**
   - *Observation / Note:* Known business gap — currently unhandled if an external entity has no email address. Recommendation is to make email mandatory for external entities.
   - *Rule:* If sending fails silently or allows sending without validation, flag as expected discrepancy or mark with note until backend validation is added.

3. **TC042 - Classification vs. Direction (ACM-08)**
   - *Observation / Note:* In ACM terminology, classification ("التصنيف") is tied directly to the Archiving process ("الأرشفة") rather than just the direction ("وارد" / "صادر").
   - *Rule:* Classification workflows link the document to its designated folder and indexing template.

4. **TC062 - External Mail Routing Restrictions (ACM-11)**
   - *Observation / Note:* An internal user can compose an outgoing correspondence, but if they lack permissions for the Incoming/Outgoing register screens, they cannot register it or complete the external dispatch process directly; it must be routed through the Registry.
   - *Rule:* Test that non-Registry users cannot complete external dispatch.
