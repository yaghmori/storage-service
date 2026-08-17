"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import { Info } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { formatBytes, formatPercent } from "../lib/format";
import type { MetricsRegions } from "../hooks/use-metrics-queries";

type MetricMode = "requests" | "bytes";

interface RegionMapCardProps {
  data?: MetricsRegions;
  isLoading?: boolean;
  metric: MetricMode;
  onMetricChange: (metric: MetricMode) => void;
}

const COUNTRIES_SOURCE = "world-countries";
const COUNTRIES_FILL = "world-countries-fill";
const COUNTRIES_LINE = "world-countries-line";
const ORIGINS_SOURCE = "download-origins";
const ORIGINS_LAYER = "download-origin-points";

/**
 * The admin is self-hosted and may run without egress, so the basemap is drawn
 * from the bundled Natural Earth topology instead of a third-party tile CDN.
 */
const THEME_COLORS = {
  light: { background: "#f1f5f9", land: "#cbd5e1", border: "#94a3b8" },
  dark: { background: "#0b1220", land: "#1e293b", border: "#334155" },
} as const;

function isDarkTheme() {
  return document.documentElement.classList.contains("dark");
}

function themeColors() {
  return isDarkTheme() ? THEME_COLORS.dark : THEME_COLORS.light;
}

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": themeColors().background },
      },
    ],
  };
}

const EMPTY_POINTS: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: [],
};

/** Widest extent Natural Earth covers, minus the Antarctic sliver. */
const WORLD_BOUNDS: [[number, number], [number, number]] = [
  [-180, -58],
  [180, 84],
];

let worldGeoJsonPromise:
  | Promise<GeoJSON.FeatureCollection<GeoJSON.MultiPolygon | GeoJSON.Polygon>>
  | undefined;

/**
 * Bundled rather than fetched from /public: the proxy matcher does not exempt
 * `.json`, so a runtime request can be redirected instead of served.
 */
function loadWorldGeoJson() {
  worldGeoJsonPromise ??= import("../data/countries-110m.json").then(
    (module) => {
      const topology = (module.default ??
        module) as unknown as Topology<{ countries: GeometryCollection }>;
      return feature(
        topology,
        topology.objects.countries,
      ) as unknown as GeoJSON.FeatureCollection<
        GeoJSON.MultiPolygon | GeoJSON.Polygon
      >;
    },
  );
  return worldGeoJsonPromise;
}

export function RegionMapCard({
  data,
  isLoading,
  metric,
  onMetricChange,
}: RegionMapCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geoJsonRef =
    useRef<GeoJSON.FeatureCollection<GeoJSON.Point>>(EMPTY_POINTS);
  const [mapReady, setMapReady] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);

  const geoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: (data?.countries ?? [])
        .filter(
          (country) =>
            country.countryCode &&
            country.lat != null &&
            country.lon != null &&
            (metric === "bytes" ? country.bytes : country.requests) > 0,
        )
        .map((country) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [country.lon!, country.lat!],
          },
          properties: {
            code: country.countryCode,
            requests: country.requests,
            bytes: country.bytes,
            value: metric === "bytes" ? country.bytes : country.requests,
          },
        })),
    }),
    [data?.countries, metric],
  );
  geoJsonRef.current = geoJson;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    const map = new maplibregl.Map({
      container,
      style: baseStyle(),
      center: [0, 20],
      zoom: 0,
      minZoom: 0,
      maxZoom: 6,
      renderWorldCopies: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    const addOriginsLayer = () => {
      if (!map.getSource(ORIGINS_SOURCE)) {
        map.addSource(ORIGINS_SOURCE, {
          type: "geojson",
          data: geoJsonRef.current,
        });
      }
      if (!map.getLayer(ORIGINS_LAYER)) {
        map.addLayer({
          id: ORIGINS_LAYER,
          type: "circle",
          source: ORIGINS_SOURCE,
          paint: {
            "circle-color": "#3b82f6",
            "circle-opacity": 0.6,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["sqrt", ["max", ["to-number", ["get", "value"]], 0]],
              0,
              4,
              100,
              12,
              1000,
              24,
            ],
          },
        });
      }
    };

    const onLoad = async () => {
      const colors = themeColors();
      try {
        const countries = await loadWorldGeoJson();
        if (cancelled) return;

        map.addSource(COUNTRIES_SOURCE, { type: "geojson", data: countries });
        map.addLayer({
          id: COUNTRIES_FILL,
          type: "fill",
          source: COUNTRIES_SOURCE,
          paint: { "fill-color": colors.land },
        });
        map.addLayer({
          id: COUNTRIES_LINE,
          type: "line",
          source: COUNTRIES_SOURCE,
          paint: { "line-color": colors.border, "line-width": 0.5 },
        });
      } catch (error) {
        if (!cancelled) setBasemapFailed(true);
        console.error("Failed to render world basemap", error);
      }
      if (cancelled) return;
      addOriginsLayer();
      map.resize();
      map.fitBounds(WORLD_BOUNDS, { padding: 8, duration: 0 });
      setMapReady(true);
    };

    const showPopup = (event: maplibregl.MapMouseEvent) => {
      const hit = map.queryRenderedFeatures(event.point, {
        layers: [ORIGINS_LAYER],
      })[0];
      if (!hit) return;
      const properties = hit.properties as {
        code?: string;
        requests?: number;
        bytes?: number;
      };
      const content = document.createElement("div");
      const title = document.createElement("div");
      title.className = "font-medium";
      title.textContent = properties.code ?? "Unknown";
      const details = document.createElement("div");
      details.className = "text-xs text-muted-foreground";
      details.textContent = `${Number(properties.requests ?? 0)} requests · ${formatBytes(
        Number(properties.bytes ?? 0),
      )}`;
      content.append(title, details);
      new maplibregl.Popup({ closeButton: false, offset: 12 })
        .setLngLat(event.lngLat)
        .setDOMContent(content)
        .addTo(map);
    };

    const pointerOn = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const pointerOff = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("load", () => void onLoad());
    map.on("click", ORIGINS_LAYER, showPopup);
    map.on("mouseenter", ORIGINS_LAYER, pointerOn);
    map.on("mouseleave", ORIGINS_LAYER, pointerOff);

    // The card can lay out after init (grid mount), leaving a 0-sized canvas
    // that renders nothing. Re-measure whenever the box changes.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(() => {
      const colors = themeColors();
      if (map.getLayer("background")) {
        map.setPaintProperty("background", "background-color", colors.background);
      }
      if (map.getLayer(COUNTRIES_FILL)) {
        map.setPaintProperty(COUNTRIES_FILL, "fill-color", colors.land);
      }
      if (map.getLayer(COUNTRIES_LINE)) {
        map.setPaintProperty(COUNTRIES_LINE, "line-color", colors.border);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      themeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource(ORIGINS_SOURCE) as
      | GeoJSONSource
      | undefined;
    source?.setData(geoJson);
  }, [geoJson, mapReady]);

  const regions = data?.regions ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            Request distribution by region
            <Info className="size-3.5 text-muted-foreground" aria-hidden />
          </CardTitle>
          <CardDescription>
            Interactive download-origin map for the selected period
          </CardDescription>
        </div>
        <Select
          value={metric}
          onValueChange={(value) => {
            if (value === "requests" || value === "bytes") onMetricChange(value);
          }}
        >
          <SelectTrigger className="w-37.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="requests">Requests</SelectItem>
            <SelectItem value="bytes">Data transferred</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-90 overflow-hidden rounded-lg border bg-muted/20">
          <div ref={containerRef} className="h-full w-full" />
          {!mapReady ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading map…
            </div>
          ) : null}
          {mapReady && isLoading ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
              Loading download origins…
            </div>
          ) : null}
          {mapReady && basemapFailed ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs text-destructive shadow-sm backdrop-blur">
              World basemap failed to load
            </div>
          ) : null}
          {mapReady &&
          !basemapFailed &&
          !isLoading &&
          geoJson.features.length === 0 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
              No located downloads in this range
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {regions.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              No regional breakdown yet
            </span>
          ) : (
            regions.map((region) => (
              <span
                key={region.region}
                className="inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs"
              >
                <span
                  className="size-1.5 rounded-full bg-chart-1"
                  aria-hidden
                />
                <span className="font-medium">{region.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatPercent(region.share)}
                </span>
              </span>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
