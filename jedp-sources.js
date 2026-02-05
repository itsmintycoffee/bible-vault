// Documentary Hypothesis Source Attribution
// Color-codes verses according to JEDP theory
// Format: {"Book Chapter": {"Source": [verses...], ...}, ...}

let jedpData = {};

// Load JEDP source data for a specific book
async function loadJEDPData(book) {
    if (jedpData[book]) return jedpData[book];

    try {
        const bookLower = book.toLowerCase();
        const response = await fetch(`sources/${bookLower}-jedp.json`);
        if (!response.ok) {
            console.log(`JEDP data not available for ${book}`);
            return {};
        }
        const data = await response.json();
        jedpData[book] = data;
        console.log(`JEDP source data loaded for ${book}:`, Object.keys(data).length, 'chapters');
        return data;
    } catch (error) {
        console.log(`JEDP data error for ${book}:`, error);
        return {};
    }
}

// Get source for a specific verse reference
function getVerseSource(book, chapter, verse) {
    const chapterKey = `${book} ${chapter}`;  // Key format: "Genesis 1"
    const chapterData = jedpData[book]?.[chapterKey];
    
    if (!chapterData) return null;
    
    // Find which source contains this verse
    for (const [source, verses] of Object.entries(chapterData)) {
        if (Array.isArray(verses) && verses.includes(verse)) {
            return source;
        }
    }
    return null;
}

// Apply JEDP color-coding to verses
function applyJEDPSources(verseElements) {
    verseElements.forEach(verseElement => {
        // Try to extract verse reference from context
        // The verse element is within a chapter, and has a verse number
        const verseNumber = verseElement.querySelector('.verse-number');
        if (!verseNumber) return;

        // Get chapter reference from parent
        const chapterSection = verseElement.closest('.chapter-section');
        if (!chapterSection) return;

        const chapterTitle = chapterSection.querySelector('.chapter-title');
        if (!chapterTitle) return;

        // Extract book and chapter (e.g., "Genesis 1")
        const chapterRef = chapterTitle.textContent.trim();
        const verseNumText = verseNumber.textContent.trim();
        const verseNum = parseInt(verseNumText, 10);

        // Parse book and chapter from "Genesis 1" format
        const parts = chapterRef.split(' ');
        let chapter = parts[parts.length - 1];
        let book = parts.slice(0, -1).join(' ');
        
        chapter = parseInt(chapter, 10);

        // Get source
        const source = getVerseSource(book, chapter, verseNum);

        if (source) {
            // Add source class to verse
            verseElement.classList.add(`source-${source}`);

            // Optionally add a data attribute
            verseElement.dataset.source = source;
        }
    });
}

// Initialize JEDP on page load with current book
// This function should be called after verses are displayed
async function initializeJEDP() {
    // Extract book name from the page (from first chapter title)
    const firstChapter = document.querySelector('.chapter-title');
    if (firstChapter) {
        const chapterRef = firstChapter.textContent.trim();
        const parts = chapterRef.split(' ');
        const book = parts.slice(0, -1).join(' ');
        await loadJEDPData(book);
    }

    // Apply to existing verses
    const verses = document.querySelectorAll('.verse');
    if (verses.length > 0) {
        applyJEDPSources(verses);
    }
}

// Export for use in bible.js
if (typeof window !== 'undefined') {
    window.loadJEDPData = loadJEDPData;
    window.initializeJEDP = initializeJEDP;
    window.applyJEDPSources = applyJEDPSources;
}
