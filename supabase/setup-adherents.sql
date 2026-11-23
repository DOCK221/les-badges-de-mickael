-- Correction Les Badges de Mickael
-- Cree une table propre "adherents" (evite le mot reserve "user")
-- A coller dans Supabase > SQL Editor puis cliquer RUN

create table if not exists public.adherents (
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

create table if not exists public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.adherents enable row level security;
alter table public.admins enable row level security;

drop policy if exists "admins gerent les fiches" on public.adherents;
create policy "admins gerent les fiches" on public.adherents
    for all to authenticated
    using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
    with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

grant select, insert, update, delete on table public.adherents to authenticated;
grant usage on schema public to anon, authenticated;

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

-- Admin deja cree
insert into public.admins (user_id)
values ('2707b188-0f16-45f8-8979-a14ef72dfb30')
on conflict (user_id) do nothing;

-- Boubacar Cisse
insert into public.adherents (
    identifiant, nom, prenom, domiciliation, numeros_urgence, date_inscription, maladie, aide_apporter, gestes_secours
) values (
    '12345',
    'Cisse',
    'Boubacar',
    'Bordeaux',
    array['0779617949'],
    '2026-11-22',
    '',
    '',
    ''
)
on conflict (identifiant) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    domiciliation = excluded.domiciliation,
    numeros_urgence = excluded.numeros_urgence,
    date_inscription = excluded.date_inscription;
