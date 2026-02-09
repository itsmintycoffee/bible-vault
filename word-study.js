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

// Parse original language rawText into structured word-strongs pairs
// rawText format from Bolls API: "בְרֵאשִׁית7225 בָּרָא1254 אֱלֹהִים430 ..."
// (bare numbers, no H/G prefix)
function parseOriginalWords(rawText, isOT = true) {
    if (!rawText) return [];
    const prefix = isOT ? 'H' : 'G';
    const pairs = [];
    // Match: Hebrew/Greek word chars (with diacritics) followed by digits
    // Hebrew range: \u0590-\u05FF, accents/marks: \u0300-\u036F, cantillation: \u0591-\u05AF
    // Greek range: \u0370-\u03FF, \u1F00-\u1FFF
    const pattern = /([\u0590-\u05FF\u0300-\u036F\u0370-\u03FF\u1F00-\u1FFF\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u200D־]+?)(\d{1,5})(?=\s|$|[\u0590-\u05FF\u0370-\u03FF])/g;
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
        pairs.push({ word: match[1], strongs: `${prefix}${match[2]}` });
    }
    // Also handle H####/G#### prefixed format as fallback
    const prefixedPattern = /([\u0590-\u05FF\u0300-\u036F\u0370-\u03FF\u1F00-\u1FFF\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u200D־]+?)([HG]\d{1,5})(?=\s|$)/g;
    if (pairs.length === 0) {
        while ((match = prefixedPattern.exec(rawText)) !== null) {
            pairs.push({ word: match[1], strongs: match[2] });
        }
    }
    return pairs;
}

// Build a reverse map: English word -> {strongs, hebrewWord, entry}
// Uses concordance definitions to match English translations to Hebrew/Greek originals
async function buildVerseWordMap(pairs) {
    const verseMap = new Map();
    // Load all concordance entries in parallel
    const entries = await Promise.all(pairs.map(p => loadConcordanceEntry(p.strongs)));

    for (let i = 0; i < pairs.length; i++) {
        const entry = entries[i];
        if (!entry) continue;
        const pair = pairs[i];

        // Extract English translation keywords from concordance entry
        const keywords = new Set();
        // From "word" field (e.g., "first: best" or "(Jerusalem of) the Lord")
        if (entry.word) {
            entry.word.split(/[,;:()\s]+/).forEach(w => {
                w = w.toLowerCase().trim();
                if (w && w.length > 1) keywords.add(w);
            });
        }
        // From "kjvUsage" field
        if (entry.kjvUsage) {
            entry.kjvUsage.split(/[,;:()\s]+/).forEach(w => {
                w = w.toLowerCase().trim();
                if (w && w.length > 1) keywords.add(w);
            });
        }
        // From "definition" - extract meaningful words
        if (entry.definition) {
            const defWords = entry.definition.match(/\b[a-zA-Z]{3,}\b/g);
            if (defWords) {
                defWords.forEach(w => keywords.add(w.toLowerCase()));
            }
        }

        // Map each keyword to this Strong's entry (first match wins per word)
        for (const kw of keywords) {
            if (!verseMap.has(kw)) {
                verseMap.set(kw, {
                    strongs: pair.strongs,
                    originalWord: pair.word,
                    entry: entry
                });
            }
        }
    }
    return verseMap;
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
async function makeWordsClickable(verseElement, translationType = 'english', isOT = true) {
    // Get the verse number from this verse element
    let verseNumberElem = verseElement.closest('.verse')?.querySelector('.verse-number');
    if (!verseNumberElem) {
        verseNumberElem = verseElement.closest('.verse-column')?.querySelector('.verse-number');
    }
    const verseNumber = verseNumberElem ? parseInt(verseNumberElem.textContent) : null;

    // Get original language data from the chapter
    const chapterSection = verseElement.closest('.chapter-section');
    let verseWordMap = null; // Map of english word -> {strongs, originalWord, entry}

    // Determine if this is an original language text (Hebrew/Greek)
    const isOriginalLanguage = translationType === 'wlca' || translationType === 'lxx' ||
                               translationType === 'hebrew' || translationType === 'greek';

    if (!isOriginalLanguage && chapterSection && chapterSection.dataset.originalLanguageData) {
        // For translations: build reverse map from Hebrew/Greek original data
        try {
            const originalData = JSON.parse(chapterSection.dataset.originalLanguageData);
            if (originalData && originalData.verses) {
                const originalVerseData = originalData.verses.find(v => v.verse === verseNumber);
                if (originalVerseData && originalVerseData.rawText) {
                    const pairs = parseOriginalWords(originalVerseData.rawText, isOT);
                    if (pairs.length > 0) {
                        verseWordMap = await buildVerseWordMap(pairs);
                    }
                }
            }
        } catch (error) {
            console.error('[WORD-STUDY] Error building verse word map:', error);
        }
    }

    // Use TreeWalker to process text nodes while preserving JEDP highlighting
    const walker = document.createTreeWalker(verseElement, NodeFilter.SHOW_TEXT, null, false);
    const textNodesToReplace = [];
    let textNode;
    while (textNode = walker.nextNode()) {
        textNodesToReplace.push(textNode);
    }

    // Process text nodes in reverse to avoid invalidating walker
    for (let i = textNodesToReplace.length - 1; i >= 0; i--) {
        textNode = textNodesToReplace[i];
        const text = textNode.textContent;
        const fragment = document.createDocumentFragment();

        if (isOriginalLanguage) {
            // For Hebrew/Greek: parse words with their Strong's numbers from displayed text
            const originalPairs = parseOriginalWords(text, isOT);
            let lastIndex = 0;
            // Process each token in the text
            const tokens = text.split(/(\s+)/);
            for (const token of tokens) {
                if (/^\s+$/.test(token)) {
                    fragment.appendChild(document.createTextNode(token));
                    continue;
                }
                // Find matching pair for this token (strip digits to match)
                const cleanToken = token.replace(/\d+$/, '').replace(/[HG]\d+$/, '');
                const pair = originalPairs.find(p => p.word === cleanToken);
                if (pair) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.setAttribute('data-word', cleanToken);
                    span.setAttribute('data-strongs', pair.strongs);
                    span.setAttribute('data-original-language', 'true');
                    span.textContent = cleanToken;
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(token));
                }
            }
        } else {
            // For translations (English, Bulgarian): use verse word map for matching
            const tokens = text.split(/(\s+)/);
            const isBulgarian = translationType === 'bulgarian' || translationType === 'bulgarian1940';

            for (const token of tokens) {
                if (/^\s+$/.test(token)) {
                    fragment.appendChild(document.createTextNode(token));
                    continue;
                }

                const cleanWord = token.toLowerCase().replace(/[.,;:!?'"()]/g, '');
                const isStopWord = !isBulgarian && (stopWords.has(cleanWord) || cleanWord.length <= 2);

                if (isStopWord) {
                    fragment.appendChild(document.createTextNode(token));
                    continue;
                }

                // Look up in verse-specific word map first, then fall back to concordance index
                const mapEntry = verseWordMap ? verseWordMap.get(cleanWord) : null;

                if (mapEntry) {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.setAttribute('data-word', cleanWord);
                    span.setAttribute('data-strongs', mapEntry.strongs);
                    span.setAttribute('data-hebrew', mapEntry.originalWord);
                    span.textContent = token;
                    fragment.appendChild(span);
                } else if (!isBulgarian && hasDefinition(cleanWord)) {
                    // Fallback to generic concordance index
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.setAttribute('data-word', cleanWord);
                    span.textContent = token;
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(token));
                }
            }
        }

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
            const hebrewWord = e.target.dataset.hebrew || null;

            // Add a small delay before showing (200ms) to avoid accidental triggers
            tooltipShowTimeout = setTimeout(async () => {
                await showTooltip(word, e, strongsNumber, isOriginalLanguage, hebrewWord);
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
async function showTooltip(word, event, strongsNumber = null, isOriginalLanguage = false, hebrewWord = null) {
    currentTooltipWord = word;

    // Show loading state
    tooltip.querySelector('#tooltip-word').textContent = isOriginalLanguage ? 'Original Word' : word;
    tooltip.querySelector('#tooltip-strongs').textContent = strongsNumber ? `(${strongsNumber})` : '';
    tooltip.querySelector('#tooltip-language').textContent = 'Loading...';
    tooltip.querySelector('#tooltip-original').textContent = isOriginalLanguage ? word : (hebrewWord || '');
    tooltip.querySelector('#tooltip-transliteration').textContent = '';
    tooltip.querySelector('#tooltip-definition').textContent = 'Fetching word data...';

    positionTooltip(event);
    tooltip.style.opacity = '1';

    // Use Strong's number if available, otherwise fall back to word lookup
    const wordInfo = await getWordInfo(word, strongsNumber);

    // Update tooltip with actual data (only if still showing same word)
    if (currentTooltipWord === word) {
        if (isOriginalLanguage) {
            tooltip.querySelector('#tooltip-word').textContent = 'Original Word';
            tooltip.querySelector('#tooltip-original').textContent = word;
        } else {
            tooltip.querySelector('#tooltip-word').textContent = wordInfo.english;
            // Prefer the actual Hebrew word from the verse over the concordance's generic spelling
            tooltip.querySelector('#tooltip-original').textContent = hebrewWord || wordInfo.original;
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
