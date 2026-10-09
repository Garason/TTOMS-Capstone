# Deployment Phase Progress and Remaining Work

| WBS | Work package | Timing / status | Completion evidence |
| --- | --- | --- | --- |
| 1.0 | Planning and browser prototype | Through Week 3 / Complete | Approved baseline; scope revision; intake, work orders, client confirmation, crew updates, operational counts; report and evidence |
| 2.0 | Finalize system design | Week 4 / Complete | SQLite schema, role matrix, API routes, session model, CSRF control, approval fingerprint and scheduling rule |
| 3.0 | Central persistence | Weeks 4–5 / In progress | Server and database persist requests, scope, terms, approvals, scheduling, crew notes and activity; photo persistence and backup/restore remain |
| 4.0 | Identity and permissions | Week 5 / In progress | PBKDF2 passwords, server sessions, staff/client roles, client record filtering, crew assignment filtering and denial tests complete; account administration remains |
| 5.0 | Workflow integration | Week 6 / In progress | Client confirmation and scheduling gate complete; scope/sales changes invalidate approval; crew update rule complete; additional conflict/version checks remain |
| 6.0 | Verification and corrections | Weeks 6–7 / In progress | Automated authentication, CSRF, approval-gate and denial checks pass; broader endpoint, accessibility, browser and photo tests remain |
| 7.0 | Release candidate and UAT | Week 7 / Planned | Clean setup and backup/restore instructions; independent surrogate UAT; fixes and retests |
| 8.0 | Closing delivery | Week 8 / Planned | Final setup check; functioning IS and demonstration; Closing report and separate development ZIP |

Canvas deadlines govern submissions. Current automated and browser checks are developer verification, not independent UAT. Central text persistence, authenticated permissions and approval-enforced scheduling are implemented. Independent UAT, server photo storage, backup/restore, account administration, expanded conflict testing and release hardening remain unfinished. Fleet, invoices, payments, accounting and financial reports remain outside the capstone scope.
