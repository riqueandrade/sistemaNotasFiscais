const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Remover o ?ssl=true da URL e colocar na configuração
const dbUrl = process.env.DB_URL;

// Configuração do pool com SSL e timeout ajustado
const config = {
    connectionString: dbUrl,
    ssl: {
        rejectUnauthorized: false // Necessário para conexão com Render
    },
    connectionTimeoutMillis: 10000, // 10 segundos
    idleTimeoutMillis: 30000,
    max: 20 // Número máximo de conexões no pool
};

const pool = new Pool(config);

// Melhorar o log de erros
pool.on('error', (err, client) => {
    console.error('Erro inesperado no pool de conexões:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        detail: err.detail
    });
    if (client) {
        client.release(true);
    }
});

// Função para testar conexão com retry
async function testConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const client = await pool.connect();
            console.log('Conexão com o banco de dados estabelecida com sucesso!');
            const result = await client.query('SELECT NOW()');
            console.log('Teste de query bem sucedido:', result.rows[0]);
            client.release();
            return true;
        } catch (err) {
            console.error(`Tentativa ${i + 1}/${retries} falhou:`, {
                message: err.message,
                code: err.code,
                stack: err.stack
            });
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    return false;
}

// Função para criar as tabelas
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Configurar timezone
        const dbName = dbUrl.split('/').pop().split('?')[0];
        await client.query(`
            ALTER DATABASE "${dbName}" 
            SET timezone TO 'America/Sao_Paulo'
        `);
        
        // Criar ou atualizar função para timestamp automático
        await client.query(`
            CREATE OR REPLACE FUNCTION trigger_set_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Tabela de usuários
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha VARCHAR(255) NOT NULL,
                cargo VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de clientes
        await client.query(`
            CREATE TABLE IF NOT EXISTS clientes (
                id_cliente SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                cpf_cnpj VARCHAR(20) UNIQUE NOT NULL,
                telefone VARCHAR(20),
                email VARCHAR(255),
                cep VARCHAR(10),
                rua VARCHAR(255),
                numero VARCHAR(20),
                complemento VARCHAR(255),
                bairro VARCHAR(255),
                cidade VARCHAR(255),
                estado VARCHAR(2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de produtos
        await client.query(`
            CREATE TABLE IF NOT EXISTS produtos (
                id_produto SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                categoria VARCHAR(50) NOT NULL,
                preco_venda DECIMAL(10,2) NOT NULL,
                estoque INTEGER NOT NULL,
                descricao TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de notas fiscais
        await client.query(`
            CREATE TABLE IF NOT EXISTS notas_fiscais (
                id_nota SERIAL PRIMARY KEY,
                id_cliente INTEGER NOT NULL REFERENCES clientes(id_cliente),
                data_emissao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                subtotal DECIMAL(10,2) NOT NULL,
                impostos DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'emitida',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de itens da nota fiscal
        await client.query(`
            CREATE TABLE IF NOT EXISTS itens_nota_fiscal (
                id_item SERIAL PRIMARY KEY,
                id_nota INTEGER NOT NULL REFERENCES notas_fiscais(id_nota) ON DELETE CASCADE,
                id_produto INTEGER NOT NULL REFERENCES produtos(id_produto),
                quantidade INTEGER NOT NULL,
                preco_unitario DECIMAL(10,2) NOT NULL,
                subtotal_item DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de configurações
        await client.query(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                id SERIAL PRIMARY KEY,
                aliquotapadrao DECIMAL(5,2) NOT NULL,
                icms DECIMAL(5,2) NOT NULL,
                razaosocial VARCHAR(255) NOT NULL,
                cnpj VARCHAR(20) NOT NULL,
                ie VARCHAR(20),
                cep VARCHAR(10) NOT NULL,
                rua VARCHAR(255) NOT NULL,
                numero VARCHAR(20) NOT NULL,
                complemento VARCHAR(255),
                bairro VARCHAR(255) NOT NULL,
                cidade VARCHAR(255) NOT NULL,
                estado VARCHAR(2) NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query('COMMIT');
        console.log('Banco de dados inicializado com sucesso!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao inicializar banco de dados:', err);
        throw err;
    } finally {
        client.release();
    }
}

// Testar conexão ao inicializar
testConnection()
    .then(success => {
        if (success) {
            console.log('Banco de dados conectado e pronto para uso');
            return initDatabase();
        }
        throw new Error('Falha ao conectar ao banco de dados após várias tentativas');
    })
    .catch(err => {
        console.error('Erro fatal na inicialização do banco:', err);
        process.exit(1);
    });

// Exportar o pool e outras funções
module.exports = {
    pool,
    testConnection,
    initDatabase
};