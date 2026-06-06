import { formatLocal, formatRemaining } from "../deadlines";
import { AREA_NAMES, type AcceptanceRate as AcceptanceRateValue, type ViewRow } from "../types";

export function VenueRow(props: {
  row: ViewRow;
  now: Date;
  favorite: boolean;
  onAreaFilter: (area: string) => void;
  onRankFilter: (rank: string) => void;
  onToggleFavorite: (title: string, button: HTMLButtonElement) => void;
  onCalendar: (title: string) => void;
}) {
  const { venue, deadline } = props.row;
  const conf = deadline?.conf ?? venue.confs[0];
  const localDeadline = deadline ? formatLocal(deadline.instant) : "N/A";
  const remaining = deadline ? formatRemaining(deadline.instant, props.now) : "N/A";
  const deadlineMeta = deadline ? `${deadline.kind} · ${conf?.timezone ?? ""}` : "N/A";
  const soon = deadline && props.row.status === "upcoming" && deadline.instant.getTime() - props.now.getTime() < 2_592_000_000;
  return (
    <tr>
      <td>
        <div class="venue-head">
          <div class="venue-title">
            {conf?.link
              ? <a class="venue-link" href={conf.link} target="_blank" rel="noreferrer">{venue.title}</a>
              : venue.title}
            <button
              type="button"
              class={`favorite ${props.favorite ? "active" : ""}`}
              data-favorite={venue.title}
              aria-label={props.favorite ? "Remove favorite" : "Add favorite"}
              title={props.favorite ? "Remove favorite" : "Add favorite"}
              onClick={(event) => props.onToggleFavorite(venue.title, event.currentTarget)}
            />
          </div>
          <div class="venue-tags">
            <button type="button" class="area-label" onClick={() => props.onAreaFilter(venue.sub)}>{AREA_NAMES[venue.sub] ?? venue.sub}</button>
            <button type="button" class="rank" onClick={() => props.onRankFilter(venue.rank.core || "N")}>CORE {venue.rank.core || "N"}</button>
            <AcceptanceRate rate={venue.acceptanceRate} />
          </div>
        </div>
        <div class="venue-desc">{venue.description}</div>
        {deadline?.comment ? <div class="venue-note">Note: {deadline.comment}</div> : null}
      </td>
      <td>
        <div class="deadline-cell">
          <div class="deadline-primary">
            <span class={`remaining ${props.row.status} ${soon ? "soon" : ""}`}>{remaining}</span>
            {deadline && props.row.status === "upcoming"
              ? (
                <button type="button" class="calendar-button" aria-label={`Add ${venue.title} deadline to calendar`} title="Add to calendar" onClick={() => props.onCalendar(venue.title)} />
              )
              : null}
          </div>
          <div class="deadline-local">{localDeadline}</div>
          <div class="deadline-meta">{deadlineMeta}</div>
        </div>
      </td>
      <td>
        <div>{conf?.date || "N/A"}</div>
        <div class="muted">{conf?.place || ""}</div>
      </td>
    </tr>
  );
}

function AcceptanceRate({ rate }: { rate: AcceptanceRateValue | undefined }) {
  if (!rate || !Number.isFinite(rate.rate) || rate.rate <= 0) return null;
  const percent = `${(rate.rate * 100).toFixed(1)}%`;
  const label = `AR ${percent} ${rate.year}`;
  const title = `${percent} accepted (${rate.accepted}/${rate.submitted}) in ${rate.year}`;
  if (rate.source) {
    return <a class="acceptance-rate" href={rate.source} target="_blank" rel="noreferrer" title={title}>{label}</a>;
  }
  return <span class="acceptance-rate" title={title}>{label}</span>;
}
