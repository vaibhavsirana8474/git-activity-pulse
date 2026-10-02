# Git Commit Sentiment & Developer Activity Pulse

An interactive developer analytics dashboard that connects to the GitHub REST API to assess commit activity patterns, sprint velocity, late-night crunch hours, and commit message sentiment.

## Features
- **Live GitHub API Ingestion:** Fetches real-time commit metadata without external server requirements.
- **Developer Crunch Detection:** Computes the percentage of commits pushed during late-night hours (10:00 PM – 5:00 AM).
- **Commit Sentiment Scoring:** Analyzes commit messages to gauge repository morale and refactor stress.
- **Interactive Visualizations:** Renders hourly commit heatmaps and sentiment trendlines using Chart.js.

## Tech Stack
- **Languages:** JavaScript (ES6+), HTML5, CSS3
- **Libraries:** Chart.js
- **Tools:** GitHub REST API, VS Code, Git