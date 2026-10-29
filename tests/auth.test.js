'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const fs = require('node:fs');
const { registerAuthRoutes } = require('../lib/auth');
const { hashPassword, verifyPassword } = require('../lib/password');

test('password hashes verify without storing plaintext', async () => {
  const first = await hashPassword('Example123!');
  const second = await hashPassword('Example123!');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('Example123!', first), true);
  assert.equal(await verifyPassword('wrong', first), false);
  assert.equal(await verifyPassword('Example123!', 'malformed'), false);
  const sql = fs.readFileSync('database/login.sql', 'utf8');
  const sample = sql.match(/scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}/)[0];
  assert.equal(await verifyPassword('Wander123!', sample), true);
});

test('HTTP login, profile, signup, and logout with an injected database', async t => {
  const users = [{ id: 1, first_name: 'Demo', last_name: 'Traveler', email: 'demo@wanderwheels.test', password_hash: await hashPassword('Wander123!') }];
  let unavailable = false;
  const pool = {
    async execute(sql, params) {
      if (unavailable) throw Object.assign(new Error('offline'), { code: 'ECONNREFUSED' });
      if (sql.startsWith('INSERT')) {
        if (users.some(user => user.email === params[2])) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
        const user = { id: users.length + 1, first_name: params[0], last_name: params[1], email: params[2], password_hash: params[3] };
        users.push(user);
        return [{ insertId: user.id }];
      }
      return [users.filter(user => sql.includes('WHERE email') ? user.email === params[0] : user.id === params[0])];
    }
  };
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test-session-secret', resave: false, saveUninitialized: false }));
  registerAuthRoutes(app, pool);
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  async function request(route, body) {
    const response = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await request('/api/auth-status')).data.isLoggedIn, false);
  assert.equal((await request('/login', {})).status, 400);
  assert.equal((await request('/login', { email: "' OR 1=1 --", password: 'Wander123!' })).status, 401);
  assert.equal((await request('/login', { email: users[0].email, password: 'wrong' })).status, 401);
  const valid = await request('/login', { email: ' DEMO@WANDERWHEELS.TEST ', password: 'Wander123!' });
  assert.equal(valid.status, 200);
  assert.equal(valid.data.redirect, '/home');
  assert.equal(valid.data.user.name, 'Demo Traveler');
  assert.ok(cookie);
  const profile = await request('/api/auth-status');
  assert.equal(profile.data.user.email, users[0].email);
  assert.equal(profile.data.user.password_hash, undefined);
  assert.equal((await request('/logout', {})).status, 200);
  assert.equal((await request('/api/auth-status')).data.isLoggedIn, false);
  const signup = { fname: 'New', lname: 'Traveler', email: 'new@example.test', pass: 'NewPassword123!', confirm: 'NewPassword123!' };
  assert.equal((await request('/signup', { ...signup, confirm: 'mismatch' })).status, 400);
  assert.equal((await request('/signup', signup)).status, 201);
  assert.equal((await request('/api/auth-status')).data.user.name, 'New Traveler');
  assert.ok(users[1].password_hash.startsWith('scrypt$'));
  assert.equal((await request('/signup', signup)).status, 409);
  assert.equal((await request('/logout', {})).status, 200);
  const registeredLogin = await request('/login', { email: signup.email, password: signup.pass });
  assert.equal(registeredLogin.status, 200);
  assert.equal(registeredLogin.data.user.name, 'New Traveler');
  assert.equal((await request('/api/auth-status')).data.user.email, signup.email);
  unavailable = true;
  assert.equal((await request('/api/auth-status')).status, 503);
});
