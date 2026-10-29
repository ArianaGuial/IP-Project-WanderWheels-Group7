'use strict';

const authForm = document.getElementById('auth-form');
const formStatus = document.getElementById('auth-status');

if (authForm && formStatus) {
  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authForm.reportValidity()) return;

    const submit = authForm.querySelector('[type="submit"]');
    submit.disabled = true;
    formStatus.textContent = 'Please wait...';

    try {
      const response = await fetch(authForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(authForm)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Please try again.');
      window.location.assign(result.redirect);
    } catch (error) {
      formStatus.textContent = error.message || 'Unable to connect. Please try again.';
      formStatus.focus();
      submit.disabled = false;
    }
  });
}
