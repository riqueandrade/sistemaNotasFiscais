// Configurações
const API_URL = 'http://localhost:3000/api';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Carregar dados do usuário
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nome;
    }

    // Aplicar máscaras
    aplicarMascaras();
    
    // Carregar configurações
    carregarConfiguracoes();
    
    // Adicionar listener para o formulário
    document.getElementById('configForm').addEventListener('submit', salvarConfiguracoes);
    
    // Adicionar listener para busca de CEP
    document.getElementById('cep').addEventListener('blur', buscarCep);
});

function aplicarMascaras() {
    // CNPJ
    $('#cnpj').inputmask({
        mask: '99.999.999/9999-99',
        removeMaskOnSubmit: true
    });

    // Inscrição Estadual
    $('#ie').inputmask({
        mask: '999.999.999.999',
        removeMaskOnSubmit: true
    });

    // CEP
    $('#cep').inputmask({
        mask: '99999-999',
        removeMaskOnSubmit: true
    });
}

async function carregarConfiguracoes() {
    try {
        const response = await fetch(`${API_URL}/configuracoes`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/html/login.html';
                return;
            }
            throw new Error('Erro ao carregar configurações');
        }

        const config = await response.json();
        preencherFormulario(config);
    } catch (error) {
        mostrarAlerta('Erro ao carregar configurações', 'danger');
    }
}

function preencherFormulario(config) {
    document.getElementById('aliquotaPadrao').value = config.aliquotaPadrao || 10;
    document.getElementById('icms').value = config.icms || 18;
    document.getElementById('razaoSocial').value = config.razaoSocial || '';
    document.getElementById('cnpj').value = config.cnpj || '';
    document.getElementById('ie').value = config.ie || '';
    document.getElementById('cep').value = config.cep || '';
    document.getElementById('rua').value = config.rua || '';
    document.getElementById('numero').value = config.numero || '';
    document.getElementById('complemento').value = config.complemento || '';
    document.getElementById('bairro').value = config.bairro || '';
    document.getElementById('cidade').value = config.cidade || '';
    document.getElementById('estado').value = config.estado || '';
}

async function salvarConfiguracoes(event) {
    event.preventDefault();

    const btnSalvar = document.querySelector('button[type="submit"]');
    const btnText = btnSalvar.querySelector('.btn-text');
    const btnLoader = btnSalvar.querySelector('.btn-loader');
    
    // Mostrar loader
    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    btnSalvar.disabled = true;

    const config = {
        aliquotaPadrao: parseFloat(document.getElementById('aliquotaPadrao').value),
        icms: parseFloat(document.getElementById('icms').value),
        razaoSocial: document.getElementById('razaoSocial').value,
        cnpj: document.getElementById('cnpj').value.replace(/\D/g, ''),
        ie: document.getElementById('ie').value.replace(/\D/g, ''),
        cep: document.getElementById('cep').value.replace(/\D/g, ''),
        rua: document.getElementById('rua').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        estado: document.getElementById('estado').value
    };

    try {
        const response = await fetch(`${API_URL}/configuracoes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) throw new Error('Erro ao salvar configurações');

        mostrarAlerta('Configurações salvas com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta('Erro ao salvar configurações', 'danger');
    } finally {
        // Restaurar botão
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
        btnSalvar.disabled = false;
    }
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

function restaurarPadrao() {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) return;

    const configPadrao = {
        aliquotaPadrao: 10,
        icms: 18,
        razaoSocial: 'Empresa Exemplo LTDA',
        cnpj: '00000000000000',
        ie: '000000000000',
        cep: '00000000',
        rua: 'Rua Exemplo',
        numero: '123',
        complemento: '',
        bairro: 'Centro',
        cidade: 'São Paulo',
        estado: 'SP'
    };

    preencherFormulario(configPadrao);
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