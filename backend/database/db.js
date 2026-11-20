/* ═══════════════════════════════════════
   Conexão SQLite via better-sqlite3
   Sem instalação — banco é um arquivo local
═══════════════════════════════════════ */
const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'vortek.db');
const db      = new Database(DB_PATH);

/* Performance */
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* Wrapper para manter a mesma interface nas rotas */
function query(sql, params = {}) {
  const stmt = db.prepare(sql);
  const sql_upper = sql.trim().toUpperCase();

  if (sql_upper.startsWith('SELECT')) {
    return { recordset: stmt.all(params) };
  } else {
    const info = stmt.run(params);
    return { rowsAffected: info.changes, lastInsertRowid: info.lastInsertRowid };
  }
}

module.exports = { query, db };
