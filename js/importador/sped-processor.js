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

        // Ler arquivo SPED Fiscal
        const leitorFiscal = new FileReader();
        leitorFiscal.onload = function(e) {
            const conteudoFiscal = e.target.result;

            try {
                // Processar SPED Fiscal com tratamento de erros
                const resultadoFiscal = SpedExtractor.processarArquivo(conteudoFiscal, 'FISCAL');
                const dadosFiscal = SpedExtractor.extrairDadosParaSimulador(resultadoFiscal);

                // Ler arquivo SPED Contribuições
                const leitorContribuicoes = new FileReader();
                leitorContribuicoes.onload = function(e) {
                    const conteudoContribuicoes = e.target.result;

                    try {
                        // Processar SPED Contribuições com tratamento de erros
                        const resultadoContribuicoes = SpedExtractor.processarArquivo(
                            conteudoContribuicoes, 'CONTRIBUICOES');
                        const dadosContribuicoes = SpedExtractor.extrairDadosParaSimulador(
                            resultadoContribuicoes);

                        // Integrar dados
                        const dadosIntegrados = SpedExtractor.integrarDados(dadosFiscal, dadosContribuicoes);

                        // Adicionar metadados para rastreabilidade
                        if (!dadosIntegrados.metadados) {
                            dadosIntegrados.metadados = {};
                        }
                        dadosIntegrados.metadados.fonteDados = 'SPED Fiscal e Contribuições';
                        dadosIntegrados.metadados.timestampImportacao = new Date().toISOString();

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
            } catch (erro) {
                console.error('SPED-PROCESSOR: Erro ao processar SPED Fiscal:', erro);
                if (typeof callback === 'function') {
                    callback({
                        sucesso: false,
                        mensagem: 'Erro ao processar SPED Fiscal: ' + erro.message
                    });
                }
            }
        };

        leitorFiscal.onerror = function(e) {
            console.error('SPED-PROCESSOR: Erro ao ler SPED Fiscal:', e);
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