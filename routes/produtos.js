const express = require('express');
const router = express.Router();
const produtosController = require('../controllers/produtosController');
const authMiddleware = require('../middleware/auth');

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Rotas
router.get('/', produtosController.listarProdutos);
router.post('/', produtosController.cadastrarProduto);
router.get('/:id', produtosController.buscarProduto);
router.put('/:id', produtosController.atualizarProduto);
router.delete('/:id', produtosController.excluirProduto);

module.exports = router; 