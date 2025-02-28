const damageFormulaNames = ["physicalDamage","magicalDamage","hybridDamage","jumpDamage","magDamageWithPhysicalMechanism", "sprDamageWithPhysicalMechanism", "defDamageWithPhysicalMechanism", "magDamageWithPhysicalMechanismMultiCast", "sprDamageWithPhysicalMechanismMultiCast", "defDamageWithPhysicalMechanismMultiCast", "atkDamageWithMagicalMechanism", "atkDamageWithMagicalMechanismMulticast", "sprDamageWithMagicalMechanism", "atkDamageWithFixedMechanism", "physicalDamageMultiCast", "fixedDamageWithPhysicalMechanism","summonerSkillMAG/SPRMechanism","summonerSkillSPRMechanism", "summonerSkillMAGMechanism", "mpMagPhysicalDamage", "mpMagMagicalDamage", "mpSprPhysicalDamage","mpSprMagicalDamage"];
const operatorsInFormula = ["/","*","+","-","OR","AND",">"];
const weaponBaseDamageVariance =
    {
        "1h": {
            "dagger" : {"min":1.1,"avg":1.15,"max":1.2},
            "sword" : {"min":1.05,"avg":1.15,"max":1.25},
            "greatSword" : {"min":1,"avg":1.15,"max":1.3},
            "katana" : {"min":1.05,"avg":1.15,"max":1.25},
            "staff" : {"min":1.1,"avg":1.15,"max":1.2},
            "rod" : {"min":1.1,"avg":1.15,"max":1.2},
            "bow" : {"min":1.35,"avg":1.6,"max":1.85},
            "axe" : {"min":0.85,"avg":1.3,"max":1.45},
            "hammer" : {"min":0.95,"avg":1.3,"max":1.35},
            "spear" : {"min":1,"avg":1.3,"max":1.3},
            "harp" : {"min":1.05,"avg":1.15,"max":1.25},
            "whip" : {"min":1.05,"avg":1.15,"max":1.25},
            "throwing" : {"min":1.05,"avg":1.15,"max":1.25},
            "gun" : {"min":1.1,"avg":1.15,"max":1.2},
            "mace" : {"min":1.1,"avg":1.15,"max":1.2},
            "fist" : {"min":1.15,"avg":1.15,"max":1.15},
        },
        "2h": {
            "dagger" : {"min":1.1,"avg":1.15,"max":1.2},
            "sword" : {"min":1.25,"avg":1.5,"max":1.75},
            "greatSword" : {"min":1.25,"avg":1.5,"max":1.75},
            "katana" : {"min":1.25,"avg":1.5,"max":1.75},
            "staff" : {"min":1.1,"avg":1.15,"max":1.2},
            "rod" : {"min":1.25,"avg":1.5,"max":1.75},
            "bow" : {"min":1.35,"avg":1.6,"max":1.85},
            "axe" : {"min":1.15,"avg":1.55,"max":1.95},
            "hammer" : {"min":1.15,"avg":1.55,"max":1.95},
            "spear" : {"min":1.25,"avg":1.5,"max":1.75},
            "harp" : {"min":1.35,"avg":1.55,"max":1.75},
            "whip" : {"min":1.30,"avg":1.5,"max":1.70},
            "throwing" : {"min":1.30,"avg":1.5,"max":1.70},
            "gun" : {"min":1.35,"avg":1.55,"max":1.75},
            "mace" : {"min":1.4,"avg":1.5,"max":1.6},
            "fist" : {"min":1.4,"avg":1.55,"max":1.65},
        },
        "none": {"min":1,"avg":1,"max":1},
    }


const valuesToNotRoundDown = ["lbPerTurn", "chainMastery", "evoMag", "lbDamage"];

function getValue(item, valuePath, defaultValue = 0) {
    var value = item[valuePath];

    if (value === undefined) {
        if (valuePath.indexOf('.') > -1) {
            value = getValueFromPath(item, valuePath);
        } else {
            value = defaultValue;
        }
        item[valuePath] = value;
    }

    if (value && value.min && value.max) {
        value = (value.min + value.max) / 2;
    }

    return value;
}


function getValueFromPath(item, valuePath) {
    var pathTokens = valuePath.split(".");
    var currentItem = item;
    for (var index = 0, len = pathTokens.length; index < len; index++) {
        if (currentItem[pathTokens[index]]) {
            currentItem = currentItem[pathTokens[index]];
        } else if (pathTokens[index].indexOf('|') > -1) {
            var tmpToken = pathTokens[index].split("|");
            var property = tmpToken[0];
            var name = tmpToken[1];
            if (currentItem[property]) {
                for (var listIndex = currentItem[property].length; listIndex--;) {
                    if (currentItem[property][listIndex].name == name) {
                        currentItem = currentItem[property][listIndex];
                        break;
                    }
                }
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }
    return currentItem;
}

function isStackable(item) {
    return !(item.special && item.special.includes("notStackable"));
}

function isTwoHanded(item) {
    return (item && item.special && item.special.includes("twoHanded"));
}

function hasDualWieldOrPartialDualWield(item) {
    return hasDualWield(item) || item.partialDualWield;
}

function hasDualWield(item) {
    return item.special && item.special.includes("dualWield")
}

function calculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula, goalVariance, canSwitchWeapon = true, ignoreConditions = false) {
    // save initial bufs
    var atkBuff = unitBuild.baseValues.atk.buff;
    var defBuff = unitBuild.baseValues.def.buff;
    var magBuff = unitBuild.baseValues.mag.buff;
    var sprBuff = unitBuild.baseValues.spr.buff;
    var lbDamageBuff = unitBuild.baseValues.lbDamage;
    var result = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, EnemyStats.copy(enemyStats), formula, goalVariance, canSwitchWeapon, ignoreConditions);
    // restore initial buffs
    unitBuild.baseValues.atk.buff = atkBuff;
    unitBuild.baseValues.def.buff = defBuff;
    unitBuild.baseValues.mag.buff = magBuff;
    unitBuild.baseValues.spr.buff = sprBuff;
    unitBuild.baseValues.lbDamage = lbDamageBuff;
    return result;
}

function innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula, goalVariance, canSwitchWeapon, ignoreConditions, context) {
    if (!context) {
        context = {
            "alreadyCalculatedValues" : {},
            "remainingLeftHandAttacks" : [],
            "skillEnhancement" : {},
            "imbues": unitBuild.innateElements.slice(),
            "savedValues" : {
                "killerMultiplicator": {}
            },
            "stack": {
                "currentStack":unitBuild.baseValues.currentStack,
                "lastStackingSkillId":"any"
            },
            "killerBuff":{}
        }
        for (var i = 0; i < itemAndPassives.length; i++) {
            if (itemAndPassives[i] && itemAndPassives[i].skillEnhancement) {
                var skills = Object.keys(itemAndPassives[i].skillEnhancement);
                for (var j = skills.length; j--;) {
                    if (!context.skillEnhancement[skills[j]]) {
                        context.skillEnhancement[skills[j]] = itemAndPassives[i].skillEnhancement[skills[j]];
                    } else {
                        context.skillEnhancement[skills[j]] += itemAndPassives[i].skillEnhancement[skills[j]];
                    }
                }
            }
        }
        if (unitBuild.baseValues.killerBuffs && unitBuild.baseValues.killerBuffs.length) {
            unitBuild.baseValues.killerBuffs.forEach(killerData => {
                if (killerData.physical)  {
                    if (!context.killerBuff.physical) context.killerBuff.physical = {};
                    context.killerBuff.physical[killerData.name] = killerData.physical;
                }
                if (killerData.magical)  {
                    if (!context.killerBuff.magical) context.killerBuff.magical = {};
                    context.killerBuff.magical[killerData.name] = killerData.magical;
                }
            });
        }
        // Level correction (1+(level/100)) and final multiplier (between 85% and 100%, so 92.5% mean)
        var level;
        if (unitBuild.level) {
            level = unitBuild.level;
        } else {
            if (unitBuild.unit.sixStarForm) {
                level = 100;
            } else {
                level = (unitBuild.unit.max_rarity - 1) * 20;
            }
        }
        var levelCorrection = (1 + (level/100));
        context.damageMultiplier = {
            "min": levelCorrection * 0.85,
            "avg": levelCorrection * 0.925,
            "max": levelCorrection
        }
    }
    if (formula.type == "multicast") {
        context.multicast = true;
        var result = {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        }
        for (var i = 0, len = formula.skills.length; i < len; i++) {
            var skillValue = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.skills[i], goalVariance, canSwitchWeapon, ignoreConditions, context);
            result.min += skillValue.min;
            result.avg += skillValue.avg;
            result.max += skillValue.max;
            result.switchWeapons |= skillValue.switchWeapons;
        }
        delete context.multicast;
        return result;
    } else if (formula.type == "skill") {
        context.currentSkill = formula.id;
        context.isLb = !!formula.lb;
        var result = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.value, goalVariance, canSwitchWeapon, ignoreConditions, context);
        if (!formula.preventDualCastWithDualWield && context.remainingLeftHandAttacks && context.remainingLeftHandAttacks.length > 0) {
            context.treatingLeftHandAttacks = true;
            for (var i = 0, len = context.remainingLeftHandAttacks.length; i < len; i++) {
                var leftHandAttackResult = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, context.remainingLeftHandAttacks[i], goalVariance, canSwitchWeapon, ignoreConditions, context);
                result.min += leftHandAttackResult.min;
                result.avg += leftHandAttackResult.avg;
                result.max += leftHandAttackResult.max;
            }
        }
        context.treatingLeftHandAttacks = false;
        context.remainingLeftHandAttacks = [];
        context.currentSkill = null;
        context.isLb = false;
        return result;
    } else if (formula.type == "damage") {

        var applicableKillerType = null;

        if (!context.savedValues.hasOwnProperty("resistModifier")) {
            var elements = context.imbues;
            if (formula.value.elements) {
                for (var elementIndex = formula.value.elements.length; elementIndex--;) {
                    if (!elements.includes(formula.value.elements[elementIndex])) {
                        elements.push(formula.value.elements[elementIndex]);
                    }
                }
            };
        }

        var variance = {
            "min": 1,
            "avg": 1,
            "max": 1
        };

        if (itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type)) {
            if (itemAndPassives[0].damageVariance) {
                variance = itemAndPassives[0].damageVariance;
            } else {
                variance = weaponBaseDamageVariance[isTwoHanded(itemAndPassives[0]) ? '2h' : '1h'][itemAndPassives[0].type];
            }
        }  else {
            variance = weaponBaseDamageVariance["none"];
        }
        if (unitBuild.involvedStats.includes("jumpDamage") && (isTwoHanded(itemAndPassives[0]) || isTwoHanded(itemAndPassives[1]))) {
            // variance override for two handed weapons and jumps
            variance = {"min":2.5,"avg":2.65,"max":2.8};
        }

        var switchWeapons = false;
        if (canSwitchWeapon && goalVariance && dualWielding) {
            var variance1;
            if (itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
                if (itemAndPassives[1].damageVariance) {
                    variance1 = itemAndPassives[1].damageVariance;
                } else {
                    variance1 = weaponBaseDamageVariance[isTwoHanded(itemAndPassives[1]) ? '2h' : '1h'][itemAndPassives[1].type];
                }
            }  else {
                variance1 = weaponBaseDamageVariance["none"];
            }

            switchWeapons = canSwitchWeapon && ((variance[goalVariance] < variance1[goalVariance]) || (stat == "atk" && (variance[goalVariance] == variance1[goalVariance]) && itemAndPassives[0].atk > itemAndPassives[1].atk));
            if (context.multicast) {
                // in normal DW, we want the strongest attack to be the second on-e. In multicast, it's the contrary
                switchWeapons = !switchWeapons
            }
            if (switchWeapons) {
                variance = variance1;
            }
        }

        var statValueToUse = 0;
        var defendingStat = 1;

        var dualWielding = itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type) && itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type);
        var coef = formula.value.coef;

        if (formula.value.mechanism == "physical" || formula.value.mechanism == "hybrid") {
            applicableKillerType = "physical";

            if (!context.savedValues.hasOwnProperty("resistModifier")) {
                // Takes elements from weapons into account
                if (itemAndPassives[0] && itemAndPassives[0].element) {
                    for (var elementIndex = itemAndPassives[0].element.length; elementIndex--;) {
                        if (!elements.includes(itemAndPassives[0].element[elementIndex])) {
                            elements.push(itemAndPassives[0].element[elementIndex]);
                        }
                    }
                };
                if (itemAndPassives[1] && itemAndPassives[1].element) {
                    for (var elementIndex = itemAndPassives[1].element.length; elementIndex--;) {
                        if (!elements.includes(itemAndPassives[1].element[elementIndex])) {
                            elements.push(itemAndPassives[1].element[elementIndex]);
                        }
                    }
                };
            }

            if (formula.value.damageType == "body" || formula.value.mechanism == "hybrid") {
                defendingStat = "def";

                var stat = "atk";
                if (formula.value.use) {
                    stat = formula.value.use.stat;
                }

                var calculatedValue = getStatCalculatedValue(context, itemAndPassives, stat, unitBuild);

                if (stat == "atk") {
                    if (switchWeapons ? !context.treatingLeftHandAttacks: context.treatingLeftHandAttacks) {
                        // if not switching weapon and treating second attack, or switching weapon and treating first attack, use left hand value
                        statValueToUse = calculatedValue.left;
                    } else {
                        // else use right hand value
                        statValueToUse = calculatedValue.right;
                    }
                } else {
                    statValueToUse = calculatedValue.total;
                }
            } else {
                defendingStat = "spr";
                if (formula.value.use) {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, formula.value.use.stat, unitBuild).total;
                } else {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total;
                }
            }

            if (dualWielding && !context.isLb && !context.multicast && (!formula.value.delay || formula.value.jump)) {
                // Plan for the left hand attack to be calculated later
                context.remainingLeftHandAttacks.push(formula);
            }

        } else if (formula.value.mechanism == "magical") {
            applicableKillerType = "magical";
            if (formula.value.damageType == "mind") {
                defendingStat = "spr";

                if (formula.value.use) {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, formula.value.use.stat, unitBuild).total;
                    if (formula.value.use.percent) {
                        statValueToUse *= formula.value.use.percent / 100;
                    }
                    if (formula.value.use.max) {
                        if (statValueToUse > formula.value.use.max) {
                            statValueToUse = max;
                        }
                    }
                } else {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total;
                }
            } else {
                defendingStat = "def";
                statValueToUse = getStatCalculatedValue(context, itemAndPassives, "atk", unitBuild).right;
            }
        } else if(formula.value.mechanism == "summonerSkillMAG/SPRMechanism" || formula.value.mechanism == "summonerSkillMAGMechanism" || formula.value.mechanism == "summonerSkillSPRMechanism" ){
            defendingStat= "spr";
            coef = formula.value.magCoef > formula.value.sprCoef ? formula.value.magCoef: formula.value.sprCoef;
            if (formula.value.magCoef > formula.value.sprCoef) {
                if (formula.value.use) {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, formula.value.use.stat, unitBuild).total;
                } else {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total;
                }
            } else if  (formula.value.magCoef < formula.value.sprCoef){
                if (formula.value.use) {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, formula.value.use.stat, unitBuild).total;
                } else {
                    statValueToUse = getStatCalculatedValue(context, itemAndPassives, "spr", unitBuild).total;
                }
            } else {
                statValueToUse = 0;
            }
        } else if(formula.value.mechanism == "mpMagPhysicalDamage"){
            applicableKillerType = "physical";
            defendingStat = "spr";
            coef = formula.value.mpCoef;
            statValueToUse = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total
        } else if(formula.value.mechanism == "mpMagMagicalDamage"){
            applicableKillerType = "magical";
            defendingStat = "spr";
            coef = formula.value.mpCoef;
            statValueToUse = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total
        } else if(formula.value.mechanism == "mpSprPhysicalDamage"){
            applicableKillerType = "physical";
            defendingStat = "spr";
            coef = formula.value.mpCoef;
            statValueToUse = getStatCalculatedValue(context, itemAndPassives, "spr", unitBuild).total
        } else if(formula.value.mechanism == "mpSprMagicalDamage"){
            applicableKillerType = "magical";
            defendingStat = "spr";
            coef = formula.value.mpCoef;
            statValueToUse = getStatCalculatedValue(context, itemAndPassives, "spr", unitBuild).total
        }
        // Killer
        var killerMultiplicator = 1;
        if (applicableKillerType && enemyStats.races.length > 0) {
            if (context.savedValues.killerMultiplicator.hasOwnProperty(applicableKillerType)) {
                killerMultiplicator = context.savedValues.killerMultiplicator[applicableKillerType];
            } else {
                var cumulatedKillerByRace = {'aquatic':0,'beast':0,'bird':0,'bug':0,'demon':0,'dragon':0,'human':0,'machine':0,'plant':0,'undead':0,'stone':0,'spirit':0};
                var cumulatedKiller = 0;
                for (var equipedIndex = itemAndPassives.length; equipedIndex--;) {
                    if (itemAndPassives[equipedIndex] && itemAndPassives[equipedIndex].killers) {
                        for (var killerIndex = itemAndPassives[equipedIndex].killers.length; killerIndex--;) {
                            var killer = itemAndPassives[equipedIndex].killers[killerIndex];
                            if (enemyStats.races.includes(killer.name) && killer[applicableKillerType]) {
                                cumulatedKillerByRace[killer.name] = Math.min(300, cumulatedKillerByRace[killer.name] + killer[applicableKillerType]);
                            }
                        }
                    }
                }
                if (context.killerBuff && context.killerBuff[applicableKillerType]) {
                    for (var raceIndex = enemyStats.races.length; raceIndex--;) {
                        if (context.killerBuff[applicableKillerType][enemyStats.races[raceIndex]]) {
                            cumulatedKillerByRace[enemyStats.races[raceIndex]] += context.killerBuff[applicableKillerType][enemyStats.races[raceIndex]];
                        }
                    }
                }
                if (enemyStats.races.length > 0) {
                    for (var raceIndex = enemyStats.races.length; raceIndex--;) {
                        cumulatedKiller += cumulatedKillerByRace[enemyStats.races[raceIndex]];
                    }
                }
                if (enemyStats.races.length > 0) {
                    killerMultiplicator += (cumulatedKiller / 100) / enemyStats.races.length;
                }
                context.savedValues.killerMultiplicator[applicableKillerType] = killerMultiplicator;
            }
        }

        // Element weakness/resistance
        var resistModifier;
        if (context.savedValues.hasOwnProperty("resistModifier")) {
            resistModifier = context.savedValues.resistModifier;
        } else {
            resistModifier = Math.max(1 - getElementCoef(elements, enemyStats), 0);
            context.savedValues.resistModifier = resistModifier;
        }

        let weaponImperilCoef;
        if (context.savedValues.hasOwnProperty("weaponImperilCoef")) {
            weaponImperilCoef = context.savedValues.weaponImperilCoef;
        } else {
            weaponImperilCoef = getWeaponImperilCoef(itemAndPassives[0], itemAndPassives[1], enemyStats);
            context.savedValues.weaponImperilCoef = weaponImperilCoef;
        }


        let elementBoostModifier;
        if (context.savedValues.hasOwnProperty("elementBoostModifier")) {
            elementBoostModifier = context.savedValues.elementBoostModifier;
        } else {
            if (elements.length) {
                elementBoostModifier = 1 + elements.map(e => unitBuild.baseValues.elementBuffs[e] || 0).reduce((acc, value) => acc + value, 0)/ 100 / elements.length;
            } else {
                elementBoostModifier = 1;
            }
            context.savedValues.elementBoostModifier = elementBoostModifier;
        }



        var jumpMultiplier = 1;
        if (formula.value.jump) {
            jumpMultiplier += getStatCalculatedValue(context, itemAndPassives, "jumpDamage", unitBuild).total/100;
        }


        if (formula.value.ifUsedAgain && enemyStats.races.includes(formula.value.ifUsedAgain.race)) {
            coef = formula.value.ifUsedAgain.coef;
        }
        if (context.currentSkill && context.skillEnhancement[context.currentSkill]) {
            coef += context.skillEnhancement[context.currentSkill];
        }
        if (context.currentSkill && context.skillEnhancement["allMagicalAttacks"] && formula.value.mechanism == "magical") {
            coef += context.skillEnhancement["allMagicalAttacks"];
        }
        if (context.currentSkill && context.skillEnhancement["allPhysicalAttacks"] && formula.value.mechanism == "physical") {
            
            coef += context.skillEnhancement["allPhysicalAttacks"];
        }
        if (context.currentSkill && context.skillEnhancement["jumpDamage"] && formula.value.mechanism == "physical") {
            coef += context.skillEnhancement["jumpDamage"];
        }

        if (formula.value.stack) {
            if (context.stack.lastStackingSkillId != "any" && context.stack.lastStackingSkillId != context.currentSkill) {
                context.stack.lastStackingSkillId == "any";
                context.stack.currentStack = 0;
            }
            coef += formula.value.stack * context.stack.currentStack;
            if (context.stack.currentStack < formula.value.maxStack) {
                context.stack.currentStack++;
                context.stack.lastStackingSkillId = context.currentSkill;
            }
        }

        var lbMultiplier = 1;
        if (context.isLb) {
            lbMultiplier += getStatCalculatedValue(context, itemAndPassives, "lbDamage", unitBuild).total/100;
        }

        var chainMult;
        chainMult += getStatCalculatedValue(context, itemAndPassives, "chainMastery", unitBuild).total / 100;

        var evoMagMultiplier = 1;
        if (unitBuild.involvedStats.includes("evoMag")) {
            evoMagMultiplier += getStatCalculatedValue(context, itemAndPassives, "evoMag", unitBuild).total/100;
        }
        var evokeDamageBoostMultiplier = 1;
        if (unitBuild.involvedStats.includes("evokeDamageBoost.all")) {
            evokeDamageBoostMultiplier += getStatCalculatedValue(context, itemAndPassives, "evokeDamageBoost.all", unitBuild).total/100;
        }

        var defendingStatValue = enemyStats[defendingStat];
        if (formula.value.ignore && formula.value.ignore[defendingStat]) {
            defendingStatValue = defendingStatValue * (1 - formula.value.ignore[defendingStat]/100);
        }

        var baseDamage = coef
            * (statValueToUse * statValueToUse)
            * evoMagMultiplier
            * evokeDamageBoostMultiplier
            * resistModifier
            * weaponImperilCoef
            * elementBoostModifier
            * killerMultiplicator
            * jumpMultiplier
            * lbMultiplier
            / (defendingStatValue  * (1 + (enemyStats.buffs[defendingStat] - enemyStats.breaks[defendingStat]) / 100));

            result = {
                "min": baseDamage * context.damageMultiplier.min * variance.min,
                "avg": baseDamage * context.damageMultiplier.avg * variance.avg,
                "max": baseDamage * context.damageMultiplier.max * variance.max,
                "switchWeapons": switchWeapons
            }
        
        if (formula.value.mechanism == "hybrid") {
            var magStat = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total;
            var magDamage = coef
                * (magStat * magStat)
                * evoMagMultiplier
                * evokeDamageBoostMultiplier
                * resistModifier
                * weaponImperilCoef
                * elementBoostModifier
                * killerMultiplicator
                * jumpMultiplier
                * lbMultiplier
                / (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));

            result = {
                "min": (baseDamage + magDamage) * context.damageMultiplier.min * variance.min / 2,
                "avg": (baseDamage + magDamage) * context.damageMultiplier.avg * variance.avg / 2,
                "max": (baseDamage + magDamage) * context.damageMultiplier.max * variance.max / 2,
                "switchWeapons": switchWeapons
            }
        } else if(formula.value.mechanism == "summonerSkillMAG/SPRMechanism" || formula.value.mechanism == "summonerSkillMAGMechanism" || formula.value.mechanism == "summonerSkillSPRMechanism"){
            if (formula.value.sprSplit > 0) {
                var sprStat = getStatCalculatedValue(context, itemAndPassives, "spr", unitBuild).total;
                var sprDamage =
                    ((formula.value.sprCoef * formula.value.sprSplit) + (formula.value.magCoef * formula.value.magSplit))
                    * (sprStat * sprStat)
                    * evoMagMultiplier
                    * evokeDamageBoostMultiplier
                    * resistModifier
                    * weaponImperilCoef
                    * elementBoostModifier
                    * lbMultiplier
                    / (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));
            } else {
                sprDamage = 0;
            }
            result = {
                "min" : (formula.value.magSplit * baseDamage + formula.value.sprSplit * sprDamage) * context.damageMultiplier.min * variance.min,
                "avg" : (formula.value.magSplit * baseDamage + formula.value.sprSplit * sprDamage) * context.damageMultiplier.avg * variance.avg,
                "max" : (formula.value.magSplit * baseDamage + formula.value.sprSplit * sprDamage) * context.damageMultiplier.max * variance.max,
                "switchWeapons" : switchWeapons
            }
            return result;
        } else if(formula.value.mechanism == "mpMagPhysicalDamage") {
            let magStat = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total;
            let mpStat = getStatCalculatedValue(context, itemAndPassives, "mp", unitBuild).total
            let totalCoef = (coef * mpStat)
            var magDamage =
            (totalCoef)
            * (magStat * magStat)
            * resistModifier
            * weaponImperilCoef
            * elementBoostModifier
            * jumpMultiplier
            * lbMultiplier
            * killerMultiplicator
            / (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));
            
            result = {
                "min": (baseDamage + magDamage) * context.damageMultiplier.min * variance.min,
                "avg": (baseDamage + magDamage) * context.damageMultiplier.avg * variance.avg,
                "max": (baseDamage + magDamage) * context.damageMultiplier.max * variance.max,
                "switchWeapons": switchWeapons
            }
        } else if(formula.value.mechanism == "mpMagMagicalDamage") {
            let magStat = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total;
            let mpStat = getStatCalculatedValue(context, itemAndPassives, "mp", unitBuild).total
            let totalCoef = (coef * mpStat)
            var magDamage =
            (totalCoef)
            * (magStat * magStat)
            * resistModifier
            * weaponImperilCoef
            * elementBoostModifier
            * jumpMultiplier
            * lbMultiplier
            * killerMultiplicator
            / (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));

            result = {
                "min": (baseDamage + magDamage) * context.damageMultiplier.min * variance.min,
                "avg": (baseDamage + magDamage) * context.damageMultiplier.avg * variance.avg,
                "max": (baseDamage + magDamage) * context.damageMultiplier.max * variance.max,
                "switchWeapons": switchWeapons
            }
        } else if(formula.value.mechanism == "mpSprPhysicalDamage") {
            let sprStat = getStatCalculatedValue(context, itemAndPassives, "spr", unitBuild).total;
            let mpStat = getStatCalculatedValue(context, itemAndPassives, "mp", unitBuild).total
            let totalCoef = (coef * mpStat )
            var sprDamage =
            (totalCoef)
            * (sprStat * sprStat)
            * resistModifier
            * weaponImperilCoef
            * elementBoostModifier
            * jumpMultiplier
            * lbMultiplier
            * killerMultiplicator
            / (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));

            result = {
                "min": (baseDamage + sprDamage) * context.damageMultiplier.min * variance.min,
                "avg": (baseDamage + sprDamage) * context.damageMultiplier.avg * variance.avg,
                "max": (baseDamage + sprDamage) * context.damageMultiplier.max * variance.max,
                "switchWeapons": switchWeapons
            }
        } else if(formula.value.mechanism == "mpSprMagicalDamage") {
            let sprStat = getStatCalculatedValue(context, itemAndPassives, "spr", unitBuild).total;
            let mpStat = getStatCalculatedValue(context, itemAndPassives, "mp", unitBuild).total
            let totalCoef = (coef * mpStat )
            var sprDamage =
            (totalCoef)
            * (sprStat * sprStat)
            * resistModifier
            * weaponImperilCoef
            * elementBoostModifier
            * jumpMultiplier
            * lbMultiplier
            * killerMultiplicator
            / (enemyStats.spr * (1 + (enemyStats.buffs.spr - enemyStats.breaks.spr) / 100));

            result = {
                "min": (baseDamage + sprDamage) * context.damageMultiplier.min * variance.min,
                "avg": (baseDamage + sprDamage) * context.damageMultiplier.avg * variance.avg,
                "max": (baseDamage + sprDamage) * context.damageMultiplier.max * variance.max,
                "switchWeapons": switchWeapons
            }
        }
        return result;
    } else if (formula.type == "value") {
        if (context.alreadyCalculatedValues[formula.name]) {
            return context.alreadyCalculatedValues[formula.name];
        }
        if (damageFormulaNames.includes(formula.name)) {
            var cumulatedKillerByRace = {
                'aquatic': 0,
                'beast': 0,
                'bird': 0,
                'bug': 0,
                'demon': 0,
                'dragon': 0,
                'human': 0,
                'machine': 0,
                'plant': 0,
                'undead': 0,
                'stone': 0,
                'spirit': 0
            };
            var cumulatedKiller = 0;
            var applicableKillerType = null;
            if (unitBuild.involvedStats.includes("physicalKiller")) {
                applicableKillerType = "physical";
            } else if (unitBuild.involvedStats.includes("magicalKiller")) {
                applicableKillerType = "magical";
            }
            if (applicableKillerType) {
                for (var equipedIndex = itemAndPassives.length; equipedIndex--;) {
                    if (itemAndPassives[equipedIndex] && enemyStats.races.length > 0 && itemAndPassives[equipedIndex].killers) {
                        for (var killerIndex = itemAndPassives[equipedIndex].killers.length; killerIndex--;) {
                            var killer = itemAndPassives[equipedIndex].killers[killerIndex];
                            if (enemyStats.races.includes(killer.name) && killer[applicableKillerType]) {
                                cumulatedKillerByRace[killer.name] = Math.min(300, cumulatedKillerByRace[killer.name] + killer[applicableKillerType]);

                            }
                        }
                    }
                }
                if (enemyStats.races.length > 0) {
                    for (var raceIndex = enemyStats.races.length; raceIndex--;) {
                        cumulatedKiller += cumulatedKillerByRace[enemyStats.races[raceIndex]];
                    }
                }
            }

            // Element weakness/resistance
            var elements = unitBuild.innateElements.slice();
            if (unitBuild.involvedStats.includes("weaponElement")) {
                if (itemAndPassives[0] && itemAndPassives[0].element) {
                    for (var elementIndex = itemAndPassives[0].element.length; elementIndex--;) {
                        if (!elements.includes(itemAndPassives[0].element[elementIndex])) {
                            elements.push(itemAndPassives[0].element[elementIndex]);
                        }
                    }
                }
                ;
                if (itemAndPassives[1] && itemAndPassives[1].element) {
                    for (var elementIndex = itemAndPassives[1].element.length; elementIndex--;) {
                        if (!elements.includes(itemAndPassives[1].element[elementIndex])) {
                            elements.push(itemAndPassives[1].element[elementIndex]);
                        }
                    }
                }
                ;
            }
            var resistModifier = getElementCoef(elements, enemyStats);

            let elementBoostModifier;
            if (elements.length) {
                elementBoostModifier = 1 + elements.map(e => unitBuild.baseValues.elementBuffs[e] || 0).reduce((acc, value) => acc + value, 0) / elements.length;
            } else {
                elementBoostModifier = 1;
            }

            // Killers
            var killerMultiplicator = 1;
            if (enemyStats.races.length > 0) {
                killerMultiplicator += (cumulatedKiller / 100) / enemyStats.races.length;
            }

            var jumpMultiplier = 1;
            if (unitBuild.involvedStats.includes("jumpDamage")) {
                jumpMultiplier += calculateStatValue(itemAndPassives, "jumpDamage", unitBuild).total / 100;
            }

            var evoMagMultiplier = 1;
            if (unitBuild.involvedStats.includes("evoMag")) {
                evoMagMultiplier += calculateStatValue(itemAndPassives, "evoMag", unitBuild).total / 100;
            }
            var evokeDamageBoostMultiplier = 1;
            if (unitBuild.involvedStats.includes("evokeDamageBoost.all")) {
                evokeDamageBoostMultiplier += getStatCalculatedValue(context, itemAndPassives, "evokeDamageBoost.all", unitBuild).total / 100;
            }

            let lbMultiplier = 1;
            if (formula.lb) {
                lbMultiplier += getStatCalculatedValue(context, itemAndPassives, "lbDamage", unitBuild).total / 100;
            }

            // Level correction (1+(level/100)) and final multiplier (between 85% and 100%, so 92.5% mean)
            var level;
            if (unitBuild.level) {
                level = unitBuild.level;
            } else {
                if (unitBuild.unit.sixStarForm) {
                    level = 100;
                } else {
                    level = (unitBuild.unit.max_rarity - 1) * 20;
                }
            }
            var levelCorrection = (1 + (level / 100));
            var damageMultiplier = {
                "min": levelCorrection * 0.85,
                "avg": levelCorrection * 0.925,
                "max": levelCorrection
            }

            var total = {
                "min": 0,
                "avg": 0,
                "max": 0,
                "switchWeapons": false
            };
            var value;
            if (formula.name == "fixedDamageWithPhysicalMechanism") {
                var damage = 1000 * (1 - resistModifier) * killerMultiplicator
                value = {
                    "min": damage,
                    "avg": damage,
                    "max": damage,
                    "switchWeapons": false
                }
            } else {
                for (var statIndex = goalValuesCaract[formula.name].statsToMaximize.length; statIndex--;) {
                    var stat = goalValuesCaract[formula.name].statsToMaximize[statIndex];
                    var calculatedValue = calculateStatValue(itemAndPassives, stat, unitBuild, context.berserk);

                    if ("atk" == stat || "def" == stat) {
                        var variance;
                        var switchWeapons = false;
                        if (itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type)) {
                            if (itemAndPassives[0].damageVariance) {
                                variance = itemAndPassives[0].damageVariance;
                            } else {
                                variance = weaponBaseDamageVariance[isTwoHanded(itemAndPassives[0]) ? '2h' : '1h'][itemAndPassives[0].type];
                            }
                        } else {
                            variance = weaponBaseDamageVariance["none"];
                        }
                        if (unitBuild.involvedStats.includes("jumpDamage") && (isTwoHanded(itemAndPassives[0]) || isTwoHanded(itemAndPassives[1]))) {
                            // variance override for two handed weapons and jumps
                            variance = {"min":2.3,"avg":2.45,"max":2.6};
                        }

                        if (goalVariance &&
                            itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type) &&
                            itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
                            var variance1;
                            if (itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
                                if (itemAndPassives[1].damageVariance) {
                                    variance1 = itemAndPassives[1].damageVariance;
                                } else {
                                    variance1 = weaponBaseDamageVariance[isTwoHanded(itemAndPassives[1]) ? '2h' : '1h'][itemAndPassives[1].type];
                                }
                            } else {
                                variance1 = weaponBaseDamageVariance["none"];
                            }

                            if (goalValuesCaract[formula.name].type == "none" || formula.name == "physicalDamageMultiCast") {
                                switchWeapons = canSwitchWeapon && ((calculatedValue.right * calculatedValue.right * variance[goalVariance]) < (calculatedValue.left * calculatedValue.left * variance1[goalVariance]));
                                if (switchWeapons) {
                                    variance = variance1;
                                    calculatedValue.right = calculatedValue.left;
                                }
                                calculatedValue.left = 0;
                            } else {
                                switchWeapons = canSwitchWeapon && ((variance[goalVariance] < variance1[goalVariance]) || (stat == "atk" && (variance[goalVariance] == variance1[goalVariance]) && itemAndPassives[0].atk > itemAndPassives[1].atk));
                                if (switchWeapons) {
                                    variance = variance1;
                                    var tmp = calculatedValue.left;
                                    calculatedValue.left = calculatedValue.right;
                                    calculatedValue.right = tmp;
                                }
                            }
                        } else {
                            if (goalValuesCaract[formula.name].type == "none" || formula.name == "physicalDamageMultiCast") {
                                calculatedValue.left = 0;
                            }
                        }
                        
                        var enemyResistanceStat = enemyStats.def * (1 - enemyStats.breaks.def / 100);
                        let base = (calculatedValue.right * calculatedValue.right + calculatedValue.left * calculatedValue.left) * (1 - resistModifier) * killerMultiplicator * jumpMultiplier * lbMultiplier / enemyResistanceStat;
                        total.min += base * damageMultiplier.min * variance.min;
                        total.avg += base * damageMultiplier.avg * variance.avg;
                        total.max += base * damageMultiplier.max * variance.max;
                        total.switchWeapons = total.switchWeapons || switchWeapons;
                    } else {
                        var enemyResistanceStat = enemyStats.spr * (1 - enemyStats.breaks.spr / 100);
                        var dualWieldCoef = 1;
                        if (goalValuesCaract[formula.name].type == "physical" && !goalValuesCaract[formula.name].multicast && itemAndPassives[0] && itemAndPassives[1] && weaponList.includes(itemAndPassives[0].type) && weaponList.includes(itemAndPassives[1].type)) {
                            dualWieldCoef = 2;
                        }
                        var base = (calculatedValue.total * calculatedValue.total) * (1 - resistModifier) * elementBoostModifier * killerMultiplicator * dualWieldCoef * jumpMultiplier * evoMagMultiplier * evokeDamageBoostMultiplier * lbMultiplier / enemyResistanceStat;
                        total.min += base * damageMultiplier.min;
                        total.avg += base * damageMultiplier.avg;
                        total.max += base * damageMultiplier.max;
                    }
                }
                value = {
                    "min": total.min / goalValuesCaract[formula.name].statsToMaximize.length,
                    "avg": total.avg / goalValuesCaract[formula.name].statsToMaximize.length,
                    "max": total.max / goalValuesCaract[formula.name].statsToMaximize.length,
                    "switchWeapons": total.switchWeapons
                }
            }
            context.alreadyCalculatedValues[formula.name] = value;
            return value
        } else if (formula.name === 'monsterDamage') {
            return calculateMonsterDamage(enemyStats.monsterAttack, itemAndPassives, unitBuild, enemyStats, context)
        } else {
            var value = calculateStatValue(itemAndPassives, formula.name, unitBuild, context.berserk).total;
            if (formula.name == "mpRefresh") {
                value /= 100;
            }
            var result = {
                "min": value,
                "avg": value,
                "max": value,
                "switchWeapons": false
            }
            context.alreadyCalculatedValues[formula.name] = result;
            return result;
        }
    } else if(formula.type=="heal"){
        var sprStat=getStatCalculatedValue(context, itemAndPassives,"spr", unitBuild).total/2;
        var magStat = getStatCalculatedValue(context, itemAndPassives, "mag", unitBuild).total/10;
        var coef=formula.value.coef;
        result=formula.value.split ? {
            "min":(formula.value.base/formula.value.split)+((sprStat+magStat)*(coef/formula.value.split))*.85,
            "avg":(formula.value.base/formula.value.split)+((sprStat+magStat)*(coef/formula.value.split))*.925,
            "max":(formula.value.base/formula.value.split)+((sprStat+magStat)*(coef/formula.value.split)),
            "switchWeapons":false
        } : {
            "min":formula.value.base+((sprStat+magStat)*coef)*.85,
            "avg":formula.value.base+((sprStat+magStat)*coef)*.925,
            "max":formula.value.base+((sprStat+magStat)*coef),
            "switchWeapons":false
        }
        return result;
    } else if (formula.type == "constant") {
        return {
            "min": formula.value,
            "avg": formula.value,
            "max": formula.value,
            "switchWeapons": false
        };
    } else if (formula.type == "chainMultiplier") {
        if (formula.value === 'MAX') {
            let chainMult = getChainMult(unitBuild, itemAndPassives);
            return {
                "min": chainMult,
                "avg": chainMult,
                "max": chainMult,
                "switchWeapons": false
            };
        } else {
            return {
                "min": formula.value,
                "avg": formula.value,
                "max": formula.value,
                "switchWeapons": false
            };
        }
    } else if (operatorsInFormula.includes(formula.type)) {
        var result1 = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.value1, goalVariance, canSwitchWeapon, ignoreConditions, context);
        if (formula.type == "OR") {
            if (result1) {
                return true;
            } else {
                return innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.value2, goalVariance, canSwitchWeapon, ignoreConditions, context);
            }
        } else if (formula.type == "AND") {
            if (result1) {
                return innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.value2, goalVariance, canSwitchWeapon, ignoreConditions, context);
            } else {
                return false;
            }
        } else {
            var result2 = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.value2, goalVariance, canSwitchWeapon, ignoreConditions, context);
            if (formula.type == "*") {
                return {
                    "min": result1.min * result2.min,
                    "avg": result1.avg * result2.avg,
                    "max": result1.max * result2.max,
                    "switchWeapons": result1.switchWeapons || result2.switchWeapons
                };
            } else if (formula.type == "+") {
                return {
                    "min": result1.min + result2.min,
                    "avg": result1.avg + result2.avg,
                    "max": result1.max + result2.max,
                    "switchWeapons": result1.switchWeapons || result2.switchWeapons
                };
            } else if (formula.type == "/") {
                return {
                    "min": result1.min / (result2.max == 0 ? 0.00001 : result2.max),
                    "avg": result1.avg / (result2.avg == 0 ? 0.00001 : result2.avg),
                    "max": result1.max / (result2.min == 0 ? 0.00001 : result2.min),
                    "switchWeapons": result1.switchWeapons || result2.switchWeapons
                };
            } else if (formula.type == "-") {
                return {
                    "min": result1.min - result2.max,
                    "avg": result1.avg - result2.avg,
                    "max": result1.max - result2.min,
                    "switchWeapons": result1.switchWeapons || result2.switchWeapons
                };
            } else if (formula.type == ">") {
                return result1[goalVariance] >= result2[goalVariance];
            }
        }
    } else if (formula.type == "imperil") {
        var imperiledElements = Object.keys(formula.value);
        for (var i = imperiledElements.length; i--;) {
            var element = imperiledElements[i];
            if (enemyStats.imperils[element] < formula.value[element]) {
                enemyStats.imperils[element] = formula.value[element];
                delete context.savedValues.resistModifier;
            }
        }
        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "statsBuff") {
        if (formula.value.atk) {
            if (unitBuild.baseValues.atk.buff < formula.value.atk) {
                unitBuild.baseValues.atk.buff = formula.value.atk;
                delete context.savedValues.atk;
            }
        }
        if (formula.value.def) {
            if (unitBuild.baseValues.def.buff < formula.value.def) {
                unitBuild.baseValues.def.buff = formula.value.def;
                delete context.savedValues.def;
            }
        }
        if (formula.value.mag) {
            if (unitBuild.baseValues.mag.buff < formula.value.mag) {
                unitBuild.baseValues.mag.buff = formula.value.mag;
                delete context.savedValues.mag;
            }
        }
        if (formula.value.spr) {
            if (unitBuild.baseValues.spr.buff < formula.value.spr) {
                unitBuild.baseValues.spr.buff = formula.value.spr;
                delete context.savedValues.spr;
            }
        }
        if (formula.value.lbDamage) {
            if (unitBuild.baseValues.lbDamage < formula.value.lbDamage) {
                unitBuild.baseValues.lbDamage = formula.value.lbDamage;
                delete context.savedValues.lbDamage;
            }
        }
        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "berserk") {
        if (!context.berserk || context.berserk < formula.value) {
            context.berserk = formula.value;
            delete context.savedValues.atk;
        }
        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "break") {
        if (formula.value.def && enemyStats.breakability.def) {
            if (enemyStats.breaks.def < formula.value.def) {
                enemyStats.breaks.def = formula.value.def;
            }
        }
        if (formula.value.spr && enemyStats.breakability.spr) {
            if (enemyStats.breaks.spr < formula.value.spr) {
                enemyStats.breaks.spr = formula.value.spr;
            }
        }
        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "killers") {
        if (!context.killerBuff) {
            context.killerBuff = {};
        }
        for (var i = formula.value.killers.length; i--;) {
            if (formula.value.killers[i].physical) {
                if (!context.killerBuff.physical) {
                    context.killerBuff.physical = {};
                }
                if (!context.killerBuff.physical[formula.value.killers[i].name] || context.killerBuff.physical[formula.value.killers[i].name] < formula.value.killers[i].physical) {
                    context.killerBuff.physical[formula.value.killers[i].name] = formula.value.killers[i].physical;
                }
            }
            if (formula.value.killers[i].magical) {
                if (!context.killerBuff.magical) {
                    context.killerBuff.magical = {};
                }
                if (!context.killerBuff.magical[formula.value.killers[i].name] || context.killerBuff.magical[formula.value.killers[i].name] < formula.value.killers[i].magical) {
                    context.killerBuff.magical[formula.value.killers[i].name] = formula.value.killers[i].magical;
                }
            }
        }
        context.savedValues.killerMultiplicator = {};

        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "imbue") {
        for (var elementIndex = formula.value.length; elementIndex--;) {
            if (!context.imbues.includes(formula.value[elementIndex])) {
                context.imbues.push(formula.value[elementIndex])
                delete context.savedValues.resistModifier;
            }
        }
        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "skillEnhancement") {
        var skills = Object.keys(formula.value);
        for (var i = skills.length; i--;) {
            if (!context.skillEnhancement[skills[i]]) {
                context.skillEnhancement[skills[i]] = formula.value[skills[i]];
            } else {
                context.skillEnhancement[skills[i]] += formula.value[skills[i]];
            }
        }
        return {
            "min": 0,
            "avg": 0,
            "max": 0,
            "switchWeapons": false
        };
    } else if (formula.type == "elementCondition") {
        var elements = [];
        if (itemAndPassives[0] && itemAndPassives[0].element) {
            for (var elementIndex = itemAndPassives[0].element.length; elementIndex--;) {
                if (!elements.includes(itemAndPassives[0].element[elementIndex])) {
                    elements.push(itemAndPassives[0].element[elementIndex]);
                }
            }
        };
        if (itemAndPassives[1] && itemAndPassives[1].element) {
            for (var elementIndex = itemAndPassives[1].element.length; elementIndex--;) {
                if (!elements.includes(itemAndPassives[1].element[elementIndex])) {
                    elements.push(itemAndPassives[1].element[elementIndex]);
                }
            }
        };
        if (formula.element == "none") {
            return elements.length == 0;
        } else {
            if (elements.length == 0 || !elements.includes(formula.element)) {
                return false;
            }
        }
        return true;
    } else if (formula.type == "condition") {
        if (!ignoreConditions) {
            var value = innerCalculateBuildValueWithFormula(itemAndPassives, unitBuild, enemyStats, formula.condition, goalVariance, canSwitchWeapon, ignoreConditions, context);
            if (!value) {
                return -1;
            }
        }
        return innerCalculateBuildValueWithFormula(itemAndPassives,unitBuild, enemyStats, formula.formula, goalVariance, canSwitchWeapon, ignoreConditions, context)
    }
}

function getChainMult(unitBuild, itemAndPassives) {
    let chainMult = 4;
    if (unitBuild.hasDualWieldMastery() && itemAndPassives[0] && itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
        chainMult = 8;
    }
    itemAndPassives.filter(i => i && i.chainMastery).forEach(i => {
        chainMult += i.chainMastery / 100;
    });
    return Math.min(chainMult, 6);
}

function calculateMonsterDamage(monsterAttackFormula, itemAndPassives, unitBuild, enemyStats, context = {}) {
    let result1, result2, atk, mag, def, spr, baseValue, mitigation;
    switch (monsterAttackFormula.type) {
        case '+':
            result1 = calculateMonsterDamage(monsterAttackFormula.value1, itemAndPassives, unitBuild, enemyStats, context);
            result2 = calculateMonsterDamage(monsterAttackFormula.value2, itemAndPassives, unitBuild, enemyStats, context);
            return {
                "min": result1.min + result2.min,
                "avg": result1.avg + result2.avg,
                "max": result1.max + result2.max,
                "switchWeapons": result1.switchWeapons || result2.switchWeapons
            };
        case '*':
            result1 = calculateMonsterDamage(monsterAttackFormula.value1, itemAndPassives, unitBuild, enemyStats, context);
            result2 = calculateMonsterDamage(monsterAttackFormula.value2, itemAndPassives, unitBuild, enemyStats, context);
            return {
                "min": result1.min * result2.min,
                "avg": result1.avg * result2.avg,
                "max": result1.max * result2.max,
                "switchWeapons": result1.switchWeapons || result2.switchWeapons
            };
        case 'constant':
            return {
                "min": monsterAttackFormula.value,
                "avg": monsterAttackFormula.value,
                "max": monsterAttackFormula.value,
                "switchWeapons": false
            };
        case 'skill':
            switch (monsterAttackFormula.formulaName) {
                case 'physicalDamage':
                    if (context.alreadyCalculatedValues && context.alreadyCalculatedValues['def']) {
                        def = context.alreadyCalculatedValues['def'];
                    } else {
                        def = calculateStatValue(itemAndPassives, 'def', unitBuild, context.berserk).total
                    }
                    atk = enemyStats.atk * (1 + enemyStats.buffs.atk/100 - enemyStats.breaks.atk/100);
                    mitigation = 1;
                    if (unitBuild.unit.mitigation && unitBuild.unit.mitigation.physical) {
                        mitigation = (1 - (unitBuild.unit.mitigation.physical / 100));
                    }
                    if (unitBuild.baseValues["mitigation"]) {
                        mitigation = mitigation * (1 - (unitBuild.baseValues["mitigation"].global / 100)) * (1 - (unitBuild.baseValues["mitigation"].physical / 100));
                    }
                    baseValue = atk * atk / def * mitigation;
                    return {
                        "min": baseValue,
                        "avg": baseValue,
                        "max": baseValue,
                        "switchWeapons": false
                    };
                case 'magicalDamage':
                    if (context.alreadyCalculatedValues && context.alreadyCalculatedValues['spr']) {
                        spr = context.alreadyCalculatedValues['spr'];
                    } else {
                        spr = calculateStatValue(itemAndPassives, 'spr', unitBuild, context.berserk).total
                    }
                    mag = enemyStats.mag * (1 + enemyStats.buffs.mag/100 - enemyStats.breaks.mag/100);
                    mitigation = 1;
                    if (unitBuild.unit.mitigation && unitBuild.unit.mitigation.magical) {
                        mitigation = (1 - (unitBuild.unit.mitigation.magical / 100));
                    }
                    if (unitBuild.baseValues["mitigation"]) {
                        mitigation = mitigation * (1 - (unitBuild.baseValues["mitigation"].global / 100)) * (1 - (unitBuild.baseValues["mitigation"].magical / 100));
                    }
                    baseValue = mag * mag / spr * mitigation;
                    return {
                        "min": baseValue,
                        "avg": baseValue,
                        "max": baseValue,
                        "switchWeapons": false
                    };
                case 'hybridDamage':
                    if (context.alreadyCalculatedValues && context.alreadyCalculatedValues['def']) {
                        def = context.alreadyCalculatedValues['def'];
                    } else {
                        def = calculateStatValue(itemAndPassives, 'def', unitBuild, context.berserk).total
                    }
                    atk = enemyStats.atk * (1 + enemyStats.buffs.atk/100 - enemyStats.breaks.atk/100);
                    mitigation = 1;
                    if (unitBuild.unit.mitigation && unitBuild.unit.mitigation.physical) {
                        mitigation = (1 - (unitBuild.unit.mitigation.physical / 100));
                    }
                    if (unitBuild.baseValues["mitigation"]) {
                        mitigation = mitigation * (1 - (unitBuild.baseValues["mitigation"].global / 100)) * (1 - (unitBuild.baseValues["mitigation"].physical / 100));
                    }
                    baseValue = atk * atk / def * mitigation;
                    if (context.alreadyCalculatedValues && context.alreadyCalculatedValues['spr']) {
                        spr = context.alreadyCalculatedValues['spr'];
                    } else {
                        spr = calculateStatValue(itemAndPassives, 'spr', unitBuild, context.berserk).total
                    }
                    mag = enemyStats.mag * (1 + enemyStats.buffs.mag/100 - enemyStats.breaks.mag/100);
                    mitigation = 1;
                    if (unitBuild.unit.mitigation && unitBuild.unit.mitigation.magical) {
                        mitigation = (1 - (unitBuild.unit.mitigation.magical / 100));
                    }
                    if (unitBuild.baseValues["mitigation"]) {
                        mitigation = mitigation * (1 - (unitBuild.baseValues["mitigation"].global / 100)) * (1 - (unitBuild.baseValues["mitigation"].magical / 100));
                    }
                    baseValue += mag * mag / spr * mitigation;

                    baseValue = baseValue/2;
                    return {
                        "min": baseValue,
                        "avg": baseValue,
                        "max": baseValue,
                        "switchWeapons": false
                    };
                case 'fixedDamageWithPhysicalMechanism':
                    baseValue = 1;
                    return {
                        "min": baseValue,
                        "avg": baseValue,
                        "max": baseValue,
                        "switchWeapons": false
                    };
                case 'atkDamageWithFixedMechanism':
                    if (context.alreadyCalculatedValues['def']) {
                        def = context.alreadyCalculatedValues['def'];
                    } else {
                        def = calculateStatValue(itemAndPassives, 'def', unitBuild, context.berserk).total
                    }
                    atk = enemyStats.atk * (1 + enemyStats.buffs.atk/100 - enemyStats.breaks.atk/100);
                    mitigation = 1;
                    if (unitBuild.baseValues["mitigation"]) {
                        mitigation = mitigation * (1 - (unitBuild.baseValues["mitigation"].global / 100));
                    }
                    baseValue = atk * atk / def * mitigation;
                    return {
                        "min": baseValue,
                        "avg": baseValue,
                        "max": baseValue,
                        "switchWeapons": false
                    };
            }
    }
}

function getStatCalculatedValue(context, itemAndPassives, stat, unitBuild) {
    if (context.savedValues[stat]) {
        return context.savedValues[stat];
    } else {
        var result = calculateStatValue(itemAndPassives, stat, unitBuild, context.berserk);
        context.savedValues[stat] = result;
        return result;
    }
}


function getEquipmentStatBonus(itemAndPassives, stat, doCap = true) {
    if ((baseStats.includes(stat) || stat == "accuracy") && itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type)) {
        let normalStack = 0;
        let twoHanded = isTwoHanded(itemAndPassives[0]);
        let dualWield = itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type);
        let oneWeapon = !itemAndPassives[1] || shieldList.includes(itemAndPassives[1].type);
        for (var index = itemAndPassives.length; index--;) {
            var item = itemAndPassives[index];
            if (item) {
                if (item.singleWielding && item.singleWielding[stat]  && itemAndPassives[0] && !itemAndPassives[1]) {
                    normalStack += item.singleWielding[stat] / 100;
                }
                if (oneWeapon && item.oneWeaponMastery && item.oneWeaponMastery[stat]) {
                    normalStack += item.oneWeaponMastery[stat] / 100;
                }
                if (!twoHanded && item.singleWieldingOneHanded && item.singleWieldingOneHanded[stat] && itemAndPassives[0] && !itemAndPassives[1]) {
                    normalStack += item.singleWieldingOneHanded[stat] / 100;
                }
                if (dualWield && item.dualWielding && item.dualWielding[stat]) {
                    if (doCap) {
                        normalStack = Math.min(normalStack  + item.dualWielding[stat] / 100, getStatBonusCap('tdw')/100);
                    } else {
                        normalStack += item.dualWielding[stat] / 100;
                    }
                }
            }
        }
        if (doCap) {
            return 1 + Math.min(getStatBonusCap('tdh')/100, normalStack);
        } else {
            return 1 + normalStack;
        }
    } else {
        return 1;
    }
}

function getEsperStatBonus(itemAndPassives, stat, esper) {
    var statsBonus = 100;
    if (baseStats.includes(stat)) {
        for (var index = itemAndPassives.length; index--;) {
            var item = itemAndPassives[index];
            if (item && item.esperStatsBonus) {
                if (item.esperStatsBonus.all && item.esperStatsBonus.all[stat]) {
                    statsBonus += item.esperStatsBonus.all[stat];
                }
                if (esper && item.esperStatsBonus[esper.id] && item.esperStatsBonus[esper.id][stat]) {
                    statsBonus += item.esperStatsBonus[esper.id][stat];
                }
            }
        }
    }
    return Math.min(3, statsBonus / 100);
}

function calculateStatValue(itemAndPassives, stat, unitBuild, berserk = 0, ignoreBuffs = false) {
    var equipmentStatBonus = getEquipmentStatBonus(itemAndPassives, stat, true);
    var esperStatBonus = 1;
    if (itemAndPassives[11]) {
        esperStatBonus = getEsperStatBonus(itemAndPassives, stat, itemAndPassives[11]);
    }
    var calculatedValue = 0
    var currentPercentIncrease = {"value":0};
    var baseValue = 0;
    var buffValue = 0;
    if (baseStats.includes(stat)) {
        baseValue = unitBuild.baseValues[stat].total;
        // itemAndPassives[10] is the VC
        if (itemAndPassives[10] && itemAndPassives[10][stat]) {
            baseValue += itemAndPassives[10][stat];
        }
        if (!ignoreBuffs) {
            if (stat === 'hp') {
                buffValue = unitBuild.baseValues[stat].buff;
            } else if (stat === 'atk' && berserk) {
                buffValue = (unitBuild.baseValues[stat].buff + berserk) * baseValue / 100;
            } else {
                buffValue = unitBuild.baseValues[stat].buff * baseValue / 100;
            }
        }
    } else if (stat == "lbPerTurn") {
        baseValue = unitBuild.baseValues["lbFillRate"].total;
        buffValue = unitBuild.baseValues["lbFillRate"].buff * baseValue / 100;
    }

    var calculatedValue = baseValue + buffValue;

    if (stat == "accuracy") {
        calculatedValue += (equipmentStatBonus - 1)*100;
        equipmentStatBonus = 1;
    }    

    for (var equipedIndex = itemAndPassives.length; equipedIndex--;) {
        if (itemAndPassives[equipedIndex]) {
            var equipmentStatBonusToApply = 1;
            if (equipedIndex < 11) {
                equipmentStatBonusToApply = equipmentStatBonus;
            }
            if (equipedIndex == 11) {
                equipmentStatBonusToApply = esperStatBonus;
            }
            if ("evade.magical" == stat) {
                calculatedValue = Math.max(calculatedValue, calculateStateValueForIndex(itemAndPassives, equipedIndex, baseValue, currentPercentIncrease, equipmentStatBonusToApply, stat));
            } else if (equipedIndex < 2 && "atk" == stat) {
                calculatedValue += calculatePercentStateValueForIndex(itemAndPassives[equipedIndex], baseValue, currentPercentIncrease, stat);
                calculatedValue += calculateFlatStateValueForIndex(itemAndPassives, equipedIndex, equipmentStatBonus - 1, stat);
            } else {
                calculatedValue += calculateStateValueForIndex(itemAndPassives, equipedIndex, baseValue, currentPercentIncrease, equipmentStatBonusToApply, stat);
            }
        }
    }

    if (stat == "chainMastery") {
        calculatedValue = (calculatedValue  / 100) + 4;
        let lengthValue = 0;
        let itemObject = Object.keys(unitBuild["unitShift"]["build"]);
        // loop through the unitBuild and see if any of the items have the improvedDW property
        for (let i = 0; i < itemObject.length; i++) {
            if (unitBuild["unitShift"]["build"][itemObject[i]]?.improvedDW) {
                lengthValue = itemObject[i];
            }
        }

        if (unitBuild && unitBuild["unitShift"]["build"][lengthValue]?.improvedDW && unitBuild["unitShift"]["build"][lengthValue]?.improvedDW === true) {
            if (unitBuild["unitShift"]["build"][0] !== null && unitBuild["unitShift"]["build"][1] !== null) {
                calculatedValue = calculatedValue + 2;
            }
        }

        for (let i = 0; i < itemObject.length; i++) {
            if (unitBuild["unitShift"]["build"][itemObject[i]]?.improvedTDW) {
                lengthValue = itemObject[i];
            }
        }     

        if (unitBuild && unitBuild["unitShift"]["build"][lengthValue]?.improvedTDW && unitBuild["unitShift"]["build"][lengthValue]?.improvedTDW === true) {
            if (unitBuild["unitShift"]["build"][0] !== null && unitBuild["unitShift"]["build"][1] !== null) {
                calculatedValue = calculatedValue + 2;
            }
        }
    }

    // check if the itemAndPassives have a not stackable skill
    calculatedValue = checkForNotStackableSkills(itemAndPassives, stat, unitBuild, calculatedValue)

    if (stat === "atk") {
        let realCap =  calculatedValue;
        var result = {"right":0,"left":0,"total":0,"bonusPercent":currentPercentIncrease.value, "overcap": realCap};
        var right = calculateFlatStateValueForIndex(itemAndPassives, 0, 1, stat);
        var left = calculateFlatStateValueForIndex(itemAndPassives, 1, 1, stat);
        if (itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
            result.right = Math.floor(calculatedValue + right);
            result.left = Math.floor(calculatedValue + left);
            result.total = Math.floor(calculatedValue + right + left);
        } else {
            result.right = Math.floor(calculatedValue + right + left);
            result.left = 0;
            result.total = result.right;
        }
    } else {
        let realCap = calculatedValue;
        if (stat === "lbDamage" || stat === "jumpDamage" || stat === "evoMag" || stat === "evokeDamageBoost.all" || stat.includes("%")) {
            
            calculatedValue = Math.min(getStatBonusCap(stat), calculatedValue);
            if (stat === "lbDamage") {
                calculatedValue = calculatedValue + unitBuild.baseValues["lbDamage"]
            }
        }
        var result = {"right":0,"left":0,"total":calculatedValue,"bonusPercent":currentPercentIncrease.value, "overcap": realCap};
        if (!valuesToNotRoundDown.includes(stat)) {
            calculatedValue = Math.floor(calculatedValue);
        }
        if (itemAndPassives[0] && weaponList.includes(itemAndPassives[0].type)) {
            result.right = result.total;
        }
        if (itemAndPassives[1] && weaponList.includes(itemAndPassives[1].type)) {
            result.left = result.total;
        }
    }

    return result;
}

function checkForNotStackableSkills(itemsAndPassives, stat, unitBuild, calculatedValue) {
   // check if the itemAndPassives have a not stackable skill
    for (var equipedIndex = itemsAndPassives.length; equipedIndex--;) {
        if (itemsAndPassives[equipedIndex]) {
            var item = itemsAndPassives[equipedIndex];
            if (item.notStackableSkills) {
                var skill = item.notStackableSkills;
                if (skill) {
                    // forEach not stackable skill in the skill object
                    Object.keys(skill).forEach(function(key) {
                        var skillId = key;
                        var skillValue = skill[key];
                        if (skillValue.staticStats) {
                            var skillStaticStats = skillValue.staticStats;
                            if (skillStaticStats[stat]) {
                                var skillStatValue = skillStaticStats[stat];
                                if (skillStatValue) {
                                    // count how many of this item is equipped
                                    var count = 0;
                                    for (var i = 0; i < itemsAndPassives.length; i++) {
                                        if (itemsAndPassives[i] && itemsAndPassives[i].id == item.id) {
                                            count++;
                                        }
                                    }
                                    // and then add the value to the calculatedValue
                                    if (count == 1 && stat != "atk") {
                                        calculatedValue += skillStatValue;
                                        // But if more than one of the item is equipped, then only add half of the value
                                    } else if (count > 1 && stat != "atk") {
                                        calculatedValue += skillStatValue / 2
                                    } else if (count > 1 && stat == "atk") {
                                        calculatedValue -= skillStatValue / 2;
                                    }

                                    if (stat == "atk") {
                                        if (equipedIndex >= 2) {
                                            calculatedValue += skillStatValue;
                                        }
                                    }
                                    
                                }
                            }
                        }

                        if (stat === "chainMastery" && skillValue.chainMastery) {
                            var chainMastery = skillValue.chainMastery;
                            if (chainMastery) {
                                // count how many of this item is equipped
                                var count = 0;
                                for (var i = 0; i < itemsAndPassives.length; i++) {
                                    if (itemsAndPassives[i] && itemsAndPassives[i].id == item.id) {
                                        count++;
                                    }
                                }

                                // and then add the value to the calculatedValue
                                if (count == 1) {
                                    calculatedValue += (chainMastery / 100);
                                    // But if more than one of the item is equipped, then only add half of the value
                                } else if (count > 1) {
                                    calculatedValue += ((chainMastery / 100) / 2);
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    return calculatedValue;
}

function calculateStateValueForIndex(items, index, baseValue, currentPercentIncrease, equipmentStatBonus, stat) {
    let item = items[index];
    if (item) {
        if (stat == "lbPerTurn") {
            var value = 0;
            if (item.lbPerTurn) {
                var lbPerTurn = getValue(item, "lbPerTurn");
                value += lbPerTurn;
            }
            if (item.lbFillRate) {
                value += item.lbFillRate * baseValue / 100;
            }
            return value;
        } else {
            let value;
            let staticValue = item.staticStats?.[stat] || 0;

            // if item has notStackableSkills, and notStackableSkills contains a skill with that stat check if it has staticStats for the stat && item.staticStats contains the stat
            if (item.notStackableSkills) {
                Object.values(item.notStackableSkills).forEach(skill => {
                    if (skill.staticStats && skill.staticStats[stat]) {
                        staticValue = 0;
                    }
                });
            }

                // 
            if (index === 10 && baseStats.includes(stat)) {
                value = 0; // Vision Card flat stats are added to the base value directly earlier in the calculation
            } else {
                value = getValue(item, stat);

                if (stat === "chainMastery" && item.notStackableSkills) {
                    Object.values(item.notStackableSkills).forEach(skill => {
                        if (skill.chainMastery) {
                            value = 0;
                        }
                    });
                }
            }
            if (item[percentValues[stat]]) {
                var itemPercentValue = getValue(item, percentValues[stat]);
                var percentTakenIntoAccount = Math.min(itemPercentValue, Math.max(getStatBonusCap(stat) - currentPercentIncrease.value, 0));
                currentPercentIncrease.value += itemPercentValue;
                return value * equipmentStatBonus + percentTakenIntoAccount * baseValue / 100 + staticValue;
            } else {
                return value * equipmentStatBonus + staticValue;
            }
        }
    }
    return 0;
}

function getStatBonusCap(stat, unitBuild) {
    switch(stat) {
        case 'lbDamage':
            return 300;
        case 'lbPerTurn':
            return 12;
        case 'lbFillRate':
            return 1000;
        case 'tdh':
            return 400;
        case 'tdw':
            return 400;
        case 'jumpDamage':
            return 800;
        case 'evoMag':
            return 300;
        case 'evokeDamageBoost.all':
            return 300;
        case 'chainMastery':
            if (unitBuild) {
                // check to see if they can increase their chain cap
                
                let lengthValue = 0;
                let itemObject = Object.keys(unitBuild["unitShift"]["build"]);
                // loop through the unitBuild and see if any of the items have the improvedDW property
                for (let i = 0; i < itemObject.length; i++) {
                    if (unitBuild["unitShift"]["build"][itemObject[i]]?.improvedDW) {
                        lengthValue = itemObject[i];
                    }
                }                
                
                if(unitBuild["unitShift"]["build"][lengthValue]?.improvedDW){
                    // to increase their chain cap, they must have two weapons equipped.
                    if (unitBuild["unitShift"]["build"][0] && unitBuild["unitShift"]["build"][1]) {
                        if (unitBuild["unitShift"]["build"][0] != null && unitBuild["unitShift"]["build"][1] != null) {
                            return 8;
                        }
                    }
                }

                for (let i = 0; i < itemObject.length; i++) {
                    if (unitBuild["unitShift"]["build"][itemObject[i]]?.improvedTDW) {
                        lengthValue = itemObject[i];
                    }
                }      

                if(unitBuild["unitShift"]["build"][lengthValue]?.improvedTDW){
                    // to increase their chain cap, they must have two weapons equipped.
                    if (unitBuild["unitShift"]["build"][0] && unitBuild["unitShift"]["build"][1]) {
                        if (unitBuild["unitShift"]["build"][0] != null && unitBuild["unitShift"]["build"][1] != null) {
                            return 6;
                        }
                    }
                }
            }
            return 6;
        case 'drawAttacks':
            return 100;
        case 'accuracy':
            return 100;
        case 'evade.physical':
            return 100;
        default:
            return 400;
    }
}


function calculateFlatStateValueForIndex(items, index, equipmentStatBonus, stat) {
    if (index === 10) {
        return 0; // Vision Card flat stats are added to the base value directly earlier in the calculation
    }
    if (items[index] && items[index][stat]) {
        return items[index][stat] * equipmentStatBonus;
    }
    return 0;
}

function calculatePercentStateValueForIndex(item, baseValue, currentPercentIncrease, stat) {
    let result = 0;
    if (item && item[percentValues[stat]]) {
        var itemPercentValue = item[percentValues[stat]];
        var percentTakenIntoAccount = Math.min(itemPercentValue, Math.max(getStatBonusCap(stat) - currentPercentIncrease.value, 0));
        currentPercentIncrease.value += itemPercentValue;
        result = percentTakenIntoAccount * baseValue / 100;
    }
    if (item && item.staticStats && item.staticStats[stat]) {
        result += item.staticStats[stat];
    }
    return result;
}

function getElementCoef(elements, enemyStats) {
    var resistModifier = 0;

    for (var i = elements.length; i--;) {
        var element = elements[i];
        resistModifier += (enemyStats.elementalResists[element] - enemyStats.imperils[element]) / 100;
    }
    if (elements.length) {
        resistModifier = resistModifier / elements.length;
    }
    return resistModifier;
}

function getWeaponImperilCoef(weapon1, weapon2, enemyStats) {
    let weaponTypes = [];
    if (weapon1 && weaponList.includes(weapon1.type)) {
        weaponTypes.push(weapon1.type);
    }
    if (weapon2 && weaponList.includes(weapon2.type) && !weaponTypes.includes(weapon2.type)) {
        weaponTypes.push(weapon2.type);
    }
    let weaponImperil = 1;
    if (weaponTypes.length) {
        weaponImperil += Math.floor(weaponTypes.map(weaponType => enemyStats.imperils[weaponType] || 0).reduce((acc, value) => acc + value, 0) / weaponTypes.length) / 100;
    }
    return weaponImperil;
}

function isApplicable(item, unit) {
    if (item.exclusiveSex && item.exclusiveSex != unit.sex) {
        return false;
    }
    if (item.exclusiveRoles && !item.exclusiveRoles.some(role => unit.roles.includes(role))) {
        return false;
    }
    if (item.exclusiveUnits && !item.exclusiveUnits.includes(unit.id)) {
        return false;
    }
    if (item.max7StarUnit && unit.max_rarity === 'NV') {
        return false;
    }
    return true;
}

const elementSet = new Set(elementList);
const typeSet = new Set(typeList);

function areConditionOK(item, equiped, level = 0, exLevel) {
    if (level && item.levelCondition && item.levelCondition > level) {
        return false;
    }

    if (exLevel  > -1 && item.exLevelCondition){
        if (item.exLevelCondition > exLevel) {
            return false;
        }
    }
    if (item.equipedConditions) {
        if (item.equipedConditions.every(condition => weaponList.includes(condition))) {
            if (equiped[0] && item.equipedConditions.includes(equiped[0].type) || equiped[1] && item.equipedConditions.includes(equiped[1].type)) {
                return true;
            }
            return false;
        } else {
            // Otherweise loop through the item.equippedConditions and see if any of them are met usng the isEquipedConditionOK function
            for (var conditionIndex = item.equipedConditions.length; conditionIndex--;) {
                if (!isEquipedConditionOK(equiped, item.equipedConditions[conditionIndex])) {
                    return false;
                }
            }
        }
    }
    return true;
}

function isEquipedConditionOK(equiped, condition) {
    if (Array.isArray(condition)) {
        return condition.some(c => isEquipedConditionOK(equiped, c));
    } else {
        switch (true) {
            case elementSet.has(condition):
                return (equiped[0] && equiped[0].element && equiped[0].element.includes(condition)) || (equiped[1] && equiped[1].element && equiped[1].element.includes(condition));
            case typeSet.has(condition):
                return equiped.some((equipment, index) => {
                    if (equipment && equipment.type === condition) {
                        return true;
                    }
                });
            case condition === "unarmed":
                return !equiped[0] && !equiped[1];
            default:
                return equiped.some((equipment, index) => {
                    if (equipment && equipment.id) {
                        if (equipment.id.toString().includes("-")) {
                            let cardLevelId = equipment.id.split('-');
                            return cardLevelId[0] === condition;
                        } else {
                            return equipment.id === condition;
                        }
                    }
                });
        }
    }
}


function findBestItemVersion(build, item, itemWithVariation, unit) {
    var itemVersions = itemWithVariation[item.id];
    if (!itemVersions) {
        if (isApplicable(item, unit) && (!item.equipedConditions || areConditionOK(item, build))) {
            return item;
        } else {
            var result = {"id":item.id, "name":item.name, "jpname":item.jpname, "icon":item.icon, "type":item.type,"access":["Conditions not met"], "enhancements":item.enhancements};
            if (item.special && item.special.includes("notStackable")) {
                result.special = ["notStackable"];
            }
            return result;
        }
    } else {
        itemVersions.sort(function (item1, item2) {
            var conditionNumber1 = 0;
            var conditionNumber2 = 0;
            if (item1.equipedConditions) {
                conditionNumber1 = item1.equipedConditions.length;
            }
            if (item1.exclusiveUnits) {
                conditionNumber1++;
            }
            if (item1.exclusiveSex) {
                conditionNumber1++;
            }
            if (item1.exclusiveRoles) {
                conditionNumber1++;
            }
            if (item2.equipedConditions) {
                conditionNumber2 = item2.equipedConditions.length;
            }
            if (item2.exclusiveUnits) {
                conditionNumber2++;
            }
            if (item2.exclusiveSex) {
                conditionNumber2++;
            }
            if (item2.exclusiveRoles) {
                conditionNumber2++;
            }
            let result = conditionNumber2 - conditionNumber1;
            if (result != 0) {
                return result;
            } else {
                return Object.keys(item2).length - Object.keys(item1).length;
            }
        });
        for (var index in itemVersions) {
            if (isApplicable(itemVersions[index], unit) && areConditionOK(itemVersions[index], build)) {
                if (item.enhancements) {
                    return applyEnhancements(itemVersions[index], item.enhancements);
                } else {
                    return itemVersions[index];
                }
            }
        }
        var item = itemVersions[0];
        var result = {"id":item.id, "name":item.name, "jpname":item.jpname, "icon":item.icon, "type":item.type,"access":["Conditions not met"], "enhancements":item.enhancements};
        if (item.special && item.special.includes("notStackable")) {
            result.special = ["notStackable"];
        }
        return result;
    }
}

function getEsperItem(esper) {
    var item = {};
    item.name = esper.name;
    item.id = esper.name;
    item.type = "esper";
    item.hp = Math.floor(esper.hp / 100);
    item.mp = Math.floor(esper.mp / 100);
    item.atk = Math.floor(esper.atk / 100);
    item.def = Math.floor(esper.def / 100);
    item.mag = Math.floor(esper.mag / 100);
    item.spr = Math.floor(esper.spr / 100);
    item.access = ["story"];
    item.maxLevel = esper.maxLevel
    if (esper.killers) {
        item.killers = esper.killers;
    }
    if (esper.resist) {
        item.resist = esper.resist;
    }
    if (esper.esperStatsBonus) {
        item.esperStatsBonus = esper.esperStatsBonus;
    }
    if (esper.level) {
        item.level = esper.level;
    }
    if (esper.rarity) {
        item.rarity = esper.rarity;
    }
    if (esper.lbPerTurn) {
        item.lbPerTurn = esper.lbPerTurn;
    }
    if (esper.lbFillRate) {
        item.lbFillRate = esper.lbFillRate;
    }
    if (esper.lbDamage) {
        item.lbDamage = esper.lbDamage;
    }
    if (esper.evade) {
        item.evade = esper.evade;
    }
    if (esper.buildLink) {
        item.buildLink = esper.buildLink;
    }
    if (esper.conditional) {
        item.conditional = esper.conditional;
    }
    if (esper.jumpDamage) {
        item.jumpDamage = esper.jumpDamage;
    }
    for (var i = baseStats.length; i--;) {
        if (esper[percentValues[baseStats[i]]]) {
            item[percentValues[baseStats[i]]] = esper[percentValues[baseStats[i]]];
        }
    }
    item.originalEsper = esper;
    return item;
}

var simpleAddCombineProperties = ["hp","hp%","mp","mp%","atk","atk%","def","def%","mag","mag%","spr","spr%","evoMag","accuracy","jumpDamage","lbFillRate","mpRefresh", "lbDamage"];

function combineTwoItems(item1, item2) {
    var sum = JSON.parse(JSON.stringify(item1));
    for (var index = simpleAddCombineProperties.length; index--;) {
        var stat = simpleAddCombineProperties[index];
        if (item2[stat]) {
            addToStat(sum, stat, item2[stat]);
        }
    }
    if (item2.evade) {
        addEvade(sum, item2.evade);
    }
    if (item2.singleWielding) {
        addEqStatBonus(sum, "singleWielding", item2.singleWielding);
    }
    if (item2.singleWieldingOneHanded) {
        addEqStatBonus(sum, "singleWieldingOneHanded", item2.singleWieldingOneHanded);
    }
    if (item2.dualWielding) {
        addEqStatBonus(sum, "dualWielding", item2.dualWielding);
    }
    if (item2.oneWeaponMastery) {
        addEqStatBonus(sum, "oneWeaponMastery", item2.oneWeaponMastery);
    }
    if (item2.resist) {
        addResist(sum, item2.resist);
    }
    if (item2.lbPerTurn) {
        addLbPerTurn(sum, item2.lbPerTurn);
    }
    if (item2.killers) {
        for (var index = item2.killers.length; index--;) {
            addKiller(sum, item2.killers[index].name, item2.killers[index].physical, item2.killers[index].magical);
        }
    }
    if (item2.staticStats) {
        if (!sum.staticStats) sum.staticStats = {};
        baseStats.forEach(stat => {
            if (item2.staticStats[stat]) {
                addToStat(sum.staticStats, stat, item2.staticStats[stat]);
            }
        });
    }
    if (item2.evokeDamageBoost) {
        if (!sum.evokeDamageBoost) {
            sum.evokeDamageBoost = {};
        }
        Object.keys(item2.evokeDamageBoost).forEach(esperName => {
            addToStat(sum.evokeDamageBoost, esperName, item2.evokeDamageBoost[esperName]);
        });
    }
    if (item2.special) {
        if (!sum.special) {
            sum.special = [];
        }
        sum.special = sum.special.concat(item2.special);
    }
    return sum;
}

function addToStat(skill, stat, value) {
    if (!skill[stat]) {
        skill[stat] = value;
    } else {
        skill[stat] += value;
    }
}

function addToList(skill, listName, value) {
    if (!skill[listName]) {
        skill[listName] = [value];
    } else {
        if (!skill[listName].includes(value)) {
            skill[listName].push(value);
        }
    }
}

function addKiller(skill, race, physicalPercent, magicalPercent) {
    if (!skill.killers) {
        skill.killers = [];
    }
    var killerData;
    for (var index in skill.killers) {
        if (skill.killers[index].name == race) {
            killerData = skill.killers[index];
            break;
        }
    }

    if (!killerData) {
        killerData = {"name":race};
        skill.killers.push(killerData);
    }
    if (physicalPercent != 0) {
        if (killerData.physical) {
            killerData.physical += physicalPercent;
        } else {
            killerData.physical = physicalPercent;
        }
    }
    if (magicalPercent != 0) {
        if (killerData.magical) {
            killerData.magical += magicalPercent;
        } else {
            killerData.magical = magicalPercent;
        }
    }
}

function addResist(item, values) {
    if (!item.resist) {
        item.resist = [];
    }
    for (var index = values.length; index--;) {
        item.resist.push(values[index]);
    }
}

function addAilmentResist(item, values) {
    for (var index in ailments) {
        if (values[index]) {
            if (!item.resist) {
                item.resist = [];
            }
            item.resist.push({"name":ailments[index],"percent":values[index]})
        }
    }
}

function addEvade(item, evade) {
    if (!item.evade) {
        item.evade = {};
    }
    if (evade.physical) {
        if (item.evade.physical) {
            item.evade.physical = item.evade.physical + evade.physical;
        } else {
            item.evade.physical = evade.physical;
        }
    }
    if (evade.magical) {
        if (item.evade.magical) {
            item.evade.magical = item.evade.magical + evade.magical;
        } else {
            item.evade.magical = evade.magical;
        }
    }
}

function addEqStatBonus(item, doubleHandType, values) {
    if (!item[doubleHandType]) {
        item[doubleHandType] = {};
    }
    var stats = Object.keys(values);
    for (var index = stats.length; index--;) {
        var stat = stats[index];
        addToStat(item[doubleHandType], stat, values[stat]);
    }
}

function addLbPerTurn(item, lbPerTurn) {
    if (!item.lbPerTurn) {
        item.lbPerTurn = {"min":0, "max":0};
    }
    item.lbPerTurn.min += lbPerTurn.min;
    item.lbPerTurn.max += lbPerTurn.max;
}

function applyEnhancements(item, enhancements) {
    if (enhancements) {
        var result = JSON.parse(JSON.stringify(item));
        result.enhancements = enhancements.slice();
        for (var i = enhancements.length; i--;) {
            var enhancement = enhancements[i];
            var enhancementValue;
            if (enhancement == "rare_3" || enhancement == "rare_4" || enhancement == "rare_5") {
                enhancementValue = itemEnhancementAbilities[enhancement][item.type];
            } else if (enhancement === 'special_1') {
                enhancementValue = itemEnhancementAbilities[enhancement][item.id];
            } else {
                enhancementValue = itemEnhancementAbilities[enhancement];
            }
            if (enhancementValue) {
                result = combineTwoItems(result, enhancementValue);
            }
        }
        result.originalItem = item;
        return result;
    } else {
        return item; 
    }
}

function computeFarmableStmr() {
    let result = {};
    if (ownedUnits) {
        let stmrs = data.filter(item => {
            return item.stmrUnit && ownedUnits[item.stmrUnit] && (ownedUnits[item.stmrUnit].farmableStmr > 0 || ownedUnits[item.stmrUnit].number >= 2)
        });
        stmrs = stmrs.map(item => getItemEntry(item.originalItem || item, itemInventory[item.id] || 0));
        stmrs.forEach(stmr => {
            stmr.stmrAccess = {
                'base': "",
                'sevenStar': 0,
                'sixStar': 0,
                'stmrMoogle': 100
            }
            if (ownedUnits[stmr.item.stmrUnit].farmableStmr) {
                stmr.stmrAccess.base = "sevenStar";
            } else {
                stmr.stmrAccess.base = "sixStar";
            }
            if (ownedUnits[stmr.item.stmrUnit].farmableStmr > 1) {
                stmr.stmrAccess.sevenStar = 1;
                stmr.stmrAccess.stmrMoogle = 0;
            } else {
                let sixStarNumber = stmr.stmrAccess.base == "sixStar" ? ownedUnits[stmr.item.stmrUnit].number - 2 : ownedUnits[stmr.item.stmrUnit].number;
                if (sixStarNumber >= 2) {
                    stmr.stmrAccess.sixStar = 2;
                    stmr.stmrAccess.stmrMoogle = 0;
                } else if (sixStarNumber == 1) {
                    stmr.stmrAccess.sixStar = 1;
                    stmr.stmrAccess.stmrMoogle = 50;
                }
            }
        });
        stmrs.forEach(stmr => result[stmr.item.id] = stmr);
    }
    return result;
}

let itemEntryId = 0;
function getItemEntry(item, number, enhanced = false, enhancementPos = 0) {
    let itemEntry = {
        "item":item,
        "name":item.name,
        "defenseValue":0,
        "mpValue":0,
        "available":number,
        "owned": number > 0,
        "ownedNumber": number,
        "id": (itemEntryId++) + '',
        "enhanced": enhanced,
        "enhancementPos": enhancementPos
    }
    for (var index = 0, len = baseStats.length; index < len; index++) {
        item['total_' + baseStats[index]] = item[baseStats[index] + '%'] || 0;
    }
    return itemEntry;
}
