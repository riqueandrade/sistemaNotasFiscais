const { pool } = require('../database');

const clientesController = {
    // Listar todos os clientes
    listarClientes: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM clientes ORDER BY nome');
            res.json(result.rows);
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    // Buscar cliente por ID
    buscarCliente: async (req, res) => {
        const { id } = req.params;
        try {
            const result = await pool.query(
                'SELECT * FROM clientes WHERE id_cliente = $1',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ erro: 'Cliente não encontrado' });
            }
            
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Erro ao buscar cliente:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    // Cadastrar novo cliente
    cadastrarCliente: async (req, res) => {
        const { 
            nome, 
            cpf_cnpj, 
            telefone, 
            email, 
            cep,
            rua,
            numero,
            complemento,
            bairro,
            cidade,
            estado
        } = req.body;

        try {
            // Verificar se CPF/CNPJ já existe
            const checkResult = await pool.query(
                'SELECT id_cliente FROM clientes WHERE cpf_cnpj = $1',
                [cpf_cnpj]
            );
            
            if (checkResult.rows.length > 0) {
                return res.status(400).json({ erro: 'CPF/CNPJ já cadastrado' });
            }

            const result = await pool.query(
                `INSERT INTO clientes (
                    nome, cpf_cnpj, telefone, email, cep, rua, numero,
                    complemento, bairro, cidade, estado
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id_cliente`,
                [
                    nome, cpf_cnpj, telefone, email, cep, rua, numero,
                    complemento, bairro, cidade, estado
                ]
            );
            
            res.status(201).json({
                id: result.rows[0].id_cliente,
                mensagem: 'Cliente cadastrado com sucesso'
            });
        } catch (err) {
            console.error('Erro ao cadastrar cliente:', err);
            res.status(500).json({ erro: 'Erro ao cadastrar cliente' });
        }
    },

    // Atualizar cliente
    atualizarCliente: async (req, res) => {
        const { id } = req.params;
        const { 
            nome, 
            cpf_cnpj, 
            telefone, 
            email, 
            cep,
            rua,
            numero,
            complemento,
            bairro,
            cidade,
            estado
        } = req.body;
        
        try {
            // Verificar se CPF/CNPJ já existe em outro cliente
            const checkResult = await pool.query(
                'SELECT id_cliente FROM clientes WHERE cpf_cnpj = $1 AND id_cliente != $2',
                [cpf_cnpj, id]
            );
            
            if (checkResult.rows.length > 0) {
                return res.status(400).json({ erro: 'CPF/CNPJ já cadastrado para outro cliente' });
            }

            const result = await pool.query(
                `UPDATE clientes 
                SET nome = $1, cpf_cnpj = $2, telefone = $3, email = $4,
                    cep = $5, rua = $6, numero = $7, complemento = $8,
                    bairro = $9, cidade = $10, estado = $11
                WHERE id_cliente = $12
                RETURNING *`,
                [
                    nome, cpf_cnpj, telefone, email, cep, rua, numero,
                    complemento, bairro, cidade, estado, id
                ]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ erro: 'Cliente não encontrado' });
            }
            
            res.json({ mensagem: 'Cliente atualizado com sucesso' });
        } catch (err) {
            console.error('Erro ao atualizar cliente:', err);
            res.status(500).json({ erro: 'Erro ao atualizar cliente' });
        }
    },

    // Excluir cliente
    excluirCliente: async (req, res) => {
        const { id } = req.params;
        
        try {
            // Verificar se o cliente possui notas fiscais
            const checkResult = await pool.query(
                'SELECT COUNT(*) as count FROM notas_fiscais WHERE id_cliente = $1',
                [id]
            );
            
            if (checkResult.rows[0].count > 0) {
                return res.status(400).json({ 
                    erro: 'Não é possível excluir o cliente pois ele possui notas fiscais vinculadas' 
                });
            }

            const result = await pool.query(
                'DELETE FROM clientes WHERE id_cliente = $1 RETURNING *',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ erro: 'Cliente não encontrado' });
            }
            
            res.json({ mensagem: 'Cliente excluído com sucesso' });
        } catch (err) {
            console.error('Erro ao excluir cliente:', err);
            res.status(500).json({ erro: 'Erro ao excluir cliente' });
        }
    }
};

module.exports = clientesController; 