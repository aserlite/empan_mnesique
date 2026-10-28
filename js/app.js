/**
 * Contrôleur principal de l'application WAIS-IV Empan Mnésique
 * Connecte les vues, les contrôles UI, le moteur de test et la gestion sonore/thème.
 */

import { DigitSpanEngine, TEST_MODES } from "./engine.js";
import { soundCtrl } from "./audio.js";

// Références aux éléments du DOM
const DOM = {
  // En-tête & Thème / Son
  btnToggleSound: document.getElementById("btn-toggle-sound"),
  iconSoundOff: document.getElementById("icon-sound-off"),
  iconSoundOn: document.getElementById("icon-sound-on"),
  btnToggleTheme: document.getElementById("btn-toggle-theme"),
  iconMoon: document.getElementById("icon-moon"),
  iconSun: document.getElementById("icon-sun"),

  // Vues
  viewWelcome: document.getElementById("view-welcome"),
  viewTest: document.getElementById("view-test"),
  viewTransition: document.getElementById("view-transition"),
  viewResults: document.getElementById("view-results"),

  // Sélecteurs de mode
  btnModeFull: document.getElementById("btn-mode-full"),
  btnModeDirect: document.getElementById("btn-mode-direct"),
  btnModeInverse: document.getElementById("btn-mode-inverse"),
  selectSequenceSource: document.getElementById("select-sequence-source"),
  selectAutostart: document.getElementById("select-autostart"),

  // Zone de test
  badgeCurrentSubtest: document.getElementById("badge-current-subtest"),
  subtestNameText: document.getElementById("subtest-name-text"),
  testProgressText: document.getElementById("test-progress-text"),
  testInstructionsText: document.getElementById("test-instructions-text"),
  readyPrompt: document.getElementById("ready-prompt"),
  btnStartTrial: document.getElementById("btn-start-trial"),
  stimulusDigit: document.getElementById("stimulus-digit"),
  sequenceTimeline: document.getElementById("sequence-timeline"),
  trialFeedback: document.getElementById("trial-feedback"),
  feedbackIcon: document.getElementById("feedback-icon"),
  feedbackTitle: document.getElementById("feedback-title"),
  feedbackSubtitle: document.getElementById("feedback-subtitle"),

  // Zone de réponse
  responseZone: document.getElementById("response-zone"),
  responseInput: document.getElementById("response-input"),
  virtualKeypad: document.getElementById("virtual-keypad"),
  btnSubmitAnswer: document.getElementById("btn-submit-answer"),

  // Vue transition
  transitionSummaryPill: document.getElementById("transition-summary-pill"),
  btnProceedInverse: document.getElementById("btn-proceed-inverse"),

  // Vue résultats
  resultsDateTime: document.getElementById("results-date-time"),
  metricBoxDirect: document.getElementById("metric-box-direct"),
  resScoreDirect: document.getElementById("res-score-direct"),
  resSpanDirect: document.getElementById("res-span-direct"),
  metricBoxInverse: document.getElementById("metric-box-inverse"),
  resScoreInverse: document.getElementById("res-score-inverse"),
  resSpanInverse: document.getElementById("res-span-inverse"),
  resScoreTotal: document.getElementById("res-score-total"),
  auditTableBody: document.getElementById("audit-table-body"),
  btnCopyReport: document.getElementById("btn-copy-report"),
  btnPrintReport: document.getElementById("btn-print-report"),
  btnRestartTest: document.getElementById("btn-restart-test"),

  // Notification Toast
  toastNotice: document.getElementById("toast-notice"),
};

// Initialisation du moteur de test
let engine = null;
let currentResults = null;
let isProcessingAnswer = false;
let feedbackTimeoutId = null;

function showView(viewElement) {
  [DOM.viewWelcome, DOM.viewTest, DOM.viewTransition, DOM.viewResults].forEach(
    (v) => {
      v.classList.remove("active");
    },
  );
  viewElement.classList.add("active");
}

function showToast(message = "Action effectuée avec succès") {
  DOM.toastNotice.textContent = message;
  DOM.toastNotice.classList.add("show");
  setTimeout(() => {
    DOM.toastNotice.classList.remove("show");
  }, 2500);
}

// Initialisation du moteur avec callbacks d'interface
function initEngine() {
  const isAutoStart = DOM.selectAutostart.value === "auto";

  engine = new DigitSpanEngine({
    digitDurationMs: 800, // 800ms affiché (exigence WAIS-IV)
    intervalDurationMs: 200, // 200ms intervalle = 1 seconde / chiffre
    fixationDurationMs: 900, // Fixation préparatoire

    onStateChange: (info) => {
      updateStateHeader(info);
      prepareNextTrialPrompt();
    },

    onFixation: () => {
      hideReadyPrompt();
      hideResponseZone();
      DOM.stimulusDigit.textContent = "+";
      DOM.stimulusDigit.className = "stimulus-digit fixation";
    },

    onDigitDisplay: (digit, index, total) => {
      DOM.stimulusDigit.textContent = digit;
      DOM.stimulusDigit.className = "stimulus-digit";
      updateTimelineDots(index, total);
    },

    onDigitClear: () => {
      DOM.stimulusDigit.textContent = "";
      DOM.stimulusDigit.className = "stimulus-digit empty";
    },

    onReadyForInput: () => {
      DOM.stimulusDigit.textContent = "";
      DOM.stimulusDigit.className = "stimulus-digit empty";
      DOM.sequenceTimeline.style.display = "none";
      revealResponseZone();
    },

    onSubtestTransition: (transitionData) => {
      handleSubtestTransition(transitionData);
    },

    onTestFinished: (results) => {
      handleTestFinished(results);
    },
  });
}

function updateStateHeader(info) {
  if (!info) return;

  DOM.subtestNameText.textContent = info.subtestName;
  DOM.testProgressText.textContent = info.trialNumber === 1
    ? `Longueur : ${info.length} chiffres | Essai 1`
    : `Longueur : ${info.length} chiffres | Essai 2 (rattrapage)`;
  DOM.testInstructionsText.textContent = info.instructions;

  // Préparation de la barre de progression par points
  DOM.sequenceTimeline.innerHTML = "";
  for (let i = 0; i < info.length; i++) {
    const dot = document.createElement("div");
    dot.className = "timeline-dot";
    DOM.sequenceTimeline.appendChild(dot);
  }
}

function updateTimelineDots(currentIndex, total) {
  DOM.sequenceTimeline.style.display = "flex";
  const dots = DOM.sequenceTimeline.querySelectorAll(".timeline-dot");
  dots.forEach((dot, idx) => {
    if (idx === currentIndex) {
      dot.className = "timeline-dot active";
    } else if (idx < currentIndex) {
      dot.className = "timeline-dot completed";
    } else {
      dot.className = "timeline-dot";
    }
  });
}

function showTrialFeedback(record, evaluation) {
  if (!DOM.trialFeedback) return;

  const isCorrect = record.isCorrect;
  DOM.trialFeedback.className = `trial-feedback-card ${isCorrect ? "correct" : "error"}`;

  if (isCorrect) {
    DOM.feedbackIcon.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
    DOM.feedbackTitle.textContent = "Correct";
    if (record.trialNumber === 1) {
      DOM.feedbackSubtitle.innerHTML =
        'Niveau validé dès le 1ᵉʳ essai <span class="feedback-points">(+2 pts)</span>';
    } else {
      DOM.feedbackSubtitle.innerHTML =
        'Niveau validé au 2ᵉ essai <span class="feedback-points">(+1 pt)</span>';
    }
    DOM.responseInput.classList.remove("feedback-error");
    DOM.responseInput.classList.add("feedback-correct");
  } else {
    DOM.feedbackIcon.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
    DOM.feedbackTitle.textContent = "Incorrect";
    const expectedFormatted = record.expectedString.split("").join(" - ");
    const userFormatted = record.userInput
      ? record.userInput.split("").join(" - ")
      : "aucun";
    if (evaluation && evaluation.hasNextTrialInItem) {
      DOM.feedbackSubtitle.innerHTML = `Attendu : <strong>${expectedFormatted}</strong> <span class="feedback-user-ans">(2ᵉ chance accordée...)</span>`;
    } else {
      DOM.feedbackSubtitle.innerHTML = `Attendu : <strong>${expectedFormatted}</strong> <span class="feedback-user-ans">(Saisi : ${userFormatted})</span>`;
    }
    DOM.responseInput.classList.remove("feedback-correct");
    DOM.responseInput.classList.add("feedback-error");
  }

  // Masquer les autres éléments du stage central
  DOM.readyPrompt.style.display = "none";
  DOM.stimulusDigit.style.display = "none";
  DOM.sequenceTimeline.style.display = "none";

  DOM.trialFeedback.style.display = "flex";
}

function hideTrialFeedback() {
  if (feedbackTimeoutId) {
    clearTimeout(feedbackTimeoutId);
    feedbackTimeoutId = null;
  }
  if (DOM.trialFeedback) {
    DOM.trialFeedback.style.display = "none";
    DOM.trialFeedback.className = "trial-feedback-card";
  }
  if (DOM.stimulusDigit) {
    DOM.stimulusDigit.style.display = "";
  }
  if (DOM.responseInput) {
    DOM.responseInput.classList.remove("feedback-correct", "feedback-error");
    DOM.responseInput.disabled = false;
  }
  if (DOM.btnSubmitAnswer) {
    DOM.btnSubmitAnswer.disabled = false;
  }
  isProcessingAnswer = false;
}

function prepareNextTrialPrompt() {
  hideTrialFeedback();
  hideResponseZone();
  DOM.stimulusDigit.textContent = "";
  DOM.stimulusDigit.className = "stimulus-digit empty";
  DOM.sequenceTimeline.style.display = "none";

  const isAutoStart = DOM.selectAutostart.value === "auto";
  if (isAutoStart) {
    hideReadyPrompt();
    setTimeout(() => {
      engine.playCurrentSequence();
    }, 400);
  } else {
    showReadyPrompt();
  }
}

function showReadyPrompt() {
  DOM.readyPrompt.style.display = "flex";
  DOM.btnStartTrial.focus();
}

function hideReadyPrompt() {
  DOM.readyPrompt.style.display = "none";
}

function revealResponseZone() {
  hideTrialFeedback();
  DOM.responseZone.classList.add("visible");
  DOM.responseInput.value = "";
  DOM.responseInput.disabled = false;
  DOM.btnSubmitAnswer.disabled = false;
  setTimeout(() => {
    DOM.responseInput.focus();
  }, 50);
}

function hideResponseZone() {
  DOM.responseZone.classList.remove("visible");
  DOM.responseInput.value = "";
}

function handleAnswerSubmission() {
  if (isProcessingAnswer) return;

  const value = DOM.responseInput.value.trim();
  if (!value) return; // Ne pas valider si vide

  const evaluation = engine.evaluateAnswer(value);
  if (!evaluation) return;

  isProcessingAnswer = true;
  DOM.responseInput.disabled = true;
  DOM.btnSubmitAnswer.disabled = true;

  showTrialFeedback(evaluation.record, evaluation);

  // Pause calibrée (1.2s) pour observer le retour sans rompre le rythme
  const FEEDBACK_DURATION_MS = 1200;

  feedbackTimeoutId = setTimeout(() => {
    hideTrialFeedback();
    // Poursuite du test (essai suivant, transition ou bilan)
    engine.advanceToNext(evaluation);
  }, FEEDBACK_DURATION_MS);
}

function handleSubtestTransition(transitionData) {
  const res = transitionData.results;
  DOM.transitionSummaryPill.textContent = `Empan max : ${res.maxSpan} chiffres (Score ${res.subtestName} : ${res.rawScore} / ${res.maxPossibleScore} pts)`;
  showView(DOM.viewTransition);
}

function handleTestFinished(results) {
  currentResults = results;
  renderResultsView(results);
  showView(DOM.viewResults);
}

function renderResultsView(results) {
  // Formatage de la date du jour
  const now = new Date(results.date);
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  DOM.resultsDateTime.textContent = `Session administrée le ${now.toLocaleDateString("fr-FR", options)}`;

  // Métrique Empan Direct (Focus sur l'empan maximal)
  if (results.direct) {
    DOM.metricBoxDirect.style.display = "flex";
    DOM.resSpanDirect.innerHTML = `${results.direct.maxSpan} <span class="denom">chiffres</span>`;
    DOM.resScoreDirect.innerHTML = `${results.direct.rawScore} <span class="denom">/ ${results.direct.maxPossibleScore} pts</span>`;
  } else {
    DOM.metricBoxDirect.style.display = "none";
  }

  // Métrique Empan Inverse (Focus sur l'empan maximal)
  if (results.inverse) {
    DOM.metricBoxInverse.style.display = "flex";
    DOM.resSpanInverse.innerHTML = `${results.inverse.maxSpan} <span class="denom">chiffres</span>`;
    DOM.resScoreInverse.innerHTML = `${results.inverse.rawScore} <span class="denom">/ ${results.inverse.maxPossibleScore} pts</span>`;
  } else {
    DOM.metricBoxInverse.style.display = "none";
  }

  // Score total
  DOM.resScoreTotal.innerHTML = `${results.totalRawScore} <span class="denom">/ ${results.totalMaxPossible}</span>`;

  // Tableau d'audit exhaustif
  DOM.auditTableBody.innerHTML = "";
  results.trials.forEach((trial) => {
    const tr = document.createElement("tr");

    const subtestBadge =
      trial.subtest === "direct"
        ? '<span style="color:var(--accent-primary); font-weight:600;">Direct</span>'
        : '<span style="color:#0284c7; font-weight:600;">Inverse</span>';

    const statusBadge = trial.isCorrect
      ? '<span class="status-badge correct">✓ Réussi</span>'
      : '<span class="status-badge error">✗ Échec</span>';

    tr.innerHTML = `
      <td>${subtestBadge}</td>
      <td class="mono-cell">L = ${trial.length}</td>
      <td>Essai ${trial.trialNumber}</td>
      <td class="mono-cell">${trial.targetSequence.join(" - ")}</td>
      <td class="mono-cell">${trial.expectedString.split("").join(" - ")}</td>
      <td class="mono-cell" style="font-weight:600;">${trial.userInput ? trial.userInput.split("").join(" - ") : "—"}</td>
      <td>${statusBadge}</td>
      <td style="font-weight:700;">${trial.points} pt${trial.points > 1 ? "s" : ""}</td>
    `;
    DOM.auditTableBody.appendChild(tr);
  });
}

// Génération du texte à copier pour le dossier patient / compte-rendu
function buildClinicalTextReport(results) {
  if (!results) return "";

  const dateStr = new Date(results.date).toLocaleString("fr-FR");
  let txt = `========================================================\n`;
  txt += `COMPTE-RENDU D'ÉVALUATION PSYCHOMÉTRIQUE WAIS-IV\n`;
  txt += `Épreuve d'Empan Mnésique (Digit Span)\n`;
  txt += `Date : ${dateStr}\n`;
  txt += `========================================================\n\n`;

  txt += `RÉSULTATS SYNTHÉTIQUES :\n`;
  if (results.direct) {
    txt += `- Empan Direct Maximal : ${results.direct.maxSpan} chiffres (Score brut : ${results.direct.rawScore} / ${results.direct.maxPossibleScore} points)\n`;
  }
  if (results.inverse) {
    txt += `- Empan Inverse Maximal : ${results.inverse.maxSpan} chiffres (Score brut : ${results.inverse.rawScore} / ${results.inverse.maxPossibleScore} points)\n`;
  }
  txt += `- Score Brut Total : ${results.totalRawScore} / ${results.totalMaxPossible} points\n\n`;

  txt += `DÉTAIL DES ESSAIS ADMINISTRÉS :\n`;
  txt += `Épreuve | Longueur | Essai | Séquence présentée | Attendu | Réponse | Score\n`;
  txt += `-------------------------------------------------------------------------\n`;

  results.trials.forEach((t) => {
    const sub = t.subtest === "direct" ? "Direct " : "Inverse";
    const rep = t.userInput || "Vide";
    const st = t.isCorrect ? `Réussi (${t.points} pt${t.points > 1 ? "s" : ""})` : "Échec (0 pt)";
    txt += `${sub} | Longueur ${t.length} | Essai ${t.trialNumber} | ${t.targetSequence.join("-")} | ${t.expectedString} | ${rep} | ${st}\n`;
  });

  txt += `\nProtocole standardisé respectant la règle d'arrêt de 2 échecs consécutifs sur un même item.\n`;
  txt += `========================================================\n`;
  return txt;
}

// -------------------------------------------------------------
// Écouteurs d'événements & Interactions
// -------------------------------------------------------------

function setupEventListeners() {
  // Sélection des modes de test
  const startWithMode = (mode) => {
    hideTrialFeedback();
    const useRandom = DOM.selectSequenceSource.value === "random";
    initEngine();
    engine.startTest(mode, useRandom);
    showView(DOM.viewTest);
  };

  DOM.btnModeFull.addEventListener("click", () =>
    startWithMode(TEST_MODES.FULL),
  );
  DOM.btnModeDirect.addEventListener("click", () =>
    startWithMode(TEST_MODES.DIRECT),
  );
  DOM.btnModeInverse.addEventListener("click", () =>
    startWithMode(TEST_MODES.INVERSE),
  );

  // Bouton "Lancer l'essai" (Mode manuel)
  DOM.btnStartTrial.addEventListener("click", () => {
    if (isProcessingAnswer) return;
    engine.playCurrentSequence();
  });

  // Transition vers l'Empan Inverse
  DOM.btnProceedInverse.addEventListener("click", () => {
    hideTrialFeedback();
    showView(DOM.viewTest);
    engine.startNextSubtest();
  });

  // Pavé numérique virtuel
  DOM.virtualKeypad.addEventListener("click", (e) => {
    if (isProcessingAnswer) return;
    const btn = e.target.closest("button");
    if (!btn) return;

    const key = btn.getAttribute("data-key");
    const action = btn.getAttribute("data-action");

    if (key) {
      if (DOM.responseInput.value.length < 12) {
        DOM.responseInput.value += key;
      }
    } else if (action === "clear") {
      DOM.responseInput.value = "";
    } else if (action === "backspace") {
      DOM.responseInput.value = DOM.responseInput.value.slice(0, -1);
    } else if (action === "submit") {
      handleAnswerSubmission();
    }
    DOM.responseInput.focus();
  });

  // Bouton valider
  DOM.btnSubmitAnswer.addEventListener("click", handleAnswerSubmission);

  // Clavier physique (Entrée pour valider, Espace pour lancer l'essai)
  DOM.responseInput.addEventListener("keydown", (e) => {
    if (isProcessingAnswer) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleAnswerSubmission();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (isProcessingAnswer) return;
    if (
      DOM.viewTest.classList.contains("active") &&
      DOM.readyPrompt.style.display === "flex"
    ) {
      if (e.code === "Space") {
        e.preventDefault();
        engine.playCurrentSequence();
      }
    }
  });

  // Recommencer le test
  DOM.btnRestartTest.addEventListener("click", () => {
    if (engine) engine.stop();
    hideTrialFeedback();
    showView(DOM.viewWelcome);
  });

  // Copier le compte-rendu
  DOM.btnCopyReport.addEventListener("click", async () => {
    const textReport = buildClinicalTextReport(currentResults);
    try {
      await navigator.clipboard.writeText(textReport);
      showToast("Compte-rendu copié dans le presse-papier !");
    } catch (err) {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = textReport;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showToast("Compte-rendu copié dans le presse-papier !");
    }
  });

  // Imprimer le rapport / PDF
  DOM.btnPrintReport.addEventListener("click", () => {
    window.print();
  });

  // Bascule du Son
  DOM.btnToggleSound.addEventListener("click", () => {
    const enabled = soundCtrl.toggle();
    if (enabled) {
      DOM.iconSoundOff.style.display = "none";
      DOM.iconSoundOn.style.display = "block";
      DOM.btnToggleSound.classList.add("active");
      showToast("Signaux sonores activés");
    } else {
      DOM.iconSoundOff.style.display = "block";
      DOM.iconSoundOn.style.display = "none";
      DOM.btnToggleSound.classList.remove("active");
      showToast("Mode silencieux activé");
    }
  });

  // Bascule Thème Clair / Sombre
  DOM.btnToggleTheme.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("empan_theme", newTheme);

    if (newTheme === "dark") {
      DOM.iconMoon.style.display = "none";
      DOM.iconSun.style.display = "block";
    } else {
      DOM.iconMoon.style.display = "block";
      DOM.iconSun.style.display = "none";
    }
  });

  // Restaurer thème sauvegardé
  const savedTheme = localStorage.getItem("empan_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    if (savedTheme === "dark") {
      DOM.iconMoon.style.display = "none";
      DOM.iconSun.style.display = "block";
    }
  }
}

// Lancement au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
});
