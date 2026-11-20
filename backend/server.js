/* ═══════════════════════════════════════
   VORTEK — Backend (Node.js + Express)
   Banco: SQLite via sql.js (puro JS)
═══════════════════════════════════════ */
require('dotenv').config();
const express     = require('express');
const session     = require('express-session');
const helmet      = require('helmet');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const { getDb }   = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Segurança ── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Rate limiting ── */
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10,
  message: { message: 'Muitas tentativas. Tente em 15 minutos.' }
}));

/* ── Sessão segura ── */
app.use(session({
  secret: process.env.SESSION_SECRET || 'vortek_dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

/* ── Arquivos estáticos (site público) ── */
app.use(express.static(path.join(__dirname, '..')));

/* ── Rotas da API ── */
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/projetos',   require('./routes/projetos'));
app.use('/api/arquivos',   require('./routes/arquivos'));
app.use('/api/financeiro', require('./routes/financeiro'));
app.use('/api/suporte',    require('./routes/suporte'));
app.use('/api/perfil',     require('./routes/perfil'));

/* ── Health check ── */
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

/* ── Inicializa banco e sobe servidor ── */
getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅ Vortek rodando em http://localhost:${PORT}`);
    console.log(`📋 Painel do cliente: http://localhost:${PORT}/cliente/login.html\n`);
  });
}).catch(err => {
  console.error('❌ Erro ao inicializar banco:', err);
  process.exit(1);
});
