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
                `, [id_cliente, subtotal, valorImpostos, total], function (err) {
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
            const nota = await buscarNotaCompleta(id);
            if (!nota) {
                return res.status(404).json({ erro: 'Nota fiscal não encontrada' });
            }

            // Buscar configurações da empresa
            const config = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM configuracoes ORDER BY id DESC LIMIT 1', [], (err, config) => {
                    if (err) reject(err);
                    else resolve(config || {});
                });
            });

            // Criar documento PDF
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40
            });

            // Configurar resposta
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=nota_fiscal_${id}.pdf`);
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
                .text(config.razaoSocial || 'EMPRESA EXEMPLO LTDA')
                .text(`CNPJ: ${formatarCpfCnpj(config.cnpj || '00000000000000')}`)
                .text(`IE: ${config.ie || 'ISENTO'}`)
                .text(`${config.rua}, ${config.numero} ${config.complemento || ''}`)
                .text(`${config.bairro} - ${config.cidade}/${config.estado}`)
                .text(`CEP: ${formatarCep(config.cep || '')}`)
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
                doc.text(formatarMoeda(item.preco_unitario), xPos, yPos, { width: widths[3] });
                xPos += widths[3];
                doc.text(formatarMoeda(item.subtotal_item), xPos, yPos, { width: widths[4] });
                yPos += 20;
            }

            // Totais
            doc.moveDown()
                .font('Helvetica-Bold')
                .text(`Subtotal: ${formatarMoeda(nota.subtotal)}`, { align: 'right' })
                .text(`Impostos: ${formatarMoeda(nota.impostos)}`, { align: 'right' })
                .text(`Total: ${formatarMoeda(nota.total)}`, { align: 'right' });

            // Rodapé
            doc.moveDown(2)
                .fontSize(8)
                .font('Helvetica')
                .text('Documento sem valor fiscal - Apenas para controle interno', {
                    align: 'center',
                    color: 'grey'
                });

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

            res.json({ mensagem: 'Nota fiscal excluida com sucesso' });

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

// Função auxiliar para formatar CEP
function formatarCep(cep) {
    return cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

// Função auxiliar para formatar CPF/CNPJ
function formatarCpfCnpj(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length === 11) {
        return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4');
    }
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, '$1.$2.$3/$4-$5');
}

// Função auxiliar para formatar moeda
function formatarMoeda(valor) {
    return `R$ ${valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

module.exports = notasFiscaisController; 