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

                            // Garantir que os registros originais estejam disponíveis
                            if (!window.dadosImportadosSped) {
                                window.dadosImportadosSped = {};
                            }
                            window.dadosImportadosSped.registros = {
                                // Preservar os registros originais do SPED Fiscal
                                E110: dadosFiscal.registros?.E110 || [],
                                E520: dadosFiscal.registros?.E520 || [],
                                // Preservar os registros originais do SPED Contribuições
                                M200: dadosContribuicoes.registros?.M200 || [],
                                M600: dadosContribuicoes.registros?.M600 || []
                            };
                        }

                        // Antes de chamar o callback com o resultado
                        console.log('=== SPED-PROCESSOR: DADOS PROCESSADOS ===');
                        if (dadosIntegrados && dadosIntegrados.parametrosFiscais) {
                            if (dadosIntegrados.parametrosFiscais.creditos) {
                                console.log('Créditos diretos:', JSON.stringify(dadosIntegrados.parametrosFiscais.creditos, null, 2));
                            }

                            // MODIFICAÇÃO: Log de débitos
                            if (dadosIntegrados.parametrosFiscais.debitos) {
                                console.log('Débitos diretos:', JSON.stringify(dadosIntegrados.parametrosFiscais.debitos, null, 2));
                            }

                            if (dadosIntegrados.parametrosFiscais.composicaoTributaria) {
                                if (dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos) {
                                    console.log('ComposicaoTributaria.creditos:', 
                                        JSON.stringify(dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos, null, 2));
                                }

                                if (dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos) {
                                    console.log('ComposicaoTributaria.debitos:', 
                                        JSON.stringify(dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos, null, 2));
                                }
                            }
                        }

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

                            // ADIÇÃO: Log específico para valores de IPI
                            console.log('SPED-PROCESSOR: Verificação de valores IPI:', {
                                debitoIPI: dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.ipi,
                                creditoIPI: dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.ipi
                            });

                            // Garantir que os registros originais estejam disponíveis
                            if (!window.dadosImportadosSped) {
                                window.dadosImportadosSped = {};
                            }
                            window.dadosImportadosSped.registros = {
                                // Preservar os registros originais do SPED Fiscal
                                E110: dadosFiscal.registros?.E110 || [],
                                E520: dadosFiscal.registros?.E520 || [],
                                // Preservar os registros originais do SPED Contribuições
                                M200: dadosContribuicoes.registros?.M200 || [],
                                M600: dadosContribuicoes.registros?.M600 || []
                            };
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