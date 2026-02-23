(function() {
    'use strict';

    const navbar = document.querySelector('.nav-wrapper');
    const mainNav = document.querySelector('#mainNav');
    const navExpanded = document.getElementById('navExpanded');
    const navToggle = document.getElementById('navToggle');
    const navBackdrop = document.getElementById('navBackdrop');
    const btnFlotante = document.getElementById('btn-modo-usuario');
    const root = document.documentElement;

    if (!navbar) return;

    const navbarBehavior = navbar.getAttribute('data-navbar-behavior') || 'fixed';

    let lastScrollTop = 0;
    let isNavbarVisible = navbarBehavior !== 'hidden-on-load';
    let isMenuExpanded = false;
    const scrollThreshold = 10;
    const scrollTriggerDistance = 100;

    let lastNavbarHeight = 0;
    let isMenuClosing = false;
    let closeHeightSyncTimer = null;
    let closeHeightTransitionHandler = null;

    function clearCloseHeightSync() {
        if (closeHeightTransitionHandler && navExpanded) {
            navExpanded.removeEventListener('transitionend', closeHeightTransitionHandler);
            closeHeightTransitionHandler = null;
        }

        if (closeHeightSyncTimer !== null) {
            window.clearTimeout(closeHeightSyncTimer);
            closeHeightSyncTimer = null;
        }
    }

    function finalizeCloseHeightSync() {
        isMenuClosing = false;
        clearCloseHeightSync();
        requestAnimationFrame(updateNavbarHeight);
    }

    function syncNavbarHeightAfterClose() {
        clearCloseHeightSync();
        isMenuClosing = true;

        if (!navExpanded) {
            finalizeCloseHeightSync();
            return;
        }

        closeHeightTransitionHandler = function(e) {
            if (e.target !== navExpanded || e.propertyName !== 'max-height') {
                return;
            }
            finalizeCloseHeightSync();
        };

        navExpanded.addEventListener('transitionend', closeHeightTransitionHandler);
        closeHeightSyncTimer = window.setTimeout(() => {
            finalizeCloseHeightSync();
        }, 500);
    }

    function updateNavbarHeight() {
        if (!navbar) return;
        if ((mainNav && mainNav.classList.contains('expanded')) || isMenuClosing) {
            return;
        }
        const height = Math.round(navbar.getBoundingClientRect().height || 0);
        if (height !== lastNavbarHeight) {
            lastNavbarHeight = height;
            root.style.setProperty('--navbar-height', `${height}px`);
        }
    }

    updateNavbarHeight();
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => updateNavbarHeight());
        resizeObserver.observe(navbar);
    } else {
        window.addEventListener('resize', updateNavbarHeight, { passive: true });
    }

    function initHiddenOnLoad() {
        navbar.classList.remove('visible');
        isNavbarVisible = false;

        function handleScroll(scrollTop) {
            if (scrollTop > scrollTriggerDistance && !isNavbarVisible) {
                navbar.classList.add('visible');
                isNavbarVisible = true;
            } else if (scrollTop <= scrollTriggerDistance && isNavbarVisible && !isMenuExpanded) {
                navbar.classList.remove('visible');
                isNavbarVisible = false;
            }

            lastScrollTop = scrollTop;
        }

        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            handleScroll(scrollTop);
        }, { passive: true });

        document.body.addEventListener('scroll', function() {
            handleScroll(document.body.scrollTop);
        }, { passive: true });
    }

    function initAutoHide() {
        isNavbarVisible = true;

        function handleScroll(scrollTop) {
            if (isMenuExpanded) {
                return;
            }

            const scrollDelta = Math.abs(scrollTop - lastScrollTop);
            if (scrollDelta < scrollThreshold) {
                return;
            }

            if (scrollTop > lastScrollTop && scrollTop > 80) {
                if (isNavbarVisible) {
                    navbar.style.transform = 'translateY(-100%)';
                    isNavbarVisible = false;
                }
            } else {
                if (!isNavbarVisible || scrollTop <= 80) {
                    navbar.style.transform = 'translateY(0)';
                    isNavbarVisible = true;
                }
            }

            lastScrollTop = scrollTop;
        }

        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            handleScroll(scrollTop);
        }, { passive: true });

        document.body.addEventListener('scroll', function() {
            handleScroll(document.body.scrollTop);
        }, { passive: true });

        const mainElement = document.querySelector('main#maincontent');
        if (mainElement) {
            mainElement.addEventListener('scroll', function() {
                handleScroll(mainElement.scrollTop);
            }, { passive: true });
        }

        const lecturaWrapper = document.querySelector('.lectura-wrapper');
        if (lecturaWrapper) {
            lecturaWrapper.addEventListener('scroll', function() {
                handleScroll(lecturaWrapper.scrollTop);
            }, { passive: true });
        }
    }

    function initFixed() {
        isNavbarVisible = true;
    }

    switch (navbarBehavior) {
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

    function openMenu() {
        if (!mainNav) return;

        clearCloseHeightSync();
        isMenuClosing = false;
        mainNav.classList.add('expanded');
        navbar.classList.add('menu-expanded');
        if (navBackdrop) navBackdrop.classList.add('active');
        if (btnFlotante) btnFlotante.classList.add('hidden');
        isMenuExpanded = true;

        requestAnimationFrame(updateNavbarHeight);

        if (navbarBehavior === 'hidden-on-load') {
            navbar.classList.add('visible');
            isNavbarVisible = true;
        } else if (navbarBehavior === 'auto-hide') {
            navbar.style.transform = 'translateY(0)';
            isNavbarVisible = true;
        }
    }

    function closeMenu() {
        if (!mainNav) return;

        const wasExpanded = mainNav.classList.contains('expanded');
        mainNav.classList.remove('expanded');
        navbar.classList.remove('menu-expanded');
        if (navBackdrop) navBackdrop.classList.remove('active');
        if (btnFlotante) btnFlotante.classList.remove('hidden');
        isMenuExpanded = false;

        if (wasExpanded) {
            syncNavbarHeightAfterClose();
        } else {
            isMenuClosing = false;
            requestAnimationFrame(updateNavbarHeight);
        }
    }

    if (navToggle) {
        navToggle.addEventListener('click', function(e) {
            e.preventDefault();
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
})();
