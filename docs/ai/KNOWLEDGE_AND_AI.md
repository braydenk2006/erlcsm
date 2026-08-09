# Knowledge Platform & AI Assistant (Phase 10)

Two tightly-integrated pillars. The AI Assistant is **not a chatbot** — it is a grounded interface
over Ordinex's deterministic architecture. It explains, summarizes, drafts, and searches using trusted
platform intelligence and verified organizational knowledge, and it **never invents** policies,
statistics, scores, users, or documents.

## Guiding principle — reasoning order (never reversed)

```
1. Deterministic Platform Intelligence (Insights/Health/Goals/KPIs/Recommendations — Phase 9)
2. Knowledge Platform (published, permission-scoped articles)
3. Platform Data (workflow/operational/CAD/website — permission-scoped)
4. Language-Model reasoning (optional; only rewrites prose from the SAME evidence)
```

If deterministic evidence exists, the AI uses it. If a knowledge article answers the question, the AI
cites it. If nothing does, the AI says so and offers to draft an article — it does not guess.

## 1. Knowledge Platform

- **`@commandry/knowledge`** (pure, 8 unit tests): lifecycle (`draft → review → approved → published →
archived/superseded/expired` with enforced transitions), visibility (organization/department/staff/
  public), categories (policy, SOP, guide, training/department manuals, promotion requirements, rank/
  vehicle/radio/CAD procedures, administrative, FAQ, article), `slugify`, and a **deterministic search
  ranker** (`scoreArticle`/`rankArticles` — title ≫ tags/keywords > category > body frequency). There is
  exactly **one** search engine; the AI reuses it.
- **DB**: `KnowledgeArticle` (+ unique `(org, slug)`) and append-only `KnowledgeVersion` (version
  history, change summaries, rollback, compare).
- **Service** `@commandry/api/knowledge`: CRUD, lifecycle transitions (publish requires
  `knowledge.publish`), **versioning + rollback + compare** (`compareVersions` line diff), permission +
  visibility-aware `listArticles`/`getArticle`, `searchKnowledge` (published only, filtered), `getRelated`
  (explicit `relatedIds` plus inferred by shared category/tags/department — no manual linking), custom
  **categories** (org-defined, normalized), **collections/folders** (`listCollections`), and
  `getContextualKnowledge` (surface relevant SOPs/policies for a context, e.g. a patrol shift).
- **Approval reuses the Workflow Platform** — `submitArticleForApproval` routes a document through the
  built-in **"Document Approval"** workflow (the Knowledge module never re-implements review/approval
  logic); publishing is **gated** on that workflow submission being approved (`COMPLETED`).
- **UI** `/app/knowledge`: search + category + collection filters, article reader, and (for authors) a
  create/edit editor with custom category, collection, **submit-for-approval**, approval status,
  publish/archive, version history, and rollback.

## 2. AI Platform

- **`@commandry/ai`** (pure, 10 unit tests): 11 **modes** (ask/explain/summarize/draft/review/search/
  recommend/analyze/translate/compare/generate), per-mode **prompt orchestration** (grounding rules +
  citation requirements, one prompt per purpose), a **provider abstraction** (`AiProvider`), and the
  **grounded deterministic composer** — intent routing that answers strictly from retrieved evidence
  with citations, an evidence-based confidence (`high/medium/low/none`, not model certainty), suggested
  actions, and safety (drafts labeled, knowledge gaps stated, no fabrication).
- **Provider abstraction (vendor-agnostic)**: `createGroundedProvider()` (default — fully deterministic,
  no external calls) and `createLiveProvider({vendor, apiKey, model})` for OpenAI/Anthropic/Google/local.
  `resolveProvider(env)` selects a live model **only** when a key is configured; otherwise grounded. A
  live provider grounds identically — it composes the same citations/evidence/confidence/actions and only
  asks the model to rewrite prose from the SAME per-mode prompt, falling back to grounded text on any error.
- **Retrieval pipeline** `assembleContext` (permission-scoped at every step, in priority order):
  Insights → Community Health → Goals → KPIs → Recommendations → Knowledge articles → Related docs →
  (workflow/operational/CAD/website represented via the deterministic insight summary) → the user's
  question. The model never answers before retrieval completes.
- **Citation engine**: every factual answer carries `citations` (kind + label + link) drawn from the
  actual retrieved evidence; drafts are labeled AI-generated; when no source exists the answer has no
  citations and states the gap.
- **`askOrdinex`**: runs retrieval → provider → persists the conversation + messages (with citations,
  evidence, confidence, actions) → logs an `AiQueryLog` (mode/intent/answered/top-citation — no prompt
  content stored) for analytics + knowledge-gap detection.
- **Conversations**: history, pin, share, per-user + org-scoped, with search. Conversation history never
  changes deterministic platform data.
- **Analytics**: questions asked, by intent, answer rate, **knowledge gaps** (unanswered), and most-cited
  documents. Provider retention controls are org-scoped.
- **UI**: `/app/assistant` (Ask Ordinex — all 11 modes, cited answers, evidence, confidence, suggested
  actions, and **conversation history** with resume/new-chat), a Command Center **Ask Ordinex** widget,
  and Command Palette destinations. Available platform-wide.

## Permissions & security

`knowledge.view` / `knowledge.manage` / `knowledge.publish` and `ai.use` / `ai.admin` — org-aware and
server-enforced. **The AI inherits platform permissions**: every retrieval step is permission-scoped, so
it never surfaces restricted documents, private applications, internal notes, or cross-tenant data.
Verified by integration tests (cross-tenant search is forbidden; another org's published article is never
cited).

## Extension points (future)

Registry-based, no redesign: new **AI modes/prompts**, new **providers** (implement `AiProvider`), new
**knowledge categories**, new **retrieval sources** (add a permission-scoped step to `assembleContext`),
and future Voice/Meeting/Mobile assistants + plugin/marketplace/custom-org skills + enterprise knowledge
federation all plug into the same abstractions.

## How AI consumes deterministic intelligence before the model

`askOrdinex` computes the Phase 9 insights bundle (health/KPIs/recommendations/goals — themselves
deterministic and evidence-backed) and searches published knowledge **first**, assembles them into a
normalized, permission-scoped context, and only then composes the answer. The default composer is
deterministic; a configured language model receives that same evidence + a grounding prompt and may only
rewrite the prose. Either way the citations, confidence, and permission scoping come from the platform —
so AI **explains trusted insights rather than inventing them**.

## Testing

Unit: knowledge (8 — lifecycle, slugify, ranking, excerpt/citation) + AI (10 — intent routing, grounded
composition, citations, knowledge-gap/no-fabrication, draft labeling, prompt orchestration, provider
selection/determinism). Integration (7, real DB): publish→searchable (drafts excluded), versioning +
rollback, AI cites a published article, AI explains Community Health from insights, knowledge-gap with no
fabrication, conversation persistence + analytics, and tenant isolation (cross-org retrieval blocked).

## Known limitations / follow-ups

- No language-model vendor is configured in this environment, so the shipped default is the grounded
  deterministic composer; wiring a live model is a config-only change (`resolveProvider`).
- Document approval reuses the Workflow Platform's single-stage "Document Approval" template; richer
  multi-stage/judicial approval chains reuse the same engine by swapping the template.
- Deeper per-module retrieval (raw workflow/CAD/website records beyond the deterministic summary), the
  rich editor's advanced blocks (tables/diagrams/embeds), and embedding contextual knowledge inline on
  every module page (the `getContextualKnowledge` API is ready) are follow-ups; content is markdown today.
- Semantic search is deterministic lexical ranking (title/tags/keywords/body); embeddings-based semantic
  search is a future drop-in behind the same `searchKnowledge` interface.
- Voice/meeting/mobile assistants and marketplace skills are architected-for but not implemented.
