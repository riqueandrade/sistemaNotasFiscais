// Configurações
const API_URL = 'http://localhost:3000/api';
let produtosData = [];
let produtoModal;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar modal do Bootstrap
    produtoModal = new bootstrap.Modal(document.getElementById('produtoModal'));
    
    // Carregar dados do usuário
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }
    
    // Carregar produtos
    carregarProdutos();
    
    // Adicionar listeners para filtros
    document.getElementById('searchInput').addEventListener('input', filtrarProdutos);
    document.getElementById('categoriaFilter').addEventListener('change', filtrarProdutos);
    document.getElementById('orderBy').addEventListener('change', filtrarProdutos);
});

// Funções de API
async function carregarProdutos() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/produtos`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/html/login.html';
                return;
            }
            throw new Error('Erro ao carregar produtos');
        }

        produtosData = await response.json();
        renderizarProdutos(produtosData);
    } catch (error) {
        mostrarAlerta('Erro ao carregar produtos', 'danger');
    }
}

async function salvarProduto() {
    const form = document.getElementById('produtoForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btnSalvar = document.querySelector('#produtoModal .btn-primary');
    const btnText = btnSalvar.querySelector('.btn-text');
    const btnLoader = btnSalvar.querySelector('.btn-loader');
    
    // Mostrar loader
    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    btnSalvar.disabled = true;

    const produto = {
        nome: document.getElementById('nome').value,
        categoria: document.getElementById('categoria').value,
        preco_venda: parseFloat(document.getElementById('preco_venda').value),
        estoque: parseInt(document.getElementById('estoque').value),
        descricao: document.getElementById('descricao').value
    };

    const id = document.getElementById('produtoId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/produtos/${id}` : `${API_URL}/produtos`;

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(produto)
        });

        if (!response.ok) throw new Error('Erro ao salvar produto');

        produtoModal.hide();
        carregarProdutos();
        mostrarAlerta('Produto salvo com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta('Erro ao salvar produto', 'danger');
    } finally {
        // Restaurar botão
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
        btnSalvar.disabled = false;
    }
}

async function excluirProduto(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
        const response = await fetch(`${API_URL}/produtos/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao excluir produto');

        carregarProdutos();
        mostrarAlerta('Produto excluído com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta('Erro ao excluir produto', 'danger');
    }
}

// Funções de UI
function renderizarProdutos(produtos) {
    const tbody = document.getElementById('produtosTableBody');
    const emptyMessage = document.getElementById('emptyMessage');
    
    if (produtos.length === 0) {
        tbody.innerHTML = '';
        emptyMessage.style.display = 'block';
        return;
    }

    emptyMessage.style.display = 'none';
    tbody.innerHTML = produtos.map(produto => `
        <tr>
            <td>${produto.id_produto}</td>
            <td>${produto.nome}</td>
            <td>
                <span class="badge bg-${produto.categoria === 'Celular' ? 'primary' : 'secondary'}">
                    ${produto.categoria}
                </span>
            </td>
            <td>R$ ${produto.preco_venda.toFixed(2)}</td>
            <td>
                <span class="badge bg-${produto.estoque > 0 ? 'success' : 'danger'}">
                    ${produto.estoque}
                </span>
            </td>
            <td>
                <button class="btn btn-action btn-edit me-1" onclick="editarProduto(${produto.id_produto})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-action btn-delete" onclick="excluirProduto(${produto.id_produto})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarProdutos() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoria = document.getElementById('categoriaFilter').value;
    const orderBy = document.getElementById('orderBy').value;

    let produtosFiltrados = produtosData.filter(produto => {
        const matchSearch = produto.nome.toLowerCase().includes(searchTerm);
        const matchCategoria = !categoria || produto.categoria === categoria;
        return matchSearch && matchCategoria;
    });

    // Ordenação
    produtosFiltrados.sort((a, b) => {
        switch (orderBy) {
            case 'preco':
                return a.preco_venda - b.preco_venda;
            case 'estoque':
                return a.estoque - b.estoque;
            default:
                return a.nome.localeCompare(b.nome);
        }
    });

    renderizarProdutos(produtosFiltrados);
}

function abrirModalProduto(produto = null) {
    const form = document.getElementById('produtoForm');
    form.reset();
    
    document.getElementById('modalTitle').textContent = produto ? 'Editar Produto' : 'Novo Produto';
    document.getElementById('produtoId').value = produto ? produto.id_produto : '';
    
    if (produto) {
        document.getElementById('nome').value = produto.nome;
        document.getElementById('categoria').value = produto.categoria;
        document.getElementById('preco_venda').value = produto.preco_venda;
        document.getElementById('estoque').value = produto.estoque;
        document.getElementById('descricao').value = produto.descricao || '';
    }
    
    produtoModal.show();
}

function editarProduto(id) {
    const produto = produtosData.find(p => p.id_produto === id);
    if (produto) {
        abrirModalProduto(produto);
    }
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

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/html/login.html';
} 