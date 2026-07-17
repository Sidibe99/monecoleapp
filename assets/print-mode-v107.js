(() => {
  if (window.__ME_PRINT_MODE_V107__) return;
  window.__ME_PRINT_MODE_V107__ = true;

  const STORAGE_KEY = "me_print_mode";
  const STYLE_ID = "me-print-mode-v107-style";
  const UI_STYLE_ID = "me-print-mode-v107-ui-style";
  const MODAL_ID = "me-print-mode-v107-modal";
  const originalPrint = window.print.bind(window);
  const originalOpen = window.open.bind(window);
  const state = {
    pending: false,
    bypass: false,
    armedMode: "",
    previewMode: "",
    releaseTimer: 0,
    previousOverflow: ""
  };

  function getLastMode() {
    try { return localStorage.getItem(STORAGE_KEY) === "bw" ? "bw" : "color"; }
    catch (_) { return "color"; }
  }

  function saveMode(mode) {
    const selected = mode === "bw" ? "bw" : "color";
    try { localStorage.setItem(STORAGE_KEY, selected); } catch (_) {}
    return selected;
  }

  function printCss(mode) {
    const selected = mode === "bw" ? "bw" : "color";
    const borderColor = selected === "bw" ? "#111827" : "#475569";
    return `
      @media print {
        html[data-me-print-mode="${selected}"] body,
        html[data-me-print-mode="${selected}"] body * {
          -webkit-print-color-adjust: ${selected === "bw" ? "economy" : "exact"} !important;
          print-color-adjust: ${selected === "bw" ? "economy" : "exact"} !important;
        }
        html[data-me-print-mode="${selected}"] table,
        html[data-me-print-mode="${selected}"] th,
        html[data-me-print-mode="${selected}"] td,
        html[data-me-print-mode="${selected}"] .print-table,
        html[data-me-print-mode="${selected}"] .print-table * {
          border-color: ${borderColor} !important;
        }
        html[data-me-print-mode="${selected}"] .me-timetable-print,
        html[data-me-print-mode="${selected}"] .me-timetable-print th,
        html[data-me-print-mode="${selected}"] .me-timetable-print td {
          border: 1.5px solid ${borderColor} !important;
        }
        ${selected === "bw" ? `
        html[data-me-print-mode="bw"] body,
        html[data-me-print-mode="bw"] body * {
          color: #111827 !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          background-image: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
        html[data-me-print-mode="bw"] img,
        html[data-me-print-mode="bw"] svg {
          filter: grayscale(1) contrast(1.08) !important;
        }
        ` : ""}
      }
    `;
  }

  function applyPrintMode(doc, mode) {
    try {
      if (!doc || !doc.documentElement) return;
      const selected = saveMode(mode);
      doc.documentElement.setAttribute("data-me-print-mode", selected);
      const head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;
      let style = doc.getElementById(STYLE_ID);
      if (!style) {
        style = doc.createElement("style");
        style.id = STYLE_ID;
        head.appendChild(style);
      }
      style.textContent = printCss(selected);
    } catch (_) {}
  }

  function ensureUiStyles() {
    if (document.getElementById(UI_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = UI_STYLE_ID;
    style.textContent = `
      .me-print-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(15, 23, 42, 0.48);
        backdrop-filter: blur(8px);
      }
      .me-print-modal {
        width: min(480px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: #ffffff;
        box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
        color: #0f172a;
        overflow: hidden;
        font-family: "Plus Jakarta Sans", Arial, sans-serif;
      }
      .me-print-modal-header { padding: 24px 26px 12px; }
      .me-print-modal-title {
        margin: 0;
        font-size: 24px;
        line-height: 1.15;
        font-weight: 900;
        letter-spacing: 0;
      }
      .me-print-modal-text {
        margin: 10px 0 0;
        color: #64748b;
        font-size: 16px;
        line-height: 1.45;
        font-weight: 650;
      }
      .me-print-modal-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 10px 26px 22px;
      }
      .me-print-option {
        min-height: 104px;
        border: 2px solid #dbeafe;
        border-radius: 16px;
        background: #f8fafc;
        color: #0f172a;
        cursor: pointer;
        font: inherit;
        text-align: left;
        padding: 14px 16px;
        transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
      }
      .me-print-option:hover,
      .me-print-option:focus-visible {
        transform: translateY(-1px);
        border-color: #2563eb;
        background: #eff6ff;
        outline: none;
      }
      .me-print-option strong {
        display: block;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 900;
      }
      .me-print-option span {
        display: block;
        margin-top: 6px;
        color: #64748b;
        font-size: 13px;
        line-height: 1.25;
        font-weight: 650;
      }
      .me-print-modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 16px 26px 24px;
        border-top: 1px solid #e2e8f0;
      }
      .me-print-cancel {
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #ffffff;
        color: #475569;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
        padding: 11px 18px;
      }
      .me-print-cancel:hover,
      .me-print-cancel:focus-visible {
        border-color: #94a3b8;
        background: #f8fafc;
        outline: none;
      }
      @media (max-width: 560px) {
        .me-print-modal-options { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();
    document.body.style.overflow = state.previousOverflow;
    state.pending = false;
  }

  function askMode(done) {
    ensureUiStyles();
    if (state.pending) return;
    state.pending = true;
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const lastMode = getLastMode();
    const backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "me-print-modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "me-print-modal-title");
    backdrop.setAttribute("aria-describedby", "me-print-modal-description");
    backdrop.innerHTML = `
      <div class="me-print-modal">
        <div class="me-print-modal-header">
          <h2 class="me-print-modal-title" id="me-print-modal-title">Mode d'impression</h2>
          <p class="me-print-modal-text" id="me-print-modal-description">Choisissez le rendu de cette fiche avant d'ouvrir l'aperçu d'impression.</p>
        </div>
        <div class="me-print-modal-options">
          <button class="me-print-option" type="button" data-mode="color">
            <strong>Couleur${lastMode === "color" ? " - actuel" : ""}</strong>
            <span>Conserve l'en-tête, les lignes et les couleurs officielles.</span>
          </button>
          <button class="me-print-option" type="button" data-mode="bw">
            <strong>Noir et blanc${lastMode === "bw" ? " - actuel" : ""}</strong>
            <span>Version économique, lisible sur imprimante simple ou ticket.</span>
          </button>
        </div>
        <div class="me-print-modal-footer">
          <button class="me-print-cancel" type="button" data-cancel="true">Annuler</button>
        </div>
      </div>
    `;

    function finish(mode) {
      document.removeEventListener("keydown", onKeydown);
      closeModal();
      done(mode ? saveMode(mode) : null);
    }

    function onKeydown(event) {
      if (event.key === "Escape") finish(null);
      if (event.key === "Tab") {
        const controls = Array.from(backdrop.querySelectorAll("button:not([disabled])"));
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
      const modeButton = event.target.closest("[data-mode]");
      if (modeButton) finish(modeButton.dataset.mode);
      if (event.target.closest("[data-cancel]")) finish(null);
    });

    document.addEventListener("keydown", onKeydown);
    state.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.appendChild(backdrop);
    const preferredButton = backdrop.querySelector(`[data-mode="${lastMode}"]`);
    if (preferredButton) preferredButton.focus();
  }

  function releaseBypassLater(delay = 900) {
    clearTimeout(state.releaseTimer);
    state.releaseTimer = setTimeout(() => {
      state.bypass = false;
      state.armedMode = "";
    }, delay);
  }

  function findPrintTrigger(target) {
    const el = target && target.closest ? target.closest("button,a,[role='button'],[data-print]") : null;
    if (!el || el.closest(`#${MODAL_ID}`)) return null;
    const label = [
      el.textContent || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || ""
    ].join(" ").toLowerCase();
    return label.includes("imprimer") ? el : null;
  }

  function isPreviewPrintTrigger(trigger) {
    const dialog = trigger && trigger.closest ? trigger.closest('[role="dialog"]') : null;
    if (!dialog) return false;
    const label = [
      dialog.getAttribute("aria-label") || "",
      dialog.getAttribute("aria-labelledby") || "",
      dialog.textContent || ""
    ].join(" ").toLowerCase();
    return label.includes("aperçu avant impression")
      || label.includes("apercu avant impression")
      || label.includes("معاينة");
  }

  function replayTrigger(trigger, mode, delay = 50, releaseDelay = 1800) {
    state.armedMode = saveMode(mode);
    state.bypass = true;
    applyPrintMode(document, state.armedMode);
    const activate = () => {
      try {
        trigger.click();
      } finally {
        releaseBypassLater(releaseDelay);
      }
    };
    if (delay > 0) setTimeout(activate, delay);
    else activate();
  }

  function injectHtml(html, mode) {
    if (typeof html !== "string" || html.includes(STYLE_ID)) return html;
    const selected = mode === "bw" ? "bw" : "color";
    const tag = `<style id="${STYLE_ID}">${printCss(selected)}</style><script>document.documentElement.setAttribute("data-me-print-mode","${selected}");<\/script>`;
    return html.includes("</head>") ? html.replace("</head>", `${tag}</head>`) : `${tag}${html}`;
  }

  function installPrintHooksIn(win) {
    try {
      if (!win || win.__ME_PRINT_MODE_CHILD_V107__) return;
      win.__ME_PRINT_MODE_CHILD_V107__ = true;
      const doc = win.document;
      applyPrintMode(doc, state.armedMode || getLastMode());

      if (doc && doc.write && !doc.__ME_PRINT_WRITE_PATCHED_V107__) {
        const originalWrite = doc.write.bind(doc);
        doc.write = function patchedWrite(...parts) {
          const selected = state.armedMode || getLastMode();
          return originalWrite(...parts.map((part) => injectHtml(part, selected)));
        };
        doc.__ME_PRINT_WRITE_PATCHED_V107__ = true;
      }

      if (win.print && !win.__ME_PRINT_FUNCTION_PATCHED_V107__) {
        const childPrint = win.print.bind(win);
        win.print = function patchedChildPrint() {
          applyPrintMode(win.document, state.armedMode || getLastMode());
          return childPrint();
        };
        win.__ME_PRINT_FUNCTION_PATCHED_V107__ = true;
      }
    } catch (_) {}
  }

  window.open = function patchedOpen(...args) {
    const opened = originalOpen(...args);
    installPrintHooksIn(opened);
    setTimeout(() => installPrintHooksIn(opened), 0);
    setTimeout(() => installPrintHooksIn(opened), 120);
    return opened;
  };

  window.addEventListener("monecole-print-preview", () => {
    state.previewMode = state.bypass && state.armedMode ? state.armedMode : "";
  }, true);

  document.addEventListener("click", (event) => {
    if (state.bypass) return;
    const trigger = findPrintTrigger(event.target);
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();

    if (state.previewMode && isPreviewPrintTrigger(trigger)) {
      const mode = state.previewMode;
      state.previewMode = "";
      replayTrigger(trigger, mode, 0, 2500);
      return;
    }

    askMode((mode) => {
      if (!mode) return;
      replayTrigger(trigger, mode);
    });
  }, true);

  window.print = function printWithModeChoice() {
    if (state.bypass) {
      applyPrintMode(document, state.armedMode || getLastMode());
      originalPrint();
      return;
    }
    askMode((mode) => {
      if (!mode) return;
      state.armedMode = mode;
      state.bypass = true;
      applyPrintMode(document, mode);
      setTimeout(() => {
        try {
          originalPrint();
        } finally {
          releaseBypassLater(900);
        }
      }, 80);
    });
  };

  function patchFrames() {
    document.querySelectorAll("iframe").forEach((frame) => {
      try {
        installPrintHooksIn(frame.contentWindow);
        frame.addEventListener("load", () => installPrintHooksIn(frame.contentWindow), { passive: true });
      } catch (_) {}
    });
  }

  window.addEventListener("beforeprint", () => applyPrintMode(document, state.armedMode || getLastMode()));
  ensureUiStyles();
  applyPrintMode(document, getLastMode());
  patchFrames();
  new MutationObserver(patchFrames).observe(document.documentElement, { childList: true, subtree: true });
})();
