import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://resources-bunny-terrorists-scenario.trycloudflare.com',
    /https:\/\/.*\.trycloudflare\.com$/
  ],
  credentials: true
}));
app.use(express.json());

// Database setup - connects to existing database in the data directory
const dbPath = path.join(__dirname, '..', 'data', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✓ Connected to existing SQLite database');
  }
});

// API Routes for emp_list table

//itemdbs
// Get all items with optional filtering and pagination
app.get('/api/items', (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    status, 
    location, 
    brand, 
    item_type,
    search,
    sort_by = 'item_no',
    sort_order = 'ASC'
  } = req.query;

  let sql = 'SELECT * FROM itemsdb WHERE 1=1';
  let params = [];
  let countSql = 'SELECT COUNT(*) as total FROM itemsdb WHERE 1=1';
  let countParams = [];

  // Add filters
  if (status) {
    sql += ' AND item_status = ?';
    countSql += ' AND item_status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (location) {
    sql += ' AND location = ?';
    countSql += ' AND location = ?';
    params.push(location);
    countParams.push(location);
  }

  if (brand) {
    sql += ' AND brand = ?';
    countSql += ' AND brand = ?';
    params.push(brand);
    countParams.push(brand);
  }

  if (item_type) {
    sql += ' AND item_type = ?';
    countSql += ' AND item_type = ?';
    params.push(item_type);
    countParams.push(item_type);
  }

  if (search) {
    sql += ' AND (item_name LIKE ? OR brand LIKE ? OR supplier LIKE ?)';
    countSql += ' AND (item_name LIKE ? OR brand LIKE ? OR supplier LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  // Add sorting
  const validSortColumns = ['item_no', 'item_name', 'brand', 'balance', 'price_per_unit', 'cost', 'last_po'];
  const validSortOrder = ['ASC', 'DESC'];
  
  if (validSortColumns.includes(sort_by) && validSortOrder.includes(sort_order.toUpperCase())) {
    sql += ` ORDER BY ${sort_by} ${sort_order.toUpperCase()}`;
  }

  // Add pagination
  const offset = (page - 1) * limit;
  sql += ' LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  // Get total count first
  db.get(countSql, countParams, (err, countResult) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);

    // Get paginated results
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }

      res.json({
        success: true,
        data: rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total_items: totalItems,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      });
    });
  });
});

// Get a specific item by item_no
app.get('/api/items/:item_no', (req, res) => {
  const { item_no } = req.params;
  
  const sql = 'SELECT * FROM itemsdb WHERE item_no = ?';
  
  db.get(sql, [item_no], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({
      success: true,
      data: row
    });
  });
});

// Get items by status (Out Of Stock, Low In Stock, In Stock)
app.get('/api/items/status/:status', (req, res) => {
  const { status } = req.params;
  const validStatuses = ['Out Of Stock', 'Low In Stock', 'In Stock'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: 'Invalid status', 
      valid_statuses: validStatuses 
    });
  }
  
  const sql = 'SELECT * FROM itemsdb WHERE item_status = ? ORDER BY item_name';
  
  db.all(sql, [status], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Get low stock items (items with deficit > 0)
app.get('/api/items/low-stock', (req, res) => {
  const sql = 'SELECT * FROM itemsdb WHERE deficit > 0 ORDER BY deficit DESC';
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Get inventory summary statistics
app.get('/api/items/summary', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN item_status = 'In Stock' THEN 1 ELSE 0 END) as in_stock,
      SUM(CASE WHEN item_status = 'Low In Stock' THEN 1 ELSE 0 END) as low_stock,
      SUM(CASE WHEN item_status = 'Out Of Stock' THEN 1 ELSE 0 END) as out_of_stock,
      SUM(balance) as total_quantity,
      SUM(cost) as total_value,
      AVG(price_per_unit) as avg_price_per_unit
    FROM itemsdb
  `;
  
  db.get(sql, [], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    res.json({
      success: true,
      data: {
        total_items: row.total_items,
        stock_status: {
          in_stock: row.in_stock,
          low_stock: row.low_stock,
          out_of_stock: row.out_of_stock
        },
        total_quantity: row.total_quantity,
        total_value: parseFloat(row.total_value || 0).toFixed(2),
        avg_price_per_unit: parseFloat(row.avg_price_per_unit || 0).toFixed(2)
      }
    });
  });
});

// Get distinct values for filtering (locations, brands, item_types, suppliers)
app.get('/api/items/filters', (req, res) => {
  const queries = {
    locations: 'SELECT DISTINCT location FROM itemsdb WHERE location IS NOT NULL ORDER BY location',
    brands: 'SELECT DISTINCT brand FROM itemsdb WHERE brand IS NOT NULL ORDER BY brand',
    item_types: 'SELECT DISTINCT item_type FROM itemsdb WHERE item_type IS NOT NULL ORDER BY item_type',
    suppliers: 'SELECT DISTINCT supplier FROM itemsdb WHERE supplier IS NOT NULL ORDER BY supplier'
  };

  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, sql]) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error(`Error fetching ${key}:`, err);
        results[key] = [];
      } else {
        results[key] = rows.map(row => Object.values(row)[0]);
      }
      
      completed++;
      if (completed === total) {
        res.json({
          success: true,
          data: results
        });
      }
    });
  });
});

// Get all employees
app.get('/api/employees', (req, res) => {
  db.all("SELECT * FROM emp_list ORDER BY last_name, first_name", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get employee by UID
app.get('/api/employees/:uid', (req, res) => {
  const { uid } = req.params;
  db.get("SELECT * FROM emp_list WHERE uid = ?", [uid], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'Employee not found' });
    }
  });
});

// Get employees by access level
app.get('/api/employees/access/:level', (req, res) => {
  const { level } = req.params;
  db.all("SELECT * FROM emp_list WHERE access_level = ? ORDER BY last_name, first_name", [level], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Search employees by name
app.get('/api/employees/search/:query', (req, res) => {
  const { query } = req.params;
  const searchQuery = `%${query}%`;
  db.all(`SELECT * FROM emp_list 
          WHERE first_name LIKE ? OR last_name LIKE ? OR middle_name LIKE ? OR username LIKE ?
          ORDER BY last_name, first_name`, 
         [searchQuery, searchQuery, searchQuery, searchQuery], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create new employee
app.post('/api/employees', (req, res) => {
  const { 
    uid, 
    last_name, 
    first_name, 
    middle_name, 
    username, 
    access_level, 
    password_salt, 
    password_hash, 
    tfa_salt, 
    tfa_hash 
  } = req.body;
  
  db.run(`INSERT INTO emp_list 
          (uid, last_name, first_name, middle_name, username, access_level, 
           password_salt, password_hash, tfa_salt, tfa_hash) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
         [uid, last_name, first_name, middle_name, username, access_level, 
          password_salt, password_hash, tfa_salt, tfa_hash], 
         function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      uid,
      last_name,
      first_name,
      middle_name,
      username,
      access_level,
      message: 'Employee created successfully'
    });
  });
});

// Update employee
app.put('/api/employees/:uid', (req, res) => {
  const { uid } = req.params;
  const { 
    last_name, 
    first_name, 
    middle_name, 
    username, 
    access_level, 
    password_salt, 
    password_hash, 
    tfa_salt, 
    tfa_hash 
  } = req.body;
  
  db.run(`UPDATE emp_list 
          SET last_name = ?, first_name = ?, middle_name = ?, username = ?, 
              access_level = ?, password_salt = ?, password_hash = ?, 
              tfa_salt = ?, tfa_hash = ?
          WHERE uid = ?`, 
         [last_name, first_name, middle_name, username, access_level, 
          password_salt, password_hash, tfa_salt, tfa_hash, uid], 
         function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json({ message: 'Employee updated successfully', changes: this.changes });
    }
  });
});

// Update employee password only
app.put('/api/employees/:uid/password', (req, res) => {
  const { uid } = req.params;
  const { password_salt, password_hash } = req.body;
  
  db.run(`UPDATE emp_list 
          SET password_salt = ?, password_hash = ?
          WHERE uid = ?`, 
         [password_salt, password_hash, uid], 
         function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json({ message: 'Password updated successfully' });
    }
  });
});

// Update employee TFA only
app.put('/api/employees/:uid/tfa', (req, res) => {
  const { uid } = req.params;
  const { tfa_salt, tfa_hash } = req.body;
  
  db.run(`UPDATE emp_list 
          SET tfa_salt = ?, tfa_hash = ?
          WHERE uid = ?`, 
         [tfa_salt, tfa_hash, uid], 
         function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json({ message: 'TFA updated successfully' });
    }
  });
});

// Delete employee
app.delete('/api/employees/:uid', (req, res) => {
  const { uid } = req.params;
  db.run("DELETE FROM emp_list WHERE uid = ?", [uid], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json({ message: 'Employee deleted successfully', changes: this.changes });
    }
  });
});

// Get database stats
app.get('/api/stats', (req, res) => {
  db.get("SELECT COUNT(*) as employee_count FROM emp_list", (err, empRow) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.all("SELECT access_level, COUNT(*) as count FROM emp_list GROUP BY access_level", (err, accessRows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({
        total_employees: empRow.employee_count,
        access_levels: accessRows,
        database_path: dbPath
      });
    });
  });
});

// Get unique access levels
app.get('/api/access-levels', (req, res) => {
  db.all("SELECT DISTINCT access_level FROM emp_list WHERE access_level IS NOT NULL ORDER BY access_level", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const levels = rows.map(row => row.access_level);
    res.json(levels);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Database located at: ${dbPath}`);
  console.log('✓ Connected to emp_list table');
  console.log('✓ Ready for Cloudflare tunnel connection');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('✓ Database connection closed');
    process.exit(0);
  });
});