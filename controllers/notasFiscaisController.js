const { pool } = require('../database');
const PDFDocument = require('pdfkit');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600 }); // 10 minutos

const notasFiscaisController = {
    // Listar todas as notas
    listarNotas: async (req, res) => {
        const cacheKey = 'notas_list';
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Buscar todas as notas com dados do cliente em uma única query
            const notasResult = await client.query(`
                SELECT 
                    nf.*,
                    c.nome as cliente_nome,
                    c.cpf_cnpj as cliente_cpf_cnpj,
                    json_agg(
                        json_build_object(
                            'id_produto', i.id_produto,
                            'quantidade', i.quantidade,
                            'preco_unitario', i.preco_unitario,
                            'subtotal_item', i.subtotal_item,
                            'produto_nome', p.nome
                        )
                    ) as itens
                FROM notas_fiscais nf
                JOIN clientes c ON c.id_cliente = nf.id_cliente
                LEFT JOIN itens_nota_fiscal i ON i.id_nota = nf.id_nota
                LEFT JOIN produtos p ON p.id_produto = i.id_produto
                GROUP BY nf.id_nota, c.id_cliente
                ORDER BY nf.data_emissao DESC
            `);

            await client.query('COMMIT');
            res.json(notasResult.rows);
            cache.set(cacheKey, notasResult.rows);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro ao buscar notas:', err);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        } finally {
            client.release();
        }
    },

    // Buscar nota específica
    buscarNota: async (req, res) => {
        const { id } = req.params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Buscar nota com dados do cliente em uma única query
            const notaResult = await client.query(`
                SELECT 
                    nf.*,
                    c.nome as cliente_nome,
                    c.cpf_cnpj as cliente_cpf_cnpj,
                    c.rua as cliente_rua,
                    c.numero as cliente_numero,
                    c.complemento as cliente_complemento,
                    c.bairro as cliente_bairro,
                    c.cidade as cliente_cidade,
                    c.estado as cliente_estado,
                    c.cep as cliente_cep,
                    COALESCE(json_agg(
                        CASE WHEN i.id_item IS NOT NULL THEN
                            json_build_object(
                                'id_item', i.id_item,
                                'id_produto', i.id_produto,
                                'quantidade', i.quantidade,
                                'preco_unitario', i.preco_unitario,
                                'subtotal_item', i.subtotal_item,
                                'produto_nome', p.nome,
                                'produto_descricao', p.descricao
                            )
                        END
                    ) FILTER (WHERE i.id_item IS NOT NULL), '[]') as itens
                FROM notas_fiscais nf
                JOIN clientes c ON c.id_cliente = nf.id_cliente
                LEFT JOIN itens_nota_fiscal i ON i.id_nota = nf.id_nota
                LEFT JOIN produtos p ON p.id_produto = i.id_produto
                WHERE nf.id_nota = $1
                GROUP BY nf.id_nota, c.id_cliente, c.nome, c.cpf_cnpj, c.rua, c.numero, 
                         c.complemento, c.bairro, c.cidade, c.estado, c.cep
            `, [id]);

            if (notaResult.rows.length === 0) {
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            const nota = notaResult.rows[0];

            // Converter valores numéricos
            nota.subtotal = parseFloat(nota.subtotal);
            nota.impostos = parseFloat(nota.impostos);
            nota.total = parseFloat(nota.total);

            // Converter valores numéricos dos itens
            nota.itens = nota.itens.map(item => ({
                ...item,
                quantidade: parseInt(item.quantidade),
                preco_unitario: parseFloat(item.preco_unitario),
                subtotal_item: parseFloat(item.subtotal_item)
            }));

            await client.query('COMMIT');
            res.json(nota);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro ao buscar nota:', err);
            res.status(500).json({ erro: 'Erro ao buscar nota fiscal' });
        } finally {
            client.release();
        }
    },

    // Emitir nova nota
    emitirNota: async (req, res) => {
        const { id_cliente, itens, impostos } = req.body;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verificar cliente
            const clienteResult = await client.query(
                'SELECT * FROM clientes WHERE id_cliente = $1',
                [id_cliente]
            );

            if (clienteResult.rows.length === 0) {
                throw new Error('Cliente não encontrado');
            }

            // Calcular totais
            let subtotal = 0;
            for (let item of itens) {
                subtotal += item.quantidade * item.preco_unitario;
            }

            const valorImpostos = (subtotal * impostos) / 100;
            const total = subtotal + valorImpostos;

            // Inserir nota fiscal
            const notaResult = await client.query(`
                INSERT INTO notas_fiscais (
                    id_cliente, subtotal, impostos, total
                ) VALUES ($1, $2, $3, $4)
                RETURNING id_nota
            `, [id_cliente, subtotal, valorImpostos, total]);

            const id_nota = notaResult.rows[0].id_nota;

            // Inserir itens e atualizar estoque
            for (let item of itens) {
                await client.query(`
                    INSERT INTO itens_nota_fiscal (
                        id_nota, id_produto, quantidade, 
                        preco_unitario, subtotal_item
                    ) VALUES ($1, $2, $3, $4, $5)
                `, [
                    id_nota,
                    item.id_produto,
                    item.quantidade,
                    item.preco_unitario,
                    item.quantidade * item.preco_unitario
                ]);

                // Atualizar estoque
                await client.query(`
                    UPDATE produtos 
                    SET estoque = estoque - $1 
                    WHERE id_produto = $2
                `, [item.quantidade, item.id_produto]);
            }

            await client.query('COMMIT');
            res.status(201).json({
                id: id_nota,
                mensagem: 'Nota fiscal emitida com sucesso'
            });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro ao emitir nota:', err);
            res.status(500).json({ erro: err.message || 'Erro ao emitir nota fiscal' });
        } finally {
            client.release();
        }
    },

    // Excluir (cancelar) nota
    excluirNota: async (req, res) => {
        const { id } = req.params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Buscar itens da nota
            const itensResult = await client.query(
                'SELECT * FROM itens_nota_fiscal WHERE id_nota = $1',
                [id]
            );

            // Restaurar estoque
            for (let item of itensResult.rows) {
                await client.query(`
                    UPDATE produtos 
                    SET estoque = estoque + $1 
                    WHERE id_produto = $2
                `, [item.quantidade, item.id_produto]);
            }

            // Excluir nota e itens
            const result = await client.query(
                'DELETE FROM notas_fiscais WHERE id_nota = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                throw new Error('Nota fiscal não encontrada');
            }

            await client.query('COMMIT');
            res.json({ mensagem: 'Nota fiscal excluída com sucesso' });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro ao excluir nota:', err);
            res.status(500).json({ erro: err.message || 'Erro ao excluir nota fiscal' });
        } finally {
            client.release();
        }
    },

    // Gerar PDF da nota
    gerarPDF: async (req, res) => {
        const { id } = req.params;

        try {
            console.log('Iniciando geração do PDF para nota:', id);

            // Buscar dados da nota
            const notaResult = await pool.query(`
                SELECT 
                    nf.*,
                    c.nome as cliente_nome,
                    c.cpf_cnpj as cliente_cpf_cnpj,
                    c.rua as cliente_rua,
                    c.numero as cliente_numero,
                    c.complemento as cliente_complemento,
                    c.bairro as cliente_bairro,
                    c.cidade as cliente_cidade,
                    c.estado as cliente_estado,
                    c.cep as cliente_cep
                FROM notas_fiscais nf
                JOIN clientes c ON c.id_cliente = nf.id_cliente
                WHERE nf.id_nota = $1
            `, [id]);

            console.log('Resultado da busca da nota:', notaResult.rows);

            if (notaResult.rows.length === 0) {
                console.log('Nota não encontrada:', id);
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            const nota = notaResult.rows[0];
            console.log('Dados da nota:', nota);

            // Buscar configurações da empresa
            const configResult = await pool.query(
                'SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1'
            );

            console.log('Resultado da busca de configurações:', configResult.rows);

            if (!configResult.rows[0]) {
                console.log('Configurações não encontradas');
                return res.status(400).json({ erro: 'Configurações da empresa não encontradas' });
            }

            const config = configResult.rows[0];
            console.log('Configurações:', config);

            // Buscar itens da nota
            const itensResult = await pool.query(`
                SELECT 
                    i.*,
                    p.nome as produto_nome,
                    p.descricao as produto_descricao
                FROM itens_nota_fiscal i
                JOIN produtos p ON p.id_produto = i.id_produto
                WHERE i.id_nota = $1
            `, [id]);

            console.log('Itens da nota:', itensResult.rows);

            if (itensResult.rows.length === 0) {
                console.log('Nota sem itens');
                return res.status(400).json({ erro: 'Nota fiscal sem itens' });
            }

            nota.itens = itensResult.rows;

            // Criar documento PDF
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 40,
                    bufferPages: true
                });

                // Configurar resposta
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=nota_fiscal_${id}.pdf`);

                // Pipe o PDF para a resposta
                doc.pipe(res);

                // Cabeçalho
                doc.fontSize(16)
                    .font('Helvetica-Bold')
                    .text('NOTA FISCAL', { align: 'center' })
                    .fontSize(12)
                    .text('DOCUMENTO AUXILIAR', { align: 'center' })
                    .moveDown();

                // Número e Data
                doc.fontSize(10)
                    .font('Helvetica')
                    .text(`Nº: ${nota.id_nota.toString().padStart(6, '0')}`)
                    .text(`Data: ${new Date(nota.data_emissao).toLocaleDateString('pt-BR')}`)
                    .text(`Hora: ${new Date(nota.data_emissao).toLocaleTimeString('pt-BR')}`)
                    .moveDown();

                // Dados do Emitente
                doc.font('Helvetica-Bold')
                    .text('DADOS DO EMITENTE')
                    .font('Helvetica')
                    .text(config.razaosocial)
                    .text(`CNPJ: ${formatarCpfCnpj(config.cnpj)}`)
                    .text(`IE: ${config.ie}`)
                    .text(`${config.rua}, ${config.numero}${config.complemento ? ` - ${config.complemento}` : ''}`)
                    .text(`${config.bairro} - ${config.cidade}/${config.estado}`)
                    .text(`CEP: ${formatarCep(config.cep)}`)
                    .moveDown();

                // Dados do Destinatário
                doc.font('Helvetica-Bold')
                    .text('DADOS DO DESTINATÁRIO')
                    .font('Helvetica')
                    .text(`Nome/Razão Social: ${nota.cliente_nome}`)
                    .text(`CPF/CNPJ: ${formatarCpfCnpj(nota.cliente_cpf_cnpj)}`)
                    .text(`Endereço: ${[
                        nota.cliente_rua,
                        nota.cliente_numero,
                        nota.cliente_complemento,
                        nota.cliente_bairro,
                        nota.cliente_cidade,
                        nota.cliente_estado,
                        formatarCep(nota.cliente_cep)
                    ].filter(Boolean).join(', ')}`)
                    .moveDown();

                // Tabela de Produtos
                const headers = ['Cód.', 'Descrição', 'Qtd.', 'Valor Unit.', 'Total'];
                const widths = [50, 240, 70, 90, 90];
                let xPos = 40;
                let yPos = doc.y;

                // Cabeçalho da tabela
                doc.font('Helvetica-Bold');
                headers.forEach((header, i) => {
                    doc.text(header, xPos, yPos, { width: widths[i], align: 'left' });
                    xPos += widths[i];
                });

                // Linhas de produtos
                yPos += 20;
                doc.font('Helvetica');

                for (const item of nota.itens) {
                    xPos = 40;
                    doc.text(item.id_produto.toString(), xPos, yPos, { width: widths[0] });
                    xPos += widths[0];
                    doc.text(item.produto_nome, xPos, yPos, { width: widths[1] });
                    xPos += widths[1];
                    doc.text(item.quantidade.toString(), xPos, yPos, { width: widths[2] });
                    xPos += widths[2];
                    doc.text(formatarMoeda(parseFloat(item.preco_unitario)), xPos, yPos, { width: widths[3] });
                    xPos += widths[3];
                    doc.text(formatarMoeda(parseFloat(item.subtotal_item)), xPos, yPos, { width: widths[4] });
                    yPos += 20;
                }

                // Totais
                doc.moveDown()
                    .font('Helvetica-Bold')
                    .text(`Subtotal: ${formatarMoeda(parseFloat(nota.subtotal))}`, { align: 'right' })
                    .text(`Impostos: ${formatarMoeda(parseFloat(nota.impostos))}`, { align: 'right' })
                    .text(`Total: ${formatarMoeda(parseFloat(nota.total))}`, { align: 'right' });

                // Rodapé
                doc.moveDown(2)
                    .fontSize(8)
                    .font('Helvetica')
                    .text('Documento sem valor fiscal - Apenas para controle interno', {
                        align: 'center',
                        color: 'grey'
                    });

                // Finalizar o documento
                doc.end();
                console.log('PDF gerado com sucesso');

            } catch (pdfError) {
                console.error('Erro ao gerar PDF:', pdfError);
                return res.status(500).json({ erro: 'Erro ao gerar PDF: ' + pdfError.message });
            }

        } catch (err) {
            console.error('Erro ao processar dados para PDF:', err);
            res.status(500).json({ erro: 'Erro ao gerar PDF da nota fiscal: ' + err.message });
        }
    }
};

// Funções auxiliares
function formatarCep(cep) {
    if (!cep) return '';
    cep = cep.replace(/\D/g, '');
    return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

function formatarCpfCnpj(valor) {
    if (!valor) return '';
    
    valor = valor.replace(/\D/g, '');
    if (valor.length === 11) {
        return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4');
    }
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor) {
    return `R$ ${valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

module.exports = notasFiscaisController;