const express     = require('express');
const router      = express.Router();
const { query }   = require('../database/db');
const requireAuth = require('../middleware/auth');
const path        = require('path');
const fs          = require('fs');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const rows = query(`
      SELECT a.id, a.nome, a.tamanho, a.tipo,
             strftime('%d/%m/%Y', a.enviado_em) as data, p.nome as projeto
      FROM arquivos a JOIN projetos p ON a.projeto_id = p.id
      WHERE p.cliente_id = ? ORDER BY a.enviado_em DESC
    `, [req.session.userId]).recordset;
    res.json(rows);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.get('/:id/download', (req, res) => {
  try {
    const arq = query(`
      SELECT a.* FROM arquivos a JOIN projetos p ON a.projeto_id = p.id
      WHERE a.id = ? AND p.cliente_id = ?
    `, [req.params.id, req.session.userId]).recordset[0];
    if (!arq) return res.status(404).json({ message: 'Arquivo não encontrado.' });
    const filePath = path.join(__dirname, '../../uploads', arq.caminho);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Arquivo não disponível.' });
    res.download(filePath, arq.nome);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
