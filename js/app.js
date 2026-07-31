/**
 * 商务专员工作台 - 主应用逻辑
 */
(function() {
  'use strict';

  // ========== 工具函数 ==========
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

  function fmtMoney(n) {
    return '¥' + Number(n || 0).toLocaleString('zh-CN');
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
    toast.innerHTML = '<span>✓</span> ' + msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 2500);
  }

  // ========== 导航 ==========
  const pages = ['dashboard', 'tasks', 'orders', 'report'];
  let currentPage = 'dashboard';

  function navigate(page) {
    currentPage = page;
    // 隐藏订单详情页
    var detailPage = $('#page-order-detail');
    if (detailPage) detailPage.classList.remove('active');
    // 重置所有页面
    pages.forEach(function(p) {
      var el = $('#page-' + p);
      el.style.display = '';
      el.classList.toggle('active', p === page);
    });
    $$('.nav-item[data-page]').forEach(function(item) {
      item.classList.toggle('active', item.dataset.page === page);
    });
    var titles = {};
    titles['dashboard'] = '工作台首页';
    titles['tasks'] = '每日工作任务';
    titles['orders'] = '订单管理';
    titles['report'] = '月报总结';
    $('#topbar-title').textContent = titles[page] || '';

    // 渲染对应页面
    if (page === 'dashboard') renderDashboard();
    if (page === 'tasks') renderTasks();
    if (page === 'orders') renderOrders();
    if (page === 'report') renderReport();
  }

  // ========== 首页 Dashboard ==========
  function renderDashboard() {
    var orders = Store.getOrders();
    var todayTasks = Store.getTasksByDate(todayStr());
    var pendingTasks = todayTasks.filter(function(t) { return !t.completed; });

    // 统计
    var inReview = orders.filter(function(o) { return Store.getOrderPhase(o) === '前期评审环节'; }).length;
    var inOrder = orders.filter(function(o) { return Store.getOrderPhase(o) === '下单环节'; }).length;
    var inShipping = orders.filter(function(o) { return Store.getOrderPhase(o) === '发货环节'; }).length;
    var completed = orders.filter(function(o) { return Store.getOrderPhase(o) === '已完成'; }).length;

    $('#dash-total-orders').textContent = orders.length;
    $('#dash-in-progress').textContent = inReview + inOrder + inShipping;
    $('#dash-today-tasks').textContent = pendingTasks.length;
    $('#dash-completed-orders').textContent = completed;

    // 今日任务
    var taskList = $('#dash-tasks');
    if (todayTasks.length === 0) {
      taskList.innerHTML = '<div class="empty-state"><div class="icon">✅</div><div class="text">今日暂无任务</div></div>';
    } else {
      taskList.innerHTML = todayTasks.slice(0, 6).map(function(t) {
        var rows = [];
        rows.push('<div class="task-item ' + (t.completed ? 'completed' : '') + '">');
        rows.push('<div class="task-checkbox ' + (t.completed ? 'checked' : '') + '" onclick="App.toggleTask(\'' + t.id + '\')">' + (t.completed ? '✓' : '') + '</div>');
        rows.push('<div class="task-content">');
        rows.push('<div class="task-title">' + escapeHtml(t.title) + '</div>');
        if (t.description) rows.push('<div class="task-desc">' + escapeHtml(t.description) + '</div>');
        rows.push('<div class="task-meta">');
        rows.push('<span class="tag ' + priorityTag(t.priority) + '">' + priorityLabel(t.priority) + '</span>');
        if (t.relatedOrder) rows.push('<span class="tag tag-gray">关联订单</span>');
        rows.push('</div></div></div>');
        return rows.join('');
      }).join('');
    }

    // 订单概览
    var orderList = $('#dash-orders');
    var activeOrders = orders.filter(function(o) { return Store.getOrderPhase(o) !== '已完成'; }).slice(0, 5);
    if (activeOrders.length === 0) {
      orderList.innerHTML = '<div class="empty-state"><div class="text">暂无进行中的订单</div></div>';
    } else {
      orderList.innerHTML = activeOrders.map(function(o) {
        var progress = Store.getOrderProgress(o);
        var phase = Store.getOrderPhase(o);
        var rows = [];
        rows.push('<div class="task-item" style="cursor:pointer" onclick="App.viewOrder(\'' + o.id + '\')">');
        rows.push('<div class="task-content">');
        rows.push('<div style="display:flex;justify-content:space-between;align-items:center">');
        rows.push('<span class="task-title">' + escapeHtml(o.projectName) + '</span>');
        rows.push('<span class="tag ' + phaseTag(phase) + '">' + phaseShort(phase) + '</span>');
        rows.push('</div>');
        rows.push('<div class="task-desc" style="margin-top:4px">' + o.orderNumber + ' | ' + escapeHtml(o.salesperson) + ' | ' + escapeHtml(o.customer) + '</div>');
        rows.push('<div style="margin-top:8px;display:flex;align-items:center;gap:8px">');
        rows.push('<div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:' + progress + '%"></div></div>');
        rows.push('<span style="font-size:12px;color:var(--gray-500);min-width:36px">' + progress + '%</span>');
        rows.push('</div></div></div>');
        return rows.join('');
      }).join('');
    }

    // 更新侧边栏徽章
    updateBadges();
  }

  // ========== 每日任务 ==========
  var taskFilterDate = null;

  function renderTasks() {
    var date = taskFilterDate || todayStr();
    $('#task-date-input').value = date;
    var tasks = Store.getTasksByDate(date);
    var pending = tasks.filter(function(t) { return !t.completed; });
    var done = tasks.filter(function(t) { return t.completed; });

    var list = $('#task-list');
    if (tasks.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">✅</div><div class="text">该日期暂无任务，点击右上角添加任务</div></div>';
    } else {
      var html = pending.map(function(t) { return taskItemHtml(t); }).concat(
        done.map(function(t) { return taskItemHtml(t); })
      ).join('');
      list.innerHTML = html;
    }

    // 统计
    $('#task-count-pending').textContent = pending.length;
    $('#task-count-done').textContent = done.length;
    $('#task-count-total').textContent = tasks.length;
    updateBadges();
  }

  function taskItemHtml(t) {
    var order = t.relatedOrder ? Store.getOrder(t.relatedOrder) : null;
    var rows = [];
    rows.push('<div class="task-item ' + (t.completed ? 'completed' : '') + '">');
    rows.push('<div class="task-checkbox ' + (t.completed ? 'checked' : '') + '" onclick="App.toggleTask(\'' + t.id + '\')">' + (t.completed ? '✓' : '') + '</div>');
    rows.push('<div class="task-content">');
    rows.push('<div class="task-title">' + escapeHtml(t.title) + '</div>');
    if (t.description) rows.push('<div class="task-desc">' + escapeHtml(t.description) + '</div>');
    rows.push('<div class="task-meta">');
    rows.push('<span class="tag ' + priorityTag(t.priority) + '">' + priorityLabel(t.priority) + '</span>');
    if (t.salesperson) rows.push('<span class="tag tag-purple">👤 ' + escapeHtml(t.salesperson) + '</span>');
    if (order) rows.push('<span class="tag tag-blue" style="cursor:pointer" onclick="App.viewOrder(\'' + order.id + '\');event.stopPropagation()">' + order.orderNumber + '</span>');
    rows.push('</div></div>');
    rows.push('<div class="task-actions">');
    rows.push('<button class="btn-icon" title="编辑" onclick="App.editTask(\'' + t.id + '\')">✎</button>');
    rows.push('<button class="btn-icon" title="删除" onclick="App.deleteTask(\'' + t.id + '\')">✗</button>');
    rows.push('</div></div>');
    return rows.join('');
  }

  // ========== 订单管理 ==========
  var orderFilter = { salesperson: '', keyword: '', phase: '', status: 'active' };

  function renderOrders() {
    var orders = Store.getOrders();
    var salespersons = Store.getSalespersons();

    // 状态标签页切换
    $$('#order-status-tabs .status-tab').forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.status === orderFilter.status);
    });

    // 填充销售员筛选
    var spSelect = $('#order-filter-sp');
    spSelect.innerHTML = '<option value="">全部销售员</option>' +
      salespersons.map(function(s) { return '<option value="' + escapeAttr(s) + '"' + (orderFilter.salesperson === s ? ' selected' : '') + '>' + escapeHtml(s) + '</option>'; }).join('');

    // 筛选
    var filtered = orders;
    if (orderFilter.status) {
      filtered = filtered.filter(function(o) { return (o.status || 'active') === orderFilter.status; });
    }
    if (orderFilter.salesperson) {
      filtered = filtered.filter(function(o) { return o.salesperson === orderFilter.salesperson; });
    }
    if (orderFilter.phase) {
      filtered = filtered.filter(function(o) { return Store.getOrderPhase(o) === orderFilter.phase; });
    }
    if (orderFilter.keyword) {
      var kw = orderFilter.keyword.toLowerCase();
      filtered = filtered.filter(function(o) {
        return o.orderNumber.toLowerCase().indexOf(kw) !== -1 ||
          o.projectName.toLowerCase().indexOf(kw) !== -1 ||
          o.customer.toLowerCase().indexOf(kw) !== -1;
      });
    }

    // 渲染表格
    var tbody = $('#order-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400)">未找到匹配的订单</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(function(o) {
        var phase = Store.getOrderPhase(o);
        var progress = Store.getOrderProgress(o);
        var currentStep = getCurrentStepName(o);
        var isComp = (o.status === 'completed') || (phase === '已完成');
        var rows = [];
        rows.push('<tr onclick="App.viewOrder(\'' + o.id + '\')" style="' + (isComp ? 'opacity:0.75' : '') + '">');
        rows.push('<td data-label="订单号"><strong>' + escapeHtml(o.orderNumber) + '</strong></td>');
        rows.push('<td data-label="项目名称">' + escapeHtml(o.projectName) + '</td>');
        rows.push('<td data-label="客户">' + escapeHtml(o.customer) + '</td>');
        rows.push('<td data-label="销售员">' + escapeHtml(o.salesperson) + '</td>');
        rows.push('<td data-label="当前阶段">');
        rows.push('<span class="tag ' + phaseTag(phase) + '">' + phaseShort(phase) + '</span>');
        rows.push('<div style="font-size:11px;color:var(--gray-400);margin-top:4px">' + escapeHtml(currentStep) + '</div>');
        rows.push('</td>');
        rows.push('<td data-label="进度">');
        rows.push('<div style="display:flex;align-items:center;gap:8px">');
        rows.push('<div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:' + progress + '%"></div></div>');
        rows.push('<span style="font-size:12px">' + progress + '%</span>');
        rows.push('</div></td>');
        rows.push('<td data-label="状态">');
        if (o.status === 'completed') {
          rows.push('<span class="tag tag-green">✓ 已完成</span>');
        } else {
          rows.push('<span class="tag tag-blue">进行中</span>');
        }
        rows.push('</td>');
        rows.push('<td data-label="合同金额" style="text-align:right">' + fmtMoney(o.contractAmount) + '</td>');
        rows.push('</tr>');
        return rows.join('');
      }).join('');
    }

    $('#order-count').textContent = filtered.length;
    updateBadges();
  }

  function getCurrentStepName(order) {
    var steps = ALL_STEPS;
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var st = order.steps[s.key];
      if (st.status === 'current') return '→ ' + s.name;
    }
    var allDone = steps.every(function(s) {
      return order.steps[s.key].status === 'completed' || order.steps[s.key].status === 'skipped';
    });
    if (allDone) return '✅ 已完成';
    return '-';
  }

  // ========== 订单详情 ==========
  var currentOrderId = null;

  function viewOrder(id) {
    currentOrderId = id;
    var order = Store.getOrder(id);
    if (!order) return;

    var phase = Store.getOrderPhase(order);
    var progress = Store.getOrderProgress(order);

    $('#detail-order-number').textContent = order.orderNumber;
    $('#detail-project-name').textContent = order.projectName;
    $('#detail-customer').textContent = order.customer;
    $('#detail-salesperson').textContent = order.salesperson;
    $('#detail-proposal-number').textContent = order.proposalNumber || '-';
    $('#detail-amount').textContent = fmtMoney(order.contractAmount);
    $('#detail-created').textContent = fmtDate(order.createdAt);
    $('#detail-phase').innerHTML = '<span class="tag ' + phaseTag(phase) + '">' + phase + '</span>';
    $('#detail-progress').innerHTML = '<div style="display:flex;align-items:center;gap:8px"><div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:' + progress + '%"></div></div><span style="font-size:13px;font-weight:600">' + progress + '%</span></div>';

    // 显示/隐藏归档/恢复按钮
    var btnArchive = $('#btn-archive-order');
    var btnRestore = $('#btn-restore-order');
    if (order.status === 'completed') {
      btnArchive.style.display = 'none';
      btnRestore.style.display = '';
    } else {
      btnArchive.style.display = '';
      btnRestore.style.display = 'none';
    }
    $('#detail-remark').textContent = order.remark || '无';

    // 渲染流程
    var flowEl = $('#detail-workflow');
    flowEl.innerHTML = WORKFLOW.phases.map(function(p, pi) {
      var stepsHtml = p.steps.map(function(s) {
        var st = order.steps[s.key] || { status: 'pending', date: '', note: '' };
        var statusClass = st.status;
        var dateStr = st.date ? ' · ' + st.date : '';
        var noteStr = st.note ? '<div class="step-note">' + escapeHtml(st.note) + '</div>' : '';
        var actionBtn;
        if (st.status === 'pending' || st.status === 'current') {
          actionBtn = '<button class="btn btn-sm btn-primary" style="margin-left:auto" onclick="App.openStepModal(\'' + s.key + '\')">更新</button>';
        } else if (st.status === 'completed') {
          actionBtn = '<button class="btn btn-sm btn-ghost" style="margin-left:auto" onclick="App.revertStep(\'' + s.key + '\')">撤回</button>';
        } else if (st.status === 'skipped') {
          actionBtn = '<button class="btn btn-sm btn-ghost" style="margin-left:auto" onclick="App.revertStep(\'' + s.key + '\')">撤回</button>';
        } else {
          actionBtn = '';
        }
        var clickHandler = (st.status === 'pending' || st.status === 'current') ? 'onclick="App.openStepModal(\'' + s.key + '\')"' : '';
        var rows = [];
        rows.push('<div class="step-item ' + statusClass + '" ' + clickHandler + '>');
        rows.push('<div class="step-info">');
        rows.push('<div class="step-name">' + escapeHtml(s.name) + '</div>');
        rows.push('<div class="step-meta">' + escapeHtml(s.desc) + ' ' + dateStr + '</div>');
        rows.push(noteStr);
        rows.push('</div>');
        rows.push(actionBtn);
        rows.push('</div>');
        return rows.join('');
      }).join('');

      var phaseColors = { review: '#3b82f6', order: '#8b5cf6', shipping: '#10b981' };
      var color = phaseColors[p.id] || '#3b82f6';

      var rows = [];
      rows.push('<div class="workflow-phase">');
      rows.push('<div class="phase-header">');
      rows.push('<div class="phase-badge" style="background:' + color + '">' + (pi + 1) + '</div>');
      rows.push('<span class="phase-name">' + escapeHtml(p.name) + '</span>');
      rows.push('<div class="phase-line"></div>');
      rows.push('</div>');
      rows.push('<div class="step-list">' + stepsHtml + '</div>');
      rows.push('</div>');
      return rows.join('');
    }).join('');

    navigate('orders');
    $('#page-orders').classList.remove('active');
    $('#page-order-detail').classList.add('active');
    $('#topbar-title').textContent = '订单详情 - ' + order.orderNumber;
  }

  function backToOrders() {
    $('#page-order-detail').classList.remove('active');
    $('#page-orders').classList.add('active');
    $('#topbar-title').textContent = '订单管理';
    renderOrders();
  }

  // ========== 步骤更新模态框 ==========
  var currentStepKey = null;

  function openStepModal(stepKey) {
    currentStepKey = stepKey;
    var order = Store.getOrder(currentOrderId);
    var step = STEP_MAP[stepKey];
    var st = order.steps[stepKey];

    $('#step-modal-title').textContent = step.name;
    $('#step-modal-desc').textContent = step.desc;
    $('#step-status').value = st.status === 'current' ? 'completed' : st.status;
    $('#step-date').value = st.date || todayStr();
    $('#step-note').value = st.note || '';

    // 所有步骤都支持"不需要"选项
    var statusSelect = $('#step-status');
    statusSelect.innerHTML = '<option value="completed">✓ 完成</option><option value="pending">待处理</option><option value="skipped">不需要</option>';
    statusSelect.value = st.status === 'current' ? 'completed' : st.status;

    $('#step-modal').classList.add('show');
  }

  function saveStep() {
    var status = $('#step-status').value;
    var date = $('#step-date').value;
    var note = $('#step-note').value;
    Store.updateStep(currentOrderId, currentStepKey, status, date, note);
    $('#step-modal').classList.remove('show');
    showToast('步骤已更新', 'success');
    viewOrder(currentOrderId);
  }

  function revertStep(stepKey) {
    Store.updateStep(currentOrderId, stepKey, 'pending', '', '');
    showToast('已撤回');
    viewOrder(currentOrderId);
  }

  // ========== 新增/编辑订单 ==========
  function openOrderModal() {
    $('#order-modal-title').textContent = '新增订单';
    $('#order-form').reset();
    $('#order-form-id').value = '';
    $('#order-status').value = 'active';
    $('#order-modal').classList.add('show');
  }

  function editOrder() {
    var order = Store.getOrder(currentOrderId);
    if (!order) return;
    $('#order-modal-title').textContent = '编辑订单';
    $('#order-form-id').value = order.id;
    $('#order-number').value = order.orderNumber;
    $('#order-project-name').value = order.projectName;
    $('#order-customer').value = order.customer;
    $('#order-salesperson').value = order.salesperson;
    $('#order-proposal-number').value = order.proposalNumber || '';
    $('#order-amount').value = order.contractAmount || '';
    $('#order-status').value = order.status || 'active';
    $('#order-remark').value = order.remark || '';
    $('#order-modal').classList.add('show');
  }

  function saveOrder() {
    var id = $('#order-form-id').value;
    var data = {
      orderNumber: $('#order-number').value.trim(),
      projectName: $('#order-project-name').value.trim(),
      customer: $('#order-customer').value.trim(),
      salesperson: $('#order-salesperson').value.trim(),
      proposalNumber: $('#order-proposal-number').value.trim(),
      contractAmount: parseFloat($('#order-amount').value) || 0,
      status: $('#order-status').value || 'active',
      remark: $('#order-remark').value.trim()
    };

    if (!data.orderNumber || !data.projectName || !data.customer || !data.salesperson) {
      showToast('请填写必填字段', 'error');
      return;
    }

    if (id) {
      Store.updateOrder(id, data);
      showToast('订单已更新', 'success');
    } else {
      Store.addOrder(data);
      showToast('订单已添加', 'success');
    }
    $('#order-modal').classList.remove('show');
    renderOrders();
  }

  function deleteOrder() {
    if (!currentOrderId) return;
    if (!confirm('确认删除此订单？此操作不可撤销。')) return;
    Store.deleteOrder(currentOrderId);
    showToast('订单已删除', 'success');
    backToOrders();
  }

  function archiveOrder() {
    if (!currentOrderId) return;
    Store.archiveOrder(currentOrderId);
    showToast('订单已归档为已完成', 'success');
    viewOrder(currentOrderId);
  }

  function restoreOrder() {
    if (!currentOrderId) return;
    Store.restoreOrder(currentOrderId);
    showToast('订单已恢复为进行中', 'success');
    viewOrder(currentOrderId);
  }

  // ========== 新增/编辑任务 ==========
  var editingTaskId = null;

  function openTaskModal() {
    $('#task-modal-title').textContent = '新增任务';
    $('#task-form').reset();
    $('#task-date').value = taskFilterDate || todayStr();
    editingTaskId = null;

    // 填充销售员和关联订单下拉
    var salespersons = Store.getSalespersons();
    $('#task-salesperson').innerHTML = '<option value="">不关联</option>' +
      salespersons.map(function(s) { return '<option value="' + escapeAttr(s) + '">' + escapeHtml(s) + '</option>'; }).join('');

    var orders = Store.getOrders();
    $('#task-related-order').innerHTML = '<option value="">不关联</option>' +
      orders.map(function(o) { return '<option value="' + o.id + '">' + escapeHtml(o.orderNumber) + ' - ' + escapeHtml(o.projectName) + '</option>'; }).join('');

    $('#task-modal').classList.add('show');
  }

  function editTask(id) {
    var task = Store.getTasks().find(function(t) { return t.id === id; });
    if (!task) return;
    $('#task-modal-title').textContent = '编辑任务';
    $('#task-title').value = task.title;
    $('#task-description').value = task.description || '';
    $('#task-date').value = task.date;
    $('#task-priority').value = task.priority;
    editingTaskId = id;

    var salespersons = Store.getSalespersons();
    $('#task-salesperson').innerHTML = '<option value="">不关联</option>' +
      salespersons.map(function(s) { return '<option value="' + escapeAttr(s) + '"' + (task.salesperson === s ? ' selected' : '') + '>' + escapeHtml(s) + '</option>'; }).join('');

    var orders = Store.getOrders();
    $('#task-related-order').innerHTML = '<option value="">不关联</option>' +
      orders.map(function(o) { return '<option value="' + o.id + '"' + (task.relatedOrder === o.id ? ' selected' : '') + '>' + escapeHtml(o.orderNumber) + ' - ' + escapeHtml(o.projectName) + '</option>'; }).join('');

    $('#task-modal').classList.add('show');
  }

  function saveTask() {
    var data = {
      title: $('#task-title').value.trim(),
      description: $('#task-description').value.trim(),
      date: $('#task-date').value,
      priority: $('#task-priority').value,
      completed: false,
      salesperson: $('#task-salesperson').value || '',
      relatedOrder: $('#task-related-order').value || ''
    };

    if (!data.title || !data.date) {
      showToast('请填写任务标题和日期', 'error');
      return;
    }

    if (editingTaskId) {
      Store.updateTask(editingTaskId, data);
      showToast('任务已更新', 'success');
    } else {
      Store.addTask(data);
      showToast('任务已添加', 'success');
    }
    $('#task-modal').classList.remove('show');
    renderTasks();
  }

  function deleteTask(id) {
    if (!confirm('确认删除此任务？')) return;
    Store.deleteTask(id);
    showToast('任务已删除', 'success');
    renderTasks();
  }

  function toggleTask(id) {
    Store.toggleTask(id);
    // 自动同步：任务完成时更新关联订单的对应步骤
    var tasks = Store.getTasks();
    var task = tasks.find(function(t) { return t.id === id; });
    var synced = null;
    if (task && task.completed && task.relatedOrder) {
      synced = Store.syncTaskToOrderStep(task);
      if (synced) {
        showToast('已同步「' + synced.orderNumber + '」→ ' + synced.stepName, 'success');
      }
    }
    renderTasks();
    if (currentPage === 'dashboard') renderDashboard();
    // 如果正在查看该订单详情，刷新视图
    if (synced && currentOrderId === synced.orderId) {
      viewOrder(currentOrderId);
    }
  }

  // ========== 月报 ==========
  var lastReportData = null; // 缓存最近一次月报数据，供导出使用

  function renderReport() {
    try {
      var year = parseInt($('#report-year').value) || new Date().getFullYear();
      var month = parseInt($('#report-month').value) || (new Date().getMonth() + 1);
      var monthStr = year + '-' + String(month).padStart(2, '0');

      var orders = Store.getOrders();
      var tasks = Store.getTasks();

      // 本月订单
      var monthOrders = orders.filter(function(o) { return o.createdAt && o.createdAt.indexOf(monthStr) === 0; });
      var monthTasks = tasks.filter(function(t) { return t.date && t.date.indexOf(monthStr) === 0; });

      // 统计
      var totalOrders = orders.length;
      var monthOrderCount = monthOrders.length;
      var completedOrders = orders.filter(function(o) { return (o.status || 'active') === 'completed'; }).length;
      var inProgress = totalOrders - completedOrders;
      var monthTaskDone = monthTasks.filter(function(t) { return t.completed; }).length;
      var monthTaskTotal = monthTasks.length;
      var taskRate = monthTaskTotal > 0 ? Math.round((monthTaskDone / monthTaskTotal) * 100) : 0;
      var totalAmount = orders.reduce(function(sum, o) { return sum + (o.contractAmount || 0); }, 0);
      var monthAmount = monthOrders.reduce(function(sum, o) { return sum + (o.contractAmount || 0); }, 0);

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
      var spStats = {};
      orders.forEach(function(o) {
        if (!spStats[o.salesperson]) {
          spStats[o.salesperson] = { total: 0, completed: 0, inProgress: 0, amount: 0 };
        }
        spStats[o.salesperson].total++;
        spStats[o.salesperson].amount += o.contractAmount || 0;
        if ((o.status || 'active') === 'completed') {
          spStats[o.salesperson].completed++;
        } else {
          spStats[o.salesperson].inProgress++;
        }
      });

      var spTbody = $('#report-sp-tbody');
      var spRows = [];
      var spKeys = Object.keys(spStats);
      for (var i = 0; i < spKeys.length; i++) {
        var name = spKeys[i];
        var s = spStats[name];
        spRows.push('<tr>');
        spRows.push('<td data-label="销售员"><strong>' + escapeHtml(name) + '</strong></td>');
        spRows.push('<td data-label="订单总数">' + s.total + '</td>');
        spRows.push('<td data-label="已完成"><span class="tag tag-green">' + s.completed + '</span></td>');
        spRows.push('<td data-label="进行中"><span class="tag tag-blue">' + s.inProgress + '</span></td>');
        spRows.push('<td data-label="合同金额" style="text-align:right">' + fmtMoney(s.amount) + '</td>');
        spRows.push('</tr>');
      }
      spTbody.innerHTML = spRows.join('');

      // 按阶段统计
      var phaseMap = { '前期评审环节': 0, '下单环节': 0, '发货环节': 0, '已完成': 0 };
      orders.forEach(function(o) {
        if ((o.status || 'active') === 'completed') {
          phaseMap['已完成']++;
        } else {
          var ph = Store.getOrderPhase(o);
          phaseMap[ph] = (phaseMap[ph] || 0) + 1;
        }
      });

      // 柱状图
      var chartEl = $('#report-chart');
      var colors = { '前期评审环节': '#3b82f6', '下单环节': '#8b5cf6', '发货环节': '#10b981', '已完成': '#f59e0b' };
      var maxVal = Math.max(phaseMap['前期评审环节'], phaseMap['下单环节'], phaseMap['发货环节'], phaseMap['已完成'], 1);
      var chartKeys = Object.keys(phaseMap);
      var chartRows = [];
      for (var j = 0; j < chartKeys.length; j++) {
        var cname = chartKeys[j];
        var count = phaseMap[cname];
        var height = (count / maxVal) * 100;
        var label = cname.length > 4 ? cname.substring(0, 4) + '...' : cname;
        chartRows.push('<div class="chart-bar-group">');
        chartRows.push('<div class="chart-bar" style="height:' + height + '%;background:' + colors[cname] + '">');
        chartRows.push('<span class="chart-bar-value">' + count + '</span>');
        chartRows.push('</div>');
        chartRows.push('<span class="chart-bar-label">' + label + '</span>');
        chartRows.push('</div>');
      }
      chartEl.innerHTML = chartRows.join('');

      // 近6个月趋势
      var trendEl = $('#report-trend');
      var months = [];
      for (var k = 5; k >= 0; k--) {
        var d = new Date(year, month - 1 - k, 1);
        months.push({
          label: (d.getMonth() + 1) + '月',
          key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        });
      }
      var trendData = months.map(function(m) {
        var cnt = orders.filter(function(o) { return o.createdAt && o.createdAt.indexOf(m.key) === 0; }).length;
        m.count = cnt;
        return m;
      });
      var maxTrend = Math.max.apply(null, trendData.map(function(t) { return t.count; }).concat([1]));
      var trendRows = [];
      for (var l = 0; l < trendData.length; l++) {
        var t = trendData[l];
        var h = (t.count / maxTrend) * 100;
        trendRows.push('<div class="chart-bar-group">');
        trendRows.push('<div class="chart-bar" style="height:' + h + '%;background:#7c3aed">');
        trendRows.push('<span class="chart-bar-value">' + t.count + '</span>');
        trendRows.push('</div>');
        trendRows.push('<span class="chart-bar-label">' + t.label + '</span>');
        trendRows.push('</div>');
      }
      trendEl.innerHTML = trendRows.join('');

      // 生成文字总结
      var summary = year + '年' + month + '月工作总结：本月新增订单 ' + monthOrderCount + ' 个，合同金额 ' + fmtMoney(monthAmount) + '；累计订单 ' + totalOrders + ' 个，已完成 ' + completedOrders + ' 个，进行中 ' + inProgress + ' 个；本月任务完成率 ' + taskRate + '%（' + monthTaskDone + '/' + monthTaskTotal + '）。';
      $('#report-summary').textContent = summary;

      // 缓存数据供导出
      lastReportData = { year: year, month: month, monthStr: monthStr, orders: orders, tasks: tasks, monthOrders: monthOrders, monthTasks: monthTasks, totalOrders: totalOrders, monthOrderCount: monthOrderCount, completedOrders: completedOrders, inProgress: inProgress, monthTaskDone: monthTaskDone, monthTaskTotal: monthTaskTotal, taskRate: taskRate, totalAmount: totalAmount, monthAmount: monthAmount, spStats: spStats };

      // 显示导出按钮
      var exportBtn = $('#btn-export-excel');
      if (exportBtn) {
        exportBtn.style.display = (monthTasks.length > 0) ? '' : 'none';
      }

    } catch (e) {
      console.error('renderReport error:', e);
      showToast('月报生成失败，请重试', 'error');
    }
  }

  // ========== 导出 Excel ==========
  function exportReportExcel() {
    if (!lastReportData) {
      showToast('请先点击"生成月报"', 'error');
      return;
    }

    var d = lastReportData;
    var year = d.year;
    var month = d.month;

    // Sheet1: 月报概览
    var overviewData = [
      [year + '年' + month + '月 工作月报'],
      [''],
      ['统计项', '数据'],
      ['本月新增订单', d.monthOrderCount],
      ['本月合同金额', fmtMoney(d.monthAmount)],
      ['累计订单总数', d.totalOrders],
      ['已完成订单', d.completedOrders],
      ['进行中订单', d.inProgress],
      ['累计合同金额', fmtMoney(d.totalAmount)],
      ['本月任务总数', d.monthTaskTotal],
      ['本月完成任务', d.monthTaskDone],
      ['本月任务完成率', d.taskRate + '%'],
      [''],
      ['销售员', '订单总数', '已完成', '进行中', '合同金额']
    ];

    var spKeys = Object.keys(d.spStats);
    for (var i = 0; i < spKeys.length; i++) {
      var name = spKeys[i];
      var s = d.spStats[name];
      overviewData.push([name, s.total, s.completed, s.inProgress, fmtMoney(s.amount)]);
    }

    overviewData.push(['']);
    overviewData.push(['报告生成时间', new Date().toLocaleString('zh-CN')]);

    // Sheet2: 本月每日任务明细
    var taskData = [
      [year + '年' + month + '月 每日任务明细'],
      [''],
      ['日期', '任务名称', '描述', '优先级', '状态', '关联订单', '销售员']
    ];

    if (d.monthTasks.length === 0) {
      taskData.push(['无数据', '', '', '', '', '', '']);
    } else {
      // 按日期排序
      var sortedTasks = d.monthTasks.slice().sort(function(a, b) {
        return (a.date || '').localeCompare(b.date || '');
      });
      for (var j = 0; j < sortedTasks.length; j++) {
        var t = sortedTasks[j];
        taskData.push([
          t.date || '-',
          t.title || '',
          t.description || '',
          priorityLabel(t.priority),
          t.completed ? '✓ 已完成' : '○ 未完成',
          t.relatedOrder || '',
          t.salesperson || ''
        ]);
      }
    }

    // Sheet3: 本月订单明细
    var orderData = [
      [year + '年' + month + '月 订单明细'],
      [''],
      ['订单号', '项目名称', '客户', '销售员', '方案号', '合同金额', '创建日期', '状态', '备注']
    ];

    if (d.monthOrders.length === 0) {
      orderData.push(['无数据', '', '', '', '', '', '', '', '']);
    } else {
      var sortedOrders = d.monthOrders.slice().sort(function(a, b) {
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });
      for (var k = 0; k < sortedOrders.length; k++) {
        var o = sortedOrders[k];
        orderData.push([
          o.orderNumber || '',
          o.projectName || '',
          o.customer || '',
          o.salesperson || '',
          o.proposalNumber || '',
          fmtMoney(o.contractAmount),
          o.createdAt || '',
          (o.status || 'active') === 'completed' ? '已完成' : '进行中',
          o.remark || ''
        ]);
      }
    }

    // 构建工作簿
    try {
      var wb = XLSX.utils.book_new();
      var ws1 = XLSX.utils.aoa_to_sheet(overviewData);
      var ws2 = XLSX.utils.aoa_to_sheet(taskData);
      var ws3 = XLSX.utils.aoa_to_sheet(orderData);

      // 设置列宽
      ws2['!cols'] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 40 },
        { wch: 10 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 }
      ];
      ws3['!cols'] = [
        { wch: 16 },
        { wch: 30 },
        { wch: 28 },
        { wch: 10 },
        { wch: 16 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 30 }
      ];

      XLSX.utils.book_append_sheet(wb, ws1, '月报概览');
      XLSX.utils.book_append_sheet(wb, ws2, '每日任务');
      XLSX.utils.book_append_sheet(wb, ws3, '本月订单');

      var filename = year + '年' + month + '月工作月报.xlsx';
      XLSX.writeFile(wb, filename);
      showToast('月报已导出：' + filename, 'success');
    } catch (e) {
      console.error('exportReportExcel error:', e);
      showToast('导出失败：' + (e.message || '未知错误'), 'error');
    }
  }

  // ========== 辅助函数 ==========
  function priorityLabel(p) {
    var map = { high: '高优先', medium: '中优先', low: '低优先' };
    return map[p] || p;
  }

  function priorityTag(p) {
    var map = { high: 'tag-red', medium: 'tag-orange', low: 'tag-gray' };
    return map[p] || 'tag-gray';
  }

  function phaseTag(phase) {
    var map = {
      '前期评审环节': 'tag-blue',
      '下单环节': 'tag-purple',
      '发货环节': 'tag-green',
      '已完成': 'tag-gray'
    };
    return map[phase] || 'tag-gray';
  }

  function phaseShort(phase) {
    var map = {
      '前期评审环节': '前期评审',
      '下单环节': '下单中',
      '发货环节': '发货中',
      '已完成': '已完成'
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
    var todayTasks = Store.getTasksByDate(todayStr());
    var pending = todayTasks.filter(function(t) { return !t.completed; }).length;
    var badge = $('#nav-task-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? '' : 'none';
    }
  }

  // ========== 云端状态 ==========
  function updateCloudStatus(status, message) {
    var statusEl = $('#cloud-status');
    if (!statusEl) return;
    var dot = statusEl.querySelector('.cloud-dot');
    var text = statusEl.querySelector('.cloud-text');
    dot.className = 'cloud-dot ' + status;
    text.textContent = message;
  }

  // ========== 云端设置 ==========
  function initCloudSettings() {
    var modal = $('#cloud-modal');
    var btnSettings = $('#btn-cloud-settings');
    var btnConnect = $('#btn-cloud-connect');
    var btnDisconnect = $('#btn-cloud-disconnect');
    var btnCopySql = $('#btn-copy-sql');
    var resultEl = $('#cloud-test-result');

    btnSettings.addEventListener('click', function() {
      if (typeof Cloud !== 'undefined' && Cloud.configured) {
        var config = Cloud.getConfig();
        $('#supabase-url').value = config.url || '';
        $('#supabase-key').value = config.key || '';
        btnDisconnect.style.display = '';
        btnConnect.textContent = '重新连接';
      } else {
        btnDisconnect.style.display = 'none';
        btnConnect.textContent = '连接并同步';
      }
      resultEl.innerHTML = '';
      modal.classList.add('show');
    });

    btnCopySql.addEventListener('click', function() {
      var sql = $('#cloud-sql-box').textContent;
      navigator.clipboard.writeText(sql).then(function() {
        showToast('SQL 已复制，粘贴到 Supabase 中运行', 'success');
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = sql;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('SQL 已复制', 'success');
      });
    });

    btnConnect.addEventListener('click', async function() {
      var url = $('#supabase-url').value.trim();
      var key = $('#supabase-key').value.trim();

      if (!url || !key) {
        resultEl.innerHTML = '<div class="cloud-test-fail">请填写 Project URL 和 anon key</div>';
        return;
      }

      btnConnect.disabled = true;
      btnConnect.textContent = '正在连接...';
      resultEl.innerHTML = '<div class="cloud-test-loading">正在测试连接...</div>';

      var result = await Cloud.testConnection(url, key);

      if (result.success) {
        Cloud.setConfig(url, key);
        resultEl.innerHTML = '<div class="cloud-test-success">连接成功！正在同步数据...</div>';

        var syncResult = await Cloud.initialSync();
        if (syncResult.synced && syncResult.direction === 'download') {
          localStorage.setItem('workbench_orders', JSON.stringify(syncResult.orders));
          localStorage.setItem('workbench_tasks', JSON.stringify(syncResult.tasks));
        }

        btnConnect.disabled = false;
        btnConnect.textContent = '重新连接';
        btnDisconnect.style.display = '';
        updateCloudStatus('connected', '已连接云端');

        setTimeout(function() {
          modal.classList.remove('show');
          showToast('云端同步已开启', 'success');
          navigate(currentPage);
        }, 1500);
      } else {
        btnConnect.disabled = false;
        btnConnect.textContent = '连接并同步';
        resultEl.innerHTML = '<div class="cloud-test-fail">连接失败：' + escapeHtml(result.message) + '</div>';
      }
    });

    btnDisconnect.addEventListener('click', function() {
      if (!confirm('断开云端同步？本地数据保留，但不再同步到云端。')) return;
      Cloud.clearConfig();
      updateCloudStatus('local', '本地存储');
      btnDisconnect.style.display = 'none';
      btnConnect.textContent = '连接并同步';
      resultEl.innerHTML = '<div class="cloud-test-info">已断开云端同步，数据存储在本地浏览器</div>';
      showToast('已断开云端同步', 'success');
    });
  }

  // ========== 初始化 ==========
  async function init() {
    try {
      var loading = $('#loading-overlay');
      if (loading) loading.style.display = 'flex';

      if (typeof Cloud !== 'undefined') {
        Cloud.setStatusCallback(updateCloudStatus);
      }

      await Store.init();

      if (typeof Cloud !== 'undefined' && Cloud.configured) {
        updateCloudStatus('connected', '已连接云端');
      } else {
        updateCloudStatus('local', '本地存储');
      }

      if (loading) loading.style.display = 'none';
    } catch (e) {
      console.error('init error:', e);
      var loading = $('#loading-overlay');
      if (loading) loading.style.display = 'none';
      // 确保本地数据存在，继续正常运行
      if (!localStorage.getItem('workbench_orders')) {
        localStorage.setItem('workbench_orders', '[]');
      }
      if (!localStorage.getItem('workbench_tasks')) {
        localStorage.setItem('workbench_tasks', '[]');
      }
    }

    // 云端设置（独立 try-catch，失败不影响主功能）
    try {
      initCloudSettings();
    } catch (e) {
      console.error('initCloudSettings error:', e);
    }

    // 导航绑定
    $$('.nav-item[data-page]').forEach(function(item) {
      item.addEventListener('click', function() { navigate(item.dataset.page); });
    });

    // 顶栏日期
    $('#topbar-date').textContent = todayDisplay();

    // 任务页日期切换
    $('#task-date-input').addEventListener('change', function(e) {
      taskFilterDate = e.target.value;
      renderTasks();
    });

    // 订单筛选
    $('#order-filter-sp').addEventListener('change', function(e) {
      orderFilter.salesperson = e.target.value;
      renderOrders();
    });
    $('#order-filter-phase').addEventListener('change', function(e) {
      orderFilter.phase = e.target.value;
      renderOrders();
    });
    $('#order-search').addEventListener('input', function(e) {
      orderFilter.keyword = e.target.value;
      renderOrders();
    });

    // 订单状态标签页
    $$('#order-status-tabs .status-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        orderFilter.status = tab.dataset.status;
        renderOrders();
      });
    });

    // 模态框关闭
    $$('.modal-close, .modal-overlay').forEach(function(el) {
      el.addEventListener('click', function(e) {
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
    $('#btn-archive-order').addEventListener('click', archiveOrder);
    $('#btn-restore-order').addEventListener('click', restoreOrder);
    $('#btn-delete-order').addEventListener('click', deleteOrder);
    $('#btn-back-orders').addEventListener('click', backToOrders);
    $('#btn-save-step').addEventListener('click', saveStep);
    $('#btn-generate-report').addEventListener('click', renderReport);
    $('#btn-export-excel').addEventListener('click', exportReportExcel);

    // 重置数据
    $('#btn-reset-data').addEventListener('click', function() {
      if (confirm('确认重置所有数据？这将清除所有自定义数据并恢复示例数据。')) {
        Store.resetAll();
        showToast('数据已重置', 'success');
        navigate('dashboard');
      }
    });

    // 默认显示首页
    navigate('dashboard');
  }

  // ========== 暴露API ==========
  window.App = {
    toggleTask: toggleTask,
    viewOrder: viewOrder,
    openStepModal: openStepModal,
    saveStep: saveStep,
    revertStep: revertStep,
    editTask: editTask,
    deleteTask: deleteTask,
    openOrderModal: openOrderModal,
    editOrder: editOrder,
    deleteOrder: deleteOrder,
    archiveOrder: archiveOrder,
    restoreOrder: restoreOrder,
    backToOrders: backToOrders
  };

  // DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
