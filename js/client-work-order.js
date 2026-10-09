(() => {
    const id = new URLSearchParams(location.search).get('request');
    let baseline, recordKey;
    const read = () => {
        const raw = localStorage.getItem(TTOMS_KEY);
        if (!raw) throw Error('Work order unavailable.');
        const data = JSON.parse(raw),
            r = data.requests.find((x) => x.id === id);
        if (!r) throw Error('Work order unavailable.');
        return { data, r };
    };
    function render(r) {
        const t = clientAgreement.terms(r);
        baseline = clientAgreement.fingerprint(r);
        recordKey = r.recordKey;
        setText('client-title', `Review Work Order ${r.id.replace('SR', 'WO')}`);
        const fields = [
            ['Customer', t.customer],
            ['Property', t.property],
            ['Service', t.service],
            ['Arborist scope', t.arboristScope],
            ['Site precautions', t.precautions],
            ['Proposed agreed work', t.scope],
            ['Work method and equipment', t.method],
            ['Property-impact expectations', t.impact],
            ['Access arrangements', t.access],
            ['Proposed scope changes for arborist review', t.scopeChanges],
            [
                'Negotiated price (USD)',
                String(t.price).trim() && Number.isFinite(Number(t.price))
                    ? `$${Number(t.price).toFixed(2)}`
                    : 'Not set',
            ],
            ['Work status', r.status],
            ['Scheduled date', r.scheduledDate ? formatDate(r.scheduledDate) : 'To be arranged'],
        ];
        document.getElementById('client-details').innerHTML = fields
            .map(
                ([label, value]) =>
                    `<div><dt>${escapeHtml(label)}</dt><dd class="saved-text">${escapeHtml(value || 'Not recorded yet')}</dd></div>`,
            )
            .join('');
        setText('client-status', clientAgreement.status(r));
        const confirmed = r.clientConfirmation?.fingerprint === baseline;
        document.getElementById('client-confirm-form').hidden =
            !clientAgreement.ready(r) || confirmed;
        setText(
            'client-ready',
            !clientAgreement.ready(r)
                ? 'Confirmation is unavailable until the sales team records the scope, work method, and price for an active work order.'
                : confirmed
                  ? 'Your confirmation is saved. If the work details or price change, we will need your confirmation again.'
                  : 'Confirm below when these details match your discussion with sales.',
        );
    }
    document.addEventListener('DOMContentLoaded', () => {
        try {
            render(read().r);
            document.getElementById('client-content').hidden = false;
        } catch {
            document.getElementById('client-missing').hidden = false;
            return;
        }
        document.getElementById('client-confirm-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (!form.reportValidity()) return;
            try {
                const name = form.elements.name.value.trim();
                if (!name) throw Error('Enter your full name.');
                const { data, r } = read();
                if (r.recordKey !== recordKey || clientAgreement.fingerprint(r) !== baseline) {
                    render(r);
                    form.reset();
                    throw Error(
                        'The work details changed. Review the updated details above before confirming.',
                    );
                }
                if (!clientAgreement.ready(r))
                    throw Error('This work order is not ready for confirmation. Contact sales.');
                if (r.clientConfirmation?.fingerprint === baseline) {
                    render(r);
                    return;
                }
                const at = new Date().toISOString();
                r.clientConfirmation = {
                    name,
                    at,
                    fingerprint: baseline,
                    terms: clientAgreement.terms(r),
                };
                r.clientConfirmationHistory ??= [];
                r.clientConfirmationHistory.push({ ...r.clientConfirmation });
                r.workOrderHistory ??= [];
                r.workOrderHistory.unshift({
                    at,
                    text: `Client ${name} confirmed the work scope, method, and negotiated price of $${Number(r.clientConfirmation.terms.price).toFixed(2)}.`,
                });
                data.activity.unshift(`${r.id} client confirmation recorded`);
                saveData(data);
                render(r);
                form.reset();
                showMessage(
                    'client-message',
                    'Thank you. Your approval of this work and price has been saved.',
                );
            } catch (error) {
                showMessage('client-message', error.message, 'error');
            }
        });
    });
})();
