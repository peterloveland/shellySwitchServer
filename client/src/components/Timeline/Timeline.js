import React from 'react';
import styles from './Timeline.module.scss';

export default class Timeline extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    
    };
  }
  render() {

    let timePeriods = this.props.timePeriods || []

    let latestEnd
  
    let newTimePeriods = []

    

    

    let hourTimelineData = []
    let hourTimelineJSX = []

    
    for (let hour=0; hour<=24; hour++){
      hourTimelineData.push(
        {
          "hour": hour,
          "state": null,
          "groupLength": 1
        }
      )
    }

    timePeriods.forEach(timePeriod => {
      let startIndex = timePeriod.start
      let endIndex = timePeriod.end
      for (let hour=startIndex; hour<=endIndex; hour++){
        hourTimelineData[hour].state = timePeriod.label
        hourTimelineData[hour].groupLength = timePeriod.end - timePeriod.start
      }
    })
    
    let lastGroup

    hourTimelineData.forEach(hourObj => {
      if ( hourObj.state === null) {
        hourTimelineJSX.push(
          <HourContainer
            hour={hourObj.hour}
          />
        )
      } else if ( hourObj.state !== lastGroup) {
        let pillWidth = +styles.pillWidth.replace('rem','')
        let pillSpacing = +styles.pillSpacing.replace('rem','')
        const mystyle = {
          width: `${(pillWidth)*hourObj.groupLength}rem`
        };
        hourTimelineJSX.push(
          <div
            style={mystyle}
            className={`${styles.hourContainer}`}
          >
            <GroupContainer
              groupTitle={hourObj.state}
            >

            </GroupContainer>
          </div>
        )
        lastGroup = hourObj.state
      } else if ( hourObj.state === lastGroup ) {
        
      }

    })
    
  
    return (
      <div className={`${styles.allHours}`}>
        
        {hourTimelineJSX}
      </div>
    )

  }
}




export class HourContainer extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {


    return(
      <div className={`${styles.hourContainer}`}>
        <div className={`${styles.labelContainer}`}>
          <div className={`${styles.hourLabelContainer}`}>
            <a>{`${this.props.hour}:00`}</a>
          </div>
          <div className={`${styles.keyline}`} />
        </div>
        <div
          key={this.props.hour}
          className={`${styles.hourPill} ${this.props.className}`}
        >
          {this.props.children}
        </div>
      </div>
    )
  }
}





export class GroupContainer extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {


    return(
      <div className={`${styles.groupContainer}`}>
        {this.props.groupTitle}
      </div>
    )
  }
}


