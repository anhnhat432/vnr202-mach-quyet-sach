import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadReadinessProblems, isSettledContentRejection, isTransferredHeartbeatRejection } from './load-results.mjs';
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
test('accepts a content deadline rejection only after authoritative state confirms the interaction settled',()=>{
 const rejection={status:409,error:{code:'interaction_expired'}};
 assert.equal(isSettledContentRejection(rejection,{attempt:{state:'active'},interaction:{allocationId:'a',remainingMs:3000}},'a'),false);
 assert.equal(isSettledContentRejection(rejection,{attempt:{state:'active'},interaction:{allocationId:'b',remainingMs:3000}},'a'),true);
 assert.equal(isSettledContentRejection(rejection,{attempt:{state:'completed'}},'a'),true);
 assert.equal(isSettledContentRejection({status:500,error:{code:'interaction_expired'}},{attempt:{state:'completed'}},'a'),false);
 assert.equal(isSettledContentRejection({status:409,error:{code:'unexpected'}},{attempt:{state:'completed'}},'a'),false);
 assert.equal(isSettledContentRejection(rejection,{},'a'),false);
});
test('only the deliberately transferred old session may have a stale heartbeat',()=>{
 const stale={status:409,error:{code:'stale_session'}};
 assert.equal(isTransferredHeartbeatRejection(stale,true),true);
 assert.equal(isTransferredHeartbeatRejection(stale,false),false);
 assert.equal(isTransferredHeartbeatRejection({status:409,error:{code:'unexpected'}},true),false);
});
