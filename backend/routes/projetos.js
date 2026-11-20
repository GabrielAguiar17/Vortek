const express     = require('express');
const router      = express.Router();
const { query }   = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const rows = query('SELECT id, nome, tipo, status, progresso, inicio, previsao FROM projetos WHERE cliente_id = ? ORDER BY criado_em DESC LIMIT ?', [req.session.userId, limit]).recordset;
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.get('/:id', (req, res) => {
  try {
    const proj = query('SELECT * FROM projetos WHERE id = ? AND cliente_id = ?', [req.params.id, req.session.userId]).recordset[0];
    if (!proj) return res.status(404).json({ message: 'Não encontrado.' });
    const etapas = query('SELECT * FROM etapas WHERE projeto_id = ? ORDER BY ordem', [req.params.id]).recordset;
    res.json({ ...proj, etapas });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
