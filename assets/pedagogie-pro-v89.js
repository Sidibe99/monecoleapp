(() => {
  try {
    const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const txt = node => String(node?.textContent || "").replace(/\s+/g, " ").trim();
    const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const el = (tag, className, html) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (html != null) node.innerHTML = html;
      return node;
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
      const title = all("h1,h2", main).find(node => /^Emploi du temps\b/i.test(txt(node)));
      return title ? closest(title, node => node.classList?.contains("me-page"), 12) || title.parentElement : null;
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
    const printHtml = (title, body) => {
      let zone = document.getElementById("me-print-zone");
      if (!zone) {
        zone = el("section");
        zone.id = "me-print-zone";
        document.body.appendChild(zone);
      }
      zone.innerHTML = `<h1>${escapeHtml(title)}</h1>${body}`;
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
    const renderSavedSweeps = (panel, key) => {
      const list = read(key, []);
      const target = panel.querySelector("[data-sweep-list]");
      target.innerHTML = list.length ? "" : '<div class="me-pedago-item"><small>Aucun planning de balayage enregistré.</small></div>';
      list.forEach((item, index) => {
        const rows = DAYS.map(day => `<li><b>${day}</b> : ${(item.days?.[day] || []).map(escapeHtml).join(", ") || "-"}</li>`).join("");
        const node = el("div", "me-pedago-item me-sweep-saved", `<strong>Semaine du ${escapeHtml(dateFr(item.weekStart) || item.weekStart || "")}</strong><ul>${rows}</ul><div class="me-pedago-actions"><button class="me-pedago-btn" data-print="${index}">Imprimer</button><button class="me-pedago-btn danger" data-del="${index}">Supprimer</button></div>`);
        target.appendChild(node);
      });
      target.onclick = event => {
        const print = event.target.closest("[data-print]");
        const del = event.target.closest("[data-del]");
        if (print) {
          const item = list[Number(print.dataset.print)];
          const rows = DAYS.map(day => `<tr><th>${escapeHtml(day)}</th><td>${(item.days?.[day] || []).map(escapeHtml).join(", ") || "-"}</td></tr>`).join("");
          printHtml(`Balayage - ${selectedClass(page())}`, `<table class="me-print-table"><tbody>${rows}</tbody></table>`);
        }
        if (del) {
          list.splice(Number(del.dataset.del), 1);
          write(key, list);
          renderSavedSweeps(panel, key);
        }
      };
    };
    const upgradeSweepPanel = root => {
      const panel = all(".me-pedago-panel", root).find(node => /Liste de balayage/i.test(txt(node)));
      if (!panel || panel.dataset.meV89Sweep === selectedClass(root)) return;
      const className = selectedClass(root);
      const students = scanStudents(className);
      const key = `${baseKey(root)}_balayage_journalier`;
      const current = {};
      DAYS.forEach(day => { current[day] = []; });
      const listId = `me-v89-students-${Date.now()}`;
      panel.dataset.meV89Sweep = className;
      panel.classList.add("me-v89-sweep-panel");
      panel.innerHTML = `
        <div class="me-sweep-head">
          <div>
            <h3>🧹 Balayage journalier de la classe</h3>
            <p>Préparez les élèves de service pour chaque jour : lundi, mardi, mercredi... Le professeur commence à saisir un nom et choisit parmi les élèves de la classe.</p>
          </div>
          <button class="me-pedago-btn" data-sweep-print-all>Imprimer tout</button>
        </div>
        <div class="me-sweep-toolbar">
          <label><span>Semaine du</span><input class="me-date-pro" data-sweep-week type="date"></label>
          <button class="me-pedago-btn primary" data-sweep-save>Enregistrer le planning</button>
        </div>
        <datalist id="${listId}">${students.map(name => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>
        ${students.length ? "" : '<div class="me-sweep-note">Aucun élève détecté localement pour cette classe. La saisie reste possible manuellement.</div>'}
        <div class="me-sweep-grid">
          ${DAYS.map(day => `
            <article class="me-sweep-day" data-day="${day}">
              <header><strong>${day}</strong><span data-day-count>0 élève</span></header>
              <div class="me-sweep-picker">
                <input list="${listId}" data-student-search placeholder="Commencez le nom ou prénom">
                <button type="button" data-add-student>Ajouter</button>
              </div>
              <div class="me-sweep-chips" data-sweep-chips></div>
            </article>
          `).join("")}
        </div>
        <div class="me-pedago-list" data-sweep-list></div>
      `;
      const weekInput = panel.querySelector("[data-sweep-week]");
      weekInput.value = new Date().toISOString().slice(0, 10);
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
        const saved = read(key, []);
        const weekStart = weekInput.value || new Date().toISOString().slice(0, 10);
        const item = { weekStart, days: structuredClone(current), updatedAt: new Date().toISOString() };
        const existing = saved.findIndex(entry => entry.weekStart === weekStart);
        if (existing >= 0) saved.splice(existing, 1, item);
        else saved.unshift(item);
        write(key, saved);
        renderSavedSweeps(panel, key);
      };
      panel.querySelector("[data-sweep-print-all]").onclick = () => {
        const rows = DAYS.map(day => `<tr><th>${escapeHtml(day)}</th><td>${current[day].map(escapeHtml).join(", ") || "-"}</td></tr>`).join("");
        printHtml(`Balayage - ${className}`, `<p>Semaine du ${escapeHtml(dateFr(weekInput.value))}</p><table class="me-print-table"><tbody>${rows}</tbody></table>`);
      };
      renderSavedSweeps(panel, key);
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
    const applyTimetablePermissions = root => {
      const allowed = canEditTimetable();
      const info = userInfo();
      let box = root.querySelector(".me-timetable-permission");
      const toolbar = root.querySelector(".me-timetable-toolbar") || all("select", root)[0]?.parentElement || root.firstElementChild;
      if (isDirection(info) && !box) {
        box = el("section", "me-timetable-permission", `
          <div><strong>Gestion de l'emploi du temps</strong><span>La direction garde le contrôle des modifications.</span></div>
          <select data-timetable-policy>
            <option value="direction">Direction uniquement</option>
            <option value="direction_secretariat">Direction + secrétariat</option>
            <option value="direction_professeurs">Direction + professeurs</option>
          </select>
        `);
        toolbar?.insertAdjacentElement("afterend", box);
        const select = box.querySelector("select");
        select.value = localStorage.getItem(permissionKey()) || "direction";
        select.onchange = () => {
          localStorage.setItem(permissionKey(), select.value);
          applyTimetablePermissions(root);
        };
      }
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
      const root = page();
      if (!root) return;
      improveDates(root);
      upgradeSweepPanel(root);
      applyTimetablePermissions(root);
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
    console.warn("MonEcole pedagogie pro v89", error);
  }
})();
