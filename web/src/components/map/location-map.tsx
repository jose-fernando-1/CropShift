"use client";

import "leaflet/dist/leaflet.css";
import type { Layer, Path, PathOptions } from "leaflet";
import { useEffect, useRef } from "react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useMessages } from "@/i18n/use-i18n";
import type { MunicipalityFeatureCollection } from "@/lib/api/municipalities";

// Mainland Pernambuco (Fernando de Noronha is reachable via search).
const PE_BOUNDS: [[number, number], [number, number]] = [
  [-9.55, -41.45],
  [-7.2, -34.75],
];

const BASE: PathOptions = { color: "#52514e", weight: 0.6, opacity: 0.6, fillColor: "#1d5f35", fillOpacity: 0.04 };
const SELECTED: PathOptions = { color: "#1d5f35", weight: 2.5, opacity: 1, fillColor: "#1d5f35", fillOpacity: 0.22 };
const HOVER: PathOptions = { weight: 1.5, opacity: 1, fillOpacity: 0.12 };

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** The 185 polygons are pointer targets only; keyboard and screen-reader users get the search and coordinate inputs. */
function HidePolygonsFromAssistiveTech() {
  const map = useMap();
  useEffect(() => {
    map.getPanes().overlayPane.setAttribute("aria-hidden", "true");
    map.getPanes().markerPane.setAttribute("aria-hidden", "true");
  }, [map]);
  return null;
}

/** Re-centres on the selected municipality or pin. */
function FocusOn({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 9), { duration: 0.6 });
  }, [map, target]);
  return null;
}

export default function LocationMap({
  geojson,
  selectedCode,
  pin,
  focus,
  onPick,
}: {
  geojson: MunicipalityFeatureCollection;
  selectedCode: string | null;
  pin: { lat: number; lon: number } | null;
  focus: [number, number] | null;
  onPick: (lat: number, lon: number) => void;
}) {
  const t = useMessages().location;
  const layers = useRef(new Map<string, Path>());
  const selectedRef = useRef(selectedCode);

  useEffect(() => {
    selectedRef.current = selectedCode;
    for (const [code, layer] of layers.current) layer.setStyle(code === selectedCode ? SELECTED : BASE);
    if (selectedCode) layers.current.get(selectedCode)?.bringToFront();
  }, [selectedCode]);

  return (
    <MapContainer
      bounds={PE_BOUNDS}
      scrollWheelZoom={false}
      className="h-full w-full rounded-md"
      attributionControl
      aria-label={t.mapLabel}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · IBGE'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        data={geojson}
        style={(f) => (f?.properties.code === selectedRef.current ? SELECTED : BASE)}
        onEachFeature={(feature, layer: Layer) => {
          const path = layer as Path;
          const code = feature.properties.code as string;
          layers.current.set(code, path);
          path.bindTooltip(feature.properties.name as string, { sticky: true, className: "municipality-tooltip" });
          path.on({
            mouseover: () => code !== selectedRef.current && path.setStyle(HOVER),
            mouseout: () => path.setStyle(code === selectedRef.current ? SELECTED : BASE),
          });
        }}
      />
      {pin ? (
        <CircleMarker
          center={[pin.lat, pin.lon]}
          radius={7}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0b0b0b", fillOpacity: 1 }}
          interactive={false}
        />
      ) : null}
      <ClickHandler onPick={onPick} />
      <HidePolygonsFromAssistiveTech />
      <FocusOn target={focus} />
    </MapContainer>
  );
}
