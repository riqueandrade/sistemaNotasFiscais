// Funções para gerenciar produtos
const API_URL = 'http://localhost:3000/api';

const ProdutosService = {
    async listarProdutos() {
        try {
            const response = await fetch(`${API_URL}/produtos`);
            const produtos = await response.json();
            return produtos;
        } catch (error) {
            console.error('Erro ao listar produtos:', error);
            throw error;
        }
    },

    async cadastrarProduto(produto) {
        try {
            const response = await fetch(`${API_URL}/produtos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(produto)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao cadastrar produto:', error);
            throw error;
        }
    },

    async atualizarProduto(id, produto) {
        try {
            const response = await fetch(`${API_URL}/produtos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(produto)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            throw error;
        }
    },

    async excluirProduto(id) {
        try {
            const response = await fetch(`${API_URL}/produtos/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            throw error;
        }
    }
}; 