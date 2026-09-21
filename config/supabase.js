// =============================================================================
// config/supabase.js
// Cliente Supabase JS v2 + funções de acesso a dados.
//
// REGRAS DE SEGURANÇA:
//   - Apenas a ANON (publishable) key fica aqui. Segura para o frontend.
//   - service_role NUNCA aparece neste arquivo.
//   - Nenhuma senha é logada, comparada ou armazenada neste arquivo.
//   - Todas as consultas dependem do JWT da sessão Auth para autorização.
//   - A RLS PostgreSQL é a única barreira de autorização confiável.
// =============================================================================

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // CONFIGURAÇÃO — apenas a chave pública (anon/publishable)
    // -------------------------------------------------------------------------
    const SUPABASE_URL     = 'https://hsbpuvqwvsnhznymulsr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzYnB1dnF3dnNuaHpueW11bHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NjIzMzIsImV4cCI6MjA3MTUzODMzMn0.GpFMCp9qQYRy-FGgG-rmT8akPxjXLQB0pJhykZHjS78';

    // -------------------------------------------------------------------------
    // Aguardar a biblioteca Supabase JS v2 estar disponível
    // -------------------------------------------------------------------------
    function criarCliente() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.error('[supabase.js] Biblioteca @supabase/supabase-js v2 não encontrada. ' +
                'Verifique se o CDN está carregado antes deste script.');
            return null;
        }

        // Evitar criar múltiplos clientes se já existir
        if (window.supabaseClient) {
            return window.supabaseClient;
        }

        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession:      true,
                autoRefreshToken:    true,
                detectSessionInUrl:  true,
                storageKey:          'cc_auth_session'   // chave específica, não colide
            }
        });

        // Expor como window.supabaseClient — nome inequívoco, não colide com window.supabase (namespace da lib)
        window.supabaseClient = client;
        return client;
    }

    // -------------------------------------------------------------------------
    // Obter cliente (lazy init com fallback de retry)
    // -------------------------------------------------------------------------
    function getClient() {
        if (window.supabaseClient) return window.supabaseClient;
        return criarCliente();
    }

    // =========================================================================
    // ACESSO A DADOS — exercicios
    // Todas as funções dependem do JWT do usuário autenticado.
    // A RLS aplica a restrição de linha automaticamente.
    // =========================================================================

    /**
     * Salvar exercício (INSERT).
     * auth_user_id é obtido da sessão no banco via DEFAULT auth.uid()
     * ou deve ser passado explicitamente como auth.uid() do usuário atual.
     *
     * @param {object} exercicioData  - dados do formulário (sem senha, sem matricula como auth)
     * @returns {{ success: boolean, data?: object, error?: string }}
     */
    async function salvarExercicioSupabase(exercicioData) {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente Supabase não inicializado.');

            // Obter auth_user_id da sessão — nunca do frontend
            const { data: { user }, error: userError } = await client.auth.getUser();
            if (userError || !user) throw new Error('Usuário não autenticado.');

            const dadosLimpos = prepararDadosParaSupabase(exercicioData);

            // auth_user_id vem da sessão, não do formulário
            dadosLimpos.auth_user_id = user.id;
            dadosLimpos.created_at   = new Date().toISOString();
            dadosLimpos.updated_at   = new Date().toISOString();

            // Remover campos legados de autenticação se existirem no payload
            delete dadosLimpos.senha;
            delete dadosLimpos.senha_atual;
            delete dadosLimpos.lembrete_senha;

            const { data, error } = await client
                .from('exercicios')
                .insert(dadosLimpos)
                .select('id, exercicio_id, created_at')
                .single();

            if (error) throw error;

            return { success: true, data };

        } catch (error) {
            // Não logar dados do usuário — apenas mensagem técnica
            console.error('[supabase.js] Erro ao salvar exercício:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Atualizar exercício existente (UPDATE).
     * A RLS garante que somente o próprio dono pode atualizar.
     * created_at NUNCA é sobrescrito.
     *
     * @param {number|string} registroId  - PK do registro em public.exercicios
     * @param {object} exercicioData      - campos a atualizar
     */
    async function atualizarExercicioSupabase(registroId, exercicioData) {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente Supabase não inicializado.');

            const dadosLimpos = prepararDadosParaSupabase(exercicioData);

            // Nunca sobrescrever created_at em UPDATE
            delete dadosLimpos.created_at;
            delete dadosLimpos.auth_user_id;   // RLS protege, não aceitar do form
            delete dadosLimpos.senha;
            delete dadosLimpos.senha_atual;
            delete dadosLimpos.lembrete_senha;

            dadosLimpos.updated_at = new Date().toISOString();

            const { data, error } = await client
                .from('exercicios')
                .update(dadosLimpos)
                .eq('id', registroId)
                .select('id, exercicio_id, updated_at')
                .single();

            if (error) throw error;

            return { success: true, data };

        } catch (error) {
            console.error('[supabase.js] Erro ao atualizar exercício:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Buscar exercício específico do usuário logado pelo exercicio_id.
     * Não recebe matrícula — a RLS identifica o aluno pelo auth.uid().
     *
     * @param {number} exercicioId  - ID do exercício (1..10)
     * @returns {{ success: boolean, data?: object|null, error?: string }}
     */
    async function buscarExercicioPorUsuario(exercicioId) {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente Supabase não inicializado.');

            const { data, error } = await client
                .from('exercicios')
                .select('*')
                .eq('exercicio_id', exercicioId)
                .maybeSingle();

            if (error) throw error;

            return { success: true, data: data || null };

        } catch (error) {
            console.error('[supabase.js] Erro ao buscar exercício:', error.message);
            return { success: false, data: null, error: error.message };
        }
    }

    /**
     * Listar todos os exercícios do aluno logado (UMA consulta).
     * RLS retorna somente as linhas do próprio usuário.
     *
     * @returns {{ success: boolean, data?: object[], error?: string }}
     */
    async function listarExerciciosAluno() {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente Supabase não inicializado.');

            const { data, error } = await client
                .from('exercicios')
                .select('id, exercicio_id, nome, matricula, plataforma, created_at, updated_at')
                .order('exercicio_id');

            if (error) throw error;

            return { success: true, data: data || [] };

        } catch (error) {
            console.error('[supabase.js] Erro ao listar exercícios:', error.message);
            return { success: false, data: [], error: error.message };
        }
    }

    /**
     * Listar todas as respostas (para o painel admin).
     * Requer que o caller seja admin autenticado — RLS admin garante isso.
     *
     * @returns {{ success: boolean, data?: object[], error?: string }}
     */
    async function listarTodasRespostas() {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente Supabase não inicializado.');

            const { data, error } = await client
                .from('exercicios')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return { success: true, data: data || [] };

        } catch (error) {
            console.error('[supabase.js] Erro ao listar todas as respostas:', error.message);
            return { success: false, data: [], error: error.message };
        }
    }

    /**
     * Buscar exercício por PK (id da linha).
     * @param {number} id  - PK da linha em public.exercicios
     */
    async function buscarExercicioSupabase(id) {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente Supabase não inicializado.');

            const { data, error } = await client
                .from('exercicios')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;

            return { success: true, data: data || null };

        } catch (error) {
            console.error('[supabase.js] Erro ao buscar exercício por id:', error.message);
            return { success: false, data: null, error: error.message };
        }
    }

    /**
     * Testar se o cliente está conectado e o usuário autenticado.
     */
    async function testarConexaoSupabase() {
        try {
            const client = getClient();
            if (!client) return { success: false, message: 'Cliente não inicializado' };

            const { error } = await client
                .from('exercicios')
                .select('id')
                .limit(1);

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = no rows, não é erro real
                throw error;
            }

            return { success: true, message: 'Conexão OK' };

        } catch (error) {
            console.error('[supabase.js] Erro de conexão:', error.message);
            return { success: false, message: error.message };
        }
    }

    // =========================================================================
    // UTILITÁRIOS INTERNOS
    // =========================================================================

    /**
     * Validar dados obrigatórios do exercício.
     * @param {object} data
     * @returns {{ valido: boolean, erro?: string }}
     */
    function validarDadosExercicio(data) {
        const camposObrigatorios = [
            'exercicio_id', 'nome', 'matricula',
            'plataforma', 'objetivo', 'passos',
            'resultado', 'dificuldades', 'aprendizado'
        ];

        const camposFaltando = camposObrigatorios.filter(c =>
            !data[c] || String(data[c]).trim() === ''
        );

        if (camposFaltando.length > 0) {
            return { valido: false, erro: `Campos obrigatórios faltando: ${camposFaltando.join(', ')}` };
        }

        const eid = parseInt(data.exercicio_id, 10);
        if (isNaN(eid) || eid < 1 || eid > 10) {
            return { valido: false, erro: 'ID do exercício deve ser um número entre 1 e 10.' };
        }

        return { valido: true };
    }

    /**
     * Limpar e preparar dados para persistência.
     * Remove campos proibidos. Não modifica campos de auth.
     * @param {object} data
     * @returns {object}
     */
    function prepararDadosParaSupabase(data) {
        const camposPermitidos = [
            'exercicio_id', 'nome', 'matricula', 'plataforma',
            'objetivo', 'passos', 'resultado', 'dificuldades', 'aprendizado',
            // Campos específicos por exercício
            'vpc_config', 'subnets', 'security', 'routing', 'connectivity',
            'instance_planning', 'storage_config', 'security_access', 'network_setup', 'monitoring_costs',
            'database_config', 'backup_strategy', 'high_availability',
            'load_balancer_config', 'health_checks', 'traffic_distribution',
            'auto_scaling_config', 'scaling_policies', 'metrics_config',
            'iam_config', 'encryption_config', 'access_control',
            'monitoring_config', 'alerting_config', 'log_management',
            'container_architecture', 'pipeline_planning', 'image_strategy', 'container_networking',
            'pipeline_config', 'container_config', 'deployment_strategy',
            'container_monitoring', 'container_security', 'container_cost_optimization',
            'backup_config', 'backup_types', 'backup_storage', 'retention_policy',
            'disaster_recovery_config', 'high_availability_dr', 'data_replication',
            'failover_strategy', 'replication_strategy', 'backup_testing', 'dr_documentation',
            'architecture_diagram', 'cost_analysis', 'security_assessment',
            'performance_metrics', 'compliance_checklist'
        ];

        const dadosLimpos = {};

        camposPermitidos.forEach(campo => {
            if (campo in data) {
                const valor = data[campo] !== null && data[campo] !== undefined
                    ? String(data[campo]).trim()
                    : '';
                dadosLimpos[campo] = valor;
            }
        });

        // Garantir defaults para campos obrigatórios
        const defaults = {
            nome:          'Nome não informado',
            matricula:     'Matrícula não informada',
            plataforma:    'Plataforma não informada',
            objetivo:      'Objetivo não informado',
            passos:        'Passos não informados',
            resultado:     'Resultado não informado',
            dificuldades:  'Dificuldades não informadas',
            aprendizado:   'Aprendizado não informado'
        };

        Object.entries(defaults).forEach(([k, v]) => {
            if (!dadosLimpos[k]) dadosLimpos[k] = v;
        });

        return dadosLimpos;
    }

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================

    // Criar cliente imediatamente se a lib já estiver carregada
    criarCliente();

    // =========================================================================
    // EXPORTAÇÕES PARA window
    // =========================================================================
    window.salvarExercicioSupabase       = salvarExercicioSupabase;
    window.atualizarExercicioSupabase    = atualizarExercicioSupabase;
    window.buscarExercicioSupabase       = buscarExercicioSupabase;
    window.buscarExercicioPorUsuario     = buscarExercicioPorUsuario;
    window.listarExerciciosAluno         = listarExerciciosAluno;
    window.listarTodasRespostas          = listarTodasRespostas;
    window.testarConexaoSupabase         = testarConexaoSupabase;
    window.validarDadosExercicio         = validarDadosExercicio;

    // Expor URL para uso por outros módulos (somente URL, nunca a key de service_role)
    window.SUPABASE_URL = SUPABASE_URL;

    // ATENÇÃO: window.SUPABASE_ANON_KEY NÃO é mais exportada para evitar
    // que outros scripts façam chamadas raw com ela.
    // Use sempre window.supabaseClient.

}());
