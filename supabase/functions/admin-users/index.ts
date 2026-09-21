// =============================================================================
// supabase/functions/admin-users/index.ts
// Edge Function: Gerenciamento administrativo de usuários.
//
// AÇÕES SUPORTADAS:
//   create          — criar novo aluno no Auth + public.usuarios
//   reset_password  — redefinir senha temporária para a matrícula
//   set_disabled    — habilitar/desabilitar aluno
//   update_profile  — alterar nome e email
//
// SEGURANÇA:
//   1. Valida JWT do caller
//   2. Verifica que caller é admin ativo no banco
//   3. Só então usa service_role para as operações
//   4. Nunca aceita tipo_usuario ou auth_user_id do body
//   5. Nunca loga senhas
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const AUTH_EMAIL_DOMAIN = '@cloud.evandroandrade.com';

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
            status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 1. Validar JWT do caller
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Token ausente.' }), {
            status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
    const accessToken = authHeader.replace('Bearer ', '');

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

    const callerAuthId = user.id;

    // -------------------------------------------------------------------------
    // 2. Verificar que caller é admin ativo (service_role para leitura segura)
    // -------------------------------------------------------------------------
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: adminPerfil, error: adminError } = await supabaseAdmin
        .from('usuarios')
        .select('id, tipo_usuario, desabilitado')
        .eq('auth_user_id', callerAuthId)
        .single();

    if (adminError || !adminPerfil) {
        return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), {
            status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    if (adminPerfil.tipo_usuario !== 'admin' || adminPerfil.desabilitado === true) {
        return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
            status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // -------------------------------------------------------------------------
    // 3. Parsear corpo
    // -------------------------------------------------------------------------
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Corpo inválido.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    const action = String(body.action || '');

    // =========================================================================
    // AÇÃO: create — Criar novo aluno
    // =========================================================================
    if (action === 'create') {
        const nome      = String(body.nome || '').trim();
        const matricula = String(body.matricula || '').trim();
        const email     = body.email ? String(body.email).trim() : null;

        if (!nome || !matricula) {
            return new Response(JSON.stringify({ error: 'Nome e matrícula são obrigatórios.' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Validar matrícula
        if (!/^[0-9A-Za-z]+$/.test(matricula)) {
            return new Response(JSON.stringify({ error: 'Matrícula deve conter apenas letras e números.' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const authEmail    = `${matricula.toLowerCase()}${AUTH_EMAIL_DOMAIN}`;
        const senhaTemp    = matricula; // Senha temporária = matrícula
        // senhaTemp NÃO é logada

        // Criar ou localizar Auth user
        let authUserId: string;
        try {
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email:              authEmail,
                password:           senhaTemp,
                email_confirm:      true,
                user_metadata:      { nome, matricula }
            });

            if (createError) {
                // Pode já existir — tentar buscar por email
                if (createError.message?.includes('already') || createError.status === 422) {
                    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                    const existing = listData?.users?.find((u: { email: string }) => u.email === authEmail);
                    if (!existing) throw createError;
                    authUserId = existing.id;
                } else {
                    throw createError;
                }
            } else {
                authUserId = newUser.user.id;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return new Response(JSON.stringify({ error: `Erro ao criar conta Auth: ${msg}` }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Criar/atualizar perfil em public.usuarios
        const { error: upsertError } = await supabaseAdmin
            .from('usuarios')
            .upsert({
                matricula,
                nome,
                email:         email || null,
                tipo_usuario:  'aluno',
                primeiro_login: true,
                desabilitado:  false,
                auth_user_id:  authUserId,
                updated_at:    new Date().toISOString()
            }, { onConflict: 'matricula' });

        if (upsertError) {
            return new Response(JSON.stringify({ error: `Erro ao criar perfil: ${upsertError.message}` }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            data: { matricula, nome, auth_user_id: authUserId }
            // Não retornar senhaTemp
        }), { status: 201, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // =========================================================================
    // AÇÃO: reset_password — Redefinir senha temporária
    // =========================================================================
    if (action === 'reset_password') {
        const matricula = String(body.matricula || '').trim();
        if (!matricula) {
            return new Response(JSON.stringify({ error: 'Matrícula é obrigatória.' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Buscar auth_user_id pelo perfil
        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('usuarios')
            .select('auth_user_id, nome')
            .eq('matricula', matricula)
            .single();

        if (perfilError || !perfil?.auth_user_id) {
            return new Response(JSON.stringify({ error: 'Aluno não encontrado.' }), {
                status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const novaSenhaTemp = matricula; // Senha temp = matrícula (não logada)

        const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
            perfil.auth_user_id,
            { password: novaSenhaTemp }
        );

        if (resetError) {
            return new Response(JSON.stringify({ error: `Erro ao redefinir senha: ${resetError.message}` }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Marcar primeiro_login=true
        await supabaseAdmin
            .from('usuarios')
            .update({ primeiro_login: true, updated_at: new Date().toISOString() })
            .eq('auth_user_id', perfil.auth_user_id);

        return new Response(JSON.stringify({
            success: true,
            message: `Senha temporária redefinida para a matrícula. O aluno deverá alterar no próximo acesso.`
        }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // =========================================================================
    // AÇÃO: set_disabled — Habilitar/desabilitar aluno
    // =========================================================================
    if (action === 'set_disabled') {
        const targetAuthId  = String(body.auth_user_id || '').trim();
        const desabilitado  = Boolean(body.desabilitado);

        if (!targetAuthId) {
            return new Response(JSON.stringify({ error: 'auth_user_id é obrigatório.' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        // Impedir admin de se auto-desabilitar
        if (targetAuthId === callerAuthId) {
            return new Response(JSON.stringify({ error: 'Você não pode desabilitar sua própria conta.' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const { error: updateError } = await supabaseAdmin
            .from('usuarios')
            .update({ desabilitado, updated_at: new Date().toISOString() })
            .eq('auth_user_id', targetAuthId);

        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: desabilitado ? 'Aluno desabilitado.' : 'Aluno reativado.'
        }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // =========================================================================
    // AÇÃO: update_profile — Atualizar nome e email
    // =========================================================================
    if (action === 'update_profile') {
        const targetAuthId = String(body.auth_user_id || '').trim();
        const nome         = body.nome  ? String(body.nome).trim()  : null;
        const email        = body.email ? String(body.email).trim() : null;

        if (!targetAuthId) {
            return new Response(JSON.stringify({ error: 'auth_user_id é obrigatório.' }), {
                status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (nome)  updates.nome  = nome;
        if (email !== null) updates.email = email;

        const { error: updateError } = await supabaseAdmin
            .from('usuarios')
            .update(updates)
            .eq('auth_user_id', targetAuthId);

        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, message: 'Perfil atualizado.' }), {
            status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // Ação desconhecida
    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
});
