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
    selectedSlot:null
  };

  if ($("appVersion")) $("appVersion").textContent = window.APP_CONFIG.version || "v2.4.2";


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

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const exact = {
      "America/La_Paz":"BO",
      "America/Santiago":"CL",
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
      "America/New_York":"US",
      "America/Chicago":"US",
      "America/Denver":"US",
      "America/Los_Angeles":"US",
      "America/Toronto":"CA",
      "America/Vancouver":"CA",
      "Europe/Madrid":"ES",
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
    if (tz.startsWith("America/Sao_Paulo") || tz.startsWith("America/Fortaleza") || tz.startsWith("America/Manaus")) return "BR";

    return "BO";
  }

  function populateCountrySelect(selectId,detectedIso) {
    const select = $(selectId);
    if (!select) return;

    select.innerHTML = PHONE_COUNTRIES.map(([iso,code,name]) =>
      '<option value="'+code+'" data-iso="'+iso+'" '+(iso===detectedIso?'selected':'')+'>'+name+' ('+code+')</option>'
    ).join("");

    if (!select.value) {
      const fallback = PHONE_COUNTRIES.find(([iso])=>iso==="BO");
      select.value = fallback?.[1] || "+591";
    }
  }

  function selectedCountryCode(selectId) {
    return $(selectId)?.value || "+591";
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

  async function loadMember(session) {
    state.session = session;
    const {data,error} = await db.from("member_profiles")
      .select("id,phone,full_name")
      .eq("id",session.user.id)
      .maybeSingle();

    if (error || !data) {
      $("memberAuthCard").classList.remove("hidden");
      $("memberArea").classList.add("hidden");
      showAuthMessage("Esta sesión no corresponde a una cuenta de miembro. Cierra sesión del panel interno antes de entrar como miembro.","error");
      return;
    }

    state.member = data;
    $("memberAuthCard").classList.add("hidden");
    $("memberArea").classList.remove("hidden");
    $("memberAccountName").textContent = data.full_name;
    $("memberAccountPhone").textContent = "Usuario: "+prettyPhone(data.phone);

    await Promise.all([loadMemberAppointments(),loadLeaders()]);
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
      phone,
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
      phone,
      password,
      options:{
        data:{
          account_type:"member",
          full_name:fullName
        }
      }
    });

    button.disabled = false;
    button.textContent = "Crear mi cuenta";

    if (error) {
      const msg = String(error.message||"");
      if (/phone provider|phone signups|sms/i.test(msg)) {
        showAuthMessage("La cuenta por teléfono todavía debe habilitarse en Supabase. El sistema ya está preparado.");
      } else if (/already|registered|exists/i.test(msg)) {
        showAuthMessage("Ese número ya tiene una cuenta. Usa “Ingresar”.");
      } else {
        showAuthMessage(msg || "No se pudo crear la cuenta.");
      }
      return;
    }

    if (data?.session) {
      await loadMember(data.session);
    } else {
      showAuthMessage("Cuenta creada. Supabase está solicitando verificación del teléfono. Para usar únicamente teléfono + contraseña, hay que desactivar la confirmación por SMS en la configuración de Phone Auth.","info");
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

  $("showMemberLogin").onclick = () => setAuthTab("login");
  $("showMemberRegister").onclick = () => setAuthTab("register");
  $("memberRefreshAppointments").onclick = loadMemberAppointments;

  $("memberLogoutBtn").onclick = async () => {
    await db.auth.signOut();
    state.session = null;
    state.member = null;
    $("memberArea").classList.add("hidden");
    $("memberAuthCard").classList.remove("hidden");
    setAuthTab("login");
  };

  $("newRequestBtn").onclick = () => {
    $("successBox").classList.add("hidden");
    $("bookingCard").classList.remove("hidden");
    $("bookingForm").classList.add("hidden");
    state.selectedLeader = null;
    state.selectedDateKey = null;
    state.selectedSlot = null;
    document.querySelectorAll(".leader-card").forEach(el=>el.classList.remove("active"));
    $("bookingCard").scrollIntoView({behavior:"smooth"});
  };

  db.auth.onAuthStateChange((event,session)=>{
    if (event==="SIGNED_OUT") {
      state.session = null;
      state.member = null;
      $("memberArea").classList.add("hidden");
      $("memberAuthCard").classList.remove("hidden");
    }
  });

  async function boot() {
    const detectedIso = detectCountryIso();
    populateCountrySelect("memberLoginCountry",detectedIso);
    populateCountrySelect("memberRegisterCountry",detectedIso);
    await loadSettings();
    const {data:{session}} = await db.auth.getSession();
    if (session) await loadMember(session);
    else {
      $("memberAuthCard").classList.remove("hidden");
      $("memberArea").classList.add("hidden");
    }
  }

  boot();
})();
