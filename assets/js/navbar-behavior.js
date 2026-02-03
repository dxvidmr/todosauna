/**
 * Sistema centralizado de comportamiento del navbar
 * Controla tres tipos de comportamiento según data-navbar-behavior:
 * - "hidden-on-load": Navbar oculto al inicio, aparece al hacer scroll (home)
 * - "auto-hide": Navbar visible, se oculta al scroll down, aparece al scroll up (lectura)
 * - "fixed" o undefined: Navbar siempre visible (resto de páginas)
 * 
 * IMPORTANTE: Los estilos base están en _navbar.scss
 * Este JS solo añade/quita clases y maneja eventos de scroll
 */

(function() {
    'use strict';
    
    const navbar = document.querySelector('.nav-wrapper');
    const mainNav = document.querySelector('#mainNav');
    
    if (!navbar) return;
    
    // Leer el comportamiento desde el nav-wrapper (donde está centralizado)
    const navbarBehavior = navbar.getAttribute('data-navbar-behavior') || 'fixed';
    
    let lastScrollTop = 0;
    let isNavbarVisible = navbarBehavior !== 'hidden-on-load'; // hidden-on-load empieza oculto
    let isMenuExpanded = false;
    const scrollThreshold = 10;
    const scrollTriggerDistance = 100;
    
    console.log('[Navbar] Inicializando con comportamiento:', navbarBehavior);
    
    /**
     * Comportamiento: hidden-on-load
     * Navbar oculto al inicio, aparece al hacer scroll
     * Los estilos de visibilidad están en CSS (clase .visible)
     */
    function initHiddenOnLoad() {
        // Asegurar que empieza sin la clase visible
        navbar.classList.remove('visible');
        isNavbarVisible = false;
        
        function handleScroll(scrollTop) {
            if (scrollTop > scrollTriggerDistance && !isNavbarVisible) {
                navbar.classList.add('visible');
                isNavbarVisible = true;
            } else if (scrollTop <= scrollTriggerDistance && isNavbarVisible && !isMenuExpanded) {
                // No ocultar si el menú está expandido
                navbar.classList.remove('visible');
                isNavbarVisible = false;
            }
            
            lastScrollTop = scrollTop;
        }
        
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            handleScroll(scrollTop);
        }, { passive: true });
        
        // Listener para body scroll (Bootstrap h-100)
        document.body.addEventListener('scroll', function() {
            handleScroll(document.body.scrollTop);
        }, { passive: true });
    }
    
    /**
     * Comportamiento: auto-hide
     * Navbar visible al inicio, se oculta al scroll down, aparece al scroll up
     */
    function initAutoHide() {
        isNavbarVisible = true;
        
        function handleScroll(scrollTop) {
            // NO ocultar si el menú está expandido
            if (isMenuExpanded) {
                return;
            }
            
            const scrollDelta = Math.abs(scrollTop - lastScrollTop);
            
            if (scrollDelta < scrollThreshold) {
                return;
            }
            
            if (scrollTop > lastScrollTop && scrollTop > 80) {
                // Scrolling hacia abajo - ocultar navbar
                if (isNavbarVisible) {
                    navbar.style.transform = 'translateY(-100%)';
                    isNavbarVisible = false;
                    console.log('[Auto-hide] Ocultando navbar, scrollTop:', scrollTop);
                }
            } else {
                // Scrolling hacia arriba - mostrar navbar
                if (!isNavbarVisible || scrollTop <= 80) {
                    navbar.style.transform = 'translateY(0)';
                    isNavbarVisible = true;
                    console.log('[Auto-hide] Mostrando navbar, scrollTop:', scrollTop);
                }
            }
            
            lastScrollTop = scrollTop;
        }
        
        // Listener para window scroll
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            handleScroll(scrollTop);
        }, { passive: true });
        
        // Listener para body scroll (Bootstrap h-100 causa que el scroll sea en body)
        document.body.addEventListener('scroll', function() {
            handleScroll(document.body.scrollTop);
        }, { passive: true });
        
        // Listener para main scroll (en caso de que el scroll esté contenido por Bootstrap h-100)
        const mainElement = document.querySelector('main#maincontent');
        if (mainElement) {
            mainElement.addEventListener('scroll', function() {
                handleScroll(mainElement.scrollTop);
            }, { passive: true });
        }
        
        // También escuchar en .lectura-wrapper por si el scroll está ahí
        const lecturaWrapper = document.querySelector('.lectura-wrapper');
        if (lecturaWrapper) {
            lecturaWrapper.addEventListener('scroll', function() {
                handleScroll(lecturaWrapper.scrollTop);
            }, { passive: true });
        }
        
        console.log('[Auto-hide] Listeners registrados en: window, body' + 
            (mainElement ? ', main' : '') + 
            (lecturaWrapper ? ', .lectura-wrapper' : ''));
    }
    
    /**
     * Comportamiento: fixed
     * Navbar siempre visible - no necesita JS, todo está en CSS
     */
    function initFixed() {
        // No aplicar estilos inline innecesarios
        // Los estilos están definidos en CSS para [data-navbar-behavior="fixed"]
        isNavbarVisible = true;
    }
    
    // Inicializar según el comportamiento especificado
    switch(navbarBehavior) {
        case 'hidden-on-load':
            initHiddenOnLoad();
            break;
        case 'auto-hide':
            initAutoHide();
            break;
        case 'fixed':
        default:
            initFixed();
            break;
    }
    
    // ====================================
    // MANEJO DEL TOGGLE DEL MENÚ EXPANDIDO
    // ====================================
    
    const navToggle = document.getElementById('navToggle');
    const navBackdrop = document.getElementById('navBackdrop');
    const btnFlotante = document.getElementById('btn-modo-usuario');
    
    function openMenu() {
        if (!mainNav) return;
        
        mainNav.classList.add('expanded');
        if (navBackdrop) navBackdrop.classList.add('active');
        if (btnFlotante) btnFlotante.classList.add('hidden');
        isMenuExpanded = true;
        
        // Asegurar que el navbar sea visible cuando se abre el menú
        if (navbarBehavior === 'hidden-on-load') {
            navbar.classList.add('visible');
            isNavbarVisible = true;
        } else if (navbarBehavior === 'auto-hide') {
            navbar.style.transform = 'translateY(0)';
            isNavbarVisible = true;
        }
        
        console.log('[Navbar] Menú abierto');
    }
    
    function closeMenu() {
        if (!mainNav) return;
        
        mainNav.classList.remove('expanded');
        if (navBackdrop) navBackdrop.classList.remove('active');
        if (btnFlotante) btnFlotante.classList.remove('hidden');
        isMenuExpanded = false;
        
        console.log('[Navbar] Menú cerrado');
    }
    
    // Event listeners para el toggle
    if (navToggle) {
        navToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('[Navbar] Toggle clicked, expanded:', mainNav?.classList.contains('expanded'));
            
            if (mainNav && mainNav.classList.contains('expanded')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    } else {
        console.warn('[Navbar] navToggle no encontrado');
    }
    
    if (navBackdrop) {
        navBackdrop.addEventListener('click', closeMenu);
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isMenuExpanded) {
            closeMenu();
        }
    });
    
    // ====================================
    // BOTÓN "MI PARTICIPACIÓN"
    // Solo manejamos el estado hidden/visible aquí
    // La funcionalidad de click se maneja en modal-modo.js
    // ====================================
    
    // (El botón btnFlotante ya se maneja arriba en openMenu/closeMenu)
    
    // ====================================
    // API PÚBLICA
    // ====================================
    
    window.NavbarBehavior = {
        showNavbar: function() {
            if (navbarBehavior === 'hidden-on-load') {
                navbar.classList.add('visible');
                isNavbarVisible = true;
            } else if (navbarBehavior === 'auto-hide') {
                navbar.style.transform = 'translateY(0)';
                isNavbarVisible = true;
            }
        },
        hideNavbar: function() {
            if (navbarBehavior === 'hidden-on-load' && !isMenuExpanded) {
                navbar.classList.remove('visible');
                isNavbarVisible = false;
            } else if (navbarBehavior === 'auto-hide' && !isMenuExpanded) {
                navbar.style.transform = 'translateY(-100%)';
                isNavbarVisible = false;
            }
        },
        openMenu: openMenu,
        closeMenu: closeMenu,
        isVisible: () => isNavbarVisible,
        isExpanded: () => isMenuExpanded,
        getBehavior: () => navbarBehavior
    };
    
    console.log('[Navbar] Sistema inicializado correctamente');
})();
