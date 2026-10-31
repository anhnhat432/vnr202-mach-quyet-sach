// A load report is not success merely because the runner reached its final print statement.
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
