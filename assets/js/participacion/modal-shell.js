(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.modalShell) return;

  var openStack = [];

  function getContainer(container) {
    return container || document.getElementById('modal-container') || document.body;
  }

  function addClassName(element, className) {
    if (!element || !className) return;
    String(className || '').split(/\s+/).forEach(function (token) {
      if (token) element.classList.add(token);
    });
  }

  function isVisible(element) {
    if (!element) return false;
    if (element.hidden) return false;
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function getFocusableElements(root) {
    if (!root) return [];

    return Array.prototype.slice.call(
      root.querySelectorAll(
        'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [contenteditable], [tabindex]:not([tabindex="-1"])'
      )
    ).filter(isVisible);
  }

  function focusElement(element) {
    if (!element || typeof element.focus !== 'function') return;

    try {
      element.focus({ preventScroll: true });
    } catch (err) {
      element.focus();
    }
  }

  function removeFromStack(controller) {
    openStack = openStack.filter(function (item) {
      return item !== controller;
    });
  }

  function isTopmost(controller) {
    return openStack.length > 0 && openStack[openStack.length - 1] === controller;
  }

  function attach(modal, options) {
    if (!modal) return null;

    var settings = options || {};
    var content = modal.querySelector('.modal-content');
    var overlay = modal.querySelector('.modal-overlay');
    var closeSelector = settings.closeSelector || '[data-modal-close], .modal-shell-close';
    var closeButtons = Array.prototype.slice.call(modal.querySelectorAll(closeSelector));

    if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
    if (!modal.getAttribute('aria-modal')) modal.setAttribute('aria-modal', 'true');
    if (settings.labelledBy) modal.setAttribute('aria-labelledby', settings.labelledBy);
    if (settings.describedBy) modal.setAttribute('aria-describedby', settings.describedBy);

    var controller = {
      modal: modal,
      content: content,
      overlay: overlay,
      closeButtons: closeButtons,
      options: settings,
      previousFocus: null,
      isOpen: false,
      open: open,
      close: close,
      destroy: destroy,
      requestClose: requestClose,
      focus: focus
    };

    function focus(target) {
      var element = target;

      if (typeof target === 'string') {
        element = modal.querySelector(target);
      }

      if (!isVisible(element)) {
        var focusable = getFocusableElements(modal);
        element = focusable[0] || content || modal;
      }

      focusElement(element);
    }

    function focusInitial() {
      window.setTimeout(function () {
        if (!controller.isOpen) return;
        if (controller.options.initialFocusSelector) {
          focus(controller.options.initialFocusSelector);
          return;
        }
        focus(null);
      }, 0);
    }

    function trapFocus(event) {
      var focusable = getFocusableElements(modal);
      if (!focusable.length) {
        event.preventDefault();
        focus(content || modal);
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !modal.contains(active)) {
          event.preventDefault();
          focus(last);
        }
        return;
      }

      if (active === last || !modal.contains(active)) {
        event.preventDefault();
        focus(first);
      }
    }

    function handleKeydown(event) {
      if (!controller.isOpen || !isTopmost(controller)) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose(false, 'escape');
        return;
      }

      if (event.key === 'Tab' && controller.options.trapFocus !== false) {
        trapFocus(event);
      }
    }

    function handleDismissClick(event) {
      event.preventDefault();
      requestClose(false, event.currentTarget === overlay ? 'overlay' : 'button');
    }

    function open() {
      if (controller.isOpen) {
        focusInitial();
        return;
      }

      controller.previousFocus = document.activeElement;
      controller.isOpen = true;
      modal.classList.add('show');
      removeFromStack(controller);
      openStack.push(controller);
      document.addEventListener('keydown', handleKeydown);
      focusInitial();
    }

    function close(result) {
      if (!controller.isOpen && !modal.classList.contains('show')) return;

      controller.isOpen = false;
      modal.classList.remove('show');
      document.removeEventListener('keydown', handleKeydown);
      removeFromStack(controller);

      if (controller.options.restoreFocus !== false && controller.previousFocus && typeof controller.previousFocus.focus === 'function') {
        focusElement(controller.previousFocus);
      }

      if (typeof controller.options.onAfterClose === 'function') {
        controller.options.onAfterClose(result, controller);
      }

      if (controller.options.destroyOnClose) {
        destroy();
      }
    }

    function destroy() {
      controller.isOpen = false;
      document.removeEventListener('keydown', handleKeydown);
      removeFromStack(controller);
      if (overlay) overlay.removeEventListener('click', handleDismissClick);
      closeButtons.forEach(function (button) {
        button.removeEventListener('click', handleDismissClick);
      });
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    }

    function requestClose(result, source) {
      if (typeof controller.options.onRequestClose === 'function') {
        controller.options.onRequestClose(result, source, controller);
        return;
      }
      close(result);
    }

    if (overlay && settings.closeOnOverlay !== false) {
      overlay.addEventListener('click', handleDismissClick);
    }

    if (settings.closeOnButton !== false) {
      closeButtons.forEach(function (button) {
        button.addEventListener('click', handleDismissClick);
      });
    }

    return controller;
  }

  function mountTemplate(options) {
    var settings = options || {};
    var templateId = settings.templateId;
    var template = templateId ? document.getElementById(templateId) : null;
    if (!template || !template.content) return null;

    var fragment = template.content.cloneNode(true);
    var modal = fragment.firstElementChild;
    if (!modal) return null;

    addClassName(modal, settings.modalClassName);
    addClassName(modal.querySelector('.modal-content'), settings.contentClassName);

    getContainer(settings.container).appendChild(fragment);
    return attach(modal, settings);
  }

  function create(options) {
    var settings = options || {};
    var modal = document.createElement('div');
    modal.className = 'modal';
    addClassName(modal, settings.modalClassName);

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    var content = document.createElement('div');
    content.className = 'modal-content';
    addClassName(content, settings.contentClassName);

    modal.appendChild(overlay);
    modal.appendChild(content);

    if (settings.closeButton !== false) {
      var closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', settings.closeButtonLabel || 'Cerrar modal');
      closeButton.setAttribute('data-modal-close', 'true');
      addClassName(closeButton, settings.closeButtonClassName || 'btn-circular modal-shell-close');
      closeButton.innerHTML = settings.closeButtonHtml || '<span aria-hidden="true">&times;</span>';
      content.appendChild(closeButton);
    }

    if (settings.bodyHtml) {
      content.insertAdjacentHTML('beforeend', settings.bodyHtml);
    }

    getContainer(settings.container).appendChild(modal);
    return attach(modal, settings);
  }

  ns.modalShell = {
    attach: attach,
    create: create,
    mountTemplate: mountTemplate
  };
})();
