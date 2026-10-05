let activityChartInstance = null;
let sentimentChartInstance = null;
let currentCommitData = [];
let rawCommitsCache = [];

// Pagination state variables
let currentPage = 1;
const rowsPerPage = 10; 
let allCommitsData = [];

mermaid.initialize({ 
  startOnLoad: false, 
  theme: 'default',
  securityLevel: 'loose',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    nodeSpacing: 40,
    rankSpacing: 50
  }
});

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
      rawCommitsCache = commits;
      processCommitData(commits);
      setupAuthorDropdown(commits);
      
      fetchAndRenderArchitecture(owner, repo);

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
  currentCommitData = commits.map((item, index) => {
    const message = item.commit.message.replace(/"/g, '""');
    const author = item.commit.author.name || "Unknown";
    const date = item.commit.author.date;
    const score = scoreSentiment(item.commit.message);
    return { index: commits.length - index, author, date, message, score };
  });

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

    hourCounts[hour]++;
    if (hour >= 22 || hour <= 5) lateNightCount++;

    const score = scoreSentiment(message);
    sentiments.push({ index: commits.length - index, score, message, author });
    totalSentiment += score;

    authorCounts[author] = (authorCounts[author] || 0) + 1;
  });

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

  document.getElementById("totalCommits").textContent = total;
  document.getElementById("totalSentiment").textContent =
    avgSentiment > 0.1 ? `+${avgSentiment} (Optimistic)` :
    avgSentiment < -0.1 ? `${avgSentiment} (Frustrated)` : `${avgSentiment} (Neutral)`;
  document.getElementById("crunchRate").textContent = `${crunchRate}%`;
  document.getElementById("topContributor").textContent = topAuthor;

  document.getElementById("outputStatus").style.display = "grid";
  document.getElementById("outputChart").style.display = "grid";

  renderCharts(hourCounts, sentiments);
  renderCommitTable(sentiments);
  document.getElementById("commitSection").style.display = "block";
}

function renderCharts(hourCounts, sentimentData) {
  const hoursLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  if (activityChartInstance) activityChartInstance.destroy();
  if (sentimentChartInstance) sentimentChartInstance.destroy();

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

// --- Pagination & Table Rendering Functions ---
function renderCommitTable(commits) {
  allCommitsData = commits;
  currentPage = 1; 
  displayCommitPage();
}

function displayCommitPage() {
  const tbody = document.getElementById('commitTableBody');
  const paginationContainer = document.getElementById('paginationContainer');
  tbody.innerHTML = '';
  
  if (!allCommitsData || allCommitsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No commits found for this selection.</td></tr>`;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCommits = allCommitsData.slice(startIndex, endIndex);

  paginatedCommits.forEach((item, index) => {
    const score = item.score;
    const author = item.author || "Unknown";
    const message = item.message;

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

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${item.index}</td>
      <td><strong>${escapeHtml(author)}</strong></td>
      <td>${escapeHtml(message)}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
    `;
    tbody.appendChild(tr);
  });

  renderPaginationControls();
}

function renderPaginationControls() {
  const paginationContainer = document.getElementById('paginationContainer');
  if (!paginationContainer) return;
  
  const totalPages = Math.ceil(allCommitsData.length / rowsPerPage);

  if (totalPages <= 1) {
    paginationContainer.innerHTML = `<span>Showing all ${allCommitsData.length} commits</span>`;
    return;
  }

  paginationContainer.innerHTML = `
    <span>Showing page ${currentPage} of ${totalPages} (${allCommitsData.length} total commits)</span>
    <div class="pagination-buttons">
      <button class="page-btn" id="prevPageBtn" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <button class="page-btn" id="nextPageBtn" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;

  document.getElementById('prevPageBtn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      displayCommitPage();
    }
  });

  document.getElementById('nextPageBtn').addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      displayCommitPage();
    }
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  if (!currentCommitData || currentCommitData.length === 0) return;

  let csvRows = ["Commit #,Author,Date,Sentiment Score,Commit Message"];

  currentCommitData.forEach(row => {
    const safeMessage = `"${row.message.replace(/"/g, '""')}"`;
    csvRows.push(`${row.index},"${row.author}","${row.date}",${row.score},${safeMessage}`);
  });

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", "git_commit_sentiment_export.csv");
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
});

function setupAuthorDropdown(commits) {
  const select = document.getElementById("authorSelect");
  select.innerHTML = '<option value="all">All Contributors</option>';
  
  const authors = [...new Set(commits.map(item => item.commit.author.name || "Unknown"))];
  
  authors.sort().forEach(author => {
    const option = document.createElement("option");
    option.value = author;
    option.textContent = author;
    select.appendChild(option);
  });

  document.getElementById("filterSection").style.display = "flex";
}

function applyFilters() {
  if (!rawCommitsCache || rawCommitsCache.length === 0) return;

  const selectedAuthor = document.getElementById("authorSelect").value;
  const startDateVal = document.getElementById("startDate").value;
  const endDateVal = document.getElementById("endDate").value;

  const filtered = rawCommitsCache.filter(item => {
    const author = item.commit.author.name || "Unknown";
    const matchesAuthor = (selectedAuthor === "all" || author === selectedAuthor);

    const commitDate = new Date(item.commit.author.date);
    let matchesStartDate = true;
    let matchesEndDate = true;

    if (startDateVal) {
      const startDate = new Date(startDateVal);
      startDate.setHours(0, 0, 0, 0);
      matchesStartDate = commitDate >= startDate;
    }

    if (endDateVal) {
      const endDate = new Date(endDateVal);
      endDate.setHours(23, 59, 59, 999);
      matchesEndDate = commitDate <= endDate;
    }

    return matchesAuthor && matchesStartDate && matchesEndDate;
  });

  processCommitData(filtered);
}

document.getElementById("authorSelect").addEventListener("change", applyFilters);
document.getElementById("startDate").addEventListener("change", applyFilters);
document.getElementById("endDate").addEventListener("change", applyFilters);

document.getElementById("resetDateBtn").addEventListener("click", () => {
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  applyFilters();
});

async function fetchAndRenderArchitecture(owner, repo) {
  const container = document.getElementById("mermaidDiagram");
  if (!container) return;

  container.textContent = "Analyzing repository layers and building deep architectural map...";

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!repoRes.ok) throw new Error("Repository not found or API rate limit reached");
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || "main";

    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
    if (!treeRes.ok) throw new Error("Could not fetch repository file tree");
    const treeData = await treeRes.json();

    if (!treeData.tree || treeData.tree.length === 0) {
      container.textContent = "No file structure found in this repository.";
      return;
    }

    const items = treeData.tree;
    const sourceDirs = [];
    const configFiles = [];
    const docFiles = [];

    items.forEach(item => {
      const path = item.path.toLowerCase();
      const parts = item.path.split('/');

      if (parts.length === 1) {
        if (item.type === 'tree') {
          sourceDirs.push(parts[0]);
        } else {
          if (path.includes('readme') || path.includes('license')) docFiles.push(parts[0]);
          else configFiles.push(parts[0]);
        }
      } else if (parts.length === 2 && item.type === 'tree') {
        if (!sourceDirs.includes(parts[0])) sourceDirs.push(parts[0]);
      }
    });

    let mermaidCode = "graph TD;\n";
    mermaidCode += `    Root["📂 ${repoData.name}<br/><sub style='font-size:10px;'>🌟 Stars: ${repoData.stargazers_count} | 🍴 Forks: ${repoData.forks_count}</sub>"]:::rootStyle;\n`;

    if (sourceDirs.length > 0) {
      mermaidCode += `    subgraph CoreSource ["🏗️ Core Architecture & Directories"]\n`;
      sourceDirs.slice(0, 12).forEach((dir, idx) => {
        const safeId = `dir_${idx}`;
        const safeName = dir.replace(/"/g, '\\"');
        mermaidCode += `        ${safeId}["📁 ${safeName}"]:::sourceStyle;\n`;
      });
      mermaidCode += `    end\n`;
      
      sourceDirs.slice(0, Math.min(5, sourceDirs.length)).forEach((_, idx) => {
        mermaidCode += `    Root -->|maps to| dir_${idx};\n`;
      });
    }

    if (configFiles.length > 0) {
      mermaidCode += `    subgraph Configurations ["⚙️ Configurations & Environment"]\n`;
      configFiles.slice(0, 8).forEach((file, idx) => {
        const safeId = `cfg_${idx}`;
        const safeName = file.replace(/"/g, '\\"');
        mermaidCode += `        ${safeId}["📄 ${safeName}"]:::configStyle;\n`;
      });
      mermaidCode += `    end\n`;

      if (configFiles.length > 0) {
        mermaidCode += `    Root -->|controlled by| cfg_0;\n`;
      }
    }

    if (docFiles.length > 0) {
      mermaidCode += `    subgraph Documentation ["📚 Documentation & Meta"]\n`;
      docFiles.slice(0, 5).forEach((doc, idx) => {
        const safeId = `doc_${idx}`;
        const safeName = doc.replace(/"/g, '\\"');
        mermaidCode += `        ${safeId}["📖 ${safeName}"]:::docStyle;\n`;
      });
      mermaidCode += `    end\n`;
      
      mermaidCode += `    Root -->|documented by| doc_0;\n`;
    }

    mermaidCode += `    classDef rootStyle fill:#0969da,stroke:#044289,color:#fff,stroke-width:2px;\n`;
    mermaidCode += `    classDef sourceStyle fill:#f0fdf4,stroke:#22c55e,color:#166534,stroke-width:1.5px;\n`;
    mermaidCode += `    classDef configStyle fill:#eff6ff,stroke:#3b82f6,color:#1e40af,stroke-width:1.5px;\n`;
    mermaidCode += `    classDef docStyle fill:#fefce8,stroke:#eab308,color:#713f12,stroke-width:1.5px;\n`;

    container.innerHTML = "";
    if (typeof mermaid !== 'undefined') {
      const id = 'mermaid-' + Math.random().toString(36).substring(2, 9);
      const { svg } = await mermaid.render(id, mermaidCode);
      container.innerHTML = svg;
      
      const svgElement = container.querySelector('svg');
      if (svgElement) {
        if (!svgElement.getAttribute('viewBox')) {
          const w = svgElement.getAttribute('width') || 1200;
          const h = svgElement.getAttribute('height') || 800;
          svgElement.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
        }
        svgElement.removeAttribute('width');
        svgElement.removeAttribute('height');
        svgElement.style.width = '100%';
        svgElement.style.height = 'auto';
      }
    } else {
      container.textContent = mermaidCode;
    }

  } catch (err) {
    container.textContent = `Unable to generate deep architecture map: ${err.message}`;
  }
}