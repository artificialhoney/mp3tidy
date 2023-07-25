# mp3tidy

Script to cleanup mp3s, ripped from Youtube.

## Usage

**tidy**: Takes a folder of untagged mp3s, queries Discogs to obtain information and writes out tagged and properly named mp3s.

`npm run start -- tidy MP3_INPUT_FOLDER MP3_OUTPUT_FOLDER --apiKey=DISCOGS_API_KEY --apiSecret=DISCOGS_API_SECRET`

**collect**: Takes a folder of clean and tagged mp3d, queries Discogs and generates a txt file of relevant Youtube video URLs.

`npm run start -- collect MP3_INPUT_FOLDER VIDEO_LIST_FILE_PATH --apiKey=DISCOGS_API_KEY --apiSecret=DISCOGS_API_SECRET`

## Discogs

See [documentation](https://www.discogs.com/developers/#page:authentication), on how to obtain API credentials.

## License

MIT
