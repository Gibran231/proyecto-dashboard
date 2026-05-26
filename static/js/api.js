"use strict";

// =====================================================
// api.js — funciones fetch al backend
// =====================================================

async function fetchFiltros() {
    const res = await fetch("/api/filtros");
    return res.json();
}

async function fetchDashboard(tipoZona, anio, idContaminante) {
    const params = new URLSearchParams({
        tipo_zona: tipoZona,
        anio: anio,
        id_contaminante: idContaminante
    });
    const res = await fetch("/api/dashboard?" + params);
    return res.json();
}

async function fetchFiltrosSalud(anio, contaminante, zona, salud) {
    const params = new URLSearchParams({ anio, contaminante, zona, salud });
    const res = await fetch("/api/filtros_salud?" + params);
    return res.json();
}

async function fetchSalud(anio, contaminante, zona, salud) {
    const params = new URLSearchParams({ anio, contaminante, zona, salud });
    const res = await fetch("/api/salud?" + params);
    return res.json();
}

async function fetchMuertes() {
    const res = await fetch("/api/muertes");
    return res.json();
}

async function fetchImpacto() {
    const res = await fetch("/api/impacto");
    return res.json();
}

async function fetchTendencia(salud) {
    const params = new URLSearchParams({ salud });
    const res = await fetch("/api/tendencia_hospitalizaciones?" + params);
    return res.json();
}

async function fetchIndicadoresSalud() {
    const res = await fetch("/api/indicadores_salud");
    return res.json();
}

async function fetchMapaCalorSalud(contaminante, anio) {
    const params = new URLSearchParams({ contaminante, anio });
    const res = await fetch("/api/mapa_calor_salud?" + params);
    return res.json();
}

async function fetchMapaCalorAire(tipoZona, anio, idContaminante) {
    const params = new URLSearchParams({
        tipo_zona: tipoZona,
        anio: anio,
        id_contaminante: idContaminante
    });
    const res = await fetch("/api/mapa_calor_aire?" + params);
    return res.json();
}
