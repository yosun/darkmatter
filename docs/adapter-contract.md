# Connecting the webapp to agents

The webapp's **Live agents** mode supports two transports: native Agentverse calls through ASI:One, and HTTP JSON adapters. The native Ebert and Lucas services accept signed envelopes; the app contacts their exact configured identities through the ASI:One planner instead of posting JSON to those URLs.

The app returns only completed task responses attributed to that identity in the streamed metadata. Planner prose, discovery results and responses from another agent cannot satisfy the call. Each response carries address, session, phase and task provenance. This establishes response attribution, not output quality.

## Configuration

Copy `.env.example` to `.env` once, then fill in local values. Keep secrets server-side; a `VITE_` prefix would expose them in browser code.

| Setting | Used for |
| --- | --- |
| `DARKMATTER_{ROLE}_AGENT_ADDRESS` | The specific Agentverse identity; `{ROLE}` is EBERT, SPIELBERG, LUCAS or BOHR |
| `DARKMATTER_{ROLE}_ENDPOINT` | Agent transport URL, or a compatible adapter URL for the webapp |
| `DARKMATTER_{ROLE}_TRANSPORT=agentverse` | Declare a native endpoint; the current AI3D `/ebert` and `/agentverse` URLs are detected automatically |
| `FETCH_ASI_API` | ASI:One planner calls made by Run live and the evaluator |
| `AGENTVERSE_API_KEY` | Read agent registration metadata during evaluation; never forwarded to agent endpoints |
| `DARKMATTER_AGENT_TOKEN` | Optional Bearer token for your app adapters; distinct from the Agentverse key |
| `AI3D_API_KEY` | Server-side linking of the bridge’s ASI identity when Lucas requests AI3D account setup; submitted only to a fresh HTTPS AI3D form, never chat |
| `MUSE_API_KEY`, `GEMINI_API`, `SUBQ_API` | Reserved for future provider integrations; not used directly by this web runner |
| `DARKMATTER_LIVE_ACCESS_TOKEN` | Separate owner demo key; production requires a signed browser session before paid calls, run inspection, events or cancellation |

Restart `npm run dev` after changing server configuration. **Connections** distinguishes missing settings from roles ready to call. Readiness is configuration evidence, not a completed network or capability check. With fewer than four callable roles, Run live invokes each configured role once and labels missing roles explicitly. The eight-step sequence is used when all four are configured; that configuration alone does not prove the full loop works.

Native calls have a five-minute local ceiling, but the planner may stop waiting sooner. No uncertain request is retried automatically. Account setup is a distinct confirmed setup sequence followed by a new task. Connection tokens and secret values are redacted from artifacts. Ebert receives a public HTTPS `videoUrl`; without one he receives a request for input instructions with no image/scene URLs.

## HTTP adapter request

For each step the service posts:

```json
{
  "runId": "unique-run-id",
  "step": 2,
  "agent": "ebert",
  "brief": "Corgaroo in the garden; preserve scene continuity",
  "instruction": "The role-specific instruction for this step",
  "context": { "artifacts": [], "findings": [], "messages": [] }
}
```

`context` contains the actual preceding outputs. Independent calls also receive the artifacts already collected in the workspace, including manual camera briefs. Each call has a three-minute response deadline. Failures retain earlier evidence and do not fall back to replay.

## Response

Return a nonempty `message`, with optional `artifact` and `findings`:

```json
{
  "message": "The source camera is available for inspection.",
  "artifact": {
    "id": "corgi-world",
    "kind": "world",
    "title": "Lucas / Corgaroo’s garden",
    "url": "/worlds/corgi/scene.json",
    "viewer": "splat",
    "preset": "orbit120"
  },
  "findings": [{ "title": "Tail geometry needs review", "detail": "Locate the defect and link its camera evidence." }]
}
```

Artifact kinds: `image`, `video`, `world`, `report`. Media uses `url`; reports use `text`. URLs must be HTTPS or a local absolute asset path. A singular `finding` object is also accepted.

`viewer: "splat"` selects the native scene-manifest viewer. Its manifest contains `source`, `camera`, `background` and `objects`; see the [saved corgi scene](../public/worlds/corgi/scene.json). Asset URLs resolve relative to the manifest. Remote assets require CORS. World artifacts without that viewer field open an external viewer link.

Camera presets are `source`, `corgi`, `orbit120`, `orbit180`, `bicycle`. An artifact can instead carry:

```json
{
  "camera": {
    "position": [0, 0, 0],
    "quaternion": [0, 0, 0, 1],
    "target": [0, 0, -3],
    "up": [0, 1, 0],
    "fovY": 49.15,
    "aspect": 1.5,
    "layers": ["garden", "corgi-dog", "red-vintage-bicycle", "wooden-garden-bench", "potted-lemon-tree"]
  }
}
```

The service validates poses and carries them into subsequent calls. Manual camera movement pauses automatic agent camera changes. Explicitly choosing a saved world artifact can restore its camera.

## Long-running work still required

The current native bridge produces report artifacts from real chat replies. It does not turn text, acknowledgements or job receipts into generated video/world assets. HTTP adapters retain their three-minute deadline. Long Ebert reviews can exceed the planner’s waiting window even though remote work continues.

Durable pending jobs, typed result collection and persistence across restarts remain necessary before autonomous generation and repair iteration. Runs currently stay in memory; export traces before restarting. Quote approval is never automatically granted by this runner.

References: [Agent Chat Protocol](https://innovationlab.fetch.ai/resources/docs/agent-communication/agent-chat-protocol), [ASI:One planner](https://docs.asi1.ai/documentation/build-with-asi-one/planner), [Agentverse discovery](https://innovationlab.fetch.ai/resources/docs/agentverse/searching).
