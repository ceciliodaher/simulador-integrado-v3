/**
 * @fileoverview Parser SPED Aprimorado - Extração completa de dados tributários e financeiros
 * Versão corrigida que extrai todos os dados necessários para o simulador
 * @version 2.1.0 - Versão funcional completa e corrigida
 */

window.SpedParser = (function() {
    
    // Configurações do parser
    const CONFIG = {
        separadorCampo: '|',
        terminadorLinha: /\r?\n/,
        tamanhoMaximoArquivo: 500 * 1024 * 1024, // 500MB
        timeoutProcessamento: 300000, // 5 minutos
        
        // Mapeamento AMPLIADO e CORRIGIDO de registros por tipo de SPED
        registrosFiscal: {
            // Dados da empresa
            '0000': ['REG', 'COD_VER', 'COD_FIN', 'DT_INI', 'DT_FIN', 'NOME', 'CNPJ', 'CPF', 'UF', 'IE', 'COD_MUN', 'IM', 'SUFRAMA'],
            '0001': ['REG', 'IND_MOV'],
            '0005': ['REG', 'FANTASIA', 'CEP', 'END', 'NUM', 'COMPL', 'BAIRRO', 'FONE', 'FAX', 'EMAIL'],
            
            // Produtos
            '0200': ['REG', 'COD_ITEM', 'DESCR_ITEM', 'COD_BARRA', 'COD_ANT_ITEM', 'UNID_INV', 'TIPO_ITEM', 'COD_NCM', 'EX_IPI', 'COD_GEN', 'COD_LST', 'ALIQ_ICMS'],
            
            // Documentos fiscais de entrada (CRÍTICO PARA CRÉDITOS)
            'C100': ['REG', 'IND_OPER', 'IND_EMIT', 'COD_PART', 'COD_MOD', 'COD_SIT', 'SER', 'NUM_DOC', 'CHV_NFE', 'DT_DOC', 'DT_E_S', 'VL_DOC', 'IND_PGTO', 'VL_DESC', 'VL_ABAT_NT', 'VL_MERC', 'IND_FRT', 'VL_FRT', 'VL_SEG', 'VL_OUT_DA', 'VL_BC_ICMS', 'VL_ICMS', 'VL_BC_ICMS_ST', 'VL_ICMS_ST', 'VL_IPI', 'VL_PIS', 'VL_COFINS', 'VL_PIS_ST', 'VL_COFINS_ST'],
            'C170': ['REG', 'NUM_ITEM', 'COD_ITEM', 'DESCR_COMPL', 'QTD', 'UNID', 'VL_ITEM', 'VL_DESC', 'IND_MOV', 'CST_ICMS', 'CFOP', 'COD_NAT', 'VL_BC_ICMS', 'ALIQ_ICMS', 'VL_ICMS', 'VL_BC_ICMS_ST', 'ALIQ_ST', 'VL_ICMS_ST', 'IND_APUR', 'CST_IPI', 'COD_ENQ', 'VL_BC_IPI', 'ALIQ_IPI', 'VL_IPI', 'CST_PIS', 'VL_BC_PIS', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'QUANT_BC_COFINS', 'ALIQ_COFINS_QUANT', 'VL_COFINS', 'COD_CTA'],
            
            // Documentos de saída (CRÍTICO PARA RECEITAS)
            'C300': ['REG', 'COD_MOD', 'SER', 'SUB', 'NUM_DOC_INI', 'NUM_DOC_FIN', 'DT_DOC', 'VL_DOC', 'VL_PIS', 'VL_COFINS', 'COD_CTA'],
            'C370': ['REG', 'NUM_ITEM', 'COD_ITEM', 'QTD', 'UNID', 'VL_ITEM', 'VL_DESC', 'CST_ICMS', 'CFOP', 'VL_BC_ICMS', 'ALIQ_ICMS', 'VL_ICMS', 'VL_BC_ICMS_ST', 'ALIQ_ST', 'VL_ICMS_ST', 'VL_BC_IPI', 'ALIQ_IPI', 'VL_IPI', 'CST_PIS', 'VL_BC_PIS', 'ALIQ_PIS', 'VL_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'VL_COFINS'],
            
            // Apuração ICMS (CRÍTICO PARA DÉBITOS E CRÉDITOS)
            'E110': ['REG', 'VL_TOT_DEBITOS', 'VL_AJ_DEBITOS', 'VL_TOT_AJ_DEBITOS', 'VL_ESTORNOS_CRED', 'VL_TOT_CREDITOS', 'VL_AJ_CREDITOS', 'VL_TOT_AJ_CREDITOS', 'VL_ESTORNOS_DEB', 'VL_SLD_CREDOR_ANT', 'VL_SLD_APURADO', 'VL_TOT_DED', 'VL_ICMS_RECOLHER', 'VL_SLD_CREDOR_TRANSPORTAR', 'DEB_ESP'],
            'E111': ['REG', 'COD_AJ_APUR', 'DESCR_COMPL_AJ', 'VL_AJ_APUR'],
            'E116': ['REG', 'COD_OR', 'VL_OR', 'DT_VCTO', 'COD_REC', 'NUM_PROC', 'IND_PROC', 'PROC', 'TXT_COMPL', 'MES_REF'],
            
            // Apuração IPI (CRÍTICO PARA INDÚSTRIAS)
            'E200': ['REG', 'UF', 'DT_INI', 'DT_FIN'],
            'E210': ['REG', 'IND_MOV_IPI', 'VL_SLD_CRED_ANT_IPI', 'VL_TOT_DEBITOS_IPI', 'VL_OUT_DEB_IPI', 'VL_TOT_CREDITOS_IPI', 'VL_OUT_CRED_IPI', 'VL_SLD_DEVEDOR_IPI', 'VL_SLD_CRED_IPI_A_TRANSP', 'DEB_ESP_IPI']
        },
        
        registrosContribuicoes: {
            // Dados da empresa
            '0000': ['REG', 'COD_VER', 'TIPO_ESCRIT', 'IND_SIT_ESP', 'NUM_REC_ANTERIOR', 'DT_INI', 'DT_FIN', 'NOME', 'CNPJ', 'UF', 'IE', 'COD_MUN', 'SUFRAMA', 'IND_NAT_PJ', 'IND_ATIV'],
            
            // Receitas (CRÍTICO PARA RECEITA BRUTA)
            'A100': ['REG', 'IND_OPER', 'IND_EMIT', 'COD_PART', 'COD_SIT', 'SER', 'SUB', 'NUM_DOC', 'CHV_NFSE', 'DT_DOC', 'DT_E_S', 'VL_DOC', 'IND_PGTO', 'VL_DESC', 'VL_SERV', 'VL_SERV_NT', 'VL_TERC', 'VL_DA', 'VL_BC_ICMS', 'VL_ICMS', 'VL_BC_ICMS_ST', 'VL_ICMS_ST', 'COD_INF_COMPL', 'VL_PIS', 'VL_COFINS'],
            'A110': ['REG', 'COD_INF', 'TXT_COMPL'],
            'A120': ['REG', 'VL_TOT_SERV', 'VL_BC_PIS', 'VL_PIS_IMP', 'DT_PAG_PIS', 'VL_BC_COFINS', 'VL_COFINS_IMP', 'DT_PAG_COFINS', 'LOC_EXE_SERV'],
            
            // NOVO: Receitas Detalhadas por Natureza
            'A200': ['REG', 'NUM_CAMPO', 'COD_REC', 'VL_REC_BRT', 'VL_BC_CONT', 'VL_AJUS_ACRES', 'VL_AJUS_REDUC', 'VL_BC_CONT_AJUS', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_CONT', 'VL_AJUS_ACRES', 'VL_AJUS_REDUC', 'VL_CONT_DIFER', 'VL_CONT_DIFER_ANT', 'VL_CONT_PER'],
            
            // Créditos PIS/COFINS (CRÍTICO)
            'C100': ['REG', 'IND_OPER', 'IND_EMIT', 'COD_PART', 'COD_MOD', 'COD_SIT', 'SER', 'NUM_DOC', 'CHV_NFE', 'DT_DOC', 'DT_E_S', 'VL_DOC', 'IND_PGTO', 'VL_DESC', 'VL_ABAT_NT', 'VL_MERC', 'IND_FRT', 'VL_FRT', 'VL_SEG', 'VL_OUT_DA', 'VL_BC_ICMS', 'VL_ICMS', 'VL_BC_ICMS_ST', 'VL_ICMS_ST', 'VL_IPI', 'VL_PIS', 'VL_COFINS', 'VL_PIS_ST', 'VL_COFINS_ST'],
            'C170': ['REG', 'NUM_ITEM', 'COD_ITEM', 'DESCR_COMPL', 'QTD', 'UNID', 'VL_ITEM', 'VL_DESC', 'IND_MOV', 'CST_ICMS', 'CFOP', 'COD_NAT', 'VL_BC_ICMS', 'ALIQ_ICMS', 'VL_ICMS', 'VL_BC_ICMS_ST', 'ALIQ_ST', 'VL_ICMS_ST', 'IND_APUR', 'CST_IPI', 'COD_ENQ', 'VL_BC_IPI', 'ALIQ_IPI', 'VL_IPI', 'CST_PIS', 'VL_BC_PIS', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_PIS', 'VL_CRED_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'QUANT_BC_COFINS', 'ALIQ_COFINS_QUANT', 'VL_COFINS', 'VL_CRED_COFINS', 'COD_CTA'],
            
            // Apuração PIS (CRÍTICO)
            'M100': ['REG', 'COD_CRED', 'IND_CRED_ORI', 'VL_BC_PIS', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_CRED', 'VL_AJUS_ACRES', 'VL_AJUS_REDUC', 'VL_CRED_DIF', 'VL_CRED_DISP', 'IND_DESC_CRED', 'VL_CRED_DESC', 'SLD_CRED'],    
            'M200': ['REG', 'VL_TOT_CONT_NC_PER', 'VL_TOT_CRED_DESC', 'VL_TOT_CRED_DESC_ANT', 'VL_TOT_CONT_NC_DEV', 'VL_RET_NC', 'VL_OUT_DED_NC', 'VL_CONT_NC_REC', 'VL_TOT_CONT_CUM_PER', 'VL_RET_CUM', 'VL_OUT_DED_CUM', 'VL_CONT_CUM_REC', 'VL_TOT_CONT_REC'],
            'M210': ['REG', 'COD_CONT', 'VL_REC_BRT', 'VL_BC_CONT', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_CONT', 'VL_AJUS_ACRES', 'VL_AJUS_REDUC', 'VL_CONT_DIFER', 'VL_CONT_DIFER_ANT', 'VL_CONT_PER'],
            
            // Apuração COFINS (CRÍTICO)
            'M600': ['REG', 'VL_TOT_CONT_NC_PER', 'VL_TOT_CRED_DESC', 'VL_TOT_CRED_DESC_ANT', 'VL_TOT_CONT_NC_DEV', 'VL_RET_NC', 'VL_OUT_DED_NC', 'VL_CONT_NC_REC', 'VL_TOT_CONT_CUM_PER', 'VL_RET_CUM', 'VL_OUT_DED_CUM', 'VL_CONT_CUM_REC', 'VL_TOT_CONT_REC'],
            'M605': ['REG', 'NAT_BC_CRED', 'CST_COFINS', 'VL_BC_COFINS_TOT', 'VL_BC_COFINS_CUM', 'VL_BC_COFINS_NC', 'VL_BC_COFINS', 'QUANT_BC_COFINS_TOT', 'QUANT_BC_COFINS', 'DESC_CRED'],
            'M610': ['REG', 'COD_CONT', 'VL_REC_BRT', 'VL_BC_CONT', 'ALIQ_COFINS', 'QUANT_BC_COFINS', 'ALIQ_COFINS_QUANT', 'VL_CONT', 'VL_AJUS_ACRES', 'VL_AJUS_REDUC', 'VL_CONT_DIFER', 'VL_CONT_DIFER_ANT', 'VL_CONT_PER'],
            
            // NOVOS REGISTROS PARA CRÉDITOS DETALHADOS
            'C191': ['REG', 'CNPJ_CPF_PART', 'CST_PIS', 'CFOP', 'VL_ITEM', 'VL_DESC', 'VL_BC_PIS', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'QUANT_BC_COFINS', 'ALIQ_COFINS_QUANT', 'VL_COFINS', 'COD_CTA'],
            'C195': ['REG', 'CNPJ_CPF_PART', 'CST_PIS', 'CFOP', 'VL_ITEM', 'VL_DESC', 'VL_BC_PIS', 'ALIQ_PIS', 'QUANT_BC_PIS', 'ALIQ_PIS_QUANT', 'VL_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'QUANT_BC_COFINS', 'ALIQ_COFINS_QUANT', 'VL_COFINS', 'COD_CTA'],

            // Documentos de Serviços
            'D100': ['REG', 'IND_OPER', 'IND_EMIT', 'COD_PART', 'COD_MOD', 'COD_SIT', 'SER', 'SUB', 'NUM_DOC', 'CHV_CTE', 'DT_DOC', 'DT_A_P', 'TP_CT_E', 'CHV_CTE_REF', 'VL_DOC', 'VL_DESC', 'IND_FRT', 'VL_SERV', 'VL_BC_ICMS', 'VL_ICMS', 'VL_NT', 'COD_INF', 'COD_CTA'],
            'D101': ['REG', 'IND_NAT_FRT', 'VL_ITEM', 'CST_PIS', 'NAT_BC_CRED', 'VL_BC_PIS', 'ALIQ_PIS', 'VL_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'VL_COFINS', 'COD_CTA'],

            // Demais Documentos e Operações
            'F100': ['REG', 'IND_OPER', 'COD_PART', 'COD_ITEM', 'DT_OPER', 'VL_OPER', 'CST_PIS', 'VL_BC_PIS', 'ALIQ_PIS', 'VL_PIS', 'CST_COFINS', 'VL_BC_COFINS', 'ALIQ_COFINS', 'VL_COFINS', 'NAT_BC_CRED', 'IND_ORIG_CRED', 'COD_CTA', 'COD_CCUS', 'DESC_DOC_OPER'],

            // Apuração de Créditos
            'M105': ['REG', 'NAT_BC_CRED', 'CST_PIS', 'VL_BC_PIS_TOT', 'VL_BC_PIS_CUM', 'VL_BC_PIS_NC', 'VL_BC_PIS', 'QUANT_BC_PIS_TOT', 'QUANT_BC_PIS', 'DESC_CRED'],
            'M110': ['REG', 'IND_AJ', 'VL_AJ', 'COD_AJ', 'NUM_DOC', 'DESCR_AJ', 'DT_REF'],
            'M115': ['REG', 'DET_VALOR_AJ', 'CST_PIS', 'DET_BC_CRED', 'DET_ALIQ', 'DT_OPER_AJ', 'DESC_AJ', 'COD_CTA', 'INFO_COMPL'],

            'M505': ['REG', 'NAT_BC_CRED', 'CST_COFINS', 'VL_BC_COFINS_TOT', 'VL_BC_COFINS_CUM', 'VL_BC_COFINS_NC', 'VL_BC_COFINS', 'QUANT_BC_COFINS_TOT', 'QUANT_BC_COFINS', 'DESC_CRED'],
            'M510': ['REG', 'IND_AJ', 'VL_AJ', 'COD_AJ', 'NUM_DOC', 'DESCR_AJ', 'DT_REF'],
            'M515': ['REG', 'DET_VALOR_AJ', 'CST_COFINS', 'DET_BC_CRED', 'DET_ALIQ', 'DT_OPER_AJ', 'DESC_AJ', 'COD_CTA', 'INFO_COMPL']
        },
        
        registrosECF: {
            // Identificação
            'J001': ['REG', 'NUM_ORD', 'NAT_LIVR', 'NOME', 'NIRE', 'CNPJ', 'DT_ARQ', 'DT_ARQ_CONV', 'DESC_MUN', 'VL_REC_BRT'],
            
            // Demonstrações Financeiras (CRÍTICO PARA DADOS FINANCEIROS)
            'J100': ['REG', 'COD_AGL', 'NIVEL_AGL', 'IND_GRP_BAL', 'DESCR_COD_AGL', 'VL_CTA_INI_PER', 'IND_DC_INI_PER', 'VL_CTA_FIN_PER', 'IND_DC_FIN_PER'],
            'J150': ['REG', 'COD_AGL', 'NIVEL_AGL', 'DESCR_COD_AGL', 'VL_CTA', 'IND_VL'],
            'J200': ['REG', 'COD_HISTR_FAT_GER', 'VAL_FAT_CONT', 'IND_VAL_FAT_CONT', 'VAL_EXC_BC_EAC', 'IND_VAL_EXC_BC_EAC', 'VAL_EXC_BC_SUSP', 'IND_VAL_EXC_BC_SUSP', 'VAL_BC_EAC', 'IND_VAL_BC_EAC', 'VAL_BC_EAC_ADC', 'IND_VAL_BC_EAC_ADC', 'VAL_EAC', 'IND_VAL_EAC', 'VAL_EAC_ADC', 'IND_VAL_EAC_ADC'],
            'J210': ['REG', 'IND_TIP_INFO_ADIC', 'VL_INF_ADIC', 'DESCR_COMPL_AJ', 'VL_AJ', 'IND_VL_AJ'],
            
            // NOVO: Dados específicos de DRE e Balanço para análises financeiras
            'J930': ['REG', 'IDENT_NOM', 'IDENT_CPF_CNPJ', 'IND_RESP_LEGAL', 'IDENT_QUALIF', 'COD_ASSIN_DIG', 'IND_CRC', 'EMAIL', 'FONE', 'UF_CRC', 'NUM_SEQ_CRC', 'DT_CRC'],
            
            // Demonstrações Contábeis Detalhadas
            'L100': ['REG', 'DT_INI', 'DT_FIN', 'TIPO_ESCR', 'COD_QUAL_PJ', 'COD_FORM_TRIB', 'FORMA_TRIB', 'PERIODO_PREV', 'OPT_REFIS', 'OPT_PAES', 'FORMA_APUR'],
            'L200': ['REG', 'IND_TIT_UTIL', 'TIT_UTIL'],
            'L210': ['REG', 'CODIGO', 'DESCRICAO', 'VALOR', 'IND_VALOR'],
            'L300': ['REG', 'CODIGO', 'DESCRICAO', 'VALOR', 'IND_VALOR']
        },
        
        registrosECD: {
            // Identificação
            'I001': ['REG', 'NUM_ORD', 'NAT_LIVR', 'NOME', 'NIRE', 'CNPJ', 'DT_ARQ', 'DT_ARQ_CONV', 'SIT_ESP', 'MOEDA', 'VL_CAP', 'IND_ATIV', 'QTDE_SCP'],
            'I010': ['REG', 'IND_ESC', 'COD_VER_LC'],
            'I012': ['REG', 'NUM_ORD', 'NAT_LIVR', 'TIPO_ESC', 'COD_ESC_DETAL', 'NUM_ESC', 'DESCR_ESC'],
            
            // Balanço e DRE (CRÍTICO PARA CICLO FINANCEIRO)
            'J100': ['REG', 'DT_ALT', 'COD_CCUS', 'COD_CTA', 'COD_CTA_SUP', 'COD_NAT_CC', 'IND_CTA', 'NIVEL', 'COD_GRP_CTA', 'NOME_CTA'],
            'J150': ['REG', 'NIVEL', 'COD_CTA', 'COD_CTA_SUP', 'COD_CTA_INF', 'VL_SLD_INI', 'IND_DC_INI', 'VL_DEB', 'VL_CRED', 'VL_SLD_FIN', 'IND_DC_FIN'],
            
            // NOVO: Fluxo de Caixa para análise de prazos
            'J800': ['REG', 'ARQ_RTF', 'IND_FIN_RTF'],
            'J801': ['REG', 'DESCR_UND_HASH', 'HASH_UND'],
            'J900': ['REG', 'DNRC_ENC', 'DNRC_INI', 'DNRC_FIN', 'NOME_AC', 'COD_QUALIF_AC', 'CNPJ_AC', 'CRC_AC', 'EMAIL_AC', 'FONE_AC', 'UF_CRC_AC', 'NUM_SEQ_CRC_AC', 'DT_CRC_AC'],
            
            // Demonstrações Financeiras Detalhadas            
            'J930': ['REG', 'IDENT_NOM', 'IDENT_CPF_CNPJ', 'IND_CRC', 'EMAIL', 'FONE', 'UF_CRC', 'NUM_SEQ_CRC', 'DT_CRC'],

            // Balancetes e Balanços Analíticos
            'I050': ['REG', 'DT_ALT', 'COD_NAT', 'IND_CTA', 'NIVEL', 'COD_CTA', 'COD_CTA_SUP', 'CTA'],
            'I051': ['REG', 'COD_ENT_REF', 'COD_CCUS', 'COD_CTA_REF'],
            'I052': ['REG', 'COD_CCUS', 'COD_AGL'],
            'I053': ['REG', 'COD_IDT', 'COD_CNT_CORR', 'NAT_SUB_CNT'],

            // Saldos Periódicos
            'I155': ['REG', 'COD_CTA', 'COD_CCUS', 'VL_SLD_INI', 'IND_DC_INI', 'VL_DEB', 'VL_CRED', 'VL_SLD_FIN', 'IND_DC_FIN', 'VL_SLD_INI_MF', 'IND_DC_INI_MF', 'VL_DEB_MF', 'VL_CRED_MF', 'VL_SLD_FIN_MF', 'IND_DC_FIN_MF']
        }
    };
    
    /**
     * Classe principal do parser SPED aprimorado
     */
    class SpedParserAprimorado {
        constructor() {
            this.registrosExtraidos = {};
            this.dadosEmpresa = {};
            this.dadosFinanceiros = {};      // NOVO: Para dados de DRE/Balanço
            this.dadosTributarios = {};      // NOVO: Para débitos e créditos detalhados
            this.dadosCicloFinanceiro = {};  // NOVO: Para cálculo de prazos
            this.estatisticas = {
                linhasProcessadas: 0,
                registrosEncontrados: 0,
                registrosValidos: 0,
                erros: [],
                inicioProcessamento: null,
                fimProcessamento: null
            };
            this.tipoSped = null;
            this.log = [];
        }
        
        /**
         * Função principal de parsing aprimorada
         */
        async parsearArquivo(arquivo, opcoes = {}) {
            this.log.push(`🚀 Iniciando parsing APRIMORADO do arquivo: ${arquivo.name}`);
            this.estatisticas.inicioProcessamento = new Date();
            
            try {
                // 1. Ler conteúdo do arquivo
                const conteudo = await this.lerArquivo(arquivo);
                
                // 2. Identificar tipo de SPED
                this.tipoSped = this.identificarTipoSped(conteudo);
                if (!this.tipoSped) {
                    throw new Error('Tipo de SPED não identificado');
                }
                
                this.log.push(`📋 Tipo identificado: ${this.tipoSped.nome}`);
                
                // 3. Processar linhas e extrair registros
                await this.processarLinhas(conteudo);
                
                // 4. NOVO: Extrair dados específicos por tipo
                this.extrairDadosEmpresa();
                this.extrairDadosFinanceiros();        // NOVO
                this.extrairDadosTributarios();        // NOVO
                this.extrairDadosCicloFinanceiro();    // NOVO
                
                // 5. Calcular estatísticas finais
                this.finalizarEstatisticas();
                
                return this.gerarResultadoAprimorado();
                
            } catch (erro) {
                this.log.push(`❌ Erro no parsing: ${erro.message}`);
                throw erro;
            }
        }
        
        /**
         * NOVO: Extração específica de dados financeiros
         */
        extrairDadosFinanceiros() {
            this.log.push('💰 Extraindo dados financeiros...');
            
            this.dadosFinanceiros = {
                receitaBruta: 0,
                receitaLiquida: 0,
                custoTotal: 0,
                despesasOperacionais: 0,
                lucroOperacional: 0,
                margemOperacional: 0,
                fonte: []
            };
            
            // Para ECF - Demonstrações
            if (this.tipoSped.tipo === 'ecf') {
                this.extrairDadosFinanceirosECF();
            }
            
            // Para SPED Contribuições - Receitas
            if (this.tipoSped.tipo === 'contribuicoes') {
                this.extrairReceitasContribuicoes();
            }
            
            // Para ECD - Balanço e DRE
            if (this.tipoSped.tipo === 'ecd') {
                this.extrairDadosFinanceirosECD();
            }
            
            // Calcular indicadores derivados
            this.calcularIndicadoresFinanceiros();
            
            this.log.push(`✅ Dados financeiros extraídos - Receita Bruta: R$ ${this.dadosFinanceiros.receitaBruta.toFixed(2)}`);
        }
        
        /**
         * NOVO: Extração de dados tributários detalhados
         */
        extrairDadosTributarios() {
            this.log.push('📊 Extraindo dados tributários detalhados...');
            
            this.dadosTributarios = {
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
                },
                aliquotasEfetivas: {
                    pis: 0,
                    cofins: 0,
                    icms: 0,
                    ipi: 0,
                    iss: 0,
                    total: 0
                },
                fonte: []
            };
            
            // Extrair por tipo de SPED
            switch (this.tipoSped.tipo) {
                case 'fiscal':
                    this.extrairTributariosFiscal();
                    break;
                case 'contribuicoes':
                    this.extrairTributariosContribuicoes();
                    break;
            }
            
            // Calcular alíquotas efetivas
            this.calcularAliquotasEfetivas();
            
            this.log.push(`✅ Dados tributários extraídos - Alíquota total efetiva: ${this.dadosTributarios.aliquotasEfetivas.total.toFixed(2)}%`);
        }
        
        /**
     * Extração tributária melhorada do SPED Fiscal
     */
    extrairTributariosFiscal() {
        // ICMS - Registro E110 (Apuração ICMS)
        if (this.registrosExtraidos.E110) {
            this.registrosExtraidos.E110.forEach(registro => {
                this.dadosTributarios.debitos.icms += this.converterParaNumero(registro.VL_TOT_DEBITOS);
                this.dadosTributarios.creditos.icms += this.converterParaNumero(registro.VL_TOT_CREDITOS);
            });
            this.dadosTributarios.fonte.push('SPED Fiscal - E110');
        }

        // IPI - Registro E210 (Apuração IPI)  
        if (this.registrosExtraidos.E210) {
            this.registrosExtraidos.E210.forEach(registro => {
                this.dadosTributarios.debitos.ipi += this.converterParaNumero(registro.VL_TOT_DEBITOS_IPI);
                this.dadosTributarios.creditos.ipi += this.converterParaNumero(registro.VL_TOT_CREDITOS_IPI);
            });
            this.dadosTributarios.fonte.push('SPED Fiscal - E210');
        }

        // PROCESSAR C100/C170 CORRETAMENTE
        if (this.registrosExtraidos.C100) {
            this.registrosExtraidos.C100.forEach(registro => {
                const indOperacao = registro.IND_OPER;
                const situacao = registro.COD_SIT;

                // Ignorar documentos cancelados (situação 02, 03, 04)
                if (['02', '03', '04'].includes(situacao)) return;

                // ENTRADA (IND_OPER = 0) - CRÉDITOS
                if (indOperacao === '0') {
                    this.dadosTributarios.creditos.icms += this.converterParaNumero(registro.VL_ICMS);
                    this.dadosTributarios.creditos.ipi += this.converterParaNumero(registro.VL_IPI);
                    this.dadosTributarios.creditos.pis += this.converterParaNumero(registro.VL_PIS);
                    this.dadosTributarios.creditos.cofins += this.converterParaNumero(registro.VL_COFINS);
                }
                // SAÍDA (IND_OPER = 1) - DÉBITOS
                else if (indOperacao === '1') {
                    this.dadosTributarios.debitos.pis += this.converterParaNumero(registro.VL_PIS);
                    this.dadosTributarios.debitos.cofins += this.converterParaNumero(registro.VL_COFINS);

                    // Para saídas, ICMS já está contabilizado no E110
                    // mas podemos usar para validação
                }
            });
            this.dadosTributarios.fonte.push('SPED Fiscal - C100');
        }

        // PROCESSAR C170 para detalhamento de créditos por item
        if (this.registrosExtraidos.C170) {
            this.registrosExtraidos.C170.forEach(registro => {
                // Verificar CST para determinar se há direito a crédito
                const cstPis = registro.CST_PIS;
                const cstCofins = registro.CST_COFINS;
                const cstIcms = registro.CST_ICMS;
                const cstIpi = registro.CST_IPI;

                // PIS - CSTs que geram crédito: 50-66
                if (cstPis >= '50' && cstPis <= '66') {
                    this.dadosTributarios.creditos.pis += this.converterParaNumero(registro.VL_PIS);
                }

                // COFINS - CSTs que geram crédito: 50-66
                if (cstCofins >= '50' && cstCofins <= '66') {
                    this.dadosTributarios.creditos.cofins += this.converterParaNumero(registro.VL_COFINS);
                }
            });
        }
    }

    /**
     * Extração tributária melhorada do SPED Contribuições
     */
    extrairTributariosContribuicoes() {
        // PIS - Débitos (M200, M210)
        if (this.registrosExtraidos.M200) {
            this.registrosExtraidos.M200.forEach(registro => {
                this.dadosTributarios.debitos.pis += this.converterParaNumero(registro.VL_TOT_CONT_NC_PER);
                this.dadosTributarios.debitos.pis += this.converterParaNumero(registro.VL_TOT_CONT_CUM_PER);
            });
            this.dadosTributarios.fonte.push('SPED Contribuições - M200');
        }

        // COFINS - Débitos (M600, M610)
        if (this.registrosExtraidos.M600) {
            this.registrosExtraidos.M600.forEach(registro => {
                this.dadosTributarios.debitos.cofins += this.converterParaNumero(registro.VL_TOT_CONT_NC_PER);
                this.dadosTributarios.debitos.cofins += this.converterParaNumero(registro.VL_TOT_CONT_CUM_PER);
            });
            this.dadosTributarios.fonte.push('SPED Contribuições - M600');
        }

        // CRÉDITOS - M100 (Créditos de PIS)
        if (this.registrosExtraidos.M100) {
            this.registrosExtraidos.M100.forEach(registro => {
                this.dadosTributarios.creditos.pis += this.converterParaNumero(registro.VL_CRED);
            });
            this.dadosTributarios.fonte.push('SPED Contribuições - M100');
        }

        // CRÉDITOS - M500 (Créditos de COFINS) 
        if (this.registrosExtraidos.M500) {
            this.registrosExtraidos.M500.forEach(registro => {
                this.dadosTributarios.creditos.cofins += this.converterParaNumero(registro.VL_CRED);
            });
            this.dadosTributarios.fonte.push('SPED Contribuições - M500');
        }

        // Créditos detalhados - C170
        if (this.registrosExtraidos.C170) {
            this.registrosExtraidos.C170.forEach(registro => {
                // No SPED Contribuições, C170 tem campos específicos para créditos
                if (registro.VL_CRED_PIS) {
                    this.dadosTributarios.creditos.pis += this.converterParaNumero(registro.VL_CRED_PIS);
                }
                if (registro.VL_CRED_COFINS) {
                    this.dadosTributarios.creditos.cofins += this.converterParaNumero(registro.VL_CRED_COFINS);
                }
            });
        }

        // Processar F100 - Demais Documentos e Operações
        if (this.registrosExtraidos.F100) {
            this.registrosExtraidos.F100.forEach(registro => {
                const indOperacao = registro.IND_OPER;

                // Entrada (0) - Créditos
                if (indOperacao === '0') {
                    this.dadosTributarios.creditos.pis += this.converterParaNumero(registro.VL_PIS);
                    this.dadosTributarios.creditos.cofins += this.converterParaNumero(registro.VL_COFINS);
                }
                // Saída (1) - Débitos
                else if (indOperacao === '1') {
                    this.dadosTributarios.debitos.pis += this.converterParaNumero(registro.VL_PIS);
                    this.dadosTributarios.debitos.cofins += this.converterParaNumero(registro.VL_COFINS);
                }
            });
            this.dadosTributarios.fonte.push('SPED Contribuições - F100');
        }
    }      
    
        /**
         * NOVO: Cálculo de alíquotas efetivas
         */
        calcularAliquotasEfetivas() {
            const faturamento = this.dadosFinanceiros.receitaBruta || 
                              this.dadosEmpresa.receitaBruta || 
                              this.calcularFaturamentoBase();
            
            if (faturamento > 0) {
                // Calcular alíquotas líquidas (débitos - créditos)
                const impostoLiquidoPIS = Math.max(0, this.dadosTributarios.debitos.pis - this.dadosTributarios.creditos.pis);
                const impostoLiquidoCOFINS = Math.max(0, this.dadosTributarios.debitos.cofins - this.dadosTributarios.creditos.cofins);
                const impostoLiquidoICMS = Math.max(0, this.dadosTributarios.debitos.icms - this.dadosTributarios.creditos.icms);
                const impostoLiquidoIPI = Math.max(0, this.dadosTributarios.debitos.ipi - this.dadosTributarios.creditos.ipi);
                const impostoLiquidoISS = Math.max(0, this.dadosTributarios.debitos.iss - this.dadosTributarios.creditos.iss);
                
                this.dadosTributarios.aliquotasEfetivas = {
                    pis: (impostoLiquidoPIS / faturamento) * 100,
                    cofins: (impostoLiquidoCOFINS / faturamento) * 100,
                    icms: (impostoLiquidoICMS / faturamento) * 100,
                    ipi: (impostoLiquidoIPI / faturamento) * 100,
                    iss: (impostoLiquidoISS / faturamento) * 100,
                    total: ((impostoLiquidoPIS + impostoLiquidoCOFINS + impostoLiquidoICMS + impostoLiquidoIPI + impostoLiquidoISS) / faturamento) * 100
                };
            }
        }
        
        /**
         * NOVO: Extração de dados para ciclo financeiro
         */
        extrairDadosCicloFinanceiro() {
            this.log.push('⏱️ Extraindo dados para ciclo financeiro...');
            
            this.dadosCicloFinanceiro = {
                pmr: 30,  // Prazo Médio de Recebimento
                pme: 30,  // Prazo Médio de Estoque
                pmp: 30,  // Prazo Médio de Pagamento
                estimado: true,
                fonte: []
            };
            
            // Para ECD - usar dados do balanço
            if (this.tipoSped.tipo === 'ecd') {
                this.calcularCicloFinanceiroECD();
            }
            
            // Para outros SPEDs - estimativas baseadas em volume de operações
            this.estimarCicloFinanceiro();
            
            this.log.push(`✅ Ciclo financeiro calculado - PMR: ${this.dadosCicloFinanceiro.pmr}, PME: ${this.dadosCicloFinanceiro.pme}, PMP: ${this.dadosCicloFinanceiro.pmp}`);
        }
        
        /**
         * NOVO: Cálculo de ciclo financeiro baseado no ECD
         */
        calcularCicloFinanceiroECD() {
            // Tentar calcular baseado em contas do balanço
            if (this.registrosExtraidos.J150) {
                let contasReceber = 0;
                let estoques = 0;
                let contasPagar = 0;
                let vendas = this.dadosFinanceiros.receitaBruta || 0;
                let cmv = this.dadosFinanceiros.custoTotal || 0;
                
                this.registrosExtraidos.J150.forEach(registro => {
                    const codigoConta = registro.COD_CTA;
                    const valorConta = this.converterParaNumero(registro.VL_SLD_FIN);
                    
                    // Contas a Receber (geralmente 1.1.2.x)
                    if (codigoConta.startsWith('1.1.2')) {
                        contasReceber += valorConta;
                    }
                    // Estoques (geralmente 1.1.3.x)
                    else if (codigoConta.startsWith('1.1.3')) {
                        estoques += valorConta;
                    }
                    // Contas a Pagar (geralmente 2.1.1.x)
                    else if (codigoConta.startsWith('2.1.1')) {
                        contasPagar += valorConta;
                    }
                });
                
                // Calcular prazos se houver dados suficientes
                if (vendas > 0) {
                    this.dadosCicloFinanceiro.pmr = Math.round((contasReceber / vendas) * 365);
                    this.dadosCicloFinanceiro.estimado = false;
                }
                
                if (cmv > 0) {
                    this.dadosCicloFinanceiro.pme = Math.round((estoques / cmv) * 365);
                    this.dadosCicloFinanceiro.pmp = Math.round((contasPagar / cmv) * 365);
                }
                
                this.dadosCicloFinanceiro.fonte.push('ECD - Balanço');
            }
        }
        
        /**
         * NOVO: Estimativa de ciclo baseado em volume de operações
         */
        estimarCicloFinanceiro() {
            // Lógica de estimativa baseada no porte da empresa
            const faturamento = this.dadosFinanceiros.receitaBruta || this.dadosEmpresa.receitaBruta || 0;
            const faturamentoAnual = faturamento * 12;
            
            if (faturamentoAnual > 0) {
                // Empresas maiores tendem a ter PMR menor
                if (faturamentoAnual > 100000000) { // > 100M
                    this.dadosCicloFinanceiro.pmr = 25;
                    this.dadosCicloFinanceiro.pmp = 45;
                } else if (faturamentoAnual > 50000000) { // > 50M
                    this.dadosCicloFinanceiro.pmr = 30;
                    this.dadosCicloFinanceiro.pmp = 35;
                } else {
                    this.dadosCicloFinanceiro.pmr = 35;
                    this.dadosCicloFinanceiro.pmp = 30;
                }
                
                this.dadosCicloFinanceiro.fonte.push('Estimativa baseada no porte');
            }
        }
        
        /**
         * NOVO: Geração de resultado aprimorado
         */
        gerarResultadoAprimorado() {
            const resultadoBase = this.gerarResultado();
            
            // Adicionar dados aprimorados
            return {
                ...resultadoBase,
                dadosFinanceiros: this.dadosFinanceiros,
                dadosTributarios: this.dadosTributarios,
                dadosCicloFinanceiro: this.dadosCicloFinanceiro,
                
                // Estrutura padronizada para integração
                dadosIntegracao: {
                    empresa: {
                        ...this.dadosEmpresa,
                        faturamentoMensal: this.dadosFinanceiros.receitaBruta || 0,
                        margemOperacional: this.dadosFinanceiros.margemOperacional || 0
                    },
                    
                    financeiro: {
                        receitaBruta: this.dadosFinanceiros.receitaBruta,
                        receitaLiquida: this.dadosFinanceiros.receitaLiquida,
                        custoTotal: this.dadosFinanceiros.custoTotal,
                        despesasOperacionais: this.dadosFinanceiros.despesasOperacionais,
                        lucroOperacional: this.dadosFinanceiros.lucroOperacional,
                        margemOperacional: this.dadosFinanceiros.margemOperacional
                    },
                    
                    tributario: {
                        debitos: this.dadosTributarios.debitos,
                        creditos: this.dadosTributarios.creditos,
                        aliquotasEfetivas: this.dadosTributarios.aliquotasEfetivas
                    },
                    
                    cicloFinanceiro: {
                        pmr: this.dadosCicloFinanceiro.pmr,
                        pme: this.dadosCicloFinanceiro.pme,
                        pmp: this.dadosCicloFinanceiro.pmp,
                        estimado: this.dadosCicloFinanceiro.estimado
                    }
                },
                
                // Metadados aprimorados
                metadados: {
                    ...resultadoBase.metadados,
                    versaoParser: '2.1.0-aprimorado',
                    dadosExtraidos: {
                        empresa: Object.keys(this.dadosEmpresa).length > 0,
                        financeiro: Object.keys(this.dadosFinanceiros).length > 0,
                        tributario: Object.keys(this.dadosTributarios).length > 0,
                        cicloFinanceiro: Object.keys(this.dadosCicloFinanceiro).length > 0
                    }
                }
            };
        }
        
        // Métodos auxiliares existentes mantidos...
        async lerArquivo(arquivo) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = (evento) => {
                    resolve(evento.target.result);
                };
                
                reader.onerror = () => {
                    reject(new Error('Erro ao ler arquivo'));
                };
                
                reader.readAsText(arquivo, 'UTF-8');
            });
        }
        
        identificarTipoSped(conteudo) {
            const linhas = conteudo.split(CONFIG.terminadorLinha);
            
            for (let i = 0; i < Math.min(linhas.length, 20); i++) {
                const linha = linhas[i].trim();
                if (!linha) continue;
                
                const campos = linha.split(CONFIG.separadorCampo);
                if (campos.length < 3) continue;
                
                const registro = campos[1];
                
                if (registro === '0000') {
                    const codigoFinalidade = campos[2];
                    if (codigoFinalidade === '0' || codigoFinalidade === '1') {
                        return { tipo: 'fiscal', nome: 'SPED Fiscal' };
                    }
                    if (codigoFinalidade === '2' || codigoFinalidade === '3') {
                        return { tipo: 'contribuicoes', nome: 'SPED Contribuições' };
                    }
                }
                
                if (registro === 'J001') {
                    return { tipo: 'ecf', nome: 'ECF' };
                }
                
                if (registro === 'I001') {
                    return { tipo: 'ecd', nome: 'ECD' };
                }
            }
            
            return null;
        }
        
        async processarLinhas(conteudo) {
            const linhas = conteudo.split(CONFIG.terminadorLinha);
            const totalLinhas = linhas.length;
            
            this.log.push(`📊 Processando ${totalLinhas.toLocaleString()} linhas...`);
            
            const mapeamentoRegistros = this.obterMapeamentoRegistros();
            
            for (let i = 0; i < linhas.length; i++) {
                const linha = linhas[i].trim();
                this.estatisticas.linhasProcessadas++;
                
                if (i > 0 && i % 50000 === 0) {
                    const progresso = ((i / totalLinhas) * 100).toFixed(1);
                    this.log.push(`⏳ Progresso: ${progresso}% (${i.toLocaleString()}/${totalLinhas.toLocaleString()} linhas)`);
                }
                
                if (!linha || linha.length < 5) continue;
                
                try {
                    const registro = this.processarLinha(linha, mapeamentoRegistros);
                    if (registro) {
                        this.adicionarRegistro(registro);
                        this.estatisticas.registrosValidos++;
                    }
                    this.estatisticas.registrosEncontrados++;
                    
                } catch (erro) {
                    this.estatisticas.erros.push({
                        linha: i + 1,
                        erro: erro.message,
                        conteudo: linha.substring(0, 100)
                    });
                }
            }
            
            this.log.push(`✅ Processamento concluído: ${this.estatisticas.registrosValidos.toLocaleString()} registros válidos extraídos`);
        }
        
        obterMapeamentoRegistros() {
            switch (this.tipoSped.tipo) {
                case 'fiscal':
                    return CONFIG.registrosFiscal;
                case 'contribuicoes':
                    return CONFIG.registrosContribuicoes;
                case 'ecf':
                    return CONFIG.registrosECF;
                case 'ecd':
                    return CONFIG.registrosECD;
                default:
                    return {};
            }
        }
        
        processarLinha(linha, mapeamento) {
            const campos = linha.split(CONFIG.separadorCampo);
            if (campos.length < 2) return null;
            
            const tipoRegistro = campos[1];
            const estrutura = mapeamento[tipoRegistro];
            
            if (!estrutura) return null;
            
            const registro = {
                tipo: tipoRegistro,
                linha: linha,
                dados: {}
            };
            
            for (let i = 0; i < Math.min(campos.length, estrutura.length); i++) {
                const nomeCampo = estrutura[i];
                const valorCampo = campos[i] ? campos[i].trim() : '';
                registro.dados[nomeCampo] = valorCampo;
            }
            
            return registro;
        }
        
        adicionarRegistro(registro) {
            const tipo = registro.tipo;
            
            if (!this.registrosExtraidos[tipo]) {
                this.registrosExtraidos[tipo] = [];
            }
            
            this.registrosExtraidos[tipo].push(registro.dados);
        }
        
        extrairDadosEmpresa() {
            if (this.registrosExtraidos['0000'] && this.registrosExtraidos['0000'].length > 0) {
                const reg0000 = this.registrosExtraidos['0000'][0];
                
                this.dadosEmpresa = {
                    razaoSocial: reg0000.NOME || '',
                    cnpj: reg0000.CNPJ || '',
                    uf: reg0000.UF || '',
                    inscricaoEstadual: reg0000.IE || '',
                    dataInicialPeriodo: this.formatarData(reg0000.DT_INI),
                    dataFinalPeriodo: this.formatarData(reg0000.DT_FIN),
                    codigoMunicipio: reg0000.COD_MUN || ''
                };
            }
            
            if (this.registrosExtraidos['0005'] && this.registrosExtraidos['0005'].length > 0) {
                const reg0005 = this.registrosExtraidos['0005'][0];
                
                this.dadosEmpresa.nomeFantasia = reg0005.FANTASIA || '';
                this.dadosEmpresa.endereco = reg0005.END || '';
                this.dadosEmpresa.cep = reg0005.CEP || '';
                this.dadosEmpresa.telefone = reg0005.FONE || '';
                this.dadosEmpresa.email = reg0005.EMAIL || '';
            }
            
            if (this.tipoSped.tipo === 'ecf' && this.registrosExtraidos['J001']) {
                const regJ001 = this.registrosExtraidos['J001'][0];
                if (regJ001) {
                    this.dadosEmpresa.razaoSocial = regJ001.NOME || '';
                    this.dadosEmpresa.cnpj = regJ001.CNPJ || '';
                    this.dadosEmpresa.receitaBruta = this.converterParaNumero(regJ001.VL_REC_BRT);
                }
            }
            
            this.log.push(`🏢 Dados da empresa extraídos: ${this.dadosEmpresa.razaoSocial}`);
        }
        
        extrairDadosFinanceirosECF() {
            // Implementar extração específica do ECF
            if (this.registrosExtraidos.J001) {
                const regJ001 = this.registrosExtraidos.J001[0];
                if (regJ001) {
                    this.dadosFinanceiros.receitaBruta = this.converterParaNumero(regJ001.VL_REC_BRT);
                    this.dadosFinanceiros.fonte.push('ECF - J001');
                }
            }
        }
        
        extrairReceitasContribuicoes() {
            // Somar receitas dos registros A100
            if (this.registrosExtraidos.A100) {
                this.registrosExtraidos.A100.forEach(registro => {
                    this.dadosFinanceiros.receitaBruta += this.converterParaNumero(registro.VL_DOC);
                });
                this.dadosFinanceiros.fonte.push('SPED Contribuições - A100');
            }
            
            // Somar receitas dos registros A200
            if (this.registrosExtraidos.A200) {
                this.registrosExtraidos.A200.forEach(registro => {
                    this.dadosFinanceiros.receitaBruta += this.converterParaNumero(registro.VL_REC_BRT);
                });
                this.dadosFinanceiros.fonte.push('SPED Contribuições - A200');
            }
        }
        
        extrairDadosFinanceirosECD() {
            // Implementar extração do ECD baseado no plano de contas
            if (this.registrosExtraidos.J150) {
                this.registrosExtraidos.J150.forEach(registro => {
                    const codigoConta = registro.COD_CTA;
                    const valorConta = this.converterParaNumero(registro.VL_SLD_FIN);
                    
                    // Receitas (geralmente 3.1.x)
                    if (codigoConta.startsWith('3.1')) {
                        this.dadosFinanceiros.receitaBruta += valorConta;
                    }
                    // Custos (geralmente 3.2.x)
                    else if (codigoConta.startsWith('3.2')) {
                        this.dadosFinanceiros.custoTotal += valorConta;
                    }
                    // Despesas (geralmente 3.3.x)
                    else if (codigoConta.startsWith('3.3')) {
                        this.dadosFinanceiros.despesasOperacionais += valorConta;
                    }
                });
                this.dadosFinanceiros.fonte.push('ECD - J150');
            }
        }
        
        calcularIndicadoresFinanceiros() {
            // Calcular receita líquida (assumindo 5% de deduções se não informado)
            if (this.dadosFinanceiros.receitaLiquida === 0 && this.dadosFinanceiros.receitaBruta > 0) {
                this.dadosFinanceiros.receitaLiquida = this.dadosFinanceiros.receitaBruta * 0.95;
            }
            
            // Calcular lucro operacional
            this.dadosFinanceiros.lucroOperacional = 
                this.dadosFinanceiros.receitaLiquida - 
                this.dadosFinanceiros.custoTotal - 
                this.dadosFinanceiros.despesasOperacionais;
            
            // Calcular margem operacional
            if (this.dadosFinanceiros.receitaLiquida > 0) {
                this.dadosFinanceiros.margemOperacional = 
                    (this.dadosFinanceiros.lucroOperacional / this.dadosFinanceiros.receitaLiquida) * 100;
            }
        }
        
        calcularFaturamentoBase() {
            // Tentar calcular um faturamento base para alíquotas efetivas
            let faturamento = 0;
            
            // Priorizar dados financeiros
            if (this.dadosFinanceiros.receitaBruta > 0) {
                faturamento = this.dadosFinanceiros.receitaBruta;
            }
            // Usar dados da empresa
            else if (this.dadosEmpresa.receitaBruta > 0) {
                faturamento = this.dadosEmpresa.receitaBruta;
            }
            // Estimar baseado em documentos fiscais
            else if (this.registrosExtraidos.C100) {
                this.registrosExtraidos.C100.forEach(registro => {
                    if (registro.IND_OPER === '1') { // Saídas
                        faturamento += this.converterParaNumero(registro.VL_DOC);
                    }
                });
            }
            
            return faturamento;
        }
        
        formatarData(dataStr) {
            if (!dataStr || dataStr.length !== 8) return '';
            
            const dia = dataStr.substring(0, 2);
            const mes = dataStr.substring(2, 4);
            const ano = dataStr.substring(4, 8);
            
            return `${ano}-${mes}-${dia}`;
        }
        
        converterParaNumero(valorStr) {
            if (!valorStr) return 0;
            
            const numeroLimpo = valorStr.replace(/\./g, '').replace(',', '.');
            const numero = parseFloat(numeroLimpo);
            
            return isNaN(numero) ? 0 : numero;
        }
        
        finalizarEstatisticas() {
            this.estatisticas.fimProcessamento = new Date();
            this.estatisticas.tempoProcessamento = 
                this.estatisticas.fimProcessamento - this.estatisticas.inicioProcessamento;
            
            this.estatisticas.tiposRegistroEncontrados = Object.keys(this.registrosExtraidos).length;
            this.estatisticas.registrosPorTipo = {};
            
            Object.keys(this.registrosExtraidos).forEach(tipo => {
                this.estatisticas.registrosPorTipo[tipo] = this.registrosExtraidos[tipo].length;
            });
        }
        
        gerarResultado() {
            const resultado = {
                sucesso: true,
                tipoSped: {
                    tipo: this.tipoSped.tipo,
                    nome: this.tipoSped.nome,
                    detalhes: {
                        codigo: this.tipoSped.tipo,
                        descricao: this.tipoSped.nome
                    }
                },
                dadosEmpresa: this.dadosEmpresa,
                registros: this.registrosExtraidos,
                resumo: {
                    totalTiposRegistro: this.estatisticas.tiposRegistroEncontrados,
                    registrosPorTipo: this.estatisticas.registrosPorTipo
                },
                estatisticas: {
                    linhasProcessadas: this.estatisticas.linhasProcessadas,
                    registrosEncontrados: this.estatisticas.registrosEncontrados,
                    registrosValidos: this.estatisticas.registrosValidos,
                    tempoProcessamento: this.estatisticas.tempoProcessamento,
                    erros: this.estatisticas.erros.slice(0, 50)
                },
                log: this.log,
                metadados: {
                    timestampProcessamento: new Date().toISOString(),
                    versaoParser: '2.1.0-aprimorado'
                }
            };
            
            this.log.push(`🎉 Parsing APRIMORADO concluído! ${this.estatisticas.registrosValidos} registros extraídos`);
            
            return resultado;
        }
    }
    
    /**
     * Função principal de parsing aprimorada
     */
    async function parsearArquivoSped(arquivo, opcoes = {}) {
        const parser = new SpedParserAprimorado();
        return await parser.parsearArquivo(arquivo, opcoes);
    }
    
    /**
     * Função de validação de arquivo (mantida)
     */
    function validarArquivoSped(arquivo) {
        const validacao = {
            valido: true,
            erros: [],
            avisos: []
        };
        
        if (arquivo.size === 0) {
            validacao.valido = false;
            validacao.erros.push('Arquivo vazio');
        }
        
        if (arquivo.size > CONFIG.tamanhoMaximoArquivo) {
            validacao.valido = false;
            validacao.erros.push(`Arquivo muito grande: ${(arquivo.size / 1024 / 1024).toFixed(2)}MB. Máximo: ${CONFIG.tamanhoMaximoArquivo / 1024 / 1024}MB`);
        }
        
        const extensao = arquivo.name.toLowerCase().split('.').pop();
        if (!['txt', 'sped'].includes(extensao)) {
            validacao.avisos.push(`Extensão não usual para SPED: .${extensao}`);
        }
        
        return validacao;
    }
    
    // Interface pública do módulo
    return {
        parsearArquivoSped,
        validarArquivoSped,
        CONFIG,
        SpedParserAprimorado
    };
})();