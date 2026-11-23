-- =============================================
-- RECREER LA TABLE ADHERENTS + BOUBACAR + ADMIN
-- 1) Selectionne TOUT ce texte (Ctrl+A)
-- 2) Copie (Ctrl+C) puis colle dans SQL Editor
-- 3) Clique RUN
-- =============================================

drop function if exists public.get_fiche(text, text);
drop table if exists public.adherents cascade;
drop table if exists public.admins cascade;

create table public.adherents (
    identifiant text primary key check (identifiant ~ '^\d{5}$'),
    nom text not null,
    prenom text not null,
    domiciliation text,
    numeros_urgence text[] not null default '{}',
    date_inscription date,
    maladie text,
    aide_apporter text,
    gestes_secours text,
    created_at timestamptz not null default now()
);

create table public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.adherents enable row level security;
alter table public.admins enable row level security;

create policy "admins gerent les fiches" on public.adherents
    for all to authenticated
    using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
    with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.adherents to authenticated;

create or replace function public.get_fiche(p_identifiant text, p_nom text)
returns setof public.adherents
language sql
stable
security definer
set search_path = public
as $$
    select *
    from public.adherents
    where identifiant = p_identifiant
      and lower(trim(nom)) = lower(trim(p_nom))
    limit 1;
$$;

revoke all on function public.get_fiche(text, text) from public;
grant execute on function public.get_fiche(text, text) to anon, authenticated;

-- Lier l'admin
insert into public.admins (user_id)
select id from auth.users where email = 'adminmickael@gmail.com'
on conflict (user_id) do nothing;

-- Fiche Boubacar Cisse
insert into public.adherents (
    identifiant, nom, prenom, domiciliation, numeros_urgence, date_inscription
) values (
    '12345',
    'Cisse',
    'Boubacar',
    'Bordeaux',
    array['0779617949'],
    '2026-11-22'
);
