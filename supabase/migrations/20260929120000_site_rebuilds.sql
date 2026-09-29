-- 사이트 재빌드 상태(ADR-047 · openspec deploy-connect site-rebuild). 워크스페이스마다 한 행 — 마지막 요청 id로 30초 묶기를 판정한다.
-- 다른 표와 같이 RLS를 켜고 정책을 두지 않으며 service_role에만 권한을 준다
create table public.site_rebuilds (
  workspace_id text primary key,
  status text not null check (status in ('idle', 'pending', 'sent', 'failed')),
  request_id text,
  updated_at timestamptz
);

alter table public.site_rebuilds enable row level security;

grant select, insert, update, delete on public.site_rebuilds to service_role;
