/**
 * SpedExtractor - Módulo melhorado para extração de dados do SPED
 * Versão corrigida para integração com o simulador Split Payment
 * VERSÃO CORRIGIDA - Janeiro 2025
 */
const SpedExtractor = (function() {
    
    /**
     * Extrai dados relevantes para o simulador a partir dos dados SPED
     * VERSÃO MELHORADA
     */
    function extrairDadosParaSimulador(dadosSped) {
        if (!dadosSped || typeof dadosSped !== 'object') {
            console.error('SPED-EXTRACTOR: Dados SPED inválidos ou não fornecidos');
            return criarEstruturaVazia();
        }

        console.log('SPED-EXTRACTOR: Iniciando extração de dados para simulador');
        console.log('SPED-EXTRACTOR: Estrutura de dados recebida:', {
            empresa: !!dadosSped.empresa,
            documentos: dadosSped.documentos?.length || 0,
            creditos: Object.keys(dadosSped.creditos || {}).join(', '),
            debitos: Object.keys(dadosSped.debitos || {}).join(', '),
            impostos: Object.keys(dadosSped.impostos || {}).join(', ')
        });

        try {
            const dadosSimulador = {
                empresa: extrairDadosEmpresa(dadosSped),
                parametrosFiscais: extrairParametrosFiscais(dadosSped),
                cicloFinanceiro: extrairCicloFinanceiro(dadosSped),
                ivaConfig: extrairDadosIVA(dadosSped),
                metadados: {
                    fonteDados: 'sped',
                    timestampImportacao: new Date().toISOString(),
                    arquivosProcessados: dadosSped.metadados?.arquivosProcessados || [],
                    qualidadeDados: avaliarQualidadeDados(dadosSped)
                }
            };

            // Validar e normalizar usando DataManager se disponível
            const resultado = window.DataManager ? 
                window.DataManager.validarENormalizar(dadosSimulador) : 
                dadosSimulador;

            console.log('SPED-EXTRACTOR: Extração concluída com sucesso');
            return resultado;

        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro durante extração:', erro);
            return criarEstruturaVazia();
        }
    }

    /**
     * Cria estrutura vazia para casos de erro
     */
    function criarEstruturaVazia() {
        return {
            empresa: {
                nome: '',
                faturamento: 0,
                margem: 0.15,
                tipoEmpresa: 'comercio',
                regime: 'presumido'
            },
            parametrosFiscais: {
                tipoOperacao: 'b2b',
                regimePisCofins: 'cumulativo',
                creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, cbs: 0, ibs: 0 },
                composicaoTributaria: {
                    debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    aliquotasEfetivas: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0, total: 0 }
                }
            },
            cicloFinanceiro: { pmr: 30, pmp: 30, pme: 30, percVista: 0.3, percPrazo: 0.7 },
            ivaConfig: { cbs: 0.088, ibs: 0.177, categoriaIva: 'standard', reducaoEspecial: 0 }
        };
    }

    /**
     * Avalia a qualidade dos dados extraídos
     */
    function avaliarQualidadeDados(dadosSped) {
        const pontuacao = {
            empresa: 0,
            fiscal: 0,
            contabil: 0,
            total: 0
        };

        // Avaliação dados da empresa
        if (dadosSped.empresa?.nome) pontuacao.empresa += 25;
        if (dadosSped.empresa?.cnpj) pontuacao.empresa += 25;
        if (dadosSped.empresa?.faturamento > 0) pontuacao.empresa += 50;

        // Avaliação dados fiscais
        const temCreditos = Object.keys(dadosSped.creditos || {}).length > 0;
        const temDebitos = Object.keys(dadosSped.debitos || {}).length > 0;
        if (temCreditos) pontuacao.fiscal += 30;
        if (temDebitos) pontuacao.fiscal += 30;
        if (dadosSped.documentos?.length > 0) pontuacao.fiscal += 40;

        // Avaliação dados contábeis
        if (dadosSped.balancoPatrimonial?.length > 0) pontuacao.contabil += 50;
        if (dadosSped.demonstracaoResultado?.length > 0) pontuacao.contabil += 50;

        pontuacao.total = Math.round((pontuacao.empresa + pontuacao.fiscal + pontuacao.contabil) / 3);

        return {
            pontuacao: pontuacao,
            classificacao: pontuacao.total >= 80 ? 'excelente' : 
                          pontuacao.total >= 60 ? 'boa' : 
                          pontuacao.total >= 40 ? 'regular' : 'insuficiente'
        };
    }

    /**
     * Extrai dados da empresa com validação aprimorada
     */
    function extrairDadosEmpresa(dadosSped) {
        const empresa = dadosSped.empresa || {};
        
        console.log('SPED-EXTRACTOR: Extraindo dados da empresa:', empresa);

        // Calcular faturamento mensal com múltiplas fontes
        const faturamentoMensal = calcularFaturamentoMensal(dadosSped);
        console.log('SPED-EXTRACTOR: Faturamento mensal calculado:', faturamentoMensal);

        // Calcular margem operacional
        const margemOperacional = calcularMargemOperacional(dadosSped);
        console.log('SPED-EXTRACTOR: Margem operacional calculada:', margemOperacional);

        // Determinar tipo de empresa
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        console.log('SPED-EXTRACTOR: Tipo de empresa determinado:', tipoEmpresa);

        // Determinar regime tributário
        const regimeTributario = determinarRegimeTributario(dadosSped);
        console.log('SPED-EXTRACTOR: Regime tributário determinado:', regimeTributario);

        return {
            nome: empresa.nome || '',
            cnpj: empresa.cnpj || '',
            faturamento: faturamentoMensal,
            margem: margemOperacional,
            tipoEmpresa: tipoEmpresa,
            regime: regimeTributario,
            setor: determinarSetorIVA(dadosSped)
        };
    }

    /**
     * Calcula faturamento mensal com múltiplas fontes de dados
     */
    function calcularFaturamentoMensal(dadosSped) {
        let faturamento = 0;
        let fonte = 'estimado';

        // PRIORIDADE 1: Dados contábeis da ECD/ECF
        if (dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            faturamento = dadosSped.receitaBruta / 12;
            fonte = 'ecd_receita_bruta';
        } else if (dadosSped.dre?.receita_liquida?.valor) {
            faturamento = dadosSped.dre.receita_liquida.valor / 12;
            fonte = 'ecf_dre';
        }

        // PRIORIDADE 2: Cálculo baseado em documentos fiscais
        if (faturamento === 0 && dadosSped.documentos?.length > 0) {
            const resultadoDocumentos = calcularFaturamentoPorDocumentos(dadosSped.documentos);
            faturamento = resultadoDocumentos.faturamentoMensal;
            fonte = 'documentos_fiscais';
        }

        // PRIORIDADE 3: Estimativa baseada em débitos de impostos
        if (faturamento === 0) {
            faturamento = estimarFaturamentoPorImpostos(dadosSped);
            fonte = 'estimativa_impostos';
        }

        console.log(`SPED-EXTRACTOR: Faturamento calculado - Valor: R$ ${faturamento.toFixed(2)}, Fonte: ${fonte}`);
        
        return Math.max(0, faturamento);
    }

    /**
     * Calcula faturamento baseado em documentos fiscais
     */
    function calcularFaturamentoPorDocumentos(documentos) {
        const documentosSaida = documentos.filter(doc => 
            doc.indOper === '1' && // Saída
            doc.situacao === '00' && // Documento regular
            doc.valorTotal > 0
        );

        if (documentosSaida.length === 0) {
            return { faturamentoMensal: 0, periodoAnalise: 0 };
        }

        let faturamentoTotal = 0;
        let dataInicial = null;
        let dataFinal = null;

        documentosSaida.forEach(doc => {
            faturamentoTotal += doc.valorTotal || 0;

            if (doc.dataEmissao) {
                const dataDoc = converterDataSped(doc.dataEmissao);
                if (!dataInicial || dataDoc < dataInicial) dataInicial = dataDoc;
                if (!dataFinal || dataDoc > dataFinal) dataFinal = dataDoc;
            }
        });

        // Calcular período de análise em meses
        let mesesPeriodo = 1;
        if (dataInicial && dataFinal) {
            const diffTime = Math.abs(dataFinal - dataInicial);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            mesesPeriodo = Math.max(1, Math.round(diffDays / 30));
        }

        return {
            faturamentoMensal: faturamentoTotal / mesesPeriodo,
            periodoAnalise: mesesPeriodo,
            totalDocumentos: documentosSaida.length
        };
    }

    /**
     * Converte data do formato SPED (DDMMAAAA) para objeto Date
     */
    function converterDataSped(dataSped) {
        if (!dataSped || dataSped.length !== 8) return new Date();
        
        const dia = parseInt(dataSped.substring(0, 2));
        const mes = parseInt(dataSped.substring(2, 4)) - 1; // Mês em JS é 0-based
        const ano = parseInt(dataSped.substring(4, 8));
        
        return new Date(ano, mes, dia);
    }

    /**
     * Estima faturamento baseado em débitos de impostos
     */
    function estimarFaturamentoPorImpostos(dadosSped) {
        // Tentar usar débitos de PIS/COFINS
        if (dadosSped.debitos?.pis?.length > 0) {
            const debitoPIS = dadosSped.debitos.pis[0].valorTotalContribuicao || 0;
            if (debitoPIS > 0) {
                // Assumindo alíquota média de 0.65% para PIS cumulativo
                return debitoPIS / 0.0065;
            }
        }

        if (dadosSped.debitos?.cofins?.length > 0) {
            const debitoCOFINS = dadosSped.debitos.cofins[0].valorTotalContribuicao || 0;
            if (debitoCOFINS > 0) {
                // Assumindo alíquota média de 3% para COFINS cumulativo
                return debitoCOFINS / 0.03;
            }
        }

        // Tentar usar débitos de ICMS
        if (dadosSped.debitos?.icms?.length > 0) {
            const debitoICMS = dadosSped.debitos.icms[0].valorTotalDebitos || 0;
            if (debitoICMS > 0) {
                // Assumindo alíquota média de 18% para ICMS
                return debitoICMS / 0.18;
            }
        }

        return 0;
    }

    /**
     * Extrai parâmetros fiscais com composição tributária detalhada
     */
    function extrairParametrosFiscais(dadosSped) {
        console.log('SPED-EXTRACTOR: Extraindo parâmetros fiscais');

        const regimeTributario = determinarRegimeTributario(dadosSped);
        const tipoOperacao = determinarTipoOperacao(dadosSped);
        const regimePisCofins = determinarRegimePisCofins(dadosSped);

        // Calcular dados tributários mensais
        const faturamentoMensal = calcularFaturamentoMensal(dadosSped);
        
        const composicaoTributaria = {
            debitos: {
                pis: calcularDebitosPIS(dadosSped, faturamentoMensal),
                cofins: calcularDebitosCOFINS(dadosSped, faturamentoMensal),
                icms: calcularDebitosICMS(dadosSped, faturamentoMensal),
                ipi: calcularDebitosIPI(dadosSped, faturamentoMensal),
                iss: calcularDebitosISS(dadosSped, faturamentoMensal)
            },
            creditos: {
                pis: calcularCreditosPIS(dadosSped),
                cofins: calcularCreditosCOFINS(dadosSped),
                icms: calcularCreditosICMS(dadosSped),
                ipi: calcularCreditosIPI(dadosSped),
                iss: 0 // ISS não gera créditos
            },
            aliquotasEfetivas: {},
            fontesDados: {
                pis: dadosSped.debitos?.pis?.length > 0 ? 'sped' : 'estimado',
                cofins: dadosSped.debitos?.cofins?.length > 0 ? 'sped' : 'estimado',
                icms: dadosSped.debitos?.icms?.length > 0 ? 'sped' : 'estimado',
                ipi: dadosSped.debitos?.ipi?.length > 0 ? 'sped' : 'estimado',
                iss: 'estimado'
            }
        };

        // Calcular alíquotas efetivas
        if (faturamentoMensal > 0) {
            Object.keys(composicaoTributaria.debitos).forEach(imposto => {
                const debito = composicaoTributaria.debitos[imposto];
                const credito = composicaoTributaria.creditos[imposto] || 0;
                const impostoLiquido = Math.max(0, debito - credito);
                composicaoTributaria.aliquotasEfetivas[imposto] = (impostoLiquido / faturamentoMensal) * 100;
            });

            // Calcular alíquota total
            const totalImpostoLiquido = Object.keys(composicaoTributaria.debitos).reduce((total, imposto) => {
                const debito = composicaoTributaria.debitos[imposto];
                const credito = composicaoTributaria.creditos[imposto] || 0;
                return total + Math.max(0, debito - credito);
            }, 0);

            composicaoTributaria.aliquotasEfetivas.total = (totalImpostoLiquido / faturamentoMensal) * 100;
        }

        console.log('SPED-EXTRACTOR: Composição tributária calculada:', composicaoTributaria);

        return {
            tipoOperacao: tipoOperacao,
            regimePisCofins: regimePisCofins,
            regime: regimeTributario,
            composicaoTributaria: composicaoTributaria,
            creditos: composicaoTributaria.creditos // Mantém compatibilidade
        };
    }

    /**
     * Calcula débitos de PIS com múltiplas fontes
     */
    function calcularDebitosPIS(dadosSped, faturamentoMensal) {
        // PRIORIDADE 1: Dados diretos do SPED Contribuições
        if (dadosSped.debitos?.pis?.length > 0) {
            const totalDebitos = dadosSped.debitos.pis.reduce((total, debito) => {
                return total + (debito.valorTotalContribuicao || debito.valorContribuicaoAPagar || 0);
            }, 0);
            
            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos PIS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no regime e faturamento
        if (faturamentoMensal > 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const regimePisCofins = determinarRegimePisCofins(dadosSped);
            
            let aliquotaPIS = 0;
            if (regime === 'simples') {
                return 0; // PIS incluído na alíquota única do Simples
            } else if (regimePisCofins === 'nao-cumulativo') {
                aliquotaPIS = 0.0165; // 1,65%
            } else {
                aliquotaPIS = 0.0065; // 0,65%
            }
            
            const debitoEstimado = faturamentoMensal * aliquotaPIS;
            console.log(`SPED-EXTRACTOR: Débito PIS estimado - Regime: ${regimePisCofins}, Alíquota: ${aliquotaPIS * 100}%, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de COFINS com múltiplas fontes
     */
    function calcularDebitosCOFINS(dadosSped, faturamentoMensal) {
        // PRIORIDADE 1: Dados diretos do SPED Contribuições
        if (dadosSped.debitos?.cofins?.length > 0) {
            const totalDebitos = dadosSped.debitos.cofins.reduce((total, debito) => {
                return total + (debito.valorTotalContribuicao || debito.valorContribuicaoAPagar || 0);
            }, 0);
            
            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos COFINS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no regime e faturamento
        if (faturamentoMensal > 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const regimePisCofins = determinarRegimePisCofins(dadosSped);
            
            let aliquotaCOFINS = 0;
            if (regime === 'simples') {
                return 0; // COFINS incluído na alíquota única do Simples
            } else if (regimePisCofins === 'nao-cumulativo') {
                aliquotaCOFINS = 0.076; // 7,6%
            } else {
                aliquotaCOFINS = 0.03; // 3%
            }
            
            const debitoEstimado = faturamentoMensal * aliquotaCOFINS;
            console.log(`SPED-EXTRACTOR: Débito COFINS estimado - Regime: ${regimePisCofins}, Alíquota: ${aliquotaCOFINS * 100}%, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de ICMS
     */
    function calcularDebitosICMS(dadosSped, faturamentoMensal) {
        // PRIORIDADE 1: Dados diretos do SPED Fiscal
        if (dadosSped.debitos?.icms?.length > 0) {
            const totalDebitos = dadosSped.debitos.icms.reduce((total, debito) => {
                return total + (debito.valorTotalDebitos || 0);
            }, 0);
            
            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos ICMS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            }
        }

        // PRIORIDADE 2: Estimativa para empresas comerciais/industriais
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos' && faturamentoMensal > 0) {
            const aliquotaMedia = 0.18; // 18% como média
            const baseCalculoPercentual = 0.6; // 60% do faturamento sujeito ao ICMS
            
            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ICMS estimado - Tipo: ${tipoEmpresa}, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de IPI
     */
    function calcularDebitosIPI(dadosSped, faturamentoMensal) {
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Dados diretos do SPED Fiscal
        if (dadosSped.impostos?.ipi?.length > 0) {
            const totalDebitos = dadosSped.impostos.ipi.reduce((total, debito) => {
                return total + (debito.valorTotalDebitos || 0);
            }, 0);
            
            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos IPI extraídos do SPED:', totalDebitos);
                return totalDebitos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no faturamento
        if (faturamentoMensal > 0) {
            const aliquotaMedia = 0.10; // 10% como média
            const baseCalculoPercentual = 0.4; // 40% do faturamento sujeito ao IPI
            
            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito IPI estimado - Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de ISS
     */
    function calcularDebitosISS(dadosSped, faturamentoMensal) {
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos') {
            return 0; // ISS só se aplica a serviços
        }

        // ISS não consta no SPED, então sempre estimamos
        if (faturamentoMensal > 0) {
            const aliquotaMedia = 0.05; // 5% como média
            const debitoEstimado = faturamentoMensal * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ISS estimado - Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula créditos de PIS com dados do SPED
     */
    function calcularCreditosPIS(dadosSped) {
        let totalCreditos = 0;

        // PRIORIDADE 1: Registros M100/M105 do SPED Contribuições
        if (dadosSped.creditos?.pis?.length > 0) {
            totalCreditos = dadosSped.creditos.pis.reduce((total, credito) => {
                return total + (credito.valorCredito || 0);
            }, 0);
            
            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos PIS extraídos do SPED:', totalCreditos);
                return totalCreditos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no regime não-cumulativo
        const regimePisCofins = determinarRegimePisCofins(dadosSped);
        if (regimePisCofins === 'nao-cumulativo') {
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;
            const baseCalculoEstimada = faturamentoAnual * 0.6; // 60% do faturamento
            const aliquotaPIS = 0.0165; // 1,65%
            const aproveitamentoEstimado = 0.8; // 80%
            
            const creditoEstimado = (baseCalculoEstimada * aliquotaPIS * aproveitamentoEstimado) / 12;
            console.log(`SPED-EXTRACTOR: Crédito PIS estimado - Regime: ${regimePisCofins}, Valor: ${creditoEstimado}`);
            return creditoEstimado;
        }

        return 0;
    }

    /**
     * Calcula créditos de COFINS com dados do SPED
     */
    function calcularCreditosCOFINS(dadosSped) {
        let totalCreditos = 0;

        // PRIORIDADE 1: Registros M500/M505 do SPED Contribuições
        if (dadosSped.creditos?.cofins?.length > 0) {
            totalCreditos = dadosSped.creditos.cofins.reduce((total, credito) => {
                return total + (credito.valorCredito || 0);
            }, 0);
            
            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos COFINS extraídos do SPED:', totalCreditos);
                return totalCreditos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no regime não-cumulativo
        const regimePisCofins = determinarRegimePisCofins(dadosSped);
        if (regimePisCofins === 'nao-cumulativo') {
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;
            const baseCalculoEstimada = faturamentoAnual * 0.6; // 60% do faturamento
            const aliquotaCOFINS = 0.076; // 7,6%
            const aproveitamentoEstimado = 0.8; // 80%
            
            const creditoEstimado = (baseCalculoEstimada * aliquotaCOFINS * aproveitamentoEstimado) / 12;
            console.log(`SPED-EXTRACTOR: Crédito COFINS estimado - Regime: ${regimePisCofins}, Valor: ${creditoEstimado}`);
            return creditoEstimado;
        }

        return 0;
    }

    /**
     * Calcula créditos de ICMS
     */
    function calcularCreditosICMS(dadosSped) {
        let totalCreditos = 0;

        // PRIORIDADE 1: Dados do SPED Fiscal (E110)
        if (dadosSped.debitos?.icms?.length > 0) {
            totalCreditos = dadosSped.debitos.icms.reduce((total, apuracao) => {
                return total + (apuracao.valorTotalCreditos || 0);
            }, 0);
            
            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos ICMS extraídos do SPED:', totalCreditos);
                return totalCreditos;
            }
        }

        // PRIORIDADE 2: Estimativa para empresas comerciais/industriais
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos') {
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;
            const aliquotaMedia = 0.18; // 18%
            const baseCalculoCompras = faturamentoAnual * 0.7; // 70% do faturamento em compras
            const aproveitamentoICMS = 0.85; // 85% de aproveitamento típico
            
            const creditoEstimado = (baseCalculoCompras * aliquotaMedia * aproveitamentoICMS) / 12;
            console.log(`SPED-EXTRACTOR: Crédito ICMS estimado - Tipo: ${tipoEmpresa}, Valor: ${creditoEstimado}`);
            return creditoEstimado;
        }

        return 0;
    }

    /**
     * Calcula créditos de IPI
     */
    function calcularCreditosIPI(dadosSped) {
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Dados do SPED Fiscal
        if (dadosSped.impostos?.ipi?.length > 0) {
            const totalCreditos = dadosSped.impostos.ipi.reduce((total, apuracao) => {
                return total + (apuracao.valorTotalCreditos || 0);
            }, 0);
            
            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos IPI extraídos do SPED:', totalCreditos);
                return totalCreditos;
            }
        }

        // PRIORIDADE 2: Estimativa baseada no faturamento
        const faturamentoAnual = calcularFaturamentoMensal(dadosSped) * 12;
        const aliquotaMediaIPI = 0.10; // 10%
        const baseCalculoCompras = faturamentoAnual * 0.4; // 40% para matérias-primas
        const aproveitamentoIPI = 0.90; // 90% de aproveitamento
        
        const creditoEstimado = (baseCalculoCompras * aliquotaMediaIPI * aproveitamentoIPI) / 12;
        console.log(`SPED-EXTRACTOR: Crédito IPI estimado - Valor: ${creditoEstimado}`);
        return creditoEstimado;
    }

    /**
     * Determina o regime tributário
     */
    function determinarRegimeTributario(dadosSped) {
        // PRIORIDADE 1: Informação direta da ECF
        if (dadosSped.ecf?.parametros?.formaApuracao) {
            const forma = dadosSped.ecf.parametros.formaApuracao;
            if (['1', '2'].includes(forma)) return 'real';
            if (['3', '4'].includes(forma)) return 'presumido';
            if (['5', '6', '7'].includes(forma)) return 'simples';
        }

        // PRIORIDADE 2: Análise do regime PIS/COFINS
        if (dadosSped.regimes?.pis_cofins) {
            const codigo = dadosSped.regimes.pis_cofins.codigoIncidencia;
            if (codigo === '1') return 'real'; // Exclusivamente não-cumulativo
            if (codigo === '2') return 'presumido'; // Exclusivamente cumulativo
        }

        // PRIORIDADE 3: Verificação de registros específicos
        if (dadosSped.impostos?.simples?.length > 0) {
            return 'simples';
        }

        // PRIORIDADE 4: Análise de créditos PIS/COFINS
        const temCreditosPisCofins = (dadosSped.creditos?.pis?.length > 0 || 
                                     dadosSped.creditos?.cofins?.length > 0);
        
        if (temCreditosPisCofins) {
            return 'real'; // Empresas com créditos geralmente são do Lucro Real
        }

        return 'presumido'; // Padrão mais comum
    }

    /**
     * Determina o regime PIS/COFINS
     */
    function determinarRegimePisCofins(dadosSped) {
        if (dadosSped.regimes?.pis_cofins) {
            const codigo = dadosSped.regimes.pis_cofins.codigoIncidencia;
            if (codigo === '1') return 'nao-cumulativo';
            if (codigo === '2') return 'cumulativo';
            if (codigo === '3') return 'nao-cumulativo'; // Misto, priorizamos não-cumulativo
        }

        // Inferir pelo regime tributário
        const regime = determinarRegimeTributario(dadosSped);
        return regime === 'real' ? 'nao-cumulativo' : 'cumulativo';
    }

    /**
     * Determina o tipo de empresa
     */
    function determinarTipoEmpresa(dadosSped) {
        // Verificação direta de registros de IPI (forte indicativo de indústria)
        if (dadosSped.impostos?.ipi?.length > 0 || dadosSped.debitos?.ipi?.length > 0) {
            return 'industria';
        }

        // Análise dos CFOPs
        const cfops = extrairCFOPs(dadosSped);
        return analisarCFOPs(cfops);
    }

    /**
     * Extrai CFOPs dos documentos
     */
    function extrairCFOPs(dadosSped) {
        const cfops = new Set();
        
        if (dadosSped.itens?.length > 0) {
            dadosSped.itens.forEach(item => {
                if (item.cfop) cfops.add(item.cfop);
            });
        }

        if (dadosSped.itensAnaliticos?.length > 0) {
            dadosSped.itensAnaliticos.forEach(item => {
                if (item.cfop) cfops.add(item.cfop);
            });
        }

        return Array.from(cfops);
    }

    /**
     * Analisa CFOPs para determinar tipo de empresa
     */
    function analisarCFOPs(cfops) {
        const cfopsIndustria = [
            '5101', '5102', '5103', '5104', '5105', '5106', '5109',
            '6101', '6102', '6103', '6104', '6105', '6106', '6109',
            '5124', '5125', '6124', '6125', '5901', '5902', '6901', '6902'
        ];

        const cfopsServicos = [
            '5933', '5932', '5933', '6933', '6932', '9301', '9302',
            '5301', '5302', '5303', '5304', '5305', '5306', '5307',
            '6301', '6302', '6303', '6304', '6305', '6306', '6307'
        ];

        let countIndustria = 0;
        let countServicos = 0;
        let countComercio = 0;

        cfops.forEach(cfop => {
            if (cfopsIndustria.includes(cfop)) {
                countIndustria += 2; // Peso maior para CFOPs industriais
            } else if (cfopsServicos.includes(cfop)) {
                countServicos++;
            } else if (cfop.startsWith('5') || cfop.startsWith('6')) {
                countComercio++;
            }
        });

        if (countIndustria > 0 && countIndustria >= Math.max(countComercio, countServicos)) {
            return 'industria';
        } else if (countServicos > countComercio) {
            return 'servicos';
        } else {
            return 'comercio';
        }
    }

    /**
     * Determina tipo de operação (B2B, B2C, mista)
     */
    function determinarTipoOperacao(dadosSped) {
        if (!dadosSped.documentos?.length) {
            return 'b2b'; // Padrão conservador
        }

        const documentosSaida = dadosSped.documentos.filter(doc => doc.indOper === '1');
        if (documentosSaida.length === 0) return 'b2b';

        let countB2B = 0;
        let countB2C = 0;

        documentosSaida.forEach(doc => {
            if (doc.participante?.cnpjCpf) {
                if (doc.participante.cnpjCpf.length === 14) {
                    countB2B++;
                } else {
                    countB2C++;
                }
            } else if (doc.modelo === '65') { // NFC-e
                countB2C++;
            } else if (doc.modelo === '55') { // NF-e
                countB2B++;
            }
        });

        const totalDocs = countB2B + countB2C;
        if (totalDocs === 0) return 'b2b';

        const percentB2B = (countB2B / totalDocs) * 100;
        
        if (percentB2B > 80) return 'b2b';
        if (percentB2B < 20) return 'b2c';
        return 'mista';
    }

    /**
     * Calcula margem operacional
     */
    function calcularMargemOperacional(dadosSped) {
        // PRIORIDADE 1: Dados da ECD
        if (dadosSped.resultadoOperacional && dadosSped.receitaLiquida && dadosSped.receitaLiquida > 0) {
            return dadosSped.resultadoOperacional / dadosSped.receitaLiquida;
        }

        // PRIORIDADE 2: DRE da ECF
        if (dadosSped.dre?.resultado_operacional?.valor && dadosSped.dre?.receita_liquida?.valor) {
            return dadosSped.dre.resultado_operacional.valor / dadosSped.dre.receita_liquida.valor;
        }

        // PRIORIDADE 3: Estimativa por tipo de empresa
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        const margensPadrao = {
            'comercio': 0.08,    // 8%
            'industria': 0.12,   // 12%
            'servicos': 0.15     // 15%
        };

        return margensPadrao[tipoEmpresa] || 0.1;
    }

    /**
     * Extrai dados do ciclo financeiro
     */
    function extrairCicloFinanceiro(dadosSped) {
        const ciclo = {
            pmr: 30,
            pmp: 30,
            pme: 30,
            percVista: 0.3,
            percPrazo: 0.7
        };

        // Calcular PMR, PMP, PME com base nos dados contábeis
        if (dadosSped.saldoClientes && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            ciclo.pmr = Math.round((dadosSped.saldoClientes / (dadosSped.receitaBruta / 12)) * 30);
            ciclo.pmr = Math.max(1, Math.min(180, ciclo.pmr));
        }

        if (dadosSped.saldoFornecedores && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            const comprasEstimadas = dadosSped.receitaBruta * 0.6;
            ciclo.pmp = Math.round((dadosSped.saldoFornecedores / (comprasEstimadas / 12)) * 30);
            ciclo.pmp = Math.max(1, Math.min(180, ciclo.pmp));
        }

        if (dadosSped.saldoEstoques && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
            const cmvEstimado = dadosSped.receitaBruta * 0.7;
            ciclo.pme = Math.round((dadosSped.saldoEstoques / (cmvEstimado / 12)) * 30);
            ciclo.pme = Math.max(1, Math.min(180, ciclo.pme));
        }

        // Calcular percentual de vendas à vista
        if (dadosSped.documentos?.length > 0) {
            const resultado = analisarVendasVista(dadosSped.documentos);
            ciclo.percVista = resultado.percVista;
            ciclo.percPrazo = 1 - resultado.percVista;
        }

        console.log('SPED-EXTRACTOR: Ciclo financeiro calculado:', ciclo);
        return ciclo;
    }

    /**
     * Analisa percentual de vendas à vista
     */
    function analisarVendasVista(documentos) {
        const documentosSaida = documentos.filter(doc => doc.indOper === '1');
        
        if (documentosSaida.length === 0) {
            return { percVista: 0.3, percPrazo: 0.7 };
        }

        let valorTotalVendas = 0;
        let valorVendasVista = 0;

        documentosSaida.forEach(doc => {
            const valorDoc = doc.valorTotal || 0;
            valorTotalVendas += valorDoc;

            // Critérios para identificar venda à vista
            if (doc.modelo === '65' || doc.condicaoPagamento === '0') {
                valorVendasVista += valorDoc;
            }
        });

        if (valorTotalVendas === 0) {
            return { percVista: 0.3, percPrazo: 0.7 };
        }

        const percVista = Math.max(0.05, Math.min(0.95, valorVendasVista / valorTotalVendas));
        return { percVista: percVista, percPrazo: 1 - percVista };
    }

    /**
     * Extrai dados para configuração IVA
     */
    function extrairDadosIVA(dadosSped) {
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        
        // Mapeamento básico para setores do IVA
        const setorBasico = {
            'comercio': 'comercio',
            'industria': 'industria',
            'servicos': 'servicos'
        }[tipoEmpresa] || 'comercio';

        // Valores padrão para IVA Dual
        return {
            cbs: 0.088,                    // 8,8%
            ibs: 0.177,                    // 17,7%
            categoriaIva: 'standard',
            reducaoEspecial: 0,
            codigoSetor: setorBasico
        };
    }

    // Interface pública
    return {
        extrairDadosParaSimulador,
        versao: '2.0.0-enhanced'
    };
})();

// Garantir carregamento global
if (typeof window !== 'undefined') {
    window.SpedExtractor = SpedExtractor;
    console.log('SPED-EXTRACTOR: Módulo carregado com sucesso na versão', SpedExtractor.versao);
}