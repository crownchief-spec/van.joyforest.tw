(() => {
  const form = document.querySelector("[data-booking-inquiry-form]");
  const preview = document.querySelector("[data-booking-template-text]");
  const whatsapp = document.querySelector("[data-booking-whatsapp]");
  if (!form || !preview) return;

  const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
  const params = new URLSearchParams(window.location.search);
  const get = (name) => form.elements.namedItem(name)?.value.trim() || "";
  const show = (value) => value || (isEnglish ? "Not entered" : "尚未填寫");

  for (const name of ["start", "end", "name", "phone", "adults", "children", "pets", "delivery", "destinations", "notes"]) {
    const field = form.elements.namedItem(name);
    const value = params.get(name);
    if (field && value) field.value = value;
  }

  function rentalLength() {
    const start = get("start");
    const end = get("end");
    if (!start || !end) return "";
    const startDate = new Date(`${start}T12:00:00`);
    const endDate = new Date(`${end}T12:00:00`);
    const nights = Math.round((endDate - startDate) / 86400000);
    if (!Number.isFinite(nights) || nights < 0) return "";
    if (isEnglish) {
      const days = nights + 1;
      return `${days} ${days === 1 ? "day" : "days"} / ${nights} ${nights === 1 ? "night" : "nights"}`;
    }
    return `${nights + 1} 天 ${nights} 夜`;
  }

  function message() {
    const dates = get("start") && get("end") ? `${get("start")} ～ ${get("end")}` : get("start") || get("end");
    if (isEnglish) {
      return [
        "【JoyForest campervan booking enquiry】",
        "",
        `Name: ${show(get("name"))}`,
        `Phone / WhatsApp: ${show(get("phone"))}`,
        `Rental dates: ${show(dates)}`,
        `Planned rental length: ${show(rentalLength())}`,
        `Adults: ${show(get("adults"))}`,
        `Children: ${show(get("children"))}`,
        `Pets: ${show(get("pets"))}`,
        `Delivery / return location: ${show(get("delivery"))}`,
        `Planned destinations: ${show(get("destinations"))}`,
        `Other questions: ${show(get("notes"))}`,
      ].join("\n");
    }
    return [
      "【揪好森露營車預約詢問】",
      "",
      `預約人姓名：${show(get("name"))}`,
      `手機：${show(get("phone"))}`,
      `租借日期：${show(dates)}`,
      `預計天數：${show(rentalLength())}`,
      `大人人數：${show(get("adults"))}`,
      `小孩人數：${show(get("children"))}`,
      `是否有寵物：${show(get("pets"))}`,
      `預計送車／還車地點：${show(get("delivery"))}`,
      `預計旅遊地點：${show(get("destinations"))}`,
      `其他問題：${show(get("notes"))}`,
    ].join("\n");
  }

  function update() {
    const text = message();
    preview.textContent = text;
    if (whatsapp) whatsapp.href = `https://wa.me/886911252302?text=${encodeURIComponent(text)}`;
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
})();
