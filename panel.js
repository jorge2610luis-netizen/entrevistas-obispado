(() => {
  const $ = id => document.getElementById(id);
  const db = window.supabase.createClient(window.APP_CONFIG.supabaseUrl,window.APP_CONFIG.supabasePublishableKey);
  const signupClient = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabasePublishableKey,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
  );

  const state = {
    user:null,
    profile:null,
    leaders:[],
    appointments:[],
    schedule:[],
    profiles:[],
    memberProfiles:[],
    userDirectoryMode:"leaders",
    selectedDates:new Set()
  };

  if ($("panelVersion")) $("panelVersion").textContent = window.APP_CONFIG.version||"v2.8.0";

  const leaderRole = {
    bishop:"bishop",
    first_counselor:"first_counselor",
    second_counselor:"second_counselor"
  };

  const titleByRole = {
    secretary_admin:"Panel del Secretario Administrador",
    secretary:"Panel del Secretario",
    bishop:"Panel del Obispo",
    first_counselor:"Panel del Primer Consejero",
    second_counselor:"Panel del Segundo Consejero"
  };

  const roleText = {
    secretary_admin:"Secretario Administrador",
    secretary:"Secretario",
    bishop:"Obispo",
    first_counselor:"Primer Consejero",
    second_counselor:"Segundo Consejero",
    unassigned:"Sin rol"
  };

  const statusText = {
    pending_secretary:"Pendiente de secretario",
    contacted:"Contactado",
    pending_leader:"Pendiente de líder",
    approved:"Aprobado",
    rejected:"Rechazado",
    reschedule:"Reprogramación",
    completed:"Completado",
    cancelled:"Cancelado"
  };

  const e = value => String(value ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  const fmt = value => new Intl.DateTimeFormat("es-BO",{
    timeZone:"America/La_Paz",
    dateStyle:"medium",
    timeStyle:"short"
  }).format(new Date(value));

  const isSecretaryStaff = () => ["secretary_admin","secretary"].includes(state.profile?.role);
  const isSecretaryAdmin = () => state.profile?.role==="secretary_admin";

  function alertGlobal(message,type="info") {
    const el = $("globalAlert");
    el.textContent = message;
    el.className = "alert "+type;
  }

  function clearGlobalAlert() {
    $("globalAlert").className = "alert hidden";
    $("globalAlert").textContent = "";
  }

  function dateKeyBolivia(value) {
    return new Intl.DateTimeFormat("en-CA",{
      timeZone:"America/La_Paz",
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).format(new Date(value));
  }

  function dateKeyUTC(date) {
    return date.toISOString().slice(0,10);
  }

  function shortDateUTC(date) {
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"UTC",
      day:"numeric",
      month:"short"
    }).format(date).replace(".","");
  }

  function weekdayShortUTC(date) {
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"UTC",
      weekday:"short"
    }).format(date).replace(".","").replace(/^./,c=>c.toUpperCase());
  }

  function longDateKey(key) {
    const [y,m,d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-BO",{
      weekday:"long",day:"numeric",month:"long",year:"numeric"
    }).format(new Date(Date.UTC(y,m-1,d))).replace(/^./,c=>c.toUpperCase());
  }

  function timeLabel(value) {
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"America/La_Paz",
      hour:"2-digit",
      minute:"2-digit"
    }).format(new Date(value));
  }

  function leaderForRole() {
    return state.leaders.find(x=>x.code===leaderRole[state.profile?.role]);
  }

  function selectedLeaderId() {
    return isSecretaryStaff() ? $("scheduleLeader").value : leaderForRole()?.id;
  }

  function canManage(appointment) {
    if (isSecretaryStaff()) return true;
    return appointment.interview_types?.leaders?.code===leaderRole[state.profile?.role];
  }

  function hideAuthLoading() {
    $("authLoadingView")?.classList.add("hidden");
  }

  function showLogin() {
    hideAuthLoading();
    $("loginView").classList.remove("hidden");
    $("unauthorizedView").classList.add("hidden");
    $("dashboard").classList.add("hidden");
  }

  function showUnauthorized() {
    hideAuthLoading();
    $("loginView").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("unauthorizedView").classList.remove("hidden");
  }

  async function enterAuthenticated(session) {
    state.user = session.user;

    const {data:profile,error} = await db.from("profiles")
      .select("role,display_name,is_active")
      .eq("id",session.user.id)
      .maybeSingle();

    if (error || !profile?.role || profile.is_active===false) {
      showUnauthorized();
      return;
    }

    state.profile = profile;
    hideAuthLoading();
    $("loginView").classList.add("hidden");
    $("unauthorizedView").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("userAdminCard").classList.toggle("hidden",!isSecretaryAdmin());

    $("roleTitle").textContent = titleByRole[profile.role] || "Panel";
    $("roleSubtitle").textContent = isSecretaryAdmin()
      ? "Administración general: usuarios, solicitudes y horarios de todos los líderes."
      : profile.role==="secretary"
        ? "Revisa solicitudes y administra los horarios de todos los líderes."
        : "Revisa tus solicitudes y administra tus propios horarios.";

    const {data:settings} = await db.from("settings").select("unit_name").eq("id",1).maybeSingle();
    if (settings?.unit_name) $("panelUnit").textContent = settings.unit_name;

    setInitialMonth();
    await refresh();
  }

  async function boot() {
    try {
      const {data:{session},error} = await db.auth.getSession();
      if (error || !session) {
        showLogin();
        return;
      }
      await enterAuthenticated(session);
    } catch (error) {
      console.error(error);
      showLogin();
    }
  }

  async function refresh() {
    clearGlobalAlert();

    const requests = [
      db.from("leaders").select("id,code,title,sort_order").eq("is_active",true).order("sort_order"),
      db.from("appointments")
        .select("id,status,member_user_id,member_name,member_phone,member_email,created_at,availability(id,start_at,end_at,leader_id),interview_types(id,name,leaders(id,code,title))")
        .order("created_at",{ascending:false}),
      db.from("availability")
        .select("id,leader_id,start_at,end_at,is_active,is_booked,leaders(id,code,title)")
        .gte("start_at",new Date(Date.now()-86400000).toISOString())
        .order("start_at")
    ];

    if (isSecretaryAdmin()) {
      requests.push(
        db.from("profiles")
          .select("id,email,display_name,role,is_active,created_at")
          .order("created_at",{ascending:true})
      );
    }

    const [leadersResult,appointmentsResult,scheduleResult,profilesResult] = await Promise.all(requests);

    if (
      leadersResult.error ||
      appointmentsResult.error ||
      scheduleResult.error ||
      (profilesResult && profilesResult.error)
    ) {
      alertGlobal("No se pudieron cargar todos los datos del panel.","error");
      return;
    }

    state.leaders = leadersResult.data || [];
    state.appointments = appointmentsResult.data || [];
    state.schedule = scheduleResult.data || [];
    state.profiles = profilesResult?.data || [];

    if (isSecretaryStaff()) {
      const {data:memberProfiles} = await db.from("member_profiles")
        .select("id,full_name,phone,church_unit_name,meetinghouse_name,location_city,location_country_code,unit_assignment_method,created_at")
        .order("created_at",{ascending:false});
      state.memberProfiles = memberProfiles || [];
    } else {
      state.memberProfiles = [];
    }

    if (isSecretaryStaff()) {
      $("leaderSelectorWrap").classList.remove("hidden");
      const current = $("scheduleLeader").value;
      $("scheduleLeader").innerHTML = state.leaders
        .map(x=>'<option value="'+x.id+'">'+e(x.title)+'</option>')
        .join("");
      if (current && state.leaders.some(x=>x.id===current)) $("scheduleLeader").value = current;
    } else {
      $("leaderSelectorWrap").classList.add("hidden");
    }

    renderStats();
    renderAppointments();
    renderWeekStrip();
    renderSchedule();
    if (isSecretaryAdmin()) {
      $("leaderUsersBadge").textContent = state.profiles.filter(x=>x.role!=="unassigned").length;
      $("memberUsersBadge").textContent = state.memberProfiles.length;
      setUserDirectoryMode(state.userDirectoryMode);
    }
  }

  function renderStats() {
    const rows = state.appointments.filter(canManage);
    const open = rows.filter(x=>!["completed","cancelled","rejected"].includes(x.status)).length;
    const approved = rows.filter(x=>x.status==="approved").length;
    const relevantSchedules = state.schedule.filter(x=>
      isSecretaryStaff() || x.leaders?.code===leaderRole[state.profile.role]
    );

    $("stats").innerHTML =
      '<div class="stat"><span>Total</span><strong>'+rows.length+'</strong></div>'+
      '<div class="stat"><span>En curso</span><strong>'+open+'</strong></div>'+
      '<div class="stat"><span>Aprobadas</span><strong>'+approved+'</strong></div>'+
      '<div class="stat"><span>Horarios</span><strong>'+relevantSchedules.length+'</strong></div>';
  }

  function actions(appointment) {
    if (!canManage(appointment)) return "";
    const button = (label,status,cls="") =>
      '<button data-id="'+appointment.id+'" data-status="'+status+'" class="'+cls+'">'+label+'</button>';

    if (isSecretaryStaff()) {
      if (appointment.status==="pending_secretary") {
        return button("Contactado","contacted","primary")+
          button("Rechazar","rejected","danger")+
          button("Cancelar","cancelled","danger");
      }
      if (appointment.status==="contacted") {
        return button("Enviar al líder","pending_leader","primary")+
          button("Reprogramar","reschedule")+
          button("Rechazar","rejected","danger");
      }
      if (appointment.status==="pending_leader") {
        return button("Reprogramar","reschedule")+
          button("Cancelar","cancelled","danger");
      }
      if (appointment.status==="approved") {
        return button("Completar","completed","primary")+
          button("Reprogramar","reschedule")+
          button("Cancelar","cancelled","danger");
      }
      if (appointment.status==="reschedule") {
        return button("Volver a revisión","pending_secretary","primary")+
          button("Cancelar","cancelled","danger");
      }
      return "";
    }

    if (appointment.status==="pending_leader") {
      return button("Aprobar","approved","primary")+
        button("Reprogramar","reschedule")+
        button("Rechazar","rejected","danger");
    }

    if (appointment.status==="approved") {
      return button("Completar","completed","primary")+
        button("Reprogramar","reschedule")+
        button("Cancelar","cancelled","danger");
    }

    return "";
  }

  function renderAppointments() {
    const filter = $("statusFilter").value;
    const rows = state.appointments.filter(a=>
      canManage(a) && (filter==="all" || a.status===filter)
    );

    $("requestsHint").textContent = rows.length+" solicitud(es) visibles";
    const list = $("requestsList");

    list.innerHTML = rows.length ? rows.map(a=>
      '<article class="request-item">'+
        '<div class="request-top">'+
          '<div>'+
            '<h3>'+e(a.member_name)+'</h3>'+
            '<div class="request-meta">'+
              e(a.interview_types?.name||"Entrevista")+' · '+e(a.interview_types?.leaders?.title||"")+'<br>'+
              (a.availability?.start_at?e(fmt(a.availability.start_at)):"Sin horario")+'<br>'+
              e(a.member_phone)+(a.member_email?' · '+e(a.member_email):'')+
              (() => {
                if (!isSecretaryStaff()) return "";
                const mp = state.memberProfiles.find(x=>x.id===a.member_user_id);
                if (!mp?.church_unit_name) return "";
                return '<br><strong>Barrio/Rama:</strong> '+e(mp.church_unit_name)+
                  (mp.meetinghouse_name?' · '+e(mp.meetinghouse_name):'');
              })()+
            '</div>'+
          '</div>'+
          '<span class="badge '+e(a.status)+'">'+e(statusText[a.status]||a.status)+'</span>'+
        '</div>'+
        '<div class="actions">'+actions(a)+'</div>'+
      '</article>'
    ).join("") : '<div class="empty">No hay solicitudes para este filtro.</div>';

    list.querySelectorAll("button[data-id]").forEach(button=>{
      button.onclick = async () => {
        button.disabled = true;
        const {error} = await db.from("appointments")
          .update({status:button.dataset.status})
          .eq("id",button.dataset.id);
        button.disabled = false;

        if (error) alertGlobal(error.message || "No se pudo actualizar la solicitud.","error");
        else {
          alertGlobal("Solicitud actualizada.","success");
          await refresh();
        }
      };
    });
  }

  function setUserDirectoryMode(mode) {
    if (!isSecretaryAdmin()) return;
    state.userDirectoryMode = mode==="members" ? "members" : "leaders";

    $("leaderUsersView").classList.toggle("hidden",state.userDirectoryMode!=="leaders");
    $("memberUsersView").classList.toggle("hidden",state.userDirectoryMode!=="members");

    document.querySelectorAll("[data-directory-mode]").forEach(button=>{
      button.classList.toggle("active",button.dataset.directoryMode===state.userDirectoryMode);
    });

    if (state.userDirectoryMode==="leaders") renderUsers();
    else renderMemberUsers();
  }

  function renderUsers() {
    const roleFilter = $("leaderRoleFilter")?.value || "all";
    const allRows = state.profiles.filter(x=>x.role!=="unassigned");
    const rows = allRows.filter(x=>roleFilter==="all" || x.role===roleFilter);

    $("leaderUsersBadge").textContent = allRows.length;
    $("memberUsersBadge").textContent = state.memberProfiles.length;
    $("usersCount").textContent = rows.length+" de "+allRows.length+" líder(es) / secretario(s)";

    $("usersList").innerHTML = rows.length ? rows.map(x=>
      '<div class="user-row">'+
        '<div><strong>'+e(x.display_name||x.email||"Usuario")+'</strong><small>'+e(x.email||"Sin correo")+'</small></div>'+
        '<div class="user-row-right">'+
          '<span class="role-pill">'+e(roleText[x.role]||x.role)+'</span>'+
          '<span class="'+(x.is_active?"status-active":"status-inactive")+'">'+(x.is_active?"Activo":"Inactivo")+'</span>'+
          '<button class="edit-user-button" type="button" data-edit-user="'+e(x.id)+'">Editar</button>'+
        '</div>'+
      '</div>'
    ).join("") : '<div class="empty">No hay líderes con este filtro.</div>';

    $("usersList").querySelectorAll("[data-edit-user]").forEach(button=>{
      button.onclick = () => openUserEditor(button.dataset.editUser);
    });
  }

  function renderMemberUsers() {
    const query = ($("memberUserFilter")?.value || "").trim().toLowerCase();
    const allRows = state.memberProfiles || [];

    const rows = allRows.filter(member=>{
      if (!query) return true;
      const haystack = [
        member.full_name,
        member.phone,
        member.church_unit_name,
        member.meetinghouse_name,
        member.location_city,
        member.location_country_code
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });

    $("leaderUsersBadge").textContent = state.profiles.filter(x=>x.role!=="unassigned").length;
    $("memberUsersBadge").textContent = allRows.length;
    $("memberUsersCount").textContent = rows.length+" de "+allRows.length+" miembro(s)";

    $("memberUsersList").innerHTML = rows.length ? rows.map(member=>{
      const unit = member.church_unit_name || "Barrio/Rama sin configurar";
      const chapel = member.meetinghouse_name ? " · "+member.meetinghouse_name : "";
      const place = [member.location_city,member.location_country_code].filter(Boolean).join(" · ");

      return '<div class="user-row member-user-row">'+
        '<div class="member-user-main">'+
          '<strong>'+e(member.full_name||"Miembro")+'</strong>'+
          '<small>'+e(member.phone||"Sin teléfono")+'</small>'+
          '<span class="member-unit-line"><strong>'+e(unit)+'</strong>'+e(chapel)+'</span>'+
          (place?'<span class="member-location-line">'+e(place)+'</span>':'')+
        '</div>'+
        '<div class="user-row-right">'+
          '<span class="role-pill member-role-pill">Miembro</span>'+
        '</div>'+
      '</div>';
    }).join("") : '<div class="empty">No hay miembros que coincidan con la búsqueda.</div>';
  }

  function openUserEditor(userId) {
    if (!isSecretaryAdmin()) return;
    const user = state.profiles.find(x=>x.id===userId);
    if (!user) return;

    $("editUserId").value = user.id;
    $("editUserName").value = user.display_name || "";
    $("editUserEmail").value = user.email || "";
    $("editUserRole").value = user.role;
    $("editUserActive").checked = Boolean(user.is_active);
    $("editUserTitle").textContent = user.display_name || user.email || "Usuario";
    $("editUserResult").className = "alert hidden";
    $("userEditPanel").classList.remove("hidden");
    $("userEditPanel").scrollIntoView({behavior:"smooth",block:"center"});
  }

  function closeUserEditor() {
    $("userEditPanel").classList.add("hidden");
    $("editUserForm").reset();
    $("editUserResult").className = "alert hidden";
  }

  function setInitialMonth() {
    const now = new Date();
    $("scheduleMonth").value = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
    populateWeeks();
  }

  function populateWeeks() {
    const value = $("scheduleMonth").value;
    if (!value) return;

    const [year,month] = value.split("-").map(Number);
    const firstOfMonth = new Date(Date.UTC(year,month-1,1));
    const lastOfMonth = new Date(Date.UTC(year,month,0));
    const daysBack = (firstOfMonth.getUTCDay()+6)%7;
    const firstMonday = new Date(firstOfMonth);
    firstMonday.setUTCDate(firstMonday.getUTCDate()-daysBack);

    const weeks = [];
    let cursor = new Date(firstMonday);
    let number = 1;

    while (cursor<=lastOfMonth) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setUTCDate(end.getUTCDate()+6);
      weeks.push({
        key:dateKeyUTC(start),
        label:"Semana "+number+" · Lun "+shortDateUTC(start)+" – Dom "+shortDateUTC(end)
      });
      cursor.setUTCDate(cursor.getUTCDate()+7);
      number++;
    }

    $("scheduleWeek").innerHTML = weeks.map(w=>
      '<option value="'+w.key+'">'+e(w.label)+'</option>'
    ).join("");

    state.selectedDates.clear();

    const today = new Date();
    if (year===today.getFullYear() && month===today.getMonth()+1) {
      const todayUTC = new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()));
      const monday = new Date(todayUTC);
      monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
      const key = dateKeyUTC(monday);
      if (weeks.some(w=>w.key===key)) $("scheduleWeek").value = key;
    }

    renderWeekStrip();
    renderSchedule();
  }

  function weekDates() {
    const value = $("scheduleWeek").value;
    if (!value) return [];
    const start = new Date(value+"T00:00:00Z");
    return Array.from({length:7},(_,i)=>{
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate()+i);
      return d;
    });
  }

  function renderWeekStrip() {
    const dates = weekDates();
    if (!dates.length) {
      $("weekDayStrip").innerHTML = "";
      return;
    }

    $("weekDayStrip").innerHTML = dates.map(date=>{
      const key = dateKeyUTC(date);
      const selected = state.selectedDates.has(key) ? " selected" : "";
      return '<button type="button" class="week-day-button'+selected+'" data-date="'+key+'">'+
        '<strong>'+e(weekdayShortUTC(date))+'</strong>'+
        '<span>'+e(shortDateUTC(date))+'</span>'+
      '</button>';
    }).join("");

    $("weekDayStrip").querySelectorAll("[data-date]").forEach(button=>{
      button.onclick = () => {
        const key = button.dataset.date;
        if (state.selectedDates.has(key)) state.selectedDates.delete(key);
        else state.selectedDates.add(key);
        renderWeekStrip();
        updateScheduleSummary();
      };
    });

    updateScheduleSummary();
  }

  function updateScheduleSummary() {
    const selected = [...state.selectedDates].sort();
    const from = $("scheduleStartTime").value;
    const to = $("scheduleEndTime").value;
    const duration = $("scheduleDuration").value;

    if (!selected.length) {
      $("scheduleSummary").textContent = "Selecciona uno o varios días de la semana.";
      return;
    }

    const labels = selected.map(longDateKey);
    $("scheduleSummary").textContent = labels.join(" · ")+
      (from&&to ? " · "+from+"–"+to+" · cada "+duration+" min." : "");
  }

  function buildSlots() {
    const leaderId = selectedLeaderId();
    const dates = [...state.selectedDates].sort();
    const startTime = $("scheduleStartTime").value;
    const endTime = $("scheduleEndTime").value;
    const duration = Number($("scheduleDuration").value || 30);

    if (!leaderId || !dates.length || !startTime || !endTime) {
      throw new Error("Selecciona líder, uno o varios días y el rango horario.");
    }

    const [sh,sm] = startTime.split(":").map(Number);
    const [eh,em] = endTime.split(":").map(Number);
    const startMinutes = sh*60+sm;
    const endMinutes = eh*60+em;

    if (endMinutes<=startMinutes) {
      throw new Error("La hora final debe ser posterior a la hora inicial.");
    }

    const slots = [];

    dates.forEach(dateKey=>{
      for (let minutes=startMinutes;minutes+duration<=endMinutes;minutes+=duration) {
        const hh = String(Math.floor(minutes/60)).padStart(2,"0");
        const mm = String(minutes%60).padStart(2,"0");
        const end = minutes+duration;
        const ehh = String(Math.floor(end/60)).padStart(2,"0");
        const emm = String(end%60).padStart(2,"0");

        const start_at = new Date(dateKey+"T"+hh+":"+mm+":00-04:00").toISOString();
        const end_at = new Date(dateKey+"T"+ehh+":"+emm+":00-04:00").toISOString();

        if (new Date(start_at).getTime()<=Date.now()) continue;
        slots.push({leader_id:leaderId,start_at,end_at,is_active:true});
      }
    });

    return slots;
  }

  function scheduleForSelectedWeek() {
    const leaderId = selectedLeaderId();
    const dates = new Set(weekDates().map(dateKeyUTC));
    return state.schedule.filter(slot=>
      slot.leader_id===leaderId && dates.has(dateKeyBolivia(slot.start_at))
    );
  }

  function renderSchedule() {
    const rows = scheduleForSelectedWeek();
    $("scheduleCount").textContent = rows.length+" horario(s)";

    if (!rows.length) {
      $("scheduleList").innerHTML = '<div class="empty">No hay horarios cargados para esta semana.</div>';
      return;
    }

    const groups = new Map();
    rows.forEach(slot=>{
      const key = dateKeyBolivia(slot.start_at);
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(slot);
    });

    $("scheduleList").innerHTML = [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,slots])=>
      '<div class="schedule-day-group">'+
        '<strong class="schedule-day-title">'+e(longDateKey(key))+'</strong>'+
        slots.sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)).map(slot=>
          '<div class="slot-row">'+
            '<div><strong>'+e(timeLabel(slot.start_at))+'–'+e(timeLabel(slot.end_at))+'</strong><br>'+
              '<small>'+(slot.is_booked?"Ocupado / solicitado":slot.is_active?"Disponible":"Desactivado")+'</small>'+
            '</div>'+
            (slot.is_booked ? "" :
              '<button data-slot="'+slot.id+'" data-active="'+(slot.is_active?"0":"1")+'">'+
                (slot.is_active?"Desactivar":"Activar")+
              '</button>')+
          '</div>'
        ).join("")+
      '</div>'
    ).join("");

    $("scheduleList").querySelectorAll("[data-slot]").forEach(button=>{
      button.onclick = async () => {
        const {error} = await db.from("availability")
          .update({is_active:button.dataset.active==="1"})
          .eq("id",button.dataset.slot);

        if (error) alertGlobal(error.message || "No se pudo cambiar el horario.","error");
        else await refresh();
      };
    });
  }

  $("loginForm").onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    $("loginError").classList.add("hidden");
    button.disabled = true;
    button.textContent = "Ingresando…";

    const {data,error} = await db.auth.signInWithPassword({
      email:$("loginEmail").value.trim(),
      password:$("loginPassword").value
    });

    button.disabled = false;
    button.textContent = "Ingresar";

    if (error) {
      $("loginError").textContent = "Correo o contraseña incorrectos.";
      $("loginError").classList.remove("hidden");
      return;
    }

    if (data?.session) await enterAuthenticated(data.session);
  };

  $("userForm").onsubmit = async event => {
    event.preventDefault();
    if (!isSecretaryAdmin()) return;

    const form = event.currentTarget;
    const button = $("createUserBtn");
    const result = $("userCreateResult");
    result.className = "alert hidden";
    button.disabled = true;
    button.textContent = "Creando…";

    try {
      const display_name = $("userDisplayName").value.trim();
      const email = $("userEmail").value.trim().toLowerCase();
      const role = $("userRole").value;
      const password = $("userPassword").value;

      const {data,error} = await signupClient.auth.signUp({
        email,
        password,
        options:{data:{full_name:display_name}}
      });

      if (error) throw error;
      if (!data?.user?.id) throw new Error("No se pudo crear el usuario.");

      const {error:roleError} = await db.rpc("secretary_admin_assign_role",{
        p_user_id:data.user.id,
        p_role:role,
        p_display_name:display_name
      });

      if (roleError) throw new Error("El usuario fue creado, pero no se pudo asignar el rol.");

      result.textContent = data.session
        ? "Usuario creado y listo para iniciar sesión."
        : "Usuario creado. Puede requerir confirmación del correo.";
      result.className = "alert success";
      form.reset();
      $("userRole").value = "bishop";
      $("userPassword").type = "password";
      $("toggleUserPassword").textContent = "Mostrar";
      await refresh();
    } catch (error) {
      result.textContent = error?.message || "No se pudo crear el usuario.";
      result.className = "alert error";
    } finally {
      button.disabled = false;
      button.textContent = "Crear usuario";
    }
  };

  $("editUserForm").onsubmit = async event => {
    event.preventDefault();
    if (!isSecretaryAdmin()) return;

    const button = $("saveEditUser");
    const result = $("editUserResult");
    button.disabled = true;
    button.textContent = "Guardando…";
    result.className = "alert hidden";

    const {error} = await db.rpc("secretary_admin_update_profile",{
      p_user_id:$("editUserId").value,
      p_display_name:$("editUserName").value.trim(),
      p_role:$("editUserRole").value,
      p_is_active:$("editUserActive").checked
    });

    button.disabled = false;
    button.textContent = "Guardar cambios";

    if (error) {
      result.textContent = error.message || "No se pudieron guardar los cambios.";
      result.className = "alert error";
      return;
    }

    result.textContent = "Usuario actualizado correctamente.";
    result.className = "alert success";
    await refresh();
    setTimeout(closeUserEditor,700);
  };

  $("scheduleForm").onsubmit = async event => {
    event.preventDefault();

    let slots;
    try {
      slots = buildSlots();
      if (!slots.length) throw new Error("No se generaron horarios futuros con esa selección.");
    } catch (error) {
      alertGlobal(error.message || "Revisa la configuración de horarios.","error");
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Generando…";

    const {data,error} = await db.from("availability")
      .upsert(slots,{onConflict:"leader_id,start_at",ignoreDuplicates:true})
      .select("id");

    button.disabled = false;
    button.textContent = "Generar horarios";

    if (error) {
      alertGlobal(error.message || "No se pudieron generar los horarios.","error");
      return;
    }

    alertGlobal("Horarios generados: "+(data?.length||0)+". Los duplicados existentes se omitieron.","success");
    await refresh();
  };

  async function logout() {
    await db.auth.signOut();
    state.user = null;
    state.profile = null;
    showLogin();
  }

  $("cancelEditUser").onclick = closeUserEditor;
  $("cancelEditUserTop").onclick = closeUserEditor;

  $("toggleUserPassword").onclick = () => {
    const input = $("userPassword");
    const show = input.type==="password";
    input.type = show ? "text" : "password";
    $("toggleUserPassword").textContent = show ? "Ocultar" : "Mostrar";
  };

  $("logoutBtn").onclick = logout;
  $("unauthorizedLogout").onclick = logout;
  $("refreshBtn").onclick = refresh;
  $("showLeaderUsers").onclick = () => setUserDirectoryMode("leaders");
  $("showMemberUsers").onclick = () => setUserDirectoryMode("members");
  $("leaderRoleFilter").onchange = renderUsers;
  $("memberUserFilter").oninput = renderMemberUsers;

  $("statusFilter").onchange = renderAppointments;

  $("scheduleLeader").onchange = () => {
    renderSchedule();
  };

  $("scheduleMonth").onchange = populateWeeks;

  $("scheduleWeek").onchange = () => {
    state.selectedDates.clear();
    renderWeekStrip();
    renderSchedule();
  };

  $("scheduleStartTime").oninput = updateScheduleSummary;
  $("scheduleEndTime").oninput = updateScheduleSummary;
  $("scheduleDuration").onchange = updateScheduleSummary;

  db.auth.onAuthStateChange(event => {
    if (event==="SIGNED_OUT") {
      state.user = null;
      state.profile = null;
      showLogin();
    }
  });

  boot();
})();
