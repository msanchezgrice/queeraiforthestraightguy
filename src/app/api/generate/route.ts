import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { join } from 'path';
import { mkdir } from 'fs/promises';

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

export async function POST(request: Request) {
  try {
    const { youtubeUrl, numAgents, personalities, commentaryStyle, clipInterval, conversationSpeed, targetLength } = await request.json();

    if (!youtubeUrl) {
      return NextResponse.json({ error: 'YouTube URL is required' }, { status: 400 });
    }

    // Create temp directory if it doesn't exist
    const tempDir = join(process.cwd(), 'temp');
    await mkdir(tempDir, { recursive: true });

    try {
      // Basic URL validation
      const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!urlPattern.test(youtubeUrl)) {
        return NextResponse.json({ error: 'Invalid YouTube URL format' }, { status: 400 });
      }

      // Extract video ID
      let videoId;
      if (youtubeUrl.includes('youtu.be')) {
        videoId = youtubeUrl.split('/').pop()?.split('?')[0];
      } else {
        const urlParams = new URL(youtubeUrl).searchParams;
        videoId = urlParams.get('v');
      }

      if (!videoId) {
        return NextResponse.json({ error: 'Could not extract video ID' }, { status: 400 });
      }

      // Store metadata in Supabase
      const { data: videoData, error: videoError } = await supabase
        .from('video_generations')
        .insert({
          youtube_url: youtubeUrl,
          video_id: videoId,
          status: 'pending',
          config: {
            numAgents,
            personalities,
            commentaryStyle,
            clipInterval,
            conversationSpeed,
            targetLength
          }
        })
        .select()
        .single();

      if (videoError) {
        console.error('Error storing video metadata:', videoError);
        return NextResponse.json({ error: 'Failed to store video metadata' }, { status: 500 });
      }

      // Trigger video processing
      console.log('Triggering video processing...');
      const requestUrl = new URL(request.url);
      const processUrl = new URL('/api/process', requestUrl.origin);
      console.log('Process URL:', processUrl.toString());
      const processRes = await fetch(processUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!processRes.ok) {
        const processError = await processRes.json();
        console.error('Error triggering video processing:', processError);
        return NextResponse.json({ error: 'Failed to start video processing' }, { status: 500 });
      }

      // Return success with video ID and generation ID
      return NextResponse.json({
        message: 'Video generation request received',
        videoId: videoData.id,
        status: 'pending'
      });

    } catch (error) {
      console.error('Error processing request:', error);
      return NextResponse.json({ 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 