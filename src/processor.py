import os
import time
import json
import logging
import tempfile
from pathlib import Path
import yt_dlp
import openai
from elevenlabs import generate, set_api_key
from supabase import create_client, Client
from dotenv import load_dotenv
from moviepy.editor import VideoFileClip, AudioFileClip, CompositeVideoClip

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize ElevenLabs
set_api_key(os.getenv("ELEVENLABS_API_KEY"))

def download_youtube_video(video_url, output_path):
    """Download a YouTube video."""
    ydl_opts = {
        'format': 'best[height<=720]',  # Limit to 720p
        'outtmpl': output_path,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            logger.info(f"Downloading video from {video_url}")
            ydl.download([video_url])
            return True
        except Exception as e:
            logger.error(f"Error downloading video: {str(e)}")
            raise

def generate_commentary(video_url):
    """Generate commentary using OpenAI."""
    try:
        logger.info("Generating commentary")
        response = openai.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[
                {
                    "role": "system",
                    "content": "You are the Fab Five from Queer Eye. Generate commentary for a YouTube video in their style. Be fabulous, supportive, and fun!"
                },
                {
                    "role": "user",
                    "content": f"Generate commentary for this YouTube video: {video_url}. Make it sound like the Fab Five are watching and commenting on it. Keep it under 2 minutes when spoken."
                }
            ],
            temperature=0.7,
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating commentary: {str(e)}")
        raise

def generate_audio(text, voice_id):
    """Generate audio using ElevenLabs."""
    try:
        logger.info("Generating audio")
        audio = generate(
            text=text,
            voice=voice_id,
            model="eleven_multilingual_v2"
        )
        return audio
    except Exception as e:
        logger.error(f"Error generating audio: {str(e)}")
        raise

def process_video(video_path, audio_path, output_path):
    """Combine video and audio."""
    try:
        logger.info("Processing video")
        video = VideoFileClip(video_path)
        audio = AudioFileClip(audio_path)
        
        # Create final video with both original and commentary audio
        final = CompositeVideoClip([video])
        final = final.set_audio(audio)
        
        # Write the result
        final.write_videofile(output_path, codec='libx264', audio_codec='aac')
        
        # Clean up
        video.close()
        audio.close()
        final.close()
        
        return True
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        raise

def upload_to_storage(file_path, record_id):
    """Upload a file to Supabase storage."""
    try:
        logger.info(f"Uploading file to storage: {file_path}")
        bucket_name = "processed-videos"
        
        # Ensure the bucket exists
        try:
            supabase.storage.get_bucket(bucket_name)
        except:
            supabase.storage.create_bucket(bucket_name)
        
        # Upload file
        with open(file_path, 'rb') as f:
            file_name = f"{record_id}.mp4"
            supabase.storage.from_(bucket_name).upload(file_name, f)
            
        # Get public URL
        file_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
        return file_url
        
    except Exception as e:
        logger.error(f"Error uploading to storage: {str(e)}")
        raise

def process_video_request(record):
    try:
        # Update status to processing
        supabase.table("video_generations").update({"status": "processing"}).eq("id", record["id"]).execute()
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir = Path(temp_dir)
            
            # Download video
            video_path = str(temp_dir / "input.mp4")
            download_youtube_video(record["youtube_url"], video_path)
            
            # Generate commentary
            commentary = generate_commentary(record["youtube_url"])
            
            # Generate audio
            audio = generate_audio(commentary, os.getenv("ELEVENLABS_VOICE_ID_1"))
            audio_path = str(temp_dir / "commentary.mp3")
            with open(audio_path, "wb") as f:
                f.write(audio)
            
            # Process video
            output_path = str(temp_dir / "output.mp4")
            process_video(video_path, audio_path, output_path)
            
            # Upload to storage and get public URL
            output_url = upload_to_storage(output_path, record["id"])
            
            # Update record with completed status and output URL
            supabase.table("video_generations").update({
                "status": "completed",
                "output_path": output_url
            }).eq("id", record["id"]).execute()
        
    except Exception as e:
        logger.error(f"Error processing video request {record['id']}: {str(e)}")
        supabase.table("video_generations").update({
            "status": "error",
            "error": str(e)
        }).eq("id", record["id"]).execute()

def main():
    logger.info("Video processor service starting...")
    
    while True:
        try:
            # Query for pending requests
            response = supabase.table("video_generations").select("*").eq("status", "pending").execute()
            
            if response.data:
                for record in response.data:
                    process_video_request(record)
            
            # Sleep for a bit before checking again
            time.sleep(5)
            
        except Exception as e:
            logger.error(f"Error in main loop: {str(e)}")
            time.sleep(5)

if __name__ == "__main__":
    main() 