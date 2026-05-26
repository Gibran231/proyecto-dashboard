"use strict";

// =====================================================
// graficas_salud.js — gráficas del módulo Salud
// =====================================================

let chartSaludBarras   = null;
let chartSaludLinea    = null;
let chartMuertes       = null;
let chartImpacto       = null;
let chartTendencia     = null;

const COLORES_SALUD = [
    "#34D399", "#F87171", "#FBBF24", "#60A5FA",
    "#A78BFA", "#F472B6", "#34D399", "#FCA5A5"
];

function opcionesSalud() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: "#F6FAFF", font: { size: 13 } }
            },
            tooltip: {
                backgroundColor: "#182943",
                titleColor: "#34D399",
                bodyColor: "#F6FAFF"
            }
        },
        scales: {
            x: {
                ticks:  { color: "#DCEAFF" },
                grid:   { color: "rgba(255,255,255,.07)" }
            },
            y: {
                ticks:  { color: "#DCEAFF" },
                grid:   { color: "rgba(255,255,255,.07)" }
            }
        }
    };
}

// Barras — promedio por contaminante (KPI salud principal)
function pintarSaludBarras(datos) {
    const ctx = $("s-grafica-barras");
    if (!ctx) return;
    if (chartSaludBarras) chartSaludBarras.destroy();

    chartSaludBarras = new Chart(ctx, {
        type: "bar",
        data: {
            labels: datos?.labels || [],
            datasets: [{
                label: "Promedio contaminación",
                data: datos?.valores || [],
                backgroundColor: COLORES_SALUD.map(c => c + "B3"),
                borderColor: COLORES_SALUD,
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            ...opcionesSalud(),
            indexAxis: "y"
        }
    });
}

// Línea — evolución histórica (KPI salud principal)
function pintarSaludLinea(datos) {
    const ctx = $("s-grafica-linea");
    if (!ctx) return;
    if (chartSaludLinea) chartSaludLinea.destroy();

    chartSaludLinea = new Chart(ctx, {
        type: "line",
        data: {
            labels: datos?.labels || [],
            datasets: [{
                label: "Promedio anual",
                data: datos?.valores || [],
                borderColor: "#34D399",
                backgroundColor: "rgba(52,211,153,.2)",
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointBackgroundColor: "#34D399"
            }]
        },
        options: opcionesSalud()
    });
}

// Barras horizontales — muertes por contaminante
function pintarGraficaMuertes(datos) {
    const ctx = $("s-grafica-muertes");
    if (!ctx) return;
    if (chartMuertes) chartMuertes.destroy();

    chartMuertes = new Chart(ctx, {
        type: "bar",
        data: {
            labels: datos?.labels || [],
            datasets: [{
                label: "Promedio contaminación (muertes)",
                data: datos?.valores || [],
                backgroundColor: "rgba(248,113,113,.75)",
                borderColor: "#F87171",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            ...opcionesSalud(),
            indexAxis: "y"
        }
    });
}

// Barras horizontales — impacto por contaminante
function pintarGraficaImpacto(datos) {
    const ctx = $("s-grafica-impacto");
    if (!ctx) return;
    if (chartImpacto) chartImpacto.destroy();

    chartImpacto = new Chart(ctx, {
        type: "bar",
        data: {
            labels: datos?.labels || [],
            datasets: [{
                label: "Promedio contaminación",
                data: datos?.valores || [],
                backgroundColor: "rgba(251,191,36,.75)",
                borderColor: "#FBBF24",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            ...opcionesSalud(),
            indexAxis: "y"
        }
    });
}

// Líneas múltiples — tendencia hospitalizaciones
function pintarGraficaTendencia(anios, datasets) {
    const ctx = $("s-grafica-tendencia");
    if (!ctx) return;
    if (chartTendencia) chartTendencia.destroy();

    if (!anios || anios.length === 0 || !datasets || datasets.length === 0) {
        chartTendencia = new Chart(ctx, {
            type: "line",
            data: { labels: [], datasets: [] },
            options: {
                ...opcionesSalud(),
                plugins: {
                    ...opcionesSalud().plugins,
                    title: {
                        display: true,
                        text: "Sin datos para el indicador seleccionado",
                        color: "#A9BCD6",
                        font: { size: 15 }
                    }
                }
            }
        });
        return;
    }

    chartTendencia = new Chart(ctx, {
        type: "line",
        data: {
            labels: anios,
            datasets: datasets
        },
        options: {
            ...opcionesSalud(),
            plugins: {
                ...opcionesSalud().plugins,
                title: { display: false }
            }
        }
    });
}
