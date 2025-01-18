# Queer Eye for the AI

Transform your YouTube content with AI-powered commentary. This application generates humorous AI commentary for YouTube videos using OpenAI for conversation generation and ElevenLabs for text-to-speech.

## Features

- Generate AI commentary for YouTube videos
- Customize number of AI agents (2-4)
- Define unique personalities for each agent
- Choose commentary style (roast, praise, cerebral)
- Adjust clip sampling interval and video length
- Control conversation speed
- Automatic video processing and assembly

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- OpenAI API
- ElevenLabs API
- Supabase (storage and database)
- FFmpeg for video processing

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (see below)
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# App URL (for local development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase Setup

1. Create a new Supabase project
2. Create a storage bucket named `public-videos`
3. Set up the following storage policy for the `public-videos` bucket:
   ```sql
   CREATE POLICY "Public Access"
   ON storage.objects FOR ALL
   USING (bucket_id = 'public-videos');
   ```
4. Create a table named `video_generations` with the following schema:
   ```sql
   id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
   youtube_url TEXT NOT NULL,
   video_id TEXT NOT NULL,
   status TEXT DEFAULT 'pending'::text,
   config JSONB,
   audio_path TEXT,
   video_path TEXT,
   output_path TEXT,
   error TEXT
   ```

## Development Requirements

- Node.js 18+
- FFmpeg installed on your system
- YouTube-DL installed on your system

## License

MIT 