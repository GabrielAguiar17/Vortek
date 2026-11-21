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

  /* Salva o banco em disco */
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('\n🚀 Banco salvo! Rode: node server.js\n');
})();
