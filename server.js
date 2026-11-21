/* ═══════════════════════════════════════
   VORTEK — server.js
   Railway entry point
═══════════════════════════════════════ */
require('dotenv').config();
const express    = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const session    = require('express-session');
const helmet     = require('helmet');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const initSqlJs  = require('sql.js');

const app  = express();
app.set('trust proxy', 1);
const accessTokens = new Map();
const PORT = process.env.PORT || 3000;
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://gabrielaguiar17.github.io/Vortek').replace(/\/+$/, '');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const AUTH_PUBLIC_URL = (process.env.AUTH_PUBLIC_URL || 'https://vortek-production-d724da53.up.railway.app').replace(/\/+$/, '');
const DB_PATH = path.join(__dirname, 'backend', 'database', 'vortek.db');

/* ══ DB ══ */
let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
}

function save() {
  if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function q(sql, params = []) {
  if (!db) throw new Error('DB not ready');
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const s = db.prepare(sql);
    s.bind(params);
    const rows = [];
    while (s.step()) rows.push(s.getAsObject());
    s.free();
    return rows;
  }
  db.run(sql, params);
  save();
  return [];
}

function lastId() {
  return db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? null;
}

/* ══ MIDDLEWARE ══ */
function createAccessToken(userId) {
  for (const [existingToken, entry] of accessTokens) {
    if (entry.expiresAt <= Date.now()) accessTokens.delete(existingToken);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  accessTokens.set(token, { userId, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return token;
}

function auth(req, res, next) {
  const bearer = req.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) {
    const entry = accessTokens.get(bearer);
    if (!entry || entry.expiresAt <= Date.now()) {
      accessTokens.delete(bearer);
      return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' });
    }
    try {
      const user = q('SELECT id,nome,email FROM clientes WHERE id=? AND ativo=1', [entry.userId])[0];
      if (!user) {
        accessTokens.delete(bearer);
        return res.status(401).json({ message: 'Não autenticado.' });
      }
      req.session.userId = user.id;
      req.session.nome = user.nome;
      req.session.email = user.email;
      return next();
    } catch(e) {
      console.error('Erro ao validar sessão:', e);
      return res.status(500).json({ message: 'Erro interno.' });
    }
  }
  if (!req.session?.userId) return res.status(401).json({ message: 'Não autenticado.' });
  next();
}

function isAdminEmail(email) {
  return Boolean(ADMIN_EMAIL && String(email || '').trim().toLowerCase() === ADMIN_EMAIL);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_EMAIL) return res.status(503).json({ message: 'Acesso administrativo ainda não configurado.' });
  return auth(req, res, () => {
    if (!isAdminEmail(req.session?.email)) return res.status(403).json({ message: 'Acesso restrito ao administrador.' });
    next();
  });
}

/* ══ APP ══ */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://gabrielaguiar17.github.io',
    'https://vortek-production-d724da53.up.railway.app',
    'http://localhost:3000',
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vortek_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    partitioned: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

/* ══ ROTAS API ══ */

/* Health */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'dev', version: '2.0' });
});

/* Auth */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ message: 'Preencha todos os campos.' });
    const user = q('SELECT * FROM clientes WHERE email=? AND ativo=1', [email])[0];
    if (!user || !bcrypt.compareSync(senha, user.senha_hash))
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    req.session.userId = user.id;
    req.session.nome   = user.nome;
    req.session.email  = user.email;
    res.json({ message: 'Login realizado.', nome: user.nome, token: createAccessToken(user.id), isAdmin: isAdminEmail(user.email) });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Erro interno.' }); }
});

app.post('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false }), (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const confirmarSenha = typeof req.body?.confirmar_senha === 'string' ? req.body.confirmar_senha : '';

  if (ADMIN_EMAIL && email === ADMIN_EMAIL)
    return res.status(403).json({ message: 'Esta conta é reservada ao administrador. Entre pela tela de login.' });
  if (!nome || !email || !senha || !confirmarSenha)
    return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
  if (nome.length < 2 || nome.length > 100)
    return res.status(400).json({ message: 'Informe um nome entre 2 e 100 caracteres.' });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'Informe um e-mail válido.' });
  if (telefone.length > 30)
    return res.status(400).json({ message: 'O telefone deve ter no máximo 30 caracteres.' });
  if (senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72)
    return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres.' });
  if (senha !== confirmarSenha)
    return res.status(400).json({ message: 'As senhas não coincidem.' });

  try {
    if (q('SELECT id FROM clientes WHERE email=?', [email])[0])
      return res.status(409).json({ message: 'Este e-mail já possui uma conta. Entre ou recupere sua senha.' });
    q('INSERT INTO clientes (nome,email,senha_hash,telefone) VALUES (?,?,?,?)',
      [nome, email, bcrypt.hashSync(senha, 12), telefone || null]);
    const user = q('SELECT id,nome,email FROM clientes WHERE email=?', [email])[0];
    req.session.userId = user.id;
    req.session.nome = user.nome;
    req.session.email = user.email;
    res.status(201).json({ message: 'Conta criada.', nome: user.nome, token: createAccessToken(user.id) });
  } catch(e) {
    if (/UNIQUE constraint failed/i.test(e.message || ''))
      return res.status(409).json({ message: 'Este e-mail já possui uma conta. Entre ou recupere sua senha.' });
    console.error('Erro ao criar conta:', e);
    res.status(500).json({ message: 'Não foi possível criar sua conta agora.' });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ id: req.session.userId, nome: req.session.nome, email: req.session.email, isAdmin: isAdminEmail(req.session.email) });
});

app.post('/api/auth/logout', (req, res) => {
  const bearer = req.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) accessTokens.delete(bearer);
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ message: 'Logout.' }); });
});

/* Password recovery */
const passwordRecoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
app.post('/api/auth/forgot-password', passwordRecoveryLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const generic = { message: 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.json(generic);
  const resendReady = Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
  const smtpReady = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!resendReady && !smtpReady) {
    return res.status(503).json({ message: 'A recuperação por e-mail ainda não está configurada. Configure Resend ou SMTP no Railway.' });
  }
  try {
    const user = q('SELECT id,email FROM clientes WHERE lower(email)=? AND ativo=1', [email])[0];
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = Date.now() + 30 * 60 * 1000;
      q('DELETE FROM password_reset_tokens WHERE cliente_id=?', [user.id]);
      q('INSERT INTO password_reset_tokens (cliente_id,token_hash,expires_at) VALUES (?,?,?)', [user.id,tokenHash,expiresAt]);
      const resetUrl = `${AUTH_PUBLIC_URL}/cliente/redefinir-senha.html?token=${encodeURIComponent(token)}`;
      const text = `Recebemos uma solicitação para redefinir sua senha da Vortek. Acesse o link abaixo em até 30 minutos:\n\n${resetUrl}\n\nSe você não solicitou, ignore esta mensagem.`;
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:24px;background:#0a1222;color:#e8edf8;border-radius:14px"><h2>Redefinir senha</h2><p>Recebemos uma solicitação para redefinir sua senha da Vortek.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#4f8ef7;color:white;border-radius:8px;text-decoration:none">Criar nova senha</a></p><p>O link expira em 30 minutos. Se você não solicitou a redefinição, ignore esta mensagem.</p></div>`;
      try {
        if (resendReady) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.MAIL_FROM, to: [user.email], subject: 'Redefina sua senha | Vortek', text, html })
          });
          if (!response.ok) throw new Error(`Resend HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
        } else {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE ? String(process.env.SMTP_SECURE).toLowerCase() === 'true' : (Number(process.env.SMTP_PORT) || 465) === 465,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          });
          await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: user.email, subject: 'Redefina sua senha | Vortek', text, html });
        }
      } catch (mailError) {
        q('DELETE FROM password_reset_tokens WHERE cliente_id=?', [user.id]);
        throw mailError;
      }
    }
    res.json(generic);
  } catch (e) {
    console.error('Password recovery email failed:', e?.message || e);
    res.json(generic);
  }
});

app.post('/api/auth/reset-password', passwordRecoveryLimiter, (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const confirmar = typeof req.body?.confirmar_senha === 'string' ? req.body.confirmar_senha : '';
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ message: 'Este link é inválido ou expirou. Solicite outro.' });
  if (senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) return res.status(400).json({ message: 'A senha precisa ter entre 8 e 72 bytes.' });
  if (senha !== confirmar) return res.status(400).json({ message: 'As senhas não coincidem.' });
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const recovery = q('SELECT cliente_id FROM password_reset_tokens WHERE token_hash=? AND expires_at>? AND usado_em IS NULL', [tokenHash,Date.now()])[0];
    if (!recovery) return res.status(400).json({ message: 'Este link é inválido ou expirou. Solicite outro.' });
    const userId = recovery.cliente_id;
    const hash = bcrypt.hashSync(senha, 12);
    db.run('BEGIN IMMEDIATE');
    try {
      db.run('UPDATE clientes SET senha_hash=? WHERE id=? AND ativo=1', [hash,userId]);
      db.run("UPDATE password_reset_tokens SET usado_em=datetime('now') WHERE token_hash=? AND usado_em IS NULL", [tokenHash]);
      db.run('COMMIT');
      save();
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
    for (const [activeToken, entry] of accessTokens) {
      if (entry.userId === userId) accessTokens.delete(activeToken);
    }
    res.json({ message: 'Senha redefinida. Entre com sua nova senha.', redirect: '/cliente/login.html' });
  } catch (e) {
    console.error('Password reset failed:', e);
    res.status(500).json({ message: 'Não foi possível redefinir a senha agora.' });
  }
});

/* Dashboard */
app.get('/api/dashboard/stats', auth, (req, res) => {
  try {
    const id = req.session.userId;
    const p  = q("SELECT COUNT(*) as n, AVG(CAST(progresso AS REAL)) as avg FROM projetos WHERE cliente_id=? AND status!='Concluído'", [id])[0];
    const a  = q("SELECT COUNT(*) as n FROM arquivos a JOIN projetos p ON a.projeto_id=p.id WHERE p.cliente_id=?", [id])[0];
    const t  = q("SELECT COUNT(*) as n FROM tickets WHERE cliente_id=? AND status='Aberto'", [id])[0];
    res.json({ projetos: p?.n||0, progresso: Math.round(p?.avg||0), arquivos: a?.n||0, tickets: t?.n||0 });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.get('/api/dashboard/atividades', auth, (req, res) => {
  try {
    res.json(q("SELECT texto, strftime('%d/%m/%Y %H:%M',criado_em) as data FROM atividades WHERE cliente_id=? ORDER BY criado_em DESC LIMIT 10", [req.session.userId]));
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Projetos */
app.get('/api/projetos', auth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit)||100;
    res.json(q('SELECT id,nome,tipo,status,progresso,inicio,previsao FROM projetos WHERE cliente_id=? ORDER BY criado_em DESC LIMIT ?', [req.session.userId, limit]));
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.get('/api/projetos/:id', auth, (req, res) => {
  try {
    const proj = q('SELECT * FROM projetos WHERE id=? AND cliente_id=?', [req.params.id, req.session.userId])[0];
    if (!proj) return res.status(404).json({ message: 'Não encontrado.' });
    proj.etapas = q('SELECT * FROM etapas WHERE projeto_id=? ORDER BY ordem', [req.params.id]);
    res.json(proj);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Arquivos */
app.get('/api/arquivos', auth, (req, res) => {
  try {
    res.json(q("SELECT a.id,a.nome,a.tamanho,a.tipo,strftime('%d/%m/%Y',a.enviado_em) as data,p.nome as projeto FROM arquivos a JOIN projetos p ON a.projeto_id=p.id WHERE p.cliente_id=? ORDER BY a.enviado_em DESC", [req.session.userId]));
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Financeiro */
app.get('/api/financeiro', auth, (req, res) => {
  try {
    res.json(q("SELECT c.id,c.descricao,c.valor,c.status,strftime('%d/%m/%Y',c.vencimento) as vencimento,strftime('%d/%m/%Y',c.pago_em) as pago_em,p.nome as projeto FROM cobrancas c LEFT JOIN projetos p ON c.projeto_id=p.id WHERE c.cliente_id=? ORDER BY c.criado_em DESC", [req.session.userId]));
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Suporte */
app.get('/api/suporte', auth, (req, res) => {
  try {
    const tickets = q("SELECT t.id,t.titulo,t.status,strftime('%d/%m/%Y',t.criado_em) as data FROM tickets t WHERE t.cliente_id=? ORDER BY t.criado_em DESC", [req.session.userId]);
    tickets.forEach(t => {
      const u = q('SELECT mensagem FROM ticket_mensagens WHERE ticket_id=? ORDER BY criado_em DESC LIMIT 1', [t.id])[0];
      t.ultima_msg = u?.mensagem || '';
    });
    res.json(tickets);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.get('/api/suporte/:id', auth, (req, res) => {
  try {
    const ticket = q('SELECT * FROM tickets WHERE id=? AND cliente_id=?', [req.params.id, req.session.userId])[0];
    if (!ticket) return res.status(404).json({ message: 'Não encontrado.' });
    ticket.mensagens = q("SELECT autor,mensagem,strftime('%d/%m/%Y %H:%M',criado_em) as data FROM ticket_mensagens WHERE ticket_id=? ORDER BY criado_em", [req.params.id]);
    res.json(ticket);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.post('/api/suporte', auth, (req, res) => {
  const { titulo, mensagem, projeto_id } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    q('INSERT INTO tickets (cliente_id,projeto_id,titulo,mensagem) VALUES (?,?,?,?)', [req.session.userId, projeto_id||null, titulo, mensagem]);
    const tid = lastId();
    q('INSERT INTO ticket_mensagens (ticket_id,autor,mensagem) VALUES (?,?,?)', [tid,'cliente',mensagem]);
    q('INSERT INTO atividades (cliente_id,texto) VALUES (?,?)', [req.session.userId, `Ticket aberto: "${titulo}"`]);
    res.status(201).json({ message: 'Ticket criado!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Perfil */
app.get('/api/perfil', auth, (req, res) => {
  try {
    res.json(q('SELECT id,nome,email,telefone,criado_em FROM clientes WHERE id=?', [req.session.userId])[0]);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.put('/api/perfil', auth, (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ message: 'Nome obrigatório.' });
  try {
    q('UPDATE clientes SET nome=?,telefone=? WHERE id=?', [nome, telefone||null, req.session.userId]);
    req.session.nome = nome;
    res.json({ message: 'Perfil atualizado!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.put('/api/perfil/senha', auth, (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha || nova_senha.length < 6)
    return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' });
  try {
    const user = q('SELECT senha_hash FROM clientes WHERE id=?', [req.session.userId])[0];
    if (!bcrypt.compareSync(senha_atual, user.senha_hash))
      return res.status(400).json({ message: 'Senha atual incorreta.' });
    q('UPDATE clientes SET senha_hash=? WHERE id=?', [bcrypt.hashSync(nova_senha, 12), req.session.userId]);
    res.json({ message: 'Senha alterada!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* ══ ADMINISTRADOR ══ */
function isAdminEmail(email) {
  return Boolean(ADMIN_EMAIL && String(email || '').trim().toLowerCase() === ADMIN_EMAIL);
}

function requireAdmin(req, res, next) {
  auth(req, res, () => {
    if (!ADMIN_EMAIL) return res.status(503).json({ message: 'Administrador ainda não configurado.' });
    if (!isAdminEmail(req.session.email)) return res.status(403).json({ message: 'Acesso exclusivo do administrador.' });
    next();
  });
}

const adminStatusValues = ['Em andamento', 'Pausado', 'Concluído', 'Cancelado'];
const chargeStatusValues = ['Pendente', 'Pago', 'Atrasado', 'Cancelado'];
const ticketStatusValues = ['Aberto', 'Em andamento', 'Respondido', 'Fechado'];

app.get('/api/admin/overview', requireAdmin, (req, res) => {
  try {
    const clientes = q('SELECT COUNT(*) AS total, SUM(CASE WHEN ativo=1 THEN 1 ELSE 0 END) AS ativos FROM clientes')[0];
    const projetos = q('SELECT COUNT(*) AS total FROM projetos')[0];
    const cobrancas = q("SELECT COUNT(*) AS pendentes FROM cobrancas WHERE status='Pendente'")[0];
    const tickets = q("SELECT COUNT(*) AS abertos FROM tickets WHERE status IN ('Aberto','Em andamento')")[0];
    res.json({ clientes: clientes.total || 0, ativos: clientes.ativos || 0, projetos: projetos.total || 0, cobrancas_pendentes: cobrancas.pendentes || 0, tickets_abertos: tickets.abertos || 0 });
  } catch(e) { console.error('Admin overview:', e); res.status(500).json({ message: 'Erro ao carregar resumo.' }); }
});

app.get('/api/admin/clientes', requireAdmin, (req, res) => {
  try {
    const termo = String(req.query.busca || '').trim().slice(0, 100);
    const like = `%${termo}%`;
    const clientes = q(`SELECT c.id,c.nome,c.email,c.telefone,c.ativo,c.criado_em,
      (SELECT COUNT(*) FROM projetos p WHERE p.cliente_id=c.id) AS projetos,
      (SELECT COUNT(*) FROM tickets t WHERE t.cliente_id=c.id) AS tickets
      FROM clientes c
      WHERE ?='' OR lower(c.nome) LIKE lower(?) OR lower(c.email) LIKE lower(?)
      ORDER BY c.ativo DESC,c.nome COLLATE NOCASE LIMIT 200`, [termo, like, like]);
    res.json(clientes);
  } catch(e) { console.error('Admin clients:', e); res.status(500).json({ message: 'Erro ao carregar clientes.' }); }
});

app.post('/api/admin/clientes', requireAdmin, (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!nome || nome.length < 2 || nome.length > 100) return res.status(400).json({ message: 'Informe um nome entre 2 e 100 caracteres.' });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  if (telefone.length > 30) return res.status(400).json({ message: 'O telefone deve ter no máximo 30 caracteres.' });
  if (senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) return res.status(400).json({ message: 'A senha inicial deve ter pelo menos 8 caracteres.' });
  if (isAdminEmail(email)) return res.status(400).json({ message: 'O e-mail do administrador não pode ser usado para criar um cliente.' });
  try {
    if (q('SELECT id FROM clientes WHERE lower(email)=lower(?)', [email])[0]) return res.status(409).json({ message: 'Este e-mail já possui uma conta.' });
    q('INSERT INTO clientes (nome,email,senha_hash,telefone) VALUES (?,?,?,?)', [nome, email, bcrypt.hashSync(senha, 12), telefone || null]);
    const cliente = q('SELECT id,nome,email,telefone,ativo,criado_em FROM clientes WHERE email=?', [email])[0];
    res.status(201).json(cliente);
  } catch(e) {
    if (/UNIQUE constraint failed/i.test(e.message || '')) return res.status(409).json({ message: 'Este e-mail já possui uma conta.' });
    console.error('Admin create client:', e); res.status(500).json({ message: 'Erro ao criar cliente.' });
  }
});

app.get('/api/admin/clientes/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Cliente inválido.' });
  try {
    const cliente = q('SELECT id,nome,email,telefone,ativo,criado_em FROM clientes WHERE id=?', [id])[0];
    if (!cliente) return res.status(404).json({ message: 'Cliente não encontrado.' });
    cliente.projetos = q('SELECT id,nome,tipo,status,progresso,inicio,previsao,criado_em FROM projetos WHERE cliente_id=? ORDER BY criado_em DESC', [id]);
    cliente.cobrancas = q('SELECT c.id,c.projeto_id,c.descricao,c.valor,c.status,c.vencimento,c.pago_em,p.nome AS projeto FROM cobrancas c LEFT JOIN projetos p ON p.id=c.projeto_id WHERE c.cliente_id=? ORDER BY c.criado_em DESC', [id]);
    cliente.tickets = q(`SELECT t.id,t.projeto_id,t.titulo,t.mensagem,t.status,t.criado_em,
      (SELECT mensagem FROM ticket_mensagens m WHERE m.ticket_id=t.id ORDER BY m.criado_em DESC LIMIT 1) AS ultima_mensagem
      FROM tickets t WHERE t.cliente_id=? ORDER BY t.criado_em DESC`, [id]);
    cliente.arquivos = q('SELECT a.id,a.nome,a.tamanho,a.tipo,a.enviado_em,p.nome AS projeto FROM arquivos a JOIN projetos p ON p.id=a.projeto_id WHERE p.cliente_id=? ORDER BY a.enviado_em DESC', [id]);
    res.json(cliente);
  } catch(e) { console.error('Admin client detail:', e); res.status(500).json({ message: 'Erro ao carregar ficha do cliente.' }); }
});

app.put('/api/admin/clientes/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim() : '';
  const ativo = req.body?.ativo === false || req.body?.ativo === 0 ? 0 : 1;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Cliente inválido.' });
  if (!nome || nome.length < 2 || nome.length > 100) return res.status(400).json({ message: 'Informe um nome entre 2 e 100 caracteres.' });
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Informe um e-mail válido.' });
  if (telefone.length > 30) return res.status(400).json({ message: 'O telefone deve ter no máximo 30 caracteres.' });
  try {
    const atual = q('SELECT id,email FROM clientes WHERE id=?', [id])[0];
    if (!atual) return res.status(404).json({ message: 'Cliente não encontrado.' });
    if (isAdminEmail(atual.email) && email !== ADMIN_EMAIL) return res.status(400).json({ message: 'O e-mail do administrador é gerenciado na configuração do Railway.' });
    if (isAdminEmail(atual.email) && !ativo) return res.status(400).json({ message: 'Não é possível desativar a conta do administrador.' });
    if (q('SELECT id FROM clientes WHERE lower(email)=lower(?) AND id<>?', [email, id])[0]) return res.status(409).json({ message: 'Este e-mail já pertence a outra conta.' });
    q('UPDATE clientes SET nome=?,email=?,telefone=?,ativo=? WHERE id=?', [nome, email, telefone || null, ativo, id]);
    res.json({ message: 'Cliente atualizado.' });
  } catch(e) {
    if (/UNIQUE constraint failed/i.test(e.message || '')) return res.status(409).json({ message: 'Este e-mail já pertence a outra conta.' });
    console.error('Admin update client:', e); res.status(500).json({ message: 'Erro ao atualizar cliente.' });
  }
});

app.post('/api/admin/clientes/:id/projetos', requireAdmin, (req, res) => {
  const clienteId = Number(req.params.id);
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const tipo = typeof req.body?.tipo === 'string' ? req.body.tipo.trim() : '';
  const status = adminStatusValues.includes(req.body?.status) ? req.body.status : 'Em andamento';
  const progresso = Number(req.body?.progresso ?? 0);
  const inicio = typeof req.body?.inicio === 'string' ? req.body.inicio : '';
  const previsao = typeof req.body?.previsao === 'string' ? req.body.previsao : '';
  if (!Number.isSafeInteger(clienteId) || clienteId < 1 || !q('SELECT id FROM clientes WHERE id=?', [clienteId])[0]) return res.status(404).json({ message: 'Cliente não encontrado.' });
  if (!nome || nome.length > 150 || !Number.isInteger(progresso) || progresso < 0 || progresso > 100) return res.status(400).json({ message: 'Confira o nome e o progresso (0 a 100%).' });
  try {
    q('INSERT INTO projetos (cliente_id,nome,tipo,status,progresso,inicio,previsao) VALUES (?,?,?,?,?,?,?)', [clienteId,nome,tipo||null,status,progresso,inicio||null,previsao||null]);
    res.status(201).json({ id:lastId(), message:'Projeto criado.' });
  } catch(e) { console.error('Admin create project:', e); res.status(500).json({ message:'Erro ao criar projeto.' }); }
});

app.put('/api/admin/projetos/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const tipo = typeof req.body?.tipo === 'string' ? req.body.tipo.trim() : '';
  const status = req.body?.status;
  const progresso = Number(req.body?.progresso);
  const inicio = typeof req.body?.inicio === 'string' ? req.body.inicio : '';
  const previsao = typeof req.body?.previsao === 'string' ? req.body.previsao : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message:'Projeto inválido.' });
  if (!nome || nome.length > 150 || !adminStatusValues.includes(status) || !Number.isInteger(progresso) || progresso < 0 || progresso > 100) return res.status(400).json({ message:'Confira os dados do projeto.' });
  try {
    if (!q('SELECT id FROM projetos WHERE id=?', [id])[0]) return res.status(404).json({ message:'Projeto não encontrado.' });
    q('UPDATE projetos SET nome=?,tipo=?,status=?,progresso=?,inicio=?,previsao=? WHERE id=?', [nome,tipo||null,status,progresso,inicio||null,previsao||null,id]);
    res.json({ message:'Projeto atualizado.' });
  } catch(e) { console.error('Admin update project:', e); res.status(500).json({ message:'Erro ao atualizar projeto.' }); }
});

app.post('/api/admin/clientes/:id/cobrancas', requireAdmin, (req, res) => {
  const clienteId = Number(req.params.id);
  const projetoId = req.body?.projeto_id ? Number(req.body.projeto_id) : null;
  const descricao = typeof req.body?.descricao === 'string' ? req.body.descricao.trim() : '';
  const valor = Number(req.body?.valor);
  const vencimento = typeof req.body?.vencimento === 'string' ? req.body.vencimento : '';
  if (!Number.isSafeInteger(clienteId) || clienteId < 1 || !q('SELECT id FROM clientes WHERE id=?', [clienteId])[0]) return res.status(404).json({ message:'Cliente não encontrado.' });
  if (!descricao || descricao.length > 200 || !Number.isFinite(valor) || valor <= 0) return res.status(400).json({ message:'Informe uma descrição e um valor válido.' });
  if (projetoId && !q('SELECT id FROM projetos WHERE id=? AND cliente_id=?', [projetoId,clienteId])[0]) return res.status(400).json({ message:'O projeto não pertence a este cliente.' });
  try {
    q('INSERT INTO cobrancas (cliente_id,projeto_id,descricao,valor,status,vencimento) VALUES (?,?,?,?,?,?)', [clienteId,projetoId,descricao,valor,'Pendente',vencimento||null]);
    res.status(201).json({ message:'Cobrança criada.' });
  } catch(e) { console.error('Admin create charge:', e); res.status(500).json({ message:'Erro ao criar cobrança.' }); }
});

app.put('/api/admin/cobrancas/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message:'Cobrança inválida.' });
  if (!chargeStatusValues.includes(status)) return res.status(400).json({ message:'Status inválido.' });
  try {
    if (!q('SELECT id FROM cobrancas WHERE id=?', [id])[0]) return res.status(404).json({ message:'Cobrança não encontrada.' });
    const pagoEm = status === 'Pago' ? new Date().toISOString().slice(0,19).replace('T',' ') : null;
    q('UPDATE cobrancas SET status=?,pago_em=? WHERE id=?', [status,pagoEm,id]);
    res.json({ message:'Cobrança atualizada.' });
  } catch(e) { console.error('Admin update charge:', e); res.status(500).json({ message:'Erro ao atualizar cobrança.' }); }
});

app.put('/api/admin/tickets/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status;
  const resposta = typeof req.body?.resposta === 'string' ? req.body.resposta.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message:'Chamado inválido.' });
  if (!ticketStatusValues.includes(status) || resposta.length > 5000) return res.status(400).json({ message:'Confira o status e a resposta.' });
  try {
    const ticket = q('SELECT id,cliente_id,titulo FROM tickets WHERE id=?', [id])[0];
    if (!ticket) return res.status(404).json({ message:'Chamado não encontrado.' });
    q('UPDATE tickets SET status=? WHERE id=?', [status,id]);
    if (resposta) {
      q('INSERT INTO ticket_mensagens (ticket_id,autor,mensagem) VALUES (?,?,?)', [id,'vortek',resposta]);
      q('INSERT INTO atividades (cliente_id,texto) VALUES (?,?)', [ticket.cliente_id,`Resposta no chamado: ${ticket.titulo}`]);
    }
    res.json({ message:'Chamado atualizado.' });
  } catch(e) { console.error('Admin update ticket:', e); res.status(500).json({ message:'Erro ao atualizar chamado.' }); }
});

/* ══ STATIC (por último, apenas arquivos que existem) ══ */
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  express.static(__dirname)(req, res, next);
});

/* ══ SETUP DB ══ */
async function setup() {
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL, telefone TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS projetos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), nome TEXT NOT NULL, tipo TEXT, descricao TEXT, status TEXT DEFAULT 'Em andamento', progresso INTEGER DEFAULT 0, inicio TEXT, previsao TEXT, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS etapas (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL REFERENCES projetos(id), nome TEXT NOT NULL, concluida INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS arquivos (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL REFERENCES projetos(id), nome TEXT NOT NULL, caminho TEXT NOT NULL, tamanho INTEGER, tipo TEXT, enviado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS cobrancas (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), projeto_id INTEGER REFERENCES projetos(id), descricao TEXT, valor REAL NOT NULL, status TEXT DEFAULT 'Pendente', vencimento TEXT, pago_em TEXT, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), projeto_id INTEGER REFERENCES projetos(id), titulo TEXT NOT NULL, mensagem TEXT NOT NULL, status TEXT DEFAULT 'Aberto', criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS ticket_mensagens (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES tickets(id), autor TEXT DEFAULT 'cliente', mensagem TEXT NOT NULL, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS atividades (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), texto TEXT NOT NULL, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS password_reset_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, usado_em TEXT, criado_em TEXT DEFAULT (datetime('now','localtime')));
  `);


}

/* ══ START ══ */
initDb().then(async () => {
  await setup();
  app.listen(PORT, () => {
    console.log(`✅ Vortek na porta ${PORT} | env: ${process.env.NODE_ENV||'dev'}`);
  });
}).catch(err => {
  console.error('❌ Erro ao iniciar:', err);
  process.exit(1);
});
