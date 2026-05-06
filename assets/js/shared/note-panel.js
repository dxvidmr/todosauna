function toHtmlString(value) {
  return typeof value === 'string' ? value : '';
}

function buildDockAttributes(options) {
  const dockState = typeof options?.dockState === 'string' ? options.dockState.trim() : '';
  const dockAttrs = typeof options?.dockAttrs === 'string' ? options.dockAttrs.trim() : '';
  let attrs = '';

  if (dockState) {
    attrs += ` data-eval-state="${dockState}"`;
  }

  if (dockAttrs) {
    attrs += ` ${dockAttrs}`;
  }

  return attrs;
}

function buildNotePanelMarkup(options = {}) {
  const bodyHtml = toHtmlString(options.bodyHtml || options.bodyHTML);
  const dockHtml = toHtmlString(options.dockHtml || options.dockHTML);
  const dockAttributes = buildDockAttributes(options);

  return (
    '<div class="note-panel-layout">' +
      '<div class="note-panel-scroll">' +
        bodyHtml +
      '</div>' +
      `<div class="note-eval-dock"${dockAttributes}>` +
        dockHtml +
      '</div>' +
    '</div>'
  );
}

function renderNoteDisplay(params = {}) {
  const noteId = params.noteId || '';
  const noteChange = params.noteChange || '';
  const textHtml = toHtmlString(params.textHtml || params.text);
  const badgesHtml = toHtmlString(params.badgesHtml || params.badgesHTML);

  return (
    `<div class="note-display" data-note-id="${noteId}" data-note-change="${noteChange}">` +
      '<div class="note-header">' +
        (badgesHtml ? `<div class="note-badges">${badgesHtml}</div>` : '') +
      '</div>' +
      `<div class="fs-6 note-rich-text">${textHtml}</div>` +
      '<div class="note-footer"></div>' +
    '</div>'
  );
}

function renderNoteEvalLoading() {
  return (
    '<div class="lectura-note-eval-loading" data-eval-loading="true" aria-hidden="true">' +
      '<span class="lectura-skeleton-line is-title"></span>' +
      '<div class="lectura-skeleton-btnrow">' +
        '<span class="lectura-skeleton-btn"></span><span class="lectura-skeleton-btn"></span>' +
      '</div>' +
    '</div>'
  );
}

function renderNotePanel(host, options = {}) {
  if (!host) return null;

  const currentNoteId = typeof options.currentNoteId === 'string'
    ? options.currentNoteId
    : '';
  const currentNoteChange = typeof options.currentNoteChange === 'string'
    ? options.currentNoteChange
    : '';

  host.dataset.currentNoteId = currentNoteId;
  host.dataset.currentNoteChange = currentNoteChange;
  host.innerHTML = buildNotePanelMarkup(options);
  return host;
}

function renderNotePlaceholder(host, options = {}) {
  const bodyHtml = typeof options.bodyHtml === 'string'
    ? options.bodyHtml
    : (options.bodyMessage
      ? `<p class="placeholder-text">${options.bodyMessage}</p>`
      : '');

  const dockHtml = typeof options.dockHtml === 'string'
    ? options.dockHtml
    : (typeof options.dockMessage === 'string' && options.dockMessage.trim()
      ? `<p class="note-dock-placeholder">${options.dockMessage}</p>`
      : '<p class="note-dock-placeholder"></p>');

  return renderNotePanel(host, {
    bodyHtml,
    dockHtml,
    dockState: options.dockState || (options.dockMessage ? 'error' : 'idle'),
    dockAttrs: options.dockAttrs,
    currentNoteId: options.currentNoteId || '',
    currentNoteChange: options.currentNoteChange || ''
  });
}

export {
  buildNotePanelMarkup,
  renderNoteDisplay,
  renderNoteEvalLoading,
  renderNotePanel,
  renderNotePlaceholder
};
