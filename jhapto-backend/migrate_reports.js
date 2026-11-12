const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Report (
        report_id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        reporter_id INT NOT NULL,
        reported_user_id INT NOT NULL,
        reason TEXT NOT NULL,
        proof_url LONGTEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES \`Order\`(order_id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES Student(student_id) ON DELETE CASCADE,
        FOREIGN KEY (reported_user_id) REFERENCES Student(student_id) ON DELETE CASCADE
      );
    `);
    console.log("Created Report table");
    await connection.end();
  } catch (err) {
    console.error("Migration Error:", err);
  }
}

migrate();
