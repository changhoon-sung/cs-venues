import { Fragment } from "preact";
import type { FavoriteLayout, SortDirection, SortKey, ViewRow } from "../types";
import { areaLabel, groupedFavoriteRows } from "../venue-view-model";
import { VenueRow } from "./VenueRow";
import { SortableHeader, TableColumns } from "./VenueTable";

export function FavoriteVenues(props: {
  rows: ViewRow[];
  collapsed: boolean;
  layout: FavoriteLayout;
  timezone: string;
  sort: SortKey;
  sortDirection: SortDirection;
  now: Date;
  favoriteVenues: ReadonlySet<string>;
  onToggleCollapse: () => void;
  onLayoutChange: (layout: FavoriteLayout) => void;
  onSort: (sort: SortKey) => void;
  onAreaFilter: (area: string) => void;
  onRankFilter: (rank: string) => void;
  onToggleFavorite: (title: string, button: HTMLButtonElement) => void;
  onCalendar: (title: string) => void;
}) {
  if (!props.rows.length) return <section id="favoriteVenues" class="favorite-venues" aria-label="Favorite venues" hidden />;
  const body = props.layout === "area"
    ? groupedFavoriteRows(props.rows).map((group) => (
      <Fragment key={group.area}>
        <tr class="favorite-group-row">
          <td colspan={3}>{areaLabel(group.area)}</td>
        </tr>
        {group.rows.map((row) => (
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
      </Fragment>
    ))
    : props.rows.map((row) => (
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
    ));

  return (
    <section id="favoriteVenues" class="favorite-venues" aria-label="Favorite venues">
      <div
        class="favorite-header"
        role="button"
        tabindex={0}
        aria-expanded={props.collapsed ? "false" : "true"}
        onClick={props.onToggleCollapse}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          props.onToggleCollapse();
        }}
      >
        <span class="favorite-collapse">
          <span class="favorite-collapse-icon" aria-hidden="true">{props.collapsed ? "▸" : "▾"}</span>
          <span>Favorite venues</span>
          <span class="favorite-count">{props.rows.length}</span>
        </span>
        <span class={`favorite-layout-toggle ${props.collapsed ? "hidden" : ""}`} aria-label="Favorite venue layout" onClick={(event) => event.stopPropagation()}>
          <button type="button" class={props.layout === "unified" ? "active" : ""} onClick={() => props.onLayoutChange("unified")}>Unified</button>
          <button type="button" class={props.layout === "area" ? "active" : ""} onClick={() => props.onLayoutChange("area")}>Area</button>
        </span>
      </div>
      <div class={`table-frame favorite-table-frame ${props.collapsed ? "hidden" : ""}`}>
        <table>
          <TableColumns />
          <thead>
            <tr>
              <SortableHeader label="Venue" sortKey="title" activeSort={props.sort} direction={props.sortDirection} onSort={props.onSort} />
              <SortableHeader label="Deadline" sortKey="remaining" activeSort={props.sort} direction={props.sortDirection} onSort={props.onSort} note={`TZ: ${props.timezone}`} />
              <th>Event</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    </section>
  );
}
