(function () {
  "use strict";

  const target = "Emploi de temps";
  const replacements = [
    [/Planning\s*&\s*outils/gi, target],
    [/Planning des cours/gi, target],
    [/Emploi du temps/gi, target],
  ];
  let running = false;

  function renameText(value) {
    return replacements.reduce((text, pair) => text.replace(pair[0], pair[1]), String(value || ""));
  }

  function walk(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const next = renameText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION)$/i.test(node.tagName)) return;
    node.childNodes.forEach(walk);
  }

  function renameAttributes(root) {
    root.querySelectorAll("[title],[aria-label]").forEach((element) => {
      ["title", "aria-label"].forEach((name) => {
        const value = element.getAttribute(name);
        if (!value) return;
        const next = renameText(value);
        if (next !== value) element.setAttribute(name, next);
      });
    });
  }

  function applyRename() {
    if (running || !document.body) return;
    running = true;
    try {
      walk(document.body);
      renameAttributes(document.body);
    } finally {
      running = false;
    }
  }

  function scheduleRename() {
    window.requestAnimationFrame(applyRename);
  }

  document.addEventListener("DOMContentLoaded", applyRename);
  window.addEventListener("hashchange", () => setTimeout(applyRename, 80));
  document.addEventListener("click", () => setTimeout(applyRename, 120), true);

  new MutationObserver(scheduleRename).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  applyRename();
})();
