// =============================================================================
// supabase/functions/complete-first-login/index.ts
// Edge Function: Completar primeiro login — trocar senha obrigatória.
//
// SEGURANÇA:
//   - Valida JWT do caller (auth.uid() real, não vindo do browser)
//   - Verifica que primeiro_login=true e desabilitado=false no banco
//   - Valida força mínima da nova senha
//   - Usa service_role SOMENTE aqui dentro (nunca exposto ao frontend)
//   - Nunca aceita user_id vindo no corpo da requisição
//   - Nunca altera senha de outro usuário
//   - Nunca loga a novaSenha
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
            status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 1. Validar JWT — obter caller auth.uid()
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Token de autenticação ausente.' }), {
            status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
    const accessToken = authHeader.replace('Bearer ', '');

    // Cliente com o JWT do usuário (para identificar o caller)
    const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
            status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    const callerAuthId = user.id; // auth.uid() real

    // -------------------------------------------------------------------------
    // 2. Obter novaSenha do corpo — NUNCA logar
    // -------------------------------------------------------------------------
    let novaSenha: string;
    try {
        const body = await req.json();
        novaSenha = body.novaSenha;
    } catch {
        return new Response(JSON.stringify({ error: 'Corpo da requisição inválido.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    if (!novaSenha || typeof novaSenha !== 'string') {
        return new Response(JSON.stringify({ error: 'Campo novaSenha é obrigatório.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 3. Validar força mínima da senha (servidor)
    // -------------------------------------------------------------------------
    if (novaSenha.length < 8) {
        return new Response(JSON.stringify({ error: 'A senha deve ter pelo menos 8 caracteres.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    const temLetra  = /[a-zA-Z]/.test(novaSenha);
    const temNumero = /[0-9]/.test(novaSenha);
    if (!temLetra || !temNumero) {
        return new Response(JSON.stringify({ error: 'A senha deve conter letras e números.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 4. Verificar perfil no banco via service_role
    // -------------------------------------------------------------------------
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: perfil, error: perfilError } = await supabaseAdmin
        .from('usuarios')
        .select('id, matricula, nome, auth_user_id, primeiro_login, desabilitado')
        .eq('auth_user_id', callerAuthId)
        .single();

    if (perfilError || !perfil) {
        return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), {
            status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    if (perfil.desabilitado === true) {
        return new Response(JSON.stringify({ error: 'Conta desabilitada.' }), {
            status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    if (perfil.primeiro_login !== true) {
        return new Response(JSON.stringify({ error: 'Primeiro login já foi concluído.' }), {
            status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 5. Alterar senha via Auth Admin API (service_role)
    // -------------------------------------------------------------------------
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        callerAuthId,
        { password: novaSenha }
        // novaSenha NÃO é logada
    );

    if (updateAuthError) {
        console.error('[complete-first-login] Erro ao atualizar Auth:', updateAuthError.message);
        return new Response(JSON.stringify({ error: 'Erro ao alterar senha. Tente novamente.' }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 6. Marcar primeiro_login=false no perfil
    // -------------------------------------------------------------------------
    const { error: updatePerfilError } = await supabaseAdmin
        .from('usuarios')
        .update({
            primeiro_login: false,
            updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', callerAuthId);

    if (updatePerfilError) {
        console.error('[complete-first-login] Erro ao atualizar perfil:', updatePerfilError.message);
        // Auth foi atualizado mas perfil falhou — retornar erro
        return new Response(JSON.stringify({ error: 'Senha alterada mas perfil não atualizado. Contate o suporte.' }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 7. Sucesso — não retornar dados sensíveis
    // -------------------------------------------------------------------------
    return new Response(JSON.stringify({ success: true, message: 'Senha definida com sucesso.' }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
});
