// ============================================================
//  說故事學行銷 × 實地詢價任務 — 前端應用程式
// ============================================================

// ---------- Firebase 設定 ----------
// ⚠️ 請在 firebase-config.js 中填入你的 Firebase 設定
// 若尚未建立，請參考 README.md 說明
let db;
let firebaseReady = false;

function initFirebase() {
  if (typeof firebase === 'undefined') {
    alert('Firebase SDK 載入失敗，請檢查網路連線');
    return false;
  }
  if (!window.FIREBASE_CONFIG) {
    alert('請先設定 firebase-config.js（參考 README.md）');
    return false;
  }
  try {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.firestore();

    // 啟用離線持久化，讓學生在訊號差時仍可儲存
    db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      console.warn('Firestore persistence 無法啟用:', err.code);
    });
  } catch (err) {
    console.error('Firebase 初始化失敗:', err);
    alert('系統初始化失敗，請重新整理頁面');
    return false;
  }

  firebaseReady = true;
  return true;
}

// ---------- 常數 ----------
const TEACHER_PASSWORD = 'teacher2025';  // 可改成你要的密碼
const GROUP_NAMES = ['第一組', '第二組', '第三組', '第四組'];

// ---------- 全域狀態 ----------
let currentUser = null;  // { class, seat, name, group, id }
let currentRole = null;  // 'student' | 'teacher'
let unsubscribes = [];   // Firestore listeners to clean up

// ============================================================
//  初始化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  if (!initFirebase()) return;

  // 登入 Tab 切換
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + '-login').classList.add('active');
    });
  });

  // 學生登入
  document.getElementById('btn-student-enter').addEventListener('click', studentLogin);
  // 老師登入
  document.getElementById('btn-teacher-enter').addEventListener('click', teacherLogin);
  // Enter 鍵登入
  document.getElementById('teacher-pwd').addEventListener('keydown', e => {
    if (e.key === 'Enter') teacherLogin();
  });

  // 登出
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('btn-teacher-logout').addEventListener('click', logout);

  // 新增商品
  document.getElementById('btn-add-product').addEventListener('click', () => addProductCard());

  // 暫存 & 送出
  document.getElementById('btn-save-draft').addEventListener('click', () => saveForm('draft'));
  document.getElementById('survey-form').addEventListener('submit', e => {
    e.preventDefault();
    saveForm('submitted');
  });

  // 預設產生 3 張商品卡
  for (let i = 0; i < 3; i++) addProductCard();
});

// ============================================================
//  登入 / 登出
// ============================================================
function studentLogin() {
  const cls = document.getElementById('stu-class').value.trim();
  const seat = document.getElementById('stu-seat').value.trim();
  const name = document.getElementById('stu-name').value.trim();
  const group = document.getElementById('stu-group').value;

  if (!cls || !seat || !name || !group) {
    toast('請填寫完整資料', 'warn');
    return;
  }

  currentUser = {
    class: cls,
    seat: parseInt(seat),
    name: name,
    group: group,
    id: `${cls}_${seat}_${name}`
  };
  currentRole = 'student';

  document.getElementById('stu-info-display').textContent =
    `${cls} ${seat}號 ${name}（${GROUP_NAMES[group - 1]}）`;

  switchScreen('student-screen');
  loadStudentData();
  listenPublishState();
  startAutoSave();
  checkFirestoreConnection();
}

function teacherLogin() {
  const pwd = document.getElementById('teacher-pwd').value;
  if (pwd !== TEACHER_PASSWORD) {
    toast('密碼錯誤', 'error');
    return;
  }
  currentRole = 'teacher';
  switchScreen('teacher-screen');
  setupTeacherDashboard();
}

function logout() {
  stopAutoSave();
  unsubscribes.forEach(fn => fn());
  unsubscribes = [];
  currentUser = null;
  currentRole = null;
  switchScreen('login-screen');
  // 清空密碼欄
  document.getElementById('teacher-pwd').value = '';
  // 重置學生表單，避免下一位學生看到上一位的資料
  resetStudentForm();
}

function resetStudentForm() {
  const form = document.getElementById('survey-form');
  form.reset();
  // 重建預設 3 張空白商品卡
  document.getElementById('product-list').innerHTML = '';
  productCount = 0;
  for (let i = 0; i < 3; i++) addProductCard();
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============================================================
//  商品卡片
// ============================================================
let productCount = 0;

function addProductCard(data) {
  productCount++;
  const idx = productCount;
  const card = document.createElement('div');
  card.className = 'product-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <button type="button" class="btn-remove" title="刪除">&times;</button>
    <h3>商品 ${idx}</h3>
    <div class="product-grid">
      <div class="form-group">
        <label>商品名稱</label>
        <input type="text" name="p${idx}_name" value="${esc(data?.name)}">
      </div>
      <div class="form-group">
        <label>品牌</label>
        <input type="text" name="p${idx}_brand" value="${esc(data?.brand)}">
      </div>
      <div class="form-group">
        <label>規格／容量</label>
        <input type="text" name="p${idx}_spec" value="${esc(data?.spec)}">
      </div>
      <div class="form-group">
        <label>單價</label>
        <input type="text" name="p${idx}_price" value="${esc(data?.price)}">
      </div>
      <div class="form-group">
        <label>單位價格</label>
        <input type="text" name="p${idx}_unitprice" placeholder="每100g/每ml" value="${esc(data?.unitprice)}">
      </div>
      <div class="form-group">
        <label>產地</label>
        <input type="text" name="p${idx}_origin" value="${esc(data?.origin)}">
      </div>
      <div class="form-group">
        <label>包裝特色</label>
        <input type="text" name="p${idx}_package" value="${esc(data?.package)}">
      </div>
      <div class="form-group">
        <label>是否促銷</label>
        <select name="p${idx}_promo">
          <option value="">請選擇</option>
          <option value="是" ${data?.promo === '是' ? 'selected' : ''}>是</option>
          <option value="否" ${data?.promo === '否' ? 'selected' : ''}>否</option>
        </select>
      </div>
    </div>
  `;
  card.querySelector('.btn-remove').addEventListener('click', () => {
    card.remove();
    renumberProducts();
  });
  document.getElementById('product-list').appendChild(card);
}

function renumberProducts() {
  document.querySelectorAll('.product-card h3').forEach((h, i) => {
    h.textContent = `商品 ${i + 1}`;
  });
}

function esc(v) { return v || ''; }

// ============================================================
//  表單資料收集 & 儲存
// ============================================================
function collectFormData() {
  const form = document.getElementById('survey-form');
  const fd = new FormData(form);

  // 商品
  const products = [];
  document.querySelectorAll('.product-card').forEach(card => {
    const idx = card.dataset.idx;
    products.push({
      name:      fd.get(`p${idx}_name`) || '',
      brand:     fd.get(`p${idx}_brand`) || '',
      spec:      fd.get(`p${idx}_spec`) || '',
      price:     fd.get(`p${idx}_price`) || '',
      unitprice: fd.get(`p${idx}_unitprice`) || '',
      origin:    fd.get(`p${idx}_origin`) || '',
      package:   fd.get(`p${idx}_package`) || '',
      promo:     fd.get(`p${idx}_promo`) || '',
    });
  });

  // 勾選項收集
  const getChecked = name =>
    [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(cb => cb.value);

  return {
    products,
    price_display: getChecked('price_display'),
    price_display_other: fd.get('price_display_other') || '',
    story_element: getChecked('story_element'),
    story_element_other: fd.get('story_element_other') || '',
    story_copy: fd.get('story_copy') || '',
    pricing_1: fd.get('pricing_1') || '',
    pricing_2: fd.get('pricing_2') || '',
    pricing_3: fd.get('pricing_3') || '',
    pricing_4: fd.get('pricing_4') || '',
    compare_cheap: fd.get('compare_cheap') || '',
    compare_value: fd.get('compare_value') || '',
    strategy: getChecked('strategy'),
    strategy_explain: fd.get('strategy_explain') || '',
    ext_copy: fd.get('ext_copy') || '',
    ext_pricing: fd.get('ext_pricing') || '',
    ext_reason: fd.get('ext_reason') || '',
  };
}

// --- localStorage 備份 ---
function localKey() {
  return currentUser ? `draft_${currentUser.id}` : null;
}

function saveToLocal(data, status) {
  const key = localKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, status, savedAt: Date.now() }));
  } catch (e) { /* quota exceeded — ignore */ }
}

function loadFromLocal() {
  const key = localKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearLocal() {
  const key = localKey();
  if (key) localStorage.removeItem(key);
}

// Firestore 操作加上 timeout，避免 hang 住導致畫面無反應
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function saveForm(status) {
  if (!currentUser) return;

  const data = collectFormData();

  // 一律先存 localStorage 作為備份
  saveToLocal(data, status);

  try {
    const doc = {
      ...currentUser,
      status,
      data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await withTimeout(
      db.collection('responses').doc(currentUser.id).set(doc, { merge: true }),
      10000
    );
    toast(status === 'draft' ? '草稿已暫存' : '已成功送出！');
    // 送出成功後清除本地備份
    if (status === 'submitted') clearLocal();
  } catch (err) {
    console.error('Firestore 儲存失敗:', err);
    if (err.code === 'permission-denied') {
      toast('Firebase 權限被拒絕！請通知老師檢查 Firestore Rules 是否已發布', 'error');
    } else if (err.message === 'timeout') {
      toast('連線逾時，資料已暫存於本機，連線恢復後請重新送出', 'warn');
    } else {
      toast('已暫存至本機，待連線後請重新送出', 'warn');
    }
  }
}

// --- 自動暫存（每 30 秒） ---
let autoSaveTimer = null;

function startAutoSave() {
  stopAutoSave();
  autoSaveTimer = setInterval(() => {
    if (currentRole === 'student' && currentUser) {
      saveToLocal(collectFormData(), 'draft');
    }
  }, 30000);
}

function stopAutoSave() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ============================================================
//  載入學生資料（回填表單）
// ============================================================
async function loadStudentData() {
  const form = document.getElementById('survey-form');

  try {
    let saved = null;

    // 嘗試從 Firestore 載入（加 timeout 防止 hang 住）
    try {
      const docSnap = await withTimeout(
        db.collection('responses').doc(currentUser.id).get(),
        8000
      );
      if (docSnap.exists && docSnap.data().data) {
        saved = docSnap.data().data;
      }
    } catch (fbErr) {
      console.warn('Firestore 載入失敗，嘗試本地備份', fbErr);
    }

    // 若 Firestore 無資料，嘗試 localStorage 備份
    if (!saved) {
      const local = loadFromLocal();
      if (local && local.data) {
        saved = local.data;
        toast('已從本機備份還原');
      }
    }

    if (!saved) return;

    // 清除預設商品卡，重建
    document.getElementById('product-list').innerHTML = '';
    productCount = 0;
    if (saved.products && saved.products.length) {
      saved.products.forEach(p => addProductCard(p));
    } else {
      for (let i = 0; i < 3; i++) addProductCard();
    }

    // 文字欄位
    const textFields = [
      'price_display_other', 'story_element_other', 'story_copy',
      'pricing_1', 'pricing_2', 'pricing_3', 'pricing_4',
      'compare_cheap', 'compare_value', 'strategy_explain',
      'ext_copy', 'ext_pricing', 'ext_reason'
    ];
    textFields.forEach(name => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el && saved[name]) el.value = saved[name];
    });

    // 勾選
    const checkFields = ['price_display', 'story_element', 'strategy'];
    checkFields.forEach(name => {
      const vals = saved[name] || [];
      form.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
        cb.checked = vals.includes(cb.value);
      });
    });

  } catch (err) {
    console.error('載入資料失敗', err);
  }
}

// ============================================================
//  發布狀態（學生端監聽）
// ============================================================
function listenPublishState() {
  const unsub = db.collection('settings').doc('publish').onSnapshot(snap => {
    if (!snap.exists) return;
    const pub = snap.data();
    const canSeeGroup = pub.group === true;
    const canSeeAll = pub.all === true;

    if (canSeeGroup || canSeeAll) {
      document.getElementById('shared-view').style.display = 'block';
      loadSharedContent(canSeeAll);
    } else {
      document.getElementById('shared-view').style.display = 'none';
    }
  });
  unsubscribes.push(unsub);
}

async function loadSharedContent(showAll) {
  const container = document.getElementById('shared-content');
  container.innerHTML = '<p style="color:#999">載入中...</p>';

  try {
    let query;
    if (showAll) {
      query = db.collection('responses');
    } else {
      query = db.collection('responses').where('group', '==', currentUser.group);
    }

    const snap = await query.get();
    container.innerHTML = '';

    snap.forEach(doc => {
      const d = doc.data();
      if (doc.id === currentUser.id) return; // 不顯示自己
      if (d.status !== 'submitted') return;  // 只顯示已送出

      const card = document.createElement('div');
      card.className = 'shared-card';
      card.innerHTML = renderStudentDetail(d, true);
      container.appendChild(card);
    });

    if (!container.children.length) {
      container.innerHTML = '<p style="color:#999">目前沒有可查看的內容</p>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:#e74c3c">載入失敗</p>';
  }
}

// ============================================================
//  老師後台
// ============================================================
function setupTeacherDashboard() {
  setupPublishButtons();
  setupFilters();
  loadAllStudents();
  document.getElementById('btn-export-xlsx').addEventListener('click', exportToXlsx);
}

// --- 匯出 Excel ---
async function exportToXlsx() {
  toast('正在匯出...');
  try {
    const snap = await db.collection('responses').orderBy('group').get();
    if (snap.empty) {
      toast('沒有資料可匯出', 'warn');
      return;
    }

    // --- Sheet 1: 總覽 ---
    const overview = [];
    snap.forEach(doc => {
      const d = doc.data();
      const data = d.data || {};
      overview.push({
        '班級': d.class || '',
        '座號': d.seat || '',
        '姓名': d.name || '',
        '組別': GROUP_NAMES[(d.group || 1) - 1],
        '狀態': d.status === 'submitted' ? '已送出' : d.status === 'draft' ? '草稿' : '未填',
        '價格呈現方式': (data.price_display || []).join('、'),
        '價格呈現-其他': data.price_display_other || '',
        '故事元素': (data.story_element || []).join('、'),
        '故事元素-其他': data.story_element_other || '',
        '商品故事文案': data.story_copy || '',
        '定價方法1': data.pricing_1 || '',
        '定價方法2': data.pricing_2 || '',
        '定價方法3': data.pricing_3 || '',
        '定價方法4': data.pricing_4 || '',
        '哪間比較便宜': data.compare_cheap || '',
        '哪間比較有價值感': data.compare_value || '',
        '價格策略': (data.strategy || []).join('、'),
        '策略說明': data.strategy_explain || '',
        '延伸-故事行銷文案': data.ext_copy || '',
        '延伸-定價策略': data.ext_pricing || '',
        '延伸-為什麼這樣定價': data.ext_reason || '',
      });
    });

    // --- Sheet 2: 商品明細 ---
    const products = [];
    snap.forEach(doc => {
      const d = doc.data();
      const data = d.data || {};
      (data.products || []).forEach((p, i) => {
        products.push({
          '班級': d.class || '',
          '座號': d.seat || '',
          '姓名': d.name || '',
          '組別': GROUP_NAMES[(d.group || 1) - 1],
          '商品序號': i + 1,
          '商品名稱': p.name || '',
          '品牌': p.brand || '',
          '規格': p.spec || '',
          '單價': p.price || '',
          '單位價格': p.unitprice || '',
          '產地': p.origin || '',
          '包裝特色': p.package || '',
          '是否促銷': p.promo || '',
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(overview);
    const ws2 = XLSX.utils.json_to_sheet(products);

    // 自動欄寬
    autoFitColumns(ws1, overview);
    autoFitColumns(ws2, products);

    XLSX.utils.book_append_sheet(wb, ws1, '填答總覽');
    XLSX.utils.book_append_sheet(wb, ws2, '商品明細');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `詢價任務結果_${today}.xlsx`);
    toast('匯出成功');
  } catch (err) {
    console.error('匯出失敗:', err);
    toast('匯出失敗', 'error');
  }
}

function autoFitColumns(ws, data) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  ws['!cols'] = keys.map(k => {
    const maxLen = Math.max(
      k.length,
      ...data.map(row => String(row[k] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
}

// --- 發布按鈕 ---
let publishButtonsBound = false;

function setupPublishButtons() {
  const btnGroup = document.getElementById('btn-pub-group');
  const btnAll = document.getElementById('btn-pub-all');

  // 讀取目前狀態
  db.collection('settings').doc('publish').get().then(snap => {
    if (snap.exists) {
      const d = snap.data();
      setToggle(btnGroup, d.group || false);
      setToggle(btnAll, d.all || false);
    }
  });

  // 只綁定一次，避免重複登入時累加 listener
  if (!publishButtonsBound) {
    btnGroup.addEventListener('click', () => togglePublish('group', btnGroup));
    btnAll.addEventListener('click', () => togglePublish('all', btnAll));
    publishButtonsBound = true;
  }
}

function setToggle(btn, on) {
  btn.dataset.state = on ? 'on' : 'off';
  btn.textContent = on ? '已發布' : '未發布';
  btn.classList.toggle('btn-toggle', true);
}

async function togglePublish(field, btn) {
  const newState = btn.dataset.state !== 'on';
  try {
    await db.collection('settings').doc('publish').set(
      { [field]: newState },
      { merge: true }
    );
    setToggle(btn, newState);
    toast(newState ? '已發布' : '已取消發布');
  } catch (err) {
    console.error(err);
    toast('操作失敗', 'error');
  }
}

// --- 組別篩選 ---
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterStudents(btn.dataset.filter);
    });
  });
}

function filterStudents(group) {
  document.querySelectorAll('.student-row').forEach(row => {
    if (group === 'all' || row.dataset.group === group) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// --- 載入所有學生 ---
function loadAllStudents() {
  const list = document.getElementById('teacher-student-list');

  const unsub = db.collection('responses')
    .orderBy('group')
    .onSnapshot(snap => {
      list.innerHTML = '';
      if (snap.empty) {
        list.innerHTML = '<p style="color:#999;padding:20px;">尚無學生填寫</p>';
        return;
      }

      snap.forEach(doc => {
        const d = doc.data();
        const statusClass = d.status === 'submitted' ? 'status-submitted' :
                            d.status === 'draft' ? 'status-draft' : 'status-empty';
        const statusText = d.status === 'submitted' ? '已送出' :
                           d.status === 'draft' ? '草稿' : '未填';

        const row = document.createElement('div');
        row.className = 'student-row';
        row.dataset.group = d.group;
        row.innerHTML = `
          <div>
            <span class="name">${htmlEsc(d.name)}</span>
            <span class="meta">  ${htmlEsc(d.class)} ${d.seat}號 ｜ ${GROUP_NAMES[d.group - 1]}</span>
          </div>
          <span class="status-badge ${statusClass}">${statusText}</span>
        `;
        row.addEventListener('click', () => showDetail(d));
        list.appendChild(row);
      });
    });

  unsubscribes.push(unsub);
}

// --- 顯示個別學生詳細 ---
function closeModal() {
  document.getElementById('teacher-detail-modal').style.display = 'none';
}

function showDetail(d) {
  const modal = document.getElementById('teacher-detail-modal');
  const body = document.getElementById('teacher-detail-body');
  body.innerHTML = renderStudentDetail(d, false);
  modal.style.display = 'flex';
}

// Modal 事件只綁定一次（避免每次 showDetail 都累加 listener）
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('teacher-detail-modal');
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
});

// ============================================================
//  渲染學生詳細內容（共用：老師後台 & 學生互看）
// ============================================================
function renderStudentDetail(d, compact) {
  const data = d.data || {};
  const header = compact
    ? `<h3>${htmlEsc(d.name)}（${GROUP_NAMES[d.group - 1]}）</h3>`
    : `<h2>${htmlEsc(d.class)} ${d.seat}號 ${htmlEsc(d.name)}（${GROUP_NAMES[d.group - 1]}）</h2>`;

  // 商品表格
  let productHTML = '';
  if (data.products && data.products.length) {
    productHTML = `
      <div class="detail-section">
        <h3>📝 商品資料</h3>
        <div style="overflow-x:auto;">
        <table class="detail-product-table">
          <tr>
            <th>#</th><th>名稱</th><th>品牌</th><th>規格</th>
            <th>單價</th><th>單位價</th><th>產地</th><th>包裝</th><th>促銷</th>
          </tr>
          ${data.products.map((p, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${htmlEsc(p.name)}</td>
              <td>${htmlEsc(p.brand)}</td>
              <td>${htmlEsc(p.spec)}</td>
              <td>${htmlEsc(p.price)}</td>
              <td>${htmlEsc(p.unitprice)}</td>
              <td>${htmlEsc(p.origin)}</td>
              <td>${htmlEsc(p.package)}</td>
              <td>${htmlEsc(p.promo)}</td>
            </tr>
          `).join('')}
        </table>
        </div>
      </div>
    `;
  }

  // 觀察重點
  const chips = arr => (arr || []).map(v => `<span class="chip">${htmlEsc(v)}</span>`).join('');

  return `
    ${header}

    ${productHTML}

    <div class="detail-section">
      <h3>🔍 現場觀察</h3>
      <div class="detail-field">
        <div class="detail-label">價格呈現方式</div>
        <div class="detail-value">${chips(data.price_display)} ${data.price_display_other ? '<span class="chip">' + htmlEsc(data.price_display_other) + '</span>' : ''}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">故事元素</div>
        <div class="detail-value">${chips(data.story_element)} ${data.story_element_other ? '<span class="chip">' + htmlEsc(data.story_element_other) + '</span>' : ''}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">商品故事文案</div>
        <div class="detail-value">${htmlEsc(data.story_copy) || '（未填）'}</div>
      </div>
    </div>

    <div class="detail-section">
      <h3>💰 定價方法分析</h3>
      ${['pricing_1','pricing_2','pricing_3','pricing_4'].map((k, i) =>
        data[k] ? `<div class="detail-field"><div class="detail-label">${i + 1}.</div><div class="detail-value">${htmlEsc(data[k])}</div></div>` : ''
      ).join('')}
    </div>

    <div class="detail-section">
      <h3>⚔️ 價格競爭策略</h3>
      <div class="detail-field">
        <div class="detail-label">哪間比較便宜？</div>
        <div class="detail-value">${htmlEsc(data.compare_cheap) || '（未填）'}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">哪間比較有價值感？</div>
        <div class="detail-value">${htmlEsc(data.compare_value) || '（未填）'}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">價格策略</div>
        <div class="detail-value">${chips(data.strategy)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">說明</div>
        <div class="detail-value">${htmlEsc(data.strategy_explain) || '（未填）'}</div>
      </div>
    </div>

    <div class="detail-section">
      <h3>🧠 延伸思考</h3>
      <div class="detail-field">
        <div class="detail-label">故事行銷文案</div>
        <div class="detail-value">${htmlEsc(data.ext_copy) || '（未填）'}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">定價策略</div>
        <div class="detail-value">${htmlEsc(data.ext_pricing) || '（未填）'}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">為什麼這樣定價？</div>
        <div class="detail-value">${htmlEsc(data.ext_reason) || '（未填）'}</div>
      </div>
    </div>
  `;
}

// ============================================================
//  連線狀態檢測
// ============================================================
function checkFirestoreConnection() {
  db.collection('settings').doc('publish').get()
    .then(() => console.log('Firestore 連線正常'))
    .catch(err => {
      console.error('Firestore 連線測試失敗:', err);
      if (err.code === 'permission-denied') {
        toast('Firebase 權限錯誤！請通知老師檢查 Firestore Rules', 'error');
      }
    });
}

// ============================================================
//  工具函式
// ============================================================
function htmlEsc(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function toast(msg, type = 'success') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove('show', 'toast-success', 'toast-error', 'toast-warn');
  el.classList.add('show', `toast-${type}`);
  setTimeout(() => el.classList.remove('show'), type === 'error' ? 4000 : 2500);
}
