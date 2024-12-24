## Cleanup previous points

### Files to clean:

- `events_full_snap_mainnet.json`
- `events_snap_mainnet.json`
- `final_data_mainnet.json`
- `points_mainnet.json`

Afterwards set transaction hash from which the counting will start in `previous_config_mainnet.json` and `consts.ts`, `FULL_SNAP_START_TX_HASH`

To ensure correctness of new snapshot data, first snap be taken by running `npm run snap` or by CI job `Create Snapshot of Points`

## TESTNET MULTIPOOL TESTING

If you want to clear all previous data jut clear files:

- `events_full_snap_testnet.json`
- `events_snap_testnet.json`
- `final_data_testnet.json`
- `last_snap_data.json`
- `points_testnet.json`
- `pools_last_tx_hashes_testnet.json`

1. Add desired pool and points per second to `PROMOTED_POOLS_TESTNET` object (`consts.ts` file)
2. `./snap.sh`

If the pool is new there will be no problem with it but if its not the points will count from saturday when we launched points.
If you want to count points from certain point of time, you need to insert another row in `pools_last_tx_hashes_testnet.json` file.
`"pool":"tx hash"`

`last_snap_data.json` file shows how many points should have been distributed during last snap and how much was actually distributed (it may start working after second `snap.sh` because it works between snaps)

For validating how much total points should have been distributed and how much were actually distributed run `ts-node ./scripts/validate-points-distribution.ts`

Results may be wrong when points per second variable changes between snaps on certain pool.
