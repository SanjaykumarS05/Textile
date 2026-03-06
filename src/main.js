import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
if (started) {
  app.quit();
}
let sqlite3;
sqlite3 = require('sqlite3');
let ExcelJS;
ExcelJS = require('exceljs');
const dbPath = path.join(process.cwd(), 'my-database.db');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const ensureKgsLowStockColumn = async () => {
  const settingsColumns = await all('PRAGMA table_info(app_settings)');
  const hasKgsLowStockColumn = settingsColumns.some((col) => col.name === 'kgs_low_stock');
  if (!hasKgsLowStockColumn) {
    await run('ALTER TABLE app_settings ADD COLUMN kgs_low_stock REAL NOT NULL DEFAULT 5');
  }
};

const ensureSchema = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT ''
    )
  `);

  const columns = await all('PRAGMA table_info(users)');
  const hasPasswordColumn = columns.some((col) => col.name === 'password');
  const hasPhoneColumn = columns.some((col) => col.name === 'phone');

  if (!hasPasswordColumn) {
    await run("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''");
  }
  if (!hasPhoneColumn) {
    await run("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  }

  const countRow = await get('SELECT COUNT(*) AS count FROM users');
  if (!countRow || countRow.count === 0) {
    await run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [
      'admin',
      'admin@example.com',
      'admin123',
    ]);
  }

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL DEFAULT 'pcs',
      unit_type TEXT NOT NULL DEFAULT 'meter',
      price REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const productColumns = await all('PRAGMA table_info(products)');
  const hasUnitTypeColumn = productColumns.some((col) => col.name === 'unit_type');
  const hasProductActiveColumn = productColumns.some((col) => col.name === 'is_active');
  if (!hasUnitTypeColumn) {
    await run("ALTER TABLE products ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'meter'");
  }
  if (!hasProductActiveColumn) {
    await run('ALTER TABLE products ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      gst_number TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const customerColumns = await all('PRAGMA table_info(customers)');
  const hasGstNumberColumn = customerColumns.some((col) => col.name === 'gst_number');
  const hasCustomerActiveColumn = customerColumns.some((col) => col.name === 'is_active');
  if (!hasGstNumberColumn) {
    await run("ALTER TABLE customers ADD COLUMN gst_number TEXT NOT NULL DEFAULT ''");
  }
  if (!hasCustomerActiveColumn) {
    await run('ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      total REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      received_amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      before_json TEXT NOT NULL DEFAULT '',
      after_json TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      meter_low_stock REAL NOT NULL DEFAULT 5,
      pcs_low_stock REAL NOT NULL DEFAULT 5,
      kgs_low_stock REAL NOT NULL DEFAULT 5,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const settingsColumns = await all('PRAGMA table_info(app_settings)');
  const hasKgsLowStockColumn = settingsColumns.some((col) => col.name === 'kgs_low_stock');
  if (!hasKgsLowStockColumn) {
    await run('ALTER TABLE app_settings ADD COLUMN kgs_low_stock REAL NOT NULL DEFAULT 5');
  }

  const settingsRow = await get('SELECT id FROM app_settings WHERE id = 1');
  if (!settingsRow) {
    await run(
      'INSERT INTO app_settings (id, meter_low_stock, pcs_low_stock, kgs_low_stock) VALUES (1, 5, 5, 5)'
    );
  }
};

const logAction = async ({ actionType, entity, entityId, before, after }) => {
  const beforeJson = before ? JSON.stringify(before) : '';
  const afterJson = after ? JSON.stringify(after) : '';
  await run(
    'INSERT INTO audit_logs (action_type, entity, entity_id, before_json, after_json) VALUES (?, ?, ?, ?, ?)',
    [actionType, entity, entityId ?? null, beforeJson, afterJson]
  );
};

ipcMain.handle('db:getUsers', async () => {
  return all('SELECT id, name, email, phone FROM users ORDER BY id ASC');
});

ipcMain.handle('db:addUser', async (_event, payload) => {
  const name = String(payload?.name ?? '').trim();
  const email = String(payload?.email ?? '').trim();
  const password = String(payload?.password ?? '').trim();

  if (!name || !email || !password) {
    return { ok: false, message: 'Name, email and password are required' };
  }

  const result = await run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [
    name,
    email,
    password,
  ]);
  return { ok: true, id: result.lastID };
});

ipcMain.handle('db:login', async (_event, payload) => {
  const username = String(payload?.username ?? '').trim();
  const password = String(payload?.password ?? '').trim();

  if (!username) {
    return { ok: false, message: 'Username is required' };
  }

  if (!password) {
    return { ok: false, message: 'Password is required' };
  }

  const rows = await all(
    'SELECT id, name, email FROM users WHERE (lower(name) = lower(?) OR lower(email) = lower(?)) AND password = ? LIMIT 1',
    [username, username, password]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'Invalid username or password' };
  }

  await logAction({
    actionType: 'login',
    entity: 'users',
    entityId: rows[0].id,
    before: null,
    after: { user: rows[0].name },
  });

  return { ok: true, user: rows[0] };
});

ipcMain.handle('db:getSettings', async () => {
  await ensureKgsLowStockColumn();
  const settings = await get(
    'SELECT meter_low_stock, pcs_low_stock, kgs_low_stock FROM app_settings WHERE id = 1'
  );
  const profile = await get('SELECT id, name, email, phone FROM users ORDER BY id ASC LIMIT 1');
  return {
    meterLowStock: Number(settings?.meter_low_stock ?? 5),
    pcsLowStock: Number(settings?.pcs_low_stock ?? 5),
    kgsLowStock: Number(settings?.kgs_low_stock ?? 5),
    profile: profile ?? null,
  };
});

ipcMain.handle('db:updateSettings', async (_event, payload) => {
  await ensureKgsLowStockColumn();
  const meterLowStock = Number(payload?.meterLowStock ?? 5);
  const pcsLowStock = Number(payload?.pcsLowStock ?? 5);
  const kgsLowStock = Number(payload?.kgsLowStock ?? 5);
  const currentPassword = String(payload?.currentPassword ?? '').trim();
  const newPassword = String(payload?.newPassword ?? '').trim();
  const user = await get('SELECT * FROM users ORDER BY id ASC LIMIT 1');
  const existingSettings = await get(
    'SELECT meter_low_stock, pcs_low_stock, kgs_low_stock FROM app_settings WHERE id = 1'
  );

  if (!user) return { ok: false, message: 'User profile not found' };
  const name = String(payload?.name ?? user.name ?? '').trim();
  const email = String(payload?.email ?? user.email ?? '').trim();
  const phone = String(payload?.phone ?? user.phone ?? '').trim();
  if (!name || !email) return { ok: false, message: 'Name and email are required' };
  if (!Number.isFinite(meterLowStock) || meterLowStock < 0) {
    return { ok: false, message: 'Meter low stock must be 0 or more' };
  }
  if (!Number.isFinite(pcsLowStock) || pcsLowStock < 0) {
    return { ok: false, message: 'Pieces low stock must be 0 or more' };
  }
  if (!Number.isFinite(kgsLowStock) || kgsLowStock < 0) {
    return { ok: false, message: 'Kgs low stock must be 0 or more' };
  }

  let passwordToSave = String(user.password ?? '');
  if (newPassword) {
    if (!currentPassword) {
      return { ok: false, message: 'Current password is required to set new password' };
    }
    if (currentPassword !== String(user.password ?? '')) {
      return { ok: false, message: 'Current password is incorrect' };
    }
    passwordToSave = newPassword;
  }

  await run(
    'UPDATE app_settings SET meter_low_stock = ?, pcs_low_stock = ?, kgs_low_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
    [meterLowStock, pcsLowStock, kgsLowStock]
  );

  await run(
    'UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE id = ?',
    [name, email, phone, passwordToSave, user.id]
  );

  await logAction({
    actionType: 'update',
    entity: 'settings',
    entityId: 1,
    before: {
      meterLowStock: Number(existingSettings?.meter_low_stock ?? 5),
      pcsLowStock: Number(existingSettings?.pcs_low_stock ?? 5),
      kgsLowStock: Number(existingSettings?.kgs_low_stock ?? 5),
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    after: {
      meterLowStock,
      pcsLowStock,
      kgsLowStock,
      name,
      email,
      phone,
      passwordChanged: Boolean(newPassword),
    },
  });

  return { ok: true };
});

ipcMain.handle('db:getDashboardStats', async () => {
  await ensureKgsLowStockColumn();
  const [orders, customers, products, revenue, pending, settings] = await Promise.all([
    get('SELECT COUNT(*) AS count FROM orders'),
    get('SELECT COUNT(*) AS count FROM customers'),
    get('SELECT COUNT(*) AS count FROM products'),
    get('SELECT COALESCE(SUM(amount), 0) AS amount FROM payments'),
    get("SELECT COUNT(*) AS count FROM orders WHERE status = 'Pending'"),
    get('SELECT meter_low_stock, pcs_low_stock, kgs_low_stock FROM app_settings WHERE id = 1'),
  ]);
  const meterLimit = Number(settings?.meter_low_stock ?? 5);
  const pcsLimit = Number(settings?.pcs_low_stock ?? 5);
  const kgsLimit = Number(settings?.kgs_low_stock ?? 5);
  const lowStock = await get(
    `
    SELECT COUNT(*) AS count
    FROM products
    WHERE
      (LOWER(COALESCE(unit_type, 'meter')) IN ('pcs', 'piece', 'pieces', 'pc', 'nos') AND stock <= ?)
      OR (LOWER(COALESCE(unit_type, 'meter')) IN ('kgs', 'kg', 'kilogram', 'kilograms') AND stock <= ?)
      OR (
        LOWER(COALESCE(unit_type, 'meter')) NOT IN (
          'pcs', 'piece', 'pieces', 'pc', 'nos', 'kgs', 'kg', 'kilogram', 'kilograms'
        )
        AND stock <= ?
      )
    `,
    [pcsLimit, kgsLimit, meterLimit]
  );

  return {
    orders: orders?.count ?? 0,
    customers: customers?.count ?? 0,
    products: products?.count ?? 0,
    revenue: revenue?.amount ?? 0,
    pending: pending?.count ?? 0,
    lowStock: lowStock?.count ?? 0,
  };
});

ipcMain.handle('db:getProducts', async (_event, payload) => {
  const includeInactive = Boolean(payload?.includeInactive);
  const whereClause = includeInactive ? '' : 'WHERE COALESCE(is_active, 1) = 1';
  return all(`SELECT * FROM products ${whereClause} ORDER BY id ASC`);
});

ipcMain.handle('db:addProduct', async (_event, payload) => {
  const name = String(payload?.name ?? '').trim();
  const sku = String(payload?.sku ?? '').trim();
  const unit = Number(payload?.unit ?? 0);
  const unitTypeInput = String(payload?.unitType ?? 'meter').trim().toLowerCase();
  const unitType = ['pcs', 'meter', 'kgs'].includes(unitTypeInput) ? unitTypeInput : 'meter';
  const price = Number(payload?.price ?? 0);
  const stock = unit;

  if (!name || !sku) {
    return { ok: false, message: 'Name and SKU are required' };
  }
  const result = await run(
    'INSERT INTO products (name, sku, unit, unit_type, price, stock) VALUES (?, ?, ?, ?, ?, ?)',
    [name, sku, unit, unitType, price, stock]
  );

  await logAction({
    actionType: 'create',
    entity: 'products',
    entityId: result.lastID,
    before: null,
    after: { name, sku, unit, unitType, price, stock },
  });

  return { ok: true, id: result.lastID };
});

ipcMain.handle('db:updateProduct', async (_event, payload) => {
  const id = Number(payload?.id);
  if (!id) return { ok: false, message: 'Invalid product id' };

  const before = await get('SELECT * FROM products WHERE id = ?', [id]);
  if (!before) return { ok: false, message: 'Product not found' };

  const name = String(payload?.name ?? before.name).trim();
  const sku = String(payload?.sku ?? before.sku).trim();
  const addUnit = Number(payload?.addUnit ?? 0);
  const beforeUnit = Number(before.unit ?? 0);
  const beforeUnitType = String(before.unit_type ?? 'meter').trim().toLowerCase();
  const payloadUnitType = String(payload?.unitType ?? beforeUnitType).trim().toLowerCase();
  const unitType = ['pcs', 'meter', 'kgs'].includes(payloadUnitType) ? payloadUnitType : 'meter';
  const payloadUnit = Number(payload?.unit ?? beforeUnit);
  const safeBeforeUnit = Number.isFinite(beforeUnit) ? beforeUnit : 0;
  const safePayloadUnit = Number.isFinite(payloadUnit) ? payloadUnit : safeBeforeUnit;
  const safeAddUnit = Number.isFinite(addUnit) && addUnit > 0 ? addUnit : 0;
  const unit = safeAddUnit > 0 ? safeBeforeUnit + safeAddUnit : safePayloadUnit;
  const price = Number(payload?.price ?? before.price);
  const stock = unit;

  await run(
    'UPDATE products SET name = ?, sku = ?, unit = ?, unit_type = ?, price = ?, stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, sku, unit, unitType, price, stock, id]
  );

  const after = await get('SELECT * FROM products WHERE id = ?', [id]);

  await logAction({
    actionType: 'update',
    entity: 'products',
    entityId: id,
    before,
    after,
  });

  return { ok: true };
});

ipcMain.handle('db:deleteProduct', async (_event, payload) => {
  const id = Number(payload?.id);
  if (!id) return { ok: false, message: 'Invalid product id' };

  const used = await get('SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?', [id]);
  if ((used?.count ?? 0) > 0) {
    return { ok: false, message: 'Product is used in orders and cannot be deleted' };
  }

  const before = await get('SELECT * FROM products WHERE id = ?', [id]);
  if (!before) return { ok: false, message: 'Product not found' };

  await run('DELETE FROM products WHERE id = ?', [id]);

  await logAction({
    actionType: 'delete',
    entity: 'products',
    entityId: id,
    before,
    after: null,
  });

  return { ok: true };
});

ipcMain.handle('db:setProductActive', async (_event, payload) => {
  const id = Number(payload?.id);
  const isActive = Number(payload?.isActive) ? 1 : 0;
  if (!id) return { ok: false, message: 'Invalid product id' };

  const before = await get('SELECT * FROM products WHERE id = ?', [id]);
  if (!before) return { ok: false, message: 'Product not found' };

  await run('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    isActive,
    id,
  ]);

  const after = await get('SELECT * FROM products WHERE id = ?', [id]);
  await logAction({
    actionType: isActive ? 'activate' : 'deactivate',
    entity: 'products',
    entityId: id,
    before,
    after,
  });

  return { ok: true };
});

ipcMain.handle('db:getCustomers', async (_event, payload) => {
  const includeInactive = Boolean(payload?.includeInactive);
  const whereClause = includeInactive ? '' : 'WHERE COALESCE(is_active, 1) = 1';
  return all(`SELECT * FROM customers ${whereClause} ORDER BY id ASC`);
});

ipcMain.handle('db:addCustomer', async (_event, payload) => {
  const name = String(payload?.name ?? '').trim();
  const phone = String(payload?.phone ?? '').trim();
  const email = String(payload?.email ?? '').trim();
  const address = String(payload?.address ?? '').trim();
  const gstNumber = String(payload?.gstNumber ?? '').trim();

  if (!name || !phone || !address) {
    return { ok: false, message: 'Name, phone number and address are required' };
  }

  const result = await run(
    'INSERT INTO customers (name, phone, email, address, gst_number) VALUES (?, ?, ?, ?, ?)',
    [name, phone, email, address, gstNumber]
  );

  await logAction({
    actionType: 'create',
    entity: 'customers',
    entityId: result.lastID,
    before: null,
    after: { name, phone, email, address, gstNumber },
  });

  return { ok: true, id: result.lastID };
});

ipcMain.handle('db:updateCustomer', async (_event, payload) => {
  const id = Number(payload?.id);
  if (!id) return { ok: false, message: 'Invalid customer id' };

  const before = await get('SELECT * FROM customers WHERE id = ?', [id]);
  if (!before) return { ok: false, message: 'Customer not found' };

  const name = String(payload?.name ?? before.name).trim();
  const phone = String(payload?.phone ?? before.phone).trim();
  const email = String(payload?.email ?? before.email).trim();
  const address = String(payload?.address ?? before.address).trim();
  const gstNumber = String(payload?.gstNumber ?? before.gst_number).trim();

  if (!name) {
    return { ok: false, message: 'Name, phone number and address are required' };
  }
  if (!phone) {
    return { ok: false, message: 'Phone number is required' };
  }
  if (!address) {
    return { ok: false, message: 'Address is required' };
  }

  await run(
    'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, gst_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, phone, email, address, gstNumber, id]
  );

  const after = await get('SELECT * FROM customers WHERE id = ?', [id]);

  await logAction({
    actionType: 'update',
    entity: 'customers',
    entityId: id,
    before,
    after,
  });

  return { ok: true };
});

ipcMain.handle('db:deleteCustomer', async (_event, payload) => {
  const id = Number(payload?.id);
  if (!id) return { ok: false, message: 'Invalid customer id' };

  const used = await get('SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?', [id]);
  if ((used?.count ?? 0) > 0) {
    return { ok: false, message: 'Customer has orders and cannot be deleted' };
  }

  const before = await get('SELECT * FROM customers WHERE id = ?', [id]);
  if (!before) return { ok: false, message: 'Customer not found' };

  await run('DELETE FROM customers WHERE id = ?', [id]);

  await logAction({
    actionType: 'delete',
    entity: 'customers',
    entityId: id,
    before,
    after: null,
  });

  return { ok: true };
});

ipcMain.handle('db:setCustomerActive', async (_event, payload) => {
  const id = Number(payload?.id);
  const isActive = Number(payload?.isActive) ? 1 : 0;
  if (!id) return { ok: false, message: 'Invalid customer id' };

  const before = await get('SELECT * FROM customers WHERE id = ?', [id]);
  if (!before) return { ok: false, message: 'Customer not found' };

  await run('UPDATE customers SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
    isActive,
    id,
  ]);

  const after = await get('SELECT * FROM customers WHERE id = ?', [id]);
  await logAction({
    actionType: isActive ? 'activate' : 'deactivate',
    entity: 'customers',
    entityId: id,
    before,
    after,
  });

  return { ok: true };
});

ipcMain.handle('db:getOrders', async () => {
  return all(
    `
    SELECT orders.*, customers.name AS customer_name
    FROM orders
    JOIN customers ON customers.id = orders.customer_id
    ORDER BY orders.id ASC
    `
  );
});

ipcMain.handle('db:getOrderItems', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  if (!orderId) return [];

  return all(
    `
    SELECT order_items.*, products.name AS product_name, products.unit_type AS unit_type
    FROM order_items
    JOIN products ON products.id = order_items.product_id
    WHERE order_items.order_id = ?
    ORDER BY order_items.id ASC
    `,
    [orderId]
  );
});

ipcMain.handle('db:addOrder', async (_event, payload) => {
  const customerId = Number(payload?.customerId);
  const orderDate = String(payload?.orderDate ?? '').trim();
  const status = String(payload?.status ?? 'Pending').trim();
  const notes = String(payload?.notes ?? '').trim();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!customerId || !orderDate || items.length === 0) {
    return { ok: false, message: 'Customer, date, and at least one item are required' };
  }

  const customer = await get('SELECT id, name, is_active FROM customers WHERE id = ?', [customerId]);
  if (!customer || Number(customer.is_active ?? 1) !== 1) {
    return { ok: false, message: 'Selected customer is inactive or not found' };
  }

  await run('BEGIN');

  try {
    let total = 0;
    for (const item of items) {
      const qty = Number(item.qty ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);
      total += qty * unitPrice;
    }

    const orderResult = await run(
      'INSERT INTO orders (customer_id, order_date, status, total, notes) VALUES (?, ?, ?, ?, ?)',
      [customerId, orderDate, status || 'Pending', total, notes]
    );

    for (const item of items) {
      const productId = Number(item.productId);
      const qty = Number(item.qty ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);

      const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
      if (!product) {
        throw new Error('Product not found');
      }
      if (Number(product.is_active ?? 1) !== 1) {
        throw new Error(`${product.name} is inactive`);
      }

      const availableUnit = Number(product.unit ?? product.stock ?? 0);
      if (availableUnit < qty) {
        throw new Error(`Not enough unit for ${product.name}`);
      }

      const lineTotal = qty * unitPrice;

      await run(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
        [orderResult.lastID, productId, qty, unitPrice, lineTotal]
      );

      await run('UPDATE products SET unit = unit - ?, stock = unit - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        qty,
        qty,
        productId,
      ]);
    }

    await logAction({
      actionType: 'create',
      entity: 'orders',
      entityId: orderResult.lastID,
      before: null,
      after: { customerId, orderDate, status, total, notes, items },
    });

    await run('COMMIT');
    return { ok: true, id: orderResult.lastID };
  } catch (error) {
    await run('ROLLBACK');
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('db:updateOrderStatus', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  const status = String(payload?.status ?? '').trim();

  if (!orderId || !status) return { ok: false, message: 'Order and status are required' };

  const before = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!before) return { ok: false, message: 'Order not found' };

  await run('BEGIN');
  try {
    const isCancelTransition = before.status !== 'Cancelled' && status === 'Cancelled';
    const isUncancelTransition = before.status === 'Cancelled' && status !== 'Cancelled';

    if (isCancelTransition || isUncancelTransition) {
      const items = await all('SELECT product_id, qty FROM order_items WHERE order_id = ?', [orderId]);

      for (const item of items) {
        const productId = Number(item.product_id);
        const qty = Number(item.qty ?? 0);
        if (!productId || qty <= 0) continue;

        if (isCancelTransition) {
          await run(
            'UPDATE products SET unit = unit + ?, stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [qty, qty, productId]
          );
        } else if (isUncancelTransition) {
          const product = await get('SELECT id, name, unit FROM products WHERE id = ?', [productId]);
          const availableUnit = Number(product?.unit ?? 0);
          if (!product || availableUnit < qty) {
            throw new Error(`Not enough unit for ${product?.name || 'product'} to restore order status`);
          }

          await run(
            'UPDATE products SET unit = unit - ?, stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [qty, qty, productId]
          );
        }
      }
    }

    await run(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, orderId]
    );

    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK');
    return { ok: false, message: error.message };
  }

  const after = await get('SELECT * FROM orders WHERE id = ?', [orderId]);

  await logAction({
    actionType: 'status_change',
    entity: 'orders',
    entityId: orderId,
    before,
    after,
  });

  return { ok: true };
});

ipcMain.handle('db:deleteOrder', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  if (!orderId) return { ok: false, message: 'Order is required' };

  const before = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!before) return { ok: false, message: 'Order not found' };

  await run('DELETE FROM orders WHERE id = ?', [orderId]);

  await logAction({
    actionType: 'delete',
    entity: 'orders',
    entityId: orderId,
    before,
    after: null,
  });

  return { ok: true };
});

ipcMain.handle('db:getOrderTracking', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  if (!orderId) return [];

  return all(
    `
    SELECT *
    FROM audit_logs
    WHERE entity = 'orders' AND entity_id = ? AND action_type = 'status_change'
    ORDER BY id ASC
    `,
    [orderId]
  );
});

ipcMain.handle('db:getAuditLogs', async () => {
  return all('SELECT * FROM audit_logs ORDER BY id ASC LIMIT 500');
});

ipcMain.handle('db:getPaymentOrders', async (_event, payload) => {
  const searchOrderId = String(payload?.searchOrderId ?? '').trim();
  const where = [];
  const params = [];

  if (searchOrderId) {
    where.push('CAST(o.id AS TEXT) LIKE ?');
    params.push(`%${searchOrderId}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await all(
    `
    SELECT
      o.id,
      o.order_date,
      o.status,
      o.total,
      o.customer_id,
      c.name AS customer_name,
      COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN payments p ON p.order_id = o.id
    ${whereClause}
    GROUP BY o.id
    ORDER BY o.id DESC
    `,
    params
  );

  return rows.map((row) => {
    const total = Number(row.total ?? 0);
    const paid = Number(row.paid_amount ?? 0);
    const pendingAmount = Math.max(total - paid, 0);
    return {
      ...row,
      paid_amount: paid,
      pending_amount: pendingAmount,
    };
  });
});

ipcMain.handle('db:getOrderPaymentSummary', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  if (!orderId) return null;

  const row = await get(
    `
    SELECT
      o.id,
      o.order_date,
      o.status,
      o.total,
      o.customer_id,
      c.name AS customer_name,
      COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.id = ?
    GROUP BY o.id
    `,
    [orderId]
  );

  if (!row) return null;

  const total = Number(row.total ?? 0);
  const paid = Number(row.paid_amount ?? 0);
  const pendingAmount = Math.max(total - paid, 0);
  return {
    ...row,
    paid_amount: paid,
    pending_amount: pendingAmount,
  };
});

ipcMain.handle('db:getPaymentsByOrder', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  if (!orderId) return [];

  return all(
    `
    SELECT *
    FROM payments
    WHERE order_id = ?
    ORDER BY id DESC
    `,
    [orderId]
  );
});

ipcMain.handle('db:addPayment', async (_event, payload) => {
  const orderId = Number(payload?.orderId);
  const amount = Number(payload?.amount ?? 0);
  const receivedAmount = amount;

  if (!orderId) return { ok: false, message: 'Order is required' };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'Payment amount must be greater than 0' };
  }

  const summary = await get(
    `
    SELECT
      o.id,
      o.status,
      o.total,
      COALESCE(SUM(p.amount), 0) AS paid_amount
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.id = ?
    GROUP BY o.id
    `,
    [orderId]
  );

  if (!summary) return { ok: false, message: 'Order not found' };
  if (summary.status === 'Cancelled') {
    return { ok: false, message: 'Cannot add payment for a cancelled order' };
  }

  const total = Number(summary.total ?? 0);
  const paid = Number(summary.paid_amount ?? 0);
  const pendingAmount = Math.max(total - paid, 0);

  if (amount > pendingAmount) {
    return { ok: false, message: `Payment exceeds pending amount (${pendingAmount})` };
  }

  const result = await run(
    'INSERT INTO payments (order_id, amount, received_amount) VALUES (?, ?, ?)',
    [orderId, amount, receivedAmount]
  );

  await logAction({
    actionType: 'create',
    entity: 'payments',
    entityId: result.lastID,
    before: null,
    after: { orderId, amount, receivedAmount },
  });

  return { ok: true, id: result.lastID };
});

ipcMain.handle('db:getOrderReport', async (_event, payload) => {
  const filters = payload ?? {};
  const where = [];
  const params = [];

  if (filters.status) {
    where.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters.customerId) {
    where.push('o.customer_id = ?');
    params.push(Number(filters.customerId));
  }
  if (filters.productId) {
    where.push('p.id = ?');
    params.push(Number(filters.productId));
  }
  if (filters.dateFrom) {
    where.push('o.order_date >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where.push('o.order_date <= ?');
    params.push(filters.dateTo);
  }
  if (filters.orderId) {
    where.push('o.id = ?');
    params.push(Number(filters.orderId));
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return all(
    `
    SELECT
      o.id AS order_id,
      o.order_date,
      o.status,
      o.total AS order_total,
      o.notes,
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone,
      c.email,
      c.gst_number,
      c.address,
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      p.unit_type,
      oi.qty,
      oi.unit_price,
      oi.line_total
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    ${whereClause}
    ORDER BY o.id ASC, oi.id ASC
    `,
    params
  );
});

ipcMain.handle('file:save', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: payload?.suggestedName || 'report.csv',
    filters: [
      { name: 'Excel XML', extensions: ['xml'] },
      { name: 'Spreadsheet', extensions: ['xls', 'xlsx', 'csv', 'xml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { ok: false };

  await fs.promises.writeFile(filePath, payload?.content ?? '', 'utf8');
  return { ok: true, path: filePath };
});

ipcMain.handle('file:saveExcel', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, message: 'No window available' };
  if (!ExcelJS) return { ok: false, message: 'Excel export library is not available' };

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: payload?.suggestedName || 'report.xlsx',
    filters: [
      { name: 'Excel Workbook', extensions: ['xlsx'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { ok: false };

  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const meta = payload?.meta || {};
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Order Report', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });
  worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

  worksheet.columns = [
    { header: 'Order ID', key: 'order_id', width: 10 },
    { header: 'Order Date', key: 'order_date', width: 12 },
    { header: 'Status', key: 'status', width: 13 },
    { header: 'Customer Name', key: 'customer_name', width: 20 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'GST Number', key: 'gst_number', width: 14 },
    { header: 'Address', key: 'address', width: 24 },
    { header: 'Product', key: 'product_name', width: 18 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: 'Qty', key: 'qty', width: 12 },
    { header: 'Unit', key: 'unit_type', width: 10 },
    { header: 'Unit Price', key: 'unit_price', width: 14 },
    { header: 'Line Total', key: 'line_total', width: 14 },
    { header: 'Order Total', key: 'order_total', width: 14 },
  ];

  worksheet.getCell('A1').value = 'Generated';
  worksheet.getCell('B1').value = String(meta.generatedAt ?? '');
  worksheet.getCell('A2').value = 'Total Rows';
  worksheet.getCell('B2').value = Number(meta.totalRows ?? rows.length);
  worksheet.getCell('A3').value = 'Status';
  worksheet.getCell('B3').value = String(meta.status ?? 'All');
  worksheet.getCell('C3').value = 'Customer';
  worksheet.getCell('D3').value = String(meta.customer ?? 'All customers');
  worksheet.getCell('E3').value = 'Product';
  worksheet.getCell('F3').value = String(meta.product ?? 'All products');
  worksheet.getCell('A4').value = 'Date Range';
  worksheet.getCell('B4').value = String(meta.dateRange ?? '- to -');
  worksheet.getCell('C4').value = 'Order ID';
  worksheet.getCell('D4').value = String(meta.orderId ?? '-');

  ['A1', 'A2', 'A3', 'C3', 'E3', 'A4', 'C4'].forEach((cellRef) => {
    const c = worksheet.getCell(cellRef);
    c.font = { bold: true, color: { argb: 'FF1F2937' } };
  });

  const headerRow = worksheet.getRow(6);
  headerRow.values = [
    'Order ID',
    'Order Date',
    'Status',
    'Customer Name',
    'Phone',
    'Email',
    'GST Number',
    'Address',
    'Product',
    'SKU',
    'Qty',
    'Unit',
    'Unit Price',
    'Line Total',
    'Order Total',
  ];
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const statusColor = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'delivered') return 'FF047857';
    if (normalized === 'processing') return 'FF2563EB';
    if (normalized === 'pending') return 'FFB45309';
    if (normalized === 'cancelled') return 'FFDC2626';
    if (normalized === 'shipped') return 'FF7C3AED';
    return 'FF1F2937';
  };

  let excelRowIndex = 7;
  rows.forEach((row) => {
    const dataRow = worksheet.getRow(excelRowIndex);
    dataRow.values = [
      row.order_id ?? '',
      row.order_date ?? '',
      row.status ?? '',
      row.customer_name ?? '',
      row.phone ?? '',
      row.email ?? '',
      row.gst_number ?? '',
      row.address ?? '',
      row.product_name ?? '',
      row.sku ?? '',
      row.qty ?? '',
      row.unit_type ?? '',
      Number(row.unit_price ?? 0),
      Number(row.line_total ?? 0),
      Number(row.order_total ?? 0),
    ];
    dataRow.height = 22;
    dataRow.eachCell((cell) => {
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (excelRowIndex % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });

    worksheet.getCell(`C${excelRowIndex}`).font = {
      bold: true,
      color: { argb: statusColor(row.status) },
    };
    ['M', 'N', 'O'].forEach((col) => {
      worksheet.getCell(`${col}${excelRowIndex}`).numFmt = '"₹"#,##0.00';
    });
    excelRowIndex += 1;
  });

  worksheet.autoFilter = {
    from: 'A6',
    to: 'O6',
  };

  await workbook.xlsx.writeFile(filePath);

  return { ok: true, path: filePath };
});

ipcMain.handle('file:savePdf', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, message: 'No window available' };

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: payload?.suggestedName || 'report.pdf',
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { ok: false };

  const pdfData = await win.webContents.printToPDF({});
  await fs.promises.writeFile(filePath, pdfData);
  return { ok: true, path: filePath };
});

ipcMain.handle('file:savePdfFromHtml', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, message: 'No window available' };

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: payload?.suggestedName || 'report.pdf',
    filters: [
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { ok: false };

  const html = String(payload?.html ?? '');
  if (!html.trim()) return { ok: false, message: 'No HTML content provided' };

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });
    await fs.promises.writeFile(filePath, pdfData);
    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, message: error.message };
  } finally {
    if (!printWin.isDestroyed()) printWin.destroy();
  }
});

ipcMain.handle('file:print', async () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, message: 'No window available' };
  try {
    await new Promise((resolve, reject) => {
      win.webContents.print({ printBackground: true }, (success, errorType) => {
        if (success) return resolve(true);
        reject(new Error(errorType || 'Print canceled'));
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

ipcMain.handle('file:printHtml', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, message: 'No window available' };

  const html = String(payload?.html ?? '');
  if (!html.trim()) return { ok: false, message: 'No HTML content provided' };

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise((resolve, reject) => {
      printWin.webContents.print(
        {
          printBackground: true,
          landscape: true,
        },
        (success, errorType) => {
          if (success) return resolve(true);
          reject(new Error(errorType || 'Print canceled'));
        }
      );
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  } finally {
    if (!printWin.isDestroyed()) printWin.destroy();
  }
});

ipcMain.handle('file:printPreview', async (_event, payload) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { ok: false, message: 'No window available' };

  try {
    const suggestedName = String(payload?.suggestedName ?? `print-preview-${Date.now()}.pdf`);
    const fileName = suggestedName.toLowerCase().endsWith('.pdf')
      ? suggestedName
      : `${suggestedName}.pdf`;
    const tempPath = path.join(app.getPath('temp'), fileName);

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
    });
    await fs.promises.writeFile(tempPath, pdfData);

    const openResult = await shell.openPath(tempPath);
    if (openResult) return { ok: false, message: openResult };

    return { ok: true, path: tempPath };
  } catch (error) {
    return { ok: false, message: error.message };
  }
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // ❌ Remove default menu (File, Edit, View, etc.)
  Menu.setApplicationMenu(null);

  // Load app (Vite dev or production build)
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'index.html'));
  }

  // Optional: open dev tools
  // mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  ensureSchema()
    .then(() => createWindow())
    .catch((err) => {
      console.error('Failed to initialize database:', err);
      app.quit();
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  db.close();
});
