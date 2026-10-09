(() => {
  'use strict';
  let session = null, csrf = '', selectedId = null;
  const $ = (id) => document.getElementById(id);
  const message = (text, error=false) => { const el=$('message'); el.textContent=text; el.className=`message full ${error?'error':'success'}`; el.hidden=false; };
  const request = async (path, options={}) => {
    const headers = {'Content-Type':'application/json', ...(options.headers||{})};
    if (csrf && options.method && options.method !== 'GET') headers['X-CSRF-Token']=csrf;
    const response = await fetch(path,{...options,headers});
    const body = await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
    return body;
  };
  const formData = (form) => Object.fromEntries(new FormData(form));
  const fill = (form, record) => { for(const field of form.elements){ if(field.name && record[field.name] !== undefined && field.type !== 'checkbox') field.value=record[field.name] ?? ''; } };
  async function restore(){ const state=await request('/api/session'); session=state.user; csrf=state.csrf||''; renderSession(); if(session) await loadRecords(); }
  function renderSession(){
    $('auth-panel').hidden=!!session; $('session-panel').hidden=!session; $('workspace').hidden=!session;
    if(!session) return;
    $('session-summary').textContent=`${session.display_name} — ${session.role}${session.crew?` (${session.crew})`:''}`;
    document.querySelectorAll('.role-form').forEach(form=>form.hidden=form.dataset.role!==session.role);
  }
  async function loadRecords(){
    const records=await request('/api/requests');
    $('records-body').innerHTML=records.map(r=>`<tr><td><button class="link-button" data-id="${r.id}">${r.id}</button></td><td>${escapeHtml(r.customer_name)}</td><td>${escapeHtml(r.status)}</td><td class="${r.approved?'approved':'needs-approval'}">${r.approved?'Current':'Required'}</td></tr>`).join('') || '<tr><td colspan="4">No records are available for this account.</td></tr>';
    if(selectedId && records.some(r=>r.id===selectedId)) await openRecord(selectedId); else {selectedId=null;$('record-panel').hidden=true;}
  }
  async function openRecord(id){
    const r=await request(`/api/requests/${id}`); selectedId=id; $('record-panel').hidden=false; $('record-title').textContent=`Work Order ${r.id.replace('SR','WO')}`;
    const fields=[['Customer',r.customer_name],['Service',r.service],['Description',r.description],['Status',r.status],['Assigned crew',r.crew],['Scheduled date',r.scheduled_date||'Not scheduled'],['Arborist scope',r.work_scope||'Not recorded'],['Sales method',r.work_method||'Not recorded'],['Agreed scope',r.agreed_scope||'Not recorded'],['Price',r.negotiated_price==null?'Not recorded':`$${Number(r.negotiated_price).toFixed(2)}`],['Client confirmation',r.approved?`Current — ${r.approved_by} at ${new Date(r.approved_at).toLocaleString()}`:'Required'],['Crew notes',r.crew_notes||'Not recorded'],['Discrepancies',r.discrepancies||'None recorded']];
    $('record-summary').innerHTML=fields.map(([k,v])=>`<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('');
    fill($('scope-form'),r); fill($('sales-form'),r); fill($('schedule-form'),r); fill($('crew-form'),r);
    $('activity').innerHTML=r.activity.map(a=>`<li><strong>${escapeHtml(a.actor)}</strong> — ${escapeHtml(a.action)}<br><small>${new Date(a.at).toLocaleString()}</small></li>`).join('');
  }
  const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function submitRole(form, action, transform=x=>x){
    if(!selectedId) return message('Select a record first.',true);
    try{await request(`/api/requests/${selectedId}/${action}`,{method:'PATCH',body:JSON.stringify(transform(formData(form)))});message(`${action[0].toUpperCase()+action.slice(1)} update saved.`);await loadRecords();}catch(e){message(e.message,true);}
  }
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();try{const state=await request('/api/login',{method:'POST',body:JSON.stringify(formData(e.currentTarget))});session=state.user;csrf=state.csrf;renderSession();message(`Signed in as ${session.display_name}.`);await loadRecords();}catch(err){message(err.message,true);}});
  $('logout').addEventListener('click',async()=>{try{await request('/api/logout',{method:'POST',body:'{}'});}finally{session=null;csrf='';selectedId=null;renderSession();$('record-panel').hidden=true;message('Signed out.');}});
  $('request-form').addEventListener('submit',async e=>{e.preventDefault();try{const result=await request('/api/requests',{method:'POST',body:JSON.stringify(formData(e.currentTarget))});e.currentTarget.reset();message(`${result.id} was saved in the central database.`);if(session)await loadRecords();}catch(err){message(err.message,true);}});
  $('records-body').addEventListener('click',e=>{const button=e.target.closest('[data-id]');if(button)openRecord(button.dataset.id).catch(err=>message(err.message,true));});
  $('refresh').addEventListener('click',()=>loadRecords().catch(err=>message(err.message,true)));
  $('scope-form').addEventListener('submit',e=>{e.preventDefault();submitRole(e.currentTarget,'scope');});
  $('sales-form').addEventListener('submit',e=>{e.preventDefault();submitRole(e.currentTarget,'sales');});
  $('approval-form').addEventListener('submit',e=>{e.preventDefault();submitRole(e.currentTarget,'approval',()=>({confirm:e.currentTarget.elements.confirm.checked}));});
  $('schedule-form').addEventListener('submit',e=>{e.preventDefault();submitRole(e.currentTarget,'schedule');});
  $('crew-form').addEventListener('submit',e=>{e.preventDefault();submitRole(e.currentTarget,'crew');});
  restore().catch(err=>message(err.message,true));
})();
