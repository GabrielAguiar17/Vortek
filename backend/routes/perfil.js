const express     = require('express');
const bcrypt      = require('bcryptjs');
const router      = express.Router();
const db          = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, nome, email, telefone, criado_em FROM clientes WHERE id = @id',
      { id: req.session.userId }
    );
    res.json(result.recordset[0]);
  } catch (e) { res.status(500).json({ message: 'Erro ao buscar perfil.' }); }
});

router.put('/', async (req, res) => {
  const { nome, telefone } = req.body;
  try {
    await db.query(
      'UPDATE clientes SET nome = @nome, telefone = @tel WHERE id = @id',
      { nome, tel: telefone, id: req.session.userId }
    );
    req.session.nome = nome;
    res.json({ message: 'Perfil atualizado.' });
  } catch (e) { res.status(500).json({ message: 'Erro ao atualizar perfil.' }); }
});

router.put('/senha', async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha || nova_senha.length < 6)
    return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' });
  try {
    const result = await db.query('SELECT senha_hash FROM clientes WHERE id = @id', { id: req.session.userId });
    const ok = await bcrypt.compare(senha_atual, result.recordset[0].senha_hash);
    if (!ok) return res.status(400).json({ message: 'Senha atual incorreta.' });
    const hash = await bcrypt.hash(nova_senha, 12);
    await db.query('UPDATE clientes SET senha_hash = @hash WHERE id = @id', { hash, id: req.session.userId });
    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (e) { res.status(500).json({ message: 'Erro ao alterar senha.' }); }
});

module.exports = router;
