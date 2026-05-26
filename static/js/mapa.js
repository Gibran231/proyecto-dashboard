"use strict";

// =====================================================
// mapa.js — lógica del mapa Leaflet
// =====================================================

let mapaLeaflet = null;

function pintarMapa(datos) {
    if (mapaLeaflet) {
        mapaLeaflet.remove();
        mapaLeaflet = null;
    }

    mapaLeaflet = L.map("mapa").setView([40.7128, -74.0060], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(mapaLeaflet);

    const puntosValidos = [];

    datos.forEach(p => {
        const lat = parseFloat(p.latitud);
        const lon = parseFloat(p.longitud);

        if (isNaN(lat) || isNaN(lon)) return;

        let color = p.color;
        if (!color || color === "null" || color === "None") {
            color = colorPorPromedio(p.promedio || p.ica || 0);
        }
        if (!color) return;

        puntosValidos.push([lat, lon]);

        L.circleMarker([lat, lon], {
            radius: 18,
            color: color,
            fillColor: color,
            fillOpacity: 0.75,
            weight: 4
        })
        .bindPopup(`
            <b>${p.zona ?? "—"}</b><br>
            Estado: ${p.estatus ?? "—"}<br>
            Contaminante: ${p.contaminante ?? "—"}<br>
            Promedio: ${p.promedio ?? p.ica ?? "—"}
        `)
        .addTo(mapaLeaflet);
    });

    if (puntosValidos.length > 0) {
        mapaLeaflet.fitBounds(puntosValidos, { padding: [35, 35] });
    }
}

function colorPorPromedio(valor) {
    const v = parseFloat(valor);
    if (isNaN(v)) return "#94A3B8";
    if (v <= 25)  return "#2BC55B";
    if (v <= 50)  return "#FFD93D";
    if (v <= 75)  return "#FF8A36";
    if (v <= 100) return "#D92E2E";
    return "#8A2BE2";
}
