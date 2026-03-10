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
    }
  }

  function normalizeDialogOptions(kind, input) {
    var options = typeof input === 'string' ? { message: input } : (input || {});
    return {
      kind: kind,
      title: String(options.title || (kind === 'confirm' ? 'Confirmar acci\u00f3n' : 'Informaci\u00f3n')).trim(),
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

    var titleId = 'participacion-ui-title-' + Date.now();
    var messageHtml = options.message
      ? '<p class="modal-descripcion participa-ui-dialog-message"></p>'
      : '';

    var actionsHtml = options.kind === 'confirm'
      ? (
        '<div class="modal-actions participa-ui-dialog-actions">' +
        '  <button type="button" class="btn btn-outline-dark participa-ui-cancel"></button>' +
        '  <button type="button" class="btn btn-secondary participa-ui-confirm"></button>' +
        '</div>'
      )
      : (
        '<div class="modal-actions participa-ui-dialog-actions">' +
        '  <button type="button" class="btn btn-primary participa-ui-confirm"></button>' +
        '</div>'
      );

    var shell = ns.modalShell.create({
      modalClassName: 'participa-ui-dialog participa-ui-dialog-' + options.variant,
      contentClassName: 'participa-ui-dialog-content',
      labelledBy: titleId,
      closeButtonClassName: 'btn-circular modal-shell-close participa-ui-close',
      closeButtonLabel: 'Cerrar',
      closeButtonHtml: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>',
      initialFocusSelector: '.participa-ui-dialog-title',
      destroyOnClose: true,
      bodyHtml:
        '<h2 id="' + titleId + '" class="participa-ui-dialog-title" tabindex="-1"></h2>' +
        messageHtml +
        actionsHtml
    });
    var wrapper = shell.modal;
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

    return new Promise(function (resolve) {
      var isClosed = false;

      function close(result) {
        if (isClosed) return;
        isClosed = true;
        shell.close(result);
        activeDialog = null;
        resolve(!!result);
      }

      shell.options.onRequestClose = function () {
        close(false);
      };

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
      shell.open();
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
