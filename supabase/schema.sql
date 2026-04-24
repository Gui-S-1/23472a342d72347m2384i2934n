-- ================================================================
-- BLACKFIT — SCHEMA SUPABASE (Postgres)
-- Rodar TUDO uma vez no SQL Editor do Supabase Dashboard.
-- (https://supabase.com/dashboard/project/cgdwiirwtttjykoevett/sql)
-- ================================================================

-- ============== EXTENSÕES ==============
create extension if not exists pgcrypto;

-- ============== TABELAS ==============

-- Marcas (brands) — cada admin/usuário cuida da SUA marca
-- Valores aceitos: 'blackfit' | 'elegance'

-- Blocos de conteúdo editáveis (textos do site)
create table if not exists public.content_blocks (
  id          bigserial primary key,
  brand       text not null default 'blackfit',
  page        text not null,
  key         text not null,
  value       text not null default '',
  type        text not null default 'text',
  label       text,
  updated_at  timestamptz not null default now(),
  unique (brand, page, key)
);
alter table public.content_blocks add column if not exists brand text not null default 'blackfit';
-- garante a unique correta caso a tabela já existisse
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'content_blocks_page_key_key') then
    alter table public.content_blocks drop constraint content_blocks_page_key_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'content_blocks_brand_page_key_key') then
    alter table public.content_blocks add constraint content_blocks_brand_page_key_key unique (brand, page, key);
  end if;
end $$;

-- Posts do blog
create table if not exists public.posts (
  id          bigserial primary key,
  brand       text not null default 'blackfit',
  title       text not null,
  slug        text,
  excerpt     text default '',
  body        text default '',
  cover_url   text,
  media       jsonb not null default '[]'::jsonb,  -- [{url,type,name}]
  published   boolean not null default true,
  views       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.posts add column if not exists brand text not null default 'blackfit';
alter table public.posts add column if not exists media jsonb not null default '[]'::jsonb;
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_brand_idx on public.posts (brand, created_at desc);
create index if not exists posts_views_idx on public.posts (brand, views desc);

-- (legacy) — mídia normalizada (mantida por compatibilidade)
create table if not exists public.post_media (
  id          bigserial primary key,
  post_id     bigint not null references public.posts(id) on delete cascade,
  url         text not null,
  type        text not null default 'image',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

-- Logs de view (com hash de IP+UA p/ rate-limit)
create table if not exists public.post_views (
  id          bigserial primary key,
  post_id     bigint not null references public.posts(id) on delete cascade,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists post_views_post_time on public.post_views (post_id, created_at desc);

-- Posts do Instagram embedados
create table if not exists public.insta_posts (
  id          bigserial primary key,
  brand       text not null default 'blackfit',
  url         text not null,
  caption     text default '',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.insta_posts add column if not exists brand text not null default 'blackfit';

-- Library global de mídia (por marca)
create table if not exists public.media_library (
  id          bigserial primary key,
  brand       text not null default 'blackfit',
  url         text not null,
  name        text,
  kind        text not null default 'image',  -- image | video
  mime        text,
  size        bigint,
  created_at  timestamptz not null default now()
);
alter table public.media_library add column if not exists brand text not null default 'blackfit';

-- ============== TRIGGERS ==============
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_posts_touch on public.posts;
create trigger trg_posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_blocks_touch on public.content_blocks;
create trigger trg_blocks_touch before update on public.content_blocks
  for each row execute function public.touch_updated_at();

-- shim do unaccent (pra não exigir extensão extra)
create or replace function public.unaccent_safe(t text) returns text as $$
begin
  return translate(t,
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN');
end;
$$ language plpgsql immutable;

-- Auto-gera slug se vazio
create or replace function public.posts_autoslug() returns trigger as $$
declare base text; v text; n int := 0;
begin
  if new.slug is null or new.slug = '' then
    base := lower(regexp_replace(public.unaccent_safe(new.title), '[^a-z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    if base = '' then base := 'post'; end if;
    v := base;
    while exists(select 1 from public.posts where slug = v and id <> coalesce(new.id, -1)) loop
      n := n + 1; v := base || '-' || n;
    end loop;
    new.slug := v;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_posts_slug on public.posts;
create trigger trg_posts_slug before insert or update on public.posts
  for each row execute function public.posts_autoslug();

-- ============== RPC: incrementar view (público, com rate-limit) ==============
create or replace function public.bump_view(p_post_id bigint, p_ua text default null, p_ip text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_count integer;
begin
  v_hash := encode(digest(coalesce(p_ip,'') || ':' || coalesce(p_ua,''), 'sha256'), 'hex');
  if not exists (
    select 1 from public.post_views
    where post_id = p_post_id and ip_hash = v_hash and created_at > (now() - interval '30 minutes')
  ) then
    insert into public.post_views (post_id, ip_hash, user_agent) values (p_post_id, v_hash, p_ua);
    update public.posts set views = views + 1 where id = p_post_id returning views into v_count;
  else
    select views into v_count from public.posts where id = p_post_id;
  end if;
  return coalesce(v_count, 0);
end;
$$;
revoke all on function public.bump_view(bigint,text,text) from public;
grant execute on function public.bump_view(bigint,text,text) to anon, authenticated;

-- RPC: views agregadas por dia (pro dashboard) — filtrada por marca
create or replace function public.post_views_daily(days integer default 30, p_brand text default null)
returns table (day date, views integer)
language sql
security definer
set search_path = public
as $$
  select date_trunc('day', v.created_at)::date as day,
         count(*)::int as views
  from public.post_views v
  join public.posts p on p.id = v.post_id
  where v.created_at >= (now() - (days || ' days')::interval)
    and (p_brand is null or p.brand = p_brand)
  group by 1
  order by 1 desc;
$$;
grant execute on function public.post_views_daily(integer, text) to authenticated;

-- ============== RLS ==============
alter table public.content_blocks enable row level security;
alter table public.posts          enable row level security;
alter table public.post_media     enable row level security;
alter table public.post_views     enable row level security;
alter table public.insta_posts    enable row level security;
alter table public.media_library  enable row level security;

-- Leitura pública (anon)
drop policy if exists "read blocks"   on public.content_blocks;
create policy "read blocks"   on public.content_blocks for select using (true);
drop policy if exists "read posts"    on public.posts;
create policy "read posts"    on public.posts          for select using (published = true);
drop policy if exists "read postmedia" on public.post_media;
create policy "read postmedia" on public.post_media    for select using (true);
drop policy if exists "read insta"    on public.insta_posts;
create policy "read insta"    on public.insta_posts    for select using (true);
drop policy if exists "read library"  on public.media_library;
create policy "read library"  on public.media_library  for select using (true);

-- post_views: nunca leitura pública (só via RPCs definer)
drop policy if exists "no public view" on public.post_views;
create policy "no public view" on public.post_views   for select using (false);

-- Escrita: somente autenticados (admin)
drop policy if exists "auth all blocks"    on public.content_blocks;
create policy "auth all blocks"    on public.content_blocks for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth all posts"     on public.posts;
create policy "auth all posts"     on public.posts          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth all postmedia" on public.post_media;
create policy "auth all postmedia" on public.post_media     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth all insta"     on public.insta_posts;
create policy "auth all insta"     on public.insta_posts    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth all library"   on public.media_library;
create policy "auth all library"   on public.media_library  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============== STORAGE BUCKET ==============
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media auth upload" on storage.objects;
create policy "media auth upload" on storage.objects for insert with check (bucket_id = 'media' and auth.role() = 'authenticated');
drop policy if exists "media auth delete" on storage.objects;
create policy "media auth delete" on storage.objects for delete using (bucket_id = 'media' and auth.role() = 'authenticated');
drop policy if exists "media auth update" on storage.objects;
create policy "media auth update" on storage.objects for update using (bucket_id = 'media' and auth.role() = 'authenticated');

-- ============== SEED: BLOCOS DE CONTEÚDO ==============
-- ====== MARCA BLACKFIT (Thiago) ======
insert into public.content_blocks (brand, page, key, value, type, label) values
  -- ===== GLOBAL =====
  ('blackfit','global','whatsapp_number',  '5562954410900',                                                'text','WhatsApp Thiago (só dígitos, com 55+DDD)'),
  ('blackfit','global','whatsapp_text',    'Olá Thiago! Vim pelo site e quero saber mais.',               'text','Mensagem padrão pré-preenchida no WhatsApp'),
  ('blackfit','global','whatsapp_group',   'https://chat.whatsapp.com/GxvmQLbBsKxHz90eazilZR?mode=gi_t',  'text','Link do Grupo VIP de Ofertas'),
  ('blackfit','global','instagram_handle', 'blackfit_oficial',                                             'text','@ do Instagram (sem @)'),
  ('blackfit','global','address_line',     'Black Fit Suplementos · Hidrolândia · GO',                    'text','Endereço exibido no rodapé'),
  ('blackfit','global','footer_tagline',   'Combustível para a sua melhor versão.',                        'text','Frase do rodapé'),
  -- ===== HOME =====
  ('blackfit','home','hero_eyebrow',       'Suplementação · Estilo · Performance',                         'text','Texto pequeno acima do título'),
  ('blackfit','home','hero_morph',         'FORÇA|FOCO|ENERGIA|RESULTADO|ATITUDE',                         'text','Palavras alternadas no hero (separe com |)'),
  ('blackfit','home','hero_lead',          'Combustível para a sua melhor versão. Ultrapasse seus limites diários com a fórmula dos campeões.','text','Subtítulo do hero'),
  ('blackfit','home','stat1_value',        '3000',                                                          'text','Estatística 1 — número'),
  ('blackfit','home','stat1_label',        'Clientes Atendidos & Satisfeitos',                              'text','Estatística 1 — rótulo'),
  ('blackfit','home','stat2_value',        '1000',                                                          'text','Estatística 2 — número'),
  ('blackfit','home','stat2_label',        'Bioimpedâncias Realizadas',                                     'text','Estatística 2 — rótulo'),
  ('blackfit','home','quote',              'Não pare quando estiver doendo. Pare apenas quando o treino estiver feito.','text','Frase motivacional'),
  ('blackfit','home','bio_title_strong',   'BIOIMPEDÂNCIA',                                                 'text','Bioimpedância — título'),
  ('blackfit','home','bio_intro',          'Conhece o seu corpo de verdade? A bioimpedância é o exame que mostra tudo que a balança esconde.','text','Bioimpedância — intro'),
  -- ===== SOBRE =====
  ('blackfit','sobre','hero_title',        'Mais que loja. Sua parceira de transformação.',                'text','Título principal'),
  ('blackfit','sobre','hero_lead',         'Há mais de uma década entregando suplementação séria, atendimento próximo e resultado real.','text','Subtítulo'),
  ('blackfit','sobre','mission',           'Levar suplementação confiável e atendimento humano para quem busca evolução real.','text','Nossa Missão'),
  ('blackfit','sobre','vision',            'Ser referência em performance e estilo de vida fitness em Goiás.','text','Nossa Visão'),
  ('blackfit','sobre','values',            'Transparência · Resultado · Comunidade · Excelência',           'text','Nossos Valores (separar por ·)'),
  -- ===== SUPLEMENTOS =====
  ('blackfit','suplementos','hero_title',  'O arsenal completo do atleta',                                  'text','Título'),
  ('blackfit','suplementos','hero_lead',   'Whey, creatina, pré-treino, vitaminas. As melhores marcas do mercado, escolhidas a dedo.','text','Subtítulo'),
  -- ===== ROUPAS (link p/ Elegance) =====
  ('blackfit','roupas','hero_title',       'ELEGANCE FITWEAR',                                              'text','Título'),
  ('blackfit','roupas','hero_lead',        'Moda fitness feminina que veste, valoriza e empodera.',         'text','Subtítulo'),
  -- ===== CONTATO =====
  ('blackfit','contato','hero_title',      'Fala com a gente',                                              'text','Título'),
  ('blackfit','contato','hero_lead',       'WhatsApp, Instagram ou venha tomar um café na loja.',           'text','Subtítulo'),
  ('blackfit','contato','address_full',    'Av. Principal, 000 — Centro, Hidrolândia/GO',                  'text','Endereço completo'),
  ('blackfit','contato','hours',           'Seg a Sáb · 09h às 19h',                                        'text','Horário de funcionamento')
on conflict (brand, page, key) do nothing;

-- ====== MARCA ELEGANCE FITWEAR (Joana) ======
insert into public.content_blocks (brand, page, key, value, type, label) values
  -- ===== GLOBAL =====
  ('elegance','global','whatsapp_number',  '5562962267380',                                                'text','WhatsApp Joana (só dígitos, com 55+DDD)'),
  ('elegance','global','whatsapp_text',    'Oi Joana! Vim pelo site da Elegance e queria saber mais.',     'text','Mensagem padrão do WhatsApp'),
  ('elegance','global','whatsapp_group',   'https://chat.whatsapp.com/B864ooWxaIICeBSbVhy1RK?mode=gi_t',  'text','Link do Grupo VIP da Elegance'),
  ('elegance','global','instagram_handle', 'elegance_fitwear',                                             'text','@ do Instagram (sem @)'),
  ('elegance','global','address_line',     'Elegance Fitwear · Hidrolândia · GO',                          'text','Endereço do rodapé'),
  ('elegance','global','footer_tagline',   'Moda fitness que veste, valoriza e empodera.',                  'text','Frase do rodapé'),
  -- ===== HOME =====
  ('elegance','home','hero_eyebrow',       'Moda Fitness Feminina',                                         'text','Texto pequeno do hero'),
  ('elegance','home','hero_title',         'ELEGANCE FITWEAR',                                              'text','Título principal'),
  ('elegance','home','hero_lead',          'Peças que vestem o seu treino, valorizam o seu corpo e seguem com você o dia inteiro.','text','Subtítulo do hero'),
  ('elegance','home','cta_primary',        'Conhecer a coleção',                                            'text','Botão principal'),
  ('elegance','home','cta_secondary',      'Falar com a Joana',                                             'text','Botão secundário'),
  ('elegance','home','about_title',        'Sobre a Elegance',                                              'text','Título da seção sobre'),
  ('elegance','home','about_text',         'Cada peça é escolhida pensando em você: tecidos que respiram, modelagem que valoriza, design que acompanha.','text','Texto sobre'),
  ('elegance','home','quote',              'Você não veste só uma roupa. Você veste atitude.',              'text','Frase de impacto')
on conflict (brand, page, key) do nothing;

-- ============== FIM ==============
-- PRÓXIMOS PASSOS NO DASHBOARD:
-- 1) Authentication → Users → "Add user":
--      a) THIAGO (BLACKFIT)
--         Email:   thiago@blackfit.com
--         Senha:   @blackfitsuplee
--         Auto Confirm User: SIM
--      b) JOANA (ELEGANCE)
--         Email:   joana@elegance.com
--         Senha:   @Joana123
--         Auto Confirm User: SIM
--
--    O painel admin detecta a marca pelo domínio do email:
--      *@blackfit.com  → brand 'blackfit'
--      *@elegance.com  → brand 'elegance'
--
-- 2) O bucket Storage "media" é criado automaticamente acima.
-- ================================================================
