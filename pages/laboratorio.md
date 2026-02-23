---
layout: laboratorio
title: Laboratorio de notas
permalink: /participa/laboratorio/
navbar_behavior: fixed
---

<!-- Pantalla de bienvenida -->
<div id="laboratorio-bienvenida" class="laboratorio-bienvenida">
  <div class="bienvenida-container">
    <h1 class="bienvenida-titulo">Laboratorio de notas</h1>
    
    <!-- Lado izquierdo: Explicación -->
    <div class="bienvenida-explicacion">
      <div class="explicacion-seccion">
        <h3>¿Qué es?</h3>
        <p>Un espacio colaborativo donde puedes leer pasajes de <em>Fuenteovejuna</em> y evaluar si las notas explicativas te resultan útiles para entender la obra.</p>
      </div>
      
      <div class="explicacion-seccion">
        <h3>¿Para qué?</h3>
        <p>Tu opinión ayuda a mejorar la experiencia de lectura para toda la comunidad. Con tus evaluaciones contribuyes a identificar qué notas funcionan mejor o dónde faltan.</p>
      </div>
      
      <div class="explicacion-seccion">
        <h3>¿Cómo funciona?</h3>
        <ol>
          <li>Elige un modo de juego (secuencial o aleatorio)</li>
          <li>Lee el pasaje y haz clic en el texto subrayado para ver las notas</li>
          <li>Evalúa cada nota como "útil" o "mejorable"</li>
          <li>También puedes seleccionar cualquier fragmento del texto y sugerir nuevas notas</li>
          <li>Continúa con el siguiente pasaje</li>
        </ol>
      </div>
    </div>
    
    <!-- Lado derecho: Opciones de entrada -->
    <div class="bienvenida-opciones">
      <div class="opcion-modo btn btn-dark" data-modo="secuencial" role="button" tabindex="0">
        <div class="opcion-icono"><i class="fa-solid fa-list-ol" aria-hidden="true"></i></div>
        <div class="opcion-contenido">
          <h3>Modo secuencial</h3>
          <p class="text-neutral-400">Recorre los pasajes en orden cronológico de la obra</p>
        </div>
      </div>
      
      <div class="opcion-modo btn btn-dark" data-modo="aleatorio" role="button" tabindex="0">
        <div class="opcion-icono"><i class="fa-solid fa-shuffle" aria-hidden="true"></i></div>
        <div class="opcion-contenido">
          <h3>Modo aleatorio</h3>
          <p class="text-neutral-400">Sorpréndete con un pasaje al azar de la obra</p>
        </div>
      </div>
      
      <div class="stats-globales bg-neutral-100">
        <div class="loading-stats-container">
          <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
          Cargando estadísticas...
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal confirmar cambio de modo -->
<div id="modal-cambiar-modo" class="modal lab-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="modal-cambiar-modo-titulo">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <button id="modal-cambiar-modo-close" class="modal-close" aria-label="Cerrar modal">&times;</button>
    <h2 id="modal-cambiar-modo-titulo">¿Cambiar modo de uso?</h2>
    <p class="modal-descripcion">Volverás a la pantalla de selección y podrás elegir de nuevo entre modo secuencial o aleatorio.</p>
    <div class="lab-confirm-actions">
      <button id="btn-cancelar-cambiar-modo" type="button" class="btn btn-outline-dark btn-sm">Cancelar</button>
      <button id="btn-confirmar-cambiar-modo" type="button" class="btn btn-dark btn-sm">Sí, cambiar modo</button>
    </div>
  </div>
</div>

<!-- Contenido principal: Layout de dos columnas -->
<div class="laboratorio-layout">
  
  <!-- Header del laboratorio (fuera de las columnas) -->
  <div class="laboratorio-header">
    <div class="laboratorio-header-row">
      <h1>Laboratorio de notas</h1>
      <div class="laboratorio-header-meta">
        <span id="modo-actual-badge" class="modo-badge">Secuencial</span>
        <button id="btn-cambiar-modo" class="btn-cambiar-modo" title="Volver a la pantalla de selección de modo">
          <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
          <span>Cambiar modo</span>
        </button>
      </div>
    </div>
  </div>
  
  <!-- Contenedor de dos columnas -->
  <div class="laboratorio-content-wrapper">
    
    <!-- Columna izquierda: Pasaje -->
    <div class="laboratorio-pasaje-column">
      
      <!-- Contenedor del pasaje -->
      <div class="pasaje-container">
        <div id="pasaje-content">
          <div class="loading">Cargando pasaje...</div>
        </div>
      </div>
      
      <!-- Controles de navegación de pasajes -->
      <div class="laboratorio-controles">
        <div class="laboratorio-controles-franja">
          <div class="laboratorio-franja-izq">
            <button id="btn-anterior" class="btn-nav-inline" style="display: none;" aria-label="Pasaje anterior">
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              <span>Anterior</span>
            </button>
            <button id="btn-siguiente" class="btn-nav-inline btn-nav-inline-primary" aria-label="Siguiente pasaje">
              <span>Siguiente</span>
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
            <div class="laboratorio-progreso">
              Pasaje <span id="pasaje-actual">1</span> de <span id="pasajes-totales">-</span>
            </div>
          </div>

          <div id="barra-progreso-container" class="barra-progreso-container" style="display: none;">
            <div class="barra-progreso">
              <div id="barra-progreso-fill" class="barra-progreso-fill" style="width: 0%"></div>
            </div>
          </div>

          <div class="laboratorio-franja-der">
            <div class="lab-font-controls" aria-label="Tamano del texto del pasaje">
            <button id="lab-font-decrease" class="lab-font-btn" type="button" aria-label="Reducir tamano del texto">
              <i class="fa-solid fa-minus" aria-hidden="true"></i>
            </button>
            <span id="lab-font-size-display" class="lab-font-size-display">100%</span>
            <button id="lab-font-increase" class="lab-font-btn" type="button" aria-label="Aumentar tamano del texto">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
    
    <!-- Columna derecha: Notas -->
    <div class="laboratorio-notas-column">
      
      <!-- Container de notas (mismo estilo que pasaje-container) -->
      <div class="notas-container">
        
        <!-- Navegación entre notas (como note-panel-header) -->
        <div class="notas-navegacion">
          <div class="note-nav-controls">
            <button id="btn-nota-anterior" class="btn-circular btn-nav-nota" title="Nota anterior">
              <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <span class="nota-posicion">
              Nota <span id="nota-actual-index">0</span> de <span id="notas-pasaje-total">0</span>
            </span>
            <button id="btn-nota-siguiente" class="btn-circular btn-nav-nota" title="Nota siguiente">
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>

          <div class="notas-resumen-evaluacion">
            <div id="barra-progreso-notas-container" class="barra-progreso-container">
              <div class="barra-progreso">
                <div id="barra-progreso-notas-fill" class="barra-progreso-fill" style="width: 0%"></div>
              </div>
            </div>
            <div class="notas-contador-abajo">
              <span id="notas-evaluadas">0</span> de <span id="notas-totales">0</span> evaluadas
            </div>
          </div>
        </div>
        
        <!-- Contenido de la nota actual -->
        <div id="nota-content" class="nota-content">
          <div class="lab-note-layout">
            <div class="lab-note-display-scroll">
              <p class="placeholder-text">Haz clic en un texto subrayado o usa las flechas para ver las notas</p>
            </div>
            <div class="lab-note-eval-dock">
              <p class="lab-note-dock-placeholder"></p>
            </div>
          </div>
        </div>
        
        <!-- Instrucciones -->
        <div class="notas-instrucciones">
          <p><i class="fa-solid fa-info-circle" aria-hidden="true"></i> Haz clic en el texto subrayado para evaluar una nota, o navega con las flechas. Si falta una nota, selecciona el texto y deja tu sugerencia. <a href="{{ '/participa/guia/' | relative_url }}">Guía completa</a>.</p>
        </div>
        
      </div>
      
    </div>
    
  </div>
  
</div>
