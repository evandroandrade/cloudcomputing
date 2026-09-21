// =============================================================================
// js/secure-auth.js
// Autenticação, sessão e perfil via Supabase Auth.
//
// ARQUITETURA:
//   Matrícula + Senha
//     → email técnico: <matricula>@cloud.evandroandrade.com
//     → supabaseClient.auth.signInWithPassword()
//     → JWT individual
//     → auth.uid()
//     → RLS PostgreSQL (servidor)
//     → perfil e exercícios do próprio usuário
//
// REGRAS:
//   - Nunca comparar senha no JavaScript
//   - Nunca buscar usuario.senha do banco
//   - Nunca confiar em localStorage para identidade
//   - Nunca expor service_role
//   - Sessão = supabaseClient.auth.getSession() (JWT real)
//   - usuarioGlobal = cache de UI (NÃO é prova de autenticação)
// =============================================================================

(function () {
    'use strict';

    // Domínio técnico para e-mails fictícios dos alunos
    const AUTH_EMAIL_DOMAIN = '@cloud.evandroandrade.com';

    // Campos de perfil permitidos a buscar do banco (nunca senhas)
    const PERFIL_CAMPOS = 'id, auth_user_id, matricula, nome, email, tipo_usuario, primeiro_login, desabilitado, created_at, updated_at';

    // -------------------------------------------------------------------------
    // Helper: obter cliente Supabase
    // -------------------------------------------------------------------------
    function getClient() {
        const client = window.supabaseClient;
        if (!client) {
            console.error('[secure-auth.js] supabaseClient não inicializado. ' +
                'Verifique a ordem de carregamento dos scripts.');
            return null;
        }
        return client;
    }

    // -------------------------------------------------------------------------
    // Helper: montar e-mail técnico a partir da matrícula
    // -------------------------------------------------------------------------
    function montarAuthEmail(matricula) {
        const mat = String(matricula).trim().toLowerCase();
        return `${mat}${AUTH_EMAIL_DOMAIN}`;
    }

    // =========================================================================
    // LOGIN
    // =========================================================================

    /**
     * Fazer login com matrícula e senha.
     * Internamente usa e-mail técnico determinístico.
     *
     * Fluxo:
     *   1. signInWithPassword (Supabase Auth)
     *   2. buscar perfil via RLS (auth.uid())
     *   3. verificar desabilitado
     *   4. retornar resultado
     *
     * A verificação de primeiro_login é feita pelo chamador (script.js).
     *
     * @param {string} matricula
     * @param {string} senha
     * @returns {{ success: boolean, data?: object, error?: string, code?: string }}
     */
    async function loginComMatricula(matricula, senha) {
        const client = getClient();
        if (!client) return { success: false, error: 'Sistema indisponível.', code: 'CLIENT_ERROR' };

        if (!matricula || !senha) {
            return { success: false, error: 'Preencha matrícula e senha.', code: 'VALIDATION' };
        }

        // Montar e-mail técnico
        const authEmail = montarAuthEmail(matricula);

        // 1. Autenticar no Supabase Auth
        const { error: authError } = await client.auth.signInWithPassword({
            email:    authEmail,
            password: senha
        });

        if (authError) {
            // Não revelar se a matrícula existe ou não
            console.warn('[secure-auth.js] Falha de autenticação (detalhe omitido por segurança).');
            return {
                success: false,
                error:   'Matrícula ou senha inválida.',
                code:    'AUTH_FAILED'
            };
        }

        // 2. Buscar perfil via RLS (auth.uid() já está ativo)
        const perfilResult = await buscarPerfilAtual();
        if (!perfilResult.success) {
            // Auth ok mas perfil não encontrado — situação inesperada
            await client.auth.signOut();
            return {
                success: false,
                error:   'Perfil não encontrado. Contate o professor.',
                code:    'PROFILE_NOT_FOUND'
            };
        }

        const perfil = perfilResult.data;

        // 3. Verificar se está desabilitado
        if (perfil.desabilitado === true) {
            await client.auth.signOut();
            return {
                success: false,
                error:   'Seu acesso está desabilitado. Procure o professor.',
                code:    'DISABLED'
            };
        }

        return { success: true, data: perfil };
    }

    // =========================================================================
    // LOGOUT
    // =========================================================================

    /**
     * Fazer logout: invalida sessão Auth e limpa cache de UI.
     */
    async function logoutSeguro() {
        try {
            const client = getClient();
            if (client) {
                await client.auth.signOut();
            }
        } catch (err) {
            console.warn('[secure-auth.js] Erro no signOut:', err.message);
        } finally {
            // Limpar cache de UI independentemente do resultado do signOut
            window.usuarioGlobal = null;

            // Limpar APENAS chaves legadas (não o storage do Supabase Auth)
            if (window.Security && window.Security.limparSessaoLegada) {
                window.Security.limparSessaoLegada();
            }
        }
    }

    // =========================================================================
    // SESSÃO
    // =========================================================================

    /**
     * Verificar sessão ativa.
     * Usa getSession() + getUser() para garantir que o token é válido.
     * Não confia em localStorage para identidade.
     *
     * @returns {{ autenticado: boolean, perfil?: object }}
     */
    async function verificarSessaoAtiva() {
        const client = getClient();
        if (!client) return { autenticado: false };

        try {
            // getSession retorna sessão do storage (pode estar expirada)
            const { data: { session }, error: sessaoError } = await client.auth.getSession();

            if (sessaoError || !session) {
                return { autenticado: false };
            }

            // Buscar perfil validado por RLS
            const perfilResult = await buscarPerfilAtual();
            if (!perfilResult.success || !perfilResult.data) {
                return { autenticado: false };
            }

            const perfil = perfilResult.data;

            // Usuário desabilitado: forçar logout
            if (perfil.desabilitado === true) {
                await logoutSeguro();
                return { autenticado: false, motivo: 'disabled' };
            }

            return { autenticado: true, perfil };

        } catch (err) {
            console.warn('[secure-auth.js] Erro ao verificar sessão:', err.message);
            return { autenticado: false };
        }
    }

    // =========================================================================
    // PERFIL
    // =========================================================================

    /**
     * Buscar perfil do usuário autenticado via RLS.
     * Nunca busca senha, senha_atual ou lembrete_senha.
     *
     * @returns {{ success: boolean, data?: object, error?: string }}
     */
    async function buscarPerfilAtual() {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente não inicializado.');

            // Verificar se há usuário na sessão
            const { data: { user }, error: userError } = await client.auth.getUser();
            if (userError || !user) {
                return { success: false, error: 'Não autenticado.' };
            }

            // Buscar perfil — a RLS limita à própria linha por auth.uid()
            const { data, error } = await client
                .from('usuarios')
                .select(PERFIL_CAMPOS)
                .eq('auth_user_id', user.id)
                .single();

            if (error) throw error;
            if (!data)  throw new Error('Perfil não encontrado.');

            return { success: true, data };

        } catch (err) {
            console.warn('[secure-auth.js] Erro ao buscar perfil:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Buscar perfil de um aluno específico (para uso pelo admin).
     * Requer que o chamador seja admin autenticado (RLS valida).
     *
     * @param {string} authUserId  - auth.users.id do aluno
     * @returns {{ success: boolean, data?: object, error?: string }}
     */
    async function buscarPerfilPorAuthId(authUserId) {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente não inicializado.');

            const { data, error } = await client
                .from('usuarios')
                .select(PERFIL_CAMPOS)
                .eq('auth_user_id', authUserId)
                .single();

            if (error) throw error;

            return { success: true, data };

        } catch (err) {
            console.warn('[secure-auth.js] Erro ao buscar perfil por auth_id:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Listar perfis de alunos (apenas admin autenticado).
     * RLS garante que somente admin consegue o resultado.
     *
     * @returns {{ success: boolean, data?: object[], error?: string }}
     */
    async function listarPerfisAlunos() {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente não inicializado.');

            const { data, error } = await client
                .from('usuarios')
                .select(PERFIL_CAMPOS)
                .order('nome');

            if (error) throw error;

            return { success: true, data: data || [] };

        } catch (err) {
            console.warn('[secure-auth.js] Erro ao listar perfis:', err.message);
            return { success: false, data: [], error: err.message };
        }
    }

    // =========================================================================
    // PRIMEIRO LOGIN — chamar Edge Function
    // =========================================================================

    /**
     * Completar primeiro login via Edge Function (não diretamente no cliente).
     * A Edge Function valida JWT, verifica primeiro_login=true, força da senha
     * e chama auth.admin.updateUserById com service_role no servidor.
     *
     * @param {string} novaSenha
     * @returns {{ success: boolean, error?: string }}
     */
    async function completarPrimeiroLogin(novaSenha) {
        try {
            const client = getClient();
            if (!client) throw new Error('Cliente não inicializado.');

            // Validar força da senha no client
            if (window.Security) {
                const validacao = window.Security.validarForcaSenha(novaSenha);
                if (!validacao.valida) {
                    return { success: false, error: validacao.mensagem };
                }
            } else if (novaSenha.length < 8) {
                return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
            }

            // Verificar sessão ativa
            const { data: { user }, error: userError } = await client.auth.getUser();
            if (userError || !user) {
                return { success: false, error: 'Sessão expirada. Faça login novamente.' };
            }

            // 1. Alterar senha via Supabase Auth (só altera do próprio usuário logado)
            const { error: updateError } = await client.auth.updateUser({
                password: novaSenha
            });

            if (updateError) {
                return { success: false, error: 'Erro ao alterar senha. Tente novamente.' };
            }

            // 2. Marcar primeiro_login = false no perfil
            const { error: perfilError } = await client
                .from('usuarios')
                .update({
                    primeiro_login: false,
                    updated_at: new Date().toISOString()
                })
                .eq('auth_user_id', user.id);

            if (perfilError) {
                // Senha foi trocada mas perfil não atualizou — logar warning
                console.warn('[secure-auth.js] Senha alterada mas erro ao atualizar perfil:', perfilError.message);
            }

            // 3. Buscar perfil atualizado
            const perfilResult = await buscarPerfilAtual();
            if (perfilResult.success) {
                window.usuarioGlobal = perfilResult.data;
            }

            return { success: true };

        } catch (err) {
            console.warn('[secure-auth.js] Erro no completarPrimeiroLogin.');
            return { success: false, error: 'Erro ao alterar senha. Tente novamente.' };
        }
    }

    // =========================================================================
    // VERIFICAÇÃO DE ADMIN
    // =========================================================================

    /**
     * Verificar se o usuário atual é admin (baseado no perfil do banco).
     * Nunca confiar apenas em localStorage ou variável JS.
     *
     * @returns {boolean}
     */
    function isAdmin() {
        const u = window.usuarioGlobal;
        return !!(u && u.tipo_usuario === 'admin' && u.desabilitado === false);
    }

    /**
     * Verificar e re-validar autenticação de admin no servidor.
     * Deve ser chamado na inicialização de admin.html.
     *
     * @returns {{ autenticado: boolean, perfil?: object }}
     */
    async function verificarSessaoAdmin() {
        const resultado = await verificarSessaoAtiva();

        if (!resultado.autenticado) {
            return { autenticado: false };
        }

        const perfil = resultado.perfil;

        if (perfil.tipo_usuario !== 'admin' || perfil.desabilitado === true) {
            await logoutSeguro();
            return { autenticado: false, motivo: 'not_admin' };
        }

        return { autenticado: true, perfil };
    }

    // =========================================================================
    // LISTENER DE MUDANÇA DE ESTADO DE AUTH
    // =========================================================================

    /**
     * Registrar callback para mudanças de sessão Auth.
     * Chamado quando token é renovado, usuário faz logout, etc.
     * @param {function} callback - recebe (event, session)
     */
    function onAuthStateChange(callback) {
        const client = getClient();
        if (!client) return;

        return client.auth.onAuthStateChange((event, session) => {
            // Não logar session completa (contém access_token)
            if (event === 'SIGNED_OUT') {
                window.usuarioGlobal = null;
            }
            if (typeof callback === 'function') {
                callback(event, session);
            }
        });
    }

    // =========================================================================
    // EXPORTAÇÕES
    // =========================================================================
    window.SecureAuth = {
        loginComMatricula,
        logoutSeguro,
        verificarSessaoAtiva,
        verificarSessaoAdmin,
        buscarPerfilAtual,
        buscarPerfilPorAuthId,
        listarPerfisAlunos,
        completarPrimeiroLogin,
        isAdmin,
        onAuthStateChange,
        montarAuthEmail     // exposto apenas para debug em dev
    };

    // Aliases diretos para compatibilidade com chamadas existentes em script.js
    window.loginComMatricula      = loginComMatricula;
    window.logoutSeguro           = logoutSeguro;
    window.verificarSessaoAtiva   = verificarSessaoAtiva;
    window.verificarSessaoAdmin   = verificarSessaoAdmin;
    window.buscarPerfilAtual      = buscarPerfilAtual;
    window.completarPrimeiroLogin = completarPrimeiroLogin;
    window.isAdmin                = isAdmin;

}());
