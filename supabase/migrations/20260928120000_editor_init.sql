-- 에디터 API 저장소(ADR-044 · openspec supabase-backend). 서버(Edge Function)는 비밀 키(service_role)로만 닿는다.
-- 모든 표는 RLS를 켜고 정책을 두지 않는다 — anon · authenticated는 한 행도 읽거나 쓰지 못하고, service_role만 RLS를 건너뛴다.
-- 공개 조회는 API가 발행 글만 걸러 내준다(public-posts-api) — DB를 직접 부르는 공개 길은 없다.

-- 글: 파일 저장소(`workspaces/<id>/posts/<slug>.json`, adr-007)와 같은 키. body는 저장한 JSON 텍스트 그대로(키 순서 보존),
-- revision은 body의 SHA-256(revision.ts) — 조건부 쓰기가 409를 지킨다
create table public.posts (
  workspace_id text not null,
  slug text not null,
  body text not null,
  revision text not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, slug)
);

create table public.workspace_settings (
  workspace_id text primary key,
  guide text not null,
  updated_at timestamptz not null default now()
);

-- AI 되돌리기(ADR-041): before는 저장 직전 파일 JSON 텍스트(새 글이면 null), after는 그 저장이 만든 revision
create table public.ai_undo (
  workspace_id text not null,
  slug text not null,
  before_body text,
  after_revision text not null,
  primary key (workspace_id, slug)
);

-- OAuth(mcp-oauth). seq는 등록 순서 — 꽉 차면 오래된 미연결 클라이언트부터 밀어낸다
create table public.oauth_clients (
  client_id text primary key,
  seq bigint generated always as identity,
  client_name text not null,
  redirect_uris jsonb not null,
  registered_at bigint not null,
  connected boolean not null default false
);

-- 코드 · 토큰은 원문이 아니라 SHA-256으로만 찾는다. data는 grant 필드(JSON), expires_at은 epoch 초
create table public.oauth_codes (
  code_hash text primary key,
  data jsonb not null,
  expires_at bigint not null
);

create table public.oauth_access_tokens (
  token_hash text primary key,
  data jsonb not null,
  expires_at bigint not null
);

create table public.oauth_refresh_tokens (
  token_hash text primary key,
  data jsonb not null,
  expires_at bigint not null
);

-- 로그인 누적 잠금(ADR-045). key는 계정 id 또는 "없는 아이디" 묶음 하나
create table public.login_lockouts (
  key text primary key,
  failures integer not null default 0,
  locked_until bigint not null default 0,
  lock_count integer not null default 0
);

alter table public.posts enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.ai_undo enable row level security;
alter table public.oauth_clients enable row level security;
alter table public.oauth_codes enable row level security;
alter table public.oauth_access_tokens enable row level security;
alter table public.oauth_refresh_tokens enable row level security;
alter table public.login_lockouts enable row level security;

-- 새 프로젝트는 public 표에 역할별 기본 권한을 주지 않는다(실측 2026-09-28: service_role도 42501) — 서버에만 준다.
-- anon · authenticated에는 권한 자체가 없어 RLS 앞에서 한 번 더 막힌다
grant select, insert, update, delete on
  public.posts, public.workspace_settings, public.ai_undo, public.oauth_clients,
  public.oauth_codes, public.oauth_access_tokens, public.oauth_refresh_tokens, public.login_lockouts
  to service_role;

-- 로그인 시도 한 번을 비밀번호 확인 **전에** 실패로 센다(성공하면 서버가 행을 지운다). 잠겨 있으면 세지 않고
-- false — 세기와 잠금 확인이 행 잠금 아래 한 문장이라 병렬 요청도 잠금 한 번에 max_failures번까지만 true를 받는다.
-- 풀린 잠금은 실패 수만 0으로 돌리고 잠긴 횟수는 남긴다. 잠길 때마다 base × 2^(횟수-1), 상한 max_seconds —
-- 지수를 30에서 자른다(잠긴 횟수가 수십 번이면 곱이 bigint를 넘는다)
create function public.record_login_failure(
  p_key text,
  p_now bigint,
  p_max_failures integer,
  p_base_seconds bigint,
  p_max_seconds bigint
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_failures integer;
  v_locked_until bigint;
  v_lock_count integer;
begin
  insert into public.login_lockouts (key) values (p_key) on conflict (key) do nothing;
  select failures, locked_until, lock_count into v_failures, v_locked_until, v_lock_count
    from public.login_lockouts where key = p_key for update;
  if v_locked_until > p_now then
    return false;
  end if;
  if v_locked_until <> 0 then
    v_failures := 0;
    v_locked_until := 0;
  end if;
  v_failures := v_failures + 1;
  if v_failures >= p_max_failures then
    v_lock_count := v_lock_count + 1;
    v_locked_until := p_now + least(p_base_seconds * power(2, least(v_lock_count - 1, 30))::bigint, p_max_seconds);
  end if;
  update public.login_lockouts
    set failures = v_failures, locked_until = v_locked_until, lock_count = v_lock_count
    where key = p_key;
  return true;
end;
$$;

-- 등록은 인증 없이 열려 있다 — 상한을 넘으면 유예가 지난 미연결 클라이언트 중 가장 오래된 것만 밀어내고, 없으면 false.
-- 세기 · 밀어내기 · 넣기를 잠금 하나로 묶어 동시 등록이 상한을 넘지 않는다
create function public.oauth_save_client(
  p_client_id text,
  p_client_name text,
  p_redirect_uris jsonb,
  p_registered_at bigint,
  p_now bigint,
  p_max_clients integer,
  p_grace_seconds bigint
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_evict text;
begin
  perform pg_advisory_xact_lock(hashtext('public.oauth_clients'));
  if not exists (select 1 from public.oauth_clients where client_id = p_client_id)
     and (select count(*) from public.oauth_clients) >= p_max_clients then
    select client_id into v_evict from public.oauth_clients
      where not connected and registered_at + p_grace_seconds <= p_now
      order by seq limit 1;
    if v_evict is null then
      return false;
    end if;
    delete from public.oauth_clients where client_id = v_evict;
  end if;
  insert into public.oauth_clients (client_id, client_name, redirect_uris, registered_at)
    values (p_client_id, p_client_name, p_redirect_uris, p_registered_at)
    on conflict (client_id) do update
      set client_name = excluded.client_name,
          redirect_uris = excluded.redirect_uris,
          registered_at = excluded.registered_at;
  return true;
end;
$$;

-- 함수는 기본으로 PUBLIC(anon 포함)이 실행할 수 있다 — 서버만 부르게 좁힌다
revoke execute on function public.record_login_failure(text, bigint, integer, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.oauth_save_client(text, text, jsonb, bigint, bigint, integer, bigint) from public, anon, authenticated;
grant execute on function public.record_login_failure(text, bigint, integer, bigint, bigint) to service_role;
grant execute on function public.oauth_save_client(text, text, jsonb, bigint, bigint, integer, bigint) to service_role;

-- 사진(ADR-021): 비공개 버킷. 공개 URL이 없고 API(`GET /images/*`)가 보안 헤더를 붙여 내준다.
-- storage.objects는 RLS가 켜져 있고 정책을 두지 않는다 — service_role만 읽고 쓴다
insert into storage.buckets (id, name, public) values ('images', 'images', false)
  on conflict (id) do nothing;
