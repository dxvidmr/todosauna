// ============================================
// MODAL DE SELECCIÓN DE MODO (Con Login/Registro)
// ============================================

class ModalModo {
  constructor() {
    this.modalHTML = `
      <div id="modal-modo" class="modal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <button id="modal-modo-close" class="modal-close" aria-label="Cerrar modal">&times;</button>
          <h2 id="modal-titulo">¿Cómo quieres participar?</h2>
          <p class="modal-descripcion" id="modal-descripcion">
            Tu participación ayuda a mejorar 
            las notas para futuros lectores.
          </p>
          
          <!-- Opciones de modo (2 opciones) -->
          <div class="modo-opciones">
            
            <!-- Opción 1: Anónimo -->
            <div class="modo-opcion" data-modo="anonimo" role="button" tabindex="0">
              <div class="modo-header">
                <span class="modo-icono"><i class="fa-solid fa-user-secret" aria-hidden="true"></i></span>
                <h3>Editor anónimo</h3>
              </div>
              <p>Sin registro. Privacidad total.</p>
            </div>
            
            <!-- Opción 2: Colaborador -->
            <div class="modo-opcion" data-modo="colaborador" role="button" tabindex="0">
              <div class="modo-header">
                <span class="modo-icono"><i class="fa-solid fa-pen" aria-hidden="true"></i></span>
                <h3>Colaborador</h3>
              </div>
              <p>Identificado por email. Contribuciones reconocidas.</p>
            </div>
            
          </div>
          
          <!-- Formulario anónimo con datos opcionales -->
          <div id="form-anonimo" class="modo-form" style="display:none;">
            <h3>Participación anónima</h3>
            <p class="help-modal bg-gray-100 text-gray-500">Opcionalmente, puedes compartir datos demográficos para análisis (100% anónimo).</p>
            <form id="form-anonimo-datos">
              <label>
                Nivel de estudios (opcional)
                <select name="nivel_estudios">
                  <option value="">Prefiero no decirlo</option>
                  <option value="secundaria">Secundaria</option>
                  <option value="grado">Grado universitario</option>
                  <option value="posgrado">Máster/Posgrado</option>
                  <option value="doctorado">Doctorado</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              
              <label>
                Disciplina (opcional)
                <select name="disciplina">
                  <option value="">Prefiero no decirlo</option>
                  <option value="filologia">Filología/Lengua/Literatura</option>
                  <option value="historia">Historia</option>
                  <option value="educacion">Educación</option>
                  <option value="arte">Arte/Teatro</option>
                  <option value="humanidades">Humanidades (general)</option>
                  <option value="ciencias_sociales">Ciencias Sociales</option>
                  <option value="otro">Otra</option>
                </select>
              </label>
              
              <div class="botones-modal">
                <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>
                <button type="submit" class="btn btn-dark">Comenzar</button>
              </div>
            </form>
          </div>
          
          <!-- Opciones colaborador: Iniciar sesión o Registrarse -->
          <div id="colaborador-opciones" class="modo-form" style="display:none;">
            <h3>Identificarse como colaborador/a</h3>
            <p class="help-modal bg-gray-100 text-gray-500">No necesitas contraseña. Solo tu email para reconocerte.</p>
            <div class="colaborador-opciones-grid">
              <div class="modo-opcion" data-tipo="login" role="button" tabindex="0">
                <div class="modo-header">
                  <span class="modo-icono"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i></span>
                  <h3>Ya participé antes</h3>
                </div>
                <p>Identificarme con mi email.</p>
              </div>
              <div class="modo-opcion" data-tipo="registro" role="button" tabindex="0">
                <div class="modo-header">
                  <span class="modo-icono"><i class="fa-solid fa-user-plus" aria-hidden="true"></i></span>
                  <h3>Primera vez</h3>
                </div>
                <p>Registrar mi email y datos.</p>
              </div>
            </div>
            <div class="botones-modal">
              <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>
            </div>
          </div>

          <!-- Formulario LOGIN colaborador -->
          <div id="form-colaborador-login" class="modo-form" style="display:none;">
            <h3>Identificarse</h3>
            <p class="help-modal bg-gray-100 text-gray-500">
              Introduce el mismo email que usaste anteriormente. 
              No guardamos tu email real, solo un código único generado a partir de él.
            </p>
            <form id="form-colaborador-login-datos">
              <label>
                Email:
                <input type="email" name="email" required placeholder="tu@email.com">
              </label>
              
              <div class="botones-modal">
                <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>
                <button type="submit" class="btn btn-dark">Identificarme</button>
              </div>
            </form>
          </div>

          <!-- Formulario REGISTRO colaborador -->
          <div id="form-colaborador-registro" class="modo-form" style="display:none;">
            <h3>Registrarse</h3>
            <p class="help-modal bg-gray-100 text-gray-500">
              Rellena el formulario para registrarte como colaborador/a. Solo pedimos tu email (cifrado) y algunos datos demográficos opcionales.
            </p>
            <form id="form-colaborador-registro-datos">
              <label>
                Email
                <input type="email" name="email" required placeholder="tu@email.com">
                <small>Tu email se cifra y se convierte en un código único para identificarte en próximas visitas. No guardamos tu email real.</small>
              </label>
              
              <label>
                Nombre (opcional)
                <input type="text" name="display_name" placeholder="María G." maxlength="50">
                <small>Para aparecer en lista de colaboradores.</small>
              </label>
              
              <label>
                Nivel de estudios (opcional)
                <select name="nivel_estudios">
                  <option value="">Prefiero no decirlo</option>
                  <option value="secundaria">Secundaria</option>
                  <option value="grado">Grado universitario</option>
                  <option value="posgrado">Máster/Posgrado</option>
                  <option value="doctorado">Doctorado</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              
              <label>
                Disciplina (opcional)
                <select name="disciplina">
                  <option value="">Prefiero no decirlo</option>
                  <option value="filologia">Filología/Lengua/Literatura</option>
                  <option value="historia">Historia</option>
                  <option value="educacion">Educación</option>
                  <option value="arte">Arte/Teatro</option>
                  <option value="humanidades">Humanidades (general)</option>
                  <option value="ciencias_sociales">Ciencias Sociales</option>
                  <option value="otro">Otra</option>
                </select>
              </label>
              
              <div class="botones-modal">
                <button type="button" class="btn btn-outline-dark btn-volver"><i class="fa-solid fa-arrow-left me-2" aria-hidden="true"></i>Volver</button>
                <button type="submit" class="btn btn-primary">Registrarme</button>
              </div>
            </form>
          </div>
          
        </div>
      </div>
    `;
    
    this._handleKeydown = this._handleKeydown.bind(this);
    this.init();
  }
  
  init() {
    // Inyectar HTML en el DOM
    const container = document.getElementById('modal-container') || document.body;
    container.insertAdjacentHTML('beforeend', this.modalHTML);
    
    this.modal = document.getElementById('modal-modo');
    this.opciones = document.querySelector('.modo-opciones');
    this.formAnonimo = document.getElementById('form-anonimo');
    this.colaboradorOpciones = document.getElementById('colaborador-opciones');
    this.formColaboradorLogin = document.getElementById('form-colaborador-login');
    this.formColaboradorRegistro = document.getElementById('form-colaborador-registro');
    
    this.attachEventListeners();
  }
  
  attachEventListeners() {
    // Divs de selección de modo y opciones colaborador
    document.querySelectorAll('.modo-opcion').forEach(opcion => {
      opcion.addEventListener('click', (e) => {
        const modo = opcion.dataset.modo;
        const tipo = opcion.dataset.tipo;
        
        if (modo) {
          this.seleccionarModo(modo);
        } else if (tipo) {
          this.mostrarFormColaborador(tipo);
        }
      });
      
      // Accesibilidad: permitir Enter y Space para activar
      opcion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const modo = opcion.dataset.modo;
          const tipo = opcion.dataset.tipo;
          
          if (modo) {
            this.seleccionarModo(modo);
          } else if (tipo) {
            this.mostrarFormColaborador(tipo);
          }
        }
      });
    });
    
    // Form anónimo
    document.getElementById('form-anonimo-datos').addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarFormAnonimo(e.target);
    });
    
    // Form colaborador LOGIN
    document.getElementById('form-colaborador-login-datos').addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarFormColaboradorLogin(e.target);
    });
    
    // Form colaborador REGISTRO
    document.getElementById('form-colaborador-registro-datos').addEventListener('submit', (e) => {
      e.preventDefault();
      this.procesarFormColaboradorRegistro(e.target);
    });
    
    // Botones volver (con clase específica btn-volver)
    document.querySelectorAll('.btn-volver').forEach(btn => {
      btn.addEventListener('click', () => this.volverOpciones());
    });

    // Botón de cierre (X) y cierre también al pulsar sobre la overlay
    const closeBtn = this.modal.querySelector('#modal-modo-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.cerrar());
    const overlay = this.modal.querySelector('.modal-overlay');
    if (overlay) overlay.addEventListener('click', () => this.cerrar());
  }
  
  seleccionarModo(modo) {
    if (modo === 'anonimo') {
      // Mostrar formulario con datos opcionales
      document.getElementById('modal-titulo').style.display = 'none';
      document.getElementById('modal-descripcion').style.display = 'none';
      this.opciones.style.display = 'none';
      this.formAnonimo.style.display = 'block';
      
    } else if (modo === 'colaborador') {
      // Mostrar opciones de login/registro
      document.getElementById('modal-titulo').style.display = 'none';
      document.getElementById('modal-descripcion').style.display = 'none';
      this.opciones.style.display = 'none';
      this.colaboradorOpciones.style.display = 'block';
    }
  }
  
  mostrarFormColaborador(tipo) {
    this.colaboradorOpciones.style.display = 'none';
    
    if (tipo === 'login') {
      this.formColaboradorLogin.style.display = 'block';
    } else if (tipo === 'registro') {
      this.formColaboradorRegistro.style.display = 'block';
    }
  }
  
  async procesarFormAnonimo(form) {
    const formData = new FormData(form);
    const nivel_estudios = formData.get('nivel_estudios') || null;
    const disciplina = formData.get('disciplina') || null;
    
    // Datos demográficos opcionales
    const datosDemograficos = {};
    if (nivel_estudios) datosDemograficos.nivel_estudios = nivel_estudios;
    if (disciplina) datosDemograficos.disciplina = disciplina;
    
    try {
      const exito = await window.userManager.establecerLectorAnonimo(
        Object.keys(datosDemograficos).length > 0 ? datosDemograficos : null
      );
      
      if (exito) {
        this.cerrar();
        mostrarToast('Modo anónimo activado');
      } else {
        alert('Error al establecer modo anónimo. Intenta de nuevo.');
      }
      
    } catch (error) {
      console.error('Error al procesar anónimo:', error);
      alert('Error al guardar. Por favor intenta de nuevo.');
    }
  }
  
  async procesarFormColaboradorLogin(form) {
    const formData = new FormData(form);
    let emailRaw = formData.get('email');
    let email;
    if (window.userManager?.debug) {
      // ═══════════════════════════════════════════════════════
      // DEBUG LOGIN - INICIO
      // ═══════════════════════════════════════════════════════
      console.group('LOGIN - DEBUG DETALLADO');
      console.log('Email RAW del FormData:', JSON.stringify(emailRaw));
      console.log('Longitud RAW:', emailRaw?.length);
      email = emailRaw.trim();
      console.log('Email después de trim():', JSON.stringify(email));
      console.log('Longitud después de trim:', email.length);
      console.log('Caracteres del email:');
      [...email].forEach((char, i) => {
        console.log(`  [${i}]: "${char}" -> charCode: ${char.charCodeAt(0)}`);
      });
      console.groupEnd();
      // ═══════════════════════════════════════════════════════
      // DEBUG LOGIN - FIN
      // ═══════════════════════════════════════════════════════
    } else {
      email = emailRaw.trim();
    }
    
    if (!email) {
      alert('El email es obligatorio');
      return;
    }
    
    // Mostrar loading
    const btnSubmit = form.querySelector('button[type="submit"]');
    const textoOriginal = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Buscando...';
    
    try {
      const resultado = await window.userManager.identificarColaborador(email);

      if (!resultado.ok) {
        throw resultado.error || new Error('No se pudo identificar el colaborador');
      }
      
      if (!resultado.found) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = textoOriginal;
        
        // Preguntar si quiere registrarse
        if (confirm('No encontramos tu email en el sistema. ¿Quieres registrarte ahora?')) {
          this.volverOpciones();
          setTimeout(() => {
            this.seleccionarModo('colaborador');
            setTimeout(() => {
              this.mostrarFormColaborador('registro');
            }, 100);
          }, 100);
        }
        return;
      }
      
      // userManager.identificarColaborador() already creates and stores session via RPC.
      this.cerrar();
      const displayName = resultado.collaborator?.display_name || 'colaborador/a';
      mostrarToast(`Hola de nuevo, ${displayName}!`, 3000);
      
    } catch (error) {
      console.error('Error al identificarse:', error);
      alert('Error al identificarte. Por favor intenta de nuevo.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = textoOriginal;
    }
  }

  
  async procesarFormColaboradorRegistro(form) {
    const formData = new FormData(form);
    let emailRaw = formData.get('email');
    let email;
    if (window.userManager?.debug) {
      // ═══════════════════════════════════════════════════════
      // DEBUG REGISTRO - INICIO
      // ═══════════════════════════════════════════════════════
      console.group('REGISTRO - DEBUG DETALLADO');
      console.log('Email RAW del FormData:', JSON.stringify(emailRaw));
      console.log('Longitud RAW:', emailRaw?.length);
      email = emailRaw.trim();
      console.log('Email después de trim():', JSON.stringify(email));
      console.log('Longitud después de trim:', email.length);
      console.log('Caracteres del email:');
      [...email].forEach((char, i) => {
        console.log(`  [${i}]: "${char}" -> charCode: ${char.charCodeAt(0)}`);
      });
      console.groupEnd();
      // ═══════════════════════════════════════════════════════
      // DEBUG REGISTRO - FIN
      // ═══════════════════════════════════════════════════════
    } else {
      email = emailRaw.trim();
    }
    
    const displayname = formData.get('display_name')?.trim() || null;
    const nivel_estudios = formData.get('nivel_estudios') || null;
    const disciplina = formData.get('disciplina') || null;
    
    if (!email) {
      alert('El email es obligatorio');
      return;
    }
    
    // Datos demográficos opcionales
    const datosDemograficos = {};
    if (nivel_estudios) datosDemograficos.nivel_estudios = nivel_estudios;
    if (disciplina) datosDemograficos.disciplina = disciplina;
    
    try {
      if (window.userManager?.debug) console.log('Llamando a hashEmail() desde REGISTRO...');
      const exito = await window.userManager.establecerColaborador(
        email,
        displayname,
        Object.keys(datosDemograficos).length > 0 ? datosDemograficos : null
      );
      
      if (exito) {
        this.cerrar();
        mostrarToast(`Bienvenido/a ${displayname || 'colaborador/a'}!`);
      } else {
        alert('Error al registrar colaborador. Verifica tus datos.');
      }
      
    } catch (error) {
      console.error('Error al procesar colaborador:', error);
      alert('Error al registrar. Por favor intenta de nuevo.');
    }
  }
  
  volverOpciones() {
    // Mostrar cabecera
    document.getElementById('modal-titulo').style.display = 'block';
    document.getElementById('modal-descripcion').style.display = 'block';
    
    // Ocultar todos los formularios
    this.formAnonimo.style.display = 'none';
    this.colaboradorOpciones.style.display = 'none';
    this.formColaboradorLogin.style.display = 'none';
    this.formColaboradorRegistro.style.display = 'none';
    
    // Mostrar opciones principales
    this.opciones.style.display = 'grid';
    
    // Limpiar formularios
    document.getElementById('form-anonimo-datos').reset();
    document.getElementById('form-colaborador-login-datos').reset();
    document.getElementById('form-colaborador-registro-datos').reset();
  }
  
  mostrar() {
    return new Promise((resolve) => {
      this.volverOpciones();
      this.modal.classList.add('show');
      this.onClose = resolve;
      // Activar cierre con tecla Escape
      document.addEventListener('keydown', this._handleKeydown);
    });
  }
  
  cerrar() {
    this.modal.classList.remove('show');
    // Desactivar listener de tecla Escape
    document.removeEventListener('keydown', this._handleKeydown);
    if (this.onClose) this.onClose();
  }

  // Manejar tecla Escape para cerrar modal
  _handleKeydown(e) {
    if (e.key === 'Escape') this.cerrar();
  }
  
  async mostrarInfoUsuario() {
    const datosUsuario = window.userManager.obtenerDatosUsuario();
    
    if (!datosUsuario) {
      // No hay sesión activa
      await this.mostrar();
      return;
    }
    
    // Obtener estadísticas
    const stats = await window.userManager.obtenerEstadisticas();
    
    let modoTexto = '';
    let infoExtra = '';
    
    if (datosUsuario.es_colaborador) {
      modoTexto = '<i class="fa-solid fa-pen" aria-hidden="true"></i> Colaborador/a';
      infoExtra = `
        <p><strong>Nombre:</strong> ${datosUsuario.display_name || 'No especificado'}</p>
      `;
      
      if (datosUsuario.nivel_estudios) {
        infoExtra += `<p><strong>Nivel:</strong> ${datosUsuario.nivel_estudios}</p>`;
      }
      if (datosUsuario.disciplina) {
        infoExtra += `<p><strong>Disciplina:</strong> ${datosUsuario.disciplina}</p>`;
      }
      
    } else {
      modoTexto = '<i class="fa-solid fa-user-secret" aria-hidden="true"></i> Anónimo';
      infoExtra = '<p>Participas de forma anónima sin registro.</p>';
      
      if (datosUsuario.nivel_estudios || datosUsuario.disciplina) {
        infoExtra += '<p><strong>Datos demográficos compartidos:</strong></p>';
        if (datosUsuario.nivel_estudios) {
          infoExtra += `<p>Nivel: ${datosUsuario.nivel_estudios}</p>`;
        }
        if (datosUsuario.disciplina) {
          infoExtra += `<p>Disciplina: ${datosUsuario.disciplina}</p>`;
        }
      }
    }
    
    const infoHTML = `
      <div class="info-usuario-panel">
        <h3>Tu participación</h3>
        <div class="info-modo">
          <p><strong>Modo actual:</strong> ${modoTexto}</p>
          ${infoExtra}
        </div>
        <div class="info-stats">
          <p><strong>Contribuciones totales:</strong> ${stats?.total_evaluaciones || 0}</p>
          ${stats ? `
            <p>Votos positivos: ${stats.votos_up}</p>
            <p>Votos negativos: ${stats.votos_down}</p>
            <p>Comentarios: ${stats.comentarios}</p>
          ` : ''}
        </div>
        <div class="info-acciones">
          <button class="btn btn-dark btn-cerrar-sesion">
            <i class="fa-solid fa-right-from-bracket me-2" aria-hidden="true"></i>Cerrar sesión
          </button>
        </div>
      </div>
    `;
    
    // Crear modal temporal
    const infoModal = document.createElement('div');
    infoModal.className = 'modal show';
    infoModal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close" aria-label="Cerrar">&times;</button>
        ${infoHTML}
      </div>
    `;
    
    document.body.appendChild(infoModal);
    
    // Event listeners
    const closeBtn = infoModal.querySelector('.modal-close');
    const overlay = infoModal.querySelector('.modal-overlay');
    
    const cerrarModal = () => infoModal.remove();
    
    if (closeBtn) closeBtn.addEventListener('click', cerrarModal);
    if (overlay) overlay.addEventListener('click', cerrarModal);
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        cerrarModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Botón cerrar sesión
    infoModal.querySelector('.btn-cerrar-sesion').addEventListener('click', () => {
      if (confirm('¿Seguro que quieres cerrar sesión? Podrás elegir otro modo después.')) {
        window.userManager.cerrarSesion();
        document.removeEventListener('keydown', handleEscape);
        infoModal.remove();
        mostrarToast('Sesión cerrada', 2000);
        
        // Mostrar modal de selección
        setTimeout(() => {
          this.mostrar();
        }, 500);
      }
    });
  }
}

// Instancia global
document.addEventListener('DOMContentLoaded', () => {
  window.modalModo = new ModalModo();
  console.log('ModalModo inicializado');
  
  // Vincular botón flotante (desktop)
  const btnModoUsuario = document.getElementById('btn-modo-usuario');
  if (btnModoUsuario) {
    btnModoUsuario.addEventListener('click', () => {
      window.modalModo.mostrarInfoUsuario();
    });
  }
  
  // Vincular botón en menú expandido (móvil)
  const btnModoUsuarioMenu = document.getElementById('btn-modo-usuario-menu');
  if (btnModoUsuarioMenu) {
    btnModoUsuarioMenu.addEventListener('click', () => {
      // Cerrar menú de navegación
      if (window.NavbarBehavior?.closeMenu) {
        window.NavbarBehavior.closeMenu();
      } else {
        const mainNav = document.getElementById('mainNav');
        const navWrapper = document.querySelector('.nav-wrapper');
        const backdrop = document.getElementById('navBackdrop');
        if (mainNav) mainNav.classList.remove('expanded');
        if (navWrapper) navWrapper.classList.remove('menu-expanded');
        if (backdrop) backdrop.classList.remove('active');
      }
      // Mostrar modal
      window.modalModo.mostrarInfoUsuario();
    });
  }
});
