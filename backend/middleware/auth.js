/* Middleware — verifica se o usuário está autenticado */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Acesso negado. Faça login.' });
  }
  next();
}

module.exports = requireAuth;
