import React from 'react';

import Timeline from '../Timeline/Timeline';

export default class GetRoomContents extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      apiResponse: {},
      isLoading: true,
      error: false
    };
  }
  
  callAPI() {
    fetch(`http://localhost:5000/api/v1/room?roomID=${this.props.id}`)
      .then(res => res.json())
      .then(res => this.setState({ apiResponse: res, isLoading: false }))
      .catch(error => this.setState({ error: true, isLoading: false }));
  }
  

  componentDidMount() {
    this.callAPI();
  }

  render() {
    let room
    let lights
    let sensors
    let timePeriods
    let sharedProps
    
    if ( !this.state.isLoading ) {
      room = this.state.apiResponse.room
      lights = room.lights
      sensors = room.sensors
      timePeriods = room.timePeriods
      sharedProps = {
        triggerDraggingMode: this.props.triggerDraggingMode,
        timePeriods: timePeriods,
        updateTimelineScroll: this.props.updateTimelineScroll,
        xPos: this.props.xPos,
        timelineScroll: this.props.timelineScroll
      }
      return (
        <div>
          <Timeline
            {...sharedProps}
          />
          <h3>ID: {room.title}</h3>
          <p>Number of lights: { lights.length }</p>
          <p>Number of sensors: { sensors.length }</p>
        </div>
      )
    } else {
      return (
        <div>
          <Timeline
            {...sharedProps}
          />
          <h3>ID: {this.props.id}</h3>
          <p>Loading</p>
        </div>
      )
    }


  }
}