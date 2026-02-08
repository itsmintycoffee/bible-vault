// Bible API Integration using bible-api.com
const API_BASE_URL = 'https://bible-api.com';

// Get DOM elements
const verseInput = document.getElementById('verse-input');
const searchBtn = document.getElementById('search-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const verseContent = document.getElementById('verse-content');
const mainContent = document.querySelector('.main-content');
const contentHeader = document.querySelector('.content-header');

// Track current reading state (var for cross-script access)
var currentBook = 'Genesis';
var currentChapter = 1;
var isLoading = false;

// Comparison mode state (var for cross-script access from reading-controls.js)
var isComparisonMode = false;
var leftTranslation = 'esv';
var rightTranslation = 'bulgarian';

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

                // Remove from DOM but keep the reference in memory
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

        // Update spacers (these represent the removed content)
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
        // Load previous chapter when within 800px of top (increased for better UX)
        return scrollTop < 800 && !this.isLoadingPrevious;
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

    // Fetch Hebrew/Greek version for Strong's numbers (for Old/New Testament)
    let originalLanguageData = null;
    if (typeof translationManager !== 'undefined') {
        try {
            // Determine if OT or NT based on book
            const isOldTestament = currentBook && ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
                'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
                '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
                'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
                'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
                'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'].includes(currentBook);

            const originalTranslation = isOldTestament ? 'wlca' : 'lxx';
            console.log(`[BIBLE] Fetching original language: ${originalTranslation} for ${data.reference}`);
            originalLanguageData = await translationManager.fetchVerseForTranslation(data.reference, originalTranslation);
            console.log('[BIBLE] Original data received. Sample rawText:', originalLanguageData?.verses?.[0]?.rawText?.substring(0, 100));
        } catch (error) {
            console.error('[BIBLE] Could not fetch original language data:', error);
        }
    } else {
        console.warn('[BIBLE] translationManager not available!');
    }

    // Create chapter element
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'chapter-section';
    chapterDiv.dataset.reference = data.reference;

    // Determine current translation for title and language class
    const activeTranslationId = data.translation_id || (typeof translationManager !== 'undefined' ? translationManager.currentTranslation : 'esv');

    // Format the chapter title in the active translation's language
    const formattedTitle = formatChapterTitle(data.reference, activeTranslationId);

    const illustrationsHtml = getChapterIllustrations(data.reference);

    if (illustrationsHtml) {
        chapterDiv.innerHTML = `
            <div class="chapter-body with-illustrations">
                <div class="chapter-text-column">
                    <div class="chapter-title">${formattedTitle}</div>
                    <div class="chapter-content">${formatVerseText(data)}</div>
                </div>
                <aside class="chapter-illustrations">${illustrationsHtml}</aside>
            </div>
        `;
    } else {
        chapterDiv.innerHTML = `
            <div class="chapter-title">${formattedTitle}</div>
            <div class="chapter-content">${formatVerseText(data)}</div>
        `;
    }

    // Store original language data on the chapter div for word study
    if (originalLanguageData) {
        chapterDiv.dataset.originalLanguageData = JSON.stringify(originalLanguageData);
    }

    // Update current reading position (only if not prepending or appending)
    // This needs to happen BEFORE we parse titles from DOM, so currentBook is set
    if (!prepend && !append) {
        updateCurrentPosition(data.reference);
        applyLanguageClass(activeTranslationId);
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
    console.log(`[BIBLE] Found ${verseTexts.length} verse texts to process`);
    console.log(`[BIBLE] makeWordsClickable exists:`, typeof makeWordsClickable === 'function');

    if (typeof makeWordsClickable === 'function') {
        // Determine the translation type for word study
        const translationType = data.translation_id || 'english';
        console.log(`[BIBLE] Calling makeWordsClickable with translation type: ${translationType}`);

        for (const verseText of verseTexts) {
            await makeWordsClickable(verseText, translationType);
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
    // Handle new title format: either "GENESIS" or "2" (chapter number)
    const trimmed = reference.trim();

    // Check if it's just a number (subsequent chapter)
    if (/^\d+$/.test(trimmed)) {
        // Just a chapter number, use current book
        currentChapter = parseInt(trimmed);
        console.log(`[POSITION] Updated chapter to ${currentChapter} (book: ${currentBook})`);
        return;
    }

    // Otherwise, it should be a book name or "Book Chapter" format
    const match = trimmed.match(/^(.+?)\s+(\d+)/);
    if (match) {
        let bookName = match[1].trim();
        bookName = bookName.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        currentBook = bookName;
        currentChapter = parseInt(match[2]);
        console.log(`[POSITION] Updated to ${currentBook} ${currentChapter}`);
    }
}

// Book name translations for chapter titles in the reading area
const bookNameTranslations = {
    // Old Testament
    'Genesis': { bulgarian: 'Битие', hebrew: 'בראשית', greek: 'Γένεσις' },
    'Exodus': { bulgarian: 'Изход', hebrew: 'שמות', greek: 'Ἔξοδος' },
    'Leviticus': { bulgarian: 'Левит', hebrew: 'ויקרא', greek: 'Λευιτικόν' },
    'Numbers': { bulgarian: 'Числа', hebrew: 'במדבר', greek: 'Ἀριθμοί' },
    'Deuteronomy': { bulgarian: 'Второзаконие', hebrew: 'דברים', greek: 'Δευτερονόμιον' },
    'Joshua': { bulgarian: 'Исус Навин', hebrew: 'יהושע', greek: 'Ἰησοῦς Ναυή' },
    'Judges': { bulgarian: 'Съдии', hebrew: 'שופטים', greek: 'Κριταί' },
    'Ruth': { bulgarian: 'Рут', hebrew: 'רות', greek: 'Ῥούθ' },
    '1 Samuel': { bulgarian: '1 Самуил', hebrew: 'שמואל א', greek: 'Α΄ Βασιλειῶν' },
    '2 Samuel': { bulgarian: '2 Самуил', hebrew: 'שמואל ב', greek: 'Β΄ Βασιλειῶν' },
    '1 Kings': { bulgarian: '1 Царе', hebrew: 'מלכים א', greek: 'Γ΄ Βασιλειῶν' },
    '2 Kings': { bulgarian: '2 Царе', hebrew: 'מלכים ב', greek: 'Δ΄ Βασιλειῶν' },
    '1 Chronicles': { bulgarian: '1 Летописи', hebrew: 'דברי הימים א', greek: 'Α΄ Παραλειπομένων' },
    '2 Chronicles': { bulgarian: '2 Летописи', hebrew: 'דברי הימים ב', greek: 'Β΄ Παραλειπομένων' },
    'Ezra': { bulgarian: 'Ездра', hebrew: 'עזרא', greek: 'Ἔσδρας' },
    'Nehemiah': { bulgarian: 'Неемия', hebrew: 'נחמיה', greek: 'Νεεμίας' },
    'Esther': { bulgarian: 'Естир', hebrew: 'אסתר', greek: 'Ἐσθήρ' },
    'Job': { bulgarian: 'Йов', hebrew: 'איוב', greek: 'Ἰώβ' },
    'Psalms': { bulgarian: 'Псалми', hebrew: 'תהילים', greek: 'Ψαλμοί' },
    'Proverbs': { bulgarian: 'Притчи', hebrew: 'משלי', greek: 'Παροιμίαι' },
    'Ecclesiastes': { bulgarian: 'Еклисиаст', hebrew: 'קהלת', greek: 'Ἐκκλησιαστής' },
    'Song of Solomon': { bulgarian: 'Песен на песните', hebrew: 'שיר השירים', greek: 'Ἆσμα Ἀσμάτων' },
    'Isaiah': { bulgarian: 'Исая', hebrew: 'ישעיהו', greek: 'Ἡσαΐας' },
    'Jeremiah': { bulgarian: 'Еремия', hebrew: 'ירמיהו', greek: 'Ἱερεμίας' },
    'Lamentations': { bulgarian: 'Плач Еремиев', hebrew: 'איכה', greek: 'Θρῆνοι' },
    'Ezekiel': { bulgarian: 'Езекиил', hebrew: 'יחזקאל', greek: 'Ἰεζεκιήλ' },
    'Daniel': { bulgarian: 'Даниил', hebrew: 'דניאל', greek: 'Δανιήλ' },
    'Hosea': { bulgarian: 'Осия', hebrew: 'הושע', greek: 'Ὡσηέ' },
    'Joel': { bulgarian: 'Йоил', hebrew: 'יואל', greek: 'Ἰωήλ' },
    'Amos': { bulgarian: 'Амос', hebrew: 'עמוס', greek: 'Ἀμώς' },
    'Obadiah': { bulgarian: 'Авдий', hebrew: 'עובדיה', greek: 'Ὀβδιού' },
    'Jonah': { bulgarian: 'Йона', hebrew: 'יונה', greek: 'Ἰωνᾶς' },
    'Micah': { bulgarian: 'Михей', hebrew: 'מיכה', greek: 'Μιχαίας' },
    'Nahum': { bulgarian: 'Наум', hebrew: 'נחום', greek: 'Ναούμ' },
    'Habakkuk': { bulgarian: 'Авакум', hebrew: 'חבקוק', greek: 'Ἁβακκούμ' },
    'Zephaniah': { bulgarian: 'Софония', hebrew: 'צפניה', greek: 'Σοφονίας' },
    'Haggai': { bulgarian: 'Агей', hebrew: 'חגי', greek: 'Ἀγγαῖος' },
    'Zechariah': { bulgarian: 'Захария', hebrew: 'זכריה', greek: 'Ζαχαρίας' },
    'Malachi': { bulgarian: 'Малахия', hebrew: 'מלאכי', greek: 'Μαλαχίας' },
    // New Testament
    'Matthew': { bulgarian: 'Матей', hebrew: 'מתי', greek: 'Κατὰ Ματθαῖον' },
    'Mark': { bulgarian: 'Марко', hebrew: 'מרקוס', greek: 'Κατὰ Μάρκον' },
    'Luke': { bulgarian: 'Лука', hebrew: 'לוקס', greek: 'Κατὰ Λουκᾶν' },
    'John': { bulgarian: 'Йоан', hebrew: 'יוחנן', greek: 'Κατὰ Ἰωάννην' },
    'Acts': { bulgarian: 'Деяния', hebrew: 'מעשי השליחים', greek: 'Πράξεις Ἀποστόλων' },
    'Romans': { bulgarian: 'Римляни', hebrew: 'רומים', greek: 'Πρὸς Ῥωμαίους' },
    '1 Corinthians': { bulgarian: '1 Коринтяни', hebrew: 'קורינתים א', greek: 'Α΄ Κορινθίους' },
    '2 Corinthians': { bulgarian: '2 Коринтяни', hebrew: 'קורינתים ב', greek: 'Β΄ Κορινθίους' },
    'Galatians': { bulgarian: 'Галатяни', hebrew: 'גלטים', greek: 'Πρὸς Γαλάτας' },
    'Ephesians': { bulgarian: 'Ефесяни', hebrew: 'אפסים', greek: 'Πρὸς Ἐφεσίους' },
    'Philippians': { bulgarian: 'Филипяни', hebrew: 'פיליפים', greek: 'Πρὸς Φιλιππησίους' },
    'Colossians': { bulgarian: 'Колосяни', hebrew: 'קולוסים', greek: 'Πρὸς Κολοσσαεῖς' },
    '1 Thessalonians': { bulgarian: '1 Солунци', hebrew: 'תסלוניקים א', greek: 'Α΄ Θεσσαλονικεῖς' },
    '2 Thessalonians': { bulgarian: '2 Солунци', hebrew: 'תסלוניקים ב', greek: 'Β΄ Θεσσαλονικεῖς' },
    '1 Timothy': { bulgarian: '1 Тимотей', hebrew: 'טימותיוס א', greek: 'Α΄ Τιμόθεον' },
    '2 Timothy': { bulgarian: '2 Тимотей', hebrew: 'טימותיוס ב', greek: 'Β΄ Τιμόθεον' },
    'Titus': { bulgarian: 'Тит', hebrew: 'טיטוס', greek: 'Πρὸς Τίτον' },
    'Philemon': { bulgarian: 'Филимон', hebrew: 'פילמון', greek: 'Πρὸς Φιλήμονα' },
    'Hebrews': { bulgarian: 'Евреи', hebrew: 'עברים', greek: 'Πρὸς Ἑβραίους' },
    'James': { bulgarian: 'Яков', hebrew: 'יעקב', greek: 'Ἰακώβου' },
    '1 Peter': { bulgarian: '1 Петрово', hebrew: 'פטרוס א', greek: 'Α΄ Πέτρου' },
    '2 Peter': { bulgarian: '2 Петрово', hebrew: 'פטרוס ב', greek: 'Β΄ Πέτρου' },
    '1 John': { bulgarian: '1 Йоаново', hebrew: 'יוחנן א', greek: 'Α΄ Ἰωάννου' },
    '2 John': { bulgarian: '2 Йоаново', hebrew: 'יוחנן ב', greek: 'Β΄ Ἰωάννου' },
    '3 John': { bulgarian: '3 Йоаново', hebrew: 'יוחנן ג', greek: 'Γ΄ Ἰωάννου' },
    'Jude': { bulgarian: 'Юда', hebrew: 'יהודה', greek: 'Ἰούδα' },
    'Revelation': { bulgarian: 'Откровение', hebrew: 'התגלות', greek: 'Ἀποκάλυψις' }
};

// Get translated book name based on translation ID
function getTranslatedBookName(englishName, translationId) {
    if (!translationId || translationId === 'esv' || translationId === 'kjv') {
        return englishName;
    }
    const entry = bookNameTranslations[englishName];
    if (!entry) return englishName;

    if (translationId === 'bulgarian') return entry.bulgarian || englishName;
    if (translationId === 'wlca') return entry.hebrew || englishName;
    if (translationId === 'lxx') return entry.greek || englishName;

    return englishName;
}

// Apply language-specific CSS class to .bible-content
function applyLanguageClass(translationId) {
    const bibleContent = document.querySelector('.bible-content');
    if (!bibleContent) return;

    bibleContent.classList.remove('lang-english', 'lang-bulgarian', 'lang-hebrew', 'lang-greek');

    const translation = typeof TRANSLATIONS !== 'undefined' ? TRANSLATIONS[translationId] : null;
    if (!translation) return;

    bibleContent.classList.add(`lang-${translation.language.toLowerCase()}`);
}

// Format chapter title based on whether it's the first chapter of a book
function formatChapterTitle(reference, translationId) {
    const match = reference.match(/^(.+?)\s+(\d+)/);
    if (!match) return reference;

    const bookName = match[1].trim();
    const chapterNum = parseInt(match[2]);

    // First chapter of a book: show translated book name
    if (chapterNum === 1) {
        return getTranslatedBookName(bookName, translationId);
    }
    // Subsequent chapters: show just the number
    return chapterNum.toString();
}

// Format full chapter reference for toolbar display (always shows "Book Chapter" format)
function formatFullChapterReference(reference) {
    const match = reference.match(/^(.+?)\s+(\d+)/);
    if (!match) return reference;

    const bookName = match[1].trim();
    const chapterNum = parseInt(match[2]);

    return `${bookName} ${chapterNum}`;
}

// Format verse text with verse numbers
function formatVerseText(data) {
    if (data.verses && data.verses.length > 0) {
        return data.verses.map((verse, index) => {
            const verseNumber = verse.verse;
            const verseText = verse.text;
            // First verse of each chapter: drop cap, hide verse number
            if (index === 0) {
                const trimmed = verseText.trimStart();
                const firstLetter = trimmed.charAt(0);
                const rest = trimmed.substring(1);
                return `<div class="verse drop-cap"><span class="drop-cap-letter">${firstLetter}</span><span class="verse-text">${rest}</span></div>`;
            }
            return `<div class="verse"><sup class="verse-number">${verseNumber}</sup><span class="verse-text">${verseText}</span></div>`;
        }).join('');
    }
    return `${data.text}`;
}

// Get chapter illustration HTML if available
function getChapterIllustrations(reference) {
    const match = reference.match(/^(.+?)\s+(\d+)/);
    if (!match) return null;

    const bookName = match[1].trim().toLowerCase();
    const chapterNum = parseInt(match[2]);

    if (bookName === 'genesis' && chapterNum === 1) {
        const basePath = 'chapters/genesis/resources';
        return `
            <div class="illustration-grid">
                <img src="${basePath}/day01.png" alt="Day 1 – Light">
                <img src="${basePath}/day02.png" alt="Day 2 – Sky">
                <img src="${basePath}/day03.png" alt="Day 3 – Land and Seas">
                <img src="${basePath}/day04.png" alt="Day 4 – Sun, Moon, Stars">
                <img src="${basePath}/day05.png" alt="Day 5 – Sea and Sky Creatures">
                <img src="${basePath}/day06.png" alt="Day 6 – Land Animals and Man">
            </div>
        `;
    }

    return null;
}

// UI Helper functions
function showLoading() {
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    verseContent.innerHTML = '';
    if (contentHeader) {
        contentHeader.classList.add('loading');
    }
}

function showError(message) {
    loading.classList.add('hidden');
    error.classList.remove('hidden');
    error.textContent = message;
    verseContent.innerHTML = '';
    if (contentHeader) {
        contentHeader.classList.remove('loading');
    }
}

function hideLoadingAndError() {
    loading.classList.add('hidden');
    error.classList.add('hidden');
    if (contentHeader) {
        contentHeader.classList.remove('loading');
    }
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

// Translation selector handler
const translationSelector = document.getElementById('translation-selector');
if (translationSelector) {
    translationSelector.addEventListener('change', async (e) => {
        const translationId = e.target.value;
        if (typeof translationManager !== 'undefined') {
            translationManager.setTranslation(translationId);
        }

        // Reload current chapter with new translation
        if (isComparisonMode) {
            leftTranslation = translationId;
            loadChapterInComparisonMode(`${currentBook} ${currentChapter}`);
        } else {
            // Use translationManager to fetch with the selected translation
            try {
                showLoading();
                const data = await translationManager.fetchVerseForTranslation(
                    `${currentBook} ${currentChapter}`, translationId
                );
                await displayVerse(data);
            } catch (err) {
                showError(err.message);
            }
        }
    });
}

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
    if (isLoading) {
        console.log(`[LOAD] Already loading, skipping`);
        return;
    }

    const nextChapterRef = getNextChapter();
    console.log(`[LOAD] Next chapter: ${nextChapterRef}, current: ${currentBook} ${currentChapter}`);

    if (!nextChapterRef) {
        console.log(`[LOAD] No next chapter available`);
        return;
    }

    // Check if already loaded
    if (chapterManager.chapters.has(nextChapterRef)) {
        console.log(`[LOAD] Chapter ${nextChapterRef} already loaded`);
        return;
    }

    isLoading = true;
    console.log(`[LOAD] Starting load of ${nextChapterRef}`);

    try {
        const formattedReference = nextChapterRef.trim().replace(/\s+/g, '+');
        console.log(`[LOAD] Fetching ${formattedReference}...`);
        const response = await fetch(`${API_BASE_URL}/${formattedReference}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[LOAD] Received data for ${nextChapterRef}, chapters: ${data.verses?.length}`);
        await displayVerse(data, true); // append=true
        console.log(`[LOAD] Successfully loaded ${nextChapterRef}`);

    } catch (err) {
        console.error(`[LOAD] Error loading next chapter:`, err);
    } finally {
        isLoading = false;
        console.log(`[LOAD] Finished loading, isLoading reset to false`);
    }
}

// Infinite scroll handler with lazy loading
function handleScroll() {
    const scrollTop = mainContent.scrollTop;
    const scrollPosition = scrollTop + mainContent.clientHeight;
    const scrollHeight = mainContent.scrollHeight;

    // Load previous chapter when near top (including accounting for top spacer)
    const topSpacerHeight = chapterManager.topSpacer ? parseInt(chapterManager.topSpacer.style.height) || 0 : 0;
    if (chapterManager.shouldLoadPrevious(scrollTop) || (topSpacerHeight > 0 && scrollTop < topSpacerHeight + 500)) {
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
    let visibleChapter = null;

    chapters.forEach(chapter => {
        const rect = chapter.getBoundingClientRect();
        // Chapter is current if its content is in the upper half of the viewport
        if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
            visibleChapter = chapter;
        }
    });

    if (visibleChapter && visibleChapter.dataset.reference) {
        updateCurrentPosition(visibleChapter.dataset.reference);
    }
}

// Update chapter selector based on visible chapter
function updateChapterSelector() {
    const chapters = document.querySelectorAll('.chapter-section');
    const currentChapterDisplay = document.getElementById('current-chapter');

    if (!currentChapterDisplay) return;

    let visibleChapter = null;

    chapters.forEach(chapter => {
        const rect = chapter.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
            visibleChapter = chapter;
        }
    });

    if (visibleChapter && visibleChapter.dataset.reference) {
        updateCurrentPosition(visibleChapter.dataset.reference);
        currentChapterDisplay.textContent = formatFullChapterReference(visibleChapter.dataset.reference);
    }
}

// Add scroll event listener with debounce
let scrollTimeout;

mainContent.addEventListener('scroll', () => {
    // Show/hide top bar based on scroll position (no debounce for responsiveness)
    if (contentHeader) {
        if (mainContent.scrollTop > 100) {
            contentHeader.classList.add('scrolled');
        } else {
            contentHeader.classList.remove('scrolled');
        }
    }

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        handleScroll();
        updateChapterSelector();
    }, 200);
});

// Comparison Mode Event Listeners
const toggleComparisonBtn = document.getElementById('toggle-comparison');
const translationLeftSelect = document.getElementById('translation-left');
const translationRightSelect = document.getElementById('translation-right');

if (toggleComparisonBtn) {
    toggleComparisonBtn.addEventListener('click', () => {
        isComparisonMode = !isComparisonMode;

        if (isComparisonMode) {
            // Show translation selects
            translationLeftSelect.classList.remove('hidden');
            translationRightSelect.classList.remove('hidden');
            verseContent.classList.add('comparison-mode');

            // Reload current chapter in comparison mode
            loadChapterInComparisonMode(`${currentBook} ${currentChapter}`);
        } else {
            // Hide translation selects
            translationLeftSelect.classList.add('hidden');
            translationRightSelect.classList.add('hidden');
            verseContent.classList.remove('comparison-mode');

            // Reload current chapter in single mode
            fetchVerse(`${currentBook} ${currentChapter}`);
        }
    });
}

if (translationLeftSelect) {
    translationLeftSelect.addEventListener('change', (e) => {
        leftTranslation = e.target.value;
        if (isComparisonMode) {
            loadChapterInComparisonMode(`${currentBook} ${currentChapter}`);
        }
    });
}

if (translationRightSelect) {
    translationRightSelect.addEventListener('change', (e) => {
        rightTranslation = e.target.value;
        if (isComparisonMode) {
            loadChapterInComparisonMode(`${currentBook} ${currentChapter}`);
        }
    });
}

// Load chapter in comparison mode
async function loadChapterInComparisonMode(reference) {
    try {
        console.log(`[COMPARE] Loading comparison: ${reference}, left=${leftTranslation}, right=${rightTranslation}`);

        // Add comparison-mode class to widen layout and hide supplementary columns
        const bibleContent = document.querySelector('.bible-content');
        if (bibleContent) bibleContent.classList.add('comparison-mode');

        showLoading();

        // Check if translationManager is available
        if (typeof translationManager === 'undefined') {
            throw new Error('Translation manager not loaded. Please ensure translation-manager.js is included.');
        }

        // Fetch both translations
        console.log(`[COMPARE] Fetching left (${leftTranslation})...`);
        const leftData = await translationManager.fetchVerseForTranslation(reference, leftTranslation);
        console.log(`[COMPARE] Left data received: ${leftData.verses?.length} verses`);

        console.log(`[COMPARE] Fetching right (${rightTranslation})...`);
        const rightData = await translationManager.fetchVerseForTranslation(reference, rightTranslation);
        console.log(`[COMPARE] Right data received: ${rightData.verses?.length} verses`);

        await displayComparisonVerse(leftData, rightData);
        console.log('[COMPARE] Comparison mode rendered successfully');
    } catch (err) {
        console.error('[COMPARE] Error in comparison mode:', err);
        showError(err.message);
    }
}

// Display verses in comparison mode with aligned verse numbers
async function displayComparisonVerse(leftData, rightData, append = false, prepend = false) {
    hideLoadingAndError();

    // Fetch Hebrew/Greek version for Strong's numbers (for both columns)
    let originalLanguageData = null;
    if (typeof translationManager !== 'undefined') {
        try {
            const isOldTestament = currentBook && ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
                'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
                '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
                'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
                'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
                'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'].includes(currentBook);

            const originalTranslation = isOldTestament ? 'wlca' : 'lxx';
            originalLanguageData = await translationManager.fetchVerseForTranslation(leftData.reference, originalTranslation);
        } catch (error) {
            console.log('Could not fetch original language data for comparison:', error);
        }
    }

    // Create chapter element
    const chapterDiv = document.createElement('div');
    chapterDiv.className = 'chapter-section';
    chapterDiv.dataset.reference = leftData.reference;

    // Store original language data for both columns
    if (originalLanguageData) {
        chapterDiv.dataset.originalLanguageData = JSON.stringify(originalLanguageData);
    }

    // Create header with translation names
    const comparisonHeader = document.createElement('div');
    comparisonHeader.className = 'comparison-header';
    comparisonHeader.innerHTML = `
        <div class="comparison-header-item">${leftData.translation_name || 'Left Translation'}</div>
        <div class="comparison-header-item">${rightData.translation_name || 'Right Translation'}</div>
    `;

    // Create chapter title (use left translation's language)
    const chapterTitle = document.createElement('div');
    chapterTitle.className = 'chapter-title';
    chapterTitle.textContent = formatChapterTitle(leftData.reference, leftData.translation_id || leftTranslation);

    // Create chapter content container
    const chapterContent = document.createElement('div');
    chapterContent.className = 'chapter-content';

    // Get all verse numbers (union of both translations)
    const leftVerses = new Map(leftData.verses.map(v => [v.verse, v]));
    const rightVerses = new Map(rightData.verses.map(v => [v.verse, v]));
    const allVerseNumbers = new Set([...leftVerses.keys(), ...rightVerses.keys()]);
    const sortedVerseNumbers = Array.from(allVerseNumbers).sort((a, b) => a - b);

    // Create aligned verse rows
    for (const verseNum of sortedVerseNumbers) {
        const leftVerse = leftVerses.get(verseNum);
        const rightVerse = rightVerses.get(verseNum);

        const verseRow = document.createElement('div');
        verseRow.className = 'verse-row';

        // Left column
        const leftColumn = document.createElement('div');
        leftColumn.className = 'verse-column';
        if (leftVerse) {
            leftColumn.innerHTML = `
                <sup class="verse-number">${verseNum}</sup>
                <span class="verse-text">${leftVerse.text}</span>
            `;
        } else {
            leftColumn.innerHTML = `
                <sup class="verse-number">${verseNum}</sup>
                <span class="verse-text" style="color: var(--text-secondary); font-style: italic;">—</span>
            `;
        }

        // Right column
        const rightColumn = document.createElement('div');
        rightColumn.className = 'verse-column';
        if (rightVerse) {
            rightColumn.innerHTML = `
                <sup class="verse-number">${verseNum}</sup>
                <span class="verse-text">${rightVerse.text}</span>
            `;
        } else {
            rightColumn.innerHTML = `
                <sup class="verse-number">${verseNum}</sup>
                <span class="verse-text" style="color: var(--text-secondary); font-style: italic;">—</span>
            `;
        }

        verseRow.appendChild(leftColumn);
        verseRow.appendChild(rightColumn);
        chapterContent.appendChild(verseRow);
    }

    // Assemble chapter
    chapterDiv.appendChild(chapterTitle);
    chapterDiv.appendChild(comparisonHeader);
    chapterDiv.appendChild(chapterContent);

    // Apply JEDP source color-coding to comparison mode verses
    if (typeof loadJEDPData === 'function' && typeof applyJEDPSources === 'function') {
        await loadJEDPData(currentBook);
        const verseColumns = chapterDiv.querySelectorAll('.verse-column');
        applyJEDPSources(verseColumns);
    }

    // Make words clickable for word study in comparison mode
    if (typeof makeWordsClickable === 'function') {
        const leftVerseTexts = chapterContent.querySelectorAll('.verse-column:first-child .verse-text');
        const rightVerseTexts = chapterContent.querySelectorAll('.verse-column:last-child .verse-text');

        const leftTranslationType = leftData.translation_id || leftTranslation;
        const rightTranslationType = rightData.translation_id || rightTranslation;

        for (const verseText of leftVerseTexts) {
            await makeWordsClickable(verseText, leftTranslationType);
        }

        for (const verseText of rightVerseTexts) {
            await makeWordsClickable(verseText, rightTranslationType);
        }
    }

    // Update current reading position (only if not prepending or appending)
    if (!prepend && !append) {
        updateCurrentPosition(leftData.reference);
    }

    // Add to DOM based on mode
    if (prepend) {
        const topSpacer = document.getElementById('top-spacer');
        if (topSpacer && topSpacer.nextSibling) {
            verseContent.insertBefore(chapterDiv, topSpacer.nextSibling);
        } else {
            verseContent.appendChild(chapterDiv);
        }
    } else if (append) {
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

    // Add to chapter manager
    chapterManager.addChapter(leftData.reference, leftData, chapterDiv, prepend);

    // Cleanup old chapters if needed
    if (chapterManager.needsCleanup()) {
        chapterManager.cleanup();
    }

    // Setup sticky observer for first chapter title
    if (!append && !prepend) {
        setupFirstChapterObserver();
    }
}

// Default chapter is loaded by chapter-selector.js to avoid duplicate loading

// JEDP Source Coloring State - OFF by default
var jedpColorsVisible = false;

// JEDP Toggle Button
const jedpToggleBtn = document.getElementById('jedp-toggle');
if (jedpToggleBtn) {
    jedpToggleBtn.addEventListener('click', () => {
        jedpColorsVisible = !jedpColorsVisible;

        // Toggle all source span elements
        const sourceElements = document.querySelectorAll('[class^="source-"]');
        sourceElements.forEach(el => {
            if (jedpColorsVisible) {
                el.style.color = '';
            } else {
                el.style.color = 'inherit';
            }
        });

        // Visual feedback on button
        jedpToggleBtn.classList.toggle('active', jedpColorsVisible);
        jedpToggleBtn.setAttribute('title', jedpColorsVisible ? 'Hide Source Colors' : 'Show Source Colors');

        console.log('[JEDP] Colors toggled:', jedpColorsVisible);
    });

    // Set initial button state
    jedpToggleBtn.classList.toggle('active', jedpColorsVisible);

    // Hide source colors by default on page load
    document.addEventListener('DOMContentLoaded', () => {
        const sourceElements = document.querySelectorAll('[class^="source-"]');
        sourceElements.forEach(el => {
            el.style.color = 'inherit';
        });
    });

    // Also hide colors when new content is loaded (prepend/append)
    const originalDisplayVerse = window.displayVerse;
    window.displayVerse = async function(...args) {
        const result = await originalDisplayVerse.apply(this, args);
        // Hide colors after verse is displayed
        const sourceElements = document.querySelectorAll('[class^="source-"]');
        sourceElements.forEach(el => {
            el.style.color = 'inherit';
        });
        return result;
    };
}

// Expose key functions globally for cross-script access
window.fetchVerse = fetchVerse;
window.loadChapterInComparisonMode = loadChapterInComparisonMode;
window.displayVerse = displayVerse;
window.displayComparisonVerse = displayComparisonVerse;
