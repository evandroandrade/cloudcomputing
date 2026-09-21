# Guia de Migração — Autenticação Supabase Auth + RLS

**Projeto:** Cloud Computing — UNI7  
**Data:** Setembro 2026  
**Arquitetura:** `Matrícula + Senha → Supabase Auth → JWT → auth.uid() → RLS PostgreSQL`

---

## ⚠️ BLOCKERS ANTES DE COMEÇAR

1. **Datas dos exercícios são de 2025** — a turma atual é 2026.  
   → Edite `config/exercicios.json` e atualize todas as `data_liberacao` e `data_ultima_edicao` para 2026 antes do deploy.

2. **Faça BACKUP completo do banco** antes de executar qualquer migration.

---

## Ordem Exata de Deploy

### ETAPA 1 — Backup do Banco

```sql
-- No painel do Supabase: Database > Backups > Create backup
-- Ou via pg_dump local:
pg_dump -h db.SEU-PROJETO.supabase.co -U postgres -d postgres > backup_antes_migracao.sql
```

---

### ETAPA 2 — Executar Migration 001

**No Supabase Dashboard → SQL Editor:**

```sql
-- Cole o conteúdo de: migrations/001_secure_auth_rls.sql
```

Verificar após execução:
```sql
-- Confirmar colunas adicionadas:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('usuarios','exercicios')
ORDER BY table_name, ordinal_position;

-- Confirmar policies:
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('usuarios','exercicios') ORDER BY tablename;

-- Confirmar funções privadas:
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'private';
```

---

### ETAPA 3 — Configurar Secrets das Edge Functions

No Supabase Dashboard → **Settings → Edge Functions → Secrets**:

| Secret | Valor |
|---|---|
| `SUPABASE_URL` | URL do seu projeto |
| `SUPABASE_ANON_KEY` | Chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chave service_role (SECRETA)** |

> ⚠️ Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend ou no Git.

---

### ETAPA 4 — Deploy das Edge Functions

**Instale a CLI do Supabase** (se ainda não tiver):
```bash
npm install -g supabase
```

**Autenticar e linkar o projeto:**
```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF
```

**Deploy das funções:**
```bash
supabase functions deploy complete-first-login
supabase functions deploy admin-users
```

**Verificar deploy:**
```bash
supabase functions list
```

---

### ETAPA 5 — Executar Script de Provisionamento

**Instalar dependência:**
```bash
npm install @supabase/supabase-js
```

**Configurar variáveis e executar:**

```powershell
# PowerShell (Windows)
$env:SUPABASE_URL = "https://SEU-PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
$env:ADMIN_INITIAL_PASSWORD = "SenhaSegura123!"
node scripts/provision-auth-users.mjs
```

```bash
# Bash/Mac/Linux
SUPABASE_URL=https://SEU-PROJETO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
ADMIN_INITIAL_PASSWORD=SenhaSegura123! \
node scripts/provision-auth-users.mjs
```

---

### ETAPA 6 — Validar Associação `usuarios.auth_user_id`

```sql
-- Todos devem ter auth_user_id preenchido:
SELECT matricula, nome, tipo_usuario,
       auth_user_id IS NOT NULL AS vinculado,
       desabilitado
FROM public.usuarios
ORDER BY matricula;

-- Usuários ativos sem vínculo (deve retornar 0):
SELECT COUNT(*) FROM public.usuarios
WHERE auth_user_id IS NULL AND desabilitado = false;
```

---

### ETAPA 7 — Validar Associação `exercicios.auth_user_id`

```sql
-- Resumo de exercícios:
SELECT
  COUNT(*) AS total,
  COUNT(auth_user_id) AS vinculados,
  COUNT(*) - COUNT(auth_user_id) AS sem_vinculo
FROM public.exercicios;

-- Exercícios órfãos (matrícula sem usuário):
SELECT * FROM private.exercicios_orfaos;
```

---

### ETAPA 8 — Executar Testes de RLS

```sql
-- Teste: anon NÃO pode ler usuários
SET ROLE anon;
SELECT * FROM public.usuarios; -- deve retornar 0 linhas ou erro
RESET ROLE;

-- Teste: anon NÃO pode ler exercícios
SET ROLE anon;
SELECT * FROM public.exercicios; -- deve retornar 0 linhas ou erro
RESET ROLE;

-- Teste: verificar função is_admin
SELECT private.is_admin('<uuid-do-admin>'); -- deve retornar true
SELECT private.is_admin('<uuid-de-aluno>'); -- deve retornar false

-- Teste: can_use_app para aluno com primeiro_login=false
SELECT private.can_use_app('<uuid-aluno-ativo>'); -- true
SELECT private.can_use_app('<uuid-aluno-primeiro-login>'); -- false
```

---

### ETAPA 9 — Deploy do Frontend

1. Atualizar `config/exercicios.json` com as datas corretas de 2026
2. Fazer upload de todos os arquivos alterados para o servidor web/CDN

**Arquivos críticos para subir:**
- `index.html` (CDN Supabase adicionado)
- `admin-login.html` (reescrito)
- `admin.html` (auth migrada)
- `config/supabase.js` (reescrito)
- `config/exercicios.json` (exercício 10 adicionado)
- `js/security.js` (novo)
- `js/secure-auth.js` (novo)
- `script.js` (migrado)

---

### ETAPA 10 — Testar com Uma Conta de Aluno

1. Abrir `index.html`
2. Digitar matrícula e senha (= matrícula, para o primeiro acesso)
3. Verificar que o modal de primeiro login aparece
4. Definir nova senha (mín. 8 chars, letras + números)
5. Verificar que os exercícios são carregados
6. Verificar que não aparecem senhas no Console do browser
7. Verificar Network tab: não deve haver GET /usuarios com senha

---

### ETAPA 11 — Testar Admin

1. Abrir `admin-login.html`
2. Login com matrícula do admin + `ADMIN_INITIAL_PASSWORD`
3. Verificar dashboard carregando alunos e exercícios
4. Testar reset de senha de um aluno
5. Verificar que nenhuma senha aparece na resposta das APIs

---

### ETAPA 12 — Liberar Turma Inteira

Após validar ETAPA 10 e 11 com sucesso:
1. Comunicar aos alunos que a plataforma foi atualizada
2. Instruir: "Faça login com sua matrícula e senha = matrícula. Você deverá definir uma nova senha."

---

### ETAPA 13 — Migration 002 (Remoção de Senhas Legadas)

**Execute SOMENTE após:**
- [ ] 100% dos usuários ativos autenticaram via Supabase Auth
- [ ] Admin autenticou com sucesso
- [ ] Primeiro login funciona para todos os alunos testados
- [ ] Reset de senha funciona via painel admin
- [ ] Exercícios novos estão salvando com auth_user_id
- [ ] Exercícios antigos estão com auth_user_id preenchido
- [ ] Backup recente realizado

```sql
-- Cole o conteúdo de: migrations/002_remove_legacy_passwords.sql
```

---

## Testes Manuais Obrigatórios

| Teste | Esperado |
|---|---|
| A — anon GET /usuarios | 0 linhas (RLS bloqueia) |
| B — login matrícula + senha correta | Autentica |
| C — login senha errada | "Matrícula ou senha inválida" (genérico) |
| D — aluno desabilitado | Acesso negado + signOut |
| E — primeiro login | Modal obrigatório, sem acesso a exercícios antes de trocar |
| F — DevTools: trocar matrícula | RLS bloqueia (auth.uid() é o real) |
| G — GET exercicios?matricula=B sendo aluno A | RLS bloqueia |
| H — INSERT exercício com auth_user_id falso | RLS rejeita |
| I — admin login válido | Entra no painel |
| J — aluno abre admin.html direto | Redirecionado para login |
| K — admin vê todos alunos e exercícios | Funciona |
| L — admin cria aluno | Aluno entra com matrícula, obrigado a trocar senha |
| M — admin reseta senha | Aluno volta a primeiro_login=true |
| N — desabilitar aluno preserva exercícios | Exercícios mantidos |
| O — nenhuma senha no Console/Network | Verificado |
| P — service_role ausente do bundle | Verificado nas DevTools |
| Q — recarregar com sessão válida | Mantém usuário logado |
| R — logout invalida sessão | signOut executado |
| S — INSERT created_at / UPDATE não altera created_at | Verificado no banco |

---

## Secrets Necessários

| Secret | Onde Configurar | Exposto No Frontend? |
|---|---|---|
| `SUPABASE_ANON_KEY` | `config/supabase.js` | ✅ SIM (é pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Functions Secrets | ❌ **NUNCA** |
| `ADMIN_INITIAL_PASSWORD` | `.env` local + variável de ambiente | ❌ **NUNCA** |

---

## Estrutura de Arquivos Alterados

```
cloudcomputing/
├── index.html                          ← CDN Supabase v2 adicionado, botão Lembrar removido
├── admin-login.html                    ← Reescrito com Supabase Auth
├── admin.html                          ← Auth migrada, sem admin_session localStorage
├── script.js                           ← Login/sessão/logout migrados, sem senha no JS
├── config/
│   ├── supabase.js                     ← Reescrito com Supabase JS v2 client
│   └── exercicios.json                 ← Exercício 10 adicionado (⚠️ DATAS 2025!)
├── js/
│   ├── security.js                     ← NOVO — utilitários de segurança UI
│   └── secure-auth.js                  ← NOVO — autenticação Supabase Auth
├── migrations/
│   ├── 001_secure_auth_rls.sql         ← NOVO — banco+RLS (executar na ETAPA 2)
│   └── 002_remove_legacy_passwords.sql ← NOVO — remover senhas (executar na ETAPA 13)
├── scripts/
│   └── provision-auth-users.mjs       ← NOVO — provisionamento (executar na ETAPA 5)
├── supabase/functions/
│   ├── complete-first-login/index.ts  ← NOVA Edge Function
│   └── admin-users/index.ts           ← NOVA Edge Function
├── .env.example                        ← NOVO — template de variáveis
├── .gitignore                          ← NOVO — impede commit de .env
└── MIGRACAO_AUTH.md                    ← Este documento
```

---

## Pendências / Blockers

| # | Pendência | Criticidade |
|---|---|---|
| 1 | **Datas 2025 em exercicios.json** — todos os exercícios aparecem como expirados | 🔴 BLOCKER |
| 2 | Exercício 10 sem formulário específico em script.js | 🟡 Funcional mas sem campos extras |
| 3 | Configurar `supabase/config.toml` com project-ref antes do deploy das Functions | 🔴 BLOCKER para ETAPA 4 |
| 4 | Instalar `@supabase/supabase-js` no diretório do script antes da ETAPA 5 | 🟡 |
| 5 | Validar duplicatas em `exercicios` antes da Migration 001 (SQL de verificação incluso) | 🟡 |
