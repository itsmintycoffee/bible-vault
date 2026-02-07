// Word Study Feature with Concordance Integration
console.log('[WORD-STUDY] Script loaded at:', new Date().toISOString());

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

// Extract Strong's numbers from original language text
function extractStrongsNumbers(rawText) {
    if (!rawText) return [];

    // Pattern matches H#### or G#### (Hebrew or Greek Strong's numbers)
    const strongsPattern = /[HG]\d{1,5}/g;
    const matches = rawText.match(strongsPattern) || [];

    return matches;
}

// Get word info from concordance using Strong's number
async function getWordInfoByStrongsNumber(strongsNumber, word) {
    if (strongsNumber) {
        const entry = await loadConcordanceEntry(strongsNumber);

        if (entry) {
            return {
                english: word,
                strongsNumber: strongsNumber,
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
        strongsNumber: strongsNumber || 'N/A',
        language: 'Not available',
        original: '—',
        transliteration: '—',
        definition: 'Word study data not available for this word.'
    };
}

// Get word info from concordance (fallback to index-based lookup)
async function getWordInfo(word, strongsNumber = null) {
    const cleanWord = word.toLowerCase().replace(/[.,;:!?'"]/g, '');

    // If we have a Strong's number, use it directly
    if (strongsNumber) {
        return await getWordInfoByStrongsNumber(strongsNumber, word);
    }

    // Otherwise, fall back to index-based lookup (less reliable)
    // Wait for index to load if not already loaded
    if (!concordanceIndex) {
        await loadConcordanceIndex();
    }

    // Find Strong's number from index
    const indexedStrongsNumber = concordanceIndex.hebrew[cleanWord] || concordanceIndex.greek[cleanWord];

    return await getWordInfoByStrongsNumber(indexedStrongsNumber, word);
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

// Make verse text clickable with Strong's number mapping
async function makeWordsClickable(verseElement, translationType = 'english') {
    console.log('[WORD-STUDY] makeWordsClickable called');

    // Get the verse number from this verse element
    // Works for both single-view (.verse) and comparison mode (.verse-column)
    let verseNumberElem = verseElement.closest('.verse')?.querySelector('.verse-number');
    if (!verseNumberElem) {
        // Try comparison mode structure
        verseNumberElem = verseElement.closest('.verse-column')?.querySelector('.verse-number');
    }
    const verseNumber = verseNumberElem ? parseInt(verseNumberElem.textContent) : null;

    console.log(`[WORD-STUDY] Processing verse ${verseNumber} with translation type: ${translationType}`);

    // Get original language data from the chapter
    const chapterSection = verseElement.closest('.chapter-section');
    let originalVerseData = null;
    let strongsNumbers = [];

    // Determine if this is an original language text (Hebrew/Greek)
    const isOriginalLanguage = translationType === 'wlca' || translationType === 'lxx' ||
                               translationType === 'hebrew' || translationType === 'greek';

    if (isOriginalLanguage) {
        // For Hebrew/Greek, extract Strong's numbers from the verse text itself
        const rawText = verseElement.textContent;
        strongsNumbers = extractStrongsNumbers(rawText);
        console.log(`Original language verse ${verseNumber} Strong's numbers:`, strongsNumbers);
    } else if (chapterSection && chapterSection.dataset.originalLanguageData) {
        // For translations (English, Bulgarian), use mapped Strong's numbers from original language
        try {
            const originalData = JSON.parse(chapterSection.dataset.originalLanguageData);
            // Find the verse with matching verse number
            if (originalData && originalData.verses) {
                originalVerseData = originalData.verses.find(v => v.verse === verseNumber);
                if (originalVerseData && originalVerseData.rawText) {
                    strongsNumbers = extractStrongsNumbers(originalVerseData.rawText);
                    console.log(`Verse ${verseNumber} Strong's numbers from original:`, strongsNumbers);
                }
            }
        } catch (error) {
            console.log('Error parsing original language data:', error);
        }
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

    let wordIndex = 0; // Track word position for Strong's number mapping

    // Process text nodes in reverse to avoid invalidating walker
    for (let i = textNodesToReplace.length - 1; i >= 0; i--) {
        textNode = textNodesToReplace[i];
        const text = textNode.textContent;

        const fragment = document.createDocumentFragment();

        if (isOriginalLanguage) {
            // For Hebrew/Greek: Extract words with embedded Strong's numbers
            // Pattern: word followed by optional Strong's number (e.g., "בְּרֵאשִׁ֖יתH7225")
            const wordPattern = /([^\s]+?)([HG]\d{1,5})?(\s+)/g;
            let match;
            let lastIndex = 0;

            while ((match = wordPattern.exec(text)) !== null) {
                const originalWord = match[1]; // The Hebrew/Greek word
                const strongsNum = match[2] || null; // The Strong's number if present
                const whitespace = match[3]; // Whitespace after the word

                // Create clickable span for the original word
                if (strongsNum) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.setAttribute('data-word', originalWord);
                    span.setAttribute('data-strongs', strongsNum);
                    span.setAttribute('data-original-language', 'true');
                    span.textContent = originalWord; // Display only the word, not the Strong's number
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(originalWord));
                }

                fragment.appendChild(document.createTextNode(whitespace));
                lastIndex = wordPattern.lastIndex;
            }

            // Add any remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }
        } else {
            // For translations (English, Bulgarian): Use position-based mapping
            const tokens = text.split(/(\s+)/);

            for (const token of tokens) {
                // If it's whitespace, keep as text node
                if (/^\s+$/.test(token)) {
                    fragment.appendChild(document.createTextNode(token));
                    continue;
                }

                // Clean the word (remove punctuation for checking)
                const cleanWord = token.toLowerCase().replace(/[.,;:!?'"()]/g, '');

                // For Bulgarian, don't use stop words filter (it's in Cyrillic)
                const isBulgarian = translationType === 'bulgarian' || translationType === 'bulgarian1940';
                const isStopWord = !isBulgarian && (stopWords.has(cleanWord) || cleanWord.length <= 2);

                // Get corresponding Strong's number if available (before stop word check)
                const strongsNum = strongsNumbers[wordIndex] || null;

                if (strongsNum) {
                    console.log(`[WORD-STUDY] Word #${wordIndex}: "${token}" -> ${strongsNum}`);
                }

                if (isStopWord) {
                    // Stop words don't have Hebrew/Greek equivalents, so don't increment index
                    fragment.appendChild(document.createTextNode(token));
                    continue;
                }

                // Make it clickable if we have a Strong's number OR if we have a definition in the index
                if (strongsNum || (!isBulgarian && hasDefinition(cleanWord))) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.setAttribute('data-word', isBulgarian ? token : cleanWord);
                    if (strongsNum) {
                        span.setAttribute('data-strongs', strongsNum);
                    }
                    span.textContent = token;
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(token));
                }

                // Only increment index for non-stop words (words that have Hebrew/Greek equivalents)
                wordIndex++;
            }
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
let tooltipShowTimeout = null;
let tooltipHideTimeout = null;

// Initialize word study functionality
function initWordStudy() {
    // Create tooltip element
    tooltip = document.createElement('div');
    tooltip.className = 'word-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong id="tooltip-word"></strong>
            <span id="tooltip-strongs" style="color: var(--text-secondary); font-size: 0.85em; margin-left: 0.5rem;"></span>
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
            // Clear any pending hide timeout
            if (tooltipHideTimeout) {
                clearTimeout(tooltipHideTimeout);
                tooltipHideTimeout = null;
            }

            const word = e.target.dataset.word;
            const strongsNumber = e.target.dataset.strongs || null;
            const isOriginalLanguage = e.target.dataset.originalLanguage === 'true';

            // Add a small delay before showing (200ms) to avoid accidental triggers
            tooltipShowTimeout = setTimeout(async () => {
                await showTooltip(word, e, strongsNumber, isOriginalLanguage);
            }, 200);
        }
    }, true); // Use capture phase to catch events on dynamically added elements

    document.addEventListener('mouseleave', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('word')) {
            // Clear any pending show timeout
            if (tooltipShowTimeout) {
                clearTimeout(tooltipShowTimeout);
                tooltipShowTimeout = null;
            }

            // Delay hiding to allow moving mouse to tooltip (500ms for generous time)
            tooltipHideTimeout = setTimeout(() => {
                if (tooltip && !tooltip.matches(':hover') && tooltip.dataset.hovering !== 'true') {
                    hideTooltip();
                }
            }, 500);
        }
    }, true);

    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        // Clear any pending hide timeout
        if (tooltipHideTimeout) {
            clearTimeout(tooltipHideTimeout);
            tooltipHideTimeout = null;
        }
        tooltip.dataset.hovering = 'true';
    });

    tooltip.addEventListener('mouseleave', () => {
        tooltip.dataset.hovering = 'false';
        // Give a bit of time in case mouse goes back to tooltip
        tooltipHideTimeout = setTimeout(() => {
            hideTooltip();
        }, 300);
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
async function showTooltip(word, event, strongsNumber = null, isOriginalLanguage = false) {
    currentTooltipWord = word;

    // For original language, show the word as the "original spelling"
    const displayWord = isOriginalLanguage ? 'Original Word' : word;

    // Show loading state
    tooltip.querySelector('#tooltip-word').textContent = displayWord;
    tooltip.querySelector('#tooltip-strongs').textContent = strongsNumber ? `(${strongsNumber})` : '';
    tooltip.querySelector('#tooltip-language').textContent = 'Loading...';
    tooltip.querySelector('#tooltip-original').textContent = isOriginalLanguage ? word : '';
    tooltip.querySelector('#tooltip-transliteration').textContent = '';
    tooltip.querySelector('#tooltip-definition').textContent = 'Fetching word data...';

    positionTooltip(event);
    tooltip.style.opacity = '1';

    // Use Strong's number if available, otherwise fall back to word lookup
    const wordInfo = await getWordInfo(word, strongsNumber);

    // Update tooltip with actual data (only if still showing same word)
    if (currentTooltipWord === word) {
        // For original language, show the actual word as the original spelling
        if (isOriginalLanguage) {
            tooltip.querySelector('#tooltip-word').textContent = 'Original Word';
            tooltip.querySelector('#tooltip-original').textContent = word;
        } else {
            tooltip.querySelector('#tooltip-word').textContent = wordInfo.english;
            tooltip.querySelector('#tooltip-original').textContent = wordInfo.original;
        }

        tooltip.querySelector('#tooltip-strongs').textContent = wordInfo.strongsNumber ? `(${wordInfo.strongsNumber})` : '';
        tooltip.querySelector('#tooltip-language').textContent = wordInfo.language;
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
    // Clear any pending timeouts
    if (tooltipShowTimeout) {
        clearTimeout(tooltipShowTimeout);
        tooltipShowTimeout = null;
    }
    if (tooltipHideTimeout) {
        clearTimeout(tooltipHideTimeout);
        tooltipHideTimeout = null;
    }

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
