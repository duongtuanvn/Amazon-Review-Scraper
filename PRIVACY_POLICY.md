# Privacy Policy - Amazon Review Scraper

**Last Updated:** January 29, 2026

## Overview

Amazon Review Scraper is a Chrome browser extension that helps you collect and export Amazon product reviews. This privacy policy explains how the extension handles your data.

---

## Data Collection

**We DO NOT collect, transmit, or share any personal data.**

### What We Access:
- Amazon product review pages (only when you're actively viewing them)
- Local browser storage (to save your scraping progress)

### What We DO NOT Do:
- ❌ Send data to external servers
- ❌ Track your browsing activity
- ❌ Collect personal information
- ❌ Use analytics or tracking cookies
- ❌ Share data with third parties

---

## Data Storage

### Local Storage Only
All scraped review data is stored **locally on your device** using:
- Browser's `localStorage` (temporary, fast access)
- Chrome's `chrome.storage.local` (persistent backup)

### Data Deletion
You can delete all stored data anytime by:
1. Clearing your browser's local storage
2. Clearing browser data in Chrome settings
3. Uninstalling the extension

---

## Permissions Explained

The extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| **activeTab** | To access and scrape reviews from the Amazon page you're currently viewing |
| **scripting** | To inject the scraper code into Amazon review pages |
| **storage** | To save your scraping progress locally (enables auto-resume after page reload) |
| **tabs** | To reload pages when navigating between review pages during scraping |

**All permissions are used solely for scraping functionality. No data leaves your device.**

---

## Third-Party Services

This extension **does NOT** use any third-party services, including:
- No analytics (Google Analytics, etc.)
- No crash reporting services
- No advertising networks
- No social media integrations
- No external APIs

---

## Scraped Data

### What Gets Scraped:
When you use the extension to scrape Amazon reviews, it collects:
- Star ratings
- Review titles and body text
- Reviewer names (public information already on Amazon)
- Review dates
- Verified purchase status
- Product variant information

### How It's Used:
- Scraped data is **only stored locally** on your device
- You control the data through CSV export
- Data is **never** sent to our servers (we don't have any!)

---

## Security

- All data processing happens locally in your browser
- No network transmission of scraped data
- No user authentication or login required
- No server-side storage or processing

---

## Changes to This Policy

We may update this privacy policy occasionally. Changes will be reflected in:
- The "Last Updated" date at the top
- Extension update notes

---

## Contact

For questions or concerns about privacy, please open an issue on our GitHub repository:
- **GitHub:** https://github.com/duongtuanvn/Amazon-Review-Scraper/issues

---

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- GDPR (no personal data collection)
- CCPA (no data sale or sharing)

---

## Your Rights

You have the right to:
- Access your locally stored data (via browser DevTools)
- Delete all data (clear browser storage or uninstall)
- Request information about data handling (contact us via GitHub)

---

**This extension is provided "as-is" without warranty. Use at your own discretion.**

---

**Version:** 2.0.3  
**Extension Name:** Amazon Review Scraper 
