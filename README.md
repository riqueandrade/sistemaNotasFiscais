# Sistema de Notas Fiscais

Sistema web completo para gerenciamento e emissão de notas fiscais desenvolvido com Node.js, Express e PostgreSQL.

## Funcionalidades

### Autenticação
- Login seguro com JWT
- Proteção de rotas
- Gerenciamento de sessão

### Produtos
- Cadastro e gerenciamento de produtos
- Controle de estoque
- Categorização (Celular/Acessório)
- Busca e filtros

### Clientes
- Cadastro completo de clientes
- Validação de CPF/CNPJ
- Integração com API de CEP
- Endereçamento completo

### Notas Fiscais
- Emissão de notas fiscais
- Seleção de clientes e produtos
- Cálculo automático de impostos
- Geração de PDF
- Visualização detalhada
- Cancelamento de notas

### Configurações
- Dados da empresa emissora
- Alíquotas padrão de impostos
- Personalização do documento

## Tecnologias

### Backend
- Node.js
- Express
- PostgreSQL (Render)
- JWT para autenticação
- PDFKit para geração de PDF

### Frontend
- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Select2
- Font Awesome
- jQuery + InputMask

## Instalação

1. Clone o repositório
```bash
git clone https://github.com/riqueandrade/sistemaNotasFiscais
```

2. Instale as dependências
```bash
npm install
```

3. Configure o arquivo .env
```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=seu_jwt_secret
DB_URL=sua_url_do_postgres
```

4. Inicie o servidor
```bash
npm start
```

## Estrutura do Projeto
├── controllers/ # Controladores da aplicação
├── middleware/ # Middlewares (auth, etc)
├── public/ # Arquivos estáticos
│ ├── css/ # Estilos
│ ├── js/ # Scripts
│ └── html/ # Páginas
├── routes/ # Rotas da API
├── database.js # Configuração do banco
└── index.js # Entrada da aplicação

## Recursos

- Interface responsiva
- Validações em tempo real
- Feedback visual
- Máscaras de input
- Proteção contra SQL Injection
- Documentação automática

## Deploy

O sistema está hospedado no Render com:
- PostgreSQL gerenciado
- SSL/TLS
- Backup automático
- Monitoramento

## Licença

MIT

## Contato

- WhatsApp: [47988231069](https://wa.me/5547988231069)