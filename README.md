# BLACKFIT — Painel Administrativo

Painel privado para gerenciar **conteúdo, blog, mídia, Instagram e estatísticas** do site BLACKFIT.

> ⚠️ **Repositório PRIVADO.** Não exponha publicamente. Mesmo com Supabase Auth + RLS, manter privado evita engenharia social.

## Acesso

- URL local: abra `index.html` no navegador
- Usuário: **`thiago`**
- Senha: **`@blackfitsuplee`**

## Funcionalidades

| Aba | O que faz |
|---|---|
| **Estatísticas** | Total de posts, views totais, views de hoje, gráfico de 30 dias, top 8 posts mais vistos |
| **Blog & Notícias** | CRUD completo de posts: título, resumo, corpo, capa, galeria de imagens/vídeos. Upload direto para Supabase Storage |
| **Textos do Site** | Edita qualquer texto editável (`content_blocks`) agrupado por página, com busca |
| **Galeria de Mídia** | Library global de imagens/vídeos. Upload, copiar URL, excluir |
| **Instagram** | Adiciona/remove URLs de posts e reels que aparecem na página do blog |

Tudo **mobile-first**, com sidebar colapsável, modais animados, toasts e drag-and-drop de arquivos.

## Setup inicial (uma única vez)

### 1. Rodar o schema no Supabase

1. Acesse https://supabase.com/dashboard/project/cgdwiirwtttjykoevett/sql
2. Cole TODO o conteúdo de `../supabase/schema.sql` (ou da seção [Schema](#schema-sql) abaixo se vier separado)
3. Clique **RUN**

Isso cria as tabelas, RLS, policies, RPCs (`bump_view`, `post_views_daily`), o bucket `media` e os blocos de conteúdo iniciais.

### 2. Criar o usuário admin

No Dashboard Supabase:

1. **Authentication → Users → "Add user"**
2. Email: `thiago@blackfit.com`
3. Senha: `@blackfitsuplee`
4. Marque ☑ **Auto Confirm User**
5. Salve

Pronto. Tente logar no painel com `thiago` / `@blackfitsuplee`.

## Rodar localmente

```powershell
# Opção 1: abrir direto
start index.html

# Opção 2: servidor estático (recomendado para upload de arquivos)
npx live-server --port=8181
```

## Segurança

- ✅ **Auth via Supabase** com sessão persistida em `localStorage` (refresh automático)
- ✅ **RLS habilitado** em todas as tabelas — escrita exige `auth.role() = 'authenticated'`
- ✅ **`post_views`** com leitura bloqueada (`using(false)`); só acessível via RPC `SECURITY DEFINER`
- ✅ **RPC `bump_view`** com rate-limit de 30 min por hash de IP+UA → impossível inflar contagem
- ✅ Storage `media` com upload/delete só para autenticados
- ✅ Anon key é **pública por design** (Supabase) — toda escrita é barrada por RLS
- ✅ HTML do conteúdo do usuário **escapado** ao renderizar (XSS-safe)

## Estrutura

```
admin/
├─ index.html            Estrutura: tela de login + SPA do painel
├─ admin.css             Estilo dark moderno mobile-first
├─ admin.js              Auth, router, todas as views, upload, modais, toasts
├─ supabase-config.js    URL + anon key
└─ README.md             Este arquivo
```

## Deploy

O painel é puro estático. Pode ir junto com o site OU em URL separada (ex: `admin.seudominio.com`).

> Recomendação: hospede em URL separada e ative restrição de IP no painel da hospedagem se possível.

## Schema SQL

O SQL completo está em `../supabase/schema.sql` (mesma estrutura, idempotente — pode rodar várias vezes).

---

© BLACKFIT Suplementos
