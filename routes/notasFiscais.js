const express = require('express');
const router = express.Router();
const notasFiscaisController = require('../controllers/notasFiscaisController');

// Listar todas as notas
router.get('/', notasFiscaisController.listarNotas);

// Buscar nota por ID
router.get('/:id', notasFiscaisController.buscarNota);

// Emitir nova nota
router.post('/', notasFiscaisController.emitirNota);

// Gerar PDF da nota
router.get('/:id/pdf', notasFiscaisController.gerarPDF);

// Excluir nota (cancelar)
router.delete('/:id', notasFiscaisController.excluirNota);

module.exports = router; 