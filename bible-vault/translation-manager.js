// Translation Manager
// Handles fetching Bible text from multiple sources: Bolls.life API and local Bulgarian Bible

// Available translations
const TRANSLATIONS = {
    esv: {
        id: 'esv',
        name: 'English Standard Version (ESV)',
        source: 'bolls',
        apiCode: 'ESV',
        language: 'English'
    },
    kjv: {
        id: 'kjv',
        name: 'King James Version (KJV)',
        source: 'bolls',
        apiCode: 'KJV',
        language: 'English'
    },
    wlca: {
        id: 'wlca',
        name: 'Westminster Leningrad Codex (Hebrew)',
        source: 'bolls',
        apiCode: 'WLCa',
        language: 'Hebrew'
    },
    lxx: {
        id: 'lxx',
        name: 'Septuagint (Greek)',
        source: 'bolls',
        apiCode: 'LXX',
        language: 'Greek'
    },
    bulgarian: {
        id: 'bulgarian',
        name: 'Bulgarian Bible (1940)',
        source: 'local',
        language: 'Bulgarian'
    }
};

// Default translation
let currentTranslation = 'esv';

class TranslationManager {
    constructor() {
        this.currentTranslation = 'esv';
        this.loadPreference();
    }

    // Load saved translation preference
    loadPreference() {
        const saved = localStorage.getItem('bibleTranslation');
        if (saved && TRANSLATIONS[saved]) {
            this.currentTranslation = saved;
        }
    }

    // Save translation preference
    savePreference(translationId) {
        this.currentTranslation = translationId;
        localStorage.setItem('bibleTranslation', translationId);
    }

    // Get current translation info
    getCurrentTranslation() {
        return TRANSLATIONS[this.currentTranslation];
    }

    // Set translation
    setTranslation(translationId) {
        if (!TRANSLATIONS[translationId]) {
            throw new Error(`Unknown translation: ${translationId}`);
        }
        this.savePreference(translationId);
    }

    // Fetch verse from appropriate source
    async fetchVerse(reference) {
        const translation = this.getCurrentTranslation();
        return await this.fetchVerseForTranslation(reference, translation);
    }

    // Fetch verse for a specific translation (without changing current state)
    async fetchVerseForTranslation(reference, translation) {
        if (typeof translation === 'string') {
            translation = TRANSLATIONS[translation];
        }

        if (translation.source === 'bolls') {
            return await this.fetchFromBolls(reference, translation);
        } else if (translation.source === 'local') {
            return await this.fetchFromLocal(reference, translation);
        }

        throw new Error(`Unknown translation source: ${translation.source}`);
    }

    // Fetch from Bolls.life API
    async fetchFromBolls(reference, translation) {
        try {
            // Parse reference to extract book, chapter, verse
            const parsed = this.parseReference(reference);

            let url;
            if (parsed.verse) {
                // Fetch specific verse(s)
                url = `https://bolls.life/get-paralel/${translation.apiCode}/${parsed.bookNum}/${parsed.chapter}/${parsed.verse}/`;
            } else {
                // Fetch entire chapter
                url = `https://bolls.life/get-text/${translation.apiCode}/${parsed.bookNum}/${parsed.chapter}/`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch from Bolls.life: ${response.statusText}`);
            }

            const data = await response.json();

            // Transform Bolls.life response to match our format
            return this.transformBollsResponse(data, reference, translation);
        } catch (error) {
            console.error('Bolls.life API error:', error);
            throw new Error(`Failed to fetch verse: ${error.message}`);
        }
    }

    // Fetch from local Bulgarian Bible
    async fetchFromLocal(reference, translation) {
        if (translation.id === 'bulgarian') {
            return await bulgarianBible.getVerses(reference);
        }
        throw new Error(`Unknown local translation: ${translation.id}`);
    }

    // Parse reference string (e.g., "Genesis 1:1", "John 3", "Romans 8:28-39")
    parseReference(reference) {
        const match = reference.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
        if (!match) {
            throw new Error('Invalid reference format');
        }

        const bookName = match[1].trim();
        const chapter = parseInt(match[2]);
        const verse = match[3] ? parseInt(match[3]) : null;
        const endVerse = match[4] ? parseInt(match[4]) : null;

        // Map book name to number (needed for Bolls API)
        const bookNum = this.getBookNumber(bookName);

        return { bookName, bookNum, chapter, verse, endVerse };
    }

    // Get book number from name
    getBookNumber(bookName) {
        const books = {
            'genesis': 1, 'exodus': 2, 'leviticus': 3, 'numbers': 4, 'deuteronomy': 5,
            'joshua': 6, 'judges': 7, 'ruth': 8, '1 samuel': 9, '2 samuel': 10,
            '1 kings': 11, '2 kings': 12, '1 chronicles': 13, '2 chronicles': 14,
            'ezra': 15, 'nehemiah': 16, 'esther': 17, 'job': 18, 'psalms': 19, 'psalm': 19,
            'proverbs': 20, 'ecclesiastes': 21, 'song of solomon': 22, 'isaiah': 23,
            'jeremiah': 24, 'lamentations': 25, 'ezekiel': 26, 'daniel': 27,
            'hosea': 28, 'joel': 29, 'amos': 30, 'obadiah': 31, 'jonah': 32,
            'micah': 33, 'nahum': 34, 'habakkuk': 35, 'zephaniah': 36, 'haggai': 37,
            'zechariah': 38, 'malachi': 39,
            'matthew': 40, 'mark': 41, 'luke': 42, 'john': 43, 'acts': 44,
            'romans': 45, '1 corinthians': 46, '2 corinthians': 47, 'galatians': 48,
            'ephesians': 49, 'philippians': 50, 'colossians': 51, '1 thessalonians': 52,
            '2 thessalonians': 53, '1 timothy': 54, '2 timothy': 55, 'titus': 56,
            'philemon': 57, 'hebrews': 58, 'james': 59, '1 peter': 60, '2 peter': 61,
            '1 john': 62, '2 john': 63, '3 john': 64, 'jude': 65, 'revelation': 66
        };

        const num = books[bookName.toLowerCase()];
        if (!num) {
            throw new Error(`Unknown book: ${bookName}`);
        }
        return num;
    }

    // Transform Bolls.life API response to match our format
    transformBollsResponse(data, reference, translation) {
        const verses = [];

        if (Array.isArray(data)) {
            // Chapter response format
            for (const item of data) {
                verses.push({
                    verse: item.verse,
                    text: this.cleanHtmlTags(item.text),
                    rawText: this.getRawText(item.text) // Keep Strong's numbers for concordance
                });
            }
        } else if (data.text) {
            // Single verse response
            verses.push({
                verse: data.verse || 1,
                text: this.cleanHtmlTags(data.text),
                rawText: this.getRawText(data.text) // Keep Strong's numbers for concordance
            });
        }

        return {
            reference: reference,
            verses: verses,
            text: verses.map(v => v.text).join(' '),
            translation_id: translation.id,
            translation_name: translation.name
        };
    }

    // Remove HTML tags from text and hide Strong's numbers for readability
    cleanHtmlTags(html) {
        if (!html) return '';

        // Remove HTML tags
        let text = html.replace(/<[^>]*>/g, '').trim();

        // Remove Strong's numbers - they come in multiple formats:
        // Format 1: "word H1234" or "word G1234" (with H/G prefix)
        // Format 2: "בָּרָ֣א1254" (digits directly attached to Hebrew/Greek, no prefix)
        // Format 3: Standalone digits like "1234" that might be concordance references

        // Pattern 1: Strong's with H/G prefix (most aggressive removal)
        text = text.replace(/[HG]\d+/g, '');

        // Pattern 2: Digits directly attached to Hebrew/Greek Unicode characters (no H/G prefix)
        // Hebrew Unicode range: \u0590-\u05FF
        // Greek Unicode range: \u0370-\u03FF, \u1F00-\u1FFF
        text = text.replace(/([\u0590-\u05FF\u0370-\u03FF\u1F00-\u1FFF]+)\d+/g, '$1');

        // Pattern 3: Remove standalone digit sequences that look like concordance numbers
        // (1-5 digits surrounded by whitespace or punctuation)
        text = text.replace(/\s+\d{1,5}(?=\s|$|[.,;:!?])/g, '');
        text = text.replace(/^\d{1,5}\s+/g, '');

        // Pattern 4: Remove digits attached to end of English words (e.g., "created1234")
        text = text.replace(/([a-zA-Z]+)\d+/g, '$1');

        // Clean up any multiple spaces created by removal
        text = text.replace(/\s{2,}/g, ' ').trim();

        return text;
    }

    // Get raw text with Strong's numbers (for concordance extraction)
    getRawText(html) {
        if (!html) return '';
        // Only remove HTML tags, keep Strong's numbers
        return html.replace(/<[^>]*>/g, '').trim();
    }

    // Get all available translations
    getAllTranslations() {
        return Object.values(TRANSLATIONS);
    }
}

// Create global instance
const translationManager = new TranslationManager();
