import type { createInvestigation } from "./tools";
type Evidence = ReturnType<ReturnType<typeof createInvestigation>["execute"]>;

/** A conversation-local projection. Canonical evidence stays in the registry;
 * the independent verifier never consumes this compact representation. */
export function evidenceWire() {
  const eventIds: string[] = [],
    limitations: string[] = [],
    claimIds: string[] = [];
  const actors: { id: string; name: string | null }[] = [];
  let actorUpdates: { ref: number; name: string }[] = [];
  const sentEvents = new Map<string, boolean>(),
    sentClaims = new Map<string, string>();
  let sentSource = false;
  function reference(values: string[], value: string) {
    let index = values.indexOf(value);
    if (index < 0) index = values.push(value) - 1;
    return index;
  }
  const alias = (id: string) => `c${reference(claimIds, id)}`;
  const canonical = (id: string) =>
    /^c\d+$/.test(id) ? (claimIds[Number(id.slice(1))] ?? id) : id;
  const actor = (id: string | null | undefined, name: string | null = null) => {
    if (!id) return null;
    let index = actors.findIndex((a) => a.id === id);
    if (index < 0) index = actors.push({ id, name }) - 1;
    else if (name && actors[index].name !== name) {
      actors[index] = { id, name };
      actorUpdates.push({ ref: index, name });
    }
    return index;
  };
  function compactIds(ids: string[]) {
    let prefix = ids[0] ?? "";
    for (const id of ids)
      while (!id.startsWith(prefix)) prefix = prefix.slice(0, -1);
    // Only abbreviate at a delimiter, so numbers never depend on padded suffixes.
    prefix = prefix.slice(
      0,
      Math.max(prefix.lastIndexOf(":"), prefix.lastIndexOf("-")) + 1,
    );
    return {
      eventIdPrefix: prefix,
      eventIds: ids.map((id) => id.slice(prefix.length)),
    };
  }
  // Assessments retain every measurement, challenge and verification check;
  // only repeated canonical identifiers become the same dictionary references.
  function assessment(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(assessment);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (key === "eventIds" && Array.isArray(item))
          return [
            "eventRefs",
            item.map((id: string) => reference(eventIds, id)),
          ];
        if (key === "claimId" && typeof item === "string")
          return [key, alias(item)];
        return [key, assessment(item)];
      }),
    );
  }
  const serialize = (packet: Evidence, summaryEvents = false) => {
    actorUpdates = [];
    const eventOffset = eventIds.length,
      limitationOffset = limitations.length,
      actorOffset = actors.length;
    const claims = packet.claims.flatMap((claim) => {
      const compact = {
        id: alias(claim.id),
        category: claim.category,
        team: claim.team,
        timestamp: claim.timestamp,
        rank: claim.rank,
        detail: claim.detail,
        statistics: claim.statistics,
        evidenceRefs: claim.evidenceIds.map((id) => reference(eventIds, id)),
        anchorEventId: claim.evidenceIds.at(-1),
        limitationRefs: claim.limitations.map((s) => reference(limitations, s)),
        allowedEmphasis: claim.allowedEmphasis,
        editorialGroup: claim.editorialGroup,
        incompatibleClaimIds: claim.incompatibleClaimIds.map(alias),
      };
      const serialized = JSON.stringify(compact);
      if (sentClaims.get(claim.id) === serialized) return [];
      sentClaims.set(claim.id, serialized);
      return [compact];
    });
    // Resolve names before recipients create otherwise unnamed entries.
    for (const e of packet.events) actor(e.actorId, e.playerName);
    // Fixed columns replace repeated keys. Null explicitly means unavailable.
    const events = packet.events.flatMap((e) => {
      if (
        sentEvents.get(e.id) === false ||
        (summaryEvents && sentEvents.has(e.id))
      )
        return [];
      sentEvents.set(e.id, summaryEvents);
      if (summaryEvents)
        return [
          [
            reference(eventIds, e.id),
            e.time,
            e.clock,
            e.team,
            actor(e.actorId, e.playerName),
            e.type,
            e.source.eventId === e.id ? "=" : e.source.eventId,
            e.source.provider === packet.source.provider
              ? "="
              : e.source.provider,
            e.source.precision,
            e.source.reportedMinute ?? null,
          ],
        ];
      return [
        [
          reference(eventIds, e.id),
          e.time,
          e.clock,
          e.period,
          e.team,
          actor(e.actorId, e.playerName),
          e.type,
          e.position ? [e.position.x, e.position.y] : null,
          e.end ? [e.end.x, e.end.y] : null,
          e.success ?? null,
          actor(e.recipientId),
          e.possessionId,
          e.relatedEvents.map((id) => reference(eventIds, id)),
          e.source.eventId === e.id ? "=" : e.source.eventId,
          e.source.provider === packet.source.provider
            ? "="
            : e.source.provider,
          e.source.precision,
          e.source.reportedMinute ?? null,
        ],
      ];
    });
    const {
      source,
      claims: _claims,
      events: _events,
      limitations: limits,
      ...rest
    } = packet;
    const extra = rest as Record<string, unknown>;
    if (extra.assessments) extra.assessments = assessment(extra.assessments);
    const limitationRefs = limits.map((s) => reference(limitations, s));
    const result = {
      ...rest,
      ...(!sentSource ? { source } : {}),
      eventDetail: summaryEvents
        ? "summary; query for coordinates, outcomes and possession"
        : "full",
      eventColumns: summaryEvents
        ? [
            "eventRef",
            "time",
            "clock",
            "team",
            "actorRef",
            "type",
            "sourceEventId (= canonical ID)",
            "sourceProvider (= packet provider)",
            "precision",
            "reportedMinute",
          ]
        : [
            "eventRef",
            "time",
            "clock",
            "period",
            "team",
            "actorRef",
            "type",
            "position",
            "end",
            "success",
            "recipientRef",
            "possessionId",
            "relatedEventRefs",
            "sourceEventId (= canonical ID)",
            "sourceProvider (= packet provider)",
            "precision",
            "reportedMinute",
          ],
      eventOffset,
      ...compactIds(eventIds.slice(eventOffset)),
      limitationOffset,
      limitations: limitations.slice(limitationOffset),
      limitationRefs,
      actorOffset,
      actors: actors.slice(actorOffset),
      ...(actorUpdates.length ? { actorUpdates } : {}),
      events,
      claims,
      returnedClaimIds: packet.claims.map((c) => alias(c.id)),
      returnedEventRefs: packet.events.map((e) => reference(eventIds, e.id)),
    };
    sentSource = true;
    return result;
  };
  return Object.assign(serialize, { alias, canonical });
}
