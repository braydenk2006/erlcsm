# ADR 0007 — Immersive entertainment shell vibe

## Status

Accepted

## Context

Stakeholders preferred a music/entertainment-app aesthetic over the earlier operational teal and crest-blue systems: dark navy atmosphere, neon accents, glass layers, pill chrome, and a floating mobile dock.

## Decision

Rework the Ordinex UI system around an immersive shell:

- Background: deep navy/slate with aurora-like neon washes (red/magenta/violet/teal)
- Primary CTA: signal-red → magenta → violet gradient, pill-shaped
- Navigation: left rail with glowing active indicator bar; floating pill dock on mobile
- Surfaces: stronger glassmorphism (`cmd-glass`, `cmd-glass-strong`)
- Typography: Syne (display) + Outfit (body)

The crest remains the brand mark; the chrome around it adopts the entertainment shell language.

## Consequences

- Product feels more premium and visually expressive
- Dense operational screens still use glass panels rather than heavy card grids in the hero
- Accessibility contrast must be checked when neon accents sit on dark navy
