// ============================================
// PARTICIPACION: FEEDBACK UI (TOAST + ALERT + CONFIRM)
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.ui) return;

  var activeDialog = null;

  function notify(input) {
    var options = typeof input === 'string' ? { message: input } : (input || {});
    var message = String(options.message || '').trim();
    if (!message) return;

    var duration = Number(options.duration || 2500);
    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast(message, duration);
      return;
    }

    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('show');
    }, 10);

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, duration);
  }

  function normalizeDialogOptions(kind, input) {
    var options = typeof input === 'string' ? { message: input } : (input || {});
    return {
      kind: kind,
      title: String(options.title || (kind === 'confirm' ? 'Confirmar acción' : 'Información')).trim(),
      message: String(options.message || '').trim(),
      confirmText: String(options.confirmText || 'Aceptar').trim(),
      cancelText: String(options.cancelText || 'Cancelar').trim(),
      buttonText: String(options.buttonText || 'Aceptar').trim(),
      variant: String(options.variant || 'default').trim().toLowerCase()
    };
  }

  function closeActiveDialog(forceResult) {
    if (!activeDialog || typeof activeDialog.close !== 'function') return;
    activeDialog.close(forceResult);
  }

  function createDialog(options) {
    closeActiveDialog(false);

    var previousFocus = document.activeElement;
    var wrapper = document.createElement('div');
    wrapper.className = 'modal show participa-ui-dialog participa-ui-dialog-' + options.variant;
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');

    var titleId = 'participacion-ui-title-' + Date.now();
    wrapper.setAttribute('aria-labelledby', titleId);

    var messageHtml = options.message
      ? '<p class="modal-descripcion participa-ui-dialog-message"></p>'
      : '';

    var actionsHtml = options.kind === 'confirm'
      ? (
        '<div class="botones-modal participa-ui-dialog-actions">' +
        '  <button type="button" class="btn btn-outline-dark participa-ui-cancel"></button>' +
        '  <button type="button" class="btn btn-dark participa-ui-confirm"></button>' +
        '</div>'
      )
      : (
        '<div class="botones-modal participa-ui-dialog-actions">' +
        '  <button type="button" class="btn btn-dark participa-ui-confirm"></button>' +
        '</div>'
      );

    wrapper.innerHTML =
      '<div class="modal-overlay"></div>' +
      '<div class="modal-content participa-ui-dialog-content">' +
      '  <button class="modal-close participa-ui-close" type="button" aria-label="Cerrar">&times;</button>' +
      '  <h2 id="' + titleId + '"></h2>' +
      messageHtml +
      actionsHtml +
      '</div>';

    var overlay = wrapper.querySelector('.modal-overlay');
    var closeBtn = wrapper.querySelector('.participa-ui-close');
    var titleEl = wrapper.querySelector('h2');
    var messageEl = wrapper.querySelector('.participa-ui-dialog-message');
    var confirmBtn = wrapper.querySelector('.participa-ui-confirm');
    var cancelBtn = wrapper.querySelector('.participa-ui-cancel');

    if (titleEl) titleEl.textContent = options.title;
    if (messageEl) messageEl.textContent = options.message;
    if (confirmBtn) {
      confirmBtn.textContent = options.kind === 'confirm' ? options.confirmText : options.buttonText;
    }
    if (cancelBtn) cancelBtn.textContent = options.cancelText;

    document.body.appendChild(wrapper);

    return new Promise(function (resolve) {
      function close(result) {
        document.removeEventListener('keydown', onKeydown);
        wrapper.remove();
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }
        activeDialog = null;
        resolve(!!result);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') {
          close(false);
        }
      }

      document.addEventListener('keydown', onKeydown);

      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          close(false);
        });
      }

      if (overlay) {
        overlay.addEventListener('click', function () {
          close(false);
        });
      }

      if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
          close(true);
        });
      }

      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          close(false);
        });
      }

      activeDialog = { close: close };
      setTimeout(function () {
        if (confirmBtn) confirmBtn.focus();
      }, 0);
    });
  }

  function alertDialog(input) {
    var options = normalizeDialogOptions('alert', input);
    return createDialog(options).then(function () {
      return;
    });
  }

  function confirmDialog(input) {
    var options = normalizeDialogOptions('confirm', input);
    return createDialog(options);
  }

  ns.ui = {
    notify: notify,
    alert: alertDialog,
    confirm: confirmDialog
  };
})();
