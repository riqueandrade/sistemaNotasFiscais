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

    // Buscar nota específica
    buscarNota: (req, res) => {
        const { id } = req.params;
        const sql = `
            SELECT 
                nf.*, 
                c.nome as cliente_nome,
                c.cpf_cnpj as cliente_cpf_cnpj,
                c.endereco as cliente_endereco
            FROM notas_fiscais nf
            JOIN clientes c ON c.id_cliente = nf.id_cliente
            WHERE nf.id_nota = ?
        `;

        db.get(sql, [id], async (err, nota) => {
            if (err) {
                console.error('Erro ao buscar nota:', err);
                return res.status(500).json({ erro: 'Erro interno do servidor' });
            }

            if (!nota) {
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            nota.itens = await buscarItensNota(nota.id_nota);
            res.json(nota);
        });
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

            // Validar produtos e estoque
            for (let item of itens) {
                const produto = await buscarProduto(item.id_produto);
                if (!produto) {
                    return res.status(400).json({ erro: `Produto ${item.id_produto} não encontrado` });
                }
                if (produto.estoque < item.quantidade) {
                    return res.status(400).json({ 
                        erro: `Estoque insuficiente para o produto ${produto.nome}` 
                    });
                }
            }

            // Calcular totais
            let subtotal = 0;
            for (let item of itens) {
                subtotal += item.quantidade * item.preco_unitario;
            }

            const valorImpostos = (subtotal * impostos) / 100;
            const total = subtotal + valorImpostos;

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
                    INSERT INTO notas_fiscais (id_cliente, subtotal, impostos, total)
                    VALUES (?, ?, ?, ?)
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
                            id_nota, id_produto, quantidade, 
                            preco_unitario, subtotal_item
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
            const nota = await buscarNotaCompleta(id);
            if (!nota) {
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=nota_${id}.pdf`);
            doc.pipe(res);

            // Cabeçalho
            doc.fontSize(20).text('NOTA FISCAL', { align: 'center' });
            doc.moveDown();

            // Dados da empresa
            doc.fontSize(12).text('EMPRESA EXEMPLO LTDA');
            doc.fontSize(10)
               .text('CNPJ: 00.000.000/0000-00')
               .text('Endereço: Rua Exemplo, 123 - Centro')
               .text('Telefone: (11) 1234-5678');
            doc.moveDown();

            // Dados do cliente
            doc.fontSize(12).text('DADOS DO CLIENTE');
            doc.fontSize(10)
               .text(`Nome: ${nota.cliente_nome}`)
               .text(`CPF/CNPJ: ${nota.cliente_cpf_cnpj}`)
               .text(`Endereço: ${nota.cliente_endereco}`);
            doc.moveDown();

            // Itens
            doc.fontSize(12).text('ITENS');
            doc.moveDown();

            // Cabeçalho da tabela
            const tableTop = doc.y;
            doc.fontSize(10)
               .text('Produto', 50, tableTop)
               .text('Qtd', 300, tableTop)
               .text('Valor Unit.', 350, tableTop)
               .text('Subtotal', 450, tableTop);

            let y = tableTop + 20;
            for (let item of nota.itens) {
                doc.text(item.produto_nome, 50, y)
                   .text(item.quantidade.toString(), 300, y)
                   .text(`R$ ${item.preco_unitario.toFixed(2)}`, 350, y)
                   .text(`R$ ${item.subtotal_item.toFixed(2)}`, 450, y);
                y += 20;
            }

            doc.moveDown();
            doc.moveDown();

            // Totais
            doc.fontSize(10)
               .text(`Subtotal: R$ ${nota.subtotal.toFixed(2)}`, { align: 'right' })
               .text(`Impostos: R$ ${nota.impostos.toFixed(2)}`, { align: 'right' })
               .text(`Total: R$ ${nota.total.toFixed(2)}`, { align: 'right', fontSize: 12 });

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
                db.run('DELETE FROM notas_fiscais WHERE id_nota = ?', [id], function(err) {
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

            res.json({ mensagem: 'Nota fiscal excluída com sucesso' });

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
                c.endereco as cliente_endereco
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