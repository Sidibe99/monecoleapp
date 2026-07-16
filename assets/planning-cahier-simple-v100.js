(() => {
  const STYLE_ID = "me-planning-cahier-simple-v100-style";
  const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const DAY_RE = /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi)\b/i;
  const TIME_RE = /\b\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}\b/;

  const text = (node) => String(node?.textContent || "").replace(/\s+/g, " ").trim();
  const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .me-planning-cahier-simple .me-pedago-tools,
      .me-planning-cahier-simple .me-pedago-tools-host,
      .me-planning-cahier-simple #me-pedago-tools-persistent,
      .me-planning-cahier-simple #me-pedago-panels,
      .me-planning-cahier-simple .me-v89-sweep-panel,
      .me-planning-cahier-simple .me-sujet-pro-panel,
      .me-planning-cahier-simple [data-me-extra-tool="1"] {
        display: none !important;
      }

      .me-planning-cahier-simple .me-timetable-days-grid-clean {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(260px, 1fr)) !important;
        gap: 18px !important;
        width: 100% !important;
        max-width: none !important;
        align-items: stretch !important;
        margin: 18px 0 22px !important;
      }

      .me-planning-cahier-simple .me-timetable-day-clean {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        min-height: 230px !important;
        overflow: hidden !important;
        border: 1px solid rgba(148, 163, 184, .28) !important;
        border-radius: 16px !important;
        background: #fff !important;
        box-shadow: 0 12px 30px rgba(15, 23, 42, .08) !important;
      }

      .me-planning-cahier-simple .me-timetable-day-clean > :first-child {
        min-height: 58px !important;
      }

      .me-planning-cahier-simple .me-timetable-course-clean {
        display: grid !important;
        grid-template-columns: minmax(104px, 132px) minmax(0, 1fr) auto !important;
        gap: 10px 12px !important;
        align-items: center !important;
        width: calc(100% - 28px) !important;
        max-width: none !important;
        margin: 12px 14px !important;
        padding: 14px 14px !important;
        overflow: hidden !important;
        border-radius: 13px !important;
        background: #f8fafc !important;
        border-left: 4px solid var(--me-primary, #1d4ed8) !important;
      }

      .me-planning-cahier-simple .me-timetable-course-clean button {
        white-space: nowrap !important;
      }

      .me-planning-cahier-simple .me-timetable-cahier-clean {
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        margin: 22px 0 0 !important;
        border-radius: 16px !important;
        overflow: visible !important;
      }

      .me-planning-cahier-simple .me-timetable-cahier-clean[hidden],
      .me-planning-cahier-simple .me-timetable-days-grid-clean[hidden],
      .me-planning-cahier-simple .me-timetable-day-clean[hidden] {
        display: block !important;
      }

      .me-planning-cahier-simple .me-timetable-days-grid-clean[hidden] {
        display: grid !important;
      }

      @media (max-width: 1180px) {
        .me-planning-cahier-simple .me-timetable-days-grid-clean {
          grid-template-columns: repeat(2, minmax(240px, 1fr)) !important;
        }
      }

      @media (max-width: 760px) {
        .me-planning-cahier-simple .me-timetable-days-grid-clean {
          grid-template-columns: 1fr !important;
          gap: 14px !important;
        }
        .me-planning-cahier-simple .me-timetable-day-clean {
          min-height: 190px !important;
        }
        .me-planning-cahier-simple .me-timetable-course-clean {
          grid-template-columns: 1fr !important;
          align-items: start !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function closest(node, predicate, maxDepth = 12) {
    let current = node;
    let depth = 0;
    while (current && current !== document.body && depth <= maxDepth) {
      if (predicate(current)) return current;
      current = current.parentElement;
      depth += 1;
    }
    return null;
  }

  function currentPlanningPage() {
    const candidates = all("main, section, article, div");
    const title = all("h1,h2").find((node) =>
      /^(Emploi du temps|Planning des cours|Planning\s*&\s*cahier)\b/i.test(text(node))
    );
    if (title) {
      return closest(title, (node) => {
        const body = text(node);
        return body.includes("Emploi du temps") && body.includes("Cahier de texte") && body.length < 120000;
      }, 12);
    }
    return candidates.find((node) => {
      const body = text(node);
      return body.includes("Emploi du temps") && body.includes("Cahier de texte") && body.length < 120000;
    }) || null;
  }

  function markExtraTools(root) {
    all(".me-pedago-tools, .me-pedago-tools-host, #me-pedago-tools-persistent, #me-pedago-panels, .me-v89-sweep-panel, .me-sujet-pro-panel", root)
      .forEach((node) => {
        node.dataset.meExtraTool = "1";
        node.hidden = true;
      });

    all("h2,h3,strong", root).forEach((heading) => {
      if (!/Outils pédagogiques|Liste annuelle de balayage|Liste de balayage|Préparer un sujet|Sujets d['’]évaluation/i.test(text(heading))) return;
      const block = closest(heading, (node) => {
        const body = text(node);
        return /^(SECTION|ARTICLE|DIV|FORM)$/i.test(node.tagName) && body.length < 18000;
      }, 10);
      if (block && !/Cahier de texte/i.test(text(block))) {
        block.dataset.meExtraTool = "1";
        block.hidden = true;
      }
    });
  }

  function dayScore(node) {
    const body = text(node);
    if (!DAY_RE.test(body)) return 0;
    if (/Liste annuelle|Préparer un sujet|Outils pédagogiques|Cahier de texte/i.test(body)) return 0;
    if (body.length > 2600) return 0;
    let score = 1;
    if (TIME_RE.test(body)) score += 2;
    if (/Aucun cours/i.test(body)) score += 1;
    if (/Modifier|Supprimer|\+/i.test(body)) score += 1;
    return score;
  }

  function markPlanningGrid(root) {
    const dayCards = all("section, article, div", root).filter((node) => {
      if (dayScore(node) < 2) return false;
      return !all("section, article, div", node).some((child) => child !== node && dayScore(child) >= dayScore(node));
    });

    dayCards.forEach((node) => {
      node.hidden = false;
      node.classList.add("me-timetable-day", "me-timetable-day-clean");
      node.dataset.meKeepPlanning = "1";
    });

    const groups = new Map();
    dayCards.forEach((card) => {
      const parent = card.parentElement;
      if (!parent) return;
      const list = groups.get(parent) || [];
      list.push(card);
      groups.set(parent, list);
    });

    let bestParent = null;
    let bestCount = 0;
    groups.forEach((list, parent) => {
      if (list.length > bestCount) {
        bestParent = parent;
        bestCount = list.length;
      }
    });

    if (bestParent && bestCount >= 2) {
      bestParent.hidden = false;
      bestParent.classList.add("me-timetable-days-grid", "me-timetable-days-grid-clean");
      bestParent.dataset.meKeepPlanning = "1";
    }

    dayCards.forEach((day) => {
      all("section, article, div", day).forEach((node) => {
        const body = text(node);
        if (!TIME_RE.test(body) || body.length > 900) return;
        if (!/Modifier|Supprimer|Science|Calcul|Math|Français|Histoire|EPS|Prof|Bah|Sidibe|Salle/i.test(body)) return;
        node.classList.add("me-timetable-course-clean");
      });
    });
  }

  function markCahier(root) {
    const heading = all("h2,h3,strong", root).find((node) => /Cahier de texte/i.test(text(node)));
    if (!heading) return;
    const block = closest(heading, (node) => {
      const body = text(node);
      return /^(SECTION|ARTICLE|DIV|FORM)$/i.test(node.tagName)
        && body.includes("Cahier de texte")
        && body.length < 24000;
    }, 10);
    if (!block) return;
    block.hidden = false;
    block.dataset.meKeepPlanning = "1";
    block.classList.add("me-timetable-cahier", "me-timetable-cahier-clean");
  }

  function renameSidebar() {
    all("button, a, div, span").forEach((node) => {
      if (text(node) === "Emploi du temps") node.setAttribute("title", "Emploi du temps et cahier de texte");
    });
  }

  function clean() {
    addStyle();
    const root = currentPlanningPage();
    if (!root) return;
    root.classList.add("me-planning-cahier-simple", "me-timetable-page");
    root.dataset.mePlanningSimple = "1";
    markPlanningGrid(root);
    markCahier(root);
    markExtraTools(root);
    renameSidebar();
  }

  let queued = false;
  function scheduleClean() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      clean();
    });
  }

  document.addEventListener("click", scheduleClean, true);
  window.addEventListener("hashchange", scheduleClean);
  new MutationObserver(scheduleClean).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(clean, 1200);
  clean();
})();
