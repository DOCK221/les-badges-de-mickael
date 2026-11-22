-- Branche le site sur la table publique "user"
-- A coller dans Supabase > SQL Editor > Run

-- 1) S'assurer que la table user a les bonnes colonnes
create table if not exists public."user" (
    identifiant text primary key
);

alter table public."user" add column if not exists nom text;
alter table public."user" add column if not exists prenom text;
alter table public."user" add column if not exists domiciliation text;
alter table public."user" add column if not exists numeros_urgence text[] default '{}';
alter table public."user" add column if not exists date_inscription date;
alter table public."user" add column if not exists maladie text;
alter table public."user" add column if not exists aide_apporter text;
alter table public."user" add column if not exists gestes_secours text;
alter table public."user" add column if not exists created_at timestamptz default now();

-- Si un ancien numero unique existe, on le bascule dans le tableau
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user' and column_name = 'numero'
  ) then
    update public."user"
    set numeros_urgence = array[numero]
    where (numeros_urgence is null or numeros_urgence = '{}')
      and numero is not null
      and numero <> '';
  end if;
end $$;

update public."user" set nom = coalesce(nom, '') where nom is null;
update public."user" set prenom = coalesce(prenom, '') where prenom is null;
alter table public."user" alter column nom set not null;
alter table public."user" alter column prenom set not null;

-- 2) Table des admins
create table if not exists public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

-- 3) Securite
alter table public."user" enable row level security;
alter table public.admins enable row level security;

drop policy if exists "admins gerent les fiches" on public."user";
create policy "admins gerent les fiches" on public."user"
    for all to authenticated
    using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
    with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Droits techniques (RLS reste actif)
grant select, insert, update, delete on public."user" to authenticated;
grant select on public."user" to anon;

-- 4) get_fiche lit dans "user"
create or replace function public.get_fiche(p_identifiant text, p_nom text)
returns setof public."user"
language sql
stable
security definer
set search_path = public
as $$
    select *
    from public."user"
    where identifiant = p_identifiant
      and lower(trim(nom)) = lower(trim(p_nom))
    limit 1;
$$;

revoke all on function public.get_fiche(text, text) from public;
grant execute on function public.get_fiche(text, text) to anon, authenticated;

-- 5) Lier l'admin deja cree
insert into public.admins (user_id)
values ('2707b188-0f16-45f8-8979-a14ef72dfb30')
on conflict (user_id) do nothing;

-- 6) Acces Boubacar Cisse
insert into public."user" (
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
