-- Otaru Finance Bot migration
-- 1) Family sharing invite/access tables (view-only)
-- 2) Materialized view for daily risk snapshot

create extension if not exists pgcrypto;

create table if not exists family_sharing_invites (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  invitee_contact text not null,
  permission text not null default 'view_only' check (permission in ('view_only')),
  invite_token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_user_id text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_sharing_invites_owner on family_sharing_invites(owner_user_id);
create index if not exists idx_family_sharing_invites_status on family_sharing_invites(status);

create table if not exists family_sharing_access (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  viewer_user_id text not null,
  permission text not null default 'view_only' check (permission in ('view_only')),
  status text not null default 'active' check (status in ('active','revoked')),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, viewer_user_id)
);

create index if not exists idx_family_sharing_access_owner on family_sharing_access(owner_user_id);
create index if not exists idx_family_sharing_access_viewer on family_sharing_access(viewer_user_id);

-- Optional daily snapshot for lighter backend queries.
create materialized view if not exists mv_otaru_credit_daily as
select
  p.id as user_id,
  p.nik,
  coalesce(p.full_name, '-') as full_name,
  coalesce(p.limit_pinjaman, 0) as limit_pinjaman,
  coalesce(sum(case when lr.status in ('PENDING','APPROVED') then coalesce(lr.nominal_pengajuan, 0) else 0 end), 0) as active_nominal,
  coalesce(sum(case when lr.status in ('PENDING','APPROVED') then coalesce((lr.ocr_raw->>'cicilan_sistem')::int, 0) else 0 end), 0) as cicilan_aktif,
  coalesce(sum(case when upper(coalesce(lr.ai_indicator, '')) = 'TAMPERED' then 1 else 0 end), 0) as tampered_attempts,
  now() as snapshot_at
from profiles p
left join loan_requests lr on lr.nik = p.nik
group by p.id, p.nik, p.full_name, p.limit_pinjaman;

create unique index if not exists idx_mv_otaru_credit_daily_user on mv_otaru_credit_daily(user_id);

-- Refresh command for scheduler (Supabase cron/pg_cron):
-- refresh materialized view concurrently mv_otaru_credit_daily;
