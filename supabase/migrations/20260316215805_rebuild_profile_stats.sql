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

drop function if exists public.resolve_claim(uuid, boolean);
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
            from public.profiles as p
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

select public.recompute_profile_stats();
