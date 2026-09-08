-- Employer contract signing + nurse certification documents
-- Run in Supabase SQL editor if the schema is missing in a fresh environment.

create table if not exists public.nurse_documents (
  id uuid primary key default gen_random_uuid(),
  nurse_id uuid not null references public.nurse_profiles(id) on delete cascade,
  document_type text not null,
  title text not null,
  file_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nurse_documents_nurse_id_idx
  on public.nurse_documents (nurse_id);

create index if not exists nurse_documents_type_idx
  on public.nurse_documents (document_type);

alter table public.nurse_documents enable row level security;

drop policy if exists "Nurses can manage own certification documents"
  on public.nurse_documents;
create policy "Nurses can manage own certification documents"
  on public.nurse_documents
  for all
  using (
    exists (
      select 1
      from public.nurse_profiles np
      where np.id = nurse_documents.nurse_id
        and np.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.nurse_profiles np
      where np.id = nurse_documents.nurse_id
        and np.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can read all certification documents"
  on public.nurse_documents;
create policy "Admins can read all certification documents"
  on public.nurse_documents
  for select
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  );

drop policy if exists "Approved employers can read certification documents"
  on public.nurse_documents;
create policy "Approved employers can read certification documents"
  on public.nurse_documents
  for select
  using (
    exists (
      select 1
      from public.employer_profiles ep
      where ep.user_id = auth.uid()
        and ep.status = 'approved'
        and coalesce(ep.contract_signed, false) = true
    )
  );

alter table public.contracts
  add column if not exists document_type text,
  add column if not exists title text,
  add column if not exists source_file_name text,
  add column if not exists signed_storage_path text,
  add column if not exists signed_by_name text,
  add column if not exists signed_by_email text,
  add column if not exists signed_by_title text,
  add column if not exists signature_provider text,
  add column if not exists signature_audit jsonb;

create unique index if not exists contracts_employer_document_type_idx
  on public.contracts (employer_id, document_type)
  where document_type is not null;

-- Optional helper if your environment still needs the private buckets:
-- insert into storage.buckets (id, name, public)
-- values ('contracts', 'contracts', false)
-- on conflict (id) do nothing;
--
-- insert into storage.buckets (id, name, public)
-- values ('certifications', 'certifications', false)
-- on conflict (id) do nothing;
