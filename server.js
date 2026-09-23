const mysql = require('mysql2/promise');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const encoder = bodyParser.urlencoded();
const path = require('path');
const port = 4500;

const app = express();

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

let connection;
let db;

async function connectToMySQL() {
  try {
    if(!connection){
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'IMProject',
        port: Number(process.env.DB_PORT) || 3306
      });
      console.log('Connected to MySQL');
    }
    return connection;
  } catch (err){
    console.error('Database connection error:', err);
    throw err;
  }
}

async function getDatabase() {
  if (!db) {
    db = await connectToMySQL();
  }
  return db;
}

connectToMySQL().then(connection => {
  db = connection;
}).catch(console.error);


async function isAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect("/login"); 
}

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/dashboard.html");
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html'); 
});

const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:4500', 
  credentials: true
}));

app.get("/api/userinfo", isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: No user logged in' });
  }
  try {
    const database = await getDatabase();
    const userQuery = "SELECT fname, lname, email FROM users WHERE user_id = ?";
    const [userResults] = await database.execute(userQuery, [userId]);

    if (userResults.length > 0) {
      const user = userResults[0];
      res.json({
        firstName: user.fname,
        lastName: user.lname,
        email: user.email
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get("/api/admininfo", isAuthenticated, async (req, res) => {
  const adminId = req.session.adminId;
  if (!adminId) {
    return res.status(401).json({ message: 'Unauthorized: No admin logged in' });
  }
  try {
    const database = await getDatabase();
    const adminQuery = "SELECT fname, lname, email FROM admin WHERE admin_id = ?";
    const [adminResults] = await database.execute(adminQuery, [adminId]);

    if (adminResults.length > 0) {
      const admin = adminResults[0];
      res.json({
        firstName: admin.fname,
        lastName: admin.lname,
        email: admin.email
      });
    } else {
      res.status(404).json({ message: 'Admin not found' });
    }
  } catch (error) {
    console.error('Error fetching admin info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/login", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { email, password } = req.body;

  try {
    const database = await getDatabase();
    const adminQuery = "SELECT * FROM admin WHERE email =? AND pass =?";
    const [adminResults] = await database.execute(adminQuery, [email, password]);

    if (adminResults.length > 0) {
      req.session.isAuthenticated = true;
      req.session.adminId = adminResults[0].admin_id;
      return res.redirect("/transactions");
    }

    const userQuery = "SELECT * FROM users WHERE email =? AND pass =?";
    const [userResults] = await database.execute(userQuery, [email, password]);

    if (userResults.length > 0) {
      req.session.isAuthenticated = true; 
      req.session.userId = userResults[0].user_id;
      console.log('User logged in, user ID set to:', req.session.userId);
      return res.redirect("/home");
    } else {
      res.status(401).send(`
        <html>
        <head>
          <title>Login Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background: linear-gradient(to bottom, #FFD35A, #E85C0D); }
            .container { width: 300px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 10px; background: white; }
            h1 { color: red; }
            button { margin: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
            .retry { background-color: white; color: black; }
            .contact { background-color: #E85C0D; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Invalid credentials!</h1>
            <p>There was an error processing your sign in. Please try again.</p>
            <button class="retry" onclick="window.location.href='/login'">Retry</button>
            <button class="contact" onclick="window.location.href='/support'">Contact Support</button>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Login error:', error);
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_BAD_DB_ERROR') {
      return res.status(503).send("Login is temporarily unavailable. Start MySQL and make sure the IMProject database exists.");
    }
    res.status(500).send("Server error during login.");
  }
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "/signUP.html"));
});

app.post("/signup", bodyParser.urlencoded({ extended: false }), async (req, res) => {
  const { fname, lname, email, pass, confirm } = req.body;

  if (pass !== confirm) {
    return res.status(400).send("Passwords do not match.");
  }

  if (!fname || !lname || !email || !pass) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const database = await getDatabase();
    const query = "INSERT INTO users (fname, lname, email, pass) VALUES (?, ?, ?, ?)";
    const [result] = await database.execute(query, [fname, lname, email, pass]);

    if (result.affectedRows > 0) {
      req.session.isAuthenticated = true;
      res.redirect("/success");
    } else {
      res.status(500).send("Error during signup.");
    }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).send("Error occurred during signup.");
  }
});

app.get("/success", function(req, res) {
  res.send(`
    <html>
    <head>
      <title>Signup Success</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background: linear-gradient(to bottom, #FFD35A, #E85C0D);;}
        .container { width: 300px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 10px; background: white;}
        h1 { color: green; }
        button { margin: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
        .back { background-color: white; color: black; }
        .login { background-color: #E85C0D; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Signup Successful!</h1>
        <p>Your account has been created.</p>
        <button class="back" onclick="window.location.href='/signup'">Back</button>
        <button class="login" onclick="window.location.href='/login'">Login</button>
      </div>
    </body>
    </html>
    `);
});

app.post("/rental", encoder, async (req, res) => {
  console.log(req.body);
  const { fname, lname, email, phone, rental_days, pickup_date, pickup_location, model, message, rent_time } = req.body;

  if (!fname || !lname || !email || !phone || !rental_days || !pickup_date || !pickup_location || !model || !rent_time) {
    return res.status(400).send("All fields are required.");
  }

  if (!fname.trim() || !lname.trim() || !email.trim() || !phone.trim() || !rental_days.trim() || !pickup_date.trim() || !pickup_location.trim() || !model.trim() || !rent_time.trim()) {
    return res.status(400).send("All fields must be filled.");
  }

  try {
    const database = await getDatabase();
    const [userResults] = await database.execute(
      "SELECT user_id FROM users WHERE fname = ? AND lname = ? AND email = ?",
      [fname, lname, email]
    );

    if (userResults.length === 0) {
      return res.status(404).send("User not found. Please register first.");
    }

    const userId = userResults[0].user_id;

    const [vehicleResults] = await database.execute(
      "SELECT vehicle_id, base_rate, gas_rate FROM vehicle WHERE model = ?",
      [model]
    );

    if (vehicleResults.length === 0) {
      return res.status(404).send("Vehicle type not found");
    }

    const vehicleId = vehicleResults[0].vehicle_id;
    const baseRate = parseFloat(vehicleResults[0].base_rate);
    const gasRate = parseFloat(vehicleResults[0].gas_rate);

    const pickupDateTime = new Date(`${pickup_date}T${rent_time}`);
    const days = parseInt(rental_days, 10);
    const returnDate = new Date(pickupDateTime);
    returnDate.setDate(returnDate.getDate() + days);
    const returnDateString = returnDate.toISOString().split('T')[0];

    const totalAmount = (baseRate * days) + gasRate;

    const formattedTotalAmount = totalAmount.toFixed(2);

    const insertQuery = `
      INSERT INTO transaction
      (user_id, phone, rental_days, pickup_date, dropoff_date, pickup_location, rent_time, vehicle_id, additional_message, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      userId,             
      phone,               
      rental_days,        
      pickup_date,        
      returnDateString,   
      pickup_location,     
      rent_time,          
      vehicleId,         
      message || null,  
      formattedTotalAmount,        
      'pending'          
    ];

    console.log("Insert values:", values);

    const [result] = await database.execute(insertQuery, values);

    if (result.affectedRows > 0) {
      res.redirect("/transaction-success");
    } else {
      res.redirect("/transaction-error");
    }
  } catch (error) {
    console.error("Error processing reservation:", error);
    res.redirect("/transaction-error");
  }
});

app.get("/transaction-success", function(req, res) {
  res.send(`
    <html>
    <head>
      <title>Reservation Added</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background: linear-gradient(to bottom, #FFD35A, #E85C0D); }
        .container { width: 300px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 10px; background: white; }
        h1 { color: green; }
        button { margin: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
        .back { background-color: white; color: black; }
        .home { background-color: #E85C0D; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Transaction Successful!</h1>
        <p>Your transaction has been processed successfully.</p>
        <button class="back" onclick="window.location.href='/contact'">Back</button>
        <button class="home" onclick="window.location.href='/home'">Home</button>
      </div>
    </body>
    </html>
  `);
});

app.get("/transaction-error", function(req, res) {
  res.send(`
    <html>
    <head>
      <title>Reservation Error</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background: linear-gradient(to bottom, #FFD35A, #E85C0D); }
        .container { width: 300px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 10px; background: white; }
        h1 { color: red; }
        button { margin: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
        .retry { background-color: white; color: black; }
        .contact { background-color: #E85C0D; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Transaction Failed!</h1>
        <p>There was an error processing your transaction. Please try again.</p>
        <button class="retry" onclick="window.location.href='/contact'">Retry</button>
        <button class="contact" onclick="window.location.href='/support'">Contact Support</button>
      </div>
    </body>
    </html>
  `);
});

const getTransactionsQuery = () => `
  SELECT 
    t.id AS transactionNo, 
    CONCAT(u.fname, ' ', u.lname) AS name, 
    DATE_FORMAT(t.pickup_date, '%M %d, %Y') AS pickup_date, 
    DATE_FORMAT(t.dropoff_date, '%M %d, %Y') AS dropoff_date,
    t.pickup_location, 
    t.total_amount, 
    t.status, 
    DATE_FORMAT(t.rent_time, '%l:%i %p') AS rent_time
  FROM transaction t
  JOIN users u ON t.user_id = u.user_id
  ORDER BY pickup_date ASC
  LIMIT ? OFFSET ?
`;

app.get("/api/transactionsAdmin", isAuthenticated, async (req, res) => {
  try {
    const database = await getDatabase();
    const limitValue = parseInt(req.query.limit) || 20;
    const offsetValue = parseInt(req.query.offset) || 0;

    const [rows] = await database.query(getTransactionsQuery(), [limitValue, offsetValue]);
    
    res.json({
      total: rows.length,
      transactions: rows
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get("/api/transactionDetails/:transactionID", isAuthenticated, async (req, res) => {
  const transactionID = req.params.transactionID;

  try {
    const database = await getDatabase();
    const [rows] = await database.query(`
      SELECT 
        t.id AS transactionNo, 
        CONCAT(u.fname, ' ', u.lname) AS fullName, 
        DATE_FORMAT(t.reservation_date, '%M %d, %Y') AS reservation_date,
        t.phone, 
        DATE_FORMAT(t.pickup_date, '%M %d, %Y') AS pickup_date, 
        DATE_FORMAT(t.dropoff_date, '%M %d, %Y') AS dropoff_date, 
        DATE_FORMAT(t.rent_time, '%l:%i %p') AS rent_time, 
        t.pickup_location, 
        t.rental_days, 
        t.total_amount, 
        t.status, 
        t.additional_message,
        v.model AS vehicleModel,
        v.licensePlate AS vehicleLicensePlate,
        v.vehicleType AS vehicleType,
        v.gas_rate, 
        v.base_rate
      FROM transaction t
      JOIN users u ON t.user_id = u.user_id
      JOIN vehicle v ON t.vehicle_id = v.vehicle_id
      WHERE t.id = ?
    `, [transactionID]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const result = rows[0];
    res.json({
      transactionNo: result.transactionNo,
      reservationDate: result.reservation_date,
      fullName: result.fullName,
      phone: result.phone || 'N/A',
      pickupDate: result.pickup_date,
      rentTime: result.rent_time,
      pickupLocation: result.pickup_location,
      dropoffDate: result.dropoff_date,
      rentalDays: result.rental_days || 'N/A',
      totalAmount: parseFloat(result.total_amount).toFixed(2),
      status: result.status,
      additionalMessage: result.additional_message,
      vehicle: {
        model: result.vehicleModel,
        licensePlate: result.vehicleLicensePlate,
        type: result.vehicleType,
        gasRate: parseFloat(result.gas_rate).toFixed(2),
        baseRate: parseFloat(result.base_rate).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ error: 'Failed to fetch transaction details' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).send('Could not log out');
      }
      res.status(200).json({ message: 'Logout successful' });
  });
});

const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));

app.get("/home", isAuthenticated, function(req, res) {
  res.sendFile(__dirname + "/home.html");
});

app.get("/transactions", isAuthenticated, function(req, res) {
  res.sendFile(__dirname + "/transactionsAdmin.html");
});

app.get("/vehicles", isAuthenticated, (req, res) => {
  const page = req.session.adminId ? "vehicleADMIN.html" : "vehiclesUSER.html";
  res.sendFile(path.join(__dirname, page));
});

app.get("/transactionsAdmin", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "transactionsAdmin.html"));
});

app.get("/about", isAuthenticated, (req, res) => {
  res.sendFile(path.join(staticDir, "AboutUS.html"));
});

app.get("/team", isAuthenticated, (req, res) => {
  res.sendFile(path.join(staticDir, "OurTeam.html"));
});

app.get("/contact", isAuthenticated, (req, res) => {
  res.sendFile(path.join(staticDir, "contact.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
