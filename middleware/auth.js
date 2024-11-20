const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

async function authMiddleware(req, res, next) {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ erro: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.usuario = decoded;
            next();
        } catch (error) {
            console.error('Erro na verificação do token:', error);
            return res.status(401).json({ erro: 'Token inválido' });
        }
    } catch (error) {
        console.error('Erro no middleware de autenticação:', error);
        return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
}

module.exports = authMiddleware; 