const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "epms",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize Database
const initializeDatabase = async () => {
  try {
    const connection = await pool.getConnection();

    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create departments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create employees table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(20),
        department_id INT,
        position VARCHAR(100),
        hire_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )
    `);

    // Create salaries table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS salaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        base_salary DECIMAL(10, 2),
        bonus DECIMAL(10, 2),
        deductions DECIMAL(10, 2),
        salary_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    connection.release();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
};

initializeDatabase();

// Generate token
const generateToken = (username) => {
  return "token_" + Buffer.from(username).toString("base64") + "_" + Date.now();
};

// REGISTER
app.post("/register", async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;

    console.log("Register request received:", { username, password: "***", confirmPassword: "***" });

    // Validation
    if (!username || !password || !confirmPassword) {
      console.log("Missing fields - username:", !!username, "password:", !!password, "confirmPassword:", !!confirmPassword);
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (username.length < 3) {
      console.log("Username too short:", username.length);
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters",
      });
    }

    if (password.length < 4) {
      console.log("Password too short:", password.length);
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters",
      });
    }

    if (password !== confirmPassword) {
      console.log("Passwords do not match");
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const connection = await pool.getConnection();

    // Check if username already exists
    const [existingUser] = await connection.execute(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );

    if (existingUser.length > 0) {
      connection.release();
      console.log("Username already exists:", username);
      return res.status(400).json({
        success: false,
        message: "Username already registered",
      });
    }

    // Insert new user
    await connection.execute(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, password]
    );

    connection.release();

    console.log("User registered successfully:", username);

    res.json({
      success: true,
      message: "Registration successful",
      data: { username },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Server error: " + error.message,
    });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password required",
    });
  }

  try {
    const connection = await pool.getConnection();

    // Find user
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    connection.release();

    if (users.length > 0) {
      res.json({
        success: true,
        token: generateToken(username),
        message: "Login successful",
        data: { username },
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Server error.",
    });
  }
});

// EMPLOYEE
// Get all employees
app.get("/employee", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [employees] = await connection.execute(
      "SELECT * FROM employees"
    );
    connection.release();
    res.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employees",
    });
  }
});

// Get employee by ID
app.get("/employee/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [employee] = await connection.execute(
      "SELECT * FROM employees WHERE id = ?",
      [id]
    );
    connection.release();

    if (employee.length > 0) {
      res.json({
        success: true,
        data: employee[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching employee",
    });
  }
});

// Create employee
app.post("/employee", async (req, res) => {
  try {
    const { Employeenumber, FastName, LastName, email, Position, Telephone, Gender, HiredDate, DepartmentCode } = req.body;

    if (!FastName || !LastName) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required",
      });
    }

    if (!DepartmentCode) {
      return res.status(400).json({
        success: false,
        message: "Department is required",
      });
    }

    // Convert date format - handle both YYYY-MM-DD and DD/MM/YYYY
    let formattedDate = HiredDate;
    if (HiredDate) {
      if (HiredDate.includes('-')) {
        // Already in YYYY-MM-DD format
        formattedDate = HiredDate;
      } else if (HiredDate.includes('/')) {
        // Convert from DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = HiredDate.split('/');
        formattedDate = `${year}-${month}-${day}`;
      }
    }

    const name = `${FastName} ${LastName}`;
    const connection = await pool.getConnection();
    
    await connection.execute(
      "INSERT INTO employees (name, email, phone, position, hire_date, department_id) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email || null, Telephone, Position, formattedDate || null, DepartmentCode]
    );
    connection.release();

    res.json({
      success: true,
      message: "Employee saved successfully",
      data: req.body,
    });
  } catch (error) {
    console.error("Create employee error:", error);
    res.status(500).json({
      success: false,
      message: "Error saving employee: " + error.message,
    });
  }
});


// DEPARTMENT
// Get all departments
app.get("/department", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [departments] = await connection.execute(
      "SELECT * FROM departments"
    );
    connection.release();
    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("Get departments error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching departments",
    });
  }
});

// Get department by ID
app.get("/department/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [department] = await connection.execute(
      "SELECT * FROM departments WHERE id = ?",
      [id]
    );
    connection.release();

    if (department.length > 0) {
      res.json({
        success: true,
        data: department[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }
  } catch (error) {
    console.error("Get department error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching department",
    });
  }
});

// Create department
app.post("/department", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Department name is required",
      });
    }

    const connection = await pool.getConnection();
    await connection.execute(
      "INSERT INTO departments (name, description) VALUES (?, ?)",
      [name, description || ""]
    );
    connection.release();

    res.json({
      success: true,
      message: "Department saved successfully",
      data: req.body,
    });
  } catch (error) {
    console.error("Create department error:", error);
    res.status(500).json({
      success: false,
      message: "Error saving department. " + error.message,
    });
  }
});

// SALARY
// Get all salaries
app.get("/salary", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [salaries] = await connection.execute(
      "SELECT * FROM salaries"
    );
    connection.release();
    res.json({
      success: true,
      data: salaries,
    });
  } catch (error) {
    console.error("Get salaries error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching salaries",
    });
  }
});

// Get salary by ID
app.get("/salary/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [salary] = await connection.execute(
      "SELECT * FROM salaries WHERE id = ?",
      [id]
    );
    connection.release();

    if (salary.length > 0) {
      res.json({
        success: true,
        data: salary[0],
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Salary record not found",
      });
    }
  } catch (error) {
    console.error("Get salary error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching salary",
    });
  }
});

// Create salary record
app.post("/salary", async (req, res) => {
  try {
    const { employee_id, base_salary, bonus, deductions, salary_date } = req.body;

    if (!employee_id || !base_salary) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and base salary are required",
      });
    }

    const connection = await pool.getConnection();
    await connection.execute(
      "INSERT INTO salaries (employee_id, base_salary, bonus, deductions, salary_date) VALUES (?, ?, ?, ?, ?)",
      [employee_id, base_salary, bonus || 0, deductions || 0, salary_date || new Date().toISOString().split('T')[0]]
    );
    connection.release();

    res.json({
      success: true,
      message: "Salary record saved successfully",
      data: req.body,
    });
  } catch (error) {
    console.error("Create salary error:", error);
    res.status(500).json({
      success: false,
      message: "Error saving salary record. " + error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Database: epms");
  console.log("Make sure MySQL is running and database 'epms' exists");
});