# Triage Treecare Operations Management System

Andrew Garason — CSIS 484

## Run the deployment component
1. Extract this ZIP to a folder.
2. With Python 3.10 or newer installed, open a terminal in the extracted project folder and run `python server.py`.
3. Open `http://127.0.0.1:8000/deployment.html` in Chrome or Edge.
4. Use only fictional demonstration data. The first run creates `data/ttoms.sqlite3` and a seed work order.
5. Stop the server with Ctrl+C. To rebuild the demonstration database, stop the server and run `python server.py --reset`.

The deployment server uses only the Python standard library; no package installation is required.

## Demonstration accounts

| Role | Username | Password |
| --- | --- | --- |
| Office | `office` | `OfficeDemo!2026` |
| Arborist | `arborist` | `ArboristDemo!2026` |
| Sales | `sales` | `SalesDemo!2026` |
| Client for Morgan Reed | `client` | `ClientDemo!2026` |
| Crew A | `crew-a` | `CrewDemo!2026` |
| Crew B | `crew-b` | `CrewDemo!2026` |

These credentials are intentionally limited to the local capstone demonstration and must not be reused in another system.

## Implemented server-backed component

The new deployment console provides central SQLite persistence, PBKDF2 password hashing, server-side sessions, CSRF verification, staff/client role checks, protected record retrieval, client confirmation of versioned terms, an approval gate before scheduling, crew-assignment restrictions, and an append-only activity history. Server rules remain effective even when a caller bypasses the browser interface.

Run the automated verification suite from the project folder:

`python -m unittest discover -s tests -p "test_*.py" -v`

The Week 3 planning prototype remains in the package for baseline comparison. Its local-storage pages are not the deployment component and should not be represented as secure multi-user functionality.

The original planning pages still use browser storage. Open `deployment.html` for the server-backed component.

## Current workflow and scope
Customer intake → arborist assessment and technical scope → sales work method and negotiated price → client review and confirmation → office scheduling and crew assignment → crew execution, discrepancies and completion. Shared work orders connect contributor notes, tree references and photos. Reports show operational counts and activity.

Sales records available equipment/capacity and client preferences to explain the agreed method. TTOMS does not automatically select safe equipment or calculate prices. One negotiated price and client approval are included. Fleet, budget tracking, accounting, invoicing, payments, revenue tracking and financial reporting are excluded.

## Demonstrate the workflow
Submit a request through Customer Portal and note its SR number. The successful save loads a separate thank-you page. Open its work order from Office. Save arborist assessment/scope, then sales method, impact expectations, agreed scope and price. Open the client work-order view (or enter the SR number in Customer Portal), review terms and confirm. Return to Office, assign a crew and date. On Crew, select that crew lead and click Login; click the assigned row to open the full work order. Save field notes, discrepancies and completion. Review updated operational counts in Reports.

## Retained planning prototype
Text uses localStorage (`ttomsPlanningCoreV2`); photos use IndexedDB (`ttomsWorkOrderPhotos`). Records persist locally across reloads but are not shared across devices. Photo copies are resized to 1800 pixels maximum. JPG, PNG and WebP uploads are limited to six per batch and 15 MB per original file. Contributor and tree-reference labels correlate images. Keep original photos separately. Print work order prints saved notes and photos.

The limitations in this section apply only to the retained planning pages. The server-backed deployment console provides authenticated roles, protected client access, crew-assignment filtering, and an approval-enforced scheduling gate. It should still be treated as a local capstone demonstration rather than a production service.

## Remaining work through Closing
See `docs/PROGRESS_AND_WBS.md`: Week 4 design; Weeks 4–5 persistence; Week 5 staff/client identity and permissions; Week 6 integration; Weeks 6–7 verification; Week 7 independent surrogate UAT; Week 8 final demonstration and delivery. Central demonstration photo storage, backup/restore and clean setup are required. Production hosting and large-scale operations are deferred. Canvas due dates govern phase submissions.

## Repository contents
Screenshots use isolated fictional test data. Runtime database files and uploaded content are not committed to the repository.

Pages: `index.html`, `customer.html`, `thank-you.html`, `office.html`, `crew.html`, `work-order.html`, `client-work-order.html`, `reports.html`. Scripts and styles are in `js/` and `css/`. `docs/` contains scope, data definitions, progress and evidence; `tests/` contains developer results and the planned independent acceptance tasks.

## Development provenance
Andrew Garason created the prior-coursework static interface, approved for reuse by Professor Eric M. Straw. The capstone adds the functioning browser workflow and server-backed implementation. Developer checks are separate from independent surrogate UAT, which remains pending.
