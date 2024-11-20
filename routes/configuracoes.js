const express = require('express');
const router = express.Router();
const configuracoesController = require('../controllers/configuracoesController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', configuracoesController.buscarConfiguracoes);
router.post('/', configuracoesController.salvarConfiguracoes);

module.exports = router; 