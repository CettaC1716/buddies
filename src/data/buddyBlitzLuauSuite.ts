export interface GddPhaseScript {
  id: string;
  phase: 'FASE 1' | 'FASE 2' | 'FASE 3' | 'FASE 4';
  title: string;
  path: string;
  code: string;
}

export const BUDDY_BLITZ_EXPLORER_TREE = `game
├── ReplicatedStorage
│   ├── Config (Folder)
│   │   ├── PaletteBlitz.lua              [ModuleScript - Palet Warna Blitz & Highlight]
│   │   ├── CrateRecipes.lua            [ModuleScript - Tabel Resep 1..8 Kotak & Super Rule]
│   │   └── BuddyClasses.lua            [ModuleScript - 7 Kelas Buddies & Stat Spesial]
│   └── Remotes (Folder - otomatis dibuat Server)
│       ├── CrateAction (RemoteEvent)
│       ├── IssueCommand (RemoteEvent)
│       ├── SwapBuddy (RemoteEvent)
│       ├── SelectBuildRecipe (RemoteEvent)
│       └── FireWeapon (RemoteEvent)
├── ServerScriptService
│   ├── Phase1_BlitzArenaBuilder.server.lua      [Script - Map 4-Tim, Base HQ, Pad 2x2, Pohon Blitz]
│   ├── Phase2_CrateStackingSystem.server.lua  [Script - Spawner Peti, Carry/Throw, Merge & Craft]
│   ├── Phase3_VehicleAndCombat.server.lua     [Script - Open-Top Tank, Run-Over 4 Crates, Senjata]
│   └── Phase4_AISquadAndGameModes.server.lua  [Script - GetFriendsAsync AI, FSM Command & Robux]
├── StarterPlayer
│   └── StarterPlayerScripts
│       ├── WindGrassAndVFX.client.lua         [LocalScript - Rumput 60FPS Time-Sliced 4 Bucket]
│       └── BlitzCameraAndCrosshair.client.lua   [LocalScript - Top-Down -48°, Crosshair & Input]
└── StarterGui
    └── BlitzComicHUD.client.lua                 [LocalScript - Stiker Komik, Radar, Command & Shop]`;

export const BUDDY_BLITZ_LUAU_SCRIPTS: GddPhaseScript[] = [
  {
    id: 'phase1-arena-builder',
    phase: 'FASE 1',
    title: 'Phase 1: PaletteBlitz.lua + Phase1_BlitzArenaBuilder.server.lua',
    path: 'ReplicatedStorage/Config/PaletteBlitz.lua & ServerScriptService/Phase1_BlitzArenaBuilder.server.lua',
    code: `--!strict
-- ============================================================================
-- BAGIAN A: ReplicatedStorage/Config/PaletteBlitz.lua (ModuleScript)
-- ============================================================================
local PaletteBlitz = {
	GrassMain = Color3.fromHex("#5ec932"),
	GrassBlade = Color3.fromHex("#6cd938"),
	DirtRoad = Color3.fromHex("#d89c60"),
	DirtBorder = Color3.fromHex("#c28348"),
	TreeTrunk = Color3.fromHex("#8c4a27"),
	TreeCanopy = Color3.fromHex("#1d1f8c"),
	SkyBright = Color3.fromHex("#9ad9ea"),
	InkOutline = Color3.fromRGB(18, 18, 30),
	ComicNeon = Color3.fromHex("#b4ff39"),
	RedCrate = Color3.fromHex("#ff3b30"),
	SuperCrate = Color3.fromHex("#00d2ff"),
	MegaCrate = Color3.fromHex("#8e95a5"),
	Teams = {
		Blue = { Name = "Blue", Color = Color3.fromHex("#2979ff"), Spawn = Vector3.new(-110, 3, -110) },
		Red = { Name = "Red", Color = Color3.fromHex("#ff3b30"), Spawn = Vector3.new(110, 3, 110) },
		Yellow = { Name = "Yellow", Color = Color3.fromHex("#ffd600"), Spawn = Vector3.new(110, 3, -110) },
		Green = { Name = "Green", Color = Color3.fromHex("#00e676"), Spawn = Vector3.new(-110, 3, 110) },
	},
}

-- ============================================================================
-- BAGIAN B: ServerScriptService/Phase1_BlitzArenaBuilder.server.lua (Script)
-- ============================================================================
local Lighting = game:GetService("Lighting")
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- Pastikan folder Config & Remotes tersedia
local ConfigFolder = ReplicatedStorage:FindFirstChild("Config") or Instance.new("Folder")
ConfigFolder.Name = "Config"
ConfigFolder.Parent = ReplicatedStorage

local RemotesFolder = ReplicatedStorage:FindFirstChild("Remotes") or Instance.new("Folder")
RemotesFolder.Name = "Remotes"
RemotesFolder.Parent = ReplicatedStorage

for _, remoteName in ipairs({ "CrateAction", "IssueCommand", "SwapBuddy", "SelectBuildRecipe", "FireWeapon" }) do
	if not RemotesFolder:FindFirstChild(remoteName) then
		local re = Instance.new("RemoteEvent")
		re.Name = remoteName
		re.Parent = RemotesFolder
	end
end

local ArenaFolder = Workspace:FindFirstChild("BuddyBlitzArena") or Instance.new("Folder")
ArenaFolder.Name = "BuddyBlitzArena"
ArenaFolder.Parent = Workspace

local BasesFolder = Instance.new("Folder")
BasesFolder.Name = "Bases"
BasesFolder.Parent = ArenaFolder

local TreesFolder = Instance.new("Folder")
TreesFolder.Name = "DestructibleTrees"
TreesFolder.Parent = ArenaFolder

local DropZonesFolder = Instance.new("Folder")
DropZonesFolder.Name = "DropZones"
DropZonesFolder.Parent = ArenaFolder

-- Helper Outline Komik Hitam Tegas (Gaya Blitz)
local function applyComicOutline(target: Instance)
	if target:FindFirstChild("BlitzInkHighlight") then
		return
	end
	local hl = Instance.new("Highlight")
	hl.Name = "BlitzInkHighlight"
	hl.Adornee = target
	hl.FillTransparency = 1.0
	hl.OutlineColor = PaletteBlitz.InkOutline
	hl.OutlineTransparency = 0.0
	hl.DepthMode = Enum.HighlightDepthMode.Occluded
	hl.Parent = target
end

local function makePart(name: string, size: Vector3, color: Color3, pos: Vector3, parent: Instance, anchored: boolean): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Position = pos
	p.Anchored = anchored
	p.Material = Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

-- 1. ATUR LIGHTING CEL-SHADED SIANG HARI CERAH
Lighting.Brightness = 3.0
Lighting.ShadowSoftness = 0.0
Lighting.GlobalShadows = true
Lighting.ClockTime = 13.5
Lighting.Ambient = Color3.fromRGB(95, 110, 165)
Lighting.OutdoorAmbient = Color3.fromRGB(130, 150, 200)
Lighting.ColorShift_Top = Color3.fromRGB(255, 250, 230)

local sky = Lighting:FindFirstChildOfClass("Sky") or Instance.new("Sky")
sky.CelestialBodiesShown = false
sky.Parent = Lighting

local cc = Lighting:FindFirstChild("BlitzColorGrade") :: ColorCorrectionEffect? or Instance.new("ColorCorrectionEffect")
cc.Name = "BlitzColorGrade"
cc.Contrast = 0.22
cc.Saturation = 0.25
cc.Brightness = 0.02
cc.Parent = Lighting

-- 2. TANAH UTAMA (#5ec932) & JALAN TANAH HANGAT (#d89c60 + BORDER #c28348)
local ground = makePart("GrassField", Vector3.new(340, 4, 340), PaletteBlitz.GrassMain, Vector3.new(0, -2, 0), ArenaFolder, true)

local function buildDirtRoad(fromPos: Vector3, toPos: Vector3, width: number)
	local diff = toPos - fromPos
	local dist = diff.Magnitude
	local mid = (fromPos + toPos) * 0.5
	local cf = CFrame.lookAt(mid, toPos)

	local border = makePart("DirtBorder", Vector3.new(width + 2.4, 0.22, dist), PaletteBlitz.DirtBorder, mid, ArenaFolder, true)
	border.CFrame = cf * CFrame.new(0, 0.08, 0)

	local road = makePart("DirtRoad", Vector3.new(width, 0.30, dist), PaletteBlitz.DirtRoad, mid, ArenaFolder, true)
	road.CFrame = cf * CFrame.new(0, 0.14, 0)
end

-- Central Red Crate Drop Zone & 2 Side Super-Crate Drop Zones
local centralZone = makePart("CentralDropZone", Vector3.new(28, 0.4, 28), PaletteBlitz.DirtBorder, Vector3.new(0, 0.2, 0), DropZonesFolder, true)
centralZone:SetAttribute("ZoneType", "Red")

local sideZoneWest = makePart("SideSuperZone_West", Vector3.new(18, 0.4, 18), Color3.fromHex("#00d2ff"), Vector3.new(-95, 0.2, 0), DropZonesFolder, true)
sideZoneWest:SetAttribute("ZoneType", "Super")

local sideZoneEast = makePart("SideSuperZone_East", Vector3.new(18, 0.4, 18), Color3.fromHex("#00d2ff"), Vector3.new(95, 0.2, 0), DropZonesFolder, true)
sideZoneEast:SetAttribute("ZoneType", "Super")

-- 3. BANGUN 4 MARKAS TIM (BASE HQ 2000 HP + STACKING PAD 2x2 + 2 SENTRY TURRET)
for teamKey, teamInfo in pairs(PaletteBlitz.Teams) do
	buildDirtRoad(Vector3.new(teamInfo.Spawn.X, 0, teamInfo.Spawn.Z), Vector3.zero, 14)

	local baseModel = Instance.new("Model")
	baseModel.Name = "Base_" .. teamKey
	baseModel:SetAttribute("TeamName", teamKey)
	baseModel:SetAttribute("HP", 2000)
	baseModel:SetAttribute("MaxHP", 2000)
	baseModel:SetAttribute("IsDestroyed", false)
	baseModel.Parent = BasesFolder

	local hqPos = Vector3.new(teamInfo.Spawn.X, 6, teamInfo.Spawn.Z)
	local hqHull = makePart("BaseHQ", Vector3.new(18, 12, 18), teamInfo.Color, hqPos, baseModel, true)
	local hqRoof = makePart("BaseRoof", Vector3.new(20, 2.5, 20), Color3.fromRGB(245, 245, 250), hqPos + Vector3.new(0, 7, 0), baseModel, true)
	baseModel.PrimaryPart = hqHull
	applyComicOutline(baseModel)

	-- BillboardGui Bar Darah Base HQ (2000 HP)
	local bb = Instance.new("BillboardGui")
	bb.Name = "HPBillboard"
	bb.Size = UDim2.fromOffset(160, 32)
	bb.StudsOffset = Vector3.new(0, 12, 0)
	bb.AlwaysOnTop = true
	bb.Parent = hqHull

	local bg = Instance.new("Frame")
	bg.Size = UDim2.fromScale(1, 1)
	bg.BackgroundColor3 = Color3.fromRGB(18, 18, 30)
	bg.BorderSizePixel = 0
	bg.Parent = bb

	local fill = Instance.new("Frame")
	fill.Name = "BarFill"
	fill.Size = UDim2.new(1, -6, 1, -6)
	fill.Position = UDim2.fromOffset(3, 3)
	fill.BackgroundColor3 = PaletteBlitz.ComicNeon
	fill.BorderSizePixel = 0
	fill.Parent = bg

	local hpText = Instance.new("TextLabel")
	hpText.Name = "HPText"
	hpText.Size = UDim2.fromScale(1, 1)
	hpText.BackgroundTransparency = 1
	hpText.Font = Enum.Font.FredokaOne
	hpText.Text = teamKey .. " HQ: 2000 / 2000"
	hpText.TextColor3 = Color3.new(1, 1, 1)
	hpText.TextSize = 14
	hpText.Parent = bg

	-- Stacking Pad 2x2 (4 petak lantai dengan panah indikator putih)
	local padOrigin = Vector3.new(teamInfo.Spawn.X + (teamInfo.Spawn.X < 0 and 18 or -18), 0.3, teamInfo.Spawn.Z)
	local padModel = Instance.new("Model")
	padModel.Name = "StackingPad_" .. teamKey
	padModel:SetAttribute("TeamName", teamKey)
	padModel:SetAttribute("PadActive", true)
	padModel:SetAttribute("SelectedRecipe", "FREE_BUILD")
	padModel.Parent = baseModel

	local padBase = makePart("PadPlatform", Vector3.new(10, 0.5, 10), Color3.fromRGB(40, 44, 62), padOrigin, padModel, true)
	padModel.PrimaryPart = padBase
	applyComicOutline(padModel)

	local slotIndex = 1
	for row = 0, 1 do
		for col = 0, 1 do
			local tilePos = padOrigin + Vector3.new((col - 0.5) * 4.2, 0.3, (row - 0.5) * 4.2)
			local tile = makePart("PadTile_" .. slotIndex, Vector3.new(3.8, 0.2, 3.8), teamInfo.Color, tilePos, padModel, true)
			local arrow = makePart("ArrowIndicator", Vector3.new(1.2, 0.25, 2.2), Color3.new(1, 1, 1), tilePos + Vector3.new(0, 0.05, 0), tile, true)
			slotIndex += 1
		end
	end

	-- Helipad Bulat (relZ = -5.8) & Parkiran Mobil Kotak (relZ = -5.2, lx = 15.0) di Sebelah Kiri Markas
	local heliOrigin = padOrigin + Vector3.new((teamInfo.Spawn.X < 0 and -11.6 or 11.6), 0.05, 0)
	local helipadModel = Instance.new("Model")
	helipadModel.Name = "HelipadBlueprint_" .. teamKey
	helipadModel.Parent = baseModel
	local heliRing = makePart("HeliRing", Vector3.new(4.5, 0.1, 4.5), Color3.fromRGB(56, 189, 248), heliOrigin, helipadModel, true)
	heliRing.Transparency = 0.58

	local parkingOrigin = padOrigin + Vector3.new((teamInfo.Spawn.X < 0 and -11.0 or 11.0), 0.05, (teamInfo.Spawn.X < 0 and -4.8 or 4.8))
	local parkingModel = Instance.new("Model")
	parkingModel.Name = "ParkingBayBlueprint_" .. teamKey
	parkingModel.Parent = baseModel
	local parkBox = makePart("ParkBox", Vector3.new(4.8, 0.1, 4.8), Color3.fromRGB(56, 189, 248), parkingOrigin, parkingModel, true)
	parkBox.Transparency = 0.58

	-- Pohon Sakura Bonsai Kotak Sudut Courtyard (Sakura Planter Bed)
	local treeOrigin = padOrigin + Vector3.new((teamInfo.Spawn.X < 0 and 2.5 or -2.5), 0, (teamInfo.Spawn.X < 0 and -14.2 or 14.2))
	local sakuraModel = Instance.new("Model")
	sakuraModel.Name = "CourtyardSakura_" .. teamKey
	sakuraModel.Parent = baseModel

	-- 1. Pot Kotak Kayu Cedar & Granit
	local planterPlinth = makePart("PlanterPlinth", Vector3.new(4.8, 0.4, 4.4), Color3.fromRGB(57, 59, 73), treeOrigin + Vector3.new(0, 0.2, 0), sakuraModel, true)
	local planterWood = makePart("PlanterWood", Vector3.new(4.6, 0.6, 4.2), Color3.fromRGB(140, 83, 43), treeOrigin + Vector3.new(0, 0.5, 0), sakuraModel, true)
	local planterSoil = makePart("PlanterSoil", Vector3.new(4.0, 0.2, 3.6), Color3.fromRGB(45, 34, 27), treeOrigin + Vector3.new(0, 0.7, 0), sakuraModel, true)

	-- 2. Batang & Dahan Bercabang Alami
	local trunk = makePart("SakuraTrunk", Vector3.new(0.8, 3.2, 0.8), Color3.fromRGB(78, 51, 33), treeOrigin + Vector3.new(0, 2.2, 0), sakuraModel, true)
	trunk.Shape = Enum.PartType.Cylinder
	trunk.CFrame = CFrame.new(treeOrigin + Vector3.new(0, 2.2, 0)) * CFrame.Angles(0, 0, math.rad(82))
	local branch1 = makePart("Branch1", Vector3.new(0.5, 2.2, 0.5), Color3.fromRGB(78, 51, 33), treeOrigin + Vector3.new(1.1, 3.4, 0.6), sakuraModel, true)
	branch1.CFrame = CFrame.new(treeOrigin + Vector3.new(1.1, 3.4, 0.6)) * CFrame.Angles(math.rad(25), 0, math.rad(45))

	-- 3. Kanopi Bunga Sakura Bertingkat (Pink Cel-Shaded)
	local crown = makePart("SakuraCrown", Vector3.new(3.8, 2.6, 3.8), Color3.fromRGB(244, 114, 182), treeOrigin + Vector3.new(0.2, 4.4, 0), sakuraModel, true)
	local highlight = makePart("SakuraHighlight", Vector3.new(2.4, 1.6, 2.4), Color3.fromRGB(251, 207, 232), treeOrigin + Vector3.new(0.4, 5.2, 0.2), sakuraModel, true)
	local sideCanopy = makePart("SakuraSideTier", Vector3.new(2.8, 2.0, 2.8), Color3.fromRGB(236, 72, 153), treeOrigin + Vector3.new(1.4, 3.8, 0.8), sakuraModel, true)
	applyComicOutline(sakuraModel)

	-- 2 Sentry Turret di Dinding Luar Markas
	for sIdx = 1, 2 do
		local offsetZ = (sIdx == 1) and -12 or 12
		local sentry = makePart(
			"SentryTurret_" .. sIdx,
			Vector3.new(3.2, 4.5, 3.2),
			Color3.fromRGB(55, 60, 78),
			Vector3.new(teamInfo.Spawn.X, 2.5, teamInfo.Spawn.Z + offsetZ),
			baseModel,
			true
		)
		applyComicOutline(sentry)
	end
end

-- 4. POHON STYLIZED BLITZ (BATANG COKELAT #8c4a27, KANOPI BIRU-UNGU #1d1f8c, DROP POWER-UPS)
local treeCoords = {
	Vector3.new(-45, 0, -45), Vector3.new(45, 0, -45), Vector3.new(-45, 0, 45), Vector3.new(45, 0, 45),
	Vector3.new(-65, 0, 15), Vector3.new(65, 0, -15), Vector3.new(-15, 0, -68), Vector3.new(15, 0, 68),
	Vector3.new(-82, 0, -55), Vector3.new(82, 0, 55), Vector3.new(-55, 0, 82), Vector3.new(55, 0, -82),
}

for idx, tPos in ipairs(treeCoords) do
	local treeModel = Instance.new("Model")
	treeModel.Name = "BlitzTree_" .. idx
	treeModel:SetAttribute("HP", 60)
	treeModel:SetAttribute("DropsPowerUp", true)
	treeModel.Parent = TreesFolder

	local trunk = makePart("Trunk", Vector3.new(2.6, 8, 2.6), PaletteBlitz.TreeTrunk, tPos + Vector3.new(0, 4, 0), treeModel, true)
	trunk.Shape = Enum.PartType.Cylinder
	trunk.CFrame = CFrame.new(tPos + Vector3.new(0, 4, 0)) * CFrame.Angles(0, 0, math.rad(90))

	local canopy = makePart("Canopy", Vector3.new(9.5, 8.5, 9.5), PaletteBlitz.TreeCanopy, tPos + Vector3.new(0, 10, 0), treeModel, true)
	canopy.Shape = Enum.PartType.Ball
	treeModel.PrimaryPart = trunk
	applyComicOutline(treeModel)
end`,
  },
  {
    id: 'phase1-grass-and-camera',
    phase: 'FASE 1',
    title: 'Phase 1: WindGrassAndVFX.client.lua & BlitzCameraAndCrosshair.client.lua',
    path: 'StarterPlayerScripts/WindGrassAndVFX.client.lua & StarterPlayerScripts/BlitzCameraAndCrosshair.client.lua',
    code: `--!strict
-- ============================================================================
-- BAGIAN A: StarterPlayerScripts/WindGrassAndVFX.client.lua (LocalScript)
-- Sebar ratusan bilah rumput 3D (#6cd938) dengan Time Slicing 4-Bucket (60 FPS)
-- ============================================================================
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local GRASS_COLOR = Color3.fromHex("#6cd938")
local FLOWER_YELLOW = Color3.fromHex("#ffd600")
local FLOWER_PURPLE = Color3.fromHex("#7c4dff")

local GrassContainer = Instance.new("Folder")
GrassContainer.Name = "ClientWindGrass"
GrassContainer.Parent = Workspace

type GrassRecord = {
	part: BasePart,
	baseCF: CFrame,
	phase: number,
}

local buckets: { { GrassRecord } } = { {}, {}, {}, {} }
local totalBlades = 320

for i = 1, totalBlades do
	local angle = math.random() * math.pi * 2
	local radius = 18 + math.random() * 125
	local x = math.cos(angle) * radius
	local z = math.sin(angle) * radius

	local blade = Instance.new("Part")
	blade.Name = "GrassBlade"
	blade.Size = Vector3.new(0.45, 2.1 + math.random() * 0.9, 0.25)
	blade.Color = GRASS_COLOR
	blade.Material = Enum.Material.SmoothPlastic
	blade.Anchored = true
	blade.CanCollide = false
	blade.CanQuery = false
	blade.CastShadow = false

	local baseCF = CFrame.new(x, 1.0, z) * CFrame.Angles(0, math.random() * math.pi * 2, 0)
	blade.CFrame = baseCF
	blade.Parent = GrassContainer

	local bucketIdx = ((i - 1) % 4) + 1
	table.insert(buckets[bucketIdx], {
		part = blade,
		baseCF = baseCF,
		phase = x * 0.12 + z * 0.09,
	})

	-- Serpihan bunga kecil kuning/ungu di pinggir jalan
	if i % 9 == 0 then
		local pebble = Instance.new("Part")
		pebble.Size = Vector3.new(0.7, 0.35, 0.7)
		pebble.Color = (i % 2 == 0) and FLOWER_YELLOW or FLOWER_PURPLE
		pebble.Material = Enum.Material.SmoothPlastic
		pebble.Anchored = true
		pebble.CanCollide = false
		pebble.CanQuery = false
		pebble.Position = Vector3.new(x + 1.2, 0.15, z + 1.2)
		pebble.Parent = GrassContainer
	end
end

local frameCounter = 0
RunService.RenderStepped:Connect(function(_dt: number)
	frameCounter = (frameCounter % 4) + 1
	local activeBucket = buckets[frameCounter]
	local now = os.clock() * 2.6

	local parts: { BasePart } = table.create(#activeBucket)
	local cframes: { CFrame } = table.create(#activeBucket)

	for idx, item in ipairs(activeBucket) do
		local sway = math.sin(now + item.phase) * 0.22
		parts[idx] = item.part
		cframes[idx] = item.baseCF * CFrame.Angles(sway, 0, sway * 0.5)
	end

	Workspace:BulkMoveTo(parts, cframes, Enum.BulkMoveMode.FireCFrameChanged)
end)

-- ============================================================================
-- BAGIAN B: StarterPlayerScripts/BlitzCameraAndCrosshair.client.lua (LocalScript)
-- Kamera Angled Top-Down (-48°, 34 studs, FOV 50), Deadzone, Mouse Aim Lead,
-- Crosshair Putih Outline Hitam (+), dan Avatar Chibi + Circle-Strafe
-- ============================================================================
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local LocalPlayer = Players.LocalPlayer
local Camera = Workspace.CurrentCamera

local CAM_PITCH_DEG = -48
local CAM_DISTANCE = 42 -- Zoomed-out ~22% agar Base HQ, Stacking Pad & Drop Zone terlihat sekaligus
local CAM_FOV = 50
local DEADZONE_RADIUS = 1.8
local AIM_LEAD_MAX = 6.5

local zoomMultiplier = 1.0
local focusPosition = Vector3.new(0, 3, 0)
local smoothedAimLead = Vector3.zero
local currentAimWorldPoint = Vector3.new(0, 0, -10)

-- Scroll Wheel Zoom (0.75x .. 1.65x)
UserInputService.InputChanged:Connect(function(input: InputObject, gameProcessed: boolean)
	if not gameProcessed and input.UserInputType == Enum.UserInputType.MouseWheel then
		zoomMultiplier = math.clamp(zoomMultiplier - input.Position.Z * 0.08, 0.75, 1.65)
	end
end)

-- Buat Crosshair (+) Putih Bergaris Tepi Hitam
local crosshairGui = Instance.new("ScreenGui")
crosshairGui.Name = "BlitzCrosshairGui"
crosshairGui.IgnoreGuiInset = true
crosshairGui.ResetOnSpawn = false
crosshairGui.Parent = LocalPlayer:WaitForChild("PlayerGui")

local crosshairRoot = Instance.new("Frame")
crosshairRoot.Name = "CrosshairRoot"
crosshairRoot.Size = UDim2.fromOffset(28, 28)
crosshairRoot.AnchorPoint = Vector2.new(0.5, 0.5)
crosshairRoot.BackgroundTransparency = 1
crosshairRoot.Parent = crosshairGui

local function makeCrossBar(size: UDim2): Frame
	local bar = Instance.new("Frame")
	bar.AnchorPoint = Vector2.new(0.5, 0.5)
	bar.Position = UDim2.fromScale(0.5, 0.5)
	bar.Size = size
	bar.BackgroundColor3 = Color3.new(1, 1, 1)
	bar.BorderSizePixel = 0
	bar.Parent = crosshairRoot

	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(18, 18, 30)
	stroke.Thickness = 2.5
	stroke.Parent = bar
	return bar
end

makeCrossBar(UDim2.fromOffset(22, 4))
makeCrossBar(UDim2.fromOffset(4, 22))

-- Terapkan Outline Hitam & Cincin Indikator Warna Tim pada Avatar Pemain
local function styleCharacter(char: Model)
	local hum = char:WaitForChild("Humanoid", 5) :: Humanoid?
	local root = char:WaitForChild("HumanoidRootPart", 5) :: BasePart?
	if not hum or not root then
		return
	end
	hum.AutoRotate = false

	if not char:FindFirstChild("BlitzCharHighlight") then
		local hl = Instance.new("Highlight")
		hl.Name = "BlitzCharHighlight"
		hl.FillTransparency = 1.0
		hl.OutlineColor = Color3.fromRGB(18, 18, 30)
		hl.OutlineTransparency = 0.0
		hl.Parent = char
	end

	if not root:FindFirstChild("TeamRing") then
		local ring = Instance.new("Part")
		ring.Name = "TeamRing"
		ring.Shape = Enum.PartType.Cylinder
		ring.Size = Vector3.new(0.2, 4.5, 4.5)
		ring.Color = Color3.fromHex("#2979ff")
		ring.Material = Enum.Material.Neon
		ring.CanCollide = false
		ring.Massless = true
		ring.CFrame = root.CFrame * CFrame.new(0, -2.8, 0) * CFrame.Angles(0, 0, math.rad(90))
		ring.Parent = root

		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = ring
		weld.Parent = ring
	end
end

if LocalPlayer.Character then
	task.spawn(styleCharacter, LocalPlayer.Character)
end
LocalPlayer.CharacterAdded:Connect(styleCharacter)

-- Loop Kamera Angled Top-Down & Rotasi Karakter Menghadap Crosshair
RunService:BindToRenderStep("BlitzTopDownCamera", Enum.RenderPriority.Camera.Value + 1, function(dt: number)
	local char = LocalPlayer.Character
	local root = char and (char:FindFirstChild("HumanoidRootPart") :: BasePart?) or nil
	if not root then
		return
	end

	Camera.CameraType = Enum.CameraType.Scriptable
	Camera.FieldOfView = CAM_FOV

	local mouseLoc = UserInputService:GetMouseLocation()
	crosshairRoot.Position = UDim2.fromOffset(mouseLoc.X, mouseLoc.Y)

	-- Raycast posisi kursor mouse pada bidang tanah Y = root.Position.Y
	local unitRay = Camera:ViewportPointToRay(mouseLoc.X, mouseLoc.Y)
	if math.abs(unitRay.Direction.Y) > 0.0001 then
		local t = (root.Position.Y - unitRay.Origin.Y) / unitRay.Direction.Y
		if t > 0 then
			currentAimWorldPoint = unitRay.Origin + unitRay.Direction * t
		end
	end

	-- Camera Deadzone di tengah layar
	local deltaToPlayer = root.Position - focusPosition
	local planarDelta = Vector3.new(deltaToPlayer.X, 0, deltaToPlayer.Z)
	if planarDelta.Magnitude > DEADZONE_RADIUS then
		local excess = planarDelta.Unit * (planarDelta.Magnitude - DEADZONE_RADIUS)
		focusPosition = Vector3.new(focusPosition.X + excess.X, root.Position.Y, focusPosition.Z + excess.Z)
	else
		focusPosition = Vector3.new(focusPosition.X, root.Position.Y, focusPosition.Z)
	end

	-- Mouse Aim Lead halus menggunakan 1 - math.exp(-10 * dt)
	local aimOffset = currentAimWorldPoint - root.Position
	local clampedLead = Vector3.new(aimOffset.X, 0, aimOffset.Z)
	if clampedLead.Magnitude > 0.01 then
		clampedLead = clampedLead.Unit * math.min(clampedLead.Magnitude * 0.22, AIM_LEAD_MAX)
	end
	local alpha = 1.0 - math.exp(-10.0 * dt)
	smoothedAimLead = smoothedAimLead:Lerp(clampedLead, alpha)

	local finalFocus = focusPosition + smoothedAimLead
	local camRotation = CFrame.Angles(math.rad(CAM_PITCH_DEG), 0, 0)
	local camOffset = camRotation:VectorToWorldSpace(Vector3.new(0, 0, CAM_DISTANCE * zoomMultiplier))
	Camera.CFrame = CFrame.lookAt(finalFocus + camOffset, finalFocus)

	-- Putar karakter menghadap titik Crosshair (Circle-Strafe siap setiap saat)
	local lookVec = Vector3.new(currentAimWorldPoint.X - root.Position.X, 0, currentAimWorldPoint.Z - root.Position.Z)
	if lookVec.Magnitude > 0.25 then
		local targetYaw = math.atan2(-lookVec.X, -lookVec.Z)
		root.CFrame = CFrame.new(root.Position) * CFrame.Angles(0, targetYaw, 0)
	end
end)`,
  },
  {
    id: 'phase2-crate-stacking',
    phase: 'FASE 2',
    title: 'Phase 2: CrateRecipes.lua & Phase2_CrateStackingSystem.server.lua',
    path: 'ReplicatedStorage/Config/CrateRecipes.lua & ServerScriptService/Phase2_CrateStackingSystem.server.lua',
    code: `--!strict
-- ============================================================================
-- BAGIAN A: ReplicatedStorage/Config/CrateRecipes.lua (ModuleScript)
-- Tabel Resep Rakitan 1..8 Kotak + Ghost Wireframe Slots Sesuai Tombol [Q]
-- ============================================================================
local CrateRecipes = {
	BuildOrders = {
		["1x1x1"] = { AllowedSlots = { 1 }, GhostSize = Vector3.new(3.8, 3.8, 3.8), Label = "Lite Weapon" },
		["2x1x1"] = { AllowedSlots = { 1, 2 }, GhostSize = Vector3.new(7.8, 3.8, 3.8), Label = "Grenade" },
		["1x1x2"] = { AllowedSlots = { 1, 5 }, GhostSize = Vector3.new(3.8, 7.6, 3.8), Label = "Buddy T1" },
		["2x2x1"] = { AllowedSlots = { 1, 2, 3, 4 }, GhostSize = Vector3.new(7.8, 3.8, 7.8), Label = "Heavy Weapon" },
		["2x1x2"] = { AllowedSlots = { 1, 2, 5, 6 }, GhostSize = Vector3.new(7.8, 7.6, 3.8), Label = "Buddy T2" },
		["2x2x2"] = { AllowedSlots = { 1, 2, 3, 4, 5, 6, 7, 8 }, GhostSize = Vector3.new(7.8, 7.6, 7.8), Label = "Blitz Tank" },
	},
	Recipes = {
		["1x1x1"] = {
			Count = 1,
			Shape = "1x1x1 (Single)",
			Regular = { Name = "Uzi / Ice Gun", Category = "LiteWeapon", Tier = 1 },
			Super = { Name = "Pocket Rocket / Laser Rifle", Category = "LiteWeapon", Tier = 2 },
		},
		["2x1x1"] = {
			Count = 2,
			Shape = "2x1x1 (Flat)",
			Regular = { Name = "Hand Grenade / Time Bomb", Category = "Grenade", Tier = 1 },
			Super = { Name = "Cluster / Lightning Grenade", Category = "Grenade", Tier = 2 },
		},
		["1x1x2"] = {
			Count = 2,
			Shape = "1x1x2 (Vertical)",
			Regular = { Name = "Buddy Tier 1 (Infuntry / Medic / Ninja)", Category = "BuddyT1", Tier = 1 },
			Super = { Name = "Super Buddy Tier 1 (Super Ninja / Stealthy)", Category = "BuddyT1", Tier = 2 },
		},
		["2x2x1"] = {
			Count = 4,
			Shape = "2x2x1 (1 Layer)",
			Regular = { Name = "Bazooka / Flamethrower / Gatling Gun", Category = "HeavyWeapon", Tier = 1 },
			Super = { Name = "Supazooka / Multi Orb Gun", Category = "HeavyWeapon", Tier = 2 },
		},
		["2x1x2"] = {
			Count = 4,
			Shape = "2x1x2 (Wall)",
			Regular = { Name = "Buddy Tier 2 (Commando / Cyborg)", Category = "BuddyT2", Tier = 1 },
			Super = { Name = "Super Buddy Tier 2 (Super Cyborg / Super Buddie)", Category = "BuddyT2", Tier = 2 },
		},
		["2x2x2"] = {
			Count = 8,
			Shape = "2x2x2 (Full Cube)",
			Regular = { Name = "Blitz Tank (Open-Top)", Category = "Vehicle", Tier = 1 },
			Super = { Name = "Tyrant Dual-Cannon Tank", Category = "Vehicle", Tier = 2 },
		},
	},
}

function CrateRecipes.ChooseNextAllowedSlot(slots: { string }, buildOrder: string): number?
	local spec = CrateRecipes.BuildOrders[buildOrder] or CrateRecipes.BuildOrders["1x1x2"]
	for _, slotIdx in ipairs(spec.AllowedSlots) do
		if (slots[slotIdx] or "Empty") == "Empty" then
			return slotIdx
		end
	end
	return nil
end

function CrateRecipes.EvaluatePad(slots: { string }): (string, any, boolean, boolean)
	local redCount = 0
	local superCount = 0
	local topLayerCount = 0

	for i = 1, 8 do
		local s = slots[i] or "Empty"
		if s == "Red" then
			redCount += 1
		elseif s == "Super" then
			superCount += 1
		end
		if s ~= "Empty" and i >= 5 then
			topLayerCount += 1
		end
	end

	local total = redCount + superCount
	local isMerged = total >= 2
	local isSuper = superCount >= 1

	local key = "1x1x1"
	if total == 8 then
		key = "2x2x2"
	elseif total >= 4 then
		key = (topLayerCount >= 2) and "2x1x2" or "2x2x1"
	elseif total >= 2 then
		key = (topLayerCount >= 1) and "1x1x2" or "2x1x1"
	end

	local entry = CrateRecipes.Recipes[key]
	local chosen = isSuper and entry.Super or entry.Regular
	return key, chosen, isMerged, isSuper
end

-- ============================================================================
-- BAGIAN B: ServerScriptService/Phase2_CrateStackingSystem.server.lua (Script)
-- Clean Match Start (0/8 Pad), Ghost Wireframe [Q], Carry/Throw (E) & Kick Craft (F)
-- ============================================================================
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local CrateActionRemote = Remotes:WaitForChild("CrateAction") :: RemoteEvent

local Arena = Workspace:WaitForChild("BuddyBlitzArena")
local CratesFolder = Instance.new("Folder")
CratesFolder.Name = "WorldCrates"
CratesFolder.Parent = Arena

local PickupsFolder = Instance.new("Folder")
PickupsFolder.Name = "Pickups"
PickupsFolder.Parent = Arena

-- State 8 slot (2x2x2) + Pola Ghost Wireframe [Q] untuk setiap Stacking Pad tim (Mulai dari 0/8!)
local padSlotStates: { [Model]: { slots: { string }, crateParts: { BasePart? }, buildOrder: string, ghostBox: Part? } } = {}

local function getPadSlotWorldPosition(padModel: Model, slotIdx: number): Vector3
	local primary = padModel.PrimaryPart :: BasePart
	local layer = (slotIdx <= 4) and 0 or 1
	local localIdx = ((slotIdx - 1) % 4)
	local row = math.floor(localIdx / 2)
	local col = localIdx % 2
	return primary.Position + Vector3.new((col - 0.5) * 4.0, 2.2 + layer * 3.8, (row - 0.5) * 4.0)
end

-- Update Kerangka Transparan (Ghost Wireframe SelectionBox) Sesuai Tombol [Q]
local function syncPadGhostWireframe(padModel: Model, buildOrder: string)
	local spec = CrateRecipes.BuildOrders[buildOrder] or CrateRecipes.BuildOrders["1x1x2"]
	local primary = padModel.PrimaryPart :: BasePart
	local ghost = padModel:FindFirstChild("GhostWireframeBox") :: Part?
	if not ghost then
		ghost = Instance.new("Part")
		ghost.Name = "GhostWireframeBox"
		ghost.Transparency = 1
		ghost.Anchored = true
		ghost.CanCollide = false
		ghost.CanQuery = false
		ghost.Parent = padModel

		local sel = Instance.new("SelectionBox")
		sel.Name = "GhostOutline"
		sel.Color3 = Color3.fromHex("#00d2ff")
		sel.LineThickness = 0.08
		sel.Adornee = ghost
		sel.Parent = ghost
	end
	ghost.Size = spec.GhostSize
	ghost.CFrame = primary.CFrame * CFrame.new(0, spec.GhostSize.Y * 0.5 + 0.3, 0)
	padModel:SetAttribute("BuildOrder", buildOrder)
end

-- Spawner Peti dengan Parasut + Animasi Squash & Stretch saat mendarat
local function spawnFallingCrate(crateType: "Red" | "Super" | "Mega", dropCenter: Vector3)
	local size = (crateType == "Mega") and Vector3.new(7.6, 7.6, 7.6) or Vector3.new(3.6, 3.6, 3.6)
	local color = Color3.fromHex("#ff3b30")
	if crateType == "Super" then
		color = Color3.fromHex("#00d2ff")
	elseif crateType == "Mega" then
		color = Color3.fromHex("#8e95a5")
	end

	local startPos = dropCenter + Vector3.new(math.random(-8, 8), 42, math.random(-8, 8))
	local landPos = Vector3.new(startPos.X, size.Y * 0.5, startPos.Z)

	local crate = Instance.new("Part")
	crate.Name = crateType .. "Crate"
	crate.Size = size
	crate.Color = color
	crate.Position = startPos
	crate.Anchored = true
	crate.Material = Enum.Material.SmoothPlastic
	crate:SetAttribute("CrateType", crateType)
	crate:SetAttribute("IsMerged", false)
	crate:SetAttribute("OnPad", false)
	crate.Parent = CratesFolder

	local hl = Instance.new("Highlight")
	hl.FillTransparency = 1
	hl.OutlineColor = Color3.fromRGB(18, 18, 30)
	hl.Parent = crate

	-- Payung Parasut Putih saat turun dari langit
	local chute = Instance.new("Part")
	chute.Name = "Parachute"
	chute.Shape = Enum.PartType.Ball
	chute.Size = Vector3.new(5.5, 3.2, 5.5)
	chute.Color = Color3.fromRGB(250, 248, 245)
	chute.Anchored = true
	chute.CanCollide = false
	chute.Position = startPos + Vector3.new(0, 4.5, 0)
	chute.Parent = crate

	local fallTween = TweenService:Create(crate, TweenInfo.new(2.2, Enum.EasingStyle.Linear), { Position = landPos })
	local chuteTween = TweenService:Create(chute, TweenInfo.new(2.2, Enum.EasingStyle.Linear), { Position = landPos + Vector3.new(0, 4.5, 0) })
	fallTween:Play()
	chuteTween:Play()

	fallTween.Completed:Connect(function()
		if chute and chute.Parent then
			chute:Destroy()
		end
		-- Squash & Stretch saat mendarat
		crate.Size = Vector3.new(size.X * 1.25, size.Y * 0.72, size.Z * 1.25)
		TweenService:Create(crate, TweenInfo.new(0.28, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out), { Size = size }):Play()
	end)
end

-- Loop Spawner Red Crate (setiap 4 detik di tengah) & Super Crate (setiap 15 detik di samping)
task.spawn(function()
	while true do
		task.wait(4.0)
		if #CratesFolder:GetChildren() < 28 then
			spawnFallingCrate("Red", Vector3.new(0, 0, 0))
		end
	end
end)

task.spawn(function()
	while true do
		task.wait(15.0)
		if #CratesFolder:GetChildren() < 28 then
			local side = (math.random(1, 2) == 1) and Vector3.new(-95, 0, 0) or Vector3.new(95, 0, 0)
			spawnFallingCrate("Super", side)
		end
	end
end)

-- Evaluasi & Snap Peti HANYA ke Slot Pola Ghost Wireframe [Q] yang Aktif!
local function trySnapCrateToNearestPad(crate: BasePart)
	local bases = Arena:FindFirstChild("Bases")
	if not bases then
		return
	end

	for _, baseModel in ipairs(bases:GetChildren()) do
		local padModel = baseModel:FindFirstChild("StackingPad_" .. tostring(baseModel:GetAttribute("TeamName"))) :: Model?
		if padModel and padModel.PrimaryPart and padModel:GetAttribute("PadActive") == true then
			local dist = (crate.Position - padModel.PrimaryPart.Position).Magnitude
			if dist <= 14.0 then
				if not padSlotStates[padModel] then
					padSlotStates[padModel] = {
						slots = { "Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty", "Empty" },
						crateParts = {},
						buildOrder = "1x1x2",
						ghostBox = nil,
					}
					syncPadGhostWireframe(padModel, "1x1x2")
				end
				local state = padSlotStates[padModel]
				local allowedSlotIdx = CrateRecipes.ChooseNextAllowedSlot(state.slots, state.buildOrder)
				if allowedSlotIdx then
					local cType = tostring(crate:GetAttribute("CrateType") or "Red")
					state.slots[allowedSlotIdx] = (cType == "Super") and "Super" or "Red"
					state.crateParts[allowedSlotIdx] = crate
					crate.Anchored = true
					crate.CanCollide = true
					crate.CFrame = CFrame.new(getPadSlotWorldPosition(padModel, allowedSlotIdx))
					crate:SetAttribute("OnPad", true)

					local _, recipeInfo, isMerged, isSuper = CrateRecipes.EvaluatePad(state.slots)
					for _, part in pairs(state.crateParts) do
						if part then
							part:SetAttribute("IsMerged", isMerged)
						end
					end
					padModel:SetAttribute("PreviewName", recipeInfo.Name)
					padModel:SetAttribute("PreviewSuper", isSuper)
					return
				end
			end
		end
	end
end

-- Handler Interaksi Angkut/Lempar (E), Kick/Craft (F) & Ganti Pola Ghost [Q]
CrateActionRemote.OnServerEvent:Connect(function(player: Player, action: string, targetCrate: BasePart?)
	local char = player.Character
	local root = char and (char:FindFirstChild("HumanoidRootPart") :: BasePart?) or nil
	local hum = char and (char:FindFirstChildOfClass("Humanoid")) or nil
	if not root or not hum then
		return
	end

	if action == "CycleBuildOrder" then
		local orderList = { "1x1x1", "2x1x1", "1x1x2", "2x2x1", "2x1x2", "2x2x2" }
		for padModel, state in pairs(padSlotStates) do
			local idx = table.find(orderList, state.buildOrder) or 3
			state.buildOrder = orderList[(idx % #orderList) + 1]
			syncPadGhostWireframe(padModel, state.buildOrder)
		end
		return
	elseif action == "PickupOrThrow" then
		local carried = char:FindFirstChild("CarriedCrate") :: ObjectValue?
		if carried and carried.Value and carried.Value:IsA("BasePart") then
			-- Lempar peti dengan lintasan parabola ke depan
			local cPart = carried.Value :: BasePart
			carried:Destroy()
			local weld = cPart:FindFirstChild("CarryWeld")
			if weld then
				weld:Destroy()
			end
			hum.WalkSpeed = 16
			cPart.Anchored = false
			cPart.CanCollide = true
			cPart.CFrame = root.CFrame * CFrame.new(0, 2.5, -4.5)
			cPart.AssemblyLinearVelocity = root.CFrame.LookVector * 36 + Vector3.new(0, 18, 0)

			task.delay(0.65, function()
				if cPart and cPart.Parent then
					cPart.Anchored = true
					cPart.Position = Vector3.new(cPart.Position.X, cPart.Size.Y * 0.5, cPart.Position.Z)
					trySnapCrateToNearestPad(cPart)
				end
			end)
			return
		end

		-- Angkat peti di atas kepala jika belum Merged
		if targetCrate and targetCrate.Parent == CratesFolder then
			if targetCrate:GetAttribute("IsMerged") == true then
				return
			end
			targetCrate.Anchored = false
			targetCrate.CanCollide = false
			targetCrate.CFrame = root.CFrame * CFrame.new(0, 4.8, 0)

			local weld = Instance.new("WeldConstraint")
			weld.Name = "CarryWeld"
			weld.Part0 = root
			weld.Part1 = targetCrate
			weld.Parent = targetCrate

			local tag = Instance.new("ObjectValue")
			tag.Name = "CarriedCrate"
			tag.Value = targetCrate
			tag.Parent = char

			hum.WalkSpeed = 16 * 0.85
		end
	elseif action == "KickOpen" and targetCrate then
		if targetCrate:GetAttribute("OnPad") ~= true then
			local pos = targetCrate.Position
			targetCrate:Destroy()

			local heart = Instance.new("Part")
			heart.Name = "HealthPickup"
			heart.Size = Vector3.new(2, 2, 2)
			heart.Color = Color3.fromHex("#ff2d55")
			heart.Position = pos + Vector3.new(-1.5, 1, 0)
			heart.Anchored = true
			heart.Parent = PickupsFolder
			Debris:AddItem(heart, 15)

			local ammo = Instance.new("Part")
			ammo.Name = "AmmoPickup"
			ammo.Size = Vector3.new(2, 2, 2)
			ammo.Color = Color3.fromHex("#ffd600")
			ammo.Position = pos + Vector3.new(1.5, 1, 0)
			ammo.Anchored = true
			ammo.Parent = PickupsFolder
			Debris:AddItem(ammo, 15)
		end
	end
end)`,
  },
  {
    id: 'phase3-vehicle-combat',
    phase: 'FASE 3',
    title: 'Phase 3: Phase3_VehicleAndCombat.server.lua',
    path: 'ServerScriptService/Phase3_VehicleAndCombat.server.lua',
    code: `--!strict
-- Lokasi: ServerScriptService/Phase3_VehicleAndCombat.server.lua
-- Clean Match Start: Tank TIDAK di-spawn gratis di awal pertandingan!
-- Open-Top Blitz Tank HANYA muncul saat pemain/AI merakit 8 peti (2x2x2) di Stacking Pad.

local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")

local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local FireWeaponRemote = Remotes:WaitForChild("FireWeapon") :: RemoteEvent

local Arena = Workspace:WaitForChild("BuddyBlitzArena")
local VehiclesFolder = Instance.new("Folder")
VehiclesFolder.Name = "Vehicles"
VehiclesFolder.Parent = Arena

-- ============================================================================
-- 1. BUILDER OPEN-TOP BLITZ TANK (DIPANGGIL SAAT RAKITAN 8 PETI 2x2x2 SELESAI)
-- ============================================================================
local function spawnOpenTopBlitzTank(spawnPos: Vector3, isSuperTyrant: boolean, teamColor: Color3): Model
	local tank = Instance.new("Model")
	tank.Name = isSuperTyrant and "TyrantTank" or "BlitzTank"
	tank:SetAttribute("HP", isSuperTyrant and 650 or 400)
	tank:SetAttribute("MaxHP", isSuperTyrant and 650 or 400)
	tank:SetAttribute("IsSuper", isSuperTyrant)
	tank:SetAttribute("StoredCrates", 0)
	tank:SetAttribute("IsCritical", false)

	local hull = Instance.new("Part")
	hull.Name = "Hull"
	hull.Size = Vector3.new(7.2, 2.8, 8.6)
	hull.Color = isSuperTyrant and Color3.fromHex("#00d2ff") or Color3.fromHex("#b8ff3c")
	hull.Position = spawnPos
	hull.Material = Enum.Material.SmoothPlastic
	hull.Parent = tank
	tank.PrimaryPart = hull

	local turret = Instance.new("Part")
	turret.Name = "Turret"
	turret.Size = Vector3.new(4.8, 2.0, 4.8)
	turret.Color = teamColor
	turret.Position = spawnPos + Vector3.new(0, 2.4, 0)
	turret.CanCollide = false
	turret.Parent = tank

	local turretMotor = Instance.new("Motor6D")
	turretMotor.Name = "TurretMotor"
	turretMotor.Part0 = hull
	turretMotor.Part1 = turret
	turretMotor.C0 = CFrame.new(0, 2.4, 0)
	turretMotor.Parent = hull

	-- Kursi Open-Top Hatch: Kepala & Badan Atas Avatar menyembul dari dalam Turret
	local seat = Instance.new("VehicleSeat")
	seat.Name = "OpenTopHatchSeat"
	seat.Size = Vector3.new(2.2, 0.6, 2.2)
	seat.Transparency = 1
	seat.Position = turret.Position + Vector3.new(0, 0.35, 0)
	seat.Parent = turret

	local seatWeld = Instance.new("WeldConstraint")
	seatWeld.Part0 = turret
	seatWeld.Part1 = seat
	seatWeld.Parent = seat

	-- Laras Meriam (Tunggal untuk Blitz Tank, Ganda untuk Super Tyrant Tank)
	local barrelOffsets = isSuperTyrant and { -1.1, 1.1 } or { 0.0 }
	for idx, xOff in ipairs(barrelOffsets) do
		local barrel = Instance.new("Part")
		barrel.Name = "Barrel_" .. idx
		barrel.Size = Vector3.new(0.95, 0.95, 5.2)
		barrel.Color = Color3.fromRGB(32, 35, 48)
		barrel.CanCollide = false
		barrel.CFrame = turret.CFrame * CFrame.new(xOff, 0.1, -3.6)
		barrel.Parent = turret

		local bw = Instance.new("WeldConstraint")
		bw.Part0 = turret
		bw.Part1 = barrel
		bw.Parent = barrel
	end

	local hl = Instance.new("Highlight")
	hl.FillTransparency = 1
	hl.OutlineColor = Color3.fromRGB(18, 18, 30)
	hl.Parent = tank

	-- Fitur Asli Team Buddies: Melindas Peti (Crate Run-Over, angkut maks 4 peti)
	hull.Touched:Connect(function(hit: BasePart)
		if hit.Parent and hit.Parent.Name == "WorldCrates" and hit:GetAttribute("OnPad") ~= true then
			local stored = tonumber(tank:GetAttribute("StoredCrates")) or 0
			if stored < 4 then
				tank:SetAttribute("StoredCrates", stored + 1)
				hit:Destroy()
			end
		end
	end)

	tank.Parent = VehiclesFolder
	return tank
end

-- BindableEvent agar Phase2_CrateStackingSystem memanggil spawnOpenTopBlitzTank saat 2x2x2 (8 peti) dirakit!
local SpawnTankBindable = Instance.new("BindableEvent")
SpawnTankBindable.Name = "SpawnCraftedTank"
SpawnTankBindable.Parent = ReplicatedStorage
SpawnTankBindable.Event:Connect(function(spawnPos: Vector3, isSuper: boolean, teamHex: string)
	spawnOpenTopBlitzTank(spawnPos, isSuper, Color3.fromHex(teamHex))
end)

-- ============================================================================
-- 2. SISTEM SENJATA, ICE GUN FREEZE-SHATTER, KATANA CRATE SLICER & BASE REPAIR
-- ============================================================================
local POWERUP_TYPES = {
	"Shield", "GunFrenzy", "RocketBoots", "Jetpack", "BaseRepair", "PumpedUp", "Phreak",
}

local function spawnPowerUpDrop(pos: Vector3, forcedType: string?)
	local pType = forcedType or POWERUP_TYPES[math.random(1, #POWERUP_TYPES)]
	local orb = Instance.new("Part")
	orb.Name = "PowerUp_" .. pType
	orb.Shape = Enum.PartType.Ball
	orb.Size = Vector3.new(2.6, 2.6, 2.6)
	orb.Color = Color3.fromHex("#b4ff39")
	orb.Material = Enum.Material.Neon
	orb.Position = pos + Vector3.new(0, 2, 0)
	orb.Anchored = true
	orb:SetAttribute("PowerUpType", pType)
	orb.Parent = Arena:FindFirstChild("Pickups") or Arena
	Debris:AddItem(orb, 25)
end

FireWeaponRemote.OnServerEvent:Connect(function(player: Player, weaponName: string, origin: Vector3, direction: Vector3)
	local char = player.Character
	if not char then
		return
	end

	-- Katana Ninja: Membelah Merged Crates di Stacking Pad lawan!
	if weaponName == "Katana" then
		local cratesFolder = Arena:FindFirstChild("WorldCrates")
		if cratesFolder then
			for _, crate in ipairs(cratesFolder:GetChildren()) do
				if crate:IsA("BasePart") and (crate.Position - origin).Magnitude <= 10.0 then
					crate:SetAttribute("IsMerged", false)
					crate:SetAttribute("OnPad", false)
					crate.Anchored = false
					crate:ApplyImpulse(Vector3.new(math.random(-20, 20), 35, math.random(-20, 20)))
				end
			end
		end
		return
	end

	-- Raycast Tembakan Senjata
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { char }

	local result = Workspace:Raycast(origin, direction.Unit * 140, params)
	if not result or not result.Instance then
		return
	end

	local hitPart = result.Instance
	local hitModel = hitPart:FindFirstAncestorOfClass("Model")
	if not hitModel then
		return
	end

	-- 1. Jika mengenai Pohon Blitz -> Hancurkan & Jatuhkan Power-Up
	if hitModel.Parent and hitModel.Parent.Name == "DestructibleTrees" then
		local hp = (tonumber(hitModel:GetAttribute("HP")) or 60) - 25
		hitModel:SetAttribute("HP", hp)
		if hp <= 0 then
			local dropPos = hitModel:GetPivot().Position
			hitModel:Destroy()
			spawnPowerUpDrop(dropPos, nil)
		end
		return
	end

	-- 2. Jika mengenai Base HQ -> Kurangi HP; jika 0, matikan Stacking Pad & jatuhkan Shield
	if hitModel.Parent and hitModel.Parent.Name == "Bases" then
		if hitModel:GetAttribute("IsDestroyed") == true then
			return
		end
		local hp = math.max(0, (tonumber(hitModel:GetAttribute("HP")) or 2000) - 45)
		hitModel:SetAttribute("HP", hp)
		if hp <= 0 then
			hitModel:SetAttribute("IsDestroyed", true)
			for _, child in ipairs(hitModel:GetChildren()) do
				if child:IsA("Model") and string.find(child.Name, "StackingPad") then
					child:SetAttribute("PadActive", false)
				end
			end
			spawnPowerUpDrop(hitModel:GetPivot().Position + Vector3.new(0, 4, 0), "Shield")
		end
		return
	end

	-- 3. Ice Gun Freeze + Shatter Rule Asli Team Buddies
	local targetHum = hitModel:FindFirstChildOfClass("Humanoid")
	if targetHum then
		if weaponName == "IceGun" then
			hitModel:SetAttribute("IsFrozen", true)
			targetHum.WalkSpeed = 0
		else
			if hitModel:GetAttribute("IsFrozen") == true then
				targetHum.Health = 0
			else
				targetHum:TakeDamage(25)
			end
		end
	end
end)`,
  },
  {
    id: 'phase4-ai-and-hud',
    phase: 'FASE 4',
    title: 'Phase 4: BuddyClasses.lua, Phase4_AISquadAndGameModes.server.lua & BlitzComicHUD.client.lua',
    path: 'ServerScriptService/Phase4_AISquadAndGameModes.server.lua & StarterGui/BlitzComicHUD.client.lua',
    code: `--!strict
-- ============================================================================
-- BAGIAN A: ReplicatedStorage/Config/BuddyClasses.lua (ModuleScript)
-- 7 Kelas Prajurit Asli Team Buddies
-- ============================================================================
local BuddyClasses = {
	Infuntry = { MaxHP = 100, WalkSpeed = 16, JumpPower = 50, CanSliceCrates = false, VehicleResist = false, CanFly = false },
	Commando = { MaxHP = 135, WalkSpeed = 20, JumpPower = 55, CanSliceCrates = false, VehicleResist = false, CanFly = false },
	Medic = { MaxHP = 110, WalkSpeed = 17, JumpPower = 50, CanSliceCrates = false, VehicleResist = false, CanFly = false },
	Ninja = { MaxHP = 115, WalkSpeed = 23, JumpPower = 75, CanSliceCrates = true, VehicleResist = false, CanFly = false },
	Cyborg = { MaxHP = 185, WalkSpeed = 15, JumpPower = 50, CanSliceCrates = false, VehicleResist = true, CanFly = false },
	Stealthy = { MaxHP = 125, WalkSpeed = 21, JumpPower = 62, CanSliceCrates = true, VehicleResist = false, CanFly = false },
	SuperBuddie = { MaxHP = 260, WalkSpeed = 24, JumpPower = 85, CanSliceCrates = false, VehicleResist = true, CanFly = true },
}

-- ============================================================================
-- BAGIAN B: ServerScriptService/Phase4_AISquadAndGameModes.server.lua (Script)
-- Spawn AI Buddy dari Wujud Avatar Teman Asli (Players:GetFriendsAsync),
-- Teropong Perintah AI [V] Berdasarkan Target Kursor + Animasi Hormat (Salute)
-- ============================================================================
local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")

local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local IssueCommandRemote = Remotes:WaitForChild("IssueCommand") :: RemoteEvent
local SwapBuddyRemote = Remotes:WaitForChild("SwapBuddy") :: RemoteEvent

local Arena = Workspace:WaitForChild("BuddyBlitzArena")
local BuddiesFolder = Instance.new("Folder")
BuddiesFolder.Name = "AIBuddies"
BuddiesFolder.Parent = Arena

local friendIdCache: { [number]: { number } } = {}

local function getFriendUserIds(player: Player): { number }
	if friendIdCache[player.UserId] then
		return friendIdCache[player.UserId]
	end
	local ids: { number } = {}
	local ok, pages = pcall(function()
		return Players:GetFriendsAsync(player.UserId)
	end)
	if ok and pages then
		for _, item in ipairs(pages:GetCurrentPage()) do
			table.insert(ids, item.Id)
			if #ids >= 12 then
				break
			end
		end
	end
	if #ids == 0 then
		table.insert(ids, player.UserId)
	end
	friendIdCache[player.UserId] = ids
	return ids
end

-- Spawn AI Buddy dengan Wujud Avatar Teman Asli + Stat 7 Kelas
local function spawnFriendBuddy(owner: Player, classKey: string, spawnPos: Vector3): Model?
	local stats = BuddyClasses[classKey] or BuddyClasses.Infuntry
	local friendIds = getFriendUserIds(owner)
	local chosenUserId = friendIds[math.random(1, #friendIds)]

	local ok, model = pcall(function()
		return Players:CreateHumanoidModelFromUserId(chosenUserId)
	end)
	if not ok or not model then
		return nil
	end

	model.Name = "Buddy_" .. classKey .. "_" .. owner.Name
	model:SetAttribute("OwnerUserId", owner.UserId)
	model:SetAttribute("BuddyClass", classKey)
	model:SetAttribute("AIMode", "HARVEST")
	model:PivotTo(CFrame.new(spawnPos))

	local hum = model:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.MaxHealth = stats.MaxHP
		hum.Health = stats.MaxHP
		hum.WalkSpeed = stats.WalkSpeed
		hum.JumpPower = stats.JumpPower
	end

	local hl = Instance.new("Highlight")
	hl.FillTransparency = 1
	hl.OutlineColor = Color3.fromRGB(18, 18, 30)
	hl.Parent = model

	model.Parent = BuddiesFolder
	return model
end

-- Tampilkan Lencana Hormat (Salute Badge) di Atas Kepala AI Buddy Saat Menerima Komando [V]
local function showSaluteBadge(buddy: Model, orderText: string)
	local head = buddy:FindFirstChild("Head") :: BasePart?
	if not head then
		return
	end
	local old = head:FindFirstChild("SaluteBadge")
	if old then
		old:Destroy()
	end

	local bb = Instance.new("BillboardGui")
	bb.Name = "SaluteBadge"
	bb.Size = UDim2.fromOffset(130, 38)
	bb.StudsOffset = Vector3.new(0, 3.2, 0)
	bb.AlwaysOnTop = true
	bb.Parent = head

	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.fromScale(1, 1)
	lbl.BackgroundColor3 = Color3.fromRGB(18, 18, 30)
	lbl.TextColor3 = Color3.fromHex("#b8ff3c")
	lbl.Font = Enum.Font.FredokaOne
	lbl.TextSize = 14
	lbl.Text = "HORMAT: " .. orderText
	lbl.Parent = bb

	task.delay(1.6, function()
		if bb and bb.Parent then
			bb:Destroy()
		end
	end)
end

-- Handler Tombol [V]: Teropong Perintah AI Berdasarkan Target Kursor (Crate=HARVEST, Enemy=ATTACK, Base=DEFEND, Tank=MOUNT)
IssueCommandRemote.OnServerEvent:Connect(function(player: Player, cursorWorldPos: Vector3, hitInstance: Instance?)
	local resolvedMode = "HARVEST"
	if hitInstance then
		if hitInstance.Parent and hitInstance.Parent.Name == "WorldCrates" then
			resolvedMode = "HARVEST"
		elseif hitInstance:FindFirstAncestor("Vehicles") then
			resolvedMode = "MOUNT"
		elseif hitInstance:FindFirstAncestor("Bases") then
			local baseModel = hitInstance:FindFirstAncestorOfClass("Model")
			if baseModel and baseModel:GetAttribute("TeamName") == "Blue" then
				resolvedMode = "DEFEND"
			else
				resolvedMode = "ATTACK"
			end
		else
			resolvedMode = "ATTACK"
		end
	end

	for _, buddy in ipairs(BuddiesFolder:GetChildren()) do
		if buddy:IsA("Model") and buddy:GetAttribute("OwnerUserId") == player.UserId then
			buddy:SetAttribute("AIMode", resolvedMode)
			showSaluteBadge(buddy, resolvedMode)
			local hum = buddy:FindFirstChildOfClass("Humanoid")
			if hum then
				hum:MoveTo(cursorWorldPos)
			end
		end
	end
end)

-- Handler Tombol Tab (Buddy Swap: Berpindah Raga ke AI Buddy Tim yang Masih Hidup)
SwapBuddyRemote.OnServerEvent:Connect(function(player: Player)
	local char = player.Character
	if not char or not char.PrimaryPart then
		return
	end
	for _, buddy in ipairs(BuddiesFolder:GetChildren()) do
		if buddy:IsA("Model") and buddy:GetAttribute("OwnerUserId") == player.UserId and buddy.PrimaryPart then
			local playerCF = char:GetPivot()
			local buddyCF = buddy:GetPivot()
			char:PivotTo(buddyCF)
			buddy:PivotTo(playerCF)
			break
		end
	end
end)

-- Loop FSM AI Buddy dengan Time Slicing (Regen Medic, Harvest Crate, Mount Tank, Attack)
task.spawn(function()
	while true do
		task.wait(0.35)
		for _, buddy in ipairs(BuddiesFolder:GetChildren()) do
			if buddy:IsA("Model") and buddy.PrimaryPart then
				local hum = buddy:FindFirstChildOfClass("Humanoid")
				local bClass = tostring(buddy:GetAttribute("BuddyClass") or "Infuntry")
				local mode = tostring(buddy:GetAttribute("AIMode") or "HARVEST")

				if hum and bClass == "Medic" and hum.Health > 0 and hum.Health < hum.MaxHealth then
					hum.Health = math.min(hum.MaxHealth, hum.Health + 3)
				end

				if hum and mode == "HARVEST" then
					local crates = Arena:FindFirstChild("WorldCrates")
					if crates then
						local nearest: BasePart? = nil
						local bestDist = 999
						for _, c in ipairs(crates:GetChildren()) do
							if c:IsA("BasePart") and c:GetAttribute("OnPad") ~= true then
								local d = (c.Position - buddy.PrimaryPart.Position).Magnitude
								if d < bestDist then
									bestDist = d
									nearest = c
								end
							end
						end
						if nearest then
							hum:MoveTo(nearest.Position)
						end
					end
				end
			end
		end
	end
end)

-- Modul Monetisasi Robux (Developer Products & Gamepasses)
local DEV_PRODUCTS = {
	InstantMegacrate = 100000001,
	UnlockNinjaCyborg = 100000002,
}

MarketplaceService.ProcessReceipt = function(receiptInfo)
	local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	if receiptInfo.ProductId == DEV_PRODUCTS.UnlockNinjaCyborg and player.Character then
		spawnFriendBuddy(player, "Ninja", player.Character:GetPivot().Position + Vector3.new(4, 0, 0))
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- ============================================================================
-- BAGIAN C: StarterGui/BlitzComicHUD.client.lua (LocalScript)
-- HUD Stiker Komik Miring (#b4ff39), Mini-Radar Team Buddies Pojok Kanan Atas & Command
-- ============================================================================
local function buildBlitzComicHud()
	local localPlayer = Players.LocalPlayer
	if not localPlayer then
		return
	end
	local gui = Instance.new("ScreenGui")
	gui.Name = "BlitzComicHUD"
	gui.IgnoreGuiInset = true
	gui.ResetOnSpawn = false
	gui.Parent = localPlayer:WaitForChild("PlayerGui")

	-- Mini-Radar Team Buddies di Pojok Kanan Atas (Menampilkan Posisi Pemain, AI, Musuh, Peti & Markas)
	local radarFrame = Instance.new("Frame")
	radarFrame.Name = "ComicRadar"
	radarFrame.AnchorPoint = Vector2.new(1, 0)
	radarFrame.Position = UDim2.new(1, -24, 0, 24)
	radarFrame.Size = UDim2.fromOffset(150, 150)
	radarFrame.Rotation = 2
	radarFrame.BackgroundColor3 = Color3.fromHex("#285918")
	radarFrame.Parent = gui

	local radarCorner = Instance.new("UICorner")
	radarCorner.CornerRadius = UDim.new(0, 16)
	radarCorner.Parent = radarFrame

	local radarStroke = Instance.new("UIStroke")
	radarStroke.Color = Color3.fromRGB(18, 18, 30)
	radarStroke.Thickness = 4
	radarStroke.Parent = radarFrame

	-- Panel Command & Slot Buddy di Bawah
	local cmdPanel = Instance.new("Frame")
	cmdPanel.Name = "SquadCommandBar"
	cmdPanel.AnchorPoint = Vector2.new(0.5, 1)
	cmdPanel.Position = UDim2.new(0.5, 0, 1, -20)
	cmdPanel.Size = UDim2.fromOffset(580, 56)
	cmdPanel.Rotation = -1
	cmdPanel.BackgroundColor3 = Color3.fromHex("#b4ff39")
	cmdPanel.Parent = gui

	local cmdCorner = Instance.new("UICorner")
	cmdCorner.CornerRadius = UDim.new(0, 14)
	cmdCorner.Parent = cmdPanel

	local cmdStroke = Instance.new("UIStroke")
	cmdStroke.Color = Color3.fromRGB(18, 18, 30)
	cmdStroke.Thickness = 5
	cmdStroke.Parent = cmdPanel

	local cmdLabel = Instance.new("TextLabel")
	cmdLabel.Size = UDim2.fromScale(1, 1)
	cmdLabel.BackgroundTransparency = 1
	cmdLabel.Font = Enum.Font.FredokaOne
	cmdLabel.Text = "[E] Carry/Throw  |  [F] Kick/Craft  |  [Q] Ghost Pattern  |  [V] Cursor Command  |  [TAB] Swap"
	cmdLabel.TextColor3 = Color3.fromRGB(18, 18, 30)
	cmdLabel.TextSize = 16
	cmdLabel.Parent = cmdPanel
end

if game:GetService("RunService"):IsClient() then
	buildBlitzComicHud()
end`,
  },
];
