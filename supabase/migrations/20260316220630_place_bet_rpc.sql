drop function if exists public.place_bet(uuid, public.bet_side, bigint);
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

revoke execute on function public.place_bet(uuid, public.bet_side, bigint) from anon, public;
grant execute on function public.place_bet(uuid, public.bet_side, bigint) to authenticated;
