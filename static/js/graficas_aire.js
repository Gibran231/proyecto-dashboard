"use strict";

// =====================================================
// graficas_aire.js — gráficas del módulo Calidad del Aire
// =====================================================

let chartPresencia  = null;
let chartProyeccion = null;

function opcionesChartBase(color) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: "#F6FAFF", font: { size: 13 } }
            },
            tooltip: {
                backgroundColor: "#182943",
                titleColor: "#63B9FF",
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

function pintarPresencia(datos) {
    const ctx = $("presencia");
    if (!ctx) return;
    if (chartPresencia) chartPresencia.destroy();

    chartPresencia = new Chart(ctx, {
        type: "bar",
        data: {
            labels: datos?.labels || [],
            datasets: [{
                label: "ICA promedio",
                data: datos?.valores || [],
                backgroundColor: "rgba(99,185,255,.7)",
                borderColor: "#63B9FF",
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: opcionesChartBase("#63B9FF")
    });
}

function pintarProyeccion(datos) {
    const ctx = $("proyeccion");
    if (!ctx) return;
    if (chartProyeccion) chartProyeccion.destroy();

    chartProyeccion = new Chart(ctx, {
        type: "line",
        data: {
            labels: datos?.labels || [],
            datasets: [{
                label: "Promedio ICA por año",
                data: datos?.valores || [],
                borderColor: "#63B9FF",
                backgroundColor: "rgba(99,185,255,.2)",
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointBackgroundColor: "#63B9FF"
            }]
        },
        options: opcionesChartBase("#63B9FF")
    });
}
