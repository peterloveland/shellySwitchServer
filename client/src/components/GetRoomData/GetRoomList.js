import React from 'react';
import {
  Link
} from "react-router-dom";

export default class GetRoomList extends React.Component {
  render() {

    let roomID = this.props.id
    let roomTitle = this.props.room.label

    return (
      <div>
        <Link to={roomID}>
          {roomTitle}
        </Link>
      </div>
    )

  }
}

