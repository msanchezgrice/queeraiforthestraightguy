import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { writeFile } from 'fs/promises';

const execAsync = promisify(exec);

export async function extractClips(
  videoPath: string,
  interval: number,
  targetLength: number
): Promise<string[]> {
  try {
    // Get video duration using ffprobe
    const { stdout: durationStr } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const duration = parseFloat(durationStr);
    
    // Calculate number of clips based on interval and target length
    const numClips = Math.min(
      Math.floor(duration / interval),
      Math.ceil(targetLength / interval)
    );
    
    const clipPaths: string[] = [];
    const outputDir = join(videoPath, '../clips');
    
    // Extract clips
    for (let i = 0; i < numClips; i++) {
      const startTime = i * interval;
      const clipPath = join(outputDir, `clip_${i}.mp4`);
      clipPaths.push(clipPath);
      
      // Extract clip and convert to vertical format (9:16 aspect ratio)
      await execAsync(
        `ffmpeg -i "${videoPath}" -ss ${startTime} -t ${interval} -vf "crop=ih*9/16:ih,scale=720:1280" -y "${clipPath}"`
      );
    }
    
    return clipPaths;
  } catch (error) {
    console.error('Error in extractClips:', error);
    throw error;
  }
}

export async function assembleVideo(
  clipPaths: string[],
  audioPaths: string[],
  outputPath: string
): Promise<string> {
  try {
    // Create concat file for video clips
    const concatFile = join(outputPath, '../concat.txt');
    const concatContent = clipPaths.map(path => `file '${path}'`).join('\n');
    await writeFile(concatFile, concatContent);
    
    // Concatenate video clips without audio
    await execAsync(
      `ffmpeg -f concat -safe 0 -i "${concatFile}" -c:v copy -an "${outputPath}.temp.mp4"`
    );
    
    // Create audio concat file
    const audioConcatFile = join(outputPath, '../audio_concat.txt');
    const audioConcatContent = audioPaths.map(path => `file '${path}'`).join('\n');
    await writeFile(audioConcatFile, audioConcatContent);
    
    // Concatenate audio files
    await execAsync(
      `ffmpeg -f concat -safe 0 -i "${audioConcatFile}" "${outputPath}.audio.mp3"`
    );
    
    // Combine video with generated audio only
    await execAsync(
      `ffmpeg -i "${outputPath}.temp.mp4" -i "${outputPath}.audio.mp3" -c:v copy -c:a aac -shortest "${outputPath}"`
    );
    
    return outputPath;
  } catch (error) {
    console.error('Error in assembleVideo:', error);
    throw error;
  }
}