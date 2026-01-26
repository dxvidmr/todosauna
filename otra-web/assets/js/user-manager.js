// ============================================
// GESTIÓN DE MODOS DE PARTICIPACIÓN
// ============================================

class UserManager {
  constructor() {
    this.sessionKey = 'fuenteovejuna_session';
    this.debug = false; // <-- control de logs
    // Solo sessionStorage (efímero) - NO localStorage
  }
  
  setDebug(on) { this.debug = !!on; }
  
  /**
   * Verifica si el usuario ya tiene modo definido EN ESTA SESIÓN
   */
  tieneModoDefinido() {
    return sessionStorage.getItem(this.sessionKey) !== null;
  }
  
  /**
   * Obtiene datos del usuario actual
   * @returns {Object|null} { session_id, es_colaborador, collaborator_id?, nivel_estudios?, disciplina? }
   */
  obtenerDatosUsuario() {
    const datos = sessionStorage.getItem(this.sessionKey);
    return datos ? JSON.parse(datos) : null;
  }
  
  /**
 * Generar hash SHA-256 de un email (normalizado)
 */
  async hashEmail(email) {
    // Normalizar siempre (trim + lowercase)
    const trimmed = String(email).trim();
    const normalizado = trimmed.toLowerCase();

    // Calcular hash (siempre)
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizado);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Imprimir logs detallados sólo si debug está activo
    if (this.debug) {
      console.group('hashEmail() - DEBUG DETALLADO');
      console.log('Email ORIGINAL recibido:', JSON.stringify(email));
      console.log('Longitud original:', String(email).length);
      console.log('Caracteres originales:', [...String(email)].map((c, i) => `[${i}]: "${c}" (charCode: ${c.charCodeAt(0)})`).join('\n'));

      console.log('Después de trim():', JSON.stringify(trimmed));
      console.log('Longitud después de trim:', trimmed.length);

      console.log('Después de toLowerCase():', JSON.stringify(normalizado));
      console.log('Longitud final:', normalizado.length);
      console.log('Caracteres normalizados:', [...normalizado].map((c, i) => `[${i}]: "${c}" (charCode: ${c.charCodeAt(0)})`).join('\n'));

      console.log('Bytes a hashear:', Array.from(data).join(', '));
      console.log('Bytes en hex:', Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '));

      console.log('HASH GENERADO:', hashHex);
      console.log('Longitud del hash:', hashHex.length, '(debería ser 64)');
      console.groupEnd();
    }

    return hashHex;
  }
  
  /**
   * MODO ANÓNIMO (con datos demográficos opcionales)
   * @param {Object} datosDemograficos - { nivel_estudios?, disciplina? }
   */
  async establecerLectorAnonimo(datosDemograficos = null) {
    const sessionId = crypto.randomUUID();
    
    // Crear sesión en BD
    const { error } = await window.supabaseClient
      .from('sesiones')
      .insert({
        session_id: sessionId,
        es_colaborador: false,
        nivel_estudios: datosDemograficos?.nivel_estudios || null,
        disciplina: datosDemograficos?.disciplina || null
      });
    
    if (error) {
      console.error('Error creando sesión anónima:', error);
      return false;
    }
    
    // Guardar en sessionStorage
    const datos = {
      session_id: sessionId,
      es_colaborador: false,
      ...(datosDemograficos && datosDemograficos)
    };
    
    sessionStorage.setItem(this.sessionKey, JSON.stringify(datos));
    console.log('Sesión anónima creada:', sessionId);
    return true;
  }
  
  /**
   * MODO COLABORADOR (con registro)
   * @param {string} email - Email del colaborador
   * @param {string} display_name - Nombre público opcional
   * @param {Object} datosDemograficos - { nivel_estudios?, disciplina? }
   */
  async establecerColaborador(email, displayName = null, datosDemograficos = null) {
    const sessionId = crypto.randomUUID();
    
    if (this.debug) {
      // ═══════════════════════════════════════════════════════════════
      // DEBUG REGISTRO (en establecerColaborador)
      // ═══════════════════════════════════════════════════════════════
      console.group('establecerColaborador() - DEBUG');
      console.log('Email recibido:', JSON.stringify(email));
      console.log('Longitud:', email.length);
      console.log('Caracteres:');
      [...email].forEach((char, i) => {
        console.log(`  [${i}]: "${char}" → charCode: ${char.charCodeAt(0)}`);
      });
      console.groupEnd();
      // ═══════════════════════════════════════════════════════════════
    }
    
    if (this.debug) console.log('Llamando a hashEmail() desde REGISTRO...');
    
    // Hash del email (normalizado)
    const email_hash = await this.hashEmail(email);
    
    if (this.debug) console.log('Hash generado:', email_hash);
    
    // PASO 1: Buscar si ya existe este colaborador
    const { data: existente, error: errorBusqueda } = await window.supabaseClient
      .from('colaboradores')
      .select('collaborator_id, display_name, nivel_estudios, disciplina')
      .eq('email_hash', email_hash)
.maybeSingle(); // Cambiado de .single() a .maybeSingle()
    
    if (this.debug) console.log('Colaborador existente:', existente);
    
    let colaborador = null;
    
    // PASO 2: Si ya existe, informar al usuario
    if (existente) {
      alert(`Este email ya está registrado como "${existente.display_name || 'colaborador/a'}". Usa "Identificarme" en lugar de "Registrarme".`);
      return false;
    }
    
    // PASO 3: Si NO existe, crear nuevo colaborador
    if (this.debug) console.log('Creando nuevo colaborador...');
    
    const { data: nuevo, error: errorCrear } = await window.supabaseClient
      .from('colaboradores')
      .insert({
        email_hash: email_hash,
        display_name: displayName || null,
        nivel_estudios: datosDemograficos?.nivel_estudios || null,
        disciplina: datosDemograficos?.disciplina || null
      })
      .select('collaborator_id, display_name')
      .single();
    
    if (errorCrear) {
      console.error('Error creando colaborador:', errorCrear);
      
      // Mensaje específico si es constraint violation
      if (errorCrear.code === '23505') { // UNIQUE violation
        alert('Este email ya está registrado. Usa "Identificarme".');
      } else {
        alert('Error al registrar. Intenta de nuevo.');
      }
      return false;
    }
    
    colaborador = nuevo;
    if (this.debug) console.log('Colaborador creado:', colaborador);
    
    // PASO 4: Crear sesión
    const { error: errorSesion } = await window.supabaseClient
      .from('sesiones')
      .insert({
        session_id: sessionId,
        es_colaborador: true,
        collaborator_id: colaborador.collaborator_id,
        nivel_estudios: datosDemograficos?.nivel_estudios || null,
        disciplina: datosDemograficos?.disciplina || null
      });
    
    if (errorSesion) {
      console.error('Error creando sesión:', errorSesion);
      return false;
    }
    
    // PASO 5: Guardar en sessionStorage
    const datos = {
      session_id: sessionId,
      es_colaborador: true,
      collaborator_id: colaborador.collaborator_id,
      display_name: colaborador.display_name,
      ...(datosDemograficos && datosDemograficos)
    };
    
    sessionStorage.setItem(this.sessionKey, JSON.stringify(datos));
    
    if (this.debug) console.log('Colaborador establecido:', sessionId);
    return true;
  }
  
  /**
   * Cambia el modo actual (cierra sesión)
   */
  cambiarModo() {
    sessionStorage.removeItem(this.sessionKey);
    console.log('Sesión finalizada');
  }
  
  /**
   * Obtiene datos para incluir en evaluaciones
   */
  obtenerDatosParaEvaluacion() {
    const datos = this.obtenerDatosUsuario();
    return datos ? { session_id: datos.session_id } : null;
  }
  
  /**
   * Obtiene estadísticas del usuario
   */
  async obtenerEstadisticas() {
    const datos = this.obtenerDatosUsuario();
    if (!datos) return null;
    
    const { data, error } = await window.supabaseClient
      .from('evaluaciones')
      .select('*')
      .eq('session_id', datos.session_id);
    
    if (error) {
      console.error('Error al obtener estadísticas:', error);
      return null;
    }
    
    return {
      total_evaluaciones: data.length,
      votos_up: data.filter(e => e.vote === 'up').length,
      votos_down: data.filter(e => e.vote === 'down').length,
      comentarios: data.filter(e => e.comment).length
    };
  }

  /**
 * Cerrar sesión actual (limpiar sessionStorage)
 */
  cerrarSesion() {
    sessionStorage.removeItem(this.sessionKey);
    console.log('Sesión cerrada');
    
    // Opcional: Recargar página para limpiar estado
    // window.location.reload();
  }

  /**
   * Cambiar modo (alias de cerrarSesion por compatibilidad)
   */
  cambiarModo() {
    this.cerrarSesion();
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNCIONES DE DEBUG - VERIFICAR HASHES
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Verifica un email contra TODOS los hashes almacenados en la BD
   * @param {string} email - Email a verificar
   */
  async debugVerificarEmail(email) {
    console.group('DEBUG: Verificación completa de email');
    
    // Forzar logs mientras se obtiene el hash
    const prevDebug = this.debug;
    this.debug = true;
    const hashGenerado = await this.hashEmail(email);
    this.debug = prevDebug;

    console.log('Hash generado localmente:', hashGenerado);
    
    // 2. Obtener TODOS los colaboradores de la BD
    const { data: colaboradores, error } = await window.supabaseClient
      .from('colaboradores')
      .select('collaborator_id, email_hash, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Error consultando BD:', error);
      console.groupEnd();
      return;
    }
    
    console.log(`Colaboradores en BD: ${colaboradores.length}`);
    console.table(colaboradores.map(c => ({
      id: c.collaborator_id.slice(0, 8) + '...',
      hash: c.email_hash.slice(0, 16) + '...',
      nombre: c.display_name,
      created: c.created_at
    })));
    
    // 3. Buscar coincidencia
    const coincidencia = colaboradores.find(c => c.email_hash === hashGenerado);
    
    if (coincidencia) {
      console.log('COINCIDENCIA ENCONTRADA', coincidencia);
    } else {
      console.log('NO se encontró coincidencia');
      
      // Mostrar comparación carácter por carácter del primer hash
      if (colaboradores.length > 0) {
        const primerHash = colaboradores[0].email_hash;
        console.log('\nComparando con el primer hash en BD:');
        console.log('   BD:    ', primerHash);
        console.log('   Local: ', hashGenerado);
        console.log('   Iguales:', primerHash === hashGenerado);
        
        // Buscar diferencias
        for (let i = 0; i < Math.max(primerHash.length, hashGenerado.length); i++) {
          if (primerHash[i] !== hashGenerado[i]) {
            console.log(`   Primera diferencia en posición ${i}: BD="${primerHash[i]}" vs Local="${hashGenerado[i]}"`);
            break;
          }
        }
      }
    }
    
    console.groupEnd();
    return { hashGenerado, colaboradores, coincidencia };
  }
  
  /**
   * Muestra la consulta SQL para verificar en Supabase Dashboard
   * @param {string} email - Email a buscar
   */
  async debugMostrarSQL(email) {
    const prev = this.debug;
    this.debug = true;
    const hash = await this.hashEmail(email);
    this.debug = prev;
    
    console.group('SQL para Supabase Dashboard');
    console.log(`
-- Buscar colaborador por hash exacto:
SELECT * FROM colaboradores WHERE email_hash = '${hash}';

-- Ver todos los hashes recientes:
SELECT collaborator_id, email_hash, display_name, created_at 
FROM colaboradores 
ORDER BY created_at DESC 
LIMIT 10;

-- Buscar hashes similares (primeros 10 caracteres):
SELECT * FROM colaboradores 
WHERE email_hash LIKE '${hash.slice(0, 10)}%';
    `);
    console.groupEnd();
    
    return hash;
  }

  /**
   * Test rápido: hashear el mismo email varias veces
   */
  async debugTestConsistencia(email, veces = 5) {
    const prev = this.debug;
    this.debug = true;

    console.group(`Test de consistencia (${veces} intentos)`);

    const hashes = [];
    for (let i = 0; i < veces; i++) {
      const hash = await this.hashEmail(email);
      hashes.push(hash);
      console.log(`   Intento ${i + 1}: ${hash}`);
    }

    const todosIguales = hashes.every(h => h === hashes[0]);
    console.log(todosIguales ? 'Todos los hashes son idénticos' : 'Los hashes difieren');

    console.groupEnd();
    this.debug = prev;
    return todosIguales;
  }
}

// Instancia global
window.userManager = new UserManager();
console.log(`UserManager inicializado (debug=${window.userManager.debug})`);

// ═══════════════════════════════════════════════════════════════
// FUNCIONES DE DEBUG GLOBALES (accesibles desde consola)
// ═══════════════════════════════════════════════════════════════
window.debugEmail = async (email) => {
  console.log('\n' + '═'.repeat(60));
  console.log('DEBUG EMAIL:', email);
  console.log('═'.repeat(60) + '\n');
  
  await window.userManager.debugVerificarEmail(email);
  await window.userManager.debugMostrarSQL(email);
  await window.userManager.debugTestConsistencia(email);
};

console.log(`
╔════════════════════════════════════════════════════════════╗
║  DEBUG MODE ACTIVO                                         ║
║                                                            ║
║  Usa en consola:                                           ║
║    debugEmail('tu@email.com')                              ║
║                                                            ║
║  O individualmente:                                        ║
║    userManager.debugVerificarEmail('tu@email.com')         ║
║    userManager.debugMostrarSQL('tu@email.com')             ║
║    userManager.debugTestConsistencia('tu@email.com')       ║
╚════════════════════════════════════════════════════════════╝
`);
