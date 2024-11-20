const db = require('../database');

const configuracoesController = {
    // Buscar configurações
    buscarConfiguracoes: (req, res) => {
        db.get('SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1', [], (err, config) => {
            if (err) {
                console.error('Erro ao buscar configurações:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            res.json(config || {});
        });
    },

    // Salvar configurações
    salvarConfiguracoes: (req, res) => {
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

        const sql = `
            INSERT INTO configuracoes (
                aliquotaPadrao, icms, razaoSocial, cnpj, ie,
                cep, rua, numero, complemento, bairro, cidade, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
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
        ], function(err) {
            if (err) {
                console.error('Erro ao salvar configurações:', err);
                return res.status(500).json({ erro: 'Erro ao salvar configurações' });
            }
            res.json({ 
                mensagem: 'Configurações salvas com sucesso',
                id: this.lastID 
            });
        });
    }
};

module.exports = configuracoesController; 