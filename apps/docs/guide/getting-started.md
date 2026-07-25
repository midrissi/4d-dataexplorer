---
title: Getting started
---

# Getting started

Install the **Data Explorer** web assets in your 4D application, open Data Explorer from the **Records** menu, or [run the Docker image](#run-with-docker) against your REST backend.

## Install Data Explorer (web)

1. Download **[DataExplorer.zip](https://github.com/midrissi/4d-dataexplorer/releases/latest/download/DataExplorer.zip)** from the [latest GitHub release](https://github.com/midrissi/4d-dataexplorer/releases/latest).
2. Extract the archive into the **`Resources/WEBJS`** folder (same path for **4D** and **4D Server**):
    - macOS: `<4D.app>/Contents/Resources/WEBJS/`
    - Windows: `<4D folder>/Resources/WEBJS/`
3. After extraction, the app files must be at **`Resources/WEBJS/DataBrowser/`** (for example `index.html` inside that folder). The zip keeps the `DataBrowser` folder name so 4D continues to serve the bundle at `/dataexplorer/`.

The REST server serves this bundle at `/dataexplorer/` once the files are in place.

## Open from 4D

Open Data Explorer from 4D so your session is passed to the browser automatically.

![Open Data Explorer from the Records menu](/screenshots/01-4d-open-in-browser.png)

1. Open your 4D project in **4D** (single-user or connected to a 4D Server).
2. In the menu bar, choose **Records** → **Data Explorer In Browser**.
3. Your default browser opens Data Explorer (for example at `http://localhost:7080/dataexplorer/`).

The app loads the catalog and dataclass metadata, then opens the **Home** screen.

## Opening via URL (access key)

If you open the URL directly in a browser (without launching from 4D) and the REST server requires authentication, Data Explorer shows an **access key** screen.

![Access key screen](/screenshots/01-access-key.png)

1. Enter your REST **access key**.
2. Click **Validate** to connect.

This path is mainly for development or when bookmarking the app outside 4D.

## Run with Docker

Serve the Data Explorer static build in a lightweight nginx container and proxy REST calls to your 4D backend.

### Pull the image

Images are published to [GitHub Container Registry](https://github.com/midrissi/4d-dataexplorer/pkgs/container/4d-dataexplorer) for `linux/amd64` and `linux/arm64`:

```bash
docker pull ghcr.io/midrissi/4d-dataexplorer:latest
```

### Run the container

Point `BACKEND_URL` at your 4D REST host (no trailing slash). The default is the Docker host on port `7080`.

```bash
docker run --rm -p 8080:80 \
  -e BACKEND_URL=http://host.docker.internal:7080 \
  -e PUBLISHED_PORT=8080 \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/midrissi/4d-dataexplorer:latest
```

The terminal shows a welcome banner with the URL to open. Then open `http://localhost:8080/dataexplorer/`.

| Flag | Purpose |
| --- | --- |
| `-p 8080:80` | Map container port 80 to a free host port (change `8080` if needed) |
| `-e BACKEND_URL=…` | 4D server that should receive `/rest`, `/api`, and related paths |
| `-e PUBLISHED_PORT=…` | Host port shown in the welcome banner (keep in sync with `-p`) |
| `--add-host=host.docker.internal:host-gateway` | Required on Linux so the container can reach the Docker host |

On Docker Desktop (macOS / Windows), `host.docker.internal` is already available; the `--add-host` flag is still safe to keep.

If the REST server requires authentication, Data Explorer shows its **access key** screen (same as [Opening via URL](#opening-via-url-access-key)).

### Build locally

From the repository root:

```bash
docker build -t dataexplorer .
docker run --rm -p 8080:80 \
  -e BACKEND_URL=http://host.docker.internal:7080 \
  -e PUBLISHED_PORT=8080 \
  --add-host=host.docker.internal:host-gateway \
  dataexplorer
```

---
