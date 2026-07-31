/**
 * 数据存储层 - 使用 localStorage 持久化
 * 管理订单、任务、月报数据
 */

// ========== 订单流程定义 ==========
const WORKFLOW = {
  phases: [
    {
      id: 'review',
      name: '前期评审环节',
      color: '#3b82f6',
      steps: [
        { key: 'project_init', name: '立项（取方案号）', required: true, desc: '项目立项，获取方案编号' },
        { key: 'bid_review', name: '标书评审', required: false, desc: '标书评审（部分项目无标书可跳过）' },
        { key: 'bid_stamp', name: '标书盖章', required: false, desc: '标书盖章（无标书则跳过）' },
        { key: 'contract_biz', name: '合同评审-商务评审', required: true, desc: '合同商务条款评审' },
        { key: 'contract_tech', name: '合同评审-技术评审', required: true, desc: '合同技术条款评审' },
        { key: 'contract_stamp', name: '合同盖章', required: true, desc: '合同盖章确认' },
      ]
    },
    {
      id: 'order',
      name: '下单环节',
      color: '#8b5cf6',
      steps: [
        { key: 'make_production_order', name: '制作生产订单', required: true, desc: '制作生产订单文件' },
        { key: 'order_meeting', name: '召开新订单沟通会', required: false, desc: '组织召开新订单沟通会议' },
        { key: 'send_minutes', name: '发送纪要（邮件）', required: false, desc: '会议结束后发送会议纪要邮件' },
        { key: 'place_order', name: '取订单号下单', required: true, desc: '找技术部签名后发下单通知邮件' },
        { key: 'u8_add_inventory', name: 'U8系统新增存货', required: true, desc: '在U8系统中新增存货档案' },
        { key: 'u8_add_sales_order', name: 'U8系统新增销售订单', required: true, desc: '存货审核通过后在U8新增销售订单' },
        { key: 'order_change_notice', name: '订单变更通知', required: false, desc: '如有变更则发送变更通知' },
        { key: 'u8_change_inventory', name: 'U8系统变更存货', required: false, desc: '如变更大项则在U8变更存货' },
        { key: 'fat', name: 'FAT', required: false, desc: '如需进行FAT验收' },
      ]
    },
    {
      id: 'shipping',
      name: '发货环节',
      color: '#10b981',
      steps: [
        { key: 'make_shipping_order', name: '制作发货单', required: true, desc: '制作发货单据' },
        { key: 'shipping_notice', name: '发货通知', required: true, desc: '发送发货通知' },
        { key: 'u8_shipping', name: 'U8系统发货', required: true, desc: '在U8系统中完成发货操作' },
      ]
    }
  ]
};

// 获取所有步骤的扁平列表
const ALL_STEPS = WORKFLOW.phases.flatMap(p => p.steps.map(s => ({ ...s, phaseId: p.id, phaseName: p.name, phaseColor: p.color })));

// 步骤key到名称的映射
const STEP_MAP = {};
ALL_STEPS.forEach(s => { STEP_MAP[s.key] = s; });

// ========== 示例数据 ==========
const SAMPLE_ORDERS = [
  {
    id: 'ord_001',
    orderNumber: 'DD202607001',
    projectName: '智慧园区安防系统',
    customer: '深圳市科创科技有限公司',
    salesperson: '张伟',
    proposalNumber: 'FA202607001',
    contractAmount: 580000,
    createdAt: '2026-06-15',
    status: 'active',
    remark: '重点项目，需加快进度',
    steps: {
      'project_init': { status: 'completed', date: '2026-06-15', note: '方案号FA202607001' },
      'bid_review': { status: 'completed', date: '2026-06-18', note: '标书评审通过' },
      'bid_stamp': { status: 'completed', date: '2026-06-20', note: '' },
      'contract_biz': { status: 'completed', date: '2026-06-25', note: '商务条款确认' },
      'contract_tech': { status: 'completed', date: '2026-06-27', note: '技术参数确认' },
      'contract_stamp': { status: 'completed', date: '2026-06-30', note: '' },
      'make_production_order': { status: 'completed', date: '2026-07-02', note: '' },
      'order_meeting': { status: 'completed', date: '2026-07-05', note: '参会人员齐' },
      'send_minutes': { status: 'completed', date: '2026-07-05', note: '已发邮件' },
      'place_order': { status: 'completed', date: '2026-07-08', note: '技术部已签' },
      'u8_add_inventory': { status: 'completed', date: '2026-07-10', note: '' },
      'u8_add_sales_order': { status: 'current', date: '', note: '等待存货审核' },
      'order_change_notice': { status: 'pending', date: '', note: '' },
      'u8_change_inventory': { status: 'pending', date: '', note: '' },
      'fat': { status: 'pending', date: '', note: '' },
      'make_shipping_order': { status: 'pending', date: '', note: '' },
      'shipping_notice': { status: 'pending', date: '', note: '' },
      'u8_shipping': { status: 'pending', date: '', note: '' },
    }
  },
  {
    id: 'ord_002',
    orderNumber: 'DD202607002',
    projectName: '工业自动化产线改造',
    customer: '广州精密制造有限公司',
    salesperson: '李娜',
    proposalNumber: 'FA202607002',
    contractAmount: 1200000,
    createdAt: '2026-07-01',
    status: 'active',
    remark: '',
    steps: {
      'project_init': { status: 'completed', date: '2026-07-01', note: '' },
      'bid_review': { status: 'skipped', date: '', note: '无标书' },
      'bid_stamp': { status: 'skipped', date: '', note: '无标书' },
      'contract_biz': { status: 'completed', date: '2026-07-05', note: '' },
      'contract_tech': { status: 'current', date: '', note: '技术评审中' },
      'contract_stamp': { status: 'pending', date: '', note: '' },
      'make_production_order': { status: 'pending', date: '', note: '' },
      'order_meeting': { status: 'pending', date: '', note: '' },
      'send_minutes': { status: 'pending', date: '', note: '' },
      'place_order': { status: 'pending', date: '', note: '' },
      'u8_add_inventory': { status: 'pending', date: '', note: '' },
      'u8_add_sales_order': { status: 'pending', date: '', note: '' },
      'order_change_notice': { status: 'pending', date: '', note: '' },
      'u8_change_inventory': { status: 'pending', date: '', note: '' },
      'fat': { status: 'pending', date: '', note: '' },
      'make_shipping_order': { status: 'pending', date: '', note: '' },
      'shipping_notice': { status: 'pending', date: '', note: '' },
      'u8_shipping': { status: 'pending', date: '', note: '' },
    }
  },
  {
    id: 'ord_003',
    orderNumber: 'DD202607003',
    projectName: '数据中心机房建设',
    customer: '北京云服务股份有限公司',
    salesperson: '张伟',
    proposalNumber: 'FA202607003',
    contractAmount: 850000,
    createdAt: '2026-07-10',
    status: 'active',
    remark: '客户催促尽快发货',
    steps: {
      'project_init': { status: 'completed', date: '2026-07-10', note: '' },
      'bid_review': { status: 'completed', date: '2026-07-12', note: '' },
      'bid_stamp': { status: 'completed', date: '2026-07-13', note: '' },
      'contract_biz': { status: 'completed', date: '2026-07-15', note: '' },
      'contract_tech': { status: 'completed', date: '2026-07-16', note: '' },
      'contract_stamp': { status: 'completed', date: '2026-07-18', note: '' },
      'make_production_order': { status: 'completed', date: '2026-07-20', note: '' },
      'order_meeting': { status: 'completed', date: '2026-07-22', note: '' },
      'send_minutes': { status: 'completed', date: '2026-07-22', note: '' },
      'place_order': { status: 'completed', date: '2026-07-24', note: '' },
      'u8_add_inventory': { status: 'completed', date: '2026-07-25', note: '' },
      'u8_add_sales_order': { status: 'completed', date: '2026-07-26', note: '' },
      'order_change_notice': { status: 'completed', date: '2026-07-27', note: '数量微调' },
      'u8_change_inventory': { status: 'pending', date: '', note: '' },
      'fat': { status: 'current', date: '', note: '安排FAT验收中' },
      'make_shipping_order': { status: 'pending', date: '', note: '' },
      'shipping_notice': { status: 'pending', date: '', note: '' },
      'u8_shipping': { status: 'pending', date: '', note: '' },
    }
  },
  {
    id: 'ord_004',
    orderNumber: 'DD202606018',
    projectName: '智能仓储管理系统',
    customer: '上海物流集团',
    salesperson: '王强',
    proposalNumber: 'FA202606018',
    contractAmount: 430000,
    createdAt: '2026-06-05',
    status: 'completed',
    remark: '已全部完成',
    steps: {
      'project_init': { status: 'completed', date: '2026-06-05', note: '' },
      'bid_review': { status: 'completed', date: '2026-06-08', note: '' },
      'bid_stamp': { status: 'completed', date: '2026-06-09', note: '' },
      'contract_biz': { status: 'completed', date: '2026-06-12', note: '' },
      'contract_tech': { status: 'completed', date: '2026-06-13', note: '' },
      'contract_stamp': { status: 'completed', date: '2026-06-15', note: '' },
      'make_production_order': { status: 'completed', date: '2026-06-18', note: '' },
      'order_meeting': { status: 'completed', date: '2026-06-20', note: '' },
      'send_minutes': { status: 'completed', date: '2026-06-20', note: '' },
      'place_order': { status: 'completed', date: '2026-06-22', note: '' },
      'u8_add_inventory': { status: 'completed', date: '2026-06-24', note: '' },
      'u8_add_sales_order': { status: 'completed', date: '2026-06-25', note: '' },
      'order_change_notice': { status: 'skipped', date: '', note: '无变更' },
      'u8_change_inventory': { status: 'skipped', date: '', note: '无变更' },
      'fat': { status: 'skipped', date: '', note: '无需FAT' },
      'make_shipping_order': { status: 'completed', date: '2026-06-28', note: '' },
      'shipping_notice': { status: 'completed', date: '2026-06-29', note: '' },
      'u8_shipping': { status: 'completed', date: '2026-06-30', note: '' },
    }
  },
];

const SAMPLE_TASKS = [
  { id: 'task_001', title: '跟进DD202607001订单U8销售订单录入', description: '等待存货审核通过后录入销售订单', date: '2026-07-28', priority: 'high', completed: false, relatedOrder: 'ord_001' },
  { id: 'task_002', title: '准备DD202607002合同技术评审材料', description: '整理技术参数清单提交技术部评审', date: '2026-07-28', priority: 'high', completed: false, relatedOrder: 'ord_002' },
  { id: 'task_003', title: '联系客户确认FAT验收时间', description: 'DD202607003项目FAT验收安排', date: '2026-07-28', priority: 'medium', completed: false, relatedOrder: 'ord_003' },
  { id: 'task_004', title: '发送上周订单沟通会纪要邮件', description: '整理并发送会议纪要', date: '2026-07-28', priority: 'medium', completed: true, relatedOrder: '' },
  { id: 'task_005', title: '跟进U8系统存货审核进度', description: '联系财务部确认审核时间', date: '2026-07-29', priority: 'low', completed: false, relatedOrder: 'ord_001' },
];

// ========== 存储管理 ==========
const STORAGE_KEYS = {
  orders: 'workbench_orders',
  tasks: 'workbench_tasks',
  meta: 'workbench_meta'
};

const Store = {
  // 初始化（异步，支持云端同步）
  async init() {
    // 初始化云端客户端
    if (typeof Cloud !== 'undefined') {
      Cloud.initClient();
    }

    // 确保本地有数据（兜底，先于云端同步执行）
    if (!localStorage.getItem(STORAGE_KEYS.orders)) {
      localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(SAMPLE_ORDERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.tasks)) {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(SAMPLE_TASKS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.meta)) {
      localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({}));
    }

    // 如果云端已配置，进行合并同步（不覆盖本地数据）
    if (typeof Cloud !== 'undefined' && Cloud.configured) {
      const result = await Cloud.initialSync();
      if (result.synced) {
        if (result.direction === 'download') {
          // 云端有数据：按 ID 合并，云端和本地都不丢
          this._mergeCloudData(result.orders || [], result.tasks || []);
        }
        // direction === 'upload': 本地数据已上传到云端，无需额外操作
        // direction === 'error': 同步失败，使用本地数据，无需操作
      }
    }
  },

  // 合并云端数据（云端优先，确保多设备数据一致）
  _mergeCloudData(cloudOrders, cloudTasks) {
    const localOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || '[]');
    const localTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || '[]');

    // 合并订单：云端优先覆盖本地同 ID 数据，本地独有的上传到云端
    const cloudOrderIds = new Set(cloudOrders.map(co => co.id));
    const localOnlyOrders = localOrders.filter(lo => !cloudOrderIds.has(lo.id));
    const mergedOrders = [...cloudOrders, ...localOnlyOrders];
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(mergedOrders));

    // 合并任务：同理，云端优先
    const cloudTaskIds = new Set(cloudTasks.map(ct => ct.id));
    const localOnlyTasks = localTasks.filter(lt => !cloudTaskIds.has(lt.id));
    const mergedTasks = [...cloudTasks, ...localOnlyTasks];
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(mergedTasks));

    // 上传本地独有的到云端
    if (localOnlyOrders.length > 0 || localOnlyTasks.length > 0) {
      if (typeof Cloud !== 'undefined') {
        localOnlyOrders.forEach(o => Cloud.upsertOrder(o));
        localOnlyTasks.forEach(t => Cloud.upsertTask(t));
      }
    }
  },

  // 重置数据
  resetAll() {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(SAMPLE_ORDERS));
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(SAMPLE_TASKS));
    localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({}));
    // 同步到云端
    if (typeof Cloud !== 'undefined' && Cloud.configured) {
      SAMPLE_ORDERS.forEach(o => Cloud.upsertOrder(o));
      SAMPLE_TASKS.forEach(t => Cloud.upsertTask(t));
    }
  },

  // ========== 订单 ==========
  getOrders() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.orders) || '[]');
  },

  getOrder(id) {
    return this.getOrders().find(o => o.id === id);
  },

  saveOrders(orders) {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
  },

  addOrder(order) {
    const orders = this.getOrders();
    order.id = 'ord_' + Date.now();
    order.createdAt = new Date().toISOString().split('T')[0];
    order.status = order.status || 'active';
    // 初始化所有步骤
    order.steps = {};
    ALL_STEPS.forEach(s => {
      order.steps[s.key] = { status: 'pending', date: '', note: '' };
    });
    // 第一步设为当前
    order.steps[ALL_STEPS[0].key] = { status: 'current', date: '', note: '' };
    orders.unshift(order);
    this.saveOrders(orders);
    if (typeof Cloud !== 'undefined') Cloud.upsertOrder(order);
    return order;
  },

  updateOrder(id, updates) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...updates };
      this.saveOrders(orders);
      if (typeof Cloud !== 'undefined') Cloud.upsertOrder(orders[idx]);
      return orders[idx];
    }
    return null;
  },

  deleteOrder(id) {
    const orders = this.getOrders().filter(o => o.id !== id);
    this.saveOrders(orders);
    if (typeof Cloud !== 'undefined') Cloud.deleteOrder(id);
  },

  archiveOrder(id) {
    return this.updateOrder(id, { status: 'completed' });
  },

  restoreOrder(id) {
    return this.updateOrder(id, { status: 'active' });
  },

  getActiveOrders() {
    return this.getOrders().filter(o => (o.status || 'active') === 'active');
  },

  getCompletedOrders() {
    return this.getOrders().filter(o => o.status === 'completed');
  },

  updateStep(orderId, stepKey, status, date, note) {
    const orders = this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.steps[stepKey] = { status, date, note: note || '' };
      // 自动推进current状态
      if (status === 'completed') {
        const stepList = ALL_STEPS;
        const currentIdx = stepList.findIndex(s => s.key === stepKey);
        // 找下一个非跳过的步骤
        for (let i = currentIdx + 1; i < stepList.length; i++) {
          if (order.steps[stepList[i].key].status === 'pending') {
            order.steps[stepList[i].key].status = 'current';
            break;
          }
        }
      }
      this.saveOrders(orders);
      if (typeof Cloud !== 'undefined') Cloud.upsertOrder(order);
    }
  },

  // 获取订单当前阶段
  getOrderPhase(order) {
    const steps = ALL_STEPS;
    for (let i = 0; i < steps.length; i++) {
      const s = order.steps[steps[i].key];
      if (s.status === 'current' || s.status === 'pending') {
        return steps[i].phaseName;
      }
    }
    return '已完成';
  },

  // 获取订单进度百分比
  getOrderProgress(order) {
    // 所有步骤都参与进度计算，skipped（不需要）等同于完成
    const completed = ALL_STEPS.filter(s => {
      var st = order.steps[s.key];
      return st.status === 'completed' || st.status === 'skipped';
    }).length;
    return Math.round((completed / ALL_STEPS.length) * 100);
  },

  // 获取销售员列表
  getSalespersons() {
    const orders = this.getOrders();
    return [...new Set(orders.map(o => o.salesperson))];
  },

  // ========== 任务 ==========
  getTasks() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || '[]');
  },

  getTasksByDate(date) {
    return this.getTasks().filter(t => t.date === date);
  },

  addTask(task) {
    const tasks = this.getTasks();
    task.id = 'task_' + Date.now();
    task.createdAt = task.date; // 记录原始创建日期，用于顺延标注
    tasks.unshift(task);
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    if (typeof Cloud !== 'undefined') Cloud.upsertTask(task);
    return task;
  },

  updateTask(id, updates) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
      if (typeof Cloud !== 'undefined') Cloud.upsertTask(tasks[idx]);
      return tasks[idx];
    }
    return null;
  },

  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    if (typeof Cloud !== 'undefined') Cloud.deleteTask(id);
  },

  toggleTask(id) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
      if (typeof Cloud !== 'undefined') Cloud.upsertTask(task);
    }
  },

  // 前一天未完成的任务自动顺延到今天，直到完成为止
  carryOverPendingTasks() {
    const tasks = this.getTasks();
    const today = new Date().toISOString().split('T')[0];
    let carriedCount = 0;
    let needSave = false;

    for (let i = 0; i < tasks.length; i++) {
      var t = tasks[i];

      // 给所有没有 createdAt 的历史任务补上
      if (!t.createdAt && t.date) {
        t.createdAt = t.date;
        needSave = true;
      }

      if (!t.completed && t.date && t.date < today) {
        t.date = today;
        carriedCount++;
        if (typeof Cloud !== 'undefined') Cloud.upsertTask(t);
      }
    }

    if (carriedCount > 0 || needSave) {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
    }
    return carriedCount;
  },

  // 任务完成时自动同步到关联订单的对应步骤（支持一个任务匹配多个步骤）
  syncTaskToOrderStep(task) {
    if (!task.relatedOrder || !task.completed) return null;

    var stepKeys = this._matchStepFromTitle(task.title);
    if (!stepKeys || stepKeys.length === 0) return null;

    var order = this.getOrder(task.relatedOrder);
    if (!order) return null;

    var today = new Date().toISOString().split('T')[0];
    var results = [];

    for (var i = 0; i < stepKeys.length; i++) {
      var stepKey = stepKeys[i];
      // 如果步骤已经是完成或跳过状态，不重复更新
      var currentStatus = order.steps[stepKey] ? order.steps[stepKey].status : 'pending';
      if (currentStatus === 'completed' || currentStatus === 'skipped') continue;

      var step = STEP_MAP[stepKey];
      this.updateStep(order.id, stepKey, 'completed', today, '任务完成自动同步');
      results.push({ stepName: step.name, orderNumber: order.orderNumber, orderId: order.id });
    }

    return results.length > 0 ? results : null;
  },

  // 从任务标题中匹配订单流程步骤（返回所有匹配的步骤key数组）
  _matchStepFromTitle(title) {
    var lowerTitle = title.toLowerCase();

    // 每个步骤的匹配关键词
    var stepKeywords = {
      'project_init': ['立项', '方案号'],
      'bid_review': ['标书评审'],
      'bid_stamp': ['标书盖章'],
      'contract_biz': ['商务评审'],
      'contract_tech': ['技术评审'],
      'contract_stamp': ['合同盖章'],
      'make_production_order': ['生产订单'],
      'order_meeting': ['沟通会'],
      'send_minutes': ['会议纪要', '纪要'],
      'place_order': ['取订单号', '下单通知', '下单'],
      'u8_add_inventory': ['新增存货'],
      'u8_add_sales_order': ['新增销售订单', '销售订单录入', '销售订单'],
      'order_change_notice': ['变更通知'],
      'u8_change_inventory': ['变更存货'],
      'fat': ['fat'],
      'make_shipping_order': ['发货单'],
      'shipping_notice': ['发货通知'],
      'u8_shipping': ['系统发货', 'u8发货'],
    };

    var matchedKeys = [];
    var keys = Object.keys(stepKeywords);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var kws = stepKeywords[key];
      for (var j = 0; j < kws.length; j++) {
        if (lowerTitle.indexOf(kws[j].toLowerCase()) !== -1) {
          matchedKeys.push(key);
          break; // 每个步骤只匹配一次
        }
      }
    }

    return matchedKeys;
  },
};

// 导出
if (typeof window !== 'undefined') {
  window.WORKFLOW = WORKFLOW;
  window.ALL_STEPS = ALL_STEPS;
  window.STEP_MAP = STEP_MAP;
  window.Store = Store;
}
