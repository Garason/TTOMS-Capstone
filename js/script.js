/* TTOMS Planning Phase functional prototype - Andrew Garason, September 2026. */
const TTOMS_KEY = 'ttomsPlanningCoreV2';
const TTOMS_SEED = {
    requests: [
        {
            id: 'SR-1045',
            name: 'James Miller',
            phone: '555-0145',
            email: 'james@example.com',
            address: '114 Oak Lane',
            service: 'Tree Removal',
            description: 'Large dead oak near driveway.',
            status: 'Scheduled',
            scheduledDate: '2026-09-03',
            crew: 'Crew A',
            created: '2026-08-30',
        },
        {
            id: 'SR-1046',
            name: 'Sarah Johnson',
            phone: '555-0146',
            email: 'sarah@example.com',
            address: '83 Pine Street',
            service: 'Storm Cleanup',
            description: 'Broken limbs after storm.',
            status: 'In Progress',
            scheduledDate: '2026-09-01',
            crew: 'Crew B',
            created: '2026-08-31',
        },
        {
            id: 'SR-1047',
            name: 'Lee County Office',
            phone: '555-0147',
            email: 'facilities@example.gov',
            address: '200 Civic Center Drive',
            service: 'Tree Trimming',
            description: 'Prune branches above parking lot.',
            status: 'Pending Review',
            scheduledDate: '',
            crew: 'Unassigned',
            created: '2026-09-01',
        },
    ],
    activity: ['Planning Phase data store initialized'],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
function loadData() {
    const saved = localStorage.getItem(TTOMS_KEY);
    if (!saved) {
        saveData(TTOMS_SEED);
        return clone(TTOMS_SEED);
    }
    const data = JSON.parse(saved);
    if (!Array.isArray(data.requests) || !Array.isArray(data.activity))
        throw new Error(
            'Saved demonstration data is invalid. Export or inspect browser storage before resetting it.',
        );
    return data;
}
function saveData(data) {
    localStorage.setItem(TTOMS_KEY, JSON.stringify(data));
}
function escapeHtml(value = '') {
    return String(value).replace(
        /[&<>'"]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c],
    );
}
function formatDate(value) {
    return value
        ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : 'Not Scheduled';
}
function nextId(prefix, items) {
    const max = items.reduce((n, item) => Math.max(n, Number(item.id.split('-')[1]) || 0), 0);
    return `${prefix}-${max + 1}`;
}
function showMessage(id, text, kind = 'success') {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
        el.className = `message ${kind}`;
        el.hidden = false;
    }
}
function badge(status) {
    return `<span class="status ${status.toLowerCase().replaceAll(' ', '-')}">${escapeHtml(status)}</span>`;
}
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function initCustomer() {
    const form = document.getElementById('service-request-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const v = Object.fromEntries(new FormData(form));
        if (!validateText(form)) return;
        const data = loadData(),
            id = nextId('SR', data.requests);
        data.requests.push({
            id,
            name: v.name.trim(),
            phone: v.phone.trim(),
            email: v.email.trim(),
            address: v.address.trim(),
            service: v.service,
            description: v.description.trim(),
            status: 'Pending Review',
            scheduledDate: '',
            crew: 'Unassigned',
            created: new Date().toISOString().slice(0, 10),
        });
        data.activity.unshift(`${id} submitted by ${v.name.trim()}`);
        saveData(data);
        form.reset();
        window.location.assign(`thank-you.html?request=${encodeURIComponent(id)}`);
    });
}

function initThankYou() {
    const id = new URLSearchParams(window.location.search).get('request');
    let request;
    try {
        const saved = localStorage.getItem(TTOMS_KEY);
        request = saved && JSON.parse(saved).requests.find((item) => item.id === id);
    } catch {
        request = null;
    }
    if (request) {
        setText('confirmation-request-id', request.id);
        document.getElementById('request-confirmation').hidden = false;
    } else {
        document.title = 'Request Confirmation | Triage Treecare';
        document.getElementById('confirmation-unavailable').hidden = false;
    }
}

function initOffice() {
    const body = document.getElementById('office-requests'),
        header = body.closest('table').querySelector('thead tr');
    header.innerHTML =
        '<th>Request</th><th>Customer</th><th>Service</th><th>Current Status</th><th>Crew</th><th>Date</th><th>Update Status</th>';
    const statuses = [
        'Pending Review',
        'Scheduled',
        'In Progress',
        'Delayed',
        'Completed',
        'Cancelled',
    ];
    const render = () => {
        const data = loadData();
        setText('new-count', data.requests.filter((x) => x.status === 'Pending Review').length);
        setText(
            'open-count',
            data.requests.filter((x) => !['Completed', 'Cancelled'].includes(x.status)).length,
        );
        setText(
            'crew-count',
            new Set(
                data.requests
                    .filter(
                        (x) =>
                            x.crew !== 'Unassigned' &&
                            !['Completed', 'Cancelled'].includes(x.status),
                    )
                    .map((x) => x.crew),
            ).size,
        );
        setText('completed-count', data.requests.filter((x) => x.status === 'Completed').length);
        body.innerHTML = data.requests
            .slice()
            .reverse()
            .map(
                (r) =>
                    `<tr><td><a href="work-order.html?request=${encodeURIComponent(r.id)}" aria-label="Open work order ${escapeHtml(r.id.replace('SR', 'WO'))}">${escapeHtml(r.id)}</a></td><td><strong>${escapeHtml(r.name)}</strong><br><small>${escapeHtml(r.address)}</small><br><small>Field notes: ${escapeHtml(r.fieldNotes || 'None yet')}</small></td><td>${escapeHtml(r.service)}</td><td>${badge(r.status)}</td><td><select aria-label="Crew for ${r.id}" data-field="crew" data-id="${r.id}">${['Unassigned', 'Crew A', 'Crew B', 'Crew C'].map((v) => `<option ${r.crew === v ? 'selected' : ''}>${v}</option>`).join('')}</select></td><td><input aria-label="Date for ${r.id}" data-field="scheduledDate" data-id="${r.id}" type="date" value="${r.scheduledDate}"></td><td><select aria-label="Status for ${r.id}" data-field="status" data-id="${r.id}">${statuses.map((v) => `<option ${r.status === v ? 'selected' : ''}>${v}</option>`).join('')}</select></td></tr>`,
            )
            .join('');
    };
    body.addEventListener('change', (e) => {
        const c = e.target.closest('[data-id]');
        if (!c) return;
        const data = loadData(),
            r = data.requests.find((x) => x.id === c.dataset.id);
        const candidate = { ...r, [c.dataset.field]: c.value };
        if (
            ['Scheduled', 'In Progress', 'Delayed', 'Completed'].includes(candidate.status) &&
            (!candidate.scheduledDate || candidate.crew === 'Unassigned')
        ) {
            showMessage(
                'office-message',
                'Assign a crew and date before scheduling or progressing a request.',
                'error',
            );
            render();
            return;
        }
        r[c.dataset.field] = c.value;
        if (
            (c.dataset.field === 'crew' || c.dataset.field === 'scheduledDate') &&
            r.crew !== 'Unassigned' &&
            r.scheduledDate &&
            r.status === 'Pending Review'
        )
            r.status = 'Scheduled';
        data.activity.unshift(`${r.id} ${c.dataset.field} updated`);
        saveData(data);
        showMessage('office-message', `${r.id} was updated and saved.`);
        render();
    });
    document.getElementById('reset-demo').addEventListener('click', () => {
        if (confirm('Reset all Planning Phase demonstration data?')) {
            saveData(TTOMS_SEED);
            showMessage('office-message', 'Demonstration data was reset.');
            render();
        }
    });
    render();
}

function initCrew() {
    const body = document.getElementById('crew-work-orders'),
        form = document.getElementById('field-update-form'),
        select = document.getElementById('work-order-select');
    const login = document.getElementById('crew-login-form'),
        panel = document.getElementById('crew-login-panel'),
        dashboard = document.getElementById('crew-dashboard');
    body.addEventListener('click', (event) => {
        const row = event.target.closest('tr[data-work-order]');
        if (row && !event.target.closest('a,button,input,select,textarea'))
            location.assign(`work-order.html?request=${encodeURIComponent(row.dataset.workOrder)}`);
    });
    let selectedCrew = null;
    const belongsToCrew = (r) => r.crew === selectedCrew && r.status !== 'Cancelled';
    const readyForUpdate = (r) =>
        belongsToCrew(r) &&
        r.scheduledDate &&
        ['Scheduled', 'In Progress', 'Delayed', 'Completed'].includes(r.status);
    const render = () => {
        const assigned = loadData().requests.filter(belongsToCrew),
            actionable = assigned.filter(readyForUpdate);
        const previous = select.value;
        setText('crew-awaiting-count', assigned.filter((r) => !readyForUpdate(r)).length);
        setText('job-count', assigned.filter((r) => r.status !== 'Completed').length);
        setText('crew-completed-count', assigned.filter((r) => r.status === 'Completed').length);
        body.innerHTML =
            assigned
                .map(
                    (r) =>
                        `<tr class="work-order-row" data-work-order="${escapeHtml(r.id)}" title="Open full work order"><td><a href="work-order.html?request=${encodeURIComponent(r.id)}">${escapeHtml(r.id.replace('SR', 'WO'))}</a></td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.service)}</td><td>${escapeHtml(r.crew)}</td><td>${r.scheduledDate ? formatDate(r.scheduledDate) : 'Awaiting scheduling'}</td><td>${badge(r.status)}</td></tr>`,
                )
                .join('') ||
            '<tr><td colspan="6">No work orders are assigned to your crew.</td></tr>';
        select.innerHTML = actionable
            .map(
                (r) =>
                    `<option value="${r.id}">${r.id.replace('SR', 'WO')} - ${escapeHtml(r.name)}</option>`,
            )
            .join('');
        if (actionable.some((r) => r.id === previous)) select.value = previous;
        else if (previous) form.reset();
        for (const control of form.elements) control.disabled = actionable.length === 0;
        document.getElementById('crew-scheduling-note').hidden = !assigned.some(
            (r) => !readyForUpdate(r),
        );
    };
    login.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!login.reportValidity()) return;
        const crew = document.getElementById('crew-lead').value;
        if (!['Crew A', 'Crew B', 'Crew C'].includes(crew)) return;
        selectedCrew = crew;
        render();
        setText('crew-dashboard-title', `${crew} Field Operations`);
        setText('crew-login-summary', `Logged in as ${crew} Lead (placeholder)`);
        panel.hidden = true;
        dashboard.hidden = false;
        document.getElementById('crew-dashboard-title').focus();
    });
    window.addEventListener('storage', (e) => {
        if (e.key === TTOMS_KEY && selectedCrew) render();
    });
    window.addEventListener('pageshow', () => {
        if (selectedCrew) render();
    });
    document.getElementById('crew-logout').addEventListener('click', () => {
        selectedCrew = null;
        dashboard.hidden = true;
        panel.hidden = false;
        body.innerHTML = '';
        select.innerHTML = '';
        form.reset();
        login.reset();
        document.getElementById('crew-message').hidden = true;
        document.getElementById('crew-lead').focus();
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedCrew || !form.reportValidity() || !validateText(form)) return;
        const v = Object.fromEntries(new FormData(form)),
            data = loadData(),
            r = data.requests.find((r) => r.id === v.requestId && readyForUpdate(r));
        if (!r) {
            render();
            return showMessage(
                'crew-message',
                'This job is no longer scheduled for your crew. Please select an available job.',
                'error',
            );
        }
        if (!['Scheduled', 'In Progress', 'Delayed', 'Completed'].includes(v.status)) return;
        r.status = v.status;
        r.fieldNotes = v.notes.trim();
        r.workOrder ??= {};
        r.workOrder.crew = {
            ...r.workOrder.crew,
            author: `${selectedCrew} Lead (demo)`,
            updatedAt: new Date().toISOString(),
        };
        r.workOrderHistory ??= [];
        r.workOrderHistory.unshift({
            at: new Date().toISOString(),
            text: `Crew status and notes updated by ${selectedCrew} Lead (demo).`,
        });
        data.activity.unshift(
            `${r.id.replace('SR', 'WO')} marked ${v.status} by ${selectedCrew} Lead (demo)`,
        );
        saveData(data);
        showMessage('crew-message', `${r.id.replace('SR', 'WO')} field update was saved.`);
        form.reset();
        render();
    });
}

function initReports() {
    const data = loadData(),
        statuses = [
            'Pending Review',
            'Scheduled',
            'In Progress',
            'Delayed',
            'Completed',
            'Cancelled',
        ];
    setText('report-total', data.requests.length);
    setText('report-completed', data.requests.filter((x) => x.status === 'Completed').length);
    setText(
        'report-assigned',
        data.requests.filter(
            (x) => x.crew !== 'Unassigned' && !['Completed', 'Cancelled'].includes(x.status),
        ).length,
    );
    setText('report-pending', data.requests.filter((x) => x.status === 'Pending Review').length);
    document.getElementById('status-summary').innerHTML = statuses
        .map((s) => {
            const n = data.requests.filter((x) => x.status === s).length,
                p = data.requests.length ? Math.round((n / data.requests.length) * 100) : 0;
            return `<div class="bar-row"><span>${s}</span><div class="bar"><i style="width:${p}%"></i></div><strong>${n}</strong></div>`;
        })
        .join('');
    document.getElementById('activity-log').innerHTML = data.activity
        .slice(0, 8)
        .map((x) => `<li>${escapeHtml(x)}</li>`)
        .join('');
}
function validateText(form) {
    for (const input of form.querySelectorAll(
        'input[required]:not([type="date"]),textarea[required]',
    )) {
        input.setCustomValidity(input.value.trim() ? '' : 'Enter text, not only spaces.');
        input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
    }
    return form.reportValidity();
}
document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    (
        ({
            customer: initCustomer,
            'thank-you': initThankYou,
            office: initOffice,
            crew: initCrew,
            reports: initReports,
        })[page] || (() => {})
    )();
});
