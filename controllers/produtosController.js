const { pool } = require('../database');

const produtosController = {
    // Listar todos os produtos
    listarProdutos: async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM produtos ORDER BY nome');
            res.json(result.rows);
        } catch (err) {
            console.error('Erro ao buscar produtos:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    // Cadastrar novo produto
    cadastrarProduto: async (req, res) => {
        const { nome, categoria, preco_venda, estoque, descricao } = req.body;
        
        try {
            // Converter para números
            const precoVendaNum = parseFloat(preco_venda);
            const estoqueNum = parseInt(estoque);

            // Validar valores
            if (isNaN(precoVendaNum) || precoVendaNum <= 0) {
                return res.status(400).json({ erro: 'Preço de venda inválido' });
            }

            if (isNaN(estoqueNum) || estoqueNum < 0) {
                return res.status(400).json({ erro: 'Estoque inválido' });
            }

            const result = await pool.query(
                `INSERT INTO produtos (nome, categoria, preco_venda, estoque, descricao)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id_produto`,
                [nome, categoria, precoVendaNum, estoqueNum, descricao]
            );
            
            res.status(201).json({ 
                id: result.rows[0].id_produto,
                mensagem: 'Produto cadastrado com sucesso'
            });
        } catch (err) {
            console.error('Erro ao cadastrar produto:', err);
            res.status(500).json({ erro: 'Erro ao cadastrar produto' });
        }
    },

    // Buscar produto por ID
    buscarProduto: async (req, res) => {
        const { id } = req.params;
        
        try {
            const result = await pool.query(
                'SELECT * FROM produtos WHERE id_produto = $1',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ erro: 'Produto não encontrado' });
            }
            
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Erro ao buscar produto:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    },

    // Atualizar produto
    atualizarProduto: async (req, res) => {
        const { id } = req.params;
        const { nome, categoria, preco_venda, estoque, descricao } = req.body;
        
        try {
            const result = await pool.query(
                `UPDATE produtos 
                 SET nome = $1, categoria = $2, preco_venda = $3, 
                     estoque = $4, descricao = $5
                 WHERE id_produto = $6
                 RETURNING *`,
                [nome, categoria, preco_venda, estoque, descricao, id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ erro: 'Produto não encontrado' });
            }
            
            res.json({ mensagem: 'Produto atualizado com sucesso' });
        } catch (err) {
            console.error('Erro ao atualizar produto:', err);
            res.status(500).json({ erro: 'Erro ao atualizar produto' });
        }
    },

    // Excluir produto
    excluirProduto: async (req, res) => {
        const { id } = req.params;
        
        try {
            // Verificar se o produto está em alguma nota fiscal
            const checkResult = await pool.query(
                'SELECT COUNT(*) as count FROM itens_nota_fiscal WHERE id_produto = $1',
                [id]
            );
            
            if (checkResult.rows[0].count > 0) {
                return res.status(400).json({ 
                    erro: 'Não é possível excluir o produto pois ele está vinculado a notas fiscais' 
                });
            }

            const result = await pool.query(
                'DELETE FROM produtos WHERE id_produto = $1 RETURNING *',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ erro: 'Produto não encontrado' });
            }
            
            res.json({ mensagem: 'Produto excluído com sucesso' });
        } catch (err) {
            console.error('Erro ao excluir produto:', err);
            res.status(500).json({ erro: 'Erro ao excluir produto' });
        }
    }
};

module.exports = produtosController; 