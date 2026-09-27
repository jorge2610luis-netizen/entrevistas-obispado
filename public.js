(() => {
  const $ = id => document.getElementById(id);
  const db = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabasePublishableKey,
    {
      auth:{
        storageKey:window.APP_CONFIG.memberAuthStorageKey || "obispado-member-auth-v1",
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:false
      }
    }
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
    iquiqueUnits:[],
    unitSelectionSource:null,
    manualCatalogOpen:false,
    currentView:"home",
    historyReady:false,
    exitArmedAt:0,
    booted:false
  };

  let bootPromise = null;

  if ($("appVersion")) $("appVersion").textContent = window.APP_CONFIG.version || "v4.3.2";


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
      '<option value="'+code+'" data-iso="'+iso+'" '+(iso===detectedIso?'selected':'')+'>'+code+' · '+name+'</option>'
    ).join("");

    const target = [...select.options].find(option=>option.dataset.iso===detectedIso);
    if (target) select.value = target.value;
    else {
      const fallback = [...select.options].find(option=>option.dataset.iso==="BO");
      if (fallback) fallback.selected = true;
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
    if ($("memberAuthTitle")) {
      $("memberAuthTitle").textContent = login ? "Iniciar sesión" : "Crear cuenta";
    }
    if ($("memberAuthSubtitle")) {
      $("memberAuthSubtitle").textContent = login
        ? "Ingresa con tu número de teléfono y contraseña."
        : "Crea tu cuenta con tu número de teléfono para reservar y hacer seguimiento de tus entrevistas.";
    }
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
    $("publicHero")?.classList.add("hidden");
    $("memberAuthCard")?.classList.toggle("hidden",!isGuest);
    $("publicInfoGrid")?.classList.add("hidden");
    $("memberArea")?.classList.toggle("hidden",!isMember);
    $("memberMenuToggle")?.classList.toggle("hidden",!isMember);
    $("publicTopbar")?.classList.toggle("member-menu-enabled",isMember);
    $("publicFooter")?.classList.toggle("hidden",!isMember);

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
      .select("id,phone,full_name,church_unit_id,church_unit_name,meetinghouse_name,location_city,location_country_code,unit_assignment_method,unit_updated_at")
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

    await Promise.all([loadMemberAppointments(),loadLeaders(),loadIquiqueUnits()]);

    setMemberAppMode("member");
    initializeMemberHistory();
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
    if (!state.member?.church_unit_id) {
      state.leaders=[];
      $("leaderGrid").innerHTML =
        '<div class="empty">Primero confirma tu barrio o rama en “Mi barrio y capilla”.</div>';
      $("bookingForm").classList.add("hidden");
      return;
    }

    const {data,error} = await db.rpc("member_available_leaders");

    if (error) {
      $("leaderGrid").innerHTML = '<div class="empty">No se pudieron cargar los líderes de tu barrio.</div>';
      return;
    }

    state.leaders = (data || []).map(row=>({
      id:row.leader_id,
      code:row.code,
      title:row.title,
      sort_order:row.sort_order,
      staff_profile_id:row.staff_profile_id
    }));

    if (!state.leaders.length) {
      $("leaderGrid").innerHTML =
        '<div class="empty coverage-empty"><strong>Aún no tenemos cobertura en este barrio.</strong><br>No hay Obispo o Consejeros habilitados para reservar entrevistas en esta zona. El barrio seguirá apareciendo en el directorio y la reserva se activará cuando se asigne liderazgo.</div>';
      $("bookingForm").classList.add("hidden");
      return;
    }

    $("leaderGrid").innerHTML = "";

    state.leaders.forEach(leader => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "leader-card";
      button.dataset.leaderId = leader.id;
      button.innerHTML =
        '<strong>'+escapeHtml(leader.title)+'</strong>'+\n        '<small>Ver días disponibles</small>';
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
        .eq("church_unit_id",state.member.church_unit_id)
        .eq("assigned_profile_id",leader.staff_profile_id)
        .eq("is_active",true)
        .eq("is_booked",false)
        .gt("start_at",new Date().toISOString())
        .order("start_at")
    ]);

    state.interviewTypes = typesResult.data || [];
    state.slots = slotsResult.data || [];

    const defaultInterviewType = state.interviewTypes[0] || null;
    if (defaultInterviewType) {
      $("autoInterviewType").textContent = defaultInterviewType.name;
      $("autoInterviewType").classList.remove("hidden");
    } else {
      $("autoInterviewType").textContent = "No hay un tipo de entrevista configurado para este líder.";
      $("autoInterviewType").classList.remove("hidden");
    }

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
        '<span>Selecciona tu barrio de Iquique en la lista disponible.</span>';
      box.classList.remove("configured");
    }
  }

  async function loadIquiqueUnits() {
    const select = $("iquiqueUnitSelect");
    if (!select) return;

    select.disabled = true;
    select.innerHTML = '<option value="">Cargando barrios de Iquique…</option>';

    const {data,error}=await db.rpc("search_church_catalog_v2",{
      p_query:null,
      p_country_code:"CL",
      p_region:null,
      p_city:"Iquique",
      p_coverage:null,
      p_limit:20,
      p_offset:0
    });

    if (error) {
      console.warn("Iquique unit load failed",error);
      select.innerHTML='<option value="">No se pudieron cargar los barrios</option>';
      setLocationStatus("No se pudieron cargar los barrios de Iquique. Inténtalo nuevamente.","error");
      select.disabled=false;
      return;
    }

    state.iquiqueUnits=(data||[]).filter(row=>
      String(row.city||"").trim().toLocaleLowerCase("es")==="iquique" &&
      String(row.country_code||"").toUpperCase()==="CL"
    );

    select.innerHTML='<option value="">Selecciona tu barrio</option>'+
      state.iquiqueUnits.map(unit=>
        '<option value="'+escapeHtml(unit.unit_id)+'">'+
          escapeHtml(unit.unit_name+(unit.meetinghouse_name?' · '+unit.meetinghouse_name:''))+
        '</option>'
      ).join("");

    if (state.member?.church_unit_id && state.iquiqueUnits.some(x=>x.unit_id===state.member.church_unit_id)) {
      select.value=state.member.church_unit_id;
    }

    select.disabled=false;
  }

  async function saveIquiqueUnit() {
    if (!state.member) return;

    const select=$("iquiqueUnitSelect");
    const unit=state.iquiqueUnits.find(x=>x.unit_id===select?.value);

    if (!unit) {
      setLocationStatus("Selecciona uno de los barrios de Iquique antes de guardar.","error");
      return;
    }

    const button=$("saveIquiqueUnit");
    button.disabled=true;
    button.textContent="Guardando…";
    clearLocationStatus();

    const {error}=await db.rpc("member_set_church_unit",{
      p_unit_name:unit.unit_name,
      p_meetinghouse_name:unit.meetinghouse_name || null,
      p_city:"Iquique",
      p_country_code:"CL",
      p_assignment_method:"manual",
      p_church_unit_id:unit.unit_id
    });

    button.disabled=false;
    button.textContent="Guardar barrio";

    if (error) {
      setLocationStatus(error.message || "No se pudo guardar tu barrio.","error");
      return;
    }

    state.member.church_unit_id=unit.unit_id;
    state.member.church_unit_name=unit.unit_name;
    state.member.meetinghouse_name=unit.meetinghouse_name || null;
    state.member.location_city="Iquique";
    state.member.location_country_code="CL";
    state.member.unit_assignment_method="manual";

    renderMemberUnit();
    renderMemberHome();
    await loadLeaders();
    setLocationStatus("Barrio guardado. Ya puedes solicitar una entrevista con los líderes disponibles.","success");
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

  const MEMBER_VIEWS = {
    home:"memberViewHome",
    unit:"memberViewUnit",
    appointments:"memberViewAppointments",
    booking:"memberViewBooking"
  };

  let backExitHintTimer = null;

  function hideBackExitHint() {
    $("backExitHint")?.classList.add("hidden");
    if (backExitHintTimer) {
      clearTimeout(backExitHintTimer);
      backExitHintTimer = null;
    }
  }

  function showBackExitHint() {
    state.exitArmedAt = Date.now();
    $("backExitHint")?.classList.remove("hidden");

    if (backExitHintTimer) clearTimeout(backExitHintTimer);
    backExitHintTimer = setTimeout(()=>{
      state.exitArmedAt = 0;
      $("backExitHint")?.classList.add("hidden");
      backExitHintTimer = null;
    },2000);
  }

  function renderMemberView(view,{smooth=true}={}) {
    const target = MEMBER_VIEWS[view] ? view : "home";
    const targetId = MEMBER_VIEWS[target];

    Object.values(MEMBER_VIEWS).forEach(id=>{
      $(id)?.classList.toggle("hidden",id!==targetId);
    });

    document.querySelectorAll("[data-member-view]").forEach(button=>{
      button.classList.toggle("active",button.dataset.memberView===target);
    });

    state.currentView = target;

    if (target==="home") renderMemberHome();
    if (target==="appointments") loadMemberAppointments();

    closeMemberMenu();
    window.scrollTo({top:0,behavior:smooth?"smooth":"auto"});
  }

  function initializeMemberHistory() {
    state.historyReady = true;
    state.exitArmedAt = 0;
    hideBackExitHint();

    const current = history.state;
    if (
      current?.memberApp===true &&
      current.entry==="view" &&
      MEMBER_VIEWS[current.view]
    ) {
      renderMemberView(current.view,{smooth:false});
      return;
    }

    history.replaceState(
      {memberApp:true,entry:"exit-guard"},
      "",
      window.location.href
    );
    history.pushState(
      {memberApp:true,entry:"view",view:"home"},
      "",
      window.location.href
    );
    renderMemberView("home",{smooth:false});
  }

  function resetMemberHistory() {
    state.historyReady = false;
    state.currentView = "home";
    state.exitArmedAt = 0;
    hideBackExitHint();

    if (history.state?.memberApp) {
      history.replaceState({memberApp:false},"",window.location.href);
    }
  }

  function showMemberView(view) {
    const target = MEMBER_VIEWS[view] ? view : "home";

    if (!state.historyReady) {
      renderMemberView(target);
      return;
    }

    if (target==="home" && state.currentView!=="home") {
      history.back();
      return;
    }

    if (target!=="home") {
      const nextState = {memberApp:true,entry:"view",view:target};

      if (state.currentView==="home") {
        history.pushState(nextState,"",window.location.href);
      } else {
        history.replaceState(nextState,"",window.location.href);
      }
    }

    state.exitArmedAt = 0;
    hideBackExitHint();
    renderMemberView(target);
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
        showAuthMessage(/email rate limit exceeded/i.test(msg)
          ? "Supabase está intentando enviar un correo de confirmación. Desactiva Confirm email en Authentication → Providers → Email, guarda y vuelve a intentarlo."
          : "No se pudo crear la cuenta. Revisa los datos e inténtalo nuevamente.");
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

    const interviewTypeId = state.interviewTypes[0]?.id || null;
    const availabilityId = state.selectedSlot?.id;

    if (!state.selectedLeader || !interviewTypeId || !availabilityId) {
      showBookingError("Selecciona líder, día y hora.");
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

  if ($("saveIquiqueUnit")) $("saveIquiqueUnit").onclick = saveIquiqueUnit;

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
    await db.auth.signOut({scope:"local"});
    state.session = null;
    state.member = null;
    resetMemberHistory();
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
    state.interviewTypes = [];
    $("autoInterviewType")?.classList.add("hidden");
    document.querySelectorAll(".leader-card").forEach(el=>el.classList.remove("active"));
    showMemberView("booking");
  };

  $("viewMyAppointmentsBtn").onclick = () => showMemberView("appointments");

  db.auth.onAuthStateChange((event,session)=>{
    if (event==="SIGNED_OUT") {
      state.session = null;
      state.member = null;
      resetMemberHistory();
      if (state.booted) {
        setAuthTab("login");
        setMemberAppMode("guest");
      }
    } else if (event==="SIGNED_IN" && session && state.booted && !state.member) {
      loadMember(session);
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

  window.addEventListener("popstate",event=>{
    if (!state.member || !state.historyReady) return;

    const nav = event.state;

    if (
      nav?.memberApp===true &&
      nav.entry==="view" &&
      MEMBER_VIEWS[nav.view]
    ) {
      state.exitArmedAt = 0;
      hideBackExitHint();
      renderMemberView(nav.view,{smooth:false});
      return;
    }

    if (nav?.memberApp===true && nav.entry==="exit-guard") {
      const secondBack = state.exitArmedAt && (Date.now()-state.exitArmedAt)<=2000;

      if (secondBack) {
        state.historyReady = false;
        hideBackExitHint();
        history.back();
        return;
      }

      showBackExitHint();
      history.pushState(
        {memberApp:true,entry:"view",view:"home"},
        "",
        window.location.href
      );
      renderMemberView("home",{smooth:false});
    }
  });

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
