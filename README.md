
Example:
```
var wall = ["start", "short", "tower", "gate", "tower", "medium", "end"];

var startX = 20;		// X coordinate of the first wall element
var startY = 20;		// Y coordinate of the first wall element
var style = g_WallStyleList[1];	// The wall's style like 'cart_stone', 'rome_stone', 'rome_siege' or 'palisade'.
								// g_WallStyleList[1] is currently "athen_stone"
var playerId = 0;		// Owner of the wall (like in placeObject). 0 is Gaia, 1 is Player 1 (default color blue), ...
var orientation = 0;	// Orientation of the first wall element. 0 means the 'outside' or 'front' of the wall is the right

placeWall(startX, startY, wall, style, playerId, orientation); // Place the wall
```

Valid wall segments:
 * `long`
 * `medium`
 * `short`
 * `start`
 * `end`
 * `gate`
 * `tower`
 * `fort`
 * `cornerIn`
 * `cornerOut`

Additional, legacy wall segments:
 * `endLeft` (equivelent to `start`)
 * `endRight` (equivelent to `end`)
 * `wall` (equivelent to `medium`)
 * `entry` (creates a non-blocking space in the wall)
 * `entryTower` (creates a non-blocking space in the wall with a `defense_tower` offset in front)
 * `entryFort` (creates a non-blocking space in the wall with a `fortress` offset behind)

You can create a non-blocking gap by using `gap{x}` where `{x}` is an integer number.

You can turn abruptly by using `turn{s}` where `{s}` is either `out` or `in`, (`{s}` is case insensitive).

You can place any building a civ has besides the wall by simply stating its name (`house`, `barracks`, `apadana`, etc.)
 
 

