-- =============================================================================
-- MIGRATION 002 - Remover Colunas de Senha Legadas
-- Projeto: Cloud Computing - UNI7
-- Autor: Evandro Andrade
-- Data: (executar somente após validação completa da Migration 001)
--
-- ⚠️  NÃO EXECUTAR AUTOMATICAMENTE ⚠️
--
-- Execute esta migration SOMENTE após confirmar TODAS as condições abaixo:
--
--   ✅ Todos os usuários ativos autenticaram via Supabase Auth pelo menos uma vez
--   ✅ Admin autenticou via Supabase Auth com sucesso
--   ✅ Fluxo de primeiro login funciona (modal + Edge Function)
--   ✅ Reset de senha via painel admin funciona
--   ✅ Exercícios novos estão sendo salvos com auth_user_id
--   ✅ Exercícios antigos foram vinculados (auth_user_id preenchido)
--   ✅ Coluna auth_user_id em public.usuarios está preenchida para 100% dos usuários ativos
--   ✅ Backup completo do banco foi realizado antes desta execução
--
-- Checklist de validação antes de executar:
--
--   -- Verificar usuários SEM auth_user_id (deve retornar 0 linhas para usuários ativos):
--   SELECT matricula, nome, desabilitado
--   FROM public.usuarios
--   WHERE auth_user_id IS NULL
--     AND desabilitado = false;
--
--   -- Verificar exercícios SEM auth_user_id:
--   SELECT COUNT(*) as sem_vinculo FROM public.exercicios WHERE auth_user_id IS NULL;
--
--   -- Verificar total de usuários vs. vinculados:
--   SELECT
--     COUNT(*) as total,
--     COUNT(auth_user_id) as vinculados,
--     COUNT(*) - COUNT(auth_user_id) as pendentes
--   FROM public.usuarios;
--
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PASSO 1 - Verificação final (aborta se ainda há usuários ativos sem vínculo)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    usuarios_sem_vinculo integer;
BEGIN
    SELECT COUNT(*) INTO usuarios_sem_vinculo
    FROM public.usuarios
    WHERE auth_user_id IS NULL
      AND desabilitado = false;

    IF usuarios_sem_vinculo > 0 THEN
        RAISE EXCEPTION
            'ABORTADO: Existem % usuário(s) ativo(s) sem auth_user_id. '
            'Complete a migração de autenticação antes de remover as colunas de senha. '
            'Consulte: SELECT matricula, nome FROM public.usuarios WHERE auth_user_id IS NULL AND desabilitado = false;',
            usuarios_sem_vinculo;
    END IF;

    RAISE NOTICE 'Verificação OK: todos os usuários ativos possuem auth_user_id.';
END;
$$;

-- ---------------------------------------------------------------------------
-- PASSO 2 - Backup das colunas em tabela de auditoria (opcional mas recomendado)
-- ---------------------------------------------------------------------------
-- Cria uma tabela de auditoria para preservar o histórico das senhas antigas
-- por 90 dias antes de uma limpeza definitiva.
CREATE TABLE IF NOT EXISTS private.legacy_passwords_audit (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    matricula      text    NOT NULL,
    senha_hash     text,            -- nunca armazenar senha em texto claro novamente
    archived_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_usuario FOREIGN KEY (matricula)
        REFERENCES public.usuarios(matricula) ON DELETE CASCADE
);

-- Registrar apenas o fato de que a coluna existia (não copiar senhas em texto claro)
INSERT INTO private.legacy_passwords_audit (matricula, senha_hash)
SELECT matricula, 'REDACTED_BEFORE_COLUMN_DROP'
FROM public.usuarios
WHERE senha IS NOT NULL OR senha_atual IS NOT NULL
ON CONFLICT DO NOTHING;

RAISE NOTICE '% registro(s) arquivados em private.legacy_passwords_audit.',
    (SELECT COUNT(*) FROM private.legacy_passwords_audit);

-- ---------------------------------------------------------------------------
-- PASSO 3 - Remover colunas de senha legadas
-- ---------------------------------------------------------------------------

-- Remover lembrete_senha
ALTER TABLE public.usuarios
    DROP COLUMN IF EXISTS lembrete_senha;

-- Remover senha_atual
ALTER TABLE public.usuarios
    DROP COLUMN IF EXISTS senha_atual;

-- Remover senha (texto claro)
ALTER TABLE public.usuarios
    DROP COLUMN IF EXISTS senha;

-- ---------------------------------------------------------------------------
-- PASSO 4 - Tornar auth_user_id NOT NULL em usuarios (agora que todos estão vinculados)
-- ---------------------------------------------------------------------------
-- Remove o índice parcial antigo antes de alterar para NOT NULL
DROP INDEX IF EXISTS public.usuarios_auth_user_id_unique;

-- Adicionar constraint NOT NULL
ALTER TABLE public.usuarios
    ALTER COLUMN auth_user_id SET NOT NULL;

-- Recriar índice único sem cláusula WHERE (agora é NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_user_id_unique
    ON public.usuarios (auth_user_id);

-- ---------------------------------------------------------------------------
-- PASSO 5 - Atualizar GRANT em usuarios (remover colunas que não existem mais)
-- ---------------------------------------------------------------------------
-- Revogar e recriar GRANT explícito de UPDATE sem as colunas removidas
REVOKE UPDATE ON public.usuarios FROM authenticated;
GRANT UPDATE (
    nome,
    email,
    updated_at
) ON public.usuarios TO authenticated;

-- ---------------------------------------------------------------------------
-- COMMIT
-- ---------------------------------------------------------------------------
COMMIT;

-- ===========================================================================
-- PÓS-EXECUÇÃO:
-- ===========================================================================
--
-- 1. Verificar estrutura final:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'usuarios'
--    ORDER BY ordinal_position;
--
-- 2. Confirmar que colunas de senha foram removidas:
--    -- Nenhuma dessas deve existir:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'usuarios'
--      AND column_name IN ('senha', 'senha_atual', 'lembrete_senha');
--
-- 3. Verificar auditoria:
--    SELECT COUNT(*) FROM private.legacy_passwords_audit;
--
-- 4. Após 90 dias, a tabela de auditoria pode ser removida:
--    DROP TABLE private.legacy_passwords_audit;
--
-- ===========================================================================
