(() => {
  "use strict";

  const {
    hardwareParts,
    maintenanceTools,
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
    selectedMaintenance: null,
    draggedPart: null,
    replacedPart: null,
    maintainedPart: null,
    biosActive: false,
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
      "hardwareInterventions",
      "partsTray",
      "maintenanceTray",
      "softwareActions",
      "selectedPart",
      "selectedPartVisual",
      "selectedItemCaption",
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
  }

  function initialize() {
    cacheDom();
    bindEvents();
    renderTools();
    renderCabinet();
    renderPartsTray();
    renderMaintenanceTray();
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
    const requestedCaseId = new URLSearchParams(window.location.search).get("case");
    const requestedCase = cases.find((item) => item.id === requestedCaseId);
    if (requestedCase) {
      const remainingHardware = shuffle(cases.filter((item) => item.kind === "hardware" && item.id !== requestedCase.id)).slice(0, requestedCase.kind === "hardware" ? 2 : 3);
      const remainingSoftware = shuffle(cases.filter((item) => item.kind === "software" && item.id !== requestedCase.id)).slice(0, requestedCase.kind === "software" ? 1 : 2);
      return [requestedCase, ...shuffle([...remainingHardware, ...remainingSoftware])].slice(0, TOTAL_CASES);
    }
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
    state.selectedMaintenance = null;
    state.draggedPart = null;
    state.replacedPart = null;
    state.maintainedPart = null;
    state.biosActive = false;
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
    dom.resultDialog.hidden = true;

    configureCaseMode(activeCase);
    renderCabinet();
    renderPartsTray();
    renderMaintenanceTray();
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
    dom.hardwareInterventions.hidden = !isHardware;
    dom.softwareActions.hidden = isHardware;
    dom.selectedPart.hidden = true;

    dom.actionEyebrow.textContent = isHardware ? "Intervenção física" : "Intervenção no sistema";
    dom.actionHeading.textContent = isHardware ? "Peças e manutenção" : "Procedimentos disponíveis";
    dom.actionHelp.textContent = isHardware
      ? "Escolha uma peça, uma limpeza ou um reencaixe e aplique diretamente no componente do gabinete."
      : "Escolha o procedimento e acompanhe a execução diretamente no monitor.";
    dom.cabinetHelp.textContent = "Selecione uma intervenção abaixo e depois clique no componente correspondente.";

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
    state.biosActive = false;
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
          uefiScreen({
            tab: "MAIN",
            title: "S.M.A.R.T. STATUS BAD",
            warning: "Falha prevista na unidade. Faça backup e substitua o disco.",
            rows: [
              ["SATA Port 1", "SIMULAB SSD 480 GB"],
              ["S.M.A.R.T. Status", "BAD", "danger"],
              ["Reallocated Sectors", "184", "danger"],
              ["Pending Sectors", "37", "danger"],
            ],
            footer: "F1  Setup    F10  Save & Exit",
          }),
          "UEFI · ALERTA SMART",
        );
        addLog("UEFI: S.M.A.R.T. Status BAD no HD/SSD SATA.", "error", "DISK");
      },
      "memory-error": () => {
        setMonitor("error", noSignalScreen("POST interrompido", "LED DRAM aceso · 3 bipes longos"), "SEM SINAL");
        addLog("Três bipes longos repetidos; POST interrompido no teste de memória.", "error", "POST");
      },
      "memory-contact": () => {
        setMonitor("error", noSignalScreen("Falha DRAM intermitente", "3 bipes · o comportamento muda ao movimentar os módulos"), "SEM SINAL · INTERMITENTE");
        addLog("POST alterna entre falha DRAM e inicialização normal; indício de mau contato.", "warning", "POST");
      },
      overheat: () => {
        setMonitor(
          "bios",
          uefiScreen({
            tab: "MONITOR",
            title: "CPU FAN ERROR",
            warning: "Proteção térmica ativa. O sistema será desligado.",
            rows: [
              ["CPU Temperature", "96 °C", "danger"],
              ["CPU Fan Speed", "0 RPM", "danger"],
              ["CPU Core Voltage", "1.184 V"],
              ["Shutdown Temperature", "95 °C"],
            ],
            footer: "F1  Setup    CPU_FAN  N/A",
          }),
          "UEFI · MONITOR TÉRMICO",
        );
        addLog("CPU_FAN registra 0 RPM; proteção térmica acionada.", "error", "TEMP");
        window.setTimeout(() => {
          if (!state.computerOn || token !== state.sequenceToken || state.busy) return;
          setMonitor(
            "critical",
            protectionScreen("CPU over temperature", "Energia interrompida pela proteção térmica da placa-mãe."),
            "DESLIGAMENTO TÉRMICO",
          );
          state.computerOn = false;
          renderPowerState("fault");
          addLog("Estação desligada automaticamente por temperatura crítica.", "error", "TEMP");
        }, 3500);
      },
      "video-artifacts": () => {
        setMonitor(
          "artifacts",
          videoFailureScreen(),
          "GPU · SINAL CORROMPIDO",
        );
        addLog("Artefatos e reinicialização do driver gráfico detectados.", "error", "GPU");
      },
      "gpu-contact": () => {
        setMonitor(
          "artifacts",
          '<div class="video-failure"><div class="video-failure__noise"></div><div class="video-failure__dialog"><strong>PCIe LINK UNSTABLE</strong><span>O adaptador gráfico desapareceu e foi enumerado novamente.</span><small>Bus 01 · Device 00 · Link retraining failed</small></div></div>',
          "GPU · CONTATO INTERMITENTE",
        );
        addLog("A enumeração PCIe da GPU muda quando a placa é movimentada.", "warning", "GPU");
      },
      "storage-intermittent": () => {
        setMonitor(
          "bios",
          uefiScreen({
            tab: "MAIN",
            title: "SATA DEVICE NOT PRESENT",
            warning: "A unidade configurada no SATA Port 1 não respondeu durante a enumeração.",
            rows: [["SATA Port 1", "Not Present", "danger"], ["SATA Link", "Down", "danger"], ["Windows Boot Manager", "Not Found", "danger"], ["Previous detection", "SIMULAB SSD 480 GB"]],
            footer: "F1  Setup    F8  Boot Menu",
          }),
          "UEFI · SSD NÃO DETECTADO",
        );
        addLog("SATA Port 1 alterna entre unidade detectada e Not Present.", "warning", "SATA");
      },
      "network-card-failure": () => {
        setMonitor(
          "desktop",
          networkStatusScreen(false, "hardware"),
          "WINDOWS · SEM ADAPTADOR",
        );
        addLog("Sistema iniciado, mas nenhum enlace Ethernet foi estabelecido.", "warning", "NET");
      },
      "no-os": () => {
        setMonitor(
          "bios",
          noBootDeviceScreen("SIMULAB SSD 480 GB", "Nenhum carregador de sistema foi encontrado nesta unidade."),
          "UEFI · SEM SISTEMA",
        );
        addLog("HD/SSD detectado sem sistema operacional inicializável.", "warning", "BOOT");
      },
      "repair-loop": () => {
        setMonitor(
          "error",
          bootRecoveryScreen(),
          "WINDOWS BOOT MANAGER",
        );
        addLog("Windows Boot Manager retornou o código 0xc0000098.", "error", "BOOT");
      },
      "driver-missing": () => {
        setMonitor(
          "device",
          deviceManagerScreen("missing", 0),
          "WINDOWS · CÓDIGO 28",
        );
        addLog("Controlador Ethernet identificado sem driver: código 28.", "warning", "DRV");
      },
      malware: () => {
        setMonitor(
          "security",
          taskManagerScreen(),
          "WINDOWS · CPU 96%",
        );
        addLog("Processo desconhecido mantém carga alta e conexões externas.", "error", "SEC");
      },
      "dns-error": () => {
        setMonitor(
          "desktop",
          dnsBrowserScreen(false),
          "NAVEGADOR · ERRO DNS",
        );
        addLog("Conectividade IP ativa; resolução de nomes falhou.", "warning", "DNS");
      },
      "usb-boot": () => {
        setMonitor(
          "bios",
          usbBootFailureScreen(),
          "BOOT · DISPOSITIVO INCORRETO",
        );
        addLog("UEFI tentou iniciar pelo dispositivo USB conectado.", "warning", "UEFI");
        const enterSetup = dom.screenContent.querySelector("#enterUefiSetup");
        enterSetup?.addEventListener("click", () => runSoftwareAction("configure-boot"), { once: true });
      },
    };

    const renderOutcome = outcomes[activeCase.boot];
    if (renderOutcome) renderOutcome();
    else {
      setMonitor("bios", postScreen("POST concluído", ["CPU: OK", "Memory: OK", "Storage: OK", "Boot device: Windows Boot Manager"]), "POST · OK");
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
    const faultResolved = state.replacedPart === faultPart || state.maintainedPart === faultPart;

    dom.openCabinet.classList.toggle("is-powered", state.computerOn);
    dom.openCabinet.classList.toggle("is-fault-active", Boolean(state.computerOn && faultPart && !faultResolved));
    dom.openCabinet.dataset.faultPart = faultResolved ? "" : faultPart;
    dom.openCabinet.dataset.powerStatus = status;

    dom.cabinetSlots.querySelectorAll(".cabinet-slot").forEach((slot) => {
      slot.classList.toggle("is-faulty", state.computerOn && !faultResolved && slot.dataset.partId === faultPart);
      slot.classList.toggle("is-repaired", state.replacedPart === slot.dataset.partId || state.maintainedPart === slot.dataset.partId);
    });
  }

  function renderCabinet() {
    dom.cabinetSlots.replaceChildren();

    const board = document.createElement("div");
    board.className = "motherboard-base";
    board.setAttribute("aria-label", "Placa-mãe ATX instalada");
    board.innerHTML = `<span class="hardware-visual hardware-visual--motherboard" aria-hidden="true">${hardwareVisualMarkup("motherboard", "base")}</span>`;
    dom.cabinetSlots.append(board);

    hardwareParts.filter((part) => part.id !== "motherboard").forEach((part) => {
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
        if (state.selectedMaintenance) {
          attemptMaintenanceAction(state.selectedMaintenance, part.id);
          return;
        }
        if (!state.selectedPart) {
          showToast("Primeiro selecione uma peça ou ferramenta da bancada de reparo.", "warning");
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

    hardwareParts.filter((part) => part.id !== "motherboard").forEach((part) => {
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

  function renderMaintenanceTray() {
    dom.maintenanceTray.replaceChildren();

    maintenanceTools.forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "maintenance-card";
      button.dataset.maintenanceId = tool.id;
      button.setAttribute("aria-label", `Selecionar ${tool.name}`);

      const visual = document.createElement("span");
      visual.className = "maintenance-card__visual";
      visual.setAttribute("aria-hidden", "true");
      visual.innerHTML = maintenanceVisualMarkup(tool.id);

      const copy = document.createElement("span");
      copy.className = "maintenance-card__copy";
      const title = document.createElement("strong");
      title.textContent = tool.name;
      const description = document.createElement("span");
      description.textContent = tool.description;
      copy.append(title, description);

      const code = document.createElement("small");
      code.className = "maintenance-card__code";
      code.textContent = tool.short;
      button.append(visual, copy, code);
      button.addEventListener("click", () => selectMaintenance(tool.id));
      dom.maintenanceTray.append(button);
    });
    refreshInteractiveState();
  }

  function selectPart(partId) {
    if (state.busy || state.caseResolved || getActiveCase()?.kind !== "hardware") return;
    const part = getHardwarePart(partId);
    if (!part) return;

    state.selectedPart = partId;
    state.selectedMaintenance = null;
    dom.selectedPart.hidden = false;
    dom.selectedPartVisual.innerHTML = hardwareVisualMarkup(part.id, "selected");
    dom.selectedItemCaption.textContent = "Peça selecionada";
    dom.selectedPartName.textContent = part.name;
    dom.cabinetHelp.textContent = `Agora coloque ${part.name} no encaixe destacado.`;

    document.querySelectorAll(".part-card").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.partId === partId);
    });
    document.querySelectorAll(".cabinet-slot").forEach((slot) => {
      slot.classList.toggle("is-compatible", slot.dataset.partId === partId);
      slot.classList.remove("is-maintenance-compatible");
    });
    document.querySelectorAll(".maintenance-card.is-selected").forEach((button) => button.classList.remove("is-selected"));
  }

  function selectMaintenance(toolId) {
    if (state.busy || state.caseResolved || getActiveCase()?.kind !== "hardware") return;
    const tool = getMaintenanceTool(toolId);
    if (!tool) return;

    state.selectedPart = null;
    state.selectedMaintenance = toolId;
    dom.selectedPart.hidden = false;
    dom.selectedPartVisual.innerHTML = `<span class="maintenance-card__visual">${maintenanceVisualMarkup(tool.id)}</span>`;
    dom.selectedItemCaption.textContent = "Procedimento selecionado";
    dom.selectedPartName.textContent = tool.name;
    dom.cabinetHelp.textContent = `Agora aplique ${tool.name} em um componente compatível destacado.`;

    document.querySelectorAll(".part-card.is-selected").forEach((button) => button.classList.remove("is-selected"));
    document.querySelectorAll(".maintenance-card").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.maintenanceId === toolId);
    });
    document.querySelectorAll(".cabinet-slot").forEach((slot) => {
      slot.classList.remove("is-compatible");
      slot.classList.toggle("is-maintenance-compatible", tool.compatibleParts.includes(slot.dataset.partId));
    });
  }

  function clearSelectedPart() {
    state.selectedPart = null;
    state.selectedMaintenance = null;
    dom.selectedPart.hidden = true;
    dom.selectedPartVisual.replaceChildren();
    dom.cabinetHelp.textContent = "Selecione uma intervenção abaixo e depois clique no componente correspondente.";
    document.querySelectorAll(".part-card.is-selected").forEach((button) => button.classList.remove("is-selected"));
    document.querySelectorAll(".maintenance-card.is-selected").forEach((button) => button.classList.remove("is-selected"));
    document.querySelectorAll(".cabinet-slot.is-compatible").forEach((slot) => slot.classList.remove("is-compatible"));
    document.querySelectorAll(".cabinet-slot.is-maintenance-compatible").forEach((slot) => slot.classList.remove("is-maintenance-compatible"));
  }

  function maintenanceVisualMarkup(toolId) {
    const visuals = {
      "clean-eraser": '<span class="tool-eraser"><span class="eraser-body"></span><span class="contact-strip"></span></span>',
      "clean-isopropyl": '<span class="tool-isopropyl"><span class="ipa-bottle"><b>IPA</b><small>99,8%</small></span><span class="clean-brush"></span></span>',
      reseat: '<span class="tool-reseat"><span class="reseat-card"></span><span class="reseat-arrows">↕</span></span>',
    };
    return visuals[toolId] || "";
  }

  function hardwareVisualMarkup(partId, context = "installed") {
    const fan = (modifier = "") => `<span class="fan-assembly ${modifier}"><span class="fan-ring"></span><span class="fan-rotor"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><b></b></span></span>`;

    const visuals = {
      motherboard: `
        <svg class="motherboard-svg" viewBox="0 0 460 410" preserveAspectRatio="xMidYMid meet" role="presentation">
          <defs>
            <linearGradient id="pcb-${context}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#123f3c"/><stop offset="1" stop-color="#071d23"/></linearGradient>
            <linearGradient id="metal-${context}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c9d4d7"/><stop offset=".48" stop-color="#53636b"/><stop offset="1" stop-color="#d8e1e2"/></linearGradient>
            <pattern id="pins-${context}" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#638f86" opacity=".65"/></pattern>
          </defs>
          <path d="M8 8h408l35 35v359H8z" fill="url(#pcb-${context})" stroke="#4d8f86" stroke-width="5"/>
          <path d="M20 20h384l33 31v337H20z" fill="url(#pins-${context})" opacity=".28"/>
          <g fill="none" stroke="#24776e" stroke-width="1.4" opacity=".22">
            <path d="M36 225h88l28-27h128"/><path d="M34 294h96l35 37h92"/><path d="M46 108h77l39-42h92"/><path d="M261 25v47l-39 28v52"/>
          </g>
          <g fill="#8fb4ad"><circle cx="28" cy="28" r="6"/><circle cx="421" cy="57" r="6"/><circle cx="421" cy="374" r="6"/><circle cx="28" cy="374" r="6"/><circle cx="235" cy="386" r="5"/></g>
          <g fill="#c6d0d1" stroke="#607179" stroke-width="2"><rect x="17" y="48" width="61" height="27"/><rect x="17" y="81" width="61" height="34"/><rect x="17" y="121" width="61" height="23"/><rect x="17" y="151" width="61" height="23"/></g>
          <g fill="#24353b" stroke="#71858a"><rect x="91" y="32" width="115" height="25" rx="3"/><rect x="91" y="64" width="44" height="112" rx="3"/></g>
          <g fill="#687a7e"><rect x="100" y="37" width="13" height="15"/><rect x="119" y="37" width="13" height="15"/><rect x="138" y="37" width="13" height="15"/><rect x="157" y="37" width="13" height="15"/><rect x="176" y="37" width="13" height="15"/></g>
          <rect x="156" y="78" width="126" height="126" rx="7" fill="#13272d" stroke="url(#metal-${context})" stroke-width="6"/>
          <rect x="169" y="91" width="100" height="100" rx="3" fill="#111d21" stroke="#7f9397" stroke-width="2"/>
          <path d="M175 98h88v86h-88z" fill="none" stroke="#435a60"/><path d="M171 122h-10v36h10M267 102h10v64h-10" fill="none" stroke="#9ca9ac" stroke-width="3"/>
          <g fill="#1b2a30" stroke="#899a9e" stroke-width="2"><rect x="301" y="40" width="14" height="186"/><rect x="325" y="40" width="14" height="186"/><rect x="349" y="40" width="14" height="186"/><rect x="373" y="40" width="14" height="186"/></g>
          <g fill="#d1d9d8"><path d="M299 37h18v6h-18zM299 223h18v6h-18z"/><path d="M323 37h18v6h-18zM323 223h18v6h-18z"/><path d="M347 37h18v6h-18zM347 223h18v6h-18z"/><path d="M371 37h18v6h-18zM371 223h18v6h-18z"/></g>
          <rect x="408" y="91" width="28" height="118" rx="2" fill="#171f22" stroke="#74858a"/><g fill="#b4bdbe"><rect x="413" y="98" width="6" height="9"/><rect x="423" y="98" width="6" height="9"/><rect x="413" y="113" width="6" height="9"/><rect x="423" y="113" width="6" height="9"/></g>
          <rect x="43" y="234" width="361" height="18" rx="2" fill="#e8ece7"/><rect x="54" y="239" width="288" height="8" fill="#637277"/><path d="M184 234h12v18h-12z" fill="#0b1519"/>
          <rect x="43" y="271" width="271" height="12" rx="2" fill="#253940"/><rect x="43" y="304" width="230" height="14" rx="2" fill="#e8ece7"/><rect x="43" y="342" width="161" height="12" rx="2" fill="#253940"/>
          <rect x="117" y="211" width="137" height="13" rx="3" fill="#10252a" stroke="#709095"/><text x="185" y="220" fill="#8ca8a8" font-size="8" text-anchor="middle">M.2 PCIe 4.0</text>
          <circle cx="306" cy="323" r="31" fill="#bfc9c7" stroke="#536368" stroke-width="4"/><circle cx="306" cy="323" r="25" fill="#9eaaac"/><text x="306" y="328" fill="#4a5558" font-size="11" text-anchor="middle">CR2032</text>
          <rect x="344" y="279" width="74" height="67" rx="5" fill="#15262c" stroke="#819195" stroke-width="2"/><path d="M354 290h54v45h-54z" fill="#263d43"/><text x="381" y="318" fill="#91adaa" font-size="10" text-anchor="middle">B650</text>
          <g fill="#141d20" stroke="#8c9a9d"><rect x="422" y="244" width="22" height="17"/><rect x="422" y="267" width="22" height="17"/><rect x="422" y="290" width="22" height="17"/><rect x="422" y="313" width="22" height="17"/></g>
          <g fill="#aab8ba"><circle cx="111" cy="196" r="8"/><circle cx="132" cy="196" r="8"/><circle cx="288" cy="230" r="7"/><circle cx="401" cy="234" r="7"/></g>
          <text x="27" y="390" fill="#7fb7af" font-size="11" font-family="monospace">SIMULAB B650M · ATX</text>
        </svg>`,
      power: `
        <span class="psu-unit">
          <span class="psu-face">${fan("psu-fan")}</span>
          <span class="psu-side"><b>ATX</b><em>650 W</em><small>80 PLUS</small></span>
          <span class="psu-socket"></span><span class="psu-switch"></span>
          ${context === "installed" ? "" : '<span class="psu-leads"><i></i><i></i><i></i><i></i></span>'}
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
        <span class="gpu-board"><span class="gpu-backplate"></span><span class="gpu-bracket"></span><span class="gpu-power"></span>${fan("gpu-fan gpu-fan--one")}${fan("gpu-fan gpu-fan--two")}<span class="gpu-brand">GRAPHICS</span>${context === "installed" ? "" : '<span class="gpu-edge"></span>'}</span>`,
      network: `
        <span class="nic-board"><span class="nic-bracket"></span><span class="nic-port"><i></i><i></i></span><span class="nic-chip">GbE</span><span class="nic-components"><i></i><i></i><i></i><i></i></span>${context === "installed" ? "" : '<span class="nic-edge"></span>'}</span>`,
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

    if (partId !== activeCase.correctPart || activeCase.correctMaintenance) {
      const message = activeCase.correctMaintenance && partId === activeCase.correctPart
        ? `${part.name} está funcional; a substituição não era necessária. Faça a manutenção dos contatos.`
        : `A troca de ${part.name} não resolveu a ocorrência.`;
      registerWrongAction(message);
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
    renderHardwareVerification(activeCase, part);
    addLog("Teste funcional do componente concluído sem erros.", "success", "OK");
    await wait(950);
    if (token !== state.sequenceToken) return;
    completeCase();
  }

  async function attemptMaintenanceAction(toolId, partId) {
    const activeCase = getActiveCase();
    if (!activeCase || activeCase.kind !== "hardware" || state.busy || state.caseResolved) return;

    const tool = getMaintenanceTool(toolId);
    const part = getHardwarePart(partId);
    if (!tool || !part) return;

    if (!tool.compatibleParts.includes(partId)) {
      showToast(`${tool.name} não é o procedimento indicado para ${part.name}.`, "warning");
      addLog(`Procedimento incompatível: ${tool.name} não foi aplicado em ${part.name}.`, "warning", "SAFE");
      return;
    }

    if (state.computerOn) {
      showToast("Desligue o computador antes de remover, limpar ou reencaixar componentes.", "error");
      addLog("Manutenção bloqueada: há energia no gabinete.", "error", "SAFE");
      return;
    }

    state.busy = true;
    state.sequenceToken += 1;
    const token = state.sequenceToken;
    refreshInteractiveState();
    const slot = dom.cabinetSlots.querySelector(`[data-part-id="${partId}"]`);
    slot.dataset.operationLabel = tool.id === "reseat" ? "REMOVENDO E REENCAIXANDO" : "LIMPANDO CONTATOS";

    addLog(`${tool.name} aplicado em ${part.name}.`, "info", "MANUT");
    showToast(`${tool.name}: executando procedimento em ${part.name}...`, "info");

    if (tool.id === "reseat") {
      slot.classList.add("is-removing");
      await wait(520);
      if (token !== state.sequenceToken) return;
      slot.classList.remove("is-removing");
      slot.classList.add("is-installing");
      await wait(620);
      slot.classList.remove("is-installing");
    } else {
      slot.classList.add("is-cleaning");
      await wait(1500);
      slot.classList.remove("is-cleaning");
    }

    if (token !== state.sequenceToken) return;
    delete slot.dataset.operationLabel;

    const isCorrect = toolId === activeCase.correctMaintenance && partId === activeCase.correctPart;
    if (!isCorrect) {
      const message = partId !== activeCase.correctPart
        ? `${tool.name} foi aplicado no componente errado e a falha permaneceu.`
        : `${tool.name} não é o tratamento correto para este tipo de contato.`;
      registerWrongAction(message);
      clearSelectedPart();
      state.busy = false;
      refreshInteractiveState();
      return;
    }

    clearSelectedPart();
    state.maintainedPart = partId;
    addLog(`${part.name} limpo/reencaixado sem substituição. Reconectando energia para validar.`, "success", "MANUT");
    state.computerOn = true;
    renderPowerState();
    setMonitor(
      "booting",
      '<div class="screen-logo">SIMULAB UEFI</div><span class="screen-status-label">VALIDANDO CONTATO E ENUMERAÇÃO</span><div class="screen-progress"><span style="width:72%"></span></div>',
      "TESTE APÓS MANUTENÇÃO",
    );

    await wait(1050);
    if (token !== state.sequenceToken) return;
    renderHardwareVerification(activeCase, part);
    addLog("Contato estável e componente enumerado sem erros após a manutenção.", "success", "OK");
    await wait(2200);
    if (token !== state.sequenceToken) return;
    completeCase();
  }

  function renderHardwareVerification(activeCase, part) {
    const verifications = {
      "storage-failure": () => setMonitor(
        "bios",
        noBootDeviceScreen("SIMULAB SSD 480 GB · S.M.A.R.T. OK", "A unidade nova está saudável e vazia. Instale um sistema operacional para iniciar."),
        "SSD NOVO · SEM SISTEMA",
      ),
      "memory-failure": () => setMonitor(
        "bios",
        postScreen("Treinamento de memória concluído", ["DDR4 Channel A2: 8192 MB", "DDR4 Channel B2: 8192 MB", "Total Memory: 16384 MB", "POST Code: A0 — Ready"]),
        "POST · MEMÓRIA OK",
      ),
      "memory-contact-oxidation": () => setMonitor(
        "bios",
        postScreen("Contatos de memória estabilizados", ["DDR4 Channel A2: 8192 MB", "DDR4 Channel B2: 8192 MB", "Memory training: PASS", "DRAM Q-LED: OFF", "POST Code: A0 — Ready"]),
        "POST · CONTATOS LIMPOS",
      ),
      "power-failure": () => setMonitor(
        "bios",
        postScreen("Energia ATX estabilizada", ["+12 V: 12.08 V", "+5 V: 5.04 V", "+3.3 V: 3.31 V", "Power Good: asserted", "POST Code: A0 — Ready"]),
        "POST · TENSÕES OK",
      ),
      "cooler-failure": () => setMonitor(
        "bios",
        uefiScreen({
          tab: "MONITOR",
          title: "Hardware Monitor",
          rows: [["CPU Temperature", "38 °C", "ok"], ["CPU Fan Speed", "1480 RPM", "ok"], ["CPU Core Voltage", "1.176 V"], ["Thermal Protection", "Enabled"]],
          footer: "F10  Save & Exit    CPU_FAN  Normal",
        }),
        "UEFI · TEMPERATURA NORMAL",
      ),
      "gpu-failure": () => setMonitor(
        "bios",
        postScreen("Adaptador gráfico inicializado", ["PCIe x16: Graphics Adapter", "Link Width: x16", "VRAM Test: PASS", "Video output: 1920 × 1080", "POST Code: A0 — Ready"]),
        "POST · VÍDEO LIMPO",
      ),
      "gpu-contact-contamination": () => setMonitor(
        "bios",
        postScreen("Link PCIe estabilizado", ["PCIe x16: Graphics Adapter", "Link Width: x16", "Link retraining: PASS", "Video signal: stable", "POST Code: A0 — Ready"]),
        "POST · CONTATO PCIe OK",
      ),
      "storage-loose-connection": () => setMonitor(
        "bios",
        postScreen("Unidade SATA detectada", ["SATA Port 1: SIMULAB SSD 480 GB", "S.M.A.R.T. Status: OK", "Link speed: 6.0 Gb/s", "Windows Boot Manager: found", "POST Code: A0 — Ready"]),
        "POST · SATA ESTÁVEL",
      ),
      "network-hardware-failure": () => setMonitor(
        "desktop",
        networkStatusScreen(true, "hardware"),
        "WINDOWS · ETHERNET CONECTADA",
      ),
    };

    const render = verifications[activeCase.id];
    if (render) render();
    else setMonitor("bios", postScreen(`${part.name} reconhecido`, ["POST concluído sem erros", "Sistema pronto para inicializar"]), "POST · OK");
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
      registerWrongAction(`${action.name} não resolveu esta ocorrência.`);
      await wait(500);
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

    if (actionId === "configure-boot") {
      const saved = await runInteractiveBios(token, action);
      if (!saved || token !== state.sequenceToken) {
        if (token === state.sequenceToken) {
          state.busy = false;
          state.biosActive = false;
          showBootOutcome(activeCase, token);
          refreshInteractiveState();
        }
        return;
      }
      addLog("Prioridade salva na UEFI; Windows Boot Manager iniciou corretamente.", "success", "OK");
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

  function runInteractiveBios(token, action) {
    state.biosActive = true;
    let activeTab = "MAIN";
    let order = ["USB Mass Storage", "Windows Boot Manager", "Network PXE"];
    let selectedIndex = 0;
    let confirmationOpen = false;
    let saveAttempted = false;

    addLog("UEFI Setup aberto. Aguardando configuração manual do participante.", "info", action.short);

    return new Promise((resolve) => {
      const finish = (saved) => {
        state.biosActive = false;
        resolve(saved);
      };

      const render = () => {
        if (token !== state.sequenceToken || !state.computerOn) {
          finish(false);
          return;
        }

        setMonitor(
          "bios",
          interactiveBiosScreen({ activeTab, order, selectedIndex, confirmationOpen, saveAttempted }),
          activeTab === "BOOT" ? "UEFI SETUP · BOOT" : `UEFI SETUP · ${activeTab}`,
        );

        dom.screenContent.querySelectorAll("[data-bios-tab]").forEach((button) => {
          button.addEventListener("click", () => {
            activeTab = button.dataset.biosTab;
            confirmationOpen = false;
            saveAttempted = false;
            render();
          });
        });

        dom.screenContent.querySelectorAll("[data-boot-index]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedIndex = Number(button.dataset.bootIndex);
            saveAttempted = false;
            render();
          });
        });

        dom.screenContent.querySelector("#biosMoveUp")?.addEventListener("click", () => {
          if (selectedIndex <= 0) return;
          [order[selectedIndex - 1], order[selectedIndex]] = [order[selectedIndex], order[selectedIndex - 1]];
          selectedIndex -= 1;
          saveAttempted = false;
          addLog(`${order[selectedIndex]} movido para a prioridade ${selectedIndex + 1}.`, "info", "BOOT");
          render();
        });

        dom.screenContent.querySelector("#biosMoveDown")?.addEventListener("click", () => {
          if (selectedIndex >= order.length - 1) return;
          [order[selectedIndex + 1], order[selectedIndex]] = [order[selectedIndex], order[selectedIndex + 1]];
          selectedIndex += 1;
          saveAttempted = false;
          addLog(`${order[selectedIndex]} movido para a prioridade ${selectedIndex + 1}.`, "info", "BOOT");
          render();
        });

        dom.screenContent.querySelector("#biosDiscard")?.addEventListener("click", () => {
          addLog("UEFI fechada sem salvar; a ordem de boot permaneceu incorreta.", "warning", "UEFI");
          finish(false);
        }, { once: true });

        dom.screenContent.querySelector("#biosSave")?.addEventListener("click", () => {
          if (order[0] !== "Windows Boot Manager") {
            activeTab = "BOOT";
            selectedIndex = order.indexOf("Windows Boot Manager");
            saveAttempted = true;
            render();
            return;
          }
          confirmationOpen = true;
          render();
        });

        dom.screenContent.querySelector("#biosConfirmNo")?.addEventListener("click", () => {
          confirmationOpen = false;
          render();
        });

        dom.screenContent.querySelector("#biosConfirmYes")?.addEventListener("click", async () => {
          confirmationOpen = false;
          setMonitor("bios", biosSavingScreen(), "UEFI · SALVANDO");
          addLog("Configuração gravada na NVRAM. Reinicialização solicitada.", "success", "UEFI");
          await wait(850);
          if (token !== state.sequenceToken || !state.computerOn) return finish(false);

          setMonitor("booting", windowsBootScreen("Iniciando pelo Windows Boot Manager..."), "BOOT · WINDOWS");
          await wait(950);
          if (token !== state.sequenceToken || !state.computerOn) return finish(false);

          dom.factUefi.textContent = "Windows primeiro";
          dom.factStorage.textContent = "Saudável";
          dom.factOs.textContent = "Em execução";
          dom.factNetwork.textContent = "Inicializando";
          setMonitor("windows-desktop", windowsDesktopScreen("Ordem de boot corrigida na UEFI"), "SISTEMA ATIVO");
          finish(true);
        }, { once: true });
      };

      render();
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

  function windowsBootScreen(message) {
    return `<div class="windows-boot">${windowsLogo()}<div class="boot-spinner"><i></i><i></i><i></i><i></i><i></i></div><p>${escapeHtml(message)}</p></div>`;
  }

  function uefiScreen({ tab = "MAIN", title = "UEFI BIOS Utility", warning = "", rows = [], footer = "F1  Help    F10  Save & Exit" } = {}) {
    const tabs = ["MAIN", "ADVANCED", "MONITOR", "BOOT", "EXIT"];
    const renderedTabs = tabs.map((item) => `<span class="${item === tab ? "is-active" : ""}">${item}</span>`).join("");
    const renderedRows = rows.map(([label, value, status = ""]) => `<div class="uefi-row"><span>${escapeHtml(label)}</span><b class="${status ? `is-${status}` : ""}">${escapeHtml(value)}</b></div>`).join("");
    return `<div class="uefi-screen"><header><strong>SIMULAB UEFI BIOS UTILITY</strong><small>Version 2.24.0917</small></header><nav>${renderedTabs}</nav><main><section><p class="uefi-section-label">${escapeHtml(tab)} / STATUS</p><h3>${escapeHtml(title)}</h3>${warning ? `<div class="uefi-warning"><i>!</i><span>${escapeHtml(warning)}</span></div>` : ""}<div class="uefi-rows">${renderedRows}</div></section><aside><span>System Information</span><b>B650M Training Board</b><span>UEFI Mode</span><b>Enabled</b><span>System Date</span><b>17/09/2026</b></aside></main><footer>${escapeHtml(footer)}</footer></div>`;
  }

  function postScreen(title, lines = []) {
    const renderedLines = lines.map((line, index) => `<li><span>${index === lines.length - 1 ? "▶" : "✓"}</span>${escapeHtml(line)}</li>`).join("");
    return `<div class="post-screen"><header><b>SIMULAB</b><span>UEFI POST DIAGNOSTICS</span><small>BIOS 2.24</small></header><main><h3>${escapeHtml(title)}</h3><ul>${renderedLines}</ul><div class="post-code"><span>POST STATUS</span><b>A0</b></div></main><footer>Press DEL to enter Setup · F11 for Boot Menu</footer></div>`;
  }

  function noSignalScreen(title, detail) {
    return `<div class="no-signal-screen"><div class="no-signal-box"><i></i><strong>SEM SINAL</strong><span>HDMI 1</span></div><div class="beep-diagnostic"><b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span></div></div>`;
  }

  function protectionScreen(title, detail) {
    return `<div class="protection-screen"><span class="protection-icon">!</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p><small>CPU_PROCHOT# · SYSTEM HALTED</small></div>`;
  }

  function videoFailureScreen() {
    return `<div class="video-failure"><div class="video-failure__noise"></div><div class="video-failure__dialog"><strong>VIDEO_TDR_FAILURE</strong><span>O adaptador gráfico parou de responder.</span><small>nvlddmkm.sys · Stop code 0x116</small></div></div>`;
  }

  function networkStatusScreen(connected, source = "hardware") {
    const stateLabel = connected ? "Você está conectado à Internet" : source === "hardware" ? "Nenhum adaptador Ethernet encontrado" : "Sem conexão";
    const adapter = connected ? "Realtek PCIe GbE Family Controller" : "Adaptador não detectado no barramento PCIe";
    return `<div class="win-settings"><header><span>‹</span><b>Configurações</b><small>Rede e Internet</small></header><div class="win-settings__body"><aside><strong>Rede e Internet</strong><span class="is-active">Status</span><span>Ethernet</span><span>Discagem</span><span>Proxy</span></aside><main><div class="network-map ${connected ? "is-connected" : "is-disconnected"}"><i class="network-pc">▣</i><span></span><i class="network-globe">◎</i></div><h3>${escapeHtml(stateLabel)}</h3><p>${escapeHtml(adapter)}</p><div class="network-properties"><span>Estado do link</span><b>${connected ? "1,0 Gbit/s" : "Desconectado"}</b><span>Endereço IPv4</span><b>${connected ? "192.168.10.48" : "—"}</b><span>LED da porta</span><b class="${connected ? "is-ok" : "is-error"}">${connected ? "Aceso" : "Apagado"}</b></div></main></div></div>`;
  }

  function noBootDeviceScreen(device, detail) {
    return `<div class="firmware-message"><header>SIMULAB UEFI</header><main><span class="firmware-drive">▱</span><h3>NO BOOTABLE DEVICE</h3><p>${escapeHtml(detail)}</p><dl><dt>Unidade detectada</dt><dd>${escapeHtml(device)}</dd><dt>Boot entry</dt><dd>Not found</dd></dl></main><footer>Insira uma mídia inicializável e pressione qualquer tecla.</footer></div>`;
  }

  function bootRecoveryScreen() {
    return `<div class="recovery-screen"><div class="recovery-face">:(</div><h3>Recuperação</h3><p>O PC/dispositivo precisa ser reparado.</p><p>O arquivo de Dados de Configuração da Inicialização não contém informações válidas para um sistema operacional.</p><strong>Código do erro: 0xc0000098</strong><small>Pressione F1 para entrar no Ambiente de Recuperação.</small></div>`;
  }

  function deviceManagerScreen(stage = "missing", progress = 0) {
    const ready = stage === "ready";
    const busy = stage === "searching" || stage === "installing";
    const status = ready
      ? "Este dispositivo está funcionando corretamente."
      : stage === "missing"
        ? "Os drivers deste dispositivo não estão instalados. (Código 28)"
        : stage === "searching"
          ? "Procurando drivers no pacote compatível..."
          : "Instalando Realtek PCIe GbE Family Controller...";
    const deviceName = ready ? "Realtek PCIe GbE Family Controller" : "Controlador Ethernet";
    return `<div class="device-manager"><header><span>Gerenciador de Dispositivos</span><small>— □ ×</small></header><div class="device-toolbar">← →　▣　⌕　?</div><div class="device-layout"><aside><b>LAB-PC-01</b><span>⌄ Adaptadores de vídeo</span><span class="device-category">⌄ Adaptadores de rede</span><em class="${ready ? "is-ready" : "is-warning"}">${ready ? "▣" : "!"} ${escapeHtml(deviceName)}</em><span>› Controladores de armazenamento</span><span>› Dispositivos do sistema</span></aside><main><div class="device-icon ${ready ? "is-ready" : ""}">${ready ? "▣" : "!"}</div><h3>${escapeHtml(deviceName)}</h3><p>${escapeHtml(status)}</p><dl><dt>Fabricante</dt><dd>${ready ? "Realtek" : "Desconhecido"}</dd><dt>Local</dt><dd>Barramento PCI 3, dispositivo 0</dd><dt>ID do Hardware</dt><dd>PCI\\VEN_10EC&amp;DEV_8168</dd></dl>${busy ? `<div class="device-progress"><span style="width:${Math.max(8, progress)}%"></span></div>` : ""}${ready ? '<div class="device-success">✓ Driver 10.73.815.2026 · dispositivo iniciado</div>' : ""}</main></div></div>`;
  }

  function taskManagerScreen() {
    return `<div class="task-manager"><header><b>Gerenciador de Tarefas</b><small>— □ ×</small></header><nav><span class="is-active">Processos</span><span>Desempenho</span><span>Inicializar</span><span>Detalhes</span></nav><div class="task-summary"><b>96%<small>CPU</small></b><b>43%<small>Memória</small></b><b>12%<small>Disco</small></b><b>38%<small>Rede</small></b></div><div class="task-table"><div class="task-head"><span>Nome</span><span>CPU</span><span>Memória</span><span>Rede</span></div><div class="task-row is-danger"><span><i>!</i> update_service.exe</span><b>89,4%</b><span>684 MB</span><span>38 Mbps</span></div><div class="task-row"><span>Explorador do Windows</span><span>1,2%</span><span>118 MB</span><span>0 Mbps</span></div><div class="task-row"><span>Antimalware Service</span><span>0,8%</span><span>206 MB</span><span>0 Mbps</span></div></div><footer>Processos: 87　 Threads: 1.842　 CPU: 96%</footer></div>`;
  }

  function securityScanScreen(progress, stageIndex, complete) {
    const threat = stageIndex >= 1 && !complete;
    return `<div class="security-center"><header><span>🛡</span><b>Segurança do Windows</b><small>Proteção contra vírus e ameaças</small></header><main><div class="security-status ${complete ? "is-safe" : threat ? "is-threat" : "is-scanning"}"><i>${complete ? "✓" : threat ? "!" : "⌕"}</i><div><h3>${complete ? "Nenhuma ameaça atual" : threat ? "Ameaça encontrada" : "Verificação em andamento"}</h3><p>${complete ? "Trojan:Win32/FakeUpdate removido e colocado em quarentena." : threat ? "Trojan:Win32/FakeUpdate · Gravidade alta" : "Analisando processos, arquivos e itens de inicialização."}</p></div></div><div class="security-progress"><span style="width:${progress}%"></span></div><div class="security-stats"><span>Progresso<b>${progress}%</b></span><span>Arquivos verificados<b>${complete ? "96.384" : stageIndex > 0 ? "48.912" : "1.240"}</b></span><span>Ameaças<b>${complete ? "0 ativas" : threat ? "1" : "0"}</b></span></div><section><b>Ações executadas</b><span>${complete ? "Processo encerrado · persistência removida · proteção em tempo real ativa" : threat ? "Interrompendo update_service.exe e removendo a inicialização automática" : "Verificação completa selecionada"}</span></section></main></div>`;
  }

  function dnsBrowserScreen(resolved) {
    return `<div class="browser-screen"><header><span class="browser-tab">Simula Escola ${resolved ? "" : "— erro"}</span><div class="browser-controls">←　→　↻</div><div class="browser-address"><i>${resolved ? "🔒" : "ⓘ"}</i>${resolved ? "https://escola.rs.gov.br" : "escola.rs.gov.br"}</div></header><main class="${resolved ? "is-loaded" : "is-error"}">${resolved ? '<div class="loaded-site"><span>SIMULA EDUCAÇÃO</span><h3>Conexão restaurada</h3><p>O nome foi resolvido pelo servidor DNS e a página respondeu normalmente.</p><b>HTTP 200 · 0% de perda</b></div>' : '<div class="browser-error-icon">!</div><h3>Não é possível acessar este site</h3><p>Não foi possível encontrar o endereço DNS de <b>escola.rs.gov.br</b>.</p><strong>DNS_PROBE_FINISHED_NXDOMAIN</strong><small>O ping para 1.1.1.1 continua respondendo.</small>'}</main></div>`;
  }

  function dnsRepairScreen(stepIndex, progress, lines = []) {
    const renderedLines = lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
    const captions = ["Configuração IPv4 — DNS automático", "Prompt de Comando — cache DNS", "Prompt de Comando — teste de resolução"];
    return `<div class="dns-repair"><header>${escapeHtml(captions[stepIndex] || captions[2])}<small>Administrador: Windows Terminal</small></header><main><div class="terminal-command"><span>Microsoft Windows [versão 10.0.26100]</span><span>(c) Microsoft Corporation. Todos os direitos reservados.</span><br>${renderedLines}<i class="terminal-cursor"></i></div><div class="dns-route"><span class="is-ok">PC</span><i></i><span class="is-ok">192.168.10.1</span><i class="${stepIndex > 1 ? "is-ok" : ""}"></i><span class="${stepIndex > 1 ? "is-ok" : ""}">DNS</span></div><div class="dns-progress"><span style="width:${progress}%"></span></div></main></div>`;
  }

  function usbBootFailureScreen() {
    return `<div class="boot-device-failure">
      <header>SIMULAB UEFI · POST 2.24</header>
      <div class="boot-device-failure__log">
        <span>CPU: AMD64 Training Processor ................................ OK</span>
        <span>Memory Test: 16384 MB ....................................... OK</span>
        <span>SATA Port 1: SIMULAB SSD 480 GB ............................. OK</span>
        <span>Boot Option #1: UEFI USB Mass Storage</span>
        <span>Loading boot sector from USB device...</span>
        <strong>Missing operating system</strong>
      </div>
      <footer><span>DEL: Setup · F11: Boot Menu</span><button class="firmware-enter-button" id="enterUefiSetup" type="button">Entrar na UEFI</button></footer>
    </div>`;
  }

  function interactiveBiosScreen({ activeTab, order, selectedIndex, confirmationOpen, saveAttempted }) {
    const tabs = ["MAIN", "ADVANCED", "MONITOR", "BOOT", "EXIT"];
    const tabNames = { MAIN: "Principal", ADVANCED: "Avançado", MONITOR: "Monitor", BOOT: "Boot", EXIT: "Sair" };
    const renderedTabs = tabs.map((tab) => `<button class="bios-tab${activeTab === tab ? " is-active" : ""}" data-bios-tab="${tab}" type="button">${tabNames[tab]}</button>`).join("");
    const dataRows = (rows) => `<div class="bios-data-grid">${rows.map(([label, value]) => `<div class="bios-data-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join("")}</div>`;

    let panelTitle = "Informações do sistema";
    let panelContent = dataRows([
      ["UEFI BIOS Version", "2.24.0917"],
      ["Processador", "AMD64 Training CPU"],
      ["Memória total", "16384 MB (DDR4-3200)"],
      ["SATA Port 1", "SIMULAB SSD 480 GB"],
      ["Idioma", "Português (Brasil)"],
    ]);
    let helpTitle = "Ajuda — Principal";
    let helpText = "Confira os dispositivos reconhecidos antes de alterar a configuração de inicialização.";

    if (activeTab === "ADVANCED") {
      panelTitle = "Configuração avançada";
      panelContent = dataRows([
        ["SATA Mode", "AHCI"],
        ["USB Controller", "Enabled"],
        ["PCIe Link Speed", "Auto"],
        ["Above 4G Decoding", "Enabled"],
        ["Virtualization", "Enabled"],
      ]);
      helpTitle = "Ajuda — Avançado";
      helpText = "Parâmetros do chipset e dos controladores. Nenhuma alteração é necessária neste caso.";
    } else if (activeTab === "MONITOR") {
      panelTitle = "Monitor de hardware";
      panelContent = dataRows([
        ["CPU Temperature", "41 °C"],
        ["CPU Fan Speed", "1280 RPM"],
        ["Motherboard", "33 °C"],
        ["CPU Core Voltage", "1.176 V"],
        ["+12 V", "12.096 V"],
      ]);
      helpTitle = "Ajuda — Monitor";
      helpText = "Temperaturas, rotações e tensões estão dentro dos limites normais.";
    } else if (activeTab === "BOOT") {
      const renderedOrder = order.map((item, index) => `<button class="bios-boot-option${selectedIndex === index ? " is-selected" : ""}${index === 0 ? " is-first" : ""}" data-boot-index="${index}" type="button"><b>${index + 1}</b><span>${escapeHtml(item)}</span><small>${item.includes("Windows") ? "NVMe/SATA" : item.includes("USB") ? "UEFI USB" : "IPv4"}</small></button>`).join("");
      const ready = order[0] === "Windows Boot Manager";
      panelTitle = "Prioridades de inicialização";
      panelContent = `<div class="bios-boot-list">${renderedOrder}</div>
        <div class="bios-order-controls">
          <button class="bios-step-button" id="biosMoveUp" type="button"${selectedIndex === 0 ? " disabled" : ""}>↑ Subir prioridade</button>
          <button class="bios-step-button" id="biosMoveDown" type="button"${selectedIndex === order.length - 1 ? " disabled" : ""}>↓ Descer prioridade</button>
        </div>
        <p class="bios-guidance${ready ? " is-ready" : ""}">${saveAttempted ? "A ordem ainda inicia pelo USB. Selecione Windows Boot Manager e mova-o para a posição 1 antes de salvar." : ready ? "Ordem correta. Use “F10 Salvar e sair” para gravar a alteração." : "Selecione Windows Boot Manager e use “Subir prioridade” para colocá-lo na posição 1."}</p>`;
      helpTitle = "Ajuda — Boot";
      helpText = "A UEFI tenta cada opção na ordem exibida. O sistema instalado deve ser a primeira opção.";
    } else if (activeTab === "EXIT") {
      panelTitle = "Salvar e sair";
      const ready = order[0] === "Windows Boot Manager";
      panelContent = dataRows([
        ["Boot Option #1", order[0]],
        ["Alterações pendentes", ready ? "1" : "0"],
        ["Próxima ação", ready ? "Salvar e reiniciar" : "Retornar à aba Boot"],
      ]);
      helpTitle = "Ajuda — Sair";
      helpText = ready ? "Salve as mudanças na NVRAM e reinicie o computador." : "A prioridade continua incorreta; volte à aba Boot antes de salvar.";
    }

    const confirmation = confirmationOpen ? `<div class="bios-confirmation"><div class="bios-confirmation__dialog"><strong>Salvar configuração e reiniciar?</strong><p>A nova ordem de boot será gravada na NVRAM.</p><div class="bios-confirmation__actions"><button class="bios-button bios-button--primary" id="biosConfirmYes" type="button">Sim, salvar</button><button class="bios-button" id="biosConfirmNo" type="button">Cancelar</button></div></div></div>` : "";

    return `<div class="bios-console">
      <header class="bios-console__header"><span class="bios-console__brand"><strong>SIMULAB UEFI BIOS UTILITY</strong><small>Advanced Mode · Version 2.24.0917</small></span><span class="bios-console__status"><i></i> SSD detectado · 10:42</span></header>
      <nav class="bios-tabs" aria-label="Abas da UEFI">${renderedTabs}</nav>
      <main class="bios-console__body"><section class="bios-panel"><p class="bios-panel__title">${escapeHtml(panelTitle)}</p>${panelContent}</section><aside class="bios-help-panel"><strong>${escapeHtml(helpTitle)}</strong><span>${escapeHtml(helpText)}</span><strong>Placa-mãe</strong><b>SIMULAB B650M</b><strong>Modo</strong><b>UEFI · Secure Boot ativo</b></aside></main>
      <footer class="bios-console__footer"><span>Clique nas opções para navegar e alterar valores</span><div><button class="bios-button bios-button--danger" id="biosDiscard" type="button">Esc Sair sem salvar</button><button class="bios-button bios-button--primary" id="biosSave" type="button">F10 Salvar e sair</button></div></footer>
      ${confirmation}
    </div>`;
  }

  function biosSavingScreen() {
    return `<div class="bios-console"><header class="bios-console__header"><span class="bios-console__brand"><strong>SIMULAB UEFI BIOS UTILITY</strong><small>Gravando configuração</small></span></header><div class="bios-save-progress"><span class="boot-spinner-small"></span><strong>Saving configuration and resetting...</strong><small>Não desligue o computador.</small></div></div>`;
  }

  function bootPriorityScreen(order, state = "editing") {
    const rendered = order.map((item, index) => `<li class="${index === 0 ? "is-first" : ""}"><b>${index + 1}</b><span>${escapeHtml(item)}</span><small>${item.includes("Windows") ? "NVMe/SATA" : item.includes("USB") ? "UEFI USB" : "IPv4"}</small></li>`).join("");
    const notice = state === "usb-error"
      ? '<div class="boot-alert"><b>MISSING OPERATING SYSTEM</b><span>A primeira opção aponta para um pendrive de dados sem boot.</span></div>'
      : state === "saving"
        ? '<div class="boot-save"><span class="boot-spinner-small"></span><b>Save configuration and reset</b></div>'
        : '<div class="boot-help">Use ↑ ↓ para selecionar e + − para alterar a prioridade.</div>';
    return `<div class="boot-priority"><header><b>SIMULAB UEFI BIOS UTILITY</b><nav>MAIN　 ADVANCED　 <strong>BOOT</strong>　 EXIT</nav></header><main><section><p>Boot Option Priorities</p><ol>${rendered}</ol>${notice}</section><aside><b>Boot Configuration</b><span>Fast Boot</span><em>Enabled</em><span>CSM</span><em>Disabled</em><span>Secure Boot</span><em>Enabled</em></aside></main><footer>Enter Select　 +/- Change Option　 F10 Save & Exit　 ESC Back</footer></div>`;
  }

  function renderSimulationStep(actionId, step, stepIndex) {
    if (actionId === "repair-boot") {
      if (step.mode === "success") {
        setMonitor("windows-setup", windowsBootScreen("Inicialização restaurada — carregando o Windows"), "WINDOWS BOOT MANAGER · OK");
        return;
      }
      const lines = step.lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
      setMonitor("winre", `<div class="winre-screen"><header>Ambiente de Recuperação do Windows</header><main><div class="winre-title"><i>›_</i><span><b>${escapeHtml(step.title)}</b><small>${escapeHtml(step.detail)}</small></span></div><div class="winre-terminal">${lines}<i class="terminal-cursor"></i></div><div class="winre-progress"><span style="width:${step.progress}%"></span></div></main></div>`, `${step.progress}%`);
      return;
    }

    if (actionId === "install-driver") {
      const stage = step.mode === "success" ? "ready" : stepIndex === 0 ? "missing" : stepIndex === 1 ? "searching" : "installing";
      setMonitor("device", deviceManagerScreen(stage, step.progress), step.mode === "success" ? "ETHERNET · 1,0 GBIT/S" : `DRIVER · ${step.progress}%`);
      return;
    }

    if (actionId === "remove-malware") {
      setMonitor("security", securityScanScreen(step.progress, stepIndex, step.mode === "success"), step.mode === "success" ? "SEGURANÇA · LIMPO" : `VERIFICAÇÃO · ${step.progress}%`);
      return;
    }

    if (actionId === "configure-dns") {
      if (step.mode === "success") {
        setMonitor("desktop", dnsBrowserScreen(true), "NAVEGADOR · CONECTADO");
      } else {
        setMonitor("terminal", dnsRepairScreen(stepIndex, step.progress, step.lines), `DNS · ${step.progress}%`);
      }
      return;
    }

    if (actionId === "configure-boot") {
      if (step.mode === "success") {
        setMonitor("windows-setup", windowsBootScreen("Windows Boot Manager selecionado corretamente"), "BOOT · WINDOWS");
      } else {
        const order = stepIndex === 0
          ? ["USB Mass Storage", "Windows Boot Manager", "Network PXE"]
          : ["Windows Boot Manager", "USB Mass Storage", "Network PXE"];
        setMonitor("bios", bootPriorityScreen(order, stepIndex === 2 ? "saving" : "editing"), stepIndex === 2 ? "UEFI · SALVANDO" : "UEFI · BOOT");
      }
      return;
    }

    if (step.mode === "success") {
      setMonitor("bios", postScreen(step.title, [step.detail, ...step.lines]), "PROCEDIMENTO CONCLUÍDO");
      return;
    }

    setMonitor(
      step.mode,
      screenWindow(step.title, step.detail, step.progress, step.lines),
      `${step.progress}%`,
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
    dom.resultDialog.hidden = false;
    showToast("Reparo validado. O resultado permanece visível no monitor.", "success");
  }

  function advanceCase() {
    if (state.finished) {
      window.location.reload();
      return;
    }

    dom.resultDialog.hidden = true;
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
    dom.resultDialog.hidden = false;
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
    dom.maintenanceTray.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
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

  function getMaintenanceTool(toolId) {
    return maintenanceTools.find((tool) => tool.id === toolId);
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
