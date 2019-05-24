import logger from '~/shared/utils/logger';
import {List, fromJS} from 'immutable';
import {PHASE} from '../../GameModel';
import {AnimalModel} from '../AnimalModel';
import {
  TRAIT_TARGET_TYPE
  , TRAIT_COOLDOWN_DURATION
  , TRAIT_COOLDOWN_PLACE
  , TRAIT_COOLDOWN_LINK
  , CARD_TARGET_TYPE
  , CARD_SOURCE
  , TRAIT_ANIMAL_FLAG
} from '../constants';

import {
  server$startFeeding
  , server$traitActivate
  , server$traitStartCooldown
  , server$traitAnimalRemoveTrait
  , server$traitSetAnimalFlag
  , server$traitSetValue
  , server$traitNotify_End
  , server$game
  , startCooldown
  , server$gameDeployAnimalFromDeck
  , server$tryNeoplasmDeath, server$startFeedingCooldown, server$startCooldownList, getFeedingCooldownList
} from '../../../../actions/actions';

import {selectGame} from '../../../../selectors';

import {endHunt, endHuntNoCd, getStaticDefenses, getActiveDefenses, getAffectiveDefenses} from './TraitCarnivorous';
import * as tt from '../traitTypes';

export const TraitMetamorphose = {
  type: tt.TraitMetamorphose
  , targetType: TRAIT_TARGET_TYPE.TRAIT
  , playerControllable: true
  , cooldowns: fromJS([
    [tt.TraitMetamorphose, TRAIT_COOLDOWN_PLACE.TRAIT, TRAIT_COOLDOWN_DURATION.TURN]
    , [TRAIT_COOLDOWN_LINK.EATING, TRAIT_COOLDOWN_PLACE.PLAYER, TRAIT_COOLDOWN_DURATION.ROUND]
  ])
  , action: (game, sourceAnimal, traitMetamorphose, targetTrait) => (dispatch, getState) => {
    dispatch(server$traitStartCooldown(game.id, traitMetamorphose, sourceAnimal));

    dispatch(server$startFeeding(game.id, sourceAnimal.id, 1, tt.TraitMetamorphose));

    dispatch(server$traitAnimalRemoveTrait(game, sourceAnimal, targetTrait));

    return true;
  }
  , $checkAction: (game, sourceAnimal) =>
    sourceAnimal.getWantedFood() > 0 && sourceAnimal.getEatingBlockers(game).length <= 1
  , checkTarget: (game, sourceAnimal, targetTrait) => {
    const eatingBlockers = sourceAnimal.getEatingBlockers(game);
    if (eatingBlockers.length === 0)
      return targetTrait.getDataModel().food === 0;
    else // length === 1
      return targetTrait.id === eatingBlockers[0].id;
  }
  , getTargets: (game, sourceAnimal, traitMetamorphose) => {
    const eatingBlockers = sourceAnimal.getEatingBlockers(game);
    if (eatingBlockers.length === 0)
      return sourceAnimal.getTraits().filter(trait => trait.getDataModel().food === 0).toList();
    else // length === 1
      return List(eatingBlockers);
  }
};

export const TraitShell = {
  type: tt.TraitShell
  , targetType: TRAIT_TARGET_TYPE.NONE
  , optional: true
  , cooldowns: fromJS([
    [tt.TraitShell, TRAIT_COOLDOWN_PLACE.ANIMAL, TRAIT_COOLDOWN_DURATION.TURN]
  ])
  , $checkAction: (game) => game.status.phase !== PHASE.AMBUSH
  , action: (game, defenceAnimal, defenceTrait, target, attackAnimal, attackTrait) => (dispatch) => {
    dispatch(server$traitStartCooldown(game.id, defenceTrait, defenceAnimal));
    dispatch(server$traitSetAnimalFlag(game, defenceAnimal, TRAIT_ANIMAL_FLAG.SHELL, true));
    dispatch(endHunt(game, attackAnimal, attackTrait, defenceAnimal));
    return true;
  }
  , customFns: {
    onRemove: (game, animal) => (dispatch) => {
      dispatch(server$traitSetAnimalFlag(game, animal, TRAIT_ANIMAL_FLAG.SHELL, false));
    }
  }
};

export const TraitTrematode = {
  type: tt.TraitTrematode
  , cardTargetType: CARD_TARGET_TYPE.LINK_ENEMY
  , food: 1
};

export const TraitInkCloud = {
  type: tt.TraitInkCloud
  , targetType: TRAIT_TARGET_TYPE.NONE
  , optional: true
  , cooldowns: fromJS([
    [tt.TraitInkCloud, TRAIT_COOLDOWN_PLACE.TRAIT, TRAIT_COOLDOWN_DURATION.TURN]
  ])
  , action: (game, defenceAnimal, defenceTrait, target, attackAnimal, attackTrait) => (dispatch) => {
    dispatch(server$startCooldownList(game.id, [
      startCooldown(game.id, TRAIT_COOLDOWN_LINK.EATING, TRAIT_COOLDOWN_DURATION.ROUND, TRAIT_COOLDOWN_PLACE.PLAYER, attackAnimal.ownerId)
      , startCooldown(game.id, tt.TraitCarnivorous, TRAIT_COOLDOWN_DURATION.ROUND, TRAIT_COOLDOWN_PLACE.TRAIT, attackTrait.id)
    ]));


    dispatch(server$traitStartCooldown(game.id, defenceTrait, defenceAnimal));
    dispatch(endHuntNoCd(game.id, attackAnimal, attackTrait, defenceAnimal));
    return true;
  }
};

export const TraitSpecA = {
  type: tt.TraitSpecA
  , targetType: TRAIT_TARGET_TYPE.NONE
  , playerControllable: true
  , checkTraitPlacement: (animal) => !animal.hasTrait(tt.TraitSpecB, true)
  , cooldowns: fromJS([
    [tt.TraitSpecA, TRAIT_COOLDOWN_PLACE.TRAIT, TRAIT_COOLDOWN_DURATION.TURN]
    , [TRAIT_COOLDOWN_LINK.EATING, TRAIT_COOLDOWN_PLACE.PLAYER, TRAIT_COOLDOWN_DURATION.ROUND]
  ])
  , action: (game, animal, trait) => (dispatch, getState) => {
    dispatch(server$traitStartCooldown(game.id, trait, animal));
    dispatch(server$startFeeding(game.id, animal.id, 1, trait.type));
    return true;
  }
  , $checkAction: (game, animal, traitSpec) => (animal.canEat(game)
    && !game.someAnimal((animal) => animal.traits.some(trait => trait.id !== traitSpec.id && trait.type === traitSpec.type)))
};

export const TraitSpecB = {
  type: tt.TraitSpecB
  , targetType: TRAIT_TARGET_TYPE.NONE
  , playerControllable: true
  , checkTraitPlacement: (animal) => !animal.hasTrait(tt.TraitSpecA, true)
  , cooldowns: fromJS([
    [tt.TraitSpecB, TRAIT_COOLDOWN_PLACE.TRAIT, TRAIT_COOLDOWN_DURATION.TURN]
    , [TRAIT_COOLDOWN_LINK.EATING, TRAIT_COOLDOWN_PLACE.PLAYER, TRAIT_COOLDOWN_DURATION.ROUND]
  ])
  , action: TraitSpecA.action
  , $checkAction: TraitSpecA.$checkAction
};

export const TraitFlight = {type: tt.TraitFlight};

export const TraitViviparous = {
  type: tt.TraitViviparous
  , targetType: TRAIT_TARGET_TYPE.NONE
  , food: 1
  , cooldowns: fromJS([
    [tt.TraitViviparous, TRAIT_COOLDOWN_PLACE.TRAIT, TRAIT_COOLDOWN_DURATION.TURN]
  ])
  , action: (game, sourceAnimal, trait) => (dispatch) => {
    dispatch(server$traitStartCooldown(game.id, trait, sourceAnimal));
    dispatch(server$gameDeployAnimalFromDeck(game.id, sourceAnimal, animal => animal.set('food', 1)));
  }
  , $checkAction: (game, animal, traitSpec) => animal.isSaturated(game) && game.deck.size > 0
};

export const TraitAmbush = {
  type: tt.TraitAmbush
};
export const TraitIntellect = {
  type: tt.TraitIntellect
  , targetType: TRAIT_TARGET_TYPE.TRAIT
  , food: 1
  , cooldowns: fromJS([
    [tt.TraitIntellect, TRAIT_COOLDOWN_PLACE.TRAIT, TRAIT_COOLDOWN_DURATION.TURN]
  ])
  , getTargets: (game) => {
    const sourceAnimal = game.locateAnimal(game.question.sourceAid, game.question.sourcePid);
    const targetAnimal = game.locateAnimal(game.question.targetAid, game.question.targetPid);
    return [].concat(
      getStaticDefenses(game, sourceAnimal, targetAnimal)
      , getActiveDefenses(game, sourceAnimal, targetAnimal)
      , getAffectiveDefenses(game, sourceAnimal, targetAnimal));
  }
  , action: (game, sourceAnimal, traitIntellect, targetTraitId) => (dispatch, getState) => {
    dispatch(server$traitSetValue(game, sourceAnimal, traitIntellect, targetTraitId));
    if (targetTraitId !== true) {
      dispatch(server$traitStartCooldown(game.id, traitIntellect, sourceAnimal));
    }
    return false;
  }
};

export const TraitAnglerfish = {
  type: tt.TraitAnglerfish
  , targetType: TRAIT_TARGET_TYPE.NONE
  , playerControllable: true
  , transient: true
  , hidden: true
  , score: 0
  , $checkAction: (game, animal, traitSpec) => animal.traits.size === 1
  , action: (game, sourceAnimal, trait) => (dispatch) => {
    dispatch(server$traitSetValue(game, sourceAnimal, trait, !trait.value));
    return false;
  }
};
