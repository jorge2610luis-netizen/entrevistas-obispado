(() => {
  const db=window.supabase.createClient(window.APP_CONFIG.supabaseUrl,window.APP_CONFIG.supabasePublishableKey);
  const $=id=>document.getElementById(id);
  const state={user:null,profile:null,leaders:[],appointments:[],schedule:[]};
  if($("panelVersion")) $("panelVersion").textContent=window.APP_CONFIG.version||"v2.0.2";
  const leaderRole={bishop:"bishop",first_counselor:"first_counselor",second_counselor:"second_counselor"};
  const titleByRole={secretary:"Panel del Secretario",bishop:"Panel del Obispo",first_counselor:"Panel del Primer Consejero",second_counselor:"Panel del Segundo Consejero"};
  const statusText={pending_secretary:"Pendiente de secretario",contacted:"Contactado",pending_leader:"Pendiente de líder",approved:"Aprobado",rejected:"Rechazado",reschedule:"Reprogramación",completed:"Completado",cancelled:"Cancelado"};
  const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const fmt=v=>new Intl.DateTimeFormat("es-BO",{timeZone:"America/La_Paz",dateStyle:"medium",timeStyle:"short"}).format(new Date(v));
  function alert(msg,type="info"){const x=$("globalAlert");x.textContent=msg;x.className="alert "+type;}
  function clearAlert(){$("globalAlert").className="alert hidden";$("globalAlert").textContent="";}
  function leaderForRole(){return state.leaders.find(x=>x.code===leaderRole[state.profile.role]);}
  function canManage(a){if(state.profile.role==="secretary")return true;return a.interview_types?.leaders?.code===leaderRole[state.profile.role];}
  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session){showLogin();return;} state.user=session.user;
    const {data:profile,error}=await db.from("profiles").select("role,display_name,is_active").eq("id",session.user.id).maybeSingle();
    if(error||!profile?.role||profile.is_active===false){$("loginView").classList.add("hidden");$("unauthorizedView").classList.remove("hidden");return;}
    state.profile=profile;$("loginView").classList.add("hidden");$("dashboard").classList.remove("hidden");
    $("roleTitle").textContent=titleByRole[profile.role]||"Panel"; $("roleSubtitle").textContent=profile.role==="secretary"?"Revisa solicitudes y administra los horarios de todos los líderes.":"Revisa tus solicitudes y administra tus propios horarios.";
    const {data:settings}=await db.from("settings").select("unit_name").eq("id",1).maybeSingle();if(settings?.unit_name)$("panelUnit").textContent=settings.unit_name;
    await refresh();
  }
  function showLogin(){$("loginView").classList.remove("hidden");$("dashboard").classList.add("hidden");}
  async function refresh(){
    clearAlert();
    const [l,a,s]=await Promise.all([
      db.from("leaders").select("id,code,title,sort_order").eq("is_active",true).order("sort_order"),
      db.from("appointments").select("id,status,member_name,member_phone,member_email,created_at,availability(id,start_at,end_at,leader_id),interview_types(id,name,leaders(id,code,title))").order("created_at",{ascending:false}),
      db.from("availability").select("id,leader_id,start_at,end_at,is_active,is_booked,leaders(id,code,title)").gte("start_at",new Date(Date.now()-86400000).toISOString()).order("start_at")
    ]);
    if(l.error||a.error||s.error){alert("No se pudieron cargar todos los datos del panel.","error");return;}
    state.leaders=l.data||[];state.appointments=a.data||[];state.schedule=s.data||[];
    if(state.profile.role==="secretary"){$("leaderSelectorWrap").classList.remove("hidden");$("scheduleLeader").innerHTML=state.leaders.map(x=>`<option value="${x.id}">${e(x.title)}</option>`).join("");}
    renderStats();renderAppointments();renderSchedule();
  }
  function renderStats(){
    const rows=state.appointments.filter(canManage),open=rows.filter(x=>!["completed","cancelled","rejected"].includes(x.status)).length,approved=rows.filter(x=>x.status==="approved").length;
    $("stats").innerHTML=`<div class="stat"><span>Total</span><strong>${rows.length}</strong></div><div class="stat"><span>En curso</span><strong>${open}</strong></div><div class="stat"><span>Aprobadas</span><strong>${approved}</strong></div><div class="stat"><span>Horarios</span><strong>${state.schedule.filter(x=>state.profile.role==="secretary"||x.leaders?.code===leaderRole[state.profile.role]).length}</strong></div>`;
  }
  function actions(a){
    if(!canManage(a))return "";
    if(state.profile.role==="secretary"&&a.status==="pending_secretary")return `<button data-id="${a.id}" data-status="contacted">Contactado</button><button data-id="${a.id}" data-status="pending_leader" class="primary">Enviar al líder</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
    if(state.profile.role!=="secretary"&&a.status==="pending_leader")return `<button data-id="${a.id}" data-status="approved" class="primary">Aprobar</button><button data-id="${a.id}" data-status="reschedule">Reprogramar</button><button data-id="${a.id}" data-status="rejected" class="danger">Rechazar</button>`;
    if(a.status==="approved")return `<button data-id="${a.id}" data-status="completed" class="primary">Completar</button><button data-id="${a.id}" data-status="cancelled" class="danger">Cancelar</button>`;
    return "";
  }
  function renderAppointments(){
    const f=$("statusFilter").value,rows=state.appointments.filter(a=>canManage(a)&&(f==="all"||a.status===f)),list=$("requestsList");
    $("requestsHint").textContent=`${rows.length} solicitud(es) visibles`;
    list.innerHTML=rows.length?rows.map(a=>`<article class="request-item"><div class="request-top"><div><h3>${e(a.member_name)}</h3><div class="request-meta">${e(a.interview_types?.name||"Entrevista")} · ${e(a.interview_types?.leaders?.title||"") }<br>${a.availability?.start_at?e(fmt(a.availability.start_at)):"Sin horario"}<br>${e(a.member_phone)}${a.member_email?" · "+e(a.member_email):""}</div></div><span class="badge ${e(a.status)}">${e(statusText[a.status]||a.status)}</span></div><div class="actions">${actions(a)}</div></article>`).join(""):'<div class="empty">No hay solicitudes para este filtro.</div>';
    list.querySelectorAll("button[data-id]").forEach(b=>b.onclick=async()=>{const {error}=await db.from("appointments").update({status:b.dataset.status}).eq("id",b.dataset.id);if(error)alert(error.message||"No se pudo actualizar la solicitud.","error");else{alert("Solicitud actualizada.","success");await refresh();}});
  }
  function selectedLeaderId(){return state.profile.role==="secretary"?$("scheduleLeader").value:leaderForRole()?.id;}
  function renderSchedule(){
    const id=selectedLeaderId(),rows=state.schedule.filter(x=>x.leader_id===id),list=$("scheduleList");
    list.innerHTML=rows.length?rows.map(x=>`<div class="slot-row"><div><strong>${e(fmt(x.start_at))}</strong><br><small>${x.is_booked?"Ocupado / solicitado":x.is_active?"Disponible":"Desactivado"}</small></div>${x.is_booked?"":`<button data-slot="${x.id}" data-active="${x.is_active?"0":"1"}">${x.is_active?"Desactivar":"Activar"}</button>`}</div>`).join(""):'<div class="empty">No hay horarios cargados.</div>';
    list.querySelectorAll("button[data-slot]").forEach(b=>b.onclick=async()=>{const {error}=await db.from("availability").update({is_active:b.dataset.active==="1"}).eq("id",b.dataset.slot);if(error)alert(error.message||"No se pudo cambiar el horario.","error");else await refresh();});
  }
  $("loginForm").onsubmit=async ev=>{ev.preventDefault();const {error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error){$("loginError").textContent="Correo o contraseña incorrectos."; $("loginError").classList.remove("hidden");}else location.reload();};
  async function logout(){await db.auth.signOut();location.reload();}
  $("logoutBtn").onclick=logout;$("unauthorizedLogout").onclick=logout;$("refreshBtn").onclick=refresh;$("statusFilter").onchange=renderAppointments;$("scheduleLeader").onchange=renderSchedule;
  $("scheduleForm").onsubmit=async ev=>{ev.preventDefault();const leader_id=selectedLeaderId(),date=$("scheduleDate").value,time=$("scheduleTime").value,duration=Number($("scheduleDuration").value||30);if(!leader_id||!date||!time)return;const start_at=new Date(`${date}T${time}:00-04:00`).toISOString(),end_at=new Date(new Date(start_at).getTime()+duration*60000).toISOString();const {error}=await db.from("availability").insert({leader_id,start_at,end_at,is_active:true});if(error)alert(error.code==="23505"?"Ese horario ya existe.":error.message||"No se pudo guardar.","error");else{$("scheduleForm").reset();alert("Horario agregado.","success");await refresh();}};
  db.auth.onAuthStateChange((_event,session)=>{if(!session&&state.user)location.reload();});boot();
})();