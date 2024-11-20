const { pool } = require('../database');

const configuracoesController = {
    // Buscar configurações
    buscarConfiguracoes: async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1'
            );

            if (result.rows.length === 0) {
                return res.json({});
            }
            
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Erro ao buscar configurações:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    // Salvar configurações
    salvarConfiguracoes: async (req, res) => {
        const client = await pool.connect();
        try {
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

            await client.query('BEGIN');

            // Primeiro, excluir configurações antigas
            await client.query('DELETE FROM configuracoes');

            // Depois, inserir nova configuração
            const result = await client.query(
                `INSERT INTO configuracoes (
                    aliquotapadrao, icms, razaosocial, cnpj, ie,
                    cep, rua, numero, complemento, bairro, cidade, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id, razaosocial`,
                [
                    parseFloat(aliquotaPadrao) || 10,
                    parseFloat(icms) || 18,
                    razaoSocial || 'RAZÃO SOCIAL NÃO CONFIGURADA',
                    cnpj ? cnpj.replace(/\D/g, '') : '55581647992487',
                    ie ? ie.replace(/\D/g, '') : '452158862888',
                    cep ? cep.replace(/\D/g, '') : '83880089',
                    rua || 'Rua Thomaz Becker',
                    numero || '310',
                    complemento || '',
                    bairro || 'Centro',
                    cidade || 'Rio Negro',
                    estado || 'PR'
                ]
            );

            await client.query('COMMIT');

            res.json({ 
                mensagem: 'Configurações salvas com sucesso',
                id: result.rows[0].id,
                razaoSocial: result.rows[0].razaosocial
            });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro ao salvar configurações:', err);
            res.status(500).json({ erro: 'Erro ao salvar configurações' });
        } finally {
            client.release();
        }
    }
};

module.exports = configuracoesController; 