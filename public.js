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
    nearbyMeetinghouses:[]
  };

  if ($("appVersion")) $("appVersion").textContent = window.APP_CONFIG.version || "v2.5.2";


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

  async function loadMember(session) {
    state.session = session;
    const {data,error} = await db.from("member_profiles")
      .select("id,phone,full_name,church_unit_name,meetinghouse_name,location_city,location_country_code,unit_assignment_method,unit_updated_at")
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
    renderMemberUnit();

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

      navigator.geolocation.getCurrentPosition(
        position=>resolve({
          lat:position.coords.latitude,
          lon:position.coords.longitude,
          accuracy:position.coords.accuracy
        }),
        error=>{
          const messages = {
            1:"Permiso de ubicación denegado. Puedes habilitarlo en el navegador o ingresar tu barrio manualmente.",
            2:"No fue posible determinar tu ubicación.",
            3:"La ubicación tardó demasiado en responder. Inténtalo nuevamente."
          };
          reject(new Error(messages[error.code] || "No se pudo obtener tu ubicación."));
        },
        {enableHighAccuracy:true,timeout:15000,maximumAge:30000}
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

  async function configuredUnitsNear(lat,lon) {
    const {data,error} = await db.from("church_units")
      .select("id,unit_name,unit_type,stake_or_district,meetinghouse_name,address,city,country_code,latitude,longitude,boundary_geojson,booking_url")
      .eq("is_active",true);

    if (error) return [];

    return (data||[]).map(unit=>{
      const exact = pointInGeoJson(lon,lat,unit.boundary_geojson);
      const hasCoords = Number.isFinite(unit.latitude) && Number.isFinite(unit.longitude);
      return {
        source:"configured",
        exact,
        unitName:unit.unit_name,
        name:unit.meetinghouse_name || unit.unit_name,
        address:unit.address || "",
        city:unit.city || "",
        countryCode:unit.country_code || "",
        lat:hasCoords ? unit.latitude : null,
        lon:hasCoords ? unit.longitude : null,
        distanceKm:hasCoords ? distanceKm(lat,lon,unit.latitude,unit.longitude) : null,
        bookingUrl:unit.booking_url || null
      };
    }).filter(item=>item.exact || item.distanceKm!==null);
  }

  async function osmMeetinghousesNear(lat,lon,radius=30000) {
    const query =
      '[out:json][timeout:20];('+
      'nwr(around:'+radius+','+lat+','+lon+')['+
        '"amenity"="place_of_worship"]["name"~"Jesucristo|Jesus Christ|Latter-day|Últimos Días|Santos de los",i];'+
      'nwr(around:'+radius+','+lat+','+lon+')["denomination"~"mormon|latter.?day",i];'+
      ');out center tags;';

    const endpoint = "https://overpass-api.de/api/interpreter?data="+encodeURIComponent(query);
    const response = await fetch(endpoint,{headers:{"Accept":"application/json"}});
    if (!response.ok) throw new Error("No fue posible consultar centros de reuniones cercanos.");

    const data = await response.json();
    const seen = new Set();

    return (data.elements||[]).map(item=>{
      const plat = item.lat ?? item.center?.lat;
      const plon = item.lon ?? item.center?.lon;
      if (!Number.isFinite(plat) || !Number.isFinite(plon)) return null;

      const tags = item.tags || {};
      const key = Math.round(plat*100000)+":"+Math.round(plon*100000);
      if (seen.has(key)) return null;
      seen.add(key);

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
        name:tags.name || "Centro de reuniones",
        address,
        city:tags["addr:city"] || tags["addr:town"] || "",
        countryCode:String(tags["addr:country"]||"").toUpperCase(),
        lat:plat,
        lon:plon,
        distanceKm:distanceKm(lat,lon,plat,plon),
        bookingUrl:null
      };
    }).filter(Boolean).sort((a,b)=>a.distanceKm-b.distanceKm);
  }

  async function findNearbyMeetinghouses() {
    clearLocationStatus();
    $("nearbyMeetinghouses").innerHTML = "";
    $("unitConfirmPanel").classList.add("hidden");

    const button = $("useMemberLocation");
    button.disabled = true;
    button.textContent = "Buscando ubicación…";

    try {
      const position = await getPreciseLocation();
      setLocationStatus(
        "Ubicación obtenida con una precisión aproximada de "+Math.round(position.accuracy)+" m. Buscando centros de reuniones…",
        "info"
      );

      const [context,configured] = await Promise.all([
        reverseLocation(position.lat,position.lon),
        configuredUnitsNear(position.lat,position.lon)
      ]);

      state.locationContext = context;

      let osm = [];
      try {
        osm = await osmMeetinghousesNear(position.lat,position.lon,30000);
        if (!osm.length) osm = await osmMeetinghousesNear(position.lat,position.lon,80000);
      } catch (_) {}

      const exactConfigured = configured.filter(x=>x.exact);
      const nearbyConfigured = configured
        .filter(x=>!x.exact && x.distanceKm!==null)
        .sort((a,b)=>a.distanceKm-b.distanceKm)
        .slice(0,5);

      const results = [...exactConfigured,...nearbyConfigured,...osm];

      const deduped = [];
      const seen = new Set();
      for (const item of results) {
        const key = (item.name+"|"+(item.lat??"")+"|"+(item.lon??"")).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }

      state.nearbyMeetinghouses = deduped.slice(0,10);
      renderNearbyMeetinghouses();

      if (exactConfigured.length) {
        setLocationStatus(
          "Encontramos una unidad configurada cuyo límite incluye tu ubicación. Confirma que sea correcta.",
          "success"
        );
      } else if (state.nearbyMeetinghouses.length) {
        setLocationStatus(
          "Encontramos centros de reuniones cercanos. Selecciona tu capilla y confirma el nombre de tu barrio o rama.",
          "success"
        );
      } else {
        setLocationStatus(
          "No encontramos una capilla automáticamente. Puedes usar el localizador oficial o ingresar tu barrio manualmente.",
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

  function renderNearbyMeetinghouses() {
    const list = $("nearbyMeetinghouses");
    const rows = state.nearbyMeetinghouses || [];

    if (!rows.length) {
      list.innerHTML = "";
      return;
    }

    list.innerHTML =
      '<div class="subheading-row"><h3>Capillas cercanas</h3><span class="muted-text">Confirma antes de guardar</span></div>'+
      rows.map((item,index)=>
        '<article class="meetinghouse-item '+(item.exact?"exact-unit":"")+'">'+
          '<div>'+
            (item.exact?'<span class="match-badge">Coincide con límite configurado</span>':'')+
            '<strong>'+escapeHtml(item.name)+'</strong>'+
            (item.unitName?'<span>Barrio/Rama: '+escapeHtml(item.unitName)+'</span>':'')+
            (item.address?'<span>'+escapeHtml(item.address)+'</span>':'')+
            (item.distanceKm!==null?'<small>A '+escapeHtml(item.distanceKm.toFixed(1))+' km aprox.</small>':'')+
          '</div>'+
          '<button class="secondary-button" type="button" data-meetinghouse="'+index+'">Seleccionar</button>'+
        '</article>'
      ).join("");

    list.querySelectorAll("[data-meetinghouse]").forEach(button=>{
      button.onclick = () => chooseMeetinghouse(rows[Number(button.dataset.meetinghouse)]);
    });
  }

  function chooseMeetinghouse(item) {
    state.selectedMeetinghouse = item || null;

    $("selectedMeetinghouseName").textContent = item?.name || "Ingreso manual";
    $("selectedMeetinghouseMeta").textContent = item
      ? [item.address,item.distanceKm!==null?item.distanceKm.toFixed(1)+" km aprox.":""].filter(Boolean).join(" · ")
      : "Escribe el nombre correcto de tu barrio o rama.";

    $("memberUnitName").value = item?.unitName || state.member?.church_unit_name || "";

    const maps = $("selectedGoogleMapsLink");
    if (item && Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
      maps.href = "https://www.google.com/maps/search/?api=1&query="+
        encodeURIComponent(item.lat+","+item.lon);
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

    const unitName = $("memberUnitName").value.trim();
    if (unitName.length<2) {
      setLocationStatus("Escribe el nombre de tu barrio o rama antes de guardar.","error");
      return;
    }

    const item = state.selectedMeetinghouse;
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
    $("unitConfirmPanel").classList.add("hidden");
    setLocationStatus("Barrio y capilla guardados correctamente.","success");

    if (item?.bookingUrl) {
      const current = location.href.split("#")[0].split("?")[0];
      try {
        const target = new URL(item.bookingUrl,location.href).href.split("#")[0].split("?")[0];
        if (target!==current) {
          const go = document.createElement("a");
          go.className = "primary-button unit-route-button";
          go.href = item.bookingUrl;
          go.textContent = "Ir al sistema de "+unitName;
          $("currentMemberUnit").appendChild(go);
        }
      } catch (_) {}
    }
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
        showAuthMessage("No se pudo crear la cuenta. Revisa los datos e inténtalo nuevamente.");
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
    state.selectedMeetinghouse = null;
    chooseMeetinghouse(null);
  };
  $("cancelMeetinghouseSelection").onclick = () => {
    $("unitConfirmPanel").classList.add("hidden");
    state.selectedMeetinghouse = null;
  };
  $("saveMemberUnit").onclick = saveMemberUnit;

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
    bindCountrySelectors();
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
