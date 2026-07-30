# EnergySaver

**Run your appliances at the cheapest, greenest time — automatically.**

EnergySaver takes the abstract concept of "carbon intensity" and turns it into a concrete, actionable answer: *"Run your dishwasher at 2:00 AM tonight and save £1.40 and 0.8 kg of CO₂."* No guesswork. No spreadsheets. Just the right time, surfaced the moment you need it.

> **Coverage:** Great Britain only (England, Scotland & Wales). Northern Ireland is not covered by the Carbon Intensity API.

---

## What It Does

The UK electricity grid is not equally green or cheap at every hour of the day. Wind and solar generation surges at certain times, pushing carbon emissions down and wholesale prices with them. EnergySaver watches these fluctuations for you and recommends the single best hour in the next 48 hours to run each of your home appliances.

The core recommendation answers three questions at once:
- **When?** The lowest-carbon, lowest-cost window in the next 48 hours.
- **How much cheaper?** Real £/p savings against running the appliance right now.
- **How much greener?** CO₂ saved, translated into human-scale equivalences (km driven, cups of tea boiled, grams of beef not eaten).

---

## Features

### Live Carbon Gauge
A real-time arc gauge shows the current grid carbon intensity (gCO₂/kWh) colour-coded from very low (green) to very high (red). You see at a glance whether *right now* is a good time to use electricity.

### 48-Hour Forecast Grid
An interactive grid of every half-hour slot across the next 48 hours, grouped into AM and PM windows. Each slot is colour-coded by carbon band. Click any slot to see its exact intensity value and price. The grid updates automatically from live API data.

### Energy Timer Calculator
The main tool. You choose:
- **Your appliance** — washing machine, dishwasher, tumble dryer, EV charger, and more.
- **Your tariff** — Agile Octopus (real-time prices) or standard time-of-use rates.
- **Your time window** — the hours you're willing to let the appliance run.

EnergySaver then finds the optimal 30-minute to 3-hour window within your constraints and shows you:
- Best start time (12h AM/PM format)
- Estimated cost (pence)
- CO₂ emitted (grams)
- Savings vs. running it right now (money *and* carbon)
- CO₂ equivalences to make the number meaningful

Results are shareable — a single URL encodes your appliance, tariff, and window so you can send the recommendation to a family member or save it for later.

### Day Planner
When you have multiple appliances to schedule, the Day Planner solves the whole day at once. Add any combination of appliances (washing machine + dishwasher + EV), set constraints (must finish before 7 AM, avoid peak hours), and EnergySaver builds a non-overlapping schedule that minimises total cost and carbon across all of them simultaneously.

The plan is visualised as a Gantt-style timeline and a summary table showing total spend and CO₂ saved for the whole day. The plan is URL-shareable.

### Push Notifications
Once you've found your best window, EnergySaver can remind you. Grant notification permission and choose:
- **1 hour before** — gives you time to load the machine.
- **At start time** — fires the moment the green window opens.

Notifications are scheduled entirely in your browser — no account, no server, no data sent anywhere.

### Appliance Library
Detailed pages for every supported appliance showing typical power draw (kW), average cycle duration, and example savings calculations. Useful for understanding which appliances have the biggest impact and why some are more time-flexible than others.

### Blog
Explainer articles covering:
- What carbon intensity is and why it changes by the hour
- How much money load-shifting can actually save
- Agile Octopus vs. Economy 7 — which tariff benefits most from timing
- The best hours to charge an EV overnight

---

## How the Data Works

EnergySaver uses two public data sources. **No personal data is collected or transmitted.**

### UK Carbon Intensity API
Operated by National Grid ESO and hosted at [carbonintensity.org.uk](https://carbonintensity.org.uk). It publishes carbon intensity forecasts (in gCO₂/kWh) for every 30-minute half-hour period across the next 48 hours, broken down by GB region. EnergySaver fetches this data live in your browser — the request goes directly from your device to the API; no intermediary server is involved.

The intensity figure represents the carbon emitted per unit of electricity consumed on the GB grid at that moment, including generation mix (gas, coal, nuclear, wind, solar, hydro, imports).

### Octopus Energy Agile Tariff
The [Octopus Agile tariff](https://octopus.energy/agile/) publishes half-hourly electricity prices that vary with wholesale market rates. These prices are publicly available via the Octopus Energy API. EnergySaver fetches them live and uses them to calculate real-world cost estimates.

If you are not on the Agile tariff, you can still use EnergySaver — the calculator falls back to standard time-of-use rate estimates typical of UK Economy 7 and flat-rate tariffs.

### Appliance Data
Wattage and cycle-duration data for each appliance is compiled from published manufacturer specifications and UK consumer energy research. It is stored as a static dataset bundled with the app — no external lookup needed.

### Privacy
- EnergySaver makes no user accounts and stores no personal data.
- The only outbound requests from your browser are the two API calls above (carbon intensity and Agile prices), both to public, unauthenticated endpoints.
- Notification preferences and planner state are stored in your browser's `localStorage` and never leave your device.
- No analytics, cookies, or tracking scripts are loaded unless you explicitly opt in.

---

## Supported Appliances

| Appliance | Typical Draw |
|---|---|
| Washing Machine | 2.0 kW |
| Tumble Dryer | 2.5 kW |
| Dishwasher | 1.8 kW |
| EV Charger (7kW home) | 7.0 kW |
| Electric Oven | 2.2 kW |
| Kettle | 3.0 kW |
| Immersion Heater | 3.0 kW |
| Pool Pump | 1.5 kW |

New appliances can be added by updating the static data file — no code changes required.

---

## Coverage & Limitations

- **Geography:** Great Britain only. The Carbon Intensity API does not cover Northern Ireland.
- **Tariffs:** Real-time price data is from Octopus Agile. Other tariff estimates are approximations.
- **Forecast accuracy:** Carbon intensity forecasts are typically accurate to within ±15 gCO₂/kWh for the next 24 hours and degrade slightly beyond that. The API updates every 30 minutes.
- **Savings figures:** All cost and CO₂ savings are estimates based on public data. Actual bills depend on your specific tariff, meter type, and appliance condition.

---

## Who It's For

- **Climate-conscious households** who want their energy use to match when the grid is greenest.
- **Agile Octopus customers** who benefit directly from shifting load to cheap half-hour slots.
- **EV owners** who charge at home and want to minimise both cost and charging carbon footprint.
- **Anyone curious** about where their electricity comes from and what it's actually costing the planet.

---

## Data Credits

- [UK Carbon Intensity API](https://carbonintensity.org.uk) — National Grid ESO / University of Oxford (CC BY 4.0)
- [Octopus Energy Agile API](https://developer.octopus.energy) — Octopus Energy Ltd

---

*EnergySaver is an independent project and is not affiliated with National Grid ESO, Octopus Energy, or any electricity supplier.*
