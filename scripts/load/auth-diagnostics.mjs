import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only aggregate fixed categories: never forward provider messages, user IDs, URLs or tokens.
export function summarizeAuthLogs(input) {
  const summary = { errorLines: 0, connection: 0, timeout: 0, other: 0, malformed: 0 };
  for (const line of input.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { summary.malformed++; continue; }
    if (entry.level !== 'error' && entry.level !== 'fatal' && !(Number(entry.status) >= 500)) continue;
    summary.errorLines++;
    const details = JSON.stringify(entry).toLowerCase();
    if (/too many connections|connection (?:refused|failed|closed)|connection pool|pool exhausted/.test(details)) summary.connection++;
    else if (/timeout|timed out|deadline exceeded/.test(details)) summary.timeout++;
    else summary.other++;
  }
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(summarizeAuthLogs(readFileSync(0, 'utf8')), null, 2));
}
