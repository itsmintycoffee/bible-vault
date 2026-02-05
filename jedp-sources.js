// Documentary Hypothesis Source Attribution
// Color-codes verses according to JEDP theory

let jedpData = null;

// Load JEDP source data
async function loadJEDPData() {
    if (jedpData) return jedpData;

    try {
        const response = await fetch('sources/genesis-jedp.json');
        jedpData = await response.json();
        console.log('JEDP source data loaded:', Object.keys(jedpData).length, 'verses');
        return jedpData;
    } catch (error) {
        console.log('JEDP data not available:', error);
        return {};
    }
}

// Get source for a specific verse reference
function getVerseSource(reference) {
    if (!jedpData) return null;

    // Normalize reference (e.g., "Genesis 1:1" -> "Genesis 1:1")
    const normalized = reference.trim();
    return jedpData[normalized] || null;
}

// Apply JEDP color-coding to verses
function applyJEDPSources(verseElements) {
    if (!jedpData) return;

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
        const verseNum = verseNumber.textContent.trim();

        // Build full reference (e.g., "Genesis 1:1")
        const fullReference = `${chapterRef}:${verseNum}`;

        // Get source
        const source = getVerseSource(fullReference);

        if (source) {
            // Add source class to verse
            verseElement.classList.add(`source-${source}`);

            // Optionally add a data attribute
            verseElement.dataset.source = source;
        }
    });
}

// Initialize JEDP on page load
loadJEDPData();

// Observe when verses are loaded and apply sources
// This function should be called after verses are displayed
async function initializeJEDP() {
    await loadJEDPData();

    // Apply to existing verses
    const verses = document.querySelectorAll('.verse');
    if (verses.length > 0) {
        applyJEDPSources(verses);
    }
}

// Export for use in bible.js
if (typeof window !== 'undefined') {
    window.initializeJEDP = initializeJEDP;
    window.applyJEDPSources = applyJEDPSources;
}
