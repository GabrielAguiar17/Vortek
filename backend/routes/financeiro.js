const express     = require('express');
const router      = express.Router();
const db          = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.descricao, c.valor, c.status, FORMAT(c.vencimento,'dd/MM/yyyy') AS vencimento,
              FORMAT(c.pago_em,'dd/MM/yyyy') AS pago_em, p.nome AS projeto
       FROM cobrancas c LEFT JOIN projetos p ON c.projeto_id = p.id
       WHERE c.cliente_id = @id ORDER BY c.criado_em DESC`,
      { id: req.session.userId }
    );
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar cobranças.' }); }
});

module.exports = router;
