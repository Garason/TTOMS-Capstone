# Planning Phase Data Dictionary

## Service request
| Field | Purpose |
|---|---|
| id | Unique SR identifier; crew view displays the same number with a WO prefix |
| name, phone, email | Customer contact information |
| address | Service location |
| service | Requested service; Emergency Service is a category only |
| description | Work description and hazards |
| status | Pending Review, Scheduled, In Progress, Delayed, Completed, Cancelled |
| scheduledDate | Planned work date; required for active or completed work |
| crew | Unassigned or Crew A/B/C; required for active or completed work |
| fieldNotes | Most recently saved crew notes |
| created | UTC creation date |

## Shared data
`requests` contains the records above. Legacy `maintenance` data, if present in an existing browser, is ignored by this build. `activity` stores recent demonstration messages. Local storage key: `ttomsPlanningCoreV2`. Accounting and budget settings are absent; the work order includes a negotiated price. Database tables and authenticated user/crew ownership will be designed in later capstone work.

## Shared work-order extension
- `recordKey`: per-record UUID, preventing photos from attaching to a different request if demo IDs are reused after reset.
- `workOrder.sales`: author, updatedAt, treeReferences, observations, accessNotes.
- `workOrder.arborist`: author, updatedAt, priority (Not assessed/Routine/Priority/Urgent), assessment, workScope, precautions.
- `workOrder.crew`: contributor metadata; the main request's status and fieldNotes remain authoritative.
- `workOrderHistory`: entries with at and text for saved contributions.
- IndexedDB `ttomsWorkOrderPhotos`, store `photos`: id, recordKey, stage (sales/arborist/crew), author, treeRef, caption, createdAt, and resized JPEG blob. Photo writes are atomic per upload batch. Historical photo blobs remain in browser storage after a demo text reset but are not attached to reused IDs; clearing site data removes all stored photos.

## Arborist-first workflow fields
`workOrder.arborist.treeReferences` identifies assessed trees. `workOrder.sales` additionally stores negotiatedPrice (nonnegative USD amount), workMethod, impactExpectations, companyResources, agreementStatus (staff discussion status only), agreedScope, and scopeChanges. Legacy customerBudget values are preserved but unused. `workOrder.crew` also stores discrepancies and followUp. Shared status and fieldNotes remain on the parent request. Earlier sales observations are retained rather than reassigned to an arborist. Quick crew updates preserve discrepancy/follow-up fields.

## Client confirmation
`clientConfirmation`: name, at (ISO timestamp), fingerprint (serialized client-facing terms), and terms (the displayed scope, method, impact expectations, price, site and access details, and record key). `clientConfirmationHistory` preserves prior approval snapshots. Confirmation is current only when its fingerprint matches the present agreement. Staff discussion status cannot grant client confirmation. These records do not authenticate identity. No bill, payment, or card data is collected.
