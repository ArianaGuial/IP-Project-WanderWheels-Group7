const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { randomBytes } = require('crypto');
const mysql = require('mysql2/promise');
const { registerAuthRoutes } = require('./lib/auth');

if (require('fs').existsSync(path.join(__dirname, '.env'))) {
  process.loadEnvFile(path.join(__dirname, '.env'));
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'wander_wheels',
  waitForConnections: true,
  connectionLimit: 10
});

const app = express();
const port = Number(process.env.PORT || 4501);

app.use('/assets', express.static('assets'));
app.use('/img', express.static('img'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/dashboard.html");
});

app.get("/home", function(req, res) {
  res.sendFile(__dirname + "/home.html");
});

app.get("/vehicles", (req, res) => {
  res.sendFile(path.join(__dirname, "vehiclesUSER.html"));
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "/signUP.html"));
});

registerAuthRoutes(app, pool);

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/team", (req, res) => {
  res.sendFile(path.join(__dirname, "team.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "contact.html"));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

module.exports = { app, pool };
