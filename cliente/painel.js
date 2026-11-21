/* ═══════════════════════════════════════
   VORTEK — painel.js
   Lógica compartilhada do painel do cliente
═══════════════════════════════════════ */

const REDIRECTING_FROM_PAGES = window.location.hostname === 'gabrielaguiar17.github.io';
if (REDIRECTING_FROM_PAGES) {
  const path = window.location.pathname.replace(/^\/Vortek(?=\/|$)/, '');
  window.location.replace(`https://vortek-production-d724da53.up.railway.app${path}${window.location.search}${window.location.hash}`);
}

const API = 'https://vortek-production-d724da53.up.railway.app/api';

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options = {}) => {
  const requestUrl = typeof input === 'string' ? input : input.url;
  if (typeof requestUrl !== 'string' || !requestUrl.startsWith(API)) {
    return nativeFetch(input, options);
  }
  const token = sessionStorage.getItem('vortek_access_token');
  if (!token) return nativeFetch(input, options);
  const sourceHeaders = options.headers || (input instanceof Request ? input.headers : undefined);
  const headers = new Headers(sourceHeaders);
  headers.set('Authorization', `Bearer ${token}`);
  return nativeFetch(input, { ...options, headers, credentials: 'omit' });
};

/* ── Verifica autenticação ao carregar ── */
async function checkAuth() {
  if (REDIRECTING_FROM_PAGES) return null;
  try {
    const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
    if (!res.ok) { sessionStorage.removeItem('vortek_access_token'); throw new Error('Não autenticado'); }
    const user = await res.json();
    return user;
  } catch {
    sessionStorage.removeItem('vortek_access_token');
    window.location.href = new URL('../login.html', window.location.href).href;
    return null;
  }
}

/* ── Logout ── */
async function logout() {
  try { await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch {}
  sessionStorage.removeItem('vortek_access_token');
  window.location.href = new URL('../login.html', window.location.href).href;
}

/* ── Popula header com dados do usuário ── */
function populateUser(user) {
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  const greetEl  = document.getElementById('greeting-name');
  const firstName = user.nome?.split(' ')[0] || 'Cliente';
  if (nameEl)   nameEl.textContent   = user.nome || 'Cliente';
  if (avatarEl) avatarEl.textContent = firstName[0].toUpperCase();
  if (greetEl)  greetEl.textContent  = firstName;
}

/* ── Carrega dashboard ── */
async function loadDashboard() {
  try {
    const [statsRes, projetosRes, ativRes] = await Promise.all([
      fetch(`${API}/dashboard/stats`,     { credentials: 'include' }),
      fetch(`${API}/projetos?limit=3`,    { credentials: 'include' }),
      fetch(`${API}/dashboard/atividades`,{ credentials: 'include' }),
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      setEl('stat-projetos',  stats.projetos  ?? '0');
      setEl('stat-progresso', stats.progresso ? `${stats.progresso}%` : '0%');
      setEl('stat-arquivos',  stats.arquivos  ?? '0');
      setEl('stat-tickets',   stats.tickets   ?? '0');
    }

    if (projetosRes.ok) {
      const projetos = await projetosRes.json();
      renderProjetos(projetos, 'projetos-list');
    }

    if (ativRes.ok) {
      const atividades = await ativRes.json();
      renderAtividades(atividades);
    }
  } catch (e) {
    console.error('Erro ao carregar dashboard:', e);
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderProjetos(projetos, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!projetos.length) {
    el.innerHTML = `<div class="empty-state"><p>Nenhum projeto encontrado.</p></div>`;
    return;
  }
  el.innerHTML = projetos.map(p => `
    <div class="projeto-item">
      <div class="projeto-info">
        <div class="projeto-nome">${p.nome}</div>
        <div class="projeto-tipo">${p.tipo}</div>
      </div>
      <div class="projeto-progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${p.progresso}%"></div></div>
        <div class="progress-label">${p.progresso}%</div>
      </div>
      <span class="status-badge status-${p.status.toLowerCase().replace(' ','-')}">${p.status}</span>
    </div>
  `).join('');
}

function renderAtividades(atividades) {
  const el = document.getElementById('atividades-list');
  if (!el) return;
  if (!atividades.length) {
    el.innerHTML = `<div class="empty-state"><p>Nenhuma atividade recente.</p></div>`;
    return;
  }
  el.innerHTML = atividades.map(a => `
    <div class="atividade-item">
      <div class="ativ-dot"></div>
      <div>
        <div class="ativ-texto">${a.texto}</div>
        <div class="ativ-data">${a.data}</div>
      </div>
    </div>
  `).join('');
}

/* ── Menu mobile ── */
function setupMenu() {
  const toggle  = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

/* ── Logout button ── */
function setupLogout() {
  const btn = document.getElementById('btn-logout');
  if (btn) btn.addEventListener('click', logout);
}

/* ── Init de cada página ── */
async function loadPage(page) {
  const user = await checkAuth();
  if (!user) return;
  populateUser(user);
  setupMenu();
  setupLogout();

  if (page === 'dashboard') await loadDashboard();
}
