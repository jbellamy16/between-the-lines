import { TEAMS, type TeamId, type Player } from "@/lib/match";

/** Paired with visible club names; decorative to avoid duplicate announcements. */
export function Crest({
  team,
  small = false,
}: {
  team: TeamId;
  small?: boolean;
}) {
  return (
    <img
      className={`crest ${team}${small ? " small" : ""}`}
      src={`/teams/${team}.webp`}
      width="64"
      height="64"
      alt=""
      aria-hidden="true"
    />
  );
}

export function PlayerIdentity({ player }: { player: Player }) {
  return (
    <div
      className={`player-identity ${player.team}`}
      aria-label={`${TEAMS[player.team].name}, squad number ${player.number}`}
    >
      <div className="player-identity-top">
        <span>{TEAMS[player.team].code}</span>
        <Crest team={player.team} small />
      </div>
      <strong>{String(player.number).padStart(2, "0")}</strong>
      <span className="player-identity-role">{player.role}</span>
    </div>
  );
}
