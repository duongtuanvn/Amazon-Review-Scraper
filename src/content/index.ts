import { Review, ScrapeSession, STAR_FILTERS, STAR_LABELS, StarFilter } from '../types';

/**
 * ═══════════════════════════════════════════════════════════════
 * AMAZON REVIEW SCRAPER - Content Script (Refactored Architecture)
 * 
 * Inspired by working Tampermonkey script with improvements:
 * - Dual storage: localStorage (fast) + chrome.storage (persistent)
 * - Auto-resume after page reload
 * - Proper state machine for filter progression
 * - Reliable pagination detection
 * ═══════════════════════════════════════════════════════════════
 */

console.log('%c🚀 Amazon Review Scraper - Content Script Loaded', 'color: #3b82f6; font-weight: bold; font-size: 14px');

// ===== CONSTANTS =====
const STORAGE_KEY = 'amazon_scraper_session';
const DELAY_BETWEEN_PAGES_MIN = 2000;
const DELAY_BETWEEN_PAGES_MAX = 5000;
const DELAY_BETWEEN_STARS = 3000;
const PAGE_LOAD_CHECK_INTERVAL = 500;
const PAGE_LOAD_TIMEOUT = 10000;

// ===== UTILITY FUNCTIONS =====
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => delay(Math.floor(Math.random() * (max - min + 1) + min));

/**
 * Check if extension context is still valid
 * Returns false if extension was reloaded/disabled
 */
function isExtensionContextValid(): boolean {
    try {
        // Try to access chrome.runtime.id - will throw if context invalid
        return !!chrome?.runtime?.id;
    } catch {
        return false;
    }
}

/**
 * Safely send message to background, handling context invalidation
 */
function safeSendMessage(message: any): void {
    if (!isExtensionContextValid()) {
        console.warn('[Scraper] Extension context invalid - cannot send message');
        return;
    }

    chrome.runtime.sendMessage(message).catch((error) => {
        // Context may have been invalidated after check
        if (error.message?.includes('Extension context invalidated')) {
            console.warn('[Scraper] Extension was reloaded - stopping scraper');
        }
    });
}

const log = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const styles: Record<typeof type, string> = {
        info: 'color: #3b82f6; font-weight: bold; font-size: 12px;',
        success: 'color: #22c55e; font-weight: bold; font-size: 12px;',
        warn: 'color: #eab308; font-weight: bold; font-size: 12px;',
        error: 'color: #ef4444; font-weight: bold; font-size: 12px;',
    };
    console.log(`%c[Scraper] ${msg}`, styles[type]);

    // Send to background for popup logs
    safeSendMessage({
        type: 'LOG_MESSAGE',
        payload: { message: msg, level: type }
    });
};


// ===== STATE MANAGEMENT =====

/**
 * Load session from localStorage (fast, synchronous)
 * Falls back to chrome.storage if localStorage is empty
 */
function loadSessionFromLocalStorage(): ScrapeSession | null {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const session = JSON.parse(saved) as ScrapeSession;
            log(`📦 Restored session: ${session.reviews.length} reviews, ${STAR_LABELS[STAR_FILTERS[session.currentStarIndex]]}`, 'info');
            return session;
        }
    } catch (e) {
        log('⚠️ Failed to load from localStorage', 'warn');
    }
    return null;
}

/**
 * Save session to both localStorage (fast) and chrome.storage (persistent)
 */
function saveSession(session: ScrapeSession): void {
    session.lastUpdated = Date.now();

    // Save to localStorage (instant)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
        log('⚠️ localStorage save failed', 'warn');
    }

    // Also save to chrome.storage (async, persistent across reinstalls)
    chrome.storage.local.set({ [STORAGE_KEY]: session }).catch(() => {
        log('⚠️ chrome.storage save failed', 'warn');
    });
}

/**
 * Clear session from both storages
 */
function clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
    chrome.storage.local.remove(STORAGE_KEY);
    log('🗑️ Session cleared', 'info');
}

/**
 * Initialize or restore session
 */
async function getOrCreateSession(): Promise<ScrapeSession> {
    // Try localStorage first (fast)
    let session = loadSessionFromLocalStorage();

    // If not found, try chrome.storage
    if (!session) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        if (result[STORAGE_KEY]) {
            session = result[STORAGE_KEY] as ScrapeSession;
            log(`📦 Restored from chrome.storage: ${session.reviews.length} reviews`, 'info');
        }
    }

    // If still no session, check if user wants to start
    if (!session) {
        const { isScanning } = await chrome.storage.local.get('isScanning');
        if (!isScanning) {
            // Not scanning, return inactive session
            return {
                isActive: false,
                reviews: [],
                currentStarIndex: 0,
                currentPage: 1,
                lastUrl: window.location.href,
                startedAt: Date.now(),
                lastUpdated: Date.now()
            };
        }

        // User clicked START, create new session
        session = {
            isActive: true,
            reviews: [],
            currentStarIndex: 0,
            currentPage: 1,
            lastUrl: '',
            startedAt: Date.now(),
            lastUpdated: Date.now()
        };
        log('🆕 Created new scraping session', 'success');
    }

    return session;
}

// ===== REVIEW EXTRACTION =====

function extractReviews(starFilter: StarFilter, pageNum: number): Review[] {
    const reviews: Review[] = [];
    const reviewCards = document.querySelectorAll('li[data-hook="review"]');

    log(`📄 Page ${pageNum} (${STAR_LABELS[starFilter]}): Found ${reviewCards.length} review cards`, 'info');

    reviewCards.forEach((card, index) => {
        try {
            const id = card.id || `review-${Date.now()}-${index}`;
            const author = (card.querySelector('.a-profile-name') as HTMLElement)?.innerText?.trim() || 'Anonymous';

            const ratingEl = card.querySelector('i[data-hook="review-star-rating"] .a-icon-alt, i[data-hook="cmps-review-star-rating"] .a-icon-alt');
            const starRating = (ratingEl as HTMLElement)?.innerText?.trim() || 'N/A';

            const titleEl = card.querySelector('a[data-hook="review-title"] span:last-child, span[data-hook="review-title"] span:last-child');
            const title = (titleEl as HTMLElement)?.innerText?.trim() || '';

            const date = (card.querySelector('span[data-hook="review-date"]') as HTMLElement)?.innerText?.trim() || '';
            const content = (card.querySelector('span[data-hook="review-body"] span') as HTMLElement)?.innerText?.trim() || '';
            const verified = !!card.querySelector('span[data-hook="avp-badge"]');
            const variant = (card.querySelector('a[data-hook="format-strip"]') as HTMLElement)?.innerText?.trim() || '';

            if (content && content.length > 0) {
                reviews.push({
                    id,
                    author,
                    starRating,
                    title,
                    date,
                    content,
                    verified,
                    variant,
                    images: [],
                    starFilter: STAR_LABELS[starFilter],
                    pageNumber: pageNum
                });
            }
        } catch (e) {
            log(`⚠️ Error parsing review ${index + 1}`, 'warn');
        }
    });

    return reviews;
}

// ===== NAVIGATION HELPERS =====

function hasNextPage(): boolean {
    const nextButton = document.querySelector('li.a-last:not(.a-disabled) a');
    return !!nextButton;
}

function clickNextPage(): boolean {
    const nextButton = document.querySelector('li.a-last a') as HTMLElement;
    if (nextButton) {
        nextButton.click();
        return true;
    }
    return false;
}

function getCurrentPageNumber(): number {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('pageNumber');
    return pageParam ? parseInt(pageParam, 10) : 1;
}

function getCurrentStarFilter(): StarFilter | null {
    const urlParams = new URLSearchParams(window.location.search);
    const filter = urlParams.get('filterByStar');
    if (filter && STAR_FILTERS.includes(filter as StarFilter)) {
        return filter as StarFilter;
    }
    return null;
}

async function waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
        let elapsed = 0;
        const checkInterval = setInterval(() => {
            const reviews = document.querySelectorAll('li[data-hook="review"]');
            if (reviews.length > 0) {
                clearInterval(checkInterval);
                resolve();
            }

            elapsed += PAGE_LOAD_CHECK_INTERVAL;
            if (elapsed >= PAGE_LOAD_TIMEOUT) {
                clearInterval(checkInterval);
                log('⚠️ Page load timeout - proceeding anyway', 'warn');
                resolve();
            }
        }, PAGE_LOAD_CHECK_INTERVAL);
    });
}

function clickStarFilter(starFilter: StarFilter): boolean {
    log(`🖱️ Attempting to click filter: ${STAR_LABELS[starFilter]}`, 'info');

    // Strategy 1: Histogram container (most reliable)
    const histogramLinks = document.querySelectorAll('.histogram-row-container');
    for (const link of histogramLinks) {
        const stateParam = link.getAttribute('data-reviews-state-param') || '';
        if (stateParam.includes(`"filterByStar":"${starFilter}"`)) {
            (link as HTMLElement).click();
            log(`✅ Clicked histogram link for ${STAR_LABELS[starFilter]}`, 'success');
            return true;
        }
    }

    // Strategy 2: Direct href links
    const hrefLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="filterByStar"]');
    for (const link of hrefLinks) {
        if (link.href.includes(`filterByStar=${starFilter}`)) {
            link.click();
            log(`✅ Clicked href link for ${STAR_LABELS[starFilter]}`, 'success');
            return true;
        }
    }

    // Strategy 3: Dropdown (less common)
    const dropdown = document.querySelector('#star-count-dropdown, select[data-action="a-dropdown-select"]') as HTMLSelectElement;
    if (dropdown) {
        const option = dropdown.querySelector(`option[value="${starFilter}"]`) as HTMLOptionElement;
        if (option) {
            dropdown.value = starFilter;
            dropdown.dispatchEvent(new Event('change', { bubbles: true }));
            log(`✅ Used dropdown for ${STAR_LABELS[starFilter]}`, 'success');
            return true;
        }
    }

    log(`❌ Could not find filter link for ${STAR_LABELS[starFilter]}`, 'error');
    return false;
}

// ===== CAPTCHA DETECTION =====

function detectCaptcha(): boolean {
    if (document.querySelector('form[action="/errors/validateCaptcha"]') ||
        document.body.innerText.includes('Enter the characters you see below')) {
        return true;
    }
    return false;
}

// ===== EXPORT FUNCTIONALITY =====

function downloadCSV(reviews: Review[]): void {
    if (reviews.length === 0) {
        log('❌ No reviews to export', 'error');
        return;
    }

    const headers = ['Star Filter', 'Page', 'ID', 'Author', 'Rating', 'Title', 'Date', 'Variant', 'Verified', 'Review Body'];
    const csvRows = [headers.join(',')];

    reviews.forEach(row => {
        const values = [
            row.starFilter || 'N/A',
            row.pageNumber?.toString() || 'N/A',
            `"${row.id.replace(/"/g, '""')}"`,
            `"${row.author.replace(/"/g, '""')}"`,
            `"${row.starRating}"`,
            `"${row.title.replace(/"/g, '""')}"`,
            `"${row.date}"`,
            `"${row.variant}"`,
            row.verified ? 'Yes' : 'No',
            `"${row.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`
        ];
        csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');

    // ✅ FIX: Add UTF-8 BOM for proper star symbol encoding in Excel/Google Sheets
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amazon_reviews_all_stars_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    log(`✅ Downloaded CSV: ${reviews.length} reviews`, 'success');
}

// ===== MAIN SCRAPING LOGIC =====

async function scrapeCurrentPage(session: ScrapeSession): Promise<void> {
    const currentFilter = getCurrentStarFilter();
    const expectedFilter = STAR_FILTERS[session.currentStarIndex];

    // Validate we're on the right filter
    if (currentFilter !== expectedFilter) {
        log(`⚠️ URL filter mismatch: expected ${expectedFilter}, got ${currentFilter}`, 'warn');
        // Try to navigate to correct filter
        if (currentFilter === null) {
            // We're on "All Stars" - need to switch to first filter
            log(`Switching from All Stars to ${STAR_LABELS[expectedFilter]}`, 'info');
            if (clickStarFilter(expectedFilter)) {
                await waitForPageLoad();
                await delay(2000);
                return; // Will be called again after reload
            }
        }
    }

    // Extract reviews from current page
    const pageNum = getCurrentPageNumber();
    const reviews = extractReviews(expectedFilter, pageNum);

    if (reviews.length > 0) {
        session.reviews.push(...reviews);
        session.currentPage = pageNum;
        saveSession(session);

        log(`✅ Saved ${reviews.length} reviews. Total: ${session.reviews.length}`, 'success');

        // Notify background script
        chrome.runtime.sendMessage({
            type: 'REVIEWS_UPDATE',
            payload: {
                total: session.reviews.length,
                currentFilter: STAR_LABELS[expectedFilter],
                currentPage: pageNum
            }
        }).catch(() => { });
    } else {
        log('⚠️ No reviews found on this page', 'warn');
    }

    // Check if there's a next page
    if (hasNextPage()) {
        // Get delay settings from storage
        const { delaySettings } = await chrome.storage.local.get('delaySettings');
        const minDelay = delaySettings?.min || DELAY_BETWEEN_PAGES_MIN;
        const maxDelay = delaySettings?.max || DELAY_BETWEEN_PAGES_MAX;
        const waitTime = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

        log(`⏳ Next page in ${Math.round(waitTime / 1000)}s...`, 'info');

        // Send countdown to popup
        chrome.runtime.sendMessage({
            type: 'WAITING_STATUS',
            payload: { duration: waitTime }
        }).catch(() => { });

        // Scroll to simulate human behavior
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await delay(1000);
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });

        await delay(waitTime);

        const oldPage = getCurrentPageNumber();
        if (clickNextPage()) {
            await delay(3000); // Wait for navigation
            const newPage = getCurrentPageNumber();

            // Check if page actually changed
            if (newPage === oldPage) {
                log('⚠️ Next button clicked but page didn\'t change - moving to next filter', 'warn');
                await switchToNextFilter(session);
            } else {
                // Page changed successfully - will be re-triggered by URL change detection
                log(`➡️ Navigated to page ${newPage}`, 'info');
            }
        }
    } else {
        // No more pages for this filter
        log(`🏁 End of ${STAR_LABELS[expectedFilter]} reviews`, 'success');
        await switchToNextFilter(session);
    }
}

async function switchToNextFilter(session: ScrapeSession): Promise<void> {
    session.currentStarIndex++;
    session.currentPage = 1;

    if (session.currentStarIndex >= STAR_FILTERS.length) {
        // ALL DONE!
        log(`🎉 SCRAPING COMPLETE! Total: ${session.reviews.length} reviews`, 'success');

        // Download CSV
        downloadCSV(session.reviews);

        // Clear session
        clearSession();

        // Notify background
        chrome.runtime.sendMessage({
            type: 'SCRAPING_COMPLETE',
            payload: { total: session.reviews.length }
        }).catch(() => { });

        // Update storage
        chrome.storage.local.set({ isScanning: false });

        alert(`✅ Scraping Complete!\n\nTotal Reviews: ${session.reviews.length}\nCSV file downloaded.`);
        return;
    }

    const nextFilter = STAR_FILTERS[session.currentStarIndex];
    log(`🔄 Switching to ${STAR_LABELS[nextFilter]}...`, 'info');

    saveSession(session);

    await delay(DELAY_BETWEEN_STARS);

    if (clickStarFilter(nextFilter)) {
        await waitForPageLoad();
        await delay(2000);
        // After filter switch, scrapeCurrentPage will be called again by URL change detection
    } else {
        log(`❌ Failed to switch to ${STAR_LABELS[nextFilter]} - stopping`, 'error');
        session.isActive = false;
        saveSession(session);
        chrome.storage.local.set({ isScanning: false });
        alert(`Error: Could not switch to ${STAR_LABELS[nextFilter]}.\nScraping stopped.`);
    }
}

// ===== AUTO-REDIRECT FROM PRODUCT PAGE =====

async function checkProductPageRedirect(): Promise<boolean> {
    if (window.location.pathname.includes('/dp/') && !window.location.pathname.includes('/product-reviews/')) {
        log('📍 On product page - looking for "See all reviews" link...', 'info');

        const seeAllLink = document.querySelector('a[data-hook="see-all-reviews-link-foot"]') as HTMLAnchorElement;
        if (seeAllLink) {
            log('🔗 Redirecting to reviews page...', 'success');
            window.location.href = seeAllLink.href;
            return true;
        }
    }
    return false;
}

// ===== MAIN CONTROLLER =====

let lastProcessedUrl = '';
let isProcessing = false;

async function mainController(): Promise<void> {
    // Prevent duplicate runs
    if (isProcessing) {
        return;
    }

    // Check if page structure is ready
    const reviewsExist = document.querySelectorAll('li[data-hook="review"]').length > 0;
    const noReviewsMessage = document.querySelector('.no-reviews-section');

    if (!reviewsExist && !noReviewsMessage) {
        // Page not ready yet
        return;
    }

    // Check for CAPTCHA
    if (detectCaptcha()) {
        log('🛑 CAPTCHA detected! Please solve manually.', 'error');
        alert('Amazon CAPTCHA detected!\n\nPlease solve the CAPTCHA manually.\nThe scraper will continue automatically after you solve it.');
        return;
    }

    isProcessing = true;

    try {
        // Get or restore session
        const session = await getOrCreateSession();

        if (!session.isActive) {
            isProcessing = false;
            return; // User hasn't started scraping
        }

        // Check if we need to redirect from product page
        if (await checkProductPageRedirect()) {
            isProcessing = false;
            return; // Will reload on reviews page
        }

        // Check if URL changed (avoid re-processing same page)
        const currentUrl = window.location.href;
        if (currentUrl === lastProcessedUrl) {
            isProcessing = false;
            return;
        }

        lastProcessedUrl = currentUrl;
        session.lastUrl = currentUrl;

        // Start scraping current page
        log(`🚀 Processing: ${STAR_LABELS[STAR_FILTERS[session.currentStarIndex]]} - Page ${getCurrentPageNumber()}`, 'info');
        await scrapeCurrentPage(session);

    } catch (error) {
        log(`❌ Error in main controller: ${error}`, 'error');
    } finally {
        isProcessing = false;
    }
}

// ===== INITIALIZATION =====

// Check every 1 second for page readiness
setInterval(mainController, 1000);

// Also run immediately if page is already loaded
if (document.readyState === 'complete') {
    setTimeout(mainController, 500);
} else {
    window.addEventListener('load', () => {
        setTimeout(mainController, 500);
    });
}

log('✅ Scraper initialized - waiting for start signal or session restore', 'success');
