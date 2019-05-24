import {Record} from 'immutable';
import uuid from 'uuid';
import {TraitDataModel} from './TraitDataModel';
import * as tt from './traitTypes'
import * as ptt from './plantarium/plantTraitTypes'
import {ActionCheckError} from '~/shared/models/ActionCheckError';
import {TRAIT_ANIMAL_FLAG} from './constants';
import PlantTraitDataModel from "./PlantTraitDataModel";

export const TraitData = Object.keys(tt)
  .reduce((result, traitType) => Object.assign(result, {[traitType]: TraitDataModel.new(traitType)}), {});

export const PlantTraitData = Object.keys(ptt)
  .reduce((result, traitType) => Object.assign(result, {[traitType]: PlantTraitDataModel.new(traitType)}), {});

export const parseTrait = (type) => {
  return Object.keys(tt)
    .find(traitType => ~traitType.toLowerCase().indexOf(type.toLowerCase()));
};

export const parsePlantTrait = (type) => {
  return Object.keys(ptt)
    .find(traitType => ~traitType.toLowerCase().indexOf(type.toLowerCase()));
};

export const getTraitDataModel = (traitType) => {
  return TraitData[traitType] || PlantTraitData[traitType];
};

export class TraitModel extends Record({
  type: null
  , id: null
  , linkId: null
  , ownerId: null
  , hostAnimalId: null
  , linkAnimalId: null
  , linkSource: null
  , value: false // for fat
  , disabled: false // for neoplasm
  , cooldown: null
  , covers: 0
}) {
  static new(type) {
    const data = getTraitDataModel(type);
    return TraitModel.fromServer({
      id: uuid.v4()
      , type
      , covers: data.coverSlots
    });
  }

  static fromServer(js) {
    return js == null
      ? null
      : new TraitModel(js);
    //.set('dataModel', TraitDataModel.new(js.type));
  }

  static LinkBetweenCheck(traitType, animal1, animal2) {
    return (!!traitType
      && animal1.hasTrait(traitType)
      && animal2.hasTrait(traitType)
      && animal1.traits.some((trait) => trait.type === traitType && (trait.hostAnimalId === animal2.id || trait.linkAnimalId === animal2.id))
    );
  }

  static LinkBetween(traitType, animal1, animal2) {
    if (this.LinkBetweenCheck(traitType, animal1, animal2)) {
      throw new ActionCheckError(`TraitModelValidation`, `Animal#%s already has LinkedTrait(%s) on Animal#%s`, animal1.id, traitType, animal2.id);
    }
    const trait1 = TraitModel.new(traitType);
    const trait2 = TraitModel.new(traitType);
    return [
      trait1
        .set('ownerId', animal1.ownerId)
        .set('hostAnimalId', animal1.id)
        .set('linkId', trait2.id)
        .set('linkSource', true)
        .set('linkAnimalId', animal2.id)
      , trait2
        .set('ownerId', animal2.ownerId)
        .set('hostAnimalId', animal2.id)
        .set('linkId', trait1.id)
        .set('linkSource', false)
        .set('linkAnimalId', animal1.id)
    ];
  }

  isEqual(id) {
    return this.id === id || this.type === id;
  }

  // TODO remove. somehow, it's rly not easy
  attachTo(animal) {
    return this
      .set('ownerId', animal.ownerId)
      .set('hostAnimalId', animal.id);
  }

  // TODO extract to separate function
  getDataModel() {
    return getTraitDataModel(this.type);
  }

  disable() {
    return this.set('disabled', true).set('value', false);
  }

  isLinked() {
    return this.linkId !== null; // && this.dataModel.cardTargetType & CTT_PARAMETER.LINK
  }

  findLinkedTrait(game) {
    return game.locateTrait(this.linkId, this.linkAnimalId, this.ownerId);
  }

  findAnimal(game) {
    return game.locateAnimal(this.hostAnimalId, this.ownerId);
  }

  findLinkedAnimal(game, animal) {
    return game.locateAnimal(
      animal.id === this.hostAnimalId ? this.linkAnimalId : this.hostAnimalId
      , this.ownerId)
  }

  checkActionFails(game, sourceAnimal) {
    const traitData = this.getDataModel();
    if (this.disabled) return 'Trait is disabled';
    if (sourceAnimal.hasFlag(TRAIT_ANIMAL_FLAG.REGENERATION)) return 'Regeneration';
    if (!traitData.action) return 'Trait has no .action';
    if (this.isOnCooldown(game, sourceAnimal)) return 'Trait has cooldown';
    // Either no $checkAction or it is passing
    if (traitData.$checkAction && !traitData.$checkAction(game, sourceAnimal, this))
      return '$checkAction fails';
    return false;
  };

  isOnCooldown(game, sourceAnimal) {
    const traitData = this.getDataModel();
    return !!(traitData.cooldowns
      && traitData.cooldowns.some(([link, place]) => game.cooldowns.checkFor(link, sourceAnimal.ownerId, sourceAnimal.id, this.id))
    );
  }

  toClient() {
    return this
  }

  toOthers() {
    console.log(this.type);
    const traitData = this.getDataModel();
    let result = this;
    if (traitData.transient) result = result.set('value', false);
    if (traitData.hidden) result = null;
    return result;
  }

  toString() {
    return `Trait#${this.type}#${this.id}@${this.hostAnimalId}(${this.value || ''})${this.disabled ? '(disabled)' : ''}`;
  }

  countScore() {
    if (this.isLinked()) {
      if (this.linkSource) {
        return 1 + this.getDataModel().food * 2 // 1 for linkSource only. And food is doubled by traits, so 2x score
      } else {
        return 0; // Doesn't count not linksourced
      }
    }
    return this.getDataModel().score + this.getDataModel().food;
  }

  //

  getCovers() {
    return this.covers;
  }
}