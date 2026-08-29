(() => {
  const app = document.querySelector("[data-campervan-availability]");
  if (!app) return;

  const status = app.querySelector("[data-availability-status]");
  const summary = app.querySelector("[data-unavailable-summary]");
  const calendars = app.querySelector("[data-availability-calendars]");
  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const pad = (number) => String(number).padStart(2, "0");
  const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  function parseDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function formatShortDate(key, includeYear = false) {
    return new Intl.DateTimeFormat("zh-TW", {
      ...(includeYear ? { year: "numeric" } : {}),
      month: "numeric",
      day: "numeric",
    }).format(parseDateKey(key));
  }

  function mergeConsecutiveDates(dateKeys) {
    if (!dateKeys.length) return [];
    const ranges = [];
    let start = dateKeys[0];
    let previous = dateKeys[0];

    for (const current of dateKeys.slice(1)) {
      const expected = new Date(parseDateKey(previous));
      expected.setDate(expected.getDate() + 1);
      if (toDateKey(expected) === current) {
        previous = current;
        continue;
      }
      ranges.push({ start, end: previous });
      start = current;
      previous = current;
    }
    ranges.push({ start, end: previous });
    return ranges;
  }

  function renderSummary(dateKeys) {
    const ranges = mergeConsecutiveDates(dateKeys);
    if (!ranges.length) {
      summary.innerHTML = '<p class="availability-empty">目前行事曆沒有登記未來的無法預約日期，仍請傳訊完成最終確認。</p>';
      return;
    }

    summary.innerHTML = `<ul class="unavailable-range-list" aria-label="無法預約日期清單">${ranges
      .map(({ start, end }) => {
        const crossesYear = start.slice(0, 4) !== end.slice(0, 4);
        const startText = formatShortDate(start, true);
        const endText = formatShortDate(end, crossesYear);
        const label = start === end ? startText : `${startText}－${endText}`;
        return `<li><time datetime="${start}">${label}</time><span>無法預約</span></li>`;
      })
      .join("")}</ul>`;
  }

  function renderMonth(year, monthIndex, unavailableSet, todayKey) {
    const firstDay = new Date(year, monthIndex, 1, 12);
    const daysInMonth = new Date(year, monthIndex + 1, 0, 12).getDate();
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const monthName = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" }).format(firstDay);
    const cells = [];

    for (let index = 0; index < mondayOffset; index += 1) {
      cells.push('<span class="availability-day is-empty" aria-hidden="true"></span>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
      const isUnavailable = unavailableSet.has(key);
      const classes = ["availability-day"];
      if (key < todayKey) classes.push("is-past");
      if (key === todayKey) classes.push("is-today");
      if (isUnavailable) classes.push("is-unavailable");
      const label = isUnavailable ? `${monthIndex + 1}月${day}日，無法預約` : `${monthIndex + 1}月${day}日`;
      cells.push(
        `<span class="${classes.join(" ")}" aria-label="${label}"><span class="availability-day-number">${day}</span>${isUnavailable ? '<span class="availability-day-label">無法預約</span>' : ""}</span>`,
      );
    }

    return `<section class="availability-month" aria-label="${monthName}"><h3>${monthName}</h3><div class="availability-weekdays" aria-hidden="true">${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}</div><div class="availability-days">${cells.join("")}</div></section>`;
  }

  function renderCalendars(dateKeys) {
    const now = new Date();
    const todayKey = toDateKey(now);
    const minimumEnd = new Date(now.getFullYear(), now.getMonth() + 5, 1, 12);
    const latestUnavailable = dateKeys.length ? parseDateKey(dateKeys[dateKeys.length - 1]) : minimumEnd;
    const maximumEnd = new Date(now.getFullYear(), now.getMonth() + 11, 1, 12);
    const targetEnd = latestUnavailable > minimumEnd ? latestUnavailable : minimumEnd;
    const endMonth = targetEnd > maximumEnd ? maximumEnd : targetEnd;
    const unavailableSet = new Set(dateKeys);
    const months = [];

    for (
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1, 12);
      cursor <= new Date(endMonth.getFullYear(), endMonth.getMonth(), 1, 12);
      cursor.setMonth(cursor.getMonth() + 1)
    ) {
      months.push(renderMonth(cursor.getFullYear(), cursor.getMonth(), unavailableSet, todayKey));
    }
    calendars.innerHTML = months.join("");
  }

  async function loadAvailability() {
    try {
      const response = await fetch("/assets/data/campervan-unavailable-dates.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const todayKey = toDateKey(new Date());
      const dateKeys = [...new Set(data.unavailableDates ?? [])]
        .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= todayKey)
        .sort();
      renderSummary(dateKeys);
      renderCalendars(dateKeys);
      status.textContent = "已載入露營車行事曆；有標示的日期目前無法預約。";
      status.classList.add("is-ready");
    } catch (error) {
      status.textContent = "目前無法讀取檔期，請直接用 LINE 或 WhatsApp 詢問。";
      status.classList.add("is-error");
      summary.innerHTML = '<p class="availability-empty">檔期讀取暫時失敗，請傳訊確認想租的日期。</p>';
      calendars.hidden = true;
      console.error("Campervan availability failed to load", error);
    }
  }

  loadAvailability();
})();
