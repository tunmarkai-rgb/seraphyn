# DigitalOcean Deployment Guide

This guide deploys the Seraphyn backend to your existing DigitalOcean Droplet while keeping the frontend on Vercel.

## Final Architecture

- Frontend: `https://staffing.seraphyncare.com`
- Backend API: `https://api.seraphyncare.com`
- GHL webhook endpoint: `https://api.seraphyncare.com/api/webhooks/ghl`
- n8n stays on the same Droplet at its current host

## Before You Start

You need:

- your Droplet public IP
- GitHub repo URL
- SSH access to the Droplet
- DNS access for `seraphyncare.com`
- the real backend `.env` values

## Step 1. Create DNS For The API

Create an `A` record:

- Host: `api`
- Value: `YOUR_DROPLET_IP`

Check propagation from your machine:

```bash
nslookup api.seraphyncare.com
```

## Step 2. SSH Into The Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

If you use a non-root sudo user:

```bash
ssh YOUR_USER@YOUR_DROPLET_IP
```

## Step 3. Install Node, Nginx, Git, PM2

Assuming Ubuntu:

```bash
apt update
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

Verify:

```bash
node -v
npm -v
pm2 -v
nginx -v
```

## Step 4. Add Swap

Because your Droplet is `1 vCPU / 1 GB RAM` and already runs n8n, add swap now.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

## Step 5. Clone The Repo

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git seraphyn
cd /var/www/seraphyn
```

If the repo already exists:

```bash
cd /var/www/seraphyn
git pull origin main
```

## Step 6. Create The Backend `.env`

Create the root backend env:

```bash
nano /var/www/seraphyn/.env
```

Paste this and fill any missing values:

```env
SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
CLIENT_URL=https://staffing.seraphyncare.com
CLIENT_URLS=https://staffing.seraphyncare.com
CORS_ORIGINS=https://staffing.seraphyncare.com
PORT=5000

GHL_API_KEY=your_ghl_private_integration_token
GHL_LOCATION_ID=B508soKQSaXweoYGJGaF
GHL_DOCUMENT_TEMPLATE_ID=69ed8d60324445de5d7aa17a
GHL_USER_ID=1YzQlhdKo2Au4wgwOEkD
GHL_WEBHOOK_SECRET=your_ghl_webhook_secret
GHL_WORKFLOW_WEBHOOK_URL=
GHL_WORKFLOW_WEBHOOK_SECRET=

N8N_WEBHOOK_URL=https://n8n.seraphyncare.com/webhook/seraphyn-events
N8N_WEBHOOK_SECRET=your_n8n_webhook_secret

OPENAI_API_KEY=
```

Notes:

- Leave `OPENAI_API_KEY` blank until Kundayi gives it to you.
- Do not put server secrets in `client/.env`.
- Leave `GHL_WORKFLOW_WEBHOOK_URL` blank until the inbound GHL workflow webhook is created.
- If GHL uses different inbound URLs per workflow, use per-event env names instead, such as `GHL_WORKFLOW_WEBHOOK_URL_NURSE_SIGNUP_CONFIRMED` or `GHL_WORKFLOW_WEBHOOK_URL_EMPLOYER_APPROVED`.

## Step 7. Install Backend Dependencies

```bash
cd /var/www/seraphyn/server
npm install
```

## Step 8. Test The Backend Locally On The Droplet

```bash
cd /var/www/seraphyn/server
node index.js
```

Open a second terminal and SSH in again, then test:

```bash
curl http://localhost:5000/api/health
```

Expected result: JSON health response.

Stop the process with:

```bash
Ctrl + C
```

## Step 9. Run The Backend With PM2

```bash
cd /var/www/seraphyn/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Run the extra command PM2 prints after `pm2 startup`.

Then verify:

```bash
pm2 status
curl http://localhost:5000/api/health
```

Useful PM2 commands:

```bash
pm2 logs seraphyn-api
pm2 restart seraphyn-api
pm2 stop seraphyn-api
pm2 delete seraphyn-api
pm2 show seraphyn-api
```

## Step 10. Configure Nginx

Create the site config:

```bash
nano /etc/nginx/sites-available/seraphyn-api
```

Paste the checked-in template from [deploy/nginx/seraphyn-api.conf](../deploy/nginx/seraphyn-api.conf) or use:

```nginx
server {
    listen 80;
    server_name api.seraphyncare.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
ln -s /etc/nginx/sites-available/seraphyn-api /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Test over HTTP:

```bash
curl http://api.seraphyncare.com/api/health
```

## Step 11. Add HTTPS With Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.seraphyncare.com
```

Then verify:

```bash
curl https://api.seraphyncare.com/api/health
curl https://api.seraphyncare.com/api/ready
curl https://api.seraphyncare.com/healthz
```

## Step 12. Check Firewall

If you use UFW:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

If UFW is already active, just confirm ports 80 and 443 are open.

## Step 13. Update Vercel Frontend Environment Variables

In your Vercel project for the frontend, set:

```env
VITE_SUPABASE_URL=https://rchydpjwyfpxuexnipwk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_T5lKSQrDlWUCXFj_l2a9kQ_LFrRaKSi
VITE_API_URL=https://api.seraphyncare.com
```

Then redeploy the frontend.

## Step 14. Confirm The Live API Works

From your machine:

```bash
curl https://api.seraphyncare.com/api/health
```

Expected result:

- status is `ok`
- database says `connected`
- readiness reports required envs are present

## Step 15. Use The Real GHL Webhook URL

After the backend is live, the correct GHL webhook URL is:

```text
https://api.seraphyncare.com/api/webhooks/ghl
```

Use this header in GHL:

```text
x-ghl-webhook-secret: your_ghl_webhook_secret
```

For optional portal milestone fan-out into GHL workflows, fastest launch is:

- one shared inbound workflow webhook URL in `GHL_WORKFLOW_WEBHOOK_URL`

Per-event split remains available later if needed:

- `GHL_WORKFLOW_WEBHOOK_URL_NURSE_SIGNUP_CONFIRMED`
- `GHL_WORKFLOW_WEBHOOK_URL_NURSE_DOCUMENT_UPLOADED`
- `GHL_WORKFLOW_WEBHOOK_URL_EMPLOYER_SIGNUP_CONFIRMED`
- `GHL_WORKFLOW_WEBHOOK_URL_EMPLOYER_APPROVED`
- `GHL_WORKFLOW_WEBHOOK_URL_EMPLOYER_CONTRACT_SENT`
- `GHL_WORKFLOW_WEBHOOK_URL_EMPLOYER_CONTRACT_SIGNED`
- `GHL_WORKFLOW_WEBHOOK_URL_APPLICATION_INTERVIEW_SCHEDULED`
- `GHL_WORKFLOW_WEBHOOK_URL_APPLICATION_HIRED`

If you use a shared secret for those workflow webhooks, set:

```text
GHL_WORKFLOW_WEBHOOK_SECRET=YOUR_SHARED_SECRET
```

## Step 16. Test Contract Flow

After deploy:

1. log in as admin
2. open an employer in the admin portal
3. click `Sync GHL Contact` if needed
4. click `Send Contract`
5. confirm GHL sends the Staffing Agreement
6. sign the agreement from the recipient side
7. confirm the employer updates to signed in the portal

## Step 17. Deploy Updates Later

Whenever you push new code:

```bash
ssh root@YOUR_DROPLET_IP
cd /var/www/seraphyn
git pull origin main
cd /var/www/seraphyn/server
npm install
pm2 restart seraphyn-api
pm2 logs seraphyn-api
```

If frontend code changed too, redeploy on Vercel.

## Troubleshooting

### Health endpoint fails

Check PM2:

```bash
pm2 logs seraphyn-api
pm2 status
```

Check env file:

```bash
cat /var/www/seraphyn/.env
```

Check readiness separately:

```bash
curl http://localhost:5000/api/ready
curl http://localhost:5000/healthz
```

### Nginx fails

```bash
nginx -t
systemctl status nginx
journalctl -u nginx --no-pager -n 100
```

### Domain not resolving

```bash
nslookup api.seraphyncare.com
dig api.seraphyncare.com
```

### Port 5000 works locally but domain fails

Likely causes:

- DNS not ready
- Nginx not enabled
- firewall blocking 80 or 443
- SSL not issued yet

### Backend crashes from low memory

Check memory:

```bash
free -h
pm2 monit
```

If needed later:

- move backend to a separate Droplet
- upgrade RAM
- reduce n8n concurrency

## Final Values You Should End Up With

- frontend: `https://staffing.seraphyncare.com`
- backend: `https://api.seraphyncare.com`
- Vercel `VITE_API_URL`: `https://api.seraphyncare.com`
- GHL webhook: `https://api.seraphyncare.com/api/webhooks/ghl`

## Optional Quick Copy Block

If you want the shortest possible command sequence after SSH:

```bash
apt update
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO.git seraphyn
cd /var/www/seraphyn/server
npm install
node index.js
```

Then continue with:

- create `/var/www/seraphyn/.env`
- `pm2 start index.js --name seraphyn-api`
- configure Nginx
- issue SSL
- update Vercel env
