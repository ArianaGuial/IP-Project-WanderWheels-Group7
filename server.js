const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const { randomBytes } = require("crypto");
const tls = require("node:tls");
const mysql = require("mysql2/promise");
const { registerAuthRoutes } = require("./lib/auth");
const { registerRentalRoutes } = require("./lib/rentals");

if (require("fs").existsSync(path.join(__dirname, ".env"))) {
  process.loadEnvFile(path.join(__dirname, ".env"));
}

// Include Windows-trusted certificate authorities for requests to Gmail and Google OAuth.
if (
  process.platform === "win32" &&
  process.env.GMAIL_CLIENT_ID?.trim() &&
  typeof tls.setDefaultCACertificates === "function"
) {
  tls.setDefaultCACertificates([
    ...tls.getCACertificates("default"),
    ...tls.getCACertificates("system"),
  ]);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "1234",
  database: process.env.DB_NAME || "wander_wheels",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

const app = express();
const port = Number(process.env.PORT || 4501);

app.use("/assets", express.static("assets"));
app.use("/img", express.static("img"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 8 * 60 * 60 * 1000 },
  }),
);

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/dashboard.html");
});

app.get("/home", function (req, res) {
  res.sendFile(__dirname + "/home.html");
});

app.get("/vehicles", (req, res) => {
  res.sendFile(path.join(__dirname, "vehiclesUSER.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "/signUP.html"));
});

registerAuthRoutes(app, pool);
registerRentalRoutes(app, pool);

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
