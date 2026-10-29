'use strict';

const { hashPassword, verifyPassword } = require('./password');

function publicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`,
    email: row.email
  };
}

function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) return reject(error);
      req.session.userId = user.id;
      req.session.save(error => error ? reject(error) : resolve());
    });
  });
}

function registerAuthRoutes(app, pool) {
  app.post('/login', async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    if (!email || typeof password !== 'string' || !password || email.length > 254 || password.length > 128) {
      return res.status(400).json({ message: 'Enter your email address and password.' });
    }
    try {
      const [rows] = await pool.execute(
        'SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = ? LIMIT 1', [email]
      );
      // Also perform a password check for an unknown account.
      const dummy = 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64);
      const matches = await verifyPassword(password, rows[0]?.password_hash || dummy);
      if (!rows[0] || !matches) return res.status(401).json({ message: 'Incorrect email or password.' });
      await startSession(req, rows[0]);
      res.json({ redirect: '/home', user: publicUser(rows[0]) });
    } catch (error) {
      console.error('Login failed:', error.code || error.message);
      res.status(503).json({ message: 'Login is unavailable. Check that XAMPP MySQL is running and the SQL file has been imported.' });
    }
  });

  app.post('/signup', async (req, res) => {
    const firstName = typeof req.body.fname === 'string' ? req.body.fname.trim() : '';
    const lastName = typeof req.body.lname === 'string' ? req.body.lname.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.pass;
    if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        typeof password !== 'string' || password.length < 8 || password.length > 128 || password !== req.body.confirm) {
      return res.status(400).json({ message: 'Enter your name, a valid email, and matching passwords of 8–128 characters.' });
    }
    try {
      const passwordHash = await hashPassword(password);
      const [result] = await pool.execute(
        'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
        [firstName, lastName, email, passwordHash]
      );
      const user = { id: result.insertId, first_name: firstName, last_name: lastName, email };
      await startSession(req, user);
      res.status(201).json({ redirect: '/home', user: publicUser(user) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'That email is already registered. Please sign in.' });
      console.error('Sign up failed:', error.code || error.message);
      res.status(503).json({ message: 'Account creation is unavailable. Check the database connection.' });
    }
  });

  app.post('/logout', (req, res) => {
    req.session.destroy(error => {
      if (error) return res.status(500).json({ message: 'Could not sign out. Please try again.' });
      res.clearCookie('connect.sid');
      res.json({ message: 'Signed out.' });
    });
  });

  app.get('/api/auth-status', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId) return res.json({ isLoggedIn: false, userName: 'Guest User' });
    try {
      const [rows] = await pool.execute('SELECT id, first_name, last_name, email FROM users WHERE id = ? LIMIT 1', [req.session.userId]);
      if (!rows[0]) {
        delete req.session.userId;
        return res.json({ isLoggedIn: false, userName: 'Guest User' });
      }
      const user = publicUser(rows[0]);
      res.json({ isLoggedIn: true, userName: user.name, user });
    } catch (error) {
      console.error('Profile lookup failed:', error.code || error.message);
      res.status(503).json({ message: 'Your profile is temporarily unavailable.' });
    }
  });
}

module.exports = { registerAuthRoutes };
