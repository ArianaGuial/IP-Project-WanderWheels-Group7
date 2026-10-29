# Local login and signup setup (XAMPP)

Only the `users` authentication table is included. Vehicle, reservation, payment,
and other tables can be added in later migrations.

## Import and run

1. Start **MySQL** in the XAMPP Control Panel. Start Apache to access phpMyAdmin.
2. Open `http://localhost/phpmyadmin`, choose **Import**, and select
   `database/login.sql`. The file creates the `wander_wheels` database and users table.
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
table used by login, signs you in, and opens Home. Email addresses must be unique.
Password confirmation is checked but not stored. After signing out, use the saved
email and password to log back in. No additional SQL import is required.

## Behavior

- Login and signup submit POST requests, validate input, and create a fresh session.
- The signed-in user's profile appears at the top right of every public page header.
  Open it to see the account email or sign out.
- `/api/auth-status` reads the signed-in user's record from MySQL and excludes the password hash.
- Guest pages remain public. Vehicle and booking behavior is unchanged.
- Sessions currently live in Node's memory. Restarting Node signs users out; database
  accounts remain. A persistent session store and HTTPS cookie configuration can be
  added when deploying beyond local development.

## Checks

Run `node --test tests/auth.test.js` for password and HTTP authentication tests.
These tests use an injected database adapter and do not change your XAMPP data.
Actual MySQL login requires importing the SQL and running MySQL first.
