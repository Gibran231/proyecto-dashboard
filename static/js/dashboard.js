"use strict";

// =====================================================
// dashboard.js — inicialización general del dashboard
// =====================================================

let tablaAireCompleta  = [];
let tablaSaludCompleta = [];

// ─── UTILIDADES ───────────────────────────────────────

function claseEstatus(estatus) {
    const e = String(estatus || "").toLowerCase();
    if (e.includes("extrem"))      return "extremo";
    if (e.includes("muy"))         return "peligroso";
    if (e.includes("desfavorable")) return "desfavorable";
    if (e.includes("regular"))     return "regular";
    if (e.includes("bueno"))       return "bueno";
    if (e.includes("razon"))       return "regular";
    return "regular";
}

function claseRiesgo(nivel) {
    const n = String(nivel || "").toLowerCase();
    if (n === "bajo")  return "badge-bajo";
    if (n === "medio") return "badge-medio";
    if (n === "alto")  return "badge-alto";
    return "badge-medio";
}

// ─── MÓDULO CALIDAD DEL AIRE ──────────────────────────

async function cargarDashboardAire() {
    try {
        const { tipoZona, anio, idContaminante } = getParamsAire();
        const data = await fetchDashboard(tipoZona, anio, idContaminante);

        if (data.error) {
            console.error("API error:", data.error);
            return;
        }

        $("maximo").textContent   = data.maximo ?? "—";
        $("promedio").textContent = data.promedio ?? "—";
        $("zona").textContent     = data.zona_mas_contaminada ?? "—";
        $("riesgo").textContent   = data.zona_mas_riesgo ?? "—";
        $("dominante").textContent = data.dominante ?? "—";

        tablaAireCompleta = data.tabla || [];
        pintarTablaAire(tablaAireCompleta);
        pintarPresencia(data.grafica_presencia);
        pintarProyeccion(data.proyeccion);

    } catch (err) {
        console.error("Error aire:", err);
    }
}

function pintarTablaAire(datos) {
    const tbody = $("tablaDatos");
    if (!tbody) return;

    if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#A9BCD6">Sin datos para los filtros seleccionados</td></tr>`;
        return;
    }

    tbody.innerHTML = datos.map(f => `
        <tr>
            <td>${f.zona ?? "—"}</td>
            <td><span class="badge ${claseEstatus(f.estatus)}">${f.estatus ?? "Sin categoría"}</span></td>
            <td><strong>${f.ica ?? "—"}</strong></td>
            <td>${f.medicion ?? "—"}</td>
            <td>${f.unidad ?? "—"}</td>
        </tr>
    `).join("");
}

function buscarTablaAire() {
    const texto = ($("buscar")?.value || "").toLowerCase();
    const filtrado = tablaAireCompleta.filter(f =>
        Object.values(f).some(v => String(v).toLowerCase().includes(texto))
    );
    pintarTablaAire(filtrado);
}

// ─── MÓDULO SALUD ─────────────────────────────────────

async function cargarDashboardSalud() {
    try {
        const { anio, contaminante, zona, salud } = getParamsSalud();
        const data = await fetchSalud(anio, contaminante, zona, salud);

        if (data.error) {
            console.error("API salud error:", data.error);
            return;
        }

        $("s-total").textContent            = data.total_registros ?? "—";
        $("s-zona-impacto").textContent     = data.zona_mayor_impacto ?? "—";
        $("s-contaminante-mayor").textContent = data.contaminante_mayor ?? "—";
        $("s-muertes").textContent          = data.total_muertes_rel ?? "—";
        $("s-hosp").textContent             = data.total_hosp ?? "—";

        tablaSaludCompleta = data.tabla || [];
        pintarTablaSalud(tablaSaludCompleta);
        pintarSaludBarras(data.grafica_barras);
        pintarSaludLinea(data.grafica_linea);

    } catch (err) {
        console.error("Error salud:", err);
    }
}

function pintarTablaSalud(datos) {
    const tbody = $("s-tablaDatos");
    if (!tbody) return;

    if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#A9BCD6">Sin datos para los filtros seleccionados</td></tr>`;
        return;
    }

    tbody.innerHTML = datos.map(f => `
        <tr>
            <td>${f.anio ?? "—"}</td>
            <td>${f.zona ?? "—"}</td>
            <td>${f.contaminante ?? "—"}</td>
            <td>${f.indicador ?? "—"}</td>
            <td><strong>${f.promedio ?? "—"}</strong></td>
            <td>${f.total_registros ?? "—"}</td>
            <td>${f.ranking ?? "—"}</td>
        </tr>
    `).join("");
}

function buscarTablaSalud() {
    const texto = ($("s-buscar")?.value || "").toLowerCase();
    const filtrado = tablaSaludCompleta.filter(f =>
        Object.values(f).some(v => String(v).toLowerCase().includes(texto))
    );
    pintarTablaSalud(filtrado);
}

async function cargarMuertes() {
    try {
        const data = await fetchMuertes();
        if (data.error) return;

        const tbody = $("muertes-tbody");
        if (tbody) {
            tbody.innerHTML = (data.datos || []).map(f => `
                <tr>
                    <td>${f.contaminante ?? "—"}</td>
                    <td>${f.indicador ?? "—"}</td>
                    <td><strong>${f.promedio ?? "—"}</strong></td>
                    <td>${f.total_registros ?? "—"}</td>
                    <td>${f.ranking ?? "—"}</td>
                </tr>
            `).join("") || `<tr><td colspan="5" style="text-align:center;color:#A9BCD6">Sin datos</td></tr>`;
        }

        pintarGraficaMuertes(data.grafica);

    } catch (err) {
        console.error("Error muertes:", err);
    }
}

async function cargarImpacto() {
    try {
        const data = await fetchImpacto();
        if (data.error) return;

        const tbody = $("impacto-tbody");
        if (tbody) {
            tbody.innerHTML = (data.datos || []).map(f => `
                <tr>
                    <td>${f.contaminante ?? "—"}</td>
                    <td><strong>${f.promedio ?? "—"}</strong></td>
                    <td>${f.total_registros ?? "—"}</td>
                    <td><span class="badge ${claseRiesgo(f.nivel_riesgo)}">${f.nivel_riesgo ?? "—"}</span></td>
                </tr>
            `).join("") || `<tr><td colspan="4" style="text-align:center;color:#A9BCD6">Sin datos</td></tr>`;
        }

        pintarGraficaImpacto(data.grafica);

    } catch (err) {
        console.error("Error impacto:", err);
    }
}

async function cargarTendencia() {
    try {
        const salud = $("s-indicador-hosp")?.value || "";
        const data = await fetchTendencia(salud);

        if (data.error) {
            console.error("API tendencia error:", data.error);
            pintarGraficaTendencia([], []);
            return;
        }

        if (!data.anios || data.anios.length === 0) {
            pintarGraficaTendencia([], []);
            return;
        }

        pintarGraficaTendencia(data.anios, data.datasets);
    } catch (err) {
        console.error("Error tendencia:", err);
        pintarGraficaTendencia([], []);
    }
}

// ─── INICIALIZACIÓN ───────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {

    // Filtros aire
    await cargarFiltrosAire();
    await cargarDashboardAire();

    // Filtros salud
    await cargarFiltrosSalud();
    await cargarIndicadoresHosp();

    // Cargar secciones estáticas de salud
    await cargarMuertes();
    await cargarImpacto();
    await cargarTendencia();

    // Filtros y mapa de calor salud
    await cargarFiltrosMapaCalorSalud();
    await cargarMapaCalorSalud();

    // Mapa de calor aire (usa filtros del módulo aire)
    await cargarMapaCalorAire();

    // ── Eventos AIRE ──────────────────────────────────
    $("actualizar")?.addEventListener("click", cargarDashboardAire);
    $("tipoZona")?.addEventListener("change", cargarDashboardAire);
    $("anio")?.addEventListener("change", cargarDashboardAire);
    $("contaminante")?.addEventListener("change", cargarDashboardAire);
    $("buscar")?.addEventListener("input", buscarTablaAire);

    // Mapa de calor aire — botón dedicado
    $("mc-a-actualizar")?.addEventListener("click", cargarMapaCalorAire);

    // ── Eventos SALUD ─────────────────────────────────
    $("s-actualizar")?.addEventListener("click", cargarDashboardSalud);
    $("s-buscar")?.addEventListener("input", buscarTablaSalud);
    $("s-filtrar-hosp")?.addEventListener("click", cargarTendencia);
    $("s-indicador-hosp")?.addEventListener("change", cargarTendencia);

    // Mapa de calor salud — botón dedicado
    $("mc-s-actualizar")?.addEventListener("click", cargarMapaCalorSalud);

});
