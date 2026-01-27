/**
 * Sistema centralizado de comportamiento del navbar
 * Controla tres tipos de comportamiento según data-navbar-behavior:
 * - "hidden-on-load": Navbar oculto al inicio, aparece al hacer scroll (home)
 * - "auto-hide": Navbar visible, se oculta al scroll down, aparece al scroll up (lectura)
 * - "fixed" o undefined: Navbar siempre visible (resto de páginas)
 */

(function() {
    'use strict';
    
    const navbar = document.querySelector('.nav-wrapper');
    const body = document.body;
    const navbarBehavior = body.getAttribute('data-navbar-behavior');
    
    if (!navbar) return;
    
    let lastScrollTop = 0;
    let isNavbarVisible = true;
    const scrollThreshold = 10; // Mínimo scroll para activar cambios
    const scrollTriggerDistance = 100; // Distancia para activar comportamientos
    
    /**
     * Comportamiento: hidden-on-load
     * Navbar oculto al inicio, aparece al hacer scroll
     * Usado en: home/index
     */
    function initHiddenOnLoad() {
        // Navbar inicia oculto
        navbar.classList.remove('visible');
        isNavbarVisible = false;
        
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Mostrar navbar si se hace scroll hacia abajo más de 100px
            if (scrollTop > scrollTriggerDistance && !isNavbarVisible) {
                navbar.classList.add('visible');
                isNavbarVisible = true;
            } else if (scrollTop <= scrollTriggerDistance && isNavbarVisible) {
                navbar.classList.remove('visible');
                isNavbarVisible = false;
            }
            
            lastScrollTop = scrollTop;
        });
    }
    
    /**
     * Comportamiento: auto-hide
     * Navbar visible al inicio, se oculta al scroll down, aparece al scroll up
     * Usado en: lectura, laboratorio
     */
    function initAutoHide() {
        // Navbar inicia visible
        navbar.style.transform = 'translateY(0)';
        navbar.style.transition = 'transform 0.3s ease';
        isNavbarVisible = true;
        
        // Función para manejar el scroll
        function handleScroll() {
            const scrollTop = this.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
            const scrollDelta = Math.abs(scrollTop - lastScrollTop);
            
            // Solo procesar si hay suficiente movimiento
            if (scrollDelta < scrollThreshold) {
                return;
            }
            
            if (scrollTop > lastScrollTop && scrollTop > 80) {
                // Scrolling hacia abajo - ocultar navbar
                if (isNavbarVisible) {
                    navbar.style.transform = 'translateY(-100%)';
                    isNavbarVisible = false;
                }
            } else {
                // Scrolling hacia arriba - mostrar navbar
                if (!isNavbarVisible || scrollTop <= 80) {
                    navbar.style.transform = 'translateY(0)';
                    isNavbarVisible = true;
                }
            }
            
            lastScrollTop = scrollTop;
        }
        
        // Detectar scroll en la columna de texto (para lectura/laboratorio)
        const scrollableColumn = document.querySelector('.text-column');
        if (scrollableColumn) {
            scrollableColumn.addEventListener('scroll', handleScroll);
        }
        
        // También escuchar el scroll del window
        window.addEventListener('scroll', handleScroll);
    }
    
    /**
     * Comportamiento: fixed
     * Navbar siempre visible
     * Usado en: todas las demás páginas
     */
    function initFixed() {
        // No hacer nada, el navbar permanece visible siempre
        navbar.style.transform = 'translateY(0)';
        navbar.style.transition = 'none';
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
    
    // Exportar funciones para uso manual si es necesario
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
            if (navbarBehavior === 'hidden-on-load') {
                navbar.classList.remove('visible');
                isNavbarVisible = false;
            } else if (navbarBehavior === 'auto-hide') {
                navbar.style.transform = 'translateY(-100%)';
                isNavbarVisible = false;
            }
        }
    };
})();
