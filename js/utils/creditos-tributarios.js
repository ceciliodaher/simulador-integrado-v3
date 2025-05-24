/**
 * Módulo de Cálculo de Créditos Tributários
 * Responsável por calcular os créditos de impostos com base nos dados do formulário
 * VERSÃO CORRIGIDA - Janeiro 2025
 */

/**
 * Função principal para calcular créditos tributários
 * Esta função é chamada quando há mudanças nos campos do formulário
 */
function calcularCreditosTributarios() {
    console.log('CREDITOS-TRIBUTARIOS: Iniciando cálculo dos créditos');
    
    try {
        // Obter valores base
        const faturamento = obterFaturamentoMensal();
        const regime = document.getElementById('regime')?.value || '';
        const tipoEmpresa = document.getElementById('tipo-empresa')?.value || '';
        
        if (!faturamento || faturamento <= 0) {
            console.warn('CREDITOS-TRIBUTARIOS: Faturamento não informado ou inválido');
            zerarCamposCreditos();
            return;
        }
        
        console.log(`CREDITOS-TRIBUTARIOS: Regime: ${regime}, Tipo: ${tipoEmpresa}, Faturamento: ${faturamento}`);
        
        // Limpar campos primeiro
        zerarCamposCreditos();
        
        // Calcular créditos baseado no regime
        switch(regime) {
            case 'simples':
                calcularCreditosSimples(faturamento);
                break;
            case 'presumido':
            case 'real':
                calcularCreditosLucroPresumidoReal(faturamento, tipoEmpresa);
                break;
            default:
                console.warn('CREDITOS-TRIBUTARIOS: Regime tributário não reconhecido ou não selecionado');
                break;
        }
        
        // Calcular totais e alíquotas efetivas
        calcularTotaisEAliquotasEfetivas(faturamento);
        
        console.log('CREDITOS-TRIBUTARIOS: Cálculo concluído com sucesso');
        
    } catch (erro) {
        console.error('CREDITOS-TRIBUTARIOS: Erro durante o cálculo:', erro);
        zerarCamposCreditos();
    }
}

/**
 * Obtém o faturamento mensal do formulário
 */
function obterFaturamentoMensal() {
    const campoFaturamento = document.getElementById('faturamento');
    if (!campoFaturamento) return 0;
    
    let valorFaturamento = 0;
    
    // Se há dataset.rawValue (do CurrencyFormatter), usar ele
    if (campoFaturamento.dataset?.rawValue) {
        valorFaturamento = parseFloat(campoFaturamento.dataset.rawValue);
    } else {
        // Extrair valor do campo formatado
        const valorTexto = campoFaturamento.value;
        if (valorTexto) {
            valorFaturamento = parseFloat(valorTexto.replace(/[^\d,.-]/g, '').replace(',', '.'));
        }
    }
    
    return isNaN(valorFaturamento) ? 0 : valorFaturamento;
}

/**
 * Calcula créditos para empresas do Simples Nacional
 */
function calcularCreditosSimples(faturamento) {
    console.log('CREDITOS-TRIBUTARIOS: Calculando créditos para Simples Nacional');
    
    // No Simples Nacional, geralmente não há créditos de PIS/COFINS/ICMS/IPI
    // pois os impostos são pagos em regime de recolhimento unificado
    
    // Preencher débitos estimados com base na alíquota do Simples
    const aliquotaSimples = parseFloat(document.getElementById('aliquota-simples')?.value || '0') / 100;
    
    if (aliquotaSimples > 0) {
        const debitoTotal = faturamento * aliquotaSimples;
        
        // Distribuir proporcionalmente entre os impostos
        // Distribuição típica do Simples Nacional:
        // PIS ≈ 2.5%, COFINS ≈ 12%, ICMS ≈ 35%, ISS ≈ 16%, IRPJ ≈ 5.5%, CSLL ≈ 3.5%
        const distribuicao = {
            pis: 0.025,
            cofins: 0.12,
            icms: 0.35,
            ipi: 0.02,
            iss: 0.16
        };
        
        // Ajustar distribuição baseada no tipo de empresa
        const tipoEmpresa = document.getElementById('tipo-empresa')?.value || '';
        if (tipoEmpresa === 'servicos') {
            distribuicao.icms = 0;
            distribuicao.ipi = 0;
            distribuicao.iss = 0.53; // Aumenta ISS para serviços
        } else if (tipoEmpresa === 'industria') {
            distribuicao.iss = 0;
            distribuicao.ipi = 0.18; // Aumenta IPI para indústria
        } else {
            distribuicao.iss = 0;
            distribuicao.ipi = 0.02;
        }
        
        Object.keys(distribuicao).forEach(imposto => {
            const valorDebito = debitoTotal * distribuicao[imposto];
            preencherCampoValor(`debito-${imposto}`, valorDebito);
            
            // Calcular alíquota efetiva
            const aliquotaEfetiva = (valorDebito / faturamento) * 100;
            preencherCampoValor(`aliquota-efetiva-${imposto}`, aliquotaEfetiva, false);
        });
        
        console.log('CREDITOS-TRIBUTARIOS: Débitos do Simples Nacional calculados');
    }
}

/**
 * Calcula créditos para Lucro Presumido e Real
 */
function calcularCreditosLucroPresumidoReal(faturamento, tipoEmpresa) {
    console.log('CREDITOS-TRIBUTARIOS: Calculando créditos para Lucro Presumido/Real');
    
    // Calcular PIS/COFINS
    calcularPisCofins(faturamento);
    
    // Calcular ICMS (exceto para serviços)
    if (tipoEmpresa !== 'servicos') {
        calcularICMS(faturamento);
    }
    
    // Calcular IPI (apenas para indústria)
    if (tipoEmpresa === 'industria') {
        calcularIPI(faturamento);
    }
    
    // Calcular ISS (apenas para serviços)
    if (tipoEmpresa === 'servicos') {
        calcularISS(faturamento);
    }
}

/**
 * Calcula débitos e créditos de PIS/COFINS
 */
function calcularPisCofins(faturamento) {
    const regimePisCofins = document.getElementById('pis-cofins-regime')?.value || 'cumulativo';
    
    let aliquotaPIS, aliquotaCOFINS;
    
    if (regimePisCofins === 'nao-cumulativo') {
        aliquotaPIS = 0.0165; // 1,65%
        aliquotaCOFINS = 0.076; // 7,6%
        
        // Calcular créditos no regime não-cumulativo
        const baseCalculoCreditos = parseFloat(document.getElementById('pis-cofins-base-calc')?.value || '0') / 100;
        const percentualAproveitamento = parseFloat(document.getElementById('pis-cofins-perc-credito')?.value || '0') / 100;
        
        if (baseCalculoCreditos > 0 && percentualAproveitamento > 0) {
            const valorBaseCreditos = faturamento * baseCalculoCreditos;
            
            const creditoPIS = valorBaseCreditos * aliquotaPIS * percentualAproveitamento;
            const creditoCOFINS = valorBaseCreditos * aliquotaCOFINS * percentualAproveitamento;
            
            preencherCampoValor('credito-pis', creditoPIS);
            preencherCampoValor('credito-cofins', creditoCOFINS);
            
            // Atualizar campo de créditos calculados
            const totalCreditos = creditoPIS + creditoCOFINS;
            preencherCampoValor('creditos-pis-cofins-calc', totalCreditos);
        }
    } else {
        aliquotaPIS = 0.0065; // 0,65%
        aliquotaCOFINS = 0.03; // 3%
    }
    
    // Calcular débitos
    const debitoPIS = faturamento * aliquotaPIS;
    const debitoCOFINS = faturamento * aliquotaCOFINS;
    
    preencherCampoValor('debito-pis', debitoPIS);
    preencherCampoValor('debito-cofins', debitoCOFINS);
    
    // Atualizar alíquotas nos campos readonly
    document.getElementById('pis-aliquota').value = (aliquotaPIS * 100).toFixed(2);
    document.getElementById('cofins-aliquota').value = (aliquotaCOFINS * 100).toFixed(2);
    
    console.log(`CREDITOS-TRIBUTARIOS: PIS/COFINS calculados - Regime: ${regimePisCofins}`);
}

/**
 * Calcula débitos e créditos de ICMS
 */
function calcularICMS(faturamento) {
    const aliquotaICMS = parseFloat(document.getElementById('aliquota-icms')?.value || '0') / 100;
    const baseCalculoCreditos = parseFloat(document.getElementById('icms-base-calc')?.value || '0') / 100;
    const percentualAproveitamento = parseFloat(document.getElementById('icms-perc-credito')?.value || '0') / 100;
    const possuiIncentivo = document.getElementById('possui-incentivo-icms')?.checked || false;
    const percentualIncentivo = possuiIncentivo ? parseFloat(document.getElementById('incentivo-icms')?.value || '0') / 100 : 0;
    
    if (aliquotaICMS > 0) {
        // Calcular débito com base no faturamento (assumindo que parte é sujeita ao ICMS)
        const baseCalculoDebito = 0.8; // 80% do faturamento sujeito ao ICMS (estimativa)
        let aliquotaEfetiva = aliquotaICMS;
        
        // Aplicar incentivo fiscal se houver
        if (possuiIncentivo && percentualIncentivo > 0) {
            aliquotaEfetiva = aliquotaICMS * (1 - percentualIncentivo);
        }
        
        const debitoICMS = faturamento * baseCalculoDebito * aliquotaEfetiva;
        preencherCampoValor('debito-icms', debitoICMS);
        
        // Calcular créditos
        if (baseCalculoCreditos > 0 && percentualAproveitamento > 0) {
            const valorBaseCreditos = faturamento * baseCalculoCreditos;
            const creditoICMS = valorBaseCreditos * aliquotaICMS * percentualAproveitamento;
            
            preencherCampoValor('credito-icms', creditoICMS);
            preencherCampoValor('creditos-icms-calc', creditoICMS);
        }
        
        console.log('CREDITOS-TRIBUTARIOS: ICMS calculado');
    }
}

/**
 * Calcula débitos e créditos de IPI
 */
function calcularIPI(faturamento) {
    const aliquotaIPI = parseFloat(document.getElementById('aliquota-ipi')?.value || '0') / 100;
    const baseCalculoCreditos = parseFloat(document.getElementById('ipi-base-calc')?.value || '0') / 100;
    const percentualAproveitamento = parseFloat(document.getElementById('ipi-perc-credito')?.value || '0') / 100;
    
    if (aliquotaIPI > 0) {
        // Calcular débito (assumindo que parte da produção é sujeita ao IPI)
        const baseCalculoDebito = 0.6; // 60% da produção sujeita ao IPI (estimativa)
        const debitoIPI = faturamento * baseCalculoDebito * aliquotaIPI;
        
        preencherCampoValor('debito-ipi', debitoIPI);
        
        // Calcular créditos
        if (baseCalculoCreditos > 0 && percentualAproveitamento > 0) {
            const valorBaseCreditos = faturamento * baseCalculoCreditos;
            const creditoIPI = valorBaseCreditos * aliquotaIPI * percentualAproveitamento;
            
            preencherCampoValor('credito-ipi', creditoIPI);
            preencherCampoValor('creditos-ipi-calc', creditoIPI);
        }
        
        console.log('CREDITOS-TRIBUTARIOS: IPI calculado');
    }
}

/**
 * Calcula débitos de ISS
 */
function calcularISS(faturamento) {
    const aliquotaISS = parseFloat(document.getElementById('aliquota-iss')?.value || '0') / 100;
    
    if (aliquotaISS > 0) {
        // ISS incide sobre toda a receita de serviços
        const debitoISS = faturamento * aliquotaISS;
        preencherCampoValor('debito-iss', debitoISS);
        
        // ISS não gera créditos
        preencherCampoValor('credito-iss', 0);
        
        console.log('CREDITOS-TRIBUTARIOS: ISS calculado');
    }
}

/**
 * Calcula totais e alíquotas efetivas
 */
function calcularTotaisEAliquotasEfetivas(faturamento) {
    const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
    
    let totalDebitos = 0;
    let totalCreditos = 0;
    
    // Calcular totais e alíquotas efetivas por imposto
    impostos.forEach(imposto => {
        const debito = obterValorCampo(`debito-${imposto}`);
        const credito = obterValorCampo(`credito-${imposto}`);
        
        totalDebitos += debito;
        totalCreditos += credito;
        
        // Calcular alíquota efetiva (débito líquido / faturamento)
        const debitoLiquido = Math.max(0, debito - credito);
        const aliquotaEfetiva = faturamento > 0 ? (debitoLiquido / faturamento) * 100 : 0;
        
        preencherCampoValor(`aliquota-efetiva-${imposto}`, aliquotaEfetiva, false);
    });
    
    // Preencher totais
    preencherCampoValor('total-debitos', totalDebitos);
    preencherCampoValor('total-creditos', totalCreditos);
    
    // Calcular alíquota efetiva total
    const debitoLiquidoTotal = Math.max(0, totalDebitos - totalCreditos);
    const aliquotaEfetivaTotal = faturamento > 0 ? (debitoLiquidoTotal / faturamento) * 100 : 0;
    preencherCampoValor('aliquota-efetiva-total', aliquotaEfetivaTotal, false);
    
    console.log(`CREDITOS-TRIBUTARIOS: Totais calculados - Débitos: ${totalDebitos.toFixed(2)}, Créditos: ${totalCreditos.toFixed(2)}, Alíquota Efetiva: ${aliquotaEfetivaTotal.toFixed(3)}%`);
}

/**
 * Preenche um campo com valor formatado
 */
function preencherCampoValor(campoId, valor, formatarMoeda = true) {
    const elemento = document.getElementById(campoId);
    if (!elemento) return;
    
    let valorFormatado;
    if (formatarMoeda) {
        valorFormatado = formatarComoMoeda(valor);
    } else {
        valorFormatado = valor.toFixed(3);
    }
    
    elemento.value = valorFormatado;
}

/**
 * Obtém valor numérico de um campo
 */
function obterValorCampo(campoId) {
    const elemento = document.getElementById(campoId);
    if (!elemento) return 0;
    
    const valorTexto = elemento.value;
    if (!valorTexto) return 0;
    
    // Limpar formatação monetária
    const valorLimpo = valorTexto.replace(/[^\d,.-]/g, '').replace(',', '.');
    const valor = parseFloat(valorLimpo);
    
    return isNaN(valor) ? 0 : valor;
}

/**
 * Formata valor como moeda
 */
function formatarComoMoeda(valor) {
    if (isNaN(valor) || valor === null || valor === undefined) {
        valor = 0;
    }

    // Usar CurrencyFormatter se disponível
    if (window.CurrencyFormatter && typeof window.CurrencyFormatter.formatarValorMonetario === 'function') {
        try {
            return window.CurrencyFormatter.formatarValorMonetario(Math.round(valor * 100).toString());
        } catch (erro) {
            console.warn('CREDITOS-TRIBUTARIOS: Erro ao usar CurrencyFormatter:', erro);
        }
    }

    // Fallback para formatação padrão
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

/**
 * Zera todos os campos de créditos e débitos
 */
function zerarCamposCreditos() {
    const campos = [
        'debito-pis', 'credito-pis', 'aliquota-efetiva-pis',
        'debito-cofins', 'credito-cofins', 'aliquota-efetiva-cofins',
        'debito-icms', 'credito-icms', 'aliquota-efetiva-icms',
        'debito-ipi', 'credito-ipi', 'aliquota-efetiva-ipi',
        'debito-iss', 'credito-iss', 'aliquota-efetiva-iss',
        'total-debitos', 'total-creditos', 'aliquota-efetiva-total',
        'creditos-pis-cofins-calc', 'creditos-icms-calc', 'creditos-ipi-calc'
    ];
    
    campos.forEach(campoId => {
        const elemento = document.getElementById(campoId);
        if (elemento) {
            if (campoId.includes('aliquota-efetiva')) {
                elemento.value = '0.000';
            } else {
                elemento.value = formatarComoMoeda(0);
            }
        }
    });
}

/**
 * Função auxiliar para ajustar alíquotas PIS/COFINS baseado no regime
 */
function ajustarAliquotasPisCofins() {
    const regimePisCofins = document.getElementById('pis-cofins-regime')?.value || 'cumulativo';
    const campoPIS = document.getElementById('pis-aliquota');
    const campoCOFINS = document.getElementById('cofins-aliquota');
    const camposCreditos = document.getElementById('campos-pis-cofins-creditos');
    
    if (regimePisCofins === 'nao-cumulativo') {
        if (campoPIS) campoPIS.value = '1.65';
        if (campoCOFINS) campoCOFINS.value = '7.60';
        if (camposCreditos) camposCreditos.style.display = 'block';
    } else {
        if (campoPIS) campoPIS.value = '0.65';
        if (campoCOFINS) campoCOFINS.value = '3.00';
        if (camposCreditos) camposCreditos.style.display = 'none';
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
    
    if (campoIncentivo) {
        campoIncentivo.style.display = checkbox?.checked ? 'block' : 'none';
    }
    
    // Recalcular após mudança
    calcularCreditosTributarios();
}

// Disponibilizar funções globalmente
if (typeof window !== 'undefined') {
    window.calcularCreditosTributarios = calcularCreditosTributarios;
    window.ajustarAliquotasPisCofins = ajustarAliquotasPisCofins;
    window.toggleCamposIncentivoICMS = toggleCamposIncentivoICMS;
    
    console.log('CREDITOS-TRIBUTARIOS: Módulo carregado com sucesso');
}