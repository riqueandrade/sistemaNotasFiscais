const { pool } = require('../database');

const configuracoesController = {
    // Buscar configurações
    buscarConfiguracoes: async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1'
            );
            res.json(result.rows[0] || {});
        } catch (err) {
            console.error('Erro ao buscar configurações:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    // Salvar configurações
    salvarConfiguracoes: async (req, res) => {
        const {
            aliquotaPadrao,
            icms,
            razaoSocial,
            cnpj,
            ie,
            cep,
            rua,
            numero,
            complemento,
            bairro,
            cidade,
            estado
        } = req.body;

        try {
            const result = await pool.query(
                `INSERT INTO configuracoes (
                    aliquotaPadrao, icms, razaoSocial, cnpj, ie,
                    cep, rua, numero, complemento, bairro, cidade, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id`,
                [
                    aliquotaPadrao,
                    icms,
                    razaoSocial,
                    cnpj,
                    ie,
                    cep,
                    rua,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado
                ]
            );

            res.json({ 
                mensagem: 'Configurações salvas com sucesso',
                id: result.rows[0].id 
            });
        } catch (err) {
            console.error('Erro ao salvar configurações:', err);
            res.status(500).json({ erro: 'Erro ao salvar configurações' });
        }
    }
};

module.exports = configuracoesController; 