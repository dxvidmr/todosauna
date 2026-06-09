// ============================================
// PARTICIPACION: TELEMETRIA TEMPORAL DE PILOTO
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.pilotTracking) return;

  var STORAGE_PREFIX = 'ta_pilot_tracked::';

  var EVENTS = Object.freeze({
    NOTE_UNRATED_VIEW: 'note_unrated_view',
    LAB_PASSAGE_SKIPPED: 'lab_passage_skipped',
    FORM_STARTED: 'form_started',
    FORM_SUBMITTED: 'form_submitted',
    FORM_ABANDONED: 'form_abandoned'
  });

  function isEnabled() {
    return !!(ns.config && ns.config.pilotTrackingEnabled === true);
  }

  function warn(message, extra) {
    if (typeof extra === 'undefined') {
      console.warn('[participacion.pilotTracking] ' + message);
      return;
    }
    console.warn('[participacion.pilotTracking] ' + message, extra);
  }

  function normalizeText(value, maxLength) {
    var text = String(value || '').trim();
    if (!text) return null;
    var limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 200;
    return text.length > limit ? text.slice(0, limit) : text;
  }

  function normalizeContext(value) {
    var context = String(value || '').trim().toLowerCase();
    if (context === 'lectura' || context === 'laboratorio' || context === 'formulario') {
      return context;
    }
    return 'formulario';
  }

  function normalizePasajeId(value) {
    if (Number.isInteger(value)) return value;
    var parsed = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function normalizeMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
  }

  function getSessionStorageKey(eventKey) {
    if (!eventKey) return null;
    var state = ns.session && typeof ns.session.getState === 'function'
      ? ns.session.getState()
      : null;
    var sessionKey = state && (state.browserSessionToken || state.sessionId);
    if (!sessionKey) return null;
    return STORAGE_PREFIX + sessionKey + '::' + eventKey;
  }

  function hasBeenTracked(eventKey) {
    var storageKey = getSessionStorageKey(eventKey);
    if (!storageKey) return false;
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch (_error) {
      return false;
    }
  }

  function markTracked(eventKey) {
    var storageKey = getSessionStorageKey(eventKey);
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch (_error) {
      // Ignore storage write errors to avoid breaking UX.
    }
  }

  async function ensurePilotSession() {
    if (!ns.session || typeof ns.session.ensureSessionForWrite !== 'function') {
      return { ok: false, error: { message: 'Sesion no disponible' } };
    }
    return ns.session.ensureSessionForWrite();
  }

  async function track(eventName, options) {
    if (!isEnabled()) return false;
    if (!ns.apiV2 || typeof ns.apiV2.trackPilotEvent !== 'function') return false;

    var input = options || {};
    var normalizedEventName = normalizeText(eventName, 80);
    var eventKey = normalizeText(input.eventKey || input.event_key, 500);
    if (!normalizedEventName || !eventKey) return false;
    if (hasBeenTracked(eventKey)) return true;

    var ensured = await ensurePilotSession();
    if (!ensured || !ensured.ok) {
      warn('No se pudo crear sesion para piloto', ensured && ensured.error);
      return false;
    }

    var sessionData = ns.session.getPublicSessionData();
    if (!sessionData || !sessionData.session_id) return false;

    try {
      var result = await ns.apiV2.trackPilotEvent({
        session_id: sessionData.session_id,
        event_name: normalizedEventName,
        context: normalizeContext(input.context),
        nota_id: normalizeText(input.notaId || input.nota_id, 200),
        nota_change: normalizeText(input.noteChange || input.nota_change, 200),
        pasaje_id: normalizePasajeId(input.pasajeId || input.pasaje_id),
        form_name: normalizeText(input.formName || input.form_name, 80),
        field_name: normalizeText(input.fieldName || input.field_name, 120),
        event_key: eventKey,
        metadata: normalizeMetadata(input.metadata)
      });

      if (result && result.error) {
        warn('No se pudo registrar evento piloto', result.error);
        return false;
      }

      if (result && result.data && result.data.ok === false) {
        return false;
      }

      markTracked(eventKey);
      return true;
    } catch (error) {
      warn('No se pudo registrar evento piloto', error);
      return false;
    }
  }

  function buildNoteEventKey(context, pasajeId, noteId, noteChange) {
    return [
      EVENTS.NOTE_UNRATED_VIEW,
      normalizeContext(context),
      normalizePasajeId(pasajeId) || '',
      normalizeText(noteId, 200) || '',
      normalizeText(noteChange, 200) || ''
    ].join(':');
  }

  function createNoteViewTracker(context) {
    var normalizedContext = normalizeContext(context);
    var current = null;
    var evaluatedKeys = {};

    function noteKey(noteId, noteChange) {
      return [
        normalizeText(noteId, 200) || '',
        normalizeText(noteChange, 200) || ''
      ].join('::');
    }

    function isCurrentSame(noteId, noteChange, pasajeId) {
      if (!current) return false;
      return current.noteId === normalizeText(noteId, 200)
        && current.noteChange === (normalizeText(noteChange, 200) || '')
        && current.pasajeId === normalizePasajeId(pasajeId);
    }

    function show(params) {
      var input = params || {};
      var noteId = normalizeText(input.noteId || input.notaId, 200);
      if (!noteId) return;

      if (!isCurrentSame(noteId, input.noteChange, input.pasajeId)) {
        flush(input.reason || 'note_changed');
      }

      current = {
        noteId: noteId,
        noteChange: normalizeText(input.noteChange, 200) || '',
        pasajeId: normalizePasajeId(input.pasajeId),
        shownAt: Date.now()
      };
    }

    function markEvaluated(noteId, noteChange) {
      var key = noteKey(noteId, noteChange);
      if (key !== '::') {
        evaluatedKeys[key] = true;
      }
      if (current && noteKey(current.noteId, current.noteChange) === key) {
        current.evaluated = true;
      }
    }

    function flush(reason) {
      if (!current) return false;

      var note = current;
      current = null;

      var key = noteKey(note.noteId, note.noteChange);
      if (note.evaluated || evaluatedKeys[key]) return false;

      var durationMs = Math.max(0, Date.now() - Number(note.shownAt || Date.now()));
      void track(EVENTS.NOTE_UNRATED_VIEW, {
        context: normalizedContext,
        notaId: note.noteId,
        noteChange: note.noteChange,
        pasajeId: note.pasajeId,
        eventKey: buildNoteEventKey(normalizedContext, note.pasajeId, note.noteId, note.noteChange),
        metadata: {
          reason: normalizeText(reason || 'unknown', 80),
          duration_ms: durationMs
        }
      });

      return true;
    }

    return {
      show: show,
      markEvaluated: markEvaluated,
      flush: flush
    };
  }

  function getFieldName(element) {
    if (!element) return null;
    return normalizeText(
      element.getAttribute('name') ||
      element.getAttribute('id') ||
      element.getAttribute('data-field-name'),
      120
    );
  }

  function isTrackableField(element) {
    if (!element || !element.matches) return false;
    if (!element.matches('input, textarea, select')) return false;
    var type = String(element.getAttribute('type') || '').toLowerCase();
    return ['button', 'submit', 'reset', 'hidden', 'file'].indexOf(type) === -1;
  }

  function getFilledFieldCount(form) {
    if (!form || !form.querySelectorAll) return 0;

    var fields = Array.prototype.slice.call(form.querySelectorAll('input, textarea, select'));
    var seenRadioGroups = {};
    var count = 0;

    fields.forEach(function (field) {
      if (!isTrackableField(field)) return;
      var type = String(field.getAttribute('type') || '').toLowerCase();

      if (type === 'checkbox') {
        if (field.checked) count += 1;
        return;
      }

      if (type === 'radio') {
        var groupName = field.getAttribute('name') || field.getAttribute('id') || '';
        if (!groupName || seenRadioGroups[groupName]) return;
        seenRadioGroups[groupName] = true;
        var checkedRadio = fields.some(function (candidate) {
          return String(candidate.getAttribute('type') || '').toLowerCase() === 'radio'
            && (candidate.getAttribute('name') || candidate.getAttribute('id') || '') === groupName
            && candidate.checked;
        });
        if (checkedRadio) {
          count += 1;
        }
        return;
      }

      if (String(field.value || '').trim()) {
        count += 1;
      }
    });

    return count;
  }

  function bindFormTracking(form, options) {
    var input = options || {};
    var formName = normalizeText(input.formName || input.form_name, 80);
    if (!form || !formName) {
      return {
        markSubmitted: function () {},
        markAbandoned: function () {}
      };
    }

    var started = false;
    var submitted = false;
    var abandoned = false;
    var dirty = false;
    var allowNavigation = false;
    var guardStatePushed = false;
    var exitModal = null;
    var exitModalPending = false;
    var startedAt = 0;
    var firstFieldName = null;
    var lastFieldName = null;

    function metadata(extra) {
      return Object.assign({
        first_field_name: firstFieldName,
        last_field_name: lastFieldName,
        duration_ms: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
        filled_field_count: getFilledFieldCount(form),
        path: window.location ? window.location.pathname : ''
      }, extra || {});
    }

    function updateFieldState(fieldName) {
      if (fieldName) lastFieldName = fieldName;
      if (!firstFieldName && fieldName) firstFieldName = fieldName;
    }

    function start(fieldName, reason) {
      if (submitted) return;
      updateFieldState(fieldName);
      if (started) return;

      started = true;
      startedAt = Date.now();
      void track(EVENTS.FORM_STARTED, {
        context: 'formulario',
        formName: formName,
        fieldName: lastFieldName,
        eventKey: EVENTS.FORM_STARTED + ':' + formName,
        metadata: metadata({ reason: normalizeText(reason || 'field_interaction', 80) })
      });
    }

    function hasMeaningfulValue(element) {
      if (!element) return false;
      var type = String(element.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return !!element.checked;
      return String(element.value || '').trim().length > 0;
    }

    function activateExitGuard() {
      if (dirty || submitted) return;
      dirty = true;

      if (!window.history || typeof window.history.pushState !== 'function') return;
      if (guardStatePushed) return;

      try {
        window.history.pushState(
          Object.assign({}, window.history.state || {}, {
            participacionFormGuard: true,
            formName: formName
          }),
          '',
          window.location.href
        );
        guardStatePushed = true;
      } catch (_error) {
        // Ignore history errors; beforeunload and link guard still protect the form.
      }
    }

    function handleFieldInteraction(event) {
      var target = event && event.target;
      if (!isTrackableField(target)) return;
      var fieldName = getFieldName(target);
      updateFieldState(fieldName);
      start(fieldName, event.type || 'field_interaction');

      if (event.type === 'input' || event.type === 'change' || hasMeaningfulValue(target)) {
        activateExitGuard();
      }
    }

    function markSubmitted(extra) {
      if (submitted) return;
      submitted = true;
      dirty = false;
      allowNavigation = true;
      return track(EVENTS.FORM_SUBMITTED, {
        context: 'formulario',
        formName: formName,
        fieldName: lastFieldName,
        eventKey: EVENTS.FORM_SUBMITTED + ':' + formName,
        metadata: metadata(extra || {})
      });
    }

    function abandon(reason) {
      if (!started || submitted || abandoned) return Promise.resolve(false);
      abandoned = true;
      dirty = false;
      allowNavigation = true;
      return track(EVENTS.FORM_ABANDONED, {
        context: 'formulario',
        formName: formName,
        fieldName: lastFieldName,
        eventKey: EVENTS.FORM_ABANDONED + ':' + formName,
        metadata: metadata({ reason: normalizeText(reason || 'page_exit', 80) })
      });
    }

    function getExitModalHtml() {
      return [
        '<div class="modal-header border-0 pb-0">',
        '  <h2 id="form-exit-guard-title" class="h4 mb-0">Salir del formulario</h2>',
        '</div>',
        '<div class="modal-body">',
        '  <p id="form-exit-guard-description" class="mb-0">Has empezado a rellenar este formulario. Si sales ahora, se perderán los datos no enviados.</p>',
        '</div>',
        '<div class="modal-footer border-0 pt-0">',
        '  <button type="button" class="btn btn-outline-dark" data-form-exit-action="continue">Seguir editando</button>',
        '  <button type="button" class="btn btn-dark" data-form-exit-action="exit">Salir sin enviar</button>',
        '</div>'
      ].join('');
    }

    function showExitConfirmation() {
      if (!dirty || submitted || allowNavigation) return Promise.resolve(true);

      if (!ns.modalShell || typeof ns.modalShell.create !== 'function') {
        return Promise.resolve(window.confirm('Has empezado a rellenar este formulario. Si sales ahora, se perderán los datos no enviados.'));
      }

      if (exitModalPending) return Promise.resolve(false);
      exitModalPending = true;

      if (exitModal && exitModal.modal && exitModal.modal.isConnected) {
        exitModal.close();
      }

      return new Promise(function (resolve) {
        var resolved = false;

        function finish(shouldExit) {
          if (resolved) return;
          resolved = true;
          exitModalPending = false;
          if (exitModal) exitModal.close();
          resolve(shouldExit);
        }

        exitModal = ns.modalShell.create({
          modalClassName: 'participacion-form-exit-guard',
          contentClassName: 'participacion-form-exit-guard-content',
          labelledBy: 'form-exit-guard-title',
          describedBy: 'form-exit-guard-description',
          closeButtonClassName: 'btn-circular modal-shell-close',
          closeButtonLabel: 'Cerrar aviso',
          closeButtonHtml: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>',
          destroyOnClose: true,
          bodyHtml: getExitModalHtml(),
          onRequestClose: function () {
            finish(false);
          }
        });

        exitModal.modal.querySelectorAll('[data-form-exit-action]').forEach(function (button) {
          button.addEventListener('click', function () {
            finish(button.getAttribute('data-form-exit-action') === 'exit');
          });
        });

        exitModal.open();
      });
    }

    async function confirmAndNavigate(destination, reason) {
      var shouldExit = await showExitConfirmation();
      if (!shouldExit) {
        return false;
      }

      await abandon(reason || 'confirmed_exit');
      allowNavigation = true;
      if (destination) {
        window.location.href = destination;
      }
      return true;
    }

    function handleDocumentClick(event) {
      if (!dirty || submitted || allowNavigation) return;

      var target = event.target instanceof Element ? event.target : null;
      var link = target && target.closest ? target.closest('a[href]') : null;
      if (!link || link.target || link.hasAttribute('download')) return;

      var href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      var destination = new URL(href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      void confirmAndNavigate(destination.toString(), 'confirmed_link_exit');
    }

    function handlePopState() {
      if (!dirty || submitted || allowNavigation) return;
      void (async function () {
        var shouldExit = await showExitConfirmation();
        if (shouldExit) {
          await abandon('confirmed_back_exit');
          allowNavigation = true;
          window.history.back();
          return;
        }

        try {
          window.history.pushState(
            Object.assign({}, window.history.state || {}, {
              participacionFormGuard: true,
              formName: formName
            }),
            '',
            window.location.href
          );
          guardStatePushed = true;
        } catch (_error) {
          // Ignore.
        }
      })();
    }

    function handleBeforeUnload(event) {
      if (!dirty || submitted || allowNavigation) return;
      event.preventDefault();
      event.returnValue = '';
    }

    form.addEventListener('focusin', handleFieldInteraction);
    form.addEventListener('input', handleFieldInteraction);
    form.addEventListener('change', handleFieldInteraction);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    window.addEventListener('pagehide', function () {
      void abandon('pagehide');
    });

    return {
      markSubmitted: markSubmitted,
      markAbandoned: abandon
    };
  }

  ns.pilotTracking = {
    EVENTS: EVENTS,
    isEnabled: isEnabled,
    track: track,
    createNoteViewTracker: createNoteViewTracker,
    bindFormTracking: bindFormTracking
  };
})();
