(() => {
  if (window.__ME_PRINT_MODE_V103__) return;
  window.__ME_PRINT_MODE_V103__ = true;

  const STORAGE_KEY = "me_print_mode";
  const STYLE_ID = "me-print-mode-v103-style";
  const MODAL_ID = "me-print-mode-v103-modal";
  const originalPrint = window.print.bind(window);
  let pending = false;
  let bypass = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
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
        width: min(460px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: #ffffff;
        box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
        color: #0f172a;
        overflow: hidden;
      }
      .me-print-modal-header {
        padding: 24px 26px 12px;
      }
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
        min-height: 92px;
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
        .me-print-modal-options {
          grid-template-columns: 1fr;
        }
      }
      @media print {
        html[data-me-print-mode="color"] body,
        html[data-me-print-mode="color"] body * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html[data-me-print-mode="bw"] body,
        html[data-me-print-mode="bw"] body * {
          color: #111827 !important;
          background: #ffffff !important;
          background-image: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
          -webkit-print-color-adjust: economy !important;
          print-color-adjust: economy !important;
        }
        html[data-me-print-mode="bw"] table,
        html[data-me-print-mode="bw"] th,
        html[data-me-print-mode="bw"] td,
        html[data-me-print-mode="bw"] .print-table,
        html[data-me-print-mode="bw"] .print-table * {
          border-color: #333333 !important;
        }
        html[data-me-print-mode="bw"] img,
        html[data-me-print-mode="bw"] svg {
          filter: grayscale(1) contrast(1.08) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setMode(mode) {
    const selectedMode = mode === "bw" ? "bw" : "color";
    document.documentElement.dataset.mePrintMode = selectedMode;
    try {
      localStorage.setItem(STORAGE_KEY, selectedMode);
    } catch (_) {
      // Storage can be blocked in private browsing; printing still works.
    }
  }

  function getLastMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "bw" ? "bw" : "color";
    } catch (_) {
      return "color";
    }
  }

  function closeModal() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();
  }

  function chooseMode(mode) {
    closeModal();
    pending = false;
    if (!mode) return;

    setMode(mode);
    bypass = true;
    window.setTimeout(() => {
      try {
        originalPrint();
      } finally {
        window.setTimeout(() => {
          bypass = false;
        }, 300);
      }
    }, 80);
  }

  function showModal() {
    ensureStyles();
    closeModal();

    const backdrop = document.createElement("div");
    backdrop.id = MODAL_ID;
    backdrop.className = "me-print-modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "me-print-modal-title");

    const lastMode = getLastMode();
    backdrop.innerHTML = `
      <div class="me-print-modal">
        <div class="me-print-modal-header">
          <h2 class="me-print-modal-title" id="me-print-modal-title">Mode d'impression</h2>
          <p class="me-print-modal-text">Choisissez le rendu de cette fiche avant d'ouvrir la fenêtre d'impression.</p>
        </div>
        <div class="me-print-modal-options">
          <button class="me-print-option" type="button" data-mode="color">
            <strong>Couleur${lastMode === "color" ? " - actuel" : ""}</strong>
            <span>Conserve l'en-tête, les lignes et les couleurs officielles.</span>
          </button>
          <button class="me-print-option" type="button" data-mode="bw">
            <strong>Noir et blanc${lastMode === "bw" ? " - actuel" : ""}</strong>
            <span>Version économique, plus lisible sur imprimante simple ou ticket.</span>
          </button>
        </div>
        <div class="me-print-modal-footer">
          <button class="me-print-cancel" type="button" data-cancel="true">Annuler</button>
        </div>
      </div>
    `;

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) chooseMode(null);
      const modeButton = event.target.closest("[data-mode]");
      if (modeButton) chooseMode(modeButton.dataset.mode);
      if (event.target.closest("[data-cancel]")) chooseMode(null);
    });

    document.addEventListener("keydown", function onKeydown(event) {
      if (!document.getElementById(MODAL_ID)) {
        document.removeEventListener("keydown", onKeydown);
        return;
      }
      if (event.key === "Escape") chooseMode(null);
    });

    document.body.appendChild(backdrop);
    const preferredButton = backdrop.querySelector(`[data-mode="${lastMode}"]`);
    if (preferredButton) preferredButton.focus();
  }

  window.print = function printWithModeChoice() {
    if (bypass) {
      originalPrint();
      return;
    }
    if (pending) return;
    pending = true;
    showModal();
  };

  window.addEventListener("beforeprint", () => {
    setMode(getLastMode());
  });
})();
