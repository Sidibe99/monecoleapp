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
    const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
    const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
    const userInfo = () => {
      const sidebar = all("aside,nav,div").find(node => /Connecté/.test(txt(node)) && /ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE/i.test(txt(node)));
      const body = txt(sidebar);
      const role = (body.match(/(ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE)/i) || [])[1] || "";
      const name = (body.match(/Connecté\s+(.+?)\s+(ADMINISTRATEUR|DIRECTEUR|PROFESSEUR|SECRÉTAIRE|SECRETAIRE)/i) || [])[1] || "";
      return { name: name.trim(), role: role.toUpperCase().replace("É", "E") };
    };
    const isDirection = info => /ADMINISTRATEUR|DIRECTEUR/.test(info.role);
    const schoolSlug = () => {
      const sidebar = all("aside,nav,div").find(node => /MonEcole/.test(txt(node)) && /Connecté/.test(txt(node)));
      return norm(txt(sidebar).slice(0, 140) || "MonEcole").replace(/\W+/g, "_");
    };
    const stateKey = () => `monecole_v101_planning_${schoolSlug()}`;
    const permissionKey = () => `monecole_v101_timetable_policy_${schoolSlug()}`;
    const defaultState = () => ({
      active: "planning",
      selectedClass: "Classe",
      editingCourseId: "",
      courses: [],
      cahiers: [],
      sweep: {},
      subjects: []
    });
    const getState = () => ({ ...defaultState(), ...read(stateKey(), defaultState()) });
    const setState = state => write(stateKey(), state);
    const dateFr = value => {
      const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || "");
    };
    const schoolYearLabel = () => {
      const now = new Date();
      const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      return `${start}-${start + 1}`;
    };
    const canEditTimetable = () => {
      const info = userInfo();
      if (isDirection(info)) return true;
      const policy = localStorage.getItem(permissionKey()) || "direction";
      if (policy === "direction_secretariat" && /SECRETAIRE/.test(info.role)) return true;
      if (policy === "direction_professeurs" && /PROFESSEUR/.test(info.role)) return true;
      return false;
    };
    const canEditLesson = course => {
      const info = userInfo();
      return /PROFESSEUR/.test(info.role) && course?.professor && norm(course.professor) === norm(info.name);
    };
    const canSeeSubject = item => {
      const info = userInfo();
      if (!/PROFESSEUR/.test(info.role)) return true;
      return !item.teacher || norm(item.teacher) === norm(info.name);
    };
    const planningNavText = node => /Planning\s*&\s*outils|Planning scolaire|Emploi du temps/i.test(txt(node));
    const dashboardText = node => /Tableau de bord/i.test(txt(node));
    const navLooksActive = node => {
      if (!node) return false;
      if (node.getAttribute("aria-current") === "page" || node.dataset.active === "true") return true;
      if (/\b(active|selected|current)\b/i.test(node.className || "")) return true;
      try {
        const style = getComputedStyle(node);
        const paint = `${style.backgroundImage || ""} ${style.backgroundColor || ""}`;
        return /linear-gradient|rgb\(37,\s*99,\s*235\)|rgb\(26,\s*86,\s*219\)|rgb\(30,\s*64,\s*175\)|rgb\(29,\s*78,\s*216\)/i.test(paint);
      } catch {
        return false;
      }
    };
    const sidebarPlanningActive = () => {
      const items = all("aside button,aside a,nav button,nav a,[role='button']", document.body)
        .filter(node => planningNavText(node) || dashboardText(node));
      const active = items.find(navLooksActive);
      return Boolean(active && planningNavText(active) && !dashboardText(active));
    };
    const mainArea = () => document.querySelector(".me-main") || document.body;
    const dashboardVisible = main => all("h1,h2", main).some(node => /^Tableau de bord\b/i.test(txt(node)));
    const nativePlanningVisible = main => /Note d’aide\s+—\s+Emploi du temps|Planifiez les cours par classe|Gestion de l'emploi du temps/i.test(txt(main));
    const shouldOwnPlanning = () => {
      const main = mainArea();
      if (dashboardVisible(main)) return false;
      return sidebarPlanningActive() || nativePlanningVisible(main);
    };
    const planningRoot = () => {
      const main = mainArea();
      return main.querySelector(".me-page") || main;
    };
    const cleanupPlanning = () => {
      all(".me-v101-planning-page", document.body).forEach(node => node.remove());
      all("[data-me-v101-owned='1']", document.body).forEach(node => {
        node.hidden = false;
        node.removeAttribute("data-me-v101-owned");
      });
    };
    const ensureStyle = () => {
      if (document.getElementById("me-planning-v101-style")) return;
      const style = el("style");
      style.id = "me-planning-v101-style";
      style.textContent = `
        .me-v101-planning-page{width:100%;max-width:none;margin:0;color:#0f172a}
        .me-v101-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:0 0 18px;padding:22px;border:1px solid #bfdbfe;border-radius:18px;background:linear-gradient(135deg,#eff6ff,#fff);box-shadow:0 16px 42px rgba(15,23,42,.08)}
        .me-v101-title h1{margin:0;color:#0f172a;font-size:clamp(25px,2.4vw,36px);line-height:1.08;font-weight:950;letter-spacing:0}
        .me-v101-title p{margin:7px 0 0;color:#64748b;font-weight:750;line-height:1.45}
        .me-v101-status{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
        .me-v101-pill{border:1px solid #dbeafe;background:#fff;color:#1e40af;border-radius:999px;padding:8px 11px;font-weight:900;font-size:12px;white-space:nowrap}
        .me-v101-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px;padding:12px;border:1px solid #dbeafe;border-radius:16px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.06)}
        .me-v101-tabs button{min-height:46px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:0 18px;font:inherit;font-weight:950;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.05)}
        .me-v101-tabs button.is-active{border-color:#1d4ed8;background:#1d4ed8;color:#fff;box-shadow:0 12px 26px rgba(37,99,235,.22)}
        .me-v101-panel{display:none}
        .me-v101-panel.is-active{display:block}
        .me-v101-card{border:1px solid #dbeafe;border-radius:16px;background:#fff;padding:18px;margin:0 0 18px;box-shadow:0 14px 36px rgba(15,23,42,.07)}
        .me-v101-card h2,.me-v101-card h3{margin:0 0 8px;color:#0f172a;font-weight:950;letter-spacing:0}
        .me-v101-card p{margin:0 0 14px;color:#64748b;font-weight:700;line-height:1.5}
        .me-v101-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:end}
        .me-v101-field{display:flex;flex-direction:column;gap:6px}
        .me-v101-field.full{grid-column:1/-1}
        .me-v101-field label{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:950}
        .me-v101-field input,.me-v101-field select,.me-v101-field textarea{width:100%;min-height:44px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#0f172a;font:inherit;font-weight:750;padding:10px 12px;outline:none;box-sizing:border-box}
        .me-v101-field textarea{min-height:122px;resize:vertical;line-height:1.5}
        .me-v101-field input:focus,.me-v101-field select:focus,.me-v101-field textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
        .me-v101-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}
        .me-v101-btn{min-height:44px;border:1px solid #dbe3ef;background:#fff;color:#1d4ed8;border-radius:12px;padding:0 14px;font:inherit;font-weight:950;cursor:pointer}
        .me-v101-btn.primary{border-color:#1d4ed8;background:#1d4ed8;color:#fff;box-shadow:0 10px 22px rgba(37,99,235,.22)}
        .me-v101-btn.danger{border-color:#fecaca;background:#fff1f2;color:#dc2626}
        .me-v101-btn:disabled{opacity:.45;cursor:not-allowed}
        .me-v101-days{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}
        .me-v101-day{min-width:0;border:1px solid #dbeafe;border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 12px 30px rgba(15,23,42,.06)}
        .me-v101-day header{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#1d4ed8;color:#fff;padding:13px 15px}
        .me-v101-day header strong{font-size:18px;font-weight:950}
        .me-v101-count{background:rgba(255,255,255,.18);border-radius:999px;padding:5px 9px;font-weight:950;font-size:12px}
        .me-v101-day-body{min-height:165px;padding:14px;background:linear-gradient(135deg,#fff,#f8fbff)}
        .me-v101-course,.me-v101-item{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:12px;margin:0 0 10px}
        .me-v101-course strong,.me-v101-item strong{display:block;color:#0f172a;font-weight:950}
        .me-v101-course small,.me-v101-item small{display:block;color:#64748b;font-weight:750;line-height:1.45;margin-top:4px}
        .me-v101-empty{display:grid;place-items:center;min-height:120px;color:#94a3b8;font-weight:850;text-align:center}
        .me-v101-lock{border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:14px;padding:13px 14px;font-weight:900;margin:0 0 16px}
        .me-v101-ok{border-color:#bbf7d0;background:#f0fdf4;color:#166534}
        .me-v101-sweep-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
        .me-v101-chipbox{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .me-v101-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #bbf7d0;background:#ecfdf5;color:#047857;border-radius:999px;padding:8px 10px;font-weight:900}
        .me-v101-chip button{border:0;background:#d1fae5;color:#047857;border-radius:50%;width:22px;height:22px;cursor:pointer;font-weight:950}
        .me-v101-print{display:none}
        @media (max-width:1120px){.me-v101-days,.me-v101-sweep-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.me-v101-form{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width:760px){.me-v101-head{flex-direction:column;padding:16px}.me-v101-status{justify-content:flex-start}.me-v101-tabs{display:grid;grid-template-columns:1fr}.me-v101-tabs button{width:100%}.me-v101-days,.me-v101-sweep-grid,.me-v101-form{grid-template-columns:1fr}.me-v101-card{padding:15px}}
        @media print{body *{visibility:hidden!important}.me-v101-print,.me-v101-print *{visibility:visible!important}.me-v101-print{display:block!important;position:absolute;inset:0;padding:28px;background:#fff;color:#111;font-family:Arial,sans-serif}.me-v101-print table{width:100%;border-collapse:collapse}.me-v101-print th,.me-v101-print td{border:1px solid #94a3b8;padding:8px;text-align:left;vertical-align:top}}
      `;
      document.head.appendChild(style);
    };
    const classList = state => {
      const set = new Set([state.selectedClass || "Classe"]);
      state.courses.forEach(course => course.className && set.add(course.className));
      state.cahiers.forEach(item => item.className && set.add(item.className));
      return Array.from(set).filter(Boolean);
    };
    const coursesForClass = state => state.courses.filter(course => norm(course.className) === norm(state.selectedClass));
    const appMessage = message => {
      let box = document.getElementById("me-v101-message");
      if (!box) {
        box = el("div", "me-v101-message");
        box.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;background:#0f172a;color:#fff;border-radius:999px;padding:11px 16px;font-weight:900;box-shadow:0 14px 38px rgba(15,23,42,.25)";
        document.body.appendChild(box);
      }
      box.textContent = message;
      clearTimeout(box._timer);
      box._timer = setTimeout(() => box.remove(), 2600);
    };
    const printHtml = (title, body) => {
      let zone = document.getElementById("me-v101-print");
      if (!zone) {
        zone = el("section", "me-v101-print");
        zone.id = "me-v101-print";
        document.body.appendChild(zone);
      }
      zone.innerHTML = `<h1>${escapeHtml(title)}</h1>${body}`;
      setTimeout(() => window.print(), 50);
    };
    const courseOptions = state => coursesForClass(state)
      .map(course => `<option value="${escapeHtml(course.id)}">${escapeHtml(`${course.day} ${course.start || ""}-${course.end || ""} · ${course.subject || "Cours"} · ${course.professor || "Professeur"}`)}</option>`)
      .join("");
    const renderPlanningPanel = state => {
      const allowed = canEditTimetable();
      const editing = state.courses.find(course => course.id === state.editingCourseId);
      const courses = coursesForClass(state);
      return `
        ${allowed ? "" : '<div class="me-v101-lock">Lecture seule : seuls la direction ou les profils autorisés dans Établissement peuvent modifier l’emploi du temps.</div>'}
        <section class="me-v101-card">
          <h2>Emploi du temps</h2>
          <p>Planifiez les cours par classe, jour, horaire, matière, professeur et salle.</p>
          <div class="me-v101-form">
            <div class="me-v101-field"><label>Classe</label><input data-course-class value="${escapeHtml(editing?.className || state.selectedClass)}" placeholder="Ex : 6e A"></div>
            <div class="me-v101-field"><label>Jour</label><select data-course-day>${DAYS.map(day => `<option ${editing?.day === day ? "selected" : ""}>${day}</option>`).join("")}</select></div>
            <div class="me-v101-field"><label>Début</label><input data-course-start type="time" value="${escapeHtml(editing?.start || "08:00")}"></div>
            <div class="me-v101-field"><label>Fin</label><input data-course-end type="time" value="${escapeHtml(editing?.end || "09:00")}"></div>
            <div class="me-v101-field"><label>Matière</label><input data-course-subject value="${escapeHtml(editing?.subject || "")}" placeholder="Ex : Mathématiques"></div>
            <div class="me-v101-field"><label>Professeur</label><input data-course-professor value="${escapeHtml(editing?.professor || "")}" placeholder="Nom du professeur"></div>
            <div class="me-v101-field"><label>Salle</label><input data-course-room value="${escapeHtml(editing?.room || "")}" placeholder="Ex : Salle 2"></div>
            <div class="me-v101-field"><label>Note</label><input data-course-note value="${escapeHtml(editing?.note || "")}" placeholder="Optionnel"></div>
          </div>
          <div class="me-v101-actions">
            <button class="me-v101-btn primary" data-save-course ${allowed ? "" : "disabled"}>${editing ? "Mettre à jour le cours" : "Ajouter le cours"}</button>
            ${editing ? '<button class="me-v101-btn" data-cancel-edit>Annuler</button>' : ""}
          </div>
        </section>
        <section class="me-v101-days">
          ${DAYS.map(day => {
            const dayCourses = courses.filter(course => course.day === day).sort((a, b) => String(a.start).localeCompare(String(b.start)));
            return `
              <article class="me-v101-day">
                <header><strong>${day}</strong><span class="me-v101-count">${dayCourses.length} cours</span></header>
                <div class="me-v101-day-body">
                  ${dayCourses.length ? dayCourses.map(course => `
                    <div class="me-v101-course">
                      <strong>${escapeHtml(course.start || "")} - ${escapeHtml(course.end || "")} · ${escapeHtml(course.subject || "Cours")}</strong>
                      <small>${escapeHtml(course.professor || "Professeur non indiqué")} · ${escapeHtml(course.room || "Salle non indiquée")}${course.note ? ` · ${escapeHtml(course.note)}` : ""}</small>
                      <div class="me-v101-actions">
                        <button class="me-v101-btn" data-edit-course="${escapeHtml(course.id)}" ${allowed ? "" : "disabled"}>Modifier</button>
                        <button class="me-v101-btn danger" data-delete-course="${escapeHtml(course.id)}" ${allowed ? "" : "disabled"}>Supprimer</button>
                      </div>
                    </div>
                  `).join("") : '<div class="me-v101-empty">Aucun cours</div>'}
                </div>
              </article>
            `;
          }).join("")}
        </section>
      `;
    };
    const renderCahierPanel = state => {
      const courses = coursesForClass(state);
      const selectedCourse = courses[0];
      const entries = state.cahiers.filter(item => norm(item.className) === norm(state.selectedClass));
      const allowed = selectedCourse ? canEditLesson(selectedCourse) : false;
      return `
        <div class="me-v101-lock ${allowed ? "me-v101-ok" : ""}">${allowed ? "Professeur programmé détecté : saisie autorisée pour ce cours." : "Lecture seule : seul le professeur programmé sur le cours peut saisir, modifier ou supprimer le cahier de texte."}</div>
        <section class="me-v101-card">
          <h2>Cahier de texte</h2>
          <p>Les leçons restent séparées de l’emploi du temps. Chaque saisie est rattachée à un cours programmé.</p>
          <div class="me-v101-form">
            <div class="me-v101-field"><label>Cours</label><select data-lesson-course>${courseOptions(state) || '<option value="">Aucun cours programmé</option>'}</select></div>
            <div class="me-v101-field"><label>Date</label><input data-lesson-date type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="me-v101-field full"><label>Leçon / contenu enseigné</label><textarea data-lesson-content placeholder="Résumé de la leçon..."></textarea></div>
            <div class="me-v101-field full"><label>Travail à faire</label><textarea data-lesson-homework placeholder="Exercices, lecture, devoirs..."></textarea></div>
          </div>
          <div class="me-v101-actions">
            <button class="me-v101-btn primary" data-save-lesson ${allowed ? "" : "disabled"}>Enregistrer la leçon</button>
          </div>
        </section>
        <section class="me-v101-card">
          <h3>Leçons enregistrées</h3>
          ${entries.length ? entries.map(item => `
            <div class="me-v101-item">
              <strong>${escapeHtml(dateFr(item.date))} · ${escapeHtml(item.courseLabel || "Cours")}</strong>
              <small>${escapeHtml(item.content || "").replace(/\n/g, "<br>")}</small>
              ${item.homework ? `<small><b>Travail :</b> ${escapeHtml(item.homework).replace(/\n/g, "<br>")}</small>` : ""}
              <div class="me-v101-actions"><button class="me-v101-btn danger" data-delete-lesson="${escapeHtml(item.id)}" ${canEditLesson(state.courses.find(course => course.id === item.courseId)) ? "" : "disabled"}>Supprimer</button></div>
            </div>
          `).join("") : '<div class="me-v101-empty">Aucune leçon enregistrée pour cette classe.</div>'}
        </section>
      `;
    };
    const renderSweepPanel = state => {
      const current = state.sweep[state.selectedClass] || {};
      DAYS.forEach(day => { if (!Array.isArray(current[day])) current[day] = []; });
      return `
        <section class="me-v101-card">
          <h2>Liste annuelle de balayage</h2>
          <p>Une liste par classe pour toute l’année scolaire ${escapeHtml(schoolYearLabel())}. Elle reste modifiable à tout moment.</p>
          <div class="me-v101-actions"><button class="me-v101-btn" data-print-sweep>Imprimer la fiche annuelle</button></div>
        </section>
        <section class="me-v101-sweep-grid">
          ${DAYS.map(day => `
            <article class="me-v101-day" data-sweep-day="${day}">
              <header><strong>${day}</strong><span class="me-v101-count">${current[day].length} élève${current[day].length > 1 ? "s" : ""}</span></header>
              <div class="me-v101-day-body">
                <div class="me-v101-form" style="grid-template-columns:minmax(0,1fr) auto">
                  <div class="me-v101-field"><label>Élève</label><input data-sweep-name placeholder="Nom ou prénom"></div>
                  <button class="me-v101-btn primary" data-add-sweep="${day}">Ajouter</button>
                </div>
                <div class="me-v101-chipbox">
                  ${current[day].length ? current[day].map((name, index) => `<span class="me-v101-chip">${escapeHtml(name)} <button data-remove-sweep="${day}" data-index="${index}">×</button></span>`).join("") : '<span class="me-v101-empty">Aucun élève choisi.</span>'}
                </div>
              </div>
            </article>
          `).join("")}
        </section>
      `;
    };
    const renderSubjectsPanel = state => {
      const info = userInfo();
      const subjects = state.subjects.filter(canSeeSubject);
      return `
        <section class="me-v101-card">
          <h2>Préparer un sujet</h2>
          <p>Chaque professeur prépare ses sujets et retrouve uniquement ses documents quand il est connecté.</p>
          <div class="me-v101-form">
            <div class="me-v101-field"><label>Type</label><select data-subject-type><option>Evaluation</option><option>Composition</option><option>Test</option><option>Devoir maison</option></select></div>
            <div class="me-v101-field"><label>Matière</label><input data-subject-matter placeholder="Ex : Sciences"></div>
            <div class="me-v101-field"><label>Titre</label><input data-subject-title placeholder="Ex : Les fractions"></div>
            <div class="me-v101-field"><label>Date</label><input data-subject-date type="date"></div>
            <div class="me-v101-field full"><label>Consignes et questions</label><textarea data-subject-content placeholder="Rédigez le sujet à imprimer..."></textarea></div>
            <div class="me-v101-field full"><label>Corrigé / barème facultatif</label><textarea data-subject-correction placeholder="Corrigé réservé au professeur..."></textarea></div>
          </div>
          <div class="me-v101-actions"><button class="me-v101-btn primary" data-save-subject>Enregistrer le sujet</button></div>
        </section>
        <section class="me-v101-card">
          <h3>Sujets préparés</h3>
          ${subjects.length ? subjects.map(item => `
            <div class="me-v101-item">
              <strong>${escapeHtml(item.type)} · ${escapeHtml(item.title || "Sujet sans titre")}</strong>
              <small>${escapeHtml(item.matter || "Matière")} · ${escapeHtml(dateFr(item.date) || "")} · ${escapeHtml(item.teacher || info.name || "Professeur")}</small>
              <div class="me-v101-actions">
                <button class="me-v101-btn" data-print-subject="${escapeHtml(item.id)}">Imprimer</button>
                <button class="me-v101-btn danger" data-delete-subject="${escapeHtml(item.id)}">Supprimer</button>
              </div>
            </div>
          `).join("") : '<div class="me-v101-empty">Aucun sujet préparé pour le moment.</div>'}
        </section>
      `;
    };
    const renderApp = root => {
      ensureStyle();
      const state = getState();
      if (!DAYS.includes(state.active) && !["planning", "cahier", "balayage", "sujets"].includes(state.active)) state.active = "planning";
      const classes = classList(state);
      root.innerHTML = `
        <section class="me-v101-planning-page">
          <div class="me-v101-head">
            <div class="me-v101-title">
              <h1>Planning & outils pédagogiques</h1>
              <p>Une page propre pour gérer séparément l’emploi du temps, le cahier de texte, le balayage annuel et la préparation des sujets.</p>
            </div>
            <div class="me-v101-status">
              <span class="me-v101-pill">${escapeHtml(userInfo().role || "UTILISATEUR")}</span>
              <span class="me-v101-pill">${canEditTimetable() ? "Planning modifiable" : "Planning lecture seule"}</span>
            </div>
          </div>
          <div class="me-v101-tabs" role="tablist">
            <button class="${state.active === "planning" ? "is-active" : ""}" data-tab="planning">Emploi du temps</button>
            <button class="${state.active === "cahier" ? "is-active" : ""}" data-tab="cahier">Cahier de texte</button>
            <button class="${state.active === "balayage" ? "is-active" : ""}" data-tab="balayage">Liste de balayage</button>
            <button class="${state.active === "sujets" ? "is-active" : ""}" data-tab="sujets">Préparer un sujet</button>
          </div>
          <section class="me-v101-card">
            <div class="me-v101-form">
              <div class="me-v101-field">
                <label>Classe affichée</label>
                <input list="me-v101-classes" data-selected-class value="${escapeHtml(state.selectedClass)}" placeholder="Ex : 6e A">
                <datalist id="me-v101-classes">${classes.map(name => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>
              </div>
              <div class="me-v101-field">
                <label>Année scolaire</label>
                <input value="${escapeHtml(schoolYearLabel())}" readonly>
              </div>
            </div>
          </section>
          <div class="me-v101-panel ${state.active === "planning" ? "is-active" : ""}" data-panel="planning">${renderPlanningPanel(state)}</div>
          <div class="me-v101-panel ${state.active === "cahier" ? "is-active" : ""}" data-panel="cahier">${renderCahierPanel(state)}</div>
          <div class="me-v101-panel ${state.active === "balayage" ? "is-active" : ""}" data-panel="balayage">${renderSweepPanel(state)}</div>
          <div class="me-v101-panel ${state.active === "sujets" ? "is-active" : ""}" data-panel="sujets">${renderSubjectsPanel(state)}</div>
        </section>
      `;
      bindApp(root);
    };
    const bindApp = root => {
      root.querySelectorAll("[data-tab]").forEach(button => {
        button.onclick = () => {
          const state = getState();
          state.active = button.dataset.tab;
          setState(state);
          renderApp(root);
        };
      });
      const selectedClass = root.querySelector("[data-selected-class]");
      if (selectedClass) {
        selectedClass.onchange = () => {
          const state = getState();
          state.selectedClass = selectedClass.value.trim() || "Classe";
          setState(state);
          renderApp(root);
        };
      }
      const saveCourse = root.querySelector("[data-save-course]");
      if (saveCourse) saveCourse.onclick = () => {
        if (!canEditTimetable()) return appMessage("Modification réservée à la direction ou aux profils autorisés.");
        const state = getState();
        const course = {
          id: state.editingCourseId || uid(),
          className: root.querySelector("[data-course-class]").value.trim() || state.selectedClass,
          day: root.querySelector("[data-course-day]").value,
          start: root.querySelector("[data-course-start]").value,
          end: root.querySelector("[data-course-end]").value,
          subject: root.querySelector("[data-course-subject]").value.trim(),
          professor: root.querySelector("[data-course-professor]").value.trim(),
          room: root.querySelector("[data-course-room]").value.trim(),
          note: root.querySelector("[data-course-note]").value.trim()
        };
        state.selectedClass = course.className;
        state.courses = state.courses.filter(item => item.id !== course.id).concat(course);
        state.editingCourseId = "";
        setState(state);
        renderApp(root);
      };
      root.querySelector("[data-cancel-edit]")?.addEventListener("click", () => {
        const state = getState();
        state.editingCourseId = "";
        setState(state);
        renderApp(root);
      });
      root.querySelectorAll("[data-edit-course]").forEach(button => {
        button.onclick = () => {
          const state = getState();
          state.editingCourseId = button.dataset.editCourse;
          state.active = "planning";
          setState(state);
          renderApp(root);
        };
      });
      root.querySelectorAll("[data-delete-course]").forEach(button => {
        button.onclick = () => {
          if (!canEditTimetable()) return appMessage("Modification réservée à la direction ou aux profils autorisés.");
          const state = getState();
          state.courses = state.courses.filter(course => course.id !== button.dataset.deleteCourse);
          state.cahiers = state.cahiers.filter(item => item.courseId !== button.dataset.deleteCourse);
          setState(state);
          renderApp(root);
        };
      });
      root.querySelector("[data-save-lesson]")?.addEventListener("click", () => {
        const state = getState();
        const courseId = root.querySelector("[data-lesson-course]")?.value || "";
        const course = state.courses.find(item => item.id === courseId);
        if (!canEditLesson(course)) return appMessage("Cahier de texte réservé au professeur programmé.");
        const entry = {
          id: uid(),
          courseId,
          className: course.className,
          courseLabel: `${course.day} ${course.start || ""}-${course.end || ""} · ${course.subject || "Cours"}`,
          date: root.querySelector("[data-lesson-date]").value,
          content: root.querySelector("[data-lesson-content]").value.trim(),
          homework: root.querySelector("[data-lesson-homework]").value.trim()
        };
        if (!entry.content) return appMessage("Ajoutez le contenu de la leçon.");
        state.cahiers.unshift(entry);
        setState(state);
        renderApp(root);
      });
      root.querySelectorAll("[data-delete-lesson]").forEach(button => {
        button.onclick = () => {
          const state = getState();
          const entry = state.cahiers.find(item => item.id === button.dataset.deleteLesson);
          const course = state.courses.find(item => item.id === entry?.courseId);
          if (!canEditLesson(course)) return appMessage("Suppression réservée au professeur programmé.");
          state.cahiers = state.cahiers.filter(item => item.id !== button.dataset.deleteLesson);
          setState(state);
          renderApp(root);
        };
      });
      root.querySelectorAll("[data-add-sweep]").forEach(button => {
        button.onclick = () => {
          const day = button.dataset.addSweep;
          const card = button.closest("[data-sweep-day]");
          const input = card.querySelector("[data-sweep-name]");
          const name = input.value.trim();
          if (!name) return;
          const state = getState();
          state.sweep[state.selectedClass] ||= {};
          state.sweep[state.selectedClass][day] ||= [];
          if (!state.sweep[state.selectedClass][day].some(existing => norm(existing) === norm(name))) {
            state.sweep[state.selectedClass][day].push(name);
          }
          setState(state);
          renderApp(root);
        };
      });
      root.querySelectorAll("[data-remove-sweep]").forEach(button => {
        button.onclick = () => {
          const state = getState();
          const day = button.dataset.removeSweep;
          const list = state.sweep[state.selectedClass]?.[day] || [];
          list.splice(Number(button.dataset.index), 1);
          setState(state);
          renderApp(root);
        };
      });
      root.querySelector("[data-print-sweep]")?.addEventListener("click", () => {
        const state = getState();
        const current = state.sweep[state.selectedClass] || {};
        const rows = DAYS.map(day => `<tr><th>${escapeHtml(day)}</th><td>${(current[day] || []).map(escapeHtml).join("<br>") || "-"}</td></tr>`).join("");
        printHtml("Liste annuelle de balayage", `<p>Classe : ${escapeHtml(state.selectedClass)} · Année scolaire : ${escapeHtml(schoolYearLabel())}</p><table><tbody>${rows}</tbody></table>`);
      });
      root.querySelector("[data-save-subject]")?.addEventListener("click", () => {
        const state = getState();
        const info = userInfo();
        const item = {
          id: uid(),
          teacher: info.name || "Professeur",
          className: state.selectedClass,
          type: root.querySelector("[data-subject-type]").value,
          matter: root.querySelector("[data-subject-matter]").value.trim(),
          title: root.querySelector("[data-subject-title]").value.trim(),
          date: root.querySelector("[data-subject-date]").value,
          content: root.querySelector("[data-subject-content]").value.trim(),
          correction: root.querySelector("[data-subject-correction]").value.trim()
        };
        if (!item.content) return appMessage("Rédigez d'abord le sujet.");
        state.subjects.unshift(item);
        setState(state);
        renderApp(root);
      });
      root.querySelectorAll("[data-delete-subject]").forEach(button => {
        button.onclick = () => {
          const state = getState();
          const item = state.subjects.find(subject => subject.id === button.dataset.deleteSubject);
          if (!canSeeSubject(item)) return appMessage("Action réservée au professeur propriétaire du sujet.");
          state.subjects = state.subjects.filter(subject => subject.id !== button.dataset.deleteSubject);
          setState(state);
          renderApp(root);
        };
      });
      root.querySelectorAll("[data-print-subject]").forEach(button => {
        button.onclick = () => {
          const state = getState();
          const item = state.subjects.find(subject => subject.id === button.dataset.printSubject);
          if (!item) return;
          printHtml(`${item.type} - ${item.title || state.selectedClass}`, `
            <p>Classe : ${escapeHtml(item.className || state.selectedClass)}</p>
            <p>Matière : ${escapeHtml(item.matter || "")} · Date : ${escapeHtml(dateFr(item.date) || "")}</p>
            <h2>Consignes et questions</h2>
            <p>${escapeHtml(item.content || "").replace(/\n/g, "<br>")}</p>
            ${item.correction ? `<h2>Corrigé / barème</h2><p>${escapeHtml(item.correction).replace(/\n/g, "<br>")}</p>` : ""}
          `);
        };
      });
    };
    const settingsPage = () => {
      const main = mainArea();
      const title = all("h1,h2,h3,strong", main).find(node => /^(Établissement|Etablissement|Paramètres|Parametres)\b/i.test(txt(node)));
      if (!title) return null;
      return title.closest(".me-page,section,main,div") || main;
    };
    const ensureSettingsPermission = () => {
      const root = settingsPage();
      const existing = document.querySelector(".me-v101-permission");
      const info = userInfo();
      if (!root || !isDirection(info)) {
        existing?.remove();
        return;
      }
      if (existing) return;
      const box = el("section", "me-v101-permission me-v101-card", `
        <h3>Autorisation de modification de l'emploi du temps</h3>
        <p>La direction choisit ici les profils autorisés à modifier l'emploi du temps. Ce réglage ne s'affiche pas dans Planning & outils.</p>
        <div class="me-v101-field">
          <label>Profils autorisés</label>
          <select data-v101-policy>
            <option value="direction">Direction uniquement</option>
            <option value="direction_secretariat">Direction + secrétariat</option>
            <option value="direction_professeurs">Direction + professeurs</option>
          </select>
        </div>
      `);
      const anchor = all("h1,h2,h3", root).find(node => /^(Établissement|Etablissement|Paramètres|Parametres)\b/i.test(txt(node)));
      if (anchor?.parentElement) anchor.insertAdjacentElement("afterend", box);
      else root.insertBefore(box, root.firstElementChild);
      const select = box.querySelector("[data-v101-policy]");
      select.value = localStorage.getItem(permissionKey()) || "direction";
      select.onchange = () => {
        localStorage.setItem(permissionKey(), select.value);
        appMessage("Autorisation de modification de l'emploi du temps enregistrée.");
      };
    };
    const renameNav = () => {
      all("aside button,aside a,nav button,nav a,[role='button']", document.body).forEach(node => {
        if (!/Emploi du temps/i.test(txt(node))) return;
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) child.nodeValue = child.nodeValue.replace(/Emploi du temps/gi, "Planning & outils");
        });
      });
    };
    let pending = false;
    const enhance = () => {
      pending = false;
      ensureStyle();
      renameNav();
      ensureSettingsPermission();
      if (!shouldOwnPlanning()) {
        cleanupPlanning();
        return;
      }
      const root = planningRoot();
      if (!root) return;
      if (root.querySelector(".me-v101-planning-page")) return;
      root.querySelectorAll(":scope > *").forEach(child => {
        child.hidden = true;
        child.dataset.meV101Owned = "1";
      });
      renderApp(root);
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
    setInterval(schedule, 700);
  } catch (error) {
    console.warn("MonEcole planning v101", error);
  }
})();
