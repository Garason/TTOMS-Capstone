/* Shared definition of the exact client-facing agreement. No authentication is implied. */
const clientAgreement = {
    terms(r) {
        const a = r.workOrder?.arborist || {},
            s = r.workOrder?.sales || {};
        return {
            recordKey: r.recordKey || '',
            customer: r.name,
            property: r.address,
            service: r.service,
            arboristScope: a.workScope || '',
            precautions: a.precautions || '',
            scope: s.agreedScope || '',
            method: s.workMethod || '',
            impact: s.impactExpectations || '',
            access: s.accessNotes || '',
            price: s.negotiatedPrice ?? '',
            scopeChanges: s.scopeChanges || '',
        };
    },
    fingerprint(r) {
        return JSON.stringify(this.terms(r));
    },
    ready(r) {
        const t = this.terms(r);
        return Boolean(
            t.arboristScope.trim() &&
                t.scope.trim() &&
                t.method.trim() &&
                String(t.price).trim() &&
                Number.isFinite(Number(t.price)) &&
                Number(t.price) >= 0 &&
                r.status !== 'Cancelled',
        );
    },
    status(r) {
        const c = r.clientConfirmation;
        if (!c) return 'Awaiting client confirmation.';
        if (c.fingerprint !== this.fingerprint(r))
            return 'Work details or price changed. Client must review and confirm again.';
        if (r.status === 'Cancelled')
            return 'Work order cancelled. Earlier confirmation is retained in the history.';
        return `Confirmed by ${c.name} on ${new Date(c.at).toLocaleString()} for $${Number(c.terms.price).toFixed(2)}.`;
    },
};
