(() => {
  "use strict";

  const {
    hardwareParts,
    diagnosticTools,
    softwareActions,
    simulations,
    cases,
  } = window.SIMULATOR_DATA;

  const TOTAL_CASES = 5;
  const TOOL_COST = 3;
  const WRONG_ACTION_COST = 20;
  const MINIMUM_CASE_SCORE = 20;

  const state = {
    student: "",
    institution: "",
    selectedCases: [],
    caseIndex: 0,
    score: 0,
    elapsed: 0,
    timerId: null,
    computerOn: false,
    powerAttempted: false,
    currentPoints: 100,
    errors: 0,
    usedTools: new Set(),
    selectedPart: null,
    draggedPart: null,
    replacedPart: null,
    busy: false,
    caseResolved: false,
    finished: false,
    sequenceToken: 0,
  };

  const dom = {};
  const monitorModes = [
    "off",
    "booting",
    "terminal",
    "bios",
    "error",
    "critical",
    "desktop",
    "device",
    "security",
    "setup",
    "artifacts",
    "windows-setup",
    "windows-desktop",
    "winre",
  ];

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
      "caseMode",
      "caseTitle",
      "caseSymptom",
      "severityBadge",
      "monitorSignal",
      "monitorScreen",
      "screenContent",
      "labWorkspace",
      "hardwareView",
      "cabinetState",
      "openCabinet",
      "cabinetSlots",
      "cabinetHelp",
      "softwareView",
      "systemState",
      "factUefi",
      "factStorage",
      "factOs",
      "factNetwork",
      "toolGrid",
      "toolCounter",
      "terminalLog",
      "clearLogButton",
      "powerState",
      "powerButton",
      "powerButtonDetail",
      "powerHint",
      "actionEyebrow",
      "actionHeading",
      "attemptsBadge",
      "actionHelp",
      "partsTray",
      "softwareActions",
      "selectedPart",
      "selectedPartVisual",
      "selectedPartName",
      "cancelPartButton",
      "casePoints",
      "scoreTrackFill",
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

    dom.monitorLed = document.querySelector(".monitor-led");
    dom.powerButtonLabel = document.querySelector(".power-button__label");
  }

  function bindEvents() {
    dom.accessForm.addEventListener("submit", startSession);
    dom.powerButton.addEventListener("click", togglePower);
    dom.clearLogButton.addEventListener("click", () => {
      dom.terminalLog.replaceChildren();
      addLog("Registro visual limpo pelo participante.", "info", "LOG");
    });
    dom.cancelPartButton.addEventListener("click", clearSelectedPart);
    dom.nextCaseButton.addEventListener("click", advanceCase);
    dom.resultDialog.addEventListener("cancel", (event) => event.preventDefault());
  }

  function initialize() {
    cacheDom();
    bindEvents();
    renderTools();
    renderCabinet();
    renderPartsTray();
    renderSoftwareActions();
    updateScore();
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
    state.selectedCases = selectCases();
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

  function selectCases() {
    const hardwareCases = shuffle(cases.filter((item) => item.kind === "hardware")).slice(0, 3);
    const softwareCases = shuffle(cases.filter((item) => item.kind === "software")).slice(0, 2);
    return shuffle([...hardwareCases, ...softwareCases]);
  }

  function startTimer() {
    window.clearInterval(state.timerId);
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
    state.sequenceToken += 1;
    state.computerOn = false;
    state.powerAttempted = false;
    state.currentPoints = 100;
    state.errors = 0;
    state.usedTools.clear();
    state.selectedPart = null;
    state.draggedPart = null;
    state.replacedPart = null;
    state.busy = false;
    state.caseResolved = false;

    const activeCase = getActiveCase();
    const caseNumber = String(state.caseIndex + 1).padStart(2, "0");

    dom.caseNumber.textContent = `CASO ${caseNumber}`;
    dom.caseMode.textContent = activeCase.kind === "hardware" ? "HARDWARE" : "SOFTWARE";
    dom.caseTitle.textContent = activeCase.title;
    dom.caseSymptom.textContent = activeCase.symptom;
    dom.severityBadge.textContent = `NÍVEL ${activeCase.level}`;
    dom.sessionCase.textContent = `${caseNumber}/${String(TOTAL_CASES).padStart(2, "0")}`;
    dom.terminalLog.replaceChildren();

    configureCaseMode(activeCase);
    renderCabinet();
    renderPartsTray();
    renderSoftwareActions();
    renderTools();
    renderPowerState();
    updateCounters();
    updateScore();
    setMonitor("off", '<span class="screen-off-label">COMPUTADOR DESLIGADO</span>');

    addLog(`Ordem de serviço carregada: ${activeCase.title}`, "info", "CASO");
    addLog(
      activeCase.kind === "hardware"
        ? "Ligue o PC, confirme os sintomas e troque a peça com o computador desligado."
        : "Ligue o PC, observe a tela e execute o procedimento correto.",
      "info",
      "SYS",
    );
  }

  function configureCaseMode(activeCase) {
    const isHardware = activeCase.kind === "hardware";
    dom.labWorkspace.classList.toggle("is-hardware-mode", isHardware);
    dom.labWorkspace.classList.toggle("is-software-mode", !isHardware);
    dom.hardwareView.hidden = !isHardware;
    dom.softwareView.hidden = isHardware;
    dom.partsTray.hidden = !isHardware;
    dom.softwareActions.hidden = isHardware;
    dom.selectedPart.hidden = true;

    dom.actionEyebrow.textContent = isHardware ? "Intervenção física" : "Intervenção no sistema";
    dom.actionHeading.textContent = isHardware ? "Peças de reposição" : "Procedimentos disponíveis";
    dom.actionHelp.textContent = isHardware
      ? "Arraste a peça até o mesmo componente no gabinete. No celular, toque na peça e depois no encaixe."
      : "Escolha o procedimento e acompanhe a execução diretamente no monitor.";
    dom.cabinetHelp.textContent = "Arraste uma peça para o encaixe correspondente ou use dois toques.";

    updateSystemFacts(activeCase);
  }

  function updateSystemFacts(activeCase) {
    const factsByBoot = {
      "no-os": ["Operacional", "SSD 480 GB", "Não instalado", "Indisponível"],
      "repair-loop": ["Operacional", "Saudável", "Boot corrompido", "Não iniciado"],
      "driver-missing": ["Operacional", "Saudável", "Em execução", "Sem driver"],
      malware: ["Operacional", "Saudável", "CPU 96%", "Conexões suspeitas"],
      "dns-error": ["Operacional", "Saudável", "Em execução", "DNS sem resposta"],
      "usb-boot": ["USB primeiro", "Saudável", "Instalado", "Não iniciado"],
    };
    const [uefi, storage, os, network] = factsByBoot[activeCase.boot] || [
      "Operacional",
      "Verificando",
      "Verificando",
      "Verificando",
    ];
    dom.factUefi.textContent = uefi;
    dom.factStorage.textContent = storage;
    dom.factOs.textContent = os;
    dom.factNetwork.textContent = network;
  }

  function togglePower() {
    if (state.busy || state.caseResolved) return;
    if (state.computerOn) powerOff();
    else powerOn();
  }

  function powerOn() {
    const activeCase = getActiveCase();
    state.sequenceToken += 1;
    const token = state.sequenceToken;
    state.powerAttempted = true;
    state.computerOn = true;
    renderPowerState();
    addLog("Botão de energia pressionado. Iniciando a estação.", "info", "PWR");

    if (activeCase.boot === "no-power") {
      state.computerOn = false;
      renderPowerState("fault");
      dom.openCabinet.classList.add("is-power-failed");
      window.setTimeout(() => dom.openCabinet.classList.remove("is-power-failed"), 900);
      setMonitor("off", '<span class="screen-off-label">SEM ENERGIA</span>');
      addLog("Nenhuma resposta elétrica; a linha +5VSB não foi detectada.", "error", "PWR");
      showToast("O computador não apresentou nenhum sinal elétrico.", "error");
      return;
    }

    setMonitor(
      "booting",
      '<div class="screen-logo">SIMULAB UEFI</div><span class="screen-status-label">INICIALIZANDO HARDWARE</span><div class="screen-progress"><span style="width:42%"></span></div>',
    );
    addLog("Tensões estabilizadas. POST em execução.", "info", "POST");

    window.setTimeout(() => {
      if (!state.computerOn || token !== state.sequenceToken) return;
      showBootOutcome(activeCase, token);
    }, 1050);
  }

  function powerOff() {
    state.sequenceToken += 1;
    state.computerOn = false;
    renderPowerState();
    setMonitor("off", '<span class="screen-off-label">COMPUTADOR DESLIGADO</span>');
    addLog("Desligamento manual executado. Gabinete seguro para intervenção.", "warning", "PWR");
  }

  function showBootOutcome(activeCase, token = state.sequenceToken) {
    if (!state.computerOn || token !== state.sequenceToken) return;

    const outcomes = {
      "disk-failure": () => {
        setMonitor(
          "bios",
          textScreen(
            "S.M.A.R.T. STATUS BAD",
            "SATA Port 1: SSD 480 GB\nStatus: BAD — Backup and Replace\n\nPressione F1 para entrar no Setup.",
            true,
          ),
          "ALERTA UEFI",
        );
        addLog("UEFI: S.M.A.R.T. Status BAD no HD/SSD SATA.", "error", "DISK");
      },
      "memory-error": () => {
        setMonitor("error", '<span class="screen-status-label">SEM SINAL DE VÍDEO</span>', "SEM SINAL");
        addLog("Três bipes longos repetidos; POST interrompido no teste de memória.", "error", "POST");
      },
      overheat: () => {
        setMonitor(
          "bios",
          textScreen("CPU FAN ERROR", "CPU Fan Speed: 0 RPM\nCPU Temperature: 96 °C\n\nSystem will shut down to prevent damage.", true),
          "ALERTA TÉRMICO",
        );
        addLog("CPU_FAN registra 0 RPM; proteção térmica acionada.", "error", "TEMP");
        window.setTimeout(() => {
          if (!state.computerOn || token !== state.sequenceToken || state.busy) return;
          setMonitor(
            "critical",
            textScreen("DESLIGAMENTO DE PROTEÇÃO", "Temperatura crítica detectada.\nA energia foi interrompida para proteger o processador.", true),
            "PROTEÇÃO",
          );
          state.computerOn = false;
          renderPowerState("fault");
          addLog("Estação desligada automaticamente por temperatura crítica.", "error", "TEMP");
        }, 3500);
      },
      "video-artifacts": () => {
        setMonitor(
          "artifacts",
          textScreen("Falha no adaptador gráfico", "O driver de vídeo parou de responder e se recuperou.\nCódigo: VIDEO_TDR_FAILURE", true),
          "SINAL INSTÁVEL",
        );
        addLog("Artefatos e reinicialização do driver gráfico detectados.", "error", "GPU");
      },
      "network-card-failure": () => {
        setMonitor(
          "desktop",
          screenWindow("Status da Rede", "Cabo de rede desconectado", 100, ["Nenhum adaptador Ethernet disponível", "LED de link: apagado"]),
          "SISTEMA ATIVO",
        );
        addLog("Sistema iniciado, mas nenhum enlace Ethernet foi estabelecido.", "warning", "NET");
      },
      "no-os": () => {
        setMonitor(
          "bios",
          textScreen("NO BOOTABLE DEVICE", "O HD/SSD foi detectado, mas não contém um sistema inicializável.\n\nInsert boot media and press any key.", true),
          "SEM SISTEMA",
        );
        addLog("HD/SSD detectado sem sistema operacional inicializável.", "warning", "BOOT");
      },
      "repair-loop": () => {
        setMonitor(
          "error",
          screenWindow("Recuperação", "O PC precisa ser reparado — código 0xc0000098", 18, ["O arquivo de configuração de inicialização não contém informações válidas.", "Pressione F1 para entrar no Ambiente de Recuperação."]),
          "RECUPERAÇÃO",
        );
        addLog("Windows Boot Manager retornou o código 0xc0000098.", "error", "BOOT");
      },
      "driver-missing": () => {
        setMonitor(
          "device",
          screenWindow("Gerenciador de Dispositivos", "Controlador Ethernet — dispositivo desconhecido", 100, ["Os drivers deste dispositivo não estão instalados. (Código 28)", "Hardware ID: PCI\\VEN_10EC&DEV_8168"]),
          "SISTEMA ATIVO",
        );
        addLog("Controlador Ethernet identificado sem driver: código 28.", "warning", "DRV");
      },
      malware: () => {
        setMonitor(
          "security",
          screenWindow("Gerenciador de Tarefas", "Uso de CPU: 96%", 96, ["update_service.exe — 89,4%", "Várias janelas indesejadas foram abertas."]),
          "SISTEMA LENTO",
        );
        addLog("Processo desconhecido mantém carga alta e conexões externas.", "error", "SEC");
      },
      "dns-error": () => {
        setMonitor(
          "desktop",
          screenWindow("Navegador", "Não foi possível encontrar o endereço DNS", 100, ["ERR_NAME_NOT_RESOLVED", "A conexão por endereço IP continua respondendo."]),
          "REDE LIMITADA",
        );
        addLog("Conectividade IP ativa; resolução de nomes falhou.", "warning", "DNS");
      },
      "usb-boot": () => {
        setMonitor(
          "bios",
          textScreen("MISSING OPERATING SYSTEM", "Boot device: USB Mass Storage\nNo operating system found.\n\nRemove media or change boot priority.", true),
          "BOOT USB",
        );
        addLog("UEFI tentou iniciar pelo dispositivo USB conectado.", "warning", "UEFI");
      },
    };

    const renderOutcome = outcomes[activeCase.boot];
    if (renderOutcome) renderOutcome();
    else {
      setMonitor("desktop", screenWindow("Sistema", "Área de trabalho carregada", 100, ["Nenhum alerta registrado."]), "SISTEMA ATIVO");
      addLog("Sistema operacional iniciado.", "success", "BOOT");
    }
  }

  function renderPowerState(status = "normal") {
    const isOn = state.computerOn;
    dom.powerState.textContent = isOn ? "ON" : status === "fault" ? "FALHA" : "OFF";
    dom.powerState.className = `state-pill ${isOn ? "is-on" : "is-off"}`;
    dom.powerButton.classList.toggle("is-on", isOn);
    dom.powerButton.setAttribute("aria-pressed", String(isOn));
    dom.powerButtonLabel.textContent = isOn ? "Desligar computador" : "Ligar computador";
    dom.powerButtonDetail.textContent = isOn
      ? "Pressione antes de trocar qualquer peça"
      : "Pressione para observar a inicialização";
    dom.powerHint.textContent = isOn
      ? "O computador está energizado. Não remova componentes."
      : status === "fault"
        ? "A tentativa de partida falhou."
        : "A estação está desenergizada.";

    dom.monitorLed.className = `monitor-led${isOn ? " is-on" : status === "fault" ? " is-warning" : ""}`;
    dom.cabinetState.textContent = isOn ? "ENERGIZADO — NÃO TOCAR" : "SEGURO PARA MANUTENÇÃO";
    dom.cabinetState.className = `cabinet-state ${isOn ? "is-danger" : "is-safe"}`;
    dom.systemState.textContent = isOn ? "SISTEMA ATIVO" : "DESLIGADO";
    dom.systemState.className = `system-state ${isOn ? "is-ready" : ""}`;
    updateCabinetVisualState(status);
    refreshInteractiveState();
  }

  function updateCabinetVisualState(status = "normal") {
    if (!dom.openCabinet) return;
    const activeCase = getActiveCase();
    const faultPart = activeCase?.kind === "hardware" ? activeCase.correctPart : "";
    const faultResolved = state.replacedPart === faultPart;

    dom.openCabinet.classList.toggle("is-powered", state.computerOn);
    dom.openCabinet.classList.toggle("is-fault-active", Boolean(state.computerOn && faultPart && !faultResolved));
    dom.openCabinet.dataset.faultPart = faultResolved ? "" : faultPart;
    dom.openCabinet.dataset.powerStatus = status;

    dom.cabinetSlots.querySelectorAll(".cabinet-slot").forEach((slot) => {
      slot.classList.toggle("is-faulty", state.computerOn && !faultResolved && slot.dataset.partId === faultPart);
      slot.classList.toggle("is-repaired", state.replacedPart === slot.dataset.partId);
    });
  }

  function renderCabinet() {
    dom.cabinetSlots.replaceChildren();

    hardwareParts.forEach((part) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = `cabinet-slot cabinet-slot--${part.id}`;
      slot.dataset.partId = part.id;
      slot.setAttribute("aria-label", `${part.name} instalado. Encaixe para peça de reposição.`);

      const visual = document.createElement("span");
      visual.className = `hardware-visual hardware-visual--${part.id}`;
      visual.setAttribute("aria-hidden", "true");
      visual.innerHTML = hardwareVisualMarkup(part.id, "installed");

      const tooltip = document.createElement("span");
      tooltip.className = "component-tooltip";
      tooltip.textContent = part.name;
      slot.append(visual, tooltip);

      slot.addEventListener("click", () => {
        if (!state.selectedPart) {
          showToast("Primeiro selecione uma peça de reposição.", "warning");
          return;
        }
        attemptHardwareReplacement(state.selectedPart, part.id);
      });
      slot.addEventListener("dragover", (event) => {
        if (!state.draggedPart || state.busy || state.caseResolved) return;
        event.preventDefault();
        slot.classList.add("is-drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("is-drag-over"));
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("is-drag-over");
        const partId = state.draggedPart || event.dataTransfer.getData("text/plain");
        state.draggedPart = null;
        if (partId) attemptHardwareReplacement(partId, part.id);
      });

      dom.cabinetSlots.append(slot);
    });
    updateCabinetVisualState();
  }

  function renderPartsTray() {
    dom.partsTray.replaceChildren();

    hardwareParts.forEach((part) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "part-card";
      button.dataset.partId = part.id;
      button.draggable = true;
      button.setAttribute("aria-label", `Selecionar ${part.name} de reposição`);

      const iconHolder = document.createElement("span");
      iconHolder.className = `part-card__visual part-card__visual--${part.id}`;
      iconHolder.setAttribute("aria-hidden", "true");
      iconHolder.innerHTML = hardwareVisualMarkup(part.id, "replacement");

      const label = document.createElement("span");
      label.className = "part-card__label";
      label.textContent = part.name;
      const code = document.createElement("small");
      code.className = "part-card__code";
      code.textContent = part.short;
      button.append(iconHolder, label, code);

      button.addEventListener("click", () => selectPart(part.id));
      button.addEventListener("dragstart", (event) => {
        if (state.busy || state.caseResolved) {
          event.preventDefault();
          return;
        }
        state.draggedPart = part.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", part.id);
        selectPart(part.id);
      });
      button.addEventListener("dragend", () => {
        state.draggedPart = null;
        document.querySelectorAll(".cabinet-slot.is-drag-over").forEach((slot) => slot.classList.remove("is-drag-over"));
      });

      dom.partsTray.append(button);
    });
    refreshInteractiveState();
  }

  function selectPart(partId) {
    if (state.busy || state.caseResolved || getActiveCase()?.kind !== "hardware") return;
    const part = getHardwarePart(partId);
    if (!part) return;

    state.selectedPart = partId;
    dom.selectedPart.hidden = false;
    dom.selectedPartVisual.innerHTML = hardwareVisualMarkup(part.id, "selected");
    dom.selectedPartName.textContent = part.name;
    dom.cabinetHelp.textContent = `Agora coloque ${part.name} no encaixe destacado.`;

    document.querySelectorAll(".part-card").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.partId === partId);
    });
    document.querySelectorAll(".cabinet-slot").forEach((slot) => {
      slot.classList.toggle("is-compatible", slot.dataset.partId === partId);
    });
  }

  function clearSelectedPart() {
    state.selectedPart = null;
    dom.selectedPart.hidden = true;
    dom.selectedPartVisual.replaceChildren();
    dom.cabinetHelp.textContent = "Arraste uma peça para o encaixe correspondente ou use dois toques.";
    document.querySelectorAll(".part-card.is-selected").forEach((button) => button.classList.remove("is-selected"));
    document.querySelectorAll(".cabinet-slot.is-compatible").forEach((slot) => slot.classList.remove("is-compatible"));
  }

  function hardwareVisualMarkup(partId, context = "installed") {
    const fan = (modifier = "") => `<span class="fan-assembly ${modifier}"><span class="fan-ring"></span><span class="fan-rotor"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b></span></span>`;

    const visuals = {
      motherboard: `
        <svg class="motherboard-svg" viewBox="0 0 300 340" preserveAspectRatio="none" role="presentation">
          <defs>
            <linearGradient id="pcb-${context}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#123f3c"/><stop offset="1" stop-color="#071d23"/></linearGradient>
            <linearGradient id="metal-${context}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c9d4d7"/><stop offset=".48" stop-color="#53636b"/><stop offset="1" stop-color="#d8e1e2"/></linearGradient>
          </defs>
          <path d="M8 8h255l29 29v295H8z" fill="url(#pcb-${context})" stroke="#3d7771" stroke-width="4"/>
          <g fill="none" stroke="#2b7770" stroke-width="2" opacity=".7">
            <path d="M23 180h55l22-22h84l25-32h62"/><path d="M20 232h66l26 25h152"/><path d="M35 86h48l31-31h93l22 22h48"/><path d="M47 303v-30h92l27 26h90"/><path d="M169 20v35l-26 21v55"/>
          </g>
          <g fill="#7ca39d"><circle cx="25" cy="25" r="5"/><circle cx="274" cy="48" r="5"/><circle cx="274" cy="313" r="5"/><circle cx="25" cy="313" r="5"/></g>
          <rect x="82" y="58" width="92" height="92" rx="5" fill="#183138" stroke="url(#metal-${context})" stroke-width="5"/>
          <rect x="92" y="68" width="72" height="72" fill="#c6b57d" stroke="#59656a" stroke-width="2"/>
          <g fill="#202b31" stroke="#75858b"><rect x="191" y="35" width="9" height="150"/><rect x="207" y="35" width="9" height="150"/><rect x="223" y="35" width="9" height="150"/><rect x="239" y="35" width="9" height="150"/></g>
          <g fill="#c8d1d3"><rect x="17" y="43" width="48" height="21"/><rect x="17" y="70" width="48" height="28"/><rect x="17" y="104" width="48" height="18"/></g>
          <rect x="30" y="194" width="228" height="13" rx="2" fill="#e7e9df"/><rect x="30" y="218" width="228" height="9" rx="2" fill="#263940"/>
          <rect x="30" y="244" width="160" height="10" rx="2" fill="#e7e9df"/><rect x="30" y="267" width="116" height="9" rx="2" fill="#263940"/>
          <g fill="#aebcc0" stroke="#4e5d62"><circle cx="72" cy="166" r="8"/><circle cx="91" cy="166" r="8"/><circle cx="166" cy="168" r="8"/><circle cx="178" cy="168" r="8"/><circle cx="262" cy="205" r="7"/></g>
          <rect x="196" y="238" width="65" height="54" rx="4" fill="#15272d" stroke="#76868b"/><path d="M205 248h47v34h-47z" fill="#263c42"/><text x="228" y="271" fill="#89a5a4" font-size="9" text-anchor="middle">CHIPSET</text>
          <g fill="#161d20" stroke="#859398"><rect x="270" y="97" width="17" height="13"/><rect x="270" y="116" width="17" height="13"/><rect x="270" y="135" width="17" height="13"/><rect x="270" y="154" width="17" height="13"/></g>
          <text x="25" y="326" fill="#7fb7af" font-size="10" font-family="monospace">SIMULAB B650M</text>
        </svg>`,
      power: `
        <span class="psu-unit">
          <span class="psu-face">${fan("psu-fan")}</span>
          <span class="psu-side"><b>ATX</b><em>650 W</em><small>80 PLUS</small></span>
          <span class="psu-socket"></span><span class="psu-switch"></span>
          <span class="psu-leads"><i></i><i></i><i></i><i></i></span>
        </span>`,
      cooler: `
        <span class="cpu-cooler">
          <span class="heatsink"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          ${fan("cpu-fan")}
          <span class="cooler-clips"><i></i><i></i><i></i><i></i></span>
        </span>`,
      memory: `
        <span class="ram-kit"><span class="ram-stick"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b>DDR4</b></span><span class="ram-stick"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b>DDR4</b></span></span>`,
      storage: `
        <span class="storage-kit"><span class="ssd-drive"><i></i><b>SSD</b><small>480 GB</small><em></em></span>${context === "replacement" ? '<span class="hdd-drive"><i></i><b>HDD</b><small>1 TB</small><em></em></span>' : ""}</span>`,
      gpu: `
        <span class="gpu-board"><span class="gpu-backplate"></span><span class="gpu-bracket"></span><span class="gpu-power"></span>${fan("gpu-fan gpu-fan--one")}${fan("gpu-fan gpu-fan--two")}<span class="gpu-brand">GRAPHICS</span><span class="gpu-edge"></span></span>`,
      network: `
        <span class="nic-board"><span class="nic-bracket"></span><span class="nic-port"><i></i><i></i></span><span class="nic-chip">GbE</span><span class="nic-components"><i></i><i></i><i></i><i></i></span><span class="nic-edge"></span></span>`,
    };

    return visuals[partId] || "";
  }

  async function attemptHardwareReplacement(partId, slotId) {
    const activeCase = getActiveCase();
    if (!activeCase || activeCase.kind !== "hardware" || state.busy || state.caseResolved) return;

    const part = getHardwarePart(partId);
    const slotPart = getHardwarePart(slotId);
    if (!part || !slotPart) return;

    if (partId !== slotId) {
      showToast(`${part.name} não encaixa no local de ${slotPart.name}.`, "warning");
      addLog(`Encaixe incompatível: ${part.name} não foi instalado em ${slotPart.name}.`, "warning", "SAFE");
      return;
    }

    if (state.computerOn) {
      showToast("Desligue o computador antes de trocar uma peça.", "error");
      addLog("Troca bloqueada: há energia no gabinete.", "error", "SAFE");
      return;
    }

    state.busy = true;
    state.sequenceToken += 1;
    const token = state.sequenceToken;
    refreshInteractiveState();
    const slot = dom.cabinetSlots.querySelector(`[data-part-id="${partId}"]`);
    slot?.classList.add("is-removing");
    addLog(`Removendo ${part.name} instalado e colocando a peça de reposição.`, "info", "REPARO");
    showToast(`Substituindo ${part.name}...`, "info");

    await wait(480);
    if (token !== state.sequenceToken) return;
    slot?.classList.remove("is-removing");
    slot?.classList.add("is-installing");
    await wait(520);
    if (token !== state.sequenceToken) return;
    slot?.classList.remove("is-installing");

    if (partId !== activeCase.correctPart) {
      registerWrongAction(`A troca de ${part.name} não resolveu a ocorrência.`);
      clearSelectedPart();
      state.busy = false;
      refreshInteractiveState();
      return;
    }

    clearSelectedPart();
    state.replacedPart = partId;
    addLog(`${part.name} substituído. Reconectando energia para o teste final.`, "success", "REPARO");
    state.computerOn = true;
    renderPowerState();
    setMonitor(
      "booting",
      '<div class="screen-logo">SIMULAB UEFI</div><span class="screen-status-label">VERIFICANDO NOVO COMPONENTE</span><div class="screen-progress"><span style="width:68%"></span></div>',
      "TESTE FINAL",
    );

    await wait(1050);
    if (token !== state.sequenceToken) return;
    setMonitor(
      "windows-desktop",
      windowsDesktopScreen(`${part.name} reconhecido; POST concluído sem erros`),
      "SISTEMA ESTÁVEL",
    );
    addLog("POST e teste funcional concluídos sem erros.", "success", "OK");
    await wait(650);
    if (token !== state.sequenceToken) return;
    completeCase();
  }

  function renderSoftwareActions() {
    dom.softwareActions.replaceChildren();

    softwareActions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "software-action";
      button.dataset.actionId = action.id;

      const image = document.createElement("img");
      image.src = action.icon;
      image.alt = "";
      const text = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = action.name;
      const description = document.createElement("span");
      description.textContent = action.description;
      text.append(title, description);
      const arrow = document.createElement("small");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      button.append(image, text, arrow);
      button.addEventListener("click", () => runSoftwareAction(action.id));
      dom.softwareActions.append(button);
    });
    refreshInteractiveState();
  }

  async function runSoftwareAction(actionId) {
    const activeCase = getActiveCase();
    if (!activeCase || activeCase.kind !== "software" || state.busy || state.caseResolved) return;

    if (!state.computerOn) {
      showToast("Ligue o computador antes de executar um procedimento.", "warning");
      addLog("Procedimento não iniciado: o computador está desligado.", "warning", "SAFE");
      return;
    }

    const action = softwareActions.find((item) => item.id === actionId);
    if (!action) return;
    state.busy = true;
    state.sequenceToken += 1;
    const token = state.sequenceToken;
    refreshInteractiveState();
    addLog(`Procedimento iniciado: ${action.name}.`, "info", "AÇÃO");

    if (actionId !== activeCase.correctAction) {
      setMonitor(
        "error",
        screenWindow("Procedimento interrompido", "A ação executada não corresponde ao problema encontrado", 100, ["Nenhuma correção aplicável foi realizada.", "Revise os sintomas e os testes de diagnóstico."]),
        "NÃO RESOLVIDO",
      );
      registerWrongAction(`${action.name} não resolveu esta ocorrência.`);
      await wait(1300);
      if (token !== state.sequenceToken) return;
      state.busy = false;
      showBootOutcome(activeCase, token);
      refreshInteractiveState();
      return;
    }

    if (actionId === "install-os") {
      await runWindowsInstallation(token, action);
      if (token !== state.sequenceToken) return;
      addLog("Windows instalado, configurado e iniciado pelo SSD.", "success", "OK");
      completeCase();
      return;
    }

    const steps = simulations[actionId] || [];
    for (const [stepIndex, step] of steps.entries()) {
      if (token !== state.sequenceToken || !state.computerOn) return;
      renderSimulationStep(actionId, step, stepIndex);
      addLog(`${step.title}: ${step.detail}`, step.mode === "success" ? "success" : "info", action.short);
      await wait(step.delay);
    }

    if (token !== state.sequenceToken) return;
    addLog("Procedimento finalizado e funcionamento validado.", "success", "OK");
    completeCase();
  }

  async function runWindowsInstallation(token, action) {
    setMonitor(
      "windows-setup",
      `<div class="windows-boot">${windowsLogo()}<div class="boot-spinner"><i></i><i></i><i></i><i></i><i></i></div><p>Inicializando pelo pendrive de instalação...</p></div>`,
      "BOOT USB",
    );
    addLog("Mídia USB inicializada em modo UEFI.", "info", action.short);
    await wait(900);
    if (token !== state.sequenceToken) return;

    setMonitor(
      "windows-setup",
      windowsSetupFrame(
        "Instalação do Windows 11",
        `<p class="win-lead">Idioma e preferências</p>
         <label class="win-field"><span>Idioma a instalar</span><strong>Português (Brasil)</strong></label>
         <label class="win-field"><span>Formato de hora e moeda</span><strong>Português (Brasil)</strong></label>
         <label class="win-field"><span>Teclado ou método de entrada</span><strong>Português (Brasil ABNT2)</strong></label>`,
        `<button class="win-primary" id="winLanguageNext" type="button">Avançar</button>`,
      ),
      "WINDOWS SETUP",
    );
    addLog("Instalador aguardando a confirmação de idioma e teclado.", "info", action.short);
    await waitForMonitorButton("winLanguageNext", token);
    if (token !== state.sequenceToken) return;

    setMonitor(
      "windows-setup",
      windowsSetupFrame(
        "Instalação do Windows 11",
        `<div class="win-install-home">${windowsLogo()}<h3>Windows 11 Education</h3><p>O instalador copiará os arquivos e preparará o computador para o primeiro uso.</p></div>`,
        `<button class="win-primary win-primary--large" id="winInstallNow" type="button">Instalar agora</button><button class="win-link" type="button" disabled>Reparar o computador</button>`,
      ),
      "WINDOWS SETUP",
    );
    await waitForMonitorButton("winInstallNow", token);
    if (token !== state.sequenceToken) return;
    addLog("Instalação do Windows 11 Education iniciada.", "info", action.short);

    setMonitor(
      "windows-setup",
      windowsSetupFrame(
        "Onde deseja instalar o Windows?",
        `<div class="win-disk-table">
          <div class="win-disk-table__head"><span>Nome</span><span>Tamanho total</span><span>Espaço livre</span></div>
          <button class="win-disk-row" id="winDisk0" type="button"><span><i class="disk-icon"></i>Unidade 0 — Espaço não alocado</span><span>447,1 GB</span><span>447,1 GB</span></button>
          <div class="win-disk-tools"><span>↻ Atualizar</span><span>＋ Novo</span><span>⌫ Excluir</span><span>▣ Formatar</span></div>
        </div>
        <p class="win-disk-help" id="winDiskHelp">Selecione a unidade onde o sistema será instalado.</p>`,
        `<button class="win-primary" id="winDiskNext" type="button" disabled>Avançar</button>`,
      ),
      "SELEÇÃO DO SSD",
    );

    const diskRow = dom.screenContent.querySelector("#winDisk0");
    const diskNext = dom.screenContent.querySelector("#winDiskNext");
    diskRow.addEventListener("click", () => {
      diskRow.classList.add("is-selected");
      diskNext.disabled = false;
      dom.screenContent.querySelector("#winDiskHelp").textContent = "O instalador criará automaticamente as partições necessárias.";
      addLog("SSD de 447,1 GB selecionado como destino.", "info", "DISK");
    });
    await waitForMonitorButton("winDiskNext", token);
    if (token !== state.sequenceToken) return;

    const installStages = [
      [8, "Copiando arquivos do Windows", 1],
      [29, "Preparando arquivos para instalação", 2],
      [57, "Instalando recursos", 3],
      [82, "Instalando atualizações", 4],
      [100, "Finalizando", 5],
    ];
    for (const [progress, label, completed] of installStages) {
      setMonitor("windows-setup", windowsInstallProgress(progress, label, completed), `${progress}%`);
      addLog(`${label}: ${progress}%`, progress === 100 ? "success" : "info", action.short);
      await wait(720);
      if (token !== state.sequenceToken) return;
    }

    setMonitor(
      "windows-setup",
      `<div class="windows-boot">${windowsLogo()}<h3>O computador será reiniciado</h3><p>Não remova o pendrive até a reinicialização.</p><div class="restart-ring"></div></div>`,
      "REINICIANDO",
    );
    await wait(1100);
    if (token !== state.sequenceToken) return;

    setMonitor(
      "windows-setup",
      `<div class="windows-oobe"><div class="oobe-glow"></div><div class="oobe-card"><p class="oobe-kicker">Configuração do Windows</p><h3>Esta é a região correta?</h3><button class="oobe-option is-selected" type="button">Brasil</button><button class="win-primary" id="winRegionYes" type="button">Sim</button></div></div>`,
      "PRIMEIRA CONFIGURAÇÃO",
    );
    await waitForMonitorButton("winRegionYes", token);
    if (token !== state.sequenceToken) return;

    setMonitor(
      "windows-setup",
      `<div class="windows-oobe"><div class="oobe-glow"></div><div class="oobe-card"><p class="oobe-kicker">Layout do teclado</p><h3>Este é o layout correto?</h3><button class="oobe-option is-selected" type="button">Português (Brasil ABNT2)</button><button class="win-primary" id="winKeyboardYes" type="button">Sim</button></div></div>`,
      "PRIMEIRA CONFIGURAÇÃO",
    );
    await waitForMonitorButton("winKeyboardYes", token);
    if (token !== state.sequenceToken) return;

    setMonitor(
      "windows-setup",
      `<div class="windows-oobe"><div class="oobe-glow"></div><div class="oobe-card"><p class="oobe-kicker">Nome do dispositivo</p><h3>Como deseja chamar este computador?</h3><input class="oobe-input" value="LAB-PC-01" aria-label="Nome do computador" /><button class="win-primary" id="winDeviceNext" type="button">Avançar</button></div></div>`,
      "PRIMEIRA CONFIGURAÇÃO",
    );
    await waitForMonitorButton("winDeviceNext", token);
    if (token !== state.sequenceToken) return;

    setMonitor(
      "windows-setup",
      `<div class="windows-boot windows-boot--finishing">${windowsLogo()}<h3>Estamos preparando tudo para você</h3><p>Não desligue o computador.</p><div class="boot-spinner"><i></i><i></i><i></i><i></i><i></i></div></div>`,
      "CONFIGURANDO",
    );
    await wait(1200);
    if (token !== state.sequenceToken) return;

    setMonitor("windows-desktop", windowsDesktopScreen("Windows 11 instalado e pronto para uso"), "SISTEMA ATIVO");
    addLog("Primeira inicialização concluída; área de trabalho carregada.", "success", action.short);
    await wait(1600);
  }

  function waitForMonitorButton(buttonId, token) {
    return new Promise((resolve) => {
      const button = dom.screenContent.querySelector(`#${buttonId}`);
      if (!button) {
        resolve(false);
        return;
      }
      button.addEventListener("click", () => {
        if (token === state.sequenceToken) resolve(true);
      }, { once: true });
    });
  }

  function windowsLogo() {
    return '<span class="windows-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }

  function windowsSetupFrame(title, body, footer) {
    return `<div class="win-setup-frame"><header>${windowsLogo()}<strong>${title}</strong></header><main>${body}</main><footer>${footer}</footer></div>`;
  }

  function windowsInstallProgress(progress, activeLabel, completed) {
    const steps = ["Copiando arquivos do Windows", "Preparando arquivos para instalação", "Instalando recursos", "Instalando atualizações", "Finalizando"];
    const currentIndex = completed - 1;
    const list = steps.map((step, index) => `<li class="${index < currentIndex ? "is-complete" : index === currentIndex ? "is-active" : ""}"><i>${index < currentIndex ? "✓" : ""}</i><span>${step}</span>${index === currentIndex ? `<b>${progress}%</b>` : ""}</li>`).join("");
    return windowsSetupFrame("Instalando o Windows", `<div class="win-installing"><h3>${activeLabel}</h3><p>O computador reiniciará várias vezes durante o processo.</p><ul>${list}</ul><div class="win-copy-progress"><span style="width:${progress}%"></span></div></div>`, '<span class="win-footer-note">Status: instalando no SSD — Unidade 0</span>');
  }

  function windowsDesktopScreen(notification = "") {
    return `<div class="windows-desktop"><div class="desktop-wallpaper"><span class="wallpaper-orb wallpaper-orb--one"></span><span class="wallpaper-orb wallpaper-orb--two"></span></div><div class="desktop-icons"><span><i>🗑</i>Lixeira</span><span><i>📁</i>Explorador</span></div>${notification ? `<div class="desktop-notification"><b>Configuração concluída</b><span>${escapeHtml(notification)}</span></div>` : ""}<div class="windows-taskbar"><span class="taskbar-weather">☀ 22 °C</span><span class="taskbar-center">${windowsLogo()}<i>⌕</i><i>▣</i><i>◉</i></span><span class="taskbar-clock">10:42<br>17/09/2026</span></div></div>`;
  }

  function renderSimulationStep(actionId, step, stepIndex) {
    if (step.mode === "success") {
      setMonitor("windows-desktop", windowsDesktopScreen(step.detail), "SISTEMA ATIVO");
      return;
    }

    if (actionId === "repair-boot") {
      const lines = step.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
      setMonitor("winre", `<div class="winre-screen"><header>Ambiente de Recuperação do Windows</header><main><div class="winre-title"><i>›_</i><span><b>${escapeHtml(step.title)}</b><small>${escapeHtml(step.detail)}</small></span></div><div class="winre-terminal">${lines}<i class="terminal-cursor"></i></div><div class="winre-progress"><span style="width:${step.progress}%"></span></div></main></div>`, `${step.progress}%`);
      return;
    }

    const mode = step.mode === "success" ? "desktop" : step.mode;
    setMonitor(
      mode,
      screenWindow(step.title, step.detail, step.progress, step.lines),
      step.mode === "success" ? "CONCLUÍDO" : `${step.progress}%`,
    );
  }

  function renderTools() {
    dom.toolGrid.replaceChildren();

    diagnosticTools.forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tool-button${state.usedTools.has(tool.id) ? " is-used" : ""}`;
      button.dataset.toolId = tool.id;

      const icon = document.createElement("span");
      icon.className = "tool-icon";
      icon.textContent = tool.short;
      const label = document.createElement("span");
      label.className = "tool-label";
      label.textContent = tool.name;
      button.append(icon, label);
      button.addEventListener("click", () => useDiagnosticTool(tool.id));
      dom.toolGrid.append(button);
    });
    refreshInteractiveState();
  }

  function useDiagnosticTool(toolId) {
    if (state.busy || state.caseResolved) return;
    const activeCase = getActiveCase();
    const tool = diagnosticTools.find((item) => item.id === toolId);
    if (!activeCase || !tool) return;

    const canReadFailedPower = activeCase.boot === "no-power" && state.powerAttempted;
    if (tool.requiresPower && !state.computerOn && !canReadFailedPower) {
      showToast("Ligue o computador antes de executar este teste.", "warning");
      return;
    }

    if (!state.usedTools.has(toolId)) {
      state.usedTools.add(toolId);
      changeCaseScore(-TOOL_COST);
    }

    const evidence = activeCase.diagnostics[toolId];
    addLog(evidence, evidence.includes("normal") || evidence.includes("saudável") ? "success" : "warning", tool.short);
    showToast(`${tool.name}: resultado adicionado ao registro.`, "info");
    renderTools();
    updateCounters();
  }

  function registerWrongAction(message) {
    state.errors += 1;
    changeCaseScore(-WRONG_ACTION_COST);
    addLog(message, "error", "ERRO");
    showToast(`${message} −${WRONG_ACTION_COST} pontos.`, "error");
    updateCounters();
  }

  function changeCaseScore(delta) {
    state.currentPoints = Math.max(MINIMUM_CASE_SCORE, Math.min(100, state.currentPoints + delta));
    updateScore();
  }

  function updateCounters() {
    const testCount = state.usedTools.size;
    dom.toolCounter.textContent = `${testCount} ${testCount === 1 ? "teste" : "testes"}`;
    dom.attemptsBadge.textContent = `${state.errors} ${state.errors === 1 ? "erro" : "erros"}`;
  }

  function updateScore() {
    dom.casePoints.textContent = String(state.currentPoints);
    dom.scoreTrackFill.style.width = `${state.currentPoints}%`;
    dom.scoreTrackFill.style.background =
      state.currentPoints >= 75 ? "var(--green)" : state.currentPoints >= 45 ? "var(--amber)" : "var(--red)";
    dom.sessionScore.textContent = String(state.score).padStart(4, "0");
  }

  function completeCase() {
    if (state.caseResolved) return;
    state.caseResolved = true;
    state.busy = false;
    state.score += state.currentPoints;
    updateScore();
    refreshInteractiveState();

    const activeCase = getActiveCase();
    dom.resultMark.textContent = "✓";
    dom.resultMark.classList.remove("is-final");
    dom.resultEyebrow.textContent = "Reparo concluído";
    dom.resultTitle.textContent = "Falha resolvida";
    dom.resultMessage.textContent = activeCase.explanation;
    setResultStats([
      ["Pontos", state.currentPoints],
      ["Testes", state.usedTools.size],
      ["Erros", state.errors],
    ]);
    dom.nextCaseButton.textContent = state.caseIndex === TOTAL_CASES - 1 ? "Ver resultado final" : "Próximo caso";
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
    state.finished = true;
    state.sequenceToken += 1;
    window.clearInterval(state.timerId);
    document.title = "SimulaPC — Treinamento concluído";

    dom.resultMark.textContent = "★";
    dom.resultMark.classList.add("is-final");
    dom.resultEyebrow.textContent = "Sessão finalizada";
    dom.resultTitle.textContent = "Treinamento concluído";
    dom.resultMessage.textContent = `${state.student}, você concluiu ${TOTAL_CASES} casos de manutenção para ${state.institution}.`;
    setResultStats([
      ["Pontuação", `${state.score}/${TOTAL_CASES * 100}`],
      ["Casos", TOTAL_CASES],
      ["Tempo", formatTime(state.elapsed)],
    ]);
    dom.nextCaseButton.textContent = "Iniciar nova sessão";
    dom.resultDialog.showModal();
  }

  function setResultStats(stats) {
    dom.resultDetails.replaceChildren();
    stats.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "result-stat";
      const caption = document.createElement("span");
      caption.textContent = label;
      const result = document.createElement("strong");
      result.textContent = String(value);
      item.append(caption, result);
      dom.resultDetails.append(item);
    });
  }

  function refreshInteractiveState() {
    const disabled = state.busy || state.caseResolved;
    dom.powerButton.disabled = disabled;
    dom.clearLogButton.disabled = state.busy;
    dom.toolGrid.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
    dom.partsTray.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
      button.draggable = !disabled;
    });
    dom.softwareActions.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
    dom.cabinetSlots.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
    });
  }

  function setMonitor(mode, markup, signal) {
    monitorModes.forEach((item) => dom.monitorScreen.classList.remove(`is-${item}`));
    dom.monitorScreen.classList.add(`is-${mode}`);
    dom.screenContent.innerHTML = markup;

    const off = mode === "off";
    dom.monitorSignal.textContent = signal || (off ? "SEM SINAL" : "SINAL ATIVO");
    dom.monitorSignal.classList.toggle("is-on", !off);
  }

  function textScreen(title, message, isError = false) {
    return `<div class="screen-logo">${escapeHtml(title)}</div><p class="screen-message${isError ? " is-error" : ""}">${escapeHtml(message)}</p>`;
  }

  function screenWindow(title, detail, progress, lines = []) {
    const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
    const renderedLines = lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
    return `<div class="screen-window"><div class="screen-window__bar"><span>${escapeHtml(title)}</span><span>${safeProgress}%</span></div><div class="screen-window__body"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p><div class="screen-progress"><span style="width:${safeProgress}%"></span></div><div class="screen-lines">${renderedLines}</div></div></div>`;
  }

  function addLog(message, type = "info", label = "SYS") {
    const entry = document.createElement("div");
    entry.className = `log-entry is-${type}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = formatTime(state.elapsed);
    const code = document.createElement("span");
    code.className = "log-type";
    code.textContent = `[${label}]`;
    const text = document.createElement("span");
    text.textContent = message;

    entry.append(time, code, text);
    dom.terminalLog.append(entry);
    dom.terminalLog.scrollTop = dom.terminalLog.scrollHeight;
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast is-${type}`;
    toast.textContent = message;
    dom.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3800);
  }

  function getActiveCase() {
    return state.selectedCases[state.caseIndex];
  }

  function getHardwarePart(partId) {
    return hardwareParts.find((part) => part.id === partId);
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
    }
    return items;
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  initialize();
})();
