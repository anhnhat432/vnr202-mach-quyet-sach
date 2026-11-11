import { EVENT_GEOGRAPHY } from "./museum-data";
import type { HistoryEvent } from "./types";
export type MuseumFilters = { from?: number; to?: number; locationId?: string; topic?: string };
export function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
// Matches Three SphereGeometry UV: longitude 0 at +X, 90 E at -Z.
export function globePoint(latitude: number, longitude: number): [number, number, number] {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)].map(n => Math.abs(n) < 1e-14 ? 0 : n) as [number, number, number];
}
export function eventRange(event: Pick<HistoryEvent, "id" | "date">): [number, number] {
  const geo = EVENT_GEOGRAPHY[event.id];
  return [Number((geo?.startDate ?? event.date).slice(0, 4)), Number((geo?.endDate ?? event.date).slice(0, 4))];
}
export function filterMuseum<T extends Pick<HistoryEvent, "id" | "date">>(events: readonly T[], filters: MuseumFilters): T[] {
  return events.filter(event => {
    const [start, end] = eventRange(event);
    const geo = EVENT_GEOGRAPHY[event.id];
    return end >= (filters.from ?? 1800) && start <= (filters.to ?? 2100) && (!filters.locationId || geo?.locationIds.includes(filters.locationId)) && (!filters.topic || geo?.topic === filters.topic);
  });
}
