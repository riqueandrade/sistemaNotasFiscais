const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        return;
    }
    console.log('Conectado ao banco de dados SQLite');
    
    // Criar tabelas
    db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id_produto INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        categoria TEXT NOT NULL,
        preco_venda DECIMAL(10,2) NOT NULL,
        estoque INTEGER NOT NULL,
        descricao TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf_cnpj TEXT NOT NULL,
        endereco TEXT NOT NULL,
        contato TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notas_fiscais (
        id_nota INTEGER PRIMARY KEY AUTOINCREMENT,
        id_cliente INTEGER NOT NULL,
        data_emissao DATETIME DEFAULT CURRENT_TIMESTAMP,
        subtotal DECIMAL(10,2) NOT NULL,
        impostos DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS itens_nota_fiscal (
        id_item INTEGER PRIMARY KEY AUTOINCREMENT,
        id_nota INTEGER NOT NULL,
        id_produto INTEGER NOT NULL,
        quantidade INTEGER NOT NULL,
        preco_unitario DECIMAL(10,2) NOT NULL,
        subtotal_item DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (id_nota) REFERENCES notas_fiscais(id_nota),
        FOREIGN KEY (id_produto) REFERENCES produtos(id_produto)
    )`);
});

module.exports = db; 