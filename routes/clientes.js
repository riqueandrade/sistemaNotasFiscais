const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');

// Rotas serão implementadas posteriormente
router.get('/', (req, res) => {
    res.json({ mensagem: 'Rota de clientes - Em construção' });
});

module.exports = router; 