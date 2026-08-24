#!/usr/bin/env node
/**
 * Free API dev port before starting Nest (avoids EADDRINUSE from stale processes).
 * Usage: node scripts/kill-api-port.mjs [port]
 */
import { execSync } from 'node:child_process';

const port = Number(process.env.PORT || process.argv[2] || 3001);
const selfPid = String(process.pid);

function killWindows(targetPort) {
  let output = '';
  try {
    output = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of output.split('\n')) {
    if (!line.includes(`:${targetPort}`) || !line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0' && pid !== selfPid) pids.add(pid);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      console.log(`[kill-api-port] Freed port ${targetPort} (stopped PID ${pid})`);
    } catch {
      // already gone
    }
  }
}

function killUnix(targetPort) {
  try {
    const pids = execSync(`lsof -ti tcp:${targetPort}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .filter((pid) => pid && pid !== selfPid);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`[kill-api-port] Freed port ${targetPort} (stopped PID ${pid})`);
      } catch {
        // already gone
      }
    }
  } catch {
    // no listeners
  }
}

if (process.platform === 'win32') killWindows(port);
else killUnix(port);
