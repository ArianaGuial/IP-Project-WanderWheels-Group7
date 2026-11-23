"use strict";

const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
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

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = contactForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  formStatus.textContent = "Submitting your request…";
  try {
    const response = await fetch(contactForm.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(contactForm))),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Could not submit your inquiry.");
    }
    contactForm.reset();
    contactForm.elements.dropoffDate.min = today;
    toggleAddress();
    formStatus.textContent = "Your request was received. Reference Q-" + result.id + ".";
  } catch (error) {
    formStatus.textContent = error.message || "Could not submit your inquiry. Try again.";
  } finally {
    submit.disabled = false;
    formStatus.focus();
  }
});
