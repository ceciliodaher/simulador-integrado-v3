/**
 * SpedExtractor Simplificado
 * Versão 1.0.0 - Maio 2025
 * Especializado para o simulador Split Payment
 */

const SpedExtractor = (function() {
    // Mapeamento dos registros essenciais por tipo de arquivo
    const REGISTROS_IMPORTANTES = {
        FISCAL: [
            '0000', '0100', '0150',     // Registros de identificação
            'C100', 'C190',             // Documentos fiscais
            'E110', 'E200', 'E210'      // Apuração ICMS/IPI
        ],
        CONTRIBUICOES: [
            '0000', '0110',             // Identificação e regimes
            'M100', 'M105',             // Créditos PIS
            'M200', 'M210', 'M215',     // Débitos PIS
            'M500', 'M505',             // Créditos COFINS
            'M600', 'M610', 'M615'      // Débitos COFINS
        ]
    };

    /**
     * Converte string para valor monetário de forma robusta
     * @param {string|number} valorString - Valor a ser convertido
     * @returns {number} - Valor numérico
     */
    function parseValorMonetario(valorString) {
        if (window.DataManager && typeof window.DataManager.extrairValorMonetario === 'function') {
            return window.DataManager.extrairValorMonetario(valorString);
        }

        // Fallback caso DataManager não esteja disponível
        if (!valorString || valorString === '' || valorString === '0') {
            return 0;
        }

        try {
            if (typeof valorString === 'number') {
                return isNaN(valorString) ? 0 : valorString;
            }

            let valor = valorString.toString().trim();

            // Tratar formato brasileiro: 1.234.567,89
            if (valor.includes(',')) {
                const partes = valor.split(',');
                if (partes.length === 2) {
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
            }

            const resultado = parseFloat(valor);
            return isNaN(resultado) ? 0 : resultado;

        } catch (erro) {
            console.warn('SPED-EXTRACTOR: Erro ao converter valor monetário:', erro);
            return 0;
        }
    }

    /**
     * Processa um arquivo SPED e retorna apenas os registros relevantes
     */
    function processarArquivo(conteudo, tipoArquivo) {
        console.log(`Processando arquivo SPED ${tipoArquivo}...`);
        
        const linhas = conteudo.split('\n');
        const registros = {};
        let linhasProcessadas = 0;
        let registrosEncontrados = 0;
        
        // Verificar o tipo de arquivo se não informado
        if (!tipoArquivo) {
            if (linhas.length > 0) {
                const primeiraLinha = linhas[0].split('|');
                if (primeiraLinha.length > 3) {
                    const codigoFinalidade = primeiraLinha[3];
                    if (codigoFinalidade === '0' || codigoFinalidade === '1') {
                        tipoArquivo = 'FISCAL';
                    } else if (codigoFinalidade === '10' || codigoFinalidade === '11') {
                        tipoArquivo = 'CONTRIBUICOES';
                    }
                }
            }
            
            // Se ainda não identificou, assume FISCAL como padrão
            if (!tipoArquivo) {
                tipoArquivo = 'FISCAL';
            }
        }
        
        // Registros de interesse para este tipo
        const registrosAlvo = REGISTROS_IMPORTANTES[tipoArquivo] || [];
        
        // Processar linhas do arquivo
        for (const linha of linhas) {
            linhasProcessadas++;
            
            if (!linha.trim()) continue; // Ignora linhas vazias
            
            const colunas = linha.split('|');
            if (colunas.length < 3) continue;
            
            // Remover elemento vazio no início e fim (resultado do split)
            if (colunas[0] === '') colunas.shift();
            if (colunas[colunas.length - 1] === '') colunas.pop();
            
            const tipoRegistro = colunas[0];
            
            // Verificar se é um registro de interesse
            if (!registrosAlvo.includes(tipoRegistro)) continue;
            
            // Mapear o registro conforme seu tipo
            const registroMapeado = mapearRegistro(tipoRegistro, colunas, tipoArquivo);
            
            // Adicionar à coleção de registros
            if (!registros[tipoRegistro]) {
                registros[tipoRegistro] = [];
            }
            
            registros[tipoRegistro].push(registroMapeado);
            registrosEncontrados++;
        }
        
        console.log(`Processamento concluído: ${linhasProcessadas} linhas, ${registrosEncontrados} registros relevantes.`);
        
        return {
            tipoArquivo,
            registros
        };
    }
    
    /**
     * Mapeia os campos de cada tipo de registro
     */
    function mapearRegistro(tipoRegistro, colunas, tipoArquivo) {
        switch(tipoRegistro) {
            case '0000': // Registro de abertura
                if (tipoArquivo === 'CONTRIBUICOES') {
                    return {
                        registro: tipoRegistro,
                        codVersao: colunas[1],
                        codFinalidade: colunas[2],
                        dataInicial: colunas[5],
                        dataFinal: colunas[6],
                        nome: colunas[7],        // Posição correta para SPED Contribuições
                        cnpj: colunas[8],        // Posição correta para SPED Contribuições
                        uf: colunas[9],         // Ajustado para SPED Contribuições
                        ie: colunas[10],         // Ajustado para SPED Contribuições
                        codMun: colunas[11],     // Ajustado para SPED Contribuições
                        im: colunas[13],         // Ajustado para SPED Contribuições
                        indTipoAtiv: colunas[13]     // Tipo de atividade
                    };
                } else {
                    // SPED Fiscal (comportamento original)
                    return {
                        registro: tipoRegistro,
                        codVersao: colunas[1],
                        codFinalidade: colunas[2],
                        dataInicial: colunas[3],
                        dataFinal: colunas[4],
                        nome: colunas[5],        // Posição para SPED Fiscal
                        cnpj: colunas[6],        // Posição para SPED Fiscal
                        uf: colunas[8],
                        ie: colunas[9],
                        codMun: colunas[10],
                        im: colunas[11],
                        suframa: colunas[12]
                    };
                }    
                
            case '0110': // Regime de apuração PIS/COFINS
                return {
                    registro: tipoRegistro,
                    codIncidencia: colunas[2],  // 1=Cumulativo, 2=Não-cumulativo, 3=Ambos
                    indMetodo: colunas[3],      // Método de apropriação                    
                    indNatPj: colunas[4]        // Natureza da PJ
                };
                
            case 'C100': // Nota fiscal
                return {
                    registro: tipoRegistro,
                    indOper: colunas[1],                    // 0=Entrada, 1=Saída
                    indEmit: colunas[2],                    // 0=Própria, 1=Terceiros
                    codPart: colunas[3],                    // Código do participante
                    codMod: colunas[4],                     // Modelo do documento
                    codSit: colunas[5],                     // Situação do documento
                    serie: colunas[6],                      // Série do documento
                    numDoc: colunas[7],                     // Número do documento
                    chvNfe: colunas[8],                     // Chave da NF-e
                    dataDoc: colunas[9],                    // Data de emissão
                    dataEntSai: colunas[10],                // Data de entrada/saída
                    valorTotal: parseValorMonetario(colunas[11]),  // Valor total do documento
                    bcIcms: parseValorMonetario(colunas[13]),      // Base de cálculo do ICMS
                    valorIcms: parseValorMonetario(colunas[14]),   // Valor do ICMS
                    valorIpi: parseValorMonetario(colunas[18])     // Valor do IPI
                };

            case 'C190': // Analítico do registro C100 (ICMS)
                return {
                    registro: tipoRegistro,
                    cstIcms: colunas[1],                      // CST do ICMS
                    cfop: colunas[2],                         // CFOP
                    aliqIcms: parseValorMonetario(colunas[3]), // Alíquota do ICMS
                    valorOperacao: parseValorMonetario(colunas[4]), // Valor da operação
                    valorBcIcms: parseValorMonetario(colunas[5]),   // Base de cálculo do ICMS
                    valorIcms: parseValorMonetario(colunas[6]),     // Valor do ICMS
                    valorBcIcmsSt: parseValorMonetario(colunas[7]), // Base de cálculo do ICMS ST
                    valorIcmsSt: parseValorMonetario(colunas[8])    // Valor do ICMS ST
                };
            
            case 'E110': // Apuração do ICMS
                return {
                    registro: tipoRegistro,
                    valorTotalDebitos: parseValorMonetario(colunas[2]),      // Total de débitos
                    valorTotalCreditos: parseValorMonetario(colunas[6]),     // Total de créditos
                    valorAjustesDebitos: parseValorMonetario(colunas[3]),    // Ajustes de débitos
                    valorAjustesCreditos: parseValorMonetario(colunas[7]),   // Ajustes de créditos
                    valorICMSRecolher: parseValorMonetario(colunas[13])      // ICMS a recolher
                };
                
            case 'E200': // Período de apuração do IPI
                return {
                    registro: tipoRegistro,
                    uf: colunas[1],                                // UF
                    dataInicial: colunas[2],                       // Data inicial
                    dataFinal: colunas[3]                          // Data final
                };

            case 'E520': // Apuração do IPI
                return {
                    registro: tipoRegistro,
                    valorTotalDebitos: parseValorMonetario(colunas[3]),    // Total de débitos
                    valorTotalCreditos: parseValorMonetario(colunas[4]),   // Total de créditos
                    valorSaldoApu: parseValorMonetario(colunas[8]),        // Saldo da apuração
                    valorDebitoEspecial: parseValorMonetario(colunas[5])   // Débito especial
                };
                
            case 'M100': // Crédito de PIS/PASEP
                return {
                    registro: tipoRegistro,
                    codCredito: colunas[1],                          // Código do tipo de crédito
                    indCredOrig: colunas[2],                         // Indicador de crédito originado
                    valorBcCredito: parseValorMonetario(colunas[3]), // Valor da base de cálculo do crédito
                    aliqPis: parseValorMonetario(colunas[4]),        // Alíquota do PIS (%)
                    valorCredito: parseValorMonetario(colunas[5]),   // Valor total do crédito
                    valorCredDisp: parseValorMonetario(colunas[8])   // Valor do crédito disponível
                };

            case 'M105': // Detalhamento dos créditos PIS
                return {
                    registro: tipoRegistro,
                    natBcCred: colunas[2],                           // Código da base de cálculo do crédito
                    cstPis: colunas[3],                              // CST do PIS
                    valorBcCredito: parseValorMonetario(colunas[7]), // Valor da base de cálculo
                    valorBcPis: parseValorMonetario(colunas[6]),     // Valor da base de cálculo do PIS
                    aliqPis: parseValorMonetario(colunas[5]),        // Alíquota do PIS (%)
                    valorCredito: parseValorMonetario(colunas[6])    // Valor do crédito
                };
                
            case 'M210': // Detalhamento de débitos PIS
                return {
                    registro: tipoRegistro,
                    codContrib: colunas[1],
                    valorBaseCalculoAntes: parseValorMonetario(colunas[3]),
                    valorAjustesAcrescimoBc: parseValorMonetario(colunas[4]),
                    valorAjustesReducaoBc: parseValorMonetario(colunas[5]),
                    valorBaseCalculoAjustada: parseValorMonetario(colunas[6]),
                    aliqPis: parseValorMonetario(colunas[7]),
                    valorContribApurada: parseValorMonetario(colunas[10]),
                    valorAjustesAcrescimo: parseValorMonetario(colunas[11]),
                    valorAjustesReducao: parseValorMonetario(colunas[12]),
                    valorContribPeriodo: parseValorMonetario(colunas[15])
                };
                
            case 'M215': // Ajustes da base de cálculo PIS
                return {
                    registro: tipoRegistro,
                    indAjBc: colunas[1],                           // Indicador do tipo de ajuste
                    valorAjBc: parseValorMonetario(colunas[2]),    // Valor do ajuste
                    codAjBc: colunas[3],                           // Código do ajuste
                    numDoc: colunas[4],                            // Número do documento
                    descrAj: colunas[5]                            // Descrição do ajuste
                };
                
            case 'M500': // Crédito de COFINS
                return {
                    registro: tipoRegistro,
                    codCredito: colunas[1],                           // Código do tipo de crédito
                    indCredOrig: colunas[2],                          // Indicador de crédito originado
                    valorBcCredito: parseValorMonetario(colunas[3]),  // Valor da base de cálculo do crédito
                    aliqCofins: parseValorMonetario(colunas[4]),      // Alíquota da COFINS (%)
                    valorCredito: parseValorMonetario(colunas[5]),    // Valor total do crédito
                    valorCredDisp: parseValorMonetario(colunas[8])    // Valor do crédito disponível
                };

            case 'M505': // Detalhamento dos créditos COFINS
                return {
                    registro: tipoRegistro,
                    natBcCred: colunas[1],                            // Código da base de cálculo do crédito
                    cstCofins: colunas[2],                            // CST da COFINS
                    valorBcCredito: parseValorMonetario(colunas[3]),  // Valor da base de cálculo
                    valorBcCofins: parseValorMonetario(colunas[4]),   // Valor da base de cálculo da COFINS
                    aliqCofins: parseValorMonetario(colunas[5]),      // Alíquota da COFINS (%)
                    valorCredito: parseValorMonetario(colunas[6])     // Valor do crédito
                };
                
            case 'M610': // Detalhamento de débitos COFINS
                return {
                    registro: tipoRegistro,
                    codContrib: colunas[1],
                    valorBaseCalculoAntes: parseValorMonetario(colunas[3]),
                    valorAjustesAcrescimoBc: parseValorMonetario(colunas[4]),
                    valorAjustesReducaoBc: parseValorMonetario(colunas[5]),
                    valorBaseCalculoAjustada: parseValorMonetario(colunas[6]),
                    aliqCofins: parseValorMonetario(colunas[7]),
                    valorContribApurada: parseValorMonetario(colunas[10]),
                    valorAjustesAcrescimo: parseValorMonetario(colunas[11]),
                    valorAjustesReducao: parseValorMonetario(colunas[12]),
                    valorContribPeriodo: parseValorMonetario(colunas[15])
                };
                
            case 'M615': // Ajustes da base de cálculo COFINS
                return {
                    registro: tipoRegistro,
                    indAjBc: colunas[1],                            // Indicador do tipo de ajuste
                    valorAjBc: parseValorMonetario(colunas[2]),     // Valor do ajuste
                    codAjBc: colunas[3],                            // Código do ajuste
                    numDoc: colunas[4],                             // Número do documento
                    descrAj: colunas[5]                             // Descrição do ajuste
                };
                
            default:
                // Para registros não mapeados explicitamente, mapeamento genérico
                const registro = { registro: tipoRegistro };
                for (let i = 1; i < colunas.length; i++) {
                    registro[`campo${i}`] = colunas[i];
                }
                return registro;
        }
    }
    
    /**
     * Extrai dados consolidados para o simulador
     * @param {Object} resultado - Resultado do processamento do arquivo SPED
     * @returns {Object} - Dados na estrutura aninhada para o simulador
     */
    function extrairDadosParaSimulador(resultado) {
        const { tipoArquivo, registros } = resultado;

        // Inicializar com estrutura canônica vazia
        const dadosCanonicos = window.DataManager.obterEstruturaAninhadaPadrao();

        // Extrai dados da empresa
        if (registros['0000'] && registros['0000'].length > 0) {
            const reg0000 = registros['0000'][0];
            dadosCanonicos.empresa.nome = reg0000.nome;
            dadosCanonicos.empresa.cnpj = reg0000.cnpj;
        }

        // Determina regime tributário pelo registro 0110
        if (registros['0110'] && registros['0110'].length > 0) {
            const reg0110 = registros['0110'][0];
            const codIncidencia = reg0110.codIncidencia;

            if (codIncidencia === '1') {
                dadosCanonicos.parametrosFiscais.regimePisCofins = 'cumulativo';
                dadosCanonicos.empresa.regime = 'presumido';
            } else if (codIncidencia === '2') {
                dadosCanonicos.parametrosFiscais.regimePisCofins = 'nao-cumulativo';
                dadosCanonicos.empresa.regime = 'real';
            }
        }

        // Inicialmente definir faturamento como nulo para verificação posterior
        let faturamentoEncontrado = null;

        // PRIORIDADE 1: SPED Contribuições (M210)
        if (registros['M210'] && registros['M210'].length > 0) {
            const receitaBrutaPIS = registros['M210'].reduce((total, reg) => {
                return total + (reg.valorBaseCalculoAntes || 0);
            }, 0);

            if (receitaBrutaPIS > 0) {
                console.log('SPED-EXTRACTOR: Faturamento calculado via M210 (PIS):', receitaBrutaPIS);
                faturamentoEncontrado = receitaBrutaPIS;
            }
        }

        // PRIORIDADE 2: SPED Contribuições (M610)
        if ((faturamentoEncontrado === null || faturamentoEncontrado === 0) && 
            registros['M610'] && registros['M610'].length > 0) {
            const receitaBrutaCOFINS = registros['M610'].reduce((total, reg) => {
                return total + (reg.valorBaseCalculoAntes || 0);
            }, 0);

            if (receitaBrutaCOFINS > 0) {
                console.log('SPED-EXTRACTOR: Faturamento calculado via M610 (COFINS):', receitaBrutaCOFINS);
                faturamentoEncontrado = receitaBrutaCOFINS;
            }
        }

        // FALLBACK: SPED Fiscal (C100)
        if ((faturamentoEncontrado === null || faturamentoEncontrado === 0) && 
            registros['C100'] && registros['C100'].length > 0) {
            const notasSaida = registros['C100'].filter(nota => nota.indOper === '1');
            let valorTotalSaidas = 0;

            notasSaida.forEach(nota => {
                valorTotalSaidas += nota.valorTotal || 0;
            });

            if (valorTotalSaidas > 0) {
                console.log('SPED-EXTRACTOR: Faturamento calculado via C100 (fallback):', valorTotalSaidas);
                faturamentoEncontrado = valorTotalSaidas;
            }
        }

        // Atribuir o faturamento encontrado à estrutura canônica
        if (faturamentoEncontrado !== null) {
            dadosCanonicos.empresa.faturamento = faturamentoEncontrado;
        }

        // Processar créditos e débitos fiscais
        if (tipoArquivo === 'FISCAL') {
            // Inicializar composicaoTributaria se não existir
            if (!dadosCanonicos.parametrosFiscais.composicaoTributaria) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria = {
                    debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 }
                };
            }

            // Calcular débitos ICMS/IPI
            if (registros['E110'] && registros['E110'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.icms = 
                    registros['E110'][0].valorTotalDebitos || 0;
            }

            if (registros['E210'] && registros['E210'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.ipi = 
                    registros['E210'].reduce((total, reg) => total + (reg.valorTotalDebitos || 0), 0);
            }

            // Calcular créditos ICMS/IPI
            if (registros['E110'] && registros['E110'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.icms = 
                    registros['E110'][0].valorTotalCreditos || 0;
            }

            if (registros['E210'] && registros['E210'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.ipi = 
                    registros['E210'].reduce((total, reg) => total + (reg.valorTotalCreditos || 0), 0);
            }
        } else if (tipoArquivo === 'CONTRIBUICOES') {
            // Inicializar composicaoTributaria se não existir
            if (!dadosCanonicos.parametrosFiscais.composicaoTributaria) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria = {
                    debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 }
                };
            }

            // Calcular débitos PIS/COFINS
            if (registros['M210'] && registros['M210'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.pis = 
                    registros['M210'].reduce((total, reg) => total + (reg.valorContribPeriodo || 0), 0);
            }

            if (registros['M610'] && registros['M610'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.cofins = 
                    registros['M610'].reduce((total, reg) => total + (reg.valorContribPeriodo || 0), 0);
            }

            // Calcular créditos PIS/COFINS
            if (registros['M100'] && registros['M100'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.pis = 
                    registros['M100'].reduce((total, reg) => total + (reg.valorCredDisp || 0), 0);
            }

            if (registros['M500'] && registros['M500'].length > 0) {
                dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.cofins = 
                    registros['M500'].reduce((total, reg) => total + (reg.valorCredDisp || 0), 0);
            }
        }

        // Ciclo Financeiro - valores padrão
        dadosCanonicos.cicloFinanceiro = {
            pmr: 30,
            pmp: 30,
            pme: 30,
            percVista: 0.3,
            percPrazo: 0.7
        };

        // Validar e normalizar os dados usando o DataManager
        return window.DataManager.validarENormalizar(dadosCanonicos);
    }
    
    /**
     * Integra dados de múltiplos arquivos SPED
     * @param {Object} dadosFiscal - Dados extraídos do SPED Fiscal
     * @param {Object} dadosContribuicoes - Dados extraídos do SPED Contribuições
     * @returns {Object} - Dados integrados na estrutura aninhada
     */
    function integrarDados(dadosFiscal, dadosContribuicoes) {
        // Inicializar com estrutura canônica vazia
        const dadosIntegrados = window.DataManager.obterEstruturaAninhadaPadrao();

        // PRIORIDADE 1: SPED Contribuições se estiver disponível
        let faturamento = 0;
        if (dadosContribuicoes && dadosContribuicoes.empresa) {
            if (dadosContribuicoes.empresa.faturamento !== null && dadosContribuicoes.empresa.faturamento !== undefined) {
                faturamento = dadosContribuicoes.empresa.faturamento;
                console.log('SPED-EXTRACTOR: Utilizando faturamento do SPED Contribuições:', faturamento);
            }
        }

        // FALLBACK: SPED Fiscal apenas se não tivermos dados do Contribuições
        if ((faturamento === 0 || faturamento === null || faturamento === undefined) && 
            dadosFiscal && dadosFiscal.empresa && 
            dadosFiscal.empresa.faturamento !== null && dadosFiscal.empresa.faturamento !== undefined) {
            faturamento = dadosFiscal.empresa.faturamento;
            console.log('SPED-EXTRACTOR: Utilizando faturamento do SPED Fiscal (fallback):', faturamento);
        }

        // Empresa
        dadosIntegrados.empresa.nome = dadosContribuicoes?.empresa?.nome || dadosFiscal?.empresa?.nome || '';
        dadosIntegrados.empresa.cnpj = dadosContribuicoes?.empresa?.cnpj || dadosFiscal?.empresa?.cnpj || '';
        dadosIntegrados.empresa.faturamento = faturamento;
        dadosIntegrados.empresa.uf = dadosContribuicoes?.empresa?.uf || dadosFiscal?.empresa?.uf || '';
        dadosIntegrados.empresa.regime = dadosContribuicoes?.empresa?.regime || dadosFiscal?.empresa?.regime || 'presumido';

        // Parâmetros Fiscais
        dadosIntegrados.parametrosFiscais.regimePisCofins = dadosContribuicoes?.parametrosFiscais?.regimePisCofins || 'cumulativo';

        // Composição Tributária
        dadosIntegrados.parametrosFiscais.composicaoTributaria = {
            debitos: {
                pis: dadosContribuicoes?.parametrosFiscais?.composicaoTributaria?.debitos?.pis || 0,
                cofins: dadosContribuicoes?.parametrosFiscais?.composicaoTributaria?.debitos?.cofins || 0,
                icms: dadosFiscal?.parametrosFiscais?.composicaoTributaria?.debitos?.icms || 0,
                ipi: dadosFiscal?.parametrosFiscais?.composicaoTributaria?.debitos?.ipi || 0,
                iss: 0
            },
            creditos: {
                pis: dadosContribuicoes?.parametrosFiscais?.composicaoTributaria?.creditos?.pis || 0,
                cofins: dadosContribuicoes?.parametrosFiscais?.composicaoTributaria?.creditos?.cofins || 0,
                icms: dadosFiscal?.parametrosFiscais?.composicaoTributaria?.creditos?.icms || 0,
                ipi: dadosFiscal?.parametrosFiscais?.composicaoTributaria?.creditos?.ipi || 0,
                iss: 0
            }
        };

        // Preencher campos creditos no formato canônico
        dadosIntegrados.parametrosFiscais.creditos = {
            pis: dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.pis,
            cofins: dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.cofins,
            icms: dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.icms,
            ipi: dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.ipi,
            cbs: 0,
            ibs: 0
        };

        // Adicionar flag para identificar dados SPED
        dadosIntegrados.dadosSpedImportados = true;

        // Validar e normalizar os dados integrados
        return window.DataManager.validarENormalizar(dadosIntegrados);
    }
    
    // Interface pública do módulo
    return {
        // Processa arquivo SPED e retorna registros importantes
        processarArquivo: processarArquivo,
        
        // Extrai dados consolidados para o simulador
        extrairDadosParaSimulador: extrairDadosParaSimulador,
        
        // Integra dados de múltiplos arquivos SPED
        integrarDados: integrarDados,
        
        // Função de utilidade para conversão de valores
        parseValorMonetario: parseValorMonetario,
        
        // Versão
        versao: '1.0.0-simplificado'
    };
})();

// Expor o módulo globalmente
if (typeof window !== 'undefined') {
    window.SpedExtractor = SpedExtractor;
    console.log('SPED-EXTRACTOR: Módulo simplificado carregado com sucesso!');
}