# Amazon Review Scraper

Chrome extension to automatically scrape Amazon product reviews across all star ratings.

## Features

- **All Star Filters** - Automatically scrapes 1-star through 5-star reviews
- **Auto-Resume** - Continues after page reload or browser restart
- **Configurable Delays** - Customize timing between pages (2-15 seconds)
- **CSV Export** - UTF-8 encoded for perfect Excel/Google Sheets display
- **CAPTCHA Detection** - Auto-pause when CAPTCHA appears
- **Real-time Dashboard** - Live stats and activity logs

## Important Notes

### Page Limits

Each star rating filter can only access a **maximum of 10 pages**. This is a limitation imposed by Amazon, not this extension.

For example, if a product has 5,000 one-star reviews:
- Amazon only displays 10 pages (approximately 100 reviews) for the 1-star filter
- The extension will collect all available reviews from those 10 pages
- Total maximum: **50 pages** (10 pages x 5 star ratings)

### Rate Limiting Warning

**Amazon may temporarily block your access if you scrape too fast.**

To avoid being blocked:
- Use the default delay settings (2-5 seconds between pages)
- Do not set delays below 2 seconds
- If you encounter CAPTCHA frequently, increase the delay
- Take breaks between scraping sessions

Recommended settings:
- **Minimum delay**: 3000ms (3 seconds)
- **Maximum delay**: 6000ms (6 seconds)

## Installation

### From Chrome Web Store

Coming soon - under review.

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/duongtuanvn/Amazon-Review-Scraper.git
   cd Amazon-Review-Scraper
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Usage

1. Navigate to any Amazon product page or product reviews page
2. Click the extension icon
3. (Optional) Configure timing in Settings tab
4. Click **Start** button
5. Extension automatically:
   - Scrapes current page
   - Navigates through pagination
   - Switches between star filters (1-star to 5-star)
   - Saves progress continuously
6. Click **Export** anytime for CSV download

## CSV Data Format

Exported data includes:
- Star filter (1-5 star)
- Page number
- Review ID
- Author name
- Star rating
- Review title
- Review date
- Product variant
- Verified purchase status
- Review body text

## Privacy

- All data stored locally on your device
- No external servers or data transmission
- No tracking or analytics
- No third-party services

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## Supported Amazon Domains

- amazon.com
- amazon.co.uk
- amazon.de
- amazon.co.jp
- amazon.vn

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite 5
- Chrome Extension Manifest V3

## License

MIT License - see [LICENSE](LICENSE) file.

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/duongtuanvn/Amazon-Review-Scraper/issues

---

**Version:** 2.0.3
