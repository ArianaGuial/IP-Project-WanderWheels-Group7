"use strict";

const authForm = document.getElementById("auth-form");
const formStatus = document.getElementById("auth-status");
const next = new URLSearchParams(window.location.search).get("next");
const rentalPages = ["/dashboard", "/my-rentals", "/account-setup", "/manage"];
const rentalDestination = rentalPages.includes(next?.split("?")[0]) ? next : "";
const signupLink = document.getElementById("signup-link");
if (signupLink && rentalDestination) {
  signupLink.search = new URLSearchParams({ next: rentalDestination });
}

if (authForm && formStatus) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!authForm.reportValidity()) {
      return;
    }

    const submit = authForm.querySelector('[type="submit"]');
    const isSignup = authForm.getAttribute("action") === "/signup";
    const formData = Object.fromEntries(new FormData(authForm));
    if (!isSignup && rentalDestination) {
      formData.next = rentalDestination;
    }
    submit.disabled = true;
    formStatus.textContent = "Please wait...";

    try {
      const response = await fetch(authForm.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Please try again.");
      }
      const destination =
        isSignup && rentalDestination
          ? "/account-setup?" + new URLSearchParams({ next: rentalDestination })
          : result.redirect;
      window.location.assign(destination);
    } catch (error) {
      formStatus.textContent = error.message || "Unable to connect. Please try again.";
      formStatus.focus();
      submit.disabled = false;
    }
  });
}
