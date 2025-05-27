/**
* SPED Processor - Interface para processamento de arquivos SPED
* Versão 1.0.0 - Maio 2025
*/

const SpedProcessor = (function() {

/**
* Processa arquivos SPED carregados pelo usuário
* @param {HTMLInputElement} inputFiscal - Input do arquivo SPED Fiscal
* @param {HTMLInputElement} inputContribuicoes - Input do arquivo SPED Contribuições
* @param {Function} callback - Função a ser chamada com os dados processados
*/
function processarArquivosSped(inputFiscal, inputContribuicoes, callback) {
    console.log('=== SPED-PROCESSOR: INICIANDO PROCESSAMENTO DE ARQUIVOS ===');
    
    // CORREÇÃO: Declarar variáveis no escopo superior
    let dadosFiscal = null;
    let dadosContribuicoes = null;
    
    const arquivosFaltantes = [];
    
    if (!inputFiscal.files || inputFiscal.files.length === 0) {
        arquivosFaltantes.push('SPED Fiscal');
    }
    
    if (!inputContribuicoes.files || inputContribuicoes.files.length === 0) {
        arquivosFaltantes.push('SPED Contribuições');
    }
    
    if (arquivosFaltantes.length > 0) {
        if (typeof callback === 'function') {
            callback({
                sucesso: false,
                mensagem: `Arquivos não selecionados: ${arquivosFaltantes.join(', ')}`
            });
        }
        return;
    }
    
    // Verificar se o SpedExtractor está disponível
    if (!window.SpedExtractor) {
        console.error('SPED-PROCESSOR: SpedExtractor não está disponível');
        if (typeof callback === 'function') {
            callback({
                sucesso: false,
                mensagem: 'Módulo SpedExtractor não disponível. Verifique a ordem de carregamento dos scripts.'
            });
        }
        return;
    }
    
    // MODIFICAÇÃO: Reestruturar para evitar problemas de escopo e timing
    const processarContribuicoes = function(dadosFiscalProcessado) {
        // Armazenar os dados fiscais no escopo superior
        dadosFiscal = dadosFiscalProcessado;
        
        // Ler arquivo SPED Contribuições
        const leitorContribuicoes = new FileReader();
        leitorContribuicoes.onload = function(e) {
            const conteudoContribuicoes = e.target.result;
            try {
                // Processar SPED Contribuições
                const resultadoContribuicoes = SpedExtractor.processarArquivo(
                    conteudoContribuicoes, 'CONTRIBUICOES');
                dadosContribuicoes = SpedExtractor.extrairDadosParaSimulador(
                    resultadoContribuicoes);
                
                // VERIFICAÇÃO EXPLÍCITA: Garantir que dadosFiscal esteja definido
                const dadosFiscalFinal = dadosFiscal || { 
                    empresa: {}, 
                    parametrosFiscais: { creditos: {}, composicaoTributaria: { creditos: {}, debitos: {} } } 
                };
                
                // Integrar dados com segurança
                const dadosIntegrados = SpedExtractor.integrarDados(dadosFiscalFinal, dadosContribuicoes);
                
                // Adicionar metadados para rastreabilidade
                if (!dadosIntegrados.metadados) {
                    dadosIntegrados.metadados = {};
                }
                dadosIntegrados.metadados.fonteDados = 'SPED Fiscal e Contribuições';
                dadosIntegrados.metadados.timestampImportacao = new Date().toISOString();
                
                // MODIFICAÇÃO: Adicionar débitos aos dados integrados
                if (dadosIntegrados.parametrosFiscais && dadosIntegrados.parametrosFiscais.composicaoTributaria) {
                    // Adicionar valores de débito diretamente à estrutura para facilitar acesso
                    dadosIntegrados.parametrosFiscais.debitos = {
                        pis: dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.pis || 0,
                        cofins: dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.cofins || 0,
                        icms: dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.icms || 0,
                        ipi: dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.ipi || 0,
                        iss: dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.iss || 0
                    };
                }
                
                // Garantir que os registros originais estejam disponíveis
                if (!window.dadosImportadosSped) {
                    window.dadosImportadosSped = {};
                }
                window.dadosImportadosSped.registros = {
                    // Preservar os registros originais do SPED Fiscal
                    E110: dadosFiscal?.registros?.E110 || [],
                    E520: dadosFiscal?.registros?.E520 || [],
                    // Preservar os registros originais do SPED Contribuições
                    M200: dadosContribuicoes.registros?.M200 || [],
                    M600: dadosContribuicoes.registros?.M600 || []
                };
                
                // Logs de diagnóstico
                console.log('=== SPED-PROCESSOR: DADOS PROCESSADOS ===');
                if (dadosIntegrados && dadosIntegrados.parametrosFiscais) {
                    if (dadosIntegrados.parametrosFiscais.creditos) {
                        console.log('Créditos diretos:', JSON.stringify(dadosIntegrados.parametrosFiscais.creditos, null, 2));
                    }
                    
                    if (dadosIntegrados.parametrosFiscais.debitos) {
                        console.log('Débitos diretos:', JSON.stringify(dadosIntegrados.parametrosFiscais.debitos, null, 2));
                    }
                    
                    // Logs adicionais para debug
                    console.log('SPED-PROCESSOR: Verificação de valores IPI:', {
                        debitoIPI: dadosIntegrados.parametrosFiscais.composicaoTributaria?.debitos?.ipi,
                        creditoIPI: dadosIntegrados.parametrosFiscais.composicaoTributaria?.creditos?.ipi
                    });
                }
                
                // Chamar callback com os dados processados
                if (typeof callback === 'function') {
                    callback({
                        sucesso: true,
                        dados: dadosIntegrados
                    });
                }
                
            } catch (erro) {
                console.error('SPED-PROCESSOR: Erro ao processar SPED Contribuições:', erro);
                if (typeof callback === 'function') {
                    callback({
                        sucesso: false,
                        mensagem: 'Erro ao processar SPED Contribuições: ' + erro.message
                    });
                }
            }
        };
        
        leitorContribuicoes.onerror = function(e) {
            console.error('SPED-PROCESSOR: Erro ao ler SPED Contribuições:', e);
            if (typeof callback === 'function') {
                callback({
                    sucesso: false,
                    mensagem: 'Erro ao ler arquivo SPED Contribuições'
                });
            }
        };
        
        leitorContribuicoes.readAsText(inputContribuicoes.files[0]);
    };
    
    // Ler arquivo SPED Fiscal
    const leitorFiscal = new FileReader();
    leitorFiscal.onload = function(e) {
        const conteudoFiscal = e.target.result;
        try {
            // Processar SPED Fiscal com tratamento de erros
            const resultadoFiscal = SpedExtractor.processarArquivo(conteudoFiscal, 'FISCAL');
            const dadosFiscalProcessado = SpedExtractor.extrairDadosParaSimulador(resultadoFiscal);
            
            // MODIFICAÇÃO: Chamar função para processar Contribuições após Fiscal estar pronto
            processarContribuicoes(dadosFiscalProcessado);
            
        } catch (erro) {
            console.error('SPED-PROCESSOR: Erro ao processar SPED Fiscal:', erro);
            // MODIFICAÇÃO: Continuar com processamento de Contribuições mesmo com erro no Fiscal
            // Isso permite que o sistema funcione mesmo se apenas um arquivo for válido
            processarContribuicoes(null);
        }
    };
    
    leitorFiscal.onerror = function(e) {
        console.error('SPED-PROCESSOR: Erro ao ler SPED Fiscal:', e);
        // MODIFICAÇÃO: Continuar com processamento de Contribuições mesmo com erro na leitura do Fiscal
        processarContribuicoes(null);
    };
    
    leitorFiscal.readAsText(inputFiscal.files[0]);
}

// Interface pública
return {
    processarArquivos: processarArquivosSped
};

})();

// Expor o módulo globalmente
if (typeof window !== 'undefined') {
    window.SpedProcessor = SpedProcessor;
    console.log('SPED-PROCESSOR: Módulo de interface carregado com sucesso!');
}