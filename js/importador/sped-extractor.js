/**
 * SpedExtractor Simplificado
 * Versão 1.0.0 - Maio 2025
 * Especializado para o simulador Split Payment
 */

// Definição imediata para garantir disponibilidade global
window.SpedExtractor = (function() {
    console.log('SPED-EXTRACTOR: Inicializando módulo...');
    
    // Registros importantes por tipo de arquivo
    const REGISTROS_IMPORTANTES = {
      FISCAL: [
        '0000', '0100', '0150',
        'C100', 'C190',
        'E110', 'E520'
      ],
      CONTRIBUICOES: [
        '0000', '0110',
        'M100', 'M105',
        'M200', 'M210', 'M215',
        'M220', 'M230',
        'M500', 'M505',
        'M600', 'M610', 'M615',
        'M620', 'M630'
      ]
    };
    
    /**
     * Cria uma estrutura canônica padrão para uso quando o DataManager não está disponível
     * @returns {Object} - Estrutura canônica padrão
     */
    function criarEstruturaCanonica() {
        // Estrutura mínima necessária para o processamento SPED
        return {
            empresa: {
                nome: '',
                cnpj: '',
                faturamento: 0,
                margem: 0,
                setor: '',
                tipoEmpresa: '',
                regime: ''
            },
            cicloFinanceiro: {
                pmr: 30,
                pmp: 30,
                pme: 30,
                percVista: 0.3,
                percPrazo: 0.7
            },
            parametrosFiscais: {
                aliquota: 0.265,
                tipoOperacao: '',
                regimePisCofins: '',
                creditos: {
                    pis: 0,
                    cofins: 0,
                    icms: 0,
                    ipi: 0,
                    cbs: 0,
                    ibs: 0
                }
            }
        };
    }

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
        
        // Log detalhado dos registros críticos
        console.log('=== SPED-EXTRACTOR: LOGS DE DIAGNÓSTICO ===');
        console.log(`Arquivo SPED ${tipoArquivo} processado - Total de registros: ${Object.keys(registros).length}`);

        // Verificar registros críticos para créditos tributários
        const registrosCriticos = ['M200', 'M600', 'E110', 'E520'];
        registrosCriticos.forEach(registro => {
            if (registros[registro] && registros[registro].length > 0) {
                console.log(`${registro} encontrado: ${registros[registro].length} ocorrências`);
                console.log(`${registro} primeira ocorrência:`, JSON.stringify(registros[registro][0], null, 2));
            } else {
                console.log(`${registro} NÃO encontrado no arquivo`);
            }
        });
        
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
                  codVersao: colunas[1],           // Campo 02 - CODVER
                  codFinalidade: colunas[2],       // Campo 03 - TIPOESCRIT
                  indSitEsp: colunas[3],           // Campo 04 - INDSITESP
                  numRecAnterior: colunas[4],      // Campo 05 - NUMRECANT
                  dataInicial: colunas[5],         // Campo 06 - DTINI
                  dataFinal: colunas[6],           // Campo 07 - DTFIN
                  nome: colunas[7],                // Campo 08 - NOME
                  cnpj: colunas[8],                // Campo 09 - CNPJ
                  uf: colunas[9],                  // Campo 10 - UF
                  codMun: colunas[10],             // Campo 11 - CODMUN
                  suframa: colunas[11],            // Campo 12 - SUFRAMA
                  indNatPj: colunas[12],           // Campo 13 - INDNATPJ
                  indTipoAtiv: colunas[13]         // Campo 14 - INDATIV (ESSENCIAL para tipo empresa)
                };
              } else { // FISCAL
                return {
                  registro: tipoRegistro,
                  codVersao: colunas[1],           // Campo 02 - CODVER
                  codFinalidade: colunas[2],       // Campo 03 - TIPOESCRIT
                  indSitEsp: colunas[3],           // Campo 04 - INDSITESP
                  numRecAnterior: colunas[4],      // Campo 05 - NUMRECANT
                  dataInicial: colunas[5],         // Campo 06 - DTINI
                  dataFinal: colunas[6],           // Campo 07 - DTFIN
                  nome: colunas[7],                // Campo 08 - NOME
                  cnpj: colunas[8],                // Campo 09 - CNPJ
                  uf: colunas[9],                  // Campo 10 - UF
                  ie: colunas[10],                 // Campo 11 - IE
                  codMun: colunas[11],             // Campo 12 - CODMUN
                  im: colunas[12],                 // Campo 13 - IM
                  suframa: colunas[13]             // Campo 14 - SUFRAMA
                };
              }
              break;

            case '0110': // Regime de apuração
              return {
                registro: tipoRegistro,
                codIncidencia: colunas[1],         // Campo 02 - CODINCTRIB
                indAproCred: colunas[2],           // Campo 03 - INDAPROCRED
                codTipoCont: colunas[3],           // Campo 04 - CODTIPOCONT
                indRegCum: colunas[4]              // Campo 05 - INDREGCUM
              };
                
            case 'C100': // Nota fiscal
              return {
                registro: tipoRegistro,
                indOper: colunas[1],               // Campo 02
                indEmit: colunas[2],               // Campo 03
                codPart: colunas[3],               // Campo 04
                codMod: colunas[4],                // Campo 05
                codSit: colunas[5],                // Campo 06
                serie: colunas[6],                 // Campo 07
                numDoc: colunas[7],                // Campo 08
                chvNfe: colunas[8],                // Campo 09
                dataDoc: colunas[9],               // Campo 10
                dataEntSai: colunas[10],           // Campo 11
                valorTotal: parseValorMonetario(colunas[11]), // Campo 12
                indPgto: colunas[12],              // Campo 13
                bcIcms: parseValorMonetario(colunas[13]),     // Campo 14
                valorIcms: parseValorMonetario(colunas[14]),  // Campo 15
                bcIcmsSt: parseValorMonetario(colunas[15]),   // Campo 16
                valorIcmsSt: parseValorMonetario(colunas[16]), // Campo 17
                valorProd: parseValorMonetario(colunas[17]),   // Campo 18
                valorIpi: parseValorMonetario(colunas[18]),    // Campo 19
                valorPis: parseValorMonetario(colunas[19]),    // Campo 20
                valorCofins: parseValorMonetario(colunas[20])  // Campo 21
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
            
            case 'E110': // Apuração ICMS
              return {
                registro: tipoRegistro,
                vlTotDebitos: parseValorMonetario(colunas[1]),      // Campo 02 - Débitos de saídas/prestações
                vlAjDebitos: parseValorMonetario(colunas[2]),       // Campo 03 - Ajustes a débito do documento fiscal
                vlTotAjDebitos: parseValorMonetario(colunas[3]),    // Campo 04 - Total de ajustes a débito
                vlEstornosCreditos: parseValorMonetario(colunas[4]), // Campo 05 - Estornos de créditos
                vlTotCreditos: parseValorMonetario(colunas[5]),     // Campo 06 - Créditos por entradas/aquisições
                vlAjCreditos: parseValorMonetario(colunas[6]),      // Campo 07 - Ajustes a crédito do documento fiscal
                vlTotAjCreditos: parseValorMonetario(colunas[7]),   // Campo 08 - Total de ajustes a crédito
                vlEstornosDebitos: parseValorMonetario(colunas[8]), // Campo 09 - Estornos de débitos
                vlSldCredorAnt: parseValorMonetario(colunas[9]),    // Campo 10 - Saldo credor período anterior
                vlSldApurado: parseValorMonetario(colunas[10]),     // Campo 11 - Saldo devedor apurado
                vlTotDed: parseValorMonetario(colunas[11]),         // Campo 12 - Total de deduções
                vlIcmsRecolher: parseValorMonetario(colunas[12]),   // Campo 13 - ICMS a recolher
                vlSldCredorTransportar: parseValorMonetario(colunas[13]), // Campo 14 - Saldo credor a transportar
                debEsp: parseValorMonetario(colunas[14])            // Campo 15 - CRÍTICO: Valores EXTRA-APURAÇÃO
              };
                
            case 'E520': // Apuração IPI
              return {
                registro: tipoRegistro,
                vlSdCredAntIpi: parseValorMonetario(colunas[1]),    // Campo 02 - Saldo credor anterior
                vlDebIpi: parseValorMonetario(colunas[2]),          // Campo 03 - Débitos por saídas
                vlCredIpi: parseValorMonetario(colunas[3]),         // Campo 04 - Créditos por entradas
                vlOdIpi: parseValorMonetario(colunas[4]),           // Campo 05 - Outros débitos (inclui estornos)
                vlOcIpi: parseValorMonetario(colunas[5]),           // Campo 06 - Outros créditos (inclui estornos)
                vlScIpi: parseValorMonetario(colunas[6]),           // Campo 07 - Saldo credor para período seguinte
                vlSdIpi: parseValorMonetario(colunas[7])            // Campo 08 - Saldo devedor a recolher
              };
                
            case 'M100': // Crédito PIS
              return {
                registro: tipoRegistro,
                codCredito: colunas[1],            // Campo 02
                indCredOrig: colunas[2],           // Campo 03
                vlBcPis: parseValorMonetario(colunas[3]),     // Campo 04
                aliqPis: parseValorMonetario(colunas[4]),     // Campo 05
                quantBcPis: parseValorMonetario(colunas[5]),  // Campo 06
                aliqPisQuant: parseValorMonetario(colunas[6]), // Campo 07
                vlCredito: parseValorMonetario(colunas[7]),    // Campo 08
                vlAjustes: parseValorMonetario(colunas[8]),    // Campo 09
                vlAjustesAnt: parseValorMonetario(colunas[9]), // Campo 10
                vlDifer: parseValorMonetario(colunas[10]),     // Campo 11
                vlDiferAnt: parseValorMonetario(colunas[11]),  // Campo 12
                vlCredDispEfd: parseValorMonetario(colunas[12]) // Campo 13
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
                  
            case 'M200': // RESUMO PIS
              return {
                registro: tipoRegistro,
                vlTotContNcPer: parseValorMonetario(colunas[1]),    // Campo 02
                vlTotCredDesc: parseValorMonetario(colunas[2]),     // Campo 03 - CRÍTICO: CRÉDITOS DESCONTADOS
                vlTotCredDescAnt: parseValorMonetario(colunas[3]),  // Campo 04
                vlTotContNcDev: parseValorMonetario(colunas[4]),    // Campo 05
                vlRetNc: parseValorMonetario(colunas[5]),           // Campo 06
                vlOutDedNc: parseValorMonetario(colunas[6]),        // Campo 07
                vlContNcRec: parseValorMonetario(colunas[7]),       // Campo 08 - PIS NC a recolher
                vlTotContCumPer: parseValorMonetario(colunas[8]),   // Campo 09
                vlRetCum: parseValorMonetario(colunas[9]),          // Campo 10
                vlOutDedCum: parseValorMonetario(colunas[10]),      // Campo 11
                vlContCumRec: parseValorMonetario(colunas[11]),     // Campo 12 - PIS CUM a recolher
                vlTotContRec: parseValorMonetario(colunas[12])      // Campo 13 - TOTAL PIS a recolher
              };

            case 'M600': // RESUMO COFINS
              return {
                registro: tipoRegistro,
                vlTotContNcPer: parseValorMonetario(colunas[1]),    // Campo 02
                vlTotCredDesc: parseValorMonetario(colunas[2]),     // Campo 03 - CRÍTICO: CRÉDITOS DESCONTADOS
                vlTotCredDescAnt: parseValorMonetario(colunas[3]),  // Campo 04
                vlTotContNcDev: parseValorMonetario(colunas[4]),    // Campo 05
                vlRetNc: parseValorMonetario(colunas[5]),           // Campo 06
                vlOutDedNc: parseValorMonetario(colunas[6]),        // Campo 07
                vlContNcRec: parseValorMonetario(colunas[7]),       // Campo 08 - COFINS NC a recolher
                vlTotContCumPer: parseValorMonetario(colunas[8]),   // Campo 09
                vlRetCum: parseValorMonetario(colunas[9]),          // Campo 10
                vlOutDedCum: parseValorMonetario(colunas[10]),      // Campo 11
                vlContCumRec: parseValorMonetario(colunas[11]),     // Campo 12 - COFINS CUM a recolher
                vlTotContRec: parseValorMonetario(colunas[12])      // Campo 13 - TOTAL COFINS a recolher
              };

            // Ajustes extra-apuração
            case 'M220': // Ajustes base de cálculo PIS
              return {
                registro: tipoRegistro,
                indAjBc: colunas[1],               // Campo 02
                vlAjBc: parseValorMonetario(colunas[2]),     // Campo 03
                codAjBc: colunas[3],               // Campo 04
                numDoc: colunas[4],                // Campo 05
                descrAj: colunas[5],               // Campo 06
                dtRef: colunas[6]                  // Campo 07
              };

            case 'M230': // Ajustes contribuição PIS
              return {
                registro: tipoRegistro,
                codAj: colunas[1],                 // Campo 02
                descrCompl: colunas[2],            // Campo 03
                vlAjus: parseValorMonetario(colunas[3])    // Campo 04
              };

            case 'M620': // Ajustes base de cálculo COFINS
              return {
                registro: tipoRegistro,
                indAjBc: colunas[1],               // Campo 02
                vlAjBc: parseValorMonetario(colunas[2]),     // Campo 03
                codAjBc: colunas[3],               // Campo 04
                numDoc: colunas[4],                // Campo 05
                descrAj: colunas[5],               // Campo 06
                dtRef: colunas[6]                  // Campo 07
              };

            case 'M630': // Ajustes contribuição COFINS
              return {
                registro: tipoRegistro,
                codAj: colunas[1],                 // Campo 02
                descrCompl: colunas[2],            // Campo 03
                vlAjus: parseValorMonetario(colunas[3])    // Campo 04
              };
                
             case 'M210': // Débitos PIS
              return {
                registro: tipoRegistro,
                codCont: colunas[1],               // Campo 02
                vlRecBrt: parseValorMonetario(colunas[2]),          // Campo 03
                vlBcCont: parseValorMonetario(colunas[3]),          // Campo 04
                vlAjusAcrescBc: parseValorMonetario(colunas[4]),    // Campo 05
                vlAjusReducBc: parseValorMonetario(colunas[5]),     // Campo 06
                vlBcContAjus: parseValorMonetario(colunas[6]),      // Campo 07
                aliqPis: parseValorMonetario(colunas[7]),           // Campo 08
                quantBcCont: parseValorMonetario(colunas[8]),       // Campo 09
                aliqPisQuant: parseValorMonetario(colunas[9]),      // Campo 10
                vlContApur: parseValorMonetario(colunas[10]),       // Campo 11
                vlAjusAcresc: parseValorMonetario(colunas[11]),     // Campo 12
                vlAjusReduc: parseValorMonetario(colunas[12]),      // Campo 13
                vlContDifer: parseValorMonetario(colunas[13]),      // Campo 14
                vlContDiferAnt: parseValorMonetario(colunas[14]),   // Campo 15
                vlContPer: parseValorMonetario(colunas[15])         // Campo 16
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
                
            case 'M500': // Crédito COFINS
              return {
                registro: tipoRegistro,
                codCredito: colunas[1],            // Campo 02
                indCredOrig: colunas[2],           // Campo 03
                vlBcCofins: parseValorMonetario(colunas[3]),      // Campo 04
                aliqCofins: parseValorMonetario(colunas[4]),      // Campo 05
                quantBcCofins: parseValorMonetario(colunas[5]),   // Campo 06
                aliqCofinsQuant: parseValorMonetario(colunas[6]), // Campo 07
                vlCredito: parseValorMonetario(colunas[7]),       // Campo 08
                vlAjustes: parseValorMonetario(colunas[8]),       // Campo 09
                vlAjustesAnt: parseValorMonetario(colunas[9]),    // Campo 10
                vlDifer: parseValorMonetario(colunas[10]),        // Campo 11
                vlDiferAnt: parseValorMonetario(colunas[11]),     // Campo 12
                vlCredDispEfd: parseValorMonetario(colunas[12])   // Campo 13
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
                
            case 'M610': // Débitos COFINS
              return {
                registro: tipoRegistro,
                codCont: colunas[1],               // Campo 02
                vlRecBrt: parseValorMonetario(colunas[2]),          // Campo 03
                vlBcCont: parseValorMonetario(colunas[3]),          // Campo 04
                vlAjusAcrescBc: parseValorMonetario(colunas[4]),    // Campo 05
                vlAjusReducBc: parseValorMonetario(colunas[5]),     // Campo 06
                vlBcContAjus: parseValorMonetario(colunas[6]),      // Campo 07
                aliqCofins: parseValorMonetario(colunas[7]),        // Campo 08
                quantBcCont: parseValorMonetario(colunas[8]),       // Campo 09
                aliqCofinsQuant: parseValorMonetario(colunas[9]),   // Campo 10
                vlContApur: parseValorMonetario(colunas[10]),       // Campo 11
                vlAjusAcresc: parseValorMonetario(colunas[11]),     // Campo 12
                vlAjusReduc: parseValorMonetario(colunas[12]),      // Campo 13
                vlContDifer: parseValorMonetario(colunas[13]),      // Campo 14
                vlContDiferAnt: parseValorMonetario(colunas[14]),   // Campo 15
                vlContPer: parseValorMonetario(colunas[15])         // Campo 16
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

        // Inicializar com estrutura canônica vazia - com verificação robusta
        let dadosCanonicos;
        try {
            // Verificar se DataManager e a função específica estão disponíveis
            if (window.DataManager && typeof window.DataManager.obterEstruturaAninhadaPadrao === 'function') {
                dadosCanonicos = window.DataManager.obterEstruturaAninhadaPadrao();
                console.log('SPED-EXTRACTOR: Estrutura canônica obtida via DataManager');
            } else {
                // Fallback: criar estrutura manualmente
                console.warn('SPED-EXTRACTOR: DataManager.obterEstruturaAninhadaPadrao não disponível, usando estrutura padrão alternativa');
                dadosCanonicos = criarEstruturaCanonica();
            }
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao obter estrutura canônica:', erro);
            dadosCanonicos = criarEstruturaCanonica();
        }

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

            if (codIncidencia === '2') {
                dadosCanonicos.parametrosFiscais.regimePisCofins = 'cumulativo';
                dadosCanonicos.empresa.regime = 'presumido';
            } else if (codIncidencia === '1') {
                dadosCanonicos.parametrosFiscais.regimePisCofins = 'nao-cumulativo';
                dadosCanonicos.empresa.regime = 'real';
            }
        }

        // Inicialmente definir faturamento como nulo para verificação posterior
        let faturamentoEncontrado = null;

        // Inicializar composicaoTributaria se não existir, para ambos os tipos de arquivo
        if (dadosCanonicos.parametrosFiscais && !dadosCanonicos.parametrosFiscais.composicaoTributaria) {
            dadosCanonicos.parametrosFiscais.composicaoTributaria = {
                debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 }
            };
        }

        // No bloco que trata os registros CONTRIBUICOES
        if (tipoArquivo === 'CONTRIBUICOES') {
          // Extrair diretamente os valores totais de PIS dos registros M200
          if (registros['M200'] && registros['M200'].length > 0) {
            // CORREÇÃO: O campo vlTotContNcPer contém o valor total dos débitos de PIS (campo 02)
            dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.pis = 
              registros['M200'][0].vlTotContNcPer || 0;

            // O campo vlTotCredDesc contém o valor total dos créditos descontados
            dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.pis = 
              registros['M200'][0].vlTotCredDesc || 0;

            // Também atribuir ao campo creditos padrão
            dadosCanonicos.parametrosFiscais.creditos.pis = 
              registros['M200'][0].vlTotCredDesc || 0;

            console.log('SPED-EXTRACTOR: Valores de PIS extraídos do M200 (CORRIGIDO):', {
              debito: dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.pis,
              credito: dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.pis
            });
          }

          // Extrair diretamente os valores totais de COFINS dos registros M600
          if (registros['M600'] && registros['M600'].length > 0) {
            // CORREÇÃO: O campo vlTotContNcPer contém o valor total dos débitos de COFINS (campo 02)
            dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.cofins = 
              registros['M600'][0].vlTotContNcPer || 0;

            // O campo vlTotCredDesc contém o valor total dos créditos descontados
            dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.cofins = 
              registros['M600'][0].vlTotCredDesc || 0;

            // Também atribuir ao campo creditos padrão
            dadosCanonicos.parametrosFiscais.creditos.cofins = 
              registros['M600'][0].vlTotCredDesc || 0;

            console.log('SPED-EXTRACTOR: Valores de COFINS extraídos do M600 (CORRIGIDO):', {
              debito: dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.cofins,
              credito: dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.cofins
            });
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

        // No bloco que trata os registros FISCAL
        if (tipoArquivo === 'FISCAL') {
          // Extrair corretamente os créditos de ICMS/IPI
          if (registros['E110'] && registros['E110'].length > 0) {
            // Calcular o total de débitos de ICMS corretamente
            const totalDebitosICMS = 
              registros['E110'][0].vlTotDebitos + 
              registros['E110'][0].vlAjDebitos + 
              registros['E110'][0].vlTotAjDebitos + 
              registros['E110'][0].vlEstornosCreditos || 0;

            // Calcular o total de créditos de ICMS corretamente
            const totalCreditosICMS = 
              registros['E110'][0].vlTotCreditos + 
              registros['E110'][0].vlAjCreditos + 
              registros['E110'][0].vlTotAjCreditos + 
              registros['E110'][0].vlEstornosDebitos || 0;

            dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.icms = totalDebitosICMS;
            dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.icms = totalCreditosICMS;

            // Também atribuir ao campo creditos padrão
            dadosCanonicos.parametrosFiscais.creditos.icms = totalCreditosICMS;
          }

          if (registros['E520'] && registros['E520'].length > 0) {
            // Calcular o total de débitos de IPI corretamente
            const totalDebitosIPI = 
              registros['E520'][0].vlDebIpi + 
              registros['E520'][0].vlOdIpi || 0;

            // Calcular o total de créditos de IPI corretamente
            const totalCreditosIPI = 
              registros['E520'][0].vlCredIpi + 
              registros['E520'][0].vlOcIpi || 0;

            dadosCanonicos.parametrosFiscais.composicaoTributaria.debitos.ipi = totalDebitosIPI;
            dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.ipi = totalCreditosIPI;

            // Também atribuir ao campo creditos padrão
            dadosCanonicos.parametrosFiscais.creditos.ipi = totalCreditosIPI;
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

        // Validar e normalizar os dados - com verificação robusta
        try {
            if (window.DataManager && typeof window.DataManager.validarENormalizar === 'function') {
                return window.DataManager.validarENormalizar(dadosCanonicos);
            } else {
                console.warn('SPED-EXTRACTOR: DataManager.validarENormalizar não disponível, retornando dados sem validação');
                return dadosCanonicos;
            }
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao validar dados:', erro);
            
            // Log detalhado dos créditos extraídos
            console.log('=== SPED-EXTRACTOR: CRÉDITOS EXTRAÍDOS ===');
            if (dadosCanonicos.parametrosFiscais.composicaoTributaria) {
                console.log('Créditos PIS:', dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.pis);
                console.log('Créditos COFINS:', dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.cofins);
                console.log('Créditos ICMS:', dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.icms);
                console.log('Créditos IPI:', dadosCanonicos.parametrosFiscais.composicaoTributaria.creditos.ipi);
            } else {
                console.log('Estrutura composicaoTributaria não encontrada nos dados canônicos');
            }
            
            return dadosCanonicos;
        }
    }
    
    /**
     * Integra dados de múltiplos arquivos SPED
     * @param {Object} dadosFiscal - Dados extraídos do SPED Fiscal
     * @param {Object} dadosContribuicoes - Dados extraídos do SPED Contribuições
     * @returns {Object} - Dados integrados na estrutura aninhada
     */
    function integrarDados(dadosFiscal, dadosContribuicoes) {
        // Inicializar com estrutura canônica vazia - com verificação robusta
        let dadosIntegrados;
        try {
            // Verificar se DataManager e a função específica estão disponíveis
            if (window.DataManager && typeof window.DataManager.obterEstruturaAninhadaPadrao === 'function') {
                dadosIntegrados = window.DataManager.obterEstruturaAninhadaPadrao();
                console.log('SPED-EXTRACTOR: Estrutura canônica para integração obtida via DataManager');
            } else {
                // Fallback: criar estrutura manualmente
                console.warn('SPED-EXTRACTOR: DataManager.obterEstruturaAninhadaPadrao não disponível, usando estrutura padrão alternativa para integração');
                dadosIntegrados = criarEstruturaCanonica();
            }
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao obter estrutura canônica para integração:', erro);
            dadosIntegrados = criarEstruturaCanonica();
        }
        
        // Inicializar composicaoTributaria se não existir, para ambos os tipos de arquivo
        if (dadosIntegrados.parametrosFiscais && !dadosIntegrados.parametrosFiscais.composicaoTributaria) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria = {
                debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 }
            };
        }

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

        // Verificar e definir regime tributário baseado nos registros SPED
        if (dadosContribuicoes && dadosContribuicoes.registros && 
            dadosContribuicoes.registros['0110'] && dadosContribuicoes.registros['0110'].length > 0) {
            
            const reg0110 = dadosContribuicoes.registros['0110'][0];
            const codIncidencia = reg0110.codIncidencia;
            
            // Determinar regime tributário e regime PIS/COFINS
            if (codIncidencia === '2') {
                dadosIntegrados.parametrosFiscais.regimePisCofins = 'cumulativo';
                dadosIntegrados.empresa.regime = 'presumido';
                console.log('SPED-EXTRACTOR: Regime tributário detectado: PRESUMIDO (Cumulativo)');
            } else if (codIncidencia === '1') {
                dadosIntegrados.parametrosFiscais.regimePisCofins = 'nao-cumulativo';
                dadosIntegrados.empresa.regime = 'real';
                console.log('SPED-EXTRACTOR: Regime tributário detectado: REAL (Não Cumulativo)');
            } else {
                // Se não conseguir determinar pelo registro 0110, usar o valor padrão ou detectado anteriormente
                dadosIntegrados.empresa.regime = dadosContribuicoes?.empresa?.regime || dadosFiscal?.empresa?.regime || 'presumido';
            }
            
            // Adicionar flag para identificar o tipo de regime
            dadosIntegrados.parametrosFiscais.regimeTributarioDetectado = true;
        } else {
            // Se não tiver o registro 0110, usar o valor padrão ou detectado anteriormente
            dadosIntegrados.empresa.regime = dadosContribuicoes?.empresa?.regime || dadosFiscal?.empresa?.regime || 'presumido';
        }

        // Parâmetros Fiscais
        dadosIntegrados.parametrosFiscais.regimePisCofins = dadosContribuicoes?.parametrosFiscais?.regimePisCofins || 'cumulativo';
        
        // ICMS
        if (dadosFiscal && dadosFiscal.parametrosFiscais) {
          if (dadosFiscal.parametrosFiscais.composicaoTributaria?.debitos?.icms !== undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.icms = 
              dadosFiscal.parametrosFiscais.composicaoTributaria.debitos.icms;
          }

          if (dadosFiscal.parametrosFiscais.composicaoTributaria?.creditos?.icms !== undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.icms = 
              dadosFiscal.parametrosFiscais.composicaoTributaria.creditos.icms;

            dadosIntegrados.parametrosFiscais.creditos.icms = 
              dadosFiscal.parametrosFiscais.composicaoTributaria.creditos.icms;
          }

          // IPI
          if (dadosFiscal.parametrosFiscais.composicaoTributaria?.debitos?.ipi !== undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.ipi = 
              dadosFiscal.parametrosFiscais.composicaoTributaria.debitos.ipi;
          }

          if (dadosFiscal.parametrosFiscais.composicaoTributaria?.creditos?.ipi !== undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.ipi = 
              dadosFiscal.parametrosFiscais.composicaoTributaria.creditos.ipi;

            dadosIntegrados.parametrosFiscais.creditos.ipi = 
              dadosFiscal.parametrosFiscais.composicaoTributaria.creditos.ipi;
          }
        }

        // Garantir que valores não sejam undefined
        if (dadosIntegrados.parametrosFiscais.composicaoTributaria) {
          // ICMS
          if (dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.icms === undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.icms = 0;
          }
          if (dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.icms === undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.icms = 0;
            dadosIntegrados.parametrosFiscais.creditos.icms = 0;
          }

          // IPI
          if (dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.ipi === undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.debitos.ipi = 0;
          }
          if (dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.ipi === undefined) {
            dadosIntegrados.parametrosFiscais.composicaoTributaria.creditos.ipi = 0;
            dadosIntegrados.parametrosFiscais.creditos.ipi = 0;
          }
        }

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
            pis: dadosContribuicoes?.parametrosFiscais?.creditos?.pis || 
                 dadosContribuicoes?.parametrosFiscais?.composicaoTributaria?.creditos?.pis || 0,
            cofins: dadosContribuicoes?.parametrosFiscais?.creditos?.cofins || 
                    dadosContribuicoes?.parametrosFiscais?.composicaoTributaria?.creditos?.cofins || 0,
            icms: dadosFiscal?.parametrosFiscais?.creditos?.icms || 
                  dadosFiscal?.parametrosFiscais?.composicaoTributaria?.creditos?.icms || 0,
            ipi: dadosFiscal?.parametrosFiscais?.creditos?.ipi || 
                 dadosFiscal?.parametrosFiscais?.composicaoTributaria?.creditos?.ipi || 0,
            cbs: 0,
            ibs: 0
        };

        // Adicionar flag para identificar dados SPED
        dadosIntegrados.dadosSpedImportados = true;

        // Validar e normalizar os dados integrados - com verificação robusta
        try {
            if (window.DataManager && typeof window.DataManager.validarENormalizar === 'function') {
                return window.DataManager.validarENormalizar(dadosIntegrados);
            } else {
                console.warn('SPED-EXTRACTOR: DataManager.validarENormalizar não disponível, retornando dados integrados sem validação');
                return dadosIntegrados;
            }
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao validar dados integrados:', erro);
            return dadosIntegrados;
        }
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

// Log imediato para diagnóstico
console.log('SPED-EXTRACTOR: Módulo simplificado carregado com sucesso!');
console.log('SPED-EXTRACTOR: Versão', window.SpedExtractor.versao);