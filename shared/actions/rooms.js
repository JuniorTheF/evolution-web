import logger from '~/shared/utils/logger';
import {RoomModel} from '../models/RoomModel';

import {server$gameLeave} from './game';

import {actionError} from './generic';
import {redirectTo} from '../utils';
import {selectRoom} from '../selectors';

export const roomCreateRequest = () => ({
  type: 'roomCreateRequest'
  , data: {}
  , meta: {server: true}
});
export const roomJoinRequest = (roomId) => ({
  type: 'roomJoinRequest'
  , data: {roomId}
  , meta: {server: true}
});
export const roomExitRequest = () => (dispatch, getState) => dispatch({
  type: 'roomExitRequest'
  , data: {roomId: getState().get('room')}
  , meta: {server: true}
});
export const roomCreateSuccess = (room) => ({
  type: 'roomCreateSuccess'
  , data: {room}
  , meta: {users: true}
});
export const roomJoinSuccess = (roomId, userId) => ({
  type: 'roomJoinSuccess'
  , data: {roomId, userId}
  , meta: {users: true}
});
export const roomJoinSuccessNotify = (roomId, userId) => ({
  type: 'roomJoinSuccessNotify'
  , data: {roomId, userId}
});
export const roomExitSuccess = (roomId, userId) => ({
  type: 'roomExitSuccess'
  , data: {roomId, userId}
  , meta: {users: true}
});
export const roomExitSuccessNotify = (roomId, userId) => ({
  type: 'roomExitSuccessNotify'
  , data: {roomId, userId}
});

export const server$roomExit = (roomId, userId) => (dispatch, getState) => {
  console.log('server$roomExit')
  const room = selectRoom(getState, roomId);
  dispatch(roomExitSuccess(roomId, userId));
  if (room && room.gameId) {
    dispatch(server$gameLeave(room.gameId, userId));
  }  
};

const server$roomJoinRequest = ({roomId}, {user: {id: userId}}) => (dispatch, getState) => {
  const room = getState().getIn(['rooms', roomId]);
  if (!room) {
    dispatch(actionError(userId, 'bad room')); // TODO add validation
    return;
  }
  const userAlreadyInRoom = room.users.some(uid => uid === userId);
  if (!userAlreadyInRoom) {
    const previousRoom = getState().get('rooms').find(room => {
      return room.users.some(uid => uid === userId);
    });
    if (previousRoom) {
      dispatch(roomExitSuccess(previousRoom.id, userId));
    }
    dispatch(roomJoinSuccess(roomId, userId));
  }
};

export const roomsClientToServer = {
  roomCreateRequest: (data, {user}) => (dispatch, getState) => {
    const userId = user.id;
    const room = RoomModel.new();
    dispatch(roomCreateSuccess(room));
    dispatch(server$roomJoinRequest({roomId: room.id}, {user}));
  }
  , roomJoinRequest: server$roomJoinRequest
  , roomExitRequest: ({roomId}, {user}) => roomExitSuccess(roomId, user.id)
};

export const roomsServerToClient = {
  roomCreateSuccess: ({room}) => roomCreateSuccess(RoomModel.fromJS(room))
  , roomJoinSuccess: ({roomId, userId}, currentUserId) => (dispatch, getState) => {
    dispatch(roomJoinSuccessNotify(roomId, userId));
    if (currentUserId === userId) {
      dispatch(roomJoinSuccess(roomId));
      dispatch(redirectTo(`/room/${roomId}`));
    }
  }
  , roomExitSuccess: ({roomId, userId}, currentUserId) => (dispatch, getState) => {
    dispatch(roomExitSuccessNotify(roomId, userId));
    if (currentUserId === userId) {
      dispatch(roomExitSuccess(roomId));
      dispatch(redirectTo(`/`));
    }
  }
};