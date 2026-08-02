# AI safety

Package: `@commandry/ai`.

## Principle

**AI assists humans; humans decide.** Commandry will use models to draft, summarize, and retrieve — never to autonomously discipline members, alter roles, or execute ER:LC commands without explicit human confirmation.

## Default policy

```ts
export const DEFAULT_AI_SAFETY_POLICY = {
  requireHumanConfirmationForWrites: true,
  labelOutputsAsAiGenerated: true,
  respectDocumentPermissions: true,
  allowAutonomousDiscipline: false,
};
```

These flags are typed as literals so unsafe combinations fail typecheck if altered carelessly.

## Configuration

| Env | Default | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | `none` | `none` \| `openai` \| `anthropic` |
| `AI_API_KEY` | empty | Unused while provider is `none` |
| `AI_DEFAULT_MODEL` | empty | Reserved |

With `AI_PROVIDER=none`, no model calls should be made. Release 8 delivers product AI features against this policy.

## Tool confirmation

Any AI tool that would write state (create moderation actions, change memberships, send Discord messages, issue ER:LC commands, modify documents) must:

1. Propose an action payload the UI can render.
2. Require an explicit human confirm step.
3. Re-run `authorize()` as the **human actor** at confirm time (not as a privileged service account).
4. Audit both the proposal and the confirmed mutation (`source` distinguishing automation/AI assistance when added).

Read-only tools still require retrieval permissions (below).

## Retrieval permissions

When AI retrieves tenant documents, audit logs, or member profiles:

- Enforce the same permission actions as the human (`document:read`, `member:view_sensitive`, `organization:view_audit`, …).
- Do not retrieve cross-tenant corpora.
- Do not put secrets, API keys, or magic-link URLs into prompts or embeddings.
- Analytics must not log prompt/document bodies (`assertSafeAnalyticsProperties` rejects content-like keys).

## Prompt injection stance

Untrusted content (applications, documents, Discord messages) may attempt to override instructions. Mitigations planned with R8:

- Separate system vs retrieved content channels
- Refuse tool calls that escalate privilege
- Bound outputs; label AI-generated text in the UI
- Keep `allowAutonomousDiscipline: false` as a hard product rule

## What is not claimed today

No chat UI, embeddings pipeline, or provider SDK integration ships in R0/R1. The package exists so safety constraints precede feature work.
