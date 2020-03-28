import React from 'react';
import './App.scss';
import GetRoomContents from './components/GetRoomData/GetRoomContents';
import GetRoomList from './components/GetRoomData/GetRoomList';

import {
  BrowserRouter as Router,
  Switch,
  Route
} from "react-router-dom";

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      apiResponse: {},
      isLoading: false,
      isInDraggingMode: false,
      mousePosition: { x: 0, y: 0 },
      timelineScroll: 0,
      timelineScrollCalc: 0
    };

    this.triggerDraggingMode = this.triggerDraggingMode.bind(this);
    this.updateTimelineScroll = this.updateTimelineScroll.bind(this);
    
  }

  
  onMouseMove(e) {
    this.setState({
      mousePosition: { 
        x: e.clientX,
        y: e.clientY
      }
    });
    this.timelineScrollCalc();
  }

  updateTimelineScroll( position ) {
    this.setState({ timelineScroll: position })
    this.timelineScrollCalc();
  }
  
  timelineScrollCalc() {
    this.setState({ timelineScrollCalc: this.state.mousePosition.x + this.state.timelineScroll })
  }
  
  triggerDraggingMode( toggle ) {
    // alert(toggle)
    if ( toggle ) {
      this.setState({ isInDraggingMode: true })
    } else {
      this.setState({ isInDraggingMode: false })
    }
  }

  

  callAPI() {
    fetch("http://localhost:5000/api/v1/all_rooms")
      .then(res => res.json())
      .then(res => this.setState({ apiResponse: res }))
      .catch(error => this.setState({ error, isLoading: false }));
  }

  componentDidMount() {
    this.callAPI();
  }

  render() {

    let allRooms = this.state.apiResponse.rooms

    return (
      <Router>
        <div
          onMouseMove={this.onMouseMove.bind(this)}
          onMouseUp={
            () => {
              this.triggerDraggingMode( false )
            }
          }
        >
          <div>
            {
              this.state.apiResponse.success ?
                Object.keys(allRooms).map(
                  id => <GetRoomList key={id} id={id} room={allRooms[id]} />
                )
                : "Loading"
            }
          </div>
          <Switch>
            <Route path="/:id" render={(props)=>(
              <GetRoomContents
                key={props.match.params.id}
                id={props.match.params.id}
                triggerDraggingMode={this.triggerDraggingMode}
                updateTimelineScroll={this.updateTimelineScroll}
                xPos={this.state.timelineScrollCalc}
                timelineScroll={this.state.timelineScroll}
              />
            )} />
          </Switch>
        </div>
      </Router>

    )
  }
}