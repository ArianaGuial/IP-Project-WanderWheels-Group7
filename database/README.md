# Local Wander Wheels setup (XAMPP)

`login.sql` creates the authentication tables. `rentals.sql` adds the fleet, reservations, inquiries, driver profiles, and staff access.

## Import and run

1. Start **MySQL** in the XAMPP Control Panel. Start Apache to access phpMyAdmin.
2. Open `http://localhost/phpmyadmin`, choose **Import**, and select
   `database/login.sql` followed by `database/rentals.sql`. The second import also works on an existing Wander Wheels database and preserves saved accounts.
3. The default connection is `127.0.0.1:3306`, user `root`, with an empty password.
   If your settings differ, copy `.env.example` to `.env` and edit the connection values.
   Set `SESSION_SECRET` to a long random value. `.env` is excluded from Git.
4. Run `npm install` if dependencies are not already installed, then `npm start`.
   Restart an already running Node server to load these changes.
5. Visit `http://localhost:4501/login` through the Node server, rather than opening
   the HTML directly or using Live Server.

The optional `.env` loader uses Node.js 20.12+; Node.js 24 is installed in this workspace.
XAMPP runs MySQL; Node/Express serves the site and handles authentication.

## Sample account

- Email: `demo@wanderwheels.test`
- Password: `Wander123!`
- Display name: Demo Traveler

You can also create an account at `/signup`. Passwords must contain 8–128 characters.
Passwords are stored as salted scrypt hashes, never as plaintext. Re-importing the
SQL file does not overwrite an existing account or its password.

## Signup

Open `http://localhost:4501/signup` and enter your first name, last name, email,
password, and password confirmation. Signup saves the account in the same `users`
table used by login, signs you in, and opens driver profile setup. Email addresses must be unique.
Password confirmation is checked but not stored. After signing out, use the saved
email and password to log back in. No additional SQL import is required.

## Behavior

- Login and signup submit POST requests, validate input, and create a fresh session.
- The signed-in user's profile appears at the top right of every public page header.
  Open it to see the account email or sign out.
- `/api/auth-status` reads the signed-in user's record from MySQL and excludes the password hash.
- Guests can browse the fleet and submit a rental inquiry. Sign-in sends customers to `/dashboard` and staff to `/manage`.
- Hosted installations also need both SQL imports. Grant staff access in the database used by that deployment, since local staff accounts do not carry over.
- Sessions currently live in Node's memory. Restarting Node signs users out; database
  accounts remain. A persistent session store and HTTPS cookie configuration can be
  added when deploying beyond local development.

## Checks

Run `node --test tests/auth.test.js` for password and HTTP authentication tests.
These tests use an injected database adapter and do not change your XAMPP data.
Actual MySQL login requires importing the SQL and running MySQL first.

## Staff dashboard

Create a separate account through signup. In phpMyAdmin, open the `wander_wheels` database,
select **SQL**, and run the following statement with the staff account's email.

```sql
INSERT IGNORE INTO rental_staff (user_id)
SELECT id FROM users WHERE email = 'your-staff-email@example.com';
```

Open `http://localhost:4501/manage` while signed in to that account. The dashboard includes
fleet and maintenance, reservation details and status changes, customer accounts, users,
driver licenses, and rental inquiries.

The seed fleet uses sample plates, model years, and mileage. Staff can edit those records.
Reservation totals are calculated from the daily rate. Contact inquiries store a preferred
payment method and appear in the staff dashboard. Payment processing is separate.

## Send inquiry acknowledgments with Gmail

1. In the [Google Cloud console](https://console.cloud.google.com/apis/library/gmail.googleapis.com), enable the Gmail API for your project. Configure Google Auth Platform and add your dedicated Gmail sender as a test user if the app is in Testing.
2. Under [Clients](https://console.cloud.google.com/auth/clients), create a **Web application** OAuth client. Add `https://developers.google.com/oauthplayground` as an authorized redirect URI.
3. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/). In Settings, turn on **Use your own OAuth credentials** and enter that client ID and secret. Keep access type **Offline**.
4. Enter the scope `https://www.googleapis.com/auth/gmail.send`, click **Authorize APIs**, and sign in as the dedicated Gmail sender. Exchange the authorization code for tokens and copy the **refresh token**.
5. In the project's Git-ignored `.env`, set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `GMAIL_SENDER_EMAIL`. Use the same Gmail address you authorized in Step 4. Restart Node and submit a Contact inquiry to an inbox you can check. For a hosted app, set the same four variables in the host's environment and redeploy.

The acknowledgment goes to the address entered on the form. Wander Wheels saves the inquiry before attempting email, so an unavailable or disabled mailer leaves the inquiry in the staff dashboard. Each app process allows up to 20 email attempts per minute and one per recipient within that window.

Google issues seven-day refresh tokens for external OAuth apps in Testing that request Gmail sending access. Renew the token when it expires, or review [Google's OAuth verification requirements](https://developers.google.com/identity/protocols/oauth2) for longer-lived use.
