# Cerria Commercial Block Layout & Shop Buildings Specification

**Status:** Locked Owner Spec (26 Nov) · Phase 0 Foundation

## 1. Block & Avenue Layout (16 Lots across 4 Blocks)

Commercial rows north (`z ∈ [-108, -52]`) and south (`z ∈ [+52, +108]`) of the Tram Ring are organized into **4 blocks of 4 lots** between **3 widened N-S avenues**:

| Road | World X | Old State | New State (Amendment 2 Cross-Section) |
| :--- | :---: | :--- | :--- |
| Road 1 — **West Avenue** | `x = -60.0` | 7.8 m wide | **14.4 m total:** `2 m` sidewalk + `10.4 m` road + `2 m` sidewalk |
| Road 2 — West Divider | `x = -30.0` | 7.8 m road | **Closed** → becomes West Block center line |
| Road 3 — **Central Avenue** | `x = 0.0` | 7.8 m wide | **14.4 m total:** `2 m` sidewalk + `10.4 m` road + `2 m` sidewalk |
| Road 4 — East Divider | `x = +30.0` | 7.8 m road | **Closed** → becomes East Block center line |
| Road 5 — **East Avenue** | `x = +60.0` | 7.8 m wide | **14.4 m total:** `2 m` sidewalk + `10.4 m` road + `2 m` sidewalk |

Sidewalks run the full length of each commercial block (`|z| ∈ [56.0, 104.0]`), host street furniture (lamps, benches, planters, bike racks), connect to crosswalks at both block ends, and carry the shopping district pedestrian patrol waypoints. Sidewalk width is part of the avenue cross-section and is never taken from lot depth.

The Tram Ring (`|z| = 52`), Rear Promenade Roads (`|z| = 108`), and all other districts remain untouched.

### Lot Geometry & Clearances
- **Lot size:** `15.0 m × 15.0 m` (`225 m²`)
- **Building package max:** `14.0 m × 14.0 m` (`196 m²`, `87.11%` coverage) — package standard, 27 Nov 2026; the former `9.6 m × 9.6 m` shell max is retired for catalog buildings
- **Placement:** package CENTRED on the lot; margins are `(15 − footprint) / 2` on every side (per form: 0.8 m glass tower, 0.86 m canopy storefront, 1.2 m brick block; minimum 0.5 m at the 14 m cap)
- **Neighbour gap:** at least `1.0 m` between packages on adjacent lots along X (15 m lot pitch minus the 14 m cap, including back-to-back pairs across the block center line) and at least `4.0 m` between the front/rear rows along Z (18 m row pitch minus the cap) — buildings never touch

### Complete 16-Lot Manifest

| Slot ID | Code | Block | Center (X, Z) | Facing | Avenue | Overlap Suppression |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `lot-n-01` | `N-01` | `block-nw` | `(-37.5, -71.0)` | **West** (`-X`) | West Avenue (`x=-60`) | Active |
| `lot-n-02` | `N-02` | `block-nw` | `(-22.5, -71.0)` | **East** (`+X`) | Central Avenue (`x=0`) | Active |
| `lot-n-03` | `N-03` | `block-ne` | `(+22.5, -71.0)` | **West** (`-X`) | Central Avenue (`x=0`) | Active |
| `lot-n-04` | `N-04` | `block-ne` | `(+37.5, -71.0)` | **East** (`+X`) | East Avenue (`x=+60`) | Active |
| `lot-n-05` | `N-05` | `block-nw` | `(-37.5, -89.0)` | **West** (`-X`) | West Avenue (`x=-60`) | Active |
| `lot-n-06` | `N-06` | `block-nw` | `(-22.5, -89.0)` | **East** (`+X`) | Central Avenue (`x=0`) | Active |
| `lot-n-07` | `N-07` | `block-ne` | `(+22.5, -89.0)` | **West** (`-X`) | Central Avenue (`x=0`) | Active |
| `lot-n-08` | `N-08` | `block-ne` | `(+37.5, -89.0)` | **East** (`+X`) | East Avenue (`x=+60`) | Active |
| `lot-s-01` | `S-01` | `block-sw` | `(-37.5, +71.0)` | **West** (`-X`) | West Avenue (`x=-60`) | Suppressed (Model Estate `blue_0`) |
| `lot-s-02` | `S-02` | `block-sw` | `(-22.5, +71.0)` | **East** (`+X`) | Central Avenue (`x=0`) | Active |
| `lot-s-03` | `S-03` | `block-se` | `(+22.5, +71.0)` | **West** (`-X`) | Central Avenue (`x=0`) | Active |
| `lot-s-04` | `S-04` | `block-se` | `(+37.5, +71.0)` | **East** (`+X`) | East Avenue (`x=+60`) | Active |
| `lot-s-05` | `S-05` | `block-sw` | `(-37.5, +89.0)` | **West** (`-X`) | West Avenue (`x=-60`) | Suppressed (Model Estate `blue_0`) |
| `lot-s-06` | `S-06` | `block-sw` | `(-22.5, +89.0)` | **East** (`+X`) | Central Avenue (`x=0`) | Active |
| `lot-s-07` | `S-07` | `block-se` | `(+22.5, +89.0)` | **West** (`-X`) | Central Avenue (`x=0`) | Active |
| `lot-s-08` | `S-08` | `block-se` | `(+37.5, +89.0)` | **East** (`+X`) | East Avenue (`x=+60`) | Active |

---

## 2. Shop Building Forms (Sold by Architectural FORM Only)

All 3 buildings are neutral empty shells (zero merchandise). PACKAGE STANDARD (owner decision 27 Nov 2026): the former `9.6 × 9.6 m` shell envelope is retired for catalog buildings — each building is a complete package (building + its own paving) of at most `14 × 14 m`, placed CENTRED on the 15 × 15 m lot, and the package paving is the lot surface treatment. Models render with their own materials under the scene lighting (loaded as-is). Each carries a separate named rooftop billboard mesh (`rooftop_billboard_face` / material `rooftop_billboard_mat`) defaulting to a blank neutral texture, which the owner-logo system swaps per lot.

| Form ID | Name | Footprint | Height | Starting Price | GLB Asset | Official Render |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `glass_corner_3story` | **Glass Corner 3-Story** | `13.4 × 13.4 m` | `13.07 m` | **250 RESPITE** | `/assets/buildings/shop_glass_corner_3story.glb` | `/assets/buildings/renders/shop_glass_corner_3story.png` |
| `canopy_storefront_2story` | **Canopy Storefront 2-Story** | `12.9 × 12.9 m` | `10.27 m` | **200 RESPITE** | `/assets/buildings/shop_canopy_storefront_2story.glb` | `/assets/buildings/renders/shop_canopy_storefront_2story.png` |
| `brick_rooftop_deck` | **Brick Block with Rooftop Deck** | `12.6 × 12.6 m` | `9.53 m` | **200 RESPITE** | `/assets/buildings/shop_brick_rooftop_deck.glb` | `/assets/buildings/renders/shop_brick_rooftop_deck.png` |

Note: placement math uses a centred enclosing square per form (canopy storefront: 13.28 m, since its rear paving reaches −6.64 m while the front canopy reaches +6.28 m); all forms keep ≥ 0.5 m clearance to every lot edge.

## 3. Shared Commercial Config (Super-Admin Editable)
- **Rent:** `50 RESPITE` per `30 days` (dynamic via server-signed price quote; active rentals never change price mid-term)
- **Grace Period:** `3 days`
- **Extension:** counted from current expiry
- **Quote Expiry:** `300 seconds`
