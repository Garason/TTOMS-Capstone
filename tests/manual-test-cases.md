# Week 3 Verification and Acceptance Plan

## Developer verification
Isolated browser checks passed for the planning build: required intake validation; separate thank-you navigation; assigned crew filtering and pending assignment visibility; scheduled work prerequisites; shared work-order notes/status; photo persistence and isolation; invalid photo rejection; conflicting-edit rejection; client approval persistence; revised-term reconfirmation; stale client submissions; missing records; operational counts; mobile overflow; print output; reset isolation; and JavaScript errors. These are developer checks, not independent UAT or proof of server security. Earlier superseded budget and fleet behavior is not part of current acceptance.

## Independent surrogate UAT
All tasks remain pending on the final release candidate. A nondeveloper evaluator will use fictional records and authorized test accounts. Each semicolon-separated criterion is recorded separately.

| ID | Evaluator task | Acceptance evidence |
| --- | --- | --- |
| UAT-01 | Submit a customer request. | Required fields enforced; one request saved; unique ID and separate thank-you page displayed. |
| UAT-02 | Record arborist scope and sales terms. | Assessment and tree references saved; photo linked correctly; method and impact expectations saved; price and agreed scope persist; scope changes routed for arborist review. |
| UAT-03 | Review and confirm work as the client, then revise terms. | Correct scope and price displayed; explicit approval saved with terms and time; changed terms require reconfirmation; stale approval rejected. |
| UAT-04 | Schedule and assign the approved work, then complete it as crew. | Current approval required before scheduling; crew and date required; assigned work order opens; notes and discrepancies persist; completion count increases once. |
| UAT-05 | Reopen the work order in a new authorized session. | Central records survive restart; approved terms retained; authorized roles retrieve matching records; authorized photos remain available. |
| UAT-06 | Enter invalid data or attempt conflicting updates. | Clear errors shown; incomplete terms cannot be confirmed; invalid photos rejected; newer records protected; failed saves preserve prior data. |
| UAT-07 | Use client and staff tasks with keyboard and narrow screen. | Controls reachable; focus visible; labels understandable; status feedback available; no overlapping content. |
| UAT-08 | Attempt access outside staff and client permissions. | Signed-out protected access denied; other clients' records denied; other crews' restricted work denied; unauthorized staff edits denied. |

Acceptance: all criteria in UAT-01–05 and UAT-08 pass; at least 90% overall; no unresolved severity-one defects; mean ease-of-use rating at least 4/5. Record build, browser/device, evaluator role/date, expected/actual results, time, errors, assistance, ratings, defects, retests and decision. Login, central persistence, protected client and staff access, and approval-enforced scheduling are implemented in the server-backed component. Independent end-user results remain pending and must be recorded separately from developer verification.
