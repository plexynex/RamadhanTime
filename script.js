// Konfigurasi - UPDATE ke 2026
const API_BASE = "https://equran.id/api/v2"; // Tetap menggunakan v2
const MONTH_YEAR = { year: 2026, month: 3 }; // UBAH ke tahun 2026

// Elemen DOM
const darkModeToggle = document.getElementById("darkModeToggle");
const locationButton = document.getElementById("locationButton");
const provinsiSelect = document.getElementById("provinsiSelect");
const kotaSelect = document.getElementById("kotaSelect");
const tableBody = document.getElementById("tableBody");
const currentTimeElement = document.getElementById("currentTime");
const currentDateElement = document.getElementById("currentDate");
const resetButton = document.getElementById('resetButton');

// State
let provinces = [];
let cities = [];
let currentSchedule = [];
let notificationPermission = Notification.permission;

// Inisialisasi Tema
const savedTheme = localStorage.getItem("theme");
const savedProvince = localStorage.getItem("provinsi");
const savedCity = localStorage.getItem("kota");

if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");
  darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

// Event Listeners
darkModeToggle.addEventListener("click", toggleDarkMode);
locationButton.addEventListener("click", getLocation);
provinsiSelect.addEventListener("change", fetchCities);
kotaSelect.addEventListener("change", fetchSchedule);
resetButton.addEventListener('click', resetData);

// Fungsi Utama
async function init() {
  showLoading();
  await fetchProvinces();
  if (savedProvince && savedCity) {
    provinsiSelect.value = savedProvince;
    await fetchCities();
    kotaSelect.value = savedCity;
    await fetchSchedule();
  }
  hideLoading();
}

// Fungsi Fetch Data - DIPERBARUI dengan struktur response v2
async function fetchProvinces() {
  try {
    // API v2 menggunakan wrapper response: { code, message, data }
    const response = await fetch(`${API_BASE}/imsakiyah/provinsi`);
    const result = await response.json();
    
    // Mengakses data dari wrapper
    provinces = result.data || [];
    populateSelect(provinsiSelect, provinces);
    provinsiSelect.disabled = false;
  } catch (error) {
    console.error("Error fetch provinces:", error);
    showError("Gagal memuat data provinsi");
  }
}

async function fetchCities() {
  const provinsi = provinsiSelect.value;
  if (!provinsi) return;

  showLoading();
  try {
    // POST request dengan wrapper response
    const response = await fetch(`${API_BASE}/imsakiyah/kabkota`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provinsi }),
    });
    const result = await response.json();
    
    cities = result.data || [];
    populateSelect(kotaSelect, cities);
    kotaSelect.disabled = false;
    localStorage.setItem("provinsi", provinsi);
    hideLoading();
  } catch (error) {
    console.error("Error fetch cities:", error);
    showError("Gagal memuat data kota");
  }
}

async function fetchSchedule() {
  const provinsi = provinsiSelect.value;
  const kabkota = kotaSelect.value;
  if (!provinsi || !kabkota) return;

  showLoading();
  try {
    // POST request dengan wrapper response
    const response = await fetch(`${API_BASE}/imsakiyah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provinsi, kabkota }),
    });
    const result = await response.json();
    
    // Asumsi struktur data: result.data[0].imsakiyah
    // Sesuaikan dengan struktur aktual response API
    const scheduleData = result.data || [];
    currentSchedule = scheduleData[0]?.imsakiyah || [];
    
    if (currentSchedule.length > 0) {
      renderSchedule();
      localStorage.setItem("kota", kabkota);
      setupNotifications();
    } else {
      showError("Data jadwal tidak ditemukan");
    }
    
    hideLoading();
  } catch (error) {
    console.error("Error fetch schedule:", error);
    showError("Gagal memuat jadwal");
  }
}

// Fungsi Render - DIPERBARUI dengan tanggal 2026
function renderSchedule() {
  tableBody.innerHTML = currentSchedule
    .map(
      (day) => `
        <tr>
          <td>${day.tanggal}</td>
          <td>${getDayName(day.tanggal)}</td>
          <td>${day.imsak}</td>
          <td>${day.subuh}</td>
          <td>${day.dzuhur}</td>
          <td>${day.ashar}</td>
          <td>${day.maghrib}</td>
          <td>${day.isya}</td>
        </tr>
      `
    )
    .join("");
}

// Fungsi Bantuan
function populateSelect(selectElement, data) {
  selectElement.innerHTML = data
    .map((item) => `<option value="${item}">${item}</option>`)
    .join("");
}

// Fungsi Reset - DIPERTAHANKAN
function resetData() {
  const isConfirmed = confirm('Apakah Anda yakin ingin mereset semua data dan izin?');
  if (!isConfirmed) {
    return;
  }
  
  localStorage.removeItem('theme');
  localStorage.removeItem('provinsi');
  localStorage.removeItem('kota');
  notificationPermission = Notification.permission = 'default';
  alert('Data telah direset dan izin notifikasi telah dihapus.');
  location.reload();
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
  darkModeToggle.innerHTML = document.body.classList.contains("dark-mode")
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';
}

// Fungsi Lokasi - DIPERTAHANKAN
async function getLocation() {
  if (!navigator.geolocation) {
    showError("Geolocation tidak didukung");
    return;
  }

  showLoading();
  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject)
    );
    const { latitude, longitude } = position.coords;
    const location = await reverseGeocode(latitude, longitude);
    await setLocation(location);
  } catch (error) {
    handleLocationError(error);
  }
  hideLoading();
}

function handleLocationError(error) {
  const messages = {
    [error.PERMISSION_DENIED]: "Izin lokasi ditolak",
    [error.POSITION_UNAVAILABLE]: "Posisi tidak dapat ditemukan",
    [error.TIMEOUT]: "Waktu permintaan lokasi habis"
  };
  showError(messages[error.code] || "Gagal mendapatkan lokasi");
}

async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    const data = await response.json();
    return data.address;
  } catch (error) {
    throw new Error("Gagal mendapatkan lokasi");
  }
}

async function setLocation(location) {
  const province = location.state || location.province;
  if (!province) {
    showError("Provinsi tidak ditemukan");
    return;
  }

  const matchedProvince = provinces.find((p) =>
    p.toLowerCase().includes(province.toLowerCase())
  );

  if (matchedProvince) {
    provinsiSelect.value = matchedProvince;
    await fetchCities();

    const city = location.city || location.town;
    if (!city) {
      showError("Kota tidak ditemukan");
      return;
    }

    const matchedCity = cities.find((c) =>
      c.toLowerCase().includes(city.toLowerCase())
    );

    if (matchedCity) {
      kotaSelect.value = matchedCity;
      await fetchSchedule();
    } else {
      showError("Kota tidak ditemukan");
    }
  } else {
    showError("Provinsi tidak ditemukan");
  }
}

// Fungsi Notifikasi - DIPERBARUI untuk 2026
function setupNotifications() {
  if (!("Notification" in window)) return;
  
  if (notificationPermission !== "granted") {
    Notification.requestPermission().then((permission) => {
      notificationPermission = permission;
    });
  }

  currentSchedule.forEach((day) => {
    Object.entries(day).forEach(([key, time]) => {
      if (key === "tanggal") return;
      
      // Format tanggal untuk 2026
      const notificationTime = new Date(
        `${MONTH_YEAR.year}-${String(MONTH_YEAR.month).padStart(2, '0')}-${String(day.tanggal).padStart(2, '0')}T${time}:00`
      );
      
      scheduleNotification(notificationTime, key);
    });
  });
}

function scheduleNotification(time, prayerName) {
  const now = new Date();
  const diff = time - now;

  if (diff > 0) {
    setTimeout(() => {
      if (notificationPermission === "granted") {
        new Notification(`Waktu ${prayerName} telah tiba`, {
          body: `Selamat menunaikan ibadah ${prayerName}`,
          icon: '/icon.png' // Optional: tambahkan icon
        });
      }
    }, diff);
  }
}

// Fungsi Tanggal dan Waktu - DIPERBAIKI
function getDayName(day) {
  // Format: tahun 2026, bulan Maret (2), tanggal
  const date = new Date(2026, 2, parseInt(day));
  return date.toLocaleDateString("id-ID", { weekday: "long" });
}

function updateTime() {
  const now = new Date();
  currentTimeElement.textContent = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function updateDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  currentDateElement.textContent = now.toLocaleDateString("id-ID", options);
}

// Utility Functions
function showLoading() {
  document.querySelector(".loading").style.display = "block";
}

function hideLoading() {
  document.querySelector(".loading").style.display = "none";
}

function showError(message) {
  alert(message);
  console.error(message);
}

// Inisialisasi
init();
setInterval(updateTime, 1000);
setInterval(updateDate, 1000); // Update tanggal setiap detik
