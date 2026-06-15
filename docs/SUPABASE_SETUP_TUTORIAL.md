# Tutorial de Configuração do Supabase - VENUM MARKET

## Visão Geral
Este tutorial guiará você através da configuração completa do banco de dados Supabase para a aplicação VENUM MARKET.

## Pré-requisitos
- Conta no Supabase (https://supabase.com)
- Projeto Supabase criado
- Acesso ao SQL Editor do Supabase

---

## Passo 1: Executar o Schema SQL Completo

### 1.1 Acessar o SQL Editor
1. Faça login no painel do Supabase (https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **"New Query"**

### 1.2 Executar o Schema
1. Copie todo o conteúdo do arquivo `supabase/schema.sql`
2. Cole no SQL Editor
3. Clique em **"Run"** (ou pressione Ctrl+Enter)
4. Aguarde a execução completa (deve mostrar "Success")

**O que isso cria:**
- Tabela `missions` com coluna `end_date`
- Tabela `mission_participants` com relacionamentos
- Tabela `transports` corrigida
- Tabela `guild_codes`
- Todas as RLS Policies (Row Level Security)
- Índices para performance
- Funções RPC de ranking
- Funções RPC de pontos (award_points, deduct_points)
- Função de validação de código (validate_guild_code)

---

## Passo 2: Criar Bucket de Storage para Avatares

### 2.1 Acessar o Storage
1. No menu lateral, clique em **Storage**
2. Clique em **"Create a new bucket"**

### 2.2 Configurar o Bucket
1. **Nome do bucket:** `avatars`
2. **Public bucket:** Marque como **Public**
3. Clique em **"Create bucket"**

### 2.3 Configurar Policies do Storage
1. Após criar o bucket, clique nele
2. Vá para a aba **Policies**
3. Clique em **"New Policy"**
4. Selecione **"For full customization"** → **"Get started"**
5. Crie a seguinte policy:

**Policy Name:** `Public Read Access`
**Allowed Operation:** `SELECT`
**Target Roles:** `anon`, `authenticated`
**Policy Definition:** `true`

6. Clique em **"Save"**

7. Crie outra policy:

**Policy Name:** `Authenticated Upload`
**Allowed Operation:** `INSERT`
**Target Roles:** `authenticated`
**Policy Definition:** `auth.role() = 'authenticated'`

8. Clique em **"Save"**

---

## Passo 3: Verificar Tabelas Criadas

### 3.1 Acessar o Table Editor
1. No menu lateral, clique em **Table Editor**
2. Verifique se as seguintes tabelas existem:
   - ✅ `missions`
   - ✅ `mission_participants`
   - ✅ `transports`
   - ✅ `guild_codes`
   - ✅ `profiles` (deve existir do setup inicial)
   - ✅ `points_ledger` (deve existir do setup inicial)

### 3.2 Verificar Estrutura da Tabela missions
1. Clique na tabela `missions`
2. Verifique se a coluna `end_date` existe
3. Tipo deve ser: `timestamp with time zone`

### 3.3 Verificar Estrutura da Tabela transports
1. Clique na tabela `transports`
2. Verifique se as seguintes colunas existem:
   - ✅ `id` (UUID)
   - ✅ `item_id` (TEXT)
   - ✅ `item_name` (TEXT)
   - ✅ `from_city` (TEXT)
   - ✅ `to_city` (TEXT)
   - ✅ `buy_price` (NUMERIC)
   - ✅ `sell_price` (NUMERIC)
   - ✅ `profit` (NUMERIC)
   - ✅ `quantity` (INTEGER)
   - ✅ `status` (TEXT) com CHECK constraint
   - ✅ `reserved_by` (UUID)
   - ✅ `reserved_at` (TIMESTAMPTZ)
   - ✅ `created_by` (UUID)
   - ✅ `created_at` (TIMESTAMPTZ)

---

## Passo 4: Verificar Funções RPC

### 4.1 Acessar o Database Functions
1. No menu lateral, clique em **Database**
2. Vá para a aba **Functions**
3. Verifique se as seguintes funções existem:
   - ✅ `get_weekly_ranking(p_limit)`
   - ✅ `get_monthly_ranking(p_limit)`
   - ✅ `get_user_ranking_position(p_profile_id)`
   - ✅ `award_points(p_profile_id, p_amount, p_reason, p_reference_id, p_reference_type)`
   - ✅ `deduct_points(p_profile_id, p_amount, p_reason, p_reference_id, p_reference_type)`
   - ✅ `validate_guild_code(p_code)`

### 4.2 Testar Funções (Opcional)
No SQL Editor, execute:

```sql
-- Testar validate_guild_code
SELECT public.validate_guild_code('TESTCODE');

-- Testar get_weekly_ranking
SELECT * FROM public.get_weekly_ranking(10);

-- Testar get_monthly_ranking
SELECT * FROM public.get_monthly_ranking(10);
```

---

## Passo 5: Verificar RLS Policies

### 5.1 Acessar as Policies
1. No menu lateral, clique em **Authentication** → **Policies**
2. Verifique se as seguintes policies existem:

**Para tabela missions:**
- ✅ "Anyone can view missions"
- ✅ "Admins and officers can insert missions"
- ✅ "Admins and officers can update missions"
- ✅ "Admins can delete missions"

**Para tabela mission_participants:**
- ✅ "Anyone can view mission participants"
- ✅ "Authenticated users can join missions"
- ✅ "Users can update their own participation"

**Para tabela transports:**
- ✅ "Transports are viewable by authenticated users"
- ✅ "Transports can be updated by authenticated users"
- ✅ "Transports can be inserted by authenticated users"

**Para tabela guild_codes:**
- ✅ "Anyone can view active codes"
- ✅ "Admins and officers can create codes"
- ✅ "Admins and officers can update codes"
- ✅ "Admins can delete codes"

---

## Passo 6: Configurar Variáveis de Ambiente

### 6.1 Obter Credenciais do Supabase
1. No menu lateral, clique em **Settings** → **API**
2. Copie os seguintes valores:
   - **Project URL** (ex: https://xyz.supabase.co)
   - **anon public key** (chave pública)
   - **service_role key** (chave de serviço - NÃO compartilhar)

### 6.2 Configurar no Projeto Local
1. Crie ou edite o arquivo `.env` na raiz do projeto
2. Adicione as seguintes variáveis:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

3. Se necessário para desenvolvimento local, adicione também:

```env
SUPABASE_SERVICE_ROLE_KEY=sua-chave-servico
```

---

## Passo 7: Testar Conexão

### 7.1 Iniciar o Projeto Local
```bash
npm install
npm run dev
```

### 7.2 Verificar Console do Navegador
1. Abra o aplicativo no navegador
2. Abra o Console do navegador (F12)
3. Procure por erros de conexão com Supabase
4. Se não houver erros, a conexão está funcionando

---

## Solução de Problemas

### Erro: "Could not find the table 'public.transports'"
**Solução:** Execute novamente o arquivo `supabase/schema.sql` no SQL Editor

### Erro: "Could not find the 'end_date' column"
**Solução:** Execute o seguinte SQL no SQL Editor:
```sql
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
```

### Erro: "Could not find the function public.get_weekly_ranking"
**Solução:** Execute novamente o arquivo `supabase/schema.sql` no SQL Editor

### Erro: "Bucket not found" ao fazer upload de avatar
**Solução:** Siga o Passo 2 para criar o bucket `avatars`

### Erro: "Permission denied" ao criar missão
**Solução:** Verifique se seu usuário tem role 'admin' ou 'officer' na tabela `profiles`

---

## Checklist de Verificação

Antes de prosseguir, verifique:

- [ ] Schema SQL executado com sucesso
- [ ] Bucket `avatars` criado e configurado como público
- [ ] Policies de Storage configuradas
- [ ] Todas as tabelas existem no Table Editor
- [ ] Coluna `end_date` existe na tabela `missions`
- [ ] Tabela `transports` tem todas as colunas corretas
- [ ] Todas as funções RPC existem
- [ ] RLS Policies estão configuradas
- [ ] Variáveis de ambiente configuradas
- [ ] Aplicação conecta com Supabase sem erros

---

## Próximos Passos

Após completar este tutorial:
1. Execute `npm run build` para verificar que não há erros de compilação
2. Teste a criação de missões no painel Admin
3. Teste a criação de códigos de convite
4. Teste o upload de foto de perfil
5. Teste o ranking semanal/mensal
6. Teste a inserção/remoção de pontos

---

## Suporte

Se encontrar problemas:
1. Verifique o Console do navegador para erros específicos
2. Verifique o SQL Editor do Supabase para mensagens de erro
3. Consulte a documentação do Supabase: https://supabase.com/docs
