import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  console.log(`GET /api/status/${params.id} - Checking status...`);
  try {
    const { data, error } = await supabase
      .from('video_generations')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error(`Error fetching video status for ${params.id}:`, error);
      return NextResponse.json({ error: 'Failed to fetch video status' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Video generation not found' }, { status: 404 });
    }

    console.log('Video status data:', data);

    // Always construct the video URL if there's an output path
    const response = { ...data };
    if (data.output_path) {
      response.videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-videos/${data.output_path}`;
      console.log('Constructed video URL:', response.videoUrl);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Error in status check for ${params.id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}