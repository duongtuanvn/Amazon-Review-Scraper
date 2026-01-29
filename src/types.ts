// ===== REVIEW DATA TYPES =====

export type Review = {
    id: string;
    starRating: string;
    author: string;
    title: string;
    date: string;
    content: string;
    verified: boolean;
    variant: string;
    images: string[];
    starFilter?: string; // Which filter this review was collected from (e.g., "1★")
    pageNumber?: number; // Page number when collected
};

// ===== SCRAPING STATE TYPES =====

export type ScanStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export type ScrapeState = {
    status: ScanStatus;
    totalReviews: number;
    logs: string[];
};

// Session state for auto-resume across page reloads
export type ScrapeSession = {
    isActive: boolean;
    reviews: Review[];
    currentStarIndex: number; // Index in STAR_FILTERS array
    currentPage: number;
    lastUrl: string;
    startedAt: number;
    lastUpdated: number;
};

// ===== STAR FILTER CONSTANTS =====

export const STAR_FILTERS = ['one_star', 'two_star', 'three_star', 'four_star', 'five_star'] as const;
export type StarFilter = typeof STAR_FILTERS[number];

export const STAR_LABELS: Record<StarFilter, string> = {
    'one_star': '1★',
    'two_star': '2★',
    'three_star': '3★',
    'four_star': '4★',
    'five_star': '5★'
};
