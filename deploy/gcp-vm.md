# Deploy to a GCP VM (via gcloud CLI)

Runs the whole stack (Postgres + FastAPI + Next.js) on a single Compute Engine
VM using `docker compose`. The VM installs Docker from a startup script; you
then clone the repo and bring the stack up.

## 0. Prerequisites
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
export PROJECT_ID=$(gcloud config get-value project)
export ZONE=us-central1-a
export VM=ecomfy-mvp
```

## 1. Firewall — open API (8000) and web (3000)
```bash
gcloud compute firewall-rules create ecomfy-allow \
  --allow=tcp:8000,tcp:3000 \
  --target-tags=ecomfy \
  --description="Ecomfy MVP api+web"
```

## 2. Create the VM (Ubuntu 22.04, Docker auto-installed)
```bash
gcloud compute instances create $VM \
  --zone=$ZONE \
  --machine-type=e2-small \
  --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
  --tags=ecomfy \
  --metadata-from-file=startup-script=deploy/startup-script.sh
```

Get the public IP:
```bash
export VM_IP=$(gcloud compute instances describe $VM --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "http://$VM_IP:3000  (web)   http://$VM_IP:8000/docs  (api)"
```

## 3. Get the code onto the VM
**Option A — clone from GitHub (recommended):**
```bash
gcloud compute ssh $VM --zone=$ZONE --command="git clone https://github.com/YOUR_USER/16-ecomfy.git ecomfy"
```
**Option B — copy local files:**
```bash
gcloud compute scp --recurse --zone=$ZONE \
  app frontend seed scripts docker-compose.yml Dockerfile requirements.txt $VM:~/ecomfy/
```

## 4. Point the frontend at the VM's public API and bring it up
The web service fetches the API server-side. For browser links to also resolve,
set the public API base before composing:
```bash
gcloud compute ssh $VM --zone=$ZONE --command="cd ~/ecomfy && \
  echo 'API_BASE_URL=http://app:8000' && \
  sudo docker compose up -d --build"
```
> SSR uses the internal `http://app:8000` (Docker network), so the web app works
> without exposing the API. Port 8000 is still opened so graders can hit `/docs`.

To enable the AI summary, pass the key:
```bash
gcloud compute ssh $VM --zone=$ZONE --command="cd ~/ecomfy && \
  ANTHROPIC_API_KEY=sk-ant-... sudo -E docker compose up -d --build"
```

## 5. Verify
```bash
curl http://$VM_IP:8000/health
bash scripts/smoke.sh http://$VM_IP:8000
# open http://$VM_IP:3000 in a browser for the dashboard
```

## 6. Tear down (stop billing)
```bash
gcloud compute instances delete $VM --zone=$ZONE --quiet
gcloud compute firewall-rules delete ecomfy-allow --quiet
```

## Notes
- **Cost**: `e2-small` is light; delete the VM when done (step 6).
- **Decouple to Cloud Functions/Run later**: the hexagonal `domain` + `application`
  are framework-free, so the same use cases can be wrapped by a Cloud Run service
  or a Function entrypoint. Only the HTTP edge (`app/api`) and the delivery adapter
  (`app/adapters/buyers`) change.
