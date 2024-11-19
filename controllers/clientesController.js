const db = require('../database');

const clientesController = {
    // Listar todos os clientes
    listarClientes: (req, res) => {
        const sql = 'SELECT * FROM clientes ORDER BY nome';
        db.all(sql, [], (err, clientes) => {
            if (err) {
                console.error('Erro ao buscar clientes:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            res.json(clientes);
        });
    },

    // Buscar cliente por ID
    buscarCliente: (req, res) => {
        const { id } = req.params;
        const sql = 'SELECT * FROM clientes WHERE id_cliente = ?';
        
        db.get(sql, [id], (err, cliente) => {
            if (err) {
                console.error('Erro ao buscar cliente:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            if (!cliente) {
                return res.status(404).json({ erro: 'Cliente não encontrado' });
            }
            res.json(cliente);
        });
    },

    // Cadastrar novo cliente
    cadastrarCliente: (req, res) => {
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

        // Verificar se CPF/CNPJ já existe
        db.get('SELECT id_cliente FROM clientes WHERE cpf_cnpj = ?', [cpf_cnpj], (err, cliente) => {
            if (err) {
                console.error('Erro ao verificar CPF/CNPJ:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            
            if (cliente) {
                return res.status(400).json({ erro: 'CPF/CNPJ já cadastrado' });
            }

            const sql = `
                INSERT INTO clientes (
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
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [
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
            ], function(err) {
                if (err) {
                    console.error('Erro ao cadastrar cliente:', err);
                    return res.status(500).json({ erro: 'Erro ao cadastrar cliente' });
                }
                res.status(201).json({
                    id: this.lastID,
                    mensagem: 'Cliente cadastrado com sucesso'
                });
            });
        });
    },

    // Atualizar cliente
    atualizarCliente: (req, res) => {
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
        
        // Verificar se CPF/CNPJ já existe em outro cliente
        db.get('SELECT id_cliente FROM clientes WHERE cpf_cnpj = ? AND id_cliente != ?', 
            [cpf_cnpj, id], (err, cliente) => {
            if (err) {
                console.error('Erro ao verificar CPF/CNPJ:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            
            if (cliente) {
                return res.status(400).json({ erro: 'CPF/CNPJ já cadastrado para outro cliente' });
            }

            const sql = `
                UPDATE clientes 
                SET nome = ?, 
                    cpf_cnpj = ?, 
                    telefone = ?, 
                    email = ?, 
                    cep = ?,
                    rua = ?,
                    numero = ?,
                    complemento = ?,
                    bairro = ?,
                    cidade = ?,
                    estado = ?
                WHERE id_cliente = ?
            `;
            
            db.run(sql, [
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
                estado,
                id
            ], function(err) {
                if (err) {
                    console.error('Erro ao atualizar cliente:', err);
                    return res.status(500).json({ erro: 'Erro ao atualizar cliente' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ erro: 'Cliente não encontrado' });
                }
                res.json({ mensagem: 'Cliente atualizado com sucesso' });
            });
        });
    },

    // Excluir cliente
    excluirCliente: (req, res) => {
        const { id } = req.params;
        
        // Verificar se o cliente possui notas fiscais
        db.get('SELECT COUNT(*) as count FROM notas_fiscais WHERE id_cliente = ?', [id], (err, result) => {
            if (err) {
                console.error('Erro ao verificar notas fiscais:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            
            if (result.count > 0) {
                return res.status(400).json({ 
                    erro: 'Não é possível excluir o cliente pois ele possui notas fiscais vinculadas' 
                });
            }

            db.run('DELETE FROM clientes WHERE id_cliente = ?', [id], function(err) {
                if (err) {
                    console.error('Erro ao excluir cliente:', err);
                    return res.status(500).json({ erro: 'Erro ao excluir cliente' });
                }
                if (this.changes === 0) {
                    return res.status(404).json({ erro: 'Cliente não encontrado' });
                }
                res.json({ mensagem: 'Cliente excluído com sucesso' });
            });
        });
    }
};

module.exports = clientesController; 