/* ═══════════════════════════════════════
   Conexão SQL Server via mssql
═══════════════════════════════════════ */
const sql = require('mssql');

const config = {
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'SuaSenhaAqui',
  server:   process.env.DB_SERVER   || 'localhost',
  database: process.env.DB_NAME     || 'vortek',
  options: {
    encrypt:              true,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

let pool;

async function getPool() {
  if (!pool) pool = await sql.connect(config);
  return pool;
}

async function query(queryStr, params = {}) {
  const p   = await getPool();
  const req = p.request();
  for (const [key, val] of Object.entries(params)) {
    req.input(key, val);
  }
  return req.query(queryStr);
}

module.exports = { query, sql };
