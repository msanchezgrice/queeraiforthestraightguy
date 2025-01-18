import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { generateConversation } from '@/utils/ai';
import { generateSpeech } from '@/utils/tts';
import { extractClips, assembleVideo } from '@/utils/video';

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Use service role for database operations
const adminAuthClient = supabase.auth.admin;

export async function GET(request: Request) {
  try {
    // Get all video generations to show status
    const { data: videos, error: fetchError } = await supabase
      .from('video_generations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching videos:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    // Check for stalled videos (processing for more than 10 minutes)
    const stalledVideos = videos?.filter(video => {
      if (video.status === 'processing') {
        const processingTime = Date.now() - new Date(video.created_at).getTime();
        return processingTime > 10 * 60 * 1000; // 10 minutes
      }
      return false;
    });

    // Update stalled videos to failed status
    if (stalledVideos && stalledVideos.length > 0) {
      console.log('Found stalled videos:', stalledVideos);
      for (const video of stalledVideos) {
        const { error: updateError } = await supabase
          .from('video_generations')
          .update({ 
            status: 'failed',
            error: 'Video processing timed out'
          })
          .eq('id', video.id);
          
        if (updateError) {
          console.error(`Failed to update stalled video ${video.id}:`, updateError);
        }
      }
    }

    return NextResponse.json({ 
      message: 'Current video processing queue',
      videos: videos || []
    });

  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json({ 
      error: 'Failed to get processing status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST /api/process - Starting...');
    // Get pending video generations
    const { data: pendingVideos, error: fetchError } = await supabase
      .from('video_generations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching pending videos:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch pending videos' }, { status: 500 });
    }

    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('No pending videos to process');
      return NextResponse.json({ message: 'No pending videos to process' });
    }

    const video = pendingVideos[0];
    console.log(`Found pending video [${video.id}]:`, video);

    // Update status to processing
    console.log(`[${video.id}] Updating status to processing...`);
    const { error: updateError } = await supabase
      .from('video_generations')
      .update({ status: 'processing' })
      .eq('id', video.id);

    if (updateError) {
      console.error(`[${video.id}] Error updating video status:`, updateError);
      return NextResponse.json({ error: 'Failed to update video status' }, { status: 500 });
    }

    // Start processing in the background
    console.log(`[${video.id}] Starting background processing...`);
    processVideo(video).catch(async (error) => {
      console.error(`[${video.id}] Error processing video:`, error);
      await supabase
        .from('video_generations')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', video.id);
    });

    return NextResponse.json({
      message: 'Started processing video',
      videoId: video.id
    });

  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json({ 
      error: 'Failed to start processing',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processVideo(video: any) {
  console.log(`[${video.id}] Starting video processing...`);
  let tempDir: string | null = null;
  
  try {
    // Update status to processing
    console.log(`[${video.id}] Updating status to processing...`);
    const { error: updateError } = await supabase
      .from('video_generations')
      .update({ status: 'processing' })
      .eq('id', video.id);

    if (updateError) {
      throw new Error('Failed to update status: ' + updateError.message);
    }

    // Create base temp directory if it doesn't exist
    const tempBaseDir = join(process.cwd(), 'temp');
    console.log(`[${video.id}] Creating temp directory at: ${tempBaseDir}`);
    await mkdir(tempBaseDir, { recursive: true });
    
    // Create video-specific directory
    tempDir = join(tempBaseDir, video.id);
    console.log(`[${video.id}] Creating video directory at: ${tempDir}`);
    await mkdir(tempDir, { recursive: true });
    
    // Create clips directory
    const clipsDir = join(tempDir, 'clips');
    console.log(`[${video.id}] Creating clips directory at: ${clipsDir}`);
    await mkdir(clipsDir, { recursive: true });

    // Clean YouTube URL by removing timestamp
    const cleanUrl = video.youtube_url.split('&')[0];
    console.log(`[${video.id}] Processing URL: ${cleanUrl}`);
    
    // Download video using yt-dlp
    const inputPath = join(tempDir, 'input.mp4');
    console.log(`[${video.id}] Downloading video to: ${inputPath}`);
    const downloadCmd = `yt-dlp -f "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${inputPath}" "${cleanUrl}"`;
    console.log(`[${video.id}] Executing download command: ${downloadCmd}`);
    const { stdout: downloadOutput, stderr: downloadError } = await execAsync(downloadCmd);
    if (downloadError) {
      console.error(`[${video.id}] Download stderr:`, downloadError);
    }
    console.log(`[${video.id}] Download output:`, downloadOutput);

    // Extract video information
    console.log(`[${video.id}] Fetching video metadata...`);
    const { stdout: videoInfo } = await execAsync(`yt-dlp -j "${cleanUrl}"`);
    const { title } = JSON.parse(videoInfo);
    console.log(`[${video.id}] Video title: ${title}`);

    // Generate AI conversation
    console.log(`[${video.id}] Generating AI conversation...`);
    const conversation = await generateConversation(
      title,
      video.config.personalities,
      video.config.commentaryStyle,
      video.config.conversationSpeed
    );
    console.log(`[${video.id}] Generated conversation:`, conversation);

    // Convert to speech
    console.log(`[${video.id}] Converting to speech...`);
    const audioPaths = await generateSpeech(conversation, tempDir);
    console.log(`[${video.id}] Generated ${audioPaths.length} audio files:`, audioPaths);

    // Extract clips
    console.log(`[${video.id}] Starting clip extraction...`);
    const clipPaths = await extractClips(
      inputPath,
      parseFloat(video.config.clipInterval),
      parseFloat(video.config.targetLength)
    );
    console.log(`[${video.id}] Extracted ${clipPaths.length} clips:`, clipPaths);

    // Assemble final video
    console.log(`[${video.id}] Assembling final video...`);
    const outputPath = await assembleVideo(clipPaths, audioPaths, join(tempDir, 'output.mp4'));
    console.log(`[${video.id}] Video assembled at: ${outputPath}`);

    // Upload to Supabase storage
    console.log(`[${video.id}] Uploading to Supabase storage...`);
    const outputBuffer = await readFile(outputPath);
    const storagePath = `${video.id}/output.mp4`;
    
    console.log(`[${video.id}] File size to upload: ${outputBuffer.length} bytes`);
    console.log(`[${video.id}] Storage path: ${storagePath}`);
    
    // Try to remove the file first, ignoring any errors
    try {
      console.log(`[${video.id}] Attempting to remove existing file...`);
      const { error: removeError } = await supabase.storage
        .from('public-videos')
        .remove([storagePath]);
      
      if (removeError) {
        console.log(`[${video.id}] Remove error (can be ignored if file doesn't exist):`, removeError);
      } else {
        console.log(`[${video.id}] Existing file removed successfully`);
      }
    } catch (error) {
      console.log(`[${video.id}] Remove operation failed:`, error);
    }

    // Wait a moment to ensure removal is processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try upload with retries
    let uploadError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[${video.id}] Upload attempt ${attempt}...`);
        const { data: uploadData, error } = await supabase.storage
          .from('public-videos')
          .upload(storagePath, outputBuffer, {
            upsert: true,
            contentType: 'video/mp4',
            cacheControl: '3600'
          });
          
        if (error) {
          console.error(`[${video.id}] Upload error on attempt ${attempt}:`, error);
          uploadError = error;
          
          if (attempt < 3) {
            console.log(`[${video.id}] Waiting 3 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          continue;
        }

        console.log(`[${video.id}] Upload successful on attempt ${attempt}`, uploadData);
        uploadError = null;
        
        // Update video status and output path in database
        console.log(`[${video.id}] Updating database with completed status...`);
        const { error: updateError } = await supabase
          .from('video_generations')
          .update({ 
            status: 'completed',
            output_path: storagePath 
          })
          .eq('id', video.id);
          
        if (updateError) {
          console.error(`[${video.id}] Failed to update video status:`, updateError);
          throw new Error('Failed to update video status: ' + updateError.message);
        }
        
        console.log(`[${video.id}] Processing completed successfully`);
        return;
      } catch (error) {
        console.error(`[${video.id}] Upload attempt ${attempt} failed with exception:`, error);
        uploadError = error;
        
        if (attempt < 3) {
          console.log(`[${video.id}] Waiting 3 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    if (uploadError) {
      throw new Error(`Failed to upload video after 3 attempts: ${JSON.stringify(uploadError)}`);
    }

  } catch (error) {
    console.error(`[${video.id}] Error processing video:`, error);
    // Update status to failed with error message
    const { error: failError } = await supabase
      .from('video_generations')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', video.id);

    if (failError) {
      console.error(`[${video.id}] Failed to update error status:`, failError);
    }
    throw error;
  } finally {
    // Clean up temp directory
    if (tempDir) {
      try {
        console.log(`[${video.id}] Cleaning up temp directory: ${tempDir}`);
        await execAsync(`rm -rf "${tempDir}"`);
      } catch (cleanupError) {
        console.error(`[${video.id}] Error cleaning up temp directory:`, cleanupError);
      }
    }
  }
}