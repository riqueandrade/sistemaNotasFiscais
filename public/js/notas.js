// Configurações e variáveis globais
const API_URL = 'http://localhost:3000/api';
let notasData = [];
let clientesData = [];
let produtosData = [];
let notaModal;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar modal do Bootstrap
    notaModal = new bootstrap.Modal(document.getElementById('notaModal'));
    
    // Carregar dados do usuário
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }
    
    try {
        // Carregar dados necessários em paralelo
        const [notasResponse, clientesResponse, produtosResponse] = await Promise.all([
            fetch(`${API_URL}/notas`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            }),
            fetch(`${API_URL}/clientes`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            }),
            fetch(`${API_URL}/produtos`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            })
        ]);

        // Verificar respostas
        if (!notasResponse.ok || !clientesResponse.ok || !produtosResponse.ok) {
            throw new Error('Erro ao carregar dados');
        }

        // Armazenar dados
        notasData = await notasResponse.json();
        clientesData = await clientesResponse.json();
        produtosData = await produtosResponse.json();

        // Renderizar dados
        renderizarNotas(notasData);
        preencherSelectClientes();
        preencherSelectProdutos();

        // Adicionar listeners para filtros
        document.getElementById('searchInput').addEventListener('input', filtrarNotas);
        document.getElementById('dataInicio').addEventListener('change', filtrarNotas);
        document.getElementById('dataFim').addEventListener('change', filtrarNotas);
        document.getElementById('orderBy').addEventListener('change', filtrarNotas);

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarAlerta('Erro ao carregar dados do sistema', 'danger');
        if (error.status === 401) {
            window.location.href = '/html/login.html';
        }
    }
});

// Funções de API
async function carregarNotas() {
    try {
        const response = await fetch(`${API_URL}/notas`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/html/login.html';
                return;
            }
            throw new Error('Erro ao carregar notas');
        }

        notasData = await response.json();
        renderizarNotas(notasData);
    } catch (error) {
        mostrarAlerta('Erro ao carregar notas fiscais', 'danger');
    }
}

async function carregarClientes() {
    try {
        const response = await fetch(`${API_URL}/clientes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar clientes');

        clientesData = await response.json();
        preencherSelectClientes();
    } catch (error) {
        mostrarAlerta('Erro ao carregar clientes', 'danger');
    }
}

async function carregarProdutos() {
    try {
        const response = await fetch(`${API_URL}/produtos`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar produtos');

        produtosData = await response.json();
        preencherSelectProdutos();
    } catch (error) {
        mostrarAlerta('Erro ao carregar produtos', 'danger');
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
    tbody.innerHTML = notas.map(nota => `
        <tr>
            <td>${nota.id_nota}</td>
            <td>${formatarData(nota.data_emissao)}</td>
            <td>${buscarNomeCliente(nota.id_cliente)}</td>
            <td>${nota.itens.length} item(ns)</td>
            <td>R$ ${nota.subtotal.toFixed(2)}</td>
            <td>R$ ${nota.impostos.toFixed(2)}</td>
            <td>R$ ${nota.total.toFixed(2)}</td>
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
    `).join('');
}

function preencherSelectClientes() {
    const select = document.getElementById('clienteSelect');
    if (!select) return;

    select.innerHTML = `
        <option value="">Selecione o cliente...</option>
        ${clientesData.map(cliente => `
            <option value="${cliente.id_cliente}">
                ${cliente.nome} - ${formatarCpfCnpj(cliente.cpf_cnpj)}
            </option>
        `).join('')}
    `;
}

function preencherSelectProdutos(selectElement = null) {
    const options = `
        <option value="">Selecione o produto...</option>
        ${produtosData.map(produto => `
            <option value="${produto.id_produto}" 
                    data-preco="${produto.preco_venda}"
                    data-estoque="${produto.estoque}">
                ${produto.nome} - R$ ${produto.preco_venda.toFixed(2)} 
                (Estoque: ${produto.estoque})
            </option>
        `).join('')}
    `;

    if (selectElement) {
        selectElement.innerHTML = options;
    } else {
        document.querySelectorAll('.produto-select').forEach(select => {
            select.innerHTML = options;
        });
    }
}

function adicionarProduto() {
    const container = document.getElementById('produtosContainer');
    const novoProduto = document.createElement('div');
    novoProduto.className = 'produto-item mb-2';
    novoProduto.innerHTML = `
        <div class="row g-2">
            <div class="col-md-3">
                <select class="form-select produto-select" required onchange="atualizarPrecoProduto(this)">
                    <option value="">Selecione o produto...</option>
                </select>
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control quantidade-input" 
                       placeholder="Qtd" min="1" required onchange="calcularTotais()" onkeyup="calcularTotais()">
            </div>
            <div class="col-md-2">
                <input type="text" class="form-control preco-input" placeholder="Preço" readonly>
            </div>
            <div class="col-md-3">
                <input type="text" class="form-control subtotal-input" placeholder="Subtotal" readonly>
            </div>
            <div class="col-md-2">
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
    const row = select.closest('.row');
    const precoInput = row.querySelector('input[placeholder="Preço"]');
    const quantidadeInput = row.querySelector('.quantidade-input');
    
    const option = select.selectedOptions[0];
    if (option && option.dataset.preco) {
        const preco = parseFloat(option.dataset.preco);
        precoInput.value = `R$ ${preco.toFixed(2)}`;
        quantidadeInput.max = option.dataset.estoque;
        
        if (quantidadeInput.value) {
            calcularTotais();
        }
    } else {
        precoInput.value = '';
        quantidadeInput.value = '';
        quantidadeInput.max = '';
    }
}

function calcularTotais() {
    let subtotalGeral = 0;
    
    document.querySelectorAll('.produto-item').forEach(item => {
        const select = item.querySelector('.produto-select');
        const quantidade = parseInt(item.querySelector('.quantidade-input').value) || 0;
        const subtotalInput = item.querySelector('.subtotal-input');
        
        if (select.value && quantidade > 0) {
            const preco = parseFloat(select.selectedOptions[0].dataset.preco);
            const subtotalItem = quantidade * preco;
            subtotalGeral += subtotalItem;
            
            subtotalInput.value = `R$ ${subtotalItem.toFixed(2)}`;
        } else {
            subtotalInput.value = 'R$ 0,00';
        }
    });

    const impostos = parseFloat(document.getElementById('impostos').value) || 0;
    const valorImpostos = (subtotalGeral * impostos) / 100;
    const total = subtotalGeral + valorImpostos;

    document.getElementById('subtotal').value = `R$ ${subtotalGeral.toFixed(2)}`;
    document.getElementById('total').value = `R$ ${total.toFixed(2)}`;
}

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
window.abrirModalNota = function() {
    const form = document.getElementById('notaForm');
    form.reset();
    
    // Limpar produtos exceto o primeiro
    const container = document.getElementById('produtosContainer');
    container.innerHTML = '';
    adicionarProduto();
    
    calcularTotais();
    notaModal.show();
}

window.salvarNota = async function() {
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

window.visualizarNota = async function(id) {
    try {
        const response = await fetch(`${API_URL}/notas/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar nota fiscal');

        const nota = await response.json();
        // Implementar visualização detalhada da nota
        console.log(nota);
    } catch (error) {
        mostrarAlerta('Erro ao visualizar nota fiscal', 'danger');
    }
}

window.imprimirNota = async function(id) {
    try {
        const response = await fetch(`${API_URL}/notas/${id}/pdf`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Erro ao gerar PDF da nota fiscal');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url);
    } catch (error) {
        mostrarAlerta('Erro ao gerar PDF da nota fiscal', 'danger');
    }
}

window.excluirNota = async function(id) {
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