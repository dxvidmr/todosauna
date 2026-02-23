// ============================================
// ESTADÃSTICAS DE EVALUACIONES (MÃ“DULO REUTILIZABLE)
// ============================================

/**
 * Obtener estadÃ­sticas de evaluaciones para una nota
 * @param {string} notaId - ID de la nota (ej: "n-1-1")
 * @param {Object} notaData - (Opcional) Objeto de la nota con evaluaciones precargadas
 * @returns {Object} {total, utiles, mejorables} o null si no hay datos
 */
function obtenerEvaluacionesStats(notaId, notaData = null) {
  let evaluaciones = null;
  
  // OpciÃ³n 1: Si se pasa el objeto nota directamente con evaluaciones
  if (notaData && notaData.evaluaciones) {
    evaluaciones = notaData.evaluaciones;
    console.log(`[EvalStats] Usando evaluaciones de notaData para ${notaId}:`, evaluaciones);
  }
  // OpciÃ³n 2: Buscar en el cachÃ© global
  else if (window.notasActivasCache) {
    const notaEnCache = window.notasActivasCache.find(n => n.nota_id === notaId);
    if (notaEnCache && notaEnCache.evaluaciones) {
      evaluaciones = notaEnCache.evaluaciones;
      console.log(`[EvalStats] Encontrado en cachÃ© para ${notaId}:`, evaluaciones);
    } else {
      console.log(`[EvalStats] No encontrado en cachÃ©: ${notaId}`);
    }
  } else {
    console.log(`[EvalStats] CachÃ© no disponible para ${notaId}`);
  }
  
  // Si no hay evaluaciones, usar contador vacÃ­o
  if (!evaluaciones) {
    evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
  }
  
  return evaluaciones;
}

/**
 * Crear HTML con contadores integrados en botones + mensaje "SÃ© el primero"
 * @param {string} notaId - ID de la nota
 * @param {string} version - VersiÃ³n de la nota
 * @param {Object} evaluaciones - {total, utiles, mejorables}
 * @returns {string} HTML de botones con contadores
 */
function crearBotonesConContadores(notaId, version, evaluaciones) {
  const { total, utiles, mejorables } = evaluaciones;
  
  // Mensaje si no hay evaluaciones
  const mensajePrimero = total === 0 
    ? '<p class="eval-mensaje-primero">Â¡SÃ© el primero en evaluarla!</p>'
    : '';
  
  return `
    <div class="evaluacion-header">
      <span>Â¿Te resulta Ãºtil esta nota?</span>
    </div>
    <div class="evaluacion-botones">
      <button class="btn btn-outline-success btn-evaluar btn-util" data-nota-id="${notaId}" data-version="${version}">
        <span class="btn-contador">${utiles}</span>
        <i class="fa-solid fa-heart" aria-hidden="true"></i>
        Ãštil
      </button>
      <button class="btn btn-outline-danger btn-evaluar btn-mejorable" data-nota-id="${notaId}" data-version="${version}">
        <span class="btn-contador">${mejorables}</span>
        <i class="fa-solid fa-heart-crack" aria-hidden="true"></i>
        Mejorable
      </button>
    </div>
    ${mensajePrimero}
    <div class="evaluacion-comentario" style="display:none;">
      <textarea placeholder="[opcional] Â¿QuÃ© cambiarÃ­as? Puedes explicar lo que no te gusta o redactar una nueva nota." rows="3"></textarea>
      <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
      <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
    </div>
  `;
}

/**
 * Adjuntar listeners de evaluaciÃ³n a botones (REUTILIZABLE)
 * @param {HTMLElement} container - Contenedor con los botones
 * @param {string} notaId - ID de la nota
 * @param {string} version - VersiÃ³n de la nota
 * @param {Function} registrarCallback - Callback async(notaId, version, vote, comment) => boolean
 * @param {Function} feedbackCallback - Callback(notaId, vote) => void
 */
function attachEvaluationListeners(container, notaId, version, registrarCallback, feedbackCallback) {
  const btnUtil = container.querySelector('.btn-util');
  const btnMejorable = container.querySelector('.btn-mejorable');
  const comentarioDiv = container.querySelector('.evaluacion-comentario, .nota-comentario');
  const textarea = comentarioDiv?.querySelector('textarea');
  const btnEnviar = comentarioDiv?.querySelector('.btn-enviar-comentario');
  const btnCancelar = comentarioDiv?.querySelector('.btn-cancelar-comentario');
  const evaluacionRoot =
    comentarioDiv?.closest('.nota-evaluacion') ||
    container.closest('.nota-evaluacion') ||
    container;

  if (!btnUtil || !btnMejorable) {
    console.warn('Botones de evaluaciÃ³n no encontrados');
    return;
  }

  const enterCommentMode = () => {
    if (evaluacionRoot) {
      evaluacionRoot.classList.add('is-commenting');
    }
    if (comentarioDiv) {
      comentarioDiv.style.display = 'block';
    }
    textarea?.focus();
  };

  const exitCommentMode = ({ clear } = { clear: false }) => {
    if (evaluacionRoot) {
      evaluacionRoot.classList.remove('is-commenting');
    }
    if (comentarioDiv) {
      comentarioDiv.style.display = 'none';
      if (clear && textarea) {
        textarea.value = '';
      }
    }
  };

  // BotÃ³n "Ãštil"
  btnUtil.addEventListener('click', async () => {
    exitCommentMode({ clear: false });
    const exito = await registrarCallback(notaId, version, 'up', null);
    if (exito) {
      actualizarContadorLocal(notaId, 'up');
      if (feedbackCallback) feedbackCallback(notaId, 'up');
    }
  });

  // BotÃ³n "Mejorable" - reemplazar vista por comentario
  btnMejorable.addEventListener('click', () => {
    enterCommentMode();
  });

  // BotÃ³n "Enviar comentario"
  btnEnviar?.addEventListener('click', async () => {
    const comentario = textarea?.value.trim() || null;
    const exito = await registrarCallback(notaId, version, 'down', comentario);
    if (exito) {
      actualizarContadorLocal(notaId, 'down');
      if (feedbackCallback) feedbackCallback(notaId, 'down');
    }
  });

  // BotÃ³n "Cancelar"
  btnCancelar?.addEventListener('click', () => {
    exitCommentMode({ clear: true });
  });
}

console.log('âœ“ Evaluaciones-stats.js cargado');

/**
 * Actualizar contador de evaluaciones localmente despuÃ©s de evaluar
 * @param {string} notaId - ID de la nota evaluada
 * @param {string} vote - 'up' o 'down' (o 'util'/'mejorable')
 */
function actualizarContadorLocal(notaId, vote) {
  // Inicializar cachÃ© si no existe
  if (!window.notasActivasCache) {
    window.notasActivasCache = [];
  }
  
  // Buscar la nota en cachÃ©
  let nota = window.notasActivasCache.find(n => n.nota_id === notaId);
  
  // Si no existe, crear entrada mÃ­nima
  if (!nota) {
    nota = { nota_id: notaId, evaluaciones: { total: 0, utiles: 0, mejorables: 0 } };
    window.notasActivasCache.push(nota);
    console.log(`[EvalStats] Creada entrada en cachÃ© para ${notaId}`);
  }
  
  // Inicializar evaluaciones si no existe
  if (!nota.evaluaciones) {
    nota.evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
  }
  
  // Incrementar contadores
  nota.evaluaciones.total++;
  if (vote === 'up' || vote === 'util') {
    nota.evaluaciones.utiles++;
  } else if (vote === 'down' || vote === 'mejorable') {
    nota.evaluaciones.mejorables++;
  }
  
  console.log(`[EvalStats] Contador actualizado para ${notaId}:`, nota.evaluaciones);
  
  // Actualizar los nÃºmeros en los botones del DOM
  actualizarContadoresEnBotones(nota.evaluaciones);
}

/**
 * Actualizar los nÃºmeros en los botones de evaluaciÃ³n
 * @param {Object} evaluaciones - {total, utiles, mejorables}
 */
function actualizarContadoresEnBotones(evaluaciones) {
  // Actualizar botÃ³n "Ãštil"
  const btnUtil = document.querySelector('.btn-util .btn-contador');
  if (btnUtil) {
    btnUtil.textContent = evaluaciones.utiles;
    console.log(`[EvalStats] Actualizado contador Ãºtil: ${evaluaciones.utiles}`);
  }
  
  // Actualizar botÃ³n "Mejorable"
  const btnMejorable = document.querySelector('.btn-mejorable .btn-contador');
  if (btnMejorable) {
    btnMejorable.textContent = evaluaciones.mejorables;
    console.log(`[EvalStats] Actualizado contador mejorable: ${evaluaciones.mejorables}`);
  }
  
  // Quitar mensaje "SÃ© el primero" si existe
  const mensajePrimero = document.querySelector('.eval-mensaje-primero');
  if (mensajePrimero && evaluaciones.total > 0) {
    mensajePrimero.remove();
    console.log('[EvalStats] Mensaje "SÃ© el primero" eliminado');
  }
}

// ============================================
// ESTADÃSTICAS GLOBALES DEL LABORATORIO
// ============================================

/**
 * Obtener estadÃ­sticas globales del laboratorio
 * @returns {Object} {totalEvaluaciones, porcentajeUtiles, porcentajeMejorables, totalSugerencias}
 */
async function obtenerEstadisticasGlobales() {
  try {
    const { data, error } = await window.SupabaseAPI.getGlobalStats();
    if (error || !data) throw error || new Error('Respuesta vacia en estadisticas globales');

    const totalEvaluaciones = Number(data.total_evaluaciones || 0);
    const utiles = Number(data.utiles || 0);
    const mejorables = Number(data.mejorables || 0);
    const totalSugerencias = Number(data.total_sugerencias || 0);

    const total = utiles + mejorables;
    const porcentajeUtiles = total > 0 ? Math.round((utiles / total) * 100) : 0;
    const porcentajeMejorables = total > 0 ? Math.round((mejorables / total) * 100) : 0;

    return {
      totalEvaluaciones,
      utiles,
      mejorables,
      porcentajeUtiles,
      porcentajeMejorables,
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

/**
 * Renderizar estadÃ­sticas globales en el HTML usando Chart.js
 * @param {HTMLElement} container - Contenedor para las estadÃ­sticas
 * @param {Object} stats - Objeto con las estadÃ­sticas globales
 */
function renderizarEstadisticasGlobales(container, stats) {
  if (!container) return;

  // Calcular porcentajes para la barra
  const totalContribuciones = stats.totalEvaluaciones + stats.totalSugerencias;
  const pctEvaluaciones = totalContribuciones > 0 ? Math.round((stats.totalEvaluaciones / totalContribuciones) * 100) : 50;
  const pctSugerencias = totalContribuciones > 0 ? Math.round((stats.totalSugerencias / totalContribuciones) * 100) : 50;

  const html = `
    <div class="stats-header">
      <i class="fa-solid fa-chart-pie" aria-hidden="true"></i>
      <strong>EstadÃ­sticas globales</strong>
    </div>
    
    <!-- Barra horizontal: Tipos de contribuciÃ³n -->
    <div class="stats-seccion">
      <h4 class="stats-subtitulo">Tipos de contribuciÃ³n</h4>
      <div class="stats-barra-container">
        <!-- Leyenda (izquierda) -->
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
        <!-- GrÃ¡fico de barras con Chart.js -->
        <div class="stats-grafico-barra">
          <canvas id="statsBarChart"></canvas>
        </div>
      </div>
    </div>
    
    <!-- GrÃ¡fico donut: Ãštiles vs Mejorables -->
    <div class="stats-seccion">
      <h4 class="stats-subtitulo">EvaluaciÃ³n de notas</h4>
      <div class="stats-visualizacion">
        <!-- Leyenda (izquierda) -->
        <div class="stats-leyenda">
          <div class="leyenda-item">
            <span class="leyenda-color util"></span>
            <span class="leyenda-texto"><strong>${stats.porcentajeUtiles}%</strong> Ãštiles (${stats.utiles})</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color mejorable"></span>
            <span class="leyenda-texto"><strong>${stats.porcentajeMejorables}%</strong> Mejorables (${stats.mejorables})</span>
          </div>
        </div>

        <!-- GrÃ¡fico circular con Chart.js -->
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

  container.innerHTML = html;

  // Crear grÃ¡ficos con Chart.js
  setTimeout(() => {
    crearGraficoBarraHorizontal(stats);
    crearGraficoDoughnut(stats);
  }, 100);
}

/**
 * Crear grÃ¡fico de barra horizontal de contribuciones
 */
function crearGraficoBarraHorizontal(stats) {
  const canvas = document.getElementById('statsBarChart');
  if (!canvas) return;

  // Destruir grÃ¡fico anterior si existe
  if (window.statsBarChartInstance) {
    window.statsBarChartInstance.destroy();
  }

  // Colores moderados (no demasiado vistosos)
  const evaluacionesColor = '#5b8a72'; // Verde azulado suave
  const sugerenciasColor = '#9a7b4f'; // MarrÃ³n dorado suave

  const totalContribuciones = stats.totalEvaluaciones + stats.totalSugerencias;
  const pctEvaluaciones = totalContribuciones > 0 ? Math.round((stats.totalEvaluaciones / totalContribuciones) * 100) : 50;
  const pctSugerencias = totalContribuciones > 0 ? Math.round((stats.totalSugerencias / totalContribuciones) * 100) : 50;

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
          barPercentage: 1.0,
          categoryPercentage: 1.0
        },
        {
          label: 'Sugerencias',
          data: [stats.totalSugerencias],
          backgroundColor: sugerenciasColor,
          borderWidth: 0,
          barPercentage: 1.0,
          categoryPercentage: 1.0
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      },
      scales: {
        x: {
          stacked: true,
          display: false,
          grid: {
            display: false
          },
          beginAtZero: true,
          // Forzar el mÃ¡ximo al total de contribuciones para llenar el ancho
          max: totalContribuciones
        },
        y: {
          stacked: true,
          display: false,
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
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

/**
 * Crear grÃ¡fico de donut de evaluaciones
 */
function crearGraficoDoughnut(stats) {
  const canvas = document.getElementById('statsDoughnutChart');
  if (!canvas) return;

  // Destruir grÃ¡fico anterior si existe
  if (window.statsDoughnutChartInstance) {
    window.statsDoughnutChartInstance.destroy();
  }

  // Colores del tema
  const utilColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#7a9e7e';
  const mejorableColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#8b3a33';

  window.statsDoughnutChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Ãštiles', 'Mejorables'],
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
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          callbacks: {
            label: function(context) {
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

