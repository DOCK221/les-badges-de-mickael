create table if not exists public.adherents (
    identifiant text primary key,
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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.adherents to authenticated;
grant select on table public.admins to authenticated;

drop policy if exists "admins voient leur ligne" on public.admins;
create policy "admins voient leur ligne" on public.admins
    for select to authenticated
    using (user_id = auth.uid());

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

grant execute on function public.get_fiche(text, text) to anon, authenticated;

insert into public.admins (user_id)
select id from auth.users where email = 'adminmickael@gmail.com'
on conflict (user_id) do nothing;

insert into public.adherents (
    identifiant, nom, prenom, domiciliation, numeros_urgence, date_inscription, maladie, aide_apporter, gestes_secours
) values (
    '12345',
    'Cisse',
    'Boubacar',
    'Bordeaux',
    array['0779617949'],
    '2026-11-22',
    'A completer selon le dossier medical.',
    'Rester calme, se presenter, appeler le proche puis les secours si besoin.',
    'Securiser l environnement, surveiller la respiration, appeler le 15 ou le 18.'
)
on conflict (identifiant) do update set
    nom = excluded.nom,
    prenom = excluded.prenom,
    domiciliation = excluded.domiciliation,
    numeros_urgence = excluded.numeros_urgence,
    date_inscription = excluded.date_inscription,
    maladie = excluded.maladie,
    aide_apporter = excluded.aide_apporter,
    gestes_secours = excluded.gestes_secours;

insert into public.adherents (
    identifiant, nom, prenom, domiciliation, numeros_urgence, date_inscription, maladie, aide_apporter, gestes_secours
) values (
    '67890',
    'Bernard',
    'Lucas',
    'Reze',
    array['0789456123'],
    '2026-04-22',
    'Diabete — risque d hypoglycemie.',
    'Donner du sucre si la personne est consciente, rester avec elle.',
    'Contacter les secours si malaise important, surveiller son etat.'
)
on conflict (identifiant) do update set
    nom = excluded.nom,
    prenom = excluded.prenom;

insert into public.adherents (
    identifiant, nom, prenom, domiciliation, numeros_urgence, date_inscription, maladie, aide_apporter, gestes_secours
) values (
    '11111',
    'Martin',
    'Sophie',
    'Nantes',
    array['0612345678', '0698765432'],
    '2026-04-22',
    'Epilepsie — crises possibles, ne rien mettre dans la bouche.',
    'Rassurer la personne, l allonger sur le cote si necessaire, appeler le 15 en cas de crise.',
    'Surveiller la respiration, securiser l environnement, ne rien mettre dans la bouche.'
)
on conflict (identifiant) do update set
    nom = excluded.nom,
    prenom = excluded.prenom;
