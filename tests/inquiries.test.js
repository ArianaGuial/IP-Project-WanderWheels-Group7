"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const { registerRentalRoutes } = require("../lib/rentals");

test("saved Contact inquiries send through Gmail to each submitted address", async (t) => {
  const config = {
    GMAIL_CLIENT_ID: "test-client",
    GMAIL_CLIENT_SECRET: "test-secret",
    GMAIL_REFRESH_TOKEN: "test-refresh",
    GMAIL_SENDER_EMAIL: "bookings@example.test",
  };
  const previous = Object.fromEntries(Object.keys(config).map(name => [name, process.env[name]]));
  Object.assign(process.env, config);
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  const inquiries = [];
  const refreshes = [];
  const sends = [];
  let sendStatus = 200;
  let tokenStatus = 200;
  let gmailMessageId = "test-message-id";
  const fetchLocal = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.method, "POST");
    if (url === "https://oauth2.googleapis.com/token") {
      refreshes.push(Object.fromEntries(options.body));
      return tokenStatus === 200
        ? Response.json({ access_token: "test-access", expires_in: 3600 })
        : Response.json({ error: "invalid_grant" }, { status: tokenStatus });
    }
    assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    const { raw } = JSON.parse(options.body);
    sends.push({
      token: options.headers.Authorization,
      message: Buffer.from(raw, "base64url").toString("utf8"),
      saved: inquiries.length,
    });
    return Response.json({ id: gmailMessageId }, { status: sendStatus });
  });

  const app = express();
  app.use(express.json());
  registerRentalRoutes(app, {
    async execute(sql, params) {
      assert.match(sql, /^INSERT INTO rental_inquiries/);
      inquiries.push(params);
      return [{ insertId: inquiries.length }];
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  async function submit(email) {
    const response = await fetchLocal(
      `http://127.0.0.1:${server.address().port}/api/rentals/inquiries`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Test",
          lastName: "Driver",
          email,
          phone: "000",
          vehicle: "SUV",
          passengers: 2,
          days: 1,
          handover: "Pickup",
          pickupDate: date,
          pickupTime: "09:00",
          pickupLocation: "Cebu City",
          dropoffDate: date,
          dropoffTime: "15:00",
          dropoffLocation: "Cebu City",
          payment: "Cash",
        }),
      },
    );
    assert.equal(response.status, 201);
    return response.json();
  }

  assert.deepEqual(await submit("first@example.test"), { id: 1, notification: "accepted" });
  assert.deepEqual(await submit("second@example.test"), { id: 2, notification: "accepted" });
  assert.deepEqual(refreshes, [{
    client_id: config.GMAIL_CLIENT_ID,
    client_secret: config.GMAIL_CLIENT_SECRET,
    refresh_token: config.GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }]);
  assert.match(sends[0].message, /^From: Wander Wheels <bookings@example\.test>\r\nTo: first@example\.test\r\n/);
  assert.match(sends[1].message, /\r\nTo: second@example\.test\r\n/);
  assert.match(sends[0].message, /Subject: We received your rental inquiry \(Q-1\)/);
  assert.ok(sends[0].message.includes(date));
  assert.equal(sends[0].token, "Bearer test-access");
  assert.deepEqual(sends.map(send => send.saved), [1, 2]);

  assert.deepEqual(await submit("first@example.test"), { id: 3, notification: "limited" });

  gmailMessageId = undefined;
  assert.deepEqual(await submit("third@example.test"), { id: 4, notification: "failed" });

  sendStatus = 401;
  assert.deepEqual(await submit("fourth@example.test"), { id: 5, notification: "failed" });
  tokenStatus = 400;
  assert.deepEqual(await submit("fifth@example.test"), { id: 6, notification: "failed" });
  assert.equal(refreshes.length, 2);

  delete process.env.GMAIL_REFRESH_TOKEN;
  assert.deepEqual(await submit("sixth@example.test"), { id: 7, notification: "skipped" });
  assert.equal(inquiries.length, 7);
  assert.equal(sends.length, 4);
});
