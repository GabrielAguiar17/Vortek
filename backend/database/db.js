/* ═══════════════════════════════════════
   Banco SQLite via sql.js (puro JS)
   Sem compilação, sem instalações extras
═══════════════════════════════════════ */
const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'vortek.db');

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/* Wrapper síncrono para compatibilidade com as rotas */
function query(sql, params = []) {
  if (!db) throw new Error('Banco não inicializado. Aguarde o servidor iniciar.');

  const sql_upper = sql.trim().toUpperCase();

  if (sql_upper.startsWith('SELECT')) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return { recordset: rows };
  } else {
    db.run(sql, params);
    saveDb();
    return { rowsAffected: db.getRowsModified(), lastInsertRowid: null };
  }
}

function getLastId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0]?.values[0][0] ?? null;
}

module.exports = { getDb, query, saveDb, getLastId };
