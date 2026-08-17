# AmbiSense Schedule Card

A touch-friendly Home Assistant card for viewing and editing weekly heating schedules of myPyllant AmbiSense rooms.

The card shows all seven days as colored timelines and provides a responsive editor for switching times and temperature setpoints. On tablets and desktop screens, overview and editor are displayed side by side.

## Features

- seven-day timeline with temperature colors and visible segment boundaries
- responsive two-column layout for tablets and desktops
- add, edit, and remove switching points
- copy one day to weekdays, weekends, or the full week
- writes the complete schedule through `mypyllant.set_time_program`
- follows the Home Assistant language automatically
- German and English translations, with English as the fallback

## Requirements

The configured myPyllant climate entity must expose its AmbiSense schedule as a JSON-compatible `time_program` attribute. Support for this is proposed in [mypyllant-component PR #482](https://github.com/signalkraft/mypyllant-component/pull/482).

The myPyllant integration must also provide the `mypyllant.set_time_program` action.

## Installation with HACS

1. Open HACS.
2. Add `https://github.com/acsquirrel/ambisense-schedule-card` as a custom **Dashboard** repository.
3. Download **AmbiSense Schedule Card**.
4. Reload the Home Assistant frontend when prompted.

## Manual installation

1. Copy `ambisense-schedule-card.js` to `/config/www/ambisense-schedule-card.js`.
2. Open **Settings → Dashboards → Resources** in Home Assistant.
3. Add `/local/ambisense-schedule-card.js?v=0.3.0` as a JavaScript module.
4. Fully reload the browser or Home Assistant Companion app.

## Card configuration

```yaml
type: custom:ambisense-schedule-card
entity: climate.zuhause_wohnzimmer
name: Wohnzimmer – Wochenplan
```

Available options:

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `entity` | yes | — | myPyllant AmbiSense climate entity |
| `name` | no | localized | Card title |
| `language` | no | Home Assistant language | `de` or `en` |
| `min_temperature` | no | `5` | Minimum accepted setpoint |
| `max_temperature` | no | `30` | Maximum accepted setpoint |
| `temperature_step` | no | `0.5` | Setpoint step |

To force German independently of the Home Assistant profile:

```yaml
type: custom:ambisense-schedule-card
entity: climate.zuhause_wohnzimmer
language: de
```

## Bubble Card popup example

```yaml
type: custom:bubble-card
card_type: pop-up
hash: '#schedule-wohnzimmer'
name: Wohnzimmer – Zeitplan
icon: mdi:calendar-clock
cards:
  - type: custom:ambisense-schedule-card
    entity: climate.zuhause_wohnzimmer
    name: Wohnzimmer – Wochenplan
button_type: name
sub_button:
  main: []
  bottom: []
popup_mode: centered
width_desktop: "min(1000px, calc(100vw - 48px))"
full_width_on_mobile: true
```

## Notes

- Saving always submits the complete weekly schedule.
- Every day must start with a switching point at `00:00`.
- Changes stay local to the card until **Save schedule** is pressed.
- The card maps `temperature_setpoint` from the entity attribute to `setpoint` when saving.

## Deutsch

Die Karte übernimmt standardmäßig die in Home Assistant eingestellte Sprache. Deutsch und Englisch sind direkt enthalten; mit `language: de` kann Deutsch ausdrücklich erzwungen werden.

Beim Speichern wird immer der vollständige Wochenplan übertragen. Der erste Schaltpunkt jedes Tages muss bei `00:00` liegen.

## License

[MIT](LICENSE)
