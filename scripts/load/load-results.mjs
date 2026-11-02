// A load report is not success merely because the runner reached its final print statement.
export function isSettledContentRejection(response, projection, allocationId) {
  if (response.status !== 409 || !["interaction_expired", "interaction_not_open"].includes(response.error?.code)) return false;
  if (["completed", "timed_out"].includes(projection?.attempt?.state)) return true;
  if (projection?.attempt?.state !== "active") return false;
  return !projection.interaction || projection.interaction.allocationId !== allocationId || projection.interaction.status === "expired" || projection.interaction.remainingMs === 0;
}

export function isTransferredHeartbeatRejection(response, transferred) {
  return transferred && response.status === 409 && response.error?.code === "stale_session";
}

// A rejected duplicate request is transport/Auth evidence, not evidence of double scoring.
// Keep the failure fatal to readiness, while retaining any successful authoritative projection.
export function assessDuplicateReplies(a, b) {
  const usable = r => r.status >= 200 && r.status < 300 && Number.isFinite(r.data?.result?.scoreAfter) && typeof r.data?.result?.outcome === 'string' && r.data.result.outcome.length > 0 && Number.isFinite(r.data?.projection?.attempt?.score);
  const projection = usable(a) ? a.data.projection : usable(b) ? b.data.projection : null;
  const rejected = [a, b].find(r => r.status < 200 || r.status >= 300);
  if (rejected) return { problem: `duplicate_http_${rejected.status}_${rejected.error?.code ?? 'unknown'}`, projection };
  if (!usable(a) || !usable(b)) return { problem: 'duplicate_invalid_response', projection };
  const identical = a.data.result.scoreAfter === b.data.result.scoreAfter && a.data.result.outcome === b.data.result.outcome;
  return { problem: identical ? null : 'duplicate_result_mismatch', projection };
}

export function loadReadinessProblems(report) {
  const problems = [];
  const invariant = report.invariants;
  if (Object.values(report.errors).some((count) => count > 0)) problems.push("request_errors");
  const finished = (invariant.attemptStates.completed ?? 0) + (invariant.attemptStates.timed_out ?? 0);
  if (finished !== report.players || (invariant.attemptStates.active ?? 0) > 0) problems.push("missing_or_active_attempts");
  if (invariant.attemptsPerPlayerGame !== 1 || invariant.activeAtOnce !== 0 || invariant.duplicateSubmissions !== 0) problems.push("attempt_invariants");
  if (!invariant.scoreEqualsLedger) problems.push("score_ledger_mismatch");
  if (!invariant.boardMatchesAttempts) problems.push("board_attempt_mismatch");
  if (report.viewers.subscribedChannelsAtStart !== report.viewers.channelsExpected || report.viewers.channelErrors > 0) problems.push("realtime_subscriptions");
  if (report.top10Propagation.samples === 0) problems.push("no_observed_board_changes");
  return problems;
}
