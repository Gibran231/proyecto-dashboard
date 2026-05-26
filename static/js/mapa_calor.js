"use strict";

// =====================================================
// mapa_calor.js — Mapas de calor (Salud y Aire)
// Ambos usan Leaflet con marcadores circulares y 
// gradiente de color por nivel de contaminación.
// =====================================================

let mapaCalorSalud = null;
let mapaCalorAire  = null;

// ─────────────────────────────────────────────────────
// UTILIDADES COMPARTIDAS
// ─────────────────────────────────────────────────────

/**
 * Devuelve un color hex según el valor de contaminación.
 * Verde → amarillo → naranja → rojo → violeta (escala ascendente).
 */
function colorCalor(valor) {
    const v = parseFloat(valor);
    if (isNaN(v) || v <= 0) return "#4ADE80";   // verde: sin datos / mínimo
    if (v <= 5)   return "#4ADE80";              // verde
    if (v <= 10)  return "#FDE047";              // amarillo
    if (v <= 20)  return "#FB923C";              // naranja
    if (v <= 50)  return "#F87171";              // rojo claro
    if (v <= 100) return "#DC2626";              // rojo fuerte
    return "#9333EA";                            // violeta: extremo
}

/**
 * Radio del círculo proporcional al valor (entre 10 y 30 px).
 */
function radioCalor(valor, maxValor) {
    const v  = parseFloat(valor)  || 0;
    const mx = parseFloat(maxValor) || 1;
    return 10 + Math.round((v / mx) * 20);
}

/**
 * Destruye y recrea un mapa Leaflet en el contenedor indicado.
 * Devuelve la instancia del mapa.
 */
function crearMapaBase(containerId, lat, lon, zoom) {
    const contenedor = document.getElementById(containerId);
    if (!contenedor) return null;

    // Forzar altura si el contenedor no la tiene
    if (contenedor.offsetHeight < 10) {
        contenedor.style.height = "480px";
    }

    const mapa = L.map(containerId).setView([lat, lon], zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(mapa);

    return mapa;
}

/**
 * Destruye una instancia Leaflet existente de forma segura.
 */
function destruirMapa(instancia) {
    if (instancia) {
        try { instancia.remove(); } catch (_) {}
    }
    return null;
}

// ─────────────────────────────────────────────────────
// MAPA DE CALOR — SALUD
// ─────────────────────────────────────────────────────

async function cargarMapaCalorSalud() {
    const contaminante = document.getElementById("mc-s-contaminante")?.value || "";
    const anio         = document.getElementById("mc-s-anio")?.value         || "";

    try {
        const data = await fetchMapaCalorSalud(contaminante, anio);

        if (data.error) {
            console.error("API mapa calor salud:", data.error);
            return;
        }

        const datos = data.datos || [];

        mapaCalorSalud = destruirMapa(mapaCalorSalud);
        mapaCalorSalud = crearMapaBase("mapa-calor-salud", 40.7128, -74.0060, 10);
        if (!mapaCalorSalud) return;

        if (!datos.length) {
            return;
        }

        const maxValor = Math.max(...datos.map(d => d.promedio));
        const puntos   = [];

        datos.forEach(dato => {
            const lat = parseFloat(dato.latitud);
            const lon = parseFloat(dato.longitud);
            if (isNaN(lat) || isNaN(lon)) return;

            const color  = colorCalor(dato.promedio);
            const radio  = radioCalor(dato.promedio, maxValor);

            puntos.push([lat, lon]);

            L.circleMarker([lat, lon], {
                radius:      radio,
                color:       color,
                fillColor:   color,
                fillOpacity: 0.78,
                weight:      3
            })
            .bindPopup(`
                <div style="font-family:Segoe UI,Arial;line-height:1.6;">
                    <b style="font-size:14px;">${dato.zona ?? "—"}</b><br>
                    <span style="color:#888">Contaminante:</span> ${dato.contaminante ?? "—"}<br>
                    <span style="color:#888">Año:</span> ${dato.anio ?? "—"}<br>
                    <span style="color:#888">Promedio:</span> <b>${dato.promedio ?? "—"}</b><br>
                    <span style="color:#888">Ranking:</span> #${dato.ranking ?? "—"}
                </div>
            `)
            .addTo(mapaCalorSalud);
        });

        if (puntos.length > 0) {
            mapaCalorSalud.fitBounds(puntos, { padding: [35, 35] });
        }

        pintarLeyendaCalor(mapaCalorSalud);

    } catch (err) {
        console.error("Error mapa calor salud:", err);
    }
}

// ─────────────────────────────────────────────────────
// MAPA DE CALOR — CALIDAD DEL AIRE
// ─────────────────────────────────────────────────────

async function cargarMapaCalorAire() {
    const tipoZona       = document.getElementById("tipoZona")?.value        || "";
    const anio           = document.getElementById("anio")?.value             || "";
    const idContaminante = document.getElementById("contaminante")?.value     || "";

    try {
        const data = await fetchMapaCalorAire(tipoZona, anio, idContaminante);

        if (data.error) {
            console.error("API mapa calor aire:", data.error);
            return;
        }

        const datos = data.datos || [];

        mapaCalorAire = destruirMapa(mapaCalorAire);
        mapaCalorAire = crearMapaBase("mapa-calor-aire", 40.7128, -74.0060, 10);
        if (!mapaCalorAire) return;

        if (!datos.length) return;

        const maxValor = Math.max(...datos.map(d => d.promedio));
        const puntos   = [];

        datos.forEach(dato => {
            const lat = parseFloat(dato.latitud);
            const lon = parseFloat(dato.longitud);
            if (isNaN(lat) || isNaN(lon)) return;

            const color = dato.color || colorPorPromedio(dato.promedio);
            const radio = radioCalor(dato.promedio, maxValor);

            puntos.push([lat, lon]);

            L.circleMarker([lat, lon], {
                radius:      radio,
                color:       color,
                fillColor:   color,
                fillOpacity: 0.78,
                weight:      3
            })
            .bindPopup(`
                <div style="font-family:Segoe UI,Arial;line-height:1.6;">
                    <b style="font-size:14px;">${dato.zona ?? "—"}</b><br>
                    <span style="color:#888">Contaminante:</span> ${dato.contaminante ?? "—"}<br>
                    <span style="color:#888">Promedio ICA:</span> <b>${dato.promedio ?? "—"}</b><br>
                    <span style="color:#888">Estatus:</span> <b>${dato.estatus ?? "—"}</b><br>
                    <span style="color:#888">Ranking:</span> #${dato.ranking ?? "—"}
                </div>
            `)
            .addTo(mapaCalorAire);
        });

        if (puntos.length > 0) {
            mapaCalorAire.fitBounds(puntos, { padding: [35, 35] });
        }

        pintarLeyendaAire(mapaCalorAire);

    } catch (err) {
        console.error("Error mapa calor aire:", err);
    }
}


function pintarLeyendaAire(mapa) {
    const leyenda = L.control({ position: "bottomright" });

    leyenda.onAdd = function () {
        const div = L.DomUtil.create("div", "leyenda-calor");
        div.innerHTML = `
            <b>Calidad del aire</b><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#2BC55B"></span> Bueno (≤25)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#FFD93D"></span> Regular (≤50)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#FF8A36"></span> Desfavorable (≤75)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#D92E2E"></span> Muy desfavorable (≤100)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#8A2BE2"></span> Extremadamente desfavorable (>100)</span>
        `;
        return div;
    };

    leyenda.addTo(mapa);
}

// ─────────────────────────────────────────────────────
// LEYENDA COMPARTIDA
// ─────────────────────────────────────────────────────

function pintarLeyendaCalor(mapa) {
    const leyenda = L.control({ position: "bottomright" });

    leyenda.onAdd = function () {
        const div = L.DomUtil.create("div", "leyenda-calor");
        div.innerHTML = `
            <b>Nivel de contaminación</b><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#4ADE80"></span> Muy bajo (≤5)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#FDE047"></span> Bajo (≤10)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#FB923C"></span> Moderado (≤20)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#F87171"></span> Alto (≤50)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#DC2626"></span> Muy alto (≤100)</span><br>
            <span class="leyenda-item"><span class="leyenda-color" style="background:#9333EA"></span> Extremo (>100)</span>
        `;
        return div;
    };

    leyenda.addTo(mapa);
}

// ─────────────────────────────────────────────────────
// CARGA DE FILTROS — SELECT CONTAMINANTE Y AÑO (salud)
// ─────────────────────────────────────────────────────

async function cargarFiltrosMapaCalorSalud() {
    try {
        const data = await fetchFiltrosSalud("", "", "", "");

        const selContaminante = document.getElementById("mc-s-contaminante");
        const selAnio         = document.getElementById("mc-s-anio");

        if (selContaminante) {
            selContaminante.innerHTML = `<option value="">Todos</option>`;
            (data.contaminantes || []).forEach(c => {
                const opt = document.createElement("option");
                opt.value       = c.nombre;
                opt.textContent = c.nombre;
                selContaminante.appendChild(opt);
            });
        }

        if (selAnio) {
            selAnio.innerHTML = `<option value="">Todos los años</option>`;
            (data.anios || []).forEach(a => {
                const opt = document.createElement("option");
                opt.value       = a.anio;
                opt.textContent = a.anio;
                selAnio.appendChild(opt);
            });
        }

    } catch (err) {
        console.error("Error filtros mapa calor salud:", err);
    }
}
