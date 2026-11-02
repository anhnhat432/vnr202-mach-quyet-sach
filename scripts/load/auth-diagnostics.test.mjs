import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAuthLogs } from './auth-diagnostics.mjs';

test('classifies errors without leaking log contents, credentials or identities', () => {
  const input = [
    JSON.stringify({ level: 'error', msg: 'connection failed', error: 'too many connections password=secret user@example.invalid' }),
    JSON.stringify({ level: 'error', msg: 'request timed out' }),
    JSON.stringify({ level: 'error', msg: 'unexpected token abc123' }),
    JSON.stringify({ level: 'info', msg: 'ok' }),
    'not json password=secret',
  ].join('\n');
  const result = summarizeAuthLogs(input);
  assert.deepEqual(result, { errorLines: 3, connection: 1, timeout: 1, other: 1, malformed: 1 });
  assert.doesNotMatch(JSON.stringify(result), /secret|example|abc123/);
});
