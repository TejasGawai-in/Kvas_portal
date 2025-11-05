// app.js (module) - main application logic

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get, child } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// --- CHART VARIABLES ---
let genderChart, ageChart, patientTrendChart;
let currentPatientsData = [];
let currentHistoryData = null;

// Firebase config (kept as in original file)
const firebaseConfig = {
  apiKey: "AIzaSyDt4TS5DpJQjLwRgiHSWBkbSkX5tQjskXK0",
  authDomain: "doctor-assistant-6934b.firebaseapp.com",
  databaseURL: "https://doctor-assistant-6934b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "doctor-assistant-6934b",
  storageBucket: "doctor-assistant-6934b.firebasestorage.app",
  messagingSenderId: "82637889324",
  appId: "1:82637889324:web:2bda4d7e17e821d68a5689"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Simple alert helper
function showAlert(message, type = 'success') {
  const icon = type === 'success' ? 'check-circle' : (type === 'warning' ? 'exclamation-triangle' : (type === 'danger' ? 'exclamation-triangle' : 'info-circle'));
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.style.position = 'fixed';
  el.style.right = '20px';
  el.style.top = '20px';
  el.style.zIndex = 9999;
  el.style.padding = '12px 16px';
  el.style.borderRadius = '10px';
  el.style.background = '#fff';
  el.style.color = '#222';
  el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
  el.innerHTML = `<i class="fas fa-${icon}" style="margin-right:8px;color:#333;"></i><span>${message}</span>`;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), 3000);
}

// Voice assistant helpers
function speakText(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Speech Synthesis not supported in this browser.');
  }
}
function notifyNewRegistration(name, token) {
  const message = `New patient registered. Name: ${name}. Token number: ${token}.`;
  speakText(message);
}
function notifyDisplayPatient(name, token) {
  const message = `Displaying patient ${name}, token number ${token}.`;
  speakText(message);
}

// --- Export helpers ---
function convertToCSV(data) {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(header => {
      let cell = row[header] === null || row[header] === undefined ? '' : row[header];
      cell = String(cell).replace(/"/g, '""');
      if (String(cell).includes(',')) cell = `"${cell}"`;
      return cell;
    });
    csvRows.push(values.join(','));
  }
  return csvRows.join('\n');
}
function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    navigator.msSaveBlob(blob, filename);
  }
}

// --- Chart helpers ---
function getChartOptions() {
  const isDarkMode = document.body.classList.contains('dark-mode');
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const labelColor = isDarkMode ? '#e2e8f0' : '#0f172a';
  return {
    plugins: {
      legend: { labels: { color: labelColor, font: { family: 'Inter' } } }
    },
    scales: {
      y: { ticks: { color: labelColor, font: { family: 'Inter' } }, grid: { color: gridColor }, beginAtZero: true },
      x: { ticks: { color: labelColor, font: { family: 'Inter' } }, grid: { color: gridColor } }
    }
  };
}

function updateGenderChart(patients = []) {
  if (genderChart) genderChart.destroy();
  const counts = { Male: 0, Female: 0, Other: 0 };
  patients.forEach(p => {
    const g = (p.gender || 'Other');
    if (counts.hasOwnProperty(g)) counts[g]++;
    else counts.Other++;
  });
  genderChart = new Chart(document.getElementById('genderChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Male','Female','Other'],
      datasets: [{
        label: 'Gender',
        data: [counts.Male, counts.Female, counts.Other],
        backgroundColor: ['#3b82f6','#ec4899','#64748b'],
        borderColor: document.body.classList.contains('dark-mode') ? '#1e293b' : '#ffffff',
        borderWidth: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#0f172a' } },
        title: { display: true, text: 'Gender Distribution', color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#0f172a', font: { family: 'Inter', size: 16 } }
      }
    }
  });
}

function updateAgeChart(patients = []) {
  if (ageChart) ageChart.destroy();
  const buckets = { '0-18':0, '19-30':0, '31-45':0, '46-60':0, '60+':0 };
  patients.forEach(p => {
    const age = Number(p.age) || 0;
    if (age <= 18) buckets['0-18']++;
    else if (age <= 30) buckets['19-30']++;
    else if (age <= 45) buckets['31-45']++;
    else if (age <= 60) buckets['46-60']++;
    else buckets['60+']++;
  });
  ageChart = new Chart(document.getElementById('ageChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{ label: 'Number of Patients', data: Object.values(buckets), backgroundColor: '#10b981', borderRadius: 4 }]
    },
    options: { responsive: true, ...getChartOptions(), plugins: { legend: { display: false }, title: { display: true, text: 'Age Distribution', color: document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#0f172a', font: { family: 'Inter', size: 16 } } } }
  });
}

function getPastNDates(N = 7) {
  const dates = [];
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function updatePatientTrendChart(patients = [], history = {}) {
  if (patientTrendChart) patientTrendChart.destroy();
  const last7Days = getPastNDates(7);
  const trendData = {};
  last7Days.forEach(date => trendData[date] = 0);

  if (history) {
    Object.keys(history).forEach(dateKey => {
      if (trendData.hasOwnProperty(dateKey)) {
        trendData[dateKey] = Object.keys(history[dateKey] || {}).length;
      }
    });
  }

  // use live patients count for today
  const todayStr = last7Days[last7Days.length - 1];
  const todayPatients = patients.filter(p => (p.createdAt || '').startsWith(todayStr));
  trendData[todayStr] = todayPatients.length;

  patientTrendChart = new Chart(document.getElementById('patientTrendChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: last7Days.map(d => d.slice(5)),
      datasets: [{ label: 'New Patients', data: Object.values(trendData), fill: true, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.2 }]
    },
    options: { responsive: true, ...getChartOptions() }
  });
}

// DOM refs
const DOM = {
  sidebar: document.getElementById('sidebar'),
  main: document.getElementById('main'),
  toggleBtn: document.getElementById('toggleBtn'),
  mobileToggle: document.getElementById('mobileToggle'),
  menuItems: document.querySelectorAll('.menu-item'),
  pageTitle: document.getElementById('pageTitle'),
  addPatientModal: document.getElementById('addPatientModal'),
  addPatientBtn: document.getElementById('addPatientBtn'),
  resetBtn: document.getElementById('resetBtn'),
  emergencyBtn: document.getElementById('emergencyBtn'),
  closeAddPatient: document.getElementById('closeAddPatient'),
  registerBtn: document.getElementById('registerBtn'),
  nameInput: document.getElementById('name'),
  ageInput: document.getElementById('age'),
  genderInput: document.getElementById('gender'),
  whatsappInput: document.getElementById('whatsapp'),
  addressInput: document.getElementById('address'),
  patientsTable: document.getElementById('patientsTable'),
  totalPatients: document.getElementById('totalPatients'),
  todayPatients: document.getElementById('todayPatients'),
  manualLCD: document.getElementById('manualLCD'),
  lcdPreview: document.getElementById('lcdPreview'),
  sendLCD: document.getElementById('sendLCD'),
  notifBadge: document.getElementById('notifBadge'),
  modalTitle: document.getElementById('modalTitle'),
  connectEspBtn: document.getElementById('connectEspBtn'),
  historyArea: document.getElementById('historyArea'),
  lcdOnBtn: document.getElementById('lcdOnBtn'),
  lcdOffBtn: document.getElementById('lcdOffBtn'),
  exportPatientsBtn: document.getElementById('exportPatientsBtn'),
  exportHistoryBtn: document.getElementById('exportHistoryBtn'),
  lcdBrightnessSlider: document.getElementById('lcdBrightnessSlider'),
  brightnessValue: document.getElementById('brightnessValue'),
  darkModeToggle: document.getElementById('darkModeToggle'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn')
};

// helpers
function generateUniquePatientId(){ return `P${Math.floor(100000 + Math.random() * 900000)}`; }

function patientsSnapshotToArray(snapshotVal) {
  if (!snapshotVal) return [];
  return Object.keys(snapshotVal).map(key => {
    const obj = snapshotVal[key] || {};
    const token = (obj.token !== undefined && obj.token !== null) ? obj.token : key;
    return { key, token, ...obj };
  });
}

function renderUIFromPatients(snapshotVal) {
  const patients = patientsSnapshotToArray(snapshotVal);
  patients.sort((a,b) => (Number(a.token)||0) - (Number(b.token)||0));
  if (!DOM.patientsTable) return;
  if (patients.length === 0) {
    DOM.patientsTable.innerHTML = `<tr><td colspan="8" align="center" style="padding:20px;">No active patients</td></tr>`;
  } else {
    DOM.patientsTable.innerHTML = patients.map(p => {
      const safeName = (p.name||'').replace(/'/g,"\\'");
      const addressShort = p.address ? (p.address.length>30 ? p.address.substring(0,30)+'...' : p.address) : 'N/A';
      return `<tr>
        <td>${p.token || 'N/A'}</td>
        <td>${p.key || 'N/A'}</td>
        <td>${p.name || 'N/A'}</td>
        <td>${p.age || 'N/A'}</td>
        <td>${p.gender || 'N/A'}</td>
        <td>${p.whatsapp || 'N/A'}</td>
        <td>${addressShort}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="window.editPatient('${p.token}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="window.deletePatient('${p.token}','${safeName}')">Del</button>
          <button class="btn btn-sm btn-secondary" onclick="window.displayPatient('${p.token}')">Display</button>
        </td>
      </tr>`;
    }).join('');
  }

  DOM.totalPatients.textContent = patients.length;

  const todayStr = new Date().toISOString().split('T')[0];
  DOM.todayPatients.textContent = patients.filter(p => (p.createdAt || '').startsWith(todayStr)).length;
}

function renderHistorySnapshot(snapshotVal) {
  const container = document.getElementById('historyArea');
  container.innerHTML = '';
  if (!snapshotVal) { container.innerHTML = '<p>No history records found.</p>'; return; }
  const dates = Object.keys(snapshotVal).sort().reverse();
  dates.forEach(date => {
    const records = snapshotVal[date] || {};
    const rows = Object.keys(records).map(k => {
      const r = records[k] || {};
      const safeName = (r.name||'').replace(/'/g,"\\'");
      return `<tr>
        <td>${r.token || k}</td>
        <td>${r.id || 'N/A'}</td>
        <td>${r.name || 'N/A'}</td>
        <td>${r.age || 'N/A'}</td>
        <td>${r.gender || 'N/A'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="window.deleteHistoryRecord('${date}','${k}','${safeName}')">Delete</button></td>
      </tr>`;
    }).join('');
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4 class="card-title">Date: ${date}</h4>
      <div class="table-container"><table class="table"><thead><tr><th>Token</th><th>ID</th><th>Name</th><th>Age</th><th>Gender</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    container.appendChild(card);
  });
}

// Firebase refs
const patientsRef = ref(db, 'patients');
const historyRef = ref(db, 'history');
const currentDisplayRef = ref(db, 'currentDisplay');
let editingToken = null;

// Realtime listeners
onValue(patientsRef, (snap) => {
  const snapshotVal = snap.exists() ? snap.val() : null;
  currentPatientsData = patientsSnapshotToArray(snapshotVal);
  renderUIFromPatients(snapshotVal);
  updateGenderChart(currentPatientsData);
  updateAgeChart(currentPatientsData);
  updatePatientTrendChart(currentPatientsData, currentHistoryData);
});

onValue(historyRef, (snap) => {
  const snapshotVal = snap.exists() ? snap.val() : null;
  currentHistoryData = snapshotVal;
  renderHistorySnapshot(snapshotVal);
  updatePatientTrendChart(currentPatientsData, currentHistoryData);
});

onValue(currentDisplayRef, (snap) => {
  const v = snap.exists() ? snap.val() : null;
  document.getElementById('lcdPreview').textContent = v?.text || 'Waiting for input...';
});

// Window-exposed functions (so onclick="" in HTML can call)
window.editPatient = async (token) => {
  try {
    const snap = await get(child(ref(db), `patients/${token}`));
    if (!snap.exists()) return showAlert('Patient not found', 'warning');
    const data = snap.val();
    editingToken = token;
    DOM.nameInput.value = data.name || '';
    DOM.ageInput.value = data.age || '';
    DOM.genderInput.value = data.gender || 'Male';
    DOM.whatsappInput.value = data.whatsapp || '';
    DOM.addressInput.value = data.address || '';
    DOM.modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Patient';
    DOM.registerBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    DOM.addPatientModal.style.display = 'flex';
  } catch (err) {
    showAlert('Error fetching patient: ' + err.message, 'danger');
  }
};

window.deletePatient = async (token, name) => {
  if (!confirm(`Delete patient ${name}?`)) return;
  try {
    await remove(ref(db, `patients/${token}`));
    showAlert('Patient deleted', 'success');
  } catch (err) {
    showAlert('Delete error: ' + err.message, 'danger');
  }
};

window.displayPatient = async (token) => {
  try {
    const snap = await get(child(ref(db), `patients/${token}`));
    if (!snap.exists()) return showAlert('Patient not found', 'warning');
    const p = snap.val();
    const displayText = `Token: ${p.token || token} | ${p.name || ''}`;
    await set(currentDisplayRef, { text: displayText, token: p.token || token, ts: Date.now() });
    notifyDisplayPatient(p.name || 'Unknown', p.token || token);
    showAlert('Displayed on LCD', 'success');
  } catch (err) {
    showAlert('LCD error: ' + err.message, 'danger');
  }
};

window.deleteHistoryRecord = async (date, tokenKey, name) => {
  if (!confirm(`Delete ${name} from history (${date})?`)) return;
  try {
    await remove(ref(db, `history/${date}/${tokenKey}`));
    showAlert('History record deleted', 'success');
  } catch (err) {
    showAlert('Delete error: ' + err.message, 'danger');
  }
};

// Register / update patient
DOM.registerBtn.onclick = async () => {
  const name = DOM.nameInput.value.trim();
  const age = DOM.ageInput.value.trim();
  if (!name || !age) return showAlert('Please fill Name and Age.', 'warning');

  DOM.registerBtn.disabled = true;
  DOM.registerBtn.innerHTML = '<span class="loading"></span>';

  try {
    if (editingToken) {
      const updated = { name, age: Number(age), gender: DOM.genderInput.value, whatsapp: DOM.whatsappInput.value.trim(), address: DOM.addressInput.value.trim() };
      await update(ref(db, `patients/${editingToken}`), updated);
      showAlert('Patient updated successfully!', 'success');
    } else {
      const snap = await get(patientsRef);
      const all = snap.exists() ? snap.val() : null;
      let maxToken = 0;
      if (all) {
        Object.keys(all).forEach(k => {
          const t = Number(all[k]?.token ?? k);
          if (!isNaN(t) && t > maxToken) maxToken = t;
        });
      }
      const nextToken = maxToken + 1;
      const tokenKey = nextToken.toString();
      const newPatient = { id: generateUniquePatientId(), token: nextToken, name, age: Number(age), gender: DOM.genderInput.value, whatsapp: DOM.whatsappInput.value.trim(), address: DOM.addressInput.value.trim(), createdAt: new Date().toISOString() };
      await set(ref(db, `patients/${tokenKey}`), newPatient);
      notifyNewRegistration(newPatient.name, newPatient.token);
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('tokenData', JSON.stringify({ token: nextToken, date: today }));
      showAlert('Patient registered successfully!', 'success');
    }
    editingToken = null;
    DOM.addPatientModal.style.display = 'none';
    DOM.registerBtn.disabled = false;
    DOM.registerBtn.innerHTML = '<i class="fas fa-plus"></i> Register';
    DOM.modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> Register Patient';
    // Clear fields
    DOM.nameInput.value = ''; DOM.ageInput.value = ''; DOM.genderInput.value = 'Male'; DOM.whatsappInput.value = ''; DOM.addressInput.value = '';
  } catch (err) {
    showAlert('Error: ' + err.message, 'danger');
    DOM.registerBtn.disabled = false;
    DOM.registerBtn.innerHTML = editingToken ? '<i class="fas fa-save"></i> Save Changes' : '<i class="fas fa-plus"></i> Register';
  }
};

// Reset (move current patients to history and clear)
DOM.resetBtn.onclick = async () => {
  const snap = await get(patientsRef);
  if (!snap.exists()) return showAlert('No patients to reset', 'warning');
  if (!confirm('Move all current patients to history and reset token? This cannot be undone.')) return;
  try {
    const patientsObj = snap.val();
    const today = new Date().toISOString().split('T')[0];
    const updates = {};
    Object.keys(patientsObj).forEach(tokenKey => {
      const record = patientsObj[tokenKey];
      updates[`history/${today}/${tokenKey}`] = { ...record, movedAt: new Date().toISOString() };
      updates[`patients/${tokenKey}`] = null; // delete node
    });
    await update(ref(db), updates);
    showAlert('Patients moved to history and cleared', 'success');
  } catch (err) {
    showAlert('Reset error: ' + err.message, 'danger');
  }
};

// LCD controls
DOM.sendLCD.onclick = async () => {
  const text = DOM.manualLCD.value.trim();
  if (!text) return showAlert('Please enter text for the LCD', 'warning');
  try {
    await set(currentDisplayRef, { text, ts: Date.now() });
    showAlert('Sent to LCD', 'success');
  } catch (err) {
    showAlert('LCD update error: ' + err.message, 'danger');
  }
};
DOM.lcdOnBtn.onclick = async () => {
  const onText = "Turning On... Welcome to Kvas Hospital";
  try {
    await set(currentDisplayRef, { text: onText, ts: Date.now() });
    speakText('LCD is turning on.');
    showAlert('LCD turned on with welcome message.', 'success');
  } catch (err) { showAlert('LCD On Error: ' + err.message, 'danger'); }
};
DOM.lcdOffBtn.onclick = async () => {
  const offText = "Turning Off...";
  try {
    await set(currentDisplayRef, { text: offText, ts: Date.now() });
    speakText('LCD is turning off.');
    showAlert('LCD turned off.', 'success');
  } catch (err) { showAlert('LCD Off Error: ' + err.message, 'danger'); }
};
DOM.connectEspBtn.onclick = () => { showAlert('ESP32 connection simulated. Use Firebase listener on device to fetch currentDisplay.'); };

// Delete history record function already declared via window.deleteHistoryRecord

// Emergency button
DOM.emergencyBtn.onclick = async () => {
  const emergencyText = "!!! EMERGENCY !!!";
  try {
    await set(currentDisplayRef, { text: emergencyText, token: 'EMERGENCY', ts: Date.now() });
    DOM.lcdPreview.textContent = emergencyText;
    speakText("Emergency mode activated. Displaying emergency alert.");
    showAlert('Emergency alert sent to LCD!', 'danger');
  } catch (err) {
    showAlert('Emergency LCD error: ' + err.message, 'danger');
  }
};

// Settings: export and brightness
DOM.exportPatientsBtn.onclick = async () => {
  try {
    const snap = await get(patientsRef);
    if (!snap.exists()) return showAlert('No active patients to export', 'warning');
    const patients = patientsSnapshotToArray(snap.val());
    if (patients.length === 0) return showAlert('No active patients to export', 'warning');
    const csvData = convertToCSV(patients);
    downloadCSV(csvData, `kvas_active_patients_${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) { showAlert('Export Error: ' + err.message, 'danger'); }
};

DOM.exportHistoryBtn.onclick = async () => {
  try {
    const snap = await get(historyRef);
    if (!snap.exists()) return showAlert('No history records to export', 'warning');
    const historyData = snap.val();
    const allRecords = [];
    Object.keys(historyData).forEach(date => {
      const dateRecords = historyData[date];
      Object.keys(dateRecords).forEach(tokenKey => {
        allRecords.push({ archived_date: date, ...dateRecords[tokenKey] });
      });
    });
    if (allRecords.length === 0) return showAlert('No history records to export', 'warning');
    const csvData = convertToCSV(allRecords);
    downloadCSV(csvData, `kvas_full_history_${new Date().toISOString().split('T')[0]}.csv`);
  } catch (err) { showAlert('Export Error: ' + err.message, 'danger'); }
};

// Brightness slider
DOM.lcdBrightnessSlider.oninput = (e) => { DOM.brightnessValue.textContent = e.target.value; };
DOM.lcdBrightnessSlider.onchange = async (e) => {
  const brightness = e.target.value;
  try {
    const lcdControlRef = ref(db, 'lcdControl/brightness');
    await set(lcdControlRef, Number(brightness));
    showAlert(`LCD Brightness command sent: ${brightness}%`, 'success');
  } catch (err) { showAlert('Brightness Error: ' + err.message, 'danger'); }
};

// Dark mode toggle
DOM.darkModeToggle.onchange = () => {
  if (DOM.darkModeToggle.checked) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'enabled');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'disabled');
  }
  updateGenderChart(currentPatientsData);
  updateAgeChart(currentPatientsData);
  updatePatientTrendChart(currentPatientsData, currentHistoryData);
};

// Clear history
DOM.clearHistoryBtn.onclick = async () => {
  if (!confirm('!!! WARNING !!!\n\nAre you sure you want to delete ALL patient history? This action is permanent and cannot be undone.')) return;
  if (!confirm('FINAL CONFIRMATION:\n\nThis will erase all records from the history tab. Proceed?')) return;
  try {
    await remove(historyRef);
    showAlert('All patient history has been permanently deleted.', 'success');
  } catch (err) { showAlert('Delete Error: ' + err.message, 'danger'); }
};

// UI interactions
const openModal = (modal) => { modal.style.display = 'flex'; };
const closeModal = (modal) => {
  modal.style.display = 'none';
  if (modal === DOM.addPatientModal) {
    DOM.nameInput.value=''; DOM.ageInput.value=''; DOM.genderInput.value='Male'; DOM.whatsappInput.value=''; DOM.addressInput.value='';
    DOM.registerBtn.innerHTML = '<i class="fas fa-plus"></i> Register';
    DOM.modalTitle.innerHTML = '<i class="fas fa-user-plus"></i> Register Patient';
    editingToken = null;
  }
};

DOM.addPatientBtn.onclick = () => openModal(DOM.addPatientModal);
DOM.closeAddPatient.onclick = () => closeModal(DOM.addPatientModal);
DOM.addPatientModal.onclick = (e) => { if (e.target === DOM.addPatientModal) closeModal(DOM.addPatientModal); };

DOM.toggleBtn.onclick = () => { DOM.sidebar.classList.toggle('collapsed'); DOM.main.classList.toggle('expanded'); };
DOM.mobileToggle.onclick = () => DOM.sidebar.classList.toggle('mobile-open');
DOM.menuItems.forEach(item => item.addEventListener('click', () => {
  DOM.menuItems.forEach(i => i.classList.remove('active'));
  item.classList.add('active');
  const section = item.getAttribute('data-section');
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(section);
  if (el) el.classList.remove('hidden');
  DOM.pageTitle.textContent = item.textContent.trim();
  // update hash
  history.replaceState(null, '', `#${section}`);
}));

// Initial state on load
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    DOM.darkModeToggle.checked = true;
  }
  // Activate section from hash
  const activeSection = window.location.hash ? window.location.hash.substring(1) : 'dashboard';
  const activeMenuItem = document.querySelector(`.menu-item[data-section="${activeSection}"]`) || document.querySelector(`.menu-item[data-section="dashboard"]`);
  if (activeMenuItem) activeMenuItem.click();
  DOM.addPatientModal.style.display = 'none';
  get(currentDisplayRef).then(snap => { if (snap.exists()) DOM.lcdPreview.textContent = snap.val().text || 'Waiting for input...'; }).catch(()=>{});
  // Initial charts
  updateGenderChart([]);
  updateAgeChart([]);
  updatePatientTrendChart([], {});
});