// Configurações e variáveis globais
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://sistemanotasfiscais.onrender.com/api';
let clientesData = [];
let clienteModal;

// Funções principais
async function carregarClientes() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/clientes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/html/login.html';
                return;
            }
            throw new Error('Erro ao carregar clientes');
        }

        clientesData = await response.json();
        renderizarClientes(clientesData);
    } catch (error) {
        mostrarAlerta('Erro ao carregar clientes', 'danger');
    }
}

function renderizarClientes(clientes) {
    const tbody = document.getElementById('clientesTableBody');
    const emptyMessage = document.getElementById('emptyMessage');

    if (clientes.length === 0) {
        tbody.innerHTML = '';
        emptyMessage.style.display = 'block';
        return;
    }

    emptyMessage.style.display = 'none';
    tbody.innerHTML = clientes.map(cliente => `
        <tr>
            <td>${cliente.id_cliente}</td>
            <td>${cliente.nome}</td>
            <td>${formatarCpfCnpj(cliente.cpf_cnpj)}</td>
            <td>${cliente.telefone || '-'}</td>
            <td class="endereco-cell" title="${formatarEnderecoCompleto(cliente)}">
                ${formatarEnderecoCompleto(cliente)}
            </td>
            <td class="actions-cell">
                <button class="btn btn-action btn-view me-1" onclick="visualizarCliente(${cliente.id_cliente})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-action btn-edit me-1" onclick="editarCliente(${cliente.id_cliente})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-action btn-delete" onclick="excluirCliente(${cliente.id_cliente})">
                    <i class="fas fa-trash"></i>
                </button>

                <div class="dropdown dropdown-actions">
                    <button class="btn btn-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <a class="dropdown-item" href="#" onclick="visualizarCliente(${cliente.id_cliente})">
                                <i class="fas fa-eye"></i>
                                Visualizar
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item" href="#" onclick="editarCliente(${cliente.id_cliente})">
                                <i class="fas fa-edit"></i>
                                Editar
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item text-danger" href="#" onclick="excluirCliente(${cliente.id_cliente})">
                                <i class="fas fa-trash"></i>
                                Excluir
                            </a>
                        </li>
                    </ul>
                </div>
            </td>
        </tr>
    `).join('');
}

function formatarEnderecoCompleto(cliente) {
    const partes = [
        cliente.rua,
        cliente.numero,
        cliente.complemento,
        cliente.bairro,
        cliente.cidade,
        cliente.estado,
        cliente.cep
    ];
    return partes.filter(Boolean).join(', ');
}

function aplicarMascaras() {
    // CPF/CNPJ
    $('#cpf_cnpj').inputmask({
        mask: ['999.999.999-99', '99.999.999/9999-99'],
        keepStatic: true,
        removeMaskOnSubmit: true
    });

    // Telefone
    $('#telefone').inputmask({
        mask: ['(99) 9999-9999', '(99) 9 9999-9999'],
        keepStatic: true
    });

    // CEP
    $('#cep').inputmask({
        mask: '99999-999',
        keepStatic: true,
        onComplete: function () {
            buscarCep();
        }
    });
}

async function buscarCep() {
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
            document.getElementById('rua').value = data.logradouro;
            document.getElementById('bairro').value = data.bairro;
            document.getElementById('cidade').value = data.localidade;
            document.getElementById('estado').value = data.uf;
            document.getElementById('numero').focus();
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
    }
}

function filtrarClientes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const orderBy = document.getElementById('orderBy').value;

    let clientesFiltrados = clientesData.filter(cliente =>
        cliente.nome.toLowerCase().includes(searchTerm) ||
        cliente.cpf_cnpj.includes(searchTerm)
    );

    clientesFiltrados.sort((a, b) => {
        switch (orderBy) {
            case 'cpf_cnpj':
                return a.cpf_cnpj.localeCompare(b.cpf_cnpj);
            case 'data':
                return new Date(b.created_at) - new Date(a.created_at);
            default:
                return a.nome.localeCompare(b.nome);
        }
    });

    renderizarClientes(clientesFiltrados);
}

function formatarCpfCnpj(valor) {
    valor = valor.replace(/\D/g, '');
    if (valor.length === 11) {
        return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4');
    }
    return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, '$1.$2.$3/$4-$5');
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

// Funções de manipulação do modal e CRUD
window.abrirModalCliente = function (cliente = null) {
    const form = document.getElementById('clienteForm');
    form.reset();

    Array.from(form.elements).forEach(element => {
        element.disabled = false;
    });

    document.querySelector('#clienteModal .btn-primary').style.display = 'block';
    document.querySelector('#clienteModal .btn-secondary').textContent = 'Cancelar';

    document.getElementById('modalTitle').textContent = cliente ? 'Editar Cliente' : 'Novo Cliente';
    document.getElementById('clienteId').value = cliente ? cliente.id_cliente : '';

    if (cliente) {
        document.getElementById('nome').value = cliente.nome;
        document.getElementById('cpf_cnpj').value = cliente.cpf_cnpj;
        document.getElementById('telefone').value = cliente.telefone || '';
        document.getElementById('email').value = cliente.email || '';
        document.getElementById('cep').value = cliente.cep || '';
        document.getElementById('rua').value = cliente.rua || '';
        document.getElementById('numero').value = cliente.numero || '';
        document.getElementById('complemento').value = cliente.complemento || '';
        document.getElementById('bairro').value = cliente.bairro || '';
        document.getElementById('cidade').value = cliente.cidade || '';
        document.getElementById('estado').value = cliente.estado || '';
    }

    clienteModal.show();
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    clienteModal = new bootstrap.Modal(document.getElementById('clienteModal'));

    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
        document.getElementById('userEmail').textContent = usuario.email;
    }

    carregarClientes();

    document.getElementById('searchInput').addEventListener('input', filtrarClientes);
    document.getElementById('orderBy').addEventListener('change', filtrarClientes);

    aplicarMascaras();
});

// Exportar outras funções para o escopo global
window.editarCliente = function (id) {
    const cliente = clientesData.find(c => c.id_cliente === id);
    if (cliente) {
        abrirModalCliente(cliente);
    }
}

window.visualizarCliente = function (id) {
    const cliente = clientesData.find(c => c.id_cliente === id);
    if (cliente) {
        abrirModalCliente(cliente);

        const form = document.getElementById('clienteForm');
        Array.from(form.elements).forEach(element => {
            element.disabled = true;
        });

        document.getElementById('modalTitle').textContent = 'Visualizar Cliente';
        document.querySelector('#clienteModal .btn-primary').style.display = 'none';
        document.querySelector('#clienteModal .btn-secondary').textContent = 'Fechar';
    }
}

window.excluirCliente = async function (id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao excluir cliente');

        await carregarClientes();
        mostrarAlerta('Cliente excluído com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta('Erro ao excluir cliente', 'danger');
    }
}

window.salvarCliente = async function () {
    const form = document.getElementById('clienteForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btnSalvar = document.querySelector('#clienteModal .btn-primary');
    const btnText = btnSalvar.querySelector('.btn-text');
    const btnLoader = btnSalvar.querySelector('.btn-loader');

    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    btnSalvar.disabled = true;

    const cliente = {
        nome: document.getElementById('nome').value,
        cpf_cnpj: document.getElementById('cpf_cnpj').value.replace(/\D/g, ''),
        telefone: document.getElementById('telefone').value,
        email: document.getElementById('email').value,
        cep: document.getElementById('cep').value.replace(/\D/g, ''),
        rua: document.getElementById('rua').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        estado: document.getElementById('estado').value
    };

    const id = document.getElementById('clienteId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/clientes/${id}` : `${API_URL}/clientes`;

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(cliente)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.erro || 'Erro ao salvar cliente');
        }

        clienteModal.hide();
        await carregarClientes();
        mostrarAlerta('Cliente salvo com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    } finally {
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
        btnSalvar.disabled = false;
    }
}

// Adicionar o modal de alteração de senha no HTML
document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="senhaModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Alterar Senha</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="senhaForm">
                        <div class="mb-3">
                            <label class="form-label">Senha Atual</label>
                            <div class="input-group">
                                <input type="password" class="form-control" id="senhaAtual" required>
                                <button class="btn btn-outline-secondary toggle-password" type="button">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Nova Senha</label>
                            <div class="input-group">
                                <input type="password" class="form-control" id="novaSenha" required>
                                <button class="btn btn-outline-secondary toggle-password" type="button">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Confirmar Nova Senha</label>
                            <div class="input-group">
                                <input type="password" class="form-control" id="confirmarSenha" required>
                                <button class="btn btn-outline-secondary toggle-password" type="button">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="salvarNovaSenha()">
                        <span class="btn-text">Salvar</span>
                        <span class="btn-loader d-none">
                            <i class="fas fa-circle-notch fa-spin"></i>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>
`);

// Inicializar o modal
let senhaModal;
document.addEventListener('DOMContentLoaded', () => {
    senhaModal = new bootstrap.Modal(document.getElementById('senhaModal'));
});

// Função para abrir o modal de alteração de senha
window.alterarSenha = function () {
    document.getElementById('senhaForm').reset();
    senhaModal.show();
}

// Função para salvar a nova senha
window.salvarNovaSenha = async function () {
    const form = document.getElementById('senhaForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (novaSenha !== confirmarSenha) {
        mostrarAlerta('As senhas não coincidem', 'danger');
        return;
    }

    const btnSalvar = document.querySelector('#senhaModal .btn-primary');
    const btnText = btnSalvar.querySelector('.btn-text');
    const btnLoader = btnSalvar.querySelector('.btn-loader');

    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    btnSalvar.disabled = true;

    try {
        const response = await fetch(`${API_URL}/auth/alterar-senha`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                senhaAtual,
                novaSenha
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.erro || 'Erro ao alterar senha');
        }

        senhaModal.hide();
        mostrarAlerta('Senha alterada com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    } finally {
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
        btnSalvar.disabled = false;
    }
}

// Adicionar função para alternar visibilidade da senha
document.addEventListener('click', function (e) {
    if (e.target.closest('.toggle-password')) {
        const button = e.target.closest('.toggle-password');
        const input = button.parentElement.querySelector('input');
        const icon = button.querySelector('i');

        // Alternar tipo do input
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);

        // Alternar ícone
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    }
});

// Adicionar logout
window.logout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/html/login.html';
}