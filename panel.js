(() => {
  const db=window.supabase.createClient(window.APP_CONFIG.supabaseUrl,window.APP_CONFIG.supabasePublishableKey);
  const signupClient=window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabasePublishableKey,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
  );
  const $=id=>document.getElementById(id);
  const state={user:null,profile:null,leaders:[],appointments:[],schedule:[],profiles:[]};
  if($("panelVersion")) $("panelVersion").textContent=window.APP_CONFIG.version||"v2.1.3";

  const leaderRole={bishop:"bishop",first_counselor:"first_counselor",second_counselor:"second_counselor"};
  const titleByRole={
    secretary_admin:"Panel del Secretario Administrador",
    secretary:"Panel del Secretario",
    bishop:"Panel del Obispo",
    first_counselor:"Panel del Primer Consejero",
    second_counselor:"Panel del Segundo Consejero"
  };
  const roleText={
    secretary_admin:"Secretario Administrador",
    secretary:"Secretario",
    bishop:"Obispo",
    first_counselor:"Primer Consejero",
    second_counselor:"Segundo Consejero",
    unassigned:"Sin rol"
  };
  const statusText={
    pending_secretary:"Pendiente de secretario",
    contacted:"Contactado",
    pending_leader:"Pendiente de líder",
    approved:"Aprobado",
    rejected:"Rechazado",
    reschedule:"Reprogramación",
    completed:"Completado",
    cancelled:"Cancelado"
  };
  const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmt=v=>new Intl.DateTimeFormat("es-BO",{timeZone:"America/La_Paz",dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
  const isSecretaryStaff=()=>["secretary_admin","secretary"].includes(state.profile?.role);
  const isSecretaryAdmin=()=>state.profile?.role==="secretary_admin";

  function alertGlobal(msg,type="info"){
    const x=$("globalAlert");
    x.textContent=msg;
    x.className="alert "+type;
  }
  function clearGlobalAlert(){
    $("globalAlert").className="alert hidden";
    $("globalAlert").textContent="";
  }
  function leaderForRole(){
    return state.leaders.find(x=>x.code===leaderRole[state.profile?.role]);
  }
  function canManage(a){
    if(isSecretaryStaff()) return true;
    return a.interview_types?.leaders?.code===leaderRole[state.profile?.role];
  }

  function hideAuthLoading(){const v=$("authLoadingView");if(v)v.classList.add("hidden");}
  function showLogin(){
    hideAuthLoading();
    $("loginView").classList.remove("hidden");
    $("unauthorizedView").classList.add("hidden");
    $("dashboard").classList.add("hidden");
  }
  function showUnauthorized(){
    hideAuthLoading();
    $("loginView").classList.add("hidden");
    $("dashboard").classList.add("hidden");
    $("unauthorizedView").classList.remove("hidden");
  }

  async function enterAuthenticated(session){
    state.user=session.user;
    const {data:profile,error}=await db.from("profiles").select("role,display_name,is_active").eq("id",session.user.id).maybeSingle();
    if(error||!profile?.role||profile.is_active===false){showUnauthorized();return;}

    state.profile=profile;
    hideAuthLoading();
    $("loginView").classList.add("hidden");
    $("unauthorizedView").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("userAdminCard").classList.toggle("hidden",!isSecretaryAdmin());

    $("roleTitle").textContent=titleByRole[profile.role]||"Panel";
    $("roleSubtitle").textContent=isSecretaryAdmin()
      ?"Administración general: usuarios, solicitudes y horarios de todos los líderes."
      : profile.role==="secretary"
        ?"Revisa solicitudes y administra los horarios de todos los líderes."
        :"Revisa tus solicitudes y administra tus propios horarios.";

    const {data:settings}=await db.from("settings").select("unit_name").eq("id",1).maybeSingle();
    if(settings?.unit_name)$("panelUnit").textContent=settings.unit_name;
    await refresh();
  }

  async function boot(){
    setInitialMonth();
    try{
      const {data:{session},error}=await db.auth.getSession();
      if(error||!session){showLogin();return;}
      await enterAuthenticated(session);
    }catch(err){
      console.error(err);
      showLogin();
    }
  }

  async function refresh(){
    clearGlobalAlert();
    const requests=[
      db.from("leaders").select("id,code,title,sort_order").eq("is_active",true).order("sort_order"),
      db.from("appointments").select("id,status,member_name,member_phone,member_email,created_at,availability(id,start_at,end_at,leader_id),interview_types(id,name,leaders(id,code,title))").order("created_at",{ascending:false}),
      db.from("availability").select("id,leader_id,start_at,end_at,is_active,is_booked,leaders(id,code,title)").gte("start_at",new Date(Date.now()-86400000).toISOString()).order("start_at")
    ];
    if(isSecretaryAdmin()){
      requests.push(db.from("profiles").select("id,email,display_name,role,is_active,created_at").order("created_at",{ascending:true}));
    }

    const results=await Promise.all(requests);
    const [l,a,s,p]=results;
    if(l.error||a.error||s.error||(p&&p.error)){
      alertGlobal("No se pudieron cargar todos los datos del panel.","error");
      return;
    }

    state.leaders=l.data||[];
    state.appointments=a.data||[];
    state.schedule=s.data||[];
    state.profiles=p?.data||[];

    if(isSecretaryStaff()){
      $("leaderSelectorWrap").classList.remove("hidden");
      const current=$("scheduleLeader").value;
      $("scheduleLeader").innerHTML=state.leaders.map(x=>`<option value="${x.id}">${e(x.title)}</option>`).join("");
      if(current&&state.leaders.some(x=>x.id===current)) $("scheduleLeader").value=current;
    }else{
      $("leaderSelectorWrap").classList.add("hidden");
    }

    renderStats();
    renderAppointments();
    renderSchedule();
    if(isSecretaryAdmin()) renderUsers();
  }

  function renderStats(){
    const rows=state.appointments.filter(canManage);
    const open=rows.filter(x=>!["completed","cancelled","rejected"].includes(x.status)).length;
    const approved=rows.filter(x=>x.status==="approved").length;
    const relevantSchedules=state.schedule.filter(x=>isSecretaryStaff()||x.leaders?.code===leaderRole[state.profile.role]);
    $("stats").innerHTML=`
      <div class="stat"><span>Total</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>En curso</span><strong>${open}</strong></div>
      <div class="stat"><span>Aprobadas</span><strong>${approved}</strong></div>
      <div class="stat"><span>Horarios</span><strong>${relevantSchedules.length}</strong></div>
    `;
  }

  function actions(a){
    if(!canManage(a))return "";
    if(isSecretaryStaff()){
      if(a.status==="pending_secretary"){
        return `<button data-id="${a.id}" data-status="contacted">Contactado</button><button data-id="${a.id}" data-status="rejected" class="danger">Rechazar</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
      }
      if(a.status==="contacted"){
        return `<button data-id="${a.id}" data-status="pending_leader" class="primary">Enviar al líder</button><button data-id="${a.id}" data-status="reschedule">Reprogramar</button><button data-id="${a.id}" data-status="rejected" class="danger">Rechazar</button>`;
      }
      if(a.status==="pending_leader"){
        return `<button data-id="${a.id}" data-status="reschedule">Reprogramar</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
      }
      if(a.status==="approved"){
        return `<button data-id="${a.id}" data-status="completed" class="primary">Completar</button><button data-id="${a.id}" data-status="reschedule">Reprogramar</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
      }
      if(a.status==="reschedule"){
        return `<button data-id="${a.id}" data-status="pending_secretary" class="primary">Volver a revisión</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
      }
      return "";
    }
    if(a.status==="pending_leader"){
      return `<button data-id="${a.id}" data-status="approved" class="primary">Aprobar</button><button data-id="${a.id}" data-status="reschedule">Reprogramar</button><button data-id="${a.id}" data-status="rejected" class="danger">Rechazar</button>`;
    }
    if(a.status==="approved"){
      return `<button data-id="${a.id}" data-status="completed" class="primary">Completar</button><button data-id="${a.id}" data-status="reschedule">Reprogramar</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
    }
    return "";
  }

  function renderAppointments(){
    const f=$("statusFilter").value;
    const rows=state.appointments.filter(a=>canManage(a)&&(f==="all"||a.status===f));
    const list=$("requestsList");
    $("requestsHint").textContent=`${rows.length} solicitud(es) visibles`;
    list.innerHTML=rows.length?rows.map(a=>`
      <article class="request-item">
        <div class="request-top">
          <div>
            <h3>${e(a.member_name)}</h3>
            <div class="request-meta">
              ${e(a.interview_types?.name||"Entrevista")} · ${e(a.interview_types?.leaders?.title||"")}<br>
              ${a.availability?.start_at?e(fmt(a.availability.start_at)):"Sin horario"}<br>
              ${e(a.member_phone)}${a.member_email?" · "+e(a.member_email):""}
            </div>
          </div>
          <span class="badge ${e(a.status)}">${e(statusText[a.status]||a.status)}</span>
        </div>
        <div class="actions">${actions(a)}</div>
      </article>
    `).join(""):'<div class="empty">No hay solicitudes para este filtro.</div>';

    list.querySelectorAll("button[data-id]").forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      const {error}=await db.from("appointments").update({status:b.dataset.status}).eq("id",b.dataset.id);
      b.disabled=false;
      if(error) alertGlobal(error.message||"No se pudo actualizar la solicitud.","error");
      else{alertGlobal("Solicitud actualizada.","success");await refresh();}
    });
  }

  function renderUsers(){
    const list=$("usersList");
    const rows=state.profiles.filter(x=>x.role!=="unassigned");
    $("usersCount").textContent=rows.length+" usuario(s)";
    list.innerHTML=rows.length?rows.map(x=>
      '<div class="user-row">' +
        '<div><strong>' + e(x.display_name||x.email||"Usuario") + '</strong><small>' + e(x.email||"Sin correo") + '</small></div>' +
        '<div class="user-row-right">' +
          '<span class="role-pill">' + e(roleText[x.role]||x.role) + '</span>' +
          '<span class="' + (x.is_active?"status-active":"status-inactive") + '">' + (x.is_active?"Activo":"Inactivo") + '</span>' +
          '<button class="edit-user-button" type="button" data-edit-user="' + e(x.id) + '">Editar</button>' +
        '</div>' +
      '</div>'
    ).join(""):'<div class="empty">No hay usuarios configurados.</div>';

    list.querySelectorAll("[data-edit-user]").forEach(button=>{
      button.onclick=()=>openUserEditor(button.dataset.editUser);
    });
  }

  function openUserEditor(userId){
    if(!isSecretaryAdmin()) return;
    const user=state.profiles.find(x=>x.id===userId);
    if(!user) return;
    $("editUserId").value=user.id;
    $("editUserName").value=user.display_name||"";
    $("editUserEmail").value=user.email||"";
    $("editUserRole").value=user.role;
    $("editUserActive").checked=Boolean(user.is_active);
    $("editUserTitle").textContent=user.display_name||user.email||"Usuario";
    $("editUserResult").className="alert hidden";
    $("userEditPanel").classList.remove("hidden");
    $("userEditPanel").scrollIntoView({behavior:"smooth",block:"center"});
  }

  function closeUserEditor(){
    $("userEditPanel").classList.add("hidden");
    $("editUserForm").reset();
    $("editUserResult").className="alert hidden";
  }
  function selectedLeaderId(){
    return isSecretaryStaff()?$("scheduleLeader").value:leaderForRole()?.id;
  }

  function setInitialMonth(){
    const now=new Date();
    const y=now.getFullYear();
    const m=String(now.getMonth()+1).padStart(2,"0");
    $("scheduleMonth").value=`${y}-${m}`;
    populateWeeks();
  }


  function dateKeyUTC(date){
    return date.toISOString().slice(0,10);
  }

  function shortDateUTC(date){
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"UTC",
      day:"numeric",
      month:"short"
    }).format(date).replace(".","");
  }

  function longWeekdayDateUTC(date){
    return new Intl.DateTimeFormat("es-BO",{
      timeZone:"UTC",
      weekday:"short",
      day:"numeric",
      month:"short"
    }).format(date).replace(".","");
  }

  function populateWeeks(){
    const value=$("scheduleMonth").value;
    if(!value)return;

    const [year,month]=value.split("-").map(Number);
    const firstOfMonth=new Date(Date.UTC(year,month-1,1));
    const lastOfMonth=new Date(Date.UTC(year,month,0));

    const firstDow=firstOfMonth.getUTCDay();
    const daysBackToMonday=(firstDow+6)%7;
    const firstMonday=new Date(firstOfMonth);
    firstMonday.setUTCDate(firstMonday.getUTCDate()-daysBackToMonday);

    const weeks=[];
    let cursor=new Date(firstMonday);
    let weekNumber=1;

    while(cursor<=lastOfMonth){
      const weekStart=new Date(cursor);
      const weekEnd=new Date(cursor);
      weekEnd.setUTCDate(weekEnd.getUTCDate()+6);

      weeks.push({
        value:dateKeyUTC(weekStart),
        label:`Semana ${weekNumber} · ${shortDateUTC(weekStart)}–${shortDateUTC(weekEnd)}`
      });

      cursor.setUTCDate(cursor.getUTCDate()+7);
      weekNumber++;
    }

    $("scheduleWeek").innerHTML=weeks.map(w=>
      `<option value="${w.value}">${e(w.label)}</option>`
    ).join("");

    updateScheduleSummary();
  }

  function selectedWeekdays(){
    return [...document.querySelectorAll('input[name="weekday"]:checked')].map(x=>Number(x.value));
  }

  function selectedDatesForWeek(){
    const weekStartValue=$("scheduleWeek").value;
    const weekdays=selectedWeekdays();
    if(!weekStartValue||!weekdays.length) return [];

    const weekStart=new Date(weekStartValue+"T00:00:00Z");
    const dates=[];

    for(let i=0;i<7;i++){
      const d=new Date(weekStart);
      d.setUTCDate(d.getUTCDate()+i);
      if(weekdays.includes(d.getUTCDay())) dates.push(d);
    }
    return dates;
  }

  function updateScheduleSummary(){
    const weekLabel=$("scheduleWeek").selectedOptions[0]?.textContent||"";
    const dates=selectedDatesForWeek();
    const from=$("scheduleStartTime").value;
    const to=$("scheduleEndTime").value;
    const duration=$("scheduleDuration").value;

    if(dates.length&&from&&to){
      $("scheduleSummary").textContent=
        `${weekLabel}: ${dates.map(longWeekdayDateUTC).join(", ")} · ${from}–${to} · cada ${duration} min.`;
    }else{
      $("scheduleSummary").textContent="Selecciona la semana, los días y el rango horario.";
    }
  }

  function buildWeeklySlots(){
    const leader_id=selectedLeaderId();
    const weekStartValue=$("scheduleWeek").value;
    const weekdays=selectedWeekdays();
    const startTime=$("scheduleStartTime").value;
    const endTime=$("scheduleEndTime").value;
    const duration=Number($("scheduleDuration").value||30);

    if(!leader_id||!weekStartValue||!weekdays.length||!startTime||!endTime){
      throw new Error("Completa líder, semana, días y rango horario.");
    }

    const [sh,sm]=startTime.split(":").map(Number);
    const [eh,em]=endTime.split(":").map(Number);
    const startMinutes=sh*60+sm;
    const endMinutes=eh*60+em;

    if(endMinutes<=startMinutes) throw new Error("La hora final debe ser posterior a la hora inicial.");
    if(duration<10||duration>180) throw new Error("Duración no válida.");

    const weekStart=new Date(weekStartValue+"T00:00:00Z");
    const slots=[];
    const now=Date.now();

    for(let i=0;i<7;i++){
      const dayDate=new Date(weekStart);
      dayDate.setUTCDate(dayDate.getUTCDate()+i);
      if(!weekdays.includes(dayDate.getUTCDay())) continue;

      const year=dayDate.getUTCFullYear();
      const month=dayDate.getUTCMonth()+1;
      const day=dayDate.getUTCDate();

      for(let minutes=startMinutes;minutes+duration<=endMinutes;minutes+=duration){
        const hh=String(Math.floor(minutes/60)).padStart(2,"0");
        const mm=String(minutes%60).padStart(2,"0");
        const end=minutes+duration;
        const ehh=String(Math.floor(end/60)).padStart(2,"0");
        const emm=String(end%60).padStart(2,"0");
        const dd=String(day).padStart(2,"0");
        const mon=String(month).padStart(2,"0");

        const start_at=new Date(`${year}-${mon}-${dd}T${hh}:${mm}:00-04:00`).toISOString();
        const end_at=new Date(`${year}-${mon}-${dd}T${ehh}:${emm}:00-04:00`).toISOString();

        if(new Date(start_at).getTime()<=now) continue;
        slots.push({leader_id,start_at,end_at,is_active:true});
      }
    }

    return slots;
  }

  function renderSchedule(){
    const id=selectedLeaderId();
    const rows=state.schedule.filter(x=>x.leader_id===id);
    const list=$("scheduleList");
    $("scheduleCount").textContent=`${rows.length} horario(s)`;
    list.innerHTML=rows.length?rows.map(x=>`
      <div class="slot-row">
        <div>
          <strong>${e(fmt(x.start_at))}</strong><br>
          <small>${x.is_booked?"Ocupado / solicitado":x.is_active?"Disponible":"Desactivado"}</small>
        </div>
        ${x.is_booked?"":`<button data-slot="${x.id}" data-active="${x.is_active?"0":"1"}">${x.is_active?"Desactivar":"Activar"}</button>`}
      </div>
    `).join(""):'<div class="empty">No hay horarios cargados para este líder.</div>';

    list.querySelectorAll("button[data-slot]").forEach(b=>b.onclick=async()=>{
      const {error}=await db.from("availability").update({is_active:b.dataset.active==="1"}).eq("id",b.dataset.slot);
      if(error)alertGlobal(error.message||"No se pudo cambiar el horario.","error");
      else await refresh();
    });
  }

  $("loginForm").onsubmit=async ev=>{
    ev.preventDefault();
    const form=ev.currentTarget,button=form.querySelector('button[type="submit"]');
    $("loginError").classList.add("hidden");
    button.disabled=true;button.textContent="Ingresando…";
    const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
    button.disabled=false;button.textContent="Ingresar";
    if(error){
      $("loginError").textContent="Correo o contraseña incorrectos.";
      $("loginError").classList.remove("hidden");
      return;
    }
    if(data?.session) await enterAuthenticated(data.session);
  };

  $("userForm").onsubmit=async ev=>{
    ev.preventDefault();
    if(!isSecretaryAdmin()) return;
    const form=ev.currentTarget;
    const button=$("createUserBtn");
    const result=$("userCreateResult");
    result.className="alert hidden";
    button.disabled=true;button.textContent="Creando…";

    const display_name=$("userDisplayName").value.trim();
    const email=$("userEmail").value.trim().toLowerCase();
    const role=$("userRole").value;
    const password=$("userPassword").value;

    try{
      const {data,error}=await signupClient.auth.signUp({
        email,
        password,
        options:{data:{full_name:display_name}}
      });
      if(error) throw error;
      if(!data?.user?.id) throw new Error("No se pudo crear el usuario.");

      const {error:roleError}=await db.rpc("secretary_admin_assign_role",{
        p_user_id:data.user.id,
        p_role:role,
        p_display_name:display_name
      });
      if(roleError) throw new Error("El usuario fue creado, pero no se pudo asignar el rol. Puede que el correo ya exista.");

      result.textContent=data.session
        ?"Usuario creado y listo para iniciar sesión."
        :"Usuario creado. Supabase puede requerir que confirme su correo antes del primer ingreso.";
      result.className="alert success";
      form.reset();
      $("userRole").value="bishop";
      $("userPassword").type="password";
      $("toggleUserPassword").textContent="Mostrar";
      await refresh();
    }catch(err){
      result.textContent=err?.message||"No se pudo crear el usuario.";
      result.className="alert error";
    }finally{
      button.disabled=false;button.textContent="Crear usuario";
    }
  };

  $("editUserForm").onsubmit=async ev=>{
    ev.preventDefault();
    if(!isSecretaryAdmin()) return;
    const button=$("saveEditUser");
    const result=$("editUserResult");
    button.disabled=true;
    button.textContent="Guardando…";
    result.className="alert hidden";

    const {error}=await db.rpc("secretary_admin_update_profile",{
      p_user_id:$("editUserId").value,
      p_display_name:$("editUserName").value.trim(),
      p_role:$("editUserRole").value,
      p_is_active:$("editUserActive").checked
    });

    button.disabled=false;
    button.textContent="Guardar cambios";

    if(error){
      result.textContent=error.message||"No se pudieron guardar los cambios.";
      result.className="alert error";
      return;
    }

    result.textContent="Usuario actualizado correctamente.";
    result.className="alert success";
    await refresh();
    setTimeout(closeUserEditor,700);
  };

  $("cancelEditUser").onclick=closeUserEditor;
  $("cancelEditUserTop").onclick=closeUserEditor;
  $("toggleUserPassword").onclick=()=>{
    const input=$("userPassword");
    const show=input.type==="password";
    input.type=show?"text":"password";
    $("toggleUserPassword").textContent=show?"Ocultar":"Mostrar";
  };

  async function logout(){
    await db.auth.signOut();
    state.user=null;state.profile=null;
    showLogin();
  }

  $("logoutBtn").onclick=logout;
  $("unauthorizedLogout").onclick=logout;
  $("refreshBtn").onclick=refresh;
  $("statusFilter").onchange=renderAppointments;
  $("scheduleLeader").onchange=renderSchedule;
  $("scheduleMonth").onchange=()=>{populateWeeks();updateScheduleSummary();};
  $("scheduleWeek").onchange=updateScheduleSummary;
  $("scheduleStartTime").oninput=updateScheduleSummary;
  $("scheduleEndTime").oninput=updateScheduleSummary;
  $("scheduleDuration").onchange=updateScheduleSummary;
  document.querySelectorAll('input[name="weekday"]').forEach(x=>x.onchange=updateScheduleSummary);

  $("scheduleForm").onsubmit=async ev=>{
    ev.preventDefault();
    let slots=[];
    try{
      slots=buildWeeklySlots();
      if(!slots.length) throw new Error("No se generaron horarios futuros con esa selección.");
    }catch(err){
      alertGlobal(err.message||"Revisa la configuración de horarios.","error");
      return;
    }

    const button=ev.currentTarget.querySelector('button[type="submit"]');
    button.disabled=true;button.textContent="Generando…";
    const {data,error}=await db.from("availability")
      .upsert(slots,{onConflict:"leader_id,start_at",ignoreDuplicates:true})
      .select("id");
    button.disabled=false;button.textContent="Generar horarios de la semana";

    if(error){
      alertGlobal(error.message||"No se pudieron generar los horarios.","error");
      return;
    }
    alertGlobal(`Horarios generados: ${data?.length||0}. Los duplicados existentes se omitieron.`,"success");
    await refresh();
  };

  db.auth.onAuthStateChange((event)=>{
    if(event==="SIGNED_OUT"){
      state.user=null;state.profile=null;
      showLogin();
    }
  });

  boot();
})();