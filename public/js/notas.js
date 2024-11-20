// Configurações e variáveis globais
const API_URL = 'http://localhost:3000/api';
let notasData = [];
let clientesData = [];
let produtosData = [];
let notaModal;
let visualizacaoModal;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar autenticação
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/html/login.html';
            return;
        }

        // Inicializar modais
        notaModal = new bootstrap.Modal(document.getElementById('notaModal'));
        visualizacaoModal = new bootstrap.Modal(document.getElementById('visualizacaoModal'));

        // Carregar dados do usuário
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        if (usuario) {
            document.getElementById('userName').textContent = usuario.nome;
        }

        // Primeiro, carregar clientes e produtos
        await Promise.all([
            carregarClientes(),
            carregarProdutos()
        ]);

        // Depois, carregar notas
        await carregarNotas();

        // Adicionar listeners para filtros
        document.getElementById('searchInput').addEventListener('input', filtrarNotas);
        document.getElementById('dataInicio').addEventListener('change', filtrarNotas);
        document.getElementById('dataFim').addEventListener('change', filtrarNotas);
        document.getElementById('orderBy').addEventListener('change', filtrarNotas);

    } catch (error) {
        console.error('Erro ao inicializar:', error);
        mostrarAlerta('Erro ao carregar dados', 'danger');
    }
});

async function carregarClientes() {
    try {
        console.log('Carregando clientes...');
        const response = await fetch(`${API_URL}/clientes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar clientes');
        }

        clientesData = await response.json();
        console.log('Clientes carregados:', clientesData);
        await preencherSelectClientes();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        mostrarAlerta('Erro ao carregar clientes', 'danger');
    }
}

async function carregarProdutos() {
    try {
        console.log('Carregando produtos...');
        const response = await fetch(`${API_URL}/produtos`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar produtos');
        }

        produtosData = await response.json();
        console.log('Produtos carregados:', produtosData);
        await preencherSelectProdutos();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        mostrarAlerta('Erro ao carregar produtos', 'danger');
    }
}

async function carregarNotas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/notas`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/html/login.html';
                return;
            }
            throw new Error('Erro ao carregar notas fiscais');
        }

        notasData = await response.json();
        renderizarNotas(notasData);
    } catch (error) {
        console.error('Erro ao carregar notas:', error);
        mostrarAlerta('Erro ao carregar notas fiscais', 'danger');
    }
}

function preencherSelectClientes() {
    console.log('Preenchendo select de clientes...');
    const select = document.getElementById('clienteSelect');
    if (!select) {
        console.error('Select de clientes não encontrado!');
        return;
    }

    try {
        // Limpar select
        select.innerHTML = '<option value="">Selecione o cliente...</option>';
        
        // Adicionar opções
        clientesData.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id_cliente;
            option.textContent = `${cliente.nome} - ${formatarCpfCnpj(cliente.cpf_cnpj)}`;
            select.appendChild(option);
        });

        // Inicializar Select2
        $(select).select2({
            theme: 'bootstrap-5',
            width: '100%',
            placeholder: 'Buscar cliente...',
            allowClear: true,
            language: 'pt-BR',
            searchInputPlaceholder: 'Digite para buscar...',
            dropdownParent: $('#notaModal'),
            escapeMarkup: markup => markup
        });
        
        console.log('Select2 de clientes inicializado com sucesso!');
    } catch (error) {
        console.error('Erro ao inicializar select de clientes:', error);
        mostrarAlerta('Erro ao carregar lista de clientes', 'danger');
    }
}

function preencherSelectProdutos(selectElement = null) {
    console.log('Preenchendo select de produtos...');
    
    const preencherSelect = (select) => {
        if (!select) {
            console.error('Select de produtos não encontrado!');
            return;
        }

        try {
            // Limpar select
            select.innerHTML = '<option value="">Selecione o produto...</option>';
            
            // Adicionar opções
            produtosData.forEach(produto => {
                const precoVenda = parseFloat(produto.preco_venda);
                
                const option = document.createElement('option');
                option.value = produto.id_produto;
                option.textContent = `${produto.nome} - R$ ${precoVenda.toFixed(2)}`;
                option.dataset.preco = precoVenda;
                option.dataset.estoque = produto.estoque;
                select.appendChild(option);
            });

            // Inicializar Select2
            $(select).select2({
                theme: 'bootstrap-5',
                width: '100%',
                placeholder: 'Buscar produto...',
                allowClear: true,
                language: 'pt-BR',
                searchInputPlaceholder: 'Digite para buscar...',
                dropdownParent: $('#notaModal')
            }).on('select2:select', function() {
                atualizarPrecoProduto(this);
            });

            console.log('Select2 de produtos inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar select de produtos:', error);
            mostrarAlerta('Erro ao carregar lista de produtos', 'danger');
        }
    };

    if (selectElement) {
        preencherSelect(selectElement);
    } else {
        document.querySelectorAll('.produto-select').forEach(select => {
            preencherSelect(select);
        });
    }
}

// Funções de UI
function renderizarNotas(notas) {
    const tbody = document.getElementById('notasTableBody');
    const emptyMessage = document.getElementById('emptyMessage');

    if (notas.length === 0) {
        tbody.innerHTML = '';
        emptyMessage.style.display = 'block';
        return;
    }

    emptyMessage.style.display = 'none';
    tbody.innerHTML = notas.map(nota => {
        // Converter valores para números
        const subtotal = parseFloat(nota.subtotal);
        const impostos = parseFloat(nota.impostos);
        const total = parseFloat(nota.total);

        return `
            <tr>
                <td>${nota.id_nota}</td>
                <td>${formatarData(nota.data_emissao)}</td>
                <td>${buscarNomeCliente(nota.id_cliente)}</td>
                <td>${nota.itens.length} item(ns)</td>
                <td>R$ ${subtotal.toFixed(2)}</td>
                <td>R$ ${impostos.toFixed(2)}</td>
                <td>R$ ${total.toFixed(2)}</td>
                <td>
                    <button class="btn btn-action btn-view me-1" onclick="visualizarNota(${nota.id_nota})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-action btn-print me-1" onclick="imprimirNota(${nota.id_nota})">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-action btn-delete" onclick="excluirNota(${nota.id_nota})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function adicionarProduto() {
    const container = document.getElementById('produtosContainer');
    const novoProduto = document.createElement('div');
    novoProduto.className = 'produto-item mb-3';
    novoProduto.innerHTML = `
        <!-- Primeira linha - apenas o select de produto -->
        <div class="row mb-2">
            <div class="col-12">
                <select class="form-select produto-select" required>
                    <option value="">Selecione o produto...</option>
                </select>
            </div>
        </div>
        <!-- Segunda linha - demais campos -->
        <div class="row g-2 align-items-center">
            <div class="col-md-3">
                <input type="number" class="form-control quantidade-input" 
                       placeholder="Qtd" min="1" required 
                       onchange="calcularTotais()" onkeyup="calcularTotais()">
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control preco-input" 
                       placeholder="Preço" readonly>
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control subtotal-input"
                       placeholder="Subtotal" readonly>
            </div>
            <div class="col-md-3">
                <button type="button" class="btn btn-danger btn-sm w-100"
                        onclick="removerProduto(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    container.appendChild(novoProduto);
    preencherSelectProdutos(novoProduto.querySelector('.produto-select'));
}

function removerProduto(button) {
    button.closest('.produto-item').remove();
    calcularTotais();
}

function atualizarPrecoProduto(select) {
    const row = $(select).closest('.produto-item');
    const precoInput = row.find('.preco-input');
    const quantidadeInput = row.find('.quantidade-input');
    const subtotalInput = row.find('.subtotal-input');

    const selectedOption = $(select).find(':selected');
    if (selectedOption.length && selectedOption.val()) {
        const preco = parseFloat(selectedOption.data('preco'));
        const quantidade = parseInt(quantidadeInput.val()) || 0;

        precoInput.val(`R$ ${preco.toFixed(2)}`);
        quantidadeInput.attr('max', selectedOption.data('estoque'));

        const subtotal = preco * quantidade;
        subtotalInput.val(`R$ ${subtotal.toFixed(2)}`);

        calcularTotais();
    } else {
        precoInput.val('');
        subtotalInput.val('');
        quantidadeInput.val('').attr('max', '');
    }
}

function calcularTotais() {
    let subtotal = 0;

    $('.produto-item').each(function() {
        const row = $(this);
        const select = row.find('.produto-select');
        const quantidade = parseInt(row.find('.quantidade-input').val()) || 0;

        if (select.val() && quantidade > 0) {
            const preco = parseFloat(select.find(':selected').data('preco'));
            const itemSubtotal = preco * quantidade;
            subtotal += itemSubtotal;

            // Atualizar subtotal do item
            row.find('.subtotal-input').val(`R$ ${itemSubtotal.toFixed(2)}`);
        }
    });

    const impostos = parseFloat($('#impostos').val()) || 0;
    const valorImpostos = (subtotal * impostos) / 100;
    const total = subtotal + valorImpostos;

    $('#subtotal').val(`R$ ${subtotal.toFixed(2)}`);
    $('#total').val(`R$ ${total.toFixed(2)}`);
}

// Adicionar listeners para quantidade
$(document).on('input', '.quantidade-input', function() {
    const row = $(this).closest('.produto-item');
    const select = row.find('.produto-select');
    
    if (select.val()) {
        const preco = parseFloat(select.find(':selected').data('preco'));
        const quantidade = parseInt($(this).val()) || 0;
        const subtotal = preco * quantidade;

        row.find('.subtotal-input').val(`R$ ${subtotal.toFixed(2)}`);
        calcularTotais();
    }
});

// Funções auxiliares
function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatarCpfCnpj(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length === 11) {
        return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4');
    }
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, '$1.$2.$3/$4-$5');
}

function buscarNomeCliente(id) {
    const cliente = clientesData.find(c => c.id_cliente === id);
    return cliente ? cliente.nome : 'Cliente não encontrado';
}

function mostrarAlerta(mensagem, tipo) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Funções de manipulação de notas
window.abrirModalNota = async function () {
    const form = document.getElementById('notaForm');
    form.reset();

    // Limpar produtos exceto o primeiro
    const container = document.getElementById('produtosContainer');
    container.innerHTML = '';
    adicionarProduto();

    // Resetar selects
    $('#clienteSelect').val(null).trigger('change');

    calcularTotais();

    // Carregar alíquota padrão
    try {
        const response = await fetch(`${API_URL}/configuracoes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const config = await response.json();
            document.getElementById('impostos').value = config.aliquotaPadrao || 10;
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }

    notaModal.show();
}

window.salvarNota = async function () {
    const form = document.getElementById('notaForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btnSalvar = document.querySelector('#notaModal .btn-primary');
    const btnText = btnSalvar.querySelector('.btn-text');
    const btnLoader = btnSalvar.querySelector('.btn-loader');

    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    btnSalvar.disabled = true;

    try {
        const nota = {
            id_cliente: document.getElementById('clienteSelect').value,
            itens: Array.from(document.querySelectorAll('.produto-item')).map(item => ({
                id_produto: item.querySelector('.produto-select').value,
                quantidade: parseInt(item.querySelector('.quantidade-input').value),
                preco_unitario: parseFloat(item.querySelector('.produto-select').selectedOptions[0].dataset.preco)
            })),
            impostos: parseFloat(document.getElementById('impostos').value)
        };

        const response = await fetch(`${API_URL}/notas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(nota)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.erro || 'Erro ao emitir nota fiscal');
        }

        const data = await response.json();
        notaModal.hide();
        await carregarNotas();
        mostrarAlerta('Nota fiscal emitida com sucesso!', 'success');

        // Perguntar se deseja imprimir
        if (confirm('Deseja imprimir a nota fiscal?')) {
            imprimirNota(data.id);
        }
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    } finally {
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
        btnSalvar.disabled = false;
    }
}

window.visualizarNota = async function (id) {
    try {
        const response = await fetch(`${API_URL}/notas/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar nota fiscal');

        const nota = await response.json();

        // Preencher dados no modal de visualização
        document.getElementById('visualizacao-numero').textContent = `Nº ${nota.id_nota.toString().padStart(6, '0')}`;
        document.getElementById('visualizacao-data').textContent = formatarData(nota.data_emissao);
        document.getElementById('visualizacao-cliente').textContent = nota.cliente_nome;
        document.getElementById('visualizacao-cpf-cnpj').textContent = formatarCpfCnpj(nota.cliente_cpf_cnpj);

        // Preencher tabela de itens
        const tbody = document.getElementById('visualizacao-itens');
        tbody.innerHTML = nota.itens.map(item => `
            <tr>
                <td>${item.produto_nome}</td>
                <td class="text-center">${item.quantidade}</td>
                <td class="text-end">R$ ${item.preco_unitario.toFixed(2)}</td>
                <td class="text-end">R$ ${item.subtotal_item.toFixed(2)}</td>
            </tr>
        `).join('');

        // Preencher totais
        document.getElementById('visualizacao-subtotal').textContent = `R$ ${nota.subtotal.toFixed(2)}`;
        document.getElementById('visualizacao-impostos').textContent = `R$ ${nota.impostos.toFixed(2)}`;
        document.getElementById('visualizacao-total').textContent = `R$ ${nota.total.toFixed(2)}`;

        // Mostrar modal
        visualizacaoModal.show();
    } catch (error) {
        mostrarAlerta('Erro ao visualizar nota fiscal', 'danger');
    }
}

window.imprimirNota = async function (id) {
    try {
        console.log('Iniciando impressão da nota:', id);
        
        const response = await fetch(`${API_URL}/notas/${id}/pdf`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro ao gerar PDF:', errorData);
            throw new Error(errorData.erro || 'Erro ao gerar PDF da nota fiscal');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url);
    } catch (error) {
        console.error('Erro detalhado:', error);
        mostrarAlerta(error.message, 'danger');
    }
}

window.excluirNota = async function (id) {
    if (!confirm('Tem certeza que deseja excluir esta nota fiscal?')) return;

    try {
        const response = await fetch(`${API_URL}/notas/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao excluir nota fiscal');

        await carregarNotas();
        mostrarAlerta('Nota fiscal excluída com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta('Erro ao excluir nota fiscal', 'danger');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/html/login.html';
}

function filtrarNotas() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim = document.getElementById('dataFim').value;
    const orderBy = document.getElementById('orderBy').value;

    let notasFiltradas = notasData.filter(nota => {
        // Filtro por texto (número da nota ou nome do cliente)
        const matchSearch =
            nota.id_nota.toString().includes(searchTerm) ||
            buscarNomeCliente(nota.id_cliente).toLowerCase().includes(searchTerm);

        // Filtro por data
        const dataNota = new Date(nota.data_emissao);
        const matchDataInicio = !dataInicio || dataNota >= new Date(dataInicio);
        const matchDataFim = !dataFim || dataNota <= new Date(dataFim + ' 23:59:59');

        return matchSearch && matchDataInicio && matchDataFim;
    });

    // Ordenação
    notasFiltradas.sort((a, b) => {
        switch (orderBy) {
            case 'valor':
                return b.total - a.total;
            case 'cliente':
                const clienteA = buscarNomeCliente(a.id_cliente);
                const clienteB = buscarNomeCliente(b.id_cliente);
                return clienteA.localeCompare(clienteB);
            case 'data':
            default:
                return new Date(b.data_emissao) - new Date(a.data_emissao);
        }
    });

    renderizarNotas(notasFiltradas);
} 