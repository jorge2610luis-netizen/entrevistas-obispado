(() => {
  const $ = id => document.getElementById(id);
  const db = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabasePublishableKey,
    {
      auth:{
        storageKey:window.APP_CONFIG.staffAuthStorageKey || "obispado-staff-auth-v1",
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:false
      }
    }
  );
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
    staffAssignments:[],
    accessibleUnits:[],
    unitTeam:[],
    activeUnitId:null,
    adminUnitResults:[],
    adminSelectedUnit:null,
    adminUnitTeam:[],
    userDirectoryMode:"leaders",
    panelView:"overview",
    selectedDates:new Set()
  };

  if ($("panelVersion")) $("panelVersion").textContent = window.APP_CONFIG.version||"v3.3.2";

  const leaderRole = {
    bishop:"bishop",
    first_counselor:"first_counselor",
    second_counselor:"second_counselor"
  };

  const INTERNAL_ROLES = new Set([
    "secretary_admin",
    "secretary",
    "bishop",
    "first_counselor",
    "second_counselor"
  ]);

  const isInternalRole = role => INTERNAL_ROLES.has(role);

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
    unassigned:"Miembro / Sin cargo"
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

  const isSecretaryStaff = () => isInternalRole(state.profile?.role) && ["secretary_admin","secretary"].includes(state.profile?.role);
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

  const LEADER_ROLES = new Set(["bishop","first_counselor","second_counselor"]);

  const UNIT_COUNTRIES = [
    ["BO","Bolivia"],["CL","Chile"],["AR","Argentina"],["PE","Perú"],["BR","Brasil"],
    ["PY","Paraguay"],["UY","Uruguay"],["CO","Colombia"],["EC","Ecuador"],["VE","Venezuela"],
    ["MX","México"],["PA","Panamá"],["CR","Costa Rica"],["GT","Guatemala"],["SV","El Salvador"],
    ["HN","Honduras"],["NI","Nicaragua"],["DO","Rep. Dominicana"],["PR","Puerto Rico"],["CU","Cuba"],
    ["US","Estados Unidos"],["CA","Canadá"],["ES","España"],["PT","Portugal"],["FR","Francia"],
    ["IT","Italia"],["DE","Alemania"],["GB","Reino Unido"],["IE","Irlanda"],["NL","Países Bajos"],
    ["BE","Bélgica"],["CH","Suiza"],["AT","Austria"],["SE","Suecia"],["NO","Noruega"],
    ["DK","Dinamarca"],["FI","Finlandia"],["PL","Polonia"],["CZ","Chequia"],["RO","Rumania"],
    ["GR","Grecia"],["TR","Turquía"],["RU","Rusia"],["UA","Ucrania"],["IL","Israel"],
    ["AE","Emiratos Árabes"],["SA","Arabia Saudita"],["IN","India"],["PK","Pakistán"],["BD","Bangladés"],
    ["CN","China"],["JP","Japón"],["KR","Corea del Sur"],["PH","Filipinas"],["ID","Indonesia"],
    ["TH","Tailandia"],["VN","Vietnam"],["MY","Malasia"],["SG","Singapur"],["AU","Australia"],
    ["NZ","Nueva Zelanda"],["ZA","Sudáfrica"],["EG","Egipto"],["MA","Marruecos"],["NG","Nigeria"],
    ["KE","Kenia"],["GH","Ghana"]
  ];
  function leaderForRoleCode(role) {
    return state.leaders.find(x=>x.code===role);
  }

  function currentUnitId() {
    return $("activeUnitSelect")?.value || state.activeUnitId || null;
  }

  function currentUnit() {
    const id=currentUnitId();
    return state.accessibleUnits.find(x=>x.unit_id===id) || null;
  }

  function assignmentForProfile(profileId) {
    return state.staffAssignments.find(x=>
      x.profile_id===profileId && x.is_active
    ) || null;
  }

  function memberForProfile(profileId) {
    return state.memberProfiles.find(x=>x.id===profileId) || null;
  }

  function populateEditUserUnit(userId) {
    const assignment=assignmentForProfile(userId);
    const member=memberForProfile(userId);
    const selectedUnitId=assignment?.church_unit_id || member?.church_unit_id || "";

    $("editUserUnit").innerHTML=
      '<option value="">Sin barrio asignado</option>'+
      state.accessibleUnits.map(unit=>
        '<option value="'+unit.unit_id+'">'+e(unit.unit_name)+(unit.city?' · '+e(unit.city):'')+'</option>'
      ).join("");

    if (selectedUnitId && state.accessibleUnits.some(x=>x.unit_id===selectedUnitId)) {
      $("editUserUnit").value=selectedUnitId;
    }
  }

  function syncEditUserUnitVisibility() {
    const role=$("editUserRole").value;
    const isAdmin=role==="secretary_admin";
    $("editUserUnitWrap").classList.toggle("hidden",isAdmin);
  }

  function staffAuthEmail(identity) {
    const raw=String(identity||"").trim();
    if (!raw) throw new Error("Ingresa tu correo o teléfono.");
    if (raw.includes("@")) return raw.toLowerCase();

    const digits=raw.replace(/\D/g,"");
    if (digits.length<8 || digits.length>15) {
      throw new Error("Ingresa el teléfono con código internacional, por ejemplo +56912345678.");
    }

    return "m"+digits+"@members.expressdelivery.pro";
  }

  function selectedScheduleAssignment() {
    const unitId=currentUnitId();
    if (!unitId) return null;

    if (isSecretaryStaff()) {
      const profileId=$("scheduleLeader")?.value || "";
      return state.unitTeam.find(x=>
        x.church_unit_id===unitId &&
        x.profile_id===profileId &&
        LEADER_ROLES.has(x.role)
      ) || null;
    }

    return state.unitTeam.find(x=>
      x.church_unit_id===unitId &&
      x.profile_id===state.user?.id &&
      x.role===leaderRole[state.profile?.role]
    ) || null;
  }

  function selectedLeaderId() {
    const assignment=selectedScheduleAssignment();
    return assignment ? leaderForRoleCode(assignment.role)?.id : null;
  }

  function canManage(appointment) {
    const unitId=currentUnitId();
    if (unitId && appointment.church_unit_id!==unitId) return false;
    if (isSecretaryStaff()) return true;
    return appointment.assigned_profile_id===state.user?.id;
  }

  function populateCountrySelect() {
    const select=$("adminUnitCountry");
    if (!select) return;
    if (select.options.length) return;
    select.innerHTML=UNIT_COUNTRIES.map(([code,name])=>
      '<option value="'+code+'" '+(code==="CL"?"selected":"")+'>'+e(name)+'</option>'
    ).join("");
  }

  function fillUnitSelect(select,selectedId,{includeEmpty=false}={}) {
    if (!select) return;

    select.innerHTML="";

    if (includeEmpty) {
      const empty=document.createElement("option");
      empty.value="";
      empty.textContent="Selecciona un barrio";
      select.appendChild(empty);
    }

    state.accessibleUnits.forEach(unit=>{
      const option=document.createElement("option");
      option.value=unit.unit_id;
      option.textContent=unit.unit_name+(unit.city?" · "+unit.city:"");
      select.appendChild(option);
    });

    if (selectedId && state.accessibleUnits.some(x=>x.unit_id===selectedId)) {
      select.value=selectedId;
    } else if (!includeEmpty && select.options.length) {
      select.selectedIndex=0;
    } else {
      select.value="";
    }
  }

  function populateActiveUnitSelect() {
    const select=$("activeUnitSelect");
    if (!select) return;

    const previous=state.activeUnitId || select.value;
    fillUnitSelect(select,previous);

    state.activeUnitId=select.value || null;
    $("staffUnitContext")?.classList.toggle("hidden",!state.activeUnitId);

    const unit=currentUnit();
    $("activeUnitMeta").textContent=unit
      ? [unit.meetinghouse_name,unit.city,unit.country_code].filter(Boolean).join(" · ")
      : "";

    if (unit) $("panelUnit").textContent=unit.unit_name;

    fillUnitSelect($("scheduleUnit"),state.activeUnitId);

    if ($("userUnit")) {
      const currentUserUnit=$("userUnit").value;
      fillUnitSelect($("userUnit"),currentUserUnit,{includeEmpty:true});
    }

    updateScheduleContext();
  }

  function updateScheduleContext() {
    const unit=currentUnit();
    const assignment=selectedScheduleAssignment();

    if ($("scheduleContextUnit")) {
      $("scheduleContextUnit").textContent=unit
        ? unit.unit_name+(unit.city?" · "+unit.city:"")
        : "Selecciona un barrio";
    }

    if ($("scheduleContextLeader")) {
      $("scheduleContextLeader").textContent=assignment
        ? (roleText[assignment.role]||assignment.role)+" · "+(assignment.display_name||"Líder")
        : "Selecciona un líder del barrio";
    }

    if ($("scheduleListTitle")) {
      $("scheduleListTitle").textContent=unit
        ? "Horarios de esta semana · "+unit.unit_name
        : "Horarios de esta semana";
    }
  }

  async function loadActiveUnitTeam() {
    const unitId=currentUnitId();
    state.unitTeam=[];

    if (!unitId) {
      if ($("scheduleLeader")) $("scheduleLeader").innerHTML="";
      return;
    }

    const {data,error}=await db.rpc("staff_unit_team",{p_unit_id:unitId});
    if (error) {
      alertGlobal(error.message || "No se pudo cargar el liderazgo del barrio.","error");
      return;
    }

    state.unitTeam=data || [];

    const leaders=state.unitTeam.filter(x=>LEADER_ROLES.has(x.role));

    if (isSecretaryStaff()) {
      $("leaderSelectorWrap").classList.remove("hidden");
      const previous=$("scheduleLeader").value;

      $("scheduleLeader").innerHTML=leaders.length
        ? leaders.map(x=>
            '<option value="'+x.profile_id+'">'+e(roleText[x.role]||x.role)+' · '+e(x.display_name||"Líder")+'</option>'
          ).join("")
        : '<option value="">No hay líderes asignados</option>';

      if (previous && leaders.some(x=>x.profile_id===previous)) {
        $("scheduleLeader").value=previous;
      }

      $("scheduleLeaderHint").textContent=leaders.length
        ? leaders.length+" líder(es) disponible(s) en este barrio."
        : "Debes asignar liderazgo antes de crear horarios.";
    } else {
      $("leaderSelectorWrap").classList.add("hidden");
    }

    const canGenerate=leaders.length>0 || !isSecretaryStaff();
    $("generateScheduleBtn").disabled=!canGenerate;
    $("scheduleNoLeadersNotice").classList.toggle("hidden",canGenerate);
    $("goAssignLeaders").classList.toggle("hidden",!isSecretaryAdmin());

    if (!canGenerate) {
      state.selectedDates.clear();
      renderWeekStrip();
    }

    updateScheduleContext();
  }

  function openPanelMenu() {
    $("panelSidebar")?.classList.add("open");
    $("panelSidebar")?.setAttribute("aria-hidden","false");
    $("panelSidebarBackdrop")?.classList.remove("hidden");
    $("panelMenuToggle")?.setAttribute("aria-expanded","true");
    document.body.classList.add("panel-menu-open");
  }

  function closePanelMenu() {
    $("panelSidebar")?.classList.remove("open");
    $("panelSidebar")?.setAttribute("aria-hidden","true");
    $("panelSidebarBackdrop")?.classList.add("hidden");
    $("panelMenuToggle")?.setAttribute("aria-expanded","false");
    document.body.classList.remove("panel-menu-open");
  }

  function setPanelView(view,{scroll=true}={}) {
    let next=view || "overview";
    let target=document.querySelector('[data-panel-section="'+next+'"]');

    if (!target || target.classList.contains("hidden")) {
      next="overview";
      target=document.querySelector('[data-panel-section="overview"]');
    }

    state.panelView=next;

    document.querySelectorAll("[data-panel-section]").forEach(section=>{
      section.classList.toggle("panel-section-active",section.dataset.panelSection===next);
    });

    document.querySelectorAll("[data-panel-view]").forEach(button=>{
      button.classList.toggle("active",button.dataset.panelView===next);
    });

    closePanelMenu();

    if (scroll && window.matchMedia("(max-width: 760px)").matches) {
      window.scrollTo({top:0,behavior:"smooth"});
    }
  }

  function syncPanelNavigation() {
    const admin=isSecretaryAdmin();

    $("panelMenuToggle")?.classList.remove("hidden");
    $("panelNavUnits")?.classList.toggle("hidden",!admin);
    $("panelNavUsers")?.classList.toggle("hidden",!admin);
    $("panelSidebarRole").textContent=roleText[state.profile?.role] || "Panel interno";

    if (!admin && ["units","users"].includes(state.panelView)) {
      state.panelView="overview";
    }

    setPanelView(state.panelView,{scroll:false});
  }

  function hideAuthLoading() {
    $("authLoadingView")?.classList.add("hidden");
  }

  function showLogin() {
    hideAuthLoading();
    closePanelMenu();
    $("panelMenuToggle")?.classList.add("hidden");
    $("loginView").classList.remove("hidden");
    $("unauthorizedView").classList.add("hidden");
    $("dashboard").classList.add("hidden");
  }

  function showUnauthorized() {
    hideAuthLoading();
    closePanelMenu();
    $("panelMenuToggle")?.classList.add("hidden");
    $("loginView").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("unauthorizedView").classList.remove("hidden");
  }

  async function enterAuthenticated(session) {
    state.user = session.user;

    const {data:allowed,error:accessError} = await db.rpc("can_access_internal_panel");

    if (accessError || allowed!==true) {
      state.profile = null;
      showUnauthorized();
      return;
    }

    const {data:profile,error} = await db.from("profiles")
      .select("role,display_name,is_active")
      .eq("id",session.user.id)
      .maybeSingle();

    if (
      error ||
      !profile ||
      profile.is_active===false ||
      !isInternalRole(profile.role)
    ) {
      state.profile = null;
      showUnauthorized();
      return;
    }

    state.profile = profile;
    hideAuthLoading();
    $("loginView").classList.add("hidden");
    $("unauthorizedView").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("userAdminCard").classList.toggle("hidden",!isSecretaryAdmin());
    $("unitLeadershipCard")?.classList.toggle("hidden",!isSecretaryAdmin());
    syncPanelNavigation();

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
      db.from("leaders")
        .select("id,code,title,sort_order")
        .eq("is_active",true)
        .order("sort_order"),
      db.from("appointments")
        .select("id,status,member_user_id,member_name,member_phone,member_email,created_at,church_unit_id,assigned_profile_id,church_units(unit_name,meetinghouse_name,city),availability(id,start_at,end_at,leader_id,church_unit_id,assigned_profile_id),interview_types(id,name,leaders(id,code,title))")
        .order("created_at",{ascending:false}),
      db.from("availability")
        .select("id,leader_id,church_unit_id,assigned_profile_id,start_at,end_at,is_active,is_booked,leaders(id,code,title)")
        .gte("start_at",new Date(Date.now()-86400000).toISOString())
        .order("start_at"),
      db.rpc("staff_accessible_units")
    ];

    if (isSecretaryAdmin()) {
      requests.push(
        db.from("profiles")
          .select("id,email,display_name,role,is_active,created_at")
          .order("created_at",{ascending:true}),
        db.from("unit_staff_assignments")
          .select("id,profile_id,role,church_unit_id,is_active,church_units(id,unit_name,meetinghouse_name,city,country_code)")
          .eq("is_active",true)
      );
    }

    const [
      leadersResult,
      appointmentsResult,
      scheduleResult,
      unitsResult,
      profilesResult,
      assignmentsResult
    ] = await Promise.all(requests);

    if (
      leadersResult.error ||
      appointmentsResult.error ||
      scheduleResult.error ||
      unitsResult.error ||
      (profilesResult && profilesResult.error) ||
      (assignmentsResult && assignmentsResult.error)
    ) {
      alertGlobal("No se pudieron cargar todos los datos del panel.","error");
      return;
    }

    state.leaders = leadersResult.data || [];
    state.appointments = appointmentsResult.data || [];
    state.schedule = scheduleResult.data || [];
    state.accessibleUnits = unitsResult.data || [];
    state.profiles = profilesResult?.data || [];
    state.staffAssignments = assignmentsResult?.data || [];

    populateCountrySelect();
    populateActiveUnitSelect();
    await loadActiveUnitTeam();

    if (isSecretaryStaff()) {
      const {data:memberProfiles,error:memberError} = await db.from("member_profiles")
        .select("id,full_name,phone,church_unit_id,church_unit_name,meetinghouse_name,location_city,location_country_code,unit_assignment_method,created_at")
        .order("created_at",{ascending:false});

      if (memberError) {
        alertGlobal("No se pudieron cargar los miembros de tus barrios.","error");
        state.memberProfiles = [];
      } else {
        state.memberProfiles = memberProfiles || [];
      }
    } else {
      state.memberProfiles = [];
    }

    renderStats();
    renderAppointments();
    renderWeekStrip();
    renderSchedule();

    if (isSecretaryAdmin()) {
      $("leaderUsersBadge").textContent = state.profiles.filter(x=>x.role!=="unassigned").length;
      $("memberUsersBadge").textContent = state.memberProfiles.length;
      setUserDirectoryMode(state.userDirectoryMode);
      renderAdminSelectedUnit();
    }
  }

  function renderStats() {
    const unitId=currentUnitId();
    const rows = state.appointments.filter(canManage);
    const open = rows.filter(x=>!["completed","cancelled","rejected"].includes(x.status)).length;
    const approved = rows.filter(x=>x.status==="approved").length;
    const relevantSchedules = state.schedule.filter(x=>
      (!unitId || x.church_unit_id===unitId) &&
      (isSecretaryStaff() || x.assigned_profile_id===state.user?.id)
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
              (a.church_units?.unit_name?'<strong>Barrio/Rama:</strong> '+e(a.church_units.unit_name)+'<br>':'')+
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

    $("usersList").innerHTML = rows.length ? rows.map(x=>{
      const assignment=assignmentForProfile(x.id);
      const unitName=assignment?.church_units?.unit_name || (x.role==="secretary_admin" ? "Acceso general" : "Sin barrio asignado");

      return '<div class="user-row">'+
        '<div class="user-row-main">'+
          '<strong>'+e(x.display_name||x.email||"Usuario")+'</strong>'+
          '<small>'+e(x.email||"Sin correo")+'</small>'+
          '<span class="user-assignment-line">'+e(unitName)+'</span>'+
        '</div>'+
        '<div class="user-row-right">'+
          '<span class="role-pill">'+e(roleText[x.role]||x.role)+'</span>'+
          '<span class="'+(x.is_active?"status-active":"status-inactive")+'">'+(x.is_active?"Activo":"Inactivo")+'</span>'+
          '<button class="edit-user-button" type="button" data-edit-user="'+e(x.id)+'">Cambiar cargo / barrio</button>'+
        '</div>'+
      '</div>';
    }).join("") : '<div class="empty">No hay líderes con este filtro.</div>';

    $("usersList").querySelectorAll("[data-edit-user]").forEach(button=>{
      button.onclick = () => openUserEditor(button.dataset.editUser);
    });
  }

  function renderMemberUsers() {
    const query = ($("memberUserFilter")?.value || "").trim().toLowerCase();
    const allRows = state.memberProfiles || [];

    const rows = allRows.filter(member=>{
      const profile=state.profiles.find(x=>x.id===member.id);
      const assignment=assignmentForProfile(member.id);
      if (!query) return true;

      const haystack = [
        member.full_name,
        member.phone,
        member.church_unit_name,
        member.meetinghouse_name,
        member.location_city,
        member.location_country_code,
        profile?.role ? roleText[profile.role] : "",
        assignment?.church_units?.unit_name
      ].filter(Boolean).join(" ").toLowerCase();

      return haystack.includes(query);
    });

    $("leaderUsersBadge").textContent = state.profiles.filter(x=>x.role!=="unassigned").length;
    $("memberUsersBadge").textContent = allRows.length;
    $("memberUsersCount").textContent = rows.length+" de "+allRows.length+" miembro(s)";

    $("memberUsersList").innerHTML = rows.length ? rows.map(member=>{
      const profile=state.profiles.find(x=>x.id===member.id);
      const assignment=assignmentForProfile(member.id);
      const role=profile?.role || "unassigned";
      const roleLabel=roleText[role] || "Miembro";
      const unit = assignment?.church_units?.unit_name || member.church_unit_name || "Barrio/Rama sin configurar";
      const chapel = member.meetinghouse_name ? " · "+member.meetinghouse_name : "";
      const place = [member.location_city,member.location_country_code].filter(Boolean).join(" · ");
      const hasCalling=role!=="unassigned";

      return '<div class="user-row member-user-row">'+
        '<div class="member-user-main">'+
          '<strong>'+e(member.full_name||"Miembro")+'</strong>'+
          '<small>'+e(member.phone||"Sin teléfono")+'</small>'+
          '<span class="member-unit-line"><strong>'+e(unit)+'</strong>'+e(chapel)+'</span>'+
          (place?'<span class="member-location-line">'+e(place)+'</span>':'')+
        '</div>'+
        '<div class="user-row-right">'+
          '<span class="role-pill '+(hasCalling?"":"member-role-pill")+'">'+e(roleLabel)+'</span>'+
          '<button class="edit-user-button" type="button" data-promote-member="'+e(member.id)+'">'+
            (hasCalling?"Editar cargo / barrio":"Asignar cargo")+
          '</button>'+
        '</div>'+
      '</div>';
    }).join("") : '<div class="empty">No hay miembros que coincidan con la búsqueda.</div>';

    $("memberUsersList").querySelectorAll("[data-promote-member]").forEach(button=>{
      button.onclick=()=>openUserEditor(button.dataset.promoteMember);
    });
  }

  function groupAdminUnitRows(rows) {
    const map=new Map();

    (rows||[]).forEach(row=>{
      if (!row.unit_id) return;
      if (map.has(row.unit_id)) return;

      map.set(row.unit_id,{
        id:row.unit_id,
        unit_name:row.unit_name,
        unit_type:row.unit_type,
        meetinghouse_name:row.meetinghouse_name,
        address:row.address,
        city:row.city,
        region:row.region,
        country_code:row.country_code,
        sunday_service:row.sunday_service
      });
    });

    return [...map.values()].sort((a,b)=>
      (a.unit_name||"").localeCompare(b.unit_name||"","es")
    );
  }

  async function searchAdminUnits() {
    if (!isSecretaryAdmin()) return;

    const button=$("adminUnitSearchBtn");
    const countryCode=$("adminUnitCountry").value;
    const city=$("adminUnitCity").value.trim();
    const query=$("adminUnitQuery").value.trim();

    button.disabled=true;
    button.textContent="Buscando…";
    $("adminUnitSearchStatus").textContent="Buscando barrios y ramas…";

    try {
      if (city) {
        try {
          await Promise.race([
            db.functions.invoke("church-directory",{
              body:{city,countryCode}
            }),
            new Promise(resolve=>setTimeout(()=>resolve(null),12000))
          ]);
        } catch (_) {}
      }

      const {data,error}=await db.rpc("search_church_catalog",{
        p_query:query || null,
        p_country_code:countryCode || null,
        p_city:city || null,
        p_limit:100
      });

      if (error) throw error;

      state.adminUnitResults=groupAdminUnitRows(data||[]);
      $("adminUnitSearchStatus").textContent=state.adminUnitResults.length
        ? state.adminUnitResults.length+" barrio(s)/rama(s) encontrado(s)."
        : "No encontramos barrios con esos datos.";
      renderAdminUnitResults();
    } catch (error) {
      $("adminUnitSearchStatus").textContent=error?.message || "No se pudo buscar el barrio.";
      $("adminUnitResults").innerHTML="";
    } finally {
      button.disabled=false;
      button.textContent="Buscar barrio";
    }
  }

  function renderAdminUnitResults() {
    const rows=state.adminUnitResults || [];
    $("adminUnitResults").innerHTML=rows.length ? rows.map(unit=>
      '<article class="unit-admin-result">'+
        '<div>'+
          '<strong>'+e(unit.unit_name||"Barrio / Rama")+'</strong>'+
          '<span>'+e([unit.meetinghouse_name,unit.address].filter(Boolean).join(" · "))+'</span>'+
          '<small>'+e([unit.city,unit.region,unit.country_code].filter(Boolean).join(" · "))+'</small>'+
        '</div>'+
        '<button type="button" class="secondary-button" data-admin-unit="'+unit.id+'">Administrar</button>'+
      '</article>'
    ).join("") : "";

    $("adminUnitResults").querySelectorAll("[data-admin-unit]").forEach(button=>{
      button.onclick=()=>selectAdminUnit(button.dataset.adminUnit);
    });
  }

  async function selectAdminUnit(unitId) {
    const unit=state.adminUnitResults.find(x=>x.id===unitId)
      || state.accessibleUnits.find(x=>x.unit_id===unitId);

    if (!unit) return;

    state.adminSelectedUnit={
      id:unit.id || unit.unit_id,
      unit_name:unit.unit_name,
      meetinghouse_name:unit.meetinghouse_name,
      address:unit.address || "",
      city:unit.city,
      region:unit.region || "",
      country_code:unit.country_code
    };

    $("adminUnitManager").classList.remove("hidden");
    await loadAdminUnitTeam();
    $("adminUnitManager").scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function loadAdminUnitTeam() {
    if (!state.adminSelectedUnit?.id || !isSecretaryAdmin()) {
      state.adminUnitTeam=[];
      return;
    }

    const {data,error}=await db.rpc("staff_unit_team",{
      p_unit_id:state.adminSelectedUnit.id
    });

    if (error) {
      $("adminUnitResult").textContent=error.message || "No se pudo cargar el liderazgo.";
      $("adminUnitResult").className="alert error";
      return;
    }

    state.adminUnitTeam=data || [];
    renderAdminSelectedUnit();
  }

  function populateUnitAssignProfiles() {
    const role=$("unitAssignRole")?.value || "bishop";
    const rows=state.profiles.filter(profile=>
      profile.is_active &&
      profile.role===role
    );

    $("unitAssignProfile").innerHTML=rows.length
      ? rows.map(profile=>
          '<option value="'+profile.id+'">'+e(profile.display_name||profile.email||"Usuario")+' · '+e(profile.email||"")+'</option>'
        ).join("")
      : '<option value="">No hay usuarios disponibles con este rol</option>';
  }

  function renderAdminSelectedUnit() {
    const unit=state.adminSelectedUnit;
    if (!unit) {
      $("adminUnitManager")?.classList.add("hidden");
      return;
    }

    $("adminSelectedUnitName").textContent=unit.unit_name || "Barrio / Rama";
    $("adminSelectedUnitMeta").textContent=[
      unit.meetinghouse_name,
      unit.address,
      unit.city,
      unit.country_code
    ].filter(Boolean).join(" · ");

    const roles=["bishop","first_counselor","second_counselor","secretary"];
    const team=state.adminUnitTeam || [];
    $("adminUnitTeamCount").textContent=team.length+" asignación(es)";

    $("adminUnitTeamList").innerHTML=roles.map(role=>{
      const matches=team.filter(x=>x.role===role);

      if (!matches.length) {
        return '<div class="unit-team-role empty-role">'+
          '<div><strong>'+e(roleText[role]||role)+'</strong><span>Sin asignar</span></div>'+
        '</div>';
      }

      return matches.map(item=>
        '<div class="unit-team-role">'+
          '<div><strong>'+e(roleText[item.role]||item.role)+'</strong><span>'+e(item.display_name||"Usuario")+'</span></div>'+
          '<button type="button" class="danger-link" data-unassign-unit-staff="'+item.assignment_id+'">Quitar</button>'+
        '</div>'
      ).join("");
    }).join("");

    $("adminUnitTeamList").querySelectorAll("[data-unassign-unit-staff]").forEach(button=>{
      button.onclick=()=>unassignUnitStaff(button.dataset.unassignUnitStaff);
    });

    populateUnitAssignProfiles();
  }

  async function unassignUnitStaff(assignmentId) {
    if (!isSecretaryAdmin()) return;
    const {error}=await db.rpc("admin_unassign_unit_staff",{
      p_assignment_id:assignmentId
    });

    if (error) {
      $("adminUnitResult").textContent=error.message || "No se pudo quitar la asignación.";
      $("adminUnitResult").className="alert error";
      return;
    }

    $("adminUnitResult").textContent="Asignación eliminada correctamente.";
    $("adminUnitResult").className="alert success";
    await refresh();
    await loadAdminUnitTeam();
  }

  async function assignExistingStaff(event) {
    event.preventDefault();
    if (!isSecretaryAdmin() || !state.adminSelectedUnit?.id) return;

    const profileId=$("unitAssignProfile").value;
    const role=$("unitAssignRole").value;

    if (!profileId) {
      $("adminUnitResult").textContent="No hay un usuario de ese rol para asignar.";
      $("adminUnitResult").className="alert error";
      return;
    }

    const {error}=await db.rpc("admin_assign_unit_staff",{
      p_unit_id:state.adminSelectedUnit.id,
      p_profile_id:profileId,
      p_role:role
    });

    if (error) {
      $("adminUnitResult").textContent=error.message || "No se pudo asignar el usuario.";
      $("adminUnitResult").className="alert error";
      return;
    }

    $("adminUnitResult").textContent="Usuario asignado al barrio correctamente.";
    $("adminUnitResult").className="alert success";
    await refresh();
    await loadAdminUnitTeam();
  }

  async function createUnitStaff(event) {
    event.preventDefault();
    if (!isSecretaryAdmin() || !state.adminSelectedUnit?.id) return;

    const button=$("createUnitStaffBtn");
    const result=$("adminUnitResult");
    button.disabled=true;
    button.textContent="Creando…";
    result.className="alert hidden";

    try {
      const display_name=$("unitStaffName").value.trim();
      const email=$("unitStaffEmail").value.trim().toLowerCase();
      const role=$("unitStaffRole").value;
      const password=$("unitStaffPassword").value;

      const {data,error}=await signupClient.auth.signUp({
        email,
        password,
        options:{data:{full_name:display_name}}
      });

      if (error) throw error;
      if (!data?.user?.id) throw new Error("No se pudo crear el usuario.");

      const {error:roleError}=await db.rpc("secretary_admin_assign_role",{
        p_user_id:data.user.id,
        p_role:role,
        p_display_name:display_name
      });
      if (roleError) throw new Error("La cuenta fue creada, pero no se pudo asignar el rol.");

      const {error:assignError}=await db.rpc("admin_assign_unit_staff",{
        p_unit_id:state.adminSelectedUnit.id,
        p_profile_id:data.user.id,
        p_role:role
      });
      if (assignError) throw new Error("La cuenta fue creada, pero no se pudo asignar al barrio.");

      result.textContent="Usuario creado y asignado a "+state.adminSelectedUnit.unit_name+".";
      result.className="alert success";
      $("createUnitStaffForm").reset();
      $("unitStaffRole").value="bishop";
      await refresh();
      await loadAdminUnitTeam();
    } catch (error) {
      result.textContent=error?.message || "No se pudo crear el usuario.";
      result.className="alert error";
    } finally {
      button.disabled=false;
      button.textContent="Crear y asignar";
    }
  }

  function openUserEditor(userId) {
    if (!isSecretaryAdmin()) return;
    const user = state.profiles.find(x=>x.id===userId);
    if (!user) return;

    const member=memberForProfile(userId);

    $("editUserId").value = user.id;
    $("editUserName").value = user.display_name || member?.full_name || "";
    $("editUserEmail").value = member?.phone || user.email || "";
    $("editUserLoginHint").textContent = member?.phone
      ? "Esta persona conserva su teléfono y contraseña como usuario. También podrá usar ese teléfono para entrar al panel si tiene un cargo."
      : "El correo de acceso no se cambia desde esta edición.";
    $("editUserRole").value = user.role || "unassigned";
    $("editUserActive").checked = Boolean(user.is_active);
    $("editUserTitle").textContent = user.display_name || member?.full_name || user.email || "Usuario";

    populateEditUserUnit(userId);
    syncEditUserUnitVisibility();

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
    const assignment = selectedScheduleAssignment();
    const leaderId = selectedLeaderId();
    const unitId = currentUnitId();
    const dates = [...state.selectedDates].sort();
    const startTime = $("scheduleStartTime").value;
    const endTime = $("scheduleEndTime").value;
    const duration = Number($("scheduleDuration").value || 30);

    if (!unitId) {
      throw new Error("Selecciona primero un barrio o rama.");
    }

    if (!assignment || !leaderId || !dates.length || !startTime || !endTime) {
      throw new Error("Selecciona un líder asignado, uno o varios días y el rango horario.");
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
        slots.push({
          leader_id:leaderId,
          church_unit_id:unitId,
          assigned_profile_id:assignment.profile_id,
          start_at,
          end_at,
          is_active:true
        });
      }
    });

    return slots;
  }

  function scheduleForSelectedWeek() {
    const assignment = selectedScheduleAssignment();
    const leaderId = selectedLeaderId();
    const unitId = currentUnitId();
    const dates = new Set(weekDates().map(dateKeyUTC));

    if (!assignment || !leaderId || !unitId) return [];

    return state.schedule.filter(slot=>
      slot.church_unit_id===unitId &&
      slot.assigned_profile_id===assignment.profile_id &&
      slot.leader_id===leaderId &&
      dates.has(dateKeyBolivia(slot.start_at))
    );
  }

  function renderSchedule() {
    updateScheduleContext();
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

    let authEmail;
    try {
      authEmail=staffAuthEmail($("loginEmail").value);
    } catch (identityError) {
      button.disabled=false;
      button.textContent="Ingresar";
      $("loginError").textContent=identityError.message;
      $("loginError").classList.remove("hidden");
      return;
    }

    const {data,error} = await db.auth.signInWithPassword({
      email:authEmail,
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
      const unitId = $("userUnit")?.value || null;

      if (role!=="secretary_admin" && !unitId) {
        throw new Error("Selecciona el barrio o rama que administrará este usuario.");
      }

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

      if (roleError) {
        throw new Error("El usuario fue creado, pero no se pudo asignar el rol.");
      }

      if (role!=="secretary_admin") {
        const {error:assignError} = await db.rpc("admin_assign_unit_staff",{
          p_unit_id:unitId,
          p_profile_id:data.user.id,
          p_role:role
        });

        if (assignError) {
          throw new Error("El usuario fue creado, pero no se pudo asignar al barrio.");
        }
      }

      result.textContent = role==="secretary_admin"
        ? "Secretario Administrador creado correctamente."
        : "Usuario creado y asignado al barrio correctamente.";
      result.className = "alert success";

      form.reset();
      $("userRole").value = "bishop";
      $("userPassword").type = "password";
      $("toggleUserPassword").textContent = "Mostrar";
      if ($("userUnitWrap")) $("userUnitWrap").classList.remove("hidden");

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

    const role=$("editUserRole").value;
    const unitId=role==="secretary_admin" ? null : ($("editUserUnit").value || null);

    if (["secretary","bishop","first_counselor","second_counselor"].includes(role) && !unitId) {
      button.disabled=false;
      button.textContent="Guardar cambios";
      result.textContent="Selecciona el barrio o rama para este cargo.";
      result.className="alert error";
      return;
    }

    const {error} = await db.rpc("admin_rotate_user",{
      p_user_id:$("editUserId").value,
      p_display_name:$("editUserName").value.trim(),
      p_role:role,
      p_unit_id:unitId,
      p_is_active:$("editUserActive").checked
    });

    button.disabled = false;
    button.textContent = "Guardar cambios";

    if (error) {
      result.textContent = error.message || "No se pudieron guardar el cargo y el barrio.";
      result.className = "alert error";
      return;
    }

    result.textContent = role==="unassigned"
      ? "La persona quedó como miembro / sin cargo interno."
      : "Cargo y barrio actualizados correctamente.";
    result.className = "alert success";
    await refresh();
    setTimeout(closeUserEditor,900);
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

    const button = $("generateScheduleBtn");
    const localAlert=$("scheduleInlineAlert");
    localAlert.className="alert hidden";
    button.disabled = true;
    button.textContent = "Generando…";

    const {data,error} = await db.from("availability")
      .upsert(slots,{onConflict:"church_unit_id,assigned_profile_id,start_at",ignoreDuplicates:true})
      .select("id");

    button.disabled = false;
    button.textContent = "Generar horarios";

    if (error) {
      localAlert.textContent=error.message || "No se pudieron generar los horarios.";
      localAlert.className="alert error";
      localAlert.scrollIntoView({behavior:"smooth",block:"nearest"});
      return;
    }

    localAlert.textContent="Horarios generados: "+(data?.length||0)+". Los duplicados existentes se omitieron.";
    localAlert.className="alert success";
    await refresh();
  };

  async function logout() {
    await db.auth.signOut({scope:"local"});
    state.user = null;
    state.profile = null;
    showLogin();
  }

  $("cancelEditUser").onclick = closeUserEditor;
  $("cancelEditUserTop").onclick = closeUserEditor;

  $("panelMenuToggle").onclick = () => {
    if ($("panelSidebar")?.classList.contains("open")) closePanelMenu();
    else openPanelMenu();
  };
  $("panelSidebarClose").onclick = closePanelMenu;
  $("panelSidebarBackdrop").onclick = closePanelMenu;

  document.querySelectorAll("[data-panel-view]").forEach(button=>{
    button.onclick = () => setPanelView(button.dataset.panelView);
  });

  $("panelSidebarRefresh").onclick = async () => {
    closePanelMenu();
    await refresh();
  };
  $("panelSidebarLogout").onclick = logout;

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

  $("userRole").onchange = () => {
    const adminRole=$("userRole").value==="secretary_admin";
    $("userUnitWrap")?.classList.toggle("hidden",adminRole);
  };

  $("editUserRole").onchange = syncEditUserUnitVisibility;

  async function changeActiveUnit(unitId,{syncSchedule=true}={}) {
    state.activeUnitId=unitId || null;

    if ($("activeUnitSelect") && $("activeUnitSelect").value!==state.activeUnitId) {
      $("activeUnitSelect").value=state.activeUnitId || "";
    }
    if (syncSchedule && $("scheduleUnit") && $("scheduleUnit").value!==state.activeUnitId) {
      $("scheduleUnit").value=state.activeUnitId || "";
    }

    const unit=currentUnit();
    $("activeUnitMeta").textContent=unit
      ? [unit.meetinghouse_name,unit.city,unit.country_code].filter(Boolean).join(" · ")
      : "";
    if (unit) $("panelUnit").textContent=unit.unit_name;

    state.selectedDates.clear();
    await loadActiveUnitTeam();
    renderStats();
    renderAppointments();
    renderWeekStrip();
    renderSchedule();
  }

  $("activeUnitSelect").onchange = async () => {
    await changeActiveUnit($("activeUnitSelect").value || null);
  };

  $("scheduleUnit").onchange = async () => {
    await changeActiveUnit($("scheduleUnit").value || null);
  };

  $("goAssignLeaders").onclick = () => setPanelView("units");

  $("adminUnitSearchBtn").onclick = searchAdminUnits;
  $("adminUnitQuery").addEventListener("keydown",event=>{
    if (event.key==="Enter") {
      event.preventDefault();
      searchAdminUnits();
    }
  });
  $("adminUnitCity").addEventListener("keydown",event=>{
    if (event.key==="Enter") {
      event.preventDefault();
      searchAdminUnits();
    }
  });

  $("assignExistingStaffForm").onsubmit = assignExistingStaff;
  $("createUnitStaffForm").onsubmit = createUnitStaff;
  $("unitAssignRole").onchange = populateUnitAssignProfiles;
  $("closeAdminUnitManager").onclick = () => {
    state.adminSelectedUnit=null;
    state.adminUnitTeam=[];
    $("adminUnitManager").classList.add("hidden");
  };

  $("statusFilter").onchange = renderAppointments;

  $("scheduleLeader").onchange = () => {
    state.selectedDates.clear();
    updateScheduleContext();
    renderWeekStrip();
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
