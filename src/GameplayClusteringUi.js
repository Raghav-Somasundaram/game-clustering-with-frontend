// ===================== Element References =====================
const uploadForm = document.getElementById('uploadForm');
const videoInput = document.getElementById('videoInput');
const dropZone = document.getElementById('dropZone');
const selectedFileName = document.getElementById('selectedFileName');
const dropZoneText = document.getElementById('dropZoneText');
const isLabeled = document.getElementById('isLabeled');
const gameName = document.getElementById('gameName');
const themeSwitch = document.getElementById('themeSwitch');

const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressText = document.getElementById('progressText');
const uploadBtn = document.querySelector('.primary-btn');
const btnLoader = document.querySelector('.btn-loader');
const btnContent = document.querySelector('.btn-content');

const resultContainer = document.getElementById('resultContainer');
const statsContainer = document.getElementById('statsContainer');
const visualizationContainer = document.getElementById('visualizationContainer');
const resultBox = document.getElementById('resultBox');
const statsBox = document.getElementById('statsBox');
const clusterImage = document.getElementById('clusterImage');

// ===================== Theme Switching =====================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
  document.body.classList.add('theme-transition');
  setTimeout(() => document.body.classList.remove('theme-transition'), 500);
}
function updateThemeIcon(theme) {
  const icon = themeSwitch.querySelector('i');
  icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// ===================== Drag & Drop and Browse =====================
function initDragDrop() {
  // Drag events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('highlight');
    }, false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('highlight');
    }, false);
  });
  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        videoInput.files = e.dataTransfer.files;
        selectedFileName.textContent = file.name;
        dropZoneText.textContent = "File selected:";
      } else {
        selectedFileName.textContent = "";
        dropZoneText.textContent = "Invalid file type!";
        showToast("Please drop a valid video file.", "error");
      }
    }
  });
  // Keyboard accessibility
  dropZone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && videoInput) {
      videoInput.click();
    }
  });
  // Browse button
  document.querySelector('.upload-btn-browse').addEventListener('click', function(e) {
    e.preventDefault();
    videoInput.click();
  });
  // File input change
  videoInput.addEventListener('change', function() {
    if (videoInput.files.length) {
      selectedFileName.textContent = videoInput.files[0].name;
      dropZoneText.textContent = "File selected:";
    } else {
      selectedFileName.textContent = "";
      dropZoneText.textContent = "Drag & drop your video file here";
    }
  });
}

// ===================== Upload Logic =====================
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = videoInput.files[0];
  if (!file) {
    showToast("Please select a video file.", "error");
    return;
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    showToast("File too large. Max 2GB.", "error");
    return;
  }

  const formData = new FormData();
  formData.append('video', file);
  formData.append('is_labeled', isLabeled.checked);
  formData.append('game_name', gameName.value.trim());

  resetUI();
  showLoading(true);
  simulateProgress();

  try {
    const response = await fetch("http://localhost:8000/upload/", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    showLoading(false);

    if (response.ok && data.success) {
      showResult(data);
      showToast("Analysis complete!", "success");
    } else {
      showError(data.error || data.message || "Failed to process the video.");
    }
  } catch (err) {
    showLoading(false);
    showError("Server error. Try again.");
  }
});

// ===================== Progress Animation =====================
function simulateProgress() {
  let progress = 0;
  progressBar.style.width = "0%";
  progressPercent.innerText = "0%";
  progressText.innerText = "Uploading...";
  const interval = setInterval(() => {
    if (progress >= 100) {
      clearInterval(interval);
      progressText.innerText = "Processing complete";
    } else {
      progress += 1;
      progressBar.style.width = progress + "%";
      progressPercent.innerText = progress + "%";
      if (progress < 30) progressText.innerText = "Uploading...";
      else if (progress < 70) progressText.innerText = "Analyzing frames...";
      else progressText.innerText = "Finalizing clusters...";
    }
  }, 30);
}

// ===================== Result Handling =====================
function showResult(data) {
  // Animate cards in sequence
  setTimeout(() => {
    resultContainer.classList.remove('hidden');
    animateCard(resultContainer);

    setTimeout(() => {
      statsContainer.classList.remove('hidden');
      animateCard(statsContainer);

      setTimeout(() => {
        visualizationContainer.classList.remove('hidden');
        animateCard(visualizationContainer);
      }, 300);
    }, 300);
  }, 500);

  // Result
  resultBox.innerHTML = `
    <div class="result-item">
      <i class="fas fa-gamepad"></i>
      <div>
        <h3>${data.game || "Unnamed Game"}</h3>
        <p>${data.duration || '-'} seconds of gameplay</p>
      </div>
    </div>
    <div class="result-item">
      <i class="fas fa-shapes"></i>
      <div>
        <h3>${data.clusters ? data.clusters.length : 0} Cluster(s) Detected</h3>
        <p>Pattern recognition powered by AI</p>
      </div>
    </div>
  `;

  // Stats
  if (data.clusters && data.clusters.length > 0) {
    statsBox.innerHTML = `
      <div class="stats-grid">
        ${data.clusters.map((c, i) => `
          <div class="stat-card">
            <div class="stat-header">
              <span class="cluster-badge">Cluster ${i + 1}</span>
              <span class="frames-count">${c.frames} frames</span>
            </div>
            <h3>${c.label}</h3>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${(c.frames / (data.duration || 1)) * 100}%"></div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } else {
    statsBox.innerHTML = `<p>No cluster statistics available.</p>`;
  }

  // Visualization
  if (data.visualization) {
    clusterImage.src = data.visualization;
  } else {
    clusterImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='320' viewBox='0 0 600 320'%3E%3Crect width='100%25' height='100%25' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='18' fill='%23999'%3ECluster Visualization%3C/text%3E%3C/svg%3E";
  }
}

function animateCard(element) {
  element.style.animation = 'none';
  setTimeout(() => {
    element.style.animation = 'fadeInUp 0.6s ease forwards';
  }, 10);
}

// ===================== Error Handling =====================
function showError(message) {
  progressText.innerText = message;
  progressBar.style.background = "linear-gradient(to right, #ff6b6b, #ff9f7f)";
  showToast(message, "error");
}

// ===================== Toast Notification =====================
function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3200);
}

// ===================== UI Helpers =====================
function resetUI() {
  progressBar.style.width = "0%";
  progressPercent.innerText = "0%";
  progressText.innerText = "Starting analysis...";
  progressBar.style.background = "linear-gradient(90deg, #4facfe, #5e9fff)";
  [resultContainer, statsContainer, visualizationContainer].forEach(c => c.classList.add('hidden'));
}
function showLoading(show) {
  if (show) {
    uploadBtn.disabled = true;
    btnLoader.classList.remove('hidden');
    btnLoader.classList.add('visible');
    btnContent.style.opacity = '0';
  } else {
    uploadBtn.disabled = false;
    btnLoader.classList.add('hidden');
    btnLoader.classList.remove('visible');
    btnContent.style.opacity = '1';
  }
}

// ===================== Visualization Controls =====================
document.addEventListener('click', function(e) {
  // Expand visualization
  if (e.target.closest('.fa-expand')) {
    const img = clusterImage;
    if (img && img.src) {
      const win = window.open(img.src, '_blank');
      win && win.focus();
    }
  }
  // Download visualization
  if (e.target.closest('.fa-download')) {
    const img = clusterImage;
    if (img && img.src) {
      const link = document.createElement('a');
      link.href = img.src;
      link.download = 'cluster_visualization.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
});

// ===================== Initialization =====================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDragDrop();
  themeSwitch.addEventListener('click', toggleTheme);
  // File input change is already handled in initDragDrop
});
