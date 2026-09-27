(() => {
  const db = window.supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabasePublishableKey);
  const state = { leaders: [], selectedLeader: null };
  if ($("appVersion")) $("appVersion").textContent = window.APP_CONFIG.version || "v2.0.2";
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  function formatSlot(value) {
    return new Intl.DateTimeFormat("es-BO", {timeZone:"America/La_Paz",weekday:"long",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  }
  function showError(message) { $("bookingError").textContent = message; $("bookingError").classList.remove("hidden"); }
  function clearError() { $("bookingError").classList.add("hidden"); $("bookingError").textContent = ""; }
  async function loadSettings() {
    const { data } = await db.from("settings").select("unit_name,allow_public_booking").eq("id", 1).maybeSingle();
    if (data?.unit_name) $("unitName").textContent = data.unit_name;
    if (data && data.allow_public_booking === false) document.querySelector(".card").innerHTML = '<div class="empty">Las reservas públicas están temporalmente deshabilitadas.</div>';
  }
  async function loadLeaders() {
    const { data, error } = await db.from("leaders").select("id,code,title,sort_order").eq("is_active", true).order("sort_order");
    if (error) { $("leaderGrid").innerHTML = '<div class="empty">No se pudieron cargar los líderes.</div>'; return; }
    state.leaders = data || []; $("leaderGrid").innerHTML = "";
    for (const leader of state.leaders) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "leader-card"; button.dataset.leaderId = leader.id;
      button.innerHTML = `<strong>${escapeHtml(leader.title)}</strong><span>Ver entrevistas y horarios disponibles</span>`;
      button.addEventListener("click", () => selectLeader(leader, button));
      $("leaderGrid").appendChild(button);
    }
    if (!state.leaders.length) $("leaderGrid").innerHTML = '<div class="empty">No hay líderes activos en este momento.</div>';
  }
  async function selectLeader(leader, button) {
    clearError(); state.selectedLeader = leader;
    document.querySelectorAll(".leader-card").forEach((el) => el.classList.remove("active")); button.classList.add("active");
    const [typesResult, slotsResult] = await Promise.all([
      db.from("interview_types").select("id,name,sort_order").eq("leader_id", leader.id).eq("is_active", true).order("sort_order"),
      db.from("availability").select("id,start_at,end_at").eq("leader_id", leader.id).eq("is_active", true).eq("is_booked", false).gt("start_at", new Date().toISOString()).order("start_at")
    ]);
    const typeSelect = $("interviewType"), slotSelect = $("slotSelect");
    typeSelect.innerHTML = typesResult.error ? '<option value="">No disponible</option>' : (typesResult.data || []).map((x) => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
    slotSelect.innerHTML = slotsResult.error || !(slotsResult.data || []).length ? '<option value="">No hay horarios disponibles</option>' : '<option value="">Selecciona una hora</option>' + slotsResult.data.map((x) => `<option value="${x.id}">${escapeHtml(formatSlot(x.start_at))}</option>`).join("");
    $("bookingForm").classList.remove("hidden"); $("bookingForm").scrollIntoView({behavior:"smooth",block:"start"});
  }
  $("bookingForm").addEventListener("submit", async (event) => {
    event.preventDefault(); clearError();
    const interviewTypeId=$("interviewType").value, availabilityId=$("slotSelect").value, memberName=$("memberName").value.trim(), memberPhone=$("memberPhone").value.trim(), memberEmail=$("memberEmail").value.trim()||null;
    if (!state.selectedLeader || !interviewTypeId || !availabilityId) return showError("Selecciona un líder, tipo de entrevista y horario.");
    const submit=$("submitBooking"); submit.disabled=true; submit.textContent="Enviando...";
    const { error }=await db.from("appointments").insert({availability_id:availabilityId,interview_type_id:interviewTypeId,member_name:memberName,member_phone:memberPhone,member_email:memberEmail});
    submit.disabled=false; submit.textContent="Enviar solicitud";
    if (error) {
      if (error.code==="23505" || String(error.message||"").toLowerCase().includes("unique")) {
        showError("Ese horario acaba de ser solicitado por otra persona. Elige otro horario.");
        const activeButton=document.querySelector(`[data-leader-id="${state.selectedLeader.id}"]`); if(activeButton) await selectLeader(state.selectedLeader,activeButton);
      } else showError("No se pudo enviar la solicitud. Revisa los datos e inténtalo nuevamente.");
      return;
    }
    document.querySelector("main .card").classList.add("hidden"); $("successBox").classList.remove("hidden"); $("successBox").scrollIntoView({behavior:"smooth"});
  });
  $("newRequestBtn").addEventListener("click", () => location.reload());
  loadSettings(); loadLeaders();
})();