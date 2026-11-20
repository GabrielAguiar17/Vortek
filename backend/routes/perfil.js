const express     = require('express');
const bcrypt      = require('bcryptjs');
const router      = express.Router();
const { db }      = require('../database/db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  try {
    const user = db.prepare('SELECT id, nome, email, telefone, criado_em FROM clientes WHERE id = ?').get(req.session.userId);
    res.json(user);
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.put('/', (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ message: 'Nome é obrigatório.' });
  try {
    db.prepare('UPDATE clientes SET nome = ?, telefone = ? WHERE id = ?').run(nome, telefone || null, req.session.userId);
    req.session.nome = nome;
    res.json({ message: 'Perfil atualizado com sucesso!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

router.put('/senha', (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha || nova_senha.length < 6)
    return res.status(400).json({ message: 'Nova senha deve ter pelo menos 6 caracteres.' });
  try {
    const user = db.prepare('SELECT senha_hash FROM clientes WHERE id = ?').get(req.session.userId);
    if (!bcrypt.compareSync(senha_atual, user.senha_hash))
      return res.status(400).json({ message: 'Senha atual incorreta.' });
    const hash = bcrypt.hashSync(nova_senha, 12);
    db.prepare('UPDATE clientes SET senha_hash = ? WHERE id = ?').run(hash, req.session.userId);
    res.json({ message: 'Senha alterada com sucesso!' });
  } catch(e) { res.status(500).json({ message: 'Erro.' }); }
});

module.exports = router;
