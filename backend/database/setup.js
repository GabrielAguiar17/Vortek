/* ═══════════════════════════════════════
   VORTEK — Setup do banco SQLite
   Execute: node database/setup.js
═══════════════════════════════════════ */
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');

const db = new Database(path.join(__dirname, 'vortek.db'));
db.pragma('foreign_keys = ON');

console.log('🔧 Criando tabelas...');

db.exec(`
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

console.log('✅ Tabelas criadas!');

/* ── Cria cliente de teste ── */
const existe = db.prepare('SELECT id FROM clientes WHERE email = ?').get('cliente@vortek.com');

if (!existe) {
  const hash = bcrypt.hashSync('123456', 12);
  const { lastInsertRowid: clienteId } = db.prepare(
    'INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES (?,?,?,?)'
  ).run('Cliente Teste', 'cliente@vortek.com', hash, '(38) 99999-0000');

  /* Projeto de exemplo */
  const { lastInsertRowid: projetoId } = db.prepare(
    'INSERT INTO projetos (cliente_id, nome, tipo, status, progresso, inicio, previsao) VALUES (?,?,?,?,?,?,?)'
  ).run(clienteId, 'Site Institucional', 'Website', 'Em andamento', 65, '2025-01-10', '2025-02-10');

  /* Etapas */
  const etapas = [
    { nome: 'Briefing e planejamento', concluida: 1, ordem: 1 },
    { nome: 'Design e prototipagem',   concluida: 1, ordem: 2 },
    { nome: 'Desenvolvimento frontend',concluida: 1, ordem: 3 },
    { nome: 'Integração e testes',     concluida: 0, ordem: 4 },
    { nome: 'Publicação e entrega',    concluida: 0, ordem: 5 },
  ];
  const insEtapa = db.prepare('INSERT INTO etapas (projeto_id, nome, concluida, ordem) VALUES (?,?,?,?)');
  etapas.forEach(e => insEtapa.run(projetoId, e.nome, e.concluida, e.ordem));

  /* Cobrança */
  db.prepare(
    'INSERT INTO cobrancas (cliente_id, projeto_id, descricao, valor, status, vencimento) VALUES (?,?,?,?,?,?)'
  ).run(clienteId, projetoId, 'Sinal — Site Institucional', 750, 'Pago', '2025-01-15');
  db.prepare(
    'INSERT INTO cobrancas (cliente_id, projeto_id, descricao, valor, status, vencimento) VALUES (?,?,?,?,?,?)'
  ).run(clienteId, projetoId, 'Saldo — Site Institucional', 750, 'Pendente', '2025-02-10');

  /* Ticket */
  const { lastInsertRowid: ticketId } = db.prepare(
    'INSERT INTO tickets (cliente_id, projeto_id, titulo, mensagem) VALUES (?,?,?,?)'
  ).run(clienteId, projetoId, 'Dúvida sobre prazo de entrega', 'Olá, gostaria de saber quando o site estará pronto.');
  db.prepare(
    'INSERT INTO ticket_mensagens (ticket_id, autor, mensagem) VALUES (?,?,?)'
  ).run(ticketId, 'vortek', 'Olá! A previsão é para 10/02. Qualquer dúvida estamos à disposição!');

  /* Atividades */
  const insAtiv = db.prepare('INSERT INTO atividades (cliente_id, texto) VALUES (?,?)');
  insAtiv.run(clienteId, 'Projeto "Site Institucional" criado.');
  insAtiv.run(clienteId, 'Etapa "Design e prototipagem" concluída.');
  insAtiv.run(clienteId, 'Etapa "Desenvolvimento frontend" concluída.');
  insAtiv.run(clienteId, 'Pagamento de R$ 750,00 confirmado.');

  console.log('✅ Cliente de teste criado!');
  console.log('   📧 E-mail: cliente@vortek.com');
  console.log('   🔑 Senha:  123456');
} else {
  console.log('ℹ️  Cliente de teste já existe.');
}

console.log('\n🚀 Banco pronto! Rode: node server.js\n');
db.close();
