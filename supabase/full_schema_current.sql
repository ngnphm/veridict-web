-- ============================================================
-- Veridict - Current Supabase Database Schema
-- Consolidated from the original schema plus applied migrations
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
create type public.claim_status as enum (
    'pending',
    'active',
    'voting',
    'resolved',
    'disputed'
);

create type public.bet_side as enum ('for', 'against');

create type public.notification_type as enum (
    'new_bet',
    'claim_active',
    'voting_started',
    'claim_resolved',
    'claim_disputed'
);

create type public.proposal_response as enum ('approve', 'reject');

-- ============================================================
-- TABLE: profiles
-- ============================================================
create table public.profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    username        text unique not null,
    display_name    text,
    avatar_url      text,
    claims_created  int not null default 0,
    claims_proven   int not null default 0,
    claims_busted   int not null default 0,
    bets_won        int not null default 0,
    bets_lost       int not null default 0,
    total_winnings  bigint not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ============================================================
-- TABLE: claims
-- ============================================================
create table public.claims (
    id                      uuid primary key default uuid_generate_v4(),
    owner_id                uuid not null references public.profiles(id) on delete cascade,
    statement               text not null,
    description             text,
    verify_from_date        timestamptz,
    due_date                timestamptz not null,
    status                  public.claim_status not null default 'pending',
    result                  boolean,
    total_for_amount        bigint not null default 0,
    total_against_amount    bigint not null default 0,
    participant_count       int not null default 0,
    share_code              text unique not null default encode(gen_random_bytes(6), 'hex'),
    is_public               boolean not null default false,
    verification_criteria   jsonb,
    voting_deadline         timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index idx_claims_owner on public.claims(owner_id);
create index idx_claims_status on public.claims(status);
create index idx_claims_due_date on public.claims(due_date);
create index idx_claims_share_code on public.claims(share_code);

-- ============================================================
-- TABLE: bets
-- ============================================================
create table public.bets (
    id          uuid primary key default uuid_generate_v4(),
    claim_id    uuid not null references public.claims(id) on delete cascade,
    user_id     uuid not null references public.profiles(id) on delete cascade,
    side        public.bet_side not null,
    amount      bigint not null check (amount > 0),
    created_at  timestamptz not null default now(),
    unique(claim_id, user_id)
);

create index idx_bets_claim on public.bets(claim_id);
create index idx_bets_user on public.bets(user_id);

-- ============================================================
-- TABLE: votes
-- ============================================================
create table public.votes (
    id          uuid primary key default uuid_generate_v4(),
    claim_id    uuid not null references public.claims(id) on delete cascade,
    user_id     uuid not null references public.profiles(id) on delete cascade,
    vote        boolean not null,
    created_at  timestamptz not null default now(),
    unique(claim_id, user_id)
);

create index idx_votes_claim on public.votes(claim_id);

-- ============================================================
-- TABLE: claim_participants
-- ============================================================
create table public.claim_participants (
    claim_id    uuid not null references public.claims(id) on delete cascade,
    user_id     uuid not null references public.profiles(id) on delete cascade,
    role        text not null check (role in ('owner', 'bettor')),
    joined_at   timestamptz not null default now(),
    primary key (claim_id, user_id)
);

create index idx_claim_participants_user on public.claim_participants(user_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================
create table public.notifications (
    id          uuid primary key default uuid_generate_v4(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    type        public.notification_type not null,
    claim_id    uuid references public.claims(id) on delete cascade,
    title       text not null,
    body        text,
    is_read     boolean not null default false,
    created_at  timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, is_read);

-- ============================================================
-- TABLE: verification_proposals
-- ============================================================
create table public.verification_proposals (
    id              uuid primary key default uuid_generate_v4(),
    claim_id        uuid not null references public.claims(id) on delete cascade,
    proposer_id     uuid not null references public.profiles(id) on delete cascade,
    proposed_result boolean not null,
    status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'tie', 'resolved')),
    tie_breaker_id  uuid references public.profiles(id),
    created_at      timestamptz not null default now(),
    resolved_at     timestamptz
);

create index idx_verification_proposals_claim on public.verification_proposals(claim_id);

-- ============================================================
-- TABLE: proposal_responses
-- ============================================================
create table public.proposal_responses (
    id              uuid primary key default uuid_generate_v4(),
    proposal_id     uuid not null references public.verification_proposals(id) on delete cascade,
    user_id         uuid not null references public.profiles(id) on delete cascade,
    response        public.proposal_response not null,
    created_at      timestamptz not null default now(),
    unique(proposal_id, user_id)
);

create index idx_proposal_responses_proposal on public.proposal_responses(proposal_id);

-- ============================================================
-- TABLE: login_codes
-- ============================================================
create table public.login_codes (
    id          uuid primary key default uuid_generate_v4(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    code        text not null unique,
    expires_at  timestamptz not null,
    used_at     timestamptz,
    created_at  timestamptz not null default now()
);

create index idx_login_codes_code on public.login_codes(code);
create index idx_login_codes_user on public.login_codes(user_id);
create index idx_login_codes_expires on public.login_codes(expires_at);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, username, display_name, avatar_url)
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'username', 'user_' || left(new.id::text, 8)),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
        new.raw_user_meta_data ->> 'avatar_url'
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create or replace function public.handle_new_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.claim_participants (claim_id, user_id, role)
    values (new.id, new.owner_id, 'owner');

    update public.profiles
    set claims_created = claims_created + 1, updated_at = now()
    where id = new.owner_id;

    return new;
end;
$$;

create trigger on_claim_created
    after insert on public.claims
    for each row execute function public.handle_new_claim();

create or replace function public.handle_new_bet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_claim_status public.claim_status;
begin
    insert into public.claim_participants (claim_id, user_id, role)
    values (new.claim_id, new.user_id, 'bettor')
    on conflict (claim_id, user_id) do nothing;

    if new.side = 'for' then
        update public.claims
        set total_for_amount = total_for_amount + new.amount,
            participant_count = participant_count + 1,
            updated_at = now()
        where id = new.claim_id;
    else
        update public.claims
        set total_against_amount = total_against_amount + new.amount,
            participant_count = participant_count + 1,
            updated_at = now()
        where id = new.claim_id;
    end if;

    select status into v_claim_status from public.claims where id = new.claim_id;

    if v_claim_status = 'pending' and new.side = 'against' then
        update public.claims
        set status = 'active', updated_at = now()
        where id = new.claim_id;
    end if;

    return new;
end;
$$;

create trigger on_bet_created
    after insert on public.bets
    for each row execute function public.handle_new_bet();

create or replace function public.handle_new_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_total_participants int;
    v_total_votes int;
    v_true_votes int;
    v_false_votes int;
    v_result boolean;
begin
    select count(*) into v_total_participants
    from public.claim_participants
    where claim_id = new.claim_id;

    select
        count(*),
        count(*) filter (where vote = true),
        count(*) filter (where vote = false)
    into v_total_votes, v_true_votes, v_false_votes
    from public.votes
    where claim_id = new.claim_id;

    if v_total_votes = v_total_participants then
        if v_true_votes = v_total_participants then
            v_result := true;
        elsif v_false_votes = v_total_participants then
            v_result := false;
        else
            update public.claims
            set status = 'disputed', updated_at = now()
            where id = new.claim_id;
            return new;
        end if;

        update public.claims
        set status = 'resolved', result = v_result, updated_at = now()
        where id = new.claim_id;
    end if;

    return new;
end;
$$;

create trigger on_vote_created
    after insert on public.votes
    for each row execute function public.handle_new_vote();

create or replace function public.get_user_claim_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
    select claim_id from public.claim_participants where user_id = p_user_id;
$$;

create or replace function public.get_claim_by_share_code(code text)
returns setof public.claims
language sql
security definer
set search_path = ''
as $$
    select * from public.claims where share_code = code;
$$;

create or replace function public.transition_claims_to_voting()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.claims
    set status = 'voting',
        voting_deadline = now() + interval '72 hours',
        updated_at = now()
    where status = 'active'
      and due_date <= now();
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger set_claims_updated_at
    before update on public.claims
    for each row execute function public.set_updated_at();

create or replace function public.handle_claim_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.status = 'resolved' and old.status != 'resolved' and new.result is not null then
        if new.result then
            update public.profiles
            set claims_proven = claims_proven + 1, updated_at = now()
            where id = new.owner_id;
        else
            update public.profiles
            set claims_busted = claims_busted + 1, updated_at = now()
            where id = new.owner_id;
        end if;

        update public.profiles
        set bets_won = bets_won + 1,
            total_winnings = total_winnings + b.amount,
            updated_at = now()
        from public.bets b
        where public.profiles.id = b.user_id
          and b.claim_id = new.id
          and ((b.side = 'for' and new.result = true)
            or (b.side = 'against' and new.result = false));

        update public.profiles
        set bets_lost = bets_lost + 1,
            total_winnings = total_winnings - b.amount,
            updated_at = now()
        from public.bets b
        where public.profiles.id = b.user_id
          and b.claim_id = new.id
          and ((b.side = 'for' and new.result = false)
            or (b.side = 'against' and new.result = true));
    end if;

    return new;
end;
$$;

create trigger on_claim_resolved
    after update on public.claims
    for each row
    when (new.status = 'resolved' and old.status != 'resolved')
    execute function public.handle_claim_resolved();

create or replace function public.resolve_claim(p_claim_id uuid, p_result boolean)
returns setof public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_claim record;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select * into v_claim from public.claims where id = p_claim_id;
    if v_claim.id is null then
        raise exception 'Claim not found';
    end if;
    if v_claim.owner_id != v_user_id then
        raise exception 'Only the claim owner can self-verify';
    end if;
    if v_claim.status = 'resolved' then
        raise exception 'Claim is already resolved';
    end if;

    update public.claims
    set status = 'resolved',
        result = p_result,
        updated_at = now()
    where id = p_claim_id;

    return query
    select * from public.claims where id = p_claim_id;
end;
$$;

revoke execute on function public.resolve_claim(uuid, boolean) from anon, public;
grant execute on function public.resolve_claim(uuid, boolean) to authenticated;

create or replace function public.create_verification_proposal(p_claim_id uuid, p_proposed_result boolean)
returns setof public.verification_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_is_participant boolean;
    v_active_proposal public.verification_proposals;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select exists(
        select 1 from public.claim_participants
        where claim_id = p_claim_id and user_id = v_user_id
    ) into v_is_participant;

    if not v_is_participant then
        raise exception 'You are not a participant in this claim';
    end if;

    select * into v_active_proposal
    from public.verification_proposals
    where claim_id = p_claim_id
      and status in ('pending', 'tie')
    limit 1;

    if v_active_proposal.id is not null then
        raise exception 'An active verification proposal already exists for this claim';
    end if;

    if exists(
        select 1 from public.claims
        where id = p_claim_id and status in ('resolved', 'disputed')
    ) then
        raise exception 'This claim is already resolved or disputed';
    end if;

    return query
    insert into public.verification_proposals (claim_id, proposer_id, proposed_result)
    values (p_claim_id, v_user_id, p_proposed_result)
    returning *;
end;
$$;

revoke execute on function public.create_verification_proposal(uuid, boolean) from anon, public;
grant execute on function public.create_verification_proposal(uuid, boolean) to authenticated;

create or replace function public.respond_to_proposal(p_proposal_id uuid, p_response text)
returns setof public.proposal_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_proposal record;
    v_is_allowed boolean;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_response not in ('approve', 'reject') then
        raise exception 'Invalid response: must be approve or reject';
    end if;

    select * into v_proposal
    from public.verification_proposals
    where id = p_proposal_id;

    if v_proposal.id is null then
        raise exception 'Proposal not found';
    end if;

    if v_proposal.status not in ('pending', 'tie') then
        raise exception 'This proposal is no longer accepting responses';
    end if;

    if v_proposal.proposer_id = v_user_id then
        raise exception 'You cannot respond to your own proposal';
    end if;

    select exists(
        select 1 from public.claim_participants
        where claim_id = v_proposal.claim_id and user_id = v_user_id
    ) or (v_proposal.tie_breaker_id = v_user_id)
    into v_is_allowed;

    if not v_is_allowed then
        raise exception 'You are not authorized to respond to this proposal';
    end if;

    if exists(
        select 1 from public.proposal_responses
        where proposal_id = p_proposal_id and user_id = v_user_id
    ) then
        raise exception 'You have already responded to this proposal';
    end if;

    return query
    insert into public.proposal_responses (proposal_id, user_id, response)
    values (p_proposal_id, v_user_id, p_response::public.proposal_response)
    returning *;
end;
$$;

revoke execute on function public.respond_to_proposal(uuid, text) from anon, public;
grant execute on function public.respond_to_proposal(uuid, text) to authenticated;

create or replace function public.handle_proposal_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_proposal record;
    v_total_participants int;
    v_total_responses int;
    v_approve_count int;
    v_reject_count int;
    v_random_user uuid;
begin
    select * into v_proposal
    from public.verification_proposals
    where id = new.proposal_id;

    if v_proposal.status not in ('pending', 'tie') then
        return new;
    end if;

    select count(*) into v_total_participants
    from public.claim_participants
    where claim_id = v_proposal.claim_id
      and user_id != v_proposal.proposer_id;

    if v_proposal.tie_breaker_id is not null then
        v_total_participants := v_total_participants + 1;
    end if;

    select
        count(*),
        count(*) filter (where response = 'approve'),
        count(*) filter (where response = 'reject')
    into v_total_responses, v_approve_count, v_reject_count
    from public.proposal_responses
    where proposal_id = v_proposal.id;

    if v_total_responses < v_total_participants then
        return new;
    end if;

    if v_approve_count > v_reject_count then
        update public.verification_proposals
        set status = 'resolved', resolved_at = now()
        where id = v_proposal.id;

        update public.claims
        set status = 'resolved',
            result = v_proposal.proposed_result,
            updated_at = now()
        where id = v_proposal.claim_id;
    elsif v_reject_count > v_approve_count then
        update public.verification_proposals
        set status = 'rejected', resolved_at = now()
        where id = v_proposal.id;
    else
        if v_proposal.tie_breaker_id is null then
            select p.id into v_random_user
            from public.profiles p
            where p.id not in (
                select user_id from public.claim_participants
                where claim_id = v_proposal.claim_id
            )
            and p.id != v_proposal.proposer_id
            order by random()
            limit 1;

            if v_random_user is not null then
                update public.verification_proposals
                set status = 'tie', tie_breaker_id = v_random_user
                where id = v_proposal.id;
            else
                update public.verification_proposals
                set status = 'rejected', resolved_at = now()
                where id = v_proposal.id;

                update public.claims
                set status = 'disputed', updated_at = now()
                where id = v_proposal.claim_id;
            end if;
        else
            update public.verification_proposals
            set status = 'rejected', resolved_at = now()
            where id = v_proposal.id;

            update public.claims
            set status = 'disputed', updated_at = now()
            where id = v_proposal.claim_id;
        end if;
    end if;

    return new;
end;
$$;

create trigger on_proposal_response
    after insert on public.proposal_responses
    for each row execute function public.handle_proposal_response();

create or replace function public.generate_login_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_code text;
    v_attempts int := 0;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    update public.login_codes
    set used_at = now()
    where user_id = v_user_id
      and used_at is null;

    loop
        v_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
        if not exists (
            select 1 from public.login_codes
            where code = v_code
              and used_at is null
              and expires_at > now()
        ) then
            exit;
        end if;
        v_attempts := v_attempts + 1;
        if v_attempts > 10 then
            raise exception 'Failed to generate unique code';
        end if;
    end loop;

    insert into public.login_codes (user_id, code, expires_at)
    values (v_user_id, v_code, now() + interval '5 minutes');

    return v_code;
end;
$$;

create or replace function public.redeem_login_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_record record;
begin
    select id, user_id, expires_at, used_at
    into v_record
    from public.login_codes
    where code = upper(trim(p_code))
      and used_at is null
      and expires_at > now()
    for update;

    if v_record is null then
        raise exception 'Invalid or expired code';
    end if;

    update public.login_codes
    set used_at = now()
    where id = v_record.id;

    return v_record.user_id;
end;
$$;

create or replace function public.cleanup_expired_login_codes()
returns void
language sql
security definer
set search_path = ''
as $$
    delete from public.login_codes
    where expires_at < now() - interval '24 hours';
$$;

create or replace function public.recompute_profile_stats(p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles as p
    set claims_created = coalesce(stats.claims_created, 0),
        claims_proven = coalesce(stats.claims_proven, 0),
        claims_busted = coalesce(stats.claims_busted, 0),
        bets_won = coalesce(stats.bets_won, 0),
        bets_lost = coalesce(stats.bets_lost, 0),
        total_winnings = coalesce(stats.total_winnings, 0),
        updated_at = now()
    from (
        select
            p2.id,
            cc.claims_created,
            cc.claims_proven,
            cc.claims_busted,
            bs.bets_won,
            bs.bets_lost,
            bs.total_winnings
        from public.profiles as p2
        left join (
            select
                c.owner_id,
                count(*)::int as claims_created,
                count(*) filter (where c.status = 'resolved' and c.result = true)::int as claims_proven,
                count(*) filter (where c.status = 'resolved' and c.result = false)::int as claims_busted
            from public.claims as c
            group by c.owner_id
        ) as cc on cc.owner_id = p2.id
        left join (
            select
                b.user_id,
                count(*) filter (
                    where (b.side = 'for' and c.result = true)
                       or (b.side = 'against' and c.result = false)
                )::int as bets_won,
                count(*) filter (
                    where (b.side = 'for' and c.result = false)
                       or (b.side = 'against' and c.result = true)
                )::int as bets_lost,
                coalesce(sum(
                    case
                        when (b.side = 'for' and c.result = true)
                          or (b.side = 'against' and c.result = false)
                            then b.amount
                        when (b.side = 'for' and c.result = false)
                          or (b.side = 'against' and c.result = true)
                            then -b.amount
                        else 0
                    end
                ), 0)::bigint as total_winnings
            from public.bets as b
            join public.claims as c on c.id = b.claim_id
            where c.status = 'resolved'
              and c.result is not null
            group by b.user_id
        ) as bs on bs.user_id = p2.id
        where p_user_id is null or p2.id = p_user_id
    ) as stats
    where p.id = stats.id;
end;
$$;

create or replace function public.place_bet(
    p_claim_id uuid,
    p_side public.bet_side,
    p_amount bigint
)
returns setof public.bets
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_claim record;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Bet amount must be greater than 0';
    end if;

    select id, owner_id, status
    into v_claim
    from public.claims
    where id = p_claim_id;

    if v_claim.id is null then
        raise exception 'Claim not found';
    end if;

    if v_claim.owner_id = v_user_id then
        raise exception 'You cannot bet on your own claim';
    end if;

    if exists (
        select 1
        from public.bets
        where claim_id = p_claim_id
          and user_id = v_user_id
    ) then
        raise exception 'You have already placed a bet on this claim';
    end if;

    if v_claim.status in ('resolved', 'disputed') then
        raise exception 'You cannot bet on a closed claim';
    end if;

    return query
    insert into public.bets (claim_id, user_id, side, amount)
    values (p_claim_id, v_user_id, p_side, p_amount)
    returning *;
end;
$$;

revoke execute on function public.generate_login_code() from anon;
grant execute on function public.generate_login_code() to authenticated;
grant execute on function public.redeem_login_code(text) to anon;
grant execute on function public.redeem_login_code(text) to authenticated;
revoke execute on function public.place_bet(uuid, public.bet_side, bigint) from anon, public;
grant execute on function public.place_bet(uuid, public.bet_side, bigint) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.claims enable row level security;
alter table public.bets enable row level security;
alter table public.votes enable row level security;
alter table public.claim_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_proposals enable row level security;
alter table public.proposal_responses enable row level security;
alter table public.login_codes enable row level security;

create policy "Authenticated users can view all profiles"
    on public.profiles for select
    to authenticated
    using (true);

create policy "Users can update own profile"
    on public.profiles for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

create policy "Users can view accessible claims"
    on public.claims for select
    to authenticated
    using (
        is_public = true
        or owner_id = (select auth.uid())
        or id in (select public.get_user_claim_ids((select auth.uid())))
    );

create policy "Authenticated users can create claims"
    on public.claims for insert
    to authenticated
    with check (owner_id = (select auth.uid()));

create policy "Owners can update their claims"
    on public.claims for update
    to authenticated
    using (owner_id = (select auth.uid()));

create policy "Owners can delete pending claims"
    on public.claims for delete
    to authenticated
    using (
        owner_id = (select auth.uid())
        and status = 'pending'
    );

create policy "Participants can view bets on their claims"
    on public.bets for select
    to authenticated
    using (
        claim_id in (
            select claim_id from public.claim_participants
            where user_id = (select auth.uid())
        )
        or claim_id in (
            select id from public.claims where is_public = true
        )
    );

create policy "Users can place bets"
    on public.bets for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and exists (
            select 1
            from public.claims c
            where c.id = claim_id
              and c.owner_id <> (select auth.uid())
              and c.status not in ('resolved', 'disputed')
        )
    );

create policy "Participants can view votes"
    on public.votes for select
    to authenticated
    using (
        claim_id in (
            select claim_id from public.claim_participants
            where user_id = (select auth.uid())
        )
    );

create policy "Participants can vote on voting claims"
    on public.votes for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
        and claim_id in (
            select claim_id from public.claim_participants
            where user_id = (select auth.uid())
        )
        and claim_id in (
            select id from public.claims where status = 'voting'
        )
    );

create policy "Participants can see fellow participants"
    on public.claim_participants for select
    to authenticated
    using (
        claim_id in (select public.get_user_claim_ids((select auth.uid())))
        or claim_id in (
            select id from public.claims where is_public = true
        )
    );

create policy "Users can view own notifications"
    on public.notifications for select
    to authenticated
    using (user_id = (select auth.uid()));

create policy "Users can update own notifications"
    on public.notifications for update
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy "Participants can view proposals"
    on public.verification_proposals for select
    to authenticated
    using (
        claim_id in (select public.get_user_claim_ids((select auth.uid())))
        or tie_breaker_id = (select auth.uid())
    );

create policy "Participants can create proposals"
    on public.verification_proposals for insert
    to authenticated
    with check (
        proposer_id = (select auth.uid())
    );

create policy "Participants can view responses"
    on public.proposal_responses for select
    to authenticated
    using (
        proposal_id in (
            select vp.id from public.verification_proposals vp
            where vp.claim_id in (select public.get_user_claim_ids((select auth.uid())))
               or vp.tie_breaker_id = (select auth.uid())
        )
    );

create policy "Participants can respond to proposals"
    on public.proposal_responses for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

create policy "Users can view own login codes"
    on public.login_codes for select
    to authenticated
    using (user_id = (select auth.uid()));

-- ============================================================
-- OPTIONAL pg_cron schedules
-- ============================================================
-- select cron.schedule('transition-claims-to-voting', '*/15 * * * *', 'select public.transition_claims_to_voting()');
-- select cron.schedule('cleanup-login-codes', '0 3 * * *', 'select public.cleanup_expired_login_codes()');
