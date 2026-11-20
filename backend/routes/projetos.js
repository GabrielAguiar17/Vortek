const express     = require('express');
const router      = express.Router();
const db          = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

/* GET /api/projetos */
router.get('/', async (req, res) => {
  const { limit } = req.query;
  try {
    const q = `SELECT TOP ${parseInt(limit) || 100} id, nome, tipo, status, progresso, inicio, previsao
               FROM projetos WHERE cliente_id = @id ORDER BY criado_em DESC`;
    const result = await db.query(q, { id: req.session.userId });
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar projetos.' }); }
});

/* GET /api/projetos/:id */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM projetos WHERE id = @id AND cliente_id = @cid',
      { id: req.params.id, cid: req.session.userId }
    );
    if (!result.recordset[0]) return res.status(404).json({ message: 'Projeto não encontrado.' });
    const etapas = await db.query('SELECT * FROM etapas WHERE projeto_id = @id ORDER BY ordem', { id: req.params.id });
    res.json({ ...result.recordset[0], etapas: etapas.recordset });
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar projeto.' }); }
});

module.exports = router;
