// ============================================
// PARTICIPACION: MODAL CENTRAL
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.modal) return;

  function notify(message, type, duration) {
    var text = String(message || '').trim();
    if (!text) return;

    if (ns.ui && typeof ns.ui.notify === 'function') {
      ns.ui.notify({
        message: text,
        type: type || 'info',
        duration: duration || 2500
      });
      return;
    }

    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast(text, duration || 2500);
      return;
    }

    console.log('[participacion] ' + text);
  }

  function getUserMessage(error, context, fallback) {
    if (ns.errors && typeof ns.errors.toUserMessage === 'function') {
      return ns.errors.toUserMessage(error, context, fallback);
    }
    return fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseDateValue(value) {
    if (!value) return null;
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isSameCalendarDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function formatDateShort(value) {
    var date = parseDateValue(value);
    if (!date) return null;

    try {
      return new Intl.DateTimeFormat('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch (err) {
      return date.toLocaleDateString();
    }
  }

  function formatLastActivity(value) {
    var date = parseDateValue(value);
    if (!date) return null;

    var now = new Date();
    if (isSameCalendarDay(date, now)) return 'hoy';
    return formatDateShort(date);
  }

  function pluralize(count, singular, plural) {
    return String(count) + ' ' + (count === 1 ? singular : plural);
  }

  function trackSecondContributionChoice(mode) {
    if (!ns.telemetry || typeof ns.telemetry.track !== 'function') return;
    if (!ns.telemetry.EVENTS) return;

    var normalizedMode = String(mode || '').trim().toLowerCase();
    var eventName = normalizedMode === 'anonimo'
      ? ns.telemetry.EVENTS.LECTURA_SECOND_PROMPT_CHOICE_ANONIMO
      : ns.telemetry.EVENTS.LECTURA_SECOND_PROMPT_CHOICE_COLABORADOR;

    if (!eventName) return;

    void ns.telemetry.track(eventName, {
      context: 'lectura',
      metadata: { mode: normalizedMode || 'colaborador' }
    });
  }

  function setButtonBusy(button, isBusy, busyText) {
    if (!button) return;

    if (isBusy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent || '';
      }
      button.disabled = true;
      button.textContent = busyText || 'Procesando...';
      return;
    }

    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      button.removeAttribute('data-original-text');
    }
  }

  function closeNavbarMenuIfOpen() {
    if (window.NavbarBehavior && typeof window.NavbarBehavior.closeMenu === 'function') {
      window.NavbarBehavior.closeMenu();
      return;
    }

    var mainNav = document.getElementById('mainNav');
    var navWrapper = document.querySelector('.nav-wrapper');
    var backdrop = document.getElementById('navBackdrop');
    if (mainNav) mainNav.classList.remove('expanded');
    if (navWrapper) navWrapper.classList.remove('menu-expanded');
    if (backdrop) backdrop.classList.remove('active');
  }

  function ModalParticipacion() {
    this.shell = null;
    this.modal = null;
    this.modalContent = null;
    this.modalHeader = null;
    this.modalTitle = null;
    this.modalDescription = null;
    this.modalHeaderMeta = null;
    this.modalHeaderActions = null;
    this.opciones = null;
    this.formAnonimo = null;
    this.colaboradorOpciones = null;
    this.formLogin = null;
    this.formRegistro = null;
    this.profileView = null;
    this._resolveOpen = null;
    this._buttonsBound = false;
    this.currentContext = '';
    this.currentView = 'selection';
    this.viewStack = [];
    this._lastProfileViewModel = null;
    this.isSubmittingAnonimo = false;
    this.isSubmittingLogin = false;
    this.isSubmittingRegistro = false;
    this.isResettingSession = false;
    this.contextCopy = {
      default: {
        title: '\u00bfC\u00f3mo quieres participar?',
        description: 'Tu participaci\u00f3n ayuda a mejorar las notas para futuros lectores.',
        anonimoTitle: 'Editor an\u00f3nimo',
        anonimoDescription: 'Sin registro. Privacidad total.',
        colaboradorTitle: 'Colaborador',
        colaboradorDescription: 'Identificado por email. Contribuciones reconocidas.'
      },
      'lectura-second-contribution': {
        title: 'Est\u00e1s participando an\u00f3nimamente.',
        description: 'Para continuar, elige si quieres seguir as\u00ed o registrarte/identificarte.',
        anonimoTitle: 'Continuar an\u00f3nimamente',
        anonimoDescription: 'Seguir sin registro.',
        colaboradorTitle: 'Registrarme/Identificarme',
        colaboradorDescription: 'Crear o recuperar perfil colaborador.'
      },
      'laboratorio-before-mode': {
        title: 'Antes de empezar el laboratorio',
        description: 'Define tu modo de participaci\u00f3n para iniciar el juego.',
        anonimoTitle: 'Participar an\u00f3nimamente',
        anonimoDescription: 'Entrar sin registro.',
        colaboradorTitle: 'Registrarme/Identificarme',
        colaboradorDescription: 'Crear o recuperar perfil colaborador.'
      },
      'participa-form-access': {
        title: 'Antes de enviar tu aportaci\u00f3n',
        description: 'Elige c\u00f3mo quieres participar para continuar con el formulario.',
        anonimoTitle: 'Continuar an\u00f3nimamente',
        anonimoDescription: 'Enviar sin registro.',
        colaboradorTitle: 'Registrarme/Identificarme',
        colaboradorDescription: 'Crear o recuperar perfil colaborador.'
      }
    };
  }

  ModalParticipacion.prototype._showAlert = function (title, message, variant) {
    var text = String(message || '').trim();
    if (!text) return Promise.resolve();

    if (ns.ui && typeof ns.ui['alert'] === 'function') {
      return ns.ui['alert']({
        title: title || 'Aviso',
        message: text,
        buttonText: 'Aceptar',
        variant: variant || 'default'
      });
    }

    notify(text, 'warning', 2800);
    return Promise.resolve();
  };

  ModalParticipacion.prototype._showConfirm = function (title, message, confirmText, cancelText, variant) {
    if (ns.ui && typeof ns.ui['confirm'] === 'function') {
      return ns.ui['confirm']({
        title: title || 'Confirmar',
        message: message || '',
        confirmText: confirmText || 'Aceptar',
        cancelText: cancelText || 'Cancelar',
        variant: variant || 'default'
      });
    }

    notify(message || title || 'Confirma la acci\u00f3n.', 'info', 2600);
    return Promise.resolve(false);
  };

  ModalParticipacion.prototype._ensureDOM = function () {
    if (this.modal) return;

    this.shell = ns.modalShell && typeof ns.modalShell.mountTemplate === 'function'
      ? ns.modalShell.mountTemplate({
          templateId: 'participacion-modal-template',
          labelledBy: 'modal-titulo',
          describedBy: 'modal-descripcion',
          initialFocusSelector: '#modal-titulo',
          onRequestClose: this.close.bind(this)
        })
      : null;

    if (!this.shell || !this.shell.modal) {
      console.error('[participacion] No se pudo montar la plantilla del modal de participacion.');
      return;
    }

    this.modal = this.shell.modal;
    this.modalContent = this.modal.querySelector('.modal-content');
    this.modalHeader = this.modal.querySelector('.modal-header');
    this.modalTitle = this.modal.querySelector('#modal-titulo');
    this.modalDescription = this.modal.querySelector('#modal-descripcion');
    this.modalHeaderMeta = this.modal.querySelector('#modal-header-meta');
    this.modalHeaderActions = this.modal.querySelector('#modal-header-actions');
    this.opciones = this.modal.querySelector('.modo-opciones');
    this.formAnonimo = this.modal.querySelector('#form-anonimo');
    this.colaboradorOpciones = this.modal.querySelector('#colaborador-opciones');
    this.formLogin = this.modal.querySelector('#form-colaborador-login');
    this.formRegistro = this.modal.querySelector('#form-colaborador-registro');
    this.profileView = this.modal.querySelector('#perfil-participacion');

    this._attachModalEvents();
  };

  ModalParticipacion.prototype._attachModalEvents = function () {
    var self = this;

    this.modal.querySelectorAll('.modo-opcion').forEach(function (option) {
      option.addEventListener('click', function () {
        var modo = option.getAttribute('data-modo');
        var tipo = option.getAttribute('data-tipo');
        if (modo) self._selectMode(modo);
        if (tipo) self._showCollaboratorForm(tipo);
      });

      option.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        var modo = option.getAttribute('data-modo');
        var tipo = option.getAttribute('data-tipo');
        if (modo) self._selectMode(modo);
        if (tipo) self._showCollaboratorForm(tipo);
      });
    });

    this.modal.querySelectorAll('.btn-volver').forEach(function (button) {
      button.addEventListener('click', function () {
        self._goBack();
      });
    });

    var formAnonimo = this.modal.querySelector('#form-anonimo-datos');
    if (formAnonimo) {
      formAnonimo.addEventListener('submit', async function (event) {
        event.preventDefault();
        await self._submitAnonimo(formAnonimo);
      });
    }

    var formLogin = this.modal.querySelector('#form-colaborador-login-datos');
    if (formLogin) {
      formLogin.addEventListener('submit', async function (event) {
        event.preventDefault();
        await self._submitLogin(formLogin);
      });
    }

    var formRegistro = this.modal.querySelector('#form-colaborador-registro-datos');
    if (formRegistro) {
      formRegistro.addEventListener('submit', async function (event) {
        event.preventDefault();
        await self._submitRegistro(formRegistro);
      });
    }
  };

  ModalParticipacion.prototype._resetForms = function () {
    var forms = this.modal.querySelectorAll('form');
    forms.forEach(function (form) {
      form.reset();
    });
  };

  ModalParticipacion.prototype._hideAllViews = function () {
    if (this.opciones) this.opciones.style.display = 'none';
    if (this.formAnonimo) this.formAnonimo.style.display = 'none';
    if (this.colaboradorOpciones) this.colaboradorOpciones.style.display = 'none';
    if (this.formLogin) this.formLogin.style.display = 'none';
    if (this.formRegistro) this.formRegistro.style.display = 'none';
    if (this.profileView) this.profileView.style.display = 'none';
  };

  ModalParticipacion.prototype._showHeader = function (titleText, descriptionText) {
    if (this.modalHeader) this.modalHeader.style.display = 'grid';
    if (this.modalHeader) this.modalHeader.classList.add('has-content');
    if (this.modalTitle) {
      this.modalTitle.style.display = 'block';
      if (typeof titleText === 'string') this.modalTitle.textContent = titleText;
    }

    if (this.modalDescription) {
      this.modalDescription.style.display = descriptionText ? 'block' : 'none';
      if (typeof descriptionText === 'string') this.modalDescription.textContent = descriptionText;
    }
  };

  ModalParticipacion.prototype._hideHeader = function () {
    if (this.modalHeader) this.modalHeader.style.display = 'grid';
    if (this.modalHeader) this.modalHeader.classList.remove('has-content');
    if (this.modalTitle) this.modalTitle.style.display = 'none';
    if (this.modalDescription) this.modalDescription.style.display = 'none';
    this._setHeaderMeta('');
    this._setHeaderActions('');
  };

  ModalParticipacion.prototype._setHeaderMeta = function (html) {
    if (!this.modalHeaderMeta) return;
    this.modalHeaderMeta.innerHTML = html || '';
    this.modalHeaderMeta.style.display = html ? 'flex' : 'none';
  };

  ModalParticipacion.prototype._setHeaderActions = function (html) {
    if (!this.modalHeaderActions) return;
    this.modalHeaderActions.innerHTML = html || '';
    this.modalHeaderActions.style.display = html ? 'flex' : 'none';
  };

  ModalParticipacion.prototype._activateView = function (viewName, options) {
    var opts = options || {};

    if (opts.resetStack) {
      this.viewStack = [];
    } else if (!opts.replace && this.currentView && this.currentView !== viewName) {
      this.viewStack.push(this.currentView);
    }

    this.currentView = viewName;
    if (this.modal) this.modal.dataset.view = viewName;
    this._hideAllViews();
  };

  ModalParticipacion.prototype._showModeSelection = function (options) {
    this._activateView('selection', options);
    this._resetForms();
    this._applyContextContent(this.currentContext);
    this._setHeaderMeta('');
    this._setHeaderActions('');
    this._showHeader(
      this.modalTitle ? this.modalTitle.textContent : '',
      this.modalDescription ? this.modalDescription.textContent : ''
    );
    if (this.opciones) this.opciones.style.display = 'grid';
  };

  ModalParticipacion.prototype._showAnonimoForm = function (options) {
    this._activateView('anonimo', options);
    this._setHeaderMeta('');
    this._setHeaderActions('');
    this._showHeader(
      'Participaci\u00f3n an\u00f3nima',
      'Participar\u00e1s sin registro y de forma completamente an\u00f3nima.'
    );
    if (this.formAnonimo) this.formAnonimo.style.display = 'block';
  };

  ModalParticipacion.prototype._showColaboradorOptions = function (options) {
    this._activateView('colaborador-opciones', options);
    this._setHeaderMeta('');
    this._setHeaderActions('');
    this._showHeader(
      'Identificarse como colaborador/a',
      'No necesitas contrase\u00f1a. Solo tu email para reconocerte.'
    );
    if (this.colaboradorOpciones) this.colaboradorOpciones.style.display = 'block';
  };

  ModalParticipacion.prototype._showLoginForm = function (options) {
    this._activateView('login', options);
    this._setHeaderMeta('');
    this._setHeaderActions('');
    this._showHeader(
      'Identificarse',
      'Introduce el mismo email que usaste anteriormente. No guardamos tu email real, solo un hash.'
    );
    if (this.formLogin) this.formLogin.style.display = 'block';
  };

  ModalParticipacion.prototype._showRegistroForm = function (options) {
    this._activateView('registro', options);
    this._setHeaderMeta('');
    this._setHeaderActions('');
    this._showHeader(
      'Registrarse',
      'Rellena el formulario para registrarte como colaborador/a.'
    );
    if (this.formRegistro) this.formRegistro.style.display = 'block';
  };

  ModalParticipacion.prototype._goBack = function () {
    var previousView = this.viewStack.pop();
    if (!previousView) {
      this._showModeSelection({ resetStack: true });
      return;
    }

    if (previousView === 'profile') {
      this._showProfileView(this._lastProfileViewModel || null, { replace: true });
      return;
    }

    if (previousView === 'colaborador-opciones') {
      this._showColaboradorOptions({ replace: true });
      return;
    }

    if (previousView === 'anonimo') {
      this._showAnonimoForm({ replace: true });
      return;
    }

    if (previousView === 'login') {
      this._showLoginForm({ replace: true });
      return;
    }

    if (previousView === 'registro') {
      this._showRegistroForm({ replace: true });
      return;
    }

    this._showModeSelection({ resetStack: true });
  };

  ModalParticipacion.prototype._applyContextContent = function (context) {
    var ctx = context || '';
    var content = this.contextCopy[ctx] || this.contextCopy.default;
    if (this.modalTitle) this.modalTitle.textContent = content.title;
    if (this.modalDescription) this.modalDescription.textContent = content.description;

    this._setModeOptionContent('anonimo', content.anonimoTitle, content.anonimoDescription);
    this._setModeOptionContent('colaborador', content.colaboradorTitle, content.colaboradorDescription);
  };

  ModalParticipacion.prototype._setModeOptionContent = function (mode, title, description) {
    var option = this.modal.querySelector('.modo-opcion[data-modo="' + mode + '"]');
    if (!option) return;
    var optionTitle = option.querySelector('h3');
    var optionDescription = option.querySelector('p');
    if (optionTitle) optionTitle.textContent = title;
    if (optionDescription) optionDescription.textContent = description;
  };

  ModalParticipacion.prototype._selectMode = function (mode) {
    if (mode === 'anonimo') {
      this._showAnonimoForm();
      return;
    }

    if (mode === 'colaborador') {
      this._showColaboradorOptions();
    }
  };

  ModalParticipacion.prototype._showCollaboratorForm = function (type) {
    if (type === 'login') this._showLoginForm();
    if (type === 'registro') this._showRegistroForm();
  };

  ModalParticipacion.prototype._submitAnonimo = async function (form) {
    if (this.isSubmittingAnonimo) return;

    var session = ns.session;
    if (!session) {
      await this._showAlert('Participaci\u00f3n no disponible', 'No se pudo inicializar la participaci\u00f3n.', 'warning');
      return;
    }

    this.isSubmittingAnonimo = true;
    var button = form ? form.querySelector('button[type="submit"]') : null;
    setButtonBusy(button, true, 'Activando...');

    try {
      var result = await session.setAnonimo();
      if (!result.ok) {
        var errorMessage = getUserMessage(result.error, 'session_set_anonimo', 'Error al activar modo an\u00f3nimo. Intenta de nuevo.');
        await this._showAlert('No se pudo activar el modo an\u00f3nimo', errorMessage, 'warning');
        return;
      }

      if (this.currentContext === 'lectura-second-contribution') {
        trackSecondContributionChoice('anonimo');
      }

      this.close();
      notify('Modo an\u00f3nimo activado', 'success');
    } finally {
      setButtonBusy(button, false);
      this.isSubmittingAnonimo = false;
    }
  };

  ModalParticipacion.prototype._submitLogin = async function (form) {
    if (this.isSubmittingLogin) return;

    var session = ns.session;
    if (!session) {
      await this._showAlert('Participaci\u00f3n no disponible', 'No se pudo inicializar la participaci\u00f3n.', 'warning');
      return;
    }

    var formData = new FormData(form);
    var email = String(formData.get('email') || '').trim();
    if (!email) {
      notify('El email es obligatorio.', 'warning', 2600);
      return;
    }

    this.isSubmittingLogin = true;
    var button = form ? form.querySelector('button[type="submit"]') : null;
    setButtonBusy(button, true, 'Buscando...');

    try {
      var result = await session.loginAndBind(email);
      if (!result.ok) {
        throw result.error || new Error(result.reason || 'No se pudo identificar');
      }

      if (!result.found) {
        var wantsRegister = await this._showConfirm(
          'Email no encontrado',
          'No encontramos ese email en el sistema. Si es tu primera vez, puedes registrarte ahora.',
          'Registrarme',
          'Cancelar',
          'warning'
        );
        if (wantsRegister) {
          this._showColaboradorOptions({ resetStack: true });
          this._showRegistroForm();
        }
        return;
      }

      if (this.currentContext === 'lectura-second-contribution') {
        trackSecondContributionChoice('colaborador');
      }

      this.close();
      notify('Sesi\u00f3n de colaborador iniciada', 'success');
    } catch (err) {
      console.error('[participacion] Error en login colaborador', err);
      var message = getUserMessage(err, 'login', 'Error al identificarte. Intenta de nuevo.');
      await this._showAlert('No se pudo identificar la cuenta', message, 'warning');
    } finally {
      setButtonBusy(button, false);
      this.isSubmittingLogin = false;
    }
  };

  ModalParticipacion.prototype._submitRegistro = async function (form) {
    if (this.isSubmittingRegistro) return;

    var session = ns.session;
    if (!session) {
      await this._showAlert('Participaci\u00f3n no disponible', 'No se pudo inicializar la participaci\u00f3n.', 'warning');
      return;
    }

    var formData = new FormData(form);
    var email = String(formData.get('email') || '').trim();
    var displayName = String(formData.get('display_name') || '').trim() || null;
    var nivel = formData.get('nivel_estudios') || null;
    var disciplina = formData.get('disciplina') || null;

    if (!email) {
      notify('El email es obligatorio.', 'warning', 2600);
      return;
    }

    this.isSubmittingRegistro = true;
    var button = form ? form.querySelector('button[type="submit"]') : null;
    setButtonBusy(button, true, 'Registrando...');

    try {
      var result = await session.registerAndBind(email, displayName, {
        nivel_estudios: nivel,
        disciplina: disciplina
      });

      if (!result.ok) {
        if (result.reason === 'already_exists') {
          await this._showAlert('Email ya registrado', 'Este email ya est\u00e1 registrado. Usa "Identificarme".', 'warning');
        } else {
          var errorText = getUserMessage(result.error || result, 'register', 'Error al registrar colaborador. Verifica tus datos.');
          await this._showAlert('No se pudo completar el registro', errorText, 'warning');
        }
        return;
      }

      if (this.currentContext === 'lectura-second-contribution') {
        trackSecondContributionChoice('colaborador');
      }

      this.close();
      notify('Registro completado', 'success');
    } finally {
      setButtonBusy(button, false);
      this.isSubmittingRegistro = false;
    }
  };

  ModalParticipacion.prototype._buildProfileViewModel = function (user, stats, sessionState) {
    var safeStats = stats || {};
    var state = sessionState || {};
    var mode = (user && user.modo_participacion) || state.modeChoice || 'anonimo';
    var isAnonymous = mode !== 'colaborador';
    var displayName = String((user && user.display_name) || state.displayName || '').trim();
    var normalizedStats = {
      total_contribuciones: Number(safeStats.total_contribuciones || 0),
      total_evaluaciones: Number(safeStats.total_evaluaciones || 0),
      votos_up: Number(safeStats.votos_up || 0),
      votos_down: Number(safeStats.votos_down || 0),
      comentarios: Number(safeStats.comentarios || 0),
      total_sugerencias: Number(safeStats.total_sugerencias || 0),
      total_testimonios: Number(safeStats.total_testimonios || 0),
      total_contribuciones_archivo: Number(safeStats.total_contribuciones_archivo || 0),
      total_envios: Number(safeStats.total_envios || 0)
    };
    var metaParts = ['<span class="modal-mode-badge">' + escapeHtml(isAnonymous ? 'An\u00f3nimo' : 'Colaborador/a') + '</span>'];
    var sinceText = state.createdAt ? 'Desde ' + formatDateShort(state.createdAt) : null;
    var lastActivityText = state.lastActivityAt ? '\u00daltima actividad ' + formatLastActivity(state.lastActivityAt) : null;
    if (sinceText) metaParts.push('<span class="modal-header-meta-item">' + escapeHtml(sinceText) + '</span>');
    if (lastActivityText) metaParts.push('<span class="modal-header-meta-item">' + escapeHtml(lastActivityText) + '</span>');

    return {
      greetingText: isAnonymous
        ? '\u00a1Hola, an\u00f3nimo!'
        : (displayName ? '\u00a1Hola, ' + displayName + '!' : '\u00a1Hola, colaborador/a!'),
      modeLabel: isAnonymous ? 'An\u00f3nimo' : 'Colaborador/a',
      sinceText: sinceText,
      lastActivityText: lastActivityText,
      isAnonymous: isAnonymous,
      hasUploads: normalizedStats.total_envios > 0,
      guideUrl: '/participa/guia/',
      headerMetaHTML: metaParts.join(''),
      headerActionsHTML: ''
        + '<a class="btn btn-outline-dark btn-sm" href="/participa/guia/">Gu\u00EDa de participaci\u00f3n</a>'
        + '<button type="button" class="btn btn-secondary btn-sm btn-cerrar-sesion"><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Cerrar sesi\u00f3n</span></button>',
      uploadPrimaryLabel: normalizedStats.total_testimonios > 0 ? 'Enviar otro testimonio' : 'Comparte tu historia',
      uploadPrimaryUrl: '/participa/testimonios/enviar/',
      uploadSecondaryLabel: normalizedStats.total_contribuciones_archivo > 0 ? 'Aportar otro documento' : 'Aporta un documento',
      uploadSecondaryUrl: '/participa/documentos/enviar/',
      showAnonymousUpgrade: isAnonymous,
      stats: normalizedStats
    };
  };
  ModalParticipacion.prototype._bindProfileActions = function () {
    var self = this;
    if (!this.profileView || !this.modal) return;

    var closeSessionBtn = this.modal.querySelector('.btn-cerrar-sesion');
    if (closeSessionBtn) {
      closeSessionBtn.addEventListener('click', async function () {
        if (self.isResettingSession) return;

        var session = ns.session;
        if (!session) return;

        var shouldReset = await self._showConfirm(
          'Cerrar sesi\u00f3n',
          '\u00bfSeguro que quieres cerrar la sesi\u00f3n?',
          'Cerrar sesi\u00f3n',
          'Cancelar',
          'warning'
        );
        if (!shouldReset) return;

        self.isResettingSession = true;
        setButtonBusy(closeSessionBtn, true, 'Cerrando...');
        try {
          var result = await session.resetToUnasked();
          if (!result || !result.ok) {
            var message = getUserMessage(
              result && result.error,
              'session_reset',
              'No se pudo cerrar la sesi\u00f3n. Intenta de nuevo.'
            );
            await self._showAlert('No se pudo cerrar la sesi\u00f3n', message, 'warning');
            return;
          }
          self.close();
          notify('Sesi\u00f3n cerrada', 'success');
          setTimeout(function () {
            void self.open({ context: 'profile', reason: 'after-reset' });
          }, 200);
        } finally {
          self.isResettingSession = false;
          setButtonBusy(closeSessionBtn, false);
        }
      });
    }

    var upgradeButton = this.profileView.querySelector('.btn-upgrade-colaborador');
    if (upgradeButton) {
      upgradeButton.addEventListener('click', function () {
        self.currentContext = 'profile-upgrade';
        if (self.modal) self.modal.dataset.context = self.currentContext;
        self._showColaboradorOptions();
      });
    }
  };

  ModalParticipacion.prototype._showProfileView = function (profileData, options) {
    if (!profileData) {
      this._showModeSelection({ resetStack: true });
      return;
    }

    this._activateView('profile', options);
    this._lastProfileViewModel = profileData;

    this._showHeader(profileData.greetingText, '');
    this._setHeaderMeta(profileData.headerMetaHTML || '');
    this._setHeaderActions(profileData.headerActionsHTML || '');

    if (this.profileView) {
      this.profileView.innerHTML = this._renderProfileHTML(profileData);
      this.profileView.style.display = 'block';
    }

    this._bindProfileActions();
  };

  ModalParticipacion.prototype._renderProfileHTML = function (viewModel) {
    var stats = viewModel && viewModel.stats ? viewModel.stats : {};
    var evaluationBalanceText = escapeHtml(pluralize(stats.votos_up, 'positiva', 'positivas'))
      + '<br>'
      + escapeHtml(pluralize(stats.votos_down, 'negativa', 'negativas'));

    var uploadsDetailHtml = viewModel.hasUploads
      ? ''
        + escapeHtml(pluralize(stats.total_testimonios, 'testimonio', 'testimonios'))
        + '<br>'
        + escapeHtml(pluralize(stats.total_contribuciones_archivo, 'documento', 'documentos'))
      : 'Todavía no has enviado testimonios ni documentos.';

    if (!viewModel.hasUploads) {
      uploadsDetailHtml = escapeHtml('Todavia no has enviado testimonios ni documentos.');
    }

    var uploadsActions = ''
      + '<div class="modal-actions perfil-card-actions">'
      + '  <a class="btn btn-secondary" href="' + escapeHtml(viewModel.uploadPrimaryUrl) + '">' + escapeHtml(viewModel.uploadPrimaryLabel) + '</a>'
      + '  <a class="btn btn-outline-dark" href="' + escapeHtml(viewModel.uploadSecondaryUrl) + '">' + escapeHtml(viewModel.uploadSecondaryLabel) + '</a>'
      + '</div>';

    var summaryActions = ''
      + '<div class="modal-actions perfil-summary-actions">'
      + '  <a class="btn btn-primary" href="/participa/">' + escapeHtml(stats.total_contribuciones > 0 ? 'Participa' : 'Empieza a participar') + '</a>'
      + '</div>';

    var evaluationDetails = stats.total_evaluaciones > 0
      ? ''
        + '<p class="perfil-card-text perfil-activity-detail">' + evaluationBalanceText + '</p>'
        + '<p class="perfil-card-text perfil-activity-detail">' + escapeHtml(pluralize(stats.comentarios, 'comentario', 'comentarios')) + '</p>'
      : '';

    var upgradeNote = '';
    if (viewModel.showAnonymousUpgrade) {
      upgradeNote = ''
        + '<aside class="modal-context-note" data-only-anonimo>'
        + '  <p><strong>Ahora participas en an\u00f3nimo.</strong> Reg\u00edstrate para conservar y recuperar tus contribuciones en futuras sesiones.</p>'
        + '  <div class="modal-actions modal-context-note-actions">'
        + '    <button type="button" class="btn btn-primary btn-upgrade-colaborador">Registrarme</button>'
        + '  </div>'
        + '</aside>';
    }

    return ''
      + '<div class="perfil-participacion-shell">'
      +    upgradeNote
      + '  <section class="perfil-summary-card">'
      + '    <div class="perfil-summary-head">'
      + '      <div class="perfil-summary-copy">'
      + '        <h3 class="perfil-card-title">Contribuciones totales</h3>'
      + '        <p class="perfil-card-metric perfil-card-metric--hero">' + escapeHtml(stats.total_contribuciones) + '</p>'
      + '      </div>'
      +        summaryActions
      + '    </div>'
      + '  </section>'
      + '  <section class="perfil-activity-grid">'
      + '    <article class="perfil-activity-card">'
      + '      <h3 class="perfil-card-title">Notas</h3>'
      + '      <div class="perfil-activity-split">'
      + '        <div class="perfil-activity-section">'
      + '          <p class="perfil-card-eyebrow">Evaluaci\u00f3n</p>'
      + '          <p class="perfil-card-metric">' + escapeHtml(stats.total_evaluaciones) + '</p>'
      +            evaluationDetails
      + '        </div>'
      + '        <div class="perfil-activity-section">'
      + '          <p class="perfil-card-eyebrow">Sugerencias</p>'
      + '          <p class="perfil-card-metric">' + escapeHtml(stats.total_sugerencias) + '</p>'
      + '        </div>'
      + '      </div>'
      + '    </article>'
      + '    <article class="perfil-activity-card">'
      + '      <h3 class="perfil-card-title">Env\u00edos</h3>'
      + '      <p class="perfil-card-metric">' + escapeHtml(stats.total_envios) + '</p>'
      + '      <p class="perfil-card-text perfil-activity-detail">' + uploadsDetailHtml + '</p>'
      +        uploadsActions
      + '    </article>'
      + '  </section>'
      + '</div>';
  };

  ModalParticipacion.prototype._openShell = function (options) {
    this._ensureDOM();
    if (!this.modal) return;

    this.currentContext = (options && options.context) || this.currentContext || '';

    this.modal.dataset.context = this.currentContext;
    this.modal.dataset.reason = (options && options.reason) || '';

    if (this.shell) {
      this.shell.open();
    } else {
      this.modal.classList.add('show');
    }
  };

  ModalParticipacion.prototype.close = function () {
    if (!this.modal) return;

    if (this.shell) {
      this.shell.close();
    } else {
      this.modal.classList.remove('show');
    }

    if (this._resolveOpen) {
      this._resolveOpen();
      this._resolveOpen = null;
    }
  };

  ModalParticipacion.prototype.open = function (options) {
    var self = this;
    this._openShell(options);
    this._showModeSelection({ resetStack: true });

    return new Promise(function (resolve) {
      self._resolveOpen = resolve;
    });
  };

  ModalParticipacion.prototype.showProfile = async function () {
    var session = ns.session;
    if (!session) {
      await this.open({ context: 'unknown', reason: 'missing-session-manager' });
      return;
    }

    await session.init();
    var user = session.getLegacyUserData();
    if (!user) {
      await this.open({ context: 'profile', reason: 'mode-unasked' });
      return;
    }

    var stats = await session.getStats();
    var state = typeof session.getState === 'function' ? session.getState() : {};
    var profileData = this._buildProfileViewModel(user, stats, state);

    this._openShell({ context: 'profile', reason: 'active-profile' });
    this._showProfileView(profileData, { resetStack: true });
  };

  ModalParticipacion.prototype.bindActionButtons = function () {
    if (this._buttonsBound) return;
    this._buttonsBound = true;

    var self = this;

    var desktopButton = document.getElementById('btn-modo-usuario');
    if (desktopButton) {
      desktopButton.addEventListener('click', function () {
        void self.showProfile();
      });
    }

    var menuButton = document.getElementById('btn-modo-usuario-menu');
    if (menuButton) {
      menuButton.addEventListener('click', function () {
        closeNavbarMenuIfOpen();
        void self.showProfile();
      });
    }
  };

  ns.modal = new ModalParticipacion();

  function bindWhenReady() {
    ns.modal.bindActionButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindWhenReady, { once: true });
  } else {
    bindWhenReady();
  }
})();
