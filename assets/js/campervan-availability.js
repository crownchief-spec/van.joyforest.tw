(() => {
  const app = document.querySelector("[data-campervan-availability]");
  if (!app) return;

  const status = app.querySelector("[data-availability-status]");
  const calendars = app.querySelector("[data-availability-calendars]");
  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  const weekdayLabels = isEnglish ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["一", "二", "三", "四", "五", "六", "日"];
  const statusMeta = {
    open: { label: isEnglish ? "Available" : "可預約", className: "is-open" },
    waitlist: { label: isEnglish ? "Still open" : "可候補", className: "is-waitlist" },
    booked: { label: isEnglish ? "Booked" : "已預訂", className: "is-booked" },
    unavailable: { label: isEnglish ? "Unavailable" : "不可預訂", className: "is-unavailable" },
  };
  const pad = (number) => String(number).padStart(2, "0");
  const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function normalizeDateKeys(values, todayKey) {
    return [...new Set(Array.isArray(values) ? values : [])]
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= todayKey)
      .sort();
  }

  function renderMonth(year, monthIndex, statusByDate, todayKey) {
    const firstDay = new Date(year, monthIndex, 1, 12);
    const daysInMonth = new Date(year, monthIndex + 1, 0, 12).getDate();
    const monthName = new Intl.DateTimeFormat(isEnglish ? "en-US" : "zh-TW", { year: "numeric", month: "long" }).format(firstDay);
    const firstColumn = (firstDay.getDay() + 6) % 7;
    const weekCount = Math.ceil((firstColumn + daysInMonth) / 7);
    const cells = Array.from({ length: weekCount * 7 }, () => '<span class="availability-day is-empty" aria-hidden="true"></span>');

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
      const dayOfWeek = new Date(year, monthIndex, day, 12).getDay();
      const column = (dayOfWeek + 6) % 7;
      const row = Math.floor((firstColumn + day - 1) / 7);
      const isPast = key < todayKey;
      const kind = isPast ? "past" : statusByDate.get(key) || "open";
      const meta = kind === "past" ? null : statusMeta[kind];
      const classes = ["availability-day"];
      if (isPast) classes.push("is-past");
      else classes.push(meta.className);
      if (key === todayKey) classes.push("is-today");
      const spokenStatus = isPast ? (isEnglish ? "Past date" : "日期已過") : meta.label;
      const visibleLabel = isPast ? "" : `<span class="availability-day-label">${meta.label}</span>`;
      const spokenDate = isEnglish ? `${monthName} ${day}, ${spokenStatus}` : `${monthIndex + 1}月${day}日，${spokenStatus}`;
      cells[row * 7 + column] = `<span class="${classes.join(" ")}" aria-label="${spokenDate}"><span class="availability-day-number">${day}</span>${visibleLabel}</span>`;
    }

    return `<section class="availability-month" aria-label="${monthName}"><h3>${monthName}</h3><div class="availability-weekdays" aria-hidden="true">${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}</div><div class="availability-days">${cells.join("")}</div></section>`;
  }

  function renderCalendars(dateGroups) {
    const now = new Date();
    const todayKey = toDateKey(now);
    const minimumEnd = new Date(now.getFullYear(), now.getMonth() + 5, 1, 12);
    const allDates = [...dateGroups.bookedDates, ...dateGroups.waitlistDates, ...dateGroups.unavailableDates].sort();
    const latestMarkedDate = allDates.length ? parseDateKey(allDates[allDates.length - 1]) : minimumEnd;
    const maximumEnd = new Date(now.getFullYear(), now.getMonth() + 11, 1, 12);
    const targetEnd = latestMarkedDate > minimumEnd ? latestMarkedDate : minimumEnd;
    const endMonth = targetEnd > maximumEnd ? maximumEnd : targetEnd;
    const statusByDate = new Map();
    dateGroups.waitlistDates.forEach((key) => statusByDate.set(key, "waitlist"));
    dateGroups.bookedDates.forEach((key) => statusByDate.set(key, "booked"));
    dateGroups.unavailableDates.forEach((key) => statusByDate.set(key, "unavailable"));
    const months = [];

    for (
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1, 12);
      cursor <= new Date(endMonth.getFullYear(), endMonth.getMonth(), 1, 12);
      cursor.setMonth(cursor.getMonth() + 1)
    ) {
      months.push(renderMonth(cursor.getFullYear(), cursor.getMonth(), statusByDate, todayKey));
    }
    calendars.innerHTML = months.join("");
  }

  async function loadAvailability() {
    try {
      const response = await fetch("/assets/data/campervan-availability.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const todayKey = toDateKey(new Date());
      const dateGroups = {
        bookedDates: normalizeDateKeys(data.bookedDates, todayKey),
        waitlistDates: normalizeDateKeys(data.waitlistDates, todayKey),
        unavailableDates: normalizeDateKeys(data.unavailableDates, todayKey),
      };
      renderCalendars(dateGroups);
      status.textContent = isEnglish
        ? "Calendar loaded. Yellow dates have an enquiry but remain open; the first confirmed deposit secures the dates."
        : "已載入露營車行事曆；問號檔期顯示為可候補，仍以完成訂金者優先。";
      status.classList.add("is-ready");
    } catch (error) {
      status.textContent = isEnglish
        ? "The calendar could not be loaded. Please ask us directly on LINE or WhatsApp."
        : "目前無法讀取檔期，請直接用 LINE 或 WhatsApp 詢問。";
      status.classList.add("is-error");
      calendars.hidden = true;
      console.error("Campervan availability failed to load", error);
    }
  }

  loadAvailability();
})();
