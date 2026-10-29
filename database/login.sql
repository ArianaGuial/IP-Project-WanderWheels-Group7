
-- Login and signup share the users table below.
-- Signup inserts first_name, last_name, email, and a salted password_hash.
-- Login checks the saved email and password hash; no separate signup table is needed.
-- Password confirmation is validated by the application and is not stored.

CREATE DATABASE IF NOT EXISTS wander_wheels CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wander_wheels;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT INTO users (first_name, last_name, email, password_hash)
SELECT 'Demo', 'Traveler', 'demo@wanderwheels.test', 'scrypt$a9fd71e3c9f016ac2018a4b26be52ad0$d319b71a10e55cd8dbb3e61a14e88e23b7448495fd0c8264d98aef29703b65e23133b376f9b321f1cdb9ce662eb282530c2f6d4b6a3bb4dfb38ce448126f0aef'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'demo@wanderwheels.test');
