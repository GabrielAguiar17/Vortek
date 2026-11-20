const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const { db }  = require('../database/db');

router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ message: 'Preencha todos os campos.' });
  try {
    const user = db.prepare('SELECT * FROM clientes WHERE email = ? AND ativo = 1').get(email);
    if (!user) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    if (!bcrypt.compareSync(senha, user.senha_hash)) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
    req.session.userId = user.id;
    req.session.nome   = user.nome;
    req.session.email  = user.email;
    res.json({ message: 'Login realizado.', nome: user.nome });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ message: 'Não autenticado.' });
  res.json({ id: req.session.userId, nome: req.session.nome, email: req.session.email });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout realizado.' });
  });
});

module.exports = router;
