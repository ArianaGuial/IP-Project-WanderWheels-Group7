"use strict";

const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const submit = contactForm.querySelector('button[type="submit"]');
const submitLabel = document.getElementById("contact-submit-label");
const spinner = document.getElementById("contact-spinner");
const sentDialog = document.getElementById("inquiry-sent");
const sentEmail = document.getElementById("inquiry-sent-email");
const sentReference = document.getElementById("inquiry-sent-reference");
const handover = contactForm.elements.handover;
const address = contactForm.elements.address;

function toggleAddress() {
  const delivery = handover.value === "Delivery";
  address.closest("div").hidden = !delivery;
  address.required = delivery;
  address.disabled = !delivery;
}

handover.addEventListener("change", toggleAddress);
toggleAddress();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
contactForm.elements.pickupDate.min = today;
contactForm.elements.dropoffDate.min = today;
contactForm.elements.pickupDate.addEventListener("change", () => {
  contactForm.elements.dropoffDate.min = contactForm.elements.pickupDate.value || today;
});

function setSubmitting(pending) {
  submit.disabled = pending;
  submit.setAttribute("aria-busy", String(pending));
  submitLabel.textContent = pending ? "Submitting…" : "Submit inquiry";
  spinner.hidden = !pending;
}

sentDialog.addEventListener("close", () => submit.focus());

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) {
    return;
  }

  const inquiry = Object.fromEntries(new FormData(contactForm));
  let emailAccepted = false;
  setSubmitting(true);
  formStatus.textContent = "Saving your inquiry and sending the email…";
  try {
    const response = await fetch(contactForm.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiry),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Could not submit your inquiry.");
    }
    contactForm.reset();
    contactForm.elements.dropoffDate.min = today;
    toggleAddress();
    const reference = "Q-" + result.id;
    const emailStatus = {
      accepted: " Email sent.",
      failed: " The acknowledgment email could not be sent.",
      limited: " Email was skipped because of a temporary sending limit.",
      skipped: " An acknowledgment email was not sent.",
    };
    formStatus.textContent =
      "Your request was received. Reference " + reference + "." +
      (emailStatus[result.notification] ?? "");

    if (result.notification === "accepted") {
      sentEmail.textContent = inquiry.email.trim();
      sentReference.textContent = reference;
      emailAccepted = true;
    }
  } catch (error) {
    formStatus.textContent = error.message || "Could not submit your inquiry. Try again.";
  } finally {
    setSubmitting(false);
  }

  if (emailAccepted) {
    sentDialog.showModal();
  } else {
    formStatus.focus();
  }
});
