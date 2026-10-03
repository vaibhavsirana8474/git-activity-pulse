let activityChartInstance = null;
let sentimentChartInstance = null;

// Lightweight AFINN-based Sentiment Lexicon for Commit Messages
const sentimentDictionary = {
  fixed: 2, fix: 2, resolve: 2, resolved: 2, clean: 2, cleaned: 2,
  feat: 2, feature: 2, improvement: 2, improve: 2, improved: 2,
  great: 3, awesome: 3, optimize: 2, optimized: 2, support: 1,
  update: 0, docs: 0, chore: 0, refactor: 1,
  bug: -2, broke: -3, broken: -3, issue: -2, failed: -2, fail: -2,
  error: -2, revert: -2, crash: -3, bad: -2, wrong: -2, slow: -2,
  ugly: -2, leak: -2, oops: -2, damn: -3, hate: -3
};

function scoreSentiment(message) {
  const words = message.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/);
  let score = 0;
  let matches = 0;

  words.forEach(word => {
    if (sentimentDictionary.hasOwnProperty(word)) {
      score += sentimentDictionary[word];
      matches++;
    }
  });

  if (matches === 0) return 0;
  return Math.max(-1, Math.min(1, score / (matches * 2)));
}

document.getElementById("analyzeBtn").addEventListener("click", () => {
  const owner = document.getElementById("ownerInput").value.trim();
  const repo = document.getElementById("repoInput").value.trim();
  const spinner = document.getElementById("loadingSpinner");
  const statusText = document.getElementById("statusText");

  if (!owner || !repo) {
    spinner.style.display = "none";
    statusText.textContent = "Please enter both owner and repository name.";
    statusText.style.color = "red";
    return;
  }

  spinner.style.display = "inline-block";
  statusText.textContent = `Fetching commits for ${owner}/${repo}...`;
  statusText.style.color = "#555";


  document.getElementById("outputStatus").style.display = "none";
  document.getElementById("outputChart").style.display = "none";

  fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`)
    .then(res => {
      if (!res.ok) throw new Error(`Repository not found or rate limit reached (${res.status})`);
      return res.json();
    })
    .then(commits => {
      spinner.style.display = "none";
      if (!commits || commits.length === 0) {
        statusText.textContent = "No commits found in this repository.";
        statusText.style.color = "orange";
        return;
      }
      processCommitData(commits);
      statusText.textContent = `Successfully analyzed last ${commits.length} commits.`;
      statusText.style.color = "green";
    })
    .catch(err => {
      spinner.style.display = "none";
      statusText.textContent = err.message;
      statusText.style.color = "red";
    });
});

function processCommitData(commits) {
  const hourCounts = new Array(24).fill(0);
  const sentiments = [];
  const authorCounts = {};
  let totalSentiment = 0;
  let lateNightCount = 0;

  commits.forEach((item, index) => {
    const message = item.commit.message;
    const date = new Date(item.commit.author.date);
    const hour = date.getHours();
    const author = item.commit.author.name || "Unknown";

    // Track hours
    hourCounts[hour]++;
    if (hour >= 22 || hour <= 5) lateNightCount++;

    // Track sentiment
    const score = scoreSentiment(message);
    sentiments.push({ index: commits.length - index, score, message });
    totalSentiment += score;

    // Track author counts
    authorCounts[author] = (authorCounts[author] || 0) + 1;
  });

  // Calculate high-level KPIs
  const total = commits.length;
  const avgSentiment = (totalSentiment / total).toFixed(2);
  const crunchRate = Math.round((lateNightCount / total) * 100);

  let topAuthor = "--";
  let maxCommits = 0;
  for (const [author, count] of Object.entries(authorCounts)) {
    if (count > maxCommits) {
      maxCommits = count;
      topAuthor = author;
    }
  }

  // Update UI Elements
  document.getElementById("totalCommits").textContent = total;
  document.getElementById("totalSentiment").textContent =
    avgSentiment > 0.1 ? `+${avgSentiment} (Optimistic)` :
    avgSentiment < -0.1 ? `${avgSentiment} (Frustrated)` : `${avgSentiment} (Neutral)`;
  document.getElementById("crunchRate").textContent = `${crunchRate}%`;
  document.getElementById("topContributor").textContent = topAuthor;

  document.getElementById("outputStatus").style.display = "grid";
  document.getElementById("outputChart").style.display = "grid";

  renderCharts(hourCounts, sentiments);
  renderTable(sentiments, commits);
  document.getElementById("commitSection").style.display = "block";
}

function renderCharts(hourCounts, sentimentData) {
  const hoursLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Destroy previous charts if they exist to prevent overlapping
  if (activityChartInstance) activityChartInstance.destroy();
  if (sentimentChartInstance) sentimentChartInstance.destroy();

  // 1. Activity Heatmap Chart (Bar Chart)
  const ctxActivity = document.getElementById("activityChart").getContext("2d");
  activityChartInstance = new Chart(ctxActivity, {
    type: "bar",
    data: {
      labels: hoursLabels,
      datasets: [{
        label: "Commits per Hour",
        data: hourCounts,
        backgroundColor: "rgba(9, 105, 218, 0.75)",
        borderColor: "rgba(9, 105, 218, 1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { title: { display: true, text: "Hour of Day (24-hour format)" } }
      }
    }
  });

  // 2. Sentiment Trend Chart (Line Chart)
  const ctxSentiment = document.getElementById("sentimentChart").getContext("2d");
  sentimentChartInstance = new Chart(ctxSentiment, {
    type: "line",
    data: {
      labels: sentimentData.map(d => `#${d.index}`),
      datasets: [{
        label: "Commit Sentiment (-1 to +1)",
        data: sentimentData.map(d => d.score),
        borderColor: "#2da44e",
        backgroundColor: "rgba(46, 164, 79, 0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { min: -1, max: 1 }
      }
    }
  });
}

function renderTable(sentiments, rawCommits) {
  const tableBody = document.getElementById("commitTableBody");
  tableBody.innerHTML = "";

  sentiments.forEach((item, index) => {
    const rawCommit = rawCommits[rawCommits.length - 1 - index];
    const author = rawCommit.commit.author.name || "Unknown";
    const message = item.message;
    const score = item.score;

    let badgeClass = "badge-neutral";
    let badgeText = "Neutral";
    if (score > 0.1) {
      badgeClass = "badge-positive";
      badgeText = `Positive (${score})`;
    } else if (score < -0.1) {
      badgeClass = "badge-negative";
      badgeText = `Frustrated (${score})`;
    } else {
      badgeText = `Neutral (${score})`;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>#${item.index}</td>
      <td><strong>${escapeHtml(author)}</strong></td>
      <td>${escapeHtml(message)}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}