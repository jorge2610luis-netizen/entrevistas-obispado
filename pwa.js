(() => {
  const VERSION = "v4.4.0";
  const state = {
    db: null,
    user: null,
    mode: location.pathname.includes("panel") ? "staff" : "member",
    registration: null,
    registrationPromise: null,
    deferredPrompt: null,
    guideIndex: 0,
    guideSteps: []
  };

  const $ = id => document.getElementById(id);

  const memberGuide = [
    {
      title: "Bienvenido a la guía",
      body: "Te mostraremos cómo instalar la aplicación, activar notificaciones, elegir tu barrio y solicitar una entrevista. Puedes omitir la guía cuando quieras."
    },
    {
      title: "1. Instala la aplicación",
      body: "Usa “Instalar app” para tener Entrevistas del Obispado en tu pantalla de inicio y abrirla como una aplicación.",
      target: "#installAppBtn"
    },
    {
      title: "2. Activa las notificaciones",
      body: "Con las notificaciones activas recibirás avisos cuando tu solicitud avance, sea enviada al líder o sea aprobada.",
      target: "#enableNotificationsBtn"
    },
    {
      title: "3. Elige tu barrio",
      body: "En “Mi barrio y capilla” selecciona uno de los barrios disponibles de Iquique y guárdalo. Esto permite mostrarte los líderes y horarios correctos.",
      navigate: "unit",
      target: "#iquiqueUnitSelect"
    },
    {
      title: "4. Crea una entrevista",
      body: "En “Nueva entrevista” elige el cargo con el que necesitas reunirte, después selecciona un día y una hora disponible.",
      navigate: "booking",
      target: "#leaderGrid"
    },
    {
      title: "5. Confirma la solicitud",
      body: "Revisa el horario elegido y toca “Solicitar entrevista”. Antes de enviarla, el sistema volverá a preguntarte si estás seguro.",
      navigate: "booking",
      target: "#submitBooking"
    },
    {
      title: "6. Sigue el estado",
      body: "En “Mis entrevistas” podrás ver si Secretaría la recibió, si pasó al líder, si fue aprobada, reprogramada o completada.",
      navigate: "appointments",
      target: "#memberAppointmentsList"
    }
  ];

  const staffGuide = [
    {
      title: "Guía del panel",
      body: "Esta guía resume cómo revisar solicitudes, actualizar su estado, administrar horarios y recibir avisos push."
    },
    {
      title: "1. Activa notificaciones",
      body: "Activa push para recibir avisos cuando un miembro envíe una solicitud o cuando una entrevista requiera tu revisión.",
      target: "#enableNotificationsBtn"
    },
    {
      title: "2. Solicitudes",
      body: "En Solicitudes puedes revisar cada entrevista y moverla por el flujo correspondiente: Secretaría → Líder → Aprobada.",
      panelView: "requests",
      target: "[data-panel-section='requests']"
    },
    {
      title: "3. Horarios",
      body: "En Horarios publica la disponibilidad que los miembros podrán seleccionar.",
      panelView: "schedule",
      target: "[data-panel-section='schedule']"
    },
    {
      title: "4. Barrios y liderazgo",
      body: "Los administradores pueden revisar los barrios de Iquique y las asignaciones de liderazgo desde esta sección.",
      panelView: "units",
      target: "[data-panel-section='units']"
    },
    {
      title: "5. Mantén la app instalada",
      body: "La PWA instalada puede recibir notificaciones aunque la página no esté abierta. Los permisos pueden cambiarse en cualquier momento desde el navegador o el sistema."
    }
  ];

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function injectTools() {
    if ($("pwaTools")) return;
    const bar = document.createElement("section");
    bar.id = "pwaTools";
    bar.className = "pwa-tools";
    bar.innerHTML =
      '<div class="pwa-tool-actions">'+
        '<button id="installAppBtn" class="secondary-button pwa-tool-button hidden" type="button">Instalar app</button>'+
        '<button id="enableNotificationsBtn" class="secondary-button pwa-tool-button hidden" type="button">Activar notificaciones</button>'+
        '<button id="openGuideBtn" class="secondary-button pwa-tool-button" type="button">Guía de uso</button>'+
      '</div>'+
      '<span id="pwaStatus" class="pwa-status"></span>';

    const header = document.querySelector("header.topbar");
    if (header?.parentNode) header.insertAdjacentElement("afterend", bar);
    else document.body.prepend(bar);

    $("installAppBtn")?.addEventListener("click", installApp);
    $("enableNotificationsBtn")?.addEventListener("click", toggleNotifications);
    $("openGuideBtn")?.addEventListener("click", () => openGuide(0));
    refreshInstallButton();
  }

  function setStatus(message, type="") {
    const el = $("pwaStatus");
    if (!el) return;
    el.textContent = message || "";
    el.className = "pwa-status"+(type ? " "+type : "");
  }

  function refreshInstallButton() {
    const button = $("installAppBtn");
    if (!button) return;

    if (isStandalone()) {
      button.classList.add("hidden");
      return;
    }

    if (state.deferredPrompt || isIOS()) {
      button.classList.remove("hidden");
    } else {
      button.classList.add("hidden");
    }
  }

  async function installApp() {
    if (isStandalone()) return;

    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      const choice = await state.deferredPrompt.userChoice.catch(() => null);
      state.deferredPrompt = null;
      if (choice?.outcome === "accepted") {
        setStatus("Instalación iniciada.","success");
      }
      refreshInstallButton();
      return;
    }

    if (isIOS()) {
      setStatus("En iPhone/iPad: abre Compartir y elige “Añadir a pantalla de inicio”.","info");
      return;
    }

    setStatus("La instalación estará disponible cuando el navegador la habilite.","info");
  }

  function base64UrlToUint8Array(value) {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  }

  async function getRegistration() {
    if (state.registration) return state.registration;
    if (!("serviceWorker" in navigator)) return null;
    if (!state.registrationPromise) {
      state.registrationPromise = navigator.serviceWorker
        .register("/sw.js?v=4.4.0", { scope: "/" })
        .then(async registration => {
          state.registration = registration;
          await navigator.serviceWorker.ready;
          return registration;
        })
        .catch(error => {
          console.warn("service worker registration failed", error);
          setStatus("No se pudo activar el modo instalable.","error");
          return null;
        });
    }
    return await state.registrationPromise;
  }

  async function getPushPublicKey() {
    if (!state.db || !state.user) throw new Error("Inicia sesión para activar notificaciones.");
    const { data, error } = await state.db.functions.invoke("push-notifications", {
      body: { action: "config" }
    });
    if (error) throw error;
    if (!data?.publicKey) throw new Error("No se pudo obtener la configuración de notificaciones.");
    return data.publicKey;
  }

  async function currentPushSubscription() {
    const registration = await getRegistration();
    if (!registration?.pushManager) return null;
    return await registration.pushManager.getSubscription();
  }

  async function refreshNotificationButton() {
    const button = $("enableNotificationsBtn");
    if (!button) return;

    if (!state.user) {
      button.classList.add("hidden");
      return;
    }

    button.classList.remove("hidden");

    if (!("Notification" in window) || !("PushManager" in window)) {
      button.textContent = "Push no disponible";
      button.disabled = true;
      return;
    }

    button.disabled = false;

    if (Notification.permission === "denied") {
      button.textContent = "Notificaciones bloqueadas";
      return;
    }

    const subscription = await currentPushSubscription().catch(() => null);
    if (!subscription) {
      button.textContent = "Activar notificaciones";
      return;
    }

    try {
      const { data } = await state.db.rpc("push_subscription_registered", {
        p_endpoint: subscription.endpoint
      });
      button.textContent = data === true ? "Notificaciones activas" : "Activar notificaciones";
      button.dataset.active = data === true ? "1" : "0";
    } catch (_) {
      button.textContent = "Activar notificaciones";
      button.dataset.active = "0";
    }
  }

  async function enableNotifications() {
    if (!state.user || !state.db) {
      setStatus("Inicia sesión para activar notificaciones.","info");
      return;
    }

    if (!("Notification" in window) || !("PushManager" in window)) {
      setStatus("Este navegador no admite notificaciones push.","error");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("No se concedió permiso para notificaciones.","info");
      await refreshNotificationButton();
      return;
    }

    const registration = await getRegistration();
    if (!registration) throw new Error("No se pudo iniciar el Service Worker.");

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await getPushPublicKey();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey)
      });
    }

    const json = subscription.toJSON();
    const { error } = await state.db.rpc("register_push_subscription", {
      p_endpoint: subscription.endpoint,
      p_p256dh: json.keys?.p256dh || "",
      p_auth: json.keys?.auth || "",
      p_user_agent: navigator.userAgent
    });
    if (error) throw error;

    setStatus("Notificaciones activadas en este dispositivo.","success");
    await refreshNotificationButton();
  }

  async function disableNotifications() {
    const subscription = await currentPushSubscription();
    if (!subscription) {
      await refreshNotificationButton();
      return;
    }

    if (state.db && state.user) {
      await state.db.rpc("remove_push_subscription", {
        p_endpoint: subscription.endpoint
      }).catch(() => null);
    }

    await subscription.unsubscribe().catch(() => false);
    setStatus("Notificaciones desactivadas en este dispositivo.","info");
    await refreshNotificationButton();
  }

  async function toggleNotifications() {
    const button = $("enableNotificationsBtn");
    if (button?.dataset.active === "1") {
      if (confirm("¿Quieres desactivar las notificaciones push en este dispositivo?")) {
        await disableNotifications().catch(error => setStatus(error.message || "No se pudieron desactivar.","error"));
      }
      return;
    }

    button.disabled = true;
    button.textContent = "Activando…";
    try {
      await enableNotifications();
    } catch (error) {
      console.warn("push enable failed", error);
      setStatus(error?.message || "No se pudieron activar las notificaciones.","error");
      await refreshNotificationButton();
    } finally {
      button.disabled = false;
    }
  }

  function guideStorageKey() {
    return "obispado-guide-"+state.mode+"-v1-"+(state.user?.id || "guest");
  }

  function removeGuideHighlight() {
    document.querySelectorAll(".pwa-guide-highlight").forEach(el => el.classList.remove("pwa-guide-highlight"));
  }

  function ensureGuideCard() {
    if ($("pwaGuideCard")) return;
    const card = document.createElement("aside");
    card.id = "pwaGuideCard";
    card.className = "pwa-guide-card hidden";
    card.setAttribute("aria-live","polite");
    card.innerHTML =
      '<div class="pwa-guide-progress" id="pwaGuideProgress"></div>'+
      '<h3 id="pwaGuideTitle"></h3>'+
      '<p id="pwaGuideBody"></p>'+
      '<div class="pwa-guide-actions">'+
        '<button id="skipGuideBtn" class="text-action-button" type="button">Omitir guía</button>'+
        '<div>'+
          '<button id="prevGuideBtn" class="secondary-button" type="button">Atrás</button>'+
          '<button id="nextGuideBtn" class="primary-button" type="button">Siguiente</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(card);

    $("skipGuideBtn").onclick = closeGuide;
    $("prevGuideBtn").onclick = () => renderGuideStep(state.guideIndex - 1);
    $("nextGuideBtn").onclick = () => {
      if (state.guideIndex >= state.guideSteps.length - 1) closeGuide();
      else renderGuideStep(state.guideIndex + 1);
    };
  }

  function navigateForGuide(step) {
    if (state.mode === "member" && step.navigate) {
      const preferred = document.querySelector('.member-home-action[data-member-view="'+step.navigate+'"]') ||
        document.querySelector('.member-nav-item[data-member-view="'+step.navigate+'"]');
      preferred?.click();
    }

    if (state.mode === "staff" && step.panelView) {
      document.querySelector('[data-panel-view="'+step.panelView+'"]')?.click();
    }
  }

  function renderGuideStep(index) {
    if (!state.guideSteps.length) return;
    state.guideIndex = Math.max(0, Math.min(index, state.guideSteps.length - 1));
    const step = state.guideSteps[state.guideIndex];

    removeGuideHighlight();
    navigateForGuide(step);

    setTimeout(() => {
      if (step.target) {
        const target = document.querySelector(step.target);
        if (target && !target.classList.contains("hidden")) {
          target.classList.add("pwa-guide-highlight");
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 180);

    $("pwaGuideProgress").textContent = "Paso "+(state.guideIndex + 1)+" de "+state.guideSteps.length;
    $("pwaGuideTitle").textContent = step.title;
    $("pwaGuideBody").textContent = step.body;
    $("prevGuideBtn").classList.toggle("hidden", state.guideIndex === 0);
    $("nextGuideBtn").textContent = state.guideIndex === state.guideSteps.length - 1 ? "Finalizar" : "Siguiente";
  }

  function openGuide(index=0) {
    ensureGuideCard();
    state.guideSteps = state.mode === "staff" ? staffGuide : memberGuide;
    $("pwaGuideCard").classList.remove("hidden");
    renderGuideStep(index);
  }

  function closeGuide() {
    removeGuideHighlight();
    $("pwaGuideCard")?.classList.add("hidden");
    try { localStorage.setItem(guideStorageKey(), "1"); } catch (_) {}
  }

  function maybeOfferGuide() {
    if (!state.user) return;
    try {
      if (localStorage.getItem(guideStorageKey()) === "1") return;
    } catch (_) {}

    if ($("pwaGuideOffer")) return;
    const offer = document.createElement("div");
    offer.id = "pwaGuideOffer";
    offer.className = "pwa-guide-offer";
    offer.innerHTML =
      '<div><strong>¿Quieres ver una guía rápida?</strong><span>Te mostramos cómo usar el sistema paso a paso.</span></div>'+
      '<div class="pwa-guide-offer-actions">'+
        '<button id="dismissGuideOffer" class="secondary-button" type="button">Omitir</button>'+
        '<button id="startGuideOffer" class="primary-button" type="button">Ver guía</button>'+
      '</div>';

    const main = document.querySelector("main.container") || document.body;
    main.prepend(offer);

    $("startGuideOffer").onclick = () => {
      offer.remove();
      openGuide(0);
    };
    $("dismissGuideOffer").onclick = () => {
      try { localStorage.setItem(guideStorageKey(), "1"); } catch (_) {}
      offer.remove();
    };
  }

  async function attachClient(db, mode) {
    state.db = db;
    state.mode = mode || state.mode;
    injectTools();
    await getRegistration();
  }

  async function setUser(user) {
    state.user = user || null;
    injectTools();
    await refreshNotificationButton();
    maybeOfferGuide();
  }

  function clearUser() {
    state.user = null;
    refreshNotificationButton();
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    state.deferredPrompt = event;
    refreshInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    refreshInstallButton();
    setStatus("Aplicación instalada.","success");
  });

  window.ObispadoPWA = {
    version: VERSION,
    attachClient,
    setUser,
    clearUser,
    openGuide,
    refreshNotificationButton
  };

  injectTools();
  getRegistration();
})();
