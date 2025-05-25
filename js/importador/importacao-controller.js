/**
 * Controller do módulo de importação SPED - VERSÃO CORRIGIDA
 * Gerencia a interface de usuário e o fluxo de importação
 * VERSÃO CORRIGIDA - Janeiro 2025
 */
const ImportacaoController = (function() {
    // Elementos da interface
    let elements = {};
    let dadosImportados = null;
    let logImportacao = [];
    
    /**
     * Inicializa o controller
     */
    function inicializar() {
        console.log('IMPORTACAO-CONTROLLER: Iniciando inicialização...');
        
        // Verificar dependências críticas
        if (!verificarDependencias()) {
            console.error('IMPORTACAO-CONTROLLER: Dependências não atendidas');
            return false;
        }
        
        // Mapear elementos da interface
        if (!mapearElementos()) {
            console.error('IMPORTACAO-CONTROLLER: Falha ao mapear elementos da interface');
            return false;
        }
        
        // Adicionar event listeners
        adicionarEventListeners();
        
        // Configurar log
        configurarSistemaLog();
        
        console.log('IMPORTACAO-CONTROLLER: Inicialização concluída com sucesso');
        return true;
    }
    
    /**
     * Verifica se as dependências estão disponíveis
     */
    function verificarDependencias() {
        const dependencias = [
            { nome: 'SpedParser', objeto: window.SpedParser },
            { nome: 'SpedExtractor', objeto: window.SpedExtractor },
            { nome: 'DataManager', objeto: window.DataManager }
        ];
        
        let todasDisponíveis = true;
        
        dependencias.forEach(dep => {
            if (!dep.objeto) {
                console.error(`IMPORTACAO-CONTROLLER: ${dep.nome} não encontrado`);
                todasDisponíveis = false;
            } else {
                console.log(`IMPORTACAO-CONTROLLER: ✓ ${dep.nome} disponível`);
            }
        });
        
        return todasDisponíveis;
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

            // Controles adicionais
            periodoReferencia: document.getElementById('periodo-referencia'),

            // Botões
            btnImportar: document.getElementById('btn-importar-sped'),
            btnCancelar: document.getElementById('btn-cancelar-importacao'),

            // Área de log
            logArea: document.getElementById('import-log'),

            // Controles de log
            btnLimparLog: document.getElementById('btn-limpar-log'),
            btnExportarLog: document.getElementById('btn-exportar-log'),

            // Filtros de log
            filtroInfo: document.getElementById('filtro-info'),
            filtroWarning: document.getElementById('filtro-warning'),
            filtroError: document.getElementById('filtro-error'),
            filtroSuccess: document.getElementById('filtro-success'),

            // Estatísticas
            logStatistics: document.getElementById('log-statistics'),
            statTotal: document.getElementById('stat-total'),
            statSuccess: document.getElementById('stat-success'),
            statWarnings: document.getElementById('stat-warnings'),
            statErrors: document.getElementById('stat-errors')
        };

        // Verificar elementos críticos usando o mapeamento correto
        const elementosCriticos = [
            { id: 'btn-importar-sped', prop: 'btnImportar' },
            { id: 'btn-cancelar-importacao', prop: 'btnCancelar' },
            { id: 'import-log', prop: 'logArea' }
        ];

        let elementosEncontrados = 0;
        elementosCriticos.forEach(elemento => {
            if (elements[elemento.prop]) {
                elementosEncontrados++;
                console.log(`IMPORTACAO-CONTROLLER: ✓ ${elemento.id} mapeado com sucesso`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: ✗ Elemento ${elemento.id} não encontrado no DOM`);
            }
        });

        // Verificar elementos opcionais
        const elementosOpcionais = ['spedFiscal', 'spedContribuicoes', 'spedEcf', 'spedEcd'];
        elementosOpcionais.forEach(prop => {
            if (elements[prop]) {
                console.log(`IMPORTACAO-CONTROLLER: ✓ ${prop} disponível`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: ⚠ ${prop} não encontrado (opcional)`);
            }
        });

        const sucesso = elementosEncontrados >= elementosCriticos.length - 1;
        console.log(`IMPORTACAO-CONTROLLER: Mapeamento ${sucesso ? 'bem-sucedido' : 'falhou'} (${elementosEncontrados}/${elementosCriticos.length} elementos críticos)`);

        return sucesso;
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
        
        // Controles de log
        if (elements.btnLimparLog) {
            elements.btnLimparLog.addEventListener('click', limparLog);
        }
        
        if (elements.btnExportarLog) {
            elements.btnExportarLog.addEventListener('click', exportarLog);
        }
        
        // Filtros de log
        const filtros = ['filtroInfo', 'filtroWarning', 'filtroError', 'filtroSuccess'];
        filtros.forEach(filtro => {
            if (elements[filtro]) {
                elements[filtro].addEventListener('change', aplicarFiltrosLog);
            }
        });
        
        console.log('IMPORTACAO-CONTROLLER: Event listeners configurados');
    }
    
    /**
     * Configura o sistema de log
     */
    function configurarSistemaLog() {
        logImportacao = [];
        atualizarEstatisticasLog();
        
        // Configurar log inicial
        if (elements.logArea) {
            elements.logArea.innerHTML = '<p class="text-muted">Selecione os arquivos SPED e clique em "Importar Dados" para iniciar o processo.</p>';
        }
    }
    
    /**
     * Inicia o processo de importação
     */
    function iniciarImportacao() {
        console.log('IMPORTACAO-CONTROLLER: Iniciando processo de importação');
        
        // Limpar dados anteriores
        dadosImportados = null;
        limparLog();
        
        // Verificar arquivos selecionados
        if (!verificarArquivosSelecionados()) {
            adicionarLog('Selecione pelo menos um arquivo SPED para importação.', 'error');
            return;
        }
        
        // Desabilitar botão durante processamento
        if (elements.btnImportar) {
            elements.btnImportar.disabled = true;
            elements.btnImportar.textContent = 'Processando...';
        }
        
        adicionarLog('Iniciando importação de dados SPED...', 'info');
        
        // Processar arquivos selecionados
        const promessas = [];
        
        if (elements.spedFiscal?.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedFiscal.files[0], 'fiscal'));
        }
        
        if (elements.spedContribuicoes?.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedContribuicoes.files[0], 'contribuicoes'));
        }
        
        if (elements.spedEcf?.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedEcf.files[0], 'ecf'));
        }
        
        if (elements.spedEcd?.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedEcd.files[0], 'ecd'));
        }
        
        // Aguardar processamento de todos os arquivos
        Promise.all(promessas)
            .then(resultados => {
                console.log('IMPORTACAO-CONTROLLER: Todos os arquivos processados', resultados);
                
                // Combinar os resultados
                const dadosCombinados = combinarResultados(resultados);
                
                // Extrair dados para o simulador
                const dadosSimulador = window.SpedExtractor.extrairDadosParaSimulador(dadosCombinados);
                
                // Adaptar dados para o formato esperado pelo DataManager
                const dadosAdaptados = adaptarParaDataManager(dadosSimulador);
                
                // Armazenar dados importados (tanto original quanto adaptado)
                dadosImportados = dadosAdaptados;
                window.dadosImportadosSped = {
                    original: dadosSimulador,
                    adaptado: dadosAdaptados
                }; // Global para referência
                
                // Validar dados adaptados via DataManager (se disponível)
                let dadosValidados = dadosAdaptados;
                if (window.DataManager && typeof window.DataManager.validarENormalizar === 'function') {
                    try {
                        dadosValidados = window.DataManager.validarENormalizar(dadosAdaptados);
                        adicionarLog('Dados validados e normalizados pelo DataManager.', 'success');
                    } catch (erroValidacao) {
                        console.error('IMPORTACAO-CONTROLLER: Erro ao validar dados via DataManager:', erroValidacao);
                        adicionarLog('Erro ao validar dados via DataManager: ' + erroValidacao.message, 'error');
                    }
                }
                
                // Preencher campos do simulador com dados validados
                preencherCamposSimulador(dadosValidados);
                
                adicionarLog('Importação concluída com sucesso!', 'success');
                adicionarLog(`Dados da empresa: ${dadosSimulador.empresa?.nome || 'N/A'}`, 'info');
                adicionarLog(`Faturamento mensal: ${formatarMoeda(dadosSimulador.empresa?.faturamento || 0)}`, 'info');
                
            })
            .catch(erro => {
                console.error('IMPORTACAO-CONTROLLER: Erro durante importação:', erro);
                adicionarLog('Erro durante a importação: ' + erro.message, 'error');
            })
            .finally(() => {
                // Reabilitar botão
                if (elements.btnImportar) {
                    elements.btnImportar.disabled = false;
                    elements.btnImportar.textContent = 'Importar Dados';
                }
            });
    }
    
    /**
     * Processa um arquivo SPED
     */
    function processarArquivoSped(arquivo, tipo) {
        adicionarLog(`Processando arquivo ${arquivo.name} (${tipo})...`, 'info');

        return new Promise((resolve, reject) => {
            try {
                // Validar arquivo antes de processar
                if (!arquivo || arquivo.size === 0) {
                    adicionarLog(`Arquivo ${arquivo.name} vazio ou inválido.`, 'error');
                    reject(new Error('Arquivo vazio ou inválido'));
                    return;
                }

                console.log(`IMPORTACAO-CONTROLLER: Iniciando processamento de ${arquivo.name} (${tipo}) - Tamanho: ${arquivo.size} bytes`);

                window.SpedParser.processarArquivo(arquivo, tipo)
                    .then(dados => {
                        // Validar dados retornados
                        if (!dados || typeof dados !== 'object') {
                            adicionarLog(`Arquivo ${arquivo.name} não retornou dados válidos.`, 'error');
                            reject(new Error('Dados retornados inválidos'));
                            return;
                        }

                        // Verificação de registros específicos de impostos conforme tabela de mapeamento
                        verificarRegistrosImpostos(dados, tipo);

                        // Validar consistência dos dados usando DataManager
                        if (window.DataManager && typeof window.DataManager.validarConsistenciaDados === 'function') {
                            const validacao = window.DataManager.validarConsistenciaDados(dados, tipo);

                            if (validacao.inconsistencias.length > 0) {
                                validacao.inconsistencias.forEach(inconsistencia => {
                                    adicionarLog(`Atenção: ${inconsistencia.mensagem} em ${arquivo.name}`, 'warning');
                                    console.warn(`IMPORTACAO-CONTROLLER: Inconsistência detectada: ${inconsistencia.mensagem}`);
                                });
                            }

                            dados.validacao = validacao;
                        }

                        // Adicionar metadados ao resultado
                        dados.metadados = {
                            ...dados.metadados,
                            nomeArquivo: arquivo.name,
                            tipoArquivo: tipo,
                            tamanhoBytes: arquivo.size,
                            dataProcessamento: new Date().toISOString()
                        };

                        // Log detalhado dos dados encontrados
                        logDadosExtraidos(dados, tipo);

                        adicionarLog(`Arquivo ${arquivo.name} processado com sucesso.`, 'success');
                        resolve(dados);
                    })
                    .catch(erro => {
                        adicionarLog(`Erro ao processar ${arquivo.name}: ${erro.message}`, 'error');
                        console.error('IMPORTACAO-CONTROLLER: Erro no processamento:', erro);

                        // Fornecer mais contexto sobre o erro
                        const erroDetalhado = new Error(`Falha no processamento de ${arquivo.name}: ${erro.message}`);
                        erroDetalhado.arquivoOriginal = arquivo.name;
                        erroDetalhado.tipoArquivo = tipo;
                        erroDetalhado.erroOriginal = erro;

                        reject(erroDetalhado);
                    });
            } catch (erro) {
                adicionarLog(`Erro ao iniciar processamento de ${arquivo.name}: ${erro.message}`, 'error');
                console.error('IMPORTACAO-CONTROLLER: Exceção ao iniciar processamento:', erro);
                reject(erro);
            }
        });
    }
    
    /**
     * Verifica se os registros específicos de impostos estão presentes conforme novo layout
     * Foca nos registros essenciais para extração de dados tributários
     */
    function verificarRegistrosImpostos(dados, tipo) {
        console.log(`IMPORTACAO-CONTROLLER: Verificando registros de impostos para tipo ${tipo}`);

        if (tipo === 'contribuicoes') {
            // Verificar registros principais PIS/COFINS
            const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
            const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];

            // Log dos registros encontrados
            if (registrosM210.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Encontrados ${registrosM210.length} registros M210 (PIS)`);
                registrosM210.forEach((reg, index) => {
                    console.log(`IMPORTACAO-CONTROLLER: M210 #${index+1} - Contrib.Período: ${reg.valorContribPeriodo || 'N/A'}, Contrib.Apurada: ${reg.valorContribApurada || 'N/A'}`);
                });
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Nenhum registro M210 (PIS) encontrado');
            }

            if (registrosM610.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Encontrados ${registrosM610.length} registros M610 (COFINS)`);
                registrosM610.forEach((reg, index) => {
                    console.log(`IMPORTACAO-CONTROLLER: M610 #${index+1} - Contrib.Período: ${reg.valorContribPeriodo || 'N/A'}, Contrib.Apurada: ${reg.valorContribApurada || 'N/A'}`);
                });
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Nenhum registro M610 (COFINS) encontrado');
            }

            // Verificar registros de detalhamento de ajustes (M215/M615)
            const registrosM215 = dados.ajustes?.pis?.filter(reg => reg.registro === 'M215') || [];
            const registrosM615 = dados.ajustes?.cofins?.filter(reg => reg.registro === 'M615') || [];

            if (registrosM215.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Encontrados ${registrosM215.length} registros M215 (ajustes PIS)`);
            }

            if (registrosM615.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Encontrados ${registrosM615.length} registros M615 (ajustes COFINS)`);
            }
        } 
        else if (tipo === 'fiscal') {
            // Verificar ICMS (E110) e IPI (E200)
            const registrosE110 = dados.debitos?.icms?.filter(reg => reg.registro === 'E110') || [];
            const registrosE200 = dados.debitos?.ipi?.filter(reg => reg.registro === 'E200') || [];

            if (registrosE110.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Encontrados ${registrosE110.length} registros E110 (ICMS)`);
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Nenhum registro E110 (ICMS) encontrado');
            }

            if (registrosE200.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Encontrados ${registrosE200.length} registros E200 (IPI)`);
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Nenhum registro E200 (IPI) encontrado');
            }
        }
    }
    
    /**
     * Adiciona logs detalhados sobre os dados extraídos
     */
    function logDadosExtraidos(dados, tipo) {
        const resumo = {
            tipo: tipo,
            empresa: dados.empresa?.nome || 'N/A',
            documentos: dados.documentos?.length || 0,
            itens: dados.itens?.length || 0,
            creditos: Object.keys(dados.creditos || {}).length,
            debitos: Object.keys(dados.debitos || {}).length,
            impostos: Object.keys(dados.impostos || {}).length
        };

        // Log resumido na interface
        adicionarLog(`${tipo.toUpperCase()}: ${resumo.documentos} docs, ${resumo.creditos} tipos de crédito, ${resumo.debitos} tipos de débito`, 'info');

        // Log detalhado no console
        console.log(`IMPORTACAO-CONTROLLER: Resumo ${tipo}:`, resumo);

        // Logs específicos por tipo
        switch(tipo) {
            case 'fiscal':
                // Log simplificado para ICMS conforme tabela de mapeamento (E110)
                const registrosE110 = dados.debitos?.icms?.filter(reg => reg.registro === 'E110') || [];
                if (registrosE110.length > 0) {
                    const icmsDebitos = registrosE110[0].valorTotalDebitos || 0;
                    const icmsCreditos = registrosE110[0].valorTotalCreditos || 0;
                    adicionarLog(`ICMS: Débitos R$ ${icmsDebitos.toFixed(2)}, Créditos R$ ${icmsCreditos.toFixed(2)}`, 'info');
                }

                // Log simplificado para IPI conforme tabela de mapeamento (E200)
                const registrosE200 = dados.debitos?.ipi?.filter(reg => reg.registro === 'E200') || [];
                if (registrosE200.length > 0) {
                    const ipiDebitos = registrosE200[0].valorTotalDebitos || 0;
                    const ipiCreditos = registrosE200[0].valorTotalCreditos || 0;
                    adicionarLog(`IPI: Débitos R$ ${ipiDebitos.toFixed(2)}, Créditos R$ ${ipiCreditos.toFixed(2)}`, 'info');
                }
                break;

            case 'contribuicoes':
                // Log simplificado para PIS conforme tabela de mapeamento (M200)
                const registrosM200 = dados.debitos?.pis?.filter(reg => reg.registro === 'M200') || [];
                if (registrosM200.length > 0) {
                    const pisDebitos = registrosM200[0].valorTotalDebitos || 0;
                    const pisCreditos = registrosM200[0].valorTotalCreditos || 0;
                    adicionarLog(`PIS: Débitos R$ ${pisDebitos.toFixed(2)}, Créditos R$ ${pisCreditos.toFixed(2)}`, 'info');
                }

                // Log para ajustes PIS (M210)
                const registrosM210 = dados.ajustes?.pis?.filter(reg => reg.registro === 'M210') || [];
                if (registrosM210.length > 0) {
                    const pisAjDebitos = registrosM210[0].valorTotalAjDebitos || 0;
                    const pisAjCreditos = registrosM210[0].valorTotalAjCreditos || 0;
                    adicionarLog(`Ajustes PIS: Outros Débitos R$ ${pisAjDebitos.toFixed(2)}, Outros Créditos R$ ${pisAjCreditos.toFixed(2)}`, 'info');
                }

                // Log simplificado para COFINS conforme tabela de mapeamento (M600)
                const registrosM600 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M600') || [];
                if (registrosM600.length > 0) {
                    const cofinsDebitos = registrosM600[0].valorTotalDebitos || 0;
                    const cofinsCreditos = registrosM600[0].valorTotalCreditos || 0;
                    adicionarLog(`COFINS: Débitos R$ ${cofinsDebitos.toFixed(2)}, Créditos R$ ${cofinsCreditos.toFixed(2)}`, 'info');
                }

                // Log para ajustes COFINS (M610)
                const registrosM610 = dados.ajustes?.cofins?.filter(reg => reg.registro === 'M610') || [];
                if (registrosM610.length > 0) {
                    const cofinsAjDebitos = registrosM610[0].valorTotalAjDebitos || 0;
                    const cofinsAjCreditos = registrosM610[0].valorTotalAjCreditos || 0;
                    adicionarLog(`Ajustes COFINS: Outros Débitos R$ ${cofinsAjDebitos.toFixed(2)}, Outros Créditos R$ ${cofinsAjCreditos.toFixed(2)}`, 'info');
                }
                break;

            case 'ecf':
                if (dados.dre?.receita_liquida?.valor) {
                    adicionarLog(`Receita líquida: R$ ${dados.dre.receita_liquida.valor.toFixed(2)}`, 'info');
                }
                if (dados.incentivosFiscais?.length > 0) {
                    const valorIncentivos = dados.incentivosFiscais.reduce((sum, i) => sum + (i.valorIncentivo || 0), 0);
                    adicionarLog(`Incentivos fiscais: ${dados.incentivosFiscais.length} registros, valor R$ ${valorIncentivos.toFixed(2)}`, 'info');
                }
                break;

            case 'ecd':
                if (dados.balancoPatrimonial?.length > 0) {
                    adicionarLog(`Balanço: ${dados.balancoPatrimonial.length} contas`, 'info');
                }
                if (dados.demonstracaoResultado?.length > 0) {
                    adicionarLog(`DRE: ${dados.demonstracaoResultado.length} contas`, 'info');
                }
                break;
        }
    }
    
    /**
     * Combina os resultados de múltiplos arquivos SPED
     */
    function combinarResultados(resultados) {
        console.log('IMPORTACAO-CONTROLLER: Combinando resultados de', resultados.length, 'arquivos');

        // Estrutura combinada expandida
        const combinado = {
            empresa: {},
            documentos: [],
            itens: [],
            itensAnaliticos: [],
            impostos: {},
            creditos: {},
            debitos: {},
            regimes: {},
            ajustes: {},
            receitasNaoTributadas: {},
            balancoPatrimonial: [],
            demonstracaoResultado: [],
            lancamentosContabeis: [],
            partidasLancamento: [],
            calculoImposto: {},
            incentivosFiscais: [],
            participantes: [],
            inventario: [],
            discriminacaoReceita: [],
            totalizacao: {},
            detalhamento: {},
            validacao: {
                inconsistencias: [],
                confiabilidade: 'alta'
            },
            metadados: {
                arquivosProcessados: [],
                combinadoEm: new Date().toISOString()
            }
        };

        // Combinar resultados com validação
        resultados.forEach(resultado => {
            if (!resultado || typeof resultado !== 'object') return;

            // Registrar arquivo processado
            if (resultado.metadados) {
                combinado.metadados.arquivosProcessados.push(resultado.metadados);
            }

            // Dados da empresa - priorizar o mais completo
            if (resultado.empresa && Object.keys(resultado.empresa).length > 0) {
                const nomeAtual = resultado.empresa.nome || '';
                const nomeExistente = combinado.empresa.nome || '';

                if (nomeAtual && (!nomeExistente || Object.keys(combinado.empresa).length < Object.keys(resultado.empresa).length)) {
                    combinado.empresa = { ...resultado.empresa };
                }
            }

            // Arrays simples - concatenar
            const arrayProps = [
                'documentos', 'itens', 'itensAnaliticos', 'balancoPatrimonial',
                'demonstracaoResultado', 'lancamentosContabeis', 'partidasLancamento',
                'incentivosFiscais', 'participantes', 'inventario', 'discriminacaoReceita'
            ];

            arrayProps.forEach(prop => {
                if (Array.isArray(resultado[prop])) {
                    combinado[prop] = combinado[prop].concat(resultado[prop]);
                }
            });

            // Objetos de arrays categorizados - mesclar por categoria
            // Garantir que registros específicos de impostos sejam preservados
            const objArrayProps = ['impostos', 'creditos', 'debitos', 'ajustes', 'receitasNaoTributadas', 'totalizacao', 'detalhamento'];

            objArrayProps.forEach(prop => {
                if (resultado[prop] && typeof resultado[prop] === 'object') {
                    Object.entries(resultado[prop]).forEach(([categoria, valores]) => {
                        if (!combinado[prop][categoria]) {
                            combinado[prop][categoria] = [];
                        }

                        // Preservar registros específicos de impostos (evitar duplicação)
                        if (prop === 'debitos' || prop === 'creditos' || prop === 'ajustes') {
                            // Verificar se são registros de impostos específicos (E110, E200, M200, M210, M600, M610)
                            if (Array.isArray(valores)) {
                                valores.forEach(valor => {
                                    // Verificar registros específicos pelos campos mapeados
                                    if (valor.registro === 'E110' || valor.registro === 'E200' || 
                                        valor.registro === 'M200' || valor.registro === 'M210' || 
                                        valor.registro === 'M600' || valor.registro === 'M610') {

                                        // Verificar se já existe esse registro específico
                                        const registroJaExiste = combinado[prop][categoria].some(
                                            item => item.registro === valor.registro
                                        );

                                        if (!registroJaExiste) {
                                            combinado[prop][categoria].push(valor);
                                        }
                                    } else {
                                        // Para outros registros, apenas adiciona
                                        combinado[prop][categoria].push(valor);
                                    }
                                });
                            }
                        } else if (Array.isArray(valores)) {
                            // Para outros tipos de dados, apenas concatena
                            combinado[prop][categoria] = combinado[prop][categoria].concat(valores);
                        }
                    });
                }
            });

            // Objetos simples - mesclar com preferência para dados mais detalhados
            const objProps = ['regimes', 'calculoImposto'];

            objProps.forEach(prop => {
                if (resultado[prop] && typeof resultado[prop] === 'object') {
                    if (!combinado[prop]) combinado[prop] = {};

                    Object.entries(resultado[prop]).forEach(([chave, valor]) => {
                        if (!combinado[prop][chave] || 
                            (typeof valor === 'object' && 
                             Object.keys(valor).length > Object.keys(combinado[prop][chave] || {}).length)) {
                            combinado[prop][chave] = { ...valor };
                        }
                    });
                }
            });

            // Combinar resultados de validação
            if (resultado.validacao && resultado.validacao.inconsistencias) {
                combinado.validacao.inconsistencias = combinado.validacao.inconsistencias.concat(
                    resultado.validacao.inconsistencias
                );

                if (resultado.validacao.confiabilidade === 'baixa' || 
                    (resultado.validacao.confiabilidade === 'média' && combinado.validacao.confiabilidade === 'alta')) {
                    combinado.validacao.confiabilidade = resultado.validacao.confiabilidade;
                }
            }
        });

        // Processa relações cruzadas e realiza validação cruzada
        processarRelacoesEntreDados(combinado);
        validarConsistenciaEntreFontes(combinado);

        // Debug do balanço patrimonial
        if (window.location.search.includes('debug=true')) {
            diagnosticarBalancoPatrimonial(combinado);
        }

        console.log('IMPORTACAO-CONTROLLER: Resultados combinados:', {
            empresa: !!combinado.empresa.nome,
            documentos: combinado.documentos.length,
            creditos: Object.keys(combinado.creditos).length,
            debitos: Object.keys(combinado.debitos).length,
            confiabilidade: combinado.validacao.confiabilidade
        });

        return combinado;
    }
    
    /**
     * Processa relações entre diferentes tipos de dados no resultado combinado
     * @param {Object} combinado - Objeto com dados combinados
     * @returns {Object} O mesmo objeto com relações estabelecidas
     */
    function processarRelacoesEntreDados(combinado) {
        console.log('IMPORTACAO-CONTROLLER: Processando relações entre dados combinados');

        try {
            // Relacionar participantes com documentos
            if (combinado.participantes.length > 0 && combinado.documentos.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Relacionando ${combinado.participantes.length} participantes com ${combinado.documentos.length} documentos`);

                // Criar mapa de participantes por código para acesso rápido
                const participantesPorCodigo = {};
                combinado.participantes.forEach(participante => {
                    if (participante.codigo) {
                        participantesPorCodigo[participante.codigo] = participante;
                    }
                });

                // Associar participantes aos documentos
                let documentosRelacionados = 0;
                combinado.documentos.forEach(doc => {
                    if (doc.codPart && participantesPorCodigo[doc.codPart]) {
                        doc.participante = participantesPorCodigo[doc.codPart];
                        documentosRelacionados++;
                    }
                });

                console.log(`IMPORTACAO-CONTROLLER: ${documentosRelacionados} documentos relacionados com participantes`);
            }

            // Relacionar itens com documentos
            if (combinado.itens.length > 0 && combinado.documentos.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Relacionando ${combinado.itens.length} itens com documentos`);

                // Agrupar itens por documento
                const itensPorDocumento = {};
                combinado.itens.forEach(item => {
                    if (item.numDoc) {
                        if (!itensPorDocumento[item.numDoc]) {
                            itensPorDocumento[item.numDoc] = [];
                        }
                        itensPorDocumento[item.numDoc].push(item);
                    }
                });

                // Associar itens aos documentos
                let documentosComItens = 0;
                combinado.documentos.forEach(doc => {
                    if (doc.numero && itensPorDocumento[doc.numero]) {
                        doc.itens = itensPorDocumento[doc.numero];
                        documentosComItens++;
                    }
                });

                console.log(`IMPORTACAO-CONTROLLER: ${documentosComItens} documentos associados com seus itens`);
            }

            // Relacionar registros analíticos com seus respectivos totalizadores
            if (combinado.itensAnaliticos.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Processando ${combinado.itensAnaliticos.length} itens analíticos`);

                // Agrupar itens analíticos por tipo de imposto
                const analiticosPorImposto = {};
                combinado.itensAnaliticos.forEach(item => {
                    const categoria = item.categoria || 'outros';
                    if (!analiticosPorImposto[categoria]) {
                        analiticosPorImposto[categoria] = [];
                    }
                    analiticosPorImposto[categoria].push(item);
                });

                // Adicionar informação resumida ao objeto combinado
                combinado.resumoAnalitico = analiticosPorImposto;
                console.log(`IMPORTACAO-CONTROLLER: Itens analíticos agrupados em ${Object.keys(analiticosPorImposto).length} categorias`);
            }

            // Processar dados do balanço patrimonial, se disponível
            if (combinado.balancoPatrimonial.length > 0) {
                console.log(`IMPORTACAO-CONTROLLER: Processando ${combinado.balancoPatrimonial.length} contas do balanço patrimonial`);

                // Classificar contas por grupo (Ativo, Passivo, etc.)
                const contasPorGrupo = {};
                combinado.balancoPatrimonial.forEach(conta => {
                    let grupo = 'Outros';

                    // Tentar determinar o grupo pela estrutura do código da conta
                    const codConta = conta.codigoConta || conta.codigo || conta.numeroConta || '';
                    if (codConta.startsWith('1')) {
                        grupo = 'Ativo';
                    } else if (codConta.startsWith('2')) {
                        grupo = 'Passivo';
                    } else if (codConta.startsWith('3')) {
                        grupo = 'Patrimônio Líquido';
                    }

                    if (!contasPorGrupo[grupo]) {
                        contasPorGrupo[grupo] = [];
                    }
                    contasPorGrupo[grupo].push(conta);
                });

                // Adicionar classificação ao objeto combinado
                combinado.classificacaoContabil = contasPorGrupo;
                console.log(`IMPORTACAO-CONTROLLER: Contas classificadas em ${Object.keys(contasPorGrupo).length} grupos contábeis`);
            }

            // Processar dados fiscais para obtenção de indicadores
            if (combinado.debitos || combinado.creditos) {
                console.log('IMPORTACAO-CONTROLLER: Processando dados fiscais para indicadores');

                // Estrutura para armazenar os indicadores fiscais
                const indicadoresFiscais = {
                    relacaoCreditoDebito: {},
                    aliquotasEfetivas: {}
                };

                // Calcular relação crédito/débito para cada tipo de imposto
                const impostos = ['pis', 'cofins', 'icms', 'ipi'];

                impostos.forEach(imposto => {
                    const debitos = combinado.debitos && combinado.debitos[imposto] ? 
                        combinado.debitos[imposto].reduce((sum, d) => sum + (d.valorTotalDebitos || d.valorTotalContribuicao || 0), 0) : 0;

                    const creditos = combinado.creditos && combinado.creditos[imposto] ? 
                        combinado.creditos[imposto].reduce((sum, c) => sum + (c.valorCredito || 0), 0) : 0;

                    if (debitos > 0) {
                        indicadoresFiscais.relacaoCreditoDebito[imposto] = creditos / debitos;
                        console.log(`IMPORTACAO-CONTROLLER: Relação crédito/débito ${imposto.toUpperCase()}: ${(indicadoresFiscais.relacaoCreditoDebito[imposto] * 100).toFixed(2)}%`);
                    }
                });

                // Adicionar indicadores ao objeto combinado
                combinado.indicadoresFiscais = indicadoresFiscais;
            }

            return combinado;
        } catch (erro) {
            console.error('IMPORTACAO-CONTROLLER: Erro ao processar relações entre dados:', erro);
            return combinado; // Retorna o objeto original em caso de erro
        }
    }
    
    function validarConsistenciaEntreFontes(combinado) {
        console.log('IMPORTACAO-CONTROLLER: Validando consistência entre fontes de dados');

        // Validar faturamento entre SPED Fiscal e ECF
        if (combinado.fiscal?.totalizadores?.valorTotalSaidas && 
            combinado.ecf?.dre?.receita_liquida?.valor) {

            const faturamentoFiscal = combinado.fiscal.totalizadores.valorTotalSaidas;
            const faturamentoECF = combinado.ecf.dre.receita_liquida.valor;
            const divergencia = Math.abs(faturamentoFiscal - faturamentoECF) / faturamentoECF;

            if (divergencia > 0.05) { // Divergência maior que 5%
                combinado.validacao.inconsistencias.push({
                    tipo: 'faturamento_divergente',
                    mensagem: `Divergência no faturamento entre SPED Fiscal (${formatarMoeda(faturamentoFiscal)}) e ECF (${formatarMoeda(faturamentoECF)})`,
                    fiscal: faturamentoFiscal,
                    ecf: faturamentoECF,
                    divergencia: divergencia
                });

                if (combinado.validacao.confiabilidade === 'alta') {
                    combinado.validacao.confiabilidade = 'média';
                }

                console.warn(`IMPORTACAO-CONTROLLER: Divergência de faturamento detectada: ${(divergencia * 100).toFixed(2)}%`);
            }
        }

        // Validar PIS/COFINS entre SPED Fiscal e Contribuições
        if (combinado.contribuicoes?.debitos?.pis && combinado.fiscal?.documentos) {
            const pisFiscal = calcularTotalPISFiscal(combinado.fiscal.documentos);
            const pisContribuicoes = calcularTotalPISContribuicoes(combinado.contribuicoes.debitos.pis);

            if (pisFiscal > 0 && pisContribuicoes > 0) {
                const divergencia = Math.abs(pisFiscal - pisContribuicoes) / pisContribuicoes;

                if (divergencia > 0.10) { // Divergência maior que 10%
                    combinado.validacao.inconsistencias.push({
                        tipo: 'pis_divergente',
                        mensagem: `Divergência no PIS entre SPED Fiscal (${formatarMoeda(pisFiscal)}) e Contribuições (${formatarMoeda(pisContribuicoes)})`,
                        fiscal: pisFiscal,
                        contribuicoes: pisContribuicoes,
                        divergencia: divergencia
                    });

                    if (combinado.validacao.confiabilidade === 'alta') {
                        combinado.validacao.confiabilidade = 'média';
                    } else if (combinado.validacao.confiabilidade === 'média') {
                        combinado.validacao.confiabilidade = 'baixa';
                    }

                    console.warn(`IMPORTACAO-CONTROLLER: Divergência de PIS detectada: ${(divergencia * 100).toFixed(2)}%`);
                }
            }
        }

        // Validar regime tributário entre SPED Fiscal e Contribuições
        if (combinado.regimes.pis_cofins?.codigoIncidencia && 
            combinado.empresa?.regime) {

            const regimePisCofins = combinado.regimes.pis_cofins.codigoIncidencia;
            const regimeEmpresa = combinado.empresa.regime.toLowerCase();

            // Verificar consistência entre regime tributário e regime PIS/COFINS
            let inconsistencia = false;

            if (regimePisCofins === '1' && regimeEmpresa !== 'real') {
                inconsistencia = true;
            } else if (regimePisCofins === '2' && regimeEmpresa === 'real') {
                inconsistencia = true;
            }

            if (inconsistencia) {
                combinado.validacao.inconsistencias.push({
                    tipo: 'regime_divergente',
                    mensagem: `Inconsistência entre regime tributário (${regimeEmpresa}) e regime PIS/COFINS (${regimePisCofins})`,
                    regime: regimeEmpresa,
                    regimePisCofins: regimePisCofins
                });

                if (combinado.validacao.confiabilidade === 'alta') {
                    combinado.validacao.confiabilidade = 'média';
                }

                console.warn(`IMPORTACAO-CONTROLLER: Inconsistência entre regimes detectada`);
            }
        }

        // Log de resultado da validação
        console.log(`IMPORTACAO-CONTROLLER: Validação cruzada concluída - ${combinado.validacao.inconsistencias.length} inconsistências encontradas`);
        console.log(`IMPORTACAO-CONTROLLER: Confiabilidade dos dados: ${combinado.validacao.confiabilidade}`);

        return combinado.validacao;
    }

    function calcularTotalPISFiscal(documentos) {
        if (!Array.isArray(documentos)) return 0;

        return documentos.reduce((total, doc) => {
            // O valor do PIS pode estar em diferentes propriedades
            const valorPIS = doc.valorPIS || doc.valorPis || 
                            (doc.impostos && doc.impostos.pis ? doc.impostos.pis.valor : 0);
            return total + (valorPIS || 0);
        }, 0);
    }

    function calcularTotalPISContribuicoes(debitosPIS) {
        if (!Array.isArray(debitosPIS)) return 0;

        return debitosPIS.reduce((total, debito) => {
            // O valor pode estar em diferentes propriedades
            const valor = debito.valorTotalContribuicao || 
                         debito.valorContribuicaoAPagar || 
                         debito.valorPIS || 0;
            return total + (valor || 0);
        }, 0);
    }
    
    /**
     * Adapta dados extraídos do SPED para o formato esperado pelo DataManager
     * @param {Object} dadosExtraidos - Dados extraídos do SPED
     * @returns {Object} - Dados no formato esperado pelo DataManager
     */
    function adaptarParaDataManager(dadosExtraidos) {
        console.log('IMPORTACAO-CONTROLLER: Adaptando dados para formato DataManager');

        // Verificar se DataManager está disponível
        if (!window.DataManager) {
            console.warn('IMPORTACAO-CONTROLLER: DataManager não disponível para adaptação');
            return dadosExtraidos;
        }

        try {
            // Obter estrutura aninhada padrão do DataManager
            let estruturaAdaptada;
            if (typeof window.DataManager.obterEstruturaAninhadaPadrao === 'function') {
                estruturaAdaptada = window.DataManager.obterEstruturaAninhadaPadrao();
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Função obterEstruturaAninhadaPadrao não disponível');
                estruturaAdaptada = {
                    empresa: {},
                    cicloFinanceiro: {},
                    parametrosFiscais: {
                        creditos: {}
                    },
                    parametrosSimulacao: {},
                    parametrosFinanceiros: {},
                    ivaConfig: {},
                    estrategias: {},
                    cronogramaImplementacao: {}
                };
            }

            // Dados da empresa
            if (dadosExtraidos.empresa) {
                estruturaAdaptada.empresa = {
                    ...estruturaAdaptada.empresa,
                    nome: dadosExtraidos.empresa.nome || '',
                    faturamento: window.DataManager.normalizarValor(
                        dadosExtraidos.empresa.faturamentoMensal || 
                        dadosExtraidos.empresa.faturamento || 0, 
                        'monetario'
                    ),
                    margem: window.DataManager.extrairValorPercentual(dadosExtraidos.empresa.margem || 0.15),
                    tipoEmpresa: dadosExtraidos.empresa.tipoEmpresa || '',
                    regime: dadosExtraidos.empresa.regime || ''
                };
            }

            // Ciclo financeiro
            if (dadosExtraidos.cicloFinanceiro) {
                estruturaAdaptada.cicloFinanceiro = {
                    ...estruturaAdaptada.cicloFinanceiro,
                    pmr: window.DataManager.normalizarValor(
                        dadosExtraidos.cicloFinanceiro.pmr || 
                        dadosExtraidos.cicloFinanceiro.prazoRecebimento || 30, 
                        'inteiro'
                    ),
                    pmp: window.DataManager.normalizarValor(
                        dadosExtraidos.cicloFinanceiro.pmp || 
                        dadosExtraidos.cicloFinanceiro.prazoPagamento || 30, 
                        'inteiro'
                    ),
                    pme: window.DataManager.normalizarValor(
                        dadosExtraidos.cicloFinanceiro.pme || 
                        dadosExtraidos.cicloFinanceiro.prazoEstoque || 30, 
                        'inteiro'
                    ),
                    percVista: window.DataManager.extrairValorPercentual(
                        dadosExtraidos.cicloFinanceiro.percVista || 
                        dadosExtraidos.cicloFinanceiro.percentualVista || 0.3
                    ),
                    percPrazo: window.DataManager.extrairValorPercentual(
                        dadosExtraidos.cicloFinanceiro.percPrazo || 
                        dadosExtraidos.cicloFinanceiro.percentualPrazo || 0.7
                    )
                };
            }

            // Parâmetros fiscais - SIMPLIFICADO para acessar diretamente os registros mapeados
            estruturaAdaptada.parametrosFiscais = {
                ...estruturaAdaptada.parametrosFiscais,
                sistemaAtual: {
                    regimeTributario: dadosExtraidos.parametrosFiscais?.sistemaAtual?.regimeTributario || 'real',
                    regimePISCOFINS: dadosExtraidos.parametrosFiscais?.sistemaAtual?.regimePISCOFINS || 'não cumulativo'
                },
                aliquota: window.DataManager.extrairValorPercentual(dadosExtraidos.parametrosFiscais?.aliquota || 0.265),
                tipoOperacao: dadosExtraidos.parametrosFiscais?.tipoOperacao || '',
                regimePisCofins: dadosExtraidos.parametrosFiscais?.regimePisCofins || ''
            };

            // Créditos - Extrair diretamente dos registros mapeados
            estruturaAdaptada.parametrosFiscais.creditos = {
                pis: window.DataManager.normalizarValor(obterCreditoPIS(dadosExtraidos), 'monetario'),
                cofins: window.DataManager.normalizarValor(obterCreditoCOFINS(dadosExtraidos), 'monetario'),
                icms: window.DataManager.normalizarValor(obterCreditoICMS(dadosExtraidos), 'monetario'),
                ipi: window.DataManager.normalizarValor(obterCreditoIPI(dadosExtraidos), 'monetario'),
                cbs: 0,  // Valor padrão, será calculado depois
                ibs: 0   // Valor padrão, será calculado depois
            };

            // Débitos - Extrair diretamente dos registros mapeados
            if (!estruturaAdaptada.parametrosFiscais.debitos) {
                estruturaAdaptada.parametrosFiscais.debitos = {};
            }

            estruturaAdaptada.parametrosFiscais.debitos = {
                pis: window.DataManager.normalizarValor(obterDebitoPIS(dadosExtraidos), 'monetario'),
                cofins: window.DataManager.normalizarValor(obterDebitoCOFINS(dadosExtraidos), 'monetario'),
                icms: window.DataManager.normalizarValor(obterDebitoICMS(dadosExtraidos), 'monetario'),
                ipi: window.DataManager.normalizarValor(obterDebitoIPI(dadosExtraidos), 'monetario'),
                iss: window.DataManager.normalizarValor(0, 'monetario')  // Valor padrão
            };

            // Ajustes (outros créditos e débitos) - Extrair diretamente dos registros mapeados
            if (!estruturaAdaptada.parametrosFiscais.ajustes) {
                estruturaAdaptada.parametrosFiscais.ajustes = {};
            }

            estruturaAdaptada.parametrosFiscais.ajustes = {
                pisOutrosDebitos: window.DataManager.normalizarValor(obterAjusteDebitoPIS(dadosExtraidos), 'monetario'),
                pisOutrosCreditos: window.DataManager.normalizarValor(obterAjusteCreditoPIS(dadosExtraidos), 'monetario'),
                cofinsOutrosDebitos: window.DataManager.normalizarValor(obterAjusteDebitoCOFINS(dadosExtraidos), 'monetario'),
                cofinsOutrosCreditos: window.DataManager.normalizarValor(obterAjusteCreditoCOFINS(dadosExtraidos), 'monetario')
            };

            // IVA Config
            if (dadosExtraidos.ivaConfig) {
                estruturaAdaptada.ivaConfig = {
                    ...estruturaAdaptada.ivaConfig,
                    cbs: window.DataManager.extrairValorPercentual(dadosExtraidos.ivaConfig.cbs || 0.088),
                    ibs: window.DataManager.extrairValorPercentual(dadosExtraidos.ivaConfig.ibs || 0.177),
                    categoriaIva: dadosExtraidos.ivaConfig.categoriaIva || 'standard',
                    reducaoEspecial: window.DataManager.extrairValorPercentual(dadosExtraidos.ivaConfig.reducaoEspecial || 0)
                };
            }

            // Adicionar informações de validação
            if (dadosExtraidos.validacao) {
                estruturaAdaptada.validacao = {
                    inconsistencias: dadosExtraidos.validacao.inconsistencias || [],
                    confiabilidade: dadosExtraidos.validacao.confiabilidade || 'alta'
                };
            }

            // Metadados para rastreabilidade
            estruturaAdaptada.metadados = {
                ...(estruturaAdaptada.metadados || {}),
                ...(dadosExtraidos.metadados || {}),
                adaptadoEm: new Date().toISOString(),
                versaoAdaptador: '3.0'  // Versão simplificada
            };

            // Aplicar validação final usando método existente no DataManager
            const dadosValidados = window.DataManager.validarENormalizar(estruturaAdaptada);

            console.log('IMPORTACAO-CONTROLLER: Dados adaptados para formato DataManager:', dadosValidados);
            return dadosValidados;
        } catch (erro) {
            console.error('IMPORTACAO-CONTROLLER: Erro ao adaptar dados para DataManager:', erro);
            return dadosExtraidos; // Retorna dados originais em caso de erro
        }
    }
    
    /**
     * Integra dados de diferentes arquivos SPED para validação cruzada
     * @param {Object} dadosFiscal - Dados do SPED Fiscal
     * @param {Object} dadosContribuicoes - Dados do SPED Contribuições
     * @param {Object} dadosECF - Dados da ECF
     * @param {Object} dadosECD - Dados da ECD
     * @returns {Object} Dados integrados e validados
     */
    function integrarDadosSPED(dadosFiscal, dadosContribuicoes, dadosECF, dadosECD) {
        const dadosIntegrados = {
            empresa: {},
            parametrosFiscais: {},
            cicloFinanceiro: {},
            totalizadores: {}
        };

        // Integrar dados da empresa priorizando fonte mais confiável
        if (dadosFiscal?.empresa) {
            Object.assign(dadosIntegrados.empresa, dadosFiscal.empresa);
        }
        if (dadosECF?.empresa) {
            Object.assign(dadosIntegrados.empresa, dadosECF.empresa);
        }

        // Validar faturamento entre diferentes fontes
        const faturamentoFiscal = calcularFaturamentoMensal(dadosFiscal?.documentos || []);
        const faturamentoContabil = dadosECD?.dre?.receitaBruta / 12 || dadosECF?.dre?.receitaBruta / 12;

        if (faturamentoFiscal && faturamentoContabil) {
            const diferenca = Math.abs(faturamentoFiscal - faturamentoContabil) / faturamentoFiscal;
            if (diferenca <= 0.05) { // Diferença aceitável de 5%
                dadosIntegrados.empresa.faturamento = (faturamentoFiscal + faturamentoContabil) / 2;
            } else {
                dadosIntegrados.empresa.faturamento = faturamentoFiscal; // Priorizar fiscal
                console.warn(`Divergência no faturamento: Fiscal ${faturamentoFiscal}, Contábil ${faturamentoContabil}`);
            }
        }

        return dadosIntegrados;
    }

    /**
     * Calcula faturamento mensal baseado nos documentos fiscais
     * @param {Array} documentos - Array de documentos fiscais
     * @returns {number} Faturamento mensal médio
     */
    function calcularFaturamentoMensal(documentos) {
        if (!documentos || documentos.length === 0) return 0;

        const valorTotal = documentos.reduce((total, doc) => {
            return total + (parseFloat(doc.valorTotal) || 0);
        }, 0);

        // Assumindo que os documentos representam um período de 12 meses
        return valorTotal / 12;
    }

    /**
     * Função auxiliar para obter valor de crédito
     * @param {Object} dados - Dados extraídos
     * @param {string} tipo - Tipo de crédito (pis, cofins, icms, ipi)
     * @returns {number} - Valor do crédito
     */
    function obterValorCredito(dados, tipo) {
        // Verificar várias possíveis fontes para o valor do crédito
        if (dados.parametrosFiscais?.creditos && dados.parametrosFiscais.creditos[tipo] !== undefined) {
            return dados.parametrosFiscais.creditos[tipo];
        }

        if (dados.parametrosFiscais && dados.parametrosFiscais[`credito${tipo.toUpperCase()}`] !== undefined) {
            return dados.parametrosFiscais[`credito${tipo.toUpperCase()}`];
        }

        if (dados.creditos && dados.creditos[tipo] !== undefined) {
            // Pode ser um array de objetos de crédito
            if (Array.isArray(dados.creditos[tipo])) {
                return dados.creditos[tipo].reduce((total, credito) => {
                    return total + (credito.valorCredito || credito.valor || 0);
                }, 0);
            }
            return dados.creditos[tipo];
        }

        // Valor padrão
        return 0;
    }
    
    /**
     * Processa relações cruzadas entre dados
     */
    function processarRelacoesCruzadas(dados) {
        // Relacionar documentos com participantes
        if (dados.documentos.length > 0 && dados.participantes?.length > 0) {
            const participantesPorCodigo = {};
            dados.participantes.forEach(participante => {
                if (participante.codigo) {
                    participantesPorCodigo[participante.codigo] = participante;
                }
            });

            dados.documentos.forEach(doc => {
                if (doc.codPart && participantesPorCodigo[doc.codPart]) {
                    doc.participante = participantesPorCodigo[doc.codPart];
                }
            });
        }

        // Calcular valores agregados se não existirem
        calcularValoresAgregados(dados);
    }
    
    /**
     * Calcula valores agregados com validação robusta
     */
    function calcularValoresAgregados(dados) {
        // Calcular receita bruta com base nos documentos se não existir
        if (!dados.receitaBruta && dados.documentos.length > 0) {
            const documentosSaida = dados.documentos.filter(doc => 
                doc.indOper === '1' && doc.situacao === '00'
            );

            if (documentosSaida.length > 0) {
                const receitaPorMes = {};
                documentosSaida.forEach(doc => {
                    if (!doc.dataEmissao) return;

                    const dataEmissao = doc.dataEmissao.replace(/(\d{2})(\d{2})(\d{4})/, '$3-$2');
                    const valorDoc = doc.valorTotal || 0;

                    if (!receitaPorMes[dataEmissao]) {
                        receitaPorMes[dataEmissao] = 0;
                    }
                    receitaPorMes[dataEmissao] += valorDoc;
                });

                if (Object.keys(receitaPorMes).length > 0) {
                    const totalReceita = Object.values(receitaPorMes).reduce((sum, val) => sum + val, 0);
                    dados.receitaBruta = totalReceita * 12 / Object.keys(receitaPorMes).length;
                }
            }
        }

        // Calcular saldos contábeis se disponível - COM VALIDAÇÃO ROBUSTA
        if (dados.balancoPatrimonial?.length > 0) {
            try {
                // Função auxiliar para validar conta
                const validarConta = (conta) => {
                    return conta && 
                           typeof conta === 'object' && 
                           (conta.codigoConta || conta.codigo || conta.numeroConta);
                };

                // Função auxiliar para obter código da conta
                const obterCodigoConta = (conta) => {
                    return conta.codigoConta || conta.codigo || conta.numeroConta || '';
                };

                // Função auxiliar para obter descrição da conta
                const obterDescricaoConta = (conta) => {
                    return conta.descricaoConta || conta.descricao || conta.nome || '';
                };

                // Calcular saldo de clientes
                dados.saldoClientes = dados.balancoPatrimonial
                    .filter(conta => {
                        if (!validarConta(conta)) return false;

                        const codigo = obterCodigoConta(conta);
                        const descricao = obterDescricaoConta(conta).toLowerCase();
                        const natureza = conta.naturezaSaldo || conta.natureza || '';

                        const isCodigoClientes = codigo.startsWith('1.1.2') || 
                                               codigo.startsWith('112') || 
                                               codigo.includes('cliente');
                        const isDescricaoClientes = descricao.includes('client') || 
                                                  descricao.includes('duplicata') || 
                                                  descricao.includes('receb');
                        const isNaturezaDebito = natureza === 'D' || natureza === 'Débito';

                        return (isCodigoClientes || isDescricaoClientes) && isNaturezaDebito;
                    })
                    .reduce((sum, conta) => {
                        const saldo = conta.saldoFinal || conta.saldo || conta.valor || 0;
                        return sum + (typeof saldo === 'number' ? saldo : 0);
                    }, 0);

                // Calcular saldo de estoques
                dados.saldoEstoques = dados.balancoPatrimonial
                    .filter(conta => {
                        if (!validarConta(conta)) return false;

                        const codigo = obterCodigoConta(conta);
                        const descricao = obterDescricaoConta(conta).toLowerCase();
                        const natureza = conta.naturezaSaldo || conta.natureza || '';

                        const isCodigoEstoque = codigo.startsWith('1.1.3') || 
                                              codigo.startsWith('113') || 
                                              codigo.includes('estoq');
                        const isDescricaoEstoque = descricao.includes('estoq') || 
                                                 descricao.includes('mercador') || 
                                                 descricao.includes('produto');
                        const isNaturezaDebito = natureza === 'D' || natureza === 'Débito';

                        return (isCodigoEstoque || isDescricaoEstoque) && isNaturezaDebito;
                    })
                    .reduce((sum, conta) => {
                        const saldo = conta.saldoFinal || conta.saldo || conta.valor || 0;
                        return sum + (typeof saldo === 'number' ? saldo : 0);
                    }, 0);

                // Calcular saldo de fornecedores
                dados.saldoFornecedores = dados.balancoPatrimonial
                    .filter(conta => {
                        if (!validarConta(conta)) return false;

                        const codigo = obterCodigoConta(conta);
                        const descricao = obterDescricaoConta(conta).toLowerCase();
                        const natureza = conta.naturezaSaldo || conta.natureza || '';

                        const isCodigoFornecedor = codigo.startsWith('2.1.1') || 
                                                 codigo.startsWith('211') || 
                                                 codigo.includes('fornece');
                        const isDescricaoFornecedor = descricao.includes('fornece') || 
                                                    descricao.includes('duplicata') || 
                                                    descricao.includes('pagar');
                        const isNaturezaCredito = natureza === 'C' || natureza === 'Crédito';

                        return (isCodigoFornecedor || isDescricaoFornecedor) && isNaturezaCredito;
                    })
                    .reduce((sum, conta) => {
                        const saldo = conta.saldoFinal || conta.saldo || conta.valor || 0;
                        return sum + (typeof saldo === 'number' ? saldo : 0);
                    }, 0);

                console.log('IMPORTACAO-CONTROLLER: Saldos calculados:', {
                    saldoClientes: dados.saldoClientes,
                    saldoEstoques: dados.saldoEstoques,
                    saldoFornecedores: dados.saldoFornecedores
                });

            } catch (erro) {
                console.warn('IMPORTACAO-CONTROLLER: Erro ao calcular saldos contábeis:', erro.message);
                // Definir valores padrão em caso de erro
                dados.saldoClientes = 0;
                dados.saldoEstoques = 0;
                dados.saldoFornecedores = 0;

                // Log detalhado para debug
                console.warn('IMPORTACAO-CONTROLLER: Estrutura do balanço patrimonial:', 
                    dados.balancoPatrimonial.slice(0, 3));
            }
        } else {
            // Definir valores padrão se não há dados do balanço
            dados.saldoClientes = 0;
            dados.saldoEstoques = 0;
            dados.saldoFornecedores = 0;
        }
    }
    
    /**
     * Função para diagnosticar estrutura do balanço patrimonial
     */
    function diagnosticarBalancoPatrimonial(dados) {
        if (!dados.balancoPatrimonial?.length) {
            console.log('IMPORTACAO-CONTROLLER: Balanço patrimonial não encontrado');
            return;
        }

        console.log('IMPORTACAO-CONTROLLER: Diagnóstico do balanço patrimonial:');
        console.log('Total de contas:', dados.balancoPatrimonial.length);

        // Analisar primeiras 5 contas para entender a estrutura
        const amostra = dados.balancoPatrimonial.slice(0, 5);

        amostra.forEach((conta, index) => {
            console.log(`Conta ${index + 1}:`, {
                propriedades: Object.keys(conta),
                codigoConta: conta.codigoConta,
                codigo: conta.codigo,
                numeroConta: conta.numeroConta,
                descricaoConta: conta.descricaoConta,
                descricao: conta.descricao,
                nome: conta.nome,
                naturezaSaldo: conta.naturezaSaldo,
                natureza: conta.natureza,
                saldoFinal: conta.saldoFinal,
                saldo: conta.saldo,
                valor: conta.valor
            });
        });
    }
    
    /**
     * Preenche os campos do simulador com os dados extraídos
     */
    function preencherCamposSimulador(dados) {
        adicionarLog('Preenchendo campos do simulador...', 'info');

        try {
            // Validar estrutura dos dados
            if (!dados || typeof dados !== 'object') {
                throw new Error('Dados inválidos ou mal-formados');
            }

            // Log para debug
            console.log('IMPORTACAO-CONTROLLER: Dados recebidos para preenchimento:', {
                empresa: dados.empresa ? Object.keys(dados.empresa) : 'Não disponível',
                parametrosFiscais: dados.parametrosFiscais ? Object.keys(dados.parametrosFiscais) : 'Não disponível',
                cicloFinanceiro: dados.cicloFinanceiro ? Object.keys(dados.cicloFinanceiro) : 'Não disponível',
                ivaConfig: dados.ivaConfig ? Object.keys(dados.ivaConfig) : 'Não disponível',
                validacao: dados.validacao ? dados.validacao.confiabilidade : 'Não disponível'
            });

            // Normalizar dados usando o DataManager antes de preencher
            let dadosNormalizados;

            if (window.DataManager && typeof window.DataManager.validarENormalizar === 'function') {
                console.log('IMPORTACAO-CONTROLLER: Normalizando dados via DataManager');
                dadosNormalizados = window.DataManager.validarENormalizar(dados);
                console.log('IMPORTACAO-CONTROLLER: Dados normalizados:', dadosNormalizados);
            } else {
                console.warn('IMPORTACAO-CONTROLLER: DataManager não disponível para normalização');
                dadosNormalizados = dados;
            }

            // Exibir avisos sobre inconsistências detectadas
            if (dadosNormalizados.validacao && dadosNormalizados.validacao.inconsistencias.length > 0) {
                adicionarLog(`Atenção: Foram detectadas ${dadosNormalizados.validacao.inconsistencias.length} inconsistências nos dados importados.`, 'warning');

                // Exibir até 3 inconsistências mais críticas
                dadosNormalizados.validacao.inconsistencias.slice(0, 3).forEach(inconsistencia => {
                    adicionarLog(`Inconsistência: ${inconsistencia.mensagem}`, 'warning');
                });

                adicionarLog(`Confiabilidade dos dados: ${dadosNormalizados.validacao.confiabilidade.toUpperCase()}`, 
                             dadosNormalizados.validacao.confiabilidade === 'alta' ? 'success' : 
                             dadosNormalizados.validacao.confiabilidade === 'média' ? 'warning' : 'error');
            }

            // Preencher dados da empresa
            if (dadosNormalizados.empresa && elements.importEmpresa?.checked !== false) {
                // Verificar campos críticos antes de preencher
                if (!dadosNormalizados.empresa.nome || dadosNormalizados.empresa.nome.trim() === '') {
                    adicionarLog('ATENÇÃO: Nome da empresa não encontrado nos dados importados.', 'warning');
                    console.warn('IMPORTACAO-CONTROLLER: Nome da empresa vazio ou não encontrado');
                }

                if (!dadosNormalizados.empresa.faturamento || dadosNormalizados.empresa.faturamento <= 0) {
                    adicionarLog('ATENÇÃO: Faturamento da empresa não encontrado ou zero.', 'warning');
                    console.warn('IMPORTACAO-CONTROLLER: Faturamento vazio ou não encontrado');
                }

                preencherDadosEmpresa(dadosNormalizados.empresa);
                adicionarLog('Dados da empresa preenchidos com sucesso.', 'success');
            } else {
                adicionarLog('Dados da empresa não importados (desativado ou não disponíveis).', 'info');
            }

            // Preencher parâmetros fiscais
            if (dadosNormalizados.parametrosFiscais && elements.importImpostos?.checked !== false) {
                preencherParametrosFiscais(dadosNormalizados.parametrosFiscais);
                adicionarLog('Parâmetros fiscais preenchidos com sucesso.', 'success');
            } else {
                adicionarLog('Parâmetros fiscais não importados (desativado ou não disponíveis).', 'info');
            }

            // Preencher ciclo financeiro
            if (dadosNormalizados.cicloFinanceiro && elements.importCiclo?.checked !== false) {
                preencherCicloFinanceiro(dadosNormalizados.cicloFinanceiro);
                adicionarLog('Dados do ciclo financeiro preenchidos com sucesso.', 'success');

                // Recalcular ciclo financeiro com os novos dados
                if (window.FormsManager && typeof window.FormsManager.calcularCicloFinanceiro === 'function') {
                    window.FormsManager.calcularCicloFinanceiro();
                    adicionarLog('Ciclo financeiro recalculado com sucesso.', 'success');
                }
            } else {
                adicionarLog('Ciclo financeiro não importado (desativado ou não disponível).', 'info');
            }

            // Preencher dados financeiros (NOVO)
            preencherDadosFinanceiros(dadosNormalizados.dadosFinanceiros, dadosNormalizados.empresa);
            adicionarLog('Dados financeiros preenchidos com sucesso.', 'success');
            
            // Configurar IVA Dual
            if (dadosNormalizados.ivaConfig) {
                preencherDadosIVADual(dadosNormalizados.ivaConfig);
                adicionarLog('Configurações do IVA Dual preenchidas com sucesso.', 'success');
            } else {
                adicionarLog('Configurações IVA Dual não disponíveis nos dados importados.', 'info');
            }

            // Rolar para a aba de simulação e sugerir verificação
            setTimeout(() => {
                const abaPrincipal = document.querySelector('.tab-button[data-tab="simulacao"]');
                if (abaPrincipal) {
                    abaPrincipal.click();
                    adicionarLog('Navegando para a aba de simulação.', 'info');
                } else {
                    adicionarLog('Aba de simulação não encontrada.', 'warning');
                }

                if (dadosNormalizados.validacao && dadosNormalizados.validacao.confiabilidade !== 'alta') {
                    adicionarLog('Recomendamos verificar os dados importados antes de prosseguir com a simulação.', 'warning');
                } else {
                    adicionarLog('Preparação concluída. Você pode clicar em "Simular" para ver os resultados.', 'info');
                }
            }, 1000);

        } catch (erro) {
            adicionarLog('Erro ao preencher campos do simulador: ' + erro.message, 'error');
            console.error('IMPORTACAO-CONTROLLER: Erro ao preencher campos:', erro, erro.stack);
        }
    }
    
    /**
     * Preenche os dados da empresa no formulário
     */
    function preencherDadosEmpresa(dadosEmpresa) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo dados da empresa:', dadosEmpresa);

        if (!dadosEmpresa || typeof dadosEmpresa !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Dados da empresa inválidos');
            return;
        }

        // Identificar fontes possíveis para o nome da empresa
        const possiveisFontes = {
            nome: dadosEmpresa.nome || '',
            nomeEmpresarial: dadosEmpresa.nomeEmpresarial || '',
            razaoSocial: dadosEmpresa.razaoSocial || ''
        };
        console.log('IMPORTACAO-CONTROLLER: Possíveis fontes do nome da empresa:', possiveisFontes);

        // Determinar o CNPJ e o nome real da empresa
        // Se o campo nome parece um CNPJ, tente usar outros campos para o nome real
        const cnpjPattern = /^\d{8,14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
        let cnpjReal = '';
        let nomeReal = '';

        if (dadosEmpresa.cnpj && dadosEmpresa.cnpj.trim() !== '') {
            cnpjReal = dadosEmpresa.cnpj;
        } else if (cnpjPattern.test(dadosEmpresa.nome)) {
            cnpjReal = dadosEmpresa.nome;
        }

        // Tentar encontrar o nome real da empresa
        if (dadosEmpresa.nomeEmpresarial && dadosEmpresa.nomeEmpresarial.trim() !== '' && !cnpjPattern.test(dadosEmpresa.nomeEmpresarial)) {
            nomeReal = dadosEmpresa.nomeEmpresarial;
        } else if (dadosEmpresa.razaoSocial && dadosEmpresa.razaoSocial.trim() !== '' && !cnpjPattern.test(dadosEmpresa.razaoSocial)) {
            nomeReal = dadosEmpresa.razaoSocial;
        } else if (dadosEmpresa.nome && dadosEmpresa.nome.trim() !== '' && !cnpjPattern.test(dadosEmpresa.nome)) {
            nomeReal = dadosEmpresa.nome;
        } else {
            // Se não encontrar um nome válido, use um placeholder
            nomeReal = "Empresa Importada";
        }

        // Nome da empresa - Verificação e log detalhados
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa) {
            if (nomeReal && nomeReal.trim() !== '') {
                campoEmpresa.value = nomeReal.trim();
                marcarCampoComoSped(campoEmpresa);
                console.log(`IMPORTACAO-CONTROLLER: Nome da empresa preenchido: "${nomeReal}"`);
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Nome da empresa não encontrado ou vazio');
                adicionarLog('Nome da empresa não encontrado nos dados importados.', 'warning');
            }
        } else {
            console.warn('IMPORTACAO-CONTROLLER: Campo de nome da empresa não encontrado no formulário');
        }

        // Faturamento mensal - Utilizar DataManager para conversão consistente
        const campoFaturamento = document.getElementById('faturamento');
        if (campoFaturamento) {
            if (dadosEmpresa.faturamento && dadosEmpresa.faturamento > 0) {
                // Usar DataManager para normalização e formatação
                if (window.DataManager) {
                    const faturamentoNormalizado = window.DataManager.normalizarValor(dadosEmpresa.faturamento, 'monetario');
                    const valorFormatado = window.DataManager.formatarMoeda(faturamentoNormalizado);

                    campoFaturamento.value = valorFormatado;

                    // Se o campo tem dataset.rawValue (para CurrencyFormatter)
                    if (campoFaturamento.dataset) {
                        campoFaturamento.dataset.rawValue = faturamentoNormalizado.toString();
                    }

                    marcarCampoComoSped(campoFaturamento);
                    campoFaturamento.dispatchEvent(new Event('input', { bubbles: true }));

                    console.log(`IMPORTACAO-CONTROLLER: Faturamento preenchido: ${faturamentoNormalizado} (${valorFormatado})`);
                    adicionarLog(`Faturamento mensal: ${valorFormatado}`, 'info');
                } else {
                    // Fallback para função local quando DataManager não está disponível
                    const faturamentoValidado = validarValorMonetario(dadosEmpresa.faturamento);
                    const valorFormatado = formatarMoeda(faturamentoValidado);

                    campoFaturamento.value = valorFormatado;
                    if (campoFaturamento.dataset) {
                        campoFaturamento.dataset.rawValue = faturamentoValidado.toString();
                    }

                    marcarCampoComoSped(campoFaturamento);
                    campoFaturamento.dispatchEvent(new Event('input', { bubbles: true }));

                    console.log(`IMPORTACAO-CONTROLLER: Faturamento preenchido (fallback): ${faturamentoValidado} (${valorFormatado})`);
                }
            } else {
                console.warn('IMPORTACAO-CONTROLLER: Faturamento não encontrado ou zero');
                adicionarLog('Faturamento não encontrado nos dados importados.', 'warning');
            }
        } else {
            console.warn('IMPORTACAO-CONTROLLER: Campo de faturamento não encontrado no formulário');
        }

        // Margem operacional - Normalização e validação melhoradas
        const campoMargem = document.getElementById('margem');
        if (campoMargem && dadosEmpresa.margem !== undefined) {
            // Usar DataManager para normalização, se disponível
            if (window.DataManager) {
                const margemNormalizada = window.DataManager.extrairValorPercentual(dadosEmpresa.margem) * 100;
                campoMargem.value = margemNormalizada.toFixed(2);
            } else {
                // Fallback para cálculo direto
                let margemNormalizada = dadosEmpresa.margem;
                if (margemNormalizada <= 1) {
                    margemNormalizada = margemNormalizada * 100;
                }

                // Garantir que a margem está entre 0 e 100
                margemNormalizada = Math.max(0, Math.min(100, margemNormalizada));
                campoMargem.value = margemNormalizada.toFixed(2);
            }

            marcarCampoComoSped(campoMargem);
            campoMargem.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Margem preenchida: ${campoMargem.value}%`);
        }

        // Tipo de empresa - Verificação e normalização de valores
        const campoTipoEmpresa = document.getElementById('tipo-empresa');
        if (campoTipoEmpresa && dadosEmpresa.tipoEmpresa) {
            // Normalizar tipo de empresa (garantir compatibilidade com os valores aceitos pelo select)
            const tiposValidos = ['comercio', 'industria', 'servicos'];
            const tipoNormalizado = dadosEmpresa.tipoEmpresa.toLowerCase();

            if (tiposValidos.includes(tipoNormalizado)) {
                campoTipoEmpresa.value = tipoNormalizado;
                marcarCampoComoSped(campoTipoEmpresa);
                campoTipoEmpresa.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`IMPORTACAO-CONTROLLER: Tipo de empresa preenchido: ${tipoNormalizado}`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: Tipo de empresa inválido: ${dadosEmpresa.tipoEmpresa}`);
                adicionarLog(`Tipo de empresa não reconhecido: ${dadosEmpresa.tipoEmpresa}`, 'warning');
            }
        }

        // Regime tributário - Verificação e normalização de valores
        const campoRegime = document.getElementById('regime');
        if (campoRegime && dadosEmpresa.regime) {
            // Normalizar regime tributário (garantir compatibilidade com os valores aceitos pelo select)
            const regimesValidos = ['simples', 'presumido', 'real'];
            const regimeNormalizado = dadosEmpresa.regime.toLowerCase();

            if (regimesValidos.includes(regimeNormalizado)) {
                campoRegime.value = regimeNormalizado;
                marcarCampoComoSped(campoRegime);
                campoRegime.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`IMPORTACAO-CONTROLLER: Regime tributário preenchido: ${regimeNormalizado}`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: Regime tributário inválido: ${dadosEmpresa.regime}`);
                adicionarLog(`Regime tributário não reconhecido: ${dadosEmpresa.regime}`, 'warning');
            }
        }
    }  
    
    /**
     * Função auxiliar para validar valores monetários
     * @param {number|string} valor - Valor a ser validado
     * @return {number} Valor numérico validado
     */
    function validarValorMonetario(valor) {
        // Caso 1: Valor indefinido ou nulo
        if (valor === undefined || valor === null) {
            return 0;
        }

        // Caso 2: Já é um número
        if (typeof valor === 'number') {
            // Verificar se é um número válido e dentro de limites razoáveis
            if (!isNaN(valor) && valor >= 0 && valor < 1000000000000) { // Até 1 trilhão
                return valor;
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: Valor numérico inválido ou fora dos limites: ${valor}`);
                return 0;
            }
        }

        // Caso 3: É uma string que precisa ser convertida
        if (typeof valor === 'string') {
            try {
                // Remover formatação monetária (R$, pontos, etc)
                const valorLimpo = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
                const valorNumerico = parseFloat(valorLimpo);

                // Validar resultado da conversão
                if (!isNaN(valorNumerico) && valorNumerico >= 0 && valorNumerico < 1000000000000) {
                    return valorNumerico;
                } else {
                    console.warn(`IMPORTACAO-CONTROLLER: Valor monetário string inválido ou fora dos limites: ${valor}`);
                    return 0;
                }
            } catch (erro) {
                console.error(`IMPORTACAO-CONTROLLER: Erro ao processar valor monetário: ${valor}`, erro);
                return 0;
            }
        }

        // Caso default: tipo desconhecido
        console.warn(`IMPORTACAO-CONTROLLER: Tipo de valor monetário não suportado: ${typeof valor}`);
        return 0;
    }
    
    /**
     * Funções para obter valores específicos de impostos diretamente dos registros mapeados
     */

    /**
     * Obtém o valor de débito de PIS seguindo hierarquia de prioridade do novo layout
     * Prioridade: VL_CONT_PER (M210-16) > VL_CONT_APUR (M210-11) > Cálculo manual
     */
    function obterDebitoPIS(dados) {
        // PRIORIDADE 1: Campo VL_CONT_PER (M210 - Campo 16) - Valor final do período
        const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
        if (registrosM210.length > 0) {
            // Verificar se existe valor final do período (campo 16)
            if (registrosM210[0].valorContribPeriodo !== undefined && registrosM210[0].valorContribPeriodo > 0) {
                console.log(`IMPORTACAO-CONTROLLER: PIS débito obtido de VL_CONT_PER: ${registrosM210[0].valorContribPeriodo}`);
                return registrosM210[0].valorContribPeriodo;
            }

            // PRIORIDADE 2: Campo VL_CONT_APUR (M210 - Campo 11) - Contribuição apurada
            if (registrosM210[0].valorContribApurada !== undefined && registrosM210[0].valorContribApurada > 0) {
                console.log(`IMPORTACAO-CONTROLLER: PIS débito obtido de VL_CONT_APUR: ${registrosM210[0].valorContribApurada}`);
                return registrosM210[0].valorContribApurada;
            }

            // PRIORIDADE 3: Cálculo manual usando base ajustada × alíquota
            if (registrosM210[0].valorBaseCalculoAjustada > 0 && registrosM210[0].aliqPis > 0) {
                const valorCalculado = registrosM210[0].valorBaseCalculoAjustada * (registrosM210[0].aliqPis / 100);
                console.log(`IMPORTACAO-CONTROLLER: PIS débito calculado: ${valorCalculado}`);
                return valorCalculado;
            }
        }

        // Fallback para estrutura processada anteriormente
        if (dados.parametrosFiscais?.debitos?.pis !== undefined) {
            return dados.parametrosFiscais.debitos.pis;
        }

        console.warn('IMPORTACAO-CONTROLLER: Valor de débito PIS não encontrado');
        return 0;
    }

    /**
     * Obtém o valor de crédito de PIS do registro M210 campo 6 (VL_TOT_CREDITOS)
     * ou de registros M105 consolidados
     */
    function obterCreditoPIS(dados) {
        // FONTE PRIMÁRIA: Registro M200 campo 6 (VL_TOT_CRED_DESC_PER)
        const registrosM200 = dados.debitos?.pis?.filter(reg => reg.registro === 'M200') || [];
        if (registrosM200.length > 0 && registrosM200[0].valorTotalCreditos !== undefined) {
            console.log(`IMPORTACAO-CONTROLLER: PIS crédito obtido de M200: ${registrosM200[0].valorTotalCreditos}`);
            return registrosM200[0].valorTotalCreditos;
        }

        // FONTE SECUNDÁRIA: Consolidação de registros M105 (detalhamento de créditos)
        const registrosM105 = dados.creditos?.pis?.filter(reg => reg.tipo === 'credito_detalhe') || [];
        if (registrosM105.length > 0) {
            const totalCreditos = registrosM105.reduce((total, reg) => {
                return total + (reg.valorCredito || reg.valorCreditoDisp || 0);
            }, 0);

            if (totalCreditos > 0) {
                console.log(`IMPORTACAO-CONTROLLER: PIS crédito calculado de M105: ${totalCreditos}`);
                return totalCreditos;
            }
        }

        // Fallback para estrutura processada anteriormente
        if (dados.parametrosFiscais?.creditos?.pis !== undefined) {
            return dados.parametrosFiscais.creditos.pis;
        }

        console.warn('IMPORTACAO-CONTROLLER: Valor de crédito PIS não encontrado');
        return 0;
    }
    

    /**
     * Obtém o valor de débito de COFINS seguindo hierarquia de prioridade do novo layout
     * Prioridade: VL_CONT_PER (M610-16) > VL_CONT_APUR (M610-11) > Cálculo manual
     */
    function obterDebitoCOFINS(dados) {
        // PRIORIDADE 1: Campo VL_CONT_PER (M610 - Campo 16) - Valor final do período
        const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];
        if (registrosM610.length > 0) {
            // Verificar se existe valor final do período (campo 16)
            if (registrosM610[0].valorContribPeriodo !== undefined && registrosM610[0].valorContribPeriodo > 0) {
                console.log(`IMPORTACAO-CONTROLLER: COFINS débito obtido de VL_CONT_PER: ${registrosM610[0].valorContribPeriodo}`);
                return registrosM610[0].valorContribPeriodo;
            }

            // PRIORIDADE 2: Campo VL_CONT_APUR (M610 - Campo 11) - Contribuição apurada
            if (registrosM610[0].valorContribApurada !== undefined && registrosM610[0].valorContribApurada > 0) {
                console.log(`IMPORTACAO-CONTROLLER: COFINS débito obtido de VL_CONT_APUR: ${registrosM610[0].valorContribApurada}`);
                return registrosM610[0].valorContribApurada;
            }

            // PRIORIDADE 3: Cálculo manual usando base ajustada × alíquota
            if (registrosM610[0].valorBaseCalculoAjustada > 0 && registrosM610[0].aliqCofins > 0) {
                const valorCalculado = registrosM610[0].valorBaseCalculoAjustada * (registrosM610[0].aliqCofins / 100);
                console.log(`IMPORTACAO-CONTROLLER: COFINS débito calculado: ${valorCalculado}`);
                return valorCalculado;
            }
        }

        // Fallback para estrutura processada anteriormente
        if (dados.parametrosFiscais?.debitos?.cofins !== undefined) {
            return dados.parametrosFiscais.debitos.cofins;
        }

        console.warn('IMPORTACAO-CONTROLLER: Valor de débito COFINS não encontrado');
        return 0;
    }

    /**
     * Obtém o valor de crédito de COFINS do registro M600 campo 6 (VL_TOT_CRED_DESC_PER)
     * ou de registros M505 consolidados
     */
    function obterCreditoCOFINS(dados) {
        // FONTE PRIMÁRIA: Registro M600 campo 6 (VL_TOT_CRED_DESC_PER)
        const registrosM600 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M600') || [];
        if (registrosM600.length > 0 && registrosM600[0].valorTotalCreditos !== undefined) {
            console.log(`IMPORTACAO-CONTROLLER: COFINS crédito obtido de M600: ${registrosM600[0].valorTotalCreditos}`);
            return registrosM600[0].valorTotalCreditos;
        }

        // FONTE SECUNDÁRIA: Consolidação de registros M505 (detalhamento de créditos)
        const registrosM505 = dados.creditos?.cofins?.filter(reg => reg.tipo === 'credito_detalhe') || [];
        if (registrosM505.length > 0) {
            const totalCreditos = registrosM505.reduce((total, reg) => {
                return total + (reg.valorCredito || reg.valorCreditoDisp || 0);
            }, 0);

            if (totalCreditos > 0) {
                console.log(`IMPORTACAO-CONTROLLER: COFINS crédito calculado de M505: ${totalCreditos}`);
                return totalCreditos;
            }
        }

        // Fallback para estrutura processada anteriormente
        if (dados.parametrosFiscais?.creditos?.cofins !== undefined) {
            return dados.parametrosFiscais.creditos.cofins;
        }

        console.warn('IMPORTACAO-CONTROLLER: Valor de crédito COFINS não encontrado');
        return 0;
    }
    
    /**
     * Obtém o valor de outros débitos de PIS a partir do registro M210 (campo 12)
     * VL_AJUS_ACRES - Ajustes de acréscimo da contribuição
     */
    function obterAjusteDebitoPIS(dados) {
        const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
        if (registrosM210.length > 0 && registrosM210[0].valorAjustesAcrescimo !== undefined) {
            console.log(`IMPORTACAO-CONTROLLER: PIS ajuste débito (M210-12): ${registrosM210[0].valorAjustesAcrescimo}`);
            return registrosM210[0].valorAjustesAcrescimo;
        }

        // Verificar detalhamentos M215 para ajustes de base de cálculo tipo acréscimo
        const registrosM215 = dados.ajustes?.pis?.filter(reg => 
            reg.registro === 'M215' && reg.indAjusteBc === '0'
        ) || [];

        if (registrosM215.length > 0) {
            const totalAjustesAcrescimo = registrosM215.reduce((total, reg) => {
                return total + (reg.valorAjusteBc || 0);
            }, 0);

            if (totalAjustesAcrescimo > 0) {
                console.log(`IMPORTACAO-CONTROLLER: PIS ajuste débito calculado de M215: ${totalAjustesAcrescimo}`);
                return totalAjustesAcrescimo;
            }
        }

        // Fallback
        if (dados.parametrosFiscais?.ajustes?.pisOutrosDebitos !== undefined) {
            return dados.parametrosFiscais.ajustes.pisOutrosDebitos;
        }

        return 0;
    }

    /**
     * Obtém o valor de outros créditos de PIS a partir do registro M210 (campo 13)
     * VL_AJUS_REDUC - Ajustes de redução da contribuição
     */
    function obterAjusteCreditoPIS(dados) {
        const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
        if (registrosM210.length > 0 && registrosM210[0].valorAjustesReducao !== undefined) {
            console.log(`IMPORTACAO-CONTROLLER: PIS ajuste crédito (M210-13): ${registrosM210[0].valorAjustesReducao}`);
            return registrosM210[0].valorAjustesReducao;
        }

        // Verificar detalhamentos M215 para ajustes de base de cálculo tipo redução
        const registrosM215 = dados.ajustes?.pis?.filter(reg => 
            reg.registro === 'M215' && reg.indAjusteBc === '1'
        ) || [];

        if (registrosM215.length > 0) {
            const totalAjustesReducao = registrosM215.reduce((total, reg) => {
                return total + (reg.valorAjusteBc || 0);
            }, 0);

            if (totalAjustesReducao > 0) {
                console.log(`IMPORTACAO-CONTROLLER: PIS ajuste crédito calculado de M215: ${totalAjustesReducao}`);
                return totalAjustesReducao;
            }
        }

        // Fallback
        if (dados.parametrosFiscais?.ajustes?.pisOutrosCreditos !== undefined) {
            return dados.parametrosFiscais.ajustes.pisOutrosCreditos;
        }

        return 0;
    }

    /**
     * Obtém o valor de outros débitos de COFINS a partir do registro M610 (campo 12)
     * VL_AJUS_ACRES - Ajustes de acréscimo da contribuição
     */
    function obterAjusteDebitoCOFINS(dados) {
        const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];
        if (registrosM610.length > 0 && registrosM610[0].valorAjustesAcrescimo !== undefined) {
            console.log(`IMPORTACAO-CONTROLLER: COFINS ajuste débito (M610-12): ${registrosM610[0].valorAjustesAcrescimo}`);
            return registrosM610[0].valorAjustesAcrescimo;
        }

        // Verificar detalhamentos M615 para ajustes de base de cálculo tipo acréscimo
        const registrosM615 = dados.ajustes?.cofins?.filter(reg => 
            reg.registro === 'M615' && reg.indAjusteBc === '0'
        ) || [];

        if (registrosM615.length > 0) {
            const totalAjustesAcrescimo = registrosM615.reduce((total, reg) => {
                return total + (reg.valorAjusteBc || 0);
            }, 0);

            if (totalAjustesAcrescimo > 0) {
                console.log(`IMPORTACAO-CONTROLLER: COFINS ajuste débito calculado de M615: ${totalAjustesAcrescimo}`);
                return totalAjustesAcrescimo;
            }
        }

        // Fallback
        if (dados.parametrosFiscais?.ajustes?.cofinsOutrosDebitos !== undefined) {
            return dados.parametrosFiscais.ajustes.cofinsOutrosDebitos;
        }

        return 0;
    }

    /**
     * Obtém o valor de outros créditos de COFINS a partir do registro M610 (campo 13)
     * VL_AJUS_REDUC - Ajustes de redução da contribuição
     */
    function obterAjusteCreditoCOFINS(dados) {
        const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];
        if (registrosM610.length > 0 && registrosM610[0].valorAjustesReducao !== undefined) {
            console.log(`IMPORTACAO-CONTROLLER: COFINS ajuste crédito (M610-13): ${registrosM610[0].valorAjustesReducao}`);
            return registrosM610[0].valorAjustesReducao;
        }

        // Verificar detalhamentos M615 para ajustes de base de cálculo tipo redução
        const registrosM615 = dados.ajustes?.cofins?.filter(reg => 
            reg.registro === 'M615' && reg.indAjusteBc === '1'
        ) || [];

        if (registrosM615.length > 0) {
            const totalAjustesReducao = registrosM615.reduce((total, reg) => {
                return total + (reg.valorAjusteBc || 0);
            }, 0);

            if (totalAjustesReducao > 0) {
                console.log(`IMPORTACAO-CONTROLLER: COFINS ajuste crédito calculado de M615: ${totalAjustesReducao}`);
                return totalAjustesReducao;
            }
        }

        // Fallback
        if (dados.parametrosFiscais?.ajustes?.cofinsOutrosCreditos !== undefined) {
            return dados.parametrosFiscais.ajustes.cofinsOutrosCreditos;
        }

        return 0;
    }

    /**
     * Obtém o valor de débito de ICMS a partir do registro E110 (campo 2)
     */
    function obterDebitoICMS(dados) {
        // Buscar registro E110 no array de débitos ICMS
        const registrosE110 = dados.debitos?.icms?.filter(reg => reg.registro === 'E110') || [];
        if (registrosE110.length > 0 && registrosE110[0].valorTotalDebitos !== undefined) {
            return registrosE110[0].valorTotalDebitos;
        }

        // Verificar se há dados em parametrosFiscais.debitos.icms (de um processamento anterior)
        if (dados.parametrosFiscais?.debitos?.icms !== undefined) {
            return dados.parametrosFiscais.debitos.icms;
        }

        // Se não encontrou, retornar 0
        return 0;
    }

    /**
     * Obtém o valor de crédito de ICMS a partir do registro E110 (campo 6)
     */
    function obterCreditoICMS(dados) {
        // Buscar registro E110 no array de débitos ICMS
        const registrosE110 = dados.debitos?.icms?.filter(reg => reg.registro === 'E110') || [];
        if (registrosE110.length > 0 && registrosE110[0].valorTotalCreditos !== undefined) {
            return registrosE110[0].valorTotalCreditos;
        }

        // Verificar se há dados em parametrosFiscais.creditos.icms (de um processamento anterior)
        if (dados.parametrosFiscais?.creditos?.icms !== undefined) {
            return dados.parametrosFiscais.creditos.icms;
        }

        // Se não encontrou, retornar 0
        return 0;
    }

    /**
     * Obtém o valor de débito de IPI a partir do registro E200 (campo 2)
     */
    function obterDebitoIPI(dados) {
        // Buscar registro E200 no array de débitos IPI
        const registrosE200 = dados.debitos?.ipi?.filter(reg => reg.registro === 'E200') || [];
        if (registrosE200.length > 0 && registrosE200[0].valorTotalDebitos !== undefined) {
            return registrosE200[0].valorTotalDebitos;
        }

        // Verificar se há dados em parametrosFiscais.debitos.ipi (de um processamento anterior)
        if (dados.parametrosFiscais?.debitos?.ipi !== undefined) {
            return dados.parametrosFiscais.debitos.ipi;
        }

        // Se não encontrou, retornar 0
        return 0;
    }

    /**
     * Obtém o valor de crédito de IPI a partir do registro E200 (campo 3)
     */
    function obterCreditoIPI(dados) {
        // Buscar registro E200 no array de débitos IPI
        const registrosE200 = dados.debitos?.ipi?.filter(reg => reg.registro === 'E200') || [];
        if (registrosE200.length > 0 && registrosE200[0].valorTotalCreditos !== undefined) {
            return registrosE200[0].valorTotalCreditos;
        }

        // Verificar se há dados em parametrosFiscais.creditos.ipi (de um processamento anterior)
        if (dados.parametrosFiscais?.creditos?.ipi !== undefined) {
            return dados.parametrosFiscais.creditos.ipi;
        }

        // Se não encontrou, retornar 0
        return 0;
    }
    
    /**
     * Valida consistência entre registros pai (M210/M610) e filhos (M215/M615)
     * conforme especificado no documento técnico
     */
    function validarConsistenciaAjustesCruzados(dados) {
        console.log('IMPORTACAO-CONTROLLER: Validando consistência entre ajustes BC e detalhamentos');

        let inconsistenciasEncontradas = [];

        // Validar PIS (M210 vs M215)
        const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
        const registrosM215 = dados.ajustes?.pis?.filter(reg => reg.registro === 'M215') || [];

        if (registrosM210.length > 0 && registrosM215.length > 0) {
            const m210 = registrosM210[0];

            // Somar M215 por tipo
            const totalAcrescimoM215 = registrosM215
                .filter(reg => reg.indAjusteBc === '0')
                .reduce((sum, reg) => sum + (reg.valorAjusteBc || 0), 0);

            const totalReducaoM215 = registrosM215
                .filter(reg => reg.indAjusteBc === '1')
                .reduce((sum, reg) => sum + (reg.valorAjusteBc || 0), 0);

            // Validar consistência (tolerância de 0.01)
            if (Math.abs(totalAcrescimoM215 - (m210.valorAjustesAcrescimoBc || 0)) > 0.01) {
                inconsistenciasEncontradas.push({
                    tipo: 'pis_ajuste_acrescimo_bc',
                    m210: m210.valorAjustesAcrescimoBc || 0,
                    m215: totalAcrescimoM215,
                    diferenca: Math.abs(totalAcrescimoM215 - (m210.valorAjustesAcrescimoBc || 0))
                });
            }

            if (Math.abs(totalReducaoM215 - (m210.valorAjustesReducaoBc || 0)) > 0.01) {
                inconsistenciasEncontradas.push({
                    tipo: 'pis_ajuste_reducao_bc',
                    m210: m210.valorAjustesReducaoBc || 0,
                    m215: totalReducaoM215,
                    diferenca: Math.abs(totalReducaoM215 - (m210.valorAjustesReducaoBc || 0))
                });
            }

            // Validar fórmula da base ajustada: Campo 7 = Campo 4 + Campo 5 - Campo 6
            const baseCalculada = (m210.valorBaseCalculoAntes || 0) + 
                                 (m210.valorAjustesAcrescimoBc || 0) - 
                                 (m210.valorAjustesReducaoBc || 0);

            if (Math.abs(baseCalculada - (m210.valorBaseCalculoAjustada || 0)) > 0.01) {
                inconsistenciasEncontradas.push({
                    tipo: 'pis_base_calculada',
                    esperado: baseCalculada,
                    informado: m210.valorBaseCalculoAjustada || 0,
                    diferenca: Math.abs(baseCalculada - (m210.valorBaseCalculoAjustada || 0))
                });
            }
        }

        // Validar COFINS (M610 vs M615) - lógica similar
        const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];
        const registrosM615 = dados.ajustes?.cofins?.filter(reg => reg.registro === 'M615') || [];

        if (registrosM610.length > 0 && registrosM615.length > 0) {
            const m610 = registrosM610[0];

            const totalAcrescimoM615 = registrosM615
                .filter(reg => reg.indAjusteBc === '0')
                .reduce((sum, reg) => sum + (reg.valorAjusteBc || 0), 0);

            const totalReducaoM615 = registrosM615
                .filter(reg => reg.indAjusteBc === '1')
                .reduce((sum, reg) => sum + (reg.valorAjusteBc || 0), 0);

            // Validações similares para COFINS...
            if (Math.abs(totalAcrescimoM615 - (m610.valorAjustesAcrescimoBc || 0)) > 0.01) {
                inconsistenciasEncontradas.push({
                    tipo: 'cofins_ajuste_acrescimo_bc',
                    m610: m610.valorAjustesAcrescimoBc || 0,
                    m615: totalAcrescimoM615,
                    diferenca: Math.abs(totalAcrescimoM615 - (m610.valorAjustesAcrescimoBc || 0))
                });
            }

            const baseCalculadaCofins = (m610.valorBaseCalculoAntes || 0) + 
                                       (m610.valorAjustesAcrescimoBc || 0) - 
                                       (m610.valorAjustesReducaoBc || 0);

            if (Math.abs(baseCalculadaCofins - (m610.valorBaseCalculoAjustada || 0)) > 0.01) {
                inconsistenciasEncontradas.push({
                    tipo: 'cofins_base_calculada',
                    esperado: baseCalculadaCofins,
                    informado: m610.valorBaseCalculoAjustada || 0,
                    diferenca: Math.abs(baseCalculadaCofins - (m610.valorBaseCalculoAjustada || 0))
                });
            }
        }

        // Log das inconsistências encontradas
        if (inconsistenciasEncontradas.length > 0) {
            console.warn('IMPORTACAO-CONTROLLER: Inconsistências detectadas na validação cruzada:', inconsistenciasEncontradas);
            inconsistenciasEncontradas.forEach(inc => {
                console.warn(`IMPORTACAO-CONTROLLER: ${inc.tipo} - Diferença: ${inc.diferenca}`);
            });
        } else {
            console.log('IMPORTACAO-CONTROLLER: Validação cruzada passou sem inconsistências');
        }

        return inconsistenciasEncontradas;
    }
    
    /**
     * Preenche os parâmetros fiscais no formulário usando extração específica conforme novo layout SPED
     * Utiliza as funções de extração que seguem hierarquia de prioridade estabelecida
     */
    function preencherParametrosFiscais(parametrosFiscais) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo parâmetros fiscais com novo layout:', parametrosFiscais);

        if (!parametrosFiscais || typeof parametrosFiscais !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Parâmetros fiscais inválidos');
            return;
        }

        // ETAPA 1: Extrair dados diretamente usando as funções específicas
        const dadosExtraidos = window.dadosImportadosSped?.original || parametrosFiscais;

        // Aplicar validação cruzada antes do preenchimento
        const inconsistencias = validarConsistenciaAjustesCruzados(dadosExtraidos);
        if (inconsistencias.length > 0) {
            adicionarLog(`Detectadas ${inconsistencias.length} inconsistências nos dados tributários`, 'warning');
        }

        // ETAPA 2: Extrair valores usando hierarquia de prioridade
        const valoresTributarios = {
            // Débitos conforme hierarquia VL_CONT_PER > VL_CONT_APUR > Calculado
            debitos: {
                pis: obterDebitoPIS(dadosExtraidos),
                cofins: obterDebitoCOFINS(dadosExtraidos),
                icms: obterDebitoICMS(dadosExtraidos),
                ipi: obterDebitoIPI(dadosExtraidos),
                iss: parametrosFiscais.debitos?.iss || 0
            },

            // Créditos conforme fontes específicas
            creditos: {
                pis: obterCreditoPIS(dadosExtraidos),
                cofins: obterCreditoCOFINS(dadosExtraidos),
                icms: obterCreditoICMS(dadosExtraidos),
                ipi: obterCreditoIPI(dadosExtraidos)
            },

            // Ajustes conforme novos campos M210/M610
            ajustes: {
                pisOutrosDebitos: obterAjusteDebitoPIS(dadosExtraidos),
                pisOutrosCreditos: obterAjusteCreditoPIS(dadosExtraidos),
                cofinsOutrosDebitos: obterAjusteDebitoCOFINS(dadosExtraidos),
                cofinsOutrosCreditos: obterAjusteCreditoCOFINS(dadosExtraidos)
            },

            // Bases de cálculo ajustadas (novo layout)
            basesCalculoAjustadas: extrairBasesCalculoAjustadas(dadosExtraidos),

            // Metadados para rastreabilidade
            fontesDados: {
                pis: determinarFonteDadosPIS(dadosExtraidos),
                cofins: determinarFonteDadosCOFINS(dadosExtraidos),
                icms: 'sped_fiscal',
                ipi: 'sped_fiscal'
            }
        };

        // ETAPA 3: Preencher campos de débitos com validação
        preencherCampoTributario('debito-pis', valoresTributarios.debitos.pis, valoresTributarios.fontesDados.pis);
        preencherCampoTributario('debito-cofins', valoresTributarios.debitos.cofins, valoresTributarios.fontesDados.cofins);
        preencherCampoTributario('debito-icms', valoresTributarios.debitos.icms, valoresTributarios.fontesDados.icms);
        preencherCampoTributario('debito-ipi', valoresTributarios.debitos.ipi, valoresTributarios.fontesDados.ipi);
        preencherCampoTributario('debito-iss', valoresTributarios.debitos.iss, 'estimado');

        // ETAPA 4: Preencher campos de créditos
        preencherCampoTributario('credito-pis', valoresTributarios.creditos.pis, valoresTributarios.fontesDados.pis);
        preencherCampoTributario('credito-cofins', valoresTributarios.creditos.cofins, valoresTributarios.fontesDados.cofins);
        preencherCampoTributario('credito-icms', valoresTributarios.creditos.icms, valoresTributarios.fontesDados.icms);
        preencherCampoTributario('credito-ipi', valoresTributarios.creditos.ipi, valoresTributarios.fontesDados.ipi);

        // ETAPA 5: Preencher campos de ajustes (NOVIDADE do layout)
        preencherCampoTributario('outros-debitos-pis', valoresTributarios.ajustes.pisOutrosDebitos, valoresTributarios.fontesDados.pis);
        preencherCampoTributario('outros-creditos-pis', valoresTributarios.ajustes.pisOutrosCreditos, valoresTributarios.fontesDados.pis);
        preencherCampoTributario('outros-debitos-cofins', valoresTributarios.ajustes.cofinsOutrosDebitos, valoresTributarios.fontesDados.cofins);
        preencherCampoTributario('outros-creditos-cofins', valoresTributarios.ajustes.cofinsOutrosCreditos, valoresTributarios.fontesDados.cofins);

        // ETAPA 6: Preencher bases de cálculo ajustadas (se campos existirem)
        if (valoresTributarios.basesCalculoAjustadas) {
            preencherCampoTributario('base-calculo-pis-ajustada', valoresTributarios.basesCalculoAjustadas.pis, valoresTributarios.fontesDados.pis);
            preencherCampoTributario('base-calculo-cofins-ajustada', valoresTributarios.basesCalculoAjustadas.cofins, valoresTributarios.fontesDados.cofins);
        }

        // ETAPA 7: Calcular e preencher totais
        const totalDebitos = Object.values(valoresTributarios.debitos).reduce((sum, val) => sum + (val || 0), 0);
        const totalCreditos = Object.values(valoresTributarios.creditos).reduce((sum, val) => sum + (val || 0), 0);
        const totalAjustesDebitos = Object.values(valoresTributarios.ajustes)
            .filter((_, index) => index % 2 === 0) // Débitos (índices pares)
            .reduce((sum, val) => sum + (val || 0), 0);
        const totalAjustesCreditos = Object.values(valoresTributarios.ajustes)
            .filter((_, index) => index % 2 === 1) // Créditos (índices ímpares)
            .reduce((sum, val) => sum + (val || 0), 0);

        preencherCampoTributario('total-debitos', totalDebitos, 'calculado');
        preencherCampoTributario('total-creditos', totalCreditos, 'calculado');
        preencherCampoTributario('total-ajustes-debitos', totalAjustesDebitos, 'calculado');
        preencherCampoTributario('total-ajustes-creditos', totalAjustesCreditos, 'calculado');

        // ETAPA 8: Preencher configurações adicionais
        preencherConfiguracoesFiscais(parametrosFiscais, dadosExtraidos);

        // ETAPA 9: Log de resumo
        adicionarLog(`Parâmetros fiscais preenchidos: ${Object.keys(valoresTributarios.debitos).length} tipos de débito, ${Object.keys(valoresTributarios.creditos).length} tipos de crédito`, 'success');

        console.log('IMPORTACAO-CONTROLLER: Valores tributários extraídos:', valoresTributarios);

        // ETAPA 10: Atualizar cálculos dependentes
        if (typeof window.calcularCreditosTributarios === 'function') {
            try {
                window.calcularCreditosTributarios();
                console.log('IMPORTACAO-CONTROLLER: Créditos tributários recalculados');
            } catch (erro) {
                console.warn('IMPORTACAO-CONTROLLER: Erro ao recalcular créditos tributários:', erro);
            }
        }
    }
    
    /**
     * Preenche campo tributário com validação e indicação de fonte
     */
    function preencherCampoTributario(campoId, valor, fonte) {
        const elemento = document.getElementById(campoId);
        if (!elemento) {
            console.warn(`IMPORTACAO-CONTROLLER: Campo ${campoId} não encontrado`);
            return;
        }

        if (valor === null || valor === undefined || isNaN(valor)) {
            console.warn(`IMPORTACAO-CONTROLLER: Valor inválido para campo ${campoId}:`, valor);
            return;
        }

        try {
            // Validar e formatar valor
            const valorValidado = validarValorMonetario(valor);
            const valorFormatado = formatarMoeda(valorValidado);

            // Definir valor
            elemento.value = valorFormatado;

            // Preservar valor numérico para cálculos
            if (elemento.dataset) {
                elemento.dataset.rawValue = valorValidado.toString();
            }

            // Marcar fonte dos dados
            marcarFonteDados(elemento, fonte);

            // Disparar evento para recálculos
            elemento.dispatchEvent(new Event('input', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Campo ${campoId} preenchido: ${valorFormatado} (fonte: ${fonte})`);

        } catch (erro) {
            console.error(`IMPORTACAO-CONTROLLER: Erro ao preencher campo ${campoId}:`, erro);
        }
    }

    /**
     * Marca visualmente a fonte dos dados no campo
     */
    function marcarFonteDados(elemento, fonte) {
        if (!elemento) return;

        // Remover classes anteriores
        elemento.classList.remove('sped-data', 'calculated-data', 'estimated-data');

        // Aplicar estilo baseado na fonte
        switch (fonte) {
            case 'VL_CONT_PER':
            case 'VL_CONT_APUR':
            case 'sped_contribuicoes':
            case 'sped_fiscal':
                elemento.classList.add('sped-data');
                elemento.title = `Dados extraídos do SPED (${fonte})`;
                elemento.style.borderLeft = '4px solid #28a745';
                elemento.style.backgroundColor = '#f8fff8';
                break;

            case 'calculado':
                elemento.classList.add('calculated-data');
                elemento.title = 'Valor calculado automaticamente';
                elemento.style.borderLeft = '4px solid #17a2b8';
                elemento.style.backgroundColor = '#f0fcff';
                break;

            case 'estimado':
                elemento.classList.add('estimated-data');
                elemento.title = 'Valor estimado';
                elemento.style.borderLeft = '4px solid #ffc107';
                elemento.style.backgroundColor = '#fffbf0';
                break;

            default:
                elemento.style.borderLeft = '4px solid #6c757d';
                elemento.style.backgroundColor = '#f8f9fa';
        }
    }

    /**
     * Extrai bases de cálculo ajustadas conforme novo layout
     */
    function extrairBasesCalculoAjustadas(dados) {
        const bases = {};

        // Base PIS ajustada (M210 campo 7)
        const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
        if (registrosM210.length > 0 && registrosM210[0].valorBaseCalculoAjustada !== undefined) {
            bases.pis = registrosM210[0].valorBaseCalculoAjustada;
        }

        // Base COFINS ajustada (M610 campo 7)
        const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];
        if (registrosM610.length > 0 && registrosM610[0].valorBaseCalculoAjustada !== undefined) {
            bases.cofins = registrosM610[0].valorBaseCalculoAjustada;
        }

        return Object.keys(bases).length > 0 ? bases : null;
    }

    /**
     * Determina a fonte específica dos dados PIS
     */
    function determinarFonteDadosPIS(dados) {
        const registrosM210 = dados.debitos?.pis?.filter(reg => reg.registro === 'M210') || [];
        if (registrosM210.length > 0) {
            const reg = registrosM210[0];
            if (reg.valorContribPeriodo !== undefined && reg.valorContribPeriodo > 0) {
                return 'VL_CONT_PER';
            } else if (reg.valorContribApurada !== undefined && reg.valorContribApurada > 0) {
                return 'VL_CONT_APUR';
            } else {
                return 'calculado';
            }
        }
        return 'sped_contribuicoes';
    }

    /**
     * Determina a fonte específica dos dados COFINS
     */
    function determinarFonteDadosCOFINS(dados) {
        const registrosM610 = dados.debitos?.cofins?.filter(reg => reg.registro === 'M610') || [];
        if (registrosM610.length > 0) {
            const reg = registrosM610[0];
            if (reg.valorContribPeriodo !== undefined && reg.valorContribPeriodo > 0) {
                return 'VL_CONT_PER';
            } else if (reg.valorContribApurada !== undefined && reg.valorContribApurada > 0) {
                return 'VL_CONT_APUR';
            } else {
                return 'calculado';
            }
        }
        return 'sped_contribuicoes';
    }

    /**
     * Preenche configurações fiscais adicionais
     */
    function preencherConfiguracoesFiscais(parametrosFiscais, dadosExtraidos) {
        // Tipo de operação
        const campoTipoOperacao = document.getElementById('tipo-operacao');
        if (campoTipoOperacao && parametrosFiscais.tipoOperacao) {
            campoTipoOperacao.value = parametrosFiscais.tipoOperacao;
            marcarFonteDados(campoTipoOperacao, 'sped_contribuicoes');
            campoTipoOperacao.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Regime PIS/COFINS baseado no registro 0110
        const regimePisCofins = dadosExtraidos.regimes?.pis_cofins?.codigoIncidencia;
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');
        if (campoPisCofinsRegime && regimePisCofins) {
            // Mapear código para valor do select
            const regimeMapping = {
                '1': 'nao-cumulativo',
                '2': 'cumulativo',
                '3': 'misto'
            };

            const regimeValue = regimeMapping[regimePisCofins];
            if (regimeValue) {
                campoPisCofinsRegime.value = regimeValue;
                marcarFonteDados(campoPisCofinsRegime, 'sped_contribuicoes');
                campoPisCofinsRegime.dispatchEvent(new Event('change', { bubbles: true }));

                adicionarLog(`Regime PIS/COFINS identificado: ${regimeValue} (código ${regimePisCofins})`, 'info');
            }
        }

        // Alíquotas efetivas se disponíveis
        preencherAliquotasEfetivas(dadosExtraidos);
    }

    /**
     * Preenche alíquotas efetivas calculadas
     */
    function preencherAliquotasEfetivas(dados) {
        const faturamento = obterFaturamentoAtual();
        if (faturamento <= 0) return;

        // Calcular alíquota efetiva PIS
        const debitoPIS = obterDebitoPIS(dados);
        if (debitoPIS > 0) {
            const aliquotaEfetivaPIS = (debitoPIS / faturamento) * 100;
            preencherCampoTributario('aliquota-efetiva-pis', aliquotaEfetivaPIS.toFixed(4), 'calculado');
        }

        // Calcular alíquota efetiva COFINS
        const debitoCOFINS = obterDebitoCOFINS(dados);
        if (debitoCOFINS > 0) {
            const aliquotaEfetivaCOFINS = (debitoCOFINS / faturamento) * 100;
            preencherCampoTributario('aliquota-efetiva-cofins', aliquotaEfetivaCOFINS.toFixed(4), 'calculado');
        }
    }
    
    /**
     * Preenche a composição tributária detalhada
     */
    function preencherComposicaoTributaria(composicao) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo composição tributária:', composicao);

        if (!composicao || typeof composicao !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Composição tributária inválida');
            return;
        }

        const { debitos, creditos, aliquotasEfetivas, fontesDados } = composicao;

        // Validar estrutura
        if (!debitos || !creditos) {
            console.warn('IMPORTACAO-CONTROLLER: Estrutura de débitos/créditos ausente');
            return;
        }

        // Validar e processar débitos
        const debitosValidados = {};
        Object.entries(debitos).forEach(([imposto, valor]) => {
            // Garantir que temos um valor monetário válido
            debitosValidados[imposto] = validarValorMonetario(valor);

            if (debitosValidados[imposto] > 0) {
                preencherCampoComValor(`debito-${imposto}`, debitosValidados[imposto], 
                                        fontesDados && fontesDados[imposto] === 'sped' ? 'SPED' : null);
                console.log(`IMPORTACAO-CONTROLLER: Débito ${imposto} preenchido: ${debitosValidados[imposto]}`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: Débito ${imposto} inválido ou zero: ${valor}`);
            }
        });

        // Validar e processar créditos
        const creditosValidados = {};
        Object.entries(creditos).forEach(([imposto, valor]) => {
            // Garantir que temos um valor monetário válido
            creditosValidados[imposto] = validarValorMonetario(valor);

            if (creditosValidados[imposto] > 0) {
                preencherCampoComValor(`credito-${imposto}`, creditosValidados[imposto], 
                                        fontesDados && fontesDados[imposto] === 'sped' ? 'SPED' : null);
                console.log(`IMPORTACAO-CONTROLLER: Crédito ${imposto} preenchido: ${creditosValidados[imposto]}`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: Crédito ${imposto} inválido ou zero: ${valor}`);
            }
        });

        // Validar e processar alíquotas efetivas - MODIFICAÇÃO AQUI
        if (aliquotasEfetivas && typeof aliquotasEfetivas === 'object') {
            Object.entries(aliquotasEfetivas).forEach(([imposto, aliquota]) => {
                // Alíquotas já devem estar em formato percentual (0-100), mas garantimos a validação
                let aliquotaValidada = typeof aliquota === 'number' ? aliquota : parseFloat(aliquota);

                // Garantir que é um valor válido entre 0 e 100%
                if (!isNaN(aliquotaValidada)) {
                    // Garantir que está em formato percentual
                    if (aliquotaValidada > 0 && aliquotaValidada <= 1) {
                        aliquotaValidada = aliquotaValidada * 100;
                    }

                    aliquotaValidada = Math.max(0, Math.min(100, aliquotaValidada));

                    // Usar 3 casas decimais para percentuais de alíquotas efetivas
                    preencherCampoComValor(`aliquota-efetiva-${imposto}`, aliquotaValidada, null, 3);
                    console.log(`IMPORTACAO-CONTROLLER: Alíquota efetiva ${imposto} preenchida: ${aliquotaValidada.toFixed(3)}%`);
                } else {
                    console.warn(`IMPORTACAO-CONTROLLER: Alíquota ${imposto} inválida: ${aliquota}`);
                }
            });
        }

        // Calcular e preencher totais com precisão
        const totalDebitos = Object.values(debitosValidados).reduce((sum, val) => sum + (val || 0), 0);
        const totalCreditos = Object.values(creditosValidados).reduce((sum, val) => sum + (val || 0), 0);

        // Determinar a fonte dos totais (SPED se pelo menos um valor vier do SPED)
        const fonteTotais = Object.values(fontesDados || {}).includes('sped') ? 'SPED' : null;

        preencherCampoComValor('total-debitos', totalDebitos, fonteTotais);
        preencherCampoComValor('total-creditos', totalCreditos, fonteTotais);
        console.log(`IMPORTACAO-CONTROLLER: Totais calculados - Débitos: ${totalDebitos.toFixed(2)}, Créditos: ${totalCreditos.toFixed(2)}`);

        // Adicionar indicadores de fonte
        if (fontesDados) {
            adicionarIndicadoresFonte(fontesDados);
        }
    }

    /**
     * Preenche um campo com valor formatado e indicador de fonte
     */
    function preencherCampoComValorEFonte(campoId, valor, fonte = 'sped', decimais = 2) {
        const elemento = document.getElementById(campoId);
        if (!elemento) {
            console.warn(`IMPORTACAO-CONTROLLER: Elemento ${campoId} não encontrado`);
            return;
        }

        // Validar valor
        let valorValidado = validarValorMonetario(valor);

        // Formatar valor de acordo com o tipo
        let valorFormatado;
        if (campoId.includes('aliquota-efetiva') || campoId.includes('efetiv')) {
            // Formato percentual com precisão específica
            valorFormatado = valorValidado.toFixed(decimais);
        } else {
            // Formato monetário
            valorFormatado = formatarMoeda(valorValidado);
            // Se o campo tem dataset.rawValue (para CurrencyFormatter)
            if (elemento.dataset) {
                elemento.dataset.rawValue = valorValidado.toString();
            }
        }

        // Atribuir valor formatado
        elemento.value = valorFormatado;

        // Marcar campo como preenchido pelo SPED ou estimado
        marcarCampoComFonte(elemento, fonte);

        // Disparar evento para atualizar cálculos dependentes
        elemento.dispatchEvent(new Event('input', { bubbles: true }));

        console.log(`IMPORTACAO-CONTROLLER: Campo ${campoId} preenchido com valor ${valorFormatado} (${fonte})`);
    }

    /**
     * Marca campo visualmente conforme a fonte dos dados
     */
    function marcarCampoComFonte(elemento, fonte) {
        if (!elemento) return;

        // Remover classes anteriores
        elemento.classList.remove('sped-data', 'estimated-data', 'calculated-data');

        // Aplicar estilo conforme a fonte
        switch (fonte) {
            case 'sped':
                elemento.classList.add('sped-data');
                elemento.title = 'Dados importados do SPED';
                elemento.style.borderLeft = '3px solid #28a745'; // Verde
                elemento.style.backgroundColor = '#f8fff8';
                break;
            case 'estimado':
                elemento.classList.add('estimated-data');
                elemento.title = 'Dados estimados com base em outros valores';
                elemento.style.borderLeft = '3px solid #ffc107'; // Amarelo
                elemento.style.backgroundColor = '#fffbf0';
                break;
            case 'calculado':
                elemento.classList.add('calculated-data');
                elemento.title = 'Dados calculados automaticamente';
                elemento.style.borderLeft = '3px solid #17a2b8'; // Azul
                elemento.style.backgroundColor = '#f0fcff';
                break;
            default:
                elemento.style.borderLeft = '3px solid #6c757d'; // Cinza
                elemento.style.backgroundColor = '#f8f9fa';
        }

        // Adicionar indicador visual próximo ao campo
        adicionarIndicadorFonte(elemento, fonte);
    }

    /**
     * Adiciona indicador visual da fonte dos dados
     */
    function adicionarIndicadorFonte(elemento, fonte) {
        // Remover indicador anterior se existir
        const indicadorAnterior = elemento.parentNode.querySelector('.fonte-indicator');
        if (indicadorAnterior) {
            indicadorAnterior.remove();
        }

        const indicador = document.createElement('span');
        indicador.className = 'fonte-indicator';

        switch (fonte) {
            case 'sped':
                indicador.textContent = 'SPED';
                indicador.style.backgroundColor = '#28a745';
                break;
            case 'estimado':
                indicador.textContent = 'EST';
                indicador.style.backgroundColor = '#ffc107';
                break;
            case 'calculado':
                indicador.textContent = 'CALC';
                indicador.style.backgroundColor = '#17a2b8';
                break;
            default:
                indicador.textContent = 'N/A';
                indicador.style.backgroundColor = '#6c757d';
        }

        indicador.style.cssText += `
            display: inline-block;
            margin-left: 5px;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            color: white;
            vertical-align: middle;
        `;

        // Inserir depois do campo
        elemento.parentNode.insertBefore(indicador, elemento.nextSibling);
    }

    /**
     * Obtém o faturamento atual do formulário
     */
    function obterFaturamentoAtual() {
        const campoFaturamento = document.getElementById('faturamento');
        if (campoFaturamento && campoFaturamento.dataset.rawValue) {
            return parseFloat(campoFaturamento.dataset.rawValue) || 0;
        }
        return 0;
    }

    /**
     * Função auxiliar para extrair valor numérico
     */
    function extrairValorNumerico(dadoComFonte) {
        if (typeof dadoComFonte === 'number') {
            return dadoComFonte;
        }
        if (dadoComFonte && typeof dadoComFonte === 'object' && dadoComFonte.valor !== undefined) {
            return dadoComFonte.valor;
        }
        return parseValorMonetario(dadoComFonte) || 0;
    }
    
    /**
     * Preenche um campo com valor formatado
     * @param {string} campoId - ID do campo a ser preenchido
     * @param {number|string} valor - Valor a ser preenchido
     * @param {string} fonte - Fonte dos dados (SPED ou null)
     * @param {number} decimais - Número de casas decimais para formatação (default: 2)
     */
    function preencherCampoComValor(campoId, valor, fonte = null, decimais = 2) {
        const elemento = document.getElementById(campoId);
        if (!elemento) {
            console.warn(`IMPORTACAO-CONTROLLER: Elemento ${campoId} não encontrado`);
            return;
        }

        try {
            // Validar valor conforme o tipo de campo
            let valorValidado;
            let isPercentual = campoId.includes('aliquota') || campoId.includes('percentual') || campoId.includes('perc');

            if (isPercentual) {
                // Para campos percentuais
                valorValidado = parseFloat(valor);
                if (isNaN(valorValidado)) valorValidado = 0;

                // Converter de decimal para percentual se necessário
                if (valorValidado > 0 && valorValidado <= 1) {
                    valorValidado = valorValidado * 100;
                }

                // Limitar valores percentuais entre 0 e 100
                valorValidado = Math.max(0, Math.min(100, valorValidado));
            } else {
                // Para campos monetários
                valorValidado = validarValorMonetario(valor);
            }

            // Formatar valor conforme o tipo
            let valorFormatado;
            if (isPercentual) {
                // Formato percentual com precisão específica
                valorFormatado = valorValidado.toFixed(decimais);
                // Garantir que o valor inclui o símbolo de percentual
                if (!valorFormatado.includes('%')) {
                    valorFormatado = valorFormatado + '%';
                }
            } else {
                // Formato monetário
                valorFormatado = formatarMoeda(valorValidado);

                // Preservar valor numérico para uso em cálculos
                if (elemento.dataset) {
                    elemento.dataset.rawValue = valorValidado.toString();
                }
            }

            // Definir valor e atributos do campo
            elemento.value = valorFormatado;

            // Garantir que o campo não esteja definido como readonly
            if (elemento.hasAttribute('readonly') && 
                !elemento.classList.contains('calc-only') && 
                !campoId.includes('ciclo-financeiro')) {
                elemento.removeAttribute('readonly');
            }

            // Marcar campo como preenchido pelo SPED se aplicável
            if (fonte === 'SPED') {
                marcarCampoComoSped(elemento);
            }

            // Também armazenar o valor bruto para campos percentuais
            if (isPercentual && elemento.dataset) {
                elemento.dataset.percentValue = valorValidado.toString();
            }

            // Disparar evento para recalcular campos dependentes
            elemento.dispatchEvent(new Event('input', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Campo ${campoId} preenchido com valor ${valorFormatado}`);
            return true;
        } catch (erro) {
            console.error(`IMPORTACAO-CONTROLLER: Erro ao preencher campo ${campoId}:`, erro);
            return false;
        }
    }
    
    /**
     * Marca campo visualmente como preenchido pelo SPED
     */
    function marcarCampoComoSped(elemento) {
        if (!elemento) return;
        
        elemento.classList.add('sped-data');
        elemento.title = 'Dados importados do SPED';
        elemento.style.borderLeft = '3px solid #28a745';
        elemento.style.backgroundColor = '#f8fff8';
    }
    
    /**
     * Adiciona indicadores visuais da fonte dos dados
     */
    function adicionarIndicadoresFonte(fontesDados) {
        // Verificar se as fontes estão disponíveis
        if (!fontesDados || typeof fontesDados !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Fontes de dados não disponíveis para indicadores');
            return;
        }

        console.log('IMPORTACAO-CONTROLLER: Adicionando indicadores de fonte para:', fontesDados);

        // Para cada imposto e sua fonte
        Object.entries(fontesDados).forEach(([imposto, fonte]) => {
            // Criar elemento de indicador
            const indicador = document.createElement('span');
            indicador.className = `fonte-dados fonte-dados-${fonte.toLowerCase()}`;
            indicador.textContent = fonte === 'sped' ? 'SPED' : 'EST';
            indicador.title = fonte === 'sped' ? 'Dados extraídos do SPED' : 'Dados estimados';

            // Aplicar estilos CSS via classe, não inline
            if (!document.getElementById('fonte-dados-style')) {
                const style = document.createElement('style');
                style.id = 'fonte-dados-style';
                style.textContent = `
                    .fonte-dados {
                        display: inline-block;
                        margin-left: 5px;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: bold;
                        color: white;
                    }
                    .fonte-dados-sped {
                        background-color: #28a745;
                    }
                    .fonte-dados-estimado {
                        background-color: #ffc107;
                    }
                `;
                document.head.appendChild(style);
            }

            // Adicionar indicador para todos os campos relevantes
            const camposAlvos = [
                { id: `debito-${imposto}`, adicionado: false },
                { id: `credito-${imposto}`, adicionado: false },
                { id: `aliquota-efetiva-${imposto}`, adicionado: false }
            ];

            camposAlvos.forEach(campo => {
                const elemento = document.getElementById(campo.id);
                if (elemento && !elemento.parentNode.querySelector('.fonte-dados')) {
                    elemento.parentNode.appendChild(indicador.cloneNode(true));
                    campo.adicionado = true;
                    console.log(`IMPORTACAO-CONTROLLER: Indicador adicionado para ${campo.id}`);
                }
            });
        });
    }
    
    /**
     * Preenche dados do ciclo financeiro
     * @param {Object} cicloFinanceiro - Objeto com dados do ciclo financeiro
     */
    function preencherCicloFinanceiro(cicloFinanceiro) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo ciclo financeiro:', cicloFinanceiro);

        if (!cicloFinanceiro || typeof cicloFinanceiro !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Dados de ciclo financeiro inválidos');
            return;
        }

        try {
            // PMR - Prazo Médio de Recebimento
            const campoPmr = document.getElementById('pmr');
            if (campoPmr && cicloFinanceiro.pmr !== undefined) {
                // Garantir que é um valor válido
                const pmr = parseInt(cicloFinanceiro.pmr);
                if (!isNaN(pmr) && pmr > 0 && pmr <= 180) { // Entre 1 e 180 dias
                    // Garantir que o campo não está readonly
                    if (campoPmr.hasAttribute('readonly')) {
                        campoPmr.removeAttribute('readonly');
                    }

                    campoPmr.value = pmr;
                    marcarCampoComoSped(campoPmr);
                    campoPmr.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`IMPORTACAO-CONTROLLER: PMR preenchido: ${pmr} dias`);
                } else {
                    console.warn(`IMPORTACAO-CONTROLLER: PMR inválido: ${cicloFinanceiro.pmr}`);
                }
            }

            // PMP - Prazo Médio de Pagamento
            const campoPmp = document.getElementById('pmp');
            if (campoPmp && cicloFinanceiro.pmp !== undefined) {
                const pmp = parseInt(cicloFinanceiro.pmp);
                if (!isNaN(pmp) && pmp > 0 && pmp <= 180) {
                    // Garantir que o campo não está readonly
                    if (campoPmp.hasAttribute('readonly')) {
                        campoPmp.removeAttribute('readonly');
                    }

                    campoPmp.value = pmp;
                    marcarCampoComoSped(campoPmp);
                    campoPmp.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`IMPORTACAO-CONTROLLER: PMP preenchido: ${pmp} dias`);
                } else {
                    console.warn(`IMPORTACAO-CONTROLLER: PMP inválido: ${cicloFinanceiro.pmp}`);
                }
            }

            // PME - Prazo Médio de Estoque
            const campoPme = document.getElementById('pme');
            if (campoPme && cicloFinanceiro.pme !== undefined) {
                const pme = parseInt(cicloFinanceiro.pme);
                if (!isNaN(pme) && pme > 0 && pme <= 180) {
                    // Garantir que o campo não está readonly
                    if (campoPme.hasAttribute('readonly')) {
                        campoPme.removeAttribute('readonly');
                    }

                    campoPme.value = pme;
                    marcarCampoComoSped(campoPme);
                    campoPme.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log(`IMPORTACAO-CONTROLLER: PME preenchido: ${pme} dias`);
                } else {
                    console.warn(`IMPORTACAO-CONTROLLER: PME inválido: ${cicloFinanceiro.pme}`);
                }
            }

            // Percentual de vendas à vista
            const campoPercVista = document.getElementById('perc-vista');
            if (campoPercVista && cicloFinanceiro.percVista !== undefined) {
                let percVista = cicloFinanceiro.percVista;
                if (percVista <= 1) {
                    percVista = percVista * 100; // Converter de decimal para percentual
                }

                // Garantir que está entre 0 e 100
                percVista = Math.max(0, Math.min(100, percVista));

                // Garantir que o campo não está readonly
                if (campoPercVista.hasAttribute('readonly')) {
                    campoPercVista.removeAttribute('readonly');
                }

                campoPercVista.value = percVista.toFixed(1);
                marcarCampoComoSped(campoPercVista);
                campoPercVista.dispatchEvent(new Event('input', { bubbles: true }));
                console.log(`IMPORTACAO-CONTROLLER: Percentual de vendas à vista preenchido: ${percVista.toFixed(1)}%`);
            }

            return true;
        } catch (erro) {
            console.error('IMPORTACAO-CONTROLLER: Erro ao preencher ciclo financeiro:', erro);
            return false;
        }
    }
    
    /**
     * Preenche os dados financeiros no formulário
     * @param {Object} dadosFinanceiros - Dados financeiros extraídos ou calculados
     * @param {Object} dadosEmpresa - Dados da empresa para cálculos complementares
     */
    function preencherDadosFinanceiros(dadosFinanceiros, dadosEmpresa) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo dados financeiros:', dadosFinanceiros);

        if (!dadosFinanceiros) {
            // Se não temos dados financeiros, vamos calculá-los a partir dos dados da empresa
            dadosFinanceiros = {
                receitaBrutaMensal: dadosEmpresa.faturamento || 0,
                receitaLiquidaMensal: dadosEmpresa.faturamento ? dadosEmpresa.faturamento * 0.92 : 0, // Estimativa considerando impostos
                custoTotalMensal: dadosEmpresa.faturamento ? dadosEmpresa.faturamento * 0.65 : 0, // Estimativa
                despesasOperacionais: dadosEmpresa.faturamento ? dadosEmpresa.faturamento * 0.15 : 0, // Estimativa
                margemOperacional: dadosEmpresa.margem || 0.15
            };
            console.log('IMPORTACAO-CONTROLLER: Dados financeiros estimados:', dadosFinanceiros);
        }

        // Receita Bruta Mensal
        const campoReceitaBruta = document.getElementById('receita-bruta-mensal');
        if (campoReceitaBruta && dadosFinanceiros.receitaBrutaMensal) {
            const valor = validarValorMonetario(dadosFinanceiros.receitaBrutaMensal);
            campoReceitaBruta.value = formatarMoeda(valor);
            marcarCampoComoSped(campoReceitaBruta);
            console.log(`IMPORTACAO-CONTROLLER: Receita bruta mensal preenchida: ${formatarMoeda(valor)}`);
        }

        // Receita Líquida Mensal
        const campoReceitaLiquida = document.getElementById('receita-liquida-mensal');
        if (campoReceitaLiquida && dadosFinanceiros.receitaLiquidaMensal) {
            const valor = validarValorMonetario(dadosFinanceiros.receitaLiquidaMensal);
            campoReceitaLiquida.value = formatarMoeda(valor);
            marcarCampoComoSped(campoReceitaLiquida);
            console.log(`IMPORTACAO-CONTROLLER: Receita líquida mensal preenchida: ${formatarMoeda(valor)}`);
        }

        // Custo Total Mensal
        const campoCustoTotal = document.getElementById('custo-total-mensal');
        if (campoCustoTotal && dadosFinanceiros.custoTotalMensal) {
            const valor = validarValorMonetario(dadosFinanceiros.custoTotalMensal);
            campoCustoTotal.value = formatarMoeda(valor);
            marcarCampoComoSped(campoCustoTotal);
            console.log(`IMPORTACAO-CONTROLLER: Custo total mensal preenchido: ${formatarMoeda(valor)}`);
        }

        // Despesas Operacionais
        const campoDespesasOp = document.getElementById('despesas-operacionais');
        if (campoDespesasOp && dadosFinanceiros.despesasOperacionais) {
            const valor = validarValorMonetario(dadosFinanceiros.despesasOperacionais);
            campoDespesasOp.value = formatarMoeda(valor);
            marcarCampoComoSped(campoDespesasOp);
            console.log(`IMPORTACAO-CONTROLLER: Despesas operacionais preenchidas: ${formatarMoeda(valor)}`);
        }

        // Lucro Operacional
        const campoLucroOp = document.getElementById('lucro-operacional');
        if (campoLucroOp) {
            const receitaLiquida = validarValorMonetario(dadosFinanceiros.receitaLiquidaMensal);
            const custoTotal = validarValorMonetario(dadosFinanceiros.custoTotalMensal);
            const despesasOp = validarValorMonetario(dadosFinanceiros.despesasOperacionais);

            const lucroOperacional = receitaLiquida - custoTotal - despesasOp;
            campoLucroOp.value = formatarMoeda(lucroOperacional);
            marcarCampoComoSped(campoLucroOp);
            console.log(`IMPORTACAO-CONTROLLER: Lucro operacional calculado: ${formatarMoeda(lucroOperacional)}`);
        }

        // Margem Operacional (%)
        const campoMargemOp = document.getElementById('margem-operacional-percentual');
        if (campoMargemOp) {
            let margem = dadosFinanceiros.margemOperacional;
            if (margem > 1) {
                margem = margem / 100; // Converter de percentual para decimal se necessário
            }
            const margemPercentual = margem * 100;
            campoMargemOp.value = margemPercentual.toFixed(2);
            marcarCampoComoSped(campoMargemOp);
            console.log(`IMPORTACAO-CONTROLLER: Margem operacional preenchida: ${margemPercentual.toFixed(2)}%`);
        }

        // Checkbox para usar dados detalhados
        const checkboxDetalhado = document.getElementById('utilizar-dados-detalhados');
        if (checkboxDetalhado) {
            checkboxDetalhado.checked = true;
            checkboxDetalhado.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('IMPORTACAO-CONTROLLER: Checkbox de utilizar dados financeiros detalhados marcado');
        }
    }
    
    /**
     * Preenche dados do IVA Dual
     */
    function preencherDadosIVADual(ivaConfig) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo dados IVA Dual:', ivaConfig);

        if (!ivaConfig || typeof ivaConfig !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Configuração IVA inválida');
            return;
        }

        // Tentar selecionar setor se houver código
        const campoSetor = document.getElementById('setor');
        if (campoSetor && ivaConfig.codigoSetor) {
            const options = Array.from(campoSetor.options);
            const setorOption = options.find(opt => opt.value.includes(ivaConfig.codigoSetor));

            if (setorOption) {
                campoSetor.value = setorOption.value;
                marcarCampoComoSped(campoSetor);
                campoSetor.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`IMPORTACAO-CONTROLLER: Setor selecionado: ${setorOption.value}`);
            } else {
                // Preencher campos manualmente se setor não encontrado
                console.log('IMPORTACAO-CONTROLLER: Setor não encontrado, preenchendo campos manualmente');
                preencherCamposIVAManuais(ivaConfig);
            }
        } else {
            preencherCamposIVAManuais(ivaConfig);
        }
    }

    function preencherCamposIVAManuais(ivaConfig) {
        if (!ivaConfig || typeof ivaConfig !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Configuração IVA inválida para preenchimento manual');
            return;
        }

        // Alíquota CBS
        const campoCbs = document.getElementById('aliquota-cbs');
        if (campoCbs && ivaConfig.cbs !== undefined) {
            // Garantir que está em formato percentual (0-100)
            let aliquotaCbs = ivaConfig.cbs;
            if (aliquotaCbs <= 1) {
                aliquotaCbs = aliquotaCbs * 100; // Converter de decimal para percentual
            }

            // Garantir que está entre 0 e 100
            aliquotaCbs = Math.max(0, Math.min(100, aliquotaCbs));

            campoCbs.value = aliquotaCbs.toFixed(1);
            marcarCampoComoSped(campoCbs);
            campoCbs.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Alíquota CBS preenchida: ${aliquotaCbs.toFixed(1)}%`);
        }

        // Alíquota IBS
        const campoIbs = document.getElementById('aliquota-ibs');
        if (campoIbs && ivaConfig.ibs !== undefined) {
            // Garantir que está em formato percentual (0-100)
            let aliquotaIbs = ivaConfig.ibs;
            if (aliquotaIbs <= 1) {
                aliquotaIbs = aliquotaIbs * 100; // Converter de decimal para percentual
            }

            // Garantir que está entre 0 e 100
            aliquotaIbs = Math.max(0, Math.min(100, aliquotaIbs));

            campoIbs.value = aliquotaIbs.toFixed(1);
            marcarCampoComoSped(campoIbs);
            campoIbs.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Alíquota IBS preenchida: ${aliquotaIbs.toFixed(1)}%`);
        }

        // Redução Especial
        const campoReducao = document.getElementById('reducao');
        if (campoReducao && ivaConfig.reducaoEspecial !== undefined) {
            // Garantir que está em formato percentual (0-100)
            let reducao = ivaConfig.reducaoEspecial;
            if (reducao <= 1) {
                reducao = reducao * 100; // Converter de decimal para percentual
            }

            // Garantir que está entre 0 e 100
            reducao = Math.max(0, Math.min(100, reducao));

            campoReducao.value = reducao.toFixed(1);
            marcarCampoComoSped(campoReducao);
            campoReducao.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Redução especial preenchida: ${reducao.toFixed(1)}%`);
        }

        // Categoria IVA
        const campoCategoriaIva = document.getElementById('categoria-iva');
        if (campoCategoriaIva && ivaConfig.categoriaIva) {
            campoCategoriaIva.value = ivaConfig.categoriaIva;
            marcarCampoComoSped(campoCategoriaIva);
            campoCategoriaIva.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Categoria IVA preenchida: ${ivaConfig.categoriaIva}`);
        }

        // Calcular alíquota total
        const campoAliquota = document.getElementById('aliquota');
        if (campoAliquota && ivaConfig.cbs !== undefined && ivaConfig.ibs !== undefined) {
            // Garantir que os valores estão em decimal (0-1)
            let cbs = ivaConfig.cbs;
            if (cbs > 1) cbs = cbs / 100;

            let ibs = ivaConfig.ibs;
            if (ibs > 1) ibs = ibs / 100;

            let reducao = ivaConfig.reducaoEspecial || 0;
            if (reducao > 1) reducao = reducao / 100;

            // Calcular alíquota total
            const aliquotaTotal = (cbs + ibs) * (1 - reducao);

            // Converter para percentual (0-100)
            const aliquotaTotalPerc = aliquotaTotal * 100;

            campoAliquota.value = aliquotaTotalPerc.toFixed(1);
            marcarCampoComoSped(campoAliquota);
            campoAliquota.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Alíquota total calculada: ${aliquotaTotalPerc.toFixed(1)}%`);
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
        limparLog();
        
        adicionarLog('Importação cancelada pelo usuário.', 'info');
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
     * Adiciona uma mensagem à área de log
     */
    function adicionarLog(mensagem, tipo = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp: timestamp,
            tipo: tipo,
            mensagem: mensagem
        };
        
        logImportacao.push(logEntry);
        
        // Atualizar interface de log
        if (elements.logArea) {
            const logItem = document.createElement('p');
            logItem.className = `log-${tipo}`;
            logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> ${mensagem}`;
            
            elements.logArea.appendChild(logItem);
            elements.logArea.scrollTop = elements.logArea.scrollHeight;
        }
        
        // Atualizar estatísticas
        atualizarEstatisticasLog();
        
        // Log no console para debug
        console.log(`IMPORTACAO-CONTROLLER [${tipo.toUpperCase()}]:`, mensagem);
    }
    
    /**
     * Atualiza as estatísticas do log
     */
    function atualizarEstatisticasLog() {
        const stats = {
            total: logImportacao.length,
            success: logImportacao.filter(l => l.tipo === 'success').length,
            warnings: logImportacao.filter(l => l.tipo === 'warning').length,
            errors: logImportacao.filter(l => l.tipo === 'error').length
        };
        
        // Atualizar elementos da interface
        if (elements.statTotal) elements.statTotal.textContent = stats.total;
        if (elements.statSuccess) elements.statSuccess.textContent = stats.success;
        if (elements.statWarnings) elements.statWarnings.textContent = stats.warnings;
        if (elements.statErrors) elements.statErrors.textContent = stats.errors;
        
        // Mostrar/ocultar seção de estatísticas
        if (elements.logStatistics) {
            elements.logStatistics.style.display = stats.total > 0 ? 'block' : 'none';
        }
    }
    
    /**
     * Limpa a área de log
     */
    function limparLog() {
        logImportacao = [];
        
        if (elements.logArea) {
            elements.logArea.innerHTML = '<p class="text-muted">Log limpo pelo usuário.</p>';
        }
        
        atualizarEstatisticasLog();
    }
    
    /**
     * Exporta o log de importação
     */
    function exportarLog() {
        if (logImportacao.length === 0) {
            alert('Não há dados de log para exportar.');
            return;
        }
        
        const logContent = logImportacao.map(entry => 
            `[${entry.timestamp}] ${entry.tipo.toUpperCase()}: ${entry.mensagem}`
        ).join('\n');
        
        const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `log-importacao-sped-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        adicionarLog(`Log exportado com ${logImportacao.length} entradas.`, 'info');
    }
    
    /**
     * Aplica filtros ao log
     */
    function aplicarFiltrosLog() {
        if (!elements.logArea) return;
        
        const filtros = {
            info: elements.filtroInfo?.checked !== false,
            warning: elements.filtroWarning?.checked !== false,
            error: elements.filtroError?.checked !== false,
            success: elements.filtroSuccess?.checked !== false
        };
        
        const logItems = elements.logArea.querySelectorAll('p[class*="log-"]');
        
        logItems.forEach(item => {
            let mostrar = false;
            
            Object.keys(filtros).forEach(tipo => {
                if (item.classList.contains(`log-${tipo}`) && filtros[tipo]) {
                    mostrar = true;
                }
            });
            
            item.style.display = mostrar ? 'block' : 'none';
        });
    }
    
    /**
     * Formata um valor numérico como moeda
     */
    function formatarMoeda(valor) {
        if (isNaN(valor) || valor === null || valor === undefined) {
            valor = 0;
        }

        // Usar CurrencyFormatter se disponível
        if (window.CurrencyFormatter && typeof window.CurrencyFormatter.formatarValorMonetario === 'function') {
            try {
                return window.CurrencyFormatter.formatarValorMonetario(Math.round(valor * 100).toString());
            } catch (erro) {
                console.warn('IMPORTACAO-CONTROLLER: Erro ao usar CurrencyFormatter:', erro);
            }
        }

        // Fallback para formatação padrão
        try {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(valor);
        } catch (erro) {
            console.warn('IMPORTACAO-CONTROLLER: Erro ao formatar moeda:', erro);
            return "R$ " + valor.toFixed(2).replace('.', ',');
        }
    }
    
    // Interface pública
    return {
        inicializar,
        adicionarLog,
        obterDadosImportados: () => dadosImportados,
        limparLog,
        exportarLog,
        versao: '2.0.0-enhanced'
    };
})();

// Garantir carregamento global
if (typeof window !== 'undefined') {
    window.ImportacaoController = ImportacaoController;
    console.log('IMPORTACAO-CONTROLLER: Módulo carregado com sucesso na versão', ImportacaoController.versao);
}