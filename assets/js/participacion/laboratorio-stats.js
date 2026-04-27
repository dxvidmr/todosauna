import { getApiV2 } from './note-evaluation-runtime.js';
import { cargarNotasActivas } from './notas.js';

async function obtenerEstadisticasGlobales() {
  try {
    const apiV2 = getApiV2();
    const [notes, statsResult] = await Promise.all([
      cargarNotasActivas(),
      apiV2 && typeof apiV2.getGlobalStats === 'function'
        ? apiV2.getGlobalStats()
        : Promise.resolve({ data: null, error: null })
    ]);

    const aggregated = Array.isArray(notes)
      ? notes.reduce((acc, note) => {
        const counts = note?.evaluaciones || {};
        acc.totalEvaluaciones += Number(counts.total || 0);
        acc.utiles += Number(counts.utiles || 0);
        acc.mejorables += Number(counts.mejorables || 0);
        return acc;
      }, {
        totalEvaluaciones: 0,
        utiles: 0,
        mejorables: 0
      })
      : {
        totalEvaluaciones: 0,
        utiles: 0,
        mejorables: 0
      };

    const totalEvaluaciones = aggregated.totalEvaluaciones;
    const utiles = aggregated.utiles;
    const mejorables = aggregated.mejorables;
    const totalSugerencias = Number(statsResult?.data?.total_sugerencias || 0);
    const total = utiles + mejorables;

    return {
      totalEvaluaciones,
      utiles,
      mejorables,
      porcentajeUtiles: total > 0 ? Math.round((utiles / total) * 100) : 0,
      porcentajeMejorables: total > 0 ? Math.round((mejorables / total) * 100) : 0,
      totalSugerencias
    };
  } catch (error) {
    console.error('Error al obtener estadisticas globales:', error);
    return {
      totalEvaluaciones: 0,
      utiles: 0,
      mejorables: 0,
      porcentajeUtiles: 0,
      porcentajeMejorables: 0,
      totalSugerencias: 0
    };
  }
}

function crearGraficoBarraHorizontal(stats) {
  const canvas = document.getElementById('statsBarChart');
  if (!canvas) return;

  if (window.statsBarChartInstance) {
    window.statsBarChartInstance.destroy();
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const evaluacionesColor =
    rootStyles.getPropertyValue('--success').trim() ||
    rootStyles.getPropertyValue('--color-primary').trim() ||
    rootStyles.getPropertyValue('--color-dark').trim();
  const sugerenciasColor =
    rootStyles.getPropertyValue('--color-primary').trim() ||
    rootStyles.getPropertyValue('--color-dark').trim();
  const totalContribuciones = stats.totalEvaluaciones + stats.totalSugerencias;

  window.statsBarChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Contribuciones'],
      datasets: [
        {
          label: 'Evaluaciones',
          data: [stats.totalEvaluaciones],
          backgroundColor: evaluacionesColor,
          borderWidth: 0,
          barPercentage: 1,
          categoryPercentage: 1
        },
        {
          label: 'Sugerencias',
          data: [stats.totalSugerencias],
          backgroundColor: sugerenciasColor,
          borderWidth: 0,
          barPercentage: 1,
          categoryPercentage: 1
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      scales: {
        x: {
          stacked: true,
          display: false,
          grid: { display: false },
          beginAtZero: true,
          max: totalContribuciones
        },
        y: {
          stacked: true,
          display: false,
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.x;
              const total = stats.totalEvaluaciones + stats.totalSugerencias;
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function crearGraficoDoughnut(stats) {
  const canvas = document.getElementById('statsDoughnutChart');
  if (!canvas) return;

  if (window.statsDoughnutChartInstance) {
    window.statsDoughnutChartInstance.destroy();
  }

  const rootStyles = getComputedStyle(document.documentElement);
  const utilColor =
    rootStyles.getPropertyValue('--success').trim() ||
    rootStyles.getPropertyValue('--color-primary').trim() ||
    rootStyles.getPropertyValue('--color-dark').trim();
  const mejorableColor =
    rootStyles.getPropertyValue('--danger').trim() ||
    rootStyles.getPropertyValue('--color-dark').trim();

  window.statsDoughnutChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Utiles', 'Mejorables'],
      datasets: [{
        data: [stats.utiles, stats.mejorables],
        backgroundColor: [utilColor, mejorableColor],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label(context) {
              const label = context.label || '';
              const value = context.parsed;
              const total = stats.utiles + stats.mejorables;
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function renderizarEstadisticasGlobales(container, stats) {
  if (!container) return;

  const totalContribuciones = stats.totalEvaluaciones + stats.totalSugerencias;
  const pctEvaluaciones = totalContribuciones > 0
    ? Math.round((stats.totalEvaluaciones / totalContribuciones) * 100)
    : 50;
  const pctSugerencias = totalContribuciones > 0
    ? Math.round((stats.totalSugerencias / totalContribuciones) * 100)
    : 50;

  container.innerHTML = `
    <div class="stats-header">
      <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
      <strong>Estadisticas globales</strong>
    </div>

    <div class="stats-seccion">
      <h4 class="stats-subtitulo">Tipos de contribucion</h4>
      <div class="stats-barra-container">
        <div class="stats-barra-leyenda">
          <div class="leyenda-item">
            <span class="leyenda-color evaluaciones"></span>
            <span class="leyenda-texto"><strong>${pctEvaluaciones}%</strong> Evaluaciones (${stats.totalEvaluaciones})</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color sugerencias"></span>
            <span class="leyenda-texto"><strong>${pctSugerencias}%</strong> Sugerencias (${stats.totalSugerencias})</span>
          </div>
        </div>
        <div class="stats-grafico-barra">
          <canvas id="statsBarChart"></canvas>
        </div>
      </div>
    </div>

    <div class="stats-seccion">
      <h4 class="stats-subtitulo">Evaluacion de notas</h4>
      <div class="stats-visualizacion">
        <div class="stats-leyenda">
          <div class="leyenda-item">
            <span class="leyenda-color util"></span>
            <span class="leyenda-texto"><strong>${stats.porcentajeUtiles}%</strong> Utiles (${stats.utiles})</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color mejorable"></span>
            <span class="leyenda-texto"><strong>${stats.porcentajeMejorables}%</strong> Mejorables (${stats.mejorables})</span>
          </div>
        </div>

        <div class="stats-grafico-circular">
          <canvas id="statsDoughnutChart"></canvas>
          <div class="chart-center-label">
            <div class="chart-number">${stats.totalEvaluaciones}</div>
            <div class="chart-sublabel">evaluaciones</div>
          </div>
        </div>
      </div>
    </div>
  `;

  window.setTimeout(() => {
    crearGraficoBarraHorizontal(stats);
    crearGraficoDoughnut(stats);
  }, 100);
}

export {
  obtenerEstadisticasGlobales,
  renderizarEstadisticasGlobales
};
