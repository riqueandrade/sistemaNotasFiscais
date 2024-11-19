const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');

// Listar todos os clientes
router.get('/', clientesController.listarClientes);

// Buscar cliente por ID
router.get('/:id', clientesController.buscarCliente);

// Cadastrar novo cliente
router.post('/', clientesController.cadastrarCliente);

// Atualizar cliente
router.put('/:id', clientesController.atualizarCliente);

// Excluir cliente
router.delete('/:id', clientesController.excluirCliente);

module.exports = router; 