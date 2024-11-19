const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        return;
    }
    console.log('Conectado ao banco de dados SQLite');
    
    // Criar tabelas
    db.serialize(() => {
        // Tabela de usuários
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            cargo TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Criar usuário admin padrão se não existir
        const senhaHash = bcrypt.hashSync('admin123', 10);
        db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@exemplo.com'], (err, usuario) => {
            if (!usuario) {
                db.run(`
                    INSERT INTO usuarios (nome, email, senha, cargo)
                    VALUES (?, ?, ?, ?)
                `, ['Administrador', 'admin@exemplo.com', senhaHash, 'admin']);
            }
        });

        // Outras tabelas existentes...
    });
});

module.exports = db; 