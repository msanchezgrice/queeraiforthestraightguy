import os
import time
import json
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

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

def process_video_request(record):
    try:
        # Update status to processing
        supabase.table("video_generations").update({"status": "processing"}).eq("id", record["id"]).execute()
        
        # TODO: Implement actual video processing logic
        logger.info(f"Processing video request: {record['id']}")
        
        # For now, just update status to completed
        supabase.table("video_generations").update({
            "status": "completed",
            "output_path": "placeholder_output.mp4"
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