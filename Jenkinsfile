pipeline {
    agent any
    
    environment {
        // Docker Hub configuration - using your credentials
        DOCKER_IMAGE = 'arulraj25/dashforge'  // Your Docker Hub username
        DOCKER_TAG = "${BUILD_NUMBER}"
        
        // Application configuration
        APP_PORT = '8000'
        EC2_IP = '32.192.50.89'
    }
    
    stages {
        stage('Checkout') {
            steps {
                // Using your GitHub credentials
                git branch: 'main',
                    url: 'https://github.com/Arulraj25/dashforge.git',
                    credentialsId: 'github-credentials'
            }
        }
        
        stage('Create Environment File') {
            steps {
                script {
                    sh '''
                        cat > .env << EOF
MYSQL_ROOT_PASSWORD=rootpassword123
MYSQL_USER=dashforge
MYSQL_PASSWORD=dashforgepass456
MYSQL_DB=dashforge_db
SECRET_KEY=jenkins-${BUILD_NUMBER}-prod-secret
FLASK_DEBUG=false
EOF
                    '''
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
                    sh "docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest"
                }
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                script {
                    // Using your Docker Hub credentials
                    sh """
                        echo "${DOCKER_HUB_TOKEN}" | docker login -u arulraj25 --password-stdin
                        docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                        docker push ${DOCKER_IMAGE}:latest
                    """
                }
            }
        }
        
        stage('Deploy on EC2') {
            steps {
                script {
                    sh '''
                        # Stop and remove old containers
                        docker stop dashforge-flask dashforge-mysql dashforge-nginx 2>/dev/null || true
                        docker rm dashforge-flask dashforge-mysql dashforge-nginx 2>/dev/null || true
                        
                        # Create network
                        docker network create dashforge-network 2>/dev/null || true
                        
                        # Start MySQL
                        docker run -d \\
                            --name dashforge-mysql \\
                            --network dashforge-network \\
                            -e MYSQL_ROOT_PASSWORD=rootpassword123 \\
                            -e MYSQL_DATABASE=dashforge_db \\
                            -e MYSQL_USER=dashforge \\
                            -e MYSQL_PASSWORD=dashforgepass456 \\
                            -v mysql-data:/var/lib/mysql \\
                            mysql:8.0 \\
                            --character-set-server=utf8mb4 \\
                            --collation-server=utf8mb4_unicode_ci
                        
                        # Wait for MySQL
                        sleep 15
                        
                        # Initialize database
                        docker exec -i dashforge-mysql mysql -u root -prootpassword123 dashforge_db < database/schema.sql 2>/dev/null || true
                        
                        # Start Flask app
                        docker run -d \\
                            --name dashforge-flask \\
                            --network dashforge-network \\
                            -e MYSQL_HOST=dashforge-mysql \\
                            -e MYSQL_USER=dashforge \\
                            -e MYSQL_PASSWORD=dashforgepass456 \\
                            -e MYSQL_DB=dashforge_db \\
                            -e SECRET_KEY=prod-secret-${BUILD_NUMBER} \\
                            -e FLASK_DEBUG=false \\
                            -v static-data:/app/static \\
                            arulraj25/dashforge:latest
                        
                        # Create nginx config
                        cat > /tmp/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    server_tokens off;
    
    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
    
    upstream flask_app {
        server dashforge-flask:5000;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        location /static/ {
            alias /static/;
            expires 30d;
        }
        
        location / {
            proxy_pass http://flask_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
EOF
                        
                        # Start Nginx
                        docker run -d \\
                            --name dashforge-nginx \\
                            --network dashforge-network \\
                            -p 8000:80 \\
                            -v static-data:/static:ro \\
                            -v /tmp/nginx.conf:/etc/nginx/nginx.conf:ro \\
                            nginx:1.25-alpine
                    '''
                }
            }
        }
        
        stage('Health Check') {
            steps {
                script {
                    sleep(10)
                    sh """
                        curl -f http://localhost:8000 || exit 1
                        echo "✅ Application is running!"
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo "✅ Deployment Successful!"
            echo "Access your app at: http://32.192.50.89:8000"
        }
        failure {
            echo "❌ Deployment Failed"
            sh "docker logs dashforge-flask 2>/dev/null || true"
        }
        always {
            sh "docker system prune -f"
        }
    }
}