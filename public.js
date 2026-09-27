(() => {
  const $ = id => document.getElementById(id);
  const db = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabasePublishableKey
  );

  const state = {
    session:null,
    member:null,
    leaders:[],
    selectedLeader:null,
    interviewTypes:[],
    slots:[],
    selectedDateKey:null,
    selectedSlot:null,
    locationContext:null,
    selectedMeetinghouse:null,
    nearbyMeetinghouses:[],
    catalogResults:[],
    unitSelectionSource:null,
    manualCatalogOpen:false,
    booted:false
  };

  let bootPromise = null;

  if ($("appVersion")) $("appVersion").textContent = window.APP_CONFIG.version || "v2.8.1";


  const PHONE_COUNTRIES = [
    ["BO","+591","Bolivia"],["CL","+56","Chile"],["AR","+54","Argentina"],["PE","+51","Perú"],
    ["BR","+55","Brasil"],["PY","+595","Paraguay"],["UY","+598","Uruguay"],["CO","+57","Colombia"],
    ["EC","+593","Ecuador"],["VE","+58","Venezuela"],["MX","+52","México"],["PA","+507","Panamá"],
    ["CR","+506","Costa Rica"],["GT","+502","Guatemala"],["SV","+503","El Salvador"],["HN","+504","Honduras"],
    ["NI","+505","Nicaragua"],["DO","+1","Rep. Dominicana"],["PR","+1","Puerto Rico"],["CU","+53","Cuba"],
    ["US","+1","Estados Unidos"],["CA","+1","Canadá"],["ES","+34","España"],["PT","+351","Portugal"],
    ["FR","+33","Francia"],["IT","+39","Italia"],["DE","+49","Alemania"],["GB","+44","Reino Unido"],
    ["IE","+353","Irlanda"],["NL","+31","Países Bajos"],["BE","+32","Bélgica"],["CH","+41","Suiza"],
    ["AT","+43","Austria"],["SE","+46","Suecia"],["NO","+47","Noruega"],["DK","+45","Dinamarca"],
    ["FI","+358","Finlandia"],["PL","+48","Polonia"],["CZ","+420","Chequia"],["RO","+40","Rumania"],
    ["GR","+30","Grecia"],["TR","+90","Turquía"],["RU","+7","Rusia"],["UA","+380","Ucrania"],
    ["IL","+972","Israel"],["AE","+971","Emiratos Árabes"],["SA","+966","Arabia Saudita"],["IN","+91","India"],
    ["PK","+92","Pakistán"],["BD","+880","Bangladés"],["CN","+86","China"],["JP","+81","Japón"],
    ["KR","+82","Corea del Sur"],["PH","+63","Filipinas"],["ID","+62","Indonesia"],["TH","+66","Tailandia"],
    ["VN","+84","Vietnam"],["MY","+60","Malasia"],["SG","+65","Singapur"],["AU","+61","Australia"],
    ["NZ","+64","Nueva Zelanda"],["ZA","+27","Sudáfrica"],["EG","+20","Egipto"],["MA","+212","Marruecos"],
    ["NG","+234","Nigeria"],["KE","+254","Kenia"],["GH","+233","Ghana"]
  ];

  function detectCountryIso() {
    const valid = new Set(PHONE_COUNTRIES.map(([iso])=>iso));

    try {
      const saved = localStorage.getItem("member_phone_country");
      if (saved && valid.has(saved)) return saved;
    } catch (_) {}

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const exact = {
      "America/La_Paz":"BO",
      "America/Santiago":"CL",
      "America/Punta_Arenas":"CL",
      "Pacific/Easter":"CL",
      "America/Lima":"PE",
      "America/Bogota":"CO",
      "America/Asuncion":"PY",
      "America/Montevideo":"UY",
      "America/Caracas":"VE",
      "America/Panama":"PA",
      "America/Costa_Rica":"CR",
      "America/Guatemala":"GT",
      "America/El_Salvador":"SV",
      "America/Tegucigalpa":"HN",
      "America/Managua":"NI",
      "America/Havana":"CU",
      "America/Santo_Domingo":"DO",
      "America/Puerto_Rico":"PR",
      "America/Mexico_City":"MX",
      "America/Cancun":"MX",
      "America/Monterrey":"MX",
      "America/Chihuahua":"MX",
      "America/Tijuana":"MX",
      "America/New_York":"US",
      "America/Chicago":"US",
      "America/Denver":"US",
      "America/Los_Angeles":"US",
      "America/Phoenix":"US",
      "America/Anchorage":"US",
      "Pacific/Honolulu":"US",
      "America/Toronto":"CA",
      "America/Vancouver":"CA",
      "America/Edmonton":"CA",
      "America/Winnipeg":"CA",
      "Europe/Madrid":"ES",
      "Atlantic/Canary":"ES",
      "Europe/Lisbon":"PT",
      "Europe/London":"GB",
      "Europe/Paris":"FR",
      "Europe/Rome":"IT",
      "Europe/Berlin":"DE",
      "Europe/Dublin":"IE",
      "Europe/Amsterdam":"NL",
      "Europe/Brussels":"BE",
      "Europe/Zurich":"CH",
      "Europe/Vienna":"AT",
      "Europe/Stockholm":"SE",
      "Europe/Oslo":"NO",
      "Europe/Copenhagen":"DK",
      "Europe/Helsinki":"FI",
      "Europe/Warsaw":"PL",
      "Europe/Prague":"CZ",
      "Europe/Bucharest":"RO",
      "Europe/Athens":"GR",
      "Europe/Istanbul":"TR",
      "Europe/Kyiv":"UA",
      "Asia/Jerusalem":"IL",
      "Asia/Dubai":"AE",
      "Asia/Riyadh":"SA",
      "Asia/Kolkata":"IN",
      "Asia/Karachi":"PK",
      "Asia/Dhaka":"BD",
      "Asia/Shanghai":"CN",
      "Asia/Tokyo":"JP",
      "Asia/Seoul":"KR",
      "Asia/Manila":"PH",
      "Asia/Jakarta":"ID",
      "Asia/Bangkok":"TH",
      "Asia/Ho_Chi_Minh":"VN",
      "Asia/Kuala_Lumpur":"MY",
      "Asia/Singapore":"SG",
      "Australia/Sydney":"AU",
      "Australia/Melbourne":"AU",
      "Australia/Perth":"AU",
      "Pacific/Auckland":"NZ",
      "Africa/Johannesburg":"ZA",
      "Africa/Cairo":"EG",
      "Africa/Casablanca":"MA",
      "Africa/Lagos":"NG",
      "Africa/Nairobi":"KE",
      "Africa/Accra":"GH"
    };

    if (exact[tz] && valid.has(exact[tz])) return exact[tz];
    if (tz.startsWith("America/Argentina/")) return "AR";
    if (/^America\/(Sao_Paulo|Fortaleza|Manaus|Recife|Belem|Bahia|Cuiaba|Campo_Grande|Porto_Velho|Rio_Branco)$/.test(tz)) return "BR";

    const localeCandidates = [
      ...(navigator.languages || []),
      navigator.language
    ].filter(Boolean);

    for (const locale of localeCandidates) {
      const normalized = String(locale).replace("_","-");
      const parts = normalized.split("-");
      const region = parts.find((part,index)=>index>0 && /^[A-Za-z]{2}$/.test(part));
      if (region && valid.has(region.toUpperCase())) return region.toUpperCase();
    }

    return "BO";
  }

  function populateCountrySelect(selectId,detectedIso) {
    const select = $(selectId);
    if (!select) return;

    select.innerHTML = PHONE_COUNTRIES.map(([iso,code,name]) =>
      '<option value="'+code+'" data-iso="'+iso+'" '+(iso===detectedIso?'selected':'')+'>'+name+' ('+code+')</option>'
    ).join("");

    const target = [...select.options].find(option=>option.dataset.iso===detectedIso);
    if (target) select.value = target.value;
    else {
      const fallback = [...select.options].find(option=>option.dataset.iso==="BO");
      if (fallback) fallback.selected = true;
    }
  }

  function populateCatalogCountrySelect(detectedIso) {
    const select = $("catalogCountry");
    if (!select) return;
    select.innerHTML = PHONE_COUNTRIES.map(([iso,,name]) =>
      '<option value="'+iso+'" '+(iso===detectedIso?'selected':'')+'>'+name+'</option>'
    ).join("");
    if (![...select.options].some(option=>option.value===detectedIso)) {
      select.value = "CL";
    }
  }

  function selectedCountryCode(selectId) {
    return $(selectId)?.value || "+591";
  }

  function selectedCountryIso(selectId) {
    return $(selectId)?.selectedOptions?.[0]?.dataset?.iso || "BO";
  }

  function setCountryByIso(selectId,iso) {
    const select = $(selectId);
    if (!select) return;
    const option = [...select.options].find(item=>item.dataset.iso===iso);
    if (option) select.selectedIndex = option.index;
  }

  function rememberCountry(iso) {
    try { localStorage.setItem("member_phone_country",iso); } catch (_) {}
  }

  function bindCountrySelectors() {
    const login = $("memberLoginCountry");
    const register = $("memberRegisterCountry");

    const sync = (source,targetId) => {
      const iso = source.selectedOptions?.[0]?.dataset?.iso;
      if (!iso) return;
      rememberCountry(iso);
      setCountryByIso(targetId,iso);
    };

    if (login) login.addEventListener("change",()=>sync(login,"memberRegisterCountry"));
    if (register) register.addEventListener("change",()=>sync(register,"memberLoginCountry"));
  }

  const statusText = {
    pending_secretary:"Pendiente de revisión del Secretario",
    contacted:"Contactado por el Secretario",
    pending_leader:"Pendiente de aprobación del líder",
    approved:"Entrevista aprobada",
    rejected:"Solicitud rechazada",
    reschedule:"Necesita reprogramación",
    completed:"Entrevista completada",
    cancelled:"Entrevista cancelada"
  };

  const statusHelp = {
    pending_secretary:"Tu solicitud fue recibida. El Secretario todavía debe revisarla.",
    contacted:"El Secretario ya realizó el primer contacto.",
    pending_leader:"El Secretario derivó tu solicitud al líder correspondiente.",
    approved:"El líder aprobó la entrevista.",
    rejected:"La solicitud fue rechazada. Puedes realizar una nueva solicitud si corresponde.",
    reschedule:"Debes coordinar un nuevo horario con el Secretario.",
    completed:"La entrevista fue marcada como completada.",
    cancelled:"La solicitud fue cancelada."
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function normalizePhone(value,countryCode) {
    const raw = String(value || "").trim();
    let digits;

    if (raw.startsWith("+")) {
      digits = raw.replace(/\D/g,"");
    } else {
      const prefix = String(countryCode || "").replace(/\D/g,"");
      const local = raw.replace(/\D/g,"").replace(/^0+/,"");
      digits = prefix + local;
    }

    if (digits.length < 8 || digits.length > 15) {
      throw new Error("Ingresa un número válido. Puedes usar el formato internacional, por ejemplo +56912345678.");
    }

    return "+"+digits;
  }

  function prettyPhone(phone) {
    const raw = String(phone||"").replace(/\s+/g,"");
    if (!raw.startsWith("+")) return raw;
    const digits = raw.slice(1);
    return "+"+digits.replace(/(\d{1,3})(?=\d)/,"$1 ");
  }

  function memberAuthEmail(phone) {
    const digits = String(phone || "").replace(/\D/g,"");
    if (!digits) throw new Error("Número de teléfono inválido.");
    return "m"+digits+"@members.expressdelivery.pro";
  }

  function dateKeyBolivia(value) {
    return new Intl.DateTimeFormat("en-CA",{
      timeZone:"America/La_Paz",
      year:"numeric",month:"2-digit",day:"2-digit"
    }).format(new Date(value));
  }

  function longDateFromKey(key) {
    const [y,m,d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-BO",{
      weekday:"long",day:"numeric",month:"long",year:"numeric"
    }).format(new Date(y,m-1,d)).replace(/^./,c=>c.toUpperCase());
  }

  function dayButtonParts(key) {
    const [y,m,d] = key.split("-").map(Number);
    const date = new Date(y,m-1,d);
    return {
      weekday:new Intl.DateTimeFormat("es-BO",{weekday:"long"}).format(date).replace(/^./,c=>c.toUpperCase()),
      date:new Intl.DateTimeFormat("es-BO",{day:"numeric",month:"short"}).format(date).replace(".","")
    };
  }

  function timeLabel(value) {
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"America/La_Paz",
      hour:"2-digit",minute:"2-digit"
    }).format(new Date(value));
  }

  function fullDateTime(value) {
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"America/La_Paz",
      weekday:"long",day:"numeric",month:"long",year:"numeric",
      hour:"2-digit",minute:"2-digit"
    }).format(new Date(value));
  }

  function showAuthMessage(message,type="error") {
    const el = $("memberAuthMessage");
    el.textContent = message;
    el.className = "alert "+type;
  }

  function clearAuthMessage() {
    $("memberAuthMessage").className = "alert hidden";
    $("memberAuthMessage").textContent = "";
  }

  function showBookingError(message) {
    $("bookingError").textContent = message;
    $("bookingError").classList.remove("hidden");
  }

  function clearBookingError() {
    $("bookingError").classList.add("hidden");
    $("bookingError").textContent = "";
  }

  function setAuthTab(tab) {
    const login = tab==="login";
    $("memberLoginForm").classList.toggle("hidden",!login);
    $("memberRegisterForm").classList.toggle("hidden",login);
    $("showMemberLogin").classList.toggle("active",login);
    $("showMemberRegister").classList.toggle("active",!login);
    clearAuthMessage();
  }

  async function loadSettings() {
    const {data} = await db.from("settings")
      .select("unit_name,allow_public_booking")
      .eq("id",1)
      .maybeSingle();
    if (data?.unit_name) $("unitName").textContent = data.unit_name;
  }

  function setMemberAppMode(mode) {
    const isLoading = mode==="loading";
    const isGuest = mode==="guest";
    const isMember = mode==="member";

    $("memberBootLoading")?.classList.toggle("hidden",!isLoading);
    $("publicHero")?.classList.toggle("hidden",!isGuest);
    $("memberAuthCard")?.classList.toggle("hidden",!isGuest);
    $("publicInfoGrid")?.classList.toggle("hidden",!isGuest);
    $("memberArea")?.classList.toggle("hidden",!isMember);
    $("memberMenuToggle")?.classList.toggle("hidden",!isMember);
    $("publicTopbar")?.classList.toggle("member-menu-enabled",isMember);

    if (!isMember) closeMemberMenu();
  }

  function showBootLoading(message="Comprobando tu sesión de forma segura.") {
    setMemberAppMode("loading");
    if ($("memberBootMessage")) $("memberBootMessage").textContent = message;
    $("memberBootSpinner")?.classList.remove("hidden");
    $("memberBootRetry")?.classList.add("hidden");
  }

  function showBootError(message) {
    setMemberAppMode("loading");
    if ($("memberBootMessage")) $("memberBootMessage").textContent = message;
    $("memberBootSpinner")?.classList.add("hidden");
    $("memberBootRetry")?.classList.remove("hidden");
  }

  const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));

  async function fetchMemberProfile(userId) {
    return await db.from("member_profiles")
      .select("id,phone,full_name,church_unit_name,meetinghouse_name,location_city,location_country_code,unit_assignment_method,unit_updated_at")
      .eq("id",userId)
      .maybeSingle();
  }

  async function loadMember(session,{retry=true}={}) {
    state.session = session;
    showBootLoading("Cargando tu cuenta de miembro…");

    let result = await fetchMemberProfile(session.user.id);

    if (result.error && retry) {
      await wait(450);
      result = await fetchMemberProfile(session.user.id);
    }

    const {data,error} = result;

    if (error) {
      console.error("member profile load failed",error);
      showBootError("No pudimos cargar tu cuenta en este momento. Tu sesión sigue protegida; reintenta la conexión.");
      return false;
    }

    if (!data) {
      state.member = null;
      setMemberAppMode("guest");
      showAuthMessage("Esta sesión no corresponde a una cuenta de miembro. Cierra sesión del panel interno antes de entrar como miembro.","error");
      return false;
    }

    state.member = data;
    $("memberAccountName").textContent = data.full_name;
    $("memberAccountPhone").textContent = prettyPhone(data.phone);
    renderMemberUnit();

    await Promise.all([loadMemberAppointments(),loadLeaders()]);

    setMemberAppMode("member");
    showMemberView("home");
    return true;
  }

  async function loadMemberAppointments() {
    if (!state.member) return;

    const {data,error} = await db.from("appointments")
      .select("id,request_code,status,created_at,availability(start_at,end_at),interview_types(name,leaders(title))")
      .eq("member_user_id",state.member.id)
      .order("created_at",{ascending:false});

    if (error) {
      $("memberAppointmentsList").innerHTML = '<div class="empty">No se pudieron cargar tus entrevistas.</div>';
      return;
    }

    const rows = data || [];
    $("memberAppointmentsList").innerHTML = rows.length ? rows.map(a =>
      '<article class="member-appointment">'+
        '<div class="member-appointment-top">'+
          '<div>'+
            '<strong>'+escapeHtml(a.interview_types?.leaders?.title||"Líder")+'</strong>'+
            '<span>'+escapeHtml(a.interview_types?.name||"Entrevista")+'</span>'+
          '</div>'+
          '<span class="badge '+escapeHtml(a.status)+'">'+escapeHtml(statusText[a.status]||a.status)+'</span>'+
        '</div>'+
        '<div class="member-appointment-time">'+
          (a.availability?.start_at ? escapeHtml(fullDateTime(a.availability.start_at)) : "Horario pendiente")+
        '</div>'+
        '<p>'+escapeHtml(statusHelp[a.status]||"")+'</p>'+
        '<small>Código: '+escapeHtml(a.request_code)+'</small>'+
      '</article>'
    ).join("") : '<div class="empty">Todavía no tienes entrevistas solicitadas.</div>';
  }

  async function loadLeaders() {
    const {data,error} = await db.from("leaders")
      .select("id,code,title,sort_order")
      .eq("is_active",true)
      .order("sort_order");

    if (error) {
      $("leaderGrid").innerHTML = '<div class="empty">No se pudieron cargar los líderes.</div>';
      return;
    }

    state.leaders = data || [];
    $("leaderGrid").innerHTML = "";

    state.leaders.forEach(leader => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "leader-card";
      button.dataset.leaderId = leader.id;
      button.innerHTML = '<strong>'+escapeHtml(leader.title)+'</strong><span>Ver días disponibles</span>';
      button.onclick = () => selectLeader(leader,button);
      $("leaderGrid").appendChild(button);
    });
  }

  async function selectLeader(leader,button) {
    clearBookingError();
    state.selectedLeader = leader;
    state.selectedDateKey = null;
    state.selectedSlot = null;

    document.querySelectorAll(".leader-card").forEach(el=>el.classList.remove("active"));
    button.classList.add("active");

    const [typesResult,slotsResult] = await Promise.all([
      db.from("interview_types")
        .select("id,name,sort_order")
        .eq("leader_id",leader.id)
        .eq("is_active",true)
        .order("sort_order"),
      db.from("availability")
        .select("id,start_at,end_at")
        .eq("leader_id",leader.id)
        .eq("is_active",true)
        .eq("is_booked",false)
        .gt("start_at",new Date().toISOString())
        .order("start_at")
    ]);

    state.interviewTypes = typesResult.data || [];
    state.slots = slotsResult.data || [];

    $("interviewType").innerHTML = state.interviewTypes.length
      ? state.interviewTypes.map(x=>'<option value="'+x.id+'">'+escapeHtml(x.name)+'</option>').join("")
      : '<option value="">No hay tipos disponibles</option>';

    renderAvailableDays();
    $("publicDayPanel").classList.add("hidden");
    $("selectedSlotSummary").textContent = "Selecciona primero un día y una hora.";
    $("bookingForm").classList.remove("hidden");
    $("bookingForm").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function groupedSlots() {
    const map = new Map();
    state.slots.forEach(slot=>{
      const key = dateKeyBolivia(slot.start_at);
      if (!map.has(key)) map.set(key,[]);
      map.get(key).push(slot);
    });
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  }

  function renderAvailableDays() {
    const groups = groupedSlots();
    if (!groups.length) {
      $("availableDays").innerHTML = '<div class="empty">Este líder todavía no tiene días disponibles.</div>';
      return;
    }

    $("availableDays").innerHTML = groups.map(([key,slots])=>{
      const part = dayButtonParts(key);
      const active = state.selectedDateKey===key ? " selected" : "";
      return '<button type="button" class="available-day-button'+active+'" data-date="'+key+'">'+
        '<strong>'+escapeHtml(part.weekday)+'</strong>'+
        '<span>'+escapeHtml(part.date)+'</span>'+
        '<small>'+slots.length+' hora'+(slots.length===1?"":"s")+'</small>'+
      '</button>';
    }).join("");

    $("availableDays").querySelectorAll("[data-date]").forEach(button=>{
      button.onclick = () => selectDay(button.dataset.date);
    });
  }

  function selectDay(key) {
    state.selectedDateKey = key;
    state.selectedSlot = null;
    renderAvailableDays();

    const rows = state.slots.filter(slot=>dateKeyBolivia(slot.start_at)===key);
    $("publicSelectedDate").textContent = longDateFromKey(key);
    $("publicTimeSlots").innerHTML = rows.map(slot=>
      '<button class="time-slot-button" type="button" data-slot="'+slot.id+'">'+
        escapeHtml(timeLabel(slot.start_at))+
      '</button>'
    ).join("");

    $("publicTimeSlots").querySelectorAll("[data-slot]").forEach(button=>{
      button.onclick = () => {
        const slot = rows.find(x=>x.id===button.dataset.slot);
        state.selectedSlot = slot || null;
        document.querySelectorAll(".time-slot-button").forEach(x=>x.classList.remove("selected"));
        button.classList.add("selected");
        $("selectedSlotSummary").textContent = slot
          ? "Horario elegido: "+fullDateTime(slot.start_at)
          : "Selecciona primero un día y una hora.";
      };
    });

    $("publicDayPanel").classList.remove("hidden");
  }


  function renderMemberUnit() {
    const box = $("currentMemberUnit");
    if (!box || !state.member) return;

    if (state.member.church_unit_name) {
      const chapel = state.member.meetinghouse_name
        ? '<span>Capilla: '+escapeHtml(state.member.meetinghouse_name)+'</span>'
        : '';
      const place = [state.member.location_city,state.member.location_country_code].filter(Boolean).join(" · ");
      box.innerHTML =
        '<strong>'+escapeHtml(state.member.church_unit_name)+'</strong>'+
        chapel+
        (place?'<span>'+escapeHtml(place)+'</span>':'');
      box.classList.add("configured");
    } else {
      box.innerHTML =
        '<strong>Unidad todavía no configurada</strong>'+
        '<span>Puedes buscar una capilla cercana o confirmar tu barrio manualmente.</span>';
      box.classList.remove("configured");
    }
  }

  function renderMemberHome() {
    const el = $("memberHomeUnit");
    if (!el || !state.member) return;

    if (state.member.church_unit_name) {
      el.innerHTML =
        '<span class="member-home-status-label">Tu unidad</span>'+
        '<strong>'+escapeHtml(state.member.church_unit_name)+'</strong>'+
        (state.member.meetinghouse_name
          ? '<small>'+escapeHtml(state.member.meetinghouse_name)+'</small>'
          : '');
    } else {
      el.innerHTML =
        '<span class="member-home-status-label">Tu unidad</span>'+
        '<strong>Sin configurar</strong>'+
        '<small>Usa “Mi barrio y capilla” para buscarla.</small>';
    }
  }

  function closeMemberMenu() {
    $("memberSidebar")?.classList.remove("open");
    $("memberSidebarBackdrop")?.classList.remove("open");
    const toggle = $("memberMenuToggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded","false");
      toggle.setAttribute("aria-label","Abrir menú");
    }
    document.body.classList.remove("member-menu-open");
  }

  function openMemberMenu() {
    $("memberSidebar")?.classList.add("open");
    $("memberSidebarBackdrop")?.classList.add("open");
    const toggle = $("memberMenuToggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded","true");
      toggle.setAttribute("aria-label","Cerrar menú");
    }
    document.body.classList.add("member-menu-open");
  }

  function showMemberView(view) {
    const views = {
      home:"memberViewHome",
      unit:"memberViewUnit",
      appointments:"memberViewAppointments",
      booking:"memberViewBooking"
    };
    const targetId = views[view] || views.home;

    Object.values(views).forEach(id=>{
      $(id)?.classList.toggle("hidden",id!==targetId);
    });

    document.querySelectorAll("[data-member-view]").forEach(button=>{
      button.classList.toggle("active",button.dataset.memberView===view);
    });

    if (view==="home") renderMemberHome();
    if (view==="appointments") loadMemberAppointments();

    closeMemberMenu();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function setLocationStatus(message,type="info") {
    const el = $("memberLocationStatus");
    el.textContent = message;
    el.className = "alert "+type;
  }

  function clearLocationStatus() {
    $("memberLocationStatus").className = "alert hidden";
    $("memberLocationStatus").textContent = "";
  }

  function getPreciseLocation() {
    return new Promise((resolve,reject)=>{
      if (!navigator.geolocation) {
        reject(new Error("Este navegador no permite obtener la ubicación."));
        return;
      }

      let best = null;
      let settled = false;
      let watchId = null;

      const finish = (value,error=null) => {
        if (settled) return;
        settled = true;
        if (watchId!==null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value);
      };

      const messages = {
        1:"Permiso de ubicación denegado. Habilita la ubicación precisa del navegador o busca tu barrio manualmente.",
        2:"No fue posible determinar tu ubicación.",
        3:"La ubicación tardó demasiado en responder. Inténtalo nuevamente."
      };

      const timer = setTimeout(()=>{
        if (best) finish(best);
        else finish(null,new Error("No pudimos obtener una ubicación suficientemente precisa. Revisa que el GPS esté activo."));
      },12000);

      watchId = navigator.geolocation.watchPosition(
        position=>{
          const current = {
            lat:position.coords.latitude,
            lon:position.coords.longitude,
            accuracy:position.coords.accuracy
          };
          if (!best || current.accuracy<best.accuracy) best=current;
          if (current.accuracy<=25) finish(current);
        },
        error=>{
          if (best) finish(best);
          else finish(null,new Error(messages[error.code] || "No se pudo obtener tu ubicación."));
        },
        {enableHighAccuracy:true,timeout:11000,maximumAge:0}
      );
    });
  }

  function distanceKm(lat1,lon1,lat2,lon2) {
    const rad = value=>value*Math.PI/180;
    const R = 6371;
    const dLat = rad(lat2-lat1);
    const dLon = rad(lon2-lon1);
    const a =
      Math.sin(dLat/2)*Math.sin(dLat/2)+
      Math.cos(rad(lat1))*Math.cos(rad(lat2))*
      Math.sin(dLon/2)*Math.sin(dLon/2);
    return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function pointInRing(point,ring) {
    const [x,y] = point;
    let inside = false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [xi,yi] = ring[i];
      const [xj,yj] = ring[j];
      const intersect = ((yi>y)!==(yj>y)) &&
        (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInGeoJson(lon,lat,geojson) {
    if (!geojson || !geojson.type) return false;
    const point = [lon,lat];

    if (geojson.type==="Polygon") {
      return geojson.coordinates?.[0] ? pointInRing(point,geojson.coordinates[0]) : false;
    }

    if (geojson.type==="MultiPolygon") {
      return (geojson.coordinates||[]).some(poly=>poly?.[0] && pointInRing(point,poly[0]));
    }

    if (geojson.type==="Feature") return pointInGeoJson(lon,lat,geojson.geometry);
    if (geojson.type==="FeatureCollection") {
      return (geojson.features||[]).some(feature=>pointInGeoJson(lon,lat,feature.geometry));
    }

    return false;
  }

  async function reverseLocation(lat,lon) {
    try {
      const url =
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=10&accept-language=es&lat="+
        encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon);
      const response = await fetch(url,{headers:{"Accept":"application/json"}});
      if (!response.ok) throw new Error("reverse failed");
      const data = await response.json();
      const address = data.address || {};
      return {
        city:address.city || address.town || address.village || address.municipality || address.county || "",
        countryCode:String(address.country_code||"").toUpperCase()
      };
    } catch (_) {
      return {city:"",countryCode:""};
    }
  }

  async function syncOfficialDirectory({city,countryCode,lat,lon}={}) {
    try {
      const body = {};
      if (city) body.city = city;
      if (countryCode) body.countryCode = countryCode;
      if (Number.isFinite(lat)) body.lat = lat;
      if (Number.isFinite(lon)) body.lon = lon;

      const {data,error} = await db.functions.invoke("church-directory",{body});
      if (error) {
        console.warn("official directory sync failed",error);
        return null;
      }
      return data || null;
    } catch (error) {
      console.warn("official directory sync failed",error);
      return null;
    }
  }

  function groupCatalogRows(rows,origin=null) {
    const map = new Map();

    for (const row of rows||[]) {
      const key = row.meetinghouse_id || [row.country_code,row.city,row.address].join("|");
      if (!map.has(key)) {
        const hasCoords = Number.isFinite(row.latitude) && Number.isFinite(row.longitude);
        map.set(key,{
          source:"catalog",
          exact:false,
          meetinghouseId:row.meetinghouse_id,
          unitName:"",
          units:[],
          name:row.meetinghouse_name || "Capilla",
          address:row.address || "",
          city:row.city || "",
          region:row.region || "",
          countryCode:row.country_code || "",
          lat:hasCoords ? row.latitude : null,
          lon:hasCoords ? row.longitude : null,
          officialUrl:row.official_url || null,
          distanceKm:hasCoords && origin
            ? distanceKm(origin.lat,origin.lon,row.latitude,row.longitude)
            : null,
          bookingUrl:null
        });
      }

      const item = map.get(key);
      if (row.unit_id && !item.units.some(unit=>unit.id===row.unit_id)) {
        item.units.push({
          id:row.unit_id,
          name:row.unit_name,
          type:row.unit_type,
          sundayService:row.sunday_service || "",
          officialUrl:row.unit_official_url || null
        });
      }
    }

    return [...map.values()].sort((a,b)=>{
      const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
      const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
      if (ad!==bd) return ad-bd;
      return (a.address||"").localeCompare(b.address||"","es");
    });
  }

  async function searchCatalog({query="",countryCode="",city="",origin=null,limit=100}={}) {
    const {data,error} = await db.rpc("search_church_catalog",{
      p_query:query || null,
      p_country_code:countryCode || null,
      p_city:city || null,
      p_limit:limit
    });

    if (error) {
      console.warn("catalog search failed",error);
      return [];
    }

    return groupCatalogRows(data||[],origin);
  }

  async function configuredUnitsNear(lat,lon,context={}) {
    return await searchCatalog({
      countryCode:context.countryCode || "",
      city:context.city || "",
      origin:{lat,lon},
      limit:100
    });
  }

  function catalogCounts(items) {
    const meetinghouses = items.length;
    const units = items.reduce((sum,item)=>sum+(item.units?.length||0),0);
    return {meetinghouses,units};
  }

  async function fetchJsonWithTimeout(url,timeoutMs=14000) {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),timeoutMs);

    try {
      const response = await fetch(url,{
        headers:{"Accept":"application/json"},
        signal:controller.signal
      });
      if (!response.ok) throw new Error("HTTP "+response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function meetinghouseFromOsmElement(item,originLat,originLon) {
    const plat = item.lat ?? item.center?.lat;
    const plon = item.lon ?? item.center?.lon;
    if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;

    const tags = item.tags || {};
    const address = [
      tags["addr:street"],
      tags["addr:housenumber"],
      tags["addr:suburb"],
      tags["addr:city"]
    ].filter(Boolean).join(" ");

    return {
      source:"osm",
      exact:false,
      unitName:"",
      name:
        tags.name ||
        tags.official_name ||
        tags.brand ||
        tags.operator ||
        "Centro de reuniones de La Iglesia de Jesucristo",
      address,
      city:tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "",
      countryCode:String(tags["addr:country"]||"").toUpperCase(),
      lat:plat,
      lon:plon,
      distanceKm:distanceKm(originLat,originLon,plat,plon),
      bookingUrl:null
    };
  }

  function mergeMeetinghouses(rows) {
    const deduped = [];
    const seen = new Set();

    for (const item of rows.filter(Boolean)) {
      const coordKey = Number.isFinite(item.lat) && Number.isFinite(item.lon)
        ? Math.round(item.lat*10000)+":"+Math.round(item.lon*10000)
        : "";
      const nameKey = String(item.name||"").toLowerCase().replace(/\s+/g," ").trim();
      const key = coordKey || nameKey;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    return deduped.sort((a,b)=>{
      if (a.exact && !b.exact) return -1;
      if (!a.exact && b.exact) return 1;
      const ad = Number.isFinite(a.distanceKm) ? a.distanceKm : Number.MAX_SAFE_INTEGER;
      const bd = Number.isFinite(b.distanceKm) ? b.distanceKm : Number.MAX_SAFE_INTEGER;
      return ad-bd;
    });
  }

  async function osmMeetinghousesNear(lat,lon,radius=30000) {
    const nameRegex = "Jesucristo|Jesus Christ|Latter[- ]?day|Últimos Días|Ultimos Dias|Santos de los Últimos|Santos de los Ultimos|Iglesia SUD|LDS";

    const query =
      '[out:json][timeout:12];('+
      'nwr(around:'+radius+','+lat+','+lon+')["brand:wikidata"="Q42504"];'+
      'nwr(around:'+radius+','+lat+','+lon+')["operator:wikidata"="Q42504"];'+
      'nwr(around:'+radius+','+lat+','+lon+')["name"~"'+nameRegex+'",i];'+
      'nwr(around:'+radius+','+lat+','+lon+')["official_name"~"'+nameRegex+'",i];'+
      'nwr(around:'+radius+','+lat+','+lon+')["brand"~"'+nameRegex+'",i];'+
      'nwr(around:'+radius+','+lat+','+lon+')["operator"~"'+nameRegex+'",i];'+
      'nwr(around:'+radius+','+lat+','+lon+')["denomination"~"mormon|latter.?day|lds",i];'+
      ');out center tags;';

    const endpoints = [
      "https://overpass-api.de/api/interpreter?data=",
      "https://overpass.kumi.systems/api/interpreter?data="
    ];

    const attempts = endpoints.map(async base=>{
      const data = await fetchJsonWithTimeout(base+encodeURIComponent(query),9000);
      return (data.elements||[]).map(item=>meetinghouseFromOsmElement(item,lat,lon));
    });

    const settled = await Promise.allSettled(attempts);
    const rows = settled
      .filter(result=>result.status==="fulfilled")
      .flatMap(result=>result.value||[]);

    if (!rows.length && settled.every(result=>result.status==="rejected")) {
      throw new Error("No fue posible consultar centros de reuniones cercanos.");
    }

    return mergeMeetinghouses(rows);
  }

  async function nominatimMeetinghousesNear(lat,lon,context={},radiusKm=120) {
    const latDelta = radiusKm/111;
    const cos = Math.max(Math.cos(lat*Math.PI/180),0.25);
    const lonDelta = radiusKm/(111*cos);
    const viewbox = [
      lon-lonDelta,
      lat+latDelta,
      lon+lonDelta,
      lat-latDelta
    ].join(",");

    const spanish = String(navigator.language||"").toLowerCase().startsWith("es");
    const query = spanish
      ? "La Iglesia de Jesucristo de los Santos de los Últimos Días"
      : "The Church of Jesus Christ of Latter-day Saints";

    const params = new URLSearchParams({
      format:"jsonv2",
      addressdetails:"1",
      dedupe:"1",
      limit:"20",
      bounded:"1",
      viewbox,
      q:query,
      "accept-language":"es"
    });

    if (context.countryCode) {
      params.set("countrycodes",String(context.countryCode).toLowerCase());
    }

    try {
      const data = await fetchJsonWithTimeout(
        "https://nominatim.openstreetmap.org/search?"+params.toString(),
        12000
      );

      return mergeMeetinghouses((data||[]).map(item=>{
        const plat = Number(item.lat);
        const plon = Number(item.lon);
        if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;

        const address = item.address || {};
        return {
          source:"nominatim",
          exact:false,
          unitName:"",
          name:
            address.amenity ||
            address.building ||
            String(item.display_name||"").split(",")[0] ||
            "Centro de reuniones de La Iglesia de Jesucristo",
          address:String(item.display_name||""),
          city:address.city || address.town || address.village || address.municipality || "",
          countryCode:String(address.country_code||context.countryCode||"").toUpperCase(),
          lat:plat,
          lon:plon,
          distanceKm:distanceKm(lat,lon,plat,plon),
          bookingUrl:null
        };
      }));
    } catch (_) {
      return [];
    }
  }

  async function progressiveMeetinghouseSearch(lat,lon,context={}) {
    const firstStage = await Promise.allSettled([
      osmMeetinghousesNear(lat,lon,30000),
      nominatimMeetinghousesNear(lat,lon,context,120)
    ]);

    let found = mergeMeetinghouses(
      firstStage
        .filter(result=>result.status==="fulfilled")
        .flatMap(result=>result.value||[])
    );

    let searchedRadiusKm = 120;

    if (found.length<3) {
      try {
        const expanded = await osmMeetinghousesNear(lat,lon,120000);
        found = mergeMeetinghouses([...found,...expanded]);
      } catch (_) {}
    }

    return {
      rows:found.filter(item=>
        !Number.isFinite(item.distanceKm) || item.distanceKm<=120
      ).slice(0,15),
      searchedRadiusKm
    };
  }

  async function findNearbyMeetinghouses() {
    clearLocationStatus();
    $("nearbyMeetinghouses").innerHTML = "";
    $("nearbyMeetinghouses").classList.remove("hidden");
    $("unitConfirmPanel").classList.add("hidden");
    $("catalogSearchCard")?.classList.add("hidden");
    state.manualCatalogOpen = false;
    state.unitSelectionSource = null;
    if ($("manualUnitBtn")) $("manualUnitBtn").textContent = "Mi barrio todavía no aparece: buscar manualmente";

    const button = $("useMemberLocation");
    button.disabled = true;
    button.textContent = "Buscando ubicación…";

    try {
      const position = await getPreciseLocation();

      setLocationStatus(
        "Ubicación obtenida con una precisión aproximada de "+Math.round(position.accuracy)+" m. Identificando tu ciudad…",
        "info"
      );

      const context = await reverseLocation(position.lat,position.lon);
      state.locationContext = {
        ...context,
        lat:position.lat,
        lon:position.lon,
        accuracy:position.accuracy
      };

      if (context.countryCode && $("catalogCountry")) {
        $("catalogCountry").value = context.countryCode;
      }
      if (context.city && $("catalogCity")) {
        $("catalogCity").value = context.city;
      }

      setLocationStatus(
        "Ubicación lista"+(context.city?" en "+context.city:"")+". Consultando nuestro catálogo y el directorio oficial…",
        "info"
      );

      await Promise.race([
        syncOfficialDirectory({
          city:context.city,
          countryCode:context.countryCode,
          lat:position.lat,
          lon:position.lon
        }),
        new Promise(resolve=>setTimeout(()=>resolve(null),16000))
      ]);

      let catalog = await configuredUnitsNear(position.lat,position.lon,context);

      // El catálogo oficial por ciudad es la fuente principal. OSM queda solo como respaldo.
      if (!catalog.length) {
        const fallback = await Promise.race([
          progressiveMeetinghouseSearch(position.lat,position.lon,context),
          new Promise(resolve=>setTimeout(()=>resolve({rows:[],searchedRadiusKm:120,timedOut:true}),18000))
        ]);
        catalog = fallback.rows || [];
      }

      state.nearbyMeetinghouses = mergeMeetinghouses(catalog).slice(0,20);
      renderNearbyMeetinghouses();

      if (state.nearbyMeetinghouses.length) {
        $("catalogSearchCard")?.classList.add("hidden");
        state.manualCatalogOpen = false;
        const counts = catalogCounts(state.nearbyMeetinghouses);
        setLocationStatus(
          "Encontramos "+counts.meetinghouses+" capilla(s)"+
          (counts.units ? " y "+counts.units+" barrio(s)/rama(s)" : "")+
          (context.city ? " en o cerca de "+context.city : "")+
          ". Revisa la dirección y selecciona tu unidad.",
          "success"
        );
      } else {
        $("catalogSearchCard")?.classList.remove("hidden");
        state.manualCatalogOpen = true;
        if ($("manualUnitBtn")) $("manualUnitBtn").textContent = "Ocultar búsqueda manual";
        setLocationStatus(
          "No encontramos una capilla automáticamente para esta ubicación. Usa la búsqueda manual por ciudad, capilla o barrio.",
          "info"
        );
      }
    } catch (error) {
      setLocationStatus(error.message || "No se pudo obtener tu ubicación.","error");
    } finally {
      button.disabled = false;
      button.textContent = "Usar mi ubicación";
    }
  }

  function unitSummary(item) {
    if (!item.units?.length) return "";
    return item.units.map(unit=>
      unit.name+(unit.sundayService?" · "+unit.sundayService:"")
    ).join(" | ");
  }

  function renderNearbyMeetinghouses() {
    const list = $("nearbyMeetinghouses");
    const rows = state.nearbyMeetinghouses || [];

    if (!rows.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML =
      '<div class="subheading-row"><h3>Capillas cercanas</h3><span class="muted-text">'+rows.length+' encontrada(s)</span></div>'+
      rows.map((item,index)=>
        '<article class="meetinghouse-item '+(item.exact?"exact-unit":"")+'">'+
          '<div>'+
            (item.exact?'<span class="match-badge">Coincide con límite configurado</span>':'')+
            '<strong>'+escapeHtml(item.name)+'</strong>'+
            (item.address?'<span>'+escapeHtml(item.address)+'</span>':'')+
            (item.city?'<span>'+escapeHtml(item.city+(item.region?" · "+item.region:""))+'</span>':'')+
            (item.units?.length?'<span class="unit-list-text"><strong>Barrios/Ramas:</strong> '+escapeHtml(unitSummary(item))+'</span>':'')+
            (Number.isFinite(item.distanceKm)?'<small>A '+escapeHtml(item.distanceKm.toFixed(1))+' km aprox.</small>':'')+
          '</div>'+
          '<button class="secondary-button" type="button" data-meetinghouse="'+index+'">Seleccionar</button>'+
        '</article>'
      ).join("");

    list.querySelectorAll("[data-meetinghouse]").forEach(button=>{
      button.onclick = () => chooseMeetinghouse(rows[Number(button.dataset.meetinghouse)],null,"gps");
    });
  }

  function renderCatalogResults() {
    const list = $("catalogResults");
    const rows = state.catalogResults || [];

    if (!rows.length) {
      list.innerHTML = '<div class="empty">No encontramos coincidencias en el catálogo para esa búsqueda.</div>';
      return;
    }

    list.innerHTML = rows.map((item,index)=>
      '<article class="meetinghouse-item catalog-result-item">'+
        '<div>'+
          '<strong>'+escapeHtml(item.name)+'</strong>'+
          (item.address?'<span>'+escapeHtml(item.address)+'</span>':'')+
          (item.city?'<span>'+escapeHtml(item.city+(item.region?" · "+item.region:""))+'</span>':'')+
          (item.units?.length
            ? '<div class="catalog-unit-buttons">'+item.units.map(unit=>
                '<button type="button" class="catalog-unit-button" data-catalog-index="'+index+'" data-unit-id="'+escapeHtml(unit.id)+'">'+
                  escapeHtml(unit.name)+(unit.sundayService?' · '+escapeHtml(unit.sundayService):'')+
                '</button>'
              ).join("")+'</div>'
            : '<small>Capilla registrada; si tu barrio todavía no está cargado podrás escribirlo al seleccionar.</small>')+
        '</div>'+
        (!item.units?.length
          ? '<button class="secondary-button" type="button" data-catalog-meetinghouse="'+index+'">Seleccionar capilla</button>'
          : '')+
      '</article>'
    ).join("");

    list.querySelectorAll("[data-catalog-index]").forEach(button=>{
      button.onclick = () => {
        const item = rows[Number(button.dataset.catalogIndex)];
        chooseMeetinghouse(item,button.dataset.unitId,"manual");
      };
    });

    list.querySelectorAll("[data-catalog-meetinghouse]").forEach(button=>{
      button.onclick = () => chooseMeetinghouse(rows[Number(button.dataset.catalogMeetinghouse)],null,"manual");
    });
  }

  async function searchManualCatalog() {
    const countryCode = $("catalogCountry").value;
    const city = $("catalogCity").value.trim();
    const query = $("catalogQuery").value.trim();
    const button = $("catalogSearchBtn");

    if (!city && !query) {
      $("catalogSearchStatus").textContent = "Escribe una ciudad, barrio, capilla o dirección.";
      return;
    }

    button.disabled = true;
    button.textContent = "Buscando…";
    $("catalogSearchStatus").textContent = "Consultando catálogo…";

    try {
      if (city) {
        await Promise.race([
          syncOfficialDirectory({city,countryCode}),
          new Promise(resolve=>setTimeout(()=>resolve(null),16000))
        ]);
      }

      state.catalogResults = await searchCatalog({
        query,
        countryCode,
        city,
        limit:100
      });

      const counts = catalogCounts(state.catalogResults);
      $("catalogSearchStatus").textContent = counts.meetinghouses
        ? counts.meetinghouses+" capilla(s) y "+counts.units+" barrio(s)/rama(s) encontrados."
        : "No hay coincidencias todavía. Puedes escribir tu barrio manualmente.";
      renderCatalogResults();
    } finally {
      button.disabled = false;
      button.textContent = "Buscar";
    }
  }

  function chooseMeetinghouse(item,preferredUnitId=null,source="manual") {
    state.selectedMeetinghouse = item || null;
    state.unitSelectionSource = source;

    $("nearbyMeetinghouses")?.classList.add("hidden");
    $("catalogSearchCard")?.classList.add("hidden");
    if ($("manualUnitBtn")) $("manualUnitBtn").classList.add("hidden");

    $("selectedMeetinghouseName").textContent = item?.name || "Ingreso manual";
    $("selectedMeetinghouseMeta").textContent = item
      ? [item.address,item.city,Number.isFinite(item.distanceKm)?item.distanceKm.toFixed(1)+" km aprox.":""].filter(Boolean).join(" · ")
      : "Escribe el nombre correcto de tu barrio o rama.";

    const units = item?.units || [];
    const selectWrap = $("memberUnitSelectWrap");
    const inputWrap = $("memberUnitInputWrap");

    if (units.length) {
      $("memberUnitSelect").innerHTML = units.map(unit=>
        '<option value="'+escapeHtml(unit.id)+'">'+escapeHtml(unit.name)+(unit.sundayService?' · '+escapeHtml(unit.sundayService):'')+'</option>'
      ).join("");
      if (preferredUnitId && units.some(unit=>unit.id===preferredUnitId)) {
        $("memberUnitSelect").value = preferredUnitId;
      }
      selectWrap.classList.remove("hidden");
      inputWrap.classList.add("hidden");
      $("memberUnitName").value = "";
    } else {
      selectWrap.classList.add("hidden");
      inputWrap.classList.remove("hidden");
      $("memberUnitName").value = item?.unitName || state.member?.church_unit_name || "";
    }

    const maps = $("selectedGoogleMapsLink");
    if (item && Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
      maps.href = "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(item.lat+","+item.lon);
      maps.classList.remove("hidden");
    } else if (item?.address) {
      maps.href = "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent([item.address,item.city].filter(Boolean).join(", "));
      maps.classList.remove("hidden");
    } else {
      maps.classList.add("hidden");
      maps.removeAttribute("href");
    }

    $("unitConfirmPanel").classList.remove("hidden");
    $("unitConfirmPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  async function saveMemberUnit() {
    if (!state.member) return;

    const item = state.selectedMeetinghouse;
    const selectedUnitId = !$("memberUnitSelectWrap").classList.contains("hidden")
      ? $("memberUnitSelect").value
      : null;
    const selectedUnit = item?.units?.find(unit=>unit.id===selectedUnitId) || null;
    const unitName = selectedUnit?.name || $("memberUnitName").value.trim();

    if (unitName.length<2) {
      setLocationStatus("Selecciona o escribe el nombre de tu barrio o rama antes de guardar.","error");
      return;
    }

    const context = state.locationContext || {};
    const button = $("saveMemberUnit");
    button.disabled = true;
    button.textContent = "Guardando…";

    const {error} = await db.rpc("member_set_church_unit",{
      p_unit_name:unitName,
      p_meetinghouse_name:item?.name || null,
      p_city:item?.city || context.city || null,
      p_country_code:item?.countryCode || context.countryCode || null,
      p_assignment_method:item?.exact ? "boundary" : item ? "nearby_meetinghouse" : "manual"
    });

    button.disabled = false;
    button.textContent = "Guardar barrio";

    if (error) {
      setLocationStatus(error.message || "No se pudo guardar tu barrio.","error");
      return;
    }

    state.member.church_unit_name = unitName;
    state.member.meetinghouse_name = item?.name || null;
    state.member.location_city = item?.city || context.city || null;
    state.member.location_country_code = item?.countryCode || context.countryCode || null;
    state.member.unit_assignment_method = item?.exact ? "boundary" : item ? "nearby_meetinghouse" : "manual";

    renderMemberUnit();
    renderMemberHome();
    $("unitConfirmPanel").classList.add("hidden");
    $("nearbyMeetinghouses")?.classList.add("hidden");
    $("catalogSearchCard")?.classList.add("hidden");
    if ($("manualUnitBtn")) $("manualUnitBtn").classList.remove("hidden");
    state.manualCatalogOpen = false;
    state.unitSelectionSource = null;
    if ($("manualUnitBtn")) $("manualUnitBtn").textContent = "Cambiar mi barrio o capilla";
    setLocationStatus("Barrio y capilla guardados correctamente.","success");
  }

  $("memberLoginForm").onsubmit = async event => {
    event.preventDefault();
    clearAuthMessage();

    let phone;
    try {
      phone = normalizePhone($("memberLoginPhone").value,selectedCountryCode("memberLoginCountry"));
    } catch (error) {
      showAuthMessage(error.message);
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Ingresando…";

    const {data,error} = await db.auth.signInWithPassword({
      email:memberAuthEmail(phone),
      password:$("memberLoginPassword").value
    });

    button.disabled = false;
    button.textContent = "Ingresar";

    if (error) {
      showAuthMessage("Número de teléfono o contraseña incorrectos.");
      return;
    }

    if (data?.session) await loadMember(data.session);
  };

  $("memberRegisterForm").onsubmit = async event => {
    event.preventDefault();
    clearAuthMessage();

    const fullName = $("memberRegisterName").value.trim();
    const password = $("memberRegisterPassword").value;
    const password2 = $("memberRegisterPassword2").value;

    if (password!==password2) {
      showAuthMessage("Las contraseñas no coinciden.");
      return;
    }

    let phone;
    try {
      phone = normalizePhone($("memberRegisterPhone").value,selectedCountryCode("memberRegisterCountry"));
    } catch (error) {
      showAuthMessage(error.message);
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Creando…";

    const {data,error} = await db.auth.signUp({
      email:memberAuthEmail(phone),
      password,
      options:{
        data:{
          account_type:"member",
          full_name:fullName,
          phone_e164:phone
        }
      }
    });

    button.disabled = false;
    button.textContent = "Crear mi cuenta";

    if (error) {
      const msg = String(error.message||"");
      if (/already|registered|exists/i.test(msg)) {
        showAuthMessage("Ese número ya tiene una cuenta. Usa “Ingresar”.");
      } else {
        showAuthMessage(/email rate limit exceeded/i.test(msg) ? "Supabase está intentando enviar un correo de confirmación. Desactiva Confirm email en Authentication → Providers → Email, guarda y vuelve a intentarlo." : "No se pudo crear la cuenta. Revisa los datos e inténtalo nuevamente.");
      }
      return;
    }

    if (data?.session) {
      await loadMember(data.session);
    } else {
      showAuthMessage("La cuenta fue creada, pero falta desactivar “Confirm email” en Authentication → Providers → Email. Después podrás ingresar solo con teléfono y contraseña, sin SMS.","info");
    }
  };

  $("bookingForm").onsubmit = async event => {
    event.preventDefault();
    clearBookingError();

    if (!state.member || !state.session) {
      showBookingError("Inicia sesión con tu cuenta de miembro.");
      return;
    }

    const interviewTypeId = $("interviewType").value;
    const availabilityId = state.selectedSlot?.id;

    if (!state.selectedLeader || !interviewTypeId || !availabilityId) {
      showBookingError("Selecciona líder, tipo de entrevista, día y hora.");
      return;
    }

    const submit = $("submitBooking");
    submit.disabled = true;
    submit.textContent = "Enviando…";

    const {error} = await db.from("appointments").insert({
      availability_id:availabilityId,
      interview_type_id:interviewTypeId
    });

    submit.disabled = false;
    submit.textContent = "Solicitar entrevista";

    if (error) {
      if (error.code==="23505" || /unique|booked/i.test(String(error.message||""))) {
        showBookingError("Ese horario acaba de ser solicitado por otra persona. Elige otro horario.");
        const activeButton = document.querySelector('[data-leader-id="'+state.selectedLeader.id+'"]');
        if (activeButton) await selectLeader(state.selectedLeader,activeButton);
      } else {
        showBookingError("No se pudo enviar la solicitud. Inténtalo nuevamente.");
      }
      return;
    }

    $("bookingCard").classList.add("hidden");
    $("successBox").classList.remove("hidden");
    await loadMemberAppointments();
    $("successBox").scrollIntoView({behavior:"smooth"});
  };

  $("useMemberLocation").onclick = findNearbyMeetinghouses;
  $("manualUnitBtn").onclick = () => {
    const card = $("catalogSearchCard");
    state.manualCatalogOpen = !state.manualCatalogOpen;

    if (state.manualCatalogOpen) {
      card?.classList.remove("hidden");
      $("nearbyMeetinghouses")?.classList.add("hidden");
      $("unitConfirmPanel")?.classList.add("hidden");
      state.selectedMeetinghouse = null;
      state.unitSelectionSource = null;
      $("manualUnitBtn").textContent = "Volver a capillas encontradas";
      card?.scrollIntoView({behavior:"smooth",block:"nearest"});
    } else {
      card?.classList.add("hidden");
      if (state.nearbyMeetinghouses?.length) $("nearbyMeetinghouses")?.classList.remove("hidden");
      $("manualUnitBtn").textContent = "Mi barrio todavía no aparece: buscar manualmente";
    }
  };
  $("catalogSearchBtn").onclick = searchManualCatalog;
  $("catalogQuery").addEventListener("keydown",event=>{
    if (event.key==="Enter") {
      event.preventDefault();
      searchManualCatalog();
    }
  });
  $("catalogCity").addEventListener("keydown",event=>{
    if (event.key==="Enter") {
      event.preventDefault();
      searchManualCatalog();
    }
  });
  $("cancelMeetinghouseSelection").onclick = () => {
    $("unitConfirmPanel").classList.add("hidden");
    state.selectedMeetinghouse = null;

    if ($("manualUnitBtn")) $("manualUnitBtn").classList.remove("hidden");

    if (state.unitSelectionSource==="manual") {
      $("catalogSearchCard")?.classList.remove("hidden");
      $("nearbyMeetinghouses")?.classList.add("hidden");
      state.manualCatalogOpen = true;
      if ($("manualUnitBtn")) $("manualUnitBtn").textContent = "Volver a capillas encontradas";
    } else {
      $("catalogSearchCard")?.classList.add("hidden");
      if (state.nearbyMeetinghouses?.length) $("nearbyMeetinghouses")?.classList.remove("hidden");
      state.manualCatalogOpen = false;
      if ($("manualUnitBtn")) $("manualUnitBtn").textContent = "Mi barrio todavía no aparece: buscar manualmente";
    }

    state.unitSelectionSource = null;
  };
  $("saveMemberUnit").onclick = saveMemberUnit;

  $("memberMenuToggle").onclick = () => {
    const open = $("memberSidebar")?.classList.contains("open");
    if (open) closeMemberMenu();
    else openMemberMenu();
  };
  $("memberSidebarBackdrop").onclick = closeMemberMenu;
  document.querySelectorAll("[data-member-view]").forEach(button=>{
    button.addEventListener("click",()=>showMemberView(button.dataset.memberView));
  });

  $("showMemberLogin").onclick = () => setAuthTab("login");
  $("showMemberRegister").onclick = () => setAuthTab("register");
  $("memberRefreshAppointments").onclick = loadMemberAppointments;

  $("memberLogoutBtn").onclick = async () => {
    showBootLoading("Cerrando sesión…");
    await db.auth.signOut();
    state.session = null;
    state.member = null;
    setAuthTab("login");
    setMemberAppMode("guest");
  };

  $("newRequestBtn").onclick = () => {
    $("successBox").classList.add("hidden");
    $("bookingCard").classList.remove("hidden");
    $("bookingForm").classList.add("hidden");
    state.selectedLeader = null;
    state.selectedDateKey = null;
    state.selectedSlot = null;
    document.querySelectorAll(".leader-card").forEach(el=>el.classList.remove("active"));
    showMemberView("booking");
  };

  $("viewMyAppointmentsBtn").onclick = () => showMemberView("appointments");

  db.auth.onAuthStateChange((event,session)=>{
    if (event==="SIGNED_OUT") {
      state.session = null;
      state.member = null;
      if (state.booted) {
        setAuthTab("login");
        setMemberAppMode("guest");
      }
    }
  });

  async function boot({force=false}={}) {
    if (bootPromise && !force) return bootPromise;

    bootPromise = (async ()=>{
      showBootLoading();

      try {
        const detectedIso = detectCountryIso();
        populateCountrySelect("memberLoginCountry",detectedIso);
        populateCountrySelect("memberRegisterCountry",detectedIso);
        populateCatalogCountrySelect(detectedIso);
        bindCountrySelectors();

        const [sessionResult] = await Promise.all([
          db.auth.getSession(),
          loadSettings()
        ]);

        if (sessionResult.error) {
          throw sessionResult.error;
        }

        const session = sessionResult.data?.session || null;

        if (session) {
          await loadMember(session);
        } else {
          state.session = null;
          state.member = null;
          setMemberAppMode("guest");
        }

        state.booted = true;
      } catch (error) {
        console.error("member app boot failed",error);
        showBootError("No pudimos comprobar tu sesión. Revisa la conexión y vuelve a intentarlo.");
      }
    })();

    try {
      await bootPromise;
    } finally {
      bootPromise = null;
    }
  }

  async function revalidateSession() {
    try {
      const {data:{session},error} = await db.auth.getSession();
      if (error) return;

      if (!session) {
        if (state.session || state.member) {
          state.session = null;
          state.member = null;
          setAuthTab("login");
          setMemberAppMode("guest");
        }
        return;
      }

      if (!state.session || state.session.user.id!==session.user.id || !state.member) {
        await loadMember(session);
      } else {
        state.session = session;
      }
    } catch (error) {
      console.warn("session revalidation failed",error);
    }
  }

  $("memberBootRetry").onclick = () => boot({force:true});

  window.addEventListener("pageshow",event=>{
    if (event.persisted) boot({force:true});
  });

  document.addEventListener("visibilitychange",()=>{
    if (document.visibilityState==="visible" && state.booted) {
      revalidateSession();
    }
  });

  boot();
})();
