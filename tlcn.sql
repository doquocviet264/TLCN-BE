-- Tạo Database
CREATE DATABASE IF NOT EXISTS travela
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE travela;

-- =========================
-- Bảng Users
-- =========================
CREATE TABLE tbl_users (
  userId INT AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(50),
  fullName VARCHAR(255),
  username VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL,
  avatar VARCHAR(255),
  phoneNumber VARCHAR(15),
  address VARCHAR(255),
  ipAdress VARCHAR(50),
  isActive ENUM('y','n') DEFAULT 'y',
  status   ENUM('y','n') DEFAULT 'y',
  createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  activation_token VARCHAR(255)
);

-- =========================
-- Bảng Admin
-- =========================
CREATE TABLE tbl_admin (
  adminId INT AUTO_INCREMENT PRIMARY KEY,
  fullName VARCHAR(50),
  username VARCHAR(50) UNIQUE,
  password VARCHAR(50) NOT NULL,
  email    VARCHAR(50) UNIQUE,
  address  VARCHAR(255),
  createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- Bảng Tours
-- =========================
CREATE TABLE tbl_tours (
  tourId INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  time  VARCHAR(255),
  description TEXT,
  quantity INT,
  priceAdult DOUBLE,
  priceChild DOUBLE,
  destination VARCHAR(255),
  adminId INT,
  startDate DATE,
  endDate DATE,
  FOREIGN KEY (adminId) REFERENCES tbl_admin(adminId)
);

-- =========================
-- Bảng Booking
-- =========================
CREATE TABLE tbl_booking (
  bookingId INT AUTO_INCREMENT PRIMARY KEY,
  tourId INT NOT NULL,
  userId INT NOT NULL,
  fullName VARCHAR(50),
  email VARCHAR(50),
  phoneNumber VARCHAR(50),
  address VARCHAR(255),
  numAdults INT,
  numChildren INT,
  totalPrice DOUBLE,
  bookingStatus ENUM('b','c','t','r') DEFAULT 'b',
  FOREIGN KEY (tourId) REFERENCES tbl_tours(tourId),
  FOREIGN KEY (userId) REFERENCES tbl_users(userId)
);

-- =========================
-- Bảng Checkout
-- =========================
CREATE TABLE tbl_checkout (
  checkoutId INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT,
  paymentMethod VARCHAR(255),
  paymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  amount DOUBLE,
  paymentStatus VARCHAR(255),
  transactionId VARCHAR(255),
  FOREIGN KEY (bookingId) REFERENCES tbl_booking(bookingId)
);

-- =========================
-- Bảng Invoice
-- =========================
CREATE TABLE tbl_invoice (
  invoiceId INT AUTO_INCREMENT PRIMARY KEY,
  bookingId INT,
  amount DOUBLE,
  dateIssued DATE,
  details VARCHAR(255),
  FOREIGN KEY (bookingId) REFERENCES tbl_booking(bookingId)
);

-- =========================
-- Bảng Reviews
-- =========================
CREATE TABLE tbl_reviews (
  reviewId INT AUTO_INCREMENT PRIMARY KEY,
  tourId INT,
  userId INT,
  rating FLOAT,
  comment TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tourId) REFERENCES tbl_tours(tourId),
  FOREIGN KEY (userId) REFERENCES tbl_users(userId),
  UNIQUE (tourId, userId)
);

-- =========================
-- Bảng Chat
-- =========================
CREATE TABLE tbl_chat (
  chatId INT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  adminId INT,
  messages VARCHAR(255),
  readStatus ENUM('y','n') DEFAULT 'n',
  createdDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ipAdress VARCHAR(50),
  FOREIGN KEY (userId) REFERENCES tbl_users(userId),
  FOREIGN KEY (adminId) REFERENCES tbl_admin(adminId)
);

-- =========================
-- Bảng History
-- =========================
CREATE TABLE tbl_history (
  historyId INT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  actionType VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES tbl_users(userId)
);

-- =========================
-- Bảng Promotion
-- =========================
CREATE TABLE tbl_promotion (
  promotionId INT AUTO_INCREMENT PRIMARY KEY,
  description VARCHAR(255),
  discount DOUBLE,
  startDate DATE,
  endDate DATE,
  quantity INT
);

-- =========================
-- Bảng Contact
-- =========================
CREATE TABLE tbl_contact (
  contactId INT AUTO_INCREMENT PRIMARY KEY,
  fullName VARCHAR(50),
  phoneNumber VARCHAR(50),
  email VARCHAR(255),
  message TEXT,
  isReply ENUM('y','n') DEFAULT 'n'
);

-- =========================
-- Bảng Timeline
-- =========================
CREATE TABLE tbl_timeline (
  timelineId INT AUTO_INCREMENT PRIMARY KEY,
  tourId INT,
  title VARCHAR(255),
  description TEXT,
  FOREIGN KEY (tourId) REFERENCES tbl_tours(tourId)
);

-- =========================
-- Bảng Temp Images
-- =========================
CREATE TABLE tbl_temp_images (
  imageTempId INT AUTO_INCREMENT PRIMARY KEY,
  tourId INT,
  imageTempURL VARCHAR(255),
  FOREIGN KEY (tourId) REFERENCES tbl_tours(tourId)
);

-- =========================
-- Bảng Images
-- =========================
CREATE TABLE tbl_images (
  imageId INT AUTO_INCREMENT PRIMARY KEY,
  tourId INT,
  imageURL VARCHAR(255),
  description TEXT,
  uploadDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tourId) REFERENCES tbl_tours(tourId)
);
