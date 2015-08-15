////////////////////////////////////////////////////////////////////
// This file contains functionality to place walls on random maps //
////////////////////////////////////////////////////////////////////

// To do:
// Check if all wall placement methods work with wall elements with entity === undefined (some still might raise errors in that case)
// Rename wall elements to fit the entity names so that entity = "structures/" + "civ + "_" + wallElement.type in the common case (as far as possible)
// Perhaps add Roman army camp to style palisades and add upgraded/balanced default palisade fortress types matching civ default fortresses strength
// Perhaps add further wall elements cornerInHalf, cornerOutHalf (banding PI/4) and adjust default fortress types to better fit in the octagonal territory of a civil center
// Perhaps swap angle and width in WallElement class(?) definition
// Adjust argument order to be always the same:
//	Coordinates (center/start/target)
//	Wall element arguments (wall/wallPart/fortressType/cornerElement)
//	playerId (optional, default is 0/gaia)
//	wallStyle (optional, default is the players civ/"palisades for gaia")
//	angle/orientation (optional, default is 0)
//	other (all optional) arguments especially those hard to define (wallPartsAssortment, maybe make an own function for it)
//	Some arguments don't clearly match to this concept:
//		endWithFirst (wall or other)
//		skipFirstWall (wall or other)
//		gateOccurence (wall or other)
//		numCorners (wall or other)
//		skipFirstWall (wall or other)
//		maxAngle (angle or other)
//		maxBendOff (angle or other, unused ATM!!!)
//		irregularity
//		maxTrys
// Add treasures to wall style "others"
// Adjust documentation
// Perhaps rename "endLeft" to "start" and "endRight" to "end"
// ?Use available civ-type wall elements rather than palisades: Remove "endLeft" and "endRight" as default wall elements and adjust default palisade fortress types?
// ?Remove "endRight", "endLeft" and adjust generic fortress types palisades?
// ?Think of something to enable splitting walls into two walls so more complex walls can be build and roads can have branches/crossroads?
// ?Readjust placement angle for wall elements with bending when used in linear/circular walls by their bending?

/**
 * Set some globals for this module
 */
var g_WallStyles = {};
var g_WallStyleList = [];
var g_CivData = getFullCivData();
var g_CivList = Object.keys(g_CivData);
var g_FortressTypes = {};
var g_FortressTypeKeys = ["tiny", "small", "medium", "normal", "large", "veryLarge", "giant"];

/**
 * Basic Initialisation
 * 
 * Fetches wallsets from {civ}.json files, and then uses them to load
 * basic wall elements
 */
for (let civ of g_CivList)
{
	let civInfo = g_CivData[civ];
	if (!civInfo.WallSets)
		continue;

	for (let path of civInfo.WallSets)
	{
		let style = path.split("/")[1].split("_");
		style = (style[0]=="wallset") ? style[1] : style[0]+"_"+style[2];

		if (g_WallStyleList.indexOf(style) == -1)
		{
			g_WallStyleList.push(style);
			g_WallStyles[style] = {};
			let wallset = GetTemplateDataHelper(RMS.GetTemplate(path)).wallSet;
			for (let element in wallset.templates)
				setWallElement(style, element, wallset.templates[element].replace("{civ}",civ))
			g_WallStyles[style]["@overlap"] = wallset.minTowerOverlap * getWallElement(style, "tower").length;
		}
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  Fortress class definition
//
//	A "fortress" here is a closed wall build of multiple wall elements attached together defined in Fortress.wall
//	It's mainly the abstract shape defined in a Fortress instances wall because different styles can be used for it (see wallStyles)
//
//	type                  Descriptive string, example: "tiny". Not really needed (WallTool.wallTypes["type string"] is used). Mainly for custom wall elements
//	wall                  Optional. Array of wall element strings. Can be set afterwards. Default is an empty array.
//		Example: ["entrance", "wall", "cornerIn", "wall", "gate", "wall", "entrance", "wall", "cornerIn", "wall", "gate", "wall", "cornerIn", "wall"]
//	centerToFirstElement  Optional. Object with properties "x" and "y" representing a vector from the visual center to the first wall element. Default is undefined
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function Fortress(type, wall, centerToFirstElement)
{
	this.type = type;
	this.wall = wall || [];
	this.centerToFirstElement = centerToFirstElement || undefined;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  g_FortressTypes data structure for some default fortress types (defined above)
//
//	A fortress type is just an instance of the Fortress class with actually something in it
//	fortressTypes holds all the fortresses within an associative array with a descriptive string as key (e.g. matching the map size)
//	Examples: "tiny", "veryLarge"
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Set some default fortress types
for (let key of g_FortressTypeKeys)
	g_FortressTypes[key] = new Fortress(key);

g_FortressTypes["tiny"].wall = ["gate", "tower", "short", "cornerIn", "short", "tower"];
g_FortressTypes["small"].wall = ["gate", "tower", "medium", "cornerIn", "medium", "tower"];
g_FortressTypes["medium"].wall = ["gate", "tower", "long", "cornerIn", "long", "tower"];
g_FortressTypes["normal"].wall = ["gate", "tower", "medium", "cornerIn", "medium", "cornerOut", "medium", "cornerIn", "medium", "tower"];
g_FortressTypes["large"].wall = ["gate", "tower", "long", "cornerIn", "long", "cornerOut", "long", "cornerIn", "long", "tower"];
g_FortressTypes["veryLarge"].wall = ["gate", "tower", "medium", "cornerIn", "medium", "cornerOut", "long", "cornerIn", "long", "cornerOut", "medium", "cornerIn", "medium", "tower"];
g_FortressTypes["giant"].wall = ["gate", "tower", "long", "cornerIn", "long", "cornerOut", "long", "cornerIn", "long", "cornerOut", "long", "cornerIn", "long", "tower"];

for (let type in g_FortressTypes)
{
	let wallPart = g_FortressTypes[type].wall;
	g_FortressTypes[type].wall = wallPart.concat(wallPart, wallPart, wallPart);
}

// Setup some better looking semi default fortresses for "palisades" style
for (let fortType of g_FortressTypeKeys)
{
	var newKey = fortType + "Palisades";
	var oldWall = g_FortressTypes[fortType].wall;
	g_FortressTypes[newKey] = new Fortress(newKey);
	var fillTowersBetween = ["wallShort", "wall", "wallLong", "endLeft", "endRight", "cornerIn", "cornerOut"];
	for (var j = 0; j < oldWall.length; j++)
	{
		g_FortressTypes[newKey].wall.push(oldWall[j]); // Only works if the first element is not in fillTowersBetween (e.g. entry or gate like it should be)
		if (j+1 < oldWall.length)
			if (fillTowersBetween.indexOf(oldWall[j]) > -1 && fillTowersBetween.indexOf(oldWall[j+1]) > -1) // ... > -1 means "exists" here
				g_FortressTypes[newKey].wall.push("tower");
	}
}

// Setup some balanced (to civ type fortresses) semi default fortresses for "palisades" style
// TODO


///////////////////////////////
// Define some helper functions
///////////////////////////////

/**
 * Get a wall element of a style.
 * 
 * If the element requested is unknown, the function attempts to derive
 * it either from another element, or from a template or whatever.
 * 
 * @param style The style to which this element comes from
 * @param element The element to fetch
 * @return The wall element requested. Or a tower element.
 */
function getWallElement(style="athen_stone", element)
{
	if (g_WallStyleList.indexOf(style) < 0)
	{
		error("getWallElement: Style '"+style+"' not recognised. (Falling back to '" + FALLBACK_CIV + "_stone'.)");
		style = FALLBACK_CIV + "_stone";
	}
	if (g_WallStyles[style][element])
		return g_WallStyles[style][element];

	// Attempt to derive any unknown elements.
	// Defaults to a wall tower piece
	var wallset = g_WallStyles[style];
	var civ = style.split("_")[0];
	var ret = clone(wallset.tower);

	// We use clone() so we don't change the attributes of the object we're referencing
	switch (element)
	{

	case "quarterCurve":
		ret.angle += PI/4;
		ret.bend = PI/2;
		break;

	case "eighthCurve":
		ret.angle += PI/8;
		ret.bend = PI/4;
		break;

	case "cornerIn":
		if (wallset.quarterCurve)
			ret = clone(wallset.quarterCurve);
		else
		{
			ret.angle += PI/4
			ret.indent = ret.length * 0.25;
			ret.length = 0;
		}
		ret.bend = PI/2;
		break;

	case "cornerOut":
		if (wallset.quarterCurve)
		{
			ret = clone(wallset.quarterCurve);
			ret.angle += PI/2;
			ret.indent -= ret.indent*2;
		}
		else
		{
			ret.angle -= PI/4;
			ret.length *= 0.71;
		}
		ret.bend = -PI/2;
		break;

	case "wallShort":
		warn("getWallElement: Deprecated use of 'wallShort' (please use 'short')");
		ret = clone(wallset.short);
		break;

	case "wallMedium":
	case "wall":
		warn("getWallElement: Deprecated use of '"+element+"' (please use 'medium')");
		ret = clone(wallset.medium);
		break;

	case "wallLong":
		warn("getWallElement: Deprecated use of 'wallLong' (please use 'long')");
		ret = clone(wallset.long);
		break;

	case "entry":
		ret.entPath = undefined;
		ret.length = clone(g_WallStyles[style].gate.length);
		break;

	case "entryTower":
		ret.entPath = (g_CivList.indexOf(civ) > -1) ? "structures/"+civ+"_defense_tower" : "other/palisades_rocks_watchtower";
		ret.indent = ret.length * -3;
		ret.length = clone(g_WallStyles[style].gate.length);
		break;

	case "entryFort":
		ret = clone(g_WallStyles[style].fort);
		ret.angle -= PI;
		ret.length *= 1.5;
		ret.indent = ret.length;
		break;

	case "endLeft":
		warn("getWallElement: Deprecated use of 'endLeft' (please use 'start')");
	case "start":
		if (wallset.end)
		{
			ret = clone(wallset.end);
			ret.angle += PI;
		}
		break;

	case "endRight":
		warn("getWallElement: Deprecated use of 'endRight' (please use 'start')");
	case "end":
		if (wallset.end)
			ret = clone(wallset.end);
		break;

	default:
		// See if it's a structure (ie. house, barracks)
		if (g_CivList.indexOf(civ) == -1)
			civ = FALLBACK_CIV;
		var entPath = "structures/"+civ+"_"+element;
		if (RMS.TemplateExists(entPath))
		{
			if (["outpost", "defense_tower"].indexOf(element) > -1)
				ret.indent = ret.length * -3;
			else
				ret.indent = ret.length * 3.5;
			ret.entPath = entPath;
			ret.length = 0;
		}
		else if (element.slice(0.3) === "gap")
		{
			ret.entPath = undefined;
			ret.angle = 0;
			ret.length = +element.slice(4);
		}
		else if (element.slice(0,4) === "turn")
		{
			ret.entPath = undefined;
			ret.angle = PI/2;
			ret.length = 0;
			if (element.slice(5) === "out")
				ret.angle -= ret.angle;
		}
		else
			warn("Unrecognised wall element: "+element+" ("+ style+"). Defaulting to 'tower'.");
	}

	// cache to save having to calculate this element again
	g_WallStyles[style][element] = ret;

	return ret;
}

/**
 * Set a wall element of a style.
 * 
 * @param style The style to which this element belongs
 * @param element The element to add
 * @param path The template path to read values from
 */
function setWallElement(style, element, path)
{
	var template = RMS.GetTemplate(path);
	template = GetTemplateDataHelper(template);

	if (!g_WallStyles[style])
		g_WallStyles[style] = {};

	var length = (template.wallPiece) ? template.wallPiece.length : template.obstruction.shape.width;
	g_WallStyles[style][element] = {
			"entPath": path,
			"angle": (template.wallPiece) ? template.wallPiece.angle : PI,
			"length": length / CELL_SIZE,
			"indent": (template.wallPiece) ? template.wallPiece.indent / CELL_SIZE : 0,
			"bend": (template.wallPiece) ? template.wallPiece.bend : 0
		};
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  getWallAlignment
//
//	Returns a list of objects containing all information to place all the wall elements entities with placeObject (but the player ID)
//	Placing the first wall element at startX/startY placed with an angle given by orientation
//	An alignment can be used to get the "center" of a "wall" (more likely used for fortresses) with getCenterToFirstElement
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getWallAlignment(startX, startY, wall=[], style="athen_stone", orientation=0)
{
	var alignment = [];
	var wallX = startX;
	var wallY = startY;

	for (var i = 0; i < wall.length; i++)
	{
		var element = getWallElement(style, wall[i]);
		if (element === undefined && i == 0)
		{
			warn("Not a valid wall element: style = " + style + ", wall[" +i+ "] = " +wall[i]+ "; .entPath = " +element.entPath+ ", .length = " +element.length+ ", .angle = " +element.angle+ ", .indent = " +element.indent+ ", .bend = " +element.bend);
			continue;
		}

		// Indentation
		var placeX = wallX - element.indent * cos(orientation);
		var placeY = wallY - element.indent * sin(orientation);

		// Add wall elements entity placement arguments to the alignment
		alignment.push({"x": placeX, "y": placeY, "entPath": element.entPath, "angle":orientation + element.angle});

		// Preset vars for the next wall element
		if (i+1 < wall.length)
		{
			orientation += element.bend;
			var nextElement = getWallElement(style, wall[i+1]);
			if (nextElement === undefined)
			{
				warn("Not a valid wall element: style = " + style + ", wall[" +(i+1)+ "] = " +wall[i+1]+ "; .entPath = " +nextElement.entPath+ ", .length = " +nextElement.length+ ", .angle = " +nextElement.angle+ ", .indent = " +nextElement.indent+ ", .bend = " +nextElement.bend);
				continue;
			}
			
			var distance = (element.length + nextElement.length)/2 - getOverlap(style);
			// Corrections for elements with indent AND bending
			var indent = element.indent;
			var bend = element.bend;
			if (bend !== 0 && indent !== 0)
			{
				// Indent correction to adjust distance
				distance += indent*sin(bend);
				// Indent correction to normalize indentation
				wallX += indent * cos(orientation);
				wallY += indent * sin(orientation);
			}
			
			// Set the next coordinates of the next element in the wall without indentation adjustment
			wallX -= distance * sin(orientation);
			wallY += distance * cos(orientation);
		}
	}
	return alignment;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  getCenterToFirstElement
//
//	Center calculation works like getting the center of mass assuming all wall elements have the same "weight"
//
//	It returns the vector from the center to the first wall element
//	Used to get centerToFirstElement of fortresses by default
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getCenterToFirstElement(alignment)
{
	var centerToFirstElement = {"x": 0, "y": 0};
	for (var i = 0; i < alignment.length; i++)
	{
		centerToFirstElement.x -= alignment[i].x/alignment.length;
		centerToFirstElement.y -= alignment[i].y/alignment.length;
	}
	return centerToFirstElement;
}

//////////////////////////////////////////////////////////////////
//  getWallLength
//
//	NOTE: Does not support bending wall elements like corners!
//////////////////////////////////////////////////////////////////
function getWallLength(style, wall=[])
{
	// Graciously handle arguments
	if (g_WallStyleList.indexOf(style) < 0)
	{
		warn("getWallLength: Unknown style: '" + style + "'. (Falling back to '" + FALLBACK_CIV + "_stone').");
		style = FALLBACK_CIV +"_stone";
	}

	var length = 0;
	var overlap = getOverlap(style);
	for (let element of wall)
		length += getWallElement(style, element).length - overlap;

	return length;
}

function getOverlap(style)
{
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	return g_WallStyles[style]["@overlap"];
}


/////////////////////////////////////////////
// Define the different wall placer functions
/////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeWall
//
//	Places a wall with wall elements attached to another like determined by WallElement properties.
//
//	startX, startY  Where the first wall element should be placed
//	wall            Array of wall element types. Example: ["endLeft", "wallLong", "tower", "wallLong", "endRight"]
//	style           Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	playerId        Optional. Number of the player the wall will be placed for. Default is 0 (gaia)
//	orientation     Optional. Angle the first wall element is placed. Default is 0
//	                0 means "outside" or "front" of the wall is right (positive X) like placeObject
//	                It will then be build towards top/positive Y (if no bending wall elements like corners are used)
//	                Raising orientation means the wall is rotated counter-clockwise like placeObject
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeWall(startX, startY, wall=[], style, playerId=0, orientation=0)
{
	if (!startX || !startY)
		return;
	
	if (!style || g_WallStyleList.indexOf(style) == -1)
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	
	// Get wall alignment
	var AM = getWallAlignment(startX, startY, wall, style, orientation);
	
	// Place the wall
	for (var iWall = 0; iWall < wall.length; iWall++)
	{
		var entPath = AM[iWall].entPath;
		if (entPath !== undefined)
			placeObject(AM[iWall].x, AM[iWall].y, entPath, playerId, AM[iWall].angle);
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeCustomFortress
//
//	Place a fortress (mainly a closed wall build like placeWall) centered at centerX/centerY
//	The fortress wall should always start with the main entrance (like "entry" or "gate") to get the orientation right (like placeObject)
//
//	fortress       An instance of Fortress with a wall defined
//	style          Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	playerId       Optional. Number of the player the wall will be placed for. Default is 0 (gaia)
//	orientation    Optional. Angle the first wall element (should be a gate or entrance) is placed. Default is 0
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeCustomFortress(centerX, centerY, fortress, style, playerId=0, orientation=0)
{
	// Graciously handle arguments
	fortress = fortress || g_FortressTypes["medium"];
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	
	// Calculate center if fortress.centerToFirstElement is undefined (default)
	var centerToFirstElement = fortress.centerToFirstElement;
	if (centerToFirstElement === undefined)
		centerToFirstElement = getCenterToFirstElement(getWallAlignment(0, 0, fortress.wall, style));
	// Placing the fortress wall
	var startX = centerX + centerToFirstElement.x * cos(orientation) - centerToFirstElement.y * sin(orientation);
	var startY = centerY + centerToFirstElement.y * cos(orientation) + centerToFirstElement.x * sin(orientation);
	placeWall(startX, startY, fortress.wall, style, playerId, orientation)
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeFortress
//
//	Like placeCustomFortress just it takes type (a fortress type string, has to be in fortressTypes) instead of an instance of Fortress
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeFortress(centerX, centerY, type="medium", style, playerId=0, orientation=0)
{
	// Graciously handle arguments
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	
	// Call placeCustomFortress with the given arguments
	placeCustomFortress(centerX, centerY, g_FortressTypes[type], style, playerId, orientation);
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeLinearWall
//
//	Places a straight wall from a given coordinate to an other repeatedly using the wall parts.
//
//	startX/startY    Coordinate of the approximate beginning of the wall (Not the place of the first wall element)
//	targetX/targetY  Coordinate of the approximate ending of the wall (Not the place of the last wall element)
//	wallPart         Optional. An array of NON-BENDING wall element types. Default is ["tower", "wallLong"]
//	style            Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	playerId         Optional. Integer number of the player. Default is 0 (gaia)
//	endWithFirst     Optional. A boolean value. If true the 1st wall element in the wallPart array will finalize the wall. Default is true
//
//	TODO: Maybe add angle offset for more generic looking?
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeLinearWall(startX, startY, targetX, targetY, wallPart, style, playerId=0, endWithFirst=true)
{
	// Setup optional arguments to the default
	wallPart = wallPart || ["tower", "long"];
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	
	// Check arguments
	for (let element of wallPart)
		if (getWallElement(style, element).bend != 0)
			warn("Bending is not supported by placeLinearWall but the following bending wall element was used: " + element);

	// Setup number of wall parts
	var totalLength = getDistance(startX, startY, targetX, targetY);
	var wallPartLength = getWallLength(style, wallPart);
	var numParts = 0;
	if (endWithFirst == true)
		numParts = ceil((totalLength - getWallElement(style, wallPart[0]).length) / wallPartLength);
	else
		numParts = ceil(totalLength / wallPartLength);

	// Setup scale factor
	var scaleFactor = 1;
	if (endWithFirst == true)
		scaleFactor = totalLength / (numParts * wallPartLength + getWallElement(style, wallPart[0]).length);
	else
		scaleFactor = totalLength / (numParts * wallPartLength);

	// Setup angle
	var wallAngle = getAngle(startX, startY, targetX, targetY); // NOTE: function "getAngle()" is about to be changed...
	var placeAngle = wallAngle - PI/2;
	// Place wall entities
	var x = startX;
	var y = startY;
	for (var partIndex = 0; partIndex < numParts; partIndex++)
	{
		for (var elementIndex = 0; elementIndex < wallPart.length; elementIndex++)
		{
			let wallEle = getWallElement(style, wallPart[elementIndex]);
			let wallLength = (wallEle.length - getOverlap(style)) / 2;
			let distX = scaleFactor * wallLength * cos(wallAngle);
			let distY = scaleFactor * wallLength * sin(wallAngle);
			// Length correction
			x += distX;
			y += distY;
			// Indent correction
			let placeX = x - wallEle.indent * sin(wallAngle);
			let placeY = y + wallEle.indent * cos(wallAngle);
			// Placement
			let entPath = wallEle.entPath;
			if (entPath !== undefined)
				placeObject(placeX, placeY, entPath, playerId, placeAngle + wallEle.angle);
			// Prep for next object
			x += distX;
			y += distY;
		}
	}
	if (endWithFirst == true)
	{
		var wallEle = getWallElement(style, wallPart[0]);
		let wallLength = (wallEle.length - getOverlap(style)) / 2;
		x += scaleFactor * wallLength * cos(wallAngle);
		y += scaleFactor * wallLength * sin(wallAngle);
		var entPath = wallEle.entPath;
		if (entPath !== undefined)
			placeObject(x, y, entPath, playerId, placeAngle + wallEle.angle);
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeCircularWall
//
//	Place a circular wall of repeated wall elements given in the argument wallPart around centerX/centerY with the given radius
//	The wall can be opened forming more an arc than a circle if maxAngle < 2*PI
//	The orientation then determines where this open part faces (0 means right like unrotated building's drop-points)
//
//	centerX/Y     Coordinates of the circle's center
//	radius        How wide the circle should be (approximate, especially if maxBendOff != 0)
//	wallPart      Optional. An array of NON-BENDING wall element types. Default is ["tower", "wallLong"]
//	style         Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	playerId      Optional. Integer number of the player. Default is 0 (gaia)
//	orientation   Optional. Where the open part of the (circular) arc should face (if maxAngle is < 2*PI). Default is 0
//	maxAngle      Optional. How far the wall should circumvent the center. Default is 2*PI (full circle)
//	endWithFirst  Optional. Boolean. If true the 1st wall element in the wallPart array will finalize the wall. Default is false for full circles, else true
//	maxBendOff    Optional. How irregular the circle should be. 0 means regular circle, PI/2 means very irregular. Default is 0 (regular circle)
//
//	NOTE: Don't use wall elements with bending like corners!
//	TODO: Perhaps add eccentricity
//	TODO: Check if maxBendOff parameter works in all cases
//	TODO: Perhaps add functionality for spirals
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeCircularWall(centerX, centerY, radius, wallPart, style, playerId=0, orientation=0, maxAngle=TWO_PI, endWithFirst, maxBendOff=0)
{
	// Setup optional arguments to the default
	wallPart = wallPart || ["tower", "long"];
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	if (endWithFirst === undefined)
	{
		if (maxAngle >= TWO_PI - 0.001) // Can this be done better?
			endWithFirst = false;
		else
			endWithFirst = true;
	}
	
	// Check arguments
	if (maxBendOff > PI/2 || maxBendOff < 0)
		warn("placeCircularWall maxBendOff should satisfy 0 < maxBendOff < PI/2 (~1.5) but it is: " + maxBendOff);
	for (let element of wallPart)
		if (getWallElement(style, element).bend != 0)
			warn("Bending is not supported by placeCircularWall but the following bending wall element was used: " + element);

	// Setup number of wall parts
	var totalLength = maxAngle * radius;
	var wallPartLength = getWallLength(style, wallPart);
	var numParts = 0;
	if (endWithFirst == true)
	{
		numParts = ceil((totalLength - getWallElement(style, wallPart[0]).length) / wallPartLength);
	}
	else
	{
		numParts = ceil(totalLength / wallPartLength);
	}
	// Setup scale factor
	var scaleFactor = 1;
	if (endWithFirst == true)
		scaleFactor = totalLength / (numParts * wallPartLength + getWallElement(style, wallPart[0]).length);
	else
		scaleFactor = totalLength / (numParts * wallPartLength);
	// Place wall entities
	var actualAngle = orientation + (2*PI - maxAngle) / 2;
	var x = centerX + radius*cos(actualAngle);
	var y = centerY + radius*sin(actualAngle);
	for (let partIndex = 0; partIndex < numParts; partIndex++)
	{
		for (let wallEle of wallPart)
		{
			wallEle = getWallElement(style, wallEle);
			// Width correction
			let addAngle = scaleFactor * (wallEle.length - getOverlap(style)) / radius;
			let targetX = centerX + radius * cos(actualAngle + addAngle);
			let targetY = centerY + radius * sin(actualAngle + addAngle);
			let placeX = x + (targetX - x)/2;
			let placeY = y + (targetY - y)/2;
			let placeAngle = actualAngle + addAngle/2;
			// Indent correction
			placeX -= wallEle.indent * cos(placeAngle);
			placeY -= wallEle.indent * sin(placeAngle);
			// Placement
			var entPath = wallEle.entPath;
			if (entPath !== undefined)
				placeObject(placeX, placeY, entPath, playerId, placeAngle + wallEle.angle);
			// Prepare for the next wall element
			actualAngle += addAngle;
			x = centerX + radius*cos(actualAngle);
			y = centerY + radius*sin(actualAngle);
		}
	}
	if (endWithFirst == true)
	{
		var wallEle = getWallElement(style, wallPart[0]);
		var addAngle = scaleFactor * wallEle.length / radius;
		var targetX = centerX + radius * cos(actualAngle + addAngle);
		var targetY = centerY + radius * sin(actualAngle + addAngle);
		var placeX = x + (targetX - x)/2;
		var placeY = y + (targetY - y)/2;
		var placeAngle = actualAngle + addAngle/2;
		placeObject(placeX, placeY, wallEle.entPath, playerId, placeAngle + wallEle.angle);
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placePolygonalWall
//
//	Place a polygonal wall of repeated wall elements given in the argument wallPart around centerX/centerY with the given radius
//
//	centerX/Y          Coordinates of the polygon's center
//	radius             How wide the circle should be in which the polygon fits
//	wallPart           Optional. An array of NON-BENDING wall element types. Default is ["wallLong", "tower"]
//	cornerWallElement  Optional. Wall element to be placed at the polygon's corners. Default is "tower"
//	style              Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	playerId           Optional. Integer number of the player. Default is 0 (gaia)
//	orientation        Optional. Angle from the center to the first linear wall part placed. Default is 0 (towards positive X/right)
//	numCorners         Optional. How many corners the polygon will have. Default is 8 (matching a civ centers territory)
//	skipFirstWall      Optional. Boolean. If the first linear wall part will be left opened as entrance. Default is true
//
//	NOTE: Don't use wall elements with bending like corners!
//	TODO: Replace skipFirstWall with firstWallPart to enable gate/defended entrance placement
//	TODO: Check some arguments
//	TODO: Add eccentricity and perhaps make it just call placeIrregularPolygonalWall with irregularity = 0
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placePolygonalWall(centerX, centerY, radius, wallPart, cornerWallElement, style, playerId=0, orientation=0, numCorners=8, skipFirstWall=true)
{
	// Setup optional arguments to the default
	wallPart = wallPart || ["long", "tower"];
	cornerWallElement = cornerWallElement || "tower"; // Don't use wide elements for this. Not supported well...
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";

	// Setup angles
	var angleAdd = TWO_PI/numCorners;
	var angleStart = orientation - angleAdd/2;

	// Setup corners
	var corners = [];
	for (let i = 0; i < numCorners; i++)
		corners.push([centerX + radius*cos(angleStart + i*angleAdd), centerY + radius*sin(angleStart + i*angleAdd)]);

	// Place Corners and walls
	for (let i = 0; i < numCorners; i++)
	{
		let angleToCorner = getAngle(corners[i][0], corners[i][1], centerX, centerY);
		placeObject(corners[i][0], corners[i][1], getWallElement(style, cornerWallElement).entPath, playerId, angleToCorner);
		if (!(skipFirstWall && i == 0))
		{
			let cornerLength = getWallElement(style, cornerWallElement).length / 2;
			let cornerAngle = angleToCorner + angleAdd / 2;
			let cornerX = cornerLength * sin(cornerAngle);
			let cornerY = cornerLength * cos(cornerAngle);
			placeLinearWall(
				// Adjustment to the corner element width (approximately)
				corners[i][0] + cornerX, // startX
				corners[i][1] - cornerY, // startY
				corners[(i+1)%numCorners][0] - cornerX, // targetX
				corners[(i+1)%numCorners][1] + cornerY, // targetY
				wallPart, style, playerId);
		}
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeIrregularPolygonalWall
//
//	Place an irregular polygonal wall of some wall parts to choose from around centerX/centerY with the given radius
//
//	centerX/Y            Coordinates of the polygon's center
//	radius               How wide the circle should be in which the polygon fits
//	cornerWallElement    Optional. Wall element to be placed at the polygon's corners. Default is "tower"
//	style                Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	playerId             Optional. Integer number of the player. Default is 0 (gaia)
//	orientation          Optional. Angle from the center to the first linear wall part placed. Default is 0 (towards positive X/right)
//	numCorners           Optional. How many corners the polygon will have. Default is randomly chosen from 'tween 5 & 7 inclusive
//	irregularity         Optional. How irregular the polygon will be. 0 means regular, 1 means VERY irregular. Default is 0.5
//	skipFirstWall        Optional. Boolean. If the first linear wall part will be left opened as entrance. Default is false
//	wallPartsAssortment  Optional. An array of wall part arrays to choose from for each linear wall connecting the corners. Default is hard to describe ^^
//
//	NOTE: wallPartsAssortment is put to the end because it's hardest to set
//	NOTE: Don't use wall elements with bending like corners!
//	TODO: Replace skipFirstWall with firstWallPart to enable gate/defended entrance placement
//	TODO: Check some arguments
//	TODO: Perhaps add eccentricity
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeIrregularPolygonalWall(centerX, centerY, radius, cornerWallElement="tower", style, playerId=0, orientation=0, numCorners, irregularity=0.5, skipFirstWall=false, wallPartsAssortment)
{
	// Setup optional arguments
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	numCorners = (numCorners || randInt(5, 7));

	// Generating a generic wall part assortment with each wall part including 1 gate lengthened by walls and towers
	// NOTE: It might be a good idea to write an own function for that...
	var defaultWallPartsAssortment = [["short"], ["medium"], ["long"], ["gate", "tower", "short"]];
	var centeredWallPart = ["gate"];
	var extandingWallPartAssortment = [["tower", "long"], ["tower", "medium"]];
	defaultWallPartsAssortment.push(centeredWallPart);
	for (var i = 0; i < extandingWallPartAssortment.length; i++)
	{
		var wallPart = centeredWallPart;
		for (var j = 0; j < radius; j++)
		{
			if (j%2 == 0)
				wallPart = wallPart.concat(extandingWallPartAssortment[i]);
			else
			{
				extandingWallPartAssortment[i].reverse();
				wallPart = extandingWallPartAssortment[i].concat(wallPart);
				extandingWallPartAssortment[i].reverse();
			}
			defaultWallPartsAssortment.push(wallPart);
		}
	}
	// Setup optional arguments to the default
	wallPartsAssortment = (wallPartsAssortment || defaultWallPartsAssortment);

	// Setup angles
	var angleToCover = TWO_PI;
	var angleAddList = [];
	for (var i = 0; i < numCorners; i++)
	{
		// Randomize covered angles. Variety scales down with raising angle though...
		angleAddList.push(angleToCover/(numCorners-i) * (1 + randFloat(-irregularity, irregularity)));
		angleToCover -= angleAddList[angleAddList.length - 1];
	}
	// Setup corners
	var corners = [];
	var angleActual = orientation - angleAddList[0]/2;
	for (var i = 0; i < numCorners; i++)
	{
		corners.push([centerX + radius*cos(angleActual), centerY + radius*sin(angleActual)]);
		if (i < numCorners - 1)
			angleActual += angleAddList[i+1];
	}
	// Setup best wall parts for the different walls (a bit confusing naming...)
	var wallPartLengths = [];
	var maxWallPartLength = 0;
	for (let wallPart of wallPartsAssortment)
	{
		var length = getWallLength(style, wallPart);
		wallPartLengths.push(length);
		if (length > maxWallPartLength)
			maxWallPartLength = length;
	}
	
	var wallPartList = []; // This is the list of the wall parts to use for the walls between the corners, not to confuse with wallPartsAssortment!
	for (var i = 0; i < numCorners; i++)
	{
		var bestWallPart = []; // This is a simple wall part not a wallPartsAssortment!
		var bestWallLength = Number.MAX_VALUE;
		// NOTE: This is not exactly like the length the wall will be in the end. Has to be tweaked...
		var wallLength = getDistance(corners[i][0], corners[i][1], corners[(i+1)%numCorners][0], corners[(i+1)%numCorners][1]);
		var numWallParts = ceil(wallLength/maxWallPartLength);
		for (var partIndex = 0; partIndex < wallPartsAssortment.length; partIndex++)
		{
			var linearWallLength = numWallParts*wallPartLengths[partIndex];
			if (linearWallLength < bestWallLength && linearWallLength > wallLength)
			{
				bestWallPart = wallPartsAssortment[partIndex];
				bestWallLength = linearWallLength;
			}
		}
		wallPartList.push(bestWallPart);
	}

	// Place Corners and walls
	for (var i = 0; i < numCorners; i++)
	{
		var angleToCorner = getAngle(corners[i][0], corners[i][1], centerX, centerY);
		placeObject(corners[i][0], corners[i][1], getWallElement(style, cornerWallElement).entPath, playerId, angleToCorner);
		if (!(skipFirstWall && i == 0))
		{
			let cornerLength = getWallElement(style, cornerWallElement).length / 2;
			placeLinearWall(
				// Adjustment to the corner element width (approximately)
				corners[i][0] + cornerLength * sin(angleToCorner + angleAddList[i]/2), // startX
				corners[i][1] - cornerLength * cos(angleToCorner + angleAddList[i]/2), // startY
				corners[(i+1)%numCorners][0] - cornerLength * sin(angleToCorner + angleAddList[(i+1)%numCorners]/2), // targetX
				corners[(i+1)%numCorners][1] + cornerLength * cos(angleToCorner + angleAddList[(i+1)%numCorners]/2), // targetY
				wallPartList[i], style, playerId, false);
		}
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  placeGenericFortress
//
//	Places a generic fortress with towers at the edges connected with long walls and gates (entries until gates work)
//	This is the default Iberian civ bonus starting wall
//
//	centerX/Y      The approximate center coordinates of the fortress
//	radius         Optional. The approximate radius of the wall to be placed. Default is 20
//	playerId       Optional. Integer number of the player. Default is 0 (gaia)
//	style          Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	irregularity   Optional. Float between 0 (circle) and 1 (very spiky), default is 0.5
//	gateOccurence  Optional. Integer number, every n-th walls will be a gate instead. Default is 3
//	maxTrys        Optional. How often the function tries to find a better fitting shape at max. Default is 100
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeGenericFortress(centerX, centerY, radius=20, playerId=0, style, irregularity=0.5, gateOccurence=3, maxTrys=100)
{
	// Setup optional arguments
	if (!style || !g_WallStyles[style])
		style = (playerId == 0) ? "palisade" : getCivCode(playerId-1)+"_stone";
	
	// Setup some vars
	var startAngle = randFloat(0, 2*PI);
	var actualOffX = radius*cos(startAngle);
	var actualOffY = radius*sin(startAngle);
	var actualAngle = startAngle;
	var pointDistance = getWallLength(style, ["long", "tower"]);
	// Searching for a well fitting point derivation
	var tries = 0;
	var bestPointDerivation = undefined;
	var minOverlap = 1000;
	var overlap = undefined;
	while (tries < maxTrys && minOverlap > getOverlap(style))
	{
		var pointDerivation = [];
		var distanceToTarget = 1000;
		var targetReached = false;
		while (!targetReached)
		{
			var indent = randFloat(-irregularity*pointDistance, irregularity*pointDistance);
			var tmpAngle = getAngle(actualOffX, actualOffY,
				(radius + indent)*cos(actualAngle + pointDistance / radius),
				(radius + indent)*sin(actualAngle + pointDistance / radius));
			actualOffX += pointDistance*cos(tmpAngle);
			actualOffY += pointDistance*sin(tmpAngle);
			actualAngle = getAngle(0, 0, actualOffX, actualOffY);
			pointDerivation.push([actualOffX, actualOffY]);
			distanceToTarget = getDistance(actualOffX, actualOffY, pointDerivation[0][0], pointDerivation[0][1]);
			var numPoints = pointDerivation.length;
			if (numPoints > 3 && distanceToTarget < pointDistance) // Could be done better...
			{
				targetReached = true;
				overlap = pointDistance - getDistance(pointDerivation[numPoints - 1][0], pointDerivation[numPoints - 1][1], pointDerivation[0][0], pointDerivation[0][1]);
				if (overlap < minOverlap)
				{
					minOverlap = overlap;
					bestPointDerivation = pointDerivation;
				}
			}
		}
		tries++;
	}
	log("placeGenericFortress: Reduced overlap to " + minOverlap + " after " + tries + " tries");
	// Place wall
	for (var pointIndex = 0; pointIndex < bestPointDerivation.length; pointIndex++)
	{
		var startX = centerX + bestPointDerivation[pointIndex][0];
		var startY = centerY + bestPointDerivation[pointIndex][1];
		var targetX = centerX + bestPointDerivation[(pointIndex + 1) % bestPointDerivation.length][0];
		var targetY = centerY + bestPointDerivation[(pointIndex + 1) % bestPointDerivation.length][1];
		var angle = getAngle(startX, startY, targetX, targetY);
		var wallElement = "long";
		if ((pointIndex + 1) % gateOccurence == 0)
			wallElement = "gate";

		var entPath = getWallElement(style, wallElement).entPath;
		if (entPath)
		{
			placeObject(startX + (getDistance(startX, startY, targetX, targetY)/2)*cos(angle), // placeX
				startY + (getDistance(startX, startY, targetX, targetY)/2)*sin(angle), // placeY
				entPath, playerId, angle - PI/2 + getWallElement(style, wallElement).angle);
		}
		// Place tower
		var startX = centerX + bestPointDerivation[(pointIndex + bestPointDerivation.length - 1) % bestPointDerivation.length][0];
		var startY = centerY + bestPointDerivation[(pointIndex + bestPointDerivation.length - 1) % bestPointDerivation.length][1];
		var angle = getAngle(startX, startY, targetX, targetY);

		var tower = getWallElement(style, "tower");
		placeObject(centerX + bestPointDerivation[pointIndex][0], centerY + bestPointDerivation[pointIndex][1], tower.entPath, playerId, angle - PI/2 + tower.angle);
	}
}
