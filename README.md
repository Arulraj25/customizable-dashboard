DashForge - Custom Dashboard Builder

DashForge is a full-stack web application that allows users to create customizable dashboards and manage customer orders. It includes a CI/CD pipeline for automated deployment using Jenkins and Docker.

Tech Stack

Backend: Flask (Python)
Frontend: HTML, CSS, JavaScript
Database: MySQL
Charts and UI: Chart.js, Gridstack.js
Containerization: Docker
CI/CD: Jenkins
Cloud: AWS EC2
Proxy: Nginx

Architecture (Simple Flow)

GitHub → Jenkins → Docker → AWS EC2

Code is pushed to GitHub

Jenkins builds and deploys

Docker containers run on EC2

Application is served using Nginx

Containers

MySQL for database

Flask application for backend

Nginx for reverse proxy

Access

Application: http://32.192.50.89:8000

Key Features

Custom dashboard builder with drag-and-drop

Multiple chart types (Bar, Line, Pie, KPI, etc.)

Customer order management (CRUD)

Filters for date range and data

Save dashboard layouts

Deployment Flow

Push code to GitHub

Jenkins pipeline runs

Code is sent to EC2

Docker image is built

Containers are started

Application goes live

Run Locally

git clone https://github.com/Arulraj25/customizable-dashboard.git
cd customizable-dashboard

cp .env.example .env

MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password_here # your database password
MYSQL_DB=dashforge_db
SECRET_KEY=change-me-in-production
FLASK_DEBUG=true

python3 -m venv venv

source venv/bin/activate

pip install -r requirements.txt


mysql -u root -p < database/schema.sql

python app.py
Open in browser: http://localhost:5000

Docker (EC2)
docker ps
docker logs dashforge-flask
docker pull arulraj25/dashforge:latest
Basic Security

SSH key-based login

Limited open ports (22, 8000, 8080)

Docker credentials managed using tokens

Author

Arulraj

GitHub: https://github.com/Arulraj25/customizable-dashboard.git