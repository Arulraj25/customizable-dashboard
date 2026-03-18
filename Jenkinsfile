pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE = 'arulraj25/dashforge'
        DOCKER_TAG = "${BUILD_NUMBER}"
        
        EC2_PUBLIC_IP = '32.192.50.89'
        EC2_USER = 'ec2-user'
        SSH_CREDENTIALS_ID = 'aws-ec2-key'
        
        APP_PORT = '8000'
        
        MYSQL_ROOT_PASSWORD = 'rootpassword123'
        MYSQL_DATABASE = 'dashforge_db'
        MYSQL_USER = 'dashforge'
        MYSQL_PASSWORD = 'dashforgepass456'
        SECRET_KEY = "jenkins-prod-${BUILD_NUMBER}"
    }
    
    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Arulraj25/customizable-dashboard.git',
                    credentialsId: 'github_credentials'
            }
        }
        
        stage('Transfer Code to EC2') {
            steps {
                sshagent(credentials: [SSH_CREDENTIALS_ID]) {
                    sh """
                        # Create temp directory on EC2
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} 'mkdir -p /tmp/dashforge-build'
                        
                        # Copy code to EC2
                        rsync -avz --exclude '.git' --exclude 'Jenkinsfile' -e "ssh -o StrictHostKeyChecking=no" ./ ${EC2_USER}@${EC2_PUBLIC_IP}:/tmp/dashforge-build/
                    """
                }
            }
        }
        
        stage('Build Docker Image on EC2') {
            steps {
                sshagent(credentials: [SSH_CREDENTIALS_ID]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} '
                            cd /tmp/dashforge-build
                            echo "🐳 Building Docker image on EC2..."
                            docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
                            docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:latest
                            echo "✅ Docker image built: ${DOCKER_IMAGE}:${DOCKER_TAG}"
                        '
                    """
                }
            }
        }
        
        stage('Push to Docker Hub from EC2') {
            steps {
                withCredentials([string(credentialsId: 'docker-hub-credentials', variable: 'DOCKER_PASS')]) {
                    sshagent(credentials: [SSH_CREDENTIALS_ID]) {
                        sh """
                            ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} '
                                echo "📤 Pushing to Docker Hub from EC2..."
                                echo "${DOCKER_PASS}" | docker login -u arulraj25 --password-stdin
                                docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                                docker push ${DOCKER_IMAGE}:latest
                                echo "✅ Image pushed to Docker Hub"
                            '
                        """
                    }
                }
            }
        }
        
        stage('Deploy Application on EC2') {
            steps {
                sshagent(credentials: [SSH_CREDENTIALS_ID]) {
                    sh """
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} '
                            set -e
                            echo "🚀 Starting deployment on EC2..."
                            
                            # Stop and remove old containers
                            echo "🧹 Cleaning up old containers..."
                            docker stop dashforge-mysql dashforge-flask dashforge-nginx 2>/dev/null || true
                            docker rm dashforge-mysql dashforge-flask dashforge-nginx 2>/dev/null || true
                            
                            # Create network and volumes
                            docker network create dashforge-network 2>/dev/null || true
                            docker volume create mysql-data 2>/dev/null || true
                            docker volume create static-data 2>/dev/null || true
                            
                            # Start MySQL
                            echo "📦 Starting MySQL container..."
                            docker run -d \\
                                --name dashforge-mysql \\
                                --network dashforge-network \\
                                -e MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD} \\
                                -e MYSQL_DATABASE=${MYSQL_DATABASE} \\
                                -e MYSQL_USER=${MYSQL_USER} \\
                                -e MYSQL_PASSWORD=${MYSQL_PASSWORD} \\
                                -v mysql-data:/var/lib/mysql \\
                                mysql:8.0 \\
                                --character-set-server=utf8mb4 \\
                                --collation-server=utf8mb4_unicode_ci
                            
                            echo "⏳ Waiting for MySQL to be ready..."
                            sleep 20
                            
                            # Initialize database schema
                            echo "🗄️ Initializing database schema..."
                            docker exec -i dashforge-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} << "EOF"
                            CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE};
                            USE ${MYSQL_DATABASE};
                            
                            CREATE TABLE IF NOT EXISTS customer_orders (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                first_name VARCHAR(100) NOT NULL,
                                last_name VARCHAR(100) NOT NULL,
                                email VARCHAR(255) NOT NULL,
                                phone VARCHAR(20) NOT NULL,
                                street VARCHAR(255),
                                city VARCHAR(100),
                                state VARCHAR(50),
                                postal_code VARCHAR(20),
                                country VARCHAR(100),
                                product VARCHAR(100) NOT NULL,
                                quantity INT NOT NULL,
                                unit_price DECIMAL(10,2) NOT NULL,
                                total_amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
                                status ENUM("Pending","In progress","Completed") DEFAULT "Pending",
                                created_by VARCHAR(100) NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                            
                            CREATE TABLE IF NOT EXISTS dashboard_layout (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                name VARCHAR(255) NOT NULL,
                                layout JSON NOT NULL,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                            
                            CREATE TABLE IF NOT EXISTS dashboard_history (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                dashboard_id INT NOT NULL,
                                commit_msg VARCHAR(255) NOT NULL,
                                layout JSON NOT NULL,
                                committed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (dashboard_id) REFERENCES dashboard_layout(id) ON DELETE CASCADE
                            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                            
                            -- Insert sample data
                            INSERT IGNORE INTO customer_orders (first_name, last_name, email, phone, product, quantity, unit_price, status, created_by)
                            VALUES 
                                ("John", "Doe", "john@example.com", "555-0101", "Fiber Internet 300 Mbps", 1, 49.99, "Completed", "Admin"),
                                ("Jane", "Smith", "jane@example.com", "555-0102", "5G Unlimited Mobile Plan", 2, 29.99, "In progress", "Admin"),
                                ("Bob", "Johnson", "bob@example.com", "555-0103", "Fiber Internet 1 Gbps", 1, 89.99, "Pending", "Admin");
EOF
                            
                            echo "✅ Database initialized successfully"
                            
                            # Start Flask application
                            echo "🐍 Starting Flask application..."
                            docker run -d \\
                                --name dashforge-flask \\
                                --network dashforge-network \\
                                -e MYSQL_HOST=dashforge-mysql \\
                                -e MYSQL_USER=${MYSQL_USER} \\
                                -e MYSQL_PASSWORD=${MYSQL_PASSWORD} \\
                                -e MYSQL_DB=${MYSQL_DATABASE} \\
                                -e SECRET_KEY=${SECRET_KEY} \\
                                -e FLASK_DEBUG=false \\
                                -v static-data:/app/static \\
                                ${DOCKER_IMAGE}:latest
                            
                            echo "⏳ Waiting for Flask to start..."
                            sleep 10
                            
                            # Create Nginx configuration
                            echo "🌐 Configuring Nginx..."
                            cat > /tmp/nginx.conf << "NGINX_EOF"
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
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
    }
}
NGINX_EOF
                            
                            # Start Nginx
                            echo "🚀 Starting Nginx reverse proxy..."
                            docker run -d \\
                                --name dashforge-nginx \\
                                --network dashforge-network \\
                                -p ${APP_PORT}:80 \\
                                -v static-data:/static:ro \\
                                -v /tmp/nginx.conf:/etc/nginx/nginx.conf:ro \\
                                nginx:1.25-alpine
                            
                            echo "✅ All containers started successfully!"
                            
                            # Show container status
                            echo ""
                            echo "📊 Container Status:"
                            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
                            
                            # Test application
                            echo ""
                            echo "🔍 Testing application health..."
                            sleep 5
                            curl -f http://localhost:${APP_PORT} && echo "✅ Application is healthy!" || echo "❌ Health check failed"
                        '
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo """
            ╔══════════════════════════════════════════════════════════╗
            ║                                                          ║
            ║   ✅ DEPLOYMENT SUCCESSFUL!                              ║
            ║                                                          ║
            ║   📱 Application URL: http://${EC2_PUBLIC_IP}:${APP_PORT}  ║
            ║   🔨 Build Number: ${BUILD_NUMBER}                       ║
            ║                                                          ║
            ╚══════════════════════════════════════════════════════════╝
            """
        }
        failure {
            echo "❌ Deployment Failed! Check logs above."
        }
    }
}