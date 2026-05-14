#!/usr/bin/env python3
"""Verify POSCI contracts on sourcify.dev when forge's verify-contract
cannot reach Etherscan (and refuses to honour --verifier sourcify when
ETHERSCAN_API_KEY is set, which is foundry bug #11099)."""

import json
import sys
import os
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent

CONTRACTS = [
    ('out/POSCIToken.sol/POSCIToken.json',     '0xFbcF59DE93B4c62e0EEe21280c9EAA75AFb1E26c'),
    ('out/POSCIMining.sol/POSCIMining.json',   '0x37f9663Ef548b8192a73F54930D8Cd40ea1D1eAa'),
    ('out/POSCIGenesis.sol/POSCIGenesis.json', '0x77Ba7F769341948cdE3C085d39B2C4ec572649Dd'),
]

def submit(artifact_path: str, address: str):
    artifact = json.load(open(ROOT / artifact_path, encoding='utf-8'))
    metadata_str = artifact['rawMetadata']
    metadata = json.loads(metadata_str)

    # Build files list: metadata.json + each source file.
    files = [('files', ('metadata.json', metadata_str, 'application/json'))]

    for source_path in metadata['sources']:
        full = ROOT / source_path
        if not full.exists():
            print(f'  ! source missing: {source_path}')
            continue
        files.append(('files', (source_path, open(full, encoding='utf-8').read(), 'text/plain')))

    data = {'address': address, 'chain': '1'}
    print(f'  POST {len(files)} files to sourcify ...')
    resp = requests.post('https://sourcify.dev/server/verify', data=data, files=files, timeout=60)
    try:
        out = resp.json()
        if 'result' in out:
            for r in out['result']:
                status = r.get('status') or r.get('message') or 'unknown'
                print(f'  → {address}  status={status}')
        else:
            print(f'  → {address}  raw={out}')
    except ValueError:
        print(f'  → HTTP {resp.status_code}: {resp.text[:200]}')

for path, addr in CONTRACTS:
    name = Path(path).stem
    print(f'==> {name} ({addr})')
    submit(path, addr)
