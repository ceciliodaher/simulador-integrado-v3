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
     */
    function parseValorMonetario(valorString) {
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
                return {
                    registro: tipoRegistro,
                    codVersao: colunas[1],
                    codFinalidade: colunas[2],
                    dataInicial: colunas[3],
                    dataFinal: colunas[4],
                    nome: colunas[5],
                    cnpj: colunas[6],
                    uf: colunas[7],
                    ie: colunas[8],
                    codMun: colunas[9],
                    im: colunas[10],
                    suframa: colunas[11]
                };
                
            case '0110': // Regime de apuração PIS/COFINS
                return {
                    registro: tipoRegistro,
                    codIncidencia: colunas[1],  // 1=Cumulativo, 2=Não-cumulativo, 3=Ambos
                    indMetodo: colunas[2],      // Método de apropriação
                    indTipoAtiv: colunas[3],    // Tipo de atividade
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
            
            case 'E110': // Apuração do ICMS
                return {
                    registro: tipoRegistro,
                    valorTotalDebitos: parseValorMonetario(colunas[1]),      // Total de débitos
                    valorTotalCreditos: parseValorMonetario(colunas[5]),     // Total de créditos
                    valorAjustesDebitos: parseValorMonetario(colunas[2]),    // Ajustes de débitos
                    valorAjustesCreditos: parseValorMonetario(colunas[6]),   // Ajustes de créditos
                    valorICMSRecolher: parseValorMonetario(colunas[12])      // ICMS a recolher
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
     */
    function extrairDadosParaSimulador(resultado) {
        const { tipoArquivo, registros } = resultado;
        
        const dados = {
            empresa: {},
            parametrosFiscais: {
                sistemaAtual: {
                    regimeTributario: 'real',
                    regimePISCOFINS: 'não-cumulativo'
                },
                composicaoTributaria: {
                    debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                    creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 }
                }
            },
            cicloFinanceiro: {
                prazoPagamento: 30,
                prazoRecebimento: 30,
                prazoEstoque: 30,
                percentualVista: 30,
                percentualPrazo: 70
            }
        };
        
        // Extrai dados da empresa
        if (registros['0000'] && registros['0000'].length > 0) {
            const reg0000 = registros['0000'][0];
            dados.empresa = {
                nome: reg0000.nome,
                cnpj: reg0000.cnpj,
                uf: reg0000.uf
            };
        }
        
        // Determina regime tributário pelo registro 0110
        if (registros['0110'] && registros['0110'].length > 0) {
            const reg0110 = registros['0110'][0];
            const codIncidencia = reg0110.codIncidencia;
            
            if (codIncidencia === '1') {
                dados.parametrosFiscais.sistemaAtual.regimePISCOFINS = 'cumulativo';
                dados.parametrosFiscais.sistemaAtual.regimeTributario = 'presumido';
            } else if (codIncidencia === '2') {
                dados.parametrosFiscais.sistemaAtual.regimePISCOFINS = 'não-cumulativo';
                dados.parametrosFiscais.sistemaAtual.regimeTributario = 'real';
            }
        }
        
        // Calcula faturamento e impostos pelo tipo de arquivo
        if (tipoArquivo === 'FISCAL') {
            // Calcular faturamento pelas notas de saída
            if (registros['C100']) {
                const notasSaida = registros['C100'].filter(nota => nota.indOper === '1');
                
                let valorTotalSaidas = 0;
                let totalICMS = 0;
                let totalIPI = 0;
                
                notasSaida.forEach(nota => {
                    valorTotalSaidas += nota.valorTotal || 0;
                    totalICMS += nota.valorIcms || 0;
                    totalIPI += nota.valorIpi || 0;
                });
                
                dados.empresa.faturamento = valorTotalSaidas;
                dados.parametrosFiscais.composicaoTributaria.debitos.icms = totalICMS;
                dados.parametrosFiscais.composicaoTributaria.debitos.ipi = totalIPI;
            }
            
            // Calcular créditos pelo registro E110
            if (registros['E110'] && registros['E110'].length > 0) {
                dados.parametrosFiscais.composicaoTributaria.creditos.icms = 
                    registros['E110'][0].valorTotalCreditos || 0;
            }
        } else if (tipoArquivo === 'CONTRIBUICOES') {
            // Calcular débitos de PIS
            if (registros['M210'] && registros['M210'].length > 0) {
                dados.parametrosFiscais.composicaoTributaria.debitos.pis = 
                    registros['M210'].reduce((total, reg) => total + (reg.valorContribPeriodo || 0), 0);
            }
            
            // Calcular débitos de COFINS
            if (registros['M610'] && registros['M610'].length > 0) {
                dados.parametrosFiscais.composicaoTributaria.debitos.cofins = 
                    registros['M610'].reduce((total, reg) => total + (reg.valorContribPeriodo || 0), 0);
            }
        }
        
        return dados;
    }
    
    /**
     * Integra dados de múltiplos arquivos SPED
     */
    function integrarDados(dadosFiscal, dadosContribuicoes) {
        const dadosIntegrados = {
            empresa: {
                nome: dadosFiscal?.empresa?.nome || dadosContribuicoes?.empresa?.nome || '',
                cnpj: dadosFiscal?.empresa?.cnpj || dadosContribuicoes?.empresa?.cnpj || '',
                faturamento: dadosFiscal?.empresa?.faturamento || 0
            },
            parametrosFiscais: {
                sistemaAtual: {
                    regimeTributario: dadosContribuicoes?.parametrosFiscais?.sistemaAtual?.regimeTributario || 
                                     dadosFiscal?.parametrosFiscais?.sistemaAtual?.regimeTributario || 'presumido',
                    regimePISCOFINS: dadosContribuicoes?.parametrosFiscais?.sistemaAtual?.regimePISCOFINS || 'cumulativo'
                },
                composicaoTributaria: {
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
                }
            },
            cicloFinanceiro: dadosFiscal?.cicloFinanceiro || dadosContribuicoes?.cicloFinanceiro || {
                prazoPagamento: 30,
                prazoRecebimento: 30,
                prazoEstoque: 30,
                percentualVista: 30,
                percentualPrazo: 70
            }
        };
        
        return dadosIntegrados;
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