# Concordance Data

This folder contains Strong's Concordance data for Hebrew and Greek words.

## Data Sources

You can obtain Strong's Concordance data from these open-source projects:

1. **STEPBible Data** (Recommended)
   - URL: https://github.com/STEPBible/STEPBible-Data
   - License: Creative Commons Attribution 4.0
   - Includes Strong's numbers with definitions

2. **Open Scriptures**
   - URL: https://github.com/openscriptures
   - License: CC BY-SA 4.0

3. **Blue Letter Bible API**
   - URL: https://www.blueletterbible.org/webservices/
   - Free API access with registration

## File Structure

- `hebrew/` - Hebrew Strong's numbers (H1-H8674)
- `greek/` - Greek Strong's numbers (G1-G5624)
- `index.json` - Index of all available words for quick lookup

## Setup Instructions

1. Download data from one of the sources above
2. Run the conversion script: `node concordance/convert-data.js`
3. The script will organize data into the folder structure

## Data Format

Each entry should contain:
```json
{
  "strongsNumber": "H7225",
  "word": "beginning",
  "original": "רֵאשִׁית",
  "transliteration": "reshiyth",
  "pronunciation": "ray-sheeth'",
  "definition": "The first, in place, time, order or rank...",
  "kjvUsage": "beginning, chief(-est), first(-fruits)"
}
```
