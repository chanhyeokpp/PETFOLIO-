# Pori Rive Character Specification

## Purpose

Create one reusable Pori character whose appearance stays consistent across every market state. The web app will control the character through Rive Data Binding.

Reference image: `assets/pori-rig-reference.png`

## Artboard

- Name: `PoriMarket`
- Size: `800 x 800`
- Origin: center
- Background: transparent
- Character: centered with room for jumping, tail movement, sun, clouds, and rain

## Required part hierarchy

```text
PoriRoot
├── Tail
├── Body
│   ├── Belly
│   ├── LegLeft
│   └── LegRight
├── ArmLeft
├── ArmRight
└── Head
    ├── EarLeft
    ├── EarRight
    ├── CheekLeft
    ├── CheekRight
    ├── EyeLeft
    ├── EyeRight
    ├── BrowLeft
    ├── BrowRight
    ├── Muzzle
    ├── Nose
    └── Mouth
```

Every movable part must have its own named node. Do not flatten the eyes, eyebrows, mouth, arms, legs, or tail into the body.

## Character invariants

- Cream-colored fur
- Circular mint belly
- Mint inner ears and tail tip
- No outlines: 2.5D clay look built from radial gradients, inner-feather shading (light from top-left) and a soft ground shadow
- Round head and body
- Small rounded paws and feet
- Rosy cheeks
- Friendly, non-aggressive expression
- No clothing, props, text, or background inside the character component

## Animation set

### `Idle`

- 3-second seamless loop
- Slow breathing using subtle body scale
- Blink once every 2–4 seconds
- Small tail sway
- Feet remain planted

### `Rise`

- Happy smile and raised eyebrows
- One short upward jump with squash and stretch
- Both arms lift slightly
- Tail swings upward
- Returns smoothly to `Idle`

### `Flat`

- Calm closed smile
- Gentle side-to-side body sway
- Small blink
- Minimal tail movement

### `Fall`

- Eyebrows tilt inward
- Mouth becomes a small worried curve
- Head and arms lower slightly
- Body moves down without collapsing or distorting
- Rain is handled by a separate weather component

### `Loading`

- Eyes look left and right
- Small thinking bounce
- Loops until the web changes state

### `Error`

- Brief surprised expression
- One small head tilt
- Must not look scared or distressed

## Data Binding contract

View model name: `MarketViewModel`

```text
marketState: enum { rise, flat, fall, loading, error }
changeRate: number
kospiValue: number
updatedAt: string
```

The web owns financial logic. Rive only translates `marketState` into visual animation.

## State machine

- Name: `MarketStateMachine`
- Initial state: `Loading`
- Transition to one of `Rise`, `Flat`, `Fall`, or `Error` whenever `marketState` changes
- A blink layer runs independently from market-state animation
- Weather effects run on a separate layer so they can overlap character motion

## Acceptance checks

- Pori's face and proportions do not change between states
- Every loop starts and ends without a visible jump
- Rapid state changes do not freeze the character
- The character remains readable at 320 px width
- Reduced-motion mode can show one static frame for each state
