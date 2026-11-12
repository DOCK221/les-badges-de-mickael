-- À exécuter une fois dans Supabase > SQL Editor.

create table if not exists public.personnes (
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

-- Comptes autorisés à gérer les fiches.
create table if not exists public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.personnes enable row level security;
alter table public.admins enable row level security;

drop policy if exists "admins gerent les fiches" on public.personnes;
create policy "admins gerent les fiches" on public.personnes
    for all to authenticated
    using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
    with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Accès public à une seule fiche, uniquement avec identifiant + nom exacts.
create or replace function public.get_fiche(p_identifiant text, p_nom text)
returns setof public.personnes
language sql
stable
security definer
set search_path = public
as $$
    select *
    from public.personnes
    where identifiant = p_identifiant
      and lower(trim(nom)) = lower(trim(p_nom))
    limit 1;
$$;

revoke all on function public.get_fiche(text, text) from public;
grant execute on function public.get_fiche(text, text) to anon, authenticated;

-- Après avoir créé votre compte dans Authentication > Users, remplacez l'e-mail puis exécutez :
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'votre-email@exemple.fr';
