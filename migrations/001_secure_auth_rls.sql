-- =============================================================================
-- MIGRATION 001 - Autenticação Segura com Supabase Auth + RLS
-- Projeto: Cloud Computing - UNI7
-- Autor: Evandro Andrade
-- Data: 2026-09-16
--
-- IDEMPOTENTE: pode ser executada múltiplas vezes sem efeitos colaterais.
-- NÃO remove dados existentes.
-- NÃO remove colunas de senha legadas (isso será feito na migration 002
-- somente após validação completa).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SCHEMA PRIVADO PARA FUNÇÕES DE SEGURANÇA
-- ---------------------------------------------------------------------------
-- Funções SECURITY DEFINER ficam em schema separado para evitar injeção
-- via search_path e recursão de RLS.
CREATE SCHEMA IF NOT EXISTS private;

-- Revogar acesso público ao schema privado
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- ---------------------------------------------------------------------------
-- 2. COLUNA auth_user_id EM public.usuarios
-- ---------------------------------------------------------------------------
-- Adiciona a FK para auth.users sem apagar dados existentes.
-- O NULL inicial é intencional: a associação será feita pelo script de provisionamento.

ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS auth_user_id uuid
        REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice único parcial: garante unicidade SOMENTE para linhas que já têm auth_user_id
-- Linhas com NULL podem coexistir durante a migração.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_auth_user_id_unique
    ON public.usuarios (auth_user_id)
    WHERE auth_user_id IS NOT NULL;

-- Garantir que matrícula seja única (já deve existir, mas tornamos idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usuarios_matricula_unique'
          AND conrelid = 'public.usuarios'::regclass
    ) THEN
        ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_matricula_unique UNIQUE (matricula);
    END IF;
END;
$$;

-- Coluna desabilitado: adicionar se não existir
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS desabilitado boolean NOT NULL DEFAULT false;

-- Coluna updated_at: adicionar se não existir
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Coluna created_at: adicionar se não existir
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- 3. COLUNA auth_user_id EM public.exercicios
-- ---------------------------------------------------------------------------
-- Adiciona FK para auth.users sem apagar dados existentes.
-- Preserva matricula e nome para histórico/relatórios.

ALTER TABLE public.exercicios
    ADD COLUMN IF NOT EXISTS auth_user_id uuid
        REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice parcial: UNIQUE só quando auth_user_id estiver preenchido
-- Evita falha em linhas legadas com NULL.
CREATE UNIQUE INDEX IF NOT EXISTS exercicios_auth_user_id_exercicio_unique
    ON public.exercicios (auth_user_id, exercicio_id)
    WHERE auth_user_id IS NOT NULL;

-- Coluna updated_at: adicionar se não existir
ALTER TABLE public.exercicios
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Coluna created_at: adicionar se não existir
ALTER TABLE public.exercicios
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- 4. VERIFICAR DUPLICIDADES EM exercicios ANTES DE CRIAR UNIQUE
-- ---------------------------------------------------------------------------
-- Reportar quais pares (matricula, exercicio_id) possuem duplicatas.
-- Este SELECT NÃO altera dados - apenas informa ao executor.
DO $$
DECLARE
    dup_count integer;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT matricula, exercicio_id, COUNT(*) AS total
        FROM public.exercicios
        GROUP BY matricula, exercicio_id
        HAVING COUNT(*) > 1
    ) AS duplicatas;

    IF dup_count > 0 THEN
        RAISE WARNING
            'ATENÇÃO: Existem % par(es) (matricula, exercicio_id) duplicados em public.exercicios. '
            'Revise manualmente antes de prosseguir. '
            'Consulte: SELECT matricula, exercicio_id, COUNT(*) FROM public.exercicios GROUP BY matricula, exercicio_id HAVING COUNT(*) > 1;',
            dup_count;
    ELSE
        RAISE NOTICE 'Sem duplicatas em public.exercicios. OK.';
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. FUNÇÃO private.is_admin(uuid)
-- ---------------------------------------------------------------------------
-- Retorna TRUE somente se o uuid corresponde a um admin ativo.
-- SECURITY DEFINER + search_path fixo: acesso privilegiado isolado.
CREATE OR REPLACE FUNCTION private.is_admin(user_auth_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.auth_user_id  = user_auth_id
          AND u.tipo_usuario  = 'admin'
          AND u.desabilitado  = false
    );
END;
$$;

-- Revogar execução pública; somente roles privilegiadas devem chamar
REVOKE EXECUTE ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_admin(uuid) FROM anon;
-- authenticated pode chamar indiretamente via RLS (que usa SECURITY DEFINER)
GRANT  EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION private.is_admin(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. FUNÇÃO private.can_use_app(uuid)
-- ---------------------------------------------------------------------------
-- Retorna TRUE quando o usuário está ativo E já concluiu o primeiro login.
CREATE OR REPLACE FUNCTION private.can_use_app(user_auth_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.auth_user_id = user_auth_id
          AND u.desabilitado  = false
          AND u.primeiro_login = false
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION private.can_use_app(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.can_use_app(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION private.can_use_app(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION private.can_use_app(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. FUNÇÃO private.current_user_is_admin()
-- ---------------------------------------------------------------------------
-- Atalho conveniente para chamar is_admin com auth.uid().
CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
    RETURN private.is_admin(auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION private.current_user_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_user_is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated;
GRANT  EXECUTE ON FUNCTION private.current_user_is_admin() TO service_role;

-- ---------------------------------------------------------------------------
-- 8. RLS EM public.usuarios
-- ---------------------------------------------------------------------------
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas para recriar de forma idempotente
DROP POLICY IF EXISTS "usuarios_anon_deny"           ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own"          ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_admin"        ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own_safe"     ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_admin"        ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_service"      ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_deny"         ON public.usuarios;

-- 8a. anon: NENHUM acesso (deny-all implícito pelo RLS habilitado sem policy permissiva)
-- Não é necessário criar policy de negação explícita - sem policy = sem acesso.

-- 8b. authenticated - SELECT: aluno vê apenas sua própria linha
CREATE POLICY "usuarios_select_own"
    ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- 8c. authenticated - SELECT admin: admin vê todos os perfis
CREATE POLICY "usuarios_select_admin"
    ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (private.current_user_is_admin());

-- 8d. authenticated - UPDATE: aluno pode atualizar SOMENTE campos permitidos
-- Campos proibidos (tipo_usuario, desabilitado, auth_user_id, primeiro_login) ficam protegidos.
-- A política apenas permite a operação sobre a própria linha;
-- as colunas restritas são protegidas pela política de coluna abaixo.
CREATE POLICY "usuarios_update_own_safe"
    ON public.usuarios
    FOR UPDATE
    TO authenticated
    USING  (auth_user_id = auth.uid() AND desabilitado = false)
    WITH CHECK (
        -- O aluno NÃO pode promover a si mesmo nem alterar campos críticos
        auth_user_id = auth.uid()
        -- tipo_usuario e desabilitado e primeiro_login são controlados pelo server
    );

-- 8e. authenticated - UPDATE admin: admin pode atualizar qualquer perfil
CREATE POLICY "usuarios_update_admin"
    ON public.usuarios
    FOR UPDATE
    TO authenticated
    USING  (private.current_user_is_admin())
    WITH CHECK (private.current_user_is_admin());

-- 8f. service_role - INSERT/UPDATE/DELETE: sem restrição (para Edge Functions admin)
-- service_role bypassa RLS por padrão no Supabase; sem necessidade de policy adicional.

-- 8g. Coluna-level security: revogar acesso a campos sensíveis para anon
-- (não é necessário pois anon já não tem SELECT pela policy)

-- ---------------------------------------------------------------------------
-- 9. RLS EM public.exercicios
-- ---------------------------------------------------------------------------
ALTER TABLE public.exercicios ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas
DROP POLICY IF EXISTS "exercicios_select_own"    ON public.exercicios;
DROP POLICY IF EXISTS "exercicios_insert_own"    ON public.exercicios;
DROP POLICY IF EXISTS "exercicios_update_own"    ON public.exercicios;
DROP POLICY IF EXISTS "exercicios_select_admin"  ON public.exercicios;
DROP POLICY IF EXISTS "exercicios_update_admin"  ON public.exercicios;
DROP POLICY IF EXISTS "exercicios_insert_block"  ON public.exercicios;

-- 9a. Aluno - SELECT: somente os próprios exercícios, somente se pode usar o app
CREATE POLICY "exercicios_select_own"
    ON public.exercicios
    FOR SELECT
    TO authenticated
    USING (
        auth_user_id = auth.uid()
        AND private.can_use_app(auth.uid())
    );

-- 9b. Aluno - INSERT: somente para si mesmo, somente se pode usar o app
CREATE POLICY "exercicios_insert_own"
    ON public.exercicios
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth_user_id = auth.uid()
        AND private.can_use_app(auth.uid())
    );

-- 9c. Aluno - UPDATE: somente os próprios exercícios, somente se pode usar o app
CREATE POLICY "exercicios_update_own"
    ON public.exercicios
    FOR UPDATE
    TO authenticated
    USING (
        auth_user_id = auth.uid()
        AND private.can_use_app(auth.uid())
    )
    WITH CHECK (
        auth_user_id = auth.uid()
        AND private.can_use_app(auth.uid())
    );

-- 9d. Admin - SELECT: admin vê todos os exercícios
CREATE POLICY "exercicios_select_admin"
    ON public.exercicios
    FOR SELECT
    TO authenticated
    USING (private.current_user_is_admin());

-- 9e. Admin - UPDATE (para anotações ou correções administrativas)
CREATE POLICY "exercicios_update_admin"
    ON public.exercicios
    FOR UPDATE
    TO authenticated
    USING  (private.current_user_is_admin())
    WITH CHECK (private.current_user_is_admin());

-- 9f. Nenhum DELETE para aluno (sem policy = sem acesso)

-- ---------------------------------------------------------------------------
-- 10. FUNÇÃO UTILITÁRIA: vincular exercícios de aluno por matrícula
-- ---------------------------------------------------------------------------
-- Será chamada pelo script de provisionamento APÓS associar auth_user_id
-- em public.usuarios. Não executa automaticamente.
CREATE OR REPLACE FUNCTION private.vincular_exercicios_por_matricula()
RETURNS TABLE (
    matricula_vinculada  text,
    exercicios_vinculados bigint,
    exercicios_orfaos    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    -- Vincular exercícios onde matricula bate e auth_user_id ainda é NULL
    UPDATE public.exercicios e
    SET auth_user_id = u.auth_user_id,
        updated_at   = now()
    FROM public.usuarios u
    WHERE e.matricula    = u.matricula
      AND u.auth_user_id IS NOT NULL
      AND e.auth_user_id IS NULL;

    -- Retornar resumo
    RETURN QUERY
    SELECT
        'VINCULADOS'::text,
        COUNT(*) FILTER (WHERE e.auth_user_id IS NOT NULL),
        COUNT(*) FILTER (WHERE e.auth_user_id IS NULL)
    FROM public.exercicios e;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.vincular_exercicios_por_matricula() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION private.vincular_exercicios_por_matricula() TO service_role;

-- ---------------------------------------------------------------------------
-- 11. RELATÓRIO DE EXERCÍCIOS ÓRFÃOS
-- ---------------------------------------------------------------------------
-- Exercícios cuja matrícula não existe em public.usuarios.
-- Apenas para consulta - não remove nada.
CREATE OR REPLACE VIEW private.exercicios_orfaos AS
SELECT
    e.id,
    e.matricula,
    e.exercicio_id,
    e.nome,
    e.created_at
FROM public.exercicios e
WHERE NOT EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.matricula = e.matricula
);

-- ---------------------------------------------------------------------------
-- 12. TRIGGER: atualizar updated_at automaticamente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger em usuarios
DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Trigger em exercicios
DROP TRIGGER IF EXISTS trg_exercicios_updated_at ON public.exercicios;
CREATE TRIGGER trg_exercicios_updated_at
    BEFORE UPDATE ON public.exercicios
    FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 13. GRANT mínimo para authenticated nas tabelas
-- ---------------------------------------------------------------------------
-- authenticated pode operar SOMENTE dentro das restrições RLS acima.

GRANT SELECT, UPDATE (
    nome,
    email,
    updated_at
) ON public.usuarios TO authenticated;

-- Para INSERT/DELETE de usuários, somente service_role (Edge Functions)
GRANT ALL ON public.usuarios TO service_role;

-- exercicios: authenticated pode SELECT, INSERT, UPDATE (via RLS)
GRANT SELECT, INSERT, UPDATE ON public.exercicios TO authenticated;
GRANT ALL ON public.exercicios TO service_role;

-- Sequências (necessário para INSERT com serial/bigserial)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- COMMIT
-- ---------------------------------------------------------------------------
COMMIT;

-- ===========================================================================
-- PÓS-MIGRAÇÃO: consultas de verificação (executar manualmente após COMMIT)
-- ===========================================================================
--
-- 1. Verificar colunas adicionadas:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name IN ('usuarios', 'exercicios')
--    ORDER BY table_name, ordinal_position;
--
-- 2. Verificar policies:
--    SELECT schemaname, tablename, policyname, roles, cmd
--    FROM pg_policies
--    WHERE tablename IN ('usuarios', 'exercicios')
--    ORDER BY tablename, policyname;
--
-- 3. Verificar funções:
--    SELECT routine_name, routine_schema
--    FROM information_schema.routines
--    WHERE routine_schema = 'private'
--    ORDER BY routine_name;
--
-- 4. Verificar exercícios órfãos:
--    SELECT * FROM private.exercicios_orfaos;
--
-- 5. Testar is_admin (substituir UUID real):
--    SELECT private.is_admin('<uuid-do-admin>');
--
-- ===========================================================================
