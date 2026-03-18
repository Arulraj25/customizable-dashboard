FROM python:3.11-slim-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create static directory
RUN mkdir -p /app/static

# Expose port
EXPOSE 5000

# CRITICAL FIX: Run Flask on 0.0.0.0 to accept connections from other containers
CMD ["python", "-c", "from app import app; app.run(host='0.0.0.0', port=5000, debug=False)"]