const express = require('express');
const router = express.Router();
const notasFiscaisController = require('../controllers/notasFiscaisController');

// Rotas serão implementadas posteriormente
router.get('/', (req, res) => {
    res.json({ mensagem: 'Rota de notas fiscais - Em construção' });
});

module.exports = router; 