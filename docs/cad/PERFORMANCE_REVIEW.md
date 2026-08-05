# CAD/MDT — Performance Review

Target scale (from the rewrite spec): 100k+ records/org, 50k+ persons, thousands of
vehicles, hundreds of concurrent units, high-frequency real-time events.

## Current characteristics

| Area                   | Current                                     | Risk at scale                                               |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| List queries           | `findMany … take: 100`, no cursor           | 🔴 no pagination beyond 100; clients can't page             |
| Search                 | `contains` / `ILIKE` on name/plate          | 🔴 sequential scans on 50k–100k rows                        |
| Command Center         | one composite endpoint + 8s poll per client | 🟠 N clients × (CAD counts + ER:LC status+players) every 8s |
| Dispatch/board         | 8s `setInterval` polling per client         | 🔴 O(clients) DB load; not event-driven                     |
| Counts                 | `prisma.count` per summary call             | 🟠 6 counts per Command Center refresh                      |
| Call-number allocation | atomic increment (good)                     | ✅ correct under concurrency                                |
| Read models / caching  | none                                        | 🟠 recomputed each request                                  |
| Archival / retention   | none                                        | 🟠 unbounded table growth (ER:LC-synced calls, logs)        |
| Indexes                | `org+status`, `org+lastName`, `org+plate`   | 🟠 missing `org+createdAt/openedAt` for keyset paging       |

## Bottlenecks (highest first)

1. **Polling instead of real-time** — dispatch + command center poll every 8s. At hundreds
   of concurrent dispatchers/units this is significant, redundant DB load and still feels
   laggy. Needs an event bus (SSE/WebSocket) with tenant-isolated, permission-aware channels.
2. **Unindexed search** — person/vehicle lookup uses `contains`. At 50k+ persons this is a
   scan. Needs `pg_trgm`/GIN indexes or a dedicated search index.
3. **Unbounded lists** — `take: 100` with no cursor prevents paging large histories and
   silently truncates.
4. **No caching/read models** — Command Center recomputes counts + live status per request.

## Recommendations (M2 "search + real-time infra", M8 "scale")

- Replace polling with SSE/WebSocket real-time (tenant + permission scoped); keep polling as
  a fallback only.
- Add cursor pagination (`org+createdAt` keyset) to all list endpoints; cap + `nextCursor`.
- Add trigram indexes for `CadCivilian(firstName,lastName,robloxUsername)` and
  `CadVehicle(plate,model)`; or a search read-model.
- Cache Command Center counts (short TTL) and debounce ER:LC live fetches per org.
- Add retention/archival for ER:LC-synced calls and `CadCallLog`.
- Add load tests (k6/Artillery) for: 200 concurrent dispatchers, 500 unit status changes/min,
  100k-person search latency, before declaring scale-ready.

## Not yet measured

No load/latency benchmarks have been run; these are static-analysis findings. Formal load
testing is a Milestone 8 deliverable.
