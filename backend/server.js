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
const fs          = require('fs');
const bcrypt      = require('bcryptjs');
const rateLimit   = require('express-rate-limit');
const { getDb, saveDb } = require('./database/db');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Segurança ── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://gabrielaguiar17.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
  ],
  credentials: true
}));
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
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

/* ── Setup automático do banco ── */
async function setupDb(db) {
  console.log('🔧 Verificando banco de dados...');

  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      telefone   TEXT,
      ativo      INTEGER DEFAULT 1,
      criado_em  TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS projetos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      nome       TEXT NOT NULL,
      tipo       TEXT,
      descricao  TEXT,
      status     TEXT DEFAULT 'Em andamento',
      progresso  INTEGER DEFAULT 0,
      inicio     TEXT,
      previsao   TEXT,
      criado_em  TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS etapas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      nome       TEXT NOT NULL,
      concluida  INTEGER DEFAULT 0,
      ordem      INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS arquivos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id INTEGER NOT NULL REFERENCES projetos(id),
      nome       TEXT NOT NULL,
      caminho    TEXT NOT NULL,
      tamanho    INTEGER,
      tipo       TEXT,
      enviado_em TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS cobrancas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      projeto_id INTEGER REFERENCES projetos(id),
      descricao  TEXT,
      valor      REAL NOT NULL,
      status     TEXT DEFAULT 'Pendente',
      vencimento TEXT,
      pago_em    TEXT,
      criado_em  TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      projeto_id INTEGER REFERENCES projetos(id),
      titulo     TEXT NOT NULL,
      mensagem   TEXT NOT NULL,
      status     TEXT DEFAULT 'Aberto',
      criado_em  TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS ticket_mensagens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id  INTEGER NOT NULL REFERENCES tickets(id),
      autor      TEXT DEFAULT 'cliente',
      mensagem   TEXT NOT NULL,
      criado_em  TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS atividades (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id),
      texto      TEXT NOT NULL,
      criado_em  TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  console.log('✅ Tabelas verificadas!');

  /* Cliente de teste — cria só se não existir */
  const existe = db.exec("SELECT id FROM clientes WHERE email = 'cliente@vortek.com'");
  if (!existe.length || !existe[0].values.length) {
    const hash = bcrypt.hashSync('123456', 12);
    db.run('INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES (?,?,?,?)',
      ['Cliente Teste', 'cliente@vortek.com', hash, '(38) 99999-0000']);
    const clienteId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

    db.run('INSERT INTO projetos (cliente_id, nome, tipo, status, progresso, inicio, previsao) VALUES (?,?,?,?,?,?,?)',
      [clienteId, 'Site Institucional Vortek', 'Website', 'Em andamento', 65, '2025-01-10', '2025-02-10']);
    const projetoId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

    [['Briefing e planejamento',1,1],['Design e prototipagem',1,2],
     ['Desenvolvimento frontend',1,3],['Integração e testes',0,4],['Publicação e entrega',0,5]]
    .forEach(([nome,c,o]) => db.run('INSERT INTO etapas (projeto_id,nome,concluida,ordem) VALUES (?,?,?,?)',[projetoId,nome,c,o]));

    db.run('INSERT INTO cobrancas (cliente_id,projeto_id,descricao,valor,status,vencimento) VALUES (?,?,?,?,?,?)',
      [clienteId,projetoId,'Sinal — Site Institucional',750,'Pago','2025-01-15']);
    db.run('INSERT INTO cobrancas (cliente_id,projeto_id,descricao,valor,status,vencimento) VALUES (?,?,?,?,?,?)',
      [clienteId,projetoId,'Saldo — Site Institucional',750,'Pendente','2025-02-10']);

    db.run('INSERT INTO tickets (cliente_id,projeto_id,titulo,mensagem,status) VALUES (?,?,?,?,?)',
      [clienteId,projetoId,'Dúvida sobre prazo','Olá, quando o site estará pronto?','Respondido']);
    const ticketId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    db.run('INSERT INTO ticket_mensagens (ticket_id,autor,mensagem) VALUES (?,?,?)',
      [ticketId,'vortek','Previsão para 10/02. Qualquer dúvida, estamos à disposição!']);

    ['Projeto "Site Institucional" criado.','Etapa "Design" concluída.',
     'Etapa "Desenvolvimento" concluída.','Pagamento de R$ 750,00 confirmado.']
    .forEach(t => db.run('INSERT INTO atividades (cliente_id,texto) VALUES (?,?)',[clienteId,t]));

    saveDb();
    console.log('✅ Cliente de teste criado: cliente@vortek.com / 123456');
  } else {
    console.log('ℹ️  Banco já configurado.');
  }
}

/* ── Inicializa banco e sobe servidor ── */
getDb().then(async (db) => {
  await setupDb(db);
  app.listen(PORT, () => {
    console.log(`\n✅ Vortek rodando na porta ${PORT}`);
    console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
  });
}).catch(err => {
  console.error('❌ Erro ao inicializar banco:', err);
  process.exit(1);
});
