(() => {
  const $ = id => document.getElementById(id);
  const db = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabasePublishableKey
  );

  const state = {
    leaders: [],
    selectedLeader: null,
    interviewTypes: [],
    slots: [],
    selectedDateKey: null,
    selectedSlot: null
  };

  if ($("appVersion")) $("appVersion").textContent = window.APP_CONFIG.version || "v2.3.0";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function dateKeyBolivia(value) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone:"America/La_Paz",
      year:"numeric",
      month:"2-digit",
      day:"2-digit"
    }).format(new Date(value));
  }

  function longDateFromKey(key) {
    const [y,m,d] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-BO", {
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric"
    }).format(new Date(y,m-1,d)).replace(/^./, c => c.toUpperCase());
  }

  function dayButtonParts(key) {
    const [y,m,d] = key.split("-").map(Number);
    const date = new Date(y,m-1,d);
    return {
      weekday: new Intl.DateTimeFormat("es-BO",{weekday:"long"}).format(date).replace(/^./,c=>c.toUpperCase()),
      date: new Intl.DateTimeFormat("es-BO",{day:"numeric",month:"short"}).format(date).replace(".","")
    };
  }

  function timeLabel(value) {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone:"America/La_Paz",
      hour:"2-digit",
      minute:"2-digit"
    }).format(new Date(value));
  }

  function fullSlotLabel(value) {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone:"America/La_Paz",
      weekday:"long",
      day:"numeric",
      month:"long",
      hour:"2-digit",
      minute:"2-digit"
    }).format(new Date(value));
  }

  function showError(message) {
    $("bookingError").textContent = message;
    $("bookingError").classList.remove("hidden");
  }

  function clearError() {
    $("bookingError").classList.add("hidden");
    $("bookingError").textContent = "";
  }

  async function loadSettings() {
    const {data} = await db.from("settings")
      .select("unit_name,allow_public_booking")
      .eq("id",1)
      .maybeSingle();

    if (data?.unit_name) $("unitName").textContent = data.unit_name;

    if (data && data.allow_public_booking === false) {
      $("bookingCard").innerHTML = '<div class="empty">Las reservas públicas están temporalmente deshabilitadas.</div>';
    }
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

    if (!state.leaders.length) {
      $("leaderGrid").innerHTML = '<div class="empty">No hay líderes activos en este momento.</div>';
    }
  }

  async function selectLeader(leader,button) {
    clearError();
    state.selectedLeader = leader;
    state.selectedDateKey = null;
    state.selectedSlot = null;

    document.querySelectorAll(".leader-card").forEach(el => el.classList.remove("active"));
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
    state.slots.forEach(slot => {
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

    $("availableDays").innerHTML = groups.map(([key,slots]) => {
      const part = dayButtonParts(key);
      const active = state.selectedDateKey===key ? " selected" : "";
      return '<button type="button" class="available-day-button'+active+'" data-date="'+key+'">'+
        '<strong>'+escapeHtml(part.weekday)+'</strong>'+
        '<span>'+escapeHtml(part.date)+'</span>'+
        '<small>'+slots.length+' hora'+(slots.length===1?"":"s")+'</small>'+
      '</button>';
    }).join("");

    $("availableDays").querySelectorAll("[data-date]").forEach(button => {
      button.onclick = () => selectDay(button.dataset.date);
    });
  }

  function selectDay(key) {
    state.selectedDateKey = key;
    state.selectedSlot = null;
    renderAvailableDays();

    const rows = state.slots.filter(slot=>dateKeyBolivia(slot.start_at)===key);
    $("publicSelectedDate").textContent = longDateFromKey(key);
    $("publicTimeSlots").innerHTML = rows.map(slot =>
      '<button class="time-slot-button" type="button" data-slot="'+slot.id+'">'+
        escapeHtml(timeLabel(slot.start_at))+
      '</button>'
    ).join("");

    $("publicTimeSlots").querySelectorAll("[data-slot]").forEach(button => {
      button.onclick = () => {
        const slot = rows.find(x=>x.id===button.dataset.slot);
        state.selectedSlot = slot || null;
        document.querySelectorAll(".time-slot-button").forEach(x=>x.classList.remove("selected"));
        button.classList.add("selected");
        $("selectedSlotSummary").textContent = slot
          ? "Horario elegido: "+fullSlotLabel(slot.start_at)
          : "Selecciona primero un día y una hora.";
      };
    });

    $("publicDayPanel").classList.remove("hidden");
    $("publicDayPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  $("bookingForm").addEventListener("submit", async event => {
    event.preventDefault();
    clearError();

    const interviewTypeId = $("interviewType").value;
    const availabilityId = state.selectedSlot?.id;
    const memberName = $("memberName").value.trim();
    const memberPhone = $("memberPhone").value.trim();
    const memberEmail = $("memberEmail").value.trim() || null;

    if (!state.selectedLeader || !interviewTypeId || !availabilityId) {
      showError("Selecciona un líder, tipo de entrevista, día y hora.");
      return;
    }

    const submit = $("submitBooking");
    submit.disabled = true;
    submit.textContent = "Enviando...";

    const {error} = await db.from("appointments").insert({
      availability_id:availabilityId,
      interview_type_id:interviewTypeId,
      member_name:memberName,
      member_phone:memberPhone,
      member_email:memberEmail
    });

    submit.disabled = false;
    submit.textContent = "Enviar solicitud";

    if (error) {
      if (error.code==="23505" || String(error.message||"").toLowerCase().includes("unique")) {
        showError("Ese horario acaba de ser solicitado por otra persona. Elige otro horario.");
        const activeButton = document.querySelector('[data-leader-id="'+state.selectedLeader.id+'"]');
        if (activeButton) await selectLeader(state.selectedLeader,activeButton);
      } else {
        showError("No se pudo enviar la solicitud. Revisa los datos e inténtalo nuevamente.");
      }
      return;
    }

    $("bookingCard").classList.add("hidden");
    $("successBox").classList.remove("hidden");
    $("successBox").scrollIntoView({behavior:"smooth"});
  });

  $("newRequestBtn").onclick = () => location.reload();

  loadSettings();
  loadLeaders();
})();
