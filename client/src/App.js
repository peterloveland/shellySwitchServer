import React from 'react';
import './App.css';

export default class App extends React.Component {
  constructor(props) {
      super(props);
      this.state = { apiResponse: "" };
  }

  callAPI() {
      fetch("http://localhost:5000/api/v1/timePeriods?roomID=bedroom_1")
          .then(res => res.text())
          .then(res => this.setState({ apiResponse: res }));
  }

  componentWillMount() {
      this.callAPI();
  }

  render() {
      return(
        <p className="App-intro">
            {this.state.apiResponse}
        </p>
      )
  }
}