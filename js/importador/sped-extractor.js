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

/**
 * Sistema de rastreamento da fonte dos dados
 */
const FonteDados = {
    SPED: 'sped',
    ESTIMADO: 'estimado',
    CALCULADO: 'calculado'
};

/**
 * Cria objeto com rastreamento de fonte
 */
function criarValorComFonte(valor, fonte = FonteDados.SPED, metadados = {}) {
    return {
        valor: parseValorMonetario(valor),
        fonte: fonte,
        metadados: {
            timestamp: new Date().toISOString(),
            ...metadados
        }
    };
}

/**
 * Extrai apenas o valor numérico, ignorando metadados de fonte
 */
function extrairValorNumerico(dadoComFonte) {
    if (typeof dadoComFonte === 'number') {
        return dadoComFonte;
    }
    if (dadoComFonte && typeof dadoComFonte === 'object' && dadoComFonte.valor !== undefined) {
        return dadoComFonte.valor;
    }
    return parseValorMonetario(dadoComFonte);
}

/**
 * Extrai e normaliza um valor percentual
 */
function extrairValorPercentual(valor) {
    if (typeof valor === 'number') {
        // Se já for um número, verificar se está em formato decimal e converter para percentual se necessário
        if (valor > 0 && valor <= 1) {
            return valor * 100;
        }
        return valor;
    }
    if (valor && typeof valor === 'object' && valor.valor !== undefined) {
        return extrairValorPercentual(valor.valor);
    }
    
    // Tentar converter string para número
    const valorNumerico = parseFloat(valor);
    if (!isNaN(valorNumerico)) {
        if (valorNumerico > 0 && valorNumerico <= 1) {
            return valorNumerico * 100;
        }
        return valorNumerico;
    }
    
    return 0;
}

    const SpedExtractor = (function() {

        /**
         * Extrai dados relevantes para o simulador a partir dos dados SPED
         * VERSÃO MELHORADA
         */
        function extrairDadosParaSimulador(dadosSped) {
            console.log('Extraindo dados para simulador...');

            // Estrutura padrão com valores iniciais
            const dados = {
                empresa: {},
                parametrosFiscais: {
                    sistemaAtual: {
                        regimeTributario: 'real', // padrão
                        regimePISCOFINS: 'não-cumulativo'
                    },
                    composicaoTributaria: {
                        debitos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 },
                        creditos: { pis: 0, cofins: 0, icms: 0, ipi: 0, iss: 0 }
                    },
                    aliquotasEfetivas: {
                        pisEfetivo: 0,
                        cofinsEfetivo: 0,
                        icmsEfetivo: 0,
                        ipiEfetivo: 0,
                        issEfetivo: 0
                    },
                    parametrosPIS: { aliquota: 1.65, baseCalculo: 100, percentualAproveitamento: 100 },
                    parametrosCOFINS: { aliquota: 7.6, baseCalculo: 100, percentualAproveitamento: 100 },
                    parametrosICMS: { aliquota: 18, baseCalculo: 60, percentualAproveitamento: 100 }
                },
                cicloFinanceiro: {
                    prazoPagamento: 30,
                    prazoRecebimento: 30,
                    prazoEstoque: 30,
                    cicloFinanceiro: 30,
                    percentualVista: 5,
                    percentualPrazo: 95
                },
                ivaConfig: {
                    cbs: 0.088,
                    ibs: 0.177,
                    categoriaIva: 'standard',
                    reducaoEspecial: 0
                },
                validacao: {
                    inconsistencias: [],
                    confiabilidade: 'alta'
                }
            };

            try {
                // Processar dados da empresa
                if (dadosSped.fiscal?.empresa || dadosSped.contribuicoes?.empresa || dadosSped.empresa) {
                    dados.empresa = extrairDadosEmpresa({
                        fiscal: dadosSped.fiscal,
                        contribuicoes: dadosSped.contribuicoes,
                        ecf: dadosSped.ecf,
                        empresa: dadosSped.empresa // Suporte direto para estrutura já processada
                    });
                }

                // Calcular faturamento mensal correto usando múltiplas fontes
                let faturamentoMensal = 0;

                // Prioridade 1: Dados do SPED Contribuições (mais confiáveis)
                if (dadosSped.contribuicoes?.receitas?.receitaBrutaTotal > 0) {
                    faturamentoMensal = dadosSped.contribuicoes.receitas.receitaBrutaTotal;
                } 
                // Prioridade 2: Dados do SPED Fiscal
                else if (dadosSped.fiscal?.totalizadores?.valorTotalSaidas > 0) {
                    faturamentoMensal = dadosSped.fiscal.totalizadores.valorTotalSaidas;
                }
                // Prioridade 3: Dados da ECF
                else if (dadosSped.ecf?.dre?.receita_liquida?.valor > 0) {
                    faturamentoMensal = dadosSped.ecf.dre.receita_liquida.valor;
                }
                // Prioridade 4: Cálculo baseado em documentos
                else if (dadosSped.documentos?.length > 0) {
                    const resultadoFaturamento = calcularFaturamentoPorDocumentos(dadosSped.documentos);
                    faturamentoMensal = resultadoFaturamento.faturamentoMensal;
                }

                dados.empresa.faturamento = faturamentoMensal;

                // Processar parâmetros fiscais
                if (dadosSped.fiscal || dadosSped.contribuicoes) {
                    const parametros = calcularParametrosFiscais(dadosSped.fiscal, dadosSped.contribuicoes);
                    dados.parametrosFiscais = { ...dados.parametrosFiscais, ...parametros };
                }

                // Extrair ciclo financeiro
                if (dadosSped.saldoClientes || dadosSped.saldoEstoques || dadosSped.saldoFornecedores) {
                    const ciclo = extrairCicloFinanceiro(dadosSped);
                    dados.cicloFinanceiro = { ...dados.cicloFinanceiro, ...ciclo };
                }

                // Extrair configuração IVA
                if (dadosSped.empresa && dados.parametrosFiscais) {
                    const ivaConfig = determinarSetorIVA(dadosSped.empresa, dados.parametrosFiscais);
                    dados.ivaConfig = { ...dados.ivaConfig, ...ivaConfig };
                }

                // Validar dados extraídos
                const problemas = validarDadosExtraidos(dados);
                if (problemas.length > 0) {
                    dados.validacao.inconsistencias = problemas;
                    dados.validacao.confiabilidade = problemas.length > 3 ? 'baixa' : 'média';
                }

                console.log(`Dados extraídos - Faturamento: R$ ${faturamentoMensal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
                console.log(`Confiabilidade: ${dados.validacao.confiabilidade}`);

                return dados;
            } catch (erro) {
                console.error('SPED-EXTRACTOR: Erro ao extrair dados:', erro);
                return {
                    ...dados,
                    validacao: {
                        inconsistencias: [`Erro ao processar dados: ${erro.message}`],
                        confiabilidade: 'baixa'
                    }
                };
            }
            // Dentro da função extrairDadosParaSimulador:

            // Adicionar estrutura para rastrear fontes dos dados
            const fontesDados = {
                pis: 'estimado',
                cofins: 'estimado',
                icms: 'estimado',
                ipi: 'estimado',
                iss: 'estimado'
            };

            // Ao processar parâmetros fiscais
            if (dadosSped.fiscal || dadosSped.contribuicoes) {
                const parametros = calcularParametrosFiscais(dadosSped.fiscal, dadosSped.contribuicoes);
                dados.parametrosFiscais = { ...dados.parametrosFiscais, ...parametros };

                // Adicionar fontesDados à composição tributária
                if (dados.parametrosFiscais.composicaoTributaria) {
                    dados.parametrosFiscais.composicaoTributaria.fontesDados = {
                        ...fontesDados,
                        ...parametros.composicaoTributaria?.fontesDados
                    };
                }
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
    // Melhorias para extrairDadosEmpresa em SpedExtractor.js
    function extrairDadosEmpresa(dadosSped) {
        console.log('SPED-EXTRACTOR: Extraindo dados da empresa...');
        console.log('SPED-EXTRACTOR: Dados de entrada:', {
            fiscalEmpresa: dadosSped.fiscal?.empresa ? Object.keys(dadosSped.fiscal.empresa) : 'Não disponível',
            contribuicoesEmpresa: dadosSped.contribuicoes?.empresa ? Object.keys(dadosSped.contribuicoes.empresa) : 'Não disponível',
            empresaDireta: dadosSped.empresa ? Object.keys(dadosSped.empresa) : 'Não disponível'
        });

        let empresa = {
            cnpj: '',
            nome: '',
            faturamentoMensal: 0,
            margem: 0.15,
            tipoEmpresa: 'comercio',
            regime: 'presumido'
        };

        try {
            // Verificar se empresa já existe nas propriedades do objeto
            if (dadosSped.empresa) {
                // Extrair explicitamente os campos que precisamos
                empresa.cnpj = dadosSped.empresa.cnpj || '';

                // Verificar EXPLICITAMENTE todas as possíveis fontes do nome
                if (dadosSped.empresa.nome && dadosSped.empresa.nome.trim() !== '') {
                    empresa.nome = dadosSped.empresa.nome;
                } else if (dadosSped.empresa.nomeEmpresarial && dadosSped.empresa.nomeEmpresarial.trim() !== '') {
                    empresa.nome = dadosSped.empresa.nomeEmpresarial;
                } else if (dadosSped.empresa.razaoSocial && dadosSped.empresa.razaoSocial.trim() !== '') {
                    empresa.nome = dadosSped.empresa.razaoSocial;
                }

                // Outros campos podem ser copiados diretamente
                if (dadosSped.empresa.tipoEmpresa) empresa.tipoEmpresa = dadosSped.empresa.tipoEmpresa;
                if (dadosSped.empresa.regime) empresa.regime = dadosSped.empresa.regime;
                if (dadosSped.empresa.faturamentoMensal) empresa.faturamentoMensal = dadosSped.empresa.faturamentoMensal;
                if (dadosSped.empresa.margem) empresa.margem = dadosSped.empresa.margem;

            } else if (dadosSped.fiscal?.empresa) {
                console.log('SPED-EXTRACTOR: Usando dados da empresa do SPED Fiscal');
                empresa.cnpj = dadosSped.fiscal.empresa.cnpj || '';

                // Verificar explicitamente todas as possíveis fontes do nome
                if (dadosSped.fiscal.empresa.nome && dadosSped.fiscal.empresa.nome.trim() !== '') {
                    empresa.nome = dadosSped.fiscal.empresa.nome;
                } else if (dadosSped.fiscal.empresa.nomeEmpresarial && dadosSped.fiscal.empresa.nomeEmpresarial.trim() !== '') {
                    empresa.nome = dadosSped.fiscal.empresa.nomeEmpresarial;
                } else if (dadosSped.fiscal.empresa.razaoSocial && dadosSped.fiscal.empresa.razaoSocial.trim() !== '') {
                    empresa.nome = dadosSped.fiscal.empresa.razaoSocial;
                }

                // Determinar tipo de empresa com base no SPED Fiscal
                empresa.tipoEmpresa = determinarTipoEmpresa(dadosSped.fiscal);
            } else if (dadosSped.contribuicoes?.empresa) {
                console.log('SPED-EXTRACTOR: Usando dados da empresa do SPED Contribuições');
                empresa.cnpj = dadosSped.contribuicoes.empresa.cnpj || '';

                // Verificar explicitamente todas as possíveis fontes do nome
                if (dadosSped.contribuicoes.empresa.nome && dadosSped.contribuicoes.empresa.nome.trim() !== '') {
                    empresa.nome = dadosSped.contribuicoes.empresa.nome;
                } else if (dadosSped.contribuicoes.empresa.nomeEmpresarial && dadosSped.contribuicoes.empresa.nomeEmpresarial.trim() !== '') {
                    empresa.nome = dadosSped.contribuicoes.empresa.nomeEmpresarial;
                } else if (dadosSped.contribuicoes.empresa.razaoSocial && dadosSped.contribuicoes.empresa.razaoSocial.trim() !== '') {
                    empresa.nome = dadosSped.contribuicoes.empresa.razaoSocial;
                }

                // Determinar regime com base no registro 0110 do SPED Contribuições
                if (dadosSped.contribuicoes.regimes?.pis_cofins?.codigoIncidencia) {
                    const codigo = dadosSped.contribuicoes.regimes.pis_cofins.codigoIncidencia;

                    if (codigo === '1') { // Exclusivamente não-cumulativo
                        empresa.regime = 'real';
                    } else if (codigo === '2') { // Exclusivamente cumulativo
                        empresa.regime = 'presumido';
                    } else if (codigo === '3') { // Misto
                        empresa.regime = 'real'; // Se é misto, provavelmente é Lucro Real
                    }
                }
            }

            // Calcular faturamento com base em várias fontes possíveis
            if (dadosSped.contribuicoes?.receitas?.receitaBrutaTotal > 0) {
                empresa.faturamentoMensal = dadosSped.contribuicoes.receitas.receitaBrutaTotal;
            } else if (dadosSped.fiscal?.totalizadores?.valorTotalSaidas > 0) {
                empresa.faturamentoMensal = dadosSped.fiscal.totalizadores.valorTotalSaidas;
            } else if (dadosSped.ecf?.dre?.receita_liquida?.valor > 0) {
                empresa.faturamentoMensal = dadosSped.ecf.dre.receita_liquida.valor;
            } else if (dadosSped.documentos?.length > 0) {
                const resultadoFaturamento = calcularFaturamentoPorDocumentos(dadosSped.documentos);
                empresa.faturamentoMensal = resultadoFaturamento.faturamentoMensal;
            } else {
                // Tentar método alternativo baseado em impostos
                empresa.faturamentoMensal = estimarFaturamentoPorImpostos(dadosSped);
            }

            // Calcular margem operacional usando dados da ECF, se disponíveis
            if (dadosSped.ecf?.dre?.resultado_operacional?.valor && 
                dadosSped.ecf?.dre?.receita_liquida?.valor > 0) {

                empresa.margem = dadosSped.ecf.dre.resultado_operacional.valor / 
                                dadosSped.ecf.dre.receita_liquida.valor;
            }
            
            // Validação final para garantir que o nome não esteja vazio
            if (!empresa.nome || empresa.nome.trim() === '') {
                console.warn('SPED-EXTRACTOR: Nome da empresa não encontrado em nenhuma fonte!');
                // Definir um nome genérico para evitar usar o CNPJ como fallback
                empresa.nome = "Empresa " + (empresa.cnpj ? `(CNPJ: ${empresa.cnpj})` : "Importada");
            }

            console.log('SPED-EXTRACTOR: Dados da empresa extraídos:', {
                nome: empresa.nome,
                cnpj: empresa.cnpj,
                tipoEmpresa: empresa.tipoEmpresa,
                regime: empresa.regime
            });

            return empresa;
        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao extrair dados da empresa:', erro);
            return empresa; // Retorna estrutura padrão em caso de erro
        }
    }

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
            // Extrair e validar o valor do documento
            let valorDoc = 0;
            if (typeof doc.valorTotal === 'number') {
                valorDoc = isNaN(doc.valorTotal) ? 0 : doc.valorTotal;
            } else if (typeof doc.valorTotal === 'string') {
                valorDoc = parseValorMonetario(doc.valorTotal);
            }

            // Validar se o valor está dentro de limites razoáveis
            if (valorDoc > 0 && valorDoc < 1000000000) { // Entre 0 e 1 bilhão
                faturamentoTotal += valorDoc;
            } else {
                console.warn(`SPED-EXTRACTOR: Valor anormal ignorado: ${valorDoc}`);
            }

            // Extrair e validar a data de emissão
            if (doc.dataEmissao) {
                const dataDoc = converterDataSped(doc.dataEmissao);
                if (!dataInicial || dataDoc < dataInicial) dataInicial = dataDoc;
                if (!dataFinal || dataDoc > dataFinal) dataFinal = dataDoc;
            }
        });

        // Calcular período de análise em meses
        let mesesPeriodo = 1; // Default para 1 mês se não conseguir calcular
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

    // Função para calcular faturamento mensal
    function calcularFaturamentoMensal(documentos) {
        if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
            console.warn('SPED-EXTRACTOR: Array de documentos inválido ou vazio');
            return 0;
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
            return 0;
        }

        let faturamentoTotal = 0;
        let dataInicial = null;
        let dataFinal = null;

        documentosSaida.forEach(doc => {
            // Validar o valor antes de somar
            let valorDoc = 0;
            if (typeof doc.valorTotal === 'number') {
                valorDoc = doc.valorTotal;
            } else if (typeof doc.valorTotal === 'string') {
                valorDoc = parseValorMonetario(doc.valorTotal);
            }

            // Verificar se o valor está dentro de limites razoáveis (entre 0 e 1 bilhão)
            if (valorDoc > 0 && valorDoc < 1000000000) {
                faturamentoTotal += valorDoc;
            } else {
                console.warn(`SPED-EXTRACTOR: Valor anormal ignorado: ${valorDoc}`);
            }

            // Registrar datas para cálculo do período
            if (doc.dataEmissao) {
                const dataDoc = converterDataSped(doc.dataEmissao);
                if (!dataInicial || dataDoc < dataInicial) dataInicial = dataDoc;
                if (!dataFinal || dataDoc > dataFinal) dataFinal = dataDoc;
            }
        });

        // Calcular período de análise em meses
        let mesesPeriodo = 1; // Default para 1 mês se não conseguir calcular
        if (dataInicial && dataFinal) {
            const diffTime = Math.abs(dataFinal - dataInicial);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            mesesPeriodo = Math.max(1, Math.ceil(diffDays / 30));

            console.log(`SPED-EXTRACTOR: Período de análise: ${dataInicial.toISOString()} a ${dataFinal.toISOString()} (${diffDays} dias, aproximadamente ${mesesPeriodo} meses)`);
        }

        // Calcular faturamento médio mensal
        const faturamentoMensal = faturamentoTotal / mesesPeriodo;

        console.log(`SPED-EXTRACTOR: Faturamento total: R$ ${faturamentoTotal.toFixed(2)}, Mensal: R$ ${faturamentoMensal.toFixed(2)}`);

        return faturamentoMensal;
    }

    // Função auxiliar para converter data do formato SPED (DDMMAAAA) para objeto Date
    function converterDataSped(dataSped) {
        if (!dataSped || dataSped.length !== 8) return new Date();

        try {
            const dia = parseInt(dataSped.substring(0, 2));
            const mes = parseInt(dataSped.substring(2, 4)) - 1; // Mês em JS é 0-based
            const ano = parseInt(dataSped.substring(4, 8));

            return new Date(ano, mes, dia);
        } catch (e) {
            console.warn('SPED-EXTRACTOR: Erro ao converter data:', dataSped, e);
            return new Date();
        }
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
    
    function calcularFaturamentoPorImpostos(dadosSped) {
        if (!dadosSped || typeof dadosSped !== 'object') {
            console.warn('SPED-EXTRACTOR: Dados SPED inválidos para cálculo por impostos');
            return 0;
        }

        // Tentar usar débitos de PIS/COFINS
        if (dadosSped.debitos?.pis?.length > 0) {
            const debitoPIS = extrairValorSeguro(dadosSped.debitos.pis[0], 'valorTotalContribuicao');
            if (debitoPIS > 0) {
                // Assumindo alíquota média de 0.65% para PIS cumulativo
                const faturamentoEstimado = debitoPIS / 0.0065;
                console.log(`SPED-EXTRACTOR: Faturamento estimado por PIS: ${faturamentoEstimado.toFixed(2)}`);
                return faturamentoEstimado;
            }
        }

        if (dadosSped.debitos?.cofins?.length > 0) {
            const debitoCOFINS = extrairValorSeguro(dadosSped.debitos.cofins[0], 'valorTotalContribuicao');
            if (debitoCOFINS > 0) {
                // Assumindo alíquota média de 3% para COFINS cumulativo
                const faturamentoEstimado = debitoCOFINS / 0.03;
                console.log(`SPED-EXTRACTOR: Faturamento estimado por COFINS: ${faturamentoEstimado.toFixed(2)}`);
                return faturamentoEstimado;
            }
        }

        // Tentar usar débitos de ICMS
        if (dadosSped.debitos?.icms?.length > 0) {
            const debitoICMS = extrairValorSeguro(dadosSped.debitos.icms[0], 'valorTotalDebitos');
            if (debitoICMS > 0) {
                // Assumindo alíquota média de 18% para ICMS
                const faturamentoEstimado = debitoICMS / 0.18;
                console.log(`SPED-EXTRACTOR: Faturamento estimado por ICMS: ${faturamentoEstimado.toFixed(2)}`);
                return faturamentoEstimado;
            }
        }

        console.warn('SPED-EXTRACTOR: Não foi possível estimar faturamento por impostos');
        return 0;
    }

    // Função auxiliar para extrair valores de forma segura
    function extrairValorSeguro(objeto, propriedade, valorPadrao = 0) {
        if (!objeto || typeof objeto !== 'object') return valorPadrao;

        const valor = objeto[propriedade];

        if (typeof valor === 'number') {
            // Verificar se o valor está dentro de limites razoáveis
            if (valor > 0 && valor < 1000000000) { // Entre 0 e 1 bilhão
                return valor;
            }
        } else if (typeof valor === 'string') {
            return parseValorMonetario(valor);
        } else if (Array.isArray(objeto) && objeto.length > 0) {
            // Pode ser um array de valores
            const valorArray = objeto.reduce((sum, item) => {
                if (item && item[propriedade]) {
                    const itemValor = typeof item[propriedade] === 'number' ? 
                                     item[propriedade] : 
                                     parseValorMonetario(item[propriedade]);
                    return sum + (itemValor > 0 ? itemValor : 0);
                }
                return sum;
            }, 0);

            if (valorArray > 0) return valorArray;
        }

        return valorPadrao;
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
        const resultadoFaturamento = calcularFaturamentoPorDocumentos(dadosSped.documentos || []);
        let faturamentoMensal = resultadoFaturamento.faturamentoMensal;

        // Se não encontrou faturamento pelos documentos, tenta método alternativo
        if (faturamentoMensal <= 0) {
            faturamentoMensal = estimarFaturamentoPorImpostos(dadosSped);
        }

        // Garantir que o faturamento está dentro de limites razoáveis
        if (faturamentoMensal <= 0 || faturamentoMensal >= 1000000000) {
            console.warn(`SPED-EXTRACTOR: Faturamento fora dos limites razoáveis: ${faturamentoMensal}. Usando valor padrão.`);
            faturamentoMensal = 0;
        }

        console.log(`SPED-EXTRACTOR: Faturamento efetivo para cálculo de impostos: ${faturamentoMensal}`);

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
        if (faturamentoMensal > 0) {
            // Garantir que os débitos e créditos são números válidos
            Object.keys(composicaoTributaria.debitos).forEach(imposto => {
                const debito = validarValorMonetario(composicaoTributaria.debitos[imposto]);
                const credito = validarValorMonetario(composicaoTributaria.creditos[imposto] || 0);

                // Calcular imposto líquido e alíquota efetiva
                const impostoLiquido = Math.max(0, debito - credito);
                const aliquotaEfetiva = (impostoLiquido / faturamentoMensal);

                // Validar e registrar a alíquota
                if (aliquotaEfetiva >= 0 && aliquotaEfetiva <= 1) {
                    composicaoTributaria.aliquotasEfetivas[imposto] = aliquotaEfetiva;
                    console.log(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} calculada: ${(aliquotaEfetiva * 100).toFixed(2)}%`);
                } else {
                    // Definir valores padrão seguros em caso de cálculo inválido
                    composicaoTributaria.aliquotasEfetivas[imposto] = imposto === 'pis' ? 0.0065 : 
                                                                    imposto === 'cofins' ? 0.03 : 
                                                                    imposto === 'icms' ? 0.18 : 0;
                    console.warn(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} inválida (${aliquotaEfetiva}), usando padrão`);
                }
            });

            // Calcular alíquota total
            const totalImpostoLiquido = Object.keys(composicaoTributaria.debitos).reduce((total, imposto) => {
                const debito = composicaoTributaria.debitos[imposto];
                const credito = composicaoTributaria.creditos[imposto] || 0;
                return total + Math.max(0, debito - credito);
            }, 0);

            const aliquotaTotal = (totalImpostoLiquido / faturamentoMensal);

            // Validar a alíquota total (deve estar entre 0 e 1)
            if (aliquotaTotal >= 0 && aliquotaTotal <= 1) {
                composicaoTributaria.aliquotasEfetivas.total = aliquotaTotal;
            } else {
                console.warn(`SPED-EXTRACTOR: Alíquota efetiva total fora dos limites: ${aliquotaTotal}`);
                composicaoTributaria.aliquotasEfetivas.total = 0;
            }

            console.log('SPED-EXTRACTOR: Alíquotas efetivas calculadas:', composicaoTributaria.aliquotasEfetivas);
        } else {
            console.warn('SPED-EXTRACTOR: Faturamento zero, não foi possível calcular alíquotas efetivas');
            // Definir alíquotas padrão
            composicaoTributaria.aliquotasEfetivas = {
                pis: 0.0065,
                cofins: 0.03,
                icms: 0.18,
                ipi: 0,
                iss: 0,
                total: 0.2165
            };
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
     * Calcula débitos de PIS diretamente do registro M200
     */
    function calcularDebitosPIS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos PIS');

        // PRIORIDADE 1: Utilizar diretamente o registro M200, campo 4 (VL_TOT_DEB_APU_PER)
        if (dadosSped.debitos?.pis?.length > 0) {
            // Procurar registro que corresponde ao M200
            const registroM200 = dadosSped.debitos.pis.find(reg => reg.origem === 'registro_m200');

            if (registroM200 && registroM200.valorTotalDebitos) {
                const valorDebito = parseValorMonetario(registroM200.valorTotalDebitos);
                console.log(`SPED-EXTRACTOR: Débito PIS extraído diretamente do registro M200: ${valorDebito}`);
                return valorDebito;
            }

            // Se não encontrou registro específico M200, mas tem débitos PIS genéricos
            const totalDebitoPIS = dadosSped.debitos.pis.reduce((sum, d) => 
                sum + parseValorMonetario(d.valorTotalDebitos || d.valorContribuicaoApurada || d.valorTotalContribuicao || d.valorContribuicaoAPagar || 0), 0
            );

            if (totalDebitoPIS > 0) {
                console.log(`SPED-EXTRACTOR: Débito PIS extraído da lista de débitos: ${totalDebitoPIS}`);
                return totalDebitoPIS;
            }
        }

        // PRIORIDADE 2: Se não encontrou no SPED, realizar estimativa básica
        if (faturamentoMensal > 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const regimePisCofins = determinarRegimePisCofins(dadosSped);

            let aliquotaPIS = regimePisCofins === 'nao-cumulativo' ? 0.0165 : 0.0065;
            const debitoEstimado = faturamentoMensal * aliquotaPIS;
            console.log(`SPED-EXTRACTOR: Débito PIS estimado como último recurso: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de COFINS diretamente do registro M600
     */
    function calcularDebitosCOFINS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos COFINS');

        // PRIORIDADE 1: Utilizar diretamente o registro M600, campo 4 (VL_TOT_DEB_APU_PER)
        if (dadosSped.debitos?.cofins?.length > 0) {
            // Procurar registro que corresponde ao M600
            const registroM600 = dadosSped.debitos.cofins.find(reg => reg.origem === 'registro_m600');

            if (registroM600 && registroM600.valorTotalDebitos) {
                const valorDebito = parseValorMonetario(registroM600.valorTotalDebitos);
                console.log(`SPED-EXTRACTOR: Débito COFINS extraído diretamente do registro M600: ${valorDebito}`);
                return valorDebito;
            }

            // Se não encontrou registro específico M600, mas tem débitos COFINS genéricos
            const totalDebitoCOFINS = dadosSped.debitos.cofins.reduce((sum, d) => 
                sum + parseValorMonetario(d.valorTotalDebitos || d.valorContribuicaoApurada || d.valorTotalContribuicao || d.valorContribuicaoAPagar || 0), 0
            );

            if (totalDebitoCOFINS > 0) {
                console.log(`SPED-EXTRACTOR: Débito COFINS extraído da lista de débitos: ${totalDebitoCOFINS}`);
                return totalDebitoCOFINS;
            }
        }

        // PRIORIDADE 2: Se não encontrou no SPED, realizar estimativa básica
        if (faturamentoMensal > 0) {
            const regime = determinarRegimeTributario(dadosSped);
            const regimePisCofins = determinarRegimePisCofins(dadosSped);

            let aliquotaCOFINS = regimePisCofins === 'nao-cumulativo' ? 0.076 : 0.03;
            const debitoEstimado = faturamentoMensal * aliquotaCOFINS;
            console.log(`SPED-EXTRACTOR: Débito COFINS estimado como último recurso: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de ICMS diretamente do registro E110
     */
    function calcularDebitosICMS(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos ICMS');

        // PRIORIDADE 1: Utilizar diretamente o registro E110, campo 2 (VL_TOT_DEBITOS)
        if (dadosSped.debitos?.icms?.length > 0) {
            // Procurar registro que corresponde ao E110
            const registroE110 = dadosSped.debitos.icms.find(reg => 
                reg.valorTotalDebitos !== undefined || reg.origem === 'registro_e110');

            if (registroE110 && registroE110.valorTotalDebitos) {
                const valorDebito = parseValorMonetario(registroE110.valorTotalDebitos);
                console.log(`SPED-EXTRACTOR: Débito ICMS extraído diretamente do registro E110: ${valorDebito}`);
                return valorDebito;
            }

            // Se não encontrou registro específico E110, mas tem débitos ICMS genéricos
            const totalDebitoICMS = dadosSped.debitos.icms.reduce((sum, d) => 
                sum + parseValorMonetario(d.valorTotalDebitos || d.valorSaldoAPagar || 0), 0
            );

            if (totalDebitoICMS > 0) {
                console.log(`SPED-EXTRACTOR: Débito ICMS extraído da lista de débitos: ${totalDebitoICMS}`);
                return totalDebitoICMS;
            }
        }

        // PRIORIDADE 2: Verificar registros C190 (analíticos por CST/CFOP/Alíquota)
        if (dadosSped.itensAnaliticos?.length > 0) {
            // Filtrar apenas registros de saída (CFOP 5xxx e 6xxx)
            const registrosSaida = dadosSped.itensAnaliticos.filter(reg => {
                const cfop = reg.cfop || '';
                return (cfop.startsWith('5') || cfop.startsWith('6')) && reg.valorIcms > 0;
            });

            const valorICMS = registrosSaida.reduce((total, reg) => total + parseValorMonetario(reg.valorIcms || 0), 0);

            if (valorICMS > 0) {
                console.log(`SPED-EXTRACTOR: Débito ICMS calculado a partir de itens analíticos: ${valorICMS}`);
                return valorICMS;
            }
        }

        // PRIORIDADE 3: Estimativa básica como último recurso
        if (faturamentoMensal > 0) {
            const aliquotaMedia = obterAliquotaMediaEstado(dadosSped.empresa?.uf || 'SP');
            const baseCalculoPercentual = 0.6; // 60% do faturamento sujeito ao ICMS
            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito ICMS estimado como último recurso: ${debitoEstimado}`);
            return debitoEstimado;
        }

        return 0;
    }

    /**
     * Calcula débitos de IPI diretamente do registro E200
     */
    function calcularDebitosIPI(dadosSped, faturamentoMensal) {
        console.log('SPED-EXTRACTOR: Calculando débitos IPI');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é indústria, débito IPI = 0');
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Utilizar diretamente o registro E200, campo 2 (VL_TOT_DEBITOS)
        if (dadosSped.debitos?.ipi?.length > 0) {
            // Procurar registro que corresponde ao E200
            const registroE200 = dadosSped.debitos.ipi.find(reg => 
                reg.valorTotalDebitos !== undefined || reg.origem === 'registro_e200');

            if (registroE200 && registroE200.valorTotalDebitos) {
                const valorDebito = parseValorMonetario(registroE200.valorTotalDebitos);
                console.log(`SPED-EXTRACTOR: Débito IPI extraído diretamente do registro E200: ${valorDebito}`);
                return valorDebito;
            }
        }

        // PRIORIDADE 2: Verificar registros específicos de IPI
        if (dadosSped.impostos?.ipi?.length > 0) {
            const totalDebitos = dadosSped.impostos.ipi.reduce((total, apuracao) => {
                const valor = parseValorMonetario(apuracao.valorTotalDebitos || 0);
                return total + valor;
            }, 0);

            if (totalDebitos > 0) {
                console.log('SPED-EXTRACTOR: Débitos IPI extraídos dos registros de impostos:', totalDebitos);
                return totalDebitos;
            }
        }

        // PRIORIDADE 3: Estimativa básica como último recurso
        if (faturamentoMensal > 0) {
            const aliquotaMedia = 0.10; // 10% como média
            const baseCalculoPercentual = 0.4; // 40% do faturamento sujeito ao IPI
            const debitoEstimado = faturamentoMensal * baseCalculoPercentual * aliquotaMedia;
            console.log(`SPED-EXTRACTOR: Débito IPI estimado como último recurso: ${debitoEstimado}`);
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
     * Calcula créditos de PIS diretamente do registro M200
     */
    function calcularCreditosPIS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos PIS');

        // PRIORIDADE 1: Utilizar diretamente o registro M200, campo 6 (VL_TOT_CRED_DESC_PER)
        if (dadosSped.debitos?.pis?.length > 0) {
            // Procurar registro que corresponde ao M200
            const registroM200 = dadosSped.debitos.pis.find(reg => reg.origem === 'registro_m200');

            if (registroM200 && registroM200.valorCredito) {
                const valorCredito = parseValorMonetario(registroM200.valorCredito);
                console.log(`SPED-EXTRACTOR: Crédito PIS extraído diretamente do registro M200: ${valorCredito}`);
                return valorCredito;
            }
        }

        // PRIORIDADE 2: Verificar lista de créditos específicos
        if (dadosSped.creditos?.pis?.length > 0) {
            const totalCreditos = dadosSped.creditos.pis.reduce((total, credito) => {
                const valor = parseValorMonetario(credito.valorCredito || credito.valorCreditoDisp || 0);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log(`SPED-EXTRACTOR: Créditos PIS extraídos da lista de créditos: ${totalCreditos}`);
                return totalCreditos;
            }
        }

        // Se não encontrou créditos, retorna zero
        console.log('SPED-EXTRACTOR: Nenhum crédito PIS encontrado');
        return 0;
    }

    /**
     * Calcula créditos de COFINS diretamente do registro M600
     */
    function calcularCreditosCOFINS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos COFINS');

        // PRIORIDADE 1: Utilizar diretamente o registro M600, campo 6 (VL_TOT_CRED_DESC_PER)
        if (dadosSped.debitos?.cofins?.length > 0) {
            // Procurar registro que corresponde ao M600
            const registroM600 = dadosSped.debitos.cofins.find(reg => reg.origem === 'registro_m600');

            if (registroM600 && registroM600.valorCredito) {
                const valorCredito = parseValorMonetario(registroM600.valorCredito);
                console.log(`SPED-EXTRACTOR: Crédito COFINS extraído diretamente do registro M600: ${valorCredito}`);
                return valorCredito;
            }
        }

        // PRIORIDADE 2: Verificar lista de créditos específicos
        if (dadosSped.creditos?.cofins?.length > 0) {
            const totalCreditos = dadosSped.creditos.cofins.reduce((total, credito) => {
                const valor = parseValorMonetario(credito.valorCredito || credito.valorCreditoDisp || 0);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log(`SPED-EXTRACTOR: Créditos COFINS extraídos da lista de créditos: ${totalCreditos}`);
                return totalCreditos;
            }
        }

        // Se não encontrou créditos, retorna zero
        console.log('SPED-EXTRACTOR: Nenhum crédito COFINS encontrado');
        return 0;
    }

    /**
     * Calcula créditos de ICMS diretamente do registro E110
     */
    function calcularCreditosICMS(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos ICMS');

        // PRIORIDADE 1: Utilizar diretamente o registro E110, campo 6 (VL_TOT_CREDITOS)
        if (dadosSped.debitos?.icms?.length > 0) {
            // Procurar registro que corresponde ao E110
            const registroE110 = dadosSped.debitos.icms.find(reg => 
                reg.valorTotalCreditos !== undefined || reg.origem === 'registro_e110');

            if (registroE110 && registroE110.valorTotalCreditos) {
                const valorCredito = parseValorMonetario(registroE110.valorTotalCreditos);
                console.log(`SPED-EXTRACTOR: Crédito ICMS extraído diretamente do registro E110: ${valorCredito}`);
                return valorCredito;
            }
        }

        // PRIORIDADE 2: Verificar lista de créditos específicos
        if (dadosSped.creditos?.icms?.length > 0) {
            const totalCreditos = dadosSped.creditos.icms.reduce((total, credito) => {
                const valor = parseValorMonetario(credito.valorCredito || 0);
                return total + valor;
            }, 0);

            if (totalCreditos > 0) {
                console.log(`SPED-EXTRACTOR: Créditos ICMS extraídos da lista de créditos: ${totalCreditos}`);
                return totalCreditos;
            }
        }

        // PRIORIDADE 3: Verificar registros C190 para entradas
        if (dadosSped.itensAnaliticos?.length > 0) {
            // Filtrar apenas registros de entrada (CFOP 1xxx, 2xxx e 3xxx)
            const registrosEntrada = dadosSped.itensAnaliticos.filter(item => {
                const cfop = item.cfop || '';
                return (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3')) && item.valorIcms > 0;
            });

            if (registrosEntrada.length > 0) {
                const creditosItens = registrosEntrada.reduce((total, item) => 
                    total + parseValorMonetario(item.valorIcms || 0), 0);

                if (creditosItens > 0) {
                    console.log(`SPED-EXTRACTOR: Créditos ICMS calculados a partir de itens analíticos: ${creditosItens}`);
                    return creditosItens;
                }
            }
        }

        // Se não encontrou créditos, retorna zero
        console.log('SPED-EXTRACTOR: Nenhum crédito ICMS encontrado');
        return 0;
    }

    /**
     * Obtém as operações agrupadas por CFOP
     * @param {Array} documentos - Documentos fiscais
     * @returns {Object} - Mapa de CFOP para valor total
     */
    function obterOperacoesPorCFOP(documentos) {
        const cfopMap = {};

        if (!Array.isArray(documentos)) return cfopMap;

        documentos.forEach(doc => {
            if (!doc || !doc.cfop) return;

            const cfop = doc.cfop;
            const valor = doc.valorTotal || doc.valorOperacao || 0;

            if (valor > 0) {
                if (!cfopMap[cfop]) {
                    cfopMap[cfop] = 0;
                }
                cfopMap[cfop] += valor;
            }
        });

        return cfopMap;
    }

    /**
     * Obtém a alíquota média de ICMS do estado
     * @param {string} uf - Sigla do estado
     * @returns {number} - Alíquota média em decimal
     */
    function obterAliquotaMediaEstado(uf) {
        // Mapeamento de alíquotas médias por estado
        const aliquotasPorUf = {
            'AC': 0.19, // Acre - Mantido conforme [4][6]
            'AL': 0.20, // Alagoas - Aumento para 20% com FECOEP [6][9]
            'AP': 0.18, // Amapá - Mantido conforme [4][6]
            'AM': 0.20, // Amazonas - Mantido conforme [6][9]
            'BA': 0.205, // Bahia - Aumento para 20.5% [6][9][12]
            'CE': 0.20, // Ceará - Aumento para 20% [6][9]
            'DF': 0.20, // Distrito Federal - Aumento para 20% [6][9]
            'ES': 0.17, // Espírito Santo - Mantido [4][9]
            'GO': 0.19, // Goiás - Confirmado 19% desde 2024 [9]
            'MA': 0.23, // Maranhão - Majoração para 23% em 2025 [6][12][13]
            'MT': 0.17, // Mato Grosso - Mantido [4][6]
            'MS': 0.17, // Mato Grosso do Sul - Mantido [4][6]
            'MG': 0.18, // Minas Gerais - Mantido [4][6]
            'PA': 0.19, // Pará - Mantido [6][9]
            'PB': 0.20, // Paraíba - Aumento para 20% [6][9]
            'PR': 0.195, // Paraná - Ajuste para 19.5% [6][9]
            'PE': 0.205, // Pernambuco - Aumento para 20.5% [6][9]
            'PI': 0.225, // Piauí - Majoração para 22.5% [12][13]
            'RJ': 0.20, // Rio de Janeiro - Mantido com adicional FECP [6][9]
            'RN': 0.20, // Rio Grande do Norte - Aumento para 20% [12][13]
            'RS': 0.17, // Rio Grande do Sul - Mantido [4][6]
            'RO': 0.195, // Rondônia - Aumento para 19.5% [9]
            'RR': 0.20, // Roraima - Mantido [6]
            'SC': 0.17, // Santa Catarina - Mantido [4][6]
            'SP': 0.18, // São Paulo - Mantido [4][6]
            'SE': 0.20, // Sergipe - Aumento com FECOEP [6][13]
            'TO': 0.20  // Tocantins - Aumento para 20% [6][9]
        };

        // Converter para maiúsculas e obter alíquota ou usar padrão de 18%
        const ufUpper = (uf || '').toUpperCase();
        return aliquotasPorUf[ufUpper] || 0.18;
    }

    /**
     * Calcula créditos de IPI diretamente do registro E200
     */
    function calcularCreditosIPI(dadosSped) {
        console.log('SPED-EXTRACTOR: Calculando créditos IPI');

        const tipoEmpresa = determinarTipoEmpresa(dadosSped);
        if (tipoEmpresa !== 'industria') {
            console.log('SPED-EXTRACTOR: Tipo de empresa não é indústria, crédito IPI = 0');
            return 0; // IPI só se aplica à indústria
        }

        // PRIORIDADE 1: Utilizar diretamente o registro E200, campo 3 (VL_TOT_CREDITOS)
        if (dadosSped.debitos?.ipi?.length > 0) {
            // Procurar registro que corresponde ao E200
            const registroE200 = dadosSped.debitos.ipi.find(reg => 
                reg.valorTotalCreditos !== undefined || reg.origem === 'registro_e200');

            if (registroE200 && registroE200.valorTotalCreditos) {
                const valorCredito = parseValorMonetario(registroE200.valorTotalCreditos);
                console.log(`SPED-EXTRACTOR: Crédito IPI extraído diretamente do registro E200: ${valorCredito}`);
                return valorCredito;
            }
        }

        // PRIORIDADE 2: Verificar registros específicos de créditos IPI
        if (dadosSped.creditos?.ipi?.length > 0) {
            const valorCreditos = dadosSped.creditos.ipi.reduce((total, cred) => 
                total + parseValorMonetario(cred.valorCredito || cred.valorTotalCreditos || 0), 0);

            if (valorCreditos > 0) {
                console.log('SPED-EXTRACTOR: Créditos IPI encontrados em registros específicos:', valorCreditos);
                return valorCreditos;
            }
        }

        // PRIORIDADE 3: Verificar itens analíticos de entrada
        if (dadosSped.itensAnaliticos?.length > 0) {
            const itensEntrada = dadosSped.itensAnaliticos.filter(item => 
                item && item.valorIpi > 0 && (
                    item.cfop?.startsWith('1') || 
                    item.cfop?.startsWith('2') || 
                    item.cfop?.startsWith('3')
                )
            );

            if (itensEntrada.length > 0) {
                const creditosIPI = itensEntrada.reduce((total, item) => 
                    total + parseValorMonetario(item.valorIpi || 0), 0);

                if (creditosIPI > 0) {
                    console.log(`SPED-EXTRACTOR: Créditos IPI calculados a partir de itens analíticos: ${creditosIPI}`);
                    return creditosIPI;
                }
            }
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

        // Inferir pelo registro 0110 do SPED Contribuições
        if (dadosSped.contribuicoes?.regimes?.pis_cofins?.codigoIncidencia) {
            const codigo = dadosSped.contribuicoes.regimes.pis_cofins.codigoIncidencia;
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
        console.log('SPED-EXTRACTOR: Extraindo dados do ciclo financeiro');

        // Valores padrão
        const ciclo = {
            pmr: 30, // Prazo Médio de Recebimento (dias)
            pmp: 30, // Prazo Médio de Pagamento (dias)
            pme: 30, // Prazo Médio de Estocagem (dias)
            percVista: 0.3, // Percentual de vendas à vista
            percPrazo: 0.7 // Percentual de vendas a prazo
        };

        try {
            // Tentar extrair dados do ciclo financeiro a partir dos dados contábeis
            if (dadosSped.saldoClientes && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
                // Validar valores
                const saldoClientes = validarValorSeguro(dadosSped.saldoClientes);
                const receitaBruta = validarValorSeguro(dadosSped.receitaBruta);

                if (saldoClientes > 0 && receitaBruta > 0) {
                    // Calcular PMR: (Contas a Receber / Receita Bruta) * dias no período
                    const pmrCalculado = Math.round((saldoClientes / (receitaBruta / 12)) * 30);

                    // Validar resultado
                    if (pmrCalculado > 0 && pmrCalculado <= 180) {
                        ciclo.pmr = pmrCalculado;
                        console.log(`SPED-EXTRACTOR: PMR calculado: ${pmrCalculado} dias`);
                    } else {
                        console.warn(`SPED-EXTRACTOR: PMR calculado fora dos limites: ${pmrCalculado}, usando padrão`);
                    }
                }
            }

            if (dadosSped.saldoFornecedores && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
                // Validar valores
                const saldoFornecedores = validarValorSeguro(dadosSped.saldoFornecedores);
                const receitaBruta = validarValorSeguro(dadosSped.receitaBruta);

                if (saldoFornecedores > 0 && receitaBruta > 0) {
                    // Estimar compras como um percentual da receita
                    const comprasEstimadas = receitaBruta * 0.6; // 60% da receita

                    // Calcular PMP: (Contas a Pagar / Compras) * dias no período
                    const pmpCalculado = Math.round((saldoFornecedores / (comprasEstimadas / 12)) * 30);

                    // Validar resultado
                    if (pmpCalculado > 0 && pmpCalculado <= 180) {
                        ciclo.pmp = pmpCalculado;
                        console.log(`SPED-EXTRACTOR: PMP calculado: ${pmpCalculado} dias`);
                    } else {
                        console.warn(`SPED-EXTRACTOR: PMP calculado fora dos limites: ${pmpCalculado}, usando padrão`);
                    }
                }
            }

            if (dadosSped.saldoEstoques && dadosSped.receitaBruta && dadosSped.receitaBruta > 0) {
                // Validar valores
                const saldoEstoques = validarValorSeguro(dadosSped.saldoEstoques);
                const receitaBruta = validarValorSeguro(dadosSped.receitaBruta);

                if (saldoEstoques > 0 && receitaBruta > 0) {
                    // Estimar CMV como um percentual da receita
                    const cmvEstimado = receitaBruta * 0.7; // 70% da receita

                    // Calcular PME: (Estoque / CMV) * dias no período
                    const pmeCalculado = Math.round((saldoEstoques / (cmvEstimado / 12)) * 30);

                    // Validar resultado
                    if (pmeCalculado > 0 && pmeCalculado <= 180) {
                        ciclo.pme = pmeCalculado;
                        console.log(`SPED-EXTRACTOR: PME calculado: ${pmeCalculado} dias`);
                    } else {
                        console.warn(`SPED-EXTRACTOR: PME calculado fora dos limites: ${pmeCalculado}, usando padrão`);
                    }
                }
            }

            // Calcular percentual de vendas à vista com base nos documentos
            if (dadosSped.documentos?.length > 0) {
                const resultado = analisarVendasVista(dadosSped.documentos);

                // Validar resultados
                if (resultado.percVista >= 0 && resultado.percVista <= 1) {
                    ciclo.percVista = resultado.percVista;
                    ciclo.percPrazo = resultado.percPrazo;
                    console.log(`SPED-EXTRACTOR: Percentual de vendas à vista calculado: ${(ciclo.percVista * 100).toFixed(1)}%`);
                }
            }
        } catch (erro) {
            console.warn('SPED-EXTRACTOR: Erro ao calcular ciclo financeiro:', erro);
        }

        console.log('SPED-EXTRACTOR: Ciclo financeiro calculado:', ciclo);
        return ciclo;
    }

    // Função auxiliar para validar valores
    function validarValorSeguro(valor, padrao = 0) {
        if (typeof valor === 'number') {
            if (!isNaN(valor) && valor >= 0 && valor < 1000000000) { // Entre 0 e 1 bilhão
                return valor;
            }
        } else if (typeof valor === 'string') {
            const valorNumerico = parseValorMonetario(valor);
            if (valorNumerico >= 0 && valorNumerico < 1000000000) { // Entre 0 e 1 bilhão
                return valorNumerico;
            }
        }

        return padrao;
    }
    
    /**
     * Analisa percentual de vendas à vista
     */
    function analisarVendasVista(documentos) {
        if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
            return { percVista: 0.3, percPrazo: 0.7 }; // Valores padrão
        }

        // Filtrar documentos de saída
        const documentosSaida = documentos.filter(doc => 
            doc && typeof doc === 'object' && doc.indOper === '1'
        );

        if (documentosSaida.length === 0) {
            return { percVista: 0.3, percPrazo: 0.7 }; // Valores padrão
        }

        let valorTotalVendas = 0;
        let valorVendasVista = 0;

        documentosSaida.forEach(doc => {
            // Extrair e validar o valor do documento
            const valorDoc = validarValorSeguro(doc.valorTotal);

            if (valorDoc > 0) {
                valorTotalVendas += valorDoc;

                // Critérios para identificar venda à vista
                if (doc.modelo === '65' || doc.condicaoPagamento === '0' || doc.formaPagamento === 'vista') {
                    valorVendasVista += valorDoc;
                }
            }
        });

        if (valorTotalVendas <= 0) {
            return { percVista: 0.3, percPrazo: 0.7 }; // Valores padrão
        }

        // Calcular percentuais
        const percVista = valorVendasVista / valorTotalVendas;

        // Garantir que o percentual está entre 5% e 95%
        const percVistaValidado = Math.max(0.05, Math.min(0.95, percVista));

        return { 
            percVista: percVistaValidado, 
            percPrazo: 1 - percVistaValidado 
        };
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
    
    /**
     * Extrai dados financeiros do SPED ECF e outros
     */
    function extrairDadosFinanceiros(dadosSped) {
        console.log('SPED-EXTRACTOR: Extraindo dados financeiros');

        const dadosFinanceiros = {
            receitaBruta: 0,
            receitaLiquida: 0,
            custoTotal: 0,
            despesasOperacionais: 0,
            lucroOperacional: 0,
            margem: 0.15 // padrão
        };

        try {
            // Extrair da ECF (mais confiável para dados financeiros)
            if (dadosSped.ecf?.demonstracaoResultado?.length > 0) {
                const dre = dadosSped.ecf.demonstracaoResultado;

                // Buscar receita bruta
                const receitaBruta = dre.find(conta => 
                    conta.codigoConta?.startsWith('3.01') || 
                    conta.descricao?.toLowerCase().includes('receita') && 
                    conta.descricao?.toLowerCase().includes('bruta')
                );
                if (receitaBruta) {
                    dadosFinanceiros.receitaBruta = parseValorMonetario(receitaBruta.valor || receitaBruta.saldo);
                }

                // Buscar receita líquida
                const receitaLiquida = dre.find(conta => 
                    conta.codigoConta?.startsWith('3.02') || 
                    conta.descricao?.toLowerCase().includes('receita') && 
                    conta.descricao?.toLowerCase().includes('líquida')
                );
                if (receitaLiquida) {
                    dadosFinanceiros.receitaLiquida = parseValorMonetario(receitaLiquida.valor || receitaLiquida.saldo);
                }

                // Buscar custo das vendas
                const custoVendas = dre.find(conta => 
                    conta.codigoConta?.startsWith('3.03') || 
                    conta.descricao?.toLowerCase().includes('custo') && 
                    (conta.descricao?.toLowerCase().includes('vendas') || conta.descricao?.toLowerCase().includes('mercadorias'))
                );
                if (custoVendas) {
                    dadosFinanceiros.custoTotal = parseValorMonetario(custoVendas.valor || custoVendas.saldo);
                }

                // Buscar despesas operacionais
                const despesasOper = dre.filter(conta => 
                    conta.codigoConta?.startsWith('3.04') || 
                    conta.descricao?.toLowerCase().includes('despesas') && 
                    conta.descricao?.toLowerCase().includes('operacionais')
                );
                if (despesasOper.length > 0) {
                    dadosFinanceiros.despesasOperacionais = despesasOper.reduce((sum, conta) => 
                        sum + parseValorMonetario(conta.valor || conta.saldo), 0
                    );
                }

                // Calcular lucro operacional
                dadosFinanceiros.lucroOperacional = dadosFinanceiros.receitaLiquida - 
                                                   dadosFinanceiros.custoTotal - 
                                                   dadosFinanceiros.despesasOperacionais;

                // Calcular margem
                if (dadosFinanceiros.receitaLiquida > 0) {
                    dadosFinanceiros.margem = dadosFinanceiros.lucroOperacional / dadosFinanceiros.receitaLiquida;
                }
            }

            // Fallback: tentar estimar baseado em outros dados disponíveis
            if (dadosFinanceiros.receitaBruta === 0) {
                // Usar faturamento do SPED Fiscal ou Contribuições
                if (dadosSped.empresa?.faturamento > 0) {
                    dadosFinanceiros.receitaBruta = dadosSped.empresa.faturamento;
                    dadosFinanceiros.receitaLiquida = dadosFinanceiros.receitaBruta * 0.9; // Estimativa: 10% de deduções
                }
            }

            // Validar e ajustar valores
            if (dadosFinanceiros.custoTotal === 0 && dadosFinanceiros.receitaLiquida > 0) {
                // Estimar custo como 60% da receita líquida (padrão para comércio)
                dadosFinanceiros.custoTotal = dadosFinanceiros.receitaLiquida * 0.6;
            }

            console.log('SPED-EXTRACTOR: Dados financeiros extraídos:', dadosFinanceiros);
            return dadosFinanceiros;

        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao extrair dados financeiros:', erro);
            return dadosFinanceiros;
        }
    }
    
    /**
     * Processa arquivo SPED Fiscal (EFD ICMS/IPI)
     * @param {Array} linhas - Linhas do arquivo SPED
     * @returns {Object} Dados processados do SPED Fiscal
     */
    function processarSPEDFiscal(linhas) {
        const dados = {
            empresa: {},
            documentos: [],
            resumosICMS: [],
            apuracaoICMS: null,
            totalizadores: {
                valorTotalSaidas: 0,
                baseCalculoICMS: 0,
                valorICMS: 0,
                valorIPI: 0
            }
        };

        let empresaProcessada = false;

        for (const linha of linhas) {
            try {
                const campos = linha.split('|');
                const registro = campos[1];

                switch (registro) {
                    case '0000':
                        if (!empresaProcessada) {
                            dados.empresa = {
                                cnpj: campos[8],
                                nome: campos[9],
                                ie: campos[10],
                                uf: campos[11],
                                municipio: campos[14]
                            };
                            empresaProcessada = true;
                        }
                        break;

                    case 'C100':
                        // Processar apenas saídas (CFOP 5xxx e 6xxx)
                        const cfop = campos[13];
                        if (cfop && (cfop.startsWith('5') || cfop.startsWith('6'))) {
                            const documento = {
                                tipo: 'saida',
                                cfop: cfop,
                                valorTotal: parseFloat(campos[17]?.replace(',', '.') || 0),
                                valorProdutos: parseFloat(campos[18]?.replace(',', '.') || 0),
                                baseCalculoICMS: parseFloat(campos[19]?.replace(',', '.') || 0),
                                valorICMS: parseFloat(campos[20]?.replace(',', '.') || 0),
                                valorIPI: parseFloat(campos[24]?.replace(',', '.') || 0)
                            };
                            dados.documentos.push(documento);

                            // Acumular totalizadores
                            dados.totalizadores.valorTotalSaidas += documento.valorTotal;
                            dados.totalizadores.baseCalculoICMS += documento.baseCalculoICMS;
                            dados.totalizadores.valorICMS += documento.valorICMS;
                            dados.totalizadores.valorIPI += documento.valorIPI;
                        }
                        break;

                    case 'C190':
                        // Resumo por CST/CFOP/Alíquota
                        const resumo = {
                            cst: campos[2],
                            cfop: campos[3],
                            aliquota: parseFloat(campos[4]?.replace(',', '.') || 0),
                            valorContabil: parseFloat(campos[5]?.replace(',', '.') || 0),
                            baseCalculo: parseFloat(campos[6]?.replace(',', '.') || 0),
                            valorImposto: parseFloat(campos[7]?.replace(',', '.') || 0)
                        };
                        dados.resumosICMS.push(resumo);
                        break;

                    case 'E110':
                        // Apuração do ICMS
                        dados.apuracaoICMS = {
                            valorTotalDebitos: parseFloat(campos[2]?.replace(',', '.') || 0),
                            valorTotalCreditos: parseFloat(campos[3]?.replace(',', '.') || 0),
                            valorTotalAjustesDebito: parseFloat(campos[4]?.replace(',', '.') || 0),
                            valorTotalAjustesCredito: parseFloat(campos[5]?.replace(',', '.') || 0),
                            saldoDevedor: parseFloat(campos[10]?.replace(',', '.') || 0)
                        };
                        break;
                }
            } catch (error) {
                console.warn(`Erro ao processar linha SPED Fiscal: ${error.message}`);
            }
        }

        return dados;
    }
    
    /**
     * Processa arquivo SPED Contribuições (EFD PIS/COFINS)
     * @param {Array} linhas - Linhas do arquivo SPED
     * @returns {Object} Dados processados do SPED Contribuições
     */
    function processarSPEDContribuicoes(linhas) {
        const dados = {
            empresa: {},
            apuracaoPIS: null,
            apuracaoCOFINS: null,
            creditosPIS: [],
            creditosCOFINS: [],
            detalhesPIS: [],
            detalhesCOFINS: [],
            receitas: {
                receitaBrutaTotal: 0,
                receitaTributavel: 0
            },
            regime: 'não-cumulativo' // padrão
        };

        let empresaProcessada = false;

        for (const linha of linhas) {
            try {
                const campos = linha.split('|');
                const registro = campos[1];

                switch (registro) {
                    case '0000':
                        if (!empresaProcessada) {
                            dados.empresa = {
                                cnpj: campos[8],
                                nome: campos[9]
                            };
                            empresaProcessada = true;
                        }
                        break;

                    case '0110':
                        // Regime de apuração
                        const indApuracao = campos[2];
                        dados.regime = indApuracao === '1' ? 'cumulativo' : 'não-cumulativo';
                        break;

                    case '0111':
                        // Receita bruta
                        dados.receitas.receitaBrutaTotal = parseFloat(campos[2]?.replace(',', '.') || 0);
                        dados.receitas.receitaTributavel = parseFloat(campos[6]?.replace(',', '.') || 0);
                        break;

                    case 'M100':
                        // Apuração PIS não-cumulativo
                        dados.apuracaoPIS = {
                            valorTotalCreditos: parseFloat(campos[2]?.replace(',', '.') || 0),
                            valorTotalDebitos: parseFloat(campos[3]?.replace(',', '.') || 0),
                            valorTotalAjustesCredito: parseFloat(campos[6]?.replace(',', '.') || 0),
                            valorTotalAjustesDebito: parseFloat(campos[7]?.replace(',', '.') || 0),
                            saldoDevedor: parseFloat(campos[11]?.replace(',', '.') || 0),
                            saldoCredorTransporte: parseFloat(campos[12]?.replace(',', '.') || 0)
                        };
                        break;

                    case 'M105':
                        // Detalhamento de créditos PIS
                        const creditoPIS = {
                            cst: campos[2],
                            baseCalculo: parseFloat(campos[4]?.replace(',', '.') || 0),
                            valorCredito: parseFloat(campos[5]?.replace(',', '.') || 0)
                        };
                        dados.creditosPIS.push(creditoPIS);
                        break;

                    case 'M500':
                        // Apuração COFINS não-cumulativo
                        dados.apuracaoCOFINS = {
                            valorTotalCreditos: parseFloat(campos[2]?.replace(',', '.') || 0),
                            valorTotalDebitos: parseFloat(campos[3]?.replace(',', '.') || 0),
                            valorTotalAjustesCredito: parseFloat(campos[6]?.replace(',', '.') || 0),
                            valorTotalAjustesDebito: parseFloat(campos[7]?.replace(',', '.') || 0),
                            saldoDevedor: parseFloat(campos[11]?.replace(',', '.') || 0),
                            saldoCredorTransporte: parseFloat(campos[12]?.replace(',', '.') || 0)
                        };
                        break;

                    case 'M505':
                        // Detalhamento de créditos COFINS
                        const creditoCOFINS = {
                            cst: campos[2],
                            baseCalculo: parseFloat(campos[4]?.replace(',', '.') || 0),
                            valorCredito: parseFloat(campos[5]?.replace(',', '.') || 0)
                        };
                        dados.creditosCOFINS.push(creditoCOFINS);
                        break;

                    case 'M210':
                        // Detalhamento de receitas PIS
                        const receitaPIS = {
                            baseCalculo: parseFloat(campos[3]?.replace(',', '.') || 0),
                            aliquota: parseFloat(campos[4]?.replace(',', '.') || 0),
                            valorContribuicao: parseFloat(campos[8]?.replace(',', '.') || 0)
                        };
                        dados.detalhesPIS.push(receitaPIS);
                        break;

                    case 'M610':
                        // Detalhamento de receitas COFINS
                        const receitaCOFINS = {
                            baseCalculo: parseFloat(campos[3]?.replace(',', '.') || 0),
                            aliquota: parseFloat(campos[4]?.replace(',', '.') || 0),
                            valorContribuicao: parseFloat(campos[8]?.replace(',', '.') || 0)
                        };
                        dados.detalhesCOFINS.push(receitaCOFINS);
                        break;
                }
            } catch (error) {
                console.warn(`Erro ao processar linha SPED Contribuições: ${error.message}`);
            }
        }

        return dados;
    }
    
    /**
     * Calcula alíquotas efetivas baseadas nos dados reais
     */
    function calcularAliquotasEfetivas(dadosFiscal, dadosContribuicoes) {
        const aliquotas = {
            pisEfetivo: 0,
            cofinsEfetivo: 0,
            icmsEfetivo: 0,
            ipiEfetivo: 0,
            issEfetivo: 0
        };

        // Calcular faturamento mensal (base para alíquotas efetivas)
        const faturamentoMensal = dadosContribuicoes?.receitas?.receitaBrutaTotal || 
                                  dadosFiscal?.totalizadores?.valorTotalSaidas || 0;

        if (faturamentoMensal > 0) {
            // PIS Efetivo
            const totalPIS = dadosContribuicoes?.detalhesPIS?.reduce((acc, item) => 
                acc + item.valorContribuicao, 0) || 0;
            // Armazenar como percentual (0-100), não como decimal (0-1)
            aliquotas.pisEfetivo = (totalPIS / faturamentoMensal) * 100;

            // COFINS Efetivo
            const totalCOFINS = dadosContribuicoes?.detalhesCOFINS?.reduce((acc, item) => 
                acc + item.valorContribuicao, 0) || 0;
            // Armazenar como percentual (0-100), não como decimal (0-1)
            aliquotas.cofinsEfetivo = (totalCOFINS / faturamentoMensal) * 100;

            // ICMS Efetivo
            const totalICMS = dadosFiscal?.totalizadores?.valorICMS || 0;
            // Armazenar como percentual (0-100), não como decimal (0-1)
            aliquotas.icmsEfetivo = (totalICMS / faturamentoMensal) * 100;

            // IPI Efetivo
            const totalIPI = dadosFiscal?.totalizadores?.valorIPI || 0;
            // Armazenar como percentual (0-100), não como decimal (0-1)
            aliquotas.ipiEfetivo = (totalIPI / faturamentoMensal) * 100;
        }

        return aliquotas;
    }

    /**
     * Calcula composição tributária com débitos e créditos corretos
     */
    function calcularComposicaoTributaria(dadosFiscal, dadosContribuicoes) {
        const composicao = {
            debitos: {
                pis: 0,
                cofins: 0,
                icms: 0,
                ipi: 0,
                iss: 0
            },
            creditos: {
                pis: 0,
                cofins: 0,
                icms: 0,
                ipi: 0,
                iss: 0
            }
        };

        // Débitos PIS
        if (dadosContribuicoes?.detalhesPIS) {
            composicao.debitos.pis = dadosContribuicoes.detalhesPIS.reduce((acc, item) => 
                acc + item.valorContribuicao, 0);
        }

        // Débitos COFINS
        if (dadosContribuicoes?.detalhesCOFINS) {
            composicao.debitos.cofins = dadosContribuicoes.detalhesCOFINS.reduce((acc, item) => 
                acc + item.valorContribuicao, 0);
        }

        // Créditos PIS
        if (dadosContribuicoes?.creditosPIS) {
            composicao.creditos.pis = dadosContribuicoes.creditosPIS.reduce((acc, item) => 
                acc + item.valorCredito, 0);
        }

        // Créditos COFINS
        if (dadosContribuicoes?.creditosCOFINS) {
            composicao.creditos.cofins = dadosContribuicoes.creditosCOFINS.reduce((acc, item) => 
                acc + item.valorCredito, 0);
        }

        // ICMS
        composicao.debitos.icms = dadosFiscal?.totalizadores?.valorICMS || 0;
        composicao.creditos.icms = dadosFiscal?.apuracaoICMS?.valorTotalCreditos || 0;

        // IPI
        composicao.debitos.ipi = dadosFiscal?.totalizadores?.valorIPI || 0;

        return composicao;
    }

    /**
     * Calcula parâmetros fiscais com rastreamento de fonte
     */
    function calcularParametrosFiscais(spedFiscal, spedContribuicoes) {
        console.log('SPED-EXTRACTOR: Calculando parâmetros fiscais com rastreamento de fonte');

        const parametros = {
            sistemaAtual: {
                regimeTributario: 'real',
                regimePISCOFINS: 'não-cumulativo'
            },
            composicaoTributaria: {
                debitos: {},
                creditos: {},
                aliquotasEfetivas: {},
                fontesDados: {} // Novo: rastreamento de fontes
            }
        };

        try {
            // Processar débitos e créditos PIS
            if (spedContribuicoes?.debitos?.pis) {
                const totalDebitoPIS = spedContribuicoes.debitos.pis.reduce((sum, d) => 
                    sum + parseValorMonetario(d.valorTotalContribuicao || d.valorContribuicaoAPagar || 0), 0
                );
                parametros.composicaoTributaria.debitos.pis = criarValorComFonte(totalDebitoPIS, FonteDados.SPED, {
                    registros: spedContribuicoes.debitos.pis.length,
                    fonte_sped: 'contribuicoes'
                });
                parametros.composicaoTributaria.fontesDados.pis_debito = FonteDados.SPED;
            }

            if (spedContribuicoes?.creditos?.pis) {
                const totalCreditoPIS = spedContribuicoes.creditos.pis.reduce((sum, c) => 
                    sum + parseValorMonetario(c.valorCredito || 0), 0
                );
                parametros.composicaoTributaria.creditos.pis = criarValorComFonte(totalCreditoPIS, FonteDados.SPED, {
                    registros: spedContribuicoes.creditos.pis.length,
                    fonte_sped: 'contribuicoes'
                });
                parametros.composicaoTributaria.fontesDados.pis_credito = FonteDados.SPED;
            }

            // Processar débitos e créditos COFINS
            if (spedContribuicoes?.debitos?.cofins) {
                const totalDebitoCOFINS = spedContribuicoes.debitos.cofins.reduce((sum, d) => 
                    sum + parseValorMonetario(d.valorTotalContribuicao || d.valorContribuicaoAPagar || 0), 0
                );
                parametros.composicaoTributaria.debitos.cofins = criarValorComFonte(totalDebitoCOFINS, FonteDados.SPED, {
                    registros: spedContribuicoes.debitos.cofins.length,
                    fonte_sped: 'contribuicoes'
                });
                parametros.composicaoTributaria.fontesDados.cofins_debito = FonteDados.SPED;
            }

            if (spedContribuicoes?.creditos?.cofins) {
                const totalCreditoCOFINS = spedContribuicoes.creditos.cofins.reduce((sum, c) => 
                    sum + parseValorMonetario(c.valorCredito || 0), 0
                );
                parametros.composicaoTributaria.creditos.cofins = criarValorComFonte(totalCreditoCOFINS, FonteDados.SPED, {
                    registros: spedContribuicoes.creditos.cofins.length,
                    fonte_sped: 'contribuicoes'
                });
                parametros.composicaoTributaria.fontesDados.cofins_credito = FonteDados.SPED;
            }

            // Processar ICMS do SPED Fiscal
            if (spedFiscal?.debitos?.icms) {
                const totalDebitoICMS = spedFiscal.debitos.icms.reduce((sum, d) => 
                    sum + parseValorMonetario(d.valorTotalDebitos || 0), 0
                );
                parametros.composicaoTributaria.debitos.icms = criarValorComFonte(totalDebitoICMS, FonteDados.SPED, {
                    registros: spedFiscal.debitos.icms.length,
                    fonte_sped: 'fiscal'
                });
                parametros.composicaoTributaria.fontesDados.icms_debito = FonteDados.SPED;
            }

            if (spedFiscal?.creditos?.icms) {
                const totalCreditoICMS = spedFiscal.creditos.icms.reduce((sum, c) => 
                    sum + parseValorMonetario(c.valorCredito || 0), 0
                );
                parametros.composicaoTributaria.creditos.icms = criarValorComFonte(totalCreditoICMS, FonteDados.SPED, {
                    registros: spedFiscal.creditos.icms.length,
                    fonte_sped: 'fiscal'
                });
                parametros.composicaoTributaria.fontesDados.icms_credito = FonteDados.SPED;
            }

            // Processar IPI do SPED Fiscal
            if (spedFiscal?.debitos?.ipi) {
                const totalDebitoIPI = spedFiscal.debitos.ipi.reduce((sum, d) => 
                    sum + parseValorMonetario(d.valorTotalDebitos || 0), 0
                );
                parametros.composicaoTributaria.debitos.ipi = criarValorComFonte(totalDebitoIPI, FonteDados.SPED, {
                    registros: spedFiscal.debitos.ipi.length,
                    fonte_sped: 'fiscal'
                });
                parametros.composicaoTributaria.fontesDados.ipi_debito = FonteDados.SPED;
            }
            
            // MODIFICAÇÃO 1: Alterar a forma como as alíquotas efetivas são calculadas
            // Substituir o trecho atual pelo seguinte:

            // Calcular alíquotas efetivas
            if (faturamentoMensal > 0) {
                // Garantir que os débitos e créditos são números válidos
                Object.keys(composicaoTributaria.debitos).forEach(imposto => {
                    const debito = validarValorMonetario(composicaoTributaria.debitos[imposto]);
                    const credito = validarValorMonetario(composicaoTributaria.creditos[imposto] || 0);

                    // Calcular imposto líquido e alíquota efetiva
                    const impostoLiquido = Math.max(0, debito - credito);
                    // Armazenar alíquota como valor percentual (de 0 a 100, não de 0 a 1)
                    const aliquotaEfetiva = (impostoLiquido / faturamentoMensal) * 100;

                    // Validar e registrar a alíquota
                    if (aliquotaEfetiva >= 0 && aliquotaEfetiva <= 100) {
                        composicaoTributaria.aliquotasEfetivas[imposto] = aliquotaEfetiva;
                        console.log(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} calculada: ${aliquotaEfetiva.toFixed(3)}%`);
                    } else {
                        // Definir valores padrão seguros em caso de cálculo inválido
                        composicaoTributaria.aliquotasEfetivas[imposto] = imposto === 'pis' ? 0.65 : 
                                                                          imposto === 'cofins' ? 3.0 : 
                                                                          imposto === 'icms' ? 18.0 : 0.0;
                        console.warn(`SPED-EXTRACTOR: Alíquota efetiva de ${imposto} inválida (${aliquotaEfetiva}), usando padrão`);
                    }
                });

                // Calcular alíquota total
                const totalImpostoLiquido = Object.keys(composicaoTributaria.debitos).reduce((total, imposto) => {
                    const debito = composicaoTributaria.debitos[imposto];
                    const credito = composicaoTributaria.creditos[imposto] || 0;
                    return total + Math.max(0, debito - credito);
                }, 0);

                const aliquotaTotal = (totalImpostoLiquido / faturamentoMensal) * 100;

                // Validar a alíquota total (deve estar entre 0 e 100)
                if (aliquotaTotal >= 0 && aliquotaTotal <= 100) {
                    composicaoTributaria.aliquotasEfetivas.total = aliquotaTotal;
                } else {
                    console.warn(`SPED-EXTRACTOR: Alíquota efetiva total fora dos limites: ${aliquotaTotal}`);
                    composicaoTributaria.aliquotasEfetivas.total = 0.0;
                }

                console.log('SPED-EXTRACTOR: Alíquotas efetivas calculadas:', composicaoTributaria.aliquotasEfetivas);
            } else {
                console.warn('SPED-EXTRACTOR: Faturamento zero, não foi possível calcular alíquotas efetivas');
                // Definir alíquotas padrão (agora em formato percentual)
                composicaoTributaria.aliquotasEfetivas = {
                    pis: 0.65,
                    cofins: 3.0,
                    icms: 18.0,
                    ipi: 0.0,
                    iss: 0.0,
                    total: 21.65
                };
            }

            // Estimar valores ausentes
            estimarValoresAusentes(parametros, spedFiscal, spedContribuicoes);

            return parametros;

        } catch (erro) {
            console.error('SPED-EXTRACTOR: Erro ao calcular parâmetros fiscais:', erro);
            return parametros;
        }
    }

    /**
     * Estima valores ausentes com base em dados disponíveis
     */
    function estimarValoresAusentes(parametros, spedFiscal, spedContribuicoes) {
        const composicao = parametros.composicaoTributaria;

        // Se não tem COFINS mas tem PIS, estimar COFINS (proporção 7,6/1,65)
        if (!composicao.debitos.cofins && composicao.debitos.pis) {
            const valorPIS = extrairValorNumerico(composicao.debitos.pis);
            const cofinsEstimado = valorPIS * (7.6 / 1.65);
            composicao.debitos.cofins = criarValorComFonte(cofinsEstimado, FonteDados.ESTIMADO, {
                baseadoEm: 'PIS',
                proporcao: '7.6/1.65'
            });
            composicao.fontesDados.cofins_debito = FonteDados.ESTIMADO;
        }

        // Se não tem PIS mas tem COFINS, estimar PIS
        if (!composicao.debitos.pis && composicao.debitos.cofins) {
            const valorCOFINS = extrairValorNumerico(composicao.debitos.cofins);
            const pisEstimado = valorCOFINS * (1.65 / 7.6);
            composicao.debitos.pis = criarValorComFonte(pisEstimado, FonteDados.ESTIMADO, {
                baseadoEm: 'COFINS',
                proporcao: '1.65/7.6'
            });
            composicao.fontesDados.pis_debito = FonteDados.ESTIMADO;
        }

        // Estimar ICMS se ausente (baseado na média do setor)
        if (!composicao.debitos.icms) {
            const valorPISCOFINS = (extrairValorNumerico(composicao.debitos.pis) || 0) + 
                                  (extrairValorNumerico(composicao.debitos.cofins) || 0);
            if (valorPISCOFINS > 0) {
                // Estimativa: ICMS geralmente é 3-4x o valor de PIS+COFINS
                const icmsEstimado = valorPISCOFINS * 3.5;
                composicao.debitos.icms = criarValorComFonte(icmsEstimado, FonteDados.ESTIMADO, {
                    baseadoEm: 'PIS+COFINS',
                    multiplicador: '3.5'
                });
                composicao.fontesDados.icms_debito = FonteDados.ESTIMADO;
            }
        }
    }

    function calcularAliquotaMediaICMS(dadosFiscal) {
        if (!dadosFiscal?.resumosICMS || dadosFiscal.resumosICMS.length === 0) {
            return 18; // padrão
        }

        let totalBase = 0;
        let totalImposto = 0;

        dadosFiscal.resumosICMS.forEach(resumo => {
            if (resumo.baseCalculo > 0 && resumo.valorImposto > 0) {
                totalBase += resumo.baseCalculo;
                totalImposto += resumo.valorImposto;
            }
        });

        return totalBase > 0 ? (totalImposto / totalBase) * 100 : 18;
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