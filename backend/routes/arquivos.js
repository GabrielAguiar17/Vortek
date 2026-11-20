const express     = require('express');
const router      = express.Router();
const db          = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.nome, a.tamanho, a.tipo, FORMAT(a.enviado_em,'dd/MM/yyyy') AS data, p.nome AS projeto
       FROM arquivos a JOIN projetos p ON a.projeto_id = p.id
       WHERE p.cliente_id = @id ORDER BY a.enviado_em DESC`,
      { id: req.session.userId }
    );
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar arquivos.' }); }
});

module.exports = router;
