/**
 * Módulo de Cálculo de Créditos Tributários
 * Responsável por calcular os créditos de impostos com base nos dados do formulário
 * VERSÃO CORRIGIDA - Janeiro 2025
 */

// ADICIONAR no início do arquivo - Verificação de dados SPED
function verificarOrigemSped(campoId) {
    const elemento = document.getElementById(campoId);
    return elemento?.dataset?.origemSped === 'true';
}

/**
 * Função principal para calcular créditos tributários
 * Esta função é chamada quando há mudanças nos campos do formulário
 */
function calcularCreditosTributarios() {
    console.log('CREDITOS-TRIBUTARIOS: Verificando origem dos dados');
    
    // NOVO: Não recalcular se há dados SPED
    const possuiDadosSped = ['debito-pis', 'debito-cofins', 'debito-icms', 'debito-ipi']
        .some(id => verificarOrigemSped(id));
    
    if (possuiDadosSped) {
        console.log('CREDITOS-TRIBUTARIOS: Dados SPED detectados - preservando valores');
        // Apenas recalcular alíquotas efetivas
        const faturamento = obterFaturamentoMensal();
        if (faturamento > 0) {
            calcularTotaisEAliquotasEfetivas(faturamento);
        }
        return;
    }
    
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
    console.log(`CREDITOS-TRIBUTARIOS: Iniciando cálculo de totais com faturamento: ${faturamento}`);
    
    if (!faturamento || faturamento <= 0) {
        console.warn('CREDITOS-TRIBUTARIOS: Faturamento inválido ou zero');
        return;
    }

    const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
    let totalDebitos = 0;
    let totalCreditos = 0;

    // Objeto para armazenar valores para debug
    const valoresProcessados = {
        debitos: {},
        creditos: {},
        aliquotasEfetivas: {}
    };

    // Processar cada imposto individualmente
    impostos.forEach(imposto => {
        // Obter valores de débito e crédito
        const debito = obterValorCampoRobusto(`debito-${imposto}`);
        const credito = obterValorCampoRobusto(`credito-${imposto}`);

        // Armazenar para debug
        valoresProcessados.debitos[imposto] = debito;
        valoresProcessados.creditos[imposto] = credito;

        // Somar aos totais
        totalDebitos += debito;
        totalCreditos += credito;

        // Calcular débito líquido e alíquota efetiva
        const debitoLiquido = Math.max(0, debito - credito);
        const aliquotaEfetiva = (debitoLiquido / faturamento) * 100;

        // Armazenar para debug
        valoresProcessados.aliquotasEfetivas[imposto] = aliquotaEfetiva;

        // Atualizar campo de alíquota efetiva
        const campoAliquota = document.getElementById(`aliquota-efetiva-${imposto}`);
        if (campoAliquota) {
            const valorFormatado = aliquotaEfetiva.toFixed(3);
            campoAliquota.value = valorFormatado;
            
            // Armazenar valor numérico
            if (campoAliquota.dataset) {
                campoAliquota.dataset.rawValue = aliquotaEfetiva.toString();
            }

            // Disparar eventos para garantir atualização da interface
            campoAliquota.dispatchEvent(new Event('change', { bubbles: true }));
            campoAliquota.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log(`CREDITOS-TRIBUTARIOS: Alíquota efetiva ${imposto}: ${valorFormatado}% (débito: ${debito}, crédito: ${credito}, líquido: ${debitoLiquido})`);
        }
    });

    // Log consolidado para verificação
    console.log('CREDITOS-TRIBUTARIOS: Valores processados:', valoresProcessados);

    // Atualizar campos de totais
    const campoTotalDebitos = document.getElementById('total-debitos');
    if (campoTotalDebitos) {
        const valorFormatadoDebitos = formatarComoMoeda(totalDebitos);
        campoTotalDebitos.value = valorFormatadoDebitos;
        if (campoTotalDebitos.dataset) {
            campoTotalDebitos.dataset.rawValue = totalDebitos.toString();
        }
        campoTotalDebitos.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`CREDITOS-TRIBUTARIOS: Total débitos: ${valorFormatadoDebitos} (${totalDebitos})`);
    }

    const campoTotalCreditos = document.getElementById('total-creditos');
    if (campoTotalCreditos) {
        const valorFormatadoCreditos = formatarComoMoeda(totalCreditos);
        campoTotalCreditos.value = valorFormatadoCreditos;
        if (campoTotalCreditos.dataset) {
            campoTotalCreditos.dataset.rawValue = totalCreditos.toString();
        }
        campoTotalCreditos.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`CREDITOS-TRIBUTARIOS: Total créditos: ${valorFormatadoCreditos} (${totalCreditos})`);
    }

    // Calcular e atualizar alíquota efetiva total
    const debitoLiquidoTotal = Math.max(0, totalDebitos - totalCreditos);
    const aliquotaEfetivaTotal = (debitoLiquidoTotal / faturamento) * 100;

    const campoAliquotaTotal = document.getElementById('aliquota-efetiva-total');
    if (campoAliquotaTotal) {
        const valorFormatadoTotal = aliquotaEfetivaTotal.toFixed(3);
        campoAliquotaTotal.value = valorFormatadoTotal;
        if (campoAliquotaTotal.dataset) {
            campoAliquotaTotal.dataset.rawValue = aliquotaEfetivaTotal.toString();
        }
        campoAliquotaTotal.dispatchEvent(new Event('change', { bubbles: true }));
        campoAliquotaTotal.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`CREDITOS-TRIBUTARIOS: Alíquota efetiva total: ${valorFormatadoTotal}% (débito líquido total: ${debitoLiquidoTotal})`);
    }

    console.log(`CREDITOS-TRIBUTARIOS: Cálculo de totais concluído - Débitos: ${totalDebitos}, Créditos: ${totalCreditos}, Alíquota Total: ${aliquotaEfetivaTotal.toFixed(3)}%`);
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
function obterValorCampoRobusto(campoId) {
  const elemento = document.getElementById(campoId);
  if (!elemento) return 0;
  
  // MODIFICAÇÃO: Primeiro verificar se há um dataset.rawValue
  if (elemento.dataset && elemento.dataset.rawValue !== undefined) {
    const valor = parseFloat(elemento.dataset.rawValue);
    return isNaN(valor) ? 0 : valor;
  }
  
  // Se não tiver dataset.rawValue, extrair do valor exibido
  const valorTexto = elemento.value;
  if (!valorTexto) return 0;
  
  // Limpar formatação monetária
  const valorLimpo = valorTexto.replace(/[^\d,.-]/g, '').replace(',', '.');
  const valor = parseFloat(valorLimpo);
  
  return isNaN(valor) ? 0 : valor;
}

/**
 * Preenche um campo com valor formatado
 */
function preencherCampoValor(campoId, valor, formatarMoeda = true) {
    const elemento = document.getElementById(campoId);
    if (!elemento) {
        console.warn(`CREDITOS-TRIBUTARIOS: Campo ${campoId} não encontrado`);
        return;
    }

    console.log(`CREDITOS-TRIBUTARIOS: Preenchendo ${campoId} com valor ${valor}, formatarMoeda: ${formatarMoeda}`);

    // Validar valor numérico
    let valorNumerico = typeof valor === 'number' ? valor : parseFloat(valor) || 0;

    let valorFormatado;
    if (formatarMoeda) {
        valorFormatado = formatarComoMoeda(valorNumerico);
    } else {
        valorFormatado = valorNumerico.toFixed(3);
    }

    // Definir valor formatado
    elemento.value = valorFormatado;

    // Armazenar valor numérico para cálculos futuros
    if (elemento.dataset) {
        elemento.dataset.rawValue = valorNumerico.toString();
    }

    // Garantir que o campo seja visível e editável
    elemento.style.display = '';
    if (elemento.closest('.form-group')) {
        elemento.closest('.form-group').style.display = '';
    }

    // Disparar eventos para notificar outros sistemas
    elemento.dispatchEvent(new Event('change', { bubbles: true }));
    elemento.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`CREDITOS-TRIBUTARIOS: Campo ${campoId} preenchido: "${valorFormatado}" (valor numérico: ${valorNumerico})`);
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

    // Adicionar listeners globais
    adicionarListenersGlobais();

    // Verificar e corrigir campos de IPI se necessário
    const verificarCamposIPI = () => {
        const campoDebitoIPI = document.getElementById('debito-ipi');
        const campoCreditoIPI = document.getElementById('credito-ipi');
        
        if (campoDebitoIPI && campoCreditoIPI) {
            const valorDebitoIPI = obterValorCampoRobusto('debito-ipi');
            const valorCreditoIPI = obterValorCampoRobusto('credito-ipi');
            
            console.log('CREDITOS-TRIBUTARIOS: Verificação de campos IPI:', {
                debitoIPI: valorDebitoIPI,
                creditoIPI: valorCreditoIPI
            });

            // Verificar dados SPED importados
            if (window.dadosImportadosSped) {
                console.log('CREDITOS-TRIBUTARIOS: Verificando dados SPED para IPI');
                
                // Verificar estrutura aninhada
                if (window.dadosImportadosSped.parametrosFiscais?.debitos?.ipi && 
                    valorDebitoIPI === 0) {
                    const debitoIPISped = window.dadosImportadosSped.parametrosFiscais.debitos.ipi;
                    console.log(`CREDITOS-TRIBUTARIOS: Corrigindo débito IPI com valor SPED: ${debitoIPISped}`);
                    preencherCampoValor('debito-ipi', debitoIPISped);
                }

                if (window.dadosImportadosSped.parametrosFiscais?.creditos?.ipi && 
                    valorCreditoIPI === 0) {
                    const creditoIPISped = window.dadosImportadosSped.parametrosFiscais.creditos.ipi;
                    console.log(`CREDITOS-TRIBUTARIOS: Corrigindo crédito IPI com valor SPED: ${creditoIPISped}`);
                    preencherCampoValor('credito-ipi', creditoIPISped);
                }

                // Verificar composição tributária
                if (window.dadosImportadosSped.parametrosFiscais?.composicaoTributaria?.debitos?.ipi && 
                    valorDebitoIPI === 0) {
                    const debitoIPISped = window.dadosImportadosSped.parametrosFiscais.composicaoTributaria.debitos.ipi;
                    console.log(`CREDITOS-TRIBUTARIOS: Corrigindo débito IPI via composição: ${debitoIPISped}`);
                    preencherCampoValor('debito-ipi', debitoIPISped);
                }

                if (window.dadosImportadosSped.parametrosFiscais?.composicaoTributaria?.creditos?.ipi && 
                    valorCreditoIPI === 0) {
                    const creditoIPISped = window.dadosImportadosSped.parametrosFiscais.composicaoTributaria.creditos.ipi;
                    console.log(`CREDITOS-TRIBUTARIOS: Corrigindo crédito IPI via composição: ${creditoIPISped}`);
                    preencherCampoValor('credito-ipi', creditoIPISped);
                }
            }

            // Recalcular após possíveis correções
            const faturamento = obterFaturamentoMensal();
            if (faturamento > 0) {
                setTimeout(() => {
                    calcularTotaisEAliquotasEfetivas(faturamento);
                }, 200);
            }
        }
    };

    // Verificar após um pequeno atraso
    setTimeout(verificarCamposIPI, 500);

    console.log('CREDITOS-TRIBUTARIOS: Módulo inicializado');
}

/**
 * Adiciona listeners globais para garantir recálculos automáticos
 */
function adicionarListenersGlobais() {
    // Listener para mudanças nos campos de débito e crédito
    const impostos = ['pis', 'cofins', 'icms', 'ipi', 'iss'];
    
    impostos.forEach(imposto => {
        // Débitos
        const campoDebito = document.getElementById(`debito-${imposto}`);
        if (campoDebito) {
            campoDebito.addEventListener('change', function() {
                setTimeout(() => {
                    const faturamento = obterFaturamentoMensal();
                    if (faturamento > 0) {
                        calcularTotaisEAliquotasEfetivas(faturamento);
                    }
                }, 100);
            });
        }

        // Créditos
        const campoCredito = document.getElementById(`credito-${imposto}`);
        if (campoCredito) {
            campoCredito.addEventListener('change', function() {
                setTimeout(() => {
                    const faturamento = obterFaturamentoMensal();
                    if (faturamento > 0) {
                        calcularTotaisEAliquotasEfetivas(faturamento);
                    }
                }, 100);
            });
        }
    });

    console.log('CREDITOS-TRIBUTARIOS: Listeners globais adicionados');
}

// Listener para importação SPED concluída
document.addEventListener('spedImportacaoConcluida', function(e) {
    console.log('CREDITOS-TRIBUTARIOS: Evento spedImportacaoConcluida detectado');
    setTimeout(() => {
        const faturamento = obterFaturamentoMensal();
        if (faturamento > 0) {
            console.log('CREDITOS-TRIBUTARIOS: Recalculando após importação SPED');
            calcularTotaisEAliquotasEfetivas(faturamento);
        }
    }, 500);
});

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