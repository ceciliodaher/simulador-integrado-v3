/**
 * Controller do módulo de importação SPED - VERSÃO SIMPLIFICADA
 * Gerencia a interface de usuário e o fluxo de importação
 * VERSÃO: Maio 2025
 */
const ImportacaoController = (function() {
    // Elementos da interface
    let elements = {};
    let dadosImportados = null;
    
    /**
     * Inicializa o controller
     */
    function inicializar() {
        console.log('IMPORTACAO-CONTROLLER: Iniciando inicialização...');
        
        // Mapear elementos da interface
        mapearElementos();
        
        // Adicionar event listeners
        adicionarEventListeners();
        
        console.log('IMPORTACAO-CONTROLLER: Inicialização concluída');
        return true;
    }
    
    /**
     * Verifica se o DataManager está disponível e inicializado
     * @returns {boolean} true se o DataManager estiver disponível
     */
    function verificarDataManager() {
        if (typeof window.DataManager === 'undefined') {
            console.error('IMPORTACAO-CONTROLLER: DataManager não está disponível');
            adicionarLog('Erro: O componente DataManager não está disponível', 'error');
            return false;
        }

        // Verificar se os métodos essenciais estão disponíveis
        const metodosEssenciais = [
            'formatarMoeda', 
            'extrairValorMonetario', 
            'converterParaEstruturaPlana',
            'normalizarValor'
        ];

        const metodosFaltantes = metodosEssenciais.filter(
            metodo => typeof window.DataManager[metodo] !== 'function'
        );

        if (metodosFaltantes.length > 0) {
            console.error(
                'IMPORTACAO-CONTROLLER: DataManager não possui todos os métodos necessários:', 
                metodosFaltantes
            );
            adicionarLog(
                `Erro: O DataManager não possui os métodos: ${metodosFaltantes.join(', ')}`, 
                'error'
            );
            return false;
        }

        return true;
    }
    
    /**
     * Mapeia elementos da interface
     */
    function mapearElementos() {
        elements = {
            // Inputs de arquivo
            spedFiscal: document.getElementById('sped-fiscal'),
            spedContribuicoes: document.getElementById('sped-contribuicoes'),
            spedEcf: document.getElementById('sped-ecf'),
            spedEcd: document.getElementById('sped-ecd'),

            // Checkboxes de opções
            importEmpresa: document.getElementById('import-empresa'),
            importProdutos: document.getElementById('import-produtos'),
            importImpostos: document.getElementById('import-impostos'),
            importCiclo: document.getElementById('import-ciclo'),

            // Botões
            btnImportar: document.getElementById('btn-importar-sped'),
            btnCancelar: document.getElementById('btn-cancelar-importacao'),

            // Área de log
            logArea: document.getElementById('import-log')
        };
        
        console.log('IMPORTACAO-CONTROLLER: Elementos mapeados');
    }
    
    /**
     * Adiciona os event listeners aos elementos da interface
     */
    function adicionarEventListeners() {
        // Botões principais
        if (elements.btnImportar) {
            elements.btnImportar.addEventListener('click', iniciarImportacao);
        }
        
        if (elements.btnCancelar) {
            elements.btnCancelar.addEventListener('click', cancelarImportacao);
        }
        
        console.log('IMPORTACAO-CONTROLLER: Event listeners configurados');
    }
    
    /**
     * Inicia o processo de importação
     */
    function iniciarImportacao() {
        console.log('IMPORTACAO-CONTROLLER: Iniciando processo de importação');

        // Limpar dados anteriores
        dadosImportados = null;

        // Verificar arquivos selecionados
        if (!verificarArquivosSelecionados()) {
            adicionarLog('Selecione pelo menos um arquivo SPED para importação.');
            return;
        }

        // Desabilitar botão durante processamento
        if (elements.btnImportar) {
            elements.btnImportar.disabled = true;
            elements.btnImportar.textContent = 'Processando...';
        }

        adicionarLog('Iniciando importação de dados SPED...');

        // Utilizar SpedProcessor para processar os arquivos
        window.SpedProcessor.processarArquivos(
            elements.spedFiscal, 
            elements.spedContribuicoes, 
            function(resultado) {
                if (resultado.sucesso) {
                    // Validar e normalizar dados importados usando DataManager
                    try {
                        // Adicionar flag para identificar dados do SPED
                        if (resultado.dados && resultado.dados.parametrosFiscais && 
                            resultado.dados.parametrosFiscais.composicaoTributaria) {
                            resultado.dados.dadosSpedImportados = true;
                        }

                        const dadosValidados = window.DataManager.validarENormalizar(resultado.dados);
                        dadosImportados = dadosValidados;

                        // Salvar no escopo global para referenciar depois
                        window.dadosImportadosSped = dadosValidados;

                        // Preencher campos do simulador
                        preencherCamposSimulador(dadosImportados);

                        adicionarLog('Importação concluída com sucesso!', 'success');
                        adicionarLog(`Dados da empresa: ${dadosImportados.empresa?.nome || 'N/A'}`);
                        // Usar DataManager.formatarMoeda em vez de formatarMoeda
                        adicionarLog(`Faturamento: ${window.DataManager.formatarMoeda(dadosImportados.empresa?.faturamento || 0)}`);

                        finalizarImportacao(true);
                    } catch (erro) {
                        console.error('IMPORTACAO-CONTROLLER: Erro na validação dos dados:', erro);
                        finalizarImportacao(false, 'Erro na validação dos dados importados: ' + erro.message);
                    }
                } else {
                    console.error('IMPORTACAO-CONTROLLER: Erro durante processamento:', resultado.mensagem);
                    finalizarImportacao(false, resultado.mensagem);
                }
            }
        );
    }
    
    /**
     * Verifica se todas as dependências necessárias estão disponíveis
     */
    function verificarDependencias() {
        const dependenciasNecessarias = [
            { nome: 'SpedProcessor', referencia: window.SpedProcessor },
            { nome: 'SpedExtractor', referencia: window.SpedExtractor },
            { nome: 'DataManager', referencia: window.DataManager }
        ];

        const modulosIndisponiveis = [];
        const detalhesVerificacao = [];

        dependenciasNecessarias.forEach(dep => {
            if (!dep.referencia) {
                modulosIndisponiveis.push(dep.nome);
                detalhesVerificacao.push(`Módulo ${dep.nome} não encontrado`);
            } else if (dep.nome === 'DataManager') {
                // Verificação adicional para o DataManager
                const metodosEssenciais = [
                    'formatarMoeda', 
                    'extrairValorMonetario', 
                    'converterParaEstruturaPlana'
                ];

                const metodosFaltantes = metodosEssenciais.filter(
                    metodo => typeof dep.referencia[metodo] !== 'function'
                );

                if (metodosFaltantes.length > 0) {
                    detalhesVerificacao.push(
                        `DataManager encontrado, mas não possui os métodos: ${metodosFaltantes.join(', ')}`
                    );
                } else {
                    detalhesVerificacao.push('DataManager verificado com sucesso');
                }
            }
        });

        const resultadoVerificacao = {
            sucesso: modulosIndisponiveis.length === 0,
            modulos: modulosIndisponiveis,
            detalhes: detalhesVerificacao
        };

        console.log('IMPORTACAO-CONTROLLER: Verificação de dependências:', resultadoVerificacao);

        return resultadoVerificacao;
    }
    
    /**
     * Processa os arquivos SPED usando SpedProcessor
     */
    function processarArquivosSped() {
        // Verificar dependências necessárias
        const dependenciasDisponiveis = verificarDependencias();

        if (!dependenciasDisponiveis.sucesso) {
            console.error('IMPORTACAO-CONTROLLER: Dependências não disponíveis:', dependenciasDisponiveis.modulos);
            finalizarImportacao(false, `Módulos não disponíveis: ${dependenciasDisponiveis.modulos.join(', ')}`);
            return;
        }

        // Verificar especificamente o DataManager
        if (!verificarDataManager()) {
            finalizarImportacao(false, 'DataManager não está disponível ou não está completo');
            return;
        }

        // Processar os arquivos usando SpedProcessor
        window.SpedProcessor.processarArquivos(
            elements.spedFiscal, 
            elements.spedContribuicoes, 
            function(resultado) {
                if (resultado.sucesso) {
                    // Validar e normalizar dados importados usando DataManager
                    try {
                        const dadosValidados = window.DataManager.validarENormalizar(resultado.dados);
                        dadosImportados = dadosValidados;

                        // Preencher campos do simulador
                        preencherCamposSimulador(dadosImportados);

                        adicionarLog('Importação concluída com sucesso!');
                        adicionarLog(`Dados da empresa: ${dadosImportados.empresa?.nome || 'N/A'}`);
                        // Usar DataManager.formatarMoeda em vez de formatarMoeda
                        adicionarLog(`Faturamento: ${window.DataManager.formatarMoeda(dadosImportados.empresa?.faturamento || 0)}`);

                        finalizarImportacao(true);
                    } catch (erro) {
                        console.error('IMPORTACAO-CONTROLLER: Erro na validação dos dados:', erro);
                        finalizarImportacao(false, 'Erro na validação dos dados importados: ' + erro.message);
                    }
                } else {
                    console.error('IMPORTACAO-CONTROLLER: Erro durante processamento:', resultado.mensagem);
                    finalizarImportacao(false, resultado.mensagem);
                }
            }
        );
    }
    
    /**
     * Preenche os campos do simulador com os dados extraídos
     * @param {Object} dados - Dados na estrutura aninhada
     */
    function preencherCamposSimulador(dados) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo campos do simulador:', dados);

        try {
            // Validar dados recebidos
            if (!dados || typeof dados !== 'object') {
                throw new Error('Dados inválidos para preenchimento do simulador');
            }

            // Verificar se dados estão na estrutura aninhada
            const estruturaTipo = window.DataManager.detectarTipoEstrutura(dados);
            if (estruturaTipo !== "aninhada") {
                throw new Error('Dados não estão na estrutura aninhada canônica');
            }

            // Validar e normalizar os dados antes de preencher
            const dadosValidados = window.DataManager.validarENormalizar(dados);

            // Converter para estrutura plana para facilitar o acesso aos campos
            const dadosPlanos = window.DataManager.converterParaEstruturaPlana(dadosValidados);

            // Preencher dados da empresa
            if (elements.importEmpresa?.checked !== false) {
                preencherDadosEmpresa(dadosPlanos);
                adicionarLog('Dados da empresa preenchidos.');
            }

            // Preencher parâmetros fiscais
            if (elements.importImpostos?.checked !== false) {
                preencherParametrosFiscais(dadosPlanos);
                adicionarLog('Parâmetros fiscais preenchidos.');
            }

            // Preencher ciclo financeiro
            if (elements.importCiclo?.checked !== false) {
                preencherCicloFinanceiro(dadosPlanos);
                adicionarLog('Dados do ciclo financeiro preenchidos.');
            }

            // Navegar para a aba de simulação
            setTimeout(() => {
                const abaPrincipal = document.querySelector('.tab-button[data-tab="simulacao"]');
                if (abaPrincipal) {
                    abaPrincipal.click();
                }
            }, 500);

        } catch (erro) {
            console.error('IMPORTACAO-CONTROLLER: Erro ao preencher campos:', erro);
            adicionarLog('Erro ao preencher campos do simulador: ' + erro.message, 'error');
        }
    }
    
    /**
     * Preenche os dados da empresa no formulário
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    function preencherDadosEmpresa(dadosPlanos) {
        // Verificar tipo da estrutura de dados
        if (window.DataManager.detectarTipoEstrutura(dadosPlanos) === "aninhada") {
            throw new Error('Dados não estão na estrutura plana esperada');
        }

        // Nome da empresa
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa && dadosPlanos.nomeEmpresa) {
            campoEmpresa.value = dadosPlanos.nomeEmpresa;
            campoEmpresa.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Faturamento - usar DataManager para validação e formatação
        const campoFaturamento = document.getElementById('faturamento');
        if (campoFaturamento && dadosPlanos.faturamento !== undefined) {
            // Usar DataManager para extrair e formatar o valor monetário
            const valorValidado = window.DataManager.normalizarValor(dadosPlanos.faturamento, 'monetario');
            campoFaturamento.value = window.DataManager.formatarMoeda(valorValidado);

            // Preservar valor numérico para cálculos
            if (campoFaturamento.dataset) {
                campoFaturamento.dataset.rawValue = valorValidado.toString();
            }
            campoFaturamento.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Regime tributário
        const campoRegime = document.getElementById('regime');
        if (campoRegime && dadosPlanos.regime) {
            // Normalizar o regime usando DataManager
            const regimeNormalizado = window.DataManager.normalizarValor(
                dadosPlanos.regime.toLowerCase(), 
                'texto'
            );

            if (['simples', 'presumido', 'real'].includes(regimeNormalizado)) {
                campoRegime.value = regimeNormalizado;
                campoRegime.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }
    
    /**
     * Preenche os parâmetros fiscais no formulário
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    function preencherParametrosFiscais(dadosPlanos) {
        // Verificar tipo da estrutura de dados
        if (window.DataManager.detectarTipoEstrutura(dadosPlanos) === "aninhada") {
            throw new Error('Dados não estão na estrutura plana esperada');
        }

        // Verifica se temos dados de composição tributária SPED
        const temDadosSPED = dadosPlanos.dadosSpedImportados === true;

        // Preencher débitos
        preencherCampoTributario('debito-pis', dadosPlanos.debitoPis || 0);
        preencherCampoTributario('debito-cofins', dadosPlanos.debitoCofins || 0);
        preencherCampoTributario('debito-icms', dadosPlanos.debitoIcms || 0);
        preencherCampoTributario('debito-ipi', dadosPlanos.debitoIpi || 0);
        preencherCampoTributario('debito-iss', dadosPlanos.debitoIss || 0);

        // Preencher créditos
        preencherCampoTributario('credito-pis', dadosPlanos.creditosPIS || dadosPlanos.creditoPis || 0);
        preencherCampoTributario('credito-cofins', dadosPlanos.creditosCOFINS || dadosPlanos.creditoCofins || 0);
        preencherCampoTributario('credito-icms', dadosPlanos.creditosICMS || dadosPlanos.creditoIcms || 0);
        preencherCampoTributario('credito-ipi', dadosPlanos.creditosIPI || dadosPlanos.creditoIpi || 0);
        preencherCampoTributario('credito-iss', dadosPlanos.creditoIss || 0);

        // Se há dados SPED, adicionar classe para identificar campos
        if (temDadosSPED) {
            document.querySelectorAll('.campo-tributario').forEach(campo => {
                campo.classList.add('sped-data');
            });
            adicionarLog('Dados tributários do SPED aplicados ao formulário.', 'success');
        }

        // Regime PIS/COFINS
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');
        if (campoPisCofinsRegime && dadosPlanos.regimePisCofins) {
            const regimeFormatado = dadosPlanos.regimePisCofins.replace(' ', '-');
            if (['cumulativo', 'nao-cumulativo'].includes(regimeFormatado)) {
                campoPisCofinsRegime.value = regimeFormatado;
                campoPisCofinsRegime.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }
    
    /**
     * Preenche campo tributário com valor validado usando DataManager
     * @param {string} campoId - ID do campo a ser preenchido
     * @param {number|string} valor - Valor a ser preenchido
     */
    function preencherCampoTributario(campoId, valor) {
        const elemento = document.getElementById(campoId);
        if (!elemento) return;

        try {
            // Validar e normalizar valor usando DataManager
            const valorValidado = window.DataManager.normalizarValor(valor, 'monetario');

            // Formatar e definir valor
            elemento.value = window.DataManager.formatarMoeda(valorValidado);

            // Preservar valor numérico para cálculos
            if (elemento.dataset) {
                elemento.dataset.rawValue = valorValidado.toString();
            }

            // Disparar evento para recálculos
            elemento.dispatchEvent(new Event('input', { bubbles: true }));

        } catch (erro) {
            console.error(`IMPORTACAO-CONTROLLER: Erro ao preencher campo ${campoId}:`, erro);
            // Em caso de erro, definir valor zero
            elemento.value = window.DataManager.formatarMoeda(0);
            if (elemento.dataset) {
                elemento.dataset.rawValue = '0';
            }
        }
    }
    
    /**
     * Preenche dados do ciclo financeiro com validação do DataManager
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    function preencherCicloFinanceiro(dadosPlanos) {
        // Verificar tipo da estrutura de dados
        if (window.DataManager.detectarTipoEstrutura(dadosPlanos) === "aninhada") {
            throw new Error('Dados não estão na estrutura plana esperada');
        }

        // PMR - Prazo Médio de Recebimento
        const campoPmr = document.getElementById('pmr');
        if (campoPmr && dadosPlanos.pmr !== undefined) {
            const pmrValidado = window.DataManager.normalizarValor(dadosPlanos.pmr, 'numero');
            campoPmr.value = Math.max(1, Math.min(365, pmrValidado));
            campoPmr.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // PMP - Prazo Médio de Pagamento
        const campoPmp = document.getElementById('pmp');
        if (campoPmp && dadosPlanos.pmp !== undefined) {
            const pmpValidado = window.DataManager.normalizarValor(dadosPlanos.pmp, 'numero');
            campoPmp.value = Math.max(1, Math.min(365, pmpValidado));
            campoPmp.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // PME - Prazo Médio de Estoque
        const campoPme = document.getElementById('pme');
        if (campoPme && dadosPlanos.pme !== undefined) {
            const pmeValidado = window.DataManager.normalizarValor(dadosPlanos.pme, 'numero');
            campoPme.value = Math.max(0, Math.min(365, pmeValidado));
            campoPme.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Percentual de vendas à vista
        const campoPercVista = document.getElementById('perc-vista');
        if (campoPercVista && dadosPlanos.percVista !== undefined) {
            const percVistaValidado = window.DataManager.extrairValorPercentual(dadosPlanos.percVista);
            const percVistaFormatado = (percVistaValidado * 100).toFixed(1);
            campoPercVista.value = percVistaFormatado;
            campoPercVista.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    /**
     * Finaliza o processo de importação
     */
    function finalizarImportacao(sucesso, mensagem) {
        // Reabilitar botão
        if (elements.btnImportar) {
            elements.btnImportar.disabled = false;
            elements.btnImportar.textContent = 'Importar Dados';
        }
        
        if (!sucesso && mensagem) {
            adicionarLog('Erro: ' + mensagem);
        }
    }
    
    /**
     * Cancela o processo de importação
     */
    function cancelarImportacao() {
        // Limpar campos de arquivo
        if (elements.spedFiscal) elements.spedFiscal.value = '';
        if (elements.spedContribuicoes) elements.spedContribuicoes.value = '';
        if (elements.spedEcf) elements.spedEcf.value = '';
        if (elements.spedEcd) elements.spedEcd.value = '';
        
        // Limpar dados
        dadosImportados = null;
        
        // Limpar log
        if (elements.logArea) {
            elements.logArea.innerHTML = '<p class="text-muted">Importação cancelada pelo usuário.</p>';
        }
    }
    
    /**
     * Verifica se algum arquivo foi selecionado
     */
    function verificarArquivosSelecionados() {
        return (
            (elements.spedFiscal?.files.length > 0) ||
            (elements.spedContribuicoes?.files.length > 0) ||
            (elements.spedEcf?.files.length > 0) ||
            (elements.spedEcd?.files.length > 0)
        );
    }
    
    /**
     * Verifica se os dados estão na estrutura esperada
     * @param {Object} dados - Dados a serem verificados
     * @param {string} tipoEsperado - Tipo de estrutura esperada ('aninhada' ou 'plana')
     * @returns {boolean} - true se estiver na estrutura esperada
     */
    function verificarEstruturaDados(dados, tipoEsperado) {
        if (!dados || typeof dados !== 'object') {
            return false;
        }

        const tipoDetectado = window.DataManager.detectarTipoEstrutura(dados);
        return tipoDetectado === tipoEsperado;
    }
    
    /**
     * Adiciona uma mensagem à área de log
     */
    function adicionarLog(mensagem, tipo = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        
        // Atualizar interface de log
        if (elements.logArea) {
            const logItem = document.createElement('p');
            logItem.className = `log-${tipo}`;
            logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> ${mensagem}`;
            
            elements.logArea.appendChild(logItem);
            elements.logArea.scrollTop = elements.logArea.scrollHeight;
        }
        
        // Log no console
        console.log(`IMPORTACAO-CONTROLLER [${tipo}]:`, mensagem);
    }
        
    // Interface pública
    return {
        inicializar,
        adicionarLog,
        obterDadosImportados: () => dadosImportados,
        versao: '3.0.0-simplificado'
    };
})();

// Garantir carregamento global e verificar dependências
if (typeof window !== 'undefined') {
    window.ImportacaoController = ImportacaoController;
    
    // Verificar se as dependências críticas estão disponíveis
    const dependenciasVerificacao = [
        'DataManager', 'SpedProcessor', 'SpedExtractor'
    ];
    
    const dependenciasFaltantes = dependenciasVerificacao.filter(dep => !window[dep]);
    
    if (dependenciasFaltantes.length > 0) {
        console.warn('IMPORTACAO-CONTROLLER: Dependências não encontradas:', dependenciasFaltantes);
        console.warn('IMPORTACAO-CONTROLLER: Algumas funcionalidades podem não estar disponíveis');
    }
    
    console.log('IMPORTACAO-CONTROLLER: Módulo carregado com sucesso na versão', ImportacaoController.versao);
} else {
    console.error('IMPORTACAO-CONTROLLER: Ambiente window não disponível');
}