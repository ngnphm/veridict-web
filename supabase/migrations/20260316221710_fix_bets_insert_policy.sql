drop policy if exists "Users can place bets" on public.bets;

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
