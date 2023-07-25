import { resolve, extname, basename, join, dirname } from 'path'
import { existsSync } from 'fs'
import { readdir, mkdir, copyFile, writeFile } from 'fs/promises'
import minimist from 'minimist'
import NodeID3 from 'node-id3'
import axios from 'axios'
import sanitize from 'sanitize-filename'

const editDistance = (s1: string, s2: string) => {
  s1 = s1.toLowerCase()
  s2 = s2.toLowerCase()

  const costs = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i == 0) costs[j] = j
      else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

const similarity = (s1: string, s2: string) => {
  let longer = s1
  let shorter = s2
  if (s1.length < s2.length) {
    longer = s2
    shorter = s1
  }
  const longerLength = longer.length
  if (longerLength == 0) {
    return 1.0
  }
  return (longerLength - editDistance(longer, shorter)) / longerLength
}

const getFiles = async function* (dir: string): AsyncGenerator<string> {
  const dirents = await readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}

const tidy = async (rootDir: string, outDir: string, key: string, secret: string) => {
  rootDir = resolve(rootDir)
  outDir = resolve(outDir)
  console.log('Starting tidy')

  for await (const f of getFiles(rootDir)) {
    if (extname(f).toLowerCase() !== '.mp3') {
      continue
    }

    const stripped = basename(f, '.mp3').replaceAll(/\(.+\)|\[.+\]/g, '')

    console.log('Searching Discogs:', stripped)
    const { data } = await axios.get<any, { data: { results: any[] } }>(
      'https://api.discogs.com/database/search',
      {
        params: {
          key,
          q: stripped,
          secret,
          type: 'release',
        },
      }
    )

    const dir = join(outDir, dirname(f).replace(rootDir, ''))

    if (!existsSync(dir)) {
      console.log('Creating directory', dir)
      await mkdir(dir, { recursive: true })
    }

    if (data.results.length !== 0) {
      await new Promise((f) => setTimeout(f, 2500))
      const response = await axios.get(data.results[0].resource_url)
      const { artists, genres, tracklist, year } = response.data
      const artist = artists.map((a: any) => a.name).join(', ')
      const tracks = tracklist
        .map((t: any) => ({
          similarity: similarity(t.title.toLowerCase(), stripped.replace(artist, '').toLowerCase()),
          title: t.title,
        }))
        .sort((a: any, b: any) => b.similarity - a.similarity)
      const title = tracks[0].title
      const genre = genres[0]
      const fileUrl = `https://www.discogs.com${data.results[0].uri}`
      const dest = join(dir, `${sanitize(artist + ' - ' + title)}.mp3`)

      console.log('Got result from Disogs, copying file:', dest)
      await copyFile(f, dest)

      const tags: NodeID3.Tags = {
        artist,
        fileUrl,
        genre,
        title,
        year: year.toString(),
      }

      if (data.results[0].cover_image) {
        const imageBuffer = await axios
          .get(data.results[0].cover_image, { responseType: 'arraybuffer' })
          .then((response) => {
            return Buffer.from(response.data, 'base64')
          })
        tags.image = {
          description: artist + ' - ' + title,
          imageBuffer,
          mime: 'image/jpeg',
          type: {
            id: NodeID3.TagConstants.AttachedPicture.PictureType.FRONT_COVER,
          },
        }
      }

      console.log('Writing ID3 Tag to file:', tags)

      await NodeID3.Promise.write(tags, dest)
    } else {
      console.log('No result from Disogs, copying original file')
      await copyFile(f, join(dir, basename(f)))
    }

    await new Promise((f) => setTimeout(f, 2500))
  }
}

const collect = async (rootDir: string, outFile: string, key: string, secret: string) => {
  rootDir = resolve(rootDir)
  console.log('Starting collect')
  const videos = []
  for await (const f of getFiles(rootDir)) {
    if (extname(f).toLowerCase() !== '.mp3') {
      continue
    }

    console.log('Reading ID3 tags', f)
    const tags = await NodeID3.Promise.read(f)

    if (!tags.fileUrl) {
      console.log('No file URL found, Skipping')
      continue
    }

    const match = tags.fileUrl.match(/.+\/(\d+).?/)
    const url = `https://api.discogs.com/releases/${match![1]}`
    console.log('Fetching from Discogs:', url)
    const response = await axios.get<any, { data: any }>(url, {
      params: {
        key,
        secret,
      },
    })

    response.data.videos && videos.push(...response.data.videos.map((v: any) => v.uri))

    await new Promise((f) => setTimeout(f, 2500))
  }

  console.log('Writing collected video list:', outFile)

  await writeFile(outFile, videos.join('\n'))
}

const args = minimist(process.argv.slice(2))

if (args._[0] === 'collect') {
  collect(args._[1], args._[2], args.apiKey, args.apiSecret)
} else if (args._[0] === 'tidy' || args._.length === 2) {
  const index = args._[0] === 'tidy' ? 1 : 0
  tidy(args._[index], args._[index + 1], args.apiKey, args.apiSecret)
} else {
  console.log('Nothing to do. Exiting.')
}
