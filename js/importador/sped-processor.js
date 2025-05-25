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
        
        // Ler arquivo SPED Fiscal
        const leitorFiscal = new FileReader();
        leitorFiscal.onload = function(e) {
            const conteudoFiscal = e.target.result;
            
            // Processar SPED Fiscal
            const resultadoFiscal = SpedExtractor.processarArquivo(conteudoFiscal, 'FISCAL');
            const dadosFiscal = SpedExtractor.extrairDadosParaSimulador(resultadoFiscal);
            
            // Ler arquivo SPED Contribuições
            const leitorContribuicoes = new FileReader();
            leitorContribuicoes.onload = function(e) {
                const conteudoContribuicoes = e.target.result;
                
                // Processar SPED Contribuições
                const resultadoContribuicoes = SpedExtractor.processarArquivo(
                    conteudoContribuicoes, 'CONTRIBUICOES');
                const dadosContribuicoes = SpedExtractor.extrairDadosParaSimulador(
                    resultadoContribuicoes);
                
                // Integrar dados
                const dadosIntegrados = SpedExtractor.integrarDados(dadosFiscal, dadosContribuicoes);
                
                // Chamar callback com os dados processados
                if (typeof callback === 'function') {
                    callback({
                        sucesso: true,
                        dados: dadosIntegrados
                    });
                }
            };
            
            leitorContribuicoes.onerror = function() {
                if (typeof callback === 'function') {
                    callback({
                        sucesso: false,
                        mensagem: 'Erro ao ler arquivo SPED Contribuições'
                    });
                }
            };
            
            leitorContribuicoes.readAsText(inputContribuicoes.files[0]);
        };
        
        leitorFiscal.onerror = function() {
            if (typeof callback === 'function') {
                callback({
                    sucesso: false,
                    mensagem: 'Erro ao ler arquivo SPED Fiscal'
                });
            }
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