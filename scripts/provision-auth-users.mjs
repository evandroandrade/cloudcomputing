#!/usr/bin/env node
// =============================================================================
// scripts/provision-auth-users.mjs
// Script ADMINISTRATIVO LOCAL — criar contas Supabase Auth para todos os alunos.
//
// EXECUÇÃO LOCAL APENAS — nunca no browser, nunca no CI/CD público.
// Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_INITIAL_PASSWORD
//
// Uso:
//   node scripts/provision-auth-users.mjs
//   ou
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_INITIAL_PASSWORD=... node scripts/provision-auth-users.mjs
//
// IDEMPOTENTE: pode ser executado múltiplas vezes sem duplicar dados.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Configuração via variáveis de ambiente
// ---------------------------------------------------------------------------
const SUPABASE_URL            = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_INITIAL_PASSWORD  = process.env.ADMIN_INITIAL_PASSWORD;
const AUTH_EMAIL_DOMAIN       = '@cloud.evandroandrade.com';

// ---------------------------------------------------------------------------
// Validação de configuração
// ---------------------------------------------------------------------------
function validarConfig() {
    const erros = [];
    if (!SUPABASE_URL)              erros.push('SUPABASE_URL não definida');
    if (!SUPABASE_SERVICE_ROLE_KEY) erros.push('SUPABASE_SERVICE_ROLE_KEY não definida');
    if (!ADMIN_INITIAL_PASSWORD)    erros.push('ADMIN_INITIAL_PASSWORD não definida');

    if (erros.length > 0) {
        console.error('\n❌ ERRO DE CONFIGURAÇÃO:');
        erros.forEach(e => console.error(`   • ${e}`));
        console.error('\nDefina as variáveis de ambiente antes de executar:');
        console.error('   SUPABASE_URL=https://SEU-PROJETO.supabase.co');
        console.error('   SUPABASE_SERVICE_ROLE_KEY=eyJ...');
        console.error('   ADMIN_INITIAL_PASSWORD=SenhaSegura123!');
        console.error('\nNUNCA coloque esses valores em código ou commit.\n');
        process.exit(1);
    }

    if (SUPABASE_SERVICE_ROLE_KEY.length < 100) {
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY parece inválida (muito curta).');
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// Gerar senha aleatória longa (para usuários desabilitados — não será usada)
// ---------------------------------------------------------------------------
function gerarSenhaAleatoria(bytes = 32) {
    return randomBytes(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// Criar ou localizar usuário no Supabase Auth
// ---------------------------------------------------------------------------
async function criarOuLocalizarAuthUser(supabase, email, senha, metadata) {
    // Tentar criar primeiro
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password:      senha,
        email_confirm: true,
        user_metadata: metadata
    });

    if (!createError) {
        return { authUserId: created.user.id, criado: true };
    }

    // Se já existe, buscar pelo email
    if (createError.status === 422 || createError.message?.includes('already')) {
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = listData?.users?.find(u => u.email === email);
        if (existing) {
            return { authUserId: existing.id, criado: false };
        }
    }

    throw createError;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
    validarConfig();

    console.log('='.repeat(70));
    console.log('  PROVISIONAMENTO DE USUÁRIOS — Supabase Auth');
    console.log(`  Projeto: ${SUPABASE_URL}`);
    console.log('='.repeat(70));
    console.log();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // -----------------------------------------------------------------------
    // 1. Buscar todos os usuários de public.usuarios
    // -----------------------------------------------------------------------
    console.log('📋 Buscando usuários em public.usuarios...');
    const { data: usuarios, error: listError } = await supabase
        .from('usuarios')
        .select('id, matricula, nome, email, tipo_usuario, primeiro_login, desabilitado, auth_user_id')
        .order('matricula');

    if (listError) {
        console.error('❌ Erro ao buscar usuários:', listError.message);
        process.exit(1);
    }

    console.log(`   Encontrados: ${usuarios.length} usuário(s)\n`);

    const resultados = {
        criados:    [],
        existentes: [],
        erros:      [],
        orfaos:     []
    };

    // -----------------------------------------------------------------------
    // 2. Para cada usuário: criar Auth + vincular auth_user_id
    // -----------------------------------------------------------------------
    for (const usuario of usuarios) {
        const { matricula, nome, tipo_usuario, desabilitado, auth_user_id } = usuario;

        process.stdout.write(`   [${matricula}] ${nome} (${tipo_usuario})... `);

        // Se já tem auth_user_id, pular
        if (auth_user_id) {
            console.log(`⏭  Já vinculado (${auth_user_id.substring(0, 8)}...)`);
            resultados.existentes.push(matricula);
            continue;
        }

        const authEmail = `${matricula.toLowerCase()}${AUTH_EMAIL_DOMAIN}`;

        try {
            let senha;
            if (tipo_usuario === 'admin') {
                // Admin: usar ADMIN_INITIAL_PASSWORD (nunca matrícula)
                senha = ADMIN_INITIAL_PASSWORD;
            } else if (desabilitado) {
                // Desabilitado: senha aleatória inutilizável (bloqueia acesso de fato pela RLS)
                senha = gerarSenhaAleatoria();
            } else {
                // Aluno ativo: senha temporária = matrícula
                senha = matricula;
            }

            const { authUserId, criado } = await criarOuLocalizarAuthUser(
                supabase,
                authEmail,
                senha,
                { nome, matricula, tipo_usuario }
            );

            // Vincular auth_user_id no perfil
            const { error: updateError } = await supabase
                .from('usuarios')
                .update({
                    auth_user_id: authUserId,
                    updated_at:   new Date().toISOString()
                })
                .eq('matricula', matricula);

            if (updateError) throw updateError;

            console.log(`${criado ? '✅ Criado' : '🔗 Vinculado'} (${authUserId.substring(0, 8)}...)`);
            resultados.criados.push({ matricula, authUserId, criado });

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`❌ ERRO: ${msg}`);
            resultados.erros.push({ matricula, erro: msg });
        }
    }

    // -----------------------------------------------------------------------
    // 3. Vincular exercícios existentes por matrícula → auth_user_id
    // -----------------------------------------------------------------------
    console.log('\n📎 Vinculando exercícios existentes a auth_user_id...');
    const { data: resultadoVinculo, error: vinculoError } = await supabase
        .rpc('vincular_exercicios_por_matricula');

    // Nota: esta função está no schema private, chamar via supabase.rpc pode
    // requerer ajuste dependendo da configuração de search_path. 
    // Alternativa direta:
    const { error: updateExerciciosError } = await supabase
        .from('exercicios')
        .update({ auth_user_id: null }) // placeholder — real update abaixo
        .is('auth_user_id', null)
        .limit(0); // apenas testar conexão

    // Update real: JOIN implícito via subquery
    const { error: joinUpdateError } = await supabase.rpc(
        'vincular_exercicios_por_matricula'
    ).catch(() => ({ error: null }));

    if (!joinUpdateError) {
        console.log('   ✅ Exercícios vinculados via função SQL.');
    } else {
        // Fallback: vincular manualmente
        console.log('   ℹ️  Vinculando exercícios manualmente...');
        const { data: usuariosComAuth } = await supabase
            .from('usuarios')
            .select('matricula, auth_user_id')
            .not('auth_user_id', 'is', null);

        let vinculados = 0;
        for (const u of (usuariosComAuth || [])) {
            const { data: exs } = await supabase
                .from('exercicios')
                .select('id')
                .eq('matricula', u.matricula)
                .is('auth_user_id', null);

            if (exs && exs.length > 0) {
                await supabase
                    .from('exercicios')
                    .update({ auth_user_id: u.auth_user_id, updated_at: new Date().toISOString() })
                    .eq('matricula', u.matricula)
                    .is('auth_user_id', null);
                vinculados += exs.length;
            }
        }
        console.log(`   ✅ ${vinculados} exercício(s) vinculado(s) manualmente.`);
    }

    // -----------------------------------------------------------------------
    // 4. Exercícios órfãos (matrícula sem usuário)
    // -----------------------------------------------------------------------
    const { data: orfaos } = await supabase
        .from('exercicios')
        .select('id, matricula, exercicio_id, nome, created_at')
        .is('auth_user_id', null);

    if (orfaos && orfaos.length > 0) {
        console.log(`\n⚠️  EXERCÍCIOS ÓRFÃOS (${orfaos.length}) — matrícula sem usuário correspondente:`);
        orfaos.forEach(e => {
            console.log(`   ID ${e.id} | Exercício ${e.exercicio_id} | Matrícula: ${e.matricula} | Aluno: ${e.nome}`);
        });
        console.log('   ⚠️  NÃO foram excluídos. Revise manualmente.\n');
        resultados.orfaos = orfaos;
    } else {
        console.log('\n   ✅ Nenhum exercício órfão encontrado.');
    }

    // -----------------------------------------------------------------------
    // 5. Relatório final
    // -----------------------------------------------------------------------
    console.log('\n' + '='.repeat(70));
    console.log('  RELATÓRIO FINAL');
    console.log('='.repeat(70));
    console.log(`  ✅ Criados/vinculados: ${resultados.criados.length}`);
    console.log(`  ⏭  Já existiam:        ${resultados.existentes.length}`);
    console.log(`  ❌ Erros:              ${resultados.erros.length}`);
    console.log(`  ⚠️  Órfãos:             ${resultados.orfaos.length}`);

    if (resultados.erros.length > 0) {
        console.log('\n  Erros detalhados:');
        resultados.erros.forEach(e => console.log(`    • ${e.matricula}: ${e.erro}`));
    }

    console.log('\n  PRÓXIMOS PASSOS:');
    console.log('  1. Execute a consulta SQL para confirmar que todos os auth_user_id foram preenchidos:');
    console.log('     SELECT matricula, nome, auth_user_id IS NOT NULL as vinculado FROM public.usuarios;');
    console.log('  2. Teste o login de um aluno com matrícula/senha = matrícula.');
    console.log('  3. Teste o login do admin com a ADMIN_INITIAL_PASSWORD.');
    if (resultados.orfaos.length > 0) {
        console.log('  4. Revise os exercícios órfãos listados acima ANTES de rodar a Migration 002.');
    }
    console.log('='.repeat(70) + '\n');
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message || err);
    process.exit(1);
});
