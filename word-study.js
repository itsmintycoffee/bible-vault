// Word Study Feature with Concordance Integration

// Concordance index (maps words to Strong's numbers)
let concordanceIndex = null;
let concordanceCache = {};

// Load concordance index
async function loadConcordanceIndex() {
    if (concordanceIndex) return concordanceIndex;

    try {
        // Add cache-busting to ensure we get the latest index
        const cacheBuster = Date.now();
        const response = await fetch(`concordance/index.json?v=${cacheBuster}`);
        concordanceIndex = await response.json();
        console.log('Concordance index loaded:', Object.keys(concordanceIndex.hebrew).length, 'Hebrew words,', Object.keys(concordanceIndex.greek).length, 'Greek words');
        return concordanceIndex;
    } catch (error) {
        console.error('Failed to load concordance index:', error);
        return { hebrew: {}, greek: {} };
    }
}

// Load specific concordance entry
async function loadConcordanceEntry(strongsNumber) {
    // Check cache first
    if (concordanceCache[strongsNumber]) {
        return concordanceCache[strongsNumber];
    }

    try {
        const language = strongsNumber.startsWith('H') ? 'hebrew' : 'greek';
        const response = await fetch(`concordance/${language}/${strongsNumber}.json`);
        const data = await response.json();

        // Cache the result
        concordanceCache[strongsNumber] = data;
        return data;
    } catch (error) {
        console.log(`Concordance entry not found: ${strongsNumber}`);
        return null;
    }
}

// Initialize concordance on page load
loadConcordanceIndex();

// Check if word has a definition available
function hasDefinition(word) {
    if (!concordanceIndex) return false;

    const cleanWord = word.toLowerCase().replace(/[.,;:!?'"]/g, '');

    // Check in both Hebrew and Greek indexes
    return !!(concordanceIndex.hebrew[cleanWord] || concordanceIndex.greek[cleanWord]);
}

// Get word info from concordance (supports multi-translation via Hebrew/Greek bridge)
async function getWordInfo(word, verseRef = null, wordIndex = null) {
    const cleanWord = word.toLowerCase().replace(/[.,;:!?'"]/g, '');

    // Wait for index to load if not already loaded
    if (!concordanceIndex) {
        await loadConcordanceIndex();
    }

    // Check current translation
    const currentTranslation = translationManager.getCurrentTranslation();

    // For Bulgarian and other non-English/Hebrew/Greek translations, use Hebrew/Greek bridge
    if (currentTranslation.language !== 'English' &&
        currentTranslation.language !== 'Hebrew' &&
        currentTranslation.language !== 'Greek') {

        // Attempt to fetch Strong's number via Hebrew/Greek alignment
        if (verseRef && wordIndex !== null) {
            try {
                const strongsNumber = await getStrongsFromAlignment(verseRef, wordIndex);
                if (strongsNumber) {
                    const entry = await loadConcordanceEntry(strongsNumber);
                    if (entry) {
                        return {
                            english: entry.word || word,
                            translatedWord: word,
                            language: strongsNumber.startsWith('H') ? 'Hebrew' : 'Greek',
                            original: entry.original,
                            transliteration: entry.transliteration,
                            definition: entry.definition
                        };
                    }
                }
            } catch (error) {
                console.warn('Failed to fetch Strong\'s via alignment:', error);
            }
        }

        // Fallback message if alignment fails
        return {
            english: word,
            translatedWord: word,
            language: 'Not available',
            original: '—',
            transliteration: '—',
            definition: 'Word study data not available for this word.'
        };
    }

    // Direct lookup for English/Hebrew/Greek
    const strongsNumber = concordanceIndex.hebrew[cleanWord] || concordanceIndex.greek[cleanWord];

    if (strongsNumber) {
        const entry = await loadConcordanceEntry(strongsNumber);

        if (entry) {
            return {
                english: word,
                language: strongsNumber.startsWith('H') ? 'Hebrew' : 'Greek',
                original: entry.original,
                transliteration: entry.transliteration,
                definition: entry.definition
            };
        }
    }

    // Default response if not found
    return {
        english: word,
        language: 'Not available',
        original: '—',
        transliteration: '—',
        definition: 'Word study data not available for this word.'
    };
}

// Get Strong's number by aligning with Hebrew/Greek verse
async function getStrongsFromAlignment(verseRef, wordIndex) {
    try {
        // Parse verse reference (e.g., "Genesis 1:1")
        const match = verseRef.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
        if (!match) return null;

        const bookName = match[1];
        const chapter = match[2];
        const verse = match[3] || '1';

        // Determine if OT or NT to select Hebrew or Greek
        const bookNum = translationManager.getBookNumber(bookName);
        const isOldTestament = bookNum <= 39;
        const originalTranslation = isOldTestament ? 'wlca' : 'lxx';

        // Fetch original language verse
        const originalData = await translationManager.fetchVerse(verseRef);

        // Temporarily switch to original language to fetch that verse
        const savedTranslation = translationManager.currentTranslation;
        translationManager.currentTranslation = originalTranslation;
        const originalVerseData = await translationManager.fetchVerse(verseRef);
        translationManager.currentTranslation = savedTranslation;

        // Extract the specific verse text
        let originalVerseText = '';
        if (originalVerseData.verses && originalVerseData.verses.length > 0) {
            const verseNum = parseInt(verse);
            const verseObj = originalVerseData.verses.find(v => v.verse === verseNum);
            if (verseObj) {
                originalVerseText = verseObj.text;
            }
        }

        if (!originalVerseText) return null;

        // Parse Strong's numbers from the text
        // Hebrew/Greek text format: "וַיֹּ֤אמֶר H559 אֱלֹהִ֔ים H430"
        const words = originalVerseText.split(/\s+/);
        const strongsNumbers = [];

        for (const word of words) {
            // Check if word contains Strong's number (H#### or G####)
            const strongsMatch = word.match(/[HG]\d+/);
            if (strongsMatch) {
                strongsNumbers.push(strongsMatch[0]);
            }
        }

        // Return the Strong's number at the given word index
        if (wordIndex < strongsNumbers.length) {
            return strongsNumbers[wordIndex];
        }

        return null;
    } catch (error) {
        console.error('Error in getStrongsFromAlignment:', error);
        return null;
    }
}

// Common words to exclude from word study (stop words)
const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'should', 'could', 'may', 'might', 'must', 'can', 'shall',
    'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
    'she', 'we', 'they', 'them', 'their', 'his', 'her', 'my', 'your',
    'our', 'me', 'him', 'us', 'who', 'what', 'when', 'where', 'why',
    'how', 'which', 'there', 'here', 'then', 'than', 'so', 'if', 'because',
    'while', 'after', 'before', 'above', 'below', 'between', 'through',
    'during', 'into', 'upon', 'not', 'no', 'nor', 'all', 'any', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such'
]);

// Make verse text clickable (only for words with definitions)
async function makeWordsClickable(verseElement) {
    // Wait for concordance index to load
    if (!concordanceIndex) {
        await loadConcordanceIndex();
    }

    // Get verse reference from parent element
    const verseDiv = verseElement.closest('.verse');
    let verseRef = `${currentBook} ${currentChapter}`;
    if (verseDiv && verseDiv.querySelector('.verse-number')) {
        const verseNum = verseDiv.querySelector('.verse-number').textContent;
        verseRef = `${currentBook} ${currentChapter}:${verseNum}`;
    }

    // Use TreeWalker to process text nodes while preserving JEDP highlighting
    const walker = document.createTreeWalker(
        verseElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const textNodesToReplace = [];
    let textNode;
    while (textNode = walker.nextNode()) {
        textNodesToReplace.push(textNode);
    }

    // Track word index across all text nodes for alignment
    let wordIndex = 0;

    // Process text nodes in reverse to avoid invalidating walker
    for (let i = textNodesToReplace.length - 1; i >= 0; i--) {
        textNode = textNodesToReplace[i];
        const text = textNode.textContent;
        const tokens = text.split(/(\s+)/);

        const fragment = document.createDocumentFragment();

        for (const token of tokens) {
            // If it's whitespace, keep as text node
            if (/^\s+$/.test(token)) {
                fragment.appendChild(document.createTextNode(token));
                continue;
            }

            // Clean the word (remove punctuation for checking)
            const cleanWord = token.toLowerCase().replace(/[.,;:!?'"()]/g, '');

            // If it's a stop word or very short, don't make it clickable
            if (stopWords.has(cleanWord) || cleanWord.length <= 2) {
                fragment.appendChild(document.createTextNode(token));
                wordIndex++;
                continue;
            }

            // Make words clickable for all translations
            // English: direct lookup in concordance index
            // Hebrew/Greek: direct lookup
            // Other languages (Bulgarian): alignment with Hebrew/Greek
            const currentTranslation = translationManager.getCurrentTranslation();
            const isEnglish = currentTranslation.language === 'English';
            const shouldMakeClickable = !isEnglish || hasDefinition(cleanWord);

            if (shouldMakeClickable) {
                const span = document.createElement('span');
                span.className = 'word';
                span.setAttribute('data-word', cleanWord);
                span.setAttribute('data-verse-ref', verseRef);
                span.setAttribute('data-word-index', wordIndex);
                span.textContent = token;
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(token));
            }

            wordIndex++;
        }

        // Replace text node with fragment
        textNode.parentNode.replaceChild(fragment, textNode);
    }
}

// IQ Bible API configuration
const RAPIDAPI_KEY = 'b86dd98603msh385efa2e343f5e2p1f52abjsndb6dcffbbe60';
const RAPIDAPI_HOST = 'iq-bible.p.rapidapi.com';

// Create tooltip element
let tooltip = null;
let currentTooltipWord = null;

// Initialize word study functionality
function initWordStudy() {
    // Create tooltip element
    tooltip = document.createElement('div');
    tooltip.className = 'word-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong id="tooltip-word"></strong>
        </div>
        <div class="tooltip-body">
            <div class="tooltip-row">
                <span class="tooltip-label">Original Language:</span>
                <span id="tooltip-language"></span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Original Spelling:</span>
                <span id="tooltip-original" class="original-text"></span>
            </div>
            <div class="tooltip-row">
                <span class="tooltip-label">Transliteration:</span>
                <span id="tooltip-transliteration"></span>
            </div>
            <div class="tooltip-section">
                <span class="tooltip-label">Definition:</span>
                <p id="tooltip-definition"></p>
            </div>
        </div>
    `;
    document.body.appendChild(tooltip);

    // Handle word hover events
    document.addEventListener('mouseenter', async (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('word')) {
            const word = e.target.dataset.word;
            const verseRef = e.target.dataset.verseRef;
            const wordIndex = parseInt(e.target.dataset.wordIndex);
            await showTooltip(word, e, verseRef, wordIndex);
        }
    }, true); // Use capture phase to catch events on dynamically added elements

    document.addEventListener('mouseleave', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('word')) {
            // Delay hiding to allow moving mouse to tooltip
            setTimeout(() => {
                if (tooltip && !tooltip.matches(':hover')) {
                    hideTooltip();
                }
            }, 100);
        }
    }, true);

    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        tooltip.dataset.hovering = 'true';
    });

    tooltip.addEventListener('mouseleave', () => {
        tooltip.dataset.hovering = 'false';
        hideTooltip();
    });
}

// Fetch word info from IQ Bible API
async function fetchWordFromAPI(word) {
    try {
        // Try to search for the word using GetStrongs endpoint
        // Note: This is a simplified approach - you may need to adjust based on API response
        const response = await fetch(`https://${RAPIDAPI_HOST}/GetStrongs?word=${encodeURIComponent(word)}`, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': RAPIDAPI_HOST,
                'x-rapidapi-key': RAPIDAPI_KEY
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Parse the API response and return formatted data
            // This will depend on the actual API response structure
            return data;
        }
    } catch (error) {
        console.log('API fetch failed, using local database:', error);
    }
    return null;
}

// Show tooltip
async function showTooltip(word, event, verseRef = null, wordIndex = null) {
    currentTooltipWord = word;

    // Show loading state
    tooltip.querySelector('#tooltip-word').textContent = word;
    tooltip.querySelector('#tooltip-language').textContent = 'Loading...';
    tooltip.querySelector('#tooltip-original').textContent = '';
    tooltip.querySelector('#tooltip-transliteration').textContent = '';
    tooltip.querySelector('#tooltip-definition').textContent = 'Fetching word data...';

    positionTooltip(event);
    tooltip.style.opacity = '1';

    // Try to fetch from API first, then fall back to local database
    const apiData = await fetchWordFromAPI(word);

    let wordInfo;
    if (apiData) {
        // Use API data if available
        wordInfo = parseAPIResponse(apiData, word);
    } else {
        // Fall back to local database with verse reference and word index for translation support
        wordInfo = await getWordInfo(word, verseRef, wordIndex);
    }

    // Update tooltip with actual data (only if still showing same word)
    if (currentTooltipWord === word) {
        tooltip.querySelector('#tooltip-word').textContent = wordInfo.translatedWord || wordInfo.english;
        tooltip.querySelector('#tooltip-language').textContent = wordInfo.language;
        tooltip.querySelector('#tooltip-original').textContent = wordInfo.original;
        tooltip.querySelector('#tooltip-transliteration').textContent = wordInfo.transliteration;
        tooltip.querySelector('#tooltip-definition').textContent = wordInfo.definition;
    }
}

// Parse API response into our format
function parseAPIResponse(data, word) {
    // This function will need to be adjusted based on actual API response structure
    // For now, return a placeholder structure
    return {
        english: word,
        language: data.language || 'Unknown',
        original: data.original || '—',
        transliteration: data.transliteration || '—',
        definition: data.definition || 'Data from IQ Bible API'
    };
}

// Hide tooltip
function hideTooltip() {
    if (tooltip && tooltip.dataset.hovering !== 'true') {
        tooltip.style.opacity = '0';
        currentTooltipWord = null;
    }
}

// Position tooltip near clicked word
function positionTooltip(event) {
    const padding = 20;
    const tooltipRect = tooltip.getBoundingClientRect();
    const targetRect = event.target.getBoundingClientRect();

    // Position below the clicked word
    let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    let top = targetRect.bottom + padding;

    // Keep tooltip within viewport (horizontal)
    if (left < padding) {
        left = padding;
    } else if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
    }

    // If tooltip would go off bottom of screen, position above word instead
    if (top + tooltipRect.height > window.innerHeight - padding) {
        top = targetRect.top - tooltipRect.height - padding;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initWordStudy);
