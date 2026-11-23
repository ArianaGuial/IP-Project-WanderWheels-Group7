"use strict";

const path = require("path");
const { hashPassword } = require("./password");

const manila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
const day = 86400000;
const customerFields =
  "u.id, u.first_name, u.last_name, u.email, p.phone, p.social_url, p.license_number, p.license_expiry";
const reservationFields = `r.id, r.user_id, r.vehicle_id, r.pickup_date, r.return_date, r.total, r.status,
  v.name AS vehicle, CONCAT(u.first_name, ' ', u.last_name) AS customer,
  DATEDIFF(r.return_date, r.pickup_date) AS days`;
const reservationJoin =
  "FROM reservations r JOIN users u ON u.id = r.user_id JOIN vehicles v ON v.id = r.vehicle_id";

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function value(input, max, label, required = true) {
  const result = typeof input === "string" ? input.trim() : "";
  if (result.length > max || (required && !result)) {
    fail(400, `Enter a valid ${label}.`);
  }
  return result;
}

function number(input, min, max, label) {
  const result =
    typeof input === "number" || (typeof input === "string" && /^\d+$/.test(input))
      ? Number(input)
      : NaN;
  if (!Number.isInteger(result) || result < min || result > max) {
    fail(400, `Enter a valid ${label}.`);
  }
  return result;
}

function date(input) {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    fail(400, "Enter a valid date.");
  }
  const time = Date.parse(input);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== input) {
    fail(400, "Enter a valid date.");
  }
  return time;
}

function time(input) {
  if (typeof input !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) {
    fail(400, "Enter a valid time.");
  }
  return input;
}

function today() {
  return manila.format(new Date());
}

function id(input) {
  return number(input, 1, 4294967295, "record ID");
}

async function transaction(pool, work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function actor(req, pool) {
  if (!req.session.userId) {
    fail(401, "Sign in to continue.");
  }
  const [rows] = await pool.execute(
    `SELECT ${customerFields}, s.user_id IS NOT NULL AS staff
    FROM users u LEFT JOIN driver_profiles p ON p.user_id = u.id
    LEFT JOIN rental_staff s ON s.user_id = u.id WHERE u.id = ?`,
    [req.session.userId],
  );
  if (!rows[0]) {
    fail(401, "Sign in to continue.");
  }
  return rows[0];
}

function registerRentalRoutes(app, pool) {
  function page(req, res) {
    if (!req.session.userId) {
      const next = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login?next=${next}`);
    }
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "../rentals.html"));
  }

  app.get(["/dashboard", "/account-setup", "/my-rentals", "/manage"], page);

  function route(method, name, access, action) {
    app[method](`/api/rentals/${name}`, async (req, res) => {
      res.set("Cache-Control", "no-store");
      try {
        if (method !== "get" && !req.is("application/json")) {
          fail(415, "Send the form as JSON.");
        }
        const user = access === "public" ? null : await actor(req, pool);
        if (access === "staff" && !user.staff) {
          fail(403, "Staff access is required.");
        }
        const result = await action(req, user);
        res.status(method === "post" ? 201 : 200).json(result);
      } catch (error) {
        if (error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        if (error.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            message: name.startsWith("inventory")
              ? "That plate number is already in use."
              : "That email address is already registered.",
          });
        }
        console.error("Rental operation failed:", error.code || error.message);
        res
          .status(503)
          .json({
            message:
              "Rental services are unavailable. Check MySQL and import database/rentals.sql.",
          });
      }
    });
  }

  route("get", "account", "user", (req, user) => user);

  route("put", "profile", "user", async ({ body }, user) => {
    if (user.staff) {
      fail(403, "Driver profiles are for customers.");
    }
    date(body.licenseExpiry);
    if (body.licenseExpiry < today()) {
      fail(400, "Enter an unexpired license.");
    }
    const social = value(body.social, 254, "social media link", false);
    if (social) {
      let url;
      try {
        url = new URL(social);
      } catch {
        fail(400, "Enter a valid social media URL.");
      }
      if (!["https:", "http:"].includes(url.protocol)) {
        fail(400, "Enter a valid social media URL.");
      }
    }
    await pool.execute(
      `INSERT INTO driver_profiles (user_id, phone, social_url, license_number, license_expiry)
      VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE phone = VALUES(phone), social_url = VALUES(social_url),
      license_number = VALUES(license_number), license_expiry = VALUES(license_expiry)`,
      [
        user.id,
        value(body.phone, 30, "phone number"),
        social,
        value(body.license, 40, "license number").toUpperCase(),
        body.licenseExpiry,
      ],
    );
    return { message: "Driver profile saved." };
  });

  route("get", "fleet", "public", async ({ query }) => {
    const [vehicles] = await pool.execute(`SELECT id, name, category, daily_rate
      FROM vehicles WHERE status = 'Available' ORDER BY name`);
    if (query.pickup === undefined && query.return === undefined) {
      return vehicles;
    }
    if (date(query.return) <= date(query.pickup)) {
      fail(400, "Return must be after pickup.");
    }
    const [overlaps] = await pool.execute(
      `SELECT DISTINCT vehicle_id FROM reservations
      WHERE status IN ('Upcoming','Active') AND pickup_date < ? AND return_date > ?`,
      [query.return, query.pickup],
    );
    const occupied = new Set(overlaps.map((record) => record.vehicle_id));
    return vehicles.filter((vehicle) => !occupied.has(vehicle.id));
  });

  route("get", "inventory", "staff", async () => {
    const [rows] = await pool.execute(`SELECT v.*, CASE WHEN EXISTS
      (SELECT 1 FROM reservations r WHERE r.vehicle_id = v.id AND r.status = 'Active')
      THEN 'Rented' ELSE v.status END AS fleet_status FROM vehicles v ORDER BY v.name`);
    return rows;
  });

  function vehicleFields(body) {
    if (!["Available", "Maintenance"].includes(body.status)) {
      fail(400, "Select a vehicle status.");
    }
    return [
      value(body.name, 100, "vehicle name"),
      number(body.year, 1900, Number(today().slice(0, 4)) + 1, "model year"),
      value(body.plate, 24, "plate number").toUpperCase(),
      value(body.category, 40, "category"),
      number(body.mileage, 0, 2000000, "mileage"),
      number(body.rate, 1, 1000000, "daily rate"),
      body.status,
    ];
  }

  route("post", "inventory", "staff", async ({ body }) => {
    const [result] = await pool.execute(
      `INSERT INTO vehicles (name, model_year, plate, category, mileage, daily_rate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      vehicleFields(body),
    );
    return { id: result.insertId };
  });

  route("put", "inventory/:id", "staff", ({ params, body }) =>
    transaction(pool, async (connection) => {
      const vehicleId = id(params.id);
      const fields = vehicleFields(body);
      const [vehicles] = await connection.execute(
        "SELECT id FROM vehicles WHERE id = ? FOR UPDATE",
        [vehicleId],
      );
      if (!vehicles.length) {
        fail(404, "Vehicle not found.");
      }
      if (body.status === "Maintenance") {
        const [open] = await connection.execute(
          `SELECT id FROM reservations WHERE vehicle_id = ?
        AND status IN ('Upcoming', 'Active') LIMIT 1 FOR UPDATE`,
          [vehicleId],
        );
        if (open.length) {
          fail(409, "Complete or cancel open reservations before scheduling maintenance.");
        }
      }
      await connection.execute(
        `UPDATE vehicles SET name = ?, model_year = ?, plate = ?, category = ?,
      mileage = ?, daily_rate = ?, status = ? WHERE id = ?`,
        [...fields, vehicleId],
      );
      return { id: vehicleId };
    }),
  );

  route("get", "reservations", "user", async (req, user) => {
    const [rows] = await pool.execute(
      `SELECT ${reservationFields} ${reservationJoin}
      ${user.staff ? "" : "WHERE r.user_id = ?"} ORDER BY r.id DESC`,
      user.staff ? [] : [user.id],
    );
    return rows;
  });

  route("post", "reservations", "user", ({ body }, user) =>
    transaction(pool, async (connection) => {
      const vehicleId = id(body.vehicleId);
      const customerId = user.staff ? id(body.customerId) : user.id;
      const days = (date(body.return) - date(body.pickup)) / day;
      if (body.pickup < today() || days < 1 || days > 90) {
        fail(400, "Select a pickup from today onward and a rental of 1–90 days.");
      }
      const [vehicles] = await connection.execute(
        "SELECT id, daily_rate, status FROM vehicles WHERE id = ? FOR UPDATE",
        [vehicleId],
      );
      if (vehicles[0]?.status !== "Available") {
        fail(409, "This vehicle is unavailable.");
      }
      const [profiles] = await connection.execute(
        `SELECT p.license_expiry FROM driver_profiles p
      LEFT JOIN rental_staff s ON s.user_id = p.user_id WHERE p.user_id = ? AND s.user_id IS NULL`,
        [customerId],
      );
      if (!profiles[0] || profiles[0].license_expiry < body.return) {
        fail(400, "The driver needs a license valid through the return date.");
      }
      const [overlaps] = await connection.execute(
        `SELECT id FROM reservations WHERE vehicle_id = ?
      AND status IN ('Upcoming','Active') AND pickup_date < ? AND return_date > ? LIMIT 1 FOR UPDATE`,
        [vehicleId, body.return, body.pickup],
      );
      if (overlaps.length) {
        fail(409, "This vehicle was reserved for those dates. Choose another vehicle or date.");
      }
      const total = days * vehicles[0].daily_rate;
      const [result] = await connection.execute(
        `INSERT INTO reservations (user_id, vehicle_id, pickup_date, return_date, total)
      VALUES (?, ?, ?, ?, ?)`,
        [customerId, vehicleId, body.pickup, body.return, total],
      );
      return { id: result.insertId, total };
    }),
  );

  route("put", "reservations/:id", "user", ({ params, body }, user) =>
    transaction(pool, async (connection) => {
      const reservationId = id(params.id);
      const [initial] = await connection.execute(
        "SELECT vehicle_id FROM reservations WHERE id = ?",
        [reservationId],
      );
      if (!initial.length) {
        fail(404, "Reservation not found.");
      }
      const [vehicles] = await connection.execute(
        "SELECT status FROM vehicles WHERE id = ? FOR UPDATE",
        [initial[0].vehicle_id],
      );
      const [rows] = await connection.execute(
        "SELECT * FROM reservations WHERE id = ? FOR UPDATE",
        [reservationId],
      );
      const reservation = rows[0];
      if (!reservation || (!user.staff && reservation.user_id !== user.id)) {
        fail(404, "Reservation not found.");
      }
      const transitions = { Upcoming: ["Active", "Cancelled"], Active: ["Completed", "Cancelled"] };
      if (
        !transitions[reservation.status]?.includes(body.status) ||
        (!user.staff && (reservation.status !== "Upcoming" || body.status !== "Cancelled"))
      ) {
        fail(409, "That status change is unavailable.");
      }
      if (body.status === "Active") {
        if (reservation.pickup_date > today()) {
          fail(409, "Start this rental on or after its pickup date.");
        }
        const [active] = await connection.execute(
          `SELECT id FROM reservations WHERE vehicle_id = ?
        AND status = 'Active' LIMIT 1 FOR UPDATE`,
          [reservation.vehicle_id],
        );
        if (vehicles[0].status === "Maintenance" || active.length) {
          fail(409, "The vehicle is unavailable for pickup.");
        }
      }
      await connection.execute("UPDATE reservations SET status = ? WHERE id = ?", [
        body.status,
        reservationId,
      ]);
      return { id: reservationId, status: body.status };
    }),
  );

  route("get", "customers", "staff", async () => {
    const [rows] = await pool.execute(`SELECT ${customerFields}, DATE(u.created_at) AS joined,
      (SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id) AS rentals
      FROM users u LEFT JOIN driver_profiles p ON p.user_id = u.id
      LEFT JOIN rental_staff s ON s.user_id = u.id WHERE s.user_id IS NULL
      ORDER BY u.last_name, u.first_name`);
    return rows;
  });

  route("post", "customers", "staff", async ({ body }) => {
    const email = value(body.email, 254, "email address").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(400, "Enter a valid email address.");
    }
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      fail(400, "Use an initial password of 8–128 characters.");
    }
    const [result] = await pool.execute(
      "INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)",
      [
        value(body.firstName, 80, "first name"),
        value(body.lastName, 80, "last name"),
        email,
        await hashPassword(body.password),
      ],
    );
    return { id: result.insertId };
  });

  route("get", "inquiries", "staff", async () => {
    const [rows] = await pool.execute("SELECT * FROM rental_inquiries ORDER BY id DESC");
    return rows;
  });

  route("post", "inquiries", "public", async ({ body }) => {
    const email = value(body.email, 254, "email address").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(400, "Enter a valid email address.");
    }
    if (!["Pickup", "Delivery"].includes(body.handover)) {
      fail(400, "Select pickup or delivery.");
    }
    const pickup = date(body.pickupDate);
    const dropoff = date(body.dropoffDate);
    const pickupTime = time(body.pickupTime);
    const dropoffTime = time(body.dropoffTime);
    if (
      body.pickupDate < today() ||
      dropoff < pickup ||
      (dropoff === pickup && dropoffTime <= pickupTime)
    ) {
      fail(400, "Enter a pickup from today onward and a later drop-off.");
    }
    const [result] = await pool.execute(
      `INSERT INTO rental_inquiries (first_name, last_name, email, phone, vehicle,
      passengers, rental_days, handover, pickup_at, pickup_location, delivery_address, dropoff_at, dropoff_location, payment_method, message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        value(body.firstName, 80, "first name"),
        value(body.lastName, 80, "last name"),
        email,
        value(body.phone, 30, "phone number"),
        value(body.vehicle, 100, "vehicle type or model"),
        number(body.passengers, 1, 30, "passenger count"),
        number(body.days, 1, 90, "rental days"),
        body.handover,
        `${body.pickupDate} ${pickupTime}:00`,
        value(body.pickupLocation, 150, "pickup location"),
        body.handover === "Delivery" ? value(body.address, 250, "delivery address") : "",
        `${body.dropoffDate} ${dropoffTime}:00`,
        value(body.dropoffLocation, 150, "drop-off location"),
        value(body.payment, 40, "payment preference"),
        value(body.message, 3000, "message", false),
      ],
    );
    return { id: result.insertId };
  });
}

module.exports = { registerRentalRoutes };
