'use strict';

// Shared account display for all public pages.
async function loadAccount() {
  const header = document.querySelector('.site-header, .header');
  if (!header) return;

  const guestActions = header.querySelector('#account-links, .buttons');
  if (guestActions) guestActions.style.display = 'flex';

  try {
    const response = await fetch('/api/auth-status', { cache: 'no-store' });
    if (!response.ok) throw new Error('Profile unavailable');
    const account = await response.json();
    if (!account.isLoggedIn) return;

    if (guestActions) guestActions.hidden = true;
    if (guestActions) guestActions.style.display = 'none';
const profile = document.createElement('details');
    profile.className = 'account-profile';

    const summary = document.createElement('summary');
    summary.className = 'account-summary';
    const avatar = document.createElement('img');
    avatar.src = '/img/blankProfile.jpg';
    avatar.alt = '';
    avatar.width = 44;
    avatar.height = 44;
    const name = document.createElement('span');
    name.textContent = account.user.name;
    const chevron = document.createElement('span');
    chevron.textContent = '\u25be';
    chevron.setAttribute('aria-hidden', 'true');
    summary.append(avatar, name, chevron);

    const panel = document.createElement('div');
    panel.className = 'account-panel';
    const heading = document.createElement('strong');
    heading.textContent = 'Your profile';
    const email = document.createElement('p');
    email.textContent = account.user.email;
    const signOut = document.createElement('button');
    signOut.className = 'account-signout';
    signOut.type = 'button';
    signOut.textContent = 'Sign Out';
    const status = document.createElement('p');
    status.className = 'account-status';
    status.setAttribute('role', 'status');

    signOut.addEventListener('click', async () => {
      signOut.disabled = true;
      try {
        const result = await fetch('/logout', { method: 'POST' });
        if (!result.ok) throw new Error('Sign out failed');
        window.location.assign('/login');
      } catch {
        status.textContent = 'Could not sign out. Please try again.';
        signOut.disabled = false;
      }
    });

    panel.append(heading, email, signOut, status);
    profile.append(summary, panel);
    header.append(profile);

    document.addEventListener('click', event => {
      if (!profile.contains(event.target)) profile.open = false;
    });
    profile.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        profile.open = false;
        summary.focus();
      }
    });
  } catch {
    // Leave sign-in actions available when the database cannot be reached.
  }
}

loadAccount();
