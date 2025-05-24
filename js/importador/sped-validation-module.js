/**
 * Módulo de Validação e Diagnóstico SPED
 * Responsável por validar a integridade dos dados extraídos e diagnosticar problemas
 * VERSÃO CORRIGIDA - Janeiro 2025
 */
const SpedValidationModule = (function() {
    
    /**
     * Valida a estrutura e qualidade dos dados SPED extraídos
     */
    function validarDadosSped(dadosSped) {
        console.log('SPED-VALIDATION: Iniciando validação dos dados SPED');
        
        const relatorio = {
            timestamp: new Date().toISOString(),
            status: 'pendente',
            pontuacao: 0,
            problemas: [],
            alertas: [],
            sucessos: [],
            recomendacoes: [],
            dadosEncontrados: {},
            estatisticas: {}
        };
        
        try {
            // Validação da estrutura básica
            validarEstruturaBasica(dadosSped, relatorio);
            
            // Validação dos dados da empresa
            validarDadosEmpresa(dadosSped, relatorio);
            
            // Validação dos dados fiscais
            validarDadosFiscais(dadosSped, relatorio);
            
            // Validação dos documentos
            validarDocumentos(dadosSped, relatorio);
            
            // Validação dos créditos e débitos
            validarCreditosDebitos(dadosSped, relatorio);
            
            // Calcular pontuação final
            calcularPontuacaoFinal(relatorio);
            
            console.log('SPED-VALIDATION: Validação concluída', relatorio);
            return relatorio;
            
        } catch (erro) {
            relatorio.status = 'erro';
            relatorio.problemas.push(`Erro durante validação: ${erro.message}`);
            console.error('SPED-VALIDATION: Erro durante validação:', erro);
            return relatorio;
        }
    }
    
    /**
     * Valida a estrutura básica dos dados SPED
     */
    function validarEstruturaBasica(dadosSped, relatorio) {
        relatorio.dadosEncontrados.estruturaBasica = true;
        
        if (!dadosSped || typeof dadosSped !== 'object') {
            relatorio.problemas.push('Dados SPED não são um objeto válido');
            return;
        }
        
        // Verificar propriedades essenciais
        const propriedadesEssenciais = ['empresa', 'documentos', 'creditos', 'debitos', 'metadados'];
        const propriedadesEncontradas = [];
        
        propriedadesEssenciais.forEach(prop => {
            if (dadosSped.hasOwnProperty(prop)) {
                propriedadesEncontradas.push(prop);
                relatorio.dadosEncontrados[prop] = true;
            } else {
                relatorio.alertas.push(`Propriedade '${prop}' não encontrada na estrutura`);
                relatorio.dadosEncontrados[prop] = false;
            }
        });
        
        if (propriedadesEncontradas.length >= 3) {
            relatorio.sucessos.push(`Estrutura básica válida (${propriedadesEncontradas.length}/${propriedadesEssenciais.length} propriedades)`);
            relatorio.pontuacao += 20;
        } else {
            relatorio.problemas.push(`Estrutura básica insuficiente (${propriedadesEncontradas.length}/${propriedadesEssenciais.length} propriedades)`);
        }
    }
    
    /**
     * Valida os dados da empresa
     */
    function validarDadosEmpresa(dadosSped, relatorio) {
        const empresa = dadosSped.empresa || {};
        relatorio.estatisticas.empresa = {};
        
        // Verificar campos essenciais da empresa
        const camposEmpresa = {
            nome: { peso: 25, tipo: 'string', obrigatorio: true },
            cnpj: { peso: 25, tipo: 'string', obrigatorio: true },
            faturamento: { peso: 30, tipo: 'number', obrigatorio: false },
            tipoEmpresa: { peso: 10, tipo: 'string', obrigatorio: false },
            regime: { peso: 10, tipo: 'string', obrigatorio: false }
        };
        
        let pontuacaoEmpresa = 0;
        
        Object.entries(camposEmpresa).forEach(([campo, config]) => {
            const valor = empresa[campo];
            const temValor = valor !== undefined && valor !== null && valor !== '';
            
            relatorio.estatisticas.empresa[campo] = {
                presente: temValor,
                valor: temValor ? valor : null,
                tipo: typeof valor
            };
            
            if (temValor) {
                // Validar tipo
                if (config.tipo === 'number' && typeof valor === 'number' && valor > 0) {
                    pontuacaoEmpresa += config.peso;
                    relatorio.sucessos.push(`Campo '${campo}' da empresa válido: ${formatarValorLog(valor)}`);
                } else if (config.tipo === 'string' && typeof valor === 'string' && valor.trim().length > 0) {
                    pontuacaoEmpresa += config.peso;
                    relatorio.sucessos.push(`Campo '${campo}' da empresa válido: ${valor}`);
                } else {
                    relatorio.alertas.push(`Campo '${campo}' da empresa com tipo inválido`);
                }
            } else if (config.obrigatorio) {
                relatorio.problemas.push(`Campo obrigatório '${campo}' da empresa não encontrado`);
            } else {
                relatorio.alertas.push(`Campo opcional '${campo}' da empresa não encontrado`);
            }
        });
        
        relatorio.pontuacao += Math.round(pontuacaoEmpresa * 0.3); // 30% da pontuação total
        
        // Validações específicas
        if (empresa.cnpj && !validarCNPJ(empresa.cnpj)) {
            relatorio.problemas.push('CNPJ da empresa com formato inválido');
        }
        
        if (empresa.faturamento && empresa.faturamento <= 0) {
            relatorio.alertas.push('Faturamento da empresa é zero ou negativo');
        }
    }
    
    /**
     * Valida os dados fiscais
     */
    function validarDadosFiscais(dadosSped, relatorio) {
        relatorio.estatisticas.fiscal = {};
        
        // Verificar presença de dados fiscais
        const tiposFiscais = ['creditos', 'debitos', 'impostos', 'regimes'];
        let dadosFiscaisEncontrados = 0;
        
        tiposFiscais.forEach(tipo => {
            const dados = dadosSped[tipo];
            const temDados = dados && typeof dados === 'object' && Object.keys(dados).length > 0;
            
            relatorio.estatisticas.fiscal[tipo] = {
                presente: temDados,
                quantidade: temDados ? Object.keys(dados).length : 0
            };
            
            if (temDados) {
                dadosFiscaisEncontrados++;
                relatorio.sucessos.push(`Dados de '${tipo}' encontrados (${Object.keys(dados).length} categorias)`);
                
                // Validar estrutura interna
                validarEstruturaFiscal(dados, tipo, relatorio);
            } else {
                relatorio.alertas.push(`Dados de '${tipo}' não encontrados ou vazios`);
            }
        });
        
        if (dadosFiscaisEncontrados >= 2) {
            relatorio.pontuacao += 25;
            relatorio.sucessos.push(`Dados fiscais suficientes encontrados (${dadosFiscaisEncontrados}/${tiposFiscais.length})`);
        } else {
            relatorio.problemas.push(`Dados fiscais insuficientes (${dadosFiscaisEncontrados}/${tiposFiscais.length})`);
        }
    }
    
    /**
     * Valida a estrutura interna dos dados fiscais
     */
    function validarEstruturaFiscal(dados, tipo, relatorio) {
        const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
        
        impostos.forEach(imposto => {
            if (dados[imposto] && Array.isArray(dados[imposto])) {
                const quantidade = dados[imposto].length;
                if (quantidade > 0) {
                    relatorio.sucessos.push(`${tipo.toUpperCase()}.${imposto.toUpperCase()}: ${quantidade} registros`);
                    
                    // Validar estrutura dos registros
                    const amostra = dados[imposto][0];
                    if (amostra && typeof amostra === 'object') {
                        const camposEsperados = getCamposEsperados(tipo, imposto);
                        validarRegistroFiscal(amostra, camposEsperados, `${tipo}.${imposto}`, relatorio);
                    }
                } else {
                    relatorio.alertas.push(`${tipo.toUpperCase()}.${imposto.toUpperCase()}: array vazio`);
                }
            }
        });
    }
    
    /**
     * Valida um registro fiscal individual
     */
    function validarRegistroFiscal(registro, camposEsperados, contexto, relatorio) {
        let camposValidos = 0;
        
        camposEsperados.forEach(campo => {
            if (registro.hasOwnProperty(campo)) {
                const valor = registro[campo];
                if (valor !== undefined && valor !== null && valor !== '') {
                    camposValidos++;
                }
            }
        });
        
        const percentualValido = (camposValidos / camposEsperados.length) * 100;
        
        if (percentualValido >= 70) {
            relatorio.sucessos.push(`${contexto}: estrutura do registro válida (${percentualValido.toFixed(0)}%)`);
        } else if (percentualValido >= 40) {
            relatorio.alertas.push(`${contexto}: estrutura do registro parcialmente válida (${percentualValido.toFixed(0)}%)`);
        } else {
            relatorio.problemas.push(`${contexto}: estrutura do registro insuficiente (${percentualValido.toFixed(0)}%)`);
        }
    }
    
    /**
     * Retorna campos esperados para cada tipo de registro fiscal
     */
    function getCamposEsperados(tipo, imposto) {
        const campos = {
            creditos: {
                pis: ['tipo', 'categoria', 'valorCredito', 'codigoCredito'],
                cofins: ['tipo', 'categoria', 'valorCredito', 'codigoCredito'],
                icms: ['tipo', 'categoria', 'valorCredito'],
                ipi: ['tipo', 'categoria', 'valorCredito']
            },
            debitos: {
                pis: ['tipo', 'categoria', 'valorTotalContribuicao', 'valorContribuicaoAPagar'],
                cofins: ['tipo', 'categoria', 'valorTotalContribuicao', 'valorContribuicaoAPagar'],
                icms: ['tipo', 'categoria', 'valorTotalDebitos', 'valorTotalCreditos'],
                ipi: ['tipo', 'categoria', 'valorTotalDebitos', 'valorTotalCreditos']
            }
        };
        
        return campos[tipo]?.[imposto] || ['tipo', 'categoria'];
    }
    
    /**
     * Valida os documentos fiscais
     */
    function validarDocumentos(dadosSped, relatorio) {
        const documentos = dadosSped.documentos || [];
        relatorio.estatisticas.documentos = {
            total: documentos.length,
            saidas: 0,
            entradas: 0,
            comValor: 0,
            semValor: 0
        };
        
        if (!Array.isArray(documentos)) {
            relatorio.problemas.push('Documentos não estão em formato de array');
            return;
        }
        
        if (documentos.length === 0) {
            relatorio.alertas.push('Nenhum documento fiscal encontrado');
            return;
        }
        
        // Analisar documentos
        documentos.forEach(doc => {
            if (doc.indOper === '1') {
                relatorio.estatisticas.documentos.saidas++;
            } else if (doc.indOper === '0') {
                relatorio.estatisticas.documentos.entradas++;
            }
            
            if (doc.valorTotal && doc.valorTotal > 0) {
                relatorio.estatisticas.documentos.comValor++;
            } else {
                relatorio.estatisticas.documentos.semValor++;
            }
        });
        
        relatorio.sucessos.push(`${documentos.length} documentos fiscais encontrados`);
        relatorio.sucessos.push(`Documentos de saída: ${relatorio.estatisticas.documentos.saidas}`);
        relatorio.sucessos.push(`Documentos de entrada: ${relatorio.estatisticas.documentos.entradas}`);
        
        if (relatorio.estatisticas.documentos.comValor > 0) {
            relatorio.pontuacao += 20;
            relatorio.sucessos.push(`${relatorio.estatisticas.documentos.comValor} documentos com valor válido`);
        }
        
        if (relatorio.estatisticas.documentos.semValor > documentos.length * 0.5) {
            relatorio.alertas.push(`${relatorio.estatisticas.documentos.semValor} documentos sem valor ou com valor zero`);
        }
    }
    
    /**
     * Valida créditos e débitos
     */
    function validarCreditosDebitos(dadosSped, relatorio) {
        const creditos = dadosSped.creditos || {};
        const debitos = dadosSped.debitos || {};
        
        relatorio.estatisticas.impostos = {};
        
        const impostos = ['pis', 'cofins', 'icms', 'ipi'];
        
        impostos.forEach(imposto => {
            const creditosImposto = creditos[imposto] || [];
            const debitosImposto = debitos[imposto] || [];
            
            relatorio.estatisticas.impostos[imposto] = {
                creditos: creditosImposto.length,
                debitos: debitosImposto.length,
                valorCreditos: calcularValorTotal(creditosImposto, 'valorCredito'),
                valorDebitos: calcularValorTotal(debitosImposto, ['valorTotalContribuicao', 'valorTotalDebitos'])
            };
            
            const stats = relatorio.estatisticas.impostos[imposto];
            
            if (stats.creditos > 0 || stats.debitos > 0) {
                relatorio.sucessos.push(`${imposto.toUpperCase()}: ${stats.creditos} créditos, ${stats.debitos} débitos`);
                
                if (stats.valorCreditos > 0 || stats.valorDebitos > 0) {
                    relatorio.pontuacao += 5;
                    relatorio.sucessos.push(`${imposto.toUpperCase()}: valores monetários válidos encontrados`);
                }
            } else {
                relatorio.alertas.push(`${imposto.toUpperCase()}: nenhum crédito ou débito encontrado`);
            }
        });
    }
    
    /**
     * Calcula valor total de um array de registros
     */
    function calcularValorTotal(registros, camposValor) {
        if (!Array.isArray(registros)) return 0;
        
        const campos = Array.isArray(camposValor) ? camposValor : [camposValor];
        
        return registros.reduce((total, registro) => {
            for (const campo of campos) {
                const valor = registro[campo];
                if (typeof valor === 'number' && valor > 0) {
                    return total + valor;
                }
            }
            return total;
        }, 0);
    }
    
    /**
     * Calcula a pontuação final do relatório
     */
    function calcularPontuacaoFinal(relatorio) {
        relatorio.pontuacao = Math.min(100, Math.max(0, relatorio.pontuacao));
        
        if (relatorio.pontuacao >= 80) {
            relatorio.status = 'excelente';
            relatorio.recomendacoes.push('Dados SPED de alta qualidade - prosseguir com importação');
        } else if (relatorio.pontuacao >= 60) {
            relatorio.status = 'bom';
            relatorio.recomendacoes.push('Dados SPED de boa qualidade - prosseguir com importação');
        } else if (relatorio.pontuacao >= 40) {
            relatorio.status = 'regular';
            relatorio.recomendacoes.push('Dados SPED de qualidade regular - verificar problemas antes de prosseguir');
        } else {
            relatorio.status = 'insuficiente';
            relatorio.recomendacoes.push('Dados SPED de qualidade insuficiente - revisar arquivos antes de prosseguir');
        }
        
        // Adicionar recomendações específicas
        if (relatorio.problemas.length > 5) {
            relatorio.recomendacoes.push('Muitos problemas encontrados - considere reprocessar os arquivos SPED');
        }
        
        if (relatorio.alertas.length > 10) {
            relatorio.recomendacoes.push('Muitos alertas encontrados - verifique a completude dos dados');
        }
        
        if (!relatorio.dadosEncontrados.empresa) {
            relatorio.recomendacoes.push('Dados da empresa não encontrados - importação pode falhar');
        }
    }
    
    /**
     * Gera um relatório de diagnóstico em formato HTML
     */
    function gerarRelatorioHTML(relatorio) {
        const statusColor = {
            excelente: '#28a745',
            bom: '#28a745',
            regular: '#ffc107',
            insuficiente: '#dc3545',
            erro: '#dc3545'
        };
        
        return `
            <div class="relatorio-validacao" style="font-family: Arial, sans-serif; margin: 20px 0;">
                <div class="header" style="background: ${statusColor[relatorio.status]}; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                    <h3 style="margin: 0;">Relatório de Validação SPED</h3>
                    <p style="margin: 5px 0 0 0;">Status: ${relatorio.status.toUpperCase()} (${relatorio.pontuacao}/100 pontos)</p>
                    <p style="margin: 5px 0 0 0; font-size: 12px;">${new Date(relatorio.timestamp).toLocaleString('pt-BR')}</p>
                </div>
                
                <div class="content" style="border: 1px solid #ddd; border-top: none; padding: 15px;">
                    ${gerarSecaoRelatorio('Sucessos', relatorio.sucessos, '#28a745')}
                    ${gerarSecaoRelatorio('Alertas', relatorio.alertas, '#ffc107')}
                    ${gerarSecaoRelatorio('Problemas', relatorio.problemas, '#dc3545')}
                    ${gerarSecaoRelatorio('Recomendações', relatorio.recomendacoes, '#17a2b8')}
                    
                    <div class="estatisticas" style="margin-top: 20px;">
                        <h4 style="color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 5px;">Estatísticas</h4>
                        ${gerarEstatisticasHTML(relatorio.estatisticas)}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Gera uma seção do relatório HTML
     */
    function gerarSecaoRelatorio(titulo, itens, cor) {
        if (!itens || itens.length === 0) return '';
        
        return `
            <div class="secao-relatorio" style="margin-bottom: 20px;">
                <h4 style="color: ${cor}; margin-bottom: 10px;">${titulo} (${itens.length})</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    ${itens.map(item => `<li style="margin-bottom: 5px;">${item}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    /**
     * Gera HTML das estatísticas
     */
    function gerarEstatisticasHTML(estatisticas) {
        let html = '';
        
        Object.entries(estatisticas).forEach(([categoria, dados]) => {
            html += `<div style="margin-bottom: 15px;">`;
            html += `<h5 style="color: #6c757d; margin-bottom: 10px;">${categoria.toUpperCase()}</h5>`;
            html += `<div style="background: #f8f9fa; padding: 10px; border-radius: 3px; font-size: 14px;">`;
            
            if (typeof dados === 'object') {
                Object.entries(dados).forEach(([chave, valor]) => {
                    html += `<div style="margin-bottom: 5px;"><strong>${chave}:</strong> ${formatarValorLog(valor)}</div>`;
                });
            } else {
                html += `<div>${formatarValorLog(dados)}</div>`;
            }
            
            html += `</div></div>`;
        });
        
        return html;
    }
    
    /**
     * Valida formato de CNPJ
     */
    function validarCNPJ(cnpj) {
        const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
        return cnpjLimpo.length === 14;
    }
    
    /**
     * Formata valor para exibição no log
     */
    function formatarValorLog(valor) {
        if (typeof valor === 'number') {
            if (valor > 1000000) {
                return `R$ ${(valor / 1000000).toFixed(2)}M`;
            } else if (valor > 1000) {
                return `R$ ${(valor / 1000).toFixed(2)}K`;
            } else {
                return `R$ ${valor.toFixed(2)}`;
            }
        } else if (typeof valor === 'boolean') {
            return valor ? 'Sim' : 'Não';
        } else {
            return String(valor);
        }
    }
    
    // Interface pública
    return {
        validarDadosSped,
        gerarRelatorioHTML,
        versao: '1.0.0'
    };
})();

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
    window.SpedValidationModule = SpedValidationModule;
    console.log('SPED-VALIDATION: Módulo carregado com sucesso na versão', SpedValidationModule.versao);
}