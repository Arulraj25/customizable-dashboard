-- Create database
CREATE DATABASE IF NOT EXISTS dashforge_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dashforge_db;

-- --------------------------------------------------
-- customer_orders
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_orders (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(100)   NOT NULL,
  last_name     VARCHAR(100)   NOT NULL,
  email         VARCHAR(255)   NOT NULL,
  phone         VARCHAR(40)    NOT NULL,
  street        VARCHAR(255)   DEFAULT '',
  city          VARCHAR(100)   DEFAULT '',
  state         VARCHAR(100)   DEFAULT '',
  postal_code   VARCHAR(20)    DEFAULT '',
  country       VARCHAR(100)   DEFAULT '',
  product       VARCHAR(150)   NOT NULL,
  quantity      INT UNSIGNED   NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2)  NOT NULL,
  total_amount  DECIMAL(12,2)  GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status        ENUM('Pending','In progress','Completed') NOT NULL DEFAULT 'Pending',
  created_by    VARCHAR(120)   NOT NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------
-- dashboard_layout
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS dashboard_layout (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL DEFAULT 'My Dashboard',
  layout     JSON         NOT NULL,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------
-- dashboard_history
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS dashboard_history (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dashboard_id  INT UNSIGNED NOT NULL,
  commit_msg    VARCHAR(255) NOT NULL DEFAULT 'Update',
  layout        JSON         NOT NULL,
  committed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dashboard
    FOREIGN KEY (dashboard_id)
    REFERENCES dashboard_layout(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;