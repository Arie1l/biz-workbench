/**
 * 云端数据同步层 - Supabase
 * 负责与云端数据库的同步操作
 * 本地 localStorage 作为缓存，云端作为持久化存储
 */

const SUPABASE_CONFIG_KEY = 'workbench_supabase_config';

// 内置 Supabase 配置（所有设备自动连接）
const BUILTIN_SUPABASE_URL = 'https://cxasxsazkdkshooaesvq.supabase.co';
const BUILTIN_SUPABASE_KEY = 'sb_publishable_Ky6jOnq8Ah-PD0xuAn0-Gw_Oc2x4mhl';

const Cloud = {
  client: null,
  configured: false,
  onStatusChange: null, // 状态变化回调

  // 清理 Supabase URL，只保留 https://xxx.supabase.co 格式
  _cleanUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return '';
    // 自动补 https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    // 去掉多余的路径（只保留到 .co）
    try {
      const u = new URL(url);
      url = u.protocol + '//' + u.hostname;
    } catch (e) {
      // URL 解析失败，尝试简单处理
      const m = url.match(/^(https?:\/\/[^\/]+)/);
      if (m) url = m[1];
      // 去掉末尾斜杠
      url = url.replace(/\/+$/, '');
    }
    return url;
  },

  // 设置状态变化回调
  setStatusCallback(cb) {
    this.onStatusChange = cb;
  },

  // 通知状态变化
  _notifyStatus(status, message) {
    if (this.onStatusChange) {
      this.onStatusChange(status, message);
    }
  },

  // 获取配置（优先 localStorage，无则用内置）
  getConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || 'null');
      if (saved && saved.url && saved.key) return saved;
    } catch {}
    // 使用内置配置
    return { url: BUILTIN_SUPABASE_URL, key: BUILTIN_SUPABASE_KEY };
  },

  // 保存配置并初始化客户端
  setConfig(url, key) {
    const cleanedUrl = this._cleanUrl(url);
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url: cleanedUrl, key }));
    this.initClient();
  },

  // 清除配置
  clearConfig() {
    localStorage.removeItem(SUPABASE_CONFIG_KEY);
    this.client = null;
    this.configured = false;
  },

  // 初始化 Supabase 客户端（使用内置或保存的配置）
  initClient() {
    const config = this.getConfig();
    if (config && config.url && config.key && typeof supabase !== 'undefined') {
      try {
        this.client = supabase.createClient(config.url, config.key);
        this.configured = true;
        this._notifyStatus('connected', '已连接云端');
      } catch (e) {
        console.error('Cloud: initClient error', e);
        this.configured = false;
        this._notifyStatus('error', '连接失败');
      }
    } else {
      this.configured = false;
      if (typeof supabase === 'undefined') {
        console.warn('Cloud: supabase SDK not loaded');
      }
    }
  },

  // ========== 数据映射 ==========
  _mapOrderFromDB(row) {
    return {
      id: row.id,
      orderNumber: row.order_number || '',
      projectName: row.project_name || '',
      customer: row.customer || '',
      salesperson: row.salesperson || '',
      proposalNumber: row.proposal_number || '',
      contractAmount: Number(row.contract_amount) || 0,
      createdAt: row.created_at || '',
      status: row.status || 'active',
      remark: row.remark || '',
      steps: row.steps || {},
    };
  },

  _mapOrderToDB(order) {
    return {
      id: order.id,
      order_number: order.orderNumber,
      project_name: order.projectName,
      customer: order.customer,
      salesperson: order.salesperson,
      proposal_number: order.proposalNumber || '',
      contract_amount: order.contractAmount || 0,
      created_at: order.createdAt || '',
      status: order.status || 'active',
      remark: order.remark || '',
      steps: order.steps || {},
    };
  },

  _mapTaskFromDB(row) {
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      date: row.date || '',
      priority: row.priority || 'medium',
      completed: row.completed || false,
      relatedOrder: row.related_order || '',
      salesperson: row.salesperson || '',
    };
  },

  _mapTaskToDB(task) {
    return {
      id: task.id,
      title: task.title,
      description: task.description || '',
      date: task.date,
      priority: task.priority,
      completed: task.completed,
      related_order: task.relatedOrder || '',
      salesperson: task.salesperson || '',
    };
  },

  // ========== 云端操作 ==========
  async fetchOrders() {
    if (!this.configured) return null;
    try {
      const { data, error } = await this.client.from('orders').select('*');
      if (error) { console.error('Cloud: fetchOrders error', error); return null; }
      return data.map(row => this._mapOrderFromDB(row));
    } catch (e) {
      console.error('Cloud: fetchOrders exception', e);
      return null;
    }
  },

  async fetchTasks() {
    if (!this.configured) return null;
    try {
      const { data, error } = await this.client.from('tasks').select('*');
      if (error) { console.error('Cloud: fetchTasks error', error); return null; }
      return data.map(row => this._mapTaskFromDB(row));
    } catch (e) {
      console.error('Cloud: fetchTasks exception', e);
      return null;
    }
  },

  async upsertOrder(order) {
    if (!this.configured) return;
    try {
      const { error } = await this.client.from('orders').upsert(this._mapOrderToDB(order));
      if (error) console.error('Cloud: upsertOrder error', error);
    } catch (e) {
      console.error('Cloud: upsertOrder exception', e);
    }
  },

  async deleteOrder(id) {
    if (!this.configured) return;
    try {
      const { error } = await this.client.from('orders').delete().eq('id', id);
      if (error) console.error('Cloud: deleteOrder error', error);
    } catch (e) {
      console.error('Cloud: deleteOrder exception', e);
    }
  },

  async upsertTask(task) {
    if (!this.configured) return;
    try {
      const { error } = await this.client.from('tasks').upsert(this._mapTaskToDB(task));
      if (error) console.error('Cloud: upsertTask error', error);
    } catch (e) {
      console.error('Cloud: upsertTask exception', e);
    }
  },

  async deleteTask(id) {
    if (!this.configured) return;
    try {
      const { error } = await this.client.from('tasks').delete().eq('id', id);
      if (error) console.error('Cloud: deleteTask error', error);
    } catch (e) {
      console.error('Cloud: deleteTask exception', e);
    }
  },

  // ========== 初始同步 ==========
  // 如果云端有数据 -> 下载到本地
  // 如果云端为空 -> 上传本地数据到云端
  async initialSync() {
    if (!this.configured) return { synced: false, direction: 'none' };
    this._notifyStatus('syncing', '正在同步...');

    const cloudOrders = await this.fetchOrders();
    const cloudTasks = await this.fetchTasks();

    if (cloudOrders === null && cloudTasks === null) {
      this._notifyStatus('error', '同步失败，使用本地');
      return { synced: false, direction: 'error', error: true };
    }

    const hasCloudData = (cloudOrders && cloudOrders.length > 0) || (cloudTasks && cloudTasks.length > 0);

    if (hasCloudData) {
      // 云端有数据 -> 下载
      this._notifyStatus('connected', '已连接云端');
      return { synced: true, direction: 'download', orders: cloudOrders || [], tasks: cloudTasks || [] };
    } else {
      // 云端为空 -> 上传本地数据
      const localOrders = JSON.parse(localStorage.getItem('workbench_orders') || '[]');
      const localTasks = JSON.parse(localStorage.getItem('workbench_tasks') || '[]');

      for (const order of localOrders) {
        await this.upsertOrder(order);
      }
      for (const task of localTasks) {
        await this.upsertTask(task);
      }
      this._notifyStatus('connected', '已连接云端');
      return { synced: true, direction: 'upload' };
    }
  },

  // 测试连接是否可用
  async testConnection(url, key) {
    try {
      const cleanedUrl = this._cleanUrl(url);
      const testClient = supabase.createClient(cleanedUrl, key);
      const { data, error } = await testClient.from('orders').select('id').limit(1);
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: '连接成功' };
    } catch (e) {
      return { success: false, message: e.message || '连接失败' };
    }
  },
};

if (typeof window !== 'undefined') {
  window.Cloud = Cloud;
}
