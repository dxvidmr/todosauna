document.addEventListener("DOMContentLoaded", function() {
    // Referencias globales
    const textColumn = document.querySelector('.text-column');
    const fontSizeDisplay = document.getElementById('font-size-display');
    let currentFontSize = 100;
    
    // Estado de navegación de notas
    window.edicionNotas = {
        todasLasNotas: [],      // Array de xml:ids de notas
        notaActualIndex: -1,    // Índice de la nota actualmente mostrada
        notaActualId: null      // ID de la nota actualmente mostrada
    };
    
    // Sistema de pestañas
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Desactivar todas las pestañas
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activar la pestaña seleccionada
            this.classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        });
    });
    
    // Control de visibilidad de notas
    const toggleNotesCheckbox = document.getElementById('toggle-notes');
    if (toggleNotesCheckbox && textColumn) {
        toggleNotesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                textColumn.classList.remove('notes-hidden');
            } else {
                textColumn.classList.add('notes-hidden');
            }
        });
    }
    
    // Control de tamaño de fuente
    document.getElementById('increase-font')?.addEventListener('click', function() {
        if (currentFontSize < 150) {
            currentFontSize += 10;
            updateFontSize();
        }
    });
    
    document.getElementById('decrease-font')?.addEventListener('click', function() {
        if (currentFontSize > 70) {
            currentFontSize -= 10;
            updateFontSize();
        }
    });
    
    function updateFontSize() {
        if (textColumn && fontSizeDisplay) {
            textColumn.style.fontSize = currentFontSize + '%';
            fontSizeDisplay.textContent = currentFontSize + '%';
        }
    }
    
    // Botón para mostrar/ocultar estrofas
    const toggleStanzasCheckbox = document.getElementById('toggle-stanzas');
    if (toggleStanzasCheckbox) {
        toggleStanzasCheckbox.addEventListener('change', function() {
            var milestones = document.querySelectorAll('tei-milestone[unit="stanza"]');
            milestones.forEach(function(milestone) {
                if (this.checked) {
                    milestone.classList.add('show-line');
                } else {
                    milestone.classList.remove('show-line');
                }
            }.bind(this));
        });
    }
    
    // Botón para mostrar/ocultar estrofas (legacy - mantener por compatibilidad)
    const toggleButton = document.getElementById("toggleLines");
    if (toggleButton) {
        toggleButton.addEventListener("click", function() {
            var milestones = document.querySelectorAll('tei-milestone[unit="stanza"]');
            milestones.forEach(function(milestone) {
                milestone.classList.toggle('show-line');
            });

            // Cambia el texto del botón
            if (this.textContent === "Mostrar estrofas") {
                this.textContent = "Ocultar estrofas";
            } else {
                this.textContent = "Mostrar estrofas";
            }
        });
    }
    
    const teiContainer = document.getElementById("TEI");
    const noteContentDiv = document.getElementById("noteContent");
    
    let teiLoaded = false;
    let notasLoaded = false;
    let notasSupabaseLoaded = false;

    // Función para verificar si todo está listo y procesar
    async function checkAndProcess() {
        console.log('checkAndProcess:', { teiLoaded, notasLoaded, notasSupabaseLoaded, notasXML: !!window.notasXML });
        if (teiLoaded && notasLoaded && window.notasXML) {
            // Cargar notas desde Supabase (para obtener contadores de evaluaciones)
            if (!notasSupabaseLoaded) {
                console.log('Cargando notas desde Supabase...');
                await cargarNotasActivas();
                notasSupabaseLoaded = true;
                console.log('✓ Notas de Supabase cargadas con contadores');
            }
            
            console.log('Todo cargado, procesando notas...');
            processNotes();
            // ← NOTA: Ya NO ponemos nada aquí, todo va dentro de processNotes()
        }
    }

    // Observa cuando se añadan nodos al contenedor #TEI
    const observer = new MutationObserver(() => {
        // Verificar si el contenido TEI ya está cargado (buscar elementos tei-)
        if (teiContainer.querySelector('tei-l, tei-seg')) {
            if (!teiLoaded) {
                teiLoaded = true;
                console.log('TEI cargado');
                observer.disconnect();
                checkAndProcess();
            }
        }
    });

    // Inicia la observación en el contenedor TEI
    observer.observe(teiContainer, { childList: true, subtree: true });
    
    // Esperar a que las notas se carguen
    const checkNotas = setInterval(() => {
        if (window.notasXML && !notasLoaded) {
            notasLoaded = true;
            console.log('Notas cargadas');
            clearInterval(checkNotas);
            checkAndProcess();
        }
    }, 100);

    function processNotes() {
        if (!window.notasXML) return;

        // Obtener todas las notas del XML externo
        const notes = Array.from(window.notasXML.querySelectorAll('note'));

        // Ordenar las notas: primero las más específicas (seg), luego las generales (l)
        // Esto asegura que los wrappers internos se creen antes que los externos
        notes.sort((a, b) => {
            const targetA = a.getAttribute('target') || '';
            const targetB = b.getAttribute('target') || '';
            
            // Priorizar notas que apuntan a seg sobre las que apuntan a l
            const aIsSeg = targetA.includes('seg-');
            const bIsSeg = targetB.includes('seg-');
            
            if (aIsSeg && !bIsSeg) return -1;
            if (!aIsSeg && bIsSeg) return 1;
            
            // Si ambas son del mismo tipo, por número de targets (menos targets = más específico)
            const aCount = targetA.split(/\s+/).length;
            const bCount = targetB.split(/\s+/).length;
            return aCount - bCount;
        });

        notes.forEach(note => {
            const targetAttr = note.getAttribute('target');
            const noteId = note.getAttribute('xml:id');
            
            if (!targetAttr || !noteId) return;

            const targets = targetAttr.split(/\s+/).map(t => t.replace('#', ''));
            const targetElements = [];

            // Buscar todos los elementos target en el DOM
            targets.forEach(targetId => {
                let element = teiContainer.querySelector(`[xml\\:id="${targetId}"]`);
                
                if (!element) {
                    const allElements = teiContainer.querySelectorAll('*');
                    for (let el of allElements) {
                        if (el.getAttribute('xml:id') === targetId) {
                            element = el;
                            break;
                        }
                    }
                }
                
                if (element) {
                    targetElements.push(element);
                    console.log(`Encontrado target: ${targetId}`, element);
                } else {
                    console.warn(`No se encontró elemento con xml:id="${targetId}"`);
                }
            });

            if (targetElements.length === 0) return;

            console.log(`Procesando ${targetElements.length} elementos para nota ${noteId}`);

            // Añadir clase y eventos a cada elemento target
            targetElements.forEach(element => {
                // Buscar si ya existe un wrapper directo hijo del elemento
                let wrapperElement = null;
                
                // Verificar si el primer hijo es un wrapper
                if (element.firstElementChild && element.firstElementChild.classList.contains('note-wrapper')) {
                    wrapperElement = element.firstElementChild;
                } else {
                    // Si no hay wrapper, crear uno nuevo
                    wrapperElement = document.createElement('span');
                    wrapperElement.className = 'note-wrapper note-target';
                    
                    // Mover TODO el contenido del elemento al wrapper
                    // Importante: usar childNodes para incluir nodos de texto
                    const childNodes = Array.from(element.childNodes);
                    childNodes.forEach(child => {
                        wrapperElement.appendChild(child);
                    });
                    
                    // Añadir el wrapper al elemento
                    element.appendChild(wrapperElement);
                }
                
                // Asegurar que el wrapper tenga las clases necesarias
                if (!wrapperElement.classList.contains('note-target')) {
                    wrapperElement.classList.add('note-target');
                }
                
                console.log(`Wrapper configurado para:`, element, `Clases:`, wrapperElement.className);
                
                // Añadir el ID de nota a la lista de grupos
                const currentGroups = wrapperElement.getAttribute('data-note-groups') || '';
                const groups = currentGroups ? currentGroups.split(' ').filter(g => g) : [];
                if (!groups.includes(noteId)) {
                    groups.push(noteId);
                    wrapperElement.setAttribute('data-note-groups', groups.join(' '));
                    console.log(`Elemento ${element.getAttribute('xml:id')} asignado a grupo(s): ${groups.join(' ')}`);
                    
                    // Propagar el grupo a todos los wrappers descendientes
                    const childWrappers = wrapperElement.querySelectorAll('.note-wrapper');
                    childWrappers.forEach(childWrapper => {
                        const childGroups = childWrapper.getAttribute('data-note-groups') || '';
                        const childGroupsArray = childGroups ? childGroups.split(' ').filter(g => g) : [];
                        if (!childGroupsArray.includes(noteId)) {
                            childGroupsArray.push(noteId);
                            childWrapper.setAttribute('data-note-groups', childGroupsArray.join(' '));
                            console.log(`  - Propagado grupo ${noteId} a wrapper hijo`);
                        }
                    });
                }

                // Añadir eventos solo una vez por wrapper
                if (!wrapperElement.hasAttribute('data-note-events')) {
                    wrapperElement.setAttribute('data-note-events', 'true');
                    
                    // Evento mouseenter
                    wrapperElement.addEventListener('mouseenter', function(e) {
                        // Detener propagación para evitar activar múltiples notas anidadas
                        e.stopPropagation();
                        
                        const elementGroups = this.getAttribute('data-note-groups');
                        if (!elementGroups) return;
                        
                        const groupsArray = elementGroups.split(' ').filter(g => g);
                        
                        // Activar TODOS los grupos a los que pertenece este elemento
                        const allElements = teiContainer.querySelectorAll('[data-note-groups]');
                        allElements.forEach(el => {
                            const elGroupsStr = el.getAttribute('data-note-groups');
                            if (elGroupsStr) {
                                const elGroups = elGroupsStr.split(' ').filter(g => g);
                                // Si el elemento comparte algún grupo con el elemento actual, activarlo
                                const hasCommonGroup = groupsArray.some(group => elGroups.includes(group));
                                if (hasCommonGroup) {
                                    el.classList.add('note-active');
                                }
                            }
                        });
                    });

                    // Evento mouseleave
                    wrapperElement.addEventListener('mouseleave', function(e) {
                        e.stopPropagation();
                        
                        // Verificar si el destino del ratón es un wrapper relacionado
                        const relatedTarget = e.relatedTarget;
                        
                        // Si el destino es un wrapper con grupos compartidos, no desactivar
                        if (relatedTarget) {
                            // Buscar el wrapper más cercano del destino
                            const targetWrapper = relatedTarget.closest('.note-wrapper');
                            if (targetWrapper) {
                                const currentGroups = this.getAttribute('data-note-groups');
                                const targetGroups = targetWrapper.getAttribute('data-note-groups');
                                
                                if (currentGroups && targetGroups) {
                                    const currentGroupsArray = currentGroups.split(' ').filter(g => g);
                                    const targetGroupsArray = targetGroups.split(' ').filter(g => g);
                                    
                                    // Si comparten algún grupo, no desactivar
                                    const hasCommonGroup = currentGroupsArray.some(g => targetGroupsArray.includes(g));
                                    if (hasCommonGroup) {
                                        return; // No desactivar, el mouseenter del destino se encargará
                                    }
                                }
                            }
                        }
                        
                        // Si no hay destino relacionado, desactivar todo
                        const allActive = teiContainer.querySelectorAll('.note-active');
                        allActive.forEach(el => el.classList.remove('note-active'));
                    });
                    
                    // Evento click
                    wrapperElement.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const elementGroups = this.getAttribute('data-note-groups');
                        if (!elementGroups) return;
                        
                        const groupsArray = elementGroups.split(' ').filter(g => g);
                        const activeGroup = groupsArray[0];
                        
                        console.log('Click en elemento, mostrando nota:', activeGroup);
                        
                        // Buscar la nota en el XML
                        let noteToShow = null;
                        const allNotes = window.notasXML.getElementsByTagName('note');
                        for (let note of allNotes) {
                            if (note.getAttribute('xml:id') === activeGroup) {
                                noteToShow = note;
                                break;
                            }
                        }
                        
                        if (noteToShow) {
                            // Mostrar nota usando función compartida
                            mostrarNotaEnPanel(noteToShow, activeGroup, teiContainer, noteContentDiv);
                        } else {
                            noteContentDiv.innerHTML = '<p>Nota no encontrada.</p>';
                            console.error('No se encontró nota con xml:id:', activeGroup);
                        }
                    });
                }
            });
        });

        // Guardar lista de todas las notas para navegación
        window.edicionNotas.todasLasNotas = notes.map(n => n.getAttribute('xml:id')).filter(id => id);
        console.log(`Total de notas para navegación: ${window.edicionNotas.todasLasNotas.length}`);
        
        // ← AQUÍ VA TODO AL FINAL DE processNotes():
        console.log('Notas procesadas correctamente');
        
        // Inicializar sistema de evaluación
        if (window.edicionEvaluacion) {
            window.edicionEvaluacion.init();
        }
    } // ← Fin de processNotes()
    
    // Función para mostrar nota en el panel con navegación
    function mostrarNotaEnPanel(noteToShow, noteXmlId, teiContainer, noteContentDiv) {
        const noteType = noteToShow.getAttribute('type') || '';
        const noteSubtype = noteToShow.getAttribute('subtype') || '';
        
        // Mapeo de tipologías normalizadas
        const typeMap = {
            'lexica': 'léxica',
            'parafrasis': 'paráfrasis',
            'historica': 'histórica',
            'geografica': 'geográfica',
            'mitologica': 'mitológica',
            'estilistica': 'estilística',
            'escenica': 'escénica',
            'ecdotica': 'ecdótica',
            'realia': 'realia'
        };
        
        // Construir badges de tipo/subtipo
        let badgesHTML = '';
        if (noteType) {
            const normalizedType = typeMap[noteType] || noteType;
            badgesHTML += `<span class="note-badge note-badge-type">${normalizedType}</span>`;
        }
        if (noteSubtype) {
            const normalizedSubtype = typeMap[noteSubtype] || noteSubtype;
            badgesHTML += `<span class="note-badge note-badge-subtype">${normalizedSubtype}</span>`;
        }
        
        // Obtener contadores de evaluaciones usando módulo reutilizable
        const evaluacionesHTML = typeof obtenerEvaluacionesHTML === 'function' 
            ? obtenerEvaluacionesHTML(noteXmlId) 
            : '';
        
        // Actualizar estado de navegación
        window.edicionNotas.notaActualId = noteXmlId;
        window.edicionNotas.notaActualIndex = window.edicionNotas.todasLasNotas.indexOf(noteXmlId);
        
        const currentIndex = window.edicionNotas.notaActualIndex;
        const totalNotas = window.edicionNotas.todasLasNotas.length;
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex < totalNotas - 1;
        
        // Marcar nota activa en el texto (persistente)
        marcarNotaActivaEnTexto(noteXmlId, teiContainer);
        
        noteContentDiv.innerHTML = `
            <div class="note-panel-header">
                <div class="note-nav-controls">
                    <button class="btn-nav-nota" id="btn-nota-prev" ${!hasPrev ? 'disabled' : ''} title="Nota anterior">
                        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
                    </button>
                    <span class="nota-posicion">Nota ${currentIndex + 1} de ${totalNotas}</span>
                    <button class="btn-nav-nota" id="btn-nota-next" ${!hasNext ? 'disabled' : ''} title="Nota siguiente">
                        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
                    </button>
                </div>
                <button class="btn-cerrar-nota" id="btn-cerrar-nota" title="Cerrar nota">
                    <i class="fa-solid fa-times" aria-hidden="true"></i>
                </button>
            </div>
            <div class="note-display" data-note-id="${noteXmlId}">
                <div class="note-header">
                    
                    ${badgesHTML ? `<div class="note-badges">${badgesHTML}</div>` : ''}
                </div>
                <p>${noteToShow.textContent.trim()}</p>
                ${evaluacionesHTML}
                <div class="note-footer">
                </div>
            </div>
        `;
        
        // Añadir event listeners para navegación
        document.getElementById('btn-nota-prev')?.addEventListener('click', () => {
            navegarNota(-1, teiContainer, noteContentDiv);
        });
        
        document.getElementById('btn-nota-next')?.addEventListener('click', () => {
            navegarNota(1, teiContainer, noteContentDiv);
        });
        
        document.getElementById('btn-cerrar-nota')?.addEventListener('click', () => {
            cerrarNota(teiContainer, noteContentDiv);
        });
    }
    
    // Función para navegar entre notas
    function navegarNota(direccion, teiContainer, noteContentDiv) {
        const newIndex = window.edicionNotas.notaActualIndex + direccion;
        
        if (newIndex < 0 || newIndex >= window.edicionNotas.todasLasNotas.length) return;
        
        const newNoteId = window.edicionNotas.todasLasNotas[newIndex];
        
        // Buscar la nota en el XML
        const allNotes = window.notasXML.getElementsByTagName('note');
        let noteToShow = null;
        for (let note of allNotes) {
            if (note.getAttribute('xml:id') === newNoteId) {
                noteToShow = note;
                break;
            }
        }
        
        if (noteToShow) {
            mostrarNotaEnPanel(noteToShow, newNoteId, teiContainer, noteContentDiv);
            
            // Scroll al elemento en el texto
            const wrapper = teiContainer.querySelector(`[data-note-groups*="${newNoteId}"]`);
            if (wrapper) {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    // Función para cerrar la nota
    function cerrarNota(teiContainer, noteContentDiv) {
        // Quitar highlight activo
        teiContainer.querySelectorAll('.note-current').forEach(el => {
            el.classList.remove('note-current', 'note-active');
        });
        
        // Resetear estado
        window.edicionNotas.notaActualId = null;
        window.edicionNotas.notaActualIndex = -1;
        
        // Mostrar placeholder
        noteContentDiv.innerHTML = '<p class="placeholder-text">Haz clic en el texto subrayado para ver las notas.</p>';
    }
    
    // Función para marcar nota activa en el texto (persistente)
    function marcarNotaActivaEnTexto(noteId, teiContainer) {
        // Quitar marca anterior
        teiContainer.querySelectorAll('.note-current').forEach(el => {
            el.classList.remove('note-current', 'note-active');
        });
        
        // Marcar la nueva
        if (noteId) {
            const wrappers = teiContainer.querySelectorAll(`[data-note-groups*="${noteId}"]`);
            wrappers.forEach(wrapper => {
                wrapper.classList.add('note-current', 'note-active');
            });
        }
    }
    
    
    // Llamar a la función de alineación después de que el TEI esté cargado
    const verseObserver = new MutationObserver(() => {
        if (teiContainer.querySelector('tei-l[part]')) {
            alignSplitVerses(teiContainer);
            verseObserver.disconnect();
        }
    });
    
    verseObserver.observe(teiContainer, { childList: true, subtree: true });
    
    // Funcionalidad para redimensionar el panel de notas
    const resizeHandle = document.getElementById('resize-handle');
    const notesColumn = document.querySelector('.notes-column');
    
    if (resizeHandle && notesColumn) {
        let isResizing = false;
        
        resizeHandle.addEventListener('mousedown', function(e) {
            isResizing = true;
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            
            const windowWidth = window.innerWidth;
            const mouseX = e.clientX;
            const newWidth = ((windowWidth - mouseX) / windowWidth) * 100;
            
            // Limitar entre 20% y 50%
            if (newWidth >= 20 && newWidth <= 50) {
                notesColumn.style.width = newWidth + '%';
            }
        });
        
        document.addEventListener('mouseup', function() {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    
    /**
     * Navegación por índice
     */
    function initializeNavigation() {
        const navButtons = document.querySelectorAll('.btn-nav-item');
        
        navButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Obtener atributos del botón
                const targetType = this.getAttribute('data-target-type'); // 'head' o 'div'
                const targetAttr = this.getAttribute('data-target-attr'); // 'type' o 'n'
                const targetValue = this.getAttribute('data-target-value'); // valor del atributo
                
                // Construir selector
                let selector;
                if (targetType === 'div') {
                    // Para actos: tei-div[type="act"][n="1"]
                    selector = `tei-div[type="act"][${targetAttr}="${targetValue}"]`;
                } else if (targetType === 'head') {
                    // Para título y dramatis: tei-head[type="comedia-head"]
                    selector = `tei-${targetType}[${targetAttr}="${targetValue}"]`;
                }
                
                // Buscar elemento
                const targetElement = teiContainer.querySelector(selector);
                
                if (targetElement) {
                    // Remover clase active de todos los botones
                    navButtons.forEach(btn => btn.classList.remove('active'));
                    
                    // Agregar clase active al botón clickeado
                    this.classList.add('active');
                    
                    // Hacer scroll al elemento
                    targetElement.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start',
                        inline: 'nearest'
                    });
                    
                    console.log('✓ Navegado a:', selector);
                } else {
                    console.warn('⚠ No se encontró el elemento:', selector);
                    console.log('Contenedor TEI:', teiContainer);
                }
            });
        });
        
        console.log('✓ Navegación por índice inicializada');
        
        // Detectar sección actual al scroll
        const textColumn = document.querySelector('.text-column');
        const sections = [
            { type: 'head', attr: 'type', value: 'comedia-head' },
            { type: 'head', attr: 'type', value: 'castList-head' },
            { type: 'div', attr: 'n', value: '1' },
            { type: 'div', attr: 'n', value: '2' },
            { type: 'div', attr: 'n', value: '3' }
        ];
        
        textColumn.addEventListener('scroll', () => {
            let currentSection = null;
            let minDistance = Infinity;
            
            sections.forEach(section => {
                let selector;
                if (section.type === 'div') {
                    selector = `tei-div[type="act"][${section.attr}="${section.value}"]`;
                } else if (section.type === 'head') {
                    selector = `tei-${section.type}[${section.attr}="${section.value}"]`;
                }
                
                const element = teiContainer.querySelector(selector);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const textRect = textColumn.getBoundingClientRect();
                    const distance = Math.abs(rect.top - textRect.top);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        currentSection = section;
                    }
                }
            });
            
            if (currentSection) {
                navButtons.forEach(btn => {
                    const btnType = btn.getAttribute('data-target-type');
                    const btnAttr = btn.getAttribute('data-target-attr');
                    const btnValue = btn.getAttribute('data-target-value');
                    
                    if (btnType === currentSection.type && btnAttr === currentSection.attr && btnValue === currentSection.value) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        });
    }
    
    /**
     * Observer para esperar a que el TEI esté completamente cargado
     * Una vez detecte elementos TEI, inicializa la navegación
     */
    const teiObserver = new MutationObserver((mutations, obs) => {
        // Verificar si ya hay elementos TEI cargados
        const hasTeiContent = teiContainer.querySelector('tei-div[type="act"]') || 
                             teiContainer.querySelector('tei-head');
        
        if (hasTeiContent) {
            console.log('✓ Contenido TEI detectado, inicializando navegación...');
            
            // Pequeño delay para asegurar que todo el DOM esté renderizado
            setTimeout(() => {
                initializeNavigation();
                obs.disconnect(); // Dejar de observar
            }, 100);
        }
    });
    
    // Iniciar observación
    teiObserver.observe(teiContainer, { 
        childList: true, 
        subtree: true 
    });
    
    // Fallback: Si el TEI ya está cargado cuando se ejecuta el script
    if (teiContainer.querySelector('tei-div[type="act"]') || 
        teiContainer.querySelector('tei-head')) {
        console.log('✓ TEI ya estaba cargado, inicializando navegación...');
        setTimeout(initializeNavigation, 100);
    }
});
