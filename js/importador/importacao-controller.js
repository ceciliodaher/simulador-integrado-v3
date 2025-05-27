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
        
        // Adicionar listeners para sincronização de regimes
        const campoRegime = document.getElementById('regime');
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');

        if (campoRegime) {
            campoRegime.addEventListener('change', function() {
                sincronizarRegimes('regime', this.value);
            });
        }

        if (campoPisCofinsRegime) {
            campoPisCofinsRegime.addEventListener('change', function() {
                sincronizarRegimes('pis-cofins-regime', this.value);
            });
        }
        
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
            'normalizarValor',
            'obterEstruturaAninhadaPadrao', // Adicionado: essencial para o processo SPED
            'validarENormalizar'            // Adicionado: essencial para validação
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

            // Verificar especificamente a ausência da função obterEstruturaAninhadaPadrao
            if (metodosFaltantes.includes('obterEstruturaAninhadaPadrao')) {
                console.warn('IMPORTACAO-CONTROLLER: Função obterEstruturaAninhadaPadrao não encontrada. Isso afetará a importação SPED.');
                adicionarLog('Aviso: Função de estrutura canônica não disponível. Utilizando alternativa.', 'warning');
            }

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

        // Ativar flag global para impedir modificações durante importação
        window.processandoSPED = true;

        // Limpar dados anteriores
        dadosImportados = null;

        // Verificar arquivos selecionados
        if (!verificarArquivosSelecionados()) {
            adicionarLog('Selecione pelo menos um arquivo SPED para importação.');
            window.processandoSPED = false;
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
                // INSERIR AQUI - INÍCIO DO BLOCO DE LOGS
                console.log('=== IMPORTACAO-CONTROLLER: DADOS RECEBIDOS DO SPED PROCESSOR ===');

                // Verificar estrutura de créditos nos dados recebidos
                if (resultado.dados && resultado.dados.parametrosFiscais) {
                    if (resultado.dados.parametrosFiscais.creditos) {
                        console.log('Créditos diretos:', JSON.stringify(resultado.dados.parametrosFiscais.creditos, null, 2));
                    } else {
                        console.log('Estrutura parametrosFiscais.creditos não encontrada');
                    }

                    if (resultado.dados.parametrosFiscais.composicaoTributaria && 
                        resultado.dados.parametrosFiscais.composicaoTributaria.creditos) {
                        console.log('ComposicaoTributaria.creditos:', 
                            JSON.stringify(resultado.dados.parametrosFiscais.composicaoTributaria.creditos, null, 2));
                    } else {
                        console.log('Estrutura composicaoTributaria.creditos não encontrada');
                    }
                } else {
                    console.log('Estrutura parametrosFiscais não encontrada nos dados recebidos');
                }
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
        
        // Desativar flag de processamento SPED após conclusão
        window.processandoSPED = false;
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
        // INSERIR AQUI - INÍCIO DO BLOCO DE LOGS
        console.log('=== IMPORTACAO-CONTROLLER: INICIANDO PROCESSAMENTO DE ARQUIVOS SPED ===');
        // FIM DO BLOCO DE LOGS
        // Verificar dependências necessárias
        const dependenciasDisponiveis = verificarDependencias();

        if (!dependenciasDisponiveis.sucesso) {
            console.error('IMPORTACAO-CONTROLLER: Dependências não disponíveis:', dependenciasDisponiveis.modulos);
            finalizarImportacao(false, `Módulos não disponíveis: ${dependenciasDisponiveis.modulos.join(', ')}`);
            return;
        }

        // Verificar especificamente o DataManager - com aviso em vez de bloqueio
        const dataManagerDisponivel = verificarDataManager();
        if (!dataManagerDisponivel) {
            console.warn('IMPORTACAO-CONTROLLER: DataManager não está completamente disponível. Continuando com funcionalidade limitada.');
            adicionarLog('Aviso: DataManager não está completamente disponível. Funcionalidade pode ser limitada.', 'warning');
            // Continuamos com o processamento, em vez de abortar
        }

        // Processar os arquivos usando SpedProcessor
        window.SpedProcessor.processarArquivos(
            elements.spedFiscal, 
            elements.spedContribuicoes, 
            function(resultado) {
                // INSERIR AQUI - INÍCIO DO BLOCO DE LOGS
                console.log('=== IMPORTACAO-CONTROLLER: RESULTADO DO PROCESSAMENTO SPED ===');
                console.log('Resultado sucesso:', resultado.sucesso);
                if (resultado.dados) {
                    console.log('Dados retornados - estrutura:', window.DataManager.detectarTipoEstrutura(resultado.dados));

                    // Verificar créditos nos dados retornados
                    if (resultado.dados.parametrosFiscais) {
                        if (resultado.dados.parametrosFiscais.creditos) {
                            console.log('Créditos:', JSON.stringify(resultado.dados.parametrosFiscais.creditos, null, 2));
                        }
                        if (resultado.dados.parametrosFiscais.composicaoTributaria && 
                            resultado.dados.parametrosFiscais.composicaoTributaria.creditos) {
                            console.log('ComposicaoTributaria.creditos:', 
                                JSON.stringify(resultado.dados.parametrosFiscais.composicaoTributaria.creditos, null, 2));
                        }
                    }
                }
                if (resultado.sucesso) {
                    // Validar e normalizar dados importados - com verificação robusta
                    try {
                        let dadosValidados;

                        if (dataManagerDisponivel && typeof window.DataManager.validarENormalizar === 'function') {
                            // Usar DataManager para validação se disponível
                            dadosValidados = window.DataManager.validarENormalizar(resultado.dados);
                        } else {
                            // Usar dados sem validação se DataManager não estiver disponível
                            console.warn('IMPORTACAO-CONTROLLER: Função validarENormalizar não disponível. Usando dados sem validação.');
                            adicionarLog('Aviso: Usando dados sem validação completa.', 'warning');
                            dadosValidados = resultado.dados;
                        }

                        dadosImportados = dadosValidados;

                        // Preencher campos do simulador
                        preencherCamposSimulador(dadosImportados);

                        adicionarLog('Importação concluída com sucesso!');
                        adicionarLog(`Dados da empresa: ${dadosImportados.empresa?.nome || 'N/A'}`);

                        // Formatar valor monetário com verificação robusta
                        let faturamentoFormatado;
                        if (dataManagerDisponivel && typeof window.DataManager.formatarMoeda === 'function') {
                            faturamentoFormatado = window.DataManager.formatarMoeda(dadosImportados.empresa?.faturamento || 0);
                        } else {
                            // Formatação simples se DataManager não estiver disponível
                            faturamentoFormatado = `R$ ${(dadosImportados.empresa?.faturamento || 0).toFixed(2)}`;
                        }
                        adicionarLog(`Faturamento: ${faturamentoFormatado}`);

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

            // Verificar se o DataManager está disponível para operações críticas
            const dataManagerCompleto = verificarDataManager();

            // Verificar se dados estão na estrutura aninhada - com verificação robusta
            let estruturaTipo;
            if (dataManagerCompleto && typeof window.DataManager.detectarTipoEstrutura === 'function') {
                estruturaTipo = window.DataManager.detectarTipoEstrutura(dados);
                if (estruturaTipo !== "aninhada") {
                    console.warn('IMPORTACAO-CONTROLLER: Dados não estão na estrutura aninhada canônica. Tentando processar mesmo assim.');
                    adicionarLog('Aviso: Formato de dados não ideal. Tentando processar mesmo assim.', 'warning');
                }
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Função detectarTipoEstrutura não disponível. Assumindo estrutura aninhada.');
                // Verificação simplificada de estrutura aninhada
                estruturaTipo = dados.empresa !== undefined ? "aninhada" : "desconhecida";
            }

            // Validar e normalizar os dados - com verificação robusta
            let dadosValidados;
            if (dataManagerCompleto && typeof window.DataManager.validarENormalizar === 'function') {
                dadosValidados = window.DataManager.validarENormalizar(dados);
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Função validarENormalizar não disponível. Usando dados sem validação.');
                dadosValidados = dados;
            }

            // Converter para estrutura plana ou usar diretamente - com verificação robusta
            let dadosPlanos;
            if (dataManagerCompleto && typeof window.DataManager.converterParaEstruturaPlana === 'function') {
                dadosPlanos = window.DataManager.converterParaEstruturaPlana(dadosValidados);
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Função converterParaEstruturaPlana não disponível. Adaptando manualmente.');
                // Adaptação simplificada - extrair campos principais para estrutura plana
                dadosPlanos = adaptarParaEstruturaPlanaSimplesmente(dadosValidados);
            }

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
            
            // Modificar a parte final da função preencherCamposSimulador em importacao-controller.js
            // (aproximadamente linha 374, após o preenchimento do ciclo financeiro)

            // Navegar para a aba de simulação
            setTimeout(() => {
                const abaPrincipal = document.querySelector('.tab-button[data-tab="simulacao"]');
                if (abaPrincipal) {
                    abaPrincipal.click();
                }

                // ADICIONADO: Disparar evento mais específico para notificar módulos sobre a conclusão da importação
                // com detalhes sobre os valores importados
                const eventoImportacao = new CustomEvent('spedImportacaoConcluida', { 
                    detail: { 
                        dadosImportados: dadosImportados,
                        origemDados: 'sped',
                        timestamp: new Date().toISOString(),
                        valores: {
                            debitoIPI: dadosImportados.parametrosFiscais?.debitos?.ipi || 0,
                            creditoIPI: dadosImportados.parametrosFiscais?.creditos?.ipi || 0,
                            debitoPIS: dadosImportados.parametrosFiscais?.debitos?.pis || 0,
                            creditoPIS: dadosImportados.parametrosFiscais?.creditos?.pis || 0,
                            debitoCOFINS: dadosImportados.parametrosFiscais?.debitos?.cofins || 0,
                            creditoCOFINS: dadosImportados.parametrosFiscais?.creditos?.cofins || 0,
                            debitoICMS: dadosImportados.parametrosFiscais?.debitos?.icms || 0,
                            creditoICMS: dadosImportados.parametrosFiscais?.creditos?.icms || 0
                        }
                    },
                    bubbles: true
                });
                document.dispatchEvent(eventoImportacao);

                // Recalcular créditos tributários explicitamente após navegação
                if (typeof window.calcularCreditosTributarios === 'function') {
                    setTimeout(window.calcularCreditosTributarios, 300);
                }
            }, 500);

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
     * Adapta dados de estrutura aninhada para uma versão simplificada da estrutura plana
     * Usado como fallback quando DataManager.converterParaEstruturaPlana não está disponível
     * @param {Object} dadosAninhados - Dados na estrutura aninhada
     * @returns {Object} - Versão simplificada da estrutura plana
     */
    function adaptarParaEstruturaPlanaSimplesmente(dadosAninhados) {
        // Se já estiver em formato plano, retornar cópia
        if (dadosAninhados.empresa === undefined) {
            return Object.assign({}, dadosAninhados);
        }

        // Criar objeto plano básico
        const plano = {};

        // Copiar dados da empresa
        if (dadosAninhados.empresa) {
            plano.nomeEmpresa = dadosAninhados.empresa.nome || '';
            plano.cnpj = dadosAninhados.empresa.cnpj || '';
            plano.faturamento = dadosAninhados.empresa.faturamento || 0;
            plano.margem = dadosAninhados.empresa.margem || 0;
            plano.setor = dadosAninhados.empresa.setor || '';
            plano.tipoEmpresa = dadosAninhados.empresa.tipoEmpresa || '';
            plano.regime = dadosAninhados.empresa.regime || '';
        }

        // Copiar ciclo financeiro
        if (dadosAninhados.cicloFinanceiro) {
            plano.pmr = dadosAninhados.cicloFinanceiro.pmr || 30;
            plano.pmp = dadosAninhados.cicloFinanceiro.pmp || 30;
            plano.pme = dadosAninhados.cicloFinanceiro.pme || 30;
            plano.percVista = dadosAninhados.cicloFinanceiro.percVista || 0.3;
            plano.percPrazo = dadosAninhados.cicloFinanceiro.percPrazo || 0.7;
        }

        // Copiar parâmetros fiscais
        if (dadosAninhados.parametrosFiscais) {
            plano.aliquota = dadosAninhados.parametrosFiscais.aliquota || 0.265;
            plano.tipoOperacao = dadosAninhados.parametrosFiscais.tipoOperacao || '';
            plano.regimePisCofins = dadosAninhados.parametrosFiscais.regimePisCofins || '';

            // Copiar créditos tributários
            if (dadosAninhados.parametrosFiscais.creditos) {
                plano.creditosPIS = dadosAninhados.parametrosFiscais.creditos.pis || 0;
                plano.creditosCOFINS = dadosAninhados.parametrosFiscais.creditos.cofins || 0;
                plano.creditosICMS = dadosAninhados.parametrosFiscais.creditos.icms || 0;
                plano.creditosIPI = dadosAninhados.parametrosFiscais.creditos.ipi || 0;
            }

            // Para compatibilidade com código existente
            if (dadosAninhados.parametrosFiscais.composicaoTributaria && 
                dadosAninhados.parametrosFiscais.composicaoTributaria.creditos) {
                const creditosSPED = dadosAninhados.parametrosFiscais.composicaoTributaria.creditos;

                // Usar os valores do SPED se forem maiores que zero e não tivermos valores dos créditos padrão
                if (creditosSPED.pis > 0 && !plano.creditosPIS) plano.creditosPIS = creditosSPED.pis;
                if (creditosSPED.cofins > 0 && !plano.creditosCOFINS) plano.creditosCOFINS = creditosSPED.cofins;
                if (creditosSPED.icms > 0 && !plano.creditosICMS) plano.creditosICMS = creditosSPED.icms;
                if (creditosSPED.ipi > 0 && !plano.creditosIPI) plano.creditosIPI = creditosSPED.ipi;
            }
        }

        // Adicionar flags derivadas para compatibilidade
        plano.serviceCompany = plano.tipoEmpresa === 'servicos';
        plano.cumulativeRegime = plano.regimePisCofins === 'cumulativo';
        plano.dadosSpedImportados = true;

        console.log('IMPORTACAO-CONTROLLER: Dados adaptados manualmente para estrutura plana:', plano);
        return plano;
    }
    
    /**
     * Preenche os dados da empresa no formulário
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    function preencherDadosEmpresa(dadosPlanos) {
        // Indicar que estamos processando dados SPED para evitar sincronizações
        window.processandoSPED = true;

        try {
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

            // REGIME TRIBUTÁRIO - DEFINIDO PELO IMPORTADOR
            definirRegimeTributarioSPED(dadosPlanos);

            // TIPO DE EMPRESA - DEFINIDO PELO IMPORTADOR
            definirTipoEmpresaSPED(dadosPlanos);

            // Disparar apenas um evento de importação completa
            document.dispatchEvent(new CustomEvent('spedImportacaoConcluida', { 
                detail: { 
                    dadosImportados: dadosPlanos,
                    origemDados: 'sped'
                }
            }));
        } finally {
            // Desativar flag de processamento após uma pausa
            setTimeout(() => {
                window.processandoSPED = false;
            }, 500);
        }
    }

    /**
     * Define o regime tributário a partir dos dados SPED - Única fonte autorizada
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    function definirRegimeTributarioSPED(dadosPlanos) {
        const campoRegime = document.getElementById('regime');
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');

        if (!campoRegime || !campoPisCofinsRegime) return;

        // Remover todos os event listeners existentes para evitar loops
        const novoRegime = campoRegime.cloneNode(true);
        const novoPisCofinsRegime = campoPisCofinsRegime.cloneNode(true);

        campoRegime.parentNode.replaceChild(novoRegime, campoRegime);
        campoPisCofinsRegime.parentNode.replaceChild(novoPisCofinsRegime, campoPisCofinsRegime);

        let regimeDefinido = false;

        // PRIORIDADE 1: Usar dados do registro 0110 se disponíveis
        const registrosSped = window.dadosImportadosSped?.registros || {};

        if (registrosSped['0110'] && registrosSped['0110'].length > 0) {
            const registro0110 = registrosSped['0110'][0];
            const codIncidencia = registro0110.codIncidencia;

            if (codIncidencia === '2') {
                novoRegime.value = 'presumido';
                novoPisCofinsRegime.value = 'cumulativo';
                adicionarLog(`Regime tributário definido via SPED 0110: LUCRO PRESUMIDO (Cumulativo)`, 'success');
                regimeDefinido = true;
            } else if (codIncidencia === '1') {
                novoRegime.value = 'real';
                novoPisCofinsRegime.value = 'nao-cumulativo';
                adicionarLog(`Regime tributário definido via SPED 0110: LUCRO REAL (Não Cumulativo)`, 'success');
                regimeDefinido = true;
            }
        }

        // FALLBACK: Usar campo regime dos dados planos
        if (!regimeDefinido && dadosPlanos.regime) {
            const regimeNormalizado = dadosPlanos.regime.toLowerCase();
            if (['simples', 'presumido', 'real'].includes(regimeNormalizado)) {
                novoRegime.value = regimeNormalizado;

                // Definir regime PIS/COFINS de acordo com o regime tributário
                if (regimeNormalizado === 'presumido') {
                    novoPisCofinsRegime.value = 'cumulativo';
                } else if (regimeNormalizado === 'real') {
                    novoPisCofinsRegime.value = 'nao-cumulativo';
                }

                adicionarLog(`Regime tributário definido via dados planos: ${regimeNormalizado.toUpperCase()}`, 'info');
            }
        }

        // Notificar sistema da mudança do regime
        if (typeof window.atualizarInterfaceTributaria === 'function') {
            window.atualizarInterfaceTributaria(novoRegime.value, novoPisCofinsRegime.value);
        }

        // Reconectar apenas os event listeners necessários
        novoRegime.addEventListener('change', function() {
            adicionarLog(`Campo regime alterado para: ${this.value}`, 'info');
            // Não chama sincronizarRegimes - a sincronização ocorre apenas no evento disparado pelo usuário
        });

        novoPisCofinsRegime.addEventListener('change', function() {
            adicionarLog(`Campo regime PIS/COFINS alterado para: ${this.value}`, 'info');
            // Não chama sincronizarRegimes - a sincronização ocorre apenas no evento disparado pelo usuário
        });
    }

    /**
     * Define o tipo de empresa a partir dos dados SPED - Única fonte autorizada
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    function definirTipoEmpresaSPED(dadosPlanos) {
        const campoTipoEmpresa = document.getElementById('tipo-empresa');
        if (!campoTipoEmpresa) return;

        // Remover todos os event listeners existentes para evitar loops
        const novoTipoEmpresa = campoTipoEmpresa.cloneNode(true);
        campoTipoEmpresa.parentNode.replaceChild(novoTipoEmpresa, campoTipoEmpresa);

        let tipoDefinido = false;

        // PRIORIDADE 1: Usar dados do registro 0000 (SPED Contribuições)
        const registrosSped = window.dadosImportadosSped?.registros || {};

        if (registrosSped['0000'] && registrosSped['0000'].length > 0) {
            const registro0000 = registrosSped['0000'][0];
            const indTipoAtiv = registro0000.indTipoAtiv;

            // Campo 14 do registro 0000 - INDATIV: 
            // 0 - Industrial ou equiparado a industrial
            // 1 - Prestador de serviços
            // 2 - Atividade de comércio
            // 3 - Pessoas jurídicas referidas nos §§ 6º, 8º e 9º do art. 3º da Lei nº 9.718/98
            // 9 - Outros

            let tipoEmpresa = '';
            switch(indTipoAtiv) {
                case '0':
                    tipoEmpresa = 'industria';
                    break;
                case '1':
                    tipoEmpresa = 'servicos';
                    break;
                case '2':
                    tipoEmpresa = 'comercio';
                    break;
                default:
                    // Para outros tipos, tentar inferir pelo CNAE ou registros
                    if (registrosSped['E520'] && registrosSped['E520'].length > 0) {
                        // Se tem apuração de IPI, provavelmente é indústria
                        tipoEmpresa = 'industria';
                    } else if (registrosSped['E110'] && registrosSped['E110'].length > 0) {
                        // Se tem ICMS e não tem IPI, provavelmente é comércio
                        tipoEmpresa = 'comercio';
                    } else {
                        // Sem ICMS e IPI, provavelmente é serviços
                        tipoEmpresa = 'servicos';
                    }
            }

            if (tipoEmpresa) {
                novoTipoEmpresa.value = tipoEmpresa;
                adicionarLog(`Tipo de empresa definido via SPED 0000: ${tipoEmpresa.toUpperCase()} (INDATIV: ${indTipoAtiv})`, 'success');
                tipoDefinido = true;
            }
        }

        // FALLBACK: Usar campo tipoEmpresa dos dados planos
        if (!tipoDefinido && dadosPlanos.tipoEmpresa) {
            const tipoNormalizado = dadosPlanos.tipoEmpresa.toLowerCase();
            if (['comercio', 'industria', 'servicos'].includes(tipoNormalizado)) {
                novoTipoEmpresa.value = tipoNormalizado;
                adicionarLog(`Tipo de empresa definido via dados planos: ${tipoNormalizado.toUpperCase()}`, 'info');
            }
        }

        // Adicionar event listener necessário
        novoTipoEmpresa.addEventListener('change', function() {
            adicionarLog(`Tipo de empresa alterado para: ${this.value}`, 'info');
        });
    }
    
    /**
     * Preenche os parâmetros fiscais no formulário
     * @param {Object} dadosPlanos - Dados na estrutura plana
     */
    // Substituir a função preencherParametrosFiscais:
    function preencherParametrosFiscais(dadosPlanos) {
        console.log('=== IMPORTACAO-CONTROLLER: PARÂMETROS FISCAIS ===');

        // Verificar tipo da estrutura de dados
        if (window.DataManager.detectarTipoEstrutura(dadosPlanos) === "aninhada") {
            throw new Error('Dados não estão na estrutura plana esperada');
        }

        console.log('Estrutura de dados confirmada como plana');

        // Verificar se dados SPED estão disponíveis
        if (dadosPlanos.dadosSpedImportados === true) {
            console.log('Dados SPED encontrados na estrutura plana');
        } else {
            console.log('Flag dadosSpedImportados não encontrada na estrutura plana');
        }

        // Verificar créditos na estrutura plana
        console.log('creditosPIS:', dadosPlanos.creditosPIS);
        console.log('creditosCOFINS:', dadosPlanos.creditosCOFINS);
        console.log('creditosICMS:', dadosPlanos.creditosICMS);
        console.log('creditosIPI:', dadosPlanos.creditosIPI);

        // MODIFICAÇÃO: Verificar também débitos na estrutura plana
        console.log('debitoPIS:', dadosPlanos.debitoPIS);
        console.log('debitoCOFINS:', dadosPlanos.debitoCOFINS);
        console.log('debitoICMS:', dadosPlanos.debitoICMS);
        console.log('debitoIPI:', dadosPlanos.debitoIPI);

        // CORREÇÃO: Extrair valores de débitos e créditos diretamente dos dadosPlanos
        // Evitando usar valores literais fixos que podem causar inconsistências
        const debitoPIS = dadosPlanos.debitoPIS || 0;
        const debitoCOFINS = dadosPlanos.debitoCOFINS || 0;
        const debitoICMS = dadosPlanos.debitoICMS || 0;
        const debitoIPI = dadosPlanos.debitoIPI || 0;
        const debitoISS = dadosPlanos.debitoISS || 0;

        const creditoPIS = dadosPlanos.creditosPIS || 0;
        const creditoCOFINS = dadosPlanos.creditosCOFINS || 0;
        const creditoICMS = dadosPlanos.creditosICMS || 0;
        const creditoIPI = dadosPlanos.creditosIPI || 0;
        const creditoISS = dadosPlanos.creditosISS || 0;

        // MODIFICAÇÃO: Log adicional para depuração de valores do IPI
        console.log('=== IMPORTACAO-CONTROLLER: VERIFICAÇÃO ADICIONAL DE IPI ===');
        console.log('debitoIPI em dadosPlanos:', dadosPlanos.debitoIPI);
        console.log('creditoIPI em dadosPlanos:', dadosPlanos.creditosIPI);

        // Preencher campos com os valores corretos
        preencherCampoTributario('debito-pis', debitoPIS);
        preencherCampoTributario('credito-pis', creditoPIS);

        preencherCampoTributario('debito-cofins', debitoCOFINS);
        preencherCampoTributario('credito-cofins', creditoCOFINS);

        preencherCampoTributario('debito-icms', debitoICMS);
        preencherCampoTributario('credito-icms', creditoICMS);

        preencherCampoTributario('debito-ipi', debitoIPI);
        preencherCampoTributario('credito-ipi', creditoIPI);

        preencherCampoTributario('debito-iss', debitoISS);
        preencherCampoTributario('credito-iss', creditoISS);

        // Calcular alíquotas efetivas
        calcularAliquotasEfetivas(dadosPlanos.faturamento, debitoPIS, debitoCOFINS, debitoICMS, debitoIPI);

        // === REGIME PIS/COFINS ===
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');
        if (campoPisCofinsRegime && dadosPlanos.regimePisCofins) {
            const regimeFormatado = dadosPlanos.regimePisCofins.replace(' ', '-');
            if (['cumulativo', 'nao-cumulativo'].includes(regimeFormatado)) {
                campoPisCofinsRegime.value = regimeFormatado;
                campoPisCofinsRegime.dispatchEvent(new Event('change', { bubbles: true }));
                adicionarLog(`Regime PIS/COFINS definido como: ${regimeFormatado.toUpperCase()}`, 'info');
            }
        }
    }
        
    /**
     * Sincroniza os campos de regime tributário e regime PIS/COFINS
     * mantendo a consistência entre eles
     * @param {string} origem - Campo que originou a alteração ('regime' ou 'pis-cofins-regime')
     * @param {string} valor - Valor selecionado
     */
    function sincronizarRegimes(origem, valor) {
        const campoRegime = document.getElementById('regime');
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');

        if (!campoRegime || !campoPisCofinsRegime) return;

        // Verificar se estamos em processo de importação SPED
        if (window.processandoSPED) {
            // Durante a importação SPED, não fazemos sincronização automática
            // Os valores serão definidos diretamente pelo ImportacaoController
            adicionarLog('Sincronização de regimes ignorada durante processamento SPED', 'info');
            return;
        }

        // Desabilitar temporariamente os eventos para evitar loop
        const bloqueioEvento = true;

        try {
            // Aplicar as regras de sincronização
            if (origem === 'regime') {
                // Regime tributário alterado, ajustar PIS/COFINS
                if (valor === 'presumido') {
                    campoPisCofinsRegime.value = 'cumulativo';
                } else if (valor === 'real') {
                    campoPisCofinsRegime.value = 'nao-cumulativo';
                }
                // Simples mantém o valor atual
            } else if (origem === 'pis-cofins-regime') {
                // Regime PIS/COFINS alterado, ajustar regime tributário
                if (valor === 'cumulativo' && campoRegime.value !== 'simples') {
                    campoRegime.value = 'presumido';
                } else if (valor === 'nao-cumulativo') {
                    campoRegime.value = 'real';
                }
            }

            adicionarLog(`Regimes sincronizados: ${campoRegime.value.toUpperCase()} - PIS/COFINS ${campoPisCofinsRegime.value.toUpperCase()}`, 'info');

            // Notificar o sistema que houve uma mudança controlada
            if (typeof window.notificarMudancaRegime === 'function') {
                window.notificarMudancaRegime({
                    regime: campoRegime.value,
                    pisCofinsRegime: campoPisCofinsRegime.value,
                    origem: 'importacao-controller'
                });
            }
        } finally {
            // Garantir que eventos são reativados
            window.setTimeout(() => {
                window.processandoSPED = false;
            }, 200);
        }
    }

    // Adicionar nova função para calcular alíquotas efetivas
    // Modificar a função calcularAliquotasEfetivas
    function calcularAliquotasEfetivas(faturamento, debitoPis, debitoCofins, debitoIcms, debitoIpi) {
      if (!faturamento || faturamento <= 0) return;

      const setAliquotaEfetiva = (id, valor) => {
        const campo = document.getElementById(id);
        if (campo) {
          // CORREÇÃO: Calcular alíquota em percentual e adicionar o símbolo de percentual
          const aliquotaPercentual = (valor / faturamento) * 100;
          // Formatar com 3 casas decimais e adicionar o símbolo de percentual
          campo.value = aliquotaPercentual.toFixed(3) + '%';

          // ADIÇÃO: Salvar o valor numérico para possíveis cálculos futuros
          if (campo.dataset) {
            campo.dataset.rawValue = aliquotaPercentual.toString();
          }

          // ADIÇÃO: Log para depuração
          console.log(`Alíquota efetiva para ${id}: ${aliquotaPercentual.toFixed(3)}% (Valor: ${valor}, Faturamento: ${faturamento})`);
        }
      };

      // Calcular e definir alíquotas efetivas para cada tributo
      // CORREÇÃO: Usar o débito líquido (débito - crédito) para cada tributo
      const creditoPis = document.getElementById('credito-pis') ? 
        window.DataManager.extrairValorMonetario(document.getElementById('credito-pis').value) : 0;
      const creditoCofins = document.getElementById('credito-cofins') ? 
        window.DataManager.extrairValorMonetario(document.getElementById('credito-cofins').value) : 0;
      const creditoIcms = document.getElementById('credito-icms') ? 
        window.DataManager.extrairValorMonetario(document.getElementById('credito-icms').value) : 0;
      const creditoIpi = document.getElementById('credito-ipi') ? 
        window.DataManager.extrairValorMonetario(document.getElementById('credito-ipi').value) : 0;

      // Calcular alíquotas efetivas considerando os créditos
      setAliquotaEfetiva('aliquota-efetiva-pis', Math.max(0, debitoPis - creditoPis));
      setAliquotaEfetiva('aliquota-efetiva-cofins', Math.max(0, debitoCofins - creditoCofins));
      setAliquotaEfetiva('aliquota-efetiva-icms', Math.max(0, debitoIcms - creditoIcms));
      setAliquotaEfetiva('aliquota-efetiva-ipi', Math.max(0, debitoIpi - creditoIpi));

      // Alíquota efetiva total - soma dos débitos líquidos dividido pelo faturamento
      const totalDebitoLiquido = Math.max(0, debitoPis - creditoPis) + 
                                Math.max(0, debitoCofins - creditoCofins) + 
                                Math.max(0, debitoIcms - creditoIcms) + 
                                Math.max(0, debitoIpi - creditoIpi);

      setAliquotaEfetiva('aliquota-efetiva-total', totalDebitoLiquido);

      // ADIÇÃO: Log para verificação final
      console.log(`Alíquota efetiva total: ${(totalDebitoLiquido / faturamento * 100).toFixed(3)}% (Total débito líquido: ${totalDebitoLiquido})`);
    }
    
    /**
     * Preenche campo tributário com valor validado usando DataManager
     * @param {string} campoId - ID do campo a ser preenchido
     * @param {number|string} valor - Valor a ser preenchido
     */
    // Modificar na função preencherCampoTributario:
    function preencherCampoTributario(campoId, valor) {
        const elemento = document.getElementById(campoId);
        if (!elemento) return;

        console.log(`=== IMPORTACAO-CONTROLLER: PREENCHENDO CAMPO ${campoId} ===`);
        console.log(`Valor original recebido: ${valor}`);

        try {
            // MODIFICAÇÃO: Garantir que o valor seja tratado como número
            let valorNumerico = valor;
            if (typeof valor === 'string') {
                valorNumerico = parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.'));
            }

            // CORREÇÃO: Verificar se o valor é um número válido antes de prosseguir
            if (isNaN(valorNumerico)) {
                console.error(`IMPORTACAO-CONTROLLER: Valor inválido para ${campoId}: ${valor}`);
                valorNumerico = 0;
            }

            // Validar e normalizar valor usando DataManager
            const valorValidado = window.DataManager.normalizarValor(valorNumerico, 'monetario');

            console.log(`Valor após normalização: ${valorValidado}`);

            // Formatar e definir valor
            elemento.value = window.DataManager.formatarMoeda(valorValidado);

            // Preservar valor numérico para cálculos
            if (elemento.dataset) {
                elemento.dataset.rawValue = valorValidado.toString();
            }

            // Remover readonly para permitir edição
            elemento.readOnly = false;

            // Destacar visualmente que o campo veio do SPED
            elemento.classList.add('sped-data-value');

            // ADIÇÃO: Garantir que o valor seja visível na interface
            if (elemento.parentElement && elemento.parentElement.style) {
                elemento.parentElement.style.display = 'flex';
            }

            // Disparar evento para recálculos
            elemento.dispatchEvent(new Event('input', { bubbles: true }));

            // Log adicional para depuração
            console.log(`Campo ${campoId} preenchido com valor: ${valorValidado} (${elemento.value})`);

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
     * Obtém o valor do faturamento mensal do formulário
     * @returns {number} - Valor do faturamento
     */
    function obterFaturamentoMensal() {
        const campoFaturamento = document.getElementById('faturamento');
        if (!campoFaturamento) {
            console.warn('IMPORTACAO-CONTROLLER: Campo faturamento não encontrado');
            return 0;
        }

        // Verificar dataset.rawValue primeiro
        if (campoFaturamento.dataset && campoFaturamento.dataset.rawValue) {
            const valor = parseFloat(campoFaturamento.dataset.rawValue);
            return isNaN(valor) ? 0 : valor;
        }

        // Extrair do valor formatado
        const valorTexto = campoFaturamento.value;
        if (!valorTexto) return 0;

        // Usar DataManager se disponível
        if (window.DataManager && typeof window.DataManager.extrairValorMonetario === 'function') {
            return window.DataManager.extrairValorMonetario(valorTexto);
        }

        // Fallback manual
        const valorLimpo = valorTexto.replace(/[^\d,.-]/g, '').replace(',', '.');
        const valor = parseFloat(valorLimpo);
        return isNaN(valor) ? 0 : valor;
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
    
    function logDiagnostico(mensagem, dados, tipo = 'info') {
        console.log(`=== IMPORTACAO-CONTROLLER [${tipo.toUpperCase()}]: ${mensagem} ===`);
        if (dados !== undefined) {
            console.log(JSON.stringify(dados, null, 2));
        }

        // Também adiciona ao log visual se disponível
        if (elements.logArea) {
            const logItem = document.createElement('p');
            logItem.className = `log-${tipo}`;
            logItem.innerHTML = `<span class="log-time">[DIAG]</span> ${mensagem}`;

            elements.logArea.appendChild(logItem);
            elements.logArea.scrollTop = elements.logArea.scrollHeight;
        }
    }
        
    // Interface pública
    return {
        inicializar,
        adicionarLog,
        logDiagnostico, // Nova função
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