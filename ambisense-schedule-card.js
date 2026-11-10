const AMBISENSE_SCHEDULE_CARD_VERSION = "0.3.1";

const TIME_STEP_MINUTES = 10;
const TIME_STEP_SECONDS = TIME_STEP_MINUTES * 60;
const LAST_SWITCHING_TIME = 24 * 60 - TIME_STEP_MINUTES;

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const TRANSLATIONS = {
  de: {
    defaultName: "Wochenplan",
    invalidEntity: "Bitte eine AmbiSense-climate-Entity konfigurieren.",
    entityNotFound: "Entity {entity} wurde nicht gefunden.",
    attributeUnavailable: "Das Attribut time_program ist nicht als Objekt verfügbar.",
    loading: "Zeitplan wird geladen …",
    changed: "Geändert",
    time: "Zeit",
    temperature: "Temperatur",
    deleteEntry: "Umschaltpunkt löschen",
    editorHelp: "Zeitpunkte, ab denen die jeweilige Temperatur gilt",
    addEntry: "Zeitpunkt",
    copyToOtherDays: "Auf andere Tage kopieren",
    weekdays: "Mo–Fr",
    weekend: "Sa–So",
    allDays: "Alle Tage",
    discard: "Verwerfen",
    saving: "Wird gespeichert …",
    save: "Zeitplan speichern",
    discarded: "Änderungen wurden verworfen.",
    minimumEntry: "{day}: Mindestens ein Zeitpunkt ist erforderlich.",
    firstAtMidnight: "{day}: Der erste Zeitpunkt muss 00:00 sein.",
    invalidTime: "{day}: Ungültige Uhrzeit.",
    invalidTimeStep: "{day}: Die Uhrzeit muss in 10-Minuten-Schritten liegen.",
    duplicateTime: "{day}: Eine Uhrzeit kommt doppelt vor.",
    temperatureOutOfRange: "{day}: Temperatur außerhalb des erlaubten Bereichs.",
    saveSuccess: "Zeitplan wurde gespeichert. Die Aktualisierung kann einen Moment dauern.",
    saveFailed: "Speichern fehlgeschlagen: {error}",
    weekday_monday_short: "Mo",
    weekday_monday_label: "Montag",
    weekday_tuesday_short: "Di",
    weekday_tuesday_label: "Dienstag",
    weekday_wednesday_short: "Mi",
    weekday_wednesday_label: "Mittwoch",
    weekday_thursday_short: "Do",
    weekday_thursday_label: "Donnerstag",
    weekday_friday_short: "Fr",
    weekday_friday_label: "Freitag",
    weekday_saturday_short: "Sa",
    weekday_saturday_label: "Samstag",
    weekday_sunday_short: "So",
    weekday_sunday_label: "Sonntag",
  },
  en: {
    defaultName: "Weekly schedule",
    invalidEntity: "Please configure an AmbiSense climate entity.",
    entityNotFound: "Entity {entity} was not found.",
    attributeUnavailable: "The time_program attribute is not available as an object.",
    loading: "Loading schedule …",
    changed: "Changed",
    time: "Time",
    temperature: "Temperature",
    deleteEntry: "Delete switching point",
    editorHelp: "Times from which the respective temperature applies",
    addEntry: "Switch point",
    copyToOtherDays: "Copy to other days",
    weekdays: "Mon–Fri",
    weekend: "Sat–Sun",
    allDays: "All days",
    discard: "Discard",
    saving: "Saving …",
    save: "Save schedule",
    discarded: "Changes were discarded.",
    minimumEntry: "{day}: At least one switching point is required.",
    firstAtMidnight: "{day}: The first switching point must be at 00:00.",
    invalidTime: "{day}: Invalid time.",
    invalidTimeStep: "{day}: Time must use 10-minute increments.",
    duplicateTime: "{day}: A time occurs more than once.",
    temperatureOutOfRange: "{day}: Temperature is outside the allowed range.",
    saveSuccess: "Schedule saved. The update may take a moment.",
    saveFailed: "Saving failed: {error}",
    weekday_monday_short: "Mon",
    weekday_monday_label: "Monday",
    weekday_tuesday_short: "Tue",
    weekday_tuesday_label: "Tuesday",
    weekday_wednesday_short: "Wed",
    weekday_wednesday_label: "Wednesday",
    weekday_thursday_short: "Thu",
    weekday_thursday_label: "Thursday",
    weekday_friday_short: "Fri",
    weekday_friday_label: "Friday",
    weekday_saturday_short: "Sat",
    weekday_saturday_label: "Saturday",
    weekday_sunday_short: "Sun",
    weekday_sunday_label: "Sunday",
  },
};

function normalizeLanguage(language) {
  return String(language || "en").toLowerCase().startsWith("de") ? "de" : "en";
}

function translate(language, key, variables = {}) {
  const value = TRANSLATIONS[normalizeLanguage(language)][key] ?? TRANSLATIONS.en[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? `{${name}}`);
}

class AmbisenseScheduleCard extends HTMLElement {
  static getStubConfig() {
    return { entity: "climate.zuhause_wohnzimmer" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._draft = null;
    this._sourceFingerprint = null;
    this._selectedDay = this._todayKey();
    this._dirty = false;
    this._saving = false;
    this._status = "";
    this._statusIsError = false;
  }

  setConfig(config) {
    if (!config.entity || !config.entity.startsWith("climate.")) {
      throw new Error(
        translate(config.language || globalThis.navigator?.language, "invalidEntity"),
      );
    }

    this._config = {
      min_temperature: 5,
      max_temperature: 30,
      temperature_step: 0.5,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    const previousLanguage = this._language();
    this._hass = hass;
    const languageChanged = previousLanguage !== this._language();
    const program = this._programFromState();
    let programChanged = false;

    if (program) {
      const fingerprint = JSON.stringify(program);
      if (!this._draft || (!this._dirty && fingerprint !== this._sourceFingerprint)) {
        this._draft = this._normalizeProgram(program);
        this._sourceFingerprint = fingerprint;
        programChanged = true;
      }
    }

    if (
      programChanged ||
      languageChanged ||
      !this.shadowRoot.firstElementChild ||
      program === null
    ) {
      this._render();
    }
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, rows: 8, min_columns: 6, min_rows: 5 };
  }

  _language() {
    return normalizeLanguage(
      this._config?.language ||
        this._hass?.locale?.language ||
        this._hass?.language ||
        globalThis.navigator?.language,
    );
  }

  _t(key, variables = {}) {
    return translate(this._language(), key, variables);
  }

  _weekdays() {
    return WEEKDAY_KEYS.map((key) => ({
      key,
      short: this._t(`weekday_${key}_short`),
      label: this._t(`weekday_${key}_label`),
    }));
  }

  _formatNumber(value) {
    return new Intl.NumberFormat(this._language(), {
      maximumFractionDigits: 1,
    }).format(value);
  }

  _todayKey() {
    const jsDay = new Date().getDay();
    return WEEKDAY_KEYS[(jsDay + 6) % 7];
  }

  _programFromState() {
    if (!this._hass || !this._config) return null;
    const state = this._hass.states[this._config.entity];
    const program = state?.attributes?.time_program;
    return program && typeof program === "object" ? program : null;
  }

  _normalizeProgram(program) {
    return Object.fromEntries(
      WEEKDAY_KEYS.map((key) => {
        const entries = Array.isArray(program[key]) ? program[key] : [];
        const normalized = entries
          .map((entry) => ({
            start_time: Number(entry.start_time ?? entry.startTime),
            temperature_setpoint: Number(
              entry.temperature_setpoint ??
                entry.temperatureSetpoint ??
                entry.setpoint,
            ),
          }))
          .filter(
            (entry) =>
              Number.isFinite(entry.start_time) &&
              Number.isFinite(entry.temperature_setpoint),
          )
          .sort((a, b) => a.start_time - b.start_time);
        return [key, normalized];
      }),
    );
  }

  _formatTime(minutes) {
    const bounded = Math.max(0, Math.min(1439, Number(minutes)));
    const hours = Math.floor(bounded / 60);
    const mins = bounded % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  _parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || "");
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59 || minutes % TIME_STEP_MINUTES !== 0) return null;
    return hours * 60 + minutes;
  }

  _temperatureColor(temperature) {
    if (temperature < 17) return "#3b82f6";
    if (temperature < 18.5) return "#0891b2";
    if (temperature < 20.5) return "#f59e0b";
    if (temperature < 22.5) return "#f97316";
    return "#ef4444";
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;

    const entityState = this._hass?.states?.[this._config.entity];
    if (this._hass && !entityState) {
      this.shadowRoot.innerHTML = this._stylesAndCard(`
        <div class="message error">
          ${this._escape(this._t("entityNotFound", { entity: this._config.entity }))}
        </div>
      `);
      return;
    }

    if (entityState && !this._programFromState()) {
      this.shadowRoot.innerHTML = this._stylesAndCard(`
        <div class="message error">
          ${this._escape(this._t("attributeUnavailable"))}
        </div>
      `);
      return;
    }

    if (!this._draft) {
      this.shadowRoot.innerHTML = this._stylesAndCard(
        `<div class="message">${this._escape(this._t("loading"))}</div>`,
      );
      return;
    }

    const weekdays = this._weekdays();
    const selected = weekdays.find((day) => day.key === this._selectedDay);
    const entries = this._draft[this._selectedDay] || [];

    const timelineRows = weekdays.map((day) => {
      const dayEntries = this._draft[day.key] || [];
      const segments = dayEntries
        .map((entry, index) => {
          const nextStart = dayEntries[index + 1]?.start_time ?? 1440;
          const left = (entry.start_time / 1440) * 100;
          const width = Math.max(0, ((nextStart - entry.start_time) / 1440) * 100);
          const title = `${this._formatTime(entry.start_time)} · ${entry.temperature_setpoint} °C`;
          const color = this._temperatureColor(entry.temperature_setpoint);
          return `<span class="segment" style="left:${left}%;width:${width}%;--segment-color:${color}" title="${this._escape(title)}"><span>${this._escape(entry.temperature_setpoint)}°</span></span>`;
        })
        .join("");

      return `
        <button class="timeline-row ${day.key === this._selectedDay ? "selected" : ""}" data-day="${day.key}" type="button">
          <span class="day-short">${day.short}</span>
          <span class="timeline">${segments}</span>
        </button>
      `;
    }).join("");

    const editorRows = entries
      .map(
        (entry, index) => `
          <div class="entry-row" data-index="${index}">
            <label>
              <span>${this._escape(this._t("time"))}</span>
              <input class="time-input" type="time" value="${this._formatTime(entry.start_time)}" min="00:00" max="23:50" step="${TIME_STEP_SECONDS}">
            </label>
            <label>
              <span>${this._escape(this._t("temperature"))}</span>
              <span class="temperature-input">
                <input class="temp-input" type="number" value="${entry.temperature_setpoint}" min="${this._config.min_temperature}" max="${this._config.max_temperature}" step="${this._config.temperature_step}">
                <span>°C</span>
              </span>
            </label>
            <button class="icon-button delete-entry" type="button" title="${this._escape(this._t("deleteEntry"))}" ${entries.length <= 1 ? "disabled" : ""}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>
            </button>
          </div>
        `,
      )
      .join("");

    const status = this._status
      ? `<div class="status ${this._statusIsError ? "error" : ""}">${this._escape(this._status)}</div>`
      : "";

    this.shadowRoot.innerHTML = this._stylesAndCard(`
      <div class="header">
        <div>
          <div class="title">${this._escape(this._config.name || this._t("defaultName"))}</div>
          <div class="subtitle">${this._escape(entityState?.attributes?.friendly_name || this._config.entity)}</div>
        </div>
        <span class="change-badge ${this._dirty ? "visible" : ""}">${this._escape(this._t("changed"))}</span>
      </div>

      <div class="content-grid">
        <section class="overview-pane">
          <div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
          <div class="week">${timelineRows}</div>
          <div class="legend">
            <span><i style="--legend-color:#3b82f6"></i>&lt; 17°</span>
            <span><i style="--legend-color:#0891b2"></i>17–18°</span>
            <span><i style="--legend-color:#f59e0b"></i>${this._formatNumber(18.5)}–20°</span>
            <span><i style="--legend-color:#f97316"></i>${this._formatNumber(20.5)}–22°</span>
            <span><i style="--legend-color:#ef4444"></i>&gt; 22°</span>
          </div>
        </section>

        <section class="editor-pane">
          <div class="editor-header">
            <div>
              <div class="editor-title">${selected.label}</div>
              <div class="editor-help">${this._escape(this._t("editorHelp"))}</div>
            </div>
            <button class="secondary add-entry" type="button">
              <ha-icon icon="mdi:plus"></ha-icon>
              ${this._escape(this._t("addEntry"))}
            </button>
          </div>

          <div class="entries">${editorRows}</div>

          <details class="copy-panel">
            <summary>${this._escape(this._t("copyToOtherDays"))}</summary>
            <div class="copy-actions">
              <button class="secondary copy-days" data-target="weekdays" type="button">${this._escape(this._t("weekdays"))}</button>
              <button class="secondary copy-days" data-target="weekend" type="button">${this._escape(this._t("weekend"))}</button>
              <button class="secondary copy-days" data-target="all" type="button">${this._escape(this._t("allDays"))}</button>
            </div>
          </details>

          ${status}

          <div class="actions">
            <button class="secondary discard" type="button" ${!this._dirty || this._saving ? "disabled" : ""}>${this._escape(this._t("discard"))}</button>
            <button class="primary save" type="button" ${!this._dirty || this._saving ? "disabled" : ""}>
              ${this._escape(this._t(this._saving ? "saving" : "save"))}
            </button>
          </div>
        </section>
      </div>
    `);

    this._attachListeners();
  }

  _stylesAndCard(content) {
    return `
      <style>
        :host { display: block; --schedule-accent: var(--primary-color); }
        ha-card { padding: 20px; overflow: hidden; }
        button, input { font: inherit; }
        button { -webkit-tap-highlight-color: transparent; }
        .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .title { color: var(--primary-text-color); font-size: 20px; font-weight: 650; }
        .subtitle { color: var(--secondary-text-color); font-size: 13px; margin-top: 2px; }
        .change-badge { background: color-mix(in srgb, var(--warning-color, #ff9800) 18%, transparent); border-radius: 999px; color: var(--warning-color, #ff9800); font-size: 12px; font-weight: 600; opacity: 0; padding: 4px 9px; }
        .change-badge.visible { opacity: 1; }
        .axis { color: var(--secondary-text-color); display: grid; font-size: 10px; grid-template-columns: repeat(5, 1fr); margin: 0 0 4px 38px; }
        .axis span:not(:first-child):not(:last-child) { text-align: center; }
        .axis span:last-child { text-align: right; }
        .week { display: grid; gap: 5px; }
        .timeline-row { align-items: center; background: transparent; border: 0; border-radius: 8px; color: var(--primary-text-color); cursor: pointer; display: grid; grid-template-columns: 30px 1fr; min-height: 31px; padding: 3px 4px; text-align: left; }
        .timeline-row:hover, .timeline-row.selected { background: color-mix(in srgb, var(--schedule-accent) 10%, transparent); }
        .day-short { font-size: 12px; font-weight: 650; }
        .timeline { background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); border-radius: 5px; height: 24px; overflow: hidden; position: relative; }
        .timeline::before { background: repeating-linear-gradient(to right, transparent 0, transparent calc(25% - 1px), color-mix(in srgb, var(--divider-color) 75%, transparent) calc(25% - 1px), color-mix(in srgb, var(--divider-color) 75%, transparent) 25%); content: ""; inset: 0; pointer-events: none; position: absolute; z-index: 2; }
        .segment { align-items: center; background: var(--segment-color); box-sizing: border-box; display: flex; height: 100%; justify-content: center; min-width: 2px; overflow: hidden; position: absolute; }
        .segment:not(:first-child) { border-left: 3px solid color-mix(in srgb, var(--primary-text-color) 72%, transparent); box-shadow: -1px 0 0 color-mix(in srgb, var(--card-background-color) 80%, transparent); }
        .segment span { color: white; font-size: 10px; font-weight: 700; overflow: hidden; padding: 0 2px; text-shadow: 0 1px 2px rgba(0, 0, 0, .45); text-overflow: clip; white-space: nowrap; }
        .legend { color: var(--secondary-text-color); display: flex; flex-wrap: wrap; font-size: 10px; gap: 6px 11px; margin: 10px 4px 0 34px; }
        .legend span { align-items: center; display: inline-flex; gap: 4px; }
        .legend i { background: var(--legend-color); border-radius: 50%; display: inline-block; height: 8px; width: 8px; }
        .editor-header { align-items: center; border-top: 1px solid var(--divider-color); display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 17px; }
        .editor-title { color: var(--primary-text-color); font-size: 17px; font-weight: 650; }
        .editor-help { color: var(--secondary-text-color); font-size: 12px; margin-top: 2px; }
        .entries { display: grid; gap: 8px; margin-top: 12px; }
        .entry-row { align-items: end; display: grid; gap: 10px; grid-template-columns: minmax(105px, .8fr) minmax(125px, 1fr) 42px; }
        label { color: var(--secondary-text-color); display: grid; font-size: 11px; gap: 4px; }
        input { background: var(--secondary-background-color); border: 1px solid var(--divider-color); border-radius: 9px; box-sizing: border-box; color: var(--primary-text-color); min-height: 42px; padding: 8px 10px; width: 100%; }
        input:focus { border-color: var(--schedule-accent); outline: 2px solid color-mix(in srgb, var(--schedule-accent) 20%, transparent); }
        .temperature-input { align-items: center; display: grid; grid-template-columns: 1fr auto; position: relative; }
        .temperature-input > span { color: var(--secondary-text-color); padding-right: 10px; position: absolute; right: 0; }
        .temp-input { padding-right: 38px; }
        .icon-button, .secondary, .primary { align-items: center; border-radius: 10px; cursor: pointer; display: inline-flex; justify-content: center; min-height: 42px; }
        .icon-button { background: transparent; border: 0; color: var(--secondary-text-color); width: 42px; }
        .icon-button:hover { background: color-mix(in srgb, var(--error-color) 10%, transparent); color: var(--error-color); }
        .secondary { background: transparent; border: 1px solid var(--divider-color); color: var(--primary-text-color); gap: 5px; padding: 8px 12px; }
        .primary { background: var(--schedule-accent); border: 0; color: var(--text-primary-color, white); font-weight: 650; padding: 9px 16px; }
        button:disabled { cursor: default; opacity: .42; }
        .copy-panel { border-top: 1px solid var(--divider-color); color: var(--secondary-text-color); font-size: 13px; margin-top: 15px; padding-top: 12px; }
        .copy-panel summary { cursor: pointer; width: fit-content; }
        .copy-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .copy-actions button { min-height: 36px; }
        .actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 18px; }
        .status { background: color-mix(in srgb, var(--success-color, #4caf50) 12%, transparent); border-radius: 8px; color: var(--success-color, #4caf50); font-size: 13px; margin-top: 14px; padding: 9px 11px; }
        .status.error, .message.error { background: color-mix(in srgb, var(--error-color) 12%, transparent); color: var(--error-color); }
        .message { color: var(--secondary-text-color); padding: 16px; }
        code { font-family: var(--code-font-family, monospace); }
        @media (min-width: 680px) {
          .content-grid { align-items: start; display: grid; gap: 22px; grid-template-columns: minmax(0, 1.08fr) minmax(330px, .92fr); }
          .editor-pane { border-left: 1px solid var(--divider-color); min-width: 0; padding-left: 22px; }
          .editor-header { border-top: 0; margin-top: 0; padding-top: 0; }
          .timeline-row { min-height: 36px; }
          .timeline { height: 28px; }
          .segment span { font-size: 11px; }
          .actions { margin-top: 20px; }
        }
        @media (max-width: 480px) {
          ha-card { padding: 16px; }
          .entry-row { grid-template-columns: 1fr 1fr 38px; gap: 7px; }
          .editor-help { display: none; }
          .editor-header .secondary { padding-inline: 9px; }
          .actions { display: grid; grid-template-columns: 1fr 1.4fr; }
        }
      </style>
      <ha-card>${content}</ha-card>
    `;
  }

  _attachListeners() {
    this.shadowRoot.querySelectorAll(".timeline-row").forEach((button) => {
      button.addEventListener("click", () => {
        this._selectedDay = button.dataset.day;
        this._status = "";
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll(".entry-row").forEach((row) => {
      const index = Number(row.dataset.index);
      row.querySelector(".time-input").addEventListener("change", (event) => {
        const minutes = this._parseTime(event.target.value);
        if (minutes === null) {
          event.target.value = this._formatTime(
            this._draft[this._selectedDay][index].start_time,
          );
          return;
        }
        this._draft[this._selectedDay][index].start_time = minutes;
        this._draft[this._selectedDay].sort((a, b) => a.start_time - b.start_time);
        this._markDirty();
      });
      row.querySelector(".temp-input").addEventListener("change", (event) => {
        const temperature = Number(event.target.value);
        if (!Number.isFinite(temperature)) return;
        this._draft[this._selectedDay][index].temperature_setpoint = temperature;
        this._markDirty();
      });
      row.querySelector(".delete-entry").addEventListener("click", () => {
        if (this._draft[this._selectedDay].length <= 1) return;
        this._draft[this._selectedDay].splice(index, 1);
        this._markDirty();
      });
    });

    this.shadowRoot.querySelector(".add-entry")?.addEventListener("click", () => {
      const entries = this._draft[this._selectedDay];
      const previous = entries.at(-1);
      const occupied = new Set(entries.map((entry) => entry.start_time));
      let start = Math.min(
        previous ? previous.start_time + 60 : 0,
        LAST_SWITCHING_TIME,
      );
      start = Math.ceil(start / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
      while (occupied.has(start) && start >= TIME_STEP_MINUTES) {
        start -= TIME_STEP_MINUTES;
      }
      if (occupied.has(start)) return;
      entries.push({
        start_time: start,
        temperature_setpoint: previous?.temperature_setpoint ?? 20,
      });
      entries.sort((a, b) => a.start_time - b.start_time);
      this._markDirty();
    });

    this.shadowRoot.querySelectorAll(".copy-days").forEach((button) => {
      button.addEventListener("click", () => this._copySelectedDay(button.dataset.target));
    });

    this.shadowRoot.querySelector(".discard")?.addEventListener("click", () => {
      const source = this._programFromState();
      if (!source) return;
      this._draft = this._normalizeProgram(source);
      this._sourceFingerprint = JSON.stringify(source);
      this._dirty = false;
      this._status = this._t("discarded");
      this._statusIsError = false;
      this._render();
    });

    this.shadowRoot.querySelector(".save")?.addEventListener("click", () => this._save());
  }

  _markDirty() {
    this._dirty = true;
    this._status = "";
    this._render();
  }

  _copySelectedDay(target) {
    const targets = {
      weekdays: WEEKDAY_KEYS.slice(0, 5),
      weekend: WEEKDAY_KEYS.slice(5),
      all: WEEKDAY_KEYS,
    }[target];
    if (!targets) return;

    const source = this._draft[this._selectedDay];
    for (const day of targets) {
      this._draft[day] = source.map((entry) => ({ ...entry }));
    }
    this._markDirty();
  }

  _validate() {
    for (const { key, label } of this._weekdays()) {
      const entries = this._draft[key];
      if (!entries.length) return this._t("minimumEntry", { day: label });
      if (entries[0].start_time !== 0) {
        return this._t("firstAtMidnight", { day: label });
      }

      const seen = new Set();
      for (const entry of entries) {
        if (entry.start_time < 0 || entry.start_time > 1439) {
          return this._t("invalidTime", { day: label });
        }
        if (entry.start_time % TIME_STEP_MINUTES !== 0) {
          return this._t("invalidTimeStep", { day: label });
        }
        if (seen.has(entry.start_time)) {
          return this._t("duplicateTime", { day: label });
        }
        seen.add(entry.start_time);
        if (
          entry.temperature_setpoint < this._config.min_temperature ||
          entry.temperature_setpoint > this._config.max_temperature
        ) {
          return this._t("temperatureOutOfRange", { day: label });
        }
      }
    }
    return null;
  }

  async _save() {
    const validationError = this._validate();
    if (validationError) {
      this._status = validationError;
      this._statusIsError = true;
      this._render();
      return;
    }

    const timeProgram = Object.fromEntries(
      WEEKDAY_KEYS.map((key) => [
        key,
        this._draft[key].map((entry) => ({
          start_time: entry.start_time,
          setpoint: entry.temperature_setpoint,
        })),
      ]),
    );

    this._saving = true;
    this._status = "";
    this._render();

    try {
      await this._hass.callService(
        "mypyllant",
        "set_time_program",
        { program_type: "heating", time_program: timeProgram },
        { entity_id: this._config.entity },
      );
      this._dirty = false;
      this._status = this._t("saveSuccess");
      this._statusIsError = false;
    } catch (error) {
      this._status = this._t("saveFailed", {
        error: error?.message || error,
      });
      this._statusIsError = true;
    } finally {
      this._saving = false;
      this._render();
    }
  }
}

if (!customElements.get("ambisense-schedule-card")) {
  customElements.define("ambisense-schedule-card", AmbisenseScheduleCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ambisense-schedule-card",
  name: "AmbiSense Schedule Card",
  description: "Touch-friendly weekly schedule editor for myPyllant AmbiSense rooms",
  preview: false,
  documentationURL: "https://github.com/acsquirrel/ambisense-schedule-card",
});

console.info(
  `%c AMBISENSE-SCHEDULE-CARD %c ${AMBISENSE_SCHEDULE_CARD_VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: #03a9f4; background: white; font-weight: 700;",
);
