import uuid from 'uuid';
import invariant from 'invariant';
import {OrderedMap, List} from 'immutable';

import {GameModel, StatusRecord, PHASE} from './GameModel';
import {PlayerModel} from './PlayerModel';
import {CardModel} from './CardModel';
import {AnimalModel} from './evolution/AnimalModel';
import {TraitModel} from './evolution/TraitModel';
import * as cardsData from './evolution/cards/index';
import {TraitNeoplasm} from './evolution/traitsData';
import yaml from 'yaml-js';
import logger from "../../utils/logger";

const searchCardClasses = (name) => Object.keys(cardsData)
  .find(cardType => ~cardType.toLowerCase().indexOf(name.toLowerCase()));

export const parsePhase = (string) => PHASE[Object.keys(PHASE).find((key) => {
  string = !!string ? string.toUpperCase() : 'DEPLOY';
  return key === string
})];

export const parseCardList = string => {
  invariant(typeof string === 'string', `GameModel.parseCardList: bad string: (${string})`)
  return GameModel.generateDeck(string
    .split(',')
    .map(raw => {
      let countAndCard = raw.trim().split(' ');
      if (countAndCard.length === 1) {
        if (countAndCard[0].length === 0) {
          return null;
        } else {
          countAndCard = [1, countAndCard[0]];
        }
      }
      if (countAndCard.length > 2) {
        console.warn(`Cannot parse CardAndCount[${raw}]`);
        return null;
      }
      const cardClass = searchCardClasses(countAndCard[1]);
      invariant(cardClass, `GameModel.parseCardList: can't find ${countAndCard[1]}`);
      countAndCard[1] = cardClass;
      return countAndCard;
    })
    .filter(cc => cc !== null));
};

export const parseAnimalList = (userId, string) => {
  invariant(typeof userId === 'string', `GameModel.parseAnimalList wrong userId: (${userId})`);
  invariant(typeof string === 'string', `GameModel.parseAnimalList wrong string: (${string})`);
  const links = [];
  let animalsMap = string.split(',')
    .map(rawAnimal => rawAnimal.trim())
    .filter(rawAnimal => rawAnimal.length > 0)
    .map(rawAnimal => rawAnimal
      .split(' ')
      .reduce((animal, prop) => {
        prop = prop.trim();
        if (/^\$.*$/.test(prop)) {
          return prop.length > 1 ? animal.set('id', prop) : animal;
        }
        else if (/\$/.test(prop)) {
          const [traitName, targetId] = prop.split('$');
          links.push([animal.id, traitName, '$' + targetId]);
          return animal;
        }
        else if (/^\++$/.test(prop)) {
          return animal.set('food', prop.length)
        }
        else {
          invariant(!!prop, `GameModel.parseAnimalList prop undefined: (${userId})`);
          const type = TraitModel.parse(prop.split('=')[0]);
          const value = prop.split('=')[1];
          if (!type) throw new Error(`Cannot parse prop (${prop})`);
          return animal.traitAttach(TraitModel.new(type).set('value', value), true);
        }
      }, AnimalModel.new(userId, null)))
    .reduce((result, animal) => result.set(animal.id, animal), OrderedMap());
  links.forEach(([a1id, prop, a2id]) => {
    invariant(animalsMap.has(a1id), 'invalid linkable trait ' + [a1id, prop, a2id]);
    invariant(animalsMap.has(a2id), 'invalid linkable trait ' + [a1id, prop, a2id]);
    const a1 = animalsMap.get(a1id);
    const a2 = animalsMap.get(a2id);
    const [trait1, trait2] = TraitModel.LinkBetween(TraitModel.parse(prop), a1, a2);
    animalsMap = animalsMap
      .set(a1.id, a1.traitAttach(trait1))
      .set(a2.id, a2.traitAttach(trait2));
  });
  return animalsMap
    .map(a => TraitNeoplasm.customFns.actionProcess(a))
  // .map(a => {
  //   console.log(a.traits.map(t => t.type).toArray())
  //   return a;
  // });
};

export const parseFromRoom = (room, string = '') => {
  const seed = yaml.load(string) || {};

  const deck = parseCardList(seed.deck || '').map(card => card.toClient());

  const players = room.users.reduce((result, id, index) => {
    return [...result, [id, new PlayerModel({
      id
      , hand: parseCardList(seed.players && seed.players[index] && seed.players[index].hand || '')
      , continent: parseAnimalList(id, seed.players && seed.players[index] && seed.players[index].continent || '')
      , index
      , ended: false
    }).toClient()]];
  }, []);

  return GameModel.fromServer(new GameModel({
    id: uuid.v4()
    , roomId: room.id
    , timeCreated: Date.now()
    , food: seed.food || 0
    , status: new StatusRecord({
      roundPlayer: room.users.first()
      , currentPlayer: room.users.first()
      , phase: parsePhase(seed.phase)
    })
    , deck
    , players
    , settings: {
      ...seed.settings
    }
  }).toJS());
};

export const parseRaw = (string) => parseFromRoom({
  id: 'test'
  // , users
}, string);
