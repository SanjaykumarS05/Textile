import { renderSharedSidebar } from './sidebar.js';

const statusOptions = ['Pending', 'Processing', 'Delivered', 'Cancelled'];

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const PAGE_SIZE = 10;
const PAGE_TRANSITION_MS = 200;

const applyOfflineMaterialIcons = () => {};

const navigateWithTransition = (href) => {
  const target = String(href || '').trim();
  if (!target) return;
  if (document.body.dataset.navigating === '1') return;
  document.body.dataset.navigating = '1';
  document.body.classList.add('page-leave');
  window.setTimeout(() => {
    window.location.href = target;
  }, PAGE_TRANSITION_MS);
};

const initPageTransitions = () => {
  document.body.classList.add('page-enter');
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add('page-enter-active'));
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (/^https?:\/\//i.test(href)) return;
    if (href === window.location.pathname.split('/').pop()) return;
    event.preventDefault();
    navigateWithTransition(href);
  });
};

const paginateRows = (rows, page, pageSize = PAGE_SIZE) => {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageRows: rows.slice(start, start + pageSize),
    safePage,
    totalPages,
  };
};

const getPaginationContainer = (key, anchorElement) => {
  let container = qs(`[data-pagination-for="${key}"]`);
  if (container) return container;
  container = document.createElement('div');
  container.className = 'pagination';
  container.dataset.paginationFor = key;
  const anchor = anchorElement?.closest('table') || anchorElement;
  anchor?.insertAdjacentElement('afterend', container);
  return container;
};

const renderPagination = ({
  key,
  anchorElement,
  totalItems,
  currentPage,
  pageSize = PAGE_SIZE,
  onPageChange,
}) => {
  const container = getPaginationContainer(key, anchorElement);
  if (!container) return 1;

  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return 1;
  }

  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  container.innerHTML = '';

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pagination-btn${page === safePage ? ' active' : ''}`;
    button.textContent = String(page);
    button.disabled = page === safePage;
    button.addEventListener('click', () => onPageChange(page));
    container.appendChild(button);
  }

  return safePage;
};

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    Number(value || 0)
  );

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('en-GB');
};

const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('app-theme', theme);
};

const initTheme = () => {
  const saved = localStorage.getItem('app-theme') || 'dark';
  setTheme(saved);
  const toggle = qs('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
  }
};

const initSidebar = () => {
  const app = qs('.app');
  const toggle = qs('[data-sidebar-toggle]');
  if (!app || !toggle) return;

  const updateSidebarHoverLabels = () => {
    qsa('.sidebar .nav-link').forEach((link) => {
      const label = qs('.nav-label', link)?.textContent?.trim();
      if (!label) return;
      link.setAttribute('aria-label', label);
      link.title = '';
    });
  };

  const saved = localStorage.getItem('sidebar-collapsed') === 'true';
  if (saved) app.classList.add('sidebar-collapsed');

  const page = document.body.dataset.page || '';
  const inOrdersSection = page === 'orders' || page === 'orders-create' || page === 'orders-track';
  const inProductsSection = page === 'products' || page === 'products-list' || page === 'products-add';
  const inCustomersSection =
    page === 'customers' || page === 'customers-add' || page === 'customers-list';

  const navGroups = [
    { group: qs('.nav-group-orders'), toggle: qs('[data-orders-toggle]'), isSection: inOrdersSection },
    { group: qs('.nav-group-products'), toggle: qs('[data-products-toggle]'), isSection: inProductsSection },
    {
      group: qs('.nav-group-customers'),
      toggle: qs('[data-customers-toggle]'),
      isSection: inCustomersSection,
    },
  ];

  const syncGroupVisibility = () => {
    const collapsed = app.classList.contains('sidebar-collapsed');
    navGroups.forEach(({ group, isSection }) => {
      if (!group) return;
      if (collapsed) {
        group.classList.remove('open');
        return;
      }
      if (isSection) {
        group.classList.add('open');
      } else {
        group.classList.remove('open');
      }
    });
  };

  navGroups.forEach(({ group, toggle: groupToggle, isSection }) => {
    if (!group || !groupToggle) return;
    if (isSection) group.classList.add('open');
    groupToggle.addEventListener('click', () => {
      group.classList.toggle('open');
    });
  });
  syncGroupVisibility();

  updateSidebarHoverLabels();

  toggle.addEventListener('click', () => {
    app.classList.toggle('sidebar-collapsed');
    syncGroupVisibility();
    localStorage.setItem('sidebar-collapsed', app.classList.contains('sidebar-collapsed'));
    updateSidebarHoverLabels();
  });
};

const setActiveNav = () => {
  const page = document.body.dataset.page;
  qsa('.nav-link').forEach((link) => {
    if (link.dataset.nav === page) {
      link.classList.add('active');
    }
  });
  if (page === 'orders' || page === 'orders-create' || page === 'orders-track') {
    qs('[data-nav="orders"]')?.classList.add('active');
    qs('.nav-group-orders')?.classList.add('open');
  }
  if (page === 'products' || page === 'products-list' || page === 'products-add') {
    qs('[data-nav="products"]')?.classList.add('active');
    qs('.nav-group-products')?.classList.add('open');
  }
  if (page === 'customers' || page === 'customers-add' || page === 'customers-list') {
    qs('[data-nav="customers"]')?.classList.add('active');
    qs('.nav-group-customers')?.classList.add('open');
  }
};

const showNotice = (message, variant = 'info') => {
  const notice = qs('.notice');
  if (!notice) return;
  notice.textContent = message;
  notice.classList.add('show');
  notice.dataset.variant = variant;
  setTimeout(() => notice.classList.remove('show'), 3500);
};

const captureFormState = (form) => {
  const state = {};
  qsa('input, select, textarea', form).forEach((element) => {
    if (!element.id) return;
    if (element.type === 'checkbox' || element.type === 'radio') {
      state[element.id] = element.checked;
      return;
    }
    state[element.id] = element.value;
  });
  return state;
};

const restoreFormState = (state) => {
  Object.entries(state).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (!element) return;
    if (element.type === 'checkbox' || element.type === 'radio') {
      element.checked = Boolean(value);
      return;
    }
    element.value = value;
  });
};

const showConfirmDialog = ({ title = 'Confirm', message = 'Are you sure?' } = {}) =>
  new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-modal card pad" role="dialog" aria-modal="true" aria-label="${title}">
        <h3 class="confirm-title">${title}</h3>
        <p class="confirm-text">${message}</p>
        <div class="confirm-actions">
          <button type="button" class="btn" data-confirm-ok>Yes</button>
          <button type="button" class="btn btn-outline" style="background-color: var(--danger); color: #fff; border-color: var(--danger);" data-confirm-cancel>No</button>
        </div>
      </div>
    `;

    const cleanup = (value) => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(value);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') cleanup(false);
      if (event.key === 'Enter') cleanup(true);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(false);
      if (event.target.closest('[data-confirm-cancel]')) cleanup(false);
      if (event.target.closest('[data-confirm-ok]')) cleanup(true);
    });

    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    qs('[data-confirm-ok]', overlay)?.focus();
  });

const dashboardPage = async () => {
  let recentOrdersPage = 1;
  let lowStockPage = 1;

  qsa('.kpi-grid .kpi-link[data-href]').forEach((card) => {
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    const href = card.dataset.href;
    if (!href) return;
    card.addEventListener('click', () => {
      navigateWithTransition(href);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      navigateWithTransition(href);
    });
  });

  const [stats, settings] = await Promise.all([window.db.getDashboardStats(), window.db.getSettings()]);
  const meterLowStockLimit = Number(settings?.meterLowStock ?? 5);
  const pcsLowStockLimit = Number(settings?.pcsLowStock ?? 5);
  const kgsLowStockLimit = Number(settings?.kgsLowStock ?? 5);
  qs('#statOrders').textContent = stats.orders;
  qs('#statRevenue').textContent = formatMoney(stats.revenue);
  qs('#statCustomers').textContent = stats.customers;
  qs('#statLowStock').textContent = '0';

  const orders = await window.db.getOrders();
  const ordersBody = qs('#recentOrders');
  const renderRecentOrders = () => {
    ordersBody.innerHTML = '';
    if (orders.length === 0) {
      ordersBody.innerHTML = '<tr><td colspan="4" class="muted">No orders yet.</td></tr>';
      renderPagination({
        key: 'dashboard-recent-orders',
        anchorElement: ordersBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(orders, recentOrdersPage);
    recentOrdersPage = safePage;
    pageRows.forEach((order) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${order.id}</td>
        <td>${order.customer_name}</td>
        <td>${formatDate(order.order_date)}</td>
        <td>${renderStatusBadge(order.status)}</td>
      `;
      ordersBody.appendChild(row);
    });
    recentOrdersPage = renderPagination({
      key: 'dashboard-recent-orders',
      anchorElement: ordersBody,
      totalItems: orders.length,
      currentPage: recentOrdersPage,
      onPageChange: (page) => {
        recentOrdersPage = page;
        renderRecentOrders();
      },
    });
  };

  const products = await window.db.getProducts();
  const lowStockBody = qs('#lowStockList');
  const lowStock = products.filter((product) => {
    const unitType = String(product.unit_type || 'meter').toLowerCase();
    const stock = Number(product.stock ?? 0);
    const isPieces = ['pcs', 'piece', 'pieces', 'pc', 'nos'].includes(unitType);
    const isKgs = ['kgs', 'kg', 'kilogram', 'kilograms'].includes(unitType);
    if (isPieces) return stock <= pcsLowStockLimit;
    if (isKgs) return stock <= kgsLowStockLimit;
    return stock <= meterLowStockLimit;
  });
  qs('#statLowStock').textContent = String(lowStock.length);
  const renderLowStock = () => {
    lowStockBody.innerHTML = '';
    if (lowStock.length === 0) {
      lowStockBody.innerHTML = '<tr><td colspan="3" class="muted">No low stock items.</td></tr>';
      renderPagination({
        key: 'dashboard-low-stock',
        anchorElement: lowStockBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(lowStock, lowStockPage);
    lowStockPage = safePage;
    pageRows.forEach((product) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${product.name}</td>
        <td>${product.sku}</td>
        <td>${product.stock} ${product.unit_type || 'meter'}</td>
      `;
      lowStockBody.appendChild(row);
    });
    lowStockPage = renderPagination({
      key: 'dashboard-low-stock',
      anchorElement: lowStockBody,
      totalItems: lowStock.length,
      currentPage: lowStockPage,
      onPageChange: (page) => {
        lowStockPage = page;
        renderLowStock();
      },
    });
  };

  renderRecentOrders();
  renderLowStock();
};

const renderStatusBadge = (status) => {
  const key = status.toLowerCase().replace(' ', '');
  return `<span class="badge ${key}">${status}</span>`;
};

const productsPage = async () => {
  const form = qs('#productForm');
  const cardList = qs('#productsCardList');
  const productSearchInput = qs('#productSearchInput');
  const productSearchBtn = qs('#productSearchBtn');
  const idField = qs('#productId');
  const unitField = qs('#productUnit');
  const unitTypeField = qs('#productUnitSelect');
  const addUnitWrap = qs('#productAddUnitWrap');
  const addUnitField = qs('#productAddUnit');
  let productPage = 1;
  let productSearchQuery = '';
  let currentAvailableUnit = 0;
  let allProducts = [];

  const queryParams = new URLSearchParams(window.location.search);
  const editProductId = Number(queryParams.get('edit'));

  const loadProductForEditing = async (productId) => {
    if (!form || !idField) return;
    const products = allProducts.length ? allProducts : await window.db.getProducts();
    const product = products.find((item) => item.id === Number(productId));
    if (!product) {
      showNotice('Product not found for editing.', 'error');
      return;
    }
    idField.value = product.id;
    qs('#productName').value = product.name;
    qs('#productSku').value = product.sku;
    qs('#productUnit').value = product.unit;
    qs('#productUnitSelect').value = product.unit_type || 'meter';
    qs('#productPrice').value = product.price;
    currentAvailableUnit = Number(product.unit || 0);
    if (unitField) unitField.readOnly = true;
    if (unitTypeField) unitTypeField.disabled = true;
    if (addUnitWrap) addUnitWrap.hidden = false;
    if (addUnitField) addUnitField.value = '0';
    refreshAvailableFromAddUnit();
    showNotice('Editing product. Update and save.', 'info');
  };

  const resetProductFormState = () => {
    if (unitField) unitField.readOnly = false;
    if (addUnitWrap) addUnitWrap.hidden = true;
    if (addUnitField) addUnitField.value = '0';
    if (unitTypeField) unitTypeField.disabled = false;
    currentAvailableUnit = 0;
  };

  const refreshAvailableFromAddUnit = () => {
    if (!idField?.value || !unitField) return;
    const addUnitValue = Number(addUnitField?.value || 0);
    unitField.value = String(currentAvailableUnit + (Number.isFinite(addUnitValue) ? addUnitValue : 0));
  };

  const refresh = async () => {
    allProducts = await window.db.getProducts({ includeInactive: true });
    const filteredProducts = productSearchQuery
      ? allProducts.filter((product) => {
          const name = String(product.name || '').toLowerCase();
          const sku = String(product.sku || '').toLowerCase();
          return name.includes(productSearchQuery) || sku.includes(productSearchQuery);
        })
      : allProducts;
    if (!cardList) return;
    cardList.innerHTML = '';
    if (filteredProducts.length === 0) {
      cardList.innerHTML = '<p class="muted">No products added.</p>';
      renderPagination({
        key: 'products-cards',
        anchorElement: cardList,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(filteredProducts, productPage);
    productPage = safePage;
    pageRows.forEach((product) => {
      const isActive = Number(product.is_active ?? 1) === 1;
      const card = document.createElement('article');
      card.className = 'product-record-card';
      card.innerHTML = `
        <div class="product-record-head">
          <h4>${product.name}</h4>
          <span class="tag ${isActive ? 'status-active' : 'status-inactive'}">#${product.id} - ${isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="product-record-meta">
          <p><strong>SKU:</strong> ${product.sku}</p>
          <p><strong>Available:</strong> ${product.unit} ${product.unit_type || 'meter'}</p>
          <p><strong>Price:</strong> ${formatMoney(product.price)}</p>
          <p><strong>Created:</strong> ${formatDate(product.created_at)}</p>
        </div>
        <div class="product-record-actions">
          <a class="btn btn-sm btn-outline" href="products-add.html?edit=${product.id}">Edit</a>
          <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-success'}" data-toggle-active="${product.id}" data-next-active="${isActive ? 0 : 1}">
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      `;
      cardList.appendChild(card);
    });
    productPage = renderPagination({
      key: 'products-cards',
      anchorElement: cardList,
      totalItems: filteredProducts.length,
      currentPage: productPage,
      onPageChange: (page) => {
        productPage = page;
        refresh();
      },
    });
  };

  if (cardList) {
    cardList.addEventListener('click', async (event) => {
      const editId = event.target.dataset.edit;
      const toggleActiveId = event.target.dataset.toggleActive;
      const nextActive = Number(event.target.dataset.nextActive);
      if (editId) {
        navigateWithTransition(`products-add.html?edit=${Number(editId)}`);
        return;
      }
      if (toggleActiveId) {
        const activate = nextActive === 1;
        const isConfirmed = await showConfirmDialog({
          title: activate ? 'Activate Product' : 'Deactivate Product',
          message: `Are you sure you want to ${activate ? 'activate' : 'deactivate'} this product?`,
        });
        if (!isConfirmed) return;
        const result = await window.db.setProductActive(Number(toggleActiveId), activate);
        if (!result.ok) {
          showNotice(result.message, 'error');
          return;
        }
        showNotice(`Product ${activate ? 'activated' : 'deactivated'}.`, 'success');
        productPage = 1;
        await refresh();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formState = captureFormState(form);
      const payload = {
        id: idField.value ? Number(idField.value) : null,
        name: qs('#productName').value.trim(),
        sku: qs('#productSku').value.trim(),
        unit: qs('#productUnit').value.trim(),
        unitType: qs('#productUnitSelect').value,
        price: Number(qs('#productPrice').value || 0),
        addUnit: Number(qs('#productAddUnit')?.value || 0),
      };

      const result = payload.id
        ? await window.db.updateProduct(payload)
        : await window.db.addProduct(payload);

      if (!result.ok) {
        restoreFormState(formState);
        showNotice(result.message, 'error');
        return;
      }

      const wasEdit = Boolean(payload.id);
      form.reset();
      idField.value = '';
      resetProductFormState();
      showNotice(wasEdit ? 'Product updated.' : 'Product added.', 'success');
      productPage = 1;
      await refresh();
      if (!wasEdit) {
        navigateWithTransition('products.html');
      }
    });
  }

  if (addUnitField) {
    addUnitField.addEventListener('input', refreshAvailableFromAddUnit);
    addUnitField.addEventListener('change', refreshAvailableFromAddUnit);
  }

  if (productSearchBtn && productSearchInput) {
    const applyProductSearch = async () => {
      productSearchQuery = productSearchInput.value.trim().toLowerCase();
      productPage = 1;
      await refresh();
    };
    productSearchBtn.addEventListener('click', applyProductSearch);
    productSearchInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await applyProductSearch();
    });
  }

  resetProductFormState();
  await refresh();
  if (form && editProductId) {
    await loadProductForEditing(editProductId);
  }
};

const customersPage = async () => {
  const form = qs('#customerForm');
  const cardList = qs('#customersCardList');
  const customerSearchInput = qs('#customerSearchInput');
  const customerSearchBtn = qs('#customerSearchBtn');
  const idField = qs('#customerId');
  const editCustomerId = Number(new URLSearchParams(window.location.search).get('edit') || 0);
  let currentCustomers = [];
  let customerSearchQuery = '';

  const refresh = async () => {
    if (!cardList) return;
    const customers = await window.db.getCustomers({ includeInactive: true });
    currentCustomers = customerSearchQuery
      ? customers.filter((customer) => {
          const name = String(customer.name || '').toLowerCase();
          const phone = String(customer.phone || '').toLowerCase();
          return name.includes(customerSearchQuery) || phone.includes(customerSearchQuery);
        })
      : customers;
    cardList.innerHTML = '';
    if (currentCustomers.length === 0) {
      cardList.innerHTML = '<p class="muted">No customers added.</p>';
      return;
    }
    currentCustomers.forEach((customer) => {
      const isActive = Number(customer.is_active ?? 1) === 1;
      const card = document.createElement('article');
      card.className = 'customer-card';
      card.innerHTML = `
        <div class="customer-card-head">
          <h4><a href="customer-details.html?id=${customer.id}" data-view="${customer.id}">${customer.name}</a></h4>
          <span class="tag ${isActive ? 'status-active' : 'status-inactive'}">#${customer.id} - ${isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="customer-card-body">
          <p><strong>Phone:</strong> ${customer.phone || '-'}</p>
          <p><strong>Email:</strong> ${customer.email || '-'}</p>
          <p><strong>Address:</strong> ${customer.address || '-'}</p>
          <p><strong>GST:</strong> ${customer.gst_number || '-'}</p>
          <p><strong>Created:</strong> ${formatDate(customer.created_at)}</p>
        </div>
        <div class="customer-card-actions">
          <button class="btn btn-sm btn-outline" data-edit="${customer.id}">Edit</button>
          <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-success'}" data-toggle-active="${customer.id}" data-next-active="${isActive ? 0 : 1}">
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      `;
      cardList.appendChild(card);
    });
  };

  const loadCustomerForEditing = async (customerId) => {
    if (!form || !idField || !customerId) return;
    const customers = await window.db.getCustomers({ includeInactive: true });
    const customer = customers.find((item) => item.id === Number(customerId));
    if (!customer) {
      showNotice('Customer not found for editing.', 'error');
      return;
    }
    idField.value = customer.id;
    qs('#customerName').value = customer.name;
    qs('#customerPhone').value = customer.phone;
    qs('#customerEmail').value = customer.email;
    qs('#customerAddress').value = customer.address;
    qs('#GSTNumber').value = customer.gst_number || '';
    showNotice('Editing customer. Update and save.', 'info');
  };

  if (cardList) {
    cardList.addEventListener('click', async (event) => {
      const editId = event.target.dataset.edit;
      const toggleActiveId = event.target.dataset.toggleActive;
      const nextActive = Number(event.target.dataset.nextActive);
      if (editId) {
        navigateWithTransition(`customers-add.html?edit=${Number(editId)}`);
        return;
      }
      if (toggleActiveId) {
        const activate = nextActive === 1;
        const isConfirmed = await showConfirmDialog({
          title: activate ? 'Activate Customer' : 'Deactivate Customer',
          message: `Are you sure you want to ${activate ? 'activate' : 'deactivate'} this customer?`,
        });
        if (!isConfirmed) return;
        const result = await window.db.setCustomerActive(Number(toggleActiveId), activate);
        if (!result.ok) {
          showNotice(result.message, 'error');
          return;
        }
        showNotice(`Customer ${activate ? 'activated' : 'deactivated'}.`, 'success');
        await refresh();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formState = captureFormState(form);
      const payload = {
        id: idField?.value ? Number(idField.value) : null,
        name: qs('#customerName').value.trim(),
        phone: qs('#customerPhone').value.trim(),
        email: qs('#customerEmail').value.trim(),
        address: qs('#customerAddress').value.trim(),
        gstNumber: qs('#GSTNumber').value.trim(),
      };

      const result = payload.id
        ? await window.db.updateCustomer(payload)
        : await window.db.addCustomer(payload);

      if (!result.ok) {
        restoreFormState(formState);
        showNotice(result.message, 'error');
        return;
      }

      const wasEdit = Boolean(payload.id);
      form.reset();
      if (idField) idField.value = '';
      showNotice(wasEdit ? 'Customer updated.' : 'Customer added.', 'success');
      if (wasEdit) return;
      navigateWithTransition('customers-list.html');
    });
  }

  if (customerSearchBtn && customerSearchInput && cardList) {
    const applyCustomerSearch = async () => {
      customerSearchQuery = customerSearchInput.value.trim().toLowerCase();
      await refresh();
    };
    customerSearchBtn.addEventListener('click', applyCustomerSearch);
    customerSearchInput.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      await applyCustomerSearch();
    });
  }

  if (cardList) await refresh();
  if (form && editCustomerId) await loadCustomerForEditing(editCustomerId);
};

const settingsPage = async () => {
  const form = qs('#settingsForm');
  if (!form) return;
  const sectionToggles = qsa('input[name="settingsSection"]', form);
  const settingsSections = qsa('[data-settings-section]', form);
  const meterField = qs('#meterLowStockCount');
  const piecesField = qs('#piecesLowStockCount');
  const kgsField = qs('#kgsLowStockCount');
  const nameField = qs('#settingsName');
  const emailField = qs('#settingsEmail');
  const phoneField = qs('#settingsPhone');
  const currentPasswordField = qs('#settingsCurrentPassword');
  const newPasswordField = qs('#settingsNewPassword');
  const confirmPasswordField = qs('#settingsConfirmPassword');

  const setActiveSection = (sectionName) => {
    settingsSections.forEach((section) => {
      const isActive = section.dataset.settingsSection === sectionName;
      section.classList.toggle('active', isActive);
      section.hidden = !isActive;
    });
  };

  form.addEventListener('change', (event) => {
    const toggle = event.target.closest('input[name="settingsSection"]');
    if (!toggle || !toggle.checked) return;
    setActiveSection(toggle.value);
  });

  qsa('.settings-radio-option', form).forEach((option) => {
    option.addEventListener('click', () => {
      const input = qs('input[name="settingsSection"]', option);
      if (!input) return;
      input.checked = true;
      setActiveSection(input.value);
    });
  });

  const defaultToggle = sectionToggles.find((toggle) => toggle.checked) || sectionToggles[0];
  if (defaultToggle) {
    defaultToggle.checked = true;
    setActiveSection(defaultToggle.value);
  }

  const refresh = async () => {
    const settings = await window.db.getSettings();
    meterField.value = String(Number(settings?.meterLowStock ?? 5));
    piecesField.value = String(Number(settings?.pcsLowStock ?? 5));
    kgsField.value = String(Number(settings?.kgsLowStock ?? 5));
    nameField.value = settings?.profile?.name || '';
    emailField.value = settings?.profile?.email || '';
    phoneField.value = settings?.profile?.phone || '';
    currentPasswordField.value = '';
    newPasswordField.value = '';
    confirmPasswordField.value = '';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newPassword = newPasswordField.value.trim();
    const confirmPassword = confirmPasswordField.value.trim();
    if (newPassword && newPassword !== confirmPassword) {
      showNotice('New password and confirm password do not match.', 'error');
      return;
    }

    const result = await window.db.updateSettings({
      meterLowStock: Number(meterField.value || 0),
      pcsLowStock: Number(piecesField.value || 0),
      kgsLowStock: Number(kgsField.value || 0),
      name: nameField.value.trim(),
      email: emailField.value.trim(),
      phone: phoneField.value.trim(),
      currentPassword: currentPasswordField.value,
      newPassword,
    });

    if (!result.ok) {
      showNotice(result.message || 'Failed to save settings.', 'error');
      return;
    }

    showNotice('Settings updated successfully.', 'success');
    await refresh();
  });

  await refresh();
};

const customerDetailsPage = async () => {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('id'));
  if (!id) {
    showNotice('Customer id missing.', 'error');
    return;
  }

  const customers = await window.db.getCustomers({ includeInactive: true });
  const customer = customers.find((item) => item.id === id);
  if (!customer) {
    showNotice('Customer not found.', 'error');
    return;
  }

  qs('#customerName').textContent = customer.name;
  qs('#customerPhone').textContent = customer.phone || '-';
  qs('#customerEmail').textContent = customer.email || '-';
  qs('#customerAddress').textContent = customer.address || '-';
  qs('#GSTNumber').textContent = customer.gst_number || '-';
  qs('#customerJoined').textContent = formatDate(customer.created_at);

  const orders = await window.db.getOrders();
  const customerOrders = orders.filter((order) => order.customer_id === id);
  const body = qs('#customerOrdersBody');
  let customerOrdersPage = 1;
  const renderCustomerOrders = () => {
    body.innerHTML = '';
    if (customerOrders.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="muted">No orders for this customer.</td></tr>';
      renderPagination({
        key: 'customer-orders-table',
        anchorElement: body,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(customerOrders, customerOrdersPage);
    customerOrdersPage = safePage;
    pageRows.forEach((order) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${order.id}</td>
        <td>${formatDate(order.order_date)}</td>
        <td>${formatMoney(order.total)}</td>
        <td>${renderStatusBadge(order.status)}</td>
      `;
      body.appendChild(row);
    });
    customerOrdersPage = renderPagination({
      key: 'customer-orders-table',
      anchorElement: body,
      totalItems: customerOrders.length,
      currentPage: customerOrdersPage,
      onPageChange: (page) => {
        customerOrdersPage = page;
        renderCustomerOrders();
      },
    });
  };
  renderCustomerOrders();
};

const ordersPage = async () => {
  const form = qs('#orderForm');
  const itemsBody = qs('#orderItemsBody');
  const ordersBody = qs('#ordersTableBody') || qs('#ordersCardList');
  const trackingBody = qs('#trackingTableBody') || qs('#trackingCardList');
  const customerSelect = qs('#orderCustomer');
  const productSelect = qs('#orderItemProduct');
  const statusSelect = qs('#orderStatus');
  const totalLabel = qs('#orderTotal');
  const itemPrice = qs('#orderItemPrice');
  const filterStatus = qs('#filterStatus');
  const filterCustomer = qs('#filterCustomer');
  const filterFrom = qs('#filterFrom');
  const filterTo = qs('#filterTo');
  const filterSearch = qs('#filterSearch');
  const printBtn = qs('#printOrders');

  let products = [];
  let customers = [];
  let draftItems = [];
  let allOrders = [];
  let filteredOrders = [];
  let ordersPageNumber = 1;
  let trackingRows = [];
  let trackingPageNumber = 1;

  if (statusSelect) {
    statusOptions.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      statusSelect.appendChild(option);
    });
  }

  const refreshLookups = async () => {
    products = await window.db.getProducts();
    customers = await window.db.getCustomers();
    if (customerSelect) {
      customerSelect.innerHTML = '<option value="">Select customer</option>';
      customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        customerSelect.appendChild(option);
      });
    }
    if (productSelect) {
      productSelect.innerHTML = '<option value="">Select product</option>';
      products.forEach((product) => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = `${product.name} (${product.unit} ${product.unit_type || 'meter'} available)`;
        productSelect.appendChild(option);
      });
    }

    if (filterCustomer) {
      filterCustomer.innerHTML = '<option value="">All customers</option>';
      customers.forEach((customer) => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        filterCustomer.appendChild(option);
      });
    }
  };

  const renderDraftItems = () => {
    if (!itemsBody || !totalLabel) return;
    itemsBody.innerHTML = '';
    if (draftItems.length === 0) {
      itemsBody.innerHTML = '<tr><td colspan="5" class="muted">No items added.</td></tr>';
      totalLabel.textContent = formatMoney(0);
      return;
    }
    let total = 0;
    draftItems.forEach((item, index) => {
      total += item.unit * item.unitPrice;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.unit} ${item.unitType || 'meter'}</td>
        <td>${formatMoney(item.unitPrice)}</td>
        <td>${formatMoney(item.unit * item.unitPrice)}</td>
        <td>
          <button class="btn btn-sm btn-danger" data-remove="${index}">Remove</button>
        </td>
      `;
      itemsBody.appendChild(row);
    });
    totalLabel.textContent = formatMoney(total);
  };

  if (itemsBody) {
    itemsBody.addEventListener('click', (event) => {
      const removeIndex = event.target.dataset.remove;
      if (removeIndex !== undefined) {
        draftItems.splice(Number(removeIndex), 1);
        renderDraftItems();
      }
    });
  }

  if (productSelect && itemPrice) {
    productSelect.addEventListener('change', () => {
      const selected = products.find((product) => product.id === Number(productSelect.value));
      if (selected) {
        itemPrice.value = selected.price;
      }
    });
  }

  const addItemBtn = qs('#addItemBtn');
  if (addItemBtn && productSelect && itemPrice) {
    addItemBtn.addEventListener('click', () => {
      const productId = Number(productSelect.value);
      const unit = Number(qs('#orderItemUnit')?.value || 0);
      const unitPrice = Number(itemPrice.value || 0);
      if (!productId || unit <= 0) {
        showNotice('Select a product and enter unit.', 'error');
        return;
      }
      const product = products.find((item) => item.id === productId);
      if (!product) return;
      draftItems.push({
        productId,
        name: product.name,
        unit,
        unitType: product.unit_type || 'meter',
        unitPrice,
      });
      renderDraftItems();
      const unitInput = qs('#orderItemUnit');
      if (unitInput) unitInput.value = '';
    });
  }

  const applyFilters = (orders) => {
    let filtered = [...orders].filter(
      (order) => order.status !== 'Cancelled' && order.status !== 'Delivered'
    );
    const status = filterStatus?.value;
    const customer = filterCustomer?.value;
    const from = filterFrom?.value;
    const to = filterTo?.value;
    const search = filterSearch?.value?.trim();

    if (status) {
      filtered = filtered.filter((order) => order.status === status);
    }
    if (customer) {
      filtered = filtered.filter((order) => order.customer_id === Number(customer));
    }
    if (from) {
      filtered = filtered.filter((order) => order.order_date >= from);
    }
    if (to) {
      filtered = filtered.filter((order) => order.order_date <= to);
    }
    if (search) {
      filtered = filtered.filter((order) => String(order.id).includes(search));
    }
    return filtered;
  };

  const renderOrders = (orders) => {
    if (!ordersBody) return;
    filteredOrders = orders;
    ordersBody.innerHTML = '';
    const isTableBody = ordersBody.tagName === 'TBODY';
    if (orders.length === 0) {
      ordersBody.innerHTML = isTableBody
        ? '<tr><td colspan="7" class="muted">No orders created.</td></tr>'
        : '<p class="muted">No orders created.</p>';
      renderPagination({
        key: 'orders-table',
        anchorElement: ordersBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(orders, ordersPageNumber);
    ordersPageNumber = safePage;
    pageRows.forEach((order) => {
      if (isTableBody) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>#${order.id}</td>
          <td>${order.customer_name}</td>
          <td>${formatDate(order.order_date)}</td>
          <td>${formatMoney(order.total)}</td>
          <td>${renderStatusBadge(order.status)}</td>
          <td>
            <select class="select" data-status="${order.id}">
              ${statusOptions
                .map(
                  (status) =>
                    `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`
                )
                .join('')}
            </select>
          </td>
          <td>
            <button class="btn btn-sm btn-outline" data-track="${order.id}">Track</button>
          </td>
        `;
        ordersBody.appendChild(row);
      } else {
        const card = document.createElement('article');
        card.className = 'order-record-card';
        card.innerHTML = `
          <div class="order-record-head">
            <h4>Order #${order.id}</h4>
            ${renderStatusBadge(order.status)}
          </div>
          <div class="order-record-meta">
            <p><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Date:</strong> ${formatDate(order.order_date)}</p>
            <p><strong>Total:</strong> ${formatMoney(order.total)}</p>
          </div>
          <div class="order-record-actions">
            <label class="order-status-wrap">
              <select class="select" data-status="${order.id}">
                ${statusOptions
                  .map(
                    (status) =>
                      `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <button class="btn btn-sm btn-outline" data-track="${order.id}">Track</button>
          </div>
        `;
        ordersBody.appendChild(card);
      }
    });
    ordersPageNumber = renderPagination({
      key: 'orders-table',
      anchorElement: ordersBody,
      totalItems: orders.length,
      currentPage: ordersPageNumber,
      onPageChange: (page) => {
        ordersPageNumber = page;
        renderOrders(filteredOrders);
      },
    });
  };

  const renderTracking = () => {
    if (!trackingBody) return;
    trackingBody.innerHTML = '';
    const isTableBody = trackingBody.tagName === 'TBODY';
    if (trackingRows.length === 0) {
      trackingBody.innerHTML = isTableBody
        ? '<tr><td colspan="4" class="muted">No tracking logs yet.</td></tr>'
        : '<p class="muted">No tracking logs yet.</p>';
      renderPagination({
        key: 'tracking-table',
        anchorElement: trackingBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(trackingRows, trackingPageNumber);
    trackingPageNumber = safePage;
    pageRows.forEach((log) => {
      const before = log.before_json ? JSON.parse(log.before_json) : null;
      const after = log.after_json ? JSON.parse(log.after_json) : null;
      if (isTableBody) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>#${log.entity_id}</td>
          <td>${before?.status ?? '-'}</td>
          <td>${after?.status ?? '-'}</td>
          <td>${formatDate(log.created_at)}</td>
        `;
        trackingBody.appendChild(row);
      } else {
        const card = document.createElement('article');
        card.className = 'tracking-record-card';
        card.innerHTML = `
          <div class="tracking-record-head">
            <h4>Order #${log.entity_id}</h4>
            <span class="tag">${formatDate(log.created_at)}</span>
          </div>
          <div class="tracking-record-meta">
            <p><strong>From:</strong> ${before?.status ?? '-'}</p>
            <p><strong>To:</strong> ${after?.status ?? '-'}</p>
          </div>
        `;
        trackingBody.appendChild(card);
      }
    });
    trackingPageNumber = renderPagination({
      key: 'tracking-table',
      anchorElement: trackingBody,
      totalItems: trackingRows.length,
      currentPage: trackingPageNumber,
      onPageChange: (page) => {
        trackingPageNumber = page;
        renderTracking();
      },
    });
  };

  const loadTrackingForOrder = async (orderId) => {
    if (!trackingBody) return;
    trackingRows = await window.db.getOrderTracking(Number(orderId));
    trackingPageNumber = 1;
    renderTracking();
  };

  const refreshOrders = async () => {
    allOrders = await window.db.getOrders();
    const filtered = applyFilters(allOrders);
    renderOrders(filtered);
  };

  [filterStatus, filterCustomer, filterFrom, filterTo, filterSearch].forEach((element) => {
    if (!element) return;
    element.addEventListener('change', () => {
      ordersPageNumber = 1;
      renderOrders(applyFilters(allOrders));
    });
    element.addEventListener('keyup', () => {
      ordersPageNumber = 1;
      renderOrders(applyFilters(allOrders));
    });
  });

  if (printBtn) {
    printBtn.addEventListener('click', async () => {
      const result = await window.db.print();
      if (!result.ok) showNotice(result.message || 'Print failed.', 'error');
    });
  }

  if (ordersBody) {
    ordersBody.addEventListener('change', async (event) => {
      const orderId = event.target.dataset.status;
      if (!orderId) return;
      const previous = allOrders.find((order) => order.id === Number(orderId));
      const status = event.target.value;
      const isConfirmed = await showConfirmDialog({
        title: 'Change Order Status',
        message: `Are you sure you want to change order #${orderId} status to "${status}"?`,
      });
      if (!isConfirmed) {
        if (previous) event.target.value = previous.status;
        return;
      }
      const result = await window.db.updateOrderStatus({ orderId: Number(orderId), status });
      if (!result.ok) {
        showNotice(result.message, 'error');
        if (previous) event.target.value = previous.status;
        return;
      }
      showNotice('Status updated.', 'success');
      await refreshOrders();
    });

    ordersBody.addEventListener('click', async (event) => {
      const trackId = event.target.dataset.track;
      const deleteId = event.target.dataset.delete;
      if (trackId) {
        if (trackingBody) {
          await loadTrackingForOrder(Number(trackId));
        } else {
          navigateWithTransition(`orders-track.html?orderId=${Number(trackId)}`);
        }
        return;
      }
      if (deleteId) {
        const result = await window.db.deleteOrder(Number(deleteId));
        if (!result.ok) {
          showNotice(result.message, 'error');
          return;
        }
        showNotice('Order deleted.', 'success');
        await refreshOrders();
      }
    });
  }

  if (form && customerSelect && statusSelect) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formState = captureFormState(form);
      const payload = {
        customerId: Number(customerSelect.value),
        orderDate: qs('#orderDate')?.value,
        status: statusSelect.value,
        notes: qs('#orderNotes')?.value.trim() || '',
        items: draftItems.map((item) => ({
          productId: item.productId,
          qty: item.unit,
          unitPrice: item.unitPrice,
        })),
      };

      const result = await window.db.addOrder(payload);
      if (!result.ok) {
        restoreFormState(formState);
        showNotice(result.message, 'error');
        return;
      }

      draftItems = [];
      renderDraftItems();
      form.reset();
      statusSelect.value = 'Pending';
      showNotice('Order created.', 'success');
      if (ordersBody) await refreshOrders();
    });
  }

  await refreshLookups();
  if (form) renderDraftItems();
  if (ordersBody) await refreshOrders();
  if (trackingBody) {
    const params = new URLSearchParams(window.location.search);
    const orderId = Number(params.get('orderId'));
    if (orderId) {
      await loadTrackingForOrder(orderId);
    } else {
      renderTracking();
    }
  }
};

const ordersTrackPage = async () => {
  const orderSelect = qs('#trackOrderSelect');
  const loadButton = qs('#loadOrderTracking');
  const trackingBody = qs('#trackingTableBody');
  if (!orderSelect || !loadButton || !trackingBody) return;

  let allOrders = [];
  let trackingRows = [];
  let trackingPageNumber = 1;

  const renderTracking = () => {
    trackingBody.innerHTML = '';
    if (trackingRows.length === 0) {
      trackingBody.innerHTML =
        '<tr><td colspan="4" class="muted">No tracking logs for the selected order.</td></tr>';
      renderPagination({
        key: 'orders-track-table',
        anchorElement: trackingBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(trackingRows, trackingPageNumber);
    trackingPageNumber = safePage;
    pageRows.forEach((log) => {
      const before = log.before_json ? JSON.parse(log.before_json) : null;
      const after = log.after_json ? JSON.parse(log.after_json) : null;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${log.entity_id}</td>
        <td>${before?.status ?? '-'}</td>
        <td>${after?.status ?? '-'}</td>
        <td>${formatDate(log.created_at)}</td>
      `;
      trackingBody.appendChild(row);
    });
    trackingPageNumber = renderPagination({
      key: 'orders-track-table',
      anchorElement: trackingBody,
      totalItems: trackingRows.length,
      currentPage: trackingPageNumber,
      onPageChange: (page) => {
        trackingPageNumber = page;
        renderTracking();
      },
    });
  };

  const loadTracking = async () => {
    const orderId = Number(orderSelect.value);
    if (!orderId) {
      trackingRows = [];
      trackingPageNumber = 1;
      renderTracking();
      return;
    }
    trackingRows = await window.db.getOrderTracking(orderId);
    trackingPageNumber = 1;
    renderTracking();
  };

  allOrders = await window.db.getOrders();
  orderSelect.innerHTML = '<option value="">Select order</option>';
  allOrders.forEach((order) => {
    const option = document.createElement('option');
    option.value = String(order.id);
    option.textContent = `#${order.id} - ${order.customer_name} (${formatDate(order.order_date)})`;
    orderSelect.appendChild(option);
  });

  const params = new URLSearchParams(window.location.search);
  const preselectedOrderId = Number(params.get('orderId'));
  if (preselectedOrderId && allOrders.some((order) => order.id === preselectedOrderId)) {
    orderSelect.value = String(preselectedOrderId);
  }

  loadButton.addEventListener('click', loadTracking);
  orderSelect.addEventListener('change', loadTracking);

  await loadTracking();
};

const paymentsPage = async () => {
  const searchInput = qs('#paymentSearchOrderId');
  const searchButton = qs('#paymentSearchButton');
  const ordersBody = qs('#paymentOrdersBody');
  const paymentForm = qs('#paymentForm');
  const paymentHistoryBody = qs('#paymentHistoryBody');
  const orderIdField = qs('#paymentOrderId');
  const customerField = qs('#paymentCustomer');
  const totalField = qs('#paymentTotalAmount');
  const paidField = qs('#paymentPaidAmount');
  const pendingField = qs('#paymentPendingAmount');
  const amountField = qs('#paymentAmount');

  let selectedOrderId = null;
  let paymentOrders = [];
  let paymentOrdersPage = 1;
  let paymentHistoryRows = [];
  let paymentHistoryPage = 1;

  const clearPaymentDetails = () => {
    orderIdField.value = '';
    customerField.value = '';
    totalField.value = '';
    paidField.value = '';
    pendingField.value = '';
    amountField.value = '';
    paymentHistoryRows = [];
    paymentHistoryPage = 1;
    paymentHistoryBody.innerHTML =
      '<tr><td colspan="4" class="muted">Select an order to see payment history.</td></tr>';
    renderPagination({
      key: 'payment-history-table',
      anchorElement: paymentHistoryBody,
      totalItems: 0,
      currentPage: 1,
      onPageChange: () => {},
    });
  };

  const renderOrders = () => {
    ordersBody.innerHTML = '';
    if (paymentOrders.length === 0) {
      ordersBody.innerHTML = '<tr><td colspan="7" class="muted">No orders found.</td></tr>';
      renderPagination({
        key: 'payment-orders-table',
        anchorElement: ordersBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }

    const { pageRows, safePage } = paginateRows(paymentOrders, paymentOrdersPage);
    paymentOrdersPage = safePage;
    pageRows.forEach((order) => {
      const row = document.createElement('tr');
      row.dataset.orderId = String(order.id);
      row.className = 'payment-order-row';
      if (selectedOrderId === order.id) {
        row.classList.add('selected');
      }
      row.innerHTML = `
        <td>#${order.id}</td>
        <td>${order.customer_name}</td>
        <td>${formatDate(order.order_date)}</td>
        <td>${renderStatusBadge(order.status)}</td>
        <td>${formatMoney(order.total)}</td>
        <td>${formatMoney(order.paid_amount)}</td>
        <td>${formatMoney(order.pending_amount)}</td>
      `;
      ordersBody.appendChild(row);
    });
    paymentOrdersPage = renderPagination({
      key: 'payment-orders-table',
      anchorElement: ordersBody,
      totalItems: paymentOrders.length,
      currentPage: paymentOrdersPage,
      onPageChange: (page) => {
        paymentOrdersPage = page;
        renderOrders();
      },
    });
  };

  const renderPaymentHistory = () => {
    paymentHistoryBody.innerHTML = '';
    if (paymentHistoryRows.length === 0) {
      paymentHistoryBody.innerHTML =
        '<tr><td colspan="4" class="muted">No payments recorded for this order.</td></tr>';
      renderPagination({
        key: 'payment-history-table',
        anchorElement: paymentHistoryBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(paymentHistoryRows, paymentHistoryPage);
    paymentHistoryPage = safePage;
    pageRows.forEach((payment) => {
      const row = document.createElement('tr');
      row.innerHTML = `
          <td>${payment.id}</td>
          <td>#${payment.order_id}</td>
          <td>${formatMoney(payment.amount)}</td>
          <td>${formatDate(payment.created_at)}</td>
        `;
      paymentHistoryBody.appendChild(row);
    });
    paymentHistoryPage = renderPagination({
      key: 'payment-history-table',
      anchorElement: paymentHistoryBody,
      totalItems: paymentHistoryRows.length,
      currentPage: paymentHistoryPage,
      onPageChange: (page) => {
        paymentHistoryPage = page;
        renderPaymentHistory();
      },
    });
  };

  const refreshOrders = async () => {
    paymentOrders = await window.db.getPaymentOrders({
      searchOrderId: searchInput.value.trim(),
    });
    paymentOrdersPage = 1;
    renderOrders();
  };

  const loadOrderDetails = async (orderId) => {
    const summary = await window.db.getOrderPaymentSummary(orderId);
    if (!summary) {
      clearPaymentDetails();
      showNotice('Order not found for payment.', 'error');
      return;
    }

    selectedOrderId = Number(summary.id);
    orderIdField.value = String(summary.id);
    customerField.value = summary.customer_name || '';
    totalField.value = String(Number(summary.total ?? 0));
    paidField.value = String(Number(summary.paid_amount ?? 0));
    pendingField.value = String(Number(summary.pending_amount ?? 0));
    amountField.value = '';

    paymentHistoryRows = await window.db.getPaymentsByOrder(orderId);
    paymentHistoryPage = 1;
    renderPaymentHistory();

    renderOrders();
  };

  const runPaymentSearch = async () => {
    selectedOrderId = null;
    clearPaymentDetails();
    await refreshOrders();
  };

  searchButton?.addEventListener('click', async () => {
    await runPaymentSearch();
  });

  searchInput?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await runPaymentSearch();
  });

  ordersBody.addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-order-id]');
    if (!row) return;
    await loadOrderDetails(Number(row.dataset.orderId));
  });

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedOrderId) {
      showNotice('Select an order first.', 'error');
      return;
    }

    const amount = Number(amountField.value || 0);
    if (amount <= 0) {
      showNotice('Enter valid payment amount.', 'error');
      return;
    }

    const result = await window.db.addPayment({
      orderId: selectedOrderId,
      amount,
    });

    if (!result.ok) {
      showNotice(result.message || 'Failed to add payment.', 'error');
      return;
    }

    showNotice('Payment added successfully.', 'success');
    await refreshOrders();
    await loadOrderDetails(selectedOrderId);
  });

  clearPaymentDetails();
  await refreshOrders();
};

const reportsPage = async () => {
  const reportBody = qs('#reportTableBody');
  const auditBody = qs('#auditTableBody');
  const statusFilter = qs('#reportStatus');
  const customerFilter = qs('#reportCustomer');
  const productFilter = qs('#reportProduct');
  const fromFilter = qs('#reportFrom');
  const toFilter = qs('#reportTo');
  const orderIdFilter = qs('#reportOrderId');
  const printBtn = qs('#printReport');
  const exportExcelBtn = qs('#exportExcel');
  const exportPdfBtn = qs('#exportPdf');

  const [customers, products] = await Promise.all([
    window.db.getCustomers({ includeInactive: true }),
    window.db.getProducts({ includeInactive: true }),
  ]);

  customerFilter.innerHTML = '<option value="">All customers</option>';
  customers.forEach((customer) => {
    const option = document.createElement('option');
    option.value = customer.id;
    option.textContent = customer.name;
    customerFilter.appendChild(option);
  });

  productFilter.innerHTML = '<option value="">All products</option>';
  products.forEach((product) => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = product.name;
    productFilter.appendChild(option);
  });

  const buildFilters = () => ({
    status: statusFilter.value || '',
    customerId: customerFilter.value || '',
    productId: productFilter.value || '',
    dateFrom: fromFilter.value || '',
    dateTo: toFilter.value || '',
    orderId: orderIdFilter.value || '',
  });

  let reportRows = [];
  let reportPage = 1;
  let auditPage = 1;

  const buildFallbackReport = async (filters) => {
    const orders = await window.db.getOrders();
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const productMap = new Map(products.map((p) => [p.id, p]));
    const rows = [];

    for (const order of orders) {
      if (filters.status && order.status !== filters.status) continue;
      if (filters.customerId && order.customer_id !== Number(filters.customerId)) continue;
      if (filters.dateFrom && order.order_date < filters.dateFrom) continue;
      if (filters.dateTo && order.order_date > filters.dateTo) continue;
      if (filters.orderId && order.id !== Number(filters.orderId)) continue;

      const items = await window.db.getOrderItems(order.id);
      for (const item of items) {
        if (filters.productId && item.product_id !== Number(filters.productId)) continue;
        const customer = customerMap.get(order.customer_id) || {};
        const product = productMap.get(item.product_id) || {};
        rows.push({
          order_id: order.id,
          order_date: order.order_date,
          status: order.status,
          order_total: order.total,
          notes: order.notes,
          customer_id: order.customer_id,
          customer_name: customer.name || '',
          phone: customer.phone || '',
          email: customer.email || '',
          gst_number: customer.gst_number || '',
          address: customer.address || '',
          product_id: item.product_id,
          product_name: item.product_name || product.name || '',
          sku: product.sku || '',
          unit_type: item.unit_type || product.unit_type || 'meter',
          qty: item.qty,
          unit_price: item.unit_price,
          line_total: item.line_total,
        });
      }
    }
    return rows;
  };

  const renderReportRows = () => {
    reportBody.innerHTML = '';
    if (reportRows.length === 0) {
      reportBody.innerHTML =
        '<tr><td colspan="15" class="muted">No records for selected filters.</td></tr>';
      renderPagination({
        key: 'report-table',
        anchorElement: reportBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const { pageRows, safePage } = paginateRows(reportRows, reportPage);
    reportPage = safePage;
    pageRows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${row.order_id}</td>
        <td>${formatDate(row.order_date)}</td>
        <td>${renderStatusBadge(row.status)}</td>
        <td>${row.customer_name}</td>
        <td>${row.phone || '-'}</td>
        <td>${row.email || '-'}</td>
        <td>${row.gst_number || '-'}</td>
        <td>${row.address || '-'}</td>
        <td>${row.product_name}</td>
        <td>${row.sku}</td>
        <td>${row.qty} ${row.unit_type || 'meter'}</td>
        <td>${row.unit_type || 'meter'}</td>
        <td>${formatMoney(row.unit_price)}</td>
        <td>${formatMoney(row.line_total)}</td>
        <td>${formatMoney(row.order_total)}</td>
      `;
      reportBody.appendChild(tr);
    });
    reportPage = renderPagination({
      key: 'report-table',
      anchorElement: reportBody,
      totalItems: reportRows.length,
      currentPage: reportPage,
      onPageChange: (page) => {
        reportPage = page;
        renderReportRows();
      },
    });
  };

  const renderReport = async () => {
    try {
      if (window.db.getOrderReport) {
        reportRows = await window.db.getOrderReport(buildFilters());
      } else {
        reportRows = await buildFallbackReport(buildFilters());
      }
    } catch (error) {
      reportRows = await buildFallbackReport(buildFilters());
    }
    reportPage = 1;
    renderReportRows();
  };

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const buildPdfReportHtml = (rows) => {
    const filters = buildFilters();
    const selectedCustomer = customerFilter?.selectedOptions?.[0]?.textContent || 'All customers';
    const selectedProduct = productFilter?.selectedOptions?.[0]?.textContent || 'All products';
    const selectedStatus = statusFilter?.value || 'All';
    const from = filters.dateFrom || '-';
    const to = filters.dateTo || '-';
    const orderId = filters.orderId || '-';
    const generatedAt = new Date().toLocaleString();

    const tableRows = rows
      .map(
        (row) => `
          <tr>
            <td>#${escapeHtml(row.order_id)}</td>
            <td>${escapeHtml(formatDate(row.order_date))}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.customer_name || '-')}</td>
            <td>${escapeHtml(row.phone || '-')}</td>
            <td>${escapeHtml(row.email || '-')}</td>
            <td>${escapeHtml(row.gst_number || '-')}</td>
            <td>${escapeHtml(row.address || '-')}</td>
            <td>${escapeHtml(row.product_name || '-')}</td>
            <td>${escapeHtml(row.sku || '-')}</td>
            <td>${escapeHtml(`${row.qty ?? 0} ${row.unit_type || 'meter'}`)}</td>
            <td>${escapeHtml(row.unit_type || 'meter')}</td>
            <td>${escapeHtml(formatMoney(row.unit_price))}</td>
            <td>${escapeHtml(formatMoney(row.line_total))}</td>
            <td>${escapeHtml(formatMoney(row.order_total))}</td>
          </tr>
        `
      )
      .join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Order Report</title>
    <style>
      @page {
        size: A4;
        margin: 12mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        color: #111827;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 18px;
      }
      .meta {
        margin-bottom: 10px;
        line-height: 1.5;
      }
      .meta strong {
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #d1d5db;
        padding: 5px;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background: #f3f4f6;
        font-size: 9px;
      }
      tbody tr:nth-child(even) {
        background: #fafafa;
      }
    </style>
  </head>
  <body>
    <h1>Order Report</h1>
    <div class="meta">
      <div><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
      <div><strong>Total Rows:</strong> ${escapeHtml(rows.length)}</div>
      <div><strong>Status:</strong> ${escapeHtml(selectedStatus)} | <strong>Customer:</strong> ${escapeHtml(selectedCustomer)} | <strong>Product:</strong> ${escapeHtml(selectedProduct)}</div>
      <div><strong>Date Range:</strong> ${escapeHtml(from)} to ${escapeHtml(to)} | <strong>Order ID:</strong> ${escapeHtml(orderId)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Status</th>
          <th>Customer</th>
          <th>Phone</th>
          <th>Email</th>
          <th>GST Number</th>
          <th>Address</th>
          <th>Product</th>
          <th>SKU</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Unit Price</th>
          <th>Line Total</th>
          <th>Order Total</th>
        </tr>
      </thead>
      <tbody>${tableRows || '<tr><td colspan="15">No records for selected filters.</td></tr>'}</tbody>
    </table>
  </body>
</html>`;
  };

  const refreshAudit = async () => {
    const logs = await window.db.getAuditLogs();
    auditBody.innerHTML = '';
    if (logs.length === 0) {
      auditBody.innerHTML = '<tr><td colspan="6" class="muted">No logs yet.</td></tr>';
      renderPagination({
        key: 'audit-table',
        anchorElement: auditBody,
        totalItems: 0,
        currentPage: 1,
        onPageChange: () => {},
      });
      return;
    }
    const renderAuditRows = () => {
      auditBody.innerHTML = '';
      const { pageRows, safePage } = paginateRows(logs, auditPage);
      auditPage = safePage;
      pageRows.forEach((log) => {
        const before = log.before_json ? JSON.parse(log.before_json) : null;
        const after = log.after_json ? JSON.parse(log.after_json) : null;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${log.id}</td>
          <td>${log.action_type}</td>
          <td>${log.entity}</td>
          <td>${log.entity_id ?? '-'}</td>
          <td class="muted">${before ? JSON.stringify(before) : '-'}</td>
          <td class="muted">${after ? JSON.stringify(after) : '-'}</td>
        `;
        auditBody.appendChild(row);
      });
      auditPage = renderPagination({
        key: 'audit-table',
        anchorElement: auditBody,
        totalItems: logs.length,
        currentPage: auditPage,
        onPageChange: (page) => {
          auditPage = page;
          renderAuditRows();
        },
      });
    };
    auditPage = 1;
    renderAuditRows();
  };

  [statusFilter, customerFilter, productFilter, fromFilter, toFilter, orderIdFilter].forEach(
    (element) => {
      element.addEventListener('change', renderReport);
      element.addEventListener('keyup', renderReport);
    }
  );

  printBtn.addEventListener('click', async () => {
    const printHtml = buildPdfReportHtml(reportRows);
    const result = window.db.printHtml
      ? await window.db.printHtml({ html: printHtml })
      : await window.db.print();
    if (!result.ok) showNotice(result.message || 'Print failed.', 'error');
  });

  exportExcelBtn.addEventListener('click', async () => {
    if (!window.db.saveExcel) {
      showNotice('Excel export is not available in this app build.', 'error');
      return;
    }
    const filters = buildFilters();
    const result = await window.db.saveExcel({
      suggestedName: `order-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
      meta: {
        generatedAt: new Date().toLocaleString(),
        totalRows: reportRows.length,
        status: statusFilter?.value || 'All',
        customer: customerFilter?.selectedOptions?.[0]?.textContent || 'All customers',
        product: productFilter?.selectedOptions?.[0]?.textContent || 'All products',
        dateRange: `${filters.dateFrom || '-'} to ${filters.dateTo || '-'}`,
        orderId: filters.orderId || '-',
      },
      rows: reportRows.map((row) => ({
        order_id: row.order_id,
        order_date: formatDate(row.order_date),
        status: row.status,
        customer_name: row.customer_name || '-',
        phone: row.phone || '-',
        email: row.email || '-',
        gst_number: row.gst_number || '-',
        address: row.address || '-',
        product_name: row.product_name || '-',
        sku: row.sku || '-',
        qty: `${row.qty ?? 0} ${row.unit_type || 'meter'}`,
        unit_type: row.unit_type || 'meter',
        unit_price: row.unit_price ?? 0,
        line_total: row.line_total ?? 0,
        order_total: row.order_total ?? 0,
      })),
    });
    if (!result.ok) {
      showNotice(result.message || 'Excel export canceled or failed.', 'error');
      return;
    }
    showNotice(`Excel exported successfully: ${result.path || ''}`, 'success');
  });

  exportPdfBtn.addEventListener('click', async () => {
    const pdfHtml = buildPdfReportHtml(reportRows);
    const result = window.db.savePdfFromHtml
      ? await window.db.savePdfFromHtml({
          suggestedName: `order-report-${new Date().toISOString().slice(0, 10)}.pdf`,
          html: pdfHtml,
        })
      : await window.db.savePdf({
          suggestedName: `order-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        });
    if (!result.ok) {
      showNotice(result.message || 'PDF export canceled or failed.', 'error');
      return;
    }
    showNotice('PDF exported successfully.', 'success');
  });

  await renderReport();
  await refreshAudit();
};

const init = () => {
  initPageTransitions();
  renderSharedSidebar();
  applyOfflineMaterialIcons();
  initTheme();
  initSidebar();
  setActiveNav();
  const page = document.body.dataset.page;
  if (page === 'dashboard') dashboardPage();
  if (page === 'products' || page === 'products-list' || page === 'products-add') productsPage();
  if (page === 'customers' || page === 'customers-add' || page === 'customers-list') customersPage();
  if (page === 'orders' || page === 'orders-create' || page === 'orders-track') ordersPage();
  if (page === 'payments') paymentsPage();
  if (page === 'settings') settingsPage();
  if (page === 'reports') reportsPage();
  if (page === 'customer-details') customerDetailsPage();
};

document.addEventListener('DOMContentLoaded', init);







