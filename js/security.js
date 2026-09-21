// =============================================================================
// js/security.js
// Utilitários de segurança de UI — sem senhas, sem comparações de credenciais.
//
// Responsabilidades:
//   - Sanitização de inputs antes de exibição no DOM
//   - Mensagens de erro/sucesso genéricas
//   - Detecção de ambiente (HTTPS, modo seguro)
//   - Rate limiting de tentativas de login (client-side, apenas UX)
//   - Helpers para validação de força de senha
//   - NÃO contém lógica de autenticação (isso fica em js/secure-auth.js)
//   - NÃO armazena nem compara senhas
// =============================================================================

(function () {
    'use strict';

    // =========================================================================
    // 1. SANITIZAÇÃO DE OUTPUT (prevenir XSS no DOM)
    // =========================================================================

    /**
     * Escapar HTML para exibição segura no DOM.
     * Usar sempre que inserir texto de origem externa via innerHTML.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Sanitizar texto para uso em atributos HTML (ex: value, title).
     * @param {string} str
     * @returns {string}
     */
    function sanitizeAttr(str) {
        if (!str) return '';
        return String(str).replace(/[<>"'`=\/]/g, '');
    }

    // =========================================================================
    // 2. VALIDAÇÃO DE FORÇA DE SENHA
    // =========================================================================

    /**
     * Verificar força mínima da senha.
     * Mínimo: 8 caracteres.
     * Recomendado: letras + números.
     *
     * @param {string} senha
     * @returns {{ valida: boolean, mensagem: string, forca: 'fraca'|'media'|'forte' }}
     */
    function validarForcaSenha(senha) {
        if (!senha || senha.length < 8) {
            return {
                valida:   false,
                mensagem: 'A senha deve ter pelo menos 8 caracteres.',
                forca:    'fraca'
            };
        }

        const temLetra  = /[a-zA-Z]/.test(senha);
        const temNumero = /[0-9]/.test(senha);
        const temEspecial = /[^a-zA-Z0-9]/.test(senha);

        if (!temLetra || !temNumero) {
            return {
                valida:   false,
                mensagem: 'A senha deve conter letras e números.',
                forca:    'fraca'
            };
        }

        if (senha.length >= 12 && temEspecial) {
            return { valida: true, mensagem: 'Senha forte.', forca: 'forte' };
        }

        return { valida: true, mensagem: 'Senha válida.', forca: 'media' };
    }

    /**
     * Verificar se a nova senha é diferente da senha atual (comparação por identidade).
     * NÃO receber a senha atual do banco — receber apenas flag/indicador.
     * @param {string} novaSenha
     * @param {string} senhaAtualDigitada  - o que o usuário digitou como "atual" (opcional)
     * @returns {boolean}
     */
    function senhasDiferentes(novaSenha, senhaAtualDigitada) {
        if (!senhaAtualDigitada) return true;
        return novaSenha !== senhaAtualDigitada;
    }

    // =========================================================================
    // 3. RATE LIMITING CLIENT-SIDE (apenas UX — não é segurança real)
    // =========================================================================

    const RATE_LIMIT_KEY      = 'cc_login_attempts';
    const RATE_LIMIT_MAX      = 5;       // tentativas
    const RATE_LIMIT_WINDOW   = 5 * 60 * 1000; // 5 minutos em ms
    const RATE_LIMIT_LOCKOUT  = 2 * 60 * 1000; // 2 minutos de bloqueio

    /**
     * Registrar uma tentativa de login falha.
     * @returns {{ bloqueado: boolean, tentativas: number, desbloqueiaEm?: Date }}
     */
    function registrarTentativaLogin() {
        try {
            const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
            const dados = raw ? JSON.parse(raw) : { tentativas: 0, primeiraEm: Date.now(), bloqueadoEm: null };

            const agora = Date.now();

            // Resetar janela se passaram mais de RATE_LIMIT_WINDOW
            if (agora - dados.primeiraEm > RATE_LIMIT_WINDOW) {
                dados.tentativas  = 0;
                dados.primeiraEm  = agora;
                dados.bloqueadoEm = null;
            }

            dados.tentativas++;

            if (dados.tentativas >= RATE_LIMIT_MAX) {
                dados.bloqueadoEm = agora;
            }

            sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(dados));

            if (dados.bloqueadoEm) {
                const desbloqueiaEm = new Date(dados.bloqueadoEm + RATE_LIMIT_LOCKOUT);
                return { bloqueado: true, tentativas: dados.tentativas, desbloqueiaEm };
            }

            return { bloqueado: false, tentativas: dados.tentativas };

        } catch {
            return { bloqueado: false, tentativas: 1 };
        }
    }

    /**
     * Verificar se o login está bloqueado por rate limit.
     * @returns {{ bloqueado: boolean, desbloqueiaEm?: Date }}
     */
    function verificarRateLimit() {
        try {
            const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
            if (!raw) return { bloqueado: false };

            const dados = JSON.parse(raw);
            if (!dados.bloqueadoEm) return { bloqueado: false };

            const agora = Date.now();
            const desbloqueiaEm = dados.bloqueadoEm + RATE_LIMIT_LOCKOUT;

            if (agora >= desbloqueiaEm) {
                // Período expirou
                sessionStorage.removeItem(RATE_LIMIT_KEY);
                return { bloqueado: false };
            }

            return { bloqueado: true, desbloqueiaEm: new Date(desbloqueiaEm) };

        } catch {
            return { bloqueado: false };
        }
    }

    /**
     * Limpar contador de rate limit (após login bem-sucedido).
     */
    function limparRateLimit() {
        try {
            sessionStorage.removeItem(RATE_LIMIT_KEY);
        } catch { /* silencioso */ }
    }

    // =========================================================================
    // 4. DETECÇÃO DE AMBIENTE
    // =========================================================================

    /**
     * Verificar se estamos em contexto seguro (HTTPS ou localhost).
     * @returns {boolean}
     */
    function isContextoSeguro() {
        return window.isSecureContext ||
               location.protocol === 'https:' ||
               location.hostname  === 'localhost' ||
               location.hostname  === '127.0.0.1';
    }

    /**
     * Emitir aviso se não estiver em HTTPS (apenas dev/staging).
     */
    function verificarAmbiente() {
        if (!isContextoSeguro()) {
            console.warn(
                '[security.js] ATENÇÃO: aplicação rodando em HTTP. ' +
                'Credenciais transmitidas podem estar em risco. ' +
                'Use HTTPS em produção.'
            );
        }
    }

    // =========================================================================
    // 5. MENSAGENS DE UI (centralizadas, sem dados sensíveis)
    // =========================================================================

    /**
     * Mostrar mensagem de erro genérica ao usuário.
     * Nunca expor detalhes técnicos internos.
     * @param {string} mensagem - mensagem para o usuário
     */
    function mostrarErroSeguro(mensagem) {
        // Tentar usar showErrorMessage se disponível (definida em script.js)
        if (typeof window.showErrorMessage === 'function') {
            window.showErrorMessage(escapeHtml(mensagem));
            return;
        }
        // Fallback: console apenas
        console.warn('[security.js] Erro UI:', mensagem);
    }

    /**
     * Mostrar mensagem de sucesso ao usuário.
     * @param {string} mensagem
     */
    function mostrarSucessoSeguro(mensagem) {
        if (typeof window.showSuccessMessage === 'function') {
            window.showSuccessMessage(escapeHtml(mensagem));
            return;
        }
        console.info('[security.js] Sucesso UI:', mensagem);
    }

    // =========================================================================
    // 6. LIMPAR DADOS SENSÍVEIS DA MEMÓRIA
    // =========================================================================

    /**
     * Limpar qualquer campo de senha do DOM (por segurança após submit).
     * @param {string[]} ids - IDs dos inputs a limpar
     */
    function limparCamposSenha(...ids) {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.type === 'password') {
                el.value = '';
            }
        });
    }

    /**
     * Limpar localStorage de dados legados de sessão insegura.
     * Chamado no logout e no boot da aplicação.
     */
    function limparSessaoLegada() {
        const chavesLegadas = [
            'sessao_global',
            'admin_session',
            'usuario_logado',
            'cc_user'
        ];
        chavesLegadas.forEach(chave => {
            try {
                localStorage.removeItem(chave);
            } catch { /* silencioso */ }
        });
    }

    // =========================================================================
    // 7. CONTENT SECURITY HELPERS
    // =========================================================================

    /**
     * Verificar se uma string parece ser um JWT (apenas formato, não valida assinatura).
     * Nunca processar JWT no frontend — apenas verificar se existe.
     * @param {string} str
     * @returns {boolean}
     */
    function pareceJWT(str) {
        if (!str || typeof str !== 'string') return false;
        const partes = str.split('.');
        return partes.length === 3 && partes.every(p => p.length > 0);
    }

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================

    verificarAmbiente();

    // Limpar sessões legadas no boot (primeiro acesso após migração)
    // Feito de forma não-destrutiva: somente chaves específicas
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Verificar e limpar somente se não há sessão Supabase ativa
            // (será reavaliado pelo secure-auth.js após inicialização do cliente)
        });
    }

    // =========================================================================
    // EXPORTAÇÕES
    // =========================================================================
    window.Security = {
        escapeHtml,
        sanitizeAttr,
        validarForcaSenha,
        senhasDiferentes,
        registrarTentativaLogin,
        verificarRateLimit,
        limparRateLimit,
        isContextoSeguro,
        mostrarErroSeguro,
        mostrarSucessoSeguro,
        limparCamposSenha,
        limparSessaoLegada,
        pareceJWT
    };

    // Aliases diretos para compatibilidade com chamadas existentes
    window.escapeHtml          = escapeHtml;
    window.validarForcaSenha   = validarForcaSenha;
    window.limparSessaoLegada  = limparSessaoLegada;

}());
