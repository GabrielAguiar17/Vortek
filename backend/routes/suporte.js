const express     = require('express');
const router      = express.Router();
const { query, getLastId } = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const tickets = query(`
      SELECT t.id, t.titulo, t.status, strftime('%d/%m/%Y', t.criado_em) as data
      FROM tickets t WHERE t.cliente_id = ? ORDER BY t.criado_em DESC
    `, [req.session.userId]).recordset;

    const result = tickets.map(t => {
      const ultima = query('SELECT mensagem FROM ticket_mensagens WHERE ticket_id = ? ORDER BY criado_em DESC LIMIT 1', [t.id]).recordset[0];
      return { ...t, ultima_msg: ultima?.mensagem || '' };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.get('/:id', (req, res) => {
  try {
    const ticket = query('SELECT * FROM tickets WHERE id = ? AND cliente_id = ?', [req.params.id, req.session.userId]).recordset[0];
    if (!ticket) return res.status(404).json({ message: 'Não encontrado.' });
    const msgs = query("SELECT autor, mensagem, strftime('%d/%m/%Y %H:%M', criado_em) as data FROM ticket_mensagens WHERE ticket_id = ? ORDER BY criado_em", [req.params.id]).recordset;
    res.json({ ...ticket, mensagens: msgs });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.post('/', (req, res) => {
  const { titulo, mensagem, projeto_id } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    query('INSERT INTO tickets (cliente_id, projeto_id, titulo, mensagem) VALUES (?,?,?,?)',
      [req.session.userId, projeto_id || null, titulo, mensagem]);
    const ticketId = getLastId();
    query('INSERT INTO ticket_mensagens (ticket_id, autor, mensagem) VALUES (?,?,?)',
      [ticketId, 'cliente', mensagem]);
    query('INSERT INTO atividades (cliente_id, texto) VALUES (?,?)',
      [req.session.userId, `Ticket aberto: "${titulo}"`]);
    res.status(201).json({ message: 'Ticket criado com sucesso!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
