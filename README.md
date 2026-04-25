# Pocket Lighthouse

A top-down browser game inspired by the visual style of **Zelda: Link's Awakening**. Sweep your lighthouse beam to guide boats safely to harbor through increasingly treacherous seas.

## How to play

Open `index.html` in any modern browser. No server needed.

- **◀ / ▶** — rotate the beam left or right
- **PULSE** — fire a brief wide burst of light (costs charge)
- **Start** — begin a new run

## The game

Your lighthouse sits on a small island at the center of the sea. Boats arrive from all four edges of the screen and need your light to find their way home.

### Guidance

When your beam touches a boat, it fills up its **guidance** — a sense of direction that persists even after the light moves on. In calm weather a quick sweep is enough. As the storm builds, boats lose their bearing faster and need continuous illumination.

### Weather

The sea gets steadily worse over time:

| Level | Name | Effect |
|---|---|---|
| 0 | Calm | Boats hold direction well |
| 1 | Mist | Guidance decays slightly faster |
| 2 | Rain | Faster decay, sea monsters appear |
| 3 | Gale | Boats panic quickly without light |
| 4 | Wild | Every dark second is dangerous |

### Rocks

Four rock clusters guard the approaches to the island. Unlit boats drift and smash into them. Lit boats actively steer around them.

### Sea monsters

When the weather turns to Rain or worse, creatures surface in the dark. They hunt the boats your beam doesn't reach. Get the light on a monster to drive it away — hold it there long enough and it dies.

### Upgrades

Your lighthouse improves as you rack up points:

| Score | Upgrade |
|---|---|
| 12 | Faster beam sweep |
| 28 | Longer beam reach |
| 55 | Wider beam arc |

### Scoring

Bigger boats are worth more:

- Small boat — 1 point
- Medium boat — 2 points
- Large boat — 3 points

## Design philosophy

Pure Canvas 2D, no frameworks, no images, no build step. The visual style draws from the chunky outlines, bright blues and greens, and animated water of Link's Awakening — all rendered with primitives at runtime.
