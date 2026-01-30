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
    const mainNav = document.querySelector('#mainNav');
    const body = document.body;
    const navbarBehavior = body.getAttribute('data-navbar-behavior') || 'fixed';
    
    if (!navbar) return;
    
    let lastScrollTop = 0;
    let isNavbarVisible = true;
    let isMenuExpanded = false;
    const scrollThreshold = 10;
    const scrollTriggerDistance = 100;
    
    /**
     * Comportamiento: hidden-on-load
     * Navbar oculto al inicio, aparece al hacer scroll
     * Usado en: home/index
     */
    function initHiddenOnLoad() {
        navbar.classList.remove('visible');
        isNavbarVisible = false;
        
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
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
        navbar.style.transform = 'translateY(0)';
        navbar.style.transition = 'transform 0.3s ease';
        isNavbarVisible = true;
        
        function handleScroll() {
            // NO ocultar si el menú está expandido
            if (isMenuExpanded) {
                return;
            }
            
            const scrollTop = this.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
            const scrollDelta = Math.abs(scrollTop - lastScrollTop);
            
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
        
        // Detectar scroll en la columna de texto
        const scrollableColumn = document.querySelector('.text-column');
        if (scrollableColumn) {
            scrollableColumn.addEventListener('scroll', handleScroll);
        }
        
        window.addEventListener('scroll', handleScroll);
    }
    
    /**
     * Comportamiento: fixed
     * Navbar siempre visible
     */
    function initFixed() {
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
        if (navbarBehavior === 'auto-hide') {
            navbar.style.transform = 'translateY(0)';
            isNavbarVisible = true;
        }
    }
    
    function closeMenu() {
        if (!mainNav) return;
        
        mainNav.classList.remove('expanded');
        if (navBackdrop) navBackdrop.classList.remove('active');
        if (btnFlotante) btnFlotante.classList.remove('hidden');
        isMenuExpanded = false;
    }
    
    if (navToggle) {
        navToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (mainNav && mainNav.classList.contains('expanded')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
    }
    
    if (navBackdrop) {
        navBackdrop.addEventListener('click', closeMenu);
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isMenuExpanded) {
            closeMenu();
        }
    });
    
    // Exportar funciones para uso manual
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
        },
        openMenu: openMenu,
        closeMenu: closeMenu
    };
})();
