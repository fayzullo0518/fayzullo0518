import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, MapPin, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import { useI18n } from '../../lib/i18n.jsx';

/**
 * Pick where a machine stands.
 *
 * The map and the two coordinate inputs are two views of one value: clicking
 * the map fills the coordinates, and typing coordinates moves the marker. The
 * tiles come from OpenStreetMap, which needs no API key — Yandex only serves
 * tiles to registered keys, so it is not wired in here.
 */

const LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
  },
};

/** a CSS pin, so no marker image has to be bundled */
const PIN = L.divIcon({
  className: 'map-pin',
  html: '<span class="map-pin-dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const isCoord = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

export default function MapPicker({ lat, lng, onPick, onClear, center, height = 320 }) {
  const { t } = useI18n();
  const holder = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const tileRef = useRef(null);
  const pickRef = useRef(onPick);
  const [layer, setLayer] = useState('street');
  const [failed, setFailed] = useState(false);
  // bumped whenever the map is (re)created, so the marker effect runs again
  const [mapReady, setMapReady] = useState(0);

  // keep the latest callback without re-creating the map
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  /* ---- create once ---- */
  useEffect(() => {
    if (!holder.current || mapRef.current) return undefined;
    let map;
    try {
      map = L.map(holder.current, { zoomControl: true, scrollWheelZoom: true }).setView(
        [center?.lat ?? 40.3864, center?.lng ?? 71.7864],
        center?.zoom ?? 9,
      );
      tileRef.current = L.tileLayer(LAYERS.street.url, {
        attribution: LAYERS.street.attribution,
        maxZoom: LAYERS.street.maxZoom,
      }).addTo(map);
      map.on('click', (e) => {
        pickRef.current?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      });
      mapRef.current = map;
      setMapReady((n) => n + 1);
      // the modal animates open, so the container has its final size a beat later
      const id = setTimeout(() => map.invalidateSize(), 250);
      return () => {
        clearTimeout(id);
        map.remove();
        mapRef.current = null;
        // the marker belonged to the map that just went away
        markerRef.current = null;
      };
    } catch {
      setFailed(true);
      return undefined;
    }
  }, [center?.lat, center?.lng, center?.zoom]);

  /* ---- swap tiles ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(LAYERS[layer].url, {
      attribution: LAYERS[layer].attribution,
      maxZoom: LAYERS[layer].maxZoom,
    }).addTo(map);
  }, [layer]);

  /* ---- coordinates typed by hand move the marker ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isCoord(lat) || !isCoord(lng)) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    const point = [Number(lat), Number(lng)];
    if (markerRef.current) {
      markerRef.current.setLatLng(point);
    } else {
      markerRef.current = L.marker(point, { icon: PIN, draggable: true }).addTo(map);
      markerRef.current.on('dragend', (e) => {
        const { lat: dLat, lng: dLng } = e.target.getLatLng();
        pickRef.current?.(Number(dLat.toFixed(6)), Number(dLng.toFixed(6)));
      });
    }
    if (!map.getBounds().contains(point)) map.panTo(point);
  }, [lat, lng, mapReady]);

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        pickRef.current?.(Number(latitude.toFixed(6)), Number(longitude.toFixed(6)));
        mapRef.current?.setView([latitude, longitude], 15);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (failed) return <div className="map-offline">{t('mon.mapOffline')}</div>;

  return (
    <div className="map-picker">
      <div className="map-picker-bar">
        <div className="map-picker-layers">
          {Object.keys(LAYERS).map((key) => (
            <button
              key={key}
              type="button"
              className={`cat-pill${layer === key ? ' active' : ''}`}
              onClick={() => setLayer(key)}
            >
              {t(`mon.mapLayer.${key}`)}
            </button>
          ))}
        </div>
        <div className="map-picker-tools">
          <button type="button" className="btn btn-ghost btn-sm" onClick={locate}>
            <Crosshair size={13} /> {t('mon.myLocation')}
          </button>
          {isCoord(lat) && isCoord(lng) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onClear?.()}>
              <X size={13} /> {t('mon.mapClear')}
            </button>
          )}
        </div>
      </div>

      <div className="map-canvas" style={{ height }} ref={holder} />

      <p className="mn-hint map-picker-hint">
        <MapPin size={12} style={{ verticalAlign: '-2px', marginRight: 5 }} />
        {t('mon.mapHint')}
      </p>
    </div>
  );
}
