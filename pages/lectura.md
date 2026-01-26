---
layout: lectura
title: Sala de lectura
permalink: /lectura/
---

<!-- Layout principal de dos columnas -->
<div class="main-layout">
    <!-- Columna principal para el texto TEI -->
    <div id="TEI" class="text-column"></div>

    <!-- Columna para las opciones y notas -->
    <div id="col-opciones" class="notes-column">
        <div id="resize-handle"></div>
        
        <!-- Barra de botones (pestañas) -->
        <div class="button-bar">
            <button class="tab-button active" data-tab="notas">Notas</button>
            <button class="tab-button" data-tab="opciones">Opciones</button>
            <button class="tab-button" data-tab="info">Acerca de</button>
        </div>
        
        <!-- Contenido de las pestañas -->
        <div class="tab-content active" id="tab-notas">
            <div id="panelNotas">
                <div id="noteContent">
                    <p class="placeholder-text">Haz clic en el texto subrayado para ver las notas.</p>
                </div>
                
                <!-- Navegación por actos -->
                <div id="acts-navigation" class="acts-nav">
                    <h4>Navegación por actos</h4>
                    <div class="acts-buttons">
                        <button class="btn-act" data-act="1">Acto I</button>
                        <button class="btn-act" data-act="2">Acto II</button>
                        <button class="btn-act" data-act="3">Acto III</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="tab-content" id="tab-opciones">
            <div class="opciones-panel">
                <h4>Lectura</h4>
                
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
                </div>
                
                <h4>Tamaño del texto</h4>
                <div class="option-group">
                    <div class="font-size-controls">
                        <button id="decrease-font" class="font-btn">A-</button>
                        <span id="font-size-display">100%</span>
                        <button id="increase-font" class="font-btn">A+</button>
                    </div>
                </div>

            </div>
        </div>
        
        <div class="tab-content" id="tab-info">
            <div class="info-panel">
                <h4>Sobre la edición</h4>
                <p style="line-height: 1.6; color: #555;">
                    Esta es una edición digital divulgativa de <em>Fuenteovejuna</em> 
                    con notas explicativas que puedes evaluar para ayudar a mejorarlas.
                </p>
                <p style="margin-top: 16px; line-height: 1.6; color: #555;">
                    Haz clic en las notas del panel y evalúalas con <i class="fa-solid fa-heart"></i> (útil) o <i class="fa-solid fa-heart-crack"></i> (mejorable).
                </p>
            </div>
        </div>
    </div>
</div>
