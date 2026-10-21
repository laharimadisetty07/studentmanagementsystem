#!/usr/bin/env bash
set -e

echo "======================================================"
echo " 🎓 Student Management System — EC2 Setup & Deploy "
echo "======================================================"

echo "[1/4] Updating package index..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release

echo "[2/4] Setting up Docker repository..."
sudo install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
fi

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y

echo "[3/4] Installing Docker Engine & Compose plugin..."
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group
sudo usermod -aG docker "$USER" || true

echo "[4/4] Building and launching Student Management containers..."
sudo docker compose up --build -d

echo "======================================================"
echo " ✅ Deployment completed successfully!"
echo "======================================================"
sudo docker compose ps
echo ""
echo "Access your app at: http://<EC2-PUBLIC-IP>:8080"
echo "Access API docs at: http://<EC2-PUBLIC-IP>:8000/docs"
