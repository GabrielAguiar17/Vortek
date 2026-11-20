const express     = require('express');
const router      = express.Router();
const { db }      = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const tickets = db.prepare(`
      SELECT t.id, t.titulo, t.status, strftime('%d/%m/%Y', t.criado_em) as data
      FROM tickets t WHERE t.cliente_id = ? ORDER BY t.criado_em DESC
    `).all(req.session.userId);
    const result = tickets.map(t => {
      const ultima = db.prepare('SELECT mensagem FROM ticket_mensagens WHERE ticket_id = ? ORDER BY criado_em DESC LIMIT 1').get(t.id);
      return { ...t, ultima_msg: ultima?.mensagem || t.titulo };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.get('/:id', (req, res) => {
  try {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ? AND cliente_id = ?').get(req.params.id, req.session.userId);
    if (!ticket) return res.status(404).json({ message: 'Não encontrado.' });
    const msgs = db.prepare("SELECT autor, mensagem, strftime('%d/%m/%Y %H:%M', criado_em) as data FROM ticket_mensagens WHERE ticket_id = ? ORDER BY criado_em").all(req.params.id);
    res.json({ ...ticket, mensagens: msgs });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.post('/', (req, res) => {
  const { titulo, mensagem, projeto_id } = req.body;
  if (!titulo || !mensagem) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    const r = db.prepare('INSERT INTO tickets (cliente_id, projeto_id, titulo, mensagem) VALUES (?,?,?,?)').run(req.session.userId, projeto_id || null, titulo, mensagem);
    db.prepare('INSERT INTO ticket_mensagens (ticket_id, autor, mensagem) VALUES (?,?,?)').run(r.lastInsertRowid, 'cliente', mensagem);
    db.prepare('INSERT INTO atividades (cliente_id, texto) VALUES (?,?)').run(req.session.userId, `Ticket aberto: "${titulo}"`);
    res.status(201).json({ message: 'Ticket criado!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
