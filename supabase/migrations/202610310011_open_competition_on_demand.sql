-- CLASS-009: admin Open starts the admission window; existing readiness gates remain mandatory.
create function public.open_competition_now(p_competition_id uuid, p_actor uuid, p_start_window_minutes integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.competitions; v_now timestamptz; v_result jsonb;
begin
  perform public.arena_require_admin(p_actor);
  if p_start_window_minutes is null or p_start_window_minutes not between 1 and 1440 then
    raise exception 'invalid_start_window' using errcode = 'QA422';
  end if;
  select * into c from public.competitions where id = p_competition_id for update;
  if not found then raise exception 'competition_not_found' using errcode = 'QA404'; end if;
  if c.state <> 'scheduled' then raise exception 'illegal_transition' using errcode = 'QA409'; end if;
  v_now := public.arena_clock();
  update public.competitions set opens_at = v_now, start_deadline_at = v_now + make_interval(mins => p_start_window_minutes), updated_at = v_now where id = c.id;
  v_result := public.transition_competition_confirmed(c.id, p_actor, 'open', 60, false, null);
  insert into public.audit_logs(actor_profile_id, action, target_type, target_id, before_redacted, after_redacted)
    values(p_actor, 'competition.open_window', 'competition', c.id::text,
      jsonb_build_object('opensAt', c.opens_at, 'startDeadlineAt', c.start_deadline_at),
      jsonb_build_object('opensAt', v_now, 'startDeadlineAt', v_now + make_interval(mins => p_start_window_minutes), 'minutes', p_start_window_minutes));
  return v_result;
end;
$$;
revoke all on function public.open_competition_now(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.open_competition_now(uuid,uuid,integer) to service_role;
