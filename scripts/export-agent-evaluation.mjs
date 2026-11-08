// Export observed transport facts and actual agent replies, not planner commentary.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error('Pass one or more .scratch/eval/*.json evidence files.');
const cases = [];
for (const input of inputs) {
  const run = JSON.parse(await readFile(input, 'utf8'));
  for (const agent of run.agents) {
    const exchanges = new Map();
    for (const update of agent.live?.metadata || []) {
      for (const [phase, value] of Object.entries(update.phases || {})) {
        for (const [task, entry] of Object.entries(value.tasks || {})) {
          if (entry.agent_used?.agent_address !== agent.address || !entry.agent_response) continue;
          exchanges.set(`${phase}/${task}`, { phase, task, status: entry.status, agent: entry.agent_used.agent_address, reply: entry.agent_response });
        }
      }
    }
    cases.push({ observedAt: run.startedAt, role: agent.role, address: agent.address, configured: agent.configured,
      endpoint: agent.endpoint, identityMatched: agent.identityMatched, nativeReadiness: agent.readiness?.status,
      registry: agent.almanac?.data ? { status: agent.almanac.data.status, protocols: agent.almanac.data.protocols, endpoints: agent.almanac.data.endpoints } : null,
      appAdapterContract: agent.adapterContract ? { status: agent.adapterContract.status, error: agent.adapterContract.data?.error } : null,
      live: agent.live ? { httpStatus: agent.live.httpStatus, elapsedMs: agent.live.elapsedMs, streamCompleted: agent.live.streamCompleted,
        finishReasons: agent.live.finishReasons, request: agent.live.prompt, exchanges: [...exchanges.values()], error: agent.live.error } : null });
  }
}
const output = 'docs/evaluations/2026-11-07-agentverse.json';
await mkdir('docs/evaluations', { recursive: true });
await writeFile(output, JSON.stringify({ schema: 'darkmatter-public-agent-evaluation/1', date: '2026-11-07', timezone: 'America/Los_Angeles',
  method: 'Configured identities probed directly and through ASI:One planner. Exchanges are taken from streamed plan tasks with the exact configured agent address. ASI summaries and reasoning are omitted.',
  limitations: ['This is a small capability and integration assessment, not a quality benchmark.', 'Agent claims about available models and pricing are not generation outcomes.', 'An accepted HTTP request is not evidence that a review or generation completed.'], cases }, null, 2) + '\n');
console.log(`Exported ${cases.length} cases to ${output}. Review and scan before committing.`);
