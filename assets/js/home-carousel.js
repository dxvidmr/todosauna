(function () {
  "use strict";

  const TRACK_ID = "carouselTrack";
  const CARD_SELECTOR = ".explore-card";
  const LEGACY_CLONE_SELECTOR = `${CARD_SELECTOR}[data-clone="true"]`;
  const MODE_ATTR = "data-carousel-mode";
  const OVERFLOW_ATTR = "data-overflow";

  const AUTOPLAY_SPEED_PX_PER_FRAME = 0.85;
  const RESUME_DELAY_MS = 900;
  const REFRESH_DEBOUNCE_MS = 120;

  function initHomeCarousel() {
    const track = document.getElementById(TRACK_ID);
    if (!track || track.dataset.carouselReady === "true") return;

    const carousel = track.closest(".explore-carousel");
    if (!carousel) return;

    track.dataset.carouselReady = "true";

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let hasOverflow = false;
    let maxScroll = 0;
    let autoPosition = 0;
    let direction = 1;

    let rafId = 0;
    let lastFrameTs = 0;
    let resumeTimer = 0;
    let resizeTimer = 0;
    let refreshTimer = 0;

    let isPointerDown = false;
    let isHovering = false;
    let hasFocusInside = false;
    let pointerId = null;
    let pointerStartX = 0;
    let pointerStartScroll = 0;

    function getBaseCards() {
      return Array.from(track.querySelectorAll(`${CARD_SELECTOR}:not([data-clone="true"])`));
    }

    function setMode(mode) {
      track.setAttribute(MODE_ATTR, mode);
      carousel.setAttribute(MODE_ATTR, mode);
    }

    function setOverflowState(value) {
      hasOverflow = value;
      const state = value ? "true" : "false";
      track.setAttribute(OVERFLOW_ATTR, state);
      carousel.setAttribute(OVERFLOW_ATTR, state);
    }

    function removeLegacyClones() {
      track.querySelectorAll(LEGACY_CLONE_SELECTOR).forEach((clone) => clone.remove());
    }

    function clampScroll(value) {
      if (maxScroll <= 0) return 0;
      return Math.min(maxScroll, Math.max(0, value));
    }

    function applyScroll(next) {
      const clamped = clampScroll(next);
      autoPosition = clamped;
      track.scrollLeft = clamped;
      return clamped;
    }

    function syncFromTrack() {
      const observed = clampScroll(track.scrollLeft);
      if (Math.abs(observed - autoPosition) > 0.5) {
        direction = observed > autoPosition ? 1 : -1;
      }
      autoPosition = observed;
    }

    function shouldAutoplay() {
      return (
        hasOverflow &&
        !prefersReducedMotion.matches &&
        !document.hidden &&
        !isPointerDown &&
        !isHovering &&
        !hasFocusInside
      );
    }

    function stopAutoplay() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      lastFrameTs = 0;
    }

    function tick(ts) {
      if (!rafId) return;

      if (!lastFrameTs) lastFrameTs = ts;
      const delta = ts - lastFrameTs;
      lastFrameTs = ts;

      if (shouldAutoplay()) {
        let next = autoPosition + direction * AUTOPLAY_SPEED_PX_PER_FRAME * (delta / 16.6667);

        if (next >= maxScroll) {
          next = maxScroll;
          direction = -1;
        } else if (next <= 0) {
          next = 0;
          direction = 1;
        }

        applyScroll(next);
      }

      rafId = window.requestAnimationFrame(tick);
    }

    function startAutoplay() {
      if (rafId || !shouldAutoplay()) return;
      lastFrameTs = 0;
      rafId = window.requestAnimationFrame(tick);
    }

    function pauseAutoplay() {
      window.clearTimeout(resumeTimer);
      stopAutoplay();
    }

    function queueAutoplayResume() {
      window.clearTimeout(resumeTimer);
      stopAutoplay();
      resumeTimer = window.setTimeout(startAutoplay, RESUME_DELAY_MS);
    }

    function scheduleRefresh(delay = REFRESH_DEBOUNCE_MS) {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshLayout, delay);
    }

    function bindImageReflow(baseCards) {
      baseCards.forEach((card) => {
        const img = card.querySelector("img");
        if (!img || img.complete) return;

        img.addEventListener("load", () => scheduleRefresh(0), { once: true });
        img.addEventListener("error", () => scheduleRefresh(0), { once: true });
      });
    }

    function refreshLayout() {
      pauseAutoplay();
      removeLegacyClones();
      track.classList.remove("is-dragging");

      const baseCards = getBaseCards();
      bindImageReflow(baseCards);
      const preservedScroll = track.scrollLeft;
      const preservedDirection = direction;

      track.removeAttribute(MODE_ATTR);
      track.removeAttribute(OVERFLOW_ATTR);
      carousel.removeAttribute(MODE_ATTR);
      carousel.removeAttribute(OVERFLOW_ATTR);

      maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);

      if (baseCards.length < 2 || maxScroll <= 1) {
        direction = 1;
        setOverflowState(false);
        setMode("center");
        applyScroll(0);
        return;
      }

      direction = preservedDirection === -1 ? -1 : 1;
      setOverflowState(true);
      setMode("carousel");
      applyScroll(preservedScroll);
      queueAutoplayResume();
    }

    function onPointerDown(event) {
      if (!hasOverflow) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      isPointerDown = true;
      pointerId = event.pointerId;
      pointerStartX = event.clientX;
      syncFromTrack();
      pointerStartScroll = autoPosition;
      track.classList.add("is-dragging");
      pauseAutoplay();

      if (track.setPointerCapture) {
        track.setPointerCapture(event.pointerId);
      }
    }

    function onPointerMove(event) {
      if (!isPointerDown || event.pointerId !== pointerId) return;
      const deltaX = event.clientX - pointerStartX;
      applyScroll(pointerStartScroll - deltaX);
      event.preventDefault();
    }

    function onPointerEnd(event) {
      if (!isPointerDown) return;
      if (event && pointerId !== null && event.pointerId !== pointerId) return;

      isPointerDown = false;
      pointerId = null;
      track.classList.remove("is-dragging");
      queueAutoplayResume();
    }

    function onWheel(event) {
      if (!hasOverflow) return;

      const useDeltaX = Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.6;
      const delta = useDeltaX ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 0.1) return;

      const before = autoPosition;
      const after = applyScroll(before + delta);

      if (after !== before) {
        event.preventDefault();
      }

      if (after >= maxScroll) {
        direction = -1;
      } else if (after <= 0) {
        direction = 1;
      }

      queueAutoplayResume();
    }

    function onTrackScroll() {
      if (!hasOverflow) return;
      syncFromTrack();
    }

    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refreshLayout, 150);
    }

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", onPointerEnd);
    track.addEventListener("pointercancel", onPointerEnd);
    track.addEventListener("lostpointercapture", onPointerEnd);

    track.addEventListener("dragstart", (event) => {
      event.preventDefault();
    });

    track.addEventListener("scroll", onTrackScroll, { passive: true });

    track.addEventListener("mouseenter", () => {
      isHovering = true;
      pauseAutoplay();
    });

    track.addEventListener("mouseleave", () => {
      isHovering = false;
      queueAutoplayResume();
    });

    track.addEventListener("focusin", () => {
      hasFocusInside = true;
      pauseAutoplay();
    });

    track.addEventListener("focusout", () => {
      hasFocusInside = false;
      queueAutoplayResume();
    });

    track.addEventListener("wheel", onWheel, { passive: false });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pauseAutoplay();
      } else {
        queueAutoplayResume();
      }
    });

    if (prefersReducedMotion.addEventListener) {
      prefersReducedMotion.addEventListener("change", () => {
        if (prefersReducedMotion.matches) {
          pauseAutoplay();
        } else {
          queueAutoplayResume();
        }
      });
    } else if (prefersReducedMotion.addListener) {
      prefersReducedMotion.addListener(() => {
        if (prefersReducedMotion.matches) {
          pauseAutoplay();
        } else {
          queueAutoplayResume();
        }
      });
    }

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("load", () => scheduleRefresh(0), { once: true });

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(onResize);
      observer.observe(track);
      observer.observe(carousel);
    }

    refreshLayout();
    window.setTimeout(() => scheduleRefresh(0), 450);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeCarousel, { once: true });
  } else {
    initHomeCarousel();
  }
})();
