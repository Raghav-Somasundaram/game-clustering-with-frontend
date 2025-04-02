document.addEventListener("DOMContentLoaded", function () {
  const uploadForm = document.getElementById("uploadForm");
  const videoInput = document.getElementById("videoInput");
  const isLabeledCheckbox = document.getElementById("isLabeled");
  const gameNameInput = document.getElementById("gameName");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const resultContainer = document.getElementById("resultContainer");
  const statsContainer = document.getElementById("statsContainer");
  const clusterVisualization = document.getElementById("clusterVisualization");
  const submitButton = uploadForm.querySelector("button");

  const API_BASE_URL = "http://127.0.0.1:8000";

  // Function to fetch cluster statistics
  async function fetchStats() {
      try {
          const response = await fetch(`${API_BASE_URL}/stats`);
          if (!response.ok) throw new Error("Failed to fetch statistics");

          const stats = await response.json();
          let statsHtml = "<h3>Cluster Statistics</h3><ul>";

          for (const [game, count] of Object.entries(stats)) {
              statsHtml += `<li><strong>${game}</strong>: ${count} frames</li>`;
          }

          statsHtml += "</ul>";
          statsContainer.innerHTML = statsHtml;
      } catch (error) {
          console.error("Error fetching stats:", error);
          statsContainer.innerHTML = "<p style='color: red;'>Error loading statistics.</p>";
      }
  }

  // Function to fetch and display cluster visualization
  async function fetchClusterVisualization() {
      try {
          const response = await fetch(`${API_BASE_URL}/visualize_clusters`);
          if (!response.ok) throw new Error("Failed to load visualization");

          const data = await response.json();
          if (data.image_url) {
              clusterVisualization.innerHTML = `
                  <h3>Updated Clusters:</h3>
                  <img src="${API_BASE_URL}/${data.image_url}" alt="Cluster Visualization"
                  style="max-width: 100%; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0px 4px 6px rgba(0,0,0,0.2);">`;
          }
      } catch (error) {
          console.error("Error fetching cluster visualization:", error);
          clusterVisualization.innerHTML = "<p style='color: red;'>Could not load cluster visualization.</p>";
      }
  }

  // Upload video function
  uploadForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!videoInput.files.length) {
          alert("Please select a video file to upload.");
          return;
      }

      const formData = new FormData();
      formData.append("video", videoInput.files[0]);
      formData.append("is_labeled", isLabeledCheckbox.checked);
      formData.append("game_name", gameNameInput.value.trim());

      // Disable submit button during upload
      submitButton.disabled = true;
      submitButton.textContent = "Uploading...";
      
      // Reset UI elements
      progressBar.style.width = "0%";
      progressText.textContent = "Uploading...";
      resultContainer.innerHTML = "";
      clusterVisualization.innerHTML = "";

      try {
          const response = await fetch(`${API_BASE_URL}/upload/`, {
              method: "POST",
              body: formData,
          });

          const result = await response.json();

          // Animate progress bar
          let width = 0;
          const interval = setInterval(() => {
              if (width >= 100) {
                  clearInterval(interval);
                  progressText.textContent = "Processing Completed!";
              } else {
                  width += 10;
                  progressBar.style.width = width + "%";
              }
          }, 100);

          // Display result
          if (result.game) {
              resultContainer.innerHTML = `<h3>Predicted Game:</h3><p>${result.game}</p>`;
          } else {
              resultContainer.innerHTML = `<p>${result.message || "Processing complete."}</p>`;
          }

          // Fetch latest stats & visualization
          fetchStats();
          setTimeout(fetchClusterVisualization, 500);
      } catch (error) {
          console.error("Error uploading video:", error);
          progressText.textContent = "Upload failed!";
          resultContainer.innerHTML = "<p style='color: red;'>Error processing video.</p>";
      } finally {
          // Re-enable submit button
          submitButton.disabled = false;
          submitButton.textContent = "Upload Video";
      }
  });

  // Load statistics & visualization on page load
  fetchStats();
  fetchClusterVisualization();
});
