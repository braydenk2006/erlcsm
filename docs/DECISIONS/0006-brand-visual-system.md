# ADR 0006 — Brand-aligned visual system

## Status

Accepted

## Context

The original teal/light operational UI did not match the Commandry crest logo (dark field, metallic silver, electric blue → violet gradient, subtle glow). Brand recognition on first viewport was weak.

## Decision

Adopt a dark-first visual system derived from the logo:

- Background: near-black `#05060A` with restrained blue/violet atmospheric gradients
- Accent: blue → violet brand gradient for primary actions and active navigation
- Surfaces: glass panels (`backdrop-filter` + translucent elevated fills)
- Typography: Oxanium (display) + Space Grotesk (body) — geometric/tech, not Inter/system defaults
- Logo treatment: crest is a first-class brand mark in landing, auth, and shell

Light mode remains available as a secondary palette but is not the default.

## Consequences

- Product UI now reads as the same brand as the crest
- Glow is used sparingly and tied to brand marks/CTAs, not decorative noise
- Future marketing and app surfaces should reuse `--cmd-gradient`, `.cmd-glass`, and `BrandMark`
