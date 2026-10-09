# Baseline and Capstone Scope

## Approved baseline
Andrew Garason's prior-coursework static interface was approved for reuse by Professor Eric M. Straw. The prior-coursework commits remain visible in this repository's history, and the capstone implementation is added in later commits.

## Current agreed workflow
Customer intake → arborist identification, triage, and technical scope → sales agreement on work method and negotiated price → client review and confirmation → office scheduling and crew assignment → crew execution, discrepancy reporting, and completion.

Sales considers the client's spending preferences and desired property impact together with available company equipment and crews. For example, crane-assisted work and manual crew work may offer different prices and site impacts. The prototype records the proposed method, impact expectations, agreed scope, and one negotiated price. It does not calculate costs or recommend a technically safe method automatically. Scope changes remain subject to arborist review.

## Completed prototype work
Validated intake and separate confirmation page; browser record storage; shared work-order role notes and photos; office assignment/scheduling; placeholder crew selection; crew updates; operational counts; and a dedicated client page to review terms and confirm work and price. Client confirmation records the name, time, and exact displayed agreement. Changed agreement terms require confirmation again. The staff work order displays confirmation status separately from sales discussion status. A client cannot edit staff sections through the client page.

## Peer feedback and scope decisions
Peers recommended prioritizing the workflow, treating fleet as optional only if time allows, and making approval scope and UAT consistent. Fleet is removed. The user clarified that negotiated price and client confirmation belong in the work-order workflow. They remain in scope; accounting, revenue tracking, financial reporting, and payment processing do not. There is no standalone estimate-management module or budget-tracking feature. Previous exclusion of all price/approval functionality is superseded by this clarification.

## Implemented controls and remaining limits
The server-backed component provides central text persistence, authenticated staff permissions, protected client access, crew-assignment filtering, shared data access, validation, and an approval-enforced scheduling gate. Contributor names and client confirmation remain demonstration records rather than verified identities or electronic signatures. Central server photo storage, account administration, independent surrogate UAT, backup and restoration procedures, and release hardening remain Closing Phase work. Fleet, billing, online payments, invoices, revenue, and financial reporting are deferred. No payment details are collected.

## Submission consistency
The Week 3 report and package describe the same workflow. The report includes the current scope, approval/reconfirmation UAT, corrected Week 4–8 plan, and five corresponding screenshots. Submit the Word file separately. See PROGRESS_AND_WBS.md for completed versus planned work.
