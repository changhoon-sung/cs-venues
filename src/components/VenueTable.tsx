import type { RefObject } from "preact";
import type { SortDirection, SortKey, ViewRow } from "../types";
import { VenueRow } from "./VenueRow";

export function VenueTable(props: {
  rows: ViewRow[];
  rowsRef: RefObject<HTMLTableSectionElement>;
  timezone: string;
  sort: SortKey;
  sortDirection: SortDirection;
  now: Date;
  favoriteVenues: ReadonlySet<string>;
  onSort: (sort: SortKey) => void;
  onAreaFilter: (area: string) => void;
  onRankFilter: (rank: string) => void;
  onToggleFavorite: (title: string, button: HTMLButtonElement) => void;
  onCalendar: (title: string) => void;
}) {
  return (
    <section class="table-frame">
      <table>
        <TableColumns />
        <thead>
          <tr>
            <SortableHeader label="Venue" sortKey="title" activeSort={props.sort} direction={props.sortDirection} onSort={props.onSort} />
            <SortableHeader label="Deadline" sortKey="remaining" activeSort={props.sort} direction={props.sortDirection} onSort={props.onSort} note={`TZ: ${props.timezone}`} />
            <th>Event</th>
          </tr>
        </thead>
        <tbody id="rows" ref={props.rowsRef}>
          {props.rows.map((row) => (
            <VenueRow
              key={row.venue.title}
              row={row}
              now={props.now}
              favorite={props.favoriteVenues.has(row.venue.title)}
              onAreaFilter={props.onAreaFilter}
              onRankFilter={props.onRankFilter}
              onToggleFavorite={props.onToggleFavorite}
              onCalendar={props.onCalendar}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function TableColumns() {
  return (
    <colgroup>
      <col class="col-title" />
      <col class="col-deadline" />
      <col class="col-event" />
    </colgroup>
  );
}

export function SortableHeader(props: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  direction: SortDirection;
  note?: string;
  onSort: (sort: SortKey) => void;
}) {
  const active = props.activeSort === props.sortKey;
  return (
    <th aria-sort={active ? (props.direction === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" class={active ? "active" : ""} onClick={() => props.onSort(props.sortKey)}>
        {props.label}<span class="sort-arrow" aria-hidden="true">{active ? (props.direction === "asc" ? "↑" : "↓") : ""}</span>
      </button>
      {props.note ? <div class="th-note">{props.note}</div> : null}
    </th>
  );
}
