const db = require('../database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

const authController = {
    login: (req, res) => {
        const { email, senha } = req.body;

        db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, usuario) => {
            if (err) {
                console.error('Erro ao buscar usuário:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }

            if (!usuario) {
                return res.status(401).json({ erro: 'Email ou senha inválidos' });
            }

            const senhaValida = await bcrypt.compare(senha, usuario.senha);
            if (!senhaValida) {
                return res.status(401).json({ erro: 'Email ou senha inválidos' });
            }

            // Gerar token JWT
            const token = jwt.sign(
                { 
                    id: usuario.id, 
                    email: usuario.email,
                    cargo: usuario.cargo 
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            // Enviar token nos cookies e no corpo da resposta
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 8 * 60 * 60 * 1000 // 8 horas
            });

            res.json({
                token,
                usuario: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    cargo: usuario.cargo
                }
            });
        });
    },

    logout: (req, res) => {
        res.clearCookie('token');
        res.json({ mensagem: 'Logout realizado com sucesso' });
    },

    verificarToken: (req, res, next) => {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ erro: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.usuario = decoded;
            next();
        } catch (error) {
            return res.status(401).json({ erro: 'Token inválido' });
        }
    }
};

module.exports = authController; 