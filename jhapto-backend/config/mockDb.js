// config/mockDb.js (used when USE_MOCK_DB=true)
// In-memory mock database for Jhapto - provides full relational logic, procedures, and seed data

const bcrypt = require('bcryptjs');

// ── Initial Seed Data ──────────────────────────────────────────
const hostels = [
  { hostel_id: 1, hostel_name: 'Kailash Hostel', hostel_code: 'KH01' }
];

const floors = [
  { floor_id: 1, floor_number: 1, hostel_id: 1 },
  { floor_id: 2, floor_number: 2, hostel_id: 1 },
  { floor_id: 3, floor_number: 3, hostel_id: 1 },
  { floor_id: 4, floor_number: 4, hostel_id: 1 },
  { floor_id: 5, floor_number: 5, hostel_id: 1 },
  { floor_id: 6, floor_number: 6, hostel_id: 1 }
];

const defaultPasswordHash = bcrypt.hashSync('password123', 10);
const defaultAdminPasswordHash = bcrypt.hashSync('admin123', 10);

const admins = [
  {
    admin_id: 1,
    name: 'Admin Jhapto',
    email: 'admin@jhapto.com',
    password_hash: defaultAdminPasswordHash,
    created_at: new Date('2026-01-01T00:00:00Z')
  }
];

const students = [
  { student_id: 1, name: 'Aarav Sharma', email: 'aarav@tiet.ac.in', phone_no: '9876543210', password_hash: defaultPasswordHash, hostel_id: 1, floor_id: 1, is_banned: false, created_at: new Date('2026-01-02T10:00:00Z') },
  { student_id: 2, name: 'Priya Mehta', email: 'priya@tiet.ac.in', phone_no: '9876543211', password_hash: defaultPasswordHash, hostel_id: 1, floor_id: 1, is_banned: false, created_at: new Date('2026-01-02T11:00:00Z') },
  { student_id: 3, name: 'Rohan Verma', email: 'rohan@tiet.ac.in', phone_no: '9876543212', password_hash: defaultPasswordHash, hostel_id: 1, floor_id: 2, is_banned: false, created_at: new Date('2026-01-02T12:00:00Z') },
  { student_id: 4, name: 'Sneha Gupta', email: 'sneha@tiet.ac.in', phone_no: '9876543213', password_hash: defaultPasswordHash, hostel_id: 1, floor_id: 3, is_banned: false, created_at: new Date('2026-01-02T13:00:00Z') },
  { student_id: 5, name: 'Karan Singh', email: 'karan@tiet.ac.in', phone_no: '9876543214', password_hash: defaultPasswordHash, hostel_id: 1, floor_id: 4, is_banned: false, created_at: new Date('2026-01-02T14:00:00Z') }
];

// Same categories as jhapto_migrations_v3.sql
const categories = [
  { category_id: 1, category_name: 'Snacks & Food' },
  { category_id: 2, category_name: 'Noodles & Instant Food' },
  { category_id: 3, category_name: 'Beverages' },
  { category_id: 4, category_name: 'Chocolates & Sweets' },
  { category_id: 5, category_name: 'Stationery & Books' },
  { category_id: 6, category_name: 'Personal Care' },
  { category_id: 7, category_name: 'Electronics & Accessories' }
];

const items = [
  { item_id: 1, item_name: 'Lays Classic Salted', brand: 'Lays', category_id: 1 },
  { item_id: 2, item_name: 'Maggi Noodles 2-min', brand: 'Maggi', category_id: 2 },
  { item_id: 3, item_name: 'Dark Fantasy Choco Fills', brand: 'Sunfeast', category_id: 4 },
  { item_id: 4, item_name: 'Amul Kool Milk', brand: 'Amul', category_id: 3 },
  { item_id: 5, item_name: 'Kurkure Masala Munch', brand: 'Kurkure', category_id: 1 },
  { item_id: 6, item_name: 'Classmate Spiral Notebook', brand: 'Classmate', category_id: 5 },
  { item_id: 7, item_name: 'Pilot V5 Hi-Tecpoint Pen', brand: 'Pilot', category_id: 5 },
  { item_id: 8, item_name: 'USB Type-C Fast Cable', brand: 'boAt', category_id: 7 }
];

const listings = [
  { listing_id: 1, seller_id: 1, item_id: 1, mrp: 20.00, selling_price: 22.00, quantity_available: 5, description: 'Fresh pack, bought yesterday', photo_url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80', listing_status: 'Active', room_number: '104', created_at: new Date('2026-02-01T10:00:00Z') },
  { listing_id: 2, seller_id: 2, item_id: 2, mrp: 14.00, selling_price: 15.00, quantity_available: 3, description: 'Masala flavor available', photo_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=400&q=80', listing_status: 'Active', room_number: '112', created_at: new Date('2026-02-01T11:00:00Z') },
  { listing_id: 3, seller_id: 3, item_id: 3, mrp: 50.00, selling_price: 55.00, quantity_available: 2, description: 'Sealed pack, chocolate flavor', photo_url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=400&q=80', listing_status: 'Active', room_number: '208', created_at: new Date('2026-02-01T12:00:00Z') },
  { listing_id: 4, seller_id: 4, item_id: 4, mrp: 30.00, selling_price: 30.00, quantity_available: 10, description: 'Cold, fresh from canteen', photo_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80', listing_status: 'Active', room_number: '315', created_at: new Date('2026-02-01T13:00:00Z') },
  { listing_id: 5, seller_id: 5, item_id: 5, mrp: 20.00, selling_price: 20.00, quantity_available: 7, description: 'Full party pack munchies', photo_url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=400&q=80', listing_status: 'Active', room_number: '402', created_at: new Date('2026-02-01T14:00:00Z') },
  { listing_id: 6, seller_id: 1, item_id: 6, mrp: 80.00, selling_price: 75.00, quantity_available: 4, description: 'Unused Classmate 300-page ruled notebook', photo_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80', listing_status: 'Active', room_number: '104', created_at: new Date('2026-02-02T09:00:00Z') }
];

const orders = [
  { order_id: 1, buyer_id: 3, order_status: 'Delivered', total_amount: 22.00, created_at: new Date('2026-02-02T10:00:00Z') },
  { order_id: 2, buyer_id: 1, order_status: 'Placed', total_amount: 15.00, created_at: new Date('2026-02-02T11:00:00Z') },
  { order_id: 3, buyer_id: 2, order_status: 'Confirmed', total_amount: 30.00, created_at: new Date('2026-02-02T12:00:00Z') }
];

const order_items = [
  { order_item_id: 1, order_id: 1, listing_id: 1, quantity: 1, price_at_purchase: 22.00 },
  { order_item_id: 2, order_id: 2, listing_id: 2, quantity: 1, price_at_purchase: 15.00 },
  { order_item_id: 3, order_id: 3, listing_id: 4, quantity: 1, price_at_purchase: 30.00 }
];

const messages = [
  { message_id: 1, order_id: 2, sender_id: 1, receiver_id: 2, message_text: 'Hi! I ordered Maggi. When can I pick it up?', is_read: true, sent_at: new Date('2026-02-02T11:05:00Z') },
  { message_id: 2, order_id: 2, sender_id: 2, receiver_id: 1, message_text: 'Come to room 112 after 6 PM!', is_read: false, sent_at: new Date('2026-02-02T11:08:00Z') }
];

const reports = [];

let nextStudentId = 10;
let nextAdminId = 10;
let nextListingId = 20;
let nextOrderId = 10;
let nextOrderItemId = 20;
let nextMessageId = 20;
let nextReportId = 10;

let lastPlacedOrderResult = { order_id: -1, message: '' };

// ── Ratings & notifications (mirror the v2 migration's tables + triggers) ──
const reviews = [];
const notifications = [];
let nextReviewId = 10;
let nextNotificationId = 10;

const orderInfo = (order_id) => {
  const oi = order_items.find(item => item.order_id === order_id);
  const l = oi ? listings.find(lst => lst.listing_id === oi.listing_id) : null;
  const item = l ? items.find(it => it.item_id === l.item_id) : null;
  return { oi, listing: l, seller_id: l ? l.seller_id : null, item_name: item ? item.item_name : 'your item' };
};

const notify = (student_id, type, message, link) => {
  notifications.push({ notification_id: nextNotificationId++, student_id, type, message, link, is_read: false, created_at: new Date() });
};

// trg_notify_new_order
const notifyNewOrder = (order_id, listing_id, quantity) => {
  const l = listings.find(lst => lst.listing_id === listing_id);
  const item = l ? items.find(it => it.item_id === l.item_id) : null;
  if (l) notify(l.seller_id, 'order_placed', `New order #${order_id}: ${quantity} x ${item ? item.item_name : 'item'}`, '/seller');
};

// trg_notify_order_status
const notifyOrderStatus = (o) => {
  const { seller_id, item_name } = orderInfo(o.order_id);
  if (o.order_status === 'Confirmed') {
    notify(o.buyer_id, 'order_confirmed', `Order #${o.order_id} (${item_name}) was confirmed. You can now chat with the seller.`, `/chat/${o.order_id}`);
  } else if (o.order_status === 'Delivered') {
    notify(o.buyer_id, 'order_delivered', `Order #${o.order_id} (${item_name}) was delivered. Rate your seller!`, '/orders?tab=history');
  } else if (o.order_status === 'Cancelled' && seller_id) {
    notify(seller_id, 'order_cancelled', `Order #${o.order_id} (${item_name}) was cancelled by the buyer.`, '/seller?tab=history');
  }
};

// Student.avg_rating / rating_count (maintained by trg_review_after_insert in MySQL)
const sellerRating = (student_id) => {
  const mine = reviews.filter(r => r.seller_id === student_id);
  if (mine.length === 0) return { avg_rating: null, rating_count: 0 };
  const avg = mine.reduce((sum, r) => sum + r.rating, 0) / mine.length;
  return { avg_rating: avg.toFixed(2), rating_count: mine.length };
};

// Applies the "AND o.order_status IN (...) AND o.created_at >= ? AND o.created_at < DATE_ADD(?...)"
// filters built by routes/orders.js. `params[0]` is the buyer/seller id.
const applyOrderFilters = (rows, sql, params) => {
  let i = 1;
  const inMatch = sql.match(/o\.order_status IN \(([?, ]+)\)/i);
  if (inMatch) {
    const n = (inMatch[1].match(/\?/g) || []).length;
    const statuses = params.slice(i, i + n);
    i += n;
    rows = rows.filter(r => statuses.includes(r.order_status));
  }
  if (/o\.created_at >= \?/i.test(sql)) {
    const from = new Date(params[i++] + 'T00:00:00');
    rows = rows.filter(r => new Date(r.created_at) >= from);
  }
  if (/DATE_ADD\(\?, INTERVAL 1 DAY\)/i.test(sql)) {
    const to = new Date(params[i++] + 'T00:00:00');
    to.setDate(to.getDate() + 1);
    rows = rows.filter(r => new Date(r.created_at) < to);
  }
  return rows;
};

// ── In-Memory Query Engine ─────────────────────────────────────
const query = async (sql, params = []) => {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');

  // 1. CALL sp_floor_priority_listings(?)
  if (/CALL sp_floor_priority_listings/i.test(cleanSql)) {
    const buyer_floor_id = Number(params[0]);
    const activeListings = listings.filter(l => {
      const seller = students.find(s => s.student_id === l.seller_id);
      return l.listing_status === 'Active' && seller && !seller.is_banned;
    });

    const result = activeListings.map(l => {
      const seller = students.find(s => s.student_id === l.seller_id);
      const floor = floors.find(f => f.floor_id === seller?.floor_id);
      const item = items.find(i => i.item_id === l.item_id);
      const priority_rank = (seller?.floor_id === buyer_floor_id) ? 0 : 1;
      return {
        listing_id: l.listing_id,
        item_id: l.item_id,
        item_name: item ? item.item_name : 'Item',
        category_name: (categories.find(c => item && c.category_id === item.category_id) || {}).category_name || 'Other',
        seller_id: l.seller_id,
        seller_name: seller ? seller.name : 'Unknown',
        seller_rating: sellerRating(l.seller_id).avg_rating,
        seller_rating_count: sellerRating(l.seller_id).rating_count,
        seller_floor: floor ? floor.floor_number : 1,
        seller_floor_num: floor ? floor.floor_number : 1,
        selling_price: Number(l.selling_price),
        mrp: Number(l.mrp),
        quantity_available: Number(l.quantity_available),
        description: l.description,
        photo_url: l.photo_url,
        room_number: l.room_number,
        priority_rank
      };
    }).sort((a, b) => {
      if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
      return b.listing_id - a.listing_id;
    });

    return [[result]];
  }

  // 2. CALL sp_admin_report() — earned = Delivered, pending = Placed/Confirmed; banned students included
  if (/CALL sp_admin_report/i.test(cleanSql)) {
    const sellerTotal = (student_id, statuses) => {
      let sum = 0;
      orders.filter(o => statuses.includes(o.order_status)).forEach(o => {
        order_items.filter(oi => oi.order_id === o.order_id).forEach(oi => {
          const l = listings.find(lst => lst.listing_id === oi.listing_id);
          if (l && l.seller_id === student_id) sum += Number(oi.price_at_purchase) * Number(oi.quantity);
        });
      });
      return Number(sum.toFixed(2));
    };
    const reportRows = students.map(s => {
      const floor = floors.find(f => f.floor_id === s.floor_id);
      return {
        student_id: s.student_id,
        student_name: s.name,
        floor_number: floor ? floor.floor_number : 1,
        is_banned: s.is_banned ? 1 : 0,
        total_listings: listings.filter(l => l.seller_id === s.student_id && l.listing_status !== 'Removed').length,
        total_orders: orders.filter(o => o.buyer_id === s.student_id && o.order_status !== 'Cancelled').length,
        total_revenue: sellerTotal(s.student_id, ['Delivered']),
        pending_revenue: sellerTotal(s.student_id, ['Placed', 'Confirmed']),
      };
    }).sort((a, b) => b.total_revenue - a.total_revenue || b.pending_revenue - a.pending_revenue);

    return [[reportRows]];
  }

  // 3. CALL place_order(?, ?, ?, @order_id, @message)
  if (/CALL place_order/i.test(cleanSql)) {
    const buyer_id = Number(params[0]);
    const listing_id = Number(params[1]);
    const quantity = Number(params[2]);

    const listing = listings.find(l => l.listing_id === listing_id);
    if (!listing || listing.listing_status !== 'Active') {
      lastPlacedOrderResult = { order_id: -1, message: 'ERROR: Listing is not active or does not exist.' };
      return [{ affectedRows: 0 }];
    }

    if (listing.quantity_available < quantity) {
      lastPlacedOrderResult = { order_id: -1, message: 'ERROR: Not enough stock available.' };
      return [{ affectedRows: 0 }];
    }

    // Deduct stock
    listing.quantity_available -= quantity;
    if (listing.quantity_available <= 0) {
      listing.quantity_available = 0;
      listing.listing_status = 'OutOfStock';
    }

    const newOrderId = nextOrderId++;
    const totalAmount = Number(listing.selling_price) * quantity;

    orders.push({
      order_id: newOrderId,
      buyer_id,
      order_status: 'Placed',
      total_amount: totalAmount,
      created_at: new Date()
    });

    order_items.push({
      order_item_id: nextOrderItemId++,
      order_id: newOrderId,
      listing_id,
      quantity,
      price_at_purchase: Number(listing.selling_price)
    });

    notifyNewOrder(newOrderId, listing_id, quantity);
    lastPlacedOrderResult = { order_id: newOrderId, message: 'SUCCESS: Order placed successfully.' };
    return [{ affectedRows: 1 }];
  }

  // 4. SELECT @order_id AS order_id, @message AS message
  if (/SELECT @order_id AS order_id/i.test(cleanSql)) {
    return [[lastPlacedOrderResult]];
  }

  // 5. SELECT fn_is_price_valid(?, ?) AS valid
  if (/fn_is_price_valid/i.test(cleanSql)) {
    const mrp = Number(params[0]);
    const price = Number(params[1]);
    const isValid = price <= 1.5 * mrp ? 1 : 0;
    return [[{ valid: isValid }]];
  }

  // 6. Student Register Checks & Inserts
  if (/SELECT student_id FROM Student WHERE email =/i.test(cleanSql)) {
    const found = students.filter(s => s.email.toLowerCase() === String(params[0]).toLowerCase());
    return [found.map(s => ({ student_id: s.student_id }))];
  }

  if (/SELECT student_id FROM Student WHERE phone_no =/i.test(cleanSql)) {
    // also used by profile update: "... AND student_id <> ?"
    const found = students.filter(s => s.phone_no === String(params[0]) && (params[1] === undefined || s.student_id !== Number(params[1])));
    return [found.map(s => ({ student_id: s.student_id }))];
  }

  if (/INSERT INTO Student/i.test(cleanSql)) {
    const [name, email, phone_no, password_hash, hostel_id, floor_id] = params;
    const newStudent = {
      student_id: nextStudentId++,
      name,
      email,
      phone_no,
      password_hash,
      hostel_id: Number(hostel_id),
      floor_id: Number(floor_id),
      is_banned: false,
      created_at: new Date()
    };
    students.push(newStudent);
    return [{ insertId: newStudent.student_id, affectedRows: 1 }];
  }

  // 7. Student Login
  if (/SELECT .* FROM Student WHERE email =/i.test(cleanSql)) {
    const found = students.filter(s => s.email.toLowerCase() === String(params[0]).toLowerCase());
    return [found];
  }

  // 8. Admin Register & Login
  if (/SELECT admin_id FROM Admin WHERE email =/i.test(cleanSql)) {
    const found = admins.filter(a => a.email.toLowerCase() === String(params[0]).toLowerCase());
    return [found.map(a => ({ admin_id: a.admin_id }))];
  }

  if (/INSERT INTO Admin/i.test(cleanSql)) {
    const [name, email, password_hash] = params;
    const newAdmin = {
      admin_id: nextAdminId++,
      name,
      email,
      password_hash,
      created_at: new Date()
    };
    admins.push(newAdmin);
    return [{ insertId: newAdmin.admin_id, affectedRows: 1 }];
  }

  if (/SELECT \* FROM Admin WHERE email =/i.test(cleanSql)) {
    const found = admins.filter(a => a.email.toLowerCase() === String(params[0]).toLowerCase());
    return [found];
  }

  // 9. Admin Listings View
  if (/SELECT \* FROM vw_admin_listings/i.test(cleanSql)) {
    const rows = listings.map(l => {
      const seller = students.find(s => s.student_id === l.seller_id);
      const floor = floors.find(f => f.floor_id === seller?.floor_id);
      const item = items.find(i => i.item_id === l.item_id);
      return {
        listing_id: l.listing_id,
        seller_name: seller ? seller.name : 'Unknown',
        seller_email: seller ? seller.email : '',
        seller_floor: floor ? floor.floor_number : 1,
        item_name: item ? item.item_name : 'Item',
        mrp: Number(l.mrp),
        selling_price: Number(l.selling_price),
        price_is_valid: Number(l.selling_price) <= 1.5 * Number(l.mrp) ? 1 : 0,
        quantity_available: Number(l.quantity_available),
        listing_status: l.listing_status,
        created_at: l.created_at
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return [rows];
  }

  // 10. Admin Students View
  if (/SELECT s\.student_id, s\.name, s\.email, s\.phone_no, f\.floor_number, s\.is_banned/i.test(cleanSql)) {
    const rows = students.map(s => {
      const floor = floors.find(f => f.floor_id === s.floor_id);
      return {
        student_id: s.student_id,
        name: s.name,
        email: s.email,
        phone_no: s.phone_no,
        floor_number: floor ? floor.floor_number : 1,
        is_banned: Boolean(s.is_banned),
        created_at: s.created_at
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return [rows];
  }

  // 11. Student Ban / Unban
  if (/UPDATE Student SET is_banned = TRUE WHERE student_id =/i.test(cleanSql)) {
    const id = Number(params[0]);
    const s = students.find(st => st.student_id === id);
    if (s) s.is_banned = true;
    return [{ affectedRows: 1 }];
  }

  if (/UPDATE Student SET is_banned = FALSE WHERE student_id =/i.test(cleanSql)) {
    const id = Number(params[0]);
    const s = students.find(st => st.student_id === id);
    if (s) s.is_banned = false;
    return [{ affectedRows: 1 }];
  }

  // 12. Items List for Sell dropdown
  if (/SELECT i\.item_id, i\.item_name, i\.brand, c\.category_name/i.test(cleanSql)) {
    const rows = items.map(i => {
      const c = categories.find(cat => cat.category_id === i.category_id);
      return {
        item_id: i.item_id,
        item_name: i.item_name,
        brand: i.brand,
        category_name: c ? c.category_name : 'General'
      };
    }).sort((a, b) => a.item_name.localeCompare(b.item_name));
    return [rows];
  }

  // 13. My Listings (Seller)
  if (/FROM Listing l JOIN Item i ON l\.item_id = i\.item_id WHERE l\.seller_id =/i.test(cleanSql)) {
    const seller_id = Number(params[0]);
    const rows = listings.filter(l => l.seller_id === seller_id).map(l => {
      const item = items.find(i => i.item_id === l.item_id);
      return {
        listing_id: l.listing_id,
        item_name: item ? item.item_name : 'Item',
        brand: item ? item.brand : '',
        mrp: Number(l.mrp),
        selling_price: Number(l.selling_price),
        quantity_available: Number(l.quantity_available),
        description: l.description,
        photo_url: l.photo_url,
        room_number: l.room_number,
        listing_status: l.listing_status,
        created_at: l.created_at
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return [rows];
  }

  // 14. Create Listing
  if (/INSERT INTO Listing/i.test(cleanSql)) {
    const [seller_id, item_id, mrp, selling_price, quantity_available, description, photo_url, room_number] = params;

    // Trigger check: active listing for same item
    const duplicate = listings.find(l => l.seller_id === Number(seller_id) && l.item_id === Number(item_id) && l.listing_status === 'Active');
    if (duplicate) {
      const err = new Error('ERROR: You already have an Active listing for this item.');
      err.sqlState = '45000';
      throw err;
    }

    const newListing = {
      listing_id: nextListingId++,
      seller_id: Number(seller_id),
      item_id: Number(item_id),
      mrp: Number(mrp),
      selling_price: Number(selling_price),
      quantity_available: Number(quantity_available),
      description: description || '',
      photo_url: photo_url || '',
      room_number: room_number || '101',
      listing_status: 'Active',
      created_at: new Date()
    };
    listings.unshift(newListing);
    return [{ insertId: newListing.listing_id, affectedRows: 1 }];
  }

  // 15. Check Listing seller before deletion / remove
  if (/SELECT seller_id FROM Listing WHERE listing_id =/i.test(cleanSql)) {
    const listing_id = Number(params[0]);
    const l = listings.find(lst => lst.listing_id === listing_id);
    return [l ? [{ seller_id: l.seller_id }] : []];
  }

  // 16. Remove Listing
  if (/UPDATE Listing SET listing_status = 'Removed' WHERE listing_id =/i.test(cleanSql)) {
    const listing_id = Number(params[0]);
    const l = listings.find(lst => lst.listing_id === listing_id);
    if (l) l.listing_status = 'Removed';
    return [{ affectedRows: 1 }];
  }

  // 17. Orders: My Orders (Buyer)
  if (/FROM `Order` o JOIN Order_Item oi .* WHERE o\.buyer_id =/i.test(cleanSql)) {
    const buyer_id = Number(params[0]);
    const userOrders = orders.filter(o => o.buyer_id === buyer_id);
    const rows = userOrders.map(o => {
      const oi = order_items.find(item => item.order_id === o.order_id);
      const l = oi ? listings.find(lst => lst.listing_id === oi.listing_id) : null;
      const item = l ? items.find(it => it.item_id === l.item_id) : null;
      const seller = l ? students.find(s => s.student_id === l.seller_id) : null;
      return {
        order_id: o.order_id,
        item_name: item ? item.item_name : 'Item',
        quantity: oi ? oi.quantity : 1,
        price_at_purchase: oi ? Number(oi.price_at_purchase) : 0,
        total_amount: Number(o.total_amount),
        order_status: o.order_status,
        created_at: o.created_at,
        seller_name: seller ? seller.name : 'Seller',
        seller_phone: seller ? seller.phone_no : '',
        seller_id: seller ? seller.student_id : null,
        my_rating: (reviews.find(r => r.order_id === o.order_id) || {}).rating ?? null,
        my_review: (reviews.find(r => r.order_id === o.order_id) || {}).comment ?? null
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.order_id - a.order_id);
    return [applyOrderFilters(rows, cleanSql, params)];
  }

  // 18. Orders: Selling Orders (Seller)
  if (/FROM `Order` o JOIN Order_Item oi .* WHERE l\.seller_id =/i.test(cleanSql)) {
    const seller_id = Number(params[0]);
    const rows = [];
    orders.forEach(o => {
      const oi = order_items.find(item => item.order_id === o.order_id);
      const l = oi ? listings.find(lst => lst.listing_id === oi.listing_id) : null;
      if (l && l.seller_id === seller_id) {
        const item = items.find(it => it.item_id === l.item_id);
        const buyer = students.find(s => s.student_id === o.buyer_id);
        rows.push({
          order_id: o.order_id,
          item_name: item ? item.item_name : 'Item',
          quantity: oi.quantity,
          price_at_purchase: Number(oi.price_at_purchase),
          total_amount: Number(o.total_amount),
          order_status: o.order_status,
          created_at: o.created_at,
          buyer_name: buyer ? buyer.name : 'Buyer',
          buyer_phone: buyer ? buyer.phone_no : '',
          buyer_id: buyer ? buyer.student_id : null,
          buyer_rating: (reviews.find(r => r.order_id === o.order_id) || {}).rating ?? null,
          buyer_review: (reviews.find(r => r.order_id === o.order_id) || {}).comment ?? null
        });
      }
    });
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.order_id - a.order_id);
    return [applyOrderFilters(rows, cleanSql, params)];
  }

  // 19. Cancel Order
  if (/SELECT buyer_id, order_status FROM `Order` WHERE order_id =/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const o = orders.find(ord => ord.order_id === order_id);
    return [o ? [{ buyer_id: o.buyer_id, order_status: o.order_status }] : []];
  }

  if (/UPDATE `Order` SET order_status = 'Cancelled' WHERE order_id =/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const o = orders.find(ord => ord.order_id === order_id);
    if (o) {
      o.order_status = 'Cancelled';
      notifyOrderStatus(o);
      // Restore stock
      const oi = order_items.find(item => item.order_id === order_id);
      if (oi) {
        const l = listings.find(lst => lst.listing_id === oi.listing_id);
        if (l) {
          l.quantity_available += oi.quantity;
          l.listing_status = 'Active';
        }
      }
    }
    return [{ affectedRows: 1 }];
  }

  // 20. Confirm & Deliver Orders
  if (/SELECT o\.order_id FROM `Order` o JOIN Order_Item oi .* WHERE o\.order_id = \? AND l\.seller_id = \?/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const seller_id = Number(params[1]);
    const oi = order_items.find(item => item.order_id === order_id);
    const l = oi ? listings.find(lst => lst.listing_id === oi.listing_id) : null;
    if (l && l.seller_id === seller_id) {
      return [[{ order_id }]];
    }
    return [[]];
  }

  if (/UPDATE `Order` SET order_status = 'Confirmed' WHERE order_id =/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const o = orders.find(ord => ord.order_id === order_id);
    if (o && o.order_status !== 'Confirmed') { o.order_status = 'Confirmed'; notifyOrderStatus(o); }
    return [{ affectedRows: 1 }];
  }

  if (/UPDATE `Order` SET order_status = 'Delivered' WHERE order_id =/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const o = orders.find(ord => ord.order_id === order_id);
    if (o && o.order_status !== 'Delivered') { o.order_status = 'Delivered'; notifyOrderStatus(o); }
    return [{ affectedRows: 1 }];
  }

  // 21. Messages: unread count per chat
  if (/SELECT m\.order_id, COUNT\(\*\) AS unread_count/i.test(cleanSql)) {
    const receiver_id = Number(params[0]);
    const byOrder = new Map();
    messages.forEach(m => {
      if (m.receiver_id !== receiver_id || m.is_read) return;
      const o = orders.find(ord => ord.order_id === m.order_id);
      if (!o || !['Placed', 'Confirmed'].includes(o.order_status)) return;
      const entry = byOrder.get(m.order_id) || { order_id: m.order_id, unread_count: 0, last: 0 };
      entry.unread_count++;
      entry.last = Math.max(entry.last, new Date(m.sent_at).getTime());
      entry.from_name = (students.find(st => st.student_id === m.sender_id) || {}).name;
      entry.item_name = orderInfo(m.order_id).item_name;
      byOrder.set(m.order_id, entry);
    });
    return [[...byOrder.values()].sort((a, b) => b.last - a.last).map(({ last, ...rest }) => rest)];
  }

  // 22. Messages: Mark as read
  if (/UPDATE Message SET is_read = TRUE/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const receiver_id = Number(params[1]);
    let changed = 0;
    messages.forEach(m => {
      if (m.order_id === order_id && m.receiver_id === receiver_id && !m.is_read) {
        m.is_read = true;
        changed++;
      }
    });
    return [{ affectedRows: changed }];
  }

  // 23. Messages: Check order participants
  if (/SELECT o\.buyer_id, l\.seller_id, o\.order_status FROM `Order` o/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const o = orders.find(ord => ord.order_id === order_id);
    if (!o) return [[]];
    const oi = order_items.find(item => item.order_id === order_id);
    const l = oi ? listings.find(lst => lst.listing_id === oi.listing_id) : null;
    return [[{
      buyer_id: o.buyer_id,
      seller_id: l ? l.seller_id : null,
      order_status: o.order_status
    }]];
  }

  // 24. Messages: Get all for order
  if (/SELECT m\.message_id, m\.sender_id, s\.name AS sender_name/i.test(cleanSql)) {
    const order_id = Number(params[0]);
    const orderMsgs = messages.filter(m => m.order_id === order_id).map(m => {
      const sender = students.find(s => s.student_id === m.sender_id);
      return {
        message_id: m.message_id,
        sender_id: m.sender_id,
        sender_name: sender ? sender.name : 'User',
        message_text: m.message_text,
        sent_at: m.sent_at
      };
    }).sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
    return [orderMsgs];
  }

  // 25. Messages: Send message
  if (/INSERT INTO Message/i.test(cleanSql)) {
    const [order_id, sender_id, receiver_id, message_text] = params;
    const newMsg = {
      message_id: nextMessageId++,
      order_id: Number(order_id),
      sender_id: Number(sender_id),
      receiver_id: Number(receiver_id),
      message_text,
      is_read: false,
      sent_at: new Date()
    };
    messages.push(newMsg);
    return [{ insertId: newMsg.message_id, affectedRows: 1 }];
  }

  // 26. Reports: Insert report
  if (/INSERT INTO Report/i.test(cleanSql)) {
    const [order_id, reporter_id, reported_user_id, reason, proof_url] = params;
    reports.push({
      report_id: nextReportId++,
      order_id: Number(order_id),
      reporter_id: Number(reporter_id),
      reported_user_id: Number(reported_user_id),
      reason,
      proof_url,
      status: 'Pending',
      created_at: new Date()
    });
    return [{ affectedRows: 1 }];
  }

  // ── Added with the security / checkout fixes ──────────────────
  // Auth middleware ban check
  if (/^SELECT is_banned, name, floor_id, hostel_id FROM Student WHERE student_id = \?/i.test(cleanSql)) {
    const s = students.find(st => st.student_id === Number(params[0]));
    return [s ? [{ is_banned: s.is_banned, name: s.name, floor_id: s.floor_id, hostel_id: s.hostel_id }] : []];
  }

  // Registration: floor belongs to hostel
  if (/SELECT floor_id FROM Floor WHERE floor_id = \? AND hostel_id = \?/i.test(cleanSql)) {
    const f = floors.find(fl => fl.floor_id === Number(params[0]) && fl.hostel_id === Number(params[1]));
    return [f ? [{ floor_id: f.floor_id }] : []];
  }

  // Admin list
  if (/SELECT admin_id, name, email, created_at FROM Admin/i.test(cleanSql)) {
    return [admins.map(({ admin_id, name, email, created_at }) => ({ admin_id, name, email, created_at }))];
  }

  // Checkout: lock + read listing
  if (/SELECT l\.listing_id, l\.seller_id, l\.selling_price, l\.quantity_available/i.test(cleanSql)) {
    const l = listings.find(lst => lst.listing_id === Number(params[0]));
    if (!l) return [[]];
    const item = items.find(i => i.item_id === l.item_id);
    const seller = students.find(st => st.student_id === l.seller_id);
    return [[{
      listing_id: l.listing_id, seller_id: l.seller_id, selling_price: l.selling_price,
      quantity_available: l.quantity_available, listing_status: l.listing_status,
      item_name: item ? item.item_name : 'Item', seller_banned: seller ? seller.is_banned : false,
    }]];
  }

  // Checkout: create order
  if (/^INSERT INTO `Order` \(buyer_id, order_status, total_amount\)/i.test(cleanSql)) {
    const order_id = nextOrderId++;
    orders.push({ order_id, buyer_id: Number(params[0]), order_status: 'Placed', total_amount: Number(params[1]), created_at: new Date() });
    return [{ insertId: order_id, affectedRows: 1 }];
  }

  // Checkout: order line (mirrors trg_deduct_stock_on_order + trg_auto_out_of_stock)
  if (/^INSERT INTO Order_Item/i.test(cleanSql)) {
    const [order_id, listing_id, quantity, price] = params.map(Number);
    const l = listings.find(lst => lst.listing_id === listing_id);
    if (!l || l.quantity_available < quantity) {
      const err = new Error('ERROR: Insufficient stock for this listing.');
      err.sqlState = '45000';
      throw err;
    }
    l.quantity_available -= quantity;
    if (l.quantity_available === 0 && l.listing_status === 'Active') l.listing_status = 'OutOfStock';
    order_items.push({ order_item_id: nextOrderItemId++, order_id, listing_id, quantity, price_at_purchase: price });
    notifyNewOrder(order_id, listing_id, quantity);
    return [{ insertId: nextOrderItemId - 1, affectedRows: 1 }];
  }

  // Reports: order participants
  if (/^SELECT o\.buyer_id, l\.seller_id FROM `Order` o/i.test(cleanSql)) {
    const o = orders.find(ord => ord.order_id === Number(params[0]));
    if (!o) return [[]];
    const oi = order_items.find(item => item.order_id === o.order_id);
    const l = oi ? listings.find(lst => lst.listing_id === oi.listing_id) : null;
    return [[{ buyer_id: o.buyer_id, seller_id: l ? l.seller_id : null }]];
  }

  // Reports: duplicate pending check
  if (/SELECT report_id FROM Report WHERE order_id = \? AND reporter_id = \?/i.test(cleanSql)) {
    return [reports.filter(r => r.order_id === Number(params[0]) && r.reporter_id === Number(params[1]) && r.status === 'Pending')
      .map(r => ({ report_id: r.report_id }))];
  }

  // Admin: list reports
  if (/FROM Report r JOIN Student rep/i.test(cleanSql)) {
    const rows = reports.map(r => {
      const rep = students.find(st => st.student_id === r.reporter_id) || {};
      const tgt = students.find(st => st.student_id === r.reported_user_id) || {};
      return {
        report_id: r.report_id, order_id: r.order_id, reason: r.reason, status: r.status, created_at: r.created_at,
        reporter_id: r.reporter_id, reporter_name: rep.name, reporter_email: rep.email,
        reported_user_id: r.reported_user_id, reported_name: tgt.name, reported_email: tgt.email,
        reported_is_banned: tgt.is_banned ? 1 : 0, has_proof: r.proof_url ? 1 : 0,
      };
    }).sort((a, b) => (b.status === 'Pending') - (a.status === 'Pending') || new Date(b.created_at) - new Date(a.created_at));
    return [rows];
  }

  // Admin: report proof
  if (/SELECT proof_url FROM Report WHERE report_id = \?/i.test(cleanSql)) {
    const r = reports.find(rp => rp.report_id === Number(params[0]));
    return [r ? [{ proof_url: r.proof_url }] : []];
  }

  // Admin: update report status
  if (/UPDATE Report SET status = \? WHERE report_id = \?/i.test(cleanSql)) {
    const r = reports.find(rp => rp.report_id === Number(params[1]));
    if (r) r.status = params[0];
    return [{ affectedRows: r ? 1 : 0 }];
  }

  // ── Added with ratings / notifications / profile / listing edit ─────────
  // Student login (joins Floor for floor_number)
  if (/FROM Student s JOIN Floor f ON s\.floor_id = f\.floor_id JOIN Hostel h ON s\.hostel_id = h\.hostel_id WHERE s\.email = \?/i.test(cleanSql)) {
    const found = students.filter(s => s.email.toLowerCase() === String(params[0]).toLowerCase())
      .map(s => ({
        ...s,
        floor_number: (floors.find(f => f.floor_id === s.floor_id) || {}).floor_number,
        hostel_name: (hostels.find(h => h.hostel_id === s.hostel_id) || {}).hostel_name,
      }));
    return [found];
  }

  // Profile (PROFILE_SQL in routes/auth.js)
  if (/FROM Student s JOIN Hostel h ON s\.hostel_id = h\.hostel_id JOIN Floor f/i.test(cleanSql)) {
    const s = students.find(st => st.student_id === Number(params[0]));
    if (!s) return [[]];
    const h = hostels.find(x => x.hostel_id === s.hostel_id) || {};
    const f = floors.find(x => x.floor_id === s.floor_id) || {};
    return [[{
      student_id: s.student_id, name: s.name, email: s.email, phone_no: s.phone_no,
      hostel_id: s.hostel_id, hostel_name: h.hostel_name, floor_id: s.floor_id, floor_number: f.floor_number,
      ...sellerRating(s.student_id), created_at: s.created_at,
    }]];
  }

  if (/SELECT floor_id, floor_number FROM Floor WHERE hostel_id = \?/i.test(cleanSql)) {
    return [floors.filter(f => f.hostel_id === Number(params[0]))
      .sort((a, b) => a.floor_number - b.floor_number)
      .map(f => ({ floor_id: f.floor_id, floor_number: f.floor_number }))];
  }

  if (/UPDATE Student SET name = COALESCE\(\?, name\)/i.test(cleanSql)) {
    const [name, phone_no, floor_id, student_id] = params;
    const s = students.find(st => st.student_id === Number(student_id));
    if (s) {
      if (name !== null) s.name = name;
      if (phone_no !== null) s.phone_no = phone_no;
      if (floor_id !== null) s.floor_id = Number(floor_id);
    }
    return [{ affectedRows: s ? 1 : 0 }];
  }

  if (/SELECT password_hash FROM Student WHERE student_id = \?/i.test(cleanSql)) {
    const s = students.find(st => st.student_id === Number(params[0]));
    return [s ? [{ password_hash: s.password_hash }] : []];
  }

  if (/UPDATE Student SET password_hash = \? WHERE student_id = \?/i.test(cleanSql)) {
    const s = students.find(st => st.student_id === Number(params[1]));
    if (s) s.password_hash = params[0];
    return [{ affectedRows: s ? 1 : 0 }];
  }

  // Listing edit
  if (/SELECT listing_id, seller_id, item_id, mrp, selling_price, listing_status FROM Listing WHERE listing_id = \?/i.test(cleanSql)) {
    const l = listings.find(lst => lst.listing_id === Number(params[0]));
    return [l ? [{ listing_id: l.listing_id, seller_id: l.seller_id, item_id: l.item_id, mrp: l.mrp, selling_price: l.selling_price, listing_status: l.listing_status }] : []];
  }

  if (/SELECT listing_id FROM Listing WHERE seller_id = \? AND item_id = \? AND listing_status = 'Active' AND listing_id <> \?/i.test(cleanSql)) {
    const [seller_id, item_id, listing_id] = params.map(Number);
    return [listings.filter(l => l.seller_id === seller_id && l.item_id === item_id && l.listing_status === 'Active' && l.listing_id !== listing_id)
      .map(l => ({ listing_id: l.listing_id }))];
  }

  if (/^UPDATE Listing SET mrp = \?, selling_price = \?/i.test(cleanSql)) {
    const [mrp, price, qty, descSet, desc, room, photoSet, photo, status, listing_id] = params;
    const l = listings.find(lst => lst.listing_id === Number(listing_id));
    if (l) {
      if (Number(price) > 1.5 * Number(mrp)) {
        const err = new Error('ERROR: Selling price cannot exceed 1.5x MRP.');
        err.sqlState = '45000';
        throw err;
      }
      l.mrp = Number(mrp);
      l.selling_price = Number(price);
      if (qty !== null) l.quantity_available = Number(qty);
      if (descSet) l.description = desc;
      if (room !== null) l.room_number = room;
      if (photoSet) l.photo_url = photo;
      l.listing_status = status;
    }
    return [{ affectedRows: l ? 1 : 0 }];
  }

  // Reviews
  if (/SELECT review_id FROM Review WHERE order_id = \?/i.test(cleanSql)) {
    return [reviews.filter(r => r.order_id === Number(params[0])).map(r => ({ review_id: r.review_id }))];
  }

  if (/^INSERT INTO Review/i.test(cleanSql)) {
    const [order_id, reviewer_id, rating, comment] = [Number(params[0]), Number(params[1]), Number(params[2]), params[3]];
    const o = orders.find(ord => ord.order_id === order_id);
    const fail = (msg) => { const err = new Error(msg); err.sqlState = '45000'; throw err; };
    if (!o || o.buyer_id !== reviewer_id) fail('ERROR: Only the buyer of this order can review it.');
    if (o.order_status !== 'Delivered') fail('ERROR: You can review an order only after it is delivered.');
    if (reviews.some(r => r.order_id === order_id)) {
      const err = new Error('Duplicate entry'); err.code = 'ER_DUP_ENTRY'; throw err;
    }
    const { seller_id } = orderInfo(order_id);
    reviews.push({ review_id: nextReviewId++, order_id, reviewer_id, seller_id, rating, comment, created_at: new Date() });
    const reviewer = students.find(st => st.student_id === reviewer_id);
    notify(seller_id, 'review', `${reviewer ? reviewer.name : 'A buyer'} rated you ${rating}/5 for order #${order_id}`, '/profile');
    return [{ insertId: nextReviewId - 1, affectedRows: 1 }];
  }

  if (/SELECT student_id, name, avg_rating, rating_count FROM Student WHERE student_id = \?/i.test(cleanSql)) {
    const s = students.find(st => st.student_id === Number(params[0]));
    return [s ? [{ student_id: s.student_id, name: s.name, ...sellerRating(s.student_id) }] : []];
  }

  if (/FROM Review r JOIN Student rv ON r\.reviewer_id = rv\.student_id/i.test(cleanSql)) {
    const seller_id = Number(params[0]);
    const rows = reviews.filter(r => r.seller_id === seller_id).map(r => {
      const rv = students.find(st => st.student_id === r.reviewer_id) || {};
      return {
        review_id: r.review_id, order_id: r.order_id, rating: r.rating, comment: r.comment, created_at: r.created_at,
        reviewer_name: rv.name || 'Buyer', item_name: orderInfo(r.order_id).item_name,
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50);
    return [rows];
  }

  // Notifications
  if (/FROM Notification WHERE student_id = \? ORDER BY/i.test(cleanSql)) {
    const rows = notifications.filter(n => n.student_id === Number(params[0]))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.notification_id - a.notification_id)
      .slice(0, 30)
      .map(n => ({ ...n, is_read: n.is_read ? 1 : 0 }));
    return [rows];
  }

  if (/SELECT COUNT\(\*\) AS unread_count FROM Notification/i.test(cleanSql)) {
    return [[{ unread_count: notifications.filter(n => n.student_id === Number(params[0]) && !n.is_read).length }]];
  }

  if (/UPDATE Notification SET is_read = TRUE WHERE student_id = \?/i.test(cleanSql)) {
    notifications.forEach(n => { if (n.student_id === Number(params[0])) n.is_read = true; });
    return [{ affectedRows: 1 }];
  }

  if (/UPDATE Notification SET is_read = TRUE WHERE notification_id = \? AND student_id = \?/i.test(cleanSql)) {
    const n = notifications.find(x => x.notification_id === Number(params[0]) && x.student_id === Number(params[1]));
    if (n) n.is_read = true;
    return [{ affectedRows: n ? 1 : 0 }];
  }

  if (/SELECT category_id, category_name FROM Category/i.test(cleanSql)) {
    return [categories.map(c => ({ ...c }))];
  }

  console.warn('Unhandled SQL query:', cleanSql, params);
  return [[]];
};

module.exports = {
  query,
  // Mirrors mysql2 pool.promise().getConnection(). Note: the mock has no real
  // transactions — rollback() does not undo writes made earlier in a checkout.
  end: async () => {},
  getConnection: async () => ({
    query,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  })
};
