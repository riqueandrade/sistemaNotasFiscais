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
        onComplete: function() {
            buscarCep();
        }
    });
}

// ... resto do código permanece igual ... 