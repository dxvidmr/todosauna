---
layout: laboratorio
title: Laboratorio de notas
permalink: /participa/laboratorio/
navbar_behavior: fixed
---

<!-- Pantalla de bienvenida -->
<div id="laboratorio-bienvenida" class="laboratorio-bienvenida">
  <section class="container-xl">
    <header class="py-2 py-md-3 mb-4 mb-md-5 text-center">
      <nav class="ui-eyebrow mb-2" aria-label="breadcrumb">
        <a class="breadcrumb-link" href="{{ '/participa/' | relative_url }}">Participa</a>
        <span aria-hidden="true"> · </span>
        <span aria-current="page">Laboratorio</span>
      </nav>
      <h1 class="display-5 fw-semibold mb-0">Laboratorio de notas</h1>
    </header>

    <div class="row g-3 g-lg-4 align-items-start">
      <div class="col-12 col-lg-8 d-grid gap-3">
        <img
          src="{{ '/assets/img/laboratorio.gif' | relative_url }}"
          alt="Demostración de uso del Laboratorio de notas"
          class="img-fluid w-100 d-block rounded-3"
          loading="eager"
          decoding="async">

        <article>
          <div>
            <h2 class="h5">¿Qué es?</h2>
            <p class="mb-0">Un espacio colaborativo donde puedes leer pasajes de <em>Fuenteovejuna</em> y evaluar si las notas explicativas te resultan útiles para entender la obra.</p>
          </div>
        </article>

        <article>
          <div>
            <h2 class="h5">¿Para qué?</h2>
            <p class="mb-0">Tu opinión ayuda a mejorar la experiencia de lectura para toda la comunidad. Con tus evaluaciones contribuyes a identificar qué notas funcionan mejor o dónde faltan.</p>
          </div>
        </article>

        <article>
          <div>
            <h2 class="h5">¿Cómo funciona?</h2>
            <ol class="mb-0">
              <li>Elige un modo de juego (secuencial o aleatorio)</li>
              <li>Lee el pasaje y haz clic en el texto subrayado para ver las notas</li>
              <li>Evalúa cada nota como "útil" o "mejorable"</li>
              <li>También puedes seleccionar cualquier fragmento del texto y sugerir nuevas notas</li>
              <li>Continúa con el siguiente pasaje</li>
            </ol>
            <p class="mt-3 mb-0">
              Consulta la <a href="{{ '/participa/guia/' | relative_url }}">guía de participación</a> para ver toda la información.
            </p>
          </div>
        </article>
      </div>

      <div class="col-12 col-lg-4 d-grid gap-3">
        <article class="card card-soft ui-thin-border">
          <div class="card-body d-flex flex-column p-3">
            <h2 class="h5">Modo secuencial</h2>
            <p class="text-neutral-700 mb-3">Recorre los pasajes en orden cronológico de la obra</p>
            <button type="button" class="btn btn-dark align-self-start mt-auto" data-lab-start-mode data-modo="secuencial">Iniciar</button>
          </div>
        </article>

        <article class="card card-soft ui-thin-border">
          <div class="card-body d-flex flex-column p-3">
            <h2 class="h5">Modo aleatorio</h2>
            <p class="text-neutral-700 mb-3">Sorpréndete con un pasaje al azar de la obra</p>
            <button type="button" class="btn btn-dark align-self-start mt-auto" data-lab-start-mode data-modo="aleatorio">Iniciar</button>
          </div>
        </article>

        <div class="stats-globales stats-globales--parked bg-neutral-100">
          <div class="loading-stats-container">
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
            Cargando estadísticas...
          </div>
        </div>
      </div>
    </div>
  </section>
</div>

<!-- Contenido principal desktop -->
<div class="laboratorio-layout laboratorio-layout-desktop" data-lab-shell="desktop">
  <div class="laboratorio-header">
    <div class="laboratorio-header-row">
      <h1>Laboratorio de notas</h1>
      <div class="laboratorio-header-meta">
        <span id="modo-actual-badge" class="modo-badge" data-lab-mode-badge>Secuencial</span>
        <button
          id="btn-cambiar-modo"
          class="btn btn-muted btn-sm btn-cambiar-modo"
          type="button"
          data-cambiar-modo
          data-lab-change-mode
          title="Volver a la pantalla de selección de modo">
          <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
          <span>Cambiar modo</span>
        </button>
      </div>
    </div>
  </div>

  <div class="laboratorio-content-wrapper">
    <div class="laboratorio-pasaje-column">
      <div class="pasaje-container" data-lab-pasaje-container tabindex="-1">
        <div id="pasaje-content" data-lab-pasaje-content>
          <div class="loading">Cargando pasaje...</div>
        </div>
      </div>

      <div class="laboratorio-controles">
        <div class="laboratorio-controles-franja" data-lab-controls-shell>
          <div class="laboratorio-franja-izq">
            <button
              id="btn-anterior"
              type="button"
              class="btn btn-outline-dark btn-sm d-inline-flex align-items-center gap-1"
              data-lab-prev-passage
              style="display: none;"
              aria-label="Pasaje anterior">
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              <span>Anterior</span>
            </button>
            <button
              id="btn-siguiente"
              type="button"
              class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
              data-lab-next-passage
              aria-label="Siguiente pasaje">
              <span>Siguiente</span>
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
            <div class="laboratorio-progreso">
              Pasaje <span id="pasaje-actual" data-lab-passage-current>1</span> de <span id="pasajes-totales" data-lab-passages-total>-</span>
            </div>
          </div>

          <div id="barra-progreso-container" class="barra-progreso-container" data-lab-passage-progress-container style="display: none;">
            <div class="barra-progreso">
              <div id="barra-progreso-fill" class="barra-progreso-fill" data-lab-passage-progress-fill style="width: 0%"></div>
            </div>
          </div>

          <div class="laboratorio-franja-der">
            <div class="lab-font-controls" aria-label="Tamano del texto del pasaje">
              <button id="lab-font-decrease" class="btn-circular" data-lab-font-decrease type="button" aria-label="Reducir tamano del texto">
                <i class="fa-solid fa-minus" aria-hidden="true"></i>
              </button>
              <span id="lab-font-size-display" class="lab-font-size-display" data-lab-font-display>100%</span>
              <button id="lab-font-increase" class="btn-circular" data-lab-font-increase type="button" aria-label="Aumentar tamano del texto">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="laboratorio-notas-column" data-lab-note-column>
      <div class="notas-container" data-lab-note-sheet aria-hidden="false">
        <div class="notas-navegacion">
          <div class="note-nav-controls">
            <button id="btn-nota-anterior" class="btn-circular btn-nav-nota" data-lab-note-prev title="Nota anterior">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <span class="nota-posicion">
              Nota <span id="nota-actual-index" data-lab-note-index>0</span> de <span id="notas-pasaje-total" data-lab-notes-passage-total>0</span>
            </span>
            <button id="btn-nota-siguiente" class="btn-circular btn-nav-nota" data-lab-note-next title="Nota siguiente">
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="notas-panel-meta">
            <div class="notas-resumen-evaluacion">
              <div class="barra-progreso-container">
                <div class="barra-progreso">
                  <div id="barra-progreso-notas-fill" class="barra-progreso-fill" data-lab-note-progress-fill style="width: 0%"></div>
                </div>
              </div>
              <div class="notas-contador-abajo">
                <span id="notas-evaluadas" data-lab-notes-evaluated>0</span> de <span id="notas-totales" data-lab-notes-total>0</span> evaluadas
              </div>
            </div>
          </div>
        </div>

        {% include ui/note-panel-shell.html
          id="nota-content"
          class="nota-content note-panel-host"
          attrs='data-lab-note-content'
          body_message="Haz clic en un texto subrayado o usa las flechas para ver las notas"
          dock_state="idle"
        %}

        <div class="notas-instrucciones">
          <p><i class="fa-solid fa-info-circle" aria-hidden="true"></i> Haz clic en el texto subrayado para evaluar una nota, o navega con las flechas. Si consideras que falta una nota, selecciona el texto y deja tu sugerencia. <a href="{{ '/participa/guia/' | relative_url }}">Guía completa</a>.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Contenido principal mobile -->
<div class="laboratorio-layout laboratorio-layout-mobile" data-lab-shell="mobile">
  <div id="laboratorio-notas-backdrop-mobile" class="laboratorio-notas-backdrop laboratorio-notas-backdrop-mobile" data-lab-notes-backdrop hidden></div>

  <div class="laboratorio-mobile-shell">
    <header class="laboratorio-mobile-header">
      <h1>Laboratorio de notas</h1>
    </header>

    <div class="laboratorio-mobile-controls-card" data-lab-controls-shell>
      <div class="laboratorio-mobile-controls-row">
        <div class="laboratorio-mobile-nav">
          <button
            id="btn-anterior-mobile"
            type="button"
            class="btn btn-outline-dark btn-sm d-inline-flex align-items-center gap-1"
            data-lab-prev-passage
            style="display: none;"
            aria-label="Pasaje anterior">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            <span>Anterior</span>
          </button>
          <button
            id="btn-siguiente-mobile"
            type="button"
            class="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
            data-lab-next-passage
            aria-label="Siguiente pasaje">
            <span>Siguiente</span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>

        <div class="laboratorio-mobile-mode">
          <span id="modo-actual-badge-mobile" class="modo-badge" data-lab-mode-badge>Secuencial</span>
          <button
            id="btn-cambiar-modo-mobile"
            class="btn btn-muted btn-sm btn-cambiar-modo"
            type="button"
            data-cambiar-modo
            data-lab-change-mode
            title="Volver a la pantalla de selección de modo">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            <span>Cambiar modo</span>
          </button>
        </div>
      </div>

      <div class="laboratorio-mobile-progress-row">
        <div class="laboratorio-mobile-progress-copy">
          Pasaje <span data-lab-passage-current>1</span> de <span data-lab-passages-total>-</span>
        </div>

        <div id="barra-progreso-container-mobile" class="barra-progreso-container" data-lab-passage-progress-container style="display: none;">
          <div class="barra-progreso">
            <div id="barra-progreso-fill-mobile" class="barra-progreso-fill" data-lab-passage-progress-fill style="width: 0%"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="laboratorio-mobile-body">
      <div class="pasaje-container pasaje-container-mobile" data-lab-pasaje-container tabindex="-1">
        <div id="pasaje-content-mobile" class="pasaje-content-mobile" data-lab-pasaje-content>
          <div class="loading">Cargando pasaje...</div>
        </div>
      </div>
    </div>

    <div class="laboratorio-mobile-footer" data-lab-note-footer>
      <button
        id="btn-notas-sheet-toggle-mobile"
        type="button"
        class="notas-collapsed-toggle"
        data-lab-notes-toggle
        aria-controls="laboratorio-mobile-note-sheet"
        aria-expanded="false">
        <div class="notas-collapsed-top">
          <span class="notas-collapsed-label">
            <i class="fa-solid fa-note-sticky" aria-hidden="true"></i>
            <span data-lab-note-toggle-label>Ver nota</span>
          </span>
          <span class="notas-collapsed-count">
            <span data-lab-notes-evaluated-resumen>0</span>/<span data-lab-notes-total-resumen>0</span>
          </span>
        </div>
        <div class="barra-progreso">
          <div id="barra-progreso-notas-collapsed-fill-mobile" class="barra-progreso-fill" data-lab-note-progress-fill-collapsed style="width: 0%"></div>
        </div>
      </button>
    </div>

    <div id="laboratorio-mobile-note-sheet" class="laboratorio-mobile-note-sheet" data-lab-note-column>
      <div class="notas-container notas-container-mobile" data-lab-note-sheet aria-hidden="true">
        <div class="notas-sheet-handle" data-lab-note-drag-handle aria-hidden="true"></div>

        <div class="notas-navegacion notas-navegacion-mobile">
          <div class="note-nav-controls">
            <button id="btn-nota-anterior-mobile" class="btn-circular btn-nav-nota" data-lab-note-prev title="Nota anterior">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <span class="nota-posicion">
              Nota <span data-lab-note-index>0</span> de <span data-lab-notes-passage-total>0</span>
            </span>
            <button id="btn-nota-siguiente-mobile" class="btn-circular btn-nav-nota" data-lab-note-next title="Nota siguiente">
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="notas-panel-meta notas-panel-meta-mobile">
            <button id="btn-notas-cerrar-mobile" class="btn-circular btn-cerrar-notas" data-lab-notes-close type="button" aria-label="Cerrar panel de notas">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        {% include ui/note-panel-shell.html
          id="nota-content-mobile"
          class="nota-content note-panel-host"
          attrs='data-lab-note-content'
          body_message="Haz clic en un texto subrayado o usa las flechas para ver las notas"
          dock_state="idle"
        %}

        <div class="notas-instrucciones">
          <p><i class="fa-solid fa-info-circle" aria-hidden="true"></i> Haz clic en el texto subrayado para evaluar una nota, o navega con las flechas. Si consideras que falta una nota, selecciona el texto y deja tu sugerencia. <a href="{{ '/participa/guia/' | relative_url }}">Guía completa</a>.</p>
        </div>
      </div>
    </div>
  </div>
</div>
