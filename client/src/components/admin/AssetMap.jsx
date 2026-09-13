import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useI18n } from '../../lib/i18n.jsx';
import { useReference } from '../../lib/reference.js';

/**
 * Where the fleet stands, on one map.
 *
 * Read-only: every machine with coordinates becomes a dot coloured by its
 * condition, and clicking one opens that record. Tiles come from
 * OpenStreetMap, which needs no API key.
 */

const COLOUR = {
  soz: '#12A150',
  nosoz: '#E9A23B',
  yaroqsiz: '#E5484D',
};

const pin = (status) =>
  L.divIcon({
    className: 'asset-pin',
    html: `<span class="asset-pin-dot" style="background:${COLOUR[status] || '#3B5BFF'}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export default function AssetMap({ points = [], onPick, height = 360 }) {
  const { t } = useI18n();
  const { mapCenter } = useReference();
  const holder = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pickRef = useRef(onPick);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!holder.current || mapRef.current) return undefined;
    let map;
    try {
      map = L.map(holder.current, { scrollWheelZoom: true }).setView(
        [mapCenter?.lat ?? 41.3775, mapCenter?.lng ?? 64.5853],
        mapCenter?.zoom ?? 6,
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      const id = setTimeout(() => map.invalidateSize(), 250);
      return () => {
        clearTimeout(id);
        map.remove();
        mapRef.current = null;
        layerRef.current = null;
      };
    } catch {
      setFailed(true);
      return undefined;
    }
    // the centre is a constant from the reference payload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = [];

    for (const point of points) {
      if (point.lat === null || point.lng === null) continue;
      const marker = L.marker([point.lat, point.lng], { icon: pin(point.status) });
      marker.bindTooltip(
        `<b>${escapeHtml(point.model)}</b><br>${escapeHtml(point.name)}<br><em>${escapeHtml(
          point.organization,
        )}</em>`,
        { direction: 'top' },
      );
      marker.on('click', () => pickRef.current?.(point.id));
      marker.addTo(layer);
      bounds.push([point.lat, point.lng]);
    }

    if (bounds.length === 1) map.setView(bounds[0], 12);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [points]);

  if (failed) return <div className="map-offline">{t('mon.mapOffline')}</div>;

  return (
    <div className="asset-map">
      <div className="map-canvas" style={{ height }} ref={holder} />
      <div className="asset-map-legend">
        {['soz', 'nosoz', 'yaroqsiz'].map((status) => (
          <span key={status}>
            <i style={{ background: COLOUR[status] }} />
            {t(`status.${status}`)}
          </span>
        ))}
        <em>
          {points.length} {t('mon.dash.onMap')}
        </em>
      </div>
    </div>
  );
}
