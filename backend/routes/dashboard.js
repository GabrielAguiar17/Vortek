const express     = require('express');
const router      = express.Router();
const { query }   = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/stats', (req, res) => {
  try {
    const id = req.session.userId;
    const p  = query("SELECT COUNT(*) as n, AVG(CAST(progresso AS REAL)) as avg FROM projetos WHERE cliente_id = ? AND status != 'Concluído'", [id]).recordset[0];
    const a  = query("SELECT COUNT(*) as n FROM arquivos a JOIN projetos p ON a.projeto_id = p.id WHERE p.cliente_id = ?", [id]).recordset[0];
    const t  = query("SELECT COUNT(*) as n FROM tickets WHERE cliente_id = ? AND status = 'Aberto'", [id]).recordset[0];
    res.json({ projetos: p.n || 0, progresso: Math.round(p.avg || 0), arquivos: a.n || 0, tickets: t.n || 0 });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Erro.' }); }
});

router.get('/atividades', (req, res) => {
  try {
    const rows = query("SELECT texto, strftime('%d/%m/%Y %H:%M', criado_em) as data FROM atividades WHERE cliente_id = ? ORDER BY criado_em DESC LIMIT 10", [req.session.userId]).recordset;
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
