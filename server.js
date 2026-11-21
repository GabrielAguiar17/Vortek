/* ═══════════════════════════════════════
   VORTEK — server.js
   Railway entry point
═══════════════════════════════════════ */
require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const helmet     = require('helmet');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const initSqlJs  = require('sql.js');

const app  = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://gabrielaguiar17.github.io/Vortek').replace(/\/+$/, '');
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
function auth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ message: 'Não autenticado.' });
  next();
}

/* ══ APP ══ */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://gabrielaguiar17.github.io',
    'https://vortek-production-d724da53.up.railway.app',
    'http://localhost:3000',
  ],
  credentials: true
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

/* O Railway hospeda a API; o site público está no GitHub Pages. */
app.get('/', (req, res) => {
  res.redirect(302, PUBLIC_SITE_URL + '/');
});

/* Redireciona as telas do cliente para o GitHub Pages. O Railway hospeda a API. */
app.use('/cliente', (req, res) => {
  res.redirect(302, `${PUBLIC_SITE_URL}${req.originalUrl}`);
});

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
    res.json({ message: 'Login realizado.', nome: user.nome });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Erro interno.' }); }
});

app.post('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false }), (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const telefone = typeof req.body?.telefone === 'string' ? req.body.telefone.trim() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const confirmarSenha = typeof req.body?.confirmar_senha === 'string' ? req.body.confirmar_senha : '';

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
    res.status(201).json({ message: 'Conta criada.', nome: user.nome });
  } catch(e) {
    if (/UNIQUE constraint failed/i.test(e.message || ''))
      return res.status(409).json({ message: 'Este e-mail já possui uma conta. Entre ou recupere sua senha.' });
    console.error('Erro ao criar conta:', e);
    res.status(500).json({ message: 'Não foi possível criar sua conta agora.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: 'Não autenticado.' });
  res.json({ id: req.session.userId, nome: req.session.nome, email: req.session.email });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ message: 'Logout.' }); });
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
