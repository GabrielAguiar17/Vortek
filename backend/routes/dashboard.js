const express     = require('express');
const router      = express.Router();
const db          = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

/* GET /api/dashboard/stats */
router.get('/stats', async (req, res) => {
  const id = req.session.userId;
  try {
    const [proj, arq, tick] = await Promise.all([
      db.query('SELECT COUNT(*) AS n, AVG(CAST(progresso AS FLOAT)) AS avg FROM projetos WHERE cliente_id = @id AND status != \'Concluído\'', { id }),
      db.query('SELECT COUNT(*) AS n FROM arquivos a JOIN projetos p ON a.projeto_id = p.id WHERE p.cliente_id = @id', { id }),
      db.query('SELECT COUNT(*) AS n FROM tickets WHERE cliente_id = @id AND status = \'Aberto\'', { id }),
    ]);
    res.json({
      projetos:  proj.recordset[0].n,
      progresso: Math.round(proj.recordset[0].avg || 0),
      arquivos:  arq.recordset[0].n,
      tickets:   tick.recordset[0].n,
    });
  } catch (e) { res.status(500).json({ message: 'Erro ao carregar stats.' }); }
});

/* GET /api/dashboard/atividades */
router.get('/atividades', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT TOP 10 texto, FORMAT(criado_em, \'dd/MM/yyyy HH:mm\') AS data FROM atividades WHERE cliente_id = @id ORDER BY criado_em DESC',
      { id: req.session.userId }
    );
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar atividades.' }); }
});

module.exports = router;
