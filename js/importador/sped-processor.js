/**
* SPED Processor - Interface para processamento de arquivos SPED
* Versão 1.0.0 - Maio 2025 - CORRIGIDA
*/

const SpedProcessor = (function() {

/**
* Processa arquivos SPED carregados pelo usuário - VERSÃO CORRIGIDA
* @param {HTMLInputElement} inputFiscal - Input do arquivo SPED Fiscal
* @param {HTMLInputElement} inputContribuicoes - Input do arquivo SPED Contribuições
* @param {Function} callback - Função a ser chamada com os dados processados
*/
/**
* Processa arquivos SPED carregados pelo usuário - VERSÃO CORRIGIDA
* @param {HTMLInputElement} inputFiscal - Input do arquivo SPED Fiscal
* @param {HTMLInputElement} inputContribuicoes - Input do arquivo SPED Contribuições
* @param {Function} callback - Função a ser chamada com os dados processados
*/
function processarArquivosSped(inputFiscal, inputContribuicoes, callback) {
    console.log('=== SPED-PROCESSOR: PROCESSAMENTO SIMPLIFICADO ===');
    
    // Verificar arquivos selecionados
    const arquivosFaltantes = [];
    
    if (!inputFiscal.files || inputFiscal.files.length === 0) {
        arquivosFaltantes.push('SPED Fiscal');
    }
    
    if (!inputContribuicoes.files || inputContribuicoes.files.length === 0) {
        arquivosFaltantes.push('SPED Contribuições');
    }
    
    if (arquivosFaltantes.length > 0) {
        callback({
            sucesso: false,
            mensagem: `Arquivos não selecionados: ${arquivosFaltantes.join(', ')}`
        });
        return;
    }
    
    // Verificar se o SpedExtractor está disponível
    if (!window.SpedExtractor) {
        console.error('SPED-PROCESSOR: SpedExtractor não está disponível');
        callback({
            sucesso: false,
            mensagem: 'Módulo SpedExtractor não disponível. Verifique a ordem de carregamento dos scripts.'
        });
        return;
    }
    
    // Variáveis para armazenar dados processados
    let dadosFiscalProcessados = null;
    let dadosContribuicoesProcessados = null;
    let arquivosProcessados = 0;
    const totalArquivos = 2;
    
    // Função para finalizar processamento quando ambos arquivos estiverem prontos
    function finalizarProcessamento() {
        arquivosProcessados++;
        
        if (arquivosProcessados === totalArquivos) {
            try {
                // Integrar dados sem conversões desnecessárias
                const dadosIntegrados = SpedExtractor.integrarDados(dadosFiscalProcessados, dadosContribuicoesProcessados);
                
                // PRESERVAR: Flag de dados SPED
                dadosIntegrados.dadosSpedImportados = true;
                dadosIntegrados.preservarValoresOriginais = true;
                dadosIntegrados.metadados = dadosIntegrados.metadados || {};
                dadosIntegrados.metadados.processamentoSimplificado = true;
                dadosIntegrados.metadados.timestampProcessamento = new Date().toISOString();
                
                console.log('SPED-PROCESSOR: Dados integrados com preservação:', dadosIntegrados);
                
                callback({
                    sucesso: true,
                    dados: dadosIntegrados
                });
                
            } catch (erro) {
                console.error('SPED-PROCESSOR: Erro na integração final:', erro);
                callback({
                    sucesso: false,
                    mensagem: 'Erro na integração dos dados SPED: ' + erro.message
                });
            }
        }
    }
    
    // Processar SPED Fiscal
    const leitorFiscal = new FileReader();
    leitorFiscal.onload = function(e) {
        const conteudoFiscal = e.target.result;
        try {
            console.log('SPED-PROCESSOR: Processando SPED Fiscal...');
            const resultadoFiscal = SpedExtractor.processarArquivo(conteudoFiscal, 'FISCAL');
            dadosFiscalProcessados = SpedExtractor.extrairDadosParaSimulador(resultadoFiscal);
            
            console.log('SPED-PROCESSOR: SPED Fiscal processado:', dadosFiscalProcessados);
            finalizarProcessamento();
            
        } catch (erro) {
            console.error('SPED-PROCESSOR: Erro ao processar SPED Fiscal:', erro);
            // Continuar mesmo com erro no Fiscal
            dadosFiscalProcessados = null;
            finalizarProcessamento();
        }
    };
    
    leitorFiscal.onerror = function(e) {
        console.error('SPED-PROCESSOR: Erro ao ler arquivo SPED Fiscal:', e);
        dadosFiscalProcessados = null;
        finalizarProcessamento();
    };
    
    // Processar SPED Contribuições
    const leitorContribuicoes = new FileReader();
    leitorContribuicoes.onload = function(e) {
        const conteudoContribuicoes = e.target.result;
        try {
            console.log('SPED-PROCESSOR: Processando SPED Contribuições...');
            const resultadoContribuicoes = SpedExtractor.processarArquivo(conteudoContribuicoes, 'CONTRIBUICOES');
            dadosContribuicoesProcessados = SpedExtractor.extrairDadosParaSimulador(resultadoContribuicoes);
            
            console.log('SPED-PROCESSOR: SPED Contribuições processado:', dadosContribuicoesProcessados);
            finalizarProcessamento();
            
        } catch (erro) {
            console.error('SPED-PROCESSOR: Erro ao processar SPED Contribuições:', erro);
            // Continuar mesmo com erro no Contribuições
            dadosContribuicoesProcessados = null;
            finalizarProcessamento();
        }
    };
    
    leitorContribuicoes.onerror = function(e) {
        console.error('SPED-PROCESSOR: Erro ao ler arquivo SPED Contribuições:', e);
        dadosContribuicoesProcessados = null;
        finalizarProcessamento();
    };
    
    // Iniciar leitura dos arquivos
    leitorFiscal.readAsText(inputFiscal.files[0]);
    leitorContribuicoes.readAsText(inputContribuicoes.files[0]);
}

// Interface pública
return {
    processarArquivos: processarArquivosSped
};

})();

// Expor o módulo globalmente
if (typeof window !== 'undefined') {
    window.SpedProcessor = SpedProcessor;
    console.log('SPED-PROCESSOR: Módulo de interface carregado com sucesso!');
}