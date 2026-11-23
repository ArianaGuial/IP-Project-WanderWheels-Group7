"use strict";

const content = document.querySelector("#content");
const notice = document.querySelector("#notice");
const navigation = document.querySelector("#navigation");
const dialog = document.querySelector("#record-dialog");
const dialogBody = document.querySelector("#dialog-body");
const dialogStatus = document.querySelector("#dialog-status");
const params = new URLSearchParams(location.search);
const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const staffLinks = {
  dashboard: "Dashboard",
  fleet: "Fleet",
  maintenance: "Maintenance",
  reservations: "Reservations",
  customers: "Customers",
  users: "Users",
  licenses: "Licenses",
  inquiries: "Inquiries",
};
const customerLinks = {
  dashboard: "My Dashboard",
  reservations: "My Rentals",
  profile: "Driver Profile",
};
const staffUrl = (section) => "/manage?view=" + section;
const customerUrl = (section) =>
  ({ dashboard: "/dashboard", reservations: "/my-rentals", profile: "/account-setup" })[section];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
const pill = (status) => /* HTML */ `
  <span class="pill ${esc(status.toLowerCase())}">${esc(status)}</span>
`;
const fullName = (user) => user.first_name + " " + user.last_name;
let account;
let view;

async function api(route, method = "GET", body) {
  const response = await fetch("/api/rentals/" + route, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (response.status === 401) {
    location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
  }
  if (!response.ok) {
    throw new Error(result.message || "Please try again.");
  }
  return result;
}

const button = (label, action, ref = "", secondary = false) => /* HTML */ `
  <button
    class="button${secondary ? " secondary" : ""}"
    type="button"
    data-action="${action}"
    data-ref="${esc(ref)}"
  >
    ${esc(label)}
  </button>
`;
const actionCell = (label, action, id) => /* HTML */ `
  <button class="table-action" type="button" data-action="${action}" data-ref="${esc(id)}">
    ${esc(label)}
  </button>
`;
const heading = (title, subtitle, action = "") => /* HTML */ `
  <header class="heading">
    <div>
      <h1>${esc(title)}</h1>
      <p>${esc(subtitle)}</p>
    </div>
    ${action}
  </header>
`;
const stats = (entries) => /* HTML */ `
  <div class="stats">
    ${entries
      .map(
        ([label, value]) => /* HTML */ `
          <div class="metric">
            <p>${esc(label)}</p>
            <strong>${esc(value)}</strong>
          </div>
        `,
      )
      .join("")}
  </div>
`;
const empty = (message) => /* HTML */ `
  <p class="empty muted">${esc(message)}</p>
`;
const table = (headers, rows, message) =>
  rows.length
    ? /* HTML */ `
        <div class="table-wrap" tabindex="0" role="region" aria-label="Results">
          <table>
            <thead>
              <tr>
                ${headers
                  .map(
                    (label) => /* HTML */ `
                      <th scope="col">${esc(label)}</th>
                    `,
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => /* HTML */ `
                    <tr>
                      ${row
                        .map(
                          (cell) => /* HTML */ `
                            <td>${cell}</td>
                          `,
                        )
                        .join("")}
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
    : empty(message);
const details = (entries) => /* HTML */ `
  <dl>
    ${entries
      .map(
        ([label, value]) => /* HTML */ `
          <dt>${esc(label)}</dt>
          <dd>${esc(value || "—")}</dd>
        `,
      )
      .join("")}
  </dl>
`;
const options = (items, selected) =>
  items
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`,
    )
    .join("");
const field = (label, name, value = "", type = "text", attrs = "required") =>
  `<label>
    ${esc(label)}
    <input name="${name}" type="${type}" value="${esc(value)}" ${attrs}>
  </label>`;
const select = (label, name, choices, selected = "", prompt = "Select an option") => /* HTML */ `
  <label>
    ${esc(label)}
    <select name="${name}" required>
      <option value="">${esc(prompt)}</option>
      ${options(choices, selected)}
    </select>
  </label>
`;
const data = (form) => Object.fromEntries(new FormData(form));
const record = (rows, id) => rows.find((item) => String(item.id) === String(id));

function showDialog(title, body) {
  document.querySelector("#dialog-title").textContent = title;
  dialogBody.innerHTML = body;
  dialogStatus.textContent = "";
  if (!dialog.open) {
    dialog.showModal();
  }
}

function setupSubmit(form, status, onSubmit) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter || form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = "";
    try {
      await onSubmit(data(form));
    } catch (error) {
      status.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });
}

function announce(message) {
  notice.textContent = message;
  notice.focus();
}

function reservationRows(reservations, compact = false) {
  const headers = [
    "Reference",
    ...(account.staff ? ["Customer"] : []),
    "Vehicle",
    ...(compact ? [] : ["Pickup", "Return", "Days"]),
    "Total",
    "Status",
  ];
  const rows = reservations.map((rental) => [
    actionCell("R-" + rental.id, "reservation", rental.id),
    ...(account.staff ? [esc(rental.customer)] : []),
    esc(rental.vehicle),
    ...(compact ? [] : [esc(rental.pickup_date), esc(rental.return_date), esc(rental.days)]),
    esc(money.format(rental.total)),
    pill(rental.status),
  ]);
  return table(headers, rows, "No reservations to show.");
}

function filters(labels, render, initial = labels[0]) {
  const controls = content.querySelector(".tabs");
  function apply(label) {
    controls
      .querySelectorAll("button")
      .forEach((item) => item.setAttribute("aria-pressed", String(item.textContent === label)));
    content.querySelector("#results").innerHTML = render(label);
  }
  controls.innerHTML = labels
    .map(
      (label) => /* HTML */ `
        <button type="button">${esc(label)}</button>
      `,
    )
    .join("");
  controls.addEventListener("click", (event) => {
    const item = event.target.closest("button");
    if (item) {
      apply(item.textContent);
    }
  });
  apply(initial);
}

function count(rows, key, status) {
  return rows.filter((row) => row[key] === status).length;
}

function totalFor(reservations, status) {
  return money.format(
    reservations
      .filter((record) => record.status === status)
      .reduce((sum, record) => sum + Number(record.total), 0),
  );
}

async function dashboard() {
  const [reservations, fleet] = await Promise.all([
    api("reservations"),
    api(account.staff ? "inventory" : "fleet"),
  ]);
  if (account.staff) {
    content.innerHTML =
      heading("Dashboard", "Fleet and reservation activity", button("+ New reservation", "book")) +
      stats([
        ["Total fleet", fleet.length],
        ["Active rentals", count(reservations, "status", "Active")],
        ["Available vehicles", count(fleet, "fleet_status", "Available")],
        ["Completed rental value", totalFor(reservations, "Completed")],
      ]) +
      /* HTML */ `
        <div class="columns">
          <section class="panel">
            <h2>Recent reservations</h2>
            ${reservationRows(reservations.slice(0, 5), true)}
          </section>
          <section class="panel">
            <h2>Fleet status</h2>
            <ul>
              ${["Available", "Rented", "Maintenance"]
                .map(
                  (status) => /* HTML */ `
                    <li>
                      ${pill(status)}
                      <strong>${count(fleet, "fleet_status", status)} / ${fleet.length}</strong>
                    </li>
                  `,
                )
                .join("")}
            </ul>
          </section>
        </div>
      `;
    return;
  }
  const next =
    reservations.find((rental) => rental.status === "Active") ||
    reservations
      .filter((rental) => rental.status === "Upcoming")
      .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))[0];
  content.innerHTML =
    heading(
      "Welcome, " + account.first_name,
      "Manage your Wander Wheels rentals",
      button("+ Book a car", "book"),
    ) +
    (next
      ? /* HTML */ `
          <section class="panel">
            <h2>${next.status === "Active" ? "Current rental" : "Next rental"}</h2>
            ${details([
              ["Vehicle", next.vehicle],
              ["Pickup", next.pickup_date],
              ["Return", next.return_date],
            ])}
            ${actionCell("View reservation", "reservation", next.id)}
          </section>
        `
      : "") +
    stats([
      ["Total rentals", reservations.length],
      ["Completed rentals", count(reservations, "status", "Completed")],
      ["Completed rental value", totalFor(reservations, "Completed")],
    ]) +
    /* HTML */ `
      <div class="columns">
        <section class="panel">
          <h2>Recent rentals</h2>
          ${reservationRows(reservations.slice(0, 5), true)}
        </section>
        <section class="panel">
          <h2>Browse the fleet</h2>
          <ul>
            ${fleet
              .slice(0, 5)
              .map(
                (car) => /* HTML */ `
                  <li>
                    ${actionCell(car.name, "book", car.id)}
                    <span>${esc(money.format(car.daily_rate))}/day</span>
                  </li>
                `,
              )
              .join("")}
          </ul>
          ${fleet.length ? "" : empty("No vehicles are available.")}
        </section>
      </div>
    `;
}

async function fleetPage() {
  const fleet = await api("inventory");
  content.innerHTML =
    heading(
      view === "maintenance" ? "Vehicle Maintenance" : "Fleet",
      fleet.length + " vehicles registered",
      button("+ Add vehicle", "vehicle"),
    ) + /* HTML */ `<div class="tabs" aria-label="Fleet status"></div>
      <div id="results"></div>`;
  filters(
    ["All", "Available", "Rented", "Maintenance"],
    (status) =>
      table(
        ["ID", "Vehicle", "Year", "Plate", "Category", "Mileage", "Daily rate", "Status"],
        fleet
          .filter((car) => status === "All" || car.fleet_status === status)
          .map((car) => [
            actionCell("V-" + car.id, "vehicle", car.id),
            esc(car.name),
            esc(car.model_year),
            esc(car.plate),
            esc(car.category),
            esc(Number(car.mileage).toLocaleString("en-PH") + " km"),
            esc(money.format(car.daily_rate)),
            pill(car.fleet_status),
          ]),
        "No vehicles match this status.",
      ),
    view === "maintenance" ? "Maintenance" : "All",
  );
}

async function reservationsPage() {
  const reservations = await api("reservations");
  content.innerHTML =
    heading(
      account.staff ? "Reservations" : "My Rentals",
      account.staff
        ? "Review reservations and update pickup and return status"
        : "Track and manage your bookings",
      button(account.staff ? "+ New reservation" : "+ Book a car", "book"),
    ) +
    stats([
      ["Active", count(reservations, "status", "Active")],
      ["Upcoming", count(reservations, "status", "Upcoming")],
      ["Completed", count(reservations, "status", "Completed")],
      ["Completed rental value", totalFor(reservations, "Completed")],
    ]) +
    /* HTML */ `<div class="tabs" aria-label="Reservation status"></div>
      <div id="results"></div>`;
  filters(["All", "Active", "Upcoming", "Completed", "Cancelled"], (filter) =>
    reservationRows(reservations.filter((rental) => filter === "All" || rental.status === filter)),
  );
}

async function directory() {
  const customers = await api("customers");
  const isLicense = view === "licenses";
  const isUsers = view === "users";
  const licenseStatus = (person) =>
    !person.license_expiry ? "Incomplete" : person.license_expiry < today ? "Expired" : "Valid";
  const headers = isLicense
    ? ["User ID", "Driver", "License number", "Expiry date", "Status"]
    : isUsers
      ? [
          "User ID",
          "Last name",
          "First name",
          "Phone",
          "Email",
          "Social media",
          "License number",
          "Status",
        ]
      : ["User ID", "Customer", "Email", "Phone", "Rentals", "Joined", "License status"];
  const rows = isLicense ? customers.filter((person) => person.license_number) : customers;
  content.innerHTML =
    heading(
      staffLinks[view],
      rows.length + " records",
      view === "customers" ? button("+ Add customer", "add-customer") : "",
    ) +
    '<label class="filter">Filter records<input type="search" id="directory-filter" placeholder="Search name, email, or license"></label><div id="results"></div>';
  function draw(query) {
    const matched = rows.filter((person) =>
      [
        person.first_name,
        person.last_name,
        fullName(person),
        person.email,
        person.license_number,
        licenseStatus(person),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
    content.querySelector("#results").innerHTML = table(
      headers,
      matched.map((person) => {
        const link = actionCell("U-" + person.id, "customer", person.id);
        const status = pill(licenseStatus(person));
        if (isLicense) {
          return [
            link,
            esc(fullName(person)),
            esc(person.license_number),
            esc(person.license_expiry),
            status,
          ];
        }
        if (isUsers) {
          return [
            link,
            esc(person.last_name),
            esc(person.first_name),
            esc(person.phone || "—"),
            esc(person.email),
            esc(person.social_url || "—"),
            esc(person.license_number || "—"),
            status,
          ];
        }
        return [
          link,
          esc(fullName(person)),
          esc(person.email),
          esc(person.phone || "—"),
          esc(person.rentals),
          esc(person.joined),
          status,
        ];
      }),
      "No records match your search.",
    );
  }
  content
    .querySelector("#directory-filter")
    .addEventListener("input", (event) => draw(event.target.value.trim().toLowerCase()));
  draw("");
}

async function inquiriesPage() {
  const inquiries = await api("inquiries");
  content.innerHTML =
    heading("Inquiries", "Rental requests submitted from the Contact page") +
    table(
      ["Reference", "Customer", "Email", "Vehicle", "Pickup", "Drop-off"],
      inquiries.map((row) => [
        actionCell("Q-" + row.id, "inquiry", row.id),
        esc(fullName(row)),
        esc(row.email),
        esc(row.vehicle),
        esc(row.pickup_at),
        esc(row.dropoff_at),
      ]),
      "No rental inquiries yet.",
    );
}

function profilePage() {
  const firstSetup = !account.license_number;
  content.innerHTML =
    heading(
      firstSetup ? "Finish account setup" : "Driver profile",
      "Save the contact and license information required for a reservation.",
    ) +
    /* HTML */ `
      <form class="panel profile" id="driver-form">
        ${field("Phone number", "phone", account.phone, "tel", 'maxlength="30" required autocomplete="tel"')}
        ${field("Social media link (optional)", "social", account.social_url, "url", 'maxlength="254"')}
        <div class="form-grid">
          ${field("License number", "license", account.license_number, "text", 'maxlength="40" required')}
          ${field("License expiry", "licenseExpiry", account.license_expiry, "date", `min="${today}" required`)}
        </div>
        <div class="actions">
          <button type="submit" class="button">Save profile</button>
          <a class="button secondary" href="/dashboard">Back to dashboard</a>
        </div>
      </form>
    `;
  setupSubmit(content.querySelector("form"), notice, async (form) => {
    await api("profile", "PUT", form);
    const next = params.get("next");
    if (firstSetup || next?.startsWith("/dashboard?")) {
      location.assign(next?.startsWith("/dashboard?") ? next : "/dashboard");
    } else {
      account = await api("account");
      announce("Driver profile saved.");
    }
  });
}

async function reservationDetails(ref) {
  const rental = record(await api("reservations"), ref);
  if (!rental) {
    throw new Error("Reservation not found.");
  }
  const canCancel = rental.status === "Upcoming" || (account.staff && rental.status === "Active");
  const canStart = account.staff && rental.status === "Upcoming" && rental.pickup_date <= today;
  const canComplete = account.staff && rental.status === "Active";
  showDialog(
    "Reservation R-" + rental.id,
    details([
      ["Customer", rental.customer],
      ["Vehicle", rental.vehicle],
      ["Pickup", rental.pickup_date],
      ["Return", rental.return_date],
      ["Rental days", rental.days],
      ["Total", money.format(rental.total)],
      ["Status", rental.status],
    ]) +
      /* HTML */ `
        <div class="actions">
          ${canStart ? button("Mark picked up", "transition", "Active") : ""}
          ${canComplete ? button("Mark returned", "transition", "Completed") : ""}
          ${canCancel ? button("Cancel rental", "ask-cancel", rental.id, true) : ""}
        </div>
      `,
  );
  dialog.dataset.record = rental.id;
}

async function booking(preselected) {
  if (!account.staff && (!account.license_expiry || account.license_expiry < today)) {
    const bookingParams = new URLSearchParams(params);
    bookingParams.set("book", preselected);
    const next = "/dashboard?" + bookingParams;
    showDialog(
      "Driver profile required",
      /* HTML */ `
        <p>Add a current driver's license before reserving a car.</p>
        <div class="actions">
          <a class="button" href="/account-setup?next=${encodeURIComponent(next)}">
            Update driver profile
          </a>
        </div>
      `,
    );
    return;
  }
  const [vehicles, customers] = await Promise.all([
    api("fleet"),
    account.staff ? api("customers") : [],
  ]);
  const eligible = customers.filter(
    (person) => person.license_expiry && person.license_expiry >= today,
  );
  if (account.staff && !eligible.length) {
    showDialog(
      "New reservation",
      empty("A customer must complete their driver profile before you can book for them."),
    );
    return;
  }
  const picked = vehicles.find((car) => String(car.id) === preselected || car.name === preselected);
  const queryPickup = params.get("pickup") || "";
  const queryReturn = params.get("return") || "";
  showDialog(
    account.staff ? "New reservation" : "Book a car",
    /* HTML */ `
      <form id="booking-form">
        ${
          account.staff
            ? select(
                "Customer",
                "customerId",
                eligible.map((person) => [person.id, fullName(person) + " · " + person.email]),
              )
            : ""
        }
        <div class="form-grid">
          ${field("Pickup date", "pickup", queryPickup, "date", `min="${today}" required`)}
          ${field("Return date", "return", queryReturn, "date", `min="${today}" required`)}
        </div>
        ${select(
          "Vehicle",
          "vehicleId",
          vehicles.map((car) => [car.id, car.name + " · " + money.format(car.daily_rate) + "/day"]),
          picked?.id,
        )}
        <p class="muted" id="booking-total" role="status"></p>
        <button type="submit" class="button">Confirm reservation</button>
      </form>
    `,
  );
  const form = dialogBody.querySelector("form");
  const dropdown = form.elements.vehicleId;
  const estimate = form.querySelector("#booking-total");
  const submit = form.querySelector("button");
  let available = vehicles;
  let request = 0;
  function refreshTotal() {
    const current = available.find((car) => String(car.id) === dropdown.value);
    const days =
      (Date.parse(form.elements.return.value) - Date.parse(form.elements.pickup.value)) / 86400000;
    estimate.textContent =
      current && days > 0
        ? `Estimated total for ${days} day${days === 1 ? "" : "s"} · ${money.format(days * current.daily_rate)}`
        : "";
  }
  async function checkDates() {
    const check = ++request;
    const current = dropdown.value;
    const { pickup, return: dropoff } = data(form);
    if (pickup && dropoff && dropoff <= pickup) {
      dropdown.disabled = false;
      submit.disabled = true;
      estimate.textContent = "Return must be after pickup.";
      return;
    }
    dropdown.disabled = true;
    submit.disabled = true;
    try {
      const matches =
        pickup && dropoff
          ? await api("fleet?" + new URLSearchParams({ pickup, return: dropoff }))
          : vehicles;
      if (check !== request) {
        return;
      }
      available = matches;
      dropdown.innerHTML =
        '<option value="">Select a vehicle</option>' +
        options(
          matches.map((car) => [car.id, car.name + " · " + money.format(car.daily_rate) + "/day"]),
          current,
        );
      refreshTotal();
      if (!matches.length) {
        estimate.textContent = "No vehicles are available for these dates.";
      }
    } catch (error) {
      if (check === request) {
        estimate.textContent = error.message;
      }
    } finally {
      if (check === request) {
        dropdown.disabled = false;
        submit.disabled = !available.length;
      }
    }
  }
  dropdown.addEventListener("change", refreshTotal);
  form.elements.pickup.addEventListener("change", checkDates);
  form.elements.return.addEventListener("change", checkDates);
  checkDates();
  setupSubmit(form, dialogStatus, async (values) => {
    const result = await api("reservations", "POST", values);
    dialog.close();
    await load();
    announce(`Reservation R-${result.id} created. Total ${money.format(result.total)}.`);
  });
}

async function editVehicle(ref) {
  const car = ref ? record(await api("inventory"), ref) : {};
  if (!car) {
    throw new Error("Vehicle not found.");
  }
  showDialog(
    ref ? "Edit vehicle" : "Add vehicle",
    /* HTML */ `
      <form>
        ${field("Vehicle name", "name", car.name, "text", 'maxlength="100" required')}
        <div class="form-grid">
          ${field("Model year", "year", car.model_year, "number", 'min="1900" required')}
          ${field("Plate", "plate", car.plate, "text", 'maxlength="24" required')}
        </div>
        ${field("Category", "category", car.category, "text", 'maxlength="40" required')}
        <div class="form-grid">
          ${field("Mileage (km)", "mileage", car.mileage, "number", 'min="0" max="2000000" required')}
          ${field("Daily rate (PHP)", "rate", car.daily_rate, "number", 'min="1" max="1000000" required')}
        </div>
        ${select(
          "Fleet status",
          "status",
          [
            ["Available", "Available"],
            ["Maintenance", "Maintenance"],
          ],
          car.status || "Available",
        )}
        <button class="button" type="submit">Save vehicle</button>
      </form>
    `,
  );
  setupSubmit(dialogBody.querySelector("form"), dialogStatus, async (values) => {
    await api(ref ? "inventory/" + ref : "inventory", ref ? "PUT" : "POST", values);
    dialog.close();
    await load();
    announce("Vehicle saved.");
  });
}

async function load() {
  if (view === "dashboard") {
    return dashboard();
  }
  if (view === "reservations") {
    return reservationsPage();
  }
  if (view === "profile") {
    return profilePage();
  }
  if (view === "fleet" || view === "maintenance") {
    return fleetPage();
  }
  if (view === "inquiries") {
    return inquiriesPage();
  }
  return directory();
}

const actions = {
  book: booking,
  vehicle: editVehicle,
  reservation: reservationDetails,
  "add-customer"() {
    showDialog(
      "Add customer",
      /* HTML */ `
        <form>
          <div class="form-grid">
            ${field("First name", "firstName", "", "text", 'maxlength="80" required')}
            ${field("Last name", "lastName", "", "text", 'maxlength="80" required')}
          </div>
          ${field("Email", "email", "", "email", 'maxlength="254" required')}
          ${field("Initial password", "password", "", "password", 'minlength="8" maxlength="128" autocomplete="new-password" required')}
          <p class="muted">The customer can sign in and complete their own driver profile.</p>
          <button type="submit" class="button">Create customer</button>
        </form>
      `,
    );
    setupSubmit(dialogBody.querySelector("form"), dialogStatus, async (values) => {
      await api("customers", "POST", values);
      dialog.close();
      await load();
      announce("Customer account created.");
    });
  },
  async customer(ref) {
    const person = record(await api("customers"), ref);
    if (!person) {
      throw new Error("Customer not found.");
    }
    showDialog(
      fullName(person),
      details([
        ["Email", person.email],
        ["Phone", person.phone],
        ["Social media", person.social_url],
        ["License", person.license_number],
        ["Expiry", person.license_expiry],
        ["Joined", person.joined],
      ]),
    );
  },
  async inquiry(ref) {
    const row = record(await api("inquiries"), ref);
    if (!row) {
      throw new Error("Inquiry not found.");
    }
    showDialog(
      "Inquiry Q-" + row.id,
      details([
        ["Customer", fullName(row)],
        ["Email", row.email],
        ["Phone", row.phone],
        ["Vehicle", row.vehicle],
        ["Passengers", row.passengers],
        ["Rental days", row.rental_days],
        ["Handover", row.handover],
        ["Pickup", row.pickup_at],
        ["Pickup location", row.pickup_location],
        ["Delivery address", row.delivery_address],
        ["Drop-off", row.dropoff_at],
        ["Drop-off location", row.dropoff_location],
        ["Payment preference", row.payment_method],
        ["Message", row.message],
      ]),
    );
  },
  "ask-cancel"(ref) {
    showDialog(
      "Cancel reservation R-" + ref + "?",
      /* HTML */ `
        <p>This will release the reserved dates for others to book.</p>
        <div class="actions">
          ${button("Keep reservation", "reservation", ref, true)}${button("Confirm cancellation", "transition", "Cancelled")}
        </div>
      `,
    );
  },
  async transition(status) {
    await api("reservations/" + dialog.dataset.record, "PUT", { status });
    dialog.close();
    await load();
    announce("Reservation updated to " + status.toLowerCase() + ".");
  },
};

document.addEventListener("click", async (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) {
    return;
  }
  trigger.disabled = true;
  try {
    await actions[trigger.dataset.action](trigger.dataset.ref);
  } catch (error) {
    if (dialog.open) {
      dialogStatus.textContent = error.message;
    } else {
      announce(error.message);
    }
  } finally {
    trigger.disabled = false;
  }
});

document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#sign-out").addEventListener("click", async (event) => {
  event.target.disabled = true;
  try {
    const response = await fetch("/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error("Could not sign out. Try again.");
    }
    location.assign("/login");
  } catch (error) {
    announce(error.message);
    event.target.disabled = false;
  }
});

async function start() {
  account = await api("account");
  const managing = location.pathname === "/manage";
  if (managing && !account.staff) {
    content.innerHTML = heading("Staff access required", "This area is for Wander Wheels staff.");
    navigation.innerHTML = '<a href="/dashboard">My Dashboard</a>';
    return;
  }
  if (account.staff && !managing) {
    params.set("view", "dashboard");
    location.replace("/manage?" + params);
    return;
  }
  const links = account.staff ? staffLinks : customerLinks;
  const pathViews = { "/account-setup": "profile", "/my-rentals": "reservations" };
  const section = managing ? params.get("view") : pathViews[location.pathname];
  view = Object.hasOwn(links, section) ? section : "dashboard";
  document.title = links[view] + " | Wander Wheels";
  document.body.classList.toggle("customer", !account.staff);
  document.querySelector("#account-name").textContent = fullName(account);
  navigation.innerHTML =
    Object.entries(links)
      .map(
        ([key, label]) =>
          `<a href="${account.staff ? staffUrl(key) : customerUrl(key)}"${view === key ? ' aria-current="page"' : ""}>${esc(label)}</a>`,
      )
      .join("") + '<a href="/home">Public site</a>';
  await load();
  if (view === "dashboard" && params.has("book")) {
    await booking(params.get("book"));
  }
}

start().catch((error) => {
  content.innerHTML = heading("Rental workspace unavailable", error.message);
});
