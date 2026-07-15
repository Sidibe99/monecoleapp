(() => {
  try {
    let planned = false;
    const timeRe = /\b\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}\b/;

    const text = node => String(node?.textContent || "").replace(/\s+/g, " ").trim();
    const lines = node => String(node?.innerText || node?.textContent || "")
      .split(/\n+/)
      .map(value => value.trim())
      .filter(Boolean);
    const all = (selector, root = document) => [...root.querySelectorAll(selector)];
    const make = (tag, className, html) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (html != null) node.innerHTML = html;
      return node;
    };
    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
    const lineBreaks = value => escapeHtml(value).replace(/\n/g, "<br>");
    const slug = value => String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "x";
    const readStore = (key, fallback) => {
      try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      } catch {
        return fallback;
      }
    };
    const writeStore = (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    };

    const toast = message => {
      let box = document.getElementById("me-sujet-pro-toast");
      if (!box) {
        box = make("div", "me-app-modal-backdrop");
        box.id = "me-sujet-pro-toast";
        box.innerHTML = `
          <div class="me-app-modal">
            <h3>MonEcole</h3>
            <p></p>
            <div class="me-app-modal-actions">
              <button class="me-pedago-btn primary">OK</button>
            </div>
          </div>`;
        document.body.appendChild(box);
        box.querySelector("button").onclick = () => box.remove();
      }
      box.querySelector("p").textContent = message;
    };

    const userInfo = () => {
      const side = all("aside,nav,div").find(node =>
        /Connecté/.test(text(node)) &&
        /ADMINISTRATEUR|PROFESSEUR|DIRECTEUR|COMPTABLE|SECRÉTAIRE|SECRETAIRE/i.test(text(node))
      );
      const value = text(side);
      const match = value.match(/Connecté\s+(.+?)\s+(ADMINISTRATEUR|PROFESSEUR|DIRECTEUR|COMPTABLE|SECRÉTAIRE|SECRETAIRE)/i) || [];
      return {
        name: (match[1] || "").trim(),
        role: (match[2] || "").toUpperCase()
      };
    };

    const schoolName = () => {
      const side = all("aside,nav,div").find(node => /MonEcole/.test(text(node)) && /Connecté/.test(text(node)));
      return text(side).slice(0, 120) || "MonEcole";
    };

    const timetablePage = () => {
      const main = document.querySelector(".me-main") || document.body;
      const title = all("h1,h2", main).find(node => /^Emploi du temps\b/i.test(text(node)));
      if (!title) return null;
      let page = title;
      for (let i = 0; page && i < 12; i += 1, page = page.parentElement) {
        if (page.classList?.contains("me-page")) return page;
      }
      return title.parentElement;
    };

    const selectedClass = page => {
      const select = page?.querySelector("select");
      return select?.options?.[select.selectedIndex]?.textContent?.trim() || "Classe";
    };

    const cleanSubject = value => String(value || "")
      .replace(/👨‍🏫|👩‍🏫|📍|Modifier|Supprimer/g, "")
      .split("·")[0]
      .trim();

    const subjectFromCourse = (course, user) => {
      const nameBits = String(user.name || "").toLowerCase().split(/\s+/).filter(Boolean);
      const usable = lines(course)
        .filter(line => !timeRe.test(line))
        .filter(line => !/^(Modifier|Supprimer|\+)$/.test(line))
        .filter(line => !/^Aucun cours$/i.test(line))
        .filter(line => {
          const low = line.toLowerCase();
          return !(nameBits.length && nameBits.every(bit => low.includes(bit)));
        });
      return cleanSubject(usable[0] || "");
    };

    const teacherSubjects = page => {
      const user = userInfo();
      if (user.role !== "PROFESSEUR") return [];
      const name = String(user.name || "").toLowerCase();
      const courses = all(".me-timetable-course", page).filter(course =>
        name && String(course.innerText || course.textContent || "").toLowerCase().includes(name)
      );
      return [...new Set(courses.map(course => subjectFromCourse(course, user)).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "fr"));
    };

    const keyFor = (className, user) =>
      `monecole_sujets_prof_${slug(schoolName())}_${slug(className)}_${slug(user.name || "prof")}`;

    const printDocument = html => {
      let zone = document.getElementById("me-print-zone");
      if (!zone) {
        zone = make("section");
        zone.id = "me-print-zone";
        document.body.appendChild(zone);
      }
      zone.innerHTML = html;
      document.body.classList.add("me-print-pedago");
      setTimeout(() => {
        window.print();
        setTimeout(() => document.body.classList.remove("me-print-pedago"), 250);
      }, 60);
    };

    const buildPrint = (item, className, user) => `
      <div class="me-sujet-print">
        <div class="me-sujet-print-top">
          <div><strong>MonEcole</strong><br>${escapeHtml(schoolName())}</div>
          <div><strong>${escapeHtml(item.type)}</strong><br>${escapeHtml(item.date || "")}</div>
        </div>
        <h1>${escapeHtml(item.titre || item.type)}</h1>
        <div class="me-sujet-print-meta">
          <span>Classe : <b>${escapeHtml(className)}</b></span>
          <span>Matière : <b>${escapeHtml(item.matiere)}</b></span>
          <span>Professeur : <b>${escapeHtml(user.name || "")}</b></span>
        </div>
        <h2>Consignes et questions</h2>
        <div class="me-sujet-print-box">${lineBreaks(item.contenu || "")}</div>
        ${item.correction ? `
          <h2 class="me-sujet-correction-title">Corrigé / barème</h2>
          <div class="me-sujet-print-box me-sujet-correction">${lineBreaks(item.correction)}</div>
        ` : ""}
      </div>`;

    const formData = panel => ({
      type: panel.querySelector("[data-pro-type]")?.value || "Évaluation",
      matiere: panel.querySelector("[data-pro-matiere]")?.value || "",
      titre: panel.querySelector("[data-pro-titre]")?.value.trim() || "",
      date: panel.querySelector("[data-pro-date]")?.value.trim() || "",
      contenu: panel.querySelector("[data-pro-contenu]")?.value.trim() || "",
      correction: panel.querySelector("[data-pro-correction]")?.value.trim() || ""
    });

    const clearForm = panel => {
      delete panel.dataset.editIndex;
      all("input,textarea", panel).forEach(node => {
        node.value = "";
      });
      const button = panel.querySelector("[data-pro-save]");
      if (button) button.textContent = "Enregistrer le sujet";
    };

    const fillForm = (panel, item, index) => {
      panel.querySelector("[data-pro-type]").value = item.type || "Évaluation";
      panel.querySelector("[data-pro-matiere]").value = item.matiere || panel.querySelector("[data-pro-matiere] option")?.value || "";
      panel.querySelector("[data-pro-titre]").value = item.titre || "";
      panel.querySelector("[data-pro-date]").value = item.date || "";
      panel.querySelector("[data-pro-contenu]").value = item.contenu || "";
      panel.querySelector("[data-pro-correction]").value = item.correction || "";
      panel.dataset.editIndex = String(index);
      const button = panel.querySelector("[data-pro-save]");
      if (button) button.textContent = "Enregistrer la modification";
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const renderList = (panel, className) => {
      const user = userInfo();
      const key = keyFor(className, user);
      const ownerKey = slug(user.name || "prof");
      const list = readStore(key, []).filter(item => item && item.ownerKey === ownerKey);
      const target = panel.querySelector(".me-sujet-pro-list");
      if (!target) return;

      target.innerHTML = list.length ? "" : `
        <div class="me-sujet-empty">
          <strong>Aucun sujet personnel pour cette classe.</strong>
          <span>Choisissez une matière, rédigez le sujet, puis enregistrez-le. Les autres professeurs ne le verront pas ici.</span>
        </div>`;

      list.forEach((item, index) => {
        const card = make("article", "me-sujet-pro-card");
        const preview = String(item.contenu || "").slice(0, 170);
        card.innerHTML = `
          <div class="me-sujet-pro-card-main">
            <div class="me-sujet-pro-card-title">
              <span>${escapeHtml(item.type || "Évaluation")}</span>
              <strong>${escapeHtml(item.titre || "Sujet sans titre")}</strong>
            </div>
            <div class="me-sujet-pro-meta">
              <span>${escapeHtml(item.matiere || "Matière")}</span>
              <span>${escapeHtml(item.date || "Date non précisée")}</span>
              <span>${escapeHtml(user.name || "Professeur")}</span>
            </div>
            <p>${escapeHtml(preview)}${String(item.contenu || "").length > 170 ? "..." : ""}</p>
          </div>
          <div class="me-sujet-pro-actions">
            <button type="button" class="me-pedago-btn" data-pro-edit="${index}">Modifier</button>
            <button type="button" class="me-pedago-btn" data-pro-print="${index}">Imprimer</button>
            <button type="button" class="me-pedago-btn danger" data-pro-del="${index}">Supprimer</button>
          </div>`;
        target.appendChild(card);
      });

      target.onclick = event => {
        const edit = event.target.closest("[data-pro-edit]");
        const print = event.target.closest("[data-pro-print]");
        const del = event.target.closest("[data-pro-del]");
        if (edit) fillForm(panel, list[Number(edit.dataset.proEdit)], Number(edit.dataset.proEdit));
        if (print) printDocument(buildPrint(list[Number(print.dataset.proPrint)], className, user));
        if (del) {
          list.splice(Number(del.dataset.proDel), 1);
          writeStore(key, list);
          renderList(panel, className);
          toast("Sujet supprimé de votre espace professeur.");
        }
      };
    };

    const renderPanel = (panel, page) => {
      const user = userInfo();
      const className = selectedClass(page);
      const subjects = teacherSubjects(page);
      const isTeacher = user.role === "PROFESSEUR";
      const locked = !isTeacher;
      const noSubject = isTeacher && !subjects.length;

      panel.classList.add("me-sujet-pro-panel");
      panel.dataset.meSujetsPro = "1";
      panel.dataset.meSujetsClass = className;
      panel.dataset.meSujetsUser = slug(user.name || "");

      const subjectOptions = subjects.map(subject =>
        `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`
      ).join("");

      panel.innerHTML = `
        <div class="me-sujet-pro-head">
          <div>
            <span class="me-sujet-kicker">Espace professeur</span>
            <h3>Préparer un sujet</h3>
            <p>Évaluations, compositions, tests et devoirs prêts à imprimer. Chaque professeur ne voit que ses propres sujets.</p>
          </div>
          <div class="me-sujet-pro-badge">${escapeHtml(className)}</div>
        </div>
        ${locked ? '<div class="me-sujet-pro-alert">Accès en lecture : la préparation des sujets est réservée aux comptes professeurs.</div>' : ""}
        ${noSubject ? '<div class="me-sujet-pro-alert">Aucune matière attribuée à votre nom dans l’emploi du temps de cette classe. Ajoutez d’abord votre cours ou choisissez la bonne classe.</div>' : ""}
        <div class="me-sujet-pro-form ${locked || noSubject ? "is-disabled" : ""}">
          <div class="me-pedago-grid">
            <div class="me-pedago-field">
              <label>Type de sujet</label>
              <select data-pro-type ${locked || noSubject ? "disabled" : ""}>
                <option>Évaluation</option>
                <option>Composition</option>
                <option>Test</option>
                <option>Devoir maison</option>
                <option>Interrogation</option>
              </select>
            </div>
            <div class="me-pedago-field">
              <label>Matière attribuée</label>
              <select data-pro-matiere ${locked || noSubject ? "disabled" : ""}>
                ${subjectOptions || '<option value="">Aucune matière disponible</option>'}
              </select>
            </div>
            <div class="me-pedago-field">
              <label>Titre</label>
              <input data-pro-titre ${locked || noSubject ? "disabled" : ""} placeholder="Ex : Les fractions">
            </div>
            <div class="me-pedago-field">
              <label>Date</label>
              <input data-pro-date ${locked || noSubject ? "disabled" : ""} placeholder="JJ/MM/AAAA">
            </div>
            <div class="me-pedago-field me-sujet-full">
              <label>Consignes et questions</label>
              <textarea data-pro-contenu ${locked || noSubject ? "disabled" : ""} placeholder="Rédigez les consignes, questions, exercices et points à traiter..."></textarea>
            </div>
            <div class="me-pedago-field me-sujet-full">
              <label>Corrigé / barème privé</label>
              <textarea data-pro-correction ${locked || noSubject ? "disabled" : ""} placeholder="Facultatif : corrigé, barème, réponses attendues..."></textarea>
            </div>
          </div>
          <div class="me-sujet-pro-toolbar">
            <button type="button" class="me-pedago-btn primary" data-pro-save ${locked || noSubject ? "disabled" : ""}>Enregistrer le sujet</button>
            <button type="button" class="me-pedago-btn" data-pro-clear ${locked || noSubject ? "disabled" : ""}>Vider</button>
            <span>${isTeacher ? `Connecté : ${escapeHtml(user.name || "Professeur")}` : "Compte non professeur"}</span>
          </div>
        </div>
        <div class="me-sujet-pro-list"></div>`;

      const saveButton = panel.querySelector("[data-pro-save]");
      const clearButton = panel.querySelector("[data-pro-clear]");

      if (saveButton) {
        saveButton.onclick = () => {
          if (locked || noSubject) {
            toast("Action réservée au professeur concerné.");
            return;
          }
          const item = formData(panel);
          if (!item.matiere) {
            toast("Choisissez une matière attribuée.");
            return;
          }
          if (!item.contenu) {
            toast("Rédigez d'abord les consignes et questions du sujet.");
            return;
          }

          const key = keyFor(className, user);
          const ownerKey = slug(user.name || "prof");
          const list = readStore(key, []).filter(saved => saved && saved.ownerKey === ownerKey);
          const clean = {
            ...item,
            owner: user.name || "",
            ownerKey,
            classe: className,
            updatedAt: new Date().toISOString()
          };
          const editIndex = panel.dataset.editIndex;
          if (editIndex != null && list[Number(editIndex)]) {
            list[Number(editIndex)] = { ...list[Number(editIndex)], ...clean };
          } else {
            list.unshift({ ...clean, createdAt: new Date().toISOString() });
          }
          writeStore(key, list);
          clearForm(panel);
          renderList(panel, className);
          toast(editIndex != null ? "Sujet modifié." : "Sujet enregistré dans votre espace professeur.");
        };
      }

      if (clearButton) clearButton.onclick = () => clearForm(panel);
      renderList(panel, className);
    };

    const enhance = () => {
      planned = false;
      const currentPage = timetablePage();
      if (!currentPage) return;
      const panel = all(".me-pedago-panel", currentPage).find(node =>
        /Sujets d['’]évaluation|Préparer un sujet|composition ou test/i.test(text(node))
      );
      if (!panel) return;

      const user = userInfo();
      const className = selectedClass(currentPage);
      if (
        panel.dataset.meSujetsPro === "1" &&
        panel.dataset.meSujetsClass === className &&
        panel.dataset.meSujetsUser === slug(user.name || "")
      ) {
        renderList(panel, className);
        return;
      }
      renderPanel(panel, currentPage);
    };

    const schedule = () => {
      if (!planned) {
        planned = true;
        requestAnimationFrame(enhance);
      }
    };

    schedule();
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    window.addEventListener("hashchange", schedule);
    window.addEventListener("resize", schedule);
  } catch (error) {
    console.warn("MonEcole sujets professeurs", error);
  }
})();
