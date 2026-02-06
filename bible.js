// Bible API Integration with multi-translation support
// Get DOM elements
const verseInput = document.getElementById('verse-input');
const searchBtn = document.getElementById('search-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const verseContent = document.getElementById('verse-content');
const mainContent = document.querySelector('.main-content');
const translationSelector = document.getElementById('translation-selector');

// Track current reading state
let currentBook = 'Genesis';
let currentChapter = 1;
let isLoading = false;

// Initialize translation selector
function initializeTranslationSelector() {
    // Set saved preference
    const savedTranslation = translationManager.currentTranslation;
    if (translationSelector) {
        translationSelector.value = savedTranslation;

        // Listen for translation changes
        translationSelector.addEventListener('change', async (e) => {
            const newTranslation = e.target.value;
            translationManager.setTranslation(newTranslation);

            // Check if parallel mode is active
            if (readingControls && readingControls.isParallelMode && readingControls.parallelTranslation) {
                await readingControls.refreshParallelView();
            } else {
                // Reload current chapter with new translation
                const currentRef = `${currentBook} ${currentChapter}`;
                await fetchVerse(currentRef);
            }
        });
    }
}

// Fetch verse from appropriate translation source
async function fetchVerse(reference) {
    try {
        showLoading();

        // Use translation manager to fetch from appropriate source
        const data = await translationManager.fetchVerse(reference);
        await displayVerse(data);

    } catch (err) {
        console.error('Fetch error:', err);
        showError(err.message);
    }
}

// Display verse content
async function displayVerse(data, append = false) {
    hideLoadingAndError();

    const chapterHTML = `
        <div class="chapter-section">
            <div class="chapter-title">${data.reference}</div>
            <div class="chapter-content">${formatVerseText(data)}</div>
        </div>
    `;

    if (append) {
        verseContent.innerHTML += chapterHTML;
    } else {
        verseContent.innerHTML = chapterHTML;
    }

    // Update current reading position
    updateCurrentPosition(data.reference);

    // Apply JEDP source color-coding FIRST on plain text (before word study markup)
    if (typeof loadJEDPData === 'function' && typeof applyJEDPSources === 'function') {
        // Load JEDP data for current book first
        console.log('Loading JEDP data and applying colors...');
        await loadJEDPData(currentBook);
        
        // Only highlight verses in the newly loaded chapter (not all verses on page)
        const lastChapterSection = verseContent.querySelector('.chapter-section:last-child');
        const verses = lastChapterSection ? lastChapterSection.querySelectorAll('.verse') : [];
        console.log(`Found ${verses.length} verse elements to color`);
        applyJEDPSources(verses);
    }

    // Then make words clickable for word study (after JEDP highlighting)
    // Only process the newly loaded chapter
    const lastChapterSection = verseContent.querySelector('.chapter-section:last-child');
    const verseTexts = lastChapterSection ? lastChapterSection.querySelectorAll('.verse-text') : [];
    if (typeof makeWordsClickable === 'function') {
        for (const verseText of verseTexts) {
            await makeWordsClickable(verseText);
        }
    }

    // Setup sticky observer for first chapter title
    if (!append) {
        setupFirstChapterObserver();
    }
}

// Observe first chapter title to add sticky-active class when it becomes sticky
function setupFirstChapterObserver() {
    const firstChapterTitle = document.querySelector('.chapter-section:first-child .chapter-title');
    if (!firstChapterTitle) return;

    // Store the initial offset and track current state to avoid redundant class operations
    let initialOffsetTop = null;
    let isCurrentlyStuck = false;

    // Use scroll event to detect sticky state more reliably
    const checkStickyState = () => {
        // Calculate initial offset on first run
        if (initialOffsetTop === null) {
            const firstSection = document.querySelector('.chapter-section:first-child');
            if (firstSection) {
                initialOffsetTop = firstSection.offsetTop;
            }
        }

        // Check if we've scrolled past the initial position
        const scrollTop = mainContent.scrollTop;
        const isStuck = scrollTop > initialOffsetTop;

        // Only update class if state actually changed (avoid redundant DOM operations)
        if (isStuck && !isCurrentlyStuck) {
            firstChapterTitle.classList.add('sticky-active');
            isCurrentlyStuck = true;
        } else if (!isStuck && isCurrentlyStuck) {
            firstChapterTitle.classList.remove('sticky-active');
            isCurrentlyStuck = false;
        }
    };

    // Use passive listener for better scroll performance
    mainContent.addEventListener('scroll', checkStickyState, { passive: true });

    // Initial check
    checkStickyState();
}

// Update current book and chapter from reference
function updateCurrentPosition(reference) {
    const match = reference.match(/^(.+?)\s+(\d+)/);
    if (match) {
        currentBook = match[1];
        currentChapter = parseInt(match[2]);
    }
}

// Format verse text with verse numbers
function formatVerseText(data) {
    if (data.verses && data.verses.length > 0) {
        return data.verses.map(verse => {
            const verseNumber = verse.verse;
            const verseText = verse.text;
            return `<div class="verse"><sup class="verse-number">${verseNumber}</sup><span class="verse-text">${verseText}</span></div>`;
        }).join('');
    }
    return `${data.text}`;
}

// UI Helper functions
function showLoading() {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    verseContent.innerHTML = '';
}

function showError(message) {
    loading.classList.add('hidden');
    error.classList.remove('hidden');
    error.textContent = message;
    verseContent.innerHTML = '';
}

function hideLoadingAndError() {
    loading.classList.add('hidden');
    error.classList.add('hidden');
}

// Event listeners
searchBtn.addEventListener('click', () => {
    const reference = verseInput.value.trim();
    if (reference) {
        fetchVerse(reference);
    } else {
        showError('Please enter a verse reference');
    }
});

verseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchBtn.click();
    }
});

// Get next chapter reference
function getNextChapter() {
    // Access bibleBooks from chapter-selector.js
    if (typeof bibleBooks === 'undefined') return null;

    // Find current book in either testament
    let currentBookData = null;
    let testament = null;

    for (const test of ['old', 'new']) {
        const book = bibleBooks[test].find(b => b.name === currentBook);
        if (book) {
            currentBookData = book;
            testament = test;
            break;
        }
    }

    if (!currentBookData) return null;

    // Check if there's a next chapter in current book
    if (currentChapter < currentBookData.chapters) {
        return `${currentBook} ${currentChapter + 1}`;
    }

    // Move to next book
    const books = bibleBooks[testament];
    const currentBookIndex = books.findIndex(b => b.name === currentBook);

    if (currentBookIndex < books.length - 1) {
        const nextBook = books[currentBookIndex + 1];
        return `${nextBook.name} 1`;
    }

    // Move to next testament
    if (testament === 'old' && bibleBooks.new.length > 0) {
        return `${bibleBooks.new[0].name} 1`;
    }

    return null; // End of Bible
}

// Load next chapter and append to content
async function loadNextChapter() {
    if (isLoading) return;

    const nextChapterRef = getNextChapter();
    if (!nextChapterRef) return;

    isLoading = true;

    try {
        // Use translation manager to support all translations (Bulgarian, Hebrew, Greek, ESV, KJV)
        const data = await translationManager.fetchVerse(nextChapterRef);
        await displayVerse(data, true); // append=true

    } catch (err) {
        console.error('Error loading next chapter:', err);
    } finally {
        isLoading = false;
    }
}

// Infinite scroll handler
function handleScroll() {
    const scrollPosition = mainContent.scrollTop + mainContent.clientHeight;
    const scrollHeight = mainContent.scrollHeight;

    // Load next chapter when 80% scrolled
    if (scrollPosition >= scrollHeight * 0.8) {
        loadNextChapter();
    }
}

// Update chapter selector based on visible chapter
function updateChapterSelector() {
    const chapters = document.querySelectorAll('.chapter-section');
    const currentChapterDisplay = document.getElementById('current-chapter');

    if (!currentChapterDisplay) return;

    chapters.forEach(chapter => {
        const rect = chapter.getBoundingClientRect();
        // Check if chapter is in viewport (top portion visible)
        if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
            const title = chapter.querySelector('.chapter-title');
            if (title) {
                currentChapterDisplay.textContent = title.textContent;
            }
        }
    });
}

// Add scroll event listener with debounce
let scrollTimeout;
mainContent.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        handleScroll();
        updateChapterSelector();
    }, 200);
});

// Load a default chapter on page load
window.addEventListener('load', () => {
    initializeTranslationSelector();
    fetchVerse('Genesis 1');
});

// Mobile sidebar toggle functionality
const rightPanel = document.getElementById('right-panel');
const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle');
const mobileCloseBtn = document.getElementById('mobile-close-btn');

// Open sidebar on mobile
if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
        rightPanel.classList.add('mobile-open');
        mobileToggleBtn.classList.add('hidden');
    });
}

// Close sidebar on mobile
if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', () => {
        rightPanel.classList.remove('mobile-open');
        mobileToggleBtn.classList.remove('hidden');
    });
}

// Right Panel Resize Functionality
const resizeHandle = document.getElementById('resize-handle');
let isResizing = false;
let startX = 0;
let startWidth = 0;

if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
        // Only enable resizing on desktop (screen width > 1024px)
        if (window.innerWidth <= 1024) return;

        isResizing = true;
        startX = e.clientX;
        startWidth = rightPanel.offsetWidth;

        resizeHandle.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        // Calculate new width (subtract because we're dragging from the right)
        const deltaX = startX - e.clientX;
        const newWidth = startWidth + deltaX;

        // Constrain width between min and max
        const minWidth = 400;
        const maxWidth = window.innerWidth * 0.6; // Max 60% of window width
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

        // Apply new width
        rightPanel.style.width = `${constrainedWidth}px`;
        rightPanel.style.minWidth = `${constrainedWidth}px`;
        rightPanel.style.maxWidth = `${constrainedWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Save width preference to localStorage
            localStorage.setItem('rightPanelWidth', rightPanel.offsetWidth);
        }
    });

    // Restore saved width on page load
    window.addEventListener('load', () => {
        const savedWidth = localStorage.getItem('rightPanelWidth');
        if (savedWidth && window.innerWidth > 1024) {
            const width = parseInt(savedWidth);
            rightPanel.style.width = `${width}px`;
            rightPanel.style.minWidth = `${width}px`;
            rightPanel.style.maxWidth = `${width}px`;
        }
    });
}
