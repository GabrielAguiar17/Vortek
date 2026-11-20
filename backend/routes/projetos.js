const express     = require('express');
const router      = express.Router();
const { db }      = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const rows = db.prepare(`SELECT id, nome, tipo, status, progresso, inicio, previsao FROM projetos WHERE cliente_id = ? ORDER BY criado_em DESC LIMIT ?`).all(req.session.userId, limit);
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.get('/:id', (req, res) => {
  try {
    const proj = db.prepare('SELECT * FROM projetos WHERE id = ? AND cliente_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ message: 'Não encontrado.' });
    const etapas = db.prepare('SELECT * FROM etapas WHERE projeto_id = ? ORDER BY ordem').all(req.params.id);
    res.json({ ...proj, etapas });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
