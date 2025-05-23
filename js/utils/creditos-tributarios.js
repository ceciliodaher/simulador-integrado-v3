/**
 * @fileoverview Módulo para cálculo de créditos tributários
 * Responsável por calcular os créditos de PIS, COFINS, ICMS e IPI
 * baseado nos parâmetros configurados pelo usuário
 * 
 * @module creditos-tributarios
 * @author Expertzy Inteligência Tributária
 * @version 1.0.0
 */

// Controle de variáveis globais para cálculos tributários
let calculandoCreditos = false;
let calculandoAliquota = false;

/**
 * Função principal para calcular créditos tributários
 * Atualiza os campos de créditos na interface
 */
/**
 * Calcula créditos tributários baseado nos parâmetros configurados
 */
function calcularCreditosTributarios() {
    if (calculandoCreditos) return; // Evita loops de recálculo
    
    calculandoCreditos = true;
    
    try {
        // Verificar se DataManager está disponível
        const extrairValorNumerico = window.DataManager ? 
            window.DataManager.extrairValorNumerico : 
            function(id) {
                const elemento = document.getElementById(id);
                if (!elemento) return 0;
                
                const valor = elemento.value || elemento.dataset.rawValue || '0';
                return parseFloat(valor.toString().replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            };
        
        const formatarMoeda = window.DataManager ? 
            window.DataManager.formatarMoeda : 
            function(valor) {
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(valor || 0);
            };
        
        // Obter faturamento base
        const faturamento = extrairValorNumerico('faturamento');
        
        if (faturamento <= 0) {
            limparCamposCreditos();
            return;
        }
        
        // Calcular créditos PIS/COFINS
        calcularCreditosPisCofins(faturamento, extrairValorNumerico, formatarMoeda);
        
        // Calcular créditos ICMS
        calcularCreditosICMS(faturamento, extrairValorNumerico, formatarMoeda);
        
        // Calcular créditos IPI
        calcularCreditosIPI(faturamento, extrairValorNumerico, formatarMoeda);
        
        // Atualizar totais
        atualizarTotaisCreditos(formatarMoeda);
        
        console.log('Créditos tributários calculados com sucesso');
        
    } catch (error) {
        console.error('Erro ao calcular créditos tributários:', error);
    } finally {
        calculandoCreditos = false;
    }
}

/**
 * Calcula créditos PIS/COFINS
 */
function calcularCreditosPisCofins(faturamento, extrairValor, formatarMoeda) {
    const regime = document.getElementById('pis-cofins-regime')?.value;
    
    if (regime !== 'nao-cumulativo') {
        // Regime cumulativo não tem direito a créditos
        document.getElementById('credito-pis').value = formatarMoeda(0);
        document.getElementById('credito-cofins').value = formatarMoeda(0);
        document.getElementById('creditos-pis-cofins-calc').value = formatarMoeda(0);
        return;
    }
    
    // Obter parâmetros
    const baseCalc = extrairValor('pis-cofins-base-calc') / 100; // Converter % para decimal
    const percCredito = extrairValor('pis-cofins-perc-credito') / 100;
    const aliquotaPIS = extrairValor('pis-aliquota') / 100;
    const aliquotaCOFINS = extrairValor('cofins-aliquota') / 100;
    
    // Calcular base de crédito
    const baseCredito = faturamento * baseCalc * percCredito;
    
    // Calcular créditos
    const creditoPIS = baseCredito * aliquotaPIS;
    const creditoCOFINS = baseCredito * aliquotaCOFINS;
    const creditoTotal = creditoPIS + creditoCOFINS;
    
    // Atualizar campos
    document.getElementById('credito-pis').value = formatarMoeda(creditoPIS);
    document.getElementById('credito-cofins').value = formatarMoeda(creditoCOFINS);
    document.getElementById('creditos-pis-cofins-calc').value = formatarMoeda(creditoTotal);
}

/**
 * Calcula créditos ICMS
 */
function calcularCreditosICMS(faturamento, extrairValor, formatarMoeda) {
    const camposICMS = document.getElementById('campos-icms');
    if (!camposICMS || camposICMS.style.display === 'none') {
        document.getElementById('credito-icms').value = formatarMoeda(0);
        document.getElementById('creditos-icms-calc').value = formatarMoeda(0);
        return;
    }
    
    // Obter parâmetros
    const baseCalc = extrairValor('icms-base-calc') / 100;
    const percCredito = extrairValor('icms-perc-credito') / 100;
    const aliquotaICMS = extrairValor('aliquota-icms') / 100;
    const incentivo = document.getElementById('possui-incentivo-icms')?.checked ? 
                     (extrairValor('incentivo-icms') / 100) : 0;
    
    // Calcular base de crédito
    const baseCredito = faturamento * baseCalc * percCredito;
    
    // Calcular crédito bruto
    let creditoICMS = baseCredito * aliquotaICMS;
    
    // Aplicar incentivo se houver
    if (incentivo > 0) {
        creditoICMS = creditoICMS * (1 - incentivo);
    }
    
    // Atualizar campos
    document.getElementById('credito-icms').value = formatarMoeda(creditoICMS);
    document.getElementById('creditos-icms-calc').value = formatarMoeda(creditoICMS);
}

/**
 * Calcula créditos IPI
 */
function calcularCreditosIPI(faturamento, extrairValor, formatarMoeda) {
    const camposIPI = document.getElementById('campos-ipi');
    if (!camposIPI || camposIPI.style.display === 'none') {
        document.getElementById('credito-ipi').value = formatarMoeda(0);
        document.getElementById('creditos-ipi-calc').value = formatarMoeda(0);
        return;
    }
    
    // Obter parâmetros
    const baseCalc = extrairValor('ipi-base-calc') / 100;
    const percCredito = extrairValor('ipi-perc-credito') / 100;
    const aliquotaIPI = extrairValor('aliquota-ipi') / 100;
    
    // Calcular base de crédito
    const baseCredito = faturamento * baseCalc * percCredito;
    
    // Calcular crédito
    const creditoIPI = baseCredito * aliquotaIPI;
    
    // Atualizar campos
    document.getElementById('credito-ipi').value = formatarMoeda(creditoIPI);
    document.getElementById('creditos-ipi-calc').value = formatarMoeda(creditoIPI);
}

/**
 * Atualiza totais de créditos
 */
function atualizarTotaisCreditos(formatarMoeda) {
    const extrairValorMonetario = function(id) {
        const elemento = document.getElementById(id);
        if (!elemento) return 0;
        
        const valor = elemento.value || '0';
        return parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    };
    
    // Calcular total de créditos
    const totalCreditos = 
        extrairValorMonetario('credito-pis') +
        extrairValorMonetario('credito-cofins') +
        extrairValorMonetario('credito-icms') +
        extrairValorMonetario('credito-ipi') +
        extrairValorMonetario('credito-iss');
    
    // Atualizar campo de total
    const campoTotalCreditos = document.getElementById('total-creditos');
    if (campoTotalCreditos) {
        campoTotalCreditos.value = formatarMoeda(totalCreditos);
    }
}

/**
 * Limpa campos de créditos
 */
function limparCamposCreditos() {
    const campos = [
        'credito-pis', 'credito-cofins', 'credito-icms', 
        'credito-ipi', 'credito-iss', 'total-creditos',
        'creditos-pis-cofins-calc', 'creditos-icms-calc', 'creditos-ipi-calc'
    ];
    
    campos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) {
            campo.value = 'R$ 0,00';
        }
    });
}

/**
 * Calcula créditos para empresas do Simples Nacional
 */
function calcularCreditosSimples() {
    // No Simples Nacional, normalmente não há créditos tributários
    limparCamposCreditos();
    
    // Atualizar campos de débitos com base na alíquota do Simples
    const aliquotaSimples = parseFloat(document.getElementById('aliquota-simples')?.value) || 0;
    const faturamento = extrairValorNumericoDeElemento('faturamento');
    
    if (faturamento > 0 && aliquotaSimples > 0) {
        const impostoTotal = faturamento * (aliquotaSimples / 100);
        
        // Distribuir proporcionalmente entre os impostos
        atualizarCampoMonetario('debito-pis', impostoTotal * 0.05); // ~5% do Simples
        atualizarCampoMonetario('debito-cofins', impostoTotal * 0.23); // ~23% do Simples
        atualizarCampoMonetario('debito-icms', impostoTotal * 0.34); // ~34% do Simples
        atualizarCampoMonetario('debito-ipi', 0);
        atualizarCampoMonetario('debito-iss', impostoTotal * 0.05); // ~5% do Simples se for serviço
    }
}

/**
 * Calcula créditos para empresas do Lucro Presumido ou Real
 * @param {number} faturamento - Faturamento mensal
 * @param {string} tipoEmpresa - Tipo da empresa (comercio, industria, servicos)
 */
function calcularCreditosLucro(faturamento, tipoEmpresa) {
    const pisCofinsBegime = document.getElementById('pis-cofins-regime')?.value;
    
    // Calcular créditos PIS/COFINS
    calcularCreditosPisCofins(faturamento, pisCofinsBegime);
    
    // Calcular créditos ICMS (se aplicável)
    if (tipoEmpresa === 'comercio' || tipoEmpresa === 'industria') {
        calcularCreditosICMS(faturamento);
    } else {
        atualizarCampoMonetario('credito-icms', 0);
        atualizarCampoMonetario('debito-icms', 0);
    }
    
    // Calcular créditos IPI (se aplicável)
    if (tipoEmpresa === 'industria') {
        calcularCreditosIPI(faturamento);
    } else {
        atualizarCampoMonetario('credito-ipi', 0);
        atualizarCampoMonetario('debito-ipi', 0);
    }
    
    // Calcular ISS (se aplicável)
    if (tipoEmpresa === 'servicos') {
        calcularISS(faturamento);
    } else {
        atualizarCampoMonetario('debito-iss', 0);
        atualizarCampoMonetario('credito-iss', 0);
    }
    
    // Calcular débitos PIS/COFINS
    calcularDebitosPisCofins(faturamento, pisCofinsBegime);
}

/**
 * Calcula débitos de PIS/COFINS
 * @param {number} faturamento - Faturamento mensal
 * @param {string} regime - Regime de PIS/COFINS
 */
function calcularDebitosPisCofins(faturamento, regime) {
    let aliquotaPIS, aliquotaCOFINS;
    
    if (regime === 'cumulativo') {
        aliquotaPIS = 0.65;
        aliquotaCOFINS = 3.0;
    } else {
        aliquotaPIS = parseFloat(document.getElementById('pis-aliquota')?.value) || 1.65;
        aliquotaCOFINS = parseFloat(document.getElementById('cofins-aliquota')?.value) || 7.6;
    }
    
    const debitoPIS = faturamento * (aliquotaPIS / 100);
    const debitoCOFINS = faturamento * (aliquotaCOFINS / 100);
    
    atualizarCampoMonetario('debito-pis', debitoPIS);
    atualizarCampoMonetario('debito-cofins', debitoCOFINS);
}

/**
 * Calcula ISS para empresas de serviços
 * @param {number} faturamento - Faturamento mensal
 */
function calcularISS(faturamento) {
    const aliquotaISS = parseFloat(document.getElementById('aliquota-iss')?.value) || 5;
    const debitoISS = faturamento * (aliquotaISS / 100);
    
    atualizarCampoMonetario('debito-iss', debitoISS);
    // ISS geralmente não tem créditos
    atualizarCampoMonetario('credito-iss', 0);
}

/**
 * Atualiza totais de débitos
 */
function atualizarTotaisDebitos() {
    const debitos = [
        'debito-pis', 'debito-cofins', 'debito-icms', 
        'debito-ipi', 'debito-iss'
    ];
    
    let totalDebitos = 0;
    debitos.forEach(id => {
        const valor = extrairValorNumericoDeElemento(id);
        totalDebitos += valor;
    });
    
    atualizarCampoMonetario('total-debitos', totalDebitos);
}

/**
 * Calcula alíquota efetiva total
 */
function calcularAliquotaEfetivaTotal() {
    if (calculandoAliquota) return;
    
    calculandoAliquota = true;
    
    try {
        const faturamento = extrairValorNumericoDeElemento('faturamento');
        const totalDebitos = extrairValorNumericoDeElemento('total-debitos');
        
        if (faturamento > 0) {
            const aliquotaEfetiva = (totalDebitos / faturamento) * 100;
            
            const campoAliquota = document.getElementById('aliquota-efetiva-total');
            if (campoAliquota) {
                campoAliquota.value = aliquotaEfetiva.toFixed(3);
            }
            
            // Calcular alíquotas efetivas individuais
            calcularAliquotasEfetivasIndividuais(faturamento);
        }
    } catch (erro) {
        console.error('Erro ao calcular alíquota efetiva total:', erro);
    } finally {
        calculandoAliquota = false;
    }
}

/**
 * Calcula alíquotas efetivas individuais
 * @param {number} faturamento - Faturamento mensal
 */
function calcularAliquotasEfetivasIndividuais(faturamento) {
    const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
    
    impostos.forEach(imposto => {
        const debito = extrairValorNumericoDeElemento(`debito-${imposto}`);
        const aliquotaEfetiva = faturamento > 0 ? (debito / faturamento) * 100 : 0;
        
        const campoAliquota = document.getElementById(`aliquota-efetiva-${imposto}`);
        if (campoAliquota) {
            campoAliquota.value = aliquotaEfetiva.toFixed(3);
        }
    });
}

/**
 * Atualiza campo monetário com formatação
 * @param {string} id - ID do elemento
 * @param {number} valor - Valor a ser atualizado
 */
function atualizarCampoMonetario(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.value = formatarMoeda(valor);
    }
}

/**
 * Extrai valor numérico de um elemento
 * @param {string} id - ID do elemento
 * @returns {number} Valor numérico extraído
 */
function extrairValorNumericoDeElemento(id) {
    const elemento = document.getElementById(id);
    if (!elemento || !elemento.value) {
        return 0;
    }
    
    // Se o DataManager estiver disponível, usar sua função
    if (window.DataManager && typeof window.DataManager.extrairValorNumerico === 'function') {
        return window.DataManager.extrairValorNumerico(id);
    }
    
    // Fallback: extrair valor manualmente
    const valor = elemento.value.toString();
    
    // Se for campo monetário (contém R$)
    if (valor.includes('R$')) {
        return parseFloat(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
    }
    
    // Se for percentual
    if (valor.includes('%')) {
        return parseFloat(valor.replace('%', '')) || 0;
    }
    
    // Valor numérico normal
    return parseFloat(valor.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
}

/**
 * Formata valor como moeda brasileira
 * @param {number} valor - Valor a ser formatado
 * @returns {string} Valor formatado como moeda
 */
function formatarMoeda(valor) {
    // Se o DataManager estiver disponível, usar sua função
    if (window.DataManager && typeof window.DataManager.formatarMoeda === 'function') {
        return window.DataManager.formatarMoeda(valor);
    }
    
    // Fallback: formatação básica
    return 'R$ ' + valor.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Função para ajustar alíquotas PIS/COFINS conforme regime
 */
function ajustarAliquotasPisCofins() {
    const regime = document.getElementById('pis-cofins-regime')?.value;
    const camposPisCofinsMeditos = document.getElementById('campos-pis-cofins-creditos');
    const pisAliquota = document.getElementById('pis-aliquota');
    const cofinsAliquota = document.getElementById('cofins-aliquota');
    
    if (regime === 'nao-cumulativo') {
        // Regime não-cumulativo: alíquotas maiores, com direito a crédito
        if (pisAliquota) pisAliquota.value = '1.65';
        if (cofinsAliquota) cofinsAliquota.value = '7.6';
        if (camposPisCofinsMeditos) camposPisCofinsMeditos.style.display = 'block';
    } else {
        // Regime cumulativo: alíquotas menores, sem direito a crédito
        if (pisAliquota) pisAliquota.value = '0.65';
        if (cofinsAliquota) cofinsAliquota.value = '3.0';
        if (camposPisCofinsMeditos) camposPisCofinsMeditos.style.display = 'none';
    }
    
    // Recalcular créditos após mudança de regime
    calcularCreditosTributarios();
}

/**
 * Função para alternar campos de incentivo ICMS
 */
function toggleCamposIncentivoICMS() {
    const checkbox = document.getElementById('possui-incentivo-icms');
    const campoIncentivo = document.getElementById('campo-incentivo-icms');
    
    if (checkbox && campoIncentivo) {
        campoIncentivo.style.display = checkbox.checked ? 'block' : 'none';
        
        // Recalcular se houver mudança
        if (typeof calcularCreditosTributarios === 'function') {
            calcularCreditosTributarios();
        }
    }
}

/**
 * Ajusta os campos tributários conforme o regime selecionado
 */
function ajustarCamposTributarios() {
    if (calculandoCreditos) return; // Evita loops de recalculo
    
    const regime = document.getElementById('regime')?.value;
    
    // Esconder todos os campos específicos inicialmente
    const camposSimples = document.getElementById('campos-simples');
    const camposLucro = document.getElementById('campos-lucro');
    const camposPisCofinsCreditos = document.getElementById('campos-pis-cofins-creditos');
    
    if (camposSimples) camposSimples.style.display = 'none';
    if (camposLucro) camposLucro.style.display = 'none';
    if (camposPisCofinsCreditos) camposPisCofinsCreditos.style.display = 'none';
    
    // Mostrar campos apropriados baseado no regime
    switch (regime) {
        case 'simples':
            if (camposSimples) camposSimples.style.display = 'block';
            break;
            
        case 'presumido':
            if (camposLucro) camposLucro.style.display = 'block';
            // Configurar para regime cumulativo por padrão
            const pisCofinsRegime = document.getElementById('pis-cofins-regime');
            if (pisCofinsRegime) {
                pisCofinsRegime.value = 'cumulativo';
                ajustarAliquotasPisCofins();
            }
            break;
            
        case 'real':
            if (camposLucro) camposLucro.style.display = 'block';
            // Configurar para regime não-cumulativo por padrão
            const pisCofinsRegimeReal = document.getElementById('pis-cofins-regime');
            if (pisCofinsRegimeReal) {
                pisCofinsRegimeReal.value = 'nao-cumulativo';
                ajustarAliquotasPisCofins();
            }
            break;
            
        default:
            // Não mostrar campos específicos se nenhum regime selecionado
            break;
    }
    
    // Ajustar campos de operação após ajustar regime
    ajustarCamposOperacao();
    
    // Recalcular créditos tributários
    if (typeof calcularCreditosTributarios === 'function') {
        calcularCreditosTributarios();
    }
}

/**
 * Ajusta alíquotas PIS/COFINS baseado no regime selecionado
 */
function ajustarAliquotasPisCofins() {
    if (calculandoAliquota) return; // Evita loops
    
    const regime = document.getElementById('pis-cofins-regime')?.value;
    const pisAliquota = document.getElementById('pis-aliquota');
    const cofinsAliquota = document.getElementById('cofins-aliquota');
    const camposPisCofinsCreditos = document.getElementById('campos-pis-cofins-creditos');
    
    if (!pisAliquota || !cofinsAliquota) return;
    
    calculandoAliquota = true;
    
    try {
        if (regime === 'cumulativo') {
            pisAliquota.value = '0.65';
            cofinsAliquota.value = '3.00';
            if (camposPisCofinsCreditos) camposPisCofinsCreditos.style.display = 'none';
        } else if (regime === 'nao-cumulativo') {
            pisAliquota.value = '1.65';
            cofinsAliquota.value = '7.60';
            if (camposPisCofinsCreditos) camposPisCofinsCreditos.style.display = 'block';
        }
        
        // Recalcular créditos após ajustar alíquotas
        if (typeof calcularCreditosTributarios === 'function') {
            setTimeout(() => calcularCreditosTributarios(), 100);
        }
        
    } finally {
        calculandoAliquota = false;
    }
}

/**
 * Ajusta campos de operação baseado no tipo de empresa e operação
 */
function ajustarCamposOperacao() {
    const tipoOperacao = document.getElementById('tipo-operacao')?.value;
    const tipoEmpresa = document.getElementById('tipo-empresa')?.value;
    
    // Obter referências aos campos de impostos
    const camposIcms = document.getElementById('campos-icms');
    const camposIpi = document.getElementById('campos-ipi');
    const camposIss = document.getElementById('campos-iss');
    
    // Esconder todos os campos primeiro
    if (camposIcms) camposIcms.style.display = 'none';
    if (camposIpi) camposIpi.style.display = 'none';
    if (camposIss) camposIss.style.display = 'none';
    
    // Verificar se tanto operação quanto empresa foram selecionados
    if (!tipoOperacao || !tipoEmpresa) return;
    
    // Exibir campos baseado no tipo de empresa
    switch (tipoEmpresa) {
        case 'servicos':
            if (camposIss) camposIss.style.display = 'block';
            break;
            
        case 'comercio':
            if (camposIcms) camposIcms.style.display = 'block';
            break;
            
        case 'industria':
            if (camposIcms) camposIcms.style.display = 'block';
            if (camposIpi) camposIpi.style.display = 'block';
            break;
    }
    
    // Recalcular créditos após ajustar campos
    if (typeof calcularCreditosTributarios === 'function') {
        setTimeout(() => calcularCreditosTributarios(), 100);
    }
}

// Expor funções globalmente
window.calcularCreditosTributarios = calcularCreditosTributarios;
window.ajustarAliquotasPisCofins = ajustarAliquotasPisCofins;
window.toggleCamposIncentivoICMS = toggleCamposIncentivoICMS;
window.extrairValorNumericoDeElemento = extrairValorNumericoDeElemento;
window.ajustarCamposTributarios = ajustarCamposTributarios;
window.ajustarAliquotasPisCofins = ajustarAliquotasPisCofins;
window.ajustarCamposOperacao = ajustarCamposOperacao;