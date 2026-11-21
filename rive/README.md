# Petfolio Rive workspace

This folder contains the character reference and the implementation contract used to build the interactive `.riv` file.

## Files

- `assets/pori-rig-reference.png`: neutral transparent character reference
- `character-spec.md`: required node hierarchy, animations, state machine, and data contract
- `pori/scene.rml`: editable Rive scene source
- `pori/build/pori.riv`: generated runtime asset

## Runtime contract

- Artboard: `PoriMarket`
- State machine: `MarketStateMachine`
- View model: `MarketViewModel`
- `marketState`: `rise | flat | fall | loading | error`
- `changeRate`: number
- `kospiValue`: number
- `updatedAt`: string

## Local checks

```bash
rive pori --verify
rive inspect pori --summary
rive pori --screenshot --data=marketState=rise --advance=28
```

Do not change the web-side market classification rules inside Rive. The React app sends a normalized `marketState`; Rive is responsible only for visuals and interaction.

## Live market data

- Local endpoint: `/api/kospi`
- Source adapter: `server/kospi.js`
- Symbol: Yahoo Finance `^KS11`
- The UI labels this as delayed data and falls back to demo scenarios when the request fails.
- `api/kospi.js` provides the same handler shape for a Vercel deployment.
