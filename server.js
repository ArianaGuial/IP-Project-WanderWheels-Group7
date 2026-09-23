const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 4501;

app.use('/assets', express.static('assets'));
app.use('/img', express.static('img'));
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(session({
  secret: 'IMProject2024',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
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

app.post("/login", (req, res) => {
  req.session.isAuthenticated = true;
  req.session.userId = 1;
  res.redirect("/home");
});

app.post("/signup", (req, res) => {
  req.session.isAuthenticated = true;
  req.session.userId = 1;
  res.redirect("/home");
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).send('Could not log out');
      }
      res.status(200).json({ message: 'Logout successful' });
  });
});

app.get('/api/auth-status', (req, res) => {
    if (req.session.isAuthenticated) {
        res.json({ isLoggedIn: true, userName: "User" });
    } else {
        res.json({ isLoggedIn: false, userName: "Guest User" });
    }
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "AboutUS.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});