# Use an official Python base image
FROM python:3.10

# Set the working directory in the container
WORKDIR /app

# Copy project files to the container
COPY . .

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg libsm6 libxext6 && \
    rm -rf /var/lib/apt/lists/*

# Install required Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the FastAPI port
EXPOSE 8000

# Run FastAPI application using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
