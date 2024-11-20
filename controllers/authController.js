const { pool } = require('../database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';

const authController = {
    login: async (req, res) => {
        try {
            const { email, senha } = req.body;

            // Verificar se recebeu os dados necessários
            if (!email || !senha) {
                return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
            }

            // Usar try/catch específico para a query
            try {
                const result = await pool.query(
                    'SELECT * FROM usuarios WHERE email = $1',
                    [email]
                );

                const usuario = result.rows[0];

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
            } catch (dbError) {
                console.error('Erro na consulta ao banco:', dbError);
                return res.status(500).json({ erro: 'Erro ao consultar banco de dados' });
            }
        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    logout: (req, res) => {
        res.clearCookie('token');
        res.json({ mensagem: 'Logout realizado com sucesso' });
    },

    alterarSenha: async (req, res) => {
        const { senhaAtual, novaSenha } = req.body;
        const userId = req.usuario.id;

        try {
            // Buscar usuário
            const result = await pool.query(
                'SELECT * FROM usuarios WHERE id = $1',
                [userId]
            );

            console.log('Usuário encontrado:', result.rows[0]); // Debug

            const usuario = result.rows[0];
            if (!usuario) {
                return res.status(404).json({ erro: 'Usuário não encontrado' });
            }

            // Verificar senha atual
            const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
            if (!senhaValida) {
                return res.status(401).json({ erro: 'Senha atual incorreta' });
            }

            // Gerar hash da nova senha
            const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

            // Atualizar senha
            await pool.query(
                'UPDATE usuarios SET senha = $1 WHERE id = $2',
                [novaSenhaHash, userId]
            );

            res.json({ mensagem: 'Senha alterada com sucesso' });
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            res.status(500).json({ erro: 'Erro ao alterar senha' });
        }
    }
};

module.exports = authController; 