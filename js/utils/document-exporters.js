/**
 * Document Exporters
 * Specific implementations for different export formats
 */

/**
 * Base exporter class
 */
class BaseExporter {
    constructor() {
        this.config = {};
    }

    /**
     * Set configuration
     * @param {Object} config - Configuration object
     */
    setConfig(config) {
        this.config = config;
    }

    /**
     * Export method to be implemented by subclasses
     * @param {Object} data - Data to export
     * @param {Object} options - Export options
     * @returns {Promise} Promise resolved after export
     */
    export(data, options) {
        throw new Error('Method not implemented');
    }

    /**
     * Validate required libraries
     * @returns {boolean} True if valid
     */
    validateLibraries() {
        throw new Error('Method not implemented');
    }
}

/**
 * PDF Exporter
 * Handles PDF document generation
 */
class PDFExporter extends BaseExporter {
    constructor() {
        super();
    }

    /**
     * Validate required libraries
     * @returns {boolean} True if valid
     */
    validateLibraries() {
        if (!window.jsPDFLoaded && !window.jspdf && !window.jsPDF) {
            console.error('jsPDF library not loaded');
            return false;
        }
        return true;
    }

    /**
     * Export data to PDF
     * @param {Object} simulation - Simulation data to export
     * @param {Object} options - Export options
     * @returns {Promise} Promise resolved after export
     */
    export(simulation, options = {}) {
        console.log("Starting PDF export");

        if (!this.validateLibraries()) {
            return Promise.reject('jsPDF not available');
        }

        // Verificar se DataManager está disponível
        if (!window.DataManager) {
            console.error('DataManager não disponível para exportação PDF');
            return Promise.reject('DataManager not available');
        }

        try {
            // Validar a estrutura dos dados de entrada usando DataManager
            if (!simulation) {
                // Tentar obter da ultima simulação realizada
                if (!window.resultadosSimulacao) {
                    alert('Nenhuma simulação foi realizada ainda');
                    return Promise.reject('No simulation performed');
                }

                // Construir estrutura de simulação a partir dos resultados globais
                const dadosFormulario = window.DataManager.obterDadosDoFormulario();
                simulation = {
                    dados: dadosFormulario,
                    resultados: window.resultadosSimulacao
                };
            }

            // Garantir que temos uma estrutura válida
            let dadosSimulacao;
            if (simulation.dados) {
                // Validar e normalizar os dados usando DataManager
                dadosSimulacao = window.DataManager.validarENormalizar(simulation.dados);
            } else {
                // Tentar obter dados do formulário
                dadosSimulacao = window.DataManager.obterDadosDoFormulario();
                if (!dadosSimulacao) {
                    throw new Error('Não foi possível obter dados válidos para exportação');
                }
            }

            // Garantir que os resultados existem e estão em formato adequado
            let resultadosSimulacao = simulation.resultados || window.resultadosSimulacao;
            if (!resultadosSimulacao) {
                throw new Error('Resultados da simulação não encontrados');
            }

            // Get export results from any location
            const resultadosExportacao = resultadosSimulacao.resultadosExportacao || 
                                      resultadosSimulacao;

            if (!resultadosExportacao) {
                console.warn('Resultados para exportação não encontrados. Utilizando resultados brutos.');
            }

            // Request filename from user usando ExportManager como fallback
            let filename;
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.requestFilename === 'function') {
                filename = window.DataManager.requestFilename("pdf", "relatorio-split-payment");
            } else {
                const exportManager = new ExportManager();
                filename = exportManager.requestFilename("pdf", "relatorio-split-payment");
            }

            if (!filename) {
                return Promise.resolve({success: false, message: "Export cancelled by user"});
            }

            // Create PDF document with defined settings
            const doc = new window.jspdf.jsPDF({
                orientation: this.config.pdf.orientation || "portrait",
                unit: "mm",
                format: this.config.pdf.pageSize || "a4",
                compress: true
            });

            // Set document properties
            doc.setProperties({
                title: "Relatório Simulador de Split Payment",
                subject: "Análise do impacto do Split Payment no fluxo de caixa",
                author: "Expertzy Inteligência Tributária",
                keywords: "Split Payment, Reforma Tributária, Fluxo de Caixa, Simulação",
                creator: "Expertzy IT"
            });

            // Initialize page count for numbering
            let pageCount = 1;
            let currentPositionY = 0;
            const margins = this.config.pdf.margins;

            // Add cover page
            this._addCover(doc, dadosSimulacao, pageCount);
            doc.addPage();
            pageCount++;

            // Add index
            currentPositionY = this._addIndex(doc, pageCount);
            doc.addPage();
            pageCount++;

            // Add simulation parameters
            currentPositionY = this._addSimulationParameters(doc, dadosSimulacao, pageCount);
            doc.addPage();
            pageCount++;

            // Add simulation results - robust version
            currentPositionY = this._addRobustSimulationResults(
                doc, 
                simulation, 
                resultadosExportacao || resultadosSimulacao,
                pageCount
            );
            doc.addPage();
            pageCount++;

            // Add charts - with existence check
            currentPositionY = this._addRobustCharts(doc, pageCount);
            doc.addPage();
            pageCount++;

            // Add strategy analysis - with existence check
            currentPositionY = this._addRobustStrategyAnalysis(
                doc, 
                dadosSimulacao, 
                resultadosSimulacao, 
                pageCount
            );
            doc.addPage();
            pageCount++;

            // Add calculation memory
            const getMemoryCalculation = function() {
                const selectedYear =
                    document.getElementById("select-ano-memoria")?.value ||
                    (window.memoriaCalculoSimulacao ? Object.keys(window.memoriaCalculoSimulacao)[0] : "2026");
                return window.memoriaCalculoSimulacao && window.memoriaCalculoSimulacao[selectedYear]
                    ? window.memoriaCalculoSimulacao[selectedYear]
                    : "Calculation memory not available for the selected year.";
            };
            currentPositionY = this._addMemoryCalculation(doc, getMemoryCalculation, pageCount);
            doc.addPage();
            pageCount++;

            // Add conclusion
            const equivalentRates = simulation.aliquotasEquivalentes || {};
            currentPositionY = this._addRobustConclusion(
                doc, 
                dadosSimulacao, 
                resultadosSimulacao, 
                pageCount, 
                equivalentRates
            );

            // Add header and footer to all pages (except cover)
            this._addHeaderFooter(doc, pageCount);

            // Save file
            doc.save(filename);

            // Log da exportação para diagnóstico
            window.DataManager.logTransformacao(
                simulation,
                { filename, pageCount },
                'Exportação PDF Concluída'
            );

            return Promise.resolve({
                success: true,
                message: "Report exported successfully!",
                fileName: filename
            });
        } catch (error) {
            console.error(`Error exporting to PDF: ${error.message}`, error);
            alert(`Error exporting to PDF: ${error.message}`);

            return Promise.reject({
                success: false,
                message: `Error exporting to PDF: ${error.message}`,
                error: error
            });
        }
    }

    // Métodos auxiliares do PDF
    _addCover(doc, data, pageNumber) {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margins = this.config.pdf.margins;

        // Fundo gradiente sutil na capa
        this._drawGradient(doc, 0, 0, pageWidth, pageHeight, [240, 240, 240], [220, 220, 220]);

        let currentY = 50;

        // Logo
        if (this.config.pdf.logoEnabled) {
            try {
                const logoImg = document.querySelector('img.logo');
                if (logoImg && logoImg.complete) {
                    const logoWidth = 70;
                    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
                    doc.addImage(
                        logoImg,
                        'PNG',
                        (pageWidth - logoWidth) / 2,
                        currentY,
                        logoWidth,
                        logoHeight
                    );
                    currentY += logoHeight + 30;
                } else {
                    currentY += 30;
                }
            } catch (e) {
                console.warn('Não foi possível adicionar o logo:', e);
                currentY += 30;
            }
        }

        // Título do relatório
        doc.setFont("helvetica", "bold");
        doc.setFontSize(24);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);

        const tituloPrincipal = 'RELATÓRIO DE SIMULAÇÃO';
        doc.text(tituloPrincipal, pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        const subtitulo = 'IMPACTO DO SPLIT PAYMENT NO FLUXO DE CAIXA';
        doc.text(subtitulo, pageWidth / 2, currentY, { align: 'center' });
        currentY += 30;

        // Informações da empresa - CORREÇÃO PRINCIPAL
        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);

        // Validar e obter dados da empresa usando DataManager
        let dadosEmpresa = {};

        // Verificar se data está na estrutura aninhada correta
        if (data && data.empresa) {
            dadosEmpresa = data.empresa;
        } else if (window.DataManager) {
            // Tentar obter dados do formulário via DataManager
            const dadosFormulario = window.DataManager.obterDadosDoFormulario();
            if (dadosFormulario && dadosFormulario.empresa) {
                dadosEmpresa = dadosFormulario.empresa;
            }
        }

        // Obter nome da empresa de forma robusta
        let nomeEmpresa = 'Empresa não identificada';
        if (dadosEmpresa.nome && dadosEmpresa.nome.trim() !== '') {
            nomeEmpresa = dadosEmpresa.nome.trim();
        } else {
            // Tentar obter do campo do formulário diretamente
            const campoEmpresa = document.getElementById('empresa');
            if (campoEmpresa && campoEmpresa.value && campoEmpresa.value.trim() !== '') {
                nomeEmpresa = campoEmpresa.value.trim();
            }
        }

        // Obter setor de forma robusta
        let setorText = 'Setor não especificado';
        if (dadosEmpresa.setor) {
            if (window.SetoresRepository && typeof window.SetoresRepository.obterSetor === 'function') {
                const setor = window.SetoresRepository.obterSetor(dadosEmpresa.setor);
                if (setor && setor.nome) {
                    setorText = setor.nome;
                } else {
                    setorText = this._formatarTexto(dadosEmpresa.setor);
                }
            } else {
                setorText = this._formatarTexto(dadosEmpresa.setor);
            }
        }

        // Obter regime tributário de forma robusta
        let regimeText = 'Regime não especificado';
        const regimeMap = {
            'real': 'Lucro Real',
            'presumido': 'Lucro Presumido',
            'simples': 'Simples Nacional',
            'mei': 'Microempreendedor Individual'
        };

        if (dadosEmpresa.regime) {
            regimeText = regimeMap[dadosEmpresa.regime] || this._formatarTexto(dadosEmpresa.regime);
        }

        // Montar informações da empresa
        const infoText = [
            `Empresa: ${nomeEmpresa}`,
            `Setor: ${setorText}`,
            `Regime Tributário: ${regimeText}`,
            `Data: ${new Date().toLocaleDateString('pt-BR')}`
        ];

        infoText.forEach(text => {
            doc.setFont("helvetica", "bold");
            doc.text(text, pageWidth / 2, currentY, { align: 'center' });
            doc.setFont("helvetica", "normal");
            currentY += 10;
        });

        currentY += 30;

        // Detalhes do simulador
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);

        // Obter anos do cronograma
        let anoInicial = '2026';
        let anoFinal = '2033';

        if (data && data.parametrosSimulacao) {
            if (data.parametrosSimulacao.dataInicial) {
                anoInicial = data.parametrosSimulacao.dataInicial.split('-')[0] || '2026';
            }
            if (data.parametrosSimulacao.dataFinal) {
                anoFinal = data.parametrosSimulacao.dataFinal.split('-')[0] || '2033';
            }
        }

        const detailText = `Simulação para o período ${anoInicial} - ${anoFinal}`;
        doc.text(detailText, pageWidth / 2, currentY, { align: 'center' });

        // Rodapé da capa
        const footerY = pageHeight - margins.bottom - 10;
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);

        doc.text('© 2025 Expertzy Inteligência Tributária', pageWidth / 2, footerY, { align: 'center' });
        doc.text('Confidencial - Uso Interno', pageWidth / 2, footerY + 5, { align: 'center' });

        return doc;
    }
    
    /**
     * Formatar texto com capitalização adequada
     * @private
     * @param {string} texto - Texto a ser formatado
     * @returns {string} Texto formatado
     */
    _formatarTexto(texto) {
        if (!texto || typeof texto !== 'string') {
            return '';
        }
        return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
    }

    _addIndex(doc, pageNumber) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top;

        // Título
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('Índice', pageWidth / 2, currentY, { align: 'center' });
        currentY += 20;

        // Itens do índice
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(60, 60, 60);

        const indiceItems = [
            { texto: '1. Parâmetros da Simulação', pagina: 3 },
            { texto: '2. Resultados da Simulação', pagina: 4 },
            { texto: '3. Análise Gráfica', pagina: 5 },
            { texto: '4. Estratégias de Mitigação', pagina: 6 },
            { texto: '5. Memória de Cálculo', pagina: 7 },
            { texto: '6. Conclusão e Recomendações', pagina: 8 }
        ];

        indiceItems.forEach(item => {
            // Texto do item
            doc.text(item.texto, margins.left + 5, currentY);
            
            // Pontilhado
            const startX = doc.getStringUnitWidth(item.texto) * doc.internal.getFontSize() / doc.internal.scaleFactor + margins.left + 10;
            const endX = pageWidth - margins.right - 15;
            this._drawDottedLine(doc, startX, currentY - 2, endX, currentY - 2);
            
            // Número da página
            doc.text(item.pagina.toString(), pageWidth - margins.right - 10, currentY, { align: 'right' });
            
            currentY += 12;
        });

        return currentY;
    }

    _addSimulationParameters(doc, data, pageNumber) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top;

        // Título
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('1. Parâmetros da Simulação', margins.left, currentY);
        currentY += 15;

        // Linha separadora
        doc.setDrawColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.line(margins.left, currentY, pageWidth - margins.right, currentY);
        currentY += 10;

        // Formatadores usando DataManager - CORREÇÃO PRINCIPAL
        const formatCurrency = (valor) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarMoeda === 'function') {
                return window.DataManager.formatarMoeda(valor);
            }
            // Fallback para ExportManager
            const exportManager = new ExportManager();
            return exportManager.formatCurrency(valor);
        };

        const formatPercentage = (valor) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarPercentual === 'function') {
                return window.DataManager.formatarPercentual(valor * 100);
            }
            // Fallback para ExportManager
            const exportManager = new ExportManager();
            return exportManager.formatPercentage(valor * 100);
        };

        const formatDateSimple = (data) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarData === 'function') {
                return window.DataManager.formatarData(data);
            }
            // Fallback para ExportManager
            const exportManager = new ExportManager();
            return exportManager.formatDateSimple(data);
        };

        // Seção 1.1 - Dados da Empresa
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text('1.1. Dados da Empresa', margins.left, currentY);
        currentY += 10;

        // Obter dados da empresa de forma robusta usando DataManager
        let dadosEmpresa = {};
        if (data && data.empresa) {
            dadosEmpresa = data.empresa;
        } else if (window.DataManager) {
            const dadosFormulario = window.DataManager.obterDadosDoFormulario();
            if (dadosFormulario && dadosFormulario.empresa) {
                dadosEmpresa = dadosFormulario.empresa;
            }
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);

        // Nome da empresa
        let nomeEmpresa = 'Empresa não identificada';
        if (dadosEmpresa.nome && dadosEmpresa.nome.trim() !== '') {
            nomeEmpresa = dadosEmpresa.nome.trim();
        } else {
            const campoEmpresa = document.getElementById('empresa');
            if (campoEmpresa && campoEmpresa.value && campoEmpresa.value.trim() !== '') {
                nomeEmpresa = campoEmpresa.value.trim();
            }
        }

        // Setor
        let setor = 'Setor não especificado';
        if (dadosEmpresa.setor) {
            if (window.SetoresRepository && typeof window.SetoresRepository.obterSetor === 'function') {
                const setorObj = window.SetoresRepository.obterSetor(dadosEmpresa.setor);
                if (setorObj && setorObj.nome) {
                    setor = setorObj.nome;
                } else {
                    setor = this._formatarTexto(dadosEmpresa.setor);
                }
            } else {
                setor = this._formatarTexto(dadosEmpresa.setor);
            }
        }

        // Regime tributário
        const regimeMap = {
            'real': 'Lucro Real',
            'presumido': 'Lucro Presumido',
            'simples': 'Simples Nacional',
            'mei': 'Microempreendedor Individual'
        };
        let regimeTributario = 'Regime não especificado';
        if (dadosEmpresa.regime) {
            regimeTributario = regimeMap[dadosEmpresa.regime] || this._formatarTexto(dadosEmpresa.regime);
        }

        // Faturamento e margem
        const faturamento = typeof dadosEmpresa.faturamento === 'number' ? formatCurrency(dadosEmpresa.faturamento) : 'Não informado';
        const margem = typeof dadosEmpresa.margem === 'number' ? formatPercentage(dadosEmpresa.margem) : 'Não informado';

        const dadosEmpresaArray = [
            { label: "Empresa:", valor: nomeEmpresa },
            { label: "Setor:", valor: setor },
            { label: "Regime Tributário:", valor: regimeTributario },
            { label: "Faturamento Mensal:", valor: faturamento },
            { label: "Margem Operacional:", valor: margem }
        ];

        dadosEmpresaArray.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(item.label, margins.left, currentY);
            doc.setFont("helvetica", "normal");
            doc.text(item.valor, margins.left + 50, currentY);
            currentY += 8;
        });

        currentY += 10;

        // Seção 1.2 - Sistema Tributário Atual
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text('1.2. Sistema Tributário Atual', margins.left, currentY);
        currentY += 10;

        // Obter dados fiscais atuais
        let parametrosFiscais = {};
        if (data && data.parametrosFiscais) {
            parametrosFiscais = data.parametrosFiscais;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);

        const aliquotaAtual = typeof parametrosFiscais.aliquota === 'number' ? 
            formatPercentage(parametrosFiscais.aliquota) : 'Não informado';

        const tipoOperacao = parametrosFiscais.tipoOperacao || 'Não especificado';
        const regimePisCofins = parametrosFiscais.regimePisCofins || 'Não especificado';

        // Calcular créditos totais
        let creditosTotais = 0;
        if (parametrosFiscais.creditos) {
            const creditos = parametrosFiscais.creditos;
            creditosTotais = Object.values(creditos).reduce((total, valor) => {
                return total + (typeof valor === 'number' ? valor : 0);
            }, 0);
        }

        const dadosTributacaoAtual = [
            { label: "Alíquota Efetiva Atual:", valor: aliquotaAtual },
            { label: "Regime PIS/COFINS:", valor: regimePisCofins },
            { label: "Tipo de Operação:", valor: tipoOperacao },
            { label: "Créditos Tributários:", valor: formatCurrency(creditosTotais) }
        ];

        dadosTributacaoAtual.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(item.label, margins.left, currentY);
            doc.setFont("helvetica", "normal");
            doc.text(item.valor, margins.left + 70, currentY);
            currentY += 8;
        });

        currentY += 10;

        // Seção 1.3 - Sistema IVA Dual e Split Payment
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text('1.3. Sistema IVA Dual e Split Payment', margins.left, currentY);
        currentY += 10;

        // Obter configurações IVA
        let ivaConfig = {};
        if (data && data.ivaConfig) {
            ivaConfig = data.ivaConfig;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);

        const aliquotaCBS = typeof ivaConfig.cbs === 'number' ? formatPercentage(ivaConfig.cbs) : '8,80%';
        const aliquotaIBS = typeof ivaConfig.ibs === 'number' ? formatPercentage(ivaConfig.ibs) : '17,70%';
        const reducaoEspecial = typeof ivaConfig.reducaoEspecial === 'number' ? formatPercentage(ivaConfig.reducaoEspecial) : '0,00%';
        const categoriaIva = ivaConfig.categoriaIva || 'standard';

        const dadosIVA = [
            { label: "Alíquota CBS:", valor: aliquotaCBS },
            { label: "Alíquota IBS:", valor: aliquotaIBS },
            { label: "Categoria IVA:", valor: this._formatarTexto(categoriaIva) },
            { label: "Redução Especial:", valor: reducaoEspecial },
            { label: "Split Payment:", valor: "Ativado" }
        ];

        dadosIVA.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(item.label, margins.left, currentY);
            doc.setFont("helvetica", "normal");
            doc.text(item.valor, margins.left + 70, currentY);
            currentY += 8;
        });

        currentY += 10;

        // Seção 1.4 - Ciclo Financeiro
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text('1.4. Ciclo Financeiro', margins.left, currentY);
        currentY += 10;

        // Dados ciclo financeiro
        const pmr = typeof data?.cicloFinanceiro?.pmr === 'number' ? data.cicloFinanceiro.pmr + ' dias' : 'N/A';
        const pmp = typeof data?.cicloFinanceiro?.pmp === 'number' ? data.cicloFinanceiro.pmp + ' dias' : 'N/A';
        const pme = typeof data?.cicloFinanceiro?.pme === 'number' ? data.cicloFinanceiro.pme + ' dias' : 'N/A';

        // Calcular ciclo financeiro
        let cicloFinanceiro = 'N/A';
        if (typeof data?.cicloFinanceiro?.pmr === 'number' && 
            typeof data?.cicloFinanceiro?.pmp === 'number' && 
            typeof data?.cicloFinanceiro?.pme === 'number') {
            cicloFinanceiro = (data.cicloFinanceiro.pmr + data.cicloFinanceiro.pme - data.cicloFinanceiro.pmp) + ' dias';
        }

        // Percentuais com validação
        const percVista = typeof data?.cicloFinanceiro?.percVista === 'number' ? 
            formatPercentage(data.cicloFinanceiro.percVista) : 'N/A';

        const percPrazo = typeof data?.cicloFinanceiro?.percPrazo === 'number' ? 
            formatPercentage(data.cicloFinanceiro.percPrazo) : 'N/A';

        const dadosCiclo = [
            { label: "Prazo Médio de Recebimento:", valor: pmr },
            { label: "Prazo Médio de Pagamento:", valor: pmp },
            { label: "Prazo Médio de Estoque:", valor: pme },
            { label: "Ciclo Financeiro:", valor: cicloFinanceiro },
            { label: "Vendas à Vista:", valor: percVista },
            { label: "Vendas a Prazo:", valor: percPrazo }
        ];

        dadosCiclo.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(item.label, margins.left, currentY);
            doc.setFont("helvetica", "normal");
            doc.text(item.valor, margins.left + 70, currentY);
            currentY += 8;
        });

        currentY += 10;

        // Seção 1.5 - Parâmetros da Simulação
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text('1.5. Parâmetros da Simulação', margins.left, currentY);
        currentY += 10;

        // Dados da simulação
        const dataInicial = data?.parametrosSimulacao?.dataInicial ? 
            formatDateSimple(new Date(data.parametrosSimulacao.dataInicial)) : 'N/A';

        const dataFinal = data?.parametrosSimulacao?.dataFinal ? 
            formatDateSimple(new Date(data.parametrosSimulacao.dataFinal)) : 'N/A';

        const cenario = data?.parametrosSimulacao?.cenario || 'N/A';

        const taxaCrescimento = typeof data?.parametrosSimulacao?.taxaCrescimento === 'number' ? 
            formatPercentage(data.parametrosSimulacao.taxaCrescimento) + ' a.a.' : 'N/A';

        const parametrosSimulacao = [
            { label: "Data Inicial:", valor: dataInicial },
            { label: "Data Final:", valor: dataFinal },
            { label: "Cenário de Crescimento:", valor: cenario },
            { label: "Taxa de Crescimento:", valor: taxaCrescimento }
        ];

        parametrosSimulacao.forEach(item => {
            doc.setFont("helvetica", "bold");
            doc.text(item.label, margins.left, currentY);
            doc.setFont("helvetica", "normal");
            doc.text(item.valor, margins.left + 60, currentY);
            currentY += 8;
        });

        return currentY;
    }

    _addRobustSimulationResults(doc, simulation, exportResults, pageNumber) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top + 10;

        // Título da seção
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('2. Resultados da Simulação', margins.left, currentY);
        currentY += 15;

        // Formatadores
        const formatCurrency = (valor) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarMoeda === 'function') {
                return window.DataManager.formatarMoeda(valor);
            }
            return new ExportManager().formatCurrency(valor);
        };

        const formatPercentage = (valor) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarPercentual === 'function') {
                return window.DataManager.formatarPercentual(valor);
            }
            if (valor === undefined || valor === null || isNaN(parseFloat(valor))) {
                return "0,00%";
            }
            return `${Math.abs(parseFloat(valor)).toFixed(2)}%`;
        };

        // Verificar se temos dados suficientes
        if (simulation && simulation.projecaoTemporal && simulation.projecaoTemporal.resultadosAnuais) {
            // Seção 2.1 - Tabela de Resultados dos Três Sistemas
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(70, 70, 70);
            doc.text('2.1. Comparação dos Três Sistemas Tributários', margins.left, currentY);
            currentY += 10;

            // Cabeçalho da tabela expandido para três sistemas
            const headers = [
                "Ano",
                "Sistema Atual (R$)",
                "IVA sem Split (R$)",
                "IVA com Split (R$)",
                "Diferença vs Atual (R$)",
                "Impacto (%)"
            ];

            // Obter anos
            const resultadosAnuais = simulation.projecaoTemporal.resultadosAnuais;
            const anos = Object.keys(resultadosAnuais).sort();

            // Preparar dados para a tabela
            const tableData = [];
            tableData.push(headers);

            // Dados por ano considerando os três sistemas
            anos.forEach(ano => {
                const dadosAno = resultadosAnuais[ano];

                // Capital de giro disponível em cada sistema
                const capitalGiroAtual = dadosAno.resultadoAtual?.capitalGiroDisponivel || 0;
                const capitalGiroIVASemSplit = dadosAno.resultadoIVASemSplit?.capitalGiroDisponivel || capitalGiroAtual;
                const capitalGiroSplitPayment = dadosAno.resultadoSplitPayment?.capitalGiroDisponivel || 0;

                // Diferença principal (IVA com Split vs Sistema Atual)
                const diferenca = capitalGiroSplitPayment - capitalGiroAtual;
                const percentualImpacto = capitalGiroAtual !== 0 ? (diferenca / capitalGiroAtual) * 100 : 0;

                tableData.push([
                    ano,
                    formatCurrency(capitalGiroAtual),
                    formatCurrency(capitalGiroIVASemSplit),
                    formatCurrency(capitalGiroSplitPayment),
                    formatCurrency(diferenca),
                    formatPercentage(percentualImpacto)
                ]);
            });

            // Adicionar tabela com cores condicionais
            doc.autoTable({
                startY: currentY,
                head: [tableData[0]],
                body: tableData.slice(1),
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: this.config.pdf.colors.primary,
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 9
                },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    1: { cellWidth: 35, halign: 'right' },
                    2: { cellWidth: 35, halign: 'right' },
                    3: { cellWidth: 35, halign: 'right' },
                    4: { cellWidth: 35, halign: 'right' },
                    5: { cellWidth: 25, halign: 'right' }
                },
                // Colorir células com base nos valores
                didDrawCell: function(data) {
                    if (data.section === 'body') {
                        // Colorir coluna de diferença e impacto
                        if (data.column.index === 4 || data.column.index === 5) {
                            let valorStr = data.cell.text[0];
                            let valor = 0;

                            if (data.column.index === 4) {
                                // Coluna Diferença
                                valor = parseFloat(valorStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim());
                            } else {
                                // Coluna Impacto
                                valor = parseFloat(valorStr.replace('%', '').replace(',', '.').trim());
                            }

                            if (valor > 0) {
                                // Impacto negativo (aumento de necessidade) - vermelho claro
                                doc.setFillColor(231, 76, 60, 0.2);
                                doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                            } else if (valor < 0) {
                                // Impacto positivo (redução de necessidade) - verde claro
                                doc.setFillColor(46, 204, 113, 0.2);
                                doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                            }
                        }
                    }
                },
                margin: { left: margins.left }
            });

            currentY = doc.lastAutoTable.finalY + 15;

            // Seção 2.2 - Análise Comparativa dos Três Sistemas
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(70, 70, 70);
            doc.text('2.2. Análise Comparativa dos Sistemas', margins.left, currentY);
            currentY += 10;

            // Calcular estatísticas comparativas
            let impactoTotalAtualVsSplit = 0;
            let impactoTotalAtualVsIVASemSplit = 0;
            let anoMaiorImpacto = "";
            let valorMaiorImpacto = 0;

            anos.forEach(ano => {
                const dadosAno = resultadosAnuais[ano];
                const capitalGiroAtual = dadosAno.resultadoAtual?.capitalGiroDisponivel || 0;
                const capitalGiroIVASemSplit = dadosAno.resultadoIVASemSplit?.capitalGiroDisponivel || capitalGiroAtual;
                const capitalGiroSplitPayment = dadosAno.resultadoSplitPayment?.capitalGiroDisponivel || 0;

                const diferencaAtualVsSplit = capitalGiroSplitPayment - capitalGiroAtual;
                const diferencaAtualVsIVASemSplit = capitalGiroIVASemSplit - capitalGiroAtual;

                impactoTotalAtualVsSplit += diferencaAtualVsSplit;
                impactoTotalAtualVsIVASemSplit += diferencaAtualVsIVASemSplit;

                if (Math.abs(diferencaAtualVsSplit) > Math.abs(valorMaiorImpacto)) {
                    valorMaiorImpacto = diferencaAtualVsSplit;
                    anoMaiorImpacto = ano;
                }
            });

            // Texto de análise
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 60);

            const isSplitPositivo = impactoTotalAtualVsSplit < 0;
            const isIVASemSplitPositivo = impactoTotalAtualVsIVASemSplit < 0;

            let analiseTexto = `A análise comparativa dos três sistemas tributários revela que:

    1. Sistema IVA sem Split Payment: ${isIVASemSplitPositivo ? 'redução' : 'aumento'} acumulado de ${formatCurrency(Math.abs(impactoTotalAtualVsIVASemSplit))} na necessidade de capital de giro em relação ao sistema atual.

    2. Sistema IVA com Split Payment: ${isSplitPositivo ? 'redução' : 'aumento'} acumulado de ${formatCurrency(Math.abs(impactoTotalAtualVsSplit))} na necessidade de capital de giro em relação ao sistema atual.

    3. O ano de ${anoMaiorImpacto} apresenta o maior impacto do Split Payment (${formatCurrency(valorMaiorImpacto)}), representando um ponto crítico na transição.

    4. A diferença entre os sistemas IVA (com e sem Split) é de ${formatCurrency(Math.abs(impactoTotalAtualVsSplit - impactoTotalAtualVsIVASemSplit))}, demonstrando o impacto específico do mecanismo de Split Payment.`;

            const splitAnalise = doc.splitTextToSize(analiseTexto, pageWidth - margins.left - margins.right);
            doc.text(splitAnalise, margins.left, currentY);
            currentY += splitAnalise.length * 5 + 15;

        } else {
            // Mensagem quando não há dados suficientes
            doc.setFont("helvetica", "italic");
            doc.setFontSize(12);
            doc.setTextColor(231, 76, 60);
            doc.text("Dados de resultados não disponíveis ou em formato incompatível.", margins.left, currentY);
            currentY += 10;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text("Realize uma nova simulação para gerar o relatório completo.", margins.left, currentY);
            currentY += 20;
        }

        return currentY;
    }

    _addRobustCharts(doc, pageNumber) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top + 10;

        // Adicionar cabeçalho da seção
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('3. Análise Gráfica', margins.left, currentY);
        currentY += 15;

        // Capturar e adicionar gráficos da simulação
        try {
            // Lista de gráficos para capturar
            const graficos = [
                {
                    id: 'grafico-fluxo-caixa',
                    titulo: '3.1. Fluxo de Caixa Comparativo',
                    descricao: 'Este gráfico apresenta a comparação do fluxo de caixa entre o sistema atual e o Split Payment, permitindo visualizar o impacto financeiro ao longo do período de transição.'
                },
                {
                    id: 'grafico-capital-giro',
                    titulo: '3.2. Impacto no Capital de Giro',
                    descricao: 'Este gráfico mostra a variação na necessidade de capital de giro, indicando os períodos de maior pressão sobre o fluxo financeiro da empresa.'
                },
                {
                    id: 'grafico-projecao',
                    titulo: '3.3. Projeção de Necessidade de Capital',
                    descricao: 'Este gráfico apresenta a projeção das necessidades adicionais de capital durante o período de transição do Split Payment.'
                },
                {
                    id: 'grafico-decomposicao',
                    titulo: '3.4. Decomposição do Impacto',
                    descricao: 'Este gráfico decompõe os diferentes fatores que contribuem para o impacto total, permitindo identificar os principais componentes do efeito no fluxo de caixa.'
                }
            ];

            // Verificar se existem gráficos no DOM
            const graficoExiste = graficos.some(g => document.getElementById(g.id));

            if (!graficoExiste) {
                // Se não houver gráficos, exibir mensagem
                doc.setFont("helvetica", "italic");
                doc.setFontSize(12);
                doc.text("Não foram encontrados gráficos para incluir no relatório.", margins.left, currentY);
                currentY += 10;
                
                doc.setFont("helvetica", "normal");
                doc.setFontSize(11);
                doc.text("Certifique-se de que a simulação foi realizada e os gráficos foram gerados.", margins.left, currentY);
                currentY += 20;
                
                return currentY;
            }

            // Adicionar cada gráfico
            for (let i = 0; i < graficos.length; i++) {
                const grafico = graficos[i];
                const graficoElement = document.getElementById(grafico.id);
                
                if (graficoElement) {
                    // Adicionar título do gráfico
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(14);
                    doc.setTextColor(70, 70, 70);
                    doc.text(grafico.titulo, margins.left, currentY);
                    currentY += 8;
                    
                    // Capturar imagem do gráfico
                    const imgData = graficoElement.toDataURL('image/png');
                    
                    // Definir dimensões para o gráfico
                    const imgWidth = pageWidth - margins.left - margins.right;
                    const imgHeight = 80;
                    
                    // Adicionar imagem do gráfico
                    doc.addImage(imgData, 'PNG', margins.left, currentY, imgWidth, imgHeight);
                    currentY += imgHeight + 5;
                    
                    // Adicionar descrição do gráfico
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(80, 80, 80);
                    
                    const splitDesc = doc.splitTextToSize(grafico.descricao, pageWidth - margins.left - margins.right);
                    doc.text(splitDesc, margins.left, currentY);
                    currentY += splitDesc.length * 4 + 15;
                    
                    // Verificar se precisa adicionar nova página
                    if (i < graficos.length - 1 && currentY > doc.internal.pageSize.height - margins.bottom - 100) {
                        doc.addPage();
                        pageNumber++;
                        currentY = margins.top + 10;
                    }
                }
            }

            // Adicionar quadro com insights
            const boxWidth = pageWidth - margins.left - margins.right;
            const boxHeight = 50;
            const boxX = margins.left;
            const boxY = currentY;

            // Desenhar fundo do box com gradiente suave
            this._drawGradient(doc, boxX, boxY, boxX + boxWidth, boxY + boxHeight,
                [245, 245, 245], [235, 235, 235]);

            // Adicionar borda
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.rect(boxX, boxY, boxWidth, boxHeight);

            // Título do box
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
            doc.text('Insights da Análise Gráfica:', boxX + 5, boxY + 10);

            // Conteúdo do box
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);

            const insights = [
                `• Os gráficos demonstram claramente a progressão do impacto durante o período de transição.`,
                `• As maiores variações tendem a ocorrer nos anos intermediários (2029-2031).`,
                `• A alíquota efetiva se estabiliza ao final do período, indicando o novo patamar tributário.`,
                `• Os incentivos fiscais continuam tendo um papel relevante mesmo no novo sistema.`
            ].join('\n');

            doc.text(insights, boxX + 5, boxY + 18);
            currentY += boxHeight + 15;
        } catch (e) {
            console.warn('Erro ao adicionar gráficos:', e);
            
            // Adicionar mensagem de erro
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(231, 76, 60);
            doc.text('Não foi possível capturar os gráficos. Por favor, verifique se os gráficos foram gerados corretamente na simulação.', 
                     margins.left, currentY);
            currentY += 10;
        }

        return currentY;
    }

    _addRobustStrategyAnalysis(doc, data, simulation, pageNumber) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top + 10;

        // Adicionar cabeçalho da seção
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('4. Estratégias de Mitigação', margins.left, currentY);
        currentY += 15;

        // Verificar se há dados de estratégias de forma robusta
        let resultadosEstrategias = null;

        // Tentar múltiplas fontes para os dados de estratégias
        if (window.resultadosEstrategias) {
            resultadosEstrategias = window.resultadosEstrategias;
        } else if (window.lastStrategyResults) {
            resultadosEstrategias = window.lastStrategyResults;
        } else if (simulation && simulation.estrategias) {
            resultadosEstrategias = simulation.estrategias;
        }

        if (!resultadosEstrategias) {
            // Tentar verificar se há estratégias na interface
            const divResultadosEstrategias = document.getElementById('resultados-estrategias');
            const hasStrategyResults = divResultadosEstrategias && 
                                      divResultadosEstrategias.querySelector('.estrategias-resumo');

            if (!hasStrategyResults) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(12);
                doc.setTextColor(100, 100, 100);
                doc.text(
                    "Não há dados de estratégias disponíveis.",
                    margins.left,
                    currentY
                );
                currentY += 8;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.text(
                    "Para incluir a análise de estratégias no relatório, acesse a aba 'Estratégias de Mitigação',",
                    margins.left,
                    currentY
                );
                currentY += 6;
                doc.text(
                    "configure as estratégias desejadas e execute a simulação antes de exportar o relatório.",
                    margins.left,
                    currentY
                );
                currentY += 20;

                return currentY;
            }
        }

        // Texto introdutório
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        
        const introTexto = [
            "A implementação do Split Payment pode impactar significativamente o fluxo de caixa das empresas, ",
            "especialmente durante o período de transição. Para mitigar esses efeitos, apresentamos um conjunto de ",
            "estratégias que podem ser adotadas, adaptadas às características específicas do negócio."
        ].join('');
        
        const splitIntro = doc.splitTextToSize(introTexto, pageWidth - margins.left - margins.right);
        doc.text(splitIntro, margins.left, currentY);
        currentY += splitIntro.length * 5 + 10;

        // Formatadores
        const manager = new ExportManager();
        const formatCurrency = manager.formatCurrency.bind(manager);

        const formatPercentage = (valor) => {
            if (valor === undefined || valor === null) {
                return "0,00%";
            }
            return (parseFloat(valor) || 0).toFixed(2) + "%";
        };

        // Impacto original
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text("Impacto Original do Split Payment", margins.left, currentY);
        currentY += 10;

        // Mostrar impacto original
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        const impacto = resultadosEstrategias.impactoBase || {};
        const linhasImpacto = [
            `Diferença no Capital de Giro: ${formatCurrency(impacto.diferencaCapitalGiro || 0)}`,
            `Impacto Percentual: ${formatPercentage((impacto.percentualImpacto || 0) / 100)}`,
            `Necessidade Adicional: ${formatCurrency(impacto.necessidadeAdicionalCapitalGiro || 0)}`
        ];
        
        linhasImpacto.forEach((linha) => {
            doc.text(linha, margins.left, currentY);
            currentY += 8;
        });
        
        currentY += 5;

        // Estratégias analisadas - LISTA COMPLETA
        const estrategias = [
            {
                codigo: "ajustePrecos",
                titulo: "4.1. Ajuste de Preços",
                descricao: "Revisão da política de preços para compensar a perda de fluxo de caixa, considerando a elasticidade-preço da demanda do mercado e a posição competitiva da empresa.",
                impacto: "Alto",
                complexidade: "Média",
                eficacia: "75%"
            },
            {
                codigo: "renegociacaoPrazos",
                titulo: "4.2. Renegociação de Prazos",
                descricao: "Renegociação dos prazos de pagamento com fornecedores e de recebimento com clientes, visando equilibrar o ciclo financeiro e compensar a perda de capital de giro.",
                impacto: "Médio",
                complexidade: "Alta",
                eficacia: "60%"
            },
            {
                codigo: "antecipacaoRecebiveis",
                titulo: "4.3. Antecipação de Recebíveis",
                descricao: "Utilização de mecanismos de antecipação de recebíveis para converter vendas a prazo em recursos imediatos, considerando o custo financeiro versus o benefício do fluxo de caixa.",
                impacto: "Alto",
                complexidade: "Baixa",
                eficacia: "80%"
            },
            {
                codigo: "capitalGiro",
                titulo: "4.4. Captação de Capital de Giro",
                descricao: "Obtenção de linhas de crédito específicas para capital de giro, preferencialmente com carência alinhada ao período de transição do Split Payment.",
                impacto: "Alto",
                complexidade: "Média",
                eficacia: "85%"
            },
            {
                codigo: "mixProdutos",
                titulo: "4.5. Ajuste no Mix de Produtos",
                descricao: "Reequilíbrio do mix de produtos e serviços, priorizando itens com ciclo financeiro mais favorável e maior margem para absorver o impacto do Split Payment.",
                impacto: "Médio",
                complexidade: "Alta",
                eficacia: "65%"
            },
            {
                codigo: "meiosPagamento",
                titulo: "4.6. Incentivo a Meios de Pagamento Favoráveis",
                descricao: "Estímulo a modalidades de pagamento que reduzam o prazo médio de recebimento, como pagamentos à vista ou via PIX, oferecendo descontos ou vantagens exclusivas.",
                impacto: "Médio",
                complexidade: "Baixa",
                eficacia: "70%"
            }
        ];

        // Resultados das estratégias
        const strategyDetailsMap = resultadosEstrategias.resultadosEstrategias || {};

        // Adicionar cada estratégia
        estrategias.forEach((estrategia, index) => {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
            doc.text(estrategia.titulo, margins.left, currentY);
            currentY += 8;
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            const splitDesc = doc.splitTextToSize(estrategia.descricao, pageWidth - margins.left - margins.right);
            doc.text(splitDesc, margins.left, currentY);
            currentY += splitDesc.length * 5 + 5;

            // Obter dados da estratégia
            const dadosEstrategia = strategyDetailsMap[estrategia.codigo];
            
            if (dadosEstrategia) {
                // Exibir efetividade
                doc.setFont("helvetica", "bold");
                doc.text(
                    `Efetividade: ${formatPercentage((dadosEstrategia.efetividadePercentual || 0) / 100)}`,
                    margins.left + 10,
                    currentY
                );
                currentY += 8;
                
                // Exibir detalhes específicos de cada estratégia
                switch (estrategia.codigo) {
                    case "ajustePrecos":
                        doc.text(
                            `Fluxo de Caixa Adicional: ${formatCurrency(dadosEstrategia.fluxoCaixaAdicional || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        currentY += 8;
                        doc.text(
                            `Custo da Estratégia: ${formatCurrency(dadosEstrategia.custoEstrategia || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        break;
                        
                    case "renegociacaoPrazos":
                        doc.text(
                            `Impacto no Fluxo de Caixa: ${formatCurrency(dadosEstrategia.impactoFluxoCaixa || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        currentY += 8;
                        doc.text(
                            `Custo Total: ${formatCurrency(dadosEstrategia.custoTotal || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        break;
                        
                    case "antecipacaoRecebiveis":
                        doc.text(
                            `Impacto no Fluxo de Caixa: ${formatCurrency(dadosEstrategia.impactoFluxoCaixa || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        currentY += 8;
                        doc.text(
                            `Custo Total: ${formatCurrency(dadosEstrategia.custoTotalAntecipacao || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        break;
                        
                    case "capitalGiro":
                        doc.text(
                            `Valor Financiado: ${formatCurrency(dadosEstrategia.valorFinanciamento || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        currentY += 8;
                        doc.text(
                            `Custo Total: ${formatCurrency(dadosEstrategia.custoTotalFinanciamento || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        break;
                        
                    case "mixProdutos":
                        doc.text(
                            `Impacto no Fluxo de Caixa: ${formatCurrency(dadosEstrategia.impactoFluxoCaixa || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        currentY += 8;
                        doc.text(
                            `Custo de Implementação: ${formatCurrency(dadosEstrategia.custoImplementacao || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        break;
                        
                    case "meiosPagamento":
                        doc.text(
                            `Impacto Líquido: ${formatCurrency(dadosEstrategia.impactoLiquido || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        currentY += 8;
                        doc.text(
                            `Custo Total do Incentivo: ${formatCurrency(dadosEstrategia.custoTotalIncentivo || 0)}`,
                            margins.left + 10,
                            currentY
                        );
                        break;
                }
            } else {
                doc.setFont("helvetica", "italic");
                doc.text("Dados não disponíveis para esta estratégia.", margins.left + 10, currentY);
            }
            
            currentY += 15;
            
            // Adicionar nova página se necessário
            if (
                currentY > doc.internal.pageSize.height - margins.bottom - 30 &&
                index < estrategias.length - 1
            ) {
                doc.addPage();
                pageNumber++;
                currentY = margins.top;
            }
        });

        // Resultados combinados
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text("4.7. Resultados Combinados", margins.left, currentY);
        currentY += 10;
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        // Obter dados da combinação
        const combinado = resultadosEstrategias.efeitividadeCombinada || {};
        const linhasCombinado = [
            `Efetividade Total: ${formatPercentage((combinado.efetividadePercentual || 0) / 100)}`,
            `Mitigação Total: ${formatCurrency(combinado.mitigacaoTotal || 0)}`,
            `Custo Total das Estratégias: ${formatCurrency(combinado.custoTotal || 0)}`,
            `Relação Custo-Benefício: ${(combinado.custoBeneficio || 0).toFixed(2)}`
        ];
        
        linhasCombinado.forEach((linha) => {
            doc.text(linha, margins.left, currentY);
            currentY += 8;
        });

        // Adicionar plano de ação
        currentY += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text("4.8. Plano de Ação Recomendado", margins.left, currentY);
        currentY += 10;

        // Plano de ação simplificado
        const planoAcao = [
            ['Fase', 'Ação', 'Prazo Recomendado'],
            ['Preparação', 'Análise detalhada do fluxo de caixa atual', '6 meses antes da implementação'],
            ['Implementação Inicial', 'Ajuste gradual de preços e negociação com clientes', '3 meses antes da implementação'],
            ['Monitoramento', 'Acompanhamento dos indicadores de ciclo financeiro', 'Durante todo o período de transição'],
            ['Ajuste Contínuo', 'Refinamento das estratégias conforme resultados', 'Anualmente durante a transição']
        ];

        // Adicionar tabela do plano de ação
        doc.autoTable({
            startY: currentY,
            head: [planoAcao[0]],
            body: planoAcao.slice(1),
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            headStyles: {
                fillColor: this.config.pdf.colors.primary,
                textColor: 255,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 80 },
                2: { cellWidth: 50 }
            },
            margin: { left: margins.left }
        });

        currentY = doc.lastAutoTable.finalY + 10;
        return currentY;
    }

    _addMemoryCalculation(doc, getMemoryCalculation, pageNumber) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top + 10;

        // Adicionar cabeçalho da seção
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('5. Memória de Cálculo', margins.left, currentY);
        currentY += 15;

        // Texto introdutório
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        const introTexto = [
            "Esta seção apresenta os detalhes dos cálculos realizados na simulação, permitindo a verificação ",
            "e auditoria dos resultados. A memória de cálculo inclui todas as etapas do processo, desde a aplicação ",
            "das alíquotas até o cálculo final dos impostos para todos os anos simulados."
        ].join('');

        const splitIntro = doc.splitTextToSize(introTexto, pageWidth - margins.left - margins.right);
        doc.text(splitIntro, margins.left, currentY);
        currentY += splitIntro.length * 5 + 10;

        // Obter memória de cálculo de forma robusta
        let memoriaCompleta = {};

        try {
            // Tentar obter de múltiplas fontes
            if (window.memoriaCalculoSimulacao) {
                memoriaCompleta = window.memoriaCalculoSimulacao;
            } else if (typeof getMemoryCalculation === "function") {
                // Tentar usar a função fornecida
                const memoria = getMemoryCalculation();
                if (memoria && typeof memoria === 'object') {
                    memoriaCompleta = memoria;
                }
            } else if (window.resultadosSimulacao && window.resultadosSimulacao.memoriaCalculo) {
                // Tentar obter dos resultados da simulação
                memoriaCompleta = window.resultadosSimulacao.memoriaCalculo;
            }

            // Se ainda não temos memória, tentar gerar uma básica
            if (Object.keys(memoriaCompleta).length === 0 && window.resultadosSimulacao) {
                memoriaCompleta = this._gerarMemoriaBasica(window.resultadosSimulacao);
            }

        } catch (error) {
            console.error("Erro ao obter memória de cálculo:", error);
        }

        if (Object.keys(memoriaCompleta).length > 0) {
            // Processar memória por ano ou seção
            const anos = Object.keys(memoriaCompleta).filter(key => /^\d{4}$/.test(key)).sort();

            if (anos.length > 0) {
                // Memória organizada por ano
                anos.slice(0, 3).forEach((ano, index) => { // Limitar a 3 anos para não sobrecarregar
                    const memoriaAno = memoriaCompleta[ano];

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(12);
                    doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
                    doc.text(`5.${index + 1}. Memória de Cálculo - Ano ${ano}`, margins.left, currentY);
                    currentY += 8;

                    // Processar conteúdo da memória
                    if (typeof memoriaAno === 'string') {
                        currentY = this._processarMemoriaTexto(doc, memoriaAno, currentY, margins, pageWidth);
                    } else if (typeof memoriaAno === 'object') {
                        currentY = this._processarMemoriaEstruturada(doc, memoriaAno, currentY, margins, pageWidth);
                    }

                    currentY += 10;

                    // Verificar se precisa de nova página
                    if (currentY > doc.internal.pageSize.height - margins.bottom - 50) {
                        doc.addPage();
                        currentY = margins.top + 10;
                    }
                });

                if (anos.length > 3) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(9);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`... memória de cálculo para ${anos.length - 3} anos adicionais disponível via exportação específica.`, 
                             margins.left, currentY);
                    currentY += 15;
                }

            } else {
                // Memória não organizada por ano
                currentY = this._processarMemoriaEstruturada(doc, memoriaCompleta, currentY, margins, pageWidth);
            }

            // Adicionar nota sobre exportação completa
            currentY += 10;
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);

            const notaExportacao = [
                "Nota: Para a memória de cálculo completa e detalhada de todos os anos, recomenda-se utilizar a função ",
                "'Exportar Memória de Cálculo' disponível no simulador, que gera um arquivo de texto contendo todas as ",
                "etapas do cálculo sem truncamento."
            ].join('');

            const splitNota = doc.splitTextToSize(notaExportacao, pageWidth - margins.left - margins.right);
            doc.text(splitNota, margins.left, currentY);
            currentY += splitNota.length * 5;

        } else {
            // Mensagem quando não há memória disponível
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text('Memória de cálculo não disponível. Execute a simulação para gerar os dados detalhados.', 
                    margins.left, currentY);
            currentY += 15;
        }

        return currentY;
    }
    
    /**
     * Processar memória de cálculo em formato de texto
     * @private
     */
    _processarMemoriaTexto(doc, memoriaTexto, currentY, margins, pageWidth) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(30, 30, 30);

        const linhas = memoriaTexto.split('\n').slice(0, 50); // Limitar linhas

        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];

            if (linha.includes('===')) {
                doc.setFont('courier', 'bold');
                doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
            } else {
                doc.setFont('courier', 'normal');
                doc.setTextColor(30, 30, 30);
            }

            if (currentY > doc.internal.pageSize.height - margins.bottom - 10) {
                doc.addPage();
                currentY = margins.top + 10;
            }

            const splitLinha = doc.splitTextToSize(linha, pageWidth - margins.left - margins.right);
            doc.text(splitLinha, margins.left, currentY);
            currentY += splitLinha.length * 3.5;
        }

        return currentY;
    }

    /**
     * Processar memória de cálculo em formato estruturado
     * @private
     */
    _processarMemoriaEstruturada(doc, memoriaObj, currentY, margins, pageWidth) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);

        // Processar estrutura de forma organizada
        if (memoriaObj.dadosEntrada) {
            doc.setFont("helvetica", "bold");
            doc.text("Dados de Entrada:", margins.left, currentY);
            currentY += 6;

            doc.setFont("helvetica", "normal");
            const dadosTexto = JSON.stringify(memoriaObj.dadosEntrada, null, 2);
            const linhasDados = dadosTexto.split('\n').slice(0, 20);

            linhasDados.forEach(linha => {
                if (currentY > doc.internal.pageSize.height - margins.bottom - 10) {
                    doc.addPage();
                    currentY = margins.top + 10;
                }
                doc.text(linha, margins.left + 5, currentY);
                currentY += 4;
            });

            currentY += 5;
        }

        if (memoriaObj.impactoBase) {
            doc.setFont("helvetica", "bold");
            doc.text("Impacto Base:", margins.left, currentY);
            currentY += 6;

            doc.setFont("helvetica", "normal");
            Object.entries(memoriaObj.impactoBase).forEach(([chave, valor]) => {
                if (currentY > doc.internal.pageSize.height - margins.bottom - 10) {
                    doc.addPage();
                    currentY = margins.top + 10;
                }
                doc.text(`${chave}: ${valor}`, margins.left + 5, currentY);
                currentY += 4;
            });
        }

        return currentY;
    }

    /**
     * Gerar memória básica quando não há memória disponível
     * @private
     */
    _gerarMemoriaBasica(resultadosSimulacao) {
        const memoriaBasica = {};

        if (resultadosSimulacao.projecaoTemporal && resultadosSimulacao.projecaoTemporal.resultadosAnuais) {
            const anos = Object.keys(resultadosSimulacao.projecaoTemporal.resultadosAnuais);

            anos.forEach(ano => {
                const dadosAno = resultadosSimulacao.projecaoTemporal.resultadosAnuais[ano];
                memoriaBasica[ano] = `Ano ${ano}:
    Capital Giro Atual: ${dadosAno.resultadoAtual?.capitalGiroDisponivel || 0}
    Capital Giro Split Payment: ${dadosAno.resultadoSplitPayment?.capitalGiroDisponivel || 0}
    Diferença: ${dadosAno.diferencaCapitalGiro || 0}
    Percentual de Impacto: ${dadosAno.percentualImpacto || 0}%`;
            });
        }

        return memoriaBasica;
    }

    _addRobustConclusion(doc, data, simulation, pageNumber, equivalentRates) {
        const margins = this.config.pdf.margins;
        const pageWidth = doc.internal.pageSize.width;
        let currentY = margins.top + 10;

        // Adicionar cabeçalho da seção
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('6. Conclusão e Recomendações', margins.left, currentY);
        currentY += 15;

        // Extrair dados com segurança usando a estrutura canônica
        let empresaNome = data?.empresa?.nome || "a empresa";
        let anoInicial = "";
        let anoFinal = "";
        let variacaoTotal = 0;
        let tendencia = "variação";

        // Obter anos do cronograma
        if (data?.parametrosSimulacao) {
            if (data.parametrosSimulacao.dataInicial) {
                anoInicial = data.parametrosSimulacao.dataInicial.split('-')[0] || '2026';
            }

            if (data.parametrosSimulacao.dataFinal) {
                anoFinal = data.parametrosSimulacao.dataFinal.split('-')[0] || '2033';
            }
        }

        if (!anoInicial) anoInicial = '2026';
        if (!anoFinal) anoFinal = '2033';

        // Obter resultadosExportacao de qualquer localização estruturada
        let resultadosExportacao = null;

        if (simulation) {
            if (simulation.resultadosExportacao) {
                resultadosExportacao = simulation.resultadosExportacao;
            } else if (simulation.resultados && simulation.resultados.resultadosExportacao) {
                resultadosExportacao = simulation.resultados.resultadosExportacao;
            } else if (simulation.projecaoTemporal && simulation.projecaoTemporal.impactoAcumulado) {
                // Usar formato de projeção diretamente
                variacaoTotal = simulation.projecaoTemporal.impactoAcumulado.totalNecessidadeCapitalGiro || 0;
                tendencia = variacaoTotal > 0 ? "aumento" : "redução";
            }
        }

        if (resultadosExportacao) {
            // Usar a estrutura de dados
            const resumo = resultadosExportacao.resumo || {};
            const anos = resultadosExportacao.anos || [];

            if (!anoInicial && anos.length > 0) anoInicial = anos[0];
            if (!anoFinal && anos.length > 0) anoFinal = anos[anos.length - 1];

            variacaoTotal = resumo.variacaoTotal || 0;
            tendencia = resumo.tendenciaGeral || (variacaoTotal > 0 ? "aumento" : "redução");
        } else if (!variacaoTotal && simulation.impactoBase) {
            // Tentar extrair da estrutura do impactoBase
            if (typeof simulation.impactoBase.diferencaCapitalGiro === 'number') {
                // Multipicar por período estimado para ter impacto acumulado
                const anos = parseInt(anoFinal) - parseInt(anoInicial) + 1;
                variacaoTotal = simulation.impactoBase.diferencaCapitalGiro * anos;
            }
            tendencia = variacaoTotal > 0 ? "aumento" : "redução";
        }

        // Formatar números
        const formatCurrency = (valor) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarMoeda === 'function') {
                return window.DataManager.formatarMoeda(valor);
            }
            return new ExportManager().formatCurrency(valor);
        };

        // Texto da conclusão
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        // Introdução da conclusão
        const conclusaoTexto = `A implementação do Split Payment, conforme simulação realizada para ${empresaNome}, 
        resultará em um ${tendencia} estimado de ${formatCurrency(Math.abs(variacaoTotal))} 
        na necessidade de capital de giro durante o período de ${anoInicial} a ${anoFinal}.`;

        // Dividir texto em linhas
        const linhas = doc.splitTextToSize(conclusaoTexto, pageWidth - margins.left - margins.right);
        doc.text(linhas, margins.left, currentY);
        currentY += linhas.length * 7 + 10;

        // Impacto no fluxo de caixa
        const impactoTexto = `O principal impacto identificado está relacionado à antecipação do recolhimento tributário, 
        que no modelo atual ocorre em média 30-45 dias após o faturamento, e no novo modelo ocorrerá de forma instantânea 
        no momento da transação financeira. Esta mudança afeta diretamente o ciclo financeiro da empresa 
        e sua necessidade de capital de giro.`;

        const linhasImpacto = doc.splitTextToSize(
            impactoTexto,
            pageWidth - margins.left - margins.right
        );

        doc.text(linhasImpacto, margins.left, currentY);
        currentY += linhasImpacto.length * 7 + 10;

        // Seção de recomendações
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(this.config.pdf.colors.secondary[0], this.config.pdf.colors.secondary[1], this.config.pdf.colors.secondary[2]);
        doc.text('Recomendações', margins.left, currentY);
        currentY += 10;

        // Lista de recomendações
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        const recomendacoes = [
            `1. Planejamento Financeiro: Recomenda-se iniciar imediatamente o planejamento financeiro 
            para adequação ao novo regime, considerando a implementação gradual do Split Payment a partir de 2026.`,

            `2. Estratégias de Mitigação: Conforme análise apresentada na seção 4, 
            sugere-se a implementação de uma combinação de estratégias para minimizar o impacto no fluxo de caixa.`,

            `3. Sistemas: Realizar a adequação dos sistemas de gestão financeira e contábil para operação 
            com o novo modelo de recolhimento tributário.`,

            `4. Monitoramento Contínuo: Manter acompanhamento constante das alterações na regulamentação 
            do Split Payment, que ainda está em fase de definição pelos órgãos competentes.`
        ];

        recomendacoes.forEach((recomendacao) => {
            const linhasRecomendacao = doc.splitTextToSize(
                recomendacao,
                pageWidth - margins.left - margins.right
            );

            doc.text(linhasRecomendacao, margins.left, currentY);
            currentY += linhasRecomendacao.length * 7 + 5;
        });

        // Quadro final de contato
        currentY += 10;
        const boxWidth = pageWidth - margins.left - margins.right;
        const boxHeight = 40;
        const boxX = margins.left;
        const boxY = currentY;

        // Desenhar gradiente para o quadro
        this._drawGradient(doc, boxX, boxY, boxX + boxWidth, boxY + boxHeight,
            [240, 248, 255], [230, 240, 250]);

        // Adicionar borda
        doc.setDrawColor(180, 200, 220);
        doc.setLineWidth(0.5);
        doc.rect(boxX, boxY, boxWidth, boxHeight);

        // Conteúdo do quadro
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(this.config.pdf.colors.primary[0], this.config.pdf.colors.primary[1], this.config.pdf.colors.primary[2]);
        doc.text('Entre em contato para um diagnóstico personalizado', margins.left + 5, boxY + 15);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        doc.text('Este relatório foi gerado pelo Simulador de Split Payment desenvolvido pela Expertzy Inteligência Tributária.', 
                margins.left + 5, boxY + 25);
        doc.text('Para obter um diagnóstico personalizado e aprofundado, entre em contato: contato@expertzy.com.br', 
                margins.left + 5, boxY + 32);

        currentY += boxHeight + 10;

        return currentY;
    }

    _addHeaderFooter(doc, pageCount) {
        // Percorrer todas as páginas (exceto a capa)
        for (let i = 2; i <= pageCount; i++) {
            doc.setPage(i);
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const margins = this.config.pdf.margins;

            // Cabeçalho
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(margins.left, margins.top - 5, pageWidth - margins.right, margins.top - 5);

            // Logo no cabeçalho (se disponível)
            if (this.config.pdf.logoEnabled) {
                try {
                    const logoImg = document.querySelector('img.logo');
                    if (logoImg && logoImg.complete) {
                        const logoWidth = 25;
                        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
                        doc.addImage(
                            logoImg,
                            'PNG',
                            margins.left,
                            margins.top - 15,
                            logoWidth,
                            logoHeight
                        );
                    }
                } catch (e) {
                    console.warn('Não foi possível adicionar o logo no cabeçalho:', e);
                }
            }

            // Título no cabeçalho
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('Simulador de Split Payment - Relatório', pageWidth - margins.right, margins.top - 8, { align: 'right' });

            // Rodapé
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(margins.left, pageHeight - margins.bottom + 10, pageWidth - margins.right, pageHeight - margins.bottom + 10);

            // Copyright no rodapé
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('© 2025 Expertzy Inteligência Tributária', pageWidth / 2, pageHeight - margins.bottom + 18, { align: 'center' });

            // Número da página
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - margins.right, pageHeight - margins.bottom + 18, { align: 'right' });
        }
    }

    _drawDottedLine(doc, x1, y1, x2, y2) {
        doc.setLineDashPattern([1, 1], 0);
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        doc.line(x1, y1, x2, y2);
        doc.setLineDashPattern([], 0);
    }

    _drawGradient(doc, x1, y1, x2, y2, color1, color2) {
        // Implementação simplificada de gradiente usando retângulos
        const steps = 20;
        const width = x2 - x1;
        const height = y2 - y1;
        const stepWidth = width / steps;
        
        for (let i = 0; i < steps; i++) {
            // Calcular cor interpolada
            const factor = i / steps;
            const r = Math.floor(color1[0] + factor * (color2[0] - color1[0]));
            const g = Math.floor(color1[1] + factor * (color2[1] - color1[1]));
            const b = Math.floor(color1[2] + factor * (color2[2] - color1[2]));
            
            // Definir cor e desenhar retângulo
            doc.setFillColor(r, g, b);
            doc.rect(x1 + i * stepWidth, y1, stepWidth, height, 'F');
        }
    }
}

/**
 * Excel Exporter
 * Handles Excel document generation
 */
class ExcelExporter extends BaseExporter {
    constructor() {
        super();
    }

    /**
     * Validate required libraries
     * @returns {boolean} True if valid
     */
    validateLibraries() {
        if (typeof XLSX === "undefined") {
            console.error("XLSX library not found");
            return false;
        }
        return true;
    }

    /**
     * Export data to Excel
     * @param {Object} simulation - Simulation data to export
     * @param {Object} options - Export options
     * @returns {Promise} Promise resolved after export
     */
    export(simulation, options = {}) {
        console.log("Starting Excel export");

        // Check for library
        if (!this.validateLibraries()) {
            alert("Error exporting: XLSX library not loaded");
            return Promise.reject("XLSX library not loaded");
        }

        // Verificar se DataManager está disponível
        if (!window.DataManager) {
            console.error('DataManager não disponível para exportação Excel');
            alert("Erro crítico: DataManager não encontrado. A exportação não pode continuar.");
            return Promise.reject('DataManager not available');
        }

        return new Promise((resolve, reject) => {
            try {
                // Validar e obter dados da simulação usando DataManager
                let dadosSimulacao, resultadosSimulacao;

                if (simulation && simulation.dados && simulation.resultados) {
                    // Usar dados fornecidos, mas validar com DataManager
                    dadosSimulacao = window.DataManager.validarENormalizar(simulation.dados);
                    resultadosSimulacao = simulation.resultados;
                } else {
                    // Obter dados do formulário e resultados globais
                    dadosSimulacao = window.DataManager.obterDadosDoFormulario();
                    resultadosSimulacao = window.resultadosSimulacao;

                    if (!dadosSimulacao || !resultadosSimulacao) {
                        alert("Execute uma simulação antes de exportar os resultados.");
                        return reject("No simulation data available");
                    }
                }

                // Initialize equivalentRates if it doesn't exist
                const equivalentRates = simulation?.aliquotasEquivalentes || {};

                // Check if required data is present
                if (!resultadosSimulacao || !resultadosSimulacao.impactoBase) {
                    alert("Estrutura de resultados inválida. Execute uma nova simulação.");
                    return reject("Invalid results structure");
                }

                // Request filename using DataManager formatting
                const manager = new ExportManager();
                const filename = manager.requestFilename("xlsx", "relatorio-split-payment");
                if (!filename) {
                    return resolve({
                        success: false,
                        message: "Export cancelled by user"
                    });
                }

                // Create workbook
                const wb = XLSX.utils.book_new();

                // Set workbook properties
                wb.Props = {
                    Title: "Relatório Simulador de Split Payment",
                    Subject: "Análise do impacto do Split Payment no fluxo de caixa",
                    Author: "Expertzy Inteligência Tributária",
                    CreatedDate: new Date()
                };

                // Create and add worksheets
                // 1. Summary Worksheet
                const wsSummary = this._createSummaryWorksheet(dadosSimulacao, resultadosSimulacao, equivalentRates);
                XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

                // 2. Results Worksheet
                const wsResults = this._createResultsWorksheet(dadosSimulacao, resultadosSimulacao);
                XLSX.utils.book_append_sheet(wb, wsResults, "Resultados");

                // 3. Calculation Memory Worksheet (if available)
                if (window.memoriaCalculoSimulacao) {
                    const wsMemory = this._createMemoryWorksheet();
                    XLSX.utils.book_append_sheet(wb, wsMemory, "Memória de Cálculo");
                }

                // Save file
                XLSX.writeFile(wb, filename);

                console.log("Excel exported successfully:", filename);

                // Log da exportação para diagnóstico
                window.DataManager.logTransformacao(
                    { dados: dadosSimulacao, resultados: resultadosSimulacao },
                    { filename, worksheets: wb.SheetNames.length },
                    'Exportação Excel Concluída'
                );

                resolve({
                    success: true,
                    message: "Excel exported successfully!",
                    fileName: filename
                });
            } catch (error) {
                console.error("Error exporting to Excel:", error);
                alert("Error exporting to Excel. Check console for details.");

                reject({
                    success: false,
                    message: `Error exporting to Excel: ${error.message}`,
                    error: error
                });
            }
        });
    }

    _createSummaryWorksheet(data, results, equivalentRates) {
        // Usar DataManager para formatação consistente
        const formatarMoeda = (valor) => {
            if (window.DataManager && typeof window.DataManager.formatarMoeda === 'function') {
                return window.DataManager.formatarMoeda(valor);
            }
            return this._formatarValorPadrao(valor, 'monetario');
        };

        const formatarPercentual = (valor) => {
            if (window.DataManager && typeof window.DataManager.formatarPercentual === 'function') {
                return window.DataManager.formatarPercentual(valor);
            }
            return this._formatarValorPadrao(valor, 'percentual');
        };

        const formatarData = (valor) => {
            if (window.DataManager && typeof window.DataManager.formatarData === 'function') {
                return window.DataManager.formatarData(valor);
            }
            return this._formatarValorPadrao(valor, 'data');
        };

        // Garantir que data está na estrutura aninhada
        let dadosAninhados;
        if (data && data.empresa !== undefined) {
            dadosAninhados = data;
        } else if (window.DataManager) {
            dadosAninhados = window.DataManager.converterParaEstruturaAninhada(data || {});
        } else {
            dadosAninhados = {
                empresa: {},
                cicloFinanceiro: {},
                parametrosFiscais: {},
                parametrosSimulacao: {}
            };
        }

        // Dados da planilha
        const summaryData = [
            ["RELATÓRIO DE SIMULAÇÃO - SPLIT PAYMENT"],
            ["Expertzy Inteligência Tributária"],
            ["Data do relatório:", formatarData(new Date())],
            [],
            ["RESUMO EXECUTIVO"],
            [],
            ["Parâmetros Principais"],
            ["Empresa:", dadosAninhados.empresa?.nome || ""],
            ["Setor:", this._obterNomeSetor(dadosAninhados.empresa?.setor)],
            ["Regime Tributário:", this._obterRegimeTributario(dadosAninhados.empresa?.regime)],
            ["Faturamento Mensal:", formatarMoeda(dadosAninhados.empresa?.faturamento || 0)],
            ["Período de Simulação:", 
                `${dadosAninhados.parametrosSimulacao?.dataInicial?.split('-')[0] || '2026'} a ${dadosAninhados.parametrosSimulacao?.dataFinal?.split('-')[0] || '2033'}`
            ],
            [],
            ["Resultados Principais"]
        ];

        // Calcular indicadores usando estrutura de resultados
        let variacaoTotal = 0;
        let maiorImpacto = { valor: 0, ano: "" };
        let menorImpacto = { valor: Number.MAX_SAFE_INTEGER, ano: "" };

        // Obter dados do impacto base
        if (results && results.impactoBase) {
            variacaoTotal = results.impactoBase.diferencaCapitalGiro || 0;

            // Se temos projeção temporal, usar seus dados
            if (results.projecaoTemporal && results.projecaoTemporal.resultadosAnuais) {
                const anos = Object.keys(results.projecaoTemporal.resultadosAnuais).sort();

                anos.forEach((ano) => {
                    const resultado = results.projecaoTemporal.resultadosAnuais[ano];
                    const diferenca = resultado.diferencaCapitalGiro || 0;

                    if (Math.abs(diferenca) > Math.abs(maiorImpacto.valor)) {
                        maiorImpacto.valor = diferenca;
                        maiorImpacto.ano = ano;
                    }

                    if (Math.abs(diferenca) < Math.abs(menorImpacto.valor)) {
                        menorImpacto.valor = diferenca;
                        menorImpacto.ano = ano;
                    }
                });
            } else {
                // Usar dados do impacto base
                maiorImpacto.valor = variacaoTotal;
                maiorImpacto.ano = "2026";
                menorImpacto.valor = variacaoTotal;
                menorImpacto.ano = "2026";
            }
        }

        // Determinar se o impacto é predominantemente positivo ou negativo
        const impactoGeral = variacaoTotal > 0 ? "Aumento da necessidade de capital de giro" : "Redução da necessidade de capital de giro";

        // Adicionar resultados principais
        summaryData.push(
            ["Impacto Geral:", impactoGeral],
            ["Variação na Necessidade de Capital:", formatarMoeda(Math.abs(variacaoTotal))],
            ["Ano de Maior Impacto:", `${maiorImpacto.ano} (${formatarMoeda(maiorImpacto.valor)})`],
            ["Ano de Menor Impacto:", `${menorImpacto.ano} (${formatarMoeda(menorImpacto.valor)})`],
            []
        );

        // Tabela de resultados resumidos se disponível
        if (results.projecaoTemporal && results.projecaoTemporal.resultadosAnuais) {
            summaryData.push(["Resumo Anual"], ["Ano", "Capital Giro Split", "Capital Giro Atual", "Diferença", "Variação (%)"]);

            const anos = Object.keys(results.projecaoTemporal.resultadosAnuais).sort();
            anos.forEach((ano) => {
                const resultado = results.projecaoTemporal.resultadosAnuais[ano];

                const capitalGiroAtual = resultado.resultadoAtual?.capitalGiroDisponivel || 0;
                const capitalGiroSplit = resultado.resultadoSplitPayment?.capitalGiroDisponivel || 0;
                const diferenca = resultado.diferencaCapitalGiro || (capitalGiroSplit - capitalGiroAtual);
                const percentual = capitalGiroAtual !== 0 ? (diferenca / capitalGiroAtual) * 100 : 0;

                summaryData.push([parseInt(ano), capitalGiroSplit, capitalGiroAtual, diferenca, percentual / 100]);
            });
        }

        // Estratégias recomendadas
        summaryData.push(
            [],
            ["Estratégias Recomendadas"],
            ["• Ajuste de Preços"],
            ["• Renegociação de Prazos com Fornecedores e Clientes"],
            ["• Antecipação de Recebíveis"],
            ["• Captação de Capital de Giro"],
            ['Para detalhes completos, consulte a planilha "Estratégias de Mitigação"'],
            [],
            ["© 2025 Expertzy Inteligência Tributária - Relatório gerado pelo Simulador de Split Payment"]
        );

        // Criar planilha
        const ws = XLSX.utils.aoa_to_sheet(summaryData);

        // Aplicar estilos à planilha
        this._applySummaryStyles(ws, summaryData, Object.keys(results.projecaoTemporal?.resultadosAnuais || {}).length);

        return ws;
    }

    /**
     * Obtém o nome do regime tributário formatado
     * @private
     * @param {string} regimeCodigo - Código do regime
     * @returns {string} Nome formatado do regime
     */
    _obterRegimeTributario(regimeCodigo) {
        const regimes = {
            'real': 'Lucro Real',
            'presumido': 'Lucro Presumido',
            'simples': 'Simples Nacional',
            'mei': 'Microempreendedor Individual',
            'imune': 'Entidade Imune/Isenta'
        };

        return regimes[regimeCodigo] || regimeCodigo || '';
    }

    /**
     * Obtém o nome do setor formatado
     * @private
     * @param {string} setorCodigo - Código do setor
     * @returns {string} Nome formatado do setor
     */
    _obterNomeSetor(setorCodigo) {
        // Tentar obter o setor do repositório
        if (window.SetoresRepository && typeof window.SetoresRepository.obterSetor === 'function') {
            const setor = window.SetoresRepository.obterSetor(setorCodigo);
            if (setor && setor.nome) {
                return setor.nome;
            }
        }

        // Fallback: capitalizar o código do setor
        return setorCodigo ? 
            setorCodigo.charAt(0).toUpperCase() + setorCodigo.slice(1).toLowerCase() : '';
    }

    /**
     * Conversão simples para estrutura aninhada (fallback quando DataManager não disponível)
     * @private
     * @param {Object} dadosPlanos - Dados em formato plano
     * @returns {Object} Dados em formato aninhado
     */
    _converterParaEstruturaAninhada(dadosPlanos) {
        if (!dadosPlanos) return { empresa: {}, cicloFinanceiro: {}, parametrosFiscais: {}, parametrosSimulacao: {} };

        // Estrutura básica
        const resultado = {
            empresa: {
                nome: dadosPlanos.empresa || '',
                faturamento: dadosPlanos.faturamento || 0,
                margem: dadosPlanos.margem || 0,
                setor: dadosPlanos.setor || '',
                tipoEmpresa: dadosPlanos.tipoEmpresa || '',
                regime: dadosPlanos.regime || ''
            },
            cicloFinanceiro: {
                pmr: dadosPlanos.pmr || 30,
                pmp: dadosPlanos.pmp || 30,
                pme: dadosPlanos.pme || 30,
                percVista: dadosPlanos.percVista || 0.3,
                percPrazo: dadosPlanos.percPrazo || 0.7
            },
            parametrosFiscais: {
                aliquota: dadosPlanos.aliquota || 0.265,
                tipoOperacao: dadosPlanos.tipoOperacao || '',
                regimePisCofins: dadosPlanos.regimePisCofins || '',
                creditos: {
                    pis: dadosPlanos.creditosPIS || 0,
                    cofins: dadosPlanos.creditosCOFINS || 0,
                    icms: dadosPlanos.creditosICMS || 0,
                    ipi: dadosPlanos.creditosIPI || 0,
                    cbs: dadosPlanos.creditosCBS || 0,
                    ibs: dadosPlanos.creditosIBS || 0
                }
            },
            parametrosSimulacao: {
                cenario: dadosPlanos.cenario || 'moderado',
                taxaCrescimento: dadosPlanos.taxaCrescimento || 0.05,
                dataInicial: dadosPlanos.dataInicial || '2026-01-01',
                dataFinal: dadosPlanos.dataFinal || '2033-12-31',
                splitPayment: dadosPlanos.splitPayment !== false
            }
        };

        // Adicionar configuração IVA se disponível
        if (dadosPlanos.aliquotaCBS || dadosPlanos.aliquotaIBS || dadosPlanos.categoriaIva || dadosPlanos.reducaoEspecial) {
            resultado.ivaConfig = {
                cbs: dadosPlanos.aliquotaCBS || 0.088,
                ibs: dadosPlanos.aliquotaIBS || 0.177,
                categoriaIva: dadosPlanos.categoriaIva || 'standard',
                reducaoEspecial: dadosPlanos.reducaoEspecial || 0
            };
        }

        return resultado;
    }

    _createResultsWorksheet(data, results) {
        const manager = new ExportManager();
        
        // Dados da planilha
        const resultsData = [
            ["RESULTADOS DETALHADOS DA SIMULAÇÃO - SPLIT PAYMENT"],
            ["Expertzy Inteligência Tributária"],
            ["Data do relatório:", manager.formatDate(new Date())],
            [],
            ["TABELA DE RESULTADOS ANUAIS"],
            [],
            ["Ano", "Split Payment (R$)", "Sistema Atual (R$)", "Diferença (R$)", "Variação (%)", "Impacto no Fluxo de Caixa"]
        ];

        // Extrair resultados detalhados
        const resultadosExportacao = results.resultadosExportacao || {};
        const resultadosPorAno = resultadosExportacao.resultadosPorAno || {};
        
        // Ordenar anos
        const anos = Object.keys(resultadosPorAno).sort();
        
        // Adicionar dados para cada ano
        anos.forEach(ano => {
            const resultado = resultadosPorAno[ano] || {};
            
            const capitalGiroSplitPayment = resultado.capitalGiroSplitPayment || resultado.impostoDevido || 0;
            const capitalGiroAtual = resultado.capitalGiroAtual || resultado.sistemaAtual || 0;
            const diferenca = resultado.diferenca || (capitalGiroSplitPayment - capitalGiroAtual);
            const percentualImpacto = resultado.percentualImpacto || 
                                     (capitalGiroAtual !== 0 ? (diferenca / capitalGiroAtual) * 100 : 0);
                                     
            // Determinar impacto
            let impactoText = "Neutro";
            if (diferenca > 0) {
                impactoText = "Negativo (Aumento na necessidade de capital)";
            } else if (diferenca < 0) {
                impactoText = "Positivo (Redução na necessidade de capital)";
            }
            
            resultsData.push([
                parseInt(ano),
                capitalGiroSplitPayment,
                capitalGiroAtual,
                diferenca,
                percentualImpacto / 100, // Formato de percentual no Excel
                impactoText
            ]);
        });

        // Adicionar seção de análise
        resultsData.push(
            [],
            ["ANÁLISE DOS RESULTADOS"],
            [],
            ["Impacto Total:", { f: `SUM(D8:D${7 + anos.length})` }],
            ["Impacto Médio Anual:", { f: `AVERAGE(D8:D${7 + anos.length})` }],
            ["Maior Impacto:", { f: `MAX(ABS(D8:D${7 + anos.length}))` }],
            ["Menor Impacto:", { f: `MIN(ABS(D8:D${7 + anos.length}))` }],
            [],
            ["GRÁFICO DE TENDÊNCIA"],
            ["Um gráfico de tendência mostrando a evolução do impacto ao longo dos anos pode ser criado selecionando os dados e usando o recurso de gráficos do Excel."],
            []
        );

        // Criar planilha
        const ws = XLSX.utils.aoa_to_sheet(resultsData);

        // Aplicar estilos
        this._applyResultsStyles(ws, resultsData, anos.length);

        return ws;
    }

    _createMemoryWorksheet() {
        // Selecionar o ano (usando o mesmo mecanismo do PDF)
        const anoSelecionado = document.getElementById("select-ano-memoria")?.value ||
                              (window.memoriaCalculoSimulacao ? Object.keys(window.memoriaCalculoSimulacao)[0] : "2026");

        let memoriaCalculo = window.memoriaCalculoSimulacao && window.memoriaCalculoSimulacao[anoSelecionado]
            ? window.memoriaCalculoSimulacao[anoSelecionado]
            : "Memória de cálculo não disponível para o ano selecionado.";

        // Formatador usando DataManager
        const formatarData = (data) => {
            if (typeof window.DataManager !== 'undefined' && typeof window.DataManager.formatarData === 'function') {
                return window.DataManager.formatarData(data);
            }
            // Fallback para ExportManager
            const exportManager = new ExportManager();
            return exportManager.formatDate(data);
        };

        // Criar dados da planilha
        const memoryData = [
            ["MEMÓRIA DE CÁLCULO - SPLIT PAYMENT"],
            ["Expertzy Inteligência Tributária"],
            ["Ano de Referência:", anoSelecionado],
            ["Data do relatório:", formatarData(new Date())],
            [],
            ["DETALHAMENTO DOS CÁLCULOS"],
            []
        ];

        // Processar memória de cálculo
        if (typeof memoriaCalculo === 'string') {
            // Dividir em linhas
            const linhas = memoriaCalculo.split('\n');

            // Adicionar cada linha como nova linha na planilha
            linhas.forEach(linha => {
                memoryData.push([linha]);
            });
        } else {
            memoryData.push(["Memória de cálculo não disponível ou em formato inválido."]);
        }

        // Criar planilha
        const ws = XLSX.utils.aoa_to_sheet(memoryData);

        // Aplicar estilos básicos
        const estilos = [];

        // Título principal
        estilos.push({
            range: { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
            style: {
                font: { bold: true, sz: 16, color: { rgb: this.config.excel.colors.primary } },
                alignment: { horizontal: "center" }
            }
        });

        // Subtítulo
        estilos.push({
            range: { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
            style: {
                font: { bold: true, sz: 14, color: { rgb: this.config.excel.colors.neutral } },
                alignment: { horizontal: "center" }
            }
        });

        // Título da seção memória
        estilos.push({
            range: { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } },
            style: {
                font: { bold: true, sz: 14, color: { rgb: this.config.excel.colors.primary } },
                fill: { fgColor: { rgb: this.config.excel.colors.headerBg } },
                alignment: { horizontal: "center" },
                border: {
                    bottom: { style: "medium", color: { rgb: this.config.excel.colors.primary } }
                }
            }
        });

        // Definir largura das colunas
        ws['!cols'] = [
            { wch: 120 } // Coluna A - Extra larga para acomodar texto da memória
        ];

        return ws;
    }

    _applySummaryStyles(ws, data, yearsCount) {
        // Implementação básica para aplicar estilos à planilha de resumo
        // Aqui você implementaria os estilos conforme necessário
        
        // Exemplo de como definir a largura das colunas
        ws['!cols'] = [
            { wch: 25 }, // Coluna A
            { wch: 15 }, // Coluna B
            { wch: 15 }, // Coluna C
            { wch: 15 }, // Coluna D
            { wch: 15 }  // Coluna E
        ];

        // Exemplo de como mesclar células (como para títulos)
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } } // Mesclar primeira linha do título
        ];

        return ws;
    }

    _applyResultsStyles(ws, data, yearsCount) {
        // Implementação básica para aplicar estilos à planilha de resultados
        
        // Definir largura das colunas
        ws['!cols'] = [
            { wch: 10 }, // Ano
            { wch: 20 }, // Split Payment
            { wch: 20 }, // Sistema Atual
            { wch: 20 }, // Diferença
            { wch: 15 }, // Variação
            { wch: 40 }  // Impacto
        ];

        // Mesclar células de título
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } } // Mesclar primeira linha do título
        ];

        return ws;
    }
    
    /**
     * Aplica a formatação padrão para os valores nos relatórios
     * @param {any} valor - Valor a ser formatado
     * @param {string} tipo - Tipo de formatação ('monetario', 'percentual', 'data', 'texto')
     * @returns {any} Valor formatado
     */
    _formatarValorPadrao(valor, tipo) {
        // Verificar se temos o DataManager disponível
        if (typeof window.DataManager !== 'undefined') {
            switch (tipo) {
                case 'monetario':
                    if (typeof window.DataManager.formatarMoeda === 'function') {
                        return window.DataManager.formatarMoeda(valor);
                    }
                    break;
                case 'percentual':
                    if (typeof window.DataManager.formatarPercentual === 'function') {
                        return window.DataManager.formatarPercentual(valor);
                    }
                    break;
                case 'data':
                    if (typeof window.DataManager.formatarData === 'function') {
                        return window.DataManager.formatarData(valor);
                    }
                    break;
            }
        }

        // Fallback para o ExportManager
        const exportManager = new ExportManager();

        switch (tipo) {
            case 'monetario':
                return exportManager.formatCurrency(valor);
            case 'percentual':
                return exportManager.formatPercentage(valor);
            case 'data':
                return exportManager.formatDate(new Date(valor));
            default:
                return valor ? valor.toString() : '';
        }
    }
}

// Expor as classes ao escopo global
window.PDFExporter = PDFExporter;
window.ExcelExporter = ExcelExporter;
