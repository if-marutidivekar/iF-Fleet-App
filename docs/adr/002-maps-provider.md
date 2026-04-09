# ADR 002 — Maps Provider

**Date:** 2026-04-08
**Status:** Accepted

## Context

Live trip tracking and fleet map views require a map SDK on both web and mobile.
We do not want to lock into a single provider.

## Decision

Abstract the map provider behind a `MapService` interface in the frontend code.

**Default provider:** **Mapbox** (web: `mapbox-gl`, mobile: `react-native-maps` with Mapbox tiles).

The interface exposes:
- `renderMap(container, options)` — initialise map view
- `addMarker(id, lat, lng, options)` — add/update a vehicle marker
- `removeMarker(id)` — remove a marker
- `setCenter(lat, lng, zoom)` — pan/zoom
- `showRoute(coordinates[])` — draw route polyline (Phase 2)

## Rationale

- Mapbox: generous free tier, offline map tiles support, React Native Maps is the standard RN map library.
- Abstraction: if billing or API key policy changes, only the adapter needs to swap.
- `MAPBOX_ACCESS_TOKEN` is injected at runtime (env var); never committed.

## Consequences

- Initial Sprint 3 implementation uses Mapbox.
- Google Maps can be swapped in by creating a `GoogleMapsAdapter` implementing `MapService`.
- Routing/directions features (Phase 2+) may prefer Google Maps Directions API — the abstraction allows using different providers per feature.
