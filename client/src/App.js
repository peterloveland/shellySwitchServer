import React from 'react';
import './App.css';
import Timeline from './components/Timeline/Timeline';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      apiResponse: {},
      isLoading: false
    };
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
        <div>
          <div>
            { this.state.apiResponse.success ? Object.keys(allRooms).map(id => <GetRoomList key={id} id={id} room={allRooms[id]} /> ) : "Loading" }
          </div>
          <Switch>
            <Route path="/:id" render={(props)=>(
              <GetRoomContents
                key={props.match.params.id}
                id={props.match.params.id}
              />
            )} />
          </Switch>
        </div>
      </Router>

    )
  }
}



export class GetRoomList extends React.Component {
  constructor(props) {
    super(props);
  }
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

export class GetRoomContents extends React.Component {
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
    
    if ( !this.state.isLoading ) {
      room = this.state.apiResponse.room
      lights = room.lights
      sensors = room.sensors
      return (
        <div>
          <Timeline />
          <h3>ID: {room.title}</h3>
          <p>Number of lights: { lights.length }</p>
          <p>Number of sensors: { sensors.length }</p>
        </div>
      )
    } else {
      return (
        <React.Fragment>
          <h3>ID: {this.props.id}</h3>
          <p>Loading</p>
        </React.Fragment>
      )
    }


  }
}