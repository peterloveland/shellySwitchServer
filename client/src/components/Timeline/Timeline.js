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


    let hourTimelineData = []
    let hourTimelineJSX = []

    let allStartHours = []
    let allEndHours = []

    console.log(Array.isArray(hourTimelineData))
    
    for (let hour=0; hour<=24; hour++){
      hourTimelineData.push(
        {
          "hour": hour,
          "state": { }
        }
      )
    }

    timePeriods.forEach(timePeriod => {
      
      let startIndex = timePeriod.start
      allStartHours.push(startIndex)
      let endIndex = timePeriod.end
      allEndHours.push(endIndex)

      for (let hour=startIndex; hour<=endIndex; hour++){
        hourTimelineData[hour].state.groupTitle = timePeriod.label
        hourTimelineData[hour].state.groupLength = timePeriod.end - timePeriod.start
        hourTimelineData[hour].state.groupStart = timePeriod.start
        hourTimelineData[hour].state.groupEnd = timePeriod.end
      }
    })

    allStartHours.forEach( theHour => {
      console.log(theHour)
      if ( allEndHours.includes(theHour) ) {
        console.log(`REMOVE ${theHour}`)
        // allStartHours = allStartHours.filter(startHour => startHour !== theHour)
        // allEndHours = allEndHours.filter(endHour => endHour !== theHour)
      }
    }) 

    console.log(allStartHours)
    console.log(allEndHours)
  

    let indexesToRemove = []
    let duplicatedIndexesBefore = []
    let duplicatedIndexesAfter = []

    hourTimelineData.forEach( (hourObj,index) => {
      
      let isInAGroup = Object.entries(hourObj.state).length !== 0 && hourObj.state.constructor === Object
      let groupIsLargerThanOne = hourObj.state.groupLength >= 1
      let isFirstInGroup = allStartHours.includes(hourObj.hour)
      let isLastInGroup = allEndHours.includes(hourObj.hour)
      let hasBeenDuplicatedBefore = duplicatedIndexesBefore.includes(hourObj.hour)
      let hasBeenDuplicatedAfter = duplicatedIndexesAfter.includes(hourObj.hour)
      
      // if a new hour needs adding before
      if ( isFirstInGroup && !hasBeenDuplicatedBefore ) {
        duplicatedIndexesBefore.push(hourObj.hour)
        hourTimelineData.splice( index , 0, { "hour": hourObj.hour, "dup_before" : true, "state" : {} }); // at index position 1, remove 0 elements, then add "baz" to that position
      }

      // // if a new hour needs adding after
      if ( isLastInGroup && !hasBeenDuplicatedAfter ) {
        duplicatedIndexesAfter.push(hourObj.hour)
        hourTimelineData.splice( index + 1 , 0, { "hour": hourObj.hour, "dup_after" : true, "state" : {} }); // at index position 1, remove 0 elements, then add "baz" to that position
      }

      if ( (isInAGroup && groupIsLargerThanOne && !isFirstInGroup) ) {
        indexesToRemove.push(index)
      }
    })


    for (var i = indexesToRemove.length -1; i >= 0; i--) {
      hourTimelineData.splice(indexesToRemove[i],1);
    }

// /
    console.log(hourTimelineData)


    hourTimelineData.forEach( (hourObj,index) => {

      let isEmptyHour = Object.entries(hourObj.state).length === 0 && hourObj.state.constructor === Object
      let isDuplicatesInARow = (hourObj.dup_before && hourTimelineData[index+1].dup_after) || (hourObj.dup_after && hourTimelineData[index-1].dup_before)
      // isDuplicatesInARow = false
      
      if ( isDuplicatesInARow ) {
        
      } else if ( isEmptyHour ) { // if object is empty (not in a group)
        hourTimelineJSX.push(
          <HourContainer
            hour={hourObj.hour}
          />
        )
      } else { // is a group
        let pillWidth = +styles.pillWidth.replace('rem','')
        let pillSpacing = +styles.pillSpacing.replace('rem','')
        const mystyle = {
          width: `${(pillWidth)*hourObj.state.groupLength}rem`
        };
        hourTimelineJSX.push(
          <div
            style={mystyle}
            className={`${styles.hourContainer}`}
          >
            <GroupContainer
              groupTitle={hourObj.state}
              groupRange={`${hourObj.state.groupStart}:00 – ${hourObj.state.groupEnd}:00`}
            >
            </GroupContainer>
          </div>
        )
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
        <div
          key={this.props.hour}
          className={`${styles.hourPill} ${this.props.className}`}
        >
          <a className={`${styles.hourLabel}`}>{`${this.props.hour}:00`}</a>
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
        <a>{this.props.groupRange}</a>
      </div>
    )
  }
}


