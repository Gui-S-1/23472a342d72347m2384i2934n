-- ================================================================
-- BLACKFIT/ELEGANCE — PATCH DE SEGURANÇA (rodar no SQL Editor)
-- Corrige: tenant isolation por brand (RLS) + storage por pasta
-- Idempotente — pode rodar várias vezes sem problema.
-- ================================================================

-- ============== HELPER: brand do usuário logado ==============
-- Lê o email do JWT e mapeia o domínio → brand.
create or replace function public.user_brand() returns text
language sql stable security definer set search_path = public
as $$
  select case
    when (auth.jwt() ->> 'email') ilike '%@elegance.com' then 'elegance'
    when (auth.jwt() ->> 'email') ilike '%@blackfit.com' then 'blackfit'
    else null
  end;
$$;
grant execute on function public.user_brand() to anon, authenticated;

-- ============== POLICIES ESCRITA: só na própria marca ==============

-- content_blocks
drop policy if exists "auth all blocks" on public.content_blocks;
drop policy if exists "auth write blocks own brand" on public.content_blocks;
create policy "auth write blocks own brand" on public.content_blocks
  for all
  using      (auth.role() = 'authenticated' and brand = public.user_brand())
  with check (auth.role() = 'authenticated' and brand = public.user_brand());

-- posts
drop policy if exists "auth all posts" on public.posts;
drop policy if exists "auth write posts own brand" on public.posts;
create policy "auth write posts own brand" on public.posts
  for all
  using      (auth.role() = 'authenticated' and brand = public.user_brand())
  with check (auth.role() = 'authenticated' and brand = public.user_brand());

-- post_media (legado): vincula via post.brand
drop policy if exists "auth all postmedia" on public.post_media;
drop policy if exists "auth write postmedia own brand" on public.post_media;
create policy "auth write postmedia own brand" on public.post_media
  for all
  using (
    auth.role() = 'authenticated'
    and exists (select 1 from public.posts p where p.id = post_id and p.brand = public.user_brand())
  )
  with check (
    auth.role() = 'authenticated'
    and exists (select 1 from public.posts p where p.id = post_id and p.brand = public.user_brand())
  );

-- insta_posts
drop policy if exists "auth all insta" on public.insta_posts;
drop policy if exists "auth write insta own brand" on public.insta_posts;
create policy "auth write insta own brand" on public.insta_posts
  for all
  using      (auth.role() = 'authenticated' and brand = public.user_brand())
  with check (auth.role() = 'authenticated' and brand = public.user_brand());

-- media_library
drop policy if exists "auth all library" on public.media_library;
drop policy if exists "auth write library own brand" on public.media_library;
create policy "auth write library own brand" on public.media_library
  for all
  using      (auth.role() = 'authenticated' and brand = public.user_brand())
  with check (auth.role() = 'authenticated' and brand = public.user_brand());

-- ============== STORAGE: isolar por pasta {brand}/... ==============
-- Uploads do admin já gravam em `{brand}/folder/arquivo.ext`.
drop policy if exists "media auth upload"  on storage.objects;
drop policy if exists "media auth update"  on storage.objects;
drop policy if exists "media auth delete"  on storage.objects;
drop policy if exists "media upload own brand" on storage.objects;
drop policy if exists "media update own brand" on storage.objects;
drop policy if exists "media delete own brand" on storage.objects;

create policy "media upload own brand" on storage.objects
  for insert
  with check (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.user_brand()
  );

create policy "media update own brand" on storage.objects
  for update
  using (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.user_brand()
  );

create policy "media delete own brand" on storage.objects
  for delete
  using (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = public.user_brand()
  );

-- (a policy "media public read" já permite SELECT público, mantida)

-- ============== TESTE RÁPIDO ==============
-- Logada como Joana, esta query deve retornar 'elegance':
--   select public.user_brand();
-- E esta INSERT deve falhar (cross-brand):
--   insert into posts(brand,title) values('blackfit','hack');  -- 42501 RLS violation
