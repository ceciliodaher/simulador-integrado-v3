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
                
                // Armazenar dados importados
                dadosImportados = dadosSimulador;
                window.dadosImportadosSped = dadosImportados; // Global para referência
                
                // Preencher campos do simulador
                preencherCamposSimulador(dadosSimulador);
                
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
                window.SpedParser.processarArquivo(arquivo, tipo)
                    .then(dados => {
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
                        reject(erro);
                    });
            } catch (erro) {
                adicionarLog(`Erro ao processar ${arquivo.name}: ${erro.message}`, 'error');
                reject(erro);
            }
        });
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
                if (dados.debitos?.icms?.length > 0) {
                    const valorICMS = dados.debitos.icms.reduce((sum, d) => sum + (d.valorTotalDebitos || 0), 0);
                    adicionarLog(`ICMS: ${dados.debitos.icms.length} registros, valor total R$ ${valorICMS.toFixed(2)}`, 'info');
                }
                break;

            case 'contribuicoes':
                ['pis', 'cofins'].forEach(imposto => {
                    if (dados.debitos?.[imposto]?.length > 0) {
                        const valor = dados.debitos[imposto].reduce((sum, d) => sum + (d.valorTotalContribuicao || 0), 0);
                        adicionarLog(`${imposto.toUpperCase()}: ${dados.debitos[imposto].length} registros, valor R$ ${valor.toFixed(2)}`, 'info');
                    }
                    
                    if (dados.creditos?.[imposto]?.length > 0) {
                        const valor = dados.creditos[imposto].reduce((sum, c) => sum + (c.valorCredito || 0), 0);
                        adicionarLog(`Créditos ${imposto.toUpperCase()}: ${dados.creditos[imposto].length} registros, valor R$ ${valor.toFixed(2)}`, 'info');
                    }
                });
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
            const objArrayProps = ['impostos', 'creditos', 'debitos', 'ajustes', 'receitasNaoTributadas', 'totalizacao', 'detalhamento'];

            objArrayProps.forEach(prop => {
                if (resultado[prop] && typeof resultado[prop] === 'object') {
                    Object.entries(resultado[prop]).forEach(([categoria, valores]) => {
                        if (!combinado[prop][categoria]) {
                            combinado[prop][categoria] = [];
                        }
                        if (Array.isArray(valores)) {
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
        });

        // Processa relações cruzadas
        // Adicionar após a linha ~472
        processarRelacoesCruzadas(combinado);

        // Debug do balanço patrimonial
        if (window.location.search.includes('debug=true')) {
            diagnosticarBalancoPatrimonial(combinado);
        }

        console.log('IMPORTACAO-CONTROLLER: Resultados combinados:', {
            empresa: !!combinado.empresa.nome,
            documentos: combinado.documentos.length,
            creditos: Object.keys(combinado.creditos).length,
            debitos: Object.keys(combinado.debitos).length
        });

        return combinado;
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
                ivaConfig: dados.ivaConfig ? Object.keys(dados.ivaConfig) : 'Não disponível'
            });

            // Preencher dados da empresa
            if (dados.empresa && elements.importEmpresa?.checked !== false) {
                preencherDadosEmpresa(dados.empresa);
                adicionarLog('Dados da empresa preenchidos com sucesso.', 'success');
            }

            // Preencher parâmetros fiscais
            if (dados.parametrosFiscais && elements.importImpostos?.checked !== false) {
                preencherParametrosFiscais(dados.parametrosFiscais);
                adicionarLog('Parâmetros fiscais preenchidos com sucesso.', 'success');
            }

            // Preencher ciclo financeiro
            if (dados.cicloFinanceiro && elements.importCiclo?.checked !== false) {
                preencherCicloFinanceiro(dados.cicloFinanceiro);
                adicionarLog('Dados do ciclo financeiro preenchidos com sucesso.', 'success');
            }

            // Configurar IVA Dual
            if (dados.ivaConfig) {
                preencherDadosIVADual(dados.ivaConfig);
                adicionarLog('Configurações do IVA Dual preenchidas com sucesso.', 'success');
            }

            // Rolar para a aba de simulação
            setTimeout(() => {
                const abaPrincipal = document.querySelector('.tab-button[data-tab="simulacao"]');
                if (abaPrincipal) {
                    abaPrincipal.click();
                }

                const btnSimular = document.getElementById('btn-simular');
                if (btnSimular) {
                    adicionarLog('Preparação concluída. Você pode clicar em "Simular" para ver os resultados.', 'info');
                }
            }, 1000);

        } catch (erro) {
            adicionarLog('Erro ao preencher campos do simulador: ' + erro.message, 'error');
            console.error('IMPORTACAO-CONTROLLER: Erro ao preencher campos:', erro);
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

        // Nome da empresa
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa && dadosEmpresa.nome) {
            campoEmpresa.value = dadosEmpresa.nome;
            marcarCampoComoSped(campoEmpresa);
        }

        // Faturamento mensal
        const campoFaturamento = document.getElementById('faturamento');
        if (campoFaturamento && dadosEmpresa.faturamento && dadosEmpresa.faturamento > 0) {
            // Validar o valor do faturamento
            const faturamento = validarValorMonetario(dadosEmpresa.faturamento);
            if (faturamento > 0 && faturamento < 1000000000) { // Entre 0 e 1 bilhão
                const valorFormatado = formatarMoeda(faturamento);
                campoFaturamento.value = valorFormatado;

                // Se o campo tem dataset.rawValue (para CurrencyFormatter)
                if (campoFaturamento.dataset) {
                    campoFaturamento.dataset.rawValue = faturamento.toString();
                }

                // Marcar campo como preenchido pelo SPED
                marcarCampoComoSped(campoFaturamento);

                // Disparar evento para recalcular valores dependentes
                campoFaturamento.dispatchEvent(new Event('input', { bubbles: true }));

                console.log(`IMPORTACAO-CONTROLLER: Faturamento preenchido: ${faturamento} (${valorFormatado})`);
            } else {
                console.warn(`IMPORTACAO-CONTROLLER: Faturamento fora dos limites razoáveis: ${faturamento}`);
            }
        }

        // Margem operacional
        const campoMargem = document.getElementById('margem');
        if (campoMargem && dadosEmpresa.margem !== undefined) {
            // Garantir que a margem está em formato percentual (0-100)
            let margem = dadosEmpresa.margem;
            if (margem <= 1) {
                margem = margem * 100; // Converter de decimal para percentual
            }

            // Garantir que a margem está entre 0 e 100
            margem = Math.max(0, Math.min(100, margem));

            campoMargem.value = margem.toFixed(2);
            marcarCampoComoSped(campoMargem);

            // Disparar evento para recalcular valores dependentes
            campoMargem.dispatchEvent(new Event('input', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Margem preenchida: ${margem.toFixed(2)}%`);
        }

        // Tipo de empresa
        const campoTipoEmpresa = document.getElementById('tipo-empresa');
        if (campoTipoEmpresa && dadosEmpresa.tipoEmpresa) {
            campoTipoEmpresa.value = dadosEmpresa.tipoEmpresa;
            marcarCampoComoSped(campoTipoEmpresa);
            campoTipoEmpresa.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Tipo de empresa preenchido: ${dadosEmpresa.tipoEmpresa}`);
        }

        // Regime tributário
        const campoRegime = document.getElementById('regime');
        if (campoRegime && dadosEmpresa.regime) {
            campoRegime.value = dadosEmpresa.regime;
            marcarCampoComoSped(campoRegime);
            campoRegime.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Regime tributário preenchido: ${dadosEmpresa.regime}`);
        }
    }

    // Função auxiliar para validar valores monetários
    function validarValorMonetario(valor) {
        if (typeof valor === 'number') {
            return isNaN(valor) ? 0 : valor;
        }

        if (typeof valor === 'string') {
            // Remover formatação monetária
            const valorLimpo = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
            const valorNumerico = parseFloat(valorLimpo);
            return isNaN(valorNumerico) ? 0 : valorNumerico;
        }

        return 0;
    }
    
    /**
     * Preenche os parâmetros fiscais no formulário
     */
    function preencherParametrosFiscais(parametrosFiscais) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo parâmetros fiscais:', parametrosFiscais);

        if (!parametrosFiscais || typeof parametrosFiscais !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Parâmetros fiscais inválidos');
            return;
        }

        // PRIORIDADE: Preencher composição tributária detalhada
        if (parametrosFiscais.composicaoTributaria) {
            preencherComposicaoTributaria(parametrosFiscais.composicaoTributaria);
        } else {
            console.warn('IMPORTACAO-CONTROLLER: Composição tributária não disponível');
        }

        // Tipo de operação
        const campoTipoOperacao = document.getElementById('tipo-operacao');
        if (campoTipoOperacao && parametrosFiscais.tipoOperacao) {
            campoTipoOperacao.value = parametrosFiscais.tipoOperacao;
            marcarCampoComoSped(campoTipoOperacao);
            campoTipoOperacao.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Tipo de operação preenchido: ${parametrosFiscais.tipoOperacao}`);
        }

        // Regime PIS/COFINS
        const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');
        if (campoPisCofinsRegime && parametrosFiscais.regimePisCofins) {
            campoPisCofinsRegime.value = parametrosFiscais.regimePisCofins;
            marcarCampoComoSped(campoPisCofinsRegime);
            campoPisCofinsRegime.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`IMPORTACAO-CONTROLLER: Regime PIS/COFINS preenchido: ${parametrosFiscais.regimePisCofins}`);
        }

        // Atualizar cálculos dependentes
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

        // Preencher débitos
        Object.keys(debitos).forEach(imposto => {
            const valor = validarValorMonetario(debitos[imposto]);
            if (valor >= 0) {
                preencherCampoComValor(`debito-${imposto}`, valor, 'SPED');
                console.log(`IMPORTACAO-CONTROLLER: Débito ${imposto} preenchido: ${valor}`);
            }
        });

        // Preencher créditos
        Object.keys(creditos).forEach(imposto => {
            const valor = validarValorMonetario(creditos[imposto]);
            if (valor >= 0) {
                preencherCampoComValor(`credito-${imposto}`, valor, 'SPED');
                console.log(`IMPORTACAO-CONTROLLER: Crédito ${imposto} preenchido: ${valor}`);
            }
        });

        // Preencher alíquotas efetivas
        if (aliquotasEfetivas) {
            Object.keys(aliquotasEfetivas).forEach(imposto => {
                let aliquota = aliquotasEfetivas[imposto];

                // Converter de decimal para percentual se necessário
                if (aliquota <= 1) {
                    aliquota = aliquota * 100;
                }

                // Validar alíquota (entre 0 e 100%)
                aliquota = Math.max(0, Math.min(100, aliquota));

                preencherCampoComValor(`aliquota-efetiva-${imposto}`, aliquota, null, 3);
                console.log(`IMPORTACAO-CONTROLLER: Alíquota efetiva ${imposto} preenchida: ${aliquota.toFixed(3)}%`);
            });
        }

        // Calcular e preencher totais
        const totalDebitos = Object.values(debitos).reduce((sum, val) => sum + validarValorMonetario(val), 0);
        const totalCreditos = Object.values(creditos).reduce((sum, val) => sum + validarValorMonetario(val), 0);

        preencherCampoComValor('total-debitos', totalDebitos, 'SPED');
        preencherCampoComValor('total-creditos', totalCreditos, 'SPED');
        console.log(`IMPORTACAO-CONTROLLER: Totais preenchidos - Débitos: ${totalDebitos}, Créditos: ${totalCreditos}`);

        // Adicionar indicadores de fonte
        if (fontesDados) {
            adicionarIndicadoresFonte(fontesDados);
        }
    }
    
    /**
     * Preenche um campo com valor formatado
     */
    function preencherCampoComValor(campoId, valor, fonte = null, decimais = 2) {
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

        // Marcar campo como preenchido pelo SPED
        if (fonte === 'SPED') {
            marcarCampoComoSped(elemento);
        }

        // Disparar evento para atualizar cálculos dependentes
        elemento.dispatchEvent(new Event('input', { bubbles: true }));

        console.log(`IMPORTACAO-CONTROLLER: Campo ${campoId} preenchido com valor ${valorFormatado}`);
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
        Object.entries(fontesDados).forEach(([imposto, fonte]) => {
            const indicador = document.createElement('span');
            indicador.className = `fonte-dados ${fonte}`;
            indicador.textContent = fonte === 'sped' ? 'SPED' : 'EST';
            indicador.title = fonte === 'sped' ? 'Dados extraídos do SPED' : 'Dados estimados';
            indicador.style.cssText = `
                display: inline-block;
                margin-left: 5px;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: bold;
                color: white;
                background-color: ${fonte === 'sped' ? '#28a745' : '#ffc107'};
            `;

            // Adicionar indicador próximo aos campos relevantes
            const campoDebito = document.getElementById(`debito-${imposto}`);
            if (campoDebito && !campoDebito.parentNode.querySelector('.fonte-dados')) {
                campoDebito.parentNode.appendChild(indicador.cloneNode(true));
            }
        });
    }
    
    /**
     * Preenche dados do ciclo financeiro
     */
    function preencherCicloFinanceiro(cicloFinanceiro) {
        console.log('IMPORTACAO-CONTROLLER: Preenchendo ciclo financeiro:', cicloFinanceiro);

        if (!cicloFinanceiro || typeof cicloFinanceiro !== 'object') {
            console.warn('IMPORTACAO-CONTROLLER: Dados de ciclo financeiro inválidos');
            return;
        }

        // PMR - Prazo Médio de Recebimento
        const campoPmr = document.getElementById('pmr');
        if (campoPmr && cicloFinanceiro.pmr !== undefined) {
            // Garantir que é um valor válido
            const pmr = parseInt(cicloFinanceiro.pmr);
            if (!isNaN(pmr) && pmr > 0 && pmr <= 180) { // Entre 1 e 180 dias
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
            // Garantir que é um valor válido
            const pmp = parseInt(cicloFinanceiro.pmp);
            if (!isNaN(pmp) && pmp > 0 && pmp <= 180) { // Entre 1 e 180 dias
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
            // Garantir que é um valor válido
            const pme = parseInt(cicloFinanceiro.pme);
            if (!isNaN(pme) && pme > 0 && pme <= 180) { // Entre 1 e 180 dias
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
            // Garantir que está em formato percentual (0-100)
            let percVista = cicloFinanceiro.percVista;
            if (percVista <= 1) {
                percVista = percVista * 100; // Converter de decimal para percentual
            }

            // Garantir que está entre 0 e 100
            percVista = Math.max(0, Math.min(100, percVista));

            campoPercVista.value = percVista.toFixed(1);
            marcarCampoComoSped(campoPercVista);
            campoPercVista.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`IMPORTACAO-CONTROLLER: Percentual de vendas à vista preenchido: ${percVista.toFixed(1)}%`);
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