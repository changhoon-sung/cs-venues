# CS Venues

A lightweight static web app for browsing computer science conference deadlines and rankings.

The committed CCFDDL dataset is refreshed weekly from upstream [CCFDDL](https://github.com/ccfddl/ccf-deadlines).
Custom venues live outside the synced tree so they are not overwritten by upstream refreshes.

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
- `data/custom/conference/`: local venue additions that are merged into the generated dataset
- `data/custom/accept_rates/`: local acceptance-rate additions
- `scripts/build-dataset.mjs`: YAML to static JSON generator
- `scripts/sync-dataset.mjs`: sparse sync from upstream CCFDDL

## Acknowledgement

Conference data is based on the [CCFDDL dataset](https://github.com/ccfddl/ccf-deadlines).
