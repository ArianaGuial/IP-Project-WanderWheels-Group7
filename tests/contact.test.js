"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "assets/contact.js"), "utf8");
const markup = fs.readFileSync(path.join(root, "contact.html"), "utf8");

function element() {
  return {
    events: new Map(),
    attributes: new Map(),
    addEventListener(name, handler) {
      this.events.set(name, handler);
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    focus() {
      this.focused = true;
    },
  };
}

function mount(fetch) {
  const submit = element();
  const form = Object.assign(element(), {
    action: "/api/rentals/inquiries",
    elements: {
      handover: element(),
      address: { closest: () => ({}) },
      pickupDate: element(),
      dropoffDate: element(),
    },
    querySelector: () => submit,
    reset() {
      this.wasReset = true;
    },
  });
  const elements = new Map([
    ["contact-form", form],
    ["form-status", element()],
    ["contact-submit-label", element()],
    ["contact-spinner", { hidden: true }],
    ["inquiry-sent", Object.assign(element(), {
      showModal() {
        this.open = true;
      },
    })],
    ["inquiry-sent-email", element()],
    ["inquiry-sent-reference", element()],
  ]);

  for (const id of elements.keys()) {
    assert.ok(markup.includes('id="' + id + '"'), "Contact markup is missing " + id);
  }

  vm.runInNewContext(script, {
    document: { getElementById: (id) => elements.get(id) },
    fetch,
    FormData: function () {
      return [["email", "customer@example.test"]];
    },
  });
  return {
    submit,
    form,
    byId: (id) => elements.get(id),
    submitForm: () => form.events.get("submit")({ preventDefault() {} }),
  };
}

test("Contact shows loading during the request and opens the modal after email acceptance", async () => {
  let resolveRequest;
  let calls = 0;
  const ui = mount(() => {
    calls++;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  });
  const pending = ui.submitForm();

  assert.equal(ui.submit.disabled, true);
  assert.equal(ui.submit.attributes.get("aria-busy"), "true");
  assert.equal(ui.byId("contact-spinner").hidden, false);
  assert.match(ui.byId("contact-submit-label").textContent, /Submitting/);
  assert.ok(!ui.byId("inquiry-sent").open);
  await ui.submitForm();
  assert.equal(calls, 1);

  resolveRequest(Response.json({ id: 4, notification: "accepted" }, { status: 201 }));
  await pending;

  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.byId("contact-spinner").hidden, true);
  assert.equal(ui.byId("inquiry-sent").open, true);
  assert.equal(ui.byId("inquiry-sent-email").textContent, "customer@example.test");
  assert.equal(ui.byId("inquiry-sent-reference").textContent, "Q-4");
  assert.equal(ui.form.wasReset, true);
  ui.byId("inquiry-sent").events.get("close")();
  assert.equal(ui.submit.focused, true);
});

test("Contact keeps the modal closed when email is skipped or the request fails", async () => {
  for (const notification of ["failed", "limited", "skipped"]) {
    const ui = mount(async () => Response.json({ id: 4, notification }, { status: 201 }));
    await ui.submitForm();

    assert.ok(!ui.byId("inquiry-sent").open);
    assert.match(ui.byId("form-status").textContent, /Reference Q-4/);
    assert.equal(ui.submit.disabled, false);
    assert.equal(ui.byId("contact-spinner").hidden, true);
  }

  const ui = mount(async () => Response.json({ message: "Choose a pickup date." }, { status: 400 }));
  await ui.submitForm();

  assert.ok(!ui.byId("inquiry-sent").open);
  assert.equal(ui.byId("form-status").textContent, "Choose a pickup date.");
  assert.ok(!ui.form.wasReset);
  assert.equal(ui.submit.disabled, false);
});
