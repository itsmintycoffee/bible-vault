// Reading Controls - Parallel View, Text Size, Audio
// Handles UI controls for enhanced Bible reading experience

class ReadingControls {
    constructor() {
        this.isParallelMode = false;
        this.parallelTranslation = null;
        this.currentTextSize = 'medium';
        this.isAudioPlaying = false;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;

        this.initializeControls();
    }

    initializeControls() {
        // Parallel view toggle
        const parallelToggle = document.getElementById('parallel-toggle');
        const parallelSelector = document.getElementById('parallel-selector');
        const parallelTranslationSelector = document.getElementById('parallel-translation-selector');

        if (parallelToggle) {
            parallelToggle.addEventListener('click', () => {
                this.toggleParallelView();
            });
        }

        if (parallelTranslationSelector) {
            parallelTranslationSelector.addEventListener('change', async (e) => {
                this.parallelTranslation = e.target.value;
                if (this.isParallelMode && this.parallelTranslation) {
                    await this.refreshParallelView();
                }
            });
        }

        // Text size controls
        const textSizeToggle = document.getElementById('text-size-toggle');
        const textSizeControls = document.getElementById('text-size-controls');
        const sizeButtons = document.querySelectorAll('.size-btn');

        if (textSizeToggle) {
            textSizeToggle.addEventListener('click', () => {
                textSizeControls.classList.toggle('hidden');
            });
        }

        sizeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const size = e.target.dataset.size;
                this.setTextSize(size);
            });
        });

        // Audio controls removed

        // Load saved preferences
        this.loadPreferences();
    }

    // Parallel View Functions
    toggleParallelView() {
        this.isParallelMode = !this.isParallelMode;
        const parallelToggle = document.getElementById('parallel-toggle');
        const parallelSelector = document.getElementById('parallel-selector');
        const parallelTranslationSelector = document.getElementById('parallel-translation-selector');

        if (this.isParallelMode) {
            // Auto-select comparison translation based on current selection
            const currentTranslation = translationManager.getCurrentTranslation().id;
            let autoCompareTranslation;

            if (currentTranslation === 'esv' || currentTranslation === 'kjv') {
                autoCompareTranslation = 'bulgarian';
            } else if (currentTranslation === 'bulgarian') {
                autoCompareTranslation = 'esv';
            } else {
                // Hebrew/Greek defaults to ESV
                autoCompareTranslation = 'esv';
            }

            // Set parallel translation selector
            if (parallelTranslationSelector) {
                parallelTranslationSelector.value = autoCompareTranslation;
                this.parallelTranslation = autoCompareTranslation;
            }

            parallelToggle.classList.add('active');
            parallelSelector.classList.remove('hidden');

            // Immediately refresh with auto-selected translation
            this.refreshParallelView();
        } else {
            parallelToggle.classList.remove('active');
            parallelSelector.classList.add('hidden');
            // Switch back to single column view
            this.renderSingleView();
        }

        // Save preference
        localStorage.setItem('parallelMode', this.isParallelMode);
    }

    async refreshParallelView() {
        if (!this.parallelTranslation) return;

        const currentRef = `${currentBook} ${currentChapter}`;

        // Fetch both translations
        const primaryData = await translationManager.fetchVerse(currentRef);

        // Temporarily switch translation to fetch parallel
        const originalTranslation = translationManager.currentTranslation;
        translationManager.currentTranslation = this.parallelTranslation;
        const parallelData = await translationManager.fetchVerse(currentRef);
        translationManager.currentTranslation = originalTranslation;

        // Render parallel view
        this.renderParallelView(primaryData, parallelData);
    }

    renderParallelView(primaryData, parallelData) {
        const verseContent = document.getElementById('verse-content');
        const bibleContent = verseContent.closest('.bible-content');

        // Add parallel view class
        bibleContent.classList.add('parallel-view');

        // Create parallel columns
        const primaryTranslation = translationManager.getCurrentTranslation();
        const parallelTranslation = TRANSLATIONS[this.parallelTranslation];

        const parallelHTML = `
            <div class="parallel-column">
                <div class="parallel-column-header">${primaryTranslation.name}</div>
                <div class="chapter-section">
                    <div class="chapter-title">${primaryData.reference}</div>
                    <div class="chapter-content">${formatVerseText(primaryData)}</div>
                </div>
            </div>
            <div class="parallel-column">
                <div class="parallel-column-header">${parallelTranslation.name}</div>
                <div class="chapter-section">
                    <div class="chapter-title">${parallelData.reference}</div>
                    <div class="chapter-content">${formatVerseText(parallelData)}</div>
                </div>
            </div>
        `;

        verseContent.innerHTML = parallelHTML;
    }

    renderSingleView() {
        const verseContent = document.getElementById('verse-content');
        const bibleContent = verseContent.closest('.bible-content');

        // Remove parallel view class
        bibleContent.classList.remove('parallel-view');

        // Reload current chapter in single view
        const currentRef = `${currentBook} ${currentChapter}`;
        fetchVerse(currentRef);
    }

    // Text Size Functions
    setTextSize(size) {
        this.currentTextSize = size;
        const bibleContent = document.querySelector('.bible-content');

        // Remove all size classes
        bibleContent.classList.remove('text-small', 'text-medium', 'text-large');

        // Add new size class
        bibleContent.classList.add(`text-${size}`);

        // Update button states
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.size === size) {
                btn.classList.add('active');
            }
        });

        // Save preference
        localStorage.setItem('textSize', size);
    }

    // Audio Functions
    toggleAudio() {
        if (this.isAudioPlaying) {
            this.stopAudio();
        } else {
            this.startAudio();
        }
    }

    startAudio() {
        const verseContent = document.getElementById('verse-content');
        const textContent = verseContent.textContent;

        if (!textContent) return;

        // Stop any ongoing speech
        this.speechSynthesis.cancel();

        // Create utterance
        this.currentUtterance = new SpeechSynthesisUtterance(textContent);

        // Get appropriate voice based on translation
        const currentTranslation = translationManager.getCurrentTranslation();
        const voices = this.speechSynthesis.getVoices();

        // Try to find appropriate language voice
        let voice = null;
        if (currentTranslation.language === 'Bulgarian') {
            voice = voices.find(v => v.lang.startsWith('bg'));
        } else if (currentTranslation.language === 'Hebrew') {
            voice = voices.find(v => v.lang.startsWith('he'));
        } else if (currentTranslation.language === 'Greek') {
            voice = voices.find(v => v.lang.startsWith('el'));
        } else {
            voice = voices.find(v => v.lang.startsWith('en'));
        }

        if (voice) {
            this.currentUtterance.voice = voice;
        }

        // Set properties
        this.currentUtterance.rate = 0.9;
        this.currentUtterance.pitch = 1;

        // Event handlers
        this.currentUtterance.onend = () => {
            this.isAudioPlaying = false;
            document.getElementById('audio-toggle').classList.remove('active');
        };

        // Start speaking
        this.speechSynthesis.speak(this.currentUtterance);
        this.isAudioPlaying = true;
        document.getElementById('audio-toggle').classList.add('active');
    }

    stopAudio() {
        this.speechSynthesis.cancel();
        this.isAudioPlaying = false;
        document.getElementById('audio-toggle').classList.remove('active');
    }

    // Load saved preferences
    loadPreferences() {
        // Load text size
        const savedTextSize = localStorage.getItem('textSize');
        if (savedTextSize) {
            this.setTextSize(savedTextSize);
        }

        // Load parallel mode
        const savedParallelMode = localStorage.getItem('parallelMode');
        if (savedParallelMode === 'true') {
            this.isParallelMode = true;
            document.getElementById('parallel-toggle').classList.add('active');
            document.getElementById('parallel-selector').classList.remove('hidden');
        }
    }
}

// Create global instance
const readingControls = new ReadingControls();
