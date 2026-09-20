/**
 * ==========================================================================
 * ENVIROMINE MONITOR — LIMBAH B3 V1.1 (PT. ETAM MANUNGGAL JAYA)
 * Frontend Single Page Application Engine (GitHub Pages & GAS Compatible)
 * Versi Revisi V1.1.1 (Full CRUD, Lampiran 1 & 2 Print, Filter & Profile)
 * ==========================================================================
 */

// Global State
const STATE = {
  gasApiUrl: localStorage.getItem('enviromine_gas_url') || '',
  currentUser: null,
  activeView: 'dashboard',
  sidebarCollapsed: false,
  signatureTarget: null, // { neracaId, role }
  chartInstance: null,
  tempProfilePhoto: null
};

// 8 Items Checklist Fasilitas K3L TPS LB3 01 PT EMJ (Sesuai Rintek)
const INSPEKSI_ITEMS_DEFAULT = [
  'Alat Pemadam Api Ringan (APAR)',
  'Fasilitas Eyewash Station',
  'Rambu-rambu K3L & APD Wajib',
  'Kondisi Lantai Concrete Kedap Air & Kemiringan 1-5%',
  'Saluran Drainase Ceceran & Bak Oil Catcher (50x50x50 cm)',
  'Penunjuk Arah Angin (Wind Sock)',
  'Emergency Spill Kit (Absorbent Pad & Sawdust)',
  'Kotak Pertolongan Pertama Pada Kecelakaan (P3K)'
];

// ==========================================================================
// 1. INITIALIZATION & DATABASE SEEDING
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initLocalDatabase();
  applyCompanySettingsUI();
  checkAuthSession();
  updateGasStatusBadge();
  setupGlobalShortcuts();
});

function initLocalDatabase() {
  // 1. Master Rintek PT EMJ (9 Item Resmi Rintek)
  if (!localStorage.getItem('db_rintek')) {
    const defaultRintek = [
      { kodeLimbah: 'A102d', namaLimbah: 'Aki/baterai bekas', sumber: 'Sumber tidak spesifik', karakteristik: 'Korosif, Beracun', jenisWadah: 'Palet (2x1.5m)', kapasitasWadah: 1800, satuan: 'Kg', batasSimpanHari: 90 },
      { kodeLimbah: 'B104d', namaLimbah: 'Kemasan bekas B3', sumber: 'Sumber tidak spesifik', karakteristik: 'Beracun, Padatan mudah terbakar', jenisWadah: 'Palet (2x1.5m)', kapasitasWadah: 180, satuan: 'Kg', batasSimpanHari: 365 },
      { kodeLimbah: 'B105d', namaLimbah: 'Minyak pelumas bekas (Oli hidrolik/mesin/gear)', sumber: 'Sumber tidak spesifik', karakteristik: 'Beracun, Cairan mudah menyala', jenisWadah: 'Drum / IBC / Tangki', kapasitasWadah: 200, satuan: 'Liter', batasSimpanHari: 90 },
      { kodeLimbah: 'B107d', namaLimbah: 'Limbah elektronik (CRT, lampu TL, PCB)', sumber: 'Sumber tidak spesifik', karakteristik: 'Beracun, Berbahaya lingkungan', jenisWadah: 'Drum', kapasitasWadah: 200, satuan: 'Kg', batasSimpanHari: 365 },
      { kodeLimbah: 'B109d', namaLimbah: 'Filter bekas fasilitas pencemaran udara', sumber: 'Sumber tidak spesifik', karakteristik: 'Beracun', jenisWadah: 'Drum', kapasitasWadah: 200, satuan: 'Kg', batasSimpanHari: 365 },
      { kodeLimbah: 'B110d', namaLimbah: 'Kain majun bekas (used rags)', sumber: 'Sumber tidak spesifik', karakteristik: 'Beracun, Padatan mudah terbakar', jenisWadah: 'Drum', kapasitasWadah: 200, satuan: 'Kg', batasSimpanHari: 365 },
      { kodeLimbah: 'B321-4', namaLimbah: 'Kemasan bekas tinta / cartridge printer', sumber: 'Sumber spesifik umum', karakteristik: 'Beracun, Berbahaya lingkungan', jenisWadah: 'Drum', kapasitasWadah: 200, satuan: 'Kg', batasSimpanHari: 365 },
      { kodeLimbah: 'A332-1', namaLimbah: 'Sludge dari oil treatment / fasilitas penyimpanan', sumber: 'Sumber spesifik umum', karakteristik: 'Beracun, Padatan mudah menyala', jenisWadah: 'Drum', kapasitasWadah: 200, satuan: 'Kg', batasSimpanHari: 90 },
      { kodeLimbah: 'A337-1', namaLimbah: 'Limbah klinis / medis berkarakteristik infeksius', sumber: 'Sumber spesifik umum', karakteristik: 'Infeksius', jenisWadah: 'Medical waste cold storage', kapasitasWadah: 1.5, satuan: 'Kg', batasSimpanHari: 90 }
    ];
    localStorage.setItem('db_rintek', JSON.stringify(defaultRintek));
  }

  // 2. Master Pihak Ketiga (PT Berkat Jaya Sukses)
  if (!localStorage.getItem('db_pihak_ketiga')) {
    const defaultPihakKetiga = [
      { id: 'PK-001', namaPerusahaan: 'PT. Berkat Jaya Sukses', noIzin: 'SK.06/MENLHK/PLB3/2022', alamat: 'Jl. Trans Kalimantan Km 18, Balikpapan', kontak: '0542-882910 / info@berkatjayasukses.co.id' }
    ];
    localStorage.setItem('db_pihak_ketiga', JSON.stringify(defaultPihakKetiga));
  }

  // 3. Master Users (4 Roles)
  if (!localStorage.getItem('db_users')) {
    const defaultUsers = [
      { id: 'USR-01', nama: 'Operator Lapangan TPS', username: 'operator', password: 'operator123', role: 'Operator', status: 'Aktif', fotoProfil: '' },
      { id: 'USR-02', nama: 'Penanggung Jawab TPS (Hermanto)', username: 'penanggung_jawab', password: 'pj12345', role: 'Penanggung Jawab', status: 'Aktif', fotoProfil: '' },
      { id: 'USR-03', nama: 'Administrator HSE Lingkungan', username: 'admin_hse', password: 'admin123', role: 'Admin HSE', status: 'Aktif', fotoProfil: '' },
      { id: 'USR-04', nama: 'Kepala Teknik Tambang (KTT)', username: 'ktt', password: 'ktt12345', role: 'Manajemen / KTT', status: 'Aktif', fotoProfil: '' }
    ];
    localStorage.setItem('db_users', JSON.stringify(defaultUsers));
  }

  // 4. Sample Transaksi Limbah Masuk
  if (!localStorage.getItem('db_limbah_masuk')) {
    const sampleMasuk = [
      {
        id: 'IN-20260901-0830',
        tanggalMasuk: '2026-09-01 08:30',
        kodeLimbah: 'B105d',
        namaLimbah: 'Minyak pelumas bekas (Oli hidrolik/mesin/gear)',
        sumber: 'Workshop Alat Berat',
        jumlah: 1200,
        satuan: 'Liter',
        fotoUrl: '',
        statusRintek: 'Terdaftar',
        batasSimpanHari: 90,
        tanggalJatuhTempo: '2026-11-30',
        operator: 'Operator Lapangan',
        statusStok: 'Tersedia'
      },
      {
        id: 'IN-20260905-1015',
        tanggalMasuk: '2026-09-05 10:15',
        kodeLimbah: 'A102d',
        namaLimbah: 'Aki/baterai bekas',
        sumber: 'Workshop Elektrik',
        jumlah: 450,
        satuan: 'Kg',
        fotoUrl: '',
        statusRintek: 'Terdaftar',
        batasSimpanHari: 90,
        tanggalJatuhTempo: '2026-12-04',
        operator: 'Operator Lapangan',
        statusStok: 'Tersedia'
      },
      {
        id: 'IN-20260910-1400',
        tanggalMasuk: '2026-09-10 14:00',
        kodeLimbah: 'B104d',
        namaLimbah: 'Kemasan bekas B3',
        sumber: 'Gudang Pelumas & Kimia',
        jumlah: 85,
        satuan: 'Kg',
        fotoUrl: '',
        statusRintek: 'Terdaftar',
        batasSimpanHari: 365,
        tanggalJatuhTempo: '2027-09-10',
        operator: 'Operator Lapangan',
        statusStok: 'Tersedia'
      },
      {
        id: 'IN-20260625-0900',
        tanggalMasuk: '2026-06-25 09:00',
        kodeLimbah: 'B109d',
        namaLimbah: 'Filter bekas fasilitas pencemaran udara',
        sumber: 'Area Genset Powerhouse',
        jumlah: 70,
        satuan: 'Kg',
        fotoUrl: '',
        statusRintek: 'Terdaftar',
        batasSimpanHari: 90,
        tanggalJatuhTempo: '2026-09-23',
        operator: 'Operator Lapangan',
        statusStok: 'Tersedia'
      }
    ];
    localStorage.setItem('db_limbah_masuk', JSON.stringify(sampleMasuk));
  }

  // 5. Limbah Keluar
  if (!localStorage.getItem('db_limbah_keluar')) {
    const sampleKeluar = [
      {
        id: 'OUT-20260820-1100',
        refIdMasuk: 'IN-SAMPLE-000',
        tanggalKeluar: '2026-08-20 11:00',
        kodeLimbah: 'B105d',
        namaLimbah: 'Minyak pelumas bekas',
        jumlah: 1000,
        satuan: 'Liter',
        tujuanPihakKetiga: 'PT. Berkat Jaya Sukses',
        suratJalan: 'SJ/EMJ/2026/08/01',
        manifes: 'FEST-202608-99120',
        operator: 'Operator Lapangan',
        status: 'Keluar Terkonfirmasi'
      }
    ];
    localStorage.setItem('db_limbah_keluar', JSON.stringify(sampleKeluar));
  }

  // 6. Penanganan Khusus
  if (!localStorage.getItem('db_penanganan_khusus')) {
    localStorage.setItem('db_penanganan_khusus', JSON.stringify([]));
  }

  // 7. Inspeksi TPS
  if (!localStorage.getItem('db_inspeksi')) {
    const sampleInspeksi = [
      { id: 'INSP-20260918-01', tanggal: '2026-09-18 09:00', itemChecklist: 'Alat Pemadam Api Ringan (APAR)', kondisi: 'Baik', catatan: 'Pressure gauge di zona hijau, pin segel utuh', operator: 'Operator Lapangan' },
      { id: 'INSP-20260918-02', tanggal: '2026-09-18 09:05', itemChecklist: 'Fasilitas Eyewash Station', kondisi: 'Baik', catatan: 'Aliran air bersih mengalir normal', operator: 'Operator Lapangan' },
      { id: 'INSP-20260918-03', tanggal: '2026-09-18 09:10', itemChecklist: 'Saluran Drainase Ceceran & Bak Oil Catcher (50x50x50 cm)', kondisi: 'Baik', catatan: 'Bersih dari sumbatan pasir/kotoran', operator: 'Operator Lapangan' }
    ];
    localStorage.setItem('db_inspeksi', JSON.stringify(sampleInspeksi));
  }

  // 8. Neraca Limbah B3
  if (!localStorage.getItem('db_neraca')) {
    const sampleNeraca = [
      {
        id: 'NERACA-2026-TW3',
        periode: 'Triwulan III (Juli - September 2026)',
        dataA: '2.805',
        dataB: {
          disimpan: '1.805',
          dimanfaatkan: '0.000',
          diolah: '0.000',
          ditimbun: '0.000',
          diserahkanPihakKetiga: '1.000',
          ekspor: '0.000',
          lainnya: '0.000'
        },
        dataC: '0.000',
        dataD: '0.000',
        kinerja: '100.00%',
        status: 'Menunggu Pengesahan KTT',
        ttdOperator: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="50"><text x="10" y="32" font-family="cursive" font-size="20" fill="black">Operator</text></svg>',
        ttdPJ: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="50"><text x="10" y="32" font-family="cursive" font-size="20" fill="black">Hermanto</text></svg>',
        ttdKTT: '',
        createdAt: '2026-09-15'
      }
    ];
    localStorage.setItem('db_neraca', JSON.stringify(sampleNeraca));
  }

  // 9. Audit Logs
  if (!localStorage.getItem('db_audit')) {
    const sampleAudit = [
      { id: 'LOG-01', user: 'System', aksi: 'SETUP_DATABASE', timestamp: '2026-09-01 08:00', keterangan: 'Database TPS LB3 01 berhasil diinisialisasi' }
    ];
    localStorage.setItem('db_audit', JSON.stringify(sampleAudit));
  }

  // 10. Pengaturan Identitas Perusahaan Lengkap (Revisi #5)
  if (!localStorage.getItem('db_settings')) {
    const defaultSettings = {
      namaPerusahaan: 'PT. Etam Manunggal Jaya',
      bidangUsaha: 'Pertambangan Batubara',
      alamatKantor: 'Jalan S. Parman No. 6, Kota Samarinda, Kalimantan Timur',
      telpPerusahaan: '0541-748920',
      emailPerusahaan: 'info@etammanunggal.co.id',
      lokasiTps: 'Desa Batuah, Kec. Loa Janan, Kab. Kutai Kartanegara, Kaltim (00°48\'04,6" LS / 117°04\'41,9" BT)',
      luasTps: '52.5 m²',
      kapasitasMaksTon: '20',
      pjTeknis: 'Hermanto (Direktur / PJ TPS)',
      logoBase64: '',
      loginBgBase64: ''
    };
    localStorage.setItem('db_settings', JSON.stringify(defaultSettings));
  }
}

function applyCompanySettingsUI() {
  const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');
  
  // Update Teks Identitas Perusahaan
  if (cfg.namaPerusahaan) {
    document.getElementById('authCompanyDisplay').textContent = cfg.namaPerusahaan;
    document.getElementById('sidebarCompanyDisplay').textContent = cfg.namaPerusahaan;
    document.getElementById('kopLogbookNamaPerusahaan').textContent = cfg.namaPerusahaan.toUpperCase();
    document.getElementById('kopNeracaNamaPerusahaan').textContent = cfg.namaPerusahaan.toUpperCase();
    document.getElementById('printNeracaPerusahaan').textContent = cfg.namaPerusahaan;
  }

  if (cfg.alamatKantor) {
    document.getElementById('authAddressDisplay').textContent = `${cfg.alamatKantor} • TPS LB3 01`;
    document.getElementById('kopLogbookAlamat').textContent = cfg.alamatKantor;
    document.getElementById('kopNeracaAlamat').textContent = cfg.alamatKantor;
  }

  if (cfg.telpPerusahaan || cfg.emailPerusahaan) {
    const kontakStr = `Telp: ${cfg.telpPerusahaan || '-'} • Email: ${cfg.emailPerusahaan || '-'}`;
    document.getElementById('kopLogbookKontak').textContent = kontakStr;
    document.getElementById('kopNeracaKontak').textContent = kontakStr;
  }

  if (cfg.bidangUsaha) {
    document.getElementById('printNeracaBidangUsaha').textContent = cfg.bidangUsaha;
  }

  if (cfg.lokasiTps) {
    document.getElementById('topbarLocationDisplay').textContent = cfg.lokasiTps.split('(')[0].trim();
  }

  if (cfg.kapasitasMaksTon) {
    document.getElementById('statCapTonLabel').textContent = cfg.kapasitasMaksTon;
  }

  // Apply Logo Perusahaan jika ada
  if (cfg.logoBase64) {
    // Topbar & Sidebar Logo
    const sbLogoImg = document.getElementById('sidebarLogoImg');
    const sbLogoIcon = document.getElementById('sidebarLogoIcon');
    sbLogoImg.src = cfg.logoBase64;
    sbLogoImg.classList.remove('hidden');
    sbLogoIcon.classList.add('hidden');

    // Login screen logo
    const lgnLogoImg = document.getElementById('loginLogoImg');
    const lgnLogoIcon = document.getElementById('loginLogoIcon');
    lgnLogoImg.src = cfg.logoBase64;
    lgnLogoImg.classList.remove('hidden');
    lgnLogoIcon.classList.add('hidden');

    // KOP Cetak Logbook & Neraca
    document.getElementById('kopLogbookLogo').src = cfg.logoBase64;
    document.getElementById('kopNeracaLogo').src = cfg.logoBase64;

    // Settings Preview
    const prev = document.getElementById('settingsLogoPreview');
    prev.innerHTML = `<img src="${cfg.logoBase64}" class="w-full h-full object-contain">`;
  }

  // Apply Background Halaman Login jika ada
  if (cfg.loginBgBase64) {
    const bgDiv = document.getElementById('authBackdropGraphic');
    if (bgDiv) {
      bgDiv.style.backgroundImage = `url('${cfg.loginBgBase64}')`;
    }
  }

  // Form input fields
  document.getElementById('setPerusahaan').value = cfg.namaPerusahaan || '';
  document.getElementById('setBidangUsaha').value = cfg.bidangUsaha || '';
  document.getElementById('setAlamatKantor').value = cfg.alamatKantor || '';
  document.getElementById('setTelp').value = cfg.telpPerusahaan || '';
  document.getElementById('setEmail').value = cfg.emailPerusahaan || '';
  document.getElementById('setLokasi').value = cfg.lokasiTps || '';
  document.getElementById('setLuas').value = cfg.luasTps || '';
  document.getElementById('setKapasitas').value = cfg.kapasitasMaksTon || '';
  document.getElementById('setPJ').value = cfg.pjTeknis || '';
}

// ==========================================================================
// 2. AUTHENTICATION & USER PROFILE
// ==========================================================================
function checkAuthSession() {
  const sessionStr = localStorage.getItem('enviromine_session');
  if (sessionStr) {
    try {
      STATE.currentUser = JSON.parse(sessionStr);
      showAppShell();
    } catch (e) {
      showAuthView();
    }
  } else {
    showAuthView();
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const foundUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!foundUser) {
    showToast('Username tidak ditemukan.', 'error');
    return;
  }

  if (foundUser.password !== password) {
    showToast('Password salah.', 'error');
    return;
  }

  if (foundUser.status !== 'Aktif') {
    showToast('Akun Anda dinonaktifkan. Hubungi Admin HSE.', 'error');
    return;
  }

  STATE.currentUser = {
    id: foundUser.id,
    nama: foundUser.nama,
    username: foundUser.username,
    role: foundUser.role,
    fotoProfil: foundUser.fotoProfil || ''
  };

  localStorage.setItem('enviromine_session', JSON.stringify(STATE.currentUser));
  addAuditLog(STATE.currentUser.nama, 'LOGIN', 'Berhasil login ke sistem');
  showToast(`Selamat datang, ${STATE.currentUser.nama}!`, 'success');
  showAppShell();
}

function quickFillLogin(username, password) {
  document.getElementById('loginUsername').value = username;
  document.getElementById('loginPassword').value = password;
  const btn = document.getElementById('btnLoginSubmit');
  btn.classList.add('ring-4', 'ring-vault-lime/50');
  setTimeout(() => {
    btn.classList.remove('ring-4', 'ring-vault-lime/50');
    btn.click();
  }, 300);
}

function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
    if (STATE.currentUser) {
      addAuditLog(STATE.currentUser.nama, 'LOGOUT', 'Keluar dari sistem');
    }
    localStorage.removeItem('enviromine_session');
    STATE.currentUser = null;
    showAuthView();
    showToast('Anda telah keluar dari sistem.', 'info');
  }
}

function showAuthView() {
  document.getElementById('authView').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

function showAppShell() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  
  updateUserSessionUI();
  navigateTo('dashboard');
  lucide.createIcons();
}

function updateUserSessionUI() {
  if (!STATE.currentUser) return;
  document.getElementById('userNameDisplay').textContent = STATE.currentUser.nama;
  document.getElementById('userRoleBadge').textContent = STATE.currentUser.role;

  const avEl = document.getElementById('userAvatar');
  if (STATE.currentUser.fotoProfil) {
    avEl.innerHTML = `<img src="${STATE.currentUser.fotoProfil}" class="w-full h-full object-cover">`;
  } else {
    avEl.textContent = STATE.currentUser.nama.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPassword');
  const icon = document.getElementById('eyeIcon');
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    pwdInput.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

function handleForgotPassword() {
  alert('Permintaan reset password telah dikirimkan ke Admin HSE / Lingkungan.');
  addAuditLog('User Guest', 'FORGOT_PASSWORD', 'Pengajuan reset password pengguna');
}

// --- MODAL PROFIL PENGGUNA (Revisi #7) ---
function openModalUserProfile() {
  if (!STATE.currentUser) return;
  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const u = users.find(usr => usr.id === STATE.currentUser.id) || STATE.currentUser;

  document.getElementById('profNama').value = u.nama;
  document.getElementById('profUsername').value = u.username;
  document.getElementById('profRole').value = u.role;

  document.getElementById('profCurrentPass').value = '';
  document.getElementById('profNewPass').value = '';
  document.getElementById('profConfirmPass').value = '';
  STATE.tempProfilePhoto = u.fotoProfil || '';

  renderProfilePhotoPreview(STATE.tempProfilePhoto, u.nama);
  openModal('modalUserProfile');
}

function renderProfilePhotoPreview(photoUrl, name) {
  const container = document.getElementById('profilePhotoPreview');
  if (photoUrl) {
    container.innerHTML = `<img src="${photoUrl}" class="w-full h-full object-cover">`;
  } else {
    const initials = (name || 'User').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    container.innerHTML = initials;
  }
}

function handleProfilePhotoChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    STATE.tempProfilePhoto = event.target.result;
    renderProfilePhotoPreview(STATE.tempProfilePhoto, document.getElementById('profNama').value);
  };
  reader.readAsDataURL(file);
}

function handleSaveUserProfile(e) {
  e.preventDefault();
  const nama = document.getElementById('profNama').value.trim();
  const username = document.getElementById('profUsername').value.trim();
  const curPass = document.getElementById('profCurrentPass').value;
  const newPass = document.getElementById('profNewPass').value;
  const confPass = document.getElementById('profConfirmPass').value;

  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const idx = users.findIndex(u => u.id === STATE.currentUser.id);

  if (idx === -1) {
    showToast('Data user tidak ditemukan.', 'error');
    return;
  }

  // Validasi jika ganti password
  if (newPass) {
    if (users[idx].password !== curPass) {
      showToast('Password saat ini salah!', 'error');
      return;
    }
    if (newPass.length < 5) {
      showToast('Password baru minimal 5 karakter!', 'error');
      return;
    }
    if (newPass !== confPass) {
      showToast('Konfirmasi password baru tidak cocok!', 'error');
      return;
    }
    users[idx].password = newPass;
  }

  // Update profil
  users[idx].nama = nama;
  users[idx].username = username;
  if (STATE.tempProfilePhoto !== null) {
    users[idx].fotoProfil = STATE.tempProfilePhoto;
  }

  localStorage.setItem('db_users', JSON.stringify(users));

  // Update session
  STATE.currentUser.nama = nama;
  STATE.currentUser.username = username;
  STATE.currentUser.fotoProfil = users[idx].fotoProfil;
  localStorage.setItem('enviromine_session', JSON.stringify(STATE.currentUser));

  updateUserSessionUI();
  addAuditLog(nama, 'UPDATE_PROFILE', 'Memperbarui profil akun & kata sandi');
  showToast('Profil pengguna berhasil diperbarui!', 'success');
  closeModal('modalUserProfile');
}

// ==========================================================================
// 3. NAVIGATION & ROUTING
// ==========================================================================
function navigateTo(viewName) {
  STATE.activeView = viewName;

  const views = [
    'dashboard', 'masuk', 'keluar', 'penanganan-khusus', 
    'inspeksi', 'logbook', 'neraca', 'rintek', 'pihak-ketiga', 'users', 'settings'
  ];

  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');

    const nav = document.getElementById(`nav-${v}`);
    if (nav) nav.classList.remove('active');
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');

  const targetNav = document.getElementById(`nav-${viewName}`);
  if (targetNav) targetNav.classList.add('active');

  switch (viewName) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'masuk':
      renderLimbahMasuk();
      break;
    case 'keluar':
      renderLimbahKeluar();
      break;
    case 'penanganan-khusus':
      renderPenangananKhusus();
      break;
    case 'inspeksi':
      renderInspeksi();
      break;
    case 'logbook':
      renderLogbook();
      break;
    case 'neraca':
      renderNeraca();
      break;
    case 'rintek':
      renderMasterRintek();
      break;
    case 'pihak-ketiga':
      renderMasterPihakKetiga();
      break;
    case 'users':
      renderMasterUsers();
      break;
    case 'settings':
      renderSettingsAndAudit();
      break;
  }

  lucide.createIcons();
}

function toggleSidebarCollapse() {
  const sb = document.getElementById('sidebar');
  STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
  if (STATE.sidebarCollapsed) {
    sb.classList.add('collapsed');
  } else {
    sb.classList.remove('collapsed');
  }
}

// ==========================================================================
// 4. VIEW RENDERERS & LOGIC
// ==========================================================================

// --- 4.1 DASHBOARD ---
function renderDashboard() {
  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const keluar = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');
  const pkList = JSON.parse(localStorage.getItem('db_penanganan_khusus') || '[]');
  const neracaList = JSON.parse(localStorage.getItem('db_neraca') || '[]');
  const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');

  let totalStokKg = 0;
  let h7AlertCount = 0;
  const stokKategoriMap = {};
  const today = new Date();

  masuk.forEach(m => {
    if (m.statusStok === 'Tersedia') {
      const jlh = parseFloat(m.jumlah) || 0;
      totalStokKg += jlh;
      stokKategoriMap[m.namaLimbah] = (stokKategoriMap[m.namaLimbah] || 0) + jlh;

      if (m.tanggalJatuhTempo) {
        const tempoDate = new Date(m.tanggalJatuhTempo);
        const diffDays = Math.ceil((tempoDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          h7AlertCount++;
        }
      }
    }
  });

  const totalStokTon = (totalStokKg / 1000).toFixed(2);
  document.getElementById('statTotalStokKg').textContent = totalStokKg.toLocaleString('id-ID');
  document.getElementById('statTotalStokTon').textContent = `≈ ${totalStokTon} Ton`;

  // Kapasitas TPS
  const kapasitasTon = parseFloat(cfg.kapasitasMaksTon) || 20;
  const kapasitasMaksKg = kapasitasTon * 1000;
  const persenKapasitas = Math.min(100, ((totalStokKg / kapasitasMaksKg) * 100)).toFixed(1);
  document.getElementById('statPersenKapasitas').textContent = `${persenKapasitas}%`;

  const bar = document.getElementById('statProgressBar');
  const badgeKapasitas = document.getElementById('statKapasitasStatus');
  bar.style.width = `${persenKapasitas}%`;

  if (persenKapasitas >= 100) {
    bar.className = 'bg-rose-500 h-full rounded-full';
    badgeKapasitas.className = 'badge-status badge-red';
    badgeKapasitas.textContent = 'Penuh (100%)';
  } else if (persenKapasitas >= 80) {
    bar.className = 'bg-amber-500 h-full rounded-full';
    badgeKapasitas.className = 'badge-status badge-yellow';
    badgeKapasitas.textContent = 'Peringatan ≥80%';
  } else {
    bar.className = 'bg-vault-lime h-full rounded-full';
    badgeKapasitas.className = 'badge-status badge-green';
    badgeKapasitas.textContent = 'Aman (<80%)';
  }

  // Alert H-7
  document.getElementById('statAlertH7Count').textContent = h7AlertCount;
  const alertBanner = document.getElementById('complianceAlertBanner');
  if (h7AlertCount > 0) {
    alertBanner.classList.remove('hidden');
    document.getElementById('complianceAlertText').textContent = 
      `Terdapat ${h7AlertCount} item limbah B3 di TPS 01 yang sisa masa simpannya ≤ 7 hari sebelum jatuh tempo. Segera jadwalkan pengangkutan ke pihak ketiga!`;
  } else {
    alertBanner.classList.add('hidden');
  }

  // Pending Approval
  const pendingPK = pkList.filter(p => p.status === 'Pending').length;
  const pendingNeraca = neracaList.filter(n => n.status !== 'Final').length;
  document.getElementById('statPendingApproval').textContent = pendingPK + pendingNeraca;
  document.getElementById('badgePendingPK').textContent = pendingPK;

  // Breakdown Kategori
  const katContainer = document.getElementById('stokKategoriList');
  katContainer.innerHTML = '';
  const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  document.getElementById('dashRintekCountBadge').textContent = `${rintek.length} Terdaftar`;

  rintek.slice(0, 5).forEach(r => {
    const currentStok = stokKategoriMap[r.namaLimbah] || 0;
    const itemEl = document.createElement('div');
    itemEl.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs';
    itemEl.innerHTML = `
      <div class="overflow-hidden pr-2">
        <p class="font-semibold text-slate-200 truncate">${r.namaLimbah}</p>
        <span class="text-[10px] text-sky-400 font-mono">${r.kodeLimbah} &bull; ${r.karakteristik}</span>
      </div>
      <div class="text-right shrink-0">
        <p class="font-bold text-white font-mono">${currentStok.toLocaleString('id-ID')} ${r.satuan}</p>
        <span class="text-[10px] text-slate-400">Max ${r.batasSimpanHari} hari</span>
      </div>
    `;
    katContainer.appendChild(itemEl);
  });

  // Render Recent Transactions
  const recentTable = document.getElementById('dashboardRecentTableBody');
  recentTable.innerHTML = '';
  const recentItems = masuk.slice(-5).reverse();

  if (recentItems.length === 0) {
    recentTable.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-slate-500">Belum ada transaksi limbah.</td></tr>`;
  } else {
    recentItems.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono text-sky-400 font-medium">${item.id}</td>
        <td>
          <div class="font-semibold text-white">${item.namaLimbah}</div>
          <span class="text-xs text-slate-400 font-mono">${item.kodeLimbah}</span>
        </td>
        <td class="font-mono font-bold">${item.jumlah} ${item.satuan}</td>
        <td>
          <span class="badge-status ${item.statusRintek === 'Terdaftar' ? 'badge-green' : 'badge-yellow'}">
            ${item.statusRintek}
          </span>
        </td>
        <td>
          <span class="badge-status ${item.statusStok === 'Tersedia' ? 'badge-lime' : 'badge-blue'}">
            ${item.statusStok}
          </span>
        </td>
        <td class="text-slate-400">${item.operator}</td>
      `;
      recentTable.appendChild(tr);
    });
  }

  renderTimbulanChart(masuk, keluar);
}

function renderTimbulanChart(masuk, keluar) {
  const ctx = document.getElementById('timbulanChart');
  if (!ctx) return;

  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
  }

  const labels = ['Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober'];
  const dataMasuk = [1400, 1950, 2200, 1850, 2450, 2100];
  const dataKeluar = [1000, 1500, 1800, 1600, 2000, 1900];

  STATE.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Limbah Masuk (Kg)',
          data: dataMasuk,
          borderColor: '#d4f933',
          backgroundColor: 'rgba(212, 249, 51, 0.08)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#d4f933',
          borderWidth: 2.5
        },
        {
          label: 'Diserahkan ke Pihak Ketiga (Kg)',
          data: dataKeluar,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.04)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#38bdf8',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } },
        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } }
      }
    }
  });
}

// --- 4.2 LIMBAH MASUK (DENGAN FILTER & REFRESH) ---
function renderLimbahMasuk(filteredData = null) {
  // Populate filter dropdown jenis limbah jika kosong
  populateFilterMasukRintek();

  const table = document.getElementById('tableLimbahMasukBody');
  const rawData = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const data = filteredData || rawData;
  table.innerHTML = '';

  if (data.length === 0) {
    table.innerHTML = `<tr><td colspan="11" class="text-center py-6 text-slate-500">Tidak ada data limbah masuk yang cocok dengan filter.</td></tr>`;
    return;
  }

  const today = new Date();

  data.slice().reverse().forEach(item => {
    let sisaHari = '-';
    let sisaBadge = 'badge-green';

    if (item.tanggalJatuhTempo) {
      const diff = Math.ceil((new Date(item.tanggalJatuhTempo) - today) / (1000 * 60 * 60 * 24));
      sisaHari = `${diff} hari`;
      if (diff <= 7 && diff >= 0) {
        sisaBadge = 'badge-yellow animate-pulse';
      } else if (diff < 0) {
        sisaBadge = 'badge-red';
        sisaHari = `Overdue (${Math.abs(diff)} h)`;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-sky-400 font-medium">${item.id}</td>
      <td class="text-xs text-slate-300">${item.tanggalMasuk}</td>
      <td class="font-mono text-vault-lime font-bold">${item.kodeLimbah}</td>
      <td class="font-semibold text-white">${item.namaLimbah}</td>
      <td class="font-mono font-bold">${item.jumlah} ${item.satuan}</td>
      <td>
        <span class="badge-status ${item.statusRintek === 'Terdaftar' ? 'badge-green' : 'badge-yellow'}">
          ${item.statusRintek}
        </span>
      </td>
      <td class="font-mono text-xs text-slate-300">${item.tanggalJatuhTempo || '-'}</td>
      <td><span class="badge-status ${sisaBadge}">${sisaHari}</span></td>
      <td class="text-slate-400">${item.operator}</td>
      <td>
        <span class="badge-status ${item.statusStok === 'Tersedia' ? 'badge-lime' : 'badge-blue'}">
          ${item.statusStok}
        </span>
      </td>
      <td>
        ${item.statusStok === 'Tersedia' ? `
          <button onclick="quickKeluarLimbah('${item.id}')" class="btn-action-sm btn-edit">
            Keluarkan
          </button>
        ` : `<span class="text-xs text-slate-500">-</span>`}
      </td>
    `;
    table.appendChild(tr);
  });
}

function populateFilterMasukRintek() {
  const sel = document.getElementById('filterMasukRintek');
  if (sel && sel.options.length <= 1) {
    const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
    rintek.forEach(r => {
      sel.innerHTML += `<option value="${r.kodeLimbah}">${r.namaLimbah} (${r.kodeLimbah})</option>`;
    });
  }
}

function applyFilterLimbahMasuk() {
  const search = (document.getElementById('filterMasukSearch').value || '').toLowerCase();
  const kode = document.getElementById('filterMasukRintek').value;
  const stok = document.getElementById('filterMasukStok').value;
  const tglDari = document.getElementById('filterMasukTglDari').value;
  const tglSampai = document.getElementById('filterMasukTglSampai').value;

  let list = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');

  if (search) {
    list = list.filter(m => m.namaLimbah.toLowerCase().includes(search) || m.id.toLowerCase().includes(search) || m.kodeLimbah.toLowerCase().includes(search));
  }
  if (kode) {
    list = list.filter(m => m.kodeLimbah === kode);
  }
  if (stok) {
    list = list.filter(m => m.statusStok === stok);
  }
  if (tglDari) {
    list = list.filter(m => m.tanggalMasuk.slice(0, 10) >= tglDari);
  }
  if (tglSampai) {
    list = list.filter(m => m.tanggalMasuk.slice(0, 10) <= tglSampai);
  }

  renderLimbahMasuk(list);
}

function resetFilterLimbahMasuk() {
  document.getElementById('filterMasukSearch').value = '';
  document.getElementById('filterMasukRintek').value = '';
  document.getElementById('filterMasukStok').value = '';
  document.getElementById('filterMasukTglDari').value = '';
  document.getElementById('filterMasukTglSampai').value = '';
  renderLimbahMasuk();
}

function refreshLimbahMasuk() {
  resetFilterLimbahMasuk();
  showToast('Data Limbah Masuk disegarkan.', 'info');
}

function openModalLimbahMasuk() {
  populateRintekDropdown();
  document.getElementById('masukTanggal').value = new Date().toISOString().slice(0, 16);
  document.getElementById('formLimbahMasuk').reset();
  document.getElementById('nonRintekWarnBox').classList.add('hidden');
  openModal('modalLimbahMasuk');
}

function populateRintekDropdown() {
  const select = document.getElementById('masukJenisSelect');
  const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  
  select.innerHTML = '<option value="">-- Pilih Limbah Terdaftar di Rintek --</option>';
  rintek.forEach(r => {
    select.innerHTML += `<option value="${r.kodeLimbah}">${r.namaLimbah} (${r.kodeLimbah})</option>`;
  });
  select.innerHTML += '<option value="CUSTOM_NON_RINTEK">+ Lainnya (Di Luar Rintek - Penanganan Khusus)</option>';
}

function handleSelectLimbahRintek(kode) {
  const rintekList = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  const warnBox = document.getElementById('nonRintekWarnBox');

  if (kode === 'CUSTOM_NON_RINTEK') {
    warnBox.classList.remove('hidden');
    document.getElementById('masukKode').value = 'NON-RINTEK';
    document.getElementById('masukKarakteristik').value = 'Belum Terdaftar';
    document.getElementById('masukBatasHari').value = '90 (Standar)';
    return;
  }

  warnBox.classList.add('hidden');
  const found = rintekList.find(r => r.kodeLimbah === kode);
  if (found) {
    document.getElementById('masukKode').value = found.kodeLimbah;
    document.getElementById('masukKarakteristik').value = found.karakteristik;
    document.getElementById('masukSatuan').value = found.satuan;
    document.getElementById('masukBatasHari').value = `${found.batasSimpanHari} Hari`;
  }
}

function handleFormLimbahMasuk(e) {
  e.preventDefault();
  const selectVal = document.getElementById('masukJenisSelect').value;
  const kodeLimbah = document.getElementById('masukKode').value;
  const jumlah = parseFloat(document.getElementById('masukJumlah').value);
  const satuan = document.getElementById('masukSatuan').value;
  const tglMasuk = document.getElementById('masukTanggal').value;
  const batasHari = parseInt(document.getElementById('masukBatasHari').value) || 90;

  let namaLimbah = '';
  let statusRintek = 'Terdaftar';
  let sumber = 'Operasional Tambang';

  if (selectVal === 'CUSTOM_NON_RINTEK') {
    statusRintek = 'Penanganan Khusus';
    namaLimbah = prompt('Masukkan Nama Limbah Non-Rintek:', 'Residu Kimia Lab') || 'Limbah Khusus';
  } else {
    const rintekList = JSON.parse(localStorage.getItem('db_rintek') || '[]');
    const r = rintekList.find(item => item.kodeLimbah === kodeLimbah);
    namaLimbah = r ? r.namaLimbah : 'Limbah B3';
    sumber = r ? r.sumber : 'Operasional';
  }

  const tglMasukDate = new Date(tglMasuk);
  const tglTempo = new Date(tglMasukDate.getTime() + (batasHari * 24 * 60 * 60 * 1000));
  const tempoStr = tglTempo.toISOString().slice(0, 10);

  const newId = 'IN-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
  const operatorName = STATE.currentUser ? STATE.currentUser.nama : 'Operator Lapangan';

  const newEntry = {
    id: newId,
    tanggalMasuk: tglMasuk.replace('T', ' '),
    kodeLimbah: kodeLimbah,
    namaLimbah: namaLimbah,
    sumber: sumber,
    jumlah: jumlah,
    satuan: satuan,
    fotoUrl: '',
    statusRintek: statusRintek,
    batasSimpanHari: batasHari,
    tanggalJatuhTempo: tempoStr,
    operator: operatorName,
    statusStok: 'Tersedia'
  };

  const dbMasuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  dbMasuk.push(newEntry);
  localStorage.setItem('db_limbah_masuk', JSON.stringify(dbMasuk));

  if (statusRintek === 'Penanganan Khusus') {
    const dbPK = JSON.parse(localStorage.getItem('db_penanganan_khusus') || '[]');
    dbPK.push({
      id: 'PK-' + newId,
      refIdMasuk: newId,
      kodeLimbah: kodeLimbah,
      namaLimbah: namaLimbah,
      alasan: document.getElementById('masukAlasanKhusus').value || 'Di luar rintek',
      status: 'Pending',
      approver: '-',
      catatan: '-'
    });
    localStorage.setItem('db_penanganan_khusus', JSON.stringify(dbPK));
    showToast('Peringatan: Masuk antrean Penanganan Khusus.', 'warning');
  } else {
    showToast('Limbah masuk berhasil dicatat.', 'success');
  }

  addAuditLog(operatorName, 'INPUT_LIMBAH_MASUK', `Mencatat limbah masuk: ${namaLimbah} (${jumlah} ${satuan})`);
  closeModal('modalLimbahMasuk');
  renderLimbahMasuk();
  renderDashboard();
}

// --- 4.3 LIMBAH KELUAR (DENGAN FILTER & REFRESH) ---
function renderLimbahKeluar(filteredData = null) {
  populateFilterKeluarPK();

  const table = document.getElementById('tableLimbahKeluarBody');
  const rawData = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');
  const data = filteredData || rawData;
  table.innerHTML = '';

  if (data.length === 0) {
    table.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500">Tidak ada data limbah keluar yang cocok.</td></tr>`;
    return;
  }

  data.slice().reverse().forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-sky-400 font-medium">${item.id}</td>
      <td class="font-mono text-xs text-slate-400">${item.refIdMasuk}</td>
      <td class="text-xs text-slate-300">${item.tanggalKeluar}</td>
      <td class="font-semibold text-white">
        ${item.namaLimbah}
        <span class="text-xs text-slate-400 font-mono block">${item.kodeLimbah}</span>
      </td>
      <td class="font-mono font-bold">${item.jumlah} ${item.satuan}</td>
      <td class="text-slate-300">${item.tujuanPihakKetiga}</td>
      <td class="text-xs font-mono">
        <span class="text-sky-400 block">SJ: ${item.suratJalan}</span>
        <span class="text-emerald-400 block">Manifes: ${item.manifes}</span>
      </td>
      <td class="text-slate-400">${item.operator}</td>
      <td>
        <span class="badge-status badge-lime">
          <i data-lucide="check" class="w-3 h-3"></i> Terkonfirmasi
        </span>
      </td>
    `;
    table.appendChild(tr);
  });
}

function populateFilterKeluarPK() {
  const sel = document.getElementById('filterKeluarPK');
  if (sel && sel.options.length <= 1) {
    const pkList = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
    pkList.forEach(pk => {
      sel.innerHTML += `<option value="${pk.namaPerusahaan}">${pk.namaPerusahaan}</option>`;
    });
  }
}

function applyFilterLimbahKeluar() {
  const search = (document.getElementById('filterKeluarSearch').value || '').toLowerCase();
  const pk = document.getElementById('filterKeluarPK').value;
  const tglDari = document.getElementById('filterKeluarTglDari').value;
  const tglSampai = document.getElementById('filterKeluarTglSampai').value;

  let list = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');

  if (search) {
    list = list.filter(k => (k.suratJalan && k.suratJalan.toLowerCase().includes(search)) || (k.manifes && k.manifes.toLowerCase().includes(search)) || k.namaLimbah.toLowerCase().includes(search));
  }
  if (pk) {
    list = list.filter(k => k.tujuanPihakKetiga === pk);
  }
  if (tglDari) {
    list = list.filter(k => k.tanggalKeluar.slice(0, 10) >= tglDari);
  }
  if (tglSampai) {
    list = list.filter(k => k.tanggalKeluar.slice(0, 10) <= tglSampai);
  }

  renderLimbahKeluar(list);
}

function resetFilterLimbahKeluar() {
  document.getElementById('filterKeluarSearch').value = '';
  document.getElementById('filterKeluarPK').value = '';
  document.getElementById('filterKeluarTglDari').value = '';
  document.getElementById('filterKeluarTglSampai').value = '';
  renderLimbahKeluar();
}

function refreshLimbahKeluar() {
  resetFilterLimbahKeluar();
  showToast('Data Limbah Keluar disegarkan.', 'info');
}

function openModalLimbahKeluar() {
  const select = document.getElementById('keluarRefMasukSelect');
  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const tersedia = masuk.filter(m => m.statusStok === 'Tersedia');

  select.innerHTML = '<option value="">-- Pilih dari Stok Masuk yang Tersedia --</option>';
  tersedia.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.id} - ${t.namaLimbah} (Sisa: ${t.jumlah} ${t.satuan})</option>`;
  });

  const pkSelect = document.getElementById('keluarPihakKetigaSelect');
  const pihakKetiga = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
  pkSelect.innerHTML = '';
  pihakKetiga.forEach(pk => {
    pkSelect.innerHTML += `<option value="${pk.namaPerusahaan}">${pk.namaPerusahaan} (${pk.noIzin})</option>`;
  });

  document.getElementById('keluarTanggal').value = new Date().toISOString().slice(0, 16);
  openModal('modalLimbahKeluar');
}

function quickKeluarLimbah(idMasuk) {
  openModalLimbahKeluar();
  document.getElementById('keluarRefMasukSelect').value = idMasuk;
  handleSelectStokKeluar(idMasuk);
}

function handleSelectStokKeluar(idMasuk) {
  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const item = masuk.find(m => m.id === idMasuk);
  if (item) {
    document.getElementById('keluarJumlah').value = item.jumlah;
  }
}

function handleFormLimbahKeluar(e) {
  e.preventDefault();
  const refId = document.getElementById('keluarRefMasukSelect').value;
  const jumlah = parseFloat(document.getElementById('keluarJumlah').value);
  const tanggal = document.getElementById('keluarTanggal').value;
  const tujuan = document.getElementById('keluarPihakKetigaSelect').value;
  const noSJ = document.getElementById('keluarNoSJ').value.trim();
  const noManifes = document.getElementById('keluarNoManifes').value.trim();

  const masukList = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const itemIdx = masukList.findIndex(m => m.id === refId);

  if (itemIdx === -1) {
    showToast('Referensi limbah tidak valid.', 'error');
    return;
  }

  const itemMasuk = masukList[itemIdx];
  itemMasuk.statusStok = 'Keluar';
  localStorage.setItem('db_limbah_masuk', JSON.stringify(masukList));

  const newOutId = 'OUT-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
  const operatorName = STATE.currentUser ? STATE.currentUser.nama : 'Operator Lapangan';

  const newOutEntry = {
    id: newOutId,
    refIdMasuk: refId,
    tanggalKeluar: tanggal.replace('T', ' '),
    kodeLimbah: itemMasuk.kodeLimbah,
    namaLimbah: itemMasuk.namaLimbah,
    jumlah: jumlah,
    satuan: itemMasuk.satuan,
    tujuanPihakKetiga: tujuan,
    suratJalan: noSJ,
    manifes: noManifes,
    operator: operatorName,
    status: 'Keluar Terkonfirmasi'
  };

  const keluarList = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');
  keluarList.push(newOutEntry);
  localStorage.setItem('db_limbah_keluar', JSON.stringify(keluarList));

  addAuditLog(operatorName, 'INPUT_LIMBAH_KELUAR', `Menyerahkan limbah ${itemMasuk.namaLimbah} (${jumlah} ${itemMasuk.satuan}) ke ${tujuan}`);
  showToast('Pengeluaran limbah berhasil dicatat.', 'success');

  closeModal('modalLimbahKeluar');
  renderLimbahKeluar();
  renderDashboard();
}

// --- 4.4 PENANGANAN KHUSUS ---
function renderPenangananKhusus() {
  const table = document.getElementById('tablePenangananKhususBody');
  const data = JSON.parse(localStorage.getItem('db_penanganan_khusus') || '[]');
  table.innerHTML = '';

  if (data.length === 0) {
    table.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-500">Tidak ada antrean limbah penanganan khusus. Seluruh limbah sesuai dengan Rintek TPS 01.</td></tr>`;
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-amber-400 font-medium">${item.id}</td>
      <td class="font-mono text-xs text-slate-400">${item.refIdMasuk}</td>
      <td class="font-semibold text-white">${item.namaLimbah}</td>
      <td class="text-xs text-slate-300">${item.alasan}</td>
      <td>
        <span class="badge-status ${item.status === 'Approved' ? 'badge-green' : item.status === 'Rejected' ? 'badge-red' : 'badge-yellow'}">
          ${item.status}
        </span>
      </td>
      <td class="text-slate-400">${item.approver}</td>
      <td class="text-xs text-slate-300">${item.catatan}</td>
      <td>
        ${item.status === 'Pending' ? `
          <div class="flex items-center gap-1.5">
            <button onclick="approvePK('${item.id}', true)" class="btn-action-sm btn-edit">Approve</button>
            <button onclick="approvePK('${item.id}', false)" class="btn-action-sm btn-delete">Tolak</button>
          </div>
        ` : `<span class="text-xs text-slate-500">Selesai</span>`}
      </td>
    `;
    table.appendChild(tr);
  });
}

function approvePK(id, isApproved) {
  if (STATE.currentUser && STATE.currentUser.role !== 'Penanggung Jawab' && STATE.currentUser.role !== 'Manajemen / KTT') {
    showToast('Akses ditolak: Hanya Penanggung Jawab TPS yang berwenang.', 'error');
    return;
  }

  const catatan = prompt(`Catatan telaah (${isApproved ? 'Persetujuan' : 'Penolakan'}):`, 'Disetujui untuk penyimpanan sementara.') || '-';
  const list = JSON.parse(localStorage.getItem('db_penanganan_khusus') || '[]');
  const item = list.find(p => p.id === id);

  if (item) {
    item.status = isApproved ? 'Approved' : 'Rejected';
    item.approver = STATE.currentUser ? STATE.currentUser.nama : 'Hermanto (PJ TPS)';
    item.catatan = catatan;
    localStorage.setItem('db_penanganan_khusus', JSON.stringify(list));

    addAuditLog(item.approver, 'APPROVAL_PENANGANAN_KHUSUS', `${item.status} untuk ${id}`);
    showToast(`Status penanganan khusus diperbarui: ${item.status}`, 'info');
    renderPenangananKhusus();
    renderDashboard();
  }
}

// --- 4.5 INSPEKSI TPS K3L (DENGAN FILTER, REFRESH, EDIT, HAPUS - Revisi #1 & #4) ---
function renderInspeksi(filteredData = null) {
  const table = document.getElementById('tableInspeksiBody');
  const rawData = JSON.parse(localStorage.getItem('db_inspeksi') || '[]');
  const data = filteredData || rawData;
  table.innerHTML = '';

  if (data.length === 0) {
    table.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500">Belum ada riwayat inspeksi yang cocok.</td></tr>`;
    return;
  }

  data.slice().reverse().forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-sky-400 font-medium">${item.id}</td>
      <td class="text-xs text-slate-300">${item.tanggal}</td>
      <td class="font-semibold text-white">${item.itemChecklist}</td>
      <td>
        <span class="badge-status ${item.kondisi === 'Baik' ? 'badge-green' : 'badge-red'}">
          ${item.kondisi}
        </span>
      </td>
      <td class="text-xs text-slate-300">${item.catatan || '-'}</td>
      <td class="text-slate-400">${item.operator}</td>
      <td>
        <div class="flex items-center gap-1.5">
          <button onclick="openModalEditInspeksi('${item.id}')" class="btn-action-sm btn-edit" title="Edit Catatan"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
          <button onclick="deleteInspeksi('${item.id}')" class="btn-action-sm btn-delete" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </td>
    `;
    table.appendChild(tr);
  });
}

function applyFilterInspeksi() {
  const kondisi = document.getElementById('filterInspeksiKondisi').value;
  const tgl = document.getElementById('filterInspeksiTgl').value;
  let list = JSON.parse(localStorage.getItem('db_inspeksi') || '[]');

  if (kondisi) list = list.filter(i => i.kondisi === kondisi);
  if (tgl) list = list.filter(i => i.tanggal.slice(0, 10) === tgl);

  renderInspeksi(list);
}

function resetFilterInspeksi() {
  document.getElementById('filterInspeksiKondisi').value = '';
  document.getElementById('filterInspeksiTgl').value = '';
  renderInspeksi();
}

function refreshInspeksi() {
  resetFilterInspeksi();
  showToast('Data Inspeksi TPS disegarkan.', 'info');
}

function openModalInspeksi() {
  const container = document.getElementById('inspeksiItemsContainer');
  container.innerHTML = '';

  INSPEKSI_ITEMS_DEFAULT.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2';
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold text-white">${idx + 1}. ${item}</label>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1 text-xs text-emerald-400 cursor-pointer">
            <input type="radio" name="kondisi_${idx}" value="Baik" checked class="text-emerald-500"> Baik
          </label>
          <label class="flex items-center gap-1 text-xs text-rose-400 cursor-pointer">
            <input type="radio" name="kondisi_${idx}" value="Rusak" class="text-rose-500"> Rusak / Perbaikan
          </label>
        </div>
      </div>
      <input type="text" id="catatan_${idx}" placeholder="Catatan kondisi fisik / temuan..." class="auth-input !py-1.5 text-xs">
    `;
    container.appendChild(div);
  });

  openModal('modalInspeksi');
}

function handleFormInspeksi(e) {
  e.preventDefault();
  const operatorName = STATE.currentUser ? STATE.currentUser.nama : 'Operator Lapangan';
  const batchId = 'INSP-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const currentInspeksi = JSON.parse(localStorage.getItem('db_inspeksi') || '[]');
  let foundRusak = false;

  INSPEKSI_ITEMS_DEFAULT.forEach((item, idx) => {
    const radios = document.getElementsByName(`kondisi_${idx}`);
    let selectedKondisi = 'Baik';
    for (let r of radios) {
      if (r.checked) selectedKondisi = r.value;
    }

    if (selectedKondisi === 'Rusak') foundRusak = true;
    const catatan = document.getElementById(`catatan_${idx}`).value;

    currentInspeksi.push({
      id: `${batchId}-${idx + 1}`,
      tanggal: now,
      itemChecklist: item,
      kondisi: selectedKondisi,
      catatan: catatan,
      operator: operatorName
    });
  });

  localStorage.setItem('db_inspeksi', JSON.stringify(currentInspeksi));
  addAuditLog(operatorName, 'INSPEKSI_TPS', `Melakukan checklist inspeksi K3L (${batchId})`);

  if (foundRusak) {
    showToast('PERINGATAN K3L: Ditemukan sarana RUSAK. Notifikasi otomatis ke PJ TPS!', 'error');
  } else {
    showToast('Checklist inspeksi disimpan. Kondisi sarana BAIK.', 'success');
  }

  closeModal('modalInspeksi');
  renderInspeksi();
}

function openModalEditInspeksi(id) {
  const list = JSON.parse(localStorage.getItem('db_inspeksi') || '[]');
  const item = list.find(i => i.id === id);
  if (!item) return;

  document.getElementById('editInspeksiId').value = item.id;
  document.getElementById('editInspeksiItem').value = item.itemChecklist;
  document.getElementById('editInspeksiKondisi').value = item.kondisi;
  document.getElementById('editInspeksiCatatan').value = item.catatan || '';

  openModal('modalEditInspeksi');
}

function handleSaveEditInspeksi(e) {
  e.preventDefault();
  const id = document.getElementById('editInspeksiId').value;
  const kondisi = document.getElementById('editInspeksiKondisi').value;
  const catatan = document.getElementById('editInspeksiCatatan').value;

  const list = JSON.parse(localStorage.getItem('db_inspeksi') || '[]');
  const item = list.find(i => i.id === id);
  if (item) {
    item.kondisi = kondisi;
    item.catatan = catatan;
    localStorage.setItem('db_inspeksi', JSON.stringify(list));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Operator', 'EDIT_INSPEKSI', `Mengubah inspeksi ${id}`);
    showToast('Catatan inspeksi berhasil diperbarui.', 'success');
    closeModal('modalEditInspeksi');
    renderInspeksi();
  }
}

function deleteInspeksi(id) {
  if (confirm(`Apakah Anda yakin ingin menghapus data inspeksi ${id}?`)) {
    let list = JSON.parse(localStorage.getItem('db_inspeksi') || '[]');
    list = list.filter(i => i.id !== id);
    localStorage.setItem('db_inspeksi', JSON.stringify(list));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Operator', 'DELETE_INSPEKSI', `Menghapus data inspeksi ${id}`);
    showToast('Data inspeksi berhasil dihapus.', 'info');
    renderInspeksi();
  }
}

// --- 4.6 LOGBOOK PERMEN LHK (DENGAN FILTER, REFRESH & CETAK LANDSCAPE LAMPIRAN 1 - Revisi #2 & #4) ---
function renderLogbook(filteredData = null) {
  populateFilterLogbookKode();

  const table = document.getElementById('tableLogbookBody');
  const masuk = filteredData || JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const keluar = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');

  table.innerHTML = '';

  if (masuk.length === 0) {
    table.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-500">Belum ada data logbook.</td></tr>`;
    return;
  }

  const mapKeluar = {};
  keluar.forEach(k => { mapKeluar[k.refIdMasuk] = k; });

  masuk.forEach((m, idx) => {
    const k = mapKeluar[m.id];
    const jmlMasuk = parseFloat(m.jumlah) || 0;
    const jmlKeluar = k ? (parseFloat(k.jumlah) || 0) : 0;
    const sisa = Math.max(0, jmlMasuk - jmlKeluar);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-center font-mono">${idx + 1}</td>
      <td class="text-xs font-mono">${m.tanggalMasuk}</td>
      <td class="font-mono text-vault-lime font-bold">${m.kodeLimbah}</td>
      <td class="font-medium">${m.namaLimbah}</td>
      <td class="font-mono font-bold">${jmlMasuk} ${m.satuan}</td>
      <td class="text-xs font-mono">${k ? k.tanggalKeluar : '-'}</td>
      <td class="text-xs">${k ? k.tujuanPihakKetiga : '-'}</td>
      <td class="font-mono">${k ? `${jmlKeluar} ${m.satuan}` : '-'}</td>
      <td class="font-mono font-bold text-sky-400">${sisa} ${m.satuan}</td>
      <td class="text-xs text-slate-400">${m.operator}</td>
    `;
    table.appendChild(tr);
  });
}

function populateFilterLogbookKode() {
  const sel = document.getElementById('filterLogbookKode');
  if (sel && sel.options.length <= 1) {
    const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
    rintek.forEach(r => {
      sel.innerHTML += `<option value="${r.kodeLimbah}">${r.namaLimbah} (${r.kodeLimbah})</option>`;
    });
  }
}

function applyFilterLogbook() {
  const kode = document.getElementById('filterLogbookKode').value;
  const tglDari = document.getElementById('filterLogbookTglDari').value;
  const tglSampai = document.getElementById('filterLogbookTglSampai').value;

  let list = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');

  if (kode) list = list.filter(m => m.kodeLimbah === kode);
  if (tglDari) list = list.filter(m => m.tanggalMasuk.slice(0, 10) >= tglDari);
  if (tglSampai) list = list.filter(m => m.tanggalMasuk.slice(0, 10) <= tglSampai);

  renderLogbook(list);
}

function resetFilterLogbook() {
  document.getElementById('filterLogbookKode').value = '';
  document.getElementById('filterLogbookTglDari').value = '';
  document.getElementById('filterLogbookTglSampai').value = '';
  renderLogbook();
}

function refreshLogbook() {
  resetFilterLogbook();
  showToast('Logbook Permen LHK disegarkan.', 'info');
}

// --- CETAK LOGBOOK LANDSCAPE PERSIS LAMPIRAN 1 (Revisi #2) ---
function printOfficialLogbookLandscape() {
  const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');
  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const keluar = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');

  // Update KOP
  document.getElementById('kopLogbookNamaPerusahaan').textContent = (cfg.namaPerusahaan || 'PT. ETAM MANUNGGAL JAYA').toUpperCase();
  document.getElementById('kopLogbookAlamat').textContent = cfg.alamatKantor || 'Jalan S. Parman No. 6, Kota Samarinda, Kalimantan Timur';
  document.getElementById('kopLogbookKontak').textContent = `Telp: ${cfg.telpPerusahaan || '-'} • Email: ${cfg.emailPerusahaan || '-'}`;
  if (cfg.logoBase64) {
    document.getElementById('kopLogbookLogo').src = cfg.logoBase64;
    document.getElementById('kopLogbookLogo').style.display = 'block';
  } else {
    document.getElementById('kopLogbookLogo').style.display = 'none';
  }

  // Format Tanggal Indonesia: dd MMMM yyyy
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const now = new Date();
  const tglFormatted = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('printLogbookTanggal').textContent = tglFormatted;
  document.getElementById('printLogbookLokasi').textContent = 'Batuah';

  // Paraf Petugas / Operator Saja (Sesuai Revisi #2)
  const opName = STATE.currentUser ? STATE.currentUser.nama : 'Operator Lapangan';
  document.getElementById('printLogbookOperatorName').textContent = opName;

  // Render Tabel 11 Kolom Sesuai Lampiran 1
  const mapKeluar = {};
  keluar.forEach(k => { mapKeluar[k.refIdMasuk] = k; });

  const tbody = document.getElementById('printLogbookTableBody');
  tbody.innerHTML = '';

  masuk.forEach((m, idx) => {
    const k = mapKeluar[m.id];
    const jmlMasuk = parseFloat(m.jumlah) || 0;
    const jmlKeluar = k ? (parseFloat(k.jumlah) || 0) : 0;
    const sisa = Math.max(0, jmlMasuk - jmlKeluar);

    // Format tanggal dd/MM/yyyy
    const tglMasukFormatted = formatDateSlashes(m.tanggalMasuk);
    const tglTempoFormatted = formatDateSlashes(m.tanggalJatuhTempo);
    const tglKeluarFormatted = k ? formatDateSlashes(k.tanggalKeluar) : '-';
    const buktiDok = k ? `${k.suratJalan || ''} / ${k.manifes || ''}` : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${m.namaLimbah}</strong><br><span style="font-size: 7.5pt; color: #555;">Kode: ${m.kodeLimbah}</span></td>
      <td style="text-align: center;">${tglMasukFormatted}</td>
      <td>${m.sumber || 'Workshop Tambang'}</td>
      <td style="text-align: right; font-weight: bold;">${jmlMasuk.toLocaleString('id-ID')} ${m.satuan}</td>
      <td style="text-align: center;">${tglTempoFormatted}</td>
      <td style="text-align: center;">${tglKeluarFormatted}</td>
      <td style="text-align: right;">${k ? `${jmlKeluar.toLocaleString('id-ID')} ${m.satuan}` : '-'}</td>
      <td>${k ? k.tujuanPihakKetiga : '-'}</td>
      <td style="font-size: 7.5pt;">${buktiDok}</td>
      <td style="text-align: right; font-weight: bold;">${sisa.toLocaleString('id-ID')} ${m.satuan}</td>
    `;
    tbody.appendChild(tr);
  });

  // Trigger Print Landscape
  document.body.className = 'print-landscape';
  const printEl = document.getElementById('printLogbookLandscapeContainer');
  printEl.classList.add('active-print');

  setTimeout(() => {
    window.print();
    printEl.classList.remove('active-print');
    document.body.className = '';
  }, 200);
}

function formatDateSlashes(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = ('0' + d.getDate()).slice(-2);
    const m = ('0' + (d.getMonth() + 1)).slice(-2);
    const y = d.getFullYear();
    return `${day}/${m}/${y}`;
  } catch(e) {
    return dateStr;
  }
}

function exportLogbookCSV() {
  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const keluar = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');
  const mapKeluar = {};
  keluar.forEach(k => { mapKeluar[k.refIdMasuk] = k; });

  let csvContent = '\uFEFF';
  csvContent += 'No,Jenis Limbah B3 Masuk,Tanggal Masuk,Sumber Limbah B3,Jumlah Masuk,Satuan,Maksimal Penyimpanan s/d,Tanggal Keluar,Jumlah Keluar,Tujuan Penyerahan,Bukti Nomor Dokumen,Sisa Limbah di TPS,Paraf Petugas\n';

  masuk.forEach((m, idx) => {
    const k = mapKeluar[m.id];
    const jmlMasuk = parseFloat(m.jumlah) || 0;
    const jmlKeluar = k ? (parseFloat(k.jumlah) || 0) : 0;
    const sisa = Math.max(0, jmlMasuk - jmlKeluar);
    const buktiDok = k ? `${k.suratJalan} / ${k.manifes}` : '-';

    csvContent += `"${idx + 1}","${m.namaLimbah} (${m.kodeLimbah})","${m.tanggalMasuk}","${m.sumber || 'Workshop'}","${jmlMasuk}","${m.satuan}","${m.tanggalJatuhTempo || '-'}","${k ? k.tanggalKeluar : '-'}","${jmlKeluar}","${k ? k.tujuanPihakKetiga : '-'}","${buktiDok}","${sisa}","${m.operator}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Logbook_Lampiran1_PermenLHK_PT_EMJ_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('File CSV Logbook berhasil diunduh.', 'success');
}

// --- 4.7 NERACA LIMBAH B3 & CETAK PORTRAIT LAMPIRAN 2 (Revisi #3 & #4) ---
function renderNeraca(filteredData = null) {
  const container = document.getElementById('neracaListContainer');
  const rawList = JSON.parse(localStorage.getItem('db_neraca') || '[]');
  const neracaList = filteredData || rawList;
  container.innerHTML = '';

  if (neracaList.length === 0) {
    container.innerHTML = `
      <div class="data-card text-center py-12 text-slate-400">
        <i data-lucide="scale" class="w-12 h-12 mx-auto text-slate-600 mb-3"></i>
        <p class="font-bold text-white">Tidak Ada Neraca yang Cocok dengan Filter</p>
      </div>
    `;
    return;
  }

  neracaList.forEach(n => {
    const card = document.createElement('div');
    card.className = 'data-card space-y-6';
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-vault-border gap-2">
        <div>
          <span class="text-[10px] font-mono font-bold text-vault-lime uppercase tracking-widest">NERACA LIMBAH B3 RESMI (LAMPIRAN IX)</span>
          <h3 class="text-lg font-bold text-white">${n.periode}</h3>
          <p class="text-xs text-slate-400">PT. Etam Manunggal Jaya &bull; Dokumen ID: <span class="font-mono text-sky-400">${n.id}</span></p>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge-status ${n.status === 'Final' ? 'badge-green' : 'badge-yellow'} font-bold">
            ${n.status}
          </span>
          <button onclick="printOfficialNeracaPortrait('${n.id}')" class="btn-primary-pill !w-auto !py-1.5 !px-3 text-xs bg-slate-800">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i> Cetak Neraca (Portrait)
          </button>
        </div>
      </div>

      <!-- Preview Ringkas Screen -->
      <div class="overflow-x-auto rounded-xl border border-vault-border">
        <table class="custom-table text-xs">
          <thead>
            <tr class="bg-slate-800">
              <th>Komponen</th>
              <th>Uraian</th>
              <th class="text-right">Jumlah (Ton)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-bold text-vault-lime font-mono">A. TOTAL DIHASILKAN</td>
              <td>Akumulasi limbah B3 masuk ke TPS 01</td>
              <td class="font-mono font-bold text-right text-white">${n.dataA} Ton</td>
            </tr>
            <tr>
              <td class="font-bold text-sky-400 font-mono">B. PERLAKUAN</td>
              <td>Diserahkan (${n.dataB.diserahkanPihakKetiga} Ton) & Disimpan (${n.dataB.disimpan} Ton)</td>
              <td class="font-mono font-bold text-right text-white">${(parseFloat(n.dataB.diserahkanPihakKetiga) + parseFloat(n.dataB.disimpan)).toFixed(3)} Ton</td>
            </tr>
            <tr class="bg-slate-900 font-bold">
              <td colspan="2" class="text-white">KINERJA PENGELOLAAN: [ (A - (C+D)) / A ] &times; 100%</td>
              <td class="text-right text-vault-lime font-mono text-sm">${n.kinerja}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 3-Tier E-Signature Workflow Box -->
      <div>
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Verifikasi & Pengesahan Digital Berjenjang (3 Tingkat)
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Tier 1: Operator -->
          <div class="p-4 rounded-2xl bg-slate-900/80 border ${n.ttdOperator ? 'border-emerald-500/40' : 'border-slate-800'} text-center space-y-2">
            <span class="text-[10px] uppercase font-bold text-slate-400">1. Disusun Oleh</span>
            <p class="text-xs font-bold text-white">Operator TPS LB3</p>
            <div class="h-20 flex items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/60 p-1">
              ${n.ttdOperator ? `<img src="${n.ttdOperator}" class="max-h-16 mx-auto">` : `<span class="text-[11px] text-slate-600 italic">Belum diparaf</span>`}
            </div>
            ${!n.ttdOperator ? `
              <button onclick="openSignatureModal('${n.id}', 'Operator')" class="btn-primary-pill !w-full !py-1.5 text-xs">
                Paraf Operator
              </button>
            ` : `<span class="text-[11px] text-emerald-400 font-mono font-bold flex items-center justify-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Terverifikasi</span>`}
          </div>

          <!-- Tier 2: Penanggung Jawab -->
          <div class="p-4 rounded-2xl bg-slate-900/80 border ${n.ttdPJ ? 'border-emerald-500/40' : 'border-slate-800'} text-center space-y-2">
            <span class="text-[10px] uppercase font-bold text-slate-400">2. Diperiksa Oleh</span>
            <p class="text-xs font-bold text-white">Penanggung Jawab TPS</p>
            <div class="h-20 flex items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/60 p-1">
              ${n.ttdPJ ? `<img src="${n.ttdPJ}" class="max-h-16 mx-auto">` : `<span class="text-[11px] text-slate-600 italic">Menunggu Operator</span>`}
            </div>
            ${!n.ttdPJ && n.ttdOperator ? `
              <button onclick="openSignatureModal('${n.id}', 'Penanggung Jawab')" class="btn-lime-pill !w-full !py-1.5 text-xs justify-center">
                Tanda Tangan PJ
              </button>
            ` : n.ttdPJ ? `<span class="text-[11px] text-emerald-400 font-mono font-bold flex items-center justify-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Disetujui PJ</span>` : `<span class="text-[11px] text-slate-500">Antrean Level 2</span>`}
          </div>

          <!-- Tier 3: KTT -->
          <div class="p-4 rounded-2xl bg-slate-900/80 border ${n.ttdKTT ? 'border-emerald-500/40' : 'border-slate-800'} text-center space-y-2">
            <span class="text-[10px] uppercase font-bold text-slate-400">3. Disahkan Oleh</span>
            <p class="text-xs font-bold text-white">Kepala Teknik Tambang (KTT)</p>
            <div class="h-20 flex items-center justify-center border border-dashed border-slate-800 rounded-xl bg-slate-950/60 p-1">
              ${n.ttdKTT ? `<img src="${n.ttdKTT}" class="max-h-16 mx-auto">` : `<span class="text-[11px] text-slate-600 italic">Menunggu PJ</span>`}
            </div>
            ${!n.ttdKTT && n.ttdPJ ? `
              <button onclick="openSignatureModal('${n.id}', 'Manajemen / KTT')" class="btn-primary-pill !w-full !py-1.5 text-xs bg-purple-600 hover:bg-purple-500">
                Sahkan (KTT)
              </button>
            ` : n.ttdKTT ? `<span class="text-[11px] text-purple-400 font-mono font-bold flex items-center justify-center gap-1"><i data-lucide="award" class="w-3.5 h-3.5"></i> Disahkan KTT (Final)</span>` : `<span class="text-[11px] text-slate-500">Antrean Level 3</span>`}
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function applyFilterNeraca() {
  const status = document.getElementById('filterNeracaStatus').value;
  let list = JSON.parse(localStorage.getItem('db_neraca') || '[]');
  if (status) {
    list = list.filter(n => n.status.includes(status));
  }
  renderNeraca(list);
}

function resetFilterNeraca() {
  document.getElementById('filterNeracaStatus').value = '';
  renderNeraca();
}

function refreshNeraca() {
  resetFilterNeraca();
  showToast('Neraca Limbah disegarkan.', 'info');
}

// --- CETAK NERACA PORTRAIT PERSIS LAMPIRAN 2 (Revisi #3) ---
function printOfficialNeracaPortrait(neracaId) {
  const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');
  const neracaList = JSON.parse(localStorage.getItem('db_neraca') || '[]');
  const n = neracaList.find(item => item.id === neracaId) || neracaList[0];
  if (!n) return;

  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');

  // Update KOP
  document.getElementById('kopNeracaNamaPerusahaan').textContent = (cfg.namaPerusahaan || 'PT. ETAM MANUNGGAL JAYA').toUpperCase();
  document.getElementById('kopNeracaAlamat').textContent = cfg.alamatKantor || 'Jalan S. Parman No. 6, Kota Samarinda, Kalimantan Timur';
  document.getElementById('kopNeracaKontak').textContent = `Telp: ${cfg.telpPerusahaan || '-'} • Email: ${cfg.emailPerusahaan || '-'}`;
  if (cfg.logoBase64) {
    document.getElementById('kopNeracaLogo').src = cfg.logoBase64;
    document.getElementById('kopNeracaLogo').style.display = 'block';
  } else {
    document.getElementById('kopNeracaLogo').style.display = 'none';
  }

  // Metadata
  document.getElementById('printNeracaPerusahaan').textContent = cfg.namaPerusahaan || 'PT. Etam Manunggal Jaya';
  document.getElementById('printNeracaBidangUsaha').textContent = cfg.bidangUsaha || 'Pertambangan Batubara';
  document.getElementById('printNeracaPeriode').textContent = n.periode;

  // Bagian I: Jenis Awal Limbah Table
  const tbodyA = document.getElementById('printNeracaTableA');
  tbodyA.innerHTML = '';

  const rintekMap = {};
  masuk.forEach(m => {
    rintekMap[m.namaLimbah] = (rintekMap[m.namaLimbah] || 0) + (parseFloat(m.jumlah) || 0);
  });

  let counter = 1;
  for (let [nama, kg] of Object.entries(rintekMap)) {
    const ton = (kg / 1000).toFixed(3);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${counter++}</td>
      <td>${nama}</td>
      <td style="text-align: right; font-weight: bold;">${ton}</td>
      <td colspan="3">Penyimpanan di TPS LB3 01</td>
    `;
    tbodyA.appendChild(tr);
  }
  document.getElementById('printNeracaTotalA').textContent = `A (+) ${n.dataA}`;

  // Bagian II: Perlakuan
  const tbodyB = document.getElementById('printNeracaTableB');
  tbodyB.innerHTML = '';

  const perlakuanList = [
    { no: '1', nama: 'DISIMPAN', jumlah: n.dataB.disimpan, jenis: 'Limbah B3 di TPS 01', izin: 'ADA' },
    { no: '2', nama: 'DIMANFAATKAN', jumlah: n.dataB.dimanfaatkan, jenis: '-', izin: '-' },
    { no: '3', nama: 'DIOLAH', jumlah: n.dataB.diolah, jenis: '-', izin: '-' },
    { no: '4', nama: 'DITIMBUN', jumlah: n.dataB.ditimbun, jenis: '-', izin: '-' },
    { no: '5', nama: 'DISERAHKAN KE PIHAK KETIGA', jumlah: n.dataB.diserahkanPihakKetiga, jenis: 'PT. Berkat Jaya Sukses', izin: 'ADA' },
    { no: '6', nama: 'EKSPOR', jumlah: n.dataB.ekspor, jenis: '-', izin: '-' },
    { no: '7', nama: 'PERLAKUAN LAINNYA', jumlah: n.dataB.lainnya, jenis: '-', izin: '-' }
  ];

  let totalB = 0;
  perlakuanList.forEach(p => {
    totalB += parseFloat(p.jumlah);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${p.no}</td>
      <td><strong>${p.nama}</strong></td>
      <td style="text-align: right; font-weight: bold;">${p.jumlah}</td>
      <td>${p.jenis}</td>
      <td style="text-align: center;">${p.izin === 'ADA' ? '✓' : '-'}</td>
      <td style="text-align: center;">${p.izin === 'TIDAK ADA' ? '✓' : '-'}</td>
    `;
    tbodyB.appendChild(tr);
  });
  document.getElementById('printNeracaTotalB').textContent = `B (-) ${totalB.toFixed(3)}`;

  // Ringkasan Formula Residu C & Belum Terkelola D
  document.getElementById('printNeracaResiduC').textContent = n.dataC || '0.000';
  document.getElementById('printNeracaBelumD').textContent = n.dataD || '0.000';
  document.getElementById('printNeracaTotalSisaCD').textContent = (parseFloat(n.dataC || 0) + parseFloat(n.dataD || 0)).toFixed(3);
  document.getElementById('printNeracaKinerjaRumus').textContent = n.kinerja;

  // Box Tanda Tangan 3 Role (Revisi #3)
  const boxOp = document.getElementById('printNeracaTtdOp');
  boxOp.innerHTML = n.ttdOperator ? `<img src="${n.ttdOperator}" style="max-height: 45px;">` : `<span style="font-size: 8pt; color: #888;">(Belum Paraf)</span>`;

  const boxPJ = document.getElementById('printNeracaTtdPJ');
  boxPJ.innerHTML = n.ttdPJ ? `<img src="${n.ttdPJ}" style="max-height: 45px;">` : `<span style="font-size: 8pt; color: #888;">(Belum Disetujui)</span>`;

  const boxKTT = document.getElementById('printNeracaTtdKTT');
  boxKTT.innerHTML = n.ttdKTT ? `<img src="${n.ttdKTT}" style="max-height: 45px;">` : `<span style="font-size: 8pt; color: #888;">(Belum Disahkan)</span>`;

  // Trigger Print Portrait
  document.body.className = 'print-portrait';
  const printEl = document.getElementById('printNeracaPortraitContainer');
  printEl.classList.add('active-print');

  setTimeout(() => {
    window.print();
    printEl.classList.remove('active-print');
    document.body.className = '';
  }, 200);
}

function generateDraftNeracaPrompt() {
  const periode = prompt('Nama Periode Neraca (misal: Triwulan III 2026):', 'Triwulan III (Juli - September 2026)');
  if (!periode) return;

  const masuk = JSON.parse(localStorage.getItem('db_limbah_masuk') || '[]');
  const keluar = JSON.parse(localStorage.getItem('db_limbah_keluar') || '[]');

  let totalMasukKg = 0;
  masuk.forEach(m => totalMasukKg += (parseFloat(m.jumlah) || 0));
  const dataATon = (totalMasukKg / 1000).toFixed(3);

  let totalKeluarKg = 0;
  keluar.forEach(k => totalKeluarKg += (parseFloat(k.jumlah) || 0));
  const diserahkanTon = (totalKeluarKg / 1000).toFixed(3);
  const disimpanTon = Math.max(0, (totalMasukKg - totalKeluarKg) / 1000).toFixed(3);

  const newNeraca = {
    id: 'NERACA-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 11),
    periode: periode,
    dataA: dataATon,
    dataB: {
      disimpan: disimpanTon,
      dimanfaatkan: '0.000',
      diolah: '0.000',
      ditimbun: '0.000',
      diserahkanPihakKetiga: diserahkanTon,
      ekspor: '0.000',
      lainnya: '0.000'
    },
    dataC: '0.000',
    dataD: '0.000',
    kinerja: '100.00%',
    status: 'Draft (Menunggu Paraf Operator)',
    ttdOperator: '',
    ttdPJ: '',
    ttdKTT: '',
    createdAt: new Date().toISOString().slice(0, 10)
  };

  const list = JSON.parse(localStorage.getItem('db_neraca') || '[]');
  list.unshift(newNeraca);
  localStorage.setItem('db_neraca', JSON.stringify(list));

  addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Operator', 'GENERATE_NERACA', `Membuat draft Neraca Limbah B3 untuk periode ${periode}`);
  showToast('Draft Neraca baru berhasil disusun.', 'success');
  renderNeraca();
}

// --- E-SIGNATURE CANVAS ---
let canvas, ctx, isDrawing = false;

function openSignatureModal(neracaId, role) {
  STATE.signatureTarget = { neracaId, role };
  document.getElementById('signatureRoleLabel').textContent = `Penandatangan: ${role} (${STATE.currentUser ? STATE.currentUser.nama : 'Pengguna'})`;
  openModal('modalSignature');

  setTimeout(() => {
    initSignatureCanvas();
  }, 150);
}

function initSignatureCanvas() {
  canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 180;

  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0f172a';

  clearSignatureCanvas();

  canvas.onmousedown = startDrawing;
  canvas.onmousemove = draw;
  canvas.onmouseup = stopDrawing;

  canvas.ontouchstart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrawing({ clientX: touch.clientX, clientY: touch.clientY });
  };
  canvas.ontouchmove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
  };
  canvas.ontouchend = stopDrawing;
}

function startDrawing(e) {
  isDrawing = true;
  ctx.beginPath();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.moveTo(x, y);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  ctx.lineTo(x, y);
  ctx.stroke();
}

function stopDrawing() { isDrawing = false; }

function clearSignatureCanvas() {
  if (!ctx || !canvas) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function submitDigitalSignature() {
  if (!canvas || !STATE.signatureTarget) return;
  const signatureDataUrl = canvas.toDataURL('image/png');

  const { neracaId, role } = STATE.signatureTarget;
  const neracaList = JSON.parse(localStorage.getItem('db_neraca') || '[]');
  const item = neracaList.find(n => n.id === neracaId);

  if (!item) {
    showToast('Data neraca tidak ditemukan.', 'error');
    return;
  }

  if (role === 'Operator') {
    item.ttdOperator = signatureDataUrl;
    item.status = 'Menunggu Approval Penanggung Jawab';
  } else if (role === 'Penanggung Jawab') {
    item.ttdPJ = signatureDataUrl;
    item.status = 'Menunggu Pengesahan KTT';
  } else if (role === 'Manajemen / KTT' || role === 'KTT') {
    item.ttdKTT = signatureDataUrl;
    item.status = 'Final';
  }

  localStorage.setItem('db_neraca', JSON.stringify(neracaList));
  addAuditLog(STATE.currentUser ? STATE.currentUser.nama : role, 'SIGN_NERACA', `Menandatangani Neraca ${neracaId} sebagai ${role}`);

  showToast(`Tanda tangan elektronik ${role} berhasil dibubuhkan!`, 'success');
  closeModal('modalSignature');
  renderNeraca();
}

// --- 4.8 MASTER RINTEK (DENGAN EDIT & HAPUS - Revisi #1) ---
function renderMasterRintek() {
  const table = document.getElementById('tableMasterRintekBody');
  const data = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  table.innerHTML = '';

  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-vault-lime font-bold">${r.kodeLimbah}</td>
      <td class="font-semibold text-white">${r.namaLimbah}</td>
      <td class="text-xs text-slate-300">${r.sumber}</td>
      <td class="text-xs text-slate-300">${r.karakteristik}</td>
      <td class="text-xs font-mono text-slate-300">${r.jenisWadah}</td>
      <td class="font-mono">${r.kapasitasWadah} ${r.satuan}</td>
      <td>
        <span class="badge-status ${r.batasSimpanHari <= 90 ? 'badge-yellow' : 'badge-green'} font-mono">
          ${r.batasSimpanHari} Hari
        </span>
      </td>
      <td>
        <div class="flex items-center gap-1.5">
          <button onclick="openModalEditRintek('${r.kodeLimbah}')" class="btn-action-sm btn-edit" title="Edit"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Edit</button>
          <button onclick="deleteRintek('${r.kodeLimbah}')" class="btn-action-sm btn-delete" title="Hapus"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus</button>
        </div>
      </td>
    `;
    table.appendChild(tr);
  });
}

function openModalTambahRintek() {
  const kode = prompt('Kode Limbah (misal: B106d):');
  if (!kode) return;
  const nama = prompt('Nama Limbah B3:');
  if (!nama) return;
  const sumber = prompt('Sumber Limbah B3:', 'Sumber spesifik operasional tambang');
  const kar = prompt('Karakteristik (Beracun, Mudah Terbakar, dsb):', 'Beracun');
  const wadah = prompt('Jenis Wadah:', 'Drum');
  const kap = prompt('Kapasitas Wadah:', '200');
  const satuan = prompt('Satuan (Kg/Liter):', 'Kg');
  const hari = prompt('Batas Waktu Simpan (90/180/365 hari):', '90');

  const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  rintek.push({
    kodeLimbah: kode,
    namaLimbah: nama,
    sumber: sumber || 'Tambang',
    karakteristik: kar || 'Beracun',
    jenisWadah: wadah || 'Drum',
    kapasitasWadah: parseFloat(kap) || 200,
    satuan: satuan || 'Kg',
    batasSimpanHari: parseInt(hari) || 90
  });

  localStorage.setItem('db_rintek', JSON.stringify(rintek));
  addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'ADD_RINTEK', `Menambahkan master rintek ${nama} (${kode})`);
  showToast('Data Rintek berhasil ditambahkan.', 'success');
  renderMasterRintek();
}

function openModalEditRintek(kode) {
  const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  const item = rintek.find(r => r.kodeLimbah === kode);
  if (!item) return;

  document.getElementById('editRintekOriginalKode').value = item.kodeLimbah;
  document.getElementById('editRintekKode').value = item.kodeLimbah;
  document.getElementById('editRintekNama').value = item.namaLimbah;
  document.getElementById('editRintekSumber').value = item.sumber;
  document.getElementById('editRintekKarakteristik').value = item.karakteristik;
  document.getElementById('editRintekWadah').value = item.jenisWadah;
  document.getElementById('editRintekKapasitas').value = item.kapasitasWadah;
  document.getElementById('editRintekSatuan').value = item.satuan;
  document.getElementById('editRintekBatasHari').value = item.batasSimpanHari;

  openModal('modalEditRintek');
}

function handleSaveEditRintek(e) {
  e.preventDefault();
  const origKode = document.getElementById('editRintekOriginalKode').value;
  const kode = document.getElementById('editRintekKode').value.trim();
  const nama = document.getElementById('editRintekNama').value.trim();
  const sumber = document.getElementById('editRintekSumber').value.trim();
  const kar = document.getElementById('editRintekKarakteristik').value.trim();
  const wadah = document.getElementById('editRintekWadah').value.trim();
  const kap = parseFloat(document.getElementById('editRintekKapasitas').value) || 200;
  const sat = document.getElementById('editRintekSatuan').value;
  const hari = parseInt(document.getElementById('editRintekBatasHari').value) || 90;

  const rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
  const idx = rintek.findIndex(r => r.kodeLimbah === origKode);

  if (idx !== -1) {
    rintek[idx] = {
      kodeLimbah: kode,
      namaLimbah: nama,
      sumber: sumber,
      karakteristik: kar,
      jenisWadah: wadah,
      kapasitasWadah: kap,
      satuan: sat,
      batasSimpanHari: hari
    };
    localStorage.setItem('db_rintek', JSON.stringify(rintek));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'EDIT_RINTEK', `Mengubah rintek ${nama} (${kode})`);
    showToast('Data Rintek berhasil diperbarui.', 'success');
    closeModal('modalEditRintek');
    renderMasterRintek();
  }
}

function deleteRintek(kode) {
  if (confirm(`Apakah Anda yakin ingin menghapus limbah Rintek ${kode}?`)) {
    let rintek = JSON.parse(localStorage.getItem('db_rintek') || '[]');
    rintek = rintek.filter(r => r.kodeLimbah !== kode);
    localStorage.setItem('db_rintek', JSON.stringify(rintek));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'DELETE_RINTEK', `Menghapus limbah rintek ${kode}`);
    showToast('Data Rintek berhasil dihapus.', 'info');
    renderMasterRintek();
  }
}

// --- 4.9 MASTER PIHAK KETIGA (DENGAN EDIT & HAPUS - Revisi #1) ---
function renderMasterPihakKetiga() {
  const table = document.getElementById('tablePihakKetigaBody');
  const data = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
  table.innerHTML = '';

  data.forEach(pk => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-sky-400">${pk.id}</td>
      <td class="font-bold text-white">${pk.namaPerusahaan}</td>
      <td class="font-mono text-xs text-vault-lime">${pk.noIzin}</td>
      <td class="text-xs text-slate-300">${pk.alamat}</td>
      <td class="text-xs text-slate-400">${pk.kontak}</td>
      <td>
        <div class="flex items-center gap-1.5">
          <button onclick="openModalEditPK('${pk.id}')" class="btn-action-sm btn-edit"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Edit</button>
          <button onclick="deletePihakKetiga('${pk.id}')" class="btn-action-sm btn-delete"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus</button>
        </div>
      </td>
    `;
    table.appendChild(tr);
  });
}

function openModalTambahPihakKetiga() {
  const nama = prompt('Nama Perusahaan Pihak Ketiga:');
  if (!nama) return;
  const izin = prompt('Nomor Izin Operasional KLHK:');
  const alamat = prompt('Alamat Operasional:', 'Balikpapan / Samarinda');
  const kontak = prompt('Kontak Person / Telepon:');

  const pkList = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
  const newId = 'PK-' + ('00' + (pkList.length + 1)).slice(-3);

  pkList.push({
    id: newId,
    namaPerusahaan: nama,
    noIzin: izin || 'Dalam Proses',
    alamat: alamat || 'Kalimantan Timur',
    kontak: kontak || '-'
  });

  localStorage.setItem('db_pihak_ketiga', JSON.stringify(pkList));
  addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'ADD_PIHAK_KETIGA', `Menambahkan mitra pihak ketiga ${nama}`);
  showToast('Pihak ketiga berhasil ditambahkan.', 'success');
  renderMasterPihakKetiga();
}

function openModalEditPK(id) {
  const pkList = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
  const item = pkList.find(p => p.id === id);
  if (!item) return;

  document.getElementById('editPKId').value = item.id;
  document.getElementById('editPKNama').value = item.namaPerusahaan;
  document.getElementById('editPKIzin').value = item.noIzin;
  document.getElementById('editPKAlamat').value = item.alamat;
  document.getElementById('editPKKontak').value = item.kontak;

  openModal('modalEditPK');
}

function handleSaveEditPK(e) {
  e.preventDefault();
  const id = document.getElementById('editPKId').value;
  const nama = document.getElementById('editPKNama').value.trim();
  const izin = document.getElementById('editPKIzin').value.trim();
  const alamat = document.getElementById('editPKAlamat').value.trim();
  const kontak = document.getElementById('editPKKontak').value.trim();

  const pkList = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
  const idx = pkList.findIndex(p => p.id === id);

  if (idx !== -1) {
    pkList[idx] = { id, namaPerusahaan: nama, noIzin: izin, alamat, kontak };
    localStorage.setItem('db_pihak_ketiga', JSON.stringify(pkList));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'EDIT_PIHAK_KETIGA', `Mengubah pihak ketiga ${nama}`);
    showToast('Data pihak ketiga berhasil diperbarui.', 'success');
    closeModal('modalEditPK');
    renderMasterPihakKetiga();
  }
}

function deletePihakKetiga(id) {
  if (confirm(`Apakah Anda yakin ingin menghapus pihak ketiga ${id}?`)) {
    let pkList = JSON.parse(localStorage.getItem('db_pihak_ketiga') || '[]');
    pkList = pkList.filter(p => p.id !== id);
    localStorage.setItem('db_pihak_ketiga', JSON.stringify(pkList));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'DELETE_PIHAK_KETIGA', `Menghapus pihak ketiga ${id}`);
    showToast('Pihak ketiga berhasil dihapus.', 'info');
    renderMasterPihakKetiga();
  }
}

// --- 4.10 MASTER USERS (DENGAN EDIT & HAPUS - Revisi #1) ---
function renderMasterUsers() {
  const table = document.getElementById('tableUsersBody');
  const data = JSON.parse(localStorage.getItem('db_users') || '[]');
  table.innerHTML = '';

  data.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-sky-400">${u.id}</td>
      <td class="font-bold text-white">${u.nama}</td>
      <td class="font-mono text-xs text-slate-300">${u.username}</td>
      <td><span class="badge-status badge-blue">${u.role}</span></td>
      <td><span class="badge-status ${u.status === 'Aktif' ? 'badge-green' : 'badge-red'}">${u.status}</span></td>
      <td>
        <div class="flex items-center gap-1.5">
          <button onclick="openModalEditUser('${u.id}')" class="btn-action-sm btn-edit"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Edit</button>
          <button onclick="resetUserPassword('${u.username}')" class="btn-action-sm role-quick-btn">Reset Pass</button>
          <button onclick="deleteUser('${u.id}')" class="btn-action-sm btn-delete"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus</button>
        </div>
      </td>
    `;
    table.appendChild(tr);
  });
}

function openModalTambahUser() {
  const nama = prompt('Nama Lengkap:');
  if (!nama) return;
  const username = prompt('Username Login:');
  if (!username) return;
  const role = prompt('Pilih Role (Operator / Penanggung Jawab / Admin HSE / Manajemen / KTT):', 'Operator');
  const password = prompt('Password Awal:', 'password123');

  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const newId = 'USR-' + ('00' + (users.length + 1)).slice(-2);

  users.push({
    id: newId,
    nama: nama,
    username: username,
    password: password || 'password123',
    role: role || 'Operator',
    status: 'Aktif',
    fotoProfil: ''
  });

  localStorage.setItem('db_users', JSON.stringify(users));
  addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'ADD_USER', `Mendaftarkan pengguna baru: ${username} (${role})`);
  showToast('Pengguna baru berhasil didaftarkan.', 'success');
  renderMasterUsers();
}

function openModalEditUser(id) {
  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const item = users.find(u => u.id === id);
  if (!item) return;

  document.getElementById('editUserId').value = item.id;
  document.getElementById('editUserNama').value = item.nama;
  document.getElementById('editUserUsername').value = item.username;
  document.getElementById('editUserRole').value = item.role;
  document.getElementById('editUserStatus').value = item.status || 'Aktif';

  openModal('modalEditUser');
}

function handleSaveEditUser(e) {
  e.preventDefault();
  const id = document.getElementById('editUserId').value;
  const nama = document.getElementById('editUserNama').value.trim();
  const username = document.getElementById('editUserUsername').value.trim();
  const role = document.getElementById('editUserRole').value;
  const status = document.getElementById('editUserStatus').value;

  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const idx = users.findIndex(u => u.id === id);

  if (idx !== -1) {
    users[idx].nama = nama;
    users[idx].username = username;
    users[idx].role = role;
    users[idx].status = status;

    localStorage.setItem('db_users', JSON.stringify(users));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'EDIT_USER', `Mengubah data user ${username}`);
    showToast('Data pengguna berhasil diperbarui.', 'success');
    closeModal('modalEditUser');
    renderMasterUsers();
  }
}

function deleteUser(id) {
  if (confirm(`Apakah Anda yakin ingin menghapus pengguna ${id}?`)) {
    let users = JSON.parse(localStorage.getItem('db_users') || '[]');
    users = users.filter(u => u.id !== id);
    localStorage.setItem('db_users', JSON.stringify(users));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'DELETE_USER', `Menghapus pengguna ${id}`);
    showToast('Pengguna berhasil dihapus.', 'info');
    renderMasterUsers();
  }
}

function resetUserPassword(username) {
  const newPass = prompt(`Reset password untuk pengguna ${username}:`, 'password123');
  if (!newPass) return;

  const users = JSON.parse(localStorage.getItem('db_users') || '[]');
  const u = users.find(user => user.username === username);
  if (u) {
    u.password = newPass;
    localStorage.setItem('db_users', JSON.stringify(users));
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'RESET_PASSWORD', `Mereset password user ${username}`);
    showToast(`Password untuk ${username} berhasil diubah.`, 'info');
  }
}

// --- 4.11 SETTINGS, UPLOAD LOGO & BACKGROUND (Revisi #5) ---
function renderSettingsAndAudit() {
  document.getElementById('inputGasUrl').value = STATE.gasApiUrl;
  const auditTable = document.getElementById('tableAuditLogsBody');
  const logs = JSON.parse(localStorage.getItem('db_audit') || '[]');
  auditTable.innerHTML = '';

  logs.slice().reverse().slice(0, 30).forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono text-slate-400 whitespace-nowrap">${log.timestamp}</td>
      <td class="font-medium text-white">${log.user}</td>
      <td class="font-mono text-sky-400 font-bold">${log.aksi}</td>
      <td class="text-slate-300">${log.keterangan}</td>
    `;
    auditTable.appendChild(tr);
  });
}

function handleUploadLogo(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');
    cfg.logoBase64 = base64;
    localStorage.setItem('db_settings', JSON.stringify(cfg));

    applyCompanySettingsUI();
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'UPLOAD_LOGO', 'Mengunggah logo resmi perusahaan');
    showToast('Logo perusahaan berhasil diperbarui dan diterapkan ke seluruh dokumen!', 'success');
  };
  reader.readAsDataURL(file);
}

function handleUploadBgLogin(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');
    cfg.loginBgBase64 = base64;
    localStorage.setItem('db_settings', JSON.stringify(cfg));

    applyCompanySettingsUI();
    addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'UPLOAD_LOGIN_BG', 'Mengubah wallpaper background halaman login');
    showToast('Foto background halaman login berhasil diperbarui!', 'success');
  };
  reader.readAsDataURL(file);
}

function saveSettingsForm() {
  const cfg = JSON.parse(localStorage.getItem('db_settings') || '{}');

  cfg.namaPerusahaan = document.getElementById('setPerusahaan').value.trim();
  cfg.bidangUsaha = document.getElementById('setBidangUsaha').value.trim();
  cfg.alamatKantor = document.getElementById('setAlamatKantor').value.trim();
  cfg.telpPerusahaan = document.getElementById('setTelp').value.trim();
  cfg.emailPerusahaan = document.getElementById('setEmail').value.trim();
  cfg.lokasiTps = document.getElementById('setLokasi').value.trim();
  cfg.luasTps = document.getElementById('setLuas').value.trim();
  cfg.kapasitasMaksTon = document.getElementById('setKapasitas').value.trim();
  cfg.pjTeknis = document.getElementById('setPJ').value.trim();

  localStorage.setItem('db_settings', JSON.stringify(cfg));
  applyCompanySettingsUI();

  addAuditLog(STATE.currentUser ? STATE.currentUser.nama : 'Admin', 'UPDATE_SETTINGS', 'Menyimpan konfigurasi identitas perusahaan');
  showToast('Identitas dan profil perusahaan berhasil disimpan!', 'success');
}

function saveGasUrlConfig() {
  const url = document.getElementById('inputGasUrl').value.trim();
  STATE.gasApiUrl = url;
  localStorage.setItem('enviromine_gas_url', url);
  updateGasStatusBadge();
  showToast('URL Google Apps Script disimpan.', 'success');
}

function resetToLocalEngine() {
  STATE.gasApiUrl = '';
  localStorage.removeItem('enviromine_gas_url');
  document.getElementById('inputGasUrl').value = '';
  updateGasStatusBadge();
  showToast('Kembali ke Local Engine.', 'info');
}

// ==========================================================================
// 5. HELPER & UI UTILITIES
// ==========================================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    lucide.createIcons();
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let bgClass = 'bg-slate-900 border-slate-700 text-white';
  let iconName = 'info';

  if (type === 'success') {
    bgClass = 'bg-slate-900 border-emerald-500/50 text-emerald-300';
    iconName = 'check-circle';
  } else if (type === 'warning') {
    bgClass = 'bg-slate-900 border-amber-500/50 text-amber-300';
    iconName = 'alert-triangle';
  } else if (type === 'error') {
    bgClass = 'bg-slate-900 border-rose-500/50 text-rose-300';
    iconName = 'x-circle';
  }

  toast.className = `p-3.5 px-4 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-medium pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function addAuditLog(user, aksi, keterangan) {
  const logs = JSON.parse(localStorage.getItem('db_audit') || '[]');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  logs.push({
    id: 'LOG-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14),
    user: user || 'System',
    aksi: aksi,
    timestamp: now,
    keterangan: keterangan
  });
  localStorage.setItem('db_audit', JSON.stringify(logs));
}

function updateGasStatusBadge() {
  const badgeText = document.getElementById('backendStatusText');
  if (!badgeText) return;

  if (STATE.gasApiUrl) {
    badgeText.textContent = 'GAS API: Terhubung';
    badgeText.parentElement.className = 'cursor-pointer text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center gap-1.5';
  } else {
    badgeText.textContent = 'Mode: Local Engine';
    badgeText.parentElement.className = 'cursor-pointer text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-sky-400 flex items-center gap-1.5 hover:border-sky-400';
  }
}

function openGasSettingsModal() {
  document.getElementById('modalGasUrlInput').value = STATE.gasApiUrl;
  openModal('modalGasConfig');
}

function saveModalGasUrl() {
  const val = document.getElementById('modalGasUrlInput').value.trim();
  STATE.gasApiUrl = val;
  localStorage.setItem('enviromine_gas_url', val);
  updateGasStatusBadge();
  closeModal('modalGasConfig');
  showToast('Konfigurasi Google Apps Script diperbarui.', 'success');
}

function toggleNotificationPopover() {
  const popover = document.getElementById('notifPopover');
  popover.classList.toggle('hidden');
}

function setupGlobalShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const search = document.getElementById('globalSearchInput');
      if (search) search.focus();
    }
  });
}

function handleGlobalSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (e.key === 'Enter' && query) {
    navigateTo('logbook');
  }
}
