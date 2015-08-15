
/////////////////////////////////////////////////////////////////////////////////////////////
//	Constant definitions
/////////////////////////////////////////////////////////////////////////////////////////////

const PI = Math.PI;
const TWO_PI = 2 * Math.PI;
const TERRAIN_SEPARATOR = "|";
const SEA_LEVEL = 160.0;
const CELL_SIZE = 4;
const HEIGHT_UNITS_PER_METRE = 92;
const MIN_MAP_SIZE = 128;
const MAX_MAP_SIZE = 512;
const FALLBACK_CIV = "athen";
// Constants needed for heightmap_manipulation.js
const MAX_HEIGHT_RANGE = 0xFFFF / HEIGHT_UNITS_PER_METRE // Engine limit, Roughly 700 meters
const MIN_HEIGHT = - SEA_LEVEL;
const MAX_HEIGHT = MAX_HEIGHT_RANGE - SEA_LEVEL;
// Entity template structure keys that might change, for easier mod support
const STARTING_ENTITY_KEY = "StartEntities";
const START_ENTITY_TEMPLATE_PATH_KEY = "Template"
const BUILDER_TEMPLATEPATH_KEYS = ["Builder", "Entities", "_string"];
const PRODUCTION_TEMPLATEPATH_KEYS = ["ProductionQueue", "Entities", "_string"];
const CIV_PLACEHOLDER_STRING = "{civ}";

/////////////////////////////////////////////////////////////////////////////////////////////
//	Utility functions
/////////////////////////////////////////////////////////////////////////////////////////////

function fractionToTiles(f)
{
	return getMapSize() * f;
}

function tilesToFraction(t)
{
	return t / getMapSize();
}

function fractionToSize(f)
{
	return getMapArea() * f;
}

function sizeToFraction(s)
{
	return s / getMapArea();
}

function scaleByMapSize(min, max)
{
	return min + ((max-min) * (getMapSize()-MIN_MAP_SIZE) / (MAX_MAP_SIZE-MIN_MAP_SIZE));
}

function cos(x)
{
	return Math.cos(x);
}

function sin(x)
{
	return Math.sin(x);
}

function abs(x) {
	return Math.abs(x);
}

function round(x)
{
	return Math.round(x);
}

function lerp(a, b, t)
{
	return a + (b-a) * t;
}

function sqrt(x)
{
	return Math.sqrt(x);
}

function ceil(x)
{
	return Math.ceil(x);
}

function floor(x)
{
	return Math.floor(x);
}

function max(a, b)
{
	return a > b ? a : b;
}

function min(a, b)
{
	return a < b ? a : b;
}

function println(x)
{
	print(x);
	print("\n");
}

function argsToArray(x)
{
	var numArgs = x.length;
	if (numArgs != 1)
	{
		var ret = new Array(numArgs);
		for (var i=0; i < numArgs; i++)
		{
			ret[i] = x[i];
		}
		return ret;
	}
	else
	{
		return x[0];
	}
}

function chooseRand()
{
	if (arguments.length==0)
	{
		throw("chooseRand: requires at least 1 argument");
	}
	var ar = argsToArray(arguments);
	return ar[randInt(ar.length)];
}

// "Inside-out" implementation of Fisher-Yates shuffle
function shuffleArray(source)
{
	if (!source.length)
		return [];

	var result = [source[0]];
	for (var i = 1; i < source.length; i++)
	{
		var j = randInt(0, i);
		result[i] = result[j];
		result[j] = source[i];
	}
	return result;
}

function createAreas(centeredPlacer, painter, constraint, num, retryFactor)
{
	if (retryFactor === undefined)
	{
		retryFactor = 10;
	}
	
	var maxFail = num * retryFactor;
	var good = 0;
	var bad = 0;
	var result = [];
	var halfSize = getMapSize()/2;
	
	while(good < num && bad <= maxFail)
	{
		if (isCircularMap())
		{	// Polar coordinates
			var r = halfSize * Math.sqrt(randFloat());	// uniform distribution
			var theta = randFloat(0, 2 * PI);
			centeredPlacer.x = Math.floor(r * Math.cos(theta)) + halfSize;
			centeredPlacer.z = Math.floor(r * Math.sin(theta)) + halfSize;
		}
		else
		{	// Rectangular coordinates
			centeredPlacer.x = randInt(getMapSize());
			centeredPlacer.z = randInt(getMapSize());
		}
		
		var area = g_Map.createArea(centeredPlacer, painter, constraint);
		if (area !== undefined)
		{
			good++;
			result.push(area);
		}
		else
		{
			bad++;
		}
	}
	return result;
}

function createAreasInAreas(centeredPlacer, painter, constraint, num, retryFactor, areas)
{
	if (retryFactor === undefined)
	{
		retryFactor = 10;
	}
	
	var maxFail = num * retryFactor;
	var good = 0;
	var bad = 0;
	var result = [];
	var numAreas = areas.length;
	
	while(good < num && bad <= maxFail && numAreas)
	{
		// Choose random point from area
		var i = randInt(numAreas);
		var size = areas[i].points.length;
		var pt = areas[i].points[randInt(size)];
		centeredPlacer.x = pt.x;
		centeredPlacer.z = pt.z;
		
		var area = g_Map.createArea(centeredPlacer, painter, constraint);
		if (area !== undefined)
		{
			good++;
			result.push(area);
		}
		else
		{
			bad++;
		}
	}
	return result;
}

function createObjectGroups(placer, player, constraint, num, retryFactor)
{
	if (retryFactor === undefined)
	{
		retryFactor = 10;
	}
	
	var maxFail = num * retryFactor;
	var good = 0;
	var bad = 0;
	var halfSize = getMapSize()/2 - 3;
	while(good < num && bad <= maxFail)
	{
		if (isCircularMap())
		{	// Polar coordinates
			var r = halfSize * Math.sqrt(randFloat());	// uniform distribution
			var theta = randFloat(0, 2 * PI);
			placer.x = Math.floor(r * Math.cos(theta)) + halfSize;
			placer.z = Math.floor(r * Math.sin(theta)) + halfSize;
		}
		else
		{	// Rectangular coordinates
			placer.x = randInt(getMapSize());
			placer.z = randInt(getMapSize());
		}
		
		var result = createObjectGroup(placer, player, constraint);
		if (result !== undefined)
		{
			good++;
		}
		else
		{
			bad++;
		}
	}
	return good;
}

function createObjectGroupsByAreas(placer, player, constraint, num, retryFactor, areas)
{
	if (retryFactor === undefined)
	{
		retryFactor = 10;
	}
	
	var maxFail = num * retryFactor;
	var good = 0;
	var bad = 0;
	var numAreas = areas.length;
	
	while(good < num && bad <= maxFail && numAreas)
	{
		// Choose random point from area
		var i = randInt(numAreas);
		var size = areas[i].points.length;
		var pt = areas[i].points[randInt(size)];
		placer.x = pt.x;
		placer.z = pt.z;
		
		var result = createObjectGroup(placer, player, constraint);
		if (result !== undefined)
		{
			good++;
		}
		else
		{
			bad++;
		}
	}
	return good;
}

function createTerrain(terrain)
{
	if (terrain instanceof Array)
	{
		var terrainList = [];
		
		for (var i = 0; i < terrain.length; ++i)
		{
			terrainList.push(createTerrain(terrain[i]));
		}
		
		return new RandomTerrain(terrainList);
	}
	else
	{
		return createSimpleTerrain(terrain);
	}
}

function createSimpleTerrain(terrain)
{
	if (typeof(terrain) == "string")
	{	// Split string by pipe | character, this allows specifying terrain + tree type in single string
		var params = terrain.split(TERRAIN_SEPARATOR, 2);
		
		if (params.length != 2)
		{
			return new SimpleTerrain(terrain);
		}
		else
		{
			return new SimpleTerrain(params[0], params[1]);
		}
	}
	else
	{
		throw("createSimpleTerrain expects string as input, received "+terrain);
	}
}

function placeObject(x, z, type, player, angle)
{
	if (g_Map.validT(x, z, 3))
		g_Map.addObject(new Entity(type, player, x, z, angle));
}

function placeTerrain(x, z, terrain)
{
	// convert terrain param into terrain object
	g_Map.placeTerrain(x, z, createTerrain(terrain));
}

function isCircularMap()
{
	return (g_MapSettings.CircularMap ? true : false);
}

/////////////////////////////////////////////////////////////////////////////////////////////
//	Access global map variable
/////////////////////////////////////////////////////////////////////////////////////////////

function createTileClass()
{
	return g_Map.createTileClass();
}

function getTileClass(id)
{
	// Check for valid class id
	if (!g_Map.validClass(id))
	{
		return undefined;
	}
	
	return g_Map.tileClasses[id];
}

function createArea(placer, painter, constraint)
{
	return g_Map.createArea(placer, painter, constraint);
}

function createObjectGroup(placer, player, constraint)
{
	return g_Map.createObjectGroup(placer, player, constraint);
}

function getMapSize()
{
	return g_Map.size;
}

function getMapArea()
{
	return g_Map.size*g_Map.size;
}

function getNumPlayers()
{
	return g_MapSettings.PlayerData.length - 1;
}

// Takes nothing, returns an array of strings representing all available civilizations
function getCivList()
{
	var raw_civData = RMS.GetCivData();
	var civList = [];
	for (var i = 0; i < raw_civData.length; ++i)
		civList.push(JSON.parse(raw_civData[i]).Code);
	
	return civList;
}

// Takes nothing, returns an associative array with civ strings as keys containing all unpacked civ data (Templates need to be unpacked with RMS.GetTemplate() if needed)
function getFullCivData()
{
	var rawCivData = RMS.GetCivData();
	var unpackedCivData = {};
	for (var i = 0; i < rawCivData.length; i++)
	{
		var singleCivData = JSON.parse(rawCivData[i]);
		unpackedCivData[singleCivData.Code] = singleCivData;
	}
	
	return unpackedCivData;
}

// Takes a player number (0-7, so Gaia excluded). Returns this players civ string
// ToDo: If the player number is to high an error will occur (and the fallback won't be reached)!
function getCivCode(player)
{
	if (g_MapSettings.PlayerData[player+1].Civ)
		return g_MapSettings.PlayerData[player+1].Civ;

	warn("Undefined civ specified for player " + (player + 1) + ", falling back to '" + FALLBACK_CIV + "'");
	return FALLBACK_CIV;
}

// Takes an entity path and a key list to get the templates value
function getTemplateValue(entPath, key_list)
{
	var subdata = RMS.GetTemplate(entPath);
	for (var i = 0; i < key_list.length; i++)
	{
		if (key_list[i] in subdata)
		{
			subdata = subdata[key_list[i]];
		}
		else
		{
			return false;
		}
	}
	return subdata;
}

// Returns a list of all templates paths available to the given civ
function getTempatePathList(civ)
{
	var templatePaths = getFullCivData();
	if (civ in templatePaths)
	{
		templatePaths = templatePaths[civ];
	}
	else
	{
		var keys = [];
		for (var key in templatePaths)
			keys.push(key);
		warn("getTempatePathList: Unknown civ: " + civ + " not in " + uneval(keys));
		return false;
	}
	if (STARTING_ENTITY_KEY in templatePaths)
	{
		templatePaths = templatePaths[STARTING_ENTITY_KEY];
	}
	else
	{
		var keys = [];
		for (var key in templatePaths)
			keys.push(key);
		warn("getTempatePathList: Civ has no starting entities as defined in STARTING_ENTITY_KEY (" + STARTING_ENTITY_KEY + "): " + uneval(keys));
		return false;
	}
	for (var i = 0; i < templatePaths.length; i++)
	{
		if (START_ENTITY_TEMPLATE_PATH_KEY in templatePaths[i])
		{
			templatePaths[i] = templatePaths[i][START_ENTITY_TEMPLATE_PATH_KEY];
		}
		else
		{
			var keys = [];
			for (var key in templatePaths[i])
				keys.push(key);
			warn("getTempatePathList: Starting entity list item has no template as defined in START_ENTITY_TEMPLATE_PATH_KEY (" + START_ENTITY_TEMPLATE_PATH_KEY + "): " + uneval(keys));
			return false;
		}
	}
	var foundNew = 1;
	while (foundNew > 0)
	{
		foundNew = 0;
		var methods = [BUILDER_TEMPLATEPATH_KEYS, PRODUCTION_TEMPLATEPATH_KEYS];
		for (var m = 0; m < methods.length; m++)
		{
			for (var t = 0; t < templatePaths.length; t++)
			{
				var pathsToCheck = getTemplateValue(templatePaths[t], methods[m]);
				if (typeof(pathsToCheck) === typeof(""))
				{
					pathsToCheck = pathsToCheck.split(/\s+/);
					for (var c = 0; c < pathsToCheck.length; c++)
					{
						var actualPath = pathsToCheck[c].replace(CIV_PLACEHOLDER_STRING, civ);
						if (templatePaths.indexOf(actualPath) == -1 && RMS.TemplateExists(actualPath))
						{
							templatePaths.push(actualPath);
							foundNew++;
						}
					}
				}
			}
		}
	}
	return templatePaths;
}

function areAllies(player1, player2)
{
	if ((g_MapSettings.PlayerData[player1+1].Team === undefined) || (g_MapSettings.PlayerData[player2+1].Team === undefined) || (g_MapSettings.PlayerData[player2+1].Team == -1) || (g_MapSettings.PlayerData[player1+1].Team == -1))
	{
		return false;
	}
	else
	{
		return (g_MapSettings.PlayerData[player1+1].Team === g_MapSettings.PlayerData[player2+1].Team);
	}
}

function getPlayerTeam(player)
{
	if (g_MapSettings.PlayerData[player+1].Team === undefined)
	{
		return -1;
	}
	else
	{
		return g_MapSettings.PlayerData[player+1].Team;
	}
}

function sortPlayers(source)
{
	if (!source.length)
		return [];

	var result = new Array(0);
	var team = new Array(5);
	for (var q = 0; q < 5; q++)
	{
		team[q] = new Array(1);
	}

	for (var i = -1; i < 4; i++)
	{
		for (var j = 0; j < source.length; j++)
		{
			if (getPlayerTeam(j) == i)
			{
				team[i+1].unshift(j+1);
			}
		}
		team[i+1].pop();
		result=result.concat(shuffleArray(team[i+1]))
	}
	return result;
}

function primeSortPlayers(source)
{
	if (!source.length)
		return [];

	var prime = new Array(source.length);

	for (var i = 0; i < round(source.length/2); i++)
	{
		prime[2*i]=source[i];
		prime[2*i+1]=source[source.length-1-i];
	}

	return prime;
}

function getStartingEntities(player)
{	
	var civ = getCivCode(player);
	if (!g_CivData[civ] || !g_CivData[civ].StartEntities || !g_CivData[civ].StartEntities.length)
	{
		warn("Invalid or unimplemented civ '"+civ+"' specified, falling back to '" + FALLBACK_CIV + "'");
		civ = FALLBACK_CIV;
	}
	
	return g_CivData[civ].StartEntities;
}

function getHeight(x, z)
{
	return g_Map.getHeight(x, z);
}

function setHeight(x, z, height)
{
	g_Map.setHeight(x, z, height);
}

/////////////////////////////////////////////////////////////////////////////////////////////
//	Utility functions for classes
/////////////////////////////////////////////////////////////////////////////////////////////


// Add point to given class by id
function addToClass(x, z, id)
{
	var tileClass = getTileClass(id);
	
	if (tileClass !== null)
	{
		tileClass.add(x, z);
	}
}

// Remove point from the given class by id
function removeFromClass(x, z, id)
{
	var tileClass = getTileClass(id);
	
	if (tileClass !== null)
	{
		tileClass.remove(x, z);
	}
}

// Create a painter for the given class
function paintClass(id)
{
	return new TileClassPainter(getTileClass(id));
}

// Create a painter for the given class
function unPaintClass(id)
{
	return new TileClassUnPainter(getTileClass(id));
}

// Create an avoid constraint for the given classes by the given distances
function avoidClasses(/*class1, dist1, class2, dist2, etc*/)
{
	var ar = new Array(arguments.length/2);
	for (var i = 0; i < arguments.length/2; i++)
	{
		ar[i] = new AvoidTileClassConstraint(arguments[2*i], arguments[2*i+1]);
	}
	
	// Return single constraint
	if (ar.length == 1)
	{
		return ar[0];
	}
	else
	{
		return new AndConstraint(ar);
	}
}

// Create a stay constraint for the given classes by the given distances
function stayClasses(/*class1, dist1, class2, dist2, etc*/)
{
	var ar = new Array(arguments.length/2);
	for (var i = 0; i < arguments.length/2; i++)
	{
		ar[i] = new StayInTileClassConstraint(arguments[2*i], arguments[2*i+1]);
	}
	
	// Return single constraint
	if (ar.length == 1)
	{
		return ar[0];
	}
	else
	{
		return new AndConstraint(ar);
	}
}

// Create a border constraint for the given classes by the given distances
function borderClasses(/*class1, idist1, odist1, class2, idist2, odist2, etc*/)
{
	var ar = new Array(arguments.length/3);
	for (var i = 0; i < arguments.length/3; i++)
	{
		ar[i] = new BorderTileClassConstraint(arguments[3*i], arguments[3*i+1], arguments[3*i+2]);
	}
	
	// Return single constraint
	if (ar.length == 1)
	{
		return ar[0];
	}
	else
	{
		return new AndConstraint(ar);
	}
}

// Checks if the given tile is in class "id"
function checkIfInClass(x, z, id)
{
	var tileClass = getTileClass(id);
	if (tileClass !== null)
	{
		if (tileClass.countMembersInRadius(x, z, 1) !== null)
		{
			return tileClass.countMembersInRadius(x, z, 1);
		}
		else
		{
			return 0;
		}
	}
	else
	{
		return 0;
	}
}


// Returns the distance between 2 points
function getDistance(x1, z1, x2, z2)
{
	return Math.pow(Math.pow(x1 - x2, 2) + Math.pow(z1 - z2, 2), 1/2);
}

// Returns the angle of the vector between point 1 and point 2.  The angle is anticlockwise from the positive x axis.
function getAngle(x1, z1, x2, z2)
{
	return Math.atan2(z2 - z1, x2 - x1);
}

// Returns the gradient of the line between point 1 and 2 in the form dz/dx
function getGradient(x1, z1, x2, z2)
{
	if (x1 == x2 && z1 == z2)
	{
		return 0;
	}
	else
	{
		return (z1-z2)/(x1-x2);
	}
}

function getTerrainTexture(x, y)
{
	return g_Map.getTexture(x, y);
}

