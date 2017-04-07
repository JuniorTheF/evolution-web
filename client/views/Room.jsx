import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import {connect} from 'react-redux';
import {Map} from 'immutable';

import * as MDL from 'react-mdl';
import {UsersList} from './UsersList.jsx';

import {roomExitRequest} from '~/shared/actions/actions';

export const Room = React.createClass({
  mixins: [PureRenderMixin]
  , render: function () {
    console.log(this.props.actions)
    return <div className="Room">
      <MDL.Button raised onClick={this.props.actions.back}>Back</MDL.Button>
      <div>Room {this.props.room.name}</div>
      <div>Online users: <UsersList list={this.props.online}/></div>
      <div>In this room: <UsersList list={this.props.online.filter(user => {
      return ~this.props.room.users.indexOf(user.id)
      })}/></div>
    </div>;
  }
});

//<MDL.Button raised colored onClick={this.props.actions.roomCreateRequest}>Create room</MDL.Button>

export const RoomView = connect(
  (state) => {
    const roomId = state.get('room');
    return {
      room: state.getIn(['rooms', roomId])
      , online: state.get('online')
    }
  }
  , (dispatch) => ({
    actions: {
      back: function () {
        dispatch(roomExitRequest())
      }
    }
  })
)(Room);