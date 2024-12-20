## Cleanup previous points

### Files to clean:

- `events_full_snap_mainnet.json`
- `events_snap_mainnet.json`
- `final_data_mainnet.json`
- `points_mainnet.json`

Afterwards set transaction hash from which the counting will start in `previous_config_mainnet.json` and `consts.ts`, `FULL_SNAP_START_TX_HASH`

To ensure correctness of new snapshot data, first snap be taken by running `npm run snap` or by CI job `Create Snapshot of Points`
