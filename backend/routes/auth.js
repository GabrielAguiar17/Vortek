const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const db      = require('../database/db');

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ message: 'Preencha todos os campos.' });

  try {
    const result = await db.query('SELECT * FROM clientes WHERE email = @email', { email });
    const user   = result.recordset?.[0];
    if (!user) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ message: 'E-mail ou senha incorretos.' });

    req.session.userId = user.id;
    req.session.nome   = user.nome;
    req.session.email  = user.email;

    res.json({ message: 'Login realizado.', nome: user.nome });
  } catch (e) {
    console.error('Erro login:', e);
    res.status(500).json({ message: 'Erro interno. Tente novamente.' });
  }
});

/* GET /api/auth/me — verifica sessão */
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Não autenticado.' });
  res.json({ id: req.session.userId, nome: req.session.nome, email: req.session.email });
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout realizado.' });
  });
});

module.exports = router;
