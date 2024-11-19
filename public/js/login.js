const API_URL = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    // Toggle de visibilidade da senha
    const togglePassword = document.querySelector('.toggle-password');
    const senhaInput = document.getElementById('senha');

    togglePassword.addEventListener('click', function() {
        const type = senhaInput.getAttribute('type') === 'password' ? 'text' : 'password';
        senhaInput.setAttribute('type', type);
        
        // Trocar ícone
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });

    // Lembrar email
    const emailInput = document.getElementById('email');
    const lembrarCheckbox = document.getElementById('lembrar');
    
    // Carregar email salvo
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
        emailInput.value = savedEmail;
        lembrarCheckbox.checked = true;
    }
});

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const lembrar = document.getElementById('lembrar').checked;
    const errorMessage = document.getElementById('error-message');
    const submitButton = document.querySelector('button[type="submit"]');
    const btnText = submitButton.querySelector('.btn-text');
    const btnLoader = submitButton.querySelector('.btn-loader');
    
    // Salvar email se "Lembrar-me" estiver marcado
    if (lembrar) {
        localStorage.setItem('savedEmail', email);
    } else {
        localStorage.removeItem('savedEmail');
    }

    // Mostrar loader
    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');
    submitButton.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha }),
            credentials: 'include' // Importante para cookies
        });

        const data = await response.json();

        if (response.ok) {
            // Salvar dados do usuário
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            
            // Animação de sucesso antes do redirecionamento
            submitButton.classList.remove('btn-primary');
            submitButton.classList.add('btn-success');
            btnLoader.innerHTML = '<i class="fas fa-check"></i>';
            
            setTimeout(() => {
                window.location.href = '/html/produtos.html';
            }, 1000);
        } else {
            throw new Error(data.erro || 'Erro ao fazer login');
        }
    } catch (error) {
        console.error('Erro:', error);
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        
        // Restaurar botão
        btnText.classList.remove('d-none');
        btnLoader.classList.add('d-none');
        submitButton.disabled = false;
        
        // Animar erro
        submitButton.classList.add('shake');
        setTimeout(() => submitButton.classList.remove('shake'), 500);
    }
}

// Limpar mensagem de erro quando o usuário começar a digitar
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
        document.getElementById('error-message').style.display = 'none';
    });
}); 