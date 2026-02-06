// Bible API Integration using bible-api.com
const API_BASE_URL = 'https://bible-api.com';

// Get DOM elements
const verseInput = document.getElementById('verse-input');
const searchBtn = document.getElementById('search-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const verseContent = document.getElementById('verse-content');
const mainContent = document.querySelector('.main-content');

// Track current reading state
let currentBook = 'Genesis';
let currentChapter = 1;
let isLoading = false;

// Chapter Manager for lazy loading
class ChapterManager {
    constructor() {
        this.chapters = new Map(); // Map of "Book Chapter" -> {data, element, height}
        this.chapterOrder = []; // Ordered array of chapter references
        this.maxVisibleChapters = 3; // Current + 1 ahead + 1 behind
        this.topSpacer = null;
        this.bottomSpacer = null;
        this.isLoadingPrevious = false;
    }

    initialize() {
        // Create top and bottom spacers
        this.topSpacer = document.createElement('div');
        this.topSpacer.id = 'top-spacer';
        this.topSpacer.style.height = '0px';

        this.bottomSpacer = document.createElement('div');
        this.bottomSpacer.id = 'bottom-spacer';
        this.bottomSpacer.style.height = '0px';

        verseContent.appendChild(this.topSpacer);
        verseContent.appendChild(this.bottomSpacer);
    }

    addChapter(reference, data, element, prepend = false) {
        // Store chapter data
        this.chapters.set(reference, {
            data,
            element,
            height: element.offsetHeight || 1000 // Fallback height
        });

        // Add to order if not already present
        if (!this.chapterOrder.includes(reference)) {
            if (prepend) {
                // Find insertion point (before current chapter)
                const currentRef = `${currentBook} ${currentChapter}`;
                const currentIndex = this.chapterOrder.indexOf(currentRef);
                if (currentIndex > 0) {
                    this.chapterOrder.splice(currentIndex, 0, reference);
                } else {
                    this.chapterOrder.unshift(reference);
                }
            } else {
                this.chapterOrder.push(reference);
            }
        }

        console.log(`Chapter added: ${reference}, total chapters: ${this.chapters.size}`);
    }

    getCurrentChapterIndex() {
        const currentRef = `${currentBook} ${currentChapter}`;
        return this.chapterOrder.indexOf(currentRef);
    }

    getVisibleRange() {
        const currentIndex = this.getCurrentChapterIndex();
        if (currentIndex === -1) return { start: 0, end: 0 };

        // Keep current chapter + 1 before + 1 after
        const start = Math.max(0, currentIndex - 1);
        const end = Math.min(this.chapterOrder.length - 1, currentIndex + 1);

        return { start, end };
    }

    cleanup() {
        const { start, end } = this.getVisibleRange();
        const visibleRefs = new Set(this.chapterOrder.slice(start, end + 1));

        let removedCount = 0;
        let topSpacerHeight = 0;
        let bottomSpacerHeight = 0;

        this.chapters.forEach((chapter, ref) => {
            if (!visibleRefs.has(ref)) {
                const index = this.chapterOrder.indexOf(ref);

                // Remove from DOM
                if (chapter.element && chapter.element.parentNode) {
                    chapter.element.remove();
                }

                // Add to spacer height
                if (index < start) {
                    topSpacerHeight += chapter.height;
                } else if (index > end) {
                    bottomSpacerHeight += chapter.height;
                }

                removedCount++;
            }
        });

        // Update spacers
        this.topSpacer.style.height = `${topSpacerHeight}px`;
        this.bottomSpacer.style.height = `${bottomSpacerHeight}px`;

        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} chapters. Top spacer: ${topSpacerHeight}px, Bottom spacer: ${bottomSpacerHeight}px`);
        }
    }

    needsCleanup() {
        return this.chapters.size > this.maxVisibleChapters;
    }

    getPreviousChapterRef() {
        const currentIndex = this.getCurrentChapterIndex();
        if (currentIndex > 0) {
            return this.chapterOrder[currentIndex - 1];
        }
        return null;
    }

    getNextChapterRef() {
        const currentIndex = this.getCurrentChapterIndex();
        if (currentIndex !== -1 && currentIndex < this.chapterOrder.length - 1) {
            return this.chapterOrder[currentIndex + 1];
        }
        return null;
    }

    shouldLoadPrevious(scrollTop) {
        // Load previous chapter when within 500px of top
        return scrollTop < 500 && !this.isLoadingPrevious;
    }

    shouldLoadNext(scrollPosition, scrollHeight) {
        // Load next chapter when 80% scrolled
        return scrollPosition >= scrollHeight * 0.8;
    }
}

const chapterManager = new ChapterManager();

// Fetch verse from API
async function fetchVerse(reference) {
    try {
        showLoading();

        // Format the reference for the API (replace spaces with +)
        const formattedReference = reference.trim().replace(/\s+/g, '+');
        const response = await fetch(`${API_BASE_URL}/${formattedReference}`);

        if (!response.ok) {
            throw new Error('Verse not found. Please check your reference and try again.');
        }

        const data = await response.json();
        await displayVerse(data);

    } catch (err) {
        showError(err.message);
    }
}

// Display verse content
async function displayVerse(data, append = false, prepend = false) {
    hideLoadingAndError();

    // Create chapter element
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'chapter-section';
    chapterDiv.innerHTML = `
        <div class="chapter-title">${data.reference}</div>
        <div class="chapter-content">${formatVerseText(data)}</div>
    `;

    // Update current reading position (only if not prepending or appending)
    if (!prepend && !append) {
        updateCurrentPosition(data.reference);
    }

    // Add to DOM based on mode
    if (prepend) {
        // Insert after top spacer
        const topSpacer = document.getElementById('top-spacer');
        if (topSpacer && topSpacer.nextSibling) {
            verseContent.insertBefore(chapterDiv, topSpacer.nextSibling);
        } else {
            verseContent.appendChild(chapterDiv);
        }
    } else if (append) {
        // Insert before bottom spacer
        const bottomSpacer = document.getElementById('bottom-spacer');
        if (bottomSpacer) {
            verseContent.insertBefore(chapterDiv, bottomSpacer);
        } else {
            verseContent.appendChild(chapterDiv);
        }
    } else {
        // Clear and add (first load)
        verseContent.innerHTML = '';
        chapterManager.initialize();
        verseContent.insertBefore(chapterDiv, chapterManager.bottomSpacer);
    }

    // Apply JEDP source color-coding FIRST on plain text (before word study markup)
    if (typeof loadJEDPData === 'function' && typeof applyJEDPSources === 'function') {
        console.log('Loading JEDP data and applying colors...');
        await loadJEDPData(currentBook);

        const verses = chapterDiv.querySelectorAll('.verse');
        console.log(`Found ${verses.length} verse elements to color`);
        applyJEDPSources(verses);
    }

    // Then make words clickable for word study (after JEDP highlighting)
    const verseTexts = chapterDiv.querySelectorAll('.verse-text');
    if (typeof makeWordsClickable === 'function') {
        for (const verseText of verseTexts) {
            await makeWordsClickable(verseText);
        }
    }

    // Add to chapter manager
    chapterManager.addChapter(data.reference, data, chapterDiv, prepend);

    // Cleanup old chapters if needed
    if (chapterManager.needsCleanup()) {
        chapterManager.cleanup();
    }

    // Setup sticky observer for first chapter title
    if (!append && !prepend) {
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

// Get previous chapter reference
function getPreviousChapter() {
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

    // Check if there's a previous chapter in current book
    if (currentChapter > 1) {
        return `${currentBook} ${currentChapter - 1}`;
    }

    // Move to previous book
    const books = bibleBooks[testament];
    const currentBookIndex = books.findIndex(b => b.name === currentBook);

    if (currentBookIndex > 0) {
        const prevBook = books[currentBookIndex - 1];
        return `${prevBook.name} ${prevBook.chapters}`;
    }

    // Move to previous testament
    if (testament === 'new' && bibleBooks.old.length > 0) {
        const lastOTBook = bibleBooks.old[bibleBooks.old.length - 1];
        return `${lastOTBook.name} ${lastOTBook.chapters}`;
    }

    return null; // Beginning of Bible
}

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

// Load previous chapter and prepend to content
async function loadPreviousChapter() {
    if (chapterManager.isLoadingPrevious) return;

    const prevChapterRef = getPreviousChapter();
    if (!prevChapterRef) return;

    // Check if already loaded
    if (chapterManager.chapters.has(prevChapterRef)) {
        console.log(`Chapter ${prevChapterRef} already loaded`);
        return;
    }

    chapterManager.isLoadingPrevious = true;

    try {
        // Save current scroll position
        const currentScrollTop = mainContent.scrollTop;
        const currentScrollHeight = mainContent.scrollHeight;

        const formattedReference = prevChapterRef.trim().replace(/\s+/g, '+');
        const response = await fetch(`${API_BASE_URL}/${formattedReference}`);

        if (!response.ok) {
            throw new Error('Could not load previous chapter');
        }

        const data = await response.json();
        await displayVerse(data, false, true); // prepend=true

        // Restore scroll position (compensate for new content)
        const newScrollHeight = mainContent.scrollHeight;
        const heightDifference = newScrollHeight - currentScrollHeight;
        mainContent.scrollTop = currentScrollTop + heightDifference;

    } catch (err) {
        console.error('Error loading previous chapter:', err);
    } finally {
        chapterManager.isLoadingPrevious = false;
    }
}

// Load next chapter and append to content
async function loadNextChapter() {
    if (isLoading) return;

    const nextChapterRef = getNextChapter();
    if (!nextChapterRef) return;

    // Check if already loaded
    if (chapterManager.chapters.has(nextChapterRef)) {
        console.log(`Chapter ${nextChapterRef} already loaded`);
        return;
    }

    isLoading = true;

    try {
        const formattedReference = nextChapterRef.trim().replace(/\s+/g, '+');
        const response = await fetch(`${API_BASE_URL}/${formattedReference}`);

        if (!response.ok) {
            throw new Error('Could not load next chapter');
        }

        const data = await response.json();
        await displayVerse(data, true); // append=true

    } catch (err) {
        console.error('Error loading next chapter:', err);
    } finally {
        isLoading = false;
    }
}

// Infinite scroll handler with lazy loading
function handleScroll() {
    const scrollTop = mainContent.scrollTop;
    const scrollPosition = scrollTop + mainContent.clientHeight;
    const scrollHeight = mainContent.scrollHeight;

    // Load previous chapter when near top
    if (chapterManager.shouldLoadPrevious(scrollTop)) {
        loadPreviousChapter();
    }

    // Load next chapter when 80% scrolled
    if (chapterManager.shouldLoadNext(scrollPosition, scrollHeight)) {
        loadNextChapter();
    }

    // Update current chapter based on visible content
    updateCurrentChapterFromScroll();
}

// Update current chapter based on scroll position
function updateCurrentChapterFromScroll() {
    const chapters = document.querySelectorAll('.chapter-section');
    const viewportMiddle = mainContent.scrollTop + (mainContent.clientHeight / 2);

    let closestChapter = null;
    let closestDistance = Infinity;

    chapters.forEach(chapter => {
        const chapterTop = chapter.offsetTop;
        const chapterMiddle = chapterTop + (chapter.offsetHeight / 2);
        const distance = Math.abs(viewportMiddle - chapterMiddle);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestChapter = chapter;
        }
    });

    if (closestChapter) {
        const title = closestChapter.querySelector('.chapter-title');
        if (title) {
            const reference = title.textContent;
            updateCurrentPosition(reference);
        }
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
