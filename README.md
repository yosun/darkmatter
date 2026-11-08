# DARKMATTER

**Generative AI creates the visible 3%. We tackle the invisible 97%.**

A generated shot can look convincing until the camera moves. DARKMATTER follows the work beyond that first frame: critique it, reconstruct its world, inspect unseen surfaces, repair evidenced defects, and return to shoot again.

Four independently callable agents form the intended loop:

**Spielberg → Ebert → Spielberg → Lucas → Bohr → Spielberg → Ebert → …**

The app combines **Corgaroo’s explorable 3D garden**, camera handoffs, an observable collaboration replay and **Run live** calls to the configured Fetch.ai Agentverse agents. Ebert and Lucas are connected today. Spielberg and Bohr still need their live configuration; the full repair-and-reshoot loop remains in progress.

![Corgaroo’s saved 3D garden at the original camera](public/worlds/corgi/frames/source.jpg)

## Run it

Node.js 22.18 or newer:

```sh
npm ci
npm run dev
```

Open **[the 3D demo](http://127.0.0.1:5173/?view=3d#system)** or **[the collaboration room](http://127.0.0.1:5173/#system)**. This starts Vite on port 5173 and the event service on 8788. Replay and 3D exploration need no API keys.

## Give the demo

1. **Start with the frame.** Choose **Original camera**, then **Photo overlay** to compare the source photograph with its reconstructed garden.
2. **Leave the frame.** Drag to orbit; scroll or pinch to zoom; right-drag to pan. Explore the bicycle or meet Corgaroo up close.
3. **Expose the unseen.** Choose **Orbit 120°** and **Orbit 180°**. The isolated corgi reveals elongated tail surfaces that the front view conceals. These are actual views of the saved asset.
4. **Choose the next shot.** **Save shot + camera** downloads a PNG and camera JSON. **Use this angle → Spielberg** adds the exact pose and visible layers to shared context.
5. **Run the rehearsal.** Select **Recorded replay**. Follow messages and artifacts through all four roles. Lucas opens the world, Bohr takes an orbital camera, and Spielberg returns for another angle. Dragging pauses agent camera changes; **Following agents** restores them for subsequent handoffs.

Every artifact remains selectable. **Stop** preserves partial evidence, **Export trace** saves the run, and **↗** invokes a role independently.

## Run the real agents

Open **[Run live](https://darkmatter.wom.quest/?mode=live#system)**, or use [the local workspace](http://127.0.0.1:5173/?mode=live#system). Select **Live agents**, then **Run live**. The button shows how many roles are callable. With the current configuration it calls Ebert, passes his response into shared context, then calls Lucas. Missing roles are labeled **Not configured** rather than simulated.

For local use, fill in the ignored `.env` with `FETCH_ASI_API` and each agent’s address and endpoint, then restart `npm run dev`. Native AI3D endpoints are detected automatically; other native endpoints need `DARKMATTER_{ROLE}_TRANSPORT=agentverse`. Keep all keys server-side.

- **Ebert needs a video.** Paste a public HTTPS video URL into the workspace to request a critique. Without one, he returns his actual input instructions. A still image or 3D manifest is never passed off as a film.
- **Lucas receives the scene and prior replies.** His live output is retained as a report. The current test asks for an actual next action and required inputs; it does not approve new generation or claim a repaired world.
- **Account access stays private.** If Lucas requests account setup and `AI3D_API_KEY` is configured, the server obtains a fresh AI3D connection form, submits the key over HTTPS and completes the confirmation with the same agent. The key never enters chat. Agent chat and video reviews can consume credits; generation quotes remain unapproved.
- **Public live calls require a separate demo access key.** The owner’s release setup keeps this in `.scratch/runtime/live-access.key`. Enter it once to unlock a 24-hour browser session. Replay and manual 3D exploration remain public.

The timeline streams contact and response status. **Verified Agentverse reply** means ASI:One’s task metadata attributed that reply to the exact configured identity; normal planner prose is excluded. Exported traces include the address, session and task identifiers. It does not certify the factual quality of the reply or completion of a generation job.

**Stop waiting** aborts this app’s connection. Accepted remote work can continue. A timeout remains an explicit failure with earlier evidence retained; there is no automatic retry or replay fallback.

## The agents: objective and current evidence

| Agent | DARKMATTER responsibility | What is established today |
| --- | --- | --- |
| **[Ebert](https://agentverse.ai/agents/details/agent1q2za2cdys5evmtqq4hm4fuzl39tlwft24rgldtmm82upuuq0u7khywgtlmg/profile)** | Critique films and turn findings into direction for Spielberg | Live identity and missing-video guard verified. The public-clip review timed out through the planner with no completed result. Scores and director directives are documented by its typed protocol, but were not demonstrated in this run. |
| **Spielberg** | Generate/refine films; return to the repaired world for new angles | Replay role and manual camera handoff work. Its address and endpoint were blank in the evaluated `.env`; no live Spielberg result is claimed. |
| **[Lucas](https://agentverse.ai/agents/details/agent1qg7m4zkf6k5j80lclwfg57ym7lsxeg9gafhgc092n98mqspgwczkwqsrpr7/profile)** | Turn film/scene context into an explorable world | Deployed adaptive AI3D router. A live call returned decision `luc_6616fc2414b08f17b518` and selected Gemini 4 Argon. It described world/mesh pipelines, account linking and approval, and explicitly said it cannot directly repair an existing SPZ world. No generation was run in that probe. |
| **Bohr** | Inspect quantum-inspired camera orbitals, locate defects and prepare bounded repairs | Native inspection cameras and evidence are present. Its address and endpoint were blank in the evaluated `.env`; live inspection and repair remain unverified. |

Muse Wonder and Gemini 4 Argon are the intended generation/reasoning backends; SubQ supplies decision/evaluation signals in the deployed agent stack. Lucas owns its routing policy: SubQ supplies task evidence rather than selecting the backend itself. Predicted quality and model prices in an agent reply are not measured outcomes of a new DARKMATTER generation.

### Live evaluation — November 7, 2026

The evaluation used configured identities and credentials, **not replay text**. ASI:One’s streamed plan metadata identified the exact agent used and included its actual reply. See the [evaluation report](docs/agent-evaluation.md) and [retained evidence](docs/evaluations/2026-11-07-agentverse.json).

Both configured identities matched their HTTPS services and were active in the Agentverse registry. Their native endpoints rejected plain adapter JSON with HTTP 400 because they require **signed Agentverse envelopes**. The webapp now bridges native calls through ASI:One rather than posting that incompatible JSON. The report preserves the earlier evaluation as historical evidence.

**Replay remains a rehearsal:** its dialogue is illustrative and the world is already saved. It does not generate a new film, repair the corgi geometry, or produce an independent SubQ evaluation. The live tests are separate evidence and do not turn replay into an autonomous run.

## Evaluate the agents again

Keep credentials in the ignored `.env`; `.env.example` contains configuration names only. The evaluator uses `FETCH_ASI_API` for ASI:One and `AGENTVERSE_API_KEY` for registration reads. A deployed agent’s linked AI3D account is separate from this local environment.

```sh
# Identity, registry, readiness and adapter-contract probes; no model calls:
npm run eval:agents

# Actual Agentverse conversations through ASI:One; model usage may be billed:
npm run eval:agents -- --live

# Re-evaluate only one configured role:
npm run eval:agents -- --live --role=lucas

# Ebert can also be tested against a public clip:
npm run eval:agents -- --live --role=ebert --video=https://your-public-host/example.mp4
```

Missing roles are recorded as **not configured**. Connection links and credential values are redacted; local transcripts stay in ignored `.scratch/eval/`. Capability prompts prohibit generation, account linking and quote approval. The optional video probe requests one critic review, which may incur model usage; it does not generate or revise a video.

HTTP 200 alone is not a quality score or proof of completed work. To export actual agent replies into a shareable snapshot, run `node scripts/export-agent-evaluation.mjs <evidence-file> [...]`, review the output and scan it before committing.

## Connect the full loop

The app streams status, handoff messages, artifacts, findings, cancellation and completion over Server-Sent Events. Native Agentverse calls and JSON adapters receive preceding outputs as context. The **[integration contract](docs/adapter-contract.md)** documents both paths, native-world manifests and camera poses.

The remaining integration work is concrete:

- Add durable pending reviews and generation jobs beyond the current streamed chat bridge. Long Ebert reviews can outlast the planner’s waiting window; a timeout must not be treated as a completed critique.
- Configure Spielberg and Bohr, then verify their outputs on the same creative work.
- Turn located defect evidence into a reversible candidate; compare identical and neighboring cameras before accepting it.
- Carry the accepted world and chosen camera into a new Spielberg film, return it to Ebert, and retain independent evaluation evidence across revisions.

These are the next milestones, not capabilities implied by a key or an endpoint in `.env`.

## Development and verification

```sh
npm run typecheck
npm test
npm run build
npm run test:viewer
```

The browser check uses installed Chrome and an isolated replay service without reading `.env`. It checks actual WebGL, desktop/touch orbit, zoom, reset/resize, isolation, overlay, downloads, camera context, full replay and manual-camera preservation. Unit and HTTP tests cover streamed identity attribution, cancellation, partial runs, account setup and production access protection with fixtures.

To explicitly authorize a billed browser test against the running local app:

```sh
npm run test:live -- --live
# Production: also set DARKMATTER_CHECK_URL and DARKMATTER_LIVE_ACCESS_FILE.
```

It clicks the live button, checks each native agent’s attributed reply and exports private evidence to `.scratch/qa/`. This check is excluded from normal tests and release builds. A real response asking for input is recorded as such; it is not a completed critique or world generation.

`npm run capture:world` refreshes page images from the built native viewer; rebuild afterwards. `npm start` serves `dist/` and the API on port 8788. Run history is in memory, so export traces before restarting.

| Location | Purpose |
| --- | --- |
| `src/mission.ts` | Collaboration workspace, SSE, artifacts and camera handoffs |
| `src/world-viewer.ts` | Lazy Three.js / Spark viewer and manual controls |
| `shared/scenario.mjs` | Roles, eight-step sequence and labeled replay |
| `server/` | Orchestration, adapter calls, validation and static serving |
| `scripts/` | Development, browser checks, agent evaluations and secret scanning |
| `public/worlds/corgi/` | Source photo, manifest, five SPZ layers, captures and provenance |
| `docs/` | Agent evaluation evidence and integration contracts |

The viewer and approximately 22 MB of scene assets are self-contained. It uses no WOM iframe and fetches no scene assets from the neighboring checkout. Original file hashes and transforms are preserved in [provenance](public/worlds/corgi/provenance.json); the asset test verifies them.

## Publishing

The repository is [yosun/darkmatter](https://github.com/yosun/darkmatter). `.env`, local evaluation logs, build output, dependencies and editor workspace files stay out of Git. `npm run check:secrets` scans the actual Git index and reachable history against local credential values and common credential formats without printing matches.

The production target is **https://darkmatter.wom.quest/?view=3d#system**. The owner’s release workflow is in the sibling WOM checkout: read `docs/deployments.md` there and use `node scripts/deploy/cli.mjs darkmatter`. Source reconciliation, receipts and backups also apply to this independent app. Credentials and local `.env` files are separate from application releases.

`DARKMATTER_PUBLIC_ORIGIN` permits the configured HTTPS web origin; `DARKMATTER_HOST` controls the listen address. Local development defaults to loopback. A GitHub push and a passing build do not establish that a release is deployed.
