const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ erro: 'Acesso negado' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.usuario = verified;
        next();
    } catch (err) {
        res.status(401).json({ erro: 'Token inválido' });
    }
}

module.exports = authMiddleware; 