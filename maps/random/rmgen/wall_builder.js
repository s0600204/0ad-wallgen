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


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  WallElement class definition
//
//	Concept: If placed unrotated the wall's build direction is towards positive Y (top) with "outside" right (+X) and "inside" left (-X) like unrotated entities has their drop-points right (in rmgen)
//	The build direction of the wall will be changed by corners (bending != 0) and so the "inside"/"outside" direction
//
//	type	Identification string.
//	entPath	Optional. Template entity path string of the entity to be placed, example: "structures/cart_wall_long". Default is undefined (No entity placed)
//	angle	Optional. Relative angle to the build direction. Default is 0
//	width	Optional. How far this wall element lengthens the wall (float), if unrotated the Y space needed. Default is 0
//	indent	Optional. The lateral indentation of the entity, drawn "inside" (positive values) or pushed "outside" (negative values). Default is 0
//	bending	Optional. How the build direction of the wall is changed after this element, positive is bending "in"/left/counter clockwise (like entity placement)
//		NOTE: Bending is not supported by all placement functions (see there)
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function WallElement(type, entPath, angle, width, indent, bending)
{
	this.type = type;
	this.entPath = entPath;
	this.angle = (angle !== undefined) ? angle : 0;
	this.width = (width !== undefined) ? width : 0;
	this.indent = (indent !== undefined) ? indent : 0;
	this.bending = (bending !== undefined) ? bending : 0;
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
	this.wall = (wall !== undefined) ? wall : [];
	this.centerToFirstElement = undefined;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  wallStyles data structure for default wall styles
//
//	A wall style is an associative array with all wall elements of that style in it associated with the wall element type string
//	wallStyles holds all the wall styles within an associative array with the civ string or another descriptive strings as key
//	Examples: "athen", "rome_siege", "palisades", "fence", "road"
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var wallStyles = {};

// Get wall element width by template file path and angle
function getTemplateWidthByAngle(entPath, angle)
{
	var template = RMS.GetTemplate(entPath);
	var width = getTemplateValue(entPath, ["WallPiece", "Length"]) / CELL_SIZE;
	
	return width;
}

// Add new WallElement by it's properties
function addNewWallElement(style, type, angle)
{
	var templatePath = "structures/" + style + "_" + type
	wallStyles[style][type] = new WallElement(type, templatePath, angle, getTemplateWidthByAngle(templatePath, angle));
}

// Find all wall sets by civ to be then put into wallStyles
var entitiesByCiv = {};
var civList = getCivList();
for (var i = 0; i < civList.length; i++)
{
	var civ = civList[i];
	var templatePathList = getTempatePathList(civ);
	entitiesByCiv[civ] = templatePathList;
}

// Generic civ dependent wall style definition. Some, e.g. "rome_siege" needs tweaking...
var wallScaleByType = {}; // To be removed TODO
var civData = getFullCivData();
for (var i = 0; i < civList.length; i++)
{
	var civ = civList[i];
	var wallSets = civData[civ].WallSets;
	if (wallSets.hasOwnProperty("Stone"))
		wallScaleByType[civ] = wallSets.Stone.Scale;
}
// Non-civ but civ specific wall styles
wallScaleByType.rome_siege = 1.5;
for (var style in wallScaleByType)
{
	var civ = style;
	if (style == "rome_siege")
		civ = "rome";
	wallStyles[style] = {};
	// Default wall elements
	var templatePath = "structures/" + style + "_wall_tower";
	var angle = PI;
	var width = getTemplateWidthByAngle(templatePath, angle); // DEBUG
	log("getTemplateWidthByAngle(" + templatePath + ") =  " + width + ", used to be width = " + wallScaleByType[style]); // DEBUG
	// wallStyles[style]["tower"] = new WallElement("tower", templatePath, angle, width);//wallScaleByType[style]);
	addNewWallElement(style, "wall_tower", PI);
	wallStyles[style]["tower"] = wallStyles[style]["wall_tower"]; // Shortcut
	
	wallStyles[style]["endLeft"] = new WallElement("endLeft", "structures/" + style + "_wall_tower", PI, wallScaleByType[style]); // Same as tower. To be compatible with palisades...
	wallStyles[style]["endRight"] = new WallElement("endRight", "structures/" + style + "_wall_tower", PI, wallScaleByType[style]); // Same as tower. To be compatible with palisades...
	wallStyles[style]["cornerIn"] = new WallElement("cornerIn", "structures/" + style + "_wall_tower", 5*PI/4, 0, 0.35*wallScaleByType[style], PI/2); // 2^0.5 / 4 ~= 0.35 ~= 1/3
	wallStyles[style]["cornerOut"] = new WallElement("cornerOut", "structures/" + style + "_wall_tower", 3*PI/4, 0.71*wallScaleByType[style], 0, -PI/2); // // 2^0.5 / 2 ~= 0.71 ~= 2/3
	
	var templatePath = "structures/" + style + "_wall_short"; // DEBUG
	var angle = 0*PI; // DEBUG
	var width = getTemplateWidthByAngle(templatePath, angle); // DEBUG
	log("getTemplateWidthByAngle(" + templatePath + ") =  " + width + ", used to be width = " + 2*wallScaleByType[style]); // DEBUG
	wallStyles[style]["wallShort"] = new WallElement("wallShort", "structures/" + style + "_wall_short", 0*PI, 2*wallScaleByType[style]);
	
	var templatePath = "structures/" + style + "_wall_medium"; // DEBUG
	var angle = 0*PI; // DEBUG
	var width = getTemplateWidthByAngle(templatePath, angle); // DEBUG
	log("getTemplateWidthByAngle(" + templatePath + ") =  " + width + ", used to be width = " + 4*wallScaleByType[style]); // DEBUG
	wallStyles[style]["wall"] = new WallElement("wall", "structures/" + style + "_wall_medium", 0*PI, 4*wallScaleByType[style]);
	
	wallStyles[style]["wallMedium"] = new WallElement("wall", "structures/" + style + "_wall_medium", 0*PI, 4*wallScaleByType[style]);
	
	var templatePath = "structures/" + style + "_wall_long"; // DEBUG
	var angle = 0*PI; // DEBUG
	var width = getTemplateWidthByAngle(templatePath, angle); // DEBUG
	log("getTemplateWidthByAngle(" + templatePath + ") =  " + width + ", used to be width = " + 6*wallScaleByType[style]); // DEBUG
	wallStyles[style]["wallLong"] = new WallElement("wallLong", "structures/" + style + "_wall_long", 0*PI, 6*wallScaleByType[style]);
	
	// Gate and entrance wall elements
	var gateWidth = 6*wallScaleByType[style];
	
	var templatePath = "structures/" + style + "_wall_gate"; // DEBUG
	var angle = PI; // DEBUG
	var width = getTemplateWidthByAngle(templatePath, angle); // DEBUG
	log("getTemplateWidthByAngle(" + templatePath + ") =  " + width + ", used to be width = " + 6*wallScaleByType[style]); // DEBUG
	wallStyles[style]["gate"] = new WallElement("gate", "structures/" + style + "_wall_gate", PI, gateWidth);
	
	wallStyles[style]["entry"] = new WallElement("entry", undefined, 0*PI, gateWidth);
	wallStyles[style]["entryTower"] = new WallElement("entryTower", "structures/" + civ + "_defense_tower", PI, gateWidth, -4*wallScaleByType[style]);
	wallStyles[style]["entryFort"] = new WallElement("entryFort", "structures/" + civ + "_fortress", 0*PI, 8*wallScaleByType[style], 6*wallScaleByType[style]);
	// Defensive wall elements with 0 width outside the wall
	wallStyles[style]["outpost"] = new WallElement("outpost", "structures/" + civ + "_outpost", PI, 0, -4*wallScaleByType[style]);
	wallStyles[style]["defenseTower"] = new WallElement("defenseTower", "structures/" + civ + "_defense_tower", PI, 0, -4*wallScaleByType[style]);
	// Base buildings wall elements with 0 width inside the wall
	wallStyles[style]["barracks"] = new WallElement("barracks", "structures/" + civ + "_barracks", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["civilCentre"] = new WallElement("civilCentre", "structures/" + civ + "_civil_centre", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["farmstead"] = new WallElement("farmstead", "structures/" + civ + "_farmstead", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["field"] = new WallElement("field", "structures/" + civ + "_field", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["fortress"] = new WallElement("fortress", "structures/" + civ + "_fortress", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["house"] = new WallElement("house", "structures/" + civ + "_house", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["market"] = new WallElement("market", "structures/" + civ + "_market", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["storehouse"] = new WallElement("storehouse", "structures/" + civ + "_storehouse", PI, 0, 4.5*wallScaleByType[style]);
	wallStyles[style]["temple"] = new WallElement("temple", "structures/" + civ + "_temple", PI, 0, 4.5*wallScaleByType[style]);
	// Generic space/gap wall elements
	wallStyles[style]["space1"] = new WallElement("space1", undefined, 0*PI, wallScaleByType[style]);
	wallStyles[style]["space2"] = new WallElement("space2", undefined, 0*PI, 2*wallScaleByType[style]);
	wallStyles[style]["space3"] = new WallElement("space3", undefined, 0*PI, 3*wallScaleByType[style]);
	wallStyles[style]["space4"] = new WallElement("space4", undefined, 0*PI, 4*wallScaleByType[style]);
}
// Adjust "rome_siege" style
wallStyles["rome_siege"]["house"] = new WallElement("house", "structures/rome_tent", PI, 0, 4);

// Add special wall styles not well to implement generic (and to show how custom styles can be added)

// Add wall style "palisades"
wallScaleByType["palisades"] = 0.55;
wallStyles["palisades"] = {};
wallStyles["palisades"]["wall"] = new WallElement("wall", "other/palisades_rocks_medium", 0*PI, 2.3);
wallStyles["palisades"]["wallMedium"] = new WallElement("wall", "other/palisades_rocks_medium", 0*PI, 2.3);
wallStyles["palisades"]["wallLong"] = new WallElement("wall", "other/palisades_rocks_long", 0*PI, 3.5);
wallStyles["palisades"]["wallShort"] = new WallElement("wall", "other/palisades_rocks_short", 0*PI, 1.2);
wallStyles["palisades"]["tower"] = new WallElement("tower", "other/palisades_rocks_tower", -PI/2, 0.7);
// wallStyles["palisades"]["wallFort"] = new WallElement("wallFort", "other/palisades_rocks_fort", PI, 1.7);
wallStyles["palisades"]["gate"] = new WallElement("gate", "other/palisades_rocks_gate", PI, 3.6);
wallStyles["palisades"]["entry"] = new WallElement("entry", undefined, wallStyles["palisades"]["gate"].angle, wallStyles["palisades"]["gate"].width);
wallStyles["palisades"]["entryTower"] = new WallElement("entryTower", "other/palisades_rocks_watchtower", 0*PI, wallStyles["palisades"]["gate"].width, -3);
wallStyles["palisades"]["entryFort"] = new WallElement("entryFort", "other/palisades_rocks_fort", PI, 6, 3);
wallStyles["palisades"]["cornerIn"] = new WallElement("cornerIn", "other/palisades_rocks_curve", 3*PI/4, 2.1, 0.7, PI/2);
wallStyles["palisades"]["cornerOut"] = new WallElement("cornerOut", "other/palisades_rocks_curve", 5*PI/4, 2.1, -0.7, -PI/2);
wallStyles["palisades"]["outpost"] = new WallElement("outpost", "other/palisades_rocks_outpost", PI, 0, -2);
wallStyles["palisades"]["house"] = new WallElement("house", "other/celt_hut", PI, 0, 5);
wallStyles["palisades"]["barracks"] = new WallElement("barracks", "structures/gaul_tavern", PI, 0, 5);
wallStyles["palisades"]["endRight"] = new WallElement("endRight", "other/palisades_rocks_end", -PI/2, 0.2);
wallStyles["palisades"]["endLeft"] = new WallElement("endLeft", "other/palisades_rocks_end", PI/2, 0.2);

// Add special wall style "road"
// NOTE: This is not a wall style in the common sense. Use with care!
wallStyles["road"] = {};
wallStyles["road"]["short"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_short.xml", PI/2, 4.5);
wallStyles["road"]["long"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_long.xml", PI/2, 9.5);
wallStyles["road"]["cornerLeft"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_corner.xml", -PI/2, 4.5-2*1.25, 1.25, PI/2); // Correct width by -2*indent to fit xStraicht/corner
wallStyles["road"]["cornerRight"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_corner.xml", 0*PI, 4.5-2*1.25, -1.25, -PI/2); // Correct width by -2*indent to fit xStraicht/corner
wallStyles["road"]["curveLeft"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_curve_small.xml", -PI/2, 4.5+2*0.2, -0.2, PI/2); // Correct width by -2*indent to fit xStraicht/corner
wallStyles["road"]["curveRight"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_curve_small.xml", 0*PI, 4.5+2*0.2, 0.2, -PI/2); // Correct width by -2*indent to fit xStraicht/corner
wallStyles["road"]["start"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_end.xml", PI/2, 2);
wallStyles["road"]["end"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_end.xml", -PI/2, 2);
wallStyles["road"]["xStraight"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_intersect_x.xml", 0*PI, 4.5);
wallStyles["road"]["xLeft"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_intersect_x.xml", 0*PI, 4.5, 0, PI/2);
wallStyles["road"]["xRight"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_intersect_x.xml", 0*PI, 4.5, 0, -PI/2);
wallStyles["road"]["tLeft"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_intersect_T.xml", PI, 4.5, 1.25);
wallStyles["road"]["tRight"] = new WallElement("road", "actor|props/special/eyecandy/road_temperate_intersect_T.xml", 0*PI, 4.5, -1.25);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  fortressTypes data structure for some default fortress types
//
//	A fortress type is just an instance of the Fortress class with actually something in it
//	fortressTypes holds all the fortresses within an associative array with a descriptive string as key (e.g. matching the map size)
//	Examples: "tiny", "veryLarge"
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var fortressTypes = {};
// Setup some default fortress types
// Add fortress type "tiny"
fortressTypes["tiny"] = new Fortress("tiny");
var wallPart = ["gate", "tower", "wallShort", "cornerIn", "wallShort", "tower"];
fortressTypes["tiny"].wall = wallPart.concat(wallPart, wallPart, wallPart);
// Add fortress type "small"
fortressTypes["small"] = new Fortress("small");
var wallPart = ["gate", "tower", "wall", "cornerIn", "wall", "tower"];
fortressTypes["small"].wall = wallPart.concat(wallPart, wallPart, wallPart);
// Add fortress type "medium"
fortressTypes["medium"] = new Fortress("medium");
var wallPart = ["gate", "tower", "wallLong", "cornerIn", "wallLong", "tower"];
fortressTypes["medium"].wall = wallPart.concat(wallPart, wallPart, wallPart);
// Add fortress type "normal"
fortressTypes["normal"] = new Fortress("normal");
var wallPart = ["gate", "tower", "wall", "cornerIn", "wall", "cornerOut", "wall", "cornerIn", "wall", "tower"];
fortressTypes["normal"].wall = wallPart.concat(wallPart, wallPart, wallPart);
// Add fortress type "large"
fortressTypes["large"] = new Fortress("large");
var wallPart = ["gate", "tower", "wallLong", "cornerIn", "wallLong", "cornerOut", "wallLong", "cornerIn", "wallLong", "tower"];
fortressTypes["large"].wall = wallPart.concat(wallPart, wallPart, wallPart);
// Add fortress type "veryLarge"
fortressTypes["veryLarge"] = new Fortress("veryLarge");
var wallPart = ["gate", "tower", "wall", "cornerIn", "wall", "cornerOut", "wallLong", "cornerIn", "wallLong", "cornerOut", "wall", "cornerIn", "wall", "tower"];
fortressTypes["veryLarge"].wall = wallPart.concat(wallPart, wallPart, wallPart);
// Add fortress type "giant"
fortressTypes["giant"] = new Fortress("giant");
var wallPart = ["gate", "tower", "wallLong", "cornerIn", "wallLong", "cornerOut", "wallLong", "cornerIn", "wallLong", "cornerOut", "wallLong", "cornerIn", "wallLong", "tower"];
fortressTypes["giant"].wall = wallPart.concat(wallPart, wallPart, wallPart);

// Setup some better looking semi default fortresses for "palisades" style
var fortressTypeKeys = ["tiny", "small", "medium", "normal", "large", "veryLarge", "giant"];
for (var i = 0; i < fortressTypeKeys.length; i++)
{
	var newKey = fortressTypeKeys[i] + "Palisades";
	var oldWall = fortressTypes[fortressTypeKeys[i]].wall;
	fortressTypes[newKey] = new Fortress(newKey);
	var fillTowersBetween = ["wallShort", "wall", "wallLong", "endLeft", "endRight", "cornerIn", "cornerOut"];
	for (var j = 0; j < oldWall.length; j++)
	{
		fortressTypes[newKey].wall.push(oldWall[j]); // Only works if the first element is not in fillTowersBetween (e.g. entry or gate like it should be)
		if (j+1 < oldWall.length)
			if (fillTowersBetween.indexOf(oldWall[j]) > -1 && fillTowersBetween.indexOf(oldWall[j+1]) > -1) // ... > -1 means "exists" here
				fortressTypes[newKey].wall.push("tower");
	}
}

// Setup some balanced (to civ type fortresses) semi default fortresses for "palisades" style
// TODO

// Add some "fortress types" for roads (will only work with style "road")
// ["start", "short", "xRight", "xLeft", "cornerLeft", "xStraight", "long", "xLeft", "xRight", "cornerRight", "tRight", "tLeft", "xRight", "xLeft", "curveLeft", "xStraight", "curveRight", "end"];
var wall = ["short", "curveLeft", "short", "curveLeft", "short", "curveLeft", "short", "curveLeft"];
fortressTypes["road01"] = new Fortress("road01", wall);
var wall = ["short", "cornerLeft", "short", "cornerLeft", "short", "cornerLeft", "short", "cornerLeft"];
fortressTypes["road02"] = new Fortress("road02", wall);
var wall = ["xStraight", "curveLeft", "xStraight", "curveLeft", "xStraight", "curveLeft", "xStraight", "curveLeft"];
fortressTypes["road03"] = new Fortress("road03", wall);
var wall = ["start", "curveLeft", "tRight", "cornerLeft", "tRight", "curveRight", "short", "xRight", "curveLeft", "xRight", "short", "cornerLeft", "tRight", "short",
	"curveLeft", "short", "tRight", "cornerLeft", "short", "xRight", "curveLeft", "xRight", "short", "curveRight", "tRight", "cornerLeft", "tRight", "curveLeft", "end"];
fortressTypes["road04"] = new Fortress("road04", wall);
var wall = ["start", "tLeft", "short", "xRight",
	"curveLeft", "xRight", "tRight", "cornerLeft", "tRight",
	"curveLeft", "short", "tRight", "cornerLeft", "xRight",
	"cornerLeft", "xRight", "short", "tRight", "curveLeft", "end"];
fortressTypes["road05"] = new Fortress("road05", wall);


///////////////////////////////
// Define some helper functions
///////////////////////////////

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//  getWallAlignment
//
//	Returns a list of objects containing all information to place all the wall elements entities with placeObject (but the player ID)
//	Placing the first wall element at startX/startY placed with an angle given by orientation
//	An alignment can be used to get the "center" of a "wall" (more likely used for fortresses) with getCenterToFirstElement
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getWallAlignment(startX, startY, wall, style, orientation)
{
	// Graciously handle arguments
	if (wall === undefined)
		wall = [];
	if (!wallStyles.hasOwnProperty(style))
	{
		warn("Function getWallAlignment: Unknown style: " + style + ' (falling back to "athen")');
		style = "athen";
	}
	orientation = (orientation || 0);
	
	var alignment = [];
	var wallX = startX;
	var wallY = startY;
	for (var i = 0; i < wall.length; i++)
	{
		var element = wallStyles[style][wall[i]];
		if (element === undefined && i == 0)
			warn("No valid wall element: style = " + style + ", wall[" + i + "] = " + wall[i] + ", wallStyles[" + style + "][wall[" + i + "]] = " + wallStyles[style][wall[i]] + ", element = " + element + ", wall = " + wall);
		// Indentation
		var placeX = wallX - element.indent * cos(orientation);
		var placeY = wallY - element.indent * sin(orientation);
		// Add wall elements entity placement arguments to the alignment
		alignment.push({"x": placeX, "y": placeY, "entPath": element.entPath, "angle":orientation + element.angle});
		// Preset vars for the next wall element
		if (i+1 < wall.length)
		{
			orientation += element.bending;
			var nextElement = wallStyles[style][wall[i+1]];
			if (nextElement === undefined)
				warn("No valid wall element: style = " + style + ", wall[" + (i+1) + "] = " + wall[i+1] + ", wallStyles[" + style + "][wall[" + (i+1) + "]] = " + wallStyles[style][wall[i+1]] + ", nextElement = " + uneval(nextElement) + ", wall = " + wall);
			var distance = (element.width + nextElement.width)/2;
			// Corrections for elements with indent AND bending
			var indent = element.indent;
			var bending = element.bending;
			if (bending !== 0 && indent !== 0)
			{
				// Indent correction to adjust distance
				distance += indent*sin(bending);
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
//	e.g. used by placeIrregularPolygonalWall
//////////////////////////////////////////////////////////////////
function getWallLength(wall, style)
{
	// Graciously handle arguments
	if (wall === undefined)
		wall = [];
	if (!wallStyles.hasOwnProperty(style))
	{
		warn("Function getWallLength: Unknown style: " + style + ' (falling back to "athen")');
		style = "athen";
	}
	
	var length = 0;
	for (var i = 0; i < wall.length; i++)
	{
		length += wallStyles[style][wall[i]].width;
	}
	return length;
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
function placeWall(startX, startY, wall, style, playerId, orientation)
{
	// Graciously handle arguments
	if (wall === undefined)
		wall = [];
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	orientation = (orientation || 0);
	
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
function placeCustomFortress(centerX, centerY, fortress, style, playerId, orientation)
{
	// Graciously handle arguments
	fortress = (fortress || fortressTypes["medium"]);
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	orientation = (orientation || 0);
	
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
function placeFortress(centerX, centerY, type, style, playerId, orientation)
{
	// Graciously handle arguments
	type = (type || "medium");
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	orientation = (orientation || 0);
	
	// Call placeCustomFortress with the given arguments
	placeCustomFortress(centerX, centerY, fortressTypes[type], style, playerId, orientation);
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
function placeLinearWall(startX, startY, targetX, targetY, wallPart, style, playerId, endWithFirst)
{
	// Setup optional arguments to the default
	wallPart = (wallPart || ["tower", "wallLong"]);
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	endWithFirst = typeof endWithFirst == "undefined" ? true : endWithFirst;
	
	// Check arguments
	for (var elementIndex = 0; elementIndex < wallPart.length; elementIndex++)
	{
		var bending = wallStyles[style][wallPart[elementIndex]].bending;
		if (bending != 0)
			warn("Bending is not supported by placeLinearWall but a bending wall element is used: " + wallPart[elementIndex] + " -> wallStyles[style][wallPart[elementIndex]].entPath");
	}
	// Setup number of wall parts
	var totalLength = getDistance(startX, startY, targetX, targetY);
	var wallPartLength = 0;
	for (var elementIndex = 0; elementIndex < wallPart.length; elementIndex++)
		wallPartLength += wallStyles[style][wallPart[elementIndex]].width;
	var numParts = 0;
	if (endWithFirst == true)
		numParts = ceil((totalLength - wallStyles[style][wallPart[0]].width) / wallPartLength);
	else
		numParts = ceil(totalLength / wallPartLength);
	// Setup scale factor
	var scaleFactor = 1;
	if (endWithFirst == true)
		scaleFactor = totalLength / (numParts * wallPartLength + wallStyles[style][wallPart[0]].width);
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
			var wallEle = wallStyles[style][wallPart[elementIndex]];
			// Width correction
			x += scaleFactor * wallEle.width/2 * cos(wallAngle);
			y += scaleFactor * wallEle.width/2 * sin(wallAngle);
			// Indent correction
			var placeX = x - wallEle.indent * sin(wallAngle);
			var placeY = y + wallEle.indent * cos(wallAngle);
			// Placement
			var entPath = wallEle.entPath;
			if (entPath !== undefined)
				placeObject(placeX, placeY, entPath, playerId, placeAngle + wallEle.angle);
			x += scaleFactor * wallEle.width/2 * cos(wallAngle);
			y += scaleFactor * wallEle.width/2 * sin(wallAngle);
		}
	}
	if (endWithFirst == true)
	{
		var wallEle = wallStyles[style][wallPart[0]];
		x += scaleFactor * wallEle.width/2 * cos(wallAngle);
		y += scaleFactor * wallEle.width/2 * sin(wallAngle);
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
function placeCircularWall(centerX, centerY, radius, wallPart, style, playerId, orientation, maxAngle, endWithFirst, maxBendOff)
{
	// Setup optional arguments to the default
	wallPart = (wallPart || ["tower", "wallLong"]);
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	orientation = (orientation || 0);
	maxAngle = (maxAngle || 2*PI);
	if (endWithFirst === undefined)
	{
		if (maxAngle >= 2*PI - 0.001) // Can this be done better?
			endWithFirst = false;
		else
			endWithFirst = true;
	}
	maxBendOff = (maxBendOff || 0);
	
	// Check arguments
	if (maxBendOff > PI/2 || maxBendOff < 0)
		warn("placeCircularWall maxBendOff should satisfy 0 < maxBendOff < PI/2 (~1.5) but it is: " + maxBendOff);
	for (var elementIndex = 0; elementIndex < wallPart.length; elementIndex++)
	{
		var bending = wallStyles[style][wallPart[elementIndex]].bending;
		if (bending != 0)
			warn("Bending is not supported by placeCircularWall but a bending wall element is used: " + wallPart[elementIndex]);
	}
	// Setup number of wall parts
	var totalLength = maxAngle * radius;
	var wallPartLength = 0;
	for (var elementIndex = 0; elementIndex < wallPart.length; elementIndex++)
		wallPartLength += wallStyles[style][wallPart[elementIndex]].width;
	var numParts = 0;
	if (endWithFirst == true)
	{
		numParts = ceil((totalLength - wallStyles[style][wallPart[0]].width) / wallPartLength);
	}
	else
	{
		numParts = ceil(totalLength / wallPartLength);
	}
	// Setup scale factor
	var scaleFactor = 1;
	if (endWithFirst == true)
		scaleFactor = totalLength / (numParts * wallPartLength + wallStyles[style][wallPart[0]].width);
	else
		scaleFactor = totalLength / (numParts * wallPartLength);
	// Place wall entities
	var actualAngle = orientation + (2*PI - maxAngle) / 2;
	var x = centerX + radius*cos(actualAngle);
	var y = centerY + radius*sin(actualAngle);
	for (var partIndex = 0; partIndex < numParts; partIndex++)
	{
		for (var elementIndex = 0; elementIndex < wallPart.length; elementIndex++)
		{
			var wallEle = wallStyles[style][wallPart[elementIndex]];
			// Width correction
			var addAngle = scaleFactor * wallEle.width / radius;
			var targetX = centerX + radius * cos(actualAngle + addAngle);
			var targetY = centerY + radius * sin(actualAngle + addAngle);
			var placeX = x + (targetX - x)/2;
			var placeY = y + (targetY - y)/2;
			var placeAngle = actualAngle + addAngle/2;
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
		var wallEle = wallStyles[style][wallPart[0]];
		var addAngle = scaleFactor * wallEle.width / radius;
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
function placePolygonalWall(centerX, centerY, radius, wallPart, cornerWallElement, style, playerId, orientation, numCorners, skipFirstWall)
{
	// Setup optional arguments to the default
	wallPart = (wallPart || ["wallLong", "tower"]);
	cornerWallElement = (cornerWallElement || "tower"); // Don't use wide elements for this. Not supported well...
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	orientation = (orientation || 0);
	numCorners = (numCorners || 8);
	skipFirstWall = (skipFirstWall || true);
	
	// Setup angles
	var angleAdd = 2*PI/numCorners;
	var angleStart = orientation - angleAdd/2;
	// Setup corners
	var corners = [];
	for (var i = 0; i < numCorners; i++)
		corners.push([centerX + radius*cos(angleStart + i*angleAdd), centerY + radius*sin(angleStart + i*angleAdd)]);
	// Place Corners and walls
	for (var i = 0; i < numCorners; i++)
	{
		var angleToCorner = getAngle(corners[i][0], corners[i][1], centerX, centerY);
		placeObject(corners[i][0], corners[i][1], wallStyles[style][cornerWallElement].entPath, playerId, angleToCorner);
		if (!(skipFirstWall && i == 0))
		{
			placeLinearWall(
				// Adjustment to the corner element width (approximately)
				corners[i][0] + wallStyles[style][cornerWallElement].width/2 * sin(angleToCorner + angleAdd/2), // startX
				corners[i][1] - wallStyles[style][cornerWallElement].width/2 * cos(angleToCorner + angleAdd/2), // startY
				corners[(i+1)%numCorners][0] - wallStyles[style][cornerWallElement].width/2 * sin(angleToCorner + angleAdd/2), // targetX
				corners[(i+1)%numCorners][1] + wallStyles[style][cornerWallElement].width/2 * cos(angleToCorner + angleAdd/2), // targetY
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
//	numCorners           Optional. How many corners the polygon will have. Default is 8 (matching a civ centers territory)
//	irregularity         Optional. How irregular the polygon will be. 0 means regular, 1 means VERY irregular. Default is 0.5
//	skipFirstWall        Optional. Boolean. If the first linear wall part will be left opened as entrance. Default is true
//	wallPartsAssortment  Optional. An array of wall part arrays to choose from for each linear wall connecting the corners. Default is hard to describe ^^
//
//	NOTE: wallPartsAssortment is put to the end because it's hardest to set
//	NOTE: Don't use wall elements with bending like corners!
//	TODO: Replace skipFirstWall with firstWallPart to enable gate/defended entrance placement
//	TODO: Check some arguments
//	TODO: Perhaps add eccentricity
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeIrregularPolygonalWall(centerX, centerY, radius, cornerWallElement, style, playerId, orientation, numCorners, irregularity, skipFirstWall, wallPartsAssortment)
{
	// Setup optional arguments
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	
	// Generating a generic wall part assortment with each wall part including 1 gate lengthened by walls and towers
	// NOTE: It might be a good idea to write an own function for that...
	var defaultWallPartsAssortment = [["wallShort"], ["wall"], ["wallLong"], ["gate", "tower", "wallShort"]];
	var centeredWallPart = ["gate"];
	var extandingWallPartAssortment = [["tower", "wallLong"], ["tower", "wall"]];
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
	cornerWallElement = (cornerWallElement || "tower"); // Don't use wide elements for this. Not supported well...
	style = (style || "palisades");
	playerId = (playerId || 0);
	orientation = (orientation || 0);
	numCorners = (numCorners || randInt(5, 7));
	irregularity = (irregularity || 0.5);
	skipFirstWall = (skipFirstWall || false);
	// Setup angles
	var angleToCover = 2*PI;
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
	for (var partIndex = 0; partIndex < wallPartsAssortment.length; partIndex++)
	{
		var length = wallPartLengths[partIndex];
		wallPartLengths.push(getWallLength(wallPartsAssortment[partIndex], style));
		if (length > maxWallPartLength)
			maxWallPartLength = length;
	}
	var wallPartList = []; // This is the list of the wall parts to use for the walls between the corners, not to confuse with wallPartsAssortment!
	for (var i = 0; i < numCorners; i++)
	{
		var bestWallPart = []; // This is a simpel wall part not a wallPartsAssortment!
		var bestWallLength = 99999999;
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
		placeObject(corners[i][0], corners[i][1], wallStyles[style][cornerWallElement].entPath, playerId, angleToCorner);
		if (!(skipFirstWall && i == 0))
		{
			placeLinearWall(
				// Adjustment to the corner element width (approximately)
				corners[i][0] + wallStyles[style][cornerWallElement].width/2 * sin(angleToCorner + angleAddList[i]/2), // startX
				corners[i][1] - wallStyles[style][cornerWallElement].width/2 * cos(angleToCorner + angleAddList[i]/2), // startY
				corners[(i+1)%numCorners][0] - wallStyles[style][cornerWallElement].width/2 * sin(angleToCorner + angleAddList[(i+1)%numCorners]/2), // targetX
				corners[(i+1)%numCorners][1] + wallStyles[style][cornerWallElement].width/2 * cos(angleToCorner + angleAddList[(i+1)%numCorners]/2), // targetY
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
//	radius         The approximate radius of the wall to be placed
//	playerId       Optional. Integer number of the player. Default is 0 (gaia)
//	style          Optional. Wall style string. Default is the civ of the given player, "palisades" for gaia
//	irregularity   Optional. Float between 0 (circle) and 1 (very spiky), default is 1/2
//	gateOccurence  Optional. Integer number, every n-th walls will be a gate instead. Default is 3
//	maxTrys        Optional. How often the function tries to find a better fitting shape at max. Default is 100
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function placeGenericFortress(centerX, centerY, radius, playerId, style, irregularity, gateOccurence, maxTrys)
{
	// Setup optional arguments
	radius = (radius || 20);
	playerId = (playerId || 0);
	if (!wallStyles.hasOwnProperty(style))
	{
		if (playerId == 0)
			style = (style || "palisades");
		else
			style = (getCivCode(playerId-1));
	}
	irregularity = (irregularity || 1/2);
	gateOccurence = (gateOccurence || 3);
	maxTrys = (maxTrys || 100);
	
	// Setup some vars
	var startAngle = randFloat(0, 2*PI);
	var actualOffX = radius*cos(startAngle);
	var actualOffY = radius*sin(startAngle);
	var actualAngle = startAngle;
	var pointDistance = wallStyles[style]["wallLong"].width + wallStyles[style]["tower"].width;
	// Searching for a well fitting point derivation
	var tries = 0;
	var bestPointDerivation = undefined;
	var minOverlap = 1000;
	var overlap = undefined;
	while (tries < maxTrys && minOverlap > wallStyles[style]["tower"].width / 10)
	{
		var pointDerivation = [];
		var distanceToTarget = 1000;
		var targetReached = false;
		while (!targetReached)
		{
			var indent = randFloat(-irregularity*pointDistance, irregularity*pointDistance);
			var tmpAngle = getAngle(actualOffX, actualOffY,
				(radius + indent)*cos(actualAngle + (pointDistance / radius)),
				(radius + indent)*sin(actualAngle + (pointDistance / radius)));
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
		var wallElement = "wallLong";
		if ((pointIndex + 1) % gateOccurence == 0)
			wallElement = "gate";
		var entPath = wallStyles[style][wallElement].entPath;
		if (entPath)
		{
			placeObject(startX + (getDistance(startX, startY, targetX, targetY)/2)*cos(angle), // placeX
				startY + (getDistance(startX, startY, targetX, targetY)/2)*sin(angle), // placeY
				entPath, playerId, angle - PI/2 + wallStyles[style][wallElement].angle);
		}
		// Place tower
		var startX = centerX + bestPointDerivation[(pointIndex + bestPointDerivation.length - 1) % bestPointDerivation.length][0];
		var startY = centerY + bestPointDerivation[(pointIndex + bestPointDerivation.length - 1) % bestPointDerivation.length][1];
		var angle = getAngle(startX, startY, targetX, targetY);
		placeObject(centerX + bestPointDerivation[pointIndex][0], centerY + bestPointDerivation[pointIndex][1], wallStyles[style]["tower"].entPath, playerId, angle - PI/2 + wallStyles[style]["tower"].angle);
	}
}
