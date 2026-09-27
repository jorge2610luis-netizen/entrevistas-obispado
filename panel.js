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
    calendarMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),
    selectedDateKey:null
  };

  if ($("panelVersion")) $("panelVersion").textContent = window.APP_CONFIG.version || "v2.2.0";

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
  const isSecretaryAdmin = () => state.profile?.role === "secretary_admin";

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

  function localDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,"0");
    const d = String(date.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+d;
  }

  function monthTitle(date) {
    return new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"})
      .format(date)
      .replace(/^./,c=>c.toUpperCase());
  }

  function longDateFromKey(key) {
    const [y,m,d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-BO",{
      weekday:"long",day:"numeric",month:"long",year:"numeric"
    }).format(new Date(y,m-1,d)).replace(/^./,c=>c.toUpperCase());
  }

  function timeLabel(value) {
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"America/La_Paz",
      hour:"2-digit",
      minute:"2-digit"
    }).format(new Date(value));
  }

  function leaderForRole() {
    return state.leaders.find(x => x.code===leaderRole[state.profile?.role]);
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
      ? "Administración general: usuarios, solicitudes y calendarios de todos los líderes."
      : profile.role==="secretary"
        ? "Revisa solicitudes y administra los calendarios de todos los líderes."
        : "Revisa tus solicitudes y administra tu calendario.";

    const {data:settings} = await db.from("settings").select("unit_name").eq("id",1).maybeSingle();
    if (settings?.unit_name) $("panelUnit").textContent = settings.unit_name;

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
        .select("id,status,member_name,member_phone,member_email,created_at,availability(id,start_at,end_at,leader_id),interview_types(id,name,leaders(id,code,title))")
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

    const results = await Promise.all(requests);
    const [leadersResult,appointmentsResult,scheduleResult,profilesResult] = results;

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
    renderAdminCalendar();
    renderSelectedDay();
    if (isSecretaryAdmin()) renderUsers();
  }

  function renderStats() {
    const rows = state.appointments.filter(canManage);
    const open = rows.filter(x=>!["completed","cancelled","rejected"].includes(x.status)).length;
    const approved = rows.filter(x=>x.status==="approved").length;
    const relevantSchedules = state.schedule.filter(x =>
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
    const rows = state.appointments.filter(a =>
      canManage(a) && (filter==="all" || a.status===filter)
    );

    $("requestsHint").textContent = rows.length+" solicitud(es) visibles";
    const list = $("requestsList");

    list.innerHTML = rows.length ? rows.map(a =>
      '<article class="request-item">'+
        '<div class="request-top">'+
          '<div>'+
            '<h3>'+e(a.member_name)+'</h3>'+
            '<div class="request-meta">'+
              e(a.interview_types?.name||"Entrevista")+' · '+e(a.interview_types?.leaders?.title||"")+'<br>'+
              (a.availability?.start_at?e(fmt(a.availability.start_at)):"Sin horario")+'<br>'+
              e(a.member_phone)+(a.member_email?' · '+e(a.member_email):'')+
            '</div>'+
          '</div>'+
          '<span class="badge '+e(a.status)+'">'+e(statusText[a.status]||a.status)+'</span>'+
        '</div>'+
        '<div class="actions">'+actions(a)+'</div>'+
      '</article>'
    ).join("") : '<div class="empty">No hay solicitudes para este filtro.</div>';

    list.querySelectorAll("button[data-id]").forEach(button => {
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

  function renderUsers() {
    const list = $("usersList");
    const rows = state.profiles.filter(x=>x.role!=="unassigned");
    $("usersCount").textContent = rows.length+" usuario(s)";

    list.innerHTML = rows.length ? rows.map(x =>
      '<div class="user-row">'+
        '<div><strong>'+e(x.display_name||x.email||"Usuario")+'</strong><small>'+e(x.email||"Sin correo")+'</small></div>'+
        '<div class="user-row-right">'+
          '<span class="role-pill">'+e(roleText[x.role]||x.role)+'</span>'+
          '<span class="'+(x.is_active?"status-active":"status-inactive")+'">'+(x.is_active?"Activo":"Inactivo")+'</span>'+
          '<button class="edit-user-button" type="button" data-edit-user="'+e(x.id)+'">Editar</button>'+
        '</div>'+
      '</div>'
    ).join("") : '<div class="empty">No hay usuarios configurados.</div>';

    list.querySelectorAll("[data-edit-user]").forEach(button => {
      button.onclick = () => openUserEditor(button.dataset.editUser);
    });
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

  function schedulesForLeader() {
    const leaderId = selectedLeaderId();
    return state.schedule.filter(x=>x.leader_id===leaderId);
  }

  function scheduleMap() {
    const map = new Map();
    schedulesForLeader().forEach(slot => {
      const key = dateKeyBolivia(slot.start_at);
      if (!map.has(key)) map.set(key,[]);
      map.get(key).push(slot);
    });
    return map;
  }

  function renderAdminCalendar() {
    const month = state.calendarMonth;
    $("adminMonthTitle").textContent = monthTitle(month);

    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDow = new Date(year,monthIndex,1).getDay();
    const daysInMonth = new Date(year,monthIndex+1,0).getDate();
    const previousDays = new Date(year,monthIndex,0).getDate();
    const byDate = scheduleMap();
    const cells = [];

    for (let i=firstDow-1;i>=0;i--) {
      cells.push({day:previousDays-i,muted:true,date:new Date(year,monthIndex-1,previousDays-i)});
    }

    for (let day=1;day<=daysInMonth;day++) {
      cells.push({day,muted:false,date:new Date(year,monthIndex,day)});
    }

    while (cells.length % 7 !== 0 || cells.length < 42) {
      const day = cells.length - (firstDow + daysInMonth) + 1;
      cells.push({day,muted:true,date:new Date(year,monthIndex+1,day)});
    }

    $("adminCalendar").innerHTML = cells.map(cell => {
      const key = localDateKey(cell.date);
      const rows = byDate.get(key) || [];
      const available = rows.filter(x=>x.is_active&&!x.is_booked).length;
      const booked = rows.filter(x=>x.is_booked).length;
      const inactive = rows.filter(x=>!x.is_active&&!x.is_booked).length;

      const classes = [
        "calendar-day",
        "admin-day",
        cell.muted ? "outside-month" : "",
        rows.length ? "has-schedule" : "",
        state.selectedDateKey===key ? "selected" : ""
      ].filter(Boolean).join(" ");

      return '<button type="button" class="'+classes+'" data-date="'+key+'">'+
        '<span class="day-number">'+cell.day+'</span>'+
        '<span class="admin-day-counts">'+
          (available?'<small class="count-available">'+available+' disp.</small>':'')+
          (booked?'<small class="count-booked">'+booked+' ocup.</small>':'')+
          (inactive?'<small class="count-inactive">'+inactive+' off</small>':'')+
        '</span>'+
      '</button>';
    }).join("");

    $("adminCalendar").querySelectorAll("[data-date]").forEach(button => {
      button.onclick = () => selectAdminDay(button.dataset.date);
    });
  }

  function selectAdminDay(key) {
    state.selectedDateKey = key;
    renderAdminCalendar();
    renderSelectedDay();
    $("calendarDayEditor").classList.remove("hidden");
    $("calendarDayEditor").scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function renderSelectedDay() {
    const key = state.selectedDateKey;
    if (!key) {
      $("calendarDayEditor").classList.add("hidden");
      return;
    }

    $("calendarSelectedDate").textContent = longDateFromKey(key);
    const rows = schedulesForLeader()
      .filter(x=>dateKeyBolivia(x.start_at)===key)
      .sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));

    $("dayScheduleCount").textContent = rows.length+" horario(s)";
    $("dayScheduleList").innerHTML = rows.length ? rows.map(slot =>
      '<div class="slot-row">'+
        '<div>'+
          '<strong>'+e(timeLabel(slot.start_at))+'–'+e(timeLabel(slot.end_at))+'</strong><br>'+
          '<small>'+(slot.is_booked?"Ocupado / solicitado":slot.is_active?"Disponible":"Desactivado")+'</small>'+
        '</div>'+
        (slot.is_booked ? '' :
          '<button data-slot="'+slot.id+'" data-active="'+(slot.is_active?"0":"1")+'">'+
            (slot.is_active?"Desactivar":"Activar")+
          '</button>')+
      '</div>'
    ).join("") : '<div class="empty">Todavía no hay horarios para este día.</div>';

    $("dayScheduleList").querySelectorAll("[data-slot]").forEach(button => {
      button.onclick = async () => {
        const {error} = await db.from("availability")
          .update({is_active:button.dataset.active==="1"})
          .eq("id",button.dataset.slot);

        if (error) alertGlobal(error.message || "No se pudo cambiar el horario.","error");
        else await refresh();
      };
    });
  }

  function buildDaySlots() {
    const leaderId = selectedLeaderId();
    const dateKey = state.selectedDateKey;
    const startTime = $("dayStartTime").value;
    const endTime = $("dayEndTime").value;
    const duration = Number($("dayDuration").value || 30);

    if (!leaderId || !dateKey || !startTime || !endTime) {
      throw new Error("Selecciona un día y completa el rango horario.");
    }

    const [sh,sm] = startTime.split(":").map(Number);
    const [eh,em] = endTime.split(":").map(Number);
    const startMinutes = sh*60+sm;
    const endMinutes = eh*60+em;

    if (endMinutes<=startMinutes) {
      throw new Error("La hora final debe ser posterior a la hora inicial.");
    }

    const slots = [];

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

    return slots;
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

  $("dayScheduleForm").onsubmit = async event => {
    event.preventDefault();

    let slots;
    try {
      slots = buildDaySlots();
      if (!slots.length) throw new Error("No se generaron horarios futuros con ese rango.");
    } catch (error) {
      alertGlobal(error.message || "Revisa la configuración del día.","error");
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Agregando…";

    const {data,error} = await db.from("availability")
      .upsert(slots,{onConflict:"leader_id,start_at",ignoreDuplicates:true})
      .select("id");

    button.disabled = false;
    button.textContent = "Agregar horarios";

    if (error) {
      alertGlobal(error.message || "No se pudieron generar los horarios.","error");
      return;
    }

    alertGlobal("Horarios agregados: "+(data?.length||0)+". Los duplicados se omitieron.","success");
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
  $("statusFilter").onchange = renderAppointments;

  $("scheduleLeader").onchange = () => {
    state.selectedDateKey = null;
    renderAdminCalendar();
    renderSelectedDay();
  };

  $("adminPrevMonth").onclick = () => {
    const m = state.calendarMonth;
    state.calendarMonth = new Date(m.getFullYear(),m.getMonth()-1,1);
    state.selectedDateKey = null;
    renderAdminCalendar();
    renderSelectedDay();
  };

  $("adminNextMonth").onclick = () => {
    const m = state.calendarMonth;
    state.calendarMonth = new Date(m.getFullYear(),m.getMonth()+1,1);
    state.selectedDateKey = null;
    renderAdminCalendar();
    renderSelectedDay();
  };

  $("closeDayEditor").onclick = () => {
    state.selectedDateKey = null;
    renderAdminCalendar();
    renderSelectedDay();
  };

  db.auth.onAuthStateChange(event => {
    if (event==="SIGNED_OUT") {
      state.user = null;
      state.profile = null;
      showLogin();
    }
  });

  boot();
})();
