---
layout: lectura
title: Sala de lectura
permalink: /lectura/
---

<!-- Layout principal de dos columnas -->
<div class="main-layout">
    <!-- Columna principal para el texto TEI -->
    <div id="TEI" class="text-column"></div>
    <!-- Columna para las navegación y notas -->
    <div id="col-navegación" class="notes-column">
        <div id="resize-handle"></div>
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
                    <h4 class="fs-5"><i class="fa-solid fa-list me-2"></i>Índice</h4>
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
                <h4 class="fs-5 mt-4"><i class="fa-solid fa-gear me-2"></i>Opciones</h4>
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
                <h4>Sobre la edición</h4>
                <p>
                    Esta es una edición digital divulgativa de <em>Fuenteovejuna</em> 
                    con notas explicativas que puedes evaluar para ayudar a mejorarlas.
                </p>
                <p>
                    Haz clic en las notas del panel y evalúalas con <i class="fa-solid fa-heart"></i> (útil) o <i class="fa-solid fa-heart-crack"></i> (mejorable).
                </p>
            </div>
        </div>
        <!-- Barra de botones (pestañas) al final -->
        <div class="button-bar">
            <button class="tab-button active" data-tab="notas">Notas</button>
            <button class="tab-button" data-tab="navegación">Navegación</button>
            <button class="tab-button" data-tab="info">Acerca de</button>
        </div>
    </div>
</div>
