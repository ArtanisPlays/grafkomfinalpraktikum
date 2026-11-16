/**
 * Master Spatial Architecture & Layout Specification
 * 1 unit = 1 meter | Y-up | Interior tiled floor top surface = y: 0.0
 *
 * Orientation:
 *  -X = West (Window-grid gable end)
 *  +X = East (Curved staircase & Steel Dining Pavilion Wing)
 *  -Z = North (2-story service wall: food stalls, office, mezzanine)
 *  +Z = South (Open lesehan hall edge, outdoor driveway & lawn)
 */

export const LAYOUT_SPEC = {
  units: "meters",
  floorY: 0.0,
  exteriorGroundY: -0.25,
  plinthHeight: 0.25,
  tileSize: 0.5,

  // Overall bounding box of the L-shaped building + immediate outdoor surround
  bounds: {
    building: { minX: -14.0, maxX: 21.5, minZ: -14.5, maxZ: 8.5 },
    world: { minX: -26.0, maxX: 32.0, minZ: -24.0, maxZ: 20.0 }
  },

  // Two connected wings forming the L-shaped communal hall
  wings: {
    // Wing A: Main Lesehan Study Hall, Food Stalls, 2F Mezzanine
    mainHall: {
      minX: -14.0,
      maxX: 11.5,
      minZ: -6.5,
      maxZ: 8.5,
      // Heights along Z (asymmetric pitched roof rising from south +Z to north -Z)
      southEaveY: 2.95,
      southBeamBottomY: 2.65,
      southBeamTopY: 3.1,
      centerSpineZ: 3.5,
      centerSpineY: 5.35,
      mezzanineEdgeZ: -1.8,
      mezzanineFloorY: 3.35,
      mezzanineSlabThickness: 0.22,
      mezzanineParapetTopY: 4.3,
      mezzanineRailTopY: 4.55,
      northRoofTopY: 7.45,
      skylightGap: { minZ: 0.0, maxZ: 2.0, minX: -9.0, maxX: 9.0 }
    },

    // Wing B: Steel Dining Tables Pavilion & Staircase Atrium
    steelWing: {
      minX: 11.5,
      maxX: 21.5,
      minZ: -14.5,
      maxZ: 3.5,
      eaveY: 4.85,
      ridgeX: 15.5,
      ridgeY: 6.4,
      clerestoryBottomY: 2.65,
      clerestoryTopY: 4.85,
      spandrelBottomY: 2.05,
      // Mezzanine extension above the south-west part of Wing B (x: 11.5..15.5, z: -6.5..2.0)
      mezzanineBridge: {
        minX: 11.5,
        maxX: 15.5,
        minZ: -6.5,
        maxZ: 2.0,
        floorY: 3.35
      }
    }
  },

  // Structural column positions (cylindrical grey concrete columns)
  columns: {
    radiusMain: 0.25,
    radiusSecondary: 0.22,
    // Row 1: South outdoor edge of Wing A (y: 0 -> 3.05)
    southEdge: [
      { x: -13.5, z: 8.2, h: 3.05 },
      { x: -8.5, z: 8.2, h: 3.05 },
      { x: -3.5, z: 8.2, h: 3.05 },
      { x: 1.5, z: 8.2, h: 3.05 },
      { x: 6.5, z: 8.2, h: 3.05 },
      { x: 11.5, z: 8.2, h: 3.05 }
    ],
    // Row 2: Tall center spine of Wing A (y: 0 -> 5.35)
    centerSpine: [
      { x: -13.5, z: 3.5, h: 5.35 },
      { x: -8.5, z: 3.5, h: 5.35 },
      { x: -3.5, z: 3.5, h: 5.35 },
      { x: 1.5, z: 3.5, h: 5.35 },
      { x: 6.5, z: 3.5, h: 5.35 },
      { x: 11.5, z: 3.5, h: 5.35 }
    ],
    // Row 3: Mezzanine edge of Wing A (y: 0 -> 7.1)
    mezzanineEdge: [
      { x: -13.5, z: -1.8, h: 7.0 },
      { x: -8.5, z: -1.8, h: 7.0 },
      { x: -3.5, z: -1.8, h: 7.0 },
      { x: 1.5, z: -1.8, h: 7.0 },
      { x: 6.5, z: -1.8, h: 7.0 },
      { x: 11.5, z: -1.8, h: 7.0 }
    ],
    // Wing B perimeter & spine columns
    steelWing: [
      { x: 11.5, z: -6.5, h: 6.2 },
      { x: 11.5, z: -10.5, h: 5.5 },
      { x: 11.5, z: -14.2, h: 4.85 },
      { x: 16.5, z: -14.2, h: 5.8 },
      { x: 21.2, z: -14.2, h: 4.85 },
      { x: 21.2, z: -9.5, h: 4.85 },
      { x: 21.2, z: -4.5, h: 4.85 },
      { x: 21.2, z: 0.5, h: 4.85 },
      { x: 16.0, z: -9.5, h: 6.2 },
      { x: 16.0, z: -4.5, h: 6.2 }
    ]
  },

  // Hanging pendant & ceiling lamps
  lamps: {
    pendantDropCordLength: 1.35,
    mainHallPendants: [
      { x: -11.0, y: 4.2, z: 5.5, ceilingY: 5.1 },
      { x: -6.0, y: 4.2, z: 5.5, ceilingY: 5.1 },
      { x: -1.0, y: 4.2, z: 5.5, ceilingY: 5.1 },
      { x: 4.0, y: 4.2, z: 5.5, ceilingY: 5.1 },
      { x: 9.0, y: 4.2, z: 5.5, ceilingY: 5.1 },
      { x: -11.0, y: 5.1, z: 0.8, ceilingY: 6.2 },
      { x: -6.0, y: 5.1, z: 0.8, ceilingY: 6.2 },
      { x: -1.0, y: 5.1, z: 0.8, ceilingY: 6.2 },
      { x: 4.0, y: 5.1, z: 0.8, ceilingY: 6.2 },
      { x: 9.0, y: 5.1, z: 0.8, ceilingY: 6.2 }
    ],
    steelWingPendants: [
      { x: 18.5, y: 4.1, z: -11.5, ceilingY: 5.4 },
      { x: 18.5, y: 4.1, z: -6.5, ceilingY: 5.4 },
      { x: 14.0, y: 4.1, z: -11.5, ceilingY: 5.2 }
    ],
    underMezzanineFixtures: [
      { x: -11.0, y: 3.1, z: -2.8 },
      { x: -7.0, y: 3.1, z: -2.8 },
      { x: -3.0, y: 3.1, z: -2.8 },
      { x: 0.5, y: 3.1, z: -2.8 },
      { x: 4.5, y: 3.1, z: -2.8 },
      { x: 13.5, y: 3.1, z: -3.5 }
    ]
  },

  // White switchback staircase, Wing B floor (y=0) -> mezzanine (y=3.35).
  // The lower (east) flight climbs south from z = northZ to a half-round landing drum,
  // the upper (west) flight returns north and reaches the mezzanine over a short landing
  // tongue. The stair stands clear of the hall columns and stays south of the mezzanine
  // edge, so the walkway in front of the glass office runs straight through into Wing B.
  staircase: {
    northZ: -0.9,
    upperFlightX: 13.4,
    lowerFlightX: 14.7,
    flightWidth: 1.1,
    stepsPerFlight: 10,
    stepRun: 0.28,
    totalRise: 3.35,
    wallThickness: 0.15,
    parapetHeight: 0.95
  },

  // Glass-walled Office ("Kantor Pelayanan Asrama")
  officeRoom: {
    minX: 4.8,
    maxX: 11.0,
    minZ: -6.5,
    maxZ: -2.2,
    height: 3.25,
    doorX: 3.9,
    doorZ: -4.6,
    doorWidth: 1.6,
    doorHeight: 2.35
  },

  // Food Stalls Row (owned by stalls.js)
  stalls: {
    backWallZ: -6.5,
    frontCounterZ: -3.2,
    depth: 3.3,
    height: 3.15,
    counterHeight: 0.9,
    headerBottomY: 2.25,
    headerTopY: 3.05,
    booths: [
      {
        id: "exsoe",
        name: "ExSoe",
        subtitle: "Chicken & Beef",
        minX: -9.0,
        maxX: -5.3,
        accentColor: "#d99b26",
        hasUpperWoodCabinet: true,
        items: ["Paket Nasi 1", "Paket Nasi 2", "Paket Hot Spicy", "Chicken Chop"]
      },
      {
        id: "waras",
        name: "WARAS",
        subtitle: "Warung Asrama ITS",
        minX: -5.3,
        maxX: -1.6,
        accentColor: "#e6a817",
        hasUpperWoodCabinet: false,
        items: ["Nasi Campur", "Nasi Pecel", "Nasi Goreng", "Tahu Tek"]
      },
      {
        id: "kedai",
        name: "KEDAI MINUMAN",
        subtitle: "ASRAMA - JUS BUAH",
        minX: -1.6,
        maxX: 2.0,
        accentColor: "#4f8a36",
        hasUpperWoodCabinet: false,
        items: ["Good Day Freeze", "Cappuccino", "Jus Alpukat", "Es Teh / Milo"]
      }
    ]
  },

  // Furniture Zones (owned by furniture.js)
  furniture: {
    // Iconic weathered orange-red low divider wall
    redDividerWall: {
      mainSegment: { minX: -11.5, maxX: 2.2, z: 1.6, thickness: 0.22, height: 0.92 },
      westReturn: { x: -11.5, minZ: -1.6, maxZ: 1.6, thickness: 0.22, height: 0.92 }
    },

    // 3 long white-frame / dark-wood bench dining tables lined up against the north face of
    // the red wall, leaving a ~3 m wide aisle between their benches and the stall counters
    canteenBenchTables: [
      { x: -7.2, z: 0.69, length: 3.0, width: 0.72, height: 0.74 },
      { x: -3.5, z: 0.69, length: 3.0, width: 0.72, height: 0.74 },
      { x: 0.2, z: 0.69, length: 3.0, width: 0.72, height: 0.74 }
    ],

    // Low wooden lesehan study tables (y=0 floor, height ~0.34m)
    lesehanTables: [
      // Row near red wall
      { x: -9.6, z: 2.85, w: 1.5, d: 0.95, rotY: 0, tilted: false },
      { x: -6.2, z: 2.85, w: 1.5, d: 0.95, rotY: 0.02, tilted: false },
      { x: -2.8, z: 2.85, w: 1.5, d: 0.95, rotY: -0.01, tilted: false },
      { x: 0.6, z: 2.85, w: 1.5, d: 0.95, rotY: 0, tilted: false },
      { x: 4.2, z: 2.85, w: 1.5, d: 0.95, rotY: 0.03, tilted: false },
      // Mid-hall row (including 2 tilted up on edge as seen in photos)
      { x: -9.5, z: 5.2, w: 1.5, d: 0.95, rotY: 0.05, tilted: false },
      { x: -5.5, z: 5.0, w: 1.5, d: 0.95, rotY: 0.15, tilted: true },
      { x: -1.5, z: 5.2, w: 1.5, d: 0.95, rotY: -0.03, tilted: false },
      { x: 2.8, z: 5.0, w: 1.5, d: 0.95, rotY: -0.1, tilted: true },
      { x: 6.5, z: 5.1, w: 1.5, d: 0.95, rotY: 0.02, tilted: false }
    ],

    // Steel square picnic tables with 4 attached benches in Wing B
    steelPicnicTables: [
      { x: 14.5, z: -11.5, topSize: 1.35, height: 0.75, rotY: 0 },
      { x: 18.8, z: -11.5, topSize: 1.35, height: 0.75, rotY: 0 },
      { x: 14.5, z: -7.5, topSize: 1.35, height: 0.75, rotY: 0.03 },
      { x: 18.8, z: -7.5, topSize: 1.35, height: 0.75, rotY: -0.02 },
      { x: 14.8, z: -3.2, topSize: 1.35, height: 0.75, rotY: 0 },
      { x: 18.8, z: -3.2, topSize: 1.35, height: 0.75, rotY: 0.01 }
    ],

    // Wing B west low parapet & white filing cabinet near staircase/office
    wingBWhiteCounter: { minX: 11.7, maxX: 13.6, z: -10.8, length: 2.6, width: 0.55, height: 0.85 },
    officeInteriorTable: { x: 7.9, z: -4.4, w: 2.8, d: 1.2 }
  },

  // Props, Signs, Printing Station, Potted Plants & Cat (owned by props.js)
  props: {
    printingStation: { x: 2.75, z: -3.2, rotY: 0 },
    wallDisplayCabinet: { x: 3.9, y: 2.45, z: -4.05, w: 3.0, h: 0.85, d: 0.28 },
    // Blue standing warning sign near stalls/red wall ("DILARANG MEMBAWA MAKANAN/MINUMAN...")
    blueRuleSign: { x: 2.95, z: 1.15, rotY: 0.08 },
    // Yellow PERHATIAN boards on curved staircase drum & beside printing station
    perhatianSigns: [
      { onStairDrum: true, facing: -1.0, y: 1.86, title: "PERHATIAN" },
      { x: 3.55, y: 1.75, z: -4.15, rotY: 0, title: "PERHATIAN" }
    ],
    // Fire extinguishers flush on north service wall & west mezzanine-edge column
    fireExtinguishers: [
      { x: -9.8, y: 1.15, z: -6.39 },
      { x: -13.5, y: 1.25, z: -1.47 }
    ],
    // Wall-mounted black oscillating fans flush on mezzanine-edge columns
    wallFans: [
      { x: -3.5, y: 2.55, z: -1.55, rotY: 0 },
      { x: -8.5, y: 2.55, z: -1.55, rotY: 0 }
    ],
    // Potted plants around office glass entrance & curved wall
    pottedPlants: [
      { x: 3.1, z: -3.9, size: "medium" },
      { x: 4.8, z: -3.9, size: "medium" },
      { x: 10.15, z: -1.92, size: "tall" },
      { x: 12.25, z: 2.55, size: "tall" }
    ],
    // Tabletop laptops, bottles, water gallons
    tableAccessories: [
      { tableIndex: 3, type: "laptop-study" },
      { tableIndex: 1, type: "laptop-study" },
      { tableIndex: 7, type: "bottles" }
    ],
    // Iconic calico / tuxedo dormitory cat lounging on the tiled floor near the office/red wall end!
    cat: { x: 5.5, z: 0.1, rotY: -0.65, pose: "lounging" }
  },

  // Outdoor Perimeter, Curb, Driveway, Trash Bins & Greenery (owned by outdoor.js)
  outdoor: {
    // Paved driveway/breezeway along south (+Z) & east (+X)
    drivewaySouth: { minX: -22.0, maxX: 28.0, minZ: 8.5, maxZ: 13.5 },
    drivewayEast: { minX: 11.5, maxX: 28.0, minZ: 3.5, maxZ: 13.5 },
    // Lawn / garden beds
    lawnSouth: { minX: -24.0, maxX: 30.0, minZ: 13.5, maxZ: 20.0 },
    lawnWest: { minX: -24.0, maxX: -14.0, minZ: -16.0, maxZ: 13.5 },
    lawnEast: { minX: 21.5, maxX: 30.0, minZ: -18.0, maxZ: 3.5 },
    lawnNorth: { minX: -22.0, maxX: 30.0, minZ: -22.0, maxZ: -14.5 },
    // Grouped colorful trash bins (green, orange, red, blue) along east Wing B & south edge
    trashBinGroups: [
      {
        // Wing B east edge (seen in steel tables photos)
        startX: 20.7,
        startZ: -6.2,
        axis: "z",
        spacing: 0.72,
        rotY: -Math.PI / 2,
        colors: ["#2e8b57", "#d97228", "#c93b3b", "#2a62b8"]
      },
      {
        // Wing A south-west outdoor edge
        startX: -11.5,
        startZ: 8.6,
        axis: "x",
        spacing: 0.72,
        rotY: 0,
        colors: ["#2e8b57", "#4a5568", "#2e8b57"]
      }
    ],
    // Trees & shrubs around the perimeter
    trees: [
      { x: -17.5, z: 12.0, scale: 1.25 },
      { x: -17.0, z: 2.0, scale: 1.1 },
      { x: -9.0, z: 16.0, scale: 1.35 },
      { x: 1.5, z: 16.5, scale: 1.2 },
      { x: 14.5, z: 16.0, scale: 1.3 },
      { x: 25.0, z: 7.0, scale: 1.2 },
      { x: 24.8, z: -3.5, scale: 1.15 },
      { x: 24.5, z: -12.5, scale: 1.3 },
      { x: 16.5, z: -18.0, scale: 1.2 }
    ]
  },

  // Camera Presets for main.js UI & Keyboard shortcuts (1-6)
  cameraPresets: [
    {
      id: "overview",
      label: "1. Overview",
      position: [19.5, 13.5, 22.0],
      target: [2.5, 1.5, -1.5]
    },
    {
      id: "lesehan",
      label: "2. Lesehan Hall",
      position: [-10.8, 2.05, 5.8],
      target: [1.5, 1.35, -0.8]
    },
    {
      id: "stalls",
      label: "3. Food Stalls",
      position: [-2.0, 2.0, 4.2],
      target: [-3.0, 1.4, -3.8]
    },
    {
      id: "steel-wing",
      label: "4. Steel Tables",
      position: [20.2, 2.4, -13.3],
      target: [13.5, 1.4, -2.5]
    },
    {
      id: "staircase",
      label: "5. Staircase & Office",
      position: [7.4, 2.1, 3.4],
      target: [13.2, 1.7, 0.2]
    },
    {
      id: "outdoor",
      label: "6. Outdoor Edge",
      position: [26.0, 4.5, 14.5],
      target: [8.0, 1.8, 1.0]
    },
    {
      id: "mezzanine",
      label: "7. Mezzanine",
      position: [-7.6, 5.25, -4.6],
      target: [2.5, 1.2, 5.0]
    },
    {
      id: "garden",
      label: "8. Garden Path",
      position: [-6.5, 1.45, 18.2],
      target: [0.5, 2.4, 4.0]
    },
    {
      id: "cat-nap",
      label: "9. Cat Nap",
      position: [16.35, 1.42, -6.05],
      target: [14.5, 0.86, -7.5]
    }
  ]
};

/**
 * Derived staircase dimensions shared by the building, detail and prop builders,
 * so nothing has to hard-code where the flights or the landing drum sit.
 */
export function getStairMetrics(spec = LAYOUT_SPEC) {
  const st = spec.staircase;
  const half = st.flightWidth / 2;
  const innerWestX = st.upperFlightX - half;
  const innerEastX = st.lowerFlightX + half;
  const midY = st.totalRise / 2;
  const drumZ = st.northZ + st.stepsPerFlight * st.stepRun;
  const drumInnerR = (innerEastX - innerWestX) / 2;
  const stepRise = midY / st.stepsPerFlight;
  return {
    ...st,
    midY,
    stepRise,
    slope: stepRise / st.stepRun,
    drumX: (innerWestX + innerEastX) / 2,
    drumZ,
    drumInnerR,
    drumR: drumInnerR + st.wallThickness,
    innerWestX,
    innerEastX,
    westFaceX: innerWestX - st.wallThickness,
    eastFaceX: innerEastX + st.wallThickness,
    // Facing edges of the two flights (the gap between them holds the centre wall)
    gapWestX: st.upperFlightX + half,
    gapEastX: st.lowerFlightX - half
  };
}
