const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// Configurações
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Configurar CORS para desenvolvimento
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    next();
});

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/notas', require('./routes/notasFiscais'));
app.use('/api/configuracoes', require('./routes/configuracoes'));

// Rotas das páginas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'login.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 