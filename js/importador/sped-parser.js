/**
 * Configurações do parser
 */
const CONFIG = {
    // Tamanhos máximos para segurança
    tamanhoMaximoArquivo: 100 * 1024 * 1024, // 100MB
    numeroMaximoLinhas: 1000000, // 1 milhão de linhas
    timeoutLeitura: 60000, // 60 segundos
    
    // Configurações de parsing
    separadorCampo: '|',
    terminadorLinha: /\r?\n/,
    codificacaoArquivo: 'UTF-8',
    
    // Tipos de SPED suportados
    tiposSuportados: {
        'EFD-ICMS/IPI': {
            codigo: 'fiscal',
            descricao: 'SPED Fiscal - EFD ICMS/IPI',
            versoes: ['014', '015', '016', '017'],
            registroIdentificador: '0000',
            codigoLayoutEsperado: '014'
        },
        'EFD-Contribuições': {
            codigo: 'contribuicoes',
            descricao: 'SPED Contribuições - EFD PIS/COFINS',
            versoes: ['011', '012', '013'],
            registroIdentificador: '0000',
            codigoLayoutEsperado: '011'
        },
        'ECF': {
            codigo: 'ecf',
            descricao: 'Escrituração Contábil Fiscal',
            versoes: ['010', '011', '012'],
            registroIdentificador: 'J001',
            codigoLayoutEsperado: '010'
        },
        'ECD': {
            codigo: 'ecd',
            descricao: 'Escrituração Contábil Digital',
            versoes: ['010', '011', '012'],
            registroIdentificador: 'I001',
            codigoLayoutEsperado: '010'
        }
    },
    
    // Registros principais de cada tipo de SPED
    registrosPrincipais: {
        fiscal: {
            // Identificação e abertura
            abertura: ['0000', '0001', '0005', '0015', '0100', '0150', '0190', '0200', '0205', '0210'],
            // Documentos fiscais de entrada
            entradas: ['C100', 'C101', 'C105', 'C110', 'C111', 'C112', 'C113', 'C114', 'C120', 'C130'],
            // Documentos fiscais de saída
            saidas: ['C300', 'C301', 'C305', 'C310', 'C311', 'C312', 'C313', 'C314', 'C320', 'C321'],
            // Apuração ICMS
            apuracaoICMS: ['E001', 'E100', 'E110', 'E111', 'E112', 'E113', 'E115', 'E116'],
            // Apuração IPI
            apuracaoIPI: ['E200', 'E210', 'E220', 'E230', 'E240', 'E250'],
            // Inventário
            inventario: ['H001', 'H005', 'H010', 'H020'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        },
        contribuicoes: {
            // Identificação
            abertura: ['0000', '0001', '0035', '0100', '0110', '0111', '0120', '0140', '0150'],
            // Receitas
            receitas: ['A100', 'A110', 'A111', 'A120', 'A170'],
            // Custos
            custos: ['A200', 'A210', 'A220', 'A230'],
            // Créditos
            creditos: ['C100', 'C110', 'C111', 'C120', 'C170', 'C175', 'C180', 'C181', 'C185'],
            // Apuração PIS
            apuracaoPIS: ['M100', 'M105', 'M110', 'M115', 'M200', 'M205', 'M210', 'M220', 'M225'],
            // Apuração COFINS
            apuracaoCOFINS: ['M400', 'M405', 'M410', 'M411', 'M500', 'M505', 'M510', 'M515'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        },
        ecf: {
            // Identificação
            abertura: ['J001', 'J005'],
            // Demonstrações
            demonstracoes: ['J100', 'J150', 'J200', 'J210', 'J215', 'J800', 'J801', 'J900', 'J930', 'J932'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        },
        ecd: {
            // Identificação
            abertura: ['I001', 'I010', 'I012', 'I015', 'I020', 'I030', 'I050', 'I051', 'I052'],
            // Plano de contas
            planoContas: ['I100', 'I150', 'I155', 'I200', 'I250', 'I300', 'I310', 'I350', 'I355'],
            // Balancetes e balanços
            balancetes: ['J100', 'J150', 'J200', 'J210', 'J215'],
            // Demonstrações
            demonstracoes: ['J800', 'J801', 'J900', 'J930', 'J932', 'J935'],
            // Encerramento
            encerramento: ['9001', '9900', '9990', '9999']
        }
    },
    
    // Tolerâncias e limites
    tolerancias: {
        percentualLeituraMinimo: 0.95, // 95% das linhas devem ser processadas com sucesso
        percentualRegistrosMinimo: 0.90, // 90% dos registros devem ser válidos
        tamanhoMinimoArquivo: 1024 // 1KB mínimo
    }
};

/**
 * Classe principal do parser SPED
 */
class SpedParser {
    constructor() {
        this.estatisticas = {
            linhasProcessadas: 0,
            linhasComErro: 0,
            registrosEncontrados: 0,
            registrosValidos: 0,
            tempoProcessamento: 0,
            erros: []
        };
        
        this.dadosExtraidos = {};
        this.tipoSpedIdentificado = null;
        this.versaoLayout = null;
        this.log = [];
    }

    /**
     * Adiciona entrada ao log interno
     * @param {string} mensagem - Mensagem do log
     * @param {string} nivel - Nível do log (info, warning, error)
     * @param {Object} detalhes - Detalhes adicionais
     */
    adicionarLog(mensagem, nivel = 'info', detalhes = null) {
        const entrada = {
            timestamp: new Date().toISOString(),
            nivel: nivel,
            mensagem: mensagem,
            detalhes: detalhes
        };
        
        this.log.push(entrada);
        
        // Log no console também para desenvolvimento
        const metodo = nivel === 'error' ? 'error' : nivel === 'warning' ? 'warn' : 'log';
        console[metodo](`[SPED-PARSER] ${mensagem}`, detalhes || '');
    }

    /**
     * Valida o arquivo antes do processamento
     * @param {File} arquivo - Arquivo a ser validado
     * @returns {Object} Resultado da validação
     */
    validarArquivo(arquivo) {
        const validacao = {
            valido: true,
            erros: [],
            avisos: []
        };

        try {
            // Validar tamanho
            if (arquivo.size === 0) {
                validacao.valido = false;
                validacao.erros.push('Arquivo vazio');
            } else if (arquivo.size < CONFIG.tolerancias.tamanhoMinimoArquivo) {
                validacao.avisos.push(`Arquivo muito pequeno (${arquivo.size} bytes)`);
            } else if (arquivo.size > CONFIG.tamanhoMaximoArquivo) {
                validacao.valido = false;
                validacao.erros.push(`Arquivo muito grande: ${this.formatarTamanho(arquivo.size)}. Máximo: ${this.formatarTamanho(CONFIG.tamanhoMaximoArquivo)}`);
            }

            // Validar tipo
            const extensao = arquivo.name.toLowerCase().split('.').pop();
            if (!['txt', 'sped'].includes(extensao)) {
                validacao.avisos.push(`Extensão incomum para SPED: .${extensao}`);
            }

            // Validar nome (heurística)
            const nomeArquivo = arquivo.name.toLowerCase();
            const palavrasChave = ['sped', 'efd', 'ecf', 'ecd', 'fiscal', 'contribuicoes'];
            const contemPalavraChave = palavrasChave.some(palavra => nomeArquivo.includes(palavra));
            
            if (!contemPalavraChave) {
                validacao.avisos.push('Nome do arquivo não contém palavras-chave típicas de SPED');
            }

            this.adicionarLog(`Validação de arquivo concluída: ${validacao.valido ? 'Válido' : 'Inválido'}`, 
                              validacao.valido ? 'info' : 'error', {
                arquivo: arquivo.name,
                tamanho: arquivo.size,
                erros: validacao.erros,
                avisos: validacao.avisos
            });

        } catch (erro) {
            validacao.valido = false;
            validacao.erros.push(`Erro na validação: ${erro.message}`);
            this.adicionarLog('Erro durante validação do arquivo', 'error', erro);
        }

        return validacao;
    }

    /**
     * Lê o conteúdo do arquivo
     * @param {File} arquivo - Arquivo a ser lido
     * @returns {Promise<string>} Conteúdo do arquivo
     */
    async lerArquivo(arquivo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const timeoutId = setTimeout(() => {
                reject(new Error('Timeout na leitura do arquivo'));
            }, CONFIG.timeoutLeitura);

            reader.onload = (evento) => {
                clearTimeout(timeoutId);
                resolve(evento.target.result);
            };

            reader.onerror = (erro) => {
                clearTimeout(timeoutId);
                reject(new Error(`Erro ao ler arquivo: ${erro.message}`));
            };

            try {
                reader.readAsText(arquivo, CONFIG.codificacaoArquivo);
            } catch (erro) {
                clearTimeout(timeoutId);
                reject(erro);
            }
        });
    }

    /**
     * Identifica o tipo de SPED baseado no conteúdo
     * @param {string} conteudo - Conteúdo do arquivo
     * @returns {Object|null} Informações do tipo identificado
     */
    identificarTipoSped(conteudo) {
        this.adicionarLog('Iniciando identificação do tipo de SPED...');

        try {
            const linhas = conteudo.split(CONFIG.terminadorLinha);
            
            // Procurar pela primeira linha não vazia
            let primeiraLinha = null;
            for (let i = 0; i < Math.min(linhas.length, 10); i++) {
                const linha = linhas[i].trim();
                if (linha.length > 0) {
                    primeiraLinha = linha;
                    break;
                }
            }

            if (!primeiraLinha) {
                this.adicionarLog('Nenhuma linha válida encontrada no arquivo', 'error');
                return null;
            }

            this.adicionarLog(`Primeira linha encontrada: ${primeiraLinha.substring(0, 100)}...`);

            // Analisar estrutura da primeira linha
            const campos = primeiraLinha.split(CONFIG.separadorCampo);
            if (campos.length < 3) {
                this.adicionarLog('Estrutura de linha inválida para SPED', 'error');
                return null;
            }

            // Identificar tipo baseado no primeiro registro
            const codigoRegistro = campos[1]; // Campo REG
            const tipoIdentificado = this.identificarPorCodigoRegistro(codigoRegistro, campos);

            if (tipoIdentificado) {
                this.tipoSpedIdentificado = tipoIdentificado;
                this.versaoLayout = this.extrairVersaoLayout(campos);
                
                this.adicionarLog(`Tipo SPED identificado: ${tipoIdentificado.descricao}`, 'info', {
                    codigo: tipoIdentificado.codigo,
                    versao: this.versaoLayout,
                    registro: codigoRegistro
                });

                return {
                    tipo: tipoIdentificado,
                    versao: this.versaoLayout,
                    registroIdentificador: codigoRegistro
                };
            } else {
                this.adicionarLog(`Tipo de SPED não reconhecido. Registro: ${codigoRegistro}`, 'error');
                return null;
            }

        } catch (erro) {
            this.adicionarLog('Erro na identificação do tipo de SPED', 'error', erro);
            return null;
        }
    }

    /**
     * Identifica o tipo de SPED pelo código do registro
     * @param {string} codigoRegistro - Código do registro
     * @param {Array} campos - Campos da linha
     * @returns {Object|null} Tipo identificado
     */
    identificarPorCodigoRegistro(codigoRegistro, campos) {
        // SPED Fiscal - EFD ICMS/IPI
        if (codigoRegistro === '0000' && campos.length >= 6) {
            const codigoFinalidade = campos[2]; // Campo COD_FIN
            if (['0', '1'].includes(codigoFinalidade)) {
                return CONFIG.tiposSuportados['EFD-ICMS/IPI'];
            }
        }
        
        // ECF - Escrituração Contábil Fiscal
        if (codigoRegistro === 'J001') {
            return CONFIG.tiposSuportados['ECF'];
        }
        
        // ECD - Escrituração Contábil Digital
        if (codigoRegistro === 'I001') {
            return CONFIG.tiposSuportados['ECD'];
        }
        
        // Análise mais detalhada para diferenciar SPED Fiscal de Contribuições
        if (codigoRegistro === '0000') {
            // Examinar mais linhas para distinguir
            return this.analisarConteudoParaIdentificacao(campos);
        }

        return null;
    }

    /**
     * Análise mais profunda para identificação em casos ambíguos
     * @param {Array} campos - Campos da primeira linha
     * @returns {Object|null} Tipo identificado
     */
    analisarConteudoParaIdentificacao(campos) {
        // Se tem mais de 10 campos, provavelmente é SPED Fiscal
        if (campos.length > 10) {
            return CONFIG.tiposSuportados['EFD-ICMS/IPI'];
        }
        
        // Verificar padrões específicos nos campos
        const terceiroCampo = campos[2] || '';
        
        // SPED Contribuições geralmente tem códigos específicos
        if (['2', '3', '4'].includes(terceiroCampo)) {
            return CONFIG.tiposSuportados['EFD-Contribuições'];
        }
        
        // Por padrão, assumir SPED Fiscal
        return CONFIG.tiposSuportados['EFD-ICMS/IPI'];
    }

    /**
     * Extrai a versão do layout do arquivo
     * @param {Array} campos - Campos da linha de identificação
     * @returns {string} Versão do layout
     */
    extrairVersaoLayout(campos) {
        // A versão geralmente está no campo 3 ou 4
        if (campos.length >= 4) {
            const possivelVersao = campos[3];
            if (/^\d{3}$/.test(possivelVersao)) {
                return possivelVersao;
            }
        }
        
        if (campos.length >= 5) {
            const possivelVersao = campos[4];
            if (/^\d{3}$/.test(possivelVersao)) {
                return possivelVersao;
            }
        }
        
        return 'desconhecida';
    }

    /**
     * Processa o conteúdo do arquivo SPED
     * @param {string} conteudo - Conteúdo do arquivo
     * @param {Object} opcoes - Opções de processamento
     * @returns {Object} Dados processados
     */
    processarConteudo(conteudo, opcoes = {}) {
        const opcoesDefault = {
            extrairTodos: false,
            validarIntegridade: true,
            incluirEstatisticas: true,
            registrosEspecificos: null // Array de códigos de registro para extrair
        };

        const opcoesFinais = { ...opcoesDefault, ...opcoes };
        
        this.adicionarLog('Iniciando processamento do conteúdo do SPED...', 'info', opcoesFinais);

        const inicioProcessamento = Date.now();
        this.resetarEstatisticas();

        try {
            const linhas = conteudo.split(CONFIG.terminadorLinha);
            const totalLinhas = linhas.length;
            
            this.adicionarLog(`Total de linhas no arquivo: ${totalLinhas}`);

            if (totalLinhas > CONFIG.numeroMaximoLinhas) {
                throw new Error(`Arquivo muito grande: ${totalLinhas} linhas. Máximo: ${CONFIG.numeroMaximoLinhas}`);
            }

            // Determinar quais registros extrair
            const registrosParaExtrair = this.determinarRegistrosParaExtrair(opcoesFinais);
            
            this.adicionarLog(`Registros selecionados para extração: ${registrosParaExtrair.length} tipos`, 'info', registrosParaExtrair);

            // Processar linha por linha
            for (let numeroLinha = 0; numeroLinha < totalLinhas; numeroLinha++) {
                try {
                    const linha = linhas[numeroLinha].trim();
                    
                    // Pular linhas vazias
                    if (linha.length === 0) {
                        continue;
                    }

                    this.estatisticas.linhasProcessadas++;

                    // Processar linha
                    const resultadoLinha = this.processarLinha(linha, numeroLinha + 1, registrosParaExtrair);
                    
                    if (resultadoLinha.sucesso && resultadoLinha.registro) {
                        this.armazenarRegistro(resultadoLinha.registro);
                        this.estatisticas.registrosEncontrados++;
                        
                        if (resultadoLinha.valido) {
                            this.estatisticas.registrosValidos++;
                        }
                    } else if (resultadoLinha.erro) {
                        this.estatisticas.erros.push({
                            linha: numeroLinha + 1,
                            erro: resultadoLinha.erro,
                            conteudo: linha.substring(0, 100)
                        });
                        this.estatisticas.linhasComErro++;
                    }

                    // Log de progresso a cada 10.000 linhas
                    if (this.estatisticas.linhasProcessadas % 10000 === 0) {
                        this.adicionarLog(`Progresso: ${this.estatisticas.linhasProcessadas}/${totalLinhas} linhas processadas`);
                    }

                } catch (erroLinha) {
                    this.estatisticas.linhasComErro++;
                    this.estatisticas.erros.push({
                        linha: numeroLinha + 1,
                        erro: erroLinha.message,
                        conteudo: linhas[numeroLinha].substring(0, 100)
                    });
                }
            }

            // Calcular tempo de processamento
            this.estatisticas.tempoProcessamento = Date.now() - inicioProcessamento;

            // Validar integridade se solicitado
            if (opcoesFinais.validarIntegridade) {
                this.validarIntegridade();
            }

            // Processar dados extraídos
            this.processarDadosExtraidos();

            this.adicionarLog('Processamento do conteúdo concluído', 'info', {
                tempoProcessamento: this.estatisticas.tempoProcessamento,
                linhasProcessadas: this.estatisticas.linhasProcessadas,
                registrosEncontrados: this.estatisticas.registrosEncontrados,
                erros: this.estatisticas.linhasComErro
            });

            return {
                sucesso: true,
                dados: this.dadosExtraidos,
                estatisticas: this.estatisticas,
                log: this.log
            };

        } catch (erro) {
            this.estatisticas.tempoProcessamento = Date.now() - inicioProcessamento;
            this.adicionarLog('Erro crítico no processamento', 'error', erro);
            
            return {
                sucesso: false,
                erro: erro.message,
                estatisticas: this.estatisticas,
                log: this.log
            };
        }
    }

    /**
     * Determina quais registros devem ser extraídos
     * @param {Object} opcoes - Opções de processamento
     * @returns {Array} Array de códigos de registro
     */
    determinarRegistrosParaExtrair(opcoes) {
        if (opcoes.registrosEspecificos && Array.isArray(opcoes.registrosEspecificos)) {
            return opcoes.registrosEspecificos;
        }

        if (opcoes.extrairTodos) {
            return ['*']; // Indicador para extrair todos
        }

        // Extrair registros principais baseado no tipo de SPED
        if (!this.tipoSpedIdentificado) {
            this.adicionarLog('Tipo de SPED não identificado, extraindo registros básicos', 'warning');
            return ['0000', '0001', '9999']; // Registros mínimos
        }

        const codigoTipo = this.tipoSpedIdentificado.codigo;
        const registrosTipo = CONFIG.registrosPrincipais[codigoTipo];

        if (!registrosTipo) {
            this.adicionarLog(`Registros principais não definidos para tipo: ${codigoTipo}`, 'warning');
            return ['0000', '0001', '9999'];
        }

        // Combinar todos os registros principais do tipo
        const todosRegistros = [];
        Object.values(registrosTipo).forEach(grupo => {
            if (Array.isArray(grupo)) {
                todosRegistros.push(...grupo);
            }
        });

        return [...new Set(todosRegistros)]; // Remover duplicatas
    }

    /**
     * Processa uma linha individual do arquivo
     * @param {string} linha - Linha a ser processada
     * @param {number} numeroLinha - Número da linha no arquivo
     * @param {Array} registrosParaExtrair - Registros que devem ser extraídos
     * @returns {Object} Resultado do processamento da linha
     */
    processarLinha(linha, numeroLinha, registrosParaExtrair) {
        try {
            // Dividir campos
            const campos = linha.split(CONFIG.separadorCampo);
            
            if (campos.length < 2) {
                return {
                    sucesso: false,
                    erro: 'Linha com estrutura inválida - menos de 2 campos'
                };
            }

            const codigoRegistro = campos[1]; // Campo REG
            
            // Verificar se deve extrair este registro
            const deveExtrair = registrosParaExtrair.includes('*') || 
                              registrosParaExtrair.includes(codigoRegistro);

            if (!deveExtrair) {
                return {
                    sucesso: true,
                    registro: null
                };
            }

            // Validar estrutura básica
            const resultadoValidacao = this.validarEstruturaRegistro(codigoRegistro, campos);
            
            // Criar objeto do registro
            const registro = {
                codigo: codigoRegistro,
                linha: numeroLinha,
                campos: campos,
                dadosProcessados: this.processarCamposRegistro(codigoRegistro, campos),
                valido: resultadoValidacao.valido,
                errosValidacao: resultadoValidacao.erros || []
            };

            return {
                sucesso: true,
                registro: registro,
                valido: resultadoValidacao.valido
            };

        } catch (erro) {
            return {
                sucesso: false,
                erro: `Erro no processamento da linha: ${erro.message}`
            };
        }
    }

    /**
     * Valida a estrutura de um registro específico
     * @param {string} codigoRegistro - Código do registro
     * @param {Array} campos - Campos do registro
     * @returns {Object} Resultado da validação
     */
    validarEstruturaRegistro(codigoRegistro, campos) {
        const validacao = {
            valido: true,
            erros: []
        };

        try {
            // Validações básicas
            if (!codigoRegistro || codigoRegistro.trim() === '') {
                validacao.valido = false;
                validacao.erros.push('Código de registro vazio');
            }

            if (campos.length === 0) {
                validacao.valido = false;
                validacao.erros.push('Nenhum campo encontrado');
            }

            // Validações específicas por tipo de registro
            switch (codigoRegistro) {
                case '0000':
                    if (campos.length < 8) {
                        validacao.erros.push('Registro 0000 deve ter pelo menos 8 campos');
                    }
                    break;
                
                case '0001':
                    if (campos.length < 6) {
                        validacao.erros.push('Registro 0001 deve ter pelo menos 6 campos');
                    }
                    break;
                
                case 'C100':
                    if (campos.length < 15) {
                        validacao.erros.push('Registro C100 deve ter pelo menos 15 campos');
                    }
                    break;
                
                case 'J001':
                    if (campos.length < 5) {
                        validacao.erros.push('Registro J001 deve ter pelo menos 5 campos');
                    }
                    break;
                
                case 'I001':
                    if (campos.length < 6) {
                        validacao.erros.push('Registro I001 deve ter pelo menos 6 campos');
                    }
                    break;
            }

            // Se há erros, marcar como inválido
            if (validacao.erros.length > 0) {
                validacao.valido = false;
            }

        } catch (erro) {
            validacao.valido = false;
            validacao.erros.push(`Erro na validação: ${erro.message}`);
        }

        return validacao;
    }

    /**
     * Processa campos específicos de um registro
     * @param {string} codigoRegistro - Código do registro
     * @param {Array} campos - Campos do registro
     * @returns {Object} Dados processados do registro
     */
    processarCamposRegistro(codigoRegistro, campos) {
        let dadosProcessados = {
            codigoRegistro: codigoRegistro,
            camposOriginais: campos.length
        };

        try {
            let dadosEspecificos = {};

            switch (codigoRegistro) {
                case '0000':
                    dadosEspecificos = this.processarRegistro0000(campos);
                    break;
                
                case '0001':
                    dadosEspecificos = this.processarRegistro0001(campos);
                    break;
                
                case 'C100':
                    dadosEspecificos = this.processarRegistroC100(campos);
                    break;
                
                case 'E110':
                    dadosEspecificos = this.processarRegistroE110(campos);
                    break;
                
                case 'A100':
                    dadosEspecificos = this.processarRegistroA100(campos);
                    break;
                
                case 'M100':
                    dadosEspecificos = this.processarRegistroM100(campos);
                    break;
                
                case 'J001':
                    dadosEspecificos = this.processarRegistroJ001(campos);
                    break;
                
                case 'J100':
                    dadosEspecificos = this.processarRegistroJ100(campos);
                    break;
                
                case 'I001':
                    dadosEspecificos = this.processarRegistroI001(campos);
                    break;
                
                default:
                    // Para registros não específicos, armazenar campos principais
                    dadosEspecificos = {
                        camposPrincipais: campos.slice(0, 10)
                    };
                    break;
            }

            // Combinar dados base com dados específicos
            dadosProcessados = { ...dadosProcessados, ...dadosEspecificos };

        } catch (erro) {
            dadosProcessados.erroProcessamento = erro.message;
        }

        return dadosProcessados;
    }

    /**
     * Processa registro 0000 (Abertura do arquivo)
     */
    processarRegistro0000(campos) {
        return {
            codigoFinalidade: campos[2] || '',
            dataInicial: this.formatarData(campos[3] || ''),
            dataFinal: this.formatarData(campos[4] || ''),
            razaoSocial: campos[5] || '',
            cnpj: this.formatarCNPJ(campos[6] || ''),
            uf: campos[8] || '',
            inscricaoEstadual: campos[9] || '',
            codigoMunicipio: campos[10] || '',
            inscricaoMunicipal: campos[11] || ''
        };
    }

    /**
     * Processa registro 0001 (Abertura do bloco)
     */
    processarRegistro0001(campos) {
        return {
            indicadorMovimento: campos[2] || '0'
        };
    }

    /**
     * Processa registro C100 (Documento fiscal)
     */
    processarRegistroC100(campos) {
        return {
            indicadorOperacao: campos[2] || '',
            indicadorEmitente: campos[3] || '',
            codigoParticipante: campos[4] || '',
            codigoModelo: campos[5] || '',
            codigoSituacao: campos[6] || '',
            serie: campos[7] || '',
            numeroDocumento: campos[8] || '',
            chaveNFe: campos[9] || '',
            dataEmissao: this.formatarData(campos[10] || ''),
            dataEntradaSaida: this.formatarData(campos[11] || ''),
            valorDocumento: this.formatarValor(campos[12] || '0'),
            indicadorPagamento: campos[13] || '',
            valorDesconto: this.formatarValor(campos[14] || '0'),
            valorAbatimento: this.formatarValor(campos[15] || '0'),
            valorMercadoria: this.formatarValor(campos[16] || '0'),
            indicadorFrete: campos[17] || '',
            valorFrete: this.formatarValor(campos[18] || '0'),
            valorSeguro: this.formatarValor(campos[19] || '0'),
            valorOutrasDespesas: this.formatarValor(campos[20] || '0'),
            valorBaseICMS: this.formatarValor(campos[21] || '0'),
            valorICMS: this.formatarValor(campos[22] || '0'),
            valorBaseICMSST: this.formatarValor(campos[23] || '0'),
            valorICMSST: this.formatarValor(campos[24] || '0'),
            valorIPI: this.formatarValor(campos[25] || '0'),
            valorPIS: this.formatarValor(campos[26] || '0'),
            valorCOFINS: this.formatarValor(campos[27] || '0')
        };
    }

    /**
     * Processa registro E110 (Apuração ICMS)
     */
    processarRegistroE110(campos) {
        return {
            valorTotalDebitos: this.formatarValor(campos[2] || '0'),
            valorAjustesDebitos: this.formatarValor(campos[3] || '0'),
            valorTotalAjustesDebitos: this.formatarValor(campos[4] || '0'),
            valorEstornoCreditos: this.formatarValor(campos[5] || '0'),
            valorTotalCreditos: this.formatarValor(campos[6] || '0'),
            valorAjustesCreditos: this.formatarValor(campos[7] || '0'),
            valorTotalAjustesCreditos: this.formatarValor(campos[8] || '0'),
            valorEstornoDebitos: this.formatarValor(campos[9] || '0'),
            saldoCredorAnterior: this.formatarValor(campos[10] || '0'),
            saldoApurado: this.formatarValor(campos[11] || '0'),
            valorDeducoes: this.formatarValor(campos[12] || '0'),
            valorICMSRecolher: this.formatarValor(campos[13] || '0'),
            saldoCredorTransportar: this.formatarValor(campos[14] || '0'),
            debitoEspecial: this.formatarValor(campos[15] || '0')
        };
    }

    /**
     * Processa registro A100 (Receitas - SPED Contribuições)
     */
    processarRegistroA100(campos) {
        return {
            indicadorOperacao: campos[2] || '',
            indicadorEmitente: campos[3] || '',
            codigoParticipante: campos[4] || '',
            codigoModelo: campos[5] || '',
            codigoSituacao: campos[6] || '',
            serie: campos[7] || '',
            numeroDocumento: campos[8] || '',
            chaveNFe: campos[9] || '',
            dataEmissao: this.formatarData(campos[10] || ''),
            valorReceitaBruta: this.formatarValor(campos[11] || '0'),
            valorReceitaLiquida: this.formatarValor(campos[12] || '0'),
            cstPIS: campos[13] || '',
            valorBasePIS: this.formatarValor(campos[14] || '0'),
            aliquotaPIS: this.formatarValor(campos[15] || '0'),
            valorPIS: this.formatarValor(campos[16] || '0'),
            cstCOFINS: campos[17] || '',
            valorBaseCOFINS: this.formatarValor(campos[18] || '0'),
            aliquotaCOFINS: this.formatarValor(campos[19] || '0'),
            valorCOFINS: this.formatarValor(campos[20] || '0')
        };
    }

    /**
     * Processa registro M100 (Apuração PIS)
     */
    processarRegistroM100(campos) {
        return {
            codigoTipoContribuicao: campos[2] || '',
            valorReceitaBrutaPeriodo: this.formatarValor(campos[3] || '0'),
            valorBasePIS: this.formatarValor(campos[4] || '0'),
            valorPISApurado: this.formatarValor(campos[5] || '0'),
            valorCreditoPIS: this.formatarValor(campos[6] || '0'),
            valorContribuicaoPIS: this.formatarValor(campos[7] || '0'),
            valorCreditosUtilizados: this.formatarValor(campos[8] || '0'),
            saldoCredorPeriodoAnterior: this.formatarValor(campos[9] || '0'),
            saldoCredorPeriodo: this.formatarValor(campos[10] || '0')
        };
    }

    /**
     * Processa registro J001 (Identificação ECF)
     */
    processarRegistroJ001(campos) {
        return {
            codigoVersao: campos[2] || '',
            tipoEscrituracao: campos[3] || '',
            codigoTipoECD: campos[4] || '',
            cnpj: this.formatarCNPJ(campos[5] || ''),
            razaoSocial: campos[6] || '',
            dataInicialPeriodo: this.formatarData(campos[7] || ''),
            dataFinalPeriodo: this.formatarData(campos[8] || '')
        };
    }

    /**
     * Processa registro J100 (Demonstrações Financeiras)
     */
    processarRegistroJ100(campos) {
        return {
            codigoConta: campos[2] || '',
            descricaoConta: campos[3] || '',
            valorInicial: this.formatarValor(campos[4] || '0'),
            valorDebito: this.formatarValor(campos[5] || '0'),
            valorCredito: this.formatarValor(campos[6] || '0'),
            valorFinal: this.formatarValor(campos[7] || '0')
        };
    }

    /**
     * Processa registro I001 (Identificação ECD)
     */
    processarRegistroI001(campos) {
        return {
            codigoVersao: campos[2] || '',
            tipoEscrituracao: campos[3] || '',
            codigoTipoECD: campos[4] || '',
            cnpj: this.formatarCNPJ(campos[5] || ''),
            razaoSocial: campos[6] || '',
            dataInicialPeriodo: this.formatarData(campos[7] || ''),
            dataFinalPeriodo: this.formatarData(campos[8] || '')
        };
    }

    /**
     * Armazena um registro processado na estrutura de dados
     * @param {Object} registro - Registro processado
     */
    armazenarRegistro(registro) {
        const codigo = registro.codigo;
        
        if (!this.dadosExtraidos[codigo]) {
            this.dadosExtraidos[codigo] = [];
        }
        
        this.dadosExtraidos[codigo].push(registro);
    }

    /**
     * Valida a integridade dos dados extraídos
     */
    validarIntegridade() {
        this.adicionarLog('Iniciando validação de integridade...');

        const totalLinhas = this.estatisticas.linhasProcessadas;
        const linhasComErro = this.estatisticas.linhasComErro;
        const registrosValidos = this.estatisticas.registrosValidos;
        const registrosEncontrados = this.estatisticas.registrosEncontrados;

        // Calcular percentuais
        const percentualSucesso = totalLinhas > 0 ? ((totalLinhas - linhasComErro) / totalLinhas) : 0;
        const percentualRegistrosValidos = registrosEncontrados > 0 ? (registrosValidos / registrosEncontrados) : 0;

        // Validar percentuais mínimos
        if (percentualSucesso < CONFIG.tolerancias.percentualLeituraMinimo) {
            this.adicionarLog(`Taxa de sucesso na leitura muito baixa: ${(percentualSucesso * 100).toFixed(2)}%`, 'warning');
        }

        if (percentualRegistrosValidos < CONFIG.tolerancias.percentualRegistrosMinimo) {
            this.adicionarLog(`Taxa de registros válidos muito baixa: ${(percentualRegistrosValidos * 100).toFixed(2)}%`, 'warning');
        }

        // Verificar se há registros obrigatórios
        this.verificarRegistrosObrigatorios();

        this.adicionarLog('Validação de integridade concluída', 'info', {
            percentualSucesso: percentualSucesso,
            percentualRegistrosValidos: percentualRegistrosValidos,
            registrosTiposEncontrados: Object.keys(this.dadosExtraidos).length
        });
    }

    /**
     * Verifica se os registros obrigatórios estão presentes
     */
    verificarRegistrosObrigatorios() {
        const registrosObrigatorios = ['0000', '9999'];
        
        registrosObrigatorios.forEach(codigo => {
            if (!this.dadosExtraidos[codigo] || this.dadosExtraidos[codigo].length === 0) {
                this.adicionarLog(`Registro obrigatório não encontrado: ${codigo}`, 'warning');
            }
        });

        // Verificações específicas por tipo de SPED
        if (this.tipoSpedIdentificado) {
            const codigoTipo = this.tipoSpedIdentificado.codigo;
            
            if (codigoTipo === 'fiscal') {
                if (!this.dadosExtraidos['0001']) {
                    this.adicionarLog('Registro 0001 não encontrado no SPED Fiscal', 'warning');
                }
                if (!this.dadosExtraidos['C100'] && !this.dadosExtraidos['C300']) {
                    this.adicionarLog('Nenhum documento fiscal (C100/C300) encontrado', 'warning');
                }
            }
            
            if (codigoTipo === 'contribuicoes') {
                if (!this.dadosExtraidos['A100']) {
                    this.adicionarLog('Registro A100 (receitas) não encontrado no SPED Contribuições', 'warning');
                }
            }
        }
    }

    /**
     * Processa os dados extraídos para criar estruturas organizadas
     */
    processarDadosExtraidos() {
        this.adicionarLog('Processando dados extraídos...');

        try {
            // Criar estruturas organizadas
            this.dadosExtraidos._resumo = this.criarResumoEstatistico();
            this.dadosExtraidos._empresa = this.extrairDadosEmpresa();
            this.dadosExtraidos._periodo = this.extrairPeriodoReferencia();

            this.adicionarLog('Dados extraídos processados com sucesso', 'info', {
                tiposRegistro: Object.keys(this.dadosExtraidos).filter(k => !k.startsWith('_')).length,
                totalRegistros: this.estatisticas.registrosEncontrados
            });

        } catch (erro) {
            this.adicionarLog('Erro no processamento dos dados extraídos', 'error', erro);
        }
    }

    /**
     * Cria resumo estatístico dos dados
     * @returns {Object} Resumo estatístico
     */
    criarResumoEstatistico() {
        const resumo = {
            totalTiposRegistro: 0,
            registrosPorTipo: {},
            registroMaisFrequente: null,
            valoresTotais: {
                documentos: 0,
                impostos: 0,
                receitas: 0
            }
        };

        // Contar registros por tipo
        Object.keys(this.dadosExtraidos).forEach(codigo => {
            if (!codigo.startsWith('_')) {
                const quantidade = this.dadosExtraidos[codigo].length;
                resumo.registrosPorTipo[codigo] = quantidade;
                resumo.totalTiposRegistro++;
            }
        });

        // Encontrar registro mais frequente
        let maiorQuantidade = 0;
        Object.entries(resumo.registrosPorTipo).forEach(([codigo, quantidade]) => {
            if (quantidade > maiorQuantidade) {
                maiorQuantidade = quantidade;
                resumo.registroMaisFrequente = codigo;
            }
        });

        // Calcular valores totais (estimativos)
        this.calcularValoresTotais(resumo);

        return resumo;
    }

    /**
     * Extrai dados básicos da empresa
     * @returns {Object} Dados da empresa
     */
    extrairDadosEmpresa() {
        const dadosEmpresa = {
            razaoSocial: '',
            cnpj: '',
            inscricaoEstadual: '',
            uf: '',
            municipio: '',
            fonte: 'Não identificado'
        };

        // Tentar extrair do registro 0000
        if (this.dadosExtraidos['0000'] && this.dadosExtraidos['0000'].length > 0) {
            const reg0000 = this.dadosExtraidos['0000'][0].dadosProcessados;
            dadosEmpresa.razaoSocial = reg0000.razaoSocial || '';
            dadosEmpresa.cnpj = reg0000.cnpj || '';
            dadosEmpresa.inscricaoEstadual = reg0000.inscricaoEstadual || '';
            dadosEmpresa.uf = reg0000.uf || '';
            dadosEmpresa.fonte = 'Registro 0000';
        }

        // Complementar com J001 se for ECF
        if (this.dadosExtraidos['J001'] && this.dadosExtraidos['J001'].length > 0) {
            const regJ001 = this.dadosExtraidos['J001'][0].dadosProcessados;
            if (!dadosEmpresa.razaoSocial) dadosEmpresa.razaoSocial = regJ001.razaoSocial || '';
            if (!dadosEmpresa.cnpj) dadosEmpresa.cnpj = regJ001.cnpj || '';
            dadosEmpresa.fonte = dadosEmpresa.fonte === 'Não identificado' ? 'Registro J001' : dadosEmpresa.fonte + ', J001';
        }

        // Complementar com I001 se for ECD
        if (this.dadosExtraidos['I001'] && this.dadosExtraidos['I001'].length > 0) {
            const regI001 = this.dadosExtraidos['I001'][0].dadosProcessados;
            if (!dadosEmpresa.razaoSocial) dadosEmpresa.razaoSocial = regI001.razaoSocial || '';
            if (!dadosEmpresa.cnpj) dadosEmpresa.cnpj = regI001.cnpj || '';
            dadosEmpresa.fonte = dadosEmpresa.fonte === 'Não identificado' ? 'Registro I001' : dadosEmpresa.fonte + ', I001';
        }

        return dadosEmpresa;
    }

    /**
     * Extrai período de referência dos dados
     * @returns {Object} Período de referência
     */
    extrairPeriodoReferencia() {
        const periodo = {
            dataInicial: '',
            dataFinal: '',
            fonte: 'Não identificado'
        };

        // Tentar extrair do registro 0000
        if (this.dadosExtraidos['0000'] && this.dadosExtraidos['0000'].length > 0) {
            const reg0000 = this.dadosExtraidos['0000'][0].dadosProcessados;
            periodo.dataInicial = reg0000.dataInicial || '';
            periodo.dataFinal = reg0000.dataFinal || '';
            periodo.fonte = 'Registro 0000';
        }

        return periodo;
    }

    /**
     * Calcula valores totais aproximados
     * @param {Object} resumo - Objeto de resumo a ser preenchido
     */
    calcularValoresTotais(resumo) {
        try {
            // Contar documentos fiscais
            if (this.dadosExtraidos['C100']) {
                resumo.valoresTotais.documentos = this.dadosExtraidos['C100'].length;
            }

            // Somar valores de impostos (aproximativo)
            let totalImpostos = 0;
            if (this.dadosExtraidos['C100']) {
                this.dadosExtraidos['C100'].forEach(registro => {
                    const dados = registro.dadosProcessados;
                    totalImpostos += (dados.valorICMS || 0) + (dados.valorPIS || 0) + 
                                   (dados.valorCOFINS || 0) + (dados.valorIPI || 0);
                });
            }
            resumo.valoresTotais.impostos = totalImpostos;

            // Somar receitas
            let totalReceitas = 0;
            if (this.dadosExtraidos['A100']) {
                this.dadosExtraidos['A100'].forEach(registro => {
                    const dados = registro.dadosProcessados;
                    totalReceitas += dados.valorReceitaBruta || 0;
                });
            }
            resumo.valoresTotais.receitas = totalReceitas;

        } catch (erro) {
            this.adicionarLog('Erro no cálculo de valores totais', 'warning', erro);
        }
    }

    /**
     * Reseta as estatísticas para novo processamento
     */
    resetarEstatisticas() {
        this.estatisticas = {
            linhasProcessadas: 0,
            linhasComErro: 0,
            registrosEncontrados: 0,
            registrosValidos: 0,
            tempoProcessamento: 0,
            erros: []
        };
    }

    /**
     * Formata um valor monetário
     * @param {string} valor - Valor como string
     * @returns {number} Valor numérico
     */
    formatarValor(valor) {
        if (typeof valor !== 'string') {
            return parseFloat(valor) || 0;
        }
        
        // Remove caracteres não numéricos exceto vírgula e ponto
        const valorLimpo = valor.replace(/[^\d,.-]/g, '');
        
        // Converte vírgula decimal para ponto
        const valorNormalizado = valorLimpo.replace(',', '.');
        
        return parseFloat(valorNormalizado) || 0;
    }

    /**
     * Formata uma data do SPED
     * @param {string} data - Data como string DDMMAAAA
     * @returns {string} Data formatada AAAA-MM-DD
     */
    formatarData(data) {
        if (!data || data.length !== 8) {
            return '';
        }
        
        const dia = data.substring(0, 2);
        const mes = data.substring(2, 4);
        const ano = data.substring(4, 8);
        
        return `${ano}-${mes}-${dia}`;
    }

    /**
     * Formata um CNPJ
     * @param {string} cnpj - CNPJ como string
     * @returns {string} CNPJ formatado
     */
    formatarCNPJ(cnpj) {
        if (!cnpj || cnpj.length !== 14) {
            return cnpj;
        }
        
        return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    /**
     * Formata tamanho de arquivo
     * @param {number} bytes - Tamanho em bytes
     * @returns {string} Tamanho formatado
     */
    formatarTamanho(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Função principal de parsing (interface pública)
 * @param {File} arquivo - Arquivo SPED a ser parseado
 * @param {Object} opcoes - Opções de processamento
 * @returns {Promise<Object>} Resultado do parsing
 */
async function parsearArquivoSped(arquivo, opcoes = {}) {
    console.log('SPED-PARSER: Iniciando parsing do arquivo SPED...', arquivo.name);

    const parser = new SpedParser();

    try {
        // 1. Validar arquivo
        const validacao = parser.validarArquivo(arquivo);
        if (!validacao.valido) {
            return {
                sucesso: false,
                erro: `Arquivo inválido: ${validacao.erros.join(', ')}`,
                avisos: validacao.avisos,
                estatisticas: parser.estatisticas,
                log: parser.log
            };
        }

        // 2. Ler conteúdo do arquivo
        parser.adicionarLog(`Lendo arquivo: ${arquivo.name} (${parser.formatarTamanho(arquivo.size)})`);
        const conteudo = await parser.lerArquivo(arquivo);
        
        // 3. Identificar tipo de SPED
        const tipoIdentificado = parser.identificarTipoSped(conteudo);
        if (!tipoIdentificado) {
            return {
                sucesso: false,
                erro: 'Não foi possível identificar o tipo de SPED',
                estatisticas: parser.estatisticas,
                log: parser.log
            };
        }

        // 4. Processar conteúdo
        const resultado = parser.processarConteudo(conteudo, opcoes);
        
        // 5. Retornar resultado completo
        return {
            sucesso: resultado.sucesso,
            erro: resultado.erro,
            tipoSped: tipoIdentificado,
            dadosEmpresa: parser.dadosExtraidos._empresa,
            periodoReferencia: parser.dadosExtraidos._periodo,
            registros: parser.dadosExtraidos,
            resumo: parser.dadosExtraidos._resumo,
            estatisticas: parser.estatisticas,
            log: parser.log,
            metadados: {
                nomeArquivo: arquivo.name,
                tamanhoArquivo: arquivo.size,
                timestampProcessamento: new Date().toISOString(),
                versaoParser: '1.0.0'
            }
        };

    } catch (erro) {
        console.error('SPED-PARSER: Erro durante o parsing:', erro);
        parser.adicionarLog('Erro crítico durante o parsing', 'error', erro);
        
        return {
            sucesso: false,
            erro: `Erro no processamento: ${erro.message}`,
            estatisticas: parser.estatisticas,
            log: parser.log
        };
    }
}

/**
 * Função utilitária para identificar tipo de SPED sem processar
 * @param {File} arquivo - Arquivo SPED
 * @returns {Promise<Object|null>} Tipo identificado ou null
 */
async function identificarTipoArquivoSped(arquivo) {
    const parser = new SpedParser();
    
    try {
        // Ler apenas o início do arquivo
        const conteudo = await parser.lerArquivo(arquivo);
        const linhasIniciais = conteudo.split(CONFIG.terminadorLinha).slice(0, 10).join('\n');
        
        return parser.identificarTipoSped(linhasIniciais);
    } catch (erro) {
        console.error('SPED-PARSER: Erro na identificação:', erro);
        return null;
    }
}

/**
 * Função utilitária para validar arquivo SPED
 * @param {File} arquivo - Arquivo a ser validado
 * @returns {Object} Resultado da validação
 */
function validarArquivoSped(arquivo) {
    const parser = new SpedParser();
    return parser.validarArquivo(arquivo);
}

// Interface pública do módulo
return {
    parsearArquivoSped,
    identificarTipoArquivoSped,
    validarArquivoSped,
    CONFIG,
    
    // Classes e utilitários expostos para extensão
    SpedParser
};