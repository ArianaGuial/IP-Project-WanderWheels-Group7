'use strict';
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const status = document.getElementById('form-status');
    status.textContent = 'Your message passes the form checks. This preview does not send or save messages; a contact service still needs to be connected.';
    status.focus();
  });
}
