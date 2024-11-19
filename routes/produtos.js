const express = require('express');
const router = express.Router();
const produtosController = require('../controllers/produtosController');

// Verificar se todas as funções do controller existem
if (!produtosController.listarProdutos) {
    throw new Error('Função listarProdutos não encontrada no controller');
}

// Rotas
router.get('/', produtosController.listarProdutos);
router.post('/', produtosController.cadastrarProduto);
router.get('/:id', produtosController.buscarProduto);
router.put('/:id', produtosController.atualizarProduto);
router.delete('/:id', produtosController.excluirProduto);

module.exports = router; 