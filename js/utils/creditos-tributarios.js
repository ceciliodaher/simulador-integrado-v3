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
 * Substituir completamente a função calcularTotaisEAliquotasEfetivas no arquivo creditos-tributarios.js (aproximadamente linha 295)
 */
function calcularTotaisEAliquotasEfetivas(faturamento) {
    const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
    
    let totalDebitos = 0;
    let totalCreditos = 0;
    
    // ADICIONADO: Log explícito para depuração
    console.log(`CREDITOS-TRIBUTARIOS: Iniciando cálculo de totais com faturamento: ${faturamento}`);
    
    // Array para armazenar os valores para verificação
    const valoresDebitos = {};
    const valoresCreditos = {};
    
    // Calcular totais e alíquotas efetivas por imposto
    impostos.forEach(imposto => {
        // Usar a função robusta para obter valores confiáveis
        const debito = obterValorCampoRobusto(`debito-${imposto}`);
        const credito = obterValorCampoRobusto(`credito-${imposto}`);
        
        // Armazenar para verificação
        valoresDebitos[imposto] = debito;
        valoresCreditos[imposto] = credito;
        
        // MODIFICADO: Log detalhado para cada imposto
        console.log(`CREDITOS-TRIBUTARIOS: ${imposto.toUpperCase()} - Débito: ${debito}, Crédito: ${credito}`);
        
        totalDebitos += debito;
        totalCreditos += credito;
        
        // Calcular alíquota efetiva (débito líquido / faturamento)
        const debitoLiquido = Math.max(0, debito - credito);
        const aliquotaEfetiva = faturamento > 0 ? (debitoLiquido / faturamento) * 100 : 0;
        
        // MODIFICADO: Preencher o campo de alíquota efetiva com valor e acionamento de eventos
        const campoAliquota = document.getElementById(`aliquota-efetiva-${imposto}`);
        if (campoAliquota) {
            // Formatar com 3 casas decimais
            campoAliquota.value = aliquotaEfetiva.toFixed(3);
            
            // ADICIONADO: Armazenar valor bruto para cálculos futuros
            if (campoAliquota.dataset) {
                campoAliquota.dataset.rawValue = aliquotaEfetiva.toString();
            }
            
            // ADICIONADO: Disparar eventos para garantir atualização da interface
            campoAliquota.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(() => {
                campoAliquota.dispatchEvent(new Event('input', { bubbles: true }));
            }, 0);
            
            // Log para depuração
            console.log(`CREDITOS-TRIBUTARIOS: Alíquota efetiva ${imposto.toUpperCase()}: ${aliquotaEfetiva.toFixed(3)}%`);
        }
    });
    
    // Log consolidado para verificação
    console.log('CREDITOS-TRIBUTARIOS: Valores consolidados:', {
        debitos: valoresDebitos,
        creditos: valoresCreditos,
        totalDebitos,
        totalCreditos
    });
    
    // Preencher totais com método que garante atualização da interface
    preencherCampoComEvento('total-debitos', formatarComoMoeda(totalDebitos));
    preencherCampoComEvento('total-creditos', formatarComoMoeda(totalCreditos));
    
    // Calcular alíquota efetiva total
    const debitoLiquidoTotal = Math.max(0, totalDebitos - totalCreditos);
    const aliquotaEfetivaTotal = faturamento > 0 ? (debitoLiquidoTotal / faturamento) * 100 : 0;
    
    // MODIFICADO: Preencher alíquota efetiva total com disparo de eventos
    const campoAliquotaTotal = document.getElementById('aliquota-efetiva-total');
    if (campoAliquotaTotal) {
        campoAliquotaTotal.value = aliquotaEfetivaTotal.toFixed(3);
        
        // ADICIONADO: Armazenar valor bruto para cálculos futuros
        if (campoAliquotaTotal.dataset) {
            campoAliquotaTotal.dataset.rawValue = aliquotaEfetivaTotal.toString();
        }
        
        // ADICIONADO: Disparar eventos para garantir atualização da interface
        campoAliquotaTotal.dispatchEvent(new Event('change', { bubbles: true }));
        setTimeout(() => {
            campoAliquotaTotal.dispatchEvent(new Event('input', { bubbles: true }));
        }, 0);
    }
    
    console.log(`CREDITOS-TRIBUTARIOS: Totais calculados - Débitos: ${totalDebitos.toFixed(2)}, Créditos: ${totalCreditos.toFixed(2)}, Alíquota Efetiva: ${aliquotaEfetivaTotal.toFixed(3)}%`);
}

/**
 * NOVA FUNÇÃO: Preenche campo com disparo de eventos adequados
 * Adicionar esta função ao arquivo creditos-tributarios.js (após a função calcularTotaisEAliquotasEfetivas)
 */
function preencherCampoComEvento(id, valor) {
    const campo = document.getElementById(id);
    if (!campo) return;
    
    // Definir o valor visível
    campo.value = valor;
    
    // Se for um valor monetário, extrair e armazenar o valor numérico
    if (typeof valor === 'string' && (valor.includes('R$') || valor.includes(','))) {
        const valorNumerico = extrairValorMonetario(valor);
        
        // Armazenar valor numérico para cálculos futuros
        if (campo.dataset) {
            campo.dataset.rawValue = valorNumerico.toString();
        }
    }
    
    // Garantir que eventos sejam disparados para atualizar a interface
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }, 0);
    
    console.log(`CREDITOS-TRIBUTARIOS: Campo ${id} preenchido com valor: ${valor}`);
}

/**
 * MODIFICAÇÃO: Extrair valor monetário de forma mais robusta
 * Substituir a função extrairValorMonetario em creditos-tributarios.js se ela existir,
 * caso contrário, adicionar após a função preencherCampoComEvento
 */
function extrairValorMonetario(valor) {
    if (typeof valor === 'number') return valor;
    
    if (typeof valor === 'string') {
        // Remover tudo que não for dígito, vírgula ou ponto
        const valorLimpo = valor.replace(/[^\d,.-]/g, '').replace(',', '.');
        const resultado = parseFloat(valorLimpo);
        return isNaN(resultado) ? 0 : resultado;
    }
    
    return 0;
}

/**
 * Versão mais robusta para obter valor numérico de um campo
 * Esta nova função resolve problemas de inconsistência na obtenção de valores
 */
// Substituir a função obterValorCampoRobusto
function obterValorCampoRobusto(campoId) {
    const elemento = document.getElementById(campoId);
    if (!elemento) return 0;
    
    // Primeiro verificar se há um dataset.rawValue, que é mais confiável
    if (elemento.dataset && elemento.dataset.rawValue !== undefined) {
        const valor = parseFloat(elemento.dataset.rawValue);
        const resultado = isNaN(valor) ? 0 : valor;
        console.log(`CREDITOS-TRIBUTARIOS: Valor extraído de ${campoId} via dataset.rawValue: ${resultado}`);
        return resultado;
    }
    
    // Se não tiver dataset.rawValue, extrair do valor exibido
    const valorTexto = elemento.value;
    if (!valorTexto) return 0;
    
    // Limpar formatação monetária
    const valorLimpo = valorTexto.replace(/[^\d,.-]/g, '').replace(',', '.');
    const valor = parseFloat(valorLimpo);
    const resultado = isNaN(valor) ? 0 : valor;
    
    // Registrar o valor obtido para depuração
    console.log(`CREDITOS-TRIBUTARIOS: Valor extraído de ${campoId} via valor exibido: ${resultado} (original: ${valorTexto})`);
    
    return resultado;
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

/**
 * Função para inicializar valores padrão e corrigir problemas específicos com IPI
 * Adicionar ao final do arquivo creditos-tributarios.js ou substituir se existir
 */
function inicializarCreditosTributarios() {
    console.log('CREDITOS-TRIBUTARIOS: Inicializando módulo...');
    
    // Verificar se os campos de IPI existem e têm valores válidos
    const verificarCamposIPI = () => {
        const campoDebitoIPI = document.getElementById('debito-ipi');
        const campoCreditoIPI = document.getElementById('credito-ipi');
        
        if (campoDebitoIPI && campoCreditoIPI) {
            // Obter valores atuais
            const valorDebitoIPI = obterValorCampoRobusto('debito-ipi');
            const valorCreditoIPI = obterValorCampoRobusto('credito-ipi');
            
            console.log('CREDITOS-TRIBUTARIOS: Verificação de campos IPI:', {
                debitoIPI: valorDebitoIPI,
                creditoIPI: valorCreditoIPI
            });
            
            // Se há dados SPED importados, verificar na estrutura global
            if (window.dadosImportadosSped) {
                console.log('CREDITOS-TRIBUTARIOS: Verificando dados SPED para IPI');
                
                // Verificar estrutura aninhada
                if (window.dadosImportadosSped.parametrosFiscais && 
                    window.dadosImportadosSped.parametrosFiscais.debitos) {
                    
                    const debitoIPISped = window.dadosImportadosSped.parametrosFiscais.debitos.ipi;
                    if (debitoIPISped && debitoIPISped > 0 && valorDebitoIPI === 0) {
                        console.log(`CREDITOS-TRIBUTARIOS: Corrigindo débito IPI com valor SPED: ${debitoIPISped}`);
                        preencherCampoValor('debito-ipi', debitoIPISped);
                    }
                }
                
                if (window.dadosImportadosSped.parametrosFiscais && 
                    window.dadosImportadosSped.parametrosFiscais.creditos) {
                    
                    const creditoIPISped = window.dadosImportadosSped.parametrosFiscais.creditos.ipi;
                    if (creditoIPISped && creditoIPISped > 0 && valorCreditoIPI === 0) {
                        console.log(`CREDITOS-TRIBUTARIOS: Corrigindo crédito IPI com valor SPED: ${creditoIPISped}`);
                        preencherCampoValor('credito-ipi', creditoIPISped);
                    }
                }
                
                // Verificar estrutura plana
                if (window.dadosImportadosSped.debitoIPI && 
                    window.dadosImportadosSped.debitoIPI > 0 && valorDebitoIPI === 0) {
                    console.log(`CREDITOS-TRIBUTARIOS: Corrigindo débito IPI com valor plano: ${window.dadosImportadosSped.debitoIPI}`);
                    preencherCampoValor('debito-ipi', window.dadosImportadosSped.debitoIPI);
                }
                
                if (window.dadosImportadosSped.creditosIPI && 
                    window.dadosImportadosSped.creditosIPI > 0 && valorCreditoIPI === 0) {
                    console.log(`CREDITOS-TRIBUTARIOS: Corrigindo crédito IPI com valor plano: ${window.dadosImportadosSped.creditosIPI}`);
                    preencherCampoValor('credito-ipi', window.dadosImportadosSped.creditosIPI);
                }
            }
            
            // Recalcular alíquotas e totais após possíveis correções
            const faturamento = obterFaturamentoMensal();
            if (faturamento > 0) {
                setTimeout(() => {
                    calcularTotaisEAliquotasEfetivas(faturamento);
                }, 100);
            }
        }
    };
    
    // Verificar após um pequeno atraso para garantir que outros scripts tenham sido carregados
    setTimeout(verificarCamposIPI, 500);
    
    // Registrar ouvinte para eventos de importação SPED concluída
    document.addEventListener('spedImportacaoConcluida', function(e) {
        console.log('CREDITOS-TRIBUTARIOS: Evento de importação SPED detectado, verificando campos...');
        setTimeout(verificarCamposIPI, 300);
    });
    
    console.log('CREDITOS-TRIBUTARIOS: Módulo inicializado');
}

// Disponibilizar funções globalmente
if (typeof window !== 'undefined') {
    window.calcularCreditosTributarios = calcularCreditosTributarios;
    window.ajustarAliquotasPisCofins = ajustarAliquotasPisCofins;
    window.toggleCamposIncentivoICMS = toggleCamposIncentivoICMS;
    // Se o DOM já estiver carregado, inicializar imediatamente
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(inicializarCreditosTributarios, 100);
    } else {
        // Caso contrário, aguardar o carregamento do DOM
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(inicializarCreditosTributarios, 100);
        });
    }
    console.log('CREDITOS-TRIBUTARIOS: Módulo carregado com sucesso');
}