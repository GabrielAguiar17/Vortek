const express     = require('express');
const router      = express.Router();
const { query }   = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const rows = query(`
      SELECT c.id, c.descricao, c.valor, c.status,
             strftime('%d/%m/%Y', c.vencimento) as vencimento,
             strftime('%d/%m/%Y', c.pago_em) as pago_em,
             p.nome as projeto
      FROM cobrancas c LEFT JOIN projetos p ON c.projeto_id = p.id
      WHERE c.cliente_id = ? ORDER BY c.criado_em DESC
    `, [req.session.userId]).recordset;
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
