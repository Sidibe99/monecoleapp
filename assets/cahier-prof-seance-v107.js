(function () {
  "use strict";

  var DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  var TIME_RE = /\b([01]?\d|2[0-3]):[0-5]\d\s*[–-]\s*([01]?\d|2[0-3]):[0-5]\d\b/;
  var scheduledTimer = 0;

  function norm(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function compact(value) {
    return norm(value).replace(/\s+/g, "");
  }

  function isVisible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0;
  }

  function txt(el) {
    return String((el && (el.innerText || el.textContent)) || "").replace(/\u00a0/g, " ").trim();
  }

  function ownText(el) {
    if (!el) return "";
    var text = "";
    Array.prototype.forEach.call(el.childNodes || [], function (node) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
    });
    return text.replace(/\s+/g, " ").trim();
  }

  function addStyles() {
    if (document.getElementById("me-cahier-prof-style")) return;
    var style = document.createElement("style");
    style.id = "me-cahier-prof-style";
    style.textContent = [
      ".me-cahier-lock-note{margin:10px 0 14px;padding:12px 14px;border-radius:14px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;font-weight:800;line-height:1.35}",
      ".me-cahier-lock-note.is-ok{border-color:#bbf7d0;background:#f0fdf4;color:#047857}",
      ".me-cahier-session{margin:8px 0 12px;display:grid;gap:7px}",
      ".me-cahier-session label{font-size:12px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.03em}",
      ".me-cahier-session select{width:100%;min-height:48px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;color:#0f172a;padding:0 14px;font:inherit;font-weight:800;outline:none}",
      ".me-cahier-session select:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.14)}",
      ".me-cahier-toast{position:fixed;left:50%;top:92px;z-index:99999;transform:translateX(-50%);max-width:min(520px,calc(100vw - 32px));padding:14px 18px;border-radius:16px;background:#0f172a;color:#fff;box-shadow:0 18px 45px rgba(15,23,42,.22);font-weight:900;line-height:1.35;text-align:center}",
      ".me-cahier-disabled{opacity:.55!important;cursor:not-allowed!important;filter:saturate(.6)}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function getConnectedUser() {
    var body = txt(document.body);
    var match = body.match(/Connecté\s+([^\n]+?)\s+(ADMINISTRATEUR|PROFESSEUR|ENSEIGNANT|DIRECTEUR|DIRECTION|SECRETAIRE|COMPTABLE|PARENT|ELEVE)\b/i);
    if (!match) {
      match = body.match(/Connecte\s+([^\n]+?)\s+(ADMINISTRATEUR|PROFESSEUR|ENSEIGNANT|DIRECTEUR|DIRECTION|SECRETAIRE|COMPTABLE|PARENT|ELEVE)\b/i);
    }
    var role = match ? match[2].toUpperCase() : "";
    return {
      name: match ? match[1].trim() : "",
      role: role,
      isTeacher: /PROFESSEUR|ENSEIGNANT/.test(role)
    };
  }

  function findSaveButton(card) {
    return Array.prototype.find.call(card.querySelectorAll("button"), function (button) {
      return isVisible(button) && /enregistrer la le[cç]on/i.test(txt(button));
    });
  }

  function findCahierCard() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
    var save = buttons.find(function (button) {
      return isVisible(button) && /enregistrer la le[cç]on/i.test(txt(button));
    });
    if (!save) return null;

    var current = save.parentElement;
    var best = null;
    while (current && current !== document.body) {
      var content = txt(current);
      if (/cahier de texte/i.test(content) && /le[cç]on|contenu enseign/i.test(content)) best = current;
      if (content.length > 4500 && best) break;
      current = current.parentElement;
    }
    return best || save.closest("section,article,div");
  }

  function selectedClassName(card) {
    var selects = Array.prototype.slice.call(document.querySelectorAll("select")).filter(isVisible);
    for (var i = 0; i < selects.length; i += 1) {
      var value = selects[i].options && selects[i].selectedIndex >= 0 ? selects[i].options[selects[i].selectedIndex].text : selects[i].value;
      if (value && !/jour|an|mois|trimestre|semestre|composition|evaluation/i.test(value)) return value.trim();
    }
    var match = txt(card || document.body).match(/Classe\s*:\s*([^\n]+)/i);
    return match ? match[1].trim() : "";
  }

  function dateFromCard(card) {
    var input = card && card.querySelector('input[type="date"]');
    if (input && input.value) {
      var iso = new Date(input.value + "T12:00:00");
      if (!isNaN(iso.getTime())) return iso;
    }
    var valueInput = Array.prototype.find.call((card || document).querySelectorAll("input"), function (field) {
      return isVisible(field) && /^\d{2}\/\d{2}\/\d{4}$/.test(field.value || "");
    });
    if (valueInput) {
      var parts = valueInput.value.split("/");
      var date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
      if (!isNaN(date.getTime())) return date;
    }
    return new Date();
  }

  function dayFromDate(date) {
    return DAYS[date.getDay()];
  }

  function findDayCard(day) {
    var wanted = norm(day);
    var nodes = Array.prototype.slice.call(document.querySelectorAll("h1,h2,h3,h4,strong,b,button,span,div"));
    var headers = nodes.filter(function (node) {
      return isVisible(node) && norm(ownText(node) || txt(node)) === wanted;
    });
    for (var i = 0; i < headers.length; i += 1) {
      var current = headers[i];
      while (current && current !== document.body) {
        var content = txt(current);
        if (norm(content).indexOf(wanted) === 0 && (TIME_RE.test(content) || /aucun cours/i.test(content)) && content.length < 2200) {
          return current;
        }
        current = current.parentElement;
      }
    }
    return null;
  }

  function cleanLine(line) {
    return String(line || "")
      .replace(/[👨‍🏫👩‍🏫📍📌✏️📝]/g, "")
      .replace(/\b(Modifier|Supprimer|Aucun cours)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseCourses(dayCard) {
    if (!dayCard) return [];
    var blocks = Array.prototype.slice.call(dayCard.querySelectorAll("div,li,article,section")).filter(function (node) {
      var content = txt(node);
      return isVisible(node) && TIME_RE.test(content) && content.length < 700;
    });
    var seen = {};
    var courses = [];

    blocks.forEach(function (block) {
      var lines = txt(block).split(/\n+/).map(cleanLine).filter(Boolean);
      var timeLine = lines.find(function (line) { return TIME_RE.test(line); });
      if (!timeLine) return;
      var time = (timeLine.match(TIME_RE) || [""])[0].replace(/\s*-\s*/g, " – ");
      var idx = lines.indexOf(timeLine);
      var subject = cleanLine(lines[idx + 1] || "");
      var teacher = cleanLine(lines[idx + 2] || "");
      if (!subject || /modifier|supprimer/i.test(subject)) subject = cleanLine(lines.find(function (line) {
        return line !== timeLine && !TIME_RE.test(line) && !/modifier|supprimer/i.test(line);
      }) || "");
      if (!teacher || TIME_RE.test(teacher) || /modifier|supprimer/i.test(teacher)) {
        teacher = cleanLine(lines.find(function (line) {
          return line !== timeLine && line !== subject && !TIME_RE.test(line) && !/modifier|supprimer/i.test(line);
        }) || "");
      }
      var key = compact(time + subject + teacher);
      if (!key || seen[key]) return;
      seen[key] = true;
      courses.push({ time: time, subject: subject || "Cours", teacher: teacher || "" });
    });

    return courses;
  }

  function isPrimaryLevel(className) {
    var value = norm(className);
    if (/college|lycee|7eme|8eme|9eme|10eme|11eme|12eme|terminal|seconde|premiere/.test(value)) return false;
    return /maternelle|primaire|1ere|2eme|3eme|4eme|5eme|6eme|cp|ce1|ce2|cm1|cm2|moyenne section|petite section|grande section/.test(value);
  }

  function teacherMatches(currentName, teacherName) {
    var a = compact(currentName);
    var b = compact(teacherName);
    if (!a || !b) return false;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
    var ignored = {
      prof: true,
      professeur: true,
      enseignante: true,
      enseignant: true,
      madame: true,
      monsieur: true,
      mme: true,
      mr: true
    };
    var tokensA = norm(currentName).split(" ").filter(function (part) {
      return part.length > 1 && !ignored[part];
    });
    var tokensB = norm(teacherName).split(" ").filter(function (part) {
      return part.length > 1 && !ignored[part];
    });
    if (!tokensA.length || !tokensB.length) return false;
    var hits = tokensA.filter(function (part) { return tokensB.indexOf(part) !== -1; }).length;
    return hits >= Math.min(2, Math.max(1, tokensB.length));
  }

  function ensureNotice(card) {
    var note = card.querySelector("[data-me-cahier-lock-note]");
    if (!note) {
      note = document.createElement("div");
      note.setAttribute("data-me-cahier-lock-note", "true");
      note.className = "me-cahier-lock-note";
      var title = Array.prototype.find.call(card.querySelectorAll("h1,h2,h3,h4,strong,b"), function (el) {
        return /cahier de texte/i.test(txt(el));
      });
      if (title) {
        title.insertAdjacentElement("afterend", note);
      } else {
        card.insertBefore(note, card.firstChild);
      }
    }
    return note;
  }

  function ensureSessionSelect(card, courses, show) {
    var box = card.querySelector("[data-me-cahier-session]");
    if (!show) {
      if (box) box.hidden = true;
      return null;
    }
    if (!box) {
      box = document.createElement("div");
      box.className = "me-cahier-session";
      box.setAttribute("data-me-cahier-session", "true");
      box.innerHTML = '<label>Séance du jour</label><select aria-label="Séance du jour"></select>';
      var save = findSaveButton(card);
      var target = save;
      while (target && target.parentElement && target.parentElement !== card) target = target.parentElement;
      if (target && target.parentElement === card) {
        card.insertBefore(box, target);
      } else {
        card.appendChild(box);
      }
    }
    box.hidden = false;
    var select = box.querySelector("select");
    var previous = select.value;
    select.innerHTML = "";
    courses.forEach(function (course, index) {
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = course.time + " · " + course.subject + (course.teacher ? " · " + course.teacher : "");
      select.appendChild(option);
    });
    if (previous && Number(previous) < courses.length) select.value = previous;
    select.onchange = scheduleUpdate;
    return select;
  }

  function setButtonState(button, allowed, reason) {
    if (!button) return;
    button.disabled = !allowed;
    button.setAttribute("aria-disabled", allowed ? "false" : "true");
    button.dataset.meCahierAllowed = allowed ? "1" : "0";
    button.dataset.meCahierReason = reason || "";
    button.classList.toggle("me-cahier-disabled", !allowed);
    button.title = allowed ? "Autorisé pour le professeur programmé." : reason || "Lecture seule.";
  }

  function notify(message) {
    var old = document.querySelector(".me-cahier-toast");
    if (old) old.remove();
    var toast = document.createElement("div");
    toast.className = "me-cahier-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentElement) toast.remove();
    }, 3600);
  }

  function updateCahierLock() {
    addStyles();
    var card = findCahierCard();
    if (!card) return;
    var button = findSaveButton(card);
    var user = getConnectedUser();
    var className = selectedClassName(card);
    var date = dateFromCard(card);
    var day = dayFromDate(date);
    var dayCard = findDayCard(day);
    var courses = parseCourses(dayCard);
    var primary = isPrimaryLevel(className);
    var note = ensureNotice(card);
    var select = ensureSessionSelect(card, courses, !primary && courses.length > 1);
    var selectedCourse = courses[select ? Number(select.value || 0) : 0];
    var matchingCourse = primary
      ? courses.find(function (course) { return teacherMatches(user.name, course.teacher); })
      : selectedCourse;

    var allowed = false;
    var reason = "";

    if (!courses.length) {
      reason = "Lecture seule : aucun cours n'est programmé ce jour pour cette classe.";
    } else if (!user.isTeacher) {
      reason = "Lecture seule : seul le professeur programmé peut écrire dans le cahier de texte.";
    } else if (primary) {
      allowed = Boolean(matchingCourse);
      reason = allowed
        ? "Autorisé : vous êtes professeur programmé aujourd'hui pour cette classe."
        : "Lecture seule : au primaire, seul le professeur du jour peut écrire dans le cahier.";
    } else {
      allowed = Boolean(selectedCourse && teacherMatches(user.name, selectedCourse.teacher));
      reason = allowed
        ? "Autorisé : vous êtes le professeur de cette séance."
        : "Lecture seule : au collège et au lycée, seul le professeur de la séance choisie peut écrire.";
    }

    note.className = "me-cahier-lock-note" + (allowed ? " is-ok" : "");
    note.textContent = allowed
      ? reason + (matchingCourse ? " Séance : " + matchingCourse.time + " · " + matchingCourse.subject + "." : "")
      : reason;
    setButtonState(button, allowed, reason);
  }

  function scheduleUpdate() {
    clearTimeout(scheduledTimer);
    scheduledTimer = setTimeout(updateCahierLock, 120);
  }

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!button || !/enregistrer la le[cç]on/i.test(txt(button))) return;
    updateCahierLock();
    if (button.dataset.meCahierAllowed !== "1") {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify(button.dataset.meCahierReason || "Lecture seule : professeur non autorisé pour cette séance.");
    }
  }, true);

  document.addEventListener("change", scheduleUpdate, true);
  window.addEventListener("hashchange", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate);

  var observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleUpdate();
})();
