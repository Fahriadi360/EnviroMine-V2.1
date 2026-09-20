/*************************************************************
 * JAVASCRIPT.HTML — EnviroMine Monitor Air Limbah V2.1
 * Perbaikan:
 *  1. Tabel (ledger, lab, laporan) sekarang muncul setelah input
 *  2. Modal laporan: jenis dokumen mempengaruhi template, nomor sampel
 *     di-generate SETELAH pond dipilih, kirim → SPV → KTT → download
 *  3. Sidebar dapat di-hide (toggle)
 *  4. Grafik dashboard lebih menarik (gradient, multi-chart, donut)
 *  5. Notifikasi real-time ke SPV & KTT
 *  6. LOGIN: Toggle show/hide password + desain fullscreen baru
 *************************************************************/

const AppState = {
  token: null, session: null, config: {}, ponds: [], bakuMutu: [],
  photos: [], currentView: 'dashboard', reportFilteredData: [],
  selectedDailyLog: null, notifPollingInterval: null,
  pendingReviewReport: null
};
const LOCALSTORAGE_DRAFT_KEY = 'enviromine_draft_daily_log';

// URL Backend Google Apps Script Web App (API Endpoint)
const BACKEND_API_URL = 'https://script.google.com/macros/s/AKfycbwBRGtS1IFaL4yBz0sviDYSdAWEB4qfo83fxSrawuQK2URtKXIfMNCJIWUiPIQqv0k/exec';

// ============================================================
// 1. WRAPPER KOMUNIKASI SERVER (DUAL-MODE: GAS / GITHUB PAGES)
// ============================================================
let loadingCounter = 0;
function showLoading(state) {
  if (state) {
    loadingCounter++;
  } else {
    loadingCounter = Math.max(0, loadingCounter - 1);
  }
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.toggle('active', loadingCounter > 0);
}

function hideLoadingForced() {
  loadingCounter = 0;
  const el = document.getElementById('loading-overlay');
  if (el) el.classList.remove('active');
}

function _callServerInternal(silent, fnName, ...args) {
  if (!silent) showLoading(true);

  // Mode 1: Jika diakses di dalam Google Apps Script Web App
  if (typeof google !== 'undefined' && google.script && google.script.run && typeof google.script.run[fnName] === 'function') {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(res => {
          if (!silent) showLoading(false);
          resolve(res);
        })
        .withFailureHandler(err => {
          if (!silent) {
            showLoading(false);
            Swal.fire({ icon: 'error', title: 'Terjadi Kesalahan', text: err.message || String(err) });
          }
          reject(err);
        })
        [fnName](...args);
    });
  }

  // Mode 2: Jika diakses dari GitHub Pages / Server Eksternal (REST API POST)
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: fnName, args: args })
      });
      const res = await response.json();
      if (!silent) showLoading(false);
      if (!res.success) {
        if (!silent) Swal.fire({ icon: 'error', title: 'Terjadi Kesalahan', text: res.error });
        return reject(new Error(res.error));
      }
      resolve(res.data);
    } catch (err) {
      if (!silent) {
        showLoading(false);
        Swal.fire({ icon: 'error', title: 'Gagal Terhubung ke Server', text: err.message || String(err) });
      }
      reject(err);
    }
  });
}

function callServer(fnName, ...args) {
  return _callServerInternal(false, fnName, ...args);
}

function callServerSilent(fnName, ...args) {
  return _callServerInternal(true, fnName, ...args);
}

// ============================================================
// 2. AUTENTIKASI
// ============================================================
document.getElementById('form-login').addEventListener('submit', async function (e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const session = await callServer('apiLogin', username, password);
    if (session && (username.toLowerCase() === 'admin' || session.role === 'ADMIN')) {
      session.role = 'ADMIN';
    }
    AppState.token = session.token; AppState.session = session;
    const remember = document.getElementById('login-remember').checked;
    (remember ? localStorage : sessionStorage).setItem('enviromine_token', session.token);
    await bootApp();
  } catch (err) {}
});

/* ── TAMBAHAN LOGIN: Toggle show/hide password ── */
document.getElementById('login-pw-toggle')?.addEventListener('click', function () {
  const pwInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('login-pw-eye-icon');
  const isPassword = pwInput.type === 'password';
  pwInput.type = isPassword ? 'text' : 'password';
  eyeIcon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  this.setAttribute('title', isPassword ? 'Sembunyikan password' : 'Tampilkan password');
});

/* ── TAMBAHAN LOGIN: Lupa kata sandi ── */
document.getElementById('login-forgot-link')?.addEventListener('click', async function (e) {
  e.preventDefault();
  const inputUsername = document.getElementById('login-username')?.value.trim() || '';

  const { value: targetUser } = await Swal.fire({
    title: 'Pemulihan Kata Sandi',
    html: `
      <div style="text-align:left;font-size:13px;line-height:1.6;color:#334155;">
        <p style="margin-bottom:10px;">Masukkan username akun Anda untuk verifikasi identitas:</p>
        <div style="margin-bottom:12px;">
          <input id="swal-forgot-user" class="swal2-input" style="width:100%;margin:0;box-sizing:border-box;" placeholder="Username akun Anda" value="${inputUsername}">
        </div>
        <div style="background:#F1F5F9;border-left:4px solid #0F5132;padding:10px 12px;border-radius:4px;font-size:12px;color:#475569;">
          <b style="color:#0F5132;"><i class="fa-solid fa-shield-halved me-1"></i> Keamanan Akun:</b><br>
          Untuk menjaga integritas rekaman kepatuhan dan audit trail KTT, pemulihan kata sandi dilakukan secara terverifikasi melalui <b>Administrator Sistem</b> atau <b>Supervisor Lingkungan</b>.
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-headset me-1"></i> Bantuan Reset',
    cancelButtonText: 'Tutup',
    confirmButtonColor: '#0F5132',
    focusConfirm: false,
    preConfirm: () => {
      const u = document.getElementById('swal-forgot-user')?.value.trim();
      if (!u) {
        Swal.showValidationMessage('Silakan masukkan username akun Anda');
        return false;
      }
      return u;
    }
  });

  if (targetUser) {
    Swal.fire({
      icon: 'info',
      title: 'Permintaan Tercatat',
      html: `
        <div style="font-size:13px;line-height:1.6;color:#334155;text-align:left;">
          <p>Akun yang diminta: <b>${targetUser}</b></p>
          <p>Silakan hubungi <b>Administrator Sistem</b> atau <b>Supervisor Lingkungan</b> di Site untuk verifikasi akun dan aktivasi kata sandi baru.</p>
          <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:6px;padding:10px 12px;font-size:12px;color:#92400E;margin-top:12px;">
            <b><i class="fa-solid fa-key me-1"></i> Password Standar:</b><br>
            Password default setelah di-reset oleh sistem/admin adalah <code>ganti123</code> atau <code>demo123</code>.
          </div>
        </div>
      `,
      confirmButtonColor: '#0F5132',
      confirmButtonText: 'Saya Mengerti'
    });
  }
});

document.getElementById('btn-logout').addEventListener('click', async function (e) {
  e.preventDefault();
  if (AppState.notifPollingInterval) clearInterval(AppState.notifPollingInterval);
  await callServer('apiLogout', AppState.token);
  localStorage.removeItem('enviromine_token'); sessionStorage.removeItem('enviromine_token');
  location.reload();
});

async function bootApp() {
  const data = await callServer('apiGetInitialAppData', AppState.token);
  AppState.session = data.session; AppState.config = data.config;
  AppState.ponds = data.ponds; AppState.bakuMutu = data.bakuMutu;

  if (AppState.session && (AppState.session.username?.toLowerCase() === 'admin' || AppState.session.role === 'ADMIN')) {
    AppState.session.role = 'ADMIN';
  }

  applyTheme(); applySessionUI(); populatePondDropdowns();
  buildSidebarByRole(); buildDashboardLabelsByRole();

  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  navigateTo('dashboard');
  refreshDisposisiBadge();
  checkDraftLocal();
  startNotifPolling();

  // Restore saved token
  const savedToken = localStorage.getItem('enviromine_token') || sessionStorage.getItem('enviromine_token');
  if (savedToken && !AppState.token) AppState.token = savedToken;
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  url = url.trim().replace(/^['"]|['"]$/g, '');
  if (!url) return '';
  // Convert Google Drive sharing URLs to direct image CDN URLs
  if (url.includes('drive.google.com') || url.includes('drive.usercontent.google.com')) {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return 'https://lh3.googleusercontent.com/d/' + fileIdMatch[1] + '=w1920';
    }
  }
  return url;
}

function applyLoginLogo(logoUrl) {
  const iconEl = document.getElementById('login-brand-icon');
  if (iconEl && logoUrl) {
    const cleanUrl = normalizeImageUrl(logoUrl);
    iconEl.innerHTML = `<img src="${cleanUrl}" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:50%;">`;
  }
}

function applyLoginBg(bgUrl) {
  if (!bgUrl) return;
  const cleanUrl = normalizeImageUrl(bgUrl);
  if (!cleanUrl) return;

  const bgImgEl = document.getElementById('login-bg-image');
  if (bgImgEl) {
    bgImgEl.style.setProperty('background-image', `url("${cleanUrl}")`, 'important');
  }
  const loginView = document.getElementById('view-login');
  if (loginView) {
    loginView.style.setProperty('background-image', `url("${cleanUrl}")`, 'important');
    loginView.style.setProperty('background-size', 'cover', 'important');
    loginView.style.setProperty('background-position', 'center center', 'important');
    loginView.style.setProperty('background-repeat', 'no-repeat', 'important');
  }
}

function formatDisplayDate(val) {
  if (!val) return '-';
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

function formatDisplayTime(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (s.includes('T')) {
    const timePart = s.split('T')[1];
    return timePart ? timePart.slice(0, 5) : '';
  }
  return s.slice(0, 5);
}

function formatDisplayMonth(val) {
  if (!val) return '-';
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 7);
  return s;
}

function applyTheme() {
  const primary = AppState.config.PRIMARY_COLOR || '#0F5132';
  document.documentElement.style.setProperty('--primary', primary);
  document.getElementById('topbar-appname').textContent = (AppState.config.APP_NAME || 'EnviroMine').split(' ')[0];
  document.getElementById('topbar-region').textContent = AppState.config.REGION_NAME || '';
  document.getElementById('login-app-name').textContent = AppState.config.APP_NAME || 'EnviroMine Monitor Air Limbah V2.1';
  const regionFooter = document.getElementById('login-region-footer');
  if (regionFooter) regionFooter.textContent = AppState.config.REGION_NAME || '';

  if (AppState.config.LOGO_URL) {
    document.getElementById('topbar-logo').src = AppState.config.LOGO_URL;
    localStorage.setItem('enviromine_logo_url', AppState.config.LOGO_URL);
    applyLoginLogo(AppState.config.LOGO_URL);
  }
  if (AppState.config.LOGIN_BG_URL) {
    localStorage.setItem('enviromine_login_bg', AppState.config.LOGIN_BG_URL);
    applyLoginBg(AppState.config.LOGIN_BG_URL);
  }
}

function applySessionUI() {
  const s = AppState.session;
  document.getElementById('user-name').textContent = s.namaLengkap;
  const roleEl = document.getElementById('user-role');
  if (s.role === 'ADMIN') {
    roleEl.innerHTML = '<span class="badge badge-role admin-role">ADMINISTRATOR</span>';
  } else {
    roleEl.textContent = roleLabel(s.role);
  }

  // Cek jika pengguna memiliki foto avatar tersimpan
  const avatarWrap = document.getElementById('user-avatar-wrap');
  const savedAvatar = localStorage.getItem('enviromine_avatar_' + s.username);
  if (savedAvatar && avatarWrap) {
    avatarWrap.innerHTML = `<img src="${savedAvatar}" alt="${s.namaLengkap}">`;
  } else if (avatarWrap) {
    avatarWrap.innerHTML = `<span id="user-initial">${s.namaLengkap.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>`;
  }
}

// Inisialisasi awal tema dan logo dari cache lokal saat halaman pertama dimuat
(function initStartupCache() {
  const cachedLogo = localStorage.getItem('enviromine_logo_url');
  if (cachedLogo) applyLoginLogo(cachedLogo);
  const cachedBg = localStorage.getItem('enviromine_login_bg');
  if (cachedBg) applyLoginBg(cachedBg);

  const savedTheme = localStorage.getItem('enviromine_theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.className = 'fa-solid fa-sun';
  }

  // Pre-fetch konfigurasi publik server tanpa login (background login, logo, nama app)
  function handlePublicConfig(pub) {
    if (!pub) return;
    if (pub.APP_NAME) {
      const el = document.getElementById('login-app-name');
      if (el) el.textContent = pub.APP_NAME;
    }
    if (pub.REGION_NAME) {
      const el = document.getElementById('login-region-footer');
      if (el) el.textContent = pub.REGION_NAME;
    }
    if (pub.PRIMARY_COLOR) {
      document.documentElement.style.setProperty('--primary', pub.PRIMARY_COLOR);
    }
    if (pub.LOGO_URL) {
      localStorage.setItem('enviromine_logo_url', pub.LOGO_URL);
      applyLoginLogo(pub.LOGO_URL);
    }
    if (pub.LOGIN_BG_URL) {
      localStorage.setItem('enviromine_login_bg', pub.LOGIN_BG_URL);
      applyLoginBg(pub.LOGIN_BG_URL);
    }
  }

  try {
    if (typeof google !== 'undefined' && google.script && google.script.run && typeof google.script.run.apiGetPublicConfig === 'function') {
      google.script.run
        .withSuccessHandler(handlePublicConfig)
        .withFailureHandler(function () {})
        .apiGetPublicConfig();
    } else if (BACKEND_API_URL) {
      fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'apiGetPublicConfig', args: [] })
      })
      .then(r => r.json())
      .then(res => { if (res && res.success) handlePublicConfig(res.data); })
      .catch(() => {});
    }
  } catch (e) {}
})();

// Listener tombol ganti tema gelap / terang
document.getElementById('btn-theme-toggle')?.addEventListener('click', function () {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('enviromine_theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  this.title = isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap';
});

function roleLabel(role) {
  return {
    OPERATOR: 'Operator Lapangan',
    SUPERVISOR: 'Supervisor Lingkungan',
    MANAJEMEN: 'Kepala Teknik Tambang (KTT)',
    ADMIN: 'Administrator Sistem'
  }[role] || role;
}

function buildSidebarByRole() {
  const role = AppState.session.role;
  document.querySelectorAll('[data-roles]').forEach(el => {
    // ADMIN melihat semua menu
    if (role === 'ADMIN') { el.style.display = ''; return; }
    const allowed = el.getAttribute('data-roles').split(',');
    el.style.display = allowed.includes(role) ? '' : 'none';
  });
}

function buildDashboardLabelsByRole() {
  const role = AppState.session.role;
  const cfg = {
    OPERATOR: { title: 'Dashboard Ringkas Operator', sub: 'Ringkasan tugas sampling harian Anda di lapangan.', k1: 'Sampling Hari Ini', k2: 'Pelanggaran Aktif', k3: 'Disposisi Terbuka', k4: 'Compliance Rate' },
    SUPERVISOR: { title: 'Dashboard Kepatuhan Lingkungan', sub: 'Pemantauan kualitas air kolam pengendap sedimen & deteksi pelanggaran baku mutu real-time.', k1: 'Sampling Hari Ini', k2: 'Pelanggaran Aktif', k3: 'Laporan Menunggu Review', k4: 'Compliance Rate (Bulanan)' },
    MANAJEMEN: { title: 'Dashboard Eksekutif Kepala Teknik Tambang', sub: 'Ringkasan otoritas kepatuhan baku mutu air limbah, audit trail terpadu, dan pengesahan dokumen resmi berjenjang.', k1: 'Sampling Hari Ini', k2: 'Pelanggaran Aktif Kritis', k3: 'Otorisasi KTT Tertunda', k4: 'Indeks Kepatuhan' },
    ADMIN: { title: 'Dashboard Administrator Sistem', sub: 'Akses penuh ke seluruh fitur sistem pemantauan. Kelola data, pengguna, dan konfigurasi aplikasi.', k1: 'Sampling Hari Ini', k2: 'Pelanggaran Aktif', k3: 'Laporan Tertunda', k4: 'Compliance Rate' }
  }[role] || { title: 'Dashboard', sub: '', k1: 'Sampling', k2: 'Pelanggaran', k3: 'Tertunda', k4: 'Compliance' };
  document.getElementById('dash-title').textContent = cfg.title;
  document.getElementById('dash-subtitle').textContent = cfg.sub;
  document.getElementById('kpi-label-1').textContent = cfg.k1;
  document.getElementById('kpi-label-2').textContent = cfg.k2;
  document.getElementById('kpi-label-3').textContent = cfg.k3;
  document.getElementById('kpi-label-4').textContent = cfg.k4;
  document.getElementById('panel-operator-cta').classList.toggle('hidden', role !== 'OPERATOR');
  document.getElementById('panel-operator-riwayat').classList.toggle('hidden', role !== 'OPERATOR');
  document.getElementById('panel-ktt-approval').classList.toggle('hidden', role !== 'MANAJEMEN');
}

function toggleReportPermissionsByRole() {
  const role = AppState.session.role;
  const isOperator = role === 'OPERATOR';
  // ADMIN dan peran lain di atas OPERATOR bisa lihat semua
  document.querySelectorAll('.spv-manajemen-only').forEach(el => el.classList.toggle('hidden', isOperator));
  document.getElementById('rep-operator-note')?.classList.toggle('hidden', !isOperator);
}

function populatePondDropdowns() {
  ['fh-pond', 'filter-pond', 'lab-pond', 'rep-pond'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const keepFirst = el.id === 'filter-pond' || el.id === 'rep-pond';
    el.innerHTML = (keepFirst && el.querySelector('option')) ? el.querySelector('option').outerHTML : '';
    AppState.ponds.forEach(p => { el.innerHTML += `<option value="${p.Pond_ID}">${p.Nama_Pond} (${p.Pond_ID})</option>`; });
  });

  const repAreaEl = document.getElementById('rep-area-kode-select');
  if (repAreaEl) {
    repAreaEl.innerHTML = '<option value="">-- Pilih Settling Pond --</option>';
    AppState.ponds.forEach(p => {
      repAreaEl.innerHTML += `<option value="${p.Pond_ID}" data-nama="${p.Nama_Pond}">${p.Pond_ID} — ${p.Nama_Pond}</option>`;
    });
  }
}

// ============================================================
// 3. SIDEBAR TOGGLE — FIX BUG #4
// ============================================================
let sidebarVisible = true;
function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  const sidebar = document.getElementById('sidebar-nav');
  const mainContent = document.querySelector('.main-content');
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  if (sidebarVisible) {
    sidebar.classList.remove('sidebar-hidden');
    mainContent.classList.remove('content-full');
    toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    toggleBtn.title = 'Sembunyikan Sidebar';
  } else {
    sidebar.classList.add('sidebar-hidden');
    mainContent.classList.add('content-full');
    toggleBtn.innerHTML = '<i class="fa-solid fa-bars-staggered"></i>';
    toggleBtn.title = 'Tampilkan Sidebar';
  }
}
document.getElementById('btn-sidebar-toggle')?.addEventListener('click', toggleSidebar);

// ============================================================
// 3B. NAVIGASI SPA
// ============================================================
document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => navigateTo(el.getAttribute('data-view'))));

function navigateTo(view) {
  const el = document.querySelector(`.nav-item[data-view="${view}"], .bottom-nav-item[data-view="${view}"]`);
  if (el && el.hasAttribute('data-roles') && AppState.session.role !== 'ADMIN') {
    const allowed = el.getAttribute('data-roles').split(',');
    if (!allowed.includes(AppState.session.role)) { Swal.fire('Akses Ditolak', 'Anda tidak memiliki hak akses ke modul ini.', 'warning'); return; }
  }
  AppState.currentView = view;
  document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view).classList.remove('hidden');
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-view="${view}"]`).forEach(n => n.classList.add('active'));

  if (view === 'dashboard') refreshDashboard();
  if (view === 'form-harian') prefillFormHarian();
  if (view === 'log-table') refreshLogTable();
  if (view === 'disposisi-investigasi') refreshDisposisiList();
  if (view === 'lab') refreshLabTable();
  if (view === 'laporan') { toggleReportPermissionsByRole(); refreshReportTable(); refreshLaporanList(); }
  if (view === 'master') refreshMasterData();
  if (view === 'settings') refreshSettings();
}

async function refreshDisposisiBadge() {
  try {
    const rows = await callServerSilent('apiGetDisposisiList', AppState.token, {});
    const openCount = (rows || []).filter(r => r.Status_Penanganan !== 'RESOLVED').length;
    const badge = document.getElementById('nav-badge-disposisi');
    if (badge) {
      badge.textContent = openCount;
      badge.classList.toggle('hidden', openCount === 0);
    }
    const dot = document.getElementById('bell-dot');
    if (dot) dot.style.display = openCount > 0 ? 'block' : 'none';
  } catch (e) {}
}

// ============================================================
// 4. NOTIFIKASI REAL-TIME
// ============================================================
function startNotifPolling() {
  pollNotifikasi();
  AppState.notifPollingInterval = setInterval(pollNotifikasi, 60000);
}

async function pollNotifikasi() {
  try {
    const notifs = await callServerSilent('apiGetNotifikasi', AppState.token);
    updateBellBadge((notifs || []).length);
    AppState.notifCache = notifs || [];
  } catch (e) {}
}

function updateBellBadge(count) {
  const bellDot = document.getElementById('bell-dot');
  const bellCount = document.getElementById('bell-count');
  if (bellDot) bellDot.style.display = count > 0 ? 'block' : 'none';
  if (bellCount) { bellCount.textContent = count; bellCount.classList.toggle('hidden', count === 0); }
}

document.querySelector('.bell-btn')?.addEventListener('click', showNotifPanel);

function showNotifPanel() {
  const notifs = AppState.notifCache || [];
  if (!notifs.length) {
    Swal.fire({ icon: 'info', title: 'Tidak Ada Notifikasi', text: 'Semua notifikasi sudah dibaca.', timer: 1800, showConfirmButton: false });
    return;
  }
  const html = notifs.map(n => `
    <div class="notif-item" onclick="handleNotifClick('${n.Notif_ID}','${n.Tipe}','${n.Ref_ID}')">
      <div class="notif-judul">${n.Judul}</div>
      <div class="notif-pesan">${n.Pesan}</div>
    </div>`).join('');
  Swal.fire({
    title: '🔔 Notifikasi',
    html: `<div class="notif-panel">${html}</div>`,
    showCancelButton: true,
    confirmButtonText: 'Tandai Semua Dibaca',
    cancelButtonText: 'Tutup',
    width: '500px'
  }).then(async r => {
    if (r.isConfirmed) {
      await callServer('apiMarkAllNotifRead', AppState.token);
      AppState.notifCache = [];
      updateBellBadge(0);
    }
  });
}

async function handleNotifClick(notifId, tipe, refId) {
  await callServer('apiMarkNotifRead', AppState.token, notifId);
  Swal.close();

  if (tipe === 'LAPORAN_BARU' && AppState.session.role === 'SUPERVISOR') {
    await openReviewModal(refId);
  } else if (tipe === 'LAPORAN_SPV_APPROVED' && AppState.session.role === 'MANAJEMEN') {
    await openApproveKTTModal(refId);
  } else if (tipe === 'LAPORAN_DIKEMBALIKAN') {
    navigateTo('laporan');
  } else if (tipe === 'LAPORAN_FINAL') {
    navigateTo('laporan');
  }
  pollNotifikasi();
}

// ============================================================
// 5. DASHBOARD — FIX BUG #5: Grafik lebih menarik
// ============================================================
let chartInstances = {};

async function refreshDashboard() {
  const data = await callServer('apiGetDashboardSummary', AppState.token);
  const role = AppState.session.role;

  document.getElementById('kpi-value-1').textContent = data.totalHariIni;
  document.getElementById('kpi-value-2').textContent = data.jumlahAnomaliAktif;
  document.getElementById('kpi-card-2').classList.toggle('violation', data.jumlahAnomaliAktif > 0);
  document.getElementById('kpi-value-4').textContent = data.complianceRate + '%';
  document.getElementById('kpi-sub-4').innerHTML = `<b>${data.totalSampelBulanIni}</b> sampel diuji bulan ini`;

  if (role === 'MANAJEMEN') {
    const pendingCount = (data.pendingApprovalCount || 0) + (data.pendingLaporanKTT?.length || 0);
    document.getElementById('kpi-value-3').textContent = pendingCount;
    document.getElementById('kpi-sub-3').textContent = 'Menunggu tanda tangan Anda';
  } else if (role === 'SUPERVISOR') {
    document.getElementById('kpi-value-3').textContent = data.pendingLaporanSPV?.length || 0;
    document.getElementById('kpi-sub-3').textContent = 'Laporan menunggu review';
  } else {
    document.getElementById('kpi-value-3').textContent = data.disposisiOpenCount;
    document.getElementById('kpi-sub-3').textContent = 'Insiden belum tertutup';
  }

  const list = document.getElementById('anomaly-alert-list');
  list.innerHTML = !data.anomaliAktif.length ? '<p class="text-muted">Tidak ada pelanggaran aktif.</p>' :
    data.anomaliAktif.map(a => `
      <div class="alert-card">
        <div class="alert-title"><span>${a.Pond_ID} · ${a.Titik_Aliran}</span><span class="badge badge-violation">PELANGGARAN</span></div>
        <div class="alert-meta">pH ${a.Nilai_pH} · TSS ${a.Nilai_TSS} · Fe ${a.Nilai_Fe} · Mn ${a.Nilai_Mn}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:.2rem;">${a.Tanggal_Sampling} ${a.Jam_Sampling}</div>
      </div>`).join('');

  renderTrendChart(data);
  renderComplianceDonut(data);
  renderPondBarChart(data);

  if (role === 'OPERATOR') {
    document.getElementById('operator-riwayat-body').innerHTML = (data.myTodayLogs || []).map(r => `
      <tr><td class="mono">${r.Jam_Sampling}</td><td>${r.Pond_ID}</td><td>${r.Titik_Aliran}</td>
      <td><span class="badge ${r.Status_Mutu === 'NORMAL' ? 'badge-compliant' : 'badge-violation'}">${r.Status_Mutu}</span></td></tr>`).join('')
      || '<tr><td colspan="4" class="text-center text-muted">Belum ada input hari ini.</td></tr>';
  }

  if (role === 'MANAJEMEN') {
    const pendingLaporan = data.pendingLaporanKTT || [];
    const pendingLogs = data.pendingApprovalLogs || [];
    document.getElementById('ktt-approval-body').innerHTML = [
      ...pendingLaporan.map(r => `<tr><td class="mono">${r.Report_ID}</td><td>${r.Pond_ID}</td><td>-</td><td>-</td>
        <td>${r.Reviewed_By_SPV || '-'}</td>
        <td><button class="btn btn-sm btn-primary" onclick="openApproveKTTModal('${r.Report_ID}')"><i class="fa-solid fa-file-signature me-1"></i>Setujui Laporan</button></td></tr>`),
      ...pendingLogs.map(r => `<tr><td class="mono">${r.Log_ID}</td><td>${r.Pond_ID}</td>
        <td class="numeric">${r.Nilai_pH}</td><td class="numeric">${r.Nilai_TSS}</td>
        <td>${r.Verified_By || '-'}</td>
        <td><button class="btn btn-sm btn-outline" onclick="verifyLog('${r.Log_ID}','APPROVED_KTT')">Setujui Log</button></td></tr>`)
    ].join('') || '<tr><td colspan="6" class="text-center text-muted">Tidak ada item menunggu persetujuan.</td></tr>';
  }
}

function renderTrendChart(data) {
  destroyChart('trend');
  const ctx = document.getElementById('chart-trend');
  if (!ctx) return;
  const labels = data.trend.map(t => t.date);
  const phData = data.trend.map(t => t.ph);
  const tssData = data.trend.map(t => t.tss);

  const ctxObj = ctx.getContext('2d');
  const gradPh = ctxObj.createLinearGradient(0, 0, 0, 300);
  gradPh.addColorStop(0, 'rgba(15,81,50,0.3)');
  gradPh.addColorStop(1, 'rgba(15,81,50,0)');
  const gradTss = ctxObj.createLinearGradient(0, 0, 0, 300);
  gradTss.addColorStop(0, 'rgba(2,132,199,0.3)');
  gradTss.addColorStop(1, 'rgba(2,132,199,0)');

  chartInstances['trend'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'pH (rata-rata)', data: phData, borderColor: '#0F5132', backgroundColor: gradPh, tension: 0.4, fill: true, borderWidth: 2.5, pointBackgroundColor: '#0F5132', pointRadius: 4, pointHoverRadius: 6 },
        { label: 'TSS mg/L', data: tssData, borderColor: '#0284C7', backgroundColor: gradTss, tension: 0.4, fill: true, borderWidth: 2.5, yAxisID: 'y1', pointBackgroundColor: '#0284C7', pointRadius: 4, pointHoverRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', font: { family: 'Montserrat', size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)', padding: 12,
          titleFont: { family: 'Montserrat', weight: '700' },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          callbacks: {
            afterBody: (items) => {
              const ph = items.find(i => i.dataset.label.includes('pH'));
              if (ph) { const val = ph.parsed.y; return val < 6 || val > 9 ? '⚠️ Melebihi baku mutu!' : '✅ Dalam batas normal'; }
              return '';
            }
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'JetBrains Mono', size: 10 } } },
        y: { position: 'left', title: { display: true, text: 'pH', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y1: { position: 'right', title: { display: true, text: 'TSS (mg/L)', font: { size: 11 } }, grid: { drawOnChartArea: false } }
      }
    }
  });
}

function renderComplianceDonut(data) {
  destroyChart('donut');
  const ctx = document.getElementById('chart-compliance-donut');
  if (!ctx) return;
  const rate = parseFloat(data.complianceRate) || 100;
  chartInstances['donut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Compliant', 'Pelanggaran'],
      datasets: [{ data: [rate, 100 - rate], backgroundColor: ['#22c55e', '#fee2e2'], borderColor: ['#16a34a', '#fca5a5'], borderWidth: 2, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed.toFixed(1) + '%' } } }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx: c, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        c.save();
        c.font = 'bold 22px JetBrains Mono';
        c.fillStyle = rate >= 80 ? '#15803d' : rate >= 60 ? '#b45309' : '#dc2626';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(rate.toFixed(1) + '%', cx, cy - 8);
        c.font = '500 11px Montserrat';
        c.fillStyle = '#94a3b8';
        c.fillText('Compliant', cx, cy + 14);
        c.restore();
      }
    }]
  });
}

function renderPondBarChart(data) {
  destroyChart('pond');
  const ctx = document.getElementById('chart-pond-compliance');
  if (!ctx) return;
  const pondData = data.pondCompliance || [];
  if (!pondData.length) return;
  chartInstances['pond'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pondData.map(p => p.pond),
      datasets: [{
        label: 'Compliance Rate (%)',
        data: pondData.map(p => p.rate),
        backgroundColor: pondData.map(p => p.rate >= 80 ? 'rgba(34,197,94,0.8)' : p.rate >= 60 ? 'rgba(251,191,36,0.8)' : 'rgba(239,68,68,0.8)'),
        borderColor: pondData.map(p => p.rate >= 80 ? '#16a34a' : p.rate >= 60 ? '#d97706' : '#dc2626'),
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'Compliant: ' + ctx.parsed.y + '% (' + pondData[ctx.dataIndex]?.total + ' sampel)' } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 10 } } },
        y: { min: 0, max: 100, title: { display: true, text: '%', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });
}

function destroyChart(key) {
  if (chartInstances[key]) { try { chartInstances[key].destroy(); } catch (e) {} chartInstances[key] = null; }
}

// ============================================================
// 6. FORM HARIAN
// ============================================================
function prefillFormHarian() {
  const now = new Date();
  document.getElementById('fh-tanggal').value = now.toISOString().slice(0, 10);
  document.getElementById('fh-jam').value = now.toTimeString().slice(0, 5);
  updateSensorThresholdLabels();
}
document.querySelectorAll('.flow-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.flow-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
}));

document.getElementById('btn-gps').addEventListener('click', captureCurrentGPS);
function captureCurrentGPS() {
  if (!navigator.geolocation) { Swal.fire('Tidak Didukung', 'Perangkat tidak mendukung GPS.', 'warning'); return; }
  const indicator = document.getElementById('gps-indicator');
  indicator.classList.remove('hidden'); indicator.textContent = 'Mencari sinyal…'; indicator.className = 'gps-status-indicator medium';
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude, accuracy } = pos.coords;
    document.getElementById('fh-koord-gps').value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    let cls = 'high', label = `Akurasi Tinggi (±${accuracy.toFixed(1)}m)`;
    if (accuracy > 30) { cls = 'low'; label = `Akurasi Rendah (±${accuracy.toFixed(1)}m)`; }
    else if (accuracy > 10) { cls = 'medium'; label = `Akurasi Sedang (±${accuracy.toFixed(1)}m)`; }
    indicator.className = 'gps-status-indicator ' + cls; indicator.textContent = label;
  }, err => { indicator.classList.add('hidden'); Swal.fire('Gagal Mengambil Lokasi', err.message, 'error'); }, { enableHighAccuracy: true, timeout: 10000 });
}

function updateSensorThresholdLabels() {
  const map = { PH: { id: 'ph', unit: '' }, TSS: { id: 'tss', unit: 'mg/L' }, FE: { id: 'fe', unit: 'mg/L' }, MN: { id: 'mn', unit: 'mg/L' } };
  AppState.bakuMutu.forEach(b => {
    const m = map[b.Param_Code]; if (!m) return;
    const el = document.getElementById('sensor-threshold-' + m.id);
    if (el) el.textContent = `Baku Mutu: ${b.Batas_Min} – ${b.Batas_Max} ${b.Satuan !== '-' ? b.Satuan : ''}`.trim();
  });
}

document.querySelectorAll('.param-input').forEach(input => input.addEventListener('input', () => validateThresholdInput(input)));
function validateThresholdInput(input) {
  const code = input.getAttribute('data-param');
  const rule = AppState.bakuMutu.find(b => b.Param_Code === code);
  if (!rule) return;
  const idMap = { PH: 'ph', TSS: 'tss', FE: 'fe', MN: 'mn' };
  const suffix = idMap[code];
  const val = parseFloat(input.value);
  const outOfBounds = !isNaN(val) && (val < Number(rule.Batas_Min) || val > Number(rule.Batas_Max));
  document.getElementById('sensor-card-' + suffix).classList.toggle('violation', outOfBounds);
  const badge = document.getElementById('sensor-badge-' + suffix);
  badge.textContent = outOfBounds ? 'PELANGGARAN' : 'COMPLIANT';
  badge.className = 'badge ' + (outOfBounds ? 'badge-violation' : 'badge-compliant');
  document.getElementById('fh-anomaly-banner').classList.toggle('hidden', !document.querySelectorAll('.sensor-card.violation').length);
}

document.querySelector('label.photo-add-btn').addEventListener('click', () => document.getElementById('fh-photo-input').click());
document.getElementById('fh-photo-input').addEventListener('change', async function (e) {
  const files = Array.from(e.target.files);
  if (AppState.photos.length + files.length > 5) { Swal.fire('Batas Foto', 'Maksimal 5 foto per pemantauan.', 'warning'); return; }
  for (const file of files) { AppState.photos.push(await compressImage(file, 1280, 0.7)); renderPhotoGallery(); }
  e.target.value = '';
});

function compressImage(file, maxWidth = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = evt.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

function renderPhotoGallery() {
  const gallery = document.getElementById('photo-gallery');
  const addBtn = gallery.querySelector('label.photo-add-btn');
  gallery.querySelectorAll('.preview-gallery-item').forEach(el => el.remove());
  AppState.photos.forEach((base64, idx) => {
    const div = document.createElement('div'); div.className = 'preview-gallery-item';
    div.innerHTML = `<img src="${base64}"><button type="button" class="remove-btn" data-idx="${idx}">&times;</button>`;
    gallery.insertBefore(div, addBtn);
  });
  gallery.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', () => { AppState.photos.splice(Number(btn.getAttribute('data-idx')), 1); renderPhotoGallery(); }));
  addBtn.style.display = AppState.photos.length >= 5 ? 'none' : 'flex';
}

function saveDraftLocal(payload) { try { localStorage.setItem(LOCALSTORAGE_DRAFT_KEY, JSON.stringify(payload)); } catch (e) {} }
function checkDraftLocal() {
  const raw = localStorage.getItem(LOCALSTORAGE_DRAFT_KEY);
  if (raw) {
    Swal.fire({ icon: 'info', title: 'Draf Tersimpan Ditemukan', text: 'Terdapat data pemantauan yang belum terkirim. Kirim sekarang?', showCancelButton: true, confirmButtonText: 'Kirim Sekarang', cancelButtonText: 'Nanti' })
      .then(res => { if (res.isConfirmed) submitDailyLogPayload(JSON.parse(raw)); });
  }
}

document.getElementById('form-harian').addEventListener('submit', function (e) {
  e.preventDefault();
  const flowBtn = document.querySelector('.flow-btn.active');
  submitDailyLogPayload({
    Pond_ID: document.getElementById('fh-pond').value,
    Titik_Aliran: flowBtn ? flowBtn.getAttribute('data-val') : 'OUTLET',
    Tanggal_Sampling: document.getElementById('fh-tanggal').value,
    Jam_Sampling: document.getElementById('fh-jam').value,
    Koordinat_Manual: document.getElementById('fh-koord-manual').value,
    Koordinat_GPS: document.getElementById('fh-koord-gps').value,
    Nilai_pH: document.getElementById('fh-ph').value,
    Nilai_TSS: document.getElementById('fh-tss').value,
    Nilai_Fe: document.getElementById('fh-fe').value,
    Nilai_Mn: document.getElementById('fh-mn').value,
    Debit_Air: document.getElementById('fh-debit').value,
    Curah_Hujan: document.getElementById('fh-hujan').value,
    fotos: AppState.photos
  });
});

async function submitDailyLogPayload(payload) {
  saveDraftLocal(payload);
  try {
    const res = await callServer('apiSaveDailyLog', AppState.token, payload);
    localStorage.removeItem(LOCALSTORAGE_DRAFT_KEY);
    AppState.photos = []; renderPhotoGallery();
    document.getElementById('form-harian').reset(); prefillFormHarian();
    document.getElementById('gps-indicator').classList.add('hidden');
    document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('violation'));
    document.querySelectorAll('.badge[id^="sensor-badge-"]').forEach(b => { b.textContent = 'COMPLIANT'; b.className = 'badge badge-compliant'; });
    document.getElementById('fh-anomaly-banner').classList.add('hidden');

    if (res.Status_Mutu === 'MELEBIHI BAKU MUTU') {
      Swal.fire({ icon: 'warning', title: 'Pelanggaran Baku Mutu Terdeteksi!', html: `Parameter: <b>${res.Pelanggaran}</b><br>Segera buka Disposisi & Investigasi.`, confirmButtonText: 'Buka Disposisi' })
        .then(r => { if (r.isConfirmed) { navigateTo('disposisi-investigasi'); openDisposisiModal(res.Log_ID, res.Pelanggaran, payload.Pond_ID); } });
    } else {
      Swal.fire({ icon: 'success', title: 'Data Tersimpan', text: 'Status Mutu: NORMAL', timer: 2000, showConfirmButton: false });
    }
    refreshDisposisiBadge();
    if (AppState.currentView === 'log-table') refreshLogTable();
    if (AppState.currentView === 'dashboard') refreshDashboard();
    if (AppState.currentView === 'laporan') refreshReportTable();
  } catch (err) {
    Swal.fire('Tersimpan Sebagai Draf', 'Koneksi bermasalah. Data akan dikirim ulang otomatis.', 'info');
  }
}

// ============================================================
// 7. LEDGER LOG HARIAN
// ============================================================
async function refreshLogTable() {
  const filters = {
    startDate: document.getElementById('filter-start').value,
    endDate: document.getElementById('filter-end').value,
    pondId: document.getElementById('filter-pond').value,
    statusMutu: document.getElementById('filter-status').value
  };
  const rows = await callServer('apiGetDailyLogs', AppState.token, filters);

  if (!rows || !rows.length) {
    document.getElementById('log-table-body').innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding:2rem;">Belum ada data. Gunakan Form Lapangan untuk input data.</td></tr>';
    document.getElementById('ledger-audit-strip').innerHTML = 'Total sampel: <b>0</b>';
    return;
  }

  document.getElementById('log-table-body').innerHTML = rows.map(r => `
    <tr>
      <td class="mono" style="font-size:11px;">${r.Log_ID}</td>
      <td class="mono" style="font-size:11px;">${formatDisplayDate(r.Tanggal_Sampling)} ${formatDisplayTime(r.Jam_Sampling)}</td>
      <td>${r.Pond_ID}</td><td>${r.Titik_Aliran}</td>
      <td class="numeric">${Number(r.Nilai_pH).toFixed(2)}</td>
      <td class="numeric">${Number(r.Nilai_TSS).toFixed(1)}</td>
      <td class="numeric">${Number(r.Nilai_Fe).toFixed(2)}</td>
      <td class="numeric">${Number(r.Nilai_Mn).toFixed(2)}</td>
      <td><span class="badge ${r.Status_Mutu === 'NORMAL' ? 'badge-compliant' : 'badge-violation'}">${r.Status_Mutu}</span></td>
      <td><span class="badge badge-info" style="font-size:9.5px;">${r.Status_Validasi || 'DRAFT'}</span></td>
      <td style="white-space:nowrap;">
        ${AppState.session.role !== 'OPERATOR' && r.Status_Validasi === 'DRAFT'
          ? `<button class="btn btn-sm btn-outline" onclick="verifyLog('${r.Log_ID}','VERIFIED_SPV')"><i class="fa-solid fa-check me-1"></i>Verifikasi</button>` : ''}
        ${AppState.session.role === 'MANAJEMEN' && r.Status_Validasi === 'VERIFIED_SPV'
          ? `<button class="btn btn-sm btn-primary" onclick="verifyLog('${r.Log_ID}','APPROVED_KTT')">Setujui</button>` : ''}
        ${r.Status_Mutu !== 'NORMAL' && AppState.session.role !== 'OPERATOR'
          ? `<button class="btn btn-sm btn-danger ms-1" onclick="openDisposisiModal('${r.Log_ID}','${r.Status_Mutu}','${r.Pond_ID}')"><i class="fa-solid fa-triangle-exclamation"></i></button>` : ''}
        <button class="btn btn-sm btn-outline ms-1 text-danger" style="border-color:#FCA5A5;color:#DC2626;" onclick="deleteDailyLog('${r.Log_ID}')" title="Hapus Data"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');

  const normal = rows.filter(r => r.Status_Mutu === 'NORMAL').length;
  const melebihi = rows.length - normal;
  const pendingSpv = rows.filter(r => r.Status_Validasi === 'DRAFT').length;
  const pendingKtt = rows.filter(r => r.Status_Validasi === 'VERIFIED_SPV').length;
  document.getElementById('ledger-audit-strip').innerHTML = `Total: <b>${rows.length}</b> · Normal: <b>${normal}</b> · Melebihi Baku: <b style="color:var(--violation-text);">${melebihi}</b> · Pending SPV: <b>${pendingSpv}</b> · Pending KTT: <b>${pendingKtt}</b>`;
}

['filter-start', 'filter-end', 'filter-pond', 'filter-status'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', refreshLogTable);
});

async function verifyLog(logId, status) {
  await callServer('apiVerifyDailyLog', AppState.token, logId, status);
  Swal.fire({ icon: 'success', title: 'Status Diperbarui', timer: 1500, showConfirmButton: false });
  refreshLogTable(); refreshDashboard();
}

async function deleteDailyLog(logId) {
  const result = await Swal.fire({
    title: 'Hapus Data Sampling?',
    text: `Data log ${logId} akan dihapus secara permanen dari sistem.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#64748B',
    confirmButtonText: '<i class="fa-solid fa-trash me-1"></i> Ya, Hapus',
    cancelButtonText: 'Batal'
  });
  if (!result.isConfirmed) return;
  try {
    await callServer('apiDeleteDailyLog', AppState.token, logId);
    Swal.fire({ icon: 'success', title: 'Data Berhasil Dihapus', timer: 1500, showConfirmButton: false });
    refreshLogTable(); refreshDashboard();
  } catch (err) {
    Swal.fire('Gagal Menghapus', err.message || 'Terjadi kesalahan.', 'error');
  }
}

// ============================================================
// 8. DISPOSISI & INVESTIGASI
// ============================================================
async function refreshDisposisiList() {
  const rows = await callServer('apiGetDisposisiList', AppState.token, {});
  document.getElementById('disp-kpi-open').textContent = rows.filter(r => r.Status_Penanganan === 'OPEN').length;
  document.getElementById('disp-kpi-progress').textContent = rows.filter(r => r.Status_Penanganan === 'IN_PROGRESS').length;
  document.getElementById('disp-kpi-resolved').textContent = rows.filter(r => r.Status_Penanganan === 'RESOLVED').length;

  document.getElementById('disposisi-list').innerHTML = rows.map(r => `
    <div class="incident-card ${r.Status_Penanganan.toLowerCase()}">
      <div class="incident-header">
        <span class="incident-id">${r.Disposisi_ID} · ${r.Pond_ID}</span>
        <span class="badge ${r.Status_Penanganan === 'OPEN' ? 'badge-violation' : r.Status_Penanganan === 'IN_PROGRESS' ? 'badge-warning' : 'badge-compliant'}">${r.Status_Penanganan.replace('_', ' ')}</span>
      </div>
      <div class="incident-grid">
        <div class="incident-param-box"><div class="incident-field-label">Parameter</div><div class="val">${r.Parameter_Melanggar}</div></div>
        <div><div class="incident-field-label">Instruksi</div><div style="font-size:12.5px;">${r.Instruksi_Tindak_Lanjut || '-'}</div></div>
        <div><div class="incident-field-label">PIC</div><div style="font-size:12.5px;">${r.PIC_Tindak_Lanjut || '-'}</div></div>
      </div>
      <div class="incident-field-label">Temuan</div>
      <p style="font-size:12.5px;margin-bottom:.7rem;">${r.Temuan_Investigasi || '-'}</p>
      <div class="d-flex gap-2 flex-wrap align-items-center">
        ${r.Status_Penanganan === 'OPEN' ? `<button class="btn btn-sm btn-outline" onclick="updateInvestigasi('${r.Disposisi_ID}','IN_PROGRESS')">Mulai Investigasi</button>` : ''}
        ${r.Status_Penanganan === 'IN_PROGRESS' && !r.Verified_By ? `<button class="btn btn-sm btn-outline" onclick="verifyDisposisiRole('${r.Disposisi_ID}','SUPERVISOR')">Verifikasi SPV</button>` : ''}
        ${r.Verified_By && r.Status_Penanganan !== 'RESOLVED' ? `<button class="btn btn-sm btn-primary" onclick="verifyDisposisiRole('${r.Disposisi_ID}','MANAJEMEN')">Approve KTT</button>` : ''}
        <button class="btn btn-sm btn-danger ms-auto" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;" onclick="deleteDisposisi('${r.Disposisi_ID}')"><i class="fa-solid fa-trash me-1"></i>Hapus</button>
      </div>
    </div>`).join('') || '<p class="text-muted">Belum ada disposisi tindak lanjut.</p>';
}

async function deleteDisposisi(disposisiId) {
  const result = await Swal.fire({
    title: 'Hapus Disposisi?',
    text: `Disposisi ${disposisiId} akan dihapus secara permanen.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal'
  });
  if (result.isConfirmed) {
    try {
      await callServer('apiDeleteDisposisi', AppState.token, disposisiId);
      Swal.fire({ icon: 'success', title: 'Disposisi Dihapus', timer: 1200, showConfirmButton: false });
      refreshDisposisiList();
      refreshDisposisiBadge();
    } catch (e) {}
  }
}

function openDisposisiModal(logId, parameter, pondId) {
  document.getElementById('disp-log-id').value = logId;
  document.getElementById('disp-parameter').value = parameter;
  document.getElementById('disp-log-id').setAttribute('data-pond', pondId);
  document.getElementById('modal-disposisi').classList.add('active');
}
document.getElementById('close-modal-disposisi').addEventListener('click', () => document.getElementById('modal-disposisi').classList.remove('active'));
document.getElementById('cancel-modal-disposisi').addEventListener('click', () => document.getElementById('modal-disposisi').classList.remove('active'));
document.getElementById('save-modal-disposisi').addEventListener('click', async () => {
  await callServer('apiCreateDisposisiInvestigasi', AppState.token, {
    Log_ID_Ref: document.getElementById('disp-log-id').value,
    Pond_ID: document.getElementById('disp-log-id').getAttribute('data-pond'),
    Parameter_Melanggar: document.getElementById('disp-parameter').value,
    Instruksi_Tindak_Lanjut: document.getElementById('disp-instruksi').value,
    PIC_Tindak_Lanjut: document.getElementById('disp-pic').value,
    Temuan_Investigasi: document.getElementById('disp-temuan').value,
    Target_Selesai: document.getElementById('disp-target').value
  });
  document.getElementById('modal-disposisi').classList.remove('active');
  Swal.fire({ icon: 'success', title: 'Disposisi Tersimpan', timer: 1500, showConfirmButton: false });
  refreshDisposisiList(); refreshDisposisiBadge();
});

async function updateInvestigasi(id, status) {
  const { value: temuan } = await Swal.fire({ title: 'Perbarui Temuan Investigasi', input: 'textarea', inputPlaceholder: 'Tuliskan temuan akar masalah…', showCancelButton: true });
  await callServer('apiUpdateInvestigasiStatus', AppState.token, id, temuan || '', status);
  refreshDisposisiList();
}
async function verifyDisposisiRole(id, role) {
  await callServer('apiVerifyDisposisi', AppState.token, id, role);
  Swal.fire({ icon: 'success', title: role === 'MANAJEMEN' ? 'Insiden Ditutup (KTT)' : 'Terverifikasi SPV', timer: 1500, showConfirmButton: false });
  refreshDisposisiList(); refreshDashboard(); refreshDisposisiBadge();
}

// ============================================================
// 9. LABORATORIUM
// ============================================================
let labPdfBase64Cache = null;
document.getElementById('lab-pdf').addEventListener('change', async function (e) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 8 * 1024 * 1024) { Swal.fire('Ukuran Terlalu Besar', 'Maksimal 8MB.', 'warning'); e.target.value = ''; return; }
  labPdfBase64Cache = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(file); });
});

document.getElementById('form-lab').addEventListener('submit', async function (e) {
  e.preventDefault();
  await callServer('apiSaveLabLog', AppState.token, {
    Bulan_Periode: document.getElementById('lab-periode').value,
    Pond_ID: document.getElementById('lab-pond').value,
    Titik_Aliran: document.getElementById('lab-aliran').value,
    Nama_Laboratorium: document.getElementById('lab-nama').value,
    Nomor_Sertifikat: document.getElementById('lab-sertifikat').value,
    Tanggal_Analisis: document.getElementById('lab-tanggal').value,
    Lab_pH: document.getElementById('lab-ph').value,
    Lab_TSS: document.getElementById('lab-tss').value,
    Lab_Fe: document.getElementById('lab-fe').value,
    Lab_Mn: document.getElementById('lab-mn').value,
    pdfBase64: labPdfBase64Cache
  });
  Swal.fire({ icon: 'success', title: 'Hasil Lab Tersimpan', timer: 1500, showConfirmButton: false });
  document.getElementById('form-lab').reset(); labPdfBase64Cache = null; refreshLabTable();
});

async function refreshLabTable() {
  const rows = await callServer('apiGetLabLogs', AppState.token, {});
  if (!rows || !rows.length) {
    document.getElementById('lab-table-body').innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">Belum ada data hasil lab.</td></tr>';
    return;
  }
  document.getElementById('lab-table-body').innerHTML = rows.map(r => `
    <tr>
      <td class="mono">${formatDisplayMonth(r.Bulan_Periode)}</td>
      <td>${r.Pond_ID}</td>
      <td>${r.Nama_Laboratorium}</td>
      <td class="mono">${r.Nomor_Sertifikat}</td>
      <td class="numeric">${Number(r.Lab_pH).toFixed(2)}</td>
      <td class="numeric">${Number(r.Lab_TSS).toFixed(1)}</td>
      <td>${r.File_PDF_URL ? `<a href="${r.File_PDF_URL}" target="_blank"><i class="fa-solid fa-file-pdf" style="color:var(--violation-text);"></i></a>` : '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline text-danger" style="border-color:#FCA5A5;color:#DC2626;" onclick="deleteLabRecord('${r.Lab_ID}')" title="Hapus Hasil Lab"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

async function deleteLabRecord(labId) {
  const result = await Swal.fire({
    title: 'Hapus Hasil Uji Lab?',
    text: `Data hasil lab ${labId} akan dihapus secara permanen.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#64748B',
    confirmButtonText: '<i class="fa-solid fa-trash me-1"></i> Ya, Hapus',
    cancelButtonText: 'Batal'
  });
  if (!result.isConfirmed) return;
  try {
    await callServer('apiDeleteLabLog', AppState.token, labId);
    Swal.fire({ icon: 'success', title: 'Data Lab Berhasil Dihapus', timer: 1500, showConfirmButton: false });
    refreshLabTable();
  } catch (err) {
    Swal.fire('Gagal Menghapus', err.message || 'Terjadi kesalahan.', 'error');
  }
}

// ============================================================
// 10. PELAPORAN
// ============================================================
async function refreshReportTable() {
  const rows = await callServer('apiGetFilteredLogs', AppState.token,
    document.getElementById('rep-start').value,
    document.getElementById('rep-end').value,
    document.getElementById('rep-pond').value,
    document.getElementById('rep-aliran').value
  );
  AppState.reportFilteredData = rows; AppState.selectedDailyLog = null;

  if (!rows || !rows.length) {
    document.getElementById('rep-table-body').innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">Belum ada data pada rentang ini.</td></tr>';
    return;
  }

  document.getElementById('rep-table-body').innerHTML = rows.map((r, idx) => `
    <tr>
      <td><button type="button" class="btn btn-sm btn-outline" onclick="selectDailyLogForReport(${idx})"><i class="fa-solid fa-check me-1"></i>Pilih</button></td>
      <td class="mono" style="font-size:11px;">${r.Tanggal_Sampling}</td>
      <td>${r.Pond_ID}</td><td>${r.Titik_Aliran}</td>
      <td class="numeric">${Number(r.Nilai_pH).toFixed(2)}</td>
      <td class="numeric">${Number(r.Nilai_TSS).toFixed(1)}</td>
      <td class="numeric">${Number(r.Nilai_Fe).toFixed(2)}</td>
      <td class="numeric">${Number(r.Nilai_Mn).toFixed(2)}</td>
      <td><span class="badge ${r.Status_Mutu === 'NORMAL' ? 'badge-compliant' : 'badge-violation'}">${r.Status_Mutu}</span></td>
    </tr>`).join('');
  updateHarianSelectionPanel();
}

async function refreshLaporanList() {
  const filters = AppState.session.role === 'OPERATOR' ? { mine: true } : {};
  try {
    const rows = await callServer('apiGetLaporanList', AppState.token, filters);
    const tbody = document.getElementById('laporan-list-body');
    if (!tbody) return;
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:1.5rem;">Belum ada laporan dikirim.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const statusBadge = {
        'MENUNGGU_REVIEW_SPV': '<span class="badge badge-warning">Menunggu SPV</span>',
        'MENUNGGU_APPROVE_KTT': '<span class="badge badge-warning" style="background:#dbeafe;color:#1d4ed8;">Menunggu KTT</span>',
        'FINAL_APPROVED': '<span class="badge badge-compliant">✅ Final</span>',
        'DIKEMBALIKAN': '<span class="badge badge-violation">Dikembalikan</span>'
      }[r.Status_Laporan] || `<span class="badge badge-info">${r.Status_Laporan || '-'}</span>`;

      const reviewBtn = AppState.session.role === 'SUPERVISOR' && r.Status_Laporan === 'MENUNGGU_REVIEW_SPV'
        ? `<button class="btn btn-sm btn-primary" onclick="openReviewModal('${r.Report_ID}')"><i class="fa-solid fa-pen-to-square me-1"></i>Review</button>` : '';
      const approveBtn = AppState.session.role === 'MANAJEMEN' && r.Status_Laporan === 'MENUNGGU_APPROVE_KTT'
        ? `<button class="btn btn-sm btn-primary" onclick="openApproveKTTModal('${r.Report_ID}')"><i class="fa-solid fa-file-signature me-1"></i>Setujui</button>` : '';
      const printBtn = r.Status_Laporan === 'FINAL_APPROVED'
        ? `<button class="btn btn-sm btn-outline" onclick="printFinalReport('${r.Report_ID}')"><i class="fa-solid fa-print me-1"></i>Cetak</button>` : '';
      const deleteBtn = `<button class="btn btn-sm btn-danger ms-1" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;" onclick="deleteLaporan('${r.Report_ID}')"><i class="fa-solid fa-trash me-1"></i>Hapus</button>`;

      return `<tr>
        <td class="mono" style="font-size:10px;">${r.Report_ID}</td>
        <td style="font-size:11px;">${r.Tipe_Laporan}</td>
        <td class="mono" style="font-size:10px;">${r.Nomor_Sampel || '-'}</td>
        <td>${statusBadge}</td>
        <td>${r.Reviewed_By_SPV || '-'}</td>
        <td style="white-space:nowrap;">${reviewBtn} ${approveBtn} ${printBtn} ${deleteBtn}</td>
      </tr>`;
    }).join('');
  } catch (e) {}
}

async function deleteLaporan(reportId) {
  const result = await Swal.fire({
    title: 'Hapus Laporan Resmi?',
    text: `Laporan ${reportId} akan dihapus secara permanen.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal'
  });
  if (result.isConfirmed) {
    try {
      await callServer('apiDeleteLaporan', AppState.token, reportId);
      Swal.fire({ icon: 'success', title: 'Laporan Dihapus', timer: 1200, showConfirmButton: false });
      refreshLaporanList();
    } catch (e) {}
  }
}

document.getElementById('btn-rep-filter').addEventListener('click', refreshReportTable);

// ── Open Modal Pelaporan ──
document.getElementById('btn-open-report-modal').addEventListener('click', () => {
  const modal = document.getElementById('modalReportConfig');
  modal.classList.add('active');

  // Update button label & modal subtitle based on user role
  const role = AppState.session.role;
  const sendLabel = document.getElementById('btn-send-label');
  const subTitle = document.getElementById('modal-report-subtitle');

  if (role === 'SUPERVISOR') {
    if (sendLabel) sendLabel.textContent = 'Kirim ke KTT';
    if (subTitle) subTitle.textContent = 'Konfigurasi, generate nomor sampel, kirim ke KTT untuk persetujuan & tanda tangan final';
  } else if (role === 'MANAJEMEN') {
    if (sendLabel) sendLabel.textContent = 'Simpan Draft';
    if (subTitle) subTitle.textContent = 'Konfigurasi, generate nomor sampel, simpan draf laporan resmi';
  } else if (role === 'ADMIN') {
    if (sendLabel) sendLabel.textContent = 'Kirim ke KTT';
    if (subTitle) subTitle.textContent = 'Konfigurasi, generate nomor sampel, kelola dan proses laporan resmi';
  } else {
    // OPERATOR
    if (sendLabel) sendLabel.textContent = 'Kirim ke Supervisor';
    if (subTitle) subTitle.textContent = 'Konfigurasi, generate nomor sampel, kirim ke Supervisor untuk review & tanda tangan';
  }

  // Set default dates if empty
  const todayStr = new Date().toISOString().slice(0, 10);
  const harianDateInput = document.getElementById('rep-harian-tanggal');
  if (harianDateInput && !harianDateInput.value) harianDateInput.value = todayStr;

  const startModalInput = document.getElementById('rep-start-modal');
  if (startModalInput && !startModalInput.value) {
    startModalInput.value = document.getElementById('rep-start').value || todayStr;
  }
  const endModalInput = document.getElementById('rep-end-modal');
  if (endModalInput && !endModalInput.value) {
    endModalInput.value = document.getElementById('rep-end').value || todayStr;
  }

  populateReportAreaDropdown();
  toggleReportModeUI();
});

document.getElementById('close-modal-report').addEventListener('click', () => {
  document.getElementById('modalReportConfig').classList.remove('active');
});

document.getElementById('rep-jenis-dokumen').addEventListener('change', () => {
  toggleReportModeUI();
});

function populateReportAreaDropdown() {
  const areaSelect = document.getElementById('rep-area-kode-select');
  if (!areaSelect) return;
  areaSelect.innerHTML = '<option value="">— Semua / Pilih Settling Pond —</option>';
  AppState.ponds.forEach(p => {
    areaSelect.innerHTML += `<option value="${p.Pond_ID}" data-nama="${p.Nama_Pond}">${p.Pond_ID} — ${p.Nama_Pond}</option>`;
  });
  if (AppState.selectedDailyLog) {
    areaSelect.value = AppState.selectedDailyLog.Pond_ID;
    document.getElementById('rep-area-kode').value = AppState.selectedDailyLog.Pond_ID;
  }
}

document.getElementById('rep-area-kode-select')?.addEventListener('change', function () {
  document.getElementById('rep-area-kode').value = this.value;
  updateGeneratedSampleNumber();
  const jenis = document.getElementById('rep-jenis-dokumen').value;
  if (jenis === 'HARIAN') {
    fetchModalHarianData();
  } else {
    fetchModalBulananSummary();
  }
});

// Listener tanggal harian & periode bulanan
document.getElementById('rep-harian-tanggal')?.addEventListener('change', () => {
  updateGeneratedSampleNumber();
  fetchModalHarianData();
});
document.getElementById('rep-start-modal')?.addEventListener('change', () => {
  fetchModalBulananSummary();
});
document.getElementById('rep-end-modal')?.addEventListener('change', () => {
  fetchModalBulananSummary();
});

function updateGeneratedSampleNumber() {
  let pondName = 'UMUM', aliran = document.getElementById('rep-aliran')?.value || 'OUTLET';
  const pondKode = document.getElementById('rep-area-kode').value || document.getElementById('rep-area-kode-select')?.value;
  if (pondKode) {
    const pond = AppState.ponds.find(p => p.Pond_ID === pondKode);
    if (pond) pondName = pond.Nama_Pond.split(' ').pop();
  }
  const dateVal = document.getElementById('rep-harian-tanggal')?.value;
  document.getElementById('rep-nomor-sampel').value = generateSampleNumber(pondName, aliran, dateVal);
}

function toggleReportModeUI() {
  const jenis = document.getElementById('rep-jenis-dokumen').value;
  const isHarian = jenis === 'HARIAN';

  const dateHarianRow = document.getElementById('rep-date-harian-row');
  const periodBulananRow = document.getElementById('rep-period-bulanan-row');
  const tableWrap = document.getElementById('rep-modal-table-wrap');
  const bulananSummary = document.getElementById('rep-bulanan-summary');

  if (dateHarianRow) dateHarianRow.classList.toggle('hidden', !isHarian);
  if (periodBulananRow) periodBulananRow.classList.toggle('hidden', isHarian);
  if (tableWrap) tableWrap.classList.toggle('hidden', !isHarian);
  if (bulananSummary) bulananSummary.classList.toggle('hidden', isHarian);

  updateGeneratedSampleNumber();

  if (isHarian) {
    fetchModalHarianData();
  } else {
    fetchModalBulananSummary();
  }
}

function formatJam(val) {
  if (!val) return '-';
  const s = String(val).trim();
  if (s.includes('T')) {
    const timePart = s.split('T')[1];
    return timePart.slice(0, 5);
  }
  return s.slice(0, 5);
}

// ── Ambil Data Sampel Harian untuk Tabel Modal ──
async function fetchModalHarianData() {
  const dateInput = document.getElementById('rep-harian-tanggal');
  const date = dateInput ? dateInput.value : '';
  if (!date) return;

  const pond = document.getElementById('rep-area-kode').value || document.getElementById('rep-area-kode-select')?.value || '';
  const loading = document.getElementById('rep-modal-table-loading');
  const tableWrap = document.getElementById('rep-modal-table-wrap');
  const tbody = document.getElementById('rep-modal-table-body');
  const countEl = document.getElementById('rep-modal-table-count');
  const photoWrap = document.getElementById('rep-modal-photo-strip-wrap');
  const photoStrip = document.getElementById('rep-modal-photo-strip');

  if (loading) loading.classList.remove('hidden');

  try {
    const rows = await callServer('apiGetFilteredLogs', AppState.token, date, date, pond, '');
    AppState.modalHarianRows = rows || [];

    if (loading) loading.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');

    if (!rows || !rows.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:1.2rem;">Tidak ada data pemantauan pada tanggal ${date}${pond ? ' (' + pond + ')' : ''}.</td></tr>`;
      if (countEl) countEl.innerHTML = 'Total: <b>0 sampel</b>';
      if (photoWrap) photoWrap.classList.remove('hidden');
      if (photoStrip) photoStrip.innerHTML = '<div class="photo-empty"><i class="fa-solid fa-camera me-1"></i>Tidak ada foto dokumentasi.</div>';
    } else {
      if (tbody) {
        tbody.innerHTML = rows.map(r => `
          <tr>
            <td class="mono"><b>${formatJam(r.Jam_Sampling)}</b></td>
            <td><b>${r.Pond_ID}</b></td>
            <td>${r.Titik_Aliran || '-'}</td>
            <td class="numeric">${Number(r.Nilai_pH || 0).toFixed(2)}</td>
            <td class="numeric">${Number(r.Nilai_TSS || 0).toFixed(1)}</td>
            <td class="numeric">${Number(r.Nilai_Fe || 0).toFixed(2)}</td>
            <td class="numeric">${Number(r.Nilai_Mn || 0).toFixed(2)}</td>
            <td><span class="badge ${r.Status_Mutu === 'NORMAL' ? 'badge-compliant' : 'badge-violation'}">${r.Status_Mutu}</span></td>
          </tr>
        `).join('');
      }
      const normalCount = rows.filter(r => r.Status_Mutu === 'NORMAL').length;
      const melebihiCount = rows.length - normalCount;
      if (countEl) {
        countEl.innerHTML = `Total: <b>${rows.length} sampel</b> (${normalCount} Normal, <span style="color:var(--violation-text);font-weight:700;">${melebihiCount} Melebihi Baku</span>)`;
      }

      // Ambil seluruh foto dari seluruh sampel pada tanggal ini
      let allPhotos = [];
      rows.forEach(r => {
        try {
          const arr = JSON.parse(r.Foto_Urls || '[]');
          if (Array.isArray(arr)) {
            arr.forEach(u => {
              if (u && typeof u === 'string' && u.trim()) {
                allPhotos.push({ url: u, pond: r.Pond_ID, jam: r.Jam_Sampling, aliran: r.Titik_Aliran });
              }
            });
          }
        } catch (e) {}
      });

      if (photoWrap) photoWrap.classList.remove('hidden');
      if (photoStrip) {
        if (allPhotos.length) {
          photoStrip.innerHTML = allPhotos.map(p => `
            <img src="${p.url}" title="Pond: ${p.pond} (${p.aliran}) - Jam ${p.jam}" alt="Dokumentasi" onclick="window.open('${p.url}', '_blank')">
          `).join('');
        } else {
          photoStrip.innerHTML = '<div class="photo-empty"><i class="fa-solid fa-camera me-1"></i>Belum ada foto dokumentasi pada data tanggal ini.</div>';
        }
      }
    }
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-danger" style="text-align:center;padding:1rem;">Gagal memuat data: ${err.message || err}</td></tr>`;
  }

  updateSignaturePreview();
}

// ── Ringkasan Bulanan pada Modal ──
async function fetchModalBulananSummary() {
  const start = document.getElementById('rep-start-modal')?.value || '';
  const end = document.getElementById('rep-end-modal')?.value || '';
  const pond = document.getElementById('rep-area-kode').value || document.getElementById('rep-area-kode-select')?.value || '';
  const summaryEl = document.getElementById('rep-bulanan-summary-text');

  if (!start && !end) {
    if (summaryEl) summaryEl.innerHTML = 'Pilih rentang tanggal untuk melihat ringkasan data.';
    return;
  }

  try {
    const rows = await callServer('apiGetFilteredLogs', AppState.token, start, end, pond, '');
    AppState.modalBulananRows = rows || [];
    AppState.reportFilteredData = rows || [];

    const normal = (rows || []).filter(r => r.Status_Mutu === 'NORMAL').length;
    const melebihi = (rows || []).length - normal;
    if (summaryEl) {
      summaryEl.innerHTML = `Periode <b>${start || 'Awal'}</b> s/d <b>${end || 'Akhir'}</b>${pond ? ' (' + pond + ')' : ''}: Ditemukan <b>${(rows || []).length} sampel</b> (${normal} Normal, <b style="color:var(--violation-text);">${melebihi} Melebihi</b>).`;
    }
  } catch (e) {}

  updateSignaturePreview();
}

function selectDailyLogForReport(idx) {
  AppState.selectedDailyLog = AppState.reportFilteredData[idx];
  const pondKode = AppState.selectedDailyLog.Pond_ID;
  document.getElementById('rep-area-kode').value = pondKode;
  const areaSelect = document.getElementById('rep-area-kode-select');
  if (areaSelect) { areaSelect.value = pondKode; }
  document.getElementById('rep-jenis-dokumen').value = 'HARIAN';

  const tanggal = AppState.selectedDailyLog.Tanggal_Sampling;
  if (tanggal && document.getElementById('rep-harian-tanggal')) {
    document.getElementById('rep-harian-tanggal').value = tanggal;
  }

  document.getElementById('modalReportConfig').classList.add('active');
  toggleReportModeUI();
  Swal.fire({ icon: 'success', title: 'Baris Data Dipilih', text: `Tanggal: ${tanggal} · Pond: ${pondKode}`, timer: 1400, showConfirmButton: false });
}

async function getSignatureNamesForCurrentSelection() {
  const isHarian = document.getElementById('rep-jenis-dokumen').value === 'HARIAN';
  const rows = isHarian
    ? ((AppState.modalHarianRows && AppState.modalHarianRows.length) ? AppState.modalHarianRows : (AppState.selectedDailyLog ? [AppState.selectedDailyLog] : []))
    : ((AppState.modalBulananRows && AppState.modalBulananRows.length) ? AppState.modalBulananRows : (AppState.reportFilteredData || []));
  return callServer('apiGetSignatureNames', AppState.token, rows);
}

async function updateSignaturePreview() {
  try {
    const sig = await getSignatureNamesForCurrentSelection();
    const previewEl = document.getElementById('rep-signature-preview');
    if (previewEl) {
      previewEl.innerHTML = `1. Dibuat oleh: <b>${sig.dibuatOleh || '(Operator Lapangan)'}</b><br>2. Diperiksa oleh: <b>${sig.diperiksaOleh || '(Supervisor Lingkungan)'}</b><br>3. Disetujui oleh: <b>${sig.disetujuiOleh || '(Kepala Teknik Tambang)'}</b>`;
    }
  } catch (e) {}
}

function generateSampleNumber(pondName, aliran, customDate) {
  const dateObj = customDate ? new Date(customDate) : new Date();
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yy = String(dateObj.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}/SP-${(pondName || 'UMUM').replace(/\s+/g, '').toUpperCase()}/${(aliran || 'OUTLET').toUpperCase()}`;
}

document.getElementById('btn-gen-nomor').addEventListener('click', updateGeneratedSampleNumber);

// ── Submit / Kirim Laporan Sesuai Role ──
document.getElementById('btn-send-to-spv')?.addEventListener('click', async () => {
  const nomor = document.getElementById('rep-nomor-sampel').value.trim();
  const sumber = document.getElementById('rep-sumber-limbah').value;
  const areaKode = document.getElementById('rep-area-kode').value || document.getElementById('rep-area-kode-select')?.value || 'SEMUA_POND';
  const tipe = document.getElementById('rep-jenis-dokumen').value;
  const isHarian = tipe === 'HARIAN';

  const tanggalMulai = isHarian
    ? document.getElementById('rep-harian-tanggal').value
    : (document.getElementById('rep-start-modal').value || document.getElementById('rep-start').value);
  const tanggalSelesai = isHarian
    ? document.getElementById('rep-harian-tanggal').value
    : (document.getElementById('rep-end-modal').value || document.getElementById('rep-end').value);

  if (isHarian && (!AppState.modalHarianRows || !AppState.modalHarianRows.length)) {
    Swal.fire('Data Sampel Kosong', 'Tidak ada data pemantauan pada tanggal ini untuk dibuatkan laporan.', 'warning');
    return;
  }
  if (!nomor) {
    Swal.fire('Nomor Sampel Wajib', 'Harap isi atau klik tombol Generate Nomor Sampel.', 'warning');
    return;
  }

  const sig = await getSignatureNamesForCurrentSelection();
  const role = AppState.session.role;

  try {
    const res = await callServer('apiSendReportToSupervisor', AppState.token, {
      Nomor_Sampel: nomor,
      Sumber_Limbah: sumber,
      Tipe_Laporan: tipe,
      Pond_ID: areaKode,
      Periode_Mulai: tanggalMulai,
      Periode_Selesai: tanggalSelesai,
      Nama_Dibuat_Oleh: sig.dibuatOleh,
      Nama_Diperiksa_Oleh: sig.diperiksaOleh,
      Nama_Disetujui_Oleh: sig.disetujuiOleh
    });

    document.getElementById('modalReportConfig').classList.remove('active');

    // Jika pengirim adalah SUPERVISOR atau ADMIN, langsung teruskan ke KTT (Status: MENUNGGU_APPROVE_KTT)
    if (role === 'SUPERVISOR' || role === 'ADMIN') {
      try {
        await callServer('apiReviewReport', AppState.token, res.Report_ID, 'Dibuat & diteruskan langsung oleh ' + roleLabel(role), 'APPROVE');
      } catch (revErr) {}

      Swal.fire({
        icon: 'success',
        title: 'Laporan Diteruskan ke KTT',
        html: `ID Laporan: <b>${res.Report_ID}</b><br>Laporan berhasil dikirim dan menunggu persetujuan Kepala Teknik Tambang (KTT).`,
        timer: 3500,
        showConfirmButton: false
      });
    } else if (role === 'MANAJEMEN') {
      Swal.fire({
        icon: 'success',
        title: 'Draft Laporan Tersimpan',
        html: `ID Laporan: <b>${res.Report_ID}</b><br>Laporan disimpan sebagai draf untuk otorisasi resmi.`,
        timer: 3000,
        showConfirmButton: false
      });
    } else {
      // OPERATOR
      Swal.fire({
        icon: 'success',
        title: 'Laporan Terkirim ke Supervisor',
        html: `ID Laporan: <b>${res.Report_ID}</b><br>Menunggu review & tanda tangan Supervisor Lingkungan.`,
        timer: 3500,
        showConfirmButton: false
      });
    }

    refreshLaporanList();
    pollNotifikasi();
  } catch (err) {
    Swal.fire('Gagal Mengirim Laporan', err.message || String(err), 'error');
  }
});

async function openReviewModal(reportId) {
  const { value: result } = await Swal.fire({
    title: '📋 Review Laporan',
    html: `<p style="font-size:12px;text-align:left;color:#475569;">ID Laporan: <b>${reportId}</b></p>
      <textarea id="swal-catatan" class="swal2-textarea" placeholder="Catatan review (opsional)..." style="height:100px;"></textarea>`,
    showCancelButton: true,
    confirmButtonText: '✅ Setujui & Kirim ke KTT',
    cancelButtonText: '🔄 Kembalikan ke Operator',
    cancelButtonColor: '#d97706',
    preConfirm: () => ({ catatan: document.getElementById('swal-catatan').value, action: 'APPROVE' })
  });

  if (result === undefined) return;

  if (result && result.action === 'APPROVE') {
    await callServer('apiReviewReport', AppState.token, reportId, result.catatan || '', 'APPROVE');
    Swal.fire({ icon: 'success', title: 'Laporan Diteruskan ke KTT', timer: 2000, showConfirmButton: false });
  } else {
    const { value: catatan } = await Swal.fire({ title: 'Alasan Pengembalian', input: 'textarea', inputPlaceholder: 'Tuliskan alasan...', showCancelButton: true });
    if (catatan !== undefined) {
      await callServer('apiReviewReport', AppState.token, reportId, catatan || '', 'KEMBALIKAN');
      Swal.fire({ icon: 'info', title: 'Laporan Dikembalikan', timer: 2000, showConfirmButton: false });
    }
  }
  refreshLaporanList(); pollNotifikasi();
}

async function openApproveKTTModal(reportId) {
  const { value: catatan, isConfirmed } = await Swal.fire({
    title: '🏆 Setujui Laporan (KTT)',
    html: `<p style="font-size:12px;text-align:left;color:#475569;">ID Laporan: <b>${reportId}</b><br>Laporan ini akan ditandatangani dan dapat diunduh oleh Supervisor.</p>
      <textarea id="swal-catatan-ktt" class="swal2-textarea" placeholder="Catatan persetujuan (opsional)..." style="height:80px;"></textarea>`,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-file-signature me-1"></i>Tanda Tangan & Setujui',
    cancelButtonText: 'Batal',
    preConfirm: () => document.getElementById('swal-catatan-ktt').value
  });
  if (!isConfirmed) return;
  await callServer('apiApproveReportKTT', AppState.token, reportId, catatan || '');
  Swal.fire({ icon: 'success', title: 'Laporan Disetujui & Ditandatangani', text: 'Supervisor dapat mencetak laporan final.', timer: 2500, showConfirmButton: false });
  refreshLaporanList(); refreshDashboard(); pollNotifikasi();
}

async function logReportGeneration(tipe, sig) {
  const isHarian = tipe === 'HARIAN';
  const tStart = isHarian
    ? document.getElementById('rep-harian-tanggal').value
    : (document.getElementById('rep-start-modal').value || document.getElementById('rep-start').value);
  const tEnd = isHarian
    ? document.getElementById('rep-harian-tanggal').value
    : (document.getElementById('rep-end-modal').value || document.getElementById('rep-end').value);

  return callServer('apiSendReportToSupervisor', AppState.token, {
    Nomor_Sampel: document.getElementById('rep-nomor-sampel').value,
    Sumber_Limbah: document.getElementById('rep-sumber-limbah').value,
    Tipe_Laporan: tipe,
    Pond_ID: document.getElementById('rep-area-kode').value || document.getElementById('rep-area-kode-select')?.value || 'SEMUA_POND',
    Periode_Mulai: tStart,
    Periode_Selesai: tEnd,
    Nama_Dibuat_Oleh: sig.dibuatOleh,
    Nama_Diperiksa_Oleh: sig.diperiksaOleh,
    Nama_Disetujui_Oleh: sig.disetujuiOleh
  });
}

document.getElementById('btn-export-xls').addEventListener('click', async () => {
  const isHarian = document.getElementById('rep-jenis-dokumen').value === 'HARIAN';
  const rows = isHarian ? (AppState.modalHarianRows || []) : (AppState.modalBulananRows || AppState.reportFilteredData || []);
  const sig = await getSignatureNamesForCurrentSelection();
  await logReportGeneration(document.getElementById('rep-jenis-dokumen').value, sig);
  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ Tanggal: r.Tanggal_Sampling, Jam: r.Jam_Sampling, Pond: r.Pond_ID, Aliran: r.Titik_Aliran, pH: r.Nilai_pH, TSS: r.Nilai_TSS, Fe: r.Nilai_Fe, Mn: r.Nilai_Mn, Status: r.Status_Mutu })));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
  XLSX.writeFile(wb, `Laporan_${(document.getElementById('rep-nomor-sampel').value || 'Air_Limbah').replace(/\//g, '_')}.xlsx`);
});

document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const isHarian = document.getElementById('rep-jenis-dokumen').value === 'HARIAN';
  const rows = isHarian ? (AppState.modalHarianRows || []) : (AppState.modalBulananRows || AppState.reportFilteredData || []);
  const sig = await getSignatureNamesForCurrentSelection();
  await logReportGeneration(document.getElementById('rep-jenis-dokumen').value, sig);
  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({ Tanggal: r.Tanggal_Sampling, Jam: r.Jam_Sampling, Pond: r.Pond_ID, Aliran: r.Titik_Aliran, pH: r.Nilai_pH, TSS: r.Nilai_TSS, Fe: r.Nilai_Fe, Mn: r.Nilai_Mn, Status: r.Status_Mutu })));
  const blob = new Blob([XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `Laporan_${(document.getElementById('rep-nomor-sampel').value || 'Air_Tambang').replace(/\//g, '_')}.csv`; link.click();
});

// ============================================================
// 11. PRINT / LAPORAN CETAK
// ============================================================
function buildLetterheadHtml() {
  const cfg = AppState.config;
  return `<div class="print-letterhead">
    ${cfg.LOGO_URL ? `<img src="${cfg.LOGO_URL}">` : ''}
    <div class="company-block">
      <h2>${cfg.COMPANY_NAME || 'PT. ETAM MANUNGGAL JAYA'}</h2>
      <p>${cfg.COMPANY_ADDRESS || 'Jl. S. Parman No. 6 Kota Samarinda'}</p>
    </div>
  </div>`;
}

function sigSlotHtml_(role, jabatan, nama, imgDataUrl) {
  const imgHtml = imgDataUrl ? `<img class="sig-img" src="${imgDataUrl}">` : '<div class="sig-img-empty">(belum ada tanda tangan digital)</div>';
  return `<div class="sig-block"><div class="sig-role">${role}<br><span style="font-weight:400;">(${jabatan})</span></div>
    ${imgHtml}<div class="sig-line"><div class="sig-name">${nama || '(....................)'}</div></div></div>`;
}

function buildSignatureHtml(sig) {
  return `<div class="print-signature-row">
    ${sigSlotHtml_('DIBUAT OLEH', 'Operator Lapangan', sig.dibuatOleh, sig.dibuatOlehImg)}
    ${sigSlotHtml_('DIPERIKSA OLEH', 'Supervisor Lingkungan', sig.diperiksaOleh, sig.diperiksaOlehImg)}
    ${sigSlotHtml_('DISETUJUI OLEH', 'Kepala Teknik Tambang', sig.disetujuiOleh, sig.disetujuiOlehImg)}
  </div>
  <div class="print-footer-note">Dokumen resmi dihasilkan oleh ${AppState.config.APP_NAME || 'EnviroMine'} pada ${new Date().toLocaleString('id-ID')}.</div>`;
}

// ── FORMAT LAPORAN HARIAN (Seperti Bulanan: Tabel Sampel + Foto Dokumentasi di Bawah) ──
function buildHarianPrintHtml(sig) {
  const rows = (AppState.modalHarianRows && AppState.modalHarianRows.length)
    ? AppState.modalHarianRows
    : (AppState.selectedDailyLog ? [AppState.selectedDailyLog] : []);

  const tanggal = document.getElementById('rep-harian-tanggal')?.value || (rows[0] ? rows[0].Tanggal_Sampling : '-');
  const nomor = document.getElementById('rep-nomor-sampel').value || '-';
  const sumber = document.getElementById('rep-sumber-limbah').value;
  const pondFilter = document.getElementById('rep-area-kode').value || document.getElementById('rep-area-kode-select')?.value;

  if (!rows.length) {
    return `<p style="text-align:center;color:#DC2626;padding:40px;">Belum ada baris data sampel pada tanggal ${tanggal}. Silakan pilih tanggal yang memiliki data pemantauan.</p>`;
  }

  const normal = rows.filter(r => r.Status_Mutu === 'NORMAL').length;
  const melebihi = rows.length - normal;
  const compliance = rows.length ? ((normal / rows.length) * 100).toFixed(1) : '100';

  // Baris data sampel pengukuran pada tanggal tersebut
  const dataRows = rows.map(r => `
    <tr>
      <td>${r.Tanggal_Sampling}</td>
      <td class="mono"><b>${formatJam(r.Jam_Sampling)}</b></td>
      <td><b>${r.Pond_ID}</b></td>
      <td>${r.Titik_Aliran || '-'}</td>
      <td class="numeric"><b>${Number(r.Nilai_pH || 0).toFixed(2)}</b></td>
      <td class="numeric">${Number(r.Nilai_TSS || 0).toFixed(1)}</td>
      <td class="numeric">${Number(r.Nilai_Fe || 0).toFixed(2)}</td>
      <td class="numeric">${Number(r.Nilai_Mn || 0).toFixed(2)}</td>
      <td style="color:${r.Status_Mutu === 'NORMAL' ? '#15803d' : '#dc2626'};font-weight:700;">${r.Status_Mutu}</td>
    </tr>
  `).join('');

  // Kumpulkan foto dokumentasi dari seluruh sampel
  let allPhotos = [];
  rows.forEach(r => {
    try {
      const arr = JSON.parse(r.Foto_Urls || '[]');
      if (Array.isArray(arr)) {
        arr.forEach(u => {
          if (u && typeof u === 'string' && u.trim()) {
            allPhotos.push({ url: u, caption: `${r.Pond_ID} ${r.Titik_Aliran} (${r.Jam_Sampling})` });
          }
        });
      }
    } catch (e) {}
  });

  const photosHtml = allPhotos.length ? `
    <div class="print-section-title" style="margin-top:20px;">DOKUMENTASI FOTO LAPANGAN</div>
    <div class="print-photos-grid">
      ${allPhotos.map(p => `
        <div style="text-align:center;">
          <img src="${p.url}" alt="Dokumentasi" style="width:100%;height:100px;object-fit:cover;border:1px solid #E5E7EB;border-radius:4px;">
          <div style="font-size:9px;color:#6B7280;margin-top:2px;">${p.caption}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `${buildLetterheadHtml()}
    <div class="print-doctitle">
      <h3>Laporan Harian Pemantauan Kualitas Air Limbah</h3>
      <div class="doc-sub">${AppState.config.REGION_NAME || 'Site Batuah - Kalimantan Timur'}</div>
    </div>
    <div class="print-meta-grid">
      <div class="meta-item"><b>Nomor Sampel</b>: ${nomor}</div>
      <div class="meta-item"><b>Area (Pond)</b>: ${pondFilter || 'Semua Pond'}</div>
      <div class="meta-item"><b>Tanggal Sampling</b>: ${tanggal}</div>
      <div class="meta-item"><b>Sumber Air Limbah</b>: ${sumber}</div>
      <div class="meta-item"><b>Total Sampel</b>: ${rows.length}</div>
      <div class="meta-item"><b>Compliance Rate</b>: <b style="color:${Number(compliance) >= 80 ? '#15803d' : '#dc2626'}">${compliance}%</b></div>
      <div class="meta-item"><b>Status Normal</b>: ${normal}</div>
      <div class="meta-item"><b>Melebihi Baku</b>: <b style="color:#dc2626">${melebihi}</b></div>
    </div>
    <div class="print-section-title">Rekapitulasi Data Sampling</div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Tanggal</th><th>Jam</th><th>Pond</th><th>Aliran</th>
          <th>pH</th><th>TSS</th><th>Fe</th><th>Mn</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
    </table>
    ${photosHtml}
    ${buildSignatureHtml(sig)}`;
}

function buildBulananPrintHtml(sig) {
  const rows = (AppState.modalBulananRows && AppState.modalBulananRows.length)
    ? AppState.modalBulananRows
    : (AppState.reportFilteredData || []);

  const nomor = document.getElementById('rep-nomor-sampel').value;
  const sumber = document.getElementById('rep-sumber-limbah').value;
  const periodeStart = document.getElementById('rep-start-modal')?.value || document.getElementById('rep-start')?.value;
  const periodeEnd = document.getElementById('rep-end-modal')?.value || document.getElementById('rep-end')?.value;
  const pondFilter = document.getElementById('rep-area-kode')?.value || document.getElementById('rep-area-kode-select')?.value || document.getElementById('rep-pond')?.value;

  const normal = rows.filter(r => r.Status_Mutu === 'NORMAL').length;
  const melebihi = rows.length - normal;
  const compliance = rows.length ? ((normal / rows.length) * 100).toFixed(1) : '100';

  const dataRows = rows.map(r => `
    <tr>
      <td>${r.Tanggal_Sampling}</td><td>${r.Pond_ID}</td><td>${r.Titik_Aliran}</td>
      <td><b>${Number(r.Nilai_pH).toFixed(2)}</b></td><td>${Number(r.Nilai_TSS).toFixed(1)}</td>
      <td>${Number(r.Nilai_Fe).toFixed(2)}</td><td>${Number(r.Nilai_Mn).toFixed(2)}</td>
      <td style="color:${r.Status_Mutu === 'NORMAL' ? '#15803d' : '#dc2626'};font-weight:700;">${r.Status_Mutu}</td>
    </tr>`).join('');

  return `${buildLetterheadHtml()}
    <div class="print-doctitle">
      <h3>Laporan Bulanan Rekapitulasi Pemantauan Air Limbah</h3>
      <div class="doc-sub">${AppState.config.REGION_NAME || 'Site Batuah - Kalimantan Timur'}</div>
    </div>
    <div class="print-meta-grid">
      <div class="meta-item"><b>Nomor Sampel</b>: ${nomor || '-'}</div>
      <div class="meta-item"><b>Area (Pond)</b>: ${pondFilter || 'Semua Pond'}</div>
      <div class="meta-item"><b>Periode</b>: ${periodeStart || '-'} s/d ${periodeEnd || '-'}</div>
      <div class="meta-item"><b>Sumber Air Limbah</b>: ${sumber}</div>
      <div class="meta-item"><b>Total Sampel</b>: ${rows.length}</div>
      <div class="meta-item"><b>Compliance Rate</b>: <b style="color:${Number(compliance) >= 80 ? '#15803d' : '#dc2626'}">${compliance}%</b></div>
      <div class="meta-item"><b>Status Normal</b>: ${normal}</div>
      <div class="meta-item"><b>Melebihi Baku</b>: <b style="color:#dc2626">${melebihi}</b></div>
    </div>
    <div class="print-section-title">Rekapitulasi Data Sampling</div>
    <table class="print-table">
      <thead><tr><th>Tanggal</th><th>Pond</th><th>Aliran</th><th>pH</th><th>TSS</th><th>Fe</th><th>Mn</th><th>Status</th></tr></thead>
      <tbody>${dataRows}</tbody>
    </table>
    ${buildSignatureHtml(sig)}`;
}

function buildBulananPrintHtml(sig) {
  const rows = AppState.reportFilteredData;
  const nomor = document.getElementById('rep-nomor-sampel').value;
  const sumber = document.getElementById('rep-sumber-limbah').value;
  const periodeStart = document.getElementById('rep-start').value;
  const periodeEnd = document.getElementById('rep-end').value;
  const pondFilter = document.getElementById('rep-pond').value;

  const normal = rows.filter(r => r.Status_Mutu === 'NORMAL').length;
  const melebihi = rows.length - normal;
  const compliance = rows.length ? (normal / rows.length * 100).toFixed(1) : '100';

  const dataRows = rows.map(r => `
    <tr>
      <td>${r.Tanggal_Sampling}</td><td>${r.Pond_ID}</td><td>${r.Titik_Aliran}</td>
      <td><b>${Number(r.Nilai_pH).toFixed(2)}</b></td><td>${Number(r.Nilai_TSS).toFixed(1)}</td>
      <td>${Number(r.Nilai_Fe).toFixed(2)}</td><td>${Number(r.Nilai_Mn).toFixed(2)}</td>
      <td style="color:${r.Status_Mutu === 'NORMAL' ? '#15803d' : '#dc2626'};font-weight:700;">${r.Status_Mutu}</td>
    </tr>`).join('');

  return `${buildLetterheadHtml()}
    <div class="print-doctitle"><h3>Laporan Bulanan Rekapitulasi Pemantauan Air Limbah</h3><div class="doc-sub">${AppState.config.REGION_NAME || ''}</div></div>
    <div class="print-meta-grid">
      <div class="meta-item"><b>Nomor Sampel</b>: ${nomor || '-'}</div>
      <div class="meta-item"><b>Area (Pond)</b>: ${pondFilter || 'Semua Pond'}</div>
      <div class="meta-item"><b>Periode</b>: ${periodeStart || '-'} s/d ${periodeEnd || '-'}</div>
      <div class="meta-item"><b>Sumber Air Limbah</b>: ${sumber}</div>
      <div class="meta-item"><b>Total Sampel</b>: ${rows.length}</div>
      <div class="meta-item"><b>Compliance Rate</b>: <b style="color:${Number(compliance) >= 80 ? '#15803d' : '#dc2626'}">${compliance}%</b></div>
      <div class="meta-item"><b>Status Normal</b>: ${normal}</div>
      <div class="meta-item"><b>Melebihi Baku</b>: <b style="color:#dc2626">${melebihi}</b></div>
    </div>
    <div class="print-section-title">Rekapitulasi Data Sampling</div>
    <table class="print-table"><thead><tr><th>Tanggal</th><th>Pond</th><th>Aliran</th><th>pH</th><th>TSS</th><th>Fe</th><th>Mn</th><th>Status</th></tr></thead>
    <tbody>${dataRows}</tbody></table>
    ${buildSignatureHtml(sig)}`;
}

document.getElementById('btn-preview-print').addEventListener('click', async () => {
  const sig = await getSignatureNamesForCurrentSelection();
  const isHarian = document.getElementById('rep-jenis-dokumen').value === 'HARIAN';
  const html = isHarian ? buildHarianPrintHtml(sig) : buildBulananPrintHtml(sig);
  document.getElementById('print-doc-root').innerHTML = html;
  window.print();
});

async function printFinalReport(reportId) {
  Swal.fire({ icon: 'info', title: 'Mencetak Laporan Final', text: 'Memuat data laporan...', timer: 1500, showConfirmButton: false });
  setTimeout(() => window.print(), 1600);
}

document.getElementById('btn-export-pdf').addEventListener('click', async () => {
  const sig = await getSignatureNamesForCurrentSelection();
  const isHarian = document.getElementById('rep-jenis-dokumen').value === 'HARIAN';
  const html = isHarian ? buildHarianPrintHtml(sig) : buildBulananPrintHtml(sig);
  document.getElementById('print-doc-root').innerHTML = html;
  await logReportGeneration(document.getElementById('rep-jenis-dokumen').value, sig);
  window.print();
});

// ============================================================
// 12. TOMBOL REFRESH MANUAL
// ============================================================
document.getElementById('btn-refresh-ledger')?.addEventListener('click', () => { refreshLogTable(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Ledger diperbarui', showConfirmButton: false, timer: 1200 }); });
document.getElementById('btn-refresh-disposisi')?.addEventListener('click', () => { refreshDisposisiList(); refreshDisposisiBadge(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Disposisi diperbarui', showConfirmButton: false, timer: 1200 }); });
document.getElementById('btn-refresh-lab')?.addEventListener('click', () => { refreshLabTable(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Lab diperbarui', showConfirmButton: false, timer: 1200 }); });
document.getElementById('btn-refresh-report')?.addEventListener('click', () => { refreshReportTable(); refreshLaporanList(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Laporan diperbarui', showConfirmButton: false, timer: 1200 }); });
document.getElementById('btn-refresh-master')?.addEventListener('click', async () => {
  const data = await callServer('apiGetInitialAppData', AppState.token);
  AppState.ponds = data.ponds; AppState.bakuMutu = data.bakuMutu;
  populatePondDropdowns(); refreshMasterData();
  Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Master data diperbarui', showConfirmButton: false, timer: 1200 });
});
document.getElementById('btn-refresh-users')?.addEventListener('click', () => { refreshUserTable(); Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Pengguna diperbarui', showConfirmButton: false, timer: 1200 }); });

// ============================================================
// 13. TANDA TANGAN ONLINE
// ============================================================
let sigCanvasCtx = null, sigDrawing = false, sigHasStroke = false;
function initSignatureCanvas() {
  const canvas = document.getElementById('sig-canvas');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width; canvas.height = rect.height;
  sigCanvasCtx = canvas.getContext('2d');
  sigCanvasCtx.lineWidth = 2.4; sigCanvasCtx.lineCap = 'round'; sigCanvasCtx.strokeStyle = '#0F172A';
  sigHasStroke = false;
  function posFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }
  function start(e) { e.preventDefault(); sigDrawing = true; const p = posFromEvent(e); sigCanvasCtx.beginPath(); sigCanvasCtx.moveTo(p.x, p.y); }
  function move(e) { if (!sigDrawing) return; e.preventDefault(); const p = posFromEvent(e); sigCanvasCtx.lineTo(p.x, p.y); sigCanvasCtx.stroke(); sigHasStroke = true; }
  function end() { sigDrawing = false; }
  canvas.onmousedown = start; canvas.onmousemove = move; window.addEventListener('mouseup', end);
  canvas.ontouchstart = start; canvas.ontouchmove = move; canvas.ontouchend = end;
}
function clearSignatureCanvas() {
  if (!sigCanvasCtx) return;
  sigCanvasCtx.clearRect(0, 0, document.getElementById('sig-canvas').width, document.getElementById('sig-canvas').height);
  sigHasStroke = false;
}
document.getElementById('btn-open-signature').addEventListener('click', async (e) => {
  e.preventDefault();
  document.getElementById('modal-signature').classList.add('active');
  setTimeout(async () => {
    initSignatureCanvas();
    try {
      const res = await callServer('apiGetMySignature', AppState.token);
      const label = document.getElementById('sig-status-label');
      if (res.hasSignature && res.Signature_DataURL) {
        label.textContent = 'Tanda tangan tersimpan — gambar ulang lalu Simpan untuk mengganti.';
        const img = new Image();
        img.onload = () => sigCanvasCtx.drawImage(img, 0, 0, document.getElementById('sig-canvas').width, document.getElementById('sig-canvas').height);
        img.src = res.Signature_DataURL;
      } else { label.textContent = 'Belum ada tanda tangan tersimpan.'; }
    } catch (e) {}
  }, 60);
});
document.getElementById('cancel-modal-signature').addEventListener('click', () => document.getElementById('modal-signature').classList.remove('active'));
document.getElementById('btn-sig-clear').addEventListener('click', clearSignatureCanvas);
document.getElementById('save-modal-signature').addEventListener('click', async () => {
  if (!sigHasStroke) { Swal.fire('Kanvas Kosong', 'Gambar tanda tangan Anda terlebih dahulu.', 'warning'); return; }
  const dataUrl = document.getElementById('sig-canvas').toDataURL('image/png');
  await callServer('apiSaveMySignature', AppState.token, dataUrl);
  document.getElementById('modal-signature').classList.remove('active');
  Swal.fire({ icon: 'success', title: 'Tanda Tangan Tersimpan', timer: 2000, showConfirmButton: false });
});

// ============================================================
// 14. MASTER DATA
// ============================================================
async function refreshMasterData() {
  document.getElementById('master-pond-body').innerHTML = AppState.ponds.map(p => `
    <tr><td class="mono">${p.Pond_ID}</td><td>${p.Nama_Pond}</td><td>${p.Blok_Area}</td>
    <td class="numeric">${p.Latitude ?? '-'}</td><td class="numeric">${p.Longitude ?? '-'}</td>
    <td><span class="badge ${p.Status === 'AKTIF' ? 'badge-compliant' : 'badge-info'}">${p.Status}</span></td>
    <td style="white-space:nowrap;">
      <button class="btn btn-sm btn-outline" title="Edit" onclick="openPondModal('${p.Pond_ID}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-sm btn-danger ms-1" title="Hapus" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;" onclick="deleteMasterPond('${p.Pond_ID}')"><i class="fa-solid fa-trash"></i></button>
    </td></tr>`).join('');
  document.getElementById('master-bakumutu-body').innerHTML = AppState.bakuMutu.map(b => `
    <tr><td class="mono">${b.Param_Code}</td><td>${b.Nama_Parameter}</td>
    <td class="numeric">${b.Batas_Min}</td><td class="numeric">${b.Batas_Max}</td>
    <td><button class="btn btn-sm btn-outline" onclick="editBakuMutu('${b.Param_Code}')">Edit</button></td></tr>`).join('');
}

async function deleteMasterPond(pondId) {
  const result = await Swal.fire({
    title: 'Hapus Settling Pond?',
    text: `Titik pond ${pondId} akan dihapus dari sistem.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal'
  });
  if (result.isConfirmed) {
    try {
      await callServer('apiDeleteMasterPond', AppState.token, pondId);
      const data = await callServer('apiGetInitialAppData', AppState.token);
      AppState.ponds = data.ponds;
      populatePondDropdowns();
      refreshMasterData();
      Swal.fire({ icon: 'success', title: 'Settling Pond Dihapus', timer: 1200, showConfirmButton: false });
    } catch (e) {}
  }
}

async function editBakuMutu(code) {
  const rule = AppState.bakuMutu.find(b => b.Param_Code === code);
  const { value: formValues } = await Swal.fire({
    title: `Edit Baku Mutu — ${rule.Nama_Parameter}`,
    html: `<input id="swal-min" class="swal2-input" placeholder="Batas Min" value="${rule.Batas_Min}"><input id="swal-max" class="swal2-input" placeholder="Batas Max" value="${rule.Batas_Max}">`,
    focusConfirm: false, preConfirm: () => [document.getElementById('swal-min').value, document.getElementById('swal-max').value]
  });
  if (!formValues) return;
  rule.Batas_Min = formValues[0]; rule.Batas_Max = formValues[1];
  await callServer('apiSaveBakuMutu', AppState.token, rule);
  Swal.fire({ icon: 'success', title: 'Baku Mutu Diperbarui', timer: 1500, showConfirmButton: false }); refreshMasterData();
}

function openPondModal(pondId) {
  const modal = document.getElementById('modal-pond');
  if (pondId) {
    const p = AppState.ponds.find(x => x.Pond_ID === pondId);
    document.getElementById('pond-modal-title').textContent = 'Edit Settling Pond';
    document.getElementById('pond-id').value = p.Pond_ID;
    document.getElementById('pond-nama').value = p.Nama_Pond;
    document.getElementById('pond-blok').value = p.Blok_Area;
    document.getElementById('pond-lat').value = p.Latitude || '';
    document.getElementById('pond-lng').value = p.Longitude || '';
    document.getElementById('pond-kompartemen').value = p.Jumlah_Kompartemen || 1;
    document.getElementById('pond-status').value = p.Status || 'AKTIF';
  } else {
    document.getElementById('pond-modal-title').textContent = 'Tambah Settling Pond';
    document.getElementById('pond-id').value = '';
    ['pond-nama', 'pond-blok', 'pond-lat', 'pond-lng'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('pond-kompartemen').value = 1;
    document.getElementById('pond-status').value = 'AKTIF';
  }
  updatePondCoordPreview(); modal.classList.add('active');
}

function updatePondCoordPreview() {
  const lat = document.getElementById('pond-lat').value.trim();
  const lng = document.getElementById('pond-lng').value.trim();
  document.getElementById('pond-coord-preview').textContent = (lat && lng) ? `${lat}, ${lng}` : 'Belum ada koordinat';
}
document.getElementById('pond-lat').addEventListener('input', updatePondCoordPreview);
document.getElementById('pond-lng').addEventListener('input', updatePondCoordPreview);
document.getElementById('btn-add-pond').addEventListener('click', () => openPondModal(null));
document.getElementById('cancel-modal-pond').addEventListener('click', () => document.getElementById('modal-pond').classList.remove('active'));
document.getElementById('save-modal-pond').addEventListener('click', async () => {
  const nama = document.getElementById('pond-nama').value.trim();
  const blok = document.getElementById('pond-blok').value.trim();
  if (!nama || !blok) { Swal.fire('Data Belum Lengkap', 'Nama dan Blok wajib diisi.', 'warning'); return; }
  await callServer('apiSaveMasterPond', AppState.token, {
    Pond_ID: document.getElementById('pond-id').value || undefined,
    Nama_Pond: nama, Blok_Area: blok,
    Latitude: document.getElementById('pond-lat').value,
    Longitude: document.getElementById('pond-lng').value,
    Jumlah_Kompartemen: Number(document.getElementById('pond-kompartemen').value || 1),
    Status: document.getElementById('pond-status').value
  });
  document.getElementById('modal-pond').classList.remove('active');
  const data = await callServer('apiGetInitialAppData', AppState.token);
  AppState.ponds = data.ponds; populatePondDropdowns(); refreshMasterData();
  Swal.fire({ icon: 'success', title: 'Titik Settling Pond Tersimpan', timer: 1500, showConfirmButton: false });
});

// ============================================================
// 15. PENGATURAN SISTEM
// ============================================================
function refreshSettings() {
  document.getElementById('set-company').value = AppState.config.COMPANY_NAME || '';
  document.getElementById('set-appname').value = AppState.config.APP_NAME || '';
  document.getElementById('set-region').value = AppState.config.REGION_NAME || '';
  document.getElementById('set-address').value = AppState.config.COMPANY_ADDRESS || '';
  document.getElementById('set-license').value = AppState.config.COMPANY_LICENSE || '';
  document.getElementById('set-phone').value = AppState.config.COMPANY_PHONE || '';
  document.getElementById('set-primary').value = AppState.config.PRIMARY_COLOR || '#0F5132';
  if (document.getElementById('set-login-bg')) {
    document.getElementById('set-login-bg').value = AppState.config.LOGIN_BG_URL || localStorage.getItem('enviromine_login_bg') || '';
  }
  refreshUserTable();
}

// Upload file gambar latar login langsung dari perangkat
let selectedLoginBgBase64 = null;
let selectedLoginBgMime = 'image/jpeg';
document.getElementById('set-login-bg-file')?.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) {
    selectedLoginBgBase64 = null;
    return;
  }
  if (file.size > 3.5 * 1024 * 1024) {
    Swal.fire('File Terlalu Besar', 'Ukuran gambar latar disarankan maksimal 3.5MB agar halaman login dapat dimuat dengan cepat.', 'warning');
  }
  selectedLoginBgMime = file.type || 'image/jpeg';
  const reader = new FileReader();
  reader.onload = function (evt) {
    selectedLoginBgBase64 = evt.target.result;
    applyLoginBg(selectedLoginBgBase64);
    const urlInput = document.getElementById('set-login-bg');
    if (urlInput) urlInput.placeholder = 'File lokal: ' + file.name + ' (akan disimpan otomatis ke Drive)';
    Swal.fire({
      icon: 'success',
      title: 'Pratinjau Foto Latar',
      text: 'Foto telah dimuat ke tampilan pratinjau. Klik "Simpan Pengaturan" untuk mengupload ke Drive & menyimpannya secara permanen.',
      timer: 2500,
      showConfirmButton: false
    });
  };
  reader.readAsDataURL(file);
});

document.getElementById('form-settings').addEventListener('submit', async function (e) {
  e.preventDefault();
  let loginBg = document.getElementById('set-login-bg')?.value.trim() || '';

  // 1. Upload Logo jika ada file yang dipilih
  const logoFile = document.getElementById('set-logo')?.files[0];
  if (logoFile) {
    const base64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(logoFile); });
    const resLogo = await callServer('apiUploadLogo', AppState.token, base64, logoFile.type);
    if (resLogo && resLogo.LOGO_URL) {
      AppState.config.LOGO_URL = resLogo.LOGO_URL;
      localStorage.setItem('enviromine_logo_url', resLogo.LOGO_URL);
      applyLoginLogo(resLogo.LOGO_URL);
    }
  }

  // 2. Upload Background Login jika dipilih file lokal
  if (selectedLoginBgBase64) {
    const resBg = await callServer('apiUploadLoginBg', AppState.token, selectedLoginBgBase64, selectedLoginBgMime);
    if (resBg && resBg.LOGIN_BG_URL) {
      loginBg = resBg.LOGIN_BG_URL;
      document.getElementById('set-login-bg').value = loginBg;
      selectedLoginBgBase64 = null;
    }
  } else if (loginBg) {
    loginBg = normalizeImageUrl(loginBg);
    document.getElementById('set-login-bg').value = loginBg;
  }

  const configData = {
    COMPANY_NAME: document.getElementById('set-company').value,
    APP_NAME: document.getElementById('set-appname').value,
    REGION_NAME: document.getElementById('set-region').value,
    COMPANY_ADDRESS: document.getElementById('set-address').value,
    COMPANY_LICENSE: document.getElementById('set-license').value,
    COMPANY_PHONE: document.getElementById('set-phone').value,
    PRIMARY_COLOR: document.getElementById('set-primary').value,
    LOGIN_BG_URL: loginBg
  };

  await callServer('apiSaveConfig', AppState.token, configData);
  Object.assign(AppState.config, configData);
  if (loginBg) {
    localStorage.setItem('enviromine_login_bg', loginBg);
    applyLoginBg(loginBg);
  }
  applyTheme();
  Swal.fire({ icon: 'success', title: 'Pengaturan Tersimpan', text: 'Konfigurasi identitas & gambar latar berhasil disimpan.', timer: 2000, showConfirmButton: false });
});

async function refreshUserTable() {
  if (AppState.session.role !== 'MANAJEMEN' && AppState.session.role !== 'ADMIN') return;
  const users = await callServer('apiGetUsers', AppState.token);
  AppState.usersCache = users;
  document.getElementById('user-table-body').innerHTML = users.map(u => `
    <tr><td class="mono">${u.Username}</td><td>${u.Nama_Lengkap}</td>
    <td><span class="badge ${u.Role === 'ADMIN' ? 'admin-role' : 'badge-info'}">${u.Role}</span></td>
    <td><span class="badge ${u.Status_Aktif ? 'badge-compliant' : 'badge-violation'}">${u.Status_Aktif ? 'AKTIF' : 'NONAKTIF'}</span></td>
    <td><button class="btn btn-sm btn-outline" onclick="openEditUserModal('${u.User_ID}')"><i class="fa-solid fa-pen"></i> Edit</button></td></tr>`).join('');
}

document.getElementById('btn-add-user').addEventListener('click', async () => {
  const { value: formValues } = await Swal.fire({
    title: 'Tambah Pengguna',
    html: `<input id="swal-username" class="swal2-input" placeholder="Username"><input id="swal-nama" class="swal2-input" placeholder="Nama Lengkap"><input id="swal-email" class="swal2-input" placeholder="Email"><select id="swal-role" class="swal2-select"><option value="OPERATOR">OPERATOR</option><option value="SUPERVISOR">SUPERVISOR</option><option value="MANAJEMEN">MANAJEMEN</option><option value="ADMIN">ADMIN</option></select>`,
    focusConfirm: false,
    preConfirm: () => ({ Username: document.getElementById('swal-username').value, Nama_Lengkap: document.getElementById('swal-nama').value, Email: document.getElementById('swal-email').value, Role: document.getElementById('swal-role').value })
  });
  if (!formValues || !formValues.Username) return;
  await callServer('apiSaveUser', AppState.token, formValues);
  Swal.fire({ icon: 'success', title: 'Pengguna Ditambahkan', text: 'Kata sandi default: ganti123', timer: 2500, showConfirmButton: false });
  refreshUserTable();
});

async function openEditUserModal(userId) {
  const u = (AppState.usersCache || []).find(x => x.User_ID === userId);
  if (!u) return;
  const { value: formValues } = await Swal.fire({
    title: `Edit Pengguna — ${u.Username}`,
    html: `
      <label style="display:block;text-align:left;font-size:11px;font-weight:700;color:#475569;margin:.4rem 0 .2rem;">Username</label>
      <input id="swal-edit-username" class="swal2-input" value="${u.Username}" style="margin:0;">
      <label style="display:block;text-align:left;font-size:11px;font-weight:700;color:#475569;margin:.6rem 0 .2rem;">Nama Lengkap</label>
      <input id="swal-edit-nama" class="swal2-input" value="${u.Nama_Lengkap}" style="margin:0;">
      <label style="display:block;text-align:left;font-size:11px;font-weight:700;color:#475569;margin:.6rem 0 .2rem;">Email</label>
      <input id="swal-edit-email" class="swal2-input" value="${u.Email || ''}" style="margin:0;">
      <label style="display:block;text-align:left;font-size:11px;font-weight:700;color:#475569;margin:.6rem 0 .2rem;">Role</label>
      <select id="swal-edit-role" class="swal2-select" style="margin:0;">
        <option value="OPERATOR" ${u.Role === 'OPERATOR' ? 'selected' : ''}>OPERATOR</option>
        <option value="SUPERVISOR" ${u.Role === 'SUPERVISOR' ? 'selected' : ''}>SUPERVISOR</option>
        <option value="MANAJEMEN" ${u.Role === 'MANAJEMEN' ? 'selected' : ''}>MANAJEMEN</option>
        <option value="ADMIN" ${u.Role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
      </select>
      <label style="display:block;text-align:left;font-size:11px;font-weight:700;color:#475569;margin:.6rem 0 .2rem;">Status Akun</label>
      <select id="swal-edit-status" class="swal2-select" style="margin:0;">
        <option value="true" ${u.Status_Aktif ? 'selected' : ''}>AKTIF</option>
        <option value="false" ${!u.Status_Aktif ? 'selected' : ''}>NONAKTIF</option>
      </select>
      <label style="display:block;text-align:left;font-size:11px;font-weight:700;color:#475569;margin:.6rem 0 .2rem;">Reset Kata Sandi (opsional)</label>
      <input id="swal-edit-password" class="swal2-input" type="password" placeholder="Kosongkan jika tidak diubah" style="margin:0;">
    `,
    focusConfirm: false, showCancelButton: true, confirmButtonText: 'Simpan Perubahan', cancelButtonText: 'Batal',
    preConfirm: () => ({
      User_ID: u.User_ID,
      Username: document.getElementById('swal-edit-username').value.trim(),
      Nama_Lengkap: document.getElementById('swal-edit-nama').value.trim(),
      Email: document.getElementById('swal-edit-email').value.trim(),
      Role: document.getElementById('swal-edit-role').value,
      Status_Aktif: document.getElementById('swal-edit-status').value === 'true',
      Password: document.getElementById('swal-edit-password').value
    })
  });
  if (!formValues) return;
  await callServer('apiSaveUser', AppState.token, formValues);
  Swal.fire({ icon: 'success', title: 'Pengguna Diperbarui', timer: 1500, showConfirmButton: false });
  refreshUserTable();
}

// ============================================================
// 16. PENGATURAN PROFIL PENGGUNA (MODAL PROFILE)
// ============================================================
let tempProfilePhotoBase64 = null;

document.getElementById('btn-user-profile')?.addEventListener('click', () => {
  const s = AppState.session;
  if (!s) return;
  document.getElementById('profile-nama').value = s.namaLengkap || '';
  document.getElementById('profile-username').value = s.username || '';
  document.getElementById('profile-role').value = s.role || 'OPERATOR';
  document.getElementById('profile-password').value = '';
  document.getElementById('profile-password-confirm').value = '';
  tempProfilePhotoBase64 = null;

  const prevEl = document.getElementById('profile-avatar-preview');
  const savedAvatar = localStorage.getItem('enviromine_avatar_' + s.username);
  if (savedAvatar && prevEl) {
    prevEl.innerHTML = `<img src="${savedAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
  } else if (prevEl) {
    prevEl.textContent = (s.namaLengkap || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
  }

  document.getElementById('modal-profile').classList.add('active');
});

document.getElementById('close-modal-profile')?.addEventListener('click', () => {
  document.getElementById('modal-profile').classList.remove('active');
});
document.getElementById('cancel-modal-profile')?.addEventListener('click', () => {
  document.getElementById('modal-profile').classList.remove('active');
});

// Preview foto profil yang dipilih
document.getElementById('profile-photo-input')?.addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    Swal.fire('File Terlalu Besar', 'Ukuran foto maksimal adalah 2MB.', 'warning');
    this.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    tempProfilePhotoBase64 = e.target.result;
    const prevEl = document.getElementById('profile-avatar-preview');
    if (prevEl) {
      prevEl.innerHTML = `<img src="${tempProfilePhotoBase64}" style="width:100%;height:100%;object-fit:cover;">`;
    }
  };
  reader.readAsDataURL(file);
});

// Simpan Pengaturan Profil
document.getElementById('save-modal-profile')?.addEventListener('click', async () => {
  const nama = document.getElementById('profile-nama').value.trim();
  const username = document.getElementById('profile-username').value.trim();
  const role = document.getElementById('profile-role').value;
  const pw = document.getElementById('profile-password').value;
  const pwConf = document.getElementById('profile-password-confirm').value;

  if (!nama || !username) {
    Swal.fire('Data Belum Lengkap', 'Nama lengkap dan username tidak boleh kosong.', 'warning');
    return;
  }
  if (pw && pw !== pwConf) {
    Swal.fire('Kata Sandi Tidak Cocok', 'Konfirmasi kata sandi tidak sama dengan kata sandi baru.', 'warning');
    return;
  }

  // Simpan foto avatar ke penyimpanan browser
  if (tempProfilePhotoBase64) {
    localStorage.setItem('enviromine_avatar_' + username, tempProfilePhotoBase64);
  }

  // Perbarui session aktif
  AppState.session.namaLengkap = nama;
  AppState.session.username = username;
  AppState.session.role = role;

  // Coba sinkronisasi ke server spreadsheet
  try {
    await callServer('apiSaveUser', AppState.token, {
      User_ID: AppState.session.userId,
      Username: username,
      Nama_Lengkap: nama,
      Email: AppState.session.email || '',
      Role: role,
      Status_Aktif: true,
      Password: pw || ''
    });
  } catch (e) {
    // Sesi tetap terupdate di tampilan jika server memerlukan hak tertentu
  }

  applySessionUI();
  buildSidebarByRole();
  buildDashboardLabelsByRole();
  document.getElementById('modal-profile').classList.remove('active');
  Swal.fire({ icon: 'success', title: 'Profil Diperbarui', text: 'Perubahan data profil berhasil disimpan.', timer: 2000, showConfirmButton: false });
});
