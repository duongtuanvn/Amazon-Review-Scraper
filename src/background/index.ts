import { ScrapeSession } from '../types';

/**
 * ═══════════════════════════════════════════════════════════════
 * AMAZON REVIEW SCRAPER - Background Service Worker
 * 
 * Responsibilities:
 * - Coordinate between popup and content script via messaging
 * - Persist scraping state to chrome.storage
 * - Handle CSV export generation
 * ═══════════════════════════════════════════════════════════════
 */

console.log('🔧 Background Service Worker Started');

// ===== MESSAGE HANDLING =====

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            switch (message.type) {
                case 'START_SCRAPING':
                    await handleStartScraping();
                    sendResponse({ success: true });
                    break;

                case 'STOP_SCRAPING':
                    await handleStopScraping();
                    sendResponse({ success: true });
                    break;

                case 'GET_STATUS':
                    const status = await getScrapingStatus();
                    sendResponse(status);
                    break;

                case 'REVIEWS_UPDATE':
                    // Forward review updates to popup
                    broadcastMessage({
                        type: 'STATS_UPDATED',
                        payload: message.payload
                    });
                    break;

                case 'LOG_MESSAGE':
                    // Forward logs to popup
                    broadcastMessage({
                        type: 'LOG',
                        payload: message.payload
                    });
                    break;

                case 'SCRAPING_COMPLETE':
                    await handleScrapingComplete(message.payload.total);
                    break;

                case 'WAITING_STATUS':
                    // Forward waiting status to popup
                    broadcastMessage(message);
                    break;

                case 'DOWNLOAD_CSV':
                    const csvData = await handleDownloadCSV();
                    sendResponse(csvData);
                    break;

                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: String(error) });
        }
    })();

    return true; // Keep channel open for async response
});

// ===== SCRAPING LIFECYCLE =====

async function handleStartScraping(): Promise<void> {
    console.log('▶️ Starting scraping session');

    await chrome.storage.local.set({ isScanning: true });

    // Reload current tab to trigger content script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
        await chrome.tabs.reload(tabs[0].id);
    }

    broadcastMessage({
        type: 'SCRAPING_STARTED',
        payload: {}
    });
}

async function handleStopScraping(): Promise<void> {
    console.log('⏹️ Stopping scraping session');

    await chrome.storage.local.set({ isScanning: false });

    broadcastMessage({
        type: 'SCRAPING_STOPPED',
        payload: {}
    });
}

async function handleScrapingComplete(totalReviews: number): Promise<void> {
    console.log(`✅ Scraping completed: ${totalReviews} reviews`);

    await chrome.storage.local.set({ isScanning: false });

    broadcastMessage({
        type: 'SCRAPING_COMPLETE',
        payload: { total: totalReviews }
    });
}

async function getScrapingStatus(): Promise<{ isScanning: boolean; total: number }> {
    const { isScanning, amazon_scraper_session } = await chrome.storage.local.get(['isScanning', 'amazon_scraper_session']);

    const session = amazon_scraper_session as ScrapeSession | undefined;

    return {
        isScanning: isScanning || false,
        total: session?.reviews.length || 0
    };
}

// ===== CSV EXPORT =====

async function handleDownloadCSV(): Promise<{ success: boolean; csv?: string; error?: string }> {
    try {
        const { amazon_scraper_session } = await chrome.storage.local.get('amazon_scraper_session');
        const session = amazon_scraper_session as ScrapeSession | undefined;

        if (!session || session.reviews.length === 0) {
            return { success: false, error: 'No reviews to export' };
        }

        const headers = ['Star Filter', 'Page', 'ID', 'Author', 'Rating', 'Title', 'Date', 'Variant', 'Verified', 'Review Body'];
        const rows = session.reviews.map(r => [
            r.starFilter || 'N/A',
            r.pageNumber?.toString() || 'N/A',
            `"${r.id.replace(/"/g, '""')}"`,
            `"${r.author.replace(/"/g, '""')}"`,
            `"${r.starRating}"`,
            `"${r.title.replace(/"/g, '""')}"`,
            `"${r.date}"`,
            `"${r.variant}"`,
            r.verified ? 'Yes' : 'No',
            `"${r.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        // Add UTF-8 BOM for proper star symbol encoding in Excel/Google Sheets
        const BOM = '\uFEFF';

        return { success: true, csv: BOM + csvContent };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

// ===== UTILITY FUNCTIONS =====

function broadcastMessage(message: any): void {
    chrome.runtime.sendMessage(message).catch(() => {
        // Popup might not be open, that's OK
    });
}
