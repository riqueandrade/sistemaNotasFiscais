const db = require('../database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const notasFiscaisController = {
    // Listar todas as notas
    listarNotas: (req, res) => {
        const sql = `
            SELECT 
                nf.*, 
                c.nome as cliente_nome,
                c.cpf_cnpj as cliente_cpf_cnpj
            FROM notas_fiscais nf
            JOIN clientes c ON c.id_cliente = nf.id_cliente
            ORDER BY nf.data_emissao DESC
        `;

        db.all(sql, [], async (err, notas) => {
            if (err) {
                console.error('Erro ao buscar notas:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }

            // Buscar itens para cada nota
            for (let nota of notas) {
                nota.itens = await buscarItensNota(nota.id_nota);
            }

            res.json(notas);
        });
    },

    // Buscar nota específica com todos os detalhes
    buscarNota: async (req, res) => {
        const { id } = req.params;

        try {
            // Buscar dados da nota
            const nota = await new Promise((resolve, reject) => {
                db.get(`
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
                    WHERE nf.id_nota = ?
                `, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!nota) {
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            // Buscar itens da nota
            const itens = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        i.*,
                        p.nome as produto_nome,
                        p.descricao as produto_descricao
                    FROM itens_nota_fiscal i
                    JOIN produtos p ON p.id_produto = i.id_produto
                    WHERE i.id_nota = ?
                `, [id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // Adicionar itens à nota
            nota.itens = itens;

            res.json(nota);
        } catch (error) {
            console.error('Erro ao buscar nota:', error);
            res.status(500).json({ erro: 'Erro ao buscar nota fiscal' });
        }
    },

    // Emitir nova nota
    emitirNota: async (req, res) => {
        const { id_cliente, itens, impostos } = req.body;

        try {
            // Validar cliente
            const cliente = await buscarCliente(id_cliente);
            if (!cliente) {
                return res.status(400).json({ erro: 'Cliente não encontrado' });
            }

            // Calcular totais
            let subtotal = 0;
            for (let item of itens) {
                subtotal += item.quantidade * item.preco_unitario;
            }

            const config = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1', [], (err, config) => {
                    if (err) reject(err);
                    else resolve(config);
                });
            });

            const impostos = req.body.impostos || config?.aliquotaPadrao || 10;

            const valorImpostos = (subtotal * impostos) / 100;
            const total = subtotal + valorImpostos;

            // Data atual no fuso horário brasileiro correto
            const dataEmissao = new Date().toLocaleString('pt-BR', { 
                timeZone: 'America/Sao_Paulo' 
            });

            // Iniciar transação
            await new Promise((resolve, reject) => {
                db.run('BEGIN TRANSACTION', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Inserir nota fiscal
            const notaResult = await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO notas_fiscais (
                        id_cliente, 
                        data_emissao,
                        subtotal, 
                        impostos, 
                        total
                    )
                    VALUES (?, datetime('now', 'localtime'), ?, ?, ?)
                `, [id_cliente, subtotal, valorImpostos, total], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });

            const id_nota = notaResult;

            // Inserir itens e atualizar estoque
            for (let item of itens) {
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO itens_nota_fiscal (
                            id_nota, 
                            id_produto, 
                            quantidade, 
                            preco_unitario, 
                            subtotal_item
                        ) VALUES (?, ?, ?, ?, ?)
                    `, [
                        id_nota,
                        item.id_produto,
                        item.quantidade,
                        item.preco_unitario,
                        item.quantidade * item.preco_unitario
                    ], err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Atualizar estoque
                await new Promise((resolve, reject) => {
                    db.run(`
                        UPDATE produtos 
                        SET estoque = estoque - ? 
                        WHERE id_produto = ?
                    `, [item.quantidade, item.id_produto], err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Confirmar transação
            await new Promise((resolve, reject) => {
                db.run('COMMIT', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.status(201).json({ 
                id: id_nota,
                mensagem: 'Nota fiscal emitida com sucesso' 
            });

        } catch (error) {
            // Reverter transação em caso de erro
            await new Promise(resolve => {
                db.run('ROLLBACK', () => resolve());
            });

            console.error('Erro ao emitir nota:', error);
            res.status(500).json({ erro: 'Erro ao emitir nota fiscal' });
        }
    },

    // Gerar PDF da nota
    gerarPDF: async (req, res) => {
        const { id } = req.params;

        try {
            // Buscar dados completos da nota
            const nota = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        nf.*,
                        c.nome as cliente_nome,
                        c.cpf_cnpj as cliente_cpf_cnpj,
                        c.rua,
                        c.numero,
                        c.complemento,
                        c.bairro,
                        c.cidade,
                        c.estado,
                        c.cep
                    FROM notas_fiscais nf
                    JOIN clientes c ON c.id_cliente = nf.id_cliente
                    WHERE nf.id_nota = ?
                `, [id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!nota) {
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            // Buscar itens da nota
            nota.itens = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        i.*,
                        p.nome as produto_nome,
                        p.descricao as produto_descricao
                    FROM itens_nota_fiscal i
                    JOIN produtos p ON p.id_produto = i.id_produto
                    WHERE i.id_nota = ?
                `, [id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // Formatar endereço do cliente
            const enderecoCliente = [
                nota.rua,
                nota.numero,
                nota.complemento,
                nota.bairro,
                `${nota.cidade}/${nota.estado}`,
                nota.cep
            ].filter(Boolean).join(', ');

            // Criar documento PDF
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 40,
                    bottom: 40,
                    left: 40,
                    right: 40
                }
            });

            // Configurar resposta
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=nota_fiscal_${id}.pdf`);
            doc.pipe(res);

            // Funções auxiliares
            const drawLine = (y) => {
                doc.moveTo(40, y).lineTo(555, y).stroke();
            };

            const drawRect = (x, y, w, h) => {
                doc.rect(x, y, w, h).stroke();
            };

            // Cabeçalho
            drawRect(40, 40, 515, 80);
            doc.fontSize(20)
                .font('Helvetica-Bold')
                .text('NOTA FISCAL', 40, 55, { align: 'center' });

            // Número e Data
            doc.fontSize(10)
                .font('Helvetica')
                .text(`Nº: ${nota.id_nota.toString().padStart(6, '0')}`, 400, 55)
                .text(`Emissão: ${new Date(nota.data_emissao).toLocaleDateString('pt-BR')}`, 400, 70)
                .text(`Hora: ${new Date(nota.data_emissao).toLocaleTimeString('pt-BR')}`, 400, 85);

            // Dados do Emitente
            drawRect(40, 130, 515, 100);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .fillColor('#444')
                .text('DADOS DO EMITENTE', 50, 140);

            const config = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1', [], (err, config) => {
                    if (err) reject(err);
                    else resolve(config || {});
                });
            });

            doc.fontSize(10)
                .font('Helvetica')
                .text(config.razaoSocial || 'EMPRESA EXEMPLO LTDA', 50, 160)
                .text(`CNPJ: ${config.cnpj || '00.000.000/0000-00'}`, 50, 175)
                .text(`IE: ${config.ie || ''}`, 50, 190)
                .text(`${config.rua}, ${config.numero} ${config.complemento || ''}`, 50, 205)
                .text(`${config.bairro} - ${config.cidade}/${config.estado}`, 50, 220)
                .text(`CEP: ${config.cep}`, 50, 235);

            // Dados do Cliente
            drawRect(40, 240, 515, 100);
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('DADOS DO CLIENTE', 50, 250);

            doc.fontSize(10)
                .font('Helvetica')
                .text(`Nome: ${nota.cliente_nome}`, 50, 270)
                .text(`CPF/CNPJ: ${nota.cliente_cpf_cnpj}`, 50, 285)
                .text(`Endereço: ${enderecoCliente}`, 50, 300, {
                    width: 495,
                    align: 'left'
                });

            // Tabela de Itens
            drawRect(40, 350, 515, 30);
            doc.fillColor('#f6f6f6')
                .rect(40, 350, 515, 30)
                .fill()
                .fillColor('#000');

            // Cabeçalho da tabela
            doc.fontSize(10)
                .font('Helvetica-Bold')
                .text('Item', 50, 360)
                .text('Descrição', 100, 360)
                .text('Qtd', 360, 360)
                .text('Vl. Unit.', 420, 360)
                .text('Subtotal', 480, 360);

            // Itens
            let y = 380;
            nota.itens.forEach((item, index) => {
                drawRect(40, y, 515, 25);

                doc.fontSize(9)
                    .font('Helvetica')
                    .text((index + 1).toString(), 50, y + 7)
                    .text(item.produto_nome, 100, y + 7)
                    .text(item.quantidade.toString(), 360, y + 7)
                    .text(`R$ ${item.preco_unitario.toFixed(2)}`, 420, y + 7)
                    .text(`R$ ${item.subtotal_item.toFixed(2)}`, 480, y + 7);

                y += 25;
            });

            // Totais
            y += 20;
            drawRect(315, y, 240, 90);
            doc.fillColor('#f6f6f6')
                .rect(315, y, 240, 30)
                .fill()
                .fillColor('#000');

            // Valores
            doc.fontSize(10)
                .font('Helvetica-Bold')
                .text('Subtotal:', 325, y + 10)
                .font('Helvetica')
                .text(`R$ ${nota.subtotal.toFixed(2)}`, 480, y + 10);

            doc.font('Helvetica-Bold')
                .text('Impostos:', 325, y + 40)
                .font('Helvetica')
                .text(`R$ ${nota.impostos.toFixed(2)}`, 480, y + 40);

            doc.font('Helvetica-Bold')
                .text('Total:', 325, y + 70)
                .font('Helvetica')
                .text(`R$ ${nota.total.toFixed(2)}`, 480, y + 70, {
                    underline: true
                });

            // Rodapé
            doc.fontSize(8)
                .font('Helvetica')
                .fillColor('#666')
                .text(
                    'Documento sem valor fiscal - Apenas para controle interno',
                    40,
                    doc.page.height - 50,
                    { align: 'center' }
                );

            // Finalizar PDF
            doc.end();

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            res.status(500).json({ erro: 'Erro ao gerar PDF da nota fiscal' });
        }
    },

    // Excluir (cancelar) nota
    excluirNota: async (req, res) => {
        const { id } = req.params;

        try {
            // Iniciar transação
            await new Promise((resolve, reject) => {
                db.run('BEGIN TRANSACTION', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Buscar itens da nota
            const itens = await buscarItensNota(id);

            // Restaurar estoque
            for (let item of itens) {
                await new Promise((resolve, reject) => {
                    db.run(`
                        UPDATE produtos 
                        SET estoque = estoque + ? 
                        WHERE id_produto = ?
                    `, [item.quantidade, item.id_produto], err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Excluir itens da nota
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM itens_nota_fiscal WHERE id_nota = ?', [id], err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Excluir nota
            await new Promise((resolve, reject) => {
                db.run('DELETE FROM notas_fiscais WHERE id_nota = ?', [id], function (err) {
                    if (err) reject(err);
                    else {
                        if (this.changes === 0) {
                            reject(new Error('Nota fiscal não encontrada'));
                        } else {
                            resolve();
                        }
                    }
                });
            });

            // Confirmar transação
            await new Promise((resolve, reject) => {
                db.run('COMMIT', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            res.json({ mensagem: 'Nota fiscal exclu��da com sucesso' });

        } catch (error) {
            // Reverter transação em caso de erro
            await new Promise(resolve => {
                db.run('ROLLBACK', () => resolve());
            });

            if (error.message === 'Nota fiscal não encontrada') {
                return res.status(404).json({ erro: error.message });
            }

            console.error('Erro ao excluir nota:', error);
            res.status(500).json({ erro: 'Erro ao excluir nota fiscal' });
        }
    }
};

// Funções auxiliares
async function buscarItensNota(id_nota) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                i.*,
                p.nome as produto_nome
            FROM itens_nota_fiscal i
            JOIN produtos p ON p.id_produto = i.id_produto
            WHERE i.id_nota = ?
        `, [id_nota], (err, itens) => {
            if (err) reject(err);
            else resolve(itens);
        });
    });
}

async function buscarCliente(id_cliente) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM clientes WHERE id_cliente = ?', [id_cliente], (err, cliente) => {
            if (err) reject(err);
            else resolve(cliente);
        });
    });
}

async function buscarProduto(id_produto) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM produtos WHERE id_produto = ?', [id_produto], (err, produto) => {
            if (err) reject(err);
            else resolve(produto);
        });
    });
}

async function buscarNotaCompleta(id_nota) {
    return new Promise((resolve, reject) => {
        db.get(`
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
            WHERE nf.id_nota = ?
        `, [id_nota], async (err, nota) => {
            if (err) reject(err);
            else {
                if (nota) {
                    nota.itens = await buscarItensNota(id_nota);
                }
                resolve(nota);
            }
        });
    });
}

module.exports = notasFiscaisController; 