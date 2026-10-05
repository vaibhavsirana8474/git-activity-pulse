# Git Commit Sentiment & Developer Activity Pulse

An interactive developer analytics dashboard that connects to the GitHub REST API to assess commit activity patterns, sprint velocity, late-night crunch hours, commit message sentiment, and recursive repository architecture.

## Features

- **Live GitHub API Ingestion:** Fetches real-time commit metadata and repository file trees without external server requirements.
- **Interactive Architecture Mapping:** Dynamically generates a structural dependency and folder hierarchy map using **Mermaid.js**, complete with **`svg-pan-zoom`** support for deep exploration.
- **Developer Crunch Detection:** Computes the percentage of commits pushed during late-night hours (10:00 PM – 5:00 AM).
- **Commit Sentiment Scoring:** Analyzes commit messages using an AFINN-based lexicon to gauge repository morale and refactor stress.
- **Advanced Filtering & Pagination:** Filter commits by author and date range, with a fully responsive pagination system for large codebases.
- **Interactive Visualizations:** Renders hourly commit distribution heatmaps and sentiment trendlines using **Chart.js**.
- **Data Export:** Export analyzed commit data and sentiment metrics directly to CSV format.

## Tech Stack

- **Languages:** JavaScript (ES6+), HTML5, CSS3
- **Libraries & Visualizations:** Chart.js, Mermaid.js, `svg-pan-zoom`
- **APIs & Tools:** GitHub REST API, VS Code, Git
