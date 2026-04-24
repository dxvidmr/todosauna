if (typeof window !== 'undefined') {
  (function () {
    var rootNs = window.TA || (window.TA = {});
    if (rootNs.modal) return;

    var ROOT_ID = 'ta-modal-root';
    var openStack = [];
    var controllerMap = new WeakMap();
    var scrollLockState = null;
    var inertedElements = [];

    function resolveElement(target) {
      if (!target) return null;
      if (typeof target === 'string') return document.querySelector(target);
      if (target.modal instanceof Element) return target.modal;
      return target instanceof Element ? target : null;
    }

    function addClassName(element, className) {
      if (!element || !className) return;
      String(className).split(/\s+/).forEach(function (token) {
        if (token) element.classList.add(token);
      });
    }

    function parseBoolean(value, fallback) {
      if (value == null || value === '') return fallback;
      var normalized = String(value).trim().toLowerCase();
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
      return fallback;
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

    function ensureRoot() {
      var existing = document.getElementById(ROOT_ID);
      if (existing) return existing;

      var root = document.createElement('div');
      root.id = ROOT_ID;
      root.setAttribute('data-ta-modal-root', 'true');
      document.body.appendChild(root);
      return root;
    }

    function getContainer(container) {
      if (container instanceof Element) return container;
      if (typeof container === 'string') {
        var resolved = document.querySelector(container);
        if (resolved) return resolved;
      }
      return ensureRoot();
    }

    function emitEvent(modal, name, detail, cancelable) {
      if (!(modal instanceof Element)) return null;
      var event = new CustomEvent(name, {
        bubbles: true,
        cancelable: !!cancelable,
        detail: detail || {}
      });
      modal.dispatchEvent(event);
      return event;
    }

    function removeFromStack(controller) {
      openStack = openStack.filter(function (entry) {
        return entry !== controller;
      });
    }

    function isTopmost(controller) {
      return openStack.length > 0 && openStack[openStack.length - 1] === controller;
    }

    function getScrollLockControllers() {
      return openStack.filter(function (controller) {
        return controller && controller.isOpen && controller.options.lockScroll !== false;
      });
    }

    function applyScrollLock() {
      if (scrollLockState) return;

      var body = document.body;
      var scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      scrollLockState = {
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight
      };

      body.classList.add('ta-modal-scroll-locked');
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        body.style.paddingRight = scrollbarWidth + 'px';
      }
    }

    function releaseScrollLock() {
      if (!scrollLockState) return;

      var body = document.body;
      body.classList.remove('ta-modal-scroll-locked');
      body.style.overflow = scrollLockState.overflow || '';
      body.style.paddingRight = scrollLockState.paddingRight || '';
      scrollLockState = null;
    }

    function refreshScrollLock() {
      if (getScrollLockControllers().length > 0) {
        applyScrollLock();
      } else {
        releaseScrollLock();
      }
    }

    function supportsInert() {
      return 'inert' in HTMLElement.prototype;
    }

    function clearInertState() {
      inertedElements.forEach(function (element) {
        if (!(element instanceof Element)) return;
        element.inert = false;
        if (element.getAttribute('data-ta-modal-inerted') === 'true') {
          element.removeAttribute('data-ta-modal-inerted');
        }
      });
      inertedElements = [];
    }

    function refreshInertState() {
      clearInertState();
      if (!supportsInert()) return;
      if (!openStack.length) return;

      var root = ensureRoot();
      Array.prototype.slice.call(document.body.children).forEach(function (child) {
        if (!(child instanceof HTMLElement)) return;
        if (child === root) return;
        child.inert = true;
        child.setAttribute('data-ta-modal-inerted', 'true');
        inertedElements.push(child);
      });
    }

    function renderSlot(name, html, className) {
      if (!html) return '';
      return '<div class="' + className + '">' + html + '</div>';
    }

    function renderStructuredBody(settings) {
      var sections = [];
      var hasHeader = !!(settings.title || settings.description || settings.headerMeta || settings.headerActions);

      if (hasHeader) {
        sections.push(
          '<div class="ta-modal__header modal-header' + (settings.headerMeta || settings.headerActions ? ' has-content' : '') + '">' +
            '<div class="ta-modal__header-main modal-header-main">' +
              (settings.title ? '<h2 class="ta-modal__title" id="' + settings.labelledBy + '" tabindex="-1">' + settings.title + '</h2>' : '') +
              (settings.description ? '<p class="ta-modal__description modal-descripcion" id="' + settings.describedBy + '">' + settings.description + '</p>' : '') +
              renderSlot('meta', settings.headerMeta, 'ta-modal__header-meta modal-header-meta') +
            '</div>' +
            renderSlot('actions', settings.headerActions, 'ta-modal__header-actions modal-header-actions') +
          '</div>'
        );
      }

      if (settings.body) {
        sections.push('<div class="ta-modal__body">' + settings.body + '</div>');
      }

      if (settings.footer) {
        sections.push('<div class="ta-modal__footer">' + settings.footer + '</div>');
      }

      return sections.join('');
    }

    function ensureModalStructure(modal) {
      if (!(modal instanceof Element)) return { overlay: null, dialog: null };

      addClassName(modal, 'ta-modal');
      modal.setAttribute('data-ta-modal', 'true');

      var overlay = modal.querySelector(':scope > .ta-modal__overlay, :scope > .modal-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'ta-modal__overlay modal-overlay';
        modal.insertBefore(overlay, modal.firstChild);
      } else {
        addClassName(overlay, 'ta-modal__overlay');
        addClassName(overlay, 'modal-overlay');
      }

      var dialog = modal.querySelector(':scope > .ta-modal__dialog, :scope > .modal-content');
      if (!dialog) {
        dialog = document.createElement('div');
        dialog.className = 'ta-modal__dialog modal-content';
        Array.prototype.slice.call(modal.childNodes).forEach(function (node) {
          if (node === overlay) return;
          dialog.appendChild(node);
        });
        modal.appendChild(dialog);
      } else {
        addClassName(dialog, 'ta-modal__dialog');
        addClassName(dialog, 'modal-content');
      }

      dialog.setAttribute('tabindex', dialog.getAttribute('tabindex') || '-1');
      return { overlay: overlay, dialog: dialog };
    }

    function getLegacyOptions(modal, options) {
      var settings = Object.assign({}, options || {});
      var dataset = modal && modal.dataset ? modal.dataset : {};

      if (dataset.taModalSize && !settings.size) settings.size = dataset.taModalSize;
      if (dataset.taModalCloseOnOverlay != null && settings.closeOnOverlay == null) {
        settings.closeOnOverlay = parseBoolean(dataset.taModalCloseOnOverlay, true);
      }
      if (dataset.taModalCloseOnEscape != null && settings.closeOnEscape == null) {
        settings.closeOnEscape = parseBoolean(dataset.taModalCloseOnEscape, true);
      }
      if (dataset.taModalLockScroll != null && settings.lockScroll == null) {
        settings.lockScroll = parseBoolean(dataset.taModalLockScroll, true);
      }

      if (settings.closeOnOverlay == null) settings.closeOnOverlay = true;
      if (settings.closeOnEscape == null) settings.closeOnEscape = true;
      if (settings.restoreFocus == null) settings.restoreFocus = true;
      if (settings.trapFocus == null) settings.trapFocus = true;
      if (settings.lockScroll == null) settings.lockScroll = true;

      return settings;
    }

    function attach(modal, options) {
      if (!(modal instanceof Element)) return null;
      if (controllerMap.has(modal)) return controllerMap.get(modal);

      var settings = getLegacyOptions(modal, options);
      var structure = ensureModalStructure(modal);
      var overlay = structure.overlay;
      var dialog = structure.dialog;
      var container = getContainer(settings.container);

      if (settings.id) modal.id = settings.id;
      if (!settings.preserveParent && modal.parentNode !== container) {
        container.appendChild(modal);
      }

      if (settings.className) addClassName(modal, settings.className);
      if (settings.modalClassName) addClassName(modal, settings.modalClassName);
      if (settings.dialogClassName) addClassName(dialog, settings.dialogClassName);
      if (settings.contentClassName) addClassName(dialog, settings.contentClassName);
      if (settings.size) modal.setAttribute('data-ta-modal-size', settings.size);

      if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-hidden', 'true');
      if (settings.labelledBy) modal.setAttribute('aria-labelledby', settings.labelledBy);
      if (settings.describedBy) modal.setAttribute('aria-describedby', settings.describedBy);

      var closeSelector = settings.closeSelector || '[data-ta-modal-close], [data-modal-close], .ta-modal__close, .modal-shell-close';
      var closeButtons = Array.prototype.slice.call(modal.querySelectorAll(closeSelector));

      var controller = {
        modal: modal,
        dialog: dialog,
        content: dialog,
        overlay: overlay,
        closeButtons: closeButtons,
        options: settings,
        previousFocus: null,
        isOpen: false,
        open: open,
        close: close,
        requestClose: requestClose,
        destroy: destroy,
        focus: focus
      };

      controllerMap.set(modal, controller);

      function focus(target) {
        var element = target;
        if (typeof target === 'string') {
          element = modal.querySelector(target);
        }

        if (!isVisible(element)) {
          var focusable = getFocusableElements(modal);
          element = focusable[0] || dialog || modal;
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
          focus(dialog || modal);
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

        if (event.key === 'Escape' && controller.options.closeOnEscape !== false) {
          event.preventDefault();
          requestClose(false, 'escape');
          return;
        }

        if (event.key === 'Tab' && controller.options.trapFocus !== false) {
          trapFocus(event);
        }
      }

      function handleDismissClick(event) {
        if (event.currentTarget === overlay && controller.options.closeOnOverlay === false) return;
        event.preventDefault();
        requestClose(false, event.currentTarget === overlay ? 'overlay' : 'button');
      }

      function open(openOptions) {
        var runtime = openOptions || {};
        if (controller.isOpen) {
          focusInitial();
          return controller;
        }

        controller.previousFocus = runtime.triggerElement || document.activeElement;
        controller.isOpen = true;
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        removeFromStack(controller);
        openStack.push(controller);
        document.addEventListener('keydown', handleKeydown);
        refreshScrollLock();
        refreshInertState();
        emitEvent(modal, 'ta:modal:open', {
          controller: controller,
          trigger: runtime.triggerElement || null
        });
        focusInitial();
        return controller;
      }

      function close(result, closeOptions) {
        var runtime = closeOptions || {};
        if (!controller.isOpen && !modal.classList.contains('show')) return controller;

        controller.isOpen = false;
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.removeEventListener('keydown', handleKeydown);
        removeFromStack(controller);
        refreshScrollLock();
        refreshInertState();
        emitEvent(modal, 'ta:modal:close', {
          controller: controller,
          result: result
        });

        if (runtime.restoreFocus !== false && controller.options.restoreFocus !== false && controller.previousFocus && typeof controller.previousFocus.focus === 'function') {
          focusElement(controller.previousFocus);
        }

        if (typeof controller.options.onAfterClose === 'function') {
          controller.options.onAfterClose(result, controller);
        }

        emitEvent(modal, 'ta:modal:after-close', {
          controller: controller,
          result: result
        });

        if (controller.options.destroyOnClose) {
          destroy();
        }
        return controller;
      }

      function requestClose(result, source) {
        var closeEvent = emitEvent(modal, 'ta:modal:request-close', {
          controller: controller,
          result: result,
          source: source
        }, true);
        if (closeEvent && closeEvent.defaultPrevented) return controller;

        if (typeof controller.options.onRequestClose === 'function') {
          controller.options.onRequestClose(result, source, controller);
          return controller;
        }

        return close(result);
      }

      function destroy() {
        controller.isOpen = false;
        document.removeEventListener('keydown', handleKeydown);
        removeFromStack(controller);
        refreshScrollLock();
        refreshInertState();

        if (overlay) overlay.removeEventListener('click', handleDismissClick);
        closeButtons.forEach(function (button) {
          button.removeEventListener('click', handleDismissClick);
        });

        controllerMap.delete(modal);
        if (modal.parentNode) modal.parentNode.removeChild(modal);
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

    function buildCloseButton(settings) {
      if (settings.closeButton === false) return '';

      var label = settings.closeButtonLabel || 'Cerrar modal';
      var className = settings.closeButtonClassName || 'btn-circular ta-modal__close modal-shell-close';
      var content = settings.closeButtonHtml || '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      return '<button type="button" class="' + className + '" aria-label="' + label + '" data-ta-modal-close="true">' + content + '</button>';
    }

    function create(options) {
      var settings = Object.assign({}, options || {});
      var modal = document.createElement('div');
      modal.className = 'ta-modal';
      modal.setAttribute('data-ta-modal', 'true');
      if (settings.id) modal.id = settings.id;
      if (settings.size) modal.setAttribute('data-ta-modal-size', settings.size);
      addClassName(modal, settings.className);
      addClassName(modal, settings.modalClassName);

      var overlay = document.createElement('div');
      overlay.className = 'ta-modal__overlay modal-overlay';

      var dialog = document.createElement('div');
      dialog.className = 'ta-modal__dialog modal-content';
      addClassName(dialog, settings.dialogClassName);
      addClassName(dialog, settings.contentClassName);

      var labelledBy = settings.labelledBy || (settings.title ? 'ta-modal-title-' + Date.now() : null);
      var describedBy = settings.describedBy || (settings.description ? 'ta-modal-description-' + Date.now() : null);
      if (labelledBy) settings.labelledBy = labelledBy;
      if (describedBy) settings.describedBy = describedBy;

      dialog.insertAdjacentHTML('beforeend', buildCloseButton(settings));

      if (settings.bodyHtml) {
        dialog.insertAdjacentHTML('beforeend', settings.bodyHtml);
      } else {
        dialog.insertAdjacentHTML('beforeend', renderStructuredBody(settings));
      }

      modal.appendChild(overlay);
      modal.appendChild(dialog);
      getContainer(settings.container).appendChild(modal);
      return attach(modal, settings);
    }

    function mountTemplate(options) {
      var settings = Object.assign({}, options || {});
      var template = settings.templateId ? document.getElementById(settings.templateId) : null;
      if (!template || !template.content) return null;

      var fragment = template.content.cloneNode(true);
      var modal = fragment.firstElementChild;
      if (!modal) return null;

      getContainer(settings.container).appendChild(fragment);
      return attach(modal, settings);
    }

    function getInstance(target) {
      var modal = resolveElement(target);
      if (!modal) return null;
      return controllerMap.get(modal) || null;
    }

    function getOrCreate(target, options) {
      var modal = resolveElement(target);
      if (!modal) return null;
      return controllerMap.get(modal) || attach(modal, options);
    }

    function openModal(target, options) {
      var controller = getOrCreate(target, options);
      if (!controller) return null;
      controller.open(options || {});
      return controller;
    }

    function closeModal(target, result, closeOptions) {
      var controller = getInstance(target);
      if (!controller) return null;
      controller.close(result, closeOptions);
      return controller;
    }

    function initDeclarative(root) {
      var scope = root instanceof Element ? root : document;
      scope.querySelectorAll('.ta-modal, [data-ta-modal="true"]').forEach(function (modal) {
        getOrCreate(modal);
      });
    }

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-ta-modal-target]');
      if (!trigger) return;

      var selector = trigger.getAttribute('data-ta-modal-target');
      if (!selector) return;

      var modal = resolveElement(selector);
      if (!(modal instanceof Element)) return;

      event.preventDefault();
      var controller = getOrCreate(modal);
      if (!controller) return;

      var currentModal = trigger.closest('.ta-modal.show');
      if (parseBoolean(trigger.getAttribute('data-ta-modal-replace'), false) && currentModal && currentModal !== modal) {
        controller.open({ triggerElement: trigger });
        var currentController = getOrCreate(currentModal);
        if (currentController) {
          currentController.close({ replacedBy: selector }, { restoreFocus: false });
        }
        return;
      }

      controller.open({ triggerElement: trigger });
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        initDeclarative(document);
      }, { once: true });
    } else {
      initDeclarative(document);
    }

    rootNs.modal = {
      attach: attach,
      create: create,
      mountTemplate: mountTemplate,
      open: openModal,
      close: closeModal,
      init: initDeclarative,
      getInstance: getInstance,
      getOrCreateInstance: getOrCreate
    };
  })();
}
