// Konfigurasi
const API_BASE = "https://equran.id/api/v2";
const MONTH_YEAR = { year: 2025, month: 3 };
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
    const data = await response.json();
    provinces = data.data;
    populateSelect(provinsiSelect, provinces);
    provinsiSelect.disabled = false;
  } catch (error) {
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
    const data = await response.json();
    cities = data.data;
    populateSelect(kotaSelect, cities);
    kotaSelect.disabled = false;
    localStorage.setItem("provinsi", provinsi);
    hideLoading();
  } catch (error) {
    showError("Gagal memuat data kota");
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
    const data = await response.json();
    currentSchedule = data.data[0].imsakiyah;
    renderSchedule();
    localStorage.setItem("kota", kabkota);
    setupNotifications();
    hideLoading();
  } catch (error) {
    showError("Gagal memuat jadwal");
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

// Fungsi Reset
function resetData() {
    // Konfirmasi reset
  const isConfirmed = confirm('Apakah Anda yakin ingin mereset semua data dan izin?');
  if (!isConfirmed) {
    // Jika pengguna membatalkan, keluar dari fungsi
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
  hideLoading();
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

function setupNotifications() {
  if (!("Notification" in window)) return;
  if (notificationPermission !== "granted") {
    alert('Silakan aktifkan notifikasi untuk menerima pengingat waktu sholat.');
    Notification.requestPermission().then((permission) => {
      notificationPermission = permission;
    });
  }

  currentSchedule.forEach((day) => {
    Object.entries(day).forEach(([key, time]) => {
      if (key === "tanggal") return;
      const notificationTime = new Date(
        `${MONTH_YEAR.year}-${MONTH_YEAR.month}-${day.tanggal}T${time}:00`
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
        });
      }
    }, diff);
  }
}

// function scheduleNotification(time, prayerName) {
//     const now = new Date();
    
//     // Mengurangi 5 menit (300.000 ms) dari waktu yang ditentukan
//     const notificationTime = new Date(time.getTime() - 5 * 60 * 1000); // 5 menit sebelumnya
    
//     const diff = notificationTime - now;
  
//     if (diff > 0) {
//       setTimeout(() => {
//         if (notificationPermission === "granted") {
//           new Notification(`Waktu ${prayerName} akan segera tiba`, {
//             body: `Ingat, sholat ${prayerName} akan dimulai dalam 5 menit!`,
//           });
//         }
//       }, diff);
//     }
//   }
  

function getDayName(day) {
  const date = new Date(2025, 2, day);
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

// Fungsi untuk memperbarui tanggal
function updateDate() {
  const now = new Date();
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const formattedDate = now.toLocaleDateString("id-ID", options); // Format tanggal Indonesia
  document.getElementById("currentDate").textContent = formattedDate;
}

setInterval(updateDate, 1000); // Update setiap detik

function showLoading() {
  document.querySelector(".loading").style.display = "block";
}

function hideLoading() {
  document.querySelector(".loading").style.display = "none";
}

function showError(message) {
  alert(message);
}

// Inisialisasi
init();
setInterval(updateTime, 1000);



