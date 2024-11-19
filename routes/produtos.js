const express = require('express');
const router = express.Router();
const produtosController = require('../controllers/produtosController');

// Listar todos os produtos
router.get('/', produtosController.listarProdutos);

// Página de cadastro de produto
router.get('/novo', produtosController.paginaNovoProduto);

// Cadastrar novo produto
router.post('/', produtosController.cadastrarProduto);

// Página de edição de produto
router.get('/editar/:id', produtosController.paginaEditarProduto);

// Atualizar produto
router.put('/:id', produtosController.atualizarProduto);

// Excluir produto
router.delete('/:id', produtosController.excluirProduto);

module.exports = router; 