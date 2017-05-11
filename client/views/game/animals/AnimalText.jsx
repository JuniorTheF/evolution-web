import React from 'react';
import T from 'i18n-react'
import classnames from 'classnames';

import {connect} from 'react-redux';

import gecko from '../../../assets/gfx/gecko.svg';

import './AnimalText.scss';

export const AnimalText = ({animal}) =>(
  <span>
    <img className='AnimalText' src={gecko}/>
    {!!animal && <span>
      ({animal.slice(1)
        .map((trait, index) => (
          <span>
            {T.translate('Game.Trait.' + trait)}
          </span>))
        .map((item, index) => [index > 0 && ', ', item])
      })
    </span>}
  </span>
);

export default AnimalText;
