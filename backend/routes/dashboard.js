const express     = require('express');
const router      = express.Router();
const { db }      = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/stats', (req, res) => {
  try {
    const id = req.session.userId;
    const projetos  = db.prepare("SELECT COUNT(*) as n, AVG(CAST(progresso AS REAL)) as avg FROM projetos WHERE cliente_id = ? AND status != 'Concluído'").get(id);
    const arquivos  = db.prepare("SELECT COUNT(*) as n FROM arquivos a JOIN projetos p ON a.projeto_id = p.id WHERE p.cliente_id = ?").get(id);
    const tickets   = db.prepare("SELECT COUNT(*) as n FROM tickets WHERE cliente_id = ? AND status = 'Aberto'").get(id);
    res.json({ projetos: projetos.n, progresso: Math.round(projetos.avg || 0), arquivos: arquivos.n, tickets: tickets.n });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.get('/atividades', (req, res) => {
  try {
    const rows = db.prepare("SELECT texto, strftime('%d/%m/%Y %H:%M', criado_em) as data FROM atividades WHERE cliente_id = ? ORDER BY criado_em DESC LIMIT 10").all(req.session.userId);
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
