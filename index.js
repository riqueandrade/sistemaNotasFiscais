const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'",
                "'unsafe-eval'",
                "https://cdn.jsdelivr.net",
                "https://code.jquery.com",
                "https://cdnjs.cloudflare.com"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            fontSrc: ["'self'", 
                "https://cdnjs.cloudflare.com",
                "https://fonts.gstatic.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://sistemanotasfiscais.onrender.com"]
        }
    }
}));

// Configurar CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    // Responder a requisições OPTIONS
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
}));

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/notas', require('./routes/notasFiscais'));
app.use('/api/configuracoes', require('./routes/configuracoes'));

// Rota padrão para o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'html', 'login.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro:', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // limite por IP
});

app.use('/api/', limiter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 