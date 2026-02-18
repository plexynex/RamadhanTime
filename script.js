// Konfigurasi
const API_BASE = "https://equran.id/api/v2";
const CURRENT_YEAR = 2026;
const savedTheme = localStorage.getItem("theme");
const savedProvince = localStorage.getItem("provinsi");
const savedCity = localStorage.getItem("kota");

// Elemen DOM
const darkModeToggle = document.getElementById("darkModeToggle");
const locationButton = document.getElementById("locationButton");
const provinsiSelect = document.getElementById("provinsiSelect");
const kotaSelect = document.getElementById("kotaSelect");
const tableBody = document.getElementById("tableBody");
const currentTimeElement = document.getElementById("currentTime");
const currentDateElement = document.getElementById("currentDate");
const resetButton = document.getElementById('resetButton');
const yearDisplay = document.getElementById("yearDisplay");

// State
let provinces = [];
let cities = [];
let currentSchedule = [];
let notificationPermission = Notification.permission;

// Inisialisasi Tema
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

// Tampilkan tahun berjalan
if (yearDisplay) {
  yearDisplay.textContent = CURRENT_YEAR;
}

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

// Fungsi Fetch Data
async function fetchProvinces() {
  try {
    const response = await fetch(`${API_BASE}/imsakiyah/provinsi`);
    if (!response.ok) throw new Error('Network response was not ok');
    const result = await response.json();
    
    if (result.code === 200 && result.data) {
      provinces = result.data;
      populateSelect(provinsiSelect, provinces);
      provinsiSelect.disabled = false;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error fetching provinces:', error);
    showError("Gagal memuat data provinsi");
  }
}

async function fetchCities() {
  const provinsi = provinsiSelect.value;
  if (!provinsi) return;

  showLoading();
  try {
    const response = await fetch(`${API_BASE}/imsakiyah/kabkota`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provinsi }),
    });
    
    if (!response.ok) throw new Error('Network response was not ok');
    const result = await response.json();
    
    if (result.code === 200 && result.data) {
      cities = result.data;
      populateSelect(kotaSelect, cities);
      kotaSelect.disabled = false;
      localStorage.setItem("provinsi", provinsi);
    } else {
      throw new Error('Invalid response format');
    }
    hideLoading();
  } catch (error) {
    console.error('Error fetching cities:', error);
    showError("Gagal memuat data kota");
    hideLoading();
  }
}

async function fetchSchedule() {
  const provinsi = provinsiSelect.value;
  const kabkota = kotaSelect.value;
  if (!provinsi || !kabkota) return;

  showLoading();
  try {
    const response = await fetch(`${API_BASE}/imsakiyah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provinsi, kabkota }),
    });
    
    if (!response.ok) throw new Error('Network response was not ok');
    const result = await response.json();
    
    if (result.code === 200 && result.data && result.data.imsakiyah) {
      currentSchedule = result.data.imsakiyah;
      renderSchedule();
      localStorage.setItem("kota", kabkota);
      setupNotifications();
    } else {
      throw new Error('Invalid response format');
    }
    hideLoading();
  } catch (error) {
    console.error('Error fetching schedule:', error);
    showError("Gagal memuat jadwal");
    hideLoading();
  }
}

// Fungsi Render
function renderSchedule() {
  tableBody.innerHTML = currentSchedule
    .map(
      (day) => `
        <tr>
          <td>${day.tanggal}</td>
          <td>${getDayName(day.tanggal)}</td>
          <td>${day.imsak || '-'}</td>
          <td>${day.subuh || '-'}</td>
          <td>${day.dzuhur || '-'}</td>
          <td>${day.ashar || '-'}</td>
          <td>${day.maghrib || '-'}</td>
          <td>${day.isya || '-'}</td>
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

// Fungsi Reset
function resetData() {
  // Konfirmasi reset
  const isConfirmed = confirm('Apakah Anda yakin ingin mereset semua data dan izin?');
  if (!isConfirmed) {
    return;
  }
  
  // Menghapus data yang disimpan di localStorage
  localStorage.removeItem('theme');
  localStorage.removeItem('provinsi');
  localStorage.removeItem('kota');
  
  // Reset izin notifikasi
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
    handleGeolocationError(error);
  }
  hideLoading();
}

function handleGeolocationError(error) {
  if (error.code === error.PERMISSION_DENIED) {
    showError("Pengguna menolak untuk memberikan izin lokasi");
  } else if (error.code === error.POSITION_UNAVAILABLE) {
    showError("Posisi tidak dapat ditemukan");
  } else if (error.code === error.TIMEOUT) {
    showError("Waktu permintaan lokasi habis");
  } else {
    showError("Gagal mendapatkan lokasi");
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`
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

  // Cari provinsi yang cocok (case insensitive)
  const matchedProvince = provinces.find((p) =>
    p.toLowerCase().includes(province.toLowerCase())
  );

  if (matchedProvince) {
    provinsiSelect.value = matchedProvince;
    await fetchCities();

    const city = location.city || location.town || location.county;
    if (!city) {
      showError("Kota tidak ditemukan");
      return;
    }

    // Cari kota yang cocok (case insensitive)
    const matchedCity = cities.find((c) =>
      c.toLowerCase().includes(city.toLowerCase())
    );

    if (matchedCity) {
      kotaSelect.value = matchedCity;
      await fetchSchedule();
    } else {
      showError("Kota tidak ditemukan di provinsi yang dipilih");
    }
  } else {
    showError("Provinsi tidak ditemukan");
  }
}

function setupNotifications() {
  if (!("Notification" in window)) return;
  
  if (notificationPermission !== "granted") {
    alert('Silakan aktifkan notifikasi untuk menerima pengingat waktu sholat.');
    Notification.requestPermission().then((permission) => {
      notificationPermission = permission;
    });
  }

  // Jadwalkan notifikasi untuk setiap hari
  currentSchedule.forEach((day) => {
    const prayerTimes = {
      imsak: day.imsak,
      subuh: day.subuh,
      dzuhur: day.dzuhur,
      ashar: day.ashar,
      maghrib: day.maghrib,
      isya: day.isya
    };

    Object.entries(prayerTimes).forEach(([prayer, time]) => {
      if (time && time !== '-') {
        scheduleNotification(day.tanggal, time, prayer);
      }
    });
  });
}

function scheduleNotification(day, time, prayerName) {
  const now = new Date();
  
  // Buat objek Date untuk waktu sholat
  const prayerDate = new Date(CURRENT_YEAR, 2, day, ...time.split(':'));
  
  // Hitung selisih waktu
  const diff = prayerDate - now;

  if (diff > 0) {
    setTimeout(() => {
      if (notificationPermission === "granted") {
        const prayerNames = {
          imsak: "Imsak",
          subuh: "Subuh",
          dzuhur: "Dzuhur",
          ashar: "Ashar",
          maghrib: "Maghrib",
          isya: "Isya"
        };
        
        new Notification(`Waktu ${prayerNames[prayerName] || prayerName} telah tiba`, {
          body: `Selamat menunaikan ibadah ${prayerNames[prayerName] || prayerName}`,
          icon: '/favicon.ico'
        });
      }
    }, diff);
  }
}

function getDayName(day) {
  try {
    const date = new Date(CURRENT_YEAR, 2, day); // Bulan Maret (index 2)
    return date.toLocaleDateString("id-ID", { weekday: "long" });
  } catch (error) {
    console.error('Error getting day name:', error);
    return '-';
  }
}

function updateTime() {
  const now = new Date();
  if (currentTimeElement) {
    currentTimeElement.textContent = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}

function updateDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  if (currentDateElement) {
    currentDateElement.textContent = now.toLocaleDateString("id-ID", options);
  }
}

function showLoading() {
  const loadingEl = document.querySelector(".loading");
  if (loadingEl) loadingEl.style.display = "block";
}

function hideLoading() {
  const loadingEl = document.querySelector(".loading");
  if (loadingEl) loadingEl.style.display = "none";
}

function showError(message) {
  alert(message);
}

// Inisialisasi
init();
setInterval(updateTime, 1000);
setInterval(updateDate, 1000);
updateDate(); // Panggil sekali saat load
