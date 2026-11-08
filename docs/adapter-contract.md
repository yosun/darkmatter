# Connecting the webapp to agents

The webapp's **Live agents** mode calls HTTP adapters. The native Ebert and Lucas services accept signed Agentverse envelopes and reply asynchronously through Agentverse. Those URLs cannot be used as JSON adapters without a bridge.

Use `npm run eval:agents -- --live` to test the configured native agents through ASI:One. That evaluator is separate from the webapp runner. Its transcripts are not inserted into replay.

## Configuration

Copy `.env.example` to `.env` once, then fill in local values. Keep secrets server-side; a `VITE_` prefix would expose them in browser code.

| Setting | Used for |
| --- | --- |
| `DARKMATTER_{ROLE}_AGENT_ADDRESS` | The specific Agentverse identity; `{ROLE}` is EBERT, SPIELBERG, LUCAS or BOHR |
| `DARKMATTER_{ROLE}_ENDPOINT` | Agent transport URL, or a compatible adapter URL for the webapp |
| `DARKMATTER_{ROLE}_TRANSPORT=agentverse` | Declare a native endpoint; the current AI3D `/ebert` and `/agentverse` URLs are detected automatically |
| `FETCH_ASI_API` | ASI:One planner calls made by the optional live evaluator |
| `AGENTVERSE_API_KEY` | Read agent registration metadata during evaluation; never forwarded to agent endpoints |
| `DARKMATTER_AGENT_TOKEN` | Optional Bearer token for your app adapters; distinct from the Agentverse key |
| `AI3D_API_KEY`, `MUSE_API_KEY`, `GEMINI_API`, `SUBQ_API` | Reserved for provider adapters; their presence does not connect or authenticate a deployed agent's user account |

Restart `npm run dev` after changing server configuration. **Connections** distinguishes native Agentverse endpoints awaiting a bridge from configured JSON adapters. A configured adapter has not necessarily passed a network or capability test.

## Request

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

## The bridge still required

1. Translate an app request into the agent's actual chat or typed protocol; Ebert needs a video, not an invented critique of a still frame.
2. Send a signed message to the configured identity and receive authenticated replies, acknowledgements and later results.
3. Persist pending work and map final reviews, jobs and world assets into app artifacts. A receipt is not a completed film or repair.
4. Keep user-account linking, quote approval and generation spending intact. A key in this app's `.env` does not link the ASI:One sender's AI3D account.

The current three-minute adapter deadline may be shorter than a full critic/generation cycle. Long-running integration needs a durable job/polling or callback contract before enabling autonomous iteration.

References: [Agent Chat Protocol](https://innovationlab.fetch.ai/resources/docs/agent-communication/agent-chat-protocol), [ASI:One planner](https://docs.asi1.ai/documentation/build-with-asi-one/planner), [Agentverse discovery](https://innovationlab.fetch.ai/resources/docs/agentverse/searching).
