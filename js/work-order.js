/* Shared work-order prototype.
   Browser storage and role labels are demonstration features, not secure multi-user access. */
(() => {
    'use strict';
    const stages = {
        arborist: {
            title: 'Arborist assessment and scope',
            help: 'First, identify the trees, triage their condition, and define the technical scope of work and precautions.',
            fields: [
                ['treeReferences', 'Tree / location references', 'text'],
                ['priority', 'Triage priority', ['Not assessed', 'Routine', 'Priority', 'Urgent']],
                ['assessment', 'Tree identification, condition, and triage findings', 'textarea'],
                ['workScope', 'Arborist-defined scope of work', 'textarea'],
                ['precautions', 'Site precautions and crew instructions', 'textarea'],
            ],
        },
        sales: {
            title: 'Sales negotiation and agreement',
            help: 'Match the arborist’s scope and the client’s spending and property-impact preferences to available equipment and crews. Record the proposed work method and negotiated price for client confirmation. Scope changes require arborist review.',
            fields: [
                ['workMethod', 'Proposed work method and equipment', 'textarea'],
                [
                    'impactExpectations',
                    'Property-impact expectations and client preferences',
                    'textarea',
                ],
                ['companyResources', 'Available company assets and capacity', 'textarea'],
                ['negotiatedPrice', 'Negotiated price (USD)', 'number'],
                [
                    'agreementStatus',
                    'Sales discussion status (client confirmation recorded separately)',
                    ['Not discussed', 'Under negotiation', 'Agreed', 'Declined'],
                ],
                ['agreedScope', 'Agreed scope of work', 'textarea'],
                ['scopeChanges', 'Scope changes requiring arborist review', 'textarea'],
                ['observations', 'Negotiation notes / earlier sales observations', 'textarea'],
                ['treeReferences', 'Related tree / location references', 'text'],
                ['accessNotes', 'Customer access arrangements', 'textarea'],
            ],
        },
        crew: {
            title: 'Crew execution and discrepancies',
            help: 'Review the arborist’s scope and sales agreement, carry out the assigned work, and report any differences, unexpected site conditions, or work that could not be completed.',
            fields: [
                [
                    'status',
                    'Work status',
                    [
                        'Pending Review',
                        'Scheduled',
                        'In Progress',
                        'Delayed',
                        'Completed',
                        'Cancelled',
                    ],
                ],
                ['fieldNotes', 'Work performed / field notes', 'textarea'],
                [
                    'discrepancies',
                    'Discrepancies from the agreed scope / unexpected conditions',
                    'textarea',
                ],
                ['followUp', 'Follow-up or clarification needed', 'textarea'],
            ],
        },
    };
    const requestId = new URLSearchParams(location.search).get('request');
    let recordKey,
        urls = [],
        dbPromise,
        busy = false;
    const baselines = {};
    const sectionData = (request, stage) =>
        stage === 'crew'
            ? {
                  status: request.status,
                  fieldNotes: request.fieldNotes || '',
                  ...(request.workOrder?.crew || {}),
              }
            : request.workOrder?.[stage] || {};
    // Status and notes always come from the shared request; the quick crew form and this page agree.
    const snapshot = (request, stage) =>
        stage === 'crew'
            ? {
                  ...sectionData(request, stage),
                  status: request.status,
                  fieldNotes: request.fieldNotes || '',
              }
            : sectionData(request, stage);
    const now = () => new Date().toISOString();
    const readableDate = (value) => (value ? new Date(value).toLocaleString() : 'Not recorded');
    function current() {
        const data = loadData(),
            request = data.requests.find((r) => r.id === requestId);
        if (!request || request.recordKey !== recordKey)
            throw new Error(
                'This work order changed or was reset. Return to Office and reopen it.',
            );
        return { data, request };
    }
    function message(text, error = false) {
        showMessage('work-order-message', text, error ? 'error' : 'success');
    }
    function openPhotos() {
        if (!dbPromise)
            dbPromise = new Promise((resolve, reject) => {
                const open = indexedDB.open('ttomsWorkOrderPhotos', 1);
                open.onupgradeneeded = () => {
                    const store = open.result.createObjectStore('photos', { keyPath: 'id' });
                    store.createIndex('recordKey', 'recordKey');
                };
                open.onsuccess = () => resolve(open.result);
                open.onerror = () => {
                    dbPromise = null;
                    reject(new Error('Photo storage is unavailable in this browser.'));
                };
                open.onblocked = () => {
                    dbPromise = null;
                    reject(new Error('Close other TTOMS tabs and retry photo storage.'));
                };
            });
        return dbPromise;
    }
    async function getPhotos() {
        const db = await openPhotos();
        return new Promise((resolve, reject) => {
            const req = db
                .transaction('photos')
                .objectStore('photos')
                .index('recordKey')
                .getAll(recordKey);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(new Error('Saved photos could not be loaded.'));
        });
    }
    async function storePhotos(photos) {
        const db = await openPhotos();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('photos', 'readwrite');
            for (const photo of photos) tx.objectStore('photos').add(photo);
            tx.oncomplete = resolve;
            tx.onerror = () =>
                reject(new Error('Photos could not be saved. Browser storage may be full.'));
            tx.onabort = () =>
                reject(
                    new Error('Photo save was cancelled. No photos from this batch were saved.'),
                );
        });
    }
    async function preparePhoto(file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            throw new Error('Choose JPG, PNG, or WebP photos.');
        if (file.size > 15 * 1024 * 1024) throw new Error('Each photo must be 15 MB or smaller.');
        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch {
            throw new Error('One photo could not be read. Choose a valid JPG, PNG, or WebP image.');
        }
        try {
            const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            if (!blob) throw new Error('The photo could not be prepared for storage.');
            return blob;
        } finally {
            bitmap.close();
        }
    }
    function history(request, text) {
        request.workOrderHistory ??= [];
        request.workOrderHistory.unshift({ at: now(), text });
    }
    function renderSummary(request) {
        setText('work-order-title', `Work Order ${request.id.replace('SR', 'WO')}`);
        setText('work-order-subtitle', `${request.service} · ${request.name}`);
        document.title = `${request.id.replace('SR', 'WO')} | TTOMS`;
        const fields = [
            ['Request', request.id],
            ['Customer', request.name],
            ['Phone', request.phone],
            ['Email', request.email],
            ['Property', request.address],
            ['Service', request.service],
            ['Created', request.created ? formatDate(request.created) : 'Not recorded'],
            ['Assigned crew', request.crew],
            [
                'Scheduled date',
                request.scheduledDate ? formatDate(request.scheduledDate) : 'Awaiting scheduling',
            ],
            ['Status', request.status],
        ];
        document.getElementById('work-order-details').innerHTML = fields
            .map(
                ([k, v]) =>
                    `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v || 'Not provided')}</dd></div>`,
            )
            .join('');
        setText('work-order-description', request.description || 'No description recorded.');
        for (const [stage, definition] of Object.entries(stages)) {
            const saved = snapshot(request, stage);
            document.getElementById(`${stage}-saved`).innerHTML = definition.fields
                .map(
                    ([name, label]) =>
                        `<div><dt>${escapeHtml(label)}</dt><dd class="saved-text">${escapeHtml(saved[name] || 'Not recorded yet')}</dd></div>`,
                )
                .join('');
            setText(
                `${stage}-attribution`,
                saved.author
                    ? `Recorded by ${saved.author} · ${readableDate(saved.updatedAt)}`
                    : 'No contributor recorded yet.',
            );
        }
        setText('client-confirmation-status', clientAgreement.status(request));
        document.getElementById('client-work-order-link').href =
            `client-work-order.html?request=${encodeURIComponent(request.id)}`;
        const entries = request.workOrderHistory || [];
        document.getElementById('work-order-history').innerHTML = entries.length
            ? entries
                  .map(
                      (e) =>
                          `<li><strong>${escapeHtml(readableDate(e.at))}</strong><br>${escapeHtml(e.text)}</li>`,
                  )
                  .join('')
            : '<li>No work-order contributions recorded yet. Existing request details and crew notes appear above.</li>';
    }
    function fillForm(stage, request) {
        const saved = snapshot(request, stage),
            form = document.getElementById(`${stage}-form`);
        baselines[stage] = JSON.stringify(saved);
        for (const field of form.querySelectorAll('[name]'))
            field.value =
                saved[field.name] || (field.tagName === 'SELECT' ? field.options[0].value : '');
    }
    async function renderPhotos() {
        const photos = await getPhotos();
        for (const url of urls) URL.revokeObjectURL(url);
        urls = [];
        for (const stage of Object.keys(stages)) {
            const gallery = document.getElementById(`${stage}-photos`);
            gallery.replaceChildren();
            const items = photos
                .filter((p) => p.stage === stage)
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            if (!items.length) {
                const p = document.createElement('p');
                p.textContent = 'No photos added yet.';
                gallery.append(p);
                continue;
            }
            for (const item of items) {
                const url = URL.createObjectURL(item.blob);
                urls.push(url);
                const figure = document.createElement('figure'),
                    link = document.createElement('a'),
                    img = document.createElement('img'),
                    caption = document.createElement('figcaption');
                link.href = url;
                link.target = '_blank';
                link.rel = 'noopener';
                link.title = 'Open full photo';
                img.src = url;
                img.alt =
                    [item.treeRef, item.caption].filter(Boolean).join(': ') ||
                    `${stages[stage].title} photo`;
                link.append(img);
                caption.textContent = [
                    item.treeRef,
                    item.caption,
                    `By ${item.author}`,
                    readableDate(item.createdAt),
                ]
                    .filter(Boolean)
                    .join(' · ');
                figure.append(link, caption);
                gallery.append(figure);
            }
        }
    }
    function buildSections(request) {
        document.getElementById('work-order-sections').innerHTML = Object.entries(stages)
            .map(
                ([
                    stage,
                    definition,
                ]) => `<section class="panel work-order-section" aria-labelledby="${stage}-title">
      <p class="eyebrow">${stage === 'arborist' ? '1 · Identify, triage, and scope' : stage === 'sales' ? '2 · Negotiate and agree' : '3 · Execute and report'}</p><h3 id="${stage}-title">${definition.title}</h3><p>${definition.help}</p>
      <dl id="${stage}-saved" class="stage-details"></dl><p id="${stage}-attribution" class="attribution"></p>
      <details class="work-order-editor no-print"><summary>Edit ${definition.title.toLowerCase()}</summary>
        <form id="${stage}-form"><div class="full"><label for="${stage}-author">Completed by</label><input id="${stage}-author" name="author" required maxlength="120" placeholder="Name or crew lead"></div>
        ${definition.fields.map(([name, label, type]) => `<div class="full"><label for="${stage}-${name}">${label}</label>${Array.isArray(type) ? `<select id="${stage}-${name}" name="${name}">${type.map((option) => `<option>${option}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea id="${stage}-${name}" name="${name}" rows="4" maxlength="10000" ${['assessment', 'fieldNotes'].includes(name) ? 'required' : ''}></textarea>` : `<input id="${stage}-${name}" name="${name}" type="${type}" ${type === 'number' ? 'min="0" step="0.01"' : 'maxlength="1000" placeholder="For example: T1, beside the driveway"'}>`}</div>`).join('')}
        <div class="full"><button type="submit">Save ${definition.title.toLowerCase()}</button></div></form></details>
      <h4>${definition.title} photos</h4><div id="${stage}-photos" class="photo-gallery"><p>Loading photos…</p></div>
      <details class="work-order-editor no-print"><summary>Add ${stage === 'sales' ? 'sales' : stage === 'arborist' ? 'arborist' : 'crew'} photos</summary>
        <form id="${stage}-photo-form"><div><label for="${stage}-photo-author">Photo contributor</label><input id="${stage}-photo-author" name="author" required maxlength="120"></div>
        <div><label for="${stage}-photo-tree">Tree / location reference</label><input id="${stage}-photo-tree" name="treeRef" required maxlength="200" placeholder="T1, beside the driveway"></div>
        <div class="full"><label for="${stage}-photo-caption">Photo description</label><input id="${stage}-photo-caption" name="caption" required maxlength="1000" placeholder="What does this photo show?"></div>
        <div class="full"><label for="${stage}-photo-files">Photos</label><input id="${stage}-photo-files" type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required aria-describedby="${stage}-photo-help"><p id="${stage}-photo-help">Up to 6 JPG, PNG, or WebP photos per upload, 15 MB each. Demo copies are resized for browser storage. Click a saved photo to open it.</p></div>
        <div class="full"><button type="submit">Save ${stage === 'sales' ? 'sales' : stage === 'arborist' ? 'arborist' : 'crew'} photos</button></div></form></details>
    </section>`,
            )
            .join('');
        for (const stage of Object.keys(stages)) {
            fillForm(stage, request);
            document
                .getElementById(`${stage}-form`)
                .addEventListener('submit', (event) => saveSection(event, stage));
            document
                .getElementById(`${stage}-photo-form`)
                .addEventListener('submit', (event) => savePhotos(event, stage));
        }
    }
    function saveSection(event, stage) {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity() || !validateText(form)) return;
        try {
            const { data, request } = current();
            if (JSON.stringify(snapshot(request, stage)) !== baselines[stage])
                throw new Error(
                    'This section changed in another page. Copy any unsaved notes, then reload to review the latest version before saving.',
                );
            const values = Object.fromEntries(new FormData(form));
            for (const key of Object.keys(values)) values[key] = values[key].trim();
            if (stage === 'crew') {
                if (
                    ['Scheduled', 'In Progress', 'Delayed', 'Completed'].includes(values.status) &&
                    (!request.scheduledDate || request.crew === 'Unassigned')
                )
                    throw new Error(
                        'The office must assign a crew and scheduled date before work can progress. Your draft has not been cleared.',
                    );
                request.status = values.status;
                request.fieldNotes = values.fieldNotes;
            }
            request.workOrder ??= {};
            request.workOrder[stage] = { ...request.workOrder[stage], ...values, updatedAt: now() };
            history(request, `${stages[stage].title} saved by ${values.author}.`);
            data.activity.unshift(
                `${request.id.replace('SR', 'WO')} ${stages[stage].title.toLowerCase()} updated`,
            );
            saveData(data);
            fillForm(stage, request);
            renderSummary(request);
            message(`${stages[stage].title} saved to this work order.`);
        } catch (error) {
            message(error.message, true);
        }
    }
    async function savePhotos(event, stage) {
        event.preventDefault();
        const form = event.currentTarget,
            button = form.querySelector('button');
        if (busy || !form.reportValidity()) return;
        const author = form.elements.author.value.trim(),
            treeRef = form.elements.treeRef.value.trim(),
            caption = form.elements.caption.value.trim(),
            files = [...form.elements.photos.files];
        if (!author || !treeRef || !caption)
            return message(
                'Enter a contributor, tree/location reference, and description for the photos.',
                true,
            );
        if (!files.length || files.length > 6)
            return message('Choose between 1 and 6 photos per upload.', true);
        busy = true;
        button.disabled = true;
        button.textContent = 'Saving photos…';
        let committed = false;
        try {
            current();
            const prepared = [];
            for (const file of files)
                prepared.push({
                    id: crypto.randomUUID(),
                    recordKey,
                    stage,
                    author,
                    treeRef,
                    caption,
                    createdAt: now(),
                    blob: await preparePhoto(file),
                });
            current();
            await storePhotos(prepared);
            committed = true;
            form.reset();
            const { data, request } = current();
            history(
                request,
                `${prepared.length} ${stage} photo(s) added by ${author} for ${treeRef}.`,
            );
            data.activity.unshift(`${request.id.replace('SR', 'WO')} ${stage} photos added`);
            saveData(data);
            renderSummary(request);
            await renderPhotos();
            message(
                `${prepared.length} photo(s) saved under ${stages[stage].title.toLowerCase()}.`,
            );
        } catch (error) {
            message(
                committed
                    ? 'Photos were saved, but the history or display could not be refreshed. Reload to review them before uploading again.'
                    : error.message,
                true,
            );
        } finally {
            busy = false;
            button.disabled = false;
            button.textContent = `Save ${stage} photos`;
        }
    }
    function init() {
        try {
            const data = loadData(),
                request = data.requests.find((r) => r.id === requestId);
            if (!request) {
                document.getElementById('work-order-missing').hidden = false;
                return;
            }
            if (!request.recordKey) {
                request.recordKey = crypto.randomUUID();
                saveData(data);
            }
            recordKey = request.recordKey;
            buildSections(request);
            renderSummary(request);
            document.getElementById('work-order-content').hidden = false;
            renderPhotos().catch((error) => {
                for (const stage of Object.keys(stages))
                    setText(
                        `${stage}-photos`,
                        'Photo storage is unavailable. Saved text can still be used.',
                    );
                message(error.message, true);
            });
            document
                .getElementById('print-work-order')
                .addEventListener('click', () => window.print());
            window.addEventListener('beforeunload', (event) => {
                const dirty =
                    busy ||
                    Object.keys(stages).some((stage) => {
                        const form = document.getElementById(`${stage}-form`),
                            saved = JSON.parse(baselines[stage]);
                        return [...form.querySelectorAll('[name]')].some(
                            (field) =>
                                field.value !==
                                (saved[field.name] ||
                                    (field.tagName === 'SELECT' ? field.options[0].value : '')),
                        );
                    });
                if (dirty) {
                    event.preventDefault();
                    event.returnValue = '';
                }
            });
        } catch (error) {
            document.getElementById('work-order-missing').hidden = false;
        }
    }
    document.addEventListener('DOMContentLoaded', init);
})();
