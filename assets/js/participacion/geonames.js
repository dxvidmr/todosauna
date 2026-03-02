// ============================================
// PARTICIPACION: GEONAMES AUTOCOMPLETE
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.geo && typeof ns.geo.attachCityAutocomplete === 'function') return;

  var GEO_API_BASE = 'https://secure.geonames.org/searchJSON';
  var MIN_QUERY_LENGTH = 2;

  function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  function debounce(fn, wait) {
    var timeout = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  function getConfigValue() {
    var config = ns.config || {};
    return (
      config.geonamesUsername ||
      config.geoNamesUsername ||
      ''
    );
  }

  function sanitizeText(value) {
    return String(value || '').trim();
  }

  function showFieldStatus(statusField, message, level) {
    if (!statusField) return;
    var css = 'participa-inline-status';
    statusField.className = css + (level ? ' is-' + level : '');
    statusField.textContent = message || '';
    statusField.hidden = !message;
  }

  function buildUrl(username, query, maxRows) {
    var url = new URL(GEO_API_BASE);
    url.searchParams.set('username', username);
    url.searchParams.set('q', query);
    url.searchParams.set('featureClass', 'P');
    url.searchParams.set('orderby', 'population');
    url.searchParams.set('lang', 'es');
    url.searchParams.set('maxRows', String(maxRows || 8));
    return url.toString();
  }

  async function fetchCities(username, query) {
    var response = await fetch(buildUrl(username, query, 8), {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('GeoNames no respondió correctamente');
    }

    var payload = await response.json();
    var rows = Array.isArray(payload.geonames) ? payload.geonames : [];

    return rows
      .filter(function (row) {
        return row && row.geonameId && row.name && row.countryName;
      })
      .map(function (row) {
        return {
          geonameId: Number(row.geonameId),
          cityName: sanitizeText(row.name),
          countryName: sanitizeText(row.countryName),
          countryGeonameId: row.countryId ? Number(row.countryId) : null,
          adminName: sanitizeText(row.adminName1),
          label: [sanitizeText(row.name), sanitizeText(row.adminName1), sanitizeText(row.countryName)]
            .filter(Boolean)
            .join(', ')
        };
      });
  }

  function clearLocation(fields, keepInputText) {
    if (!keepInputText && fields.input) fields.input.value = '';
    if (fields.cityNameField) fields.cityNameField.value = '';
    if (fields.cityIdField) fields.cityIdField.value = '';
    if (fields.countryNameField) fields.countryNameField.value = '';
    if (fields.countryIdField) fields.countryIdField.value = '';
    if (fields.countryDisplayField) fields.countryDisplayField.value = '';
  }

  function attachCityAutocomplete(options) {
    var opts = options || {};

    var input = resolveElement(opts.input);
    if (!input) return null;

    if (input.dataset.participaGeoBound === '1') {
      return {
        clear: function () {
          input.value = '';
        },
        hasResolvedSelection: function () {
          var cityIdField = resolveElement(opts.cityIdField);
          return !!(cityIdField && String(cityIdField.value || '').trim());
        }
      };
    }

    var username = sanitizeText(opts.username || getConfigValue());

    var fields = {
      input: input,
      cityNameField: resolveElement(opts.cityNameField),
      cityIdField: resolveElement(opts.cityIdField),
      countryNameField: resolveElement(opts.countryNameField),
      countryIdField: resolveElement(opts.countryIdField),
      countryDisplayField: resolveElement(opts.countryDisplayField)
    };

    var statusField = resolveElement(opts.statusField);
    var clearButton = resolveElement(opts.clearButton);

    var dropdown = document.createElement('div');
    dropdown.className = 'participa-geonames-dropdown';
    dropdown.hidden = true;
    input.parentElement.appendChild(dropdown);

    var state = {
      options: [],
      selectedIndex: -1,
      lastQuery: '',
      requestCounter: 0,
      suppressBlurHide: false
    };

    function hideDropdown() {
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      state.options = [];
      state.selectedIndex = -1;
    }

    function renderDropdown(items) {
      state.options = items || [];
      state.selectedIndex = -1;

      if (!state.options.length) {
        hideDropdown();
        return;
      }

      dropdown.innerHTML = '';
      state.options.forEach(function (item, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'participa-geonames-option';
        button.setAttribute('data-index', String(index));
        button.textContent = item.label;
        button.addEventListener('mousedown', function (event) {
          // Keep focus on input until selection is applied.
          event.preventDefault();
          state.suppressBlurHide = true;
          applySelection(index);
        });
        button.addEventListener('click', function () {
          applySelection(index);
        });
        dropdown.appendChild(button);
      });

      dropdown.hidden = false;
    }

    function updateActiveOption() {
      var buttons = dropdown.querySelectorAll('.participa-geonames-option');
      buttons.forEach(function (button, index) {
        if (index === state.selectedIndex) {
          button.classList.add('is-active');
          return;
        }
        button.classList.remove('is-active');
      });
    }

    function applySelection(index) {
      var item = state.options[index];
      if (!item) return;

      input.value = item.label;
      if (fields.cityNameField) fields.cityNameField.value = item.cityName;
      if (fields.cityIdField) fields.cityIdField.value = String(item.geonameId);
      if (fields.countryNameField) fields.countryNameField.value = item.countryName;
      if (fields.countryIdField) {
        fields.countryIdField.value = item.countryGeonameId ? String(item.countryGeonameId) : '';
      }
      if (fields.countryDisplayField) {
        fields.countryDisplayField.value = item.countryName;
      }

      showFieldStatus(statusField, '', '');
      hideDropdown();
    }

    async function runSearch(query) {
      var trimmedQuery = sanitizeText(query);
      state.lastQuery = trimmedQuery;

      if (!trimmedQuery || trimmedQuery.length < (opts.minChars || MIN_QUERY_LENGTH)) {
        hideDropdown();
        return;
      }

      if (!username) {
        hideDropdown();
        showFieldStatus(statusField, 'GeoNames no está configurado en este entorno.', 'warning');
        return;
      }

      state.requestCounter += 1;
      var requestId = state.requestCounter;

      try {
        var rows = await fetchCities(username, trimmedQuery);
        if (requestId !== state.requestCounter) return;

        if (!rows.length) {
          hideDropdown();
          showFieldStatus(statusField, 'No encontramos resultados para esa ciudad.', 'warning');
          return;
        }

        showFieldStatus(statusField, '', '');
        renderDropdown(rows);
      } catch (error) {
        hideDropdown();
        showFieldStatus(statusField, 'No se pudo consultar GeoNames. Intenta de nuevo.', 'error');
      }
    }

    var debouncedSearch = debounce(runSearch, 220);

    input.addEventListener('input', function () {
      clearLocation(fields, true);
      debouncedSearch(input.value);
    });

    input.addEventListener('keydown', function (event) {
      if (dropdown.hidden) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.selectedIndex = Math.min(state.selectedIndex + 1, state.options.length - 1);
        updateActiveOption();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
        updateActiveOption();
        return;
      }

      if (event.key === 'Enter') {
        if (state.selectedIndex >= 0) {
          event.preventDefault();
          applySelection(state.selectedIndex);
        }
        return;
      }

      if (event.key === 'Escape') {
        hideDropdown();
      }
    });

    input.addEventListener('blur', function () {
      if (state.suppressBlurHide) {
        state.suppressBlurHide = false;
        return;
      }
      setTimeout(function () {
        hideDropdown();
      }, 120);
    });

    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearLocation(fields, false);
        showFieldStatus(statusField, '', '');
        hideDropdown();
      });
    }

    input.dataset.participaGeoBound = '1';

    return {
      clear: function () {
        clearLocation(fields, false);
        hideDropdown();
        showFieldStatus(statusField, '', '');
      },
      hasResolvedSelection: function () {
        return !!(fields.cityIdField && sanitizeText(fields.cityIdField.value));
      },
      hasTypedText: function () {
        return !!sanitizeText(input.value);
      }
    };
  }

  ns.geo = {
    attachCityAutocomplete: attachCityAutocomplete,
    clearLocationFields: clearLocation
  };
})();
