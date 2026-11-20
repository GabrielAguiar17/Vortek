const express     = require('express');
const router      = express.Router();
const db          = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.titulo, t.status, FORMAT(t.criado_em,'dd/MM/yyyy') AS data,
              (SELECT TOP 1 mensagem FROM ticket_mensagens WHERE ticket_id = t.id ORDER BY criado_em DESC) AS ultima_msg
       FROM tickets t WHERE t.cliente_id = @id ORDER BY t.criado_em DESC`,
      { id: req.session.userId }
    );
    res.json(result.recordset);
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar tickets.' }); }
});

router.post('/', async (req, res) => {
  const { titulo, mensagem, projeto_id } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    await db.query(
      'INSERT INTO tickets (cliente_id, projeto_id, titulo, mensagem) VALUES (@cid, @pid, @titulo, @msg)',
      { cid: req.session.userId, pid: projeto_id || null, titulo, msg: mensagem }
    );
    res.status(201).json({ message: 'Ticket criado com sucesso.' });
  } catch (e) { res.status(500).json({ message: 'Erro ao criar ticket.' }); }
});

module.exports = router;
