/**
 * SpedExtractor - Módulo melhorado para extração de dados do SPED
 * Versão corrigida para integração com o simulador Split Payment
 * VERSÃO CORRIGIDA - Janeiro 2025
 */

/**
 * Converte uma string para valor monetário de forma robusta
 * @param {string|number} valorString - String ou número representando valor monetário
 * @returns {number} - Valor convertido como número
 */
function parseValorMonetario(valorString) {
    // Verificar se valor é válido
    if (!valorString || valorString === '' || valorString === '0' || valorString === 'null') {
        return 0;
    }
    
    try {
        // Se já for um número, retornar diretamente
        if (typeof valorString === 'number') {
            return isNaN(valorString) ? 0 : valorString;
        }
        
        // Converter para string e remover espaços
        let valor = valorString.toString().trim();
        
        // Tratar formato brasileiro: 1.234.567,89
        if (valor.includes(',')) {
            const partes = valor.split(',');
            if (partes.length === 2) {
                // Remover separadores de milhar da parte inteira
                const parteInteira = partes[0].replace(/\./g, '');
                const parteDecimal = partes[1];
                valor = parteInteira + '.' + parteDecimal;
            }
        } else {
            // Se não tem vírgula, verificar se tem pontos
            const pontos = valor.split('.');
            if (pontos.length > 2) {
                // Múltiplos pontos = separadores de milhar
                valor = valor.replace(/\./g, '');
            }
            // Se tem apenas um ponto, pode ser decimal em formato americano
        }
        
        const resultado = parseFloat(valor);
        return isNaN(resultado) ? 0 : resultado;
        
    } catch (erro) {
        console.warn('SPED-EXTRACTOR: Erro ao converter valor monetário:', valorString, erro);
        return 0;
    }
}

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

        // Log detalhado da estrutura recebida para diagnóstico
        console.log('SPED-EXTRACTOR: Estrutura de dados recebida:', {
            empresa: dadosSped.empresa ? Object.keys(dadosSped.empresa) : 'Não disponível',
            documentos: dadosSped.documentos?.length || 0,
            creditos: dadosSped.creditos ? Object.keys(dadosSped.creditos).join(', ') : 'Nenhum',
            debitos: dadosSped.debitos ? Object.keys(dadosSped.debitos).join(', ') : 'Nenhum',
            impostos: dadosSped.impostos ? Object.keys(dadosSped.impostos).join(', ') : 'Nenhum',
            metadados: dadosSped.metadados ? Object.keys(dadosSped.metadados) : 'Nenhum'
        });

        // Analisar alguns documentos para debug
        if (dadosSped.documentos?.length > 0) {
            const amostraDocs = dadosSped.documentos.slice(0, 3);
            console.log('SPED-EXTRACTOR: Amostra de documentos:', JSON.stringify(amostraDocs, null, 2));
        }

        try {
            // Extrair dados da empresa primeiro para debug
            const dadosEmpresa = extrairDadosEmpresa(dadosSped);
            console.log('SPED-EXTRACTOR: Dados da empresa extraídos:', dadosEmpresa);

            // Verificar se o nome da empresa foi extraído corretamente
            if (!dadosEmpresa.nome || dadosEmpresa.nome.length <= 2) {
                console.warn('SPED-EXTRACTOR: Nome da empresa não encontrado ou muito curto, verificando campos alternativos');

                // Tentar extrair nome da empresa de campos alternativos
                if (dadosSped.empresa) {
                    const camposAlternativos = ['nomeEmpresarial', 'nome', 'razaoSocial', 'fantasia'];
                    for (const campo of camposAlternativos) {
                        if (dadosSped.empresa[campo] && dadosSped.empresa[campo].length > 2) {
                            dadosEmpresa.nome = dadosSped.empresa[campo];
                            console.log(`SPED-EXTRACTOR: Nome da empresa extraído do campo alternativo '${campo}': ${dadosEmpresa.nome}`);
                            break;
                        }
                    }
                }
            }

            // Extrair parâmetros fiscais
            const parametrosFiscais = extrairParametrosFiscais(dadosSped);
            console.log('SPED-EXTRACTOR: Parâmetros fiscais extraídos:', 
                Object.keys(parametrosFiscais.composicaoTributaria?.debitos || {})
                    .map(imposto => `${imposto}: ${parametrosFiscais.composicaoTributaria.debitos[imposto]}`)
            );

            // Extrair ciclo financeiro
            const cicloFinanceiro = extrairCicloFinanceiro(dadosSped);
            console.log('SPED-EXTRACTOR: Ciclo financeiro extraído:', cicloFinanceiro);

            // Extrair dados do IVA
            const ivaConfig = extrairDadosIVA(dadosSped);
            console.log('SPED-EXTRACTOR: Configuração IVA extraída:', ivaConfig);

            const dadosSimulador = {
                empresa: dadosEmpresa,
                parametrosFiscais: parametrosFiscais,
                cicloFinanceiro: cicloFinanceiro,
                ivaConfig: ivaConfig,
                metadados: {
                    fonteDados: 'sped',
                    timestampImportacao: new Date().toISOString(),
                    arquivosProcessados: dadosSped.metadados?.arquivosProcessados || [],
                    qualidadeDados: avaliarQualidadeDados(dadosSped)
                }
            };

            // Validar dados extraídos
            const problemas = validarDadosExtraidos(dadosSimulador);
            if (problemas.length > 0) {
                console.warn('SPED-EXTRACTOR: Problemas encontrados nos dados extraídos:', problemas);
                // Não abortar, apenas registrar os problemas
            }

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
     * Valida os dados extraídos para garantir integridade
     * @param {Object} dados - Dados extraídos
     * @returns {Array} - Lista de problemas encontrados
     */
    function validarDadosExtraidos(dados) {
        const problemas = [];

        // Validar empresa
        if (!dados.empresa.nome || dados.empresa.nome.length <= 2) {
            problemas.push('Nome da empresa não encontrado ou inválido');
        }

        if (dados.empresa.faturamento <= 0) {
            problemas.push('Faturamento da empresa não encontrado ou zero');
        }

        // Validar parâmetros fiscais
        const composicao = dados.parametrosFiscais?.composicaoTributaria;
        if (!composicao) {
            problemas.push('Composição tributária não encontrada');
        } else {
            const totalDebitos = Object.values(composicao.debitos || {}).reduce((sum, val) => sum + (val || 0), 0);
            if (totalDebitos <= 0) {
                problemas.push('Nenhum débito tributário encontrado');
            }
        }

        return problemas;
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

        // Verificar a estrutura completa do objeto empresa para debug
        console.log('SPED-EXTRACTOR: Estrutura detalhada do objeto empresa:', JSON.stringify(empresa, null, 2));

        // Garantir que estamos acessando o campo nome correto
        // O SPED EFD-ICMS/IPI armazena em empresa.nomeEmpresarial, enquanto outros SPEDs usam empresa.nome
        const nomeEmpresa = empresa.nomeEmpresarial || empresa.nome || '';

        // Calcular faturamento mensal com múltiplas fontes
        const faturamentoMensal = calcularFaturamentoMensal(dadosSped.documentos || []);
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
            nome: nomeEmpresa,
            cnpj: empresa.cnpj || '',
            faturamento: faturamentoMensal,
            margem: margemOperacional,
            tipoEmpresa: tipoEmpresa,
            regime: regimeTributario,
            setor: determinarSetorIVA(dadosSped)
        };
    }

    // Função para calcular faturamento mensal
    function calcularFaturamentoMensal(documentos) {
        if (!documentos || !Array.isArray(documentos)) {
            console.warn('SPED-EXTRACTOR: Documentos não é um array válido:', documentos);
            return 0;
        }

        let faturamentoTotal = 0;
        let documentosValidos = 0;
        let documentosSaida = 0;

        console.log(`SPED-EXTRACTOR: Analisando ${documentos.length} documentos para cálculo de faturamento...`);

        // Verificar os primeiros documentos para debug
        const amostraDocs = documentos.slice(0, 5);
        console.log('SPED-EXTRACTOR: Amostra dos primeiros documentos:', JSON.stringify(amostraDocs, null, 2));

        for (const doc of documentos) {
            if (!doc || typeof doc !== 'object') {
                continue;
            }

            // Log cada documento para debug
            if (doc.valorTotal > 0) {
                console.log('SPED-EXTRACTOR: Documento com valor encontrado:', {
                    indOper: doc.indOper,
                    valorTotal: doc.valorTotal,
                    dataEmissao: doc.dataEmissao,
                    modelo: doc.modelo
                });
            }

            // Considerar apenas SAÍDAS (vendas) - indOper = '1'
            if (doc.indOper === '1') {
                documentosSaida++;

                if (doc.valorTotal > 0) {
                    faturamentoTotal += doc.valorTotal;
                    documentosValidos++;
                }
            }
        }

        console.log(`SPED-EXTRACTOR: Documentos de saída: ${documentosSaida}`);
        console.log(`SPED-EXTRACTOR: Documentos válidos com valor: ${documentosValidos}`);
        console.log(`SPED-EXTRACTOR: Faturamento total calculado: R$ ${faturamentoTotal.toFixed(2)}`);

        if (documentosValidos === 0) {
            // Tentar método alternativo de cálculo se não encontrou documentos válidos
            const faturamentoAlternativo = calcularFaturamentoPorImpostos(dadosSped);
            if (faturamentoAlternativo > 0) {
                console.log(`SPED-EXTRACTOR: Usando cálculo alternativo de faturamento: R$ ${faturamentoAlternativo.toFixed(2)}`);
                return faturamentoAlternativo;
            }

            console.warn('SPED-EXTRACTOR: Nenhum documento de saída com valor válido encontrado');
            return 0;
        }

        // Retornar o faturamento total
        return faturamentoTotal;
    }

    /**
     * Calcula faturamento baseado em documentos fiscais
     */
    function calcularFaturamentoPorDocumentos(documentos) {
        if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
            console.warn('SPED-EXTRACTOR: Array de documentos inválido ou vazio');
            return { faturamentoMensal: 0, periodoAnalise: 0 };
        }

        // Filtrar apenas documentos de saída (vendas) e válidos
        const documentosSaida = documentos.filter(doc => 
            doc && typeof doc === 'object' &&
            doc.indOper === '1' && // Saída
            (doc.situacao === '00' || !doc.situacao) && // Documento regular ou sem info de situação
            doc.valorTotal > 0
        );

        console.log(`SPED-EXTRACTOR: Encontrados ${documentosSaida.length} documentos de saída válidos de ${documentos.length} total`);

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

            console.log(`SPED-EXTRACTOR: Período de análise: ${dataInicial.toISOString()} a ${dataFinal.toISOString()} (${mesesPeriodo} meses)`);
        }

        const faturamentoMensal = faturamentoTotal / mesesPeriodo;
        console.log(`SPED-EXTRACTOR: Faturamento total: R$ ${faturamentoTotal.toFixed(2)}, Mensal: R$ ${faturamentoMensal.toFixed(2)}`);

        return {
            faturamentoMensal: faturamentoMensal,
            periodoAnalise: mesesPeriodo,
            totalDocumentos: documentosSaida.length,
            faturamentoTotal: faturamentoTotal
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
        console.log('SPED-EXTRACTOR: Estrutura de dados fiscais disponível:', {
            creditos: dadosSped.creditos ? Object.keys(dadosSped.creditos) : 'Nenhum',
            debitos: dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum',
            impostos: dadosSped.impostos ? Object.keys(dadosSped.impostos) : 'Nenhum'
        });

        const regimeTributario = determinarRegimeTributario(dadosSped);
        const tipoOperacao = determinarTipoOperacao(dadosSped);
        const regimePisCofins = determinarRegimePisCofins(dadosSped);

        // Calcular dados tributários mensais
        const faturamentoMensal = calcularFaturamentoMensal(dadosSped.documentos || []);

        // Se não encontrou faturamento pelos documentos, tenta método alternativo
        const faturamentoEfetivo = faturamentoMensal > 0 ? faturamentoMensal : estimarFaturamentoPorImpostos(dadosSped);

        console.log(`SPED-EXTRACTOR: Faturamento efetivo para cálculo de impostos: ${faturamentoEfetivo}`);

        const composicaoTributaria = {
            debitos: {
                pis: calcularDebitosPIS(dadosSped, faturamentoEfetivo),
                cofins: calcularDebitosCOFINS(dadosSped, faturamentoEfetivo),
                icms: calcularDebitosICMS(dadosSped, faturamentoEfetivo),
                ipi: calcularDebitosIPI(dadosSped, faturamentoEfetivo),
                iss: calcularDebitosISS(dadosSped, faturamentoEfetivo)
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

        // Log detalhado dos valores calculados
        console.log('SPED-EXTRACTOR: Composição tributária calculada:', {
            debitosPIS: composicaoTributaria.debitos.pis,
            debitosCOFINS: composicaoTributaria.debitos.cofins,
            debitosICMS: composicaoTributaria.debitos.icms,
            debitosIPI: composicaoTributaria.debitos.ipi,
            debitosISS: composicaoTributaria.debitos.iss,
            creditosPIS: composicaoTributaria.creditos.pis,
            creditosCOFINS: composicaoTributaria.creditos.cofins,
            creditosICMS: composicaoTributaria.creditos.icms,
            creditosIPI: composicaoTributaria.creditos.ipi
        });

        // Calcular alíquotas efetivas
        if (faturamentoEfetivo > 0) {
            Object.keys(composicaoTributaria.debitos).forEach(imposto => {
                const debito = composicaoTributaria.debitos[imposto];
                const credito = composicaoTributaria.creditos[imposto] || 0;
                const impostoLiquido = Math.max(0, debito - credito);
                composicaoTributaria.aliquotasEfetivas[imposto] = (impostoLiquido / faturamentoEfetivo) * 100;
            });

            // Calcular alíquota total
            const totalImpostoLiquido = Object.keys(composicaoTributaria.debitos).reduce((total, imposto) => {
                const debito = composicaoTributaria.debitos[imposto];
                const credito = composicaoTributaria.creditos[imposto] || 0;
                return total + Math.max(0, debito - credito);
            }, 0);

            composicaoTributaria.aliquotasEfetivas.total = (totalImpostoLiquido / faturamentoEfetivo) * 100;

            console.log('SPED-EXTRACTOR: Alíquotas efetivas calculadas:', composicaoTributaria.aliquotasEfetivas);
        } else {
            console.warn('SPED-EXTRACTOR: Faturamento zero, não foi possível calcular alíquotas efetivas');
        }

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
        console.log('SPED-EXTRACTOR: Calculando débitos PIS');
        console.log('SPED-EXTRACTOR: Estrutura de débitos disponível:', dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum');

        // PRIORIDADE 1: Dados diretos do SPED Contribuições
        if (dadosSped.debitos?.pis?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.pis.length} registros de débitos PIS`);

            // Debug dos primeiros registros
            const amostraDebitos = dadosSped.debitos.pis.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de débitos PIS:', JSON.stringify(amostraDebitos, null, 2));

            const totalDebitos = dadosSped.debitos.pis.reduce((total, debito) => {
                const valor = debito.valorTotalContribuicao || debito.valorContribuicaoAPagar || 0;
                console.log(`SPED-EXTRACTOR: Registro débito PIS com valor: ${valor}`);
                return total + valor;
            }, 0);

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos PIS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de débitos PIS encontrados, mas valor total é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de débito PIS encontrado');
        }

        // PRIORIDADE 2: Verificar totalizações específicas de M200/M600
        if (dadosSped.debitos?.m200?.length > 0) {
            const valorM200 = dadosSped.debitos.m200.reduce((total, reg) => 
                total + (reg.valorContribuicaoAPagar || reg.valorTotalContribuicao || 0), 0);

            if (valorM200 > 0) {
                console.log('SPED-EXTRACTOR: Débito PIS extraído do registro M200:', valorM200);
                return valorM200;
            }
        }

        // PRIORIDADE 3: Estimativa baseada no regime e faturamento
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
        console.log('SPED-EXTRACTOR: Calculando débitos COFINS');
        console.log('SPED-EXTRACTOR: Estrutura de débitos disponível:', dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum');

        // PRIORIDADE 1: Dados diretos do SPED Contribuições
        if (dadosSped.debitos?.cofins?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.cofins.length} registros de débitos COFINS`);

            // Debug dos primeiros registros
            const amostraDebitos = dadosSped.debitos.cofins.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de débitos COFINS:', JSON.stringify(amostraDebitos, null, 2));

            const totalDebitos = dadosSped.debitos.cofins.reduce((total, debito) => {
                const valor = debito.valorTotalContribuicao || debito.valorContribuicaoAPagar || 0;
                console.log(`SPED-EXTRACTOR: Registro débito COFINS com valor: ${valor}`);
                return total + valor;
            }, 0);

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos COFINS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de débitos COFINS encontrados, mas valor total é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de débito COFINS encontrado');
        }

        // PRIORIDADE 2: Verificar totalizações específicas de M600
        if (dadosSped.debitos?.m600?.length > 0) {
            const valorM600 = dadosSped.debitos.m600.reduce((total, reg) => 
                total + (reg.valorContribuicaoAPagar || reg.valorTotalContribuicao || 0), 0);

            if (valorM600 > 0) {
                console.log('SPED-EXTRACTOR: Débito COFINS extraído do registro M600:', valorM600);
                return valorM600;
            }
        }

        // PRIORIDADE 3: Estimativa baseada no regime e faturamento
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
        console.log('SPED-EXTRACTOR: Calculando débitos ICMS');
        console.log('SPED-EXTRACTOR: Estrutura de débitos disponível:', dadosSped.debitos ? Object.keys(dadosSped.debitos) : 'Nenhum');

        // PRIORIDADE 1: Dados diretos do SPED Fiscal
        if (dadosSped.debitos?.icms?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.icms.length} registros de débitos ICMS`);

            // Debug dos primeiros registros
            const amostraDebitos = dadosSped.debitos.icms.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de débitos ICMS:', JSON.stringify(amostraDebitos, null, 2));

            const totalDebitos = dadosSped.debitos.icms.reduce((total, debito) => {
                const valor = debito.valorTotalDebitos || debito.valorSaldoAPagar || 0;
                console.log(`SPED-EXTRACTOR: Registro débito ICMS com valor: ${valor}`);
                return total + valor;
            }, 0);

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos ICMS extraídos do SPED:', totalDebitos);
                return totalDebitos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de débitos ICMS encontrados, mas valor total é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de débito ICMS encontrado');
        }

        // PRIORIDADE 2: Verificar registros E110 ou equivalentes
        if (dadosSped.impostos?.icms?.length > 0) {
            const valorE110 = dadosSped.impostos.icms.reduce((total, reg) => 
                total + (reg.valorTotalDebitos || reg.valorSaldoAPagar || 0), 0);

            if (valorE110 > 0) {
                console.log('SPED-EXTRACTOR: Débito ICMS extraído dos registros de impostos:', valorE110);
                return valorE110;
            }
        }

        // PRIORIDADE 3: Estimativa para empresas comerciais/industriais
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos' && faturamentoMensal > 0) {
            let aliquotaMedia = 0.18; // 18% como média

            // Ajuste da alíquota com base na UF da empresa
            if (dadosSped.empresa?.uf) {
                const uf = dadosSped.empresa.uf.toUpperCase();
                const aliquotasPorUf = {
                     'AC': 0.19, // Acre
                      'AL': 0.19, // Alagoas
                      'AP': 0.18, // Amapá
                      'AM': 0.20, // Amazonas
                      'BA': 0.19, // Bahia
                      'CE': 0.18, // Ceará
                      'DF': 0.18, // Distrito Federal
                      'ES': 0.17, // Espírito Santo
                      'GO': 0.17, // Goiás
                      'MA': 0.20, // Maranhão
                      'MT': 0.19, // Mato Grosso
                      'MS': 0.17, // Mato Grosso do Sul
                      'MG': 0.18, // Minas Gerais
                      'PA': 0.19, // Pará
                      'PB': 0.18, // Paraíba
                      'PR': 0.19, // Paraná
                      'PE': 0.18, // Pernambuco
                      'PI': 0.18, // Piauí
                      'RJ': 0.20, // Rio de Janeiro
                      'RN': 0.20, // Rio Grande do Norte
                      'RS': 0.19, // Rio Grande do Sul
                      'RO': 0.18, // Rondônia
                      'RR': 0.20, // Roraima
                      'SC': 0.17, // Santa Catarina
                      'SP': 0.18, // São Paulo
                      'SE': 0.18, // Sergipe
                      'TO': 0.18  // Tocantins
                };

                if (aliquotasPorUf[uf]) {
                    aliquotaMedia = aliquotasPorUf[uf];
                    console.log(`SPED-EXTRACTOR: Ajustando alíquota ICMS para UF ${uf}: ${aliquotaMedia * 100}%`);
                }
            }

            const baseCalculoPercentual = 0.6; // 60% do faturamento sujeito ao ICMS

            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ICMS estimado - Tipo: ${tipoEmpresa}, Alíquota: ${aliquotaMedia * 100}%, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de IPI
     */
    function calcularDebitosIPI(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos IPI');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é indústria, débito IPI = 0');
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Dados diretos do SPED Fiscal
        if (dadosSped.impostos?.ipi?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.impostos.ipi.length} registros de IPI`);

            // Debug dos primeiros registros
            const amostraIpi = dadosSped.impostos.ipi.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de registros IPI:', JSON.stringify(amostraIpi, null, 2));

            const totalDebitos = dadosSped.impostos.ipi.reduce((total, debito) => {
                const valor = debito.valorTotalDebitos || 0;
                console.log(`SPED-EXTRACTOR: Registro débito IPI com valor: ${valor}`);
                return total + valor;
            }, 0);

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos IPI extraídos do SPED:', totalDebitos);
                return totalDebitos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de IPI encontrados, mas valor total de débitos é zero');
            }
        }

        // PRIORIDADE 2: Verificar registros E210 ou equivalentes
        if (dadosSped.debitos?.ipi?.length > 0) {
            const valorE210 = dadosSped.debitos.ipi.reduce((total, reg) => 
                total + (reg.valorTotalDebitos || reg.valorTotalAPagar || 0), 0);

            if (valorE210 > 0) {
                console.log('SPED-EXTRACTOR: Débito IPI extraído dos registros de débitos:', valorE210);
                return valorE210;
            }
        }

        // PRIORIDADE 3: Estimativa baseada no faturamento
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
        console.log('SPED-EXTRACTOR: Calculando débitos ISS');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é serviços, débito ISS = 0');
            return 0; // ISS só se aplica a serviços
        }

        // ISS não consta no SPED, verificar se há alguma fonte alternativa
        if (dadosSped.impostos?.iss?.length > 0) {
            const totalIss = dadosSped.impostos.iss.reduce((total, registro) => 
                total + (registro.valorIss || registro.valorTotal || 0), 0);

            if (totalIss > 0) {
                console.log('SPED-EXTRACTOR: Valores de ISS encontrados em registros específicos:', totalIss);
                return totalIss;
            }
        }

        // Verificar se há registros A100 (serviços) no SPED Contribuições
        let baseCalculoServicos = 0;
        if (dadosSped.detalhamento?.receita_servico?.length > 0) {
            baseCalculoServicos = dadosSped.detalhamento.receita_servico.reduce((total, serv) => 
                total + (serv.valorOperacao || serv.valorServico || 0), 0);

            console.log('SPED-EXTRACTOR: Base de cálculo de serviços encontrada:', baseCalculoServicos);
        }

        // Estimativa por faturamento se não houver informação específica
        if (faturamentoMensal > 0) {
            // Utilizar base de cálculo específica de serviços se disponível
            const baseCalculo = baseCalculoServicos > 0 ? baseCalculoServicos : faturamentoMensal;

            // Tentar determinar a alíquota com base no município
            let aliquotaMedia = 0.05; // 5% como padrão

            // Ajustar alíquota para municípios conhecidos se disponível
            if (dadosSped.empresa?.codMunicipio) {
                const codMunicipio = dadosSped.empresa.codMunicipio;
                // Alguns exemplos de alíquotas municipais
                const aliquotasPorMunicipio = {
                    '3550308': 0.05, // São Paulo-SP
                    '3304557': 0.05, // Rio de Janeiro-RJ
                    '5300108': 0.05, // Brasília-DF
                    '2611606': 0.05, // Recife-PE
                    '4106902': 0.05  // Curitiba-PR
                    // Adicionar outros conforme necessário
                };

                if (aliquotasPorMunicipio[codMunicipio]) {
                    aliquotaMedia = aliquotasPorMunicipio[codMunicipio];
                    console.log(`SPED-EXTRACTOR: Ajustando alíquota ISS para município ${codMunicipio}: ${aliquotaMedia * 100}%`);
                }
            }

            const debitoEstimado = baseCalculo * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ISS estimado - Base: ${baseCalculo}, Alíquota: ${aliquotaMedia * 100}%, Valor: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula créditos de PIS com dados do SPED
     */
    function calcularCreditosPIS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos PIS');
        console.log('SPED-EXTRACTOR: Estrutura de créditos disponível:', dadosSped.creditos ? Object.keys(dadosSped.creditos) : 'Nenhum');

        let totalCreditos = 0;

        // PRIORIDADE 1: Registros M100/M105 do SPED Contribuições
        if (dadosSped.creditos?.pis?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.creditos.pis.length} registros de créditos PIS`);

            // Debug dos primeiros registros
            const amostraCreditos = dadosSped.creditos.pis.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de créditos PIS:', JSON.stringify(amostraCreditos, null, 2));

            totalCreditos = dadosSped.creditos.pis.reduce((total, credito) => {
                const valor = credito.valorCredito || credito.valorCreditoDisp || 0;
                console.log(`SPED-EXTRACTOR: Registro crédito PIS com valor: ${valor}`);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos PIS extraídos do SPED:', totalCreditos);
                return totalCreditos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de créditos PIS encontrados, mas valor total é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de crédito PIS encontrado');
        }

        // PRIORIDADE 2: Verificar outras estruturas de crédito
        if (dadosSped.detalhamento?.credito_pis?.length > 0) {
            const valorCreditos = dadosSped.detalhamento.credito_pis.reduce((total, cred) => 
                total + (cred.valorCredito || cred.valorCreditoDisp || 0), 0);

            if (valorCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos PIS encontrados em estrutura alternativa:', valorCreditos);
                return valorCreditos;
            }
        }

        // PRIORIDADE 3: Estimativa baseada no regime não-cumulativo
        const regimePisCofins = determinarRegimePisCofins(dadosSped);
        if (regimePisCofins === 'nao-cumulativo') {
            // Tentar estimar com base no faturamento
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped.documentos || []) * 12;

            if (faturamentoAnual > 0) {
                const baseCalculoEstimada = faturamentoAnual * 0.6; // 60% do faturamento
                const aliquotaPIS = 0.0165; // 1,65%
                const aproveitamentoEstimado = 0.8; // 80%

                const creditoEstimado = (baseCalculoEstimada * aliquotaPIS * aproveitamentoEstimado) / 12;
                console.log(`SPED-EXTRACTOR: Crédito PIS estimado - Regime: ${regimePisCofins}, Base: ${baseCalculoEstimada}, Valor: ${creditoEstimado}`);
                return creditoEstimado;
            }
        } else {
            console.log(`SPED-EXTRACTOR: Regime PIS/COFINS é ${regimePisCofins}, não gera créditos ou gera créditos reduzidos`);
        }

        return 0;
    }

    /**
     * Calcula créditos de COFINS com dados do SPED
     */
    function calcularCreditosCOFINS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos COFINS');
        console.log('SPED-EXTRACTOR: Estrutura de créditos disponível:', dadosSped.creditos ? Object.keys(dadosSped.creditos) : 'Nenhum');

        let totalCreditos = 0;

        // PRIORIDADE 1: Registros M500/M505 do SPED Contribuições
        if (dadosSped.creditos?.cofins?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.creditos.cofins.length} registros de créditos COFINS`);

            // Debug dos primeiros registros
            const amostraCreditos = dadosSped.creditos.cofins.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de créditos COFINS:', JSON.stringify(amostraCreditos, null, 2));

            totalCreditos = dadosSped.creditos.cofins.reduce((total, credito) => {
                const valor = credito.valorCredito || credito.valorCreditoDisp || 0;
                console.log(`SPED-EXTRACTOR: Registro crédito COFINS com valor: ${valor}`);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos COFINS extraídos do SPED:', totalCreditos);
                return totalCreditos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de créditos COFINS encontrados, mas valor total é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de crédito COFINS encontrado');
        }

        // PRIORIDADE 2: Verificar outras estruturas de crédito
        if (dadosSped.detalhamento?.credito_cofins?.length > 0) {
            const valorCreditos = dadosSped.detalhamento.credito_cofins.reduce((total, cred) => 
                total + (cred.valorCredito || cred.valorCreditoDisp || 0), 0);

            if (valorCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos COFINS encontrados em estrutura alternativa:', valorCreditos);
                return valorCreditos;
            }
        }

        // PRIORIDADE 3: Estimativa baseada no regime não-cumulativo
        const regimePisCofins = determinarRegimePisCofins(dadosSped);
        if (regimePisCofins === 'nao-cumulativo') {
            // Tentar estimar com base no faturamento
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped.documentos || []) * 12;

            if (faturamentoAnual > 0) {
                const baseCalculoEstimada = faturamentoAnual * 0.6; // 60% do faturamento
                const aliquotaCOFINS = 0.076; // 7,6%
                const aproveitamentoEstimado = 0.8; // 80%

                const creditoEstimado = (baseCalculoEstimada * aliquotaCOFINS * aproveitamentoEstimado) / 12;
                console.log(`SPED-EXTRACTOR: Crédito COFINS estimado - Regime: ${regimePisCofins}, Base: ${baseCalculoEstimada}, Valor: ${creditoEstimado}`);
                return creditoEstimado;
            }
        } else {
            console.log(`SPED-EXTRACTOR: Regime PIS/COFINS é ${regimePisCofins}, não gera créditos ou gera créditos reduzidos`);
        }

        return 0;
    }

    /**
     * Calcula créditos de ICMS
     */
    function calcularCreditosICMS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos ICMS');
        let totalCreditos = 0;

        // PRIORIDADE 1: Dados do SPED Fiscal (E110)
        if (dadosSped.debitos?.icms?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.debitos.icms.length} registros de apuração ICMS`);

            // Debug dos primeiros registros
            const amostraApuracoes = dadosSped.debitos.icms.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de apurações ICMS:', JSON.stringify(amostraApuracoes, null, 2));

            totalCreditos = dadosSped.debitos.icms.reduce((total, apuracao) => {
                const valor = apuracao.valorTotalCreditos || 0;
                console.log(`SPED-EXTRACTOR: Registro apuração ICMS com crédito: ${valor}`);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos ICMS extraídos do SPED:', totalCreditos);
                return totalCreditos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de apuração ICMS encontrados, mas valor total de créditos é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de apuração ICMS encontrado');
        }

        // PRIORIDADE 2: Verificar registros de créditos específicos
        if (dadosSped.creditos?.icms?.length > 0) {
            const valorCreditos = dadosSped.creditos.icms.reduce((total, cred) => 
                total + (cred.valorCredito || cred.valorTotalCreditos || 0), 0);

            if (valorCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos ICMS encontrados em registros específicos:', valorCreditos);
                return valorCreditos;
            }
        }

        // PRIORIDADE 3: Verificar registros de compras (documentos de entrada)
        let creditosDocumentos = 0;
        if (dadosSped.documentos?.length > 0) {
            // Filtrar documentos de entrada com ICMS
            const documentosEntrada = dadosSped.documentos.filter(doc => 
                doc && doc.indOper === '0' && doc.valorTotal > 0
            );

            console.log(`SPED-EXTRACTOR: Encontrados ${documentosEntrada.length} documentos de entrada para análise de créditos ICMS`);

            if (documentosEntrada.length > 0) {
                // Tentar estimar créditos com base nos documentos
                // Se houver itens com valores de ICMS, usar a soma
                if (dadosSped.itensAnaliticos?.length > 0) {
                    const itensEntrada = dadosSped.itensAnaliticos.filter(item => 
                        item && item.valorIcms > 0 && (
                            item.cfop?.startsWith('1') || 
                            item.cfop?.startsWith('2') || 
                            item.cfop?.startsWith('3')
                        )
                    );

                    if (itensEntrada.length > 0) {
                        creditosDocumentos = itensEntrada.reduce((total, item) => 
                            total + (item.valorIcms || 0), 0);

                        console.log(`SPED-EXTRACTOR: Créditos ICMS calculados a partir de ${itensEntrada.length} itens de entrada: ${creditosDocumentos}`);

                        if (creditosDocumentos > 0) {
                            return creditosDocumentos;
                        }
                    }
                }
            }
        }

        // PRIORIDADE 4: Estimativa para empresas comerciais/industriais
        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'servicos') {
            const faturamentoAnual = calcularFaturamentoMensal(dadosSped.documentos || []) * 12;

            if (faturamentoAnual > 0) {
                const aliquotaMedia = 0.18; // 18%
                const baseCalculoCompras = faturamentoAnual * 0.7; // 70% do faturamento em compras
                const aproveitamentoICMS = 0.85; // 85% de aproveitamento típico

                const creditoEstimado = (baseCalculoCompras * aliquotaMedia * aproveitamentoICMS) / 12;
                console.log(`SPED-EXTRACTOR: Crédito ICMS estimado - Tipo: ${tipoEmpresa}, Base: ${baseCalculoCompras}, Valor: ${creditoEstimado}`);
                return creditoEstimado;
            }
        } else {
            console.log('SPED-EXTRACTOR: Empresa de serviços, créditos de ICMS tipicamente não aplicáveis');
        }

        return 0;
    }

    /**
     * Calcula créditos de IPI
     */
    function calcularCreditosIPI(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos IPI');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é indústria, crédito IPI = 0');
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Dados do SPED Fiscal
        if (dadosSped.impostos?.ipi?.length > 0) {
            console.log(`SPED-EXTRACTOR: Encontrados ${dadosSped.impostos.ipi.length} registros de IPI`);

            // Debug dos primeiros registros
            const amostraIpi = dadosSped.impostos.ipi.slice(0, 2);
            console.log('SPED-EXTRACTOR: Amostra de registros IPI:', JSON.stringify(amostraIpi, null, 2));

            const totalCreditos = dadosSped.impostos.ipi.reduce((total, apuracao) => {
                const valor = apuracao.valorTotalCreditos || 0;
                console.log(`SPED-EXTRACTOR: Registro IPI com crédito: ${valor}`);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos IPI extraídos do SPED:', totalCreditos);
                return totalCreditos;
            } else {
                console.log('SPED-EXTRACTOR: Registros de IPI encontrados, mas valor total de créditos é zero');
            }
        } else {
            console.log('SPED-EXTRACTOR: Nenhum registro de IPI encontrado');
        }

        // PRIORIDADE 2: Verificar registros de créditos específicos
        if (dadosSped.creditos?.ipi?.length > 0) {
            const valorCreditos = dadosSped.creditos.ipi.reduce((total, cred) => 
                total + (cred.valorCredito || cred.valorTotalCreditos || 0), 0);

            if (valorCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos IPI encontrados em registros específicos:', valorCreditos);
                return valorCreditos;
            }
        }

        // PRIORIDADE 3: Verificar registros de documentos de entrada
        let creditosDocumentos = 0;
        if (dadosSped.documentos?.length > 0) {
            // Filtrar documentos de entrada com IPI
            const documentosEntrada = dadosSped.documentos.filter(doc => 
                doc && doc.indOper === '0' && doc.valorTotal > 0
            );

            if (documentosEntrada.length > 0 && dadosSped.itensAnaliticos?.length > 0) {
                // Tentar estimar créditos com base nos documentos
                const itensEntrada = dadosSped.itensAnaliticos.filter(item => 
                    item && item.valorIpi > 0 && (
                        item.cfop?.startsWith('1') || 
                        item.cfop?.startsWith('2') || 
                        item.cfop?.startsWith('3')
                    )
                );

                if (itensEntrada.length > 0) {
                    creditosDocumentos = itensEntrada.reduce((total, item) => 
                        total + (item.valorIpi || 0), 0);

                    console.log(`SPED-EXTRACTOR: Créditos IPI calculados a partir de ${itensEntrada.length} itens de entrada: ${creditosDocumentos}`);

                    if (creditosDocumentos > 0) {
                        return creditosDocumentos;
                    }
                }
            }
        }

        // PRIORIDADE 4: Estimativa baseada no faturamento
        const faturamentoAnual = calcularFaturamentoMensal(dadosSped.documentos || []) * 12;

        if (faturamentoAnual > 0) {
            const aliquotaMediaIPI = 0.10; // 10%
            const baseCalculoCompras = faturamentoAnual * 0.4; // 40% para matérias-primas
            const aproveitamentoIPI = 0.90; // 90% de aproveitamento

            const creditoEstimado = (baseCalculoCompras * aliquotaMediaIPI * aproveitamentoIPI) / 12;
            console.log(`SPED-EXTRACTOR: Crédito IPI estimado - Base: ${baseCalculoCompras}, Valor: ${creditoEstimado}`);
            return creditoEstimado;
        }

        return 0;
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
     * Determina o setor IVA da empresa baseado nos dados SPED
     * @param {Object} dadosEmpresa - Dados da empresa extraídos do SPED
     * @param {Object} dadosFiscais - Dados fiscais extraídos
     * @returns {Object} Configuração do setor IVA
     */
    function determinarSetorIVA(dadosEmpresa, dadosFiscais) {
        // Configurações padrão do IVA
        const configuracaoPadrao = {
            codigoSetor: 'standard',
            categoriaIva: 'standard',
            cbs: 0.088, // 8,8% - alíquota padrão CBS
            ibs: 0.177, // 17,7% - alíquota padrão IBS
            reducaoEspecial: 0,
            fonteClassificacao: 'automatica'
        };

        try {
            // Se não há dados suficientes, retornar configuração padrão
            if (!dadosEmpresa || !dadosFiscais) {
                console.warn('SPED-EXTRACTOR: Dados insuficientes para determinação do setor IVA. Usando configuração padrão.');
                return configuracaoPadrao;
            }

            // Analisar CNAE principal se disponível
            if (dadosEmpresa.cnae) {
                const setorPorCnae = classificarSetorPorCnae(dadosEmpresa.cnae);
                if (setorPorCnae) {
                    return {
                        ...configuracaoPadrao,
                        ...setorPorCnae,
                        codigoSetor: setorPorCnae.codigo,
                        fonteClassificacao: 'cnae'
                    };
                }
            }

            // Analisar tipo de empresa se disponível
            if (dadosEmpresa.tipoEmpresa) {
                const setorPorTipo = classificarSetorPorTipo(dadosEmpresa.tipoEmpresa);
                if (setorPorTipo) {
                    return {
                        ...configuracaoPadrao,
                        ...setorPorTipo,
                        fonteClassificacao: 'tipo_empresa'
                    };
                }
            }

            // Analisar composição tributária para inferir setor
            if (dadosFiscais.composicaoTributaria) {
                const setorPorTributacao = classificarSetorPorTributacao(dadosFiscais.composicaoTributaria);
                if (setorPorTributacao) {
                    return {
                        ...configuracaoPadrao,
                        ...setorPorTributacao,
                        fonteClassificacao: 'tributacao'
                    };
                }
            }

            console.log('SPED-EXTRACTOR: Não foi possível determinar setor específico. Usando configuração padrão.');
            return configuracaoPadrao;

        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao determinar setor IVA:', erro);
            return configuracaoPadrao;
        }
    }

    /**
     * Classifica setor baseado no CNAE
     * @param {string} cnae - Código CNAE principal
     * @returns {Object|null} Configuração específica do setor
     */
    function classificarSetorPorCnae(cnae) {
        if (!cnae) return null;

        const codigoCnae = cnae.replace(/[^0-9]/g, '').substring(0, 4);

        // Setores com tratamento diferenciado
        const setoresEspeciais = {
            // Agronegócio (01xx-03xx)
            agronegocio: {
                codigo: 'agronegocio',
                categoria: 'agronegocio',
                cbs: 0.088,
                ibs: 0.088, // Redução significativa para agronegócio
                reducaoEspecial: 0.6,
                pattern: /^(01|02|03)/
            },
            // Indústria (05xx-33xx)
            industria: {
                codigo: 'industria',
                categoria: 'industria',
                cbs: 0.088,
                ibs: 0.155, // Redução moderada
                reducaoEspecial: 0.2,
                pattern: /^(05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33)/
            },
            // Serviços de saúde (86xx)
            saude: {
                codigo: 'saude',
                categoria: 'saude',
                cbs: 0.088,
                ibs: 0.088, // Redução significativa
                reducaoEspecial: 0.5,
                pattern: /^86/
            },
            // Educação (85xx)
            educacao: {
                codigo: 'educacao',
                categoria: 'educacao',
                cbs: 0.088,
                ibs: 0.088, // Redução significativa
                reducaoEspecial: 0.5,
                pattern: /^85/
            }
        };

        for (const [nomeSetor, config] of Object.entries(setoresEspeciais)) {
            if (config.pattern.test(codigoCnae)) {
                console.log(`SPED-EXTRACTOR: Setor identificado por CNAE: ${nomeSetor} (${cnae})`);
                return {
                    codigo: config.codigo,
                    categoriaIva: config.categoria,
                    cbs: config.cbs,
                    ibs: config.ibs,
                    reducaoEspecial: config.reducaoEspecial
                };
            }
        }

        return null;
    }

    /**
     * Classifica setor baseado no tipo de empresa
     * @param {string} tipoEmpresa - Tipo da empresa
     * @returns {Object|null} Configuração específica do setor
     */
    function classificarSetorPorTipo(tipoEmpresa) {
        const tiposEspeciais = {
            'servicos': {
                codigo: 'servicos',
                categoriaIva: 'servicos',
                cbs: 0.088,
                ibs: 0.177,
                reducaoEspecial: 0
            },
            'industria': {
                codigo: 'industria',
                categoriaIva: 'industria',
                cbs: 0.088,
                ibs: 0.155,
                reducaoEspecial: 0.2
            },
            'comercio': {
                codigo: 'comercio',
                categoriaIva: 'comercio',
                cbs: 0.088,
                ibs: 0.177,
                reducaoEspecial: 0
            }
        };

        const config = tiposEspeciais[tipoEmpresa?.toLowerCase()];
        if (config) {
            console.log(`SPED-EXTRACTOR: Setor identificado por tipo: ${tipoEmpresa}`);
            return config;
        }

        return null;
    }

    /**
     * Classifica setor baseado na composição tributária
     * @param {Object} composicao - Composição tributária
     * @returns {Object|null} Configuração específica do setor
     */
    function classificarSetorPorTributacao(composicao) {
        const { debitos, aliquotasEfetivas } = composicao;

        // Se há ISS significativo, provavelmente é empresa de serviços
        if (debitos.iss > 0 && debitos.iss > (debitos.icms || 0)) {
            console.log('SPED-EXTRACTOR: Setor identificado por tributação: serviços (ISS predominante)');
            return {
                codigo: 'servicos',
                categoriaIva: 'servicos',
                cbs: 0.088,
                ibs: 0.177,
                reducaoEspecial: 0
            };
        }

        // Se há IPI significativo, provavelmente é indústria
        if (debitos.ipi > 0) {
            console.log('SPED-EXTRACTOR: Setor identificado por tributação: indústria (IPI presente)');
            return {
                codigo: 'industria',
                categoriaIva: 'industria',
                cbs: 0.088,
                ibs: 0.155,
                reducaoEspecial: 0.2
            };
        }

        // Se há ICMS predominante sem IPI, provavelmente é comércio
        if (debitos.icms > 0 && !debitos.ipi) {
            console.log('SPED-EXTRACTOR: Setor identificado por tributação: comércio (ICMS sem IPI)');
            return {
                codigo: 'comercio',
                categoriaIva: 'comercio',
                cbs: 0.088,
                ibs: 0.177,
                reducaoEspecial: 0
            };
        }

        return null;
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