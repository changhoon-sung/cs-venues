# CS Venues

A lightweight static web app for browsing computer science conference deadlines
and rankings.

Data is sourced from the CCFDDL dataset in `data/ccfddl/`.
The build step generates `public/data/conferences.json` from those YAML files.

## Development

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
```

To refresh the local CCFDDL dataset before building:

```sh
npm run build:latest
```

Deployment builds from the dataset already committed in this repository.
Upstream CCFDDL sync runs separately once a week through GitHub Actions.

## Data

- `data/ccfddl/conference/`: venue metadata, rankings, events, and deadlines
- `data/ccfddl/accept_rates/`: historical acceptance rates
- `scripts/build-dataset.mjs`: YAML to static JSON generator
- `scripts/sync-dataset.mjs`: sparse sync from upstream CCFDDL
