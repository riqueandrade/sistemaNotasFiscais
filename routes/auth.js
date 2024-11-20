const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Rotas de autenticação
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Rota protegida para alteração de senha
router.post('/alterar-senha', authMiddleware, authController.alterarSenha);

// Exportar o router
module.exports = router; 