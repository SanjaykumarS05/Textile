export const renderSharedSidebar = () => {
  const sidebarRoot = document.querySelector('[data-sidebar-root]');
  if (!sidebarRoot) return;

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="brand">TEXTILE ERP</div>
      <button class="menu-toggle menu" type="button" data-sidebar-toggle>
        <span class="material-symbols-outlined">menu</span>
      </button>
    </div>
    <nav class="nav">
      <a class="nav-link" href="dashboard.html" data-nav="dashboard">
        <span class="material-symbols-outlined">dashboard</span>
        <span class="nav-label">Dashboard</span>
      </a>
      <div class="nav-group nav-group-orders">
        <button class="nav-link nav-parent" type="button" data-orders-toggle data-nav="orders">
          <span class="material-symbols-outlined">shopping_cart</span>
          <span class="nav-label">Orders</span>
          <span class="material-symbols-outlined nav-caret">expand_more</span>
        </button>
        <div class="nav-sublinks">
          <a class="nav-link nav-sublink" href="orders.html" data-nav="orders-create">
            <span class="material-symbols-outlined">edit_note</span>
            <span class="nav-label">Create Order</span>
          </a>
          <a class="nav-link nav-sublink" href="orders-track.html" data-nav="orders-track">
            <span class="material-symbols-outlined">local_shipping</span>
            <span class="nav-label">Order List & Track</span>
          </a>
        </div>
      </div>
      <div class="nav-group nav-group-products">
        <button class="nav-link nav-parent" type="button" data-products-toggle data-nav="products">
          <span class="material-symbols-outlined">inventory_2</span>
          <span class="nav-label">Products</span>
          <span class="material-symbols-outlined nav-caret">expand_more</span>
        </button>
        <div class="nav-sublinks">
          <a class="nav-link nav-sublink" href="products-add.html" data-nav="products-add">
            <span class="material-symbols-outlined">add_box</span>
            <span class="nav-label">Add Product</span>
          </a>
          <a class="nav-link nav-sublink" href="products.html" data-nav="products-list">
            <span class="material-symbols-outlined">view_kanban</span>
            <span class="nav-label">Product List</span>
          </a>
        </div>
      </div>
      <div class="nav-group nav-group-customers">
        <button class="nav-link nav-parent" type="button" data-customers-toggle data-nav="customers">
          <span class="material-symbols-outlined">person</span>
          <span class="nav-label">Customers</span>
          <span class="material-symbols-outlined nav-caret">expand_more</span>
        </button>
        <div class="nav-sublinks">
          <a class="nav-link nav-sublink" href="customers-add.html" data-nav="customers-add">
            <span class="material-symbols-outlined">person_add</span>
            <span class="nav-label">Add Customer</span>
          </a>
          <a class="nav-link nav-sublink" href="customers-list.html" data-nav="customers-list">
            <span class="material-symbols-outlined">group</span>
            <span class="nav-label">Customer List</span>
          </a>
        </div>
      </div>
      <a class="nav-link" href="reports.html" data-nav="reports">
        <span class="material-symbols-outlined">bar_chart</span>
        <span class="nav-label">Reports</span>
      </a>
      <a class="nav-link" href="payment.html" data-nav="payments">
        <span class="material-symbols-outlined">payment</span>
        <span class="nav-label">Payment</span>
      </a>
      <a class="nav-link" href="settings.html" data-nav="settings">
        <span class="material-symbols-outlined">settings</span>
        <span class="nav-label">Settings</span>
      </a>
    </nav>
    <div class="sidebar-footer">
      <a class="nav-link" href="index.html" style="color:red;">
        <span class="material-symbols-outlined">logout</span>
        <span class="nav-label">Logout</span>
      </a>
    </div>
  `;
  sidebarRoot.replaceWith(sidebar);
};
