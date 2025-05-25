/**
 * SpedParser Simplificado
 * Converte arquivos SPED em estruturas de dados utilizáveis
 */

const SpedParser = (function() {
    // Função para ler um arquivo SPED
    function lerArquivoSped(conteudo) {
        if (!conteudo) return null;
        
        const linhas = conteudo.split('\n');
        const registros = [];
        
        linhas.forEach(linha => {
            if (!linha.trim()) return; // Ignora linhas vazias
            
            // Separa as colunas pela barra vertical
            const colunas = linha.split('|');
            if (colunas.length < 3) return; // Ignora linhas inválidas
            
            // Remove elementos vazios no início e fim (resultado do split com '|')
            if (colunas[0] === '') colunas.shift();
            if (colunas[colunas.length - 1] === '') colunas.pop();
            
            registros.push(colunas);
        });
        
        return registros;
    }
    
    // Identifica o tipo de arquivo SPED
    function identificarTipoSped(registros) {
        if (!registros || registros.length === 0) return 'DESCONHECIDO';
        
        // Verifica o primeiro registro, que deve ser 0000
        const primeiroRegistro = registros[0];
        if (primeiroRegistro[0] !== '0000') return 'DESCONHECIDO';
        
        // Verifica códigos de finalidade
        const codigoFinalidade = primeiroRegistro[3];
        
        if (codigoFinalidade === '0' || codigoFinalidade === '1') {
            return 'FISCAL';
        } else if (codigoFinalidade === '10' || codigoFinalidade === '11') {
            return 'CONTRIBUICOES';
        } else {
            return 'DESCONHECIDO';
        }
    }
    
    // Função auxiliar para processar datas no formato DDMMAAAA
    function processarData(dataStr) {
        if (!dataStr || dataStr.length !== 8) return '';
        
        const dia = dataStr.substring(0, 2);
        const mes = dataStr.substring(2, 4);
        const ano = dataStr.substring(4, 8);
        
        return `${ano}-${mes}-${dia}`;
    }
    
    // Função para converter valor numérico com vírgula
    function converterValorNumerico(valorStr) {
        if (!valorStr) return 0;
        
        // Remove separadores de milhar e converte vírgula para ponto
        const valor = valorStr.replace(/\./g, '').replace(',', '.');
        
        return parseFloat(valor) || 0;
    }
    
    // Converte registros brutos em estrutura de dados organizada
    function converterRegistros(registros, tipoSped) {
        if (!registros || registros.length === 0) return null;
        
        const resultado = {
            cabecalho: {},
            blocos: {}
        };
        
        // Processamento do cabeçalho (registro 0000)
        if (registros[0][0] === '0000') {
            const cab = registros[0];
            resultado.cabecalho = {
                tipo: tipoSped,
                versaoLeiaute: cab[2],
                finalidade: cab[3],
                dataInicial: processarData(cab[4]),
                dataFinal: processarData(cab[5]),
                nome: cab[6],
                cnpj: cab[7],
                uf: cab[8],
                codMunicipio: cab[9],
                inscricaoEstadual: cab[10]
            };
        }
        
        // Organiza registros por bloco
        registros.forEach(reg => {
            const codRegistro = reg[0];
            const bloco = codRegistro.charAt(0);
            
            if (!resultado.blocos[bloco]) {
                resultado.blocos[bloco] = [];
            }
            
            resultado.blocos[bloco].push(reg);
        });
        
        return resultado;
    }
    
    // Extrai dados específicos dos registros para uso em simulações
    function extrairDadosSimulacao(dadosConvertidos, tipoSped) {
        if (!dadosConvertidos) return null;
        
        const dadosSimulacao = {
            empresa: {
                nome: dadosConvertidos.cabecalho.nome,
                cnpj: dadosConvertidos.cabecalho.cnpj,
                uf: dadosConvertidos.cabecalho.uf
            },
            periodoInicial: dadosConvertidos.cabecalho.dataInicial,
            periodoFinal: dadosConvertidos.cabecalho.dataFinal
        };
        
        // Extrair dados específicos baseado no tipo de SPED
        if (tipoSped === 'FISCAL') {
            dadosSimulacao.icms = extrairDadosICMS(dadosConvertidos);
            dadosSimulacao.ipi = extrairDadosIPI(dadosConvertidos);
            dadosSimulacao.documentos = extrairDocumentosFiscais(dadosConvertidos);
        } else if (tipoSped === 'CONTRIBUICOES') {
            dadosSimulacao.pis = extrairDadosPIS(dadosConvertidos);
            dadosSimulacao.cofins = extrairDadosCOFINS(dadosConvertidos);
            dadosSimulacao.regimeTributario = extrairRegimeTributario(dadosConvertidos);
        }
        
        return dadosSimulacao;
    }
    
    // Funções auxiliares para extração de dados específicos
    function extrairDadosICMS(dados) {
        const blocoE = dados.blocos['E'] || [];
        const registrosE110 = blocoE.filter(reg => reg[0] === 'E110');
        
        if (registrosE110.length === 0) return null;
        
        // Extrai dados do primeiro registro E110 encontrado
        const e110 = registrosE110[0];
        
        return {
            totalDebitos: converterValorNumerico(e110[2]),
            totalCreditos: converterValorNumerico(e110[6]),
            saldoApurado: converterValorNumerico(e110[11]),
            valorRecolher: converterValorNumerico(e110[13])
        };
    }
    
    function extrairDadosIPI(dados) {
        const blocoE = dados.blocos['E'] || [];
        const registrosE520 = blocoE.filter(reg => reg[0] === 'E520');
        
        if (registrosE520.length === 0) return null;
        
        // Extrai dados do primeiro registro E520 encontrado
        const e520 = registrosE520[0];
        
        return {
            totalDebitos: converterValorNumerico(e520[2]),
            totalCreditos: converterValorNumerico(e520[3]),
            saldoApurado: converterValorNumerico(e520[7]),
            valorRecolher: converterValorNumerico(e520[12])
        };
    }
    
    function extrairDocumentosFiscais(dados) {
        const blocoC = dados.blocos['C'] || [];
        const registrosC100 = blocoC.filter(reg => reg[0] === 'C100');
        
        return registrosC100.map(c100 => ({
            modelo: c100[5],
            serie: c100[8],
            numero: c100[9],
            chaveNFe: c100[10],
            data: processarData(c100[11]),
            valorTotal: converterValorNumerico(c100[17]),
            baseCalculoICMS: converterValorNumerico(c100[19]),
            valorICMS: converterValorNumerico(c100[20]),
            valorIPI: converterValorNumerico(c100[24])
        }));
    }
    
    function extrairDadosPIS(dados) {
        const blocoM = dados.blocos['M'] || [];
        const registrosM200 = blocoM.filter(reg => reg[0] === 'M200');
        const registrosM210 = blocoM.filter(reg => reg[0] === 'M210');
        
        if (registrosM200.length === 0 && registrosM210.length === 0) return null;
        
        const resultado = {
            contribuicaoApurada: 0,
            valorRecolher: 0,
            detalhamento: []
        };
        
        // Extrai dados do M200 se disponível
        if (registrosM200.length > 0) {
            const m200 = registrosM200[0];
            resultado.contribuicaoApurada = converterValorNumerico(m200[2]);
            resultado.valorRecolher = converterValorNumerico(m200[8]);
        }
        
        // Adiciona detalhamento do M210
        resultado.detalhamento = registrosM210.map(m210 => ({
            receitaBruta: converterValorNumerico(m210[3]),
            baseCalculo: converterValorNumerico(m210[7]),
            aliquota: converterValorNumerico(m210[8]),
            contribuicaoApurada: converterValorNumerico(m210[11]),
            contribuicaoPeriodo: converterValorNumerico(m210[16])
        }));
        
        return resultado;
    }
    
    function extrairDadosCOFINS(dados) {
        const blocoM = dados.blocos['M'] || [];
        const registrosM600 = blocoM.filter(reg => reg[0] === 'M600');
        const registrosM610 = blocoM.filter(reg => reg[0] === 'M610');
        
        if (registrosM600.length === 0 && registrosM610.length === 0) return null;
        
        const resultado = {
            contribuicaoApurada: 0,
            valorRecolher: 0,
            detalhamento: []
        };
        
        // Extrai dados do M600 se disponível
        if (registrosM600.length > 0) {
            const m600 = registrosM600[0];
            resultado.contribuicaoApurada = converterValorNumerico(m600[2]);
            resultado.valorRecolher = converterValorNumerico(m600[8]);
        }
        
        // Adiciona detalhamento do M610
        resultado.detalhamento = registrosM610.map(m610 => ({
            receitaBruta: converterValorNumerico(m610[3]),
            baseCalculo: converterValorNumerico(m610[7]),
            aliquota: converterValorNumerico(m610[8]),
            contribuicaoApurada: converterValorNumerico(m610[11]),
            contribuicaoPeriodo: converterValorNumerico(m610[16])
        }));
        
        return resultado;
    }
    
    function extrairRegimeTributario(dados) {
        const bloco0 = dados.blocos['0'] || [];
        const registros0110 = bloco0.filter(reg => reg[0] === '0110');
        
        if (registros0110.length === 0) return 'DESCONHECIDO';
        
        const reg0110 = registros0110[0];
        const codIncidencia = reg0110[2];
        
        switch (codIncidencia) {
            case '1':
                return 'CUMULATIVO';
            case '2':
                return 'NAO_CUMULATIVO';
            case '3':
                return 'AMBOS';
            default:
                return 'DESCONHECIDO';
        }
    }
    
    // API pública do módulo
    return {
        // Lê um arquivo SPED e retorna os registros em formato bruto
        lerArquivo: function(conteudo) {
            const registros = lerArquivoSped(conteudo);
            const tipoSped = identificarTipoSped(registros);
            return { registros, tipoSped };
        },
        
        // Converte registros brutos em estrutura de dados organizada
        converterRegistros: converterRegistros,
        
        // Extrai dados específicos para simulações
        extrairDadosSimulacao: extrairDadosSimulacao,
        
        // Identifica o tipo de arquivo SPED
        identificarTipoSped: identificarTipoSped,
        
        // Utilitários para conversão de dados
        converterValorNumerico: converterValorNumerico,
        processarData: processarData
    };
})();

// Expor o módulo globalmente
if (typeof window !== 'undefined') {
    window.SpedParser = SpedParser;
    console.log('SPED-PARSER: Módulo simplificado carregado com sucesso!');
}