"use client";

import type { PlayerView } from "./types";

const TEAM_COLORS: Record<string, string> = {
  Police: "#3B6CFF",
  Sheriff: "#F5A623",
  Fire: "#EF4444",
  DOT: "#F97316",
  Civilian: "#9AA4BF",
  Jail: "#A855F7",
};

export function ErlcMap({ players }: { players: PlayerView[] }) {
  const onMap = players.filter((p) => p.location.x !== null && p.location.y !== null);
  const offMap = players.length - onMap.length;

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--cmd-radius-xl)] border border-[var(--cmd-border)] bg-[#070912]">
        <svg viewBox="0 0 160 100" className="h-full w-full" role="img" aria-label="Live player map">
          <defs>
            <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(120,140,200,0.12)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="160" height="100" fill="url(#grid)" />
          {/* Stylized roads */}
          <path d="M0 50 H160 M80 0 V100 M20 0 L60 100 M140 0 L110 100" stroke="rgba(120,140,200,0.14)" strokeWidth="1" fill="none" />
          {onMap.map((player) => {
            const cx = (player.location.x ?? 0) * 160;
            const cy = (player.location.y ?? 0) * 100;
            const color = TEAM_COLORS[player.team] ?? "#9AA4BF";
            const wanted = (player.wantedStars ?? 0) > 0;
            return (
              <g key={player.id}>
                {wanted ? (
                  <circle cx={cx} cy={cy} r={4.4} fill="none" stroke="#EF4444" strokeWidth="0.8" opacity="0.9" />
                ) : null}
                <circle cx={cx} cy={cy} r={2.2} fill={color} stroke="#05060A" strokeWidth="0.6">
                  <title>
                    {(player.callsign ? `${player.callsign} · ` : "") +
                      `${player.name} (${player.team})` +
                      (player.location.zone ? ` · ${player.location.zone}` : "")}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--cmd-fg-muted)]">
        {Object.entries(TEAM_COLORS).map(([team, color]) => (
          <span key={team} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {team}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-[#EF4444]" />
          Wanted
        </span>
        {offMap > 0 ? <span>· {offMap} not reporting position</span> : null}
      </div>
    </div>
  );
}
