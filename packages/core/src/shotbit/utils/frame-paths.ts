import { mkdir, readdir, rm } from 'fs/promises';
import path from 'node:path';
import ffmpeg from '../../ffmpeg/index.js';
import { GetFramePathsOptions } from './types.js';
import { tmpdir } from 'node:os';

async function getCachedDirectoryNames(): Promise<string[]> {
  const directoryContent = await readdir(tmpdir(), { withFileTypes: true });

  const directoryNames = directoryContent
    .filter(
      (dirent) => dirent.isDirectory() && dirent.name.startsWith('shotbit'),
    )
    .map((dirent) => dirent.name);

  return directoryNames;
}

async function findCachedDirectory(
  videoName: string,
): Promise<string | undefined> {
  const directoryNames = await getCachedDirectoryNames();

  const cachedDirectory = directoryNames.find(
    (directoryName) => directoryName.split(/shotbit-/)[1] === videoName,
  );

  return cachedDirectory ? path.join(tmpdir(), cachedDirectory) : undefined;
}

async function createFramesDirectory(videoName: string): Promise<string> {
  const directoryName = `shotbit-${videoName}`;
  const framesDirectory = path.join(tmpdir(), directoryName);
  await mkdir(framesDirectory);

  return framesDirectory;
}

export async function removeCachedDirectory(videoPath: string): Promise<void> {
  const videoFileName = path.basename(videoPath);
  const videoName = path.parse(videoFileName).name;

  const directoryContent = await readdir(tmpdir(), { withFileTypes: true });

  const cachedDirectories = directoryContent
    .filter(
      (dirent) =>
        dirent.isDirectory() &&
        dirent.name.startsWith('shotbit') &&
        dirent.name.split(/shotbit-/)[1] === videoName,
    )
    .map((dirent) => path.join(tmpdir(), dirent.name));

  for (const directoryPath of cachedDirectories) {
    await rm(directoryPath, { force: true, recursive: true });
  }
}

export async function getFramePaths(
  videoPath: string,
  options: GetFramePathsOptions,
): Promise<string[]> {
  const videoFileName = path.basename(videoPath);
  const videoName = path.parse(videoFileName).name;

  let cachedDirectory: string | undefined;

  if (options.noCache) {
    await removeCachedDirectory(videoPath);
  } else {
    cachedDirectory = await findCachedDirectory(videoName);
  }

  let framesDirectory: string;
  if (cachedDirectory) {
    framesDirectory = cachedDirectory;
  } else {
    framesDirectory = await createFramesDirectory(videoName);
    await ffmpeg.extractFrames(videoPath, framesDirectory);
  }

  const paths = (await readdir(framesDirectory))
    .map((framePath) => path.join(framesDirectory, framePath))
    .sort((a, b) => {
      a = path.basename(a);
      b = path.basename(b);

      const [aNumber] = a.match(/\d+/) as RegExpMatchArray;
      const [bNumber] = b.match(/\d+/) as RegExpMatchArray;

      return Number(aNumber) - Number(bNumber);
    });

  return paths;
}

export async function createDirIfNotExists(path: string): Promise<void> {
  try {
    await mkdir(path);
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && err.code === 'EEXIST') {
      return;
    }
    throw err;
  }
}
