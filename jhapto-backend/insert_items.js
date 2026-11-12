const mysql = require('mysql2/promise');
require('dotenv').config();

const itemsToAdd = [
  // Chips
  ["Lays India's Magic Masala", 'Lays', 1],
  ['Lays American Style Cream and Onion', 'Lays', 1],
  ['Bingo Mad Angles Tomato Madness', 'Bingo', 1],
  ['Uncle Chipps Spicy Treat', 'Uncle Chipps', 1],
  ['Balaji Wafers Cream & Onion', 'Balaji', 1],
  ['Kurkure Solid Masti', 'Kurkure', 1],
  ["Haldiram's Moong Dal", "Haldiram's", 1],
  ["Haldiram's Aloo Bhujia", "Haldiram's", 1],
  ["Haldiram's Bhujia Sev", "Haldiram's", 1],
  
  // Noodles
  ['Yippee Magic Masala Noodles', 'Sunfeast', 1],
  ['Wai Wai Ready to Eat Noodles', 'Wai Wai', 1],
  ["Ching's Secret Schezwan Noodles", "Ching's", 1],
  ['Top Ramen Curry Noodles', 'Nissin', 1],
  ['Maggi Atta Noodles', 'Maggi', 1],
  ['Samyang Buldak Spicy Chicken Ramen', 'Samyang', 1],

  // Popcorn
  ['Act II Golden Sizzle Popcorn', 'Act II', 1],
  ['Act II Butter Delite Popcorn', 'Act II', 1],
  ['Act II Chilli Surprise Popcorn', 'Act II', 1],
  ['4700BC Cheese Popcorn', '4700BC', 1],

  // Nachos
  ['Doritos Nacho Cheese', 'Doritos', 1],
  ['Doritos Sweet Chili', 'Doritos', 1],
  ['Cornitos Tikka Masala Nachos', 'Cornitos', 1],
  ['Cornitos Jalapeno Nachos', 'Cornitos', 1],
  ['Cornitos Cheese & Herbs Nachos', 'Cornitos', 1]
];

async function insertItems() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    const query = 'INSERT INTO Item (item_name, brand, category_id) VALUES ?';
    const [result] = await connection.query(query, [itemsToAdd]);
    
    console.log(`Successfully inserted ${result.affectedRows} items!`);
    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

insertItems();
