/* ═══════════════════════════════════════
   VORTEK — Backend (Node.js + Express)
   Área do Cliente
═══════════════════════════════════════ */
require('dotenv').config();
const express     = require('express');
const session     = require('express-session');
const helmet      = require('helmet');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

const authRoutes      = require('./routes/auth');
const projetosRoutes  = require('./routes/projetos');
const arquivosRoutes  = require('./routes/arquivos');
const financeiroRoutes= require('./routes/financeiro');
const suporteRoutes   = require('./routes/suporte');
const dashboardRoutes = require('./routes/dashboard');
const perfilRoutes    = require('./routes/perfil');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Segurança ── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Rate limiting ── */
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { message: 'Muitas tentativas. Tente em 15 minutos.' } });
app.use('/api/', limiter);
app.use('/api/auth/login', loginLimiter);

/* ── Sessão segura ── */
app.use(session({
  secret: process.env.SESSION_SECRET || 'vortek_secret_mude_em_producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

/* ── Arquivos estáticos ── */
app.use(express.static(path.join(__dirname, '..')));

/* ── Rotas da API ── */
app.use('/api/auth',       authRoutes);
app.use('/api/projetos',   projetosRoutes);
app.use('/api/arquivos',   arquivosRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/suporte',    suporteRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/perfil',     perfilRoutes);

/* ── Redireciona SPA ── */
app.get('/cliente/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../cliente', req.params[0] || 'login.html'));
});

/* ── Health check ── */
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.listen(PORT, () => console.log(`✅ Vortek backend rodando na porta ${PORT}`));
module.exports = app;
