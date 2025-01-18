FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install yt-dlp in virtual environment
RUN pip3 install yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy app source
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG SUPABASE_SERVICE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG OPENAI_API_KEY
ARG ELEVENLABS_API_KEY
ARG ELEVENLABS_VOICE_ID_1
ARG ELEVENLABS_VOICE_ID_2

# Set environment variables for build
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY
ENV ELEVENLABS_VOICE_ID_1=$ELEVENLABS_VOICE_ID_1
ENV ELEVENLABS_VOICE_ID_2=$ELEVENLABS_VOICE_ID_2

# Build the app
RUN npm run build

# Start the app
CMD ["npm", "start"] 