(() => {
  "use strict";

  const { components, tools, cases } = window.SIMULATOR_DATA;
  const TOTAL_CASES = 5;
  const TOOL_COST = 3;
  const WRONG_ANSWER_COST = 15;

  const state = {
    student: "",
    institution: "",
    selectedCases: [],
    caseIndex: 0,
    score: 0,
    elapsed: 0,
    timerId: null,
    computerOn: false,
    usedTools: new Set(),
    inspectedComponents: new Set(),
    testedComponents: new Set(),
    attempts: 0,
    currentPoints: 100,
    selectedComponent: null,
    bootToken: 0,
    suspect: null,
    finished: false,
  };

  const dom = {};

  function cacheDom() {
    [
      "startScreen",
      "accessForm",
      "studentName",
      "institutionName",
      "simulator",
      "sessionStudent",
      "sessionInstitution",
      "sessionCase",
      "sessionScore",
      "sessionTime",
      "caseNumber",
      "caseTitle",
      "caseSymptom",
      "severityBadge",
      "monitorScreen",
      "screenContent",
      "towerUnit",
      "towerLed",
      "towerStatusText",
      "toolGrid",
      "toolCounter",
      "terminalLog",
      "clearLogButton",
      "powerState",
      "powerButton",
      "powerHint",
      "inspectionCounter",
      "componentGrid",
      "diagnosisSelect",
      "technicalNote",
      "attemptsBadge",
      "submitDiagnosis",
      "inspectionDialog",
      "dialogIcon",
      "dialogCategory",
      "dialogTitle",
      "dialogDescription",
      "dialogMetrics",
      "dialogEvidence",
      "closeInspection",
      "markSuspectButton",
      "runComponentTest",
      "resultDialog",
      "resultMark",
      "resultEyebrow",
      "resultTitle",
      "resultMessage",
      "resultDetails",
      "nextCaseButton",
      "toastRegion",
    ].forEach((id) => {
      dom[id] = document.getElementById(id);
    });

    dom.tabs = [...document.querySelectorAll(".tab")];
    dom.monitorLed = document.querySelector(".monitor-led");
    dom.powerButtonLabel = document.querySelector(".power-button__label");
  }

  function bindEvents() {
    dom.accessForm.addEventListener("submit", startSession);
    dom.powerButton.addEventListener("click", togglePower);
    dom.clearLogButton.addEventListener("click", () => {
      dom.terminalLog.replaceChildren();
      addLog("Registro visual limpo pelo operador.", "info", "LOG");
    });
    dom.tabs.forEach((tab) => tab.addEventListener("click", selectComponentCategory));
    dom.submitDiagnosis.addEventListener("click", submitDiagnosis);
    dom.closeInspection.addEventListener("click", () => dom.inspectionDialog.close());
    dom.runComponentTest.addEventListener("click", runSelectedComponentTest);
    dom.markSuspectButton.addEventListener("click", markSelectedComponent);
    dom.nextCaseButton.addEventListener("click", advanceCase);

    dom.inspectionDialog.addEventListener("click", (event) => {
      if (event.target === dom.inspectionDialog) dom.inspectionDialog.close();
    });

    dom.resultDialog.addEventListener("cancel", (event) => event.preventDefault());
  }

  function initialize() {
    cacheDom();
    bindEvents();
    renderTools();
    renderComponents("hardware");
    fillDiagnosisOptions();
  }

  function startSession(event) {
    event.preventDefault();
    const student = dom.studentName.value.trim();
    const institution = dom.institutionName.value.trim();

    if (!student || !institution) {
      showToast("Preencha o nome e a instituição para iniciar.", "warning");
      return;
    }

    state.student = student;
    state.institution = institution;
    state.selectedCases = shuffle([...cases]).slice(0, TOTAL_CASES);
    state.caseIndex = 0;
    state.score = 0;
    state.elapsed = 0;
    state.finished = false;

    dom.sessionStudent.textContent = student;
    dom.sessionInstitution.textContent = institution;
    dom.startScreen.hidden = true;
    dom.simulator.hidden = false;
    document.title = "SimulaPC — Sessão em andamento";

    startTimer();
    loadCase();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function startTimer() {
    clearInterval(state.timerId);
    updateTimer();
    state.timerId = window.setInterval(() => {
      state.elapsed += 1;
      updateTimer();
    }, 1000);
  }

  function updateTimer() {
    dom.sessionTime.textContent = formatTime(state.elapsed);
  }

  function loadCase() {
    state.bootToken += 1;
    state.computerOn = false;
    state.usedTools.clear();
    state.inspectedComponents.clear();
    state.testedComponents.clear();
    state.attempts = 0;
    state.currentPoints = 100;
    state.selectedComponent = null;
    state.suspect = null;

    const activeCase = getActiveCase();
    dom.caseNumber.textContent = `CASO ${String(state.caseIndex + 1).padStart(2, "0")}`;
    dom.caseTitle.textContent = activeCase.title;
    dom.caseSymptom.textContent = activeCase.symptom;
    dom.severityBadge.textContent = `NÍVEL ${activeCase.level}`;
    dom.sessionCase.textContent = `${String(state.caseIndex + 1).padStart(2, "0")}/${String(TOTAL_CASES).padStart(2, "0")}`;
    dom.technicalNote.value = "";
    dom.diagnosisSelect.value = "";
    dom.terminalLog.replaceChildren();

    renderPowerState();
    renderTools();
    renderComponents(getActiveCategory());
    updateCounters();
    updateScore();
    setMonitor("off", "<span class=\"screen-off-label\">SEM ENERGIA</span>");
    addLog(`Ordem de serviço carregada: ${activeCase.title}`, "info", "CASE");
    addLog("Colete evidências antes de registrar o diagnóstico.", "info", "SYS");
  }

  function togglePower() {
    if (state.computerOn) {
      powerOff();
    } else {
      powerOn();
    }
  }

  function powerOn() {
    const activeCase = getActiveCase();
    state.bootToken += 1;
    const token = state.bootToken;
    state.computerOn = true;
    renderPowerState();
    addLog("Botão de energia acionado. Solicitando partida da estação.", "info", "PWR");

    if (activeCase.boot === "no-power") {
      state.computerOn = false;
      renderPowerState("fault");
      setMonitor("off", "<span class=\"screen-off-label\">SEM ENERGIA</span>");
      addLog("Sem resposta elétrica: linha de standby não detectada.", "error", "PWR");
      showToast("O computador não respondeu ao comando de partida.", "error");
      return;
    }

    setMonitor(
      "booting",
      '<div class="screen-logo">SIMULAB UEFI</div><span class="screen-status-label">INICIALIZANDO HARDWARE</span><div class="screen-progress"></div>',
    );
    addLog("Tensões principais estabilizadas. POST em execução.", "info", "POST");

    window.setTimeout(() => {
      if (!state.computerOn || token !== state.bootToken) return;
      showBootOutcome(activeCase);
    }, 1150);
  }

  function powerOff() {
    state.bootToken += 1;
    state.computerOn = false;
    renderPowerState();
    setMonitor("off", "<span class=\"screen-off-label\">SEM ENERGIA</span>");
    addLog("Desligamento manual executado.", "warning", "PWR");
  }

  function showBootOutcome(activeCase) {
    const outcomes = {
      "beep-no-video": () => {
        setMonitor("no-signal", '<span class="screen-status-label">SEM SINAL</span>');
        addLog("Código sonoro detectado: três bipes longos repetidos.", "error", "POST");
      },
      "no-boot-device": () => {
        setMonitor(
          "bios",
          '<p class="screen-message">SIMULAB UEFI v2.8\n\nNo bootable device detected.\nInsert boot media and press any key.</p>',
        );
        addLog("POST finalizado, mas nenhum dispositivo inicializável foi localizado.", "error", "BOOT");
      },
      overheat: () => {
        setDesktop("CPU FAN ERROR — temperatura subindo");
        addLog("Sistema carregado com alerta de ventilador da CPU.", "warning", "THERM");
        const token = state.bootToken;
        window.setTimeout(() => {
          if (!state.computerOn || token !== state.bootToken) return;
          setMonitor(
            "critical",
            '<div class="screen-content centered"><div class="screen-logo">PROTEÇÃO TÉRMICA</div><p class="screen-message screen-message--error">Temperatura crítica detectada.\nDesligamento de emergência executado.</p></div>',
          );
          state.computerOn = false;
          renderPowerState("fault");
          addLog("CPU atingiu o limite térmico. Proteção desligou a estação.", "error", "THERM");
        }, 5200);
      },
      "display-cable": () => {
        setMonitor("no-signal", '<span class="screen-status-label">HDMI — SEM SINAL</span>');
        addLog("POST concluído. O sistema continua ativo sem imagem no monitor.", "warning", "VIDEO");
      },
      "network-offline": () => {
        setDesktop("Rede: adaptador Ethernet indisponível");
        addLog("Sistema carregado. Nenhuma interface Ethernet foi criada.", "warning", "NET");
      },
      malware: () => {
        setDesktop("CPU 98% — múltiplas janelas em segundo plano");
        addLog("Área de trabalho carregada com degradação severa de desempenho.", "warning", "SYS");
      },
      "usb-boot": () => {
        setMonitor(
          "bios",
          '<p class="screen-message">Attempting boot from USB Mass Storage...\n\nMissing operating system.\nPress Ctrl+Alt+Del to restart.</p>',
        );
        addLog("A UEFI selecionou USB Mass Storage como primeiro dispositivo.", "error", "BOOT");
      },
      "repair-loop": () => {
        setMonitor(
          "error",
          '<div class="screen-content centered"><div class="screen-logo">REPARO AUTOMÁTICO</div><p class="screen-message">Não foi possível reparar o computador.\nCódigo: 0xc0000098</p></div>',
        );
        addLog("Falha recorrente no carregador do sistema; ambiente de recuperação ativo.", "error", "OS");
      },
      "dns-error": () => {
        setDesktop("Conectado — falha ao resolver nomes de domínio");
        addLog("Sistema carregado. Interface de rede possui endereço IP.", "info", "NET");
      },
    };

    (outcomes[activeCase.boot] || (() => setDesktop("Sistema operacional carregado")))();
  }

  function setDesktop(statusText) {
    setMonitor(
      "desktop",
      `<div class="screen-content"><div class="screen-logo">SIMULAB OS</div><p class="screen-message">Sessão técnica iniciada.\n\nSTATUS: ${escapeHtml(statusText)}</p></div>`,
    );
  }

  function setMonitor(mode, html) {
    dom.monitorScreen.className = `monitor-screen is-${mode}`;
    dom.screenContent.className = "screen-content";
    dom.screenContent.innerHTML = html;
    dom.monitorLed.className = "monitor-led";

    if (mode === "off") return;
    dom.monitorLed.classList.add(mode === "no-signal" ? "is-warning" : "is-on");
  }

  function renderPowerState(forcedState = null) {
    const isOn = state.computerOn;
    dom.powerState.textContent = isOn ? "ON" : "OFF";
    dom.powerState.className = `state-pill ${isOn ? "is-on" : "is-off"}`;
    dom.powerButton.classList.toggle("is-on", isOn);
    dom.powerButton.setAttribute("aria-pressed", String(isOn));
    dom.powerButtonLabel.textContent = isOn ? "Desligar computador" : "Ligar computador";
    dom.powerHint.textContent = isOn
      ? "A estação está energizada. Observe o comportamento."
      : forcedState === "fault"
        ? "O comando foi enviado, mas a partida falhou."
        : "A estação está desenergizada.";
    dom.towerUnit.classList.toggle("is-on", isOn);
    dom.towerLed.className = "tower-led";

    if (isOn) {
      dom.towerLed.classList.add("is-on");
      dom.towerStatusText.textContent = "ENERGIZADO";
    } else if (forcedState === "fault") {
      dom.towerLed.classList.add("is-error");
      dom.towerStatusText.textContent = "FALHA";
    } else {
      dom.towerStatusText.textContent = "DESLIGADO";
    }
  }

  function renderTools() {
    dom.toolGrid.replaceChildren();
    tools.forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tool-button";
      button.dataset.tool = tool.id;
      button.classList.toggle("is-used", state.usedTools.has(tool.id));
      button.innerHTML = `<span class="tool-icon">${tool.short}</span><span class="tool-label">${tool.name}</span>`;
      button.addEventListener("click", () => runTool(tool));
      dom.toolGrid.append(button);
    });
  }

  function runTool(tool) {
    if (tool.requiresPower && !state.computerOn) {
      addLog(`${tool.name}: ligue o computador para executar este teste.`, "warning", tool.short);
      showToast("Este teste exige que o computador esteja ligado.", "warning");
      return;
    }

    const firstUse = !state.usedTools.has(tool.id);
    state.usedTools.add(tool.id);
    if (firstUse) state.currentPoints = Math.max(20, state.currentPoints - TOOL_COST);

    const evidence = getActiveCase().diagnostics[tool.id];
    addLog(evidence, evidence.includes("Indisponível") ? "warning" : "success", tool.short);
    renderTools();
    updateCounters();
    updateScore();
  }

  function renderComponents(category) {
    dom.componentGrid.replaceChildren();
    components
      .filter((component) => component.category === category)
      .forEach((component) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "component-button";
        button.classList.toggle("is-inspected", state.inspectedComponents.has(component.id));
        button.innerHTML = `<span class="component-icon">${component.short}</span><span class="component-label">${component.name}</span>`;
        button.addEventListener("click", () => inspectComponent(component));
        dom.componentGrid.append(button);
      });
  }

  function selectComponentCategory(event) {
    const category = event.currentTarget.dataset.category;
    dom.tabs.forEach((tab) => {
      const selected = tab.dataset.category === category;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
    renderComponents(category);
  }

  function getActiveCategory() {
    return dom.tabs.find((tab) => tab.classList.contains("is-active"))?.dataset.category || "hardware";
  }

  function inspectComponent(component) {
    state.selectedComponent = component;
    state.inspectedComponents.add(component.id);
    dom.dialogIcon.textContent = component.short;
    dom.dialogCategory.textContent = component.category === "hardware" ? "Hardware" : "Software";
    dom.dialogTitle.textContent = component.name;
    dom.dialogDescription.textContent = component.description;
    dom.dialogMetrics.replaceChildren();

    component.metrics.forEach(([label, value]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      dom.dialogMetrics.append(row);
    });

    const alreadyTested = state.testedComponents.has(component.id);
    dom.dialogEvidence.textContent = alreadyTested
      ? getComponentEvidence(component.id)
      : "Execute o teste para obter dados deste componente.";
    dom.markSuspectButton.textContent = state.suspect === component.id ? "Suspeita registrada" : "Marcar como suspeito";
    dom.markSuspectButton.disabled = state.suspect === component.id;
    dom.runComponentTest.textContent = alreadyTested ? "Repetir teste" : "Executar teste";

    renderComponents(getActiveCategory());
    updateCounters();
    dom.inspectionDialog.showModal();
  }

  function runSelectedComponentTest() {
    const component = state.selectedComponent;
    if (!component) return;

    const firstUse = !state.testedComponents.has(component.id);
    state.testedComponents.add(component.id);
    if (firstUse) state.currentPoints = Math.max(20, state.currentPoints - TOOL_COST);

    const evidence = getComponentEvidence(component.id);
    dom.dialogEvidence.textContent = evidence;
    dom.runComponentTest.textContent = "Repetir teste";
    addLog(`${component.name}: ${evidence}`, "success", component.short);
    updateCounters();
    updateScore();
  }

  function getComponentEvidence(componentId) {
    return (
      getActiveCase().clues[componentId] ||
      "Parâmetros normais para este cenário; nenhuma anomalia relevante foi identificada."
    );
  }

  function markSelectedComponent() {
    const component = state.selectedComponent;
    if (!component) return;
    state.suspect = component.id;
    dom.markSuspectButton.textContent = "Suspeita registrada";
    dom.markSuspectButton.disabled = true;
    addLog(`${component.name} marcado como componente suspeito.`, "warning", "NOTE");
    showToast(`${component.name} foi registrado como suspeito.`, "success");
  }

  function fillDiagnosisOptions() {
    const diagnoses = [...new Set(cases.map((item) => item.diagnosis))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

    diagnoses.forEach((diagnosis) => {
      const option = document.createElement("option");
      option.value = diagnosis;
      option.textContent = diagnosis;
      dom.diagnosisSelect.append(option);
    });
  }

  function submitDiagnosis() {
    const selected = dom.diagnosisSelect.value;
    if (!selected) {
      showToast("Selecione uma hipótese antes de confirmar.", "warning");
      dom.diagnosisSelect.focus();
      return;
    }

    state.attempts += 1;
    const activeCase = getActiveCase();

    if (selected === activeCase.diagnosis) {
      const gained = Math.max(20, state.currentPoints);
      state.score += gained;
      updateScore();
      addLog(`Diagnóstico confirmado: ${selected}. +${gained} pontos.`, "success", "OK");
      showCaseResult(gained);
      return;
    }

    state.currentPoints = Math.max(20, state.currentPoints - WRONG_ANSWER_COST);
    addLog(`Hipótese descartada: ${selected}. Evidências não convergem.`, "error", "FAIL");
    showToast("Diagnóstico incorreto. Reavalie as evidências coletadas.", "error");
    updateCounters();
    updateScore();
  }

  function showCaseResult(gained) {
    const activeCase = getActiveCase();
    const lastCase = state.caseIndex === TOTAL_CASES - 1;
    dom.resultMark.textContent = lastCase ? "★" : "✓";
    dom.resultMark.classList.toggle("is-final", lastCase);
    dom.resultEyebrow.textContent = lastCase ? "Sessão concluída" : "Diagnóstico confirmado";
    dom.resultTitle.textContent = activeCase.diagnosis;
    dom.resultMessage.textContent = activeCase.explanation;
    dom.resultDetails.innerHTML = `
      <div class="result-stat"><span>Pontos do caso</span><strong>+${gained}</strong></div>
      <div class="result-stat"><span>Tentativas</span><strong>${state.attempts}</strong></div>
      <div class="result-stat"><span>Total</span><strong>${state.score}</strong></div>
    `;
    dom.nextCaseButton.textContent = lastCase ? "Ver resultado final" : "Próximo caso";
    dom.resultDialog.showModal();
  }

  function advanceCase() {
    if (state.finished) {
      window.location.reload();
      return;
    }

    dom.resultDialog.close();

    if (state.caseIndex < TOTAL_CASES - 1) {
      state.caseIndex += 1;
      loadCase();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    finishSession();
  }

  function finishSession() {
    clearInterval(state.timerId);
    state.finished = true;
    const maxScore = TOTAL_CASES * 100;
    const percentage = Math.round((state.score / maxScore) * 100);
    const performance =
      percentage >= 90
        ? "Diagnóstico de nível avançado"
        : percentage >= 70
          ? "Bom domínio do processo técnico"
          : percentage >= 50
            ? "Desempenho intermediário"
            : "Necessita revisar o método de diagnóstico";

    dom.resultMark.textContent = "★";
    dom.resultMark.classList.add("is-final");
    dom.resultEyebrow.textContent = "Relatório final";
    dom.resultTitle.textContent = `${state.student}, sessão concluída`;
    dom.resultMessage.textContent = performance;
    dom.resultDetails.innerHTML = `
      <div class="result-stat"><span>Pontuação</span><strong>${state.score}/${maxScore}</strong></div>
      <div class="result-stat"><span>Aproveitamento</span><strong>${percentage}%</strong></div>
      <div class="result-stat"><span>Tempo</span><strong>${formatTime(state.elapsed)}</strong></div>
    `;
    dom.nextCaseButton.textContent = "Iniciar nova sessão";
    dom.resultDialog.showModal();
    document.title = "SimulaPC — Sessão concluída";
  }

  function updateCounters() {
    const tests = state.usedTools.size + state.testedComponents.size;
    dom.toolCounter.textContent = `${tests} ${tests === 1 ? "teste" : "testes"}`;
    dom.inspectionCounter.textContent = `${state.inspectedComponents.size} vistos`;
    dom.attemptsBadge.textContent = `${state.attempts} ${state.attempts === 1 ? "tentativa" : "tentativas"}`;
  }

  function updateScore() {
    dom.sessionScore.textContent = String(state.score).padStart(4, "0");
  }

  function addLog(message, type = "info", label = "SYS") {
    const entry = document.createElement("div");
    entry.className = `log-entry is-${type}`;
    entry.innerHTML = `<span class="log-time">${formatTime(state.elapsed)}</span><span class="log-type">[${escapeHtml(label)}]</span><span>${escapeHtml(message)}</span>`;
    dom.terminalLog.append(entry);
    dom.terminalLog.scrollTop = dom.terminalLog.scrollHeight;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast is-${type}`;
    toast.textContent = message;
    dom.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function getActiveCase() {
    return state.selectedCases[state.caseIndex];
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
    }
    return items;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  initialize();
})();
