/**
 * orders.js
 * ──────────────────────────────────────────────────────────────
 * Customer Orders CRUD:
 *  • Load & render orders table
 *  • Search + status filter
 *  • Create / Edit / Delete orders via popup modal
 *  • Auto-calc total_amount = quantity × unit_price
 *  • Validation: required fields show "Please fill the field"
 * ──────────────────────────────────────────────────────────────
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── State ─────────────────────────────────────────────────── */
  let allOrders = [];
  let editId    = null;

  /* ── DOM refs ──────────────────────────────────────────────── */
  const tbody        = document.getElementById('ordersBody');
  const countLabel   = document.getElementById('orderCountLabel');
  const searchInput  = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const overlay      = document.getElementById('orderOverlay');
  const modalTitle   = document.getElementById('modalTitle');

  /* ── Load orders ────────────────────────────────────────────── */
  async function loadOrders() {
    try {
      const res = await fetch('/api/orders');
      allOrders = await res.json();
      render();
    } catch {
      tbody.innerHTML = `<tr><td colspan="11" class="td-empty" style="color:var(--danger)">Failed to load orders.</td></tr>`;
    }
  }

  /* ── Render table ───────────────────────────────────────────── */
  function render() {
    const q   = searchInput.value.trim().toLowerCase();
    const st  = statusFilter.value;
    const rows = allOrders.filter(o => {
      const match = !q || Object.values(o).some(v => String(v).toLowerCase().includes(q));
      const stat  = !st || o.status === st;
      return match && stat;
    });

    countLabel.textContent = `${rows.length} order${rows.length !== 1 ? 's' : ''}`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="td-empty">No orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(o => `
      <tr>
        <td>${o.id}</td>
        <td>${esc(o.first_name)} ${esc(o.last_name)}</td>
        <td>${esc(o.email)}</td>
        <td>${esc(o.product)}</td>
        <td>${o.quantity}</td>
        <td>$${(+o.unit_price).toFixed(2)}</td>
        <td><strong>$${(+o.total_amount).toFixed(2)}</strong></td>
        <td><span class="badge ${badgeCls(o.status)}">${o.status}</span></td>
        <td>${esc(o.created_by)}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td>
          <div class="row-actions">
            <button class="tbl-btn" onclick="editOrder(${o.id})">Edit</button>
            <button class="tbl-btn danger" onclick="deleteOrder(${o.id})">Delete</button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* ── Search / filter ────────────────────────────────────────── */
  searchInput.addEventListener('input', render);
  statusFilter.addEventListener('change', render);

  /* ── New order ──────────────────────────────────────────────── */
  document.getElementById('newOrderBtn').addEventListener('click', () => {
    editId = null;
    modalTitle.textContent = 'New Order';
    document.getElementById('orderForm').reset();
    document.getElementById('fOrderId').value = '';
    document.getElementById('fQty').value = 1;
    clearErrors();
    overlay.hidden = false;
  });

  /* ── Edit order ─────────────────────────────────────────────── */
  window.editOrder = async id => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      const o   = await res.json();
      editId = id;
      modalTitle.textContent = 'Edit Order';

      setVal('fOrderId',  o.id);
      setVal('fFirstName',o.first_name);
      setVal('fLastName', o.last_name);
      setVal('fEmail',    o.email);
      setVal('fPhone',    o.phone);
      setVal('fStreet',   o.street || '');
      setVal('fCity',     o.city   || '');
      setVal('fState',    o.state  || '');
      setVal('fPostal',   o.postal_code || '');
      setSel('fCountry',  o.country);
      setSel('fProduct',  o.product);
      setVal('fQty',      o.quantity);
      setVal('fUnitPrice',parseFloat(o.unit_price).toFixed(2));
      setVal('fTotal',    parseFloat(o.total_amount).toFixed(2));
      setSel('fStatus',   o.status);
      setSel('fCreatedBy',o.created_by);

      clearErrors();
      overlay.hidden = false;
    } catch {
      showToast('Could not load order', 'error');
    }
  };

  /* ── Delete order ───────────────────────────────────────────── */
  window.deleteOrder = async id => {
    const ok = await confirmDialog('Delete this order? This action cannot be undone.');
    if (!ok) return;
    try {
      await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      showToast('Order deleted');
      loadOrders();
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  /* ── Close modal ────────────────────────────────────────────── */
  ['closeModalBtn','cancelModalBtn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', closeModal);
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  function closeModal() { overlay.hidden = true; }

  /* ── Auto-calc total ────────────────────────────────────────── */
  ['fQty','fUnitPrice'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcTotal);
  });
  function calcTotal() {
    const qty   = parseFloat(document.getElementById('fQty')?.value)       || 0;
    const price = parseFloat(document.getElementById('fUnitPrice')?.value) || 0;
    document.getElementById('fTotal').value = (qty * price).toFixed(2);
  }

  /* ── Save order ─────────────────────────────────────────────── */
  document.getElementById('saveOrderBtn').addEventListener('click', async () => {
    if (!validate()) return;

    const payload = {
      first_name:  gv('fFirstName'),
      last_name:   gv('fLastName'),
      email:       gv('fEmail'),
      phone:       gv('fPhone'),
      street:      gv('fStreet'),
      city:        gv('fCity'),
      state:       gv('fState'),
      postal_code: gv('fPostal'),
      country:     gv('fCountry'),
      product:     gv('fProduct'),
      quantity:    parseInt(gv('fQty')),
      unit_price:  parseFloat(gv('fUnitPrice')),
      status:      gv('fStatus'),
      created_by:  gv('fCreatedBy'),
    };

    try {
      const url    = editId ? `/api/orders/${editId}` : '/api/orders';
      const method = editId ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || data.id) {
        showToast(editId ? 'Order updated ✓' : 'Order created ✓', 'success');
        closeModal();
        loadOrders();
      } else {
        showToast('Save failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  });

  /* ── Validation ─────────────────────────────────────────────── */
  function validate() {
    clearErrors();
    let ok = true;
    [
      { id: 'fFirstName', label: 'First Name' },
      { id: 'fLastName',  label: 'Last Name'  },
      { id: 'fEmail',     label: 'Email'      },
      { id: 'fPhone',     label: 'Phone'      },
    ].forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el?.value.trim()) {
        setErr(el, 'Please fill the field');
        ok = false;
      }
    });
    const qty = parseInt(document.getElementById('fQty')?.value);
    if (!qty || qty < 1) {
      setErr(document.getElementById('fQty'), 'Minimum quantity is 1');
      ok = false;
    }
    return ok;
  }

  function setErr(el, msg) {
    if (!el) return;
    el.classList.add('has-error');
    const span = el.closest('.form-field')?.querySelector('.field-err');
    if (span) span.textContent = msg;
  }
  function clearErrors() {
    document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelectorAll('.field-err').forEach(el => { el.textContent = ''; });
  }

  /* ── Utilities ──────────────────────────────────────────────── */
  function gv(id)       { return document.getElementById(id)?.value.trim() || ''; }
  function setVal(id,v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
  function setSel(id,v) {
    const el = document.getElementById(id);
    if (!el) return;
    [...el.options].forEach(o => { o.selected = o.value === v || o.textContent === v; });
  }

  function badgeCls(s) {
    if (s === 'Pending')     return 'badge-pending';
    if (s === 'In progress') return 'badge-progress';
    if (s === 'Completed')   return 'badge-done';
    return '';
  }
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  }
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Init ───────────────────────────────────────────────────── */
  loadOrders();
});
