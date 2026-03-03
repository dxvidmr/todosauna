---
layout: lectura
title: Sala de lectura
permalink: /lectura/
navbar_behavior: auto-hide
lectura_dynamic_recenter: true
---

<!-- Contenedor principal para el texto TEI -->
<div id="TEI" class="text-column"></div>

<!-- Panel flotante de notas/navegación/info -->
<div class="lectura-panel-wrapper" id="lectura-panel-wrapper">
    <!-- Panel de contenido (se abre/cierra) -->
    <div class="lectura-panel" id="lectura-panel">
        <div class="panel-resize-handle" id="panel-resize-handle"></div>
        <div class="lectura-panel-header">
            <div class="lectura-panel-header-main">
                <div class="lectura-panel-title" id="lectura-panel-title"></div>
                <div class="lectura-panel-header-actions" id="lectura-panel-header-actions" hidden></div>
            </div>
            <button class="btn-cerrar-panel btn-circular" id="btn-cerrar-panel" title="Cerrar panel" aria-label="Cerrar panel">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        
        <!-- Contenido de las pestañas -->
        <div class="tab-content active" id="tab-notas">
            <div id="panelNotas">
                <div id="noteContent" class="note-panel-host">
                    <div class="note-panel-layout">
                        <div class="note-panel-scroll">
                            <p class="placeholder-text">Haz clic en el texto subrayado para ver las notas.</p>
                        </div>
                        <div class="note-eval-dock" data-eval-state="idle">
                            <p class="note-dock-placeholder"></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-content" id="tab-navegación">
            <div class="navegación-panel">
                <div class="nav-section">
                    <div class="structure-nav">
                        <button class="btn-nav-item" data-target-type="head" data-target-attr="type" data-target-value="comedia-head">
                            Inicio
                        </button>
                        <button class="btn-nav-item" data-target-type="head" data-target-attr="type" data-target-value="castList-head">
                            Dramatis Personae
                        </button>
                        <button class="btn-nav-item active" data-target-type="div" data-target-attr="n" data-target-value="1">
                            Acto I
                        </button>
                        <button class="btn-nav-item" data-target-type="div" data-target-attr="n" data-target-value="2">
                            Acto II
                        </button>
                        <button class="btn-nav-item" data-target-type="div" data-target-attr="n" data-target-value="3">
                            Acto III
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-content" id="tab-opciones">
            <div class="opciones-panel">
                <div class="option-group">
                    <div class="option-item">
                        <label for="toggle-notes">Mostrar marcas de notas</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-notes" checked>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="option-item">
                        <label for="toggle-stanzas">Mostrar separación de estrofas</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-stanzas">
                            <span class="slider"></span>
                        </label>
                    </div>
                    <div class="option-item">
                        <label for="numeracion-versos" class="flex-shrink-0 me-3">Numeración</label>
                        <select id="numeracion-versos" class="form-select form-select-sm w-auto">
                            <option value="cada5" selected>Cada 5 versos</option>
                            <option value="todos">Todos los versos</option>
                            <option value="ninguno">Ninguno</option>
                        </select>
                    </div>
                    <div class="option-item">
                        <span>Tamaño del texto</span>
                        <div class="font-size-controls">
                            <button id="decrease-font" class="btn-circular" type="button" aria-label="Reducir tamano del texto"><i class="fa-solid fa-minus"></i></button>
                            <span class="fs-6" id="font-size-display">100%</span>
                            <button id="increase-font" class="btn-circular" type="button" aria-label="Aumentar tamano del texto"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="tab-content" id="tab-info">
            <div class="info-panel">
                <p>
                    Esta es una <strong>edición digital divulgativa</strong> de <em>Fuenteovejuna</em> 
                    basada en la edición crítica del grupo Prolope (2009, PPU/Universitat Autònoma de Barcelona).
                </p>
                <p>
                    El texto sigue la edición de Prolope. Las notas, originalmente 
                    procedentes de esa edición, se van <strong>actualizando y enriqueciendo</strong> 
                    gracias a la participación de lectores y colaboradores.
                </p>
                <div class="info-highlight p-3">
                    <p>
                        Puedes evaluar las notas con 
                        <i class="fa-solid fa-heart"></i> (útil) o <i class="fa-solid fa-heart-crack"></i> (mejorable) 
                        para ayudar a mejorarlas.
                    </p>
                </div>
                <hr class="info-divider">
                <div class="info-links">
                    <a href="../criterios-editoriales.html" class="info-link">
                        <i class="fa-solid fa-book-open me-2"></i> Criterios editoriales
                    </a>
                    <a href="../codificacion-tei.html" class="info-link">
                        <i class="fa-solid fa-code me-2"></i> Codificación TEI-XML
                    </a>
                    <a href="../laboratorio-de-notas/" class="info-link">
                        <i class="fa-solid fa-flask me-2"></i> Laboratorio de notas
                    </a>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Barra de pestañas flotante (siempre visible) -->
    <div class="lectura-tabs-bar" id="lectura-tabs-bar">
        <button class="tab-button" data-tab="notas" title="Notas" aria-label="Notas">
            <i class="fa-solid fa-note-sticky tab-icon" aria-hidden="true"></i>
            <span class="tab-label">Notas</span>
        </button>
        <button class="tab-button" data-tab="navegación" title="Navegación" aria-label="Navegación">
            <i class="fa-solid fa-compass tab-icon" aria-hidden="true"></i>
            <span class="tab-label">Navegación</span>
        </button>
        <button class="tab-button" data-tab="opciones" title="Opciones" aria-label="Opciones">
            <i class="fa-solid fa-sliders tab-icon" aria-hidden="true"></i>
            <span class="tab-label">Opciones</span>
        </button>
        <button class="tab-button" data-tab="info" title="Información" aria-label="Información">
            <i class="fa-solid fa-circle-info tab-icon" aria-hidden="true"></i>
            <span class="tab-label">Información</span>
        </button>
    </div>
</div>
