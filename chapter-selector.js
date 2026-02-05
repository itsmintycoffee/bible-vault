// Bible books and their chapter counts
const bibleBooks = {
    old: [
        { name: 'Genesis', chapters: 50 },
        { name: 'Exodus', chapters: 40 },
        { name: 'Leviticus', chapters: 27 },
        { name: 'Numbers', chapters: 36 },
        { name: 'Deuteronomy', chapters: 34 },
        { name: 'Joshua', chapters: 24 },
        { name: 'Judges', chapters: 21 },
        { name: 'Ruth', chapters: 4 },
        { name: '1 Samuel', chapters: 31 },
        { name: '2 Samuel', chapters: 24 },
        { name: '1 Kings', chapters: 22 },
        { name: '2 Kings', chapters: 25 },
        { name: '1 Chronicles', chapters: 29 },
        { name: '2 Chronicles', chapters: 36 },
        { name: 'Ezra', chapters: 10 },
        { name: 'Nehemiah', chapters: 13 },
        { name: 'Esther', chapters: 10 },
        { name: 'Job', chapters: 42 },
        { name: 'Psalms', chapters: 150 },
        { name: 'Proverbs', chapters: 31 },
        { name: 'Ecclesiastes', chapters: 12 },
        { name: 'Song of Solomon', chapters: 8 },
        { name: 'Isaiah', chapters: 66 },
        { name: 'Jeremiah', chapters: 52 },
        { name: 'Lamentations', chapters: 5 },
        { name: 'Ezekiel', chapters: 48 },
        { name: 'Daniel', chapters: 12 },
        { name: 'Hosea', chapters: 14 },
        { name: 'Joel', chapters: 3 },
        { name: 'Amos', chapters: 9 },
        { name: 'Obadiah', chapters: 1 },
        { name: 'Jonah', chapters: 4 },
        { name: 'Micah', chapters: 7 },
        { name: 'Nahum', chapters: 3 },
        { name: 'Habakkuk', chapters: 3 },
        { name: 'Zephaniah', chapters: 3 },
        { name: 'Haggai', chapters: 2 },
        { name: 'Zechariah', chapters: 14 },
        { name: 'Malachi', chapters: 4 }
    ],
    new: [
        { name: 'Matthew', chapters: 28 },
        { name: 'Mark', chapters: 16 },
        { name: 'Luke', chapters: 24 },
        { name: 'John', chapters: 21 },
        { name: 'Acts', chapters: 28 },
        { name: 'Romans', chapters: 16 },
        { name: '1 Corinthians', chapters: 16 },
        { name: '2 Corinthians', chapters: 13 },
        { name: 'Galatians', chapters: 6 },
        { name: 'Ephesians', chapters: 6 },
        { name: 'Philippians', chapters: 4 },
        { name: 'Colossians', chapters: 4 },
        { name: '1 Thessalonians', chapters: 5 },
        { name: '2 Thessalonians', chapters: 3 },
        { name: '1 Timothy', chapters: 6 },
        { name: '2 Timothy', chapters: 4 },
        { name: 'Titus', chapters: 3 },
        { name: 'Philemon', chapters: 1 },
        { name: 'Hebrews', chapters: 13 },
        { name: 'James', chapters: 5 },
        { name: '1 Peter', chapters: 5 },
        { name: '2 Peter', chapters: 3 },
        { name: '1 John', chapters: 5 },
        { name: '2 John', chapters: 1 },
        { name: '3 John', chapters: 1 },
        { name: 'Jude', chapters: 1 },
        { name: 'Revelation', chapters: 22 }
    ]
};

// DOM elements
const modal = document.getElementById('chapter-modal');
const selectorBtn = document.getElementById('chapter-selector-btn');
const closeBtn = document.querySelector('.close-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const booksList = document.getElementById('books-list');
const chaptersGrid = document.getElementById('chapters-grid');
const currentChapterDisplay = document.getElementById('current-chapter');

let currentTestament = 'old';
let selectedBook = null;

// Initialize
function init() {
    displayBooks(currentTestament);
}

// Open modal
selectorBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

// Close modal
closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// Testament tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTestament = btn.dataset.testament;
        displayBooks(currentTestament);
        chaptersGrid.innerHTML = '';
        selectedBook = null;
    });
});

// Display books for selected testament
function displayBooks(testament) {
    booksList.innerHTML = '';
    const books = bibleBooks[testament];

    books.forEach(book => {
        const bookBtn = document.createElement('button');
        bookBtn.className = 'book-item';
        bookBtn.textContent = book.name;
        bookBtn.addEventListener('click', (e) => {
            selectBook(book, e.target);
        });
        booksList.appendChild(bookBtn);
    });
}

// Select a book and display chapters
function selectBook(book, buttonElement) {
    // Update selected state
    document.querySelectorAll('.book-item').forEach(item => {
        item.classList.remove('selected');
    });
    buttonElement.classList.add('selected');

    selectedBook = book;
    displayChapters(book);
}

// Display chapter grid for selected book
function displayChapters(book) {
    chaptersGrid.innerHTML = '';

    for (let i = 1; i <= book.chapters; i++) {
        const chapterBtn = document.createElement('button');
        chapterBtn.className = 'chapter-item';
        chapterBtn.textContent = i;
        chapterBtn.addEventListener('click', () => {
            loadChapter(book.name, i);
        });
        chaptersGrid.appendChild(chapterBtn);
    }
}

// Load selected chapter
function loadChapter(bookName, chapterNum) {
    const reference = `${bookName} ${chapterNum}`;
    currentChapterDisplay.textContent = reference;
    fetchVerse(reference);
    modal.classList.add('hidden');
}

// Initialize on page load
init();
