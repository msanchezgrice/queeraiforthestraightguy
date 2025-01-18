FROM debian:bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3-venv \
    python3-pip \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install yt-dlp in the virtual environment
RUN pip install --no-cache-dir yt-dlp

# Set build arguments for environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG OPENAI_API_KEY
ARG ELEVENLABS_API_KEY
ARG ELEVENLABS_VOICE_ID_1
ARG ELEVENLABS_VOICE_ID_2

# Set environment variables
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY
ENV ELEVENLABS_VOICE_ID_1=$ELEVENLABS_VOICE_ID_1
ENV ELEVENLABS_VOICE_ID_2=$ELEVENLABS_VOICE_ID_2

# Copy application code
COPY . .

# Set the default command
CMD ["python3", "src/processor.py"] 