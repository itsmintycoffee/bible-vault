// Documentary Hypothesis Source Attribution
// Color-codes verses according to JEDP theory
// Format: {"Book Chapter": {"Source": [verses...], ...}, ...}

let jedpData = {};

// Load JEDP source data for a specific book
async function loadJEDPData(book) {
    if (jedpData[book]) {
        console.log(`JEDP data already loaded for ${book}`);
        return jedpData[book];
    }

    try {
        const bookLower = book.toLowerCase();
        const response = await fetch(`sources/${bookLower}-jedp.json`);
        if (!response.ok) {
            console.log(`JEDP data not available for ${book}: ${response.status}`);
            return {};
        }
        const data = await response.json();
        jedpData[book] = data;
        console.log(`✓ JEDP source data loaded for ${book}:`, Object.keys(data).length, 'chapters');
        return data;
    } catch (error) {
        console.log(`JEDP data error for ${book}:`, error);
        return {};
    }
}

// Get source for a specific verse reference
function getVerseSource(book, chapter, verse) {
    const chapterKey = `${book} ${chapter}`;  // Key format: "Genesis 1"
    const bookData = jedpData[book];
    
    if (!bookData) return null;
    
    const chapterData = bookData[chapterKey];
    if (!chapterData) return null;
    
    // Find which source contains this verse
    for (const [source, verses] of Object.entries(chapterData)) {
        if (Array.isArray(verses) && verses.includes(verse)) {
            return source;
        }
    }
    return null;
}

// Helper: Add source class to words while preserving existing structure
function wrapWordsWithSource(container, source) {
    // Use TreeWalker to find text nodes
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const textNodesToReplace = [];
    let textNode;
    while (textNode = walker.nextNode()) {
        textNodesToReplace.push(textNode);
    }

    // Process text nodes in reverse to avoid invalidating walker
    for (let i = textNodesToReplace.length - 1; i >= 0; i--) {
        textNode = textNodesToReplace[i];
        const text = textNode.textContent;
        const regex = /(\S+|\s+)/g;
        let match;
        const fragment = document.createDocumentFragment();
        
        while ((match = regex.exec(text)) !== null) {
            const token = match[0];
            
            if (/\s/.test(token)) {
                // Whitespace
                fragment.appendChild(document.createTextNode(token));
            } else {
                // Word: wrap in source span
                const span = document.createElement('span');
                span.className = `source-${source}`;
                span.textContent = token;
                fragment.appendChild(span);
            }
        }
        
        // Replace text node with fragment
        textNode.parentNode.replaceChild(fragment, textNode);
    }
}

// Apply JEDP color-coding to individual words in verses
function applyJEDPSources(verseElements) {
    console.log(`applyJEDPSources: Processing ${verseElements ? verseElements.length : 0} verses`);
    
    if (!verseElements || verseElements.length === 0) {
        console.log('No verse elements found!');
        return;
    }
    
    let coloredCount = 0;
    
    verseElements.forEach((verseElement) => {
        // Try to extract verse reference from context
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
            // Get the verse text span and wrap all words with source class
            const verseTextSpan = verseElement.querySelector('.verse-text');
            if (verseTextSpan) {
                wrapWordsWithSource(verseTextSpan, source);
                verseElement.dataset.source = source;
                coloredCount++;
            }
        }
    });
    
    console.log(`✓ JEDP: Colored ${coloredCount}/${verseElements.length} verses`);
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
