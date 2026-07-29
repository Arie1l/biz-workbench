/**
 * 商务专员工作台 - 主应用逻辑
 */
(function() {
  'use strict';

  // ========== 工具函数 ==========
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

  function fmtMoney(n) {
    return '\u00a5' + Number(n || 0).toLocaleString('zh-CN');
  }

  function fmtDate(d) {
    if (!d) return '-';
    return d;
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function todayDisplay() {
    const d = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
  }

  function showToast(msg, type = '') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = `<span>\u2713</span> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ========== 导航 ==========
  const pages = ['dashboard', 'tasks', 'orders', 'report'];
  let currentPage = 'dashboard';

  function navigate(page) {
    currentPage = page;
    // 隐藏订单详情页
    const detailPage = $('#page-order-detail');
    if (detailPage) detailPage.classList.remove('active');
    // 重置所有页面的 display 样式并切换 active 类
    pages.forEach(p => {
      const el = $(`#page-${p}`);
      el.style.display = '';
      el.classList.toggle('active', p === page);
    });
    $$('.nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    const titles = {
      dashboard: '\u5de5\u4f5c\u53f0\u9996\u9875',
      tasks: '\u6bcf\u65e5\u5de5\u4f5c\u4efb\u52a1',
      orders: '\u8ba2\u5355\u7ba1\u7406',
      report: '\u6708\u62a5\u603b\u7ed3'
    };
    $('#topbar-title').textContent = titles[page] || '';

    // 渲染对应页面
    if (page === 'dashboard') renderDashboard();
    if (page === 'tasks') renderTasks();
    if (page === 'orders') renderOrders();
    if (page === 'report') renderReport();
  }

  // ========== 首页 Dashboard ==========
  function renderDashboard() {
    const orders = Store.getOrders();
    const todayTasks = Store.getTasksByDate(todayStr());
    const pendingTasks = todayTasks.filter(t => !t.completed);

    // 统计
    const inReview = orders.filter(o => Store.getOrderPhase(o) === '\u524d\u671f\u8bc4\u5ba1\u73af\u8282').length;
    const inOrder = orders.filter(o => Store.getOrderPhase(o) === '\u4e0b\u5355\u73af\u8282').length;
    const inShipping = orders.filter(o => Store.getOrderPhase(o) === '\u53d1\u8d27\u73af\u8282').length;
    const completed = orders.filter(o => Store.getOrderPhase(o) === '\u5df2\u5b8c\u6210').length;

    $('#dash-total-orders').textContent = orders.length;
    $('#dash-in-progress').textContent = inReview + inOrder + inShipping;
    $('#dash-today-tasks').textContent = pendingTasks.length;
    $('#dash-completed-orders').textContent = completed;

    // 今日任务
    const taskList = $('#dash-tasks');
    if (todayTasks.length === 0) {
      taskList.innerHTML = '<div class="empty-state"><div class="icon">\u2705</div><div class="text">\u4eca\u65e5\u6682\u65e0\u4efb\u52a1</div></div>';
    } else {
      taskList.innerHTML = todayTasks.slice(0, 6).map(t => `
        <div class="task-item ${t.completed ? 'completed' : ''}">
          <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="App.toggleTask('${t.id}')">${t.completed ? '\u2713' : ''}</div>
          <div class="task-content">
            <div class="task-title">${escapeHtml(t.title)}</div>
            ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
            <div class="task-meta">
              <span class="tag ${priorityTag(t.priority)}">${priorityLabel(t.priority)}</span>
              ${t.relatedOrder ? `<span class="tag tag-gray">\u5173\u8054\u8ba2\u5355</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }

    // 订单概览
    const orderList = $('#dash-orders');
    const activeOrders = orders.filter(o => Store.getOrderPhase(o) !== '\u5df2\u5b8c\u6210').slice(0, 5);
    if (activeOrders.length === 0) {
      orderList.innerHTML = '<div class="empty-state"><div class="text">\u6682\u65e0\u8fdb\u884c\u4e2d\u7684\u8ba2\u5355</div></div>';
    } else {
      orderList.innerHTML = activeOrders.map(o => {
        const progress = Store.getOrderProgress(o);
        const phase = Store.getOrderPhase(o);
        return `
          <div class="task-item" style="cursor:pointer" onclick="App.viewOrder('${o.id}')">
            <div class="task-content">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="task-title">${escapeHtml(o.projectName)}</span>
                <span class="tag ${phaseTag(phase)}">${phaseShort(phase)}</span>
              </div>
              <div class="task-desc" style="margin-top:4px">
                ${o.orderNumber} | ${escapeHtml(o.salesperson)} | ${escapeHtml(o.customer)}
              </div>
              <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
                <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${progress}%"></div></div>
                <span style="font-size:12px;color:var(--gray-500);min-width:36px">${progress}%</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 更新侧边栏徽章
    updateBadges();
  }

  // ========== 每日任务 ==========
  let taskFilterDate = null;

  function renderTasks() {
    const date = taskFilterDate || todayStr();
    $('#task-date-input').value = date;
    const tasks = Store.getTasksByDate(date);
    const pending = tasks.filter(t => !t.completed);
    const done = tasks.filter(t => t.completed);

    const list = $('#task-list');
    if (tasks.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">\u2705</div><div class="text">\u8be5\u65e5\u671f\u6682\u65e0\u4efb\u52a1\uff0c\u70b9\u51fb\u53f3\u4e0a\u89d2\u6dfb\u52a0\u4efb\u52a1</div></div>';
    } else {
      const html = [
        ...pending.map(t => taskItemHtml(t)),
        ...done.map(t => taskItemHtml(t))
      ].join('');
      list.innerHTML = html;
    }

    // 统计
    $('#task-count-pending').textContent = pending.length;
    $('#task-count-done').textContent = done.length;
    $('#task-count-total').textContent = tasks.length;
    updateBadges();
  }

  function taskItemHtml(t) {
    const order = t.relatedOrder ? Store.getOrder(t.relatedOrder) : null;
    return `
      <div class="task-item ${t.completed ? 'completed' : ''}">
        <div class="task-checkbox ${t.completed ? 'checked' : ''}" onclick="App.toggleTask('${t.id}')">${t.completed ? '\u2713' : ''}</div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(t.title)}</div>
          ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
          <div class="task-meta">
            <span class="tag ${priorityTag(t.priority)}">${priorityLabel(t.priority)}</span>
            ${t.salesperson ? `<span class="tag tag-purple">\u{1F464} ${escapeHtml(t.salesperson)}</span>` : ''}
            ${order ? `<span class="tag tag-blue" style="cursor:pointer" onclick="App.viewOrder('${order.id}');event.stopPropagation()">${order.orderNumber}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-icon" title="\u7f16\u8f91" onclick="App.editTask('${t.id}')">\u270e</button>
          <button class="btn-icon" title="\u5220\u9664" onclick="App.deleteTask('${t.id}')">\u2717</button>
        </div>
      </div>
    `;
  }

  // ========== 订单管理 ==========
  let orderFilter = { salesperson: '', keyword: '', phase: '' };

  function renderOrders() {
    const orders = Store.getOrders();
    const salespersons = Store.getSalespersons();

    // 填充销售员筛选
    const spSelect = $('#order-filter-sp');
    spSelect.innerHTML = '<option value="">\u5168\u90e8\u9500\u552e\u5458</option>' +
      salespersons.map(s => `<option value="${escapeAttr(s)}" ${orderFilter.salesperson === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');

    // 筛选
    let filtered = orders;
    if (orderFilter.salesperson) {
      filtered = filtered.filter(o => o.salesperson === orderFilter.salesperson);
    }
    if (orderFilter.phase) {
      filtered = filtered.filter(o => Store.getOrderPhase(o) === orderFilter.phase);
    }
    if (orderFilter.keyword) {
      const kw = orderFilter.keyword.toLowerCase();
      filtered = filtered.filter(o =>
        o.orderNumber.toLowerCase().includes(kw) ||
        o.projectName.toLowerCase().includes(kw) ||
        o.customer.toLowerCase().includes(kw)
      );
    }

    // 渲染表格
    const tbody = $('#order-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-400)">\u672a\u627e\u5230\u5339\u914d\u7684\u8ba2\u5355</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(o => {
        const phase = Store.getOrderPhase(o);
        const progress = Store.getOrderProgress(o);
        const currentStep = getCurrentStepName(o);
        return `
          <tr onclick="App.viewOrder('${o.id}')">
            <td data-label="\u8ba2\u5355\u53f7"><strong>${escapeHtml(o.orderNumber)}</strong></td>
            <td data-label="\u9879\u76ee\u540d\u79f0">${escapeHtml(o.projectName)}</td>
            <td data-label="\u5ba2\u6237">${escapeHtml(o.customer)}</td>
            <td data-label="\u9500\u552e\u5458">${escapeHtml(o.salesperson)}</td>
            <td data-label="\u5f53\u524d\u9636\u6bb5">
              <span class="tag ${phaseTag(phase)}">${phaseShort(phase)}</span>
              <div style="font-size:11px;color:var(--gray-400);margin-top:4px">${escapeHtml(currentStep)}</div>
            </td>
            <td data-label="\u8fdb\u5ea6">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${progress}%"></div></div>
                <span style="font-size:12px">${progress}%</span>
              </div>
            </td>
            <td data-label="\u5408\u540c\u91d1\u989d" style="text-align:right">${fmtMoney(o.contractAmount)}</td>
          </tr>
        `;
      }).join('');
    }

    $('#order-count').textContent = filtered.length;
    updateBadges();
  }

  function getCurrentStepName(order) {
    const steps = ALL_STEPS;
    for (let s of steps) {
      const st = order.steps[s.key];
      if (st.status === 'current') return '\u2192 ' + s.name;
    }
    const allDone = steps.every(s => order.steps[s.key].status === 'completed' || order.steps[s.key].status === 'skipped');
    if (allDone) return '\u2705 \u5df2\u5b8c\u6210';
    return '-';
  }

  // ========== 订单详情 ==========
  let currentOrderId = null;

  function viewOrder(id) {
    currentOrderId = id;
    const order = Store.getOrder(id);
    if (!order) return;

    const phase = Store.getOrderPhase(order);
    const progress = Store.getOrderProgress(order);

    $('#detail-order-number').textContent = order.orderNumber;
    $('#detail-project-name').textContent = order.projectName;
    $('#detail-customer').textContent = order.customer;
    $('#detail-salesperson').textContent = order.salesperson;
    $('#detail-proposal-number').textContent = order.proposalNumber || '-';
    $('#detail-amount').textContent = fmtMoney(order.contractAmount);
    $('#detail-created').textContent = fmtDate(order.createdAt);
    $('#detail-phase').innerHTML = `<span class="tag ${phaseTag(phase)}">${phase}</span>`;
    $('#detail-progress').innerHTML = `<div style="display:flex;align-items:center;gap:8px"><div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${progress}%"></div></div><span style="font-size:13px;font-weight:600">${progress}%</span></div>`;
    $('#detail-remark').textContent = order.remark || '\u65e0';

    // 渲染流程
    const flowEl = $('#detail-workflow');
    flowEl.innerHTML = WORKFLOW.phases.map((p, pi) => {
      const stepsHtml = p.steps.map(s => {
        const st = order.steps[s.key] || { status: 'pending', date: '', note: '' };
        const statusClass = st.status;
        const optionalTag = s.required ? '' : '<span class="step-optional-tag">\u53ef\u9009</span>';
        const dateStr = st.date ? `\u00b7 ${st.date}` : '';
        const noteStr = st.note ? `<div class="step-note">${escapeHtml(st.note)}</div>` : '';
        const actionBtn = st.status === 'pending' || st.status === 'current'
          ? `<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.openStepModal('${s.key}')">\u66f4\u65b0</button>`
          : (st.status === 'completed'
            ? `<button class="btn btn-sm btn-ghost" style="margin-left:auto" onclick="App.revertStep('${s.key}')">\u64a4\u56de</button>`
            : '');
        return `
          <div class="step-item ${statusClass} ${s.required ? '' : 'optional'}" onclick="${st.status === 'pending' || st.status === 'current' ? `App.openStepModal('${s.key}')` : ''}">
            <div class="step-info">
              <div class="step-name">${escapeHtml(s.name)}${optionalTag}</div>
              <div class="step-meta">${escapeHtml(s.desc)} ${dateStr}</div>
              ${noteStr}
            </div>
            ${actionBtn}
          </div>
        `;
      }).join('');

      const phaseColors = { review: '#3b82f6', order: '#8b5cf6', shipping: '#10b981' };
      const color = phaseColors[p.id] || '#3b82f6';

      return `
        <div class="workflow-phase">
          <div class="phase-header">
            <div class="phase-badge" style="background:${color}">${pi + 1}</div>
            <span class="phase-name">${escapeHtml(p.name)}</span>
            <div class="phase-line"></div>
          </div>
          <div class="step-list">${stepsHtml}</div>
        </div>
      `;
    }).join('');

    navigate('orders');
    $('#page-orders').classList.remove('active');
    $('#page-order-detail').classList.add('active');
    $('#topbar-title').textContent = `\u8ba2\u5355\u8be6\u60c5 - ${order.orderNumber}`;
  }

  function backToOrders() {
    $('#page-order-detail').classList.remove('active');
    $('#page-orders').classList.add('active');
    $('#topbar-title').textContent = '\u8ba2\u5355\u7ba1\u7406';
    renderOrders();
  }

  // ========== 步骤更新模态框 ==========
  let currentStepKey = null;

  function openStepModal(stepKey) {
    currentStepKey = stepKey;
    const order = Store.getOrder(currentOrderId);
    const step = STEP_MAP[stepKey];
    const st = order.steps[stepKey];

    $('#step-modal-title').textContent = step.name;
    $('#step-modal-desc').textContent = step.desc;
    $('#step-status').value = st.status === 'current' ? 'completed' : st.status;
    $('#step-date').value = st.date || todayStr();
    $('#step-note').value = st.note || '';

    // 可选步骤增加跳过选项
    const statusSelect = $('#step-status');
    if (!step.required) {
      if (![...statusSelect.options].some(o => o.value === 'skipped')) {
        statusSelect.innerHTML = `
          <option value="completed">\u2713 \u5b8c\u6210</option>
          <option value="pending">\u5f85\u5904\u7406</option>
          <option value="skipped">\u8df3\u8fc7\uff08\u4e0d\u9700\u8981\uff09</option>
        `;
      }
    } else {
      statusSelect.innerHTML = `
        <option value="completed">\u2713 \u5b8c\u6210</option>
        <option value="pending">\u5f85\u5904\u7406</option>
      `;
    }
    statusSelect.value = st.status === 'current' ? 'completed' : st.status;

    $('#step-modal').classList.add('show');
  }

  function saveStep() {
    const status = $('#step-status').value;
    const date = $('#step-date').value;
    const note = $('#step-note').value;
    Store.updateStep(currentOrderId, currentStepKey, status, date, note);
    $('#step-modal').classList.remove('show');
    showToast('\u6b65\u9aa4\u5df2\u66f4\u65b0', 'success');
    viewOrder(currentOrderId);
  }

  function revertStep(stepKey) {
    Store.updateStep(currentOrderId, stepKey, 'pending', '', '');
    showToast('\u5df2\u64a4\u56de');
    viewOrder(currentOrderId);
  }

  // ========== 新增/编辑订单 ==========
  function openOrderModal() {
    $('#order-modal-title').textContent = '\u65b0\u589e\u8ba2\u5355';
    $('#order-form').reset();
    $('#order-form-id').value = '';
    $('#order-modal').classList.add('show');
  }

  function editOrder() {
    const order = Store.getOrder(currentOrderId);
    if (!order) return;
    $('#order-modal-title').textContent = '\u7f16\u8f91\u8ba2\u5355';
    $('#order-form-id').value = order.id;
    $('#order-number').value = order.orderNumber;
    $('#order-project-name').value = order.projectName;
    $('#order-customer').value = order.customer;
    $('#order-salesperson').value = order.salesperson;
    $('#order-proposal-number').value = order.proposalNumber || '';
    $('#order-amount').value = order.contractAmount || '';
    $('#order-remark').value = order.remark || '';
    $('#order-modal').classList.add('show');
  }

  function saveOrder() {
    const id = $('#order-form-id').value;
    const data = {
      orderNumber: $('#order-number').value.trim(),
      projectName: $('#order-project-name').value.trim(),
      customer: $('#order-customer').value.trim(),
      salesperson: $('#order-salesperson').value.trim(),
      proposalNumber: $('#order-proposal-number').value.trim(),
      contractAmount: parseFloat($('#order-amount').value) || 0,
      remark: $('#order-remark').value.trim(),
    };

    if (!data.orderNumber || !data.projectName || !data.customer || !data.salesperson) {
      showToast('\u8bf7\u586b\u5199\u5fc5\u586b\u5b57\u6bb5', 'error');
      return;
    }

    if (id) {
      Store.updateOrder(id, data);
      showToast('\u8ba2\u5355\u5df2\u66f4\u65b0', 'success');
    } else {
      Store.addOrder(data);
      showToast('\u8ba2\u5355\u5df2\u6dfb\u52a0', 'success');
    }
    $('#order-modal').classList.remove('show');
    renderOrders();
  }

  function deleteOrder() {
    if (!currentOrderId) return;
    if (!confirm('\u786e\u8ba4\u5220\u9664\u6b64\u8ba2\u5355\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002')) return;
    Store.deleteOrder(currentOrderId);
    showToast('\u8ba2\u5355\u5df2\u5220\u9664', 'success');
    backToOrders();
  }

  // ========== 新增/编辑任务 ==========
  let editingTaskId = null;

  function openTaskModal() {
    $('#task-modal-title').textContent = '\u65b0\u589e\u4efb\u52a1';
    $('#task-form').reset();
    $('#task-date').value = taskFilterDate || todayStr();
    editingTaskId = null;

    // 填充销售员和关联订单下拉
    const salespersons = Store.getSalespersons();
    $('#task-salesperson').innerHTML = '<option value="">\u4e0d\u5173\u8054</option>' +
      salespersons.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');

    const orders = Store.getOrders();
    $('#task-related-order').innerHTML = '<option value="">\u4e0d\u5173\u8054</option>' +
      orders.map(o => `<option value="${o.id}">${escapeHtml(o.orderNumber)} - ${escapeHtml(o.projectName)}</option>`).join('');

    $('#task-modal').classList.add('show');
  }

  function editTask(id) {
    const task = Store.getTasks().find(t => t.id === id);
    if (!task) return;
    $('#task-modal-title').textContent = '\u7f16\u8f91\u4efb\u52a1';
    $('#task-title').value = task.title;
    $('#task-description').value = task.description || '';
    $('#task-date').value = task.date;
    $('#task-priority').value = task.priority;
    editingTaskId = id;

    const salespersons = Store.getSalespersons();
    $('#task-salesperson').innerHTML = '<option value="">\u4e0d\u5173\u8054</option>' +
      salespersons.map(s => `<option value="${escapeAttr(s)}" ${task.salesperson === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');

    const orders = Store.getOrders();
    $('#task-related-order').innerHTML = '<option value="">\u4e0d\u5173\u8054</option>' +
      orders.map(o => `<option value="${o.id}" ${task.relatedOrder === o.id ? 'selected' : ''}>${escapeHtml(o.orderNumber)} - ${escapeHtml(o.projectName)}</option>`).join('');

    $('#task-modal').classList.add('show');
  }

  function saveTask() {
    const data = {
      title: $('#task-title').value.trim(),
      description: $('#task-description').value.trim(),
      date: $('#task-date').value,
      priority: $('#task-priority').value,
      completed: false,
      salesperson: $('#task-salesperson').value || '',
      relatedOrder: $('#task-related-order').value || ''
    };

    if (!data.title || !data.date) {
      showToast('\u8bf7\u586b\u5199\u4efb\u52a1\u6807\u9898\u548c\u65e5\u671f', 'error');
      return;
    }

    if (editingTaskId) {
      Store.updateTask(editingTaskId, data);
      showToast('\u4efb\u52a1\u5df2\u66f4\u65b0', 'success');
    } else {
      Store.addTask(data);
      showToast('\u4efb\u52a1\u5df2\u6dfb\u52a0', 'success');
    }
    $('#task-modal').classList.remove('show');
    renderTasks();
  }

  function deleteTask(id) {
    if (!confirm('\u786e\u8ba4\u5220\u9664\u6b64\u4efb\u52a1\uff1f')) return;
    Store.deleteTask(id);
    showToast('\u4efb\u52a1\u5df2\u5220\u9664', 'success');
    renderTasks();
  }

  function toggleTask(id) {
    Store.toggleTask(id);
    renderTasks();
    if (currentPage === 'dashboard') renderDashboard();
  }

  // ========== 月报 ==========
  function renderReport() {
    const year = parseInt($('#report-year').value) || new Date().getFullYear();
    const month = parseInt($('#report-month').value) || (new Date().getMonth() + 1);
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const orders = Store.getOrders();
    const tasks = Store.getTasks();

    // 本月订单
    const monthOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(monthStr));
    const monthTasks = tasks.filter(t => t.date && t.date.startsWith(monthStr));

    // 统计
    const totalOrders = orders.length;
    const monthOrderCount = monthOrders.length;
    const completedOrders = orders.filter(o => Store.getOrderPhase(o) === '\u5df2\u5b8c\u6210').length;
    const inProgress = totalOrders - completedOrders;
    const monthTaskDone = monthTasks.filter(t => t.completed).length;
    const monthTaskTotal = monthTasks.length;
    const taskRate = monthTaskTotal > 0 ? Math.round((monthTaskDone / monthTaskTotal) * 100) : 0;
    const totalAmount = orders.reduce((sum, o) => sum + (o.contractAmount || 0), 0);
    const monthAmount = monthOrders.reduce((sum, o) => sum + (o.contractAmount || 0), 0);

    // 填充统计
    $('#report-month-orders').textContent = monthOrderCount;
    $('#report-total-orders').textContent = totalOrders;
    $('#report-completed-orders').textContent = completedOrders;
    $('#report-in-progress').textContent = inProgress;
    $('#report-task-rate').textContent = taskRate + '%';
    $('#report-month-amount').textContent = fmtMoney(monthAmount);
    $('#report-total-amount').textContent = fmtMoney(totalAmount);
    $('#report-task-done').textContent = monthTaskDone;
    $('#report-task-total').textContent = monthTaskTotal;

    // 按销售员统计
    const spStats = {};
    orders.forEach(o => {
      if (!spStats[o.salesperson]) {
        spStats[o.salesperson] = { total: 0, completed: 0, inProgress: 0, amount: 0 };
      }
      spStats[o.salesperson].total++;
      spStats[o.salesperson].amount += o.contractAmount || 0;
      if (Store.getOrderPhase(o) === '\u5df2\u5b8c\u6210') {
        spStats[o.salesperson].completed++;
      } else {
        spStats[o.salesperson].inProgress++;
      }
    });

    const spTbody = $('#report-sp-tbody');
    spTbody.innerHTML = Object.entries(spStats).map(([name, s]) => `
      <tr>
        <td data-label="\u9500\u552e\u5458"><strong>${escapeHtml(name)}</strong></td>
        <td data-label="\u8ba2\u5355\u603b\u6570">${s.total}</td>
        <td data-label="\u5df2\u5b8c\u6210"><span class="tag tag-green">${s.completed}</span></td>
        <td data-label="\u8fdb\u884c\u4e2d"><span class="tag tag-blue">${s.inProgress}</span></td>
        <td data-label="\u5408\u540c\u91d1\u989d" style="text-align:right">${fmtMoney(s.amount)}</td>
      </tr>
    `).join('');

    // 按阶段统计
    const phaseStats = { '\u524d\u671f\u8bc4\u5ba1\u73af\u8282': 0, '\u4e0b\u5355\u73af\u8282': 0, '\u53d1\u8d27\u73af\u8282': 0, '\u5df2\u5b8c\u6210': 0 };
    orders.forEach(o => {
      const ph = Store.getOrderPhase(o);
      phaseStats[ph] = (phaseStats[ph] || 0) + 1;
    });

    // 柱状图
    const chartEl = $('#report-chart');
    const colors = { '\u524d\u671f\u8bc4\u5ba1\u73af\u8282': '#3b82f6', '\u4e0b\u5355\u73af\u8282': '#8b5cf6', '\u53d1\u8d27\u73af\u8282': '#10b981', '\u5df2\u5b8c\u6210': '#f59e0b' };
    const maxVal = Math.max(...Object.values(phaseStats), 1);
    chartEl.innerHTML = Object.entries(phaseStats).map(([name, count]) => {
      const height = (count / maxVal) * 100;
      return `
        <div class="chart-bar-group">
          <div class="chart-bar" style="height:${height}%;background:${colors[name]}">
            <span class="chart-bar-value">${count}</span>
          </div>
          <span class="chart-bar-label">${name.length > 4 ? name.slice(0, 4) + '...' : name}</span>
        </div>
      `;
    }).join('');

    // 近6个月趋势
    const trendEl = $('#report-trend');
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      months.push({
        label: `${d.getMonth() + 1}\u6708`,
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      });
    }
    const trendData = months.map(m => {
      const cnt = orders.filter(o => o.createdAt && o.createdAt.startsWith(m.key)).length;
      return { ...m, count: cnt };
    });
    const maxTrend = Math.max(...trendData.map(t => t.count), 1);
    trendEl.innerHTML = trendData.map(t => {
      const h = (t.count / maxTrend) * 100;
      return `
        <div class="chart-bar-group">
          <div class="chart-bar" style="height:${h}%;background:#2563eb">
            <span class="chart-bar-value">${t.count}</span>
          </div>
          <span class="chart-bar-label">${t.label}</span>
        </div>
      `;
    }).join('');

    // 生成文字总结
    const summary = `${year}\u5e74${month}\u6708\u5de5\u4f5c\u603b\u7ed3\uff1a\u672c\u6708\u65b0\u589e\u8ba2\u5355 ${monthOrderCount} \u4e2a\uff0c\u5408\u540c\u91d1\u989d ${fmtMoney(monthAmount)}\uff1b\u7d2f\u8ba1\u8ba2\u5355 ${totalOrders} \u4e2a\uff0c\u5df2\u5b8c\u6210 ${completedOrders} \u4e2a\uff0c\u8fdb\u884c\u4e2d ${inProgress} \u4e2a\uff1b\u672c\u6708\u4efb\u52a1\u5b8c\u6210\u7387 ${taskRate}%\uff08${monthTaskDone}/${monthTaskTotal}\uff09\u3002`;
    $('#report-summary').textContent = summary;
  }

  // ========== 辅助函数 ==========
  function priorityLabel(p) {
    return { high: '\u9ad8\u4f18\u5148', medium: '\u4e2d\u4f18\u5148', low: '\u4f4e\u4f18\u5148' }[p] || p;
  }

  function priorityTag(p) {
    return { high: 'tag-red', medium: 'tag-orange', low: 'tag-gray' }[p] || 'tag-gray';
  }

  function phaseTag(phase) {
    const map = {
      '\u524d\u671f\u8bc4\u5ba1\u73af\u8282': 'tag-blue',
      '\u4e0b\u5355\u73af\u8282': 'tag-purple',
      '\u53d1\u8d27\u73af\u8282': 'tag-green',
      '\u5df2\u5b8c\u6210': 'tag-gray'
    };
    return map[phase] || 'tag-gray';
  }

  function phaseShort(phase) {
    const map = {
      '\u524d\u671f\u8bc4\u5ba1\u73af\u8282': '\u524d\u671f\u8bc4\u5ba1',
      '\u4e0b\u5355\u73af\u8282': '\u4e0b\u5355\u4e2d',
      '\u53d1\u8d27\u73af\u8282': '\u53d1\u8d27\u4e2d',
      '\u5df2\u5b8c\u6210': '\u5df2\u5b8c\u6210'
    };
    return map[phase] || phase;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function updateBadges() {
    const todayTasks = Store.getTasksByDate(todayStr());
    const pending = todayTasks.filter(t => !t.completed).length;
    const badge = $('#nav-task-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? '' : 'none';
    }
  }

  // ========== 初始化 ==========
  function init() {
    Store.init();

    // 导航绑定
    $$('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.page));
    });

    // 顶栏日期
    $('#topbar-date').textContent = todayDisplay();

    // 任务页日期切换
    $('#task-date-input').addEventListener('change', (e) => {
      taskFilterDate = e.target.value;
      renderTasks();
    });

    // 订单筛选
    $('#order-filter-sp').addEventListener('change', (e) => {
      orderFilter.salesperson = e.target.value;
      renderOrders();
    });
    $('#order-filter-phase').addEventListener('change', (e) => {
      orderFilter.phase = e.target.value;
      renderOrders();
    });
    $('#order-search').addEventListener('input', (e) => {
      orderFilter.keyword = e.target.value;
      renderOrders();
    });

    // 模态框关闭
    $$('.modal-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.closest('.modal-overlay').classList.remove('show');
        }
      });
    });

    // 按钮绑定
    $('#btn-add-task').addEventListener('click', openTaskModal);
    $('#btn-save-task').addEventListener('click', saveTask);
    $('#btn-add-order').addEventListener('click', openOrderModal);
    $('#btn-save-order').addEventListener('click', saveOrder);
    $('#btn-edit-order').addEventListener('click', editOrder);
    $('#btn-delete-order').addEventListener('click', deleteOrder);
    $('#btn-back-orders').addEventListener('click', backToOrders);
    $('#btn-save-step').addEventListener('click', saveStep);
    $('#btn-generate-report').addEventListener('click', renderReport);

    // 重置数据
    $('#btn-reset-data').addEventListener('click', () => {
      if (confirm('\u786e\u8ba4\u91cd\u7f6e\u6240\u6709\u6570\u636e\uff1f\u8fd9\u5c06\u6e05\u9664\u6240\u6709\u81ea\u5b9a\u4e49\u6570\u636e\u5e76\u6062\u590d\u793a\u4f8b\u6570\u636e\u3002')) {
        Store.resetAll();
        showToast('\u6570\u636e\u5df2\u91cd\u7f6e', 'success');
        navigate('dashboard');
      }
    });

    // 默认显示首页
    navigate('dashboard');
  }

  // ========== 暴露API ==========
  window.App = {
    toggleTask,
    viewOrder,
    openStepModal,
    saveStep,
    revertStep,
    editTask,
    deleteTask,
    openOrderModal,
    editOrder,
    deleteOrder,
    backToOrders,
  };

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
