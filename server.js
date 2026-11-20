/* ═══════════════════════════════════════
   VORTEK — server.js raiz
   Railway roda este arquivo diretamente
═══════════════════════════════════════ */
require('dotenv').config();
const express     = require('express');
const session     = require('express-session');
const helmet      = require('helmet');
const cors        = require('cors');
const path        = require('path');
const fs          = require('fs');
const bcrypt      = require('bcryptjs');
const rateLimit   = require('express-rate-limit');
const initSqlJs   = require('sql.js');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'backend', 'database', 'vortek.db');

/* ── Banco ── */
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

function saveDb() {
  if (!db) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function query(sql, params = []) {
  if (!db) throw new Error('Banco não inicializado.');
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { recordset: rows };
  } else {
    db.run(sql, params);
    saveDb();
    return { rowsAffected: db.getRowsModified() };
  }
}

function getLastId() {
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] ?? null;
}

/* ── Segurança ── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://gabrielaguiar17.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000',
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Rate limiting ── */
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 15,
  message: { message: 'Muitas tentativas. Tente em 15 minutos.' }
}));

/* ── Sessão ── */
app.use(session({
  secret: process.env.SESSION_SECRET || 'vortek_dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

/* ── Arquivos estáticos ── */
app.use(express.static(__dirname));

/* ── ROTAS ── */

/* Auth */
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    const user = query('SELECT * FROM clientes WHERE email = ? AND ativo = 1', [email]).recordset[0];
    if (!user || !bcrypt.compareSync(senha, user.senha_hash))
      return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    req.session.userId = user.id;
    req.session.nome   = user.nome;
    req.session.email  = user.email;
    res.json({ message: 'Login realizado.', nome: user.nome });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Erro interno.' }); }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: 'Não autenticado.' });
  res.json({ id: req.session.userId, nome: req.session.nome, email: req.session.email });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ message: 'Logout.' }); });
});

/* Dashboard */
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
  try {
    const id = req.session.userId;
    const p = query("SELECT COUNT(*) as n, AVG(CAST(progresso AS REAL)) as avg FROM projetos WHERE cliente_id=? AND status!='Concluído'", [id]).recordset[0];
    const a = query("SELECT COUNT(*) as n FROM arquivos a JOIN projetos p ON a.projeto_id=p.id WHERE p.cliente_id=?", [id]).recordset[0];
    const t = query("SELECT COUNT(*) as n FROM tickets WHERE cliente_id=? AND status='Aberto'", [id]).recordset[0];
    res.json({ projetos: p.n||0, progresso: Math.round(p.avg||0), arquivos: a.n||0, tickets: t.n||0 });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.get('/api/dashboard/atividades', requireAuth, (req, res) => {
  try {
    const rows = query("SELECT texto, strftime('%d/%m/%Y %H:%M',criado_em) as data FROM atividades WHERE cliente_id=? ORDER BY criado_em DESC LIMIT 10", [req.session.userId]).recordset;
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Projetos */
app.get('/api/projetos', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit)||100;
    res.json(query('SELECT id,nome,tipo,status,progresso,inicio,previsao FROM projetos WHERE cliente_id=? ORDER BY criado_em DESC LIMIT ?', [req.session.userId, limit]).recordset);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.get('/api/projetos/:id', requireAuth, (req, res) => {
  try {
    const proj = query('SELECT * FROM projetos WHERE id=? AND cliente_id=?', [req.params.id, req.session.userId]).recordset[0];
    if (!proj) return res.status(404).json({ message: 'Não encontrado.' });
    const etapas = query('SELECT * FROM etapas WHERE projeto_id=? ORDER BY ordem', [req.params.id]).recordset;
    res.json({ ...proj, etapas });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Arquivos */
app.get('/api/arquivos', requireAuth, (req, res) => {
  try {
    res.json(query("SELECT a.id,a.nome,a.tamanho,a.tipo,strftime('%d/%m/%Y',a.enviado_em) as data,p.nome as projeto FROM arquivos a JOIN projetos p ON a.projeto_id=p.id WHERE p.cliente_id=? ORDER BY a.enviado_em DESC", [req.session.userId]).recordset);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Financeiro */
app.get('/api/financeiro', requireAuth, (req, res) => {
  try {
    res.json(query("SELECT c.id,c.descricao,c.valor,c.status,strftime('%d/%m/%Y',c.vencimento) as vencimento,strftime('%d/%m/%Y',c.pago_em) as pago_em,p.nome as projeto FROM cobrancas c LEFT JOIN projetos p ON c.projeto_id=p.id WHERE c.cliente_id=? ORDER BY c.criado_em DESC", [req.session.userId]).recordset);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Suporte */
app.get('/api/suporte', requireAuth, (req, res) => {
  try {
    const tickets = query("SELECT t.id,t.titulo,t.status,strftime('%d/%m/%Y',t.criado_em) as data FROM tickets t WHERE t.cliente_id=? ORDER BY t.criado_em DESC", [req.session.userId]).recordset;
    const result  = tickets.map(t => {
      const u = query('SELECT mensagem FROM ticket_mensagens WHERE ticket_id=? ORDER BY criado_em DESC LIMIT 1', [t.id]).recordset[0];
      return { ...t, ultima_msg: u?.mensagem || '' };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.get('/api/suporte/:id', requireAuth, (req, res) => {
  try {
    const ticket = query('SELECT * FROM tickets WHERE id=? AND cliente_id=?', [req.params.id, req.session.userId]).recordset[0];
    if (!ticket) return res.status(404).json({ message: 'Não encontrado.' });
    const msgs = query("SELECT autor,mensagem,strftime('%d/%m/%Y %H:%M',criado_em) as data FROM ticket_mensagens WHERE ticket_id=? ORDER BY criado_em", [req.params.id]).recordset;
    res.json({ ...ticket, mensagens: msgs });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.post('/api/suporte', requireAuth, (req, res) => {
  const { titulo, mensagem, projeto_id } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    query('INSERT INTO tickets (cliente_id,projeto_id,titulo,mensagem) VALUES (?,?,?,?)', [req.session.userId, projeto_id||null, titulo, mensagem]);
    const tid = getLastId();
    query('INSERT INTO ticket_mensagens (ticket_id,autor,mensagem) VALUES (?,?,?)', [tid,'cliente',mensagem]);
    query('INSERT INTO atividades (cliente_id,texto) VALUES (?,?)', [req.session.userId, `Ticket aberto: "${titulo}"`]);
    res.status(201).json({ message: 'Ticket criado!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Perfil */
app.get('/api/perfil', requireAuth, (req, res) => {
  try {
    res.json(query('SELECT id,nome,email,telefone,criado_em FROM clientes WHERE id=?', [req.session.userId]).recordset[0]);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.put('/api/perfil', requireAuth, (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ message: 'Nome obrigatório.' });
  try {
    query('UPDATE clientes SET nome=?,telefone=? WHERE id=?', [nome, telefone||null, req.session.userId]);
    req.session.nome = nome;
    res.json({ message: 'Perfil atualizado!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

app.put('/api/perfil/senha', requireAuth, (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha || nova_senha.length < 6)
    return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' });
  try {
    const user = query('SELECT senha_hash FROM clientes WHERE id=?', [req.session.userId]).recordset[0];
    if (!bcrypt.compareSync(senha_atual, user.senha_hash))
      return res.status(400).json({ message: 'Senha atual incorreta.' });
    query('UPDATE clientes SET senha_hash=? WHERE id=?', [bcrypt.hashSync(nova_senha, 12), req.session.userId]);
    res.json({ message: 'Senha alterada!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

/* Health */
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

/* ── Middleware auth ── */
function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ message: 'Não autenticado.' });
  next();
}

/* ── Setup do banco ── */
async function setupDb(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL, telefone TEXT, ativo INTEGER DEFAULT 1, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS projetos (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), nome TEXT NOT NULL, tipo TEXT, descricao TEXT, status TEXT DEFAULT 'Em andamento', progresso INTEGER DEFAULT 0, inicio TEXT, previsao TEXT, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS etapas (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL REFERENCES projetos(id), nome TEXT NOT NULL, concluida INTEGER DEFAULT 0, ordem INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS arquivos (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL REFERENCES projetos(id), nome TEXT NOT NULL, caminho TEXT NOT NULL, tamanho INTEGER, tipo TEXT, enviado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS cobrancas (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), projeto_id INTEGER REFERENCES projetos(id), descricao TEXT, valor REAL NOT NULL, status TEXT DEFAULT 'Pendente', vencimento TEXT, pago_em TEXT, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), projeto_id INTEGER REFERENCES projetos(id), titulo TEXT NOT NULL, mensagem TEXT NOT NULL, status TEXT DEFAULT 'Aberto', criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS ticket_mensagens (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES tickets(id), autor TEXT DEFAULT 'cliente', mensagem TEXT NOT NULL, criado_em TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS atividades (id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER NOT NULL REFERENCES clientes(id), texto TEXT NOT NULL, criado_em TEXT DEFAULT (datetime('now','localtime')));
  `);

  const existe = database.exec("SELECT id FROM clientes WHERE email='cliente@vortek.com'");
  if (!existe.length || !existe[0].values.length) {
    const hash = bcrypt.hashSync('123456', 12);
    database.run('INSERT INTO clientes (nome,email,senha_hash,telefone) VALUES (?,?,?,?)', ['Cliente Teste','cliente@vortek.com',hash,'(38) 99999-0000']);
    const cid = database.exec('SELECT last_insert_rowid()')[0].values[0][0];
    database.run('INSERT INTO projetos (cliente_id,nome,tipo,status,progresso,inicio,previsao) VALUES (?,?,?,?,?,?,?)', [cid,'Site Institucional','Website','Em andamento',65,'2025-01-10','2025-02-10']);
    const pid = database.exec('SELECT last_insert_rowid()')[0].values[0][0];
    [['Briefing',1,1],['Design',1,2],['Desenvolvimento',1,3],['Testes',0,4],['Entrega',0,5]].forEach(([n,c,o]) => database.run('INSERT INTO etapas (projeto_id,nome,concluida,ordem) VALUES (?,?,?,?)',[pid,n,c,o]));
    database.run('INSERT INTO cobrancas (cliente_id,projeto_id,descricao,valor,status,vencimento) VALUES (?,?,?,?,?,?)',[cid,pid,'Sinal',750,'Pago','2025-01-15']);
    database.run('INSERT INTO cobrancas (cliente_id,projeto_id,descricao,valor,status,vencimento) VALUES (?,?,?,?,?,?)',[cid,pid,'Saldo',750,'Pendente','2025-02-10']);
    database.run('INSERT INTO tickets (cliente_id,projeto_id,titulo,mensagem,status) VALUES (?,?,?,?,?)',[cid,pid,'Dúvida sobre prazo','Quando o site estará pronto?','Respondido']);
    const tid = database.exec('SELECT last_insert_rowid()')[0].values[0][0];
    database.run('INSERT INTO ticket_mensagens (ticket_id,autor,mensagem) VALUES (?,?,?)',[tid,'vortek','Previsão para 10/02!']);
    ['Projeto criado.','Design concluído.','Desenvolvimento concluído.','Pagamento confirmado.'].forEach(t => database.run('INSERT INTO atividades (cliente_id,texto) VALUES (?,?)',[cid,t]));
    saveDb();
    console.log('✅ Cliente de teste criado: cliente@vortek.com / 123456');
  } else {
    console.log('ℹ️  Banco já configurado.');
  }
}

/* ── Start ── */
getDb().then(async (database) => {
  db = database;
  await setupDb(database);
  app.listen(PORT, () => {
    console.log(`✅ Vortek rodando na porta ${PORT}`);
    console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
