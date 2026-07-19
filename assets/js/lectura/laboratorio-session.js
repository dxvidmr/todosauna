const VALID_LAB_MODES = new Set(['secuencial', 'aleatorio']);

export const LAB_SESSION_STORAGE_KEY = 'todosauna:laboratorio:sesion';
export const LAB_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isValidLaboratorioMode(mode) {
  return VALID_LAB_MODES.has(mode);
}

export function getLaboratorioLobbyUrl(locationHref) {
  const current = new URL(locationHref);
  current.search = '';
  current.hash = '';

  if (current.pathname.replace(/\/$/, '').endsWith('/laboratorio/sesion')) {
    return new URL('../', current).toString();
  }

  return current.toString();
}

export function getLaboratorioSessionUrl(locationHref, mode) {
  const url = new URL('sesion/', getLaboratorioLobbyUrl(locationHref));
  if (mode) {
    url.searchParams.set('modo', mode);
  }
  return url.toString();
}

export function getRequestedLaboratorioMode(locationSearch) {
  const mode = new URLSearchParams(locationSearch).get('modo');
  return isValidLaboratorioMode(mode) ? mode : null;
}

export function createLaboratorioSessionStorage(
  windowRef,
  { maxAgeMs = LAB_SESSION_MAX_AGE_MS } = {}
) {
  return {
    read() {
      try {
        const raw = windowRef.localStorage.getItem(LAB_SESSION_STORAGE_KEY);
        if (!raw) return null;

        const data = JSON.parse(raw);
        const updatedAt = Number(data?.updatedAt || 0);
        if (!updatedAt || Date.now() - updatedAt > maxAgeMs) {
          windowRef.localStorage.removeItem(LAB_SESSION_STORAGE_KEY);
          return null;
        }

        return isValidLaboratorioMode(data?.modo) ? data : null;
      } catch (_error) {
        return null;
      }
    },

    write(data) {
      try {
        windowRef.localStorage.setItem(LAB_SESSION_STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (_error) {
        return false;
      }
    },

    clear() {
      try {
        windowRef.localStorage.removeItem(LAB_SESSION_STORAGE_KEY);
        return true;
      } catch (_error) {
        return false;
      }
    }
  };
}
