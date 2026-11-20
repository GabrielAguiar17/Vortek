/* ═══════════════════════════════════════
   VORTEK — Setup do banco SQLite
   Execute: node database/setup.js
═══════════════════════════════════════ */
const initSqlJs = require('sql.js');
const bcrypt    = require('bcryptjs');
const path      = require('path');
const fs        = require('fs');

const DB_PATH = path.join(__dirname, 'vortek.db');

(async () => {
  const SQL = await initSqlJs();
  const db  = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.run('PRAGMA foreign_keys = ON');

  console.log('🔧 Criando tabelas...');

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

  console.log('✅ Tabelas criadas!');

  /* Verifica se cliente teste já existe */
  const existe = db.exec("SELECT id FROM clientes WHERE email = 'cliente@vortek.com'");

  if (!existe.length || !existe[0].values.length) {
    const hash = bcrypt.hashSync('123456', 12);

    db.run('INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES (?,?,?,?)',
      ['Cliente Teste', 'cliente@vortek.com', hash, '(38) 99999-0000']);
    const clienteId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

    db.run('INSERT INTO projetos (cliente_id, nome, tipo, status, progresso, inicio, previsao) VALUES (?,?,?,?,?,?,?)',
      [clienteId, 'Site Institucional Vortek', 'Website', 'Em andamento', 65, '2025-01-10', '2025-02-10']);
    const projetoId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

    const etapas = [
      ['Briefing e planejamento',   1, 1],
      ['Design e prototipagem',      1, 2],
      ['Desenvolvimento frontend',   1, 3],
      ['Integração e testes',        0, 4],
      ['Publicação e entrega',       0, 5],
    ];
    etapas.forEach(([nome, concluida, ordem]) =>
      db.run('INSERT INTO etapas (projeto_id, nome, concluida, ordem) VALUES (?,?,?,?)',
        [projetoId, nome, concluida, ordem]));

    db.run('INSERT INTO cobrancas (cliente_id, projeto_id, descricao, valor, status, vencimento) VALUES (?,?,?,?,?,?)',
      [clienteId, projetoId, 'Sinal — Site Institucional', 750, 'Pago', '2025-01-15']);
    db.run('INSERT INTO cobrancas (cliente_id, projeto_id, descricao, valor, status, vencimento) VALUES (?,?,?,?,?,?)',
      [clienteId, projetoId, 'Saldo — Site Institucional', 750, 'Pendente', '2025-02-10']);

    db.run('INSERT INTO tickets (cliente_id, projeto_id, titulo, mensagem, status) VALUES (?,?,?,?,?)',
      [clienteId, projetoId, 'Dúvida sobre prazo de entrega', 'Olá, quando o site estará pronto?', 'Respondido']);
    const ticketId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    db.run('INSERT INTO ticket_mensagens (ticket_id, autor, mensagem) VALUES (?,?,?)',
      [ticketId, 'vortek', 'Olá! Previsão para 10/02. Qualquer dúvida, estamos à disposição!']);

    const atividades = [
      'Projeto "Site Institucional" criado.',
      'Etapa "Design e prototipagem" concluída.',
      'Etapa "Desenvolvimento frontend" concluída.',
      'Pagamento de R$ 750,00 confirmado.',
    ];
    atividades.forEach(t =>
      db.run('INSERT INTO atividades (cliente_id, texto) VALUES (?,?)', [clienteId, t]));

    console.log('✅ Cliente de teste criado!');
    console.log('   📧 E-mail: cliente@vortek.com');
    console.log('   🔑 Senha:  123456');
  } else {
    console.log('ℹ️  Cliente de teste já existe.');
  }

  /* Salva o banco em disco */
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('\n🚀 Banco salvo! Rode: node server.js\n');
})();
