// ============================================
// PARTICIPACION: MODAL CENTRAL
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.modal) return;

  function toast(message, duration) {
    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast(message, duration || 2500);
      return;
    }
    console.log('[participacion] ' + message);
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
    this.modal = null;
    this.opciones = null;
    this.formAnonimo = null;
    this.colaboradorOpciones = null;
    this.formLogin = null;
    this.formRegistro = null;
    this._resolveOpen = null;
    this._buttonsBound = false;
    this.currentContext = '';
    this.contextCopy = {
      default: {
        title: 'Como quieres participar?',
        description: 'Tu participacion ayuda a mejorar las notas para futuros lectores.',
        anonimoTitle: 'Editor anonimo',
        anonimoDescription: 'Sin registro. Privacidad total.',
        colaboradorTitle: 'Colaborador',
        colaboradorDescription: 'Identificado por email. Contribuciones reconocidas.'
      },
      'lectura-second-contribution': {
        title: 'Estas participando anonimamente.',
        description: 'Para continuar, elige si quieres seguir asi o registrarte/identificarte.',
        anonimoTitle: 'Continuar anonimamente',
        anonimoDescription: 'Seguir sin registro.',
        colaboradorTitle: 'Registrarme/Identificarme',
        colaboradorDescription: 'Crear o recuperar perfil colaborador.'
      },
      'laboratorio-before-mode': {
        title: 'Antes de empezar el laboratorio',
        description: 'Define tu modo de participacion para iniciar el juego.',
        anonimoTitle: 'Participar anonimamente',
        anonimoDescription: 'Entrar sin registro.',
        colaboradorTitle: 'Registrarme/Identificarme',
        colaboradorDescription: 'Crear o recuperar perfil colaborador.'
      },
      'participa-form-access': {
        title: 'Antes de enviar tu aportación',
        description: 'Elige cómo quieres participar para continuar con el formulario.',
        anonimoTitle: 'Continuar anónimamente',
        anonimoDescription: 'Enviar sin registro.',
        colaboradorTitle: 'Registrarme/Identificarme',
        colaboradorDescription: 'Crear o recuperar perfil colaborador.'
      }
    };
    this._onKeydown = this._onKeydown.bind(this);
    this._ensureDOM();
  }

  ModalParticipacion.prototype._ensureDOM = function () {
    if (this.modal) return;

    var container = document.getElementById('modal-container') || document.body;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = this._renderMarkup().trim();
    this.modal = wrapper.firstElementChild;
    container.appendChild(this.modal);

    this.opciones = this.modal.querySelector('.modo-opciones');
    this.formAnonimo = this.modal.querySelector('#form-anonimo');
    this.colaboradorOpciones = this.modal.querySelector('#colaborador-opciones');
    this.formLogin = this.modal.querySelector('#form-colaborador-login');
    this.formRegistro = this.modal.querySelector('#form-colaborador-registro');

    this._attachModalEvents();
  };

  ModalParticipacion.prototype._renderMarkup = function () {
    return (
      '<div id="modal-modo" class="modal">' +
      '  <div class="modal-overlay"></div>' +
      '  <div class="modal-content">' +
      '    <button id="modal-modo-close" class="modal-close" aria-label="Cerrar modal">&times;</button>' +
      '    <h2 id="modal-titulo">Como quieres participar?</h2>' +
      '    <p class="modal-descripcion" id="modal-descripcion">Tu participacion ayuda a mejorar las notas para futuros lectores.</p>' +
      '    <div class="modo-opciones">' +
      '      <div class="modo-opcion" data-modo="anonimo" role="button" tabindex="0">' +
      '        <div class="modo-header"><span class="modo-icono"><i class="fa-solid fa-user-secret" aria-hidden="true"></i></span><h3>Editor anonimo</h3></div>' +
      '        <p>Sin registro. Privacidad total.</p>' +
      '      </div>' +
      '      <div class="modo-opcion" data-modo="colaborador" role="button" tabindex="0">' +
      '        <div class="modo-header"><span class="modo-icono"><i class="fa-solid fa-pen" aria-hidden="true"></i></span><h3>Colaborador</h3></div>' +
      '        <p>Identificado por email. Contribuciones reconocidas.</p>' +
      '      </div>' +
      '    </div>' +
      '    <div id="form-anonimo" class="modo-form" style="display:none;">' +
      '      <h3>Participacion anonima</h3>' +
      '      <p class="help-modal bg-gray-100 text-gray-500">Participaras sin registro y de forma completamente anonima.</p>' +
      '      <form id="form-anonimo-datos">' +
      '        <div class="botones-modal">' +
      '          <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>' +
      '          <button type="submit" class="btn btn-dark">Comenzar</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '    <div id="colaborador-opciones" class="modo-form" style="display:none;">' +
      '      <h3>Identificarse como colaborador/a</h3>' +
      '      <p class="help-modal bg-gray-100 text-gray-500">No necesitas contrasena. Solo tu email para reconocerte.</p>' +
      '      <div class="colaborador-opciones-grid">' +
      '        <div class="modo-opcion" data-tipo="login" role="button" tabindex="0">' +
      '          <div class="modo-header"><span class="modo-icono"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i></span><h3>Ya participe antes</h3></div>' +
      '          <p>Identificarme con mi email.</p>' +
      '        </div>' +
      '        <div class="modo-opcion" data-tipo="registro" role="button" tabindex="0">' +
      '          <div class="modo-header"><span class="modo-icono"><i class="fa-solid fa-user-plus" aria-hidden="true"></i></span><h3>Primera vez</h3></div>' +
      '          <p>Registrar mi email y datos.</p>' +
      '        </div>' +
      '      </div>' +
      '      <div class="botones-modal"><button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button></div>' +
      '    </div>' +
      '    <div id="form-colaborador-login" class="modo-form" style="display:none;">' +
      '      <h3>Identificarse</h3>' +
      '      <p class="help-modal bg-gray-100 text-gray-500">Introduce el mismo email que usaste anteriormente. No guardamos tu email real, solo un hash.</p>' +
      '      <form id="form-colaborador-login-datos">' +
      '        <label>Email:<input type="email" name="email" required placeholder="tu@email.com"></label>' +
      '        <div class="botones-modal">' +
      '          <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>' +
      '          <button type="submit" class="btn btn-dark">Identificarme</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '    <div id="form-colaborador-registro" class="modo-form" style="display:none;">' +
      '      <h3>Registrarse</h3>' +
      '      <p class="help-modal bg-gray-100 text-gray-500">Rellena el formulario para registrarte como colaborador/a.</p>' +
      '      <form id="form-colaborador-registro-datos">' +
      '        <label>Email<input type="email" name="email" required placeholder="tu@email.com"></label>' +
      '        <label>Nombre (opcional)<input type="text" name="display_name" placeholder="Maria G." maxlength="50"></label>' +
      '        <label>Nivel de estudios (opcional)' +
      '          <select name="nivel_estudios">' +
      '            <option value="">Prefiero no decirlo</option>' +
      '            <option value="secundaria">Secundaria</option>' +
      '            <option value="grado">Grado universitario</option>' +
      '            <option value="posgrado">Master/Posgrado</option>' +
      '            <option value="doctorado">Doctorado</option>' +
      '            <option value="otro">Otro</option>' +
      '          </select>' +
      '        </label>' +
      '        <label>Disciplina (opcional)' +
      '          <select name="disciplina">' +
      '            <option value="">Prefiero no decirlo</option>' +
      '            <option value="filologia">Filologia/Lengua/Literatura</option>' +
      '            <option value="historia">Historia</option>' +
      '            <option value="educacion">Educacion</option>' +
      '            <option value="arte">Arte/Teatro</option>' +
      '            <option value="humanidades">Humanidades</option>' +
      '            <option value="ciencias_sociales">Ciencias Sociales</option>' +
      '            <option value="otro">Otra</option>' +
      '          </select>' +
      '        </label>' +
      '        <div class="botones-modal">' +
      '          <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>' +
      '          <button type="submit" class="btn btn-primary">Registrarme</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
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
        self._resetView();
      });
    });

    var closeButton = this.modal.querySelector('#modal-modo-close');
    var overlay = this.modal.querySelector('.modal-overlay');
    if (closeButton) closeButton.addEventListener('click', function () { self.close(); });
    if (overlay) overlay.addEventListener('click', function () { self.close(); });

    var formAnonimo = this.modal.querySelector('#form-anonimo-datos');
    if (formAnonimo) {
      formAnonimo.addEventListener('submit', async function (event) {
        event.preventDefault();
        await self._submitAnonimo();
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

  ModalParticipacion.prototype._resetView = function () {
    var title = this.modal.querySelector('#modal-titulo');
    var description = this.modal.querySelector('#modal-descripcion');
    if (title) title.style.display = 'block';
    if (description) description.style.display = 'block';

    this.opciones.style.display = 'grid';
    this.formAnonimo.style.display = 'none';
    this.colaboradorOpciones.style.display = 'none';
    this.formLogin.style.display = 'none';
    this.formRegistro.style.display = 'none';

    var forms = this.modal.querySelectorAll('form');
    forms.forEach(function (form) {
      form.reset();
    });

    this._applyContextContent(this.currentContext);
  };

  ModalParticipacion.prototype._applyContextContent = function (context) {
    var ctx = context || '';
    var content = this.contextCopy[ctx] || this.contextCopy.default;
    var title = this.modal.querySelector('#modal-titulo');
    var description = this.modal.querySelector('#modal-descripcion');

    if (title) title.textContent = content.title;
    if (description) description.textContent = content.description;

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
    this.modal.querySelector('#modal-titulo').style.display = 'none';
    this.modal.querySelector('#modal-descripcion').style.display = 'none';
    this.opciones.style.display = 'none';

    if (mode === 'anonimo') {
      this.formAnonimo.style.display = 'block';
      return;
    }

    if (mode === 'colaborador') {
      this.colaboradorOpciones.style.display = 'block';
    }
  };

  ModalParticipacion.prototype._showCollaboratorForm = function (type) {
    this.colaboradorOpciones.style.display = 'none';
    if (type === 'login') this.formLogin.style.display = 'block';
    if (type === 'registro') this.formRegistro.style.display = 'block';
  };

  ModalParticipacion.prototype._submitAnonimo = async function () {
    var session = ns.session;
    if (!session) {
      alert('No se pudo inicializar participacion');
      return;
    }

    var result = await session.setAnonimo();
    if (!result.ok) {
      alert('Error al activar modo anonimo. Intenta de nuevo.');
      return;
    }

    this.close();
    toast('Modo anonimo activado');
  };

  ModalParticipacion.prototype._submitLogin = async function (form) {
    var session = ns.session;
    if (!session) {
      alert('No se pudo inicializar participacion');
      return;
    }

    var formData = new FormData(form);
    var email = String(formData.get('email') || '').trim();
    if (!email) {
      alert('El email es obligatorio');
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    var oldText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Buscando...';
    }

    try {
      var result = await session.loginAndBind(email);
      if (!result.ok) {
        throw result.error || new Error(result.reason || 'No se pudo identificar');
      }

      if (!result.found) {
        if (button) {
          button.disabled = false;
          button.textContent = oldText;
        }

        if (window.confirm('No encontramos tu email en el sistema. Quieres registrarte ahora?')) {
          this._resetView();
          this._selectMode('colaborador');
          this._showCollaboratorForm('registro');
        }
        return;
      }

      this.close();
      toast('Sesion de colaborador iniciada');
    } catch (err) {
      console.error('[participacion] Error en login colaborador', err);
      alert('Error al identificarte. Intenta de nuevo.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  };

  ModalParticipacion.prototype._submitRegistro = async function (form) {
    var session = ns.session;
    if (!session) {
      alert('No se pudo inicializar participacion');
      return;
    }

    var formData = new FormData(form);
    var email = String(formData.get('email') || '').trim();
    var displayName = String(formData.get('display_name') || '').trim() || null;
    var nivel = formData.get('nivel_estudios') || null;
    var disciplina = formData.get('disciplina') || null;

    if (!email) {
      alert('El email es obligatorio');
      return;
    }

    var result = await session.registerAndBind(email, displayName, {
      nivel_estudios: nivel,
      disciplina: disciplina
    });

    if (!result.ok) {
      if (result.reason === 'already_exists') {
        alert('Este email ya esta registrado. Usa "Identificarme".');
      } else {
        alert('Error al registrar colaborador. Verifica tus datos.');
      }
      return;
    }

    this.close();
    toast('Registro completado');
  };

  ModalParticipacion.prototype.open = function (options) {
    var self = this;
    this._ensureDOM();
    this.currentContext = (options && options.context) || '';
    this._resetView();
    this.modal.dataset.context = this.currentContext;
    this.modal.dataset.reason = (options && options.reason) || '';
    this.modal.classList.add('show');
    document.addEventListener('keydown', this._onKeydown);

    return new Promise(function (resolve) {
      self._resolveOpen = resolve;
    });
  };

  ModalParticipacion.prototype.close = function () {
    if (!this.modal) return;
    this.modal.classList.remove('show');
    document.removeEventListener('keydown', this._onKeydown);

    if (this._resolveOpen) {
      this._resolveOpen();
      this._resolveOpen = null;
    }
  };

  ModalParticipacion.prototype._onKeydown = function (event) {
    if (event.key === 'Escape') this.close();
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
    var modoTexto = user.modo_participacion === 'colaborador'
      ? '<i class="fa-solid fa-pen" aria-hidden="true"></i> Colaborador/a'
      : '<i class="fa-solid fa-user-secret" aria-hidden="true"></i> Anonimo';

    var infoExtra = '';
    if (user.modo_participacion === 'colaborador') {
      infoExtra += '<p><strong>Nombre:</strong> ' + (user.display_name || 'No especificado') + '</p>';
      if (user.nivel_estudios) infoExtra += '<p><strong>Nivel:</strong> ' + user.nivel_estudios + '</p>';
      if (user.disciplina) infoExtra += '<p><strong>Disciplina:</strong> ' + user.disciplina + '</p>';
    } else {
      infoExtra += '<p>Participas de forma anonima sin registro.</p>';
    }

    var modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML =
      '<div class="modal-overlay"></div>' +
      '<div class="modal-content">' +
      '  <button class="modal-close" aria-label="Cerrar">&times;</button>' +
      '  <div class="info-usuario-panel">' +
      '    <h3>Tu participacion</h3>' +
      '    <div class="info-modo"><p><strong>Modo actual:</strong> ' + modoTexto + '</p>' + infoExtra + '</div>' +
      '    <div class="info-stats">' +
      '      <p><strong>Contribuciones totales:</strong> ' + (stats ? stats.total_evaluaciones : 0) + '</p>' +
      '      <p>Votos positivos: ' + (stats ? stats.votos_up : 0) + '</p>' +
      '      <p>Votos negativos: ' + (stats ? stats.votos_down : 0) + '</p>' +
      '      <p>Comentarios: ' + (stats ? stats.comentarios : 0) + '</p>' +
      '    </div>' +
      '    <div class="info-acciones">' +
      '      <button class="btn btn-dark btn-cerrar-sesion"><i class="fa-solid fa-right-from-bracket me-2" aria-hidden="true"></i>Cerrar sesion</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);

    var self = this;
    function closeInfoModal() {
      document.removeEventListener('keydown', onEscape);
      modal.remove();
    }
    function onEscape(event) {
      if (event.key === 'Escape') closeInfoModal();
    }
    document.addEventListener('keydown', onEscape);

    var closeBtn = modal.querySelector('.modal-close');
    var overlay = modal.querySelector('.modal-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeInfoModal);
    if (overlay) overlay.addEventListener('click', closeInfoModal);

    var closeSessionBtn = modal.querySelector('.btn-cerrar-sesion');
    if (closeSessionBtn) {
      closeSessionBtn.addEventListener('click', async function () {
        if (!window.confirm('Seguro que quieres cerrar sesion?')) return;
        await session.resetToUnasked();
        closeInfoModal();
        toast('Sesion cerrada');
        setTimeout(function () {
          void self.open({ context: 'profile', reason: 'after-reset' });
        }, 200);
      });
    }
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
