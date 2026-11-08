# Agentverse capability evaluation — November 7, 2026

This assessment contacted the identities configured in DARKMATTER’s local `.env`. It evaluates discovery, transport, actual replies and task boundaries. It is a small integration/capability assessment, not a film-quality benchmark or proof of autonomous improvement.

## Results

| Check | Ebert | Lucas |
| --- | --- | --- |
| HTTPS identity matches configured address | Pass | Pass |
| Native endpoint responds | HTTP 200 | HTTP 200; readiness header `ready` |
| Agentverse Almanac registration | Active, proxy transport | Active, proxy transport |
| Existing webapp JSON adapter contract | **Incompatible:** HTTP 400, `not an envelope` | **Incompatible:** HTTP 400, `malformed envelope` |
| Actual reply through ASI:One planner | Received; three task replies repeated the missing-video instructions | Received; one task returned role-specific routing and capability detail |
| Capability request elapsed time | 31.234 seconds, including planner overhead | 51.472 seconds, including planner overhead |
| Concrete media/generation result | Clip-review probe returned no completed review before planner timeout | No generation requested; no world/mesh quality result claimed |

**Spielberg and Bohr were not configured** in the evaluated environment. Their absence is recorded rather than treated as a failed model-quality test. No identities were invented or substituted.

## Ebert

The no-video probe returned the expected usage instructions: supply a public HTTPS video or AI3D hosted link, optionally with labeled prompt and model fields. It did not invent a critique or score. It also did not answer the general capability questions or echo the probe ID; this interface behaves as a specialized review service rather than a conversational product guide.

A second, positive-input probe requested one review of an existing public [5.18-second example clip](https://v3b.fal.media/files/b/0aa7ec74/bNpa9-5B0ZKqsrGfdqxZt_minimax-h3.mp4). No original generation prompt was supplied, and prompt fidelity was explicitly left unverified. This was a transport/task test, not a Corgaroo film test.

The ASI request finished after **130.875 seconds** with a failed agent task and `[NO RESPONSE RECEIVED]`. No score, verdict, timestamped issues or director directives were obtained. An HTTP 200 and a completed planner stream therefore did **not** establish a completed Ebert review. The planner also reported an internal retry; the number of server-side review executions is not established by this transcript. The evaluator did not submit another review request afterwards.

This outcome is **inconclusive for review quality**. The successful identity/registry and missing-video responses contradict a blanket claim that Ebert was offline. Possible long-running processing, delivery, quota or runtime failures need server-side correlation; this assessment does not assign a cause without that evidence.

There is a specific timing risk in the inspected chat handler: it acknowledges receipt, then sends its textual reply only after the full review finishes. The planner has its own agent-response wait limit. That mismatch is consistent with this timeout, but server-side completion has not been confirmed. The public MP4 and Ebert endpoint both still answered HTTP 200 when checked afterwards.

Inspection of Ebert’s current implementation documents a typed `EbertReview` protocol: request, immediate acceptance and later result, with an `ebert.review.v1` document carrying critic scores, issues, verdict, uncertainty and director directives. That is source-level capability evidence; a successful typed result was not observed in this run.

**Next verification:** use a durable reply collector for `EbertReviewAccepted` and `EbertReviewResult`, retain the request ID through completion, and correlate the live request with service logs before retrying. Then verify the structured review against a known clip and preserve uncertainty/fallback fields. A review directive remains a proposed revision until a new take is compared.

## Lucas

Lucas returned the supplied probe ID and routing decision **`luc_6616fc2414b08f17b518`**, selecting **Gemini 4 Argon**. Its response included typed task evidence, the chosen backend, account-linking state and the separate quote/approval workflow.

The response made useful distinctions:

- Lucas’s routing code chooses a backend using task evidence; SubQ supplies signals rather than making the route itself.
- Image-conditioned world generation can return SPZ assets and viewer links; mesh-generation pipelines have different outputs.
- The current public service cannot directly edit stretched-tail geometry inside an existing SPZ file. Regeneration or a different reconstruction pipeline is a separate operation, not a demonstrated local repair.
- The ASI sender’s AI3D account was not connected. Having an AI3D key in this app’s `.env` did not link that sender automatically.
- No generation, Bohr inspection or post-generation quality evaluation occurred in the capability probe.

Lucas reported an expected quality of 0.71 with zero observations for the selected context. **That is a routing prediction, not a measured quality score for Corgaroo.** Model names, formats and example prices in its reply are agent claims about the available catalog, not outcomes of jobs run by this evaluation.

**Next verification:** execute a bounded, explicitly approved generation through a linked account; retain the decision ID, actual artifact, charged cost, latency and structural/visual evidence. Evaluate resulting worlds independently before drawing any claim about routing quality or adaptive improvement.

## Implications for DARKMATTER

The existing native URLs are real agent transports, but they are not compatible with the app’s simple JSON adapter POST. The app now labels these endpoints **Agentverse · bridge needed** and rejects incompatible live runs locally instead of displaying a false adapter-ready state.

The native corgi viewer, orbital cameras, manual camera brief and replay are working application features. The full live circle still requires the [signed-message/reply bridge](adapter-contract.md), configured Spielberg and Bohr identities, a verified repair candidate, an actual reshoot and a new critique on that same creative work.

## Evidence and reproduction

[Machine-readable evidence](evaluations/2026-11-07-agentverse.json) contains transport results, registry digests, the exact capability requests and actual replies from tasks whose `agent_used.agent_address` matched the configured identity. It omits planner reasoning, credentials, account-connection tokens and unrelated agent metadata. Planner summaries are not used as substitutes for agent results.

```sh
npm run eval:agents
npm run eval:agents -- --live
npm run eval:agents -- --live --role=ebert --video=https://your-public-host/example.mp4
```

The live evaluator uses ASI:One planner mode with explicit agent addresses, a unique session/probe ID and a five-minute request deadline. Local evidence stays in `.scratch/eval/`; publish only a reviewed export. Missing configuration, failed requests and incomplete streams remain visible. Ordinary app tests do not call these agents or providers.

Protocol references: [Agent Chat Protocol](https://innovationlab.fetch.ai/resources/docs/agent-communication/agent-chat-protocol), [ASI:One planner progress and timing](https://docs.asi1.ai/documentation/build-with-asi-one/planner), [Agentverse discovery and registration](https://innovationlab.fetch.ai/resources/docs/agentverse/searching).
