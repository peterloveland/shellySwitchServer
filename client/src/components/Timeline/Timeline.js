import React from 'react';
import styles from './Timeline.module.scss';

let myArray = []
let lastSelected
let originalSelect
let timelineWidth

export default class Timeline extends React.Component {
  constructor(props) {
    super(props);
    this.selector = React.createRef();
    this.state = {
      isDragging: false,
      hoveredTiles: [],
      isForcedScrolling: false,
      rightScrollIntervalID: 0,
      leftScrollIntervalID: 0
    };
  }
  

  componentDidMount = () => {
    timelineWidth = this.selector.current.getClientRects()[0].width;
  };


  checkIfRemovalRequired = (myArray, theValue, direction, callback) => {

    if ( !myArray.includes(theValue) ) { // prevents duplicates
      callback();
    }

    let lowest = Math.min(...myArray)
    let highest = Math.max(...myArray)

    if (direction === "isAfter") {
      // the currently selected hour is before the highest, so remove it
      if ( theValue < highest ) {
        myArray.pop()
      }
    }
    if (direction === "isBefore") {
      // the currently selected hour is after the lowest, so remove it
      if ( lowest < theValue ) {
        myArray.shift()
      }
    }
  }
  
  

  addToHoveredTiles = (theValue) => {
    
    if ( this.state.isDragging ) {
      // let originalSelect = myArray[0]
      if( myArray.length === 0 ) {
        originalSelect = theValue
      }      

      let direction
      let addToArrayFunction

        if (theValue < originalSelect) {
          direction = "isBefore";
          addToArrayFunction = () => { myArray.unshift(theValue) }
        } else if (theValue > originalSelect) {
          direction = "isAfter";
          addToArrayFunction = () => { myArray.push(theValue) }
        } else {
          direction = null;
        }
      
        if ( direction ) {
          this.checkIfRemovalRequired( myArray, theValue, direction, ()  => { addToArrayFunction() })
        } else {
          // you're only hovered on the one tile, so override the array with this value
          myArray = [theValue]
        }   
      }


  }

  handleScroll = e => {
    let element = e.target
    this.props.updateTimelineScroll(element.scrollLeft)
  }

  scrollRight = () => {
    this.selector.current.scrollLeft = this.selector.current.scrollLeft + 100;
  }

  scrollLeft = () => {
    this.selector.current.scrollLeft = this.selector.current.scrollLeft - 100;
  }

  dragScrollTimeline() {
    
    let edgeTriggerDistance = 80
    
    let mousePosition = this.props.mousePosition ? this.props.mousePosition.x : null

    let distanceFromLeft  = mousePosition
    let distanceFromRight = timelineWidth - mousePosition

    let inLeftScrollZone =  distanceFromLeft  < edgeTriggerDistance && this.state.isDragging
    let inRightScrollZone = distanceFromRight < edgeTriggerDistance && this.state.isDragging

    let isForcedScrolling = this.state.isForcedScrolling

    if( inRightScrollZone ) {
      if( !isForcedScrolling ) {
        let rightIntervalID = setInterval(this.scrollRight, 500);
        this.setState({
          rightScrollIntervalID: rightIntervalID,
          isForcedScrolling : true
        })
      }
    } else if( inLeftScrollZone ) {
      if( !isForcedScrolling ) {
        let leftIntervalID = setInterval(this.scrollLeft, 500);
        this.setState({
          leftScrollIntervalID: leftIntervalID,
          isForcedScrolling : true
        })
      }
    } else {
      if( isForcedScrolling ) {
        this.setState({
          isForcedScrolling : false
        })
        clearInterval( this.state.leftScrollIntervalID )
        clearInterval( this.state.rightScrollIntervalID )
        // clear all intervals (seemed to be a memory leak?
        for (let index = 0; index < Math.max(this.state.leftScrollIntervalID,this.state.rightScrollIntervalID); index++) {
          // clearInterval( index )        
        }
      }
    }    
  }
  
  render() {
    
    this.dragScrollTimeline()

    let timePeriods = this.props.timePeriods || []

    let hourTimelineData = []
    let hourTimelineJSX = []

    let allStartHours = []
    let allEndHours = []
    
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


    hourTimelineData.forEach( (hourObj,index) => {

      let isEmptyHour = Object.entries(hourObj.state).length === 0 && hourObj.state.constructor === Object
      let isDuplicatesInARow = (hourObj.dup_before && hourTimelineData[index+1].dup_after) || (hourObj.dup_after && hourTimelineData[index-1].dup_before)
      // isDuplicatesInARow = false
      
      if ( isDuplicatesInARow ) {
        
      } else if ( isEmptyHour ) { // if object is empty (not in a group)
        hourTimelineJSX.push(
          <HourContainer
            key={`hour_${hourObj.hour}`}
            hour={hourObj.hour}
            isDragging={this.state.isDragging}
            addToHoveredTiles={this.addToHoveredTiles}
            hoveredTiles={myArray}
            {...this.props}
          />
        )
      } else { // is a group
        // let pillWidth = +styles.pillWidth.replace('rem','')
        // let pillSpacing = +styles.pillSpacing.replace('rem','')
        // const mystyle = {
          // width: `${(pillWidth)*hourObj.state.groupLength}rem`
        // };
        hourTimelineJSX.push(
          <div
            key={`group_${hourObj.hour}`}
            // style={mystyle}
            // className={`${styles.hourContainer}`}
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
      <div
        className={`${styles.allHours} ${ this.state.isDragging ? styles.noScrollSnap : null } ${ this.state.isForcedScrolling ? styles.animateScroll : null}`}
        onScroll={this.handleScroll}
        ref={this.selector}
        onMouseDown={
          () => {
            this.props.triggerDraggingMode(true)
            this.setState({ isDragging: true })
          }
        }
        onMouseUp={
          () => {
            this.setState({
              isDragging: false,
              hoveredTiles: myArray
            })
            lastSelected = null
            myArray = []
            this.props.triggerDraggingMode(true)
          }
        }
      >
        {/* <div
          style={{ left: this.props.timelineHoverXPos}}
          className={styles.marker}
        >
          { this.props.timelineHoverXPos }
        </div>  */}
        {hourTimelineJSX}
      </div>
    )

  }
}


export class HourContainer extends React.Component {
  constructor(props) {
    super(props);
    this.selector = React.createRef();
    this.state = {
      startPoint: 0,
      isHover: false
    };
  }

  onMouseMove = () => {
    let mousePosition = this.props.mousePosition,
    rect

    if( this.selector.current ) {
      rect = this.selector.current.getBoundingClientRect();
    }

    let startX = rect.x,
        startY = rect.y,
        blurMove = `translate(${ (mousePosition.x - startX).toFixed(0) }px,${ (mousePosition.y - startY).toFixed(0) }px)`

    let xCenterPoint = rect.x + (rect.width / 2),
        yCenterPoint = rect.y + (rect.height / 2),
        xPercentage = ((mousePosition.x - xCenterPoint)/(rect.width / 2)).toFixed(2),
        yPercentage = ((mousePosition.y - yCenterPoint)/(rect.height / 2)).toFixed(2)

        
    let maxRotation = 15,
        xDeg = (xPercentage * maxRotation).toFixed(1)*-1,
        yDeg = (yPercentage * maxRotation).toFixed(1)*-1,
        transformRotate = `rotateY(${ xDeg }deg) rotateX(${ yDeg/2 }deg) translateY(${((yDeg*-1)/20).toFixed(1)}px)`

    this.setState({transformRotate: transformRotate})
    this.setState({blurMove: blurMove})
  }

  isHourBeingDragged() {
    const rect = this.selector.current.getBoundingClientRect();
    let start = rect.x + this.props.timelineScroll
    let end = rect.x + this.props.timelineScroll + rect.width
    let timelineHoverXPos = this.props.timelineHoverXPos
    if ( start < timelineHoverXPos && timelineHoverXPos < end ) {
      this.props.addToHoveredTiles( this.props.hour )
      return styles.tileIsHovered
    }
    return null
  }
  
  render() {
    let isHourActive = this.props.hoveredTiles.includes(this.props.hour)
    let isHighlighted = isHourActive ? styles.isHighlighted : null
    const blurMoveStyles = {
      transform: this.state.blurMove
    };
    const mystyle = {
      zIndex: 2,
      position: "relative",
      transform: this.state.transformRotate
    };
    return(
      <div
        className={`${styles.hourContainer} ${ this.props.isDragging ? this.isHourBeingDragged() : null } ${isHighlighted}`}
        onMouseDown={this.props.onMouseDown}
        onMouseOver= {
          this.props.onMouseOver,
          () => {
            this.setState({isHover: true})
          }
        }
        onMouseOut= {
          () => {
            this.setState({isHover: false})
          }
        }
      >
        <div
         className={`${styles.pillWrapper}`}
        >
          <div
            key={this.props.hour}
            onMouseMove={this.onMouseMove}
            className={`${styles.hourPill} ${this.props.className} `}
            style={this.state.isHover ? mystyle : null}
            ref={this.selector}
          >
            { this.state.isHover ? 
              <div
                className={`${styles.blurHighlight}`}
                style={this.state.isHover ? blurMoveStyles : null}
              />          
              : null
            }
            { !isHourActive ? <div className={`${styles.hourLabel}`}>{`${this.props.hour}:00`}</div> : <div className={`${styles.hourLabel}`}>{`${this.props.hour}:00`}</div> }
          </div>
        </div>
      </div>
    )
  }
}





export class GroupContainer extends React.Component {
  constructor(props) {
    super(props);
    this.selector = React.createRef();
    this.state = {
      startPoint: 0
    };
  }


  componentDidMount = () => {
    const rect = this.selector.current.getClientRects();
    this.setState({ startPoint: rect[0].x })
  };
  
  render() {
    return(
      <div
        className={`${styles.groupContainer}`}
        ref={this.selector}
      >
        <div>
          <span>
            { this.state.startPoint }&nbsp;
          </span>
          {this.props.groupRange}
        </div>
      </div>
    )
  }
}


