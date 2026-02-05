// Fetch and convert STEPBible Strong's Concordance data
// STEPBible Data: https://github.com/STEPBible/STEPBible-Data
// License: Creative Commons Attribution 4.0

const fs = require('fs').promises;
const https = require('https');
const path = require('path');

// STEPBible data URLs
const HEBREW_LEXICON_URL = 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt';
const GREEK_LEXICON_URL = 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt';

// Fetch file from URL
function fetchFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Parse TSV data (STEPBible format has no column headers, data starts after intro text)
function parseTSV(data) {
    const lines = data.split('\n');

    return lines
        .filter(line => {
            // Only include lines that start with H or G followed by digits (Strong's numbers)
            return line.trim() && /^[HG]\d+/.test(line);
        })
        .map(line => {
            const values = line.split('\t');
            // STEPBible TSV format columns:
            // 0: StrongsNumber, 1: Relationship, 2: Related, 3: Original,
            // 4: Transliteration, 5: Morph, 6: Gloss, 7: Definition
            return {
                StrongsNumber: values[0] || '',
                Original: values[3] || '',
                Transliteration: values[4] || '',
                Morph: values[5] || '',
                Gloss: values[6] || '',
                Definition: values[7] || ''
            };
        });
}

// Convert STEPBible entry to our format
function convertEntry(entry, isHebrew) {
    // Clean up HTML tags from definition
    const cleanDefinition = (entry.Definition || '')
        .replace(/<BR>/gi, '\n')
        .replace(/<br>/gi, '\n')
        .replace(/<i>/gi, '')
        .replace(/<\/i>/gi, '')
        .replace(/<[^>]*>/g, '');

    return {
        strongsNumber: entry.StrongsNumber,
        word: entry.Gloss || '',
        original: entry.Original || '',
        transliteration: entry.Transliteration || '',
        pronunciation: '',
        partOfSpeech: entry.Morph || '',
        definition: cleanDefinition,
        kjvUsage: entry.Gloss || '',
        occurrences: 0
    };
}

// Generate word variations for better matching
function getWordVariations(word) {
    const variations = [word];

    // Remove "to " prefix from infinitives
    if (word.startsWith('to ')) {
        const base = word.substring(3);
        variations.push(base);

        // Add common verb forms
        if (base.endsWith('e')) {
            variations.push(base + 'd');       // create -> created
            variations.push(base.slice(0, -1) + 'ing'); // create -> creating
        } else if (base.endsWith('y')) {
            variations.push(base.slice(0, -1) + 'ied');  // cry -> cried
            variations.push(base + 'ing');               // cry -> crying
        } else {
            variations.push(base + 'ed');      // work -> worked
            variations.push(base + 'ing');     // work -> working
            variations.push(base + 'd');       // hear -> heard
        }

        // Add -s form for third person
        if (base.endsWith('s') || base.endsWith('x') || base.endsWith('ch') || base.endsWith('sh')) {
            variations.push(base + 'es');
        } else if (base.endsWith('y')) {
            variations.push(base.slice(0, -1) + 'ies');
        } else {
            variations.push(base + 's');
        }
    }

    // Add plural forms for nouns
    if (!word.startsWith('to ') && !word.includes(' ')) {
        if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
            variations.push(word + 'es');
        } else if (word.endsWith('y') && word.length > 2) {
            const prevChar = word[word.length - 2];
            if (!'aeiou'.includes(prevChar)) {
                variations.push(word.slice(0, -1) + 'ies');
            } else {
                variations.push(word + 's');
            }
        } else if (word.endsWith('f')) {
            variations.push(word.slice(0, -1) + 'ves');
        } else if (word.endsWith('fe')) {
            variations.push(word.slice(0, -2) + 'ves');
        } else {
            variations.push(word + 's');
        }
    }

    return variations;
}

// Build word index
function buildIndex(entries, isHebrew) {
    const index = {};

    entries.forEach(entry => {
        const word = (entry.word || '').toLowerCase().trim();
        const gloss = (entry.gloss || '').toLowerCase().trim();

        if (word) {
            index[word] = entry.strongsNumber;
        }

        // Also index by gloss if different from word
        if (gloss && gloss !== word) {
            index[gloss] = entry.strongsNumber;
        }
    });

    return index;
}

// Main function
async function main() {
    console.log('Fetching STEPBible concordance data...\n');

    try {
        // Create directories
        await fs.mkdir(path.join(__dirname, 'hebrew'), { recursive: true });
        await fs.mkdir(path.join(__dirname, 'greek'), { recursive: true });

        // Fetch Hebrew lexicon
        console.log('Downloading Hebrew lexicon...');
        const hebrewData = await fetchFile(HEBREW_LEXICON_URL);
        console.log('✓ Hebrew lexicon downloaded');

        // Fetch Greek lexicon
        console.log('Downloading Greek lexicon...');
        const greekData = await fetchFile(GREEK_LEXICON_URL);
        console.log('✓ Greek lexicon downloaded\n');

        // Parse data
        console.log('Parsing data...');
        const hebrewEntries = parseTSV(hebrewData);
        const greekEntries = parseTSV(greekData);
        console.log(`✓ Parsed ${hebrewEntries.length} Hebrew entries`);
        console.log(`✓ Parsed ${greekEntries.length} Greek entries\n`);

        // Convert and save Hebrew entries
        console.log('Converting Hebrew entries...');
        const hebrewIndex = {};
        let hebrewCount = 0;

        for (const entry of hebrewEntries) {
            const converted = convertEntry(entry, true);
            const filename = `${converted.strongsNumber}.json`;

            await fs.writeFile(
                path.join(__dirname, 'hebrew', filename),
                JSON.stringify(converted, null, 2)
            );

            // Build index with word variations
            const words = (entry.Gloss || '').toLowerCase().split(/[,;/]+/).map(w => w.trim());
            words.forEach(word => {
                if (word && word.length > 2) {
                    // Add the base word and all its variations
                    const variations = getWordVariations(word);
                    variations.forEach(variation => {
                        if (variation && variation.length > 2) {
                            hebrewIndex[variation] = converted.strongsNumber;
                        }
                    });
                }
            });

            hebrewCount++;
        }
        console.log(`✓ Saved ${hebrewCount} Hebrew concordance files`);

        // Convert and save Greek entries
        console.log('Converting Greek entries...');
        const greekIndex = {};
        let greekCount = 0;

        for (const entry of greekEntries) {
            const converted = convertEntry(entry, false);
            const filename = `${converted.strongsNumber}.json`;

            await fs.writeFile(
                path.join(__dirname, 'greek', filename),
                JSON.stringify(converted, null, 2)
            );

            // Build index with word variations
            const words = (entry.Gloss || '').toLowerCase().split(/[,;/]+/).map(w => w.trim());
            words.forEach(word => {
                if (word && word.length > 2) {
                    // Add the base word and all its variations
                    const variations = getWordVariations(word);
                    variations.forEach(variation => {
                        if (variation && variation.length > 2) {
                            greekIndex[variation] = converted.strongsNumber;
                        }
                    });
                }
            });

            greekCount++;
        }
        console.log(`✓ Saved ${greekCount} Greek concordance files\n`);

        // Save index
        console.log('Building index...');
        const index = {
            hebrew: hebrewIndex,
            greek: greekIndex
        };

        await fs.writeFile(
            path.join(__dirname, 'index.json'),
            JSON.stringify(index, null, 2)
        );
        console.log(`✓ Index saved with ${Object.keys(hebrewIndex).length} Hebrew words and ${Object.keys(greekIndex).length} Greek words\n`);

        console.log('✅ All done! Concordance data successfully downloaded and converted.');
        console.log('\nYou can now use the concordance in your Bible study app!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main };
