-- Import after login.sql. Existing accounts and passwords are preserved.
USE wander_wheels;

CREATE TABLE IF NOT EXISTS rental_staff (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  phone VARCHAR(30) NOT NULL,
  social_url VARCHAR(254) NOT NULL DEFAULT '',
  license_number VARCHAR(40) NOT NULL,
  license_expiry DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  model_year SMALLINT UNSIGNED NOT NULL,
  plate VARCHAR(24) NOT NULL UNIQUE,
  category VARCHAR(40) NOT NULL,
  mileage INT UNSIGNED NOT NULL,
  daily_rate INT UNSIGNED NOT NULL,
  status ENUM('Available','Maintenance') NOT NULL DEFAULT 'Available'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  vehicle_id INT UNSIGNED NOT NULL,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  total INT UNSIGNED NOT NULL,
  status ENUM('Upcoming','Active','Completed','Cancelled') NOT NULL DEFAULT 'Upcoming',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  INDEX reservation_availability (vehicle_id, status, pickup_date, return_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rental_inquiries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  vehicle VARCHAR(100) NOT NULL,
  passengers TINYINT UNSIGNED NOT NULL,
  rental_days TINYINT UNSIGNED NOT NULL,
  handover ENUM('Pickup','Delivery') NOT NULL,
  pickup_at DATETIME NOT NULL,
  pickup_location VARCHAR(150) NOT NULL,
  delivery_address VARCHAR(250) NOT NULL DEFAULT '',
  dropoff_at DATETIME NOT NULL,
  dropoff_location VARCHAR(150) NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  message VARCHAR(3000) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO vehicles (name, model_year, plate, category, mileage, daily_rate, status) VALUES
  ('Chevrolet Trailblazer', 2023, 'DEMO-101', 'SUV', 18400, 4800, 'Available'),
  ('Ford Ranger', 2024, 'DEMO-102', 'Pick Up', 14700, 4500, 'Available'),
  ('Honda Civic', 2023, 'DEMO-103', 'Sedan', 21200, 2800, 'Available'),
  ('Hyundai Accent', 2022, 'DEMO-104', 'Sedan', 34000, 2200, 'Available'),
  ('Kia Sorento', 2024, 'DEMO-105', 'SUV', 12500, 4200, 'Available'),
  ('Mitsubishi Montero', 2023, 'DEMO-106', 'SUV', 24900, 4000, 'Maintenance'),
  ('Nissan Navara', 2023, 'DEMO-107', 'Pick Up', 18700, 4300, 'Available'),
  ('Suzuki Ertiga', 2024, 'DEMO-108', 'MPV', 10200, 3000, 'Available'),
  ('Toyota Corolla', 2023, 'DEMO-109', 'Sedan', 17700, 2500, 'Available')
ON DUPLICATE KEY UPDATE id = id;

-- To grant staff access, register a separate account, then run the following
-- with that account's email substituted. Keep the sample login as a customer.
-- INSERT IGNORE INTO rental_staff (user_id)
-- SELECT id FROM users WHERE email = 'your-staff-email@example.com';
