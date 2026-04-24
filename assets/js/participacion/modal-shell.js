import '../shared/modal.js';

if (typeof window !== 'undefined') {
  const ta = window.TA || (window.TA = {});
  const ns = window.Participacion || (window.Participacion = {});

  if (!ta.modal) {
    console.error('[modal] TA.modal no esta disponible');
  }

  ns.modalShell = ta.modal || null;
}
