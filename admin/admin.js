const API = `${window.location.origin}/api`;
let selectedClientId = null;
let clients = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const showStatus = (message, type = '') => {
  const el = document.getElementById('page-status');
  el.textContent = message;
  el.className = `status ${type}`;
};
const token = () => sessionStorage.getItem('vortek_access_token');

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionStorage.removeItem('vortek_access_token');
    window.location.href = '../cliente/login.html';
    throw new Error('Entre novamente para continuar.');
  }
  if (!response.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
  return data;
}

async function boot() {
  try {
    const user = await api('/auth/me');
    if (!user.isAdmin) {
      document.getElementById('access-status').textContent = 'Esta área é exclusiva do administrador.';
      document.getElementById('access-status').className = 'status error';
      return;
    }
    document.getElementById('access-status').textContent = '';
    document.getElementById('admin-app').classList.remove('hidden');
    await Promise.all([loadOverview(), loadClients()]);
  } catch (error) {
    if (token()) {
      document.getElementById('access-status').textContent = error.message;
      document.getElementById('access-status').className = 'status error';
    }
  }
}

async function loadOverview() {
  const m = await api('/admin/overview');
  document.getElementById('m-active').textContent = m.ativos;
  document.getElementById('m-clients').textContent = m.clientes;
  document.getElementById('m-projects').textContent = m.projetos;
  document.getElementById('m-open').textContent = `${m.cobrancas_pendentes} · ${m.tickets_abertos}`;
}

async function loadClients(search = '') {
  clients = await api(`/admin/clientes?busca=${encodeURIComponent(search)}`);
  const list = document.getElementById('client-list');
  if (!clients.length) {
    list.innerHTML = '<div class="empty">Nenhum cliente encontrado.</div>';
    return;
  }
  list.innerHTML = clients.map(c => `
    <button class="client-item ${Number(c.id) === Number(selectedClientId) ? 'selected' : ''}" data-client-id="${Number(c.id)}" type="button">
      <strong>${esc(c.nome)}</strong><span>${esc(c.email)}</span>
      <span style="float:right" class="pill ${c.ativo ? '' : 'off'}">${c.ativo ? 'Ativo' : 'Inativo'}</span>
      <div class="muted" style="margin-top:5px">${c.projetos} projetos · ${c.tickets} chamados</div>
    </button>
  `).join('');
}

async function selectClient(id) {
  selectedClientId = Number(id);
  await loadClients(document.getElementById('search').value.trim());
  const c = await api(`/admin/clientes/${selectedClientId}`);
  document.getElementById('no-client').classList.add('hidden');
  document.getElementById('client-detail').classList.remove('hidden');
  document.getElementById('detail-name').textContent = c.nome;
  document.getElementById('detail-meta').textContent = `${c.email} · Cliente desde ${c.criado_em || '—'}`;
  const pill = document.getElementById('active-pill');
  pill.textContent = c.ativo ? 'Ativo' : 'Inativo';
  pill.className = `pill ${c.ativo ? '' : 'off'}`;
  document.getElementById('client-name').value = c.nome || '';
  document.getElementById('client-email').value = c.email || '';
  document.getElementById('client-phone').value = c.telefone || '';
  document.getElementById('client-active').checked = Boolean(c.ativo);
  renderProjects(c.projetos || []);
  renderCharges(c.cobrancas || []);
  renderTickets(c.tickets || []);
  renderFiles(c.arquivos || []);
}

function statusOptions(values, current) {
  return values.map(s => `<option value="${esc(s)}" ${s === current ? 'selected' : ''}>${esc(s)}</option>`).join('');
}

function renderProjects(items) {
  const el = document.getElementById('project-list');
  if (!items.length) { el.innerHTML = '<div class="empty">Nenhum projeto cadastrado.</div>'; return; }
  el.innerHTML = items.map(p => `
    <div class="project-row">
      <form class="project-edit" data-project-id="${Number(p.id)}">
        <div class="field"><label>Projeto</label><input name="nome" value="${esc(p.nome)}" maxlength="150" required/></div>
        <div class="field"><label>Tipo</label><input name="tipo" value="${esc(p.tipo)}" maxlength="80"/></div>
        <div class="field"><label>Status</label><select name="status">${statusOptions(['Em andamento','Pausado','Concluído','Cancelado'],p.status)}</select></div>
        <div class="field"><label>Progresso (%)</label><input name="progresso" type="number" min="0" max="100" value="${Number(p.progresso)||0}" required/></div>
        <button class="btn small" type="submit">Salvar</button>
      </form>
    </div>`).join('');
}

function renderCharges(items) {
  const el = document.getElementById('charge-list');
  if (!items.length) { el.innerHTML = '<div class="empty">Nenhuma cobrança cadastrada.</div>'; return; }
  el.innerHTML = items.map(c => `
    <div class="charge-row">
      <div class="row-title">${esc(c.descricao)} · R$ ${Number(c.valor).toFixed(2).replace('.',',')} ${c.projeto ? `<span class="muted">· ${esc(c.projeto)}</span>` : ''}</div>
      <form class="charge-edit" data-charge-id="${Number(c.id)}">
        <div class="field"><label>Vencimento</label><input value="${esc(c.vencimento || '—')}" readonly/></div>
        <div class="field"><label>Status</label><select name="status">${statusOptions(['Pendente','Pago','Atrasado','Cancelado'],c.status)}</select></div>
        <button class="btn small" type="submit">Salvar status</button>
      </form>
    </div>`).join('');
}

function renderTickets(items) {
  const el = document.getElementById('ticket-list');
  if (!items.length) { el.innerHTML = '<div class="empty">Nenhum chamado cadastrado.</div>'; return; }
  el.innerHTML = items.map(t => `
    <div class="ticket-row">
      <div class="row-title">${esc(t.titulo)}</div>
      <p class="muted" style="white-space:pre-wrap;margin-bottom:10px">${esc(t.mensagem)}</p>
      <p class="muted" style="margin-bottom:10px">Última mensagem: ${esc(t.ultima_mensagem || '—')}</p>
      <form class="ticket-edit" data-ticket-id="${Number(t.id)}">
        <div class="field"><label>Status</label><select name="status">${statusOptions(['Aberto','Em andamento','Respondido','Fechado'],t.status)}</select></div>
        <div class="reply field"><label>Resposta ao cliente (opcional)</label><textarea name="resposta" maxlength="5000" placeholder="Escreva uma resposta"></textarea></div>
        <button class="btn small" type="submit">Salvar / responder</button>
      </form>
    </div>`).join('');
}

function renderFiles(items) {
  const el = document.getElementById('file-list');
  if (!items.length) { el.innerHTML = '<div class="empty">Nenhum arquivo cadastrado.</div>'; return; }
  el.innerHTML = items.map(f => `
    <div class="file-row"><strong>${esc(f.nome)}</strong><div class="muted">${esc(f.projeto || '—')} · ${esc(f.tipo || 'Arquivo')} · ${Number(f.tamanho || 0)} bytes</div></div>
  `).join('');
}

document.getElementById('client-list').addEventListener('click', e => {
  const button = e.target.closest('[data-client-id]');
  if (button) selectClient(button.dataset.clientId).catch(err => showStatus(err.message,'error'));
});
let searchTimer;
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadClients(document.getElementById('search').value.trim()).catch(err => showStatus(err.message,'error')), 180);
});
document.getElementById('client-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api(`/admin/clientes/${selectedClientId}`, { method:'PUT', body:JSON.stringify({
      nome:document.getElementById('client-name').value,
      email:document.getElementById('client-email').value,
      telefone:document.getElementById('client-phone').value,
      ativo:document.getElementById('client-active').checked
    })});
    showStatus('Dados do cliente atualizados.','success');
    await selectClient(selectedClientId); await loadOverview();
  } catch(err) { showStatus(err.message,'error'); }
});
document.getElementById('project-form').addEventListener('submit', async e => {
  e.preventDefault(); if (!selectedClientId) return;
  try {
    await api(`/admin/clientes/${selectedClientId}/projetos`, {method:'POST',body:JSON.stringify({
      nome:document.getElementById('project-name').value,
      tipo:document.getElementById('project-type').value,
      progresso:Number(document.getElementById('project-progress').value)
    })});
    e.currentTarget.reset(); document.getElementById('project-progress').value='0';
    showStatus('Projeto adicionado.','success'); await selectClient(selectedClientId); await loadOverview();
  } catch(err) { showStatus(err.message,'error'); }
});
document.getElementById('project-list').addEventListener('submit', async e => {
  const form=e.target.closest('.project-edit'); if(!form)return; e.preventDefault();
  try {
    const d=Object.fromEntries(new FormData(form).entries()); d.progresso=Number(d.progresso);
    await api(`/admin/projetos/${form.dataset.projectId}`,{method:'PUT',body:JSON.stringify(d)});
    showStatus('Projeto atualizado.','success'); await selectClient(selectedClientId); await loadOverview();
  } catch(err) { showStatus(err.message,'error'); }
});
document.getElementById('charge-form').addEventListener('submit', async e => {
  e.preventDefault(); if (!selectedClientId)return;
  try {
    await api(`/admin/clientes/${selectedClientId}/cobrancas`,{method:'POST',body:JSON.stringify({
      descricao:document.getElementById('charge-desc').value,
      valor:Number(document.getElementById('charge-value').value),
      vencimento:document.getElementById('charge-date').value
    })});
    e.currentTarget.reset(); showStatus('Cobrança adicionada.','success'); await selectClient(selectedClientId); await loadOverview();
  } catch(err) { showStatus(err.message,'error'); }
});
document.getElementById('charge-list').addEventListener('submit', async e => {
  const form=e.target.closest('.charge-edit'); if(!form)return; e.preventDefault();
  try {
    const d=Object.fromEntries(new FormData(form).entries());
    await api(`/admin/cobrancas/${form.dataset.chargeId}`,{method:'PUT',body:JSON.stringify(d)});
    showStatus('Cobrança atualizada.','success'); await selectClient(selectedClientId); await loadOverview();
  } catch(err) { showStatus(err.message,'error'); }
});
document.getElementById('ticket-list').addEventListener('submit', async e => {
  const form=e.target.closest('.ticket-edit'); if(!form)return; e.preventDefault();
  try {
    const d=Object.fromEntries(new FormData(form).entries());
    await api(`/admin/tickets/${form.dataset.ticketId}`,{method:'PUT',body:JSON.stringify(d)});
    showStatus('Chamado atualizado.','success'); await selectClient(selectedClientId); await loadOverview();
  } catch(err) { showStatus(err.message,'error'); }
});
const dialog=document.getElementById('client-dialog');
document.getElementById('new-client').addEventListener('click',()=>dialog.showModal());
document.getElementById('cancel-create').addEventListener('click',()=>dialog.close());
document.getElementById('create-client-form').addEventListener('submit',async e=>{
  e.preventDefault();
  try {
    const created=await api('/admin/clientes',{method:'POST',body:JSON.stringify({
      nome:document.getElementById('new-name').value,
      email:document.getElementById('new-email').value,
      telefone:document.getElementById('new-phone').value,
      senha:document.getElementById('new-password').value
    })});
    dialog.close(); e.currentTarget.reset(); await loadClients(document.getElementById('search').value.trim()); await selectClient(created.id); await loadOverview();
    showStatus('Cliente criado. Envie a senha inicial ao cliente por um canal seguro.','success');
  } catch(err) { showStatus(err.message,'error'); }
});
document.getElementById('logout').addEventListener('click',async()=>{
  try { await api('/auth/logout',{method:'POST'}); } catch {}
  sessionStorage.removeItem('vortek_access_token');
  window.location.href='../cliente/login.html';
});
boot();
