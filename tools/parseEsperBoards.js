var fs = require('fs');
var request = require('request');
var PNG = require('pngjs').PNG;

var stats = ["HP","MP","ATK","DEF","MAG","SPR"];
var elements = ["fire", "ice", "lightning", "water", "wind", "earth", "light", "dark"];
var ailments = ["poison", "blind", "sleep", "silence", "paralysis", "confuse", "disease", "petrification"];

var raceMap = {
    1: 'beast',
    2: 'bird',
    3: 'aquatic',
    4: 'demon',
    5: 'human',
    6: 'machine',
    7: 'dragon',
    8: 'spirit',
    9: 'bug',
    10: 'stone',
    11: 'plant',
    12: 'undead'
}

var ailmentsMap = {
    "Poison": "poison",
    "Blind": "blind",
    "Sleep": "sleep",
    "Silence": "silence",
    "Paralyze": "paralysis",
    "Confusion": "confuse",
    "Disease": "disease",
    "Petrify": "petrification",
    "Death": "death"
}

var elementsMap = {
    "Fire": "fire",
    "Ice": "ice",
    "Lightning": "lightning",
    "Water": "water",
    "Wind": "wind",
    "Earth": "earth",
    "Light": "light",
    "Dark": "dark"
}

var espersMap = {
    "セイレーン": "Siren",
    "イフリート": "Ifrit",
    "シヴァ": "Shiva",
    "カーバンクル": "Carbuncle",
    "ディアボロス": "Diabolos",
    "ゴーレム": "Golem",
    "ラムウ": "Ramuh",
    "タイタン": "Titan",
    "テトラシルフィード": "Tetra Sylphid",
    "オーディン": "Odin",
    "ラクシュミ": "Lakshmi",
    "アレキサンダー": "Alexander",
    "フェニックス": "Phoenix",
    "バハムート": "Bahamut",
    "フェンリル": "Fenrir",
    "リヴァイアサン": "Leviathan",
    "アニマ": "Anima",
    "阿修羅": "Asura",
    "黒龍": "Kokuryu"
}

var typeMap = {
    1: 'dagger',
    2: 'sword',
    3: 'greatSword',
    4: 'katana',
    5: 'staff',
    6: 'rod',
    7: 'bow',
    8: 'axe',
    9: 'hammer',
    10: 'spear',
    11: 'harp',
    12: 'whip',
    13: 'throwing',
    14: 'gun',
    15: 'mace',
    16: 'fist',
    30: 'lightShield',
    31: 'heavyShield',
    40: 'hat',
    41: 'helm',
    50: 'clothes',
    51: 'lightArmor',
    52: 'heavyArmor',
    53: 'robe',
    60: 'accessory'
}

var unitNamesById = {};
var unitIdByTmrId = {};
var oldItemsAccessById = {};
var oldItemsEventById = {};
var oldItemsMaxNumberById = {};
var oldItemsWikiEntryById = {};
var releasedUnits;
var skillNotIdentifiedNumber = 0;
var dev = false;
var server;
var dataUrl;


if (process.argv.length < 3 || (process.argv[2] != "GL" && process.argv[2] != "JP")) {
    console.log("Need GL or JP argument");
    process.exit();
} else {
    server = process.argv[2];
    if (server == "GL") {
        dataUrl = 'https://raw.githubusercontent.com/aEnigmatic/ffbe/master/';
    } else {
        dataUrl = 'https://raw.githubusercontent.com/aEnigmatic/ffbe-jp/master/';
    }
}

function getData(filename, callback) {
    if (!dev) {
        request.get(dataUrl + filename, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(filename + " downloaded");
                var result = JSON.parse(body);
                callback(result);
            }
        });
    } else {
        fs.readFile(server + '/sources/' + filename, function (err, content) {
            var result = JSON.parse(content);
            callback(result);
        });
    }
}

console.log("Starting");
getData('summons.json', function (espers) {
    getData('summons_boards.json', function (esperBoards) {
        getData('skills_ability.json', function (skills) {
            getData('skills_passive.json', function (passives) {
                getData('skills_magic.json', function (magics) {
                    Object.keys(skills).forEach(skillId => {
                        skills[skillId].active = true;
                        skills[skillId].type = "ABILITY";
                    });
                    Object.keys(passives).forEach(skillId => {
                        skills[skillId] = passives[skillId];
                        skills[skillId].active = false;
                        skills[skillId].type = "PASSIVE";
                    });
                    Object.keys(magics).forEach(skillId => {
                        skills[skillId] = magics[skillId];
                        skills[skillId].active = true;
                        skills[skillId].type = "MAGIC";
                    });
                    fs.readFile('./esperProgression.json', function (err, content) {
                        var esperProgression = JSON.parse(content);
                        var out = {};
                        Object.keys(espers).forEach(esperId => {
                            var esper = espers[esperId];
                            var boardOut = {};
                            var esperName = esper.names[0];
                            console.log(esperName);
                            if (espersMap[esperName]) {
                                esperName = espersMap[esperName];
                            }
                            out[esperName] = boardOut;
                            boardOut.stats = {};
                            boardOut.resist = {};
                            boardOut.statPattern = {};
                            for (var i = 0; i < esper.entries.length; i++) {
                                boardOut.stats[i+1] = esper.entries[i].stats;
                                boardOut.resist[i+1] = getResist(esper.entries[i]);
                                boardOut.statPattern[i+1] = esper.entries[i]['stat_pattern'];
                            }
                            var boardIn = esperBoards[esperId];
                            var nodeByIds = {};
                            var rootNodeId = 0;
                            for (var nodeId in boardIn) {
                                var node = boardIn[nodeId];
                                if (!node.parent_node_id && !rootNodeId) {
                                    rootNodeId = nodeId
                                } else {
                                    var nodeOut = getNode(node, skills);
                                    nodeByIds[nodeId] = nodeOut;
                                }
                            }

                            boardOut.nodes = [];
                            for (var nodeId in boardIn) {
                                var node = boardIn[nodeId];
                                var nodeOut = nodeByIds[nodeId];
                                if (node.parent_node_id) {
                                    if (node.parent_node_id == rootNodeId) {
                                        boardOut.nodes.push(nodeOut);
                                    } else {
                                        var parentNode = nodeByIds[node.parent_node_id];
                                        if (!parentNode) {
                                            console.log(esperName);
                                            console.log(nodeId);
                                            console.log(rootNodeId);
                                            console.log(node.parent_node_id);
                                        }
                                        parentNode.children.push(nodeOut);
                                    }
                                }
                            }
                            boardOut.progression = esperProgression[esperName];

                            fs.writeFileSync(server + '/esperBoards.json', formatOutput(out));
                        });
                    });
                });
            });
        });
    });
});

function getNode(node, skills) {
    var nodeOut = {"children": [], "cost":node.cost, "position":node.position};
    if (stats.includes(node.reward[0])) {
        nodeOut[node.reward[0].toLowerCase()] = node.reward[1];
    } else if (node.reward[0].endsWith("Res")) {
        var element = elementsMap[node.reward[0].substr(0, node.reward[0].length - 3)];
        nodeOut.resist = [{"name":element, "percent":node.reward[1]}];
    } else if (node.reward[0] == "MAGIC" || node.reward[0] == "ABILITY") {
        addSkill(node.reward[1], nodeOut, skills);
    } else {
        console.log("Didn't treat : " + JSON.stringify(node));
    }
    return nodeOut;
}

function addSkill(skillId, itemOut, skills) {
    var skill = skills[skillId];
    if (skill) {
        if (skill.type == "MAGIC") {
            addSpecial(itemOut, getSkillString(skill));
        } else {
            var effectsNotTreated = [];
            for (var rawEffectIndex in skill.effects_raw) {
                rawEffect = skill.effects_raw[rawEffectIndex];

                if (!addEffectToItem(itemOut, skill, rawEffectIndex, skills)) {
                    addNotTreatedEffects(itemOut, rawEffectIndex, skill);
                }
            }
        }
    }
}

function addNotTreatedEffects(itemOut, effectsNotTreated, skill) {
    if (effectsNotTreated.length > 0) {
        var special = "[" + skill.name;
        if (skill.icon) {
            special += "|" + skill.icon;
        }
        special += "]:"
        var first = true;
        for (var index in effectsNotTreated) {
            if (first) {
                first = false;
            } else {
                special += ", ";
            }
            special += skill.effects[effectsNotTreated[index]];
        }
        addSpecial(itemOut, special);
    }
}

function addEffectToItem(item, skill, rawEffectIndex, skills) {
    if (skill.active) {
        return false; // don't consider active skills
    }
    var rawEffect = skill.effects_raw[rawEffectIndex];
    // + X % to a stat
    if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 1) {
        var effectData = rawEffect[3]
        addStat(item, "hp%", effectData[4]);
        addStat(item, "mp%", effectData[5]);
        addStat(item, "atk%", effectData[0]);
        addStat(item, "def%", effectData[1]);
        addStat(item, "mag%", effectData[2]);
        addStat(item, "spr%", effectData[3]);

    // DualWield
    } else if (rawEffect[1] == 3 && rawEffect[2] == 14 && (rawEffect[0] == 0 || rawEffect[0] == 1)) {
        if (rawEffect[3].length == 1 && rawEffect[3][0] == "none") {
            addSpecial(item,"dualWield");
        } else {
            item.partialDualWield = [];
            for (var dualWieldType in rawEffect[3]) {
                var typeId = rawEffect[3][dualWieldType];
                item.partialDualWield.push(typeMap[typeId]);
            }
        }

    // killers
        // Killers
    } else if (((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 11) ||
        (rawEffect[0] == 1 && rawEffect[1] == 1 && rawEffect[2] == 11)) {
        addKiller(item, rawEffect[3][0],rawEffect[3][1],rawEffect[3][2]);

    // evade
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 22) {
        if (!item.evade) {
            item.evade = {};
        }
        item.evade.physical = rawEffect[3][0];

    // magical evade
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 54 && rawEffect[3][0] == -1) {
        if (!item.evade) {
            item.evade = {};
        }
        item.evade.magical = rawEffect[3][1];

    // Auto- abilities
    } else if (rawEffect[0] == 1 && rawEffect[1] == 3 && rawEffect[2] == 35) {
        addSpecial(item, "Gain at the start of a battle: " + getSkillString(skills[rawEffect[3][0]]));

    // Element Resist
    } else if (!skill.active && (rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 3) {
        addElementalResist(item, rawEffect[3]);

    // Ailments Resist
    } else if (!skill.active && (rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 2) {
        addAilmentResist(item, rawEffect[3]);

    // Equip X
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 5) {
        item.allowUseOf = typeMap[rawEffect[3]];

    // Doublehand
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 13) {
        if (rawEffect[3][2] == 0) {
            if (!item.singleWieldingOneHanded) {item.singleWieldingOneHanded = {}};
            addStat(item.singleWieldingOneHanded,"atk",rawEffect[3][0]);
        } else if (rawEffect[3][2] == 2) {
            if (!item.singleWielding) {item.singleWielding = {}};
            addStat(item.singleWielding,"atk",rawEffect[3][0]);
        }
        addStat(item,"accuracy",rawEffect[3][1]);
    } else if (rawEffect[0] == 1 && rawEffect[1] == 3 && rawEffect[2] == 10003) {
        var doublehandSkill = {};
        var doublehandEffect = rawEffect[3];
        if (doublehandEffect.length == 7 && doublehandEffect[6] == 1) {
            if (!item.singleWielding) {item.singleWielding = {}};
            doublehandSkill = item.singleWielding;
        } else {
            if (!item.singleWieldingOneHanded) {item.singleWieldingOneHanded = {}};
            doublehandSkill = item.singleWieldingOneHanded;
        }
        if (doublehandEffect[2]) {
            addStat(doublehandSkill, "atk", doublehandEffect[2]);
        }
        if (doublehandEffect[4]) {
            addStat(doublehandSkill, "def", doublehandEffect[4]);
        }
        if (doublehandEffect[3]) {
            addStat(doublehandSkill, "mag", doublehandEffect[3]);
        }
        if (doublehandEffect[5]) {
            addStat(doublehandSkill, "spr", doublehandEffect[5]);
        }
        if (doublehandEffect[0]) {
            addStat(doublehandSkill, "hp", doublehandEffect[0]);
        }
        if (doublehandEffect[1]) {
            addStat(doublehandSkill, "mp", doublehandEffect[1]);
        }

    // MP refresh
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 32) {
        var mpRefresh = rawEffect[3][0];
        addStat(item, "mpRefresh", mpRefresh);

    // LB/turn
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 33) {
        var lbPerTurn = rawEffect[3][0]/100;
        addLbPerTurn(item, lbPerTurn, lbPerTurn);
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 125) {
        var lbPerTurnMin = rawEffect[3][0]/100;
        var lbPerTurnMax = rawEffect[3][1]/100;
        addLbPerTurn(item, lbPerTurnMin, lbPerTurnMax);

    // LB fill rate
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 31) {
        var lbFillRate = rawEffect[3][0];
        addStat(item, "lbFillRate", lbFillRate);
        
    // +LB Damage
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 68) {
        var lbDamage = rawEffect[3][0];
        addStat(item, "lbDamage", lbDamage);

    // +Jump damage
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 17) {
        var jumpDamage = rawEffect[3][0];
        addStat(item, "jumpDamage", jumpDamage);

    // +EVO Mag
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 21) {
        var evoMag = rawEffect[3][0];
        addStat(item, "evoMag", evoMag);
        
    // +Stats from espers boost
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 63) {
        var esperStatsBonus = rawEffect[3];
        if (!item.esperStatsBonus) {
            item.esperStatsBonus = {};
        }
        addStat(item.esperStatsBonus, "hp", esperStatsBonus[0]);
        addStat(item.esperStatsBonus, "mp", esperStatsBonus[1]);
        addStat(item.esperStatsBonus, "atk", esperStatsBonus[2]);
        addStat(item.esperStatsBonus, "def", esperStatsBonus[3]);
        addStat(item.esperStatsBonus, "mag", esperStatsBonus[4]);
        addStat(item.esperStatsBonus, "spr", esperStatsBonus[5]);
      
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 6) {
        let mastery = rawEffect[3];
        if (!item.conditional) {
            item.conditional = [];
        }
        var conditionalSkill = {"equipedCondition":typeMap[mastery[0]]};
        addStat(conditionalSkill, "atk%", mastery[1]);
        addStat(conditionalSkill, "def%", mastery[2]);
        addStat(conditionalSkill, "mag%", mastery[3]);
        addStat(conditionalSkill, "spr%", mastery[4]);
        if (mastery.length >= 6) {
            addStat(conditionalSkill, "hp%", mastery[5]);
        }
        if (mastery.length >= 7) {
            addStat(conditionalSkill, "mp%", mastery[6]);
        }
        conditionalSkill.icon = skill.icon;
        item.conditional.push(conditionalSkill);
    } else {
        return false;
    }
    return true;
}

function addSpecial(item, special) {
    if (!item.special) {
        item.special = [];
    }
    item.special.push(special);
}

function addStat(item, stat, value) {
    if (value != 0) {
        if (!item[stat]) {
            item[stat] = 0;
        }
        item[stat] += value;
    }
}

function addKiller(item, raceId, physicalPercent, magicalPercent) {
    var race = raceMap[raceId];
    if (!item.killers) {
        item.killers = [];
    }
    var killer = {"name":race};
    if (physicalPercent) {
        killer.physical = physicalPercent;
    }
    if (magicalPercent) {
        killer.magical = magicalPercent;
    }
    item.killers.push(killer);
}

function getSkillString(skill) {
    var first = true;
    var effect = "";
    for (var effectIndex in skill.effects) {
        if (first) {
            first = false;
        } else {
            effect += ", ";
        }
        effect += skill.effects[effectIndex];
    }
    var result = "[" + skill.name;
    if (skill.icon) {
        result += "|" + skill.icon;
    }
    result += "]: " + effect;
    return result;
}

function addElementalResist(item, values) {
    if (!item.resist) {
        item.resist = [];
    }
    for (var index in elements) {
        if (values[index]) {
            item.resist.push({"name":elements[index],"percent":values[index]})
        }
    }
}

function addAilmentResist(item, values) {
    if (!item.resist) {
        item.resist = [];
    }
    for (var index in ailments) {
        if (values[index]) {
            item.resist.push({"name":ailments[index],"percent":values[index]})
        }
    }
}

function getResist(entry) {
    var obj = {};
    addElementalResist(obj, entry.element_resist);
    addAilmentResist(obj, entry.status_resist);
    if (obj.resist.length == 0) {
        return null;
    } else {
        return obj.resist;
    }
}

function addMastery(item, mastery) {
    if (!item.equipedConditions) {
        item.equipedConditions = [];
    }
    item.equipedConditions.push(typeMap[mastery[0]]);
    addStat(item, "atk%", mastery[1]);
    addStat(item, "def%", mastery[2]);
    addStat(item, "mag%", mastery[3]);
    addStat(item, "spr%", mastery[4]);
    if (mastery.length >= 6) {
        addStat(item, "hp%", mastery[5]);
    }
    if (mastery.length >= 7) {
        addStat(item, "mp%", mastery[6]);
    }
}

function addExclusiveUnit(item, unitId) {
    if (!item.exclusiveUnits) {
        item.exclusiveUnits = [];
    }
    if (typeof unitId == "number") {
        unitId = new String(unitId);
    }
    item.exclusiveUnits.push(unitId);
}

function isItemEmpty(item) {
    for (var index in stats) {
        if (item[stats[index].toLowerCase()]) {
            return false;
        }
        if (item[stats[index].toLowerCase() + "%"]) {
            return false;
        }
    }
    if (item.special) {
        for (var index in item.special) {
            if (item.special[index] != "twoHanded" && item.special[index] != "notStackable") {
                return false;
            }
        }
    }
    if (item.resist) {
        return false;
    }
    return true;
}

function addAccess(item, access) {
    if (!item.access) {
        item.access = [];
    }
    item.access.push(access);
}

function addLbPerTurn(item, min, max) {
    if (!item.lbPerTurn) {
        item.lbPerTurn = {"min":0, "max":0};
    }
    item.lbPerTurn.min += min;
    item.lbPerTurn.max += max;
}

function formatOutput(espers) {
    var result = "{\n";
    var first = true;
    Object.entries(espers).forEach(entry => {
        if (first) {
            first = false;
        } else {
            result += ",\n";
        }
        result += '"' + entry[0] + '":' + JSON.stringify(entry[1]);
    });
    result += "\n}";
    return result;
}
