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
