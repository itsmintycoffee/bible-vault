// Bulgarian Bible Parser
// Parses the Bulgarian Bible (1940) text file format: book||chapter||verse||text

// Book number to name mapping
const BOOK_NAMES = {
    // Old Testament
    1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
    6: 'Joshua', 7: 'Judges', 8: 'Ruth', 9: '1 Samuel', 10: '2 Samuel',
    11: '1 Kings', 12: '2 Kings', 13: '1 Chronicles', 14: '2 Chronicles',
    15: 'Ezra', 16: 'Nehemiah', 17: 'Esther', 18: 'Job', 19: 'Psalms',
    20: 'Proverbs', 21: 'Ecclesiastes', 22: 'Song of Solomon', 23: 'Isaiah',
    24: 'Jeremiah', 25: 'Lamentations', 26: 'Ezekiel', 27: 'Daniel',
    28: 'Hosea', 29: 'Joel', 30: 'Amos', 31: 'Obadiah', 32: 'Jonah',
    33: 'Micah', 34: 'Nahum', 35: 'Habakkuk', 36: 'Zephaniah', 37: 'Haggai',
    38: 'Zechariah', 39: 'Malachi',
    // New Testament
    40: 'Matthew', 41: 'Mark', 42: 'Luke', 43: 'John', 44: 'Acts',
    45: 'Romans', 46: '1 Corinthians', 47: '2 Corinthians', 48: 'Galatians',
    49: 'Ephesians', 50: 'Philippians', 51: 'Colossians', 52: '1 Thessalonians',
    53: '2 Thessalonians', 54: '1 Timothy', 55: '2 Timothy', 56: 'Titus',
    57: 'Philemon', 58: 'Hebrews', 59: 'James', 60: '1 Peter', 61: '2 Peter',
    62: '1 John', 63: '2 John', 64: '3 John', 65: 'Jude', 66: 'Revelation'
};

// Reverse mapping for book name to number
const BOOK_NAME_TO_NUMBER = {};
for (const [num, name] of Object.entries(BOOK_NAMES)) {
    BOOK_NAME_TO_NUMBER[name.toLowerCase()] = parseInt(num);
}

class BulgarianBibleParser {
    constructor() {
        this.data = null;
        this.isLoaded = false;
    }

    // Load and parse the Bulgarian Bible text file
    async load() {
        if (this.isLoaded) return;

        try {
            const response = await fetch('bulgarian_bible_1940.txt');
            const text = await response.text();

            // Parse the text into a structured format
            this.data = {};
            const lines = text.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;

                const parts = line.split('||');
                if (parts.length !== 4) continue;

                const [bookNum, chapterNum, verseNum, verseText] = parts;
                const book = parseInt(bookNum);
                const chapter = parseInt(chapterNum);
                const verse = parseInt(verseNum);

                // Initialize nested structure
                if (!this.data[book]) {
                    this.data[book] = {};
                }
                if (!this.data[book][chapter]) {
                    this.data[book][chapter] = {};
                }

                this.data[book][chapter][verse] = verseText;
            }

            this.isLoaded = true;
            console.log('Bulgarian Bible loaded successfully');
        } catch (error) {
            console.error('Failed to load Bulgarian Bible:', error);
            throw error;
        }
    }

    // Parse reference string like "Genesis 1:1" or "Genesis 1" or "John 3:16"
    parseReference(reference) {
        reference = reference.trim();

        // Match patterns like "Genesis 1:1" or "Genesis 1:1-5" or "Genesis 1"
        const match = reference.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);

        if (!match) {
            throw new Error('Invalid reference format');
        }

        const bookName = match[1];
        const chapter = parseInt(match[2]);
        const startVerse = match[3] ? parseInt(match[3]) : null;
        const endVerse = match[4] ? parseInt(match[4]) : null;

        // Find book number
        const bookNum = BOOK_NAME_TO_NUMBER[bookName.toLowerCase()];
        if (!bookNum) {
            throw new Error(`Unknown book: ${bookName}`);
        }

        return { bookNum, bookName, chapter, startVerse, endVerse };
    }

    // Get verses for a reference
    async getVerses(reference) {
        await this.load();

        const { bookNum, bookName, chapter, startVerse, endVerse } = this.parseReference(reference);

        // Check if book and chapter exist
        if (!this.data[bookNum] || !this.data[bookNum][chapter]) {
            throw new Error(`Chapter not found: ${reference}`);
        }

        const chapterData = this.data[bookNum][chapter];
        const verses = [];

        if (startVerse) {
            // Get specific verse(s)
            const end = endVerse || startVerse;
            for (let v = startVerse; v <= end; v++) {
                if (chapterData[v]) {
                    verses.push({
                        book: bookNum,
                        bookname: bookName,
                        chapter: chapter,
                        verse: v,
                        text: chapterData[v]
                    });
                }
            }
        } else {
            // Get entire chapter
            const verseNumbers = Object.keys(chapterData).map(v => parseInt(v)).sort((a, b) => a - b);
            for (const v of verseNumbers) {
                verses.push({
                    book: bookNum,
                    bookname: bookName,
                    chapter: chapter,
                    verse: v,
                    text: chapterData[v]
                });
            }
        }

        // Format response to match API format
        return {
            reference: startVerse ?
                `${bookName} ${chapter}:${startVerse}${endVerse ? `-${endVerse}` : ''}` :
                `${bookName} ${chapter}`,
            verses: verses,
            text: verses.map(v => v.text).join(' '),
            translation_id: 'bulgarian1940',
            translation_name: 'Bulgarian Bible (1940)',
            translation_note: 'Bulgarian Bible translation from 1940'
        };
    }
}

// Create global instance
const bulgarianBible = new BulgarianBibleParser();
