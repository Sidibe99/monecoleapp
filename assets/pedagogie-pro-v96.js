(() => {
  try {
    const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const TIME_RE = /\b\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}\b/;
    const txt = node => String(node?.textContent || "").replace(/\s+/g, " ").trim();
    const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const el = (tag, className, html) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (html != null) node.innerHTML = html;
      return node;
    };
    const ensurePedagoStyle = () => {
      if (document.getElementById("me-pedagogie-pro-v96-style")) return;
      const style = el("style");
      style.id = "me-pedagogie-pro-v96-style";
      style.textContent = `
        .me-page .is-hidden { display: none !important; }
        .me-timetable-page .me-timetable-days-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 18px !important;
          align-items: stretch !important;
          width: 100% !important;
          max-width: none !important;
          margin: 18px 0 0 !important;
        }
        .me-timetable-page .me-timetable-days-grid > .me-timetable-day {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin: 0 !important;
        }
        .me-timetable-page .me-planning-block.is-hidden,
        .me-timetable-page .me-cahier-block.is-hidden,
        .me-timetable-page #me-pedago-panels.is-hidden,
        .me-timetable-page .me-v89-sweep-panel.is-hidden,
        .me-timetable-page .me-sujet-pro-panel.is-hidden,
        .me-timetable-page .me-timetable-cahier.is-hidden {
          display: none !important;
        }
        .me-pedago-tools {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin: 0 0 22px;
          padding: 18px 22px;
          position: sticky;
          top: 0;
          z-index: 60;
          border: 1px solid rgba(37,99,235,.22);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(239,246,255,.96), rgba(255,255,255,.98));
          backdrop-filter: blur(10px);
          box-shadow: 0 14px 38px rgba(15,23,42,.08);
        }
        .me-pedago-tools-host {
          position: fixed !important;
          top: 86px !important;
          left: 338px !important;
          right: 32px !important;
          z-index: 950 !important;
          margin: 0 !important;
        }
        body.me-pedago-tools-active .me-main {
          padding-top: 126px !important;
        }
        .me-pedago-tools-host[hidden] {
          display: none !important;
        }
        .me-pedago-tools strong {
          display: block;
          color: #0f172a;
          font-size: clamp(20px, 2vw, 28px);
          line-height: 1.08;
        }
        .me-pedago-tools span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-weight: 700;
          line-height: 1.35;
        }
        .me-pedago-tool-buttons {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
        }
        .me-pedago-tool-buttons button {
          min-height: 48px;
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          background: #fff;
          color: #475569;
          padding: 0 18px;
          font: inherit;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(15,23,42,.06);
        }
        .me-pedago-tool-buttons button.is-active {
          border-color: #1d4ed8;
          background: #1d4ed8;
          color: #fff;
          box-shadow: 0 12px 26px rgba(37,99,235,.22);
        }
        .me-timetable-settings-permission {
          margin: 18px 0;
          padding: 18px 20px;
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          background: #eff6ff;
          box-shadow: 0 12px 30px rgba(37,99,235,.08);
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(240px,360px);
          gap: 14px;
          align-items: center;
        }
        .me-timetable-settings-permission strong,
        .me-timetable-settings-permission span {
          display: block;
        }
        .me-timetable-settings-permission strong {
          color: #0f172a;
          font-weight: 900;
        }
        .me-timetable-settings-permission span {
          margin-top: 4px;
          color: #64748b;
          font-weight: 700;
          line-height: 1.35;
        }
        .me-timetable-settings-permission select {
          width: 100%;
          min-height: 46px;
          border-radius: 12px;
          border: 1px solid #bfdbfe;
          background: #fff;
          color: #0f172a;
          font: inherit;
          font-weight: 850;
          padding: 0 12px;
        }
        @media (max-width: 1120px) {
          .me-timetable-page .me-timetable-days-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 760px) {
          .me-pedago-tools { align-items: stretch; flex-direction: column; padding: 16px; }
          .me-pedago-tools-host {
            top: 76px !important;
            left: 12px !important;
            right: 12px !important;
          }
          body.me-pedago-tools-active .me-main {
            padding-top: 250px !important;
          }
          .me-pedago-tool-buttons { display: grid; grid-template-columns: 1fr; }
          .me-pedago-tool-buttons button { width: 100%; }
          .me-timetable-settings-permission { grid-template-columns: 1fr; }
          .me-timetable-page .me-timetable-days-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }
        }
      `;
      document.head.appendChild(style);
    };
    const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const closest = (node, predicate, max = 12) => {
      let current = node;
      for (let i = 0; current && i < max; i += 1, current = current.parentElement) {
        if (predicate(current)) return current;
      }
      return null;
    };
    const read = (key, fallback) => {
      try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      } catch {
        return fallback;
      }
    };
    const write = (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    };
    const schoolSlug = () => {
      const sidebar = all("aside,nav,div").find(node => /MonEcole/.test(txt(node)) && /Connecté/.test(txt(node)));
      return norm(txt(sidebar).slice(0, 140) || "MonEcole").replace(/\W+/g, "_");
    };
    const userInfo = () => {
      const sidebar = all("aside,nav,div").find(node => /Connecté/.test(txt(node)) && /ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE/i.test(txt(node)));
      const body = txt(sidebar);
      const role = (body.match(/(ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE)/i) || [])[1] || "";
      const name = (body.match(/Connecté\s+(.+?)\s+(ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE)/i) || [])[1] || "";
      return { name: name.trim(), role: role.toUpperCase().replace("É", "E") };
    };
    const isDirection = info => /ADMINISTRATEUR|DIRECTEUR/.test(info.role);
    const page = () => {
      const main = document.querySelector(".me-main") || document.body;
      const title = all("h1,h2", main).find(node => /^(Emploi du temps|Planning des cours)\b/i.test(txt(node)));
      if (title) return closest(title, node => node.classList?.contains("me-page"), 12) || title.parentElement;
      const marker = all(".me-timetable-toolbar,.me-timetable-day,.me-timetable-cahier,#me-pedago-panels,.me-v89-sweep-panel,.me-sujet-pro-panel,.me-timetable-permission,.me-timetable-lock-banner,strong,h1,h2,h3,section,div", main).find(node => {
        const body = txt(node);
        return /^Note d’aide\s+—\s+(Emploi du temps|Planning)/i.test(body)
          || /^Gestion de l'emploi du temps\b/i.test(body)
          || /Cahier de texte|Liste annuelle de balayage|Liste de balayage|Préparer un sujet|Sujets d['’]évaluation|composition ou test/i.test(body)
          || node.id === "me-pedago-panels"
          || node.classList?.contains("me-timetable-toolbar")
          || node.classList?.contains("me-timetable-day")
          || node.classList?.contains("me-timetable-cahier")
          || node.classList?.contains("me-v89-sweep-panel")
          || node.classList?.contains("me-sujet-pro-panel")
          || node.classList?.contains("me-timetable-permission")
          || node.classList?.contains("me-timetable-lock-banner");
      });
      if (!marker) return null;
      return closest(marker, node => node.classList?.contains("me-page"), 12) || main.querySelector(".me-page") || main;
    };
    const selectedClass = root => {
      const select = root?.querySelector("select");
      return txt(select?.options?.[select.selectedIndex]) || "Classe";
    };
    const baseKey = root => `monecole_v89_${schoolSlug()}_${norm(selectedClass(root)).replace(/\W+/g, "_")}`;
    const dispatch = node => {
      try {
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {}
    };
    const toIsoDate = value => {
      const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || "");
    };
    const dateFr = value => {
      const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
    };
    const improveDates = root => {
      all("input", root).forEach(input => {
        const hint = `${input.placeholder || ""} ${input.value || ""} ${input.getAttribute("aria-label") || ""}`;
        if (!/jj\/mm\/aaaa|date|semaine/i.test(hint)) return;
        if (input.dataset.meV89Date === "1") return;
        input.dataset.meV89Date = "1";
        input.classList.add("me-date-pro");
        if (input.type === "text") {
          input.value = toIsoDate(input.value);
          input.type = "date";
          dispatch(input);
        }
      });
    };
    const scanStudents = className => {
      const wanted = norm(className);
      const found = new Map();
      const seen = new Set();
      const add = value => {
        const name = String(value || "").replace(/\s+/g, " ").trim();
        if (name.length < 2) return;
        const key = norm(name);
        if (!found.has(key)) found.set(key, name);
      };
      const visit = (value, inheritedClass = "") => {
        if (!value || seen.has(value)) return;
        if (typeof value !== "object") return;
        seen.add(value);
        if (Array.isArray(value)) {
          value.forEach(item => visit(item, inheritedClass));
          return;
        }
        const localClass = value.classe_nom || value.classe || value.classeName || value.nom_classe || inheritedClass;
        const first = value.prenom || value.prénom || "";
        const last = value.nom || "";
        const full = value.nom_complet || value.nomComplet || value.fullName || [first, last].filter(Boolean).join(" ");
        const looksStudent = full && (value.matricule || value.genre || value.classe_id || value.date_naissance || value.parent || value.tuteur);
        const sameClass = !localClass || norm(localClass).includes(wanted) || wanted.includes(norm(localClass));
        if (looksStudent && sameClass) add(full);
        Object.keys(value).forEach(key => {
          if (/classe/i.test(key) && typeof value[key] === "string") return;
          visit(value[key], localClass);
        });
      };
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !/eleve|élève|student|classe|monecole/i.test(key)) continue;
        try {
          visit(JSON.parse(localStorage.getItem(key) || "null"));
        } catch {}
      }
      return Array.from(found.values()).sort((a, b) => a.localeCompare(b, "fr"));
    };
    const clone = value => JSON.parse(JSON.stringify(value || {}));
    const schoolTitle = () => {
      const sidebar = all("aside,nav,div").find(node => /MonEcole/.test(txt(node)) && /Connecté/.test(txt(node)));
      const lines = String(sidebar?.innerText || sidebar?.textContent || "")
        .split(/\n+/)
        .map(value => value.trim())
        .filter(Boolean);
      return lines.find(value => value && !/MonEcole|Connecté|ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE|Synchronisé|Actualiser/i.test(value)) || "MonEcole";
    };
    const schoolYearLabel = () => {
      const now = new Date();
      const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      return `${start}-${start + 1}`;
    };
    const printHtml = (title, body) => {
      let zone = document.getElementById("me-print-zone");
      if (!zone) {
        zone = el("section");
        zone.id = "me-print-zone";
        document.body.appendChild(zone);
      }
      zone.innerHTML = `<div class="me-print-doc"><h1>${escapeHtml(title)}</h1>${body}</div>`;
      document.body.classList.add("me-print-pedago");
      setTimeout(() => {
        window.print();
        setTimeout(() => document.body.classList.remove("me-print-pedago"), 250);
      }, 50);
    };
    const appMessage = message => {
      let box = document.getElementById("me-v89-app-message");
      if (!box) {
        box = el("div", "me-v89-app-message", '<div><strong>MonEcole</strong><p></p><button type="button">OK</button></div>');
        document.body.appendChild(box);
        box.querySelector("button").onclick = () => box.remove();
      }
      box.querySelector("p").textContent = message;
    };
    const renderChips = (card, names) => {
      const area = card.querySelector("[data-sweep-chips]");
      area.innerHTML = names.length ? "" : '<span class="me-sweep-empty">Aucun élève choisi pour ce jour.</span>';
      names.forEach((name, index) => {
        const chip = el("span", "me-sweep-chip", `${escapeHtml(name)} <button type="button" aria-label="Retirer">×</button>`);
        chip.querySelector("button").onclick = () => {
          names.splice(index, 1);
          renderChips(card, names);
          card.dispatchEvent(new CustomEvent("me:sweep-change", { bubbles: true }));
        };
        area.appendChild(chip);
      });
      card.querySelector("[data-day-count]").textContent = `${names.length} élève${names.length > 1 ? "s" : ""}`;
    };
    const buildAnnualSweepPrint = (className, days) => {
      const rows = DAYS.map(day => `<tr><th>${escapeHtml(day)}</th><td>${(days?.[day] || []).map(escapeHtml).join("<br>") || "-"}</td></tr>`).join("");
      return `
        <div class="me-print-header me-sweep-print-header">
          <div>
            <strong>MonEcole</strong>
            <span>${escapeHtml(schoolTitle())}</span>
          </div>
          <div>
            <h2>Liste annuelle de balayage</h2>
            <p>Classe : ${escapeHtml(className)} · Année scolaire : ${escapeHtml(schoolYearLabel())}</p>
          </div>
          <div>
            <span>Imprimé le ${escapeHtml(new Date().toLocaleDateString("fr-FR"))}</span>
          </div>
        </div>
        <table class="me-print-table me-sweep-print-table">
          <thead><tr><th>Jour</th><th>Élèves de service</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="me-print-note">Cette fiche est valable pour l'année scolaire et peut être mise à jour par l'école en cas de changement.</p>
      `;
    };
    const renderAnnualSweep = (panel, key, current) => {
      const item = read(key, null);
      const target = panel.querySelector("[data-sweep-list]");
      const rows = DAYS.map(day => `<li><b>${day}</b><span>${(current?.[day] || []).map(escapeHtml).join(", ") || "Aucun élève choisi"}</span></li>`).join("");
      target.innerHTML = `
        <div class="me-pedago-item me-sweep-saved me-sweep-annual-summary">
          <div>
            <strong>Planning annuel ${item?.updatedAt ? "enregistré" : "en préparation"}</strong>
            <small>${item?.updatedAt ? `Dernière modification : ${new Date(item.updatedAt).toLocaleString("fr-FR")}` : "Choisissez les élèves de service pour chaque jour, puis enregistrez."}</small>
          </div>
          <ul>${rows}</ul>
          <div class="me-pedago-actions">
            <button class="me-pedago-btn" data-print-annual>Imprimer la fiche annuelle</button>
          </div>
        </div>
      `;
      target.onclick = event => {
        const print = event.target.closest("[data-print-annual]");
        if (print) {
          printHtml("Liste annuelle de balayage", buildAnnualSweepPrint(selectedClass(page()), current));
        }
      };
    };
    const renameTimetableLabels = root => {
      const replaceText = (node, from, to) => {
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE && from.test(child.nodeValue || "")) {
            child.nodeValue = child.nodeValue.replace(from, to);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            replaceText(child, from, to);
          }
        });
      };
      all("button,a,[role='button']", document.body).forEach(node => {
        if (root?.contains(node)) return;
        if (/Emploi du temps/i.test(txt(node))) replaceText(node, /Emploi du temps/gi, "Planning & outils");
      });
      const title = all("h1,h2", root).find(node => /^(Emploi du temps|Planning des cours)\b/i.test(txt(node)));
      if (title) {
        title.classList.add("me-timetable-title");
        replaceText(title, /Emploi du temps/gi, "Planning des cours");
      }
      all("strong,h2,h3,div", root).forEach(node => {
        if (!/^Note d’aide\s+—\s+Emploi du temps/i.test(txt(node))) return;
        replaceText(node, /Emploi du temps/gi, "Planning & outils");
      });
    };
    const markTimetableStructure = root => {
      const dayCards = new Set(all(".me-timetable-day", root));
      all("div,section,article", root).forEach(node => {
        const body = txt(node);
        if (!DAYS.includes(body)) return;
        const card = closest(node, candidate => {
          if (candidate === root) return false;
          const candidateText = txt(candidate);
          return candidateText.includes(body)
            && (candidateText.includes("Aucun cours") || TIME_RE.test(candidateText) || candidateText.length < 900);
        }, 8);
        if (card) dayCards.add(card);
      });
      dayCards.forEach(card => {
        card.classList.add("me-timetable-day", "me-planning-block");
        card.style.maxWidth = "";
      });
      all("button", root).forEach(button => {
        const label = txt(button);
        if (!/^Modifier$|^Supprimer$/i.test(label)) return;
        const course = closest(button, candidate => {
          if (candidate === root) return false;
          const candidateText = txt(candidate);
          return TIME_RE.test(candidateText)
            && candidateText.length < 420
            && candidateText.includes("Modifier")
            && candidateText.includes("Supprimer");
        }, 8);
        if (course) course.classList.add("me-timetable-course", "me-planning-block");
      });
      all("div,section,article", root).forEach(node => {
        if (txt(node) !== "Aucun cours") return;
        const empty = closest(node, candidate => candidate !== root && txt(candidate).includes("Aucun cours"), 4);
        if (empty) empty.classList.add("me-timetable-empty");
      });
      const groups = new Map();
      dayCards.forEach(card => {
        if (!card.parentElement) return;
        groups.set(card.parentElement, (groups.get(card.parentElement) || 0) + 1);
      });
      groups.forEach((count, parent) => {
        if (count >= 2) parent.classList.add("me-timetable-days-grid", "me-planning-block");
      });
      const cahierTitle = all("h2,h3,div", root).find(node => txt(node).includes("Cahier de texte"));
      const cahier = cahierTitle && closest(cahierTitle, node => node !== root && txt(node).includes("Leçon / contenu enseigné"), 10);
      if (cahier) cahier.classList.add("me-timetable-cahier", "me-cahier-block");
      all(".me-pedago-panel", root).forEach(panel => {
        const body = txt(panel);
        if (/Liste annuelle de balayage|Liste de balayage/i.test(body)) panel.classList.add("me-v89-sweep-panel");
        if (/Sujets d['’]évaluation|Préparer un sujet|composition ou test/i.test(body)) panel.classList.add("me-sujet-pro-panel");
      });
    };
    const placePedagoTools = (root, nav) => {
      if (!root || !nav) return;
      if (nav.classList.contains("me-pedago-tools-host")) return;
      const help = all("strong,h1,h2,h3,div,section", root).find(node => /^Note d’aide\s+—\s+(Emploi du temps|Planning)/i.test(txt(node)));
      const title = all("h1,h2", root).find(node => /^(Emploi du temps|Planning des cours)\b/i.test(txt(node)));
      const firstTool = root.querySelector(".me-timetable-toolbar,.me-timetable-days-grid,.me-timetable-day,.me-timetable-cahier,#me-pedago-panels,.me-v89-sweep-panel,.me-sujet-pro-panel,.me-timetable-lock-banner");
      if (help && help !== nav && help.nextElementSibling !== nav) {
        help.insertAdjacentElement("afterend", nav);
      } else if (!help && title && title !== nav && title.nextElementSibling !== nav) {
        title.insertAdjacentElement("afterend", nav);
      } else if (!help && !title && firstTool && firstTool.previousElementSibling !== nav) {
        firstTool.insertAdjacentElement("beforebegin", nav);
      } else if (!help && !title && !firstTool && root.firstElementChild !== nav) {
        root.insertBefore(nav, root.firstElementChild);
      }
    };
    const markPlanningShell = root => {
      root.classList.add("me-timetable-page");
      markTimetableStructure(root);
      const title = all("h1,h2", root).find(node => /^(Emploi du temps|Planning des cours)\b/i.test(txt(node)));
      if (title) {
        title.classList.add("me-timetable-title");
        const subtitle = title.nextElementSibling;
        if (subtitle && /Choisissez une classe|Classe\s*:/i.test(txt(subtitle))) subtitle.classList.add("me-timetable-subtitle");
      }
      all(".me-timetable-toolbar,.me-timetable-day,.me-timetable-permission,.me-timetable-lock-banner", root)
        .forEach(node => node.classList.add("me-planning-block"));
      all("button", root).forEach(button => {
        if (!/^Imprimer$/i.test(txt(button))) return;
        if (button.closest(".me-timetable-cahier,#me-pedago-panels,.me-v89-sweep-panel,.me-sujet-pro-panel")) return;
        const block = closest(button, node => node !== root && !node.classList?.contains("me-page") && txt(node).length < 140, 6) || button;
        block.classList.add("me-planning-block");
      });
      all("div,section,article", root).forEach(node => {
        if (!/Lecture seule.*cahier de texte/i.test(txt(node))) return;
        if (node.closest("#me-pedago-panels")) return;
        node.classList.add("me-cahier-block");
      });
    };
    const applyPedagoVisibility = root => {
      const wrap = root.querySelector("#me-pedago-panels");
      const nav = root.querySelector(".me-pedago-tools") || document.getElementById("me-pedago-tools-persistent");
      if (!nav) return;
      markPlanningShell(root);
      placePedagoTools(root, nav);
      const target = nav.dataset.activeTool || "planning";
      all("[data-tool-target]", nav).forEach(button => button.classList.toggle("is-active", button.dataset.toolTarget === target));
      root.dataset.pedagoActive = target;
      const cahier = root.querySelector(".me-timetable-cahier");
      const sweepPanels = all(".me-v89-sweep-panel", root);
      const subjectPanels = all(".me-sujet-pro-panel", root);
      all(".me-planning-block,.me-timetable-title,.me-timetable-subtitle", root)
        .forEach(node => node.classList.toggle("is-hidden", target !== "planning"));
      all(".me-cahier-block", root).forEach(node => node.classList.toggle("is-hidden", target !== "cahier"));
      if (cahier) cahier.classList.toggle("is-hidden", target !== "cahier");
      sweepPanels.forEach(panel => panel.classList.toggle("is-hidden", target !== "balayage"));
      subjectPanels.forEach(panel => panel.classList.toggle("is-hidden", target !== "sujets"));
      if (wrap) {
        const showWrap = target === "balayage" || target === "sujets";
        wrap.classList.toggle("is-hidden", !showWrap);
      }
      if (target === "planning") {
        all(".me-timetable-toolbar,.me-timetable-days-grid,.me-timetable-day,.me-timetable-lock-banner", root)
          .forEach(node => node.classList.remove("is-hidden"));
      }
    };
    const ensurePedagoTools = root => {
      ensurePedagoStyle();
      all(".me-pedago-tools:not(#me-pedago-tools-persistent)", root).forEach(node => node.remove());
      const wrap = root.querySelector("#me-pedago-panels");
      let nav = document.getElementById("me-pedago-tools-persistent");
      if (nav) {
        nav.hidden = false;
        document.body.classList.add("me-pedago-tools-active");
        applyPedagoVisibility(root);
        return;
      }
      nav = el("div", "me-pedago-tools", `
        <div>
          <strong>Planning & outils pédagogiques</strong>
          <span>Choisissez une seule partie à afficher.</span>
        </div>
        <div class="me-pedago-tool-buttons">
          <button type="button" class="is-active" data-tool-target="planning">Emploi du temps</button>
          <button type="button" data-tool-target="cahier">Cahier de texte</button>
          <button type="button" data-tool-target="balayage">Liste de balayage</button>
          <button type="button" data-tool-target="sujets">Préparer un sujet</button>
        </div>
      `);
      nav.id = "me-pedago-tools-persistent";
      nav.classList.add("me-pedago-tools-host");
      nav.dataset.activeTool = localStorage.getItem("monecole_planning_tool_active") || "planning";
      document.body.appendChild(nav);
      document.body.classList.add("me-pedago-tools-active");
      const setActive = (target, shouldScroll = true) => {
        const currentRoot = page() || root;
        nav.dataset.activeTool = target;
        try {
          localStorage.setItem("monecole_planning_tool_active", target);
        } catch {}
        if (currentRoot) applyPedagoVisibility(currentRoot);
        if (!shouldScroll) return;
        const destination = target === "planning"
          ? currentRoot?.querySelector(".me-timetable-toolbar,.me-timetable-days-grid,.me-timetable-day") || currentRoot
          : target === "cahier"
            ? currentRoot?.querySelector(".me-timetable-cahier")
            : target === "balayage"
              ? currentRoot?.querySelector(".me-v89-sweep-panel")
              : currentRoot?.querySelector(".me-sujet-pro-panel");
        (destination || nav).scrollIntoView({ behavior: "smooth", block: "start" });
      };
      nav.onclick = event => {
        const button = event.target.closest("[data-tool-target]");
        if (!button) return;
        setActive(button.dataset.toolTarget);
      };
      setActive("planning", false);
    };
    const upgradeSweepPanel = root => {
      const panel = all(".me-pedago-panel", root).find(node => /Liste de balayage/i.test(txt(node)));
      if (!panel || panel.dataset.meV89Sweep === selectedClass(root)) return;
      const className = selectedClass(root);
      const students = scanStudents(className);
      const key = `${baseKey(root)}_balayage_annuel`;
      const oldKey = `${baseKey(root)}_balayage_journalier`;
      const current = {};
      DAYS.forEach(day => { current[day] = []; });
      const savedAnnual = read(key, null);
      const oldWeekly = read(oldKey, []);
      const seed = savedAnnual?.days || oldWeekly?.[0]?.days || {};
      DAYS.forEach(day => { current[day] = Array.isArray(seed?.[day]) ? [...seed[day]] : []; });
      const listId = `me-v89-students-${Date.now()}`;
      panel.dataset.meV89Sweep = className;
      panel.classList.add("me-v89-sweep-panel");
      panel.innerHTML = `
        <div class="me-sweep-head">
          <div>
            <h3>🧹 Liste annuelle de balayage</h3>
            <p>Établissez une seule liste pour toute l'année : les élèves de service du lundi, du mardi, du mercredi... Elle reste modifiable si la classe change.</p>
          </div>
          <button class="me-pedago-btn" data-sweep-print-all>Imprimer la fiche annuelle</button>
        </div>
        <div class="me-sweep-toolbar">
          <div class="me-sweep-status">
            <strong>Année scolaire ${escapeHtml(schoolYearLabel())}</strong>
            <span>La liste est conservée pour cette classe et peut être modifiée à tout moment.</span>
          </div>
          <button class="me-pedago-btn primary" data-sweep-save>Enregistrer la liste annuelle</button>
        </div>
        <datalist id="${listId}">${students.map(name => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>
        ${students.length ? "" : '<div class="me-sweep-note">Aucun élève détecté localement pour cette classe. La saisie reste possible manuellement.</div>'}
        <div class="me-sweep-grid">
          ${DAYS.map(day => `
            <article class="me-sweep-day" data-day="${day}">
              <header><strong>${day}</strong><span data-day-count>0 élève</span></header>
              <div class="me-sweep-picker">
                <input list="${listId}" data-student-search placeholder="Nom ou prénom de l'élève">
                <button type="button" data-add-student>Ajouter</button>
              </div>
              <div class="me-sweep-chips" data-sweep-chips></div>
            </article>
          `).join("")}
        </div>
        <div class="me-pedago-list" data-sweep-list></div>
      `;
      panel.querySelectorAll(".me-sweep-day").forEach(card => {
        const day = card.dataset.day;
        const input = card.querySelector("[data-student-search]");
        const add = () => {
          const name = input.value.trim();
          if (!name) return;
          if (!current[day].some(existing => norm(existing) === norm(name))) current[day].push(name);
          input.value = "";
          renderChips(card, current[day]);
        };
        card.querySelector("[data-add-student]").onclick = add;
        input.addEventListener("keydown", event => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        });
        renderChips(card, current[day]);
      });
      panel.querySelector("[data-sweep-save]").onclick = () => {
        write(key, { className, year: schoolYearLabel(), days: clone(current), updatedAt: new Date().toISOString() });
        renderAnnualSweep(panel, key, current);
        appMessage("Liste annuelle de balayage enregistrée pour cette classe.");
      };
      panel.querySelector("[data-sweep-print-all]").onclick = () => {
        printHtml("Liste annuelle de balayage", buildAnnualSweepPrint(className, current));
      };
      renderAnnualSweep(panel, key, current);
    };
    const permissionKey = () => `monecole_v89_timetable_policy_${schoolSlug()}`;
    const canEditTimetable = () => {
      const info = userInfo();
      if (isDirection(info)) return true;
      const policy = localStorage.getItem(permissionKey()) || "direction";
      if (policy === "direction_secretariat" && /SECRETAIRE/.test(info.role)) return true;
      if (policy === "direction_professeurs" && /PROFESSEUR/.test(info.role)) return true;
      return false;
    };
    const settingsPage = () => {
      const main = document.querySelector(".me-main") || document.body;
      const title = all("h1,h2,h3,strong", main).find(node => /^(Établissement|Etablissement|Paramètres|Parametres)\b/i.test(txt(node)));
      if (!title) return null;
      return closest(title, node => node.classList?.contains("me-page"), 12) || title.closest("section,main,div") || main;
    };
    const ensureSettingsPermission = () => {
      const root = settingsPage();
      const existing = document.querySelector(".me-timetable-settings-permission");
      const info = userInfo();
      if (!root || !isDirection(info)) {
        existing?.remove();
        return;
      }
      let box = root.querySelector(".me-timetable-settings-permission");
      if (!box) {
        box = el("section", "me-timetable-settings-permission", `
          <div>
            <strong>Autorisation de modification de l'emploi du temps</strong>
            <span>La direction choisit ici les profils autorisés à modifier l'emploi du temps. Ce réglage ne s'affiche plus dans Planning & outils.</span>
          </div>
          <select data-timetable-policy>
            <option value="direction">Direction uniquement</option>
            <option value="direction_secretariat">Direction + secrétariat</option>
            <option value="direction_professeurs">Direction + professeurs</option>
          </select>
        `);
        const anchor = all("h1,h2,h3", root).find(node => /^(Établissement|Etablissement|Paramètres|Parametres)\b/i.test(txt(node)));
        if (anchor?.parentElement) anchor.insertAdjacentElement("afterend", box);
        else root.insertBefore(box, root.firstElementChild);
      }
      const select = box.querySelector("[data-timetable-policy]");
      if (select && select.dataset.bound !== "1") {
        select.dataset.bound = "1";
        select.onchange = () => {
          localStorage.setItem(permissionKey(), select.value);
          appMessage("Autorisation de modification de l'emploi du temps enregistrée.");
        };
      }
      if (select) select.value = localStorage.getItem(permissionKey()) || "direction";
    };
    const applyTimetablePermissions = root => {
      const allowed = canEditTimetable();
      let box = root.querySelector(".me-timetable-permission");
      const toolbar = root.querySelector(".me-timetable-toolbar") || all("select", root)[0]?.parentElement || root.firstElementChild;
      if (box) box.remove();
      let notice = root.querySelector(".me-timetable-lock-banner");
      if (!allowed && !notice) {
        notice = el("div", "me-timetable-lock-banner", "Lecture seule : seuls la direction ou les profils autorisés peuvent modifier l'emploi du temps.");
        toolbar?.insertAdjacentElement("afterend", notice);
      }
      if (notice) notice.hidden = allowed;
      all("button", root).forEach(button => {
        const label = txt(button);
        const inTimetable = button.closest(".me-timetable-day,.me-timetable-course,.me-timetable-toolbar") || /^\+ Ajouter un cours$|^\+$|^Modifier$|^Supprimer$/i.test(label);
        const inPedago = button.closest("#me-pedago-panels,.me-timetable-cahier,.me-sujet-pro-panel");
        if (!inTimetable || inPedago) return;
        const lockable = /^\+ Ajouter un cours$|^\+$|^Modifier$|^Supprimer$/i.test(label);
        if (!lockable) return;
        button.classList.toggle("me-v89-readonly-action", !allowed);
        button.dataset.meV89TimetableLocked = allowed ? "0" : "1";
        button.title = allowed ? "" : "Modification réservée à la direction ou aux profils autorisés.";
      });
    };
    const addClickGuard = () => {
      if (document.body.dataset.meV89Guard === "1") return;
      document.body.dataset.meV89Guard = "1";
      document.body.addEventListener("click", event => {
        const button = event.target.closest("[data-me-v89-timetable-locked='1']");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        appMessage("Modification bloquée : l'emploi du temps est réservé à la direction ou aux profils autorisés.");
      }, true);
    };
    const enhanceSubjectHelp = () => {
      all("label").forEach(label => {
        if (!/Corrigé|barème|bareme/i.test(txt(label))) return;
        if (label.parentElement?.querySelector(".me-field-help")) return;
        label.insertAdjacentHTML("afterend", '<span class="me-field-help">Le corrigé/barème explique les réponses attendues, la répartition des points et les critères de correction. Il sert de guide privé au professeur.</span>');
      });
    };
    let pending = false;
    const enhance = () => {
      pending = false;
      ensureSettingsPermission();
      const root = page();
      if (!root) {
        const nav = document.getElementById("me-pedago-tools-persistent");
        if (nav) nav.hidden = true;
        document.body.classList.remove("me-pedago-tools-active");
        return;
      }
      renameTimetableLabels(root);
      improveDates(root);
      upgradeSweepPanel(root);
      applyTimetablePermissions(root);
      ensurePedagoTools(root);
      enhanceSubjectHelp();
      addClickGuard();
    };
    const schedule = () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(enhance);
      }
    };
    schedule();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("hashchange", schedule);
    window.addEventListener("resize", schedule);
  } catch (error) {
    console.warn("MonEcole pedagogie pro v90", error);
  }
})();
