export interface LuauScriptFile {
  id: string;
  title: string;
  robloxPath: string;
  scriptType: 'LocalScript' | 'Script';
  summary: string;
  code: string;
}

export const LUAU_SCRIPTS: LuauScriptFile[] = [
  {
    id: 'isometric-camera',
    title: '1. IsometricCamera.client.lua',
    robloxPath: 'StarterPlayer/StarterPlayerScripts/IsometricCamera.client.lua',
    scriptType: 'LocalScript',
    summary:
      'Replikasi 1:1 dari CQl67Veh.js: Critically-damped spring follow (smoothTime 0.18..0.22s, omega = 2/smoothTime), sudut offset (4, 14, 8) / pseudo-orthographic FOV 18°, mouse pan damping, recoil kick (0.13..0.37), dan framing Hexagon Intro.',
    code: `--!strict
--[[
  StarterPlayerScripts/IsometricCamera.client.lua
  Ported 1:1 from https://buddies-blitz.com/ (CQl67Veh.js)
  Implements:
  - Isometric / Pseudo-Orthographic Follow Camera with FOV 18 (or exact WebGL 35° mode)
  - Critically-damped 2nd-order spring interpolation (smoothTime = lerp(0.18, 0.22, boostAlpha))
  - Mouse Pan Offset (sensitivity = 1.3, dampSpeed = 5.0)
  - Cannon Recoil Kick & Trauma Shake (kickDistance = 0.13, maxRecoilDistance = 0.37)
  - Hexagon Intro Viewport Offset & Smooth Transition on "LET'S GO"
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LocalPlayer = Players.LocalPlayer
local Camera = workspace.CurrentCamera

-- 1 meter WebGL = 3.5 Roblox Studs
local METER_TO_STUDS = 3.5

-- Bundled Constants from CQl67Veh.js
local CONFIG = {
	-- Pseudo-Orthographic FOV (18 deg with 1.9x distance scale replicates isometric compression)
	GameplayFOV = 18,
	IntroFOV = 16,
	DistanceMultiplier = 1.85,

	-- Default angle vector in WebGL: Vector3(4, 14, 8)
	DefaultAngleOffset = Vector3.new(4, 14, 8) * METER_TO_STUDS,
	PlayerStartAngleOffset = Vector3.new(0, 2, 14) * METER_TO_STUDS,

	-- Zoom config: { minDistance = 9, amplitude = 12, value = 0.6 }
	ZoomMinDistance = 9 * METER_TO_STUDS,
	ZoomAmplitude = 12 * METER_TO_STUDS,
	ZoomValue = 0.6,
	ZoomTargetValue = 0.6,

	-- Critically-Damped Spring (initFollowTarget)
	BaseSpeed = 8 * METER_TO_STUDS,
	BoostMultiplier = 1.9,
	SmoothTimeNormal = 0.18,
	SmoothTimeBoost = 0.22,
	SnapDistanceSq = (6 * METER_TO_STUDS) ^ 2,

	-- Mouse Pan (mousePanSensitivity = 1.3, mousePanDampSpeed = 5)
	MousePanSensitivity = 1.3 * METER_TO_STUDS,
	MousePanDampSpeed = 5.0,

	-- Recoil Kick (recoilKickDistance = 0.13, maxRecoilDistance = 0.37)
	RecoilKickDistance = 0.13 * METER_TO_STUDS,
	MaxRecoilDistance = 0.37 * METER_TO_STUDS,

	-- Intro Hexagon Framing (introCamera)
	IntroZoomScale = 1.5,
	IntroCenterX = 0.72,
	IntroCenterY = 0.50,
}

-- State Variables
local isIntroActive = true
local currentZoomScale = CONFIG.IntroZoomScale
local targetZoomScale = CONFIG.IntroZoomScale

local targetPos = Vector3.zero
local targetEased = Vector3.zero
local targetVelocity = Vector3.zero

local mousePanOffset = Vector3.zero
local targetMousePan = Vector3.zero
local recoilOffset = Vector3.zero
local trauma = 0

local upVec = Vector3.new(0, 1, 0)

-- BindableEvents shared with UI and TankController
local function getOrCreateBindable(name: string): BindableEvent
	local folder = ReplicatedStorage:FindFirstChild("BlitzEvents")
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "BlitzEvents"
		folder.Parent = ReplicatedStorage
	end
	local ev = folder:FindFirstChild(name) :: BindableEvent?
	if not ev then
		ev = Instance.new("BindableEvent")
		ev.Name = name
		ev.Parent = folder
	end
	return ev
end

local IntroCompleteEvent = getOrCreateBindable("GameIntroComplete")
local BulletShootEvent = getOrCreateBindable("BulletShoot")
local CameraShakeEvent = getOrCreateBindable("CameraShake")

-- Locate Player Tank PrimaryPart
local function getTankRoot(): BasePart?
	local tankModel = workspace:FindFirstChild("PlayerTank_" .. LocalPlayer.Name)
		or workspace:FindFirstChild("PlayerTank")
	if tankModel and tankModel:IsA("Model") and tankModel.PrimaryPart then
		return tankModel.PrimaryPart
	end
	local char = LocalPlayer.Character
	if char and char.PrimaryPart then
		return char.PrimaryPart
	end
	return nil
end

-- Exact port of CQl67Veh.js critically-damped spring follow
local function stepCriticalDampedSpring(
	current: Vector3,
	target: Vector3,
	velocity: Vector3,
	currentSpeed: number,
	dt: number
): (Vector3, Vector3)
	local maxBoostSpeed = CONFIG.BaseSpeed * CONFIG.BoostMultiplier
	local speedAlpha = math.clamp(
		(currentSpeed - CONFIG.BaseSpeed) / math.max(0.001, maxBoostSpeed - CONFIG.BaseSpeed),
		0,
		1
	)
	local smoothTime = CONFIG.SmoothTimeNormal + (CONFIG.SmoothTimeBoost - CONFIG.SmoothTimeNormal) * speedAlpha
	local diff = current - target
	local distSq = diff:Dot(diff)

	if distSq > CONFIG.SnapDistanceSq or distSq < 1e-6 then
		return target, Vector3.zero
	end

	local omega = 2.0 / math.max(1e-4, smoothTime)
	local expFactor = math.exp(-omega * dt)
	local temp = (velocity + diff * omega) * dt
	local nextVel = (velocity - temp * omega) * expFactor
	local nextPos = target + (diff + temp) * expFactor
	return nextPos, nextVel
end

-- Handle Cannon Shoot Recoil (handleShootRecoil in CQl67Veh.js)
BulletShootEvent.Event:Connect(function(muzzleDirection: Vector3?)
	local dir = muzzleDirection or Vector3.new(1, 0, 0)
	local flatDir = Vector3.new(dir.X, 0, dir.Z)
	if flatDir.Magnitude > 0.001 then
		flatDir = flatDir.Unit
	else
		flatDir = Vector3.new(1, 0, 0)
	end

	local nextRecoil = recoilOffset - flatDir * CONFIG.RecoilKickDistance
	if nextRecoil.Magnitude > CONFIG.MaxRecoilDistance then
		nextRecoil = nextRecoil.Unit * CONFIG.MaxRecoilDistance
	end
	recoilOffset = nextRecoil
	trauma = math.min(1.0, trauma + 0.35)
end)

CameraShakeEvent.Event:Connect(function(amount: number)
	trauma = math.min(1.0, trauma + (amount or 0.45))
end)

-- Transition out of Hexagon Intro Mode when "LET'S GO" is clicked
IntroCompleteEvent.Event:Connect(function()
	isIntroActive = false
	targetZoomScale = 1.0
	TweenService:Create(
		Camera,
		TweenInfo.new(0.85, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
		{ FieldOfView = CONFIG.GameplayFOV }
	):Play()
end)

-- Mouse Wheel Zoom adjustment
UserInputService.InputChanged:Connect(function(input, gameProcessed)
	if gameProcessed or isIntroActive then
		return
	end
	if input.UserInputType == Enum.UserInputType.MouseWheel then
		CONFIG.ZoomTargetValue = math.clamp(CONFIG.ZoomTargetValue - input.Position.Z * 0.08, 0.0, 1.0)
	end
end)

-- Initialize Camera
Camera.CameraType = Enum.CameraType.Scriptable
Camera.FieldOfView = CONFIG.IntroFOV

local initialRoot = getTankRoot()
if initialRoot then
	targetPos = initialRoot.Position
	targetEased = initialRoot.Position
end

RunService:BindToRenderStep("BlitzIsometricCamera", Enum.RenderPriority.Camera.Value + 1, function(rawDt: number)
	local dt = math.min(rawDt, 0.05)
	if math.abs(dt - 0.016667) < 0.0022 then
		dt = 0.016667
	end

	local root = getTankRoot()
	local currentSpeed = CONFIG.BaseSpeed
	if root then
		targetPos = root.Position
		currentSpeed = Vector3.new(root.AssemblyLinearVelocity.X, 0, root.AssemblyLinearVelocity.Z).Magnitude
	end

	-- 1. Critically-Damped Target Follow
	targetEased, targetVelocity = stepCriticalDampedSpring(targetEased, targetPos, targetVelocity, currentSpeed, dt)

	-- 2. Smooth Zoom Interpolation
	CONFIG.ZoomValue = CONFIG.ZoomValue + (CONFIG.ZoomTargetValue - CONFIG.ZoomValue) * (1 - math.exp(-8 * dt))
	currentZoomScale = currentZoomScale + (targetZoomScale - currentZoomScale) * (1 - math.exp(-5 * dt))

	local zoomDist = CONFIG.ZoomMinDistance + CONFIG.ZoomAmplitude * CONFIG.ZoomValue
	local baseAngleDir = CONFIG.DefaultAngleOffset.Unit
	local angleVec = (baseAngleDir * zoomDist * CONFIG.DistanceMultiplier) / math.max(0.5, currentZoomScale)

	-- 3. Mouse Pan Offset (projected on ground basis relative to camera angle)
	local forwardVec = Vector3.new(-angleVec.X, 0, -angleVec.Z).Unit
	local rightVec = forwardVec:Cross(upVec).Unit

	if not isIntroActive then
		local viewportSize = Camera.ViewportSize
		local mouseLoc = UserInputService:GetMouseLocation()
		local normMouseX = (mouseLoc.X / math.max(viewportSize.X, 1)) * 2 - 1
		local normMouseY = -((mouseLoc.Y / math.max(viewportSize.Y, 1)) * 2 - 1)
		targetMousePan = rightVec * (normMouseX * CONFIG.MousePanSensitivity)
			+ forwardVec * (normMouseY * CONFIG.MousePanSensitivity)
	else
		targetMousePan = Vector3.zero
	end

	local mouseLerp = 1 - math.exp(-CONFIG.MousePanDampSpeed * dt)
	mousePanOffset = mousePanOffset:Lerp(targetMousePan, mouseLerp)

	-- 4. Recoil & Trauma Decay
	recoilOffset = recoilOffset:Lerp(Vector3.zero, 1 - math.exp(-10 * dt))
	trauma = math.max(0, trauma - dt * 2.4)
	local shakeMag = (trauma * trauma) * (0.45 * METER_TO_STUDS)
	local shakeVec = Vector3.new(
		math.sin(os.clock() * 47) * shakeMag,
		math.cos(os.clock() * 53) * shakeMag * 0.6,
		math.sin(os.clock() * 41) * shakeMag
	)

	-- 5. Hexagon Intro Framing Shift (places Tank centered inside right-side Hexagon cutout)
	local introOffset = Vector3.zero
	if isIntroActive or currentZoomScale > 1.01 then
		local blend = math.clamp((currentZoomScale - 1.0) / (CONFIG.IntroZoomScale - 1.0), 0, 1)
		local shiftRight = -rightVec * (3.2 * METER_TO_STUDS * blend)
		local shiftUp = Vector3.new(0, 0.65 * METER_TO_STUDS * blend, 0)
		introOffset = shiftRight + shiftUp
	end

	local focusPoint = targetEased + mousePanOffset + recoilOffset + introOffset + shakeVec
	local camPos = focusPoint + angleVec

	Camera.CFrame = CFrame.lookAt(camPos, focusPoint, upVec)
end)
`,
  },
  {
    id: 'tank-builder-controller',
    title: '2. TankBuilder.server.lua & TankController.client.lua',
    robloxPath:
      'ServerScriptService/TankBuilder.server.lua + StarterPlayerScripts/TankController.client.lua',
    scriptType: 'Script',
    summary:
      'Rig Tank 11-bagian & Factory Playground (Hydrant, Manhole, ExplosiveBarrel, ConcreteFence, PowerCore) + Kontrol Fisika 1:1 dari Rapier (speed 8, boost 1.9x, turretDamping 0.06, projectileSpeed 55, recoil 0.16, dan Grab Mode [G]).',
    code: `--!strict
--[[
  =============================================================================
  PART A: ServerScriptService/TankBuilder.server.lua
  Builds the composite Neon-Green Tank (#b8ff3c / #c7ff72) & Factory Playground
  props with exact Rapier-equivalent mass, friction, restitution, and welds.
  =============================================================================
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local Debris = game:GetService("Debris")

local METER_TO_STUDS = 3.5

-- RemoteEvents for Cannon Fire & Factory Playground Telekinesis Grab
local Remotes = Instance.new("Folder")
Remotes.Name = "BlitzRemotes"
Remotes.Parent = ReplicatedStorage

local FireCannonRemote = Instance.new("RemoteEvent")
FireCannonRemote.Name = "FireCannon"
FireCannonRemote.Parent = Remotes

local GrabPropRemote = Instance.new("RemoteEvent")
GrabPropRemote.Name = "GrabProp"
GrabPropRemote.Parent = Remotes

-- Palette from buddies-blitz.com
local COLORS = {
	TankNeonLime = Color3.fromRGB(184, 255, 60),    -- #b8ff3c
	TankHighlight = Color3.fromRGB(199, 255, 114),  -- #c7ff72
	TankYellow = Color3.fromRGB(254, 200, 62),      -- #fec83e
	TrackDark = Color3.fromRGB(39, 41, 53),         -- #272935
	BarrelSteel = Color3.fromRGB(57, 59, 73),       -- #393b49
	ExplosiveRed = Color3.fromRGB(244, 47, 76),     -- #f42f4c
	AsphaltDark = Color3.fromRGB(29, 32, 46),       -- Road surface
	ZebraWhite = Color3.fromRGB(242, 244, 248),     -- Zebra stripe
	OutlineInk = Color3.fromRGB(23, 17, 15),        -- #17110f
}

local function weldParts(root: BasePart, part: BasePart)
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = root
	weld.Part1 = part
	weld.Parent = part
end

local function createPart(
	name: string,
	size: Vector3,
	color: Color3,
	material: Enum.Material,
	parent: Instance
): Part
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = material
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CanCollide = false
	p.Massless = true
	p.Parent = parent
	return p
end

-- Builds the composite 11-part Player Tank Rig
local function buildTankModel(player: Player, spawnPos: Vector3): Model
	local model = Instance.new("Model")
	model.Name = "PlayerTank_" .. player.Name

	-- 1. Physics Root Chassis (Rapier cuboid: friction = 0.3, restitution = 0.4)
	local chassis = createPart(
		"ChassisRoot",
		Vector3.new(2.2, 1.0, 1.8) * METER_TO_STUDS,
		COLORS.TankNeonLime,
		Enum.Material.SmoothPlastic,
		model
	)
	chassis.CanCollide = true
	chassis.Massless = false
	chassis.CustomPhysicalProperties = PhysicalProperties.new(2.5, 0.3, 0.4, 1.0, 1.0)
	chassis.CFrame = CFrame.new(spawnPos) * CFrame.Angles(0, math.rad(-180), 0)
	model.PrimaryPart = chassis

	-- 2. Upper Sloped Glacis Hull
	local upperHull = createPart(
		"UpperHull",
		Vector3.new(1.85, 0.45, 1.45) * METER_TO_STUDS,
		COLORS.TankHighlight,
		Enum.Material.SmoothPlastic,
		model
	)
	upperHull.CFrame = chassis.CFrame * CFrame.new(0, 0.55 * METER_TO_STUDS, 0)
	weldParts(chassis, upperHull)

	-- 3 & 4. Left & Right Armored Track Pods + Track Covers
	for _, side in ipairs({ -1, 1 }) do
		local trackPod = createPart(
			side == -1 and "LeftTrack" or "RightTrack",
			Vector3.new(2.4, 0.72, 0.38) * METER_TO_STUDS,
			COLORS.TrackDark,
			Enum.Material.Metal,
			model
		)
		trackPod.CFrame = chassis.CFrame * CFrame.new(0, -0.18 * METER_TO_STUDS, side * 0.88 * METER_TO_STUDS)
		weldParts(chassis, trackPod)

		local fender = createPart(
			side == -1 and "LeftCover" or "RightCover",
			Vector3.new(2.48, 0.16, 0.44) * METER_TO_STUDS,
			COLORS.TankNeonLime,
			Enum.Material.SmoothPlastic,
			model
		)
		fender.CFrame = chassis.CFrame * CFrame.new(0, 0.22 * METER_TO_STUDS, side * 0.88 * METER_TO_STUDS)
		weldParts(chassis, fender)
	end

	-- 5. Rear Yellow Engine Grille & Boost Vent (#fec83e)
	local rearGrille = createPart(
		"RearBoostGrille",
		Vector3.new(0.25, 0.5, 1.2) * METER_TO_STUDS,
		COLORS.TankYellow,
		Enum.Material.Neon,
		model
	)
	rearGrille.CFrame = chassis.CFrame * CFrame.new(-1.08 * METER_TO_STUDS, 0.15 * METER_TO_STUDS, 0)
	weldParts(chassis, rearGrille)

	-- 6. Turret Pivot Base (driven smoothly by Motor6D on client/server)
	local turret = createPart(
		"Player_Turret",
		Vector3.new(1.25, 0.68, 1.25) * METER_TO_STUDS,
		COLORS.TankNeonLime,
		Enum.Material.SmoothPlastic,
		model
	)
	turret.CFrame = chassis.CFrame * CFrame.new(-0.05 * METER_TO_STUDS, 0.95 * METER_TO_STUDS, 0)

	local turretMotor = Instance.new("Motor6D")
	turretMotor.Name = "TurretMotor"
	turretMotor.Part0 = chassis
	turretMotor.Part1 = turret
	turretMotor.C0 = CFrame.new(-0.05 * METER_TO_STUDS, 0.95 * METER_TO_STUDS, 0)
	turretMotor.Parent = chassis

	-- 7. Commander Hatch & Yellow Visor Strip
	local hatch = createPart(
		"TurretHatch",
		Vector3.new(0.55, 0.22, 0.55) * METER_TO_STUDS,
		COLORS.TankYellow,
		Enum.Material.SmoothPlastic,
		model
	)
	hatch.CFrame = turret.CFrame * CFrame.new(-0.15 * METER_TO_STUDS, 0.42 * METER_TO_STUDS, 0)
	weldParts(turret, hatch)

	-- 8. Recoiling Cannon Barrel & Muzzle Brake (Motor6D for 0.16m recoil push/return)
	local barrel = createPart(
		"Player_Barrel",
		Vector3.new(1.65, 0.28, 0.28) * METER_TO_STUDS,
		COLORS.BarrelSteel,
		Enum.Material.Metal,
		model
	)
	barrel.CFrame = turret.CFrame * CFrame.new(1.15 * METER_TO_STUDS, 0.05 * METER_TO_STUDS, 0)

	local barrelMotor = Instance.new("Motor6D")
	barrelMotor.Name = "BarrelMotor"
	barrelMotor.Part0 = turret
	barrelMotor.Part1 = barrel
	barrelMotor.C0 = CFrame.new(1.15 * METER_TO_STUDS, 0.05 * METER_TO_STUDS, 0)
	barrelMotor.Parent = turret

	local muzzleTip = createPart(
		"MuzzleTip",
		Vector3.new(0.28, 0.40, 0.40) * METER_TO_STUDS,
		COLORS.TankYellow,
		Enum.Material.SmoothPlastic,
		model
	)
	muzzleTip.CFrame = barrel.CFrame * CFrame.new(0.82 * METER_TO_STUDS, 0, 0)
	weldParts(barrel, muzzleTip)

	-- Physics Mover Attachments & Constraints (LinearVelocity + AngularVelocity + AlignOrientation upright lock)
	local rootAttachment = Instance.new("Attachment")
	rootAttachment.Name = "RootAttachment"
	rootAttachment.Parent = chassis

	local linVel = Instance.new("LinearVelocity")
	linVel.Name = "DriveVelocity"
	linVel.Attachment0 = rootAttachment
	linVel.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	linVel.PrimaryTangentAxis = Vector3.new(1, 0, 0)
	linVel.SecondaryTangentAxis = Vector3.new(0, 0, 1)
	linVel.MaxForce = 450000
	linVel.PlaneVelocity = Vector2.zero
	linVel.Parent = chassis

	local angVel = Instance.new("AngularVelocity")
	angVel.Name = "TurnVelocity"
	angVel.Attachment0 = rootAttachment
	angVel.RelativeTo = Enum.ActuatorRelativeTo.World
	angVel.MaxTorque = 350000
	angVel.AngularVelocity = Vector3.zero
	angVel.Parent = chassis

	CollectionService:AddTag(model, "CelShadedOutlined")
	model.Parent = workspace
	chassis:SetNetworkOwner(player)

	return model
end

-- Build Factory Playground Environment (Zebra Cross, Hydrant, Manhole, Steam Pipe, Barrels, PowerCore)
local function buildFactoryPlayground()
	if workspace:FindFirstChild("FactoryPlayground") then
		return
	end
	local folder = Instance.new("Folder")
	folder.Name = "FactoryPlayground"
	folder.Parent = workspace

	-- Ground & Road with Zebra Cross
	local ground = Instance.new("Part")
	ground.Name = "FactoryFloor"
	ground.Anchored = true
	ground.Size = Vector3.new(360, 4, 360)
	ground.Position = Vector3.new(0, -2, 0)
	ground.Color = COLORS.AsphaltDark
	ground.Material = Enum.Material.Concrete
	ground.CustomPhysicalProperties = PhysicalProperties.new(1.0, 0.8, 0.0, 1.0, 1.0)
	ground.Parent = folder

	for i = -3, 3 do
		local stripe = Instance.new("Part")
		stripe.Name = "ZebraStripe_" .. tostring(i)
		stripe.Anchored = true
		stripe.CanCollide = false
		stripe.Size = Vector3.new(12, 0.08, 2.2)
		stripe.Position = Vector3.new(0, 0.04, i * 4.2)
		stripe.Color = COLORS.ZebraWhite
		stripe.Material = Enum.Material.SmoothPlastic
		stripe.Parent = folder
	end

	-- Steam Manholes & Chimneys (tagged for LightingSetup puff smoke emitters)
	for idx, pos in ipairs({ Vector3.new(-22, 0.2, -16), Vector3.new(24, 0.2, 18), Vector3.new(-18, 0.2, 26) }) do
		local manhole = Instance.new("Part")
		manhole.Name = "SteamManhole_" .. tostring(idx)
		manhole.Shape = Enum.PartType.Cylinder
		manhole.Anchored = true
		manhole.Size = Vector3.new(0.4, 5.5, 5.5)
		manhole.CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, math.rad(90))
		manhole.Color = COLORS.BarrelSteel
		manhole.Material = Enum.Material.Metal
		manhole.Parent = folder
		CollectionService:AddTag(manhole, "SteamSmokeEmitter")
		CollectionService:AddTag(manhole, "CelShadedOutlined")
	end

	-- Dynamic Props (ExplosiveBarrels, Hydrants, Crates)
	local propCoords = {
		{ name = "ExplosiveBarrel", pos = Vector3.new(28, 3, -12), color = COLORS.ExplosiveRed, size = Vector3.new(3.5, 5.2, 3.5) },
		{ name = "ExplosiveBarrel", pos = Vector3.new(32, 3, -8), color = COLORS.ExplosiveRed, size = Vector3.new(3.5, 5.2, 3.5) },
		{ name = "Hydrant", pos = Vector3.new(-14, 2.5, -24), color = COLORS.TankYellow, size = Vector3.new(2.6, 4.8, 2.6) },
		{ name = "MetalBox_1A", pos = Vector3.new(18, 3, 22), color = COLORS.TankNeonLime, size = Vector3.new(4.5, 4.5, 4.5) },
	}
	for _, spec in ipairs(propCoords) do
		local prop = Instance.new("Part")
		prop.Name = spec.name
		prop.Size = spec.size
		prop.Position = spec.pos
		prop.Color = spec.color
		prop.Material = Enum.Material.SmoothPlastic
		prop.CustomPhysicalProperties = PhysicalProperties.new(1.0, 0.5, 0.1, 1.0, 1.0)
		prop.Parent = folder
		CollectionService:AddTag(prop, "DynamicPlaygroundProp")
		CollectionService:AddTag(prop, "CelShadedOutlined")
	end
end

buildFactoryPlayground()

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		local existing = workspace:FindFirstChild("PlayerTank_" .. player.Name)
		if existing then
			existing:Destroy()
		end
		buildTankModel(player, Vector3.new(0, 3.5, 0))
	end)
	buildTankModel(player, Vector3.new(0, 3.5, 0))
end)

-- Handle Cannon Projectile & Recoil Impulse on Dynamic Props (handleBulletImpact in B1Nq4Kq6.js)
FireCannonRemote.OnServerEvent:Connect(function(player, origin: Vector3, direction: Vector3)
	local dir = direction.Unit
	local bullet = Instance.new("Part")
	bullet.Name = "TankBullet"
	bullet.Shape = Enum.PartType.Ball
	bullet.Size = Vector3.new(1.4, 1.4, 1.4)
	bullet.Color = Color3.fromRGB(0, 255, 102) -- #00ff66
	bullet.Material = Enum.Material.Neon
	bullet.CanCollide = false
	bullet.CFrame = CFrame.new(origin)
	bullet.Parent = workspace

	local pointLight = Instance.new("PointLight")
	pointLight.Color = Color3.fromRGB(0, 255, 102)
	pointLight.Brightness = 1.8
	pointLight.Range = 6 * METER_TO_STUDS
	pointLight.Parent = bullet

	bullet.AssemblyLinearVelocity = dir * (55 * METER_TO_STUDS)
	Debris:AddItem(bullet, 1.0)

	bullet.Touched:Connect(function(hit: BasePart)
		if hit:IsDescendantOf(workspace:FindFirstChild("PlayerTank_" .. player.Name)) then
			return
		end
		if not hit.Anchored then
			local mass = math.max(0.5, hit.AssemblyMass)
			local impulse = (dir * 18 + Vector3.new(0, 6, 0)) * mass
			hit:ApplyImpulse(impulse)
			hit:ApplyAngularImpulse(Vector3.new(math.random() - 0.5, 0.4, math.random() - 0.5) * mass * 8)
		end
		bullet:Destroy()
	end)
end)

--[[
  =============================================================================
  PART B: StarterPlayerScripts/TankController.client.lua
  Implements 1:1 Tank Drive, Boost, Turret Slerp, Recoil Animation & [G] Grab
  =============================================================================
]]
--[[
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LocalPlayer = Players.LocalPlayer
local Mouse = LocalPlayer:GetMouse()
local METER_TO_STUDS = 3.5

-- Exact Rapier constants from sr & ur classes in B1Nq4Kq6.js
local TANK_STATS = {
	BaseSpeed = 8.0 * METER_TO_STUDS,
	BoostMultiplier = 1.9,
	RotationSpeed = 3.12,
	BoostRotationMultiplier = 1.2,
	DriveLerpRate = 8.0,
	RotationLerpRate = 50.0,
	ForwardFrictionFactor = 0.5,
	LateralFrictionFactor = 20.0,
	RotationDampingFactor = 0.15 * 60,
	TurretDampingRate = 0.06 * 60,
	FireRate = 0.20,
	RecoilDistance = 0.16 * METER_TO_STUDS,
	RecoilPushDuration = 0.10,
	RecoilReturnDuration = 0.50,
}

local currentSpeed = TANK_STATS.BaseSpeed
local currentYawVel = 0
local currentTurretYaw = 0
local lastFireTime = 0
local isGrabMode = false
local grabbedPart: BasePart? = nil

local Remotes = ReplicatedStorage:WaitForChild("BlitzRemotes")
local FireCannonRemote = Remotes:WaitForChild("FireCannon") :: RemoteEvent
local Events = ReplicatedStorage:WaitForChild("BlitzEvents")
local BulletShootEvent = Events:WaitForChild("BulletShoot") :: BindableEvent

local function getTank(): Model?
	return workspace:FindFirstChild("PlayerTank_" .. LocalPlayer.Name) :: Model?
end

-- Shoot Handler with Barrel & Turret Recoil Tween
local function tryShoot()
	if os.clock() - lastFireTime < TANK_STATS.FireRate then
		return
	end
	local tank = getTank()
	if not tank or not tank.PrimaryPart then
		return
	end
	lastFireTime = os.clock()

	local turret = tank:FindFirstChild("Player_Turret") :: BasePart?
	local barrel = tank:FindFirstChild("Player_Barrel") :: BasePart?
	local barrelMotor = turret and turret:FindFirstChild("BarrelMotor") :: Motor6D?
	local muzzle = tank:FindFirstChild("MuzzleTip") :: BasePart?

	local origin = muzzle and muzzle.Position or (tank.PrimaryPart.Position + Vector3.new(0, 3, 0))
	local shootDir = barrel and barrel.CFrame.RightVector or tank.PrimaryPart.CFrame.RightVector

	FireCannonRemote:FireServer(origin, shootDir)
	BulletShootEvent:Fire(shootDir)

	if barrelMotor then
		local baseC0 = CFrame.new(1.15 * METER_TO_STUDS, 0.05 * METER_TO_STUDS, 0)
		local recoilC0 = baseC0 * CFrame.new(-TANK_STATS.RecoilDistance, 0, 0)
		TweenService:Create(barrelMotor, TweenInfo.new(TANK_STATS.RecoilPushDuration, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { C0 = recoilC0 }):Play()
		task.delay(TANK_STATS.RecoilPushDuration, function()
			TweenService:Create(barrelMotor, TweenInfo.new(TANK_STATS.RecoilReturnDuration, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out), { C0 = baseC0 }):Play()
		end)
	end
end

UserInputService.InputBegan:Connect(function(input, gp)
	if gp then return end
	if input.KeyCode == Enum.KeyCode.Space or input.UserInputType == Enum.UserInputType.MouseButton1 then
		tryShoot()
	elseif input.KeyCode == Enum.KeyCode.G then
		isGrabMode = not isGrabMode
		if not isGrabMode then
			grabbedPart = nil
		elseif Mouse.Target and not Mouse.Target.Anchored then
			grabbedPart = Mouse.Target
		end
	end
end)

RunService.Heartbeat:Connect(function(rawDt: number)
	local dt = math.min(rawDt, 0.05)
	local tank = getTank()
	if not tank or not tank.PrimaryPart then return end

	local chassis = tank.PrimaryPart
	local driveVel = chassis:FindFirstChild("DriveVelocity") :: LinearVelocity?
	local turnVel = chassis:FindFirstChild("TurnVelocity") :: AngularVelocity?
	local turretMotor = chassis:FindFirstChild("TurretMotor") :: Motor6D?

	local w = UserInputService:IsKeyDown(Enum.KeyCode.W) or UserInputService:IsKeyDown(Enum.KeyCode.Up)
	local s = UserInputService:IsKeyDown(Enum.KeyCode.S) or UserInputService:IsKeyDown(Enum.KeyCode.Down)
	local a = UserInputService:IsKeyDown(Enum.KeyCode.A) or UserInputService:IsKeyDown(Enum.KeyCode.Left)
	local d = UserInputService:IsKeyDown(Enum.KeyCode.D) or UserInputService:IsKeyDown(Enum.KeyCode.Right)
	local boost = UserInputService:IsKeyDown(Enum.KeyCode.LeftShift)

	local maxBoostSpeed = TANK_STATS.BaseSpeed * TANK_STATS.BoostMultiplier
	local speedDelta = (maxBoostSpeed - TANK_STATS.BaseSpeed) * (boost and 1 or -10) * dt
	currentSpeed = math.clamp(currentSpeed + speedDelta, TANK_STATS.BaseSpeed, maxBoostSpeed)

	local forwardInput = (w and 1 or 0) - (s and 1 or 0)
	local turnInput = (a and 1 or 0) - (d and 1 or 0)

	local forwardDir = Vector3.new(chassis.CFrame.RightVector.X, 0, chassis.CFrame.RightVector.Z).Unit
	if driveVel then
		local targetPlanar = forwardDir * (forwardInput * currentSpeed)
		local currentPlanar = Vector3.new( driveVel.PlaneVelocity.X, 0, driveVel.PlaneVelocity.Y )
		local nextPlanar = currentPlanar:Lerp(targetPlanar, 1 - math.exp(-TANK_STATS.DriveLerpRate * dt))
		driveVel.PlaneVelocity = Vector2.new(nextPlanar.X, nextPlanar.Z)
	end

	if turnVel then
		if math.abs(turnInput) > 0.01 then
			local boostMult = boost and TANK_STATS.BoostRotationMultiplier or 1.0
			local targetAng = turnInput * TANK_STATS.RotationSpeed * boostMult
			currentYawVel = currentYawVel + (targetAng - currentYawVel) * (1 - math.exp(-TANK_STATS.RotationLerpRate * dt))
		else
			currentYawVel = currentYawVel * math.exp(-TANK_STATS.RotationDampingFactor * dt)
		end
		turnVel.AngularVelocity = Vector3.new(0, currentYawVel, 0)
	end

	-- Turret Aiming toward Mouse Hit on Ground Plane
	if turretMotor and Mouse.Hit then
		local aimVec = Mouse.Hit.Position - chassis.Position
		if Vector3.new(aimVec.X, 0, aimVec.Z).Magnitude > 0.1 then
			local localAim = chassis.CFrame:VectorToObjectSpace(aimVec)
			local targetYaw = math.atan2(-localAim.Z, localAim.X)
			local diff = ((targetYaw - currentTurretYaw + math.pi) % (math.pi * 2)) - math.pi
			currentTurretYaw = currentTurretYaw + diff * (1 - math.exp(-TANK_STATS.TurretDampingRate * dt))
			turretMotor.C0 = CFrame.new(-0.05 * METER_TO_STUDS, 0.95 * METER_TO_STUDS, 0) * CFrame.Angles(0, currentTurretYaw, 0)
		end
	end

	-- Factory Playground [G] Telekinesis Spring Force (springStrength = 180, damping = 16)
	if isGrabMode and grabbedPart and Mouse.Hit then
		local holdPos = Vector3.new(Mouse.Hit.Position.X, chassis.Position.Y + 6, Mouse.Hit.Position.Z)
		local displacement = holdPos - grabbedPart.Position
		local springVel = displacement * 12 - grabbedPart.AssemblyLinearVelocity * 0.35
		grabbedPart.AssemblyLinearVelocity = springVel
	end
end)
]]
`,
  },
  {
    id: 'lighting-cel-shading',
    title: '3. LightingSetup.server.lua',
    robloxPath: 'ServerScriptService/LightingSetup.server.lua',
    scriptType: 'Script',
    summary:
      'Konversi TSL WorldMaterial & RobotStrokeMaterial ke Roblox: Highlight Ink Outline (#17110f), ShadowSoftness = 0 (hard cel-shaded shadows), Day/Dusk/Night cycle (Di=class), dan Cartoon Puff Smoke ParticleEmitter pada Manhole/Chimney.',
    code: `--!strict
--[[
  ServerScriptService/LightingSetup.server.lua
  Ported 1:1 from https://buddies-blitz.com/ (Yn, Nn, Di, and Ji classes in B1Nq4Kq6.js)
  Implements:
  - Hard Cel-Shading Shadows (Future Lighting, ShadowSoftness = 0, ColorCorrectionEffect)
  - Hard Ink Outlines (#17110f / RGB 23, 17, 15) via Roblox Highlight instances
  - Day / Dusk / Night / Dawn Presets (365s cycle or manual preset switch)
  - Cartoon Puff Smoke System on Manholes and Factory Chimneys (Ji=class)
]]

local Lighting = game:GetService("Lighting")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

-- 1. Bundled Day/Dusk/Night/Dawn Presets from Di=class (B1Nq4Kq6.js)
local PRESETS = {
	day = {
		ClockTime = 13.5,
		LightColor = Color3.fromHex("#ffe6b1"),
		ShadowColor = Color3.fromHex("#454778"),
		FogColor = Color3.fromHex("#00a2ff"),
		Brightness = 2.4,
		TintColor = Color3.fromHex("#ffffff"),
		Contrast = 0.24,
		Saturation = 0.18,
	},
	dusk = {
		ClockTime = 17.8,
		LightColor = Color3.fromHex("#ffebc7"),
		ShadowColor = Color3.fromHex("#66009c"),
		FogColor = Color3.fromHex("#ff6d6d"),
		Brightness = 2.0,
		TintColor = Color3.fromHex("#ffd6d6"),
		Contrast = 0.28,
		Saturation = 0.22,
	},
	night = {
		ClockTime = 21.5,
		LightColor = Color3.fromHex("#3a456c"),
		ShadowColor = Color3.fromHex("#1e2238"),
		FogColor = Color3.fromHex("#5560a2"),
		Brightness = 1.8,
		TintColor = Color3.fromHex("#c2c6ff"),
		Contrast = 0.32,
		Saturation = 0.15,
	},
	dawn = {
		ClockTime = 6.5,
		LightColor = Color3.fromHex("#ffe5c0"),
		ShadowColor = Color3.fromHex("#494949"),
		FogColor = Color3.fromHex("#ffca58"),
		Brightness = 2.1,
		TintColor = Color3.fromHex("#fff7ef"),
		Contrast = 0.22,
		Saturation = 0.16,
	},
}

-- 2. Configure Cel-Shaded Base Lighting (ShadowSoftness = 0 for sharp comic shadow step)
Lighting.Technology = Enum.Technology.Future
Lighting.GlobalShadows = true
Lighting.ShadowSoftness = 0.0
Lighting.EnvironmentDiffuseScale = 0.35
Lighting.EnvironmentSpecularScale = 0.15

local colorCorrection = Lighting:FindFirstChild("BlitzCelGrading") :: ColorCorrectionEffect?
if not colorCorrection then
	colorCorrection = Instance.new("ColorCorrectionEffect")
	colorCorrection.Name = "BlitzCelGrading"
	colorCorrection.Parent = Lighting
end

local atmosphere = Lighting:FindFirstChild("BlitzAtmosphere") :: Atmosphere?
if not atmosphere then
	atmosphere = Instance.new("Atmosphere")
	atmosphere.Name = "BlitzAtmosphere"
	atmosphere.Density = 0.26
	atmosphere.Offset = 0.15
	atmosphere.Glare = 0
	atmosphere.Haze = 1.2
	atmosphere.Parent = Lighting
end

local function applyLightingPreset(presetKey: string)
	local p = PRESETS[presetKey] or PRESETS.day
	Lighting.ClockTime = p.ClockTime
	Lighting.Brightness = p.Brightness
	Lighting.ColorShift_Top = p.LightColor
	Lighting.Ambient = p.ShadowColor
	Lighting.OutdoorAmbient = p.ShadowColor:Lerp(p.LightColor, 0.25)
	Lighting.FogColor = p.FogColor

	if colorCorrection then
		colorCorrection.Contrast = p.Contrast
		colorCorrection.Saturation = p.Saturation
		colorCorrection.TintColor = p.TintColor
	end
	if atmosphere then
		atmosphere.Color = p.FogColor
		atmosphere.Decay = p.ShadowColor
	end
end

applyLightingPreset("day")

-- 3. Hard Ink Outline System (Replicates Nn / RobotStrokeMaterial: #17110f)
local INK_OUTLINE_COLOR = Color3.fromRGB(23, 17, 15) -- #17110f

local function attachInkOutline(instance: Instance)
	if instance:FindFirstChild("BlitzInkOutline") then
		return
	end
	local highlight = Instance.new("Highlight")
	highlight.Name = "BlitzInkOutline"
	highlight.Adornee = instance
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded
	highlight.FillTransparency = 1.0
	highlight.OutlineColor = INK_OUTLINE_COLOR
	highlight.OutlineTransparency = 0.0
	highlight.Parent = instance
end

for _, inst in ipairs(CollectionService:GetTagged("CelShadedOutlined")) do
	attachInkOutline(inst)
end
CollectionService:GetInstanceAddedSignal("CelShadedOutlined"):Connect(attachInkOutline)

-- 4. Cartoon Puff Smoke Emitter (Ported 1:1 from Ji=class ChimneySmoke in B1Nq4Kq6.js)
-- Parameters: upwardVel = 1.28..1.92 m/s, lifetime = 5.5..8.5s, startScale = 0.14..0.24, endScale = 0.9..1.4, peakOpacity = 0.72..0.92
local function attachCartoonSmokeEmitter(part: Instance)
	if not part:IsA("BasePart") or part:FindFirstChild("CartoonPuffSmoke") then
		return
	end

	local attachment = Instance.new("Attachment")
	attachment.Name = "SmokeAttachment"
	attachment.Position = Vector3.new(0, 0.5, 0)
	attachment.Parent = part

	local emitter = Instance.new("ParticleEmitter")
	emitter.Name = "CartoonPuffSmoke"
	emitter.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0.0, Color3.fromRGB(255, 255, 255)),
		ColorSequenceKeypoint.new(0.6, Color3.fromRGB(235, 240, 252)),
		ColorSequenceKeypoint.new(1.0, Color3.fromRGB(195, 204, 226)),
	})
	emitter.LightEmission = 0.05
	emitter.LightInfluence = 0.45
	emitter.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0.0, 0.7),
		NumberSequenceKeypoint.new(0.35, 2.4),
		NumberSequenceKeypoint.new(1.0, 4.6),
	})
	emitter.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0.0, 1.0),
		NumberSequenceKeypoint.new(0.15, 0.14), -- peakOpacity ~0.86
		NumberSequenceKeypoint.new(0.75, 0.35),
		NumberSequenceKeypoint.new(1.0, 1.0),
	})
	emitter.Lifetime = NumberRange.new(5.5, 8.5)
	emitter.Rate = 4.5
	emitter.Rotation = NumberRange.new(0, 360)
	emitter.RotSpeed = NumberRange.new(-10, 10)
	emitter.Speed = NumberRange.new(4.5, 6.7) -- 1.28..1.92 m/s * 3.5 studs
	emitter.SpreadAngle = Vector2.new(12, 12)
	emitter.Acceleration = Vector3.new(1.2, 0.4, 0.6) -- subtle wind drift
	emitter.Parent = attachment
end

for _, inst in ipairs(CollectionService:GetTagged("SteamSmokeEmitter")) do
	attachCartoonSmokeEmitter(inst)
end
CollectionService:GetInstanceAddedSignal("SteamSmokeEmitter"):Connect(attachCartoonSmokeEmitter)
`,
  },
  {
    id: 'comic-intro-ui',
    title: '4. BlitzPortfolioUI.client.lua',
    robloxPath: 'StarterGui/BlitzPortfolioUI.client.lua',
    scriptType: 'LocalScript',
    summary:
      'Replikasi 1:1 dari CJn-Xu8f.js & BcJjgNcx.css: Layar Intro dengan Hexagon Viewport Cutout di kanan, tipografi stiker komik "BLITZ" + "PORTFOLIO" (#b4ff39), tombol miring "LET\'S GO" dengan animasi elastic GSAP, tombol Mute poligon, dan transisi tanpa jeda.',
    code: `--!strict
--[[
  StarterGui/BlitzPortfolioUI.client.lua
  Ported 1:1 from https://buddies-blitz.com/ (CJn-Xu8f.js & BcJjgNcx.css)
  Implements:
  - Right-side Hexagon / Polygon Viewport Mask revealing the 3D Tank
  - Bottom-left Comic Sticker Lockup: "BLITZ" (white + double black/white stroke) & "PORTFOLIO" (#b4ff39)
  - Tilted Neon-Green "LET'S GO" CTA Button with GSAP-equivalent Elastic/Back hover & click tween
  - Top-right Polygon Audio Mute Toggle Button
  - Seamless Hexagon Expansion Transition into Full-Screen Factory Playground HUD
]]

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")

local LocalPlayer = Players.LocalPlayer
local PlayerGui = LocalPlayer:WaitForChild("PlayerGui")

local COLORS = {
	NeonLime = Color3.fromHex("#b4ff39"),
	BrandHighlight = Color3.fromHex("#c7ff72"),
	InkDark = Color3.fromHex("#11121a"),
	SurfaceDark = Color3.fromHex("#191b24"),
	PureWhite = Color3.fromHex("#ffffff"),
	StatusYellow = Color3.fromHex("#fec83e"),
}

local function getIntroCompleteEvent(): BindableEvent
	local folder = ReplicatedStorage:WaitForChild("BlitzEvents")
	return folder:WaitForChild("GameIntroComplete") :: BindableEvent
end

-- Create Root ScreenGui
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BlitzPortfolioUI"
screenGui.IgnoreGuiInset = true
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = PlayerGui

-- 1. Intro Stage Container
local introStage = Instance.new("Frame")
introStage.Name = "StartupIntroStage"
introStage.Size = UDim2.fromScale(1, 1)
introStage.BackgroundTransparency = 1
introStage.Parent = screenGui

-- Left Dark Scrim Panel (leaves right-side Hexagon window clear over the 3D Tank)
local leftBackdrop = Instance.new("Frame")
leftBackdrop.Name = "LeftScrim"
leftBackdrop.Size = UDim2.fromScale(0.54, 1)
leftBackdrop.Position = UDim2.fromScale(0, 0)
leftBackdrop.BackgroundColor3 = COLORS.InkDark
leftBackdrop.BackgroundTransparency = 0.12
leftBackdrop.BorderSizePixel = 0
leftBackdrop.Parent = introStage

-- Right Hexagon Frame Highlighting the Tank (replicates 500x482 polygon mask frame)
local hexContainer = Instance.new("Frame")
hexContainer.Name = "HexagonMaskContainer"
hexContainer.AnchorPoint = Vector2.new(0.5, 0.5)
hexContainer.Position = UDim2.fromScale(0.73, 0.49)
hexContainer.Size = UDim2.fromOffset(470, 450)
hexContainer.BackgroundTransparency = 1
hexContainer.Rotation = -4
hexContainer.Parent = introStage

local hexBorder = Instance.new("UIStroke")
hexBorder.Color = COLORS.PureWhite
hexBorder.Transparency = 0.55
hexBorder.Thickness = 2.5
hexBorder.Parent = hexContainer

local hexCorner = Instance.new("UICorner")
hexCorner.CornerRadius = UDim.new(0.18, 0)
hexCorner.Parent = hexContainer

-- 2. Polygon Mute Audio Button at Top-Right of Hexagon
local isMuted = false
local muteButton = Instance.new("TextButton")
muteButton.Name = "MuteAudioButton"
muteButton.AnchorPoint = Vector2.new(0.5, 0.5)
muteButton.Position = UDim2.fromScale(0.92, 0.10)
muteButton.Size = UDim2.fromOffset(54, 54)
muteButton.BackgroundColor3 = COLORS.PureWhite
muteButton.Text = "SND"
muteButton.Font = Enum.Font.FredokaOne
muteButton.TextSize = 15
muteButton.TextColor3 = COLORS.InkDark
muteButton.Rotation = 6
muteButton.AutoButtonColor = false
muteButton.Parent = hexContainer

local muteCorner = Instance.new("UICorner")
muteCorner.CornerRadius = UDim.new(0.25, 0)
muteCorner.Parent = muteButton

local muteStroke = Instance.new("UIStroke")
muteStroke.Color = COLORS.InkDark
muteStroke.Thickness = 3.5
muteStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
muteStroke.Parent = muteButton

muteButton.MouseButton1Click:Connect(function()
	isMuted = not isMuted
	muteButton.Text = isMuted and "MUTE" or "SND"
	muteButton.BackgroundColor3 = isMuted and COLORS.StatusYellow or COLORS.PureWhite
	SoundService.RespectFilteringEnabled = true
end)

-- 3. Bottom-Left Comic Sticker Typography ("BLITZ" + "PORTFOLIO")
local titleGroup = Instance.new("Frame")
titleGroup.Name = "ComicTitleLockup"
titleGroup.AnchorPoint = Vector2.new(0, 1)
titleGroup.Position = UDim2.new(0.05, 0, 0.90, 0)
titleGroup.Size = UDim2.fromOffset(560, 290)
titleGroup.BackgroundTransparency = 1
titleGroup.Parent = introStage

local blitzLabel = Instance.new("TextLabel")
blitzLabel.Name = "BlitzHeadline"
blitzLabel.Size = UDim2.fromOffset(520, 120)
blitzLabel.Position = UDim2.fromOffset(0, 0)
blitzLabel.BackgroundTransparency = 1
blitzLabel.Text = "BLITZ"
blitzLabel.Font = Enum.Font.FredokaOne
blitzLabel.TextSize = 104
blitzLabel.TextColor3 = COLORS.PureWhite
blitzLabel.TextXAlignment = Enum.TextXAlignment.Left
blitzLabel.Rotation = -3
blitzLabel.Parent = titleGroup

local blitzStroke = Instance.new("UIStroke")
blitzStroke.Color = COLORS.InkDark
blitzStroke.Thickness = 6
blitzStroke.Parent = blitzLabel

local portfolioBadge = Instance.new("Frame")
portfolioBadge.Name = "PortfolioSticker"
portfolioBadge.Size = UDim2.fromOffset(390, 68)
portfolioBadge.Position = UDim2.fromOffset(12, 108)
portfolioBadge.BackgroundColor3 = COLORS.NeonLime
portfolioBadge.Rotation = -2
portfolioBadge.Parent = titleGroup

local portfolioStroke = Instance.new("UIStroke")
portfolioStroke.Color = COLORS.InkDark
portfolioStroke.Thickness = 4.5
portfolioStroke.Parent = portfolioBadge

local portfolioLabel = Instance.new("TextLabel")
portfolioLabel.Size = UDim2.fromScale(1, 1)
portfolioLabel.BackgroundTransparency = 1
portfolioLabel.Text = "PORTFOLIO"
portfolioLabel.Font = Enum.Font.FredokaOne
portfolioLabel.TextSize = 48
portfolioLabel.TextColor3 = COLORS.InkDark
portfolioLabel.Parent = portfolioBadge

local introBodyCopy = Instance.new("TextLabel")
introBodyCopy.Name = "IntroBodyText"
introBodyCopy.Size = UDim2.fromOffset(500, 72)
introBodyCopy.Position = UDim2.fromOffset(8, 194)
introBodyCopy.BackgroundTransparency = 1
introBodyCopy.Text = "Forged with 2300+ hours of love, late-night coffee, and way too many pixels. Come on in and enjoy the ride!"
introBodyCopy.Font = Enum.Font.GothamBold
introBodyCopy.TextSize = 17
introBodyCopy.TextColor3 = COLORS.PureWhite
introBodyCopy.TextWrapped = true
introBodyCopy.TextXAlignment = Enum.TextXAlignment.Left
introBodyCopy.Parent = titleGroup

-- 4. Tilted Neon-Green "LET'S GO" CTA Button (bottom of Hexagon)
local letsGoBtn = Instance.new("TextButton")
letsGoBtn.Name = "LetsGoCTA"
letsGoBtn.AnchorPoint = Vector2.new(0.5, 0.5)
letsGoBtn.Position = UDim2.fromScale(0.50, 0.96)
letsGoBtn.Size = UDim2.fromOffset(230, 66)
letsGoBtn.BackgroundColor3 = COLORS.NeonLime
letsGoBtn.Text = "LET'S GO"
letsGoBtn.Font = Enum.Font.FredokaOne
letsGoBtn.TextSize = 32
letsGoBtn.TextColor3 = COLORS.InkDark
letsGoBtn.Rotation = -4
letsGoBtn.AutoButtonColor = false
letsGoBtn.Parent = hexContainer

local btnCorner = Instance.new("UICorner")
btnCorner.CornerRadius = UDim.new(0.22, 0)
btnCorner.Parent = letsGoBtn

local btnOuterStroke = Instance.new("UIStroke")
btnOuterStroke.Color = COLORS.InkDark
btnOuterStroke.Thickness = 5
btnOuterStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
btnOuterStroke.Parent = letsGoBtn

-- GSAP-style Elastic Hover Animation
letsGoBtn.MouseEnter:Connect(function()
	TweenService:Create(
		letsGoBtn,
		TweenInfo.new(0.35, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out),
		{ Size = UDim2.fromOffset(252, 74), Rotation = -7, BackgroundColor3 = COLORS.BrandHighlight }
	):Play()
end)

letsGoBtn.MouseLeave:Connect(function()
	TweenService:Create(
		letsGoBtn,
		TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out),
		{ Size = UDim2.fromOffset(230, 66), Rotation = -4, BackgroundColor3 = COLORS.NeonLime }
	):Play()
end)

-- 5. Active Gameplay HUD (hidden during Intro, shown after Hexagon expands)
local gameplayHud = Instance.new("Frame")
gameplayHud.Name = "GameplayHUD"
gameplayHud.Size = UDim2.fromScale(1, 1)
gameplayHud.BackgroundTransparency = 1
gameplayHud.Visible = false
gameplayHud.Parent = screenGui

local controlsHint = Instance.new("TextLabel")
controlsHint.AnchorPoint = Vector2.new(0.5, 1)
controlsHint.Position = UDim2.new(0.5, 0, 0.97, 0)
controlsHint.Size = UDim2.fromOffset(680, 32)
controlsHint.BackgroundTransparency = 1
controlsHint.Text = "WASD Drive  ·  Shift Boost  ·  Space / Click Fire Cannon  ·  G Physics Grab"
controlsHint.Font = Enum.Font.GothamBold
controlsHint.TextSize = 15
controlsHint.TextColor3 = COLORS.PureWhite
controlsHint.Parent = gameplayHud

-- Transition Sequence when "LET'S GO" is triggered
local isTransitioning = false
local function startGameplayTransition()
	if isTransitioning then
		return
	end
	isTransitioning = true

	getIntroCompleteEvent():Fire()

	-- Expand Hexagon Mask & Slide Title Out
	TweenService:Create(
		hexContainer,
		TweenInfo.new(0.75, Enum.EasingStyle.Exponential, Enum.EasingDirection.InOut),
		{ Size = UDim2.fromOffset(2600, 2600), Rotation = 0 }
	):Play()

	TweenService:Create(
		titleGroup,
		TweenInfo.new(0.45, Enum.EasingStyle.Back, Enum.EasingDirection.In),
		{ Position = UDim2.new(-0.45, 0, 0.90, 0) }
	):Play()

	TweenService:Create(
		leftBackdrop,
		TweenInfo.new(0.55, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{ BackgroundTransparency = 1 }
	):Play()

	task.delay(0.65, function()
		introStage.Visible = false
		gameplayHud.Visible = true
	end)
end

letsGoBtn.MouseButton1Click:Connect(startGameplayTransition)

UserInputService.InputBegan:Connect(function(input, gp)
	if gp or isTransitioning then
		return
	end
	if input.KeyCode == Enum.KeyCode.Return or input.KeyCode == Enum.KeyCode.Space then
		startGameplayTransition()
	end
end)
`,
  },
];

export const BUDDIES_ASSET_MANIFEST = [
  {
    category: 'Robot & Projectiles',
    files: [
      '/model/robot/buddy-tank.glb (scale: 0.9, parts: Player_Body, Player_Turret, Player_Barrel, Player_Track)',
      '/model/robot/blitz-shell.glb (projectileSpeed: 55 m/s, life: 1.0s)',
      '/model/robot/bot-goliath.glb (bossHealth: 40, roundCuboid bevel: 0.08)',
      '/model/robot/bot-grunt.glb (fodderHealth: 14, density: 10)',
      '/model/robot/buddy-track.json, bot-goliath-track-01.json, bot-grunt-track.json',
    ],
  },
  {
    category: 'Environment & Terrain',
    files: [
      '/model/zone/floor.glb, /model/zone/zone.glb',
      '/assets/terrain/grass-mask.ktx2, soil-mask.ktx2, tile-mask.ktx2, soil.ktx2, tile.ktx2',
      'Environment Models: Tree_1A, Tree_1B, Turbine',
    ],
  },
  {
    category: 'Static Playground Props',
    files: [
      'BTS, Bridge, Chimney, ConcretePipe, PowerCore, Barricade_1A, Contact, Crane, Debris',
      'DumbTruck, GiantPipe_1A, GiantPipe_1B, GiantTank, Hydrant, Lamppost_1A, Lamppost_1B, PipeCluster_1A, Tank_1A, Tank_1B',
    ],
  },
  {
    category: 'Dynamic Physics Props (Rapier)',
    files: [
      'Barrel_1C, Brick, ConcreteFence_1A, ConcreteFence_1B, ExplosiveBarrel, ForkLift, HBeam',
      'MetalBox_1A, MetalBox_1B, Pallete_1A, PipeCluster_1B, RecycleBin, TrafficCone, WheelBarrow, WoddenBox, Bench',
    ],
  },
  {
    category: 'Collectibles & VFX KTX2',
    files: [
      '/model/collectible/circuit.glb, fuel.glb, gear.glb, tools.glb',
      '/assets/vfx/smoke.ktx2, flash.ktx2, ring.ktx2, debris.ktx2, track-mark.ktx2, star-burst.ktx2',
    ],
  },
];
