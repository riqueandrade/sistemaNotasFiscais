const db = require('../database');

const produtosController = {
    // Listar todos os produtos
    listarProdutos: (req, res) => {
        const sql = 'SELECT * FROM produtos';
        db.all(sql, [], (err, produtos) => {
            if (err) {
                console.error('Erro ao buscar produtos:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            res.render('produtos/lista', { produtos });
        });
    },

    // Renderizar página de novo produto
    paginaNovoProduto: (req, res) => {
        res.render('produtos/novo');
    },

    // Cadastrar novo produto
    cadastrarProduto: (req, res) => {
        const { nome, categoria, preco_venda, estoque, descricao } = req.body;
        const sql = `
            INSERT INTO produtos (nome, categoria, preco_venda, estoque, descricao)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(sql, [nome, categoria, preco_venda, estoque, descricao], function(err) {
            if (err) {
                console.error('Erro ao cadastrar produto:', err);
                return res.status(500).json({ erro: 'Erro ao cadastrar produto' });
            }
            res.redirect('/produtos');
        });
    },

    // Renderizar página de edição
    paginaEditarProduto: (req, res) => {
        const { id } = req.params;
        const sql = 'SELECT * FROM produtos WHERE id_produto = ?';
        
        db.get(sql, [id], (err, produto) => {
            if (err) {
                console.error('Erro ao buscar produto:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            if (!produto) {
                return res.status(404).json({ erro: 'Produto não encontrado' });
            }
            res.render('produtos/editar', { produto });
        });
    },

    // Atualizar produto
    atualizarProduto: (req, res) => {
        const { id } = req.params;
        const { nome, categoria, preco_venda, estoque, descricao } = req.body;
        
        const sql = `
            UPDATE produtos 
            SET nome = ?, categoria = ?, preco_venda = ?, estoque = ?, descricao = ?
            WHERE id_produto = ?
        `;
        
        db.run(sql, [nome, categoria, preco_venda, estoque, descricao, id], function(err) {
            if (err) {
                console.error('Erro ao atualizar produto:', err);
                return res.status(500).json({ erro: 'Erro ao atualizar produto' });
            }
            res.redirect('/produtos');
        });
    },

    // Excluir produto
    excluirProduto: (req, res) => {
        const { id } = req.params;
        
        // Verificar se o produto está em alguma nota fiscal
        db.get('SELECT COUNT(*) as count FROM itens_nota_fiscal WHERE id_produto = ?', [id], (err, result) => {
            if (err) {
                console.error('Erro ao verificar produto:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }
            
            if (result.count > 0) {
                return res.status(400).json({ 
                    erro: 'Não é possível excluir o produto pois ele está vinculado a notas fiscais' 
                });
            }

            // Se não estiver vinculado, pode excluir
            db.run('DELETE FROM produtos WHERE id_produto = ?', [id], function(err) {
                if (err) {
                    console.error('Erro ao excluir produto:', err);
                    return res.status(500).json({ erro: 'Erro ao excluir produto' });
                }
                res.json({ mensagem: 'Produto excluído com sucesso' });
            });
        });
    }
};

module.exports = produtosController; 