import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadReadinessProblems } from './load-results.mjs';
const valid = {players:70,errors:{},invariants:{attemptsPerPlayerGame:1,activeAtOnce:0,scoreEqualsLedger:true,boardMatchesAttempts:true,duplicateSubmissions:0,attemptStates:{completed:65,timed_out:5}},viewers:{subscribedChannelsAtStart:72,channelsExpected:72,channelErrors:0},top10Propagation:{samples:10}};
test('requires every expected player to finish with matching ledger and board',()=>{
 assert.deepEqual(loadReadinessProblems(valid),[]);
 assert.ok(loadReadinessProblems({...valid,invariants:{...valid.invariants,attemptStates:{completed:30}}}).includes('missing_or_active_attempts'));
 assert.ok(loadReadinessProblems({...valid,invariants:{...valid.invariants,scoreEqualsLedger:false}}).includes('score_ledger_mismatch'));
});
test('does not turn player crashes or missing realtime subscriptions into success',()=>{
 assert.ok(loadReadinessProblems({...valid,errors:{player_crash:1}}).includes('request_errors'));
 assert.ok(loadReadinessProblems({...valid,viewers:{...valid.viewers,subscribedChannelsAtStart:20}}).includes('realtime_subscriptions'));
});
