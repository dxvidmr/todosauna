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
        <button class="btn-cerrar-panel btn-circular" id="btn-cerrar-panel" title="Cerrar panel">
            <i class="fa-solid fa-times"></i>
        </button>
        
        <!-- Contenido de las pestañas -->
        <div class="tab-content active" id="tab-notas">
            <div id="panelNotas">
                <div id="noteContent">
                    <p class="placeholder-text">Haz clic en el texto subrayado para ver las notas.</p>
                </div>
            </div>
        </div>
        <div class="tab-content" id="tab-navegación">
            <div class="navegación-panel">
                <div class="nav-section">
                    <h4 class="fs-5">Índice</h4>
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
                <h4 class="fs-5">Opciones</h4>
                <div class="option-group">
                    <label class="option-item">
                        <span>Mostrar marcas de notas</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-notes" checked>
                            <span class="slider"></span>
                        </label>
                    </label>
                    <label class="option-item">
                        <span>Mostrar separación de estrofas</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="toggle-stanzas">
                            <span class="slider"></span>
                        </label>
                    </label>
                    <label class="option-item">
                        <span class="flex-shrink-0 me-3">Numeración</span>
                        <select id="numeracion-versos" class="form-select form-select-sm w-auto">
                            <option value="cada5" selected>Cada 5 versos</option>
                            <option value="todos">Todos los versos</option>
                            <option value="ninguno">Ninguno</option>
                        </select>
                    </label>
                    <label class="option-item">
                        <span>Tamaño del texto</span>
                        <div class="font-size-controls">
                            <button id="decrease-font" class="font-btn"><i class="fa-solid fa-minus"></i></button>
                            <span class="fs-6" id="font-size-display">100%</span>
                            <button id="increase-font" class="font-btn"><i class="fa-solid fa-plus"></i></button>
                        </div>
                    </label>
                </div>
            </div>
        </div>
        <div class="tab-content" id="tab-info">
            <div class="info-panel">
                <h4 class="fs-5">Sobre esta edición</h4>
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
            <span class="tab-label">Nav</span>
        </button>
        <button class="tab-button" data-tab="opciones" title="Opciones" aria-label="Opciones">
            <i class="fa-solid fa-sliders tab-icon" aria-hidden="true"></i>
            <span class="tab-label">Opciones</span>
        </button>
        <button class="tab-button" data-tab="info" title="Info" aria-label="Información">
            <i class="fa-solid fa-circle-info tab-icon" aria-hidden="true"></i>
            <span class="tab-label">Info</span>
        </button>
    </div>
</div>
