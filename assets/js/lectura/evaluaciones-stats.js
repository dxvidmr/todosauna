// ============================================
// ESTADÍSTICAS DE EVALUACIONES (MÓDULO REUTILIZABLE)
// ============================================

/**
 * Obtener estadísticas de evaluaciones para una nota
 * @param {string} notaId - ID de la nota (ej: "n-1-1")
 * @param {Object} notaData - (Opcional) Objeto de la nota con evaluaciones precargadas
 * @returns {Object} {total, utiles, mejorables} o null si no hay datos
 */
function obtenerEvaluacionesStats(notaId, notaData = null) {
  let evaluaciones = null;
  
  // Opción 1: Si se pasa el objeto nota directamente con evaluaciones
  if (notaData && notaData.evaluaciones) {
    evaluaciones = notaData.evaluaciones;
    console.log(`[EvalStats] Usando evaluaciones de notaData para ${notaId}:`, evaluaciones);
  }
  // Opción 2: Buscar en el caché global
  else if (window.notasActivasCache) {
    const notaEnCache = window.notasActivasCache.find(n => n.nota_id === notaId);
    if (notaEnCache && notaEnCache.evaluaciones) {
      evaluaciones = notaEnCache.evaluaciones;
      console.log(`[EvalStats] Encontrado en caché para ${notaId}:`, evaluaciones);
    } else {
      console.log(`[EvalStats] No encontrado en caché: ${notaId}`);
    }
  } else {
    console.log(`[EvalStats] Caché no disponible para ${notaId}`);
  }
  
  // Si no hay evaluaciones, usar contador vacío
  if (!evaluaciones) {
    evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
  }
  
  return evaluaciones;
}

/**
 * Crear HTML con contadores integrados en botones + mensaje "Sé el primero"
 * @param {string} notaId - ID de la nota
 * @param {string} version - Versión de la nota
 * @param {Object} evaluaciones - {total, utiles, mejorables}
 * @returns {string} HTML de botones con contadores
 */
function crearBotonesConContadores(notaId, version, evaluaciones) {
  const { total, utiles, mejorables } = evaluaciones;
  
  // Mensaje si no hay evaluaciones
  const mensajePrimero = total === 0 
    ? '<p class="eval-mensaje-primero">¡Sé el primero en evaluarla!</p>' 
    : '';
  
  return `
    <div class="evaluacion-header">
      <span>¿Te resulta útil esta nota?</span>
    </div>
    <div class="evaluacion-botones">
      <button class="btn btn-outline-success btn-evaluar btn-util" data-nota-id="${notaId}" data-version="${version}">
        <span class="btn-contador">${utiles}</span>
        <i class="fa-solid fa-heart" aria-hidden="true"></i>
        Útil
      </button>
      <button class="btn btn-outline-danger btn-evaluar btn-mejorable" data-nota-id="${notaId}" data-version="${version}">
        <span class="btn-contador">${mejorables}</span>
        <i class="fa-solid fa-heart-crack" aria-hidden="true"></i>
        Mejorable
      </button>
    </div>
    ${mensajePrimero}
    <div class="evaluacion-comentario" style="display:none;">
      <textarea placeholder="¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota (opcional)" rows="3"></textarea>
      <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
      <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
    </div>
  `;
}

/**
 * Adjuntar listeners de evaluación a botones (REUTILIZABLE)
 * @param {HTMLElement} container - Contenedor con los botones
 * @param {string} notaId - ID de la nota
 * @param {string} version - Versión de la nota
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

  if (!btnUtil || !btnMejorable) {
    console.warn('Botones de evaluación no encontrados');
    return;
  }

  // Botón "Útil"
  btnUtil.addEventListener('click', async () => {
    const exito = await registrarCallback(notaId, version, 'up', null);
    if (exito) {
      actualizarContadorLocal(notaId, 'up');
      if (feedbackCallback) feedbackCallback(notaId, 'up');
    }
  });

  // Botón "Mejorable" - mostrar textarea
  btnMejorable.addEventListener('click', () => {
    if (comentarioDiv) {
      comentarioDiv.style.display = 'block';
      textarea?.focus();
    }
  });

  // Botón "Enviar comentario"
  btnEnviar?.addEventListener('click', async () => {
    const comentario = textarea?.value.trim() || null;
    const exito = await registrarCallback(notaId, version, 'down', comentario);
    if (exito) {
      actualizarContadorLocal(notaId, 'down');
      if (feedbackCallback) feedbackCallback(notaId, 'down');
    }
  });

  // Botón "Cancelar"
  btnCancelar?.addEventListener('click', () => {
    if (comentarioDiv) {
      comentarioDiv.style.display = 'none';
      if (textarea) textarea.value = '';
    }
  });
}

console.log('✓ Evaluaciones-stats.js cargado');

/**
 * Actualizar contador de evaluaciones localmente después de evaluar
 * @param {string} notaId - ID de la nota evaluada
 * @param {string} vote - 'up' o 'down' (o 'util'/'mejorable')
 */
function actualizarContadorLocal(notaId, vote) {
  // Inicializar caché si no existe
  if (!window.notasActivasCache) {
    window.notasActivasCache = [];
  }
  
  // Buscar la nota en caché
  let nota = window.notasActivasCache.find(n => n.nota_id === notaId);
  
  // Si no existe, crear entrada mínima
  if (!nota) {
    nota = { nota_id: notaId, evaluaciones: { total: 0, utiles: 0, mejorables: 0 } };
    window.notasActivasCache.push(nota);
    console.log(`[EvalStats] Creada entrada en caché para ${notaId}`);
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
  
  // Actualizar los números en los botones del DOM
  actualizarContadoresEnBotones(nota.evaluaciones);
}

/**
 * Actualizar los números en los botones de evaluación
 * @param {Object} evaluaciones - {total, utiles, mejorables}
 */
function actualizarContadoresEnBotones(evaluaciones) {
  // Actualizar botón "Útil"
  const btnUtil = document.querySelector('.btn-util .btn-contador');
  if (btnUtil) {
    btnUtil.textContent = evaluaciones.utiles;
    console.log(`[EvalStats] Actualizado contador útil: ${evaluaciones.utiles}`);
  }
  
  // Actualizar botón "Mejorable"
  const btnMejorable = document.querySelector('.btn-mejorable .btn-contador');
  if (btnMejorable) {
    btnMejorable.textContent = evaluaciones.mejorables;
    console.log(`[EvalStats] Actualizado contador mejorable: ${evaluaciones.mejorables}`);
  }
  
  // Quitar mensaje "Sé el primero" si existe
  const mensajePrimero = document.querySelector('.eval-mensaje-primero');
  if (mensajePrimero && evaluaciones.total > 0) {
    mensajePrimero.remove();
    console.log('[EvalStats] Mensaje "Sé el primero" eliminado');
  }
}

// ============================================
// ESTADÍSTICAS GLOBALES DEL LABORATORIO
// ============================================

/**
 * Obtener estadísticas globales del laboratorio
 * @returns {Object} {totalEvaluaciones, porcentajeUtiles, porcentajeMejorables, totalSugerencias}
 */
async function obtenerEstadisticasGlobales() {
  try {
    // 1. Total de evaluaciones de notas (nota_eval)
    const { count: totalEvaluaciones, error: errorEval } = await window.supabaseClient
      .from('evaluaciones')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'nota_eval');

    if (errorEval) throw errorEval;

    // 2. Contar evaluaciones por tipo (útiles vs mejorables)
    const { data: evaluacionesPorTipo, error: errorTipos } = await window.supabaseClient
      .from('evaluaciones')
      .select('vote')
      .eq('event_type', 'nota_eval');

    if (errorTipos) throw errorTipos;

    let utiles = 0;
    let mejorables = 0;

    evaluacionesPorTipo?.forEach(ev => {
      if (ev.vote === 'up') utiles++;
      else if (ev.vote === 'down') mejorables++;
    });

    // 3. Total de sugerencias de notas nuevas (falta_nota)
    const { count: totalSugerencias, error: errorSug } = await window.supabaseClient
      .from('evaluaciones')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'falta_nota');

    if (errorSug) throw errorSug;

    // 4. Calcular porcentajes
    const total = utiles + mejorables;
    const porcentajeUtiles = total > 0 ? Math.round((utiles / total) * 100) : 0;
    const porcentajeMejorables = total > 0 ? Math.round((mejorables / total) * 100) : 0;

    return {
      totalEvaluaciones: totalEvaluaciones || 0,
      utiles,
      mejorables,
      porcentajeUtiles,
      porcentajeMejorables,
      totalSugerencias: totalSugerencias || 0
    };
  } catch (error) {
    console.error('Error al obtener estadísticas globales:', error);
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
 * Renderizar estadísticas globales en el HTML usando Chart.js
 * @param {HTMLElement} container - Contenedor para las estadísticas
 * @param {Object} stats - Objeto con las estadísticas globales
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
      <strong>Estadísticas globales</strong>
    </div>
    
    <!-- Barra horizontal: Tipos de contribución -->
    <div class="stats-seccion">
      <h4 class="stats-subtitulo">Tipos de contribución</h4>
      <div class="stats-barra-container">
        <!-- Leyenda -->
        <div class="stats-barra-leyenda">
          <div class="leyenda-item">
            <span class="leyenda-color evaluaciones"></span>
            <span class="leyenda-texto">Evaluaciones (${stats.totalEvaluaciones})</span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color sugerencias"></span>
            <span class="leyenda-texto">Sugerencias (${stats.totalSugerencias})</span>
          </div>
        </div>
        <!-- Barra -->
        <div class="stats-barra-horizontal">
          <div class="barra-segmento evaluaciones" style="width: ${pctEvaluaciones}%">
            <span class="barra-label">${pctEvaluaciones}%</span>
          </div>
          <div class="barra-segmento sugerencias" style="width: ${pctSugerencias}%">
            <span class="barra-label">${pctSugerencias}%</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Gráfico donut: Útiles vs Mejorables -->
    <div class="stats-seccion">
      <h4 class="stats-subtitulo">Evaluación de notas</h4>
      <div class="stats-visualizacion">
        <!-- Gráfico circular con Chart.js -->
        <div class="stats-grafico-circular">
          <canvas id="statsDoughnutChart"></canvas>
          <div class="chart-center-label">
            <div class="chart-number">${stats.totalEvaluaciones}</div>
            <div class="chart-sublabel">evaluaciones</div>
          </div>
        </div>
        
        <!-- Leyenda -->
        <div class="stats-leyenda">
          <div class="leyenda-item">
            <span class="leyenda-color util"></span>
            <span class="leyenda-texto">
              <strong>${stats.porcentajeUtiles}%</strong> Útiles (${stats.utiles})
            </span>
          </div>
          <div class="leyenda-item">
            <span class="leyenda-color mejorable"></span>
            <span class="leyenda-texto">
              <strong>${stats.porcentajeMejorables}%</strong> Mejorables (${stats.mejorables})
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Crear gráfico donut con Chart.js
  setTimeout(() => {
    crearGraficoDoughnut(stats);
  }, 100);
}

/**
 * Crear gráfico de donut de evaluaciones
 */
function crearGraficoDoughnut(stats) {
  const canvas = document.getElementById('statsDoughnutChart');
  if (!canvas) return;

  // Destruir gráfico anterior si existe
  if (window.statsDoughnutChartInstance) {
    window.statsDoughnutChartInstance.destroy();
  }

  // Colores del tema
  const utilColor = getComputedStyle(document.documentElement).getPropertyValue('--success-300').trim() || '#10b981';
  const mejorableColor = getComputedStyle(document.documentElement).getPropertyValue('--warning-300').trim() || '#f59e0b';

  window.statsDoughnutChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Útiles', 'Mejorables'],
      datasets: [{
        data: [stats.utiles, stats.mejorables],
        backgroundColor: [utilColor, mejorableColor],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
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

