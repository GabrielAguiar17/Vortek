const express     = require('express');
const router      = express.Router();
const { db }      = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.id, c.descricao, c.valor, c.status,
             strftime('%d/%m/%Y', c.vencimento) as vencimento,
             strftime('%d/%m/%Y', c.pago_em) as pago_em,
             p.nome as projeto
      FROM cobrancas c LEFT JOIN projetos p ON c.projeto_id = p.id
      WHERE c.cliente_id = ? ORDER BY c.criado_em DESC
    `).all(req.session.userId);
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
