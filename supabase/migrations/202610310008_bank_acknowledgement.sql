-- LA-CONTENT-014: the low-exposure target is a separate, audited decision after hard readiness.
-- Keep the old signature for existing callers, but route it through the same mandatory gate.
alter function public.transition_competition(uuid, uuid, public.competition_state) rename to transition_competition_unchecked;
revoke execute on function public.transition_competition_unchecked(uuid, uuid, public.competition_state) from public, anon, authenticated, service_role;

create function public.transition_competition_confirmed(
  p_competition_id uuid, p_actor uuid, p_target public.competition_state,
  p_expected_attempts integer, p_confirmed boolean, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.competitions;
  v_readiness jsonb;
  v_result jsonb;
begin
  perform public.arena_require_admin(p_actor);
  if p_expected_attempts is null or p_expected_attempts not between 1 and 500 then
    raise exception 'invalid_expected_attempts' using errcode = 'QA422';
  end if;
  select * into c from public.competitions where id = p_competition_id for update;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  if c.kind = 'rehearsal' and coalesce(p_confirmed, false) then
    raise exception 'confirmation_official_only' using errcode = 'QA422';
  end if;
  if c.kind = 'official' and c.state = 'draft' and p_target = 'scheduled' then
    lock table public.questions, public.question_versions, public.question_exposures, public.competition_disclosed_question_confirmations in share mode;
    v_readiness := public.question_bank_readiness('official', c.id, p_expected_attempts);
    if not (v_readiness ->> 'ready')::boolean then
      raise exception 'readiness_blocked' using errcode = 'QA422', detail = (v_readiness -> 'blockers')::text;
    end if;
    if not (v_readiness -> 'target' ->> 'meetsTarget')::boolean then
      if not coalesce(p_confirmed, false) or p_reason is null or char_length(btrim(p_reason)) not between 3 and 300 then
        raise exception 'bank_acknowledgement_required' using errcode = 'QA422';
      end if;
    end if;
    v_result := public.transition_competition_unchecked(c.id, p_actor, p_target);
    insert into public.audit_logs(actor_profile_id, action, target_type, target_id, after_redacted)
    values (p_actor, 'competition.bank_assessment', 'competition', c.id::text,
      jsonb_build_object('expectedAttempts', p_expected_attempts, 'readiness', v_readiness,
        'confirmed', coalesce(p_confirmed, false), 'reason', case when coalesce(p_confirmed, false) then btrim(p_reason) end));
    return v_result;
  end if;
  if c.kind = 'official' and c.state = 'scheduled' and p_target = 'open' and not exists (
    select 1 from public.audit_logs where target_type = 'competition' and target_id = c.id::text and action = 'competition.bank_assessment'
  ) then
    raise exception 'bank_assessment_required' using errcode = 'QA422';
  end if;
  return public.transition_competition_unchecked(c.id, p_actor, p_target);
end;
$$;

create function public.transition_competition(p_competition_id uuid, p_actor uuid, p_target public.competition_state)
returns jsonb language sql security definer set search_path = '' as $$
  select public.transition_competition_confirmed(p_competition_id, p_actor, p_target, 60, false, null)
$$;
revoke execute on function public.transition_competition_confirmed(uuid, uuid, public.competition_state, integer, boolean, text) from public, anon, authenticated;
revoke execute on function public.transition_competition(uuid, uuid, public.competition_state) from public, anon, authenticated;
grant execute on function public.transition_competition_confirmed(uuid, uuid, public.competition_state, integer, boolean, text) to service_role;
grant execute on function public.transition_competition(uuid, uuid, public.competition_state) to service_role;
