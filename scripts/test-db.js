require('dotenv').config();
const { Pool } = require('pg');

const config = {
    connectionString: process.env.DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
};

async function testDatabaseConnection() {
    const pool = new Pool(config);
    
    try {
        console.log('Tentando conectar ao banco de dados...');
        const client = await pool.connect();
        console.log('Conexão bem sucedida!');
        
        const result = await client.query('SELECT NOW()');
        console.log('Teste de query:', result.rows[0]);
        
        client.release();
        await pool.end();
        
        return true;
    } catch (err) {
        console.error('Erro ao conectar:', err);
        return false;
    }
}

testDatabaseConnection()
    .then(success => {
        if (!success) process.exit(1);
        process.exit(0);
    }); 