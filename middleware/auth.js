const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

async function authMiddleware(req, res, next) {
    try {
        let token = null;
        
        if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        else if (req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            console.log('Token não fornecido');
            return res.status(401).json({ erro: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('Token decodificado:', decoded);

            if (!decoded.id) {
                console.error('Token não contém ID do usuário:', decoded);
                return res.status(401).json({ erro: 'Token inválido' });
            }

            req.usuario = {
                id: decoded.id,
                email: decoded.email,
                cargo: decoded.cargo
            };

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