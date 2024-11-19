const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

// Configurações
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Rotas
const produtosRoutes = require('./routes/produtos');
const clientesRoutes = require('./routes/clientes');
const notasFiscaisRoutes = require('./routes/notasFiscais');

app.use('/produtos', produtosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/notas', notasFiscaisRoutes);

// Rota principal
app.get('/', (req, res) => {
    res.render('index');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 