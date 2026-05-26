"use strict";

// =====================================================
// filtros.js — carga de selects, eventos y filtros
// =====================================================

const $ = id => document.getElementById(id);

let aniosAire = [];

// ─── HELPERS ──────────────────────────────────────────

function llenarSelect(id, datos, valueKey, textKey) {
    const select = $(id);
    if (!select) return;
    select.innerHTML = "";
    datos.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item[valueKey];
        opt.textContent = item[textKey] || "Sin dato";
        select.appendChild(opt);
    });
}

function llenarSelectSimple(id, valores, emptyLabel = "Todos") {
    const select = $(id);
    if (!select) return;
    select.innerHTML = `<option value="">${emptyLabel}</option>`;
    valores.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
    });
}

// ─── FILTROS CALIDAD DEL AIRE ─────────────────────────

async function cargarFiltrosAire() {
    try {
        const data = await fetchFiltros();

        llenarSelect("tipoZona", data.tipos_zona, "codigo", "descripcion");
        llenarSelect("contaminante", data.contaminantes, "id", "nombre");

        aniosAire = data.anios || [];
        llenarSelectSimple("anio", aniosAire.map(a => a.anio), "Todos los años");

    } catch (err) {
        console.error("Error cargando filtros aire:", err);
    }
}

function getParamsAire() {
    return {
        tipoZona: $("tipoZona")?.value || "",
        anio: $("anio")?.value || "",
        idContaminante: $("contaminante")?.value || ""
    };
}

// ─── FILTROS SALUD ────────────────────────────────────

async function cargarFiltrosSalud() {
    try {
        const data = await fetchFiltrosSalud("", "", "", "");

        llenarSelectSimple("s-anio", data.anios.map(a => a.anio), "Todos los años");
        llenarSelectSimple("s-contaminante", data.contaminantes.map(c => c.nombre), "Todos");
        llenarSelectSimple("s-zona", data.zonas.map(z => z.nombre), "Todas");

        const selectSalud = $("s-salud");
        selectSalud.innerHTML = `<option value="">Todos</option>`;
        data.saludes.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.descripcion;
            opt.textContent = s.descripcion;
            selectSalud.appendChild(opt);
        });

    } catch (err) {
        console.error("Error cargando filtros salud:", err);
    }
}

async function cargarIndicadoresHosp() {
    try {
        const data = await fetchIndicadoresSalud();
        const select = $("s-indicador-hosp");
        select.innerHTML = `<option value="">Todos los indicadores</option>`;
        data.indicadores.forEach(ind => {
            const opt = document.createElement("option");
            opt.value = ind.descripcion;
            opt.textContent = ind.descripcion;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Error cargando indicadores hospitalización:", err);
    }
}

function getParamsSalud() {
    return {
        anio: $("s-anio")?.value || "",
        contaminante: $("s-contaminante")?.value || "",
        zona: $("s-zona")?.value || "",
        salud: $("s-salud")?.value || ""
    };
}

// ─── NAVEGACIÓN DE MÓDULOS ────────────────────────────

function mostrarModulo(modulo) {
    const btnAire  = $("btn-aire");
    const btnSalud = $("btn-salud");
    const modAire  = $("modulo-aire");
    const modSalud = $("modulo-salud");
    const titulo   = $("titulo-modulo");
    const subtitulo = $("subtitulo-modulo");

    btnAire.classList.remove("activo", "activo-salud");
    btnSalud.classList.remove("activo", "activo-salud");

    if (modulo === "aire") {
        modAire.style.display  = "block";
        modSalud.style.display = "none";
        btnAire.classList.add("activo");
        titulo.textContent   = "Calidad del Aire en New York";
        subtitulo.textContent = "Índice de Calidad del Aire · Monitoreo ambiental";
    } else {
        modAire.style.display  = "none";
        modSalud.style.display = "block";
        btnSalud.classList.add("activo-salud");
        titulo.textContent   = "Módulo de Salud — New York";
        subtitulo.textContent = "Muertes · Hospitalizaciones · Impacto de contaminantes";
    }
}
